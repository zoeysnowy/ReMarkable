const { contextBridge, ipcRenderer } = require('electron');

// 安全地暴露API给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 应用信息
  getVersion: () => ipcRenderer.invoke('app-version'),
  getPlatform: () => ipcRenderer.invoke('app-platform'),
  getAppInfo: () => ipcRenderer.invoke('get-app-info'),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
  
  // 系统对话框
  showMessageBox: (options) => ipcRenderer.invoke('show-message-box', options),
  showNotification: (title, body, options) => ipcRenderer.invoke('show-notification', title, body, options),
  
  // 文件操作
  openFile: () => ipcRenderer.invoke('dialog:openFile'),
  saveFile: (content, defaultName) => ipcRenderer.invoke('dialog:saveFile', content, defaultName),
  
  // 系统监听功能
  startSystemMonitoring: () => ipcRenderer.invoke('start-system-monitoring'),
  getActiveWindow: () => ipcRenderer.invoke('get-active-window'),
  
  // 调试功能
  debugLog: (message, data) => {
    console.log('🔧 [Electron Debug]', message, data);
    ipcRenderer.invoke('debug-log', message, data);
  },
  
  // 🔍 性能监控
  performance: {
    getReport: () => ipcRenderer.invoke('get-performance-report'),
    printReport: () => ipcRenderer.invoke('print-performance-report'),
    resetStats: () => ipcRenderer.invoke('reset-performance-stats')
  },
  
  // 桌面小组件控制
  toggleWidget: () => ipcRenderer.invoke('toggle-widget'),
  createWidget: () => ipcRenderer.invoke('create-widget'),
  widgetClose: () => ipcRenderer.invoke('widget-close'),
  closeWindow: () => ipcRenderer.invoke('close-window'),
  widgetMinimize: () => ipcRenderer.invoke('widget-minimize'),
  widgetLock: (isLocked) => ipcRenderer.invoke('widget-lock', isLocked),
  widgetOpacity: (opacity) => ipcRenderer.invoke('widget-opacity', opacity),
  widgetMove: (position) => ipcRenderer.invoke('widget-move', position),
  widgetDragEnd: () => ipcRenderer.invoke('widget-drag-end'),
  widgetResize: (size) => ipcRenderer.invoke('widget-resize', size),
  widgetFullscreen: (isFullscreen) => ipcRenderer.invoke('widget-fullscreen', isFullscreen),
  widgetForceResizable: () => ipcRenderer.invoke('widget-force-resizable'),
  
  // 新版小组件API
  widget: {
    toggle: (type, enabled) => ipcRenderer.invoke('widget-toggle', type, enabled),
    updateConfig: (type, config) => ipcRenderer.invoke('widget-update-config', type, config),
    setOpacity: (type, opacity) => ipcRenderer.invoke('widget-set-opacity', type, opacity),
    setAlwaysOnTop: (type, alwaysOnTop) => ipcRenderer.invoke('widget-set-always-on-top', type, alwaysOnTop),
    close: (type) => ipcRenderer.invoke('widget-close-typed', type),
    getConfig: (type) => ipcRenderer.invoke('widget-get-config', type),
    savePosition: (type, x, y) => ipcRenderer.invoke('widget-save-position', type, x, y),
    saveSize: (type, width, height) => ipcRenderer.invoke('widget-save-size', type, width, height)
  },
  
  // 事件监听
  on: (channel, callback) => {
    ipcRenderer.on(channel, callback);
  },
  send: (channel, data) => {
    ipcRenderer.send(channel, data);
  },
  
  // 事件监听
  onTriggerSync: (callback) => {
    ipcRenderer.on('trigger-sync', callback);
  },
  onOpenSyncSettings: (callback) => {
    ipcRenderer.on('open-sync-settings', callback);
  },
  
  // 移除事件监听
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  },
  
  // 检查是否在Electron环境
  isElectron: true,
  
  // 环境信息
  isDev: process.env.NODE_ENV === 'development',
  
  // Microsoft认证辅助
  openExternalAuth: (url) => ipcRenderer.invoke('open-external-auth', url),
  microsoftLoginWindow: (authUrl) => ipcRenderer.invoke('microsoft-login-window', authUrl),
  handleAuthCallback: (url) => ipcRenderer.invoke('handle-auth-callback', url),
  startAuthServer: (redirectUri) => ipcRenderer.invoke('start-auth-server', redirectUri),
  // 令牌共享API
  setAuthTokens: (tokens) => ipcRenderer.invoke('set-auth-tokens', tokens),
  getAuthTokens: () => ipcRenderer.invoke('get-auth-tokens'),
  
  // 开机自启动设置
  setLoginItemSettings: (settings) => ipcRenderer.invoke('set-login-item-settings', settings),
  getLoginItemSettings: () => ipcRenderer.invoke('get-login-item-settings')
});

// 监听主进程消息
window.addEventListener('DOMContentLoaded', () => {
  console.log('🔧 Electron preload script loaded');
  console.log('📱 Platform:', process.platform);
  console.log('🏗️ Architecture:', process.arch);
});

// 为渲染进程提供一些有用的常量
contextBridge.exposeInMainWorld('electronConstants', {
  PLATFORM: process.platform,
  ARCH: process.arch,
  IS_WINDOWS: process.platform === 'win32',
  IS_MACOS: process.platform === 'darwin',
  IS_LINUX: process.platform === 'linux'
});