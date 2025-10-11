import { MicrosoftCalendarService } from './MicrosoftCalendarService';
import { STORAGE_KEYS } from '../constants/storage';

export interface Event {
  id: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  location?: string;
  isAllDay?: boolean;
  reminder?: number;
  syncStatus?: 'synced' | 'pending' | 'error';
  createdAt: Date;
  updatedAt: Date;
  externalId?: string;
  calendarId?: string;
  
  // 🔧 新增版本控制字段
  localVersion: number;        // 本地版本号
  remoteVersion?: number;      // 远程版本号
  lastLocalChange: Date;       // 最后本地修改时间
  lastRemoteChange?: Date;     // 最后远程修改时间
  lastSyncTime?: Date;         // 最后同步时间
  conflictResolved?: boolean;  // 冲突是否已解决
  
  // 现有字段
  timerSessionId?: string;
  tagId?: string;
  category?: string;
  remarkableSource?: boolean;
}

// 新增同步缓存接口
export interface SyncCache {
  events: Event[];
  lastSyncTime: Date;
  pendingLocalChanges: Event[];
  pendingRemoteChanges: Event[];
}

export class ConflictResolutionSyncManager {
  private microsoftService: MicrosoftCalendarService;
  private syncInterval: NodeJS.Timeout | null = null;
  private running = false;
  private lastSyncTime: Date = new Date();
  private syncCache: SyncCache;
  private eventUpdateCallback?: (events: any[]) => void;
  private syncDays: number = 7; // 🔧 添加同步天数配置
  
  constructor(microsoftService: MicrosoftCalendarService) {
    this.microsoftService = microsoftService;
    this.syncCache = this.loadSyncCache();
    
    // 🔧 加载用户配置的同步天数
    this.loadSyncConfig();
  }

  // 🔧 加载同步配置
  private loadSyncConfig(): void {
    try {
      const config = localStorage.getItem(STORAGE_KEYS.SYNC_CONFIG);
      if (config) {
        const parsedConfig = JSON.parse(config);
        this.syncDays = parsedConfig.syncDays || 7;
        console.log(`📅 [ConflictResolutionSync] Loaded sync days config: ${this.syncDays}`);
      }
    } catch (error) {
      console.error('Failed to load sync config:', error);
      this.syncDays = 7; // 默认值
    }
  }

  // 🔧 设置同步天数
  public setSyncDays(days: number): void {
    this.syncDays = days;
    console.log(`📅 [ConflictResolutionSync] Updated sync days to: ${days}`);
  }

  // 🔧 获取同步天数
  public getSyncDays(): number {
    return this.syncDays;
  }

  // 加载同步缓存
  private loadSyncCache(): SyncCache {
    try {
      const cache = localStorage.getItem(STORAGE_KEYS.SYNC_CACHE);
      if (cache) {
        const parsed = JSON.parse(cache);
        // 转换日期字符串为Date对象
        return {
          ...parsed,
          lastSyncTime: new Date(parsed.lastSyncTime),
          events: parsed.events.map((event: any) => ({
            ...event,
            startTime: new Date(event.startTime),
            endTime: new Date(event.endTime),
            createdAt: new Date(event.createdAt),
            updatedAt: new Date(event.updatedAt),
            lastLocalChange: new Date(event.lastLocalChange),
            lastRemoteChange: event.lastRemoteChange ? new Date(event.lastRemoteChange) : undefined,
            lastSyncTime: event.lastSyncTime ? new Date(event.lastSyncTime) : undefined
          }))
        };
      }
    } catch (error) {
      console.error('Failed to load sync cache:', error);
    }
    
    return {
      events: [],
      lastSyncTime: new Date(0),
      pendingLocalChanges: [],
      pendingRemoteChanges: []
    };
  }

  // 保存同步缓存
  private saveSyncCache(): void {
    try {
      localStorage.setItem(STORAGE_KEYS.SYNC_CACHE, JSON.stringify(this.syncCache));
    } catch (error) {
      console.error('Failed to save sync cache:', error);
    }
  }

  // 检查是否运行中
  public isActive(): boolean {
    return this.running;
  }

  // 获取最后同步时间
  public getLastSyncTime(): Date {
    return this.lastSyncTime;
  }

  // 启动同步管理器
  public start(): void {
    if (this.running) return;
    
    this.running = true;
    console.log('🚀 [ConflictResolutionSync] Starting sync manager');
    
    // 立即执行一次同步
    this.performSync();
    
    // 设置定时同步
    this.syncInterval = setInterval(() => {
      this.performSync();
    }, 20000); // 每20秒同步一次
  }

  // 停止同步管理器
  public stop(): void {
    if (!this.running) return;
    
    this.running = false;
    console.log('⏹️ [ConflictResolutionSync] Stopping sync manager');
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
  }

  // 强制同步
  public async forceSync(): Promise<void> {
    console.log('🔄 [ConflictResolutionSync] Force sync triggered');
    await this.performSync();
  }

  // 执行四步同步
  private async performSync(): Promise<void> {
    if (!this.microsoftService.isSignedIn()) {
      console.log('👤 [ConflictResolutionSync] Not signed in, skipping sync');
      return;
    }

    const syncStart = new Date();
    console.log('🔄 [ConflictResolutionSync] Starting 4-step sync process');

    try {
      // Step 1: Outlook → Cache
      await this.syncOutlookToCache();
      
      // Step 2: Local → Cache
      await this.addLocalChangesToCache(this.lastSyncTime, syncStart);
      
      // Step 3: Cache → Local
      await this.updateCacheToLocal();
      
      // Step 4: Cache → Outlook
      await this.updateCacheToOutlook();
      
      this.lastSyncTime = syncStart;
      this.syncCache.lastSyncTime = syncStart;
      this.saveSyncCache();
      
      console.log('✅ [ConflictResolutionSync] 4-step sync completed successfully');
      
      // 触发事件更新回调
      if (this.eventUpdateCallback) {
        this.eventUpdateCallback(this.syncCache.events);
      }
      
    } catch (error) {
      console.error('❌ [ConflictResolutionSync] Sync failed:', error);
    }
  }

  // Step 1: Outlook → Cache
  private async syncOutlookToCache(): Promise<void> {
    try {
      // 🔧 计算日期范围
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - this.syncDays);
      
      console.log(`📥 [ConflictResolutionSync] Syncing Outlook events from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);
      
      const outlookEvents = await this.microsoftService.getEvents();
      console.log(`📥 Retrieved ${outlookEvents.length} total events from Outlook`);
      
      // 🔧 过滤指定日期范围内的事件
      const filteredOutlookEvents = outlookEvents.filter((outlookEvent: any) => {
        const eventDate = new Date(outlookEvent.start?.dateTime || outlookEvent.createdDateTime);
        return eventDate >= startDate && eventDate <= endDate;
      });
      
      console.log(`📥 Found ${filteredOutlookEvents.length} events in date range (past ${this.syncDays} days)`);
      
      // 🔧 只处理由 ReMarkable 创建的事件
      const remarkableOutlookEvents = filteredOutlookEvents.filter((outlookEvent: any) => {
        const subject = outlookEvent.subject || '';
        const body = outlookEvent.body?.content || '';
        
        return subject.includes('🍅') || 
               body.includes('ReMarkable') || 
               body.includes('计时记录') ||
               body.includes('专注计时');
      });
      
      console.log(`📥 Found ${remarkableOutlookEvents.length} ReMarkable events in date range`);
      
      // 更新或添加 Outlook 事件到 cache
      for (const outlookEvent of remarkableOutlookEvents) {
        const existingIndex = this.syncCache.events.findIndex(
          event => event.externalId === outlookEvent.id
        );
        
        if (existingIndex >= 0) {
          // 检查是否有远程更新
          const existing = this.syncCache.events[existingIndex];
          const outlookLastModified = this.getEventLastModified(outlookEvent);
          
          if (!existing.lastRemoteChange || outlookLastModified > existing.lastRemoteChange) {
            console.log(`🔄 Remote update detected: ${outlookEvent.subject}`);
            
            // 🔧 修复类型问题：确保传递正确的参数类型
            this.syncCache.events[existingIndex] = {
              ...existing,
              title: this.extractTitleFromOutlook(outlookEvent.subject || ''),
              description: this.extractDescription(outlookEvent.body?.content),
              startTime: new Date(outlookEvent.start?.dateTime || existing.startTime),
              endTime: new Date(outlookEvent.end?.dateTime || existing.endTime),
              location: outlookEvent.location?.displayName || existing.location,
              isAllDay: outlookEvent.isAllDay || existing.isAllDay,
              remoteVersion: (existing.remoteVersion || 0) + 1,
              lastRemoteChange: outlookLastModified,
              updatedAt: outlookLastModified,
              syncStatus: 'synced',
              conflictResolved: false
            };
          }
        } else {
          // 检查是否有相同时间和标题的本地事件
          const matchingLocalEvent = this.syncCache.events.find(localEvent => {
            // 🔧 安全地获取日期时间
            const outlookDateTime = outlookEvent.start?.dateTime;
            if (!outlookDateTime) return false;
            
            const timeDiff = Math.abs(
                new Date(outlookDateTime).getTime() - localEvent.startTime.getTime()
            );
            const titleMatch = this.extractTitleFromOutlook(outlookEvent.subject || '') === localEvent.title;
            return timeDiff < 60000 && titleMatch;
            });
          
          if (matchingLocalEvent) {
            // 链接本地事件与Outlook事件
            console.log(`🔗 Linking local event with Outlook: ${matchingLocalEvent.title}`);
            matchingLocalEvent.externalId = outlookEvent.id;
            matchingLocalEvent.calendarId = 'microsoft';
            matchingLocalEvent.syncStatus = 'synced';
            matchingLocalEvent.lastSyncTime = new Date();
          } else {
            // 新的远程事件
            console.log(`➕ New remote event: ${outlookEvent.subject}`);
            const convertedEvent = this.convertOutlookToEvent(outlookEvent);
            this.syncCache.events.push(convertedEvent);
          }
        }
      }
      
      // 检查已删除的远程事件
      for (const cacheEvent of this.syncCache.events) {
        if (cacheEvent.externalId && cacheEvent.calendarId === 'microsoft') {
          const stillExists = outlookEvents.find((oe: any) => oe.id === cacheEvent.externalId);
          if (!stillExists) {
            console.log(`🗑️ Remote event deleted: ${cacheEvent.title}`);
            const index = this.syncCache.events.indexOf(cacheEvent);
            if (index > -1) {
              this.syncCache.events.splice(index, 1);
            }
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Failed to sync Outlook to cache:', error);
    }
  }


  // Step 2: 添加本地变更到 Cache
  private async addLocalChangesToCache(fromTime: Date, toTime: Date): Promise<void> {
    try {
      const localEvents = this.getLocalOngoingEvents();
      console.log(`📝 Processing ${localEvents.length} local events for changes since ${fromTime.toLocaleString()}`);
      
      for (const localEvent of localEvents) {
        const lastLocalChange = new Date(localEvent.lastLocalChange || localEvent.updatedAt);
        
        if (lastLocalChange >= fromTime && lastLocalChange <= toTime) {
          const cacheIndex = this.syncCache.events.findIndex(
            event => event.id === localEvent.id
          );
          
          if (cacheIndex >= 0) {
            // 更新现有缓存事件
            const cacheEvent = this.syncCache.events[cacheIndex];
            const hasRemoteChange = cacheEvent.lastRemoteChange && 
                                   cacheEvent.lastRemoteChange > (cacheEvent.lastSyncTime || new Date(0));
            
            if (hasRemoteChange) {
              console.log(`⚠️ Conflict detected for: ${localEvent.title}`);
              // 本地优先策略
              this.syncCache.events[cacheIndex] = {
                ...cacheEvent,
                title: localEvent.title,
                description: localEvent.description,
                startTime: localEvent.startTime,
                endTime: localEvent.endTime,
                location: localEvent.location,
                isAllDay: localEvent.isAllDay,
                localVersion: (cacheEvent.localVersion || 1) + 1,
                lastLocalChange: lastLocalChange,
                conflictResolved: true,
                syncStatus: 'pending'
              };
            } else {
              this.syncCache.events[cacheIndex] = {
                ...localEvent,
                externalId: cacheEvent.externalId,
                calendarId: cacheEvent.calendarId,
                remoteVersion: cacheEvent.remoteVersion,
                lastRemoteChange: cacheEvent.lastRemoteChange,
                localVersion: (cacheEvent.localVersion || 1) + 1,
                lastLocalChange: lastLocalChange,
                syncStatus: 'pending'
              };
            }
          } else {
            // 新的本地事件
            this.syncCache.events.push({
              ...localEvent,
              localVersion: 1,
              lastLocalChange: lastLocalChange,
              conflictResolved: false,
              syncStatus: 'pending'
            });
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to add local changes to cache:', error);
    }
  }

  // Step 3: Cache → Local
  private async updateCacheToLocal(): Promise<void> {
    try {
      console.log('💾 Updating local storage from cache');
      
      const localEvents = this.getLocalOngoingEvents();
      const updatedEvents = [...localEvents];
      
      for (const cacheEvent of this.syncCache.events) {
        if (!this.isOngoingEvent(cacheEvent)) continue;
        
        const localIndex = updatedEvents.findIndex(e => e.id === cacheEvent.id);
        
        if (localIndex >= 0) {
          // 更新现有本地事件
          updatedEvents[localIndex] = cacheEvent;
        } else {
          // 添加新事件到本地
          updatedEvents.push(cacheEvent);
        }
      }
      
      // 保存到localStorage
      const allEvents = this.getAllLocalEvents();
      const ongoingEventIds = new Set(updatedEvents.map(e => e.id));
      const nonOngoingEvents = allEvents.filter(e => !ongoingEventIds.has(e.id));
      const finalEvents = [...nonOngoingEvents, ...updatedEvents];
      
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(finalEvents));
      
      // 触发事件更新
      window.dispatchEvent(new CustomEvent('ongoing-sync-completed', {
        detail: { events: finalEvents }
      }));
      
    } catch (error) {
      console.error('❌ Failed to update cache to local:', error);
    }
  }

  // Step 4: Cache → Outlook
  private async updateCacheToOutlook(): Promise<void> {
    try {
      console.log('📤 Updating Outlook from cache');
      
      for (const cacheEvent of this.syncCache.events) {
        if (!this.isOngoingEvent(cacheEvent)) continue;
        
        const needsOutlookUpdate = this.needsOutlookUpdate(cacheEvent);
        
        if (needsOutlookUpdate) {
          try {
            if (cacheEvent.externalId && cacheEvent.calendarId === 'microsoft') {
              console.log(`🔄 Updating Outlook event: ${cacheEvent.title}`);
              await this.microsoftService.updateEvent(cacheEvent.externalId, cacheEvent);
              cacheEvent.lastSyncTime = new Date();
              cacheEvent.syncStatus = 'synced';
            } else {
              console.log(`➕ Creating new Outlook event: ${cacheEvent.title}`);
              const createdEvent = await this.microsoftService.createEvent(cacheEvent);
              cacheEvent.externalId = createdEvent.id;
              cacheEvent.calendarId = 'microsoft';
              cacheEvent.lastSyncTime = new Date();
              cacheEvent.syncStatus = 'synced';
            }
          } catch (error) {
            console.error(`❌ Failed to sync event to Outlook: ${cacheEvent.title}`, error);
            cacheEvent.syncStatus = 'error';
          }
        }
      }
    } catch (error) {
      console.error('❌ Failed to update cache to Outlook:', error);
    }
  }

  // 辅助方法
  private getEventLastModified(outlookEvent: any): Date {
    return new Date(outlookEvent.lastModifiedDateTime || outlookEvent.createdDateTime || new Date());
  }

  private extractTitleFromOutlook(outlookSubject: string): string {
    if (!outlookSubject) return '';
    return outlookSubject.replace(/^🍅+\s*/, '').trim();
  }

  private extractDescription(body: string | undefined): string | undefined {
    if (!body) return undefined;
    const lines = body.split('\n');
    return lines[0]?.replace(/计时记录.*/, '').trim() || undefined;
  }

  private convertOutlookToEvent(outlookEvent: any): Event {
    return {
      id: `outlook-${outlookEvent.id}`,
      title: this.extractTitleFromOutlook(outlookEvent.subject || ''),
      description: this.extractDescription(outlookEvent.body?.content),
      startTime: new Date(outlookEvent.start?.dateTime),
      endTime: new Date(outlookEvent.end?.dateTime),
      location: outlookEvent.location?.displayName,
      isAllDay: outlookEvent.isAllDay || false,
      reminder: 0,
      syncStatus: 'synced',
      createdAt: new Date(outlookEvent.createdDateTime),
      updatedAt: new Date(outlookEvent.lastModifiedDateTime),
      externalId: outlookEvent.id,
      calendarId: 'microsoft',
      localVersion: 1,
      remoteVersion: 1,
      lastLocalChange: new Date(),
      lastRemoteChange: new Date(outlookEvent.lastModifiedDateTime),
      lastSyncTime: new Date(),
      conflictResolved: false,
      remarkableSource: true
    };
  }

  private getLocalOngoingEvents(): any[] {
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
      return events.filter((event: any) => 
        event.timerSessionId || event.id?.startsWith('timer-') || event.category === 'ongoing'
      ).map((event: any) => ({
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt),
        lastLocalChange: new Date(event.lastLocalChange || event.updatedAt),
        localVersion: event.localVersion || 1
      }));
    } catch (error) {
      console.error('Failed to get local ongoing events:', error);
      return [];
    }
  }

  private getAllLocalEvents(): any[] {
    try {
      const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
      return events.map((event: any) => ({
        ...event,
        startTime: new Date(event.startTime),
        endTime: new Date(event.endTime),
        createdAt: new Date(event.createdAt),
        updatedAt: new Date(event.updatedAt)
      }));
    } catch (error) {
      return [];
    }
  }

  private isOngoingEvent(event: Event): boolean {
    return !!(event.timerSessionId || event.id?.startsWith('timer-') || event.category === 'ongoing');
  }

  private needsOutlookUpdate(event: Event): boolean {
    if (!event.lastLocalChange) return false;
    if (!event.lastSyncTime) return true;
    return event.lastLocalChange > event.lastSyncTime;
  }

  // 设置事件更新回调
  public setEventUpdateCallback(callback: (events: any[]) => void): void {
    this.eventUpdateCallback = callback;
  }
}