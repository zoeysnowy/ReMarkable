/**
 * WidgetPage_v3 - Electron 桌面窗口页面（全屏模式）
 * 完全复刻 DesktopCalendarWidgetV3 的样式和透明度逻辑
 * 但布局适配 Electron 全屏窗口（不使用 position: fixed）
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import TimeCalendar from '../components/TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import '../components/DesktopCalendarWidget.css'; // 导入桌面日历 CSS

interface CustomCSSProperties extends React.CSSProperties {
  WebkitAppRegion?: 'drag' | 'no-drag';
}

const WidgetPage_v3: React.FC = () => {
  const [microsoftService] = useState(() => new MicrosoftCalendarService());
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null); // 定时器引用

  // 样式控制 - 简化版：只控制日历背景
  const [bgOpacity, setBgOpacity] = useState(0.95); // 日历背景透明度，默认 95%
  const [bgColor, setBgColor] = useState('#ffffff'); // 日历背景颜色，默认白色

  const widgetRef = useRef<HTMLDivElement>(null);
  
  // 调整大小状态
  const [isResizing, setIsResizing] = useState(false);
  const resizeStartRef = useRef<{ x: number; y: number; width: number; height: number; edge: string } | null>(null);
  
  // 拖动状态
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  
  // 调整大小光标悬停状态（保持3秒）
  const [isResizeHovering, setIsResizeHovering] = useState(false);
  const resizeHoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 从 localStorage 读取设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('desktop-calendar-widget-settings');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.95);
        setBgColor(settings.bgColor || '#ffffff');
        setIsLocked(settings.isLocked || false);
      } catch (e) {
        console.error('Failed to parse widget settings', e);
      }
    }
  }, []);

  // 保存设置（防抖）
  useEffect(() => {
    const t = setTimeout(() => {
      const settings = { bgOpacity, bgColor, isLocked };
      localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
    }, 500);
    return () => clearTimeout(t);
  }, [bgOpacity, bgColor, isLocked]);

  // 初始化 widget-mode 样式
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

  // 移除控制栏自动显示逻辑，不再需要
  // useEffect(() => {
  //   const handleMouseMove = (e: MouseEvent) => {
  //     const isNearTop = e.clientY <= 10;
  //     if (isNearTop) {
  //       setShowControls(true);
  //       if (hideTimerRef.current) {
  //         clearTimeout(hideTimerRef.current);
  //       }
  //       hideTimerRef.current = setTimeout(() => {
  //         setShowControls(false);
  //       }, 5000);
  //     }
  //   };
  //   window.addEventListener('mousemove', handleMouseMove);
  //   return () => {
  //     window.removeEventListener('mousemove', handleMouseMove);
  //     if (hideTimerRef.current) {
  //       clearTimeout(hideTimerRef.current);
  //     }
  //   };
  // }, []);

  // 动态注入 CSS 控制日历内部元素透明度
  // 移除错误的动态CSS注入逻辑
  // calendar.css 中的静态样式已经足够，不需要动态覆盖
  // bgOpacity 只应该影响 TimeCalendar 的 backgroundColor，不应该影响内部元素

  // 锁定切换（调用 Electron API） - 使用 useCallback 优化
  const handleLockToggle = useCallback(async (newLockState?: boolean) => {
    const targetState = newLockState !== undefined ? newLockState : !isLocked;
    console.log('🔄 handleLockToggle called:', { current: isLocked, target: targetState });
    
    setIsLocked(targetState);
    
    if (window.electronAPI?.widgetLock) {
      try {
        const result = await window.electronAPI.widgetLock(targetState);
        console.log('✅ Widget lock state changed:', { locked: targetState, result });
      } catch (error) {
        console.error('❌ Failed to set widget lock:', error);
      }
    } else {
      console.warn('⚠️ electronAPI.widgetLock not available');
    }
  }, [isLocked]);

  // 调整大小处理
  const handleResizeStart = useCallback((edge: string, e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    const bounds = widgetRef.current?.getBoundingClientRect();
    if (bounds) {
      resizeStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        width: bounds.width,
        height: bounds.height,
        edge
      };
    }
  }, [isLocked]);

  // 调整大小手柄悬停处理（保持3秒）
  const handleResizeHover = useCallback(() => {
    setIsResizeHovering(true);
    
    // 清除之前的计时器
    if (resizeHoverTimerRef.current) {
      clearTimeout(resizeHoverTimerRef.current);
    }
    
    // 3秒后隐藏
    resizeHoverTimerRef.current = setTimeout(() => {
      setIsResizeHovering(false);
    }, 3000);
  }, []);

  const handleResizeLeave = useCallback(() => {
    // 不立即隐藏，等待计时器
  }, []);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeStartRef.current) return;
    
    const { x, y, width, height, edge } = resizeStartRef.current;
    const deltaX = e.clientX - x;
    const deltaY = e.clientY - y;
    
    let newWidth = width;
    let newHeight = height;
    
    if (edge.includes('right')) newWidth = width + deltaX;
    if (edge.includes('left')) newWidth = width - deltaX;
    if (edge.includes('bottom')) newHeight = height + deltaY;
    if (edge.includes('top')) newHeight = height - deltaY;
    
    // 最小尺寸限制
    newWidth = Math.max(400, newWidth);
    newHeight = Math.max(300, newHeight);
    
    // 调用Electron API调整窗口大小
    if (window.electronAPI?.widgetResize) {
      window.electronAPI.widgetResize({ width: Math.round(newWidth), height: Math.round(newHeight) });
    }
  }, [isResizing]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    resizeStartRef.current = null;
  }, []);

  // 监听鼠标移动和释放
  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
      return () => {
        window.removeEventListener('mousemove', handleResizeMove);
        window.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // 拖动处理
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isLocked) return;
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎯 拖动开始:', { screenX: e.screenX, screenY: e.screenY });
    setIsDragging(true);
    
    // 记录初始鼠标位置（屏幕坐标）
    dragStartRef.current = {
      x: e.screenX,
      y: e.screenY
    };
  }, [isLocked]);

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current) return;
    
    // 计算相对于上一帧的偏移
    const deltaX = e.screenX - dragStartRef.current.x;
    const deltaY = e.screenY - dragStartRef.current.y;
    
    // 只有在有实际移动时才调用IPC
    if (deltaX !== 0 || deltaY !== 0) {
      console.log('🎯 拖动中:', { deltaX, deltaY, screenX: e.screenX, screenY: e.screenY });
      
      if (window.electronAPI?.widgetMove) {
        window.electronAPI.widgetMove({ x: deltaX, y: deltaY });
      }
      
      // 更新起点为当前位置，用于下一帧计算
      dragStartRef.current = {
        x: e.screenX,
        y: e.screenY
      };
    }
  }, [isDragging]);

  const handleDragEnd = useCallback(() => {
    console.log('🎯 拖动结束');
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // 监听拖动
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        window.removeEventListener('mousemove', handleDragMove);
        window.removeEventListener('mouseup', handleDragEnd);
      };
    }
  }, [isDragging, handleDragMove, handleDragEnd]);

  // color->rgba
  const bgColorRgba = (() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  })();

  // 最外层容器样式 - 透明容器
  const widgetStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'transparent', // 容器透明，让 Electron 窗口背景透过
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'default',
    userSelect: 'none',
    transition: 'opacity 0.2s ease', // 只保留透明度过渡，移除缩放动画
  };

  // 控制栏样式 - 跟随日历透明度
  const controlBarStyle: CustomCSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    background: `linear-gradient(135deg, rgba(0,0,0,${bgOpacity * 0.9}), rgba(30,30,30,${bgOpacity * 0.8}))`,
    padding: '10px 16px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
    borderRadius: '12px 12px 0 0',
    backdropFilter: bgOpacity < 1 ? 'blur(20px)' : 'none',
    borderBottom: `1px solid rgba(255,255,255,${bgOpacity * 0.1})`,
    cursor: isLocked ? 'default' : 'grab',
    WebkitAppRegion: isLocked ? 'no-drag' : 'drag' // 只有锁定时才禁止拖动
  };

  return (
    <div
      ref={widgetRef}
      className="desktop-calendar-widget"
      style={widgetStyle}
    >
      {/* 顶部拖动条 - 10px高度，居中显示":: 拖动 ::" */}
      {!isLocked && (
        <div
          onMouseDown={handleDragStart}
          style={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '120px',
            height: '10px',
            zIndex: 10000, // 提高到最高层级，高于调整大小手柄
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: 'rgba(255, 255, 255, 0.15)',
            backdropFilter: 'blur(8px)',
            borderRadius: '0 0 6px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            transition: 'all 0.2s ease',
            pointerEvents: 'auto' // 确保可以接收鼠标事件
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.25)';
            e.currentTarget.style.height = '16px'; // 悬停时更高，更好点击
            e.currentTarget.style.paddingTop = '2px';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
            e.currentTarget.style.height = '10px';
            e.currentTarget.style.paddingTop = '0';
          }}
        >
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.9)',
            letterSpacing: '1px',
            textShadow: '0 1px 2px rgba(0,0,0,0.2)',
            pointerEvents: 'none' // 文字不接收事件，穿透到父div
          }}>
            :: 拖动 ::
          </span>
        </div>
      )}

      {/* 8个调整大小手柄 */}
      {!isLocked && (
        <>
          <div className="resize-handle-top" onMouseDown={(e) => handleResizeStart('top', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-bottom" onMouseDown={(e) => handleResizeStart('bottom', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-left" onMouseDown={(e) => handleResizeStart('left', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-right" onMouseDown={(e) => handleResizeStart('right', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-topleft" onMouseDown={(e) => handleResizeStart('topleft', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-topright" onMouseDown={(e) => handleResizeStart('topright', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-bottomleft" onMouseDown={(e) => handleResizeStart('bottomleft', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-bottomright" onMouseDown={(e) => handleResizeStart('bottomright', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
        </>
      )}

      {/* 主要日历内容区域 */}
      <div 
        style={{ 
          flex: 1, 
          marginTop: '0', // 固定位置，不再有垂直偏移
          position: 'relative', 
          overflow: 'hidden', 
          pointerEvents: 'auto',
          WebkitAppRegion: 'no-drag' // 确保日历区域内的交互不触发拖动
        } as CustomCSSProperties} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        <TimeCalendar
          onStartTimer={(taskTitle: string) => { 
            console.log('📝 Timer started:', taskTitle); 
          }}
          microsoftService={microsoftService}
          isWidgetMode={true}
          className="desktop-calendar-inner"
          style={{ 
            height: '100%', 
            border: 'none', 
            borderRadius: '0 0 12px 12px', 
            background: 'transparent', // 最外层透明
          }}
          // 传递透明度和颜色给内部三个矩形
          calendarBackgroundColor={bgColor}
          calendarOpacity={bgOpacity}
          // Widget 控制回调
          onWidgetOpacityChange={setBgOpacity}
          onWidgetColorChange={setBgColor}
          onWidgetLockToggle={handleLockToggle}
          widgetLocked={isLocked}
        />
      </div>
    </div>
  );
};

export default WidgetPage_v3;
