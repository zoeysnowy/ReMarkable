# EventService 架构文档

本文档整合了 EventService 的设计、实现和集成过程，以及完整的事件同步机制说明。

---

## 目录
1. [改造背景与总结](#改造背景与总结)
2. [完整的事件更新链路](#完整的事件更新链路)
3. [同步状态详解](#同步状态详解)
4. [多日历支持现状](#多日历支持现状)
5. [集成指南](#集成指南)

---

# 改造背景与总结



## 改造背景

原问题：你的应用有多种事件创建方式：
1. **Timer 计时器**：用户通过计时停止创建事件
2. **TimeCalendar**：用户直接在日历上创建/编辑事件
3. **PlanManager**：（开发中）从 Plan 转为 Event

之前每个创建路径都需要手动处理：
- localStorage 保存
- 触发全局事件通知
- 调用 `syncManager.recordLocalAction` 同步到 Outlook

这导致：
- **代码重复**：同样的逻辑在多个地方实现
- **同步遗漏风险**：某些路径可能忘记调用同步
- **维护困难**：修改同步逻辑需要改多个文件

## 解决方案：EventService

创建了统一的事件管理服务 `EventService`，集中处理所有事件操作。

### 核心架构

```
┌─────────────────┐
│   Timer Stop    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐       ┌──────────────────┐
│  TimeCalendar   │──────▶│  EventService    │
└─────────────────┘       │  (统一入口)      │
         ▲                └────────┬─────────┘
         │                         │
┌─────────────────┐                │
│  PlanManager    │                │
└─────────────────┘                │
                                   ▼
                    ┌──────────────────────────┐
                    │  1. localStorage 持久化  │
                    │  2. 触发 eventsUpdated   │
                    │  3. recordLocalAction    │
                    │  4. 加入同步队列         │
                    └──────────────────────────┘
```

### 关键特性

1. **统一入口**：所有事件创建/更新/删除都经过 EventService
2. **自动同步**：自动调用 `recordLocalAction` 加入同步队列
3. **智能跳过**：支持 `skipSync` 参数，Timer 运行中不同步
4. **全局通知**：自动触发 `eventsUpdated` 事件
5. **一致错误处理**：统一的返回格式和日志

## 已完成的改造

### 1. 创建 EventService.ts

位置：`src/services/EventService.ts`

核心方法：
```typescript
EventService.initialize(syncManager)      // 初始化服务
EventService.createEvent(event, skipSync) // 创建事件
EventService.updateEvent(id, updates)     // 更新事件
EventService.deleteEvent(id, skipSync)    // 删除事件
EventService.getAllEvents()               // 查询所有事件
EventService.getEventById(id)             // 根据ID查询
EventService.batchCreateEvents(events)    // 批量创建
```

### 2. App.tsx 集成

**初始化 EventService**（Line ~1167）：
```typescript
const newSyncManager = new ActionBasedSyncManager(microsoftService);
EventService.initialize(newSyncManager); // 注入同步管理器
```

**改造 Timer Stop**（Line ~516-556）：
```typescript
// 改造前：50+ 行手动处理
// 改造后：
const result = await EventService.updateEvent(timerEventId, finalEvent);
if (result.success) {
  setAllEvents(EventService.getAllEvents());
}
```

**改造 Timer Cancel**（Line ~381-400）：
```typescript
// 使用 EventService 删除事件（skipSync=true，取消操作不同步）
EventService.deleteEvent(timerEventId, true);
```

**改造 Timer Init**（Line ~667-677）：
```typescript
// Timer 开始时创建事件（skipSync=true，运行中不同步）
await EventService.createEvent(timerEvent, true);
```

**改造回调函数**：
- `handleCreateEvent`：使用 `EventService.createEvent`
- `handleUpdateEvent`：使用 `EventService.updateEvent`

### 3. 创建集成指南

位置：`EVENTSERVICE_INTEGRATION_GUIDE.md`

包含：
- API 使用说明
- 迁移指南
- 最佳实践
- 调试工具

## 待完成的迁移

### 1. TimeCalendar.tsx（高优先级）

需要迁移的方法：
- `handleBeforeCreateEvent`（创建新事件）
- `handleBeforeUpdateEvent`（更新事件）
- `handleBeforeDeleteEvent`（删除事件）

**预期收益**：
- 减少 ~150 行重复代码
- 统一所有手动创建事件的同步逻辑

### 2. EventManager.tsx（中优先级）

需要迁移的操作：
- 所有直接操作 localStorage 的地方
- 所有手动调用 `recordLocalAction` 的地方

### 3. PlanManager.tsx（低优先级，开发中）

Plan 转 Event 功能开发时直接使用 EventService

## 技术细节

### skipSync 参数使用场景

| 场景 | skipSync | 原因 |
|------|----------|------|
| Timer 运行中保存 | `true` | 避免频繁同步，只在停止时同步 |
| Timer 停止 | `false` | 最终保存并同步到 Outlook |
| Timer 取消 | `true` | 删除本地事件，不需要同步 |
| 用户手动创建事件 | `false` | 正常同步流程 |
| 用户编辑事件 | `false` | 正常同步流程 |
| 批量导入 | `true` | 先导入，再手动触发同步 |

### 同步队列流程

```
EventService.createEvent(event)
         ↓
保存到 localStorage
         ↓
触发 eventsUpdated 事件
         ↓
调用 syncManager.recordLocalAction('create', 'event', id, event)
         ↓
添加到 SyncAction 队列（localStorage: remarkable-sync-actions）
         ↓
SyncManager 轮询队列
         ↓
同步到 Outlook Calendar
         ↓
更新事件状态为 'synced'
```

### 错误处理

EventService 返回统一格式：
```typescript
{
  success: boolean;
  event?: Event;    // 成功时返回
  error?: string;   // 失败时返回
}
```

**非阻塞式同步**：
- 同步失败不影响事件创建成功
- 同步错误仅记录日志，不抛出异常
- 事件保存后立即返回，同步在后台进行

## 验证方法

### 1. Timer 测试

```bash
1. 启动 Timer → 检查 localStorage 出现 'local-only' 事件
2. 停止 Timer → 检查事件状态变为 'pending'
3. 检查控制台 → 应看到 "Event saved via EventService"
4. 检查同步队列 → localStorage: remarkable-sync-actions
```

### 2. 控制台调试

```javascript
// 检查服务状态
EventService.isInitialized() // 应返回 true

// 查看所有事件
EventService.getAllEvents()

// 查看同步队列
JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]')

// 创建测试事件
await EventService.createEvent({
  id: 'test-' + Date.now(),
  title: 'Test Event',
  startTime: new Date().toISOString(),
  endTime: new Date(Date.now() + 3600000).toISOString(),
  tags: [],
  remarkableSource: true,
  syncStatus: 'pending'
})
```

### 3. 网络监控

在 DevTools Network 标签中：
- 筛选 `graph.microsoft.com/v1.0/me/events`
- 检查 POST/PATCH/DELETE 请求
- 确认事件数据正确同步

## 性能优化

已实现的优化：
1. **localStorage 一次性读写**：不重复读取
2. **非阻塞式同步**：不阻塞 UI 操作
3. **批量操作支持**：减少网络请求
4. **智能跳过同步**：Timer 运行中不频繁同步

## 向后兼容

EventService 不破坏现有代码：
- 现有的 localStorage 操作仍然有效
- 现有的 `recordLocalAction` 调用仍然有效
- 可以逐步迁移，不需要一次性修改

## 下一步计划

1. **立即测试**：验证 Timer 创建事件是否正确同步
2. **迁移 TimeCalendar**：统一日历事件创建逻辑
3. **迁移 EventManager**：清理重复代码
4. **性能监控**：观察同步队列处理情况
5. **错误监控**：收集同步失败的案例

## 总结

通过引入 EventService，你的应用现在有了：

✅ **统一的事件管理入口**  
✅ **自动化的同步机制**  
✅ **一致的错误处理**  
✅ **简化的代码维护**  
✅ **可靠的同步保证**  

所有事件创建路径（Timer、TimeCalendar、PlanManager）现在都汇入同一个同步机制，确保不会遗漏任何事件。

---

**改造时间**：2025-10-30  
**改造文件**：
- 新增：`src/services/EventService.ts`
- 修改：`src/App.tsx`
- 新增：`EVENTSERVICE_INTEGRATION_GUIDE.md`
- 新增：`EVENTSERVICE_SUMMARY.md`（本文件）


---

# 完整的事件更新链路

本节详细说明应用中所有可能的事件更新源头、可能遇到的问题以及处理方案。

---

## 事件更新源头清单

### 1. Timer 计时器

#### 1.1 Timer 启动（创建 local-only 事件）

**源头**：`App.tsx` → `handleTimerStart()`

**流程**：
```
用户点击 Start Timer
  ↓
创建事件对象：syncStatus = 'local-only'
  ↓
EventService.createEvent(event, skipSync=true)
  ↓
保存到 localStorage（不加入同步队列）
  ↓
每30秒自动保存进度（skipSync=true）
```

**关键点**：
- `skipSync=true`：避免频繁同步
- `syncStatus='local-only'`：明确标记为本地专属
- 不会出现在同步队列中

#### 1.2 Timer 停止（转为待同步事件）

**源头**：`App.tsx` → `handleTimerStopAndSave()`

**流程**：
```
用户点击 Stop Timer
  ↓
更新事件：syncStatus = 'pending'（从 local-only 改为 pending）
  ↓
EventService.updateEvent(id, updates, skipSync=false)
  ↓
保存到 localStorage + 加入同步队列
  ↓
recordLocalAction('update', 'event', id, data)
  ↓
SyncAction 加入队列（synchronized=false）
  ↓
SyncManager 轮询队列 → 同步到 Outlook
```

**可能问题**：
- ❌ Timer 事件没有 `tagId` 或 `calendarId` → 同步到默认日历
- ✅ 解决：在 Timer Stop 时让用户选择标签/日历

#### 1.3 Timer 取消（删除本地事件）

**源头**：`App.tsx` → `handleTimerCancel()`

**流程**：
```
用户点击 Cancel Timer
  ↓
EventService.deleteEvent(id, skipSync=true)
  ↓
从 localStorage 删除（不同步到 Outlook）
  ↓
触发 eventsUpdated 事件
```

**关键点**：
- `skipSync=true`：取消操作不需要同步
- 如果事件已有 `externalId`，需要手动处理删除（当前未实现）

---

### 2. TimeCalendar 日历界面

#### 2.1 拖拽创建事件

**源头**：`TimeCalendar.tsx` → `handleBeforeCreateEvent()`

**当前实现**：❌ **未使用 EventService**（待迁移）

**当前流程**：
```
用户拖拽日历空白区域
  ↓
TUI Calendar 触发 beforeCreateEvent
  ↓
创建事件对象：syncStatus = 'pending'
  ↓
直接操作 localStorage（未经过 EventService）
  ↓
手动调用 recordLocalAction('create', ...)
  ↓
手动触发 dispatchEvent('eventsUpdated')
```

**问题**：
- ❌ 绕过了 EventService，代码重复
- ❌ 如果忘记调用 `recordLocalAction`，事件不会同步
- ❌ ~150 行重复的同步逻辑

**应改为**：
```
用户拖拽日历空白区域
  ↓
TUI Calendar 触发 beforeCreateEvent
  ↓
创建事件对象
  ↓
EventService.createEvent(event) // 自动处理所有逻辑
  ↓
更新 UI：setEvents(EventService.getAllEvents())
```

#### 2.2 拖拽调整时间

**源头**：`TimeCalendar.tsx` → `handleBeforeUpdateEvent()`

**当前实现**：❌ **未使用 EventService**（待迁移）

**当前流程**：
```
用户拖拽事件改变时间
  ↓
TUI Calendar 触发 beforeUpdateEvent
  ↓
更新事件对象：syncStatus = 'pending-update'
  ↓
直接操作 localStorage
  ↓
手动调用 recordLocalAction('update', ...)
  ↓
手动触发 dispatchEvent('eventsUpdated')
```

**问题**：
- ❌ 可能忘记调用 `recordLocalAction` → 产生 "orphaned pending events"
- ❌ 这是 `fixOrphanedPendingEvents()` 函数需要修复的主要场景

**应改为**：
```
用户拖拽事件改变时间
  ↓
TUI Calendar 触发 beforeUpdateEvent
  ↓
EventService.updateEvent(id, { startTime, endTime })
  ↓
自动保存 + 自动同步
```

#### 2.3 删除事件

**源头**：`TimeCalendar.tsx` → `handleBeforeDeleteEvent()`

**流程类似**：未使用 EventService（待迁移）

---

### 3. EventEditModal 事件编辑弹窗

#### 3.1 编辑事件内容

**源头**：`EventEditModal.tsx` → `handleSave()` → 回调到父组件

**流程**：
```
用户在弹窗中编辑事件
  ↓
点击保存
  ↓
EventEditModal 收集 formData（标题、时间、标签、日历等）
  ↓
自动合并标签的日历映射：
  mappedCalendarIds = tags.map(tag => tag.calendarMapping?.calendarId)
  uniqueCalendarIds = [...calendarIds, ...mappedCalendarIds]
  ↓
调用父组件的 onSave(updatedEvent)
  ↓
父组件（TimeCalendar 或 EventManager）保存事件
```

**关键逻辑**：
- 标签的 `calendarMapping` 自动添加到 `calendarIds` 数组
- `calendarId` = `calendarIds[0]`（兼容字段）
- 如果用户选择了 2 个标签 + 1 个日历，`calendarIds` = [cal1, cal2, cal3]

**当前问题**：
- ⚠️ 父组件可能未使用 EventService → 导致同步遗漏
- ⚠️ 多日历支持不完整（见下文"多日历支持现状"）

---

### 4. EventManager 事件管理器

**源头**：`EventManager.tsx` → `saveEventFromModal()`

**当前实现**：❌ **部分使用 EventService**

**流程**：
```
EventEditModal 返回 updatedEvent
  ↓
saveEventFromModal() 接收
  ↓
判断是否新事件
  ↓
直接操作 localStorage（未使用 EventService）
  ↓
手动触发 dispatchEvent('local-events-changed')
  ↓
手动调用 recordLocalAction（如果连接到 Outlook）
```

**问题**：
- ❌ 应该使用 `EventService.createEvent` 或 `EventService.updateEvent`

---

### 5. Outlook 远程同步回写

#### 5.1 Outlook → 本地同步

**源头**：`ActionBasedSyncManager.ts` → `syncPendingRemoteActions()`

**流程**：
```
SyncManager 定期轮询 Outlook
  ↓
发现 Outlook 新增/修改/删除事件
  ↓
创建 SyncAction（source='outlook'）
  ↓
加入 actionQueue
  ↓
applyRemoteActionToLocal()
  ↓
更新本地 localStorage
  ↓
触发 local-events-changed 事件
  ↓
UI 自动刷新
```

**关键点**：
- 远程同步**不经过 EventService**（避免循环同步）
- 直接操作 IndexMap 和 localStorage
- 通过 `editLocks` 机制避免冲突（用户正在编辑的事件不被覆盖）

#### 5.2 同步冲突处理

**冲突场景**：
1. 用户在本地修改事件 A
2. 同时 Outlook 也修改了事件 A
3. 两个修改同时到达

**当前处理**：
```
UPDATE 操作检测到冲突
  ↓
PRIORITY 0: 保护用户数据
  - 立即保存用户修改到 localStorage
  - 设置 syncStatus = 'pending-update'
  - 创建备份（backupReason: 'update-operation'）
  ↓
PRIORITY 1: 检查编辑锁定
  - 如果用户正在编辑，清除锁定允许同步
  ↓
PRIORITY 2-4: 决定同步策略（创建/更新/删除）
  ↓
最终：用户数据优先，远程修改在下次同步时处理
```

**关键机制**：
- `editLocks`：存储正在编辑的事件ID + 过期时间
- `recentlyUpdatedEvents`：防止误删最近更新的事件
- 冲突标记：在标题前添加 `⚠️同步冲突 - `

---

### 6. 批量导入/迁移

**源头**：`fixOrphanedPendingEvents()` 自动修复

**触发时机**：
- 每次应用启动（SyncManager 初始化时）

**流程**：
```
应用启动
  ↓
SyncManager.initialize()
  ↓
fixOrphanedPendingEvents()
  ↓
扫描 localStorage 中的所有事件
  ↓
筛选条件：
  - syncStatus = 'pending' 或 'pending-update'
  - syncStatus ≠ 'local-only'
  - remarkableSource = true
  - 没有 externalId
  - 有 calendarIds 或有 tagId（有同步目标）
  ↓
检查是否在同步队列中
  ↓
如果不在，创建 SyncAction 加入队列
  ↓
下次同步周期自动同步
```

**这个函数解决的问题**：
- ✅ TimeCalendar 直接操作 localStorage 忘记调用 `recordLocalAction`
- ✅ 应用崩溃导致同步队列丢失
- ✅ 用户修改事件但同步失败（网络问题）
- ✅ 历史遗留的 pending 事件

**最新优化**（2025-10-30）：
- ✅ 支持 `pending-update` 状态
- ✅ 每次启动都检查（不再使用一次性迁移标记）
- ✅ 过滤 `local-only` 事件（如运行中的 Timer）
- ✅ 检查 `calendarIds` 或 `tagId`，确保有同步目标

---

## 问题场景与处理方案

### 场景1：事件创建后没有同步

**症状**：
- 事件在本地存在
- `syncStatus = 'pending'`
- 没有 `externalId`
- 不在同步队列中

**原因**：
- TimeCalendar 直接操作 localStorage，忘记调用 `recordLocalAction`

**自动修复**：
- `fixOrphanedPendingEvents()` 在下次启动时自动检测并修复

**根本解决方案**：
- 迁移 TimeCalendar 到 EventService

---

### 场景2：Timer 事件同步到错误的日历

**症状**：
- Timer 停止后，事件同步到了默认日历，而不是用户期望的标签日历

**原因**：
- Timer 事件创建时没有设置 `tagId` 或 `calendarId`
- 同步时使用 `microsoftService.getSelectedCalendarId()`（默认日历）

**当前处理**：
```typescript
// ActionBasedSyncManager.ts - CREATE 操作
if (!syncTargetCalendarId) {
  // 如果没有标签也没有日历，使用默认日历
  syncTargetCalendarId = this.microsoftService.getSelectedCalendarId();
}
```

**建议优化**：
- 在 Timer Stop 时弹出标签选择器
- 或者在 Timer 设置中添加"默认标签"选项

---

### 场景3：多标签多日历同步

**症状**：
- 用户选择了 2 个标签 + 1 个日历（共 3 个目标日历）
- 但 Outlook 只出现 1 个事件

**原因**：
- 当前架构 `externalId` 是单值，一个本地事件只能对应一个远程事件
- 同步时只取 `calendarIds[0]`

**当前行为**：
```typescript
// EventEditModal 收集所有日历
calendarIds = [cal1, cal2, cal3]

// 保存时兼容处理
calendarId = calendarIds[0] // 只用第一个

// 同步时
syncTargetCalendarId = action.data.calendarId // 只同步一个
```

**根本限制**：
- Event 数据结构：`externalId: string`（单值）
- 需要改为：`externalIds: { [calendarId]: externalId }`

**如果要实现真正的多日历同步**：
1. 修改 Event 类型定义
2. 修改同步逻辑，为每个 calendarId 创建独立的远程事件
3. UPDATE/DELETE 操作需要同步到所有关联日历
4. 需要处理"部分日历同步失败"的场景

**建议**：
- 短期：在 UI 上明确说明"只会同步到第一个日历"
- 长期：作为独立功能立项实现

---

### 场景4：同步失败后的重试

**症状**：
- 事件创建成功
- 同步失败（网络错误 / API 错误）
- 事件卡在 `syncStatus = 'pending'`

**处理机制**：
```typescript
// SyncAction 结构
interface SyncAction {
  synchronized: boolean;  // false = 未同步
  retryCount: number;     // 重试次数
  lastError?: string;     // 最后错误
  lastAttemptTime?: Date; // 最后尝试时间
}
```

**自动重试**：
```
SyncManager 轮询队列
  ↓
发现 synchronized=false 的 action
  ↓
尝试同步
  ↓
失败 → retryCount++, synchronized=false
  ↓
下次轮询再次尝试（最多重试N次）
```

**持久化保证**：
- SyncAction 队列保存在 localStorage（`remarkable-sync-actions`）
- 应用重启后继续重试
- `fixOrphanedPendingEvents()` 双重保险

---

### 场景5：用户正在编辑时远程同步覆盖

**症状**：
- 用户正在 EventEditModal 中编辑事件
- 同时 Outlook 同步回来该事件的修改
- 用户修改被覆盖

**保护机制**：
```typescript
// editLocks: Map<eventId, expiryTimestamp>
this.editLocks.set(eventId, Date.now() + 60000); // 锁定60秒

// 远程同步检查锁定
const lockStatus = this.editLocks.get(eventId);
if (lockStatus && Date.now() < lockStatus) {
  console.log('⏸️ Event locked by user, skipping remote update');
  return;
}
```

**配合 PRIORITY 0 机制**：
```
UPDATE 操作最高优先级：
  1. 立即保存用户修改到 localStorage
  2. 设置 syncStatus = 'pending-update'
  3. 创建备份
  4. 然后再处理远程同步
```

---

## 同步流程总结

### 完整链路图

```
┌─────────────┐
│   用户操作   │ (Timer Stop / 拖拽创建 / 编辑弹窗)
└──────┬──────┘
       │
       ▼
┌─────────────┐
│ EventService│ (推荐) 或 直接操作 localStorage (待迁移)
└──────┬──────┘
       │
       ├──► localStorage 保存 (remarkable-events)
       │
       ├──► recordLocalAction('create'/'update'/'delete')
       │
       ├──► dispatchEvent('eventsUpdated')
       │
       ▼
┌─────────────┐
│ SyncAction  │
│   Queue     │ (localStorage: remarkable-sync-actions)
└──────┬──────┘
       │
       │ (定期轮询: 30秒)
       ▼
┌─────────────┐
│ SyncManager │
│  Polling    │
└──────┬──────┘
       │
       ├──► syncPendingLocalActions() → Outlook API
       │     - POST/PATCH/DELETE 请求
       │     - 更新 externalId
       │     - 更新 syncStatus = 'synced'
       │
       └──► syncPendingRemoteActions() → 本地 localStorage
             - Outlook 新增/修改/删除
             - 避免 editLocks 冲突
             - 触发 local-events-changed

```

### 关键数据结构

**Event（types.ts）**：
```typescript
{
  id: string;                // 本地唯一ID
  externalId?: string;       // Outlook 事件ID（单值）
  calendarId?: string;       // 兼容字段（第一个日历）
  calendarIds?: string[];    // 多日历支持（UI层面）
  syncStatus: 'pending' | 'pending-update' | 'synced' | 'local-only' | 'error';
  remarkableSource: boolean; // true=本地创建，false=Outlook导入
  tags?: string[];           // 标签（可能有日历映射）
}
```

**SyncAction（ActionBasedSyncManager.ts）**：
```typescript
{
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'event' | 'task';
  entityId: string;          // 对应 Event.id
  source: 'local' | 'outlook';
  data: Event;               // 完整事件数据
  oldData?: Event;           // 更新前的数据（用于冲突检测）
  synchronized: boolean;     // false=待同步，true=已完成
  retryCount: number;        // 重试次数
  timestamp: Date;           // 创建时间
}
```

---

## 最佳实践建议

### 1. 所有事件操作都应使用 EventService

```typescript
// ✅ 推荐
await EventService.createEvent(event);
await EventService.updateEvent(id, updates);
await EventService.deleteEvent(id);

// ❌ 不推荐
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
syncManager.recordLocalAction('create', 'event', id, event);
```

### 2. Timer 运行中使用 skipSync=true

```typescript
// Timer 启动 - 不同步
await EventService.createEvent(event, true);

// Timer 停止 - 同步
await EventService.updateEvent(id, updates, false);
```

### 3. 明确事件的同步意图

```typescript
// 需要同步：设置 syncStatus 和目标日历
event.syncStatus = 'pending';
event.calendarIds = [selectedCalendarId];

// 不需要同步：设置 local-only
event.syncStatus = 'local-only';
```

### 4. 处理同步失败

```typescript
const result = await EventService.createEvent(event);

if (!result.success) {
  // 事件已保存到本地，但可能同步失败
  console.error('同步失败，将在后台重试');
  // 不需要特殊处理，SyncManager 会自动重试
}
```

---





## 概述

`EventService` 是一个统一的事件管理服务，用于集中处理所有事件的创建、更新和删除操作。它确保：

1. **统一的数据持久化**：所有事件操作都通过同一个服务进行 localStorage 管理
2. **自动同步机制**：所有事件变更自动调用 `recordLocalAction` 加入同步队列
3. **全局事件通知**：自动触发 `eventsUpdated` 事件，通知其他组件更新
4. **一致的错误处理**：统一的返回格式和错误日志

## 当前集成状态

### ✅ 已集成组件

- **App.tsx**：
  - Timer Stop（停止计时）
  - Timer Cancel（取消计时）
  - Timer Init（计时器初始化）
  - handleCreateEvent（创建事件回调）
  - handleUpdateEvent（更新事件回调）

### ⚠️ 待集成组件

- **TimeCalendar.tsx**：
  - `handleBeforeCreateEvent`（创建新事件）
  - `handleBeforeUpdateEvent`（更新事件）
  - `handleBeforeDeleteEvent`（删除事件）
  
- **EventManager.tsx**：
  - 所有事件创建/更新/删除操作
  
- **PlanManager.tsx**：
  - Plan 转 Event 的创建逻辑

## API 使用说明

### 1. 初始化服务

在 App.tsx 中，同步管理器初始化后立即初始化 EventService：

```typescript
const newSyncManager = new ActionBasedSyncManager(microsoftService);
EventService.initialize(newSyncManager); // 注入同步管理器
```

### 2. 创建事件

```typescript
import { EventService } from '../services/EventService';

const result = await EventService.createEvent(event, skipSync);

if (result.success) {
  console.log('✅ Event created:', result.event);
} else {
  console.error('❌ Failed:', result.error);
}
```

**参数说明：**
- `event: Event` - 完整的事件对象
- `skipSync: boolean` - 是否跳过同步（默认 false）
  - `true`：仅保存到 localStorage，不加入同步队列（例如：Timer 运行中）
  - `false`：保存并加入同步队列，准备同步到 Outlook

**返回值：**
```typescript
{
  success: boolean;
  event?: Event;  // 成功时返回最终保存的事件对象
  error?: string; // 失败时返回错误信息
}
```

### 3. 更新事件

```typescript
// 方式1：部分更新
const result = await EventService.updateEvent(eventId, { title: 'New Title' }, skipSync);

// 方式2：完整对象更新
const result = await EventService.updateEvent(eventId, updatedEvent, skipSync);
```

**参数说明：**
- `eventId: string` - 事件ID
- `updates: Partial<Event> | Event` - 更新内容（可以是部分字段或完整对象）
- `skipSync: boolean` - 是否跳过同步

### 4. 删除事件

```typescript
const result = await EventService.deleteEvent(eventId, skipSync);
```

### 5. 批量创建事件

```typescript
const result = await EventService.batchCreateEvents(events, skipSync);

console.log(`Created: ${result.created}, Failed: ${result.failed}`);
if (result.failed > 0) {
  console.error('Errors:', result.errors);
}
```

### 6. 查询事件

```typescript
// 获取所有事件
const allEvents = EventService.getAllEvents();

// 根据ID获取单个事件
const event = EventService.getEventById(eventId);
```

## 迁移指南

### TimeCalendar.tsx 迁移示例

**迁移前：**
```typescript
const handleBeforeCreateEvent = async (eventInfo: any) => {
  // ... 创建事件对象 ...
  
  // 保存到 localStorage
  const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
  const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
  existingEvents.push(updatedEvent);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
  
  // 更新 UI
  setEvents([...existingEvents]);
  
  // 触发全局事件
  window.dispatchEvent(new CustomEvent('eventsUpdated', {
    detail: { eventId: updatedEvent.id, isNewEvent: true }
  }));
  
  // 同步到 Outlook
  if (syncManager) {
    await syncManager.recordLocalAction('create', 'event', updatedEvent.id, updatedEvent);
  }
};
```

**迁移后：**
```typescript
import { EventService } from '../services/EventService';

const handleBeforeCreateEvent = async (eventInfo: any) => {
  // ... 创建事件对象 ...
  
  // 🔧 使用 EventService 统一处理
  const result = await EventService.createEvent(updatedEvent);
  
  if (result.success) {
    // 更新本地 UI 状态
    setEvents(EventService.getAllEvents());
    console.log('✅ Event created via EventService');
  } else {
    console.error('❌ Failed to create event:', result.error);
  }
};
```

### 关键优势

1. **减少代码重复**：50+ 行代码 → 5 行代码
2. **统一同步逻辑**：不再需要在每个组件中手动调用 `recordLocalAction`
3. **一致的错误处理**：统一的返回格式和日志
4. **自动事件通知**：不需要手动 `dispatchEvent`

## skipSync 使用场景

### 需要 skipSync=true 的场景

1. **Timer 运行中**：每 30 秒保存一次进度，但不同步
   ```typescript
   await EventService.createEvent(timerEvent, true);
   ```

2. **取消操作**：删除本地事件，但不需要同步到 Outlook
   ```typescript
   await EventService.deleteEvent(eventId, true);
   ```

3. **批量导入**：先导入所有数据，再手动触发同步
   ```typescript
   await EventService.batchCreateEvents(events, true);
   ```

### 使用 skipSync=false（默认）的场景

1. **Timer 停止**：最终保存并同步到 Outlook
2. **用户手动创建事件**：TimeCalendar 中创建事件
3. **编辑事件**：用户修改事件内容
4. **Plan 转 Event**：从 PlanManager 创建事件

## 注意事项

1. **异步操作**：所有 EventService 方法都是异步的，记得使用 `await`
2. **错误处理**：始终检查返回的 `success` 字段
3. **UI 更新**：成功后使用 `EventService.getAllEvents()` 更新本地状态
4. **同步管理器**：必须先初始化 EventService 才能自动同步

## 调试工具

EventService 已暴露到全局，可在控制台使用：

```javascript
// 检查服务状态
EventService.isInitialized()

// 查看所有事件
EventService.getAllEvents()

// 查看同步管理器
EventService.getSyncManager()

// 创建测试事件
await EventService.createEvent({
  id: 'test-123',
  title: 'Test Event',
  startTime: '2025-10-30T10:00:00',
  endTime: '2025-10-30T11:00:00',
  tags: [],
  remarkableSource: true,
  syncStatus: 'pending'
})
```

## 下一步行动

1. **迁移 TimeCalendar.tsx**：将所有事件操作替换为 EventService 调用
2. **迁移 EventManager.tsx**：统一事件管理逻辑
3. **迁移 PlanManager.tsx**：Plan 转 Event 使用 EventService
4. **测试验证**：确保所有创建路径都能正确同步

## 性能考虑

EventService 已做优化：

- ✅ localStorage 读写一次性完成，不重复读取
- ✅ 同步失败不阻塞事件创建（非阻塞式同步）
- ✅ Timer 运行中使用 `skipSync=true` 避免频繁同步
- ✅ 批量操作支持减少网络请求

## 向后兼容

EventService 不会破坏现有代码：

- 现有的直接 localStorage 操作仍然有效
- 现有的 `recordLocalAction` 调用仍然有效
- 可以逐步迁移，不需要一次性修改所有代码

## 总结

EventService 提供了一个**集中式、统一化、可靠的**事件管理机制，确保：

1. **所有事件创建路径**（Timer、TimeCalendar、PlanManager）都汇入同一个同步机制
2. **一致的数据处理**和错误处理
3. **简化的代码维护**和更少的重复代码
4. **可靠的同步保证**，不会遗漏任何事件

建议尽快将所有组件迁移到 EventService，享受统一管理带来的便利。
