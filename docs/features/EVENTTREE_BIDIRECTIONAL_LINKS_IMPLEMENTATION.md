# EventTree 双向链接功能实现

> **版本**: v2.17.0  
> **日期**: 2025-12-02  
> **状态**: ✅ 数据层完成，UI 层待开发

---

## 📊 功能概述

实现了 EventTree 的双向链接（Bidirectional Links）功能，支持事件之间的柔性关联，区别于刚性的父子层级关系。

### 核心设计理念："Vessels as Stacks"

- **刚性骨架（Hierarchy Bone）**: 父子关系占据画布空间，用 line + link 标记显示
- **柔性血管（Bidirectional Links）**: 双向链接不占画布空间，堆叠在主节点背后，Hover 展开

---

## 🎯 数据结构

### 新增字段（`src/types.ts`）

```typescript
export interface Event {
  // ... 现有字段 ...
  
  // 🆕 Issue #13: 双向链接（柔性血管）
  linkedEventIds?: string[];   // 用户主动创建的链接（通过 @mention）
  backlinks?: string[];        // 自动计算的反向链接（哪些事件链接了我）
}
```

### 字段说明

| 字段 | 类型 | 用途 | 维护方式 |
|------|------|------|----------|
| `linkedEventIds` | `string[]?` | 正向链接（我链接的事件） | 手动创建（通过 @mention） |
| `backlinks` | `string[]?` | 反向链接（链接我的事件） | 自动计算（每次保存时更新） |

---

## 🔧 API 方法（`src/services/EventService.ts`）

### 1. `addLink(fromEventId, toEventId)`

添加双向链接。

**示例**:
```typescript
// 在事件 A 的 EventLog 中输入 "@Project Ace"
await EventService.addLink(eventA.id, projectAce.id);

// 结果：
// eventA.linkedEventIds = ['project-ace-id']
// projectAce.backlinks = ['event-a-id']
```

**返回值**:
```typescript
{ success: boolean; error?: string }
```

**错误处理**:
- ❌ 源事件不存在
- ❌ 目标事件不存在
- ❌ 不能链接自己

---

### 2. `removeLink(fromEventId, toEventId)`

移除双向链接。

**示例**:
```typescript
await EventService.removeLink(eventA.id, projectAce.id);
```

---

### 3. `rebuildBacklinks(eventId)`

重建单个事件的反向链接。

**使用场景**:
- 每次 `addLink` / `removeLink` 后自动调用
- 手动修复数据不一致时

**逻辑**:
```typescript
// 遍历所有事件，找出哪些事件链接了当前事件
allEvents.forEach(event => {
  if (event.linkedEventIds?.includes(targetEventId)) {
    backlinks.push(event.id);
  }
});
```

---

### 4. `rebuildAllBacklinks()`

批量重建所有事件的反向链接。

**使用场景**:
- 数据迁移
- 修复数据不一致

**返回值**:
```typescript
{ success: boolean; rebuiltCount: number; error?: string }
```

---

### 5. `getLinkedEvents(eventId)`

获取事件的所有链接事件（正向 + 反向）。

**返回值**:
```typescript
{
  outgoing: Event[];  // 正向链接（我链接的事件）
  incoming: Event[];  // 反向链接（链接我的事件）
}
```

**使用场景**:
- 在 EventTree 中显示堆叠卡片
- 图谱视图

---

### 6. `hasLink(fromEventId, toEventId)`

检查两个事件之间是否存在链接。

**返回值**: `boolean`

---

### 7. `shouldShowInEventTree(event)`

判断事件是否应该显示在 EventTree 中。

**排除规则**:
- ❌ `isTimer = true` (Timer 子事件)
- ❌ `isOutsideApp = true` (外部应用数据)
- ❌ `isTimeLog = true` (纯系统时间日志)

**允许规则**:
- ✅ Task 事件
- ✅ 文档事件
- ✅ Plan 事件
- ✅ TimeCalendar 事件

---

## 📝 PRD 更新

### 更新内容

1. **字段架构说明**（Section 5.1）:
   - 刚性骨架：`parentEventId` / `childEventIds`
   - 柔性血管：`linkedEventIds` / `backlinks`
   - 弃用旧字段：`parentTaskId` / `childTaskCount` / `childTaskCompletedCount`

2. **双向链接 UI 设计**（Section 5.2）:
   - 堆叠卡片设计（Vessels as Stacks）
   - Framer Motion 动画
   - 收纳态 vs 展开态

3. **EventTree 入口**（Section 5.3）:
   - 入口 1：EventEditModal 关联区域（向下展开 + Pin 按钮）
   - 入口 2：ContentPanel 侧边栏（事项 Tab / 收藏 Tab）

4. **数据字段更新**（Section 8）:
   - 废弃 `parentTaskId`、`childTaskCount`、`childTaskCompletedCount`
   - 新增 `linkedEventIds`、`backlinks` 说明
   - 添加字段注释和示例

---

## 🧪 测试覆盖

测试文件：`src/services/__tests__/EventService.bidirectionalLinks.test.ts`

### 测试场景

1. ✅ 添加链接（正常情况）
2. ✅ 添加链接（阻止自己链接自己）
3. ✅ 添加链接（阻止链接不存在的事件）
4. ✅ 支持多个链接
5. ✅ 移除链接
6. ✅ 获取正向和反向链接
7. ✅ 检测链接是否存在
8. ✅ 过滤系统事件

---

## 🎨 UI 实现（待开发）

### Phase 1: 数据层（✅ 已完成）
- ✅ `Event` 接口添加 `linkedEventIds` / `backlinks` 字段
- ✅ `EventService` 实现链接管理方法
- ✅ 编写单元测试

### Phase 2: UI 组件（待开发）
- ⏳ `CustomEventNode` 组件（React Flow 节点）
- ⏳ `LinkedCard` 组件（堆叠卡片）
- ⏳ Framer Motion 动画集成

### Phase 3: EventTree 集成（待开发）
- ⏳ EventEditModal 关联区域
- ⏳ ContentPanel 侧边栏（事项 / 收藏 Tab）
- ⏳ UnifiedMention 集成（自动创建链接）

---

## 🔗 创建链接的方式

### 方式 1：通过 @mention（推荐）

用户在 EventLog 中输入 `@事件名称`，UnifiedMention 组件自动调用 `EventService.addLink()`。

**实现逻辑**（待开发）:
```typescript
// UnifiedMention.tsx
const handleSelectEvent = async (selectedEvent: Event) => {
  // 插入 @mention 节点到 Slate 编辑器
  insertEventMention(selectedEvent);
  
  // 创建双向链接
  await EventService.addLink(currentEvent.id, selectedEvent.id);
};
```

### 方式 2：手动调用 API（调试）

```typescript
await EventService.addLink('event-a-id', 'event-b-id');
```

---

## 📌 注意事项

1. **性能优化**:
   - `rebuildBacklinks()` 需要遍历所有事件，大数据量时可能较慢
   - 考虑在后台线程执行，或使用 Web Worker

2. **数据一致性**:
   - 删除事件时，需要同时清理相关的 `linkedEventIds` 和 `backlinks`
   - 建议在 `EventService.deleteEvent()` 中添加清理逻辑

3. **循环引用**:
   - 双向链接不会导致循环引用问题（不是父子关系）
   - 但需要在 UI 层做好防护（避免无限递归渲染）

4. **语义扩展**（未来）:
   - 目前不区分链接类型（依赖、参考、相关等）
   - 未来可以添加 `linkType` 字段，由 AI 自动推断

---

## 🚀 下一步开发

1. **UnifiedMention 集成**（1 天）:
   - 在 EventLog 中输入 `@` 触发事件搜索
   - 选择事件后自动创建双向链接

2. **EventTree 组件**（2-3 天）:
   - 实现堆叠卡片动画
   - 集成 React Flow
   - 过滤系统事件

3. **ContentPanel 侧边栏**（1-2 天）:
   - 事项 Tab：显示最近活跃的 EventTree
   - 收藏 Tab：显示用户 Pin 的 EventTree

---

## 📚 相关文档

- [EventEditModal V2 PRD](../PRD/EVENTEDITMODAL_V2_PRD.md) - Section 5.1-5.4
- [EventTree Stacking Card Interaction](../features/EventTree_ Stacking Card Interaction.html) - UI 原型
- [Event Interface](../../src/types.ts) - 数据结构定义
- [EventService](../../src/services/EventService.ts) - API 实现

---

## 💬 反馈

如有问题或建议，请联系开发团队。
