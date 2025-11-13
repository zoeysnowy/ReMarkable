# PRD Cross-Check 报告

**生成日期**: 2025-11-05  
**检查范围**: 所有核心 PRD 文档  
**检查目标**: EventHub、TimeHub、TagService、localStorage、状态同步机制

---

## ✅ 检查通过的项目

### 1. EventHub API 一致性

| API | 定义文档 | 引用文档 | 状态 |
|-----|----------|----------|------|
| `EventHub.saveEvent()` | SYNC_MECHANISM_PRD | TimeCalendar PRD, PlanManager PRD | ✅ 一致 |
| `EventHub.deleteEvent()` | SYNC_MECHANISM_PRD | TimeCalendar PRD | ✅ 一致 |
| `local-events-changed` 事件 | SYNC_MECHANISM_PRD | TimeCalendar PRD, Timer PRD | ✅ 一致 |
| `timer-updated` 事件 | Timer PRD | TimeCalendar PRD | ✅ 一致 |

**验证结果**:
- ✅ `EventHub.saveEvent()` 在 TimeCalendar PRD L1572, L1645 中使用，签名一致
- ✅ `EventHub.deleteEvent()` 在 TimeCalendar PRD L1611, L1687 中使用，签名一致
- ✅ `local-events-changed` 事件在所有文档中使用 `CustomEvent` 触发，无参数传递

---

### 2. TimeHub API 一致性

| API | 定义文档 | 引用文档 | 状态 |
|-----|----------|----------|------|
| `useEventTime(eventId)` | TimeCalendar PRD | PlanManager PRD, EventEditModal PRD | ✅ 一致 |
| `getTimeSnapshot()` | TimeCalendar PRD | PlanManager PRD | ✅ 一致 |

**验证结果**:
- ✅ `useEventTime(itemId)` 在 PlanManager PRD L217 中使用，返回 `{ start, end, timeSpec }` 对象
- ✅ EventEditModal PRD L366 提到"优先使用 TimeHub 的快照"，与 PlanManager PRD 中的时间优先级一致

**时间快照优先级**（跨文档一致）:
```
TimeHub 快照 (eventTime.start) > localStorage (item.startTime) > undefined
```

---

### 3. localStorage 键名一致性

| 键名 | 定义文档 | 引用文档 | 状态 |
|------|----------|----------|------|
| `currentTimer` | Timer PRD | TimeCalendar PRD, PlanManager PRD | ✅ 一致 |
| `events` | SYNC_MECHANISM_PRD | Timer PRD, TimeCalendar PRD | ✅ 一致 |
| `calendarSettings` | TimeCalendar PRD | - | ✅ 一致 |
| `tags` | TagManager PRD | - | ✅ 一致 |

**验证结果**:
- ✅ `localStorage.getItem('currentTimer')` 在 TimeCalendar PRD L1232, L1276 中使用
- ✅ `localStorage.setItem('events', ...)` 在 Timer PRD L1126, L1131 中使用
- ✅ `localStorage.setItem('calendarSettings', ...)` 在 TimeCalendar PRD L2045 中使用

---

### 4. TagService API 一致性

| API | 定义文档 | 引用文档 | 状态 |
|-----|----------|----------|------|
| `TagService.getFlatTags()` | TagManager PRD | PlanManager PRD | ✅ 一致 |
| `TagService.getHierarchicalTags()` | TagManager PRD | EventEditModal PRD | ✅ 一致 |

**验证结果**:
- ✅ PlanManager PRD L320-330 中使用 `TagService.getFlatTags().find(t => t.name === tagName)`，与 TagManager PRD 定义一致

---

## ⚠️ 发现的不一致或待补充项

### Issue #1: Event.tags 数据格式不明确

**问题描述**:
- PlanManager PRD 中提到"标签名 vs 标签ID 混用"（L320-330）
- TagManager PRD 中未明确说明 `Event.tags` 字段应存储标签名还是标签ID

**影响范围**:
- PlanManager PRD（标签映射逻辑）
- TagManager PRD（标签选择器）
- EventEditModal PRD（标签显示）

**建议**:
在 TagManager PRD 中添加章节"Event.tags 数据格式约定"，明确：
- ✅ **推荐格式**: 存储标签 ID（`string[]`）
- ✅ **派生字段**: `tagNames` 字段存储标签名称（只读）
- ✅ **映射工具**: `TagService.resolveTagIds()` 和 `TagService.resolveTagNames()`

**修复文档**: TagManager PRD Section 2.1（核心接口）

---

### Issue #2: EventHub.saveEvent() 返回值未统一说明

**问题描述**:
- TimeCalendar PRD L1645 中使用 `const savedEvent = await EventHub.saveEvent(eventData)`，期望返回保存后的 Event 对象
- SYNC_MECHANISM_PRD 中未明确说明 `EventHub.saveEvent()` 的返回值类型

**影响范围**:
- TimeCalendar PRD（保存后需要获取 `outlookCalendarId` 触发同步）
- PlanManager PRD（保存后可能需要更新 `item.id`）

**建议**:
在 SYNC_MECHANISM_PRD 中补充 `EventHub.saveEvent()` 的返回值定义：
```typescript
/**
 * 保存事件（创建或更新）
 * @param eventData 事件数据
 * @returns 保存后的完整 Event 对象（包含生成的 ID）
 */
async saveEvent(eventData: Event): Promise<Event>
```

**修复文档**: SYNC_MECHANISM_PRD Section 3（EventHub API）

---

### Issue #3: syncStatus 枚举值未统一

**问题描述**:
- TimeCalendar PRD 中使用 `syncStatus: 'local-only'`
- SYNC_MECHANISM_PRD 中未明确定义 `syncStatus` 的所有可能值

**影响范围**:
- TimeCalendar PRD（事件创建）
- Timer PRD（事件保存）

**建议**:
在 SYNC_MECHANISM_PRD 中添加 `syncStatus` 枚举定义：
```typescript
type SyncStatus = 
  | 'local-only'    // 本地创建，未同步
  | 'synced'        // 已同步到 Outlook
  | 'pending'       // 等待同步
  | 'conflict'      // 同步冲突
  | 'error';        // 同步失败
```

**修复文档**: SYNC_MECHANISM_PRD Section 2（Event 数据结构）

---

### Issue #4: PlanManager 与 Timer 的交互未记录

**问题描述**:
- PlanManager PRD 中提到"Plan 转 Event 流程"，但未说明与 Timer 的交互
- Timer PRD 中也未提及如何处理 Plan Item

**影响范围**:
- PlanManager PRD（Plan Item 启动 Timer）
- Timer PRD（Timer 关联的事件可能是 Plan Item）

**建议**:
在 Timer PRD 中补充章节"与 PlanManager 的集成"，说明：
1. Timer 可以通过 `eventId` 关联 Plan Item
2. PlanManager 中的"开始计时"按钮触发 `TimerService.startTimer(planItemId)`
3. Timer 结束后，更新 Plan Item 的 `duration` 字段

**修复文档**: Timer PRD Section 7（新增章节）

---

## 📊 Cross-Check 统计

| 检查项 | 通过 | 待补充 | 不一致 |
|--------|------|--------|--------|
| **EventHub API** | 4 | 1 | 0 |
| **TimeHub API** | 2 | 0 | 0 |
| **localStorage 键名** | 4 | 0 | 0 |
| **TagService API** | 2 | 0 | 0 |
| **数据格式** | 0 | 2 | 1 |
| **模块交互** | 0 | 1 | 0 |
| **合计** | **12** | **4** | **1** |

---

## 🔧 修复优先级

| 优先级 | Issue | 预计工时 | 建议修复文档 |
|--------|-------|----------|--------------|
| 🔴 高 | Issue #1（Event.tags 格式） | 1h | TagManager PRD Section 2.1 |
| 🟡 中 | Issue #2（EventHub 返回值） | 30min | SYNC_MECHANISM_PRD Section 3 |
| 🟡 中 | Issue #3（syncStatus 枚举） | 30min | SYNC_MECHANISM_PRD Section 2 |
| 🟢 低 | Issue #4（PlanManager↔Timer） | 1h | Timer PRD Section 7（新增） |

---

## ✅ 总体评估

**一致性得分**: 12/17 = **70.6%**

**评价**:
- ✅ **核心 API 一致性良好**（EventHub、TimeHub、TagService）
- ✅ **localStorage 键名完全一致**
- ⚠️ **数据格式需要补充定义**（Event.tags、syncStatus）
- ⚠️ **模块交互需要补充说明**（PlanManager↔Timer）

**建议**:
1. 优先修复 Issue #1（Event.tags 格式），影响范围最大
2. 批量修复 Issue #2-3（补充定义），工作量较小
3. 最后补充 Issue #4（模块交互），可在后续迭代中完成

---

**相关文档**:
- [SYNC_MECHANISM_PRD](./SYNC_MECHANISM_PRD.md)
- [TIMER_MODULE_PRD](./TIMER_MODULE_PRD.md)
- [TIMECALENDAR_MODULE_PRD](./TIMECALENDAR_MODULE_PRD.md)
- [EVENTEDITMODAL_MODULE_PRD](./EVENTEDITMODAL_MODULE_PRD.md)
- [TAGMANAGER_MODULE_PRD](./TAGMANAGER_MODULE_PRD.md)
- [PLANMANAGER_MODULE_PRD](./PLANMANAGER_MODULE_PRD.md)
