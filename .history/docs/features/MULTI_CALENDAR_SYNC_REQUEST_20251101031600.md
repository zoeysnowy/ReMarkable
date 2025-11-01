# 多日历同步支持 - 需求文档 (v2.0)

**文档版本**：v1.0  
**创建日期**：2025-11-01  
**预计开始日期**：2025-11-02  
**预计完成日期**：2025-11-21（15-21 个工作日）  
**优先级**：中  
**状态**：待开始

---

## 📋 需求概述

### 背景

当前系统的事件同步机制存在以下限制：

1. **单日历限制**：一个本地事件只能同步到一个 Outlook 日历
2. **数据结构约束**：`Event.externalId` 是单值，无法映射多个远程事件
3. **用户期望不匹配**：
   - 用户在 EventEditModal 中可以选择多个标签（每个标签映射到不同日历）
   - 用户可以手动选择多个日历
   - 但最终只有第一个日历会实际同步

### 目标

实现真正的多日历同步功能，使一个本地事件能够同步到多个 Outlook 日历，每个日历中都有独立的远程事件副本。

### 价值

1. **满足用户需求**：支持将同一事件同步到多个工作场景的日历（如：工作日历 + 个人日历 + 团队共享日历）
2. **提升数据一致性**：明确表达"一个本地事件 → 多个远程副本"的映射关系
3. **增强灵活性**：用户可以根据标签自动分配到多个日历，或手动选择多个同步目标

---

## 🎯 功能需求

### 1. 数据结构升级

#### 1.1 Event 类型定义修改

**文件**：`src/types.ts`

**当前**：
```typescript
export interface Event {
  externalId?: string; // 单值
  calendarId?: string; // 第一个日历（兼容字段）
  calendarIds?: string[]; // 多日历数组（仅 UI 层面）
  syncStatus?: 'pending' | 'synced' | 'error' | 'local-only';
}
```

**目标**：
```typescript
export interface Event {
  externalId?: string; // ⚠️ 保留用于向后兼容，值为 externalIds 中的第一个
  externalIds?: { [calendarId: string]: string | null }; // 🆕 多日历映射
  calendarId?: string; // ⚠️ 保留用于向后兼容，值为 calendarIds[0]
  calendarIds?: string[]; // 多日历数组（实际生效）
  syncStatus?: 'pending' | 'synced' | 'error' | 'local-only';
  syncStatusByCalendar?: { [calendarId: string]: 'pending' | 'synced' | 'error' }; // 🆕 每个日历的同步状态
  lastSyncTimeByCalendar?: { [calendarId: string]: string }; // 🆕 每个日历的最后同步时间
}
```

**兼容性说明**：
- `externalId` 和 `calendarId` 保留为只读字段，自动从 `externalIds` 和 `calendarIds` 派生
- 老代码仍可读取这两个字段
- 新代码必须使用 `externalIds` 和 `calendarIds`

#### 1.2 SyncAction 类型扩展

**文件**：`src/services/ActionBasedSyncManager.ts`

**当前**：
```typescript
interface SyncAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityId: string; // 对应 Event.id
  data: Event;
  synchronized: boolean; // 单一状态
}
```

**目标**：
```typescript
interface SyncAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityId: string;
  data: Event;
  targetCalendarId?: string; // 🆕 指定目标日历（用于单日历操作）
  synchronized: boolean; // 全局状态（所有日历都完成才为 true）
  synchronizedByCalendar?: { [calendarId: string]: boolean }; // 🆕 每个日历的同步状态
  lastErrorByCalendar?: { [calendarId: string]: string }; // 🆕 每个日历的错误信息
}
```

---

### 2. 同步逻辑重构

#### 2.1 CREATE 操作

**文件**：`ActionBasedSyncManager.ts` → `syncSingleAction()` case 'create'

**当前逻辑**：
```typescript
case 'create':
  syncTargetCalendarId = action.data.calendarId; // 单个日历
  const newEventId = await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId);
  this.updateLocalEventExternalId(action.entityId, newEventId);
```

**目标逻辑**：
```typescript
case 'create':
  const targetCalendars = action.data.calendarIds || [];
  const externalIds: { [calendarId: string]: string | null } = {};
  
  // 并行同步到所有目标日历
  const syncResults = await Promise.allSettled(
    targetCalendars.map(calendarId => 
      this.microsoftService.syncEventToCalendar(eventData, calendarId)
        .then(externalId => ({ calendarId, externalId, success: true }))
        .catch(error => ({ calendarId, error, success: false }))
    )
  );
  
  // 收集结果
  for (const result of syncResults) {
    if (result.status === 'fulfilled' && result.value.success) {
      externalIds[result.value.calendarId] = result.value.externalId;
    } else {
      externalIds[result.value.calendarId] = null; // 标记失败
      console.error(`Failed to sync to calendar ${result.value.calendarId}:`, result.reason);
    }
  }
  
  // 更新本地事件
  this.updateLocalEventExternalIds(action.entityId, externalIds);
  
  // 判断是否全部成功
  const allSucceeded = Object.values(externalIds).every(id => id !== null);
  return allSucceeded;
```

**关键点**：
- 使用 `Promise.allSettled` 并行同步，提升性能
- 部分失败不影响成功的日历
- 记录每个日历的同步结果

#### 2.2 UPDATE 操作

**目标逻辑**：
```typescript
case 'update':
  const currentEvent = this.getLocalEvents().find(e => e.id === action.entityId);
  const currentExternalIds = currentEvent?.externalIds || {};
  
  // 比对日历列表变化
  const oldCalendarIds = Object.keys(currentExternalIds);
  const newCalendarIds = action.data.calendarIds || [];
  
  const toDelete = oldCalendarIds.filter(id => !newCalendarIds.includes(id));
  const toCreate = newCalendarIds.filter(id => !oldCalendarIds.includes(id));
  const toUpdate = newCalendarIds.filter(id => oldCalendarIds.includes(id));
  
  // 1. 删除不再需要的日历事件
  await Promise.allSettled(
    toDelete.map(calendarId => 
      this.microsoftService.deleteCalendarEvent(calendarId, currentExternalIds[calendarId])
    )
  );
  
  // 2. 创建新增的日历事件
  const newExternalIds = { ...currentExternalIds };
  await Promise.allSettled(
    toCreate.map(async calendarId => {
      const externalId = await this.microsoftService.syncEventToCalendar(eventData, calendarId);
      newExternalIds[calendarId] = externalId;
    })
  );
  
  // 3. 更新现有的日历事件
  await Promise.allSettled(
    toUpdate.map(calendarId => 
      this.microsoftService.updateCalendarEvent(
        calendarId, 
        currentExternalIds[calendarId], 
        eventData
      )
    )
  );
  
  // 清理已删除的日历映射
  toDelete.forEach(id => delete newExternalIds[id]);
  
  this.updateLocalEventExternalIds(action.entityId, newExternalIds);
```

**关键点**：
- 智能检测日历变更（新增/删除/更新）
- 避免不必要的 API 调用
- 保持数据一致性

#### 2.3 DELETE 操作

**目标逻辑**：
```typescript
case 'delete':
  const eventToDelete = this.getLocalEvents().find(e => e.id === action.entityId);
  const externalIds = eventToDelete?.externalIds || {};
  
  // 删除所有关联日历的事件
  await Promise.allSettled(
    Object.entries(externalIds).map(([calendarId, externalId]) => 
      this.microsoftService.deleteCalendarEvent(calendarId, externalId)
    )
  );
```

---

### 3. UI 改进

#### 3.1 EventEditModal 日历选择器

**文件**：`src/components/EventEditModal.tsx`

**目标**：
1. 明确显示"支持多日历同步"
2. 为每个选中的日历显示同步状态：
   - ✅ 已同步
   - ⏳ 同步中
   - ❌ 同步失败（可点击重试）

**UI 设计**：
```tsx
<div className="calendar-selector">
  <label>同步到日历 (支持多选)</label>
  <Select
    mode="multiple"
    value={formData.calendarIds}
    onChange={handleCalendarChange}
  >
    {availableCalendars.map(cal => (
      <Option key={cal.id} value={cal.id}>{cal.name}</Option>
    ))}
  </Select>
  
  {/* 显示每个日历的同步状态 */}
  <div className="sync-status-list">
    {formData.calendarIds.map(calId => {
      const status = event.syncStatusByCalendar?.[calId] || 'pending';
      return (
        <div key={calId} className="sync-status-item">
          <span>{getCalendarName(calId)}</span>
          <SyncStatusBadge status={status} />
          {status === 'error' && (
            <Button size="small" onClick={() => retrySyncToCalendar(calId)}>
              重试
            </Button>
          )}
        </div>
      );
    })}
  </div>
</div>
```

#### 3.2 TimeCalendar 事件展示

**文件**：`src/pages/TimeCalendar.tsx`

**目标**：
- 在事件卡片上显示同步到的日历数量
- 悬停时显示详细的同步状态

**UI 设计**：
```tsx
<div className="event-card">
  <div className="event-title">{event.title}</div>
  {event.calendarIds && event.calendarIds.length > 1 && (
    <div className="multi-calendar-badge">
      <CalendarIcon />
      <span>{event.calendarIds.length} 个日历</span>
    </div>
  )}
  <Tooltip title={renderSyncStatusTooltip(event)}>
    <SyncStatusIcon status={getOverallSyncStatus(event)} />
  </Tooltip>
</div>
```

---

### 4. 新增 API 方法

#### 4.1 批量同步方法

**文件**：`src/services/ActionBasedSyncManager.ts`

```typescript
/**
 * 同步事件到多个日历
 * @returns { [calendarId]: externalId | null }
 */
private async syncEventToCalendars(
  event: Event, 
  calendarIds: string[]
): Promise<{ [calendarId: string]: string | null }> {
  const results: { [calendarId: string]: string | null } = {};
  
  const syncPromises = calendarIds.map(async (calendarId) => {
    try {
      const externalId = await this.microsoftService.syncEventToCalendar(
        this.convertEventToGraphFormat(event),
        calendarId
      );
      results[calendarId] = externalId;
    } catch (error) {
      console.error(`Failed to sync to calendar ${calendarId}:`, error);
      results[calendarId] = null;
    }
  });
  
  await Promise.allSettled(syncPromises);
  return results;
}
```

#### 4.2 单日历重试方法

```typescript
/**
 * 重试同步到指定日历
 */
public async retrySyncToCalendar(eventId: string, calendarId: string): Promise<boolean> {
  const event = this.getLocalEvents().find(e => e.id === eventId);
  if (!event) return false;
  
  try {
    const externalId = await this.microsoftService.syncEventToCalendar(
      this.convertEventToGraphFormat(event),
      calendarId
    );
    
    // 更新单个日历的映射
    const updatedExternalIds = {
      ...event.externalIds,
      [calendarId]: externalId
    };
    
    this.updateLocalEventExternalIds(eventId, updatedExternalIds);
    return true;
  } catch (error) {
    console.error(`Retry sync failed for calendar ${calendarId}:`, error);
    return false;
  }
}
```

---

### 5. 数据迁移

#### 5.1 迁移脚本

**文件**：`src/utils/migrations/migrateToMultiCalendar.ts`

```typescript
/**
 * 将单日历数据迁移到多日历结构
 */
export function migrateToMultiCalendar(): void {
  const MIGRATION_KEY = 'remarkable-multi-calendar-migration-v1';
  
  if (localStorage.getItem(MIGRATION_KEY)) {
    console.log('Multi-calendar migration already completed');
    return;
  }
  
  const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
  let migrated = 0;
  
  for (const event of events) {
    if (event.externalId && !event.externalIds) {
      // 迁移单个 externalId 到 externalIds
      const calendarId = event.calendarId || 'default';
      event.externalIds = {
        [calendarId]: event.externalId
      };
      
      // 迁移 syncStatus 到 syncStatusByCalendar
      if (event.syncStatus) {
        event.syncStatusByCalendar = {
          [calendarId]: event.syncStatus
        };
      }
      
      migrated++;
    }
    
    // 确保 calendarIds 是数组
    if (event.calendarId && !event.calendarIds) {
      event.calendarIds = [event.calendarId];
    }
  }
  
  localStorage.setItem('remarkable-events', JSON.stringify(events));
  localStorage.setItem(MIGRATION_KEY, 'completed');
  
  console.log(`✅ Multi-calendar migration completed: ${migrated} events migrated`);
}
```

#### 5.2 触发时机

在 `ActionBasedSyncManager` 初始化时自动执行：

```typescript
constructor(microsoftService: any) {
  this.microsoftService = microsoftService;
  
  // 🆕 数据迁移
  migrateToMultiCalendar();
  
  this.loadActionQueue();
  // ... 其他初始化逻辑
}
```

---

### 6. 性能优化

#### 6.1 并行同步

- 使用 `Promise.allSettled` 替代顺序同步
- 预期性能提升：3 个日历从 ~900ms 降到 ~300ms（网络并行）

#### 6.2 批量 API（如果 Microsoft Graph 支持）

研究是否可以使用批量请求 API：
```typescript
POST https://graph.microsoft.com/v1.0/$batch
{
  "requests": [
    { "id": "1", "method": "POST", "url": "/me/calendars/{cal1}/events", "body": {...} },
    { "id": "2", "method": "POST", "url": "/me/calendars/{cal2}/events", "body": {...} },
    { "id": "3", "method": "POST", "url": "/me/calendars/{cal3}/events", "body": {...} }
  ]
}
```

#### 6.3 智能重试

- 只重试失败的日历
- 不影响已成功同步的日历

---

## 🧪 测试需求

### 1. 单元测试

**文件**：`src/services/__tests__/ActionBasedSyncManager.multiCalendar.test.ts`

**测试用例**：
1. ✅ 同步到 1 个日历（向后兼容）
2. ✅ 同步到 3 个日历（全部成功）
3. ✅ 同步到 3 个日历（部分失败）
4. ✅ 更新事件 - 添加新日历
5. ✅ 更新事件 - 移除日历
6. ✅ 更新事件 - 替换日历
7. ✅ 删除事件 - 清理所有日历
8. ✅ 数据迁移 - 单日历 → 多日历

### 2. 集成测试

**测试场景**：
1. 用户在 EventEditModal 选择 3 个日历 → 验证 Outlook 中出现 3 个事件
2. 用户去掉 1 个日历 → 验证 Outlook 删除对应事件
3. 网络错误 → 验证部分同步成功，失败日历可重试
4. 重启应用 → 验证 `fixOrphanedPendingEvents` 正确处理多日历事件

### 3. 性能测试

**指标**：
- 同步 100 个事件到 3 个日历：< 30 秒
- UI 响应时间：< 500ms
- 内存占用：< +50MB

---

## 📦 交付物

### 代码文件

1. ✅ `src/types.ts` - Event 类型定义更新
2. ✅ `src/services/ActionBasedSyncManager.ts` - 同步逻辑重构
3. ✅ `src/components/EventEditModal.tsx` - UI 改进
4. ✅ `src/pages/TimeCalendar.tsx` - 事件展示改进
5. ✅ `src/utils/migrations/migrateToMultiCalendar.ts` - 数据迁移脚本
6. ✅ `src/services/__tests__/ActionBasedSyncManager.multiCalendar.test.ts` - 单元测试

### 文档

1. ✅ `docs/features/MULTI_CALENDAR_SYNC_GUIDE.md` - 用户使用指南
2. ✅ `docs/architecture/MULTI_CALENDAR_TECHNICAL_SPEC.md` - 技术规范
3. ✅ 更新 `EventService-Architecture.md` - 反映新的同步机制
4. ✅ 更新 `SYNC_MECHANISM_APPENDIX.md` - 补充多日历说明

---

## 📅 实施计划

### 阶段 1：准备与设计（Day 1-3）

**任务**：
- [ ] 细化技术方案，确认所有边界情况
- [ ] 设计 UI 原型（Figma）
- [ ] 研究 Microsoft Graph Batch API 可行性
- [ ] 编写详细的测试用例清单

**产出**：
- 技术设计文档（本文档）
- UI 设计稿
- 测试计划

### 阶段 2：数据结构与迁移（Day 4-6）

**任务**：
- [ ] 修改 `types.ts` - Event 接口
- [ ] 修改 `ActionBasedSyncManager.ts` - SyncAction 接口
- [ ] 编写数据迁移脚本
- [ ] 测试迁移脚本（使用真实数据副本）

**验收**：
- [ ] 迁移脚本成功运行，无数据丢失
- [ ] 向后兼容：老代码仍可读取 `externalId` 和 `calendarId`

### 阶段 3：同步逻辑重构（Day 7-12）

**任务**：
- [ ] 实现 `syncEventToCalendars()` 方法
- [ ] 重构 CREATE 操作
- [ ] 重构 UPDATE 操作（日历变更检测）
- [ ] 重构 DELETE 操作
- [ ] 实现 `retrySyncToCalendar()` 方法
- [ ] 编写单元测试

**验收**：
- [ ] 所有单元测试通过
- [ ] 手动测试：创建/更新/删除事件到 3 个日历

### 阶段 4：UI 改进（Day 13-15）

**任务**：
- [ ] EventEditModal - 多选日历 + 状态显示
- [ ] TimeCalendar - 多日历徽章 + 悬停提示
- [ ] 实现单日历重试按钮
- [ ] 样式优化

**验收**：
- [ ] UI 符合设计稿
- [ ] 交互流畅，无明显性能问题

### 阶段 5：集成测试与优化（Day 16-18）

**任务**：
- [ ] 端到端测试（完整用户流程）
- [ ] 性能测试与优化
- [ ] 错误处理测试（网络失败、API 限流等）
- [ ] 修复发现的 bug

**验收**：
- [ ] 所有测试用例通过
- [ ] 性能指标达标

### 阶段 6：文档与发布（Day 19-21）

**任务**：
- [ ] 编写用户指南
- [ ] 更新技术文档
- [ ] 代码审查
- [ ] 准备发布说明
- [ ] 部署到生产环境

**验收**：
- [ ] 文档完整且易懂
- [ ] 代码审查通过
- [ ] 生产环境稳定运行

---

## 🚨 风险与应对

### 风险 1：Microsoft Graph API 限流

**描述**：并行同步到多个日历可能触发 API 限流（429 Too Many Requests）

**应对**：
1. 实现指数退避重试机制
2. 限制并发数量（最多 3-5 个并行请求）
3. 添加请求队列，避免瞬间大量请求

### 风险 2：部分同步失败的数据一致性

**描述**：事件在日历 A 同步成功，但日历 B 失败，用户可能困惑

**应对**：
1. 明确 UI 显示每个日历的状态
2. 提供单日历重试功能
3. 记录详细的错误日志

### 风险 3：数据迁移失败

**描述**：用户数据可能因为迁移脚本 bug 而损坏

**应对**：
1. 迁移前自动备份 localStorage
2. 迁移过程使用事务式逻辑（全部成功或全部回滚）
3. 提供手动回滚工具

### 风险 4：性能下降

**描述**：多日历同步可能导致 UI 卡顿

**应对**：
1. 同步操作后台化（Web Worker 或 setTimeout）
2. UI 显示进度条
3. 实施性能监控

---

## 📊 成功指标

1. **功能完整性**：
   - ✅ 支持同步到 1-10 个日历
   - ✅ 部分失败可重试
   - ✅ 数据迁移成功率 > 99.9%

2. **性能**：
   - ✅ 同步 100 事件到 3 日历 < 30 秒
   - ✅ UI 操作响应 < 500ms
   - ✅ 内存增长 < 50MB

3. **用户体验**：
   - ✅ UI 直观易用
   - ✅ 错误信息清晰
   - ✅ 重试功能有效

4. **代码质量**：
   - ✅ 单元测试覆盖率 > 80%
   - ✅ 无 critical/high 级别 bug
   - ✅ 代码审查通过

---

## 🔗 相关文档

- `EventService-Architecture.md` - 事件服务架构
- `SYNC_MECHANISM_APPENDIX.md` - 同步机制详解
- `ActionBasedSyncManager.ts` - 同步管理器源码

---

## ✅ 审批

**需求提出人**：Zoey Gong  
**技术负责人**：（待指定）  
**预计开始日期**：2025-11-02

**批准状态**：⏳ 待审批

---

**文档结束**
