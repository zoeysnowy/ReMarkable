/**
 * Desktop Calendar Widget - 基于TimeCalendar的桌面日历悬浮组件
 * 
 * 完全基于TimeCalendar组件，提供完整的日历功能和同步能力
 * 包括：事件显示、标签筛选、日历分组筛选、透明度调节等
 * 
 * @author Zoey Gong
 * @version 3.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimeCalendar from './TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import './DesktopCalendarWidget.css';

interface DesktopCalendarWidgetProps {
  microsoftService?: MicrosoftCalendarService;
  className?: string;
  style?: React.CSSProperties;
}

const DesktopCalendarWidget: React.FC<DesktopCalendarWidgetProps> = ({
  microsoftService,
  className = '',
  style = {}
}) => {
  // 🎯 桌面小部件基础状态
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // 🎨 样式控制状态
  const [opacity, setOpacity] = useState(0.95);
  const [bgOpacity, setBgOpacity] = useState(0.8);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showSettings, setShowSettings] = useState(false);
  
  // 📏 拖拽和调整大小的引用
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 💾 持久化位置和设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('desktop-calendar-widget-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setPosition(settings.position || { x: 100, y: 100 });
        setSize(settings.size || { width: 900, height: 700 });
        setOpacity(settings.opacity || 0.95);
        setBgOpacity(settings.bgOpacity || 0.8);
        setBgColor(settings.bgColor || '#ffffff');
        setIsLocked(settings.isLocked || false);
      } catch (error) {
        console.error('❌ Failed to load widget settings:', error);
      }
    }
  }, []);

  // 💾 保存设置到localStorage
  const saveSettings = useCallback(() => {
    const settings = {
      position,
      size,
      opacity,
      bgOpacity,
      bgColor,
      isLocked
    };
    localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
  }, [position, size, opacity, bgOpacity, bgColor, isLocked]);

  // 保存设置（防抖）
  useEffect(() => {
    const timer = setTimeout(saveSettings, 500);
    return () => clearTimeout(timer);
  }, [saveSettings]);

  // 🖱️ 拖拽处理
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isLocked || isResizing) return;
    
    setIsDragging(true);
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  }, [isLocked, isResizing]);

  // 🖱️ 拖拽移动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging && !isLocked) {
        setPosition({
          x: e.clientX - dragOffsetRef.current.x,
          y: e.clientY - dragOffsetRef.current.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isLocked]);

  // 📏 调整大小处理
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    };
  }, [isLocked, size]);

  // 📏 调整大小移动
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isResizing && !isLocked) {
        const deltaX = e.clientX - resizeStartRef.current.x;
        const deltaY = e.clientY - resizeStartRef.current.y;
        
        setSize({
          width: Math.max(400, resizeStartRef.current.width + deltaX),
          height: Math.max(300, resizeStartRef.current.height + deltaY)
        });
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, isLocked]);

  // 🎨 动态样式生成
  const widgetStyle: React.CSSProperties = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    width: size.width,
    height: size.height,
    zIndex: 9999,
    opacity: opacity,
    borderRadius: '12px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    border: '1px solid rgba(255,255,255,0.3)',
    cursor: isDragging ? 'grabbing' : isLocked ? 'default' : 'grab',
    userSelect: 'none',
    backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
    backdropFilter: bgOpacity < 1 ? 'blur(15px)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: isDragging || isResizing ? 'none' : 'all 0.3s ease',
    transform: showControls ? 'scale(1.02)' : 'scale(1)',
  };

  // 🎛️ 控制栏样式
  const controlBarStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(30,30,30,0.8))',
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: '12px 12px 0 0',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.1)'
  };

  return (
    <div
      ref={widgetRef}
      style={widgetStyle}
      className={`desktop-calendar-widget ${className}`}
      onMouseDown={handleDragStart}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 🎛️ 控制栏 - 悬浮时显示 */}
      {showControls && (
        <div
          style={controlBarStyle}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 左侧：标题 */}
          <div style={{
            color: 'white',
            fontSize: '14px',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            📅 桌面日历
          </div>

          {/* 右侧：功能按钮 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {/* 设置面板切换 */}
            <button
              onClick={() => setShowSettings(!showSettings)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: showSettings ? 'rgba(155,89,182,1)' : 'rgba(155,89,182,0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="设置"
            >
              ⚙️ 设置
            </button>

            {/* 锁定切换 */}
            <button
              onClick={() => setIsLocked(!isLocked)}
              style={{
                padding: '6px 12px',
                fontSize: '12px',
                backgroundColor: isLocked ? 'rgba(231,76,60,1)' : 'rgba(46,204,113,0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title={isLocked ? '解锁拖拽' : '锁定位置'}
            >
              {isLocked ? '🔒 已锁定' : '🔓 可拖拽'}
            </button>
          </div>
        </div>
      )}

      {/* ⚙️ 设置面板 */}
      {showControls && showSettings && (
        <div
          style={{
            position: 'absolute',
            top: '60px',
            right: '16px',
            width: '320px',
            maxHeight: 'calc(100% - 80px)',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,249,250,0.95))',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '12px',
            padding: '16px',
            zIndex: 20,
            backdropFilter: 'blur(20px)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
            overflowY: 'auto',
            fontSize: '13px'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>
            🎨 外观设置
          </h4>
          
          {/* 整体透明度 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              整体透明度: {Math.round(opacity * 100)}%
            </label>
            <input
              type="range"
              min="0.3"
              max="1"
              step="0.05"
              value={opacity}
              onChange={(e) => setOpacity(parseFloat(e.target.value))}
              style={{
                width: '100%',
                height: '6px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, #3498db, #2ecc71)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 背景透明度 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: '500' }}>
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
                height: '6px',
                borderRadius: '3px',
                background: 'linear-gradient(90deg, transparent, white)',
                outline: 'none',
                cursor: 'pointer'
              }}
            />
          </div>

          {/* 背景颜色 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: '500' }}>
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
                  borderRadius: '6px',
                  border: '2px solid #ddd',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  borderRadius: '6px',
                  border: '2px solid #ddd',
                  fontSize: '12px'
                }}
              />
            </div>
          </div>

          {/* 大小信息 */}
          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(52,152,219,0.1)', borderRadius: '8px' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#2980b9' }}>📏 窗口信息</h5>
            <div style={{ fontSize: '12px', color: '#6c757d', lineHeight: '1.4' }}>
              <div>尺寸: {size.width} × {size.height}px</div>
              <div>位置: ({position.x}, {position.y})</div>
              <div style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>
                拖拽右下角可调整大小
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📅 主要日历内容区域 */}
      <div style={{
        flex: 1,
        marginTop: showControls ? '60px' : '0',
        transition: 'margin-top 0.3s ease',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* TimeCalendar 组件 - 完整功能 */}
        <TimeCalendar
          onStartTimer={(taskTitle: string) => {
            console.log('📝 Timer started for task:', taskTitle);
            // 可以在这里添加任务计时器逻辑
          }}
          microsoftService={microsoftService}
          className="desktop-calendar-inner"
          style={{
            height: '100%',
            border: 'none',
            borderRadius: '0 0 12px 12px',
            background: 'transparent'
          }}
        />
      </div>

      {/* 📏 调整大小手柄 */}
      {!isLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '20px',
            height: '20px',
            cursor: 'nw-resize',
            background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 70%)',
            borderRadius: '0 0 12px 0',
            zIndex: 15
          }}
          onMouseDown={handleResizeStart}
        >
          <div style={{
            position: 'absolute',
            bottom: '4px',
            right: '4px',
            width: '0',
            height: '0',
            borderLeft: '8px solid transparent',
            borderBottom: '8px solid rgba(255,255,255,0.6)'
          }} />
        </div>
      )}
    </div>
  );
};

export default DesktopCalendarWidget;