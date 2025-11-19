// 建议的EventService改进 - 集成历史记录和软删除

/**
 * EventService 改进方案
 * 添加操作历史追踪和软删除支持
 */

// 1. 在Event接口中添加软删除字段
export interface Event {
  // ... 现有字段
  
  // 🆕 软删除和版本控制
  deletedAt?: string;        // 软删除时间戳
  isDeleted?: boolean;       // 软删除标记
  version: number;           // 版本号（用于冲突检测）
  operationId?: string;      // 操作ID（用于幂等性）
}

// 2. EventService中集成历史记录
class EventService {
  /**
   * 创建事件（增强版）
   */
  static async createEvent(event: Partial<Event>, source: string = 'user'): Promise<Event> {
    const now = formatTimeForStorage(new Date());
    const newEvent: Event = {
      ...event,
      id: event.id || generateEventId(),
      version: 1,
      operationId: `create_${Date.now()}_${Math.random()}`,
      createdAt: now,
      updatedAt: now,
      isDeleted: false
    };

    // 🆕 记录创建历史
    EventHistoryService.logCreate(newEvent, source);
    
    // 保存事件
    const events = this.getAllEvents();
    events.push(newEvent);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    this.dispatchEventUpdate(newEvent.id, { created: true });
    return newEvent;
  }

  /**
   * 更新事件（增强版）
   */
  static async updateEvent(
    eventId: string, 
    updates: Partial<Event>, 
    source: string = 'user'
  ): Promise<{ success: boolean; error?: string; event?: Event }> {
    const events = this.getAllEvents();
    const existingEvent = events.find(e => e.id === eventId && !e.isDeleted);
    
    if (!existingEvent) {
      // 🔍 检查是否为已删除的事件
      const deletedEvent = events.find(e => e.id === eventId && e.isDeleted);
      if (deletedEvent) {
        return { 
          success: false, 
          error: `Event was deleted at ${deletedEvent.deletedAt}. Use restoreEvent() to recover.` 
        };
      }
      
      return { success: false, error: 'Event not found' };
    }

    // 🔍 版本冲突检测
    if (updates.version && updates.version < existingEvent.version) {
      return { 
        success: false, 
        error: `Version conflict: expected ${existingEvent.version}, got ${updates.version}` 
      };
    }

    const beforeUpdate = { ...existingEvent };
    const updatedEvent = {
      ...existingEvent,
      ...updates,
      version: existingEvent.version + 1,
      operationId: `update_${Date.now()}_${Math.random()}`,
      updatedAt: formatTimeForStorage(new Date())
    };

    // 🆕 记录更新历史
    EventHistoryService.logUpdate(eventId, beforeUpdate, updatedEvent, source);
    
    // 保存更新
    const eventIndex = events.findIndex(e => e.id === eventId);
    events[eventIndex] = updatedEvent;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    this.dispatchEventUpdate(eventId, { updated: true });
    return { success: true, event: updatedEvent };
  }

  /**
   * 软删除事件
   */
  static async softDeleteEvent(
    eventId: string, 
    source: string = 'user'
  ): Promise<{ success: boolean; error?: string }> {
    const events = this.getAllEvents();
    const existingEvent = events.find(e => e.id === eventId && !e.isDeleted);
    
    if (!existingEvent) {
      return { success: false, error: 'Event not found or already deleted' };
    }

    const deletedEvent = {
      ...existingEvent,
      isDeleted: true,
      deletedAt: formatTimeForStorage(new Date()),
      version: existingEvent.version + 1,
      operationId: `delete_${Date.now()}_${Math.random()}`
    };

    // 🆕 记录删除历史
    EventHistoryService.logDelete(existingEvent, source);
    
    // 保存软删除状态
    const eventIndex = events.findIndex(e => e.id === eventId);
    events[eventIndex] = deletedEvent;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    this.dispatchEventUpdate(eventId, { deleted: true, soft: true });
    return { success: true };
  }

  /**
   * 恢复已删除的事件
   */
  static async restoreEvent(
    eventId: string, 
    source: string = 'user'
  ): Promise<{ success: boolean; error?: string; event?: Event }> {
    const events = this.getAllEvents();
    const deletedEvent = events.find(e => e.id === eventId && e.isDeleted);
    
    if (!deletedEvent) {
      return { success: false, error: 'Event not found or not deleted' };
    }

    const restoredEvent = {
      ...deletedEvent,
      isDeleted: false,
      deletedAt: undefined,
      version: deletedEvent.version + 1,
      operationId: `restore_${Date.now()}_${Math.random()}`,
      updatedAt: formatTimeForStorage(new Date())
    };

    // 🆕 记录恢复历史
    EventHistoryService.logUpdate(eventId, deletedEvent, restoredEvent, source, {
      action: 'restore',
      metadata: { restoredAt: formatTimeForStorage(new Date()) }
    });
    
    // 保存恢复状态
    const eventIndex = events.findIndex(e => e.id === eventId);
    events[eventIndex] = restoredEvent;
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    this.dispatchEventUpdate(eventId, { restored: true });
    return { success: true, event: restoredEvent };
  }

  /**
   * 获取所有事件（排除已删除）
   */
  static getAllEvents(): Event[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const allEvents = stored ? JSON.parse(stored) : [];
      
      // 默认过滤已删除的事件
      return allEvents.filter((e: Event) => !e.isDeleted);
    } catch (error) {
      console.error('Failed to load events:', error);
      return [];
    }
  }

  /**
   * 获取包含已删除事件的完整列表（用于历史查看）
   */
  static getAllEventsIncludeDeleted(): Event[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to load events:', error);
      return [];
    }
  }

  /**
   * 操作顺序检查（基于timestamp）
   */
  static validateOperationOrder(eventId: string, newOperationTimestamp: number): boolean {
    const history = EventHistoryService.queryHistory({ eventId });
    if (history.length === 0) return true;
    
    const lastOperation = history[history.length - 1];
    const lastTimestamp = new Date(lastOperation.timestamp).getTime();
    
    return newOperationTimestamp > lastTimestamp;
  }

  /**
   * 冲突解决助手
   */
  static async resolveConflict(
    eventId: string, 
    localVersion: Event, 
    remoteVersion: Event
  ): Promise<Event> {
    // 基于时间戳和版本号的自动冲突解决
    const localTimestamp = new Date(localVersion.updatedAt).getTime();
    const remoteTimestamp = new Date(remoteVersion.updatedAt).getTime();
    
    // 1. 版本号优先
    if (localVersion.version > remoteVersion.version) {
      return localVersion;
    } else if (remoteVersion.version > localVersion.version) {
      return remoteVersion;
    }
    
    // 2. 时间戳优先（版本号相同时）
    if (localTimestamp > remoteTimestamp) {
      return localVersion;
    } else {
      return remoteVersion;
    }
  }
}