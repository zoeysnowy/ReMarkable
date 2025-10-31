/**
 * 开发环境日志工具
 * 仅在开发环境输出日志，避免生产环境内存泄漏
 */

const isDev = process.env.NODE_ENV === 'development' || 
             process.env.NODE_ENV === undefined;

export const logger = {
  /**
   * 常规日志 - 仅开发环境
   */
  log: (...args: any[]) => {
    if (isDev) console.log(...args);
  },

  /**
   * 警告日志 - 仅开发环境
   */
  warn: (...args: any[]) => {
    if (isDev) console.warn(...args);
  },

  /**
   * 错误日志 - 总是输出（生产环境也需要）
   */
  error: (...args: any[]) => {
    console.error(...args);
  },

  /**
   * 调试日志 - 仅开发环境
   */
  debug: (...args: any[]) => {
    if (isDev) console.debug(...args);
  },

  /**
   * 信息日志 - 仅开发环境
   */
  info: (...args: any[]) => {
    if (isDev) console.info(...args);
  },

  /**
   * 带前缀的日志 - 用于特定模块
   */
  module: (moduleName: string) => ({
    log: (...args: any[]) => {
      if (isDev) console.log(`[${moduleName}]`, ...args);
    },
    warn: (...args: any[]) => {
      if (isDev) console.warn(`[${moduleName}]`, ...args);
    },
    error: (...args: any[]) => {
      console.error(`[${moduleName}]`, ...args);
    },
    debug: (...args: any[]) => {
      if (isDev) console.debug(`[${moduleName}]`, ...args);
    },
  }),
};

// 使用示例:
// import { logger } from './utils/logger';
// logger.log('这只在开发环境显示');
// logger.error('这在所有环境都显示');
// 
// const syncLogger = logger.module('Sync');
// syncLogger.log('Sync started'); // 输出: [Sync] Sync started
