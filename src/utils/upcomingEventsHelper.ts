import { Event } from '../types';

export type TimeFilter = 'today' | 'tomorrow' | 'week' | 'nextWeek' | 'all';

/**
 * 获取时间范围的开始和结束时间
 */
export function getTimeRange(filter: TimeFilter, now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  switch (filter) {
    case 'today':
      // 今天 00:00 - 23:59
      return { start, end };

    case 'tomorrow':
      // 明天 00:00 - 23:59
      start.setDate(start.getDate() + 1);
      end.setDate(end.getDate() + 1);
      return { start, end };

    case 'week':
      // 本周（周一到周日）
      const dayOfWeek = start.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // 调整到周一
      start.setDate(start.getDate() + diff);
      end.setDate(start.getDate() + 6); // 到周日
      end.setHours(23, 59, 59, 999);
      return { start, end };

    case 'nextWeek':
      // 下周（下周一到下周日）
      const currentDayOfWeek = start.getDay();
      const daysToNextMonday = currentDayOfWeek === 0 ? 1 : 8 - currentDayOfWeek;
      start.setDate(start.getDate() + daysToNextMonday);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };

    case 'all':
      // 所有事件（从今天开始）
      end.setFullYear(end.getFullYear() + 10); // 未来10年
      return { start, end };

    default:
      return { start, end };
  }
}

/**
 * 判断事件是否在指定时间范围内
 */
export function isEventInRange(event: Event, start: Date, end: Date): boolean {
  const eventDate = new Date(event.date);
  
  // 如果有开始时间，使用开始时间
  if (event.startTime) {
    const [hours, minutes] = event.startTime.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
  } else {
    eventDate.setHours(0, 0, 0, 0);
  }

  return eventDate >= start && eventDate <= end;
}

/**
 * 判断事件是否已过期
 */
export function isEventExpired(event: Event, now: Date = new Date()): boolean {
  const eventDate = new Date(event.date);
  
  if (event.endTime) {
    // 如果有结束时间，使用结束时间判断
    const [hours, minutes] = event.endTime.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    return eventDate < now;
  } else if (event.startTime) {
    // 如果只有开始时间，使用开始时间判断
    const [hours, minutes] = event.startTime.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
    return eventDate < now;
  } else {
    // 全天事件，比较日期
    eventDate.setHours(23, 59, 59, 999);
    return eventDate < now;
  }
}

/**
 * 计算事件距离现在的时间差（用于排序）
 */
export function getEventTimeDiff(event: Event, now: Date = new Date()): number {
  const eventDate = new Date(event.date);
  
  if (event.startTime) {
    const [hours, minutes] = event.startTime.split(':').map(Number);
    eventDate.setHours(hours, minutes, 0, 0);
  } else {
    eventDate.setHours(0, 0, 0, 0);
  }

  return eventDate.getTime() - now.getTime();
}

/**
 * 对事件进行排序：即将开始的优先，然后是过期事件
 */
export function sortEvents(events: Event[], now: Date = new Date()): Event[] {
  return events.sort((a, b) => {
    const aExpired = isEventExpired(a, now);
    const bExpired = isEventExpired(b, now);

    // 未过期事件优先
    if (!aExpired && bExpired) return -1;
    if (aExpired && !bExpired) return 1;

    // 同类型事件按时间排序
    const aDiff = getEventTimeDiff(a, now);
    const bDiff = getEventTimeDiff(b, now);

    if (!aExpired && !bExpired) {
      // 未过期事件：距离现在越近越靠前
      return aDiff - bDiff;
    } else {
      // 过期事件：刚过期的靠前（按时间倒序）
      return bDiff - aDiff;
    }
  });
}

/**
 * 筛选并排序事件
 */
export function filterAndSortEvents(
  events: Event[],
  filter: TimeFilter,
  now: Date = new Date()
): { upcoming: Event[]; expired: Event[] } {
  const { start, end } = getTimeRange(filter, now);

  // 筛选在范围内的事件
  const filteredEvents = events.filter(event => isEventInRange(event, start, end));

  // 排序
  const sortedEvents = sortEvents(filteredEvents, now);

  // 分组：即将开始 vs 已过期
  const upcoming: Event[] = [];
  const expired: Event[] = [];

  sortedEvents.forEach(event => {
    if (isEventExpired(event, now)) {
      expired.push(event);
    } else {
      upcoming.push(event);
    }
  });

  return { upcoming, expired };
}

/**
 * 格式化倒计时文本
 */
export function formatCountdown(event: Event, now: Date = new Date()): string | undefined {
  const timeDiff = getEventTimeDiff(event, now);
  
  if (timeDiff < 0) {
    // 已过期
    return undefined;
  }

  const hours = Math.floor(timeDiff / (1000 * 60 * 60));
  const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `还有${days}天`;
  } else if (hours > 0) {
    return `还有${hours}h`;
  } else if (minutes > 0) {
    return `还有${minutes}min`;
  } else {
    return '即将开始';
  }
}

/**
 * 格式化时间显示文本
 */
export function formatTimeLabel(event: Event): string | undefined {
  if (event.startTime && event.endTime) {
    return `${event.startTime}-${event.endTime}`;
  } else if (event.startTime) {
    return `${event.startTime}开始`;
  } else if (event.endTime) {
    return `${event.endTime}截止`;
  } else if (event.isAllDay) {
    return '全天';
  }
  return undefined;
}
