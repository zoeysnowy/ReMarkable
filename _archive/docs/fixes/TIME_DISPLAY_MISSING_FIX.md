# TimeDisplay 不显示时间 - 完整修复记录

## 问题现象
用户输入 `@明天下午1点` 后,PlanItemTimeDisplay 组件不显示时间信息。

## 根本原因
数据链路中存在**时间字段丢失**问题:

### 完整数据流
```
DateMention 输入 → TimeHub.setEventTime() 
  → Slate onBlur → slateNodesToPlanItems() 
  → executeBatchUpdate() 
  → [⚠️ 移除时间字段] 
  → EventService.updateEvent() 
  → PlanManager items state 
  → PlanItemTimeDisplay
```

### 问题定位

#### 1. EventService 验证问题 (已修复 ✅)
**文件**: `src/utils/eventValidation.ts` (lines 38-46)

**原因**: 验证逻辑拒绝 `{startTime: '...', endTime: undefined}`

**修复**:
```typescript
const hasStartTime = startTime !== undefined && startTime !== '';
const hasEndTime = endTime !== undefined && endTime !== '';

if (hasStartTime && !hasEndTime) {
  // 单时间点：允许 {startTime: '...', endTime: ''}
  return { valid: true };
}
```

#### 2. Slate 序列化问题 (已修复 ✅)
**文件**: `src/components/PlanSlate/serialization.ts` (lines 398-427)

**原因**: 从 DateMention node 读取过时数据,而不是从 TimeHub 读取最新数据

**修复**:
```typescript
// 优先从 TimeHub 读取(v2.7 的 getSnapshot)
const timeSnapshot = TimeHub.getSnapshot(baseId);
if (timeSnapshot.start || timeSnapshot.end) {
  item.startTime = timeSnapshot.start || undefined;
  item.endTime = timeSnapshot.end || undefined;
  item.isAllDay = timeSnapshot.allDay || false;
} else if (dateMention) {
  // 降级到 DateMention node 数据
  item.startTime = dateMention.startDate;
  item.endTime = dateMention.endDate || undefined;
}
```

#### 3. PlanManager 保存时移除时间字段 (本次修复 ✅)
**文件**: `src/components/PlanManager.tsx` (lines 1076-1090)

**原因**: 
`executeBatchUpdate()` 为了防止 Slate 过时数据覆盖 TimeHub,**错误地移除了时间字段**:

```typescript
// ❌ 错误的逻辑
const { startTime, endTime, isAllDay, dueDate, ...updatedItemWithoutTime } = updatedItem;

const eventItem: Event = {
  ...(existingItem || {}),
  ...updatedItemWithoutTime,  // ← 不包含时间字段
  // ...
};
```

**设计误解**: 
注释说"不从 Slate 更新时间字段,避免覆盖 TimeHub",但实际上:
- `updatedItem` 来自 `slateNodesToPlanItems()`
- `slateNodesToPlanItems()` **已经从 TimeHub.getSnapshot() 读取了最新时间** (serialization.ts line 398-427)
- 所以 `updatedItem.startTime/endTime` **就是** TimeHub 的最新数据,不是过时数据!

**实际问题**:
- 移除时间字段后,EventService 收到的数据没有时间
- Line 1102 的 `hasAnyTime` 判断永远为 `false`
- 导致时间数据丢失

**修复方案**:
**不移除时间字段**,直接使用 `updatedItem`:

```typescript
// ✅ 正确的逻辑
const eventItem: Event = {
  ...(existingItem || {}),
  ...updatedItem,  // ← 包含从 TimeHub 来的时间字段
  tags: tagIds,
  // ... 其他字段覆盖
};
```

## 完整修复后的数据流

### 1. 用户输入 @明天下午1点
```
DateMentionElement.handleMentionSelect() 
  → TimeHub.setEventTime(eventId, {
      start: '2025-11-16 13:00:00',
      end: '',
      allDay: false
    })
  → TimeHub.emit(eventId) // 通知订阅者
```

### 2. Slate 失焦保存
```
Slate onBlur 
  → flushPendingChanges() 
  → slateNodesToPlanItems(filteredNodes)
```

在 `slateNodesToPlanItems()` 中:
```typescript
// ✅ 优先从 TimeHub 读取
const timeSnapshot = TimeHub.getSnapshot(eventId);
item.startTime = timeSnapshot.start; // '2025-11-16 13:00:00'
item.endTime = timeSnapshot.end;     // ''
```

### 3. 批量保存处理
```
onChange(planItems) 
  → debouncedOnChange(updatedItems) 
  → executeBatchUpdate(updatedItems)
```

在 `executeBatchUpdate()` 中:
```typescript
// ✅ updatedItems 就是 planItems，已包含从 TimeHub 来的时间
// 直接使用，不移除时间字段
const eventItem: Event = {
  ...(existingItem || {}),
  ...updatedItem,  // ← 包含 startTime/endTime
  tags: tagIds,
  // ...
};

// ✅ 保存完整数据
onSave(eventItem);
```

### 4. EventService 持久化
```
handleSavePlanItem(item) 
  → EventService.updateEvent(item.id, {
      ...item,
      startTime: '2025-11-16 13:00:00',
      endTime: '',
      isPlan: true,
    })
  → localStorage.setItem('events', ...)
  → window.dispatchEvent('eventsUpdated', {
      eventId: item.id,
      isNewEvent: false,
    })
```

### 5. PlanManager 增量更新
```
PlanManager.useEffect 监听 'eventsUpdated'
  → handleEventUpdated()
  → const updatedEvent = EventService.getEventById(eventId)
  → setItems(prev => prev.map(e => 
      e.id === eventId ? updatedEvent : e
    ))
```

### 6. 显示组件重新渲染
```
PlanItemTimeDisplay({ item }) 
  → const eventTime = useEventTime(item.id) // TimeHub 订阅
  → const startTime = eventTime.start 
      ? new Date(eventTime.start)       // ✅ '2025-11-16 13:00:00'
      : (item.startTime ? new Date(item.startTime) : null) // 降级
  → 渲染: "明天下午 1:00"
```

## 架构说明

### 时间数据的唯一来源: TimeHub

**设计原则**: 整个应用的时间读取**只有一个入口** - TimeHub!

**数据流**:
```
1. 初始化:
   EventService.getAllEvents() 
     → 将时间同步到 TimeHub (PlanManager 初始化)
     → TimeHub 成为时间的唯一来源

2. 用户输入:
   DateMention/UnifiedPicker 
     → TimeHub.setEventTime() (实时更新)
     → 所有订阅组件自动刷新

3. 序列化保存:
   Slate onBlur 
     → slateNodesToPlanItems() 
     → TimeHub.getSnapshot() (读取最新时间)
     → EventService.updateEvent() (持久化)

4. 显示:
   所有组件通过 useEventTime(eventId) 
     → 订阅 TimeHub
     → 实时显示
```

**Slate metadata 中的时间字段**:
- 目的: 作为"备份",保持数据完整性
- **永远不应该被读取**: 所有时间读取都通过 TimeHub
- 更新: 由 `planItemsToSlateNodes` 从 items 填充(初始化时)

### 双数据源设计

1. **TimeHub** (内存缓存 + 响应式)
   - 存储: `Map<eventId, { start, end, allDay }>`
   - 作用: **唯一时间来源**,实时更新,React 组件订阅
   - API: `setEventTime()`, `getSnapshot()`, `emit()`
   - 初始化: 从 EventService 同步

2. **EventService** (localStorage 持久化)
   - 存储: `localStorage['events']`
   - 作用: 数据持久化,跨会话保存
   - API: `createEvent()`, `updateEvent()`, `getEventById()`
   - 时间字段: 保存但**不直接读取**,只用于持久化

### 同步策略
- **应用启动**: EventService → TimeHub (PlanManager 初始化时同步)
- **用户输入**: DateMention/Picker → TimeHub.setEventTime()
- **序列化保存**: TimeHub.getSnapshot() → EventService.updateEvent()
- **组件显示**: useEventTime(TimeHub) - 唯一读取入口

### 为什么需要双数据源?
1. **TimeHub**: 提供 React 组件实时更新(useSyncExternalStore)
2. **EventService**: 提供数据持久化(localStorage)
3. **单向同步**: TimeHub ← EventService (启动时) / TimeHub → EventService (保存时)

## 关键代码修改

### 文件 1: `src/utils/eventValidation.ts`
```typescript
// Line 38-46
const hasStartTime = startTime !== undefined && startTime !== '';
const hasEndTime = endTime !== undefined && endTime !== '';

if (hasStartTime && !hasEndTime) {
  return { valid: true }; // ✅ 允许单时间点
}
```

### 文件 2: `src/components/PlanSlate/serialization.ts`
```typescript
// Line 18: 添加 TimeHub 导入
import { TimeHub } from '../../services/TimeHub';

// Line 398-427: 优先从 TimeHub 读取
const timeSnapshot = TimeHub.getSnapshot(baseId);
if (timeSnapshot.start || timeSnapshot.end) {
  item.startTime = timeSnapshot.start || undefined;
  item.endTime = timeSnapshot.end || undefined;
  item.isAllDay = timeSnapshot.allDay || false;
} else if (dateMention) {
  item.startTime = dateMention.startDate;
  item.endTime = dateMention.endDate || undefined;
}
```

### 文件 3: `src/components/PlanManager.tsx`
```typescript
// Line 1076-1090: 保留 updatedItem 中的时间字段
const eventItem: Event = {
  ...(existingItem || {}),
  ...updatedItem,  // ✅ 包含从 serialization.ts → TimeHub 来的时间字段
  tags: tagIds,
  calendarIds: calendarIds.length > 0 ? calendarIds : undefined,
  // ... 其他字段覆盖
};

// updatedItem.startTime/endTime 来自 slateNodesToPlanItems()
// slateNodesToPlanItems() 已经从 TimeHub.getSnapshot() 读取最新时间
// 所以直接使用即可，不需要再次移除或读取
```

## 验证步骤

1. **输入 DateMention**
   - 操作: 在编辑器输入 `@明天下午1点` 并确认
   - 预期: Console 显示 `[TimeHub] setEventTime: {start: '2025-11-16 13:00:00', end: ''}`

2. **Slate 失焦**
   - 操作: 点击编辑器外部,触发 onBlur
   - 预期: Console 显示 `[PlanManager] 从 TimeHub 合并时间到保存数据`

3. **EventService 保存**
   - 预期: Console 显示 `[PlanManager] 准备保存到 EventService: {startTime: '...', endTime: ''}`

4. **显示更新**
   - 预期: PlanItemTimeDisplay 显示 "明天下午 1:00"
   - 验证: 检查 localStorage['events'] 中该事件有 startTime 字段

## 相关文档
- [TIME_PICKER_AND_DISPLAY_PRD.md](../PRD/TIME_PICKER_AND_DISPLAY_PRD.md) - Appendix B: 交互链路文档
- [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md) - TimeHub 架构说明
- [eventValidation.ts](../../src/utils/eventValidation.ts) - 验证规则
- [serialization.ts](../../src/components/PlanSlate/serialization.ts) - Slate 序列化逻辑

## 修复日期
2025-01-XX

## 修复版本
v1.8.x
