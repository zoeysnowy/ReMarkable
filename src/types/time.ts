/**
 * Unified time model for events across the app.
 * Designed to preserve user intent (e.g., "下周") while also
 * producing normalized start/end for calendars and sync.
 */

export type TimeKind =
  | 'fixed'       // exact datetime (start==end or short range semantics)
  | 'range'       // explicit start/end range
  | 'all-day'     // all-day event on specific date(s)
  | 'deadline'    // due-by moment; UI may treat as single instant
  | 'window'      // flexible window (e.g., next week Mon..Sun)
  | 'fuzzy';      // unresolved or natural text awaiting resolution

export type TimeSource = 'picker' | 'parser' | 'timer' | 'import' | 'system';

export type WindowResolution = 'window-only' | 'snap-to-start' | 'snap-to-end';

// Policy used to resolve fuzzy/window specs into concrete start/end used for storage/sync
export interface TimePolicy {
  // HH:mm in 24h format, e.g., '09:00'
  defaultTimeOfDay?: string;
  // 0 = Sunday, 1 = Monday
  weekStart?: 0 | 1;
  // How to resolve window/fuzzy to concrete start/end
  windowResolution?: WindowResolution;
  // Optional timezone label (storage remains local-time ISO without TZ)
  timezone?: string;
}

export interface TimeResolved {
  // Local-time ISO-like string without timezone (consistent with timeUtils.formatTimeForStorage)
  start?: string;
  end?: string;
}

export interface TimeWindow {
  // Window bounds in local-time ISO-like strings (start inclusive, end inclusive)
  start?: string;
  end?: string;
  label?: string; // e.g., '下周', '本周'
}

/**
 * A flexible time specification that captures intent and normalized results.
 */
export interface TimeSpec {
  kind: TimeKind;

  // Intent/semantic inputs
  rawText?: string;         // original natural language input, e.g., "下周"
  source?: TimeSource;      // where it came from
  // Optional per-item overrides
  policy?: Partial<TimePolicy>;

  // Normalized values for storage/sync (local-time ISO without timezone suffix)
  start?: string;           // normalized start (e.g., '2025-11-10T09:00:00')
  end?: string;             // normalized end   (e.g., '2025-11-10T10:00:00' or window end)

  // Additional flags
  allDay?: boolean;         // convenience flag for UI
  timezone?: string;        // optional TZ label for future portability

  // For windows/fuzzy, keep the computed bounds without losing intent
  resolved?: TimeResolved;  // computed start/end for display/sync decisions
  window?: TimeWindow;      // when the intent is a window (e.g., 下周、本周、上周)
}

export interface TimeGetResult {
  timeSpec?: TimeSpec;
  start?: string;
  end?: string;
  displayHint?: string | null; // 🆕 v1.1: 模糊时间表述
}

export type WithTimeSpec<T> = T & { timeSpec?: TimeSpec };
