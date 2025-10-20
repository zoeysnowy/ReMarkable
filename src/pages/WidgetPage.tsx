/**
 * Widget Page - 悬浮窗口页面
 * 
 * 用于桌面悬浮日历的独立页面
 */

import React, { useState, useEffect } from 'react';
import DesktopCalendarWidget from '../components/DesktopCalendarWidget';
import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';

const WidgetPage: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // 从localStorage加载事件和标签
  useEffect(() => {
    const loadData = () => {
      try {
        // 加载事件
        const savedEvents = PersistentStorage.getItem(
          STORAGE_KEYS.EVENTS,
          PERSISTENT_OPTIONS.EVENTS
        );
        if (savedEvents && Array.isArray(savedEvents)) {
          setEvents(savedEvents);
        }

        // 加载标签
        const savedTags = PersistentStorage.getItem(
          STORAGE_KEYS.HIERARCHICAL_TAGS,
          PERSISTENT_OPTIONS.TAGS
        );
        if (savedTags && Array.isArray(savedTags)) {
          setTags(savedTags);
        }
      } catch (error) {
        console.error('Failed to load widget data:', error);
      }
    };

    loadData();

    // 监听storage变化，实时同步数据
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.EVENTS || e.key === STORAGE_KEYS.HIERARCHICAL_TAGS) {
        loadData();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // 定期刷新数据（每5秒）
    const interval = setInterval(loadData, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleEventClick = (event: Event) => {
    console.log('Widget event clicked:', event);
    // 在主窗口打开事件详情（可选）
    // 可以使用Electron IPC通知主窗口
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      margin: 0,
      padding: 0
    }}>
      <DesktopCalendarWidget
        events={events}
        tags={tags}
        onEventClick={handleEventClick}
      />
    </div>
  );
};

export default WidgetPage;
