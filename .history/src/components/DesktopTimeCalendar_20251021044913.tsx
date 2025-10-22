/**
 * Desktop Time Calendar Widget - 桌面时光日历组件
 * 
 * 功能完整的桌面日历，包含 TimeCalendar 所有功能：
 * - 可拖动、缩放、锁定
 * - 背景颜色和透明度调整
 * - 时段显示范围配置（0-24小时）
 * - 完整的日历功能（事件管理、同步等）
 * - 丰富的工具栏和下拉菜单
 * - 标签管理和筛选功能
 * - 导入导出功能
 * 
 * @author Zoey Gong
 * @version 3.0.0
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import ToastUIReactCalendar from './ToastUIReactCalendar';
import { EventEditModal } from './EventEditModal';
import type { EventObject } from '@toast-ui/calendar';
import '@toast-ui/calendar/dist/toastui-calendar.css';
import '../styles/calendar.css';
import '../styles/widget.css';
import { Event } from '../types';
import { 
  convertToCalendarEvent, 
  convertFromCalendarEvent,
  createCalendarsFromTags,
  flattenTags
} from '../utils/calendarUtils';

interface DesktopSettings {
  // 窗口设置
  position: { x: number; y: number };
  size: { width: number; height: number };
  isLocked: boolean;
  
  // 外观设置
  backgroundColor: string;
  backgroundOpacity: number;
  
  // 日历设置
  view: 'month' | 'week' | 'day';
  timeRangeStart: number; // 0-24
  timeRangeEnd: number;   // 0-24
  showTask: boolean;
  showWeekend: boolean;
}

interface DesktopTimeCalendarProps {
  events: Event[];
  tags: any[];
  onEventClick?: (event: Event) => void;
  onEventCreate?: (event: Event) => void;
  onEventUpdate?: (event: Event) => void;
  onEventDelete?: (eventId: string) => void;
  onStartTimer?: (taskTitle: string) => void;
  onSync?: () => void;
  microsoftService?: any;
  syncManager?: any;
}

const DEFAULT_SETTINGS: DesktopSettings = {
  position: { x: 100, y: 100 },
  size: { width: 800, height: 700 },
  isLocked: false,
  backgroundColor: '#ffffff',
  backgroundOpacity: 0.95,
  view: 'week',
  timeRangeStart: 6,
  timeRangeEnd: 22,
  showTask: true,
  showWeekend: true
};

const DesktopTimeCalendar: React.FC<DesktopTimeCalendarProps> = ({
  events,
  tags,
  onEventClick,
  onEventCreate,
  onEventUpdate,
  onEventDelete,
  onStartTimer,
  onSync,
  microsoftService,
  syncManager
}) => {
  const calendarRef = useRef<ToastUIReactCalendar>(null);
  
  // 从 localStorage 加载设置
  const [settings, setSettings] = useState<DesktopSettings>(() => {
    try {
      const saved = localStorage.getItem('desktop-calendar-settings');
      if (saved) {
        return { ...DEFAULT_SETTINGS, ...JSON.parse(saved) };
      }
    } catch (error) {
      console.error('Failed to load desktop calendar settings:', error);
    }
    return DEFAULT_SETTINGS;
  });

  // 控制状态
  const [showSettings, setShowSettings] = useState(false);
  const [showTagFilters, setShowTagFilters] = useState(false);
  const [showSyncMenu, setShowSyncMenu] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showMiniCalendar, setShowMiniCalendar] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  
  // 日历状态
  const [currentDate, setCurrentDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [showEventModal, setShowEventModal] = useState(false);
  
  // 拖拽和缩放引用
  const dragStartRef = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 保存设置到 localStorage
  const saveSettings = useCallback((newSettings: Partial<DesktopSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);
    localStorage.setItem('desktop-calendar-settings', JSON.stringify(updated));
    
    // 通知 Electron（如果在桌面环境）
    if (window.electronAPI) {
      if (newSettings.position) {
        window.electronAPI.widgetMove(newSettings.position);
      }
      if (newSettings.size) {
        window.electronAPI.widgetResize(newSettings.size);
      }
      if (newSettings.backgroundOpacity !== undefined) {
        window.electronAPI.widgetOpacity(newSettings.backgroundOpacity);
      }
    }
  }, [settings]);

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
    if (settings.isLocked || isDragging) return;
    
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      windowX: settings.position.x,
      windowY: settings.position.y
    };
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || settings.isLocked) return;
    
    const deltaX = e.clientX - dragStartRef.current.x;
    const deltaY = e.clientY - dragStartRef.current.y;
    
    const newPosition = {
      x: dragStartRef.current.windowX + deltaX,
      y: dragStartRef.current.windowY + deltaY
    };
    
    saveSettings({ position: newPosition });
  }, [isDragging, settings.isLocked, saveSettings]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 缩放处理
  const handleResizeStart = (e: React.MouseEvent) => {
    if (settings.isLocked) return;
    
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      width: settings.size.width,
      height: settings.size.height
    };
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || settings.isLocked) return;
    
    const deltaX = e.clientX - resizeStartRef.current.x;
    const deltaY = e.clientY - resizeStartRef.current.y;
    
    const newSize = {
      width: Math.max(600, resizeStartRef.current.width + deltaX),
      height: Math.max(500, resizeStartRef.current.height + deltaY)
    };
    
    saveSettings({ size: newSize });
  }, [isResizing, settings.isLocked, saveSettings]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

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
  }, [isDragging, handleDragMove, handleDragEnd]);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      return () => {
        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };
    }
  }, [isResizing, handleResizeMove, handleResizeEnd]);

  // 转换事件格式，应用标签过滤
  const filteredEvents = useMemo(() => {
    if (selectedTags.length === 0) return events;
    return events.filter(event => 
      event.tags && event.tags.some(tagId => selectedTags.includes(tagId))
    );
  }, [events, selectedTags]);

  const calendarEvents = filteredEvents.map(event => convertToCalendarEvent(event, tags));
  const calendars = createCalendarsFromTags(tags);

  // 日历导航
  const handlePrevious = () => {
    if (!calendarRef.current) return;
    calendarRef.current.calendarInstance?.prev();
    updateCurrentDate();
  };

  const handleNext = () => {
    if (!calendarRef.current) return;
    calendarRef.current.calendarInstance?.next();
    updateCurrentDate();
  };

  const handleToday = () => {
    if (!calendarRef.current) return;
    calendarRef.current.calendarInstance?.today();
    setCurrentDate(new Date());
  };

  const updateCurrentDate = () => {
    if (!calendarRef.current) return;
    const dateStr = calendarRef.current.calendarInstance?.getDate().toDate().toDateString();
    if (dateStr) {
      setCurrentDate(new Date(dateStr));
    }
  };

  // 视图切换
  const handleViewChange = (view: 'month' | 'week' | 'day') => {
    saveSettings({ view });
    if (calendarRef.current) {
      calendarRef.current.calendarInstance?.changeView(view);
    }
  };

  // 事件处理
  const handleClickEvent = (eventInfo: any) => {
    const event = events.find(e => e.id === eventInfo.id);
    if (event) {
      setEditingEvent(event);
      setShowEventModal(true);
      onEventClick?.(event);
    }
  };

  const handleSelectDateTime = (dateTime: any) => {
    // 创建新事件
    const newEvent: Partial<Event> = {
      id: `temp-${Date.now()}`,
      title: '',
      startTime: dateTime.start.toDate().toISOString(),
      endTime: dateTime.end.toDate().toISOString(),
      isAllDay: dateTime.isAllday || false,
      tags: []
    };
    setEditingEvent(newEvent as Event);
    setShowEventModal(true);
  };

  const handleEventSave = (event: Event) => {
    if (event.id.startsWith('temp-')) {
      onEventCreate?.(event);
    } else {
      onEventUpdate?.(event);
    }
    setShowEventModal(false);
    setEditingEvent(null);
  };

  const handleEventDelete = () => {
    if (editingEvent) {
      onEventDelete?.(editingEvent.id);
      setShowEventModal(false);
      setEditingEvent(null);
    }
  };

  // 新建不同类型的事件
  const handleCreateEvent = useCallback((type: 'event' | 'task' | 'reminder') => {
    const now = new Date();
    const end = new Date(now.getTime() + 60 * 60 * 1000); // 1小时后
    
    const newEvent: Event = {
      id: `temp-${Date.now()}`,
      title: type === 'task' ? '新任务' : type === 'reminder' ? '新提醒' : '新事件',
      startTime: now.toISOString(),
      endTime: end.toISOString(),
      location: '',
      description: '',
      tags: [],
      tagId: '',
      calendarId: '',
      isAllDay: type === 'reminder',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };
    
    setEditingEvent(newEvent);
    setShowEventModal(true);
    setShowCreateMenu(false);
  }, []);

  // 同步操作
  const handleSyncNow = useCallback(async () => {
    try {
      if (window.electronAPI?.debugLog) {
        window.electronAPI.debugLog('开始同步日历');
      }
      
      // 触发同步逻辑
      if (onSync) {
        onSync();
      }
      
      setShowSyncMenu(false);
      console.log('🔄 开始同步日历');
    } catch (error) {
      console.error('❌ 同步失败:', error);
    }
  }, [onSync]);

  const handleSyncSettings = useCallback(() => {
    setShowSyncMenu(false);
    // TODO: 打开同步设置面板
    console.log('⚙️ 打开同步设置');
  }, []);

  const handleSyncLogs = useCallback(() => {
    setShowSyncMenu(false);
    // TODO: 显示同步日志
    console.log('📋 显示同步日志');
  }, []);

  // 导出日历
  const handleExportCalendar = useCallback(async () => {
    try {
      const exportData = {
        events: events,
        tags: tags,
        exportTime: new Date().toISOString(),
        version: '1.0'
      };
      
      const dataStr = JSON.stringify(exportData, null, 2);
      
      if (window.electronAPI?.saveFile) {
        await window.electronAPI.saveFile(dataStr, 'calendar-export.json');
        console.log('📤 日历导出成功');
      } else {
        // Web环境下载
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `calendar-export-${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        console.log('📤 日历导出成功（浏览器下载）');
      }
      
      setShowMoreMenu(false);
    } catch (error) {
      console.error('❌ 导出失败:', error);
    }
  }, [events, tags]);

  // 导入日历
  const handleImportCalendar = useCallback(async () => {
    try {
      if (window.electronAPI?.openFile) {
        const fileContent = await window.electronAPI.openFile();
        if (fileContent) {
          const importData = JSON.parse(fileContent);
          // TODO: 验证和导入数据
          console.log('📥 导入数据:', importData);
        }
      } else {
        // Web环境文件选择
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (e) => {
              try {
                const importData = JSON.parse(e.target?.result as string);
                // TODO: 验证和导入数据
                console.log('📥 导入数据:', importData);
              } catch (error) {
                console.error('❌ 导入数据格式错误:', error);
              }
            };
            reader.readAsText(file);
          }
        };
        input.click();
      }
      
      setShowMoreMenu(false);
    } catch (error) {
      console.error('❌ 导入操作失败:', error);
    }
  }, []);

  // 全屏切换
  const handleToggleFullscreen = useCallback(() => {
    const newFullscreen = !isFullscreen;
    setIsFullscreen(newFullscreen);
    
    if (window.electronAPI?.widgetFullscreen) {
      window.electronAPI.widgetFullscreen(newFullscreen);
    }
    
    setShowMoreMenu(false);
    console.log(`${newFullscreen ? '📺' : '🪟'} ${newFullscreen ? '进入' : '退出'}全屏模式`);
  }, [isFullscreen]);

  // 格式化日期显示
  const formatDateDisplay = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;
    const day = currentDate.getDate();
    
    if (settings.view === 'month') {
      return `${year}年${month}月`;
    } else if (settings.view === 'week') {
      return `${year}年${month}月 第${Math.ceil(day / 7)}周`;
    } else {
      return `${year}年${month}月${day}日`;
    }
  };

  return (
    <div 
      className="desktop-time-calendar"
      style={{
        position: 'fixed',
        left: settings.position.x,
        top: settings.position.y,
        width: settings.size.width,
        height: settings.size.height,
        backgroundColor: `${settings.backgroundColor}${Math.round(settings.backgroundOpacity * 255).toString(16).padStart(2, '0')}`,
        backdropFilter: settings.backgroundOpacity < 1 ? 'blur(10px)' : 'none',
        borderRadius: '12px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: settings.isLocked ? 'none' : 'auto',
        zIndex: 10000,
        border: '1px solid rgba(255, 255, 255, 0.18)'
      }}
    >
      {/* 标题栏 */}
      <div 
        className="widget-titlebar"
        onMouseDown={handleDragStart}
        onMouseEnter={() => setShowControls(true)}
        style={{
          height: '48px',
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 16px',
          cursor: settings.isLocked ? 'default' : 'move',
          transition: 'opacity 0.2s',
          opacity: showControls || showSettings ? 1 : 0.7,
          borderRadius: '12px 12px 0 0'
        }}
      >
        {/* 左侧：标题和日期导航 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1 }}>
          <span style={{ color: 'white', fontSize: '16px', fontWeight: 'bold' }}>
            📅 时光日历
          </span>
          
          <div 
            style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <button
              onClick={handlePrevious}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="上一个"
            >
              ◀
            </button>
            
            <button
              onClick={handleToday}
              style={{
                padding: '4px 12px',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.3)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s'
              }}
              title="今天"
            >
              今天
            </button>
            
            <button
              onClick={handleNext}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="下一个"
            >
              ▶
            </button>
            
            <span style={{ color: 'white', fontSize: '13px', marginLeft: '8px', fontWeight: '500' }}>
              {formatDateDisplay()}
            </span>
          </div>
        </div>
        
        {/* 中间：主工具栏 */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 2, justifyContent: 'center' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 新建按钮组 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowCreateMenu(!showCreateMenu)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                backgroundColor: 'rgba(34, 197, 94, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="新建"
            >
              ➕ 新建 ▼
            </button>
            
            {showCreateMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                marginTop: '4px',
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10002,
                minWidth: '140px',
                border: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => {
                    handleCreateEvent('event');
                    setShowCreateMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '6px 6px 0 0'
                  }}
                >
                  📅 新建事件
                </button>
                <button
                  onClick={() => {
                    handleCreateEvent('task');
                    setShowCreateMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  ✅ 新建任务
                </button>
                <button
                  onClick={() => {
                    handleCreateEvent('reminder');
                    setShowCreateMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '0 0 6px 6px'
                  }}
                >
                  ⏰ 新建提醒
                </button>
              </div>
            )}
          </div>

          {/* 同步按钮组 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSyncMenu(!showSyncMenu)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                backgroundColor: 'rgba(59, 130, 246, 0.9)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="同步"
            >
              🔄 同步 ▼
            </button>
            
            {showSyncMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                marginTop: '4px',
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10002,
                minWidth: '160px',
                border: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => {
                    syncManager?.performSync();
                    setShowSyncMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '6px 6px 0 0'
                  }}
                >
                  🔄 立即同步
                </button>
                <button
                  onClick={() => {
                    setShowSyncMenu(false);
                    // TODO: 打开同步设置
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  ⚙️ 同步设置
                </button>
                <button
                  onClick={() => {
                    setShowSyncMenu(false);
                    // TODO: 查看同步日志
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '0 0 6px 6px'
                  }}
                >
                  📋 同步日志
                </button>
              </div>
            )}
          </div>

          {/* 视图切换按钮组 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowViewMenu(!showViewMenu)}
              style={{
                padding: '6px 12px',
                fontSize: '13px',
                backgroundColor: 'rgba(255,255,255,0.3)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="视图"
            >
              📋 {settings.view === 'month' ? '月' : settings.view === 'week' ? '周' : '日'} ▼
            </button>
            
            {showViewMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: '0',
                marginTop: '4px',
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10002,
                minWidth: '120px',
                border: '1px solid #e9ecef'
              }}>
                {(['month', 'week', 'day'] as const).map(view => (
                  <button
                    key={view}
                    onClick={() => {
                      handleViewChange(view);
                      setShowViewMenu(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      fontSize: '12px',
                      backgroundColor: settings.view === view ? '#f8f9fa' : 'transparent',
                      color: '#495057',
                      border: 'none',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontWeight: settings.view === view ? 'bold' : 'normal',
                      borderRadius: view === 'month' ? '6px 6px 0 0' : view === 'day' ? '0 0 6px 6px' : '0'
                    }}
                  >
                    {view === 'month' ? '📅 月视图' : view === 'week' ? '📊 周视图' : '📋 日视图'}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 标签筛选 */}
          <button
            onClick={() => setShowTagFilters(!showTagFilters)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              backgroundColor: showTagFilters ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="标签筛选"
          >
            🏷️ 筛选
          </button>
        </div>

        {/* 右侧：控制按钮 */}
        <div 
          style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {/* 更多功能 */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowMoreMenu(!showMoreMenu)}
              style={{
                padding: '4px 10px',
                fontSize: '12px',
                backgroundColor: 'rgba(255,255,255,0.2)',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              title="更多"
            >
              ⋯
            </button>
            
            {showMoreMenu && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: '0',
                marginTop: '4px',
                backgroundColor: 'white',
                borderRadius: '6px',
                boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                zIndex: 10002,
                minWidth: '150px',
                border: '1px solid #e9ecef'
              }}>
                <button
                  onClick={() => {
                    setIsFullscreen(!isFullscreen);
                    setShowMoreMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '6px 6px 0 0'
                  }}
                >
                  {isFullscreen ? '🪟 退出全屏' : '🖥️ 全屏显示'}
                </button>
                <button
                  onClick={() => {
                    handleExportCalendar();
                    setShowMoreMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer'
                  }}
                >
                  📤 导出日历
                </button>
                <button
                  onClick={() => {
                    handleImportCalendar();
                    setShowMoreMenu(false);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '12px',
                    backgroundColor: 'transparent',
                    color: '#495057',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    borderRadius: '0 0 6px 6px'
                  }}
                >
                  📥 导入日历
                </button>
              </div>
            )}
          </div>

          {/* 标签过滤 */}
          <button
            onClick={() => setShowTagFilters(!showTagFilters)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: showTagFilters ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s',
              position: 'relative'
            }}
            title="标签过滤"
          >
            🏷️
            {selectedTags.length > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                backgroundColor: '#dc3545',
                color: 'white',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                fontSize: '9px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 'bold'
              }}>
                {selectedTags.length}
              </span>
            )}
          </button>

          {/* 设置 */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: showSettings ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.2)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="设置"
          >
            ⚙️
          </button>

          {/* 锁定/解锁 */}
          <button
            onClick={() => saveSettings({ isLocked: !settings.isLocked })}
            style={{
              padding: '4px 10px',
              fontSize: '12px',
              backgroundColor: settings.isLocked ? 'rgba(239, 68, 68, 0.8)' : 'rgba(34, 197, 94, 0.8)',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold',
              transition: 'all 0.2s'
            }}
            title={settings.isLocked ? '已锁定（双击解锁）' : '未锁定'}
          >
            {settings.isLocked ? '🔒' : '🔓'}
          </button>
        </div>
      </div>

      {/* 设置面板 */}
      {showSettings && (
        <div
          style={{
            position: 'absolute',
            top: '58px',
            right: '16px',
            width: '320px',
            maxHeight: 'calc(100% - 78px)',
            backgroundColor: 'white',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
            zIndex: 10001,
            padding: '20px',
            border: '1px solid #e9ecef',
            overflow: 'auto'
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#212529' }}>
              ⚙️ 桌面日历设置
            </h3>
            <button
              onClick={() => setShowSettings(false)}
              style={{
                padding: '4px 8px',
                fontSize: '12px',
                backgroundColor: 'transparent',
                color: '#6c757d',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              ✕
            </button>
          </div>

          {/* 外观设置 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
              🎨 外观
            </h4>
            
            {/* 背景颜色 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'block', marginBottom: '6px' }}>
                背景颜色
              </label>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <input
                  type="color"
                  value={settings.backgroundColor}
                  onChange={(e) => saveSettings({ backgroundColor: e.target.value })}
                  style={{
                    width: '48px',
                    height: '36px',
                    border: '1px solid #dee2e6',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                />
                <input
                  type="text"
                  value={settings.backgroundColor}
                  onChange={(e) => saveSettings({ backgroundColor: e.target.value })}
                  style={{
                    flex: 1,
                    padding: '8px',
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
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>背景透明度</span>
                <span style={{ fontWeight: 'bold', color: '#212529' }}>{Math.round(settings.backgroundOpacity * 100)}%</span>
              </label>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.05"
                value={settings.backgroundOpacity}
                onChange={(e) => saveSettings({ backgroundOpacity: parseFloat(e.target.value) })}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>
          </div>

          {/* 时段设置 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
              ⏰ 时段显示范围
            </h4>
            
            {/* 开始时间 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>开始时间</span>
                <span style={{ fontWeight: 'bold', color: '#212529' }}>{settings.timeRangeStart}:00</span>
              </label>
              <input
                type="range"
                min="0"
                max="23"
                step="1"
                value={settings.timeRangeStart}
                onChange={(e) => {
                  const start = parseInt(e.target.value);
                  if (start < settings.timeRangeEnd) {
                    saveSettings({ timeRangeStart: start });
                  }
                }}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>

            {/* 结束时间 */}
            <div style={{ marginBottom: '12px' }}>
              <label style={{ fontSize: '12px', color: '#6c757d', display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span>结束时间</span>
                <span style={{ fontWeight: 'bold', color: '#212529' }}>{settings.timeRangeEnd}:00</span>
              </label>
              <input
                type="range"
                min="1"
                max="24"
                step="1"
                value={settings.timeRangeEnd}
                onChange={(e) => {
                  const end = parseInt(e.target.value);
                  if (end > settings.timeRangeStart) {
                    saveSettings({ timeRangeEnd: end });
                  }
                }}
                style={{
                  width: '100%',
                  cursor: 'pointer'
                }}
              />
            </div>

            <div style={{ 
              padding: '8px 12px', 
              backgroundColor: '#e7f3ff', 
              borderRadius: '4px', 
              fontSize: '11px', 
              color: '#0066cc',
              border: '1px solid #b8daff'
            }}>
              💡 显示 {settings.timeRangeStart}:00 - {settings.timeRangeEnd}:00
            </div>
          </div>

          {/* 显示选项 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
              👁️ 显示选项
            </h4>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px',
              backgroundColor: settings.showTask ? '#f0f9ff' : 'transparent',
              border: '1px solid ' + (settings.showTask ? '#b8daff' : '#dee2e6')
            }}>
              <input
                type="checkbox"
                checked={settings.showTask}
                onChange={(e) => saveSettings({ showTask: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>显示任务视图</span>
            </label>

            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px',
              backgroundColor: settings.showWeekend ? '#f0f9ff' : 'transparent',
              border: '1px solid ' + (settings.showWeekend ? '#b8daff' : '#dee2e6')
            }}>
              <input
                type="checkbox"
                checked={settings.showWeekend}
                onChange={(e) => saveSettings({ showWeekend: e.target.checked })}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>显示周末</span>
            </label>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px',
              backgroundColor: showMiniCalendar ? '#f0f9ff' : 'transparent',
              border: '1px solid ' + (showMiniCalendar ? '#b8daff' : '#dee2e6')
            }}>
              <input
                type="checkbox"
                checked={showMiniCalendar}
                onChange={(e) => setShowMiniCalendar(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>显示迷你日历</span>
            </label>
            
            <label style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px',
              padding: '8px',
              borderRadius: '4px',
              cursor: 'pointer',
              marginBottom: '8px',
              backgroundColor: showTagFilters ? '#f0f9ff' : 'transparent',
              border: '1px solid ' + (showTagFilters ? '#b8daff' : '#dee2e6')
            }}>
              <input
                type="checkbox"
                checked={showTagFilters}
                onChange={(e) => setShowTagFilters(e.target.checked)}
                style={{ cursor: 'pointer' }}
              />
              <span style={{ fontSize: '12px', color: '#495057' }}>显示标签过滤面板</span>
            </label>
          </div>

          {/* 标签管理 */}
          {tags.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
                🏷️ 标签管理
              </h4>
              
              <div style={{
                maxHeight: '120px',
                overflowY: 'auto',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                padding: '8px'
              }}>
                {tags.map(tag => (
                  <div key={tag.id} style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '4px 8px',
                    marginBottom: '4px',
                    backgroundColor: '#f8f9fa',
                    borderRadius: '4px',
                    fontSize: '11px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        backgroundColor: tag.color,
                        borderRadius: '50%',
                        border: '1px solid rgba(0,0,0,0.1)'
                      }} />
                      <span style={{ color: '#495057', fontWeight: '500' }}>{tag.name}</span>
                    </div>
                    <span style={{ color: '#6c757d', fontSize: '10px' }}>
                      {events.filter(e => e.tags && e.tags.includes(tag.id)).length} 事件
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 日历信息 */}
          <div style={{ marginBottom: '20px' }}>
            <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600, color: '#495057' }}>
              📅 日历信息
            </h4>
            
            <div style={{ fontSize: '11px', color: '#6c757d', lineHeight: '1.5' }}>
              <div style={{ marginBottom: '4px' }}>
                📊 总事件数: <span style={{ fontWeight: 'bold', color: '#495057' }}>{events.length}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                🏷️ 标签数量: <span style={{ fontWeight: 'bold', color: '#495057' }}>{tags.length}</span>
              </div>
              <div style={{ marginBottom: '4px' }}>
                👀 当前视图: <span style={{ fontWeight: 'bold', color: '#495057' }}>
                  {settings.view === 'month' ? '月视图' : settings.view === 'week' ? '周视图' : '日视图'}
                </span>
              </div>
              {selectedTags.length > 0 && (
                <div style={{ marginBottom: '4px' }}>
                  🔍 筛选中: <span style={{ fontWeight: 'bold', color: '#007bff' }}>{selectedTags.length} 个标签</span>
                </div>
              )}
            </div>
          </div>

          {/* 重置按钮 */}
          <button
            onClick={() => {
              saveSettings(DEFAULT_SETTINGS);
              setShowSettings(false);
            }}
            style={{
              width: '100%',
              padding: '10px',
              fontSize: '13px',
              backgroundColor: '#f8f9fa',
              color: '#495057',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.2s'
            }}
          >
            🔄 恢复默认设置
          </button>
        </div>
      )}

      {/* 标签过滤面板 */}
      {showTagFilters && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: 'rgba(248, 249, 250, 0.98)',
          borderBottom: '1px solid #dee2e6',
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          fontSize: '12px'
        }}>
          <span style={{ color: '#6c757d', marginRight: '8px', fontWeight: '600' }}>🏷️ 标签过滤:</span>
          
          {tags.length > 0 ? (
            <>
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  backgroundColor: selectedTags.length === 0 ? '#007bff' : 'transparent',
                  color: selectedTags.length === 0 ? 'white' : '#6c757d',
                  border: `1px solid ${selectedTags.length === 0 ? '#007bff' : '#dee2e6'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
                title="显示全部"
              >
                全部
              </button>
              
              {tags.map(tag => (
                <button
                  key={tag.id}
                  onClick={() => {
                    setSelectedTags(prev => 
                      prev.includes(tag.id) 
                        ? prev.filter(id => id !== tag.id)
                        : [...prev, tag.id]
                    );
                  }}
                  style={{
                    padding: '3px 8px',
                    fontSize: '11px',
                    backgroundColor: selectedTags.includes(tag.id) ? tag.color : 'transparent',
                    color: selectedTags.includes(tag.id) ? 'white' : tag.color,
                    border: `1px solid ${tag.color}`,
                    borderRadius: '12px',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    fontWeight: selectedTags.includes(tag.id) ? '600' : 'normal'
                  }}
                  title={tag.name}
                >
                  {tag.name}
                </button>
              ))}
            </>
          ) : (
            <span style={{ color: '#6c757d', fontStyle: 'italic' }}>暂无标签</span>
          )}
          
          <button
            onClick={() => setShowTagFilters(false)}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              backgroundColor: 'transparent',
              color: '#6c757d',
              border: '1px solid #dee2e6',
              borderRadius: '4px',
              cursor: 'pointer',
              marginLeft: 'auto'
            }}
            title="关闭过滤"
          >
            ✕
          </button>
        </div>
      )}

      {/* 日历主体 */}
      <div 
        style={{ 
          flex: 1, 
          overflow: 'hidden',
          position: 'relative',
          backgroundColor: 'white',
          borderRadius: showTagFilters ? '0' : '0 0 12px 12px'
        }}
        onMouseEnter={() => setShowControls(false)}
        onMouseLeave={() => setShowControls(true)}
      >
        <ToastUIReactCalendar
          ref={calendarRef}
          height="100%"
          view={settings.view}
          events={calendarEvents}
          calendars={calendars}
          onClickEvent={handleClickEvent}
          onSelectDateTime={handleSelectDateTime}
          isReadOnly={false}
          useFormPopup={false}
          useDetailPopup={false}
          week={{
            taskView: settings.showTask ? ['task'] : false,
            eventView: ['time'],
            showNowIndicator: true,
            showTimezoneCollapseButton: false,
            hourStart: settings.timeRangeStart,
            hourEnd: settings.timeRangeEnd
          }}
          month={{
            dayNames: ['日', '一', '二', '三', '四', '五', '六'],
            visibleWeeksCount: 6,
            workweek: !settings.showWeekend,
            narrowWeekend: false,
            startDayOfWeek: 0,
            isAlways6Weeks: true,
            visibleEventCount: 4
          }}
          template={{
            monthDayName(model: any) {
              return `<span class="toastui-calendar-template-monthDayName">${model.label}</span>`;
            },
            monthGridHeader(model: any) {
              const dateParts = model.date.split('-');
              const dayNumber = parseInt(dateParts[2], 10);
              const month = model.month + 1;
              
              if (dayNumber === 1) {
                return `<span class="toastui-calendar-template-monthGridHeader">${month}/${dayNumber}</span>`;
              }
              
              return `<span class="toastui-calendar-template-monthGridHeader">${dayNumber}</span>`;
            },
            weekDayName(model: any) {
              const date = model.date;
              const dateInstance = model.dateInstance;
              
              if (dateInstance) {
                const month = dateInstance.getMonth() + 1;
                if (date === 1) {
                  return `<span class="toastui-calendar-template-weekDayName">${month}/${date}</span>`;
                }
              }
              
              return `<span class="toastui-calendar-template-weekDayName">${date}</span>`;
            }
          }}
          theme={{
            common: {
              border: '1px solid #e9ecef',
              backgroundColor: 'white',
              holiday: { color: '#ff4040' },
              saturday: { color: '#333' },
              dayName: { color: '#666' }
            }
          }}
        />
      </div>

      {/* 调整大小手柄 */}
      {!settings.isLocked && (
        <div
          className="resize-handle"
          onMouseDown={handleResizeStart}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '24px',
            height: '24px',
            cursor: 'nwse-resize',
            background: 'linear-gradient(135deg, transparent 50%, rgba(102, 126, 234, 0.6) 50%)',
            borderRadius: '0 0 12px 0',
            zIndex: 10002
          }}
        />
      )}

      {/* 锁定遮罩 */}
      {settings.isLocked && (
        <div
          style={{
            position: 'absolute',
            top: 48,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'transparent',
            cursor: 'not-allowed',
            zIndex: 9999
          }}
          onDoubleClick={() => saveSettings({ isLocked: false })}
          title="双击解锁"
        />
      )}

      {/* 事件编辑模态框 */}
      {showEventModal && editingEvent && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 10003 }}>
          <EventEditModal
            event={editingEvent}
            isOpen={showEventModal}
            hierarchicalTags={tags}
            onSave={handleEventSave}
            onDelete={() => handleEventDelete()}
            onClose={() => setShowEventModal(false)}
          />
        </div>
      )}
    </div>
  );
};

export default DesktopTimeCalendar;
