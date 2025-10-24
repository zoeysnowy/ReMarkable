# Electron 启动性能优化指南

## 📊 正常启动时间

| 环境 | 首次启动 | 热重载 | 生产环境 |
|------|---------|--------|---------|
| **预期** | 30-60秒 | 5-10秒 | 3-5秒 |
| **你的** | 1-2分钟 | ? | ? |

**结论**: 你的启动速度**慢了 2-3 倍**！

## 🔍 慢启动的可能原因

### 1. React 编译慢 (最可能)
- **原因**: TypeScript 类型检查 + 大量组件
- **占用时间**: 40-90秒

### 2. 端口冲突
- **原因**: 之前的进程未正确关闭
- **占用时间**: 5-15秒（重试延迟）

### 3. 磁盘 I/O 慢
- **原因**: HDD 而非 SSD，或者杀毒软件扫描
- **占用时间**: +20-40秒

### 4. Node.js 内存不足
- **原因**: 默认内存限制导致 GC 频繁
- **占用时间**: +10-30秒

## 🚀 优化方案

### 方案 1: 使用诊断脚本 ⭐推荐

```bash
cd electron
diagnose-startup.bat
```

这会显示每个步骤的用时，帮你定位瓶颈。

### 方案 2: 使用快速启动脚本

```bash
cd electron
quick-start.bat
```

跳过端口检查，直接启动。

### 方案 3: 增加 Node.js 内存 (如果是大项目)

在 `package.json` 中添加：

```json
{
  "scripts": {
    "start": "cross-env NODE_OPTIONS=--max-old-space-size=4096 react-scripts start"
  }
}
```

需要先安装：
```bash
npm install --save-dev cross-env
```

### 方案 4: 禁用 TypeScript 增量检查（开发时）

创建 `.env` 文件：

```env
# 开发环境跳过 TypeScript 检查（加快启动）
TSC_COMPILE_ON_ERROR=true
SKIP_PREFLIGHT_CHECK=true
```

**⚠️ 注意**: 这会跳过类型检查，只在开发时使用！

### 方案 5: 使用 Vite 替代 create-react-app

Vite 启动速度是 CRA 的 10-20 倍：
- CRA: 30-60秒
- Vite: 2-5秒

但需要迁移项目配置（工作量较大）。

## 🎯 立即可用的优化

### 1. 清理端口（每次启动前）

```bash
# PowerShell
Get-Process -Name node | Stop-Process -Force
```

或在启动脚本中自动执行（已包含在 `diagnose-startup.bat` 中）。

### 2. 使用 React Fast Refresh

已经启用（react-scripts 5.0.1 默认开启）。

### 3. 减少文件监听

在 `.env` 中添加：

```env
# 减少文件监听延迟
CHOKIDAR_USEPOLLING=false
WATCHPACK_POLLING=false
```

### 4. 排除不必要的文件

确认 `tsconfig.json` 中的 `exclude` 包含：

```json
{
  "exclude": [
    "node_modules",
    "build",
    "dist",
    "electron/dist",
    ".history"  // 如果使用 VS Code Local History
  ]
}
```

## 🔧 使用诊断工具

### 运行诊断

```bash
cd electron
diagnose-startup.bat
```

### 输出示例

```
╔═══════════════════════════════════════════╗
║  ReMarkable 启动性能诊断                  ║
╚═══════════════════════════════════════════╝

⏱️  开始时间: 18:30:15.23

[步骤 1/5] 检查端口 3000...
  ✅ 端口可用
  用时: 1 秒

[步骤 2/5] 检查依赖...
  ✅ 依赖已安装

[步骤 3/5] 启动 React 开发服务器...
  🚀 React 服务器启动中（后台）...

[步骤 4/5] 等待服务器响应...
  ⏳ 等待中... (1 秒)
  ⏳ 等待中... (2 秒)
  ...
  ✅ React 服务器就绪
  等待用时: 45 秒  ← 这里是主要瓶颈！

[步骤 5/5] 启动 Electron 应用...
  🖥️  Electron 启动中...

╔═══════════════════════════════════════════╗
║  性能统计                                 ║
╚═══════════════════════════════════════════╝

总用时: ~50 秒
```

## 📈 预期改进

| 优化方法 | 节省时间 | 难度 |
|---------|---------|------|
| 清理端口 | 5-15秒 | ⭐ 简单 |
| 增加内存 | 10-20秒 | ⭐ 简单 |
| 禁用类型检查 | 20-30秒 | ⭐⭐ 中等 |
| 使用 Vite | 50-80秒 | ⭐⭐⭐⭐ 困难 |

## 🎯 快速诊断清单

运行这个命令，看看哪里慢：

```bash
cd electron
diagnose-startup.bat
```

然后根据输出：

- ✅ **步骤 4 等待时间 > 60秒** → React 编译慢，使用方案 3 或 4
- ✅ **步骤 1 发现端口占用** → 使用 `quick-start.bat` 或手动清理
- ✅ **总时间 > 90秒** → 考虑硬件升级（SSD）或使用 Vite

## 💡 建议优先级

1. **立即执行** (5分钟):
   - 使用 `diagnose-startup.bat` 确认瓶颈
   - 清理端口冲突

2. **今天执行** (15分钟):
   - 增加 Node.js 内存 (方案 3)
   - 添加 `.env` 优化 (方案 4)

3. **本周执行** (1-2小时):
   - 迁移到 Vite (如果团队同意)

## 🔍 进一步调试

如果上述方案都不够快，运行：

```bash
# 查看详细的 React 编译日志
cd ..
npm start -- --verbose
```

或者：

```bash
# 分析打包体积
npm run build -- --stats
npx source-map-explorer 'build/static/js/*.js'
```
