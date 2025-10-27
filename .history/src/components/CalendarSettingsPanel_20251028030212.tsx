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
  availableTags: Array<{id: string; name: string; color: string; emoji?: string; level?: number; calendarId?: string}>;
  availableCalendars: Array<{id: string; name: string; color?: string}>;
  // Widget 模式专用
  isWidgetMode?: boolean;
  widgetOpacity?: number; // 0-1
  widgetColor?: string;
  widgetLocked?: boolean;
  onWidgetOpacityChange?: (opacity: number) => void;
  onWidgetColorChange?: (color: string) => void;
  onWidgetLockToggle?: (locked: boolean) => void;
}

const CalendarSettingsPanel: React.FC<CalendarSettingsPanelProps> = ({
  isOpen,
  onClose,
  settings,
  onSettingsChange,
  availableTags,
  availableCalendars,
  isWidgetMode = false,
  widgetOpacity = 1,
  widgetColor = '#ffffff',
  widgetLocked = false,
  onWidgetOpacityChange,
  onWidgetColorChange,
  onWidgetLockToggle
}) => {
  const [localSettings, setLocalSettings] = useState<CalendarSettings>(settings);
  const panelRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  
  // 🔧 动态计算初始位置：以 time-calendar-container 为参考
  const getInitialPosition = () => {
    if (typeof window === 'undefined') return { x: 1588, y: 180 }; // 🔧 调整为 1640 - 52
    
    // 尝试获取 time-calendar-container 的位置
    const calendarContainer = document.querySelector('.time-calendar-container');
    if (calendarContainer) {
      const rect = calendarContainer.getBoundingClientRect();
      return {
        x: rect.right - 332, // 面板宽度312px + 20px边距
        y: rect.top + 40 // 容器顶部 + 一点间距（考虑toolbar高度）
      };
    }
    
    // 回退方案：使用窗口尺寸
    return {
      x: window.innerWidth - 332, // 🔧 更新为 312px + 20px边距
      y: 180
    };
  };
  
  const [position, setPosition] = useState(getInitialPosition);

  useEffect(() => {
    setLocalSettings(settings);
  }, [settings]);

  // 自动全选所有可用日历（用户登录后）
  useEffect(() => {
    if (isOpen && availableCalendars.length > 0) {
      // 如果当前没有选中任何日历，自动全选
      if (localSettings.visibleCalendars.length === 0) {
        const allCalendarIds = availableCalendars.map(c => c.id);
        const newSettings = { ...localSettings, visibleCalendars: allCalendarIds };
        setLocalSettings(newSettings);
        onSettingsChange(newSettings);
      } else {
        // 如果有新增的日历（用户新登录了账号），自动勾选新日历
        const currentIds = new Set(localSettings.visibleCalendars);
        const newCalendarIds = availableCalendars
          .map(c => c.id)
          .filter(id => !currentIds.has(id));
        
        if (newCalendarIds.length > 0) {
          const updatedCalendarIds = [...localSettings.visibleCalendars, ...newCalendarIds];
          const newSettings = { ...localSettings, visibleCalendars: updatedCalendarIds };
          setLocalSettings(newSettings);
          onSettingsChange(newSettings);
        }
      }
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

  // 拖动功能
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.close-btn')) return; // 不影响关闭按钮
    
    const panel = panelRef.current;
    if (!panel) return;
    
    const rect = panel.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
    setIsDragging(true);
  };

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setLocalSettings(prev => ({ ...prev, eventOpacity: value }));
  };

  const handleOpacityChangeEnd = () => {
    onSettingsChange(localSettings);
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
      <div 
        className="calendar-settings-panel" 
        ref={panelRef}
        style={{
          position: 'fixed',
          left: `${position.x}px`,
          top: `${position.y}px`,
          margin: 0
        }}
      >
        <div 
          className="settings-header"
          onMouseDown={handleHeaderMouseDown}
        >
          <h3>⚙️ 日历设置</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="settings-content">
          {/* 🖥️ Widget 模式专用控件 */}
          {isWidgetMode && (
            <>
              {/* Widget 透明度调整 */}
              <div className="settings-section compact-section">
                <div className="compact-slider-row">
                  <span className="slider-label">🪟 组件透明度</span>
                  <div className="slider-track-wrapper">
                    <div 
                      className="slider-track-fill" 
                      style={{ width: `${widgetOpacity * 100}%` }}
                    />
                    <input
                      type="range"
                      min="0"
                      max="100"
                      value={widgetOpacity * 100}
                      onChange={(e) => {
                        const newOpacity = parseInt(e.target.value) / 100;
                        onWidgetOpacityChange?.(newOpacity);
                      }}
                      className="inline-slider with-track"
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <span className="slider-value">{Math.round(widgetOpacity * 100)}%</span>
                </div>
              </div>

              {/* Widget 背景颜色 */}
              <div className="settings-section compact-section">
                <div className="compact-slider-row">
                  <span className="slider-label">🎨 背景颜色</span>
                  <input
                    type="color"
                    value={widgetColor}
                    onChange={(e) => onWidgetColorChange?.(e.target.value)}
                    style={{
                      width: '80px',
                      height: '32px',
                      border: '1px solid #ddd',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      marginLeft: 'auto'
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                  />
                </div>
              </div>

              {/* Widget 锁定位置 */}
              <div className="settings-section compact-section">
                <div className="compact-slider-row">
                  <span className="slider-label">� 置顶显示</span>
                  <label 
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      marginLeft: 'auto'
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      console.log('🖱️ Pin label clicked');
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={widgetLocked}
                      onChange={(e) => {
                        e.stopPropagation();
                        console.log('🔄 Pin checkbox changed:', e.target.checked);
                        onWidgetLockToggle?.(e.target.checked);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        console.log('🖱️ Pin checkbox clicked');
                      }}
                      style={{
                        width: '18px',
                        height: '18px',
                        cursor: 'pointer'
                      }}
                    />
                    <span style={{ marginLeft: '8px', fontSize: '14px' }}>
                      {widgetLocked ? '已置顶' : '未置顶'}
                    </span>
                  </label>
                </div>
              </div>

              {/* 分隔线 */}
              <div style={{ 
                borderTop: '1px solid #e0e0e0', 
                margin: '12px 0' 
              }} />
            </>
          )}

          {/* 透明度调整 */}
          <div className="settings-section compact-section">
            <div className="compact-slider-row">
              <span className="slider-label">🎨 事件透明度</span>
              <div className="slider-track-wrapper">
                <div 
                  className="slider-track-fill" 
                  style={{ width: `${(localSettings.eventOpacity - 20) / 0.8}%` }}
                />
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={localSettings.eventOpacity}
                  onChange={handleOpacityChange}
                  onMouseUp={handleOpacityChangeEnd}
                  onTouchEnd={handleOpacityChangeEnd}
                  className="inline-slider with-track"
                  onMouseDown={(e) => e.stopPropagation()}
                />
              </div>
              <span className="slider-value">{localSettings.eventOpacity}%</span>
            </div>
          </div>

          {/* 事件类型显示设置 */}
          <div className="settings-section compact-section">
            <div className="section-title">
              <span>📋 事件类型显示</span>
            </div>
            <div className="category-settings-compact">
              {/* Milestone */}
              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={localSettings.showMilestone !== false}
                    onChange={() => handleCategoryToggle('milestone')}
                  />
                  <span>🎯 Milestone</span>
                </label>
                {localSettings.showMilestone !== false && (
                  <>
                    <div className="slider-track-wrapper compact">
                      <div 
                        className="slider-track-fill" 
                        style={{ width: `${((localSettings.milestoneHeight || 24) - 18) / 0.22}%` }}
                      />
                      <input
                        type="range"
                        min="18"
                        max="40"
                        value={localSettings.milestoneHeight || 24}
                        onChange={(e) => handleHeightChange('milestone', Number(e.target.value))}
                        className="inline-slider compact with-track"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <span className="slider-value compact">{localSettings.milestoneHeight || 24}px</span>
                  </>
                )}
              </div>

              {/* Task */}
              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={localSettings.showTask !== false}
                    onChange={() => handleCategoryToggle('task')}
                  />
                  <span>✅ Task</span>
                </label>
                {localSettings.showTask !== false && (
                  <>
                    <div className="slider-track-wrapper compact">
                      <div 
                        className="slider-track-fill" 
                        style={{ width: `${((localSettings.taskHeight || 24) - 18) / 0.22}%` }}
                      />
                      <input
                        type="range"
                        min="18"
                        max="40"
                        value={localSettings.taskHeight || 24}
                        onChange={(e) => handleHeightChange('task', Number(e.target.value))}
                        className="inline-slider compact with-track"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <span className="slider-value compact">{localSettings.taskHeight || 24}px</span>
                  </>
                )}
              </div>

              {/* All Day */}
              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={localSettings.showAllDay !== false}
                    onChange={() => handleCategoryToggle('allDay')}
                  />
                  <span>📅 All Day</span>
                </label>
                {localSettings.showAllDay !== false && (
                  <>
                    <div className="slider-track-wrapper compact">
                      <div 
                        className="slider-track-fill" 
                        style={{ width: `${((localSettings.allDayHeight || 24) - 18) / 0.22}%` }}
                      />
                      <input
                        type="range"
                        min="18"
                        max="40"
                        value={localSettings.allDayHeight || 24}
                        onChange={(e) => handleHeightChange('allDay', Number(e.target.value))}
                        className="inline-slider compact with-track"
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <span className="slider-value compact">{localSettings.allDayHeight || 24}px</span>
                  </>
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
                (() => {
                  // 🔍 完整的层级缩进诊断
                  console.group('🏷️ 标签层级缩进诊断');
                  console.log('📊 总标签数:', availableTags.length);
                  console.table(availableTags.map(tag => ({
                    name: tag.name,
                    level: tag.level,
                    paddingLeft: `${(tag.level || 0) * 12}px`,
                    hasLevel: tag.level !== undefined,
                    levelValue: tag.level
                  })));
                  console.groupEnd();
                  
                  return availableTags.map(tag => {
                    const paddingLeft = `${(tag.level || 0) * 12}px`;
                    
                    return (
                      <label key={tag.id} className="filter-item">
                        <input
                          type="checkbox"
                          checked={localSettings.visibleTags.includes(tag.id)}
                          onChange={() => handleTagToggle(tag.id)}
                        />
                        <div 
                          className="tag-content"
                          style={{ paddingLeft }}
                          data-level={tag.level || 0}
                          data-padding={paddingLeft}
                        >
                          {/* 颜色标记 # */}
                          <span 
                            className="tag-hash" 
                            style={{ color: tag.color }}
                          >#</span>
                          
                          {/* Emoji */}
                          <span className="tag-emoji">{tag.emoji || '🏷️'}</span>
                          
                          {/* 标签名称 - 保留颜色 */}
                          <span 
                            className="tag-name"
                            style={{ 
                              color: tag.color
                              // 🔧 移除 fontWeight，与日历保持一致的字重
                            }}
                          >{tag.name}</span>
                        </div>
                      </label>
                    );
                  });
                })()
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
                  <label key={calendar.id} className="filter-item calendar-item">
                    <input
                      type="checkbox"
                      checked={localSettings.visibleCalendars.includes(calendar.id)}
                      onChange={() => handleCalendarToggle(calendar.id)}
                    />
                    <div className="calendar-content">
                      {/* 颜色圆点 */}
                      <span 
                        className="calendar-dot" 
                        style={{ backgroundColor: calendar.color || '#3788d8' }}
                      ></span>
                      
                      {/* 日历名称 */}
                      <span className="calendar-name">{calendar.name}</span>
                    </div>
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

