# Timer 同步问题调试指南

## 🎯 目标
追踪 Timer 事件从创建到同步的完整流程，找出为什么运行中的 Timer 会被同步。

## 🔍 调试日志关键字

在浏览器控制台搜索以下关键字：

### 1. Timer 创建
- `🔍 [DEBUG-TIMER]` - 所有Timer相关的调试日志
- `[Timer Init]` - Timer 启动
- `[Timer Stop]` - Timer 停止

### 2. 事件创建/更新
- `🆕 [EventService] Creating` - 创建事件
- `✏️ [EventService] Updating` - 更新事件
- `调用来源:` - 查看是谁调用的

### 3. 同步触发
- `recordLocalAction 被调用` - 同步队列入队
- `即将调用 recordLocalAction` - 准备同步
- `Sync skipped (syncStatus=local-only)` - 跳过同步（正确）
- `Sync skipped (skipSync=true)` - 跳过同步（正确）

## 📋 测试步骤

### 测试场景：编辑运行中Timer的description

1. **启动Timer**
   - 打开浏览器控制台（F12）
   - 点击浮动按钮开始计时
   - **检查日志**：应该看到
     ```
     🔍 [DEBUG-TIMER] skipSync: true
     🔍 [DEBUG-TIMER] syncStatus: local-only
     ⏭️ [EventService] Sync skipped (syncStatus=local-only)
     ```

2. **编辑Timer的description**
   - 点击日历上的Timer事件
   - 编辑description字段
   - 点击保存
   - **检查日志**：应该看到
     ```
     🔍 [DEBUG-TIMER] EventEditModal 更新事件
     🔍 [DEBUG-TIMER] isRunningTimer: true
     🔍 [DEBUG-TIMER] shouldSkipSync: true
     ⏱️ [EventEditModal] Detected running timer, skipSync=true
     ```

3. **检查是否触发同步**
   - **正确行为**：日志中应该有 `Sync skipped`
   - **错误行为**：如果看到 `recordLocalAction 被调用` 且 `syncStatus: local-only`，说明有bug

4. **停止Timer**
   - 点击停止
   - **检查日志**：应该看到
     ```
     🔍 [DEBUG-TIMER] syncStatus: pending
     即将调用 recordLocalAction
     ```

## 🐛 可能的问题点

### A. EventEditModal 没有正确检测 Timer
**症状**：
```
🔍 [DEBUG-TIMER] isRunningTimer: false  // ❌ 应该是 true
🔍 [DEBUG-TIMER] shouldSkipSync: false  // ❌ 应该是 true
```

**原因**：`event.syncStatus` 不是 `'local-only'`

### B. skipSync 参数没有传递
**症状**：
```
🔍 [DEBUG-TIMER] EventHub.updateFields 调用
🔍 [DEBUG-TIMER] skipSync: false  // ❌ 应该是 true
```

**原因**：EventEditModal 调用 EventHub 时没有传递 `skipSync` 参数

### C. TimeHub 没有传递 skipSync
**症状**：
```
🔍 [DEBUG-TIMER] TimeHub.setEventTime 调用
🔍 [DEBUG-TIMER] skipSync: false  // ❌ 应该是 true
```

**原因**：EventHub 调用 TimeHub 时没有传递 `skipSync` 参数

### D. EventService 收到了错误的参数
**症状**：
```
🔍 [DEBUG-TIMER] skipSync: false  // ❌ 应该是 true
🔍 [DEBUG-TIMER] syncStatus: pending  // ❌ 应该是 local-only
```

**原因**：上层传递的参数错误

## 📊 完整调用链

### 正确的流程（编辑Timer时）

```
EventEditModal.handleSave
  ↓ 检测 isRunningTimer = true
  ↓ shouldSkipSync = true
  ↓
EventHub.setEventTime(eventId, {...}, { skipSync: true })
  ↓
TimeHub.setEventTime(eventId, {...}, { skipSync: true })
  ↓
EventService.updateEvent(eventId, {...}, skipSync=true)
  ↓
条件判断: skipSync=true → ⏭️ Sync skipped
```

### 错误的流程（会触发同步）

```
EventEditModal.handleSave
  ↓ 没有检测 isRunningTimer
  ↓ shouldSkipSync = false
  ↓
EventHub.setEventTime(eventId, {...})  // ❌ 没有传 skipSync
  ↓
TimeHub.setEventTime(eventId, {...})  // ❌ 没有传 skipSync
  ↓
EventService.updateEvent(eventId, {...}, skipSync=false)
  ↓
条件判断: !skipSync && syncStatus !== 'local-only'
  ↓ syncStatus 被更新操作改变了？
  ↓
🔄 触发同步 recordLocalAction  // ❌ Bug!
```

## 🔧 调试命令

在控制台运行这些命令：

```javascript
// 1. 查看当前Timer事件
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const timerEvents = events.filter(e => e.syncStatus === 'local-only');
console.table(timerEvents.map(e => ({
  id: e.id,
  title: e.title,
  syncStatus: e.syncStatus,
  isTimer: e.isTimer,
  description: e.description?.substring(0, 30)
})));

// 2. 查看同步队列
const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
console.table(queue.map(a => ({
  type: a.type,
  entityId: a.entityId,
  syncStatus: a.data?.syncStatus,
  synchronized: a.synchronized,
  retryCount: a.retryCount
})));

// 3. 清除同步队列（如果需要重置）
localStorage.setItem('remarkable-sync-actions', '[]');
console.log('✅ 同步队列已清空');
```

## 📝 报告问题时需要的信息

如果发现bug，请提供：

1. **完整的控制台日志**
   - 从Timer启动到停止的所有日志
   - 特别是带 `🔍 [DEBUG-TIMER]` 的行

2. **Timer事件的详细信息**
   ```javascript
   const timerEvent = events.find(e => e.id.includes('timer-'));
   console.log(JSON.stringify(timerEvent, null, 2));
   ```

3. **同步队列的状态**
   ```javascript
   const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
   console.log(JSON.stringify(queue, null, 2));
   ```

4. **复现步骤**
   - 具体的操作顺序
   - 编辑了哪些字段

## ✅ 预期结果

编辑运行中Timer时：
- ✅ 不应该看到 `recordLocalAction 被调用`（除非是停止Timer）
- ✅ 应该看到 `Sync skipped (skipSync=true)` 或 `Sync skipped (syncStatus=local-only)`
- ✅ 远程只应该有1个事件（Timer结束后的最终版本）
