# 事件消失问题修复总结

## 问题描述
用户报告在 Electron 环境的 TimeCalendar 中，events 会莫名整屏消失，然后重新同步进来。

## 根本原因分析

### 问题根源
在 `ActionBasedSyncManager` 的同步流程中，删除检测逻辑可能会误判本地事件为"远程已删除"，导致：

1. **删除检测阶段** (`fetchRemoteChanges`)
   - 对比本地事件和远程事件
   - 如果本地事件在同步时间窗口内，但远程没有找到，就标记为"远程删除"
   - 创建 delete action 并加入 actionQueue

2. **批量删除执行** (`syncPendingRemoteActions`)
   - 批量处理所有 remote actions
   - 从 localStorage 中删除这些事件
   - 批量保存后触发 `local-events-changed` 事件

3. **UI 短暂空白**
   - TimeCalendar 监听 `local-events-changed`
   - 重新从 localStorage 加载 events
   - 如果删除的事件较多，会看到短暂的"整屏消失"

4. **事件重新出现**
   - 下一次同步时，远程事件重新同步回来
   - 事件重新出现在界面上

### 误判的可能原因
1. **网络延迟**：刚更新的事件，远程 API 还没返回最新数据
2. **同步竞态**：本地更新和远程同步几乎同时发生
3. **API 分页问题**：某些事件可能在不同的 API 响应页中
4. **时区问题**：事件时间判断可能存在边界误差

## 修复方案

### 1. 添加 "最近更新" 保护机制

在 `ActionBasedSyncManager` 中添加 `recentlyUpdatedEvents` Map：
```typescript
private recentlyUpdatedEvents: Map<string, number> = new Map();
```

**记录最近更新的事件**（在 `recordLocalAction` 中）:
```typescript
if (type === 'update' && entityType === 'event') {
  this.recentlyUpdatedEvents.set(entityId, Date.now());
  console.log(`📝 [RECORD] Marked event ${entityId} as recently updated`);
}
```

**删除检测时跳过最近更新的事件**（在 `fetchRemoteChanges` 中）:
```typescript
// 检查事件是否最近刚更新过
const recentlyUpdated = this.recentlyUpdatedEvents.has(localEvent.id);
const lastUpdateTime = this.recentlyUpdatedEvents.get(localEvent.id) || 0;
const timeSinceUpdate = Date.now() - lastUpdateTime;

// 如果事件在最近30秒内被更新过，不视为删除（可能是同步延迟）
if (recentlyUpdated && timeSinceUpdate < 30000) {
  console.log(`⏭️ [Sync] Skipping recently updated event from deletion: "${localEvent.title}" (updated ${Math.round(timeSinceUpdate/1000)}s ago)`);
  return;
}
```

### 2. 添加重复删除保护

**检查已删除列表**（在 `fetchRemoteChanges` 中）:
```typescript
// 再次确认：检查是否在已删除列表中（避免重复删除）
if (this.deletedEventIds.has(localEvent.id)) {
  console.log(`⏭️ [Sync] Event already marked as deleted, skipping: "${localEvent.title}"`);
  return;
}
```

### 3. 定期清理过期记录

**在每次同步开始时清理**（在 `performSync` 中）:
```typescript
// 清理过期的最近更新事件记录（超过60秒的）
const expireTime = Date.now() - 60000;
let cleanedCount = 0;
this.recentlyUpdatedEvents.forEach((timestamp, eventId) => {
  if (timestamp < expireTime) {
    this.recentlyUpdatedEvents.delete(eventId);
    cleanedCount++;
  }
});
if (cleanedCount > 0) {
  console.log(`🧹 [Sync] Cleaned ${cleanedCount} expired recently-updated event records`);
}
```

## 修复效果

### Before (修复前)
- ❌ 用户编辑事件后，可能在下次同步时被误删
- ❌ 事件整屏消失，用户体验差
- ❌ 需要等待下次同步才能看到事件

### After (修复后)
- ✅ 最近30秒内更新的事件不会被误判为删除
- ✅ 已删除的事件不会重复删除
- ✅ 过期记录自动清理，避免内存泄漏
- ✅ 更稳定的同步体验

## 保护时间窗口

| 保护类型 | 时间窗口 | 说明 |
|---------|---------|------|
| 最近更新保护 | 30秒 | 防止刚编辑的事件被误删 |
| 记录过期清理 | 60秒 | 清理过期的保护记录 |

## 测试建议

1. **编辑事件后立即同步**
   - 编辑一个事件
   - 立即触发同步
   - 验证事件不会消失

2. **网络延迟模拟**
   - 使用 Chrome DevTools 模拟慢速网络
   - 编辑事件并同步
   - 验证不会误删

3. **批量编辑测试**
   - 短时间内编辑多个事件
   - 触发同步
   - 验证所有事件都保留

4. **长时间运行测试**
   - 运行应用数小时
   - 定期编辑和同步
   - 验证内存不会持续增长（记录被正确清理）

## 监控日志

修复后会输出以下日志帮助诊断：

```
📝 [RECORD] Marked event {id} as recently updated
⏭️ [Sync] Skipping recently updated event from deletion: "{title}" (updated Xs ago)
⏭️ [Sync] Event already marked as deleted, skipping: "{title}"
🧹 [Sync] Cleaned X expired recently-updated event records
```

## 文件修改

- **src/services/ActionBasedSyncManager.ts**
  - 添加 `recentlyUpdatedEvents` Map
  - 修改 `recordLocalAction` 记录更新
  - 修改 `fetchRemoteChanges` 删除检测逻辑
  - 修改 `performSync` 添加清理逻辑

## 相关 Issue

这个修复解决了以下场景的问题：
- 编辑事件后立即同步导致事件消失
- 网络波动导致的误删
- 多设备同时编辑的竞态问题
- Electron 环境下的同步稳定性

## 后续优化建议

1. **增加删除确认机制**：在真正删除前，可以考虑二次确认
2. **同步状态可视化**：在 UI 中显示同步进度和状态
3. **离线队列优化**：改进离线时的操作队列管理
4. **冲突解决策略**：提供用户可配置的冲突解决选项
