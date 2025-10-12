/**
 * Electron服务类 - 处理桌面应用特有功能
 */
export class ElectronService {
  private isElectronEnv: boolean = false;
  private systemMonitoringActive: boolean = false;
  private monitoringCallbacks: Array<(data: any) => void> = [];

  constructor() {
    this.isElectronEnv = this.checkElectronEnvironment();
    this.initializeElectronListeners();
  }

  /**
   * 检查是否在Electron环境中运行
   */
  private checkElectronEnvironment(): boolean {
    return !!(window.electronAPI && window.electronAPI.isElectron);
  }

  /**
   * 初始化Electron事件监听器
   */
  private initializeElectronListeners(): void {
    if (!this.isElectronEnv) return;

    // 监听主进程触发的同步事件
    window.electronAPI.onTriggerSync(() => {
      console.log('🔄 Electron triggered sync');
      this.triggerSyncEvent();
    });

    // 监听打开同步设置事件
    window.electronAPI.onOpenSyncSettings(() => {
      console.log('⚙️ Electron triggered sync settings');
      this.triggerSyncSettingsEvent();
    });
  }

  /**
   * 触发同步事件
   */
  private triggerSyncEvent(): void {
    window.dispatchEvent(new CustomEvent('electron-trigger-sync', {
      detail: { timestamp: new Date() }
    }));
  }

  /**
   * 触发同步设置事件
   */
  private triggerSyncSettingsEvent(): void {
    window.dispatchEvent(new CustomEvent('electron-open-sync-settings', {
      detail: { timestamp: new Date() }
    }));
  }

  /**
   * 获取应用信息
   */
  async getAppInfo() {
    if (!this.isElectronEnv) {
      return {
        isElectron: false,
        platform: 'web',
        version: '1.0.0 (Web)'
      };
    }

    try {
      const [appInfo, platform] = await Promise.all([
        window.electronAPI.getAppInfo(),
        window.electronAPI.getPlatform()
      ]);

      return {
        isElectron: true,
        ...appInfo,
        platform: platform.platform,
        arch: platform.arch,
        nodeVersion: platform.version.node,
        electronVersion: platform.version.electron
      };
    } catch (error) {
      console.error('Failed to get app info:', error);
      return { isElectron: true, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * 显示系统通知
   */
  async showNotification(title: string, body: string, options?: { icon?: string }): Promise<boolean> {
    if (!this.isElectronEnv) {
      // Web环境使用浏览器通知API
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, { body, ...options });
          return true;
        }
      }
      return false;
    }

    try {
      return await window.electronAPI.showNotification(title, body, options);
    } catch (error) {
      console.error('Failed to show notification:', error);
      return false;
    }
  }

  /**
   * 显示消息对话框
   */
  async showMessageBox(options: {
    type?: 'info' | 'warning' | 'error' | 'question';
    title?: string;
    message: string;
    detail?: string;
    buttons?: string[];
  }) {
    if (!this.isElectronEnv) {
      // Web环境使用alert/confirm
      if (options.type === 'question' && options.buttons) {
        return { response: window.confirm(options.message) ? 0 : 1 };
      } else {
        window.alert(options.message);
        return { response: 0 };
      }
    }

    try {
      return await window.electronAPI.showMessageBox(options);
    } catch (error) {
      console.error('Failed to show message box:', error);
      return { response: -1, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  /**
   * 开始系统监听
   */
  async startSystemMonitoring(): Promise<boolean> {
    if (!this.isElectronEnv) {
      console.warn('System monitoring is only available in Electron environment');
      return false;
    }

    if (this.systemMonitoringActive) {
      console.log('System monitoring is already active');
      return true;
    }

    try {
      const result = await window.electronAPI.startSystemMonitoring();
      
      if (result.success) {
        this.systemMonitoringActive = true;
        this.startPolling();
        console.log('✅ System monitoring started successfully');
        return true;
      } else {
        console.error('Failed to start system monitoring:', result.message);
        return false;
      }
    } catch (error) {
      console.error('System monitoring error:', error);
      return false;
    }
  }

  /**
   * 停止系统监听
   */
  stopSystemMonitoring(): void {
    this.systemMonitoringActive = false;
    console.log('🛑 System monitoring stopped');
  }

  /**
   * 添加系统活动监听回调
   */
  onSystemActivity(callback: (data: any) => void): void {
    this.monitoringCallbacks.push(callback);
  }

  /**
   * 开始轮询系统活动
   */
  private startPolling(): void {
    if (!this.isElectronEnv || !this.systemMonitoringActive) return;

    const poll = async () => {
      if (!this.systemMonitoringActive) return;

      try {
        const windowInfo = await window.electronAPI.getActiveWindow();
        
        if (windowInfo) {
          const activityData = {
            type: 'window-activity',
            data: windowInfo,
            timestamp: new Date()
          };

          // 触发所有回调
          this.monitoringCallbacks.forEach(callback => {
            try {
              callback(activityData);
            } catch (error) {
              console.error('Monitoring callback error:', error);
            }
          });
        }
      } catch (error) {
        console.error('System monitoring poll error:', error);
      }

      // 继续轮询
      if (this.systemMonitoringActive) {
        setTimeout(poll, 5000); // 每5秒检查一次
      }
    };

    // 开始第一次轮询
    setTimeout(poll, 1000);
  }

  /**
   * 导出数据到文件
   */
  async exportData(data: any, filename?: string): Promise<boolean> {
    if (!this.isElectronEnv) {
      // Web环境使用下载
      this.downloadAsFile(JSON.stringify(data, null, 2), filename || 'export.json');
      return true;
    }

    try {
      const result = await window.electronAPI.saveFile(
        JSON.stringify(data, null, 2),
        filename || 'remarkable-export.json'
      );

      if (result.success) {
        await this.showNotification('导出成功', `数据已保存到 ${result.path}`);
        return true;
      } else if (!result.canceled) {
        await this.showMessageBox({
          type: 'error',
          title: '导出失败',
          message: result.error || '未知错误'
        });
      }
      return false;
    } catch (error) {
      console.error('Export error:', error);
      return false;
    }
  }

  /**
   * Web环境下载文件
   */
  private downloadAsFile(content: string, filename: string): void {
    const blob = new Blob([content], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * 导入数据文件
   */
  async importData(): Promise<any | null> {
    if (!this.isElectronEnv) {
      // Web环境使用文件选择器
      return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const data = JSON.parse(e.target?.result as string);
                resolve(data);
              } catch (error) {
                console.error('Import parsing error:', error);
                resolve(null);
              }
            };
            reader.readAsText(file);
          } else {
            resolve(null);
          }
        };
        input.click();
      });
    }

    try {
      const filePath = await window.electronAPI.openFile();
      if (!filePath) return null;

      // 在Electron环境中，需要通过主进程读取文件
      // 这里简化处理，实际应该通过IPC读取文件内容
      console.log('Selected file:', filePath);
      return null; // TODO: 实现文件读取
    } catch (error) {
      console.error('Import error:', error);
      return null;
    }
  }

  /**
   * 获取平台信息
   */
  getPlatformInfo() {
    if (!this.isElectronEnv) {
      return {
        isElectron: false,
        platform: 'web',
        isWindows: false,
        isMacOS: false,
        isLinux: false
      };
    }

    return {
      isElectron: true,
      platform: window.electronConstants.PLATFORM,
      arch: window.electronConstants.ARCH,
      isWindows: window.electronConstants.IS_WINDOWS,
      isMacOS: window.electronConstants.IS_MACOS,
      isLinux: window.electronConstants.IS_LINUX
    };
  }

  /**
   * 检查是否为Electron环境
   */
  get isElectron(): boolean {
    return this.isElectronEnv;
  }

  /**
   * 清理资源
   */
  cleanup(): void {
    this.stopSystemMonitoring();
    this.monitoringCallbacks = [];
    
    if (this.isElectronEnv) {
      window.electronAPI.removeAllListeners('trigger-sync');
      window.electronAPI.removeAllListeners('open-sync-settings');
    }
  }
}

// 导出单例
export const electronService = new ElectronService();