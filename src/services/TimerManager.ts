import { Event, GlobalTimer } from '../types';
import { formatTimeForStorage } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';
import { TagService } from './TagService';

type SetGlobalTimer = React.Dispatch<React.SetStateAction<GlobalTimer | null>>;
type SetAllEvents = React.Dispatch<React.SetStateAction<Event[]>>;

export class TimerManager {
  private setGlobalTimer: SetGlobalTimer;
  private setAllEvents: SetAllEvents;

  constructor(setGlobalTimer: SetGlobalTimer, setAllEvents: SetAllEvents) {
    this.setGlobalTimer = setGlobalTimer;
    this.setAllEvents = setAllEvents;
  }

  start(taskTitle: string = '') {
    const tag = TagService.getFlatTags().find(t => t.id === 'work-project'); // Default tag
    if (!tag) {
      console.error('Default tag not found');
      return;
    }
    this.setGlobalTimer({
      isRunning: true,
      tagId: tag.id,
      startTime: Date.now(),
      elapsedTime: 0,
      isPaused: false,
      eventTitle: taskTitle,
    });
  }

  pause() {
    this.setGlobalTimer((prev: GlobalTimer | null) => {
      if (!prev) return null;
      const currentElapsed = prev.elapsedTime + (Date.now() - prev.startTime);
      return { ...prev, isRunning: false, elapsedTime: currentElapsed };
    });
  }

  stop() {
    this.setGlobalTimer((prev: GlobalTimer | null) => {
      if (!prev) return null;
      const totalElapsed = prev.elapsedTime + (prev.isRunning ? (Date.now() - prev.startTime) : 0);
      const endTime = new Date();
      const startTime = new Date(endTime.getTime() - totalElapsed);
      const tag = TagService.getTagById(prev.tagId!);
      const newEvent: Event = {
        id: `timer-${Date.now()}`,
        title: prev.eventTitle || tag?.name || 'Unnamed Task',
        startTime: formatTimeForStorage(startTime),
        endTime: formatTimeForStorage(endTime),
        tags: [prev.tagId!],
        description: `Focused for ${Math.floor(totalElapsed / 60000)} minutes.`,
        isAllDay: false,
        isTimer: true,
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date()),
      };

      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const allEvents = savedEvents ? JSON.parse(savedEvents) : [];
      allEvents.push(newEvent);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(allEvents));
      this.setAllEvents(allEvents);

      return null;
    });
  }

  cancel() {
    if (window.confirm('Are you sure you want to cancel this timer?')) {
      this.setGlobalTimer(null);
    }
  }

  updateStartTime(newStartTime: number) {
    this.setGlobalTimer((prev: GlobalTimer | null) => {
      if (!prev) return null;
      const now = Date.now();
      const oldStartTime = prev.startTime;
      const timeDiff = oldStartTime - newStartTime;

      if (prev.isRunning) {
        const currentTotalElapsed = prev.elapsedTime + (now - oldStartTime);
        const newElapsedTime = currentTotalElapsed + timeDiff;
        return { ...prev, startTime: now, elapsedTime: newElapsedTime };
      } else {
        const newElapsedTime = prev.elapsedTime + timeDiff;
        return { ...prev, elapsedTime: Math.max(0, newElapsedTime) };
      }
    });
  }
}
