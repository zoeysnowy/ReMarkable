/**
 * 同步路由工具
 * 根据事件类型决定同步目标
 * 
 * @module syncRouter
 * @created 2025-11-14
 * @version 1.0
 */

import { Event } from '../types';

export type SyncTarget = 'calendar' | 'todo' | 'none';

export interface SyncRoute {
  target: SyncTarget;
  reason: string;
}

/**
 * 决定事件的同步目标
 * 
 * 规则：
 * 1. Task 类型（isTask=true）→ Microsoft To Do
 * 2. Calendar 事件且有时间 → Outlook Calendar
 * 3. Calendar 事件但无时间 → 不同步
 * 
 * @param event - 事件对象
 * @returns 同步路由信息
 */
export function determineSyncTarget(event: Event): SyncRoute {
  // 1. Task 类型 → Microsoft To Do
  if (event.isTask === true) {
    return {
      target: 'todo',
      reason: 'Task event syncs to Microsoft To Do',
    };
  }
  
  // 2. Calendar 事件且有时间 → Outlook Calendar
  if (event.startTime && event.endTime) {
    return {
      target: 'calendar',
      reason: 'Calendar event with time syncs to Outlook Calendar',
    };
  }
  
  // 3. Calendar 事件但无时间 → 不同步
  return {
    target: 'none',
    reason: 'Calendar event without time cannot sync',
  };
}

/**
 * 检查事件是否应该同步
 * 
 * @param event - 事件对象
 * @returns 是否应该同步
 */
export function shouldSync(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target !== 'none';
}

/**
 * 检查事件是否应该同步到 Calendar
 * 
 * @param event - 事件对象
 * @returns 是否应该同步到 Outlook Calendar
 */
export function shouldSyncToCalendar(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target === 'calendar';
}

/**
 * 检查事件是否应该同步到 To Do
 * 
 * @param event - 事件对象
 * @returns 是否应该同步到 Microsoft To Do
 */
export function shouldSyncToTodo(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target === 'todo';
}
