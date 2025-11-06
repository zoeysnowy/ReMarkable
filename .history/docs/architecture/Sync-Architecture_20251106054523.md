# 同步架构文档

**最后更新**: 2025-11-06

> **重要更新**: PlanManager 迁移到 UnifiedSlateEditor 后，优化了时间同步逻辑，避免强制定义时间。

本文档详细说明了 ReMarkable 的同步机制设计与优化。

---

##  目录
1. [同步机制详解](#同步机制详解)
2. [同步优化改进](#同步优化改进)

---

# 同步机制详解

# 同步机制文档 (Sync Mechanism)

## 概述

本文档详细说明 ReMarkable 的事件同步机制，包括 IndexMap 管理、增量更新策略和性能优化。

---

## IndexMap 架构

### 什么是 IndexMap？

`eventIndexMap` 是一个 `Map<string, Event>` 数据结构，用于实现 **O(1)** 时间复杂度的事件查找。

**索引策略：**
- `event.id` → Event对象（如 `timer-tag-xxx`, `outlook-AAMkAD...`）
- `event.externalId` → Event对象（纯 Outlook ID，无前缀）

**为什么需要双索引？**
- 通过 `id` 快速查找本地事件
- 通过 `externalId` 关联 Timer 事件和 Outlook 事件（防止重复）

---

## IndexMap 更新策略

### 1. 初始加载（服务启动）

**触发时机：** 应用启动或刷新页面

**流程：**
```typescript
getLocalEvents() 
  → IndexMap 为空？
    → 是：异步分批重建 rebuildEventIndexMapAsync()
    → 否：直接返回
```

**特点：**
- ✅ 异步分批处理，初始批大小 200 个事件
- ✅ 自适应批大小：根据首批性能动态调整
- ✅ 首批目标时间 5ms，确保快速响应
- ✅ 不阻塞主线程，用户可立即操作
- ✅ 优先处理可视区域的事件（如果提供 `visibleEventIds`）
- ✅ 在窗口失焦时加速处理剩余事件

**性能示例（月视图，620个可视事件）：**
```
最佳情况（高性能设备）：
  首批 200 个 → 5ms
  第二批 200 个 → 5ms（下一帧）
  第三批 220 个 → 5ms（下一帧）
  总时间：≈ 15ms ✅

最坏情况（低性能设备）：
  首批 200 个 → 10ms（触发调整）
  自动调整批大小 → 100 个/批
  后续 6 批 → 30ms
  总时间：≈ 40ms ✅
```

**代码示例：**
```typescript
private async rebuildEventIndexMapAsync(events: any[], visibleEventIds?: string[]) {
  let BATCH_SIZE = 200; // 初始批大小
  const TARGET_FIRST_BATCH_TIME = 5; // 首批目标 5ms
  
  // 优先处理可视区域
  if (visibleEventIds) {
    const priorityEvents = events.filter(e => visibleEventIds.includes(e.id));
    const firstBatchTime = processBatch(priorityEvents.slice(0, BATCH_SIZE));
    
    // 🔧 自适应调整
    if (firstBatchTime > TARGET_FIRST_BATCH_TIME) {
      BATCH_SIZE = Math.floor(BATCH_SIZE * TARGET_FIRST_BATCH_TIME / firstBatchTime);
    }
  }
  
  // 分批处理剩余事件
  for (let i = 0; i < remainingEvents.length; i += BATCH_SIZE) {
    await waitForIdleOrNextFrame(); // 等待窗口失焦或下一帧
    processBatch(batch);
  }
}
```

---

### 2. 增量更新（常规操作）

**触发时机：** 创建、更新、删除单个事件

**流程：**
```typescript
事件变更 
  → updateEventInIndex(newEvent, oldEvent)
    → 删除旧索引（id + externalId）
    → 添加新索引（id + externalId）
```

**特点：**
- ✅ O(1) 时间复杂度
- ✅ 不需要遍历整个事件列表
- ✅ 立即生效，无延迟

**代码示例：**
```typescript
private updateEventInIndex(event: any, oldEvent?: any) {
  // 移除旧索引
  if (oldEvent) {
    this.eventIndexMap.delete(oldEvent.id);
    this.eventIndexMap.delete(oldEvent.externalId);
  }
  
  // 添加新索引
  if (event) {
    this.eventIndexMap.set(event.id, event);
    this.eventIndexMap.set(event.externalId, event);
  }
}
```

---

### 3. 批量同步（Outlook 同步）

**触发时机：** 20秒定时同步，从 Outlook 获取远程事件

**流程：**
```typescript
syncPendingRemoteActions()
  → 从 localStorage 加载 localEvents
  → for (每个 remote action) {
      applyRemoteActionToLocal(action, false, localEvents)
        → updateEventInIndex(event) // 增量更新 IndexMap
    }
  → saveLocalEvents(localEvents, rebuildIndex=false) // 不重建！
```

**关键特性：**
- ✅ **批量保存**：循环中不保存，最后一次性保存到 localStorage
- ✅ **增量更新**：循环中每个事件调用 `updateEventInIndex()`
- ✅ **不重建索引**：`rebuildIndex=false`，因为已经增量更新了

**性能对比：**
```
不批量（每次保存）：
  处理 679 个事件 → 679 次 localStorage 写入 → 慢！❌

批量保存：
  处理 679 个事件 → 1 次 localStorage 写入 → 快！✅
```

---

### 4. 去重和迁移（特殊情况）

**触发时机：**
- `deduplicateEvents()` - 发现重复事件
- `migrateOutlookPrefixes()` - 数据迁移

**流程：**
```typescript
deduplicateEvents()
  → 清理重复事件
  → saveLocalEvents(uniqueEvents, rebuildIndex=true)
    → rebuildEventIndexMapAsync() // 异步重建
```

**特点：**
- ✅ 使用异步重建，不阻塞去重操作
- ✅ 重建完成后重置计数器

---

### 5. 远程删除检测（两轮确认机制）

**触发时机：** 每次同步时检测远程删除的事件

**问题：** 直接删除未在远程找到的事件容易误删
- 查询时间窗口不完整
- 网络波动或API限制
- 分页查询可能遗漏事件

**解决方案：** 两轮确认删除机制

**流程：**
```typescript
第1轮同步：未找到事件
  → 加入 deletionCandidates (pending)
  → 记录轮次和时间
  
等待下次同步 (至少30秒)

第2轮同步：仍未找到
  → 满足条件（≥2轮 && ≥30秒）
  → 确认删除
  
任何轮次：找到事件
  → 从 deletionCandidates 移除
```

**删除候选追踪：**
```typescript
deletionCandidates: Map<eventId, {
  externalId: string;
  title: string;
  firstMissingRound: number;  // 第一次未找到的轮次
  firstMissingTime: number;   // 第一次未找到的时间
  lastCheckRound: number;      // 最后检查的轮次
  lastCheckTime: number;       // 最后检查的时间
}>
```

**删除确认条件（全部满足）：**
- ✅ 至少在 **2轮同步** 中都未找到
- ✅ 间隔至少 **30秒**
- ✅ 不在最近30秒内更新过
- ✅ 不在已删除列表中

**候选清理：** 防止无限增长
- 超过 **10轮** 仍未确认 → 移除候选
- 超过 **10分钟** 仍未确认 → 移除候选

**性能影响：**
- ✅ O(n) 遍历检查，n = 本地事件数
- ✅ 每轮仅检查同步窗口内的事件
- ✅ 不阻塞主线程
- ✅ 典型场景：18个事件检查 < 1ms

**日志示例：**
```
🔄 [Sync] Round #1
⏳ [Sync] Deletion candidate (1st miss): "事件标题"
📊 [Sync] Deletion check: 18 events checked, 5 pending, 0 confirmed

🔄 [Sync] Round #2 (30秒后)
🗑️ [Sync] Confirmed deletion after 2 rounds: "事件标题"
📊 [Sync] Deletion check: 18 events checked, 0 pending, 5 confirmed
```

---

## 优先级机制

### externalId 索引的优先级

**问题：** Timer 事件和 Outlook 事件可能有相同的 `externalId`

**解决方案：** Timer 事件优先

```typescript
if (event.externalId) {
  const existing = this.eventIndexMap.get(event.externalId);
  
  if (!existing || event.id.startsWith('timer-')) {
    // 如果没有现有事件，或当前是 Timer 事件，使用当前事件
    this.eventIndexMap.set(event.externalId, event);
  }
  // 否则保留现有索引（Outlook 事件不覆盖 Timer 事件）
}
```

**为什么 Timer 优先？**
- Timer 事件包含本地 `tagId`、原始时间戳等重要信息
- Outlook 事件是 Timer 事件的远程副本
- 保留 Timer 事件可以避免重复创建

---

## 性能监控

### 增量更新计数器

```typescript
private incrementalUpdateCount = 0;

// 每次增量更新后
this.incrementalUpdateCount++;

// 如果超过 30 次，标记需要完整检查
if (this.incrementalUpdateCount > 30) {
  this.fullCheckCompleted = false;
}
```

**用途：**
- 跟踪自上次重建以来的增量更新次数
- 如果增量更新过多（>30 次），触发完整性检查

---

## 同步场景总结

| 场景 | 触发时机 | 更新方式 | 是否阻塞 | 性能影响 |
|------|---------|---------|---------|---------|
| **初始加载** | 应用启动 | 异步分批重建 | 否 | 低（10ms/批） |
| **创建事件** | 用户操作 | 增量更新 | 否 | 极低（O(1)） |
| **更新事件** | 用户操作 | 增量更新 | 否 | 极低（O(1)） |
| **删除事件** | 用户操作 | 增量更新 | 否 | 极低（O(1)） |
| **20秒同步** | 定时器 | 增量更新（批量保存） | 否 | 低（1次写入） |
| **删除检测** | 每次同步 | 两轮确认 | 否 | 极低（O(n)，n=窗口内事件） |
| **去重** | 检测到重复 | 异步重建 | 否 | 低（分批） |
| **数据迁移** | 首次运行 | 异步重建 | 否 | 低（分批） |

---

## 最佳实践

### ✅ DO

1. **优先使用增量更新**
   - 单个事件变更 → `updateEventInIndex()`
   - 不要每次都重建整个 IndexMap

2. **批量操作时延迟保存**
   - 在循环中修改内存数组
   - 循环结束后一次性保存

3. **使用异步重建**
   - 需要完全重建时 → `rebuildEventIndexMapAsync()`
   - 分批处理，避免阻塞

4. **优先处理可视区域**
   - 传入 `visibleEventIds` 参数
   - 先索引用户能看到的事件

### ❌ DON'T

1. **不要在循环中重建 IndexMap**
   ```typescript
   // ❌ 错误
   for (const event of events) {
     updateEvent(event);
     rebuildEventIndexMap(allEvents); // 每次都重建！
   }
   
   // ✅ 正确
   for (const event of events) {
     updateEvent(event);
     updateEventInIndex(event); // 增量更新
   }
   ```

2. **不要在主线程中同步重建大量事件**
   ```typescript
   // ❌ 错误
   rebuildEventIndexMap(events); // 阻塞主线程！
   
   // ✅ 正确
   await rebuildEventIndexMapAsync(events); // 异步分批
   ```

3. **不要忘记更新索引**
   ```typescript
   // ❌ 错误
   event.externalId = newId;
   events[index] = event;
   // 忘记更新 IndexMap！
   
   // ✅ 正确
   event.externalId = newId;
   events[index] = event;
   updateEventInIndex(event, oldEvent); // 更新索引
   ```

---

## Timer 事件同步流程

### 完整生命周期

```
1. 用户启动 Timer
   ↓
2. Timer 停止
   → 创建本地事件
   → id: 'timer-tag-xxx'
   → externalId: undefined
   → syncStatus: 'pending'
   → updateEventInIndex(timerEvent) // 索引 timer-tag-xxx
   
3. 上传到 Outlook（5秒后）
   → 获得 Outlook ID: 'AAMkAD...'
   → updateLocalEventExternalId()
   → timerEvent.externalId = 'AAMkAD...'
   → updateEventInIndex(timerEvent, oldEvent)
       // 新增索引: 'AAMkAD...' → timerEvent
   
4. 20秒同步（Outlook 返回）
   → Outlook 返回: {id: 'outlook-AAMkAD...', ...}
   → convertRemoteEventToLocal()
       newEvent.externalId = 'AAMkAD...' (纯ID)
   → IndexMap 查找: get('AAMkAD...')
       → 找到 timerEvent！✅
   → 更新 Timer 事件，不创建新事件
   → 不触发去重
```

**关键点：**
- ✅ Step 3: Timer 获得 `externalId` 后立即更新 IndexMap
- ✅ Step 4: 通过 `externalId` 匹配，避免重复创建
- ✅ 优先级机制确保 IndexMap 中 `externalId` 指向 Timer 事件

---

## 故障排查

### 问题：Timer 事件重复

**症状：** 同步后出现两个相同的事件（timer-tag-xxx 和 outlook-AAMkAD...）

**原因：**
1. IndexMap 没有索引 Timer 的 `externalId`
2. 或者 IndexMap 被全量重建，Timer 索引被覆盖

**检查方法：**
```javascript
// 控制台运行
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const timer = events.find(e => e.id.startsWith('timer-'));
console.log('Timer externalId:', timer.externalId);

// 应该有 externalId，且不带 'outlook-' 前缀
```

**解决方案：**
- 确保 `updateLocalEventExternalId` 调用了 `updateEventInIndex`
- 确保批量同步时 `rebuildIndex=false`
- 确保重建时 Timer 事件优先

---

### 问题：同步时卡顿

**症状：** 20秒同步时界面卡顿几秒

**原因：**
- 批量同步时错误地使用了 `rebuildIndex=true`
- 或者使用了同步版本的 `rebuildEventIndexMap`

**检查方法：**
```javascript
// 查看日志
// ❌ 如果看到：
🚀 [IndexMap] Rebuilt index with 1388 entries for 698 events

// ✅ 应该看到：
📊 [IndexMap] Batch 0: 50 events in 2.5ms
```

**解决方案：**
- 批量同步时使用 `saveLocalEvents(events, false)`
- 循环中使用 `updateEventInIndex()` 增量更新

---

## 版本历史

### v1.4.0 (2025-10-28)
- ✅ 实现两轮确认删除机制
- ✅ 防止误删远程事件
- ✅ 添加删除候选追踪（deletionCandidates）
- ✅ 添加同步轮次计数器（syncRoundCounter）
- ✅ 性能监控和警告机制

### v1.3.0 (2025-10-27)
- ✅ 实现异步分批重建机制
- ✅ 优化批量同步性能（每批 10ms）
- ✅ 添加可视区域优先处理
- ✅ 修复 Timer 事件重复问题
- ✅ externalId 索引优先级机制

### v1.2.0 (2025-10-26)
- ✅ 引入 IndexMap 架构
- ✅ 增量更新机制
- ✅ 批量保存优化

---

## 参考资料

- **源代码:** `src/services/ActionBasedSyncManager.ts`
- **相关文档:** 
  - `docs/PERFORMANCE-GUIDE.md` - 性能优化指南
  - `docs/TIMECALENDAR_README.md` - TimeCalendar 组件文档


---

# 同步优化改进

# 离线同步改进 - 实现总结

## 🎯 改进目标达成

根据你的需求，我已经完成了以下改进：

### ✅ 1. 网络状态监听（最重要）
- **实现**：添加了 `setupNetworkListeners()` 方法
- **效果**：网络恢复时立即触发同步（1秒延迟）
- **位置**：`ActionBasedSyncManager.ts` 构造函数中自动初始化

### ✅ 2. 无限重试机制
- **实现**：移除了3次重试限制
- **效果**：只要在队列中且未同步，就会持续重试
- **优化**：按失败次数排序，新事件优先同步

### ✅ 3. 用户通知机制
- **实现**：每失败3次通知用户一次
- **内容**：事件标题、重试次数、失败原因
- **方式**：通过自定义事件传递给UI层

### ✅ 4. 改进网络检查
- **实现**：使用 `navigator.onLine` 预先判断
- **效果**：离线时不尝试同步，避免浪费重试

## 📝 代码改动

### 修改的文件
- ✅ `src/services/ActionBasedSyncManager.ts`
- ✅ 新增 `src/components/SyncNotification.tsx`
- ✅ 新增 `src/components/SyncNotification.css`

### 新增的方法
1. `setupNetworkListeners()` - 网络状态监听
2. `showNetworkNotification()` - 显示网络状态通知
3. `showSyncFailureNotification()` - 显示同步失败通知

### 修改的方法
1. `constructor()` - 调用网络监听设置
2. `syncSingleAction()` - 移除重试限制，添加通知逻辑
3. `recordLocalAction()` - 添加网络状态检查
4. `syncPendingLocalActions()` - 添加智能排序

### 新增的接口字段
```typescript
interface SyncAction {
  // ... 原有字段 ...
  lastError?: string;        // 最后一次错误信息
  lastAttemptTime?: Date;    // 最后一次尝试时间
  userNotified?: boolean;    // 是否已通知用户
}
```

## 🔄 工作流程

```
断网时创建事件
  ↓
保存到本地 + actionQueue
  ↓
检测到离线 → 显示通知 "⚠️ 网络已断开"
  ↓
等待网络恢复...
  ↓
网络恢复 → 'online' 事件触发
  ↓
1秒后自动同步 → 显示通知 "✅ 网络已恢复，正在同步"
  ↓
同步成功 → 标记 synchronized = true
或
同步失败 → retryCount++，记录错误
  ↓
每失败3次 → 通知用户具体原因
  ↓
下次轮询继续重试（20秒后）
```

## 📊 关键特性

### 1. 智能重试
- ❌ 旧：最多重试3次后放弃
- ✅ 新：无限重试直到成功

### 2. 即时响应
- ❌ 旧：依赖20秒定时器
- ✅ 新：网络恢复1秒后立即同步

### 3. 用户可见性
- ❌ 旧：用户不知道同步失败
- ✅ 新：清楚告知失败原因和次数

### 4. 智能排序
- ❌ 旧：按队列顺序处理
- ✅ 新：新事件优先，失败多的靠后

## 🎨 UI集成

### 快速集成（推荐）

在 `App.tsx` 中添加：

```tsx
import { SyncNotification } from './components/SyncNotification';

function App() {
  return (
    <div className="App">
      {/* 你的现有组件 */}
      
      {/* 添加同步通知组件 */}
      <SyncNotification />
    </div>
  );
}
```

### 自定义集成

如果你有现有的通知系统：

```tsx
useEffect(() => {
  const handleSyncFailure = (event: Event) => {
    const { eventTitle, retryCount, error } = (event as CustomEvent).detail;
    yourNotificationSystem.show({
      type: 'warning',
      message: `事件"${eventTitle}"同步失败（已重试${retryCount}次）\n${error}`
    });
  };
  
  window.addEventListener('syncFailure', handleSyncFailure);
  return () => window.removeEventListener('syncFailure', handleSyncFailure);
}, []);
```

## 🧪 测试方法

### 测试1：断网同步
```bash
1. 关闭WiFi
2. 创建Timer事件
3. 打开WiFi
4. 等待1秒，事件自动同步
```

**预期日志：**
```
📴 [Network] ⚠️ Network is OFFLINE
📴 [RECORD LOCAL ACTION] Network is OFFLINE, action queued
🌐 [Network] ✅ Network is back ONLINE
🚀 [Network] Executing sync after network recovery
✅ [SYNC SINGLE ACTION] Action completed successfully
```

### 测试2：长时间断网
```bash
1. 关闭WiFi
2. 创建3个事件
3. 保持断网5分钟
4. 打开WiFi
5. 验证所有3个事件都同步成功
```

### 测试3：同步失败通知
```bash
# 在控制台运行：
window.dispatchEvent(new CustomEvent('syncFailure', {
  detail: {
    eventTitle: '测试事件',
    retryCount: 3,
    error: '网络错误',
    timestamp: new Date()
  }
}));
```

## 📈 性能影响

- ✅ **零性能损耗**：事件监听是被动的
- ✅ **不阻塞UI**：所有同步都是异步的
- ✅ **智能排序**：O(n log n)，可忽略不计
- ✅ **通知轻量**：仅在需要时显示

## 🛡️ 可靠性保证

1. **持久化**：actionQueue保存在localStorage
2. **幂等性**：重复同步不会造成数据重复
3. **错误恢复**：网络错误自动重试
4. **状态追踪**：每个action都有完整的状态记录

## 📚 相关文档

- `OFFLINE_SYNC_FIX.md` - 详细的技术方案
- `docs/SYNC_NOTIFICATION_GUIDE.md` - UI集成指南
- `docs/Sync Mechanism.md` - 同步机制总览

---

## 🆕 PlanManager 时间同步优化 (2025-11-06)

### 问题背景

**之前**: 所有事件在保存时都会调用 `syncToUnifiedTimeline`，即使事件没有任何时间信息（startTime、endTime、dueDate 都为空）。

```typescript
// ❌ 旧代码
changedItems.forEach(item => {
  onSave(item);
  syncToUnifiedTimeline(item);  // 强制同步，即使没有时间
});
```

**问题**:
- 💥 即使用户只想创建一个纯文本待办事项，也会被强制定义时间
- 💥 EventService 会自动为无时间的 item 生成默认时间戳
- 💥 导致用户困惑：为什么纯待办也出现在日历中？

### 解决方案

**现在**: 只有当事件具有时间字段时才同步到 Calendar

```typescript
// ✅ 新代码
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

### hasAnyTime 检查逻辑

```typescript
/**
 * 检查事件是否有任何时间信息
 * 
 * @returns {boolean} true 如果有 startTime 或 endTime 或 dueDate
 */
const hasAnyTime = !!(item.startTime || item.endTime || item.dueDate);
```

**检查条件**:
- ✅ `item.startTime` - 开始时间（固定时间或时间范围）
- ✅ `item.endTime` - 结束时间
- ✅ `item.dueDate` - 截止日期

**逻辑解释**:
- 使用 `!!` 将值转为布尔值
- 使用 `||` 短路求值，任意一个为真即返回 true
- 空字符串、null、undefined 都视为 false

### 用户体验改进

**场景 1: 纯待办事项**
```typescript
const item = {
  id: '1',
  title: '买牛奶',
  content: '去超市买牛奶',
  tags: ['shopping'],
  // 无时间字段
};

// ✅ 不会同步到 Calendar
// ✅ 不会出现在日历视图中
// ✅ 不会被强制定义时间
```

**场景 2: 带时间的事件**
```typescript
const item = {
  id: '2',
  title: '团队会议',
  content: '讨论项目进度',
  startTime: '2025-11-06T10:00:00',
  endTime: '2025-11-06T11:00:00',
};

// ✅ 同步到 Calendar
// ✅ 显示在日历视图中
// ✅ 调用 EventService.updateEvent()
```

**场景 3: 仅有截止日期**
```typescript
const item = {
  id: '3',
  title: '完成报告',
  content: '季度财务报告',
  dueDate: '2025-11-10',
};

// ✅ 同步到 Calendar（因为有 dueDate）
// ✅ 显示为截止日期事件
```

### 性能影响

- ✅ **减少不必要的同步**: 纯待办不再调用 EventService
- ✅ **减少网络请求**: 跳过无时间事件的 API 调用
- ✅ **日志清晰**: 明确显示同步或跳过的原因

### 调试日志

```bash
# 有时间的事件
[✅ 同步时间] 团队会议

# 无时间的待办
[⏭️ 跳过同步] 买牛奶 - 无时间字段
```

### 相关代码

- **PlanManager.tsx** (L1070-1090): onChange 处理，hasAnyTime 检查
- **EventService.ts**: updateEvent() API，处理时间同步
- **TimeHub.ts**: 时间管理中枢，TimeSpec 规范化

### 兼容性

- ✅ 向后兼容：已有事件不受影响
- ✅ 数据一致性：不会修改已存在的时间数据
- ✅ 迁移平滑：无需数据迁移脚本

---

## 🎉 总结

这次改进完全满足你的需求：

1. ✅ **网络监听** - 联网后立即同步，不再等待
2. ✅ **无限重试** - 不设次数限制，直到成功
3. ✅ **用户通知** - 清楚告知同步状态和失败原因
4. ✅ **网络检查** - 离线时不浪费重试次数
5. ✅ **智能时间同步** - 只有有时间的事件才同步到 Calendar（2025-11-06 新增）

**不是简单地做事情，而是让用户清楚地知道发生了什么！** 🎯
