# Outlook 同步架构修复测试指南

> **修复目标**: 减少不必要的 eventsUpdated 事件，从 1016 个降至接近 0（只更新真正有变化的事件）
> **修复日期**: 2025-11-28
> **影响范围**: ActionBasedSyncManager.syncPendingRemoteActions

---

## 🔧 修复内容

### 问题诊断

**架构违规**:
- ❌ ActionBasedSyncManager 直接操作 localStorage，绕过 EventService
- ❌ 手动触发 1016 个 eventsUpdated 事件，导致性能问题
- ❌ 无变化检测，每次同步都触发更新

**用户影响**:
- UpcomingEventsPanel 每 20 秒刷新 1016 次
- PlanSlate 每 20 秒检查 1016 个事件节点
- 浏览器卡顿，资源浪费

### 解决方案

**架构修复**:
1. ✅ UPDATE 操作通过 `EventService.updateEvent()` 统一架构
2. ✅ **先比较再更新**: 检测 title/time/description 变化
3. ✅ 无变化则跳过，不触发 eventsUpdated
4. ✅ EventService 自动触发单个 eventsUpdated（带 isUpdate 标记）

**保留旧逻辑**:
- CREATE/DELETE 操作暂时保留旧逻辑（待后续重构）

---

## 📊 预期效果

### 修复前

```
📡 [SyncRemote] Dispatching 1016 eventsUpdated events
🔧 [PERFORMANCE DEBUG] Operations: 0 create, 1016 update, 0 delete

// ❌ 所有事件都触发更新，即使没有变化
```

### 修复后

```
⏭️ [Sync] 跳过无变化: ...8263220  // 大部分事件
⏭️ [Sync] 跳过无变化: ...8248583
⏭️ [Sync] 跳过无变化: ...1787803
🔄 [Sync] 变化 ...R3O3AAA: {       // 只有少数事件有变化
  title: '"旧标题" → "新标题"',
  time: '-',
  desc: '50 → 120 chars'
}

✅ [SyncRemote] Completed: 5 updated, 1011 skipped (no changes), 0 failed

// ✅ 只触发 5 个 eventsUpdated，性能提升 99.5%
```

---

## 🧪 测试步骤

### 1. 硬刷新页面

```
Ctrl + Shift + R  （清除缓存并重新加载）
```

确保浏览器使用最新编译的代码。

### 2. 观察首次同步

打开控制台（F12），查看日志：

```javascript
// 应该看到：
✅ [SyncRemote] Completed: X updated, Y skipped (no changes), 0 failed
```

**预期结果**:
- `skipped` 数量接近总数（例如 1011/1016）
- `updated` 数量很少（例如 5/1016）

### 3. 修改 Outlook 事件

1. 在 Outlook 中修改一个事件的标题
2. 等待 20 秒（下一次同步周期）
3. 查看控制台日志

**预期结果**:
```
🔄 [Sync] 变化 ...ABC123: {
  title: '"旧标题" → "新标题"',
  time: '-',
  desc: '-'
}

✅ [SyncRemote] Completed: 1 updated, 1015 skipped, 0 failed
```

### 4. 验证 UI 更新

**UpcomingEventsPanel**:
- 应该只看到 1-5 条 `[UpcomingEventsPanel] 收到 eventsUpdated 事件` 日志
- 不再是 1016 条

**PlanSlate**:
- 应该只看到 1-5 条 `[📡 eventsUpdated] 收到事件` 日志
- 不再是 1016 条

### 5. 性能对比

**修复前**:
- 每 20 秒处理 1016 个事件
- UpcomingEventsPanel 刷新 1016 次
- PlanSlate 查找节点 1016 次

**修复后**:
- 每 20 秒处理 5-10 个事件（实际有变化的）
- UpcomingEventsPanel 刷新 5-10 次
- PlanSlate 查找节点 5-10 次

**性能提升**: 约 **99%**

---

## 🔍 调试日志解读

### 正常日志

```
⏭️ [Sync] 跳过无变化: ...8263220
⏭️ [Sync] 跳过无变化: ...8248583
⏭️ [Sync] 跳过无变化: ...1787803
⏭️ [Sync] 跳过无变化: ...R3O3AAA
⏭️ [Sync] 跳过无变化: ...35139807

✅ [SyncRemote] Completed: 0 updated, 1016 skipped (no changes), 0 failed
```

👉 **含义**: 所有事件都没有变化，完美！

### 部分更新日志

```
🔄 [Sync] 变化 ...R3O3AAA: {
  title: '"Meeting" → "Important Meeting"',
  time: '-',
  desc: '50 → 120 chars'
}
🔄 [Sync] 变化 ...ABC123: {
  title: '-',
  time: '2025-11-28T10:00:00 → 2025-11-28T11:00:00',
  desc: '-'
}

✅ [SyncRemote] Completed: 2 updated, 1014 skipped (no changes), 0 failed
```

👉 **含义**: 2 个事件有变化，1014 个跳过，符合预期。

### 异常日志

```
⚠️ [SyncRemote] Event not found: outlook-ABC123...
❌ [SyncRemote] Update failed: Error: ...

✅ [SyncRemote] Completed: 100 updated, 900 skipped, 16 failed
```

👉 **含义**: 有失败的更新，需要检查错误详情。

---

## 📝 代码变更摘要

### 修改文件

`src/services/ActionBasedSyncManager.ts`

### 关键变更

#### 1. 分离 update 和 create/delete 操作

```typescript
// ✅ UPDATE 通过 EventService（带变化检测）
const updateActions = pendingRemoteActions.filter(a => a.type === 'update');
const otherActions = pendingRemoteActions.filter(a => a.type !== 'update');
```

#### 2. 变化检测逻辑

```typescript
// 检测 title, time, description 三个字段
const titleChanged = remoteTitle !== localTitle;
const timeChanged = remoteStart !== localEvent.startTime || remoteEnd !== localEvent.endTime;
const descriptionChanged = cleanDescription !== localEvent.description;

if (!titleChanged && !timeChanged && !descriptionChanged) {
  // 跳过，不调用 EventService
  skippedCount++;
  continue;
}
```

#### 3. 通过 EventService 更新

```typescript
// ✅ 统一架构
await EventService.updateEvent(localEvent.id, updates, true);
// skipSync=true 避免回写 Outlook
```

#### 4. 移除手动触发 eventsUpdated

```diff
- // ❌ 手动触发 1016 个事件
- window.dispatchEvent(new CustomEvent('eventsUpdated', { detail }));

+ // ✅ EventService 自动触发（只触发有变化的）
```

---

## ⚠️ 已知限制

1. **CREATE/DELETE 操作未重构**
   - 仍使用旧逻辑（直接操作 localStorage）
   - 后续需要重构为通过 EventService

2. **只检测 3 个字段**
   - title, startTime, endTime, description
   - location, isAllDay 等字段变化会被检测到并更新
   - 但不会单独显示在日志里

3. **首次同步可能有更多更新**
   - 如果本地数据格式不一致（例如 title 是字符串而非对象）
   - 首次同步会全部更新以规范化数据

---

## 🚀 后续优化方向

1. **重构 CREATE 操作**
   ```typescript
   await EventService.createEvent(newEvent, skipSync=true);
   ```

2. **重构 DELETE 操作**
   ```typescript
   await EventService.deleteEvent(eventId, { skipSync: true });
   ```

3. **批量更新 API**
   ```typescript
   // 一次调用更新多个事件
   await EventService.batchUpdate(updates);
   ```

4. **更精细的变化检测**
   - 检测更多字段（location, attendees, etc.）
   - 智能合并（例如只更新变化的字段）

---

## 📚 相关文档

- [EventHub & TimeHub Architecture](docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md)
- [ActionBasedSyncManager PRD](docs/PRD/ACTIONBASEDSYNCMANAGER_PRD.md)
- [Plan Page Data Issues Diagnosis](PLAN_PAGE_DATA_ISSUES_DIAGNOSIS.md)

---

**测试完成后请反馈**:
1. skipped 数量是否接近总数？
2. UpcomingEventsPanel 刷新次数是否大幅减少？
3. 页面性能是否有明显改善？
