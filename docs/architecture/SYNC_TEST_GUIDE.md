# 同步测试脚本使用指南

## 📋 测试前准备

### ⚠️ 重要：确保满足以下条件

1. **Microsoft 账户已登录**
   ```javascript
   // 检查登录状态
   window.syncManager?.microsoftService?.isSignedIn()
   // 应该返回 true
   ```

2. **同步管理器已启动**
   ```javascript
   // 检查同步管理器
   window.syncManager?.isRunning
   // 应该返回 true
   ```

3. **有可用的日历**
   ```javascript
   // 检查默认日历ID
   window.syncManager?.microsoftService?.getSelectedCalendarId()
   // 应该返回日历ID（例如：'AAMkAD...'）
   ```

4. **确认同步队列正常**
   ```javascript
   // 查看当前队列
   const queue = JSON.parse(localStorage.getItem('remarkable-dev-persistent-syncActions') || '[]');
   console.log('队列长度:', queue.length);
   console.log('待同步:', queue.filter(a => !a.synchronized).length);
   ```

---

## 🧪 测试脚本说明

### 📁 脚本列表

| 脚本文件 | 测试内容 | 耗时 | 事件数量 |
|---------|---------|------|---------|
| `test-sync-suite.js` | 全部测试（推荐） | ~150秒 | 31个 |
| `test-sync-offline-recovery.js` | 断网恢复 | ~15秒 | 1个 |
| `test-sync-long-offline.js` | 长时间离线 | ~90秒 | 10个 |
| `test-sync-concurrent.js` | 并发压力 | ~40秒 | 20个 |

---

## 🚀 运行测试

### 方法1：运行完整测试套件（推荐）

```javascript
// 1. 打开浏览器控制台（F12）
// 2. 复制 test-sync-suite.js 的全部内容
// 3. 粘贴到控制台并回车
// 4. 等待约2.5分钟
// 5. 查看测试报告
```

**优点**：
- ✅ 自动运行所有测试
- ✅ 生成综合报告
- ✅ 测试间有10秒间隔，避免冲突

---

### 方法2：运行单个测试

```javascript
// 选择任意一个测试脚本
// 例如：test-sync-offline-recovery.js

// 1. 打开浏览器控制台（F12）
// 2. 复制脚本内容
// 3. 粘贴到控制台并回车
// 4. 查看测试结果
```

**适用场景**：
- 只需要测试特定功能
- 快速验证修复效果
- 调试特定问题

---

## 🔍 测试详解

### 测试 1：断网恢复测试 (`test-sync-offline-recovery.js`)

**测试目标**：验证事件在断网情况下能否正确入队并在网络恢复后同步

**测试流程**：
```
1. 创建1个测试事件
2. 模拟断网（拦截 fetch 请求）
3. 检查事件是否进入同步队列
4. 恢复网络
5. 验证事件是否成功同步（检查 externalId）
```

**成功标准**：
- ✅ 事件成功创建并保存到 localStorage
- ✅ 事件进入同步队列（`synchronized: false`）
- ✅ 网络恢复后事件获得 `externalId`
- ✅ 事件出现在 Outlook 日历中

**关键检查点**：
```javascript
// 事件属性
{
  remarkableSource: true,  // 本地创建标记
  syncStatus: 'pending',   // 待同步状态
  calendarId: '...',       // 有目标日历
  tags: ['测试标签'],      // 有标签
  externalId: undefined    // 同步前无 externalId
}

// Action 属性
{
  type: 'create',
  source: 'local',
  synchronized: false,
  retryCount: 0
}
```

---

### 测试 2：长时间离线测试 (`test-sync-long-offline.js`)

**测试目标**：验证长时间离线期间创建的多个事件能否批量同步

**测试流程**：
```
1. 模拟断网
2. 每隔3秒创建1个事件（共10个）
3. 保持离线60秒
4. 恢复网络
5. 验证所有10个事件都成功同步
```

**成功标准**：
- ✅ 10个事件全部进入队列
- ✅ 离线期间队列持久化保存
- ✅ 网络恢复后批量同步成功
- ✅ 成功率 = 100%（10/10）

**压力测试点**：
- 多事件排队
- 长时间队列持久化
- 批量同步性能

---

### 测试 3：并发压力测试 (`test-sync-concurrent.js`)

**测试目标**：验证快速创建大量事件的队列顺序和同步完整性

**测试流程**：
```
1. 快速连续创建20个事件（无间隔）
2. 验证队列顺序（按创建顺序）
3. 验证队列完整性（无丢失）
4. 等待40秒同步
5. 验证所有事件都成功同步
```

**成功标准**：
- ✅ 20个事件全部进入队列
- ✅ 队列顺序正确（按 `_testIndex` 排序）
- ✅ 无事件丢失
- ✅ 成功率 = 100%（20/20）

**压力测试点**：
- 高并发创建性能
- 队列顺序维护
- 批量同步稳定性

---

## 📊 测试结果解读

### 完整测试报告示例

```
================================================================================
📊 测试报告
================================================================================

⏱️ 总耗时: 152.3秒
📋 测试数量: 3

✅ 测试 1: 断网恢复测试
   状态: PASS
   结果: 同步成功

✅ 测试 2: 长时间离线测试
   状态: PASS
   同步成功: 10/10
   成功率: 100.0%

✅ 测试 3: 并发压力测试
   状态: PASS
   同步成功: 20/20
   成功率: 100.0%
   队列顺序: 正确

================================================================================
📈 总结:
   ✅ 完全通过: 3
   ⚠️ 部分通过: 0
   ❌ 失败: 0
================================================================================
🎉🎉🎉 所有测试通过！同步功能运行良好！
================================================================================

💾 测试结果已保存到: window.syncTestResults
```

---

### 状态说明

| 状态 | 说明 | 处理建议 |
|------|------|---------|
| ✅ PASS | 测试完全通过 | 无需处理 |
| ⚠️ PARTIAL | 部分通过（成功率 80-99%） | 检查失败原因，可能是网络延迟 |
| ❌ FAIL | 测试失败（成功率 < 80%） | 检查同步配置和网络状态 |
| 🔥 ERROR | 测试异常（脚本错误） | 查看错误堆栈，检查脚本兼容性 |

---

## 🔧 故障排查

### 问题1：测试事件不同步（externalId 为空）

**可能原因**：
1. Microsoft 账户未登录
2. 默认日历未设置
3. 同步管理器未启动
4. 网络问题

**排查步骤**：
```javascript
// 1. 检查登录状态
console.log('登录状态:', window.syncManager?.microsoftService?.isSignedIn());

// 2. 检查默认日历
console.log('默认日历:', window.syncManager?.microsoftService?.getSelectedCalendarId());

// 3. 检查同步管理器
console.log('管理器运行:', window.syncManager?.isRunning);

// 4. 检查队列
const queue = JSON.parse(localStorage.getItem('remarkable-dev-persistent-syncActions') || '[]');
console.log('队列中的测试事件:', queue.filter(a => a.data?.title?.includes('🧪')));
```

---

### 问题2：队列中有事件但未同步

**可能原因**：
1. 事件缺少 `calendarId` 或 `tags`
2. `syncStatus` 为 `'local-only'`
3. 同步间隔未到（20秒一次）

**排查步骤**：
```javascript
// 检查队列中的测试事件
const queue = JSON.parse(localStorage.getItem('remarkable-dev-persistent-syncActions') || '[]');
const testActions = queue.filter(a => a.entityId?.includes('test-'));

testActions.forEach(action => {
  console.log('事件ID:', action.entityId);
  console.log('同步状态:', action.synchronized);
  console.log('重试次数:', action.retryCount);
  console.log('日历ID:', action.data?.calendarId);
  console.log('标签:', action.data?.tags);
  console.log('---');
});
```

---

### 问题3：测试事件创建但队列为空

**可能原因**：
- 事件缺少同步必要字段（`calendarId` 或 `tags`）

**解决方法**：
```javascript
// 检查事件属性
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const testEvents = events.filter(e => e.title?.includes('🧪'));

testEvents.forEach(event => {
  console.log('事件标题:', event.title);
  console.log('remarkableSource:', event.remarkableSource);
  console.log('syncStatus:', event.syncStatus);
  console.log('calendarId:', event.calendarId);
  console.log('tags:', event.tags);
  console.log('externalId:', event.externalId);
  console.log('---');
});
```

**修复**：确保测试脚本已更新，事件包含 `calendarId` 和 `tags`。

---

### 问题4：同步成功率低（< 80%）

**可能原因**：
1. 网络不稳定
2. Microsoft API 限流
3. 同步等待时间不足

**解决方法**：
```javascript
// 1. 增加等待时间（手动等待后再检查）
await new Promise(resolve => setTimeout(resolve, 60000)); // 等待60秒

// 2. 检查失败原因
const queue = JSON.parse(localStorage.getItem('remarkable-dev-persistent-syncActions') || '[]');
const failed = queue.filter(a => !a.synchronized && a.retryCount > 3);

failed.forEach(action => {
  console.log('失败事件:', action.entityId);
  console.log('重试次数:', action.retryCount);
  console.log('错误信息:', action.lastError);
  console.log('---');
});

// 3. 手动触发同步
window.dispatchEvent(new Event('online'));
```

---

## 🧹 清理测试数据

### 删除所有测试事件

```javascript
// ⚠️ 谨慎操作：会删除所有标题包含 🧪 的事件

const STORAGE_KEYS = {
  EVENTS: 'remarkable-events',
  SYNC_ACTIONS: 'remarkable-dev-persistent-syncActions'
};

// 1. 删除测试事件
const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
const nonTestEvents = events.filter(e => !e.title?.includes('🧪'));
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(nonTestEvents));

// 2. 删除测试 actions
const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');
const nonTestActions = queue.filter(a => !a.entityId?.includes('test-'));
localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(nonTestActions));

console.log(`✅ 已删除 ${events.length - nonTestEvents.length} 个测试事件`);
console.log(`✅ 已删除 ${queue.length - nonTestActions.length} 个测试 actions`);
console.log('🔄 请刷新页面: location.reload()');
```

---

## 📝 测试报告保存

测试完成后，结果会保存到全局变量：

```javascript
// 查看完整测试结果
console.log(window.syncTestResults);

// 导出为 JSON
const json = JSON.stringify(window.syncTestResults, null, 2);
console.log(json);

// 复制到剪贴板（可能需要浏览器权限）
navigator.clipboard.writeText(json);
```

---

## ⚙️ 高级用法

### 自定义测试参数

```javascript
// 在运行测试前修改参数

// 1. 修改事件数量
const NUM_EVENTS = 50; // 默认 10 或 20

// 2. 修改等待时间
const SYNC_WAIT = 60000; // 默认 30-40 秒，改为 60 秒

// 3. 修改日历ID
const customCalendarId = 'your-calendar-id';
window.testCalendarId = customCalendarId;
```

### 连续压力测试

```javascript
// 连续运行测试 3 次，测试稳定性
for (let i = 0; i < 3; i++) {
  console.log(`\n🔄 第 ${i + 1}/3 轮测试\n`);
  
  // 运行测试
  await runTest3(); // 并发测试
  
  // 等待60秒后清理
  await new Promise(resolve => setTimeout(resolve, 60000));
  
  // 清理测试数据
  // ... 执行清理脚本
}
```

---

## 🎯 测试建议

### 推荐测试顺序

1. **首次测试**：运行 `test-sync-suite.js`（完整测试套件）
2. **针对性测试**：根据首次结果，运行失败的单个测试
3. **压力测试**：多次运行并发测试，验证稳定性
4. **清理数据**：删除所有测试事件

### 测试最佳实践

- ✅ 测试前确认网络稳定
- ✅ 测试前登录 Microsoft 账户
- ✅ 每次测试后等待1-2分钟再开始下一次
- ✅ 保存测试报告供后续分析
- ✅ 测试完成后清理测试数据

---

## 📞 问题反馈

如果测试失败或遇到问题，请提供以下信息：

1. 测试报告（`window.syncTestResults`）
2. 浏览器控制台错误信息
3. 队列状态（`localStorage.getItem('remarkable-dev-persistent-syncActions')`）
4. 事件状态（`localStorage.getItem('remarkable-events')`）
5. 同步统计（`localStorage.getItem('syncStats')`）

---

## 🔗 相关文档

- [同步逻辑检查报告](./SYNC_LOGIC_REPORT.md)
- [同步架构文档](./Sync-Architecture.md)
- [EventHub 架构](./EventHub-Migration-Guide.md)
