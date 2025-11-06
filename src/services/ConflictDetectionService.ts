/**
 * ConflictDetectionService - 会议冲突检测服务
 * 
 * 功能：
 * - 检测事件时间冲突
 * - 检测参会人的日程冲突
 * - 提供冲突警告和建议
 */

import { Event, Contact } from '../types';
import { EventService } from './EventService';
import { parseLocalTimeString } from '../utils/timeUtils';

export interface ConflictInfo {
  /** 冲突的事件 */
  conflictingEvent: Event;
  /** 冲突的参会人 */
  conflictingAttendees: Contact[];
  /** 冲突类型 */
  type: 'full' | 'partial';
  /** 冲突时间范围 */
  overlapStart: Date;
  overlapEnd: Date;
}

export class ConflictDetectionService {
  /**
   * 检测事件是否与现有事件冲突
   * @param event 要检测的事件
   * @param excludeEventId 排除的事件 ID（用于编辑现有事件时）
   */
  static async detectConflicts(
    event: { start: string; end: string; attendees?: Contact[] },
    excludeEventId?: string
  ): Promise<ConflictInfo[]> {
    const allEvents = await EventService.getEvents();
    const conflicts: ConflictInfo[] = [];

    const eventStart = parseLocalTimeString(event.start);
    const eventEnd = parseLocalTimeString(event.end);

    for (const existingEvent of allEvents) {
      // 跳过被排除的事件（编辑场景）
      if (existingEvent.id === excludeEventId) continue;

      const existingStart = parseLocalTimeString(existingEvent.startTime);
      const existingEnd = parseLocalTimeString(existingEvent.endTime);

      // 检查时间是否重叠
      const overlap = this.getTimeOverlap(eventStart, eventEnd, existingStart, existingEnd);
      
      if (overlap) {
        // 检查参会人冲突
        const conflictingAttendees = this.getConflictingAttendees(
          event.attendees || [],
          existingEvent.attendees || []
        );

        conflicts.push({
          conflictingEvent: existingEvent,
          conflictingAttendees,
          type: this.getOverlapType(eventStart, eventEnd, existingStart, existingEnd),
          overlapStart: overlap.start,
          overlapEnd: overlap.end,
        });
      }
    }

    return conflicts;
  }

  /**
   * 检测参会人在指定时间段内的冲突
   * @param attendees 参会人列表
   * @param start 开始时间
   * @param end 结束时间
   * @param excludeEventId 排除的事件 ID
   */
  static async detectAttendeeConflicts(
    attendees: Contact[],
    start: string,
    end: string,
    excludeEventId?: string
  ): Promise<Map<string, ConflictInfo[]>> {
    const allEvents = await EventService.getEvents();
    const attendeeConflicts = new Map<string, ConflictInfo[]>();

    const eventStart = parseLocalTimeString(start);
    const eventEnd = parseLocalTimeString(end);

    // 为每个参会人检测冲突
    for (const attendee of attendees) {
      if (!attendee.email) continue;

      const conflicts: ConflictInfo[] = [];

      for (const existingEvent of allEvents) {
        if (existingEvent.id === excludeEventId) continue;

        // 检查该事件是否包含此参会人
        const hasAttendee = existingEvent.attendees?.some(
          a => a.email?.toLowerCase() === attendee.email?.toLowerCase()
        ) || existingEvent.organizer?.email?.toLowerCase() === attendee.email?.toLowerCase();

        if (!hasAttendee) continue;

        // 检查时间重叠
        const existingStart = parseLocalTimeString(existingEvent.startTime);
        const existingEnd = parseLocalTimeString(existingEvent.endTime);
        const overlap = this.getTimeOverlap(eventStart, eventEnd, existingStart, existingEnd);

        if (overlap) {
          conflicts.push({
            conflictingEvent: existingEvent,
            conflictingAttendees: [attendee],
            type: this.getOverlapType(eventStart, eventEnd, existingStart, existingEnd),
            overlapStart: overlap.start,
            overlapEnd: overlap.end,
          });
        }
      }

      if (conflicts.length > 0) {
        attendeeConflicts.set(attendee.email!, conflicts);
      }
    }

    return attendeeConflicts;
  }

  /**
   * 计算两个时间段的重叠部分
   */
  private static getTimeOverlap(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): { start: Date; end: Date } | null {
    const overlapStart = start1 > start2 ? start1 : start2;
    const overlapEnd = end1 < end2 ? end1 : end2;

    if (overlapStart < overlapEnd) {
      return { start: overlapStart, end: overlapEnd };
    }

    return null;
  }

  /**
   * 判断重叠类型
   */
  private static getOverlapType(
    start1: Date,
    end1: Date,
    start2: Date,
    end2: Date
  ): 'full' | 'partial' {
    // 完全重叠：一个时间段完全包含另一个
    if ((start1 <= start2 && end1 >= end2) || (start2 <= start1 && end2 >= end1)) {
      return 'full';
    }
    return 'partial';
  }

  /**
   * 获取冲突的参会人
   */
  private static getConflictingAttendees(
    attendees1: Contact[],
    attendees2: Contact[]
  ): Contact[] {
    const conflicts: Contact[] = [];

    for (const a1 of attendees1) {
      if (!a1.email) continue;
      
      const hasConflict = attendees2.some(
        a2 => a2.email?.toLowerCase() === a1.email?.toLowerCase()
      );

      if (hasConflict) {
        conflicts.push(a1);
      }
    }

    return conflicts;
  }

  /**
   * 格式化冲突信息为用户友好的文本
   */
  static formatConflictMessage(conflict: ConflictInfo): string {
    const { conflictingEvent, conflictingAttendees, type, overlapStart, overlapEnd } = conflict;
    
    const timeFormat = (date: Date) => {
      return date.toLocaleString('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    let message = `与「${conflictingEvent.title}」冲突\n`;
    message += `时间：${timeFormat(overlapStart)} - ${timeFormat(overlapEnd)}\n`;
    message += `类型：${type === 'full' ? '完全冲突' : '部分冲突'}\n`;

    if (conflictingAttendees.length > 0) {
      message += `冲突参会人：${conflictingAttendees.map(a => a.name || a.email).join(', ')}`;
    }

    return message;
  }

  /**
   * 生成冲突摘要
   */
  static getConflictSummary(conflicts: ConflictInfo[]): string {
    if (conflicts.length === 0) {
      return '无冲突';
    }

    const fullConflicts = conflicts.filter(c => c.type === 'full').length;
    const partialConflicts = conflicts.filter(c => c.type === 'partial').length;

    return `发现 ${conflicts.length} 个冲突（${fullConflicts} 个完全冲突，${partialConflicts} 个部分冲突）`;
  }

  /**
   * 建议最佳会议时间（简单实现：找到第一个无冲突的时间段）
   */
  static async suggestAlternativeTime(
    duration: number, // 持续时间（分钟）
    attendees: Contact[],
    preferredDate?: Date
  ): Promise<{ start: Date; end: Date } | null> {
    const allEvents = await EventService.getEvents();
    const workHoursStart = 9; // 工作时间开始：9:00
    const workHoursEnd = 18; // 工作时间结束：18:00
    const searchDate = preferredDate || new Date();

    // 简化版：在当天工作时间内寻找空闲时段
    for (let hour = workHoursStart; hour < workHoursEnd; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
        const start = new Date(searchDate);
        start.setHours(hour, minute, 0, 0);
        
        const end = new Date(start);
        end.setMinutes(end.getMinutes() + duration);

        // 检查是否超出工作时间
        if (end.getHours() >= workHoursEnd) continue;

        // 检查冲突
        const conflicts = await this.detectAttendeeConflicts(
          attendees,
          start.toISOString(),
          end.toISOString()
        );

        if (conflicts.size === 0) {
          return { start, end };
        }
      }
    }

    return null;
  }
}
