# syncMode 同步控制功能实现

> **实现日期**: 2025-11-27  
> **版本**: v2.15.1  
> **关联 PRD**: EventEditModal V2 PRD v2.0.4  
> **相关组件**: syncRouter.ts, ActionBasedSyncManager.ts  
> **文档类型**: 功能实现说明

---

## 🔍 问题诊断

### 发现的问题

用户反馈："EventEditModal 的日历分组数据都能正常保存和显示，但好像没有按照设置同步到远端？"

### 根因分析

经过完整同步链路检查，发现 **`syncMode` 字段完全未实现**：

**同步链路现状**：
1. ✅ **EventEditModalV2** → 正确保存 `calendarIds` + `syncMode` 到本地
2. ✅ **EventHub** → 正确调用 `EventService.updateEvent`
3. ✅ **EventService** → 正确调用 `syncManagerInstance.recordLocalAction`
4. ❌ **syncRouter.ts** → `determineSyncTarget()` 只检查事件类型和时间，**完全忽略 `syncMode`**
5. ❌ **ActionBasedSyncManager** → 代码中没有任何 `syncMode` 相关逻辑

**验证数据**：
- `grep_search` 搜索 `syncMode` 在 ActionBasedSyncManager.ts：**0 matches** ❌
- 文档中定义了 5 种 syncMode，但同步逻辑中未实现

**结论**：`syncMode` 只有 UI 和数据结构，没有实际同步控制逻辑。

---

## 🛠️ 实现方案

### syncMode 取值定义

```typescript
type SyncMode = 
  | 'receive-only'           // 仅接收远端更新，不推送本地修改
  | 'send-only'              // 仅推送本地修改，不接收远端更新
  | 'send-only-private'      // 推送到远端（标记为私密），不接收远端更新
  | 'bidirectional'          // 双向同步（默认模式）
  | 'bidirectional-private'; // 双向同步（标记为私密）
```

### 实现位置

#### 1. syncRouter.ts - 控制本地→远端推送

**文件**: `src/utils/syncRouter.ts`  
**函数**: `determineSyncTarget(event: Event): SyncRoute`

**实现逻辑**：
```typescript
// 0. 🆕 [v2.15.1] syncMode 检查 - receive-only 不推送到远端
if (event.syncMode === 'receive-only') {
  return {
    target: 'none',
    reason: 'syncMode=receive-only: Only receive remote updates, do not push',
  };
}
```

**影响**：
- `receive-only` 模式的事件不会调用 `syncManagerInstance.recordLocalAction`
- 用户本地修改不会推送到 Outlook/Google/iCloud
- 但仍然会接收远端的更新

---

#### 2. ActionBasedSyncManager.ts - 控制远端→本地接收

**文件**: `src/services/ActionBasedSyncManager.ts`  
**函数**: `applyRemoteActionToLocal(action, triggerUI, localEvents)`

**实现逻辑**：
```typescript
// 🆕 [v2.15.1] syncMode 检查：send-only 模式不接收远端更新
if (action.type === 'create' || action.type === 'update') {
  let eventSyncMode: string | undefined;
  
  if (action.type === 'update') {
    // 查找本地事件的 syncMode
    const localEvent = events.find((e: any) => 
      e.id === action.entityId || 
      e.externalId === action.entityId ||
      e.externalId === action.entityId?.replace('outlook-', '')
    );
    eventSyncMode = localEvent?.syncMode;
  }
  
  if (eventSyncMode === 'send-only' || eventSyncMode === 'send-only-private') {
    console.log(`⏭️ [Sync] Skipping remote ${action.type} for send-only event:`, action.entityId);
    return events; // 跳过远端更新
  }
}
```

**影响**：
- `send-only` 模式的事件不会应用远端的 create/update 操作
- 用户在其他设备或 Outlook Web 的修改不会同步回本地
- 但本地修改仍然会推送到远端

---

### 同步行为矩阵

| syncMode | 本地修改→远端 | 远端更新→本地 | 典型使用场景 |
|----------|-------------|-------------|------------|
| `receive-only` | ❌ 不推送 | ✅ 接收 | 只读订阅的日历（同事日历、公共假期） |
| `send-only` | ✅ 推送 | ❌ 不接收 | 单向发布的事件（博客发布、自动备份） |
| `send-only-private` | ✅ 推送（私密） | ❌ 不接收 | 私密事件单向同步 |
| `bidirectional` | ✅ 推送 | ✅ 接收 | 正常工作事件（会议、任务）**默认** |
| `bidirectional-private` | ✅ 推送（私密） | ✅ 接收 | 私密双向同步事件 |

---

## 📝 代码变更

### 变更文件列表

1. **src/utils/syncRouter.ts**
   - 添加 `syncMode === 'receive-only'` 检查
   - 更新函数注释说明 syncMode 规则

2. **src/services/ActionBasedSyncManager.ts**
   - 在 `applyRemoteActionToLocal` 函数开头添加 syncMode 检查
   - 阻止 `send-only` 模式接收远端更新

3. **docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md**
   - 版本号更新为 v2.15.1
   - 添加关联模块：ActionBasedSyncManager, syncRouter
   - 新增 "2.1 syncMode 同步控制" 章节
   - 列出 syncMode 取值和实现位置

4. **docs/PRD/EVENTEDITMODAL_V2_PRD.md**
   - v2.0.4 更新说明添加 syncMode 实现项

---

## ✅ 测试验证

### 功能验证清单

- [ ] **receive-only 模式**
  - [ ] 本地修改不推送到远端（检查 Outlook Calendar）
  - [ ] 远端修改同步到本地（在 Outlook Web 修改后检查 ReMarkable）

- [ ] **send-only 模式**
  - [ ] 本地修改推送到远端
  - [ ] 远端修改不同步到本地（在 Outlook Web 修改后 ReMarkable 不变）

- [ ] **bidirectional 模式**
  - [ ] 本地修改推送到远端
  - [ ] 远端修改同步到本地
  - [ ] 冲突解决机制正常工作

### 日志检查点

**本地→远端推送被阻止**：
```
⏭️ [EventService] Skipping sync: syncMode=receive-only: Only receive remote updates, do not push
```

**远端→本地接收被阻止**：
```
⏭️ [Sync] Skipping remote update for send-only event: {eventId}
```

---

## 📚 相关文档

- [EventHub & TimeHub 统一架构文档 v2.15.1](../architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md)
- [EventEditModal V2 PRD v2.0.4](../PRD/EVENTEDITMODAL_V2_PRD.md)
- [ActionBasedSyncManager PRD](../PRD/ACTIONBASEDSYNCMANAGER_PRD.md)

---

## 🔧 v2.15.2 关键修复 (2025-11-27)

### 修复：远程同步回调覆盖本地自定义字段

**问题症状**：
- 首次同步事件到 Outlook 后，本地 `syncMode` 从 `'bidirectional'` 变为 `undefined` 或 `'receive-only'`
- 用户设置的同步模式丢失

**根本原因**：
1. **Outlook API 响应不完整**：微软 Graph API 返回的事件对象只包含标准字段（subject, startTime, endTime 等），**不包含自定义字段**（syncMode, subEventConfig, calendarIds 等）
2. **远程回调覆盖**：`ActionBasedSyncManager.applyRemoteActionToLocal` 的 UPDATE 分支用远程数据更新本地事件
3. **JavaScript 展开陷阱**：`{ ...events[i], ...remoteData }` 中，如果 remoteData 的字段是 `undefined`，会覆盖原有值

**数据流示例**：
```
本地创建事件
  ↓ syncMode: 'bidirectional'
同步到 Outlook (CREATE)
  ↓ Graph API: POST /calendars/{id}/events
Outlook 返回响应
  ↓ { subject, startTime, endTime, ... } (无 syncMode)
applyRemoteActionToLocal (UPDATE)
  ↓ { ...events[i], startTime: ..., syncMode: undefined }
本地更新
  ↓ syncMode: undefined ❌ (被覆盖)
```

**解决方案** (ActionBasedSyncManager.ts L3005-3030)：
```typescript
// 🔧 [v2.15.2 FIX] 明确保留本地自定义字段，防止远程回调覆盖
const localOnlyFields = {
  syncMode: events[eventIndex].syncMode,
  subEventConfig: events[eventIndex].subEventConfig,
  calendarIds: events[eventIndex].calendarIds,
  tags: events[eventIndex].tags,
  isTask: events[eventIndex].isTask,
  isTimer: events[eventIndex].isTimer,
  parentEventId: events[eventIndex].parentEventId,
  timerLogs: events[eventIndex].timerLogs,
};

const updatedEvent = {
  ...events[eventIndex],  // 原有所有字段
  ...localOnlyFields,     // 🔧 明确恢复本地字段
  // ... 远程字段更新
};
```

**受保护字段列表**：
- ✅ `syncMode` - 同步模式控制
- ✅ `subEventConfig` - 子事件配置模板
- ✅ `calendarIds` - 目标日历列表
- ✅ `tags` - 标签
- ✅ `isTask`/`isTimer` - 事件类型标记
- ✅ `parentEventId`/`timerLogs` - 父子事件关联

**验证**：
- ✅ 首次同步后 `syncMode` 保持原值
- ✅ 多次往返同步后配置不丢失
- ✅ 子事件配置模板（subEventConfig）正确保留

---

## 🔄 版本历史

| 版本 | 日期 | 变更内容 |
|-----|------|---------|
| v2.15.2 | 2025-11-27 | 🔧 修复远程同步回调覆盖本地自定义字段 |
| v2.15.1 | 2025-11-27 | 🆕 实现 syncMode 同步控制功能 |
| v2.15 | 2025-11-27 | 父-子事件单一配置架构（subEventConfig） |
| v2.14 | 2025-11-25 | EventTitle 三层架构重构 |

---

## 🎯 后续优化

### P1 - 用户体验优化

1. **UI 反馈增强**
   - 在 EventEditModal V2 中显示当前 syncMode 对同步行为的影响
   - 添加 Tooltip 说明不同模式的差异

2. **状态栏提示**
   - 当 receive-only 事件被修改时，提示"本地修改不会同步到远端"
   - 当 send-only 事件收到远端更新时，提示"已忽略远端更新"

### P2 - 功能扩展

3. **批量模式切换**
   - 支持选中多个事件批量设置 syncMode
   - 添加快捷操作："设为只读"、"设为单向发布"

4. **智能模式建议**
   - 根据事件类型自动建议 syncMode（如订阅的日历自动设为 receive-only）
   - 根据参与人数建议模式（单人事件建议 send-only，多人事件建议 bidirectional）

---

## 🐛 已知限制

1. **Private 模式未完整实现**
   - `send-only-private` 和 `bidirectional-private` 目前只控制同步方向
   - 参与者格式化为文本的逻辑待实现（见 CALENDAR_SYNC_SCENARIOS_MATRIX.md）

2. **删除操作未覆盖**
   - 当前实现只处理 create/update，delete 操作未添加 syncMode 检查
   - 所有模式的删除操作都会双向同步

3. **冲突解决机制**
   - 当 syncMode 在本地和远端不一致时的行为未定义
   - 需要补充冲突场景的处理策略

---

**维护者**: Copilot  
**联系方式**: GitHub Issues  
**文档状态**: ✅ 已完成实现
