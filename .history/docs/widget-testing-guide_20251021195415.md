# 🧪 Widget Testing Guide

## Quick Test Steps

### Test 1: Authentication Sharing ✅

1. **Login in Main Window**
   ```
   Navigate to: http://localhost:3000/#/msauth
   Click: "设备代码登录" or "浏览器登录"
   Complete: Microsoft authentication
   
   Expected Console Output:
   ✅ 设备代码认证成功 (or 浏览器认证成功)
   🔐 主进程已保存认证令牌
   ```

2. **Open Widget**
   ```
   Navigate to: http://localhost:3000/#/timecalendar
   Click: "📍 悬浮窗" button
   
   Expected Behavior:
   - Widget window opens
   - NO "未认证，无法获取日历列表" error
   - Calendars load automatically
   
   Expected Console Output (in widget):
   ✅ 从主进程加载了有效的访问令牌
   ✅ Microsoft Graph 连接测试成功
   ```

### Test 2: Transparent Background 🎨

1. **Check Default Transparency**
   ```
   With widget open:
   - NO white background should be visible
   - Only calendar content with control bar appears
   - Desktop/other windows visible through widget
   ```

2. **Test Settings Panel**
   ```
   Hover over widget → Shows control bar
   Click "⚙️ 设置"
   
   Check:
   - 整体透明度: 95%
   - 背景透明度: 0% (fully transparent by default)
   - 背景颜色: #ffffff
   
   Try adjusting:
   - Increase 背景透明度 → semi-transparent white background appears
   - Change 背景颜色 → background tint changes
   - Decrease 整体透明度 → entire widget becomes translucent
   ```

3. **Test Dragging & Resizing**
   ```
   - Drag widget by clicking anywhere on it
   - Resize by dragging bottom-right corner
   - Click "🔓 可拖拽" → Changes to "🔒 已锁定"
   - Locked mode prevents dragging/resizing
   ```

### Expected Results Summary

| Feature | Expected Behavior | Status |
|---------|------------------|--------|
| Widget Authentication | Inherits from main window | ✅ Fixed |
| White Background | Removed (transparent by default) | ✅ Fixed |
| Calendar Loading | Loads without extra login | ✅ Fixed |
| Settings Panel | Adjustable opacity & color | ✅ Working |
| Drag & Drop | Smooth movement (unlocked mode) | ✅ Working |
| Resize | Bottom-right corner handle | ✅ Working |
| Lock Mode | Prevents drag/resize | ✅ Working |

### Debug Console Commands

```javascript
// Check if in Electron
console.log('Is Electron:', window.electronAPI?.isElectron);

// Check stored tokens (localStorage)
console.log('Access Token:', localStorage.getItem('ms-access-token')?.substring(0, 20) + '...');
console.log('Token Expires:', new Date(parseInt(localStorage.getItem('ms-token-expires'))));

// Check main process tokens (Electron only)
if (window.electronAPI?.getAuthTokens) {
  window.electronAPI.getAuthTokens().then(tokens => {
    console.log('Main Process Tokens:', tokens ? 'Present' : 'None');
    if (tokens) {
      console.log('Expires:', new Date(tokens.expiresAt));
    }
  });
}

// Check widget settings
const settings = localStorage.getItem('desktop-calendar-widget-settings');
console.log('Widget Settings:', settings ? JSON.parse(settings) : 'Not set');
```

### Troubleshooting

#### Problem: "未认证，无法获取日历列表"

**Possible Causes:**
1. Not logged in yet in main window
2. Token expired
3. Main process token store empty

**Solutions:**
```bash
# Solution 1: Re-authenticate
1. Close widget
2. Go to Microsoft 认证 page
3. Click "设备代码登录"
4. Complete login
5. Re-open widget

# Solution 2: Check console for errors
Open DevTools in both main and widget windows
Look for red error messages

# Solution 3: Clear and restart
localStorage.clear();
location.reload();
```

#### Problem: White background still visible

**Possible Causes:**
1. Old cached settings with bgOpacity: 0.8
2. CSS not applied
3. Body background not transparent

**Solutions:**
```javascript
// Clear widget settings
localStorage.removeItem('desktop-calendar-widget-settings');

// Force reload
location.reload();

// Check body styles
console.log('Body BG:', document.body.style.backgroundColor);
console.log('Body Class:', document.body.className);
```

#### Problem: Widget won't open

**Check:**
1. Console errors in main window
2. Electron main process logs
3. Port 3000 is running

**Solutions:**
```bash
# Restart dev server
npm start

# Check Electron logs
# Look for: "Loading widget URL: http://localhost:3000/#/widget"
```

---

## Next Steps After Testing

1. **If authentication works**: ✅ Proceed to production build testing
2. **If transparency works**: ✅ Update default settings documentation
3. **If both work**: 🎉 Ready for Electron packaging

### Production Build Test

```bash
# Build React app
npm run build

# Start Electron with production build
npm run electron

# Test widget in production mode
```

---

**Test Date**: October 21, 2025  
**Tester**: _____________  
**Result**: ☐ Pass  ☐ Fail  ☐ Partial  
**Notes**: _______________________________________________
