import { EventService } from './EventService';
import { defaultTimePolicy } from '../config/time.config';
import { TimePolicy, TimeSpec } from '../types/time';
import { Event } from '../types';
import { formatTimeForStorage } from '../utils/timeUtils';
import { parseToTimeSpec } from './TimeParsingService';

type Listener = (evt: { eventId: string; prev?: TimeSpec; next?: TimeSpec }) => void;

const listeners = new Set<Listener>();

function dispatch(eventId: string, prev?: TimeSpec, next?: TimeSpec) {
  const payload = { eventId, prev, next };
  listeners.forEach((l) => {
    try { l(payload); } catch {}
  });
  try {
    window.dispatchEvent(new CustomEvent('timeChanged', { detail: payload }));
  } catch {}
}

function mergePolicy(a?: Partial<TimePolicy>, b?: Partial<TimePolicy>): TimePolicy {
  return { ...defaultTimePolicy, ...(a ?? {}), ...(b ?? {}) } as TimePolicy;
}

function parseHHmm(hhmm?: string): { h: number; m: number } {
  if (!hhmm) return { h: 9, m: 0 };
  const [h, m] = hhmm.split(':').map((n) => parseInt(n, 10));
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function applyResolution(spec: TimeSpec, policy: TimePolicy): { start?: string; end?: string; isAllDay?: boolean } {
  // If already resolved fully, return as-is
  if (spec.resolved?.start || spec.resolved?.end) {
    return { start: spec.resolved.start, end: spec.resolved.end, isAllDay: spec.allDay };
  }
  // Window to concrete per policy
  if (spec.kind === 'window' && spec.window) {
    const res = policy.windowResolution ?? 'snap-to-start';
    if (res === 'window-only') {
      // Provide a non-intrusive default concrete time for storage compatibility (start of window at default time)
      const { h, m } = parseHHmm(policy.defaultTimeOfDay ?? '09:00');
      if (spec.window.start) {
        const date = new Date(spec.window.start.replace('T', ' ') + ':00');
        date.setHours(h, m, 0, 0);
        return { start: formatTimeForStorage(date), end: undefined, isAllDay: false };
      }
      return {};
    }
    if (res === 'snap-to-end' && spec.window.end) {
      return { start: spec.window.end, end: undefined, isAllDay: false };
    }
    if (spec.window.start) {
      return { start: spec.window.start, end: undefined, isAllDay: false };
    }
  }
  return { start: undefined, end: undefined, isAllDay: spec.allDay };
}

export const TimeHub = {
  // Read latest from EventService
  getEventTime(eventId: string): { timeSpec?: TimeSpec; start?: string; end?: string; isAllDay?: boolean } {
    const ev = EventService.getEventById(eventId);
    if (!ev) return {};
    const spec = (ev as Event).timeSpec;
    return { timeSpec: spec, start: ev.startTime, end: ev.endTime, isAllDay: ev.isAllDay };
  },

  // Set/merge TimeSpec and write back normalized start/end consistent with timeUtils
  async setEventTime(
    eventId: string,
    nextSpecOrPatch: TimeSpec | Partial<TimeSpec>,
    options?: { policyOverride?: Partial<TimePolicy>; skipSync?: boolean }
  ) {
    const ev = EventService.getEventById(eventId);
    if (!ev) throw new Error(`Event not found: ${eventId}`);
    const prev = (ev as Event).timeSpec;

    const policy = mergePolicy(prev?.policy, options?.policyOverride);
    const nextSpec: TimeSpec = {
      ...(prev ?? { kind: 'fixed' as const }),
      ...(nextSpecOrPatch as any),
      policy,
    };

    // Resolve to concrete values for storage/sync
    const resolved = applyResolution(nextSpec, policy);
    const updates: Partial<Event> = {
      timeSpec: nextSpec,
    } as any;

    if (resolved.start) updates.startTime = resolved.start;
    if (resolved.end) updates.endTime = resolved.end;
    if (typeof resolved.isAllDay === 'boolean') updates.isAllDay = resolved.isAllDay;

    await EventService.updateEvent(eventId, updates, options?.skipSync ?? false);
    dispatch(eventId, prev, nextSpec);
  },

  async setFuzzy(eventId: string, text: string, options?: { policyOverride?: Partial<TimePolicy>; skipSync?: boolean }) {
    const policy = mergePolicy(undefined, options?.policyOverride);
    const spec = parseToTimeSpec(text, new Date(), policy);
    if (!spec) throw new Error('Unable to parse time text');
    await this.setEventTime(eventId, spec, options);
  },

  subscribe(listener: Listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};
