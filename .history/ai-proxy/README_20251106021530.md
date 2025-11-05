# 腾讯混元 API 代理服务器

## 🎯 目的

解决浏览器 CORS 限制，允许前端直接调用腾讯混元 API。

## 📋 使用步骤

### 1. 安装依赖

```bash
cd ai-proxy
npm install
```

### 2. 配置密钥

```bash
# 复制配置文件
copy .env.example .env

# 编辑 .env 文件，填入你的腾讯云密钥
HUNYUAN_SECRET_ID=你的SecretId
HUNYUAN_SECRET_KEY=你的SecretKey
PORT=3001
```

### 3. 启动代理服务器

```bash
# 开发模式（自动重启）
npm run dev

# 生产模式
npm start
```

启动成功后会显示：
```
🚀 腾讯混元 API 代理服务器已启动
📡 监听端口: http://localhost:3001
```

### 4. 配置前端使用代理

修改 `src/services/ai/providers/HunyuanProvider.ts`：

```typescript
export class HunyuanProvider implements AIProvider {
  // 使用本地代理而不是直接调用腾讯云
  private endpoint = 'http://localhost:3001/api/hunyuan';
  private useProxy = true;  // 启用代理模式
  
  // ... 其他代码
}
```

### 5. 测试

1. 启动代理服务器: `cd ai-proxy && npm start`
2. 启动前端应用: `npm start`
3. 打开 AI Demo 页面
4. 选择「腾讯混元云端」
5. 上传 PDF 测试提取功能

## 🔧 工作原理

```
┌─────────┐      ┌──────────┐      ┌──────────────┐
│ 浏览器  │─────→│ 代理服务器 │─────→│ 腾讯云 API   │
│ (前端)  │  ✅   │ (Node.js) │  ✅   │ (混元模型)   │
└─────────┘      └──────────┘      └──────────────┘
  无CORS限制       转发请求          官方API
```

**关键点**：
- 浏览器 → 代理：同源（localhost），无 CORS 限制
- 代理 → 腾讯云：Node.js 环境，不受 CORS 限制

## 📊 API 端点

### POST /api/hunyuan

代理腾讯混元 API 请求

**请求体**：
```json
{
  "model": "hunyuan-lite",
  "messages": [
    {
      "role": "user",
      "content": "你好"
    }
  ],
  "topP": 0.8,
  "temperature": 0.1
}
```

**响应**：
```json
{
  "Response": {
    "Choices": [
      {
        "Message": {
          "Content": "你好！有什么我可以帮助你的吗？"
        }
      }
    ],
    "Usage": {
      "PromptTokens": 5,
      "CompletionTokens": 10,
      "TotalTokens": 15
    }
  }
}
```

### GET /health

健康检查

**响应**：
```json
{
  "status": "ok",
  "timestamp": "2025-11-06T12:00:00.000Z",
  "service": "腾讯混元 API 代理"
}
```

## 🔐 安全说明

### 开发环境

**方式 1：环境变量（推荐）**
```bash
# .env 文件
HUNYUAN_SECRET_ID=AKIDxxxx
HUNYUAN_SECRET_KEY=xxxxxx
```

代理服务器从环境变量读取密钥，前端无需传递。

**方式 2：前端传递**
```typescript
// 前端在请求体中传递密钥
{
  "secretId": "AKIDxxxx",
  "secretKey": "xxxxxx",
  "model": "hunyuan-lite",
  "messages": [...]
}
```

### 生产环境

**⚠️ 重要**：生产环境必须使用环境变量，不要在前端暴露密钥！

```bash
# 服务器端设置环境变量
export HUNYUAN_SECRET_ID="AKIDxxxx"
export HUNYUAN_SECRET_KEY="xxxxxx"

# 启动代理
node proxy-server.js
```

## 🚀 部署

### 本地开发

```bash
cd ai-proxy
npm start
```

### 服务器部署

#### 方法 1：使用 PM2（推荐）

```bash
# 安装 PM2
npm install -g pm2

# 启动服务
cd ai-proxy
pm2 start proxy-server.js --name hunyuan-proxy

# 查看状态
pm2 status

# 查看日志
pm2 logs hunyuan-proxy
```

#### 方法 2：使用 Docker

```dockerfile
# Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3001
CMD ["node", "proxy-server.js"]
```

```bash
# 构建镜像
docker build -t hunyuan-proxy .

# 运行容器
docker run -d \
  -p 3001:3001 \
  -e HUNYUAN_SECRET_ID=xxx \
  -e HUNYUAN_SECRET_KEY=xxx \
  --name hunyuan-proxy \
  hunyuan-proxy
```

## 🧪 测试

```bash
# 健康检查
curl http://localhost:3001/health

# 测试 API 调用
curl -X POST http://localhost:3001/api/hunyuan \
  -H "Content-Type: application/json" \
  -d '{
    "model": "hunyuan-lite",
    "messages": [
      {"role": "user", "content": "你好"}
    ]
  }'
```

## ❓ 常见问题

### Q: 代理服务器启动失败？
A: 检查端口 3001 是否被占用：
```bash
# Windows
netstat -ano | findstr :3001

# 修改端口
# 在 .env 中设置: PORT=3002
```

### Q: 前端仍然报 CORS 错误？
A: 确认：
1. 代理服务器已启动
2. 前端 endpoint 配置正确
3. 前端使用 `http://localhost:3001/api/hunyuan`

### Q: API 返回 401 错误？
A: 检查密钥配置：
1. `.env` 文件中的密钥是否正确
2. 重启代理服务器使配置生效

### Q: 性能会受影响吗？
A: 
- 本地代理：延迟增加 < 10ms（几乎无影响）
- 远程代理：取决于服务器位置和网络

## 📝 注意事项

1. **开发环境**：代理运行在 localhost，仅本机可访问
2. **生产环境**：需要部署到服务器，配置域名和 HTTPS
3. **密钥安全**：不要将 `.env` 文件提交到 Git
4. **费用控制**：代理不会增加额外费用，只转发请求

## 📚 相关文档

- **腾讯云 API 文档**: https://cloud.tencent.com/document/product/1729
- **签名方法 V3**: https://cloud.tencent.com/document/api/1729/106050
- **Node.js SDK**: https://github.com/TencentCloud/tencentcloud-sdk-nodejs

## 更新日志

- **2025-11-06**: 创建代理服务器，解决 CORS 限制
