# 同步机制补充文档

本文档是 `EventService-Architecture.md` 的补充，详细说明同步状态和多日历支持。

---

## 同步状态详解 (syncStatus)

### 状态机图

```
                    ┌──────────────┐
                    │ local-only   │ (Timer 运行中)
                    └───────┬──────┘
                            │ Timer Stop
                            ▼
┌─────────┐         ┌──────────────┐
│ pending │ ◄───────│ pending-update│ (历史状态)
└────┬────┘         └──────────────┘
     │
     │ 同步成功
     ▼
┌─────────┐
│ synced  │ (有 externalId)
└────┬────┘
     │
     │ 用户修改
     ▼
┌───────────────┐
│ pending-update│ ─────► 同步成功 ────► synced
└───────────────┘

     │ 同步失败
     ▼
┌─────────┐
│  error  │ (retryCount 超限)
└─────────┘
```

### 各状态详解

#### `'pending'`
- **含义**：新创建的事件，等待首次同步
- **设置时机**：
  - EventManager 创建新事件（line 375）
  - Timer 停止时（`local-only` → `pending`）
  - 用户在 TimeCalendar 拖拽创建事件
- **特征**：
  - `remarkableSource = true`
  - 没有 `externalId`
  - 在同步队列中（或应该在）

#### `'pending-update'`
- **含义**：已存在的事件被修改，等待同步更新
- **设置时机**：
  - ActionBasedSyncManager UPDATE 操作（line 1895）
  - 用户在 TimeCalendar 拖拽调整时间
- **历史原因**：最初想区分"新建"和"更新"，但增加了复杂度
- **建议**：未来可以统一为 `'pending'`
- **特征**：
  - 通常有 `externalId`（但也可能没有，如果之前同步失败）
  - 在同步队列中（或应该在）

#### `'synced'`
- **含义**：已成功同步到 Outlook
- **设置时机**：
  - 同步成功后 `updateLocalEventExternalId()` 设置
  - Outlook 导入的事件
- **特征**：
  - 有 `externalId`
  - `synchronized = true` in SyncAction

#### `'local-only'`
- **含义**：本地专属，不需要同步
- **设置时机**：
  - Timer 运行中（EventService.createEvent with skipSync=true）
- **特征**：
  - 没有 `externalId`
  - **不会被 `fixOrphanedPendingEvents()` 扫描**
  - Timer 停止后会转为 `'pending'`

#### `'error'`
- **含义**：同步失败，已超过重试次数
- **设置时机**：
  - SyncAction.retryCount 超过阈值
- **处理**：
  - 需要用户手动处理或等待下次 `fixOrphanedPendingEvents()` 修复

### 为什么有两个 pending 状态？

**历史原因**：
- 最初设计可能想区分"首次创建需要 POST"和"后续更新需要 PATCH"
- 便于调试时快速识别事件状态

**实际问题**：
- 增加了逻辑复杂度
- 导致 `fixOrphanedPendingEvents()` 最初只检查 `'pending'`，遗漏了 `'pending-update'`
- 两者在同步逻辑中没有本质区别（SyncAction.type 已经区分了 'create' vs 'update'）

**当前修复**（2025-10-30）：
- `fixOrphanedPendingEvents()` 现在同时支持两者
- 增加了更严格的过滤条件（calendarIds/tagId、local-only 排除）

**建议未来优化**：
- 统一为一个 `'pending'` 状态
- 通过 SyncAction.type 区分操作类型
- 减少状态机复杂度

---

## 多日历支持现状

### 问题：当前只能同步到一个日历

#### UI 层面（EventEditModal）

```typescript
// UI 支持多选
calendarIds: string[] = ['cal1', 'cal2', 'cal3']

// 自动收集标签的日历映射
const mappedCalendarIds = formData.tags
  .map(tagId => getTagById(tagId)?.calendarMapping?.calendarId)
  .filter(id => Boolean(id));

// 合并去重
const uniqueCalendarIds = Array.from(new Set([
  ...formData.calendarIds,
  ...mappedCalendarIds
]));
```

#### 数据层面（Event 对象）

```typescript
interface Event {
  calendarId?: string;       // 兼容字段（第一个日历）
  calendarIds?: string[];    // 多日历数组
  externalId?: string;       // ⚠️ 单值 - 这是限制所在
}
```

#### 同步层面（ActionBasedSyncManager）

```typescript
// CREATE 操作只同步到一个日历
syncTargetCalendarId = action.data.calendarId; // 取第一个

if (action.data.tagId) {
  // 如果有标签映射，覆盖为标签日历
  syncTargetCalendarId = this.getCalendarIdForTag(action.data.tagId);
}

// 最终只调用一次 syncEventToCalendar
await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId);
```

### 用户期望 vs 实际行为

#### 场景：选择 2 个标签 + 1 个日历

**用户操作**：
```
标签 A → 映射到日历 cal-A
标签 B → 映射到日历 cal-B
手动选择日历 cal-C
```

**UI 收集结果**：
```typescript
event.calendarIds = ['cal-A', 'cal-B', 'cal-C']
event.calendarId = 'cal-A' // 第一个
```

**同步结果**：
```
只会在 Outlook 的 cal-A 中创建 1 个事件
externalId = 'AAMkAD...'
```

**用户期望 vs 实际**：
| 期望 | 实际 |
|------|------|
| cal-A 有事件 | ✅ 有 |
| cal-B 有事件 | ❌ 没有 |
| cal-C 有事件 | ❌ 没有 |
| 本地有 1 个事件 | ✅ 是 |
| Outlook 有 3 个事件 | ❌ 只有 1 个 |

### 根本限制

#### 数据结构约束

```typescript
// 当前
interface Event {
  externalId?: string; // 单值 - 只能对应一个远程事件
}

// 如果要支持多日历
interface Event {
  externalIds?: {
    [calendarId: string]: string; // 每个日历对应一个 externalId
  };
}
```

#### 同步复杂度

**如果实现真正的多日历同步：**

1. **CREATE 操作**：
   ```typescript
   for (const calendarId of event.calendarIds) {
     const externalId = await syncEventToCalendar(event, calendarId);
     event.externalIds[calendarId] = externalId;
   }
   ```

2. **UPDATE 操作**：
   ```typescript
   // 需要更新所有关联日历
   for (const [calendarId, externalId] of Object.entries(event.externalIds)) {
     await updateCalendarEvent(calendarId, externalId, updates);
   }
   ```

3. **DELETE 操作**：
   ```typescript
   // 需要删除所有关联日历的事件
   for (const [calendarId, externalId] of Object.entries(event.externalIds)) {
     await deleteCalendarEvent(calendarId, externalId);
   }
   ```

4. **部分失败处理**：
   ```typescript
   // 如果 cal-A 同步成功，cal-B 失败
   event.externalIds = {
     'cal-A': 'AAMkAD...',
     'cal-B': null // 失败，需要重试
   };
   ```

5. **日历变更处理**：
   ```typescript
   // 用户编辑事件，去掉 cal-B，添加 cal-C
   // 需要删除 cal-B 的远程事件，创建 cal-C 的远程事件
   oldCalendarIds = ['cal-A', 'cal-B']
   newCalendarIds = ['cal-A', 'cal-C']
   
   toDelete = ['cal-B']
   toCreate = ['cal-C']
   toUpdate = ['cal-A']
   ```

### 建议方案

#### 短期（当前实现）

**在 UI 上明确说明限制**：

```tsx
<div className="calendar-selector">
  <label>同步到日历</label>
  <select>
    <option>选择日历</option>
  </select>
  <p className="hint">
    ⚠️ 当前仅支持同步到一个日历。
    如果选择了多个标签，将使用第一个标签的映射日历。
  </p>
</div>
```

**优化选择逻辑**：

```typescript
// 优先级：手动选择 > 第一个标签映射 > 默认日历
let targetCalendar = formData.calendarIds[0]; // 手动选择

if (!targetCalendar && formData.tags.length > 0) {
  const firstTag = getTagById(formData.tags[0]);
  targetCalendar = firstTag?.calendarMapping?.calendarId;
}

if (!targetCalendar) {
  targetCalendar = microsoftService.getSelectedCalendarId(); // 默认
}

// 只保存一个日历
event.calendarId = targetCalendar;
event.calendarIds = [targetCalendar]; // 保持一致
```

#### 长期（架构升级）

**如果要实现真正的多日历支持，建议：**

1. **独立立项**：作为 v2.0 功能单独开发
2. **修改数据结构**：
   - `Event.externalId` → `Event.externalIds: { [calendarId]: externalId }`
   - 数据库迁移脚本
3. **重构同步逻辑**：
   - `syncEventToCalendar()` 改为 `syncEventToCalendars()`
   - 循环处理每个 calendarId
   - 实现部分失败重试
4. **UI 改进**：
   - 显示每个日历的同步状态
   - 支持单独重试失败的日历
5. **性能优化**：
   - 并行同步多个日历（Promise.allSettled）
   - 批量 API 调用（如果 Microsoft Graph 支持）

**估计工作量**：
- 数据结构修改：2-3 天
- 同步逻辑重构：5-7 天
- UI 改造：3-4 天
- 测试和 bug 修复：5-7 天
- 总计：15-21 天

**优先级建议**：
- **中优先级**：当前单日历同步已满足基本需求
- **适合时机**：完成 TimeCalendar 迁移到 EventService 后再考虑

---

## fixOrphanedPendingEvents() 修复说明

### 修复前的问题

```typescript
// 修复前（2025-10-30 之前）
const pendingEvents = events.filter((event: any) => 
  (event.syncStatus === 'pending' || event.syncStatus === 'pending-update') && 
  event.remarkableSource === true &&
  !event.externalId // ❌ 问题：没有考虑 local-only 和 calendarIds
);
```

**问题**：
1. 没有 externalId ≠ 需要同步
2. 没有排除 `local-only` 事件（如运行中的 Timer）
3. 没有检查是否有同步目标（calendarIds 或 tagId）

### 修复后的逻辑

```typescript
// 修复后（2025-10-30）
const pendingEvents = events.filter((event: any) => {
  const needsSync = (event.syncStatus === 'pending' || event.syncStatus === 'pending-update') && 
                   event.syncStatus !== 'local-only' &&
                   event.remarkableSource === true &&
                   !event.externalId;
  
  if (!needsSync) return false;
  
  // 检查是否有目标日历
  const hasCalendars = (event.calendarIds && event.calendarIds.length > 0) || event.calendarId;
  const hasTag = event.tagId || (event.tags && event.tags.length > 0);
  
  // 有日历或有标签（标签可能有日历映射）才需要同步
  return hasCalendars || hasTag;
});
```

**改进**：
1. ✅ 排除 `syncStatus = 'local-only'` 的事件
2. ✅ 检查 `calendarIds` 或 `tagId`，确保有同步目标
3. ✅ 支持 `pending-update` 状态
4. ✅ 每次启动都检查（不再使用一次性迁移标记）

---

**文档创建时间**：2025-11-01  
**相关文档**：`EventService-Architecture.md`
