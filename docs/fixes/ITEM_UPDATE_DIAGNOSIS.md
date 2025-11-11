# Item 更新问题系统性排查

**日期**: 2025-11-21  
**问题**: 从 PlanItemTimeDisplay 调用 UnifiedDateTimePicker 修改时间后，UI 没有更新

---

## 1. 数据流架构

### 完整数据流

```
用户操作
  ↓
PlanItemTimeDisplay 点击时间 → 打开 UnifiedDateTimePicker
  ↓
UnifiedDateTimePicker 选择时间
  ↓
TimeHub.setEventTime(eventId, { start, end })
  ↓
EventService.updateEvent(eventId, updates)
  ↓
localStorage 更新
  ↓
EventService.dispatchEventUpdate(eventId, { event: updatedEvent })
  ↓
window.dispatchEvent('eventsUpdated', { detail: { eventId, event: updatedEvent } })
  ↓
App.tsx - handleEventUpdated 监听器
  ↓
setAllEvents(prev => prev.map(e => e.id === eventId ? updatedEvent : e))
  ↓
[关键步骤] App.tsx re-render
  ↓
重新计算 filteredPlanItems = allEvents.filter(...)
  ↓
PlanManager 收到新的 items props
  ↓
PlanItemTimeDisplay re-render
  ↓
useEventTime(item.id) 订阅 TimeHub
  ↓
const startTime = eventTime.start ? new Date(eventTime.start) : (item.startTime ? new Date(item.startTime) : null)
  ↓
显示更新后的时间
```

---

## 2. 关键检查点

### 检查点 1: EventService 是否正确更新？

**文件**: `src/services/EventService.ts` L236-300

**关键代码**:
```typescript
static async updateEvent(eventId, updates, skipSync = false) {
  // 更新 localStorage
  existingEvents[eventIndex] = updatedEvent;
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
  
  // 触发事件
  this.dispatchEventUpdate(eventId, { 
    isUpdate: true, 
    tags: updatedEvent.tags, 
    event: updatedEvent  // ← 携带完整事件数据
  });
}
```

**验证方法**:
- 查看日志: `💾 [EventService] Event updated in localStorage`
- 查看日志: `🔔 [EventService] Dispatched eventsUpdated event: {eventId}`

✅ **状态**: 已确认正常（从用户日志看到 "Event updated via EventService"）

---

### 检查点 2: App.tsx 是否监听到 eventsUpdated？

**文件**: `src/App.tsx` L255-285

**关键代码**:
```typescript
useEffect(() => {
  const handleEventUpdated = (e: CustomEvent) => {
    const { eventId, isDeleted, isNewEvent } = e.detail || {};
    
    if (!isDeleted && !isNewEvent) {
      // 增量更新
      const updatedEvent = EventService.getEventById(eventId);
      if (updatedEvent) {
        setAllEvents(prev => {
          const newEvents = prev.map(event => 
            event.id === eventId ? updatedEvent : event
          );
          console.log('[🔍 DEBUG] App.tsx - Event updated in allEvents', {
            eventId,
            oldEvent: prev.find(e => e.id === eventId),
            updatedEvent,
            oldStartTime: prev.find(e => e.id === eventId)?.startTime,
            newStartTime: updatedEvent.startTime,
          });
          return newEvents;
        });
      }
    }
  };
  
  window.addEventListener('eventsUpdated', handleEventUpdated);
}, []);
```

**验证方法**:
- 查看日志: `[🔍 DEBUG] App.tsx - Event updated in allEvents`
- 检查 `oldStartTime` vs `newStartTime` 是否不同

**预期结果**: 应该看到时间从旧值更新到新值

---

### 检查点 3: App.tsx 是否重新计算 filteredPlanItems？

**文件**: `src/App.tsx` L1595-1620

**关键代码**:
```typescript
case 'plan':
  const filteredPlanItems = allEvents.filter((event: Event) => {
    if (!event.isPlan) return false;
    if (event.parentEventId) return false;
    // ...
    return true;
  });
  
  console.log('[🔍 DEBUG] App.tsx - Rendering plan page', {
    allEventsCount: allEvents.length,
    filteredPlanItemsCount: filteredPlanItems.length,
    filteredItems: filteredPlanItems.map(item => ({
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  });
  
  content = (
    <PlanManager items={filteredPlanItems} ... />
  );
```

**验证方法**:
- 查看日志: `[🔍 DEBUG] App.tsx - Rendering plan page`
- 检查 `filteredItems` 中对应事件的 `startTime` 是否已更新

**关键问题**: 如果这里的时间没更新，说明 `allEvents` 状态更新失败！

---

### 检查点 4: PlanManager 是否收到新的 items props？

**文件**: `src/components/PlanManager.tsx` L427-437

**关键代码**:
```typescript
// 🔍 监听 items 变化
useEffect(() => {
  console.log('[🔍 DEBUG] PlanManager - items props changed', {
    itemsCount: items.length,
    items: items.map(item => ({
      id: item.id,
      title: item.title,
      startTime: item.startTime,
      endTime: item.endTime,
    })),
  });
}, [items]);
```

**验证方法**:
- 查看日志: `[🔍 DEBUG] PlanManager - items props changed`
- 检查对应事件的 `startTime` 是否已更新

**关键问题**: 如果这里的时间没更新，说明 App.tsx → PlanManager 的 props 传递有问题！

---

### 检查点 5: PlanItemTimeDisplay 是否使用了新的 item？

**文件**: `src/components/PlanManager.tsx` L48-90

**关键代码**:
```typescript
const PlanItemTimeDisplay = React.memo<{
  item: Event;
  onEditClick: (anchor: HTMLElement) => void;
}>(({ item, onEditClick }) => {
  const eventTime = useEventTime(item.id);
  
  // 优先使用 TimeHub 快照，fallback 到 item 本地数据
  const startTime = eventTime.start 
    ? new Date(eventTime.start) 
    : (item.startTime ? new Date(item.startTime) : null);
  
  const endTime = eventTime.end 
    ? new Date(eventTime.end) 
    : (item.endTime ? new Date(item.endTime) : null);
  
  useEffect(() => {
    dbg('ui', '🖼️ PlanItemTimeDisplay 快照更新', {
      itemId: item.id,
      TimeHub快照start: eventTime.start,
      TimeHub快照end: eventTime.end,
      item本地startTime: item.startTime,
      item本地endTime: item.endTime,
      最终渲染的start: startTime,
      最终渲染的end: endTime,
    });
  }, [item.id, eventTime.start, eventTime.end, item.startTime, item.endTime]);
});
```

**验证方法**:
- 查看日志: `🖼️ PlanItemTimeDisplay 快照更新`
- 检查以下情况：
  1. **情况A**: `TimeHub快照start` 已更新，`item本地startTime` 还是旧值
     - 说明: TimeHub 更新了，但 item props 没更新
     - 结论: **检查点4 失败**（PlanManager 没收到新的 items）
  
  2. **情况B**: `TimeHub快照start` 和 `item本地startTime` 都已更新
     - 说明: 两边都更新了
     - 结论: 应该能正常显示
  
  3. **情况C**: `TimeHub快照start` 和 `item本地startTime` 都没更新
     - 说明: 整个更新链路都失败了
     - 结论: **检查点1或2 失败**

---

### 检查点 6: useEventTime 是否订阅到 TimeHub 更新？

**文件**: `src/hooks/useEventTime.ts` L13-48

**关键代码**:
```typescript
export function useEventTime(eventId: string | undefined): UseEventTimeResult {
  const subscribe = useCallback((onChange: () => void) => {
    if (!eventId) return () => {};
    console.log(`%c[🎣 useEventTime.subscribe]`, 'background: #00BCD4; color: white; padding: 2px 6px;', { 
      eventId,
      订阅时间: new Date().toLocaleTimeString()
    });
    
    const unsubscribe = TimeHub.subscribe(eventId, () => {
      console.log(`%c[🔄 useEventTime 收到通知]`, 'background: #00ACC1; color: white; padding: 2px 6px;', { 
        eventId,
        通知时间: new Date().toLocaleTimeString()
      });
      onChange();
    });
    
    return unsubscribe;
  }, [eventId]);

  const getSnapshot = useCallback(() => {
    if (!eventId) return EMPTY_SNAPSHOT as TimeGetResult;
    const snapshot = TimeHub.getSnapshot(eventId);
    console.log(`%c[📸 useEventTime.getSnapshot]`, 'background: #0097A7; color: white; padding: 2px 6px;', { 
      eventId,
      snapshot,
      获取时间: new Date().toLocaleTimeString()
    });
    return snapshot;
  }, [eventId]);
}
```

**验证方法**:
- 查看日志序列:
  1. `[🎣 useEventTime.subscribe]` - 组件订阅 TimeHub
  2. `[🔔 TimeHub.emit]` - TimeHub 通知订阅者
  3. `[📞 调用订阅者]` - 调用订阅回调
  4. `[🔄 useEventTime 收到通知]` - useEventTime 收到通知
  5. `[📸 useEventTime.getSnapshot]` - 读取新快照

**关键问题**: 如果没有看到完整序列，说明 TimeHub 的订阅机制有问题！

---

## 3. 可能的问题原因

### 原因 1: React.memo 阻止了 PlanItemTimeDisplay 重新渲染

**症状**: 
- `items` props 已更新（检查点4 通过）
- 但 `PlanItemTimeDisplay` 没有 re-render

**原因**: `React.memo` 使用浅比较，如果 `item` 对象引用没变，组件不会重新渲染

**验证**:
```typescript
// 在 App.tsx 中检查
setAllEvents(prev => {
  const newEvents = prev.map(event => 
    event.id === eventId ? updatedEvent : event  // ← 创建新对象引用
  );
  console.log('对象引用是否改变?', prev.find(e => e.id === eventId) !== updatedEvent);
  return newEvents;
});
```

**解决方案**: 确保 `updatedEvent` 是新对象（不是从 prev 复用）

---

### 原因 2: TimeHub 缓存没有更新

**症状**:
- `item.startTime` 已更新
- 但 `eventTime.start` (TimeHub 快照) 还是旧值

**原因**: TimeHub 的缓存更新逻辑有问题

**验证**: 查看 `TimeHub.setEventTime` 的日志
```typescript
// TimeHub.ts L220-230
this.cache.set(eventId, snapshot);
dbg('timehub', '✅ 持久化成功，缓存已更新', { 
  eventId, 
  快照start: snapshot.start, 
  快照end: snapshot.end,
});
```

**解决方案**: 检查 `TimeHub.cache` 是否被正确更新

---

### 原因 3: EventService.getEventById 返回了旧数据

**症状**:
- EventService 更新了 localStorage
- 但 `getEventById` 返回的还是旧数据

**原因**: EventService 可能有缓存层

**验证**: 在 `App.tsx` 的 `handleEventUpdated` 中检查
```typescript
const updatedEvent = EventService.getEventById(eventId);
console.log('从 EventService 读取的事件', {
  eventId,
  startTime: updatedEvent.startTime,
  localStorage中的数据: JSON.parse(localStorage.getItem('remarkable_events') || '[]')
    .find(e => e.id === eventId)
});
```

**解决方案**: 确保 EventService 没有过期的内存缓存

---

### 原因 4: allEvents 状态更新被批处理延迟

**症状**:
- `handleEventUpdated` 被调用
- `setAllEvents` 被调用
- 但组件没有立即 re-render

**原因**: React 18 的自动批处理（Automatic Batching）

**验证**: 使用 `flushSync` 强制同步更新
```typescript
import { flushSync } from 'react-dom';

flushSync(() => {
  setAllEvents(prev => ...);
});
```

**解决方案**: 如果需要立即更新，使用 `flushSync`

---

## 4. 诊断步骤

### 步骤 1: 刷新浏览器，清除缓存

```bash
Ctrl + Shift + R
```

### 步骤 2: 打开 Console，筛选日志

筛选关键字:
- `DEBUG` - 查看所有调试日志
- `EventService` - 查看 EventService 操作
- `TimeHub` - 查看 TimeHub 操作
- `useEventTime` - 查看订阅机制

### 步骤 3: 执行操作

1. 点击一个事件的 PlanItemTimeDisplay
2. 在 UnifiedDateTimePicker 中选择新时间（如"明天下午3点"）
3. 关闭 Picker

### 步骤 4: 按顺序检查日志

期望看到的日志序列:

```
1. [TimeHub] 📥 收到 setEventTime 调用
2. [TimeHub] 💾 准备持久化到 EventService
3. [EventService] ✏️ Updating event: {eventId}
4. [EventService] 💾 Event updated in localStorage
5. [EventService] 🔔 Dispatched eventsUpdated event: {eventId}
6. [🔍 DEBUG] App.tsx - Event updated in allEvents
   - 检查 oldStartTime vs newStartTime
7. [🔍 DEBUG] App.tsx - Rendering plan page
   - 检查 filteredItems 中的 startTime
8. [🔍 DEBUG] PlanManager - items props changed
   - 检查 items 中的 startTime
9. [🖼️] PlanItemTimeDisplay 快照更新
   - 检查 TimeHub快照start vs item本地startTime
10. [🔄 useEventTime 收到通知]
11. [📸 useEventTime.getSnapshot]
```

### 步骤 5: 定位失败的检查点

- **如果步骤 1-5 都有，但步骤 6 没有**: 
  - 问题在 App.tsx 的 `handleEventUpdated` 监听器
  - 可能是事件监听器没有正确注册

- **如果步骤 6 有，但 oldStartTime === newStartTime**:
  - 问题在 EventService.getEventById
  - 可能返回了缓存的旧数据

- **如果步骤 7 的 startTime 还是旧值**:
  - 问题在 `setAllEvents` 状态更新
  - 可能是 React 批处理延迟

- **如果步骤 8 的 startTime 还是旧值**:
  - 问题在 App.tsx → PlanManager 的 props 传递
  - 可能是 filteredPlanItems 计算有问题

- **如果步骤 9 的 item本地startTime 还是旧值**:
  - 问题在 PlanManager → PlanItemTimeDisplay 的 props 传递
  - 可能是 React.memo 阻止了重新渲染

- **如果步骤 9 的 TimeHub快照start 还是旧值**:
  - 问题在 TimeHub 的缓存更新
  - 检查 TimeHub.setEventTime 是否正确更新了 cache

---

## 5. 临时调试代码

### 在 PlanItemTimeDisplay 中添加强制日志

```typescript
const PlanItemTimeDisplay = React.memo<{
  item: Event;
  onEditClick: (anchor: HTMLElement) => void;
}>(({ item, onEditClick }) => {
  const eventTime = useEventTime(item.id);
  
  // ✅ 强制日志（不经过 dbg 检查）
  console.log(`%c[强制日志] PlanItemTimeDisplay render`, 'background: red; color: white; padding: 4px;', {
    itemId: item.id,
    itemTitle: item.title,
    'item.startTime': item.startTime,
    'eventTime.start': eventTime.start,
    '最终使用': eventTime.start || item.startTime,
  });
  
  const startTime = eventTime.start 
    ? new Date(eventTime.start) 
    : (item.startTime ? new Date(item.startTime) : null);
  
  // ...
});
```

### 禁用 React.memo 测试

```typescript
// 临时移除 React.memo
const PlanItemTimeDisplay = ({ item, onEditClick }: {
  item: Event;
  onEditClick: (anchor: HTMLElement) => void;
}) => {
  // ... 原来的代码
};
```

---

## 6. 预期修复方案

根据诊断结果，可能的修复方案：

### 方案 A: 确保对象引用变化

```typescript
// App.tsx
setAllEvents(prev => {
  return prev.map(event => 
    event.id === eventId 
      ? { ...updatedEvent }  // ← 确保新对象
      : event
  );
});
```

### 方案 B: 使用 flushSync 强制同步更新

```typescript
import { flushSync } from 'react-dom';

flushSync(() => {
  setAllEvents(prev => prev.map(...));
});
```

### 方案 C: 移除 React.memo（如果是原因）

```typescript
const PlanItemTimeDisplay = ({ item, onEditClick }) => {
  // ... 不使用 React.memo
};
```

### 方案 D: 添加 key 强制重新渲染

```typescript
<PlanItemTimeDisplay 
  key={`${item.id}-${item.startTime}`}  // ← 时间变化会强制重新创建组件
  item={item} 
  onEditClick={...} 
/>
```

---

## 7. 后续检查

修复后，验证以下场景:

1. ✅ 修改时间后，UI 立即更新
2. ✅ TimeHub 快照与 item 本地数据保持一致
3. ✅ 多个 PlanItemTimeDisplay 同时显示同一事件，都能更新
4. ✅ 跨标签页更新也能正常同步

---

**诊断时间**: 2025-11-21  
**诊断工具**: Console 日志 + React DevTools  
**预期完成**: 确定失败的检查点 → 实施修复方案
