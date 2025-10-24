# ⚡ React 开发服务器快速启动优化

## 问题诊断

React 启动慢（56 秒）的主要原因：
1. TypeScript 类型检查
2. Source maps 生成
3. 大量模块编译

## 优化方案（按效果排序）

### 方案 1: 增加 Node.js 内存（最有效）

**Windows PowerShell:**
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

**Windows CMD:**
```cmd
set NODE_OPTIONS=--max-old-space-size=4096
npm start
```

### 方案 2: 使用快速启动脚本

创建 `快速启动.bat` 文件：
```bat
@echo off
set NODE_OPTIONS=--max-old-space-size=4096
set TSC_COMPILE_ON_ERROR=true
set GENERATE_SOURCEMAP=false
set SKIP_PREFLIGHT_CHECK=true
npm start
```

双击运行即可。

### 方案 3: 修改 package.json

在 `package.json` 中修改 `start` 脚本：

```json
{
  "scripts": {
    "start": "cross-env NODE_OPTIONS=--max-old-space-size=4096 TSC_COMPILE_ON_ERROR=true GENERATE_SOURCEMAP=false react-scripts start",
    "start:fast": "cross-env NODE_OPTIONS=--max-old-space-size=4096 TSC_COMPILE_ON_ERROR=true GENERATE_SOURCEMAP=false SKIP_PREFLIGHT_CHECK=true react-scripts start"
  }
}
```

然后安装 cross-env:
```bash
npm install --save-dev cross-env
```

## 预期效果

- **优化前**: 56 秒
- **增加内存后**: 25-35 秒
- **禁用类型检查**: 15-25 秒
- **禁用 source maps**: 10-20 秒

## 长期解决方案

### 1. 使用 Vite 替代 create-react-app

Vite 启动速度 < 3 秒（需要迁移项目）

### 2. 代码拆分优化

- 懒加载非首屏组件
- 减少初始包体积
- 使用 React.lazy() 和 Suspense

## 当前推荐

**立即执行**（最简单）：
```powershell
$env:NODE_OPTIONS="--max-old-space-size=4096"
npm start
```

这应该能让启动时间降到 25-35 秒左右。
