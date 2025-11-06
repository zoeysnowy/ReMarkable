# 统一时间架构# Unified Time Architecture

**最后更新**: 2025-11-06

> **重要更新**: PlanManager 迁移到 UnifiedSlateEditor 后，优化了时间管理逻辑：
> 1. 只有有时间字段的事件才同步到 Calendar
> 2. FloatingBar onTimeApplied 简化，UnifiedSlateEditor 自动保存内容

本文档说明应用中的统一时间模型和集成策略。核心目标：**任何组件修改一个事件的时间时,所有关联组件自动同步更新，同时保留用户的原始意图（如"下周"）**。This document outlines the unified time model and integration strategy used across the app. The goal is: any component that changes one event's time immediately updates all others consistently, while preserving the original user intent (e.g., "下周").



## 核心概念## Core concepts



### TimeSpec（时间规格）- TimeSpec

捕获用户意图和标准化值的完整时间描述。  - Captures both intent and normalized values.

  - Fields:

**字段说明：**    - kind: 'fixed' | 'range' | 'all-day' | 'deadline' | 'window' | 'fuzzy'

- `kind`: 时间类型    - source: 'picker' | 'parser' | 'timer' | 'import' | 'system'

  - `'fixed'` - 固定时刻（开始=结束或短时间段）    - rawText: original text (e.g., "下周")

  - `'range'` - 明确的起止范围    - policy: overrides (weekStart, defaultTimeOfDay, windowResolution)

  - `'all-day'` - 全天事件    - resolved: { start, end } used for display/sync decisions

  - `'deadline'` - 截止时间    - window: { start, end, label } for window-type intents

  - `'window'` - 灵活时间窗口（如"下周一到周日"）    - start/end/allDay: normalized values for storage

  - `'fuzzy'` - 待解析的模糊描述

- `source`: 来源标记 - `'picker'` | `'parser'` | `'timer'` | `'import'` | `'system'`- TimePolicy

- `rawText`: 原始输入文本（如用户输入的"下周"）  - Default policy lives in `src/config/time.config.ts`.

- `policy`: 策略覆盖（weekStart、defaultTimeOfDay、windowResolution）  - weekStart: 0 (Sun) | 1 (Mon) — default 1

- `resolved`: `{ start, end }` 用于显示和同步的具体时间  - windowResolution: 'snap-to-start' | 'snap-to-end' | 'window-only'

- `window`: `{ start, end, label }` 窗口类型的边界和标签  - defaultTimeOfDay: e.g., '09:00'

- `start`/`end`/`allDay`: 存储用的标准化值

- TimeHub (src/services/TimeHub.ts)

### TimePolicy（时间策略）  - The single source of truth for event time. Holds the latest TimeSpec for each event and orchestrates reads/writes.

默认策略配置位于 `src/config/time.config.ts`。  - API:

    - subscribe(eventId): subscribe to updates

**配置项：**    - getSnapshot(eventId): current TimeSpec + normalized times

- `weekStart`: 每周起始日 - `0`（周日）或 `1`（周一），默认 `1`    - setEventTime(eventId, input): set fixed/range/all-day times

- `windowResolution`: 窗口解析方式    - setFuzzy(eventId, rawText, options?): parse and apply natural language times via TimeParsingService

  - `'snap-to-start'` - 锁定到窗口开始  - Integrates with EventService to persist time + TimeSpec onto events and dispatches `timeChanged` for UI updates.

  - `'snap-to-end'` - 锁定到窗口结束

  - `'window-only'` - 仅保留窗口不具体化- useEventTime (src/hooks/useEventTime.ts)

- `defaultTimeOfDay`: 默认时刻，如 `'09:00'`  - React hook providing a stable, per-event subscription via `useSyncExternalStore`.

  - Returns a snapshot of TimeSpec + normalized times, and `setEventTime` to update through TimeHub.

### TimeHub（时间中枢）  - When `eventId` is missing, returns a frozen empty snapshot to avoid update loops.

**位置：** `src/services/TimeHub.ts`  

**职责：** 事件时间的唯一真相源，持有每个事件的最新 TimeSpec 并协调读写。- TimeParsingService (src/services/TimeParsingService.ts)

  - Parses natural language into TimeSpec.

**API：**  - Special handling for Chinese week windows: "下周/本周/上周" → window with Mon..Sun bounds (policy-aware `weekStart`).

- `subscribe(eventId)` - 订阅某事件的时间更新  - Unit tests live in `src/__tests__/time/parsing.cn.week.test.ts`.

- `getSnapshot(eventId)` - 获取当前 TimeSpec 和标准化时间

- `setEventTime(eventId, input)` - 设置固定/范围/全天时间## Integration patterns

- `setFuzzy(eventId, rawText, options?)` - 通过 TimeParsingService 解析并应用自然语言时间

- `setTimerWindow(eventId, input)` - 计时器专用更新（跳过外部同步）- Components that edit time should:

  - Prefer passing `eventId` and `useTimeHub={true}` (e.g., UnifiedDateTimePicker, DateMentionPicker, EventEditModal).

**集成机制：**  - Call `TimeHub.setEventTime` or `TimeHub.setFuzzy` to update a single canonical Event.

- 通过 EventService 持久化时间和 TimeSpec 到事件对象  - For UI consistency, still render local visuals (e.g., date pill) but rely on TimeHub for the underlying data.

- 更新后派发 `timeChanged` 事件供 UI 订阅

- PlanItem ↔ Event unification

### useEventTime（React Hook）  - Event is the canonical record for business fields including time.

**位置：** `src/hooks/useEventTime.ts`    - PlanItem is a view over Event and should reference `eventId`.

**功能：** 基于 `useSyncExternalStore` 提供稳定的按事件订阅。  - If a PlanItem doesn’t have `eventId` yet, first apply the time action, then create a new Event via EventService and write back `eventId` to the PlanItem.



**返回值：**## Edge cases and guarantees

- TimeSpec 快照 + 标准化时间

- `setEventTime` 方法委托给 TimeHub- Missing eventId

  - Pickers still allow selection; upon apply, the parent handler should create an Event, persist time via EventService/TimeHub, then write back `eventId`.

**边界处理：**

- 当 `eventId` 缺失时，返回冻结的空快照以避免无限更新循环- Window vs. concrete start/end

  - Windows keep intent via `spec.window` while `spec.resolved` provides a concrete `start` for display/sync based on policy.

### TimeParsingService（时间解析服务）

**位置：** `src/services/TimeParsingService.ts`  - All-day vs time-of-day

**功能：** 将自然语言转换为 TimeSpec。  - All-day events set `allDay=true` and normalize start/end to midnight ranges in local time.



**特殊处理：**## Developer checklist (for time-enabled features)

- 中文周窗口："下周/本周/上周" → 根据策略 `weekStart` 生成周一到周日的窗口

- 单元测试：`src/__tests__/time/parsing.cn.week.test.ts`- [ ] Pass `eventId` and `useTimeHub={true}` when available

- [ ] Use `useEventTime(eventId)` for reading live snapshots

## 集成模式- [ ] Write via `TimeHub.setEventTime` / `setFuzzy` instead of mutating local state

- [ ] For new PlanItems, create/update Event and attach `eventId`

### 组件时间编辑规范- [ ] Keep UI decorations (e.g., date pills) in sync with the snapshot

**推荐做法：**- [ ] Add tests for new parsing or resolution rules

1. 传递 `eventId` 和 `useTimeHub={true}`（如 UnifiedDateTimePicker、DateMentionPicker、EventEditModal）

2. 调用 `TimeHub.setEventTime` 或 `TimeHub.setFuzzy` 更新规范化事件## Future work

3. UI 装饰（如日期胶囊）继续渲染，但底层数据依赖 TimeHub

- Timer integration helpers in TimeHub (focus-session windows)

### PlanItem ↔ Event 统一策略- Broader tests (TimeHub subscribe/set flows, EventService mocks)

**原则：**- Progressive migration to treat PlanItem purely as a view over Event

- Event 是业务字段（包括时间）的唯一真相源
- PlanItem 是 Event 的视图层，应引用 `eventId`

**无 eventId 时的处理：**
1. 先执行时间操作
2. 通过 EventService 创建新 Event
3. 将生成的 `eventId` 写回 PlanItem

## 边界情况与保证

### 缺失 eventId
选择器仍可正常选择；应用时，父组件应：
1. 创建 Event 并通过 EventService/TimeHub 持久化时间
2. 将 `eventId` 写回到 PlanItem

### 窗口 vs 具体时间
- 窗口通过 `spec.window` 保留意图
- `spec.resolved` 根据策略提供具体 `start` 用于显示和同步

### 全天 vs 具体时刻
- 全天事件设置 `allDay=true`
- 起止时间标准化为本地时间的午夜范围

## 开发者检查清单（时间功能）

- [ ] 有 `eventId` 时传递 `eventId` 和 `useTimeHub={true}`
- [ ] 使用 `useEventTime(eventId)` 读取实时快照
- [ ] 通过 `TimeHub.setEventTime` / `setFuzzy` 写入而非直接修改本地状态
- [ ] 新建 PlanItem 时创建/更新 Event 并关联 `eventId`
- [ ] 保持 UI 装饰（如日期胶囊）与快照同步
- [ ] 为新的解析或解析规则添加测试

## 后续工作

- 计时器专用 Helper 完善（专注时段窗口）
- 扩展测试（TimeHub 订阅/写入流程、EventService 模拟）
- 渐进式迁移：将 PlanItem 完全视为 Event 的视图层

---

## 🆕 PlanManager 时间管理优化 (2025-11-06)

### 优化 1: 智能时间同步

**问题**: 之前所有事件在保存时都会同步到 Calendar，即使没有时间信息。

**解决方案**: 添加 `hasAnyTime` 检查

```typescript
// PlanManager.tsx onChange 处理
changedItems.forEach(item => {
  onSave(item);
  
  // 只有当 item 有时间字段时才同步到 Calendar
  const hasAnyTime = !!(item.startTime || item.endTime || item.dueDate);
  
  if (hasAnyTime) {
    syncToUnifiedTimeline(item);
    console.log(`[✅ 同步时间] ${item.title}`);
  } else {
    console.log(`[⏭️ 跳过同步] ${item.title} - 无时间字段`);
  }
});
```

**用户体验改进**:
- ✅ 纯待办事项不会被强制定义时间
- ✅ 不会出现在日历视图中（除非用户主动添加时间）
- ✅ 减少不必要的 EventService 调用

### 优化 2: FloatingBar onTimeApplied 简化

**之前**: 需要手动获取 editor HTML 并保存

```typescript
// ❌ 旧代码 (SlateFreeFormEditor)
const editor = editorRegistryRef.current.get(targetId);
const updatedHTML = editor.getHTML();
const updatedItem = { 
  ...item, 
  content: updatedHTML,
  startTime: startIso,
  endTime: endIso,
};
onSave(updatedItem);
syncToUnifiedTimeline(updatedItem);
```

**现在**: UnifiedSlateEditor 自动保存，只需同步 EventService

```typescript
// ✅ 新代码 (UnifiedSlateEditor)
onTimeApplied={async (startIso, endIso) => {
  // TimeHub 已更新时间
  // UnifiedSlateEditor 的 onChange 会自动保存内容
  
  // 只需同步 EventService
  if (item.id) {
    await EventService.updateEvent(item.id, {
      title: item.title,
      description: item.description,
      tags: item.tags,
    });
  }
}}
```

**架构优势**:
- ✅ 代码更简洁：不再需要手动 `editor.getHTML()`
- ✅ 职责清晰：UnifiedSlateEditor 负责内容保存，TimeHub 负责时间管理
- ✅ 避免状态不一致：单一数据源，自动同步

### 优化 3: 时间字段检查逻辑

```typescript
/**
 * 检查事件是否有任何时间信息
 * 
 * @param item - Event 或 PlanItem
 * @returns true 如果有 startTime 或 endTime 或 dueDate
 */
function hasAnyTime(item: Event | PlanItem): boolean {
  return !!(item.startTime || item.endTime || item.dueDate);
}
```

**检查字段**:
- `startTime`: 开始时间（ISO 8601 字符串）
- `endTime`: 结束时间（ISO 8601 字符串）
- `dueDate`: 截止日期（ISO 8601 字符串）

**逻辑说明**:
- 使用 `!!` 转为布尔值
- 使用 `||` 短路求值
- 空字符串、null、undefined 都视为 false

### 集成 TimeHub 的最佳实践

**读取时间**:
```typescript
import { useEventTime } from '@/hooks/useEventTime';

const EventComponent = ({ eventId }) => {
  const { timeSpec, start, end, allDay, setEventTime } = useEventTime(eventId);
  
  return (
    <div>
      <p>Start: {start}</p>
      <p>End: {end}</p>
      <p>All Day: {allDay ? 'Yes' : 'No'}</p>
    </div>
  );
};
```

**设置固定时间**:
```typescript
setEventTime('fixed', {
  start: '2025-11-06T10:00:00',
  end: '2025-11-06T11:00:00',
});
```

**设置模糊时间（自然语言）**:
```typescript
import { TimeHub } from '@/services/TimeHub';

TimeHub.setFuzzy(eventId, '下周一 10:00', {
  policy: { weekStart: 1 }  // 周一为每周第一天
});
```

**检查是否有时间**:
```typescript
const hasTime = hasAnyTime(item);
if (hasTime) {
  syncToUnifiedTimeline(item);
}
```

### 相关代码

- **PlanManager.tsx** (L1070-1090): hasAnyTime 检查和同步逻辑
- **PlanManager.tsx** (L1100-1120): onTimeApplied 简化实现
- **TimeHub.ts**: 时间管理中枢，TimeSpec 规范化
- **useEventTime.ts**: React hook，订阅时间更新

### 性能影响

- ✅ 减少 EventService 调用：跳过无时间事件
- ✅ 减少网络请求：避免不必要的 API 调用
- ✅ 减少状态更新：UnifiedSlateEditor 自动保存，无需手动触发

### 兼容性

- ✅ 向后兼容：已有事件不受影响
- ✅ 数据一致性：不会修改已存在的时间数据
- ✅ 迁移平滑：无需数据迁移脚本

---

## 🎯 总结

统一时间架构的核心优势：

1. **单一真相源**: TimeHub 是时间数据的唯一来源
2. **自动同步**: 任何组件修改时间，所有关联组件自动更新
3. **保留意图**: TimeSpec 保存用户原始输入（如"下周"）
4. **智能同步**: 只有有时间的事件才同步到 Calendar（2025-11-06 新增）
5. **简化集成**: UnifiedSlateEditor 自动保存，无需手动获取 HTML（2025-11-06 新增）

**最佳实践**:
- 使用 `useEventTime` hook 读取时间
- 使用 `TimeHub.setEventTime` / `setFuzzy` 写入时间
- 使用 `hasAnyTime` 检查是否需要同步 Calendar
- 让 UnifiedSlateEditor 自动处理内容保存

