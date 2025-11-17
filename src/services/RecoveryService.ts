import { STORAGE_KEYS } from '../constants/storage';
import type { Event } from '../types';
import { TagService } from './TagService';
import { formatTimeForStorage } from '../utils/timeUtils';

export const RecoveryService = {
  recoverPlanItemsFromEvents(): Event[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!raw) return [];
      const events = JSON.parse(raw) as any[];
      // 🔧 修复：使用 formatTimeForStorage 保持一致性
      const now = formatTimeForStorage(new Date());
      const items: Event[] = events.map((ev) => ({
        id: ev.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        title: ev.title || ev.eventTitle || '未命名',
        content: ev.description,
        description: ev.description,
        tags: ev.tags || (ev.tagId ? [ev.tagId] : []),
        priority: 'medium',
        isCompleted: false,
        isTask: !!ev.isTask,
        type: ev.isTask ? 'task' : 'event',
        level: 0,
        mode: ev.description ? 'eventlog' : 'title',
        // 必需的 Event 字段
        startTime: ev.startTime || now,
        endTime: ev.endTime || now,
        isAllDay: ev.isAllDay ?? false,
        createdAt: ev.createdAt || now,
        updatedAt: ev.updatedAt || now,
      }));
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(items));
      return items;
    } catch (e) {
      console.error('[RecoveryService] Failed to recover from events:', e);
      return [];
    }
  },

  async ensureDefaultTags(): Promise<void> {
    try {
      await TagService.initialize();
      const tags = TagService.getTags();
      if (!tags || tags.length === 0) {
        // reinitialize to create defaults
        await TagService.reinitialize?.();
      }
    } catch (e) {
      console.error('[RecoveryService] ensureDefaultTags error:', e);
    }
  }
};
