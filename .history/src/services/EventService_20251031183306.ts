/**
 * EventService - 缁熶竴鐨勪簨浠剁鐞嗘湇鍔? * 
 * 鑱岃矗锛? * 1. 闆嗕腑绠＄悊鎵€鏈変簨浠剁殑鍒涘缓銆佹洿鏂般€佸垹闄ゆ搷浣? * 2. 鑷姩澶勭悊 localStorage 鎸佷箙鍖? * 3. 鑷姩瑙﹀彂鍚屾鏈哄埗锛坮ecordLocalAction锛? * 4. 鍙戦€佸叏灞€浜嬩欢閫氱煡锛坋ventsUpdated锛? * 5. 纭繚鎵€鏈変簨浠跺垱寤鸿矾寰勶紙Timer銆乀imeCalendar銆丳lanManager锛夐兘缁忚繃缁熶竴澶勭悊
 */

import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { formatTimeForStorage } from '../utils/timeUtils';

// 鍚屾绠＄悊鍣ㄥ疄渚嬶紙灏嗗湪鍒濆鍖栨椂璁剧疆锛?let syncManagerInstance: any = null;

export class EventService {
  /**
   * 鍒濆鍖栨湇鍔★紝娉ㄥ叆鍚屾绠＄悊鍣?   */
  static initialize(syncManager: any) {
    syncManagerInstance = syncManager;
    console.log('鉁?[EventService] Initialized with sync manager');
  }

  /**
   * 鑾峰彇鎵€鏈変簨浠?   */
  static getAllEvents(): Event[] {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      console.error('鉂?[EventService] Failed to load events:', error);
      return [];
    }
  }

  /**
   * 鏍规嵁ID鑾峰彇浜嬩欢
   */
  static getEventById(eventId: string): Event | null {
    const events = this.getAllEvents();
    return events.find(e => e.id === eventId) || null;
  }

  /**
   * 鍒涘缓鏂颁簨浠?   * @param event - 浜嬩欢瀵硅薄
   * @param skipSync - 鏄惁璺宠繃鍚屾锛堥粯璁alse锛屾煇浜涘満鏅Timer杩愯涓彲璁句负true锛?   */
  static async createEvent(event: Event, skipSync: boolean = false): Promise<{ success: boolean; event?: Event; error?: string }> {
    try {
      console.log('鉃?[EventService] Creating event:', event.id);

      // 楠岃瘉蹇呭～瀛楁
      if (!event.id || !event.title || !event.startTime || !event.endTime) {
        const error = 'Event missing required fields';
        console.error('鉂?[EventService]', error, event);
        return { success: false, error };
      }

      // 纭繚蹇呰瀛楁
      const finalEvent: Event = {
        ...event,
        remarkableSource: true,
        syncStatus: skipSync ? 'local-only' : (event.syncStatus || 'pending'),
        createdAt: event.createdAt || formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date())
      };

      // 璇诲彇鐜版湁浜嬩欢
      const existingEvents = this.getAllEvents();

      // 妫€鏌ユ槸鍚﹀凡瀛樺湪
      const existingIndex = existingEvents.findIndex(e => e.id === event.id);
      if (existingIndex !== -1) {
        console.warn('鈿狅笍 [EventService] Event already exists, will update instead:', event.id);
        return this.updateEvent(event.id, finalEvent, skipSync);
      }

      // 娣诲姞鏂颁簨浠?      existingEvents.push(finalEvent);

      // 淇濆瓨鍒?localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      console.log('馃捑 [EventService] Event saved to localStorage');

      // 瑙﹀彂鍏ㄥ眬鏇存柊浜嬩欢
      this.dispatchEventUpdate(event.id, { isNewEvent: true, tags: event.tags });

      // 鍚屾鍒?Outlook锛堝鏋滀笉璺宠繃涓旀湁鍚屾绠＄悊鍣級
      if (!skipSync && syncManagerInstance && finalEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('create', 'event', finalEvent.id, finalEvent);
          console.log('✅ [EventService] Event synced to Outlook');
        } catch (syncError) {
          console.error('❌ [EventService] Sync failed (non-blocking):', syncError);
          // 同步失败不影响事件创建成功
        }
      } else {
        if (skipSync) {
          console.log('鈴笍 [EventService] Sync skipped (skipSync=true)');
        } else if (finalEvent.syncStatus === 'local-only') {
          console.log('鈴笍 [EventService] Sync skipped (syncStatus=local-only)');
        } else {
          console.warn('鈿狅笍 [EventService] Sync manager not initialized');
        }
      }

      return { success: true, event: finalEvent };
    } catch (error) {
      console.error('鉂?[EventService] Failed to create event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 鏇存柊浜嬩欢
   * @param eventId - 浜嬩欢ID
   * @param updates - 鏇存柊鍐呭锛堥儴鍒嗗瓧娈垫垨瀹屾暣浜嬩欢瀵硅薄锛?   * @param skipSync - 鏄惁璺宠繃鍚屾
   */
  static async updateEvent(
    eventId: string, 
    updates: Partial<Event> | Event, 
    skipSync: boolean = false
  ): Promise<{ success: boolean; event?: Event; error?: string }> {
    try {
      console.log('鉁忥笍 [EventService] Updating event:', eventId);

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        console.error('鉂?[EventService]', error);
        return { success: false, error };
      }

      const originalEvent = existingEvents[eventIndex];
      
      // 鍚堝苟鏇存柊
      const updatedEvent: Event = {
        ...originalEvent,
        ...updates,
        id: eventId, // 纭繚ID涓嶈瑕嗙洊
        updatedAt: formatTimeForStorage(new Date())
      };

      // 鏇存柊鏁扮粍
      existingEvents[eventIndex] = updatedEvent;

      // 淇濆瓨鍒?localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      console.log('馃捑 [EventService] Event updated in localStorage');

      // 瑙﹀彂鍏ㄥ眬鏇存柊浜嬩欢
      this.dispatchEventUpdate(eventId, { isUpdate: true, tags: updatedEvent.tags });

      // 鍚屾鍒?Outlook
      if (!skipSync && syncManagerInstance && updatedEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('update', 'event', eventId, updatedEvent, originalEvent);
          console.log('鉁?[EventService] Event update synced to Outlook');
        } catch (syncError) {
          console.error('鉂?[EventService] Sync failed (non-blocking):', syncError);
        }
      } else {
        if (skipSync) {
          console.log('鈴笍 [EventService] Sync skipped (skipSync=true)');
        } else if (updatedEvent.syncStatus === 'local-only') {
          console.log('鈴笍 [EventService] Sync skipped (syncStatus=local-only)');
        }
      }

      return { success: true, event: updatedEvent };
    } catch (error) {
      console.error('鉂?[EventService] Failed to update event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 鍒犻櫎浜嬩欢
   * @param eventId - 浜嬩欢ID
   * @param skipSync - 鏄惁璺宠繃鍚屾
   */
  static async deleteEvent(eventId: string, skipSync: boolean = false): Promise<{ success: boolean; error?: string }> {
    try {
      console.log('馃棏锔?[EventService] Deleting event:', eventId);

      const existingEvents = this.getAllEvents();
      const eventIndex = existingEvents.findIndex(e => e.id === eventId);

      if (eventIndex === -1) {
        const error = `Event not found: ${eventId}`;
        console.error('鉂?[EventService]', error);
        return { success: false, error };
      }

      const deletedEvent = existingEvents[eventIndex];

      // 浠庢暟缁勪腑绉婚櫎
      const updatedEvents = existingEvents.filter(e => e.id !== eventId);

      // 淇濆瓨鍒?localStorage
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      console.log('馃捑 [EventService] Event deleted from localStorage');

      // 瑙﹀彂鍏ㄥ眬鏇存柊浜嬩欢
      this.dispatchEventUpdate(eventId, { deleted: true });

      // 鍚屾鍒?Outlook
      if (!skipSync && syncManagerInstance && deletedEvent.syncStatus !== 'local-only') {
        try {
          await syncManagerInstance.recordLocalAction('delete', 'event', eventId, null, deletedEvent);
          console.log('鉁?[EventService] Event deletion synced to Outlook');
        } catch (syncError) {
          console.error('鉂?[EventService] Sync failed (non-blocking):', syncError);
        }
      } else {
        if (skipSync) {
          console.log('鈴笍 [EventService] Sync skipped (skipSync=true)');
        } else if (deletedEvent.syncStatus === 'local-only') {
          console.log('鈴笍 [EventService] Sync skipped (syncStatus=local-only)');
        }
      }

      return { success: true };
    } catch (error) {
      console.error('鉂?[EventService] Failed to delete event:', error);
      return { success: false, error: String(error) };
    }
  }

  /**
   * 鎵归噺鍒涘缓浜嬩欢锛堢敤浜庡鍏ユ垨杩佺Щ鍦烘櫙锛?   */
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

    console.log(`馃搳 [EventService] Batch create: ${created} created, ${failed} failed`);
    return { success: failed === 0, created, failed, errors };
  }

  /**
   * 瑙﹀彂鍏ㄥ眬浜嬩欢鏇存柊閫氱煡
   */
  private static dispatchEventUpdate(eventId: string, detail: any) {
    try {
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { eventId, ...detail }
      }));
      console.log('馃敂 [EventService] Dispatched eventsUpdated event:', eventId);
    } catch (error) {
      console.error('鉂?[EventService] Failed to dispatch event:', error);
    }
  }

  /**
   * 鑾峰彇鍚屾绠＄悊鍣ㄥ疄渚嬶紙鐢ㄤ簬澶栭儴璋冭瘯锛?   */
  static getSyncManager() {
    return syncManagerInstance;
  }

  /**
   * 妫€鏌ユ湇鍔℃槸鍚﹀凡鍒濆鍖?   */
  static isInitialized(): boolean {
    return syncManagerInstance !== null;
  }
}

// 鏆撮湶鍒板叏灞€鐢ㄤ簬璋冭瘯
if (typeof window !== 'undefined') {
  (window as any).EventService = EventService;
}
