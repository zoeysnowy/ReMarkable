import { parseToTimeSpec } from '../../services/TimeParsingService';
import { defaultTimePolicy } from '../../config/time.config';

describe('TimeParsingService - Chinese week windows', () => {
  const policy = defaultTimePolicy; // weekStart=1 (Mon) by default

  it('parses "下周" as next week [Mon..Sun] window with label', () => {
    const now = new Date('2025-11-03T12:00:00'); // Monday
    const spec = parseToTimeSpec('下周', now, policy);
    expect(spec).toBeTruthy();
    expect(spec!.kind).toBe('window');
    expect(spec!.window).toBeTruthy();
    expect(spec!.window!.label).toBe('下周');

    // Expect next Monday 00:00 to next Sunday 23:59:59.999 (local)
    const expectedStart = new Date('2025-11-10T00:00:00');
    const expectedEnd = new Date('2025-11-16T23:59:59.999');

    expect(spec!.window!.start).toBe(
      expectedStart.toISOString().slice(0, 23) + 'Z' // formatTimeForStorage outputs toISOString without timezone conversion in tests
    );
    expect(spec!.window!.end).toBe(
      expectedEnd.toISOString().slice(0, 23) + 'Z'
    );
  });

  it('parses "本周" as current week [Mon..Sun] window', () => {
    const now = new Date('2025-11-03T12:00:00'); // Monday
    const spec = parseToTimeSpec('本周', now, policy);
    expect(spec).toBeTruthy();
    expect(spec!.kind).toBe('window');
    const expectedStart = new Date('2025-11-03T00:00:00');
    const expectedEnd = new Date('2025-11-09T23:59:59.999');
    expect(spec!.window!.start).toBe(
      expectedStart.toISOString().slice(0, 23) + 'Z'
    );
    expect(spec!.window!.end).toBe(
      expectedEnd.toISOString().slice(0, 23) + 'Z'
    );
  });

  it('parses "上周" as previous week [Mon..Sun] window', () => {
    const now = new Date('2025-11-03T12:00:00'); // Monday
    const spec = parseToTimeSpec('上周', now, policy);
    expect(spec).toBeTruthy();
    expect(spec!.kind).toBe('window');
    const expectedStart = new Date('2025-10-27T00:00:00');
    const expectedEnd = new Date('2025-11-02T23:59:59.999');
    expect(spec!.window!.start).toBe(
      expectedStart.toISOString().slice(0, 23) + 'Z'
    );
    expect(spec!.window!.end).toBe(
      expectedEnd.toISOString().slice(0, 23) + 'Z'
    );
  });
});
