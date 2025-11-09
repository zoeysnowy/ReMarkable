/**
 * Widget Settings Page - Widget 设置子窗口
 * 
 * 功能：
 * 1. Widget 透明度、背景颜色、置顶设置
 * 2. 事件透明度、类型显示设置
 * 3. 标签筛选、日历筛选
 * 
 * 注意：独立子窗口，设置不影响主程序
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useEffect } from 'react';
import '../features/Calendar/styles/CalendarSettingsPanel.css';

interface WidgetSettingsData {
  // Widget 组件设置
  widgetOpacity: number; // 0-100
  widgetColor: string;
  widgetLocked: boolean;
  
  // 事件显示设置
  eventOpacity: number; // 0-100
  showDeadline: boolean;
  showTask: boolean;
  showAllDay: boolean;
  deadlineHeight: number;
  taskHeight: number;
  allDayHeight: number;
  
  // 筛选设置
  visibleTags: string[];
  visibleCalendars: string[];
}

const WidgetSettings: React.FC = () => {
  const [settings, setSettings] = useState<WidgetSettingsData>({
    widgetOpacity: 80,
    widgetColor: '#2f333c',
    widgetLocked: false,
    eventOpacity: 85,
    showDeadline: true,
    showTask: true,
    showAllDay: true,
    deadlineHeight: 72,
    taskHeight: 72,
    allDayHeight: 24,
    visibleTags: [],
    visibleCalendars: []
  });

  const [availableTags, setAvailableTags] = useState<Array<{
    id: string;
    name: string;
    color: string;
    emoji?: string;
    level?: number;
  }>>([]);

  const [availableCalendars, setAvailableCalendars] = useState<Array<{
    id: string;
    name: string;
    color?: string;
  }>>([]);

  // 从 localStorage 加载设置
  useEffect(() => {
    const loadSettings = () => {
      try {
        const saved = localStorage.getItem('widget-calendar-settings');
        let parsed: Partial<WidgetSettingsData> | null = null;
        if (saved) {
          parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
        }

        // 加载标签
        const tagsData = localStorage.getItem('remarkable-hierarchical-tags');
        if (tagsData) {
          const tags = JSON.parse(tagsData);
          const flatTags = flattenTags(tags);
          setAvailableTags(flatTags);
          
          // 如果没有选中的标签，默认全选
          if (!parsed || parsed.visibleTags?.length === 0) {
            setSettings(prev => ({
              ...prev,
              visibleTags: flatTags.map(t => t.id)
            }));
          }
        }

        // 加载日历
        const calendarsData = localStorage.getItem('ms-calendar-cached-calendars');
        if (calendarsData) {
          const calendars = JSON.parse(calendarsData);
          setAvailableCalendars(calendars);
          
          // 如果没有选中的日历，默认全选
          if (!parsed || parsed.visibleCalendars?.length === 0) {
            setSettings(prev => ({
              ...prev,
              visibleCalendars: calendars.map((c: any) => c.id)
            }));
          }
        }
      } catch (error) {
        console.error('Failed to load widget settings:', error);
      }
    };

    loadSettings();
  }, []);

  // 扁平化标签树
  const flattenTags = (tags: any[], level = 0, parentPadding = 0): any[] => {
    let result: any[] = [];
    tags.forEach(tag => {
      result.push({ ...tag, level, parentPadding });
      if (tag.children && tag.children.length > 0) {
        result = result.concat(flattenTags(tag.children, level + 1, parentPadding + 12));
      }
    });
    return result;
  };

  // 保存设置
  const saveSettings = (newSettings: Partial<WidgetSettingsData>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('widget-calendar-settings', JSON.stringify(updated));
    
    // 触发主窗口刷新（通过 localStorage 事件）
    window.dispatchEvent(new Event('widget-settings-changed'));
  };

  // 关闭窗口
  const handleClose = () => {
    if ((window as any).electronAPI?.widget?.closeSettings) {
      (window as any).electronAPI.widget.closeSettings();
    }
  };

  // 标签全选/清空
  const handleTagsSelectAll = () => {
    saveSettings({ visibleTags: availableTags.map(t => t.id) });
  };

  const handleTagsClear = () => {
    saveSettings({ visibleTags: [] });
  };

  // 日历全选/清空
  const handleCalendarsSelectAll = () => {
    saveSettings({ visibleCalendars: availableCalendars.map(c => c.id) });
  };

  const handleCalendarsClear = () => {
    saveSettings({ visibleCalendars: [] });
  };

  // 切换标签可见性
  const toggleTag = (tagId: string) => {
    const visible = settings.visibleTags.includes(tagId);
    const newTags = visible
      ? settings.visibleTags.filter(id => id !== tagId)
      : [...settings.visibleTags, tagId];
    saveSettings({ visibleTags: newTags });
  };

  // 切换日历可见性
  const toggleCalendar = (calendarId: string) => {
    const visible = settings.visibleCalendars.includes(calendarId);
    const newCalendars = visible
      ? settings.visibleCalendars.filter(id => id !== calendarId)
      : [...settings.visibleCalendars, calendarId];
    saveSettings({ visibleCalendars: newCalendars });
  };

  return (
    <div className="calendar-settings-overlay" style={{ position: 'fixed', inset: 0, background: 'transparent' }}>
      <div className="calendar-settings-panel" style={{ position: 'absolute', left: 0, top: 0, margin: 0 }}>
        <div className="settings-header">
          <h3>⚙️ 日历设置</h3>
          <button className="close-btn" onClick={handleClose}>×</button>
        </div>

        <div className="settings-content">
          {/* Widget 组件设置 */}
          <div className="settings-section compact-section">
            <div className="compact-slider-row">
              <span className="slider-label">🪟 组件透明度</span>
              <div className="slider-track-wrapper">
                <div className="slider-track-fill" style={{ width: `${settings.widgetOpacity}%` }}></div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={settings.widgetOpacity}
                  onChange={(e) => saveSettings({ widgetOpacity: Number(e.target.value) })}
                  className="inline-slider with-track"
                />
              </div>
              <span className="slider-value">{settings.widgetOpacity}%</span>
            </div>
          </div>

          <div className="settings-section compact-section">
            <div className="compact-slider-row">
              <span className="slider-label">🎨 背景颜色</span>
              <input
                type="color"
                value={settings.widgetColor}
                onChange={(e) => saveSettings({ widgetColor: e.target.value })}
                style={{
                  width: '80px',
                  height: '32px',
                  border: '1px solid #ddd',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginLeft: 'auto'
                }}
              />
            </div>
          </div>

          <div className="settings-section compact-section">
            <div className="compact-slider-row">
              <span className="slider-label">📌 置顶显示</span>
              <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', marginLeft: 'auto' }}>
                <input
                  type="checkbox"
                  checked={settings.widgetLocked}
                  onChange={(e) => saveSettings({ widgetLocked: e.target.checked })}
                  style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                />
                <span style={{ marginLeft: '8px', fontSize: '14px' }}>
                  {settings.widgetLocked ? '已置顶' : '未置顶'}
                </span>
              </label>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e0e0e0', margin: '12px 0' }}></div>

          {/* 事件透明度 */}
          <div className="settings-section compact-section">
            <div className="compact-slider-row">
              <span className="slider-label">🎨 事件透明度</span>
              <div className="slider-track-wrapper">
                <div className="slider-track-fill" style={{ width: `${(settings.eventOpacity - 20) / 0.8}%` }}></div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={settings.eventOpacity}
                  onChange={(e) => saveSettings({ eventOpacity: Number(e.target.value) })}
                  className="inline-slider with-track"
                />
              </div>
              <span className="slider-value">{settings.eventOpacity}%</span>
            </div>
          </div>

          {/* 事件类型显示 */}
          <div className="settings-section compact-section">
            <div className="section-title">
              <span>📋 事件类型显示</span>
            </div>
            <div className="category-settings-compact">
              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.showDeadline}
                    onChange={(e) => saveSettings({ showDeadline: e.target.checked })}
                  />
                  <span>🎯 Deadline</span>
                </label>
                <div className="slider-track-wrapper compact">
                  <div className="slider-track-fill" style={{ width: `${settings.deadlineHeight / 3}%` }}></div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={settings.deadlineHeight}
                    onChange={(e) => saveSettings({ deadlineHeight: Number(e.target.value) })}
                    className="inline-slider compact with-track"
                  />
                </div>
                <span className="slider-value compact">{settings.deadlineHeight}px</span>
              </div>

              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.showTask}
                    onChange={(e) => saveSettings({ showTask: e.target.checked })}
                  />
                  <span>✅ Task</span>
                </label>
                <div className="slider-track-wrapper compact">
                  <div className="slider-track-fill" style={{ width: `${settings.taskHeight / 3}%` }}></div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={settings.taskHeight}
                    onChange={(e) => saveSettings({ taskHeight: Number(e.target.value) })}
                    className="inline-slider compact with-track"
                  />
                </div>
                <span className="slider-value compact">{settings.taskHeight}px</span>
              </div>

              <div className="compact-category-row">
                <label className="category-checkbox">
                  <input
                    type="checkbox"
                    checked={settings.showAllDay}
                    onChange={(e) => saveSettings({ showAllDay: e.target.checked })}
                  />
                  <span>📅 All Day</span>
                </label>
                <div className="slider-track-wrapper compact">
                  <div className="slider-track-fill" style={{ width: `${settings.allDayHeight / 3}%` }}></div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    value={settings.allDayHeight}
                    onChange={(e) => saveSettings({ allDayHeight: Number(e.target.value) })}
                    className="inline-slider compact with-track"
                  />
                </div>
                <span className="slider-value compact">{settings.allDayHeight}px</span>
              </div>
            </div>
          </div>

          {/* 标签筛选 */}
          <div className="settings-section">
            <div className="section-title">
              <span>
                🏷️ 显示标签{' '}
                <span style={{ fontSize: '11px', color: settings.visibleTags.length === availableTags.length ? '#28a745' : '#999' }}>
                  ({settings.visibleTags.length === availableTags.length ? '全部' : `${settings.visibleTags.length}/${availableTags.length}`})
                </span>
              </span>
              <div className="section-actions">
                <button className="action-btn" onClick={handleTagsSelectAll}>全选</button>
                <button className="action-btn" onClick={handleTagsClear}>清空</button>
              </div>
            </div>
            <div className="filter-list">
              {availableTags.map(tag => (
                <label key={tag.id} className="filter-item">
                  <input
                    type="checkbox"
                    checked={settings.visibleTags.includes(tag.id)}
                    onChange={() => toggleTag(tag.id)}
                  />
                  <div className="tag-content" data-level={tag.level} style={{ paddingLeft: `${(tag.level || 0) * 12}px` }}>
                    <span className="tag-hash" style={{ color: tag.color }}>#</span>
                    {tag.emoji && <span className="tag-emoji">{tag.emoji}</span>}
                    <span className="tag-name" style={{ color: tag.color }}>{tag.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 日历筛选 */}
          <div className="settings-section">
            <div className="section-title">
              <span>📅 显示日历</span>
              <div className="section-actions">
                <button className="action-btn" onClick={handleCalendarsSelectAll}>全选</button>
                <button className="action-btn" onClick={handleCalendarsClear}>清空</button>
              </div>
            </div>
            <div className="filter-list">
              {availableCalendars.map(calendar => (
                <label key={calendar.id} className="filter-item calendar-item">
                  <input
                    type="checkbox"
                    checked={settings.visibleCalendars.includes(calendar.id)}
                    onChange={() => toggleCalendar(calendar.id)}
                  />
                  <div className="calendar-content">
                    <span className="calendar-dot" style={{ backgroundColor: calendar.color || '#999' }}></span>
                    <span className="calendar-name">{calendar.name}</span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WidgetSettings;
