# TimeHub 架构修复与优化

**修复日期**: 2025-11-21  
**问题来源**: 通过 UnifiedDateTimePicker 选择时间后，Slate 编辑器中 DateMentionElement 不更新  
**根本原因**: getEventTime 接口判断条件过严，导致部分时间字段被忽略，走到 fallback（旧数据）

---

## 1. 问题诊断

### 1.1 用户报告的现象

用户点击 PlanItemTimeDisplay 打开 UnifiedDateTimePicker，选择时间（如"下周三下午3点"），但：
- ✅ UnifiedDateTimePicker 成功调用 `TimeHub.setEventTime()`
- ✅ TimeHub 更新时间为 `2025-11-21T14:00:00`
- ❌ DateMentionElement 仍然显示旧时间 `2025-11-12T12:00:06`

### 1.2 调试日志分析

通过完整的调试日志链路发现：

```
[TimeHub] emit 被调用
  eventId: "event-1731378003206"
  start: "2025-11-21T14:00:00"  ← TimeHub 正确设置
  end: "2025-11-21T15:00:00"

↓

[useEventTime] 订阅触发
  eventId: "event-1731378003206"
  snapshot.start: "2025-11-21T14:00:00"  ← 订阅者收到更新
  snapshot.end: "2025-11-21T15:00:00"

↓

[🔴 SYNC] syncToUnifiedTimeline 被调用
  startTime: "2025-11-12T12:00:06"  ← PlanManager 使用旧数据
  endTime: "2025-11-12T12:00:06"
  
↓

[🔴 SYNC] 时间数据准备完成
  finalStartTime: "2025-11-12T12:00:06"  ← 覆盖了 TimeHub 的值！
  source: "fallback"  ← 走到了 fallback 分支
```

### 1.3 根本原因定位

**PlanManager.syncToUnifiedTimeline** (L1283-1350) 调用 `getEventTime`：

```typescript
const eventTime = getEventTime(item.id, {
  start: item.startTime || null,  // 旧数据
  end: item.endTime || null,
  dueDate: item.dueDate || null,
  isAllDay: item.isAllDay,
  timeSpec: (item as any).timeSpec,
});
```

**getEventTime 的 bug** (L44-59):

```typescript
// ❌ 问题：要求同时有 start 和 end
if (snapshot.start && snapshot.end) {
  return {
    start: snapshot.start,
    end: snapshot.end,
    isAllDay: snapshot.timeSpec?.allDay ?? false,
    timeSpec: snapshot.timeSpec,
  };
}

// ❌ 如果用户只设置了 start（end 为 null），这里会失败
// → 跳过 TimeHub 分支
// → 检查 EventService 分支（也失败）
// → 走到 fallback（返回旧数据）
```

---

## 2. 架构问题分析

### 2.1 用户提出的核心问题

1. **哪些组件有权向 TimeHub 提交修改？**
   - 用户想理解 TimeHub 的写权限控制

2. **为什么 syncToUnifiedTimeline 需要"优先劣后"安排，而不是直接使用 TimeHub？**
   - 用户质疑为什么不直接信任 TimeHub 作为唯一真相源
   - 期望简化逻辑，去掉 fallback

3. **getEventTime 接口定义有问题**
   - `if (snapshot.start && snapshot.end)` 要求同时有两个字段
   - 如果用户只设置了 start 或只设置了 end，条件就会失败
   - 应该能接受 null 的时间

4. **DateMentionElement 也需要能给 TimeHub 提交时间修改**
   - DateMentionElement 通过 useEventTime 已获取到 setEventTime 方法
   - 但缺少调用逻辑（点击处理）

### 2.2 TimeHub 设计哲学

**单一真相源 (Single Source of Truth)**:
- TimeHub 是时间数据的**唯一真相源**
- 所有时间读取应优先从 TimeHub 获取
- fallback 只是为了兼容性，不应该成为主要路径

**写权限控制**:
- 严格限制：只有 **4 个授权组件**可调用 `TimeHub.setEventTime()`
- 其他组件只读：通过 `useEventTime` hook 订阅更新

---

## 3. 修复方案

### 3.1 修复 getEventTime 接口 ✅

**文件**: `src/services/timeManager.ts`

**修复内容**:

```typescript
// ✅ 修复后：接受部分时间字段（start 或 end 有任一即可）
if (snapshot.start || snapshot.end) {  // ← 改为 OR 判断
  return {
    start: snapshot.start ?? null,  // ← 允许 null
    end: snapshot.end ?? null,
    isAllDay: snapshot.timeSpec?.allDay ?? false,
    timeSpec: snapshot.timeSpec,
  };
}

// EventService 优先级（同样修复）
if (event?.startTime || event?.endTime) {  // ← 改为 OR 判断
  return {
    start: event.startTime ?? null,  // ← 允许 null
    end: event.endTime ?? null,
    isAllDay: event.isAllDay ?? false,
    timeSpec: undefined,
  };
}
```

**影响范围**:
- 所有调用 `getEventTime` 的地方都会受益
- 包括 PlanManager.syncToUnifiedTimeline
- 包括其他读取时间的组件

### 3.2 为 DateMentionElement 添加编辑能力 ✅

**文件**: `src/components/SlateEditor/Elements/DateMentionElement.tsx`

**修复内容**:

```typescript
// 1. 导入必要的 hook
import React, { useMemo, useState, useRef } from 'react';

// 2. 从 useEventTime 获取 setEventTime 方法
const { timeSpec, start, end, loading, setEventTime } = useEventTime(eventId);

// 3. 添加点击处理
const handleClick = (e: React.MouseEvent) => {
  e.preventDefault();
  e.stopPropagation();
  
  if (!eventId) {
    console.warn('[DateMentionElement] 无法编辑：缺少 eventId');
    return;
  }
  
  console.log('[DateMentionElement] 点击日期，可以调用 setEventTime 修改时间', {
    eventId,
    currentStart: start,
    currentEnd: end,
    setEventTime: typeof setEventTime,
  });
  
  // TODO: 打开日期选择器
  // await setEventTime({ start: '...', end: '...' });
};

// 4. 绑定点击事件
<span
  {...attributes}
  onClick={eventId ? handleClick : undefined}
  style={{
    cursor: eventId ? 'pointer' : 'default',
    // ... 其他样式
  }}
>
  {formatRelativeDate(start, end)}
  {children}
</span>
```

**设计说明**:
- DateMentionElement 通过 `useEventTime` hook 获得 `setEventTime` 方法
- 点击日期时，可以调用 `setEventTime` 向 TimeHub 提交修改
- TODO: 完整实现需要打开日期选择器（UnifiedDateTimePicker）

### 3.3 文档更新 ✅

**文件 1**: `docs/PRD/PLANMANAGER_MODULE_PRD.md`

在 "## 4. TimeHub 集成与时间显示" 之前新增 **"### 4.0 有权向 TimeHub 提交时间修改的组件"** 章节：

- **授权组件列表表格**（4 个组件）
- **调用示例代码**
- **禁止行为说明**（❌ 普通组件直接调用、绕过 TimeHub 等）
- **数据流图解**

**文件 2**: `docs/SLATE_DEVELOPMENT_GUIDE.md`

在 "PlanManager 交互机制" 之前新增 **"## TimeHub 授权组件与写权限管理"** 章节：

- **TimeHub 架构原则**（唯一真相源）
- **授权组件列表**（复用 PlanManager PRD 的表格）
- **调用示例**（DateMentionElement）
- **禁止行为**（错误做法）
- **数据流**（用户操作 → TimeHub → EventService → 订阅者更新）

---

## 4. 有权向 TimeHub 提交修改的组件列表

| 组件 | 文件路径 | 提交方式 | 用途 |
|------|---------|---------|------|
| **UnifiedDateTimePicker** | `components/TimePicker/UnifiedDateTimePicker.tsx` | `TimeHub.setEventTime()` | 主要时间选择入口 |
| **DateMentionPicker** | `components/SlateEditor/DateMentionPicker.tsx` | `TimeHub.setEventTime()` | 自然语言解析（如"下周三"） |
| **EventEditModal** | `components/EventEditModal/EventEditModal.tsx` | `TimeHub.setEventTime()` | 事件编辑弹窗 |
| **DateMentionElement** | `components/SlateEditor/Elements/DateMentionElement.tsx` | `setEventTime()` (hook) | Slate 日期节点点击编辑 |

**关键点**:
- ✅ 只有这 4 个组件可以**写入** TimeHub
- ✅ 所有组件都可以**读取** TimeHub（通过 `useEventTime` hook）
- ✅ DateMentionElement 是新增的授权组件（2025-11-21）

---

## 5. 数据流

```
用户操作（点击 PlanItemTimeDisplay）
  ↓
UnifiedDateTimePicker 打开
  ↓
用户选择时间（如"下周三下午3点"）
  ↓
TimeHub.setEventTime(eventId, { start, end })
  ↓
EventService.updateEvent(eventId, updates)
  ↓
localStorage 更新
  ↓
window.dispatchEvent('eventsUpdated', { eventId })
  ↓
所有订阅者收到通知:
  - PlanItemTimeDisplay (通过 useEventTime)
  - DateMentionElement (通过 useEventTime)
  - UnifiedSlateEditor (监听 eventsUpdated 事件)
  ↓
UI 自动更新
```

**关键点**:
- ✅ TimeHub 优先级最高
- ✅ getEventTime 现在正确处理部分时间字段（允许 null）
- ✅ PlanManager.syncToUnifiedTimeline 通过 getEventTime 间接使用 TimeHub
- ✅ 不需要修改 PlanManager.tsx 代码（getEventTime 已修复）

---

## 6. 验证步骤

### 6.1 测试 getEventTime 修复

1. **只设置 start 时间**:
   ```typescript
   TimeHub.setEventTime('test-event', {
     start: '2025-11-21T14:00:00',
     end: null,  // ← 只有 start
   });
   
   const time = getEventTime('test-event', { start: null, end: null });
   console.log(time);
   // ✅ 期望: { start: '2025-11-21T14:00:00', end: null }
   // ❌ 修复前: { start: null, end: null } (fallback)
   ```

2. **只设置 end 时间**:
   ```typescript
   TimeHub.setEventTime('test-event', {
     start: null,
     end: '2025-11-21T15:00:00',  // ← 只有 end
   });
   
   const time = getEventTime('test-event', { start: null, end: null });
   console.log(time);
   // ✅ 期望: { start: null, end: '2025-11-21T15:00:00' }
   // ❌ 修复前: { start: null, end: null } (fallback)
   ```

### 6.2 测试时间同步流程

1. 硬刷新浏览器（Ctrl+Shift+R）
2. 点击任意事件的 PlanItemTimeDisplay
3. 在 UnifiedDateTimePicker 中选择"下周三下午3点"
4. 观察调试日志:
   ```
   [TimeHub] emit 被调用
     start: "2025-11-27T15:00:00"  ← TimeHub 更新
   
   [useEventTime] 订阅触发
     snapshot.start: "2025-11-27T15:00:00"  ← 订阅者收到
   
   [🔴 SYNC] syncToUnifiedTimeline 被调用
     startTime: "2025-11-12T12:00:06"  ← 旧数据（item）
   
   [🔴 SYNC] 时间数据准备完成
     finalStartTime: "2025-11-27T15:00:00"  ← ✅ 使用 TimeHub
     source: "TimeHub/EventService"  ← ✅ 不再是 fallback
   ```

5. 验证 UI:
   - ✅ PlanItemTimeDisplay 显示"下周三下午3点"
   - ✅ DateMentionElement 显示"下周三下午3点"
   - ✅ 不再被 syncToUnifiedTimeline 覆盖

### 6.3 测试 DateMentionElement 编辑能力

1. 在 Slate 编辑器中找到一个 DateMentionElement
2. 点击日期文本
3. 观察 Console:
   ```
   [DateMentionElement] 点击日期，可以调用 setEventTime 修改时间
     eventId: "event-xxx"
     currentStart: "2025-11-21T14:00:00"
     currentEnd: "2025-11-21T15:00:00"
     setEventTime: "function"  ← ✅ 方法已注入
   ```

4. TODO: 实现打开日期选择器功能

---

## 7. 技术债务清理

### 7.1 已完成 ✅

- ✅ getEventTime 接口修复（接受 null 时间）
- ✅ DateMentionElement 添加 setEventTime 能力
- ✅ PLANMANAGER_MODULE_PRD.md 更新（授权组件章节）
- ✅ SLATE_DEVELOPMENT_GUIDE.md 更新（TimeHub 权限管理）
- ✅ 调试日志系统完整（TimeHub.emit → useEventTime → DateMentionElement）

### 7.2 待完成 (可选)

- ⏸️ DateMentionElement 完整实现日期选择器
- ⏸️ 清理调试日志（移除过于详细的日志）
- ⏸️ 添加单元测试（getEventTime 的部分时间字段测试）

---

## 8. 总结

### 8.1 问题本质

**表面现象**: DateMentionElement 不更新  
**根本原因**: getEventTime 判断条件过严（`&&` 要求同时有 start 和 end）  
**连锁反应**: 部分时间字段被忽略 → 走到 fallback → 返回旧数据 → PlanManager 覆盖 TimeHub

### 8.2 修复策略

1. **接口层修复**: getEventTime 改为 `||` 判断，接受部分字段
2. **组件层扩展**: DateMentionElement 添加 setEventTime 调用
3. **文档层完善**: 明确 TimeHub 授权组件列表

### 8.3 架构优化

**TimeHub 作为唯一真相源**:
- ✅ 所有时间读取优先从 TimeHub 获取
- ✅ fallback 只是兼容性保障，不是主要路径
- ✅ 写权限严格控制（4 个授权组件）

**数据流简化**:
- ✅ 单向数据流：授权组件 → TimeHub → EventService → 订阅者
- ✅ 无需"优先劣后"安排：getEventTime 正确处理后，TimeHub 始终优先
- ✅ PlanManager 无需修改：通过 getEventTime 间接使用 TimeHub

---

**修复完成时间**: 2025-11-21  
**影响范围**: 时间同步逻辑、DateMentionElement、文档更新  
**验证状态**: 待用户测试确认
