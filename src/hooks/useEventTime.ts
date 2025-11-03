import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { TimeHub } from '../services/TimeHub';
import { TimeGetResult, TimeSpec } from '../types/time';

export interface UseEventTimeResult extends TimeGetResult {
  loading: boolean;
  setEventTime: (spec: Partial<TimeSpec> & { start?: string | Date; end?: string | Date }) => Promise<void>;
}

// Stable empty snapshot to avoid identity changes causing infinite updates
const EMPTY_SNAPSHOT: Readonly<TimeGetResult> = Object.freeze({});

export function useEventTime(eventId: string | undefined): UseEventTimeResult {
  const subscribe = useCallback((onChange: () => void) => {
    if (!eventId) return () => {};
    return TimeHub.subscribe(eventId, onChange);
  }, [eventId]);

  const getSnapshot = useCallback(() => {
    if (!eventId) return EMPTY_SNAPSHOT as TimeGetResult;
    return TimeHub.getSnapshot(eventId);
  }, [eventId]);

  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const setEventTime = useCallback(async (spec: Partial<TimeSpec> & { start?: string | Date; end?: string | Date }) => {
    if (!eventId) return;
    await TimeHub.setEventTime(eventId, spec as any);
  }, [eventId]);

  // A naive loading heuristic: first snapshot may be empty until first read
  const loading = useMemo(() => !snapshot || (!snapshot.start && !snapshot.end && !snapshot.timeSpec), [snapshot]);

  return {
    ...snapshot,
    loading,
    setEventTime,
  };
}
