import { STORAGE_KEYS } from '../constants/storage';
import { PlanItem } from '../components/PlanManager';
import { TagService } from './TagService';

export const RecoveryService = {
  recoverPlanItemsFromEvents(): PlanItem[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!raw) return [];
      const events = JSON.parse(raw) as any[];
      const items: PlanItem[] = events.map((ev) => ({
        id: ev.id || `plan-${Date.now()}-${Math.random().toString(36).slice(2,7)}`,
        title: ev.title || ev.eventTitle || '未命名',
        content: ev.description,
        tags: ev.tags || (ev.tagId ? [ev.tagId] : []),
        priority: 'medium',
        isCompleted: false,
        isTask: !!ev.isTask,
        type: ev.isTask ? 'task' : 'event',
        level: 0,
        mode: ev.description ? 'description' : 'title',
        description: ev.description,
      }));
      localStorage.setItem(STORAGE_KEYS.PLAN_ITEMS, JSON.stringify(items));
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
