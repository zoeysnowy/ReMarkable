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

  // 事件监听
  onTriggerSync: (callback: () => void) => void;
  onOpenSyncSettings: (callback: () => void) => void;
  removeAllListeners: (channel: string) => void;

  // 环境检查
  isElectron: boolean;
  isDev: boolean;
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