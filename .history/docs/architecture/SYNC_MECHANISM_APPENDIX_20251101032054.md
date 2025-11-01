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
                    ┌──────────────┐
                    │   pending    │ (统一的待同步状态)
                    └───────┬──────┘
                            │
                            │ 同步成功
                            ▼
                    ┌──────────────┐
                    │    synced    │ (有 externalId)
                    └───────┬──────┘
                            │
                            │ 用户修改
                            ▼
                    ┌──────────────┐
                    │   pending    │ (需要重新同步)
                    └───────┬──────┘
                            │
                            │ 同步失败（重试超限）
                            ▼
                    ┌──────────────┐
                    │    error     │
                    └──────────────┘
```

### 各状态详解

#### `'pending'`

**🔧 [2025-11-01 更新]** 统一的待同步状态，不再区分新建和更新

- **含义**：事件需要同步到远程（包括新建和更新）
- **设置时机**：
  - EventManager 创建新事件
  - Timer 停止时（`local-only` → `pending`）
  - 用户在 TimeCalendar 拖拽创建事件
  - **用户修改已同步的事件**（原 `pending-update` 场景）
- **特征**：
  - `remarkableSource = true`
  - 可能有或没有 `externalId`（新建没有，更新有）
  - 在同步队列中（或应该在）
  - SyncAction.type 区分 'create' vs 'update'

**为什么统一？**
- SyncAction.type 已经明确区分了操作类型（'create' | 'update'）
- 减少状态机复杂度
- 避免遗漏某个状态的处理（如之前 `fixOrphanedPendingEvents` 的问题）
- 更清晰的语义：pending = 需要同步，synced = 已同步

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

### 统一 pending 状态的变更说明

**变更日期**：2025-11-01

**变更内容**：
- ❌ 移除 `'pending-update'` 状态
- ✅ 统一使用 `'pending'` 表示所有待同步场景
- ✅ 通过 `SyncAction.type` 区分操作类型

**影响范围**：
- `src/types.ts` - Event.syncStatus 类型定义
- `src/services/ActionBasedSyncManager.ts` - UPDATE 操作设置状态
- `src/services/ActionBasedSyncManager.ts` - fixOrphanedPendingEvents 过滤条件

**向后兼容**：
- 老数据中的 `'pending-update'` 在迁移时自动转换为 `'pending'`
- 不影响已同步的事件（`'synced'` 状态）

**优势**：
1. **简化状态机**：从 5 个状态减少到 4 个
2. **统一语义**：pending = 需要同步，synced = 已同步
3. **减少遗漏**：不需要在每个地方都检查两个状态
4. **明确职责**：状态表示"是否需要同步"，类型表示"如何同步"

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
