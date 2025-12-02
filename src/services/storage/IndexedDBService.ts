/**
 * IndexedDBService - IndexedDB 存储服务
 * 
 * 职责：
 * - 管理 IndexedDB 数据库（近期 30 天热数据）
 * - 提供 CRUD 接口
 * - 支持索引查询和范围查询
 * 
 * Object Stores:
 * - accounts: 邮箱账号信息
 * - calendars: 日历信息
 * - events: 事件数据
 * - contacts: 联系人
 * - tags: 标签
 * - attachments: 附件元数据
 * - syncQueue: 同步队列
 * - metadata: 元数据
 * 
 * @version 1.0.0
 * @date 2025-12-01
 */

import type {
  Account,
  Calendar,
  StorageEvent,
  Contact,
  Tag,
  Attachment,
  SyncQueueItem,
  Metadata,
  StorageStats,
  QueryOptions,
  QueryResult
} from './types';

const DB_NAME = 'ReMarkableDB';
const DB_VERSION = 1;

export class IndexedDBService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * 初始化数据库
   */
  async initialize(): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        const error = request.error;
        console.error('[IndexedDBService] Failed to open database:', error);
        
        // 如果是 Internal error，尝试删除并重建数据库
        if (error?.message?.includes('Internal error')) {
          console.warn('[IndexedDBService] Attempting to reset corrupted database...');
          this.resetDatabase().then(() => {
            console.log('[IndexedDBService] Database reset complete, retrying...');
            // 重试初始化
            this.initPromise = null;
            this.initialize().then(resolve).catch(reject);
          }).catch(resetError => {
            console.error('[IndexedDBService] Failed to reset database:', resetError);
            reject(error);
          });
        } else {
          reject(error);
        }
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[IndexedDBService] ✅ Database opened successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        console.log('[IndexedDBService] Upgrading database schema...');

        // 1. Accounts Store
        if (!db.objectStoreNames.contains('accounts')) {
          const accountsStore = db.createObjectStore('accounts', { keyPath: 'id' });
          accountsStore.createIndex('email', 'email', { unique: true });
          accountsStore.createIndex('provider', 'provider', { unique: false });
          console.log('[IndexedDBService] Created accounts store');
        }

        // 2. Calendars Store
        if (!db.objectStoreNames.contains('calendars')) {
          const calendarsStore = db.createObjectStore('calendars', { keyPath: 'id' });
          calendarsStore.createIndex('accountId', 'accountId', { unique: false });
          calendarsStore.createIndex('isDefault', 'isDefault', { unique: false });
          console.log('[IndexedDBService] Created calendars store');
        }

        // 3. Events Store
        if (!db.objectStoreNames.contains('events')) {
          const eventsStore = db.createObjectStore('events', { keyPath: 'id' });
          eventsStore.createIndex('startTime', 'startTime', { unique: false });
          eventsStore.createIndex('endTime', 'endTime', { unique: false });
          eventsStore.createIndex('sourceAccountId', 'sourceAccountId', { unique: false });
          eventsStore.createIndex('sourceCalendarId', 'sourceCalendarId', { unique: false });
          eventsStore.createIndex('tags', 'tags', { unique: false, multiEntry: true });
          eventsStore.createIndex('parentId', 'parentId', { unique: false });
          eventsStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[IndexedDBService] Created events store');
        }

        // 4. Contacts Store
        if (!db.objectStoreNames.contains('contacts')) {
          const contactsStore = db.createObjectStore('contacts', { keyPath: 'id' });
          contactsStore.createIndex('email', 'email', { unique: false });
          contactsStore.createIndex('name', 'name', { unique: false });
          contactsStore.createIndex('sourceAccountId', 'sourceAccountId', { unique: false });
          console.log('[IndexedDBService] Created contacts store');
        }

        // 5. Tags Store
        if (!db.objectStoreNames.contains('tags')) {
          const tagsStore = db.createObjectStore('tags', { keyPath: 'id' });
          tagsStore.createIndex('name', 'name', { unique: true });
          tagsStore.createIndex('parentId', 'parentId', { unique: false });
          console.log('[IndexedDBService] Created tags store');
        }

        // 6. Attachments Store
        if (!db.objectStoreNames.contains('attachments')) {
          const attachmentsStore = db.createObjectStore('attachments', { keyPath: 'id' });
          attachmentsStore.createIndex('eventId', 'eventId', { unique: false });
          attachmentsStore.createIndex('type', 'type', { unique: false });
          console.log('[IndexedDBService] Created attachments store');
        }

        // 7. SyncQueue Store
        if (!db.objectStoreNames.contains('syncQueue')) {
          const syncQueueStore = db.createObjectStore('syncQueue', { keyPath: 'id' });
          syncQueueStore.createIndex('status', 'status', { unique: false });
          syncQueueStore.createIndex('accountId', 'accountId', { unique: false });
          syncQueueStore.createIndex('entityType', 'entityType', { unique: false });
          syncQueueStore.createIndex('createdAt', 'createdAt', { unique: false });
          console.log('[IndexedDBService] Created syncQueue store');
        }

        // 8. Metadata Store
        if (!db.objectStoreNames.contains('metadata')) {
          const metadataStore = db.createObjectStore('metadata', { keyPath: 'key' });
          console.log('[IndexedDBService] Created metadata store');
        }

        console.log('[IndexedDBService] ✅ Schema upgrade complete');
      };
    });

    return this.initPromise;
  }

  /**
   * 通用查询方法
   */
  private async query<T>(
    storeName: string,
    indexName?: string,
    query?: IDBValidKey | IDBKeyRange
  ): Promise<T[]> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const source = indexName ? store.index(indexName) : store;
      const request = query ? source.getAll(query) : source.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用获取单个项方法
   */
  private async get<T>(storeName: string, key: string): Promise<T | null> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用写入方法
   */
  private async put<T>(storeName: string, item: T): Promise<void> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 通用删除方法
   */
  private async delete(storeName: string, key: string): Promise<void> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // ==================== Accounts ====================

  async getAccount(id: string): Promise<Account | null> {
    return this.get<Account>('accounts', id);
  }

  async getAllAccounts(): Promise<Account[]> {
    return this.query<Account>('accounts');
  }

  async createAccount(account: Account): Promise<void> {
    return this.put('accounts', account);
  }

  async updateAccount(account: Account): Promise<void> {
    return this.put('accounts', account);
  }

  async deleteAccount(id: string): Promise<void> {
    return this.delete('accounts', id);
  }

  // ==================== Calendars ====================

  async getCalendar(id: string): Promise<Calendar | null> {
    return this.get<Calendar>('calendars', id);
  }

  async getCalendarsByAccount(accountId: string): Promise<Calendar[]> {
    return this.query<Calendar>('calendars', 'accountId', accountId);
  }

  async createCalendar(calendar: Calendar): Promise<void> {
    return this.put('calendars', calendar);
  }

  async updateCalendar(calendar: Calendar): Promise<void> {
    return this.put('calendars', calendar);
  }

  async deleteCalendar(id: string): Promise<void> {
    return this.delete('calendars', id);
  }

  // ==================== Events ====================

  async getEvent(id: string): Promise<StorageEvent | null> {
    return this.get<StorageEvent>('events', id);
  }

  async queryEvents(options: QueryOptions): Promise<QueryResult<StorageEvent>> {
    let events = await this.query<StorageEvent>('events');

    // 筛选：时间范围
    if (options.startDate || options.endDate) {
      events = events.filter(event => {
        if (!event.startTime) return false;
        const eventDate = new Date(event.startTime);
        if (options.startDate && eventDate < options.startDate) return false;
        if (options.endDate && eventDate > options.endDate) return false;
        return true;
      });
    }

    // 筛选：账号
    if (options.accountIds && options.accountIds.length > 0) {
      events = events.filter(event => 
        event.sourceAccountId && options.accountIds!.includes(event.sourceAccountId)
      );
    }

    // 排序
    if (options.orderBy) {
      const direction = options.orderDirection === 'desc' ? -1 : 1;
      events.sort((a, b) => {
        const aVal = (a as any)[options.orderBy!];
        const bVal = (b as any)[options.orderBy!];
        if (aVal < bVal) return -direction;
        if (aVal > bVal) return direction;
        return 0;
      });
    }

    // 分页
    const total = events.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    const paginatedEvents = events.slice(offset, offset + limit);

    return {
      items: paginatedEvents,
      total,
      hasMore: offset + limit < total
    };
  }

  async createEvent(event: StorageEvent): Promise<void> {
    return this.put('events', event);
  }

  async updateEvent(id: string, updates: Partial<StorageEvent>): Promise<void> {
    const existingEvent = await this.getEvent(id);
    if (!existingEvent) {
      throw new Error(`Event not found: ${id}`);
    }
    const updatedEvent = { ...existingEvent, ...updates, updatedAt: new Date().toISOString() };
    return this.put('events', updatedEvent);
  }

  async deleteEvent(id: string): Promise<void> {
    return this.delete('events', id);
  }

  async batchCreateEvents(events: StorageEvent[]): Promise<void> {
    await this.initialize();
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const transaction = this.db.transaction('events', 'readwrite');
      const store = transaction.objectStore('events');

      for (const event of events) {
        store.put(event);
      }

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  // ==================== 其他 Stores ====================

  // Tags
  async getAllTags(): Promise<Tag[]> {
    return this.query<Tag>('tags');
  }

  async createTag(tag: Tag): Promise<void> {
    return this.put('tags', tag);
  }

  // Contacts
  async getAllContacts(): Promise<Contact[]> {
    return this.query<Contact>('contacts');
  }

  async createContact(contact: Contact): Promise<void> {
    return this.put('contacts', contact);
  }

  // SyncQueue
  async getSyncQueue(): Promise<SyncQueueItem[]> {
    return this.query<SyncQueueItem>('syncQueue');
  }

  async addToSyncQueue(item: SyncQueueItem): Promise<void> {
    return this.put('syncQueue', item);
  }

  async removeFromSyncQueue(id: string): Promise<void> {
    return this.delete('syncQueue', id);
  }

  // Metadata
  async getMetadata(key: string): Promise<any> {
    const metadata = await this.get<Metadata>('metadata', key);
    return metadata ? metadata.value : null;
  }

  async setMetadata(key: string, value: any): Promise<void> {
    const metadata: Metadata = {
      key,
      value,
      updatedAt: new Date().toISOString()
    };
    return this.put('metadata', metadata);
  }

  /**
   * 获取存储使用情况
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number }> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    }
    return { usage: 0, quota: 0 };
  }

  /**
   * 获取存储统计信息
   */
  async getStorageStats(): Promise<Partial<StorageStats>> {
    await this.initialize();
    
    const estimate = await this.getStorageEstimate();
    
    const [
      accountsCount,
      calendarsCount,
      eventsCount,
      contactsCount,
      tagsCount
    ] = await Promise.all([
      this.count('accounts'),
      this.count('calendars'),
      this.count('events'),
      this.count('contacts'),
      this.count('tags')
    ]);

    return {
      indexedDB: {
        used: estimate.usage,
        quota: estimate.quota,
        percentage: estimate.quota > 0 ? (estimate.usage / estimate.quota) * 100 : 0,
        eventsCount,
        contactsCount,
        tagsCount
      }
    };
  }

  /**
   * 统计 Store 中的记录数
   */
  private async count(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'));
        return;
      }
      const transaction = this.db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * 清空所有数据（危险操作！）
   */
  async clearAll(): Promise<void> {
    await this.initialize();
    
    if (!this.db) {
      throw new Error('Database not initialized');
    }

    const storeNames = Array.from(this.db.objectStoreNames);
    const transaction = this.db.transaction(storeNames, 'readwrite');

    for (const storeName of storeNames) {
      transaction.objectStore(storeName).clear();
    }

    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        console.log('[IndexedDBService] All data cleared');
        resolve();
      };
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * 关闭数据库
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      this.initPromise = null;
      console.log('[IndexedDBService] Database closed');
    }
  }

  /**
   * 重置数据库（删除并重建）
   */
  async resetDatabase(): Promise<void> {
    console.log('[IndexedDBService] Resetting database...');
    
    // 关闭现有连接
    this.close();

    // 删除数据库
    return new Promise((resolve, reject) => {
      const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
      
      deleteRequest.onsuccess = () => {
        console.log('[IndexedDBService] ✅ Database deleted successfully');
        resolve();
      };
      
      deleteRequest.onerror = () => {
        console.error('[IndexedDBService] ❌ Failed to delete database:', deleteRequest.error);
        reject(deleteRequest.error);
      };
      
      deleteRequest.onblocked = () => {
        console.warn('[IndexedDBService] ⚠️  Database deletion blocked (close all tabs)');
        // 等待一段时间后重试
        setTimeout(() => {
          resolve();
        }, 1000);
      };
    });
  }
}

// 导出单例实例
export const indexedDBService = new IndexedDBService();
