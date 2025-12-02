/**
 * StorageManager - 统一存储管理器
 * 
 * 核心职责：
 * - 协调三层存储架构（IndexedDB + SQLite + Cloud）
 * - 实现双写策略（同步写入 IndexedDB 和 SQLite）
 * - 提供统一的 CRUD 接口
 * - 管理 LRU 内存缓存（50 MB）
 * 
 * @version 1.0.0
 * @date 2025-12-01
 */

import type { 
  StorageEvent, 
  Contact, 
  Tag, 
  Attachment,
  SyncQueueItem,
  QueryOptions, 
  QueryResult,
  BatchResult,
  StorageStats
} from './types';

import StorageManagerVersionExt from './StorageManagerVersionExt';
import type { EventLog } from '../../types';

/**
 * LRU 缓存实现（简化版）
 */
class LRUCache<T> {
  private cache: Map<string, { value: T; timestamp: number }>;
  private maxSize: number;
  private currentSize: number;

  constructor(maxSizeMB: number = 50) {
    this.cache = new Map();
    this.maxSize = maxSizeMB * 1024 * 1024; // 转换为字节
    this.currentSize = 0;
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (entry) {
      // 更新时间戳（LRU 策略）
      entry.timestamp = Date.now();
      return entry.value;
    }
    return null;
  }

  set(key: string, value: T): void {
    const size = this.estimateSize(value);
    
    // 如果缓存满了，移除最老的项
    while (this.currentSize + size > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(key, { value, timestamp: Date.now() });
    this.currentSize += size;
  }

  delete(key: string): void {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= this.estimateSize(entry.value);
      this.cache.delete(key);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  getStats() {
    return {
      size: this.currentSize,
      count: this.cache.size,
      maxSize: this.maxSize,
      hitRate: 0 // TODO: 实现命中率统计
    };
  }

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.delete(oldestKey);
    }
  }

  private estimateSize(value: any): number {
    // 简化的大小估算（JSON 字符串长度 * 2 bytes per char）
    return JSON.stringify(value).length * 2;
  }
}

/**
 * StorageManager 主类
 */
export class StorageManager {
  private static instance: StorageManager | null = null;
  
  // 存储服务（懒加载）
  private indexedDBService: any = null;
  private sqliteService: any = null;
  private fileSystemService: any = null;
  
  // LRU 缓存
  private eventCache: LRUCache<StorageEvent>;
  private contactCache: LRUCache<Contact>;
  private tagCache: LRUCache<Tag>;
  
  // 初始化状态
  private initialized = false;
  private initializingPromise: Promise<void> | null = null;

  private constructor() {
    this.eventCache = new LRUCache<StorageEvent>(30); // 30 MB for events
    this.contactCache = new LRUCache<Contact>(10); // 10 MB for contacts
    this.tagCache = new LRUCache<Tag>(10); // 10 MB for tags
  }

  /**
   * 获取单例实例
   */
  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager();
    }
    return StorageManager.instance;
  }

  /**
   * 初始化存储服务
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.log('[StorageManager] Already initialized');
      return;
    }

    // 如果正在初始化，返回现有的Promise
    if (this.initializingPromise) {
      console.log('[StorageManager] Initialization in progress, waiting...');
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      console.log('[StorageManager] Initializing storage services...');

    try {
      // 动态导入存储服务（避免循环依赖）
      const { indexedDBService } = await import('./IndexedDBService');
      // const { fileSystemService } = await import('./FileSystemService');
      
      this.indexedDBService = indexedDBService;
      // this.fileSystemService = fileSystemService;
      
      // 初始化 IndexedDB（浏览器环境必需）
      await this.indexedDBService.initialize();
      console.log('[StorageManager] ✅ IndexedDB initialized');
      
      // 初始化 SQLite（仅在 Electron 环境）
      // ⚠️ 注意：在 Web 环境中不导入 SQLiteService，因为 better-sqlite3 是 Node.js 原生模块
      if (typeof window !== 'undefined' && (window as any).electronAPI) {
        try {
          const { sqliteService } = await import(/* @vite-ignore */ './SQLiteService');
          this.sqliteService = sqliteService;
          await this.sqliteService.initialize();
          console.log('[StorageManager] ✅ SQLite enabled (Electron)');
        } catch (error) {
          console.warn('[StorageManager] ⚠️  SQLite initialization failed:', error);
          this.sqliteService = null;
        }
      } else {
        console.log('[StorageManager] ℹ️  SQLite skipped (Web only)');
        this.sqliteService = null;
      }

      this.initialized = true;
      console.log('[StorageManager] ✅ Initialization complete');
      } catch (error) {
        console.error('[StorageManager] ❌ Initialization failed:', error);
        this.initializingPromise = null;
        throw error;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  /**
   * 查询事件（智能分层查询）
   * 
   * 策略：
   * - 优先从 IndexedDB 查询（快速访问最近 30 天数据）
   * - 如果在 Electron 环境且需要历史数据，使用 SQLite
   * - 结果自动缓存到内存
   */
  async queryEvents(options: QueryOptions = {}): Promise<QueryResult<StorageEvent>> {
    await this.ensureInitialized();

    console.log('[StorageManager] Querying events:', options);

    try {
      // 1. 优先使用 SQLite（如果可用）- 性能更好，支持复杂查询
      if (this.sqliteService) {
        const result = await this.sqliteService.queryEvents(options);
        
        // 将查询结果缓存到内存
        result.items.forEach((event: StorageEvent) => {
          this.eventCache.set(event.id, event);
        });
        
        console.log('[StorageManager] ✅ Query complete (SQLite):', result.items.length, 'events');
        return result;
      }

      // 2. 降级到 IndexedDB（Web 环境）
      if (this.indexedDBService) {
        const result = await this.indexedDBService.queryEvents(options);
        
        // 缓存结果
        result.items.forEach((event: StorageEvent) => {
          this.eventCache.set(event.id, event);
        });
        
        console.log('[StorageManager] ✅ Query complete (IndexedDB):', result.items.length, 'events');
        return result;
      }

      // 3. 如果都不可用，返回空结果
      console.warn('[StorageManager] ⚠️  No storage service available, returning empty result');
      return {
        items: [],
        total: 0,
        hasMore: false,
        offset: 0
      };
    } catch (error) {
      console.error('[StorageManager] ❌ Query failed:', error);
      throw error;
    }
  }

  /**
   * 创建事件（双写：IndexedDB + SQLite）
   */
  async createEvent(event: StorageEvent): Promise<StorageEvent> {
    await this.ensureInitialized();

    console.log('[StorageManager] Creating event:', event.id);

    try {
      // 双写策略：同步写入 IndexedDB 和 SQLite
      await this.indexedDBService.createEvent(event);
      
      if (this.sqliteService) {
        await this.sqliteService.createEvent(event);
      }
      console.log('[StorageManager] ✅ Event created:', event.id);
      return event;
    } catch (error) {
      console.error('[StorageManager] ❌ Failed to create event:', error);
      throw error;
    }
  }

  /**
   * 更新事件（双写：IndexedDB + SQLite）
   */
  async updateEvent(id: string, updates: Partial<StorageEvent>): Promise<StorageEvent> {
    await this.ensureInitialized();

    console.log('[StorageManager] Updating event:', id);

    try {
      // 1. 双写到 IndexedDB 和 SQLite
      if (this.indexedDBService) {
        await this.indexedDBService.updateEvent(id, updates);
      }
      
      if (this.sqliteService) {
        await this.sqliteService.updateEvent(id, updates);
      }

      // 2. 更新缓存
      const cachedEvent = this.eventCache.get(id);
      if (cachedEvent) {
        const updatedEvent = { ...cachedEvent, ...updates };
        this.eventCache.set(id, updatedEvent);
      }

      // 3. 获取最新数据
      const updatedEvent = await this.indexedDBService.getEvent(id);
      if (!updatedEvent) {
        throw new Error(`Event not found: ${id}`);
      }

      console.log('[StorageManager] ✅ Event updated:', id);
      return updatedEvent;
    } catch (error) {
      console.error('[StorageManager] ❌ Failed to update event:', error);
      throw error;
    }
  }

  /**
   * 删除事件（双写：IndexedDB + SQLite）
   */
  async deleteEvent(id: string): Promise<void> {
    await this.ensureInitialized();

    console.log('[StorageManager] Deleting event:', id);

    try {
      // 双写删除
      await this.indexedDBService.deleteEvent(id);
      
      if (this.sqliteService) {
        await this.sqliteService.deleteEvent(id);
      }

      // 从缓存移除
      this.eventCache.delete(id);

      console.log('[StorageManager] ✅ Event deleted:', id);
    } catch (error) {
      console.error('[StorageManager] ❌ Failed to delete event:', error);
      throw error;
    }
  }

  /**
   * 批量操作
   */
  async batchCreateEvents(events: StorageEvent[]): Promise<BatchResult<StorageEvent>> {
    await this.ensureInitialized();

    console.log('[StorageManager] Batch creating events:', events.length);

    const success: StorageEvent[] = [];
    const failed: Array<{ item: StorageEvent; error: Error }> = [];

    for (const event of events) {
      try {
        await this.createEvent(event);
        success.push(event);
      } catch (error) {
        failed.push({ item: event, error: error as Error });
      }
    }

    console.log('[StorageManager] Batch create complete:', { success: success.length, failed: failed.length });
    return { success, failed };
  }

  /**
   * 全文搜索（使用 SQLite FTS5）
   * 
   * 策略：
   * - Electron 环境：使用 SQLite FTS5 全文索引（高性能）
   * - Web 环境：降级到 IndexedDB 前端过滤（性能较低）
   */
  async search(query: string, options: { limit?: number; offset?: number } = {}): Promise<QueryResult<StorageEvent>> {
    await this.ensureInitialized();

    if (!query || query.trim().length === 0) {
      return { items: [], total: 0, hasMore: false };
    }

    console.log('[StorageManager] Searching:', query);

    try {
      // 1. 优先使用 SQLite FTS5（如果可用）
      if (this.sqliteService) {
        const result = await this.sqliteService.searchEvents(query, options);
        
        // 缓存搜索结果
        result.items.forEach((event: StorageEvent) => {
          this.eventCache.set(event.id, event);
        });
        
        console.log('[StorageManager] ✅ Search complete (FTS5):', result.items.length, 'events');
        return result;
      }

      // 2. 降级到 IndexedDB 前端过滤
      const allEvents = await this.indexedDBService.queryEvents({ limit: 1000 });
      const searchLower = query.toLowerCase();
      
      const filtered = allEvents.items.filter((event: StorageEvent) => {
        const titleText = typeof event.title === 'string' ? event.title : event.title?.simpleTitle || '';
        return (
          titleText.toLowerCase().includes(searchLower) ||
          event.description?.toLowerCase().includes(searchLower) ||
          event.location?.toLowerCase().includes(searchLower)
        );
      });

      const limit = options.limit || 50;
      const offset = options.offset || 0;
      const items = filtered.slice(offset, offset + limit);

      console.log('[StorageManager] ✅ Search complete (IndexedDB):', items.length, 'events');
      return {
        items,
        total: filtered.length,
        hasMore: offset + limit < filtered.length
      };
    } catch (error) {
      console.error('[StorageManager] ❌ Search failed:', error);
      throw error;
    }
  }

  /**
   * 获取存储统计信息（聚合所有存储层）
   */
  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    console.log('[StorageManager] Collecting storage statistics...');

    try {
      // 1. 收集 IndexedDB 统计信息
      const indexedDBStats = await this.indexedDBService.getStorageStats();

      // 2. 收集 SQLite 统计信息（如果可用）
      let sqliteStats = undefined;
      if (this.sqliteService) {
        sqliteStats = await this.sqliteService.getStorageStats();
      }

      // 3. 收集缓存统计信息
      const cacheStats = {
        events: this.eventCache.getStats(),
        contacts: this.contactCache.getStats(),
        tags: this.tagCache.getStats()
      };

      // 4. 聚合统计信息
      const stats: StorageStats = {
        indexedDB: indexedDBStats.indexedDB,
        sqlite: sqliteStats?.sqlite,
        cache: {
          size: cacheStats.events.size + cacheStats.contacts.size + cacheStats.tags.size,
          count: cacheStats.events.count + cacheStats.contacts.count + cacheStats.tags.count,
          maxSize: cacheStats.events.maxSize + cacheStats.contacts.maxSize + cacheStats.tags.maxSize,
          hitRate: 0, // TODO: 实现命中率追踪
          breakdown: cacheStats
        }
      };

      console.log('[StorageManager] ✅ Statistics collected:', {
        indexedDB: stats.indexedDB?.eventsCount || 0,
        sqlite: stats.sqlite?.eventsCount || 0,
        cache: stats.cache?.count || 0
      });

      return stats;
    } catch (error) {
      console.error('[StorageManager] ❌ Failed to collect stats:', error);
      throw error;
    }
  }

  // ==================== EventLog Version History ====================

  /**
   * 保存 EventLog 版本历史
   */
  async saveEventLogVersion(
    eventId: string,
    eventLog: EventLog,
    previousEventLog?: EventLog
  ): Promise<void> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.saveEventLogVersion(
      this.sqliteService || null,
      eventId,
      eventLog,
      previousEventLog
    );
  }

  /**
   * 获取 EventLog 历史版本列表
   */
  async getEventLogVersions(
    eventId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Array<{
    version: number;
    createdAt: string;
    deltaSize: number;
    originalSize: number;
    compressionRatio: number;
  }>> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.getEventLogVersions(
      this.sqliteService || null,
      eventId,
      options
    );
  }

  /**
   * 恢复 EventLog 到指定版本
   */
  async restoreEventLogVersion(
    eventId: string,
    version: number
  ): Promise<EventLog> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.restoreEventLogVersion(
      this.sqliteService || null,
      eventId,
      version
    );
  }

  /**
   * 获取版本统计信息
   */
  async getVersionStats(
    eventId: string
  ): Promise<{
    totalVersions: number;
    totalSize: number;
    averageCompressionRatio: number;
    latestVersion: number;
  }> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.getVersionStats(
      this.sqliteService || null,
      eventId
    );
  }

  /**
   * 清理旧版本（保留最近 N 个）
   */
  async pruneOldVersions(
    eventId: string,
    keepCount: number = 50
  ): Promise<number> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.pruneOldVersions(
      this.sqliteService || null,
      eventId,
      keepCount
    );
  }

  /**
   * FTS5 全文搜索（覆盖原有的 search 方法，支持 EventLog 搜索）
   */
  async searchEventLogs(
    query: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<QueryResult<StorageEvent>> {
    await this.ensureInitialized();
    
    return StorageManagerVersionExt.searchEventLogs(
      this.sqliteService || null,
      this.indexedDBService,
      query,
      options
    );
  }

  // ==================== Tag 管理方法 ====================

  /**
   * 创建标签
   */
  async createTag(tag: import('./types').StorageTag): Promise<import('./types').StorageTag> {
    await this.ensureInitialized();
    console.log('[StorageManager] Creating tag:', tag.id);

    // 双写：IndexedDB + SQLite
    // 注意：IndexedDB 暂不支持 Tag，先只写 SQLite
    if (this.sqliteService) {
      await this.sqliteService.createTag(tag);
    }

    // 写入缓存
    this.tagCache.set(tag.id, tag as any);

    console.log('[StorageManager] ✅ Tag created:', tag.id);
    return tag;
  }

  /**
   * 更新标签
   */
  async updateTag(id: string, updates: Partial<import('./types').StorageTag>): Promise<import('./types').StorageTag> {
    await this.ensureInitialized();
    console.log('[StorageManager] Updating tag:', id);

    // 双写：IndexedDB + SQLite
    if (this.sqliteService) {
      await this.sqliteService.updateTag(id, updates);
    }

    // 更新缓存
    const cachedTag = this.tagCache.get(id);
    if (cachedTag) {
      const updatedTag = { ...cachedTag, ...updates };
      this.tagCache.set(id, updatedTag);
    }

    // 返回更新后的标签
    return await this.getTag(id);
  }

  /**
   * 删除标签（软删除）
   */
  async deleteTag(id: string): Promise<void> {
    await this.ensureInitialized();
    console.log('[StorageManager] Soft-deleting tag:', id);

    const now = new Date().toISOString();

    // 软删除：设置 deletedAt
    await this.updateTag(id, {
      deletedAt: now,
      updatedAt: now,
    });

    // 从缓存中移除
    this.tagCache.delete(id);

    console.log('[StorageManager] ✅ Tag soft-deleted:', id);
  }

  /**
   * 硬删除标签（永久删除）
   */
  async hardDeleteTag(id: string): Promise<void> {
    await this.ensureInitialized();
    console.warn('[StorageManager] Hard-deleting tag (permanent):', id);

    if (this.sqliteService) {
      await this.sqliteService.hardDeleteTag(id);
    }

    this.tagCache.delete(id);

    console.log('[StorageManager] ✅ Tag permanently deleted:', id);
  }

  /**
   * 获取单个标签
   */
  async getTag(id: string): Promise<import('./types').StorageTag> {
    await this.ensureInitialized();

    // 1. 检查缓存
    const cached = this.tagCache.get(id);
    if (cached) {
      return cached as any;
    }

    // 2. 从 SQLite 查询
    if (this.sqliteService) {
      const tag = await this.sqliteService.getTag(id);
      if (tag) {
        this.tagCache.set(id, tag as any);
        return tag;
      }
    }

    throw new Error(`Tag not found: ${id}`);
  }

  /**
   * 查询标签
   */
  async queryTags(options: QueryOptions = {}): Promise<QueryResult<import('./types').StorageTag>> {
    await this.ensureInitialized();

    // 优先使用 SQLite
    if (this.sqliteService) {
      const result = await this.sqliteService.queryTags(options);
      
      // 写入缓存
      result.items.forEach(tag => this.tagCache.set(tag.id, tag as any));
      
      return result;
    }

    // 降级：返回空结果
    return {
      items: [],
      total: 0,
      hasMore: false,
    };
  }

  /**
   * 批量创建标签
   */
  async batchCreateTags(tags: import('./types').StorageTag[]): Promise<BatchResult<import('./types').StorageTag>> {
    await this.ensureInitialized();

    const success: import('./types').StorageTag[] = [];
    const failed: Array<{ item: import('./types').StorageTag; error: Error }> = [];

    for (const tag of tags) {
      try {
        const created = await this.createTag(tag);
        success.push(created);
      } catch (error) {
        failed.push({ item: tag, error: error as Error });
      }
    }

    return { success, failed };
  }

  /**
   * 清理缓存
   */
  clearCache(): void {
    this.eventCache.clear();
    this.contactCache.clear();
    this.tagCache.clear();
    console.log('[StorageManager] Cache cleared');
  }

  /**
   * 清空所有数据（仅用于测试/调试）
   */
  async clearAll(): Promise<void> {
    await this.ensureInitialized();
    console.log('[StorageManager] Clearing all data...');
    
    await this.indexedDBService.clearAll();
    
    if (this.sqliteService) {
      await this.sqliteService.clearAll();
    }
    
    this.clearCache();
    
    console.log('[StorageManager] ✅ All data cleared');
  }

  /**
   * 确保已初始化
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }
}

// 导出单例实例
export const storageManager = StorageManager.getInstance();
