# EventHub 架构升级指南

## 🎯 设计目标

解决事件更新时的**数据覆盖问题**，实现真正的**增量更新**机制。

## 🏗️ 新架构

### EventHub（事件状态管理中心）

**职责：**
- 维护事件的内存快照（snapshot）
- 提供增量更新 API（只更新变化的字段）
- 协调多个组件对同一事件的修改
- 发出全局事件通知

**API：**

```typescript
// 1. 获取事件快照
const event = EventHub.getSnapshot(eventId);

// 2. 增量更新（只更新指定字段）
await EventHub.updateFields(eventId, {
  description: '新的描述',
  tags: ['tag1', 'tag2']
}, { source: 'ComponentName' });

// 3. 创建新事件
await EventHub.createEvent(newEvent);

// 4. 删除事件
await EventHub.deleteEvent(eventId);

// 5. 清除缓存
EventHub.invalidate(eventId);  // 清除单个
EventHub.invalidateAll();      // 清除所有
```

## 📝 使用示例

### 组件中更新事件

**❌ 旧方式（容易覆盖数据）：**
```typescript
const handleSave = async (updatedEvent: Event) => {
  // 直接保存整个对象，未修改的字段也会被覆盖
  await EventService.updateEvent(eventId, updatedEvent);
};
```

**✅ 新方式（增量更新）：**
```typescript
const handleSave = async () => {
  const { EventHub } = await import('../services/EventHub');
  
  // 只更新真正修改的字段
  await EventHub.updateFields(eventId, {
    title: newTitle,
    tags: newTags
    // description 没变，不传 → 保留原值
  }, { source: 'MyComponent' });
};
```

### 获取最新状态

**✅ 使用 EventHub 获取快照：**
```typescript
const { EventHub } = await import('../services/EventHub');
const event = EventHub.getSnapshot(eventId);

if (event) {
  console.log('当前 description:', event.description);
}
```

## 🔄 迁移清单

### 已迁移
- ✅ TimeCalendar.handleSaveEventFromModal

### 待迁移
- ⏳ App.tsx（Timer 相关逻辑）
- ⏳ PlanManager.tsx
- ⏳ 其他直接调用 EventService.updateEvent 的地方

## 🐛 解决的问题

### 问题 1：Description 被覆盖

**原因：** EditModal 返回完整事件对象，即使某些字段没修改也会被传回。TimeCalendar 直接覆盖整个对象。

**解决：** EventHub 逐字段对比，只更新真正变化的字段。

### 问题 2：null vs 空字符串

**原因：** `event.description || ''` 会把 `null` 转成 `''`，导致误判为变化。

**解决：** 使用 `??` 操作符，只在 `null/undefined` 时转换。

### 问题 3：并发修改冲突

**原因：** 多个组件同时修改同一事件，后者覆盖前者。

**解决：** EventHub 维护统一快照，所有修改都通过 EventHub，避免冲突。

## 🎓 最佳实践

1. **总是通过 EventHub 修改事件**
   ```typescript
   // ❌ 不要直接用 EventService
   EventService.updateEvent(id, event);
   
   // ✅ 使用 EventHub
   EventHub.updateFields(id, updates);
   ```

2. **只传需要更新的字段**
   ```typescript
   // ❌ 不要传整个对象
   EventHub.updateFields(id, { ...event, title: newTitle });
   
   // ✅ 只传变化的字段
   EventHub.updateFields(id, { title: newTitle });
   ```

3. **使用快照读取状态**
   ```typescript
   // ✅ 从 EventHub 读取
   const event = EventHub.getSnapshot(id);
   
   // 而不是从 EventService（可能有缓存问题）
   const events = EventService.getAllEvents();
   const event = events.find(e => e.id === id);
   ```

## 🔍 调试工具

浏览器控制台：
```javascript
// 查看缓存状态
window.debugEventHub.getCacheStats();

// 获取快照
window.debugEventHub.getSnapshot(eventId);

// 清除缓存
window.debugEventHub.invalidate(eventId);
window.debugEventHub.invalidateAll();
```

## 📊 架构对比

### 旧架构
```
Component → EventService → localStorage → 全局事件
                ↓
          ActionBasedSyncManager
```

**问题：**
- 组件直接操作 EventService
- 容易覆盖未修改的字段
- 缺少统一的状态管理

### 新架构
```
Component → EventHub (快照 + 增量更新) → EventService → localStorage
                ↓                            ↓
          全局事件通知              ActionBasedSyncManager
```

**优势：**
- EventHub 统一管理状态
- 增量更新，不覆盖数据
- 自动发出通知事件
- 更容易调试和追踪

## ⚠️ 注意事项

1. **TimeHub 专注时间，EventHub 专注完整事件**
   - TimeHub: 管理 startTime, endTime, timeSpec
   - EventHub: 管理完整 Event 对象
   - 两者可以共存，各司其职

2. **EventService 仍然存在**
   - EventHub 内部调用 EventService
   - 不建议直接使用 EventService.updateEvent
   - 但 EventService.getAllEvents() 仍可用于读取

3. **向后兼容**
   - 旧代码仍然可以工作
   - 但建议逐步迁移到 EventHub

## 🚀 下一步

1. 迁移 App.tsx 的 Timer 逻辑
2. 迁移 PlanManager.tsx
3. 搜索所有 `EventService.updateEvent` 调用并迁移
4. 添加单元测试
