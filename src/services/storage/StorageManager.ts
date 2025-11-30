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

    console.log('[StorageManager] Initializing storage services...');

    try {
      // 动态导入存储服务（避免循环依赖）
      const { indexedDBService } = await import('./IndexedDBService');
      // const { fileSystemService } = await import('./FileSystemService');
      
      this.indexedDBService = indexedDBService;
      // this.fileSystemService = fileSystemService;
      
      // 初始化 IndexedDB（浏览器环境必需）
      await this.indexedDBService.initialize();
      
      // 初始化 SQLite（仅在 Electron 环境）
      // ⚠️ 注意：在 Web 环境中不导入 SQLiteService，因为 better-sqlite3 是 Node.js 原生模块
      if (typeof window !== 'undefined' && (window as any).electron) {
        try {
          const { sqliteService } = await import('./SQLiteService');
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
      throw error;
    }
  }

  /**
   * 查询事件
   */
  async queryEvents(options: QueryOptions): Promise<QueryResult<StorageEvent>> {
    await this.ensureInitialized();

    // TODO: 实现查询逻辑
    // 1. 检查缓存
    // 2. 从 IndexedDB 查询（最近 30 天）
    // 3. 如果需要更多数据，从 SQLite 查询
    // 4. 合并结果并缓存

    return {
      data: [],
      total: 0,
      hasMore: false
    };
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

      // 写入缓存
      this.eventCache.set(event.id, event);

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
      await this.indexedDBService.updateEvent(id, updates);
      
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
   * 全文搜索
   */
  async search(query: string, entityType: 'event' | 'contact'): Promise<any[]> {
    await this.ensureInitialized();

    console.log('[StorageManager] Searching:', query, entityType);

    // TODO: 使用 SQLite FTS5 全文搜索
    return [];
  }

  /**
   * 获取存储统计信息
   */
  async getStats(): Promise<StorageStats> {
    await this.ensureInitialized();

    // TODO: 收集各层存储的统计信息
    return {
      indexedDB: {
        used: 0,
        quota: 0,
        percentage: 0
      },
      sqlite: {
        fileSize: 0,
        vacuumSize: 0
      },
      fileSystem: {
        attachments: 0,
        backups: 0,
        logs: 0
      },
      cache: this.eventCache.getStats()
    };
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
