# ActionBasedSyncManager 存储迁移进度

## 问题现状

ActionBasedSyncManager（4500+ 行）仍在大量使用 localStorage 和同步的 EventService 调用，导致：
- ❌ 所有远程同步的事件写入 localStorage 而不是 StorageManager（IndexedDB + SQLite）
- ❌ 大量同步方法调用（没有 await）
- ❌ 直接操作 events 数组并用 `saveLocalEvents()` 写 localStorage

## 已完成的修改

### ✅ 核心方法已改为 async

1. **getLocalEvents()** → async
   - 使用 `await EventService.getAllEvents()`
   
2. **updateLocalEventExternalId()** → async
   - 改用 `await EventService.updateEvent()`
   - 不再直接操作 events 数组
   - 通过 EventService 删除重复事件

3. **updateLocalEventCalendarId()** → async
   - 改用 `await EventService.updateEvent()`
   - 不再直接操作 events 数组

4. **cleanupInvalidQueueActions()** → async
   - 使用 `await EventService.getAllEvents()`

5. **saveLocalEvents()** → async（已标记 deprecated）
   - 添加警告：不再使用 localStorage
   - 注释说明应通过 EventService 保存

### ✅ applyRemoteActionToLocal - create case

- 使用 `await EventService.createEventFromRemoteSync()`
- Fallback 使用 `await EventService.createEvent()`
- 创建后重新加载：`await EventService.getAllEvents()`

### ✅ applyRemoteActionToLocal - 现有事件更新

- 使用 `await EventService.updateEvent()`
- 通过 EventService 保存，不再直接操作数组

## 🚧 待修复的部分

### ⚠️ applyRemoteActionToLocal - update case

**位置**: 行 3180-3300+

**问题**:
```typescript
// ❌ 直接操作 events 数组
events[eventIndex] = {
  ...oldEvent,
  ...updates
};

// ❌ 使用 saveLocalEvents 写 localStorage
this.saveLocalEvents(events, false);
```

**需要改为**:
```typescript
// ✅ 使用 EventService
await EventService.updateEvent(eventId, updates, true);
events = await EventService.getAllEvents(); // 重新加载
```

**影响范围**: 约 100-150 行代码

### ⚠️ applyRemoteActionToLocal - delete case

**位置**: 行 3300+

**问题**: 直接操作 events 数组删除事件

**需要改为**: 使用 `await EventService.deleteEvent()`

### ⚠️ 其他方法需要改为 async

1. **fixOrphanedPendingEvents()** - 行 4385
   - 使用 `EventService.getAllEvents()` 同步调用
   
2. **migrateOutlookPrefixes()** - 行 4453
   - 使用 `EventService.getAllEvents()` 同步调用
   - 直接操作数组并 `saveLocalEvents()`

3. **runIncrementalIntegrityCheck()** - 行 4230
   - 使用 `EventService.getAllEvents()` 同步调用

4. **updateLocalEvent()** - 行 4091
   - 直接操作 events 数组

5. **deduplicateEvents()** - 行 740
   - ✅ 已经是 async（之前已修复）

## 📊 统计

- **总方法数**: ~88 个
- **已修复**: 6 个关键方法
- **待修复**: 约 10-15 个方法
- **完成度**: ~15%

## 🎯 重构策略

### 阶段 1: 核心同步方法（当前）
- ✅ getLocalEvents
- ✅ updateLocalEventExternalId
- ✅ updateLocalEventCalendarId
- ✅ createEventFromRemoteSync 调用
- 🚧 applyRemoteActionToLocal 的 update/delete case

### 阶段 2: 数据修复方法
- fixOrphanedPendingEvents
- migrateOutlookPrefixes
- updateLocalEvent

### 阶段 3: 完整性检查方法
- runIncrementalIntegrityCheck
- runBatchedFullCheck
- runQuickVisibilityCheck

### 阶段 4: RecoveryService
- 迁移所有 localStorage 操作到 StorageManager

## ⚡ 快速修复建议

由于完全重构需要大量时间，建议：

### 方案 A: 渐进式迁移（推荐）
1. ✅ 先完成 IndexedDB 修复测试（testIndexedDBFix）
2. ✅ 验证本地 CRUD 使用 StorageManager
3. 🔄 逐步修复同步方法（分多次提交）
4. 最后验证端到端同步

### 方案 B: 创建 StorageManagerProxy
在 ActionBasedSyncManager 中创建代理方法：

```typescript
private async getLocalEventsFromStorage(): Promise<Event[]> {
  return await EventService.getAllEvents();
}

private async saveLocalEventsToStorage(events: Event[]): Promise<void> {
  // 批量更新通过 EventService
  // 注意：这需要 EventService 支持批量操作
  console.warn('批量保存功能尚未实现');
}
```

这样可以集中管理存储访问，减少修改点。

## 📝 下一步行动

1. **立即**: 完成 IndexedDB 修复和测试
2. **短期**: 修复 applyRemoteActionToLocal 的 update/delete case
3. **中期**: 修复数据修复和完整性检查方法
4. **长期**: 完全移除 localStorage 依赖

## ⚠️ 风险评估

### 高风险区域
- `applyRemoteActionToLocal` - 核心同步逻辑，出错会导致数据丢失
- `updateLocalEvent` - 直接操作数组，影响多处

### 低风险区域
- 完整性检查方法 - 只读操作
- 数据迁移方法 - 只在启动时运行一次

### 测试策略
1. 每修改一个方法后，立即测试
2. 保留日志输出，便于调试
3. 先在开发环境验证，再提交

## 📚 相关文件

- `src/services/ActionBasedSyncManager.ts` - 主文件（4500+ 行）
- `src/services/EventService.ts` - 已迁移到 StorageManager v3.0.0
- `src/services/storage/StorageManager.ts` - 存储管理器 v1.2.0
- `src/services/RecoveryService.ts` - 待迁移
- `INDEXEDDB_FIX_GUIDE.md` - IndexedDB 修复指南

## 💡 建议

考虑到代码量，建议：
1. 先完成核心功能验证（本地 CRUD + IndexedDB）
2. 将 ActionBasedSyncManager 重构作为独立任务
3. 分多个小 PR 提交，避免一次性改动过大
4. 每个 PR 都要有对应的测试验证

---

**最后更新**: 2025-12-01
**负责人**: Copilot
**优先级**: 高（影响数据持久化）
