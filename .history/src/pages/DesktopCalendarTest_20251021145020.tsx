import React, { useState } from 'react';
import DesktopCalendarWidget from '../components/DesktopCalendarWidget';
import { Event } from '../types';

const DesktopCalendarTest: React.FC = () => {
  const [events] = useState<Event[]>([
    {
      id: '1',
      title: '测试事件 1',
      description: '这是一个测试事件',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1小时后
      isAllDay: false,
      location: '测试地点',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['tag1']
    },
    {
      id: '2',
      title: '测试事件 2',
      description: '这是另一个测试事件',
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 明天
      endTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000).toISOString(), // 明天+2小时
      isAllDay: false,
      location: '另一个测试地点',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      tags: ['tag2']
    }
  ]);

  const [tags] = useState([
    {
      id: 'tag1',
      name: '工作',
      color: '#e74c3c',
      emoji: '💼'
    },
    {
      id: 'tag2',
      name: '个人',
      color: '#3498db',
      emoji: '🏠'
    }
  ]);

  const handleEventClick = (event: Event) => {
    console.log('点击事件:', event);
    alert(`点击事件: ${event.title}`);
  };

  const handleEventUpdate = (event: Event) => {
    console.log('更新事件:', event);
    alert(`更新事件: ${event.title}`);
  };

  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      position: 'relative'
    }}>
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        color: 'white',
        zIndex: 1000,
        background: 'rgba(0,0,0,0.5)',
        padding: '10px',
        borderRadius: '5px'
      }}>
        <h2>桌面日历组件测试</h2>
        <p>事件数量: {events.length}</p>
        <p>标签数量: {tags.length}</p>
        <p>⭐ 测试透明度效果和拖拽功能</p>
      </div>
      
      <DesktopCalendarWidget
        events={events}
        tags={tags}
        onEventClick={handleEventClick}
        onEventUpdate={handleEventUpdate}
      />
    </div>
  );
};

export default DesktopCalendarTest;