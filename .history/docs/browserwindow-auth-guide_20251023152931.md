# BrowserWindow OAuth 认证指南

## 概述

新增了 **BrowserWindow 窗口登录** 功能，这是 Electron 桌面应用最推荐的登录方式。

### 为什么选择 BrowserWindow 登录？

1. **用户体验最佳** - 无需手动复制粘贴任何代码或令牌
2. **完全自动化** - 在 Electron 窗口内完成登录，自动获取授权码
3. **安全可靠** - 使用官方 OAuth 2.0 流程
4. **无需管理员权限** - 使用 Microsoft 公共客户端 ID

## 实现原理

### 工作流程

```
用户点击登录
    ↓
打开 BrowserWindow 显示 Microsoft 登录页面
    ↓
用户在窗口内输入账号密码
    ↓
Microsoft 重定向到 redirect_uri（带授权码）
    ↓
主进程监听 URL 变化，提取授权码
    ↓
自动用授权码交换访问令牌
    ↓
关闭登录窗口，保存令牌
    ↓
登录完成！
```

### 技术细节

#### 1. 主进程 (electron/main.js)

```javascript
ipcMain.handle('microsoft-login-window', async (event, authUrl) => {
  return new Promise((resolve, reject) => {
    // 创建登录窗口
    let authWindow = new BrowserWindow({
      width: 600,
      height: 800,
      title: 'Microsoft 登录'
    });

    authWindow.loadURL(authUrl);

    // 监听 URL 重定向
    authWindow.webContents.on('will-redirect', (event, url) => {
      handleAuthRedirect(url);
    });

    function handleAuthRedirect(url) {
      // 检测回调 URL
      if (url.includes('oauth2/nativeclient')) {
        const code = new URL(url).searchParams.get('code');
        if (code) {
          authWindow.close();
          resolve({ success: true, code });
        }
      }
    }
  });
});
```

#### 2. 渲染进程 (src/services/ElectronWindowAuth.ts)

```typescript
async authenticateWithWindow(): Promise<WindowAuthResult> {
  // 1. 构建 OAuth URL
  const authUrl = this.buildAuthUrl();
  
  // 2. 打开 BrowserWindow 并等待授权码
  const result = await window.electronAPI.microsoftLoginWindow(authUrl);
  
  // 3. 用授权码交换访问令牌
  const tokenResponse = await this.exchangeCodeForToken(result.code);
  
  return tokenResponse;
}
```

## 使用方法

### 在组件中使用

```tsx
import { electronWindowAuth } from '../services/ElectronWindowAuth';

// 方法1: 直接调用
const handleLogin = async () => {
  try {
    const result = await electronWindowAuth.authenticateWithWindow();
    console.log('登录成功！', result);
    // 保存 result.accessToken
  } catch (error) {
    console.error('登录失败', error);
  }
};

// 方法2: 使用 SimplifiedMicrosoftCalendarService
import { simplifiedMicrosoftCalendarService } from '../services/SimplifiedMicrosoftCalendarService';

const handleLogin = async () => {
  try {
    await simplifiedMicrosoftCalendarService.authenticateWithWindow();
    console.log('登录成功！');
  } catch (error) {
    console.error('登录失败', error);
  }
};
```

### 在 UI 中使用

组件 `SimpleMicrosoftLogin.tsx` 已默认支持窗口登录：

```tsx
<SimpleMicrosoftLogin
  onSuccess={(result) => {
    console.log('认证成功', result);
  }}
  onError={(error) => {
    console.error('认证失败', error);
  }}
/>
```

用户可以在三种登录方式中选择：
- 🪟 **窗口登录（推荐）** - 最简单快速
- 📱 设备代码流程 - 需要手动输入代码
- 🌐 浏览器 OAuth - 传统方式

## 配置说明

### Client ID

使用 Microsoft Graph 公共测试应用 ID：
```typescript
private clientId = 'd3590ed6-52b3-4102-aeff-aad2292ab01c';
```

### Redirect URI

```typescript
private redirectUri = 'https://login.microsoftonline.com/common/oauth2/nativeclient';
```

这是 Microsoft 官方为本地应用提供的回调 URI，无需注册。

### Scopes

```typescript
private scopes = [
  'https://graph.microsoft.com/User.Read',
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'offline_access'
];
```

## 错误处理

### AADSTS700016 错误

如果遇到 `Application with identifier 'xxx' was not found` 错误：

**原因**：应用 ID 不正确或未在 Azure AD 中注册

**解决方案**：
1. ✅ 使用我们提供的公共客户端 ID（已配置）
2. 或注册自己的应用：
   - 访问 [Azure Portal](https://portal.azure.com)
   - 注册新应用
   - 配置 Redirect URI 为 `https://login.microsoftonline.com/common/oauth2/nativeclient`
   - 启用"公共客户端流"
   - 复制 Application (client) ID

### 用户取消登录

```typescript
try {
  await electronWindowAuth.authenticateWithWindow();
} catch (error) {
  if (error.message === '用户取消了登录') {
    console.log('用户主动关闭了登录窗口');
  }
}
```

### Token 刷新

```typescript
// 使用 refresh token 刷新访问令牌
const newToken = await electronWindowAuth.refreshAccessToken(refreshToken);
```

## API 参考

### ElectronWindowAuth

#### authenticateWithWindow()
打开 BrowserWindow 进行登录

**返回值**：
```typescript
{
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}
```

#### refreshAccessToken(refreshToken: string)
刷新访问令牌

**参数**：
- `refreshToken` - 之前获取的刷新令牌

**返回值**：新的访问令牌对象

## 测试

### 1. 重启应用

```bash
npm run electron-dev
```

### 2. 打开同步设置

点击左侧菜单的"同步设置"

### 3. 选择登录方式

选择 "🪟 窗口登录（推荐）"

### 4. 点击登录

会弹出一个新窗口，显示 Microsoft 登录页面

### 5. 完成登录

输入账号密码，完成登录后窗口自动关闭

### 6. 验证

检查控制台日志：
```
✅ [WindowAuth] 获取到授权码
🔄 [WindowAuth] 交换授权码...
🎉 [WindowAuth] 认证成功！
```

## 优势对比

| 特性 | 窗口登录 | 设备代码 | 浏览器 OAuth |
|------|---------|---------|-------------|
| 用户操作 | 最少 | 中等 | 中等 |
| 速度 | 最快 | 较慢 | 中等 |
| 体验 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐ |
| 安全性 | 高 | 高 | 高 |
| 需要复制粘贴 | ❌ | ✅ | ❌ |
| 支持所有账户 | ✅ | ✅ | ✅ |

## 总结

**BrowserWindow 窗口登录** 是 Electron 桌面应用的最佳选择：
- ✅ 无需手动操作令牌或代码
- ✅ 用户体验流畅
- ✅ 完全自动化
- ✅ 安全可靠

推荐作为默认登录方式！
