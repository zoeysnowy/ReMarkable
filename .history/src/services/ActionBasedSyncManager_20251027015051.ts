import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';

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
  private lastUserActivity = Date.now(); // 🔧 [NEW] 上次用户活动时间
  private lastQueueModification = Date.now(); // 🔧 [FIX] 上次 action queue 修改时间

  constructor(microsoftService: any) {
    this.microsoftService = microsoftService;
    this.loadActionQueue();
    this.loadConflictQueue();
    this.loadDeletedEventIds(); // 🆕 加载已删除事件ID
    
    // � [NEW] 监听用户活动（用于 idle 检测）
    if (typeof window !== 'undefined') {
      const updateActivity = () => {
        this.lastUserActivity = Date.now();
      };
      
      // 监听用户交互事件
      window.addEventListener('mousemove', updateActivity, { passive: true });
      window.addEventListener('keydown', updateActivity, { passive: true });
      window.addEventListener('click', updateActivity, { passive: true });
      window.addEventListener('scroll', updateActivity, { passive: true });
      window.addEventListener('focus', updateActivity, { passive: true });
      
      console.log('✅ [Integrity] User activity tracking enabled');
    }
    
    // �🔍 [DEBUG] 暴露调试函数到全局
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
      console.log('🔍 [DEBUG] SyncManager debug functions available via window.debugSyncManager');
    }
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
        console.log(`🔍 [TAG-CALENDAR] Retrieved ${flatTags?.length || 0} tags from TagService for tagId: ${tagId}`);
        
        const foundTag = flatTags.find((tag: any) => tag.id === tagId);
        if (foundTag && foundTag.calendarMapping) {
          console.log(`✅ [TAG-CALENDAR] Found tag with calendar mapping: ${foundTag.calendarMapping.calendarId}`);
          return foundTag.calendarMapping.calendarId;
        } else {
          console.log(`⚠️ [TAG-CALENDAR] Tag found but no calendar mapping for tagId: ${tagId}`);
          return null;
        }
      } else {
        // TagService not available, falling back to localStorage
        
        // 备用方案：直接读取localStorage（使用PersistentStorage的方式）
        const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
        if (!savedTags) {
          // No hierarchical tags found in persistent storage
          return null;
        }
        
        // Loaded hierarchical tags from persistent storage
        
        // 递归搜索标签和它的日历映射
        const findTagMapping = (tags: any[], targetTagId: string): string | null => {
          for (const tag of tags) {
            // Checking tag
            
            if (tag.id === targetTagId) {
              const calendarId = tag.calendarMapping?.calendarId;
              // Found matching tag
              return calendarId || null;
            }
            
            // 检查子标签
            if (tag.children && tag.children.length > 0) {
              const childResult = findTagMapping(tag.children, targetTagId);
              if (childResult) {
                // Found in child tags
                return childResult;
              }
            }
          }
          return null;
        };
        
        const result = findTagMapping(savedTags, tagId);
        // Final result obtained
        return result;
      }
      
    } catch (error) {
      console.error('🔍 [TAG-CALENDAR] Error getting calendar mapping:', error);
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

  // 🔧 [NEW] 获取所有日历的事件（保证每个事件携带正确的 calendarId）
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

      console.log(`📊 [getAllCalendarsEvents] Fetching events from ${calendars.length} calendars...`);
      
      for (const cal of calendars) {
        const calendarId = cal.id;
        try {
          const events = await this.microsoftService.getEventsFromCalendar(calendarId, startDate, endDate);
          const enhanced = events.map((ev: any) => ({
            ...ev,
            calendarId,
            // 为每个事件附带对应标签（若有映射）
            tagId: this.findTagIdForCalendar(calendarId)
          }));
          allEvents.push(...enhanced);
        } catch (err) {
          console.warn('⚠️ [getAllCalendarsEvents] Failed fetching events for calendar', calendarId, err);
        }
      }

      console.log(`✅ [getAllCalendarsEvents] Fetched total ${allEvents.length} events from ${calendars.length} calendars`);
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
      console.log(`🧹 Cleaned up deleted event IDs: ${array.length} → ${this.deletedEventIds.size}`);
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
      const externalIdMap = new Map<string, any[]>();
      
      // 按 externalId 分组
      events.forEach((event: any) => {
        if (event.externalId) {
          const existing = externalIdMap.get(event.externalId) || [];
          existing.push(event);
          externalIdMap.set(event.externalId, existing);
        }
      });

      // 检查重复
      let duplicateCount = 0;
      const duplicateGroups: string[] = [];
      
      externalIdMap.forEach((group, externalId) => {
        if (group.length > 1) {
          duplicateCount += group.length - 1;
          duplicateGroups.push(externalId);
        }
      });

      if (duplicateCount === 0) {
        return; // 没有重复，直接返回
      }

      console.warn(`⚠️ [deduplicateEvents] Found ${duplicateCount} duplicate events in ${duplicateGroups.length} groups`);

      // 去重：每组只保留 lastSyncTime 最新的
      const uniqueEvents: any[] = [];
      const seenExternalIds = new Set<string>();
      
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
              // 当前事件更新，替换
              console.log(`🔄 [deduplicateEvents] Replacing older event`, {
                removed: existing.id,
                kept: event.id,
                externalId: event.externalId
              });
              uniqueEvents[existingIndex] = event;
            } else {
              console.log(`🗑️ [deduplicateEvents] Removing older duplicate`, {
                removed: event.id,
                kept: existing.id,
                externalId: event.externalId
              });
            }
          }
        } else {
          // 第一次见到这个 externalId
          seenExternalIds.add(event.externalId);
          uniqueEvents.push(event);
        }
      });

      // 🔧 [IndexMap 优化] 删除重复事件时更新索引
      events.forEach((event: any) => {
        if (event.externalId && seenExternalIds.has(event.externalId)) {
          const existingIndex = uniqueEvents.findIndex(e => e.externalId === event.externalId);
          if (existingIndex !== -1 && uniqueEvents[existingIndex].id !== event.id) {
            // 这是一个被去重的事件，从索引中删除
            this.removeEventFromIndex(event);
          }
        }
      });

      // 保存去重后的事件 - 因为去重可能涉及很多事件，使用完全重建
      this.saveLocalEvents(uniqueEvents, true); // rebuildIndex=true
      
      console.log(`✅ [deduplicateEvents] Removed ${events.length - uniqueEvents.length} duplicate events (${events.length} → ${uniqueEvents.length})`);
      
      // 触发事件更新通知
      window.dispatchEvent(new Event('local-events-changed'));
      
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
    console.log('🔍 [RECORD LOCAL ACTION] Called with:', {
      type,
      entityType,
      entityId,
      hasData: !!data,
      hasOldData: !!oldData,
      dataContent: data,
      oldDataContent: oldData
    });
    
    // 🔧 [FIX] 记录最近更新的事件，防止同步时误删
    if (type === 'update' && entityType === 'event') {
      this.recentlyUpdatedEvents.set(entityId, Date.now());
      console.log(`📝 [RECORD] Marked event ${entityId} as recently updated`);
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

    console.log('🔍 [RECORD LOCAL ACTION] Created action:', {
      actionId: action.id,
      type: action.type,
      entityId: action.entityId,
      fullAction: action
    });

    this.actionQueue.push(action);
    this.saveActionQueue();
    
    console.log('🔍 [RECORD LOCAL ACTION] Action queue length after push:', this.actionQueue.length);
    console.log('🔍 [RECORD LOCAL ACTION] Sync conditions:', {
      isRunning: this.isRunning,
      isSignedIn: this.microsoftService?.isSignedIn(),
      willTriggerSync: this.isRunning && this.microsoftService?.isSignedIn()
    });
    
    if (this.isRunning && this.microsoftService.isSignedIn()) {
      console.log('🔍 [RECORD LOCAL ACTION] Scheduling async syncSingleAction...');
      // 🔧 [FIX] 使用 setTimeout 0 让同步在下一个事件循环执行，不阻塞 UI
      setTimeout(() => {
        this.syncSingleAction(action);
      }, 0);
    } else {
      console.log('⚠️ [RECORD LOCAL ACTION] Sync conditions not met, action will be queued for later sync');
    }
  }

  // 检查是否需要全量同步
  private checkIfFullSyncNeeded() {
    // 移除了ongoingDays的检查，因为现在默认同步1年的数据
    // 只在首次启动时需要全量同步
    if (!this.lastSyncSettings) {
      console.log('🔄 [Sync] First time sync, marking for full sync');
      this.needsFullSync = true;
      this.lastSyncSettings = { initialized: true };
    }
  }

  public start() {
    if (this.isRunning) {
      console.log('⚠️ [ActionBasedSyncManager] Already running, skipping start()');
      return;
    }
    
    this.isRunning = true;
    console.log('🚀 [ActionBasedSyncManager] Starting sync manager...');
    
    // 检查是否需要全量同步
    this.checkIfFullSyncNeeded();
    
    // 🔧 延迟首次同步 5 秒，避免阻塞 UI 渲染
    console.log('⏰ [Sync] Scheduling first sync in 5 seconds...');
    setTimeout(() => {
      if (this.isRunning && !this.syncInProgress) {
        console.log('🔄 [Sync] Executing delayed initial sync');
        this.performSync();
      }
    }, 5000);
    
    // 设置定期增量同步（20秒一次，只同步 3 个月窗口）
    this.syncInterval = setInterval(() => {
      if (!this.syncInProgress) {
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
    console.log('🔄 [Sync] Full sync triggered by user settings change');
    this.needsFullSync = true;
    this.checkIfFullSyncNeeded();
    
    // 如果正在运行，立即执行同步
    if (this.isRunning && !this.syncInProgress) {
      this.performSync();
    }
  }

  private async performSync() {
    if (this.syncInProgress) {
      console.log('⏸️ [performSync] Sync already in progress, skipping...');
      return;
    }
    
    if (!this.microsoftService.isSignedIn()) {
      console.log('⏸️ [performSync] User not signed in, skipping...');
      return;
    }

    // 🔧 防止短时间内重复同步（最小间隔 5 秒）
    const now = Date.now();
    const timeSinceLastSync = this.lastSyncTime ? (now - this.lastSyncTime.getTime()) : Infinity;
    if (timeSinceLastSync < 5000) {
      console.log(`⏸️ [performSync] Last sync was ${Math.round(timeSinceLastSync / 1000)}s ago, skipping (minimum 5s interval)`);
      return;
    }

    this.syncInProgress = true;
    console.log('🔄 [performSync] Starting sync cycle...');
    
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
        console.log(`🧹 [Sync] Cleaned ${cleanedCount} expired recently-updated event records`);
      }
      
      await this.fetchRemoteChanges();
      await this.syncPendingLocalActions();
      await this.syncPendingRemoteActions();
      await this.resolveConflicts();
      this.cleanupSynchronizedActions();
      
      // 🔍 去重检查：防止迁移等操作产生重复事件
      this.deduplicateEvents();
      
      this.lastSyncTime = new Date();
      
      const syncDuration = performance.now() - syncStartTime;
      
      window.dispatchEvent(new CustomEvent('action-sync-completed', {
        detail: { 
          timestamp: this.lastSyncTime,
          duration: syncDuration 
        }
      }));
      
      console.log(`✅ [performSync] Sync cycle completed in ${syncDuration.toFixed(0)}ms`);
      
      // ⚠️ 如果同步时间过长，给出警告
      if (syncDuration > 3000) {
        console.warn(`⚠️ [performSync] Sync took too long: ${syncDuration.toFixed(0)}ms (threshold: 3000ms)`);
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
    } finally {
      this.syncInProgress = false;
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
        
        console.log('📅 [Sync] FULL sync from last sync time to now + 3 months:', {
          startDate: formatTimeForStorage(startDate).split('T')[0],
          endDate: formatTimeForStorage(endDate).split('T')[0],
          lastSyncTime: this.lastSyncTime ? formatTimeForStorage(this.lastSyncTime).split('T')[0] : 'never'
        });
        
        this.needsFullSync = false; // 重置标记
      } else {
        // 增量同步：只检查最近 3 个月的事件（前后各 1.5 个月）
        startDate = new Date(now);
        startDate.setMonth(now.getMonth() - 1.5);
        startDate.setHours(0, 0, 0, 0);
        
        endDate = new Date(now);
        endDate.setMonth(now.getMonth() + 1.5);
        endDate.setHours(23, 59, 59, 999);
        
        console.log('📅 [Sync] INCREMENTAL sync (3 months window):', {
          startDate: formatTimeForStorage(startDate).split('T')[0],
          endDate: formatTimeForStorage(endDate).split('T')[0],
          windowMonths: 3
        });
      }

      const localEvents = this.getLocalEvents();
      
      // 🚀 Index map is built in getLocalEvents(), ready for O(1) lookups
      console.log(`🚀 [Sync] Using index map with ${this.eventIndexMap.size} entries`);

      // 改为逐日历拉取，确保每个事件带有准确的 calendarId
      const allRemoteEvents = await this.getAllCalendarsEvents(startDate, endDate);
      
      // 🔧 [CRITICAL FIX] 如果获取失败（返回 null），中止同步以保护本地数据
      if (allRemoteEvents === null) {
        console.error('❌ [Sync] Failed to fetch remote events (possibly logged out), aborting sync to protect local data');
        return;
      }
      
      console.log('📊 [Sync] Remote events (per-calendar):', allRemoteEvents.length);
      
      // 🔧 [CRITICAL FIX] 如果远程事件为空，可能是网络错误或登出，停止同步以保护本地数据
      if (allRemoteEvents.length === 0) {
        const hasLocalEventsWithExternalId = localEvents.some((e: any) => e.externalId);
        if (hasLocalEventsWithExternalId) {
          console.warn('⚠️ [Sync] Remote returned 0 events but local has synced events - possible auth issue, aborting sync to protect local data');
          return; // ❌ 中止同步，避免误删
        }
      }
      
      const uniqueEvents = new Map();
      
      allRemoteEvents.forEach(event => {
        const key = event.externalId || event.id;
        if (key && !uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });
      
      const combinedEvents = Array.from(uniqueEvents.values());
      console.log('📊 [Sync] Combined unique events:', combinedEvents.length);
      
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

      console.log('📊 [Sync] ReMarkable events after filter:', remarkableEvents.length);
      
      // 如果有事件被过滤掉，记录一个样本事件的信息
      if (combinedEvents.length > remarkableEvents.length) {
        const filteredOut = combinedEvents.filter(e => !remarkableEvents.includes(e))[0];
        if (filteredOut) {
          console.log('🔍 [Sync] Sample filtered out event:', {
            subject: filteredOut.subject,
            start: filteredOut.start || filteredOut.startTime,
            calendarId: filteredOut.calendarId,
            externalId: filteredOut.externalId
          });
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

        // 🚀 Use index map for O(1) lookup instead of array.find()
        const existingLocal = this.eventIndexMap.get(event.id) || this.eventIndexMap.get(`outlook-${event.id}`);

        if (!existingLocal) {
          // Creating new local event from remote
          this.recordRemoteAction('create', 'event', `outlook-${event.id}`, event);
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
              // console.log(`🔍 [Sync] Update reason for "${event.subject}":`, {
              //   reason,
              //   titleChanged,
              //   descriptionChanged,
              //   significantTimeChange,
              //   timeDiffMinutes: timeDiffMinutes?.toFixed(2)
              // });
              
              // 如果是描述更改，输出详细的内容对比
              if (descriptionChanged) {
                console.log(`🔍 [Sync] Description comparison:`, {
                  remoteCoreLength: remoteCoreContent.length,
                  localCoreLength: localCoreContent.length,
                  remoteCorePreview: remoteCoreContent.substring(0, 100),
                  localCorePreview: localCoreContent.substring(0, 100),
                  remoteFullDescription: remoteRawDescription,
                  localFullDescription: localRawDescription
                });
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
      
      console.log('📊 [Sync] Actions created:', { create: createActionCount, update: updateActionCount });
      console.log('📊 [Sync] Total actions in queue:', this.actionQueue.length);

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

      // ⚠️ 删除检查逻辑：
      // 1. 获取本地事件的时间范围
      // 2. 只检查在当前同步时间窗口内的本地事件
      // 3. 如果本地事件在窗口内但remote没有 -> 说明被远程删除了
      // 4. 如果本地事件在窗口外 -> 跳过,不视为删除

      let deletionCheckCount = 0;
      let deletionFoundCount = 0;
      
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
        
        // 只检查在同步窗口内的事件
        if (isInSyncWindow) {
          const isFoundInRemote = remoteEventIds.has(cleanExternalId);
          
          if (!isFoundInRemote) {
            // 🔧 [FIX] 增加额外保护：检查事件是否最近刚更新过
            const recentlyUpdated = this.recentlyUpdatedEvents.has(localEvent.id);
            const lastUpdateTime = this.recentlyUpdatedEvents.get(localEvent.id) || 0;
            const timeSinceUpdate = Date.now() - lastUpdateTime;
            
            // 如果事件在最近30秒内被更新过，不视为删除（可能是同步延迟）
            if (recentlyUpdated && timeSinceUpdate < 30000) {
              if (deletionFoundCount < 5) {
                console.log(`⏭️ [Sync] Skipping recently updated event from deletion: "${localEvent.title}" (updated ${Math.round(timeSinceUpdate/1000)}s ago)`);
              }
              deletionCheckCount++;
              return;
            }
            
            // 🔧 [FIX] 再次确认：检查是否在已删除列表中（避免重复删除）
            if (this.deletedEventIds.has(localEvent.id)) {
              if (deletionFoundCount < 5) {
                console.log(`⏭️ [Sync] Event already marked as deleted, skipping: "${localEvent.title}"`);
              }
              deletionCheckCount++;
              return;
            }
            
            if (deletionFoundCount < 5) {
              console.log(`🗑️ [Sync] Event deleted remotely, removing locally: "${localEvent.title}"`);
            }
            this.recordRemoteAction('delete', 'event', localEvent.id, null, localEvent);
            deletionFoundCount++;
          }
          deletionCheckCount++;
        }
      });
      
      console.log(`📊 [Sync] Deletion check completed: ${deletionCheckCount} events in window checked, ${deletionFoundCount} deletions found`);

      // 🔧 只在全量同步时重置标记并输出特殊日志
      if (isFullSync) {
        // 全量同步完成，重置标记
        this.needsFullSync = false;
        console.log('✅ [FullSync] Full synchronization completed');
      } else {
        console.log('✅ [IncrementalSync] Incremental synchronization completed');
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

    for (const action of pendingLocalActions) {
      await this.syncSingleAction(action);
    }
  }

  private async syncPendingRemoteActions() {
    const pendingRemoteActions = this.actionQueue.filter(
      action => action.source === 'outlook' && !action.synchronized
    );
    
    console.log('📊 [SyncRemote] Pending remote actions:', pendingRemoteActions.length);
    
    if (pendingRemoteActions.length === 0) {
      return;
    }
    
    console.log('🔄 [SyncRemote] Processing', pendingRemoteActions.length, 'remote actions');
    
    let successCount = 0;
    let failCount = 0;
    
    // 🚀 批量模式：一次性获取localEvents，在内存中修改，最后统一保存
    let localEvents = this.getLocalEvents();
    
    for (let i = 0; i < pendingRemoteActions.length; i++) {
      const action = pendingRemoteActions[i];
      try {
        if (i < 5) {
          console.log(`🔧 [SyncRemote] [${i+1}/${pendingRemoteActions.length}] Applying action:`, action.type, action.entityId);
        }
        // 🚀 批量模式：传入localEvents，不触发UI更新，不立即保存
        localEvents = await this.applyRemoteActionToLocal(action, false, localEvents);
        
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
      console.log(`� [SyncRemote] Saving ${successCount} changes to localStorage...`);
      // 🔧 [IndexMap 优化] 批量同步后，如果操作数量较多（>5），完全重建索引
      // 如果操作较少，之前的增量更新已经足够
      const shouldRebuildIndex = successCount > 5;
      this.saveLocalEvents(localEvents, shouldRebuildIndex);
      console.log('✅ [SyncRemote] Batch save completed');
    }
    
    console.log('📊 [SyncRemote] Results:', { successCount, failCount });
    
    this.saveActionQueue();
    
    if (successCount > 0) {
      console.log('📊 [SyncRemote] Events in storage after sync:', localEvents.length);
      
      window.dispatchEvent(new CustomEvent('local-events-changed', {
        detail: { 
          action: 'remote-sync', 
          count: successCount,
          timestamp: new Date() 
        }
      }));
    }
  }

  private async syncSingleAction(action: SyncAction) {
    console.log('🔍 [SYNC SINGLE ACTION] Called with:', {
      actionId: action.id,
      type: action.type,
      entityId: action.entityId,
      source: action.source,
      synchronized: action.synchronized,
      retryCount: action.retryCount
    });
    
    // 🔧 [NEW] 跳过 syncStatus 为 'local-only' 的事件（例如：运行中的 Timer）
    if (action.data && action.data.syncStatus === 'local-only') {
      console.log('⏭️ [SYNC SINGLE ACTION] Skipping local-only event (Timer in progress):', action.entityId);
      action.synchronized = true; // 标记为已处理，防止重试
      this.saveActionQueue();
      return;
    }
    
    if (action.synchronized || action.retryCount >= 3) {
      console.log('🔍 [SYNC SINGLE ACTION] Skipping action - already synchronized or max retries reached');
      return;
    }

    try {
      if (action.source === 'local') {
        console.log('🔍 [SYNC SINGLE ACTION] Processing local action:', action.type);
        const result = await this.applyLocalActionToRemote(action);
        console.log('🔍 [SYNC SINGLE ACTION] Local action result:', result);
      } else {
        console.log('🔍 [SYNC SINGLE ACTION] Processing remote action:', action.type);
        await this.applyRemoteActionToLocal(action);
      }

      action.synchronized = true;
      action.synchronizedAt = new Date();
      this.saveActionQueue();
      console.log('✅ [SYNC SINGLE ACTION] Action completed successfully:', action.id);
      
    } catch (error) {
      console.error('❌ [SYNC SINGLE ACTION] Failed to sync action:', {
        actionId: action.id,
        type: action.type,
        error: error,
        errorMessage: error instanceof Error ? error.message : 'Unknown error'
      });
      action.retryCount++;
      this.saveActionQueue();
    }
  }

  private async applyLocalActionToRemote(action: SyncAction): Promise<boolean> {
    let syncTargetCalendarId: string | undefined; // 🔧 重命名变量避免潜在冲突
    
    try {
      console.log('🔍 [SYNC] applyLocalActionToRemote called:', {
        actionType: action.type,
        entityId: action.entityId,
        hasSource: action.source,
        hasMicrosoftService: !!this.microsoftService,
        isSignedIn: this.microsoftService?.isSignedIn(),
        simulationMode: (this.microsoftService as any)?.simulationMode
      });
      
      if (action.source !== 'local') {
        console.log('❌ [SYNC] Action source is not local:', action.source);
        return false;
      }
      
      if (!this.microsoftService) {
        console.log('❌ [SYNC] Microsoft service not available');
        return false;
      }
      
      if (!this.microsoftService.isSignedIn()) {
        console.log('❌ [SYNC] Microsoft service not signed in');
        return false;
      }

      switch (action.type) {
        case 'create':
          console.log('🔍 [SYNC CREATE] Processing create action:', {
            entityId: action.entityId,
            title: action.data.title,
            tagId: action.data.tagId,
            calendarId: action.data.calendarId,
            hasExternalId: !!action.data.externalId,
            remarkableSource: action.data.remarkableSource,
            fullActionData: action.data
          });
          
          // 检查事件是否已经同步过（有externalId）或者是从Outlook同步回来的
          if (action.data.externalId || action.data.remarkableSource === false) {
            console.log('🔄 Skipping sync - event already has externalId or is from Outlook:', action.entityId);
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
          
          // 🔍 [FIXED] 获取目标日历ID - 按需求定义处理
          syncTargetCalendarId = action.data.calendarId;
          
          if (action.data.tagId) {
            // 如果有标签，通过标签映射获取日历ID
            console.log('🔍 [SYNC] Event has tagId, getting calendar from tag mapping. TagId:', action.data.tagId);
            const mappedCalendarId = this.getCalendarIdForTag(action.data.tagId);
            if (mappedCalendarId) {
              syncTargetCalendarId = mappedCalendarId;
              console.log('🔍 [SYNC] Using calendar from tag mapping:', syncTargetCalendarId);
            } else {
              console.log('⚠️ [SYNC] Tag has no calendar mapping, keeping original calendar');
            }
          } else {
            // 🚨 关键修复：如果没有标签，保持在原日历，不要移动到默认日历
            console.log('🔍 [SYNC] Event has no tagId, keeping original calendarId to prevent unwanted migration');
          }
          
          // 🚨 只有在真的没有任何日历信息时才使用默认日历（全新创建的事件）
          if (!syncTargetCalendarId) {
            console.log('🔍 [SYNC] No calendar ID at all (new event), using default calendar');
            syncTargetCalendarId = this.microsoftService.getSelectedCalendarId();
          }
          
          console.log('🎯 [EVENT SYNC] Final calendar assignment:', {
            eventTitle: action.data.title,
            eventId: action.entityId,
            originalCalendarId: action.data.calendarId,
            tagId: action.data.tagId,
            finalTargetCalendarId: syncTargetCalendarId,
            isTimerEvent: action.data.timerSessionId ? true : false,
            actionData: action.data
          });
          
          const newEventId = await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId || 'primary');
          
          if (newEventId) {
            this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
            return true;
          }
          break;

        case 'update':
          // 🚨 [REBUILT] 重构的 UPDATE 逻辑 - 按用户要求的5级优先级结构
          console.log('🎯 [UPDATE] === UPDATE 决策流程开始 ===');
          console.log('🔍 [UPDATE] Processing update action:', {
            entityId: action.entityId,
            title: action.data.title,
            tagId: action.data.tagId,
            calendarId: action.data.calendarId,
            hasDataExternalId: !!action.data.externalId,
            hasOriginalExternalId: !!action.originalData?.externalId
          });

          // 📊 [PRIORITY 0] 最高优先级：用户数据保护 - 保存操作到本地永久存储
          try {
            console.log('💾 [PRIORITY 0] Saving user operation to persistent local storage...');
            
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
                syncStatus: 'pending-update'
              };
              
              priorityLocalEvents[eventIndex] = updatedEvent;
              
              // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
              this.updateEventInIndex(updatedEvent, oldEvent);
              this.saveLocalEvents(priorityLocalEvents, false); // rebuildIndex=false
              
              console.log('✅ [PRIORITY 0] User data protected and saved locally with incremental index update');
            }
          } catch (storageError) {
            console.error('❌ [PRIORITY 0] Failed to save user data locally:', storageError);
            // 即使本地保存失败，也要继续同步，但添加冲突标记
            if (!action.data.title.includes('⚠️同步冲突')) {
              action.data.title = '⚠️同步冲突 - ' + action.data.title;
              console.log('🚨 [PRIORITY 0] Added conflict marker to title');
            }
          }

          // 🔍 [PRIORITY 1] 最高优先级：检查事件基础状态
          console.log('🔍 [PRIORITY 1] === 事件基础状态检查 ===');
          console.log('🆕 [DEBUG] NEW UPDATE LOCK LOGIC LOADED - Version 2.0');
          
          // 1️⃣ 编辑锁定检查 - 对于UPDATE操作，清除之前的锁定以允许远程同步
          const lockStatus = this.editLocks.get(action.entityId);
          const currentTime = Date.now();
          console.log('🔍 [LOCK DEBUG] Edit lock status:', {
            entityId: action.entityId.substring(0, 20) + '...',
            hasLock: !!lockStatus,
            lockExpiry: lockStatus,
            currentTime: currentTime,
            isExpired: lockStatus ? currentTime > lockStatus : 'N/A',
            timeToExpiry: lockStatus ? (lockStatus - currentTime) / 1000 + 's' : 'N/A'
          });
          
          if (this.isEditLocked(action.entityId)) {
            console.log('🔒 [PRIORITY 1] ✨ NEW LOGIC: Event was edit-locked, clearing lock for UPDATE sync');
            this.clearEditLock(action.entityId);
          } else {
            console.log('🔓 [PRIORITY 1] ✨ NEW LOGIC: No edit lock found, proceeding with sync');
          }
          
          // 为当前更新操作设置编辑锁定
          this.setEditLock(action.entityId, 15000); // 15秒锁定期
          console.log('🔒 [LOCK DEBUG] Set new edit lock for 15 seconds');

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
          
          console.log('🔍 [PRIORITY 1] ExternalId analysis:', {
            dataExternalId: action.data.externalId,
            originalExternalId: action.originalData?.externalId,
            currentLocalEventExternalId: currentLocalEvent?.externalId, // 🔧 新增日志
            finalCleanExternalId: cleanExternalId,
            decision: cleanExternalId ? 'PROCEED_WITH_UPDATE' : 'CONVERT_TO_CREATE'
          });
          
          // 🔄 如果没有 externalId，转为 CREATE 操作（首次同步）
          if (!cleanExternalId) {
            console.log('🔄 [PRIORITY 1] No externalId found - Converting UPDATE → CREATE (first-time sync)');
            
            // 执行 CREATE 逻辑（复用现有的 create 分支逻辑）
            
            // 🔍 [NEW] 检查是否有旧的 externalId 需要清理（可能在其他日历中存在）
            // 这种情况可能发生在标签映射更改导致事件需要迁移到新日历时
            if (action.originalData?.externalId) {
              let oldExternalId = action.originalData.externalId;
              if (oldExternalId.startsWith('outlook-')) {
                oldExternalId = oldExternalId.replace('outlook-', '');
              }
              
              console.log('🗑️ [SYNC UPDATE → CREATE] Found old externalId, cleaning up before create:', oldExternalId);
              try {
                await this.microsoftService.deleteEvent(oldExternalId);
                console.log('✅ [SYNC UPDATE → CREATE] Successfully deleted old event from Outlook');
              } catch (error) {
                console.warn('⚠️ [SYNC UPDATE → CREATE] Failed to delete old event (may not exist):', error);
                // 继续执行，不影响新事件的创建
              }
            }
            
            // 🔍 [FIXED] 获取目标日历ID - 按需求定义处理（UPDATE → CREATE转换）
            syncTargetCalendarId = action.data.calendarId;
            
            if (action.data.tagId) {
              // 如果有标签，通过标签映射获取日历ID
              console.log('🔍 [SYNC CREATE] Event has tagId, getting calendar from tag mapping. TagId:', action.data.tagId);
              const mappedCalendarId = this.getCalendarIdForTag(action.data.tagId);
              if (mappedCalendarId) {
                syncTargetCalendarId = mappedCalendarId;
                console.log('🔍 [SYNC CREATE] Using calendar from tag mapping:', syncTargetCalendarId);
              } else {
                console.log('⚠️ [SYNC CREATE] Tag has no calendar mapping, keeping original calendar');
              }
            } else {
              // 🚨 关键修复：如果没有标签，保持在原日历
              console.log('🔍 [SYNC CREATE] Event has no tagId, keeping original calendarId to prevent unwanted migration');
            }
            
            // 🚨 只有在真的没有任何日历信息时才使用默认日历
            if (!syncTargetCalendarId) {
              console.log('🔍 [SYNC CREATE] No calendar ID at all, using default calendar');
              syncTargetCalendarId = this.microsoftService.getSelectedCalendarId();
            }
            
            console.log('🎯 [EVENT SYNC] Final calendar assignment for create:', {
              eventTitle: action.data.title,
              eventId: action.entityId,
              originalCalendarId: action.data.calendarId,
              tagId: action.data.tagId,
              finalTargetCalendarId: syncTargetCalendarId,
              hadOldExternalId: !!action.originalData?.externalId
            });
            
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
            
            const newEventId = await this.microsoftService.syncEventToCalendar(eventData, syncTargetCalendarId || 'primary');
            
            if (newEventId) {
              this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
              if (syncTargetCalendarId) {
                this.updateLocalEventCalendarId(action.entityId, syncTargetCalendarId);
              }
              this.clearEditLock(action.entityId);
              console.log('✅ [PRIORITY 1] UPDATE → CREATE completed successfully');
              
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
          console.log('🏷️ [PRIORITY 2] === 标签日历映射检查 ===');
          
          const currentCalendarId = action.data.calendarId;
          let needsCalendarMigration = false;
          syncTargetCalendarId = currentCalendarId;
          
          // 🎯 确定要检查的标签ID（优先使用 tags 数组的第一个标签）
          let tagToCheck = action.data.tagId;
          if (action.data.tags && action.data.tags.length > 0) {
            tagToCheck = action.data.tags[0];
            console.log('🏷️ [PRIORITY 2] Using first tag from tags array:', tagToCheck);
          }
          
          // 🔍 获取原始事件的标签（用于比较）
          let originalTagToCheck = action.originalData?.tagId;
          if (action.originalData?.tags && action.originalData.tags.length > 0) {
            originalTagToCheck = action.originalData.tags[0];
          }
          
          if (tagToCheck) {
            console.log('🔍 [PRIORITY 2] Checking tag mapping:', {
              currentTag: tagToCheck,
              originalTag: originalTagToCheck,
              tagsChanged: tagToCheck !== originalTagToCheck
            });
            
            const mappedCalendarId = this.getCalendarIdForTag(tagToCheck);
            
            // 🎯 获取原始标签映射的日历（如果标签没变，就不需要迁移）
            let originalMappedCalendarId = currentCalendarId;
            if (originalTagToCheck) {
              originalMappedCalendarId = this.getCalendarIdForTag(originalTagToCheck) || currentCalendarId;
            }
            
            console.log('🔍 [PRIORITY 2] Calendar mapping comparison:', {
              currentCalendar: currentCalendarId || 'None',
              originalMappedCalendar: originalMappedCalendarId || 'None',
              newMappedCalendar: mappedCalendarId || 'None',
              actuallyNeedsMigration: !!(mappedCalendarId && mappedCalendarId !== originalMappedCalendarId)
            });
            
            // ✅ 智能迁移检测：只有当新旧映射的日历真的不同时才迁移
            if (mappedCalendarId && mappedCalendarId !== originalMappedCalendarId) {
              needsCalendarMigration = true;
              syncTargetCalendarId = mappedCalendarId;
              
              console.log('🔄 [PRIORITY 2] Smart migration required (calendar actually changed):', {
                from: originalMappedCalendarId || 'Default',
                to: mappedCalendarId,
                eventTitle: action.data.title,
                tagId: tagToCheck,
                externalId: cleanExternalId,
                reason: 'Tag changed AND calendar mapping changed'
              });
              
              try {
                // 删除原日历中的事件
                console.log('🗑️ [PRIORITY 2] Deleting from original calendar...');
                await this.microsoftService.deleteEvent(cleanExternalId);
                console.log('✅ [PRIORITY 2] Successfully deleted from original calendar');
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
                
                console.log('✨ [PRIORITY 2] Creating in new calendar:', syncTargetCalendarId);
                const newEventId = await this.microsoftService.syncEventToCalendar(migrateEventData, syncTargetCalendarId);
                
                if (newEventId) {
                  // 🔧 确保external ID有正确的前缀格式
                  const formattedExternalId = `outlook-${newEventId}`;
                  this.updateLocalEventExternalId(action.entityId, formattedExternalId, migrateDescription);
                  this.updateLocalEventCalendarId(action.entityId, syncTargetCalendarId);
                  this.clearEditLock(action.entityId);
                  console.log('✅ [PRIORITY 2] Calendar migration completed successfully:', {
                    eventId: action.entityId,
                    newExternalId: formattedExternalId,
                    targetCalendarId: syncTargetCalendarId
                  });
                  
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
              console.log('✅ [PRIORITY 2] No migration needed (calendar mapping unchanged):', {
                originalTag: originalTagToCheck,
                newTag: tagToCheck,
                sameCalendar: mappedCalendarId,
                eventTitle: action.data.title,
                reason: 'Tag changed but both tags map to same calendar'
              });
              syncTargetCalendarId = mappedCalendarId;
            } else if (mappedCalendarId && !cleanExternalId) {
              console.log('🔄 [TAG-CALENDAR-UPDATE] Event not synced yet, updating calendarId for future sync');
              // 如果事件还没有同步到 Outlook，只更新本地的 calendarId
              this.updateLocalEventCalendarId(action.entityId, mappedCalendarId);
            }
          }
          
          // � [PRIORITY 3] 中等优先级：字段更新处理
          console.log('📝 [PRIORITY 3] === 字段更新处理 ===');
          
          // 3️⃣ 构建更新数据
          const updateData: any = {};
          
          // � 文本字段处理
          console.log('📝 [PRIORITY 3] Processing text fields...');
          if (action.data.title) {
            updateData.subject = action.data.title;
            console.log('📝 Title updated:', action.data.title);
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
            console.log('📝 Description updated with sync notes');
          }
          
          if (action.data.location !== undefined) {
            if (action.data.location) {
              updateData.location = { displayName: action.data.location };
              console.log('📝 Location updated:', action.data.location);
            } else {
              updateData.location = null; // 清空位置
              console.log('📝 Location cleared');
            }
          }
          
          
          // ⏰ 时间字段处理
          console.log('⏰ [PRIORITY 3] Processing time fields...');
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
              
              console.log('⏰ Time fields validated and updated:', {
                start: startDateTime,
                end: endDateTime
              });
              
              console.log('✅ [Update] Time fields successfully added to update data');
              
            } catch (timeError) {
              console.error('❌ [PRIORITY 3] Time validation failed:', timeError);
              this.clearEditLock(action.entityId);
              throw new Error(`Time update failed: ${timeError instanceof Error ? timeError.message : 'Invalid time data'}`);
            }
          }
          
          // 🏷️ 元数据字段处理
          if (typeof action.data.isAllDay === 'boolean') {
            updateData.isAllDay = action.data.isAllDay;
            console.log('🏷️ All-day flag updated:', action.data.isAllDay);
          }
          
          // 🎯 [PRIORITY 4] 标准优先级：执行更新操作
          console.log('🎯 [PRIORITY 4] === 执行更新操作 ===');
          console.log('🎯 Sending update to Outlook:', {
            externalId: cleanExternalId,
            fieldsToUpdate: Object.keys(updateData),
            updateData: JSON.stringify(updateData, null, 2)
          });
          
          try {
            const updateResult = await this.microsoftService.updateEvent(cleanExternalId, updateData);
            
            if (updateResult) {
              this.clearEditLock(action.entityId);
              console.log('✅ [PRIORITY 4] Update operation completed successfully');
              
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
              console.log('🔄 [PRIORITY 4] Event not found - Converting to CREATE operation');
              
              try {
                  // 🔍 [FIXED] 获取重建事件的日历ID - 按需求定义处理
                let createCalendarId = syncTargetCalendarId;
                
                if (action.data.tagId) {
                  // 如果有标签，通过标签映射获取日历ID
                  console.log('🔍 [RECREATE] Event has tagId, getting calendar from tag mapping. TagId:', action.data.tagId);
                  const mappedCalendarId = this.getCalendarIdForTag(action.data.tagId);
                  if (mappedCalendarId) {
                    createCalendarId = mappedCalendarId;
                    console.log('🔍 [RECREATE] Using calendar from tag mapping:', createCalendarId);
                  } else {
                    console.log('⚠️ [RECREATE] Tag has no calendar mapping, keeping original calendar');
                  }
                } else {
                  // 🚨 关键修复：如果没有标签，保持在原日历
                  console.log('🔍 [RECREATE] Event has no tagId, keeping original calendarId to prevent unwanted migration');
                }
                
                // 🚨 只有在真的没有任何日历信息时才使用默认日历
                if (!createCalendarId) {
                  console.log('🔍 [RECREATE] No calendar ID at all, using default calendar');
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
              
                const recreatedEventId = await this.microsoftService.syncEventToCalendar(recreateEventData, createCalendarId || 'primary');
                
                if (recreatedEventId) {
                  this.updateLocalEventExternalId(action.entityId, recreatedEventId, recreateDescription);
                  if (createCalendarId) {
                    this.updateLocalEventCalendarId(action.entityId, createCalendarId);
                  }
                  this.clearEditLock(action.entityId);
                  console.log('✅ [PRIORITY 4] Successfully recreated event after not found error');
                  
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
            console.log('🔧 [PRIORITY 4] Attempting minimal update (title + description only)...');
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
                console.log('✅ [PRIORITY 4] Minimal update succeeded');
                
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
              if (!conflictLocalEvents[conflictEventIndex].title.includes('⚠️同步冲突')) {
                const oldConflictEvent = { ...conflictLocalEvents[conflictEventIndex] };
                
                conflictLocalEvents[conflictEventIndex].title = '⚠️同步冲突 - ' + conflictLocalEvents[conflictEventIndex].title;
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
          console.log('📊 [PRIORITY 5] Update process completed');
          break;

        case 'delete':
          console.log('🗑️ [DELETE] Processing delete action:', {
            entityId: action.entityId,
            hasOriginalData: !!action.originalData,
            originalDataExternalId: action.originalData?.externalId,
            actionData: action.data,
            fullAction: action
          });
          
          // 🔍 首先检查本地存储中的externalId（类似UPDATE的逻辑）
          const deleteLocalEvents = this.getLocalEvents();
          const deleteTargetEvent = deleteLocalEvents.find((e: any) => e.id === action.entityId);
          
          let externalIdToDelete = action.originalData?.externalId || 
                                  action.data?.externalId || 
                                  deleteTargetEvent?.externalId;
          
          console.log('🔍 [DELETE] ExternalId resolution:', {
            fromOriginalData: action.originalData?.externalId,
            fromActionData: action.data?.externalId,
            fromLocalEvent: deleteTargetEvent?.externalId,
            finalExternalId: externalIdToDelete
          });
          
          if (externalIdToDelete) {
            // 清理externalId，移除可能的前缀
            let cleanExternalId = externalIdToDelete;
            if (cleanExternalId.startsWith('outlook-')) {
              cleanExternalId = cleanExternalId.replace('outlook-', '');
            }
            
            console.log('🗑️ [DELETE] Attempting to delete from Outlook:', {
              originalId: externalIdToDelete,
              cleanId: cleanExternalId,
              eventTitle: deleteTargetEvent?.title || 'Unknown'
            });
            
            try {
              await this.microsoftService.deleteEvent(cleanExternalId);
              console.log('✅ [DELETE] Successfully deleted event from Outlook:', cleanExternalId);
              
              // 🆕 添加到已删除事件ID跟踪
              this.deletedEventIds.add(cleanExternalId);
              this.deletedEventIds.add(externalIdToDelete); // 也添加原始格式
              this.saveDeletedEventIds();
              console.log('📝 [DELETE] Added to deleted events tracking:', cleanExternalId);
              
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
              
              return false;
            }
          } else {
            console.log('⚠️ [DELETE] No externalId found for delete action, treating as local-only deletion');
            
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
        
        // 🔧 提取纯 Outlook ID（去掉 outlook- 前缀）
        const rawRemoteId = action.data?.id?.startsWith('outlook-') 
          ? action.data.id.replace('outlook-', '') 
          : action.data?.id;
        
        // 🚀 Use hash map lookup instead of array.find() - O(1) instead of O(n)
        const existingEvent = this.eventIndexMap.get(rawRemoteId) || this.eventIndexMap.get(newEvent.id);
        
        if (!existingEvent) {
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
        }
        break;

      case 'update':
        // Processing update action for event
        
        // 🔧 对于本地发起的远程更新回写，不检查编辑锁定
        // 只有真正的远程冲突更新才需要锁定保护
        if (action.source === 'outlook' && this.isEditLocked(action.entityId)) {
          console.log('🔒 [RemoteToLocal] Event is edit-locked, skipping remote conflict update:', action.entityId);
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
            startTime: this.safeFormatDateTime(action.data.start?.dateTime || action.data.start),
            endTime: this.safeFormatDateTime(action.data.end?.dateTime || action.data.end),
            location: action.data.location?.displayName || '',
            isAllDay: action.data.isAllDay || false,
            updatedAt: new Date(),
            lastSyncTime: new Date(),
            syncStatus: 'synced'
            // 🔧 不覆盖 source, calendarId, externalId 等字段
          };
          
          events[eventIndex] = updatedEvent;
          
          // � [IndexMap 优化] 更新事件索引
          this.updateEventInIndex(updatedEvent, oldEvent);
          
          // �🚀 只在非批量模式下立即保存，使用增量更新
          if (!isBatchMode) {
            this.saveLocalEvents(events, false); // rebuildIndex=false
          }
          
          // Event updated successfully
          
          if (triggerUI) {
            this.triggerUIUpdate('update', updatedEvent);
          }
        } else {
          console.log('⚠️ [RemoteToLocal] Event not found for update:', action.entityId);
        }
        break;

      case 'delete':
        console.log('🗑️ [RemoteToLocal] Processing delete action for event:', action.entityId);
        const eventToDeleteIndex = events.findIndex((e: any) => e.id === action.entityId);
        if (eventToDeleteIndex !== -1) {
          const eventToDelete = events[eventToDeleteIndex];
          console.log('🗑️ [RemoteToLocal] Found event to delete:', {
            index: eventToDeleteIndex,
            title: eventToDelete.title,
            id: eventToDelete.id
          });
          
          // 🔧 [IndexMap 优化] 删除前从索引中移除
          this.removeEventFromIndex(eventToDelete);
          
          events.splice(eventToDeleteIndex, 1);
          
          // 🚀 只在非批量模式下立即保存，使用增量更新
          if (!isBatchMode) {
            this.saveLocalEvents(events, false); // rebuildIndex=false
            console.log('✅ [RemoteToLocal] Event deleted from local storage with incremental index update, remaining events:', events.length);
          }
          
          if (triggerUI) {
            this.triggerUIUpdate('delete', { id: action.entityId, title: eventToDelete.title });
          }
          if (!isBatchMode) {
            console.log('✅ [RemoteToLocal] UI update triggered for deletion');
          }
        } else {
          console.log('⚠️ [RemoteToLocal] Event not found for deletion:', action.entityId);
        }
        break;
    }
    
    // 🚀 返回修改后的events（用于批量模式）
    return events;
  }

  private triggerUIUpdate(actionType: string, eventData: any) {
    // Triggering UI update
    
    // ❌ 移除：不应该在每个操作时触发同步完成事件
    // window.dispatchEvent(new CustomEvent('outlook-sync-completed', {
    //   detail: { action: actionType, event: eventData, timestamp: new Date() }
    // }));
    
    // ❌ 移除：不应该在每个操作时触发同步完成事件
    // window.dispatchEvent(new CustomEvent('action-sync-completed', {
    //   detail: { action: actionType, event: eventData, timestamp: new Date() }
    // }));
    
    // ✅ 只触发本地事件变更通知
    window.dispatchEvent(new CustomEvent('local-events-changed', {
      detail: { action: actionType, event: eventData, timestamp: new Date() }
    }));
    
    // UI update events dispatched successfully
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
      
      // 🚀 Build index map for O(1) lookups
      this.rebuildEventIndexMap(events);
      
      return events;
    } catch {
      return [];
    }
  }

  // 🚀 Rebuild the event index map from events array
  // 🔧 [FIX] 优化：使用临时 Map，避免清空现有 Map 导致查询失败
  private rebuildEventIndexMap(events: any[]) {
    const newMap = new Map<string, any>();
    
    events.forEach(event => {
      if (event.id) {
        newMap.set(event.id, event);
      }
      if (event.externalId) {
        newMap.set(event.externalId, event);
      }
    });
    
    // 一次性替换，避免中间状态
    this.eventIndexMap.clear();
    newMap.forEach((value, key) => {
      this.eventIndexMap.set(key, value);
    });
    
    console.log(`🚀 [IndexMap] Rebuilt index with ${this.eventIndexMap.size} entries for ${events.length} events`);
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
    
    // 🚀 只在需要时重建索引（批量操作时应该传 false，然后手动调用 rebuildEventIndexMap）
    if (rebuildIndex) {
      this.rebuildEventIndexMap(events);
      // 🔧 [NEW] 重建索引视为重启，重置计数器
      this.incrementalUpdateCount = 0;
      this.fullCheckCompleted = true; // 重建索引后视为完成了完整检查
    } else {
      // 🔧 [NEW] 增量更新计数
      this.incrementalUpdateCount++;
      
      // 🔧 [NEW] 如果增量更新超过 30 次，标记需要全量检查
      if (this.incrementalUpdateCount > 30 && this.fullCheckCompleted) {
        console.log(`⚠️ [Integrity] ${this.incrementalUpdateCount} incremental updates, full check recommended`);
        this.fullCheckCompleted = false; // 触发下次完整检查
      }
    }
  }

  private updateLocalEventExternalId(localEventId: string, externalId: string, description?: string) {
    console.log('🔧 [updateLocalEventExternalId] Called with:', {
      localEventId,
      externalId,
      hasDescription: !!description
    });
    
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === localEventId);
        
        console.log('🔍 [updateLocalEventExternalId] Event search result:', {
          eventIndex,
          totalEvents: events.length,
          searchingForId: localEventId
        });
        
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
            
            console.log('✅ [updateLocalEventExternalId] Updated event (after removing duplicate) with incremental index update:', {
              eventId: localEventId,
              externalId,
              eventTitle: events[adjustedIndex].title
            });
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
            
            console.log('✅ [updateLocalEventExternalId] Updated event with incremental index update:', {
              eventId: localEventId,
              externalId,
              eventTitle: events[eventIndex].title,
              beforeExternalId: oldEvent.externalId
            });
          }
          
          // 🔧 [IndexMap 优化] 使用增量更新而非完全重建
          this.saveLocalEvents(events, false); // rebuildIndex=false
          
          window.dispatchEvent(new CustomEvent('local-events-changed', {
            detail: { eventId: localEventId, externalId, description }
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
          
          console.log('✅ [updateLocalEventCalendarId] Updated event calendar ID with incremental index update:', {
            eventId: localEventId,
            eventTitle: events[eventIndex].title,
            newCalendarId: calendarId
          });
          
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
    
    console.log('🔧 [ConvertRemoteToLocal] Converting event:', {
      eventId: remoteEvent.id,
      title: cleanTitle,
      bodyContent: remoteEvent.body?.content || '[empty]',
      description: remoteEvent.description || '[empty]',
      bodyPreview: remoteEvent.bodyPreview || '[empty]',
      selectedContent: htmlContent
    });
    
    const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync', remoteEvent);
    
    // 检查是否是ReMarkable创建的事件（通过描述中的标记判断）
    const isReMarkableCreated = this.hasCreateNote(cleanDescription) && 
                               cleanDescription.includes('由 🔮 ReMarkable 创建');
    
    return {
      id: `outlook-${remoteEvent.id}`,
      title: cleanTitle,
      description: cleanDescription,
      startTime: this.safeFormatDateTime(remoteEvent.start?.dateTime || remoteEvent.start),
      endTime: this.safeFormatDateTime(remoteEvent.end?.dateTime || remoteEvent.end),
      isAllDay: remoteEvent.isAllDay || false,
      location: remoteEvent.location?.displayName || '',
      reminder: 0,
      createdAt: this.safeFormatDateTime(remoteEvent.createdDateTime || new Date()),
      updatedAt: this.safeFormatDateTime(remoteEvent.lastModifiedDateTime || new Date()),
      externalId: remoteEvent.id,
      calendarId: remoteEvent.calendarId || 'microsoft', // 🔧 保留原来的calendarId
      source: 'outlook', // 🔧 设置source字段
      syncStatus: 'synced',
      remarkableSource: isReMarkableCreated, // 根据描述内容判断来源
      category: 'ongoing'
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
    console.log(`📋 Action queue: ${this.actionQueue.length} items`);
    const pending = this.actionQueue.filter(a => !a.synchronized);
    if (pending.length > 0) {
      console.log(`⏳ Pending: ${pending.length} actions`);
    }
  }

  public async performSyncNow(): Promise<void> {
    if (!this.syncInProgress) {
      await this.performSync();
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
      await this.performSync();
    }
  }

  /**
   * 处理标签映射变化，移动相关事件到新日历
   */
  public async handleTagMappingChange(tagId: string, mapping: { calendarId: string; calendarName: string } | null): Promise<void> {
    try {
      console.log(`🔄 [ActionBasedSyncManager] Handling tag mapping change for ${tagId}`);
      
      // 获取所有本地事件
      const events = this.getLocalEvents();
      const eventsToMove = events.filter((event: any) => event.tagId === tagId && event.id.startsWith('outlook-'));
      
      if (eventsToMove.length === 0) {
        console.log(`📭 [ActionBasedSyncManager] No events found for tag ${tagId}`);
        return;
      }
      
      console.log(`📋 [ActionBasedSyncManager] Found ${eventsToMove.length} events to move for tag ${tagId}`);
      
      for (const event of eventsToMove) {
        if (mapping) {
          // 移动到新日历
          await this.moveEventToCalendar(event, mapping.calendarId);
        } else {
          // 如果取消映射，移动到默认日历
          console.log(`🔄 [ActionBasedSyncManager] Removing calendar mapping for event ${event.title}`);
          // 这里可以根据需要决定是否移动到默认日历
        }
      }
      
      console.log(`✅ [ActionBasedSyncManager] Completed tag mapping change for ${tagId}`);
    } catch (error) {
      console.error(`❌ [ActionBasedSyncManager] Failed to handle tag mapping change:`, error);
    }
  }

  /**
   * 移动事件到指定日历
   */
  private async moveEventToCalendar(event: any, targetCalendarId: string): Promise<void> {
    try {
      console.log(`🔄 [ActionBasedSyncManager] Moving event "${event.title}" to calendar ${targetCalendarId}`);
      
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
        
        console.log(`✅ [ActionBasedSyncManager] Successfully moved event "${event.title}" to new calendar`);
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
          console.log(`🔄 [ActionBasedSyncManager] Event ID changed: ${oldEventId} -> ${updatedEvent.id}`);
          
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
            
            console.log(`✅ [ActionBasedSyncManager] Replaced event with incremental index update: removed ${oldEventId}, added ${updatedEvent.id}`);
          } else {
            // 如果新ID已存在，更新现有事件
            const oldExisting = { ...events[existingIndex] };
            events[existingIndex] = updatedEvent;
            
            // 🔧 [IndexMap 优化] 更新现有事件索引
            this.updateEventInIndex(updatedEvent, oldExisting);
            
            console.log(`🔀 [ActionBasedSyncManager] Updated existing event with incremental index update: ${updatedEvent.id}`);
          }
          
          // 记录旧事件ID为已删除
          this.deletedEventIds.add(oldEventId);
          this.saveDeletedEventIds();
        } else {
          // ID没有变化，直接更新
          events[eventIndex] = updatedEvent;
          
          // 🔧 [IndexMap 优化] 更新事件索引
          this.updateEventInIndex(updatedEvent, oldEvent);
          
          console.log(`📝 [ActionBasedSyncManager] Updated local event with incremental index update: ${oldEventId}`);
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

    console.log('✅ [Integrity] Scheduler started (30-second interval, <10ms per check)');
  }

  /**
   * 🔧 检查是否处于空闲状态
   * 🔧 [FIX] 空闲标准：用户 15 秒无活动（原来是 5 秒）
   */
  private isUserIdle(): boolean {
    const idleThreshold = 60000; // 🔧 60 秒无活动视为 idle（避免打断用户操作）
    const idleTime = Date.now() - this.lastUserActivity;
    return idleTime >= idleThreshold;
  }

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
        console.log('⏸️ [Integrity] Skipping check: User not authenticated');
        return;
      }
    }
    
    // 🔧 [NEW] 条件 0.5: 检查是否有 Modal 打开（用户正在编辑）
    if (typeof document !== 'undefined') {
      const hasOpenModal = document.querySelector('.event-edit-modal-overlay') !== null ||
                          document.querySelector('.settings-modal') !== null ||
                          document.querySelector('[role="dialog"]') !== null;
      if (hasOpenModal) {
        console.log('⏸️ [Integrity] Skipping check: Modal is open (user is editing)');
        return;
      }
    }
    
    // 条件 1: 不在同步中
    if (this.syncInProgress) {
      return;
    }

    // 条件 2: 用户处于空闲状态（60 秒无活动）
    if (!this.isUserIdle()) {
      return;
    }

    // 条件 3: 距离上次检查至少 30 秒（原来是 5 秒）
    const now = Date.now();
    if (now - this.lastIntegrityCheck < 30000) {
      return;
    }
    
    // 🔧 [FIX] 条件 4: 确保没有正在进行的操作（如事件编辑、删除等）
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

    console.log(`🔍 [Integrity] Full check batch ${start}-${end}/${events.length}`);

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
      
      console.log(`✅ [Integrity] Full check completed: ${events.length} events, ${issues.length} issues, ${healthScore}/100 health (${duration.toFixed(1)}ms)`);
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

    console.log(`🔍 [Integrity] Quick check: ${visibleEvents.length}/${events.length} visible events`);

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
        console.warn('⚠️ [Integrity] IndexMap empty, rebuilding silently...');
        // 🔧 [FIX] 静默重建，不触发任何事件
        this.rebuildEventIndexMap(events);
        this.fullCheckCompleted = true;
      } else if (indexSize > expectedMax * 1.5) {
        console.warn(`⚠️ [Integrity] IndexMap too large (${indexSize} entries for ${events.length} events)`);
      }
    }

    const healthScore = issues.length === 0 ? 100 : Math.max(0, 100 - issues.length * 10);
    this.lastHealthScore = healthScore;

    // 🔧 [FIX] 只在有实际问题且问题数量 > 0 时才打印日志
    if (checked > 0) {
      console.log(`✅ [Integrity] Quick check: ${checked} fixed silently (${duration.toFixed(1)}ms)`);
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
