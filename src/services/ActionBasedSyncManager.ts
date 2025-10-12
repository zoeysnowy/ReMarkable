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

  constructor(microsoftService: any) {
    this.microsoftService = microsoftService;
    this.loadActionQueue();
    this.loadConflictQueue();
    this.loadDeletedEventIds(); // 🆕 加载已删除事件ID
    
    // 🔍 [DEBUG] 暴露调试函数到全局
    if (typeof window !== 'undefined') {
      (window as any).debugSyncManager = {
        getActionQueue: () => this.actionQueue,
        getConflictQueue: () => this.conflictQueue,
        isRunning: () => this.isRunning,
        isSyncInProgress: () => this.syncInProgress,
        getLastSyncTime: () => this.lastSyncTime,
        triggerSync: () => this.performSync(),
        checkTagMapping: (tagId: string) => this.getCalendarIdForTag(tagId)
      };
      console.log('🔍 [DEBUG] SyncManager debug functions available via window.debugSyncManager');
    }
  }

  // 🔍 [NEW] 获取标签的日历映射
  private getCalendarIdForTag(tagId: string): string | null {
    console.log('🔍 [TAG-CALENDAR] Getting calendar ID for tag:', tagId);
    
    if (!tagId) {
      console.log('🔍 [TAG-CALENDAR] No tagId provided, returning null');
      return null;
    }
    
    try {
      // 🔧 修复：使用TagService获取标签，而不是直接读取localStorage
      if (typeof window !== 'undefined' && (window as any).TagService) {
        const flatTags = (window as any).TagService.getFlatTags();
        console.log('🔍 [TAG-CALENDAR] Retrieved tags from TagService:', flatTags.length);
        
        const foundTag = flatTags.find((tag: any) => tag.id === tagId);
        if (foundTag && foundTag.calendarMapping) {
          console.log('🔍 [TAG-CALENDAR] Found tag with calendar mapping:', {
            tagName: foundTag.name,
            calendarId: foundTag.calendarMapping.calendarId,
            calendarName: foundTag.calendarMapping.calendarName
          });
          return foundTag.calendarMapping.calendarId;
        } else {
          console.log('🔍 [TAG-CALENDAR] Tag found but no calendar mapping:', foundTag?.name || 'Tag not found');
          return null;
        }
      } else {
        console.log('🔍 [TAG-CALENDAR] TagService not available, falling back to localStorage');
        
        // 备用方案：直接读取localStorage（使用PersistentStorage的方式）
        const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
        if (!savedTags) {
          console.log('🔍 [TAG-CALENDAR] No hierarchical tags found in persistent storage');
          return null;
        }
        
        console.log('🔍 [TAG-CALENDAR] Loaded hierarchical tags from persistent storage:', savedTags.length);
        
        // 递归搜索标签和它的日历映射
        const findTagMapping = (tags: any[], targetTagId: string): string | null => {
          for (const tag of tags) {
            console.log('🔍 [TAG-CALENDAR] Checking tag:', { 
              id: tag.id, 
              name: tag.name, 
              calendarMapping: tag.calendarMapping 
            });
            
            if (tag.id === targetTagId) {
              const calendarId = tag.calendarMapping?.calendarId;
              console.log('🔍 [TAG-CALENDAR] Found matching tag, calendar ID:', calendarId);
              return calendarId || null;
            }
            
            // 检查子标签
            if (tag.children && tag.children.length > 0) {
              const childResult = findTagMapping(tag.children, targetTagId);
              if (childResult) {
                console.log('🔍 [TAG-CALENDAR] Found in child tags, calendar ID:', childResult);
                return childResult;
              }
            }
          }
          return null;
        };
        
        const result = findTagMapping(savedTags, tagId);
        console.log('🔍 [TAG-CALENDAR] Final result for tag', tagId, ':', result);
        return result;
      }
      
    } catch (error) {
      console.error('🔍 [TAG-CALENDAR] Error getting calendar mapping:', error);
      return null;
    }
  }

  // 🔧 [NEW] 获取所有有标签映射的日历的事件
  private async getMappedCalendarEvents(): Promise<any[]> {
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
      
      console.log('🔍 [getMappedCalendarEvents] Found mapped calendars:', Array.from(mappedCalendars));
      
      if (mappedCalendars.size === 0) {
        return [];
      }
      
      // 获取每个映射日历的事件
      const allEvents: any[] = [];
      
      for (const calendarId of Array.from(mappedCalendars)) {
        try {
          console.log('🔍 [getMappedCalendarEvents] Fetching events from calendar:', calendarId);
          const events = await this.microsoftService.getEventsFromCalendar(calendarId);
          
          // 为这些事件设置正确的 calendarId 和标签信息
          const enhancedEvents = events.map((event: any) => ({
            ...event,
            calendarId: calendarId,
            // 尝试找到对应的标签
            tagId: this.findTagIdForCalendar(calendarId)
          }));
          
          allEvents.push(...enhancedEvents);
          console.log('🔍 [getMappedCalendarEvents] Got', events.length, 'events from calendar', calendarId);
        } catch (error) {
          console.warn('⚠️ [getMappedCalendarEvents] Failed to fetch events from calendar', calendarId, ':', error);
        }
      }
      
      console.log('🔍 [getMappedCalendarEvents] Total events from mapped calendars:', allEvents.length);
      return allEvents;
      
    } catch (error) {
      console.error('❌ [getMappedCalendarEvents] Error getting mapped calendar events:', error);
      return [];
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
    
    // 3. 清理多余的分隔线，确保只有一个
    if (this.hasCreateNote(result)) {
      // 清理可能的多个连续分隔线
      result = result.replace(/\n---\s*\n---\s*/g, '\n---\n');
      result = result.replace(/\n---\s*$/g, ''); // 移除末尾孤立的分隔线
    }
    
    return result.trim();
  }

  // 🔧 检查文本是否已经以分隔线结尾或包含创建备注
  private endsWithSeparator(text: string): boolean {
    const trimmed = text.trim();
    // 检查是否以 --- 结尾，或者包含创建备注（说明已有分隔线）
    return /\n---\s*$/.test(trimmed) || this.hasCreateNote(trimmed);
  }

  // 🔧 生成创建备注
  private generateCreateNote(source: 'outlook' | 'remarkable', createTime?: Date | string): string {
    // 使用传入的时间或当前时间
    const timeToUse = createTime ? (typeof createTime === 'string' ? new Date(createTime) : createTime) : new Date();
    const timeStr = `${timeToUse.getFullYear()}-${(timeToUse.getMonth() + 1).toString().padStart(2, '0')}-${timeToUse.getDate().toString().padStart(2, '0')} ${timeToUse.getHours().toString().padStart(2, '0')}:${timeToUse.getMinutes().toString().padStart(2, '0')}:${timeToUse.getSeconds().toString().padStart(2, '0')}`;
    const sourceIcon = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
    return `\n\n---\n由 ${sourceIcon} 创建于 ${timeStr}`;
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
    
    // 2. 检查是否已有创建备注和编辑备注
    const hasCreate = this.hasCreateNote(cleanText);
    const hasEdit = this.hasEditNote(cleanText);
    
    // 3. 根据不同操作和情况处理
    if (source === 'outlook' && action === 'sync') {
      // 从Outlook同步到本地
      let result = this.extractOriginalDescription(cleanText);
      
      // 如果没有创建备注，添加Outlook创建备注，使用事件的真实创建时间
      if (!this.hasCreateNote(result)) {
        const createTime = eventData?.createdDateTime || eventData?.createdAt || new Date();
        result += this.generateCreateNote('outlook', createTime);
      }
      
      return result;
    }
    
    // 4. 对于本地操作（create/update）
    let result = cleanText;
    
    if (action === 'create') {
      // 创建操作：使用事件的创建时间（如果有的话）
      // 🔍 [NEW] 支持保持原始创建时间
      let createTime: Date;
      if (eventData?.preserveOriginalCreateTime) {
        createTime = eventData.preserveOriginalCreateTime;
        console.log('🔧 [ProcessDescription] Using preserved original create time:', createTime);
      } else {
        createTime = eventData?.createdAt || new Date();
        console.log('🔧 [ProcessDescription] Using new create time:', createTime);
      }
      
      result += this.generateCreateNote('remarkable', createTime);
      console.log('🔧 [ProcessDescription] Added ReMarkable create note with time:', createTime);
    } else if (action === 'update') {
      // 更新操作：移除编辑备注，保留创建备注，添加新的编辑备注
      result = this.removeEditNotesOnly(cleanText);
      result += this.generateEditNote('remarkable', result);
      console.log('🔧 [ProcessDescription] Removed old edit notes and added new edit note');
    }
    
    console.log('🔧 [ProcessDescription] Final result:', {
      finalLength: result.length,
      finalFull: result
    });
    
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
    
    // 3. 清理多余的空行和分隔线
    cleaned = cleaned.trim();
    
    // 4. 如果有创建备注，确保分隔线格式正确
    if (this.hasCreateNote(cleaned)) {
      // 清理可能的多个连续分隔线，确保创建备注前只有一个
      cleaned = cleaned.replace(/\n---\s*\n---\s*\n/g, '\n---\n');
      cleaned = cleaned.replace(/\n---\s*$/g, ''); // 移除末尾孤立的分隔线
    }
    
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
          console.log('🔍 [extractOriginalCreateTime] Found original create time:', timeString, '→', parsedTime);
          return parsedTime;
        }
      }
      
      console.log('🔍 [extractOriginalCreateTime] No valid create time found in description');
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

  public recordLocalAction(type: 'create' | 'update' | 'delete', entityType: 'event' | 'task', entityId: string, data?: any, oldData?: any) {
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
    
    if (this.isRunning && this.microsoftService.isSignedIn()) {
      this.syncSingleAction(action);
    }
  }

  // 检查是否需要全量同步
  private checkIfFullSyncNeeded() {
    const currentSettings = this.getUserSettings();
    
    // 如果设置发生变化，需要全量同步
    if (!this.lastSyncSettings || 
        this.lastSyncSettings.ongoingDays !== currentSettings.ongoingDays) {
      console.log('🔄 [Sync] Settings changed, marking for full sync');
      this.needsFullSync = true;
    }
    
    this.lastSyncSettings = { ...currentSettings };
  }

  public start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    console.log('🚀 [ActionBasedSyncManager] Starting sync manager...');
    
    // 检查是否需要全量同步
    this.checkIfFullSyncNeeded();
    
    this.performSync();
    
    this.syncInterval = setInterval(() => {
      if (!this.syncInProgress) {
        this.performSync();
      }
    }, 30000);
  }

  public stop() {
    this.isRunning = false;
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
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
    if (this.syncInProgress || !this.microsoftService.isSignedIn()) {
      return;
    }

    this.syncInProgress = true;

    try {
      // 🆕 清理过期的已删除事件ID
      this.cleanupDeletedEventIds();
      
      await this.fetchRemoteChanges();
      await this.syncPendingLocalActions();
      await this.syncPendingRemoteActions();
      await this.resolveConflicts();
      this.cleanupSynchronizedActions();
      
      this.lastSyncTime = new Date();
      
      window.dispatchEvent(new CustomEvent('action-sync-completed', {
        detail: { timestamp: this.lastSyncTime }
      }));
      
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
      console.log(`🔍 [Sync] ${isFullSync ? 'Full' : 'Incremental'} sync starting...`);

      // 🔧 获取用户配置的时间范围
      const userSettings = this.getUserSettings();
      const ongoingDays = userSettings?.ongoingDays ?? 1;
      
      // 🔧 设置合理的时间范围
      const now = new Date();
      const startDate = new Date(now);
      startDate.setDate(now.getDate() - ongoingDays - 1); // 往前多取一天
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(now);
      endDate.setDate(now.getDate() + 2); // 往后取2天
      endDate.setHours(23, 59, 59, 999);

      console.log('🔍 [ActionBasedSyncManager] Sync filter range:', 
        `${this.safeFormatDateTime(startDate)} to ${this.safeFormatDateTime(endDate)}`);

      const localEvents = this.getLocalEvents();
      console.log('🔍 [ActionBasedSyncManager] Local events before sync:', localEvents.length);
      
      const externalIdMap = new Map<string, any>();
      localEvents.forEach((event: any) => {
        if (event.externalId) {
          externalIdMap.set(event.externalId, event);
        }
      });

      const remoteEvents = await this.microsoftService.getEvents();
      console.log('🔍 [ActionBasedSyncManager] Remote events fetched from default calendar:', remoteEvents.length);
      
      // 🔧 [NEW] 获取所有有标签映射的日历的事件
      const mappedCalendarEvents = await this.getMappedCalendarEvents();
      console.log('🔍 [ActionBasedSyncManager] Events from mapped calendars:', mappedCalendarEvents.length);
      
      // 合并所有事件，并去重
      const allRemoteEvents = [...remoteEvents, ...mappedCalendarEvents];
      const uniqueEvents = new Map();
      
      allRemoteEvents.forEach(event => {
        const key = event.externalId || event.id;
        if (key && !uniqueEvents.has(key)) {
          uniqueEvents.set(key, event);
        }
      });
      
      const combinedEvents = Array.from(uniqueEvents.values());
      console.log('🔍 [ActionBasedSyncManager] Combined unique remote events:', combinedEvents.length);
      
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

      console.log('🔍 [ActionBasedSyncManager] ReMarkable events after filter:', remarkableEvents.length);
      console.log('🔍 [ActionBasedSyncManager] Events filtered out:', combinedEvents.length - remarkableEvents.length);

      // 处理远程事件并转换为本地行动
      remarkableEvents.forEach((event: any) => {
        console.log(`🔄 [Sync] Processing event: ${event.subject} (${event.id})`);

        // 🆕 检查是否是已删除的事件，如果是则跳过
        const cleanEventId = event.id.startsWith('outlook-') ? event.id.replace('outlook-', '') : event.id;
        const isDeleted = this.deletedEventIds.has(cleanEventId) || this.deletedEventIds.has(event.id);
        
        if (isDeleted) {
          console.log(`🚫 [Sync] Skipping deleted event: "${event.subject}" (${cleanEventId})`);
          return;
        }

        const existingLocal = localEvents.find((localEvent: any) => 
          localEvent.externalId === event.id || 
          localEvent.id === `outlook-${event.id}`
        );

        if (!existingLocal) {
          console.log(`➕ [Sync] Creating new local event from remote: "${event.subject}"`);
          this.recordRemoteAction('create', 'event', `outlook-${event.id}`, event);
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
            // 🔧 时间差阈值：只有大于1分钟的差异才认为是真正的更新
            timeDiffMinutes = Math.abs(remoteModified.getTime() - localModified.getTime()) / (1000 * 60);
            significantTimeChange = timeDiffMinutes > 1;
          }
          
          // 详细比较各个字段
          const titleChanged = event.subject !== existingLocal.title;
          
          // 🔧 正确比较描述：提取原始内容进行比较
          const remoteRawDescription = this.getEventDescription(event);
          const localRawDescription = this.cleanHtmlContent(existingLocal.description || '');
          const descriptionChanged = remoteRawDescription !== localRawDescription;
          
          console.log(`🔍 [Sync] Comparing "${event.subject}": title=${titleChanged}, desc=${descriptionChanged}, time=${significantTimeChange}`);
          
          if (titleChanged || descriptionChanged || significantTimeChange) {
            const reason = titleChanged ? 'title' : descriptionChanged ? 'description' : 'significant time change';
            console.log(`🔄 [Sync] Updating local event from remote: "${event.subject}" (reason: ${reason})`);
            this.recordRemoteAction('update', 'event', existingLocal.id, event, existingLocal);
          } else {
            console.log(`✅ [Sync] Event "${event.subject}" is up to date`);
          }
        }
      });

      // 🔧 检测远程删除的事件 - 每次同步都检查（实时同步）
      console.log('🔍 [Sync] Checking for remotely deleted events...');
      
      // 🔧 从远程事件中提取原始的Outlook ID（去掉outlook-前缀）
      const remoteEventIds = new Set(remarkableEvents.map((event: any) => {
        // MicrosoftCalendarService返回的ID格式是 "outlook-{原始ID}"
        const rawId = event.id.startsWith('outlook-') ? event.id.replace('outlook-', '') : event.id;
        console.log('🔧 [Sync] Processing remote event ID:', {
          originalId: event.id,
          extractedRawId: rawId,
          eventTitle: event.subject
        });
        return rawId;
      }));
      
      const localEventsWithExternalId = localEvents.filter((localEvent: any) => 
        localEvent.externalId && localEvent.externalId.trim() !== ''
      );

      console.log(`🔍 [Sync] Checking ${localEventsWithExternalId.length} local events against ${remarkableEvents.length} remote events`);

      localEventsWithExternalId.forEach((localEvent: any) => {
        const cleanExternalId = localEvent.externalId.startsWith('outlook-') 
          ? localEvent.externalId.replace('outlook-', '')
          : localEvent.externalId;
          
        const isFoundInRemote = remoteEventIds.has(cleanExternalId);
        
        console.log('🔧 [Sync] Checking local event for deletion:', {
          localEventTitle: localEvent.title,
          localEventId: localEvent.id,
          originalExternalId: localEvent.externalId,
          cleanedExternalId: cleanExternalId,
          isFoundInRemote: isFoundInRemote,
          remoteEventIdsArray: Array.from(remoteEventIds)
        });
          
        if (!isFoundInRemote) {
          console.log(`🗑️ [Sync] Event deleted remotely, removing locally: "${localEvent.title}" (externalId: ${localEvent.externalId})`);
          this.recordRemoteAction('delete', 'event', localEvent.id, null, localEvent);
        } else {
          console.log(`✅ [Sync] Event found in remote, keeping locally: "${localEvent.title}"`);
        }
      });

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

// 🔧 添加获取用户设置的方法
private getUserSettings(): any {
  try {
    const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return settings ? JSON.parse(settings) : { ongoingDays: 1 };
  } catch {
    return { ongoingDays: 1 };
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
    
    if (pendingRemoteActions.length === 0) {
      console.log('🔍 [SyncRemote] No pending remote actions to process');
      return;
    }
    
    console.log(`🔍 [SyncRemote] Processing ${pendingRemoteActions.length} pending remote actions:`, 
      pendingRemoteActions.map(a => `${a.type}:${a.entityId}`));
    
    let successCount = 0;
    
    for (const action of pendingRemoteActions) {
      try {
        console.log(`🔄 [SyncRemote] Processing action: ${action.type} for ${action.entityId}`);
        await this.applyRemoteActionToLocal(action);
        
        action.synchronized = true;
        action.synchronizedAt = new Date();
        successCount++;
        console.log(`✅ [SyncRemote] Successfully processed: ${action.type} for ${action.entityId}`);
        
      } catch (error) {
        console.error(`❌ [SyncRemote] Failed to apply remote action:`, error);
        action.retryCount = (action.retryCount || 0) + 1;
      }
    }
    
    this.saveActionQueue();
    
    if (successCount > 0) {
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
    if (action.synchronized || action.retryCount >= 3) {
      return;
    }

    try {
      if (action.source === 'local') {
        await this.applyLocalActionToRemote(action);
      } else {
        await this.applyRemoteActionToLocal(action);
      }

      action.synchronized = true;
      action.synchronizedAt = new Date();
      this.saveActionQueue();
      
    } catch (error) {
      console.error('❌ Failed to sync action:', error);
      action.retryCount++;
      this.saveActionQueue();
    }
  }

  private async applyLocalActionToRemote(action: SyncAction): Promise<boolean> {
    try {
      if (action.source !== 'local' || !this.microsoftService) {
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
          
          // 🔍 [NEW] 获取目标日历ID - 优先使用事件指定的calendarId，否则通过标签映射获取
          let targetCalendarId = action.data.calendarId;
          
          if (!targetCalendarId && action.data.tagId) {
            console.log('🔍 [SYNC] Event has no calendarId, trying to get from tag mapping. TagId:', action.data.tagId);
            targetCalendarId = this.getCalendarIdForTag(action.data.tagId);
            console.log('🔍 [SYNC] Calendar ID from tag mapping:', targetCalendarId);
          }
          
          if (!targetCalendarId) {
            console.log('🔍 [SYNC] No calendar ID found, using default calendar');
            // 如果还是没有找到，使用默认日历
            targetCalendarId = this.microsoftService.getSelectedCalendarId();
          }
          
          console.log('🎯 [EVENT SYNC] Final calendar assignment:', {
            eventTitle: action.data.title,
            eventId: action.entityId,
            originalCalendarId: action.data.calendarId,
            tagId: action.data.tagId,
            finalTargetCalendarId: targetCalendarId,
            isTimerEvent: action.data.timerSessionId ? true : false,
            actionData: action.data
          });
          
          const newEventId = await this.microsoftService.syncEventToCalendar(eventData, targetCalendarId);
          
          if (newEventId) {
            this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
            return true;
          }
          break;

        case 'update':
          console.log('🔍 [SYNC UPDATE] Processing update action:', {
            entityId: action.entityId,
            title: action.data.title,
            tagId: action.data.tagId,
            calendarId: action.data.calendarId,
            hasExternalId: !!action.data.externalId,
            fullActionData: action.data
          });
          
          // 🔧 强化 externalId 处理 - 确保不会丢失
          let cleanExternalId = action.data.externalId;
          
          // 🆕 如果当前数据没有 externalId，但原始数据有，则使用原始数据的 externalId
          if (!cleanExternalId && action.originalData?.externalId) {
            console.log('🔧 [SYNC UPDATE] Current data missing externalId, using from originalData');
            cleanExternalId = action.originalData.externalId;
            
            // 同时更新当前数据的 externalId 以避免后续问题
            action.data.externalId = cleanExternalId;
          }
          
          if (cleanExternalId && cleanExternalId.startsWith('outlook-')) {
            cleanExternalId = cleanExternalId.replace('outlook-', '');
          }
          
          console.log('🔍 [SYNC UPDATE] ExternalId processing:', {
            originalExternalId: action.originalData?.externalId,
            currentExternalId: action.data.externalId,
            finalCleanExternalId: cleanExternalId
          });
          
          // 🔍 [NEW] 如果没有 externalId，说明这是一个本地事件，需要首次同步，转为创建操作
          if (!cleanExternalId) {
            console.log('🔄 [SYNC UPDATE → CREATE] No externalId found, treating as first-time sync (create)');
            
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
            
            // 🔍 [NEW] 获取目标日历ID - 优先使用事件指定的calendarId，否则通过标签映射获取
            let targetCalendarId = action.data.calendarId;
            
            if (!targetCalendarId && action.data.tagId) {
              console.log('🔍 [SYNC CREATE] Event has no calendarId, trying to get from tag mapping. TagId:', action.data.tagId);
              targetCalendarId = this.getCalendarIdForTag(action.data.tagId);
              console.log('🔍 [SYNC CREATE] Calendar ID from tag mapping:', targetCalendarId);
            }
            
            if (!targetCalendarId) {
              console.log('🔍 [SYNC CREATE] No calendar ID found, using default calendar');
              targetCalendarId = this.microsoftService.getSelectedCalendarId();
            }
            
            console.log('🎯 [EVENT SYNC] Final calendar assignment for create:', {
              eventTitle: action.data.title,
              eventId: action.entityId,
              originalCalendarId: action.data.calendarId,
              tagId: action.data.tagId,
              finalTargetCalendarId: targetCalendarId,
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
            
            const newEventId = await this.microsoftService.syncEventToCalendar(eventData, targetCalendarId);
            
            if (newEventId) {
              this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
              this.updateLocalEventCalendarId(action.entityId, targetCalendarId);
              console.log('✅ [SYNC UPDATE → CREATE] Successfully created event in calendar');
              return true;
            } else {
              console.error('❌ [SYNC UPDATE → CREATE] Failed to create event');
              return false;
            }
          }
          
          // 🔍 [NEW] 检查标签映射是否需要迁移日历
          let currentCalendarId = action.data.calendarId;
          
          if (action.data.tagId) {
            console.log('🔍 [TAG-CALENDAR-UPDATE] Checking tag mapping for update. TagId:', action.data.tagId);
            const mappedCalendarId = this.getCalendarIdForTag(action.data.tagId);
            console.log('🔍 [TAG-CALENDAR-UPDATE] Current calendar:', currentCalendarId || 'None', 'Mapped calendar:', mappedCalendarId || 'None');
            
            // 只有当事件有 externalId（已同步到 Outlook）且目标日历不同时才进行迁移
            if (mappedCalendarId && 
                cleanExternalId && 
                mappedCalendarId !== currentCalendarId) {
              
              console.log('🔄 [TAG-CALENDAR-UPDATE] Calendar migration needed:', {
                from: currentCalendarId || 'None',
                to: mappedCalendarId,
                eventTitle: action.data.title,
                tagId: action.data.tagId,
                externalId: cleanExternalId
              });
              
              try {
                // 删除原日历中的事件
                console.log('🗑️ [TAG-CALENDAR-UPDATE] Deleting from original calendar:', cleanExternalId);
                await this.microsoftService.deleteEvent(cleanExternalId);
                console.log('✅ [TAG-CALENDAR-UPDATE] Successfully deleted from original calendar');
              } catch (deleteError) {
                console.warn('⚠️ [TAG-CALENDAR-UPDATE] Failed to delete from original calendar (may not exist):', deleteError);
                // 继续创建新事件，即使删除失败
              }
              
              try {
                // 在新日历中创建事件
                const createDescription = this.processEventDescription(
                  action.data.description || '',
                  'remarkable',
                  'create',
                  action.data
                );
                
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
                
                console.log('✨ [TAG-CALENDAR-UPDATE] Creating in new calendar:', mappedCalendarId);
                const newEventId = await this.microsoftService.syncEventToCalendar(eventData, mappedCalendarId);
                
                if (newEventId) {
                  // 更新本地存储中的externalId和calendarId
                  this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
                  this.updateLocalEventCalendarId(action.entityId, mappedCalendarId);
                  console.log('✅ [TAG-CALENDAR-UPDATE] Successfully migrated event to new calendar');
                  return true;
                } else {
                  console.error('❌ [TAG-CALENDAR-UPDATE] Failed to create event in new calendar');
                  return false;
                }
              } catch (createError) {
                console.error('❌ [TAG-CALENDAR-UPDATE] Failed to create event in new calendar:', createError);
                return false;
              }
            } else if (mappedCalendarId && !cleanExternalId) {
              console.log('🔄 [TAG-CALENDAR-UPDATE] Event not synced yet, updating calendarId for future sync');
              // 如果事件还没有同步到 Outlook，只更新本地的 calendarId
              this.updateLocalEventCalendarId(action.entityId, mappedCalendarId);
            }
          }
          
          // 🔧 构建更新数据，确保格式正确
          // 🔧 使用新的描述处理方法
          const updateDescription = this.processEventDescription(
            action.data.description || '',
            'remarkable',
            'update',
            action.data
          );
          
          const updateData: any = {
            subject: action.data.title,
            body: { 
              contentType: 'text', 
              content: updateDescription
            }
          };
          
          // 🔧 强化时间字段处理 - 确保时间同步正确
          if (action.data.startTime && action.data.endTime) {
            try {
              const startDateTime = this.safeFormatDateTime(action.data.startTime);
              const endDateTime = this.safeFormatDateTime(action.data.endTime);
              
              console.log('⏰ [Update] Processing time fields:', {
                originalStartTime: action.data.startTime,
                originalEndTime: action.data.endTime,
                formattedStartTime: startDateTime,
                formattedEndTime: endDateTime
              });
              
              // 验证时间格式和有效性
              if (!startDateTime || !endDateTime) {
                throw new Error('Time formatting returned null/undefined');
              }
              
              const startDate = new Date(startDateTime);
              const endDate = new Date(endDateTime);
              
              if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
                throw new Error('Invalid date values after formatting');
              }
              
              // 确保结束时间晚于开始时间
              if (endDate <= startDate) {
                throw new Error('End time must be after start time');
              }
              
              updateData.start = {
                dateTime: startDateTime,
                timeZone: 'Asia/Shanghai'
              };
              updateData.end = {
                dateTime: endDateTime,
                timeZone: 'Asia/Shanghai'
              };
              
              console.log('✅ [Update] Time fields successfully added to update data');
              
            } catch (error) {
              console.error('❌ [Update] Time processing failed:', error);
              throw new Error(`Time update failed: ${error instanceof Error ? error.message : 'Unknown time error'}`);
            }
          } else {
            console.warn('⚠️ [Update] Missing time data, this may cause sync issues');
          }
          
          // 🔧 只在有位置信息时才添加位置字段
          if (action.data.location) {
            updateData.location = { displayName: action.data.location };
          }
          
          // 🔧 添加 isAllDay 字段
          if (typeof action.data.isAllDay === 'boolean') {
            updateData.isAllDay = action.data.isAllDay;
          }
          
          console.log('🔧 [Update] Sending to Outlook:', {
            externalId: cleanExternalId,
            updateData: JSON.stringify(updateData, null, 2)
          });
          
          try {
            const updated = await this.microsoftService.updateEvent(cleanExternalId, updateData);
            
            if (updated) {
              return true;
            }
          } catch (error) {
            // 🔧 如果事件不存在（404），转换为创建操作
            if (error instanceof Error && error.message.includes('Event not found')) {
              console.log('🔄 [Update → Create] Event not found, converting to create operation');
              
              // 获取目标日历ID
              let targetCalendarId = action.data.calendarId;
              if (!targetCalendarId && action.data.tagId) {
                targetCalendarId = this.getCalendarIdForTag(action.data.tagId);
              }
              if (!targetCalendarId) {
                targetCalendarId = this.microsoftService.getSelectedCalendarId();
              }
              
              // 构建创建事件数据
              const createDescription = this.processEventDescription(
                action.data.description || '',
                'remarkable',
                'create',
                action.data
              );
              
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
              
              const newEventId = await this.microsoftService.syncEventToCalendar(eventData, targetCalendarId);
              
              if (newEventId) {
                this.updateLocalEventExternalId(action.entityId, newEventId, createDescription);
                this.updateLocalEventCalendarId(action.entityId, targetCalendarId);
                console.log('✅ [Update → Create] Successfully created event as replacement');
                return true;
              } else {
                console.error('❌ [Update → Create] Failed to create replacement event');
                return false;
              }
            }
            
            console.warn('⚠️ Full update failed, trying minimal update...', error);
            
            // 🔧 如果完整更新失败，尝试只更新标题和描述
            try {
              const minimalUpdate = {
                subject: action.data.title,
                body: { 
                  contentType: 'text', 
                  content: action.data.description || '📱 由 ReMarkable 应用更新'
                }
              };
              
              console.log('🔧 [Update] Trying minimal update:', minimalUpdate);
              const minimalUpdated = await this.microsoftService.updateEvent(cleanExternalId, minimalUpdate);
              
              if (minimalUpdated) {
                console.log('✅ Minimal update succeeded');
                return true;
              }
            } catch (minimalError) {
              console.error('❌ Even minimal update failed:', minimalError);
              throw error; // 抛出原始错误
            }
          }
          break;

        case 'delete':
          console.log('🗑️ Processing delete action:', action);
          if (action.originalData?.externalId) {
            // 清理externalId，移除可能的前缀
            let cleanExternalId = action.originalData.externalId;
            if (cleanExternalId.startsWith('outlook-')) {
              cleanExternalId = cleanExternalId.replace('outlook-', '');
            }
            
            console.log('🗑️ Deleting event from Outlook with cleaned ID:', cleanExternalId);
            try {
              await this.microsoftService.deleteEvent(cleanExternalId);
              console.log('✅ Successfully deleted event from Outlook:', cleanExternalId);
              
              // 🆕 添加到已删除事件ID跟踪
              this.deletedEventIds.add(cleanExternalId);
              this.deletedEventIds.add(action.originalData.externalId); // 也添加原始格式
              this.saveDeletedEventIds();
              console.log('📝 Added to deleted events tracking:', cleanExternalId);
              
              return true;
            } catch (error) {
              console.error('❌ Failed to delete event from Outlook:', error);
              return false;
            }
          } else {
            console.log('⚠️ No externalId found for delete action, skipping remote deletion');
            return true; // 本地删除成功，即使没有远程ID
          }
      }
      
      return false; // 默认返回值，如果没有匹配的action type
    } catch (error) {
      console.error('❌ Failed to apply local action to remote:', error);
      return false;
    }
  }

  // 🔧 改进时间格式化方法，支持 Graph API 要求的格式
  private safeFormatDateTime(dateInput: any): string {
    try {
      if (!dateInput) {
        return new Date().toISOString().slice(0, 19); // 移除毫秒和Z
      }
      
      let dateObj: Date;
      
      if (typeof dateInput === 'string') {
        // 如果已经是正确格式，直接返回
        if (dateInput.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
          return dateInput;
        }
        
        dateObj = new Date(dateInput);
      } else if (dateInput instanceof Date) {
        dateObj = dateInput;
      } else {
        dateObj = new Date();
      }
      
      // 验证日期有效性
      if (isNaN(dateObj.getTime())) {
        dateObj = new Date();
      }
      
      // 返回 Graph API 兼容的格式: YYYY-MM-DDTHH:mm:ss
      return dateObj.toISOString().slice(0, 19);
      
    } catch (error) {
      console.error('❌ safeFormatDateTime error:', error);
      return new Date().toISOString().slice(0, 19);
    }
  }

  private async applyRemoteActionToLocal(action: SyncAction) {
    if (action.entityType !== 'event') return;

    const localEvents = this.getLocalEvents();

    switch (action.type) {
      case 'create':
        const newEvent = this.convertRemoteEventToLocal(action.data);
        
        const existingEvent = localEvents.find((e: any) => 
          e.externalId === action.data?.id || e.id === newEvent.id
        );
        
        if (!existingEvent) {
          localEvents.push(newEvent);
          this.saveLocalEvents(localEvents);
          this.triggerUIUpdate('create', newEvent);
        }
        break;

      case 'update':
        console.log('🔄 [RemoteToLocal] Processing update action for event:', action.entityId);
        const eventIndex = localEvents.findIndex((e: any) => e.id === action.entityId);
        if (eventIndex !== -1) {
          // 尝试多个可能的描述字段
          const htmlContent = action.data.body?.content || 
                             action.data.description || 
                             action.data.bodyPreview || 
                             '';
          
          console.log('🔄 [RemoteToLocal] FULL UPDATE DETAILS:', {
            eventId: action.entityId,
            title: action.data.subject,
            bodyContent: action.data.body?.content || '[empty]',
            description: action.data.description || '[empty]',
            bodyPreview: action.data.bodyPreview || '[empty]',
            selectedHtmlContent: htmlContent,
            oldLocalDescription: localEvents[eventIndex].description || ''
          });
          
          const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync', action.data);
          
          console.log('🔄 [RemoteToLocal] Description processing complete:', {
            originalHtmlContent: htmlContent,
            cleanedDescription: cleanDescription,
            updateReason: 'Remote event updated'
          });
          
          const updatedEvent = {
            ...localEvents[eventIndex],
            title: action.data.subject || '',
            description: cleanDescription, // 直接使用清理后的内容，不添加同步备注
            startTime: this.safeFormatDateTime(action.data.start?.dateTime || action.data.start),
            endTime: this.safeFormatDateTime(action.data.end?.dateTime || action.data.end),
            location: action.data.location?.displayName || '',
            isAllDay: action.data.isAllDay || false,
            updatedAt: new Date(),
            lastSyncTime: new Date(),
            syncStatus: 'synced'
          };
          
          localEvents[eventIndex] = updatedEvent;
          this.saveLocalEvents(localEvents);
          
          console.log('✅ [RemoteToLocal] Event updated successfully:', {
            eventId: action.entityId,
            finalDescription: updatedEvent.description,
            eventTitle: updatedEvent.title
          });
          
          this.triggerUIUpdate('update', updatedEvent);
        } else {
          console.log('⚠️ [RemoteToLocal] Event not found for update:', action.entityId);
        }
        break;

      case 'delete':
        console.log('🗑️ [RemoteToLocal] Processing delete action for event:', action.entityId);
        const eventToDeleteIndex = localEvents.findIndex((e: any) => e.id === action.entityId);
        if (eventToDeleteIndex !== -1) {
          const eventToDelete = localEvents[eventToDeleteIndex];
          console.log('🗑️ [RemoteToLocal] Found event to delete:', {
            index: eventToDeleteIndex,
            title: eventToDelete.title,
            id: eventToDelete.id
          });
          
          localEvents.splice(eventToDeleteIndex, 1);
          this.saveLocalEvents(localEvents);
          console.log('✅ [RemoteToLocal] Event deleted from local storage, remaining events:', localEvents.length);
          
          this.triggerUIUpdate('delete', { id: action.entityId, title: eventToDelete.title });
          console.log('✅ [RemoteToLocal] UI update triggered for deletion');
        } else {
          console.log('⚠️ [RemoteToLocal] Event not found for deletion:', action.entityId);
        }
        break;
    }
  }

  private triggerUIUpdate(actionType: string, eventData: any) {
    console.log('🔄 [triggerUIUpdate] Triggering UI update:', {
      actionType,
      eventId: eventData?.id,
      eventTitle: eventData?.title,
      eventDescription: eventData?.description?.substring(0, 100) + '...'
    });
    
    window.dispatchEvent(new CustomEvent('outlook-sync-completed', {
      detail: { action: actionType, event: eventData, timestamp: new Date() }
    }));
    
    window.dispatchEvent(new CustomEvent('action-sync-completed', {
      detail: { action: actionType, event: eventData, timestamp: new Date() }
    }));
    
    window.dispatchEvent(new CustomEvent('local-events-changed', {
      detail: { action: actionType, event: eventData, timestamp: new Date() }
    }));
    
    console.log('✅ [triggerUIUpdate] UI update events dispatched successfully');
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
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  private saveLocalEvents(events: any[]) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  }

  private updateLocalEventExternalId(localEventId: string, externalId: string, description?: string) {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === localEventId);
        
        if (eventIndex !== -1) {
          events[eventIndex] = {
            ...events[eventIndex],
            externalId,
            syncStatus: 'synced',
            lastSyncTime: this.safeFormatDateTime(new Date()),
            updatedAt: this.safeFormatDateTime(new Date()),
            description: description || events[eventIndex].description || ''
          };
          
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
          
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
          events[eventIndex] = {
            ...events[eventIndex],
            calendarId,
            updatedAt: this.safeFormatDateTime(new Date()),
            lastSyncTime: this.safeFormatDateTime(new Date())
          };
          
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
          
          console.log('✅ [updateLocalEventCalendarId] Updated event calendar ID:', {
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
      calendarId: 'microsoft',
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

  public async startSync() {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;

    if (this.microsoftService && this.microsoftService.isSignedIn()) {
      await this.performSync();
      
      this.syncInterval = setInterval(async () => {
        try {
          await this.performSync();
        } catch (error) {
          console.error('❌ Periodic sync failed:', error);
        }
      }, 60000);
    }
  }

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
        events[eventIndex] = updatedEvent;
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
        console.log(`📝 [ActionBasedSyncManager] Updated local event: ${oldEventId} -> ${updatedEvent.id}`);
      }
    } catch (error) {
      console.error('Error updating local event:', error);
    }
  }
}