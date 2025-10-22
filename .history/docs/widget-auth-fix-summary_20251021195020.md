# Widget Authentication & Transparency Fix Summary

## 🎯 Overview
Fixed two critical issues with the desktop calendar widget:
1. **Authentication sharing** between main window and widget window
2. **Transparent background** to remove the white overlay

## 🔐 Authentication Token Sharing

### Problem
The widget window was showing "未认证，无法获取日历列表" because:
- Each BrowserWindow has its own `localStorage` instance
- Tokens stored in the main window were not accessible from the widget window
- Widget tried to load calendars without valid authentication

### Solution: Main Process Token Store

#### 1. Main Process Storage (`electron/main.js`)
Added a simple in-memory token store in the Electron main process:

```javascript
// Token store shared across all renderer windows
let authTokens = null; // { accessToken, refreshToken, expiresAt }

// IPC handlers for token management
ipcMain.handle('set-auth-tokens', (event, tokens) => {
  authTokens = tokens || null;
  console.log('🔐 主进程已保存认证令牌');
  return { success: true };
});

ipcMain.handle('get-auth-tokens', () => {
  return authTokens;
});
```

#### 2. Preload Bridge (`electron/preload.js`)
Exposed token management APIs to renderer:

```javascript
electronAPI: {
  setAuthTokens: (tokens) => ipcRenderer.invoke('set-auth-tokens', tokens),
  getAuthTokens: () => ipcRenderer.invoke('get-auth-tokens'),
  // ... other APIs
}
```

#### 3. Type Definitions (`src/types/electron.d.ts`)
Added TypeScript types:

```typescript
interface ElectronAPI {
  setAuthTokens?: (tokens: { 
    accessToken: string; 
    refreshToken?: string; 
    expiresAt?: number 
  } | null) => Promise<{ success: boolean }>;
  
  getAuthTokens?: () => Promise<{ 
    accessToken: string; 
    refreshToken?: string; 
    expiresAt?: number 
  } | null>;
  // ... other APIs
}
```

#### 4. Service Updates (`src/services/SimplifiedMicrosoftCalendarService.ts`)

##### On Authentication (Device Code / Browser)
After successful login, tokens are saved to both localStorage AND main process:

```typescript
// Save to localStorage (for web/local access)
localStorage.setItem('ms-access-token', result.accessToken);
// ...

// Save to main process (for cross-window sharing)
if ((window as any).electronAPI?.setAuthTokens) {
  await (window as any).electronAPI.setAuthTokens({
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    expiresAt: Date.now() + result.expiresIn * 1000
  });
}
```

##### On Token Load
Service now tries main process first, then falls back to localStorage:

```typescript
private loadStoredToken(): void {
  // 1. Try main process (works in widget)
  if (window.electronAPI?.getAuthTokens) {
    const tokens = await window.electronAPI.getAuthTokens();
    if (tokens?.accessToken && tokens.expiresAt > Date.now() - 60000) {
      this.accessToken = tokens.accessToken;
      this.isAuthenticated = true;
      console.log('✅ 从主进程加载了有效的访问令牌');
      return;
    }
  }
  
  // 2. Fallback to localStorage
  const token = localStorage.getItem('ms-access-token');
  // ...
}
```

##### On Graph API Call
Service fetches tokens from main process if not available locally:

```typescript
private async callGraphAPI(endpoint: string, method: string = 'GET', body?: any) {
  if (!this.accessToken) {
    // Try to get from main process before failing
    if (window.electronAPI?.getAuthTokens) {
      const tokens = await window.electronAPI.getAuthTokens();
      if (tokens?.accessToken) {
        this.accessToken = tokens.accessToken;
        this.isAuthenticated = true;
      }
    }
    
    if (!this.accessToken) {
      throw new Error('未认证，请先登录');
    }
  }
  // ... continue with API call
}
```

### Flow Diagram

```
┌─────────────────────┐                    ┌─────────────────────┐
│   Main Window       │                    │  Widget Window      │
│  (User Logs In)     │                    │  (Needs Tokens)     │
└──────────┬──────────┘                    └──────────┬──────────┘
           │                                           │
           │ 1. Login Success                          │
           │    (accessToken, refreshToken)            │
           │                                           │
           ├─────────────────────────────────────────► │
           │ 2. setAuthTokens(tokens)                 │
           │                                           │
           ▼                                           │
    ┌─────────────────┐                               │
    │  Main Process   │                               │
    │  Token Store    │◄──────────────────────────────┤
    │  (In Memory)    │ 3. getAuthTokens()            │
    └─────────────────┘                               │
           │                                           │
           └─────────────────────────────────────────► │
              4. Returns tokens                        │
                                                       ▼
                                              ┌─────────────────────┐
                                              │ Widget renders with │
                                              │ valid authentication│
                                              └─────────────────────┘
```

## 🎨 Transparent Background Fix

### Problem
Widget appeared inside a white constrained window:
- BrowserWindow had default white background
- React components had default white backgrounds
- CSS didn't set transparent backgrounds

### Solution: Full Transparency Chain

#### 1. Electron Window (`electron/main.js`)
```javascript
function createWidgetWindow() {
  widgetWindow = new BrowserWindow({
    transparent: true,
    backgroundColor: '#00000000', // Fully transparent
    frame: false,
    webPreferences: {
      partition: 'persist:main' // Share localStorage with main window
    }
  });
}
```

#### 2. Page-Level Transparency (`src/pages/WidgetPage.tsx`)
```typescript
useEffect(() => {
  document.body.classList.add('widget-mode');
  document.body.style.backgroundColor = 'transparent';
  document.body.style.overflow = 'hidden';
  
  return () => {
    // Cleanup on unmount
  };
}, []);
```

#### 3. CSS Transparency (`src/components/DesktopCalendarWidget.css`)
```css
.desktop-calendar-widget {
  background: transparent !important;
}

body.widget-mode {
  background: transparent !important;
  overflow: hidden;
}
```

#### 4. Component Default (`src/components/DesktopCalendarWidgetV3.tsx`)
Changed default background opacity to fully transparent:

```typescript
const [bgOpacity, setBgOpacity] = useState(0.0); // Was 0.8

// Convert to rgba with proper alpha
const bgColorRgba = (() => {
  const hex = bgColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`; // Now properly transparent
})();
```

### Result
- Widget now has **no white background** by default
- Calendar content is **freely resizable** (no white container constraint)
- Users can adjust opacity via the settings panel if desired
- Supports backdrop blur when background is semi-transparent

## 📝 Files Changed

### Core Changes
1. `electron/main.js` - Added token store and updated widget window config
2. `electron/preload.js` - Exposed token APIs
3. `src/types/electron.d.ts` - Added token API types
4. `src/services/SimplifiedMicrosoftCalendarService.ts` - Multi-level token loading
5. `src/components/DesktopCalendarWidgetV3.tsx` - Transparent background defaults
6. `src/components/DesktopCalendarWidget.css` - Transparent styles
7. `src/pages/WidgetPage.tsx` - Body transparency for widget mode

## 🚀 How to Test

### 1. Test Authentication Sharing
```bash
# Start dev server
npm start

# In main window:
1. Navigate to "Microsoft 认证" page
2. Click "设备代码登录" or "浏览器登录"
3. Complete authentication
4. Verify tokens are saved (check console: "🔐 主进程已保存认证令牌")

# Open widget:
5. Go to TimeCalendar page
6. Click "📍 悬浮窗" button
7. Widget should open without "未认证" error
8. Calendar events should load automatically

# Expected console output in widget:
"✅ 从主进程加载了有效的访问令牌"
"✅ Microsoft Graph 连接测试成功"
```

### 2. Test Transparent Background
```bash
# With widget open:
1. Hover over widget to show controls
2. Click "⚙️ 设置"
3. Check "背景透明度" slider is at 0% by default
4. No white background should be visible
5. Only calendar content with control bar should appear
6. Drag widget around - no white overlay should follow

# Adjust transparency:
7. Move "背景透明度" slider to add semi-transparent background
8. Change "背景颜色" to see different tints
9. Adjust "整体透明度" to make entire widget translucent
```

## 📋 Remaining Tasks

### High Priority
- [ ] Test token refresh when access token expires
- [ ] Verify widget works in production build (not just dev)
- [ ] Test multiple widget instances (if supported)

### Medium Priority
- [ ] Add secure token encryption for main process storage
- [ ] Implement token expiration UI feedback
- [ ] Add "re-authenticate" button in widget if tokens invalid

### Low Priority (Azure App Registration)
- [ ] Change Azure App Registration display name from "Meaningful Time Manager" to "ReMarkable"
  - Login to Azure Portal
  - Navigate to App registrations
  - Find app with clientId: `cf163673-488e-44d9-83ac-0f11d90016ca`
  - Update "Name" field to "ReMarkable"
- [ ] Or create new App Registration with correct branding

## 🔒 Security Notes

1. **Token Storage**: Currently in-memory in main process (cleared on app restart)
2. **Token Encryption**: Not implemented yet - consider encrypting before storage
3. **Token Scope**: Shared across all renderer windows in same app instance
4. **Refresh Token**: Stored alongside access token for automatic renewal

## ✅ Success Criteria

- [x] Widget loads without "未认证" error
- [x] Widget inherits main window authentication
- [x] No white background/overlay on widget
- [x] Calendar is freely resizable
- [x] Background transparency adjustable via settings
- [ ] Works in production build (needs testing)

---

**Last Updated**: October 21, 2025  
**Author**: GitHub Copilot + Zoey Gong  
**Version**: 1.0.0
