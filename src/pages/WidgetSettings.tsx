/**
 * Widget Settings Window - Widget 设置子窗口
 * 
 * 直接复用 CalendarSettingsPanel 组件
 */

import React, { useState, useEffect } from 'react';
import CalendarSettingsPanel, { CalendarSettings } from '../features/Calendar/components/CalendarSettingsPanel';

const WidgetSettings: React.FC = () => {
  const [settings, setSettings] = useState<CalendarSettings>({
    eventOpacity: 80,
    visibleTags: [],
    visibleCalendars: [],
    showDeadline: true,
    showTask: true,
    showAllDay: true,
    deadlineHeight: 72,
    taskHeight: 72,
    allDayHeight: 24
  });

  const [availableTags, setAvailableTags] = useState<Array<{
    id: string;
    name: string;
    color: string;
    emoji?: string;
    level?: number;
    calendarId?: string;
  }>>([]);

  const [availableCalendars, setAvailableCalendars] = useState<Array<{
    id: string;
    name: string;
    color?: string;
  }>>([]);

  // 🔧 扁平化标签树
  const flattenTags = (tags: any[]): any[] => {
    const result: any[] = [];
    const traverse = (nodes: any[], level: number = 0) => {
      nodes.forEach(node => {
        result.push({
          id: node.id,
          name: node.name,
          color: node.color,
          emoji: node.emoji,
          level,
          calendarId: node.calendarId
        });
        if (node.children && node.children.length > 0) {
          traverse(node.children, level + 1);
        }
      });
    };
    traverse(tags);
    return result;
  };

  // 从 localStorage 加载设置
  useEffect(() => {
    const loadSettings = () => {
      try {
        console.log('🔍 [WidgetSettings] 开始加载设置...');
        
        const saved = localStorage.getItem('widget-calendar-settings');
        let parsed: Partial<CalendarSettings> | null = null;
        if (saved) {
          parsed = JSON.parse(saved);
          setSettings(prev => ({ ...prev, ...parsed }));
          console.log('✅ [WidgetSettings] 加载保存的设置:', parsed);
        }

        // 加载标签
        const tagsData = localStorage.getItem('remarkable-hierarchical-tags');
        console.log('🏷️ [WidgetSettings] 标签数据:', tagsData ? `${tagsData.length} 字符` : '空');
        if (tagsData) {
          const tags = JSON.parse(tagsData);
          console.log('🏷️ [WidgetSettings] 解析标签:', tags);
          const flatTags = flattenTags(tags);
          console.log(`✅ [WidgetSettings] 扁平化标签: ${flatTags.length} 个`, flatTags);
          setAvailableTags(flatTags);
          
          // 如果没有选中的标签，默认全选
          if (!parsed || !parsed.visibleTags || parsed.visibleTags.length === 0) {
            const allTagIds = flatTags.map(t => t.id);
            console.log('📌 [WidgetSettings] 默认全选标签:', allTagIds);
            setSettings(prev => ({
              ...prev,
              visibleTags: allTagIds
            }));
          }
        } else {
          console.warn('⚠️ [WidgetSettings] localStorage 中没有标签数据');
        }

        // 加载日历 - 修复 key 名称
        const calendarsData = localStorage.getItem('remarkable-calendars-cache');
        console.log('📅 [WidgetSettings] 日历数据:', calendarsData ? `${calendarsData.length} 字符` : '空');
        if (calendarsData) {
          const calendars = JSON.parse(calendarsData);
          console.log('📅 [WidgetSettings] 解析日历:', calendars);
          
          // 添加特殊选项
          const allCalendars = [
            ...calendars.map((cal: any) => ({
              id: cal.id,
              name: cal.name,
              color: cal.color || '#3788d8'
            })),
            {
              id: 'local-created',
              name: '🔮 创建自本地',
              color: '#9c27b0'
            },
            {
              id: 'not-synced',
              name: '🔄 未同步至日历',
              color: '#ff9800'
            }
          ];
          
          console.log(`✅ [WidgetSettings] 设置日历: ${allCalendars.length} 个`, allCalendars);
          setAvailableCalendars(allCalendars);
          
          // 如果没有选中的日历，默认全选
          if (!parsed || !parsed.visibleCalendars || parsed.visibleCalendars.length === 0) {
            const allCalendarIds = allCalendars.map((c: any) => c.id);
            console.log('📌 [WidgetSettings] 默认全选日历:', allCalendarIds);
            setSettings(prev => ({
              ...prev,
              visibleCalendars: allCalendarIds
            }));
          }
        } else {
          console.warn('⚠️ [WidgetSettings] localStorage 中没有日历数据');
          // 至少添加特殊选项
          const specialCalendars = [
            {
              id: 'local-created',
              name: '🔮 创建自本地',
              color: '#9c27b0'
            },
            {
              id: 'not-synced',
              name: '🔄 未同步至日历',
              color: '#ff9800'
            }
          ];
          setAvailableCalendars(specialCalendars);
          setSettings(prev => ({
            ...prev,
            visibleCalendars: specialCalendars.map(c => c.id)
          }));
        }
      } catch (error) {
        console.error('❌ [WidgetSettings] 加载设置失败:', error);
      }
    };

    loadSettings();
  }, []);

  // 保存设置到 localStorage
  const handleSettingsChange = (newSettings: CalendarSettings) => {
    console.log('💾 [WidgetSettings] 保存设置:', newSettings);
    setSettings(newSettings);
    localStorage.setItem('widget-calendar-settings', JSON.stringify(newSettings));
    
    // 🔔 通知 Widget 窗口更新
    window.dispatchEvent(new CustomEvent('widget-settings-updated', {
      detail: newSettings
    }));
  };

  const handleClose = () => {
    if (window.electronAPI?.widget?.closeSettings) {
      window.electronAPI.widget.closeSettings();
    }
  };

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      overflow: 'hidden',
      backgroundColor: '#f5f5f5'
    }}>
      <CalendarSettingsPanel
        isOpen={true}
        onClose={handleClose}
        settings={settings}
        onSettingsChange={handleSettingsChange}
        availableTags={availableTags}
        availableCalendars={availableCalendars}
      />
    </div>
  );
};

export default WidgetSettings;
