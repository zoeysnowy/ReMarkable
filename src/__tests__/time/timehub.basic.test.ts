import { EventService } from '../../services/EventService';
import { TimeHub } from '../../services/TimeHub';
import { formatTimeForStorage } from '../../utils/timeUtils';

const EVENTS_KEY = '4dnote-events';

describe('TimeHub basic set/get/subscribe', () => {
  beforeEach(() => {
    // Clear events storage
    localStorage.removeItem(EVENTS_KEY);
  });

  test('setEventTime updates event and notifies subscribers', async () => {
    // Seed an event
    const eventId = 'e1';
    await EventService.createEvent({
      id: eventId,
      title: 'Test',
      startTime: formatTimeForStorage(new Date(2025, 9, 20, 9, 0, 0)),
      endTime: formatTimeForStorage(new Date(2025, 9, 20, 10, 0, 0)),
      isAllDay: false,
      tags: [],
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date())
    } as any, true);

    // Subscribe
    let calls = 0;
    const unsub = TimeHub.subscribe(eventId, () => { calls += 1; });

    // Update via TimeHub
    const start = '2025-10-21T09:30:00';
    const end = '2025-10-21T10:30:00';
    const result = await TimeHub.setEventTime(eventId, { start, end });
    expect(result.success).toBe(true);

    // Snapshot reflects update
    const snap = TimeHub.getSnapshot(eventId);
    expect(snap.start).toBe(start);
    expect(snap.end).toBe(end);
    expect(snap.timeSpec).toBeTruthy();

    // Subscriber called at least once
    expect(calls).toBeGreaterThan(0);

    unsub();
  });

  test('setTimerWindow updates locally and marks isTimer', async () => {
    const eventId = 'e2';
    await EventService.createEvent({
      id: eventId,
      title: 'Timer Event',
      startTime: formatTimeForStorage(new Date(2025, 9, 20, 9, 0, 0)),
      endTime: formatTimeForStorage(new Date(2025, 9, 20, 9, 15, 0)),
      isAllDay: false,
      tags: [],
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date())
    } as any, true);

    const start = '2025-10-21T10:00:00';
    const end = '2025-10-21T10:05:00';
    const res = await TimeHub.setTimerWindow(eventId, { start, end });
    expect(res.success).toBe(true);

    const ev = EventService.getEventById(eventId)!;
    expect(ev.startTime).toBe(start);
    expect(ev.endTime).toBe(end);
    expect((ev as any).timeSpec?.source).toBe('timer');
    expect(ev.isTimer).toBe(true);
  });
});
