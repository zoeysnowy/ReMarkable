/**
 * 自然语言时间词典
 * 
 * 用于扩展 chrono-node 不支持的中文时间表达
 * 包括：周末、周中、时间段（上午、中午、下午、晚上）等
 */

import dayjs, { Dayjs } from 'dayjs';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import { dbg } from './debugLogger';

// 启用季度插件
dayjs.extend(quarterOfYear);

/**
 * 中文数字转阿拉伯数字
 * 支持："零一二三四五六七八九十"、"12"、"3"等
 */
function parseChineseNumber(str: string): number {
  if (!str) return 0;
  
  // 如果已经是阿拉伯数字，直接返回
  if (/^\d+$/.test(str)) {
    return parseInt(str);
  }
  
  const chineseMap: { [key: string]: number } = {
    '零': 0, '一': 1, '二': 2, '两': 2, '三': 3, '四': 4,
    '五': 5, '六': 6, '七': 7, '八': 8, '九': 9,
    '十': 10, '百': 100, '千': 1000, '万': 10000
  };
  
  let result = 0;
  let temp = 0;
  
  // 从左到右解析
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const num = chineseMap[char];
    
    if (num === undefined) continue;
    
    if (num >= 10) {
      // 单位（十、百、千、万）
      if (temp === 0) temp = 1; // "十"前面没有数字，默认为1
      result += temp * num;
      temp = 0;
    } else {
      // 数字
      temp = num;
    }
  }
  
  // 处理遗留的 temp（如"三"、"二十三"的"三"）
  result += temp;
  
  return result;
}

/**
 * 时间类型：开始时间 vs 截止时间
 * 🆕 v2.7.3: 支持"截止"、"ddl"、"不晚于"等关键词识别
 */
export type TimeType = 'start' | 'due' | 'none';

/**
 * 时间段定义
 */
export interface TimePeriod {
  name: string;           // 显示名称
  startHour: number;      // 开始小时
  startMinute: number;    // 开始分钟
  endHour: number;        // 结束小时
  endMinute: number;      // 结束分钟
  isFuzzyTime: boolean;   // 是否为模糊时间段
  timeType?: TimeType;    // 🆕 v2.7.3: 时间类型（开始/截止/无）
}

/**
 * 日期范围定义
 */
export interface DateRange {
  start: Dayjs;
  end: Dayjs;
  displayHint: string;    // 显示提示（如"周末"）
  isFuzzyDate: boolean;   // 是否为模糊日期
}

/**
 * 精确时间点定义
 */
export interface PointInTime {
  date: Dayjs;
  displayHint: string;
  isFuzzyDate: boolean;
}

/**
 * 解析结果
 */
export interface ParseResult {
  dateRange?: DateRange;
  timePeriod?: TimePeriod;
  pointInTime?: PointInTime;
  matched: boolean;       // 是否成功匹配
  timeType?: TimeType;    // 🆕 v2.7.3: 时间类型（全局）
}

/**
 * 模糊时间段词典
 * isFuzzyTime: true 表示这是一个模糊时间段，显示时应该保留原始描述
 */
export const TIME_PERIOD_DICTIONARY: Record<string, TimePeriod> = {
  // 清晨
  '清晨': { name: '清晨', startHour: 5, startMinute: 0, endHour: 7, endMinute: 0, isFuzzyTime: true },
  '凌晨': { name: '凌晨', startHour: 0, startMinute: 0, endHour: 5, endMinute: 0, isFuzzyTime: true },
  
  // 上午
  '上午': { name: '上午', startHour: 6, startMinute: 0, endHour: 12, endMinute: 0, isFuzzyTime: true },
  '早上': { name: '早上', startHour: 6, startMinute: 0, endHour: 9, endMinute: 0, isFuzzyTime: true },
  '早晨': { name: '早晨', startHour: 6, startMinute: 0, endHour: 9, endMinute: 0, isFuzzyTime: true },
  'morning': { name: 'morning', startHour: 6, startMinute: 0, endHour: 12, endMinute: 0, isFuzzyTime: true },
  'am': { name: 'am', startHour: 6, startMinute: 0, endHour: 12, endMinute: 0, isFuzzyTime: true },
  
  // 中午
  '中午': { name: '中午', startHour: 11, startMinute: 0, endHour: 13, endMinute: 0, isFuzzyTime: true },
  '午间': { name: '午间', startHour: 11, startMinute: 0, endHour: 13, endMinute: 0, isFuzzyTime: true },
  '午休': { name: '午休', startHour: 12, startMinute: 0, endHour: 13, endMinute: 30, isFuzzyTime: true },
  'lunch break': { name: 'lunch break', startHour: 12, startMinute: 0, endHour: 13, endMinute: 30, isFuzzyTime: true },
  
  // 下午
  '下午': { name: '下午', startHour: 12, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  '午后': { name: '午后', startHour: 13, startMinute: 0, endHour: 17, endMinute: 0, isFuzzyTime: true },
  'afternoon': { name: 'afternoon', startHour: 12, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  'pm': { name: 'pm', startHour: 12, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  
  // 傍晚
  '傍晚': { name: '傍晚', startHour: 17, startMinute: 0, endHour: 19, endMinute: 0, isFuzzyTime: true },
  '黄昏': { name: '黄昏', startHour: 17, startMinute: 0, endHour: 19, endMinute: 0, isFuzzyTime: true },
  
  // 晚上
  '晚上': { name: '晚上', startHour: 18, startMinute: 0, endHour: 22, endMinute: 0, isFuzzyTime: true },
  '今晚': { name: '今晚', startHour: 18, startMinute: 0, endHour: 22, endMinute: 0, isFuzzyTime: true },
  '夜间': { name: '夜间', startHour: 20, startMinute: 0, endHour: 23, endMinute: 59, isFuzzyTime: true },
  '深夜': { name: '深夜', startHour: 22, startMinute: 0, endHour: 2, endMinute: 0, isFuzzyTime: true },
  'evening': { name: 'evening', startHour: 18, startMinute: 0, endHour: 22, endMinute: 0, isFuzzyTime: true },
  'night': { name: 'night', startHour: 18, startMinute: 0, endHour: 22, endMinute: 0, isFuzzyTime: true },
  
  // 工作时间
  '上班时间': { name: '上班时间', startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  '工作时间': { name: '工作时间', startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  'work hours': { name: 'work hours', startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  'office hours': { name: 'office hours', startHour: 9, startMinute: 0, endHour: 18, endMinute: 0, isFuzzyTime: true },
  
  // 会议时间
  '晨会': { name: '晨会', startHour: 10, startMinute: 0, endHour: 10, endMinute: 15, isFuzzyTime: true },
  '站会': { name: '站会', startHour: 10, startMinute: 0, endHour: 10, endMinute: 15, isFuzzyTime: true },
  'stand-up': { name: 'stand-up', startHour: 10, startMinute: 0, endHour: 10, endMinute: 15, isFuzzyTime: true },
  'daily scrum': { name: 'daily scrum', startHour: 10, startMinute: 0, endHour: 10, endMinute: 15, isFuzzyTime: true },
  
  // 整点（非模糊）
  '零点': { name: '零点', startHour: 0, startMinute: 0, endHour: 0, endMinute: 0, isFuzzyTime: false },
};

/**
 * 模糊日期词典
 * 支持相对日期表达（周末、周中、工作日等）
 */
export const DATE_RANGE_DICTIONARY: Record<string, (referenceDate?: Date) => DateRange> = {
  // 周末相关
  '周末': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day(); // 0=周日, 6=周六
    
    let saturday: Dayjs;
    if (currentDay === 0) {
      // 当前是周日，返回昨天（周六）和今天（周日）
      saturday = now.subtract(1, 'day');
    } else if (currentDay === 6) {
      // 当前是周六，返回今天和明天
      saturday = now;
    } else {
      // 工作日，返回本周的周六周日
      saturday = now.day(6); // 本周六
    }
    
    const sunday = saturday.add(1, 'day');
    
    return {
      start: saturday.startOf('day'),
      end: sunday.endOf('day'),
      displayHint: '周末',
      isFuzzyDate: true
    };
  },
  
  '这周末': (ref = new Date()) => DATE_RANGE_DICTIONARY['周末'](ref),
  '本周末': (ref = new Date()) => DATE_RANGE_DICTIONARY['周末'](ref),
  'weekend': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['周末'](ref);
    return { ...result, displayHint: 'weekend' };
  },
  'this weekend': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['周末'](ref);
    return { ...result, displayHint: 'this weekend' };
  },
  
  '下周末': (ref = new Date()) => {
    const now = dayjs(ref);
    const nextSaturday = now.add(1, 'week').day(6);
    const nextSunday = nextSaturday.add(1, 'day');
    
    return {
      start: nextSaturday.startOf('day'),
      end: nextSunday.endOf('day'),
      displayHint: '下周末',
      isFuzzyDate: true
    };
  },
  
  'next weekend': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['下周末'](ref);
    return { ...result, displayHint: 'next weekend' };
  },
  
  // 周中相关
  '周中': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    
    // 周中定义为周二到周四
    let tuesday: Dayjs;
    if (currentDay === 0 || currentDay === 1) {
      // 周日或周一，返回本周的周中
      tuesday = now.day(2);
    } else if (currentDay >= 2 && currentDay <= 4) {
      // 已经是周中，返回本周的周中
      tuesday = now.day(2);
    } else {
      // 周五或周六，返回下周的周中
      tuesday = now.add(1, 'week').day(2);
    }
    
    const thursday = tuesday.add(2, 'day');
    
    return {
      start: tuesday.startOf('day'),
      end: thursday.endOf('day'),
      displayHint: '周中',
      isFuzzyDate: true
    };
  },
  
  '这周中': (ref = new Date()) => {
    const now = dayjs(ref);
    const tuesday = now.day(2);
    const thursday = tuesday.add(2, 'day');
    
    return {
      start: tuesday.startOf('day'),
      end: thursday.endOf('day'),
      displayHint: '本周中',
      isFuzzyDate: true
    };
  },
  
  '本周中': (ref = new Date()) => DATE_RANGE_DICTIONARY['这周中'](ref),
  
  '下周中': (ref = new Date()) => {
    const now = dayjs(ref);
    const nextTuesday = now.add(1, 'week').day(2);
    const nextThursday = nextTuesday.add(2, 'day');
    
    return {
      start: nextTuesday.startOf('day'),
      end: nextThursday.endOf('day'),
      displayHint: '下周中',
      isFuzzyDate: true
    };
  },
  
  // 工作日
  '工作日': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    
    // 找到下一个工作日
    let nextWorkday: Dayjs;
    if (currentDay === 0) {
      // 周日，下一个工作日是明天（周一）
      nextWorkday = now.add(1, 'day');
    } else if (currentDay === 6) {
      // 周六，下一个工作日是后天（周一）
      nextWorkday = now.add(2, 'day');
    } else {
      // 工作日，下一个工作日是明天
      nextWorkday = now.add(1, 'day');
      if (nextWorkday.day() === 6) {
        // 如果明天是周六，跳到周一
        nextWorkday = nextWorkday.add(2, 'day');
      } else if (nextWorkday.day() === 0) {
        // 如果明天是周日，跳到周一
        nextWorkday = nextWorkday.add(1, 'day');
      }
    }
    
    return {
      start: nextWorkday.startOf('day'),
      end: nextWorkday.endOf('day'),
      displayHint: '工作日',
      isFuzzyDate: true
    };
  },
  
  '下个工作日': (ref = new Date()) => DATE_RANGE_DICTIONARY['工作日'](ref),
  '下一个工作日': (ref = new Date()) => DATE_RANGE_DICTIONARY['工作日'](ref),
  
  // 本周
  '本周': (ref = new Date()) => {
    const now = dayjs(ref);
    const startOfWeek = now.startOf('week');
    const endOfWeek = now.endOf('week');
    
    return {
      start: startOfWeek,
      end: endOfWeek,
      displayHint: '本周',
      isFuzzyDate: true
    };
  },
  
  '这周': (ref = new Date()) => DATE_RANGE_DICTIONARY['本周'](ref),
  'this week': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['本周'](ref);
    return { ...result, displayHint: 'this week' };
  },
  'current week': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['本周'](ref);
    return { ...result, displayHint: 'current week' };
  },
  
  // 下周
  '下周': (ref = new Date()) => {
    const now = dayjs(ref);
    const nextWeekStart = now.add(1, 'week').startOf('week');
    const nextWeekEnd = now.add(1, 'week').endOf('week');
    
    return {
      start: nextWeekStart,
      end: nextWeekEnd,
      displayHint: '下周',
      isFuzzyDate: true
    };
  },
  
  '下礼拜': (ref = new Date()) => DATE_RANGE_DICTIONARY['下周'](ref),
  'next week': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['下周'](ref);
    return { ...result, displayHint: 'next week' };
  },
  'nxt wk': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['下周'](ref);
    return { ...result, displayHint: 'next week' };
  },
  
  // 本月
  '本月': (ref = new Date()) => {
    const now = dayjs(ref);
    return {
      start: now.startOf('month'),
      end: now.endOf('month'),
      displayHint: '本月',
      isFuzzyDate: true
    };
  },
  
  '这个月': (ref = new Date()) => DATE_RANGE_DICTIONARY['本月'](ref),
  'this month': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['本月'](ref);
    return { ...result, displayHint: 'this month' };
  },
  'current month': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['本月'](ref);
    return { ...result, displayHint: 'current month' };
  },
  
  // 下月
  '下月': (ref = new Date()) => {
    const now = dayjs(ref);
    return {
      start: now.add(1, 'month').startOf('month'),
      end: now.add(1, 'month').endOf('month'),
      displayHint: '下月',
      isFuzzyDate: true
    };
  },
  
  '下个月': (ref = new Date()) => DATE_RANGE_DICTIONARY['下月'](ref),
  'next month': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['下月'](ref);
    return { ...result, displayHint: 'next month' };
  },
  
  // 三天内
  '三天内': (ref = new Date()) => {
    const now = dayjs(ref);
    return {
      start: now.startOf('day'),
      end: now.add(2, 'day').endOf('day'),
      displayHint: '三天内',
      isFuzzyDate: true
    };
  },
  
  'in 3 days': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['三天内'](ref);
    return { ...result, displayHint: 'in 3 days' };
  },
  'within 3 days': (ref = new Date()) => {
    const result = DATE_RANGE_DICTIONARY['三天内'](ref);
    return { ...result, displayHint: 'within 3 days' };
  },
};

/**
 * 精确时间点词典
 * 支持"大后天"、"月底"等精确日期表达
 */
export const POINT_IN_TIME_DICTIONARY: Record<string, (referenceDate?: Date) => PointInTime> = {
  // 相对天数
  '大后天': (ref = new Date()) => {
    const target = dayjs(ref).add(3, 'day').startOf('day');
    return {
      date: target,
      displayHint: '大后天',
      isFuzzyDate: false
    };
  },
  
  '3 days later': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['大后天'](ref);
    return { ...result, displayHint: '3 days later' };
  },
  
  '大前天': (ref = new Date()) => {
    const target = dayjs(ref).subtract(3, 'day').startOf('day');
    return {
      date: target,
      displayHint: '大前天',
      isFuzzyDate: false
    };
  },
  
  '3 days ago': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['大前天'](ref);
    return { ...result, displayHint: '3 days ago' };
  },
  
  // 月份相关
  '月底': (ref = new Date()) => {
    const target = dayjs(ref).endOf('month').startOf('day');
    return {
      date: target,
      displayHint: '月底',
      isFuzzyDate: false
    };
  },
  
  'end of month': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['月底'](ref);
    return { ...result, displayHint: 'end of month' };
  },
  
  'eom': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['月底'](ref);
    return { ...result, displayHint: 'eom' };
  },
  
  '月末': (ref = new Date()) => POINT_IN_TIME_DICTIONARY['月底'](ref),
  
  '月初': (ref = new Date()) => {
    const target = dayjs(ref).startOf('month');
    return {
      date: target,
      displayHint: '月初',
      isFuzzyDate: false
    };
  },
  
  'start of month': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['月初'](ref);
    return { ...result, displayHint: 'start of month' };
  },
  
  'som': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['月初'](ref);
    return { ...result, displayHint: 'som' };
  },
  
  // 年份相关
  '年底': (ref = new Date()) => {
    const target = dayjs(ref).endOf('year').startOf('day');
    return {
      date: target,
      displayHint: '年底',
      isFuzzyDate: false
    };
  },
  
  'end of year': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['年底'](ref);
    return { ...result, displayHint: 'end of year' };
  },
  
  'eoy': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['年底'](ref);
    return { ...result, displayHint: 'eoy' };
  },
  
  '年初': (ref = new Date()) => {
    const target = dayjs(ref).startOf('year');
    return {
      date: target,
      displayHint: '年初',
      isFuzzyDate: false
    };
  },
  
  'start of year': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['年初'](ref);
    return { ...result, displayHint: 'start of year' };
  },
  
  'soy': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['年初'](ref);
    return { ...result, displayHint: 'soy' };
  },
  
  '明年': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'year').startOf('year');
    return {
      date: target,
      displayHint: '明年',
      isFuzzyDate: false
    };
  },
  
  'next year': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['明年'](ref);
    return { ...result, displayHint: 'next year' };
  },
  
  'ny': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['明年'](ref);
    return { ...result, displayHint: 'ny' };
  },
  
  '后年': (ref = new Date()) => {
    const target = dayjs(ref).add(2, 'year').startOf('year');
    return {
      date: target,
      displayHint: '后年',
      isFuzzyDate: false
    };
  },
  
  'year after next': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['后年'](ref);
    return { ...result, displayHint: 'year after next' };
  },
  
  '去年': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'year').startOf('year');
    return {
      date: target,
      displayHint: '去年',
      isFuzzyDate: false
    };
  },
  
  'last year': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['去年'](ref);
    return { ...result, displayHint: 'last year' };
  },
  
  // 特定日期
  '周报日': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    // 找到本周或下周的周五
    let friday: Dayjs;
    if (currentDay <= 5) {
      // 周日到周五，返回本周五
      friday = now.day(5);
    } else {
      // 周六，返回下周五
      friday = now.add(1, 'week').day(5);
    }
    return {
      date: friday.startOf('day'),
      displayHint: '周报日',
      isFuzzyDate: false
    };
  },
  
  'weekly report': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['周报日'](ref);
    return { ...result, displayHint: 'weekly report' };
  },
  
  '周报': (ref = new Date()) => POINT_IN_TIME_DICTIONARY['周报日'](ref),
  
  '下周一': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(1).startOf('day');
    return {
      date: target,
      displayHint: '下周一',
      isFuzzyDate: false
    };
  },
  
  'next monday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周一'](ref);
    return { ...result, displayHint: 'next monday' };
  },
  
  'next mon': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周一'](ref);
    return { ...result, displayHint: 'next mon' };
  },
  
  // 🆕 下周二到下周日
  '下周二': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(2).startOf('day');
    return {
      date: target,
      displayHint: '下周二',
      isFuzzyDate: false
    };
  },
  
  'next tuesday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周二'](ref);
    return { ...result, displayHint: 'next tuesday' };
  },
  
  'next tue': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周二'](ref);
    return { ...result, displayHint: 'next tue' };
  },
  
  '下周三': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(3).startOf('day');
    return {
      date: target,
      displayHint: '下周三',
      isFuzzyDate: false
    };
  },
  
  'next wednesday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周三'](ref);
    return { ...result, displayHint: 'next wednesday' };
  },
  
  'next wed': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周三'](ref);
    return { ...result, displayHint: 'next wed' };
  },
  
  '下周四': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(4).startOf('day');
    return {
      date: target,
      displayHint: '下周四',
      isFuzzyDate: false
    };
  },
  
  'next thursday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周四'](ref);
    return { ...result, displayHint: 'next thursday' };
  },
  
  'next thu': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周四'](ref);
    return { ...result, displayHint: 'next thu' };
  },
  
  '下周五': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(5).startOf('day');
    return {
      date: target,
      displayHint: '下周五',
      isFuzzyDate: false
    };
  },
  
  'next friday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周五'](ref);
    return { ...result, displayHint: 'next friday' };
  },
  
  'next fri': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周五'](ref);
    return { ...result, displayHint: 'next fri' };
  },
  
  '下周六': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(6).startOf('day');
    return {
      date: target,
      displayHint: '下周六',
      isFuzzyDate: false
    };
  },
  
  'next saturday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周六'](ref);
    return { ...result, displayHint: 'next saturday' };
  },
  
  'next sat': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周六'](ref);
    return { ...result, displayHint: 'next sat' };
  },
  
  '下周日': (ref = new Date()) => {
    const target = dayjs(ref).add(1, 'week').day(0).startOf('day');
    return {
      date: target,
      displayHint: '下周日',
      isFuzzyDate: false
    };
  },
  
  'next sunday': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周日'](ref);
    return { ...result, displayHint: 'next sunday' };
  },
  
  'next sun': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['下周日'](ref);
    return { ...result, displayHint: 'next sun' };
  },
  
  // 🆕 本周系列（本周一到本周日）
  '本周一': (ref = new Date()) => {
    const target = dayjs(ref).day(1).startOf('day');
    return {
      date: target,
      displayHint: '本周一',
      isFuzzyDate: false
    };
  },
  
  '本周二': (ref = new Date()) => {
    const target = dayjs(ref).day(2).startOf('day');
    return {
      date: target,
      displayHint: '本周二',
      isFuzzyDate: false
    };
  },
  
  '本周三': (ref = new Date()) => {
    const target = dayjs(ref).day(3).startOf('day');
    return {
      date: target,
      displayHint: '本周三',
      isFuzzyDate: false
    };
  },
  
  '本周四': (ref = new Date()) => {
    const target = dayjs(ref).day(4).startOf('day');
    return {
      date: target,
      displayHint: '本周四',
      isFuzzyDate: false
    };
  },
  
  '本周五': (ref = new Date()) => {
    const target = dayjs(ref).day(5).startOf('day');
    return {
      date: target,
      displayHint: '本周五',
      isFuzzyDate: false
    };
  },
  
  '本周六': (ref = new Date()) => {
    const target = dayjs(ref).day(6).startOf('day');
    return {
      date: target,
      displayHint: '本周六',
      isFuzzyDate: false
    };
  },
  
  '本周日': (ref = new Date()) => {
    const target = dayjs(ref).day(0).startOf('day');
    return {
      date: target,
      displayHint: '本周日',
      isFuzzyDate: false
    };
  },
  
  // 🆕 上周系列（上周一到上周日）
  '上周一': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(1).startOf('day');
    return {
      date: target,
      displayHint: '上周一',
      isFuzzyDate: false
    };
  },
  
  '上周二': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(2).startOf('day');
    return {
      date: target,
      displayHint: '上周二',
      isFuzzyDate: false
    };
  },
  
  '上周三': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(3).startOf('day');
    return {
      date: target,
      displayHint: '上周三',
      isFuzzyDate: false
    };
  },
  
  '上周四': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(4).startOf('day');
    return {
      date: target,
      displayHint: '上周四',
      isFuzzyDate: false
    };
  },
  
  '上周五': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(5).startOf('day');
    return {
      date: target,
      displayHint: '上周五',
      isFuzzyDate: false
    };
  },
  
  '上周六': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(6).startOf('day');
    return {
      date: target,
      displayHint: '上周六',
      isFuzzyDate: false
    };
  },
  
  '上周日': (ref = new Date()) => {
    const target = dayjs(ref).subtract(1, 'week').day(0).startOf('day');
    return {
      date: target,
      displayHint: '上周日',
      isFuzzyDate: false
    };
  },
  
  // 季度相关
  '季末': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentQuarter = now.quarter();
    const target = now.quarter(currentQuarter).endOf('quarter').startOf('day');
    return {
      date: target,
      displayHint: '季末',
      isFuzzyDate: false
    };
  },
  
  'end of quarter': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['季末'](ref);
    return { ...result, displayHint: 'end of quarter' };
  },
  
  'eoq': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['季末'](ref);
    return { ...result, displayHint: 'eoq' };
  },
  
  '季度末': (ref = new Date()) => POINT_IN_TIME_DICTIONARY['季末'](ref),
  
  // 截止日期
  'ddl': (ref = new Date()) => {
    const target = dayjs(ref).endOf('day');
    return {
      date: target,
      displayHint: 'ddl',
      isFuzzyDate: false
    };
  },
  
  'deadline': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['ddl'](ref);
    return { ...result, displayHint: 'deadline' };
  },
  
  'due': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['ddl'](ref);
    return { ...result, displayHint: 'due' };
  },
  
  'due date': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['ddl'](ref);
    return { ...result, displayHint: 'due date' };
  },
  
  '死线': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['ddl'](ref);
    return { ...result, displayHint: '死线' };
  },
  
  '截止日期': (ref = new Date()) => {
    const result = POINT_IN_TIME_DICTIONARY['ddl'](ref);
    return { ...result, displayHint: '截止日期' };
  },
  
  // 🆕 v2.7.2: 星期几（周一到周日）
  '周一': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    // 如果今天是周一，返回今天；否则返回下一个周一
    let monday: Dayjs;
    if (currentDay === 1) {
      monday = now;
    } else if (currentDay === 0) {
      // 周日，明天是周一
      monday = now.add(1, 'day');
    } else {
      // 其他日期，找下一个周一
      monday = now.add(1, 'week').day(1);
    }
    return {
      date: monday.startOf('day'),
      displayHint: monday.isSame(now, 'day') ? '今天' : '周一',
      isFuzzyDate: false
    };
  },
  
  '周二': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let tuesday: Dayjs;
    if (currentDay === 2) {
      tuesday = now;
    } else if (currentDay < 2) {
      tuesday = now.day(2);
    } else {
      tuesday = now.add(1, 'week').day(2);
    }
    return {
      date: tuesday.startOf('day'),
      displayHint: tuesday.isSame(now, 'day') ? '今天' : '周二',
      isFuzzyDate: false
    };
  },
  
  '周三': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let wednesday: Dayjs;
    if (currentDay === 3) {
      wednesday = now;
    } else if (currentDay < 3) {
      wednesday = now.day(3);
    } else {
      wednesday = now.add(1, 'week').day(3);
    }
    return {
      date: wednesday.startOf('day'),
      displayHint: wednesday.isSame(now, 'day') ? '今天' : '周三',
      isFuzzyDate: false
    };
  },
  
  '周四': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let thursday: Dayjs;
    if (currentDay === 4) {
      thursday = now;
    } else if (currentDay < 4) {
      thursday = now.day(4);
    } else {
      thursday = now.add(1, 'week').day(4);
    }
    return {
      date: thursday.startOf('day'),
      displayHint: thursday.isSame(now, 'day') ? '今天' : '周四',
      isFuzzyDate: false
    };
  },
  
  '周五': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let friday: Dayjs;
    if (currentDay === 5) {
      friday = now;
    } else if (currentDay < 5) {
      friday = now.day(5);
    } else {
      friday = now.add(1, 'week').day(5);
    }
    return {
      date: friday.startOf('day'),
      displayHint: friday.isSame(now, 'day') ? '今天' : '周五',
      isFuzzyDate: false
    };
  },
  
  '周六': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let saturday: Dayjs;
    if (currentDay === 6) {
      saturday = now;
    } else if (currentDay < 6) {
      saturday = now.day(6);
    } else {
      saturday = now.add(1, 'week').day(6);
    }
    return {
      date: saturday.startOf('day'),
      displayHint: saturday.isSame(now, 'day') ? '今天' : '周六',
      isFuzzyDate: false
    };
  },
  
  '周日': (ref = new Date()) => {
    const now = dayjs(ref);
    const currentDay = now.day();
    let sunday: Dayjs;
    if (currentDay === 0) {
      sunday = now;
    } else {
      sunday = now.add(1, 'week').day(0);
    }
    return {
      date: sunday.startOf('day'),
      displayHint: sunday.isSame(now, 'day') ? '今天' : '周日',
      isFuzzyDate: false
    };
  },
};

/**
 * 组合表达式解析
 * 支持"下周末上午"、"本周中下午"等组合表达
 */
export function parseNaturalLanguage(input: string, referenceDate: Date = new Date()): ParseResult {
  const trimmedInput = input.trim().toLowerCase();
  
  // 🆕 v2.7.4: 检测截止关键词（优先级最高）
  const deadlineKeywords = [
    // 中文核心词
    '截止', '结束', '终止', '完成', '最晚', '不晚于', 
    // 场景词
    'ddl', 'deadline', 'due', '闭馆', '散会', '下班',
    // 英文词
    'before', 'by', 'until', 'no later than',
    // 特殊模式: "X前" 会在精确时间解析后单独处理
  ];
  const hasDueKeyword = deadlineKeywords.some(kw => trimmedInput.includes(kw));
  const hasBeforePattern = /\d+[：:点]\s*前/.test(trimmedInput); // "10点前"、"22:00前"
  const isDueTime = hasDueKeyword || hasBeforePattern;
  
  dbg('dict', '🔍 检测截止关键词', { isDueTime, hasDueKeyword, hasBeforePattern, input: trimmedInput });
  
  // 🆕 v2.7.1: 优先检测"模糊时间段+精确时间"组合
  // 如："中午12点"、"下午3点"、"晚上8:30"、"截止下周二中午12点"、"下午三点半"
  // 支持：点/半/一刻/三刻/分、冒号分隔
  const fuzzyTimePlusExactPattern = /(上午|中午|下午|晚上|凌晨|早上|傍晚|深夜)\s*([0-9零一二两三四五六七八九十百千万]+)(?:[：:]([0-9零一二两三四五六七八九十百千万]+)|点(?:半|一刻|三刻|([0-9零一二两三四五六七八九十百千万]+)分)?)/;
  const fuzzyMatch = trimmedInput.match(fuzzyTimePlusExactPattern);
  
  if (fuzzyMatch) {
    const [fullMatch, fuzzyPeriod, hourStr, colonMinute, dotMinute] = fuzzyMatch;
    
    // 转换中文数字到阿拉伯数字
    let hour = parseChineseNumber(hourStr);
    let minute = 0;
    
    // 解析分钟（优先检测口语表达）
    if (fullMatch.includes('点半')) {
      minute = 30;
    } else if (fullMatch.includes('一刻')) {
      minute = 15;
    } else if (fullMatch.includes('三刻')) {
      minute = 45;
    } else if (colonMinute) {
      minute = parseChineseNumber(colonMinute);
    } else if (dotMinute) {
      minute = parseChineseNumber(dotMinute);
    }
    
    // 🆕 v2.7.2: 根据时间段上下文自动转换小时（处理12小时制）
    // "晚上10点" → 22:00, "下午3点" → 15:00, "凌晨2点" → 02:00
    if (hour >= 1 && hour <= 12) {
      if (fuzzyPeriod === '下午' || fuzzyPeriod === 'afternoon') {
        if (hour !== 12) hour += 12; // 下午1点 → 13:00, 下午12点保持12:00
      } else if (fuzzyPeriod === '晚上' || fuzzyPeriod === '深夜') {
        if (hour !== 12) hour += 12; // 晚上10点 → 22:00
      } else if (fuzzyPeriod === '凌晨' || fuzzyPeriod === '早上') {
        if (hour === 12) hour = 0; // 凌晨12点 → 00:00
      } else if (fuzzyPeriod === '上午' || fuzzyPeriod === 'morning') {
        if (hour === 12) hour = 0; // 上午12点 → 00:00（午夜）
      }
    }
    
    // 验证时间有效性
    if (hour >= 0 && hour < 24 && minute >= 0 && minute < 60) {
      dbg('dict', '🎯 检测到模糊时间段+精确时间组合', { 
        fuzzyPeriod, 
        原始小时: parseChineseNumber(hourStr),
        转换后小时: hour, 
        minute,
        input: trimmedInput 
      });
      
      // 检查是否还包含日期范围
      let dateRange: DateRange | null = null;
      
      for (const [dateKey, dateFunc] of Object.entries(DATE_RANGE_DICTIONARY)) {
        if (trimmedInput.includes(dateKey.toLowerCase())) {
          dateRange = dateFunc(referenceDate);
          dbg('dict', '📅 同时匹配到日期范围', { dateKey });
          break;
        }
      }
      
      // 检查是否包含精确日期点
      if (!dateRange) {
        for (const [pointKey, pointFunc] of Object.entries(POINT_IN_TIME_DICTIONARY)) {
          if (trimmedInput.includes(pointKey.toLowerCase())) {
            const point = pointFunc(referenceDate);
            dateRange = {
              start: point.date,
              end: point.date,
              displayHint: point.displayHint,
              isFuzzyDate: false
            };
            dbg('dict', '📍 同时匹配到精确日期点', { pointKey });
            break;
          }
        }
      }
      
      // 生成友好的时间名称
      let timeName = `${fuzzyPeriod}${parseChineseNumber(hourStr)}点`;
      if (fullMatch.includes('点半')) {
        timeName += '半';
      } else if (fullMatch.includes('一刻')) {
        timeName += '一刻';
      } else if (fullMatch.includes('三刻')) {
        timeName += '三刻';
      } else if (minute > 0) {
        timeName += `${minute}分`;
      }
      
      // 返回精确时间（不是模糊时间段）
      return {
        matched: true,
        dateRange: dateRange || undefined,
        timePeriod: isDueTime ? {
          // 截止时间：只有结束时间
          name: timeName,
          startHour: 0,
          startMinute: 0,
          endHour: hour,
          endMinute: minute,
          isFuzzyTime: false,
          timeType: 'due'
        } : {
          // 开始时间：只有开始时间
          name: timeName,
          startHour: hour,
          startMinute: minute,
          endHour: 0,  // 🆕 v2.7.4: 精确开始时间不设置结束时间（0表示无）
          endMinute: 0,
          isFuzzyTime: false,
          timeType: 'start'
        },
        timeType: isDueTime ? 'due' : 'start'
      };
    }
  }
  
  // 1. 尝试匹配精确时间点（大后天、月底、eom等）
  for (const [pointKey, pointFunc] of Object.entries(POINT_IN_TIME_DICTIONARY)) {
    if (trimmedInput === pointKey.toLowerCase() || trimmedInput.includes(pointKey.toLowerCase())) {
      const pointInTime = pointFunc(referenceDate);
      return {
        pointInTime,
        matched: true
      };
    }
  }
  
  // 2. 尝试匹配日期范围 + 时间段组合
  for (const [dateKey, dateFunc] of Object.entries(DATE_RANGE_DICTIONARY)) {
    if (trimmedInput.includes(dateKey.toLowerCase())) {
      const dateRange = dateFunc(referenceDate);
      
      // 检查是否包含时间段
      for (const [timeKey, timePeriod] of Object.entries(TIME_PERIOD_DICTIONARY)) {
        if (trimmedInput.includes(timeKey.toLowerCase())) {
          return {
            dateRange,
            timePeriod,
            matched: true
          };
        }
      }
      
      // 只有日期范围，没有时间段
      return {
        dateRange,
        matched: true
      };
    }
  }
  
  // 3. 尝试只匹配时间段（应用到今天）
  for (const [timeKey, timePeriod] of Object.entries(TIME_PERIOD_DICTIONARY)) {
    if (trimmedInput.includes(timeKey.toLowerCase())) {
      const now = dayjs(referenceDate);
      return {
        dateRange: {
          start: now.startOf('day'),
          end: now.endOf('day'),
          displayHint: '',
          isFuzzyDate: false
        },
        timePeriod,
        matched: true
      };
    }
  }
  
  // 4. 没有匹配到任何词条
  return {
    matched: false
  };
}

/**
 * 获取所有支持的关键词（用于文档和提示）
 */
export function getSupportedKeywords(): {
  dateRanges: string[];
  timePeriods: string[];
  pointInTime: string[];
  examples: string[];
} {
  return {
    dateRanges: Object.keys(DATE_RANGE_DICTIONARY),
    timePeriods: Object.keys(TIME_PERIOD_DICTIONARY),
    pointInTime: Object.keys(POINT_IN_TIME_DICTIONARY),
    examples: [
      // 日期范围
      '周末',
      '周中',
      '下周末',
      '本周中',
      '工作日',
      'weekend',
      'next week',
      // 时间段
      '上午',
      '下午',
      '晚上',
      'morning',
      'afternoon',
      // 精确时间点
      '大后天',
      '月底',
      'eom',
      'ddl',
      '周报日',
      // 组合表达
      '周末上午',
      '下周中下午',
      '本周末晚上',
      '工作日中午',
    ]
  };
}
