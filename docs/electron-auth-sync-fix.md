# Electron 登录状态同步问题修复

## 🐛 问题描述

**症状**：
- 在 Electron 环境中使用窗口登录成功
- 返回"同步"页面后仍显示"未连接"
- 点击"连接"提示已登录，但不显示用户信息和同步功能

**根本原因**：
`MicrosoftCalendarService` 在页面加载时初始化，使用 MSAL.js 检查登录状态。但 Electron 窗口登录使用的是 localStorage 存储令牌，MSAL.js 无法识别。

## ✅ 解决方案

### 1. 修改 `MicrosoftCalendarService.ts`

#### 改动 1: 在 `initializeGraph()` 中添加 Electron 令牌检测

```typescript
private async initializeGraph() {
  try {
    // 🔧 Electron环境：优先从localStorage加载令牌
    if (typeof window !== 'undefined' && (window as any).electronAPI) {
      const token = localStorage.getItem('ms-access-token');
      const expiresAt = localStorage.getItem('ms-token-expires');
      
      if (token && expiresAt) {
        const expiresTime = parseInt(expiresAt);
        const now = Date.now();
        
        if (now < expiresTime - 60000) {
          console.log('✅ [Electron] 从localStorage加载了有效的访问令牌');
          this.accessToken = token;
          this.isAuthenticated = true;
          this.simulationMode = false;
          return; // 早期返回，跳过 MSAL 初始化
        }
      }
    }
    
    // Web 环境继续使用 MSAL
    await this.msalInstance.initialize();
    // ... 原有代码
  }
}
```

#### 改动 2: 添加 `reloadToken()` 公共方法

```typescript
/**
 * 重新加载令牌（用于 Electron 环境认证后）
 */
async reloadToken(): Promise<boolean> {
  try {
    const token = localStorage.getItem('ms-access-token');
    const expiresAt = localStorage.getItem('ms-token-expires');
    
    if (token && expiresAt) {
      const expiresTime = parseInt(expiresAt);
      const now = Date.now();
      
      if (now < expiresTime - 60000) {
        this.accessToken = token;
        this.isAuthenticated = true;
        this.simulationMode = false;
        return true;
      }
    }
    
    return false;
  } catch (error) {
    console.error('❌ [ReloadToken] 重新加载令牌失败:', error);
    return false;
  }
}
```

### 2. 修改 `CalendarSync.tsx`

#### 改动: 在认证成功后重新加载令牌

```typescript
const handleElectronAuthComplete = async (authResult: any) => {
  setShowElectronAuth(false);
  setSyncMessage('✅ 认证成功！正在初始化...');
  
  try {
    // 🔧 Electron 环境：重新加载令牌
    if (microsoftService && typeof (microsoftService as any).reloadToken === 'function') {
      const reloaded = await (microsoftService as any).reloadToken();
      if (reloaded) {
        console.log('✅ [Electron] 令牌重新加载成功');
        setSyncMessage('✅ 认证成功！');
      } else {
        setSyncMessage('⚠️ 认证成功，但初始化失败，请刷新页面');
        return;
      }
    }
    
    // 加载用户信息
    await loadUserInfo();
    
    // 启动同步
    if (syncManager && !syncManager.isActive()) {
      syncManager.start();
    }
  } catch (error) {
    console.error('❌ 初始化失败:', error);
    setSyncMessage(`❌ 初始化失败: ${error}`);
  }
};
```

## 🔍 工作流程

### 场景 1: 首次登录

1. 用户点击"同步" → "连接"
2. 显示 `SimpleMicrosoftLogin` 组件
3. 用户选择"🪟 窗口登录"
4. 登录成功，令牌保存到 localStorage：
   - `ms-access-token`
   - `ms-token-expires`
   - `ms-refresh-token`
5. 调用 `handleElectronAuthComplete`
6. 调用 `microsoftService.reloadToken()` 重新加载令牌
7. 调用 `loadUserInfo()` 获取用户信息
8. 页面显示"已连接"状态和用户信息

### 场景 2: 刷新页面后

1. 页面加载
2. `MicrosoftCalendarService` 构造函数被调用
3. `initializeGraph()` 检测到 Electron 环境
4. 从 localStorage 读取 `ms-access-token`
5. 验证令牌未过期
6. 设置 `this.isAuthenticated = true`
7. `CalendarSync` 的 `useEffect` 检测到 `isSignedIn() === true`
8. 自动加载用户信息
9. 页面显示"已连接"状态

## 🎯 测试步骤

### 1. 清理旧状态

```javascript
// 在浏览器控制台运行
localStorage.clear();
location.reload();
```

### 2. 测试登录流程

1. 点击侧边栏"同步"
2. 确认显示"未连接"
3. 点击"连接"按钮
4. 选择"🪟 窗口登录（推荐）"
5. 在弹出窗口中输入 Microsoft 账户
6. 窗口关闭后，应该看到：
   - ✅ "认证成功！"消息
   - ✅ 状态变为"已连接"
   - ✅ 显示用户名和邮箱
   - ✅ 显示"立即同步"和"日历管理"按钮

### 3. 测试页面刷新

1. 刷新页面（F5）
2. 点击侧边栏"同步"
3. 应该立即显示：
   - ✅ 状态"已连接"
   - ✅ 用户信息
   - ✅ 同步功能按钮

### 4. 测试令牌过期

```javascript
// 手动设置过期令牌
localStorage.setItem('ms-token-expires', String(Date.now() - 1000));
location.reload();
```

应该显示"未连接"，需要重新登录。

## 🔧 调试技巧

### 查看登录状态

```javascript
// 在浏览器控制台运行
console.log('Is Electron:', !!window.electronAPI);
console.log('Access Token:', localStorage.getItem('ms-access-token')?.substring(0, 50) + '...');
console.log('Expires At:', new Date(parseInt(localStorage.getItem('ms-token-expires'))));
console.log('Is Signed In:', window.debug?.microsoftCalendarService?.isSignedIn());
```

### 强制重新加载令牌

```javascript
// 在浏览器控制台运行
await window.debug.microsoftCalendarService.reloadToken();
```

### 查看 Graph API 调用

打开 DevTools → Network 标签，筛选 `graph.microsoft.com`，应该看到：
- ✅ `GET /v1.0/me` (用户信息)
- ✅ `GET /v1.0/me/calendarGroups` (日历组)
- ✅ `GET /v1.0/me/calendars` (日历列表)

## 📊 对比

### 修复前

```
Electron 登录 → localStorage 存储令牌
    ↓
返回"同步"页面
    ↓
MicrosoftCalendarService 使用 MSAL 检查
    ↓
❌ MSAL 找不到账户
    ↓
显示"未连接"
```

### 修复后

```
Electron 登录 → localStorage 存储令牌
    ↓
返回"同步"页面 → 调用 reloadToken()
    ↓
MicrosoftCalendarService 从 localStorage 读取
    ↓
✅ 设置 isAuthenticated = true
    ↓
显示"已连接" + 用户信息
```

## 💡 未来优化

1. **统一令牌存储**：使用 Electron 主进程的安全存储
2. **令牌自动刷新**：在 Electron 环境中实现刷新逻辑
3. **状态同步**：使用 IPC 在主进程和渲染进程间同步认证状态
4. **错误恢复**：令牌失效时自动触发重新登录

## ✅ 验收标准

- [x] Electron 窗口登录成功后，"同步"页面立即显示"已连接"
- [x] 显示用户名和邮箱
- [x] 显示"立即同步"和"日历管理"按钮
- [x] 页面刷新后状态保持
- [x] Web 端登录不受影响
- [x] 令牌过期后正确显示"未连接"
