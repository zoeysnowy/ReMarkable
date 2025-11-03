# Unified Time Architecture

This document outlines the unified time model and integration strategy used across the app. The goal is: any component that changes one event’s time immediately updates all others consistently, while preserving the original user intent (e.g., "下周").

## Core concepts

- TimeSpec
  - Captures both intent and normalized values.
  - Fields:
    - kind: 'fixed' | 'range' | 'all-day' | 'deadline' | 'window' | 'fuzzy'
    - source: 'picker' | 'parser' | 'timer' | 'import' | 'system'
    - rawText: original text (e.g., "下周")
    - policy: overrides (weekStart, defaultTimeOfDay, windowResolution)
    - resolved: { start, end } used for display/sync decisions
    - window: { start, end, label } for window-type intents
    - start/end/allDay: normalized values for storage

- TimePolicy
  - Default policy lives in `src/config/time.config.ts`.
  - weekStart: 0 (Sun) | 1 (Mon) — default 1
  - windowResolution: 'snap-to-start' | 'snap-to-end' | 'window-only'
  - defaultTimeOfDay: e.g., '09:00'

- TimeHub (src/services/TimeHub.ts)
  - The single source of truth for event time. Holds the latest TimeSpec for each event and orchestrates reads/writes.
  - API:
    - subscribe(eventId): subscribe to updates
    - getSnapshot(eventId): current TimeSpec + normalized times
    - setEventTime(eventId, input): set fixed/range/all-day times
    - setFuzzy(eventId, rawText, options?): parse and apply natural language times via TimeParsingService
  - Integrates with EventService to persist time + TimeSpec onto events and dispatches `timeChanged` for UI updates.

- useEventTime (src/hooks/useEventTime.ts)
  - React hook providing a stable, per-event subscription via `useSyncExternalStore`.
  - Returns a snapshot of TimeSpec + normalized times, and `setEventTime` to update through TimeHub.
  - When `eventId` is missing, returns a frozen empty snapshot to avoid update loops.

- TimeParsingService (src/services/TimeParsingService.ts)
  - Parses natural language into TimeSpec.
  - Special handling for Chinese week windows: "下周/本周/上周" → window with Mon..Sun bounds (policy-aware `weekStart`).
  - Unit tests live in `src/__tests__/time/parsing.cn.week.test.ts`.

## Integration patterns

- Components that edit time should:
  - Prefer passing `eventId` and `useTimeHub={true}` (e.g., UnifiedDateTimePicker, DateMentionPicker, EventEditModal).
  - Call `TimeHub.setEventTime` or `TimeHub.setFuzzy` to update a single canonical Event.
  - For UI consistency, still render local visuals (e.g., date pill) but rely on TimeHub for the underlying data.

- PlanItem ↔ Event unification
  - Event is the canonical record for business fields including time.
  - PlanItem is a view over Event and should reference `eventId`.
  - If a PlanItem doesn’t have `eventId` yet, first apply the time action, then create a new Event via EventService and write back `eventId` to the PlanItem.

## Edge cases and guarantees

- Missing eventId
  - Pickers still allow selection; upon apply, the parent handler should create an Event, persist time via EventService/TimeHub, then write back `eventId`.

- Window vs. concrete start/end
  - Windows keep intent via `spec.window` while `spec.resolved` provides a concrete `start` for display/sync based on policy.

- All-day vs time-of-day
  - All-day events set `allDay=true` and normalize start/end to midnight ranges in local time.

## Developer checklist (for time-enabled features)

- [ ] Pass `eventId` and `useTimeHub={true}` when available
- [ ] Use `useEventTime(eventId)` for reading live snapshots
- [ ] Write via `TimeHub.setEventTime` / `setFuzzy` instead of mutating local state
- [ ] For new PlanItems, create/update Event and attach `eventId`
- [ ] Keep UI decorations (e.g., date pills) in sync with the snapshot
- [ ] Add tests for new parsing or resolution rules

## Future work

- Timer integration helpers in TimeHub (focus-session windows)
- Broader tests (TimeHub subscribe/set flows, EventService mocks)
- Progressive migration to treat PlanItem purely as a view over Event
