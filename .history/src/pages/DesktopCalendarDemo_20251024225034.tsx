/**
 * Desktop Time Calendar Demo
 * 桌面时光日历演示页面
 */

import React, { useState, useEffect } from 'react';
import DesktopTimeCalendar from '../components/DesktopTimeCalendar';
import { Event } from '../types';

const DesktopCalendarDemo: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [tags, setTags] = useState<any[]>([]);

  // 从 localStorage 加载数据
  useEffect(() => {
    const loadedEvents = localStorage.getItem('remarkable-events');
    const loadedTags = localStorage.getItem('remarkable-tags');
    
    if (loadedEvents) {
      try {
        setEvents(JSON.parse(loadedEvents));
      } catch (error) {
        console.error('Failed to load events:', error);
      }
    }
    
    if (loadedTags) {
      try {
        setTags(JSON.parse(loadedTags));
      } catch (error) {
        console.error('Failed to load tags:', error);
      }
    }
  }, []);

  // 保存到 localStorage
  const saveEvents = (newEvents: Event[]) => {
    setEvents(newEvents);
    localStorage.setItem('remarkable-events', JSON.stringify(newEvents));
  };

  const handleEventCreate = (event: Event) => {
    const newEvent = {
      ...event,
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    saveEvents([...events, newEvent]);
    
    // 🔔 [FIX] 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { 
        eventId: newEvent.id,
        isNewEvent: true,
        tags: newEvent.tags
      }
    }));
  };

  const handleEventUpdate = (event: Event) => {
    const updatedEvent = {
      ...event,
      updatedAt: new Date().toISOString()
    };
    saveEvents(events.map(e => e.id === event.id ? updatedEvent : e));
    
    // 🔔 [FIX] 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { 
        eventId: updatedEvent.id,
        isNewEvent: false,
        tags: updatedEvent.tags
      }
    }));
  };

  const handleEventDelete = (eventId: string) => {
    saveEvents(events.filter(e => e.id !== eventId));
    
    // 🔔 [FIX] 触发全局事件更新通知
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { 
        eventId: eventId,
        isDeleted: true
      }
    }));
  };

  const handleStartTimer = (taskTitle: string) => {
    console.log('⏱️ 开始计时:', taskTitle);
    // 这里可以集成你的计时器逻辑
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei", sans-serif'
    }}>
      {/* 提示信息 */}
      <div style={{
        position: 'fixed',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 5000,
        fontSize: '14px',
        color: '#495057'
      }}>
        <strong>🎯 桌面时光日历演示</strong>
        <div style={{ marginTop: '8px', fontSize: '12px', color: '#6c757d' }}>
          • 拖动标题栏移动窗口<br/>
          • 拖动右下角调整大小<br/>
          • 点击锁定按钮固定窗口<br/>
          • 点击设置按钮自定义外观
        </div>
      </div>

      {/* 桌面日历组件 */}
      <DesktopTimeCalendar
        events={events}
        tags={tags}
        onEventClick={(event) => {
          console.log('📅 点击事件:', event);
        }}
        onEventCreate={handleEventCreate}
        onEventUpdate={handleEventUpdate}
        onEventDelete={handleEventDelete}
        onStartTimer={handleStartTimer}
      />

      {/* 统计信息 */}
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        padding: '12px 20px',
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
        zIndex: 5000,
        fontSize: '12px',
        color: '#495057'
      }}>
        <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>📊 统计</div>
        <div>事件总数: {events.length}</div>
        <div>标签数量: {tags.length}</div>
        <div style={{ marginTop: '8px', fontSize: '11px', color: '#6c757d' }}>
          数据自动保存到 localStorage
        </div>
      </div>
    </div>
  );
};

export default DesktopCalendarDemo;
