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

  // 🎯 鼠标移动监听：只在顶部 10px 范围内显示控制栏，并维持至少 5 秒
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const isNearTop = e.clientY <= 10;
      
      if (isNearTop) {
        // 鼠标进入顶部区域，显示控制栏
        setShowControls(true);
        
        // 清除之前的定时器
        if (hideTimerRef.current) {
          clearTimeout(hideTimerRef.current);
        }
        
        // 设置新的 5 秒定时器
        hideTimerRef.current = setTimeout(() => {
          setShowControls(false);
        }, 5000);
      }
    };

    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, []);

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
    WebkitAppRegion: isLocked ? 'no-drag' : 'drag'
  };

  return (
    <div
      ref={widgetRef}
      className="desktop-calendar-widget"
      style={widgetStyle}
    >
      {/* 隐藏拖拽手柄 - 30px 高度，跟随日历透明度 */}
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
              backgroundColor: `rgba(0,0,0,${bgOpacity * 0.05})`,
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              color: `rgba(255,255,255,${bgOpacity * 0.6})`,
              userSelect: 'none',
              WebkitAppRegion: 'drag'
            } as CustomCSSProperties}
            onMouseEnter={(e) => { 
              (e.currentTarget as HTMLDivElement).style.backgroundColor = `rgba(0,0,0,${bgOpacity * 0.15})`; 
            }}
            onMouseLeave={(e) => { 
              (e.currentTarget as HTMLDivElement).style.backgroundColor = `rgba(0,0,0,${bgOpacity * 0.05})`; 
            }}
          >
            ⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮
          </div>
        )}

      {/* 控制栏 - 悬浮时显示（简化版，功能已移至日历设置菜单） */}
      {showControls && (
        <div style={controlBarStyle}>
          {/* 左侧：标题 */}
          <div style={{ 
            color: 'white', 
            fontSize: '14px', 
            fontWeight: 600, 
            display: 'flex', 
            alignItems: 'center', 
            gap: '8px', 
            flex: 1, 
            userSelect: 'none' 
          }}>
            📅 桌面日历 {!isLocked && <span style={{ fontSize: '11px', opacity: 0.7 }}>(拖拽此处移动)</span>}
          </div>

          {/* 提示：使用日历设置菜单 */}
          <div style={{ 
            fontSize: '11px', 
            color: 'rgba(255,255,255,0.8)', 
            marginRight: '12px' 
          }}>
            💡 点击日历内的⚙️设置按钮调整透明度和锁定
          </div>
        </div>
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
