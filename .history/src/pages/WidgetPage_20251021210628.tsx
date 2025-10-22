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
  const [bgOpacity, setBgOpacity] = useState(0.0);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);
  const widgetRef = React.useRef<HTMLDivElement>(null);

  // 从 localStorage 加载设置
  useEffect(() => {
    const savedColor = localStorage.getItem('widget-bg-color');
    const savedOpacity = localStorage.getItem('widget-bg-opacity');
    const savedLocked = localStorage.getItem('widget-locked');
    
    if (savedColor) setBgColor(savedColor);
    if (savedOpacity) setBgOpacity(parseFloat(savedOpacity));
    if (savedLocked) setIsLocked(savedLocked === 'true');
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

  const handleLockToggle = async () => {
    const newLockState = !isLocked;
    setIsLocked(newLockState);
    localStorage.setItem('widget-locked', newLockState.toString());
    
    // 调用 Electron API 设置窗口可交互性
    if (window.electronAPI?.widgetLock) {
      try {
        await window.electronAPI.widgetLock(newLockState);
        console.log('Widget lock state:', newLockState);
      } catch (error) {
        console.error('Failed to set widget lock:', error);
      }
    }
  };

  // 将十六进制颜色转换为 rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(4, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  const [isDragBarHovered, setIsDragBarHovered] = React.useState(false);

  // 控制栏样式 - 参考 DesktopCalendarWidgetV3
  const controlBarStyle: CustomCSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50px',
    background: showControls 
      ? 'linear-gradient(135deg, rgba(0,0,0,0.9), rgba(30,30,30,0.8))'
      : 'rgba(0, 0, 0, 0)',
    backdropFilter: showControls ? 'blur(20px)' : 'none',
    padding: '0 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    WebkitAppRegion: 'drag',
    cursor: isLocked ? 'default' : 'grab',
    transition: 'all 0.3s ease',
    zIndex: 1000,
    borderRadius: '8px 8px 0 0',
    borderBottom: showControls ? '1px solid rgba(255,255,255,0.1)' : 'none',
    opacity: showControls ? 1 : 0
  };

  const buttonBaseStyle: CustomCSSProperties = {
    WebkitAppRegion: 'no-drag',
    background: isDragBarHovered ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0)',
    border: isDragBarHovered ? '1px solid rgba(255, 255, 255, 0.3)' : 'none',
    borderRadius: '6px',
    color: 'white',
    cursor: 'pointer',
    fontSize: '14px',
    width: '32px',
    height: '32px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    opacity: isDragBarHovered ? 1 : 0
  };

  const resizeHandleStyle: CustomCSSProperties = {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '20px',
    height: '20px',
    cursor: 'nwse-resize',
    WebkitAppRegion: 'no-drag',
    background: 'rgba(168, 85, 247, 0.2)',
    borderRadius: '0 0 8px 0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    color: 'rgba(168, 85, 247, 0.6)',
    transition: 'all 0.2s ease',
    opacity: 0.3
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
      {/* 拖动栏 - hover 唤醒 */}
      <div 
        style={dragBarStyle}
        onMouseEnter={() => setIsDragBarHovered(true)}
        onMouseLeave={() => setIsDragBarHovered(false)}
      >
        <span style={{ 
          fontSize: '14px', 
          fontWeight: 600, 
          color: 'white',
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          opacity: isDragBarHovered ? 1 : 0,
          transition: 'opacity 0.3s ease'
        }}>
          📅 日历组件
          {isLocked && <span style={{ fontSize: '12px', opacity: 0.9 }}>🔒</span>}
        </span>
        <div style={{ display: 'flex', gap: '10px' }}>
          {/* 锁定按钮 */}
          <button
            onClick={handleLockToggle}
            style={{
              ...buttonBaseStyle,
              background: isLocked && isDragBarHovered
                ? 'rgba(251, 191, 36, 0.3)' 
                : isDragBarHovered 
                  ? 'rgba(255, 255, 255, 0.2)' 
                  : 'rgba(0, 0, 0, 0)',
              border: isLocked && isDragBarHovered 
                ? '1px solid rgba(251, 191, 36, 0.5)' 
                : isDragBarHovered
                  ? '1px solid rgba(255, 255, 255, 0.3)'
                  : 'none'
            }}
            onMouseEnter={(e) => {
              if (isDragBarHovered) {
                e.currentTarget.style.background = isLocked ? 'rgba(251, 191, 36, 0.4)' : 'rgba(255, 255, 255, 0.3)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title={isLocked ? '解锁' : '锁定在桌面'}
          >
            {isLocked ? '🔒' : '🔓'}
          </button>
          {/* 设置按钮 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              ...buttonBaseStyle,
              background: showSettings && isDragBarHovered
                ? 'rgba(255, 255, 255, 0.3)' 
                : buttonBaseStyle.background
            }}
            onMouseEnter={(e) => {
              if (isDragBarHovered) {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.35)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="设置"
          >
            ⚙️
          </button>
          {/* 关闭按钮 */}
          <button
            onClick={handleClose}
            style={buttonBaseStyle}
            onMouseEnter={(e) => {
              if (isDragBarHovered) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)';
                e.currentTarget.style.border = '1px solid rgba(239, 68, 68, 0.5)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="关闭"
          >
            ×
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '12px',
          background: 'white',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
          zIndex: 1000,
          minWidth: '250px',
          WebkitAppRegion: 'no-drag'
        } as CustomCSSProperties}>
          <h3 style={{ 
            margin: '0 0 16px 0', 
            fontSize: '14px', 
            fontWeight: 600,
            color: '#333'
          }}>
            🎨 外观设置
          </h3>
          
          {/* 背景颜色选择 */}
          <div style={{ marginBottom: '16px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '12px',
              color: '#666',
              fontWeight: 500
            }}>
              背景颜色
            </label>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="color"
                value={bgColor}
                onChange={(e) => handleColorChange(e.target.value)}
                style={{
                  width: '40px',
                  height: '32px',
                  border: '2px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              />
              <input
                type="text"
                value={bgColor}
                onChange={(e) => handleColorChange(e.target.value)}
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'monospace'
                }}
              />
            </div>
            
            {/* 预设颜色 */}
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              marginTop: '8px',
              flexWrap: 'wrap'
            }}>
              {['#ffffff', '#f0f0f0', '#e8e8ff', '#ffe8e8', '#e8ffe8', '#fff8e8', '#000000'].map(color => (
                <button
                  key={color}
                  onClick={() => handleColorChange(color)}
                  style={{
                    width: '28px',
                    height: '28px',
                    background: color,
                    border: bgColor === color ? '3px solid #6464ff' : '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    transition: 'transform 0.1s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* 透明度滑块 */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '12px',
              color: '#666',
              fontWeight: 500
            }}>
              背景透明度: {Math.round(bgOpacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={bgOpacity}
              onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
              style={{
                width: '100%',
                cursor: 'pointer',
                accentColor: '#6464ff'
              }}
            />
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              fontSize: '10px',
              color: '#999',
              marginTop: '4px'
            }}>
              <span>透明</span>
              <span>不透明</span>
            </div>
          </div>

          {/* 锁定在桌面选项 */}
          <div style={{ 
            marginTop: '16px',
            paddingTop: '16px',
            borderTop: '1px solid #eee'
          }}>
            <label style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              fontSize: '12px',
              color: '#666',
              cursor: 'pointer',
              fontWeight: 500
            }}>
              <input
                type="checkbox"
                checked={isLocked}
                onChange={handleLockToggle}
                style={{
                  width: '16px',
                  height: '16px',
                  cursor: 'pointer',
                  accentColor: '#6464ff'
                }}
              />
              <span>🔒 锁定在桌面</span>
            </label>
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: '#999',
              paddingLeft: '26px'
            }}>
              锁定后无法拖动和点击，但可通过设置解锁
            </div>
          </div>

          {/* 预览 */}
          <div style={{
            marginTop: '16px',
            padding: '12px',
            borderRadius: '4px',
            background: hexToRgba(bgColor, bgOpacity),
            border: '1px solid #ddd',
            fontSize: '11px',
            color: bgOpacity > 0.5 ? '#333' : '#666',
            textAlign: 'center'
          }}>
            预览效果
          </div>
        </div>
      )}

      {/* 日历内容区域 - 完全透明的容器 */}
      <div style={{
        position: 'relative',
        flex: 1,
        overflow: 'hidden',
        borderRadius: '0 0 8px 8px'
      }}>
        {/* 背景层 - 应用背景色和透明度 */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: hexToRgba(bgColor, bgOpacity),
          borderRadius: '0 0 8px 8px',
          boxShadow: bgOpacity > 0.1 ? '0 4px 16px rgba(0,0,0,0.15)' : 'none',
          pointerEvents: 'none'
        }} />
        
        {/* 日历层 - 完全透明 */}
        <div style={{
          position: 'relative',
          width: '100%',
          height: '100%',
          zIndex: 1
        }}>
          <TimeCalendar
            onStartTimer={(taskTitle: string) => {
              console.log('Timer started:', taskTitle);
            }}
            microsoftService={microsoftService}
            isWidgetMode={true}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              borderRadius: '0 0 8px 8px',
              background: 'transparent'
            }}
          />
        </div>
      </div>

      {/* 缩放手柄 - 右下角，hover 时显示 */}
      <div 
        style={resizeHandleStyle}
        onMouseEnter={(e) => {
          e.currentTarget.style.opacity = '0.8';
          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.4)';
          e.currentTarget.style.color = 'rgba(168, 85, 247, 1)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.opacity = '0.3';
          e.currentTarget.style.background = 'rgba(168, 85, 247, 0.2)';
          e.currentTarget.style.color = 'rgba(168, 85, 247, 0.6)';
        }}
      >
        ⋰
      </div>
    </div>
  );
};

export default WidgetPage;
