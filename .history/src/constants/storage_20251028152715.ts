// ReMarkable 应用的 localStorage 键名常量
export const STORAGE_KEYS = {
  // 应用设置
  SETTINGS: 'remarkable-settings',
  
  // 事件相关
  EVENTS: 'remarkable-events',
  EVENT_TAGS: 'remarkable-event-tags',
  HIERARCHICAL_TAGS: 'remarkable-hierarchical-tags',
  
  // 计时相关
  TIMER_SESSIONS: 'remarkable-timer-sessions',
  
  // 任务相关
  TASKS: 'remarkable-tasks',
  
  // 计划项相关
  PLAN_ITEMS: 'remarkable-plan-items',
  
  // 日历缓存相关
  CALENDAR_GROUPS_CACHE: 'remarkable-calendar-groups-cache',
  CALENDARS_CACHE: 'remarkable-calendars-cache',
  CALENDAR_SYNC_META: 'remarkable-calendar-sync-meta',
  
  // 标签相关（TagManager）
  TAGS: 'remarkable_tags',
  CHECKIN_COUNTS: 'remarkable_checkin_counts',
  
  // 同步相关
  SYNC_ACTIONS: 'remarkable-sync-actions',
  SYNC_CONFLICTS: 'remarkable-sync-conflicts',
  SYNC_CONFIG: 'remarkable-sync-config',
  SYNC_CACHE: 'remarkable-sync-cache',
} as const;

// 版本控制，用于检测缓存更新
export const STORAGE_VERSION = {
  CURRENT: '1.0.0',
  KEY: 'remarkable-storage-version'
} as const;

// 缓存管理工具
export class CacheManager {
  static checkAndClearOldCache(): void {
    const currentVersion = localStorage.getItem(STORAGE_VERSION.KEY);
    
    // 🔧 只在版本真正不同时才清理，避免每次启动都清理
    if (currentVersion === null) {
      // 第一次运行，设置版本号但不清理
      console.log('🔧 [CacheManager] First run, setting version without clearing');
      localStorage.setItem(STORAGE_VERSION.KEY, STORAGE_VERSION.CURRENT);
      return;
    }
    
    if (currentVersion !== STORAGE_VERSION.CURRENT) {
      console.log('🔄 [CacheManager] Detected version change from', currentVersion, 'to', STORAGE_VERSION.CURRENT);
      
      // 只清理旧的 meaningful- 前缀的缓存，不清理 remarkable- 缓存
      const oldKeys = [
        'meaningful-settings',
        'meaningful-events', 
        'meaningful-event-tags',
        'meaningful-timer-sessions',
        'meaningful-tasks',
        'meaningful-sync-actions',
        'meaningful-sync-conflicts',
        'meaningful-sync-config',
        'meaningful-sync-cache'
      ];
      
      oldKeys.forEach(key => {
        if (localStorage.getItem(key)) {
          console.log(`🗑️ [CacheManager] Removing old cache: ${key}`);
          localStorage.removeItem(key);
        }
      });
      
      // 设置新版本号
      localStorage.setItem(STORAGE_VERSION.KEY, STORAGE_VERSION.CURRENT);
      console.log('✅ [CacheManager] Cache cleanup completed');
    } else {
      console.log('✅ [CacheManager] Version check passed, no cleanup needed');
    }
  }
  
  static clearAllCache(): void {
    console.log('🧹 [CacheManager] Clearing all ReMarkable cache');
    
    Object.values(STORAGE_KEYS).forEach(key => {
      localStorage.removeItem(key);
    });
    
    // 不清除开发环境的持久化存储
    // 保护开发环境的持久化存储键 remarkable-dev-persistent-*
    console.log('🛡️ [CacheManager] Preserving development persistent storage');
    
    localStorage.removeItem(STORAGE_VERSION.KEY);
    console.log('✅ [CacheManager] All cache cleared (except dev persistent storage)');
  }
  
  static getCacheInfo(): Record<string, any> {
    const info: Record<string, any> = {};
    
    Object.entries(STORAGE_KEYS).forEach(([name, key]) => {
      const data = localStorage.getItem(key);
      info[name] = data ? JSON.parse(data) : null;
    });
    
    return info;
  }
}