# Electron 启动性能诊断工具

## 快速使用

### 方法 1: 自动测试（推荐）

1. **在第一个终端**启动 React 开发服务器：
```bash
npm start
```

2. **在第二个终端**运行性能测试：
```bash
cd electron
node performance-test.js
```

### 方法 2: 手动计时

使用秒表记录每个步骤：

```bash
# 记录开始时间
cd electron
npm run electron-dev

# 观察输出，记录：
# - "Compiled successfully!" 出现的时间（React 编译完成）
# - Electron 窗口打开的时间
# - 应用完全可用的时间
```

## 📊 性能测试输出示例

```
========================================
  Electron Startup Performance Test
========================================

[Step 1/5] Checking port 3000...
  ✅ Port available (5ms)

[Step 2/5] Waiting for React dev server...
  ⏳ Waiting... 45s
  ✅ React server ready (45.2s, 45 attempts)

[Step 3/5] Starting Electron...
  ✅ Electron ready (234ms)

[Step 4/5] Creating window...
  ✅ Window created (156ms)

[Step 5/5] Loading content...
  ✅ Content loaded (523ms)

========================================
  Performance Summary
========================================

  Check Port:       5ms
  Wait for React:   45.2s      ← 主要瓶颈
  Electron Ready:   234ms
  Window Created:   156ms
  Content Loaded:   523ms
  ─────────────────────────────────────
  TOTAL TIME:       46.1s

  ✅ Performance: GOOD
========================================
```

## 🎯 性能标准

| 分类 | 总时间 | 评价 |
|------|--------|------|
| **优秀** | < 30秒 | ✅ 正常 |
| **良好** | 30-60秒 | ✅ 可接受 |
| **缓慢** | 60-90秒 | ⚠️ 需要优化 |
| **很慢** | > 90秒 | ❌ 严重问题 |

## 🔍 各步骤时间解读

### 1. Check Port (正常: <1秒)
检查端口 3000 是否被占用。
- **慢的原因**: 网络配置问题

### 2. Wait for React (正常: 30-60秒)
等待 React 开发服务器启动和编译。
- **慢的原因**:
  - TypeScript 类型检查
  - 大量组件编译
  - 磁盘 I/O 慢（HDD vs SSD）
  - Node.js 内存不足

### 3. Electron Ready (正常: <500ms)
Electron 主进程启动。
- **慢的原因**: 系统资源占用

### 4. Window Created (正常: <200ms)
创建 BrowserWindow。
- **慢的原因**: GPU 问题

### 5. Content Loaded (正常: <1秒)
加载 React 应用到窗口。
- **慢的原因**: 网络请求慢

## 🚀 优化建议

### 如果 "Wait for React" > 60秒

#### 方案 1: 增加 Node.js 内存
```bash
# Windows PowerShell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

#### 方案 2: 跳过 TypeScript 检查（开发时）
创建 `.env` 文件：
```env
TSC_COMPILE_ON_ERROR=true
SKIP_PREFLIGHT_CHECK=true
```

#### 方案 3: 禁用源码映射（开发时）
在 `.env` 中添加：
```env
GENERATE_SOURCEMAP=false
```

#### 方案 4: 使用更快的磁盘
- 将项目移到 SSD
- 排除项目文件夹被杀毒软件扫描

### 如果 "Content Loaded" > 2秒

检查网络请求：
```javascript
// 在浏览器控制台运行
performance.getEntriesByType('resource').forEach(r => {
  if (r.duration > 100) {
    console.log(r.name, r.duration + 'ms');
  }
});
```

## 📈 持续监控

### 记录每次启动时间
```bash
# 创建日志文件
node performance-test.js >> startup-logs.txt
echo "---" >> startup-logs.txt
```

### 对比优化前后
```bash
# 优化前
node performance-test.js > before.txt

# 应用优化方案
# ...

# 优化后
node performance-test.js > after.txt

# 对比
diff before.txt after.txt
```

## 🛠️ 故障排查

### 问题: "Port 3000 is in use"
```bash
# 查找占用进程
netstat -ano | findstr :3000

# 终止进程
taskkill /F /PID <进程ID>
```

### 问题: "Timeout waiting for React server"
1. 手动启动 React 服务器：
   ```bash
   npm start
   ```
2. 查看错误信息
3. 检查 `node_modules` 是否完整：
   ```bash
   npm install
   ```

### 问题: Electron 窗口空白
1. 打开 DevTools: `Ctrl+Shift+I`
2. 查看 Console 错误
3. 检查 Network 请求是否失败

## 💡 最佳实践

1. **首次启动**: 预期 60-90秒
2. **热重载**: 预期 5-10秒
3. **生产构建**: 预期 3-5秒

4. **每周清理缓存**:
   ```bash
   npm cache clean --force
   rm -rf node_modules
   npm install
   ```

5. **定期更新依赖**:
   ```bash
   npm outdated
   npm update
   ```

## 📞 需要帮助？

如果性能测试显示 > 90秒，请提供以下信息：
1. 性能测试完整输出
2. 系统配置（CPU、内存、磁盘类型）
3. `npm ls react-scripts` 输出
4. 项目大小（文件数量、总大小）
