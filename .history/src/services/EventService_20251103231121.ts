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

import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { formatTimeForStorage } from '../utils/timeUtils';
import { logger } from '../utils/logger';

const eventLogger = logger.module('EventService');

// 同步管理器实例（将在初始化时设置�?
let syncManagerInstance: any = null;

export class EventService {
  /**
   * 初始化服务，注入同步管理�?
   */
  static initialize(syncManager: any) {
    syncManagerInstance = syncManager;
    eventLogger.log('�?[EventService] Initialized with sync manager');
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
   * 创建新事�?
   * @param event - 事件对象
   * @param skipSync - 是否跳过同步（默认false，某些场景如Timer运行中可设为true�?
   */
  static async createEvent(event: Event, skipSync: boolean = false): Promise<{ success: boolean; event?: Event; error?: string }> {
    try {
      eventLogger.log('🆕 [EventService] Creating event:', event.id);
      eventLogger.log('📋 [EventService] 创建参数:', {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay,
        tags: event.tags,
        description: event.description?.substring(0, 50) + '...'
      });

      // 验证必填字段
      if (!event.id || !event.title || !event.startTime || !event.endTime) {
        const error = 'Event missing required fields';
        eventLogger.error('❌ [EventService]', error, event);
        return { success: false, error };
      }

      // 确保必要字段
      const finalEvent: Event = {
        ...event,
        remarkableSource: true,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending'),
        createdAt: event.createdAt || formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date())
      };

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
      eventLogger.log('✅ [EventService] 创建成功:', {
        eventId: finalEvent.id,
        title: finalEvent.title,
        startTime: finalEvent.startTime,
        endTime: finalEvent.endTime,
        总事件数: existingEvents.length
      });

      // 触发全局更新事件
      this.dispatchEventUpdate(event.id, { isNewEvent: true, tags: event.tags });

      // 同步�?Outlook（如果不跳过且有同步管理器）
      if (!skipSync && syncManagerInstance && finalEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('create', 'event', finalEvent.id, finalEvent);
          eventLogger.log('�?[EventService] Event synced to Outlook');
        } catch (syncError) {
          eventLogger.error('�?[EventService] Sync failed (non-blocking):', syncError);
          // 同步失败不影响事件创建成�?
        }
      } else {
        if (skipSync) {
          eventLogger.log('⏭️ [EventService] Sync skipped (skipSync=true)');
        } else if (finalEvent.syncStatus === 'local-only') {
          eventLogger.log('⏭️ [EventService] Sync skipped (syncStatus=local-only)');
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
      eventLogger.log('📋 [EventService] 更新字段:', {
        eventId,
        更新的字段: Object.keys(updates),
        startTime: updates.startTime,
        endTime: updates.endTime,
        title: updates.title,
        isAllDay: updates.isAllDay,
        调用者: caller
      });

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        eventLogger.error('�?[EventService]', error);
        return { success: false, error };
      }

      const originalEvent = existingEvents[eventIndex];
      
      // 合并更新
      const updatedEvent: Event = {
        ...originalEvent,
        ...updates,
        id: eventId, // 确保ID不被覆盖
        updatedAt: formatTimeForStorage(new Date())
      };

      // 更新数组
      existingEvents[eventIndex] = updatedEvent;

      // 保存到localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      eventLogger.log('💾 [EventService] Event updated in localStorage');
      eventLogger.log('✅ [EventService] 更新成功:', {
        eventId: updatedEvent.id,
        title: updatedEvent.title,
        startTime: updatedEvent.startTime,
        endTime: updatedEvent.endTime,
        isAllDay: updatedEvent.isAllDay
      });

      // 触发全局更新事件
      this.dispatchEventUpdate(eventId, { isUpdate: true, tags: updatedEvent.tags });

      // 同步�?Outlook
      if (!skipSync && syncManagerInstance && updatedEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('update', 'event', eventId, updatedEvent, originalEvent);
          eventLogger.log('�?[EventService] Event update synced to Outlook');
        } catch (syncError) {
          eventLogger.error('�?[EventService] Sync failed (non-blocking):', syncError);
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

      // 保存�?localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      eventLogger.log('💾 [EventService] Event deleted from localStorage');

      // 触发全局更新事件
      this.dispatchEventUpdate(eventId, { deleted: true });

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
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { eventId, ...detail }
      }));
      eventLogger.log('🔔 [EventService] Dispatched eventsUpdated event:', eventId);
    } catch (error) {
      eventLogger.error('�?[EventService] Failed to dispatch event:', error);
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
}

// 暴露到全局用于调试
if (typeof window !== 'undefined') {
  (window as any).EventService = EventService;
}
