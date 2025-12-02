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
import { storageManager } from './storage/StorageManager';
import type { StorageEvent } from './storage/types';
import { logger } from '../utils/logger';
import { validateEventTime } from '../utils/eventValidation';
import { determineSyncTarget, shouldSync } from '../utils/syncRouter';
import { ContactService } from './ContactService';
import { EventHistoryService } from './EventHistoryService'; // 🆕 事件历史记录
import { jsonToSlateNodes, slateNodesToHtml } from '../components/ModalSlate/serialization'; // 🆕 Slate 转换
import { generateEventId, isValidId } from '../utils/idGenerator'; // 🆕 UUID ID 生成

const eventLogger = logger.module('EventService');

// 同步管理器实例（将在初始化时设置）
let syncManagerInstance: any = null;

// 🔍 模块加载时的调试
// EventService 模块初始化

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
      broadcastChannel = new BroadcastChannel('4dnote-events');
      
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
    ContactService.addEventListener('contact.updated', async (event) => {
      const { id, after } = event.data;
      eventLogger.log('📇 [EventService] Contact updated, syncing to related events:', id);
      
      const events = await this.getAllEvents();
      const relatedEvents = events.filter((e: Event) => 
        e.attendees?.some(a => a.id === id) || e.organizer?.id === id
      );
      
      if (relatedEvents.length === 0) {
        eventLogger.log('ℹ️ [EventService] No events reference this contact');
        return;
      }
      
      relatedEvents.forEach((event: Event) => {
        const updates: Partial<Event> = {};
        
        // 更新参会人
        if (event.attendees?.some((a: any) => a.id === id)) {
          updates.attendees = event.attendees.map((a: any) => 
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
    ContactService.addEventListener('contact.deleted', async (event) => {
      const { id } = event.data;
      eventLogger.log('🗑️ [EventService] Contact deleted, removing from events:', id);
      
      const events = await this.getAllEvents();
      const relatedEvents = events.filter((e: Event) =>
        e.attendees?.some((a: any) => a.id === id) || e.organizer?.id === id
      );
      
      if (relatedEvents.length === 0) {
        eventLogger.log('ℹ️ [EventService] No events reference this contact');
        return;
      }
      
      relatedEvents.forEach((event: Event) => {
        const updates: Partial<Event> = {};
        
        // 从参会人中移除
        if (event.attendees?.some((a: any) => a.id === id)) {
          updates.attendees = event.attendees.filter((a: any) => a.id !== id);
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
   * 🔥 v3.0.0: 迁移到 StorageManager（异步查询）
   */
  static async getAllEvents(): Promise<Event[]> {
    try {
      const result = await storageManager.queryEvents({ limit: 10000 });
      
      // ✅ v3.0: 过滤已软删除的事件
      const activeEvents = result.items.filter(event => !event.deletedAt);
      
      // 🔧 自动规范化所有事件的 title 字段（处理旧数据中的 undefined）
      return activeEvents.map(event => this.convertStorageEventToEvent(event));
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to load events:', error);
      return [];
    }
  }

  /**
   * 根据ID获取事件
   * 🔧 性能优化：只规范化目标事件的 title 和 eventlog，避免全量处理
   * 🔥 v3.0.0: 迁移到 StorageManager（异步查询，自动修复逻辑由 normalizeEvent 处理）
   */
  static async getEventById(eventId: string): Promise<Event | null> {
    try {
      const result = await storageManager.queryEvents({
        filters: { eventIds: [eventId] },
        limit: 1
      });
      
      if (result.items.length === 0) return null;
      
      const storageEvent = result.items[0];
      
      // 检查 eventlog 是否为空或空数组
      const needsEventLogFix = !storageEvent.eventlog || 
                               (typeof storageEvent.eventlog === 'object' && storageEvent.eventlog.slateJson === '[]');
      
      // 规范化 title 和 eventlog（传递 description 作为 fallback）
      const normalizedEvent = {
        ...storageEvent,
        title: this.normalizeTitle(storageEvent.title),
        eventlog: this.normalizeEventLog(storageEvent.eventlog, storageEvent.description)
      };
      
      // 🔧 如果 eventlog 被修复了（从空变成有内容），尝试更新回 StorageManager
      if (needsEventLogFix && normalizedEvent.eventlog.slateJson !== '[]') {
        eventLogger.log('🔧 [EventService] 自动修复空 eventlog，尝试更新到 StorageManager:', eventId);
        try {
          await storageManager.updateEvent(eventId, {
            eventlog: normalizedEvent.eventlog as any
          });
          eventLogger.log('✅ [EventService] eventlog 修复已保存');
        } catch (saveError: any) {
          eventLogger.warn('⚠️ [EventService] eventlog fix not persisted:', saveError);
        }
      }
      
      return normalizedEvent as Event;
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
   * 🔥 v3.0.0: 使用 StorageManager 智能查询（SQLite 索引加速）
   */
  static async getEventsByRange(startDate: string | Date, endDate: string | Date): Promise<Event[]> {
    try {
      const t0 = performance.now();
      
      // 转换为时间戳（方便比较）
      const rangeStart = formatTimeForStorage(new Date(startDate));
      const rangeEnd = formatTimeForStorage(new Date(endDate));
      
      // 使用 StorageManager 智能查询（在 SQLite 中会自动使用索引）
      const result = await storageManager.queryEvents({
        filters: {
          // 注：这里的过滤逻辑需要在 StorageManager 中支持
          // 暂时先查询所有，然后前端过滤
        },
        limit: 10000
      });
      
      // 前端过滤时间范围（后续可以将此逻辑下放到 SQLite 查询）
      const rangeStartMs = new Date(startDate).getTime();
      const rangeEndMs = new Date(endDate).getTime();
      
      const filteredEvents = result.items.filter(event => {
        // Task 类型（无时间）总是显示
        if (event.isTask && (!event.startTime || !event.endTime)) {
          return true;
        }
        
        const effectiveStartTime = event.startTime || event.createdAt;
        const effectiveEndTime = event.endTime || event.createdAt;
        
        if (!effectiveStartTime || !effectiveEndTime) {
          return false;
        }
        
        // AllDay 事件
        if (event.isAllDay) {
          const eventDate = new Date(effectiveStartTime).setHours(0, 0, 0, 0);
          return eventDate >= rangeStartMs && eventDate <= rangeEndMs;
        }
        
        // 普通事件
        const eventStart = new Date(effectiveStartTime).getTime();
        const eventEnd = new Date(effectiveEndTime).getTime();
        return (eventStart <= rangeEndMs && eventEnd >= rangeStartMs);
      });
      
      const t1 = performance.now();
      eventLogger.log(`🔍 [EventService] getEventsByRange: ${filteredEvents.length}/${result.items.length} events in ${(t1 - t0).toFixed(2)}ms`, {
        range: `${startDate} ~ ${endDate}`,
        reduction: `${((1 - filteredEvents.length / result.items.length) * 100).toFixed(1)}%`
      });
      
      return filteredEvents.map(e => this.convertStorageEventToEvent(e));
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
      eventLogger.log('🆕 [EventService] Creating new event:', event.id);

      // ✅ v1.8: 验证时间字段（区分 Task 和 Calendar 事件）
      const validation = validateEventTime(event);
      if (!validation.valid) {
        eventLogger.error('❌ [EventService] Event validation failed:', validation.error);
        return { success: false, error: validation.error };
      }
      
      if (validation.warnings && validation.warnings.length > 0) {
        eventLogger.warn('⚠️ [EventService] Event warnings:', validation.warnings);
      }

      // ✅ v3.0: 自动生成 UUID ID（如果未提供或格式无效）
      if (!event.id || !isValidId(event.id, 'event')) {
        const oldId = event.id;
        event.id = generateEventId();
        
        if (oldId) {
          eventLogger.warn('⚠️ [EventService] Invalid ID format, generated new UUID:', {
            oldId,
            newId: event.id
          });
        } else {
          eventLogger.log('🆕 [EventService] Generated UUID for new event:', event.id);
        }
      }
      
      // 标题可以为空（会在上层如 EventEditModal 或 TimeCalendar 中自动填充）
      // 如果既无标题又无标签，应该在 UI 层禁用保存按钮
      if (!event.title && (!event.tags || event.tags.length === 0)) {
        eventLogger.warn('⚠️ [EventService] Event has no title and no tags:', event.id);
      }

      // 🔥 v2.15.3: 中枢化架构 - 使用 normalizeEvent 统一处理所有字段
      const normalizedEvent = this.normalizeEvent(event);
      
      // 确保必要字段
      // 🔧 [BUG FIX] skipSync=true时，强制设置syncStatus='local-only'，忽略event.syncStatus
      const finalEvent: Event = {
        ...normalizedEvent,
        fourDNoteSource: true,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending'),
      };

      // 检查是否已存在（从 StorageManager 查询）
      const existing = await storageManager.queryEvents({
        filters: { eventIds: [event.id] },
        limit: 1
      });
      
      if (existing.items.length > 0) {
        eventLogger.warn('⚠️ [EventService] Event already exists, will update instead:', event.id);
        return this.updateEvent(event.id, finalEvent, skipSync, options);
      }

      // 创建事件（双写到 IndexedDB + SQLite）
      const storageEvent = this.convertEventToStorageEvent(finalEvent);
      await storageManager.createEvent(storageEvent);
      eventLogger.log('💾 [EventService] Event saved to StorageManager');
      
      // 🆕 自动维护父子事件双向关联
      if (finalEvent.parentEventId) {
        const parentEvent = await this.getEventById(finalEvent.parentEventId);
        
        if (parentEvent) {
          // 初始化 childEventIds 数组
          const childIds = parentEvent.childEventIds || [];
          
          // 添加子事件 ID（避免重复）
          if (!childIds.includes(finalEvent.id)) {
            await this.updateEvent(parentEvent.id, {
              childEventIds: [...childIds, finalEvent.id]
            }, true); // skipSync=true 避免递归同步
            
            eventLogger.log('🔗 [EventService] 已关联子事件到父事件:', {
              parentId: parentEvent.id,
              parentTitle: parentEvent.title?.simpleTitle,
              childId: finalEvent.id,
              childTitle: finalEvent.title?.simpleTitle,
              childType: this.getEventType(finalEvent),
              totalChildren: childIds.length + 1
            });
          }
        } else {
          eventLogger.warn('⚠️ [EventService] 父事件不存在:', {
            parentId: finalEvent.parentEventId,
            childId: finalEvent.id
          });
        }
      }
      
      // 🆕 记录到事件历史
      EventHistoryService.logCreate(finalEvent, options?.source || 'user-edit');
      
      // ✨ 自动提取并保存联系人
      if (finalEvent.organizer || finalEvent.attendees) {
        ContactService.extractAndAddFromEvent(finalEvent.organizer, finalEvent.attendees);
        eventLogger.log('👥 [EventService] Auto-extracted contacts from event');
      }
      
      // 获取统计信息用于日志
      const stats = await storageManager.getStats();
      const totalEvents = (stats.indexedDB?.eventsCount || 0);
      
      eventLogger.log('✅ [EventService] 创建成功:', {
        eventId: finalEvent.id,
        title: finalEvent.title,
        startTime: finalEvent.startTime,
        endTime: finalEvent.endTime,
        总事件数: totalEvents
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
      // 获取原始事件（从 StorageManager 查询）
      const originalEvent = await this.getEventById(eventId);

      if (!originalEvent) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }
      
      // 🆕 v2.8: 双向同步 simpleTitle ↔ fullTitle
      // 🆕 v1.8.1: 双向同步 description ↔ eventlog
      // 支持新旧格式兼容：
      // - 旧格式：eventlog 是字符串（HTML）
      // - 新格式：eventlog 是 EventLog 对象（Slate JSON + metadata）
      
      const updatesWithSync = { ...updates };
      
      // ========== Title 三层架构同步 (v2.14) ==========
      // 🆕 v2.15.4: 自动同步 tags 到 fullTitle
      if ((updates as any).title !== undefined || (updates as any).tags !== undefined) {
        const titleUpdate = (updates as any).title !== undefined 
          ? (updates as any).title 
          : originalEvent.title;
        const currentTags = (updates as any).tags !== undefined 
          ? (updates as any).tags 
          : originalEvent.tags;
        
        // 🔥 使用增强版 normalizeTitle（支持字符串输入 + tags 同步）
        const normalizedTitle = this.normalizeTitle(
          titleUpdate,
          currentTags,
          originalEvent.tags
        );
        
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
            

          } else {
            // 🔧 非字符串格式，直接保存
            (updatesWithSync as any).eventlog = newEventlog;

          }
        }
      }
      
      // 场景3: 初始化场景 - eventlog 为空但 description 有内容
      if (!(originalEvent as any).eventlog && originalEvent.description && (updates as any).eventlog === undefined) {
        const initialEventLog: EventLog = {
          slateJson: JSON.stringify([{ type: 'paragraph', children: [{ text: originalEvent.description }] }]),
          html: originalEvent.description,
          plainText: this.stripHtml(originalEvent.description),
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
      
      // ✅ v1.8: 验证合并后的事件（在过滤前，但要过滤掉 undefined 的时间字段）
      const mergedEvent = { ...originalEvent, ...updatesWithSync };
      // 🔧 过滤掉 undefined 的时间字段，避免验证失败
      const eventToValidate = {
        ...mergedEvent,
        startTime: mergedEvent.startTime === undefined ? originalEvent.startTime : mergedEvent.startTime,
        endTime: mergedEvent.endTime === undefined ? originalEvent.endTime : mergedEvent.endTime,
      };
      const validation = validateEventTime(eventToValidate);
      if (!validation.valid) {
        eventLogger.error('❌ [EventService] Update validation failed:', validation.error);
        return { success: false, error: validation.error };
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

        }
      });
      
      // 合并更新
      const updatedEvent: Event = {
        ...originalEvent,
        ...filteredUpdates,  // 🆕 使用过滤后的 updates
        id: eventId, // 确保ID不被覆盖
        updatedAt: formatTimeForStorage(new Date())
      };

      // 🆕 检测 parentEventId 变化，同步更新双向关联
      if (filteredUpdates.parentEventId !== undefined && 
          filteredUpdates.parentEventId !== originalEvent.parentEventId) {
        
        // 从旧父事件移除
        if (originalEvent.parentEventId) {
          const oldParent = await this.getEventById(originalEvent.parentEventId);
          if (oldParent && oldParent.childEventIds) {
            await this.updateEvent(
              oldParent.id,
              {
                childEventIds: oldParent.childEventIds.filter(cid => cid !== eventId)
              },
              true // skipSync
            );
            
            eventLogger.log('🔗 [EventService] 已从旧父事件移除子事件:', {
              oldParentId: originalEvent.parentEventId,
              childId: eventId,
              remainingChildren: oldParent.childEventIds.length - 1
            });
          }
        }
        
        // 添加到新父事件
        if (filteredUpdates.parentEventId) {
          const newParent = await this.getEventById(filteredUpdates.parentEventId);
          if (newParent) {
            const childIds = newParent.childEventIds || [];
            
            if (!childIds.includes(eventId)) {
              await this.updateEvent(
                newParent.id,
                {
                  childEventIds: [...childIds, eventId]
                },
                true // skipSync
              );
              
              eventLogger.log('🔗 [EventService] 已添加子事件到新父事件:', {
                newParentId: filteredUpdates.parentEventId,
                childId: eventId,
                totalChildren: childIds.length + 1
              });
            }
          } else {
            eventLogger.warn('⚠️ [EventService] 新父事件不存在:', filteredUpdates.parentEventId);
          }
        }
      }

      // 更新到 StorageManager（双写到 IndexedDB + SQLite）
      const storageEvent = this.convertEventToStorageEvent(updatedEvent);
      await storageManager.updateEvent(eventId, storageEvent);
      eventLogger.log('💾 [EventService] Event updated in StorageManager');
      
      // 🆕 保存 EventLog 版本历史（如果 eventlog 有变更）
      if (filteredUpdates.eventlog && originalEvent.eventlog) {
        const oldEventLog = this.normalizeEventLog(originalEvent.eventlog);
        const newEventLog = this.normalizeEventLog(filteredUpdates.eventlog);
        
        // 异步保存版本（不阻塞主流程）
        storageManager.saveEventLogVersion(
          eventId,
          newEventLog,
          oldEventLog
        ).catch((error: any) => {
          eventLogger.warn('⚠️ [EventService] Failed to save EventLog version:', error);
        });
        
        eventLogger.log('📚 [EventService] EventLog version saved');
      }
      
      // 🐛 Bulletpoint 调试：检查保存的 eventlog
      if (updatedEvent.eventlog) {
        const eventlogStr = typeof updatedEvent.eventlog === 'object' 
          ? updatedEvent.eventlog.html || updatedEvent.eventlog.plainText || JSON.stringify(updatedEvent.eventlog)
          : String(updatedEvent.eventlog);
        console.log('[EventService Bullet Debug] 保存的 eventlog:', {
          eventId: updatedEvent.id?.slice(-8),
          eventlogType: typeof updatedEvent.eventlog,
          hasBulletAttr: eventlogStr.includes('data-bullet="true"'),
          preview: eventlogStr.substring(0, 200)
        });
      }
      
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
      eventLogger.log('🗑️ [EventService] Soft-deleting event (setting deletedAt):', eventId);

      // 获取待删除事件（从 StorageManager 查询）
      const deletedEvent = await this.getEventById(eventId);

      if (!deletedEvent) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }
      
      // ✅ v3.0: 软删除 - 设置 deletedAt 而非硬删除
      // 优点：
      // 1. 支持撤销删除
      // 2. 多设备同步时不会丢失数据
      // 3. 可定期清理旧数据（30天后）
      const now = formatTimeForStorage(new Date());
      await this.updateEvent(eventId, {
        deletedAt: now,
        updatedAt: now,
      }, skipSync);
      
      eventLogger.log('✅ [EventService] Event soft-deleted:', {
        eventId,
        deletedAt: now,
        canRestore: true,
      });

      // 记录事件历史（软删除仍记录为删除操作）
      EventHistoryService.logDelete(deletedEvent, 'user-edit');

      // 触发全局更新事件（标记为已删除）
      this.dispatchEventUpdate(eventId, { deleted: true, softDeleted: true });

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
      eventLogger.error('❌ [EventService] Failed to delete event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 恢复软删除的事件
   * 
   * @param eventId 事件 ID
   * @returns 操作结果
   */
  static async restoreEvent(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      eventLogger.log('♻️ [EventService] Restoring soft-deleted event:', eventId);

      // 获取事件（包括已删除的）
      const result = await storageManager.queryEvents({
        filters: { eventIds: [eventId] },
        limit: 1
      });

      if (result.items.length === 0) {
        return { success: false, error: `Event not found: ${eventId}` };
      }

      const event = result.items[0];

      if (!event.deletedAt) {
        return { success: false, error: 'Event is not deleted' };
      }

      // 恢复事件（清除 deletedAt）
      await this.updateEvent(eventId, {
        deletedAt: null,
        updatedAt: formatTimeForStorage(new Date()),
      }, false); // 需要同步

      eventLogger.log('✅ [EventService] Event restored:', eventId);
      
      // 触发全局更新事件
      this.dispatchEventUpdate(eventId, { restored: true });

      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to restore event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 硬删除事件（真正从数据库删除）
   * ⚠️ 危险操作：无法恢复！
   * 
   * @param eventId 事件 ID
   * @param force 是否强制删除（即使未标记为删除）
   * @returns 操作结果
   */
  static async hardDeleteEvent(eventId: string, force: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      eventLogger.warn('⚠️ [EventService] Hard-deleting event (permanent):', eventId);

      const event = await this.getEventById(eventId);

      if (!event) {
        return { success: false, error: `Event not found: ${eventId}` };
      }

      // 安全检查：只允许删除已标记为 deletedAt 的事件
      if (!force && !event.deletedAt) {
        return { 
          success: false, 
          error: 'Event must be soft-deleted first. Use force=true to override.' 
        };
      }

      // 真正删除
      await storageManager.deleteEvent(eventId);
      
      eventLogger.warn('🗑️ [EventService] Event permanently deleted:', eventId);
      
      // 触发全局更新事件
      this.dispatchEventUpdate(eventId, { deleted: true, hardDeleted: true });

      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to hard-delete event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 清理旧的已删除事件（定期维护）
   * 
   * @param daysOld 删除多少天前的已删除事件（默认 30 天）
   * @returns 清理统计
   */
  static async purgeOldDeletedEvents(daysOld: number = 30): Promise<{ 
    purgedCount: number; 
    errors: string[] 
  }> {
    try {
      eventLogger.log(`🧹 [EventService] Purging events deleted ${daysOld} days ago...`);

      // 获取所有事件（包括已删除的）
      const allResult = await storageManager.queryEvents({ limit: 10000 });
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      const cutoffMs = cutoffDate.getTime();

      // 过滤出需要清理的事件
      const toPurge = allResult.items.filter(event => {
        if (!event.deletedAt) return false;
        const deletedMs = new Date(event.deletedAt).getTime();
        return deletedMs < cutoffMs;
      });

      eventLogger.log(`🗑️ [EventService] Found ${toPurge.length} events to purge`);

      let purgedCount = 0;
      const errors: string[] = [];

      // 逐个硬删除
      for (const event of toPurge) {
        try {
          await storageManager.deleteEvent(event.id);
          purgedCount++;
        } catch (error) {
          errors.push(`${event.id}: ${String(error)}`);
        }
      }

      eventLogger.log(`✅ [EventService] Purge completed:`, {
        purgedCount,
        errorCount: errors.length,
      });

      return { purgedCount, errors };
    } catch (error) {
      eventLogger.error('❌ [EventService] Failed to purge old events:', error);
      return { purgedCount: 0, errors: [String(error)] };
    }
  }

  /**
   * 事件签到 - 记录签到时间戳
   */
  static async checkIn(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      eventLogger.log('✅ [EventService] Checking in event:', eventId);

      // 获取事件（从 StorageManager 查询）
      const event = await this.getEventById(eventId);

      if (!event) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }

      const timestamp = formatTimeForStorage(new Date());

      // 🐛 DEBUG: Log checkType before update
      console.log('🔍 [EventService.checkIn] BEFORE update:', {
        eventId: eventId.slice(-10),
        checkType: event.checkType,
        checkedCount: (event.checked || []).length,
        title: event.title?.simpleTitle?.substring(0, 20)
      });

      // 更新 checked 数组
      const checked = event.checked || [];
      checked.push(timestamp);

      // 更新到 StorageManager
      await this.updateEvent(eventId, {
        checked: checked,
        updatedAt: timestamp
      }, true); // skipSync=true
      
      eventLogger.log('💾 [EventService] Event checked in, saved to StorageManager');

      // 🐛 DEBUG: Log checkType after save
      console.log('🔍 [EventService.checkIn] AFTER save:', {
        eventId: eventId.slice(-10),
        checkType: event.checkType,
        checkedCount: checked.length,
        willDispatchUpdate: true
      });

      // 记录事件历史
      EventHistoryService.logCheckin(eventId, event.title?.simpleTitle || 'Untitled Event', { action: 'check-in', timestamp });

      // 触发更新事件
      this.dispatchEventUpdate(eventId, { checkedIn: true, timestamp });

      eventLogger.log('✅ [EventService] 签到成功:', {
        eventId,
        timestamp,
        totalCheckins: checked.length
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
  static async uncheck(eventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      eventLogger.log('❌ [EventService] Unchecking event:', eventId);

      // 获取事件（从 StorageManager 查询）
      const event = await this.getEventById(eventId);

      if (!event) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('❌ [EventService]', error);
        return { success: false, error };
      }

      const timestamp = formatTimeForStorage(new Date());

      // 更新 unchecked 数组
      const unchecked = event.unchecked || [];
      unchecked.push(timestamp);

      // 更新到 StorageManager
      await this.updateEvent(eventId, {
        unchecked: unchecked,
        updatedAt: timestamp
      }, true); // skipSync=true
      
      eventLogger.log('💾 [EventService] Event unchecked, saved to StorageManager');

      // 记录事件历史
      EventHistoryService.logCheckin(eventId, event.title?.simpleTitle || 'Untitled Event', { action: 'uncheck', timestamp });

      // 触发更新事件
      this.dispatchEventUpdate(eventId, { unchecked: true, timestamp });

      eventLogger.log('❌ [EventService] 取消签到成功:', {
        eventId,
        timestamp,
        totalUnchecks: unchecked.length
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
  static async getCheckInStatus(eventId: string): Promise<{ 
    isChecked: boolean; 
    lastCheckIn?: string; 
    lastUncheck?: string;
    checkInCount: number;
    uncheckCount: number;
    checkType: import('../types').CheckType;
    recurringConfig?: import('../types').RecurringConfig;
  }> {
    const event = await this.getEventById(eventId);
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
    const isChecked = !!lastCheckIn && (!lastUncheck || lastCheckIn > lastUncheck);

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
   * 批量创建事件（用于导入或迁移场景）
   * 🔥 v3.0.0: 使用 StorageManager 批量创建（高性能）
   */
  static async batchCreateEvents(events: Event[], skipSync: boolean = false): Promise<{ 
    success: boolean; 
    created: number; 
    failed: number;
    errors: string[];
  }> {
    try {
      // 规范化所有事件
      const normalizedEvents = events.map(event => this.normalizeEvent({
        ...event,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending')
      }));
      
      // 转换为 StorageEvent 并批量创建
      const storageEvents = normalizedEvents.map(e => this.convertEventToStorageEvent(e));
      const batchResult = await storageManager.batchCreateEvents(storageEvents);
      
      // 记录历史
      batchResult.success.forEach(event => {
        EventHistoryService.logCreate(event as any as Event, 'batch-import');
      });
      
      const errors = batchResult.failed.map(f => `${f.item.id}: ${f.error.message}`);
      
      eventLogger.log(`📊 [EventService] Batch create: ${batchResult.success.length} created, ${batchResult.failed.length} failed`);
      return { 
        success: batchResult.failed.length === 0, 
        created: batchResult.success.length, 
        failed: batchResult.failed.length, 
        errors 
      };
    } catch (error) {
      eventLogger.error('❌ [EventService] Batch create failed:', error);
      return { success: false, created: 0, failed: events.length, errors: [String(error)] };
    }
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
   * 规范化标题对象：自动填充缺失的层级 + 同步 tags
   * @param titleInput - 部分标题数据（可能只有 fullTitle/colorTitle/simpleTitle 之一），或者字符串（远程同步场景）
   * @param tags - 事件的 tags 数组（用于自动注入 tag 元素到 fullTitle）
   * @param originalTags - 原始的 tags 数组（用于检测 tag 增删）
   * @returns 完整的 EventTitle 对象（包含三层，fullTitle 已同步 tag 元素）
   * 
   * 🔥 中枢化架构：统一处理所有 title 输入格式 + tags 同步
   * 
   * 规则：
   * 0. 如果是字符串（Outlook/Timer/旧数据） → 转换为 simpleTitle，然后升级为三层
   * 1. 有 fullTitle → 降级生成 colorTitle 和 simpleTitle
   * 2. 有 colorTitle → 升级生成 fullTitle，降级生成 simpleTitle
   * 3. 有 simpleTitle → 升级生成 colorTitle 和 fullTitle
   * 4. 多个字段都有 → 保持原样，不覆盖
   * 5. 同步 tags：自动将 tags 注入/更新/删除到 fullTitle 的 tag 元素
   */
  private static normalizeTitle(
    titleInput: Partial<import('../types').EventTitle> | string | undefined,
    tags?: string[],
    originalTags?: string[]
  ): import('../types').EventTitle {
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
    
    // 🆕 场景 5: 同步 tags 到 fullTitle（自动注入/更新/删除 tag 元素）
    if (tags !== undefined && result.fullTitle) {
      result.fullTitle = this.syncTagsToFullTitle(result.fullTitle, tags, originalTags);
      // 同步后需要重新生成 colorTitle 和 simpleTitle
      result.colorTitle = this.fullTitleToColorTitle(result.fullTitle);
      result.simpleTitle = this.colorTitleToSimpleTitle(result.colorTitle);
    }
    
    return result;
  }

  /**
   * 同步 tags 到 fullTitle：自动添加/删除 tag 元素
   * @param fullTitle - Slate JSON 字符串
   * @param tags - 当前的 tags 数组
   * @param originalTags - 原始的 tags 数组（用于检测删除）
   * @returns 更新后的 fullTitle
   */
  private static syncTagsToFullTitle(
    fullTitle: string,
    tags: string[],
    originalTags?: string[]
  ): string {
    try {
      const nodes = JSON.parse(fullTitle);
      if (!Array.isArray(nodes) || nodes.length === 0) return fullTitle;
      
      // 只处理第一个 paragraph（title 行）
      const paragraph = nodes[0];
      if (paragraph.type !== 'paragraph' || !Array.isArray(paragraph.children)) {
        return fullTitle;
      }
      
      // 提取现有的 tag 元素
      const existingTags = new Set<string>();
      paragraph.children.forEach((child: any) => {
        if (child.type === 'tag' && child.tagName) {
          existingTags.add(child.tagName);
        }
      });
      
      // 计算需要添加和删除的 tags
      const tagsToAdd = tags.filter(tag => !existingTags.has(tag));
      const tagsToRemove = originalTags 
        ? Array.from(existingTags).filter(tag => !tags.includes(tag))
        : [];
      
      // 如果没有变化，直接返回
      if (tagsToAdd.length === 0 && tagsToRemove.length === 0) {
        return fullTitle;
      }
      
      // 删除不需要的 tag 元素
      if (tagsToRemove.length > 0) {
        paragraph.children = paragraph.children.filter((child: any) => {
          if (child.type === 'tag' && tagsToRemove.includes(child.tagName)) {
            return false;
          }
          return true;
        });
      }
      
      // 添加新的 tag 元素（插入到文本内容之前）
      if (tagsToAdd.length > 0) {
        const newTagElements = tagsToAdd.map(tag => ({
          type: 'tag',
          tagName: tag,
          children: [{ text: '' }]
        }));
        
        // 找到第一个非 tag 元素的位置
        let insertIndex = 0;
        for (let i = 0; i < paragraph.children.length; i++) {
          if (paragraph.children[i].type !== 'tag') {
            insertIndex = i;
            break;
          }
        }
        
        // 插入新 tag 元素
        paragraph.children.splice(insertIndex, 0, ...newTagElements);
      }
      
      // 返回更新后的 fullTitle
      return JSON.stringify(nodes);
    } catch (error) {
      console.error('[EventService] syncTagsToFullTitle 失败:', error);
      return fullTitle; // 失败时返回原值
    }
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
      
      // 🔍 检查是否需要将单个 paragraph 拆分成 timestamp-divider 结构
      // （用于修复从 Outlook 同步回来的旧事件）
      try {
        const slateNodes = typeof eventLog.slateJson === 'string' 
          ? JSON.parse(eventLog.slateJson) 
          : eventLog.slateJson;
        
        // 如果是单个 paragraph 节点，且包含时间戳文本
        if (Array.isArray(slateNodes) && 
            slateNodes.length === 1 && 
            slateNodes[0].type === 'paragraph' &&
            slateNodes[0].children?.[0]?.text) {
          
          const text = slateNodes[0].children[0].text;
          const timestampPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/gm;
          const matches = [...text.matchAll(timestampPattern)];
          
          if (matches.length > 0) {
            // 发现时间戳，需要重新解析
            console.log('[EventService] 发现旧格式事件（单段落包含时间戳），重新解析:', matches.length, '个时间戳');
            const newSlateNodes = this.parseTextWithTimestamps(text);
            const newSlateJson = JSON.stringify(newSlateNodes);
            return this.convertSlateJsonToEventLog(newSlateJson);
          }
        }
      } catch (error) {
        console.warn('[EventService] 检查时间戳拆分时出错，使用原 eventlog:', error);
      }
      
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
      
      // 纯文本字符串 - 检查是否包含时间戳分隔符
      console.log('[EventService] 检测到纯文本，检查是否包含时间戳');
      
      // 🔍 尝试识别 YYYY-MM-DD HH:mm:ss 格式的时间戳（用于 Outlook 同步回来的文本）
      const timestampPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})$/gm;
      const matches = [...eventlogInput.matchAll(timestampPattern)];
      
      if (matches.length > 0) {
        // 发现时间戳，按时间戳分割内容
        console.log('[EventService] 发现', matches.length, '个时间戳，按时间分割内容');
        const slateNodes = this.parseTextWithTimestamps(eventlogInput);
        const slateJson = JSON.stringify(slateNodes);
        return this.convertSlateJsonToEventLog(slateJson);
      }
      
      // 没有时间戳，转换为单段落
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
    
    // 🔥 Title 规范化（支持字符串或对象输入 + tags 同步）
    const normalizedTitle = this.normalizeTitle(event.title, event.tags);
    
    // 🔥 EventLog 规范化（优先从 eventlog，回退到 description）
    const normalizedEventLog = this.normalizeEventLog(
      event.eventlog, 
      event.description  // 回退用的 description
    );
    
    // 🔥 Description 规范化（从 eventlog 提取或使用原值）
    const normalizedDescription = normalizedEventLog.plainText || event.description || '';
    
    return {
      // 基础标识
      id: event.id || `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      
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
      priority: event.priority,
      
      // 协作字段
      organizer: event.organizer,
      attendees: event.attendees || [],
      location: event.location || '',
      
      // 来源标识
      fourDNoteSource: event.fourDNoteSource,
      isPlan: event.isPlan,
      isTimeCalendar: event.isTimeCalendar,
      isTimer: event.isTimer,
      isDeadline: event.isDeadline,
      
      // 任务模式
      isTask: event.isTask,
      isCompleted: event.isCompleted,
      
      // Timer 关联
      parentEventId: event.parentEventId,
      childEventIds: event.childEventIds,
      
      // 日历同步配置
      calendarIds: event.calendarIds || [],
      syncMode: event.syncMode,
      subEventConfig: event.subEventConfig,
      
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
   * 解析包含时间戳的纯文本，将其分割为 timestamp-divider + paragraph 节点
   * 
   * @param text - 包含时间戳的纯文本（如 Outlook 同步回来的 description）
   * @returns Slate 节点数组，包含 timestamp-divider 和 paragraph 节点
   * 
   * 输入示例:
   * ```
   * 2025-11-27 01:05:22
   * 第一段内容...
   * 2025-11-27 01:36:23
   * 第二段内容...
   * ```
   * 
   * 输出:
   * ```
   * [
   *   { type: 'timestamp-divider', timestamp: '2025-11-27T01:05:22', children: [{ text: '' }] },
   *   { type: 'paragraph', children: [{ text: '第一段内容...' }] },
   *   { type: 'timestamp-divider', timestamp: '2025-11-27T01:36:23', children: [{ text: '' }] },
   *   { type: 'paragraph', children: [{ text: '第二段内容...' }] }
   * ]
   * ```
   */
  private static parseTextWithTimestamps(text: string): any[] {
    const slateNodes: any[] = [];
    
    // 按行分割
    const lines = text.split('\n');
    
    // 时间戳正则（独立成行，可能带有 "| Xmin later" 等后缀）
    // 匹配: "2025-11-27 01:05:22" 或 "2025-11-27 01:36:23 | 31min later"
    const timestampPattern = /^(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})(\s*\|.*)?$/;
    
    let currentParagraphLines: string[] = [];
    
    for (const line of lines) {
      const match = line.match(timestampPattern);
      
      if (match) {
        // 遇到时间戳行
        
        // 1. 先保存之前累积的段落内容（如果有）
        if (currentParagraphLines.length > 0) {
          const paragraphText = currentParagraphLines.join('\n').trim();
          if (paragraphText) {
            slateNodes.push({
              type: 'paragraph',
              children: [{ text: paragraphText }]
            });
          }
          currentParagraphLines = [];
        }
        
        // 2. 添加 timestamp-divider 节点
        const timeStr = match[1]; // 保持原格式：YYYY-MM-DD HH:mm:ss
        
        slateNodes.push({
          type: 'timestamp-divider',
          timestamp: timeStr, // 不转换，保持空格分隔符
          children: [{ text: '' }]
        });
        
      } else {
        // 普通文本行，累积到当前段落
        currentParagraphLines.push(line);
      }
    }
    
    // 处理最后剩余的段落
    if (currentParagraphLines.length > 0) {
      const paragraphText = currentParagraphLines.join('\n').trim();
      if (paragraphText) {
        slateNodes.push({
          type: 'paragraph',
          children: [{ text: paragraphText }]
        });
      }
    }
    
    // 确保至少有一个节点
    if (slateNodes.length === 0) {
      slateNodes.push({
        type: 'paragraph',
        children: [{ text: '' }]
      });
    }
    
    return slateNodes;
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
          // 🆕 保留 bullet 属性（Bulletpoint 功能）
          const bullet = element.getAttribute('data-bullet') === 'true';
          const bulletLevel = element.getAttribute('data-bullet-level');
          
          const paragraphNode: any = {
            type: 'paragraph',
            children: paragraphChildren
          };
          
          if (bullet && bulletLevel !== null) {
            paragraphNode.bullet = true;
            paragraphNode.bulletLevel = parseInt(bulletLevel, 10);
            console.log('[EventService.parseHtmlNode] ✅ 保留 Bullet 属性:', { bullet, bulletLevel });
          }
          
          slateNodes.push(paragraphNode);
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
    // 注：简化正则，不使用 \p{Emoji}（需要 ES2018+）
    const tagPattern = /(@[\w\u4e00-\u9fa5]+)/g;
    
    let match;
    while ((match = tagPattern.exec(text)) !== null) {
      const fullMatch = match[0];
      const index = match.index;
      
      // 提取 emoji 和标签名（简化处理，emoji 需要在前面单独提取）
      const emojiMatch = null; // 暂时禁用 emoji 匹配
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
  static async searchHistoricalParticipants(query: string): Promise<import('../types').Contact[]> {
    const allEvents = await this.getAllEvents();
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
  static async getEventsByContact(identifier: string, limit: number = 5): Promise<Event[]> {
    const allEvents = await this.getAllEvents();
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
        const timeA = new Date(
          (a.startTime != null && a.startTime !== '') ? a.startTime : a.createdAt
        ).getTime();
        const timeB = new Date(
          (b.startTime != null && b.startTime !== '') ? b.startTime : b.createdAt
        ).getTime();
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
      
      // 获取 Microsoft Calendar Service（从 syncManager 中获取）
      if (!syncManagerInstance?.microsoftService) {
        eventLogger.error('❌ [syncToMultipleCalendars] MicrosoftService 未初始化');
        throw new Error('MicrosoftCalendarService not initialized in syncManager');
      }
      const microsoftService = syncManagerInstance.microsoftService;
      
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
   * 从事件的 eventlog 中提取 timestamp 节点，补录到 EventHistoryService
   * 用于修复旧事件缺失的历史记录
   * 
   * @param eventId - 事件ID
   * @param eventlog - 事件日志对象
   * @returns 补录的历史记录数量
   */
  static async backfillEventHistoryFromTimestamps(eventId: string, eventlog: any): Promise<number> {
    try {
      // 检查是否已有创建记录
      const existingLogs = EventHistoryService.queryHistory({
        eventId,
        operations: ['create'],
        limit: 1
      });
      
      if (existingLogs.length > 0) {
        eventLogger.log('✅ [EventService] Event already has history, skip backfill:', eventId);
        return 0;
      }
      
      // 解析 eventlog 中的 slateJson
      if (!eventlog || typeof eventlog !== 'object' || !eventlog.slateJson) {
        eventLogger.warn('⚠️ [EventService] Invalid eventlog for backfill:', eventId);
        return 0;
      }
      
      let slateNodes: any[];
      try {
        slateNodes = typeof eventlog.slateJson === 'string' 
          ? JSON.parse(eventlog.slateJson) 
          : eventlog.slateJson;
      } catch (error) {
        eventLogger.error('❌ [EventService] Failed to parse slateJson:', error);
        return 0;
      }
      
      // 提取所有 timestamp-divider 节点
      const timestamps: Date[] = [];
      
      // 🔍 方案1: 查找 timestamp-divider 节点（标准 ReMarkable 格式）
      for (const node of slateNodes) {
        if (node.type === 'timestamp-divider' && node.timestamp) {
          try {
            const timestampDate = new Date(node.timestamp);
            if (!isNaN(timestampDate.getTime())) {
              timestamps.push(timestampDate);
            }
          } catch (error) {
            eventLogger.warn('⚠️ [EventService] Invalid timestamp:', node.timestamp);
          }
        }
      }
      
      // 🔍 方案2: 如果没找到 timestamp-divider，尝试从 paragraph 文本中提取时间字符串
      // 用于处理从 Outlook 同步回来的事件（timestamp 被转换成纯文本）
      if (timestamps.length === 0) {
        eventLogger.log('📋 [EventService] No timestamp-divider found, try extracting from text content');
        
        // 正则匹配 YYYY-MM-DD HH:mm:ss 格式的时间字符串
        const timePattern = /(\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2})/g;
        
        for (const node of slateNodes) {
          if (node.type === 'paragraph' && node.children) {
            // 遍历 paragraph 的所有文本节点
            for (const child of node.children) {
              if (child.text) {
                const matches = child.text.matchAll(timePattern);
                for (const match of matches) {
                  try {
                    const timeStr = match[1];
                    // 转换为 ISO 格式（空格 → T）然后解析
                    const isoStr = timeStr.replace(' ', 'T');
                    const timestampDate = new Date(isoStr);
                    
                    if (!isNaN(timestampDate.getTime())) {
                      timestamps.push(timestampDate);
                      eventLogger.log('✅ [EventService] Extracted timestamp from text:', timeStr);
                    }
                  } catch (error) {
                    eventLogger.warn('⚠️ [EventService] Failed to parse time string:', match[1]);
                  }
                }
              }
            }
          }
        }
      }
      
      if (timestamps.length === 0) {
        eventLogger.log('📋 [EventService] No timestamps found in eventlog (neither nodes nor text), skip backfill:', eventId);
        return 0;
      }
      
      // 按时间排序（最早的在前）
      timestamps.sort((a, b) => a.getTime() - b.getTime());
      
      // 补录历史记录
      let backfilledCount = 0;
      
      // 第一个 timestamp 作为创建记录
      const createTime = timestamps[0];
      const event = await this.getEventById(eventId);
      if (event) {
        // 添加 try-catch 处理 QuotaExceededError
        try {
          EventHistoryService.logCreate(event, 'backfill-from-timestamp', createTime);
          backfilledCount++;
          eventLogger.log('✅ [EventService] Backfilled create log:', {
            eventId,
            createTime: createTime.toISOString()
          });
        } catch (error: any) {
          if (error.name === 'QuotaExceededError') {
            eventLogger.warn('⚠️ localStorage quota exceeded, cannot backfill EventHistory. Consider cleaning old records.');
            return 0;  // 优雅降级：跳过补录
          }
          throw error;  // 其他错误继续抛出
        }
      }
      
      // 🔧 暂时只补录创建记录，不补录后续的编辑记录
      // 原因：避免 localStorage 配额超限（EventHistory 已经很大）
      // TODO: 后续可以考虑只补录最近的几个 timestamp
      /*
      for (let i = 1; i < timestamps.length; i++) {
        const editTime = timestamps[i];
        if (event) {
          EventHistoryService.logUpdate(
            eventId,  // ✅ 修复：第一个参数是 eventId 字符串，不是 event 对象
            event, 
            event,
            'backfill-from-timestamp',
            editTime
          );
          backfilledCount++;
        }
      }
      */
      
      eventLogger.log('✅ [EventService] Backfill completed:', {
        eventId,
        totalTimestamps: timestamps.length,
        backfilledCount
      });
      
      return backfilledCount;
    } catch (error) {
      eventLogger.error('❌ [EventService] Backfill failed:', error);
      return 0;
    }
  }

  /**
   * 从远程同步创建事件（内部方法，供 ActionBasedSyncManager 使用）
   * - 直接保存到 localStorage（不触发 sync）
   * - 记录到 EventHistoryService
   * 
   * @param event - 事件对象（已经过 convertRemoteEventToLocal 和 normalizeEvent 处理）
   * @returns 创建的事件对象
   */
  static async createEventFromRemoteSync(event: Event): Promise<Event> {
    try {
      eventLogger.log('🌐 [EventService] Creating event from remote sync:', event.id);

      // ⚠️ 注意：event 已经过 convertRemoteEventToLocal 中的 normalizeEvent 处理
      // 但如果 eventlog 为空或是空数组，需要从 description 重新生成
      let finalEventLog = event.eventlog;
      
      if (!finalEventLog || 
          (typeof finalEventLog === 'object' && finalEventLog.slateJson === '[]')) {
        eventLogger.log('🔧 [EventService] Remote event eventlog 为空，从 description 重新生成');
        finalEventLog = this.normalizeEventLog(undefined, event.description);
      }
      
      const finalEvent: Event = {
        ...event,
        eventlog: finalEventLog,
        // 确保 sync 相关字段正确
        syncStatus: event.syncStatus || 'synced',
      };

      // 检查是否已存在（理论上不应该存在，但做防御性检查）
      const existing = await storageManager.queryEvents({
        filters: { eventIds: [event.id] },
        limit: 1
      });
      
      if (existing.items.length > 0) {
        eventLogger.warn('⚠️ [EventService] Remote event already exists, updating instead:', event.id);
        const storageEvent = this.convertEventToStorageEvent(finalEvent);
        await storageManager.updateEvent(event.id, storageEvent);
      } else {
        // 创建新事件（双写到 IndexedDB + SQLite）
        const storageEvent = this.convertEventToStorageEvent(finalEvent);
        await storageManager.createEvent(storageEvent);
      }
      
      // 🆕 记录到事件历史（使用 outlook-sync 作为来源）
      const historyLog = EventHistoryService.logCreate(finalEvent, 'outlook-sync');
      
      // 🔍 验证历史记录是否真的保存成功
      const verifyLog = EventHistoryService.queryHistory({
        eventId: finalEvent.id,
        operations: ['create'],
        limit: 1
      })[0];
      
      // 获取统计信息
      const stats = await storageManager.getStats();
      const totalEvents = stats.indexedDB?.eventsCount || 0;
      
      eventLogger.log('✅ [EventService] Remote event created:', {
        eventId: finalEvent.id,
        title: finalEvent.title,
        hasEventlog: typeof finalEvent.eventlog === 'object' && !!finalEvent.eventlog?.slateJson,
        总事件数: totalEvents,
        historyLogSaved: !!historyLog,
        historyLogVerified: !!verifyLog,
        historyLogId: historyLog?.id,
        verifyLogId: verifyLog?.id
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

  // ========================================
  // 🆕 Storage Layer 转换工具
  // ========================================

  /**
   * 将 StorageEvent 转换为 Event（应用层模型）
   */
  private static convertStorageEventToEvent(storageEvent: StorageEvent): Event {
    return {
      ...storageEvent,
      title: this.normalizeTitle(storageEvent.title),
      eventlog: storageEvent.eventlog as any, // EventLog 类型兼容
    } as Event;
  }

  /**
   * 将 Event 转换为 StorageEvent（存储层模型）
   */
  private static convertEventToStorageEvent(event: Event): StorageEvent {
    return {
      ...event,
      title: event.title,
      eventlog: event.eventlog as any,
    } as StorageEvent;
  }

  // ========================================
  // 🆕 EventTree 辅助方法
  // ========================================

  /**
   * 获取事件类型描述（用于日志和调试）
   */
  static getEventType(event: Event): string {
    if (event.isTimer) return 'Timer';
    if (event.isTimeLog) return 'TimeLog';
    if (event.isOutsideApp) return 'OutsideApp';
    if (event.isPlan) return 'UserSubTask';
    return 'Event';
  }

  /**
   * 判断是否为附属事件（系统自动生成，无独立 Plan 状态）
   */
  static isSubordinateEvent(event: Event): boolean {
    return !!(event.isTimer || event.isTimeLog || event.isOutsideApp);
  }

  /**
   * 判断是否为用户子事件（用户主动创建，有完整 Plan 状态）
   */
  static isUserSubEvent(event: Event): boolean {
    return !!(event.isPlan && event.parentEventId && !this.isSubordinateEvent(event));
  }

  /**
   * 获取所有子事件（包括所有类型）
   */
  static async getChildEvents(parentId: string): Promise<Event[]> {
    const parent = await this.getEventById(parentId);
    if (!parent?.childEventIds) return [];
    
    const children = await Promise.all(
      parent.childEventIds.map((id: string) => this.getEventById(id))
    );
    return children.filter((e): e is Event => e !== null);
  }

  /**
   * 获取附属事件（Timer/TimeLog/OutsideApp）
   */
  static async getSubordinateEvents(parentId: string): Promise<Event[]> {
    const children = await this.getChildEvents(parentId);
    return children.filter(e => this.isSubordinateEvent(e));
  }

  /**
   * 获取用户子任务
   */
  static async getUserSubTasks(parentId: string): Promise<Event[]> {
    const children = await this.getChildEvents(parentId);
    return children.filter(e => this.isUserSubEvent(e));
  }

  /**
   * 递归获取整个事件树（广度优先遍历）
   */
  static async getEventTree(rootId: string): Promise<Event[]> {
    const result: Event[] = [];
    const visited = new Set<string>();
    const queue = [rootId];
    
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      
      // 避免循环引用
      if (visited.has(currentId)) {
        eventLogger.warn('⚠️ [EventService] 检测到循环引用:', currentId);
        continue;
      }
      visited.add(currentId);
      
      const event = await this.getEventById(currentId);
      
      if (event) {
        result.push(event);
        
        // 添加子事件到队列
        if (event.childEventIds) {
          queue.push(...event.childEventIds);
        }
      }
    }
    
    return result;
  }

  /**
   * 计算事件总时长（包括所有附属事件的实际时长）
   */
  static async getTotalDuration(parentId: string): Promise<number> {
    const children = await this.getSubordinateEvents(parentId);
    return children.reduce((sum, child) => {
      if (child.startTime && child.endTime) {
        const start = new Date(child.startTime).getTime();
        const end = new Date(child.endTime).getTime();
        return sum + (end - start);
      }
      return sum;
    }, 0);
  }

  /**
   * 获取事件的层级深度
   */
  static async getEventDepth(eventId: string): Promise<number> {
    let depth = 0;
    let currentId: string | undefined = eventId;
    const visited = new Set<string>();
    
    while (currentId) {
      if (visited.has(currentId)) {
        eventLogger.warn('⚠️ [EventService] 检测到父子循环引用:', currentId);
        break;
      }
      visited.add(currentId);
      
      const event = await this.getEventById(currentId);
      if (!event?.parentEventId) break;
      
      depth++;
      currentId = event.parentEventId;
    }
    
    return depth;
  }

  /**
   * 获取根事件（最顶层的父事件）
   */
  static async getRootEvent(eventId: string): Promise<Event | null> {
    let currentId = eventId;
    const visited = new Set<string>();
    
    while (currentId) {
      if (visited.has(currentId)) {
        eventLogger.warn('⚠️ [EventService] 检测到父子循环引用:', currentId);
        return null;
      }
      visited.add(currentId);
      
      const event = await this.getEventById(currentId);
      if (!event) return null;
      if (!event.parentEventId) return event;
      
      currentId = event.parentEventId;
    }
    
    return null;
  }

  // ========== 双向链接管理（Issue #13）==========

  /**
   * 添加双向链接
   * 在事件 A 和事件 B 之间创建链接关系
   * 
   * @param fromEventId 源事件 ID
   * @param toEventId 目标事件 ID
   * @returns 是否成功
   * 
   * @example
   * // 在事件 A 的 EventLog 中输入 "@Project Ace"
   * await EventService.addLink(eventA.id, projectAce.id);
   * // 结果：eventA.linkedEventIds = ['project-ace-id']
   * //      projectAce.backlinks = ['event-a-id']
   */
  static async addLink(fromEventId: string, toEventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // 验证事件存在
      const fromEvent = await this.getEventById(fromEventId);
      const toEvent = await this.getEventById(toEventId);
      
      if (!fromEvent) {
        return { success: false, error: `源事件不存在: ${fromEventId}` };
      }
      
      if (!toEvent) {
        return { success: false, error: `目标事件不存在: ${toEventId}` };
      }
      
      // 防止自己链接自己
      if (fromEventId === toEventId) {
        return { success: false, error: '不能链接自己' };
      }
      
      // 更新源事件的 linkedEventIds
      const linkedEventIds = fromEvent.linkedEventIds || [];
      if (!linkedEventIds.includes(toEventId)) {
        linkedEventIds.push(toEventId);
        await this.updateEvent(fromEventId, { linkedEventIds }, 'EventService.addLink');
      }
      
      // 更新目标事件的 backlinks
      await this.rebuildBacklinks(toEventId);
      
      eventLogger.log('🔗 [EventService] 添加链接:', { fromEventId, toEventId });
      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] 添加链接失败:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 移除双向链接
   * 
   * @param fromEventId 源事件 ID
   * @param toEventId 目标事件 ID
   * @returns 是否成功
   */
  static async removeLink(fromEventId: string, toEventId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const fromEvent = await this.getEventById(fromEventId);
      
      if (!fromEvent) {
        return { success: false, error: `源事件不存在: ${fromEventId}` };
      }
      
      // 从 linkedEventIds 中移除
      const linkedEventIds = (fromEvent.linkedEventIds || []).filter(id => id !== toEventId);
      await this.updateEvent(fromEventId, { linkedEventIds }, 'EventService.removeLink');
      
      // 重新计算目标事件的 backlinks
      await this.rebuildBacklinks(toEventId);
      
      eventLogger.log('🔓 [EventService] 移除链接:', { fromEventId, toEventId });
      return { success: true };
    } catch (error) {
      eventLogger.error('❌ [EventService] 移除链接失败:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 重建事件的反向链接（backlinks）
   * 遍历所有事件，找出哪些事件链接了当前事件
   * 
   * @param eventId 需要重建 backlinks 的事件 ID
   */
  static async rebuildBacklinks(eventId: string): Promise<void> {
    try {
      const allEvents = await this.getAllEvents();
      const backlinks: string[] = [];
      
      // 遍历所有事件，找出链接了当前事件的
      allEvents.forEach((event: Event) => {
        if (event.linkedEventIds?.includes(eventId)) {
          backlinks.push(event.id);
        }
      });
      
      // 更新 backlinks（不触发同步）
      await this.updateEvent(eventId, { backlinks }, 'EventService.rebuildBacklinks');
      
      eventLogger.log('🔄 [EventService] 重建反向链接:', { eventId, backlinksCount: backlinks.length });
    } catch (error) {
      eventLogger.error('❌ [EventService] 重建反向链接失败:', error);
    }
  }

  /**
   * 批量重建所有事件的反向链接
   * 用于数据迁移或修复
   */
  static async rebuildAllBacklinks(): Promise<{ success: boolean; rebuiltCount: number; error?: string }> {
    try {
      const allEvents = await this.getAllEvents();
      let rebuiltCount = 0;
      
      for (const event of allEvents) {
        await this.rebuildBacklinks(event.id);
        rebuiltCount++;
      }
      
      eventLogger.log('✅ [EventService] 批量重建反向链接完成:', { rebuiltCount });
      return { success: true, rebuiltCount };
    } catch (error) {
      eventLogger.error('❌ [EventService] 批量重建反向链接失败:', error);
      return { success: false, rebuiltCount: 0, error: String(error) };
    }
  }

  /**
   * 获取事件的所有链接事件（正向链接 + 反向链接）
   * 用于在 EventTree 中显示堆叠卡片
   * 
   * @param eventId 事件 ID
   * @returns 链接事件列表
   */
  static async getLinkedEvents(eventId: string): Promise<{
    outgoing: Event[];  // 正向链接（我链接的事件）
    incoming: Event[];  // 反向链接（链接我的事件）
  }> {
    try {
      const event = await this.getEventById(eventId);
      
      if (!event) {
        return { outgoing: [], incoming: [] };
      }
      
      // 获取正向链接的事件
      const outgoingIds = event.linkedEventIds || [];
      const outgoing = (await Promise.all(
        outgoingIds.map(id => this.getEventById(id))
      )).filter(e => e !== null) as Event[];
      
      // 获取反向链接的事件
      const incomingIds = event.backlinks || [];
      const incoming = (await Promise.all(
        incomingIds.map(id => this.getEventById(id))
      )).filter(e => e !== null) as Event[];
      
      return { outgoing, incoming };
    } catch (error) {
      eventLogger.error('❌ [EventService] 获取链接事件失败:', error);
      return { outgoing: [], incoming: [] };
    }
  }

  /**
   * 检查两个事件之间是否存在链接
   * 
   * @param fromEventId 源事件 ID
   * @param toEventId 目标事件 ID
   * @returns 是否存在链接
   */
  static async hasLink(fromEventId: string, toEventId: string): Promise<boolean> {
    try {
      const fromEvent = await this.getEventById(fromEventId);
      return fromEvent?.linkedEventIds?.includes(toEventId) || false;
    } catch (error) {
      eventLogger.error('❌ [EventService] 检查链接失败:', error);
      return false;
    }
  }

  /**
   * 判断事件是否应该显示在 EventTree 中
   * 排除系统自动生成的事件类型
   * 
   * @param event 事件对象
   * @returns 是否应该显示
   */
  static shouldShowInEventTree(event: Event): boolean {
    // 排除系统事件
    if (event.isTimer) return false;         // Timer 子事件
    if (event.isOutsideApp) return false;    // 外部应用数据（听歌、录屏等）
    if (event.isTimeLog) return false;       // 纯系统时间日志
    
    // 显示所有用户创建的事件
    return true; // Task、文档、Plan 事件、TimeCalendar 事件等
  }
}

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
  (window as any).EventService = EventService;
}
