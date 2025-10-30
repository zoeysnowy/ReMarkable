# 离线事件同步问题修复方案（已实现）

## ✅ 已实现的改进

### 1. 网络状态监听（最重要）

**实现内容：**
- ✅ 监听 `window.addEventListener('online')` - 网络恢复时立即触发同步
- ✅ 监听 `window.addEventListener('offline')` - 网络断开时显示通知
- ✅ 使用 `navigator.onLine` 检查网络状态
- ✅ 网络恢复后1秒延迟同步，让网络稳定

**代码位置：** `ActionBasedSyncManager.setupNetworkListeners()`

### 2. 无限重试机制

**实现内容：**
- ✅ 移除了3次重试限制
- ✅ 未同步的action会在每次轮询时自动重试
- ✅ 只要在actionQueue中且未同步，就会持续尝试
- ✅ 按失败次数排序，优先同步新创建的事件

**代码位置：** `ActionBasedSyncManager.syncSingleAction()` 和 `syncPendingLocalActions()`

### 3. 用户通知机制

**实现内容：**
- ✅ 每失败3次通知用户一次（避免频繁打扰）
- ✅ 通知包含：事件标题、重试次数、失败原因
- ✅ 通过自定义事件 `syncFailure` 通知UI层
- ✅ 网络状态变化时通知用户

**事件详情：**
```typescript
window.addEventListener('syncFailure', (event) => {
  const { eventTitle, retryCount, error, timestamp } = event.detail;
  // 显示通知给用户
});

window.addEventListener('networkStatusChanged', (event) => {
  const { status, message } = event.detail;
  // 显示网络状态通知
});
```

### 4. 改进的网络检查

**实现内容：**
- ✅ `recordLocalAction` 中检查 `navigator.onLine`
- ✅ 离线时不尝试同步，直接排队
- ✅ 详细的日志输出便于调试

## 工作流程

```
1. 用户停止Timer
   ↓
2. App.tsx: handleTimerStop()
   → 创建本地事件 (syncStatus: 'pending')
   → 保存到 localStorage
   ↓
3. 延迟5秒后调用 syncManager.recordLocalAction()
   ↓
4. ActionBasedSyncManager: recordLocalAction()
   → 创建 SyncAction
   → 保存到 actionQueue (localStorage)
   → 检查 isRunning && isSignedIn()
   ↓
5. 如果条件满足：setTimeout(() => syncSingleAction(action), 0)
   如果条件不满足：⚠️ 等待下次定时同步（20秒后）
   ↓
6. syncSingleAction()
   → 尝试同步到远程
   → 如果失败：retryCount++
   → 如果 retryCount >= 3：❌ 不再重试
   ↓
7. 定时同步 (每20秒)
   → performSync()
   → syncPendingLocalActions()
   → 重试未同步的 actions
## 工作流程

### 完整的同步流程（已优化）

```
1. 用户停止Timer（或任何本地操作）
   ↓
2. App.tsx: handleTimerStop()
   → 创建本地事件 (syncStatus: 'pending')
   → 保存到 localStorage
   ↓
3. syncManager.recordLocalAction()
   → 创建 SyncAction
   → 保存到 actionQueue (localStorage)
   → 检查网络: navigator.onLine ✨
   ↓
4a. 如果在线：
    → setTimeout(() => syncSingleAction(action), 0)
    → 尝试立即同步
    
4b. 如果离线：
    → 显示通知："⚠️ 网络已断开，本地操作将在联网后自动同步"
    → 等待网络恢复事件
   ↓
5. 网络恢复时：
   → window 'online' 事件触发 ✨
   → 1秒后自动调用 performSync()
   → syncPendingLocalActions()
   → 按失败次数排序（0次优先）✨
   ↓
6. syncSingleAction()
   → 尝试同步到远程
   → 如果失败：
     • retryCount++
     • 记录错误: action.lastError ✨
     • 每失败3次通知用户 ✨
     • 下次轮询继续重试（无限制）✨
   → 如果成功：
     • synchronized = true
     • 清除错误信息
   ↓
7. 定时同步（每20秒）
   → performSync()
   → syncPendingLocalActions()
   → 重试所有未同步的 actions
```

### 关键改进点

1. **✨ 网络监听**
   - 网络恢复立即同步（1秒延迟）
   - 不再完全依赖20秒定时器

2. **✨ 无限重试**
   - 移除了3次重试限制
   - 只要未同步就持续重试

3. **✨ 智能排序**
   - 优先同步新创建的事件（retryCount=0）
   - 失败多次的事件靠后

4. **✨ 用户通知**
   - 每失败3次通知一次
   - 清楚告知失败原因

## UI层集成

需要在UI层监听以下事件来显示通知：

### 1. 同步失败通知

```typescript
// 在 App.tsx 或相关组件中
useEffect(() => {
  const handleSyncFailure = (event: CustomEvent) => {
    const { eventTitle, retryCount, error } = event.detail;
    
    // 显示通知（使用你的通知组件）
    showNotification({
      type: 'warning',
      title: '事件同步失败',
      message: `事件"${eventTitle}"同步失败（已重试${retryCount}次）\n原因：${error}`,
      duration: 5000
    });
  };
  
  window.addEventListener('syncFailure', handleSyncFailure as EventListener);
  
  return () => {
    window.removeEventListener('syncFailure', handleSyncFailure as EventListener);
  };
}, []);
```

### 2. 网络状态通知

```typescript
useEffect(() => {
  const handleNetworkStatus = (event: CustomEvent) => {
    const { status, message } = event.detail;
    
    showNotification({
      type: status === 'offline' ? 'warning' : 'success',
      title: status === 'offline' ? '网络已断开' : '网络已恢复',
      message,
      duration: 3000
    });
  };
  
  window.addEventListener('networkStatusChanged', handleNetworkStatus as EventListener);
  
  return () => {
    window.removeEventListener('networkStatusChanged', handleNetworkStatus as EventListener);
  };
}, []);
```

## 测试验证

### 测试场景1：断网创建事件

```
1. 断开网络（关闭WiFi）
2. 启动Timer并停止，创建事件
3. 检查控制台，应该看到：
   📴 [Network] Network is OFFLINE
   📴 [RECORD LOCAL ACTION] Network is OFFLINE, action queued
4. 恢复网络
5. 应该看到：
   🌐 [Network] ✅ Network is back ONLINE
   🔄 [Network] Will trigger sync after 1 second
   � [Network] Executing sync after network recovery
   ✅ [SYNC SINGLE ACTION] Action completed successfully
```

### 测试场景2：长时间断网

```
1. 断网状态下创建3个Timer事件
2. 保持断网超过5分钟
3. 恢复网络
4. 验证所有3个事件都能成功同步
5. 检查控制台，应该看到：
   📊 [Sync] Pending local actions: {total: 3, byRetryCount: {0: 3}}
```

### 测试场景3：同步失败通知

```
1. 修改网络环境，使同步请求失败（如设置代理错误）
2. 创建事件
3. 应该在失败3次后看到通知：
   🚨 [Sync Failure Notification] Event: "事件名", Retries: 3, Error: ...
4. UI应该显示通知给用户
```

## 预期日志输出

### 离线时创建事件
```
� [RECORD LOCAL ACTION] Called with: {type: 'create', ...}
� [RECORD LOCAL ACTION] Network is OFFLINE, action queued for sync when network is restored
📋 [Network] Local actions will be queued and synced when network is restored
```

### 网络恢复
```
🌐 [Network] ✅ Network is back ONLINE
🔄 [Network] Will trigger sync after 1 second to allow network stabilization...
� [Network] Executing sync after network recovery
🔄 [performSync] Starting sync cycle...
📊 [Sync] Pending local actions: {total: 2, byRetryCount: {0: 2}}
🔍 [SYNC SINGLE ACTION] Processing local action: create
✅ [SYNC SINGLE ACTION] Action completed successfully
```

### 同步失败（3次后）
```
❌ [SYNC SINGLE ACTION] Failed to sync action: {error: "Network error"}
⚠️ [SYNC SINGLE ACTION] Action will be retried in next sync cycle. Retry count: 3
🚨 [Sync Failure Notification] Event: "专注学习", Retries: 3, Error: Network error
```

## 代码改动总结

### 修改的文件
- `src/services/ActionBasedSyncManager.ts`

### 新增的方法
1. `setupNetworkListeners()` - 设置网络状态监听
2. `showNetworkNotification()` - 显示网络状态通知
3. `showSyncFailureNotification()` - 显示同步失败通知

### 修改的方法
1. `constructor()` - 调用 `setupNetworkListeners()`
2. `syncSingleAction()` - 移除重试限制，添加错误记录和通知
3. `recordLocalAction()` - 添加网络状态检查
4. `syncPendingLocalActions()` - 按失败次数排序

### 新增的接口字段
```typescript
interface SyncAction {
  // ... 原有字段 ...
  lastError?: string; // 最后一次错误信息
  lastAttemptTime?: Date; // 最后一次尝试时间
  userNotified?: boolean; // 是否已通知用户
}
```

## 优点总结

1. ✅ **即时响应** - 网络恢复后1秒内开始同步
2. ✅ **可靠性高** - 无限重试，直到成功
3. ✅ **用户友好** - 清楚告知同步状态和失败原因
4. ✅ **智能优先** - 新事件优先同步
5. ✅ **性能良好** - 不影响UI响应
6. ✅ **向后兼容** - 不破坏现有功能

## 下一步

UI层需要实现通知显示：
1. 监听 `syncFailure` 事件显示同步失败通知
2. 监听 `networkStatusChanged` 事件显示网络状态变化
3. 建议使用Toast或Snackbar组件显示通知

这样用户就能清楚地知道：
- 哪些事件同步失败了
- 失败的原因是什么
- 已经重试了多少次
