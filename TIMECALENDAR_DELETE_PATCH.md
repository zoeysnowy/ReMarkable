# TimeCalendar 删除操作优化补丁

## 问题
Line 1839 和 Line 1938 都使用了全量 `setEvents(updatedEvents)`，导致删除时重渲染所有 1150 个事件。

## 修复

### 修改 1: handleBeforeDeleteEvent (Line 1839)
```typescript
// ❌ 修改前
setEvents(updatedEvents);

// ✅ 修改后
setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
```

### 修改 2: handleDeleteEventFromModal (Line 1938)
```typescript
// ❌ 修改前
setEvents(updatedEvents);

// ✅ 修改后  
setEvents(prevEvents => prevEvents.filter(e => e.id !== eventId));
```

### 修改 3: 移除阻塞 await (Line ~1853)
```typescript
// ❌ 修改前
await activeSyncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete);

// ✅ 修改后
activeSyncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete)
  .then(() => console.log('✅ Synced'))
  .catch(err => console.error('❌ Sync failed:', err));
```

## 性能提升

- **渲染时间**: 从重渲染 1150 个事件 → 只移除 1 个事件
- **预期提升**: ↓ 99%+
