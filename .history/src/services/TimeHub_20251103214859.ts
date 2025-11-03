import { Event } from '../types';
import { TimeGetResult, TimeKind, TimePolicy, TimeSource, TimeSpec } from '../types/time';
import { EventService } from './EventService';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import { defaultTimePolicy } from '../config/time.config';
import { dbg } from '../utils/debugLogger';

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
        const id = e?.detail?.eventId as string | undefined;
        if (!id) return;
        // Invalidate and refresh lazily
        this.cache.delete(id);
        this.emit(id);
      } catch {}
    });
  }

  private emit(eventId: string) {
    const set = this.listeners.get(eventId);
    if (!set) return;
    set.forEach((cb) => {
      try { cb(); } catch { /* no-op */ }
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
      return { timeSpec, start, end };
    } catch {
      return {};
    }
  }

  async setEventTime(eventId: string, input: SetEventTimeInput): Promise<{ success: boolean; event?: Event; error?: string }> {
    this.init();
    dbg('timehub', 'setEventTime called', { eventId, input });
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

    const result = await EventService.updateEvent(eventId, updated);
    if (result.success && result.event) {
      // Update cache and notify
      const snapshot: TimeGetResult = {
        timeSpec,
        start: result.event.startTime,
        end: result.event.endTime,
      };
      this.cache.set(eventId, snapshot);
      dbg('timehub', 'setEventTime persisted and cached', { eventId, start: snapshot.start, end: snapshot.end, allDay: timeSpec?.allDay });
      this.emit(eventId);
      // Broadcast a generic timeChanged event for any external listeners
      try {
        window.dispatchEvent(new CustomEvent('timeChanged', {
          detail: { eventId, timeSpec, start: snapshot.start, end: snapshot.end }
        }));
      } catch {}
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
      this.emit(eventId);
      try {
        window.dispatchEvent(new CustomEvent('timeChanged', {
          detail: { eventId, timeSpec, start: snapshot.start, end: snapshot.end }
        }));
      } catch {}
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
      this.emit(eventId);
      try {
        window.dispatchEvent(new CustomEvent('timeChanged', {
          detail: { eventId, timeSpec, start: snapshot.start, end: snapshot.end }
        }));
      } catch {}
    }
    return result;
  }
}

export const TimeHub = new TimeHubImpl();
