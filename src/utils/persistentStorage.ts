/**
 * 持久化存储工具
 * 在开发环境中提供更稳定的数据存储，避免频繁清空localStorage导致数据丢失
 */

const DEVELOPMENT_STORAGE_PREFIX = 'remarkable-dev-persistent-';
const PRODUCTION_STORAGE_PREFIX = 'remarkable-';

// 判断是否为开发环境
const isDevelopment = process.env.NODE_ENV === 'development' || 
                     window.location.hostname === 'localhost' ||
                     window.location.hostname === '127.0.0.1';

export interface PersistentStorageOptions {
  // 是否在开发环境中持久化（不受localStorage清空影响）
  persistInDev?: boolean;
  // 是否启用文件存储备份（未来可扩展到IndexedDB或文件系统）
  fileBackup?: boolean;
  // 存储版本，用于数据迁移
  version?: string;
}

export class PersistentStorage {
  private static getKey(originalKey: string, options: PersistentStorageOptions = {}): string {
    const { persistInDev = false } = options;
    
    if (isDevelopment && persistInDev) {
      return DEVELOPMENT_STORAGE_PREFIX + originalKey;
    }
    
    return originalKey;
  }

  /**
   * 存储数据
   */
  static setItem(key: string, value: any, options: PersistentStorageOptions = {}): void {
    const storageKey = this.getKey(key, options);
    const dataToStore = {
      value,
      timestamp: new Date().toISOString(),
      version: options.version || '1.0.0',
      isDev: isDevelopment && options.persistInDev
    };

    try {
      localStorage.setItem(storageKey, JSON.stringify(dataToStore));
      
      // 在开发环境中额外创建一个备份
      if (isDevelopment && options.persistInDev) {
        const backupKey = `${storageKey}-backup`;
        localStorage.setItem(backupKey, JSON.stringify(dataToStore));
      }
    } catch (error) {
      console.error('❌ [PersistentStorage] Failed to store data:', error);
    }
  }

  /**
   * 获取数据
   */
  static getItem(key: string, options: PersistentStorageOptions = {}): any {
    const storageKey = this.getKey(key, options);
    
    try {
      const stored = localStorage.getItem(storageKey);
      if (!stored) {
        // 尝试从备份恢复
        if (isDevelopment && options.persistInDev) {
          const backupKey = `${storageKey}-backup`;
          const backup = localStorage.getItem(backupKey);
          if (backup) {
            console.log('🔄 [PersistentStorage] Restoring from backup:', key);
            const parsedBackup = JSON.parse(backup);
            // 恢复主存储
            localStorage.setItem(storageKey, backup);
            return parsedBackup.value;
          }
        }
        return null;
      }

      const parsed = JSON.parse(stored);
      return parsed.value;
    } catch (error) {
      console.error('❌ [PersistentStorage] Failed to retrieve data:', error);
      return null;
    }
  }

  /**
   * 删除数据
   */
  static removeItem(key: string, options: PersistentStorageOptions = {}): void {
    const storageKey = this.getKey(key, options);
    localStorage.removeItem(storageKey);
    
    // 同时删除备份
    if (isDevelopment && options.persistInDev) {
      const backupKey = `${storageKey}-backup`;
      localStorage.removeItem(backupKey);
    }
  }

  /**
   * 检查数据是否存在
   */
  static hasItem(key: string, options: PersistentStorageOptions = {}): boolean {
    const storageKey = this.getKey(key, options);
    return localStorage.getItem(storageKey) !== null;
  }

  /**
   * 获取所有持久化存储的键
   */
  static getAllKeys(options: PersistentStorageOptions = {}): string[] {
    const { persistInDev = false } = options;
    const prefix = isDevelopment && persistInDev ? DEVELOPMENT_STORAGE_PREFIX : PRODUCTION_STORAGE_PREFIX;
    
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        keys.push(key.replace(prefix, ''));
      }
    }
    
    return keys;
  }

  /**
   * 清空所有持久化数据
   */
  static clear(options: PersistentStorageOptions = {}): void {
    const keys = this.getAllKeys(options);
    keys.forEach(key => this.removeItem(key, options));
  }

  /**
   * 获取存储信息统计
   */
  static getStorageInfo(options: PersistentStorageOptions = {}): {
    keys: string[];
    totalSize: number;
    environment: 'development' | 'production';
    persistentMode: boolean;
  } {
    const keys = this.getAllKeys(options);
    let totalSize = 0;
    
    keys.forEach(key => {
      const data = this.getItem(key, options);
      if (data) {
        totalSize += JSON.stringify(data).length;
      }
    });

    return {
      keys,
      totalSize,
      environment: isDevelopment ? 'development' : 'production',
      persistentMode: isDevelopment && (options.persistInDev || false)
    };
  }
}

// 默认选项用于标签等重要数据
export const PERSISTENT_OPTIONS = {
  TAGS: {
    persistInDev: true,
    version: '1.0.0'
  },
  EVENTS: {
    persistInDev: true,
    version: '1.0.0'  
  },
  SETTINGS: {
    persistInDev: true,
    version: '1.0.0'
  }
} as const;