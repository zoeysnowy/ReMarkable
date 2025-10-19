# Bug Fix: Time Selection Creates Events

## 🐛 问题描述

**症状**：
- 在日历视图中，点击并拖动选择空白时间段
- 时间段保持选中状态（灰色高亮）
- 没有弹出编辑窗口
- 无法取消选中
- 必须刷新页面才能恢复

**用户影响**：
- 无法通过点击日历创建新事件
- 只能通过其他方式创建事件
- 用户体验不符合标准日历应用

---

## 🔍 根本原因

### 1. 缺少 `onSelectDateTime` 处理器
- TUI Calendar 的 `selectDateTime` 事件没有被处理
- 用户选择时间后，没有任何响应
- 选择状态保持，但无操作可执行

### 2. `handleBeforeCreateEvent` 行为不正确
- 之前的实现直接创建事件（不通过模态框）
- 这绕过了用户填写详情的步骤
- 创建的事件缺少必要信息（标题、日历等）

### 3. 事件名转换错误
```typescript
// ❌ 错误：全部转小写
eventName.replace('on', '').toLowerCase()
// onSelectDateTime -> SelectDateTime -> selectdatetime (错误!)

// ✅ 正确：保持驼峰
eventName.replace('on', '')
eventName.charAt(0).toLowerCase() + eventName.slice(1)
// onSelectDateTime -> SelectDateTime -> selectDateTime (正确!)
```

---

## ✅ 解决方案

### 修改 1: `TimeCalendar.tsx` - 添加 `handleSelectDateTime`

```typescript
/**
 * 📅 选择日期时间 - 打开创建事件模态框
 */
const handleSelectDateTime = useCallback((selectionInfo: any) => {
  console.log('📅 [TimeCalendar] Time selection:', selectionInfo);
  
  const { start, end, isAllday } = selectionInfo;
  
  // 创建新事件对象（不保存，仅用于编辑）
  const newEvent: Event = {
    id: `local-${Date.now()}`,
    title: '',
    startTime: start.toISOString(),
    endTime: end.toISOString(),
    location: '',
    description: '',
    tags: [],
    tagId: '',
    calendarId: '', // 用户需要在模态框中选择
    isAllDay: isAllday || false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    syncStatus: 'pending'
  };
  
  // 打开编辑模态框
  setEditingEvent(newEvent);
  setShowEventEditModal(true);
}, []);
```

**效果**：
- 用户选择时间后立即打开 EventEditModal
- 模态框预填充开始/结束时间
- 用户可以填写标题、选择日历、添加标签等

### 修改 2: `TimeCalendar.tsx` - 修改 `handleBeforeCreateEvent`

```typescript
/**
 * ✨ 创建事件 - 阻止 TUI Calendar 默认行为
 * 我们使用 onSelectDateTime 和模态框来创建事件
 */
const handleBeforeCreateEvent = useCallback((eventData: any) => {
  console.log('⚠️ [TimeCalendar] beforeCreateEvent blocked (use modal instead):', eventData);
  // 返回 false 阻止默认的事件创建
  return false;
}, []);
```

**效果**：
- 阻止 TUI Calendar 的默认创建行为
- 所有事件创建都通过模态框完成
- 确保数据完整性和用户体验一致性

### 修改 3: `TimeCalendar.tsx` - 添加属性绑定

```typescript
<ToastUIReactCalendar
  ref={calendarRef}
  height="100%"
  view={currentView}
  events={calendarEvents}
  calendars={getCalendars()}
  onClickEvent={handleClickEvent}
  onSelectDateTime={handleSelectDateTime}  // ✅ 新增
  onBeforeCreateEvent={handleBeforeCreateEvent}
  onBeforeUpdateEvent={handleBeforeUpdateEvent}
  onBeforeDeleteEvent={handleBeforeDeleteEvent}
  // ...
/>
```

### 修改 4: `ToastUIReactCalendar.tsx` - 修复事件名转换

```typescript
bindEventHandlers = () => {
  const { props } = this;
  
  // 绑定其他事件
  reactCalendarEventNames.forEach((eventName) => {
    const eventHandler = props[eventName];
    if (eventHandler && this.calendarInstance && eventName !== 'onClickEvent') {
      // ✅ 转换事件名：onSelectDateTime -> selectDateTime (保持驼峰)
      let calendarEventName = eventName.replace('on', '');
      calendarEventName = calendarEventName.charAt(0).toLowerCase() + calendarEventName.slice(1);
      
      this.calendarInstance.on(calendarEventName as any, eventHandler);
    }
  });
};
```

**效果**：
- 正确绑定所有 TUI Calendar 事件
- 事件名格式符合 TUI Calendar 的驼峰命名规范

---

## 🧪 测试步骤

### 1. 基本时间选择
1. 打开应用，进入日历视图
2. 在空白时间段点击并拖动
3. **预期**：EventEditModal 立即弹出
4. **验证**：开始时间和结束时间已预填充

### 2. 填写并创建事件
1. 在模态框中输入标题：`测试事件`
2. 选择日历（必填）
3. 可选：添加标签、位置、描述
4. 点击"保存"
5. **预期**：事件显示在日历上
6. **验证**：时间正确，可以点击编辑

### 3. 取消创建
1. 选择时间段打开模态框
2. 不填写任何信息
3. 点击模态框外部或关闭按钮
4. **预期**：模态框关闭，无事件创建
5. **验证**：日历干净，无多余事件

### 4. 全天事件
1. 在月视图的日期格子上点击
2. **预期**：模态框打开，`isAllDay` 为 true
3. 保存后验证：事件显示为全天事件条

---

## 📊 影响范围

### 修改的文件
- ✅ `src/components/TimeCalendar.tsx` (2 处修改)
  - 新增 `handleSelectDateTime`
  - 修改 `handleBeforeCreateEvent`
  - 添加 `onSelectDateTime` 属性
  
- ✅ `src/components/ToastUIReactCalendar.tsx` (1 处修改)
  - 修复 `bindEventHandlers` 事件名转换

- ✅ `test-time-selection.js` (新增)
  - 测试指南和调试命令

### 代码统计
- **3 files changed**
- **+93 insertions**
- **-37 deletions**

---

## 🎯 预期效果

### 用户体验改进
- ✅ 符合标准日历应用的交互模式
- ✅ 时间选择流畅，无卡顿
- ✅ 可以取消选择（点击外部）
- ✅ 事件信息完整（通过模态框填写）

### 技术改进
- ✅ 事件绑定正确（驼峰命名）
- ✅ 数据流清晰（选择 → 模态框 → 保存）
- ✅ 可扩展性好（模态框集中处理）

---

## 🔄 Git 提交信息

```bash
git commit -m "fix: Enable time selection to create events via modal

Problem:
- Clicking/dragging on empty time slot caused UI freeze
- No modal appeared to create event
- Selection could not be canceled

Solution:
- Added handleSelectDateTime to open EventEditModal with pre-filled time
- Modified handleBeforeCreateEvent to return false (block default creation)
- Fixed event name conversion in bindEventHandlers (selectDateTime not selectdatetime)

Impact:
- Users can now select time ranges to create events
- EventEditModal pre-fills start/end time from selection
- Consistent with expected calendar UX pattern

Testing:
- Run test-time-selection.js for verification steps"
```

**Commit Hash**: `d23406e`

---

## 📝 待推送

修复已提交到本地 master 分支，等待推送到 GitHub：

```bash
# 当网络恢复时执行
git push origin master
```

---

## 🚀 下一步

修复完成后，建议：

1. **手动测试**：验证所有场景
2. **用户反馈**：收集实际使用体验
3. **性能监控**：确保无性能问题
4. **文档更新**：更新用户指南

---

**修复完成时间**: 2025-10-20  
**修复版本**: v1.1.1 (待发布)  
**优先级**: High (影响核心功能)
