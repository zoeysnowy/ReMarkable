/**
 * Calendar Utils - 日历数据转换工具
 * 
 * 负责 ReMarkable Event 与 TUI Calendar EventObject 之间的数据转换
 * 
 * @charset UTF-8
 * @author Zoey Gong
 * @version 1.0.0
 */

import type { EventObject } from '@toast-ui/calendar';
import { Event } from '../types';
import { parseLocalTimeString, formatTimeForStorage } from './timeUtils';

/**
 * 生成唯一ID
 */
export function generateEventId(): string {
  return `event-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * 获取标签颜色
 * @param tagId 标签ID
 * @param tags 标签列表
 * @returns 颜色值
 */
export function getTagColor(tagId: string | undefined, tags: any[]): string {
  if (!tagId) {
    return '#3788d8'; // 默认颜色
  }
  
  const findTag = (tagList: any[]): any => {
    for (const tag of tagList) {
      if (tag.id === tagId) return tag;
      if (tag.children && tag.children.length > 0) {
        const found = findTag(tag.children);
        if (found) return found;
      }
    }
    return null;
  };
  
  const tag = findTag(tags);
  const color = tag?.color || '#3788d8';
  
  return color;
}

/**
 * 获取事件颜色（支持多标签，返回第一个标签的颜色）
 * @param event 事件对象
 * @param tags 标签列表
 * @returns 颜色值
 */
export function getEventColor(event: Event, tags: any[]): string {
  // 优先级 1: 如果有 tags 数组，使用第一个标签的颜色
  if (event.tags && event.tags.length > 0) {
    const firstTagId = event.tags[0];
    const color = getTagColor(firstTagId, tags);
    if (color && color !== '#3788d8') {
      return color;
    }
  }

  // 优先级 2: 如果有 tagId（向后兼容），使用它的颜色
  if (event.tagId) {
    const color = getTagColor(event.tagId, tags);
    if (color && color !== '#3788d8') return color; // 只有找到非默认颜色才返回
  }

  // 优先级 3: 回退到事件关联的日历分组颜色
  if (event.calendarId) {
    const calendarColor = getCalendarGroupColor(event.calendarId);
    if (calendarColor) return calendarColor;
  }

  // 优先级 4: 默认蓝色
  return '#3788d8';
}

/**
 * 从 localStorage 获取日历分组颜色
 * @param calendarId 日历ID
 * @returns 颜色值或null
 */
export function getCalendarGroupColor(calendarId: string): string | null {
  try {
    const calendarsCache = localStorage.getItem('remarkable-calendars-cache');
    if (!calendarsCache) return null;
    
    const calendars = JSON.parse(calendarsCache);
    const calendar = calendars.find((cal: any) => cal.id === calendarId);
    
    // Microsoft Calendar颜色名称映射
    if (calendar?.color) {
      return convertMicrosoftColorToHex(calendar.color);
    }
    
    // 如果calendar对象有backgroundColor，直接使用
    if (calendar?.backgroundColor) {
      return calendar.backgroundColor;
    }
    
    return null;
  } catch (error) {
    console.warn('Failed to get calendar color:', error);
    return null;
  }
}

/**
 * 将Microsoft颜色名称转换为十六进制颜色
 * @param colorName Microsoft颜色名称
 * @returns 十六进制颜色值
 */
function convertMicrosoftColorToHex(colorName: string): string {
  const colorMap: { [key: string]: string } = {
    'auto': '#3788d8',
    'lightBlue': '#5194f0',
    'lightGreen': '#42b883',
    'lightOrange': '#ff8c42',
    'lightGray': '#9ca3af',
    'lightYellow': '#f1c40f',
    'lightTeal': '#48c9b0',
    'lightPink': '#f48fb1',
    'lightBrown': '#a0826d',
    'lightRed': '#e74c3c',
    'maxColor': '#6366f1'
  };
  
  return colorMap[colorName] || '#3788d8';
}

/**
 * 获取标签显示名称（支持层级）
 * @param tagId 标签ID
 * @param tags 标签列表
 * @returns 显示名称
 */
export function getTagDisplayName(tagId: string | undefined, tags: any[]): string {
  if (!tagId) return '未分类';
  
  const findTagWithPath = (tagList: any[], parentPath: string = ''): string => {
    for (const tag of tagList) {
      const currentPath = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
      if (tag.id === tagId) return currentPath;
      if (tag.children && tag.children.length > 0) {
        const found = findTagWithPath(tag.children, currentPath);
        if (found) return found;
      }
    }
    return '';
  };
  
  return findTagWithPath(tags) || '未分类';
}

/**
 * 扁平化标签树结构
 * @param tags 层级标签数组
 * @returns 扁平化的标签数组
 */
export function flattenTags(tags: any[]): any[] {
  const result: any[] = [];
  
  const flatten = (tagList: any[], parentName = '', level = 0) => {
    tagList.forEach(tag => {
      const displayName = parentName ? `${parentName} > ${tag.name}` : tag.name;
      result.push({
        ...tag,
        displayName,
        parentName,
        level
      });
      
      if (tag.children && tag.children.length > 0) {
        flatten(tag.children, displayName, level + 1);
      }
    });
  };
  
  flatten(tags);
  return result;
}

/**
 * 将 ReMarkable Event 转换为 TUI Calendar EventObject
 * @param event ReMarkable 事件对象
 * @param tags 标签列表（用于获取颜色）
 * @returns TUI Calendar 事件对象
 */
export function convertToCalendarEvent(
  event: Event, 
  tags: any[] = [],
  runningTimerEventId: string | null = null
): Partial<EventObject> {
  const startDate = parseLocalTimeString(event.startTime);
  const endDate = parseLocalTimeString(event.endTime);
  
  // 🎨 使用getEventColor获取正确的颜色（支持多标签和日历颜色）
  const eventColor = getEventColor(event, tags);
  
  // 📋 确定 calendarId：优先使用第一个标签，然后是 tagId，最后是 calendarId
  let calendarId = 'default';
  if (event.tags && event.tags.length > 0) {
    calendarId = event.tags[0]; // 使用第一个标签作为日历分组
  } else if (event.tagId) {
    calendarId = event.tagId;
  } else if (event.calendarId) {
    calendarId = event.calendarId;
  }
  
  // 🎯 确定事件类型（category）
  // TUI Calendar 支持: 'milestone', 'task', 'allday', 'time'
  let category: 'milestone' | 'task' | 'allday' | 'time' = 'time';
  
  // 优先使用新的布尔字段（isMilestone, isTask）
  if (event.isMilestone) {
    category = 'milestone';
  } else if (event.isTask) {
    category = 'task';
  } 
  // 回退到旧的 category 字符串字段（向后兼容）
  else if (event.category === 'milestone') {
    category = 'milestone';
  } else if (event.category === 'task') {
    category = 'task';
  } 
  // 全天事件
  else if (event.isAllDay) {
    category = 'allday';
  } 
  // 默认时间事件
  else {
    category = 'time';
  }
  
  // 🔧 前端渲染时添加"[专注中]"标记（仅计时中的事件）
  // localStorage 中不包含此标记，避免事件重复
  const isTimerRunning = runningTimerEventId !== null && event.id === runningTimerEventId;
  const displayTitle = isTimerRunning ? `[专注中] ${event.title}` : event.title;
  
  return {
    id: event.id,
    calendarId: calendarId,
    title: displayTitle,
    body: event.description || '',
    start: startDate,
    end: endDate,
    isAllday: event.isAllDay || false,
    category: category,
    location: event.location || '',
    // 颜色配置 - 使用事件颜色（标签颜色或日历颜色）
    color: '#ffffff',
    backgroundColor: eventColor,
    borderColor: eventColor,
    // 自定义数据（保留原始事件信息）
    raw: {
      remarkableEvent: event,
      externalId: event.externalId,
      syncStatus: event.syncStatus,
      tagId: event.tagId,
      tags: event.tags,
      calendarId: event.calendarId,
      category: event.category
    }
  };
}

/**
 * 将 TUI Calendar EventObject 转换为 ReMarkable Event
 * @param calendarEvent TUI Calendar 事件对象
 * @param originalEvent 原始事件（用于保留某些字段）
 * @returns ReMarkable 事件对象
 */
export function convertFromCalendarEvent(
  calendarEvent: any, 
  originalEvent?: Event
): Event {
  const now = new Date();
  const nowStr = formatTimeForStorage(now);
  
  // 如果有原始事件数据，优先使用
  if (calendarEvent.raw?.remarkableEvent) {
    return {
      ...calendarEvent.raw.remarkableEvent,
      // 更新可能被修改的字段
      title: calendarEvent.title || calendarEvent.raw.remarkableEvent.title,
      description: calendarEvent.body || calendarEvent.raw.remarkableEvent.description,
      startTime: formatTimeForStorage(calendarEvent.start),
      endTime: formatTimeForStorage(calendarEvent.end),
      isAllDay: calendarEvent.isAllday || false,
      location: calendarEvent.location || calendarEvent.raw.remarkableEvent.location,
      updatedAt: nowStr
    };
  }
  
  // 创建新事件
  return {
    id: calendarEvent.id || generateEventId(),
    title: calendarEvent.title || '(无标题)',
    description: calendarEvent.body || '',
    startTime: formatTimeForStorage(calendarEvent.start),
    endTime: formatTimeForStorage(calendarEvent.end),
    isAllDay: calendarEvent.isAllday || false,
    location: calendarEvent.location || '',
    tagId: calendarEvent.calendarId !== 'default' ? calendarEvent.calendarId : '',
    category: originalEvent?.category || 'planning',
    // 继承原始事件的同步信息
    externalId: originalEvent?.externalId,
    syncStatus: originalEvent?.syncStatus,
    calendarId: originalEvent?.calendarId,
    remarkableSource: true,
    // 时间戳
    createdAt: originalEvent?.createdAt || nowStr,
    updatedAt: nowStr,
    lastLocalChange: nowStr,
    localVersion: (originalEvent?.localVersion || 0) + 1
  };
}

/**
 * 批量转换 ReMarkable Events 到 TUI Calendar Events
 * @param events ReMarkable 事件数组
 * @param tags 标签列表
 * @returns TUI Calendar 事件数组
 */
export function convertToCalendarEvents(
  events: Event[], 
  tags: any[] = []
): Partial<EventObject>[] {
  return events.map(event => convertToCalendarEvent(event, tags));
}

/**
 * 创建日历分组配置
 * @param tags 标签列表
 * @returns TUI Calendar 的 calendars 配置
 */
export function createCalendarsFromTags(tags: any[]): any[] {
  const flatTags = flattenTags(tags);
  const eventTags = flatTags.filter(
    tag => tag.category === 'ongoing' || tag.category === 'planning'
  );
  
  return [
    {
      id: 'default',
      name: '默认日历',
      color: '#ffffff',
      backgroundColor: '#3788d8',
      borderColor: '#3788d8',
      dragBackgroundColor: 'rgba(55, 136, 216, 0.3)'
    },
    ...eventTags.map(tag => ({
      id: tag.id,
      name: tag.displayName || tag.name,
      color: '#ffffff',
      backgroundColor: tag.color || '#3788d8',
      borderColor: tag.color || '#3788d8',
      dragBackgroundColor: `${tag.color}33` || 'rgba(55, 136, 216, 0.3)' // 透明度20%
    }))
  ];
}

/**
 * 验证事件数据完整性
 * @param event 事件对象
 * @returns 是否有效
 */
export function validateEvent(event: Partial<Event>): boolean {
  if (!event.title || event.title.trim() === '') {
    console.error('❌ Event validation failed: title is required');
    return false;
  }
  
  if (!event.startTime || !event.endTime) {
    console.error('❌ Event validation failed: startTime and endTime are required');
    return false;
  }
  
  const start = parseLocalTimeString(event.startTime);
  const end = parseLocalTimeString(event.endTime);
  
  if (start.getTime() >= end.getTime()) {
    console.error('❌ Event validation failed: endTime must be after startTime');
    return false;
  }
  
  return true;
}

/**
 * 合并事件更新
 * @param original 原始事件
 * @param updates 更新内容
 * @returns 合并后的事件
 */
export function mergeEventUpdates(original: Event, updates: Partial<Event>): Event {
  return {
    ...original,
    ...updates,
    id: original.id, // ID 不能被修改
    createdAt: original.createdAt, // 创建时间不能被修改
    updatedAt: formatTimeForStorage(new Date()),
    lastLocalChange: formatTimeForStorage(new Date()),
    localVersion: (original.localVersion || 0) + 1
  };
}
