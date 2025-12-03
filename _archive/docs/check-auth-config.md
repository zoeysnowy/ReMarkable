# Azure AD Authentication 配置检查清单

## 当前配置
- **Client ID**: `cf163673-488e-44d9-83ac-0f11d90016ca`
- **Authority**: `https://login.microsoftonline.com/common`
- **Redirect URI**: `http://localhost:3000`
- **Scopes**: User.Read, Calendars.Read, Calendars.ReadWrite, Tasks.ReadWrite

---

## Azure Portal 配置步骤

### 1. 进入 Authentication 页面
```
Azure Portal → App registrations → ReMarkable → Authentication
```

### 2. 检查 Platform configurations

#### ✅ 应该有 "Web" 平台
- **Redirect URIs**: 
  - `http://localhost:3000` ✅

#### ❌ 不需要 "Single-page application"
- MSAL.js 2.x 使用 Web 平台即可

### 3. 检查 Implicit grant and hybrid flows
必须勾选:
- ✅ **Access tokens (used for implicit flows)**
- ✅ **ID tokens (used for implicit and hybrid flows)**

### 4. 检查 Supported account types
应该选择:
- ✅ **Accounts in any organizational directory (Any Azure AD directory - Multitenant)**

因为 authority 设置为 `/common`，必须支持多租户

### 5. 检查 Advanced settings
- **Allow public client flows**: No (默认)
- **Enable the following mobile and desktop flows**: 不勾选

---

## 常见问题诊断

### 问题 1: "Need admin approval" 错误
**原因**: 
- 组织设置了用户同意限制
- 需要管理员预先授予同意

**解决方案**:
1. API permissions 页面 → 点击 "Grant admin consent for [组织名]"
2. 或者联系 IT 管理员帮忙授权
3. 或者创建个人开发者租户(你是管理员)

### 问题 2: Redirect URI mismatch
**原因**: 
- Azure 配置的 Redirect URI 与代码中不一致

**检查**:
- Azure 中必须有 `http://localhost:3000`
- 代码中 `redirectUri` 必须完全匹配

### 问题 3: Invalid scope
**原因**: 
- 请求的 scope 未在 API permissions 中添加

**检查**:
- API permissions 必须包含:
  - User.Read ✅
  - Calendars.Read ✅
  - Calendars.ReadWrite ✅
  - Tasks.ReadWrite ✅

### 问题 4: CORS error
**原因**: 
- 使用了 SPA 平台但实际应该用 Web 平台
- 或者 Implicit grant 未启用

**解决方案**:
- 使用 **Web** 平台(不是 SPA)
- 启用 **Access tokens** 和 **ID tokens**

---

## 验证配置

### 1. 检查 MSAL 配置
```typescript
// src/config/calendar.ts
export const MICROSOFT_GRAPH_CONFIG = {
  clientId: 'cf163673-488e-44d9-83ac-0f11d90016ca',  // ✅ 正确
  authority: 'https://login.microsoftonline.com/common',  // ✅ 多租户
  redirectUri: 'http://localhost:3000',  // ✅ 必须与 Azure 配置完全一致
  scopes: [
    'User.Read',
    'Calendars.Read',
    'Calendars.ReadWrite',
    'Tasks.ReadWrite'  // ✅ 已添加
  ]
};
```

### 2. 测试登录流程
```bash
# 1. 启动应用
npm start

# 2. 打开浏览器控制台
# 3. 尝试登录
# 4. 检查 Network 标签中的请求:
#    - 查看 /authorize 请求的 scope 参数
#    - 查看 /token 请求的响应
#    - 查看是否有 CORS 错误
```

### 3. 检查控制台日志
应该看到:
```
🔐 Microsoft Calendar Service initialized
📥 Fetching calendars from remote...
🔑 Access token available: true
📥 Calendars API response status: 200
📥 Fetched X calendar groups from remote
📥 Fetching todo lists from remote...
🔑 Access token available: true
📥 Todo lists API response status: 200
📥 Fetched X todo lists from remote
```

如果看到 401 或 403 错误:
- 401 Unauthorized → Token 问题,重新登录
- 403 Forbidden → 权限未授予,需要 admin consent

---

## 推荐配置截图位置

请截图以下页面并分享:

1. **Authentication 页面**:
   - Platform configurations (Web 平台)
   - Redirect URIs
   - Implicit grant 设置

2. **API permissions 页面**:
   - 所有权限的 Status 列
   - 是否有 "Granted" 标记

3. **Overview 页面**:
   - Application (client) ID
   - Directory (tenant) ID
   - Supported account types

这样我可以帮你精确诊断配置问题。
