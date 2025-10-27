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
