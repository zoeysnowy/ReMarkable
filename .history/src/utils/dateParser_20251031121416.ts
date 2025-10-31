/**
 * 自然语言日期解析工具
 * 使用 chrono-node 解析中英文日期表达
 */

import * as chrono from 'chrono-node';

export interface ParsedDate {
  start: Date;
  end?: Date;
  text: string; // 原始文本
  displayText?: string; // 用于显示的文本（可能包含时间段提示）
  timePeriod?: string; // 时间段标识（如"上午"、"下午"）
}

/**
 * 中文日期解析辅助函数
 */
function parseChineseDate(text: string, refDate: Date): ParsedDate | null {
  const trimmed = text.trim().toLowerCase();
  // 创建日期时，先设置为当天的0点0分（午夜）
  const result: ParsedDate = {
    start: new Date(refDate.getFullYear(), refDate.getMonth(), refDate.getDate(), 0, 0, 0, 0),
    text: trimmed,
  };
  
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
  
  // 时间段默认时间映射
  const timePeriodDefaults: { [key: string]: { hour: number; minute: number } } = {
    '凌晨': { hour: 1, minute: 0 },
    '早上': { hour: 7, minute: 0 },
    '上午': { hour: 9, minute: 0 },
    '中午': { hour: 12, minute: 0 },
    '下午': { hour: 14, minute: 0 },
    '傍晚': { hour: 18, minute: 0 },
    '晚上': { hour: 19, minute: 0 },
    '晚饭后': { hour: 20, minute: 0 },
  };
  
  // 解析时间部分 - 按优先级从高到低匹配
  let hour = 0;
  let minute = 0;
  let hasTime = false;
  let timePeriod: string | undefined = undefined;
  
  // 中文数字映射
  const chineseNumberMap: { [key: string]: number } = {
    '零': 0, '一': 1, '二': 2, '三': 3, '四': 4, '五': 5, 
    '六': 6, '七': 7, '八': 8, '九': 9, '十': 10,
    '两': 2, '兩': 2,
  };
  
  // 转换中文数字到阿拉伯数字
  const parseChineseNumber = (text: string): number | null => {
    // 先检查是否是阿拉伯数字
    if (/^\d+$/.test(text)) {
      return parseInt(text);
    }
    
    // 处理中文数字
    if (text.length === 1) {
      return chineseNumberMap[text] ?? null;
    }
    
    // 处理"十几"、"二十"等
    if (text.includes('十')) {
      if (text === '十') return 10;
      if (text.startsWith('十')) {
        // 十一、十二...
        return 10 + (chineseNumberMap[text[1]] ?? 0);
      }
      // 二十、三十...
      const tens = chineseNumberMap[text[0]] ?? 0;
      if (text.length === 2) return tens * 10;
      // 二十一、二十二...
      return tens * 10 + (chineseNumberMap[text[2]] ?? 0);
    }
    
    return null;
  };
  
  // 1. 检查是否只有时间段（凌晨、早上、上午、中午、下午、傍晚、晚上、晚饭后）没有具体点数
  const onlyPeriodMatch = trimmed.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|晚饭后)(?![一二三四五六七八九十\d])/);
  if (onlyPeriodMatch && !trimmed.match(/[点點时時:：]/)) {
    const period = onlyPeriodMatch[1];
    const defaultTime = timePeriodDefaults[period];
    if (defaultTime) {
      hour = defaultTime.hour;
      minute = defaultTime.minute;
      hasTime = true;
      timePeriod = period;
    }
  }
  // 2. 上午/下午/中午/早上/晚上 + 具体时间 (支持中文和阿拉伯数字)
  else {
    const periodTimeMatch = trimmed.match(/(凌晨|早上|上午|中午|下午|傍晚|晚上|晚饭后)([\d一二三四五六七八九十两兩]+)[点點时時:：]?([\d一二三四五六七八九十两兩]+)?[分]?/);
    if (periodTimeMatch) {
      const period = periodTimeMatch[1];
      const hourText = periodTimeMatch[2];
      const minuteText = periodTimeMatch[3];
      
      hour = parseChineseNumber(hourText) ?? 0;
      minute = minuteText ? (parseChineseNumber(minuteText) ?? 0) : 0;
      
      if (period === '下午' || period === '晚上' || period === '傍晚' || period === '晚饭后') {
        if (hour < 12) hour += 12;
      } else if (period === '中午') {
        hour = 12;
      } else if (period === '凌晨') {
        // 凌晨不需要调整，0-5点
      }
      // 上午和早上不需要调整
      
      hasTime = true;
    }
    // 3. 纯数字时间 (如果没有时间段标识)
    else {
      const pureTimeMatch = trimmed.match(/([\d一二三四五六七八九十两兩]+)[点點时時:：]([\d一二三四五六七八九十两兩]+)?[分]?/);
      if (pureTimeMatch) {
        const hourText = pureTimeMatch[1];
        const minuteText = pureTimeMatch[2];
        
        hour = parseChineseNumber(hourText) ?? 0;
        minute = minuteText ? (parseChineseNumber(minuteText) ?? 0) : 0;
        hasTime = true;
      }
    }
  }
  
  if (hasTime) {
    result.start.setHours(hour, minute, 0, 0);
  }
  
  // 添加时间段信息
  if (timePeriod) {
    result.timePeriod = timePeriod;
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
 * @param date 要格式化的日期
 * @param hasTime 是否强制显示时间（如果为undefined，会自动检测）
 * @param timePeriod 时间段（如"上午"、"下午"），如果提供则显示时间段+具体时间
 */
export function formatDateDisplay(date: Date, hasTime?: boolean, timePeriod?: string): string {
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = new Date(now.getTime() + 86400000).toDateString() === date.toDateString();
  
  // 自动检测是否有具体时间（不是午夜0点）
  const hasSpecificTime = hasTime !== undefined 
    ? hasTime 
    : (date.getHours() !== 0 || date.getMinutes() !== 0 || date.getSeconds() !== 0);
  
  const timeStr = hasSpecificTime 
    ? date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '';
  
  // 获取星期
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  const weekday = weekdays[date.getDay()];
  
  if (isToday) {
    if (timePeriod) {
      return `今天${timePeriod}（${timeStr}）`;
    }
    return hasSpecificTime ? `今天 ${timeStr}` : '今天';
  } else if (isTomorrow) {
    if (timePeriod) {
      return `明天${timePeriod}（${timeStr}）`;
    }
    if (hasSpecificTime) {
      return `明天 ${timeStr}`;
    } else {
      // 明天（2025-11-1 周五）
      const dateStr = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      return `明天（${dateStr} ${weekday}）`;
    }
  } else {
    // 其他日期显示：10月31日 周四 或 10月31日 周四 14:30
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${month}月${day}日 ${weekday}`;
    if (timePeriod) {
      return `${dateStr}${timePeriod}（${timeStr}）`;
    }
    return hasSpecificTime ? `${dateStr} ${timeStr}` : dateStr;
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
