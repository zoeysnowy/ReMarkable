/**
 * TimeCalendar Component - 时光日历
 * 
 * 使用 TUI Calendar 实现的时光日历组件
 * 支持与 Outlook 的双向实时同步
 * 
 * @charset UTF-8
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react';
import ToastUIReactCalendar, { ToastUIReactCalendarType } from './ToastUIReactCalendar';
import { EventEditModal } from './EventEditModal';
import CalendarSettingsPanel, { CalendarSettings } from './CalendarSettingsPanel';
import type { EventObject } from '@toast-ui/calendar';
import '@toast-ui/calendar/dist/toastui-calendar.css';
import '../styles/calendar.css'; // 🎨 ReMarkable 自定义样式
import { Event } from '../types';
import { TagService } from '../services/TagService';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import { 
  convertToCalendarEvent, 
  convertFromCalendarEvent,
  createCalendarsFromTags,
  flattenTags,
  validateEvent,
  mergeEventUpdates,
  getCalendarGroupColor,
  getAvailableCalendarsForSettings
} from '../utils/calendarUtils';

interface TimeCalendarProps {
  onStartTimer: (taskTitle: string) => void;
  microsoftService?: MicrosoftCalendarService;
  syncManager?: any; // ActionBasedSyncManager instance
  lastSyncTime?: Date | null;
  availableTags?: any[]; // 🆕 添加：可用标签列表
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    startTime: number;
    originalStartTime: number;
    elapsedTime: number;
  } | null; // 🆕 添加：当前运行的计时器状态
  className?: string; // 🆕 添加：CSS类名支持
  style?: React.CSSProperties; // 🆕 添加：内联样式支持
  isWidgetMode?: boolean; // 🆕 添加：是否在 widget 模式下（隐藏悬浮窗按钮）
  storageKey?: string; // 🆕 添加：自定义存储key（用于多实例隔离）
  calendarBackgroundColor?: string; // 🆕 日历背景颜色（用于三个矩形）
  calendarOpacity?: number; // 🆕 日历透明度（0-1）
  // Widget 控制回调（仅在 widget 模式下使用）
  onWidgetOpacityChange?: (opacity: number) => void;
  onWidgetColorChange?: (color: string) => void;
  onWidgetLockToggle?: (locked: boolean) => void;
  widgetLocked?: boolean; // Widget 锁定状态
}

export const TimeCalendar: React.FC<TimeCalendarProps> = ({
  onStartTimer,
  microsoftService,
  syncManager,
  lastSyncTime,
  availableTags = [],
  globalTimer,
  className = '',
  style = {},
  isWidgetMode = false,
  storageKey = 'remarkable-calendar-settings', // 默认key
  calendarBackgroundColor = '#ffffff', // 默认白色
  calendarOpacity = 0.95, // 默认95%不透明度
  onWidgetOpacityChange,
  onWidgetColorChange,
  onWidgetLockToggle,
  widgetLocked = false
}) => {
  // ⏱️ 组件挂载性能监控
  const mountTimeRef = useRef(performance.now());
  useEffect(() => {
    const mountDuration = performance.now() - mountTimeRef.current;
    console.log(`✅ [TimeCalendar] Component mounted in ${mountDuration.toFixed(2)}ms`);
    
    // 🔍 调试：组件挂载后检查 localStorage
    console.log('🔍 [组件挂载后] storageKey:', storageKey);
    const savedAfterMount = localStorage.getItem(storageKey);
    console.log('🔍 [组件挂载后] localStorage 中的值:', savedAfterMount);
    if (savedAfterMount) {
      const parsed = JSON.parse(savedAfterMount);
      console.log('🔍 [组件挂载后] 解析后的高度:', {
        task: parsed.taskHeight,
        allDay: parsed.allDayHeight,
        milestone: parsed.milestoneHeight
      });
    }
  }, [storageKey]);
  
  // 🔍 渲染计数器
  const renderCountRef = useRef(0);
  const renderStartRef = useRef(performance.now());
  renderCountRef.current++;
  renderStartRef.current = performance.now();
  
  // 只在前3次渲染时打印日志
  if (renderCountRef.current <= 3) {
    console.log(`📊 [TimeCalendar] Render #${renderCountRef.current} started`);
  }
  
  // 🎨 转换背景色为 rgba
  const hexToRgb = (hex: string) => {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);
    return { r, g, b };
  };
  const { r, g, b } = hexToRgb(calendarBackgroundColor);
  const bgRgba = `rgba(${r}, ${g}, ${b}, ${calendarOpacity})`;
  
  // 🎨 颜色自适应系统：根据背景色明暗度生成适配的颜色
  const getAdaptiveColors = useMemo(() => {
    // 计算亮度 (0-255)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
    const isDark = luminance < 128;
    
    return {
      isDark,
      // 文字颜色
      textPrimary: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.87)',
      textSecondary: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
      textDisabled: isDark ? 'rgba(255,255,255,0.38)' : 'rgba(0,0,0,0.38)',
      
      // 边框颜色
      borderLight: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)',
      borderMedium: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)',
      
      // 背景色变体
      bgOverlay: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)',
      bgHover: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
      
      // 高亮色（今天、选中等）
      accentColor: isDark ? '#60a5fa' : '#667eea',
      accentLight: isDark ? 'rgba(96,165,250,0.15)' : 'rgba(102,126,234,0.1)',
      
      // 特殊日期颜色
      holiday: isDark ? '#ff6b6b' : '#ff4040',
      weekend: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(102,126,234,0.02)',
    };
  }, [r, g, b]);
  
  const calendarRef = useRef<ToastUIReactCalendarType>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [hierarchicalTags, setHierarchicalTags] = useState<any[]>([]);
  
  // 🎯 使用lazy initialization恢复上次查看的日期
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    try {
      const saved = localStorage.getItem('remarkable-calendar-current-date');
      if (saved) {
        const savedDate = new Date(saved);
        if (!isNaN(savedDate.getTime())) {
          console.log(`📅 [INIT] Restored last viewed date: ${savedDate.toLocaleDateString()}`);
          return savedDate;
        }
      }
    } catch (error) {
      console.error('❌ Failed to restore current date:', error);
    }
    console.log(`📅 [INIT] Using today's date`);
    return new Date();
  });
  
  // 🎯 使用lazy initialization同步加载设置，避免初始渲染闪烁
  const [currentView, setCurrentView] = useState<'month' | 'week' | 'day'>(() => {
    try {
      const saved = localStorage.getItem('remarkable-calendar-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        return settings.view || 'month';
      }
    } catch (error) {
      console.error('❌ Failed to load initial view:', error);
    }
    return 'month';
  });
  
  // ✏️ 事件编辑弹窗状态
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);

  // 📅 可用日历状态
  const [availableCalendars, setAvailableCalendars] = useState<any[]>([]);

  // 🔄 监听 localStorage 中的 globalTimer 变化（用于 Widget 实时更新）
  const [localStorageTimerTrigger, setLocalStorageTimerTrigger] = useState(0);
  const lastTimerStateRef = useRef<string | null>(null);
  const lastEventsStateRef = useRef<string | null>(null); // 🆕 用于跟踪events变化
  
  // 🔄 定期检查 localStorage（Widget 场景的备用方案）
  // 因为 Electron 中 storage 事件可能不稳定，使用轮询确保同步
  useEffect(() => {
    if (!globalTimer) { // 只在 Widget 场景（没有 prop）时轮询
      console.log('🔄 [TIMER] Starting localStorage polling for Widget (focusing on events)');
      
      const checkTimer = () => {
        const eventsData = localStorage.getItem('remarkable-events');
        const timerState = localStorage.getItem('remarkable-global-timer');
        
        // 🎯 主要关注事件数据变化（这里有timer的实际更新）
        if (eventsData !== lastEventsStateRef.current) {
          console.log('🔍 [TIMER] Events data changed - timer may have updated');
          lastEventsStateRef.current = eventsData;
          setLocalStorageTimerTrigger(prev => prev + 1);
        }
        
        // 🔄 同时检查timer状态变化（作为补充）
        if (timerState !== lastTimerStateRef.current) {
          console.log('🔍 [TIMER] Timer state changed:', {
            old: lastTimerStateRef.current,
            new: timerState
          });
          lastTimerStateRef.current = timerState;
          setLocalStorageTimerTrigger(prev => prev + 1);
        }
      };
      
      // 立即检查一次
      checkTimer();
      
      // 每2秒检查一次
      const interval = setInterval(checkTimer, 2000);
      
      return () => {
        console.log('🔄 [TIMER] Stopping localStorage polling');
        clearInterval(interval);
      };
    }
  }, [globalTimer]); // 依赖 globalTimer，确保主应用不会启动轮询
  
  // 🎧 监听跨窗口的 storage 事件（作为补充）
  useEffect(() => {
    console.log('🎧 [TIMER] Setting up storage event listener');
    
    const handleStorageChange = (e: StorageEvent) => {
      console.log('📡 [TIMER] Storage event detected:', {
        key: e.key,
        newValue: e.newValue,
        oldValue: e.oldValue
      });
      
      if (e.key === 'remarkable-global-timer') {
        console.log('🔄 [TIMER] Timer storage changed via event, triggering recalculation');
        lastTimerStateRef.current = e.newValue;
        setLocalStorageTimerTrigger(prev => prev + 1);
      }
    };
    
    // ✅ 注册事件监听器
    window.addEventListener('storage', handleStorageChange);
    
    // ✅ 清理函数
    return () => {
      console.log('🎧 [TIMER] Removing storage event listener');
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // ⚙️ 设置面板状态
  const [showSettings, setShowSettings] = useState(false);
  const [calendarSettings, setCalendarSettings] = useState<CalendarSettings>(() => {
    console.log('🔍 [初始化] storageKey:', storageKey);
    try {
      const saved = localStorage.getItem(storageKey);
      console.log('🔍 [初始化] localStorage 原始值:', saved);
      
      if (saved) {
        const settings = JSON.parse(saved);
        console.log('🔍 [初始化] 解析后的设置:', settings);
        
        const initialSettings = {
          eventOpacity: settings.eventOpacity ?? 85,
          visibleTags: settings.visibleTags || [],
          visibleCalendars: settings.visibleCalendars || [],
          showMilestone: settings.showMilestone !== false,
          showTask: settings.showTask !== false,
          showAllDay: settings.showAllDay !== false,
          milestoneHeight: settings.milestoneHeight || 24,
          taskHeight: settings.taskHeight || 24,
          allDayHeight: settings.allDayHeight || 24
        };
        console.log('🔍 [初始化] 最终使用的设置:', initialSettings);
        return initialSettings;
      }
    } catch (error) {
      console.error('❌ Failed to load initial settings:', error);
    }
    
    const defaultSettings = {
      eventOpacity: 85,
      visibleTags: [],
      visibleCalendars: [],
      showMilestone: true,
      showTask: true,
      showAllDay: true,
      milestoneHeight: 24,
      taskHeight: 24,
      allDayHeight: 24
    };
    console.log('🔍 [初始化] 使用默认设置:', defaultSettings);
    return defaultSettings;
  });

  // 📏 使用 ref 保存最新的高度设置，供 useLayoutEffect 使用
  const heightSettingsRef = useRef({
    taskHeight: calendarSettings.taskHeight,
    allDayHeight: calendarSettings.allDayHeight,
    milestoneHeight: calendarSettings.milestoneHeight
  });

  // 🎨 跟踪是否是初始加载（用于决定是否使用 !important）
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // 更新 ref 当高度变化时
  useEffect(() => {
    console.log('🔍 [ref更新] 高度变化:', {
      task: calendarSettings.taskHeight,
      allDay: calendarSettings.allDayHeight,
      milestone: calendarSettings.milestoneHeight
    });
    
    heightSettingsRef.current = {
      taskHeight: calendarSettings.taskHeight,
      allDayHeight: calendarSettings.allDayHeight,
      milestoneHeight: calendarSettings.milestoneHeight
    };
  }, [calendarSettings.taskHeight, calendarSettings.allDayHeight, calendarSettings.milestoneHeight]);


  //  从 localStorage 加载事件数据
  const loadEvents = useCallback(() => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents);
        console.log(`📅 [LOAD] Loading ${parsedEvents.length} events from localStorage`);
        
        // 🔍 调试：查找timer事件
        const timerEvents = parsedEvents.filter((e: any) => e.id && e.id.includes('timer-'));
        if (timerEvents.length > 0) {
          console.log('🔍 [TIMER EVENTS] Found timer events:', timerEvents.map((e: any) => ({ 
            id: e.id, 
            title: e.title, 
            syncStatus: e.syncStatus,
            isTimer: e.isTimer 
          })));
        } else {
          console.log('⚠️ [TIMER EVENTS] No timer events found in localStorage');
        }
        
        setEvents(parsedEvents);
      }
    } catch (error) {
      console.error('❌ [LOAD] Failed to load events:', error);
    }
  }, []);

  // 🏷️ 从 localStorage 加载标签数据
  const loadHierarchicalTags = useCallback(() => {
    try {
      const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
      if (savedTags && Array.isArray(savedTags)) {
        setHierarchicalTags(savedTags);
        console.log(`📥 [LOAD] Loading ${savedTags.length} tags`);
      }
    } catch (error) {
      console.error('❌ [LOAD] Failed to load tags:', error);
    }
  }, []);

  // ⚙️ 验证并清理筛选设置
  const validateAndCleanSettings = useCallback((settings: CalendarSettings) => {
    // 获取当前有效的标签ID和日历ID
    const validTagIds = new Set(flattenTags(hierarchicalTags).map(tag => tag.id));
    const validCalendarIds = new Set<string>();
    
    // ✅ 添加特殊选项ID到有效集合中
    validTagIds.add('no-tag'); // 特殊标签：未定义标签
    
    try {
      const calendarsCache = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
      if (calendarsCache) {
        const calendars = JSON.parse(calendarsCache);
        calendars.forEach((cal: any) => validCalendarIds.add(cal.id));
      }
    } catch (error) {
      console.warn('⚠️ Failed to load calendar cache:', error);
    }
    
    // ✅ 添加特殊日历选项ID到有效集合中
    validCalendarIds.add('local-created'); // 特殊日历：创建自本地
    validCalendarIds.add('not-synced');    // 特殊日历：未同步至日历

    // 过滤出有效的标签和日历ID
    let validVisibleTags = (settings.visibleTags || []).filter(id => validTagIds.has(id));
    let validVisibleCalendars = (settings.visibleCalendars || []).filter(id => validCalendarIds.has(id));

    // 检查是否有无效的ID被移除
    const invalidTagsRemoved = (settings.visibleTags?.length || 0) - validVisibleTags.length;
    const invalidCalendarsRemoved = (settings.visibleCalendars?.length || 0) - validVisibleCalendars.length;

    if (invalidTagsRemoved > 0 || invalidCalendarsRemoved > 0) {
      console.warn(`🧹 [TimeCalendar] Cleaned invalid filters: ${invalidTagsRemoved} tags, ${invalidCalendarsRemoved} calendars`);
      
      // ✅ 核心修复：如果清理后有效标签太少（< 2个），直接清空筛选，避免无意义的筛选
      if (validVisibleTags.length > 0 && validVisibleTags.length < 2) {
        console.log('✅ [TimeCalendar] Too few valid tags after cleanup, clearing tag filter');
        validVisibleTags = [];
      }
      
      // 如果清理后筛选列表为空，说明所有之前保存的ID都无效了
      if (settings.visibleTags && settings.visibleTags.length > 0 && validVisibleTags.length === 0) {
        console.log('✅ [TimeCalendar] All saved tag filters are invalid, clearing tag filter');
      }
      if (settings.visibleCalendars && settings.visibleCalendars.length > 0 && validVisibleCalendars.length === 0) {
        console.log('✅ [TimeCalendar] All saved calendar filters are invalid, clearing calendar filter');
      }
    }

    return {
      ...settings,
      visibleTags: validVisibleTags,
      visibleCalendars: validVisibleCalendars
    };
  }, [hierarchicalTags]);

  // ⚙️ 验证并清理已加载的设置（只在标签加载完成后执行一次）
  const validateSettings = useCallback(() => {
    try {
      const saved = localStorage.getItem('remarkable-calendar-settings');
      if (saved) {
        const settings = JSON.parse(saved);
        
        // 验证并清理筛选设置
        const cleanedSettings = validateAndCleanSettings(settings);
        
        // 如果设置被清理过，更新state并保存
        if (cleanedSettings.visibleTags.length !== settings.visibleTags?.length || 
            cleanedSettings.visibleCalendars.length !== settings.visibleCalendars?.length) {
          console.log('🧹 [TimeCalendar] Cleaning invalid filters');
          setCalendarSettings(prev => ({
            ...prev,
            visibleTags: cleanedSettings.visibleTags,
            visibleCalendars: cleanedSettings.visibleCalendars
          }));
          saveSettings({...calendarSettings, ...cleanedSettings});
        }
      }
    } catch (error) {
      console.error('❌ [TimeCalendar] Failed to validate settings:', error);
    }
  }, [hierarchicalTags, validateAndCleanSettings, calendarSettings]); // 添加依赖

  // 💾 保存设置到 localStorage
  const saveSettings = useCallback((settings: CalendarSettings, view?: string) => {
    try {
      const settingsToSave = {
        ...settings,
        view: view || currentView
      };
      console.log('� [保存] storageKey:', storageKey);
      console.log('🔍 [保存] 保存的设置:', settingsToSave);
      console.log('🔍 [保存] 高度值:', {
        task: settingsToSave.taskHeight,
        allDay: settingsToSave.allDayHeight,
        milestone: settingsToSave.milestoneHeight
      });
      
      localStorage.setItem(storageKey, JSON.stringify(settingsToSave));
      
      // 验证保存成功
      const verified = localStorage.getItem(storageKey);
      console.log('🔍 [保存验证] localStorage 中的值:', verified);
    } catch (error) {
      console.error('❌ [TimeCalendar] Failed to save settings:', error);
    }
  }, [storageKey, currentView]);

  // 🔄 自动保存 calendarSettings 的变化（包括高度调整）
  useEffect(() => {
    console.log('🔍 [自动保存] calendarSettings 变化，触发保存');
    saveSettings(calendarSettings);
  }, [calendarSettings, saveSettings]);

  // 🔄 监听同步完成事件 - 改进为增量更新机制
  const initialSyncCompletedRef = useRef(false);
  const eventsLoadedRef = useRef(false);
  const eventListenersAttachedRef = useRef(false); // ✅ 防止重复绑定事件监听器
  const isSyncingRef = useRef(false); // ✅ 防止同步期间响应 local-events-changed
  
  useEffect(() => {
    // ✅ 防止重复绑定事件监听器
    if (eventListenersAttachedRef.current) {
      console.log('⚠️ [EVENT] Event listeners already attached, skipping');
      return;
    }

    console.log('🎧 [EVENT] Attaching event listeners');
    let syncDebounceTimer: NodeJS.Timeout | null = null;

    const handleSyncCompleted = () => {
      // ✅ 同步完成后，重新加载事件以显示最新数据
      console.log('🔄 [SYNC] Sync completed, reloading events to update UI');
      
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
      }
      
      syncDebounceTimer = setTimeout(() => {
        loadEvents();
        
        // 标记初始同步完成
        if (!initialSyncCompletedRef.current) {
          initialSyncCompletedRef.current = true;
          console.log('✅ [SYNC] Initial sync completed');
        }
        
        isSyncingRef.current = false; // ✅ 同步完成
      }, isWidgetMode ? 100 : 500); // Widget模式下减少延迟，提高实时性
    };

    const handleSyncStarted = () => {
      // ✅ 同步开始时设置标志
      isSyncingRef.current = true;
      console.log('🔄 [SYNC] Sync started, will ignore local-events-changed');
    };

    const handleLocalEventsChanged = (event: unknown) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      
      // ✅ 如果正在同步，忽略事件变化（防止无限循环）
      if (isSyncingRef.current) {
        console.log('⏭️ [EVENT] Ignoring during sync:', detail?.action || 'unknown');
        return;
      }
      
      console.log('🔄 [EVENT] Local events changed:', detail?.action || 'unknown');
      
      // ✅ 优化防抖处理：Widget模式下使用更短的延迟
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
      }
      
      syncDebounceTimer = setTimeout(() => {
        loadEvents();
      }, isWidgetMode ? 100 : 300); // Widget模式下减少延迟，提高实时性
    };

    const handleEventsUpdated = (event: unknown) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;
      
      console.log('🔄 [EVENT] Events updated:', detail?.eventId || 'unknown', detail);
      
      // ⚡ Timer 事件立即更新，跳过防抖
      if (detail?.isTimerEvent) {
        console.log('⚡ [EVENT] Timer event detected, updating immediately');
        loadEvents();
        return;
      }
      
      // ✅ 优化防抖处理：Widget模式下使用更短的延迟
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
      }
      
      syncDebounceTimer = setTimeout(() => {
        loadEvents();
      }, isWidgetMode ? 100 : 300); // Widget模式下减少延迟，提高实时性
    };

    window.addEventListener('action-sync-started', handleSyncStarted as any);
    window.addEventListener('action-sync-completed', handleSyncCompleted);
    // ❌ 移除：outlook-sync-completed 已经不再使用
    // window.addEventListener('outlook-sync-completed', handleSyncCompleted);
    window.addEventListener('local-events-changed', handleLocalEventsChanged as any);
    window.addEventListener('eventsUpdated', handleEventsUpdated as any);
    
    eventListenersAttachedRef.current = true;

    // 初始加载 - 从缓存加载，确保离线可用（只加载一次）
    if (!eventsLoadedRef.current) {
      console.log('� [INIT] Initial loading events from cache');
      loadEvents();
      loadHierarchicalTags();
      eventsLoadedRef.current = true;
    }

    return () => {
      console.log('🎧 [EVENT] Removing event listeners');
      if (syncDebounceTimer) {
        clearTimeout(syncDebounceTimer);
      }
      window.removeEventListener('action-sync-started', handleSyncStarted as any);
      window.removeEventListener('action-sync-completed', handleSyncCompleted);
      // ❌ 移除：outlook-sync-completed 已经不再使用
      // window.removeEventListener('outlook-sync-completed', handleSyncCompleted);
      window.removeEventListener('local-events-changed', handleLocalEventsChanged as any);
      window.removeEventListener('eventsUpdated', handleEventsUpdated as any);
      eventListenersAttachedRef.current = false;
    };
  }, [loadEvents, loadHierarchicalTags]); // 移除状态依赖，只依赖稳定的回调

  // � Widget专用：当timer状态变化时，强制重新加载events
  // 确保Widget能看到新创建的timer事件
  useEffect(() => {
    if (!globalTimer) { // 只在Widget模式下生效（Widget不会传递globalTimer prop）
      console.log('🔄 [WIDGET TIMER] Timer state changed, reloading events for Widget');
      loadEvents();
    }
  }, [localStorageTimerTrigger, globalTimer, loadEvents]);

  // �📋 加载可用日历列表
  useEffect(() => {
    // 🔧 Widget 模式下跳过日历加载（Widget 从 localStorage 读取数据）
    if (isWidgetMode) {
      console.log('📋 [CALENDAR] Widget mode - skipping calendar loading');
      setAvailableCalendars([]);
      return;
    }
    
    const loadCalendars = async () => {
      if (!microsoftService) {
        console.log('📋 [CALENDAR] Microsoft service not available, skipping calendar loading');
        setAvailableCalendars([]);
        return;
      }

      try {
        console.log('📋 [CALENDAR] Loading available calendars...');
        const calendars = await microsoftService.getAllCalendars();
        setAvailableCalendars(calendars);
        console.log('📋 [CALENDAR] Loaded calendars:', calendars.length);
      } catch (error) {
        console.error('❌ [CALENDAR] Failed to load calendars:', error);
        setAvailableCalendars([]);
      }
    };

    loadCalendars();
  }, [microsoftService, isWidgetMode]); // 添加 isWidgetMode 依赖

  // ⚙️ 验证设置（只在标签加载完成后执行一次）
  const [settingsValidated, setSettingsValidated] = useState(false);
  useEffect(() => {
    if (!settingsValidated && hierarchicalTags.length > 0) {
      validateSettings();
      setSettingsValidated(true);
    }
  }, [hierarchicalTags.length, settingsValidated]); // ✅ 移除validateSettings依赖，避免重复触发

  // 🆕 自动添加新标签到 visibleTags（确保新建标签默认勾选）
  const previousTagIdsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (hierarchicalTags.length === 0) return;
    
    // 获取当前所有标签ID
    const currentTagIds = new Set(flattenTags(hierarchicalTags).map(tag => tag.id));
    
    // 找出新增的标签
    const newTagIds = Array.from(currentTagIds).filter(id => !previousTagIdsRef.current.has(id));
    
    if (newTagIds.length > 0) {
      console.log('🆕 [TimeCalendar] Detected new tags:', newTagIds);
      
      // 如果当前有筛选（visibleTags不为空），则将新标签添加到筛选中
      if (calendarSettings.visibleTags.length > 0) {
        const updatedVisibleTags = [...calendarSettings.visibleTags, ...newTagIds];
        console.log('✅ [TimeCalendar] Auto-adding new tags to filter:', newTagIds);
        
        setCalendarSettings(prev => ({
          ...prev,
          visibleTags: updatedVisibleTags
        }));
        
        saveSettings({
          ...calendarSettings,
          visibleTags: updatedVisibleTags
        });
      } else {
        // 如果当前没有筛选（显示所有标签），保持不变
        console.log('ℹ️ [TimeCalendar] No filter active, new tags will be visible automatically');
      }
    }
    
    // 更新上次的标签ID集合
    previousTagIdsRef.current = currentTagIds;
  }, [hierarchicalTags, calendarSettings, saveSettings]);

  // 📅 持久化当前查看的日期
  useEffect(() => {
    try {
      localStorage.setItem('remarkable-calendar-current-date', currentDate.toISOString());
      console.log(`💾 [SAVE] Saved current date: ${currentDate.toLocaleDateString()}`);
    } catch (error) {
      console.error('❌ Failed to save current date:', error);
    }
  }, [currentDate]);

  // 📅 初始化日历实例的日期（恢复上次查看的位置）
  const calendarInitializedRef = useRef(false);
  const [isCalendarReady, setIsCalendarReady] = useState(false);
  
  // 🔄 组件挂载时重置初始化标志，并准备恢复日期
  useEffect(() => {
    console.log(`📅 [MOUNT] TimeCalendar component mounted`);
    calendarInitializedRef.current = false;
    
    // 立即恢复日期到 state，这样日历渲染时就是正确的位置
    const savedDate = localStorage.getItem('remarkable-calendar-current-date');
    if (savedDate) {
      try {
        const restoredDate = new Date(savedDate);
        if (!isNaN(restoredDate.getTime())) {
          setCurrentDate(restoredDate);
          console.log(`📅 [MOUNT] Restored date to state: ${restoredDate.toLocaleDateString()}`);
        }
      } catch (error) {
        console.error('❌ Failed to restore date:', error);
      }
    }
    
    // 标记日历准备好渲染
    setIsCalendarReady(true);
    
    return () => {
      console.log(`📅 [UNMOUNT] TimeCalendar component unmounted`);
      setIsCalendarReady(false);
    };
  }, []); // 只在挂载/卸载时执行

  // 🎨 注入自适应样式 + Widget模式：强制移除 Toast UI Calendar 的内联背景色
  useEffect(() => {
    // Widget 模式下需要移除背景色
    if (isWidgetMode) {
      const removeInlineBackgroundColor = () => {
        // 选择所有 Toast UI Calendar 的 layout 容器
        const layouts = document.querySelectorAll('.toastui-calendar-layout');
        layouts.forEach(layout => {
          if (layout instanceof HTMLElement && layout.style.backgroundColor) {
            layout.style.backgroundColor = 'transparent';
          }
        });
        
        // 也处理 panel 容器
        const panels = document.querySelectorAll('.toastui-calendar-panel');
        panels.forEach(panel => {
          if (panel instanceof HTMLElement && panel.style.backgroundColor) {
            panel.style.backgroundColor = 'transparent';
          }
        });
      };

      // 初始执行
      removeInlineBackgroundColor();
    }
    
    // 🎨 注入动态样式：覆盖 Toast UI Calendar 的 today 样式（所有模式都需要）
    const styleId = 'timecalendar-adaptive-styles';
    let styleElement = document.getElementById(styleId) as HTMLStyleElement;
    
    if (!styleElement) {
      styleElement = document.createElement('style');
      styleElement.id = styleId;
      document.head.appendChild(styleElement);
    }
    
    // 动态生成 CSS，使用自适应颜色
    styleElement.textContent = `
      /* 🎨 TimeCalendar 自适应颜色覆盖 */
      .toastui-calendar .is-today {
        color: ${getAdaptiveColors.accentColor} !important;
        font-weight: 600 !important;
      }
      
      /* ===============================================
         🎨 控制栏按钮和导航自适应
         =============================================== */
      
      /* 控制栏背景 - 移除强制覆盖，让内联样式生效 */
      /* .toastui-calendar-controls 的背景由内联样式控制，不在此覆盖 */
      
      /* 视图控制容器 - 略低于按钮的实心度，无边框 */
      .toastui-calendar-view-controls {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.28)' 
          : 'rgba(255,255,255,0.35)'} !important;
        background-color: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.28)' 
          : 'rgba(255,255,255,0.35)'} !important;
        border: none !important;
        box-shadow: none !important;
      }
      
      /* 控制栏标题 - 使用渐变色（主应用）或纯色（Widget） */
      .toastui-calendar-title {
        ${isWidgetMode 
          ? `color: ${getAdaptiveColors.accentColor} !important;` 
          : `
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            color: transparent;
          `
        }
        font-weight: 600 !important;
        font-size: 16px !important;
        display: inline-block !important;
      }
      
      /* 导航按钮基础样式 - 更实心，透明度降低，无边框 */
      .toastui-calendar-nav-button {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.35)' 
          : 'rgba(255,255,255,0.45)'} !important;
        color: ${getAdaptiveColors.textPrimary} !important;
        border: none !important;
        transition: all 0.2s ease !important;
      }
      
      /* 导航按钮悬停 - 更实心 */
      .toastui-calendar-nav-button:hover {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.5)' 
          : 'rgba(255,255,255,0.6)'} !important;
        color: ${getAdaptiveColors.textPrimary} !important;
      }
      
      /* 导航按钮激活状态 - 高对比度，无边框 */
      .toastui-calendar-nav-button.active {
        background: ${getAdaptiveColors.accentColor} !important;
        color: white !important;
        border: none !important;
        font-weight: 600 !important;
        box-shadow: 0 2px 8px ${getAdaptiveColors.isDark 
          ? 'rgba(96,165,250,0.3)' 
          : 'rgba(102,126,234,0.3)'} !important;
      }
      
      /* 视图切换按钮基础样式 - 更实心，透明度降低，无边框 */
      .toastui-calendar-view-button {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.35)' 
          : 'rgba(255,255,255,0.45)'} !important;
        color: ${getAdaptiveColors.textPrimary} !important;
        border: none !important;
        transition: all 0.2s ease !important;
      }
      
      /* 视图按钮悬停 - 更实心 */
      .toastui-calendar-view-button:hover {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.5)' 
          : 'rgba(255,255,255,0.6)'} !important;
        color: ${getAdaptiveColors.textPrimary} !important;
      }
      
      /* 视图按钮激活状态 - 高对比度，无边框 */
      .toastui-calendar-view-button.active {
        background: ${getAdaptiveColors.accentColor} !important;
        color: white !important;
        border: none !important;
        font-weight: 600 !important;
        box-shadow: 0 2px 8px ${getAdaptiveColors.isDark 
          ? 'rgba(96,165,250,0.3)' 
          : 'rgba(102,126,234,0.3)'} !important;
      }
      
      /* 添加按钮 - 高对比度主色调 */
      .toastui-calendar-add-button {
        background: ${getAdaptiveColors.accentColor} !important;
        color: white !important;
        border: none !important;
        font-weight: bold !important;
        box-shadow: 0 2px 6px ${getAdaptiveColors.isDark 
          ? 'rgba(96,165,250,0.25)' 
          : 'rgba(102,126,234,0.25)'} !important;
      }
      
      /* 添加按钮悬停 - 加深效果 */
      .toastui-calendar-add-button:hover {
        background: ${getAdaptiveColors.isDark 
          ? '#5094ed' 
          : '#5568d3'} !important;
        transform: scale(1.05) !important;
        box-shadow: 0 4px 12px ${getAdaptiveColors.isDark 
          ? 'rgba(96,165,250,0.4)' 
          : 'rgba(102,126,234,0.4)'} !important;
      }
      
      /* 设置按钮 - 与其他按钮相同的实心度 */
      .toastui-calendar-nav-button[title*="设置"] {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.35)' 
          : 'rgba(255,255,255,0.45)'} !important;
      }
      
      .toastui-calendar-nav-button[title*="设置"]:hover {
        background: ${getAdaptiveColors.isDark 
          ? 'rgba(255,255,255,0.5)' 
          : 'rgba(255,255,255,0.6)'} !important;
      }
      
      /* ===============================================
         🎨 Toast UI Calendar 全局边框覆盖
         =============================================== */
      
      /* 主容器和面板 */
      .toastui-calendar,
      .toastui-calendar *,
      .toastui-calendar-panel {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 覆盖所有内联 border-right */
      .toastui-calendar [style*="border-right"],
      .toastui-calendar-column[style*="border-right"] {
        border-right-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 覆盖所有内联 border-bottom */
      .toastui-calendar [style*="border-bottom"] {
        border-bottom-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 覆盖所有内联 border-top */
      .toastui-calendar [style*="border-top"] {
        border-top-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 覆盖所有内联 border-left */
      .toastui-calendar [style*="border-left"] {
        border-left-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 星期导航条 - 完全透明背景 */
      .toastui-calendar-day-view-day-names,
      .toastui-calendar-week-view-day-names,
      .toastui-calendar-day-names,
      .toastui-calendar-month-dayname,
      .toastui-calendar-week-dayname,
      .toastui-calendar-day-name-item,
      .toastui-calendar .toastui-calendar-month-dayname,
      .toastui-calendar .toastui-calendar-week-dayname,
      .toastui-calendar .toastui-calendar-day-name-item,
      .desktop-calendar-inner .toastui-calendar-month-dayname,
      .desktop-calendar-inner .toastui-calendar-week-dayname,
      .desktop-calendar-inner .toastui-calendar-day-name-item {
        border-top: 1px solid ${getAdaptiveColors.borderLight} !important;
        border-bottom: 1px solid ${getAdaptiveColors.borderLight} !important;
        background-color: transparent !important;
        background: transparent !important;
        color: ${getAdaptiveColors.textSecondary} !important;
      }
      
      /* 时间网格 */
      .toastui-calendar-timegrid {
        background-color: transparent !important;
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      .toastui-calendar-timegrid-hour,
      .toastui-calendar-timegrid-hourmarker,
      .toastui-calendar-timegrid-hourmarker-line {
        border-bottom: 1px solid ${getAdaptiveColors.borderLight} !important;
        border-top: 1px solid ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 网格单元格 */
      .toastui-calendar-daygrid-cell,
      .toastui-calendar-weekday,
      .toastui-calendar-column {
        border-right: 1px solid ${getAdaptiveColors.borderLight} !important;
        border-bottom: 1px solid ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 时间列分隔线 */
      .toastui-calendar-timegrid-timezone,
      .toastui-calendar-timegrid-left,
      .toastui-calendar-panel-grid-left {
        border-right: 1px solid ${getAdaptiveColors.borderMedium} !important;
        background-color: ${getAdaptiveColors.bgOverlay} !important;
      }
      
      /* 月视图网格 */
      .toastui-calendar-month-daygrid,
      .toastui-calendar-month-daygrid-item {
        border-right: 1px solid ${getAdaptiveColors.borderLight} !important;
        border-bottom: 1px solid ${getAdaptiveColors.borderLight} !important;
        border-left: 1px solid ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 日视图和周视图的列 */
      .toastui-calendar-daygrid,
      .toastui-calendar-daygrid-row {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 半小时标记线 */
      .toastui-calendar-time .toastui-calendar-half-hour {
        border-top: 1px dashed ${getAdaptiveColors.borderLight} !important;
      }
      
      /* Panel 分隔线 */
      .toastui-calendar-section-line,
      .toastui-calendar-panel-resizer {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* ===============================================
         🎨 特定元素覆盖（针对内联样式）
         =============================================== */
      
      /* 强制覆盖所有具有 border 样式的元素 */
      .toastui-calendar-layout *[style*="border"],
      .toastui-calendar-week-view *[style*="border"],
      .toastui-calendar-month-view *[style*="border"] {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 时间轴线条 */
      .toastui-calendar-timegrid-hourmarker::before,
      .toastui-calendar-timegrid-hourmarker::after {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 网格线 */
      .toastui-calendar-panel-grid * {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
      
      /* 日期单元格边框 */
      .toastui-calendar-month-daygrid-cell,
      .toastui-calendar-week-daygrid-cell {
        border-color: ${getAdaptiveColors.borderLight} !important;
      }
    `;
    
    // 监听 DOM 变化（Widget 模式下移除背景色）
    if (isWidgetMode) {
      const removeInlineBackgroundColor = () => {
        const layouts = document.querySelectorAll('.toastui-calendar-layout');
        layouts.forEach(layout => {
          if (layout instanceof HTMLElement && layout.style.backgroundColor) {
            layout.style.backgroundColor = 'transparent';
          }
        });
        
        const panels = document.querySelectorAll('.toastui-calendar-panel');
        panels.forEach(panel => {
          if (panel instanceof HTMLElement && panel.style.backgroundColor) {
            panel.style.backgroundColor = 'transparent';
          }
        });
      };

      const observer = new MutationObserver(removeInlineBackgroundColor);
      const targetNode = document.body;
      
      observer.observe(targetNode, {
        attributes: true,
        attributeFilter: ['style'],
        subtree: true,
        childList: true
      });

      return () => {
        observer.disconnect();
      };
    }
  }, [isWidgetMode, currentView, getAdaptiveColors]); // 视图切换或颜色变化时重新执行
  
  useEffect(() => {
    // 当日历渲染完成且事件加载后，微调日历实例到正确的日期
    if (!isCalendarReady || !calendarRef.current || calendarInitializedRef.current) {
      return;
    }
    
    const timer = setTimeout(() => {
      const instance = calendarRef.current?.getInstance();
      if (instance) {
        const savedDate = localStorage.getItem('remarkable-calendar-current-date');
        if (savedDate) {
          try {
            const restoredDate = new Date(savedDate);
            if (!isNaN(restoredDate.getTime())) {
              const currentInstanceDate = instance.getDate().toDate();
              const isSameDay = 
                currentInstanceDate.getFullYear() === restoredDate.getFullYear() &&
                currentInstanceDate.getMonth() === restoredDate.getMonth() &&
                currentInstanceDate.getDate() === restoredDate.getDate();
              
              if (!isSameDay) {
                instance.setDate(restoredDate);
                console.log(`📅 [INIT] Fine-tuned calendar to: ${restoredDate.toLocaleDateString()}`);
              }
              calendarInitializedRef.current = true;
            }
          } catch (error) {
            console.error('❌ Failed to set calendar date:', error);
          }
        }
      }
    }, 50); // 减少到 50ms，因为 state 已经是正确的了

    return () => clearTimeout(timer);
  }, [isCalendarReady, events.length]); // 依赖日历就绪状态和事件加载

  // 🎨 在日历初始化后立即设置高度（覆盖TUI Calendar的默认值）
  // 使用 useLayoutEffect 在浏览器绘制前同步执行，避免闪烁
  useLayoutEffect(() => {
    if (!isCalendarReady) {
      console.log('🔍 [useLayoutEffect] 日历未就绪，跳过');
      return;
    }
    
    console.log('🔍 [useLayoutEffect] 日历已就绪，准备应用高度');
    
    // 使用 ref 获取最新的高度值，避免闭包问题
    const { taskHeight, allDayHeight, milestoneHeight } = heightSettingsRef.current;
    console.log('🔍 [useLayoutEffect] ref中的高度:', { taskHeight, allDayHeight, milestoneHeight });
    
    // 需要等待 DOM 元素渲染
    const timer = setTimeout(() => {
      let applied = false;
      
      // Task 面板
      const taskPanels = document.querySelectorAll('.toastui-calendar-panel-task, .toastui-calendar-panel.toastui-calendar-task');
      console.log('🔍 [useLayoutEffect] 找到 Task 面板:', taskPanels.length);
      if (taskPanels.length > 0 && taskHeight) {
        taskPanels.forEach((panel: Element) => {
          (panel as HTMLElement).style.height = `${taskHeight}px`;
        });
        applied = true;
      }
      
      // AllDay 面板
      const allDayPanels = document.querySelectorAll('.toastui-calendar-panel-allday');
      console.log('🔍 [useLayoutEffect] 找到 AllDay 面板:', allDayPanels.length);
      if (allDayPanels.length > 0 && allDayHeight) {
        allDayPanels.forEach((panel: Element) => {
          (panel as HTMLElement).style.height = `${allDayHeight}px`;
        });
        applied = true;
      }
      
      // Milestone 面板
      const milestonePanels = document.querySelectorAll('.toastui-calendar-panel-milestone, .toastui-calendar-panel.toastui-calendar-milestone');
      console.log('🔍 [useLayoutEffect] 找到 Milestone 面板:', milestonePanels.length);
      if (milestonePanels.length > 0 && milestoneHeight) {
        milestonePanels.forEach((panel: Element) => {
          (panel as HTMLElement).style.height = `${milestoneHeight}px`;
        });
        applied = true;
      }
      
      if (applied) {
        console.log('🎨 [初始高度] 已应用面板高度:', {
          task: taskHeight,
          allDay: allDayHeight,
          milestone: milestoneHeight
        });
      } else {
        console.warn('⚠️ [useLayoutEffect] 没有找到任何面板元素');
      }
    }, 100); // 等待 DOM 渲染
    
    return () => clearTimeout(timer);
  }, [isCalendarReady, currentView]); // 只在初始化和视图切换时应用，避免与 MutationObserver 冲突

  // 👁️ 监听用户拖动改变面板高度，自动保存到localStorage
  useEffect(() => {
    if (!isCalendarReady) return;
    
    console.log('🔍 [MutationObserver] 开始设置监听');
    
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
          const target = mutation.target as HTMLElement;
          
          // 检测到用户拖动，移除 !important 以允许拖动生效
          if (isInitialLoad) {
            console.log('🔍 [拖动检测] 用户开始拖动，移除 !important');
            setIsInitialLoad(false);
          }
          
          // 检查是否是我们关心的面板
          if (target.classList.contains('toastui-calendar-task') || 
              target.classList.contains('toastui-calendar-panel-task')) {
            const newHeight = parseInt(target.style.height);
            if (!isNaN(newHeight)) {
              console.log('🔍 [拖动检测] Task 面板高度变化:', newHeight);
              setCalendarSettings(prev => {
                if (newHeight !== prev.taskHeight) {
                  console.log('📏 [拖动] Task高度从', prev.taskHeight, '变为', newHeight);
                  return { ...prev, taskHeight: newHeight };
                }
                return prev;
              });
            }
          } else if (target.classList.contains('toastui-calendar-panel-allday')) {
            const newHeight = parseInt(target.style.height);
            if (!isNaN(newHeight)) {
              console.log('🔍 [拖动检测] AllDay 面板高度变化:', newHeight);
              setCalendarSettings(prev => {
                if (newHeight !== prev.allDayHeight) {
                  console.log('📏 [拖动] AllDay高度从', prev.allDayHeight, '变为', newHeight);
                  return { ...prev, allDayHeight: newHeight };
                }
                return prev;
              });
            }
          } else if (target.classList.contains('toastui-calendar-milestone') || 
                     target.classList.contains('toastui-calendar-panel-milestone')) {
            const newHeight = parseInt(target.style.height);
            if (!isNaN(newHeight)) {
              console.log('🔍 [拖动检测] Milestone 面板高度变化:', newHeight);
              setCalendarSettings(prev => {
                if (newHeight !== prev.milestoneHeight) {
                  console.log('📏 [拖动] Milestone高度从', prev.milestoneHeight, '变为', newHeight);
                  return { ...prev, milestoneHeight: newHeight };
                }
                return prev;
              });
            }
          }
        }
      });
    });
    
    // 观察所有面板元素
    const observeTimer = setTimeout(() => {
      const panels = document.querySelectorAll(
        '.toastui-calendar-panel-task, .toastui-calendar-task, ' +
        '.toastui-calendar-panel-allday, ' +
        '.toastui-calendar-panel-milestone, .toastui-calendar-milestone'
      );
      
      panels.forEach(panel => {
        observer.observe(panel, { attributes: true, attributeFilter: ['style'] });
      });
      
      console.log('� [MutationObserver] 开始监听', panels.length, '个面板的高度变化');
      console.log('🔍 [MutationObserver] 监听的面板:', Array.from(panels).map(p => p.className));
    }, 200);
    
    return () => {
      console.log('🔍 [MutationObserver] 清理监听');
      clearTimeout(observeTimer);
      observer.disconnect();
    };
  }, [isCalendarReady, currentView]); // 只依赖日历准备状态和视图，避免不必要的重建

  // 🎨 将事件数据转换为 TUI Calendar 格式，应用筛选和透明度
  const useMemoCallCountRef = useRef(0);
  
  // 🔧 提取关键依赖，避免整个 calendarSettings 对象变化导致重新计算
  const { visibleTags, visibleCalendars, eventOpacity } = calendarSettings;
  
  // 🔧 实时读取当前运行中的 Timer（不使用 useMemo，每次都读取最新状态）
  // 用于在 calendarEvents 计算时获取最新的 timer 状态
  const getRunningTimerEventId = () => {
    // 1. 优先使用传入的 globalTimer prop（主应用场景）
    if (globalTimer !== undefined) {
      if (globalTimer && globalTimer.isRunning) {
        const startTime = globalTimer.originalStartTime || globalTimer.startTime;
        const eventId = `timer-${globalTimer.tagId}-${startTime}`;
        console.log('✅ [TIMER] Using globalTimer prop:', eventId);
        return eventId;
      } else {
        // 主应用中globalTimer存在但不运行，说明timer已停止
        console.log('⚠️ [TIMER] GlobalTimer prop exists but not running - timer stopped');
        return null;
      }
    }
    
    // 2. Widget简化方案：检测localStorage中是否有带"[专注中]"前缀的timer事件
    console.log('🔍 [WIDGET TIMER] Checking for events with [专注中] prefix...');
    try {
      const eventsData = localStorage.getItem('remarkable-events');
      if (eventsData) {
        const events = JSON.parse(eventsData);
        
        // 查找带有"[专注中]"前缀的timer事件
        const prefixedTimerEvents = events.filter((e: any) => 
          e.isTimer && e.title && e.title.startsWith('[专注中]')
        );
        
        if (prefixedTimerEvents.length > 0) {
          // 找到最新的带前缀的timer事件
          const latestPrefixedTimer = prefixedTimerEvents
            .sort((a: any, b: any) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime())[0];
          
          console.log('✅ [WIDGET TIMER] Found prefixed timer event:', {
            id: latestPrefixedTimer.id,
            title: latestPrefixedTimer.title
          });
          
          return latestPrefixedTimer.id;
        } else {
          console.log('⚠️ [WIDGET TIMER] No events with [专注中] prefix found');
        }
      }
    } catch (error) {
      console.error('❌ [WIDGET TIMER] Failed to check prefixed events:', error);
    }
    
    console.log('⚠️ [TIMER] Returning null');
    return null;
  };

  // 🔧 [方案3] 生成实时完整的timer事件，结合已保存事件和当前timer状态
  const generateRealtimeTimerEvent = () => {
    // 🔧 关键修正：使用与getRunningTimerEventId相同的逻辑获取timer
    let currentTimer = null;
    let timerEventId = null;

    // 1. 优先使用传入的 globalTimer prop（主应用场景）
    if (globalTimer && globalTimer.isRunning) {
      currentTimer = globalTimer;
      const startTime = globalTimer.originalStartTime || globalTimer.startTime;
      timerEventId = `timer-${globalTimer.tagId}-${startTime}`;
    } else {
      // 2. 如果没有 prop，从 localStorage 读取（Widget 场景）
      try {
        const saved = localStorage.getItem('remarkable-global-timer');
        if (saved) {
          const timer = JSON.parse(saved);
          if (timer && timer.isRunning) {
            currentTimer = timer;
            const startTime = timer.originalStartTime || timer.startTime;
            timerEventId = `timer-${timer.tagId}-${startTime}`;
          }
        }
      } catch (error) {
        console.error('❌ [REALTIME TIMER] Failed to load timer from localStorage:', error);
      }
    }

    if (!currentTimer || !timerEventId) {
      return null; // 没有运行中的timer
    }
    
    // 计算timer的真实开始时间和当前时间
    const now = new Date();
    const timerStartTime = new Date(currentTimer.originalStartTime || currentTimer.startTime);
    
    // 🔧 关键修正：显示完整的timer事件（从开始到现在），而不是分段
    const realtimeEvent: Event = {
      id: timerEventId,
      title: currentTimer.eventTitle || currentTimer.taskTitle || '计时中...',
      startTime: formatTimeForStorage(timerStartTime), // timer的真实开始时间
      endTime: formatTimeForStorage(now), // 当前时间
      location: '',
      description: '实时计时事件',
      tags: [currentTimer.tagId],
      tagId: currentTimer.tagId,
      calendarId: '',
      isAllDay: false,
      createdAt: formatTimeForStorage(timerStartTime),
      updatedAt: formatTimeForStorage(now),
      syncStatus: 'local-only',
      remarkableSource: true
    };

    console.log('🔄 [REALTIME TIMER] Generated realtime timer event:', {
      id: realtimeEvent.id,
      startTime: realtimeEvent.startTime,
      endTime: realtimeEvent.endTime,
      duration: `${Math.floor((now.getTime() - timerStartTime.getTime()) / 1000 / 60)} minutes`,
      hasGlobalTimer: !!globalTimer,
      timerIsRunning: currentTimer.isRunning,
      timerEventId: timerEventId
    });

    return realtimeEvent;
  };

  const calendarEvents = useMemo(() => {
    const startTime = performance.now(); // ⏱️ 性能监控
    useMemoCallCountRef.current++;
    
    // 只在前3次调用时打印日志
    if (useMemoCallCountRef.current <= 3) {
      console.log(`🎨 [useMemo #${useMemoCallCountRef.current}] Computing calendar events: ${events.length} raw events`);
    }

    // 🔧 [方案3] 处理实时timer事件：合并已保存事件和实时timer状态
    let eventsToProcess = [...events];
    
    const realtimeTimerEvent = generateRealtimeTimerEvent();
    if (realtimeTimerEvent) {
      // 移除已保存的同ID timer事件，避免重复显示
      eventsToProcess = eventsToProcess.filter(e => e.id !== realtimeTimerEvent.id);
      // 添加实时timer事件
      eventsToProcess.push(realtimeTimerEvent);
      
      console.log('🔄 [REALTIME TIMER] Merged realtime timer event, total events:', eventsToProcess.length);
    }

    // 🚀 性能优化：只加载当前视图范围 ±3个月的事件（减少DOM节点）
    const viewStart = new Date(currentDate);
    viewStart.setMonth(viewStart.getMonth() - 3);
    viewStart.setHours(0, 0, 0, 0);
    
    const viewEnd = new Date(currentDate);
    viewEnd.setMonth(viewEnd.getMonth() + 3);
    viewEnd.setHours(23, 59, 59, 999);
    
    const filteredByDateRange = eventsToProcess.filter(event => {
      const eventStart = new Date(event.startTime);
      const eventEnd = new Date(event.endTime);
      // 事件与视图范围有重叠即加载
      return eventEnd >= viewStart && eventStart <= viewEnd;
    });
    
    // 只在前3次调用时打印日志
    if (useMemoCallCountRef.current <= 3) {
      console.log(`📅 [useMemo] Date range filter: ${events.length} → ${filteredByDateRange.length} events`);
    }
    
    // 精确语义：只要选择非空，就启用筛选（不做"等价全选"的推断）
    const hasTagFilter = visibleTags.length > 0;
    const hasCalendarFilter = visibleCalendars.length > 0;

    const filteredByTags = filteredByDateRange.filter(event => {
      // 标签筛选 - 当启用筛选时，匹配包含任一所选标签的事件
      if (hasTagFilter) {
        const eventTags = event.tags || (event.tagId ? [event.tagId] : []);
        
        // ✅ 新逻辑：支持特殊标签选项
        // "no-tag" - 显示未定义标签的事件
        const hasNoTagOption = visibleTags.includes('no-tag');
        
        if (eventTags.length === 0) {
          // 没有标签的事件：只有勾选了"未定义标签"才显示
          return hasNoTagOption;
        }
        
        // 有标签的事件：检查是否与筛选条件匹配
        return eventTags.some(tagId => visibleTags.includes(tagId));
      }
      return true;
    });

    const filteredByCalendars = filteredByTags.filter(event => {
      // 日历分组筛选 - 当启用筛选时，匹配属于任一所选日历的事件
      if (hasCalendarFilter) {
        // ✅ 新逻辑：支持特殊日历选项
        // "local-created" - 显示本地创建的事件（source=local或remarkableSource=true）
        // "not-synced" - 显示未同步至日历的事件（没有calendarId或没有externalId）
        const hasLocalCreatedOption = visibleCalendars.includes('local-created');
        const hasNotSyncedOption = visibleCalendars.includes('not-synced');
        
        // 判断事件是否为本地创建
        const isLocalCreated = event.source === 'local' || event.remarkableSource === true;
        
        // 判断事件是否未同步至日历
        const isNotSynced = !event.calendarId || !event.externalId;
        
        // 如果事件符合特殊选项，则显示
        if (isLocalCreated && hasLocalCreatedOption) return true;
        if (isNotSynced && hasNotSyncedOption) return true;
        
        // 如果事件没有calendarId，但也不符合特殊选项，则隐藏
        if (!event.calendarId) return false;
        
        // 正常的日历筛选：检查是否属于所选日历
        // 如果 visibleCalendars 为空，说明用户取消了所有勾选，不显示任何日历
        return visibleCalendars.includes(event.calendarId);
      }
      return true;
    });

    // 去重（按事件ID）避免渲染重复
    const uniqueByIdMap = new Map<string, any>();
    filteredByCalendars.forEach(e => {
      if (e && e.id && !uniqueByIdMap.has(e.id)) {
        uniqueByIdMap.set(e.id, e);
      }
    });
    const uniqueFiltered = Array.from(uniqueByIdMap.values());

    console.log(`🎨 [USEMEMO] Processing ${uniqueFiltered.length} events in ${(performance.now() - startTime).toFixed(1)}ms`);

    // 🔧 每次渲染时实时读取 timer 状态（不缓存）
    const currentRunningTimerEventId = getRunningTimerEventId();
    
    // 🔍 额外调试：检查实时timer事件和currentRunningTimerEventId的匹配
    const realtimeTimer = generateRealtimeTimerEvent();
    if (realtimeTimer) {
      console.log('🔍 [专注中 MATCH DEBUG] ID comparison:', {
        realtimeTimerEventId: realtimeTimer.id,
        currentRunningTimerEventId: currentRunningTimerEventId,
        idsMatch: realtimeTimer.id === currentRunningTimerEventId
      });
    }
    
    // 🔍 添加调试信息
    console.log('🔍 [WIDGET DEBUG] Timer state:', {
      isWidgetMode,
      globalTimer: !!globalTimer,
      localStorageTimerTrigger,
      currentRunningTimerEventId,
      eventsCount: uniqueFiltered.length,
      timerEvents: uniqueFiltered.filter(e => e.id.includes('timer-')).map(e => ({ id: e.id, title: e.title }))
    });
    
    // 🔧 优化：预计算透明度hex值，避免重复计算
    const opacity = eventOpacity / 100;
    const opacityHex = Math.floor(opacity * 255).toString(16).padStart(2, '0');
    
    const calendarEventsWithStats = uniqueFiltered
      .map(event => {
        const calendarEvent = convertToCalendarEvent(event, hierarchicalTags, currentRunningTimerEventId, isWidgetMode);
        
        // 🔧 一次性应用透明度（复用预计算的hex值）
        const originalColor = calendarEvent.backgroundColor || '#3788d8';
        return {
          ...calendarEvent,
          backgroundColor: originalColor + opacityHex,
          borderColor: originalColor,
        } as typeof calendarEvent;
      });
    
    // 📊 统计事件类型分布
    const categoryStats = calendarEventsWithStats.reduce((acc, evt) => {
      const cat = (evt.category as string) || 'unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const endTime = performance.now();
    
    // 只在前3次调用时打印日志
    if (useMemoCallCountRef.current <= 3) {
      console.log(`⏱️ [useMemo] Total: ${(endTime - startTime).toFixed(1)}ms | Filtered: ${calendarEventsWithStats.length} events`);
    }
    
    return calendarEventsWithStats;
  }, [events, hierarchicalTags, visibleTags, visibleCalendars, eventOpacity, currentDate, globalTimer, localStorageTimerTrigger]); // ✅ 添加 localStorageTimerTrigger 依赖，确保 Widget 模式下 timer 状态变化能触发重新计算
  // 📅 创建日历分组配置
  const getCalendars = () => createCalendarsFromTags(hierarchicalTags);

  // ⚙️ 处理设置变更
  const handleSettingsChange = (newSettings: CalendarSettings) => {
    const startTime = performance.now();
    console.log('⚙️ [Settings] Change received:', {
      tags: newSettings.visibleTags.length,
      calendars: newSettings.visibleCalendars.length,
      opacity: newSettings.eventOpacity
    });
    
    const setStateStart = performance.now();
    setCalendarSettings(newSettings);
    console.log(`⚙️ [Settings] setState completed in ${(performance.now() - setStateStart).toFixed(2)}ms`);
    
    const saveStart = performance.now();
    saveSettings(newSettings);
    console.log(`⚙️ [设置变更] saveSettings 完成，耗时: ${(performance.now() - saveStart).toFixed(2)}ms`);
    
    const endTime = performance.now();
    console.log(`⚙️ [设置变更] 总耗时: ${(endTime - startTime).toFixed(2)}ms`);
  };

  // 获取可用的标签和日历列表
  const getAvailableTagsForSettings = () => {
    // ✅ 检测数据是否已经是扁平结构（包含level字段且无children）
    const isAlreadyFlat = hierarchicalTags.length > 0 && 
                         hierarchicalTags[0].level !== undefined && 
                         !hierarchicalTags[0].children;
    
    // 如果已经是扁平的，直接使用；否则调用flattenTags
    const flatTags = isAlreadyFlat ? hierarchicalTags : flattenTags(hierarchicalTags);
    
    const regularTags = flatTags.map(tag => ({
      id: tag.id,
      name: tag.displayName || tag.name,
      color: tag.color,
      emoji: tag.emoji || '🏷️', // 添加 emoji
      level: tag.level || 0,     // 添加层级
      calendarId: tag.calendarMapping?.calendarId // 🔗 包含日历映射信息，用于联动
    }));
    
    // ✅ 添加特殊选项："未定义标签"
    return [
      ...regularTags,
      {
        id: 'no-tag',
        name: '未定义标签',
        color: '#9e9e9e',
        emoji: '📌',
        level: 0,
        calendarId: undefined
      }
    ];
  };

  // ====================================
  // 🎯 事件处理器 - CRUD 操作
  // ====================================

  /**
   * 📝 点击事件 - 打开编辑弹窗
   */
  const handleClickEvent = useCallback((eventInfo: any) => {
    // 直接从 localStorage 读取最新的 events，避免闭包问题
    const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const currentEvents = savedEvents ? JSON.parse(savedEvents) : [];
    
    const event = currentEvents.find((e: Event) => e.id === eventInfo.event.id);
    
    if (event) {
      setEditingEvent(event);
      setShowEventEditModal(true);
    }
    return false;
  }, []); // 空依赖数组，因为我们直接从 localStorage 读取

  /**
   * 📅 选择日期时间 - 打开创建事件模态框
   */
  const handleSelectDateTime = useCallback((selectionInfo: any) => {
    console.log('📅 [TimeCalendar] Time selection:', selectionInfo);
    
    const { start, end, isAllday } = selectionInfo;
    
    // 创建新事件对象（不保存，仅用于编辑）
    const newEvent: Event = {
      id: `local-${Date.now()}`,
      title: '',
      startTime: start.toISOString(),
      endTime: end.toISOString(),
      location: '',
      description: '',
      tags: [],
      tagId: '',
      calendarId: '', // 用户需要在模态框中选择
      isAllDay: isAllday || false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      syncStatus: 'pending'
    };
    
    // 打开编辑模态框
    setEditingEvent(newEvent);
    setShowEventEditModal(true);
  }, []);

  /**
   * ✨ 创建事件 - 阻止 TUI Calendar 默认行为
   * 我们使用 onSelectDateTime 和模态框来创建事件
   */
  const handleBeforeCreateEvent = useCallback((eventData: any) => {
    console.log('⚠️ [TimeCalendar] beforeCreateEvent blocked (use modal instead):', eventData);
    // 返回 false 阻止默认的事件创建
    return false;
  }, []);

  /**
   * 📝 更新事件 - 支持拖拽和编辑
   */
  const handleBeforeUpdateEvent = async (updateInfo: any) => {
    console.log('📝 [TimeCalendar] Updating event:', updateInfo);
    
    try {
      const { event: calendarEvent, changes } = updateInfo;
      
      // 查找原始事件
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return;
      
      const existingEvents: Event[] = JSON.parse(saved);
      const eventIndex = existingEvents.findIndex((e: Event) => e.id === calendarEvent.id);
      
      if (eventIndex === -1) {
        console.error('❌ [TimeCalendar] Event not found:', calendarEvent.id);
        return;
      }

      const originalEvent = existingEvents[eventIndex];
      
      // 应用更新
      const updatedCalendarEvent = {
        ...calendarEvent,
        ...changes
      };
      
      const updatedEvent = convertFromCalendarEvent(updatedCalendarEvent, originalEvent);
      
      // 验证更新后的数据
      if (!validateEvent(updatedEvent)) {
        console.error('❌ [TimeCalendar] Updated event validation failed');
        return;
      }

      // 更新 localStorage
      existingEvents[eventIndex] = updatedEvent;
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      setEvents(existingEvents);

      // 🔄 同步到 Outlook
      const activeSyncManager = syncManager || (window as any).syncManager;
      if (activeSyncManager) {
        try {
          await activeSyncManager.recordLocalAction('update', 'event', updatedEvent.id, updatedEvent, originalEvent);
          console.log('✅ [TimeCalendar] Event updated and synced');
        } catch (error) {
          console.error('❌ [TimeCalendar] Failed to sync updated event:', error);
        }
      }
    } catch (error) {
      console.error('❌ [TimeCalendar] Failed to update event:', error);
    }
  };

  /**
   * 🗑️ 删除事件
   */
  const handleBeforeDeleteEvent = async (eventInfo: any) => {
    console.log('🗑️ [TimeCalendar] Deleting event:', eventInfo.event.id);
    
    try {
      const eventId = eventInfo.event.id;
      
      // 从 localStorage 删除
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return;
      
      const existingEvents: Event[] = JSON.parse(saved);
      const eventToDelete = existingEvents.find((e: Event) => e.id === eventId);
      
      if (!eventToDelete) {
        console.error('❌ [TimeCalendar] Event to delete not found');
        return;
      }

      const updatedEvents = existingEvents.filter((e: Event) => e.id !== eventId);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      setEvents(updatedEvents);

      // � 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
      console.log('🔔 [TimeCalendar] Dispatching eventsUpdated event after delete');
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { 
          eventId: eventId,
          isDeleted: true,
          tags: eventToDelete.tags
        }
      }));

      // �🔄 同步删除到 Outlook
      const activeSyncManager = syncManager || (window as any).syncManager;
      if (activeSyncManager) {
        try {
          await activeSyncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete);
          console.log('✅ [TimeCalendar] Event deleted and synced');
        } catch (error) {
          console.error('❌ [TimeCalendar] Failed to sync deleted event:', error);
        }
      }
    } catch (error) {
      console.error('❌ [TimeCalendar] Failed to delete event:', error);
    }
  };

  /**
   * 💾 保存编辑弹窗的更改
   */
  const handleSaveEventFromModal = async (updatedEvent: Event) => {
    console.log('💾 [TimeCalendar] Saving event:', updatedEvent.id, 'tags:', updatedEvent.tags);
    
    try {
      // 验证时间字段
      if (!updatedEvent.startTime || !updatedEvent.endTime) {
        console.error('❌ [TimeCalendar] Invalid time fields:', updatedEvent);
        return;
      }
      
      // 确保时间字段是有效的ISO字符串
      const startDate = new Date(updatedEvent.startTime);
      const endDate = new Date(updatedEvent.endTime);
      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        console.error('❌ [TimeCalendar] Invalid date values:', { startTime: updatedEvent.startTime, endTime: updatedEvent.endTime });
        return;
      }

      // 🏷️ Bug Fix #4: 如果标题为空，使用标签名称（含emoji）作为标题
      if (!updatedEvent.title || updatedEvent.title.trim() === '') {
        const tagId = updatedEvent.tags?.[0] || updatedEvent.tagId;
        if (tagId) {
          const flatTags = TagService.getFlatTags();
          const tag = flatTags.find(t => t.id === tagId);
          if (tag) {
            updatedEvent.title = tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name;
            console.log('🏷️ [TimeCalendar] Using tag name as title:', updatedEvent.title);
          }
        }
      }
      
      // 更新 localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
      const eventIndex = existingEvents.findIndex((e: Event) => e.id === updatedEvent.id);
      
      let originalEvent: Event | null = null;
      let isNewEvent = false;
      
      if (eventIndex === -1) {
        // 新事件：添加到数组
        console.log('➕ [TimeCalendar] Creating new event:', updatedEvent.id);
        isNewEvent = true;
        existingEvents.push(updatedEvent);
      } else {
        // 现有事件：更新
        console.log('✏️ [TimeCalendar] Updating existing event:', updatedEvent.id);
        originalEvent = existingEvents[eventIndex];
        const tagsChanged = JSON.stringify(originalEvent.tags) !== JSON.stringify(updatedEvent.tags);
        if (tagsChanged) {
          console.log('🏷️ [TimeCalendar] Tags changed:', originalEvent.tags, '→', updatedEvent.tags);
        }
        existingEvents[eventIndex] = updatedEvent;
      }
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      
      // 🎨 立即更新 UI - 触发 events state 更新
      console.log('🎨 [TimeCalendar] Updating UI immediately');
      setEvents([...existingEvents]);

      // � 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
      console.log('🔔 [TimeCalendar] Dispatching eventsUpdated event');
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { 
          eventId: updatedEvent.id,
          isNewEvent,
          tags: updatedEvent.tags
        }
      }));

      // �🔄 同步到 Outlook
      const activeSyncManager = syncManager || (window as any).syncManager;
      if (activeSyncManager) {
        // 🔧 [FIX] 跳过 syncStatus 为 'local-only' 的事件（例如：运行中的 Timer）
        if (updatedEvent.syncStatus === 'local-only') {
          console.log('⏭️ [TimeCalendar] Skipping sync for local-only event (Timer in progress):', updatedEvent.id);
        } else {
          try {
            if (isNewEvent) {
              await activeSyncManager.recordLocalAction('create', 'event', updatedEvent.id, updatedEvent);
              console.log('✅ [TimeCalendar] New event synced');
            } else {
              await activeSyncManager.recordLocalAction('update', 'event', updatedEvent.id, updatedEvent, originalEvent);
              console.log('✅ [TimeCalendar] Updated event synced');
            }
          } catch (error) {
            console.error('❌ [TimeCalendar] Sync failed:', error);
          }
        }
      }
    } catch (error) {
      console.error('❌ [TimeCalendar] Save failed:', error);
    }
  };

  /**
   * 🗑️ 从编辑弹窗删除事件
   */
  const handleDeleteEventFromModal = async (eventId: string) => {
    console.log('🗑️ [TimeCalendar] Deleting event from modal:', eventId);
    
    try {
      // 从 localStorage 删除
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!saved) return;
      
      const existingEvents: Event[] = JSON.parse(saved);
      const eventToDelete = existingEvents.find((e: Event) => e.id === eventId);
      
      if (!eventToDelete) {
        console.error('❌ [TimeCalendar] Event to delete not found');
        return;
      }

      const updatedEvents = existingEvents.filter((e: Event) => e.id !== eventId);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      setEvents(updatedEvents);

      // � 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
      console.log('🔔 [TimeCalendar] Dispatching eventsUpdated event after delete from modal');
      window.dispatchEvent(new CustomEvent('eventsUpdated', {
        detail: { 
          eventId: eventId,
          isDeleted: true,
          tags: eventToDelete.tags
        }
      }));

      // �🔄 同步到 Outlook
      const activeSyncManager = syncManager || (window as any).syncManager;
      if (activeSyncManager) {
        try {
          await activeSyncManager.recordLocalAction('delete', 'event', eventId, eventToDelete);
          console.log('✅ [TimeCalendar] Event deleted and synced from modal');
        } catch (error) {
          console.error('❌ [TimeCalendar] Failed to sync deleted event:', error);
        }
      }
    } catch (error) {
      console.error('❌ [TimeCalendar] Failed to delete event from modal:', error);
    }
  };

  /**
   * 🏷️ 获取标签对应的日历映射
   */
  const getCalendarMappingsForTags = async (tagIds: string[]) => {
    const mappings: Array<{calendarId: string; calendarName: string; color?: string}> = [];
    
    for (const tagId of tagIds) {
      const tag = hierarchicalTags.find((t: any) => t.id === tagId);
      if (tag?.calendarMapping) {
        mappings.push(tag.calendarMapping);
      } else {
        // 如果标签没有映射，查找其子标签是否有映射
        const findMapping = (tags: any[]): any => {
          for (const t of tags) {
            if (t.id === tagId && t.calendarMapping) {
              return t.calendarMapping;
            }
            if (t.children) {
              const found = findMapping(t.children);
              if (found) return found;
            }
          }
          return null;
        };
        
        const mapping = findMapping(hierarchicalTags);
        if (mapping) {
          mappings.push(mapping);
        }
      }
    }
    
    return mappings;
  };

  // ====================================
  // 🎮 视图控制
  // ====================================

  const handleViewChange = useCallback((view: 'month' | 'week' | 'day') => {
    // ✅ 如果视图相同，直接返回，避免不必要的渲染
    if (currentView === view) {
      console.log(`🎮 [VIEW] Already in ${view} view, skipping`);
      return;
    }

    console.log(`🎮 [VIEW] Changing from ${currentView} to ${view}`);
    
    // ✅ 批量更新：在同一个操作中更新视图和保存设置
    setCurrentView(view);
    
    // ✅ 使用 setTimeout 延迟非关键操作
    setTimeout(() => {
      saveSettings(calendarSettings, view);
      
      const instance = calendarRef.current?.getInstance();
      if (instance) {
        const dateRange = instance.getDateRangeStart().toDate().toLocaleDateString() + 
                         ' ~ ' + 
                         instance.getDateRangeEnd().toDate().toLocaleDateString();
        console.log(`🎮 [VIEW] Changed to: ${view}, Date Range: ${dateRange}`);
      } else {
        console.log(`🎮 [VIEW] Changed to: ${view}`);
      }
    }, 0);
  }, [currentView, calendarSettings]); // ✅ 添加依赖

  const goToToday = () => {
    console.log(`📅 [NAV] goToToday called`);
    const instance = calendarRef.current?.getInstance();
    if (instance) {
      instance.today();
      const newDate = new Date();
      setCurrentDate(newDate);
      console.log(`📅 [NAV] Go to Today: ${newDate.toLocaleDateString()}, currentView: ${currentView}`);
    } else {
      console.warn(`⚠️ [NAV] Calendar instance not found`);
    }
  };

  const goToPrevious = () => {
    const instance = calendarRef.current?.getInstance();
    if (instance) {
      instance.prev();
      const date = instance.getDate();
      const newDate = date.toDate();
      
      // ✅ 修复：对于月视图，确保设置为月份的第一天
      if (currentView === 'month') {
        newDate.setDate(15); // 设置为月中，避免边界问题
      }
      
      setCurrentDate(newDate);
      console.log(`📅 [NAV] Go to Previous: ${newDate.toLocaleDateString()}`);
    }
  };

  const goToNext = () => {
    const instance = calendarRef.current?.getInstance();
    if (instance) {
      instance.next();
      const date = instance.getDate();
      const newDate = date.toDate();
      
      // ✅ 修复：对于月视图，确保设置为月份的第一天
      if (currentView === 'month') {
        newDate.setDate(15); // 设置为月中，避免边界问题
      }
      
      setCurrentDate(newDate);
      console.log(`📅 [NAV] Go to Next: ${newDate.toLocaleDateString()}`);
    }
  };

  // 🖱️ 鼠标滚轮导航 - 改进版：月视图按周滚动（7天），更精细的导航
  useEffect(() => {
    if (currentView !== 'month') {
      return; // 只在月视图启用滚轮导航
    }

    // 等待 DOM 渲染完成
    const timer = setTimeout(() => {
      const calendarElement = document.querySelector('.toastui-calendar-month') || 
                              document.querySelector('.time-calendar-container');
      
      if (!calendarElement) {
        console.warn('🖱️ [WHEEL] Calendar element not found');
        return;
      }

      let accumulatedDelta = 0; // 累积滚动距离
      const threshold = 150; // 降低阈值，让滚动更灵敏（150像素 = 一周）
      let lastWheelTime = 0;
      const resetDelay = 600; // 缩短重置时间，更快响应新的滚动

      const handleWheel = (e: unknown) => {
        const wheelEvent = e as globalThis.WheelEvent;
        const now = Date.now();
        
        // 如果超过resetDelay没有滚动，重置累积
        if (now - lastWheelTime > resetDelay) {
          accumulatedDelta = 0;
        }
        lastWheelTime = now;

        // 累积滚动距离
        accumulatedDelta += wheelEvent.deltaY;

        // 向下滚动（下一周）
        if (accumulatedDelta > threshold) {
          const instance = calendarRef.current?.getInstance();
          if (instance) {
            const currentDate = instance.getDate().toDate();
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() + 7); // 前进 7 天
            instance.setDate(newDate);
            setCurrentDate(newDate);
            console.log(`🖱️ [WHEEL] Scroll forward 1 week: ${newDate.toLocaleDateString()}`);
          }
          accumulatedDelta = 0; // 重置累积
          wheelEvent.preventDefault();
        }
        // 向上滚动（上一周）
        else if (accumulatedDelta < -threshold) {
          const instance = calendarRef.current?.getInstance();
          if (instance) {
            const currentDate = instance.getDate().toDate();
            const newDate = new Date(currentDate);
            newDate.setDate(newDate.getDate() - 7); // 后退 7 天
            instance.setDate(newDate);
            setCurrentDate(newDate);
            console.log(`🖱️ [WHEEL] Scroll backward 1 week: ${newDate.toLocaleDateString()}`);
          }
          accumulatedDelta = 0; // 重置累积
          wheelEvent.preventDefault();
        }
      };

      calendarElement.addEventListener('wheel', handleWheel as EventListener, { passive: false });
      console.log('🖱️ [WHEEL] Month view wheel navigation enabled (weekly scroll, threshold: 150px)');

      // 清理函数
      return () => {
        calendarElement.removeEventListener('wheel', handleWheel as EventListener);
        console.log('🖱️ [WHEEL] Month view wheel navigation disabled');
      };
    }, 100); // 延迟 100ms 等待 DOM

    return () => {
      clearTimeout(timer);
    };
  }, [currentView]); // 只依赖 currentView，goToNext 和 goToPrevious 在闭包中访问

  // 🗓️ 计算月视图的显示月份（找到第一个1号所在的月份）
  const getDisplayMonth = useMemo(() => {
    if (currentView !== 'month') {
      // 非月视图，直接返回当前日期的年月
      return {
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1
      };
    }

    // 月视图：找到第一个1号
    // TUI Calendar 月视图通常从上个月末开始显示
    // 我们需要找到第一个日期为1的日期
    const instance = calendarRef.current?.getInstance();
    if (instance) {
      try {
        const rangeStart = instance.getDateRangeStart().toDate();
        const rangeEnd = instance.getDateRangeEnd().toDate();
        
        // 从 rangeStart 开始，找到第一个1号
        let currentCheckDate = new Date(rangeStart);
        while (currentCheckDate <= rangeEnd) {
          if (currentCheckDate.getDate() === 1) {
            // 找到第一个1号
            return {
              year: currentCheckDate.getFullYear(),
              month: currentCheckDate.getMonth() + 1
            };
          }
          currentCheckDate.setDate(currentCheckDate.getDate() + 1);
        }
      } catch (error) {
        console.warn('⚠️ Failed to get date range from calendar instance');
      }
    }
    
    // 回退方案：使用 currentDate
    return {
      year: currentDate.getFullYear(),
      month: currentDate.getMonth() + 1
    };
  }, [currentView, currentDate]); // 当视图或日期改变时重新计算

  // ====================================
  // 🎨 渲染 UI
  // ====================================

  // ⏱️ 渲染性能监控
  useEffect(() => {
    const renderDuration = performance.now() - renderStartRef.current;
    
    // 只在前3次渲染时打印日志
    if (renderCountRef.current <= 3) {
      console.log(`⏱️ [TimeCalendar] Render #${renderCountRef.current} completed in ${renderDuration.toFixed(2)}ms`);
    }
  });

  // 🎨 使用 useMemo 缓存动态样式，确保高度设置能正确应用
  const dynamicStyles = useMemo(() => {
    console.log('🎨 [动态样式] 重新生成:', {
      taskHeight: calendarSettings.taskHeight,
      milestoneHeight: calendarSettings.milestoneHeight,
      allDayHeight: calendarSettings.allDayHeight,
      showTask: calendarSettings.showTask,
      showMilestone: calendarSettings.showMilestone,
      showAllDay: calendarSettings.showAllDay,
      isInitialLoad
    });
    
    // 初始加载时使用 !important 防止闪烁，拖动后移除以允许用户调整
    const important = isInitialLoad ? ' !important' : '';
    
    return `
      /* All Day 面板 - 只控制显示/隐藏 */
      .toastui-calendar-panel-allday {
        ${calendarSettings.showAllDay === false ? 'display: none !important;' : ''}
      }
      
      /* Task 面板 - 初始高度（可拖动修改） */
      .toastui-calendar-panel-task,
      .toastui-calendar-panel.toastui-calendar-task {
        ${calendarSettings.showTask === false ? 'display: none !important;' : ''}
        height: ${calendarSettings.taskHeight}px${important};
      }
      
      /* AllDay 面板 - 初始高度（可拖动修改） */
      .toastui-calendar-panel-allday {
        height: ${calendarSettings.allDayHeight}px${important};
      }
      
      /* Milestone 面板 - 只控制显示/隐藏 */
      .toastui-calendar-panel-milestone,
      .toastui-calendar-panel.toastui-calendar-milestone {
        ${calendarSettings.showMilestone === false ? 'display: none !important;' : ''}
      }
      
      /* Milestone 事件 - 所有视图 */
      .toastui-calendar-weekday-event.toastui-calendar-milestone,
      .toastui-calendar-month-milestone {
        ${calendarSettings.showMilestone === false ? 'display: none !important;' : ''}
        ${calendarSettings.milestoneHeight ? `height: ${calendarSettings.milestoneHeight}px !important; line-height: ${calendarSettings.milestoneHeight}px !important;` : ''}
      }`;
  }, [
    calendarSettings.taskHeight,
    calendarSettings.milestoneHeight,
    calendarSettings.allDayHeight,
    calendarSettings.showTask,
    calendarSettings.showMilestone,
    calendarSettings.showAllDay,
    isInitialLoad  // 当移除 !important 时重新生成 CSS
  ]);

  return (
    <>
      {/* 💅 动态CSS样式 - 应用事件类型高度设置 */}
      <style>{dynamicStyles}{`
        
        /* 月视图事件左对齐 */
        .toastui-calendar-month .toastui-calendar-weekday-event,
        .toastui-calendar-month-day-event {
          text-align: left !important;
          justify-content: flex-start !important;
          padding-left: 4px !important;
        }
        
        /* 月视图事件标题左对齐 */
        .toastui-calendar-month .toastui-calendar-event-title,
        .toastui-calendar-month-day-event .toastui-calendar-event-title {
          text-align: left !important;
          justify-content: flex-start !important;
        }
      `}</style>
      
      <div className={`time-calendar-container ${className}`} style={{ 
        height: '100%', 
        padding: '4px 8px',
        fontFamily: 'Microsoft YaHei, Arial, sans-serif',
        display: 'flex',
        flexDirection: 'column',
        background: 'transparent', // 🔧 改为透明，让三个矩形各自的背景色生效
        opacity: calendarOpacity, // 🎨 整体透明度：影响所有子元素
        ...style // 允许外部覆盖
      }}>
        {/* 🎛️ 控制工具栏 */}
        <div className="toastui-calendar-controls" style={{
          background: bgRgba, // 🎨 使用与主体相同的背景色+透明度
          backdropFilter: calendarOpacity < 1 ? 'blur(10px)' : 'none',
          border: 'none' // 🎯 移除边框
        }}>
          <div className="toastui-calendar-navigation">
            <button 
              className="toastui-calendar-nav-button"
              onClick={goToPrevious}
              title="上一个"
            >
              ◀ 前
            </button>
            <button 
              className={`toastui-calendar-nav-button active`}
              onClick={goToToday}
              title="回到今天"
            >
              📅 今天
            </button>
            <button 
              className="toastui-calendar-nav-button"
              onClick={goToNext}
              title="下一个"
            >
              后 ▶
            </button>
          </div>

          <div className="toastui-calendar-title">
            {getDisplayMonth.year}.{String(getDisplayMonth.month).padStart(2, '0')}
          </div>

          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            {/* ➕ 添加日程按钮 */}
            <button 
              className="toastui-calendar-add-button"
              onClick={() => {
                // 创建新事件，默认从当前时间开始，持续1小时
                const now = new Date();
                const end = new Date(now.getTime() + 60 * 60 * 1000); // 1小时后
                
                const newEvent: Event = {
                  id: `local-${Date.now()}`,
                  title: '',
                  startTime: now.toISOString(),
                  endTime: end.toISOString(),
                  location: '',
                  description: '',
                  tags: [],
                  tagId: '',
                  calendarId: '',
                  isAllDay: false,
                  createdAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                  syncStatus: 'pending'
                };
                
                setEditingEvent(newEvent);
                setShowEventEditModal(true);
              }}
              title="添加新日程"
            >
              ＋
            </button>

            {/* ⚙️ 设置按钮 */}
            <button 
              className={`toastui-calendar-nav-button ${showSettings ? 'active' : ''}`}
              onClick={() => setShowSettings(!showSettings)}
              title="日历设置"
              style={{ fontSize: '14px' }}
            >
              ⚙️ 设置
            </button>

            {/* 📍 桌面悬浮窗口按钮 - 仅在Electron环境且非Widget模式下显示 */}
            {window.electronAPI?.isElectron && !isWidgetMode && (
              <button 
                className="toastui-calendar-nav-button"
                onClick={async () => {
                  if (window.electronAPI && window.electronAPI.toggleWidget) {
                    try {
                      const result = await window.electronAPI.toggleWidget();
                      console.log('Widget toggle result:', result);
                    } catch (error) {
                      console.error('Failed to toggle widget:', error);
                    }
                  } else {
                    console.warn('toggleWidget function not available');
                  }
                }}
                title="打开桌面悬浮日历"
                style={{ fontSize: '14px' }}
              >
                📍 悬浮窗
              </button>
            )}

            {/* 视图切换按钮 */}
          <div className="toastui-calendar-view-controls">
            <button 
              className={`toastui-calendar-view-button ${currentView === 'month' ? 'active' : ''}`}
              onClick={() => handleViewChange('month')}
              title="月视图"
            >
              月
            </button>
            <button 
              className={`toastui-calendar-view-button ${currentView === 'week' ? 'active' : ''}`}
              onClick={() => handleViewChange('week')}
              title="周视图"
            >
              周
            </button>
            <button 
              className={`toastui-calendar-view-button ${currentView === 'day' ? 'active' : ''}`}
              onClick={() => handleViewChange('day')}
              title="日视图"
            >
              日
            </button>
            </div>
          </div>
        </div>

        {/* 📅 TUI Calendar 主体 */}
        <div style={{ 
          flex: 1, 
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: isWidgetMode ? '0' : '4px', // 🔧 减少底部边距从 8px 到 4px
          backgroundColor: bgRgba, // 使用可调节的背景色
          borderRadius: isWidgetMode ? '20px' : '4px', // 🎨 Widget 模式使用大圆角
          border: 'none', // 🔧 移除边框
          boxShadow: isWidgetMode 
            ? (calendarOpacity > 0.5 
                ? '0 4px 12px rgba(0,0,0,0.15)' 
                : '0 2px 8px rgba(0,0,0,0.1)') 
            : 'none', // 🎨 Widget 模式添加阴影
          overflow: 'hidden', // 🔧 改回 hidden，让 TUI Calendar 内部的 vlayout-area 处理滚动
          backdropFilter: calendarOpacity < 1 ? 'blur(10px)' : 'none' // 毛玻璃效果
        }}>
        <ToastUIReactCalendar
          ref={calendarRef}
          height="100%"
          view={currentView}
          events={calendarEvents}
          calendars={getCalendars()}
          onClickEvent={handleClickEvent}
          onSelectDateTime={handleSelectDateTime}
          onBeforeCreateEvent={handleBeforeCreateEvent}
          onBeforeUpdateEvent={handleBeforeUpdateEvent}
          onBeforeDeleteEvent={handleBeforeDeleteEvent}
          isReadOnly={false}
          useFormPopup={false}
          useDetailPopup={false}
          week={{
            taskView: calendarSettings.showTask !== false ? ['task'] : false,
            eventView: ['time'],
            showNowIndicator: true,
            showTimezoneCollapseButton: false
          }}
          month={{
            dayNames: ['日', '一', '二', '三', '四', '五', '六'],
            visibleWeeksCount: 4, // 🔧 固定显示 4 周
            workweek: false,
            narrowWeekend: false,
            startDayOfWeek: 0,
            isAlways6Weeks: false, // 🔧 改为 false，让月视图根据实际周数自适应高度
            visibleEventCount: 6 // 🔧 增加可见事件数量从 4 到 6
          }}
          template={{
            // 月视图：星期名称行（日、一、二...）
            monthDayName(model: any) {
              return `<span class="toastui-calendar-template-monthDayName">${model.label}</span>`;
            },
            // 月视图：日期格子头部（显示日期数字）
            monthGridHeader(model: any) {
              // model.date 格式: "2025-10-20"
              // model.ymd 格式: "20251020"
              // model.isToday: 是否是今天
              // 从 date 字符串中提取日期数字
              const dateParts = model.date.split('-'); // ["2025", "10", "20"]
              const dayNumber = parseInt(dateParts[2], 10); // 20
              const month = model.month + 1; // 月份 0-based，需要+1
              
              // 🎨 移除硬编码样式，让 theme 的 today 样式生效
              const todayClass = model.isToday ? 'is-today' : '';
              
              // 为每月1号显示 "月/日" 格式
              if (dayNumber === 1) {
                return `<span class="toastui-calendar-template-monthGridHeader ${todayClass}">${month}/${dayNumber}</span>`;
              }
              
              // 其他日期只显示日期数字
              return `<span class="toastui-calendar-template-monthGridHeader ${todayClass}">${dayNumber}</span>`;
            },
            // 周视图：星期名称+日期行（Sun 19, Mon 20...）
            weekDayName(model: any) {
              const date = model.date; // 日期数字 (1-31)
              const dateInstance = model.dateInstance; // TZDate 对象
              const isToday = model.isToday; // 是否是今天
              
              // 🎨 移除硬编码样式，让 theme 的 today 样式生效
              const todayClass = isToday ? 'is-today' : '';
              
              if (dateInstance) {
                const month = dateInstance.getMonth() + 1;
                
                // 为每月1号显示 "月/日" 格式
                if (date === 1) {
                  return `<span class="toastui-calendar-template-weekDayName ${todayClass}">${month}/${date}</span>`;
                }
              }
              
              // 其他日期只显示日期数字
              return `<span class="toastui-calendar-template-weekDayName ${todayClass}">${date}</span>`;
            }
          }}
          theme={{
            common: {
              border: isWidgetMode ? 'none' : `1px solid ${getAdaptiveColors.borderLight}`, // 🎨 自适应边框
              backgroundColor: isWidgetMode ? 'transparent' : bgRgba, // 🎨 自适应背景
              holiday: {
                color: getAdaptiveColors.holiday // 🎨 自适应假日颜色
              },
              saturday: {
                color: getAdaptiveColors.textPrimary // 🎨 自适应文字
              },
              dayName: {
                color: getAdaptiveColors.textSecondary // 🎨 自适应文字
              }
            },
            month: {
              dayName: {
                borderLeft: 'none',
                borderBottom: `1px solid ${getAdaptiveColors.borderLight}`, // 🎨 自适应边框
                paddingLeft: '8px',
                textAlign: 'left',
                backgroundColor: getAdaptiveColors.bgOverlay // 🎨 自适应背景
              },
              holidayExceptThisMonth: {
                color: getAdaptiveColors.textDisabled // 🎨 自适应文字
              },
              dayExceptThisMonth: {
                color: getAdaptiveColors.textDisabled // 🎨 自适应文字
              },
              weekend: {
                backgroundColor: getAdaptiveColors.weekend // 🎨 自适应周末背景
              },
              today: {
                color: getAdaptiveColors.accentColor, // 🎨 自适应高亮色
                backgroundColor: getAdaptiveColors.accentLight // 🎨 自适应高亮背景
              },
              moreView: {
                border: `1px solid ${getAdaptiveColors.borderMedium}`, // 🎨 自适应边框
                boxShadow: getAdaptiveColors.isDark 
                  ? '0 2px 8px rgba(0,0,0,0.5)' 
                  : '0 2px 8px rgba(0,0,0,0.1)',
                backgroundColor: bgRgba, // 🎨 自适应背景
                width: 280,
                height: 280
              }
            },
            week: {
              today: {
                color: getAdaptiveColors.accentColor, // 🎨 自适应高亮色
                backgroundColor: getAdaptiveColors.accentLight // 🎨 自适应高亮背景
              },
              pastDay: {
                color: getAdaptiveColors.textDisabled // 🎨 自适应过去日期
              },
              dayName: {
                borderTop: `1px solid ${getAdaptiveColors.borderLight}`, // 🎨 自适应边框
                borderBottom: `1px solid ${getAdaptiveColors.borderLight}`, // 🎨 自适应边框
                borderLeft: 'none',
                paddingLeft: '8px',
                backgroundColor: getAdaptiveColors.bgOverlay, // 🎨 自适应背景
                color: getAdaptiveColors.textSecondary // 🎨 自适应文字
              },
              panelResizer: {
                border: `1px solid ${getAdaptiveColors.borderLight}` // 🎨 自适应边框
              },
              dayGrid: {
                borderRight: `1px solid ${getAdaptiveColors.borderLight}` // 🎨 自适应边框
              },
              dayGridLeft: {
                width: '72px',
                backgroundColor: getAdaptiveColors.bgOverlay, // 🎨 自适应背景
                borderRight: `1px solid ${getAdaptiveColors.borderMedium}`, // 🎨 自适应边框
                color: getAdaptiveColors.textSecondary // 🎨 自适应文字
              },
              timeGrid: {
                borderRight: `1px solid ${getAdaptiveColors.borderLight}` // 🎨 自适应边框
              },
              timeGridLeft: {
                width: '72px',
                backgroundColor: getAdaptiveColors.bgOverlay, // 🎨 自适应背景
                borderRight: `1px solid ${getAdaptiveColors.borderMedium}`, // 🎨 自适应边框
                color: getAdaptiveColors.textSecondary // 🎨 自适应文字
              },
              timeGridLeftAdditionalTimezone: {
                backgroundColor: getAdaptiveColors.bgHover // 🎨 自适应背景
              },
              nowIndicatorLabel: {
                color: getAdaptiveColors.holiday // 🎨 使用假日颜色作为"现在"指示器
              },
              nowIndicatorPast: {
                border: `1px dashed ${getAdaptiveColors.holiday}` // 🎨 自适应边框
              },
              nowIndicatorBullet: {
                backgroundColor: getAdaptiveColors.holiday // 🎨 自适应背景
              },
              nowIndicatorToday: {
                border: `1px solid ${getAdaptiveColors.holiday}` // 🎨 自适应边框
              },
              nowIndicatorFuture: {
                border: 'none'
              },
              pastTime: {
                color: getAdaptiveColors.textDisabled // 🎨 自适应过去时间
              },
              futureTime: {
                color: getAdaptiveColors.textPrimary // 🎨 自适应未来时间
              },
              gridSelection: {
                backgroundColor: getAdaptiveColors.accentLight, // 🎨 自适应选中背景
                border: `1px solid ${getAdaptiveColors.accentColor}` // 🎨 自适应选中边框
              }
            }
          }}
        />
        </div>

        {/* 📊 状态栏 - Widget 模式下由 DesktopCalendarWidget 独立显示 */}
        {!isWidgetMode && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 12px', // 🔧 减少 padding 从 8px 到 6px
            background: bgRgba,
            borderRadius: '4px',
            border: `1px solid ${getAdaptiveColors.borderMedium}`, // 🎨 自适应边框
            fontSize: '12px',
            color: getAdaptiveColors.textSecondary, // 🎨 自适应文字颜色
            flexShrink: 0,
            marginTop: '4px', // 🔧 添加上边距，与日历主体保持 4px 间距
            backdropFilter: calendarOpacity < 1 ? 'blur(10px)' : 'none'
          }}>
            <span>
              📈 共 <strong style={{ color: getAdaptiveColors.accentColor }}>{events.length}</strong> 个事件
            </span>
            {lastSyncTime && (
              <span>
                🔄 最后同步: <strong style={{ color: getAdaptiveColors.textPrimary }}>{lastSyncTime.toLocaleString('zh-CN')}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* ✏️ 事件编辑弹窗 */}
      <EventEditModal
        event={editingEvent}
        isOpen={showEventEditModal}
        onClose={() => {
          setShowEventEditModal(false);
          setEditingEvent(null);
          // 清除 TUI Calendar 的时间段选择状态
          if (calendarRef.current) {
            const instance = calendarRef.current.getInstance();
            if (instance) {
              instance.clearGridSelections();
            }
          }
        }}
        onSave={handleSaveEventFromModal}
        onDelete={handleDeleteEventFromModal}
        hierarchicalTags={getAvailableTagsForSettings()}
        availableCalendars={getAvailableCalendarsForSettings()}
      />

      {/* ⚙️ 设置面板 */}
      <CalendarSettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        settings={calendarSettings}
        onSettingsChange={handleSettingsChange}
        availableTags={getAvailableTagsForSettings()}
        availableCalendars={getAvailableCalendarsForSettings()}
        isWidgetMode={isWidgetMode}
        widgetOpacity={calendarOpacity}
        widgetColor={calendarBackgroundColor}
        widgetLocked={widgetLocked}
        onWidgetOpacityChange={onWidgetOpacityChange}
        onWidgetColorChange={onWidgetColorChange}
        onWidgetLockToggle={onWidgetLockToggle}
      />
    </>
  );
};

export default TimeCalendar;