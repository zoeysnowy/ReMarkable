# Azure AD 应用配置指南

## 应用信息

- **Display name**: ReMarkable
- **Application (client) ID**: `cf163673-488e-44d9-83ac-0f11d90016ca`

## 🔧 必需配置步骤

### 1. 添加 Redirect URI

1. 登录 [Azure Portal](https://portal.azure.com)
2. 进入 **Azure Active Directory** → **App registrations**
3. 找到并点击 **"ReMarkable"** 应用
4. 点击左侧 **"Authentication"**
5. 在 **"Platform configurations"** 下，点击 **"+ Add a platform"**
6. 选择 **"Mobile and desktop applications"**
7. 添加以下 Redirect URI：

```
https://login.microsoftonline.com/common/oauth2/nativeclient
```

或者如果已有 Mobile and desktop 平台，直接添加上述 URI。

8. 点击 **"Save"**

### 2. 启用公共客户端流

在同一个 **"Authentication"** 页面：

1. 滚动到底部找到 **"Advanced settings"**
2. 在 **"Allow public client flows"** 下
3. 将开关设置为 **"Yes"**
4. 点击 **"Save"**

### 3. 配置 API 权限

1. 点击左侧 **"API permissions"**
2. 点击 **"+ Add a permission"**
3. 选择 **"Microsoft Graph"**
4. 选择 **"Delegated permissions"**
5. 添加以下权限：
   - ✅ `User.Read`
   - ✅ `Calendars.Read`
   - ✅ `Calendars.ReadWrite`
   - ✅ `offline_access`

6. 点击 **"Add permissions"**

### 4. 授予管理员同意（可选但推荐）

如果你是组织管理员：

1. 在 **"API permissions"** 页面
2. 点击 **"Grant admin consent for [你的组织]"**
3. 点击 **"Yes"** 确认

这会为所有用户预先授权，避免每个用户都需要同意。

## 📋 完整配置检查清单

完成后，你的配置应该如下：

### Authentication 页面

```yaml
Platform configurations:
  Mobile and desktop applications:
    Redirect URIs:
      - https://login.microsoftonline.com/common/oauth2/nativeclient
      
Advanced settings:
  Allow public client flows: Yes
```

### API permissions 页面

```yaml
Configured permissions:
  Microsoft Graph (Delegated):
    - User.Read
    - Calendars.Read
    - Calendars.ReadWrite
    - offline_access
    
Status: ✅ Granted for [organization]
```

## 🚀 测试登录

配置完成后：

1. 重启 ReMarkable 应用
2. 进入 **Microsoft 认证** 页面
3. 选择 **"🪟 窗口登录"**
4. 点击 **"开始窗口登录"**
5. 在弹出窗口中输入 Microsoft 账户
6. 如果是首次登录，会看到权限同意页面
7. 点击 **"Accept"**
8. 登录成功！

## ❓ 常见问题

### Q: 仍然看到 AADSTS65002 错误？

**A**: 这表示 Client ID 配置有问题。请确认：
- Client ID 正确: `cf163673-488e-44d9-83ac-0f11d90016ca`
- Redirect URI 完全匹配（包括 https://）
- 公共客户端流已启用

### Q: 看到 "需要管理员批准" 错误？

**A**: 两种解决方案：
1. **推荐**: 让组织管理员在 Azure Portal 中授予管理员同意
2. **临时**: 在代码中使用 `forceConsent: true`（每个用户首次登录时需同意）

### Q: 登录后无法访问日历？

**A**: 检查 API 权限：
- 确保添加了 `Calendars.Read` 和 `Calendars.ReadWrite`
- 如果是工作/学校账户，需要管理员同意

### Q: 个人 Microsoft 账户 vs 工作/学校账户？

**A**: 
- **个人账户** (outlook.com, hotmail.com): 可以直接登录
- **工作/学校账户**: 可能需要组织管理员批准权限

## 🔒 安全建议

1. ✅ 不要在代码中硬编码 Client Secret（本应用使用公共客户端流，无需 Secret）
2. ✅ 使用 HTTPS Redirect URI（已配置）
3. ✅ 启用 `offline_access` 以支持刷新令牌
4. ✅ Token 存储在本地加密存储中（可选改进）

## 📚 参考文档

- [Azure AD 公共客户端应用](https://docs.microsoft.com/en-us/azure/active-directory/develop/msal-client-applications)
- [Microsoft Graph API 权限](https://docs.microsoft.com/en-us/graph/permissions-reference)
- [OAuth 2.0 授权码流程](https://docs.microsoft.com/en-us/azure/active-directory/develop/v2-oauth2-auth-code-flow)
