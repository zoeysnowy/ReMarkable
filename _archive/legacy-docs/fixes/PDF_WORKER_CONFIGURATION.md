# PDF.js Worker 配置说明

## 问题描述

在 Electron 环境中使用 `pdfjs-dist` 时，如果 worker 配置为 CDN 地址，会导致以下错误：

```
❌ PDF 解析失败: Setting up fake worker failed: 
"Failed to fetch dynamically imported module: https://cdn.jsdelivr.net/npm/pdfjs-dist@4.0.379/build/pdf.worker.min.js"
```

## 解决方案

### 1. 使用本地 Worker 文件

将 `pdf.worker.min.mjs` 复制到 `public/` 目录，并配置使用本地路径：

```typescript
// src/services/PDFParserService.ts
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
```

### 2. 自动化复制脚本

创建了 `copy-pdf-worker.js` 脚本，在 `npm install` 后自动复制 worker 文件：

```json
// package.json
{
  "scripts": {
    "postinstall": "node copy-pdf-worker.js"
  }
}
```

### 3. 手动复制（备用方案）

如果自动脚本失败，可以手动复制：

**Windows (PowerShell):**
```powershell
Copy-Item "node_modules\pdfjs-dist\build\pdf.worker.min.mjs" -Destination "public\pdf.worker.min.mjs"
```

**macOS/Linux:**
```bash
cp node_modules/pdfjs-dist/build/pdf.worker.min.mjs public/pdf.worker.min.mjs
```

## 文件结构

```
ReMarkable/
├── public/
│   └── pdf.worker.min.mjs          # PDF.js worker 文件（约 700KB）
├── src/
│   └── services/
│       └── PDFParserService.ts     # PDF 解析服务
├── copy-pdf-worker.js              # 自动复制脚本
└── package.json
```

## 验证配置

1. 确认 worker 文件存在：
   ```powershell
   Test-Path "public\pdf.worker.min.mjs"  # 应返回 True
   ```

2. 启动应用后，打开 AI Demo 页面

3. 上传一个 PDF 文件测试：
   - 正常：控制台显示 `[PDFParser] 📄 开始解析 PDF`
   - 失败：检查 Network 标签，确认是否请求 `/pdf.worker.min.mjs`

## 注意事项

### ⚠️ 构建和部署

- **开发环境**：worker 文件在 `public/` 目录，自动被 `react-scripts` 服务
- **生产构建**：`npm run build` 会将 `public/` 内容复制到 `build/` 目录
- **Electron 打包**：确保 `build/pdf.worker.min.mjs` 包含在打包文件中

### 📦 版本管理

- Worker 文件大小约 700KB
- 已添加到 `.gitignore` 中（通过 `postinstall` 自动生成）
- 升级 `pdfjs-dist` 后需要重新运行 `npm install`

### 🔧 故障排除

如果 PDF 解析仍然失败：

1. **检查控制台错误**：
   ```javascript
   // 打开浏览器开发者工具 -> Console
   ```

2. **验证 worker 路径**：
   ```javascript
   console.log(pdfjsLib.GlobalWorkerOptions.workerSrc);
   // 应输出: "/pdf.worker.min.mjs"
   ```

3. **检查 Network 请求**：
   - 打开 Network 标签
   - 上传 PDF 文件
   - 查找 `pdf.worker.min.mjs` 请求
   - 确认返回 200 状态码

4. **清除缓存重试**：
   ```powershell
   # 清除 node_modules 和重新安装
   Remove-Item -Recurse -Force node_modules
   npm install
   ```

## 相关文件

- **服务实现**：`src/services/PDFParserService.ts`
- **AI 服务**：`src/services/ai/AIService.ts`
- **Demo 页面**：`src/components/AIDemo.tsx`
- **技术文档**：`docs/features/AI_EVENT_EXTRACTION_IMPLEMENTATION.md`

## 更新日志

- **2025-11-06**: 修复 CDN 加载失败问题，改用本地 worker 文件
- **2025-11-06**: 添加自动复制脚本 `copy-pdf-worker.js`
- **2025-11-06**: 更新 `package.json` 添加 `postinstall` 钩子
