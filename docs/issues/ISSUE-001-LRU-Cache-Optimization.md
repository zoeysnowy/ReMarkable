# Issue #001: LRU Cache 命中率优化

## 📋 问题描述

**状态**: 🟡 待处理  
**优先级**: 中  
**类型**: 性能优化  
**创建日期**: 2025-12-04

### 问题概述

在存储层测试中发现，LRU 缓存在连续读取同一事件时未能命中缓存，导致性能测试失败。

### 测试失败详情

**测试位置**: `public/test-data-flow-v3.js` Section 1.3  
**测试名称**: LRU Cache 验证  
**失败信息**: 
```
❌ LRU Cache 命中 {cached: false}
```

### 复现步骤

1. 创建一个事件并保存到 StorageManager
2. 第一次调用 `getEventById(eventId)` - 从 IndexedDB 读取
3. 第二次调用 `getEventById(eventId)` - **预期**从缓存读取
4. **实际结果**: 第二次调用仍然查询 IndexedDB，缓存未命中

### 相关日志

```
StorageManager.ts:217 [StorageManager] Querying events: {filters: {…}}
StorageManager.ts:242 [StorageManager] ✅ Query complete (IndexedDB): 1 events
```

连续两次查询都显示 "Query complete (IndexedDB)"，说明缓存未生效。

## 🔍 根本原因分析

可能的原因包括：

1. **缓存键不匹配**: 
   - 存入缓存时使用的键与读取时使用的键不一致
   - 可能涉及 ID 格式转换（例如：`event_xxx` vs `xxx`）

2. **缓存失效策略过激**:
   - 某些更新操作可能过度清空了缓存
   - `EventHub.clearCache()` 调用时机不当

3. **缓存容量问题**:
   - LRU 缓存容量设置过小，导致频繁淘汰
   - 测试环境中有大量事件创建，可能超出缓存容量

4. **查询参数差异**:
   - 不同的查询参数（如 `limit`, `filters`）可能被视为不同的缓存键
   - 需要标准化查询参数来提高缓存命中率

## 💡 建议解决方案

### 方案 1: 标准化缓存键（推荐）

```typescript
// StorageManager.ts
private getCacheKey(id: string): string {
  // 确保 ID 格式一致（去除或添加 event_ 前缀）
  return id.startsWith('event_') ? id : `event_${id}`;
}

async getEventById(id: string): Promise<Event | null> {
  const cacheKey = this.getCacheKey(id);
  
  // 先查缓存
  if (this.cache.has(cacheKey)) {
    console.log('[StorageManager] 🎯 Cache hit:', cacheKey);
    return this.cache.get(cacheKey);
  }
  
  // 查询数据库
  const event = await this.queryFromDB(id);
  
  // 存入缓存
  if (event) {
    this.cache.set(cacheKey, event);
  }
  
  return event;
}
```

### 方案 2: 增强缓存日志

添加详细的缓存命中/未命中日志，便于调试：

```typescript
async getEventById(id: string): Promise<Event | null> {
  const startTime = performance.now();
  
  if (this.cache.has(id)) {
    const duration = performance.now() - startTime;
    console.log(`[StorageManager] 🎯 Cache HIT: ${id} (${duration.toFixed(2)}ms)`);
    return this.cache.get(id);
  }
  
  console.log(`[StorageManager] ❌ Cache MISS: ${id}`);
  const event = await this.queryFromDB(id);
  
  if (event) {
    this.cache.set(id, event);
    console.log(`[StorageManager] 💾 Cached: ${id}`);
  }
  
  return event;
}
```

### 方案 3: 调整缓存失效策略

```typescript
// EventHub.ts
async updateFields(eventId: string, updates: Partial<Event>): Promise<void> {
  // 更新数据库
  await this.storageManager.updateEvent(eventId, updates);
  
  // ❌ 不要清空整个缓存
  // this.clearCache();
  
  // ✅ 只失效当前事件的缓存
  this.storageManager.cache.delete(eventId);
  
  // 重新获取并缓存最新数据
  await this.storageManager.getEventById(eventId);
}
```

## 📝 实施步骤

- [ ] 1. 在 `StorageManager.ts` 中添加缓存命中/未命中日志
- [ ] 2. 运行测试，记录缓存键的实际值
- [ ] 3. 对比存入和读取时的缓存键，确认是否一致
- [ ] 4. 实现缓存键标准化（如果需要）
- [ ] 5. 审查所有调用 `clearCache()` 的位置，改为精确失效
- [ ] 6. 重新运行测试，验证缓存命中率提升
- [ ] 7. 添加单元测试覆盖缓存逻辑

## 🎯 验收标准

- ✅ Section 1.3 "LRU Cache 验证" 测试通过
- ✅ 连续两次 `getEventById()` 调用，第二次从缓存返回
- ✅ 缓存命中日志显示 `🎯 Cache HIT`
- ✅ 测试通过率提升至 97% (36/37)

## 📊 影响评估

**性能影响**: 🟢 低  
- 缓存未命中时会多一次 IndexedDB 查询
- 对正常功能无影响，仅影响性能优化

**风险等级**: 🟢 低  
- 修改仅涉及缓存逻辑，不影响数据持久化

**优先级建议**: 中  
- 不阻塞核心功能
- 对高频读取场景有性能提升
- 建议在性能优化阶段处理

## 🔗 相关资源

- 测试文件: `public/test-data-flow-v3.js` (Section 1.3, lines 218-224)
- 相关代码: `src/services/StorageManager.ts`
- 相关代码: `src/features/events/EventHub.ts`

## 📌 备注

- 当前通过率 94.59%，此问题不影响核心功能
- 可与 Issue #002 (软删除字段) 一同处理
- 建议在完成核心功能开发后，统一进行性能优化
