/**
 * Widget Page - 悬浮窗口页面
 * 
 * 直接渲染 TimeCalendar，不使用 DesktopCalendarWidgetV3 的 overlay
 * 因为 Electron 窗口本身就是独立容器，不需要额外的 fixed 定位层
 */

import React, { useState, useEffect } from 'react';
import TimeCalendar from '../components/TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';

const WidgetPage: React.FC = () => {
  // 创建Microsoft Calendar服务实例
  const [microsoftService] = useState(() => new MicrosoftCalendarService());

  // 设置body为透明背景（widget模式）
  useEffect(() => {
    document.body.classList.add('widget-mode');
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    return () => {
      document.body.classList.remove('widget-mode');
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
      document.body.style.margin = '';
      document.body.style.padding = '';
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      margin: 0,
      padding: 0,
      backgroundColor: 'transparent',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 直接渲染 TimeCalendar，无需 overlay wrapper */}
      <TimeCalendar
        onStartTimer={(taskTitle: string) => {
          console.log('📝 Timer started for task:', taskTitle);
        }}
        microsoftService={microsoftService}
        style={{
          width: '100%',
          height: '100%',
          border: 'none',
          borderRadius: '0',
          background: 'transparent'
        }}
      />
    </div>
  );
};
};

export default WidgetPage;
