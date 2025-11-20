/**
 * CalendarSourceDisplay - 日历来源显示组件
 * 
 * 用于显示事件来源（Outlook/Google/iCloud/ReMarkable）和同步模式选择
 */

import React from 'react';
import { Event, PlanSyncConfig, ActualSyncConfig } from '../../types';
import { SyncModeSelector } from './SyncModeSelector';
import { getSyncModeConfig } from '../../utils/calendarSyncUtils';
import './CalendarSourceDisplay.css';

interface CalendarSourceDisplayProps {
  event: Event;
  isActualProgress?: boolean;  // 是否为实际进展区域
  onSyncConfigChange: (planConfig?: PlanSyncConfig, actualConfig?: ActualSyncConfig) => void;
  availableCalendars?: Array<{
    id: string;
    name: string;
    color: string;
    platform: 'outlook' | 'google' | 'icloud' | 'remarkable';
  }>;
  disabled?: boolean;
}

/**
 * 获取事件来源信息
 */
function getEventSourceInfo(event: Event): { 
  icon?: string; 
  emoji?: string; 
  name: string; 
  color?: string;
} {
  // 🆕 特殊情况：Timer 子事件，显示父事件的来源
  if (event.isTimer && event.parentEventId) {
    // 这里需要获取父事件信息，暂时返回默认值
    // 实际实现中应该通过 EventService.getEventById 获取父事件
    return { emoji: '⏱️', name: 'Timer (父事件来源)' };
  }
  
  // 外部日历同步的事件（优先判断）
  if (event.source === 'outlook' || event.source === 'google' || event.source === 'icloud') {
    switch (event.source) {
      case 'outlook':
        return { icon: '/icons/outlook.svg', name: 'Outlook', color: '#0078d4' };
      case 'google':
        return { icon: '/icons/google-calendar.svg', name: 'Google Calendar', color: '#4285f4' };
      case 'icloud':
        return { icon: '/icons/icloud.svg', name: 'iCloud', color: '#007aff' };
    }
  }
  
  // ReMarkable 本地创建的事件
  if (event.source === 'local' || event.remarkableSource) {
    // 独立 Timer 事件（没有父事件的 Timer）
    if (event.isTimer && !event.parentEventId) {
      return { emoji: '⏱️', name: 'ReMarkable 计时' };
    }
    // 由 Plan 模块创建
    if (event.isPlan) {
      return { emoji: '✅', name: 'ReMarkable 计划' };
    }
    // 由 TimeCalendar 页面创建
    if (event.isTimeCalendar) {
      return { emoji: '🚀', name: 'ReMarkable' };
    }
    // 其他本地事件
    return { emoji: '🚀', name: 'ReMarkable' };
  }
  
  // 兜底：显示 ReMarkable
  return { emoji: '🚀', name: 'ReMarkable' };
}

export function CalendarSourceDisplay({
  event,
  isActualProgress = false,
  onSyncConfigChange,
  availableCalendars = [],
  disabled = false
}: CalendarSourceDisplayProps) {
  const source = getEventSourceInfo(event);
  const label = isActualProgress ? '同步到' : '来自';
  
  // 获取当前的同步配置
  const currentSyncConfig = isActualProgress 
    ? (event.actualSyncConfig || event.planSyncConfig)  // Actual 可以继承 Plan 配置
    : event.planSyncConfig;
  
  // 处理同步模式变更
  const handleSyncModeChange = (newMode: string) => {
    if (isActualProgress) {
      // 更新 Actual 配置
      const newActualConfig: ActualSyncConfig = {
        mode: newMode as any,
        targetCalendars: event.actualSyncConfig?.targetCalendars || event.planSyncConfig?.targetCalendars || []
      };
      onSyncConfigChange(undefined, newActualConfig);
    } else {
      // 更新 Plan 配置
      const newPlanConfig: PlanSyncConfig = {
        mode: newMode as any,
        targetCalendars: event.planSyncConfig?.targetCalendars || []
      };
      onSyncConfigChange(newPlanConfig, undefined);
    }
  };
  
  // 检查是否应该禁用同步模式选择器
  const shouldDisableSyncSelector = disabled || (!isActualProgress && event.source !== 'local');
  
  return (
    <div className="calendar-source-row">
      {/* 左侧：来源/同步日历显示 */}
      <div className="calendar-source">
        <span className="source-label">{label}</span>
        
        {/* 日历色块 */}
        {source.color && (
          <span 
            className="calendar-dot" 
            style={{ backgroundColor: source.color }}
          />
        )}
        
        {/* 平台图标或 Emoji */}
        {source.icon ? (
          <img 
            src={source.icon} 
            alt={source.name} 
            className="source-icon" 
          />
        ) : (
          <span className="source-emoji">{source.emoji}</span>
        )}
        
        <span className="source-name">{source.name}</span>
      </div>
      
      {/* 右侧：同步机制选择器 */}
      {currentSyncConfig && (
        <SyncModeSelector
          mode={currentSyncConfig.mode}
          isActual={isActualProgress}
          disabled={shouldDisableSyncSelector}
          onChange={handleSyncModeChange}
          className="source-sync-selector"
        />
      )}
      
      {/* 如果没有同步配置，显示设置按钮 */}
      {!currentSyncConfig && !disabled && (
        <button 
          className="setup-sync-button"
          onClick={() => {
            // 设置默认的同步配置
            const defaultMode = isActualProgress ? 'send-only' : 'receive-only';
            handleSyncModeChange(defaultMode);
          }}
        >
          <span className="setup-icon">⚙️</span>
          <span className="setup-text">设置同步</span>
        </button>
      )}
    </div>
  );
}

export default CalendarSourceDisplay;