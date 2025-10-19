/**
 * Calendar Settings Panel - 日历设置面板
 * 
 * 功能：
 * 1. 事件透明度调整
 * 2. 标签筛选
 * 3. 日历分组筛选
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import './CalendarSettingsPanel.css';

export interface CalendarSettings {
  eventOpacity: number; // 0-100
  visibleTags: string[]; // 显示的标签ID列表
  visibleCalendars: string[]; // 显示的日历ID列表
  showMilestone?: boolean; // 是否显示Milestone
  showTask?: boolean; // 是否显示Task
  showAllDay?: boolean; // 是否显示AllDay
  milestoneHeight?: number; // Milestone高度
  taskHeight?: number; // Task高度
  allDayHeight?: number; // AllDay高度
}

interface CalendarSettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  settings: CalendarSettings;
  onSettingsChange: (settings: CalendarSettings) => void;
  availableTags: Array<{id: string; name: string; color: string; calendarId?: string}>;
  availableCalendars: Array<{id: string; name: string; color?: string}>;
}

const CalendarSettingsPanel: React.FC<CalendarSettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  availableTags,
  availableCalendars
}) => {
  const [localSettings, setLocalSettings] = useState<CalendarSettings>(settings);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // 首次打开时，如果 visibleCalendars 为空且有可用日历，自动全选
  useEffect(() => {
    if (isOpen && localSettings.visibleCalendars.length === 0 && availableCalendars.length > 0) {
      const allCalendarIds = availableCalendars.map(c => c.id);
      const newSettings = { ...localSettings, visibleCalendars: allCalendarIds };
      setLocalSettings(newSettings);
      onSettingsChange(newSettings);
    }
  }, [isOpen, availableCalendars]);

  // 点击外部关闭
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleOpacityChange = (value: number) => {
    const newSettings = { ...localSettings, eventOpacity: value };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleTagToggle = (tagId: string) => {
    const isRemoving = localSettings.visibleTags.includes(tagId);
    const newVisibleTags = isRemoving
      ? localSettings.visibleTags.filter(id => id !== tagId)
      : [...localSettings.visibleTags, tagId];
    
    let newVisibleCalendars = [...localSettings.visibleCalendars];
    
    // 🔗 标签→日历联动：勾选标签时，自动勾选其映射的日历
    // ✅ 特殊标签（如'no-tag'）不触发联动
    if (!isRemoving && tagId !== 'no-tag') {
      const tag = availableTags.find(t => t.id === tagId);
      if (tag && tag.calendarId && !newVisibleCalendars.includes(tag.calendarId)) {
        newVisibleCalendars.push(tag.calendarId);
        console.log(`🔗 [联动] 勾选标签"${tag.name}"，自动勾选日历"${tag.calendarId}"`);
      }
    }
    
    const newSettings = { 
      ...localSettings, 
      visibleTags: newVisibleTags,
      visibleCalendars: newVisibleCalendars
    };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleCalendarToggle = (calendarId: string) => {
    const isRemoving = localSettings.visibleCalendars.includes(calendarId);
    const newVisibleCalendars = isRemoving
      ? localSettings.visibleCalendars.filter(id => id !== calendarId)
      : [...localSettings.visibleCalendars, calendarId];
    
    let newVisibleTags = [...localSettings.visibleTags];
    
    // 🔗 日历→标签联动：取消日历时，自动取消所有映射到该日历的标签
    // ✅ 特殊日历选项（如'local-created', 'not-synced'）不触发联动
    if (isRemoving && !['local-created', 'not-synced'].includes(calendarId)) {
      const tagsToRemove = availableTags
        .filter(tag => tag.calendarId === calendarId)
        .map(tag => tag.id);
      
      if (tagsToRemove.length > 0) {
        newVisibleTags = newVisibleTags.filter(id => !tagsToRemove.includes(id));
        console.log(`🔗 [联动] 取消日历"${calendarId}"，自动取消${tagsToRemove.length}个相关标签`);
      }
    }
    
    const newSettings = { 
      ...localSettings, 
      visibleTags: newVisibleTags,
      visibleCalendars: newVisibleCalendars
    };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleSelectAllTags = () => {
    const newSettings = { 
      ...localSettings, 
      visibleTags: availableTags.map(t => t.id) 
    };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleDeselectAllTags = () => {
    const newSettings = { ...localSettings, visibleTags: [] };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleSelectAllCalendars = () => {
    const newSettings = { 
      ...localSettings, 
      visibleCalendars: availableCalendars.map(c => c.id) 
    };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleDeselectAllCalendars = () => {
    const newSettings = { ...localSettings, visibleCalendars: [] };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleCategoryToggle = (category: 'milestone' | 'task' | 'allDay') => {
    const key = category === 'milestone' ? 'showMilestone' : 
                category === 'task' ? 'showTask' : 'showAllDay';
    const newSettings = { ...localSettings, [key]: !localSettings[key] };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleHeightChange = (category: 'milestone' | 'task' | 'allDay', height: number) => {
    const key = category === 'milestone' ? 'milestoneHeight' : 
                category === 'task' ? 'taskHeight' : 'allDayHeight';
    const newSettings = { ...localSettings, [key]: height };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  const handleShowAll = () => {
    const newSettings = {
      ...localSettings,
      visibleTags: [],
      visibleCalendars: []
    };
    setLocalSettings(newSettings);
    onSettingsChange(newSettings);
  };

  if (!isOpen) return null;

  return (
    <div className="calendar-settings-overlay">
      <div className="calendar-settings-panel" ref={panelRef}>
        <div className="settings-header">
          <h3>⚙️ 日历设置</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {/* 透明度调整 */}
          <div className="settings-section">
            <div className="section-title">
              <span>🎨 事件透明度</span>
              <span className="opacity-value">{localSettings.eventOpacity}%</span>
            </div>
            <input
              type="range"
              min="20"
              max="100"
              value={localSettings.eventOpacity}
              onChange={(e) => handleOpacityChange(Number(e.target.value))}
              className="opacity-slider"
            />
          </div>

          {/* 事件类型显示设置 */}
          <div className="settings-section">
            <div className="section-title">
              <span>📋 事件类型显示</span>
            </div>
            <div className="category-settings">
              <div className="category-item">
                <label className="category-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.showMilestone !== false}
                    onChange={() => handleCategoryToggle('milestone')}
                  />
                  <span>🎯 Milestone</span>
                </label>
                {localSettings.showMilestone !== false && (
                  <div className="height-control">
                    <span className="height-label">高度: {localSettings.milestoneHeight || 24}px</span>
                    <input
                      type="range"
                      min="18"
                      max="40"
                      value={localSettings.milestoneHeight || 24}
                      onChange={(e) => handleHeightChange('milestone', Number(e.target.value))}
                      className="height-slider"
                    />
                  </div>
                )}
              </div>

              <div className="category-item">
                <label className="category-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.showTask !== false}
                    onChange={() => handleCategoryToggle('task')}
                  />
                  <span>✅ Task</span>
                </label>
                {localSettings.showTask !== false && (
                  <div className="height-control">
                    <span className="height-label">高度: {localSettings.taskHeight || 24}px</span>
                    <input
                      type="range"
                      min="18"
                      max="40"
                      value={localSettings.taskHeight || 24}
                      onChange={(e) => handleHeightChange('task', Number(e.target.value))}
                      className="height-slider"
                    />
                  </div>
                )}
              </div>

              <div className="category-item">
                <label className="category-toggle">
                  <input
                    type="checkbox"
                    checked={localSettings.showAllDay !== false}
                    onChange={() => handleCategoryToggle('allDay')}
                  />
                  <span>📅 All Day</span>
                </label>
                {localSettings.showAllDay !== false && (
                  <div className="height-control">
                    <span className="height-label">高度: {localSettings.allDayHeight || 24}px</span>
                    <input
                      type="range"
                      min="18"
                      max="40"
                      value={localSettings.allDayHeight || 24}
                      onChange={(e) => handleHeightChange('allDay', Number(e.target.value))}
                      className="height-slider"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 标签筛选 */}
          <div className="settings-section">
            <div className="section-title">
              <span>🏷️ 显示标签 {localSettings.visibleTags.length === 0 && <span style={{fontSize: '11px', color: '#28a745'}}>(全部)</span>}</span>
              <div className="section-actions">
                <button onClick={handleSelectAllTags} className="action-btn">全选</button>
                <button onClick={handleDeselectAllTags} className="action-btn">清空</button>
              </div>
            </div>
            <div className="filter-list">
              {availableTags.length === 0 ? (
                <div className="empty-message">暂无标签</div>
              ) : (
                availableTags.map(tag => (
                  <label key={tag.id} className="filter-item">
                    <input
                      type="checkbox"
                      checked={localSettings.visibleTags.includes(tag.id)}
                      onChange={() => handleTagToggle(tag.id)}
                    />
                    <span 
                      className="color-indicator" 
                      style={{ backgroundColor: tag.color }}
                    ></span>
                    <span className="filter-name">{tag.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>

          {/* 日历分组筛选 */}
          <div className="settings-section">
            <div className="section-title">
              <span>📅 显示日历</span>
              <div className="section-actions">
                <button onClick={handleSelectAllCalendars} className="action-btn">全选</button>
                <button onClick={handleDeselectAllCalendars} className="action-btn">清空</button>
              </div>
            </div>
            <div className="filter-list">
              {availableCalendars.length === 0 ? (
                <div className="empty-message">暂无日历</div>
              ) : (
                availableCalendars.map(calendar => (
                  <label key={calendar.id} className="filter-item">
                    <input
                      type="checkbox"
                      checked={localSettings.visibleCalendars.includes(calendar.id)}
                      onChange={() => handleCalendarToggle(calendar.id)}
                    />
                    <span 
                      className="color-indicator" 
                      style={{ backgroundColor: calendar.color || '#3788d8' }}
                    ></span>
                    <span className="filter-name">{calendar.name}</span>
                  </label>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarSettingsPanel;

