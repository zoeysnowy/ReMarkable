/**
 * EventHistoryService - 事件变更历史记录服务
 * 
 * 职责：
 * 1. 记录所有事件的 CRUD 操作历史
 * 2. 支持按时间范围、事件ID、操作类型查询历史
 * 3. 提供历史统计分析功能
 * 4. 自动清理过期历史记录
 */

import { Event } from '../types';
import {
  EventChangeLog,
  ChangeOperation,
  ChangeDetail,
  HistoryQueryOptions,
  HistoryStatistics
} from '../types/eventHistory';
import { STORAGE_KEYS } from '../constants/storage';
import { logger } from '../utils/logger';
import { formatTimeForStorage } from '../utils/timeUtils';

const historyLogger = logger.module('EventHistory');

// 历史记录存储键
const HISTORY_STORAGE_KEY = 'remarkable_event_history';

// 默认保留历史记录的天数（90天）
const DEFAULT_RETENTION_DAYS = 90;

// 字段显示名称映射
const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title: '标题',
  description: '描述',
  startTime: '开始时间',
  endTime: '结束时间',
  isAllDay: '全天事件',
  location: '地点',
  tags: '标签',
  priority: '优先级',
  isCompleted: '完成状态',
  color: '颜色',
  emoji: '图标',
  reminder: '提醒',
  content: '内容',
  notes: '备注'
};

export class EventHistoryService {
  /**
   * 记录事件创建
   */
  static logCreate(event: Event, source: string = 'user'): EventChangeLog {
    const log: EventChangeLog = {
      id: this.generateLogId(),
      eventId: event.id,
      operation: 'create',
      timestamp: formatTimeForStorage(new Date()),
      after: { ...event },
      source,
      changes: this.extractChanges({}, event)
    };

    this.saveLog(log);
    historyLogger.log('📝 [Create] 记录创建:', event.title);
    return log;
  }

  /**
   * 记录事件更新
   */
  static logUpdate(
    eventId: string,
    before: Event,
    after: Partial<Event>,
    source: string = 'user'
  ): EventChangeLog {
    const changes = this.extractChanges(before, after);
    
    // 如果没有实质性变更，不记录
    if (changes.length === 0) {
      return null as any;
    }

    const log: EventChangeLog = {
      id: this.generateLogId(),
      eventId,
      operation: 'update',
      timestamp: formatTimeForStorage(new Date()),
      before: { ...before },
      after: { ...after },
      source,
      changes
    };

    this.saveLog(log);
    historyLogger.log('✏️ [Update] 记录更新:', before.title, `(${changes.length}个字段)`);
    return log;
  }

  /**
   * 记录事件删除
   */
  static logDelete(event: Event, source: string = 'user'): EventChangeLog {
    const log: EventChangeLog = {
      id: this.generateLogId(),
      eventId: event.id,
      operation: 'delete',
      timestamp: formatTimeForStorage(new Date()),
      before: { ...event },
      source
    };

    this.saveLog(log);
    historyLogger.log('🗑️ [Delete] 记录删除:', event.title);
    return log;
  }

  /**
   * 记录签到操作
   */
  static logCheckin(eventId: string, eventTitle: string, metadata?: Record<string, any>): EventChangeLog {
    const log: EventChangeLog = {
      id: this.generateLogId(),
      eventId,
      operation: 'checkin',
      timestamp: formatTimeForStorage(new Date()),
      source: 'user',
      metadata
    };

    this.saveLog(log);
    historyLogger.log('✅ [Checkin] 记录签到:', eventTitle);
    return log;
  }

  /**
   * 查询历史记录
   */
  static queryHistory(options: HistoryQueryOptions = {}): EventChangeLog[] {
    try {
      let logs = this.getAllLogs();

      // 按事件ID过滤
      if (options.eventId) {
        logs = logs.filter(log => log.eventId === options.eventId);
      }

      // 按操作类型过滤
      if (options.operations && options.operations.length > 0) {
        logs = logs.filter(log => options.operations!.includes(log.operation));
      }

      // 按时间范围过滤
      if (options.startTime) {
        const startMs = new Date(options.startTime).getTime();
        logs = logs.filter(log => new Date(log.timestamp).getTime() >= startMs);
      }
      if (options.endTime) {
        const endMs = new Date(options.endTime).getTime();
        logs = logs.filter(log => new Date(log.timestamp).getTime() <= endMs);
      }

      // 按时间倒序排序（最新的在前）
      logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      // 分页
      if (options.offset !== undefined) {
        logs = logs.slice(options.offset);
      }
      if (options.limit !== undefined) {
        logs = logs.slice(0, options.limit);
      }

      return logs;
    } catch (error) {
      historyLogger.error('❌ 查询历史失败:', error);
      return [];
    }
  }

  /**
   * 获取指定时间段的所有变更
   */
  static getChangesByTimeRange(startTime: string, endTime: string): EventChangeLog[] {
    return this.queryHistory({ startTime, endTime });
  }

  /**
   * 获取单个事件的完整历史
   */
  static getEventHistory(eventId: string): EventChangeLog[] {
    return this.queryHistory({ eventId });
  }

  /**
   * 获取历史统计信息
   */
  static getStatistics(startTime?: string, endTime?: string): HistoryStatistics {
    const logs = this.queryHistory({ startTime, endTime });

    // 统计各类操作数量
    const stats: HistoryStatistics = {
      totalChanges: logs.length,
      createCount: logs.filter(l => l.operation === 'create').length,
      updateCount: logs.filter(l => l.operation === 'update').length,
      deleteCount: logs.filter(l => l.operation === 'delete').length,
      checkinCount: logs.filter(l => l.operation === 'checkin').length,
      dateRange: {
        earliest: logs.length > 0 ? logs[logs.length - 1].timestamp : '',
        latest: logs.length > 0 ? logs[0].timestamp : ''
      },
      topModifiedEvents: []
    };

    // 统计修改最频繁的事件
    const eventChangeCounts = new Map<string, { title: string; count: number }>();
    
    logs.forEach(log => {
      if (log.operation === 'update') {
        const current = eventChangeCounts.get(log.eventId) || {
          title: (log.before as any)?.title || (log.after as any)?.title || 'Unknown',
          count: 0
        };
        current.count++;
        eventChangeCounts.set(log.eventId, current);
      }
    });

    stats.topModifiedEvents = Array.from(eventChangeCounts.entries())
      .map(([eventId, data]) => ({
        eventId,
        title: data.title,
        changeCount: data.count
      }))
      .sort((a, b) => b.changeCount - a.changeCount)
      .slice(0, 10); // 取前10个

    return stats;
  }

  /**
   * 清理过期历史记录
   */
  static cleanupOldLogs(retentionDays: number = DEFAULT_RETENTION_DAYS): number {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      const cutoffMs = cutoffDate.getTime();

      const allLogs = this.getAllLogs();
      const beforeCount = allLogs.length;

      const filteredLogs = allLogs.filter(log => {
        return new Date(log.timestamp).getTime() >= cutoffMs;
      });

      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filteredLogs));
      
      const removedCount = beforeCount - filteredLogs.length;
      historyLogger.log(`🧹 清理完成: 删除了 ${removedCount} 条过期记录 (保留${retentionDays}天内)`);
      
      return removedCount;
    } catch (error) {
      historyLogger.error('❌ 清理失败:', error);
      return 0;
    }
  }

  /**
   * 导出历史记录为 JSON
   */
  static exportToJSON(options: HistoryQueryOptions = {}): string {
    const logs = this.queryHistory(options);
    return JSON.stringify(logs, null, 2);
  }

  /**
   * 导出历史记录为 CSV
   */
  static exportToCSV(options: HistoryQueryOptions = {}): string {
    const logs = this.queryHistory(options);
    
    // CSV 头部
    const headers = ['时间', '事件ID', '事件标题', '操作', '变更字段', '来源'];
    const rows = [headers.join(',')];

    // 数据行
    logs.forEach(log => {
      const title = (log.before as any)?.title || (log.after as any)?.title || '';
      const changes = log.changes?.map((c: ChangeDetail) => `${c.displayName || c.field}`).join('; ') || '';
      
      const row = [
        log.timestamp,
        log.eventId,
        `"${title.replace(/"/g, '""')}"`, // CSV转义
        log.operation,
        `"${changes.replace(/"/g, '""')}"`,
        log.source || ''
      ];
      
      rows.push(row.join(','));
    });

    return rows.join('\n');
  }

  /**
   * 清空所有历史记录（慎用！）
   */
  static clearAll(): void {
    localStorage.removeItem(HISTORY_STORAGE_KEY);
    historyLogger.warn('⚠️ 已清空所有历史记录');
  }

  // ==================== 私有方法 ====================

  /**
   * 生成日志ID
   */
  private static generateLogId(): string {
    return `log_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }

  /**
   * 保存日志到存储
   */
  private static saveLog(log: EventChangeLog): void {
    try {
      const logs = this.getAllLogs();
      logs.push(log);
      
      // 如果记录太多，自动清理旧记录
      if (logs.length > 10000) {
        this.cleanupOldLogs();
      } else {
        localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(logs));
      }
    } catch (error) {
      historyLogger.error('❌ 保存日志失败:', error);
    }
  }

  /**
   * 获取所有日志
   */
  private static getAllLogs(): EventChangeLog[] {
    try {
      const saved = localStorage.getItem(HISTORY_STORAGE_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch (error) {
      historyLogger.error('❌ 读取历史失败:', error);
      return [];
    }
  }

  /**
   * 提取变更字段详情
   */
  private static extractChanges(before: Partial<Event>, after: Partial<Event>): ChangeDetail[] {
    const changes: ChangeDetail[] = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);

    // 忽略的字段（自动更新的元数据）
    const ignoredFields = new Set(['updatedAt', 'localVersion', 'lastLocalChange', 'lastSyncTime']);

    allKeys.forEach(key => {
      if (ignoredFields.has(key)) return;

      const oldValue = (before as any)[key];
      const newValue = (after as any)[key];

      // 深度比较（处理数组和对象）
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        changes.push({
          field: key,
          oldValue,
          newValue,
          displayName: FIELD_DISPLAY_NAMES[key] || key
        });
      }
    });

    return changes;
  }
}
