// Electron API 类型定义
export interface ElectronAPI {
  // 应用信息
  getVersion: () => Promise<string>;
  getPlatform: () => Promise<{
    platform: string;
    arch: string;
    version: any;
  }>;
  getAppInfo: () => Promise<{
    name: string;
    version: string;
    userDataPath: string;
    appPath: string;
  }>;
  getUserDataPath: () => Promise<string>;

  // 系统对话框
  showMessageBox: (options: {
    type?: 'info' | 'warning' | 'error' | 'question';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }) => Promise<{ response: number; checkboxChecked?: boolean }>;
  
  showNotification: (
    title: string, 
    body: string, 
    options?: { icon?: string; sound?: boolean }
  ) => Promise<boolean>;

  // 文件操作
  openFile: () => Promise<string | null>;
  saveFile: (content: string, defaultName?: string) => Promise<{
    success: boolean;
    path?: string;
    error?: string;
    canceled?: boolean;
  }>;

  // 系统监听功能
  startSystemMonitoring: () => Promise<{ success: boolean; message: string }>;
  getActiveWindow: () => Promise<{
    title: string;
    process: string;
    timestamp: string;
  } | null>;

  // 调试功能
  debugLog: (message: string, data?: any) => void;

  // 事件监听
  onTriggerSync: (callback: () => void) => void;
  onOpenSyncSettings: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // 环境检查
  isElectron: boolean;
  isDev: boolean;
  
  // Microsoft认证辅助
  openExternalAuth?: (url: string) => Promise<void>;
  handleAuthCallback?: (url: string) => Promise<any>;
  
  // 开机自启动设置
  setLoginItemSettings?: (settings: {
    openAtLogin: boolean;
    path?: string;
  }) => Promise<boolean>;
  getLoginItemSettings?: () => Promise<{
    openAtLogin: boolean;
    openAsHidden: boolean;
    wasOpenedAtLogin: boolean;
    wasOpenedAsHidden: boolean;
    restoreState: boolean;
  }>;
  
  // 桌面小组件控制 (新版)
  widget?: {
    toggle: (type: 'timer' | 'dailyStats', enabled: boolean) => void;
    updateConfig: (type: 'timer' | 'dailyStats', config: any) => void;
    setOpacity: (type: 'timer' | 'dailyStats', opacity: number) => void;
    setAlwaysOnTop: (type: 'timer' | 'dailyStats', alwaysOnTop: boolean) => void;
    close: (type: 'timer' | 'dailyStats') => void;
    getConfig: (type: 'timer' | 'dailyStats') => Promise<any>;
    savePosition: (type: 'timer' | 'dailyStats', x: number, y: number) => void;
    saveSize: (type: 'timer' | 'dailyStats', width: number, height: number) => void;
  };
  
  // 桌面悬浮窗口控制 (旧版，保留兼容性)
  createWidget: () => void;
  toggleWidget: () => void;
  widgetClose: () => void;
  widgetMinimize: () => void;
  widgetLock: (isLocked: boolean) => void;
  widgetOpacity: (opacity: number) => void;
  widgetMove: (position: { x: number; y: number }) => void;
  widgetResize: (size: { width: number; height: number }) => void;
  on: (channel: string, callback: (...args: any[]) => void) => void;
  send: (channel: string, data?: any) => void;
}

export interface ElectronConstants {
  PLATFORM: string;
  ARCH: string;
  IS_WINDOWS: boolean;
  IS_MACOS: boolean;
  IS_LINUX: boolean;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
    electronConstants: ElectronConstants;
  }
}

export {};