# OAuth认证过期自动检测实现总结

## 🎯 问题背景
用户的OAuth token已过期，导致：
1. 所有Microsoft Graph API调用返回401 Unauthorized错误
2. StatusBar仍然显示"已连接"状态（❌ 误导用户）
3. 同步统计无法更新（因为API调用失败）
4. 用户不知道需要重新登录

## ✅ 解决方案

### 1. 自动检测认证过期（MicrosoftCalendarService.ts）

#### 新增方法：handleAuthenticationFailure()
```typescript
// 位置：Lines 1262-1286
private handleAuthenticationFailure(): void {
  console.error('🔴 认证失败，清除认证状态');
  
  // 清除本地存储的认证信息
  localStorage.removeItem('ms-access-token');
  localStorage.removeItem('ms-refresh-token');
  localStorage.removeItem('ms-token-expires');
  localStorage.setItem('remarkable-outlook-authenticated', 'false');
  
  // 触发全局事件，通知所有组件认证已过期
  window.dispatchEvent(new CustomEvent('auth-expired', {
    detail: {
      message: '认证已过期，请重新登录 Microsoft 账户',
      timestamp: new Date().toISOString()
    }
  }));
}
```

#### 增强401错误处理（callGraphAPI方法）
```typescript
// 位置：Lines 479-513
// 第一次401：重试一次
if (response.status === 401 && retryCount === 0) {
  await this.refreshToken();
  return this.callGraphAPI(endpoint, method, body, 1);
}

// 第二次仍401：触发认证失败处理
if (response.status === 401) {
  this.handleAuthenticationFailure();
  throw new Error('认证已过期，请重新登录 Microsoft 账户');
}
```

**工作流程：**
1. API调用返回401 → 自动刷新token并重试
2. 重试后仍然401 → 确认token无效
3. 调用handleAuthenticationFailure() → 清除认证状态
4. 触发auth-expired事件 → 通知所有组件
5. 抛出用户友好的错误消息

### 2. StatusBar实时响应（AppLayout.tsx）

#### 添加auth-expired事件监听器
```typescript
// 位置：Lines 323-335
const handleAuthExpired = (event: any) => {
  console.error('🔴 [StatusBar] Auth expired event received:', event.detail);
  setSyncStatus(prev => ({
    ...prev,
    isConnected: false  // 立即更新为未连接状态
  }));
  
  // 显示通知
  if (event.detail?.message) {
    alert(event.detail.message);
  }
};

window.addEventListener('auth-expired', handleAuthExpired);
```

#### 移除冗余的轮询检查
**之前：** 每5秒轮询localStorage检查认证状态
```typescript
// ❌ 已删除
const checkAuth = setInterval(() => {
  const currentAuth = localStorage.getItem('remarkable-outlook-authenticated') === 'true';
  setSyncStatus(prev => {
    if (prev.isConnected !== currentAuth) {
      return { ...prev, isConnected: currentAuth };
    }
    return prev;
  });
}, 5000);
```

**现在：** 使用事件驱动，实时响应
- 无需轮询，减少性能开销
- 401错误发生时立即更新UI
- 更快的响应速度（从5秒延迟到实时）

### 3. Sync页面实时响应（CalendarSync.tsx）

#### 添加auth-expired事件监听器
```typescript
// 位置：Lines 35-62
useEffect(() => {
  const handleAuthExpired = (event: Event) => {
    const customEvent = event as CustomEvent;
    console.log('🚨 [CalendarSync] 认证已过期:', customEvent.detail);
    
    // 清除用户信息
    setUserInfo(null);
    
    // 显示认证过期消息
    setSyncMessage('❌ 认证已过期，请重新登录 Microsoft 账户');
    
    // 停止同步管理器
    if (syncManager && typeof syncManager.isActive === 'function' && syncManager.isActive()) {
      if (typeof syncManager.stop === 'function') {
        syncManager.stop();
      } else if (typeof syncManager.stopSync === 'function') {
        syncManager.stopSync();
      }
    }
  };

  window.addEventListener('auth-expired', handleAuthExpired);
  
  return () => {
    window.removeEventListener('auth-expired', handleAuthExpired);
  };
}, [syncManager]);
```

**功能：**
- 清除用户信息显示
- 显示认证过期消息
- 自动停止同步管理器
- 提示用户重新登录

## 📊 事件流程图

```
Microsoft Graph API (401)
          ↓
MicrosoftCalendarService.callGraphAPI()
          ↓
    重试一次（刷新token）
          ↓
      仍然401？
          ↓
handleAuthenticationFailure()
    ├─ 清除localStorage认证信息
    ├─ 设置 remarkable-outlook-authenticated = false
    └─ 触发 auth-expired 事件
          ↓
    ┌─────────┴──────────┐
    ↓                    ↓
StatusBar           CalendarSync
 (AppLayout.tsx)      (CalendarSync.tsx)
    ↓                    ↓
更新isConnected=false  清除userInfo
显示alert通知         显示认证过期消息
                      停止同步管理器
```

## 🔧 关键改进

### 之前的问题
- ❌ 轮询检查（每5秒），延迟响应
- ❌ StatusBar显示"已连接"即使token已过期
- ❌ 用户不知道为什么同步失败
- ❌ 需要手动检查才能发现认证问题

### 现在的优势
- ✅ 事件驱动，实时响应（0延迟）
- ✅ 401错误时立即更新UI状态
- ✅ 自动停止同步管理器
- ✅ 用户收到明确的重新登录提示
- ✅ 减少不必要的轮询开销

## 🧪 测试步骤

### 必须操作：重新登录
**当前状态：** 你的OAuth token已过期，需要重新登录才能测试完整功能

1. **打开Sync页面**
2. **点击"断开连接"**（如果显示已连接）
3. **点击"连接到Microsoft Calendar"**
4. **完成OAuth授权流程**
5. **获取新的access token**

### 测试认证过期检测
1. 等待token自然过期（通常1小时）
2. 或手动删除localStorage中的token：
   ```javascript
   localStorage.removeItem('ms-access-token');
   ```
3. 尝试同步事项
4. **预期结果：**
   - StatusBar立即显示"未连接"
   - Sync页面显示"认证已过期"消息
   - 弹出alert提示重新登录

### 测试同步统计显示
重新登录后，测试以下操作：

1. **创建新事项并同步**
   - 预期：StatusBar显示"新增日历事项1个💌"

2. **修改事项并同步**
   - 预期：StatusBar显示"1个事项成功同步至日历✅"

3. **删除事项并同步**
   - 预期：StatusBar显示"1个事项成功同步至日历✅"

4. **同步失败时**
   - 预期：StatusBar显示"1个事项同步至日历失败❌"

## 📝 待优化项

### 1. 使用更好的通知组件
**当前：** 使用alert()显示认证过期消息
```typescript
// ⚠️ 临时方案
alert(event.detail.message);
```

**建议：** 使用Toast或Snackbar组件
- 非阻塞式通知
- 更好的用户体验
- 可自动消失
- 可显示操作按钮（如"立即登录"）

### 2. 添加自动重定向
认证过期时，可以自动跳转到Sync页面：
```typescript
const handleAuthExpired = (event: any) => {
  // ... 现有代码 ...
  
  // 自动跳转到Sync页面
  onPageChange('sync');
};
```

### 3. 添加重新登录快捷按钮
在StatusBar的通知中添加"重新登录"按钮：
```typescript
// 示例：使用Toast with action
toast.error('认证已过期', {
  action: {
    label: '重新登录',
    onClick: () => onPageChange('sync')
  }
});
```

## 🎯 成果总结

### 已完成
- ✅ 自动检测OAuth token过期（401错误）
- ✅ 事件驱动的UI更新机制
- ✅ StatusBar实时显示认证状态
- ✅ Sync页面自动响应认证过期
- ✅ 移除冗余的轮询检查
- ✅ 自动停止同步管理器
- ✅ 用户友好的错误提示

### 待测试
- ⏳ 用户需要重新登录获取有效token
- ⏳ 验证同步统计正确显示
- ⏳ 验证认证过期时UI即时更新

### 待改进
- 🔄 替换alert()为Toast/Snackbar组件
- 🔄 添加自动重定向到登录页
- 🔄 添加"重新登录"快捷操作按钮

## 🚀 下一步行动

**立即执行：**
1. 重新登录Microsoft账户（获取新token）
2. 测试创建/修改/删除事项的同步统计
3. 验证StatusBar正确显示统计信息

**后续优化：**
1. 实现Toast/Snackbar通知组件
2. 优化认证过期的用户交互流程
3. 添加认证状态的持久化监控

---

**实现时间：** 2024年（根据对话内容）
**修改文件：**
- `src/services/MicrosoftCalendarService.ts`
- `src/components/AppLayout.tsx`
- `src/components/CalendarSync.tsx`
