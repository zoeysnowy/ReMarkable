/**
 * Desktop Calendar Widget - 桌面日历悬浮组件 V2
 * 
 * 基于TimeCalendar组件，提供完整的日历功能和同步能力
 * 额外支持透明度、大小调整、拖曳和锁定功能
 * 可作为桌面小部件使用
 * 
 * @author Zoey Gong
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { TimeCalendar } from './TimeCalendar';
import '@toast-ui/calendar/dist/toastui-calendar.css';
import '../styles/calendar.css';
import '../styles/widget.css';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';

interface DesktopCalendarWidgetProps {
  onStartTimer: (taskTitle: string) => void;
  microsoftService?: MicrosoftCalendarService;
  syncManager?: any;
  lastSyncTime?: Date | null;
  availableTags?: any[];
}

const DesktopCalendarWidget: React.FC<DesktopCalendarWidgetProps> = ({
  onStartTimer,
  microsoftService,
  syncManager,
  lastSyncTime,
  availableTags = []
}) => {
  // 窗口控制状态
  const [isLocked, setIsLocked] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // 窗口尺寸和位置
  const [windowSize, setWindowSize] = useState({ width: 800, height: 700 });
  const [windowPosition, setWindowPosition] = useState({ x: 100, y: 100 });
  
  // 拖拽起始位置
  const dragStartRef = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  
  // 控制面板可见性
  const [showControls, setShowControls] = useState(true);
  
  // 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  
  // 透明度设置 - 支持多层透明度
  const [windowOpacity, setWindowOpacity] = useState(0.95); // 整体窗口透明度
  const [backgroundOpacity, setBackgroundOpacity] = useState(0.8); // 日历背景透明度
  const [contentOpacity, setContentOpacity] = useState(1.0); // 日历内容透明度
  
  // 背景色设置
  const [windowBgColor, setWindowBgColor] = useState('#ffffff');
  const [calendarBgColor, setCalendarBgColor] = useState('#ffffff');

  // 键盘事件处理 - ESC 键关闭设置面板
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showSettings) {
        setShowSettings(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings]);

  // 与Electron通信
  useEffect(() => {
    if (window.electronAPI) {
      window.electronAPI.on('widget-opacity-change', (...args: any[]) => {
        const newOpacity = args[0] as number;
        setWindowOpacity(newOpacity);
      });
      
      window.electronAPI.on('widget-lock-toggle', (...args: any[]) => {
        const locked = args[0] as boolean;
        setIsLocked(locked);
      });
    }
  }, []);

  // 应用多层透明度样式
  useEffect(() => {
    const styleId = 'desktop-calendar-widget-v2-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    // 计算透明度的十六进制值
    const windowAlpha = Math.round(windowOpacity * 255).toString(16).padStart(2, '0');
    const backgroundAlpha = Math.round(backgroundOpacity * 255).toString(16).padStart(2, '0');
    
    const windowBgWithAlpha = `${windowBgColor}${windowAlpha}`;
    const calendarBgWithAlpha = `${calendarBgColor}${backgroundAlpha}`;
    
    styleElement.textContent = `
      /* 桌面日历组件透明度样式 */
      .desktop-calendar-widget-v2 {
        background-color: ${windowBgWithAlpha} !important;
        backdrop-filter: blur(${windowOpacity < 1 ? '10px' : '0px'});
      }
      
      /* TimeCalendar 组件背景 */
      .desktop-calendar-widget-v2 .time-calendar-container,
      .desktop-calendar-widget-v2 .time-calendar {
        background-color: ${calendarBgWithAlpha} !important;
      }
      
      /* TUI Calendar 所有背景层 */
      .desktop-calendar-widget-v2 .toastui-calendar,
      .desktop-calendar-widget-v2 .toastui-calendar-container,
      .desktop-calendar-widget-v2 .toastui-calendar-layout,
      .desktop-calendar-widget-v2 .toastui-calendar-panel {
        background-color: ${calendarBgWithAlpha} !important;
      }
      
      /* 月视图背景 */
      .desktop-calendar-widget-v2 .toastui-calendar-month,
      .desktop-calendar-widget-v2 .toastui-calendar-month-date,
      .desktop-calendar-widget-v2 .toastui-calendar-month-grid,
      .desktop-calendar-widget-v2 .toastui-calendar-month-grid-wrapper {
        background-color: transparent !important;
      }
      
      /* 周视图背景 */
      .desktop-calendar-widget-v2 .toastui-calendar-week,
      .desktop-calendar-widget-v2 .toastui-calendar-week-view,
      .desktop-calendar-widget-v2 .toastui-calendar-week-view-day-names,
      .desktop-calendar-widget-v2 .toastui-calendar-time-zone {
        background-color: transparent !important;
      }
      
      /* 日视图背景 */
      .desktop-calendar-widget-v2 .toastui-calendar-day-view,
      .desktop-calendar-widget-v2 .toastui-calendar-time {
        background-color: transparent !important;
      }
      
      /* 头部区域 */
      .desktop-calendar-widget-v2 .toastui-calendar-header,
      .desktop-calendar-widget-v2 .toastui-calendar-navigation {
        background-color: transparent !important;
      }
      
      /* 事件内容透明度 */
      .desktop-calendar-widget-v2 .toastui-calendar-event {
        opacity: ${contentOpacity};
      }
      
      /* 网格线透明度 */
      .desktop-calendar-widget-v2 .toastui-calendar-grid-line {
        opacity: ${contentOpacity * 0.3};
      }
      
      /* 设置面板背景 */
      .desktop-calendar-widget-v2 .widget-settings-panel {
        background-color: rgba(255, 255, 255, ${Math.max(0.95, backgroundOpacity)}) !important;
        backdrop-filter: blur(20px);
        border: 1px solid rgba(255, 255, 255, 0.3);
      }
    `;
    
    return () => {
      if (styleElement && styleElement.parentNode) {
        styleElement.parentNode.removeChild(styleElement);
      }
    };
  }, [windowOpacity, backgroundOpacity, contentOpacity, windowBgColor, calendarBgColor]);

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
    if (isLocked || isDragging) return;
    
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      windowX: windowPosition.x,
      windowY: windowPosition.y
    };
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    setWindowPosition({
      x: dragStartRef.current.windowX + deltaX,
      y: dragStartRef.current.windowY + deltaY
    });
  }, [isDragging]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 调整大小处理
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: windowSize.width,
      height: windowSize.height
    };
    e.preventDefault();
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    setWindowSize({
      width: Math.max(400, resizeStartRef.current.width + deltaX),
      height: Math.max(300, resizeStartRef.current.height + deltaY)
    });
  }, [isResizing]);

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // 切换锁定状态
  const toggleLock = () => {
    setIsLocked(!isLocked);
    if (window.electronAPI) {
      window.electronAPI.widgetLock(!isLocked);
    }
  };

  // 全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
      return () => {
        document.removeEventListener('mousemove', handleDragMove);
        document.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove]);

  return (
    <div 
      className="desktop-calendar-widget-v2"
      style={{
        position: 'fixed',
        left: windowPosition.x,
        top: windowPosition.y,
        width: windowSize.width,
        height: windowSize.height,
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: `0 8px 32px rgba(0, 0, 0, ${0.1 + (1 - windowOpacity) * 0.2})`,
        border: '1px solid rgba(255, 255, 255, 0.3)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        userSelect: isLocked ? 'none' : 'auto'
      }}
    >
      {/* 标题栏 */}
      <div 
        className="widget-titlebar"
        onMouseEnter={() => setShowControls(true)}
        style={{
          height: '40px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          transition: 'opacity 0.2s',
          opacity: showControls ? 1 : 0.3,
          cursor: isLocked ? 'default' : 'move'
        }}
        onMouseDown={handleDragStart}
      >
        {/* 左侧：标题 */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '12px',
          flex: 1,
          paddingRight: '12px'
        }}>
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
            📅 时光日历桌面版
          </span>
        </div>
        
        {/* 右侧：控制区域 */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
          onMouseDown={(e) => e.stopPropagation()} // 阻止拖动
        >
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              backgroundColor: showSettings ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="日历设置"
          >
            ⚙️
          </button>
          
          {/* 锁定按钮 */}
          <button
            onClick={toggleLock}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: isLocked ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              fontWeight: 'bold'
            }}
            title={isLocked ? '解锁位置：允许拖拽移动' : '锁定位置：禁止拖拽移动'}
          >
            {isLocked ? '🔒 已锁定' : '🔓 可拖拽'}
          </button>
          
          {/* 最小化按钮 */}
          <button
            onClick={() => window.electronAPI?.widgetMinimize()}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="最小化"
          >
            ➖
          </button>
        </div>
      </div>

      {/* 设置面板遮罩 */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            zIndex: 998
          }}
          onClick={() => setShowSettings(false)}
        />
      )}

      {/* 设置面板 */}
      {showSettings && (
        <div
          className="widget-settings-panel"
          style={{
            position: 'absolute',
            top: '50px',
            right: '16px',
            width: '320px',
            maxHeight: '80vh',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            overflow: 'auto',
            zIndex: 999,
            padding: '16px'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 设置面板标题栏 */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center', 
            marginBottom: '16px',
            paddingBottom: '8px',
            borderBottom: '1px solid #e9ecef'
          }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#212529' }}>
              ⚙️ 桌面组件设置
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                padding: '4px 8px',
                fontSize: '14px',
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
              title="关闭设置面板"
            >
              ✕
            </button>
          </div>

          {/* 透明度设置 */}
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
            🎨 透明度设置
          </h4>
          
          {/* 整体窗口透明度 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              窗口整体透明度: {Math.round(windowOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={windowOpacity}
              onChange={(e) => setWindowOpacity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 日历背景透明度 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              📅 日历背景透明度: {Math.round(backgroundOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={backgroundOpacity}
              onChange={(e) => setBackgroundOpacity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 日历内容透明度 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              📝 日历内容透明度: {Math.round(contentOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={contentOpacity}
              onChange={(e) => setContentOpacity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 背景色设置 */}
          <h4 style={{ margin: '16px 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
            🌈 背景色设置
          </h4>

          {/* 窗口背景色 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              窗口背景色
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={windowBgColor}
                onChange={(e) => setWindowBgColor(e.target.value)}
                style={{
                  width: '40px',
                  height: '32px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={windowBgColor}
                onChange={(e) => setWindowBgColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* 日历背景色 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              📅 日历背景色
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={calendarBgColor}
                onChange={(e) => setCalendarBgColor(e.target.value)}
                style={{
                  width: '40px',
                  height: '32px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={calendarBgColor}
                onChange={(e) => setCalendarBgColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 8px',
                  fontSize: '12px',
                  border: '1px solid #dee2e6',
                  borderRadius: '4px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
          </div>

          {/* 重置按钮 */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
            <button
              onClick={() => {
                setWindowOpacity(0.95);
                setBackgroundOpacity(0.8);
                setContentOpacity(1.0);
                setWindowBgColor('#ffffff');
                setCalendarBgColor('#ffffff');
              }}
              style={{
                flex: 1,
                padding: '8px',
                fontSize: '12px',
                backgroundColor: '#f8f9fa',
                color: '#495057',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '500'
              }}
            >
              🔄 重置设置
            </button>
          </div>
        </div>
      )}
      
      {/* TimeCalendar 主体区域 */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          position: 'relative'
        }}
        onMouseEnter={() => setShowControls(false)}
      >
        <TimeCalendar
          onStartTimer={onStartTimer}
          microsoftService={microsoftService}
          syncManager={syncManager}
          lastSyncTime={lastSyncTime}
          availableTags={availableTags}
        />
      </div>
      
      {/* 调整大小手柄 */}
      {!isLocked && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '20px',
            height: '20px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, rgba(102, 126, 234, 0.5) 50%)',
            borderRadius: '0 0 12px 0'
          }}
        />
      )}
      
      {/* 锁定遮罩层 */}
      {isLocked && (
        <div
          style={{
            position: 'absolute',
            top: 40,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            cursor: 'not-allowed',
            zIndex: 998
          }}
          onDoubleClick={toggleLock}
          title="双击解锁"
        />
      )}
    </div>
  );
};

export default DesktopCalendarWidget;