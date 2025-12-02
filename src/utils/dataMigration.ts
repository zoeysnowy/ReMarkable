/**
 * 数据迁移工具 - localStorage → StorageManager
 * 
 * 职责：
 * 1. 检测是否需要迁移（localStorage 有数据且 IndexedDB 无数据）
 * 2. 读取 localStorage 中的所有事件
 * 3. 规范化并批量写入 StorageManager
 * 4. 验证迁移完整性
 * 5. 可选：清理 localStorage（保留备份）
 * 
 * @version 1.0.0
 * @date 2025-12-01
 */

import { storageManager } from '../services/storage/StorageManager';
import { STORAGE_KEYS } from '../constants/storage';
import type { Event } from '../types';

export interface MigrationResult {
  success: boolean;
  migratedCount: number;
  failedCount: number;
  errors: string[];
  duration: number;
}

/**
 * 检查是否需要迁移
 */
export async function needsMigration(): Promise<boolean> {
  try {
    // 1. 检查 localStorage 是否有数据
    const localStorageData = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!localStorageData) {
      console.log('[Migration] No data in localStorage, skip migration');
      return false;
    }

    const localEvents = JSON.parse(localStorageData);
    if (!Array.isArray(localEvents) || localEvents.length === 0) {
      console.log('[Migration] localStorage events is empty, skip migration');
      return false;
    }

    // 2. 检查 StorageManager 是否已有数据
    const stats = await storageManager.getStats();
    const hasIndexedDBData = (stats.indexedDB?.eventsCount || 0) > 0;

    if (hasIndexedDBData) {
      console.log('[Migration] StorageManager already has data, skip migration');
      return false;
    }

    console.log('[Migration] Migration needed:', {
      localStorageCount: localEvents.length,
      indexedDBCount: stats.indexedDB?.eventsCount || 0
    });

    return true;
  } catch (error) {
    console.error('[Migration] Failed to check migration status:', error);
    return false;
  }
}

/**
 * 执行数据迁移
 */
export async function migrateFromLocalStorage(): Promise<MigrationResult> {
  const startTime = Date.now();
  const result: MigrationResult = {
    success: false,
    migratedCount: 0,
    failedCount: 0,
    errors: [],
    duration: 0
  };

  try {
    console.log('[Migration] Starting data migration...');

    // 1. 读取 localStorage 数据
    const localStorageData = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (!localStorageData) {
      throw new Error('No data in localStorage');
    }

    const localEvents: Event[] = JSON.parse(localStorageData);
    console.log('[Migration] Found', localEvents.length, 'events in localStorage');

    // 2. 创建备份（可选，放在 localStorage 的另一个 key）
    try {
      const backupKey = `${STORAGE_KEYS.EVENTS}_backup_${Date.now()}`;
      localStorage.setItem(backupKey, localStorageData);
      console.log('[Migration] Created backup:', backupKey);
    } catch (backupError) {
      console.warn('[Migration] Failed to create backup (non-blocking):', backupError);
    }

    // 3. 批量写入 StorageManager
    // 注意：需要使用 EventService 的 normalizeEvent 来规范化数据
    // 但为了避免循环依赖，我们这里直接调用 StorageManager
    
    const { EventService } = await import('../services/EventService');
    
    const normalizedEvents = localEvents.map(event => {
      try {
        // 使用 EventService 的私有方法进行规范化（需要暴露或使用公共接口）
        // 这里简化处理：直接转换
        return EventService['normalizeEvent'](event);
      } catch (error) {
        console.warn('[Migration] Failed to normalize event:', event.id, error);
        return event; // 降级：使用原始数据
      }
    });

    // 转换为 StorageEvent 格式
    const storageEvents = normalizedEvents.map(event => 
      EventService['convertEventToStorageEvent'](event)
    );

    // 批量创建
    const batchResult = await storageManager.batchCreateEvents(storageEvents);

    result.migratedCount = batchResult.success.length;
    result.failedCount = batchResult.failed.length;
    result.errors = batchResult.failed.map(f => 
      `${f.item.id}: ${f.error.message}`
    );

    console.log('[Migration] Batch migration result:', {
      success: batchResult.success.length,
      failed: batchResult.failed.length
    });

    // 4. 验证迁移完整性
    const stats = await storageManager.getStats();
    const migratedCount = stats.indexedDB?.eventsCount || 0;

    if (migratedCount !== localEvents.length) {
      console.warn('[Migration] Migration count mismatch:', {
        expected: localEvents.length,
        actual: migratedCount
      });
    }

    result.success = batchResult.failed.length === 0;
    result.duration = Date.now() - startTime;

    console.log('[Migration] ✅ Migration completed:', {
      success: result.success,
      migratedCount: result.migratedCount,
      failedCount: result.failedCount,
      duration: `${result.duration}ms`
    });

    // 5. 可选：标记迁移完成（避免重复迁移）
    try {
      localStorage.setItem('4dnote_migration_completed', Date.now().toString());
    } catch (error) {
      console.warn('[Migration] Failed to set migration flag:', error);
    }

    return result;
  } catch (error) {
    console.error('[Migration] ❌ Migration failed:', error);
    result.success = false;
    result.errors.push(String(error));
    result.duration = Date.now() - startTime;
    return result;
  }
}

/**
 * 清理 localStorage 数据（可选，慎用）
 * 建议：保留备份至少30天
 */
export function cleanupLocalStorage(keepBackup: boolean = true): void {
  try {
    if (!keepBackup) {
      localStorage.removeItem(STORAGE_KEYS.EVENTS);
      console.log('[Migration] localStorage events data removed');
    } else {
      console.log('[Migration] localStorage backup retained for safety');
    }
  } catch (error) {
    console.error('[Migration] Failed to cleanup localStorage:', error);
  }
}

/**
 * 检查迁移状态（用于 UI 显示）
 */
export function getMigrationStatus(): {
  completed: boolean;
  completedAt?: string;
} {
  const completedFlag = localStorage.getItem('4dnote_migration_completed');
  
  return {
    completed: !!completedFlag,
    completedAt: completedFlag ? new Date(parseInt(completedFlag)).toISOString() : undefined
  };
}
