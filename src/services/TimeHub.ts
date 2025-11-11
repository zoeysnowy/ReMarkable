import { Event } from '../types';
import { TimeGetResult, TimeKind, TimePolicy, TimeSource, TimeSpec } from '../types/time';
import { EventService } from './EventService';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import { defaultTimePolicy } from '../config/time.config';
import { dbg, error } from '../utils/debugLogger';

// Lightweight TimeHub: single source of truth for event time intents and normalized values
// - getEventTime(eventId)
// - setEventTime(eventId, payload)
// - setFuzzy(eventId, rawText, options)
// - subscribe(eventId, cb)

export type SetEventTimeInput = {
  start?: string | Date;
  end?: string | Date;
  kind?: TimeKind;
  allDay?: boolean;
  source?: TimeSource;
  policy?: Partial<TimePolicy>;
  rawText?: string; // optional when updating intent
  timeSpec?: TimeSpec; // allow direct replacement
  displayHint?: string | null; // 🆕 v1.1: 用户原始输入的模糊时间表述
};

class TimeHubImpl {
  private cache = new Map<string, TimeGetResult>();
  private listeners = new Map<string, Set<() => void>>();
  private inited = false;

  private init() {
    if (this.inited) return;
    this.inited = true;

    // Bootstrap by touching the events store so local cache is warm
    try {
      EventService.getAllEvents();
    } catch {}

    // Keep cache in sync with global event updates
    window.addEventListener('eventsUpdated', (e: any) => {
      try {
        const detail = e?.detail;
        const id = detail?.eventId as string | undefined;
        if (!id) return;
        
        // 🔧 优化：如果事件被删除，直接清除缓存但不通知订阅者
        // 原因：被删除的事件不需要触发组件重新渲染，TimeCalendar 已经处理了 UI 更新
        if (detail?.deleted || detail?.isDeleted) {
          this.cache.delete(id);
          dbg('timehub', '🗑️ 事件已删除，清除缓存但跳过通知订阅者', { eventId: id });
          return;
        }
        
        // 🚀 增量更新：如果 detail 包含完整事件数据，直接更新缓存，避免重新读取
        if (detail?.event) {
          const event = detail.event;
          const snapshot: TimeGetResult = {
            timeSpec: event.timeSpec,
            start: event.startTime,
            end: event.endTime,
          };
          this.cache.set(id, snapshot);
          dbg('timehub', '🔄 从 eventsUpdated 增量更新缓存', { eventId: id, start: snapshot.start, end: snapshot.end });
          this.emit(id);
        } else {
          // 降级：如果没有完整事件数据，清除缓存让组件重新读取
          this.cache.delete(id);
          dbg('timehub', '⚠️ 缺少事件数据，清除缓存并通知订阅者重新读取', { eventId: id });
          this.emit(id);
        }
      } catch {}
    });
  }

  private emit(eventId: string) {
    const set = this.listeners.get(eventId);
    console.log(`%c[🔔 TimeHub.emit]`, 'background: #9C27B0; color: white; padding: 2px 6px;', {
      eventId,
      订阅者数量: set?.size ?? 0,
      hasListeners: !!set
    });
    if (!set) return;
    set.forEach((cb) => {
      try { 
        console.log(`%c[📞 调用订阅者]`, 'background: #673AB7; color: white; padding: 2px 6px;', { eventId });
        cb(); 
      } catch (err) { 
        console.error(`%c[❌ 订阅者回调失败]`, 'background: #F44336; color: white; padding: 2px 6px;', { eventId, error: err });
      }
    });
  }

  subscribe(eventId: string, cb: () => void): () => void {
    this.init();
    let set = this.listeners.get(eventId);
    if (!set) {
      set = new Set();
      this.listeners.set(eventId, set);
    }
    set.add(cb);
    return () => {
      set!.delete(cb);
      if (set!.size === 0) this.listeners.delete(eventId);
    };
  }

  getSnapshot(eventId: string): TimeGetResult {
    this.init(); // 🔧 Issue #11 修复：确保初始化监听器
    const cached = this.cache.get(eventId);
    if (cached) {
      dbg('timehub', '📦 返回缓存的快照', { eventId, start: cached.start, end: cached.end });
      return cached;
    }
    const res = this.loadFromEventService(eventId);
    this.cache.set(eventId, res);
    dbg('timehub', '🔍 冷加载快照 (首次getSnapshot)', { eventId, start: res.start, end: res.end, timeSpec: res.timeSpec });
    return res;
  }

  private loadFromEventService(eventId: string): TimeGetResult {
    try {
      const ev = EventService.getEventById(eventId);
      if (!ev) return {};
      const start = ev.startTime;
      const end = ev.endTime;
      const timeSpec = (ev as any).timeSpec as TimeSpec | undefined;
      const displayHint = (ev as any).displayHint as string | null | undefined; // 🆕 v1.1
      return { timeSpec, start, end, displayHint };
    } catch {
      return {};
    }
  }

  async setEventTime(
    eventId: string, 
    input: SetEventTimeInput, 
    options: { skipSync?: boolean } = {}
  ): Promise<{ success: boolean; event?: Event; error?: string }> {
    this.init();
    const { skipSync = false } = options;
    
    // 🔍 [DEBUG-TIMER] 额外日志
    dbg('timehub', '📥 收到 setEventTime 调用', { 
      eventId, 
      输入start: input.start, 
      输入end: input.end,
      kind: input.kind,
      allDay: input.allDay,
      source: input.source,
      skipSync
    });
    // Prefer explicit timeSpec replacement
    let timeSpec: TimeSpec | undefined = input.timeSpec;

    // Normalize start/end into local-time ISO
    const normalize = (v?: string | Date) => {
      if (!v) return undefined;
      const d = v instanceof Date ? v : parseLocalTimeString(v);
      return formatTimeForStorage(d);
    };

    const start = normalize(input.start);
    const end = normalize(input.end ?? input.start);

    dbg('timehub', '🔄 标准化后的时间', { 
      标准化start: start,
      标准化end: end
    });

    if (!timeSpec) {
      const policy: TimePolicy = { ...defaultTimePolicy, ...(input.policy ?? {}) };
      const kind: TimeKind = input.kind ?? (start && end && start !== end ? 'range' : 'fixed');
      timeSpec = {
        kind,
        rawText: input.rawText,
        source: input.source ?? 'picker',
        policy,
        start,
        end,
        allDay: input.allDay,
        resolved: { start, end },
      };
    }

    // Merge and persist via EventService
    const existing = EventService.getEventById(eventId);
    if (!existing) {
      error('timehub', '❌ 事件不存在', { eventId });
      return { success: false, error: `Event not found: ${eventId}` };
    }

    const updated: Partial<Event> = {
      startTime: timeSpec.start ?? existing.startTime,
      endTime: timeSpec.end ?? existing.endTime,
      isAllDay: timeSpec.allDay ?? existing.isAllDay,
      updatedAt: formatTimeForStorage(new Date()),
    } as any;

    // Attach timeSpec (non-breaking)
    (updated as any).timeSpec = timeSpec;
    
    // 🆕 v1.1: 保存 displayHint（模糊时间表述）
    if (input.displayHint !== undefined) {
      (updated as any).displayHint = input.displayHint;
    }

    dbg('timehub', '💾 准备持久化到 EventService', { 
      eventId, 
      更新的startTime: updated.startTime,
      更新的endTime: updated.endTime,
      isAllDay: updated.isAllDay,
      skipSync
    });

    const result = await EventService.updateEvent(eventId, updated, skipSync);
    if (result.success && result.event) {
      // Update cache and notify
      const snapshot: TimeGetResult = {
        timeSpec,
        start: result.event.startTime,
        end: result.event.endTime,
      };
      this.cache.set(eventId, snapshot);
      dbg('timehub', '✅ 持久化成功，缓存已更新，准备通知订阅者', { 
        eventId, 
        快照start: snapshot.start, 
        快照end: snapshot.end, 
        allDay: timeSpec?.allDay,
        订阅者数量: this.listeners.get(eventId)?.size ?? 0
      });
      
      // 🔧 Issue #11 修复：使用 queueMicrotask 确保订阅者在下一个微任务中收到通知
      // 这样可以避免 React 18 的批量更新导致的延迟
      queueMicrotask(() => {
        this.emit(eventId);
      });
      
      // ✅ 架构优化：EventService 已经触发了 eventsUpdated 事件
      // 不需要 TimeHub 再触发 timeChanged，避免重复事件
      // 订阅者可以监听 eventsUpdated 获取时间变化信息
    } else {
      error('timehub', '❌ EventService.updateEvent 失败', { eventId, result });
    }
    return result;
  }

  // Set fuzzy intent (e.g., rawText: "下周"), without resolving to concrete times.
  async setFuzzy(eventId: string, rawText: string, options?: { source?: TimeSource; policy?: Partial<TimePolicy> }) {
    this.init();
    const existing = EventService.getEventById(eventId);
    if (!existing) return { success: false, error: `Event not found: ${eventId}` };
    const policy: TimePolicy = { ...defaultTimePolicy, ...(options?.policy ?? {}) };

    const timeSpec: TimeSpec = {
      kind: 'fuzzy',
      rawText,
      source: options?.source ?? 'parser',
      policy,
      // No resolved bounds yet
    } as TimeSpec;

    const result = await EventService.updateEvent(eventId, { ...(existing as any), timeSpec });
    if (result.success && result.event) {
      const snapshot: TimeGetResult = {
        timeSpec,
        start: result.event.startTime,
        end: result.event.endTime,
      };
      this.cache.set(eventId, snapshot);
      
      // 🔧 Issue #11 修复：使用 queueMicrotask 确保订阅者及时收到通知
      queueMicrotask(() => {
        this.emit(eventId);
      });
      
      // ✅ 架构优化：EventService 已经触发了 eventsUpdated 事件
      // 不需要 TimeHub 再触发 timeChanged
    }
    return result;
  }

  // Timer helper: update an event's time from a running timer without triggering external sync.
  // Useful for realtime UI; persisted locally and broadcast via eventsUpdated/timeChanged.
  async setTimerWindow(
    eventId: string,
    input: { start?: string | Date; end?: string | Date; allDay?: boolean; policy?: Partial<TimePolicy> }
  ) {
    this.init();
    const existing = EventService.getEventById(eventId);
    if (!existing) return { success: false, error: `Event not found: ${eventId}` };

    const normalize = (v?: string | Date) => {
      if (!v) return undefined;
      const d = v instanceof Date ? v : parseLocalTimeString(v);
      return formatTimeForStorage(d);
    };

    const start = normalize(input.start);
    const end = normalize(input.end ?? input.start);
    const policy: TimePolicy = { ...defaultTimePolicy, ...(input.policy ?? {}) };

    const timeSpec: TimeSpec = {
      kind: start && end && start !== end ? 'range' : 'fixed',
      source: 'timer',
      policy,
      start,
      end,
      allDay: input.allDay,
      resolved: { start, end },
    };

    const updated: Partial<Event> = {
      startTime: timeSpec.start ?? existing.startTime,
      endTime: timeSpec.end ?? existing.endTime,
      isAllDay: timeSpec.allDay ?? existing.isAllDay,
      isTimer: true,
      updatedAt: formatTimeForStorage(new Date()),
    } as any;
    (updated as any).timeSpec = timeSpec;

    // Skip external sync to avoid frequent updates, but still update local store and notify listeners.
    const result = await EventService.updateEvent(eventId, updated, true /* skipSync */);
    if (result.success && result.event) {
      const snapshot: TimeGetResult = { timeSpec, start: result.event.startTime, end: result.event.endTime };
      this.cache.set(eventId, snapshot);
      
      // 🔧 Issue #11 修复：使用 queueMicrotask 确保订阅者及时收到通知
      queueMicrotask(() => {
        this.emit(eventId);
      });
      
      // ✅ 架构优化：EventService 已经触发了 eventsUpdated 事件
      // 不需要 TimeHub 再触发 timeChanged
    }
    return result;
  }
}

export const TimeHub = new TimeHubImpl();
