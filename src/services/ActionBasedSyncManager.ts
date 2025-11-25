import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import { logger } from '../utils/logger';

const syncLogger = logger.module('Sync');

const formatTimeForStorage = (date: Date | string): string => {
  // 🔧 修复：处理字符串输入
  let dateObj: Date;
  
  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else {
    dateObj = new Date();
  }
  
  // 验证日期有效性
  if (isNaN(dateObj.getTime())) {
    dateObj = new Date();
  }
  
  const year = dateObj.getFullYear();
  const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
  const day = dateObj.getDate().toString().padStart(2, '0');
  const hours = dateObj.getHours().toString().padStart(2, '0');
  const minutes = dateObj.getMinutes().toString().padStart(2, '0');
  const seconds = dateObj.getSeconds().toString().padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

interface SyncAction {
  id: string;
  type: 'create' | 'update' | 'delete';
  entityType: 'event' | 'task';
  entityId: string;
  timestamp: Date;
  source: 'local' | 'outlook';
  data?: any;
  oldData?: any;
  originalData?: any;
  synchronized: boolean;
  synchronizedAt?: Date;
  retryCount: number;
  lastError?: string; // 🔧 [NEW] 最后一次错误信息
  lastAttemptTime?: Date; // 🔧 [NEW] 最后一次尝试时间
  userNotified?: boolean; // 🔧 [NEW] 是否已通知用户
}

interface SyncConflict {
  localAction: SyncAction;
  remoteAction: SyncAction;
  resolutionStrategy: 'local-wins' | 'remote-wins' | 'merge' | 'manual';
}

export class ActionBasedSyncManager {
  private microsoftService: any;
  private isRunning = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private lastSyncTime = new Date();
  private actionQueue: SyncAction[] = [];
  private conflictQueue: SyncConflict[] = [];
  private syncInProgress = false;
  private isTimerTriggered = false; // 🎯 标记是否由定时器触发（用于优先级控制）
  private needsFullSync = false; // 标记是否需要全量同步
  private lastSyncSettings: any = null; // 上次同步时的设置
  private deletedEventIds: Set<string> = new Set(); // 🆕 跟踪已删除的事件ID
  private editLocks: Map<string, number> = new Map(); // 🆕 编辑锁定机制 - 存储事件ID和锁定过期时间
  private recentlyUpdatedEvents: Map<string, number> = new Map(); // 🔧 [NEW] 记录最近更新的事件，防止误删
  private eventIndexMap: Map<string, any> = new Map(); // 🚀 [NEW] Event ID hash map for O(1) lookups
  private indexIntegrityCheckInterval: NodeJS.Timeout | null = null; // 🔧 [NEW] 完整性检查定时器
  private lastIntegrityCheck = 0; // 🔧 [NEW] 上次完整性检查时间
  private incrementalUpdateCount = 0; // 🔧 [NEW] 增量更新计数器
  private fullCheckCompleted = false; // 🔧 [NEW] 是否完成过完整检查
  private isWindowFocused = true; // 🔧 [NEW] 窗口是否被激活
  private lastQueueModification = Date.now(); // 🔧 [FIX] 上次 action queue 修改时间
  private pendingSyncAfterOnline = false; // 🔧 [NEW] 网络恢复后待同步标记
  private viewChangeTimeout: NodeJS.Timeout | null = null; // 🚀 [NEW] 视图变化防抖定时器
  
  // 🔧 [NEW] 删除候选追踪机制 - 两轮确认才删除
  private deletionCandidates: Map<string, {
    externalId: string;
    title: string;
    firstMissingRound: number; // 第一次未找到的轮次
    firstMissingTime: number;  // 第一次未找到的时间
    lastCheckRound: number;     // 最后检查的轮次
    lastCheckTime: number;      // 最后检查的时间
  }> = new Map();
  private syncRoundCounter = 0; // 同步轮次计数器
  private lastSyncBatchCount = 0; // 🔧 [NEW] 上次同步的批次数量（用于动态计算删除确认时间）
  
  // � [NEW] IndexMap 重建状态追踪
  private indexMapRebuildPromise: Promise<void> | null = null;
  
  // �📊 [NEW] 同步统计信息
  private syncStats = {
    syncFailed: 0,        // 同步至日历失败
    calendarCreated: 0,   // 新增日历事项
    syncSuccess: 0        // 成功同步至日历
  };

  constructor(microsoftService: any) {
    this.microsoftService = microsoftService;
    this.loadActionQueue();
    this.loadConflictQueue();
    this.loadDeletedEventIds(); // 🆕 加载已删除事件ID
    
    // 🔧 [MIGRATION] 一次性清理重复的 outlook- 前缀
    this.migrateOutlookPrefixes();
    
    // 🔧 [NEW] 修复历史 pending 事件（补充到同步队列）
    this.fixOrphanedPendingEvents();
    
    // 🔧 [NEW] 设置网络状态监听
    this.setupNetworkListeners();
    
    // 🔧 [NEW] 监听窗口焦点状态（用于检测用户是否正在使用应用）
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.isWindowFocused = true;
      }, { passive: true });
      
      window.addEventListener('blur', () => {
        this.isWindowFocused = false;
      }, { passive: true });
      
      // 🚀 [NEW] 监听日历视图变化，触发优先同步
      window.addEventListener('calendarViewChanged', ((event: CustomEvent) => {
        const { visibleStart, visibleEnd } = event.detail;
        
        // 防抖处理：避免快速切换月份时频繁同步
        if (this.viewChangeTimeout) {
          clearTimeout(this.viewChangeTimeout);
        }
        
        this.viewChangeTimeout = setTimeout(() => {
          if (this.isRunning && !this.syncInProgress) {
            syncLogger.log('📅 [View Change] Triggering priority sync for new visible range');
            this.syncVisibleDateRangeFirst(
              new Date(visibleStart),
              new Date(visibleEnd)
            ).catch(error => {
              syncLogger.error('❌ [View Change] Priority sync failed:', error);
            });
          }
        }, 500); // 500ms 防抖
      }) as EventListener);
    }
    
    // 🔍 [DEBUG] 暴露调试函数到全局
    if (typeof window !== 'undefined') {
      (window as any).debugSyncManager = {
        getActionQueue: () => this.actionQueue,
        getConflictQueue: () => this.conflictQueue,
        isRunning: () => this.isRunning,
        isSyncInProgress: () => this.syncInProgress,
        getLastSyncTime: () => this.lastSyncTime,
        triggerSync: () => this.performSync(),
        checkTagMapping: (tagId: string) => this.getCalendarIdForTag(tagId),
        getHealthScore: () => this.getLastHealthScore(),
        getIncrementalUpdateCount: () => this.incrementalUpdateCount,
        resetFullCheck: () => { this.fullCheckCompleted = false; }
      };
    }
  }

  // 🔧 [NEW] 设置网络状态监听
  private setupNetworkListeners() {
    if (typeof window === 'undefined') return;
    // 监听网络恢复
    window.addEventListener('online', () => {
      // 🔧 [OPTIMIZED] 标记需要同步
      this.pendingSyncAfterOnline = true;
      
      // 🔧 [OPTIMIZED] 减少延迟到 500ms（从 1000ms）
      setTimeout(() => {
        if (!this.isRunning) {
          return;
        }
        
        if (this.syncInProgress) {
          // 🔧 [NEW] 如果正在同步，标记为待同步，等当前同步完成后立即执行
          // pendingSyncAfterOnline 保持 true，在 performSync 结束时会检查
        } else {
          this.triggerSyncAfterOnline();
        }
      }, 500); // 🔧 减少到 500ms
      
      // 🔧 [NEW] 显示恢复通知
      this.showNetworkNotification('online');
    });
    
    // 监听网络断开
    window.addEventListener('offline', () => {
      // 显示通知提醒用户
      this.showNetworkNotification('offline');
    });
    
    // 初始化时检查网络状态
    const isOnline = navigator.onLine;
    
    if (!isOnline) {
      this.showNetworkNotification('offline');
    }
  }

  // 🔧 [NEW] 网络恢复后触发同步的专用方法
  private async triggerSyncAfterOnline() {
    this.pendingSyncAfterOnline = false;
    
    try {
      // 网络恢复时只推送本地更改，不拉取远程（优化性能，避免429错误）
      await this.performSync({ skipRemoteFetch: true });
    } catch (error) {
      console.error('❌ [Network] Sync after network recovery failed:', error);
      // 🔧 失败后等待下一个定时器周期重试
    }
  }

  // 🔧 [NEW] 显示网络状态通知
  private showNetworkNotification(status: 'online' | 'offline') {
    if (typeof window === 'undefined') return;
    
    // 触发自定义事件，让UI层显示通知
    window.dispatchEvent(new CustomEvent('networkStatusChanged', {
      detail: {
        status,
        message: status === 'offline' 
          ? '⚠️ 网络已断开，本地操作将在联网后自动同步' 
          : '✅ 网络已恢复，正在同步数据...'
      }
    }));
  }

  // 🔧 [NEW] 显示同步失败通知
  private showSyncFailureNotification(action: SyncAction, error: string) {
    if (typeof window === 'undefined') return;
    
    const eventTitle = action.data?.title || action.entityId;
    const retryCount = action.retryCount || 0;
    
    // 触发自定义事件，让UI层显示通知
    window.dispatchEvent(new CustomEvent('syncFailure', {
      detail: {
        actionId: action.id,
        actionType: action.type,
        entityId: action.entityId,
        eventTitle,
        retryCount,
        error,
        timestamp: new Date()
      }
    }));
    
    console.warn(`🚨 [Sync Failure Notification] Event: "${eventTitle}", Retries: ${retryCount}, Error: ${error}`);
  }

  // 🔧 [NEW] 显示日历降级通知
  private showCalendarFallbackNotification(eventTitle: string, invalidCalendarId: string, fallbackCalendarId: string) {
    if (typeof window === 'undefined') return;
    
    // 触发自定义事件，让UI层显示通知
    window.dispatchEvent(new CustomEvent('calendarFallback', {
      detail: {
        eventTitle,
        invalidCalendarId,
        fallbackCalendarId,
        message: `目标日历不存在，事件 "${eventTitle}" 已保存到默认日历`,
        timestamp: new Date()
      }
    }));
    
    console.warn(`📅 [Calendar Fallback] Event: "${eventTitle}", Invalid: ${invalidCalendarId}, Fallback: ${fallbackCalendarId}`);
  }

  private lastHealthScore = 100; // 🔧 [NEW] 缓存最近的健康评分

  private getLastHealthScore(): number {
    return this.lastHealthScore;
  }

  // 🔍 [NEW] 获取标签的日历映射
  private getCalendarIdForTag(tagId: string): string | null {
    // Getting calendar ID for tag
    
    if (!tagId) {
      // No tagId provided
      return null;
    }
    
    try {
      // 🔧 修复：使用TagService获取标签，而不是直接读取localStorage
      if (typeof window !== 'undefined' && (window as any).ReMarkableCache?.tags?.service) {
        const flatTags = (window as any).ReMarkableCache.tags.service.getFlatTags();
        
        const foundTag = flatTags.find((tag: any) => tag.id === tagId);
        if (foundTag && foundTag.calendarMapping) {
          return foundTag.calendarMapping.calendarId;
        } else {
          return null;
        }
      } else {
        // TagService not available, falling back to localStorage
        
        // 备用方案：直接读取localStorage（使用PersistentStorage的方式）
        const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
        if (!savedTags) {
          return null;
        }
        
        // 递归搜索标签和它的日历映射
        const findTagMapping = (tags: any[], targetTagId: string): string | null => {
          for (const tag of tags) {
            if (tag.id === targetTagId) {
              const calendarId = tag.calendarMapping?.calendarId;
              return calendarId || null;
            }
            
            // 检查子标签
            if (tag.children && tag.children.length > 0) {
              const childResult = findTagMapping(tag.children, targetTagId);
              if (childResult) {
                return childResult;
              }
            }
          }
          return null;
        };
        
        const result = findTagMapping(savedTags, tagId);
        return result;
      }
      
    } catch (error) {
      console.error('❌ [TAG-CALENDAR] Error getting calendar mapping:', error);
      return null;
    }
  }

  // 🔧 [NEW] 获取所有有标签映射的日历的事件
  private async getMappedCalendarEvents(startDate?: Date, endDate?: Date): Promise<any[]> {
    try {
      // 获取所有标签的日历映射
      const mappedCalendars = new Set<string>();
      
      if (typeof window !== 'undefined' && (window as any).TagService) {
        const flatTags = (window as any).TagService.getFlatTags();
        
        flatTags.forEach((tag: any) => {
          if (tag.calendarMapping?.calendarId) {
            mappedCalendars.add(tag.calendarMapping.calendarId);
          }
        });
      } else {
        // 备用方案：从持久化存储读取
        const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
        if (savedTags) {
          const collectMappings = (tags: any[]) => {
            tags.forEach(tag => {
              if (tag.calendarMapping?.calendarId) {
                mappedCalendars.add(tag.calendarMapping.calendarId);
              }
              if (tag.children) {
                collectMappings(tag.children);
              }
            });
          };
          collectMappings(savedTags);
        }
      }
      
      // Found mapped calendars
      
      if (mappedCalendars.size === 0) {
        return [];
      }
      
      // 获取每个映射日历的事件
      const allEvents: any[] = [];
      
      for (const calendarId of Array.from(mappedCalendars)) {
        try {
          // Fetching events from calendar with time range
          const events = await this.microsoftService.getEventsFromCalendar(calendarId, startDate, endDate);
          
          // 为这些事件设置正确的 calendarId 和标签信息
          const enhancedEvents = events.map((event: any) => ({
            ...event,
            calendarId: calendarId,
            // 尝试找到对应的标签
            tagId: this.findTagIdForCalendar(calendarId)
          }));
          
          allEvents.push(...enhancedEvents);
          // Got events from calendar
        } catch (error) {
          console.warn('⚠️ [getMappedCalendarEvents] Failed to fetch events from calendar', calendarId, ':', error);
        }
      }
      
      // Total events from mapped calendars
      return allEvents;
      
    } catch (error) {
      console.error('❌ [getMappedCalendarEvents] Error getting mapped calendar events:', error);
      return [];
    }
  }

  // � [NEW] 优先同步可见日期范围的事件（立即），然后异步同步剩余事件
  public async syncVisibleDateRangeFirst(visibleStart: Date, visibleEnd: Date) {
    try {
      syncLogger.log('📅 [Priority Sync] Starting sync for visible date range:', {
        start: formatTimeForStorage(visibleStart),
        end: formatTimeForStorage(visibleEnd)
      });

      // 0. 先推送本地未同步的更改（Local to Remote）
      const hasPendingLocalActions = this.actionQueue.some(
        action => action.source === 'local' && !action.synchronized
      );
      
      if (hasPendingLocalActions) {
        syncLogger.log('📤 [Priority Sync] Pushing local changes first...');
        await this.syncPendingLocalActions();
      }

      // 1. 立即同步可见范围的事件（Remote to Local）
      await this.syncDateRange(visibleStart, visibleEnd, true); // isHighPriority = true
      
      // 2. 异步同步剩余事件（分批次，避免阻塞UI）
      setTimeout(() => {
        this.syncRemainingEventsInBackground(visibleStart, visibleEnd);
      }, 100); // 100ms后开始后台同步

    } catch (error) {
      syncLogger.error('❌ [Priority Sync] Error:', error);
    }
  }

  // 🔧 [NEW] 同步指定日期范围的事件
  private async syncDateRange(startDate: Date, endDate: Date, isHighPriority: boolean = false) {
    if (!this.microsoftService.isSignedIn()) {
      syncLogger.warn('⚠️ [syncDateRange] Not signed in, skipping');
      return;
    }

    const priorityLabel = isHighPriority ? '[HIGH PRIORITY]' : '[BACKGROUND]';
    syncLogger.log(`📥 ${priorityLabel} Syncing date range:`, {
      start: formatTimeForStorage(startDate),
      end: formatTimeForStorage(endDate)
    });

    try {
      // 获取远程事件
      const remoteEvents = await this.getAllCalendarsEvents(startDate, endDate);
      
      if (remoteEvents === null || remoteEvents.length === 0) {
        syncLogger.warn(`⚠️ ${priorityLabel} No events found in range`);
        return;
      }

      syncLogger.log(`✅ ${priorityLabel} Got ${remoteEvents.length} events, processing...`);

      // 处理远程事件
      const localEvents = this.getLocalEvents();
      const uniqueEvents = new Map();
      
      remoteEvents.forEach(event => {
        const key = event.externalId || event.id;
        if (key && !uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });
      
      const eventsToProcess = Array.from(uniqueEvents.values());
      
      // 应用远程变更到本地
      for (const event of eventsToProcess) {
        // 检查是否已删除
        const cleanEventId = event.id.startsWith('outlook-') ? event.id.replace('outlook-', '') : event.id;
        const isDeleted = this.deletedEventIds.has(cleanEventId) || this.deletedEventIds.has(event.id);
        
        if (isDeleted) continue;

        // 检查是否已存在
        const pureOutlookId = event.id.replace(/^outlook-/, '');
        const existingLocal = this.eventIndexMap.get(pureOutlookId);

        if (!existingLocal) {
          // 创建新事件
          this.recordRemoteAction('create', 'event', event.id, event);
        } else {
          // 检查是否需要更新
          const remoteModified = new Date(event.lastModifiedDateTime || event.createdDateTime || new Date());
          const localModified = new Date(existingLocal.updatedAt || existingLocal.createdAt || new Date());
          
          if (remoteModified.getTime() > localModified.getTime() + 2 * 60 * 1000) {
            this.recordRemoteAction('update', 'event', event.id, event);
          }
        }
      }

      // 立即应用远程动作
      await this.syncPendingRemoteActions();
      
      if (isHighPriority) {
        syncLogger.log('✅ [HIGH PRIORITY] Visible range synced successfully');
        
        // 触发UI更新事件
        window.dispatchEvent(new CustomEvent('visibleRangeSynced', {
          detail: { 
            count: eventsToProcess.length,
            startDate,
            endDate
          }
        }));
      }

    } catch (error) {
      syncLogger.error(`❌ ${priorityLabel} Sync failed:`, error);
    }
  }

  // 🔧 [NEW] 后台同步剩余事件（分批次，避免阻塞UI）
  private async syncRemainingEventsInBackground(visibleStart: Date, visibleEnd: Date) {
    syncLogger.log('🔄 [Background Sync] Starting sync for remaining events...');

    try {
      // 计算完整同步范围（过去1年到未来3个月）
      const now = new Date();
      const fullStartDate = new Date(now);
      fullStartDate.setFullYear(now.getFullYear() - 1);
      fullStartDate.setHours(0, 0, 0, 0);
      
      const fullEndDate = new Date(now);
      fullEndDate.setMonth(now.getMonth() + 3);
      fullEndDate.setHours(23, 59, 59, 999);

      // 分批次同步：
      // Batch 1: visibleStart 之前的事件
      if (visibleStart > fullStartDate) {
        syncLogger.log('📦 [Background Sync] Batch 1: Events before visible range');
        await this.syncDateRange(fullStartDate, new Date(visibleStart.getTime() - 1));
        await new Promise(resolve => setTimeout(resolve, 200)); // 延迟200ms
      }

      // Batch 2: visibleEnd 之后的事件
      if (visibleEnd < fullEndDate) {
        syncLogger.log('📦 [Background Sync] Batch 2: Events after visible range');
        await this.syncDateRange(new Date(visibleEnd.getTime() + 1), fullEndDate);
      }

      syncLogger.log('✅ [Background Sync] All remaining events synced');

    } catch (error) {
      syncLogger.error('❌ [Background Sync] Error:', error);
    }
  }

  // �🔧 [NEW] 获取所有日历的事件（保证每个事件携带正确的 calendarId）
  // ⚡ [OPTIMIZED] 使用并发限制避免触发 Microsoft Graph API 速率限制 (429)
  private async getAllCalendarsEvents(startDate?: Date, endDate?: Date): Promise<any[] | null> {
    try {
      const allEvents: any[] = [];

      // 优先从缓存读取用户的全部日历
      let calendars: any[] = [];
      try {
        const savedCalendars = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
        if (savedCalendars) {
          calendars = JSON.parse(savedCalendars) || [];
        }
      } catch (e) {
        // ignore and fallback to empty list
      }

      if (!calendars || calendars.length === 0) {
        // 如果缓存为空，直接返回空数组，避免误用 /me/events 丢失 calendarId
        console.warn('⚠️ [getAllCalendarsEvents] No calendars in cache; skip global fetch to preserve calendarId fidelity');
        return [];
      }
      // ⚡ [OPTIMIZED] 降低并发限制，避免触发 429 速率限制
      // Microsoft Graph API 限制：每用户每秒 ~10 请求
      const CONCURRENT_LIMIT = 2; // 🔧 从 3 降低到 2
      const chunks = [];
      for (let i = 0; i < calendars.length; i += CONCURRENT_LIMIT) {
        chunks.push(calendars.slice(i, i + CONCURRENT_LIMIT));
      }
      if (process.env.NODE_ENV === 'development') {
        console.log(`⚡ [getAllCalendarsEvents] Fetching ${calendars.length} calendars in ${chunks.length} batches (${CONCURRENT_LIMIT} concurrent)`);
      }
      
      // 🔧 [NEW] 记录批次数量，用于动态计算删除确认时间
      this.lastSyncBatchCount = chunks.length;
      
      for (const [index, chunk] of chunks.entries()) {
        if (process.env.NODE_ENV === 'development') {
          console.log(`📦 [Batch ${index + 1}/${chunks.length}] Processing ${chunk.length} calendars...`);
        }
        
        // 并发请求当前批次的日历
        const promises = chunk.map(async (cal: any) => {
          const calendarId = cal.id;
          try {
            const events = await this.microsoftService.getEventsFromCalendar(calendarId, startDate, endDate);
            return events.map((ev: any) => ({
              ...ev,
              calendarId,
              // 为每个事件附带对应标签（若有映射）
              tagId: this.findTagIdForCalendar(calendarId)
            }));
          } catch (err) {
            console.warn('⚠️ [getAllCalendarsEvents] Failed fetching events for calendar', calendarId, err);
            return [];
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach(events => allEvents.push(...events));
        
        // 🔧 增加批次间延迟，避免速率限制（100ms → 800ms）
        if (index < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      }
      return allEvents;
    } catch (error) {
      console.error('❌ [getAllCalendarsEvents] Error:', error);
      return null; // 🔧 返回 null 表示获取失败（而不是"确实没有事件"）
    }
  }

  // 🔧 [NEW] 找到映射到指定日历的标签ID
  private findTagIdForCalendar(calendarId: string): string | null {
    try {
      if (typeof window !== 'undefined' && (window as any).TagService) {
        const flatTags = (window as any).TagService.getFlatTags();
        const foundTag = flatTags.find((tag: any) => tag.calendarMapping?.calendarId === calendarId);
        return foundTag?.id || null;
      } else {
        // 备用方案：从持久化存储读取
        const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
        if (savedTags) {
          const findTag = (tags: any[]): string | null => {
            for (const tag of tags) {
              if (tag.calendarMapping?.calendarId === calendarId) {
                return tag.id;
              }
              if (tag.children) {
                const childResult = findTag(tag.children);
                if (childResult) return childResult;
              }
            }
            return null;
          };
          return findTag(savedTags);
        }
      }
      return null;
    } catch (error) {
      console.error('❌ [findTagIdForCalendar] Error:', error);
      return null;
    }
  }

  private loadActionQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS);
      if (stored) {
        this.actionQueue = JSON.parse(stored).map((action: any) => ({
          ...action,
          timestamp: new Date(action.timestamp),
          synchronizedAt: action.synchronizedAt ? new Date(action.synchronizedAt) : undefined,
          retryCount: action.retryCount || 0,
          originalData: action.originalData || action.oldData
        }));
      }
    } catch (error) {
      console.error('Failed to load action queue:', error);
      this.actionQueue = [];
    }
  }

  private saveActionQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(this.actionQueue));
      // 🔧 [FIX] 更新队列修改时间，用于完整性检查的调度
      this.lastQueueModification = Date.now();
    } catch (error) {
      console.error('Failed to save action queue:', error);
    }
  }

  private loadConflictQueue() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.SYNC_CONFLICTS);
      if (stored) {
        this.conflictQueue = JSON.parse(stored).map((conflict: any) => ({
          ...conflict,
          localAction: {
            ...conflict.localAction,
            timestamp: new Date(conflict.localAction.timestamp)
          },
          remoteAction: {
            ...conflict.remoteAction,
            timestamp: new Date(conflict.remoteAction.timestamp)
          }
        }));
      }
    } catch (error) {
      console.error('Failed to load conflict queue:', error);
      this.conflictQueue = [];
    }
  }

  private saveConflictQueue() {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_CONFLICTS, JSON.stringify(this.conflictQueue));
    } catch (error) {
      console.error('Failed to save conflict queue:', error);
    }
  }

  // 🆕 加载已删除事件ID
  private loadDeletedEventIds() {
    try {
      const stored = localStorage.getItem('remarkable-dev-persistent-deletedEventIds');
      if (stored) {
        this.deletedEventIds = new Set(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load deleted event IDs:', error);
      this.deletedEventIds = new Set();
    }
  }

  // 🆕 保存已删除事件ID
  private saveDeletedEventIds() {
    try {
      localStorage.setItem('remarkable-dev-persistent-deletedEventIds', JSON.stringify(Array.from(this.deletedEventIds)));
    } catch (error) {
      console.error('Failed to save deleted event IDs:', error);
    }
  }

  // 🆕 清理过期的已删除事件ID（避免Set无限增长）
  private cleanupDeletedEventIds() {
    // 保留最近1000个删除记录，超过的清理掉
    const maxSize = 1000;
    if (this.deletedEventIds.size > maxSize) {
      const array = Array.from(this.deletedEventIds);
      this.deletedEventIds = new Set(array.slice(-maxSize));
      this.saveDeletedEventIds();
    }
  }

  /**
   * 🔍 去重：检测并删除重复的事件
   * 重复定义：相同的 externalId（来自 Outlook）但不同的本地 ID
   * 策略：保留 lastSyncTime 最新的事件
   */
  private deduplicateEvents() {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!savedEvents) return;

      const events = JSON.parse(savedEvents);
      
      // 🔧 [OPTIMIZATION] 快速预检：检查是否真的有重复
      const externalIdSet = new Set<string>();
      let hasDuplicate = false;
      
      for (const event of events) {
        if (event.externalId) {
          if (externalIdSet.has(event.externalId)) {
            hasDuplicate = true;
            break; // 发现重复，立即退出
          }
          externalIdSet.add(event.externalId);
        }
      }
      
      if (!hasDuplicate) {
        return; // ✅ 没有重复，直接返回，避免不必要的处理
      }
      
      // 如果有重复，才进行详细分组
      const externalIdMap = new Map<string, any[]>();
      
      // 按 externalId 分组
      events.forEach((event: any) => {
        if (event.externalId) {
          const existing = externalIdMap.get(event.externalId) || [];
          existing.push(event);
          externalIdMap.set(event.externalId, existing);
        }
      });

      // 统计重复
      let duplicateCount = 0;
      const duplicateGroups: string[] = [];
      
      externalIdMap.forEach((group, externalId) => {
        if (group.length > 1) {
          duplicateCount += group.length - 1;
          duplicateGroups.push(externalId);
        }
      });

      console.warn(`⚠️ [deduplicateEvents] Found ${duplicateCount} duplicate events in ${duplicateGroups.length} groups`);

      // 去重：每组只保留 lastSyncTime 最新的
      const uniqueEvents: any[] = [];
      const seenExternalIds = new Set<string>();
      const removedEventIds = new Set<string>();
      
      events.forEach((event: any) => {
        if (!event.externalId) {
          // 没有 externalId 的事件（本地新建）直接保留
          uniqueEvents.push(event);
          return;
        }

        if (seenExternalIds.has(event.externalId)) {
          // 已经处理过这个 externalId，需要比较
          const existingIndex = uniqueEvents.findIndex(e => e.externalId === event.externalId);
          if (existingIndex !== -1) {
            const existing = uniqueEvents[existingIndex];
            const existingTime = existing.lastSyncTime ? new Date(existing.lastSyncTime).getTime() : 0;
            const currentTime = event.lastSyncTime ? new Date(event.lastSyncTime).getTime() : 0;
            
            if (currentTime > existingTime) {
              // 当前事件更新，替换旧的
              removedEventIds.add(existing.id);
              uniqueEvents[existingIndex] = event;
            } else {
              // 旧事件更新，标记当前为删除
              removedEventIds.add(event.id);
            }
          }
        } else {
          // 第一次见到这个 externalId
          seenExternalIds.add(event.externalId);
          uniqueEvents.push(event);
        }
      });

      // 🔧 [IndexMap 优化] 从索引中删除被去重的事件
      removedEventIds.forEach(eventId => {
        const event = events.find((e: any) => e.id === eventId);
        if (event) {
          this.removeEventFromIndex(event);
        }
      });

      // 🔧 [CRITICAL FIX] 使用异步重建，避免阻塞主线程
      // 去重涉及大量事件，异步重建可以提升性能
      this.saveLocalEvents(uniqueEvents, false); // ❌ 不立即重建
      
      // 异步重建 IndexMap
      this.rebuildEventIndexMapAsync(uniqueEvents).catch(err => {
        console.error('❌ [deduplicateEvents] Failed to rebuild IndexMap:', err);
      });
      
      // ✅ 架构清理：使用 eventsUpdated 代替 local-events-changed
      // 去重操作影响所有事件，触发完整重新加载
      console.log('🔄 [deduplicateEvents] Triggering eventsUpdated for deduplicated events');
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { action: 'deduplicate', count: uniqueEvents.length }
      }));
      
    } catch (error) {
      console.error('❌ [deduplicateEvents] Failed:', error);
    }
  }

  // 🔧 添加同步备注生成方法
  private generateSyncNote(source: 'outlook' | 'remarkable', action: 'create' | 'update'): string {
    const now = new Date();
    const timestamp = formatTimeForStorage(now).replace('T', ' ');
    const sourceDisplay = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
    
    if (action === 'create') {
      return `\n\n---\n由 ${sourceDisplay} 创建`;
    } else {
      return `\n\n---\n由 ${sourceDisplay} 最新修改于 ${timestamp}`;
    }
  }

  // 🔧 检查文本中是否包含创建备注
  private hasCreateNote(text: string): boolean {
    const createNotePattern = /由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建/;
    return createNotePattern.test(text);
  }

  // 🔧 检查文本中是否包含编辑备注
  private hasEditNote(text: string): boolean {
    const editNotePattern = /由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:最后编辑于|最新修改于)/;
    return editNotePattern.test(text);
  }

  // 🔧 移除所有编辑备注，但保留创建备注，智能处理分隔线
  private removeEditNotesOnly(text: string): string {
    if (!text) return '';
    
    let result = text;
    
    // 1. 移除所有编辑备注（多行连续的）
    result = result.replace(/(\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:最后编辑于|最新修改于) [^\n]*)+$/g, '');
    
    // 2. 移除单独的编辑备注
    result = result.replace(/\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:最后编辑于|最新修改于) [^\n]*$/g, '');
    
    // 3. 清理多个连续的分隔线，合并为单个
    result = result.replace(/(\n---\s*){2,}/g, '\n---\n');
    
    // 4. 移除末尾孤立的分隔线（如果后面没有内容）
    result = result.replace(/\n---\s*$/g, '');
    
    return result.trim();
  }

  // 🔧 检查文本是否已经以分隔线结尾或包含创建备注
  private endsWithSeparator(text: string): boolean {
    const trimmed = text.trim();
    // 检查是否以 --- 结尾，或者包含创建备注（说明已有分隔线）
    return /\n---\s*$/.test(trimmed) || this.hasCreateNote(trimmed);
  }

  // 🔧 生成创建备注
  private generateCreateNote(source: 'outlook' | 'remarkable', createTime?: Date | string, baseText?: string): string {
    // 使用传入的时间或当前时间
    const timeToUse = createTime ? (typeof createTime === 'string' ? new Date(createTime) : createTime) : new Date();
    const timeStr = `${timeToUse.getFullYear()}-${(timeToUse.getMonth() + 1).toString().padStart(2, '0')}-${timeToUse.getDate().toString().padStart(2, '0')} ${timeToUse.getHours().toString().padStart(2, '0')}:${timeToUse.getMinutes().toString().padStart(2, '0')}:${timeToUse.getSeconds().toString().padStart(2, '0')}`;
    const sourceIcon = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
    
    // 检查是否需要添加分隔线
    if (baseText && (baseText.trim().endsWith('---') || baseText.includes('\n---\n'))) {
      // 如果已经有分隔线，只添加创建备注
      return `\n由 ${sourceIcon} 创建于 ${timeStr}`;
    } else {
      // 添加分隔线和创建备注
      return `\n\n---\n由 ${sourceIcon} 创建于 ${timeStr}`;
    }
  }

  // 🔧 生成编辑备注
  private generateEditNote(source: 'outlook' | 'remarkable', baseText?: string): string {
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    const sourceIcon = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
    
    // 检查基础文本是否已经以分隔线结尾
    if (baseText && this.endsWithSeparator(baseText)) {
      // 如果已经有分隔线，只添加编辑备注
      return `\n由 ${sourceIcon} 最后编辑于 ${timeStr}`;
    } else {
      // 如果没有分隔线，添加分隔线和编辑备注
      return `\n\n---\n由 ${sourceIcon} 最后编辑于 ${timeStr}`;
    }
  }

  // 🔧 统一的描述处理方法 - 简化版本
  private processEventDescription(htmlContent: string, source: 'outlook' | 'remarkable', action: 'create' | 'update' | 'sync', eventData?: any): string {
    // 1. 清理HTML内容，得到纯文本
    const cleanText = this.cleanHtmlContent(htmlContent);
    
    // 2. 移除多余的分隔符和处理原始内容
    
    // 3. 根据不同操作和情况处理
    if (source === 'outlook' && action === 'sync') {
      // 从Outlook同步到本地
      let result = this.extractOriginalDescription(cleanText);
      
      // 如果没有创建备注，添加Outlook创建备注，使用事件的真实创建时间
      if (!this.hasCreateNote(result)) {
        const createTime = eventData?.createdDateTime || eventData?.createdAt || new Date();
        result += this.generateCreateNote('outlook', createTime, result);
      }
      
      return result;
    }
    
    // 4. 对于本地操作（create/update）
    let result = cleanText;
    
    if (action === 'create') {
      // 创建操作：只有在没有创建备注时才添加
      if (!this.hasCreateNote(result)) {
        // 🔍 [NEW] 支持保持原始创建时间
        let createTime: Date;
        if (eventData?.preserveOriginalCreateTime) {
          createTime = eventData.preserveOriginalCreateTime;
          // Using preserved original create time
        } else {
          createTime = eventData?.createdAt || new Date();
          // Using new create time
        }
        
        result += this.generateCreateNote('remarkable', createTime, result);
        // Added ReMarkable create note
      } else {
        // Skipping create note - already exists
      }
    } else if (action === 'update') {
      // 更新操作：移除编辑备注，保留创建备注，添加新的编辑备注
      result = this.removeEditNotesOnly(cleanText);
      result += this.generateEditNote('remarkable', result);
      // Removed old edit notes and added new edit note
    }
    
    // Description processing completed
    
    return result;
  }

  // 🔧 改进的提取原始内容方法 - 智能处理分隔线
  private extractOriginalDescription(description: string): string {
    if (!description) return '';
    
    let cleaned = description;
    
    // 1. 移除所有编辑备注（多行连续的）
    cleaned = cleaned.replace(/(\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:最后编辑于|最新修改于) [^\n]*)+$/g, '');
    
    // 2. 移除单独的编辑备注
    cleaned = cleaned.replace(/\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:最后编辑于|最新修改于) [^\n]*$/g, '');
    
    // 3. 清理多个连续的分隔线，合并为单个
    cleaned = cleaned.replace(/(\n---\s*){2,}/g, '\n---\n');
    
    // 4. 清理空行
    cleaned = cleaned.trim();
    
    // 5. 移除末尾孤立的分隔线（如果后面没有内容）
    cleaned = cleaned.replace(/\n---\s*$/g, '');
    
    return cleaned;
  }

  // 🔍 [NEW] 提取原始创建时间 - 用于保持事件的真实创建时间记录
  private extractOriginalCreateTime(description: string): Date | null {
    if (!description) return null;
    
    try {
      // 匹配创建时间的正则表达式
      // 格式：由 🔮 ReMarkable 创建于 2025-10-12 02:37:15
      // 或：  由 📧 Outlook 创建于 2025-10-12 02:37:15
      const createTimeMatch = description.match(/由 (?:🔮 ReMarkable|📧 Outlook) 创建于 (\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})/);
      
      if (createTimeMatch && createTimeMatch[1]) {
        const timeString = createTimeMatch[1];
        const parsedTime = new Date(timeString);
        
        if (!isNaN(parsedTime.getTime())) {
          // Found original create time
          return parsedTime;
        }
      }
      
      // No valid create time found
      return null;
    } catch (error) {
      console.warn('⚠️ [extractOriginalCreateTime] Error parsing create time:', error);
      return null;
    }
  }

  // 获取远程事件的描述内容 - 修复版本
  private getEventDescription(event: any): string {
    // 尝试多个可能的描述字段
    const htmlContent = event.body?.content || 
                       event.description || 
                       event.bodyPreview || 
                       '';
    
    return this.processEventDescription(htmlContent, 'outlook', 'sync', event);
  }

  // 🆕 编辑锁定机制 - 防止远程同步覆盖本地正在编辑的事件
  private setEditLock(entityId: string, durationMs: number = 10000) {
    // 设置10秒的编辑锁定期
    const expiryTime = Date.now() + durationMs;
    this.editLocks.set(entityId, expiryTime);
    // Locked event
  }

  private isEditLocked(entityId: string): boolean {
    const lockExpiry = this.editLocks.get(entityId);
    if (!lockExpiry) return false;
    
    if (Date.now() > lockExpiry) {
      // 锁定已过期，清除锁定
      this.editLocks.delete(entityId);
      // Lock expired
      return false;
    }
    
    // Event is still locked
    return true;
  }

  private clearEditLock(entityId: string) {
    if (this.editLocks.has(entityId)) {
      this.editLocks.delete(entityId);
      // Manually cleared lock
    }
  }

  public recordLocalAction(type: 'create' | 'update' | 'delete', entityType: 'event' | 'task', entityId: string, data?: any, oldData?: any) {
    //  [FIX] 记录最近更新的事件，防止同步时误删
    if (type === 'update' && entityType === 'event') {
      this.recentlyUpdatedEvents.set(entityId, Date.now());
    }
    
    // 🔧 注释：编辑锁定现在在实际同步时处理，而不是在记录时设置
    // if (type === 'update' && entityType === 'event') {
    //   this.setEditLock(entityId);
    // }

    const action: SyncAction = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityType,
      entityId,
      timestamp: new Date(),
      source: 'local',
      data,
      oldData,
      originalData: oldData,
      synchronized: false,
      retryCount: 0
    };

    this.actionQueue.push(action);
    this.saveActionQueue();
    
    // 🔧 [NEW] 检查网络状态
    const isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;
    
    if (this.isRunning && this.microsoftService.isSignedIn() && isOnline) {
      // � [PERFORMANCE FIX] 延迟同步避免阻塞 UI
      // 删除操作延迟 1 秒执行，让 UI 先响应用户操作
      const delayMs = type === 'delete' ? 1000 : 100;
      setTimeout(() => {
        this.syncSingleAction(action);
      }, delayMs);
    }
  }

  // 检查是否需要全量同步
  private checkIfFullSyncNeeded() {
    // 移除了ongoingDays的检查，因为现在默认同步1年的数据
    // 只在首次启动时需要全量同步
    if (!this.lastSyncSettings) {
      this.needsFullSync = true;
      this.lastSyncSettings = { initialized: true };
    }
  }

  // 🔧 [NEW] 获取当前 TimeCalendar 显示的日期
  private getCurrentCalendarDate(): Date {
    try {
      // 尝试从 localStorage 获取保存的当前日期
      const savedDate = localStorage.getItem('remarkable-calendar-current-date');
      if (savedDate) {
        const date = new Date(savedDate);
        if (!isNaN(date.getTime())) {
          return date;
        }
      }
    } catch (error) {
      // 忽略错误，使用默认值
    }
    
    // 默认返回当前日期
    return new Date();
  }

  public start() {
    if (this.isRunning) {
      return;
    }
    
    this.isRunning = true;
    // 🔧 启动时立即检查 token 是否过期
    if (this.microsoftService && !this.microsoftService.checkTokenExpiration()) {
      // 不返回，让其他机制继续运行（用户可能会重新登录）
    }
    
    // 检查是否需要全量同步
    this.checkIfFullSyncNeeded();
    
    // � [NEW] 立即同步可见日历视图（不延迟）
    // 优先同步当前月视图的事件，剩余事件异步后台同步
    if (typeof window !== 'undefined') {
      // 获取当前 TimeCalendar 的可见日期范围
      const currentDate = this.getCurrentCalendarDate();
      const visibleStart = new Date(currentDate);
      visibleStart.setMonth(visibleStart.getMonth() - 1); // 当前月-1月
      visibleStart.setDate(1);
      visibleStart.setHours(0, 0, 0, 0);
      
      const visibleEnd = new Date(currentDate);
      visibleEnd.setMonth(visibleEnd.getMonth() + 2); // 当前月+2月
      visibleEnd.setDate(0); // 上个月最后一天
      visibleEnd.setHours(23, 59, 59, 999);
      
      syncLogger.log('🚀 [Start] Immediate priority sync for visible calendar view');
      
      // 立即同步可见范围
      this.syncVisibleDateRangeFirst(visibleStart, visibleEnd).catch(error => {
        syncLogger.error('❌ [Start] Priority sync failed:', error);
      });
    } else {
      // 非浏览器环境，执行常规同步
      setTimeout(() => {
        if (this.isRunning && !this.syncInProgress) {
          this.performSync();
        }
      }, 0);
    }
    
    // 设置定期增量同步（20秒一次，只同步 3 个月窗口）
    this.syncInterval = setInterval(() => {
      // 🔧 [NEW] 主动检查 token 是否过期
      if (this.microsoftService && !this.microsoftService.checkTokenExpiration()) {
        return;
      }
      
      // 🔧 [MODIFIED] 移除窗口激活检查，允许在激活时同步
      // 删除检查会在 fetchRemoteChanges 中根据 isWindowFocused 跳过
      // if (this.isWindowFocused) {
      //   return;
      // }
      
      if (!this.syncInProgress) {
        // 🎯 标记为定时器触发，启用优先级控制
        this.isTimerTriggered = true;
        this.performSync();
      }
    }, 20000); // 改为 20 秒
    
    // 🔧 [NEW] 立即启动高频完整性检查（每 5 秒检查一次，每次 < 10ms）
    this.startIntegrityCheckScheduler();
  }

  public stop() {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    // 🔧 [NEW] 停止完整性检查
    if (this.indexIntegrityCheckInterval) {
      clearInterval(this.indexIntegrityCheckInterval);
      this.indexIntegrityCheckInterval = null;
    }
  }

  // 公共方法：触发全量同步（用于设置变更时调用）
  public triggerFullSync() {
    this.needsFullSync = true;
    this.checkIfFullSyncNeeded();
    
    // 如果正在运行，立即执行优先级同步
    if (this.isRunning && !this.syncInProgress) {
      // 🚀 使用优先级同步策略
      const currentDate = this.getCurrentCalendarDate();
      const visibleStart = new Date(currentDate);
      visibleStart.setMonth(visibleStart.getMonth() - 1);
      visibleStart.setDate(1);
      visibleStart.setHours(0, 0, 0, 0);
      
      const visibleEnd = new Date(currentDate);
      visibleEnd.setMonth(visibleEnd.getMonth() + 2);
      visibleEnd.setDate(0);
      visibleEnd.setHours(23, 59, 59, 999);
      
      syncLogger.log('🚀 [Full Sync Triggered] Using priority strategy');
      this.syncVisibleDateRangeFirst(visibleStart, visibleEnd).catch(error => {
        syncLogger.error('❌ [Full Sync] Priority sync failed:', error);
      });
    }
  }

  private async performSync(options: { skipRemoteFetch?: boolean } = {}) {
    if (this.syncInProgress) {
      return;
    }
    
    if (!this.microsoftService.isSignedIn()) {
      return;
    }

    // 🔧 防止短时间内重复同步（最小间隔 5 秒）
    const now = Date.now();
    const timeSinceLastSync = this.lastSyncTime ? (now - this.lastSyncTime.getTime()) : Infinity;
    if (timeSinceLastSync < 5000) {
      return;
    }

    this.syncInProgress = true;
    const skipRemote = options.skipRemoteFetch || false;
    
    // 📊 重置同步统计
    this.syncStats = {
      syncFailed: 0,
      calendarCreated: 0,
      syncSuccess: 0
    };
    
    const syncStartTime = performance.now();

    try {
      // 🆕 清理过期的已删除事件ID
      this.cleanupDeletedEventIds();
      
      // 🔧 [FIX] 清理过期的最近更新事件记录（超过60秒的）
      const expireTime = Date.now() - 60000;
      let cleanedCount = 0;
      this.recentlyUpdatedEvents.forEach((timestamp, eventId) => {
        if (timestamp < expireTime) {
          this.recentlyUpdatedEvents.delete(eventId);
          cleanedCount++;
        }
      });
      if (cleanedCount > 0) {
        // 已清理过期记录
      }
      
      // 🔧 [OPTIMIZED] 双向同步优化：先推送本地更改（快），再拉取远程更改（慢）
      // 这样可以避免在只有本地更改时触发不必要的全量拉取（429错误）
      const hasPendingLocalActions = this.actionQueue.some(
        action => action.source === 'local' && !action.synchronized
      );
      
      if (hasPendingLocalActions) {
      // console.log('📤 [Sync] Step 1: Syncing local changes to remote (lightweight)...');
        await this.syncPendingLocalActions();
        
        // 🎯 [PRIORITY OPTIMIZATION] 如果定时器触发时发现有本地队列，先推送本地后立即返回
        // 让下一个定时器周期再拉取远程，确保 localToRemote 优先级高于 remoteToLocal
        if (!skipRemote && this.isTimerTriggered) {
          this.syncInProgress = false;
          this.isTimerTriggered = false; // 🎯 重置定时器标志
          this.lastSyncTime = new Date();
          return;
        }
      }
      
      // 根据skipRemote标志决定是否拉取远程
      if (!skipRemote) {
        await this.fetchRemoteChanges();
        await this.syncPendingRemoteActions();
      }
      
      await this.resolveConflicts();
      this.cleanupSynchronizedActions();
      
      // 🔍 去重检查：防止迁移等操作产生重复事件
      this.deduplicateEvents();
      
      this.lastSyncTime = new Date();
      
      // 🔧 更新localStorage，供状态栏使用（使用本地时间格式）
      localStorage.setItem('lastSyncTime', formatTimeForStorage(this.lastSyncTime));
      localStorage.setItem('lastSyncEventCount', String(this.actionQueue.length || 0));
      
      // 📊 保存同步统计信息
      localStorage.setItem('syncStats', JSON.stringify(this.syncStats));
      
      const syncDuration = performance.now() - syncStartTime;
      
      window.dispatchEvent(new CustomEvent('action-sync-completed', {
        detail: { 
          timestamp: this.lastSyncTime,
          duration: syncDuration 
        }
      }));
      
      // ⚠️ 如果同步时间过长，给出警告
      if (syncDuration > 3000) {
        console.warn(`⚠️ [performSync] Sync took too long: ${syncDuration.toFixed(0)}ms (threshold: 3000ms)`);
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
      this.isTimerTriggered = false; // 🎯 重置定时器标志
    }
  }

  private async fetchRemoteChanges() {
    try {
      if (!this.microsoftService || !this.microsoftService.isSignedIn()) {
        return;
      }

      const isFullSync = this.needsFullSync;
      
      // ✅ 发送同步开始事件
      window.dispatchEvent(new CustomEvent('action-sync-started', { 
        detail: { isFullSync } 
      }));

      // 🔧 智能时间范围：根据同步类型决定范围
      const now = new Date();
      let startDate: Date;
      let endDate: Date;
      
      if (isFullSync) {
        // 全量同步：上次同步时间 → 现在 + 未来 3 个月
        startDate = this.lastSyncTime || new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 3); // 未来 3 个月
        endDate.setHours(23, 59, 59, 999);
        
        this.needsFullSync = false; // 重置标记
      } else {
        // 增量同步：只检查最近 3 个月的事件（前后各 1.5 个月）
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1.5);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 1.5);
        endDate.setHours(23, 59, 59, 999);
      }

      
      const localEvents = this.getLocalEvents();

      // 改为逐日历拉取，确保每个事件带有准确的 calendarId
      const allRemoteEvents = await this.getAllCalendarsEvents(startDate, endDate);
      
      // 🔧 [CRITICAL FIX] 如果获取失败（返回 null），中止同步以保护本地数据
      if (allRemoteEvents === null) {
        console.error('❌ [Sync] Failed to fetch remote events (possibly logged out), aborting sync to protect local data');
        return;
      }
      
      // 🔧 [CRITICAL FIX] 如果远程事件为空，可能是网络错误或登出，停止同步以保护本地数据
      if (allRemoteEvents.length === 0) {
        const hasLocalEventsWithExternalId = localEvents.some((e: any) => e.externalId);
        if (hasLocalEventsWithExternalId) {
          console.warn('⚠️ [Sync] Remote returned 0 events but local has synced events - possible auth issue, aborting sync to protect local data');
          return; // ❌ 中止同步，避免误删
        }
      }      const uniqueEvents = new Map();
      
      allRemoteEvents.forEach(event => {
        const key = event.externalId || event.id;
        if (key && !uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });
      
      const combinedEvents = Array.from(uniqueEvents.values());
      const remarkableEvents = combinedEvents.filter((event: any) => {
        const subject = event.subject || '';
        
        // 🔧 修复时间解析问题
        let eventStartTime: Date;
        try {
          // 尝试多种时间字段
          const timeSource = event.start?.dateTime || 
                           event.start || 
                           event.createdDateTime || 
                           event.lastModifiedDateTime;
          
          if (timeSource) {
            eventStartTime = new Date(timeSource);
            // 验证日期是否有效
            if (isNaN(eventStartTime.getTime())) {
              console.warn(`⚠️ Invalid date for event "${subject}": ${timeSource}`);
              eventStartTime = new Date(); // 使用当前时间作为fallback
            }
          } else {
            console.warn(`⚠️ No date found for event "${subject}"`);
            eventStartTime = new Date(); // 使用当前时间作为fallback
          }
        } catch (error) {
          console.warn(`⚠️ Date parsing error for event "${subject}":`, error);
          eventStartTime = new Date(); // 使用当前时间作为fallback
        }
        
        const isInTimeRange = eventStartTime >= startDate && eventStartTime <= endDate;
        
        // 🔧 简化过滤逻辑：只要时间在范围内就同步
        const shouldInclude = isInTimeRange;
        
        return shouldInclude;
      });
      // 如果有事件被过滤掉，记录一个样本事件的信息
      if (combinedEvents.length > remarkableEvents.length) {
        const filteredOut = combinedEvents.filter(e => !remarkableEvents.includes(e))[0];
        if (filteredOut) {
        }
      }

      // 处理远程事件并转换为本地行动
      let createActionCount = 0;
      let updateActionCount = 0;
      
      remarkableEvents.forEach((event: any) => {
        // Processing event

        // 🆕 检查是否是已删除的事件，如果是则跳过
        const cleanEventId = event.id.startsWith('outlook-') ? event.id.replace('outlook-', '') : event.id;
        const isDeleted = this.deletedEventIds.has(cleanEventId) || this.deletedEventIds.has(event.id);
        
        if (isDeleted) {
          // Skipping deleted event
          return;
        }

        // 🚀 [SIMPLIFIED] 直接用纯 Outlook ID 查找 externalId
        // Outlook 返回的 event.id 是 'outlook-AAMkAD...'
        // 去掉前缀后得到纯 Outlook ID，这就是 externalId
        const pureOutlookId = event.id.replace(/^outlook-/, '');
        const existingLocal = this.eventIndexMap.get(pureOutlookId);

        if (!existingLocal) {
          // Creating new local event from remote
          // 🔧 [FIX] event.id 已经带有 'outlook-' 前缀（来自 MicrosoftCalendarService）
          // 不要重复添加前缀！
          this.recordRemoteAction('create', 'event', event.id, event);
          createActionCount++;
        } else {
          // 🔧 检查是否需要更新 - 更智能的比较逻辑
          const remoteModified = new Date(event.lastModifiedDateTime || event.createdDateTime || new Date());
          const localModified = new Date(existingLocal.updatedAt || existingLocal.createdAt || new Date());
          
          // 🔧 验证日期有效性，使用安全的时间比较
          const isRemoteDateValid = !isNaN(remoteModified.getTime());
          const isLocalDateValid = !isNaN(localModified.getTime());
          
          let timeDiffMinutes = 0;
          let significantTimeChange = false;
          
          if (isRemoteDateValid && isLocalDateValid) {
            // 🔧 时间差阈值：只有大于2分钟的差异才认为是真正的更新（增加容错）
            timeDiffMinutes = Math.abs(remoteModified.getTime() - localModified.getTime()) / (1000 * 60);
            significantTimeChange = timeDiffMinutes > 2;
          }
          
          // 详细比较各个字段
          const titleChanged = event.subject !== existingLocal.title;
          
          // 🔧 智能描述比较：比较纯净的核心内容，忽略格式和备注差异
          const remoteRawDescription = this.getEventDescription(event);
          const localRawDescription = existingLocal.description || '';
          
          // 提取核心内容进行比较
          const remoteCoreContent = this.extractCoreContent(remoteRawDescription);
          const localCoreContent = this.extractCoreContent(localRawDescription);
          const descriptionChanged = remoteCoreContent !== localCoreContent;
          
          // Comparing events
          
          if (titleChanged || descriptionChanged || significantTimeChange) {
            const reason = titleChanged ? 'title' : descriptionChanged ? 'description' : 'significant time change';
            
            // 🔍 调试：打印前 3 个更新的详细信息
            if (updateActionCount < 3) {
              
              // 如果是描述更改，输出详细的内容对比
              if (descriptionChanged) {
                // console.log(`🔍 [Sync] Description comparison:`, { remoteCoreLength, localCoreLength, remoteCorePreview, localCorePreview });
              }
            }
            
            // Updating local event from remote
            this.recordRemoteAction('update', 'event', existingLocal.id, event, existingLocal);
            updateActionCount++;
          } else {
            // Event is up to date
          }
        }
      });
      
      // 📊 统计创建和更新的action数量（仅在有变化时输出）
      if (createActionCount > 0 || updateActionCount > 0) {
      }

      // 🔧 检测远程删除的事件
      // ⚠️ 重要：只在获取了完整事件列表时才检查删除
      // 如果使用时间窗口过滤的事件列表，会误判所有窗口外的事件为"已删除"
      
      // 🔧 从远程事件中提取原始的Outlook ID（去掉outlook-前缀）
      const remoteEventIds = new Set(combinedEvents.map((event: any) => {
        // MicrosoftCalendarService返回的ID格式是 "outlook-{原始ID}"
        const rawId = event.id.startsWith('outlook-') ? event.id.replace('outlook-', '') : event.id;
        return rawId;
      }));
      
      const localEventsWithExternalId = localEvents.filter((localEvent: any) => 
        localEvent.externalId && localEvent.externalId.trim() !== ''
      );

      // 🔍 [DEBUG] 检查是否有重复的 externalId
      const externalIdCounts = new Map<string, number>();
      const externalIdToEvents = new Map<string, any[]>();
      
      localEventsWithExternalId.forEach((event: any) => {
        const cleanId = event.externalId.startsWith('outlook-') 
          ? event.externalId.replace('outlook-', '') 
          : event.externalId;
        externalIdCounts.set(cleanId, (externalIdCounts.get(cleanId) || 0) + 1);
        
        // 记录每个 externalId 对应的事件列表
        const events = externalIdToEvents.get(cleanId) || [];
        events.push(event);
        externalIdToEvents.set(cleanId, events);
      });
      
      const duplicates = Array.from(externalIdCounts.entries()).filter(([_, count]) => count > 1);
      if (duplicates.length > 0) {
        // 计算总的重复事件数量
        const totalDuplicateEvents = duplicates.reduce((sum, [_, count]) => sum + count, 0);
        const extraDuplicates = totalDuplicateEvents - duplicates.length; // 多余的副本数量
        
        console.warn(`⚠️ [Sync] Found ${duplicates.length} externalIds with duplicates (total ${totalDuplicateEvents} events, ${extraDuplicates} extra copies)`);
        
        // 🔍 [DEBUG] 打印前3个重复的详细信息
        if (process.env.NODE_ENV === 'development' && duplicates.length > 0) {
          console.group('🔍 [Sync] Duplicate externalId details (first 3)');
          duplicates.slice(0, 3).forEach(([externalId, count]) => {
            const events = externalIdToEvents.get(externalId) || [];
            console.log(`📋 externalId: ${externalId.substring(0, 20)}... (${count} copies)`);
            events.forEach((event, index) => {
              console.log(`  ${index + 1}. id: ${event.id.substring(0, 30)}..., title: "${event.title}", lastSyncTime: ${event.lastSyncTime || 'N/A'}`);
            });
          });
          console.groupEnd();
        }
      }

      
      // 📝 [NEW] 增加同步轮次
      this.syncRoundCounter++;      // ⚠️ 删除检查逻辑（两轮确认机制）：
      // 性能优化：只检查在同步窗口内的事件（通常 < 100个）
      // 1. 第一轮：未找到的事件加入候选列表（pending）
      // 2. 第二轮：候选列表中依然未找到的事件才真正删除
      // 3. 找到的事件从候选列表中移除

      // 🔧 [NEW] 删除轮询只在窗口非激活状态下进行，避免打断用户操作
      if (this.isWindowFocused) {
        console.log('⏸️ [Sync] Skipping deletion check: Window is focused (user is active)');
        // 注意：候选列表会保留，等待下一次窗口非激活时的同步再检查
      } else {
        const deletionCheckStartTime = performance.now();
        let deletionCheckCount = 0;
        let deletionCandidateCount = 0;
        let deletionConfirmedCount = 0;
      
      localEventsWithExternalId.forEach((localEvent: any) => {
        const cleanExternalId = localEvent.externalId.startsWith('outlook-') 
          ? localEvent.externalId.replace('outlook-', '')
          : localEvent.externalId;
        
        // 🔧 检查本地事件是否在当前同步的时间窗口内
        let localEventTime: Date;
        try {
          localEventTime = new Date(localEvent.start || localEvent.startTime);
        } catch {
          localEventTime = new Date(0); // fallback to epoch
        }
        
        const isInSyncWindow = localEventTime >= startDate && localEventTime <= endDate;
        
        // 🔧 [NEW] 检查是否已在候选列表中（即使不在同步窗口内）
        const isInCandidateList = this.deletionCandidates.has(localEvent.id);
        
        // 检查条件：在同步窗口内 OR 已在候选列表中
        if (isInSyncWindow || isInCandidateList) {
          const isFoundInRemote = remoteEventIds.has(cleanExternalId);
          
          if (isFoundInRemote) {
            // ✅ 找到了，从候选列表中移除
            if (this.deletionCandidates.has(localEvent.id)) {
              this.deletionCandidates.delete(localEvent.id);
            }
          } else {
            // ❌ 未找到，进入删除确认流程
            
            // 🔧 [FIX] 增加额外保护：检查事件是否最近刚更新过
            const recentlyUpdated = this.recentlyUpdatedEvents.has(localEvent.id);
            const lastUpdateTime = this.recentlyUpdatedEvents.get(localEvent.id) || 0;
            const timeSinceUpdate = Date.now() - lastUpdateTime;
            
            // 如果事件在最近30秒内被更新过，不视为删除（可能是同步延迟）
            if (recentlyUpdated && timeSinceUpdate < 30000) {
              deletionCheckCount++;
              return;
            }
            
            // 🔧 [FIX] 再次确认：检查是否在已删除列表中（避免重复删除）
            if (this.deletedEventIds.has(localEvent.id)) {
              deletionCheckCount++;
              return;
            }
            
            const existingCandidate = this.deletionCandidates.get(localEvent.id);
            const now = Date.now();
            
            if (!existingCandidate) {
              // 🆕 第一次未找到，加入候选列表
              this.deletionCandidates.set(localEvent.id, {
                externalId: cleanExternalId,
                title: localEvent.title,
                firstMissingRound: this.syncRoundCounter,
                firstMissingTime: now,
                lastCheckRound: this.syncRoundCounter,
                lastCheckTime: now
              });
              deletionCandidateCount++;
              
              if (deletionCandidateCount <= 3) {
      // console.log(`⏳ [Sync] Deletion candidate (1st miss): "${localEvent.title}"`);
              }
            } else {
              // 🔄 已在候选列表，检查是否满足删除条件
              existingCandidate.lastCheckRound = this.syncRoundCounter;
              existingCandidate.lastCheckTime = now;
              
              const roundsSinceMissing = this.syncRoundCounter - existingCandidate.firstMissingRound;
              const timeSinceMissing = now - existingCandidate.firstMissingTime;
              
              // 🔧 [NEW] 动态计算最小删除确认时间
              // 公式：Math.max(60000, 批次数量 * 800ms间隔 + 30000ms安全余量)
              // 例如：50个批次 → max(60000, 50*800+30000) = max(60000, 70000) = 70秒
              const minDeletionConfirmTime = Math.max(60000, this.lastSyncBatchCount * 800 + 30000);
              
              // 🔧 删除条件：至少2轮查询都未找到，且间隔超过动态计算的最小时间
              if (roundsSinceMissing >= 1 && timeSinceMissing >= minDeletionConfirmTime) {
                // ✅ 确认删除
                if (deletionConfirmedCount < 3) {
                  console.warn(`🗑️ [Sync] Confirmed deletion after ${roundsSinceMissing + 1} rounds (${Math.round(timeSinceMissing/1000)}s): "${localEvent.title}"`);
                }
                this.recordRemoteAction('delete', 'event', localEvent.id, null, localEvent);
                this.deletionCandidates.delete(localEvent.id);
                deletionConfirmedCount++;
              } else {
                // ⏳ 还在候选期，等待下一轮
                deletionCandidateCount++;
              }
            }
          }
          deletionCheckCount++;
        }
      });
      
      const deletionCheckDuration = performance.now() - deletionCheckStartTime;
      // 仅在有删除或候选时输出日志
      if (deletionCandidateCount > 0 || deletionConfirmedCount > 0) {
      // console.log(`📊 [Sync] Deletion check: ${deletionCandidateCount} pending, ${deletionConfirmedCount} confirmed (${deletionCheckDuration.toFixed(1)}ms)`);
      }
      
      // ⚠️ 性能警告
      if (deletionCheckDuration > 50) {
        console.warn(`⚠️ [Sync] Deletion check took too long: ${deletionCheckDuration.toFixed(0)}ms (threshold: 50ms)`);
      }
      
      // 🔧 清理过期的候选（超过10轮或超过10分钟仍未确认的，移除候选状态）
      const nowTime = Date.now();
      const expiredCandidates: string[] = [];
      this.deletionCandidates.forEach((candidate, eventId) => {
        const roundsSinceMissing = this.syncRoundCounter - candidate.firstMissingRound;
        const timeSinceMissing = nowTime - candidate.firstMissingTime;
        if (roundsSinceMissing > 10 || timeSinceMissing > 600000) {
          expiredCandidates.push(eventId);
        }
      });
      expiredCandidates.forEach(id => {
        const candidate = this.deletionCandidates.get(id);
        this.deletionCandidates.delete(id);
      });
      } // 🔧 [END] 删除检查 else 块

      // 🔧 只在全量同步时重置标记并输出特殊日志
      if (isFullSync) {
        // 全量同步完成，重置标记
        this.needsFullSync = false;
      } else {
      }

      // ...existing code...
    } catch (error) {
      console.error('❌ Failed to fetch remote changes:', error);
    }
  }

// 🔧 获取用户设置的方法（已废弃ongoingDays参数，现在默认同步1年数据）
private getUserSettings(): any {
  try {
    const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return settings ? JSON.parse(settings) : {};
  } catch {
    return {};
  }
}

  private recordRemoteAction(type: 'create' | 'update' | 'delete', entityType: 'event' | 'task', entityId: string, data?: any, oldData?: any) {
    const action: SyncAction = {
      id: `remote-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      entityType,
      entityId,
      timestamp: new Date(),
      source: 'outlook',
      data,
      oldData,
      originalData: oldData,
      synchronized: false,
      retryCount: 0
    };

    this.actionQueue.push(action);
  }

  private async syncPendingLocalActions() {
    const pendingLocalActions = this.actionQueue.filter(
      action => action.source === 'local' && !action.synchronized
    );
    
    // � [OPTIMIZATION] 合并同一个事件的多个 action，只保留最新的
    const consolidatedActions = new Map<string, SyncAction>();
    const markedAsSynced: SyncAction[] = []; // 需要标记为已同步的旧 action
    
    pendingLocalActions.forEach(action => {
      const key = `${action.entityType}-${action.entityId}`;
      const existing = consolidatedActions.get(key);
      
      if (!existing) {
        // 第一次遇到这个事件，直接添加
        consolidatedActions.set(key, action);
      } else {
        // 已经有这个事件的 action，需要合并
        if (action.type === 'delete') {
          // delete 优先级最高，覆盖任何其他操作
          markedAsSynced.push(existing); // 标记旧的为已同步
          consolidatedActions.set(key, action);
        } else if (existing.type === 'delete') {
          // 如果已经有 delete，保留 delete，忽略后续操作
          markedAsSynced.push(action);
        } else if (action.timestamp > existing.timestamp) {
          // 保留最新的操作（时间戳更大）
          markedAsSynced.push(existing);
          consolidatedActions.set(key, action);
        } else {
          // 当前操作更旧，忽略
          markedAsSynced.push(action);
        }
      }
    });
    
    // 🔧 标记被合并的旧 action 为已同步（避免重复执行）
    if (markedAsSynced.length > 0) {
      markedAsSynced.forEach(action => {
        action.synchronized = true;
        action.synchronizedAt = new Date();
      });
      this.saveActionQueue();
      console.log(`🔧 [Queue Optimization] Consolidated ${pendingLocalActions.length} actions → ${consolidatedActions.size} actions (saved ${markedAsSynced.length} API calls)`);
    }
    
    // 🔧 按重试次数排序，优先处理失败次数少的（新创建的事件优先）
    const actionsToSync = Array.from(consolidatedActions.values()).sort((a, b) => 
      (a.retryCount || 0) - (b.retryCount || 0)
    );

    for (const action of actionsToSync) {
      await this.syncSingleAction(action);
    }
  }

  private async syncPendingRemoteActions() {
    const pendingRemoteActions = this.actionQueue.filter(
      action => action.source === 'outlook' && !action.synchronized
    );
    if (pendingRemoteActions.length === 0) {
      return;
    }
    
    // 🔧 [CRITICAL] 等待 IndexMap 重建完成，避免竞态条件
    if (this.indexMapRebuildPromise) {
      console.log(`⏳ [SyncRemote] Waiting for IndexMap rebuild to complete...`);
      await this.indexMapRebuildPromise;
      console.log(`✅ [SyncRemote] IndexMap rebuild completed, proceeding with ${pendingRemoteActions.length} actions`);
    }
    
    let successCount = 0;
    let failCount = 0;
    
    // 🚀 批量模式：一次性获取localEvents，在内存中修改，最后统一保存
    let localEvents = this.getLocalEvents();
    
    // ⚡ 收集批量操作的详细信息，用于触发增量UI更新
    const uiUpdates: Array<{ type: string; eventId: string; event?: any }> = [];
    
    for (let i = 0; i < pendingRemoteActions.length; i++) {
      const action = pendingRemoteActions[i];
      try {
        if (i < 5) {
        }
        // 🚀 批量模式：传入localEvents，不触发UI更新，不立即保存
        const beforeCount = localEvents.length;
        localEvents = await this.applyRemoteActionToLocal(action, false, localEvents);
        const afterCount = localEvents.length;
        
        // ⚡ 记录操作类型和事件ID，用于增量UI更新
        if (action.type === 'create' && afterCount > beforeCount) {
          uiUpdates.push({ 
            type: 'create', 
            eventId: action.entityId,
            event: localEvents[localEvents.length - 1] 
          });
        } else if (action.type === 'update') {
          const updatedEvent = localEvents.find((e: any) => e.id === action.entityId || e.externalId === action.entityId);
          if (updatedEvent) {
            uiUpdates.push({ 
              type: 'update', 
              eventId: updatedEvent.id,
              event: updatedEvent
            });
          }
        } else if (action.type === 'delete') {
          uiUpdates.push({ 
            type: 'delete', 
            eventId: action.entityId 
          });
        }
        
        action.synchronized = true;
        action.synchronizedAt = new Date();
        successCount++;
        
      } catch (error) {
        console.error(`❌ [SyncRemote] Failed to apply remote action [${i+1}]:`, error);
        action.retryCount = (action.retryCount || 0) + 1;
        failCount++;
      }
    }
    
    // 🚀 批量保存：所有操作完成后统一保存一次
    if (successCount > 0) {
      // 🔧 [IndexMap 优化] 批量同步时已经在循环中增量更新了 IndexMap
      // 不需要重建！只保存到 localStorage
      this.saveLocalEvents(localEvents, false); // rebuildIndex=false，使用增量更新
      
      // ⚡ 批量触发详细的 eventsUpdated 事件，支持 TimeCalendar 增量更新
      console.log(`📡 [SyncRemote] Dispatching ${uiUpdates.length} eventsUpdated events for incremental UI update`);
      uiUpdates.forEach(update => {
        const detail: any = { eventId: update.eventId };
        
        if (update.type === 'create') {
          detail.isNewEvent = true;
          detail.tags = update.event?.tags || [];
        } else if (update.type === 'update') {
          detail.isUpdate = true;
          detail.tags = update.event?.tags || [];
        } else if (update.type === 'delete') {
          detail.deleted = true;
        }
        
        window.dispatchEvent(new CustomEvent('eventsUpdated', { detail }));
      });
    }
    this.saveActionQueue();
  }

  private async syncSingleAction(action: SyncAction) {
    // 🔧 [NEW] 跳过 syncStatus 为 'local-only' 的事件（例如：运行中的 Timer）
    if (action.data && action.data.syncStatus === 'local-only') {
      // console.log('⏭️ [SYNC SINGLE ACTION] Skipping local-only event (Timer in progress):', action.entityId);
      action.synchronized = true; // 标记为已处理，防止重试
      this.saveActionQueue();
      return;
    }
    
    // 🔧 [MODIFIED] 移除重试次数限制，只检查是否已同步
    if (action.synchronized) {
      return;
    }

    // 🔧 [NEW] 记录尝试时间
    action.lastAttemptTime = new Date();

    try {
      if (action.source === 'local') {
        const result = await this.applyLocalActionToRemote(action);
      } else {
        await this.applyRemoteActionToLocal(action);
      }

      action.synchronized = true;
      action.synchronizedAt = new Date();
      action.lastError = undefined; // 🔧 [NEW] 清除错误信息
      action.userNotified = false; // 🔧 [NEW] 重置通知状态
      
      // 📊 更新统计信息
      if (action.source === 'local') {
        if (action.type === 'create') {
          this.syncStats.calendarCreated++;
        } else if (action.type === 'update' || action.type === 'delete') {
          this.syncStats.syncSuccess++;
        }
      } else {
      // console.log('📊 [Stats] Skipping - not a local action (source:', action.source + ')');
      }
      
      this.saveActionQueue();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      console.error('❌ [SYNC SINGLE ACTION] Failed to sync action:', {
        actionId: action.id,
        type: action.type,
        error: error,
        errorMessage
      });
      
      // 🔧 [NEW] 记录错误信息
      action.lastError = errorMessage;
      action.retryCount = (action.retryCount || 0) + 1;
      
      // 📊 更新失败统计（仅针对本地到远程的同步）
      if (action.source === 'local') {
        this.syncStats.syncFailed++;
      }
      
      // 🔧 [NEW] 每失败3次通知用户一次（3, 6, 9...）
      const shouldNotify = action.retryCount % 3 === 0 && !action.userNotified;
      
      if (shouldNotify) {
        this.showSyncFailureNotification(action, errorMessage);
        action.userNotified = true; // 标记已通知，避免重复通知
      }
      
      this.saveActionQueue();
    }
  }

  private async applyLocalActionToRemote(action: SyncAction): Promise<boolean> {
    let syncTargetCalendarId: string | undefined; // 🔧 重命名变量避免潜在冲突
    
    try {
      
      if (action.source !== 'local') {
        return false;
      }
      
      if (!this.microsoftService) {
        return false;
      }
      
      if (!this.microsoftService.isSignedIn()) {
        return false;
      }

      switch (action.type) {
        case 'create':
          // 检查事件是否已经同步过（有externalId）或者是从Outlook同步回来的
          if (action.data.externalId || action.data.remarkableSource === false) {
            return true; // 标记为成功，避免重试
          }

          // 🔧 使用新的描述处理方法
          const createDescription = this.processEventDescription(
            action.data.description || '',
            'remarkable',
            'create',
            action.data
          );

          // 构建事件对象
          const eventData = {
            subject: action.data.title,
            body: { 
              contentType: 'Text', 
              content: createDescription
            },
            start: {
              dateTime: this.safeFormatDateTime(action.data.startTime),
              timeZone: 'Asia/Shanghai'
            },
            end: {
              dateTime: this.safeFormatDateTime(action.data.endTime),
              timeZone: 'Asia/Shanghai'
            },
            location: action.data.location ? { displayName: action.data.location } : undefined,
            isAllDay: action.data.isAllDay || false
          };
          
          // 🔍 [FIXED] 获取目标日历ID - 数组格式处理
          
          // 🔧 优先从 tags 数组中获取第一个标签的日历映射
          if (action.data.tags && Array.isArray(action.data.tags) && action.data.tags.length > 0) {
            const mappedCalendarId = this.getCalendarIdForTag(action.data.tags[0]);
            if (mappedCalendarId) {
              syncTargetCalendarId = mappedCalendarId;
              // console.log('🔍 [SYNC] Using calendar from tag mapping:', {
              //   tagId: action.data.tags[0],
              //   mappedCalendarId,
              //   eventTitle: action.data.title
              // });
            }
          }
          
          // 🔧 如果没有标签映射，从 calendarIds 数组中获取第一个日历ID
          if (!syncTargetCalendarId && action.data.calendarIds && Array.isArray(action.data.calendarIds) && action.data.calendarIds.length > 0) {
            syncTargetCalendarId = action.data.calendarIds[0];
            // console.log('🔍 [SYNC] Using direct calendar ID from array:', syncTargetCalendarId);
          }
          
          // console.log('🔍 [SYNC] Calendar ID resolution:', {
          //   eventId: action.entityId,
          //   eventTitle: action.data.title,
          //   calendarIds: action.data.calendarIds,
          //   tags: action.data.tags,
          //   finalCalendarId: syncTargetCalendarId
          // });
          
          // 🚨 只有在真的没有任何日历信息时才使用默认日历（全新创建的事件）
          if (!syncTargetCalendarId) {
      // console.log('🔍 [SYNC] No calendar ID at all (new event), using default calendar');
            syncTargetCalendarId = this.microsoftService.getSelectedCalendarId();
          }
          
          // 🔧 [NEW] 验证目标日历是否存在，不存在则降级到默认日历
          const isCalendarValid = await this.microsoftService.validateCalendarExists(syncTargetCalendarId);
          
          if (!isCalendarValid) {
            let fallbackCalendarId = this.microsoftService.getSelectedCalendarId();
            
            // 🔧 如果选定日历也无效或为null，获取实际默认日历
            if (!fallbackCalendarId) {
              try {
                const defaultCalendar = await this.microsoftService.getDefaultCalendar();
                fallbackCalendarId = defaultCalendar.id;
                // 保存为默认选择
                this.microsoftService.setSelectedCalendar(fallbackCalendarId);
                console.log('📅 [CALENDAR FALLBACK] Auto-set default calendar:', fallbackCalendarId);
              } catch (error) {
                console.error('❌ [CALENDAR FALLBACK] Failed to get default calendar:', error);
                throw new Error('无法获取默认日历，请检查网络连接或重新登录');
              }
            }
            
            console.warn('⚠️ [CALENDAR VALIDATION] Target calendar not found, falling back to default:', {
              invalidCalendarId: syncTargetCalendarId,
              fallbackCalendarId: fallbackCalendarId,
              eventTitle: action.data.title,
              eventId: action.entityId
            });
            
            // 发送通知给用户（确保参数都是 string 类型）
            this.showCalendarFallbackNotification(
              action.data.title || '未命名事件', 
              syncTargetCalendarId || 'unknown', 
              fallbackCalendarId
            );
            
            // 使用默认日历
            syncTargetCalendarId = fallbackCalendarId;
          }
          
          // 🔧 最后检查：确保有有效的日历ID
          if (!syncTargetCalendarId) {
            throw new Error('无法确定目标日历ID，事件同步失败');
          }
          
          const newEventId = await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId);
          
          if (newEventId) {
            this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
            return true;
          }
          break;

        case 'update':
          // 🚨 [REBUILT] 重构的 UPDATE 逻辑 - 按用户要求的5级优先级结构
          // 📊 [PRIORITY 0] 最高优先级：用户数据保护 - 保存操作到本地永久存储
          try {
            // 1. 获取当前本地事件数据
            const priorityLocalEvents = this.getLocalEvents();
            const eventIndex = priorityLocalEvents.findIndex((e: any) => e.id === action.entityId);
            
            if (eventIndex !== -1) {
              // 2. 创建备份并更新本地数据
              const backupEvent = {
                ...priorityLocalEvents[eventIndex],
                lastBackupAt: new Date(),
                backupReason: 'update-operation'
              };
              
              // 3. 确保用户修改立即保存到本地
              const oldEvent = { ...priorityLocalEvents[eventIndex] };
              const updatedEvent = {
                ...priorityLocalEvents[eventIndex],
                ...action.data,
                updatedAt: new Date(),
                lastLocalEdit: new Date(),
                syncStatus: 'pending' // 🔧 [Unified] 统一使用 'pending'，不再区分 update
              };
              
              priorityLocalEvents[eventIndex] = updatedEvent;
              
              // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
              this.updateEventInIndex(updatedEvent, oldEvent);
              this.saveLocalEvents(priorityLocalEvents, false); // rebuildIndex=false
            }
          } catch (storageError) {
            console.error('❌ [PRIORITY 0] Failed to save user data locally:', storageError);
            // 即使本地保存失败，也要继续同步，但添加冲突标记
            const currentTitle = action.data.title?.simpleTitle || '';
            if (!currentTitle.includes('⚠️同步冲突')) {
              action.data.title = { simpleTitle: '⚠️同步冲突 - ' + currentTitle, fullTitle: undefined, colorTitle: undefined };
            }
          }

          // 🔍 [PRIORITY 1] 最高优先级：检查事件基础状态
          // 1️⃣ 编辑锁定检查 - 对于UPDATE操作，清除之前的锁定以允许远程同步
          const lockStatus = this.editLocks.get(action.entityId);
          const currentTime = Date.now();
          
          if (this.isEditLocked(action.entityId)) {
            this.clearEditLock(action.entityId);
          } else {
          }
          
          // 为当前更新操作设置编辑锁定
          this.setEditLock(action.entityId, 15000); // 15秒锁定期
          // 2️⃣ ExternalId 检查 - 决定是 UPDATE 还是 CREATE
          // 🔧 关键修复：从本地存储的事件中获取externalId，因为前端data通常不包含externalId
          const updateLocalEvents = this.getLocalEvents();
          const currentLocalEvent = updateLocalEvents.find((e: any) => e.id === action.entityId);
          
          let cleanExternalId = action.data.externalId || 
                               action.originalData?.externalId || 
                               currentLocalEvent?.externalId; // 🔧 从本地事件获取externalId
          
          if (cleanExternalId && cleanExternalId.startsWith('outlook-')) {
            cleanExternalId = cleanExternalId.replace('outlook-', '');
          }
          // 🔄 如果没有 externalId，转为 CREATE 操作（首次同步）
          if (!cleanExternalId) {
      // console.log('🔄 [PRIORITY 1] No externalId found - Converting UPDATE → CREATE (first-time sync)');
            
            // 执行 CREATE 逻辑（复用现有的 create 分支逻辑）
            
            // 🔍 [NEW] 检查是否有旧的 externalId 需要清理（可能在其他日历中存在）
            // 这种情况可能发生在标签映射更改导致事件需要迁移到新日历时
            if (action.originalData?.externalId) {
              let oldExternalId = action.originalData.externalId;
              if (oldExternalId.startsWith('outlook-')) {
                oldExternalId = oldExternalId.replace('outlook-', '');
              }
              try {
                await this.microsoftService.deleteEvent(oldExternalId);
              } catch (error) {
                console.warn('⚠️ [SYNC UPDATE → CREATE] Failed to delete old event (may not exist):', error);
                // 继续执行，不影响新事件的创建
              }
            }
            
            // 🔍 [FIXED] 获取目标日历ID - 数组格式处理（UPDATE → CREATE转换）
            
            // 🔧 优先从 tags 数组中获取第一个标签的日历映射
            if (action.data.tags && Array.isArray(action.data.tags) && action.data.tags.length > 0) {
              const mappedCalendarId = this.getCalendarIdForTag(action.data.tags[0]);
              if (mappedCalendarId) {
                syncTargetCalendarId = mappedCalendarId;
                // console.log('🔍 [SYNC-UPDATE] Using calendar from tag mapping:', {
                //   tagId: action.data.tags[0],
                //   mappedCalendarId,
                //   eventTitle: action.data.title
                // });
              }
            }
            
            // 🔧 如果没有标签映射，从 calendarIds 数组中获取第一个日历ID
            if (!syncTargetCalendarId && action.data.calendarIds && Array.isArray(action.data.calendarIds) && action.data.calendarIds.length > 0) {
              syncTargetCalendarId = action.data.calendarIds[0];
              // console.log('🔍 [SYNC-UPDATE] Using direct calendar ID from array:', syncTargetCalendarId);
            }
            
            // 🚨 只有在真的没有任何日历信息时才使用默认日历
            if (!syncTargetCalendarId) {
              syncTargetCalendarId = this.microsoftService.getSelectedCalendarId();
            }
            // 🔍 [NEW] 构建事件描述，保持原有的创建时间记录
            const originalCreateTime = this.extractOriginalCreateTime(action.data.description || '');
            const createDescription = this.processEventDescription(
              action.data.description || '',
              'remarkable',
              'create',
              {
                ...action.data,
                // 如果有原始创建时间，保持它；否则使用当前时间
                preserveOriginalCreateTime: originalCreateTime
              }
            );
            
            // 构建事件对象
            const eventData = {
              subject: action.data.title,
              body: { 
                contentType: 'text', 
                content: createDescription
              },
              start: {
                dateTime: this.safeFormatDateTime(action.data.startTime),
                timeZone: 'Asia/Shanghai'
              },
              end: {
                dateTime: this.safeFormatDateTime(action.data.endTime),
                timeZone: 'Asia/Shanghai'
              },
              location: action.data.location ? { displayName: action.data.location } : undefined,
              isAllDay: action.data.isAllDay || false
            };
            
            // 🔧 确保有有效的日历ID
            if (!syncTargetCalendarId) {
              throw new Error('无法确定目标日历ID，事件同步失败');
            }
            
            const newEventId = await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId);
            
            if (newEventId) {
              this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
              if (syncTargetCalendarId) {
                this.updateLocalEventCalendarId(action.entityId, syncTargetCalendarId);
              }
              this.clearEditLock(action.entityId);
              // 📝 状态栏反馈
              window.dispatchEvent(new CustomEvent('sync-status-update', {
                detail: { message: `✅ 已创建1个事件到Outlook: ${syncTargetCalendarId}` }
              }));
              return true;
            } else {
              this.clearEditLock(action.entityId);
              console.error('❌ [PRIORITY 1] UPDATE → CREATE failed');
              return false;
            }
          }
          
          // 🏷️ [PRIORITY 2] 高优先级：标签日历映射检查（智能迁移）
          const currentCalendarId = action.data.calendarId;
          let needsCalendarMigration = false;
          syncTargetCalendarId = currentCalendarId;
          
          // 🎯 确定要检查的标签ID（优先使用 tags 数组的第一个标签）
          let tagToCheck = action.data.tagId;
          if (action.data.tags && action.data.tags.length > 0) {
            tagToCheck = action.data.tags[0];
          }
          
          // 🔍 获取原始事件的标签（用于比较）
          let originalTagToCheck = action.originalData?.tagId;
          if (action.originalData?.tags && action.originalData.tags.length > 0) {
            originalTagToCheck = action.originalData.tags[0];
          }
          
          if (tagToCheck) {
            const mappedCalendarId = this.getCalendarIdForTag(tagToCheck);
            
            // 🎯 获取原始标签映射的日历（如果标签没变，就不需要迁移）
            let originalMappedCalendarId = currentCalendarId;
            if (originalTagToCheck) {
              originalMappedCalendarId = this.getCalendarIdForTag(originalTagToCheck) || currentCalendarId;
            }
            
            // ✅ 智能迁移检测：只有当新旧映射的日历真的不同时才迁移
            if (mappedCalendarId && mappedCalendarId !== originalMappedCalendarId) {
              needsCalendarMigration = true;
              syncTargetCalendarId = mappedCalendarId;
              
              try {
                // 删除原日历中的事件
                await this.microsoftService.deleteEvent(cleanExternalId);
              } catch (deleteError) {
                console.error('❌ [PRIORITY 2] Calendar migration failed:', deleteError);
                // 迁移失败，继续执行普通更新
                needsCalendarMigration = false;
              }
              
              try {
                // 在新日历中创建事件（相当于迁移）
                const migrateDescription = this.processEventDescription(
                  action.data.description || '',
                  'remarkable',
                  'update',
                  action.data
                );
                
                const migrateEventData = {
                  subject: action.data.title,
                  body: { 
                    contentType: 'text', 
                    content: migrateDescription
                  },
                  start: {
                    dateTime: this.safeFormatDateTime(action.data.startTime),
                    timeZone: 'Asia/Shanghai'
                  },
                  end: {
                    dateTime: this.safeFormatDateTime(action.data.endTime),
                    timeZone: 'Asia/Shanghai'
                  },
                  location: action.data.location ? { displayName: action.data.location } : undefined,
                  isAllDay: action.data.isAllDay || false
                };
                const newEventId = await this.microsoftService.syncEventToCalendar(migrateEventData, syncTargetCalendarId);
                
                if (newEventId) {
                  // 🔧 确保external ID有正确的前缀格式
                  const formattedExternalId = `outlook-${newEventId}`;
                  this.updateLocalEventExternalId(action.entityId, formattedExternalId, migrateDescription);
                  this.updateLocalEventCalendarId(action.entityId, syncTargetCalendarId);
                  this.clearEditLock(action.entityId);
                  // 📝 状态栏反馈
                  window.dispatchEvent(new CustomEvent('sync-status-update', {
                    detail: { message: `🔄 已迁移1个事件到日历: ${syncTargetCalendarId}` }
                  }));
                  return true;
                }
              } catch (migrationError) {
                console.error('❌ [PRIORITY 2] Calendar migration failed:', migrationError);
                // 迁移失败，继续执行普通更新
                needsCalendarMigration = false;
              }
            } else if (mappedCalendarId && mappedCalendarId === originalMappedCalendarId) {
              // ✅ 标签变了，但映射的日历没变，不需要迁移
              syncTargetCalendarId = mappedCalendarId;
            } else if (mappedCalendarId && !cleanExternalId) {
              // 如果事件还没有同步到 Outlook，只更新本地的 calendarId
              this.updateLocalEventCalendarId(action.entityId, mappedCalendarId);
            }
          }
          
          // 📝 [PRIORITY 3] 中等优先级：字段更新处理
          // 3️⃣ 构建更新数据
          const updateData: any = {};
          
          // 📝 文本字段处理
          if (action.data.title) {
            updateData.subject = action.data.title;
          }
          
          // 描述处理：添加同步备注管理
          if (action.data.description !== undefined) {
            const updateDescription = this.processEventDescription(
              action.data.description || '',
              'remarkable',
              'update',
              action.data
            );
            updateData.body = { contentType: 'text', content: updateDescription };
          }
          
          if (action.data.location !== undefined) {
            if (action.data.location) {
              updateData.location = { displayName: action.data.location };
            } else {
              updateData.location = null; // 清空位置
            }
          }
          
          
          // ⏰ 时间字段处理
          if (action.data.startTime && action.data.endTime) {
            try {
              const startDateTime = this.safeFormatDateTime(action.data.startTime);
              const endDateTime = this.safeFormatDateTime(action.data.endTime);
              
              // 时间验证
              const startDate = new Date(startDateTime);
              const endDate = new Date(endDateTime);
              
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date values');
              }
              
              if (endDate <= startDate) {
                throw new Error('End time must be after start time');
              }
              
              updateData.start = { dateTime: startDateTime, timeZone: 'Asia/Shanghai' };
              updateData.end = { dateTime: endDateTime, timeZone: 'Asia/Shanghai' };
            } catch (timeError) {
              console.error('❌ [PRIORITY 3] Time validation failed:', timeError);
              this.clearEditLock(action.entityId);
              throw new Error(`Time update failed: ${timeError instanceof Error ? timeError.message : 'Invalid time data'}`);
            }
          }
          
          // 🏷️ 元数据字段处理
          if (typeof action.data.isAllDay === 'boolean') {
            updateData.isAllDay = action.data.isAllDay;
          }
          
          // 🎯 [PRIORITY 4] 标准优先级：执行更新操作
          
          try {
            const updateResult = await this.microsoftService.updateEvent(cleanExternalId, updateData);
            
            if (updateResult) {
              this.clearEditLock(action.entityId);
              // 📝 状态栏反馈
              window.dispatchEvent(new CustomEvent('sync-status-update', {
                detail: { message: `✅ 已更新1个事件到Outlook: ${syncTargetCalendarId || 'Default'}` }
              }));
              return true;
            }
          } catch (updateError) {
            console.error('❌ [PRIORITY 4] Update operation failed:', updateError);
            
            // 🔧 错误处理：事件不存在时转为 CREATE
            if (updateError instanceof Error && updateError.message.includes('Event not found')) {
              try {
                  // 🔍 [FIXED] 获取重建事件的日历ID - 按需求定义处理
                let createCalendarId = syncTargetCalendarId;
                
                // 🔧 优先从 tags 数组中获取标签映射的日历ID
                if (action.data.tags && Array.isArray(action.data.tags) && action.data.tags.length > 0) {
                  const mappedCalendarId = this.getCalendarIdForTag(action.data.tags[0]);
                  if (mappedCalendarId) {
                    createCalendarId = mappedCalendarId;
                    // console.log('🔍 [SYNC-RECREATE] Using calendar from tag mapping:', {
                    //   tagId: action.data.tags[0],
                    //   mappedCalendarId,
                    //   eventTitle: action.data.title
                    // });
                  }
                }
                
                // 🔧 如果没有标签映射，从 calendarIds 数组中获取日历ID
                if (!createCalendarId && action.data.calendarIds && Array.isArray(action.data.calendarIds) && action.data.calendarIds.length > 0) {
                  createCalendarId = action.data.calendarIds[0];
                  // console.log('🔍 [SYNC-RECREATE] Using direct calendar ID from array:', createCalendarId);
                }
                
                // 🚨 只有在真的没有任何日历信息时才使用默认日历
                if (!createCalendarId) {
                  createCalendarId = this.microsoftService.getSelectedCalendarId();
                }
              
                
                const recreateDescription = this.processEventDescription(
                  action.data.description || '',
                  'remarkable',
                  'create',
                  action.data
                );
                
                const recreateEventData = {
                  subject: action.data.title,
                  body: { 
                    contentType: 'text', 
                    content: recreateDescription
                  },
                  start: {
                    dateTime: this.safeFormatDateTime(action.data.startTime),
                    timeZone: 'Asia/Shanghai'
                  },
                  end: {
                    dateTime: this.safeFormatDateTime(action.data.endTime),
                    timeZone: 'Asia/Shanghai'
                  },
                location: action.data.location ? { displayName: action.data.location } : undefined,
                isAllDay: action.data.isAllDay || false
              };
              
                // 🔧 确保有有效的日历ID
                if (!createCalendarId) {
                  throw new Error('无法确定创建目标日历ID，事件重建失败');
                }
                
                const recreatedEventId = await this.microsoftService.syncEventToCalendar(recreateEventData, createCalendarId);
                
                if (recreatedEventId) {
                  this.updateLocalEventExternalId(action.entityId, recreatedEventId, recreateDescription);
                  if (createCalendarId) {
                    this.updateLocalEventCalendarId(action.entityId, createCalendarId);
                  }
                  this.clearEditLock(action.entityId);
                  // 📝 状态栏反馈
                  window.dispatchEvent(new CustomEvent('sync-status-update', {
                    detail: { message: `🔄 已重新创建1个事件: ${createCalendarId || 'Default'}` }
                  }));
                  return true;
                }
              } catch (recreateError) {
                console.error('❌ [PRIORITY 4] Failed to recreate event:', recreateError);
              }
            }
            
            
            // 🔧 尝试最小更新（仅标题和描述）
      // console.log('🔧 [PRIORITY 4] Attempting minimal update (title + description only)...');
            try {
              const minimalUpdate = {
                subject: action.data.title,
                body: { 
                  contentType: 'text', 
                  content: action.data.description || '📱 由 ReMarkable 更新'
                }
              };
              
              const minimalResult = await this.microsoftService.updateEvent(cleanExternalId, minimalUpdate);
              
              if (minimalResult) {
                this.clearEditLock(action.entityId);
                // 📝 状态栏反馈
                window.dispatchEvent(new CustomEvent('sync-status-update', {
                  detail: { message: `⚠️ 已部分更新1个事件 (仅标题和描述)` }
                }));
                return true;
              }
            } catch (minimalError) {
              console.error('❌ [PRIORITY 4] Even minimal update failed:', minimalError);
            }
            
            // 🚨 最终错误处理：保持本地数据，标记同步冲突
            this.clearEditLock(action.entityId);
            console.error('🚨 [PRIORITY 4] All update attempts failed, marking as sync conflict');
            
            // 更新本地事件，添加同步冲突标记
            const conflictLocalEvents = this.getLocalEvents();
            const conflictEventIndex = conflictLocalEvents.findIndex((e: any) => e.id === action.entityId);
            if (conflictEventIndex !== -1) {
              const currentTitle = conflictLocalEvents[conflictEventIndex].title?.simpleTitle || '';
              if (!currentTitle.includes('⚠️同步冲突')) {
                const oldConflictEvent = { ...conflictLocalEvents[conflictEventIndex] };
                
                conflictLocalEvents[conflictEventIndex].title = { simpleTitle: '⚠️同步冲突 - ' + currentTitle, fullTitle: undefined, colorTitle: undefined };
                conflictLocalEvents[conflictEventIndex].syncStatus = 'conflict';
                conflictLocalEvents[conflictEventIndex].lastSyncError = updateError instanceof Error ? updateError.message : 'Unknown error';
                
                // 🔧 [IndexMap 优化] 更新冲突事件索引
                this.updateEventInIndex(conflictLocalEvents[conflictEventIndex], oldConflictEvent);
                this.saveLocalEvents(conflictLocalEvents, false); // rebuildIndex=false
                
                // 📝 状态栏反馈
                window.dispatchEvent(new CustomEvent('sync-status-update', {
                  detail: { message: `⚠️ 同步冲突: 已保护本地数据` }
                }));
              }
            }
            
            throw updateError;
          }

          // 📊 [PRIORITY 5] 低优先级：后续处理（已在上面的成功分支中处理）
          break;

        case 'delete':
          // 🔍 首先检查本地存储中的externalId（类似UPDATE的逻辑）
          const deleteLocalEvents = this.getLocalEvents();
          const deleteTargetEvent = deleteLocalEvents.find((e: any) => e.id === action.entityId);
          
          let externalIdToDelete = action.originalData?.externalId || 
                                  action.data?.externalId || 
                                  deleteTargetEvent?.externalId;
          
          // 🔧 [FIX] 无论是否有 externalId，都将本地 eventId 添加到 deletedEventIds
          // 防止同步队列中的创建动作恢复已删除的本地事件
          this.deletedEventIds.add(action.entityId);
          
          if (externalIdToDelete) {
            // 清理externalId，移除可能的前缀
            let cleanExternalId = externalIdToDelete;
            if (cleanExternalId.startsWith('outlook-')) {
              cleanExternalId = cleanExternalId.replace('outlook-', '');
            }
            try {
              await this.microsoftService.deleteEvent(cleanExternalId);
              // 🆕 添加到已删除事件ID跟踪
              this.deletedEventIds.add(cleanExternalId);
              this.deletedEventIds.add(externalIdToDelete); // 也添加原始格式
              this.saveDeletedEventIds();
              // 📝 状态栏反馈
              window.dispatchEvent(new CustomEvent('sync-status-update', {
                detail: { message: `✅ 已从Outlook删除事件: ${deleteTargetEvent?.title || 'Unknown'}` }
              }));
              
              return true;
            } catch (error) {
              console.error('❌ [DELETE] Failed to delete event from Outlook:', {
                error: error,
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                externalId: cleanExternalId
              });
              
              // 📝 状态栏反馈
              window.dispatchEvent(new CustomEvent('sync-status-update', {
                detail: { message: `❌ 删除失败: ${error instanceof Error ? error.message : '未知错误'}` }
              }));
              
              // 🔧 [FIX] 即使远程删除失败，也保存 deletedEventIds（防止本地恢复）
              this.saveDeletedEventIds();
              
              return false;
            }
          } else {
            // 🔧 [FIX] 本地事件删除，也需要保存到 deletedEventIds
            this.saveDeletedEventIds();
            
            // 📝 状态栏反馈
            window.dispatchEvent(new CustomEvent('sync-status-update', {
              detail: { message: `⚠️ 仅本地删除 (事件未同步到Outlook)` }
            }));
            
            return true; // 本地删除成功，即使没有远程ID
          }
      }
      
      return false; // 默认返回值，如果没有匹配的action type
    } catch (error) {
      console.error('❌ Failed to apply local action to remote:', error);
      return false;
    }
  }

  // 🔧 改进时间格式化方法，支持 Graph API 要求的格式 - 修复时区问题
  private safeFormatDateTime(dateInput: any): string {
    try {
      if (!dateInput) {
        return formatTimeForStorage(new Date()); // 🔧 使用本地时间格式化
      }
      
      // 如果已经是正确格式，直接返回
      if (typeof dateInput === 'string' && dateInput.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
        return dateInput;
      }
      
      // 🔧 使用formatTimeForStorage避免时区转换问题
      return formatTimeForStorage(dateInput);
      
    } catch (error) {
      console.error('❌ safeFormatDateTime error:', error);
      return formatTimeForStorage(new Date()); // 🔧 使用本地时间格式化
    }
  }

  private async applyRemoteActionToLocal(
    action: SyncAction, 
    triggerUI: boolean = true, 
    localEvents?: any[]
  ): Promise<any[]> {
    if (action.entityType !== 'event') return localEvents || this.getLocalEvents();

    // 🚀 批量模式：如果传入了localEvents，说明是批量处理，不立即保存
    const isBatchMode = !!localEvents;
    const events = localEvents || this.getLocalEvents();

    switch (action.type) {
      case 'create':
        const newEvent = this.convertRemoteEventToLocal(action.data);
        
        // 🔧 [FIX] 检查是否是已删除的事件，如果是则跳过创建
        const cleanNewEventId = newEvent.id.startsWith('outlook-') ? newEvent.id.replace('outlook-', '') : newEvent.id;
        const isDeletedEvent = this.deletedEventIds.has(cleanNewEventId) || 
                               this.deletedEventIds.has(newEvent.id) ||
                               (newEvent.externalId && this.deletedEventIds.has(newEvent.externalId));
        
        if (isDeletedEvent) {
          console.log(`⏭️ [Sync] 跳过创建已删除的事件: ${newEvent.title}`);
          return events; // 跳过创建
        }
        
        // 📝 [STEP 1] 优先通过 externalId 查找现有事件（从 IndexMap）
        // newEvent.externalId 是纯 Outlook ID（没有 outlook- 前缀）
        let existingEvent = this.eventIndexMap.get(newEvent.externalId);
        
        // 🔧 [CRITICAL FIX] 如果 IndexMap 没找到，再检查 events 数组（防止 IndexMap 失效）
        if (!existingEvent && newEvent.externalId) {
          existingEvent = events.find((e: any) => 
            e.externalId === newEvent.externalId || 
            e.externalId === `outlook-${newEvent.externalId}` ||
            `outlook-${e.externalId}` === newEvent.externalId
          );
          
          if (existingEvent) {
            console.warn(`⚠️ [IndexMap Mismatch] Found duplicate via array search but not in IndexMap: ${newEvent.externalId.substring(0, 20)}...`);
            // 修复 IndexMap
            this.updateEventInIndex(existingEvent);
          }
        }
        
        // 🎯 [STEP 2] 如果没找到，尝试通过 ReMarkable 创建签名匹配本地事件
        // 场景：本地事件刚同步到 Outlook，本地还没有 externalId，Outlook 返回时需要匹配本地事件
        if (!existingEvent && newEvent.remarkableSource) {
          const createTime = this.extractOriginalCreateTime(newEvent.description);
          
          if (createTime) {
            // 🔍 先尝试匹配 Timer 事件
            existingEvent = events.find((e: any) => 
              e.isTimer &&                    // ✅ 必须是 Timer 事件
              !e.externalId &&                 // ✅ 还没有同步过(没有 externalId)
              e.remarkableSource === true &&   // ✅ ReMarkable 创建的
              Math.abs(new Date(e.createdAt).getTime() - createTime.getTime()) < 1000 // ✅ 创建时间匹配(1秒容差)
            );
            
            if (existingEvent) {
              console.log(`🎯 [Timer Dedupe] 通过 ReMarkable 签名匹配到本地 Timer 事件:`, {
                localId: existingEvent.id,
                remoteId: newEvent.externalId,
                title: newEvent.title,
                createTime: formatTimeForStorage(createTime)
              });
            }
            
            // 🆕 如果没有匹配到 Timer 事件，尝试匹配普通事件
            if (!existingEvent) {
              existingEvent = events.find((e: any) => 
                !e.isTimer &&                   // ✅ 非 Timer 事件
                !e.externalId &&                // ✅ 还没有同步过(没有 externalId)
                (e.remarkableSource === true || e.id.startsWith('local-')) && // ✅ ReMarkable 创建的或本地创建的
                e.title === newEvent.title &&   // ✅ 标题匹配
                Math.abs(new Date(e.createdAt).getTime() - createTime.getTime()) < 5000 // ✅ 创建时间匹配(5秒容差)
              );
              
              if (existingEvent) {
                console.log(`🎯 [Event Dedupe] 通过 ReMarkable 签名匹配到本地事件:`, {
                  localId: existingEvent.id,
                  remoteId: newEvent.externalId,
                  title: newEvent.title,
                  createTime: formatTimeForStorage(createTime)
                });
              }
            }
          }
        }
        
        if (!existingEvent) {
          // 🆕 真正的新事件，添加到列表
          events.push(newEvent);
          
          // 🔧 [IndexMap 优化] 使用统一的增量更新方法
          this.updateEventInIndex(newEvent);
          
          // 🚀 只在非批量模式下立即保存，使用增量更新
          if (!isBatchMode) {
            this.saveLocalEvents(events, false); // rebuildIndex=false
          }
          if (triggerUI) {
            this.triggerUIUpdate('create', newEvent);
          }
        } else {
          // ✅ 找到现有事件（如 Timer 事件），更新而不是创建
          
          const eventIndex = events.findIndex((e: any) => e.id === existingEvent.id);
          if (eventIndex !== -1) {
            const oldEvent = { ...events[eventIndex] };
            
            // 🔧 保留本地事件的 ID 和关键字段，只更新 Outlook 数据
            events[eventIndex] = {
              ...newEvent,
              id: existingEvent.id,  // 保留本地 ID（如 timer-tag-...）
              tagId: existingEvent.tagId || newEvent.tagId,  // 保留 tagId
              eventlog: existingEvent.eventlog || newEvent.eventlog,  // 🆕 保留本地的 eventlog 字段（富文本）
              syncStatus: 'synced',  // 标记为已同步
            };
            
            // 🔧 [IndexMap 优化] 更新索引
            this.updateEventInIndex(events[eventIndex], oldEvent);
            
            // 🚀 只在非批量模式下立即保存
            if (!isBatchMode) {
              this.saveLocalEvents(events, false);
            }
            if (triggerUI) {
              this.triggerUIUpdate('update', events[eventIndex]);
            }
          }
        }
        break;

      case 'update':
        // Processing update action for event
        
        // 🔧 对于本地发起的远程更新回写，不检查编辑锁定
        // 只有真正的远程冲突更新才需要锁定保护
        if (action.source === 'outlook' && this.isEditLocked(action.entityId)) {
          return events; // 跳过此次更新
        }
        
        const eventIndex = events.findIndex((e: any) => e.id === action.entityId);
        if (eventIndex !== -1) {
          const oldEvent = { ...events[eventIndex] };
          
          // 尝试多个可能的描述字段
          const htmlContent = action.data.body?.content || 
                             action.data.description || 
                             action.data.bodyPreview || 
                             '';
          
          // Processing update details
          
          const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync', action.data);
          
          // Description processing completed
          
          const updatedEvent = {
            ...events[eventIndex], // 🔧 保留所有原有字段（包括source和calendarId）
            title: action.data.subject || '',
            description: cleanDescription, // 直接使用清理后的内容，不添加同步备注
            // eventlog: 🆕 不更新 eventlog，保留本地的富文本内容
            startTime: this.safeFormatDateTime(action.data.start?.dateTime || action.data.start),
            endTime: this.safeFormatDateTime(action.data.end?.dateTime || action.data.end),
            location: action.data.location?.displayName || '',
            isAllDay: action.data.isAllDay || false,
            updatedAt: new Date(),
            lastSyncTime: new Date(),
            syncStatus: 'synced'
            // 🔧 不覆盖 source, calendarId, externalId, eventlog 等字段
          };
          
          events[eventIndex] = updatedEvent;
          
          // 🔧 [IndexMap 优化] 更新事件索引
          this.updateEventInIndex(updatedEvent, oldEvent);
          
          // 🚀 只在非批量模式下立即保存，使用增量更新
          if (!isBatchMode) {
            this.saveLocalEvents(events, false); // rebuildIndex=false
          }
          
          // Event updated successfully
          
          if (triggerUI) {
            this.triggerUIUpdate('update', updatedEvent);
          }
        } else {
        }
        break;

      case 'delete':
        const eventToDeleteIndex = events.findIndex((e: any) => e.id === action.entityId);
        if (eventToDeleteIndex !== -1) {
          const eventToDelete = events[eventToDeleteIndex];
          // 🔧 [IndexMap 优化] 删除前从索引中移除
          this.removeEventFromIndex(eventToDelete);
          
          events.splice(eventToDeleteIndex, 1);
          
          // 🚀 只在非批量模式下立即保存，使用增量更新
          if (!isBatchMode) {
            this.saveLocalEvents(events, false); // rebuildIndex=false
          }
          
          if (triggerUI) {
            this.triggerUIUpdate('delete', { id: action.entityId, title: eventToDelete.title });
          }
          if (!isBatchMode) {
          }
        } else {
        }
        break;
    }
    
    // 🚀 返回修改后的events（用于批量模式）
    return events;
  }

  private triggerUIUpdate(actionType: string, eventData: any) {
    // ✅ 架构清理：triggerUIUpdate 已废弃
    // EventService 的 CRUD 操作已经触发 eventsUpdated 事件
    // 这里不需要重复触发，避免双重通知
    
    console.log('⏭️ [triggerUIUpdate] Skipping - EventService already triggered eventsUpdated:', {
      action: actionType,
      eventId: eventData?.id
    });
    
    // ❌ 已移除：local-events-changed 事件（已废弃）
    // ❌ 已移除：outlook-sync-completed 事件（不应该在每个操作时触发）
    // ❌ 已移除：action-sync-completed 事件（不应该在每个操作时触发）
  }

  private async resolveConflicts() {
    const localActions = this.actionQueue.filter(a => a.source === 'local' && !a.synchronized);
    const remoteActions = this.actionQueue.filter(a => a.source === 'outlook' && !a.synchronized);

    for (const localAction of localActions) {
      const conflictingRemoteAction = remoteActions.find(
        remote => remote.entityId === localAction.entityId && 
                 Math.abs(remote.timestamp.getTime() - localAction.timestamp.getTime()) < 60000
      );

      if (conflictingRemoteAction) {
        const conflict: SyncConflict = {
          localAction,
          remoteAction: conflictingRemoteAction,
          resolutionStrategy: this.determineConflictResolution(localAction, conflictingRemoteAction)
        };

        await this.resolveConflict(conflict);
      }
    }
  }

  private determineConflictResolution(localAction: SyncAction, remoteAction: SyncAction): 'local-wins' | 'remote-wins' | 'merge' | 'manual' {
    if (localAction.timestamp > remoteAction.timestamp) {
      return 'local-wins';
    } else {
      return 'remote-wins';
    }
  }

  private async resolveConflict(conflict: SyncConflict) {
    switch (conflict.resolutionStrategy) {
      case 'local-wins':
        await this.applyLocalActionToRemote(conflict.localAction);
        conflict.localAction.synchronized = true;
        conflict.remoteAction.synchronized = true;
        break;

      case 'remote-wins':
        await this.applyRemoteActionToLocal(conflict.remoteAction);
        conflict.remoteAction.synchronized = true;
        conflict.localAction.synchronized = true;
        break;

      case 'merge':
        await this.mergeConflictingActions(conflict.localAction, conflict.remoteAction);
        break;

      case 'manual':
        this.conflictQueue.push(conflict);
        this.saveConflictQueue();
        break;
    }

    this.saveActionQueue();
  }

  private async mergeConflictingActions(localAction: SyncAction, remoteAction: SyncAction) {
    // 实现智能合并逻辑
  }

  private cleanupSynchronizedActions() {
    const before = this.actionQueue.length;
    
    this.actionQueue = this.actionQueue.filter(action => {
      if (action.synchronized) return false;
      if (action.retryCount >= 3) return false;
      return true;
    });
    
    const after = this.actionQueue.length;
    
    if (before !== after) {
      this.saveActionQueue();
    }
  }

  private getLocalEvents() {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const events = stored ? JSON.parse(stored) : [];
      
      // 🔧 [FIX] 只在 IndexMap 为空时才重建（避免每次都重建）
      // 正常情况下使用增量更新 updateEventInIndex()
      if (this.eventIndexMap.size === 0 && events.length > 0) {
        this.rebuildEventIndexMapAsync(events).catch(err => {
          console.error('❌ [IndexMap] Async rebuild failed:', err);
        });
      }
      
      return events;
    } catch {
      return [];
    }
  }

  // 🚀 Rebuild the event index map from events array
  // 🔧 [FIX] 优化：使用临时 Map，避免清空现有 Map 导致查询失败
  // 🚀 异步分批重建 IndexMap，避免阻塞主线程
  private async rebuildEventIndexMapAsync(events: any[], visibleEventIds?: string[]): Promise<void> {
    // 🔧 [CRITICAL] 记录重建 Promise，允许其他操作等待
    this.indexMapRebuildPromise = (async () => {
      const startTime = performance.now();
      console.log(`🔨 [IndexMap REBUILD] Starting rebuild for ${events.length} events at ${performance.now().toFixed(2)}ms`);
      let BATCH_SIZE = 200; // 初始批大小：200 个事件
      const MAX_BATCH_TIME = 10; // 每批最多 10ms
      const TARGET_FIRST_BATCH_TIME = 5; // 首批目标时间：5ms（留余量）
      // 🎯 优先处理可视区域的事件
      let priorityEvents: any[] = [];
      let remainingEvents: any[] = [];
    
      if (visibleEventIds && visibleEventIds.length > 0) {
        const visibleSet = new Set(visibleEventIds);
        events.forEach(event => {
          if (visibleSet.has(event.id)) {
            priorityEvents.push(event);
          } else {
            remainingEvents.push(event);
          }
        });
      } else {
        remainingEvents = events;
      }
    
      // 🔧 分批处理函数（带性能监控）
      const processBatch = (batchEvents: any[], batchIndex: number): number => {
        const batchStart = performance.now();
      
        batchEvents.forEach(event => {
          if (event.id) {
            this.eventIndexMap.set(event.id, event);
          }
          if (event.externalId) {
            // 优先保留 Timer 事件的 externalId 索引
            const existing = this.eventIndexMap.get(event.externalId);
            if (!existing || event.id.startsWith('timer-')) {
              this.eventIndexMap.set(event.externalId, event);
            }
          }
        });
      
        const batchDuration = performance.now() - batchStart;
        if (batchIndex === 0 || batchIndex % 5 === 0) {
        // console.log(`📊 [IndexMap] Batch ${batchIndex}: ${batchEvents.length} events in ${batchDuration.toFixed(2)}ms`);
        }
      
        return batchDuration;
      };
    
      // 🎯 第一批：立即处理可视区域的事件（自适应批大小）
      if (priorityEvents.length > 0) {
        // 如果可视事件太多，分成更小的批次
        if (priorityEvents.length > BATCH_SIZE) {
        // console.log(`⚠️ [IndexMap] Priority events (${priorityEvents.length}) exceed batch size, splitting...`);
        
          // 第一小批：尽快完成
          const firstBatch = priorityEvents.slice(0, BATCH_SIZE);
          const firstBatchTime = processBatch(firstBatch, 0);
        
          // 🔧 根据第一批的性能调整批大小
          if (firstBatchTime > TARGET_FIRST_BATCH_TIME) {
            // 如果超时，减小批大小
            BATCH_SIZE = Math.max(50, Math.floor(BATCH_SIZE * TARGET_FIRST_BATCH_TIME / firstBatchTime));
          }
        
          // 处理剩余的优先事件
          for (let i = BATCH_SIZE; i < priorityEvents.length; i += BATCH_SIZE) {
            const batch = priorityEvents.slice(i, i + BATCH_SIZE);
            await new Promise(resolve => requestAnimationFrame(() => resolve(null)));
            processBatch(batch, Math.floor(i / BATCH_SIZE));
          }
        } else {
          // 可视事件不多，一次处理完
          processBatch(priorityEvents, 0);
        }
      }
    
      // 🔄 分批处理剩余事件（在窗口失焦时处理）
      for (let i = 0; i < remainingEvents.length; i += BATCH_SIZE) {
        const batch = remainingEvents.slice(i, i + BATCH_SIZE);
        const batchIndex = Math.floor(i / BATCH_SIZE) + 1;
      
        // 等待窗口失焦或下一帧
        await new Promise(resolve => {
          if (document.hidden) {
            // 窗口失焦，立即处理
            resolve(null);
          } else {
            // 窗口激活，等待下一帧（约 16ms）
            requestAnimationFrame(() => resolve(null));
          }
        });
      
        processBatch(batch, batchIndex);
      }
    
      const totalDuration = performance.now() - startTime;
      console.log(`✅ [IndexMap REBUILD DONE] ${this.eventIndexMap.size} entries in ${totalDuration.toFixed(0)}ms (ended at ${performance.now().toFixed(2)}ms)`);
    })();
    
    // 等待重建完成
    await this.indexMapRebuildPromise;
    this.indexMapRebuildPromise = null;
  }
  
  // 🔧 同步版本（仅用于关键路径）
  private rebuildEventIndexMap(events: any[]) {
    events.forEach(event => {
      if (event.id) {
        this.eventIndexMap.set(event.id, event);
      }
      if (event.externalId) {
        const existing = this.eventIndexMap.get(event.externalId);
        if (!existing || event.id.startsWith('timer-')) {
          this.eventIndexMap.set(event.externalId, event);
        }
      }
    });
  }

  // 🚀 [NEW] 增量更新单个事件的索引（性能优化）
  private updateEventInIndex(event: any, oldEvent?: any) {
    // 移除旧索引
    if (oldEvent) {
      if (oldEvent.id) {
        this.eventIndexMap.delete(oldEvent.id);
      }
      if (oldEvent.externalId) {
        this.eventIndexMap.delete(oldEvent.externalId);
      }
    }
    
    // 添加新索引
    if (event) {
      if (event.id) {
        this.eventIndexMap.set(event.id, event);
      }
      if (event.externalId) {
        this.eventIndexMap.set(event.externalId, event);
      }
    }
  }

  // 🚀 [NEW] 从索引中移除事件
  private removeEventFromIndex(event: any) {
    if (event.id) {
      this.eventIndexMap.delete(event.id);
    }
    if (event.externalId) {
      this.eventIndexMap.delete(event.externalId);
    }
  }

  private saveLocalEvents(events: any[], rebuildIndex: boolean = true) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    // 🚀 只在需要时重建索引（批量操作时应该传 false，使用增量更新）
    if (rebuildIndex) {
      // 🔧 使用异步重建，不阻塞保存操作
      this.rebuildEventIndexMapAsync(events).catch(err => {
        console.error('❌ [IndexMap] Async rebuild failed during save:', err);
      });
      // 🔧 重建索引视为重启，重置计数器
      this.incrementalUpdateCount = 0;
      this.fullCheckCompleted = true;
    } else {
      // 🔧 增量更新计数
      this.incrementalUpdateCount++;
      
      // 🔧 [NEW] 如果增量更新超过 30 次，标记需要全量检查
      if (this.incrementalUpdateCount > 30 && this.fullCheckCompleted) {
        this.fullCheckCompleted = false; // 触发下次完整检查
      }
    }
  }

  private updateLocalEventExternalId(localEventId: string, externalId: string, description?: string) {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === localEventId);
        if (eventIndex !== -1) {
          // 🔍 检查是否有其他事件已经使用了这个 externalId（可能是迁移导致的重复）
          const duplicateIndex = events.findIndex((event: any, idx: number) => 
            idx !== eventIndex && event.externalId === externalId
          );
          
          const oldEvent = { ...events[eventIndex] };
          
          if (duplicateIndex !== -1) {
            console.warn('⚠️ [updateLocalEventExternalId] Found duplicate event with same externalId:', {
              keepingEvent: localEventId,
              removingEvent: events[duplicateIndex].id,
              externalId: externalId
            });
            
            // 🔧 [IndexMap 优化] 删除重复事件时更新索引
            const duplicateEvent = events[duplicateIndex];
            this.removeEventFromIndex(duplicateEvent);
            
            // 删除重复的事件
            events.splice(duplicateIndex, 1);
            
            // 调整索引（如果删除的在前面）
            const adjustedIndex = duplicateIndex < eventIndex ? eventIndex - 1 : eventIndex;
            
            const updatedEvent = {
              ...events[adjustedIndex],
              externalId,
              syncStatus: 'synced',
              lastSyncTime: this.safeFormatDateTime(new Date()),
              updatedAt: this.safeFormatDateTime(new Date()),
              description: description || events[adjustedIndex].description || ''
            };
            
            events[adjustedIndex] = updatedEvent;
            
            // 🔧 [IndexMap 优化] 更新事件索引
            this.updateEventInIndex(updatedEvent, oldEvent);
          } else {
            const updatedEvent = {
              ...events[eventIndex],
              externalId,
              syncStatus: 'synced',
              lastSyncTime: this.safeFormatDateTime(new Date()),
              updatedAt: this.safeFormatDateTime(new Date()),
              description: description || events[eventIndex].description || ''
            };
            
            events[eventIndex] = updatedEvent;
            
            // 🔧 [IndexMap 优化] 更新事件索引
            this.updateEventInIndex(updatedEvent, oldEvent);
          }
          
          // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
          this.saveLocalEvents(events, false); // rebuildIndex=false
          
          // ✅ 架构清理：使用 eventsUpdated 代替 local-events-changed
          window.dispatchEvent(new CustomEvent('eventsUpdated', {
            detail: { 
              eventId: localEventId, 
              isUpdate: true,
              action: 'update-external-id',
              externalId, 
              description 
            }
          }));
        }
      }
    } catch (error) {
      console.error('❌ Failed to update local event external ID:', error);
    }
  }

  private updateLocalEventCalendarId(localEventId: string, calendarId: string) {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === localEventId);
        
        if (eventIndex !== -1) {
          const oldEvent = { ...events[eventIndex] };
          
          const updatedEvent = {
            ...events[eventIndex],
            calendarId,
            updatedAt: this.safeFormatDateTime(new Date()),
            lastSyncTime: this.safeFormatDateTime(new Date())
          };
          
          events[eventIndex] = updatedEvent;
          
          // 🔧 [IndexMap 优化] 更新事件索引
          this.updateEventInIndex(updatedEvent, oldEvent);
          
          // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
          this.saveLocalEvents(events, false); // rebuildIndex=false
          window.dispatchEvent(new CustomEvent('local-events-changed', {
            detail: { eventId: localEventId, calendarId }
          }));
        }
      }
    } catch (error) {
      console.error('❌ Failed to update local event calendar ID:', error);
    }
  }

  private convertRemoteEventToLocal(remoteEvent: any): any {
    const cleanTitle = remoteEvent.subject || '';
    
    // 尝试多个可能的描述字段
    const htmlContent = remoteEvent.body?.content || 
                       remoteEvent.description || 
                       remoteEvent.bodyPreview || 
                       '';
    const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync', remoteEvent);
    
    // 检查是否是ReMarkable创建的事件（通过描述中的标记判断）
    const isReMarkableCreated = this.hasCreateNote(cleanDescription) && 
                               cleanDescription.includes('由 🔮 ReMarkable 创建');
    
    // 🔧 [FIX] remoteEvent.id 已经带有 'outlook-' 前缀（来自 MicrosoftCalendarService）
    // 不要重复添加前缀！同时 externalId 应该是纯 Outlook ID（不带前缀）
    const pureOutlookId = remoteEvent.id.replace(/^outlook-/, '');
    
    return {
      id: remoteEvent.id, // 已经是 'outlook-AAMkAD...'
      title: cleanTitle,
      description: cleanDescription,
      startTime: this.safeFormatDateTime(remoteEvent.start?.dateTime || remoteEvent.start),
      endTime: this.safeFormatDateTime(remoteEvent.end?.dateTime || remoteEvent.end),
      isAllDay: remoteEvent.isAllDay || false,
      location: remoteEvent.location?.displayName || '',
      reminder: 0,
      createdAt: this.safeFormatDateTime(remoteEvent.createdDateTime || new Date()),
      updatedAt: this.safeFormatDateTime(remoteEvent.lastModifiedDateTime || new Date()),
      externalId: pureOutlookId, // 纯 Outlook ID，不带 'outlook-' 前缀
      calendarIds: remoteEvent.calendarIds || ['microsoft'], // 🔧 使用数组格式，与类型定义保持一致
      source: 'outlook', // 🔧 设置source字段
      syncStatus: 'synced',
      remarkableSource: isReMarkableCreated // 根据描述内容判断来源
    };
  }

  private cleanHtmlContent(htmlContent: string): string {
    if (!htmlContent) return '';
    
    // 🔧 改进的HTML清理逻辑
    let cleaned = htmlContent;
    
    // 1. 如果是完整的HTML文档，优先提取body内容
    if (cleaned.includes('<html>') || cleaned.includes('<body>')) {
      // 尝试提取 PlainText div 中的内容
      const plainTextMatch = cleaned.match(/<div[^>]*class[^>]*["']PlainText["'][^>]*>([\s\S]*?)<\/div>/i);
      if (plainTextMatch) {
        cleaned = plainTextMatch[1];
      } else {
        // 如果没有PlainText div，尝试提取body内容
        const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          cleaned = bodyMatch[1];
        }
      }
    }
    
    // 2. 处理 <br> 标签，将其转换为换行符
    cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    
    // 3. 移除所有剩余的HTML标签
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // 4. 处理HTML实体
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
    
    // 5. 🔧 更智能的换行符清理 - 彻底清理多余换行
    cleaned = cleaned
      .replace(/\r\n/g, '\n')           // Windows换行符转换
      .replace(/\r/g, '\n')             // Mac换行符转换
      .replace(/[ \t]+\n/g, '\n')       // 移除行尾的空格和制表符
      .replace(/\n[ \t]+/g, '\n')       // 移除行首的空格和制表符
      .replace(/\n{2,}/g, '\n')         // 🔧 将所有多个连续换行符都减少为1个
      .replace(/^[\s\n]+/, '')          // 移除开头的所有空白和换行
      .replace(/[\s\n]+$/, '')          // 移除结尾的所有空白和换行
      .trim();
    
    return cleaned;
  }

  // 🆕 提取纯净的核心内容用于比较 - 去除所有备注和格式差异
  private extractCoreContent(description: string): string {
    if (!description) return '';
    
    let core = description;
    
    // 1. 移除所有同步备注（创建和编辑）
    core = core.replace(/\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建于 [^\n]*/g, '');
    core = core.replace(/\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:创建|最后编辑于|最新修改于) [^\n]*/g, '');
    
    // 2. 移除所有分隔线
    core = core.replace(/\n?---\n?/g, '');
    
    // 3. 规范化空白字符 - 彻底统一格式
    core = core
      .replace(/\r\n/g, '\n')           // 统一换行符
      .replace(/\r/g, '\n')
      .replace(/[ \t]+/g, ' ')          // 多个空格/制表符压缩为单个空格
      .replace(/\n[ \t]+/g, '\n')       // 移除行首空格
      .replace(/[ \t]+\n/g, '\n')       // 移除行尾空格
      .replace(/\n{2,}/g, '\n')         // 多个换行符压缩为单个
      .trim();
    
    return core;
  }

  // ❌ 删除：重复的 startSync() 方法，使用 start() 即可
  // public async startSync() { ... }

  // 🔧 保留几个简化的调试方法
  public debugActionQueue() {
    const pending = this.actionQueue.filter(a => !a.synchronized);
    if (pending.length > 0) {
    }
  }

  public async performSyncNow(): Promise<void> {
    if (!this.syncInProgress) {
      // 🚀 使用优先级同步策略：先同步可见范围，再同步剩余
      const currentDate = this.getCurrentCalendarDate();
      const visibleStart = new Date(currentDate);
      visibleStart.setMonth(visibleStart.getMonth() - 1);
      visibleStart.setDate(1);
      visibleStart.setHours(0, 0, 0, 0);
      
      const visibleEnd = new Date(currentDate);
      visibleEnd.setMonth(visibleEnd.getMonth() + 2);
      visibleEnd.setDate(0);
      visibleEnd.setHours(23, 59, 59, 999);
      
      syncLogger.log('🚀 [Manual Sync] User triggered sync, using priority strategy');
      await this.syncVisibleDateRangeFirst(visibleStart, visibleEnd);
    }
  }

  // 公共方法
  public isActive(): boolean {
    return this.isRunning;
  }

  public getLastSyncTime(): Date {
    return this.lastSyncTime;
  }

  public getPendingActionsCount(): number {
    return this.actionQueue.filter(action => !action.synchronized).length;
  }

  public getConflictsCount(): number {
    return this.conflictQueue.length;
  }

  public async forceSync(): Promise<void> {
    if (!this.syncInProgress) {
      // 🚀 使用优先级同步策略：先同步可见范围，再同步剩余
      const currentDate = this.getCurrentCalendarDate();
      const visibleStart = new Date(currentDate);
      visibleStart.setMonth(visibleStart.getMonth() - 1);
      visibleStart.setDate(1);
      visibleStart.setHours(0, 0, 0, 0);
      
      const visibleEnd = new Date(currentDate);
      visibleEnd.setMonth(visibleEnd.getMonth() + 2);
      visibleEnd.setDate(0);
      visibleEnd.setHours(23, 59, 59, 999);
      
      syncLogger.log('🚀 [Force Sync] User triggered force sync, using priority strategy');
      await this.syncVisibleDateRangeFirst(visibleStart, visibleEnd);
    }
  }

  /**
   * 处理标签映射变化，移动相关事件到新日历
   */
  public async handleTagMappingChange(tagId: string, mapping: { calendarId: string; calendarName: string } | null): Promise<void> {
    try {
      // 获取所有本地事件
      const events = this.getLocalEvents();
      const eventsToMove = events.filter((event: any) => event.tagId === tagId && event.id.startsWith('outlook-'));
      
      if (eventsToMove.length === 0) {
        return;
      }
      for (const event of eventsToMove) {
        if (mapping) {
          // 移动到新日历
          await this.moveEventToCalendar(event, mapping.calendarId);
        } else {
          // 如果取消映射，移动到默认日历
          // 这里可以根据需要决定是否移动到默认日历
        }
      }
    } catch (error) {
      console.error(`❌ [ActionBasedSyncManager] Failed to handle tag mapping change:`, error);
    }
  }

  /**
   * 移动事件到指定日历
   */
  private async moveEventToCalendar(event: any, targetCalendarId: string): Promise<void> {
    try {
      // 提取原始Outlook事件ID
      const outlookEventId = event.id.replace('outlook-', '');
      
      // 第一步：在目标日历创建事件
      const createResult = await this.createEventInOutlookCalendar(event, targetCalendarId);
      
      if (createResult && createResult.id) {
        // 第二步：删除原事件
        await this.deleteEventFromOutlook(outlookEventId);
        
        // 第三步：更新本地事件ID
        const updatedEvent = {
          ...event,
          id: `outlook-${createResult.id}`,
          calendarId: targetCalendarId
        };
        
        // 更新本地存储
        this.updateLocalEvent(event.id, updatedEvent);
      } else {
        console.error(`❌ [ActionBasedSyncManager] Failed to create event in target calendar`);
      }
    } catch (error) {
      console.error(`❌ [ActionBasedSyncManager] Failed to move event:`, error);
    }
  }

  /**
   * 在指定日历中创建事件
   */
  private async createEventInOutlookCalendar(event: any, calendarId: string): Promise<any> {
    try {
      const eventData = {
        subject: event.title,
        body: {
          contentType: 'html',
          content: event.description || ''
        },
        start: {
          dateTime: event.startTime,
          timeZone: 'Asia/Shanghai'
        },
        end: {
          dateTime: event.endTime,
          timeZone: 'Asia/Shanghai'
        },
        location: {
          displayName: event.location || ''
        }
      };

      const response = await fetch(`https://graph.microsoft.com/v1.0/me/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.microsoftService.getAccessToken()}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(eventData)
      });

      if (response.ok) {
        return await response.json();
      } else {
        console.error('Failed to create event in calendar:', await response.text());
        return null;
      }
    } catch (error) {
      console.error('Error creating event in calendar:', error);
      return null;
    }
  }

  /**
   * 从Outlook删除事件
   */
  private async deleteEventFromOutlook(eventId: string): Promise<boolean> {
    try {
      const response = await fetch(`https://graph.microsoft.com/v1.0/me/events/${eventId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${this.microsoftService.getAccessToken()}`
        }
      });

      return response.ok;
    } catch (error) {
      console.error('Error deleting event from Outlook:', error);
      return false;
    }
  }

  /**
   * 更新本地事件
   */
  private updateLocalEvent(oldEventId: string, updatedEvent: any): void {
    try {
      const events = this.getLocalEvents();
      const eventIndex = events.findIndex((e: any) => e.id === oldEventId);
      
      if (eventIndex !== -1) {
        const oldEvent = { ...events[eventIndex] };
        
        // 如果事件ID发生了变化，删除旧事件并添加新事件
        if (oldEventId !== updatedEvent.id) {
          // 🔧 [IndexMap 优化] 删除旧事件索引
          this.removeEventFromIndex(oldEvent);
          
          // 删除旧事件
          events.splice(eventIndex, 1);
          
          // 检查新ID是否已存在，避免重复
          const existingIndex = events.findIndex((e: any) => e.id === updatedEvent.id);
          if (existingIndex === -1) {
            // 添加新事件
            events.push(updatedEvent);
            
            // 🔧 [IndexMap 优化] 添加新事件索引
            this.updateEventInIndex(updatedEvent);
          } else {
            // 如果新ID已存在，更新现有事件
            const oldExisting = { ...events[existingIndex] };
            events[existingIndex] = updatedEvent;
            
            // 🔧 [IndexMap 优化] 更新现有事件索引
            this.updateEventInIndex(updatedEvent, oldExisting);
          }
          
          // 记录旧事件ID为已删除
          this.deletedEventIds.add(oldEventId);
          this.saveDeletedEventIds();
        } else {
          // ID没有变化，直接更新
          events[eventIndex] = updatedEvent;
          
          // 🔧 [IndexMap 优化] 更新事件索引
          this.updateEventInIndex(updatedEvent, oldEvent);
        }
        
        // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
        this.saveLocalEvents(events, false); // rebuildIndex=false
        
        // 触发事件更新
        window.dispatchEvent(new CustomEvent('local-events-changed'));
      } else {
        console.warn(`⚠️ [ActionBasedSyncManager] Event not found for update: ${oldEventId}`);
      }
    } catch (error) {
      console.error('Error updating local event:', error);
    }
  }

  // ==================== 完整性检查方法 ====================

  /**
   * 🔧 启动完整性检查调度器
   * 🔧 [FIX] 降低检查频率：从 5 秒改为 30 秒，减少对 UI 的潜在影响
   */
  private startIntegrityCheckScheduler() {
    // 🔧 [FIX] 每 30 秒尝试一次检查（低频但足够）
    this.indexIntegrityCheckInterval = setInterval(() => {
      this.tryIncrementalIntegrityCheck();
    }, 30000); // 30 秒间隔（原来是 5 秒）
      // console.log('✅ [Integrity] Scheduler started (30-second interval, <10ms per check)');
  }

  /**
   * 🔧 检查是否处于空闲状态
   * 🔧 [FIX] 空闲标准：用户 15 秒无活动（原来是 5 秒）
   */
  /**
   * 🔧 尝试执行增量完整性检查
   * 🔧 [FIX] 增强条件检查，避免在不合适的时机运行
   */
  private tryIncrementalIntegrityCheck() {
    // 🚨 [CRITICAL FIX] 条件 0: 检查 Microsoft 服务认证状态
    // 如果用户登出或掉线，绝对不能运行完整性检查
    if (this.microsoftService) {
      const isAuthenticated = this.microsoftService.isAuthenticated || 
                             (typeof this.microsoftService.getIsAuthenticated === 'function' && 
                              this.microsoftService.getIsAuthenticated());
      
      if (!isAuthenticated) {
        return;
      }
    }
    
    // 🔧 [NEW] 条件 0.5: 检查窗口是否被激活（用户正在使用应用）
    if (this.isWindowFocused) {
      return; // 窗口被激活时不运行检查，避免打断用户操作
    }
    
    // 🔧 [NEW] 条件 0.6: 检查是否有 Modal 打开（用户正在编辑）
    if (typeof document !== 'undefined') {
      const hasOpenModal = document.querySelector('.event-edit-modal-overlay') !== null ||
                          document.querySelector('.settings-modal') !== null ||
                          document.querySelector('[role="dialog"]') !== null;
      if (hasOpenModal) {
      // console.log('⏸️ [Integrity] Skipping check: Modal is open (user is editing)');
        return;
      }
    }
    
    // 条件 1: 不在同步中
    if (this.syncInProgress) {
      return;
    }

    // 条件 2: 距离上次检查至少 30 秒
    const now = Date.now();
    if (now - this.lastIntegrityCheck < 30000) {
      return;
    }
    
    // 🔧 [FIX] 条件 3: 确保没有正在进行的操作（如事件编辑、删除等）
    // 通过检查 action queue 是否稳定（2 秒内没有新操作）
    const queueAge = now - this.lastQueueModification;
    if (queueAge < 2000) {
      return; // action queue 在 2 秒内有变化，延迟检查
    }

    // 执行检查
    this.runIncrementalIntegrityCheck();
  }

  /**
   * 🔧 增量完整性检查（轻量级，< 10ms）
   * 策略：
   * - 首次启动：执行完整检查（分批，每批 < 10ms）
   * - 后续：只检查 TimeCalendar 可见范围（当前月份）
   * - 超过 30 次增量更新后：再次执行完整检查
   */
  private currentCheckIndex = 0; // 当前检查进度

  private runIncrementalIntegrityCheck() {
    const startTime = performance.now();
    this.lastIntegrityCheck = Date.now();

    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!stored) {
        return;
      }

      const events = JSON.parse(stored);
      
      // 🔧 [NEW] 决定检查策略
      const needsFullCheck = !this.fullCheckCompleted;
      
      if (needsFullCheck) {
        // 首次启动或增量更新超过 30 次：执行完整检查（分批）
        this.runBatchedFullCheck(events, startTime);
      } else {
        // 正常情况：只检查 TimeCalendar 可见范围
        this.runQuickVisibilityCheck(events, startTime);
      }

    } catch (error) {
      console.error('❌ [Integrity] Check failed:', error);
    }
  }

  /**
   * 🔧 分批完整检查（每次 < 10ms）
   */
  private runBatchedFullCheck(events: any[], startTime: number) {
    const batchSize = 20; // 每批 20 个事件，确保 < 10ms
    const maxDuration = 10; // 最多 10ms

    const start = this.currentCheckIndex;
    const end = Math.min(start + batchSize, events.length);
    const issues: any[] = [];

    for (let i = start; i < end; i++) {
      const event = events[i];

      // 快速检查：只检查关键项
      if (!event.id) {
        issues.push({ type: 'missing-id', eventIndex: i });
        continue;
      }

      // 检查 IndexMap
      const indexedEvent = this.eventIndexMap.get(event.id);
      if (!indexedEvent) {
        this.updateEventInIndex(event); // 立即修复
      }

      // 检查时间逻辑（快速）
      if (event.startTime && event.endTime) {
        const start = new Date(event.startTime).getTime();
        const end = new Date(event.endTime).getTime();
        if (end < start) {
          issues.push({ type: 'invalid-time', eventId: event.id });
        }
      }

      // 时间控制
      const elapsed = performance.now() - startTime;
      if (elapsed > maxDuration) {
        break;
      }
    }

    this.currentCheckIndex = end;

    // 完成一轮完整检查
    if (this.currentCheckIndex >= events.length) {
      this.fullCheckCompleted = true;
      this.currentCheckIndex = 0;
      this.incrementalUpdateCount = 0;
      
      const duration = performance.now() - startTime;
      const healthScore = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 5);
      this.lastHealthScore = healthScore;
      // console.log(`✅ [Integrity] Full check completed: ${events.length} events, ${issues.length} issues, ${healthScore}/100 health (${duration.toFixed(1)}ms)`);
    }
  }

  /**
   * 🔧 快速可见性检查（只检查 TimeCalendar 当前可见范围）
   * 🔧 [FIX] 完全避免触发 UI 刷新：只做索引修复，不触发任何事件
   */
  private runQuickVisibilityCheck(events: any[], startTime: number) {
    const maxDuration = 10; // 最多 10ms

    // 🔧 只检查当前月份的事件（TimeCalendar 可见范围）
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const visibleEvents = events.filter((e: any) => {
      if (!e.startTime) return false;
      const eventDate = new Date(e.startTime);
      return eventDate >= currentMonthStart && eventDate <= currentMonthEnd;
    });
    let checked = 0;
    const issues: any[] = [];

    for (const event of visibleEvents) {
      if (!event.id) continue;

      // 检查 IndexMap 一致性
      const indexedEvent = this.eventIndexMap.get(event.id);
      if (!indexedEvent) {
        this.updateEventInIndex(event); // 立即修复（仅内存操作，不触发事件）
        checked++;
      }

      // 时间控制
      const elapsed = performance.now() - startTime;
      if (elapsed > maxDuration) {
        break;
      }
    }

    const duration = performance.now() - startTime;
    if (duration < 10) {
      // 如果还有时间，检查 IndexMap 大小
      const indexSize = this.eventIndexMap.size;
      const expectedMax = events.length * 2;
      
      if (indexSize === 0 && events.length > 0) {
        console.warn('⚠️ [Integrity] IndexMap empty, rebuilding async...');
        // 🔧 [FIX] 使用异步重建，避免阻塞主线程
        this.rebuildEventIndexMapAsync(events).catch(err => {
          console.error('❌ [Integrity] Failed to rebuild IndexMap:', err);
        });
        this.fullCheckCompleted = true;
      } else if (indexSize > expectedMax * 1.5) {
        console.warn(`⚠️ [Integrity] IndexMap too large (${indexSize} entries for ${events.length} events)`);
      }
    }

    const healthScore = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10);
    this.lastHealthScore = healthScore;

    // 🔧 [FIX] 只在有实际问题且问题数量 > 0 时才打印日志
    if (checked > 0) {
      // console.log(`✅ [Integrity] Quick check: ${checked} fixed silently (${duration.toFixed(1)}ms)`);
    }
  }

  /**
   * 🔧 [MIGRATION] 一次性清理重复的 outlook- 前缀
   * 修复历史数据中的：
   * 1. id: 'outlook-outlook-AAMkAD...' → 'outlook-AAMkAD...'
   * 2. externalId: 'outlook-AAMkAD...' → 'AAMkAD...'
   */
  
  // 🔧 [NEW] 修复历史 pending 事件（补充到同步队列）
  private fixOrphanedPendingEvents() {
    // 每次启动时都检查，不使用迁移标记
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
      
      // 查找需要同步但未同步的事件：
      // 1. syncStatus 为 'pending'（统一的待同步状态，包含新建和更新）
      // 2. remarkableSource = true（本地创建）
      // 3. 没有 externalId（尚未同步到远程）
      // 4. syncStatus !== 'local-only'（排除本地专属事件，如运行中的 Timer）
      // 5. 有目标日历：calendarIds 不为空 或 有 tagId（可能有日历映射）
      const pendingEvents = events.filter((event: any) => {
        const needsSync = event.syncStatus === 'pending' && 
                         event.remarkableSource === true &&
                         !event.externalId;
        
        if (!needsSync) return false;
        
        // 检查是否有目标日历
        const hasCalendars = (event.calendarIds && event.calendarIds.length > 0) || event.calendarId;
        const hasTag = event.tagId || (event.tags && event.tags.length > 0);
        
        // 有日历或有标签（标签可能有日历映射）才需要同步
        return hasCalendars || hasTag;
      });
      
      if (pendingEvents.length === 0) {
        return;
      }
      // 检查这些事件是否已经在同步队列中
      const existingActionIds = new Set(
        this.actionQueue
          .filter(a => a.source === 'local' && !a.synchronized)
          .map(a => a.entityId)
      );
      
      let addedCount = 0;
      
      for (const event of pendingEvents) {
        // 如果事件不在同步队列中，添加它
        if (!existingActionIds.has(event.id)) {
          const action: SyncAction = {
            id: `migration-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: 'create',
            entityType: 'event',
            entityId: event.id,
            timestamp: new Date(event.createdAt || event.startTime),
            source: 'local',
            data: event,
            synchronized: false,
            retryCount: 0
          };
          
          this.actionQueue.push(action);
          addedCount++;
        }
      }
      
      if (addedCount > 0) {
        this.saveActionQueue();
      } else {
      }
      
    } catch (error) {
      console.error('❌ [Fix Pending] Failed to fix orphaned pending events:', error);
    }
  }

  private migrateOutlookPrefixes() {
    const MIGRATION_KEY = 'remarkable-outlook-prefix-migration-v1';
    
    // 检查是否已经迁移过
    if (localStorage.getItem(MIGRATION_KEY) === 'completed') {
      return;
    }
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
      let migratedCount = 0;
      
      const migratedEvents = events.map((event: any) => {
        let needsMigration = false;
        const newEvent = { ...event };
        
        // 1. 修复 id 的重复前缀：outlook-outlook- → outlook-
        if (newEvent.id?.startsWith('outlook-outlook-')) {
          newEvent.id = newEvent.id.replace(/^outlook-outlook-/, 'outlook-');
          needsMigration = true;
        }
        
        // 2. 修复 externalId 的错误前缀：outlook-AAMkAD... → AAMkAD...
        if (newEvent.externalId?.startsWith('outlook-')) {
          newEvent.externalId = newEvent.externalId.replace(/^outlook-/, '');
          needsMigration = true;
        }
        
        if (needsMigration) {
          migratedCount++;
        }
        
        return newEvent;
      });
      
      if (migratedCount > 0) {
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(migratedEvents));
        // 🔧 [FIX] 使用异步重建，避免阻塞主线程
        this.rebuildEventIndexMapAsync(migratedEvents).catch(err => {
          console.error('❌ [Migration] Failed to rebuild IndexMap:', err);
        });
      } else {
      }
      
      // 标记迁移完成
      localStorage.setItem(MIGRATION_KEY, 'completed');
    } catch (error) {
      console.error('❌ [Migration] Failed to migrate Outlook prefixes:', error);
    }
  }

  /**
   * 🔧 计算数据健康评分（0-100）
   */
  private calculateHealthScore(totalEvents: number, issues: any[]): number {
    if (totalEvents === 0) return 100;
    if (issues.length === 0) return 100;

    const critical = issues.filter(i => i.severity === 'critical').length;
    const warnings = issues.filter(i => i.severity === 'warning').length;
    const info = issues.filter(i => i.severity === 'info').length;

    // 扣分规则
    const criticalPenalty = critical * 10; // 每个严重问题扣 10 分
    const warningPenalty = warnings * 2;   // 每个警告扣 2 分
    const infoPenalty = info * 0.5;        // 每个信息扣 0.5 分

    const totalPenalty = criticalPenalty + warningPenalty + infoPenalty;
    const score = Math.max(0, 100 - totalPenalty);

    return Math.round(score);
  }
}
