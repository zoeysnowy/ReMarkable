import React, { useEffect, useState } from 'react';

interface ClickEvent {
  id: number;
  x: number;
  y: number;
  timestamp: number;
  target: string;
  elementBounds?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  elementInfo?: {
    tagName: string;
    className: string;
    id: string;
    textContent: string;
  };
}

interface ClickTrackerProps {
  enabled?: boolean;
  maxEvents?: number;
  showVisualIndicators?: boolean;
  onClickDetected?: (event: ClickEvent) => void;
  children: React.ReactNode;
}

const ClickTracker: React.FC<ClickTrackerProps> = ({
  enabled = true,
  maxEvents = 10,
  showVisualIndicators = true,
  onClickDetected,
  children
}) => {
  const [clickEvents, setClickEvents] = useState<ClickEvent[]>([]);
  const [panelPosition, setPanelPosition] = useState({ x: 20, y: 20 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // 复制单个事件到剪贴板
  const copyEvent = (event: ClickEvent) => {
    const eventText = `🖱️ Click Event #${event.id}
📍 Position: (${event.x}, ${event.y})
🎯 Target: ${event.elementInfo?.tagName}${event.elementInfo?.className ? '.' + event.elementInfo.className.split(' ')[0] : ''}${event.elementInfo?.id ? '#' + event.elementInfo.id : ''}
📐 Size: ${event.elementBounds?.width.toFixed(1)}×${event.elementBounds?.height.toFixed(1)}
📝 Text: "${event.elementInfo?.textContent || 'N/A'}"
⏰ Time: ${new Date(event.timestamp).toLocaleTimeString()}`;

    navigator.clipboard.writeText(eventText).then(() => {
    }).catch(err => {
      console.error('❌ Failed to copy event:', err);
    });
  };

  // 复制所有事件到剪贴板
  const copyAllEvents = () => {
    if (clickEvents.length === 0) {
      return;
    }

    const allEventsText = `🖱️ Click Tracker Report (${clickEvents.length} events)
Generated: ${new Date().toLocaleString()}

${clickEvents.map((event, index) => `
--- Event ${index + 1} ---
ID: #${event.id}
Position: (${event.x}, ${event.y})
Target: ${event.elementInfo?.tagName}${event.elementInfo?.className ? '.' + event.elementInfo.className.split(' ')[0] : ''}${event.elementInfo?.id ? '#' + event.elementInfo.id : ''}
Size: ${event.elementBounds?.width.toFixed(1)}×${event.elementBounds?.height.toFixed(1)}
Text: "${event.elementInfo?.textContent || 'N/A'}"
Time: ${new Date(event.timestamp).toLocaleTimeString()}
`).join('')}

--- End Report ---`;

    navigator.clipboard.writeText(allEventsText).then(() => {
    }).catch(err => {
      console.error('❌ Failed to copy all events:', err);
    });
  };

  // 检查是否点击在ClickTracker面板上
  const isClickOnPanel = (x: number, y: number) => {
    const panelElement = document.querySelector('[data-click-tracker-panel]');
    if (!panelElement) return false;
    
    const rect = panelElement.getBoundingClientRect();
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
  };

  // 处理拖拽开始
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).dataset.dragHandle) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - panelPosition.x,
        y: e.clientY - panelPosition.y
      });
    }
  };

  // 处理拖拽移动
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPanelPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    }
  };

  // 处理拖拽结束
  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (!enabled) return;

    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 忽略在ClickTracker面板上的点击
      if (isClickOnPanel(e.clientX, e.clientY)) {
        return;
      }
      
      const bounds = target.getBoundingClientRect();
      
      const clickEvent: ClickEvent = {
        id: Date.now(),
        x: e.clientX,
        y: e.clientY,
        timestamp: Date.now(),
        target: target.tagName.toLowerCase(),
        elementBounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height
        },
        elementInfo: {
          tagName: target.tagName,
          className: target.className || '',
          id: target.id || '',
          textContent: target.textContent?.slice(0, 50) || ''
        }
      };

      // 控制台输出详细信息
      console.group(`🖱️ CLICK DETECTED #${clickEvent.id}`);      // console.log('📍 Position:', `(${clickEvent.x}, ${clickEvent.y})`);
      console.groupEnd();

      // 更新点击事件列表
      setClickEvents(prev => {
        const newEvents = [clickEvent, ...prev].slice(0, maxEvents);
        return newEvents;
      });

      // 回调通知
      if (onClickDetected) {
        onClickDetected(clickEvent);
      }
    };

    document.addEventListener('click', handleClick, true); // 使用capture阶段
    
    return () => {
      document.removeEventListener('click', handleClick, true);
    };
  }, [enabled, maxEvents, onClickDetected, panelPosition]);

  // 拖拽事件监听
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  return (
    <>
      {children}
      
      {/* 可视化指示器 */}
      {enabled && showVisualIndicators && (
        <>
          {/* 点击历史面板 */}
          <div 
            data-click-tracker-panel
            style={{
              position: 'fixed',
              top: `${panelPosition.y}px`,
              left: `${panelPosition.x}px`,
              width: '300px',
              maxHeight: '400px',
              backgroundColor: 'rgba(0, 0, 0, 0.9)',
              color: 'white',
              borderRadius: '8px',
              padding: '12px',
              fontSize: '12px',
              fontFamily: 'monospace',
              zIndex: 9999,
              overflow: 'auto',
              cursor: isDragging ? 'grabbing' : 'grab',
              userSelect: 'none'
            }}
            onMouseDown={handleMouseDown}
          >
            <div style={{ 
              fontWeight: 'bold', 
              marginBottom: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
            data-drag-handle
            >
              🖱️ Click Tracker ({clickEvents.length}) 📍
              <div style={{ display: 'flex', gap: '4px' }}>
                <button
                  onClick={copyAllEvents}
                  style={{
                    background: 'rgba(59, 130, 246, 0.8)',
                    border: 'none',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                  title="复制所有事件到剪贴板"
                >
                  Copy All
                </button>
                <button
                  onClick={() => setClickEvents([])}
                  style={{
                    background: 'rgba(239, 68, 68, 0.8)',
                    border: 'none',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    cursor: 'pointer'
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
            
            {clickEvents.length === 0 ? (
              <div style={{ color: '#888' }}>No clicks detected</div>
            ) : (
              clickEvents.map((event, index) => (
                <div key={event.id} style={{
                  marginBottom: '8px',
                  padding: '6px',
                  backgroundColor: index === 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(255, 255, 255, 0.1)',
                  borderRadius: '4px',
                  border: index === 0 ? '1px solid #22c55e' : '1px solid transparent',
                  position: 'relative'
                }}>
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'flex-start',
                    marginBottom: '4px'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#22c55e' }}>
                      #{event.id} ({event.x}, {event.y})
                    </div>
                    <button
                      onClick={() => copyEvent(event)}
                      style={{
                        background: 'rgba(16, 185, 129, 0.8)',
                        border: 'none',
                        color: 'white',
                        padding: '1px 4px',
                        borderRadius: '3px',
                        fontSize: '9px',
                        cursor: 'pointer'
                      }}
                      title="复制此事件"
                    >
                      Copy
                    </button>
                  </div>
                  <div style={{ color: '#fbbf24' }}>
                    {event.elementInfo?.tagName.toLowerCase()}
                    {event.elementInfo?.className && `.${event.elementInfo.className.split(' ')[0]}`}
                    {event.elementInfo?.id && `#${event.elementInfo.id}`}
                  </div>
                  <div style={{ color: '#94a3b8', fontSize: '10px' }}>
                    Size: {event.elementBounds?.width.toFixed(1)}×{event.elementBounds?.height.toFixed(1)}
                  </div>
                  {event.elementInfo?.textContent && (
                    <div style={{ color: '#cbd5e1', fontSize: '10px', fontStyle: 'italic' }}>
                      "{event.elementInfo.textContent}"
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* 点击位置的可视化圆点 */}
          {clickEvents.slice(0, 3).map((event, index) => (
            <div
              key={event.id}
              style={{
                position: 'fixed',
                left: event.x - 8,
                top: event.y - 8,
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: index === 0 ? '#22c55e' : index === 1 ? '#f59e0b' : '#ef4444',
                border: '2px solid white',
                zIndex: 9998,
                pointerEvents: 'none',
                animation: `clickPulse 2s ease-out ${index * 0.2}s forwards`
              }}
            />
          ))}

          {/* CSS动画 */}
          <style>
            {`
              @keyframes clickPulse {
                0% {
                  transform: scale(1);
                  opacity: 1;
                }
                50% {
                  transform: scale(1.5);
                  opacity: 0.7;
                }
                100% {
                  transform: scale(1);
                  opacity: 0;
                }
              }
            `}
          </style>
        </>
      )}
    </>
  );
};

export default ClickTracker;