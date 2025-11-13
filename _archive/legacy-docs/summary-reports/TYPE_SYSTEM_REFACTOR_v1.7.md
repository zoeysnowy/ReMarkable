# 类型系统重构 v1.7

**日期**: 2025-11-08  
**范围**: GlobalTimer, Event, EventService API  
**影响**: App.tsx, types.ts, EventEditModal.tsx, ConflictDetectionService.ts

---

## 📋 重构总览

### 核心原则

> **Event 是唯一的信息容器（Single Source of Truth）**

所有业务数据都应存储在 `Event` 类型中，无论事件来自哪个页面（Plan/TimeCalendar/Timeline）。

---

## 🔄 主要变更

### 1. planEventId → parentEventId 重构

**问题**：`planEventId` 命名暗示只能关联 Plan 页面的事件，但实际上 Timer 可以关联任何事件。

**修改**：

| 文件 | 字段名 | 修改前 | 修改后 |
|------|--------|--------|--------|
| `types.ts` | GlobalTimer.planEventId | ❌ 特指 Plan 事件 | ✅ parentEventId（通用） |
| `App.tsx` | globalTimer.planEventId | ❌ 7 处使用 | ✅ parentEventId |

**代码对比**：

```typescript
// ❌ 修改前
export interface GlobalTimer {
  planEventId?: string;  // 关联的 Plan 事件 ID
}

const handleTimerStart = (tagId: string, planEventId?: string) => {
  // ...
  planEventId // 暗示只能关联 Plan 事件
};

// ✅ 修改后
export interface GlobalTimer {
  parentEventId?: string;  // 关联的父事件 ID（可以是任何事件）
}

const handleTimerStart = (tagId: string, parentEventId?: string) => {
  // ...
  parentEventId // 通用，不限定事件来源
};
```

**影响范围**：
- `src/types.ts`: GlobalTimer 接口定义
- `src/App.tsx`: 
  - useState 内联类型定义
  - handleTimerStart 函数签名
  - handleTimerStop 中的 7 处引用

---

### 2. Event 类型冲突修复

**问题**：应用的 `Event` 类型与 DOM 的 `Event` 类型冲突。

**修改**：

```typescript
// ❌ 修改前
const handleAuthChange = (event: Event) => {
  const customEvent = event as CustomEvent;
  // ❌ 编译错误：Event 类型不匹配
};

// ✅ 修改后
const handleAuthChange = (event: globalThis.Event) => {
  const customEvent = event as CustomEvent;
  // ✅ 明确使用 DOM Event 类型
};
```

**影响范围**：
- `src/App.tsx`: auth-state-changed 事件监听器

---

### 3. EventService API 统一

**问题**：代码中使用 `getEvents()`，但实际 API 是 `getAllEvents()`。

**修改**：

```typescript
// ❌ 修改前
const allEvents = await EventService.getEvents();
// ❌ 编译错误：getEvents 不存在

// ✅ 修改后
const allEvents = await EventService.getAllEvents();
// ✅ 使用正确的 API
```

**影响范围**：
- `src/services/ConflictDetectionService.ts`: 3 处修复
  - detectConflicts()
  - detectAttendeeConflicts()
  - findAvailableTimeSlot()

---

### 4. 时间解析函数简化

**问题**：EventEditModal 使用不存在的 `parseDateInput` 和 `parseTimeInput` 函数。

**修改**：

```typescript
// ❌ 修改前
const startStr = formData.isAllDay 
  ? formatTimeForStorage(parseDateInput(formData.startTime))
  : formatTimeForStorage(parseTimeInput(formData.startTime));
// ❌ 编译错误：函数不存在

// ✅ 修改后
const startStr = formatTimeForStorage(parseLocalTimeString(formData.startTime));
// ✅ 直接使用已有的工具函数
```

**影响范围**：
- `src/components/EventEditModal.tsx`: 冲突检测时间解析

---

## 📐 架构设计说明

### Timer ↔ Event 关联机制

```
┌─────────────────┐
│  GlobalTimer    │ 运行时状态
│  (App.tsx)      │
└────────┬────────┘
         │
         │ parentEventId
         │ (关联到父事件)
         ▼
┌─────────────────┐
│  Parent Event   │ 持久化数据
│  (EventService) │
│  - isPlan: true │
│  - timerLogs: []│ ◄─┐
└─────────────────┘   │
                      │
         ┌────────────┘
         │ 创建 Timer 事件后，更新父事件的 timerLogs
         │
         ▼
┌─────────────────┐
│  Timer Event    │ 持久化数据
│  (EventService) │
│  - isTimer: true│
│  - parentEventId│ (指向父事件)
└─────────────────┘
```

### 字段说明

| 字段 | 位置 | 类型 | 说明 |
|------|------|------|------|
| `parentEventId` | GlobalTimer | 运行时 | Timer 关联的父事件 ID（临时存储） |
| `parentEventId` | Event | 持久化 | Timer 事件指向的父事件 ID |
| `timerLogs` | Event | 持久化 | 父事件记录的 Timer 事件 ID 列表 |

### 数据流程

1. **启动 Timer**：
   ```typescript
   handleTimerStart(tagId, parentEventId)
   // parentEventId 可以是任何事件的 ID
   ```

2. **停止 Timer**：
   ```typescript
   // 创建 Timer 事件
   const timerEvent = {
     isTimer: true,
     parentEventId: globalTimer.parentEventId
   };
   await EventService.updateEvent(timerId, timerEvent);
   
   // 更新父事件
   if (globalTimer.parentEventId) {
     const parent = events.find(e => e.id === globalTimer.parentEventId);
     await EventService.updateEvent(globalTimer.parentEventId, {
       timerLogs: [...parent.timerLogs, timerId]
     });
   }
   ```

---

## 🎯 设计原则验证

### ✅ Single Source of Truth

- **Event** 是唯一的信息容器
- Timer、Plan、TimeCalendar 都使用 Event 存储数据
- GlobalTimer 只存储运行时状态，不存储业务数据

### ✅ 命名一致性

- `parentEventId` 在 GlobalTimer 和 Event 中含义一致
- 不使用特定页面名称（如 "plan"）作为字段名

### ✅ 类型安全

- 明确区分 DOM Event 和应用 Event
- 使用 TypeScript 严格类型检查
- API 命名与实现一致

---

## 📊 修改统计

| 类别 | 文件数 | 修改行数 | 影响范围 |
|------|--------|----------|----------|
| 类型定义 | 2 | 15 | GlobalTimer, Event |
| 业务逻辑 | 1 | 30 | App.tsx Timer 流程 |
| 服务层 | 1 | 6 | ConflictDetectionService |
| 组件层 | 1 | 4 | EventEditModal |
| **总计** | **5** | **55** | **类型系统** |

---

## 🧪 测试建议

### 1. Timer ↔ Event 关联测试

```typescript
// 测试场景
1. 从 Plan 事件启动 Timer
   - 验证 globalTimer.parentEventId === planEvent.id
   - 停止后验证 planEvent.timerLogs 包含新 Timer ID

2. 从 TimeCalendar 事件启动 Timer
   - 验证 globalTimer.parentEventId === calendarEvent.id
   - 停止后验证 calendarEvent.timerLogs 包含新 Timer ID

3. 独立启动 Timer（无父事件）
   - 验证 globalTimer.parentEventId === undefined
   - 停止后不更新任何父事件
```

### 2. 类型冲突测试

```typescript
// 验证 DOM Event 和应用 Event 不冲突
window.addEventListener('auth-state-changed', (event: globalThis.Event) => {
  const customEvent = event as CustomEvent;
  // 应能正常编译
});
```

### 3. API 一致性测试

```typescript
// 验证 EventService API 调用
const events = await EventService.getAllEvents();
// 应能正常获取所有事件
```

---

## 📝 迁移指南

### 对于新代码

1. **使用 parentEventId**，不使用 planEventId
2. **使用 globalThis.Event** 处理 DOM 事件
3. **使用 EventService.getAllEvents()** 获取所有事件
4. **使用 parseLocalTimeString()** 解析时间字符串

### 对于旧代码

如果有其他模块仍使用 `planEventId`，请按以下步骤迁移：

1. 搜索所有 `planEventId` 引用
2. 替换为 `parentEventId`
3. 更新相关注释和文档
4. 运行测试验证功能正常

---

## 🔗 相关文档

- [PlanManager PRD v1.7](./PRD/PLANMANAGER_MODULE_PRD.md)
- [Event Architecture](./EVENT_ARCHITECTURE.md)
- [Time Architecture](./TIME_ARCHITECTURE.md)

---

**变更记录**：

| 日期 | 版本 | 修改内容 |
|------|------|----------|
| 2025-11-08 | v1.7 | planEventId → parentEventId 重构 |
| 2025-11-08 | v1.7 | Event 类型冲突修复 |
| 2025-11-08 | v1.7 | EventService API 统一 |
| 2025-11-08 | v1.7 | 时间解析函数简化 |
