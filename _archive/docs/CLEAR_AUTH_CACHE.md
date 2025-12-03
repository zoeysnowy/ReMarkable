# 清除 Microsoft 登录缓存

## 问题
更换 Azure AD 应用后,需要清除旧的登录缓存,否则会继续使用旧的 Client ID。

## 解决方案

### 方法 1: 清除浏览器缓存(推荐)

#### Chrome/Edge
1. 按 `F12` 打开开发者工具
2. 右键点击刷新按钮
3. 选择 **"清空缓存并硬性重新加载"**
4. 或者:
   - 按 `Ctrl + Shift + Delete`
   - 选择 "Cookie 和其他网站数据"
   - 选择 "缓存的图像和文件"
   - 时间范围: "过去 1 小时"
   - 点击 "清除数据"

### 方法 2: 清除 localStorage

在浏览器控制台运行:
```javascript
// 清除 MSAL 缓存
localStorage.clear();
sessionStorage.clear();

// 清除所有 msal 相关的键
Object.keys(localStorage).forEach(key => {
  if (key.startsWith('msal')) {
    localStorage.removeItem(key);
  }
});

// 刷新页面
location.reload();
```

### 方法 3: 使用无痕模式测试

1. 按 `Ctrl + Shift + N` (Chrome/Edge)
2. 在无痕窗口中打开 `http://localhost:3000`
3. 尝试登录

### 方法 4: 清除 Electron 缓存(如果使用 Electron)

在 Electron 主进程中添加清除缓存代码:

```javascript
// electron/main.js
const { session } = require('electron');

// 清除所有缓存
await session.defaultSession.clearStorageData({
  storages: ['cookies', 'localstorage', 'cachestorage']
});

// 或者在启动时清除
app.on('ready', async () => {
  // 开发环境清除缓存
  if (isDev) {
    await session.defaultSession.clearStorageData();
  }
  
  createWindow();
});
```

---

## 验证登录流程

清除缓存后:

1. **启动应用**:
   ```bash
   npm start
   ```

2. **打开浏览器控制台** (F12)

3. **点击登录按钮**

4. **检查 Network 标签**:
   - 应该看到请求到 `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
   - 检查请求参数中的 `client_id` 是否是新的 Client ID

5. **完成登录**:
   - 使用开发者租户的管理员账号登录
   - 应该看到授权同意页面(列出所有权限)
   - 点击 "Accept" 授权

6. **检查控制台日志**:
   ```
   🔐 Microsoft Calendar Service initialized
   📥 Fetching calendars from remote...
   📥 Calendars API response status: 200
   📥 Fetching todo lists from remote...
   📥 Todo lists API response status: 200
   ```

---

## 常见问题

### Q: 清除缓存后还是登录失败?
A: 检查 Client ID 是否已更新到代码中,并重新启动应用。

### Q: 看到 "AADSTS700016: Application not found"
A: Client ID 配置错误,检查 `src/config/calendar.ts` 中的 `clientId`。

### Q: 看到 "redirect_uri_mismatch"
A: Azure 配置的 Redirect URI 与代码不一致,确保都是 `http://localhost:3000`。

### Q: 开发者租户会过期吗?
A: 免费的 Microsoft 365 开发者订阅有效期 90 天,但只要保持活跃使用就会自动续期。
