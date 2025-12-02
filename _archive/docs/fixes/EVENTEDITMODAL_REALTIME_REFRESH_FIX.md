# EventEditModal 实时刷新修复文档

> **修复日期**: 2025-11-28  
> **版本**: v2.15  
> **问题类型**: 数据刷新 + 架构理解  
> **影响模块**: EventEditModalV2, EventService, Timer  
> **关联文档**: 
> - [EventEditModal v2 PRD](../PRD/EVENTEDITMODAL_V2_PRD.md)
> - [Timer Module PRD](../PRD/TIMER_MODULE_PRD.md)
> - [EventHub Architecture](../architecture/EVENTHUB_ARCHITECTURE.md)

---

## 问题描述

### 用户现象

当用户在 EventEditModal 打开状态下停止计时时，Modal 的"实际进展"区域没有立即显示新的 timerLog，需要关闭 Modal 再打开才能看到更新。

### 问题场景

```typescript
// 操作步骤
1. 打开一个事件的 EditModal（例如 `local-1764259194994`）
2. 点击"开始专注"按钮
3. 等待几秒
4. 点击"停止"按钮
5. ❌ 实际进展区域没有显示新的 timerLog
6. 关闭 Modal 再打开 → ✅ 此时才能看到新的 timerLog
```

### 期望行为

停止计时后，EventEditModal 应该**立即显示**新的 timerLog，无需关闭再打开。

---

## 根本原因分析

### 问题 1: EventService 的防循环机制

EventService 采用 **EventHub 架构**，通过 BroadcastChannel 实现跨标签页同步。为了避免循环更新，EventService 会**忽略同标签页内自己的广播消息**：

```typescript
// EventService.ts - 防循环机制
broadcastChannel.onmessage = (event) => {
  const { senderId, eventId, type } = event.data;
  
  if (senderId === tabId) {
    // ✅ 忽略自己的广播消息（防止循环）
    eventLogger.log('🔄 [EventService] 忽略自己的广播消息');
    return; // ❌ 这里直接返回，不触发 eventsUpdated 事件
  }
  
  // 处理其他标签页的更新
  window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { eventId } }));
};
```

**重要澄清**: EventService 的 `updateEvent` 方法会同时做两件事：
1. **同标签页**: 直接触发 `window.dispatchEvent('eventsUpdated')`（不经过 BroadcastChannel）
2. **跨标签页**: 通过 `BroadcastChannel.postMessage` 广播（会被同标签页忽略）

```typescript
// EventService.ts - dispatchEventUpdate 方法
private static dispatchEventUpdate(eventId: string, detail: any) {
  // 1. 触发当前标签页的事件（✅ 同标签页能收到）
  window.dispatchEvent(new CustomEvent('eventsUpdated', {
    detail: { eventId, ...detail }
  }));
  
  // 2. 广播到其他标签页（❌ 同标签页会忽略）
  if (broadcastChannel) {
    broadcastChannel.postMessage({
      type: 'eventsUpdated',
      senderId: tabId,
      eventId,
      ...detail
    });
  }
}
```

### 问题 2: EventEditModalV2 依赖过时的 prop

EventEditModalV2 的 `childEvents` useMemo 原本依赖 `event.timerLogs` prop：

```typescript
// ❌ 修复前的代码（有问题）
const childEvents = React.useMemo(() => {
  // 问题：依赖过时的 event prop
  const timerLogs = event?.timerLogs || [];
  
  return timerLogs
    .map(childId => EventService.getEventById(childId))
    .filter(e => e !== null) as Event[];
}, [event?.id, event?.timerLogs, parentEvent, refreshCounter]);
```

**问题分析**:
1. `event` prop 在 Modal 打开时传递一次，后续不会自动更新
2. 当 App.tsx 更新父事件的 `timerLogs` 后，`event.timerLogs` 仍然是旧值
3. 即使 `refreshCounter` 触发 useMemo 重新执行，读取的还是旧的 `event.timerLogs`

### 问题 3: 架构理解偏差

最初的修复尝试是通过监听 `eventsUpdated` 事件来刷新，但忽略了一个关键问题：
- ✅ EventService 的 `updateEvent` 会直接触发同标签页的 `eventsUpdated` 事件
- ✅ EventEditModalV2 能够接收到这个事件
- ❌ 但是 `childEvents` useMemo 读取的是过时的 `event.timerLogs`，即使触发刷新也没有用

---

## 解决方案

### 核心思路

遵循 **EventHub 架构的 SSOT 原则**：
1. **EventService 是唯一数据源**: 所有数据都存储在 EventService 中
2. **组件主动读取最新数据**: 不依赖过时的 props，主动调用 `EventService.getEventById()` 查询
3. **refreshCounter 作为触发器**: 通过 `eventsUpdated` 事件触发 `refreshCounter` 更新，让 useMemo 重新执行

### 代码修复

```typescript
// ✅ 修复后的代码
const childEvents = React.useMemo(() => {
  // 🔧 关键修复：每次都从 EventService 重新读取最新数据
  // 原因：EventService 的 eventsUpdated 会忽略同标签页的更新（防循环）
  
  if (!event?.id) return [];
  
  // 🆕 从 EventService 重新读取当前事件的最新数据
  const latestEvent = EventService.getEventById(event.id);
  if (!latestEvent) return [];
  
  // 情况 1: 当前是子事件 → 读取父事件的最新 timerLogs
  if (latestEvent.parentEventId) {
    const latestParent = EventService.getEventById(latestEvent.parentEventId);
    if (!latestParent) return [];
    
    const timerLogs = latestParent.timerLogs || [];
    console.log('🔍 [childEvents] 子事件模式 - 读取父事件的最新 timerLogs:', {
      parentId: latestParent.id,
      timerLogsCount: timerLogs.length,
      timerLogs,
      refreshCounter
    });
    
    return timerLogs
      .map(childId => EventService.getEventById(childId))
      .filter(e => e !== null) as Event[];
  }
  
  // 情况 2: 当前是父事件 → 读取自己的最新 timerLogs
  const timerLogs = latestEvent.timerLogs || [];
  console.log('🔍 [childEvents] 父事件模式 - 读取自己的最新 timerLogs:', {
    eventId: latestEvent.id,
    timerLogsCount: timerLogs.length,
    timerLogs,
    refreshCounter
  });
  
  return timerLogs
    .map(childId => EventService.getEventById(childId))
    .filter(e => e !== null) as Event[];
}, [event?.id, refreshCounter]); // ✅ 简化依赖：不再依赖过时的 prop
```

### 事件监听器（保持不变）

```typescript
// 监听同标签页和跨标签页的事件更新
React.useEffect(() => {
  const handleEventsUpdated = (e: any) => {
    const updatedEventId = e.detail?.eventId || e.detail;
    
    // 如果更新的是当前事件或父事件，触发刷新
    if (updatedEventId === event?.id || updatedEventId === event?.parentEventId) {
      console.log('🔄 [EventEditModalV2] 匹配到更新事件，触发刷新:', {
        updatedEventId,
        currentEventId: event?.id,
        parentEventId: event?.parentEventId
      });
      setRefreshCounter(prev => prev + 1);
    }
  };
  
  window.addEventListener('eventsUpdated', handleEventsUpdated);
  
  return () => {
    window.removeEventListener('eventsUpdated', handleEventsUpdated);
  };
}, [event?.id, event?.parentEventId]);
```

---

## 数据流示意图

### 修复前（有问题）

```
App.tsx 停止计时
  ↓
EventService.updateEvent(parentId, { timerLogs: [..., newTimerId] })
  ↓
localStorage 保存成功 ✅
  ↓
dispatchEventUpdate(parentId) → window.dispatchEvent('eventsUpdated') ✅
  ↓
EventEditModalV2 监听到事件 ✅
  ↓
setRefreshCounter(+1) ✅
  ↓
childEvents useMemo 重新执行 ✅
  ↓
读取 event.timerLogs → ❌ 旧值（过时的 prop）
  ↓
渲染旧的 timerLog 列表 ❌
```

### 修复后（正确）

```
App.tsx 停止计时
  ↓
EventService.updateEvent(parentId, { timerLogs: [..., newTimerId] })
  ↓
localStorage 保存成功 ✅
  ↓
dispatchEventUpdate(parentId) → window.dispatchEvent('eventsUpdated') ✅
  ↓
EventEditModalV2 监听到事件 ✅
  ↓
setRefreshCounter(+1) ✅
  ↓
childEvents useMemo 重新执行 ✅
  ↓
EventService.getEventById(parentId) → ✅ 最新数据
  ↓
读取 latestParent.timerLogs → ✅ 最新值
  ↓
渲染新的 timerLog 列表 ✅
```

---

## 架构原则总结

### EventHub 架构的核心原则

1. **单一数据源（SSOT）**
   - EventService 是数据的唯一真实来源
   - localStorage 是持久化存储，EventService 的内存缓存是快速读取

2. **主动读取，不被动等待**
   - ✅ 组件应该主动调用 `EventService.getEventById()` 查询最新数据
   - ❌ 不应该依赖过时的 props 或等待事件通知更新数据

3. **防循环机制**
   - 同标签页：直接触发 `window.dispatchEvent('eventsUpdated')`（不经过 BroadcastChannel）
   - 跨标签页：通过 BroadcastChannel 广播（会被同标签页忽略）

4. **自己负责渲染**
   - 更新数据的模块应该自己负责 UI 刷新
   - 不依赖广播回调来更新 UI

### 实现指南

对于需要实时显示最新数据的组件：

```typescript
// ✅ 正确做法
const latestData = React.useMemo(() => {
  // 1. 主动从 EventService 读取最新数据
  const latestEvent = EventService.getEventById(eventId);
  
  // 2. 处理数据
  return processData(latestEvent);
}, [eventId, refreshCounter]); // 3. 依赖 refreshCounter 作为触发器

// 4. 监听 eventsUpdated 事件，触发 refreshCounter 更新
React.useEffect(() => {
  const handler = (e: any) => {
    if (e.detail?.eventId === eventId) {
      setRefreshCounter(prev => prev + 1);
    }
  };
  
  window.addEventListener('eventsUpdated', handler);
  return () => window.removeEventListener('eventsUpdated', handler);
}, [eventId]);
```

```typescript
// ❌ 错误做法
const data = React.useMemo(() => {
  // 依赖过时的 prop
  return processData(eventProp);
}, [eventProp, refreshCounter]);
```

---

## 测试验证

### 测试步骤

1. 刷新页面
2. 打开一个事件的 EditModal（例如 `local-1764259194994`）
3. 点击"开始专注"按钮
4. 等待几秒
5. 点击"停止"按钮
6. **验证**: EditModal 的实际进展区域应该**立即显示**新的 timerLog，无需关闭再打开

### 日志验证

查看控制台日志，应该看到以下输出：

```
✅ [Timer Stop] 验证父事件 timerLogs: { timerLogs: ['timer-xxx'], expectedCount: 1, actualCount: 1 }
🔄 [EventEditModalV2] 匹配到更新事件，触发刷新: { updatedEventId: 'local-xxx', currentEventId: 'local-xxx' }
🔍 [childEvents] 父事件模式 - 读取自己的最新 timerLogs: { eventId: 'local-xxx', timerLogsCount: 1, timerLogs: ['timer-xxx'], refreshCounter: 2 }
```

---

## 相关文件

### 修改的文件

- `src/components/EventEditModal/EventEditModalV2.tsx` (L401-468)
  - 修复 `childEvents` useMemo 的数据读取逻辑
  - 简化依赖，从 EventService 主动读取最新数据

### 未修改但相关的文件

- `src/services/EventService.ts` (L1135-1160)
  - `dispatchEventUpdate` 方法（防循环机制的实现）
  
- `src/App.tsx` (L810-850)
  - Timer 停止时更新父事件 timerLogs 的逻辑
  - 数据更新成功，只是 EventEditModalV2 未能及时刷新

---

## 经验总结

### 问题根源

1. **架构理解不足**: 最初以为 EventService 会忽略同标签页的所有更新，实际上只忽略 BroadcastChannel 的消息
2. **依赖过时的 props**: 组件依赖 Modal 打开时传递的 `event` prop，后续不会更新
3. **被动等待更新**: 期望通过事件通知来更新数据，而不是主动查询

### 正确理解

1. **EventService 的 updateEvent 会直接触发同标签页的 eventsUpdated 事件**
2. **EventEditModalV2 能够接收到这个事件**
3. **关键是读取最新数据**: 不能依赖过时的 props，必须主动调用 `EventService.getEventById()`

### 架构设计启示

1. **SSOT 原则**: 单一数据源是架构的基石
2. **主动读取**: 组件应该主动查询最新数据，而不是被动等待
3. **refreshCounter 模式**: 使用计数器作为触发器，强制 useMemo 重新执行
4. **防循环机制**: EventHub 的防循环设计是正确的，不应该绕过

---

## 版本历史

| 版本 | 日期 | 修改内容 |
|------|------|---------|
| v2.15 | 2025-11-28 | 修复 EventEditModalV2 实时刷新问题，遵循 EventHub 架构 |
| v2.14 | 2025-11-27 | 实现标签自动映射日历功能 |
| v2.13 | 2025-11-26 | 实现未保存事件计时功能 |
