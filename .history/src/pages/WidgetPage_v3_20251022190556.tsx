/**
 * WidgetPage_v3 - Electron 桌面窗口页面（全屏模式）
 * 完全复刻 DesktopCalendarWidgetV3 的样式和透明度逻辑
 * 但布局适配 Electron 全屏窗口（不使用 position: fixed）
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import TimeCalendar from '../components/TimeCalendar';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import '../components/DesktopCalendarWidget.css'; // 导入桌面日历 CSS

// 包装 TimeCalendar，只在必要的 props 变化时重渲染
const MemoizedTimeCalendar = memo(TimeCalendar, (prevProps, nextProps) => {
  // 只有这些 props 变化时才重渲染
  return (
    prevProps.calendarBackgroundColor === nextProps.calendarBackgroundColor &&
    prevProps.calendarOpacity === nextProps.calendarOpacity &&
    prevProps.widgetLocked === nextProps.widgetLocked &&
    prevProps.microsoftService === nextProps.microsoftService
  );
});

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
  const resizeThrottleRef = useRef<number>(0); // 节流用的时间戳
  
  // 拖动状态 - 恢复自定义拖动实现
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragThrottleRef = useRef<number>(0);
  
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
        const locked = settings.isLocked || false;
        setIsLocked(locked);
        console.log('🔒 Widget locked status:', locked);
        
        // 同步锁定状态到 Electron 主进程
        if (window.electronAPI?.widgetLock) {
          window.electronAPI.widgetLock(locked).then(() => {
            console.log('✅ Lock state synced to main process:', locked);
          }).catch((error: Error) => {
            console.error('❌ Failed to sync lock state:', error);
          });
        }
      } catch (e) {
        console.error('Failed to parse widget settings', e);
      }
    } else {
      console.log('🔓 No saved settings, widget is unlocked');
      // 确保主进程也是解锁状态
      if (window.electronAPI?.widgetLock) {
        window.electronAPI.widgetLock(false).then(() => {
          console.log('✅ Main process unlocked');
        });
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
    console.log('🎨 [Renderer] WidgetPage_v3 mounted');
    console.log('🔍 [Renderer] Checking drag bar element...');
    
    document.body.classList.add('widget-mode');
    document.body.style.backgroundColor = 'transparent';
    document.body.style.overflow = 'hidden';
    document.body.style.margin = '0';
    document.body.style.padding = '0';
    
    // 检查拖动条元素
    setTimeout(() => {
      const dragBar = document.querySelector('.drag-bar') as HTMLElement;
      if (dragBar) {
        const computedStyle = window.getComputedStyle(dragBar);
        console.log('✅ [Renderer] Drag bar found:', {
          element: dragBar,
          webkitAppRegion: (dragBar.style as any).WebkitAppRegion || computedStyle.getPropertyValue('-webkit-app-region'),
          pointerEvents: computedStyle.pointerEvents,
          cursor: computedStyle.cursor,
          position: computedStyle.position,
          zIndex: computedStyle.zIndex,
          width: computedStyle.width,
          height: computedStyle.height
        });
      } else {
        console.error('❌ [Renderer] Drag bar NOT found!');
      }
    }, 500);
    
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
    if (!isResizing || !resizeStartRef.current) return; // 移除 isDragging 检查，因为不再使用自定义拖动
    
    console.log('🔧 [Renderer] handleResizeMove 被调用');
    
    // 节流：每 16ms (约60fps) 最多执行一次
    const now = Date.now();
    if (now - resizeThrottleRef.current < 16) return;
    resizeThrottleRef.current = now;
    
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
    
    console.log(`🔧 [Renderer] 调用 widgetResize: ${Math.round(newWidth)}x${Math.round(newHeight)}`);
    
    // 调用Electron API调整窗口大小
    if (window.electronAPI?.widgetResize) {
      window.electronAPI.widgetResize({ width: Math.round(newWidth), height: Math.round(newHeight) });
    }
  }, [isResizing]); // 移除 isDragging 依赖

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

  // 拖动处理 - 简化版，依赖主进程的尺寸恢复机制
  // ===== 拖动相关逻辑 - 自定义拖动实现 =====
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isLocked || isResizing) {
      console.log('🚫 [Renderer] 拖动被阻止:', { isLocked, isResizing });
      return;
    }
    
    e.preventDefault();
    e.stopPropagation();
    
    console.log('🎬 [Renderer] 开始拖动:', { screenX: e.screenX, screenY: e.screenY });
    setIsDragging(true);
    dragStartRef.current = {
      x: e.screenX,
      y: e.screenY
    };
  }, [isLocked, isResizing]);

  const handleDragMove = useCallback(async (e: MouseEvent) => {
    if (!isDragging || !dragStartRef.current || isResizing) {
      return;
    }
    
    const now = Date.now();
    if (now - dragThrottleRef.current < 32) return; // 节流：每32ms最多一次
    dragThrottleRef.current = now;
    
    e.preventDefault();
    e.stopPropagation();
    
    const deltaX = e.screenX - dragStartRef.current.x;
    const deltaY = e.screenY - dragStartRef.current.y;
    
    console.log('🚚 [Renderer] 拖动中:', { 
      deltaX, 
      deltaY,
      screenX: e.screenX,
      screenY: e.screenY,
      startX: dragStartRef.current.x,
      startY: dragStartRef.current.y
    });
    
    if (Math.abs(deltaX) > 0 || Math.abs(deltaY) > 0) {
      if (window.electronAPI?.widgetMove) {
        try {
          console.log('📡 [Renderer] 调用 widgetMove:', { x: deltaX, y: deltaY });
          const result = await window.electronAPI.widgetMove({ x: deltaX, y: deltaY });
          console.log('✅ [Renderer] widgetMove 返回:', result);
          
          if (result.success) {
            dragStartRef.current = {
              x: e.screenX,
              y: e.screenY
            };
          }
        } catch (error) {
          console.error('❌ [Renderer] widgetMove 失败:', error);
        }
      } else {
        console.error('❌ [Renderer] widgetMove API 不存在');
      }
    }
  }, [isDragging, isResizing]);

  const handleDragEnd = useCallback(() => {
    console.log('🏁 [Renderer] 拖动结束');
    setIsDragging(false);
    dragStartRef.current = null;
  }, []);

  // 监听拖动
  useEffect(() => {
    if (isDragging) {
      console.log('👂 [Renderer] 开始监听 mousemove 和 mouseup');
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      return () => {
        console.log('🔇 [Renderer] 停止监听 mousemove 和 mouseup');
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
  const widgetStyle: CustomCSSProperties = {
    width: '100vw',
    height: '100vh',
    backgroundColor: 'transparent', // 容器透明，让 Electron 窗口背景透过
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    cursor: 'default',
    userSelect: 'none',
    transition: 'opacity 0.2s ease', // 只保留透明度过渡，移除缩放动画
    WebkitAppRegion: 'no-drag' // 默认不可拖动，只有拖动条可以拖动
  };

  return (
    <div
      ref={widgetRef}
      className="desktop-calendar-widget"
      style={widgetStyle}
    >
      {/* 调整大小时的全屏遮罩层 */}
      {isResizing && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          cursor: 'default',
          pointerEvents: 'none' // 不阻止鼠标事件传播
        }} />
      )}
      
      {/* 不需要拖动遮罩层 - window 级别的监听器足够了 */}

      {/* 顶部拖动条 - 自定义拖动实现 */}
      {!isLocked && (
        <div
          className="drag-bar"
          data-testid="widget-drag-bar"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '10px',
            zIndex: 10000,
            cursor: isDragging ? 'grabbing' : 'grab',
            backgroundColor: showControls ? 'rgba(100, 150, 255, 0.5)' : 'rgba(100, 150, 255, 0.25)',
            backdropFilter: showControls ? 'blur(8px)' : 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            userSelect: 'none',
            transition: 'all 0.15s ease',
            boxShadow: showControls ? '0 2px 8px rgba(100, 150, 255, 0.3)' : 'none',
            pointerEvents: 'auto'
          }}
          onMouseEnter={() => {
            console.log('🖱️ [Renderer] 鼠标进入拖动条');
            setShowControls(true);
          }}
          onMouseLeave={() => {
            console.log('🖱️ [Renderer] 鼠标离开拖动条');
            setShowControls(false);
          }}
          onMouseDown={handleDragStart}
        >
          {/* 拖动条提示文字 */}
          <span style={{
            fontSize: '9px',
            fontWeight: 600,
            color: 'rgba(255, 255, 255, 0.95)',
            letterSpacing: '1.5px',
            textShadow: '0 1px 3px rgba(0,0,0,0.5)',
            pointerEvents: 'none',
            opacity: showControls ? 1 : 0.6,
            transition: 'opacity 0.15s ease'
          }}
          >
            ⋮⋮⋮
          </span>
        </div>
      )}

      {/* 调整大小手柄 - 只保留底部和侧边 */}
      {!isLocked && !isDragging && (
        <>
          <div className="resize-handle-bottom" onMouseDown={(e) => handleResizeStart('bottom', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-left" onMouseDown={(e) => handleResizeStart('left', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
          <div className="resize-handle-right" onMouseDown={(e) => handleResizeStart('right', e)} onMouseEnter={handleResizeHover} onMouseLeave={handleResizeLeave} />
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
        <MemoizedTimeCalendar
          onStartTimer={useCallback((taskTitle: string) => { 
            console.log('📝 Timer started:', taskTitle); 
          }, [])}
          microsoftService={microsoftService}
          isWidgetMode={true}
          className="desktop-calendar-inner"
          style={useMemo(() => ({ 
            height: '100%', 
            border: 'none', 
            borderRadius: '0 0 12px 12px', 
            background: 'transparent', // 最外层透明
          }), [])}
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
