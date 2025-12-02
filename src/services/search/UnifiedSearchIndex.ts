/**
 * 🔍 Unified Mention Search Index
 * 
 * 本地优先搜索策略：
 * - 内存索引：Events, Tags, People, 自然语言时间
 * - 200ms 内返回结果（无网络依赖）
 * - 智能排序：最近访问 + 模糊匹配 + 上下文权重
 * - 增量更新：监听 EventHub，实时同步索引
 * 
 * 数据结构：
 * {
 *   events: Map<id, { id, title, tags, lastAccessed, type }>,
 *   tags: Map<name, { name, count, relatedEvents }>,
 *   people: Map<id, { id, name, email, avatar }>,
 *   timePresets: Array<{ text, value, category }>,
 * }
 */

import Fuse from 'fuse.js'; // 安装: npm install fuse.js
import { Event } from '../../types';
import { logger as AppLogger } from '../../utils/logger';
import { EventService } from '../EventService';
import { parseNaturalLanguage } from '../../utils/naturalLanguageTimeDictionary';

// 🔍 搜索结果类型
export type MentionType = 'event' | 'tag' | 'person' | 'time' | 'ai' | 'new';

export interface MentionItem {
  id: string;
  type: MentionType;
  title: string;
  subtitle?: string; // 副标题（如 event 的日期、tag 的数量）
  icon?: string; // emoji 或图标
  score?: number; // 匹配分数（0-1）
  metadata?: any; // 额外元数据
}

export interface SearchOptions {
  query: string;
  context?: 'editor' | 'comment' | 'title'; // 上下文（影响排序权重）
  limit?: number; // 每个分组的最大结果数
  includeTypes?: MentionType[]; // 限制搜索类型
}

export interface SearchResult {
  topHit?: MentionItem; // 最佳匹配（置顶）
  events: MentionItem[];
  tags: MentionItem[];
  people: MentionItem[];
  time: MentionItem[];
  ai?: MentionItem; // AI 助手（当查询包含问号或特定关键词时）
  newPage?: MentionItem; // "创建新页面"兜底项
}

class UnifiedSearchIndex {
  // 内存索引
  private eventsIndex: Fuse<Event> | null = null;
  private tagsMap: Map<string, { name: string; count: number; events: string[] }> = new Map();
  private peopleMap: Map<string, { id: string; name: string; email?: string }> = new Map();
  
  // 最近访问记录（用于权重提升）
  private recentAccess: Map<string, number> = new Map(); // id -> timestamp
  
  // 初始化状态
  private initialized = false;
  private indexingPromise: Promise<void> | null = null;

  /**
   * 🚀 初始化索引（应用启动时调用一次）
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    if (this.indexingPromise) return this.indexingPromise;

    this.indexingPromise = this._buildIndex();
    await this.indexingPromise;
    this.initialized = true;

    // 🔄 监听事件更新，增量同步索引
    this._setupEventListeners();
  }

  /**
   * 🔍 统一搜索入口
   */
  async search(options: SearchOptions): Promise<SearchResult> {
    await this.initialize();

    const { query, context = 'editor', limit = 5 } = options;
    const trimmedQuery = query.trim().toLowerCase();

    if (!trimmedQuery) {
      return this._getEmptyResult();
    }

    // 并行搜索所有类型
    const [events, tags, time] = await Promise.all([
      this._searchEvents(trimmedQuery, limit),
      this._searchTags(trimmedQuery, limit),
      this._searchTime(trimmedQuery),
    ]);

    console.log('[UnifiedSearchIndex] 搜索结果:', {
      query: trimmedQuery,
      events: events.length,
      tags: tags.length,
      time: time.length,
      tagsMapSize: this.tagsMap.size,
    });

    // 🎯 智能排序：计算上下文权重
    const weightedEvents = this._applyContextWeight(events, context, 'event');
    const weightedTags = this._applyContextWeight(tags, context, 'tag');

    // 🏆 选出 Top Hit（最高分的结果）
    const allResults = [...weightedEvents, ...weightedTags, ...time];
    const topHit = allResults.length > 0 ? allResults[0] : undefined;

    // 🤖 AI 助手触发条件
    const ai = this._shouldShowAI(trimmedQuery) ? this._createAIItem(trimmedQuery) : undefined;

    // 📄 "创建新页面"兜底
    const newPage = this._createNewPageItem(query);

    return {
      topHit,
      events: weightedEvents.slice(0, limit),
      tags: weightedTags.slice(0, limit),
      people: [], // TODO: 集成人员系统
      time,
      ai,
      newPage,
    };
  }

  /**
   * 📝 记录访问（用于提升最近访问的权重）
   */
  recordAccess(id: string, type: MentionType): void {
    this.recentAccess.set(`${type}:${id}`, Date.now());
  }

  /**
   * 🔗 创建双向链接
   * 当用户在 EventLog 中 @mention 另一个事件时调用
   * 
   * @param fromEventId 当前编辑的事件 ID
   * @param toEventId 被提及的事件 ID
   * @returns 是否成功
   */
  async createBidirectionalLink(fromEventId: string, toEventId: string): Promise<boolean> {
    try {
      const { EventService } = await import('../EventService');
      const result = await EventService.addLink(fromEventId, toEventId);
      
      if (result.success) {
        AppLogger.log('🔗 [UnifiedSearchIndex] 创建双向链接成功:', {
          from: fromEventId,
          to: toEventId,
        });
      } else {
        AppLogger.warn('⚠️ [UnifiedSearchIndex] 创建双向链接失败:', result.error);
      }
      
      return result.success;
    } catch (error) {
      AppLogger.error('❌ [UnifiedSearchIndex] 创建双向链接异常:', error);
      return false;
    }
  }

  // ==================== 私有方法 ====================

  private async _buildIndex(): Promise<void> {
    AppLogger.log('🔍 [UnifiedSearchIndex] 开始构建搜索索引...');

    try {
      // 1. 加载所有事件
      const events = await EventService.getAllEvents();
      
      // 2. 构建 Fuse.js 索引（模糊搜索引擎）
      this.eventsIndex = new Fuse(events, {
        keys: [
          { name: 'title.simpleTitle', weight: 2 }, // 标题权重最高
          { name: 'title.fullTitle', weight: 1.5 },
          { name: 'eventlog.plainText', weight: 1 }, // 内容权重次之
          { name: 'tags', weight: 1.5 },
        ],
        threshold: 0.4, // 模糊度（0 = 精确匹配，1 = 完全模糊）
        includeScore: true,
        useExtendedSearch: true,
      });

      // 3. 构建标签索引
      this.tagsMap.clear();
      events.forEach(event => {
        if (event.tags && Array.isArray(event.tags)) {
          event.tags.forEach(tag => {
            const existing = this.tagsMap.get(tag);
            if (existing) {
              existing.count++;
              existing.events.push(event.id);
            } else {
              this.tagsMap.set(tag, { name: tag, count: 1, events: [event.id] });
            }
          });
        }
      });

      AppLogger.log('✅ [UnifiedSearchIndex] 索引构建完成', {
        events: events.length,
        tags: this.tagsMap.size,
      });
    } catch (error) {
      AppLogger.error('❌ [UnifiedSearchIndex] 索引构建失败:', error);
    }
  }

  private _setupEventListeners(): void {
    // 监听事件更新，增量同步索引
    window.addEventListener('eventsUpdated', ((e: CustomEvent) => {
      const { eventId } = e.detail || {};
      if (eventId) {
        // TODO: 增量更新索引（避免全量重建）
        // this._updateEventInIndex(eventId);
      }
    }) as EventListener);
  }

  private async _searchEvents(query: string, limit: number): Promise<MentionItem[]> {
    if (!this.eventsIndex) return [];

    const results = this.eventsIndex.search(query, { limit: limit * 2 }); // 多取一些，后续会过滤

    return results.map(result => {
      const event = result.item;
      const title = event.title?.simpleTitle || event.title?.fullTitle || event.content || '无标题';
      
      return {
        id: event.id,
        type: 'event' as MentionType,
        title,
        subtitle: this._formatEventSubtitle(event),
        icon: this._getEventIcon(event),
        score: 1 - (result.score || 0), // Fuse.js 的 score 越小越好，转换成 0-1
        metadata: { event },
      };
    });
  }

  private async _searchTags(query: string, limit: number): Promise<MentionItem[]> {
    const matchedTags: MentionItem[] = [];

    this.tagsMap.forEach((tagData, tagName) => {
      if (tagName.toLowerCase().includes(query)) {
        // 精确匹配分数更高
        const isExact = tagName.toLowerCase() === query;
        const isPrefix = tagName.toLowerCase().startsWith(query);
        const score = isExact ? 1.0 : isPrefix ? 0.8 : 0.5;

        matchedTags.push({
          id: tagName,
          type: 'tag',
          title: `#${tagName}`,
          subtitle: `${tagData.count} 个事件`,
          icon: '🏷️',
          score,
          metadata: { count: tagData.count, events: tagData.events },
        });
      }
    });

    // 按分数排序
    return matchedTags.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
  }

  private async _searchTime(query: string): Promise<MentionItem[]> {
    // 尝试解析自然语言时间
    const parseResult = parseNaturalLanguage(query);
    
    if (!parseResult.matched) return [];

    const items: MentionItem[] = [];

    // 精确时间点
    if (parseResult.pointInTime) {
      items.push({
        id: 'time-point',
        type: 'time',
        title: parseResult.pointInTime.displayHint || '时间',
        subtitle: parseResult.pointInTime.date?.format('YYYY-MM-DD'),
        icon: '📅',
        score: 1.0,
        metadata: { pointInTime: parseResult.pointInTime },
      });
    }

    // 时间段
    if (parseResult.timePeriod) {
      items.push({
        id: 'time-period',
        type: 'time',
        title: `${parseResult.timePeriod.startHour}:${parseResult.timePeriod.startMinute.toString().padStart(2, '0')}`,
        subtitle: '时间段',
        icon: '⏰',
        score: 0.9,
        metadata: { timePeriod: parseResult.timePeriod },
      });
    }

    // 日期范围
    if (parseResult.dateRange) {
      items.push({
        id: 'time-range',
        type: 'time',
        title: parseResult.dateRange.displayHint || '日期范围',
        subtitle: `${parseResult.dateRange.start?.format('YYYY-MM-DD')} - ${parseResult.dateRange.end?.format('YYYY-MM-DD')}`,
        icon: '📆',
        score: 0.85,
        metadata: { dateRange: parseResult.dateRange },
      });
    }

    return items;
  }

  private _applyContextWeight(items: MentionItem[], context: string, type: MentionType): MentionItem[] {
    const now = Date.now();
    const ONE_HOUR = 60 * 60 * 1000;

    return items.map(item => {
      let weight = item.score || 0;

      // 🔥 最近访问加权（1 小时内访问过，+30% 权重）
      const lastAccess = this.recentAccess.get(`${type}:${item.id}`);
      if (lastAccess && now - lastAccess < ONE_HOUR) {
        weight *= 1.3;
      }

      // 📝 上下文加权
      if (context === 'comment' && type === 'event') {
        weight *= 0.8; // 评论区更可能提及人，降低事件权重
      } else if (context === 'editor' && type === 'event') {
        weight *= 1.2; // 编辑器更可能引用事件
      }

      return { ...item, score: weight };
    }).sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  private _shouldShowAI(query: string): boolean {
    // AI 助手触发条件：
    // 1. 包含问号
    // 2. 包含 "帮我"、"如何"、"怎么" 等关键词
    // 3. 超过 20 个字符（可能是复杂描述）
    return (
      query.includes('?') ||
      query.includes('？') ||
      /帮我|如何|怎么|怎样|为什么/.test(query) ||
      query.length > 20
    );
  }

  private _createAIItem(query: string): MentionItem {
    return {
      id: 'ai-assistant',
      type: 'ai',
      title: 'AI 助手处理',
      subtitle: `让 AI 理解："${query.slice(0, 30)}${query.length > 30 ? '...' : ''}"`,
      icon: '🤖',
      score: 0.7,
      metadata: { prompt: query },
    };
  }

  private _createNewPageItem(query: string): MentionItem {
    return {
      id: 'new-page',
      type: 'new',
      title: `创建新页面："${query}"`,
      subtitle: '按 Enter 创建',
      icon: '➕',
      score: 0,
    };
  }

  private _formatEventSubtitle(event: Event): string {
    const parts: string[] = [];
    
    if (event.startTime) {
      const date = new Date(event.startTime);
      parts.push(date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' }));
    }
    
    if (event.tags && event.tags.length > 0) {
      parts.push(event.tags.slice(0, 2).map(t => `#${t}`).join(' '));
    }
    
    return parts.join(' · ') || '无日期';
  }

  private _getEventIcon(event: Event): string {
    if (event.isPlan) return '✅';
    if (event.isTimeCalendar) return '📅';
    if (event.checkType && event.checkType !== 'none') return '☑️';
    return '📄';
  }

  private _getEmptyResult(): SearchResult {
    // 空查询时，显示常用标签和时间建议
    const topTags = Array.from(this.tagsMap.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(tag => ({
        id: tag.name,
        type: 'tag' as MentionType,
        title: `#${tag.name}`,
        subtitle: `${tag.count} 个事件`,
        icon: '🏷️',
        score: 1.0,
        metadata: { count: tag.count, events: tag.events },
      }));

    const timePresets: MentionItem[] = [
      { id: 'today', type: 'time', title: '今天', icon: '📅', score: 1.0 },
      { id: 'tomorrow', type: 'time', title: '明天', icon: '📅', score: 1.0 },
      { id: 'nextWeek', type: 'time', title: '下周', icon: '📅', score: 1.0 },
    ];

    return {
      events: [],
      tags: topTags,
      people: [],
      time: timePresets,
    };
  }
}

// 🌟 单例导出
export const unifiedSearchIndex = new UnifiedSearchIndex();
