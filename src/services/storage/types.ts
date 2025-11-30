/**
 * Storage 模块通用类型定义
 * @version 1.0.0
 * @date 2025-12-01
 */

import type { Event, Contact, Tag } from '../../types';

/**
 * 存储层级
 */
export enum StorageLayer {
  IndexedDB = 'indexeddb',
  SQLite = 'sqlite',
  Cloud = 'cloud'
}

/**
 * 同步状态
 */
export enum SyncStatus {
  Pending = 'pending',
  Syncing = 'syncing',
  Synced = 'synced',
  Failed = 'failed',
  Conflict = 'conflict'
}

/**
 * 账号信息（多邮箱支持）
 */
export interface Account {
  id: string;
  email: string;
  provider: 'outlook' | 'google' | 'icloud' | 'caldav';
  displayName?: string;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;
  syncEnabled: boolean;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 日历信息（每个账号可以有多个日历）
 */
export interface Calendar {
  id: string;
  accountId: string;
  name: string;
  color?: string;
  isDefault: boolean;
  syncToken?: string;
  lastSyncAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Event 扩展（添加存储相关字段）
 */
export interface StorageEvent extends Event {
  // 当前字段（MVP）
  sourceAccountId?: string;
  sourceCalendarId?: string;
  
  // 预留字段（Beta - 云端同步）
  remarkableUserId?: string;
  syncMode?: 'local-only' | 'bidirectional' | 'push-only';
  cloudSyncStatus?: 'synced' | 'pending' | 'conflict';
  lastCloudSyncAt?: string;
}

/**
 * 附件信息
 */
export interface Attachment {
  id: string;
  eventId: string;
  type: 'image' | 'audio' | 'document';
  name: string;
  size: number;
  mimeType: string;
  filePath: string;
  thumbnail?: string;
  createdAt: string;
}

/**
 * 同步队列项
 */
export interface SyncQueueItem {
  id: string;
  accountId?: string;
  operation: 'create' | 'update' | 'delete';
  entityType: 'event' | 'contact' | 'tag' | 'eventlog';
  entityId: string;
  data: any;
  status: SyncStatus;
  attempts: number;
  lastAttemptAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * 元数据（存储配置、版本信息等）
 */
export interface Metadata {
  key: string;
  value: any;
  updatedAt: string;
}

/**
 * 查询选项
 */
export interface QueryOptions {
  // 分页
  offset?: number;
  limit?: number;
  
  // 排序
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  
  // 筛选
  filters?: Record<string, any>;
  
  // 搜索
  searchQuery?: string;
  searchFields?: string[];
  
  // 时间范围
  startDate?: Date;
  endDate?: Date;
  
  // 账号过滤
  accountIds?: string[];
}

/**
 * 查询结果
 */
export interface QueryResult<T> {
  data: T[];
  total: number;
  hasMore: boolean;
}

/**
 * 批量操作结果
 */
export interface BatchResult<T> {
  success: T[];
  failed: Array<{ item: T; error: Error }>;
}

/**
 * 存储统计信息
 */
export interface StorageStats {
  indexedDB: {
    used: number;
    quota: number;
    percentage: number;
  };
  sqlite: {
    fileSize: number;
    vacuumSize: number;
  };
  fileSystem: {
    attachments: number;
    backups: number;
    logs: number;
  };
  cache: {
    size: number;
    hitRate: number;
  };
}

/**
 * 备份信息
 */
export interface BackupInfo {
  id: string;
  type: 'daily' | 'weekly' | 'monthly';
  filePath: string;
  size: number;
  eventCount: number;
  createdAt: string;
}
