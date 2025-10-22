/**
 * WidgetPage_v3 - Electron 桌面窗口页面（全屏模式）
 * 完全复刻 DesktopCalendarWidgetV3 的样式和透明度逻辑
 * 但布局适配 Electron 全屏窗口（不使用 position: fixed）
 */

import React, { useState, useEffect, useRef } from 'react';
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

  // 样式控制 - 完全复刻测试页面的逻辑
  const [opacity, setOpacity] = useState(0.95);
  const [bgOpacity, setBgOpacity] = useState(0.0); // 默认完全透明
  const [bgColor, setBgColor] = useState('#ffffff');
  const [showSettings, setShowSettings] = useState(false);

  const widgetRef = useRef<HTMLDivElement>(null);

  // 从 localStorage 读取设置
  useEffect(() => {
    const savedSettings = localStorage.getItem('widget-settings-v3');
    if (savedSettings) {
      try {
        const settings = JSON.parse(savedSettings);
        setOpacity(settings.opacity !== undefined ? settings.opacity : 0.95);
        setBgOpacity(settings.bgOpacity !== undefined ? settings.bgOpacity : 0.0);
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
      const settings = { opacity, bgOpacity, bgColor, isLocked };
      localStorage.setItem('widget-settings-v3', JSON.stringify(settings));
    }, 500);
    return () => clearTimeout(t);
  }, [opacity, bgOpacity, bgColor, isLocked]);

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

  // 锁定切换（调用 Electron API）
  const handleLockToggle = async () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    
    if (window.electronAPI?.widgetLock) {
      try {
        await window.electronAPI.widgetLock(newLockState);
        console.log('✅ Widget lock state:', newLockState);
      } catch (error) {
        console.error('❌ Failed to set widget lock:', error);
      }
    }
  };

  // color->rgba
  const bgColorRgba = (() => {
    const hex = bgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${bgOpacity})`;
  })();

  // 🎨 多层透明度架构 - 完全复刻 DesktopCalendarWidgetV3
  // 外层：整体透明度容器 (opacity)
  const outerContainerStyle: React.CSSProperties = {
    width: '100vw',
    height: '100vh',
    opacity: opacity, // 【第一层】整体透明度
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    position: 'relative',
  };

  // 内层：背景层 (backgroundColor with alpha)
  const backgroundLayerStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: bgColorRgba, // 【第二层】背景透明度
    backdropFilter: bgOpacity < 1 ? 'blur(15px)' : 'none',
    zIndex: -1, // 置于底层
  };

  // 内容容器：完全透明，不影响子元素
  const contentContainerStyle: React.CSSProperties = {
    width: '100%',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: 'transparent', // 【第三层】内容透明
    position: 'relative',
    transition: 'all 0.3s ease',
    transform: showControls ? 'scale(1.01)' : 'scale(1)',
  };

  // 控制栏样式 - 完全复刻测试页面
  const controlBarStyle: CustomCSSProperties = {
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
    borderRadius: '8px 8px 0 0',
    backdropFilter: 'blur(20px)',
    borderBottom: '1px solid rgba(255,255,255,0.1)',
    cursor: isLocked ? 'default' : 'grab',
    WebkitAppRegion: isLocked ? 'no-drag' : 'drag'
  };

  return (
    <div
      ref={widgetRef}
      className="desktop-calendar-widget"
      style={outerContainerStyle}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 🎨 背景层 - 独立控制背景透明度 */}
      <div style={backgroundLayerStyle} />

      {/* 📦 内容容器 - 完全透明，不干扰子元素 */}
      <div style={contentContainerStyle}>
        {/* 隐藏拖拽手柄 - 30px 高度 */}
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
              userSelect: 'none',
              WebkitAppRegion: 'drag'
            } as CustomCSSProperties}
            onMouseEnter={(e) => { 
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0.15)'; 
            }}
            onMouseLeave={(e) => { 
              (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(0,0,0,0.05)'; 
            }}
          >
            ⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮
          </div>
        )}

      {/* 控制栏 - 悬浮时显示 */}
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

          {/* 右侧：功能按钮 */}
          <div 
            style={{ display: 'flex', gap: '8px', alignItems: 'center' }} 
            onMouseDown={(e) => e.stopPropagation()}
          >
            {/* 设置按钮 */}
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
                gap: '4px',
                WebkitAppRegion: 'no-drag'
              } as CustomCSSProperties} 
              title="设置"
            >
              ⚙️ 设置
            </button>
            
            {/* 锁定按钮 */}
            <button 
              onClick={handleLockToggle} 
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
                gap: '4px',
                WebkitAppRegion: 'no-drag'
              } as CustomCSSProperties} 
              title={isLocked ? '解锁拖拽' : '锁定位置'}
            >
              {isLocked ? '🔒 已锁定' : '🔓 可拖拽'}
            </button>
          </div>
        </div>
      )}

      {/* 设置面板 */}
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
            fontSize: '13px',
            WebkitAppRegion: 'no-drag'
          } as CustomCSSProperties} 
          onMouseDown={(e) => e.stopPropagation()}
        >
          <h4 style={{ margin: '0 0 16px 0', fontSize: '15px', color: '#2c3e50', borderBottom: '2px solid #3498db', paddingBottom: '8px' }}>
            🎨 外观设置
          </h4>

          {/* 整体透明度 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              整体透明度: {Math.round(opacity * 100)}%
            </label>
            <input 
              type="range" 
              min="0.3" 
              max="1" 
              step="0.05" 
              value={opacity} 
              onChange={(e) => setOpacity(parseFloat(e.target.value))} 
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, #3498db, #2ecc71)', outline: 'none', cursor: 'pointer' }} 
            />
          </div>

          {/* 背景透明度 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              背景透明度: {Math.round(bgOpacity * 100)}%
            </label>
            <input 
              type="range" 
              min="0" 
              max="1" 
              step="0.05" 
              value={bgOpacity} 
              onChange={(e) => setBgOpacity(parseFloat(e.target.value))} 
              style={{ width: '100%', height: '6px', borderRadius: '3px', background: 'linear-gradient(90deg, transparent, white)', outline: 'none', cursor: 'pointer' }} 
            />
          </div>

          {/* 背景颜色 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '13px', color: '#6c757d', display: 'block', marginBottom: '8px', fontWeight: 500 }}>
              背景颜色
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input 
                type="color" 
                value={bgColor} 
                onChange={(e) => setBgColor(e.target.value)} 
                style={{ width: '40px', height: '32px', borderRadius: '6px', border: '2px solid #ddd', cursor: 'pointer' }} 
              />
              <input 
                type="text" 
                value={bgColor} 
                onChange={(e) => setBgColor(e.target.value)} 
                style={{ flex: 1, padding: '6px 10px', borderRadius: '6px', border: '2px solid #ddd', fontSize: '12px' }} 
              />
            </div>
          </div>

          {/* 使用说明 */}
          <div style={{ padding: '12px', background: 'rgba(52,152,219,0.1)', borderRadius: '8px' }}>
            <h5 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#2980b9' }}>� 使用说明</h5>
            <div style={{ fontSize: '11px', color: '#6c757d', lineHeight: '1.6' }}>
              <div>• 整体透明度：控制整个窗口</div>
              <div>• 背景透明度：单独控制背景层</div>
              <div>• 拖拽窗口边缘可调整大小</div>
              <div>• 锁定后不可拖拽和调整</div>
            </div>
          </div>
        </div>
      )}

      {/* 主要日历内容区域 */}
      <div 
        style={{ 
          flex: 1, 
          marginTop: showControls ? '60px' : '0', 
          transition: 'margin-top 0.3s ease', 
          position: 'relative', 
          overflow: 'hidden', 
          pointerEvents: 'auto' 
        }} 
        onMouseDown={(e) => e.stopPropagation()}
      >
        <TimeCalendar
          onStartTimer={(taskTitle: string) => { 
            console.log('📝 Timer started:', taskTitle); 
          }}
          microsoftService={microsoftService}
          isWidgetMode={true}
          className="desktop-calendar-inner widget-mode-calendar"
          style={{ 
            height: '100%', 
            border: 'none', 
            borderRadius: '0 0 8px 8px', 
            background: 'transparent' 
          }}
        />
      </div>
      </div>
    </div>
  );
};

export default WidgetPage_v3;
