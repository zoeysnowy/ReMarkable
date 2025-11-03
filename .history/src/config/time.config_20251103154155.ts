import { TimePolicy } from '../types/time';

// Default policy aligned with local-time storage and Monday as week start
export const defaultTimePolicy: TimePolicy = {
  defaultTimeOfDay: '09:00',
  weekStart: 'mon', // Monday
  windowResolution: 'snap-to-start',
};
