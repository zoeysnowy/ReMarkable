/**
 * Widget Page - 悬浮窗口页面
 * 
 * 用于桌面悬浮日历的独立页面
 */

import React, { useState, useEffect } from 'react';
import DesktopCalendarWidgetV3 from '../components/DesktopCalendarWidgetV3';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';

const WidgetPage: React.FC = () => {
  // 创建Microsoft Calendar服务实例
  const [microsoftService] = useState(() => new MicrosoftCalendarService());

  // 设置body为透明背景（widget模式）
  useEffect(() => {
    document.body.classList.add('widget-mode');
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden';
    
    return () => {
      document.body.classList.remove('widget-mode');
      document.body.style.backgroundColor = '';
      document.body.style.overflow = '';
    };
  }, []);

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      margin: 0,
      padding: 0,
      backgroundColor: 'transparent'
    }}>
      <DesktopCalendarWidgetV3
        microsoftService={microsoftService}
        style={{
          width: '100%',
          height: '100%',
          margin: 0,
          padding: 0
        }}
      />
    </div>
  );
};

export default WidgetPage;
