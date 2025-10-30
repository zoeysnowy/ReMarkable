# EventService 集成指南

## 概述

`EventService` 是一个统一的事件管理服务，用于集中处理所有事件的创建、更新和删除操作。它确保：

1. **统一的数据持久化**：所有事件操作都通过同一个服务进行 localStorage 管理
2. **自动同步机制**：所有事件变更自动调用 `recordLocalAction` 加入同步队列
3. **全局事件通知**：自动触发 `eventsUpdated` 事件，通知其他组件更新
4. **一致的错误处理**：统一的返回格式和错误日志

## 当前集成状态

### ✅ 已集成组件

- **App.tsx**：
  - Timer Stop（停止计时）
  - Timer Cancel（取消计时）
  - Timer Init（计时器初始化）
  - handleCreateEvent（创建事件回调）
  - handleUpdateEvent（更新事件回调）

### ⚠️ 待集成组件

- **TimeCalendar.tsx**：
  - `handleBeforeCreateEvent`（创建新事件）
  - `handleBeforeUpdateEvent`（更新事件）
  - `handleBeforeDeleteEvent`（删除事件）
  
- **EventManager.tsx**：
  - 所有事件创建/更新/删除操作
  
- **PlanManager.tsx**：
  - Plan 转 Event 的创建逻辑

## API 使用说明

### 1. 初始化服务

在 App.tsx 中，同步管理器初始化后立即初始化 EventService：

```typescript
const newSyncManager = new ActionBasedSyncManager(microsoftService);
EventService.initialize(newSyncManager); // 注入同步管理器
```

### 2. 创建事件

```typescript
import { EventService } from '../services/EventService';

const result = await EventService.createEvent(event, skipSync);

if (result.success) {
  console.log('✅ Event created:', result.event);
} else {
  console.error('❌ Failed:', result.error);
}
```

**参数说明：**
- `event: Event` - 完整的事件对象
- `skipSync: boolean` - 是否跳过同步（默认 false）
  - `true`：仅保存到 localStorage，不加入同步队列（例如：Timer 运行中）
  - `false`：保存并加入同步队列，准备同步到 Outlook

**返回值：**
```typescript
{
  success: boolean;
  event?: Event;  // 成功时返回最终保存的事件对象
  error?: string; // 失败时返回错误信息
}
```

### 3. 更新事件

```typescript
// 方式1：部分更新
const result = await EventService.updateEvent(eventId, { title: 'New Title' }, skipSync);

// 方式2：完整对象更新
const result = await EventService.updateEvent(eventId, updatedEvent, skipSync);
```

**参数说明：**
- `eventId: string` - 事件ID
- `updates: Partial<Event> | Event` - 更新内容（可以是部分字段或完整对象）
- `skipSync: boolean` - 是否跳过同步

### 4. 删除事件

```typescript
const result = await EventService.deleteEvent(eventId, skipSync);
```

### 5. 批量创建事件

```typescript
const result = await EventService.batchCreateEvents(events, skipSync);

console.log(`Created: ${result.created}, Failed: ${result.failed}`);
if (result.failed > 0) {
  console.error('Errors:', result.errors);
}
```

### 6. 查询事件

```typescript
// 获取所有事件
const allEvents = EventService.getAllEvents();

// 根据ID获取单个事件
const event = EventService.getEventById(eventId);
```

## 迁移指南

### TimeCalendar.tsx 迁移示例

**迁移前：**
```typescript
const handleBeforeCreateEvent = async (eventInfo: any) => {
  // ... 创建事件对象 ...
  
  // 保存到 localStorage
  const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
  const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
  existingEvents.push(updatedEvent);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
  
  // 更新 UI
  setEvents([...existingEvents]);
  
  // 触发全局事件
  window.dispatchEvent(new CustomEvent('eventsUpdated', {
    detail: { eventId: updatedEvent.id, isNewEvent: true }
  }));
  
  // 同步到 Outlook
  if (syncManager) {
    await syncManager.recordLocalAction('create', 'event', updatedEvent.id, updatedEvent);
  }
};
```

**迁移后：**
```typescript
import { EventService } from '../services/EventService';

const handleBeforeCreateEvent = async (eventInfo: any) => {
  // ... 创建事件对象 ...
  
  // 🔧 使用 EventService 统一处理
  const result = await EventService.createEvent(updatedEvent);
  
  if (result.success) {
    // 更新本地 UI 状态
    setEvents(EventService.getAllEvents());
    console.log('✅ Event created via EventService');
  } else {
    console.error('❌ Failed to create event:', result.error);
  }
};
```

### 关键优势

1. **减少代码重复**：50+ 行代码 → 5 行代码
2. **统一同步逻辑**：不再需要在每个组件中手动调用 `recordLocalAction`
3. **一致的错误处理**：统一的返回格式和日志
4. **自动事件通知**：不需要手动 `dispatchEvent`

## skipSync 使用场景

### 需要 skipSync=true 的场景

1. **Timer 运行中**：每 30 秒保存一次进度，但不同步
   ```typescript
   await EventService.createEvent(timerEvent, true);
   ```

2. **取消操作**：删除本地事件，但不需要同步到 Outlook
   ```typescript
   await EventService.deleteEvent(eventId, true);
   ```

3. **批量导入**：先导入所有数据，再手动触发同步
   ```typescript
   await EventService.batchCreateEvents(events, true);
   ```

### 使用 skipSync=false（默认）的场景

1. **Timer 停止**：最终保存并同步到 Outlook
2. **用户手动创建事件**：TimeCalendar 中创建事件
3. **编辑事件**：用户修改事件内容
4. **Plan 转 Event**：从 PlanManager 创建事件

## 注意事项

1. **异步操作**：所有 EventService 方法都是异步的，记得使用 `await`
2. **错误处理**：始终检查返回的 `success` 字段
3. **UI 更新**：成功后使用 `EventService.getAllEvents()` 更新本地状态
4. **同步管理器**：必须先初始化 EventService 才能自动同步

## 调试工具

EventService 已暴露到全局，可在控制台使用：

```javascript
// 检查服务状态
EventService.isInitialized()

// 查看所有事件
EventService.getAllEvents()

// 查看同步管理器
EventService.getSyncManager()

// 创建测试事件
await EventService.createEvent({
  id: 'test-123',
  title: 'Test Event',
  startTime: '2025-10-30T10:00:00',
  endTime: '2025-10-30T11:00:00',
  tags: [],
  remarkableSource: true,
  syncStatus: 'pending'
})
```

## 下一步行动

1. **迁移 TimeCalendar.tsx**：将所有事件操作替换为 EventService 调用
2. **迁移 EventManager.tsx**：统一事件管理逻辑
3. **迁移 PlanManager.tsx**：Plan 转 Event 使用 EventService
4. **测试验证**：确保所有创建路径都能正确同步

## 性能考虑

EventService 已做优化：

- ✅ localStorage 读写一次性完成，不重复读取
- ✅ 同步失败不阻塞事件创建（非阻塞式同步）
- ✅ Timer 运行中使用 `skipSync=true` 避免频繁同步
- ✅ 批量操作支持减少网络请求

## 向后兼容

EventService 不会破坏现有代码：

- 现有的直接 localStorage 操作仍然有效
- 现有的 `recordLocalAction` 调用仍然有效
- 可以逐步迁移，不需要一次性修改所有代码

## 总结

EventService 提供了一个**集中式、统一化、可靠的**事件管理机制，确保：

1. **所有事件创建路径**（Timer、TimeCalendar、PlanManager）都汇入同一个同步机制
2. **一致的数据处理**和错误处理
3. **简化的代码维护**和更少的重复代码
4. **可靠的同步保证**，不会遗漏任何事件

建议尽快将所有组件迁移到 EventService，享受统一管理带来的便利。
