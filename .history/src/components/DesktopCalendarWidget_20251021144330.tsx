/**
 * Desktop Calendar Widget - 桌面日历悬浮组件
 * 
 * 基于TimeCalendar组件，提供完整的日历功能和同步能力
 * 额外支持透明度、大小调整、拖曳和锁定功能
 * 可作为桌面小部件使用
 * 
 * @author Zoey Gong
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import ToastUIReactCalendar from './ToastUIReactCalendar';
import { EventEditModal } from './EventEditModal';
import { Event } from '../types';
import '@toast-ui/calendar/dist/toastui-calendar.css';
import '../styles/calendar.css';

// 界面类型定义
interface EventObject {
  id: string;
  calendarId: string;
  title: string;
  category: string;
  dueDateClass: string;
  start: string;
  end: string;
  isAllDay?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  color?: string;
}

interface DesktopCalendarWidgetProps {
  events?: Event[];
  tags?: any[];
  onEventClick?: (event: Event) => void;
  onEventUpdate?: (event: Event) => void;
}

const DesktopCalendarWidget: React.FC<DesktopCalendarWidgetProps> = ({
  events = [],
  tags = [],
  onEventClick,
  onEventUpdate
}) => {
  // 基础状态
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [showControls, setShowControls] = useState(false);
  
  // 透明度控制
  const [opacity, setOpacity] = useState(0.95);
  const [bgColor, setBgColor] = useState('#ffffff');
  const [bgOpacity, setBgOpacity] = useState(0.95);
  const [calendarBgColor, setCalendarBgColor] = useState('#ffffff');
  const [calendarBgOpacity, setCalendarBgOpacity] = useState(1.0);
  
  // 显示控制
  const [showTags, setShowTags] = useState(true);
  const [showCalendarGroups, setShowCalendarGroups] = useState(true);
  const [currentView, setCurrentView] = useState('month');
  
  // 事件编辑状态
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<{start: Date, end: Date} | null>(null);

  // 组件引用
  const widgetRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });

  // Electron API 监听
  useEffect(() => {
    if (window.electronAPI) {
      // 监听来自主进程的事件
      window.electronAPI.on('widget-opacity-change', (newOpacity: number) => {
        setOpacity(newOpacity);
      });

      window.electronAPI.on('widget-lock-toggle', (locked: boolean) => {
        setIsLocked(locked);
      });

      window.electronAPI.on('widget-show-controls', () => {
        setShowControls(true);
      });

      return () => {
        window.electronAPI.removeAllListeners();
      };
    }
  }, []);

  // 动态CSS注入来实现透明度效果
  useEffect(() => {
    const styleElement = document.createElement('style');
    styleElement.id = 'desktop-calendar-transparency';
    
    // 移除旧的样式元素
    const existingStyle = document.getElementById('desktop-calendar-transparency');
    if (existingStyle) {
      existingStyle.remove();
    }

    const bgColorHex = calendarBgColor;
    const alphaHex = Math.round(calendarBgOpacity * 255).toString(16).padStart(2, '0');
    const bgColorWithAlpha = `${bgColorHex}${alphaHex}`;

    styleElement.textContent = `
      /* TUI Calendar 透明度样式 */
      .tui-calendar {
        background-color: ${bgColorWithAlpha} !important;
      }
      
      .tui-calendar .tui-calendar-month-dayname,
      .tui-calendar .tui-calendar-week-dayname {
        background-color: ${bgColorWithAlpha} !important;
        border-color: rgba(255,255,255,0.2) !important;
      }
      
      .tui-calendar .tui-calendar-month-date,
      .tui-calendar .tui-calendar-week-hour {
        background-color: ${bgColorWithAlpha} !important;
        border-color: rgba(255,255,255,0.1) !important;
      }
      
      .tui-calendar .tui-calendar-month-more-button {
        background-color: ${bgColorWithAlpha} !important;
      }
    `;

    document.head.appendChild(styleElement);

    return () => {
      if (document.getElementById('desktop-calendar-transparency')) {
        document.getElementById('desktop-calendar-transparency')?.remove();
      }
    };
  }, [calendarBgColor, calendarBgOpacity]);

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    setIsDragging(true);
    const rect = widgetRef.current?.getBoundingClientRect();
    if (rect) {
      dragOffsetRef.current = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };
    }
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (isDragging && !isLocked) {
      const newX = e.clientX - dragOffsetRef.current.x;
      const newY = e.clientY - dragOffsetRef.current.y;
      
      // 边界检查
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY))
      });
    }
  }, [isDragging, isLocked, size]);

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  // 大小调整处理
  const handleResizeStart = (e: React.MouseEvent) => {
    if (isLocked) return;
    e.stopPropagation();
    setIsResizing(true);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (isResizing && !isLocked) {
      const newWidth = Math.max(400, e.clientX - position.x);
      const newHeight = Math.max(300, e.clientY - position.y);
      
      setSize({
        width: Math.min(newWidth, window.innerWidth - position.x),
        height: Math.min(newHeight, window.innerHeight - position.y)
      });
    }
  }, [isResizing, isLocked, position]);

  const handleResizeEnd = () => {
    setIsResizing(false);
  };

  // 全局鼠标事件监听
  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
    };
  }, [isDragging, handleDragMove]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResizeMove);
      window.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleResizeMove);
      window.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isResizing, handleResizeMove]);

  // 透明度控制处理
  const handleOpacityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newOpacity = parseFloat(e.target.value);
    setOpacity(newOpacity);

    if (window.electronAPI) {
      window.electronAPI.widgetOpacity(newOpacity);
    }
  };

  // 转换事件为TUI Calendar格式，并根据显示选项过滤
  const calendarEvents: EventObject[] = events
    .filter(event => {
      // 根据显示选项过滤事件
      if (!showTags && event.tags && event.tags.length > 0) {
        // 如果不显示标签，可以选择隐藏有标签的事件，或者显示但不显示标签信息
        // 这里选择显示事件但不显示标签信息
      }
      if (!showCalendarGroups && event.calendarId) {
        // 如果不显示日历分组，可以选择隐藏有分组的事件
        // 这里选择显示事件但不显示分组信息
      }
      return true; // 显示所有事件，只是调整显示方式
    })
    .map(event => {
      // 获取标签信息用于颜色显示
      const eventTags = event.tags || [];
      const tagInfo = eventTags[0] && tags.find(tag => tag.id === eventTags[0]);
      const displayTitle = showTags && tagInfo
        ? `${tagInfo.emoji || '🏷️'} ${event.title}`
        : event.title;

      return {
        id: event.id,
        calendarId: showCalendarGroups
          ? (eventTags[0] || event.tagId || event.calendarId || 'default')
          : 'default',
        title: displayTitle,
        category: 'time',
        dueDateClass: '',
        start: event.startTime,
        end: event.endTime,
        isAllDay: event.isAllDay || false,
        backgroundColor: tagInfo?.color || '#3498db',
        borderColor: tagInfo?.color || '#3498db',
        color: '#ffffff'
      };
    });

  return (
    <div
      ref={widgetRef}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 9999,
        opacity: opacity,
        borderRadius: '8px',
        overflow: 'hidden',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
        border: '1px solid rgba(255,255,255,0.2)',
        cursor: isDragging ? 'grabbing' : isLocked ? 'default' : 'grab',
        userSelect: 'none',
        width: '100%',
        height: '100vh',
        backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
        backdropFilter: bgOpacity < 1 ? 'blur(10px)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 0.3s ease'
      }}
      onMouseDown={handleDragStart}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
    >
      {/* 控制栏 - 悬浮时显示 */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
            padding: '8px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            zIndex: 10,
            borderRadius: '8px 8px 0 0',
            backdropFilter: 'blur(10px)'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 左侧：视图切换 */}
          <div style={{ display: 'flex', gap: '4px' }}>
            {['month', 'week', 'day'].map(view => (
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

          {/* 中间：标题 */}
          <div style={{
            color: 'white',
            fontSize: '12px',
            fontWeight: '500',
            flex: 1,
            textAlign: 'center'
          }}>
            桌面日历
          </div>

          {/* 右侧：功能按钮 */}
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {/* 快速创建事件 */}
            <button
              onClick={() => {
                const now = new Date();
                const end = new Date(now.getTime() + 60 * 60 * 1000); // 1小时后
                setSelectedTimeRange({
                  start: now,
                  end: end
                });
                setShowEventEditModal(true);
              }}
              style={{
                padding: '4px 10px',
                fontSize: '11px',
                backgroundColor: 'rgba(52,152,219,0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="创建新事件"
            >
              ➕ 新建
            </button>

            {/* 锁定切换 */}
            <button
              onClick={() => setIsLocked(!isLocked)}
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: isLocked ? 'rgba(231,76,60,0.8)' : 'rgba(46,204,113,0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title={isLocked ? '解锁' : '锁定'}
            >
              {isLocked ? '🔒' : '🔓'}
            </button>

            {/* 设置面板切换 */}
            <button
              style={{
                padding: '4px 8px',
                fontSize: '11px',
                backgroundColor: 'rgba(155,89,182,0.8)',
                color: 'white',
                border: 'none',
                borderRadius: '3px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="设置"
            >
              ⚙️
            </button>
          </div>
        </div>
      )}

      {/* 设置面板 - 可展开收起 */}
      {showControls && (
        <div
          style={{
            position: 'absolute',
            top: '40px',
            right: '8px',
            width: '280px',
            maxHeight: '70%',
            background: 'linear-gradient(135deg, rgba(255,255,255,0.95), rgba(248,249,250,0.9))',
            border: '1px solid rgba(0,0,0,0.1)',
            borderRadius: '8px',
            padding: '12px',
            zIndex: 20,
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            overflowY: 'auto',
            fontSize: '12px'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 外观设置 */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#2c3e50' }}>🎨 外观设置</h4>
            
            {/* 窗口背景色 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
                窗口背景色
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
                    fontSize: '11px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>
            
            {/* 窗口透明度 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
                窗口透明度: {Math.round(bgOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
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

            {/* 日历背景色 */}
            <div style={{ marginBottom: '12px' }}>
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
                    fontSize: '11px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    fontFamily: 'monospace'
                  }}
                />
              </div>
            </div>
            
            {/* 日历透明度 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
                📅 日历透明度: {Math.round(calendarBgOpacity * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={calendarBgOpacity}
                onChange={(e) => setCalendarBgOpacity(parseFloat(e.target.value))}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* 显示设置 */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#2c3e50' }}>👁️ 显示设置</h4>
            
            {/* 显示标签 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '12px',
                color: '#495057',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showTags}
                  onChange={(e) => setShowTags(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                🏷️ 显示事件标签
              </label>
            </div>
            
            {/* 显示日历分组 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '8px',
                fontSize: '12px',
                color: '#495057',
                cursor: 'pointer'
              }}>
                <input
                  type="checkbox"
                  checked={showCalendarGroups}
                  onChange={(e) => setShowCalendarGroups(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    cursor: 'pointer'
                  }}
                />
                📅 显示日历分组
              </label>
            </div>
          </div>

          {/* 预览效果 */}
          <div style={{ marginBottom: '16px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#2c3e50' }}>👀 预览效果</h4>
            <div style={{ display: 'flex', gap: '8px' }}>
              <div style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: `${bgColor}${Math.round(bgOpacity * 255).toString(16).padStart(2, '0')}`,
                border: '1px solid #dee2e6',
                textAlign: 'center',
                fontSize: '10px',
                color: '#6c757d'
              }}>
                窗口背景
              </div>
              <div style={{
                flex: 1,
                padding: '8px',
                borderRadius: '4px',
                backgroundColor: `${calendarBgColor}${Math.round(calendarBgOpacity * 255).toString(16).padStart(2, '0')}`,
                border: '1px solid #dee2e6',
                textAlign: 'center',
                fontSize: '10px',
                color: '#6c757d'
              }}>
                日历背景
              </div>
            </div>
          </div>

          {/* 操作按钮 */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => {
                // 重置所有设置
                setBgColor('#ffffff');
                setBgOpacity(0.95);
                setCalendarBgColor('#ffffff');
                setCalendarBgOpacity(1.0);
              }}
              style={{
                flex: 1,
                padding: '8px 12px',
                fontSize: '11px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'background-color 0.2s'
              }}
            >
              🔄 重置
            </button>
          </div>
        </div>
      )}

      {/* 日历区域 */}
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
          onSelectDateTime={(dateInfo: any) => {
            console.log('📅 [Desktop Calendar] 选择时间:', dateInfo);
            // 设置选中的时间范围
            if (dateInfo.start && dateInfo.end) {
              setSelectedTimeRange({
                start: new Date(dateInfo.start),
                end: new Date(dateInfo.end)
              });
              setShowEventEditModal(true);
            }
          }}
          onBeforeCreateEvent={(eventData: any) => {
            console.log('📅 [Desktop Calendar] 创建事件前:', eventData);
            return eventData;
          }}
          onAfterRenderEvent={(eventInfo: any) => {
            console.log('📅 [Desktop Calendar] 事件渲染后:', eventInfo);
          }}
          template={{
            milestone: (event: any) => `<span style="color: red;">${event.title}</span>`,
            milestoneTitle: () => '里程碑',
            task: (event: any) => `#${event.title}`,
            taskTitle: () => '任务',
            allday: (event: any) => `${event.title}`,
            alldayTitle: () => '全天',
            time: (event: any) => `${event.title}`,
            goingDuration: (event: any) => `${event.title}`,
            comingDuration: (event: any) => `${event.title}`,
            monthMoreTitleDate: (date: any) => {
              return `${date.date}`;
            },
            monthMoreClose: () => '닫기',
            monthGridHeader: (model: any) => {
              return `${model.date}`;
            },
            monthGridHeaderExceed: (hiddenEvents: any) => {
              return `+${hiddenEvents}`;
            },
            monthGridFooter: () => '',
            monthGridFooterExceed: (hiddenEvents: any) => `+${hiddenEvents}`,
            weekDayname: (dayname: any) => `${dayname.label}`,
            monthDayname: (dayname: any) => `${dayname.label}`
          }}
          week={{
            daynames: ['일', '월', '화', '수', '목', '금', '토'],
            startDayOfWeek: 0,
            narrowWeekend: false,
            workweek: false,
            showTimezoneCollapseButton: false,
            timezonesCollapsed: false,
            hourStart: 0,
            hourEnd: 24
          }}
          month={{
            daynames: ['일', '월', '화', '수', '목', '금', '토'],
            startDayOfWeek: 0,
            narrowWeekend: false,
            visibleWeeksCount: 6,
            isAlways6Week: false,
            workweek: false,
            visibleEventCount: 6
          }}
          calendars={[
            {
              id: 'default',
              name: '默认日历',
              color: '#ffffff',
              bgColor: '#3498db',
              dragBgColor: '#3498db',
              borderColor: '#3498db'
            },
            ...tags.map(tag => ({
              id: tag.id,
              name: tag.name,
              color: '#ffffff',
              bgColor: tag.color || '#3498db',
              dragBgColor: tag.color || '#3498db',
              borderColor: tag.color || '#3498db'
            }))
          ]}
          usageStatistics={false}
        />
      </div>

      {/* 调整大小手柄 */}
      {!isLocked && (
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: '20px',
            height: '20px',
            cursor: 'se-resize',
            background: 'linear-gradient(-45deg, transparent 50%, rgba(255,255,255,0.3) 50%)',
            borderRadius: '0 0 8px 0'
          }}
          onMouseDown={handleResizeStart}
        />
      )}

      {/* 事件编辑模态框 */}
      {showEventEditModal && selectedTimeRange && (
        <EventEditModal
          isOpen={showEventEditModal}
          onClose={() => {
            setShowEventEditModal(false);
            setSelectedTimeRange(null);
          }}
          event={{
            id: `temp-${Date.now()}`,
            title: '',
            description: '',
            startTime: selectedTimeRange.start.toISOString(),
            endTime: selectedTimeRange.end.toISOString(),
            location: '',
            isAllDay: false,
            tags: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          } as any} // 创建临时事件对象用于初始化
          onSave={(eventData: Event) => {
            console.log('📅 [Desktop Calendar] 保存新事件:', eventData);
            // 这里应该调用父组件的事件创建回调
            if (onEventUpdate) {
              onEventUpdate(eventData);
            }
            setShowEventEditModal(false);
            setSelectedTimeRange(null);
          }}
          hierarchicalTags={tags}
        />
      )}
    </div>
  );
};

export default DesktopCalendarWidget;