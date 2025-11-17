/**
 * EventService - 统一的事件管理服�?
 * 
 * 职责�?
 * 1. 集中管理所有事件的创建、更新、删除操�?
 * 2. 自动处理 localStorage 持久�?
 * 3. 自动触发同步机制（recordLocalAction�?
 * 4. 发送全局事件通知（eventsUpdated�?
 * 5. 确保所有事件创建路径（Timer、TimeCalendar、PlanManager）都经过统一处理
 */

import { Event, EventLog } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { formatTimeForStorage } from '../utils/timeUtils';
import { logger } from '../utils/logger';
import { validateEventTime } from '../utils/eventValidation';
import { determineSyncTarget, shouldSync } from '../utils/syncRouter';
import { ContactService } from './ContactService';

const eventLogger = logger.module('EventService');

// 同步管理器实例（将在初始化时设置）
let syncManagerInstance: any = null;

// 跨标签页广播通道
let broadcastChannel: BroadcastChannel | null = null;

export class EventService {
  /**
   * 初始化服务，注入同步管理器
   */
  static initialize(syncManager: any) {
    syncManagerInstance = syncManager;
    eventLogger.log('✅ [EventService] Initialized with sync manager');
    
    // 初始化跨标签页广播通道
    try {
      broadcastChannel = new BroadcastChannel('remarkable-events');
      eventLogger.log('📡 [EventService] BroadcastChannel initialized for cross-tab sync');
    } catch (error) {
      eventLogger.warn('⚠️ [EventService] BroadcastChannel not supported:', error);
    }
    
    // 订阅 ContactService 事件，自动同步联系人变更到事件
    this.subscribeToContactEvents();
  }

  /**
   * 订阅 ContactService 事件
   * 实现联系人变更自动同步到相关事件
   */
  private static subscribeToContactEvents(): void {
    // 联系人更新时，同步到所有包含该联系人的事件
    ContactService.addEventListener('contact.updated', (event) => {
      const { id, after } = event.data;
      eventLogger.log('📇 [EventService] Contact updated, syncing to related events:', id);
      
      const events = this.getAllEvents();
      const relatedEvents = events.filter(e => 
        e.attendees?.some(a => a.id === id) || e.organizer?.id === id
      );
      
      if (relatedEvents.length === 0) {
        eventLogger.log('ℹ️ [EventService] No events reference this contact');
        return;
      }
      
      relatedEvents.forEach(event => {
        const updates: Partial<Event> = {};
        
        // 更新参会人
        if (event.attendees?.some(a => a.id === id)) {
          updates.attendees = event.attendees.map(a => 
            a.id === id ? after : a
          );
        }
        
        // 更新发起人
        if (event.organizer?.id === id) {
          updates.organizer = after;
        }
        
        this.updateEvent(event.id!, updates);
      });
      
      eventLogger.log(`✅ [EventService] Updated ${relatedEvents.length} events with new contact info`);
    });

    // 联系人删除时，从所有事件中移除该联系人
    ContactService.addEventListener('contact.deleted', (event) => {
      const { id } = event.data;
      eventLogger.log('🗑️ [EventService] Contact deleted, removing from events:', id);
      
      const events = this.getAllEvents();
      const relatedEvents = events.filter(e => 
        e.attendees?.some(a => a.id === id) || e.organizer?.id === id
      );
      
      if (relatedEvents.length === 0) {
        eventLogger.log('ℹ️ [EventService] No events reference this contact');
        return;
      }
      
      relatedEvents.forEach(event => {
        const updates: Partial<Event> = {};
        
        // 从参会人中移除
        if (event.attendees?.some(a => a.id === id)) {
          updates.attendees = event.attendees.filter(a => a.id !== id);
        }
        
        // 清除发起人（如果是被删除的联系人）
        if (event.organizer?.id === id) {
          updates.organizer = undefined;
        }
        
        this.updateEvent(event.id!, updates);
      });
      
      eventLogger.log(`✅ [EventService] Removed contact from ${relatedEvents.length} events`);
    });
  }

  /**
   * 获取所有事�?
   */
  static getAllEvents(): Event[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to load events:', error);
      return [];
    }
  }

  /**
   * 根据ID获取事件
   */
  static getEventById(eventId: string): Event | null {
    const events = this.getAllEvents();
    return events.find(e => e.id === eventId) || null;
  }

  /**
   * 按日期范围获取事件（性能优化：只加载视图需要的事件）
   * @param startDate - 范围起始日期（YYYY-MM-DD 或 Date 对象）
   * @param endDate - 范围结束日期（YYYY-MM-DD 或 Date 对象）
   * @returns 在指定范围内的事件数组
   * 
   * 性能优势：
   * - 月视图：~1151个事件 → ~50-200个事件（减少 85-95%）
   * - 内存占用：减少 85-95%
   * - JSON.parse 时间：减少 85-95%
   */
  static getEventsByRange(startDate: string | Date, endDate: string | Date): Event[] {
    try {
      const t0 = performance.now();
      
      // 转换为时间戳（方便比较）
      const rangeStart = new Date(startDate).getTime();
      const rangeEnd = new Date(endDate).getTime();
      
      // 读取全部事件（这一步暂时无法优化，因为 localStorage 只能整体读取）
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return [];
      
      const allEvents: Event[] = JSON.parse(saved);
      
      // 过滤出范围内的事件
      const filteredEvents = allEvents.filter(event => {
        // Task 类型（无时间）总是显示
        if (event.isTask && (!event.startTime || !event.endTime)) {
          return true;
        }
        
        // AllDay 事件：检查日期部分
        if (event.isAllDay) {
          const eventDate = new Date(event.startTime).setHours(0, 0, 0, 0);
          return eventDate >= rangeStart && eventDate <= rangeEnd;
        }
        
        // 普通事件：检查时间范围是否有重叠
        const eventStart = new Date(event.startTime).getTime();
        const eventEnd = new Date(event.endTime).getTime();
        
        // 事件与视图范围有任何重叠
        return (eventStart <= rangeEnd && eventEnd >= rangeStart);
      });
      
      const t1 = performance.now();
      eventLogger.log(`🔍 [EventService] getEventsByRange: ${filteredEvents.length}/${allEvents.length} events in ${(t1 - t0).toFixed(2)}ms`, {
        range: `${startDate} ~ ${endDate}`,
        reduction: `${((1 - filteredEvents.length / allEvents.length) * 100).toFixed(1)}%`
      });
      
      return filteredEvents;
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to load events by range:', error);
      return [];
    }
  }

  /**
   * 创建新事�?
   * @param event - 事件对象
   * @param skipSync - 是否跳过同步（默认false，某些场景如Timer运行中可设为true�?
   */
  static async createEvent(event: Event, skipSync: boolean = false): Promise<{ success: boolean; event?: Event; error?: string }> {
    try {
      // 🔍 [DEBUG] 记录调用栈
      const stack = new Error().stack;
      const caller = stack?.split('\n')[2]?.trim();
      
      eventLogger.log('🆕 [EventService] Creating new event...');
      eventLogger.log('🔍 [DEBUG-TIMER] 调用来源:', caller);
      eventLogger.log('🔍 [DEBUG-TIMER] skipSync:', skipSync);
      eventLogger.log('🔍 [DEBUG-TIMER] syncStatus:', event.syncStatus);
      eventLogger.log('🔍 [DEBUG-TIMER] isTimer:', event.isTimer);
      eventLogger.log('📋 [EventService] 创建参数:', {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        tags: event.tags,
        description: event.description?.substring(0, 50) + '...'
      });

      // ✅ v1.8: 验证时间字段（区分 Task 和 Calendar 事件）
      const validation = validateEventTime(event);
      if (!validation.valid) {
        eventLogger.error('❌ [EventService] Event validation failed:', validation.error);
        return { success: false, error: validation.error };
      }
      
      if (validation.warnings && validation.warnings.length > 0) {
        eventLogger.warn('⚠️ [EventService] Event warnings:', validation.warnings);
      }

      // 验证基本必填字段
      if (!event.id || !event.title) {
        const error = 'Event missing required fields (id or title)';
        eventLogger.error('❌ [EventService]', error, event);
        return { success: false, error };
      }

      // 🆕 v1.8.1: 初始化 eventlog 为新格式（如果未提供）
      const now = formatTimeForStorage(new Date());
      let eventlogField: string | EventLog | undefined = event.eventlog;
      
      if (!eventlogField && event.description) {
        // 从 description 初始化 eventlog（简化版 Slate JSON）
        const initialEventLog: EventLog = {
          content: JSON.stringify([{ type: 'paragraph', children: [{ text: event.description }] }]),
          descriptionHtml: event.description,
          descriptionPlainText: event.description,
          attachments: [],
          versions: [],
          syncState: {
            status: 'pending',
            contentHash: this.hashContent(event.description),
          },
          createdAt: now,
          updatedAt: now,
        };
        eventlogField = initialEventLog;
      }
      
      // 🆕 v2.8: 双向同步 simpleTitle ↔ fullTitle
      let simpleTitleField = event.simpleTitle || event.title;
      let fullTitleField = event.fullTitle;
      
      if (!simpleTitleField && fullTitleField) {
        // 场景1: 只有 fullTitle → 提取纯文本到 simpleTitle
        simpleTitleField = this.stripHtml(fullTitleField);
      } else if (!fullTitleField && simpleTitleField) {
        // 场景2: 只有 simpleTitle → 将纯文本赋值到 fullTitle
        fullTitleField = simpleTitleField;
      }
      // 场景3: 都有值 → 保持不变
      // 场景4: 都没值 → 使用空字符串
      if (!simpleTitleField) {
        simpleTitleField = '';
      }
      
      // 确保必要字段
      // 🔧 [BUG FIX] skipSync=true时，强制设置syncStatus='local-only'，忽略event.syncStatus
      const finalEvent: Event = {
        ...event,
        simpleTitle: simpleTitleField,
        fullTitle: fullTitleField,
        title: simpleTitleField, // 向后兼容
        remarkableSource: true,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending'), // skipSync优先级最高
        createdAt: event.createdAt || now,
        updatedAt: now,
        eventlog: eventlogField, // 🆕 使用新格式 eventlog
      };
      
      // 🔍 [DEBUG] 验证最终的syncStatus
      eventLogger.log('🔍 [EventService] Final syncStatus:', {
        skipSync,
        'event.syncStatus': event.syncStatus,
        'finalEvent.syncStatus': finalEvent.syncStatus
      });

      // 读取现有事件
      const existingEvents = this.getAllEvents();

      // 检查是否已存在
      const existingIndex = existingEvents.findIndex(e => e.id === event.id);
      if (existingIndex !== -1) {
        eventLogger.warn('⚠️ [EventService] Event already exists, will update instead:', event.id);
        return this.updateEvent(event.id, finalEvent, skipSync);
      }

      // 添加新事件
      existingEvents.push(finalEvent);

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      eventLogger.log('💾 [EventService] Event saved to localStorage');
      
      // ✨ 自动提取并保存联系人
      if (finalEvent.organizer || finalEvent.attendees) {
        ContactService.extractAndAddFromEvent(finalEvent.organizer, finalEvent.attendees);
        eventLogger.log('👥 [EventService] Auto-extracted contacts from event');
      }
      
      eventLogger.log('✅ [EventService] 创建成功:', {
        eventId: finalEvent.id,
        title: finalEvent.title,
        startTime: finalEvent.startTime,
        endTime: finalEvent.endTime,
        总事件数: existingEvents.length
      });

      // 触发全局更新事件（携带完整事件数据，避免订阅者重新读取）
      this.dispatchEventUpdate(event.id, { isNewEvent: true, tags: event.tags, event: finalEvent });

      // 同步到Outlook（如果不跳过且有同步管理器）
      if (!skipSync && syncManagerInstance && finalEvent.syncStatus !== 'local-only') {
        // ✅ v1.8: 检查同步路由
        const syncRoute = determineSyncTarget(finalEvent);
        
        if (syncRoute.target === 'none') {
          eventLogger.log(`⏭️ [EventService] Skipping sync: ${syncRoute.reason}`);
        } else {
          try {
            console.log('[EventService.createEvent] ✅ 触发同步:', {
              eventId: finalEvent.id,
              title: finalEvent.title?.substring(0, 30),
              syncStatus: finalEvent.syncStatus,
              syncTarget: syncRoute.target,
              syncReason: syncRoute.reason,
              calendarIds: (finalEvent as any).calendarIds,
              tags: finalEvent.tags
            });
            await syncManagerInstance.recordLocalAction('create', 'event', finalEvent.id, finalEvent);
            eventLogger.log('🔄 [EventService] Event synced to Outlook');
          } catch (syncError) {
            eventLogger.error('❌ [EventService] Sync failed (non-blocking):', syncError);
            // 同步失败不影响事件创建成功
          }
        }
      } else {
        if (skipSync) {
          eventLogger.log('⏭️ [EventService] Sync skipped (skipSync=true)');
        } else if (finalEvent.syncStatus === 'local-only') {
          console.log('[EventService.createEvent] ⏭️ 跳过同步 (syncStatus=local-only):', {
            eventId: finalEvent.id,
            title: finalEvent.title?.substring(0, 30),
            calendarIds: (finalEvent as any).calendarIds,
            tags: finalEvent.tags
          });
        } else {
          eventLogger.warn('⚠️ [EventService] Sync manager not initialized');
        }
      }

      return { success: true, event: finalEvent };
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to create event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 更新事件
   * @param eventId - 事件ID
   * @param updates - 更新内容（部分字段或完整事件对象�?
   * @param skipSync - 是否跳过同步
   */
  static async updateEvent(
    eventId: string, 
    updates: Partial<Event> | Event, 
    skipSync: boolean = false
  ): Promise<{ success: boolean; event?: Event; error?: string }> {
    try {
      // 🔍 诊断：记录调用栈
      const stack = new Error().stack;
      const caller = stack?.split('\n')[2]?.trim(); // 第2行是调用者
      
      eventLogger.log('✏️ [EventService] Updating event:', eventId);
      eventLogger.log('� [DEBUG-TIMER] 调用来源:', caller);
      eventLogger.log('🔍 [DEBUG-TIMER] skipSync:', skipSync);
      eventLogger.log('🔍 [DEBUG-TIMER] updates.syncStatus:', (updates as any).syncStatus);
      eventLogger.log('📋 [EventService] 更新字段:', {
        eventId,
        更新的字段: Object.keys(updates),
        startTime: updates.startTime,
        endTime: updates.endTime,
        title: updates.title,
        isAllDay: updates.isAllDay,
        description: (updates.description || '').substring(0, 50),
        eventlog: (() => {
          const log = (updates as any).eventlog;
          if (!log) return '';
          if (typeof log === 'string') return log.substring(0, 50);
          if (typeof log === 'object') return `[EventLog对象: ${log.descriptionPlainText?.substring(0, 30) || '无内容'}]`;
          return '[未知格式]';
        })(), // 🆕 v1.8: 兼容新旧格式
        calendarIds: (updates as any).calendarIds, // 🔍 检查 calendarIds
        todoListIds: (updates as any).todoListIds  // 🔍 检查 todoListIds
      });

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('�?[EventService]', error);
        return { success: false, error };
      }

      const originalEvent = existingEvents[eventIndex];
      
      // 🆕 v2.8: 双向同步 simpleTitle ↔ fullTitle
      // 🆕 v1.8.1: 双向同步 description ↔ eventlog
      // 支持新旧格式兼容：
      // - 旧格式：eventlog 是字符串（HTML）
      // - 新格式：eventlog 是 EventLog 对象（Slate JSON + metadata）
      
      const updatesWithSync = { ...updates };
      
      // ========== Title 双向同步 ==========
      // 场景1: simpleTitle 有变化 → 同步到 fullTitle（如果未设置）
      if ((updates as any).simpleTitle !== undefined && (updates as any).simpleTitle !== originalEvent.simpleTitle) {
        if ((updates as any).fullTitle === undefined) {
          (updatesWithSync as any).fullTitle = (updates as any).simpleTitle;
          console.log('[EventService] simpleTitle 更新 → 同步到 fullTitle:', {
            eventId,
            simpleTitle: (updates as any).simpleTitle.substring(0, 50),
          });
        }
        // 同步到 title（向后兼容）
        (updatesWithSync as any).title = (updates as any).simpleTitle;
      }
      
      // 场景2: fullTitle 有变化 → 同步到 simpleTitle（如果未设置）
      if ((updates as any).fullTitle !== undefined && (updates as any).fullTitle !== originalEvent.fullTitle) {
        if ((updates as any).simpleTitle === undefined) {
          (updatesWithSync as any).simpleTitle = this.stripHtml((updates as any).fullTitle);
          console.log('[EventService] fullTitle 更新 → 同步到 simpleTitle:', {
            eventId,
            fullTitle: (updates as any).fullTitle.substring(0, 50),
          });
        }
        // 同步到 title（向后兼容）
        (updatesWithSync as any).title = (updatesWithSync as any).simpleTitle || this.stripHtml((updates as any).fullTitle);
      }
      
      // ========== Description 双向同步 ==========
      // 场景1: description 有变化 → 同步到 eventlog
      if (updates.description !== undefined && updates.description !== originalEvent.description) {
        if ((updates as any).eventlog === undefined) {
          // 判断 originalEvent.eventlog 类型
          const isNewFormat = typeof (originalEvent as any).eventlog === 'object' && (originalEvent as any).eventlog !== null;
          
          if (isNewFormat) {
            // 新格式：更新 EventLog 对象
            const existingEventLog = (originalEvent as any).eventlog as EventLog;
            const newEventLog: EventLog = {
              ...existingEventLog,
              content: JSON.stringify([{ type: 'paragraph', children: [{ text: updates.description }] }]),
              descriptionHtml: updates.description,
              descriptionPlainText: this.stripHtml(updates.description),
              syncState: {
                ...existingEventLog.syncState,
                contentHash: this.hashContent(updates.description),
                status: 'pending',
              },
              updatedAt: formatTimeForStorage(new Date()),
            };
            (updatesWithSync as any).eventlog = newEventLog;
          } else {
            // 旧格式：直接赋值字符串
            (updatesWithSync as any).eventlog = updates.description;
          }
          
          console.log('[EventService] description 增量更新 → 同步到 eventlog:', {
            eventId,
            isNewFormat,
            description: updates.description.substring(0, 50),
          });
        }
      }
      
      // 场景2: eventlog 有变化 → 同步到 description
      if ((updates as any).eventlog !== undefined && (updates as any).eventlog !== (originalEvent as any).eventlog) {
        if (updates.description === undefined) {
          const newEventlog = (updates as any).eventlog;
          const isNewFormat = typeof newEventlog === 'object' && newEventlog !== null;
          
          if (isNewFormat) {
            // 新格式：从 EventLog 提取 descriptionHtml 或 descriptionPlainText
            const eventLogObj = newEventlog as EventLog;
            updatesWithSync.description = eventLogObj.descriptionHtml || eventLogObj.descriptionPlainText || '';
            
            // 🆕 自动更新 updatedAt
            (updatesWithSync as any).eventlog = {
              ...eventLogObj,
              updatedAt: formatTimeForStorage(new Date()),
            };
          } else {
            // 旧格式：提取纯文本
            const plainText = this.stripHtml(newEventlog as string);
            updatesWithSync.description = plainText;
          }
          
          console.log('[EventService] eventlog 增量更新 → 同步到 description:', {
            eventId,
            isNewFormat,
            description: updatesWithSync.description?.substring(0, 50),
          });
        }
      }
      
      // 场景3: 初始化场景 - eventlog 为空但 description 有内容
      if (!(originalEvent as any).eventlog && originalEvent.description && (updates as any).eventlog === undefined) {
        const initialEventLog: EventLog = {
          content: JSON.stringify([{ type: 'paragraph', children: [{ text: originalEvent.description }] }]),
          descriptionHtml: originalEvent.description,
          descriptionPlainText: this.stripHtml(originalEvent.description),
          attachments: [],
          versions: [],
          syncState: {
            status: 'pending',
            contentHash: this.hashContent(originalEvent.description),
          },
          createdAt: originalEvent.createdAt || formatTimeForStorage(new Date()),
          updatedAt: formatTimeForStorage(new Date()),
        };
        (updatesWithSync as any).eventlog = initialEventLog;
        
        console.log('[EventService] 初始化 eventlog 从 description:', {
          eventId,
          description: originalEvent.description.substring(0, 50)
        });
      }
      
      // ✅ v1.8: 验证合并后的事件（在过滤前）
      const mergedEvent = { ...originalEvent, ...updatesWithSync };
      const validation = validateEventTime(mergedEvent);
      if (!validation.valid) {
        eventLogger.error('❌ [EventService] Update validation failed:', validation.error);
        return { success: false, error: validation.error };
      }
      
      if (validation.warnings && validation.warnings.length > 0) {
        eventLogger.warn('⚠️ [EventService] Update warnings:', validation.warnings);
      }
      
      // 🆕 v1.8: 只合并非 undefined 的字段，避免覆盖已有数据
      // 🔧 v2.9: 但对于时间字段，允许显式设为 undefined 以清除
      const filteredUpdates: Partial<Event> = {};
      
      // 🔧 v2.9: 使用 Object.keys 遍历自有属性，避免原型链问题
      Object.keys(updatesWithSync).forEach(key => {
        const typedKey = key as keyof Event;
        const value = updatesWithSync[typedKey];
        
        // 🔧 如果值不是 undefined，直接包含
        // 🔧 如果值是 undefined 但 key 存在于 updatesWithSync（显式设置），也包含
        if (value !== undefined) {
          filteredUpdates[typedKey] = value as any;
        } else if (Object.prototype.hasOwnProperty.call(updatesWithSync, key)) {
          // 显式设置为 undefined（用于清除字段）
          filteredUpdates[typedKey] = undefined as any;
          console.log(`[EventService] 📝 显式清除字段: ${key}`);
        }
      });
      
      // 合并更新
      const updatedEvent: Event = {
        ...originalEvent,
        ...filteredUpdates,  // 🆕 使用过滤后的 updates
        id: eventId, // 确保ID不被覆盖
        updatedAt: formatTimeForStorage(new Date())
      };

      // 更新数组
      existingEvents[eventIndex] = updatedEvent;

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      eventLogger.log('💾 [EventService] Event updated in localStorage');
      
      // ✨ 自动提取并保存联系人（如果 organizer 或 attendees 有更新）
      if (updates.organizer !== undefined || updates.attendees !== undefined) {
        ContactService.extractAndAddFromEvent(updatedEvent.organizer, updatedEvent.attendees);
        eventLogger.log('👥 [EventService] Auto-extracted contacts from updated event');
      }
      
      eventLogger.log('✅ [EventService] 更新成功:', {
        eventId: updatedEvent.id,
        title: updatedEvent.title,
        startTime: updatedEvent.startTime,
        endTime: updatedEvent.endTime,
        isAllDay: updatedEvent.isAllDay
      });

      // 触发全局更新事件（携带完整事件数据）
      this.dispatchEventUpdate(eventId, { isUpdate: true, tags: updatedEvent.tags, event: updatedEvent });

      // 同步到Outlook
      if (!skipSync && syncManagerInstance && updatedEvent.syncStatus !== 'local-only') {
        // ✅ v1.8: 检查同步路由
        const syncRoute = determineSyncTarget(updatedEvent);
        
        if (syncRoute.target === 'none') {
          eventLogger.log(`⏭️ [EventService] Skipping sync: ${syncRoute.reason}`);
        } else {
          try {
            eventLogger.log('🔍 [DEBUG-TIMER] 即将调用 recordLocalAction (update)');
            eventLogger.log('🔍 [DEBUG-TIMER] syncTarget:', syncRoute.target);
            eventLogger.log('🔍 [DEBUG-TIMER] updatedEvent.syncStatus:', updatedEvent.syncStatus);
            eventLogger.log('🔍 [DEBUG-TIMER] originalEvent.syncStatus:', originalEvent.syncStatus);
            await syncManagerInstance.recordLocalAction('update', 'event', eventId, updatedEvent, originalEvent);
            eventLogger.log('🔄 [EventService] Event update synced to Outlook');
          } catch (syncError) {
            eventLogger.error('❌ [EventService] Sync failed (non-blocking):', syncError);
          }
        }
      } else {
        if (skipSync) {
          eventLogger.log('⏭️ [EventService] Sync skipped (skipSync=true)');
        } else if (updatedEvent.syncStatus === 'local-only') {
          eventLogger.log('⏭️ [EventService] Sync skipped (syncStatus=local-only)');
        }
      }

      return { success: true, event: updatedEvent };
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to update event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 删除事件
   * @param eventId - 事件ID
   * @param skipSync - 是否跳过同步
   */
  static async deleteEvent(eventId: string, skipSync: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      eventLogger.log('🗑�?[EventService] Deleting event:', eventId);

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('�?[EventService]', error);
        return { success: false, error };
      }

      const deletedEvent = existingEvents[eventIndex];

      // 从数组中移除
      const updatedEvents = existingEvents.filter(e => e.id !== eventId);

      // 保存到 localStorage
      console.log(`🗑️ [EventService] About to write ${updatedEvents.length} events to localStorage...`);
      const setItemStart = performance.now();
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      const setItemDuration = performance.now() - setItemStart;
      console.log(`💾 [EventService] localStorage.setItem took ${setItemDuration.toFixed(2)}ms`);
      eventLogger.log('💾 [EventService] Event deleted from localStorage');

      // 触发全局更新事件
      console.log(`🔔 [EventService] About to dispatch eventsUpdated...`);
      this.dispatchEventUpdate(eventId, { deleted: true });
      console.log(`✅ [EventService] dispatchEventUpdate completed`);

      // 同步�?Outlook
      if (!skipSync && syncManagerInstance && deletedEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('delete', 'event', eventId, null, deletedEvent);
          eventLogger.log('�?[EventService] Event deletion synced to Outlook');
        } catch (syncError) {
          eventLogger.error('�?[EventService] Sync failed (non-blocking):', syncError);
        }
      } else {
        if (skipSync) {
          eventLogger.log('⏭️ [EventService] Sync skipped (skipSync=true)');
        } else if (deletedEvent.syncStatus === 'local-only') {
          eventLogger.log('⏭️ [EventService] Sync skipped (syncStatus=local-only)');
        }
      }

      return { success: true };
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to delete event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 批量创建事件（用于导入或迁移场景�?
   */
  static async batchCreateEvents(events: Event[], skipSync: boolean = false): Promise<{ 
    success: boolean; 
    created: number; 
    failed: number;
    errors: string[];
  }> {
    let created = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const event of events) {
      const result = await this.createEvent(event, skipSync);
      if (result.success) {
        created++;
      } else {
        failed++;
        errors.push(`${event.id}: ${result.error}`);
      }
    }

    eventLogger.log(`📊 [EventService] Batch create: ${created} created, ${failed} failed`);
    return { success: failed === 0, created, failed, errors };
  }

  /**
   * 触发全局事件更新通知
   */
  private static dispatchEventUpdate(eventId: string, detail: any) {
    try {
      const eventDetail = { eventId, ...detail };
      
      // 1. 触发当前标签页的事件
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: eventDetail
      }));
      
      // 2. 广播到其他标签页
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'eventsUpdated',
            eventId,
            detail: eventDetail
          });
          eventLogger.log('📡 [EventService] Broadcasted to other tabs:', eventId);
        } catch (broadcastError) {
          eventLogger.warn('⚠️ [EventService] Failed to broadcast:', broadcastError);
        }
      }
      
      eventLogger.log('🔔 [EventService] Dispatched eventsUpdated event:', eventId);
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to dispatch event:', error);
    }
  }

  /**
   * 获取同步管理器实例（用于外部调试�?
   */
  static getSyncManager() {
    return syncManagerInstance;
  }

  /**
   * 检查服务是否已初始�?
   */
  static isInitialized(): boolean {
    return syncManagerInstance !== null;
  }

  /**
   * 🆕 v1.8.1: 生成内容哈希（用于检测 eventlog 变化）
   * 简化版实现：使用字符串长度 + 前100字符
   */
  private static hashContent(content: string): string {
    if (!content) return '0-';
    const prefix = content.substring(0, 100);
    return `${content.length}-${prefix.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0)}`;
  }

  /**
   * 🆕 v1.8.1: 移除 HTML 标签，提取纯文本
   */
  private static stripHtml(html: string): string {
    if (!html) return '';
    return html.replace(/<[^>]*>/g, '').trim();
  }

  /**
   * 🆕 v1.8.1: Slate JSON → HTML 转换（简化版）
   */
  private static slateToHtml(slateJson: any[]): string {
    if (!slateJson || !Array.isArray(slateJson)) return '';
    
    return slateJson.map(node => {
      if (node.type === 'paragraph') {
        const text = node.children?.map((child: any) => child.text || '').join('') || '';
        return `<p>${text}</p>`;
      }
      return '';
    }).join('');
  }

  /**
   * 搜索历史事件中的参会人
   * 从所有事件的 organizer 和 attendees 字段提取联系人
   */
  static searchHistoricalParticipants(query: string): import('../types').Contact[] {
    const allEvents = this.getAllEvents();
    const contactsMap = new Map<string, import('../types').Contact>();
    const lowerQuery = query.toLowerCase();

    allEvents.forEach(event => {
      // 提取 organizer
      if (event.organizer) {
        const key = event.organizer.email || event.organizer.name;
        if (key && !contactsMap.has(key)) {
          const matches = 
            event.organizer.name?.toLowerCase().includes(lowerQuery) ||
            event.organizer.email?.toLowerCase().includes(lowerQuery) ||
            event.organizer.organization?.toLowerCase().includes(lowerQuery);
          
          if (matches) {
            contactsMap.set(key, { ...event.organizer });
          }
        }
      }

      // 提取 attendees
      if (event.attendees) {
        event.attendees.forEach(attendee => {
          const key = attendee.email || attendee.name;
          if (key && !contactsMap.has(key)) {
            const matches =
              attendee.name?.toLowerCase().includes(lowerQuery) ||
              attendee.email?.toLowerCase().includes(lowerQuery) ||
              attendee.organization?.toLowerCase().includes(lowerQuery);
            
            if (matches) {
              contactsMap.set(key, { ...attendee });
            }
          }
        });
      }
    });

    return Array.from(contactsMap.values());
  }

  /**
   * 获取与特定联系人相关的事件
   * @param identifier 联系人邮箱或姓名
   * @param limit 返回数量限制
   */
  static getEventsByContact(identifier: string, limit: number = 5): Event[] {
    const allEvents = this.getAllEvents();
    const lowerIdentifier = identifier.toLowerCase();
    
    const relatedEvents = allEvents.filter(event => {
      // 检查 organizer
      if (event.organizer) {
        if (event.organizer.email?.toLowerCase() === lowerIdentifier ||
            event.organizer.name?.toLowerCase() === lowerIdentifier) {
          return true;
        }
      }
      
      // 检查 attendees
      if (event.attendees) {
        return event.attendees.some(attendee =>
          attendee.email?.toLowerCase() === lowerIdentifier ||
          attendee.name?.toLowerCase() === lowerIdentifier
        );
      }
      
      return false;
    });

    // 按时间倒序排列，返回最近的 N 个
    return relatedEvents
      .sort((a, b) => {
        const timeA = new Date(a.startTime || a.createdAt).getTime();
        const timeB = new Date(b.startTime || b.createdAt).getTime();
        return timeB - timeA;
      })
      .slice(0, limit);
  }
}

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
  (window as any).EventService = EventService;
}
