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
import ToastUIReactCalendar, { ToastUIReactCalendarType } from './ToastUIReactCalendar';
import { EventEditModal } from './EventEditModal';
import CalendarSettingsPanel, { CalendarSettings } from './CalendarSettingsPanel';
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

/**
 * 🎨 颜色对比度工具函数
 * 基于 WCAG 2.0 标准计算颜色对比度，自动选择合适的前景色
 */

// 将十六进制颜色转换为 RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
      }
    : null;
}

// 计算相对亮度 (Relative Luminance)
// 基于 WCAG 2.0 公式: https://www.w3.org/TR/WCAG20/#relativeluminancedef
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// 计算对比度 (Contrast Ratio)
// 基于 WCAG 2.0 公式: https://www.w3.org/TR/WCAG20/#contrast-ratiodef
function getContrastRatio(rgb1: { r: number; g: number; b: number }, rgb2: { r: number; g: number; b: number }): number {
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

// 判断背景色是否为深色
function isDarkBackground(bgColor: string): boolean {
  const rgb = hexToRgb(bgColor);
  if (!rgb) return false;
  
  const luminance = getLuminance(rgb.r, rgb.g, rgb.b);
  return luminance < 0.5; // 亮度小于 0.5 判定为深色背景
}

// 根据背景色自动选择最佳文字颜色（黑色或白色）
// 确保对比度 >= 4.5:1 (WCAG AA 标准)
function getAdaptiveTextColor(bgColor: string): string {
  const rgb = hexToRgb(bgColor);
  if (!rgb) return '#000000';
  
  const whiteRgb = { r: 255, g: 255, b: 255 };
  const blackRgb = { r: 0, g: 0, b: 0 };
  
  const whiteContrast = getContrastRatio(rgb, whiteRgb);
  const blackContrast = getContrastRatio(rgb, blackRgb);
  
  // 选择对比度更高的颜色
  return whiteContrast > blackContrast ? '#ffffff' : '#000000';
}

// 根据背景色生成半透明的自适应颜色（用于按钮等元素）
function getAdaptiveOverlayColor(bgColor: string, opacity: number = 0.2): string {
  const isDark = isDarkBackground(bgColor);
  const baseColor = isDark ? '255, 255, 255' : '0, 0, 0';
  return `rgba(${baseColor}, ${opacity})`;
}

// 根据背景色生成边框颜色
function getAdaptiveBorderColor(bgColor: string, opacity: number = 0.2): string {
  const isDark = isDarkBackground(bgColor);
  const baseColor = isDark ? '255, 255, 255' : '0, 0, 0';
  return `rgba(${baseColor}, ${opacity})`;
}

interface DesktopSettings {
  // 窗口设置
  position: { x: number; y: number };
  size: { width: number; height: number };
  isLocked: boolean;
  
  // 外观设置
  backgroundColor: string;
  backgroundOpacity: number;
  
  // 日历视图设置（现在用 CalendarSettings 管理其他设置）
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
  const calendarRef = useRef<ToastUIReactCalendarType>(null);
  
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
  
  // 生成日历列表（用于日历设置面板）
  const calendars = useMemo(() => createCalendarsFromTags(tags), [tags]);
  
  // 🎨 计算自适应颜色（基于背景色，使用 useMemo 缓存）
  const adaptiveColors = useMemo(() => {
    const bgColor = settings.backgroundColor;
    return {
      textColor: getAdaptiveTextColor(bgColor),
      overlayLight: getAdaptiveOverlayColor(bgColor, 0.2),
      overlayMedium: getAdaptiveOverlayColor(bgColor, 0.3),
      overlayHeavy: getAdaptiveOverlayColor(bgColor, 0.4),
      borderColor: getAdaptiveBorderColor(bgColor, 0.2),
      borderColorMedium: getAdaptiveBorderColor(bgColor, 0.3),
      isDark: isDarkBackground(bgColor)
    };
  }, [settings.backgroundColor]);
  
  // 日历设置状态
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>(() => {
    try {
      const saved = localStorage.getItem('desktop-calendar-settings-full');
      if (saved) {
        const settings = JSON.parse(saved);
        // 确保新标签和日历被包含
        const allTagIds = tags.map(tag => tag.id);
        const allCalendarIds = createCalendarsFromTags(tags).map(cal => cal.id);
        
        return {
          ...settings,
          visibleTags: settings.visibleTags || allTagIds,
          visibleCalendars: settings.visibleCalendars || allCalendarIds
        };
      }
    } catch (error) {
      console.error('Failed to load calendar settings:', error);
    }
    // 默认显示所有标签和日历
    const allTagIds = tags.map(tag => tag.id);
    const allCalendarIds = createCalendarsFromTags(tags).map(cal => cal.id);
    
    return {
      eventOpacity: 85,
      visibleTags: allTagIds,
      visibleCalendars: allCalendarIds,
      showMilestone: true,
      showTask: true,
      showAllDay: true,
      milestoneHeight: 24,
      taskHeight: 20,
      allDayHeight: 18
    };
  });
  
  // 拖拽和缩放引用
  const dragStartRef = useRef({ x: 0, y: 0, windowX: 0, windowY: 0 });
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, height: 0 });

  // 当标签或日历发生变化时，更新 CalendarSettings 的可见列表
  useEffect(() => {
    const allTagIds = tags.map(tag => tag.id);
    const allCalendarIds = calendars.map(cal => cal.id);
    
    // 更新 visibleTags 和 visibleCalendars，包含新的标签/日历，保留现有选择
    setCalendarSettings(prev => {
      const newVisibleTags = Array.from(new Set([...prev.visibleTags, ...allTagIds]));
      const newVisibleCalendars = Array.from(new Set([...prev.visibleCalendars, ...allCalendarIds]));
      
      return {
        ...prev,
        visibleTags: newVisibleTags,
        visibleCalendars: newVisibleCalendars
      };
    });
  }, [tags, calendars]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        console.log('🔧 ESC 键按下');
        if (showSettings) {
          console.log('🔧 ESC 键关闭设置面板');
          setShowSettings(false);
        }
        if (showTagFilters) {
          setShowTagFilters(false);
        }
        // 关闭所有下拉菜单
        setShowCreateMenu(false);
        setShowSyncMenu(false);
        setShowViewMenu(false);
        setShowMoreMenu(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showSettings, showTagFilters]);

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
      
      // 强制更新DOM样式
      setTimeout(() => {
        const element = document.querySelector('.desktop-time-calendar') as HTMLElement;
        if (element) {
          const bgColor = updated.backgroundColor || settings.backgroundColor;
          const opacity = updated.backgroundOpacity !== undefined ? updated.backgroundOpacity : settings.backgroundOpacity;
          const alpha = Math.round(opacity * 255).toString(16).padStart(2, '0');
          
          element.style.backgroundColor = `${bgColor}${alpha}`;
          element.style.backdropFilter = opacity < 1 ? 'blur(10px)' : 'none';
          
          if (window.electronAPI?.debugLog) {
            window.electronAPI.debugLog('样式更新', {
              backgroundColor: `${bgColor}${alpha}`,
              backdropFilter: opacity < 1 ? 'blur(10px)' : 'none'
            });
          }
        }
      }, 100);
    }
  }, [settings]);

  // 处理日历设置变更
  const handleCalendarSettingsChange = useCallback((newSettings: CalendarSettings) => {
    setCalendarSettings(newSettings);
    localStorage.setItem('desktop-calendar-settings-full', JSON.stringify(newSettings));
    console.log('🔧 日历设置已更新:', newSettings);
  }, []);

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

  // 转换事件格式，应用完整过滤逻辑
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // 标签筛选
    const tagsToFilter = selectedTags.length > 0 ? selectedTags : calendarSettings.visibleTags;
    if (tagsToFilter.length > 0) {
      filtered = filtered.filter(event => 
        event.tags && event.tags.some(tagId => tagsToFilter.includes(tagId))
      );
    }

    // 日历分组筛选
    if (calendarSettings.visibleCalendars.length > 0) {
      filtered = filtered.filter(event => 
        calendarSettings.visibleCalendars.includes(event.calendarId || '')
      );
    }

    // 事件类型筛选
    filtered = filtered.filter(event => {
      if (event.isAllDay && !calendarSettings.showAllDay) return false;
      // TODO: 添加 Milestone 和 Task 的筛选逻辑
      return true;
    });

    return filtered;
  }, [events, selectedTags, calendarSettings]);

  const calendarEvents = filteredEvents.map(event => convertToCalendarEvent(event, tags));

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
          borderRadius: '12px 12px 0 0',
          // 🎨 深色背景时添加边框和阴影以突出标题栏
          boxShadow: adaptiveColors.isDark ? '0 2px 8px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)' : 'none',
          borderBottom: adaptiveColors.isDark ? '1px solid rgba(255,255,255,0.15)' : 'none'
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

      {/* 设置面板背景遮罩 */}
      {showSettings && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            zIndex: 10000
          }}
          onClick={() => {
            console.log('🔧 点击遮罩关闭设置');
            setShowSettings(false);
          }}
        />
      )}

      {/* 完整日历设置面板 */}
      <CalendarSettingsPanel
        isOpen={showSettings}
        onClose={() => {
          console.log('🔧 关闭日历设置面板');
          setShowSettings(false);
        }}
        settings={calendarSettings}
        onSettingsChange={handleCalendarSettingsChange}
        availableTags={tags}
        availableCalendars={calendars}
      />

      {/* 标签过滤面板 */}
      {showTagFilters && (
        <div style={{
          padding: '8px 12px',
          backgroundColor: adaptiveColors.overlayLight, // 🎨 自适应背景
          borderBottom: `1px solid ${adaptiveColors.borderColor}`,
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          alignItems: 'center',
          fontSize: '12px'
        }}>
          <span style={{ 
            color: adaptiveColors.textColor, // 🎨 自适应文字颜色
            marginRight: '8px', 
            fontWeight: '600',
            opacity: 0.8
          }}>
            🏷️ 标签过滤:
          </span>
          
          {tags.length > 0 ? (
            <>
              <button
                onClick={() => setSelectedTags([])}
                style={{
                  padding: '3px 8px',
                  fontSize: '11px',
                  backgroundColor: selectedTags.length === 0 ? '#007bff' : 'transparent',
                  color: selectedTags.length === 0 ? 'white' : adaptiveColors.textColor,
                  border: `1px solid ${selectedTags.length === 0 ? '#007bff' : adaptiveColors.borderColor}`,
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
            <span style={{ 
              color: adaptiveColors.textColor, // 🎨 自适应文字颜色
              fontStyle: 'italic',
              opacity: 0.6
            }}>
              暂无标签
            </span>
          )}
          
          <button
            onClick={() => setShowTagFilters(false)}
            style={{
              padding: '2px 6px',
              fontSize: '11px',
              backgroundColor: 'transparent',
              color: adaptiveColors.textColor, // 🎨 自适应文字颜色
              border: `1px solid ${adaptiveColors.borderColor}`,
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
          backgroundColor: settings.backgroundColor, // 🔧 修复：跟随设置的背景色
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
              border: `1px solid ${adaptiveColors.borderColor}`, // 🎨 自适应边框
              backgroundColor: settings.backgroundColor, // 🎨 跟随背景色
              holiday: { color: adaptiveColors.isDark ? '#ff6b6b' : '#ff4040' }, // 🎨 假日颜色
              saturday: { color: adaptiveColors.textColor }, // 🎨 自适应文字颜色
              dayName: { color: adaptiveColors.textColor } // 🎨 自适应文字颜色
            },
            // 🎨 月视图主题
            month: {
              dayName: {
                borderBottom: `1px solid ${adaptiveColors.borderColor}`,
                backgroundColor: adaptiveColors.overlayLight
              }
            },
            // 🎨 周视图主题
            week: {
              today: {
                color: adaptiveColors.isDark ? '#60a5fa' : '#3b82f6' // 蓝色高亮
              },
              dayName: {
                borderBottom: `1px solid ${adaptiveColors.borderColor}`,
                backgroundColor: adaptiveColors.overlayLight
              },
              pastDay: {
                color: adaptiveColors.isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'
              }
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
            microsoftService={microsoftService}
            availableCalendars={(() => {
              try {
                const cached = localStorage.getItem('remarkable-calendars-cache');
                return cached ? JSON.parse(cached) : [];
              } catch (e) {
                return [];
              }
            })()}
          />
        </div>
      )}
    </div>
  );
};

export default DesktopTimeCalendar;
