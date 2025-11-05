# 腾讯混元 CORS 限制说明

## ❌ 问题描述

使用腾讯混元 API 时遇到 CORS 错误：

```
Access to fetch at 'https://hunyuan.tencentcloudapi.com/' from origin 'http://localhost:3000' 
has been blocked by CORS policy: Response to preflight request doesn't pass access control check: 
No 'Access-Control-Allow-Origin' header is present on the requested resource.
```

## 🔍 根本原因

**腾讯云 API 设计为服务器端调用**，不支持浏览器直接访问：

1. **CORS 限制**：腾讯云 API 未配置 `Access-Control-Allow-Origin` 响应头
2. **安全考虑**：防止密钥泄露（浏览器代码可被查看）
3. **架构设计**：API 签名算法在浏览器中暴露不安全

### 影响范围

- ❌ **浏览器环境**：Chrome、Firefox、Safari 等
- ❌ **Electron 应用**：基于 Chromium，同样受 CORS 限制
- ✅ **Node.js 服务器**：不受 CORS 限制
- ✅ **其他后端语言**：Python、Java、Go 等

## ✅ 推荐解决方案

### 方案 1：使用 DashScope（阿里云）- 推荐 ⭐⭐⭐⭐⭐

**优势**：
- ✅ 原生支持浏览器调用（CORS 友好）
- ✅ 免费额度 100 万 tokens
- ✅ 同样优秀的中文能力（Qwen 系列）
- ✅ 零配置，开箱即用

**配置步骤**：
1. 访问 https://dashscope.console.aliyun.com/apiKey
2. 创建 API Key
3. 在 AI Demo 中选择「DashScope 云端」
4. 粘贴 API Key，保存配置

**代码示例**：
```typescript
// DashScope 支持浏览器直接调用
const response = await fetch('https://dashscope.aliyuncs.com/api/v1/...', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ ... })
});
// ✅ 无 CORS 错误
```

### 方案 2：使用 Ollama 本地模型 - 推荐 ⭐⭐⭐⭐

**优势**：
- ✅ 完全离线，无需网络
- ✅ 隐私安全（数据不上传）
- ✅ 无 API 调用限制
- ✅ 支持 Qwen 2.5 和 Gemma 2

**配置步骤**：
1. 下载 Ollama: https://ollama.ai/download
2. 安装并启动：`ollama serve`
3. 下载模型：`ollama pull qwen2.5:7b`
4. 在 AI Demo 中选择「Ollama 本地」

**注意事项**：
- 需要下载 ~4.7GB 模型
- 首次加载较慢（2-5 秒）
- 需要 4-6GB 内存

### 方案 3：搭建代理服务器 - 不推荐 ⭐⭐

**实现思路**：
创建一个 Node.js/Express 后端服务器，转发请求到腾讯云 API。

**架构**：
```
浏览器 → 本地代理服务器 → 腾讯云 API
        (无 CORS)          (有 CORS，但服务器不受影响)
```

**代码示例**：
```javascript
// proxy-server.js (Node.js)
const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors()); // 允许浏览器跨域
app.use(express.json());

app.post('/api/hunyuan', async (req, res) => {
  // 转发到腾讯云 API
  const response = await fetch('https://hunyuan.tencentcloudapi.com/', {
    method: 'POST',
    headers: {
      'Authorization': generateSignature(...),
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(req.body)
  });
  
  const data = await response.json();
  res.json(data);
});

app.listen(3001);
```

**为什么不推荐**：
- ❌ 需要额外维护代理服务器
- ❌ 增加系统复杂度
- ❌ 需要部署和运维成本
- ❌ 不如直接用 DashScope 简单

## 📊 服务商对比

| 服务商 | 浏览器支持 | 免费额度 | 中文能力 | 推荐度 |
|--------|-----------|----------|----------|--------|
| **DashScope** | ✅ 支持 | 100万 tokens | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Ollama** | ✅ 支持 | 无限制 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **腾讯混元** | ❌ 不支持 | 10万/月 | ⭐⭐⭐⭐⭐ | ⭐⭐ |

## 🔧 已实施的修改

### 1. HunyuanProvider 添加警告

```typescript
// src/services/ai/providers/HunyuanProvider.ts
constructor(config: HunyuanConfig) {
  // ...
  console.warn(
    '[HunyuanProvider] ⚠️ 腾讯云 API 不支持浏览器直接调用！\n' +
    '建议切换到 DashScope（阿里云）或 Ollama 本地模型。'
  );
}

private async callAPI(...) {
  throw new Error(
    '⚠️ 腾讯云 API 不支持浏览器调用（CORS 限制）\n' +
    '推荐使用 DashScope 或 Ollama'
  );
}
```

### 2. UI 显示警告提示

```tsx
// src/components/AIDemo.tsx
{provider === 'hunyuan' && (
  <div className="help-text warning">
    <p>⚠️ 重要提示：腾讯云 API 不支持浏览器直接调用</p>
    <p>💡 推荐使用 DashScope（阿里云）</p>
  </div>
)}
```

### 3. 禁用腾讯混元选项

```tsx
<label className="radio-label" style={{ opacity: 0.5 }}>
  <input type="radio" value="hunyuan" disabled />
  <span>腾讯混元云端</span>
  <span className="badge-warning">不支持浏览器</span>
</label>
```

## 💡 最佳实践建议

### 开发环境
```
推荐：DashScope（阿里云）
- 快速测试
- 100万 tokens 免费
- 无需本地配置
```

### 生产环境
```
推荐：Ollama 本地模型
- 隐私安全
- 无网络依赖
- 无调用限制
```

### 敏感数据处理
```
必选：Ollama 本地模型
- 数据不上传云端
- 完全离线运行
- 符合隐私合规要求
```

## 📚 相关文档

- **腾讯云 API 文档**: https://cloud.tencent.com/document/api/1729/106050
- **DashScope 文档**: https://help.aliyun.com/zh/dashscope/
- **Ollama 文档**: https://ollama.ai/docs
- **CORS 说明**: https://developer.mozilla.org/zh-CN/docs/Web/HTTP/CORS

## ❓ 常见问题

### Q: 为什么腾讯云不支持浏览器调用？
A: 出于安全考虑，防止密钥在浏览器代码中暴露。CORS 是浏览器的安全机制，服务器端不受影响。

### Q: Electron 应用也受影响吗？
A: 是的。Electron 基于 Chromium，同样受 CORS 限制。

### Q: 能否通过代理绕过 CORS？
A: 可以，但不推荐。需要搭建额外的代理服务器，增加复杂度。

### Q: DashScope 和腾讯混元哪个更好？
A: 中文能力相当（都基于 Qwen）。DashScope 支持浏览器，更适合本项目。

### Q: 如何切换到 DashScope？
A: 在 AI Demo 页面 → 配置 API → 选择「DashScope 云端」→ 输入 API Key → 保存。

## 更新日志

- **2025-11-06**: 识别腾讯混元 CORS 限制
- **2025-11-06**: 添加 UI 警告提示
- **2025-11-06**: 禁用腾讯混元选项
- **2025-11-06**: 推荐使用 DashScope 替代方案
