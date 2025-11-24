/**
 * Event 相关辅助函数
 * 统一处理事件显示逻辑
 */

import { Event, CheckType } from '../types';

/**
 * 判断事件是否应该显示 checkbox
 * 
 * 规则：checkType 不为 'none' 时显示 checkbox
 * - checkType === 'once': 显示（单次签到任务）
 * - checkType === 'recurring': 显示（循环签到任务）
 * - checkType === 'none' 或 undefined: 不显示
 * 
 * 注意：isTask=true 的事件在创建时会自动设置 checkType，因此不需要单独判断 isTask
 * 
 * @param event - 事件对象或包含相关字段的对象
 * @returns 是否显示 checkbox
 */
export function shouldShowCheckbox(event: { checkType?: CheckType }): boolean {
  return event.checkType !== undefined && event.checkType !== 'none';
}

/**
 * 判断事件是否已完成（已签到）
 * 
 * @param event - 事件对象
 * @returns 是否已完成
 */
export function isEventChecked(event: Event): boolean {
  const checked = event.checked || [];
  const unchecked = event.unchecked || [];
  
  // 如果都没有操作，默认未签到
  if (checked.length === 0 && unchecked.length === 0) {
    return false;
  }
  
  // 获取最后的操作时间戳
  const lastCheckIn = checked.length > 0 ? checked[checked.length - 1] : undefined;
  const lastUncheck = unchecked.length > 0 ? unchecked[unchecked.length - 1] : undefined;
  
  // 比较最后的签到和取消签到时间
  return !!lastCheckIn && (!lastUncheck || lastCheckIn > lastUncheck);
}
