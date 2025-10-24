# Electron 性能诊断指南

## 🎯 目标

帮助诊断和解决 Electron 应用卡顿问题，找出性能瓶颈。

## 📋 诊断步骤

### 步骤 1: 打开性能监控

1. **启动应用**
   ```bash
   cd electron
   npm run electron-dev
   ```

2. **打开开发者工具**
   - 按 `Ctrl + Shift + I`（Windows/Linux）
   - 或 `Cmd + Option + I`（Mac）

3. **加载性能工具**
   - 在 Console 标签中
   - 复制 `electron/performance-console-tools.js` 的全部内容
   - 粘贴到控制台并回车

### 步骤 2: 快速诊断

```javascript
// 1. 查看性能摘要
await perfTools.showSummary()

// 2. 获取优化建议
await perfTools.getSuggestions()
```

### 步骤 3: 深度分析

#### 监控 IPC 调用（找出频繁调用）

```javascript
// 监控 30 秒内的所有 IPC 调用
await perfTools.monitorIPC(30000)

// 操作应用（拖动窗口、同步日历等）
// 等待 30 秒后查看结果
```

**查看内容：**
- 调用次数最多的 IPC 通道
- 平均耗时最长的操作
- 高频调用警告（> 50 次/秒）

#### 检测内存泄漏

```javascript
// 每 5 秒采样一次，共采样 10 次
await perfTools.checkMemoryLeak(5000, 10)

// 在监控期间正常使用应用
// 等待 50 秒后查看内存趋势
```

**判断标准：**
- ✅ 增长 < 5 MB：正常
- ⚠️ 增长 5-10 MB：需观察
- 🔴 增长 > 10 MB：可能泄漏

### 步骤 4: 查看主进程日志

性能监控系统会自动在终端输出：

1. **自动报告**（每 30 秒）
   - 查看启动 Electron 的终端窗口
   - 会看到详细的性能统计

2. **手动触发报告**
   ```javascript
   await perfTools.printReport()
   ```
   然后查看终端输出

## 🔍 常见性能问题诊断

### 问题 1: 应用启动慢

**症状：** 打开应用需要 > 5 秒

**诊断：**
```bash
# 使用启动性能测试工具
cd electron
node performance-test.js
```

**查看：**
- React 编译时间（正常 < 60 秒）
- Electron 启动时间（正常 < 1 秒）
- 内容加载时间（正常 < 2 秒）

### 问题 2: 拖动窗口卡顿

**症状：** 拖动桌面小组件时明显卡顿、掉帧

**诊断：**
```javascript
// 1. 开始监控
await perfTools.monitorIPC(10000)

// 2. 拖动小组件窗口 10 秒

// 3. 查看结果
```

**关注指标：**
- `widget-move` 调用次数
  - ✅ 正常：10-20 次/秒
  - ⚠️ 偏高：20-50 次/秒
  - 🔴 过高：> 50 次/秒
- `widget-move` 平均耗时
  - ✅ 正常：< 5ms
  - ⚠️ 偏慢：5-20ms
  - 🔴 很慢：> 20ms

**解决方案：**
- 如果调用频率过高：增加节流时间
- 如果单次耗时过长：优化 setBounds 逻辑

### 问题 3: 日历同步慢

**症状：** 同步日历事件需要很长时间

**诊断：**
```javascript
// 1. 重置统计
await perfTools.resetStats()

// 2. 执行一次完整同步

// 3. 查看报告
await perfTools.showSummary()
```

**关注指标：**
- Microsoft Graph API 相关的 IPC 调用
- 网络请求耗时
- 数据处理时间

### 问题 4: 内存占用过高

**症状：** 应用运行一段时间后内存持续增长

**诊断：**
```javascript
// 长期监控（每 10 秒采样，共 20 次 = 3 分钟）
await perfTools.checkMemoryLeak(10000, 20)

// 在监控期间正常使用应用
// 包括：打开关闭页面、同步日历、操作小组件等
```

**判断内存泄漏：**
- 内存持续线性增长
- 不执行操作时内存也在增长
- 垃圾回收后内存不降低

## 📊 性能指标参考

### IPC 调用性能

| 操作 | 正常耗时 | 警告阈值 | 严重阈值 |
|------|---------|---------|---------|
| widget-move | < 5ms | 10ms | 20ms |
| widget-resize | < 10ms | 20ms | 50ms |
| get-auth-tokens | < 5ms | 10ms | 20ms |
| 文件对话框 | < 100ms | 200ms | 500ms |
| Microsoft 认证 | < 500ms | 1000ms | 3000ms |

### 内存使用

| 指标 | 正常 | 警告 | 严重 |
|------|------|------|------|
| Heap Used | < 100 MB | 100-200 MB | > 200 MB |
| RSS | < 200 MB | 200-400 MB | > 400 MB |

### CPU 使用

- **空闲时**：User + System < 5 秒
- **活跃时**：User + System < 30 秒（每分钟）

## 🛠️ 优化建议

### 高频 IPC 调用

如果某个 IPC 调用频率 > 100 次/秒：

```javascript
// 添加防抖或节流
import { throttle } from 'lodash';

const throttledMove = throttle((position) => {
  window.electronAPI.widgetMove(position);
}, 100); // 限制为每 100ms 最多调用 1 次
```

### 慢速操作

如果某个操作耗时 > 100ms：

1. **异步化**：不要阻塞 UI 线程
2. **批量处理**：合并多个小请求
3. **缓存**：避免重复计算

### 内存泄漏

如果检测到内存泄漏：

1. **检查事件监听器**：确保正确清理
2. **检查定时器**：使用 `clearInterval`/`clearTimeout`
3. **检查闭包**：避免循环引用
4. **使用 Chrome DevTools Memory Profiler**

## 📝 性能日志示例

### 正常情况

```
========================================
📊 [性能监控] 性能报告
========================================
⏱️  运行时间: 125.34s
💾 内存使用:
   - RSS: 156.23 MB
   - Heap Used: 45.67 MB
   - Heap Total: 78.91 MB
   - External: 2.34 MB
⚡ CPU 使用:
   - User: 3.45s
   - System: 1.23s
📡 IPC 调用统计 (Top 10):
   widget-move:
      调用次数: 234
      平均耗时: 3.21ms
      最大耗时: 15ms
      最小耗时: 1ms
   get-auth-tokens:
      调用次数: 45
      平均耗时: 2.15ms
      最大耗时: 8ms
      最小耗时: 1ms
========================================
```

### 异常情况

```
========================================
📊 [性能监控] 性能报告
========================================
⏱️  运行时间: 125.34s
💾 内存使用:
   - RSS: 456.78 MB  ⚠️ 过高
   - Heap Used: 234.56 MB  ⚠️ 过高
   - Heap Total: 289.12 MB
   - External: 12.34 MB
⚡ CPU 使用:
   - User: 45.67s  ⚠️ 偏高
   - System: 12.34s
📡 IPC 调用统计 (Top 10):
   widget-move:
      调用次数: 12345  ⚠️ 频繁
      平均耗时: 45.67ms  ⚠️ 慢
      最大耗时: 234ms  ⚠️ 很慢
      最小耗时: 5ms
   
⚠️ [Perf] 慢速 IPC: widget-move 耗时 234ms
⚠️ [Perf] 慢速 IPC: widget-resize 耗时 156ms
========================================
```

## 💡 实用技巧

### 技巧 1: 对比测试

```javascript
// 优化前
await perfTools.resetStats()
// 执行操作...
const before = await perfTools.getReport()

// 应用优化
// ...

// 优化后
await perfTools.resetStats()
// 执行相同操作...
const after = await perfTools.getReport()

// 对比结果
console.log('优化效果:', {
  ipc调用减少: before.ipc['widget-move'].count - after.ipc['widget-move'].count,
  平均耗时减少: before.ipc['widget-move'].avgTime - after.ipc['widget-move'].avgTime
})
```

### 技巧 2: 持续监控

在应用中添加监控按钮：

```javascript
// 添加到设置页面
<button onClick={async () => {
  const report = await window.electronAPI.performance.getReport();
  console.log('性能报告:', report);
}}>
  查看性能
</button>
```

### 技巧 3: 自动化测试

```javascript
// 创建性能测试脚本
async function performanceTest() {
  await perfTools.resetStats();
  
  // 模拟用户操作
  for (let i = 0; i < 100; i++) {
    await window.electronAPI.widgetMove({ x: 1, y: 0 });
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  
  // 获取结果
  const report = await perfTools.getReport();
  console.assert(report.ipc['widget-move'].avgTime < 10, '拖动性能测试失败');
}
```

## 🚨 紧急情况处理

### 应用完全卡死

1. 按 `Ctrl + Shift + I` 打开 DevTools
2. 切换到 Performance 标签
3. 点击录制按钮
4. 重现卡死操作
5. 停止录制，查看火焰图

### 查看崩溃日志

```javascript
// 在控制台执行
window.electronAPI.getUserDataPath().then(path => {
  console.log('用户数据路径:', path);
  console.log('崩溃日志位置:', path + '/crashReports/');
})
```

### 强制垃圾回收

```javascript
// 在 Chrome DevTools Memory 标签
// 点击垃圾桶图标强制 GC
// 或在代码中（需要启动时添加 --expose-gc）
if (global.gc) {
  global.gc();
}
```

## 📞 需要帮助？

如果诊断后仍有问题，请提供：

1. `perfTools.showSummary()` 的完整输出
2. `perfTools.getSuggestions()` 的建议
3. 主进程终端的性能报告
4. 系统信息（CPU、内存、磁盘类型）
5. 具体的卡顿场景描述

---

**祝你诊断顺利！🎉**
