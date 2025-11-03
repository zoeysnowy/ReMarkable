# Event 显示逻辑文档

## 核心原则

**所有 PlanItem 都会创建 Event（都有 eventId）**，只是根据时间字段的完整性，在 TimeCalendar 中有不同的显示方式。

## TimeCalendar 显示规则

### 1. 日程（Time 色块）
**条件**：有精确的开始时间和结束时间

```typescript
if (item.startTime && item.endTime && !item.isAllDay) {
  category = 'time';
  // 显示为时间轴上的彩色色块
}
```

**示例**：
- `startTime: "2025-11-04T09:00:00"`
- `endTime: "2025-11-04T10:30:00"`
- 显示为：9:00-10:30 的色块

---

### 2. 全天事件（AllDay 行）
**条件**：仅有日期或日期段（时刻为 00:00:00）

```typescript
if (item.isAllDay || (bothMidnight && sameDay)) {
  category = 'allday';
  // 显示在 AllDay 行
}
```

**示例**：
- `startTime: "2025-11-04T00:00:00"`
- `endTime: "2025-11-04T00:00:00"`
- `isAllDay: true`
- 显示为：AllDay 行的彩色块

---

### 3. 任务（Task 行）
**条件**：其余所有情况

#### 3.1 只有开始时间（结束时间为 null）
```typescript
if (item.startTime && !item.endTime) {
  category = 'task';
  finalStartTime = item.startTime;
  finalEndTime = item.startTime; // Task 日期 = 开始日期
}
```

**示例**：
- `startTime: "2025-11-04T14:00:00"`
- `endTime: null`
- 显示为：11月4日的 Task 行

#### 3.2 只有结束时间（开始时间为 null）
```typescript
if (!item.startTime && item.endTime) {
  category = 'task';
  finalStartTime = item.endTime;
  finalEndTime = item.endTime; // Task 日期 = 结束日期
}
```

**示例**：
- `startTime: null`
- `endTime: "2025-11-05T18:00:00"`
- 显示为：11月5日的 Task 行

#### 3.3 完全没有约定时间
```typescript
if (!item.startTime && !item.endTime) {
  category = 'task';
  // Task 日期 = 创建日期（从 item.id 提取时间戳）
  const createdDate = extractTimestampFromId(item.id);
  finalStartTime = createdDate;
  finalEndTime = createdDate;
}
```

**示例**：
- `startTime: null`
- `endTime: null`
- `item.id: "line-1730707200000"` (创建于 2025-11-04)
- 显示为：11月4日的 Task 行

---

### 4. 截止日期（DDL/Milestone 行）
**条件**：用户勾选了 DDL 标记（未来功能）

```typescript
if (item.isMilestone || item.isDDL) {
  category = 'milestone';
  // 显示在 DDL/Milestone 行
}
```

**注**：此功能待开发，用户可通过 FloatingBar 菜单勾选。

---

## Event 字段说明

### `isTask` 字段
决定事件的类型和同步目标：

- `isTask = false`：
  - 日程（time/allday）
  - 同步到 **Outlook Calendar**

- `isTask = true`：
  - 任务（task）
  - 同步到 **Microsoft To Do**（待实现）

### `category` 字段
TUI Calendar 使用的分类：
- `'time'`：时间色块
- `'allday'`：全天行
- `'task'`：任务行
- `'milestone'`：里程碑/截止日期行

---

## 代码实现位置

### 1. `syncToUnifiedTimeline` (PlanManager.tsx)
负责判断时间完整性，设置 `isTask` 和 `finalStartTime/finalEndTime`。

### 2. `convertToCalendarEvent` (calendarUtils.ts)
根据 `event.isTask` 和 `event.isAllDay` 设置 TUI Calendar 的 `category`。

### 3. TimeCalendar 显示配置
```typescript
week: {
  taskView: ['milestone', 'task'], // 显示 DDL 和 Task 行
  eventView: ['time', 'allday'],   // 显示时间色块和全天行
}
```

---

## 用户操作流程

### 创建日程
1. 用户在 Plan 页面输入文本
2. 点击右侧时间显示或使用 FloatingToolbar
3. 通过 UnifiedDateTimePicker 设置**完整的开始和结束时间**
4. Event 创建，`isTask = false`
5. 显示在 TimeCalendar 的时间色块中

### 创建任务
1. 用户在 Plan 页面输入文本
2. 通过 Picker 只设置**部分时间**（仅开始或仅结束）
3. 或者不设置任何时间（使用创建日期）
4. Event 创建，`isTask = true`
5. 显示在 TimeCalendar 的 Task 行中

### 创建全天事件
1. 用户设置时间，勾选"全天"选项
2. 或者设置的时间恰好是同一天的 00:00:00
3. Event 创建，`isAllDay = true`
4. 显示在 TimeCalendar 的 AllDay 行中

---

## 数据流

```
PlanItem (用户输入)
    ↓
syncToUnifiedTimeline (判断时间完整性)
    ↓
Event (统一数据结构)
    ├─ isTask: boolean
    ├─ isAllDay: boolean
    ├─ startTime: string
    └─ endTime: string
    ↓
convertToCalendarEvent (转换为 TUI Calendar 格式)
    ↓
EventObject (TUI Calendar)
    └─ category: 'time' | 'allday' | 'task' | 'milestone'
    ↓
TimeCalendar (可视化显示)
```

---

## 注意事项

1. **所有 PlanItem 都会创建 Event**，即使没有设置时间
2. **没有时间的任务使用创建日期**，从 `item.id` 的时间戳提取
3. **DDL 功能待开发**，目前 milestone 行暂未使用
4. **同步到 Microsoft To Do 待实现**，目前所有事件都同步到 Outlook Calendar

---

*最后更新：2025-11-04*
