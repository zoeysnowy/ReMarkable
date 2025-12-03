# Issue #002: 软删除 deletedAt 字段设置

## 📋 问题描述

**状态**: 🟡 待处理  
**优先级**: 中  
**类型**: 功能完善  
**创建日期**: 2025-12-04

### 问题概述

在软删除测试中，`StorageManager.deleteEvent()` 成功删除了事件，但未设置 `deletedAt` 时间戳字段，导致无法追踪删除时间和实现"回收站"功能。

### 测试失败详情

**测试位置**: `public/test-data-flow-v3.js` Section 1.5  
**测试名称**: 软删除验证  
**失败信息**: 
```
❌ 软删除成功（deletedAt 已设置） {deletedAt: undefined}
```

### 复现步骤

1. 创建一个测试事件
2. 调用 `StorageManager.deleteEvent(eventId)`
3. 查询被删除的事件
4. **预期**: `event.deletedAt` 应为删除时间戳
5. **实际**: `event.deletedAt` 为 `undefined`

### 相关日志

```
StorageManager.ts:328 [StorageManager] Deleting event: test-storage-xxx
StorageManager.ts:341 [StorageManager] ✅ Event deleted: test-storage-xxx
StorageManager.ts:217 [StorageManager] Querying events: {filters: {…}}
StorageManager.ts:242 [StorageManager] ✅ Query complete (IndexedDB): 0 events
```

事件被成功删除（查询返回 0），但未能验证 `deletedAt` 字段。

## 🔍 根本原因分析

可能的原因包括：

1. **StorageManager 未实现软删除**:
   - `deleteEvent()` 方法可能直接从数据库中删除记录
   - 没有更新 `deletedAt` 字段，而是彻底删除

2. **EventService 与 StorageManager 实现不一致**:
   - `EventService.deleteEvent()` 正确设置了 `deletedAt`（日志显示 soft-delete）
   - 但 `StorageManager.deleteEvent()` 可能没有同步此逻辑

3. **查询过滤了已删除事件**:
   - 默认查询可能过滤 `deletedAt != null` 的记录
   - 需要特殊查询参数来获取已删除事件

## 💡 建议解决方案

### 方案 1: StorageManager 实现真正的软删除（推荐）

```typescript
// src/services/StorageManager.ts

async deleteEvent(eventId: string): Promise<void> {
  console.log('[StorageManager] Soft-deleting event:', eventId);
  
  // 不要真删除，而是更新 deletedAt 字段
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
  
  await this.updateEvent(eventId, {
    deletedAt: now,
    updatedAt: now
  });
  
  console.log('[StorageManager] ✅ Event soft-deleted:', eventId);
  
  // 从缓存中移除（可选）
  this.cache.delete(eventId);
}

// 添加硬删除方法（真正删除）
async hardDeleteEvent(eventId: string): Promise<void> {
  console.log('[StorageManager] Hard-deleting event:', eventId);
  
  // IndexedDB
  const tx = this.db.transaction(['events'], 'readwrite');
  const store = tx.objectStore('events');
  await store.delete(eventId);
  
  // SQLite (如果存在)
  if (this.sqlite) {
    await this.sqlite.run('DELETE FROM events WHERE id = ?', [eventId]);
  }
  
  // 清除缓存
  this.cache.delete(eventId);
  
  console.log('[StorageManager] ✅ Event hard-deleted:', eventId);
}
```

### 方案 2: 查询支持包含已删除事件

```typescript
// src/services/StorageManager.ts

interface QueryOptions {
  filters?: {
    eventIds?: string[];
    startTime?: string;
    endTime?: string;
    includeDeleted?: boolean;  // 新增：是否包含已删除事件
  };
  limit?: number;
}

async queryEvents(options: QueryOptions = {}): Promise<Event[]> {
  const { filters = {}, limit } = options;
  const { includeDeleted = false } = filters;  // 默认不包含已删除
  
  let events = await this.queryFromIndexedDB(filters);
  
  // 过滤已删除事件（除非明确要求包含）
  if (!includeDeleted) {
    events = events.filter(e => !e.deletedAt);
  }
  
  return limit ? events.slice(0, limit) : events;
}

// 测试中使用
const deletedEvent = await storageManager.queryEvents({
  filters: { 
    eventIds: [testEventId],
    includeDeleted: true  // 明确要求包含已删除事件
  },
  limit: 1
});
```

### 方案 3: 添加专门的已删除事件查询方法

```typescript
// src/services/StorageManager.ts

async getDeletedEvents(options?: {
  startDate?: string;
  endDate?: string;
  limit?: number;
}): Promise<Event[]> {
  console.log('[StorageManager] Querying deleted events');
  
  // 查询所有有 deletedAt 字段的事件
  const tx = this.db.transaction(['events'], 'readonly');
  const store = tx.objectStore('events');
  const allEvents = await store.getAll();
  
  let deletedEvents = allEvents.filter(e => e.deletedAt != null);
  
  // 按删除时间范围过滤
  if (options?.startDate) {
    deletedEvents = deletedEvents.filter(e => e.deletedAt >= options.startDate!);
  }
  if (options?.endDate) {
    deletedEvents = deletedEvents.filter(e => e.deletedAt <= options.endDate!);
  }
  
  // 排序（最近删除的在前）
  deletedEvents.sort((a, b) => b.deletedAt!.localeCompare(a.deletedAt!));
  
  // 限制数量
  if (options?.limit) {
    deletedEvents = deletedEvents.slice(0, options.limit);
  }
  
  console.log(`[StorageManager] Found ${deletedEvents.length} deleted events`);
  return deletedEvents;
}

// 恢复已删除事件
async restoreEvent(eventId: string): Promise<void> {
  console.log('[StorageManager] Restoring event:', eventId);
  
  await this.updateEvent(eventId, {
    deletedAt: null,  // 清除 deletedAt
    updatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
  });
  
  console.log('[StorageManager] ✅ Event restored:', eventId);
}
```

## 📝 实施步骤

- [ ] 1. 修改 `StorageManager.deleteEvent()` 改为软删除（设置 `deletedAt`）
- [ ] 2. 添加 `StorageManager.hardDeleteEvent()` 方法用于真正删除
- [ ] 3. 修改 `queryEvents()` 默认过滤已删除事件
- [ ] 4. 添加 `includeDeleted` 查询选项
- [ ] 5. 添加 `getDeletedEvents()` 方法查询回收站
- [ ] 6. 添加 `restoreEvent()` 方法恢复事件
- [ ] 7. 更新测试以使用 `includeDeleted: true` 查询已删除事件
- [ ] 8. 验证所有删除相关测试通过

## 🎯 验收标准

- ✅ Section 1.5 "软删除验证" 测试通过
- ✅ 删除事件后，`deletedAt` 字段被正确设置
- ✅ 默认查询不返回已删除事件
- ✅ 使用 `includeDeleted: true` 可以查询已删除事件
- ✅ `restoreEvent()` 可以恢复已删除事件
- ✅ 测试通过率提升至 97% (36/37)

## 📊 影响评估

**功能影响**: 🟡 中  
- 影响删除逻辑和回收站功能
- 需要同步更新 EventService 和 StorageManager

**数据影响**: 🟢 低  
- 现有数据不受影响
- 新删除的事件会正确设置 `deletedAt`

**风险等级**: 🟡 中  
- 需要测试删除和查询的边界情况
- 确保不会误删数据

**优先级建议**: 中-高  
- 回收站是常见功能需求
- 防止用户误删数据
- 建议在下个迭代实现

## 🔗 相关资源

- 测试文件: `public/test-data-flow-v3.js` (Section 1.5, lines 231-242)
- 相关代码: `src/services/StorageManager.ts` (deleteEvent 方法)
- 相关代码: `src/services/EventService.ts` (deleteEvent 已正确实现软删除)
- 相关日志: EventService 显示 `🗑️ Soft-deleting event`

## 🎨 UI 建议（可选）

实现此功能后，可以添加：

1. **回收站视图**:
   - 显示最近 30 天内删除的事件
   - 提供"恢复"和"永久删除"按钮

2. **自动清理**:
   - 30 天后自动硬删除
   - 或提供手动"清空回收站"按钮

3. **删除确认**:
   - 重要事件删除时显示确认对话框
   - 提示"可在回收站中恢复"

## 📌 备注

- `EventService.deleteEvent()` 已正确实现软删除（日志证实）
- 问题出在 `StorageManager` 层，需要保持一致性
- 当前通过率 94.59%，此问题不影响核心功能
- 建议与 Issue #001 (LRU 缓存) 一同处理
- 实现后可以提供更好的用户体验（撤销删除）
