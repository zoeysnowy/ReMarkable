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
  handleAuthCallback: (url) => ipcRenderer.invoke('handle-auth-callback', url)
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