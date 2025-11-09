# getAllEvents() 调用链分析

## 问题现象
删除一个事件后，打开 Timer EditModal，TagPicker 无响应 2-3 分钟。

## 诊断数据
- **事件数量**: 1152 个
- **数据大小**: 1050 KB
- **删除一个事件后的 localStorage 操作**:
  - `setItem`: 1 次 (9-12ms) ✅ 快
  - `getItem`: **14 次** (每次 0-4.5ms) ⚠️ 频繁！

## getAllEvents() 的调用者分析

### 1. EventService 内部调用

**位置**: `src/services/EventService.ts`

| 方法 | 调用次数 | 触发时机 | 是否阻塞 UI |
|------|---------|---------|------------|
| `getEventById()` | 可能频繁 | 每次需要查找事件 | ❌ 同步，可能阻塞 |
| `createEvent()` | 低频 | 用户创建事件 | ❌ 同步 |
| `updateEvent()` | 低频 | 用户更新事件 | ❌ 同步 |
| `deleteEvent()` | 低频 | 用户删除事件 | ❌ 同步 |

**问题**: 
- ✅ EventService 自身调用不频繁
- ✅ `deleteEvent` 只调用 1 次 `getAllEvents()`

---

### 2. ConflictDetectionService (冲突检测)

**位置**: `src/services/ConflictDetectionService.ts`

| 方法 | 何时调用 | 是否阻塞 UI |
|------|---------|------------|
| `detectConflicts()` | EventEditModal 打开时，时间/参会人变化时 | ⚠️ **可能阻塞** |
| `detectAttendeeConflicts()` | 参会人冲突检测 | ⚠️ **可能阻塞** |
| `checkEventConflicts()` | 检查特定事件冲突 | ⚠️ **可能阻塞** |

**触发频率**:
- EventEditModal 打开: **1 次**
- 每次修改时间: **防抖 500ms 后 1 次**
- 每次修改参会人: **防抖 500ms 后 1 次**

**问题**:
- ⚠️ 对 **1152 个事件** 遍历检测冲突，O(n) 复杂度
- ⚠️ 每个事件都要 `parseLocalTimeString()` 两次（start/end）
- ✅ 已添加性能监控，日志显示只花了 **7.10ms**，不是主要问题

---

### 3. TimeCalendar.loadEvents() ⚠️ **重点嫌疑**

**位置**: `src/features/Calendar/TimeCalendar.tsx:327`

**调用方式**: 
```typescript
const loadEvents = useCallback(() => {
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  const parsedEvents = JSON.parse(savedEvents);
  setEvents(parsedEvents);
}, []);
```

**触发时机**:
1. 组件挂载 (useEffect)
2. `eventsUpdated` 事件监听器触发 (Line 533-561)
3. localStorage 监听器触发 (Line 480-531)
4. Timer polling 轮询 (Line 206-224)
5. 日期变化 (Line 593)

**问题**:
- ⚠️ **不使用 EventService.getAllEvents()**，直接读取 localStorage
- ⚠️ 删除事件后，`eventsUpdated` 事件触发 → `loadEvents()` 
- ❓ TimeCalendar 在首页还是 Calendar 页？如果不在当前页面，为什么还要加载？

---

### 4. App.tsx 事件回调

**位置**: `src/App.tsx`

| 回调方法 | 触发时机 | 是否在主线程 |
|---------|---------|-------------|
| `onEventCreated` | PlanManager 创建事件 | ✅ 是 |
| `onEventUpdated` | PlanManager 更新事件 | ✅ 是 |
| `onEventDeleted` | PlanManager 删除事件 | ✅ 是 |
| `onTimerEventSync` | Timer 同步 | ✅ 是 |

**每个回调都调用**:
```typescript
setAllEvents(EventService.getAllEvents());
```

**问题**:
- ⚠️ 删除事件 → App 重渲染 → 所有子组件重渲染
- ⚠️ `allEvents` 主要用于首页统计，但触发全局重渲染

---

### 5. EventHub / TimeHub

**位置**: 
- `src/services/EventHub.ts:44`
- `src/services/TimeHub.ts:36`

**用途**: 
- EventHub: 获取今日事件
- TimeHub: 时间相关计算（但代码只是调用，没用返回值？）

**问题**:
- ⚠️ TimeHub Line 36 只是调用 `getAllEvents()` 但没用返回值，可能是死代码

---

## ActionBasedSyncManager 的角色

### 是否频繁调用 getAllEvents()?

搜索结果显示：**ActionBasedSyncManager 不直接调用 EventService.getAllEvents()**

它有自己的方法：
```typescript
private saveLocalEvents(events: any[], rebuildIndex: boolean = true)
```

**工作流程**:
1. 接收事件数组（由调用者提供）
2. 保存到 localStorage
3. **如果 `rebuildIndex=true`，异步重建 IndexMap**

### 删除事件时的流程

```
1. EventService.deleteEvent()
   ↓
2. const existingEvents = this.getAllEvents()  // 读取 1152 个事件
   ↓
3. filter 删除事件
   ↓
4. localStorage.setItem(JSON.stringify(events))  // 9-12ms
   ↓
5. dispatchEvent('eventsUpdated')  // 触发全局事件
   ↓
6. ⚠️ 多个监听器触发:
   - TimeCalendar.handleEventsUpdated → loadEvents() → localStorage.getItem
   - App.onEventDeleted → setAllEvents(getAllEvents()) → localStorage.getItem
   - DailyStatsCard.handleStorageChange → localStorage.getItem
   ↓
7. ❓ syncManager.recordLocalAction('delete', ...)
   ↓
8. ❓ ActionBasedSyncManager 可能重建 IndexMap (异步，但占用资源)
```

---

## 根本原因假设

从日志来看：
- ✅ 删除操作本身很快 (9-12ms)
- ✅ 冲突检测很快 (7.10ms)
- ⚠️ **但 localStorage.getItem 被调用了 14 次**

### 可能的阻塞来源

#### 假设 1: IndexMap 重建阻塞 ❓
- ActionBasedSyncManager.rebuildEventIndexMapAsync() 虽然是异步的
- 但可能占用大量 CPU，导致 UI 卡顿
- **需要验证**: 是否每次删除都触发 `rebuildIndex=true`

#### 假设 2: 监听器雪崩 ⚠️
- `eventsUpdated` 事件触发多个监听器
- 每个监听器都读取 localStorage (1050 KB)
- 如果某个监听器又触发了其他操作，形成级联

#### 假设 3: TimeCalendar 在后台仍然轮询 ❓
- TimeCalendar 的 Timer polling 每 5 秒调用 `loadEvents()`
- 如果删除事件时恰好触发轮询，会重复加载

#### 假设 4: 同步操作阻塞 ❓❓❓
- `syncManager.recordLocalAction('delete', ...)` 
- 可能触发 Outlook API 调用
- 如果同步是同步的（非异步），会阻塞 UI
- **这是最可疑的！**

---

## 下一步诊断

### 优先级 P0: 验证同步操作是否阻塞

检查 `ActionBasedSyncManager.recordLocalAction()`:
1. 是否是同步调用？
2. 是否会触发网络请求？
3. 是否会触发 IndexMap 重建？

### 优先级 P1: 添加详细时间线

在 EventService.deleteEvent() 添加完整时间线:
```typescript
console.time('deleteEvent-total');
console.time('deleteEvent-getAllEvents');
const events = this.getAllEvents();
console.timeEnd('deleteEvent-getAllEvents');

console.time('deleteEvent-filter');
const updated = events.filter(...);
console.timeEnd('deleteEvent-filter');

console.time('deleteEvent-save');
localStorage.setItem(...);
console.timeEnd('deleteEvent-save');

console.time('deleteEvent-dispatch');
this.dispatchEventUpdate(...);
console.timeEnd('deleteEvent-dispatch');

console.time('deleteEvent-sync');
await syncManager.recordLocalAction(...);
console.timeEnd('deleteEvent-sync');

console.timeEnd('deleteEvent-total');
```

### 优先级 P2: 监控 IndexMap 重建

在 ActionBasedSyncManager.rebuildEventIndexMapAsync() 添加:
```typescript
console.log('🔧 [IndexMap] Rebuilding for', events.length, 'events...');
console.time('IndexMap-rebuild');
// ... rebuild logic
console.timeEnd('IndexMap-rebuild');
```

---

## 临时解决方案

1. **禁用冲突检测** - 如果不需要
2. **延迟 IndexMap 重建** - 只在空闲时重建
3. **添加事件缓存** - 避免频繁读取 localStorage
4. **优化监听器** - 合并多个监听器，使用防抖
