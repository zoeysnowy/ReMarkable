/**
 * 事件时间字段验证工具
 * 根据 isTask 字段区分验证规则
 * 
 * @module eventValidation
 * @created 2025-11-14
 * @version 1.0
 */

import { Event } from '../types';

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 验证事件的时间字段
 * 
 * 规则：
 * - Task 类型（isTask=true）：时间可选
 * - Calendar 事件（isTask=false/undefined）：时间必需
 * 
 * @param event - 待验证的事件对象
 * @returns 验证结果
 */
export function validateEventTime(event: Event): ValidationResult {
  const warnings: string[] = [];
  
  // Task 类型：时间可选
  if (event.isTask === true) {
    // Task 允许任意时间组合：
    // - 无时间: {startTime: undefined, endTime: undefined}
    // - 单开始时间: {startTime: '...', endTime: undefined}
    // - 单截止时间: {startTime: undefined, endTime: '...'} - deadline 场景
    // - 时间范围: {startTime: '...', endTime: '...'}
    
    if (!event.startTime && !event.endTime) {
      warnings.push('Task has no time - will sync to Microsoft To Do');
    }
    
    return { valid: true, warnings };
  }
  
  // Calendar 事件：时间必需
  if (!event.startTime || !event.endTime) {
    return {
      valid: false,
      error: 'Calendar event requires both startTime and endTime',
    };
  }
  
  // 验证时间格式
  if (!isValidTimeFormat(event.startTime) || !isValidTimeFormat(event.endTime)) {
    return {
      valid: false,
      error: 'Invalid time format - must be "YYYY-MM-DD HH:mm:ss"',
    };
  }
  
  // 验证时间逻辑（开始时间 <= 结束时间）
  if (new Date(event.startTime) > new Date(event.endTime)) {
    return {
      valid: false,
      error: 'Start time must be before or equal to end time',
    };
  }
  
  return { valid: true, warnings };
}

/**
 * 验证时间格式是否为 'YYYY-MM-DD HH:mm:ss'
 * 
 * @param timeStr - 时间字符串
 * @returns 是否有效
 */
function isValidTimeFormat(timeStr: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  return pattern.test(timeStr);
}

/**
 * 检查事件是否需要时间字段
 * 
 * @param event - 事件对象
 * @returns Task 返回 false，Calendar 返回 true
 */
export function requiresTime(event: Event): boolean {
  return event.isTask !== true;
}

/**
 * 检查事件是否有有效时间
 * 
 * @param event - 事件对象
 * @returns 是否同时具有 startTime 和 endTime
 */
export function hasValidTime(event: Event): boolean {
  return !!(event.startTime && event.endTime);
}

/**
 * 检查事件是否有任何时间信息（用于同步判断）
 * 
 * @param event - 事件对象
 * @returns 是否具有 startTime、endTime 或 dueDate
 */
export function hasAnyTime(event: Event): boolean {
  return !!(event.startTime || event.endTime || event.dueDate);
}
