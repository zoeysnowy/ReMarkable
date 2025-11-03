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

    // formatTimeForStorage returns local naive string "YYYY-MM-DDTHH:mm:ss"
    expect(spec!.window!.start).toBe('2025-11-10T00:00:00');
    expect(spec!.window!.end).toBe('2025-11-16T23:59:59');
  });

  it('parses "本周" as current week [Mon..Sun] window', () => {
    const now = new Date('2025-11-03T12:00:00'); // Monday
    const spec = parseToTimeSpec('本周', now, policy);
    expect(spec).toBeTruthy();
    expect(spec!.kind).toBe('window');
    expect(spec!.window!.start).toBe('2025-11-03T00:00:00');
    expect(spec!.window!.end).toBe('2025-11-09T23:59:59');
  });

  it('parses "上周" as previous week [Mon..Sun] window', () => {
    const now = new Date('2025-11-03T12:00:00'); // Monday
    const spec = parseToTimeSpec('上周', now, policy);
    expect(spec).toBeTruthy();
    expect(spec!.kind).toBe('window');
    expect(spec!.window!.start).toBe('2025-10-27T00:00:00');
    expect(spec!.window!.end).toBe('2025-11-02T23:59:59');
  });
});
