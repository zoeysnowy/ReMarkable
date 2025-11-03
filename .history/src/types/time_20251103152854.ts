// Unified time model for events across the app

export type TimeKind = 'fixed' | 'range' | 'all-day' | 'deadline' | 'window' | 'fuzzy';

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

export interface TimeSpec {
  kind: TimeKind;
  allDay?: boolean;
  timezone?: string; // optional, default to local
  source?: TimeSource;
  rawText?: string; // original natural language text if any
  // When fuzzy/window is resolved for storage/sync/rendering
  resolved?: TimeResolved;
  // When the intent is a window (e.g., 下周、本周、上周)
  window?: TimeWindow;
  // Optional per-item overrides
  policy?: Partial<TimePolicy>;
}

export type WithTimeSpec<T> = T & { timeSpec?: TimeSpec };
