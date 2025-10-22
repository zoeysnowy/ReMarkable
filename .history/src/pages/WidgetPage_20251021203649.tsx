import React, { useState, useEffect, CSSProperties } from 'react';
import TimeCalendar from '../components/TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';

// 扩展 CSSProperties 以支持 WebkitAppRegion
interface CustomCSSProperties extends CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const WidgetPage: React.FC = () => {
  const [microsoftService] = useState(() => new MicrosoftCalendarService());
  const [showSettings, setShowSettings] = useState(false);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(1.0);

  // 从 localStorage 加载设置
  useEffect(() => {
    const savedColor = localStorage.getItem('widget-bg-color');
    const savedOpacity = localStorage.getItem('widget-bg-opacity');
    
    if (savedColor) setBgColor(savedColor);
    if (savedOpacity) setBgOpacity(parseFloat(savedOpacity));
  }, []);

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

  const handleClose = () => {
    if (window.electronAPI?.closeWindow) {
      window.electronAPI.closeWindow();
    }
  };

  const handleColorChange = (color: string) => {
    setBgColor(color);
    localStorage.setItem('widget-bg-color', color);
  };

  const handleOpacityChange = (opacity: number) => {
    setBgOpacity(opacity);
    localStorage.setItem('widget-bg-opacity', opacity.toString());
  };

  // 将十六进制颜色转换为 rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const dragBarStyle: CustomCSSProperties = {
    height: '32px',
    background: 'linear-gradient(135deg, rgba(100, 100, 255, 0.9), rgba(150, 100, 255, 0.9))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    WebkitAppRegion: 'drag',
    cursor: 'move',
    borderRadius: '8px 8px 0 0',
    boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
  };

  const closeButtonStyle: CustomCSSProperties = {
    WebkitAppRegion: 'no-drag',
    background: 'rgba(255, 255, 255, 0.2)',
    border: 'none',
    borderRadius: '4px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '16px',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.2s'
  };

  const resizeHandleStyle: CustomCSSProperties = {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '16px',
    height: '16px',
    cursor: 'nwse-resize',
    WebkitAppRegion: 'no-drag',
    background: 'rgba(100, 100, 255, 0.3)',
    borderRadius: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    color: 'rgba(255,255,255,0.8)'
  };

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
      {/* 拖动栏 */}
      <div style={dragBarStyle}>
        <span style={{ 
          fontSize: '13px', 
          fontWeight: 600, 
          color: 'white',
          userSelect: 'none'
        }}>
          📅 日历组件
        </span>
        <button
          onClick={handleClose}
          style={closeButtonStyle}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
        >
          ×
        </button>
      </div>

      {/* 日历内容区域 */}
      <div style={{
        flex: 1,
        overflow: 'hidden',
        background: 'white',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)'
      }}>
        <TimeCalendar
          onStartTimer={(taskTitle: string) => {
            console.log('Timer started:', taskTitle);
          }}
          microsoftService={microsoftService}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            borderRadius: '0 0 8px 8px'
          }}
        />
      </div>

      {/* 缩放手柄 - 右下角 */}
      <div style={resizeHandleStyle}>
        ⋰
      </div>
    </div>
  );
};

export default WidgetPage;
