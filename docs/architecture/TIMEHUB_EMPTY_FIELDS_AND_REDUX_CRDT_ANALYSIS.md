# TimeHub 空字段支持与 Redux+CRDT 架构分析

> **创建时间**: 2025-11-06  
> **问题来源**: PlanManager ↔ Slate 交互机制优化讨论  
> **关联文档**: [PLANMANAGER_MODULE_PRD § 16](./PRD/PLANMANAGER_MODULE_PRD.md#16-planmanager--unifiedslateeditor-交互机制)

---

## 📋 目录

1. [问题 1: TimeHub 时间字段自动补充机制分析](#问题-1-timehub-时间字段自动补充机制分析)
2. [问题 2: Redux 状态管理与 CRDT 结合方案](#问题-2-redux-状态管理与-crdt-结合方案)

---

## 问题 1: TimeHub 时间字段自动补充机制分析

### 1.1 当前问题描述

**现象**: PlanManager 传递给 Slate 时过滤了 `startTime`/`endTime` 字段，但这些字段会被 TimeHub 自动补充默认值。

**代码位置**: `src/services/TimeHub.ts` L120-128

```typescript
const normalize = (v?: string | Date) => {
  if (!v) return undefined;  // ✅ 如果输入为空，返回 undefined
  const d = v instanceof Date ? v : parseLocalTimeString(v);
  return formatTimeForStorage(d);
};

const start = normalize(input.start);
const end = normalize(input.end ?? input.start);  // ⚠️ end 默认使用 start
```

**问题点**:
1. `normalize()` 函数本身支持返回 `undefined`
2. 但是 L127 的逻辑 `input.end ?? input.start` 会导致 end 使用 start 的值
3. L158-159 的合并逻辑会保留 existing 值：
   ```typescript
   startTime: timeSpec.start ?? existing.startTime,
   endTime: timeSpec.end ?? existing.endTime,
   ```

### 1.2 根本原因分析

**并非 TimeHub 强制补充时间，而是合并逻辑保留了旧值**：

```typescript
// TimeHub.ts L152-164
const existing = EventService.getEventById(eventId);

const updated: Partial<Event> = {
  startTime: timeSpec.start ?? existing.startTime,  // ⚠️ 保留旧值
  endTime: timeSpec.end ?? existing.endTime,        // ⚠️ 保留旧值
  isAllDay: timeSpec.allDay ?? existing.isAllDay,
};
```

**实际流程**:
```
用户在 Slate 删除时间标签
  ↓
PlanManager onChange(updatedItems)
  - updatedItems[0].startTime = undefined (Slate 不返回时间字段)
  ↓
PlanManager 合并 existingItem
  - mergedItem.startTime = existingItem.startTime || updatedItem.startTime
  - 结果：保留了旧的时间值
  ↓
TimeHub.setEventTime 从未被调用（因为 Slate 不管理时间）
```

**结论**: **问题不在 TimeHub，而在 PlanManager 的字段合并逻辑**。

---

### 1.3 支持空时间字段的可行性分析

#### 方案 A: TimeHub 原生支持删除时间

**修改点 1**: 增加显式的 "删除时间" 语义

```typescript
// TimeHub.ts
export type SetEventTimeInput = {
  start?: string | Date | null;  // 🆕 支持 null 表示删除
  end?: string | Date | null;    // 🆕 支持 null 表示删除
  clearTime?: boolean;           // 🆕 显式删除时间标识
  // ... 其他字段
};

async setEventTime(eventId: string, input: SetEventTimeInput) {
  // 处理删除时间的逻辑
  if (input.clearTime || input.start === null) {
    const updated: Partial<Event> = {
      startTime: undefined,  // ❌ 但 Event 类型不允许 undefined！
      endTime: undefined,
      timeSpec: undefined,
    };
    return EventService.updateEvent(eventId, updated);
  }
  
  // ... 原逻辑
}
```

**问题**: `Event` 类型定义中 `startTime?: string` 是可选字段，但 TypeScript 的 `Partial<Event>` 无法区分 "未传递" 和 "显式设为 undefined"。

---

#### 方案 B: 使用特殊标记值

```typescript
// TimeHub.ts
const CLEAR_TIME_MARKER = '__CLEAR_TIME__';

export type SetEventTimeInput = {
  start?: string | Date | typeof CLEAR_TIME_MARKER;
  end?: string | Date | typeof CLEAR_TIME_MARKER;
  // ...
};

async setEventTime(eventId: string, input: SetEventTimeInput) {
  const updated: Partial<Event> = {};
  
  if (input.start === CLEAR_TIME_MARKER) {
    // 使用特殊处理删除 startTime
    const existing = EventService.getEventById(eventId);
    updated.startTime = '';  // ✅ 空字符串表示删除
  } else if (input.start) {
    updated.startTime = normalize(input.start);
  }
  
  // ... 同理处理 end
}
```

**优点**:
- ✅ 明确区分 "未传递" 和 "删除"
- ✅ TypeScript 类型安全

**缺点**:
- ⚠️ 需要修改所有调用 TimeHub 的地方
- ⚠️ 空字符串 `''` 可能与 "无时间" 的语义混淆

---

#### 方案 C: 修改 Event 类型定义（推荐）

```typescript
// types.ts
export interface Event {
  // ... 其他字段
  
  // 🆕 时间字段改为严格可选（使用 | undefined）
  startTime?: string | undefined;  // 明确支持 undefined
  endTime?: string | undefined;
  timeSpec?: TimeSpec | undefined;
}
```

**配合 EventService 的删除逻辑**:

```typescript
// EventService.ts
export async function updateEvent(
  eventId: string, 
  updates: Partial<Event>,
  skipSync?: boolean
): Promise<Result> {
  const existing = getEventById(eventId);
  
  // ✅ 处理显式的 undefined（删除字段）
  const merged = { ...existing };
  
  for (const key in updates) {
    if (updates[key] === undefined && key in updates) {
      // 显式传递了 undefined，删除该字段
      delete merged[key];
    } else {
      merged[key] = updates[key];
    }
  }
  
  // ... 保存逻辑
}
```

**优点**:
- ✅ 语义清晰
- ✅ 符合 TypeScript 最佳实践
- ✅ 无需特殊标记值

**缺点**:
- ⚠️ 需要修改 EventService 的合并逻辑
- ⚠️ 可能影响现有代码

---

### 1.4 风险评估与规避

#### 风险 1: UI 组件假设时间字段存在

**影响组件**:
- `PlanItemTimeDisplay`: 使用 `useEventTime(itemId)` 订阅时间
- `TimeCalendar`: 日历网格依赖 `startTime`/`endTime` 计算位置
- `EventEditModal`: 时间选择器显示当前时间

**风险等级**: 🔴 **高**

**规避方案**:
```typescript
// PlanItemTimeDisplay.tsx
const { start, end } = useEventTime(itemId);

// ❌ 错误：假设 start 存在
const startDate = new Date(start);

// ✅ 正确：检查空值
if (!start) {
  return <span>无时间</span>;
}
const startDate = new Date(start);
```

**全局修复策略**:
```typescript
// hooks/useEventTime.ts
export function useEventTime(eventId: string) {
  const timeData = useSyncExternalStore(
    (onStoreChange) => TimeHub.subscribe(eventId, onStoreChange),
    () => TimeHub.getSnapshot(eventId),
    () => ({})  // SSR fallback
  );
  
  // ✅ 返回安全的默认值
  return {
    start: timeData.start || null,  // 明确返回 null 而非 undefined
    end: timeData.end || null,
    timeSpec: timeData.timeSpec || null,
    hasTime: !!(timeData.start || timeData.end),  // 🆕 便捷判断
  };
}
```

---

#### 风险 2: 日历同步逻辑依赖时间字段

**影响代码**: `src/services/OutlookSyncService.ts`

**问题**:
```typescript
// OutlookSyncService.ts
function canSync(event: Event): boolean {
  // ❌ 假设 startTime 存在
  return event.remarkableSource && event.startTime && event.endTime;
}
```

**风险等级**: 🟡 **中**

**规避方案**:
```typescript
function canSync(event: Event): boolean {
  // ✅ 明确检查时间字段
  const hasTime = !!(event.startTime && event.endTime);
  return event.remarkableSource && hasTime;
}
```

---

#### 风险 3: 数据库查询依赖时间字段

**影响场景**: 按日期范围查询事件

```typescript
// ❌ 错误：空时间字段会导致查询失败
function getEventsInRange(start: Date, end: Date): Event[] {
  return events.filter(e => {
    const eventStart = new Date(e.startTime);  // ⚠️ 空字符串会变成 Invalid Date
    return eventStart >= start && eventStart <= end;
  });
}

// ✅ 正确：过滤无时间的事件
function getEventsInRange(start: Date, end: Date): Event[] {
  return events.filter(e => {
    if (!e.startTime) return false;  // 跳过无时间的事件
    const eventStart = new Date(e.startTime);
    return eventStart >= start && eventStart <= end;
  });
}
```

**风险等级**: 🟡 **中**

---

#### 风险 4: TimeHub 订阅者收到空快照

**影响场景**: `useEventTime` Hook 订阅的组件

```typescript
// useEventTime.ts
const timeData = TimeHub.getSnapshot(eventId);
// timeData = { start: undefined, end: undefined }

// ❌ 组件可能报错
const startDate = new Date(timeData.start);  // Invalid Date
```

**风险等级**: 🔴 **高**

**规避方案**:
```typescript
// TimeHub.ts
getSnapshot(eventId: string): TimeGetResult {
  const res = this.loadFromEventService(eventId);
  
  // ✅ 返回安全的快照（明确标记无时间）
  return {
    timeSpec: res.timeSpec || null,
    start: res.start || null,
    end: res.end || null,
    hasTime: !!(res.start || res.end),  // 🆕 便捷判断
  };
}
```

---

### 1.5 推荐方案：渐进式支持空时间字段

**阶段 1: 增强类型安全（1 天）**

```typescript
// 1. 修改 types.ts
export interface Event {
  startTime?: string | null;  // 明确支持 null
  endTime?: string | null;
  timeSpec?: TimeSpec | null;
}

// 2. 修改 TimeHub.getSnapshot 返回类型
interface TimeGetResult {
  timeSpec?: TimeSpec | null;
  start?: string | null;
  end?: string | null;
  hasTime: boolean;  // 🆕 便捷判断
}

// 3. 修改 useEventTime Hook
export function useEventTime(eventId: string) {
  const timeData = useSyncExternalStore(/* ... */);
  return {
    ...timeData,
    hasTime: !!(timeData.start || timeData.end),
  };
}
```

**阶段 2: 修复高危组件（2 天）**

```typescript
// 1. PlanItemTimeDisplay.tsx - 添加空值检查
if (!timeData.hasTime) {
  return <span className="no-time">无时间</span>;
}

// 2. TimeCalendar.tsx - 过滤无时间的事件
const timedEvents = events.filter(e => e.startTime && e.endTime);

// 3. EventEditModal.tsx - 时间选择器显示占位符
const startValue = event.startTime || '';  // 空字符串显示 placeholder
```

**阶段 3: 支持显式删除时间（3 天）**

```typescript
// TimeHub.ts
export type SetEventTimeInput = {
  start?: string | Date | null;  // null 表示删除
  end?: string | Date | null;
  clearTime?: boolean;  // 显式删除标识
  // ...
};

async setEventTime(eventId: string, input: SetEventTimeInput) {
  if (input.clearTime || (input.start === null && input.end === null)) {
    // 删除时间字段
    const updated: Partial<Event> = {
      startTime: null,
      endTime: null,
      timeSpec: null,
    };
    return EventService.updateEvent(eventId, updated);
  }
  
  // ... 原逻辑
}
```

**阶段 4: 全面测试（2 天）**

- 测试 PlanManager 删除时间标签
- 测试 TimeCalendar 显示无时间事件
- 测试 Outlook 同步跳过无时间事件
- 测试 EventEditModal 编辑无时间事件

---

### 1.6 空时间字段的语义定义

| 字段值 | 语义 | 显示 | 同步行为 |
|-------|------|------|---------|
| `startTime: "2025-11-06T09:00:00"` | 有明确时间 | 显示时间 | 同步到 Outlook |
| `startTime: ""` | 空字符串（历史遗留） | 显示 "无时间" | 跳过同步 |
| `startTime: null` | 显式删除时间 | 显示 "无时间" | 跳过同步 |
| `startTime: undefined` | 未设置（新建事件） | 显示 "设置时间" | 跳过同步 |

**推荐统一为 `null`**:
- ✅ 语义明确（显式删除）
- ✅ TypeScript 支持
- ✅ JSON 序列化友好

---

## 问题 2: Redux 状态管理与 CRDT 结合方案

### 2.1 Redux 核心原理

#### 什么是 Redux？

Redux 是一个**可预测的状态容器**，基于 Flux 架构，核心概念：

```
┌─────────────────────────────────────────────────────┐
│                    Redux Store                      │
│  ┌───────────────────────────────────────────────┐  │
│  │          State Tree (单一数据源)             │  │
│  │  {                                            │  │
│  │    events: [...],                             │  │
│  │    tags: [...],                               │  │
│  │    ui: { loading, selectedDate }              │  │
│  │  }                                            │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
         ↑                         ↓
    getState()                 dispatch(action)
         ↑                         ↓
┌──────────────┐          ┌──────────────┐
│  Component   │ ────────→│   Action     │
│  (React UI)  │          │  { type, ... }│
└──────────────┘          └──────────────┘
                                 ↓
                          ┌──────────────┐
                          │   Reducer    │
                          │ (pure func)  │
                          └──────────────┘
                                 ↓
                          New State Tree
```

#### Redux 三大原则

1. **单一数据源 (Single Source of Truth)**
   - 整个应用的 state 存储在一个对象树中
   - 便于调试、时间旅行、状态持久化

2. **State 是只读的 (State is Read-Only)**
   - 唯一改变 state 的方法是 dispatch action
   - 保证修改的可追踪性

3. **使用纯函数修改 (Changes are Made with Pure Functions)**
   - Reducer 必须是纯函数: `(state, action) => newState`
   - 可预测、易测试、支持时间旅行

---

### 2.2 Redux vs EventHub/TimeHub 对比

| 特性 | Redux | EventHub/TimeHub |
|------|-------|------------------|
| **状态管理** | 全局 state tree | 分散的 Map 缓存 |
| **更新机制** | action → reducer → new state | 直接调用 updateFields() |
| **可预测性** | ✅ 纯函数，可重放 | ⚠️ 副作用多，难调试 |
| **时间旅行** | ✅ 内置支持（Redux DevTools） | ❌ 不支持 |
| **订阅机制** | ✅ connect() / useSelector() | ✅ subscribe() / useSyncExternalStore |
| **中间件** | ✅ 支持异步、日志、错误监控 | ❌ 不支持 |
| **学习曲线** | 🟡 中等（需要理解 action/reducer） | 🟢 低（直接 API 调用） |
| **代码量** | 🔴 多（需要 actions/reducers） | 🟢 少 |

---

### 2.3 为什么需要 Redux？

#### 当前架构的痛点

1. **状态分散**:
   ```typescript
   // PlanManager.tsx
   const [items, setItems] = useState<Event[]>([]);
   const [selectedDate, setSelectedDate] = useState<string>('');
   const [loading, setLoading] = useState(false);
   
   // EventHub.ts
   private cache: Map<string, EventSnapshot> = new Map();
   
   // TimeHub.ts
   private cache = new Map<string, TimeGetResult>();
   ```
   **问题**: 状态散落在多个地方，难以追踪数据流

2. **缺乏可预测性**:
   ```typescript
   // ❌ 当前：副作用多，难以调试
   await EventHub.updateFields(eventId, { title: 'New' });
   // 内部调用 EventService.updateEvent
   // 触发 eventsUpdated 事件
   // 更新 cache
   // 通知所有订阅者
   ```

3. **无法时间旅行**:
   - 无法回溯到某个操作前的状态
   - 无法重放用户操作序列
   - 难以复现 bug

4. **测试困难**:
   ```typescript
   // ❌ 当前：需要 mock EventService, TimeHub, localStorage
   test('update event title', async () => {
     // 需要复杂的 setup
   });
   
   // ✅ Redux：只需测试 reducer（纯函数）
   test('update event title', () => {
     const state = { events: [{ id: '1', title: 'Old' }] };
     const action = { type: 'UPDATE_EVENT_TITLE', id: '1', title: 'New' };
     const newState = reducer(state, action);
     expect(newState.events[0].title).toBe('New');
   });
   ```

---

### 2.4 Redux 架构设计

#### 完整的 Redux Store 结构

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from './slices/eventsSlice';
import tagsReducer from './slices/tagsSlice';
import uiReducer from './slices/uiSlice';

export const store = configureStore({
  reducer: {
    events: eventsReducer,
    tags: tagsReducer,
    ui: uiReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略 Date 对象的序列化检查
        ignoredActions: ['events/updateEventTime'],
      },
    }),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
```

#### Events Slice（事件管理）

```typescript
// store/slices/eventsSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Event } from '../../types';

interface EventsState {
  items: Event[];
  loading: boolean;
  error: string | null;
}

const initialState: EventsState = {
  items: [],
  loading: false,
  error: null,
};

const eventsSlice = createSlice({
  name: 'events',
  initialState,
  reducers: {
    // ✅ 纯函数：增量更新事件
    updateEventFields(state, action: PayloadAction<{ id: string; updates: Partial<Event> }>) {
      const { id, updates } = action.payload;
      const event = state.items.find(e => e.id === id);
      if (event) {
        Object.assign(event, updates);
      }
    },
    
    // ✅ 纯函数：添加事件
    addEvent(state, action: PayloadAction<Event>) {
      state.items.push(action.payload);
    },
    
    // ✅ 纯函数：删除事件
    deleteEvent(state, action: PayloadAction<string>) {
      state.items = state.items.filter(e => e.id !== action.payload);
    },
    
    // ✅ 纯函数：批量更新
    setEvents(state, action: PayloadAction<Event[]>) {
      state.items = action.payload;
    },
    
    // ✅ 更新时间字段（保留 TimeSpec）
    updateEventTime(state, action: PayloadAction<{
      id: string;
      start?: string | null;
      end?: string | null;
      timeSpec?: TimeSpec | null;
    }>) {
      const { id, start, end, timeSpec } = action.payload;
      const event = state.items.find(e => e.id === id);
      if (event) {
        event.startTime = start ?? event.startTime;
        event.endTime = end ?? event.endTime;
        (event as any).timeSpec = timeSpec ?? (event as any).timeSpec;
      }
    },
  },
});

export const { updateEventFields, addEvent, deleteEvent, setEvents, updateEventTime } = eventsSlice.actions;
export default eventsSlice.reducer;
```

#### 使用 Redux 的组件

```typescript
// PlanManager.tsx
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '../store';
import { updateEventFields, deleteEvent } from '../store/slices/eventsSlice';

function PlanManager() {
  // ✅ 从 Redux store 读取数据
  const events = useSelector((state: RootState) => state.events.items);
  const loading = useSelector((state: RootState) => state.events.loading);
  
  const dispatch = useDispatch();
  
  const handleUpdateTitle = (eventId: string, newTitle: string) => {
    // ✅ dispatch action（纯粹的数据描述）
    dispatch(updateEventFields({
      id: eventId,
      updates: { title: newTitle }
    }));
  };
  
  const handleDelete = (eventId: string) => {
    dispatch(deleteEvent(eventId));
  };
  
  return (
    <div>
      {events.map(event => (
        <EventItem 
          key={event.id} 
          event={event}
          onUpdateTitle={(title) => handleUpdateTitle(event.id, title)}
          onDelete={() => handleDelete(event.id)}
        />
      ))}
    </div>
  );
}
```

---

### 2.5 Redux + CRDT 结合方案

#### 为什么结合 CRDT？

| 需求 | Redux | CRDT (Yjs) | Redux + CRDT |
|------|-------|-----------|--------------|
| **单一数据源** | ✅ | ❌ (分布式) | ✅ Redux 作为本地真相 |
| **时间旅行** | ✅ | ❌ | ✅ Redux DevTools |
| **多用户协作** | ❌ | ✅ | ✅ Yjs 处理同步 |
| **离线支持** | ⚠️ 需额外实现 | ✅ | ✅ Yjs 自动合并 |
| **冲突解决** | ❌ | ✅ 自动 | ✅ Yjs 自动合并 |
| **实时同步** | ❌ | ✅ | ✅ Yjs WebSocket |

**结论**: Redux 管理**本地 UI 状态**，Yjs 管理**分布式协作状态**。

---

#### 架构图

```
┌──────────────────────────────────────────────────────┐
│                   React Components                    │
│  (useSelector 读取, dispatch 更新)                   │
└─────────────────────┬────────────────────────────────┘
                      │
                      ↓
┌──────────────────────────────────────────────────────┐
│                  Redux Store (本地)                   │
│  ┌────────────────────────────────────────────────┐  │
│  │  State: { events: [...], tags: [...] }        │  │
│  └────────────────────────────────────────────────┘  │
│         ↑                                  ↓          │
│    getState()                      dispatch(action)   │
└─────────┼──────────────────────────────────┼─────────┘
          │                                  │
          │ 🔄 双向同步                      │
          │                                  │
┌─────────┴──────────────────────────────────┴─────────┐
│               Redux-Yjs Middleware                    │
│  - Redux action → Yjs update                         │
│  - Yjs update → Redux action                         │
└─────────────────────┬────────────────────────────────┘
                      │
                      ↓
┌──────────────────────────────────────────────────────┐
│               Yjs CRDT Document (分布式)              │
│  ┌────────────────────────────────────────────────┐  │
│  │  Y.Array<Event>                               │  │
│  │  Y.Map<Tag>                                   │  │
│  └────────────────────────────────────────────────┘  │
│         ↑                                  ↓          │
│   encodeStateAsUpdate()         applyUpdate()         │
└─────────┼──────────────────────────────────┼─────────┘
          │                                  │
          │ 🌐 网络传输                      │
          │                                  │
┌─────────┴──────────────────────────────────┴─────────┐
│           Yjs WebSocket Provider (服务器)             │
│  - 广播 updates 到所有客户端                         │
│  - 持久化 CRDT 文档                                  │
└──────────────────────────────────────────────────────┘
```

---

#### 实现方案：Redux-Yjs Middleware

```typescript
// middleware/reduxYjsMiddleware.ts
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { Middleware } from 'redux';
import { setEvents, updateEventFields, addEvent, deleteEvent } from '../slices/eventsSlice';

// 创建 Yjs 文档
const ydoc = new Y.Doc();
const yevents = ydoc.getArray<Event>('events');

// 连接到协作服务器
const provider = new WebsocketProvider(
  'wss://your-server.com',
  'remarkable-room',
  ydoc
);

// ✅ 核心：双向同步
export const reduxYjsMiddleware: Middleware = (store) => {
  // 监听 Yjs 更新 → 同步到 Redux
  yevents.observe((event) => {
    const events = yevents.toArray();
    store.dispatch(setEvents(events));
  });
  
  return (next) => (action) => {
    const result = next(action);
    
    // 监听 Redux action → 同步到 Yjs
    switch (action.type) {
      case addEvent.type:
        yevents.push([action.payload]);
        break;
      
      case updateEventFields.type: {
        const { id, updates } = action.payload;
        const index = yevents.toArray().findIndex(e => e.id === id);
        if (index !== -1) {
          const event = yevents.get(index);
          yevents.delete(index, 1);
          yevents.insert(index, [{ ...event, ...updates }]);
        }
        break;
      }
      
      case deleteEvent.type: {
        const id = action.payload;
        const index = yevents.toArray().findIndex(e => e.id === id);
        if (index !== -1) {
          yevents.delete(index, 1);
        }
        break;
      }
    }
    
    return result;
  };
};
```

**配置 Redux Store**:

```typescript
// store/index.ts
import { configureStore } from '@reduxjs/toolkit';
import eventsReducer from './slices/eventsSlice';
import { reduxYjsMiddleware } from './middleware/reduxYjsMiddleware';

export const store = configureStore({
  reducer: {
    events: eventsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(reduxYjsMiddleware),
});
```

---

#### 使用示例：多用户实时协作

```typescript
// PlanManager.tsx
import { useSelector, useDispatch } from 'react-redux';
import { updateEventFields } from '../store/slices/eventsSlice';

function PlanManager() {
  const events = useSelector((state: RootState) => state.events.items);
  const dispatch = useDispatch();
  
  const handleUpdateTitle = (eventId: string, newTitle: string) => {
    // ✅ 只需 dispatch Redux action
    dispatch(updateEventFields({
      id: eventId,
      updates: { title: newTitle }
    }));
    
    // ✅ Middleware 自动同步到 Yjs
    // ✅ Yjs 自动广播到其他用户
    // ✅ 其他用户的 Redux store 自动更新
  };
  
  return (
    <div>
      {events.map(event => (
        <EventItem 
          key={event.id} 
          event={event}
          onUpdateTitle={(title) => handleUpdateTitle(event.id, title)}
        />
      ))}
    </div>
  );
}
```

**效果**:
1. 用户 A 修改事件标题 → dispatch action
2. Redux reducer 更新本地 state
3. Middleware 拦截 action → 转换为 Yjs update
4. Yjs WebSocket 广播到服务器
5. 服务器转发给用户 B
6. 用户 B 的 Yjs 收到 update → 触发 observe 回调
7. Middleware dispatch `setEvents` action
8. 用户 B 的 Redux store 更新
9. 用户 B 的 UI 自动刷新

**无冲突合并**:
- 用户 A 和 B 同时修改同一事件的不同字段 → Yjs 自动合并
- 用户 A 修改标题，用户 B 修改标签 → 两者都保留

---

### 2.6 Redux + CRDT 的优势

| 功能 | 实现方式 | 代码示例 |
|------|---------|---------|
| **时间旅行** | Redux DevTools | `store.dispatch({ type: '@@INIT' })` 回到初始状态 |
| **撤销/重做** | Redux Undo | `store.dispatch(ActionCreators.undo())` |
| **实时协作** | Yjs WebSocket | 自动同步，无需手动处理 |
| **离线编辑** | Yjs 增量更新 | 断网继续编辑，联网后自动合并 |
| **冲突解决** | CRDT 算法 | 多人同时编辑自动合并，无冲突 |
| **状态持久化** | Redux Persist | 自动保存到 localStorage |
| **性能优化** | Reselect | `const visibleEvents = useSelector(selectVisibleEvents)` |

---

### 2.7 实施路线图

#### 阶段 1: 引入 Redux（1 周）

```bash
npm install @reduxjs/toolkit react-redux
npm install --save-dev @types/react-redux
```

**任务**:
1. 创建 Redux store 和 slices
2. 迁移 PlanManager 到 Redux
3. 替换 EventHub.updateFields → dispatch(updateEventFields)
4. 测试基本功能

#### 阶段 2: 集成 Yjs（1 周）

```bash
npm install yjs y-websocket --legacy-peer-deps
```

**任务**:
1. 创建 Redux-Yjs Middleware
2. 配置 WebSocket Provider
3. 测试双向同步
4. 测试离线编辑

#### 阶段 3: 优化与扩展（1 周）

**任务**:
1. 添加 Redux DevTools 集成
2. 实现撤销/重做
3. 添加意识状态（显示其他用户光标）
4. 性能优化（Reselect）

---

### 2.8 代码量对比

| 架构 | 代码量 | 文件数 | 学习曲线 |
|------|-------|--------|---------|
| **当前 (EventHub/TimeHub)** | ~800 行 | 5 个 | 🟢 低 |
| **Redux** | ~1200 行 | 10 个 | 🟡 中 |
| **Redux + CRDT** | ~1500 行 | 12 个 | 🔴 高 |

**结论**: 代码量增加 ~87%，但收益巨大（时间旅行、实时协作、离线支持）。

---

## 📚 推荐学习资源

### Redux
- [Redux 官方文档](https://redux.js.org/)
- [Redux Toolkit 快速开始](https://redux-toolkit.js.org/tutorials/quick-start)
- [Redux DevTools Extension](https://github.com/reduxjs/redux-devtools)

### CRDT
- [Yjs 官方文档](https://docs.yjs.dev/)
- [CRDT 技术详解](https://crdt.tech/)
- [Figma 的实时协作架构](https://www.figma.com/blog/how-figmas-multiplayer-technology-works/)

### Redux + CRDT
- [Redux Middleware 详解](https://redux.js.org/understanding/history-and-design/middleware)
- [Yjs WebSocket Provider](https://github.com/yjs/y-websocket)
- [实时协作编辑器设计](https://josephg.com/blog/crdts-are-the-future/)

---

**创建时间**: 2025-11-06  
**作者**: GitHub Copilot  
**版本**: v1.0
