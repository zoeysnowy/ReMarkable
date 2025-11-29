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
import { EventHistoryService } from './EventHistoryService'; // 🆕 事件历史记录
import { jsonToSlateNodes, slateNodesToHtml } from '../components/ModalSlate/serialization'; // 🆕 Slate 转换

const eventLogger = logger.module('EventService');

// 同步管理器实例（将在初始化时设置）
let syncManagerInstance: any = null;

// 🔍 模块加载时的调试
console.log('🔍 [EventService] 模块加载，syncManagerInstance 初始化为 null');

// 跨标签页广播通道
let broadcastChannel: BroadcastChannel | null = null;

// 🆕 循环更新防护机制
let updateSequence = 0;
const pendingLocalUpdates = new Map<string, { updateId: number; timestamp: number; component: string }>();
const tabId = `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
      
      // 🆕 监听其他标签页的消息，过滤自己发送的消息
      broadcastChannel.onmessage = (event) => {
        const { senderId, ...data } = event.data;
        
        // 🚫 忽略自己发送的消息，避免循环
        if (senderId === tabId) {
          eventLogger.log('🔄 [EventService] 忽略自己的广播消息', { eventId: data.eventId });
          return;
        }
        
        // ✅ 处理其他标签页的更新
        if (data.type === 'eventsUpdated') {
          eventLogger.log('📡 [EventService] 收到其他标签页更新', { eventId: data.eventId, senderId });
          window.dispatchEvent(new CustomEvent('eventsUpdated', { 
            detail: { ...data, isFromOtherTab: true, senderId }
          }));
        }
      };
      
      eventLogger.log('📡 [EventService] BroadcastChannel initialized for cross-tab sync', { tabId });
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
   * 🆕 v2.14.1: 自动规范化 title 字段，兼容旧数据
   */
  static getAllEvents(): Event[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return [];
      
      const events: Event[] = JSON.parse(saved);
      
      // 🔧 自动规范化所有事件的 title 字段（处理旧数据中的 undefined）
      return events.map(event => ({
        ...event,
        title: this.normalizeTitle(event.title)
      }));
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to load events:', error);
      return [];
    }
  }

  /**
   * 根据ID获取事件
   * 🔧 性能优化：只规范化目标事件的 title 和 eventlog，避免全量处理
   */
  static getEventById(eventId: string): Event | null {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return null;
      
      const events: Event[] = JSON.parse(saved);
      const event = events.find(e => e.id === eventId);
      
      if (!event) return null;
      
      // 规范化 title 和 eventlog（传递 description 作为 fallback）
      return {
        ...event,
        title: this.normalizeTitle(event.title),
        eventlog: this.normalizeEventLog(event.eventlog, event.description)
      };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to get event by ID:', error);
      return null;
    }
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
   * @param options - 创建选项，包含来源组件信息
   */
  static async createEvent(
    event: Event, 
    skipSync: boolean = false,
    options?: {
      originComponent?: 'PlanManager' | 'TimeCalendar' | 'Timer' | 'EventEditModal';
      source?: 'user-edit' | 'external-sync' | 'auto-sync';
    }
  ): Promise<{ success: boolean; event?: Event; error?: string }> {
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
      if (!event.id) {
        const error = 'Event missing required field: id';
        eventLogger.error('❌ [EventService]', error, event);
        return { success: false, error };
      }
      
      // 标题可以为空（会在上层如 EventEditModal 或 TimeCalendar 中自动填充）
      // 如果既无标题又无标签，应该在 UI 层禁用保存按钮
      if (!event.title && (!event.tags || event.tags.length === 0)) {
        eventLogger.warn('⚠️ [EventService] Event has no title and no tags:', event.id);
      }

      // 🔥 v2.15.3: 中枢化架构 - 使用 normalizeEvent 统一处理所有字段
      const normalizedEvent = this.normalizeEvent(event);
      
      eventLogger.log('🔥 [EventService] createEvent 规范化完成:', {
        eventId: normalizedEvent.id,
        titleType: typeof normalizedEvent.title,
        hasSimpleTitle: !!normalizedEvent.title?.simpleTitle,
        hasEventLog: !!normalizedEvent.eventlog,
        eventlogHasSlateJson: !!normalizedEvent.eventlog?.slateJson,
        hasDescription: !!normalizedEvent.description,
      });
      
      // 确保必要字段
      // 🔧 [BUG FIX] skipSync=true时，强制设置syncStatus='local-only'，忽略event.syncStatus
      const finalEvent: Event = {
        ...normalizedEvent,
        remarkableSource: true,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending'), // skipSync优先级最高
        // normalizedEvent 已经包含完整的 title/eventlog/description/createdAt/updatedAt
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
      
      // 🆕 记录到事件历史
      EventHistoryService.logCreate(finalEvent, options?.source || 'user-edit');
      
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

      // 🆕 生成更新ID和跟踪本地更新
      const updateId = ++updateSequence;
      const originComponent = options?.originComponent || 'Unknown';
      const source = options?.source || 'user-edit';
      
      // 记录本地更新，用于循环检测
      if (source === 'user-edit') {
        pendingLocalUpdates.set(finalEvent.id, {
          updateId,
          timestamp: Date.now(),
          component: originComponent
        });
        
        // 5秒后清理，给广播和同步足够时间
        setTimeout(() => {
          pendingLocalUpdates.delete(finalEvent.id);
        }, 5000);
      }

      // 触发全局更新事件（携带完整事件数据和来源信息）
      this.dispatchEventUpdate(finalEvent.id, { 
        isNewEvent: true, 
        tags: finalEvent.tags, 
        event: finalEvent,
        updateId,
        originComponent,
        source,
        isLocalUpdate: source === 'user-edit'
      });

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
              title: finalEvent.title?.simpleTitle?.substring(0, 30) || '',
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
            title: finalEvent.title?.simpleTitle?.substring(0, 30) || '',
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
   * @param options - 更新选项，包含来源组件信息
   */
  static async updateEvent(
    eventId: string, 
    updates: Partial<Event> | Event, 
    skipSync: boolean = false,
    options?: {
      originComponent?: 'PlanManager' | 'TimeCalendar' | 'Timer' | 'EventEditModal';
      source?: 'user-edit' | 'external-sync' | 'auto-sync';
    }
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
          if (typeof log === 'object') return `[EventLog对象: ${log.plainText?.substring(0, 30) || '无内容'}]`;
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
      
      // ========== Title 三层架构同步 (v2.14) ==========
      if ((updates as any).title !== undefined) {
        const titleUpdate = (updates as any).title;
        
        // 🔥 使用增强版 normalizeTitle（支持字符串输入）
        const normalizedTitle = this.normalizeTitle(titleUpdate);
        
        (updatesWithSync as any).title = normalizedTitle;
        
        console.log('[EventService] title 更新（v2.14）:', {
          eventId,
          'update.fullTitle': !!titleUpdate?.fullTitle,
          'update.colorTitle': !!titleUpdate?.colorTitle,
          'update.simpleTitle': !!titleUpdate?.simpleTitle,
          'normalized.fullTitle': !!normalizedTitle.fullTitle,
          'normalized.colorTitle': !!normalizedTitle.colorTitle,
          'normalized.simpleTitle': !!normalizedTitle.simpleTitle
        });
      }
      
      // ========== EventLog 和 Description 双向同步 ==========
      // 🔥 使用 normalizeEventLog 统一处理（支持从 description 生成）
      
      // 场景1: eventlog 有变化 → 规范化并同步到 description
      if ((updates as any).eventlog !== undefined) {
        const normalizedEventLog = this.normalizeEventLog((updates as any).eventlog);
        (updatesWithSync as any).eventlog = normalizedEventLog;
        
        // 同步到 description
        if (updatesWithSync.description === undefined) {
          updatesWithSync.description = normalizedEventLog.plainText || '';
        }
        
        console.log('[EventService] eventlog 更新 → 规范化并同步到 description:', {
          eventId,
          hasSlateJson: !!normalizedEventLog.slateJson,
          hasHtml: !!normalizedEventLog.html,
          hasPlainText: !!normalizedEventLog.plainText
        });
      }
      
      // 场景2: description 有变化但 eventlog 没变 → 从 description 生成 eventlog
      else if (updates.description !== undefined && updates.description !== originalEvent.description) {
        const normalizedEventLog = this.normalizeEventLog(updates.description);
        (updatesWithSync as any).eventlog = normalizedEventLog;
        
        console.log('[EventService] description 更新 → 生成 eventlog:', {
          eventId,
          description: updates.description.substring(0, 50)
        });
      }
      
      // 场景3: 都没变，但原始事件缺少 eventlog → 从 description 补全
      else if (!(originalEvent as any).eventlog && originalEvent.description) {
        const normalizedEventLog = this.normalizeEventLog(originalEvent.description);
        (updatesWithSync as any).eventlog = normalizedEventLog;
        
        console.log('[EventService] 补全缺失的 eventlog（从 description）:', {
          eventId
        });
      }
      
      // 🔍 临时保留旧代码用于兼容性检查（可在后续版本移除）
      const __legacy_check = false;
      if (__legacy_check) {
        const newEventlog = (updates as any).eventlog;
        const isEventLogObject = typeof newEventlog === 'object' && newEventlog !== null && 'slateJson' in newEventlog;
        const isSlateJsonString = typeof newEventlog === 'string' && newEventlog.trim().startsWith('[');
        
        console.log('🔍 [EventService] eventlog 变化检测:', {
          eventId,
          type: typeof newEventlog,
          isArray: Array.isArray(newEventlog),
          isEventLogObject,
          isSlateJsonString,
          preview: typeof newEventlog === 'string' ? newEventlog.substring(0, 100) : JSON.stringify(newEventlog).substring(0, 100)
        });
        
        if (isEventLogObject) {
          // 格式1: 已经是 EventLog 对象 - 直接使用
          const eventLogObj = newEventlog as EventLog;
          (updatesWithSync as any).eventlog = {
            ...eventLogObj,
            updatedAt: formatTimeForStorage(new Date()),
          };
          
          if (updates.description === undefined) {
            updatesWithSync.description = eventLogObj.html || eventLogObj.plainText || '';
          }
          
          console.log('[EventService] eventlog 已是对象格式，直接使用');
        } else if (isSlateJsonString) {
          // 格式2: Slate JSON 字符串 - 自动转换为 EventLog 对象
          try {
            const slateNodes = jsonToSlateNodes(newEventlog);
            const htmlDescription = slateNodesToHtml(slateNodes);
            const plainTextDescription = htmlDescription.replace(/<[^>]*>/g, '');
            
            // 构建完整的 EventLog 对象
            const eventLogObject: EventLog = {
              slateJson: newEventlog,
              html: htmlDescription,
              plainText: plainTextDescription,
              attachments: (originalEvent as any)?.eventlog?.attachments || [],
              versions: (originalEvent as any)?.eventlog?.versions || [],
              syncState: {
                status: 'pending',
                contentHash: this.hashContent(newEventlog),
              },
              createdAt: (originalEvent as any)?.eventlog?.createdAt || formatTimeForStorage(new Date()),
              updatedAt: formatTimeForStorage(new Date()),
            };
            
            (updatesWithSync as any).eventlog = eventLogObject;
            
            if (updates.description === undefined) {
              updatesWithSync.description = htmlDescription;
            }
            
            console.log('[EventService] ✅ Slate JSON 自动转换为 EventLog 对象:', {
              eventId,
              contentLength: newEventlog.length,
              htmlLength: htmlDescription.length,
              plainTextLength: plainTextDescription.length,
              htmlPreview: htmlDescription.substring(0, 100),
              descriptionSet: updates.description === undefined
            });
          } catch (error) {
            console.error('[EventService] ❌ Slate JSON 转换失败:', error);
            // 降级：保存原始字符串
            (updatesWithSync as any).eventlog = newEventlog;
          }
        } else {
          // 格式3: 其他格式（向后兼容）- 提取纯文本
          if (typeof newEventlog === 'string') {
            const plainText = this.stripHtml(newEventlog);
            (updatesWithSync as any).eventlog = newEventlog;
            
            if (updates.description === undefined) {
              updatesWithSync.description = plainText;
            }
            
            console.log('[EventService] eventlog 旧格式，提取纯文本');
          } else {
            // 🔧 非字符串格式，直接保存
            (updatesWithSync as any).eventlog = newEventlog;
            console.log('[EventService] eventlog 未知格式，直接保存');
          }
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
      
      // 🔍 验证同步配置是否保存
      if (filteredUpdates.planSyncConfig || filteredUpdates.actualSyncConfig) {
        console.log('🔍 [EventService] 同步配置保存验证:', {
          eventId,
          保存前_planSyncConfig: originalEvent.planSyncConfig,
          保存后_planSyncConfig: updatedEvent.planSyncConfig,
          保存前_actualSyncConfig: originalEvent.actualSyncConfig,
          保存后_actualSyncConfig: updatedEvent.actualSyncConfig,
          更新字段包含planSyncConfig: !!filteredUpdates.planSyncConfig,
          更新字段包含actualSyncConfig: !!filteredUpdates.actualSyncConfig
        });
      }
      
      // 记录事件历史
      EventHistoryService.logUpdate(eventId, originalEvent, filteredUpdates, options?.source || 'user-edit');
      
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

      // 🆕 生成更新ID和跟踪本地更新
      const updateId = ++updateSequence;
      const originComponent = options?.originComponent || 'Unknown';
      const source = options?.source || 'user-edit';
      
      // 记录本地更新，用于循环检测
      if (source === 'user-edit') {
        pendingLocalUpdates.set(eventId, {
          updateId,
          timestamp: Date.now(),
          component: originComponent
        });
        
        // 5秒后清理，给广播和同步足够时间
        setTimeout(() => {
          pendingLocalUpdates.delete(eventId);
        }, 5000);
      }

      // 触发全局更新事件（携带完整事件数据和来源信息）
      this.dispatchEventUpdate(eventId, { 
        isUpdate: true, 
        tags: updatedEvent.tags, 
        event: updatedEvent,
        updateId,
        originComponent,
        source,
        isLocalUpdate: source === 'user-edit'
      });

      // 同步到Outlook
      console.log('🔍 [EventService] Sync condition check:', {
        eventId,
        skipSync,
        hasSyncManager: !!syncManagerInstance,
        syncStatus: updatedEvent.syncStatus,
        willEnterSyncBlock: !skipSync && !!syncManagerInstance && updatedEvent.syncStatus !== 'local-only'
      });
      
      if (!skipSync && syncManagerInstance && updatedEvent.syncStatus !== 'local-only') {
        // ✅ v1.8: 检查同步路由
        const syncRoute = determineSyncTarget(updatedEvent);
        
        console.log('🔍 [EventService] Sync route check:', {
          eventId,
          syncMode: updatedEvent.syncMode,
          syncTarget: syncRoute.target,
          syncReason: syncRoute.reason,
          willSync: syncRoute.target !== 'none'
        });
        
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
      
      // 记录事件历史
      EventHistoryService.logDelete(deletedEvent, 'user-edit');

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
   * 事件签到 - 记录签到时间戳
   */
  static checkIn(eventId: string): { success: boolean; error?: string } {
    try {
      eventLogger.log('✅ [EventService] Checking in event:', eventId);

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }

      const event = existingEvents[eventIndex];
      const timestamp = formatTimeForStorage(new Date());

      // 🐛 DEBUG: Log checkType before update (checkType is at root level, not in metadata)
      console.log('🔍 [EventService.checkIn] BEFORE update:', {
        eventId: eventId.slice(-10),
        checkType: event.checkType,
        checkedCount: event.checked?.length || 0,
        title: event.title?.simpleTitle?.substring(0, 20)
      });

      // 初始化checked数组（如果不存在）
      if (!event.checked) {
        event.checked = [];
      }

      // 添加签到时间戳
      event.checked.push(timestamp);

      // 更新updatedAt
      event.updatedAt = timestamp;

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      eventLogger.log('💾 [EventService] Event checked in, saved to localStorage');

      // 🐛 DEBUG: Log checkType after save
      console.log('🔍 [EventService.checkIn] AFTER save:', {
        eventId: eventId.slice(-10),
        checkType: event.checkType,
        checkedCount: event.checked.length,
        willDispatchUpdate: true
      });

      // 记录事件历史
      EventHistoryService.logCheckin(eventId, event.title?.simpleTitle || 'Untitled Event', { action: 'check-in', timestamp });

      // 触发更新事件
      this.dispatchEventUpdate(eventId, { checkedIn: true, timestamp });

      eventLogger.log('✅ [EventService] 签到成功:', {
        eventId,
        timestamp,
        totalCheckins: event.checked.length
      });

      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to check in event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 取消事件签到 - 记录取消签到时间戳
   */
  static uncheck(eventId: string): { success: boolean; error?: string } {
    try {
      eventLogger.log('❌ [EventService] Unchecking event:', eventId);

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }

      const event = existingEvents[eventIndex];
      const timestamp = formatTimeForStorage(new Date());

      // 初始化unchecked数组（如果不存在）
      if (!event.unchecked) {
        event.unchecked = [];
      }

      // 添加取消签到时间戳
      event.unchecked.push(timestamp);

      // 更新updatedAt
      event.updatedAt = timestamp;

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      eventLogger.log('💾 [EventService] Event unchecked, saved to localStorage');

      // 记录事件历史
      EventHistoryService.logCheckin(eventId, event.title?.simpleTitle || 'Untitled Event', { action: 'uncheck', timestamp });

      // 触发更新事件
      this.dispatchEventUpdate(eventId, { unchecked: true, timestamp });

      eventLogger.log('❌ [EventService] 取消签到成功:', {
        eventId,
        timestamp,
        totalUnchecks: event.unchecked.length
      });

      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to uncheck event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 获取事件的签到状态
   */
  static getCheckInStatus(eventId: string): { 
    isChecked: boolean; 
    lastCheckIn?: string; 
    lastUncheck?: string;
    checkInCount: number;
    uncheckCount: number;
    checkType: import('../types').CheckType;
    recurringConfig?: import('../types').RecurringConfig;
  } {
    const event = this.getEventById(eventId);
    if (!event) {
      return { 
        isChecked: false, 
        checkInCount: 0, 
        uncheckCount: 0,
        checkType: 'none'
      };
    }

    const checked = event.checked || [];
    const unchecked = event.unchecked || [];
    
    // 获取最后的操作时间戳来判断当前状态
    const lastCheckIn = checked.length > 0 ? checked[checked.length - 1] : undefined;
    const lastUncheck = unchecked.length > 0 ? unchecked[unchecked.length - 1] : undefined;
    
    // 如果都没有操作，默认未签到
    if (!lastCheckIn && !lastUncheck) {
      return { 
        isChecked: false, 
        checkInCount: checked.length, 
        uncheckCount: unchecked.length,
        checkType: event.checkType || 'once', // 🔧 默认显示 checkbox（与 planItemsToSlateNodes 保持一致）
        recurringConfig: event.recurringConfig
      };
    }
    
    // 比较最后的签到和取消签到时间
    const isChecked = lastCheckIn && (!lastUncheck || lastCheckIn > lastUncheck);

    return {
      isChecked,
      lastCheckIn,
      lastUncheck,
      checkInCount: checked.length,
      uncheckCount: unchecked.length,
      checkType: event.checkType || 'once', // 🔧 默认显示 checkbox（与 planItemsToSlateNodes 保持一致）
      recurringConfig: event.recurringConfig
    };
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
      const eventDetail = { 
        eventId, 
        ...detail,
        senderId: tabId,  // 🆕 添加发送者标识
        timestamp: Date.now()
      };
      
      // 1. 触发当前标签页的事件
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: eventDetail
      }));
      
      // 2. 广播到其他标签页（携带发送者ID）
      if (broadcastChannel) {
        try {
          broadcastChannel.postMessage({
            type: 'eventsUpdated',
            senderId: tabId,  // 🆕 标记发送者
            eventId,
            ...detail,
            timestamp: Date.now()
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
   * 🆕 循环更新防护：检查是否为本地更新
   */
  static isLocalUpdate(eventId: string, updateId?: number): boolean {
    const localUpdate = pendingLocalUpdates.get(eventId);
    if (!localUpdate) return false;
    
    // 如果提供了 updateId，检查是否匹配
    if (updateId !== undefined) {
      return localUpdate.updateId === updateId;
    }
    
    // 检查时间窗口（5秒内为本地更新）
    const timeDiff = Date.now() - localUpdate.timestamp;
    return timeDiff < 5000;
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

  // ==================== 标题三层架构转换工具 (v2.14) ====================

  /**
   * Slate JSON → HTML（移除 Slate 元素节点，保留格式）
   * @param fullTitle - Slate JSON 字符串
   * @returns HTML 字符串（保留颜色、加粗等样式）
   */
  private static fullTitleToColorTitle(fullTitle: string): string {
    if (!fullTitle) return '';
    
    try {
      const nodes = JSON.parse(fullTitle);
      if (!Array.isArray(nodes)) return '';
      
      // 遍历节点，提取文本和格式，排除 tag/dateMention 等元素
      const extractTextWithFormat = (node: any): string => {
        if (node.type === 'tag' || node.type === 'dateMention') {
          // 跳过 Slate 元素节点
          return '';
        }
        
        if (node.type === 'paragraph') {
          const content = node.children
            ?.map((child: any) => extractTextWithFormat(child))
            .filter((text: string) => text)
            .join('');
          return content ? `<p>${content}</p>` : '';
        }
        
        // 文本节点：保留格式
        if (node.text !== undefined) {
          let text = node.text;
          if (!text) return '';
          
          // 应用样式
          if (node.bold) text = `<strong>${text}</strong>`;
          if (node.italic) text = `<em>${text}</em>`;
          if (node.underline) text = `<u>${text}</u>`;
          if (node.strikethrough) text = `<del>${text}</del>`;
          
          // 应用颜色
          if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
          if (node.backgroundColor) text = `<span style="background-color: ${node.backgroundColor}">${text}</span>`;
          
          return text;
        }
        
        return '';
      };
      
      return nodes.map(extractTextWithFormat).filter(html => html).join('');
    } catch (error) {
      console.warn('[EventService] fullTitleToColorTitle 解析失败:', error);
      return '';
    }
  }

  /**
   * HTML → 纯文本
   * @param colorTitle - HTML 字符串
   * @returns 纯文本
   */
  private static colorTitleToSimpleTitle(colorTitle: string): string {
    return this.stripHtml(colorTitle);
  }

  /**
   * 纯文本 → Slate JSON
   * @param simpleTitle - 纯文本
   * @returns Slate JSON 字符串
   */
  private static simpleTitleToFullTitle(simpleTitle: string): string {
    if (!simpleTitle) return JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]);
    
    return JSON.stringify([
      {
        type: 'paragraph',
        children: [{ text: simpleTitle }]
      }
    ]);
  }

  /**
   * 规范化标题对象：自动填充缺失的层级
   * @param titleInput - 部分标题数据（可能只有 fullTitle/colorTitle/simpleTitle 之一），或者字符串（远程同步场景）
   * @returns 完整的 EventTitle 对象（包含三层）
   * 
   * 🔥 中枢化架构：统一处理所有 title 输入格式
   * 
   * 规则：
   * 0. 如果是字符串（Outlook/Timer/旧数据） → 转换为 simpleTitle，然后升级为三层
   * 1. 有 fullTitle → 降级生成 colorTitle 和 simpleTitle
   * 2. 有 colorTitle → 升级生成 fullTitle，降级生成 simpleTitle
   * 3. 有 simpleTitle → 升级生成 colorTitle 和 fullTitle
   * 4. 多个字段都有 → 保持原样，不覆盖
   */
  private static normalizeTitle(titleInput: Partial<import('../types').EventTitle> | string | undefined): import('../types').EventTitle {
    const result: import('../types').EventTitle = {};
    
    // 🔧 场景 0: 兼容旧格式 - 字符串 title（来自 Timer、Outlook 同步等）
    if (typeof titleInput === 'string') {
      return {
        simpleTitle: titleInput,
        colorTitle: titleInput,
        fullTitle: this.simpleTitleToFullTitle(titleInput)
      };
    }
    
    if (!titleInput) {
      // 空标题：返回空对象
      return {
        fullTitle: this.simpleTitleToFullTitle(''),
        colorTitle: '',
        simpleTitle: ''
      };
    }
    
    const { fullTitle, colorTitle, simpleTitle } = titleInput;
    
    // 🔧 边界情况：所有字段都是 undefined → 视为空标题
    if (!fullTitle && !colorTitle && !simpleTitle) {
      return {
        fullTitle: this.simpleTitleToFullTitle(''),
        colorTitle: '',
        simpleTitle: ''
      };
    }
    
    // 场景 1: 只有 fullTitle → 降级生成 colorTitle 和 simpleTitle
    if (fullTitle && !colorTitle && !simpleTitle) {
      result.fullTitle = fullTitle;
      result.colorTitle = this.fullTitleToColorTitle(fullTitle);
      result.simpleTitle = this.colorTitleToSimpleTitle(result.colorTitle);
    }
    
    // 场景 2: 只有 colorTitle → 升级生成 fullTitle，降级生成 simpleTitle
    else if (colorTitle && !fullTitle && !simpleTitle) {
      result.colorTitle = colorTitle;
      result.simpleTitle = this.colorTitleToSimpleTitle(colorTitle);
      // 简化升级：colorTitle 无法完美转换为 Slate JSON，使用纯文本升级
      result.fullTitle = this.simpleTitleToFullTitle(result.simpleTitle);
    }
    
    // 场景 3: 只有 simpleTitle → 升级生成 colorTitle 和 fullTitle
    // 🔧 修复：使用 === undefined 严格判断，避免空字符串被误判
    else if (simpleTitle && colorTitle === undefined && fullTitle === undefined) {
      result.simpleTitle = simpleTitle;
      result.colorTitle = simpleTitle; // 纯文本直接赋值（无格式）
      result.fullTitle = this.simpleTitleToFullTitle(simpleTitle);
    }
    
    // 场景 4: 多个字段都有 → 保持原样，填充缺失字段
    else {
      result.fullTitle = fullTitle ?? (simpleTitle ? this.simpleTitleToFullTitle(simpleTitle) : this.simpleTitleToFullTitle(''));
      result.colorTitle = colorTitle ?? simpleTitle ?? '';
      result.simpleTitle = simpleTitle ?? (colorTitle ? this.colorTitleToSimpleTitle(colorTitle) : '');
    }
    
    return result;
  }

  /**
   * 标准化 eventlog 字段
   * 将各种格式的 eventlog 输入统一转换为 EventLog 对象
   * 
   * @param eventlogInput - 支持 5 种输入格式:
   *   1. EventLog 对象（已标准化）→ 直接返回
   *   2. Slate JSON 字符串 → 自动转换
   *   3. HTML 字符串 → 反向识别后转换
   *   4. 纯文本字符串 → 转换为单段落
   *   5. undefined/null → 返回空 EventLog
   * @returns 标准化的 EventLog 对象
   */
  /**
   * 🔥 中枢化架构：规范化 EventLog 对象
   * 支持多种输入格式，统一转换为完整的 EventLog 对象
   * 
   * @param eventlogInput - 可能是 EventLog 对象、Slate JSON 字符串、HTML、纯文本、或 undefined
   * @param fallbackDescription - 回退用的 description 字符串（用于远程同步场景）
   * @returns 完整的 EventLog 对象
   */
  private static normalizeEventLog(eventlogInput: any, fallbackDescription?: string): EventLog {
    // 情况1: 已经是 EventLog 对象
    if (typeof eventlogInput === 'object' && eventlogInput !== null && 'slateJson' in eventlogInput) {
      const eventLog = eventlogInput as EventLog;
      
      // 🔧 检查 eventlog 是否为空（slateJson 是空数组）
      if (eventLog.slateJson === '[]' && fallbackDescription && fallbackDescription.trim()) {
        console.log('[EventService] ⚠️ eventlog.slateJson 为空数组，从 fallbackDescription 生成');
        return this.convertSlateJsonToEventLog(JSON.stringify([{
          type: 'paragraph',
          children: [{ text: fallbackDescription }]
        }]));
      }
      
      console.log('[EventService] eventlog 已是标准对象');
      
      // 🔧 确保所有必需字段都存在（从 slateJson 生成缺失的字段）
      if (!eventLog.html || !eventLog.plainText) {
        console.log('[EventService] EventLog 缺少 html/plainText，从 slateJson 生成');
        try {
          const slateNodes = jsonToSlateNodes(eventLog.slateJson);
          const html = slateNodesToHtml(slateNodes);
          const plainText = html.replace(/<[^>]*>/g, '');
          
          return {
            ...eventLog,
            html: eventLog.html || html,
            plainText: eventLog.plainText || plainText,
          };
        } catch (error) {
          console.error('[EventService] 从 slateJson 生成 html/plainText 失败:', error);
          return eventLog; // 失败时返回原对象
        }
      }
      
      return eventLog;
    }
    
    // 情况2: undefined 或 null - 尝试从 fallbackDescription 生成
    if (eventlogInput === undefined || eventlogInput === null) {
      if (fallbackDescription && fallbackDescription.trim()) {
        console.log('[EventService] eventlog 为空，从 fallbackDescription 生成:', fallbackDescription.substring(0, 50));
        return this.convertSlateJsonToEventLog(JSON.stringify([{
          type: 'paragraph',
          children: [{ text: fallbackDescription }]
        }]));
      }
      // console.log('[EventService] eventlog 和 fallbackDescription 均为空，返回空对象');
      return this.convertSlateJsonToEventLog('[]');
    }
    
    // 情况3-5: 字符串格式（需要判断类型）
    if (typeof eventlogInput === 'string') {
      const trimmed = eventlogInput.trim();
      
      // 空字符串
      if (!trimmed) {
        return this.convertSlateJsonToEventLog('[]');
      }
      
      // Slate JSON 字符串（以 [ 开头）
      if (trimmed.startsWith('[')) {
        console.log('[EventService] 检测到 Slate JSON 字符串');
        return this.convertSlateJsonToEventLog(eventlogInput);
      }
      
      // HTML 字符串（包含标签）
      if (trimmed.startsWith('<') || trimmed.includes('<p>') || trimmed.includes('<div>')) {
        console.log('[EventService] 检测到 HTML 字符串，进行反向识别');
        // 使用反向识别将 HTML 转换为 Slate JSON
        const slateJson = this.htmlToSlateJsonWithRecognition(eventlogInput);
        return this.convertSlateJsonToEventLog(slateJson);
      }
      
      // 纯文本字符串
      console.log('[EventService] 检测到纯文本，转换为单段落');
      const slateJson = JSON.stringify([{
        type: 'paragraph',
        children: [{ text: eventlogInput }]
      }]);
      return this.convertSlateJsonToEventLog(slateJson);
    }
    
    // 🆕 情况6: 从 description 字符串生成（用于远程同步回退）
    // 注意：这个分支通常不会被直接调用，因为上面的"纯文本字符串"分支已覆盖
    // 但保留作为明确的文档说明
    
    // 情况7: 未知对象格式 - 尝试智能提取
    if (typeof eventlogInput === 'object' && eventlogInput !== null) {
      // 🔧 检查是否有 content 字段（包含 Slate JSON）
      if (eventlogInput.content && typeof eventlogInput.content === 'string') {
        // content 字段可能是 Slate JSON 字符串
        try {
          const parsed = JSON.parse(eventlogInput.content);
          if (Array.isArray(parsed)) {
            // ✅ 是有效的 Slate JSON，直接使用
            return this.convertSlateJsonToEventLog(eventlogInput.content);
          }
        } catch (e) {
          // 不是 JSON，当作纯文本处理
        }
      }
      
      // 🔧 尝试提取其他常见字段
      const possibleText = eventlogInput.content || 
                          eventlogInput.plainText || 
                          eventlogInput.descriptionPlainText ||
                          eventlogInput.text || 
                          eventlogInput.description;
      
      if (typeof possibleText === 'string' && possibleText.trim()) {
        // 只在首次遇到时打印一次日志
        if (!(eventlogInput as any)._loggedOnce) {
          console.log('[EventService] 从未知对象提取字段:', Object.keys(eventlogInput).slice(0, 3).join(', '));
          (eventlogInput as any)._loggedOnce = true;
        }
        return this.convertSlateJsonToEventLog(JSON.stringify([{
          type: 'paragraph',
          children: [{ text: possibleText }]
        }]));
      }
      
      // 最后的回退：JSON.stringify 整个对象
      console.warn('[EventService] 无法从对象提取文本，使用 JSON.stringify:', Object.keys(eventlogInput));
      return this.convertSlateJsonToEventLog(JSON.stringify([{
        type: 'paragraph',
        children: [{ text: JSON.stringify(eventlogInput) }]
      }]));
    }
    
    // 未知格式 - 降级为空
    console.warn('[EventService] 无法处理的 eventlog 格式:', typeof eventlogInput);
    return this.convertSlateJsonToEventLog('[]');
  }
  
  /**
   * 🔥 中枢化架构：统一的事件数据规范化入口
   * 所有事件在存储前必须经过此方法处理，确保数据完整性和一致性
   * 
   * @param event - 部分事件数据（可能来自 UI、远程同步、或旧数据）
   * @returns 完整且规范化的 Event 对象
   * 
   * 处理内容：
   * - title: 字符串 → EventTitle 对象（三层架构）
   * - eventlog: 从 eventlog 或 description 生成完整 EventLog 对象
   * - description: 从 eventlog 提取或使用原值
   * - 其他字段: 填充默认值和时间戳
   */
  private static normalizeEvent(event: Partial<Event>): Event {
    const now = formatTimeForStorage(new Date());
    
    // 🔥 Title 规范化（支持字符串或对象输入）
    const normalizedTitle = this.normalizeTitle(event.title);
    
    // 🔥 EventLog 规范化（优先从 eventlog，回退到 description）
    const normalizedEventLog = this.normalizeEventLog(
      event.eventlog, 
      event.description  // 回退用的 description
    );
    
    // 🔥 Description 规范化（从 eventlog 提取或使用原值）
    const normalizedDescription = normalizedEventLog.plainText || event.description || '';
    
    return {
      // 基础标识
      id: event.id || generateEventId(),
      
      // 规范化字段
      title: normalizedTitle,
      eventlog: normalizedEventLog,
      description: normalizedDescription,
      
      // 时间字段
      startTime: event.startTime,
      endTime: event.endTime,
      isAllDay: event.isAllDay || false,
      dueDate: event.dueDate,
      
      // 分类字段
      tags: event.tags || [],
      calendarId: event.calendarId,
      priority: event.priority,
      
      // 协作字段
      organizer: event.organizer,
      attendees: event.attendees || [],
      location: event.location || '',
      
      // 来源标识
      remarkableSource: event.remarkableSource,
      microsoftEventId: event.microsoftEventId,
      isPlan: event.isPlan,
      isTimeCalendar: event.isTimeCalendar,
      isTimer: event.isTimer,
      isDeadline: event.isDeadline,
      
      // 任务模式
      isTask: event.isTask,
      isCompleted: event.isCompleted,
      parentTaskId: event.parentTaskId,
      childTaskCount: event.childTaskCount,
      childTaskCompletedCount: event.childTaskCompletedCount,
      
      // Timer 关联
      parentEventId: event.parentEventId,
      timerLogs: event.timerLogs,
      
      // 日历同步配置
      calendarIds: event.calendarIds || [],
      syncMode: event.syncMode,
      subEventConfig: event.subEventConfig,
      syncedEventId: event.syncedEventId,
      
      // 签到字段
      checked: event.checked || [],
      unchecked: event.unchecked || [],
      
      // 外部同步
      externalId: event.externalId,
      source: event.source,
      
      // 时间戳
      createdAt: event.createdAt || now,
      updatedAt: now,
      lastLocalChange: now,
      localVersion: (event.localVersion || 0) + 1,
      syncStatus: event.syncStatus || 'pending',
    } as Event;
  }

  /**
   * 将 Slate JSON 字符串转换为完整的 EventLog 对象
   * （由 normalizeEventLog 调用）
   */
  private static convertSlateJsonToEventLog(slateJson: string): EventLog {
    try {
      const slateNodes = jsonToSlateNodes(slateJson);
      const htmlDescription = slateNodesToHtml(slateNodes);
      const plainTextDescription = htmlDescription.replace(/<[^>]*>/g, '');
      
      return {
        slateJson: slateJson,
        html: htmlDescription,
        plainText: plainTextDescription,
        attachments: [],
        versions: [],
        syncState: {
          status: 'pending',
          contentHash: this.hashContent(slateJson),
        },
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date()),
      };
    } catch (error) {
      console.error('[EventService] convertSlateJsonToEventLog 失败:', error);
      // 降级返回空对象
      return {
        slateJson: '[]',
        html: '',
        plainText: '',
        attachments: [],
        versions: [],
        syncState: { status: 'pending' },
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date()),
      };
    }
  }
  
  /**
   * HTML 转换为 Slate JSON（含反向识别）
   * 从 Outlook 返回的 HTML 中识别出 App 元素（Tag、DateMention 等）
   */
  private static htmlToSlateJsonWithRecognition(html: string): string {
    try {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = html;
      
      const slateNodes: any[] = [];
      
      // 遍历 HTML 节点并转换
      this.parseHtmlNode(tempDiv, slateNodes);
      
      // 确保至少有一个段落
      if (slateNodes.length === 0) {
        slateNodes.push({
          type: 'paragraph',
          children: [{ text: '' }]
        });
      }
      
      return JSON.stringify(slateNodes);
    } catch (error) {
      console.error('[EventService] htmlToSlateJsonWithRecognition 失败:', error);
      // 降级返回空数组
      return '[]';
    }
  }
  
  /**
   * 递归解析 HTML 节点
   */
  private static parseHtmlNode(node: Node, slateNodes: any[]): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        // 检查文本中是否包含 Tag 或 DateMention 模式
        const fragments = this.recognizeInlineElements(text);
        slateNodes.push(...fragments);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // 1. 精确匹配：检查 data-* 属性
      const recognizedNode = this.recognizeByDataAttributes(element);
      if (recognizedNode) {
        slateNodes.push(recognizedNode);
        return;
      }
      
      // 2. 块级元素：段落、列表等
      if (element.tagName === 'P' || element.tagName === 'DIV') {
        const paragraphChildren: any[] = [];
        element.childNodes.forEach(child => {
          this.parseHtmlNode(child, paragraphChildren);
        });
        
        if (paragraphChildren.length > 0) {
          slateNodes.push({
            type: 'paragraph',
            children: paragraphChildren
          });
        }
        return;
      }
      
      // 3. 格式化元素：bold, italic, underline 等
      if (['STRONG', 'B', 'EM', 'I', 'U', 'S', 'SPAN'].includes(element.tagName)) {
        const marks: any = {};
        
        if (element.tagName === 'STRONG' || element.tagName === 'B') marks.bold = true;
        if (element.tagName === 'EM' || element.tagName === 'I') marks.italic = true;
        if (element.tagName === 'U') marks.underline = true;
        if (element.tagName === 'S') marks.strikethrough = true;
        
        // 提取颜色
        const style = element.getAttribute('style');
        if (style) {
          const colorMatch = style.match(/color:\s*([^;]+)/);
          const bgColorMatch = style.match(/background-color:\s*([^;]+)/);
          if (colorMatch) marks.color = colorMatch[1].trim();
          if (bgColorMatch) marks.backgroundColor = bgColorMatch[1].trim();
        }
        
        // 递归处理子节点
        element.childNodes.forEach(child => {
          if (child.nodeType === Node.TEXT_NODE) {
            slateNodes.push({ text: child.textContent || '', ...marks });
          } else {
            this.parseHtmlNode(child, slateNodes);
          }
        });
        return;
      }
      
      // 4. 其他元素：递归处理子节点
      element.childNodes.forEach(child => {
        this.parseHtmlNode(child, slateNodes);
      });
    }
  }
  
  /**
   * 通过 data-* 属性精确识别元素
   */
  private static recognizeByDataAttributes(element: HTMLElement): any | null {
    // TagNode 识别
    if (element.hasAttribute('data-tag-id')) {
      return {
        type: 'tag',
        tagId: element.getAttribute('data-tag-id') || '',
        tagName: element.getAttribute('data-tag-name') || '',
        tagColor: element.getAttribute('data-tag-color') || undefined,
        tagEmoji: element.getAttribute('data-tag-emoji') || undefined,
        mentionOnly: element.hasAttribute('data-mention-only'),
        children: [{ text: '' }]
      };
    }
    
    // DateMentionNode 识别
    if (element.getAttribute('data-type') === 'dateMention' || element.hasAttribute('data-start-date')) {
      const startDate = element.getAttribute('data-start-date');
      if (startDate) {
        return {
          type: 'dateMention',
          startDate: startDate,
          endDate: element.getAttribute('data-end-date') || undefined,
          eventId: element.getAttribute('data-event-id') || undefined,
          originalText: element.getAttribute('data-original-text') || undefined,
          isOutdated: element.getAttribute('data-is-outdated') === 'true',
          children: [{ text: '' }]
        };
      }
    }
    
    return null;
  }
  
  /**
   * 识别文本中的内联元素（Tag、DateMention）
   * 使用正则模式进行模糊匹配
   */
  private static recognizeInlineElements(text: string): any[] {
    const fragments: any[] = [];
    let lastIndex = 0;
    
    // 1. 尝试识别 TagNode
    const tagMatches = this.recognizeTagNodeByPattern(text);
    
    // 2. 尝试识别 DateMentionNode
    const dateMatches = this.recognizeDateMentionByPattern(text);
    
    // 合并所有匹配结果并排序
    const allMatches = [...tagMatches, ...dateMatches].sort((a, b) => a.index - b.index);
    
    // 构建最终的 fragments
    for (const match of allMatches) {
      // 添加匹配前的纯文本
      if (match.index > lastIndex) {
        fragments.push({ text: text.slice(lastIndex, match.index) });
      }
      
      // 添加识别的节点
      fragments.push(match.node);
      
      lastIndex = match.index + match.length;
    }
    
    // 添加剩余的文本
    if (lastIndex < text.length) {
      fragments.push({ text: text.slice(lastIndex) });
    }
    
    // 如果没有匹配任何元素，返回整个文本
    if (fragments.length === 0) {
      fragments.push({ text: text });
    }
    
    return fragments;
  }
  
  /**
   * 使用正则模式识别 TagNode
   * 返回匹配位置和节点信息
   */
  private static recognizeTagNodeByPattern(text: string): Array<{ index: number; length: number; node: any }> {
    const matches: Array<{ index: number; length: number; node: any }> = [];
    
    // Tag 模式: (emoji)? @tagName
    // 支持: "@工作", "💼 @工作", "📅 @会议"
    const tagPattern = /((?:[\p{Emoji}]\s*)?@[\w\u4e00-\u9fa5]+)/gu;
    
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const index = match.index;
      
      // 提取 emoji 和标签名
      const emojiMatch = fullMatch.match(/^([\p{Emoji}])\s*@(.+)$/u);
      const tagEmoji = emojiMatch ? emojiMatch[1] : undefined;
      const tagName = emojiMatch ? emojiMatch[2] : fullMatch.replace('@', '');
      
      // TODO: 这里应该查询 TagService，但为了避免循环依赖，暂时创建新标签
      // 实际使用时需要注入 TagService 或使用事件总线
      const tagId = `tag_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      matches.push({
        index,
        length: fullMatch.length,
        node: {
          type: 'tag',
          tagId: tagId,
          tagName: tagName,
          tagEmoji: tagEmoji,
          children: [{ text: '' }]
        }
      });
    }
    
    return matches;
  }
  
  /**
   * 使用正则模式识别 DateMentionNode
   * 返回匹配位置和节点信息
   */
  private static recognizeDateMentionByPattern(text: string): Array<{ index: number; length: number; node: any }> {
    const matches: Array<{ index: number; length: number; node: any }> = [];
    
    // DateMention 模式1: "11/29 10:00" or "11/29 10:00 - 12:00"
    const pattern1 = /(\d{1,2}\/\d{1,2}\s+\d{1,2}:\d{2}(?:\s*-\s*\d{1,2}:\d{2})?)/g;
    
    // DateMention 模式2: "2025-11-29 10:00" or "2025-11-29 10:00 - 12:00"
    const pattern2 = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}(?:\s*-\s*\d{2}:\d{2})?)/g;
    
    // DateMention 模式3: "今天下午3点" or "明天上午9点"
    const pattern3 = /(今天|明天|后天|下周[一二三四五六日])(?:\s*(上午|下午|晚上))?(?:\s*(\d{1,2})点)?/g;
    
    const patterns = [pattern1, pattern2, pattern3];
    
    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        const fullMatch = match[0];
        const index = match.index;
        
        // 尝试解析日期（这里简化处理，实际应该使用 TimeHub 的解析功能）
        try {
          // TODO: 集成 TimeHub 的日期解析
          // 暂时使用简化版本
          const startDate = this.parseSimpleDate(fullMatch);
          
          if (startDate) {
            matches.push({
              index,
              length: fullMatch.length,
              node: {
                type: 'dateMention',
                startDate: startDate,
                originalText: fullMatch,
                isOutdated: false,
                children: [{ text: '' }]
              }
            });
          }
        } catch (error) {
          console.warn('[EventService] 日期解析失败:', fullMatch, error);
        }
      }
    }
    
    return matches;
  }
  
  /**
   * 简化的日期解析（用于 recognizeDateMentionByPattern）
   * TODO: 应该使用 TimeHub 的完整解析功能
   */
  private static parseSimpleDate(dateText: string): string | null {
    const now = new Date();
    
    // 模式1: "11/29 10:00"
    const pattern1Match = dateText.match(/(\d{1,2})\/(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (pattern1Match) {
      const month = parseInt(pattern1Match[1], 10) - 1; // JS 月份从 0 开始
      const day = parseInt(pattern1Match[2], 10);
      const hour = parseInt(pattern1Match[3], 10);
      const minute = parseInt(pattern1Match[4], 10);
      
      const date = new Date(now.getFullYear(), month, day, hour, minute);
      return formatTimeForStorage(date);
    }
    
    // 模式2: "2025-11-29 10:00"
    const pattern2Match = dateText.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
    if (pattern2Match) {
      const year = parseInt(pattern2Match[1], 10);
      const month = parseInt(pattern2Match[2], 10) - 1;
      const day = parseInt(pattern2Match[3], 10);
      const hour = parseInt(pattern2Match[4], 10);
      const minute = parseInt(pattern2Match[5], 10);
      
      const date = new Date(year, month, day, hour, minute);
      return formatTimeForStorage(date);
    }
    
    // 模式3: "今天下午3点"（简化处理）
    if (dateText.includes('今天')) {
      const hourMatch = dateText.match(/(\d{1,2})点/);
      if (hourMatch) {
        let hour = parseInt(hourMatch[1], 10);
        if (dateText.includes('下午') && hour < 12) hour += 12;
        
        const date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, 0);
        return formatTimeForStorage(date);
      }
    }
    
    return null;
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

  // ========== 日历同步相关方法 ==========

  /**
   * 🆕 v2.0.6 统一多日历同步管理器
   * 
   * 核心功能：
   * 1. 管理 calendarIds、syncMode 和 externalIds 的联动
   * 2. 根据 syncMode 决定发送/接收逻辑
   * 3. 本地一个 event，远程多个日历可能有多个事件
   * 4. 远程多事件智能合并到本地单事件
   * 
   * SyncMode 逻辑：
   * - receive-only: 只接收远程更新，不发送到远程
   * - send-only / send-only-private: 只发送到远程，不接收远程更新
   * - bidirectional / bidirectional-private: 双向同步
   * 
   * @param event 要同步的事件
   * @param calendarIds 目标日历 IDs
   * @param syncMode 同步模式
   * @param syncType 同步类型：'plan' 或 'actual'
   * @returns 远程事件 ID 映射 Map<calendarId, remoteEventId>
   */
  static async syncToMultipleCalendars(
    event: Event,
    calendarIds: string[],
    syncMode: string,
    syncType: 'plan' | 'actual'
  ): Promise<Map<string, string>> {
    const remoteEventIds = new Map<string, string>();
    
    try {
      eventLogger.log(`📤 [syncToMultipleCalendars] 开始同步到多个日历`, {
        eventId: event.id,
        calendarIds,
        syncMode,
        syncType
      });
      
      // ========== 第一步：SyncMode 发送逻辑检查 ==========
      const canSendToRemote = this.canSendToRemote(syncMode);
      
      if (!canSendToRemote) {
        eventLogger.log(`⏭️ [syncToMultipleCalendars] SyncMode 不允许发送到远程: ${syncMode}`);
        // receive-only 模式，不发送到远程，但保留现有的 syncedCalendars
        return new Map();
      }
      
      // 获取 Microsoft Calendar Service
      const { MicrosoftCalendarService } = await import('./MicrosoftCalendarService');
      const microsoftService = MicrosoftCalendarService.getInstance();
      
      // ========== 第二步：获取现有同步状态 ==========
      const existingSyncedCalendars = syncType === 'plan' 
        ? (event.syncedPlanCalendars || [])
        : (event.syncedActualCalendars || []);
      
      eventLogger.log(`📋 [syncToMultipleCalendars] 现有同步状态`, {
        existingSyncedCount: existingSyncedCalendars.length,
        newCalendarCount: calendarIds.length
      });
      
      // ========== 第三步：删除旧的远程事件（日历分组变更） ==========
      const calendarsToDelete = existingSyncedCalendars.filter(
        cal => !calendarIds.includes(cal.calendarId)
      );
      
      for (const oldCalendar of calendarsToDelete) {
        try {
          await microsoftService.deleteEvent(oldCalendar.remoteEventId);
          eventLogger.log(`🗑️ [syncToMultipleCalendars] 删除旧远程事件`, {
            calendarId: oldCalendar.calendarId,
            remoteEventId: oldCalendar.remoteEventId
          });
        } catch (deleteError) {
          eventLogger.error(`❌ [syncToMultipleCalendars] 删除失败，继续处理`, deleteError);
        }
      }
      
      // ========== 第四步：同步到新的日历列表 ==========
      const { prepareRemoteEventData } = await import('../utils/calendarSyncUtils');
      
      for (const calendarId of calendarIds) {
        try {
          // 准备远程事件数据（处理 Private 模式）
          const remoteEventData = prepareRemoteEventData(event, syncMode);
          
          // 检查是否已经同步过这个日历
          const existingSync = existingSyncedCalendars.find(
            cal => cal.calendarId === calendarId
          );
          
          let remoteEventId: string | null = null;
          
          if (existingSync?.remoteEventId) {
            // 更新已有的远程事件
            try {
              await microsoftService.updateEvent(existingSync.remoteEventId, remoteEventData);
              remoteEventId = existingSync.remoteEventId;
              eventLogger.log(`♻️ [syncToMultipleCalendars] 更新远程事件`, {
                calendarId,
                remoteEventId
              });
            } catch (updateError) {
              // 更新失败，删除后重建
              eventLogger.warn(`⚠️ [syncToMultipleCalendars] 更新失败，删除重建`, updateError);
              try {
                await microsoftService.deleteEvent(existingSync.remoteEventId);
              } catch (delErr) {
                // 删除失败也继续，尝试创建新的
              }
              remoteEventId = await microsoftService.syncEventToCalendar(remoteEventData, calendarId);
              eventLogger.log(`🆕 [syncToMultipleCalendars] 重建远程事件`, {
                calendarId,
                remoteEventId
              });
            }
          } else {
            // 创建新的远程事件
            remoteEventId = await microsoftService.syncEventToCalendar(remoteEventData, calendarId);
            eventLogger.log(`🆕 [syncToMultipleCalendars] 创建远程事件`, {
              calendarId,
              remoteEventId
            });
          }
          
          if (remoteEventId) {
            remoteEventIds.set(calendarId, remoteEventId);
          }
        } catch (calendarError) {
          eventLogger.error(`❌ [syncToMultipleCalendars] 日历 ${calendarId} 同步失败`, calendarError);
          // 继续处理其他日历
        }
      }
      
      // ========== 第五步：更新本地事件的同步记录（合并管理） ==========
      const syncedCalendars = Array.from(remoteEventIds.entries()).map(
        ([calendarId, remoteEventId]) => ({
          calendarId,
          remoteEventId
        })
      );
      
      const updates: Partial<Event> = {};
      if (syncType === 'plan') {
        updates.syncedPlanCalendars = syncedCalendars;
      } else {
        updates.syncedActualCalendars = syncedCalendars;
      }
      
      await this.updateEvent(event.id, updates);
      
      eventLogger.log(`✅ [syncToMultipleCalendars] 成功同步到 ${remoteEventIds.size} 个日历`, {
        eventId: event.id,
        syncedCalendars: remoteEventIds.size,
        syncType,
        syncMode
      });
      
      return remoteEventIds;
    } catch (error) {
      eventLogger.error(`❌ [syncToMultipleCalendars] 同步失败`, error);
      const { handleSyncError } = await import('../utils/calendarSyncUtils');
      handleSyncError('syncToMultipleCalendars', event, error);
      throw error;
    }
  }
  
  /**
   * 🆕 v2.0.6 检查 syncMode 是否允许发送到远程
   * 
   * @param syncMode 同步模式
   * @returns true 允许发送，false 不允许
   */
  private static canSendToRemote(syncMode: string): boolean {
    // receive-only: 只接收，不发送
    if (syncMode === 'receive-only') {
      return false;
    }
    
    // send-only, send-only-private, bidirectional, bidirectional-private: 允许发送
    return ['send-only', 'send-only-private', 'bidirectional', 'bidirectional-private'].includes(syncMode);
  }
  
  /**
   * 🆕 v2.0.6 检查 syncMode 是否允许接收远程更新
   * 
   * @param syncMode 同步模式
   * @returns true 允许接收，false 不允许
   */
  static canReceiveFromRemote(syncMode: string): boolean {
    // send-only, send-only-private: 只发送，不接收
    if (syncMode === 'send-only' || syncMode === 'send-only-private') {
      return false;
    }
    
    // receive-only, bidirectional, bidirectional-private: 允许接收
    return ['receive-only', 'bidirectional', 'bidirectional-private'].includes(syncMode);
  }
  
  /**
   * 🆕 v2.0.6 从远程事件合并到本地事件（多日历智能合并）
   * 
   * 核心逻辑：
   * 1. 检查远程事件的 externalId 是否在 syncedPlanCalendars/syncedActualCalendars 中
   * 2. 如果存在，说明是同一个本地事件的多个远程副本，合并而不是创建新事件
   * 3. 如果不存在，可能是新的远程事件，需要创建
   * 
   * @param remoteEvent 远程事件
   * @param localEvents 本地事件列表
   * @param syncType 同步类型
   * @returns 匹配的本地事件或 null
   */
  static findLocalEventByRemoteId(
    remoteEventId: string,
    localEvents: Event[],
    syncType: 'plan' | 'actual'
  ): Event | null {
    // 清理 outlook- 前缀
    const cleanRemoteId = remoteEventId.startsWith('outlook-') 
      ? remoteEventId.replace('outlook-', '') 
      : remoteEventId;
    
    // 在本地事件中查找匹配的 syncedCalendars
    const matchedEvent = localEvents.find((event: Event) => {
      const syncedCalendars = syncType === 'plan' 
        ? event.syncedPlanCalendars 
        : event.syncedActualCalendars;
      
      return syncedCalendars?.some(cal => 
        cal.remoteEventId === cleanRemoteId ||
        cal.remoteEventId === `outlook-${cleanRemoteId}` ||
        `outlook-${cal.remoteEventId}` === cleanRemoteId
      );
    });
    
    return matchedEvent || null;
  }

  /**
   * 同步事件到远程日历（支持 Private 模式）
   * 
   * @param event 要同步的事件
   * @param syncMode 同步模式
   * @param calendarId 目标日历 ID  
   * @param syncType 同步类型：'plan' 或 'actual'
   * @deprecated 使用 syncToMultipleCalendars 替代，支持多日历同步
   */
  static async syncToRemoteCalendar(
    event: Event, 
    syncMode: string, 
    calendarId: string,
    syncType: 'plan' | 'actual'
  ): Promise<string | null> {
    // 调用新的多日历同步方法
    const result = await this.syncToMultipleCalendars(event, [calendarId], syncMode, syncType);
    return result.get(calendarId) || null;
  }

  /**
   * 更新事件的同步配置
   */
  static async updateSyncConfig(
    eventId: string, 
    planConfig?: import('../types').PlanSyncConfig, 
    actualConfig?: import('../types').ActualSyncConfig
  ): Promise<void> {
    const updates: Partial<Event> = {};
    
    if (planConfig !== undefined) {
      updates.planSyncConfig = planConfig;
    }
    
    if (actualConfig !== undefined) {
      updates.actualSyncConfig = actualConfig;
    }
    
    await this.updateEvent(eventId, updates);
    
    eventLogger.log('🔧 [updateSyncConfig] Updated sync configuration', {
      eventId,
      planConfig,
      actualConfig
    });
  }

  /**
   * 检查事件是否需要同步
   */
  static shouldSyncEvent(event: Event, syncType: 'plan' | 'actual'): boolean {
    const { shouldSyncEvent } = require('../utils/calendarSyncUtils');
    return shouldSyncEvent(event, syncType);
  }

  /**
   * 获取事件的同步状态摘要
   */
  static getSyncStatusSummary(event: Event): {
    planStatus: 'not-configured' | 'synced' | 'pending' | 'error';
    actualStatus: 'not-configured' | 'synced' | 'pending' | 'error';
    remoteEventCount: number;
  } {
    const { calculateRemoteEventCount, getEffectivePlanSyncConfig, getEffectiveActualSyncConfig } = require('../utils/calendarSyncUtils');
    
    const planConfig = getEffectivePlanSyncConfig(event);
    const actualConfig = getEffectiveActualSyncConfig(event);
    
    // 计算 Plan 状态
    let planStatus: 'not-configured' | 'synced' | 'pending' | 'error' = 'not-configured';
    if (planConfig) {
      if (event.syncedPlanEventId) {
        planStatus = 'synced';
      } else {
        planStatus = 'pending';
      }
    }
    
    // 计算 Actual 状态
    let actualStatus: 'not-configured' | 'synced' | 'pending' | 'error' = 'not-configured';
    if (actualConfig) {
      if (event.syncedActualEventId) {
        actualStatus = 'synced';
      } else {
        actualStatus = 'pending';
      }
    }
    
    return {
      planStatus,
      actualStatus,
      remoteEventCount: calculateRemoteEventCount(event)
    };
  }

  /**
   * 从远程同步创建事件（内部方法，供 ActionBasedSyncManager 使用）
   * - 规范化事件数据
   * - 直接保存到 localStorage（不触发 sync）
   * - 记录到 EventHistoryService
   * 
   * @param event - 事件对象（已经过 convertRemoteEventToLocal 处理）
   * @returns 创建的事件对象
   */
  static createEventFromRemoteSync(event: Event): Event {
    try {
      eventLogger.log('🌐 [EventService] Creating event from remote sync:', event.id);

      // 🔥 规范化事件数据（统一处理 title/eventlog/description）
      const normalizedEvent = this.normalizeEvent(event);
      
      // 确保必要字段
      const finalEvent: Event = {
        ...normalizedEvent,
        // 保留 remote sync 的标识字段
        remarkableSource: event.remarkableSource,
        externalId: event.externalId,
        syncStatus: event.syncStatus || 'synced',
        syncedPlanCalendars: event.syncedPlanCalendars,
        syncedActualCalendars: event.syncedActualCalendars,
      };

      // 读取现有事件
      const existingEvents = this.getAllEvents();

      // 检查是否已存在（理论上不应该存在，但做防御性检查）
      const existingIndex = existingEvents.findIndex(e => e.id === event.id);
      if (existingIndex !== -1) {
        eventLogger.warn('⚠️ [EventService] Remote event already exists, replacing:', event.id);
        existingEvents[existingIndex] = finalEvent;
      } else {
        // 添加新事件
        existingEvents.push(finalEvent);
      }

      // 保存到 localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      
      // 🆕 记录到事件历史（使用 outlook-sync 作为来源）
      EventHistoryService.logCreate(finalEvent, 'outlook-sync');
      
      eventLogger.log('✅ [EventService] Remote event created:', {
        eventId: finalEvent.id,
        title: finalEvent.title,
        hasEventlog: typeof finalEvent.eventlog === 'object' && !!finalEvent.eventlog?.slateJson,
        总事件数: existingEvents.length
      });

      // 触发全局更新事件
      this.dispatchEventUpdate(finalEvent.id, { 
        isNewEvent: true, 
        tags: finalEvent.tags, 
        event: finalEvent,
        source: 'external-sync',
        isLocalUpdate: false
      });

      return finalEvent;
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to create event from remote sync:', error);
      throw error; // 抛出错误让调用方处理
    }
  }
}

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
  (window as any).EventService = EventService;
}
