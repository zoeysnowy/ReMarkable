/**
 * EventHub - 事件状态管理中心
 * 
 * 职责：
 * 1. 维护事件的内存快照（snapshot）
 * 2. 提供增量更新 API（只更新变化的字段）
 * 3. 协调多个组件对同一事件的修改
 * 4. 发出全局事件通知
 * 
 * 设计理念：
 * - 类似 TimeHub，但管理完整的 Event 对象
 * - 组件只能通过 EventHub 修改事件
 * - 所有修改都是增量的、可追踪的
 */

import { Event } from '../types';
import EventService from './EventService';

const dbg = console.log.bind(console);

interface EventSnapshot {
  event: Event;
  lastModified: number;
}

class EventHubClass {
  private cache: Map<string, EventSnapshot> = new Map();

  /**
   * 获取事件快照（从缓存或 EventService）
   */
  getSnapshot(eventId: string): Event | null {
    // 1. 尝试从缓存读取
    const cached = this.cache.get(eventId);
    if (cached) {
      dbg('🔍 [EventHub] 缓存命中', { eventId, age: Date.now() - cached.lastModified });
      return { ...cached.event }; // 返回副本，防止外部修改
    }

    // 2. 从 EventService 冷加载
    const events = EventService.getAllEvents();
    const event = events.find(e => e.id === eventId);
    
    if (!event) {
      console.warn('⚠️ [EventHub] 事件不存在', { eventId });
      return null;
    }

    // 3. 缓存快照
    this.cache.set(eventId, {
      event: { ...event },
      lastModified: Date.now()
    });

    dbg('📥 [EventHub] 冷加载快照', { eventId, title: event.title });
    return { ...event };
  }

  /**
   * 增量更新事件（只更新指定字段）
   * 
   * @param eventId 事件 ID
   * @param updates 要更新的字段（Partial<Event>）
   * @param options 选项
   * @returns 更新后的完整事件
   */
  async updateFields(
    eventId: string, 
    updates: Partial<Event>,
    options: { skipSync?: boolean; source?: string } = {}
  ): Promise<{ success: boolean; event?: Event; error?: string }> {
    const { skipSync = false, source = 'unknown' } = options;

    dbg('📝 [EventHub] 增量更新', { 
      eventId, 
      fields: Object.keys(updates),
      source 
    });

    // 1. 获取当前快照
    const currentSnapshot = this.getSnapshot(eventId);
    if (!currentSnapshot) {
      return { success: false, error: 'Event not found' };
    }

    // 2. 合并更新（只更新指定字段）
    const updatedEvent: Event = {
      ...currentSnapshot,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    // 3. 记录变化（用于调试）
    const changes: string[] = [];
    for (const key in updates) {
      if (updates.hasOwnProperty(key)) {
        const oldValue = (currentSnapshot as any)[key];
        const newValue = (updates as any)[key];
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
          changes.push(`${key}: ${this.formatValue(oldValue)} → ${this.formatValue(newValue)}`);
        }
      }
    }

    if (changes.length > 0) {
      dbg('🔄 [EventHub] 字段变化:', changes);
    }

    // 4. 更新缓存
    this.cache.set(eventId, {
      event: updatedEvent,
      lastModified: Date.now()
    });

    // 5. 持久化到 EventService
    const result = await EventService.updateEvent(eventId, updatedEvent, skipSync);

    if (result.success) {
      // 6. 发出全局通知
      window.dispatchEvent(new CustomEvent('eventUpdated', {
        detail: { 
          eventId, 
          updates,
          source,
          event: updatedEvent
        }
      }));
    }

    return result;
  }

  /**
   * 创建新事件
   */
  async createEvent(event: Event): Promise<{ success: boolean; event?: Event; error?: string }> {
    dbg('➕ [EventHub] 创建事件', { id: event.id, title: event.title });

    // 1. 缓存快照
    this.cache.set(event.id, {
      event: { ...event },
      lastModified: Date.now()
    });

    // 2. 持久化
    const result = await EventService.createEvent(event);

    if (result.success) {
      // 3. 发出通知
      window.dispatchEvent(new CustomEvent('eventCreated', {
        detail: { event }
      }));
    }

    return result;
  }

  /**
   * 删除事件
   */
  async deleteEvent(eventId: string, skipSync: boolean = false): Promise<{ success: boolean; error?: string }> {
    dbg('🗑️ [EventHub] 删除事件', { eventId });

    // 1. 清除缓存
    this.cache.delete(eventId);

    // 2. 删除持久化数据
    const result = await EventService.deleteEvent(eventId, skipSync);

    if (result.success) {
      // 3. 发出通知
      window.dispatchEvent(new CustomEvent('eventDeleted', {
        detail: { eventId }
      }));
    }

    return result;
  }

  /**
   * 清除指定事件的缓存
   */
  invalidate(eventId: string): void {
    dbg('🔄 [EventHub] 清除缓存', { eventId });
    this.cache.delete(eventId);
  }

  /**
   * 清除所有缓存
   */
  invalidateAll(): void {
    dbg('🔄 [EventHub] 清除所有缓存');
    this.cache.clear();
  }

  /**
   * 格式化值用于日志输出
   */
  private formatValue(value: any): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'string') {
      return value.length > 30 ? `"${value.substring(0, 30)}..."` : `"${value}"`;
    }
    if (Array.isArray(value)) {
      return `[${value.length} items]`;
    }
    return JSON.stringify(value);
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      events: Array.from(this.cache.entries()).map(([id, snapshot]) => ({
        id,
        title: snapshot.event.title,
        age: Date.now() - snapshot.lastModified
      }))
    };
  }
}

// 导出单例
export const EventHub = new EventHubClass();

// 调试接口
if (typeof window !== 'undefined') {
  (window as any).debugEventHub = {
    getSnapshot: (id: string) => EventHub.getSnapshot(id),
    getCacheStats: () => EventHub.getCacheStats(),
    invalidate: (id: string) => EventHub.invalidate(id),
    invalidateAll: () => EventHub.invalidateAll()
  };
}
