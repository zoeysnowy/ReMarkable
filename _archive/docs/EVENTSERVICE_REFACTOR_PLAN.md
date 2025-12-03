# EventService 重构计划 - StorageManager 集成

## 目标
将 EventService 中的所有 localStorage 操作迁移到 StorageManager，实现双写（IndexedDB + SQLite）和缓存机制。

## 核心修改点

### 1. ✅ 已完成
- 导入 StorageManager 和 StorageEvent 类型
- getAllEvents() 改为异步，使用 storageManager.queryEvents()
- getEventById() 改为异步，使用 storageManager.queryEvents()
- 添加 convertStorageEventToEvent() 和 convertEventToStorageEvent() 转换方法

### 2. 待修改方法

#### createEvent()
**原实现**:
```typescript
const existingEvents = this.getAllEvents();
existingEvents.push(finalEvent);
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
```

**新实现**:
```typescript
// 检查是否已存在
const existing = await storageManager.queryEvents({
  filters: { eventIds: [event.id] },
  limit: 1
});

if (existing.items.length > 0) {
  return this.updateEvent(event.id, finalEvent, skipSync);
}

// 创建新事件（双写到 IndexedDB + SQLite）
const storageEvent = this.convertEventToStorageEvent(finalEvent);
await storageManager.createEvent(storageEvent);

// 处理父子关联（需要更新父事件）
if (finalEvent.parentEventId) {
  const parent = await this.getEventById(finalEvent.parentEventId);
  if (parent) {
    const childIds = parent.childEventIds || [];
    if (!childIds.includes(finalEvent.id)) {
      await this.updateEvent(parent.id, {
        childEventIds: [...childIds, finalEvent.id]
      });
    }
  }
}
```

#### updateEvent()
**原实现**:
```typescript
const existingEvents = this.getAllEvents();
const eventIndex = existingEvents.findIndex(e => e.id === eventId);
existingEvents[eventIndex] = updatedEvent;
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
```

**新实现**:
```typescript
// 获取原始事件
const originalEvent = await this.getEventById(eventId);
if (!originalEvent) {
  return { success: false, error: `Event not found: ${eventId}` };
}

// 合并更新
const updatedEvent: Event = {
  ...originalEvent,
  ...filteredUpdates,
  id: eventId,
  updatedAt: formatTimeForStorage(new Date())
};

// 更新到 StorageManager（双写）
const storageEvent = this.convertEventToStorageEvent(updatedEvent);
await storageManager.updateEvent(eventId, storageEvent);

// 处理父子关联变化
if (filteredUpdates.parentEventId !== undefined && 
    filteredUpdates.parentEventId !== originalEvent.parentEventId) {
  // ... 更新父子关联 ...
}
```

#### deleteEvent()
**原实现**:
```typescript
const existingEvents = this.getAllEvents();
const updatedEvents = existingEvents.filter(e => e.id !== eventId);
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
```

**新实现**:
```typescript
// 获取事件（用于清理父子关联）
const deletedEvent = await this.getEventById(eventId);
if (!deletedEvent) {
  return { success: false, error: `Event not found: ${eventId}` };
}

// 清理父子关联
if (deletedEvent.parentEventId) {
  const parent = await this.getEventById(deletedEvent.parentEventId);
  if (parent) {
    await this.updateEvent(parent.id, {
      childEventIds: (parent.childEventIds || []).filter(id => id !== eventId)
    });
  }
}

// 删除事件（双写删除）
await storageManager.deleteEvent(eventId);
```

#### batchCreateEvents()
**原实现**:
```typescript
for (const event of events) {
  const result = await this.createEvent(event, skipSync);
  // ...
}
```

**新实现**:
```typescript
const storageEvents = events.map(e => this.convertEventToStorageEvent(this.normalizeEvent(e)));
const batchResult = await storageManager.batchCreateEvents(storageEvents);
```

#### getEventsByRange()
**原实现**:
```typescript
const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
const allEvents: Event[] = JSON.parse(saved);
const filteredEvents = allEvents.filter(event => { /* 时间范围过滤 */ });
```

**新实现**:
```typescript
// 使用 StorageManager 的智能查询（SQLite 会自动做索引查询）
const result = await storageManager.queryEvents({
  filters: {
    startTime: { gte: rangeStart },
    endTime: { lte: rangeEnd }
  },
  limit: 1000
});
return result.items.map(e => this.convertStorageEventToEvent(e));
```

### 3. 其他需要改为异步的方法

- `checkIn()` - 内部调用 getAllEvents() 和保存
- `uncheck()` - 内部调用 getAllEvents() 和保存
- `getCheckInStatus()` - 调用 getEventById()
- `searchHistoricalParticipants()` - 调用 getAllEvents()
- `getEventsByContact()` - 调用 getAllEvents()
- `createEventFromRemoteSync()` - 内部保存到 localStorage
- `getChildEvents()` - 调用 getEventById()
- `getSubordinateEvents()` - 调用 getChildEvents()
- `getUserSubTasks()` - 调用 getChildEvents()
- `getEventTree()` - 调用 getEventById()
- `getRootEvent()` - 调用 getEventById()

### 4. 全局影响分析

所有调用 EventService 的组件都需要处理异步：

**需要修改的组件（按优先级）**:
1. ✅ EventService.ts 内部方法（互相调用）
2. PlanManager.tsx - 核心计划管理器
3. TimeCalendar.tsx - 时间日历
4. EventEditModal.tsx - 事件编辑对话框
5. Timer.tsx - 计时器
6. EventTree/ - 事件树组件
7. FloatingToolbar.tsx - 浮动工具栏
8. 其他使用 EventService 的组件

### 5. 兼容性处理

**方案1: 渐进式迁移（推荐）**
- 保留 localStorage 作为降级方案
- StorageManager 初始化失败时回退到 localStorage
- 添加 `useLegacyStorage` 配置项

**方案2: 激进式迁移**
- 完全移除 localStorage 依赖
- 所有方法改为异步
- 一次性迁移所有组件

## 实施步骤

### Phase 1: StorageManager 核心集成 ✅
- [x] 添加 StorageManager 导入
- [x] 重构 getAllEvents()
- [x] 重构 getEventById()
- [ ] 重构 createEvent()
- [ ] 重构 updateEvent()
- [ ] 重构 deleteEvent()

### Phase 2: 批量操作和查询
- [ ] 重构 batchCreateEvents()
- [ ] 重构 getEventsByRange()
- [ ] 添加搜索功能（使用 SQLite FTS5）

### Phase 3: 辅助方法
- [ ] 重构 checkIn/uncheck
- [ ] 重构 EventTree 相关方法

### Phase 4: 数据迁移
- [ ] 添加 migrateFromLocalStorage() 方法
- [ ] 在首次启动时自动迁移
- [ ] 迁移后清理 localStorage（可选）

### Phase 5: 组件更新
- [ ] 更新所有调用 EventService 的组件
- [ ] 处理异步加载状态
- [ ] 添加错误处理

### Phase 6: 测试验证
- [ ] 单元测试
- [ ] 集成测试
- [ ] 端到端测试
- [ ] 性能测试（对比 localStorage）

## 风险点

1. **异步改造影响面广** - 需要修改大量组件
2. **父子事件关联复杂** - 更新父事件时需要额外查询
3. **性能回归** - IndexedDB 异步可能慢于同步 localStorage
4. **数据一致性** - 双写失败时的回滚机制
5. **迁移失败** - 用户数据丢失风险

## 解决方案

1. **异步改造** → 使用 async/await + loading 状态
2. **父子关联** → 优化为批量更新
3. **性能优化** → LRU 缓存 + 智能预加载
4. **数据一致性** → 事务机制 + 错误重试
5. **迁移安全** → 备份 + 验证 + 可回滚
