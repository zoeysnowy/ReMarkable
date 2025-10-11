/**
 * 时间工具函数 - 确保所有时间处理的一致性
 * 目标：18:06的事件在任何地方都显示为18:06，不受时区影响
 */

// 🔧 将时间转换为存储格式（ISO字符串，但保持本地时间）
export const formatTimeForStorage = (date: Date): string => {
  // 使用本地时间创建ISO字符串，避免时区转换
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`;
};

// 🔧 解析本地时间字符串为Date对象 - 修复类型问题
export const parseLocalTimeString = (timeString: string | Date): Date => {
  // 如果已经是Date对象，直接返回
  if (timeString instanceof Date) {
    return timeString;
  }
  
  // 解析ISO格式的时间字符串，但作为本地时间处理
  if (timeString.includes('T')) {
    const [datePart, timePart] = timeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hours, minutes, seconds = 0] = timePart.split(':').map(Number);
    
    return new Date(year, month - 1, day, hours, minutes, seconds);
  }
  
  // 兼容其他格式
  return new Date(timeString);
};

// 🔧 格式化时间用于input[type="time"]控件
export const formatTimeForInput = (timeString: string | Date): string => {
  const date = parseLocalTimeString(timeString);
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// 🔧 格式化日期用于input[type="date"]控件
export const formatDateForInput = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// 🔧 格式化时间用于显示（只显示时间部分）
export const formatDisplayTime = (timeString: string | Date): string => {
  const date = parseLocalTimeString(timeString);
  return date.toLocaleTimeString('zh-CN', { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: false
  });
};

// 🔧 格式化日期时间用于显示
export const formatDisplayDateTime = (timeString: string | Date): string => {
  const date = parseLocalTimeString(timeString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
};

// 🔧 获取今天的开始时间
export const getTodayStart = (): Date => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
};

// 🔧 获取今天的结束时间
export const getTodayEnd = (): Date => {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
};

// 🔧 检查是否为今天
export const isToday = (timeString: string | Date): boolean => {
  const date = parseLocalTimeString(timeString);
  const today = new Date();
  
  return date.getFullYear() === today.getFullYear() &&
         date.getMonth() === today.getMonth() &&
         date.getDate() === today.getDate();
};

// 🔧 计算时间差（秒）
export const getTimeDifferenceInSeconds = (startTime: string | Date, endTime: string | Date): number => {
  const start = parseLocalTimeString(startTime);
  const end = parseLocalTimeString(endTime);
  return Math.floor((end.getTime() - start.getTime()) / 1000);
};

// 🔧 添加更多实用的时间工具函数

// 格式化持续时间（秒转为可读格式）
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  if (hours > 0) {
    return `${hours}小时${minutes.toString().padStart(2, '0')}分`;
  } else if (minutes > 0) {
    return `${minutes}分${secs.toString().padStart(2, '0')}秒`;
  } else {
    return `${secs}秒`;
  }
};

// 简化的时间格式化函数（与formatDuration相同，为了兼容性）
export const formatTime = (seconds: number): string => {
  return formatDuration(seconds);
};

// 获取时间字符串（用于文件名等）
export const getTimeString = (): string => {
  const now = new Date();
  return formatTimeForStorage(now).replace(/[:-]/g, '').replace('T', '_');
};

// 检查时间是否在指定范围内
export const isTimeInRange = (timeString: string | Date, startTime: string | Date, endTime: string | Date): boolean => {
  const time = parseLocalTimeString(timeString).getTime();
  const start = parseLocalTimeString(startTime).getTime();
  const end = parseLocalTimeString(endTime).getTime();
  
  return time >= start && time <= end;
};

// 获取相对时间描述
export const getRelativeTimeDescription = (timeString: string | Date): string => {
  const date = parseLocalTimeString(timeString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  if (diffMinutes < 1) {
    return '刚刚';
  } else if (diffMinutes < 60) {
    return `${diffMinutes}分钟前`;
  } else if (diffHours < 24) {
    return `${diffHours}小时前`;
  } else if (diffDays < 7) {
    return `${diffDays}天前`;
  } else {
    return formatDisplayDateTime(timeString);
  }
};