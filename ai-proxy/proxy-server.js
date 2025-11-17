/**
 * 腾讯混元 API 代理服务器
 * 
 * 解决浏览器 CORS 限制，允许前端直接调用腾讯混元 API
 * 
 * 使用方法：
 * 1. 安装依赖: cd ai-proxy && npm install
 * 2. 配置密钥: 复制 .env.example 为 .env，填入腾讯云密钥
 * 3. 启动服务: npm start
 * 4. 前端配置: 修改 HunyuanProvider 使用 http://localhost:3001/api/hunyuan
 * 
 * @author Zoey Gong
 */

const express = require('express');

// 本地时间格式化函数
const formatTimeForStorage = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const s = String(date.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};
const cors = require('cors');
const crypto = require('crypto');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// 允许跨域
app.use(cors());
app.use(express.json());

/**
 * 生成腾讯云 API V3 签名
 */
function generateSignature(secretId, secretKey, payload, timestamp) {
  const service = 'hunyuan';
  const host = 'hunyuan.tencentcloudapi.com';
  const action = 'ChatCompletions';
  const version = '2023-09-01';
  const region = 'ap-guangzhou';
  
  // 1. 拼接规范请求串
  const httpRequestMethod = 'POST';
  const canonicalUri = '/';
  const canonicalQueryString = '';
  const canonicalHeaders = `content-type:application/json\nhost:${host}\n`;
  const signedHeaders = 'content-type;host';
  const hashedRequestPayload = crypto.createHash('sha256').update(payload).digest('hex');
  
  const canonicalRequest = 
    httpRequestMethod + '\n' +
    canonicalUri + '\n' +
    canonicalQueryString + '\n' +
    canonicalHeaders + '\n' +
    signedHeaders + '\n' +
    hashedRequestPayload;
  
  // 2. 拼接待签名字符串
  const algorithm = 'TC3-HMAC-SHA256';
  const date = formatTimeForStorage(new Date(timestamp * 1000)).split(' ')[0];
  const credentialScope = `${date}/${service}/tc3_request`;
  const hashedCanonicalRequest = crypto.createHash('sha256').update(canonicalRequest).digest('hex');
  
  const stringToSign = 
    algorithm + '\n' +
    timestamp + '\n' +
    credentialScope + '\n' +
    hashedCanonicalRequest;
  
  // 3. 计算签名
  const kDate = crypto.createHmac('sha256', 'TC3' + secretKey).update(date).digest();
  const kService = crypto.createHmac('sha256', kDate).update(service).digest();
  const kSigning = crypto.createHmac('sha256', kService).update('tc3_request').digest();
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  
  // 4. 拼接 Authorization
  const authorization = 
    algorithm + ' ' +
    'Credential=' + secretId + '/' + credentialScope + ', ' +
    'SignedHeaders=' + signedHeaders + ', ' +
    'Signature=' + signature;
  
  return authorization;
}

/**
 * 代理端点：转发请求到腾讯混元 API
 */
app.post('/api/hunyuan', async (req, res) => {
  console.log('[Proxy] 收到请求:', formatTimeForStorage(new Date()));
  
  try {
    // 从请求体获取配置（或使用环境变量）
    const secretId = req.body.secretId || process.env.HUNYUAN_SECRET_ID;
    const secretKey = req.body.secretKey || process.env.HUNYUAN_SECRET_KEY;
    
    if (!secretId || !secretKey) {
      return res.status(400).json({
        error: '缺少腾讯云密钥',
        message: '请在 .env 文件中配置 HUNYUAN_SECRET_ID 和 HUNYUAN_SECRET_KEY'
      });
    }
    
    const { model = 'hunyuan-lite', messages, topP = 0.8, temperature = 0.1 } = req.body;
    
    // 转换消息格式：{ role, content } -> { Role, Content }
    const formattedMessages = messages.map(msg => ({
      Role: msg.role,
      Content: msg.content
    }));
    
    // 构建请求体
    const payload = JSON.stringify({
      Model: model,
      Messages: formattedMessages,
      TopP: topP,
      Temperature: temperature,
      Stream: false
    });
    
    const timestamp = Math.floor(Date.now() / 1000);
    const authorization = generateSignature(secretId, secretKey, payload, timestamp);
    
    console.log('[Proxy] 调用腾讯混元 API...');
    
    // 转发到腾讯云
    const fetch = (await import('node-fetch')).default;
    const response = await fetch('https://hunyuan.tencentcloudapi.com/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authorization,
        'X-TC-Action': 'ChatCompletions',
        'X-TC-Version': '2023-09-01',
        'X-TC-Region': 'ap-guangzhou',
        'X-TC-Timestamp': timestamp.toString(),
        'Host': 'hunyuan.tencentcloudapi.com'
      },
      body: payload
    });
    
    const data = await response.json();
    
    if (!response.ok) {
      console.error('[Proxy] API 错误:', data);
      return res.status(response.status).json(data);
    }
    
    console.log('[Proxy] ✅ 请求成功');
    res.json(data);
    
  } catch (error) {
    console.error('[Proxy] ❌ 代理错误:', error);
    res.status(500).json({
      error: '代理服务器错误',
      message: error.message
    });
  }
});

/**
 * 健康检查端点
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: formatTimeForStorage(new Date()),
    service: '腾讯混元 API 代理'
  });
});

/**
 * 根路径说明
 */
app.get('/', (req, res) => {
  res.json({
    name: '腾讯混元 API 代理服务器',
    version: '1.0.0',
    endpoints: {
      'POST /api/hunyuan': '代理腾讯混元 API 请求',
      'GET /health': '健康检查'
    },
    usage: '前端配置 HunyuanProvider 使用此代理服务器',
    docs: 'https://cloud.tencent.com/document/product/1729'
  });
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 腾讯混元 API 代理服务器已启动');
  console.log(`📡 监听端口: http://localhost:${PORT}`);
  console.log('');
  console.log('📋 可用端点:');
  console.log(`   POST http://localhost:${PORT}/api/hunyuan`);
  console.log(`   GET  http://localhost:${PORT}/health`);
  console.log('');
  console.log('💡 前端配置: 修改 HunyuanProvider.ts 中的 endpoint');
  console.log('');
});
