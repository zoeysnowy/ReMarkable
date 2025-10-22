/**
 * Desktop Calendar Widget - 桌面日历悬浮组件
 * 
 * 支持透明度、大小调整、拖曳和锁定功能
 * 可作为桌面小部件使用
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import ToastUIReactCalendar from './ToastUIReactCalendar';
import type { EventObject } from '@toast-ui/calendar';
import '@toast-ui/calendar/dist/toastui-calendar.css';
import '../styles/calendar.css';
import '../styles/widget.css'; // 悬浮窗口专用样式
import { Event } from '../types';

interface DesktopCalendarWidgetProps {
  events: Event[];
  tags: any[];
  onEventClick?: (event: Event) => void;
  onEventUpdate?: (event: Event) => void;
}

const DesktopCalendarWidget: React.FC<DesktopCalendarWidgetProps> = ({
  events,
  tags,
  onEventClick,
  onEventUpdate
}) => {
  // 窗口控制状态
  const [isLocked, setIsLocked] = useState(false);
  const [opacity, setOpacity] = useState(0.95);
  const [isResizing, setIsResizing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // 窗口尺寸和位置
  const [windowSize, setWindowSize] = useState({ width: 600, height: 700 });
  const [windowPosition, setWindowPosition] = useState({ x: 100, y: 100 });
  
  // 拖拽起始位置
  const dragStartRef = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });
  
  // 控制面板可见性
  const [showControls, setShowControls] = useState(true);
  
  // 当前视图和日期
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>('week');
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  
  // 背景色和透明度
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0.95);
  
  // 日历内容背景透明度（这是你想调整的）
  const [calendarBgOpacity, setCalendarBgOpacity] = useState(1.0);
  const [calendarBgColor, setCalendarBgColor] = useState('#ffffff');

  // 与Electron通信
  useEffect(() => {
    if (window.electronAPI) {
      // 监听来自主进程的事件
      window.electronAPI.on('widget-opacity-change', (newOpacity: number) => {
        setOpacity(newOpacity);
      });
      
      window.electronAPI.on('widget-lock-toggle', (locked: boolean) => {
        setIsLocked(locked);
      });
    }
  }, []);

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

  const handleDragMove = (e: MouseEvent) => {
    if (!isDragging || isLocked) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const newX = dragStartRef.current.windowX + deltaX;
    const newY = dragStartRef.current.windowY + deltaY;
    
    setWindowPosition({ x: newX, y: newY });
    
    // 通知Electron移动窗口
    if (window.electronAPI) {
      window.electronAPI.widgetMove({ x: newX, y: newY });
    }
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 调整大小处理
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: windowSize.width,
      height: windowSize.height
    };
  };

  const handleResizeMove = (e: MouseEvent) => {
    if (!isResizing || isLocked) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    const newWidth = Math.max(400, resizeStartRef.current.width + deltaX);
    const newHeight = Math.max(500, resizeStartRef.current.height + deltaY);
    
    setWindowSize({ width: newWidth, height: newHeight });
    
    // 通知Electron调整窗口大小
    if (window.electronAPI) {
      window.electronAPI.widgetResize({ width: newWidth, height: newHeight });
    }
  };

  const handleResizeEnd = () => {
    setIsResizing(false);
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
  }, [isDragging]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing]);

  // 切换锁定状态
  const toggleLock = () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    
    if (window.electronAPI) {
      window.electronAPI.widgetLock(newLockState);
    }
  };

  // 调整透明度
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);
    
    if (window.electronAPI) {
      window.electronAPI.widgetOpacity(newOpacity);
    }
  };

  // 转换事件为TUI Calendar格式
  const calendarEvents: EventObject[] = events.map(event => ({
    id: event.id,
    calendarId: event.tags?.[0] || event.tagId || event.calendarId || 'default',
    title: event.title,
    category: event.isAllDay ? 'allday' : 'time',
    start: new Date(event.startTime),
    end: new Date(event.endTime),
    isAllday: event.isAllDay,
    backgroundColor: event.tags?.[0] ? '#8f479b7f' : '#3788d87f',
    borderColor: event.tags?.[0] ? '#8f479b' : '#3788d8',
    color: '#ffffff'
  }));

  return (
    <div 
      className="desktop-calendar-widget"
      style={{
        width: '100%',
        height: '100vh',
        backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
        backdropFilter: bgOpacity < 1 ? 'blur(10px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
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
          opacity: showControls ? 1 : 0.3
        }}
      >
        {/* 左侧：可拖动区域 */}
        <div 
          onMouseDown={handleDragStart}
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '12px',
            cursor: isLocked ? 'default' : 'move',
            flex: 1,
            paddingRight: '12px'
          }}
        >
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 'bold' }}>
            📅 日历桌面小部件
          </span>
          
          {/* 视图切换 */}
          <div 
            style={{ display: 'flex', gap: '4px' }}
            onMouseDown={(e) => e.stopPropagation()} // 阻止拖动
          >
            {(['month', 'week', 'day'] as const).map(view => (
              <button
                key={view}
                onClick={() => setCurrentView(view)}
                style={{
                  padding: '2px 8px',
                  fontSize: '11px',
                  backgroundColor: currentView === view ? 'rgba(255,255,255,0.3)' : 'transparent',
                  color: 'white',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '3px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                {view === 'month' ? '月' : view === 'week' ? '周' : '日'}
              </button>
            ))}
          </div>
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
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="日历设置"
          >
            ⚙️
          </button>

          {/* 新建事件按钮 */}
          <button
            onClick={() => {/* TODO: 打开新建事件对话框 */}}
            style={{
              padding: '4px 10px',
              fontSize: '14px',
              backgroundColor: 'rgba(34, 197, 94, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontWeight: 'bold'
            }}
            title="新建事件"
          >
            ➕
          </button>
          
          {/* 透明度控制 - 移除，改为在设置面板中 */}
          
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
            title={isLocked ? '点击解锁' : '点击锁定'}
          >
            {isLocked ? '🔒 已锁定' : '🔓 未锁定'}
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
            ─
          </button>
          
          {/* 关闭按钮 */}
          <button
            onClick={() => window.electronAPI?.widgetClose()}
            style={{
              padding: '4px 8px',
              fontSize: '12px',
              backgroundColor: 'rgba(239, 68, 68, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
            title="关闭小部件"
          >
            ✕
          </button>
        </div>
      </div>
      
      {/* 设置面板 - 悬浮在右上角 */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            top: '50px',
            right: '16px',
            width: '280px',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            padding: '16px',
            border: '1px solid #e9ecef'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
            🎨 背景设置
          </h4>
          
          {/* 背景颜色 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              背景颜色
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
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
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
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

          {/* 背景透明度 */}
          <div style={{ marginBottom: '12px' }}>
            <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
              背景透明度: {Math.round(bgOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={bgOpacity}
              onChange={(e) => setBgOpacity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 预览 */}
          <div
            style={{
              marginTop: '12px',
              padding: '12px',
              borderRadius: '4px',
              backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
              border: '1px solid #dee2e6',
              textAlign: 'center',
              fontSize: '11px',
              color: '#495057'
            }}
          >
            预览效果
          </div>
        </div>
      )}
      
      {/* 日历主体区域 */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: `${calendarBgColor}${Math.round(calendarBgOpacity * 255).toString(16).padStart(2, '0')}`,
          borderRadius: '0 0 8px 8px'
        }}
        onMouseEnter={() => setShowControls(false)}
      >
        <ToastUIReactCalendar
          events={calendarEvents}
          view={currentView}
          onClickEvent={(eventInfo: any) => {
            const event = events.find(e => e.id === eventInfo.id);
            if (event && onEventClick) {
              onEventClick(event);
            }
          }}
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
            borderRadius: '0 0 4px 0'
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
            zIndex: 999
          }}
          onDoubleClick={toggleLock}
          title="双击解锁"
        />
      )}
    </div>
  );
};

export default DesktopCalendarWidget;
