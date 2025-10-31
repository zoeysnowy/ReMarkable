/**
 * 自然语言日期解析工具
 * 使用 chrono-node 解析中英文日期表达
 */

import * as chrono from 'chrono-node';

export interface ParsedDate {
  start: Date;
  end?: Date;
  text: string; // 原始文本
}

/**
 * 解析自然语言日期
 * @param text 自然语言文本，如 "明天下午3点"、"next Monday at 2pm"
 * @returns 解析结果
 */
export function parseNaturalDate(text: string): ParsedDate | null {
  // 创建中文 parser
  const customChrono = chrono.casual.clone();
  
  // 解析
  const results = customChrono.parse(text, new Date(), { forwardDate: true });
  
  if (results.length === 0) return null;
  
  const result = results[0];
  
  return {
    start: result.start.date(),
    end: result.end?.date(),
    text: result.text,
  };
}

/**
 * 格式化日期为显示文本
 */
export function formatDateDisplay(date: Date, hasTime: boolean = true): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
  
  const timeStr = hasTime 
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  
  if (isToday) {
    return hasTime ? `今天 ${timeStr}` : '今天';
  } else if (isTomorrow) {
    return hasTime ? `明天 ${timeStr}` : '明天';
  } else {
    const dateStr = date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric',
      weekday: 'short'
    });
    return hasTime ? `${dateStr} ${timeStr}` : dateStr;
  }
}

/**
 * 常用的日期示例（用于提示）
 */
export const DATE_EXAMPLES = [
  '明天',
  '后天',
  '下周一',
  '明天下午3点',
  '今天晚上8点',
  '下周五上午10点',
  'tomorrow',
  'next Monday',
  'in 2 hours',
];
