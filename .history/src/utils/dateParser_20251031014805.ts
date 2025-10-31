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
 * 中文日期解析辅助函数
 */
function parseChineseDate(text: string, refDate: Date): ParsedDate | null {
  const trimmed = text.trim().toLowerCase();
  const result: ParsedDate = {
    start: new Date(refDate),
    text: trimmed,
  };
  
  console.log('[dateParser] 输入文本:', trimmed);
  console.log('[dateParser] 参考日期:', refDate.toLocaleString('zh-CN'));
  
  // 今天
  if (trimmed.includes('今天') || trimmed.includes('今日')) {
    // 保持当前日期
  }
  // 明天
  else if (trimmed.includes('明天') || trimmed.includes('明日')) {
    result.start.setDate(result.start.getDate() + 1);
  }
  // 后天
  else if (trimmed.includes('后天') || trimmed.includes('後天')) {
    result.start.setDate(result.start.getDate() + 2);
  }
  // 昨天
  else if (trimmed.includes('昨天') || trimmed.includes('昨日')) {
    result.start.setDate(result.start.getDate() - 1);
  }
  // 前天
  else if (trimmed.includes('前天')) {
    result.start.setDate(result.start.getDate() - 2);
  }
  // 下周 + 星期
  else if (trimmed.includes('下周') || trimmed.includes('下週')) {
    const weekdayMatch = trimmed.match(/[周週星期][一二三四五六日天]/);
    if (weekdayMatch) {
      const weekdayMap: { [key: string]: number } = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
      };
      const weekdayChar = weekdayMatch[0].slice(-1);
      const targetDay = weekdayMap[weekdayChar];
      
      // 找到下周的目标星期
      result.start.setDate(result.start.getDate() + 7);
      const currentDay = result.start.getDay();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      result.start.setDate(result.start.getDate() + daysToAdd);
    }
  }
  // 本周/这周 + 星期
  else if (trimmed.includes('本周') || trimmed.includes('本週') || trimmed.includes('这周') || trimmed.includes('這週')) {
    const weekdayMatch = trimmed.match(/[周週星期][一二三四五六日天]/);
    if (weekdayMatch) {
      const weekdayMap: { [key: string]: number } = {
        '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
      };
      const weekdayChar = weekdayMatch[0].slice(-1);
      const targetDay = weekdayMap[weekdayChar];
      
      const currentDay = result.start.getDay();
      const daysToAdd = (targetDay - currentDay + 7) % 7;
      result.start.setDate(result.start.getDate() + daysToAdd);
    }
  }
  // 仅星期
  else if (trimmed.match(/^[周週星期][一二三四五六日天]/)) {
    const weekdayMap: { [key: string]: number } = {
      '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, '六': 6, '日': 0, '天': 0
    };
    const weekdayChar = trimmed.match(/[周週星期]([一二三四五六日天])/)![1];
    const targetDay = weekdayMap[weekdayChar];
    
    const currentDay = result.start.getDay();
    let daysToAdd = (targetDay - currentDay + 7) % 7;
    if (daysToAdd === 0) daysToAdd = 7; // 如果是今天，指向下周
    result.start.setDate(result.start.getDate() + daysToAdd);
  }
  else {
    return null; // 无法识别的中文日期
  }
  
  // 解析时间部分 - 按优先级从高到低匹配
  let hour = 0;
  let minute = 0;
  let hasTime = false;
  
  // 1. 上午/下午/中午/早上/晚上 + 时间
  const periodTimeMatch = trimmed.match(/(上午|下午|中午|早上|晚上)(\d{1,2})[点點时時:：]?(\d{1,2})?[分]?/);
  if (periodTimeMatch) {
    const period = periodTimeMatch[1];
    hour = parseInt(periodTimeMatch[2]);
    minute = periodTimeMatch[3] ? parseInt(periodTimeMatch[3]) : 0;
    
    if (period === '下午' || period === '晚上') {
      if (hour < 12) hour += 12;
    } else if (period === '中午') {
      hour = 12;
    }
    // 上午和早上不需要调整
    
    hasTime = true;
  }
  // 2. 纯数字时间 (如果没有上午/下午等标识)
  else {
    const pureTimeMatch = trimmed.match(/(\d{1,2})[点點时時:：](\d{1,2})?[分]?/);
    if (pureTimeMatch) {
      hour = parseInt(pureTimeMatch[1]);
      minute = pureTimeMatch[2] ? parseInt(pureTimeMatch[2]) : 0;
      hasTime = true;
    }
  }
  
  if (hasTime) {
    result.start.setHours(hour, minute, 0, 0);
  }
  
  return result;
}

/**
 * 解析自然语言日期
 * @param text 自然语言文本，如 "明天下午3点"、"next Monday at 2pm"
 * @returns 解析结果
 */
export function parseNaturalDate(text: string): ParsedDate | null {
  const refDate = new Date();
  
  // 先尝试中文解析
  const chineseResult = parseChineseDate(text, refDate);
  if (chineseResult) {
    return chineseResult;
  }
  
  // 使用 chrono 解析英文
  const results = chrono.casual.parse(text, refDate, { forwardDate: true });
  
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
