# 快速开始：使用腾讯混元 API

## 🎯 为什么需要代理？

腾讯云 API 不支持浏览器直接调用（CORS 限制），需要通过本地代理服务器转发请求。

**代理架构**：
```
浏览器 → 本地代理(3001端口) → 腾讯云 API
   ✅         ✅                 ✅
无CORS      转发请求          官方API
```

## 📋 使用步骤

### 1. 配置腾讯云密钥

```bash
# 进入代理目录
cd ai-proxy

# 复制配置文件
copy .env.example .env  # Windows
cp .env.example .env    # macOS/Linux

# 编辑 .env 文件，填入你的密钥
```

`.env` 文件内容：
```env
HUNYUAN_SECRET_ID=你的SecretId
HUNYUAN_SECRET_KEY=你的SecretKey
PORT=3001
```

密钥获取：https://console.cloud.tencent.com/cam/capi

### 2. 启动代理服务器

**方式 1：使用启动脚本（推荐）**
```bash
# Windows
.\start-proxy.bat

# macOS/Linux
chmod +x start-proxy.sh
./start-proxy.sh
```

**方式 2：手动启动**
```bash
cd ai-proxy
npm install  # 仅首次需要
npm start
```

启动成功后会看到：
```
🚀 腾讯混元 API 代理服务器已启动
📡 监听端口: http://localhost:3001

📋 可用端点:
   POST http://localhost:3001/api/hunyuan
   GET  http://localhost:3001/health
```

### 3. 配置前端使用

1. 启动 React 应用：`npm start`
2. 打开 AI Demo 页面
3. 选择「腾讯混元云端（需代理）」
4. 输入 SecretId 和 SecretKey
5. 保存配置

### 4. 测试

1. 上传一个 PDF 文件
2. 点击「🤖 AI 提取事件信息」
3. 查看提取结果

## 🔧 常见问题

### Q: 代理服务器启动失败？
A: 检查端口 3001 是否被占用：
```powershell
# Windows
netstat -ano | findstr :3001

# 如果被占用，在 .env 中修改端口
PORT=3002
```

### Q: 前端连接代理失败？
A: 确认：
1. 代理服务器已启动（访问 http://localhost:3001/health 测试）
2. 端口号一致（默认 3001）
3. 密钥配置正确

### Q: API 返回错误？
A: 检查：
1. 腾讯云密钥是否正确
2. 账户余额是否充足
3. API 调用频率是否超限

## 💰 费用说明

**免费额度**：每月 10 万 tokens（约 100-200 次调用）

**收费标准**（超出免费额度后）：
- Hunyuan-Lite: ¥0.008/1k tokens
- Hunyuan-Standard: ¥0.012/1k tokens
- Hunyuan-Pro: ¥0.03/1k tokens

**示例**：提取一次事件信息约消耗 500-1000 tokens，成本 ¥0.004-0.008

## 🚀 生产部署

### 部署到服务器

1. 将 `ai-proxy` 目录复制到服务器
2. 配置环境变量（不要暴露密钥）
3. 使用 PM2 守护进程：

```bash
npm install -g pm2
cd ai-proxy
pm2 start proxy-server.js --name hunyuan-proxy
pm2 save
pm2 startup
```

### 配置 HTTPS（推荐）

```bash
# 使用 Nginx 反向代理
upstream hunyuan_proxy {
    server localhost:3001;
}

server {
    listen 443 ssl;
    server_name api.yourdomain.com;
    
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    
    location /api/hunyuan {
        proxy_pass http://hunyuan_proxy;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

前端配置更新为：
```typescript
proxyUrl: 'https://api.yourdomain.com/api/hunyuan'
```

## 📚 相关文档

- **代理服务器详细文档**: `ai-proxy/README.md`
- **腾讯云 API 文档**: https://cloud.tencent.com/document/product/1729
- **密钥管理**: https://console.cloud.tencent.com/cam/capi

## ⚠️ 安全注意事项

1. **不要提交 .env 文件到 Git**（已添加到 .gitignore）
2. **生产环境必须使用环境变量**（不要在代码中硬编码）
3. **定期更换密钥**
4. **监控 API 调用量和费用**
