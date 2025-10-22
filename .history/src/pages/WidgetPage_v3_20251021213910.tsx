/**
 * WidgetPage_v3 - 直接复刻 DesktopCalendarWidgetV3 为桌面窗口页面
 * 目的：提供完全相同的 UX/样式/透明度行为，便于在 Electron 窗口中替换测试
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimeCalendar from '../components/TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';

interface CustomCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const WidgetPage_v3: React.FC = () => {
  // 基础状态
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 900, height: 700 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);

  // 样式控制
  const [opacity, setOpacity] = useState(0.95);
  const [bgOpacity, setBgOpacity] = useState(0.0);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showSettings, setShowSettings] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 从 localStorage 读取
  useEffect(() => {
    const savedSettings = localStorage.getItem('desktop-calendar-widget-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setPosition(settings.position || { x: 100, y: 100 });
        setSize(settings.size || { width: 900, height: 700 });
        setOpacity(settings.opacity || 0.95);
        setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.0);
        setBgColor(settings.bgColor || '#ffffff');
        setIsLocked(settings.isLocked || false);
      } catch (e) {
        console.error('Failed to parse widget settings', e);
      }
    }
  }, []);

  // 保存设置（防抖）
  const saveSettings = useCallback(() => {
    const settings = { position, size, opacity, bgOpacity, bgColor, isLocked };
    localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
  }, [position, size, opacity, bgOpacity, bgColor, isLocked]);

  useEffect(() => {
    const t = setTimeout(saveSettings, 500);
    return () => clearTimeout(t);
  }, [saveSettings]);

  // 拖拽（仅用于页面预览；Electron 窗口通常使用 setMovable + -webkit-app-region）
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isLocked || isResizing) return;
    setIsDragging(true);
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }
  }, [isLocked, isResizing]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isDragging && !isLocked) {
        setPosition({ x: e.clientX - dragOffsetRef.current.x, y: e.clientY - dragOffsetRef.current.y });
      }
    };
    const onUp = () => setIsDragging(false);
    if (isDragging) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isDragging, isLocked]);

  // 调整大小
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    resizeStartRef.current = { x: e.clientX, y: e.clientY, width: size.width, height: size.height };
  }, [isLocked, size]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (isResizing && !isLocked) {
        const dx = e.clientX - resizeStartRef.current.x;
        const dy = e.clientY - resizeStartRef.current.y;
        setSize({ width: Math.max(400, resizeStartRef.current.width + dx), height: Math.max(300, resizeStartRef.current.height + dy) });
      }
    };
    const onUp = () => setIsResizing(false);
    if (isResizing) {
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    }
    return () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
  }, [isResizing, isLocked]);

  // color->rgba
  const bgColorRgba = (() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  })();

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
    cursor: 'default',
    userSelect: 'none',
    backgroundColor: bgColorRgba,
    backdropFilter: bgOpacity < 1 ? 'blur(15px)' : 'none',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    transition: isDragging || isResizing ? 'none' : 'all 0.3s ease',
    transform: showControls ? 'scale(1.02)' : 'scale(1)'
  };

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
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    cursor: isLocked ? 'default' : 'grab'
  };

  return (
    <div
      ref={widgetRef}
      style={{ ...widgetStyle }}
      className="desktop-calendar-widget"
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 隐藏拖拽手柄 */}
      {!showControls && !isLocked && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '30px',
            zIndex: 10,
            cursor: 'grab',
            backgroundColor: 'rgba(0,0,0,0.05)',
            transition: 'background-color 0.2s',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            color: 'rgba(255,255,255,0.6)',
            userSelect: 'none'
          }}
          onMouseDown={handleDragStart}
          onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0.15)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0.05)'; }}
        >
          ⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮
        </div>
      )}

      {/* 控制栏 */}
      {showControls && (
        <div
          style={{ ...controlBarStyle, cursor: isDragging ? 'grabbing' : (isLocked ? 'default' : 'grab') }}
          onMouseDown={handleDragStart}
        >
          <div style={{ color: 'white', fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px', flex: 1, userSelect: 'none' }} onMouseDown={handleDragStart}>
            📅 桌面日历 {!isLocked && <span style={{ fontSize: '11px', opacity: 0.7 }}>(拖拽此处移动)</span>}
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }} onMouseDown={(e) => e.stopPropagation()}>
            <button onClick={() => setShowSettings(!showSettings)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: showSettings ? 'rgba(155,89,182,1)' : 'rgba(155,89,182,0.8)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} title="设置">⚙️ 设置</button>
            <button onClick={() => setIsLocked(!isLocked)} style={{ padding: '6px 12px', fontSize: '12px', backgroundColor: isLocked ? 'rgba(231,76,60,1)' : 'rgba(46,204,113,0.8)', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: '4px' }} title={isLocked ? '解锁拖拽' : '锁定位置'}>{isLocked ? '🔒 已锁定' : '🔓 可拖拽'}</button>
          </div>
        </div>
      )}

      {/* 设置面板 */}
      {showControls && showSettings && (
        <div style={{ position: 'absolute', top: '60px', right: '16px', width: '320px', maxHeight: 'calc(100% - 80px)', background: 'linear-gradient(135deg, rgba(255,255,255,0.98), rgba(248,249,250,0.95))', border: '1px solid rgba(0,0,0,0.1)', borderRadius: '12px', padding: '16px', zIndex: 20, backdropFilter: 'blur(20px)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)', overflowY: 'auto', fontSize: '13px' }} onMouseDown={(e) => e.stopPropagation()}>
          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>🎨 外观设置</h4>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>整体透明度: {Math.round(opacity * 100)}%</label>
            <input type="range" min="0.3" max="1" step="0.05" value={opacity} onChange={(e) => setOpacity(parseFloat(e.target.value))} style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #3498db, #2ecc71)', outline: 'none', cursor: 'pointer' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>背景透明度: {Math.round(bgOpacity * 100)}%</label>
            <input type="range" min="0" max="1" step="0.05" value={bgOpacity} onChange={(e) => setBgOpacity(parseFloat(e.target.value))} style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, transparent, white)', outline: 'none', cursor: 'pointer' }} />
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>背景颜色</label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="color" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ width: '40px', height: '32px', borderRadius: '6px', border: '2px solid #ddd', cursor: 'pointer' }} />
              <input type="text" value={bgColor} onChange={(e) => setBgColor(e.target.value)} style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '2px solid #ddd', fontSize: '12px' }} />
            </div>
          </div>

          <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(52,152,219,0.1)', borderRadius: '8px' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#2980b9' }}>📏 窗口信息</h5>
            <div style={{ fontSize: '12px', color: '#6c757d', lineHeight: '1.4' }}>
              <div>尺寸: {size.width} × {size.height}px</div>
              <div>位置: ({position.x}, {position.y})</div>
              <div style={{ marginTop: '6px', fontSize: '11px', fontStyle: 'italic' }}>拖拽右下角可调整大小</div>
            </div>
          </div>
        </div>
      )}

      {/* 主要日历区域 */}
      <div style={{ flex: 1, marginTop: showControls ? '60px' : '0', transition: 'margin-top 0.3s ease', position: 'relative', overflow: 'hidden', pointerEvents: 'auto' }} onMouseDown={(e) => e.stopPropagation()}>
        <TimeCalendar
          onStartTimer={(taskTitle: string) => { console.log('Timer started:', taskTitle); }}
          microsoftService={new MicrosoftCalendarService()}
          isWidgetMode={true}
          className="widget-mode-calendar"
          style={{ height: '100%', border: 'none', borderRadius: '0 0 12px 12px', background: 'transparent' }}
        />
      </div>

      {/* 调整大小手柄 */}
      {!isLocked && (
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', cursor: 'nw-resize', background: 'linear-gradient(135deg, transparent 30%, rgba(255,255,255,0.3) 70%)', borderRadius: '0 0 12px 0', zIndex: 15 }} onMouseDown={handleResizeStart}>
          <div style={{ position: 'absolute', bottom: '4px', right: '4px', width: 0, height: 0, borderLeft: '8px solid transparent', borderBottom: '8px solid rgba(255,255,255,0.6)' }} />
        </div>
      )}
    </div>
  );
};

export default WidgetPage_v3;
