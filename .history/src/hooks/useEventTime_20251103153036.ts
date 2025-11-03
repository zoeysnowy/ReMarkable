import { useEffect, useState } from 'react';
import { EventService } from '../services/EventService';
import { TimeSpec } from '../types/time';

export function useEventTime(eventId: string): { timeSpec?: TimeSpec; start?: string; end?: string; isAllDay?: boolean } {
  const [state, setState] = useState<{ timeSpec?: TimeSpec; start?: string; end?: string; isAllDay?: boolean }>(() => {
    const ev = EventService.getEventById(eventId);
    if (!ev) return {};
    return { timeSpec: (ev as any).timeSpec, start: ev.startTime, end: ev.endTime, isAllDay: ev.isAllDay };
  });

  useEffect(() => {
    const handler = () => {
      const ev = EventService.getEventById(eventId);
      if (!ev) return;
      setState({ timeSpec: (ev as any).timeSpec, start: ev.startTime, end: ev.endTime, isAllDay: ev.isAllDay });
    };

    const onEventsUpdated = (e: any) => {
      if (e?.detail?.eventId === eventId || e?.type === 'eventsUpdated') handler();
    };
    const onTimeChanged = (e: any) => {
      if (e?.detail?.eventId === eventId) handler();
    };

    window.addEventListener('eventsUpdated', onEventsUpdated as any);
    window.addEventListener('timeChanged', onTimeChanged as any);
    return () => {
      window.removeEventListener('eventsUpdated', onEventsUpdated as any);
      window.removeEventListener('timeChanged', onTimeChanged as any);
    };
  }, [eventId]);

  return state;
}
