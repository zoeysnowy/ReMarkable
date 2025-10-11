import { STORAGE_KEYS } from '../constants/storage';

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

  constructor(microsoftService: any) {
    this.microsoftService = microsoftService;
    this.loadActionQueue();
    this.loadConflictQueue();
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

  // 🔧 统一的描述处理方法 - 简化版本
  private processEventDescription(htmlContent: string, source: 'outlook' | 'remarkable', action: 'create' | 'update' | 'sync'): string {
    console.log('🔧 [ProcessDescription] Starting description processing:', {
      source,
      action,
      htmlContentLength: htmlContent.length,
      htmlContentFull: htmlContent
    });
    
    // 1. 清理HTML内容，得到纯文本
    const cleanText = this.cleanHtmlContent(htmlContent);
    
    console.log('🔧 [ProcessDescription] After HTML cleaning:', {
      cleanTextLength: cleanText.length,
      cleanTextFull: cleanText
    });
    
    // 2. 如果是从Outlook同步到本地，直接返回清理后的内容，不添加额外备注
    if (source === 'outlook' && action === 'sync') {
      console.log('🔧 [ProcessDescription] Outlook sync - returning clean text without notes');
      return cleanText;
    }
    
    // 3. 如果是其他情况，添加适当的备注
    const now = new Date();
    const timeStr = `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
    
    let result = cleanText;
    
    if (action === 'create') {
      const sourceIcon = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
      result += `\n\n---\n由 ${sourceIcon} 创建`;
    } else if (action === 'update') {
      const sourceIcon = source === 'outlook' ? '📧 Outlook' : '🔮 ReMarkable';
      result += `\n由 ${sourceIcon} 最后编辑于 ${timeStr}`;
    }
    
    console.log('🔧 [ProcessDescription] Final result:', {
      finalLength: result.length,
      finalFull: result
    });
    
    return result;
  }

  // 🔧 改进的提取原始内容方法
  private extractOriginalDescription(description: string): string {
    if (!description) return '';
    
    // 移除所有同步备注（创建备注和修改日志）
    const cleaned = description
      // 移除创建备注和修改日志的组合
      .replace(/\n\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 最后编辑于 [^\n]*$/g, '')
      .replace(/\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 最后编辑于 [^\n]*$/g, '')
      // 移除单独的创建备注
      .replace(/\n\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建$/g, '')
      .replace(/\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) 创建$/g, '')
      // 移除单独的修改日志
      .replace(/\n由 (?:📧 |� )?(?:Outlook|ReMarkable) 最后编辑于 [^\n]*$/g, '')
      // 移除旧格式的备注
      .replace(/\n\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:创建|最新修改于 [^\n]*)$/g, '')
      .replace(/\n---\n由 (?:📧 |🔮 )?(?:Outlook|ReMarkable) (?:创建|最新修改于 [^\n]*)$/g, '')
      .trim();
    
    return cleaned;
  }

  // 获取远程事件的描述内容 - 修复版本
  private getEventDescription(event: any): string {
    // 尝试多个可能的描述字段
    const htmlContent = event.body?.content || 
                       event.description || 
                       event.bodyPreview || 
                       '';
    
    console.log('🔧 [GetEventDescription] Extracting description from event:', {
      eventId: event.id,
      eventSubject: event.subject,
      bodyContent: event.body?.content || '[empty]',
      description: event.description || '[empty]',
      bodyPreview: event.bodyPreview || '[empty]',
      selectedContent: htmlContent
    });
    
    return this.processEventDescription(htmlContent, 'outlook', 'sync');
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
      console.log('🔍 [ActionBasedSyncManager] Remote events fetched:', remoteEvents.length);
      
      const remarkableEvents = remoteEvents.filter((event: any) => {
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
      console.log('🔍 [ActionBasedSyncManager] Events filtered out:', remoteEvents.length - remarkableEvents.length);

      // 处理远程事件并转换为本地行动
      remarkableEvents.forEach((event: any) => {
        console.log(`🔄 [Sync] Processing event: ${event.subject} (${event.id})`);

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
          // 🔧 使用新的描述处理方法
          const createDescription = this.processEventDescription(
            action.data.description || '',
            'remarkable',
            'create'
          );
          
          const newEvent = await this.microsoftService.createEvent({
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
          });
          
          if (newEvent) {
            this.updateLocalEventExternalId(action.entityId, newEvent.id, createDescription);
            return true;
          }
          break;

        case 'update':
          // 🔧 修复 externalId 处理
          let cleanExternalId = action.data.externalId;
          if (cleanExternalId && cleanExternalId.startsWith('outlook-')) {
            cleanExternalId = cleanExternalId.replace('outlook-', '');
          }
          
          if (!cleanExternalId) {
            console.error('❌ No valid externalId for update:', action);
            return false;
          }
          
          // 🔧 构建更新数据，确保格式正确
          // 🔧 使用新的描述处理方法
          const updateDescription = this.processEventDescription(
            action.data.description || '',
            'remarkable',
            'update'
          );
          
          const updateData: any = {
            subject: action.data.title,
            body: { 
              contentType: 'text', 
              content: updateDescription
            }
          };
          
          // 🔧 只在有有效时间时才添加时间字段
          if (action.data.startTime && action.data.endTime) {
            try {
              const startDateTime = this.safeFormatDateTime(action.data.startTime);
              const endDateTime = this.safeFormatDateTime(action.data.endTime);
              
              // 验证时间格式
              if (startDateTime && endDateTime && 
                  startDateTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/) &&
                  endDateTime.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)) {
                
                updateData.start = {
                  dateTime: startDateTime,
                  timeZone: 'Asia/Shanghai'
                };
                updateData.end = {
                  dateTime: endDateTime,
                  timeZone: 'Asia/Shanghai'
                };
              }
            } catch (error) {
              console.warn('⚠️ Time format error, skipping time update:', error);
            }
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
          
          const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync');
          
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
    
    const cleanDescription = this.processEventDescription(htmlContent, 'outlook', 'sync');
    
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
      remarkableSource: true,
      category: 'ongoing'
    };
  }

  private cleanHtmlContent(htmlContent: string): string {
    if (!htmlContent) return '';
    
    console.log('🔧 [cleanHtmlContent] Processing HTML content:', {
      originalLength: htmlContent.length,
      originalContentFull: htmlContent,
      isHTMLContent: htmlContent.includes('<html>')
    });
    
    // 🔧 改进的HTML清理逻辑
    let cleaned = htmlContent;
    
    // 1. 如果是完整的HTML文档，优先提取body内容
    if (cleaned.includes('<html>') || cleaned.includes('<body>')) {
      // 首先处理 <br> 标签，将其转换为换行符
      cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
      
      // 尝试提取 PlainText div 中的内容
      const plainTextMatch = cleaned.match(/<div[^>]*class[^>]*["']PlainText["'][^>]*>([\s\S]*?)<\/div>/i);
      if (plainTextMatch) {
        cleaned = plainTextMatch[1];
        console.log('🔧 [cleanHtmlContent] Extracted PlainText content:', cleaned);
      } else {
        // 如果没有PlainText div，尝试提取body内容
        const bodyMatch = cleaned.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
        if (bodyMatch) {
          cleaned = bodyMatch[1];
          console.log('🔧 [cleanHtmlContent] Extracted body content:', cleaned);
        } else {
          console.log('🔧 [cleanHtmlContent] No body found, processing entire content');
        }
      }
    } else {
      // 如果不是HTML文档，先处理<br>标签
      cleaned = cleaned.replace(/<br\s*\/?>/gi, '\n');
    }
    
    // 4. 移除所有剩余的HTML标签
    cleaned = cleaned.replace(/<[^>]*>/g, '');
    
    // 5. 处理HTML实体
    cleaned = cleaned
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'");
    
    // 6. 标准化换行符和清理多余空白
    cleaned = cleaned
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .replace(/\n\s*\n\s*\n/g, '\n\n') // 减少连续的空行
      .trim();
    
    console.log('🔧 [cleanHtmlContent] Final cleaned content:', {
      cleanedLength: cleaned.length,
      cleanedContentFull: cleaned,
      isEmpty: cleaned === '',
      fullCleanedContent: cleaned
    });
    
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
}