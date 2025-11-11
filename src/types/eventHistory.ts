/**
 * 事件历史记录相关类型定义
 */

import { Event } from '../types';

/**
 * 变更操作类型
 */
export type ChangeOperation = 'create' | 'update' | 'delete' | 'checkin';

/**
 * 变更字段详情
 */
export interface ChangeDetail {
  /** 字段名 */
  field: string;
  /** 旧值 */
  oldValue: any;
  /** 新值 */
  newValue: any;
  /** 显示名称 */
  displayName?: string;
}

/**
 * 事件变更日志
 */
export interface EventChangeLog {
  /** 日志 ID */
  id: string;
  /** 事件 ID */
  eventId: string;
  /** 操作类型 */
  operation: ChangeOperation;
  /** 时间戳 */
  timestamp: string;
  /** 变更前的状态 */
  before?: Partial<Event>;
  /** 变更后的状态 */
  after?: Partial<Event>;
  /** 来源 */
  source: string;
  /** 变更字段详情 */
  changes?: ChangeDetail[];
  /** 额外元数据 */
  metadata?: Record<string, any>;
}

/**
 * 历史查询选项
 */
export interface HistoryQueryOptions {
  /** 事件 ID */
  eventId?: string;
  /** 操作类型列表 */
  operations?: ChangeOperation[];
  /** 开始时间 */
  startTime?: string;
  /** 结束时间 */
  endTime?: string;
  /** 偏移量（分页） */
  offset?: number;
  /** 限制数量（分页） */
  limit?: number;
}

/**
 * 历史统计信息
 */
export interface HistoryStatistics {
  /** 总变更数 */
  totalChanges: number;
  /** 创建次数 */
  createCount: number;
  /** 更新次数 */
  updateCount: number;
  /** 删除次数 */
  deleteCount: number;
  /** 签到次数 */
  checkinCount: number;
  /** 时间范围 */
  dateRange: {
    earliest: string;
    latest: string;
  };
  /** 修改最频繁的事件 */
  topModifiedEvents: Array<{
    eventId: string;
    title: string;
    changeCount: number;
  }>;
}
