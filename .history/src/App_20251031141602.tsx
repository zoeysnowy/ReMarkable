import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { MicrosoftCalendarService } from './services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from './services/ActionBasedSyncManager';
import { EventManager } from './components/EventManager';
import TaskManager from './components/TaskManager';
import CalendarSync from './components/CalendarSync';
// import UnifiedTimeline from './components/UnifiedTimeline'; // 暂时未使用
import AppLayout, { PageType } from './components/AppLayout';
import PageContainer from './components/PageContainer';
import DesktopCalendarWidget from './pages/DesktopCalendarWidget';
import { TimerCard } from './components/TimerCard'; // 计时卡片组件
import { DailyStatsCard } from './components/DailyStatsCard'; // 今日统计卡片组件
import { TimerSession, Event } from './types';
import { formatTimeForStorage } from './utils/timeUtils';
import { getCalendarGroupColor, getAvailableCalendarsForSettings } from './utils/calendarUtils';
import { STORAGE_KEYS, CacheManager } from './constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from './utils/persistentStorage';
import { TagService } from './services/TagService';
import { EventService } from './services/EventService';
import ClickTracker from './components/ClickTracker';
import { EventEditModal } from './components/EventEditModal';
import SettingsModal from './components/SettingsModal';
import { SyncNotification } from './components/SyncNotification';
import './App.css';

// 🔧 暂时禁用懒加载，测试性能
import TagManager from './components/TagManager';
import TimeCalendar from './components/TimeCalendar';
import PlanManager, { PlanItem } from './components/PlanManager';

import { logger } from 'utils/logger';

const AppLogger = logger.module('App');
// 🚀 性能优化：生产环境禁用 AppLogger.log
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  AppLogger.log = noop;
  AppLogger.debug = noop;
  // 保留 warn 和 error
}

// 暴露时间工具函数到全局，供控制台调试使用
if (typeof window !== 'undefined') {
  (window as any).formatTimeForStorage = formatTimeForStorage;
}

declare global {
  interface Window {
    microsoftCalendarService: MicrosoftCalendarService;
  }
}

// 在组件外部立即创建服务实例
const microsoftCalendarService = new MicrosoftCalendarService();

// 立即暴露到全局
if (typeof window !== 'undefined') {
  window.microsoftCalendarService = microsoftCalendarService;
}

function App() {
  // 🔧 初始化缓存管理和标签系统
  useEffect(() => {
    const initializeApp = async () => {
      // 缓存管理
      CacheManager.checkAndClearOldCache();
      
      // 初始化标签系统（独立于日历连接）
      await TagService.initialize();
      
      // 暴露调试工具到全局
      if (typeof window !== 'undefined') {
        (window as any).ReMarkableCache = {
          clear: () => {
            AppLogger.warn('⚠️ 使用 ReMarkableCache.clearOnlyRuntime() 清除运行时缓存，或 ReMarkableCache.clearAll() 清除所有数据');
          },
          clearOnlyRuntime: CacheManager.clearAllCache,
          clearAll: () => {
            CacheManager.clearAllCache();
            PersistentStorage.clear(PERSISTENT_OPTIONS.TAGS);
            AppLogger.log('🧹 所有数据已清除，包括持久化存储');
          },
          info: CacheManager.getCacheInfo,
          version: () => localStorage.getItem('remarkable-storage-version'),
          // 新增持久化存储调试工�?
          persistent: {
            info: () => PersistentStorage.getStorageInfo(PERSISTENT_OPTIONS.TAGS),
            getTags: () => PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS),
            setTags: (tags: any) => PersistentStorage.setItem(STORAGE_KEYS.HIERARCHICAL_TAGS, tags, PERSISTENT_OPTIONS.TAGS),
            clear: () => PersistentStorage.clear(PERSISTENT_OPTIONS.TAGS),
            getAllKeys: () => PersistentStorage.getAllKeys(PERSISTENT_OPTIONS.TAGS)
          },
          // 标签服务调试工具
          tags: {
            service: TagService,
            reinitialize: () => TagService.reinitialize(),
            getTags: () => TagService.getTags(),
            getFlatTags: () => TagService.getFlatTags()
          }
        };
      }
    };

    initializeApp();
  }, []);

  // 监听TagService的变�?
  useEffect(() => {
    const handleTagsUpdate = () => {
      loadAvailableTagsForEdit();
    };

    TagService.addListener(handleTagsUpdate);
    
    // 如果TagService已经初始化，立即加载标签
    if (TagService.isInitialized()) {
      loadAvailableTagsForEdit();
    }

    return () => {
      TagService.removeListener(handleTagsUpdate);
    };
  }, []);

  // 基础状�?
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentTask, setCurrentTask] = useState('');
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 服务和同步管理器状�?
  const [syncManager, setSyncManager] = useState<any>(null);
  const [microsoftService] = useState<any>(microsoftCalendarService);
  const [lastAuthState, setLastAuthState] = useState(false);

  // 编辑相关状�?
  const [editingEventId, setEditingEventId] = useState('');
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventDescription, setEditingEventDescription] = useState('');
  const [editingEventTagId, setEditingEventTagId] = useState('');
  const [availableTagsForEdit, setAvailableTagsForEdit] = useState<any[]>([]);
  const [showEventEditModal, setShowEventEditModal] = useState(false);

  // 全局计时器状�?
  const [globalTimer, setGlobalTimer] = useState<{
    isRunning: boolean;
    tagId: string;
    tagName: string;
    tagEmoji?: string; // 标签emoji
    tagColor?: string; // 标签颜色
    startTime: number; // 当前计时周期的开始时间（用于计算当前运行时长�?
    originalStartTime: number; // 真正的开始时间（用户设置或初始开始时间）
    elapsedTime: number;
    isPaused: boolean;
    eventEmoji?: string; // 用户自定义事件emoji
    eventTitle?: string; // 用户自定义事件标�?
  } | null>(null);

  // 标签数据状�?- 同步FigmaTagManager的标签变�?
  const [appTags, setAppTags] = useState<any[]>([]);

  // 处理标签变化的回调函�?
  const handleTagsChange = useCallback((newTags: any[]) => {
    AppLogger.log('🏷�?[App] Received tags update from FigmaTagManager:', newTags.length);
    setAppTags(newTags);
    
    // 同步更新TagService
    if (newTags.length > 0) {
      try {
        // 转换格式以匹配TagService期望的HierarchicalTag接口
        const hierarchicalTags = newTags.map(tag => ({
          id: tag.id,
          name: tag.name,
          color: tag.color,
          emoji: tag.emoji,
          level: tag.level, // 🔧 保留层级信息
          parentId: tag.parentId,
          calendarMapping: tag.calendarMapping
        }));
        
        TagService.updateTags(hierarchicalTags);
        AppLogger.log('�?[App] Successfully synced tags to TagService');
      } catch (error) {
        AppLogger.error('�?[App] Failed to sync tags to TagService:', error);
      }
    }
  }, []);

  // 事件数据状态（用于首页统计�?
  const [allEvents, setAllEvents] = useState<Event[]>([]);

  // 加载所有事件数�?
  useEffect(() => {
    const loadEvents = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
        if (saved) {
          const events = JSON.parse(saved);
          setAllEvents(events);
          AppLogger.log('📊 [App] Loaded events for stats:', events.length);
        }
      } catch (error) {
        AppLogger.error('�?[App] Failed to load events:', error);
      }
    };

    loadEvents();

    // 监听storage变化（当TimeCalendar更新事件时同步）
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === STORAGE_KEYS.EVENTS) {
        loadEvents();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 计时器编辑模态框状�?
  const [timerEditModal, setTimerEditModal] = useState<{
    isOpen: boolean;
    event: Event | null;
  }>({
    isOpen: false,
    event: null
  });

  // 应用设置状�?
  const [appSettings, setAppSettings] = useState({
    selectedCalendarId: '',
    calendarGroups: [] as any[],
    hierarchicalTags: [] as any[],
    syncConfig: {},
    lastUpdated: '',
    theme: 'light'
  });

  // Click Tracker 调试状�?
  const [clickTrackerEnabled, setClickTrackerEnabled] = useState(false);

  // Click Tracker 切换函数
  const toggleClickTracker = () => {
    setClickTrackerEnabled(prev => !prev);
  };

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 页面状态管�?
  const [currentPage, setCurrentPage] = useState<PageType>('home');

  // PlanItem 状态管�?
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  
  // 🔧 优化：移除不必要的依赖，避免频繁重新创建函数
  const handlePageChange = useCallback((page: PageType) => {
    const startTime = performance.now();
    AppLogger.log(`📄 [App] Page change requested: ${currentPage} -> ${page}`);
    
    // Electron环境下的额外调试
    if (window.electronAPI?.debugLog) {
      window.electronAPI.debugLog('App page change', {
        from: currentPage,
        to: page,
        timestamp: new Date().toISOString()
      });
    }
    
    setCurrentPage(page);
    
    // 性能监控
    requestAnimationFrame(() => {
      const duration = performance.now() - startTime;
      AppLogger.log(`📄 [App] Page state updated to: ${page} (${duration.toFixed(2)}ms)`);
      
      if (duration > 100) {
        AppLogger.warn(`⚠️ [App] 页面切换耗时过长: ${duration.toFixed(2)}ms`);
      }
    });
  }, []); // 🔧 移除 currentPage 依赖

  // 设置模态框状�?
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // UnifiedTimeline引用 (暂时移除，等待后续实�?
  // const unifiedTimelineRef = useRef<UnifiedTimelineRef>(null);

  // 设置管理函数
  const loadAppSettings = () => {
    try {
      const settings = localStorage.getItem('remarkable-settings');
      if (settings) {
        const parsed = JSON.parse(settings);
        setAppSettings(prev => ({ ...prev, ...parsed }));
      }
    } catch (error) {
      AppLogger.warn('设置加载失败:', error);
    }
    setSettingsLoaded(true);
  };

  const saveAppSettings = (newSettings: Partial<typeof appSettings>) => {
    const updated = { ...appSettings, ...newSettings, lastUpdated: formatTimeForStorage(new Date()) };
    setAppSettings(updated);
    localStorage.setItem('remarkable-settings', JSON.stringify(updated));
  };

  // 加载可编辑标签列�?
  const loadAvailableTagsForEdit = () => {
    const flatTags = TagService.getFlatTags();
    setAvailableTagsForEdit(flatTags);
  };

  // 全局计时器管理函�?
  const handleTimerStart = (tagId: string) => {
    const tag = TagService.getFlatTags().find(t => t.id === tagId);
    if (!tag) {
      AppLogger.error('标签未找�?', tagId);
      return;
    }

    AppLogger.log('🏷�?[Timer] 开始计时，标签信息:', {
      id: tag.id,
      name: tag.name,
      emoji: tag.emoji,
      color: tag.color
    });

      const startTime = Date.now();
      const timerState = {
        isRunning: true,
        tagId: tagId,
        tagName: tag.name,
        tagEmoji: tag.emoji, // 传递标签emoji
        tagColor: tag.color, // 传递标签颜�?
        startTime: startTime,
        originalStartTime: startTime, // 保存真正的开始时�?
        elapsedTime: 0,
        isPaused: false
      };
      setGlobalTimer(timerState);
      // 💾 持久化到 localStorage，供 Widget 读取
      localStorage.setItem('remarkable-global-timer', JSON.stringify(timerState));
      AppLogger.log('�?开始计�?', tag.name);
  };

  const handleTimerPause = () => {
    if (!globalTimer) return;

    const currentElapsed = globalTimer.elapsedTime + (Date.now() - globalTimer.startTime);
    
    const timerState = {
      ...globalTimer,
      isRunning: false,
      isPaused: true,
      elapsedTime: currentElapsed
    };
    setGlobalTimer(timerState);
    // 💾 持久化暂停状�?
    localStorage.setItem('remarkable-global-timer', JSON.stringify(timerState));

    AppLogger.log('⏸️ 暂停计时');
  };

  const handleTimerResume = () => {
    if (!globalTimer) return;

    const timerState = {
      ...globalTimer,
      isRunning: true,
      isPaused: false,
      startTime: Date.now()
    };
    setGlobalTimer(timerState);
    // 💾 持久化恢复状�?
    localStorage.setItem('remarkable-global-timer', JSON.stringify(timerState));

    AppLogger.log('▶️ 继续计时');
  };

  const handleTimerCancel = () => {
    if (!globalTimer) return;
    
    if (window.confirm('确定要取消计时吗？当前计时将不会被保存�?)) {
      AppLogger.log('�?取消计时');
      
      // 🔧 使用 EventService 删除 Timer 事件
      try {
        const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
        const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
        
        // 使用 EventService 删除事件（skipSync=true 因为这是取消操作，不需要同步删除）
        EventService.deleteEvent(timerEventId, true).then(result => {
          if (result.success) {
            AppLogger.log('�?[Timer Cancel] Event deleted via EventService:', timerEventId);
          } else {
            AppLogger.error('�?[Timer Cancel] EventService deletion failed:', result.error);
          }
        });
      } catch (error) {
        AppLogger.error('�?[Timer Cancel] Failed to delete event:', error);
      }
      
      setGlobalTimer(null);
      // 💾 清除 localStorage 中的 timer 状�?
      localStorage.removeItem('remarkable-global-timer');
    }
  };

  const handleStartTimeChange = (newStartTime: number) => {
    if (!globalTimer) return;
    
    // 验证时间戳有效�?
    if (!newStartTime || isNaN(newStartTime) || newStartTime <= 0) {
      AppLogger.error('�?[App] 无效的开始时间戳:', newStartTime);
      return;
    }
    
    const now = Date.now();
    
    // 🔧 关键修复：使�?originalStartTime 而不�?startTime
    const oldOriginalStartTime = globalTimer.originalStartTime || globalTimer.startTime;
    
    // 计算用户想要的时间差
    // 如果提前开始时间（newStartTime < oldOriginalStartTime），应该增加已计时时�?
    // 如果推迟开始时间（newStartTime > oldOriginalStartTime），应该减少已计时时�?
    const timeDiff = oldOriginalStartTime - newStartTime; // 正数=提前开始（增加时长），负数=延后开始（减少时长�?
    
    AppLogger.log('�?[App] 修改开始时�?', {
      旧原始开始时�? new Date(oldOriginalStartTime).toLocaleString(),
      新开始时�? new Date(newStartTime).toLocaleString(),
      时间差毫�? timeDiff,
      时间差分�? Math.round(timeDiff / 60000),
      当前elapsedTime毫秒: globalTimer.elapsedTime,
      当前elapsedTime分钟: Math.round(globalTimer.elapsedTime / 60000),
      isRunning: globalTimer.isRunning
    });
    
    if (globalTimer.isRunning) {
      // 计时中：需要考虑当前运行时长
      const currentRunningTime = now - globalTimer.startTime; // 当前这轮运行的时�?
      const totalElapsed = globalTimer.elapsedTime + currentRunningTime; // 总已用时�?
      
      // 调整后的总时�?= 原总时�?+ 时间�?
      const adjustedTotalElapsed = Math.max(0, totalElapsed + timeDiff);
      
      // 重新设置计时器，更新 originalStartTime �?elapsedTime
      setGlobalTimer({
        ...globalTimer,
        startTime: now, // 重置为当前时间（用于下次计算运行时长�?
        originalStartTime: newStartTime, // 更新真正的开始时�?
        elapsedTime: adjustedTotalElapsed // 调整后的已用时长
      });
      
      AppLogger.log('�?[App] 计时中修改结�?', {
        当前运行时长毫秒: currentRunningTime,
        原总时长毫�? totalElapsed,
        调整后总时长毫�? adjustedTotalElapsed,
        调整后总时长分�? Math.round(adjustedTotalElapsed / 60000)
      });
    } else {
      // 暂停中：直接调整 elapsedTime �?originalStartTime
      const adjustedElapsedTime = Math.max(0, globalTimer.elapsedTime + timeDiff);
      
      setGlobalTimer({
        ...globalTimer,
        originalStartTime: newStartTime, // 更新真正的开始时�?
        elapsedTime: adjustedElapsedTime
      });
      
      AppLogger.log('�?[App] 暂停中修改结�?', {
        旧elapsedTime毫秒: globalTimer.elapsedTime,
        调整后elapsedTime毫秒: adjustedElapsedTime,
        旧elapsedTime分钟: Math.round(globalTimer.elapsedTime / 60000),
        调整后elapsedTime分钟: Math.round(adjustedElapsedTime / 60000)
      });
    }
  };

  const handleTimerStop = async () => {
    if (!globalTimer) return;

    const totalElapsed = globalTimer.elapsedTime + 
      (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);

    const endTime = new Date();
    const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
    
    AppLogger.log('⏹️ 停止计时，总时�?', totalElapsed, 'ms');
    AppLogger.log('⏹️ 计时器信�?', {
      tagId: globalTimer.tagId,
      tagName: globalTimer.tagName,
      startTime: startTime,
      endTime: endTime,
      duration: totalElapsed
    });

    // 🎯 自动创建日历事件
    try {
      const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
      if (!tag) {
        AppLogger.error('�?标签未找�?', globalTimer.tagId);
        return;
      }

      // 🔧 使用与实时保存相同的事件ID
      const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
      
      // 创建或更新事件，使用用户自定义的标题和emoji（如果有�?
      const eventTitle = globalTimer.eventTitle || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
      const eventEmoji = globalTimer.eventEmoji || tag.emoji;
      
      const finalEvent: Event = {
        id: timerEventId,
        title: eventTitle, // 🔧 移除"[专注中]"标记
        startTime: formatTimeForStorage(startTime),
        endTime: formatTimeForStorage(new Date(startTime.getTime() + totalElapsed)),
        tags: [globalTimer.tagId],
        tagId: globalTimer.tagId,
        description: `专注计时 ${Math.floor(totalElapsed / 60000)} 分钟`,
        isAllDay: false,
        remarkableSource: true, // 🔧 标记为本地创建的事件
        syncStatus: 'pending' as const, // 🔧 标记为待同步
        isTimer: true,
        createdAt: formatTimeForStorage(startTime),
        updatedAt: formatTimeForStorage(new Date())
      };

      // 🔧 使用 EventService 统一管理事件创建和同�?
      AppLogger.log('�?[Timer Stop] Using EventService to create/update event');
      const result = await EventService.updateEvent(timerEventId, finalEvent);
      
      if (result.success) {
        AppLogger.log('�?[Timer Stop] Event saved via EventService:', timerEventId);
        
        // 更新本地状态以触发统计更新
        setAllEvents(EventService.getAllEvents());
      } else {
        AppLogger.error('�?[Timer Stop] EventService failed:', result.error);
      }

      // �?立即切换到时间页�?
      setCurrentPage('time');
    } catch (error) {
      AppLogger.error('�?[Timer Stop] 保存事件失败:', error);
    }
    
    // 清除计时器状�?
    setGlobalTimer(null);
    // 💾 清除 localStorage 中的 timer 状�?
    localStorage.removeItem('remarkable-global-timer');
  };

  // 打开计时器事件编辑框
  const handleTimerEdit = () => {
    // 如果没有计时器，创建一个初始的临时事件
    if (!globalTimer) {
      const now = new Date();
      const tempEvent: Event = {
        id: `timer-temp-${Date.now()}`,
        title: '',
        startTime: formatTimeForStorage(now),
        endTime: formatTimeForStorage(new Date(now.getTime() + 3600000)), // 默认1小时
        tags: [],
        description: '',
        isAllDay: false,
        remarkableSource: true,
        isTimer: true,
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date())
      };

      setTimerEditModal({
        isOpen: true,
        event: tempEvent
      });
      return;
    }

    // 如果有计时器，使用当前计时器信息
    const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);

    // 创建临时事件对象供编�?
    const totalElapsed = globalTimer.elapsedTime + 
      (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - totalElapsed);

    const tempEvent: Event = {
      id: `timer-temp-${Date.now()}`,
      title: globalTimer.eventTitle || (tag?.name || ''),
      startTime: formatTimeForStorage(startTime),
      endTime: formatTimeForStorage(endTime),
      tags: [globalTimer.tagId],
      tagId: globalTimer.tagId,
      description: '',
      isAllDay: false,
      remarkableSource: true,
      isTimer: true,
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date())
    };

    setTimerEditModal({
      isOpen: true,
      event: tempEvent
    });
  };

  // 保存计时器事件编�?
  const handleTimerEditSave = async (updatedEvent: Event) => {
    // 提取emoji（使用Array.from正确处理多字节字符）
    const titleChars = Array.from(updatedEvent.title);
    const firstChar = titleChars.length > 0 ? titleChars[0] : '';
    
    // 🔧 如果没有计时器，创建新的计时�?
    if (!globalTimer) {
      // 必须选择至少一个标�?
      if (!updatedEvent.tags || updatedEvent.tags.length === 0) {
        alert('请至少选择一个标�?);
        return;
      }

      const tagId = updatedEvent.tags[0];
      const tag = TagService.getFlatTags().find(t => t.id === tagId);
      
      if (!tag) {
        alert('标签不存�?);
        return;
      }

      // 确定计时起始时间
      const eventStartTime = new Date(updatedEvent.startTime);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - eventStartTime.getTime());
      const useEventTime = timeDiff > 60000; // 超过1分钟认为用户修改了时�?
      
      const timerStartTime = useEventTime ? eventStartTime.getTime() : Date.now();

      AppLogger.log('�?[Timer Init] Determining start time:', {
        eventStartTime: eventStartTime.toISOString(),
        currentTime: now.toISOString(),
        timeDiff: `${(timeDiff / 1000).toFixed(1)}s`,
        useEventTime,
        finalStartTime: new Date(timerStartTime).toISOString()
      });

      // 🔧 [关键修复] 使用真实事件ID，与 useEffect 中的ID保持一�?
      const realTimerEventId = `timer-${tagId}-${eventStartTime.getTime()}`;
      
      // 🔧 使用 EventService 创建真实事件（使用真实ID），防止重复
      const eventTitle = updatedEvent.title || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
      const timerEvent: Event = {
        id: realTimerEventId, // 使用真实ID
        title: eventTitle,
        startTime: formatTimeForStorage(eventStartTime),
        endTime: formatTimeForStorage(now), // 初始结束时间为当前时�?
        tags: [tagId],
        tagId: tagId,
        calendarId: (tag as any).calendarId || '',
        location: '',
        description: '计时中的事件',
        isAllDay: false,
        createdAt: formatTimeForStorage(eventStartTime),
        updatedAt: formatTimeForStorage(now),
        syncStatus: 'local-only', // 运行中不同步
        remarkableSource: true,
        isTimer: true
      };

      // 使用 EventService 创建事件（skipSync=true，运行中不同步）
      const result = await EventService.createEvent(timerEvent, true);
      if (result.success) {
        AppLogger.log('�?[Timer Init] Event created via EventService:', realTimerEventId);
      } else {
        AppLogger.error('�?[Timer Init] EventService failed:', result.error);
      }

      // 创建新的计时�?
      setGlobalTimer({
        isRunning: true,
        tagId: tagId,
        tagName: tag.name,
        tagEmoji: tag.emoji, // 添加标签emoji
        tagColor: tag.color, // 添加标签颜色
        startTime: timerStartTime,
        originalStartTime: eventStartTime.getTime(), // 使用用户设置的事件开始时�?
        elapsedTime: 0,
        isPaused: false,
        eventEmoji: firstChar,
        eventTitle: updatedEvent.title || tag.name
      });

      setTimerEditModal({
        isOpen: false,
        event: null
      });
      
      AppLogger.log('�?开始新计时:', updatedEvent.title || tag.name);
      return;
    }

    // 更新现有计时器中的自定义内容
    const possibleEmoji = firstChar && firstChar.length > 0 ? firstChar : globalTimer.eventEmoji;
    
    setGlobalTimer({
      ...globalTimer,
      eventTitle: updatedEvent.title,
      eventEmoji: possibleEmoji,
      // 如果标签改变了，也更新标签及其emoji和颜�?
      ...(updatedEvent.tags && updatedEvent.tags.length > 0 && updatedEvent.tags[0] !== globalTimer.tagId ? (() => {
        const newTag = TagService.getFlatTags().find(t => t.id === updatedEvent.tags![0]);
        return {
          tagId: updatedEvent.tags[0],
          tagName: newTag?.name || globalTimer.tagName,
          tagEmoji: newTag?.emoji || globalTimer.tagEmoji,
          tagColor: newTag?.color || globalTimer.tagColor
        };
      })() : {})
    });

    setTimerEditModal({
      isOpen: false,
      event: null
    });
  };

  // 初始化效�?
  useEffect(() => {
    loadAppSettings();
    loadAvailableTagsForEdit();
  }, []);

  // 🔧 [NEW] Timer 实时保存和显示更�?
  useEffect(() => {
    if (!globalTimer || !globalTimer.isRunning || globalTimer.isPaused) {
      return;
    }

    // 保存 Timer 事件�?localStorage 的函�?
    const saveTimerEvent = async () => {
      try {
        const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
        if (!tag) return;

        const now = Date.now();
        const totalElapsed = globalTimer.elapsedTime + (now - globalTimer.startTime);
        const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
        const endTime = new Date(startTime.getTime() + totalElapsed);

        // 生成或使用现有的事件ID
        const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
        
        const eventTitle = globalTimer.eventTitle || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
        
        const timerEvent: Event = {
          id: timerEventId,
          title: eventTitle, // 🔧 不添�?[专注中]"标记到localStorage，只在UI渲染时添�?
          startTime: formatTimeForStorage(startTime),
          endTime: formatTimeForStorage(endTime),
          location: '',
          description: '计时中的事件',
          tags: [globalTimer.tagId],
          tagId: globalTimer.tagId,
          calendarId: (tag as any).calendarId || '', // 向后兼容旧版标签
          isAllDay: false,
          createdAt: formatTimeForStorage(startTime),
          updatedAt: formatTimeForStorage(new Date()),
          syncStatus: 'local-only', // 🔧 运行中不同步，避免频繁通知
          remarkableSource: true
        };

        // 🔧 使用 EventService，但跳过同步和事件通知（运行中静默保存�?
        const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
        const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
        const eventIndex = existingEvents.findIndex((e: Event) => e.id === timerEventId);
        
        if (eventIndex === -1) {
          existingEvents.push(timerEvent);
          AppLogger.log('�?[Timer] Created timer event:', timerEventId);
        } else {
          existingEvents[eventIndex] = timerEvent;
          AppLogger.log('🔄 [Timer] Updated timer event:', timerEventId);
        }
        
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
        
        // 🔇 不触�?eventsUpdated（避�?TimeCalendar �?EditModal 频繁重渲染）
        // Timer 运行中的更新不需要立即刷�?UI，停止时会触发刷�?
      } catch (error) {
        AppLogger.error('�?[Timer] Failed to save timer event:', error);
      }
    };

    // 立即保存一�?
    saveTimerEvent();

    // 🔧 �?0秒保存一次（降低频率，减少性能影响�?
    const saveInterval = setInterval(saveTimerEvent, 30000);

    // 清理函数
    return () => {
      clearInterval(saveInterval);
    };
  }, [globalTimer]);

  // 🔧 [NEW] 断点保护 - 页面关闭/刷新时保�?Timer
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (globalTimer && globalTimer.isRunning && !globalTimer.isPaused) {
        // 保存最后一次状�?
        try {
          const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
          if (tag) {
            const now = Date.now();
            const totalElapsed = globalTimer.elapsedTime + (now - globalTimer.startTime);
            const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
            const endTime = new Date(startTime.getTime() + totalElapsed);
            const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
            
            const eventTitle = globalTimer.eventTitle || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
            
            const timerEvent: Event = {
              id: timerEventId,
              title: eventTitle, // 保存时移�?[专注中]"标记
              startTime: formatTimeForStorage(startTime),
              endTime: formatTimeForStorage(endTime),
              location: '',
              description: '计时事件（已自动保存�?,
              tags: [globalTimer.tagId],
              tagId: globalTimer.tagId,
              calendarId: (tag as any).calendarId || '', // 向后兼容旧版标签
              isAllDay: false,
              createdAt: formatTimeForStorage(startTime),
              updatedAt: formatTimeForStorage(new Date()),
              syncStatus: 'pending',
              remarkableSource: true
            };

            const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
            const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
            const eventIndex = existingEvents.findIndex((e: Event) => e.id === timerEventId);
            
            if (eventIndex === -1) {
              existingEvents.push(timerEvent);
            } else {
              existingEvents[eventIndex] = timerEvent;
            }
            
            localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
            AppLogger.log('💾 [Timer] Saved timer event before unload:', timerEventId);
          }
        } catch (error) {
          AppLogger.error('�?[Timer] Failed to save on unload:', error);
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [globalTimer]);

  // 格式化时间显�?
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算今日总专注时�?
  const getTodayTotalTime = (): number => {
    const today = new Date().toDateString();
    return timerSessions
      .filter(session => new Date(session.startTime).toDateString() === today)
      .reduce((total, session) => total + session.duration, 0);
  };

  // 计时器控制函�?
  const startTimer = () => {
    if (!taskName.trim()) return;
    
    setCurrentTask(taskName);
    setTaskName('');
    setIsActive(true);
    setSeconds(0);
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  // 组件间通用的计时器启动函数
  const handleStartTimer = (taskTitle: string) => {
    setTaskName(taskTitle);
    setCurrentTask(taskTitle);
    setIsActive(true);
    setSeconds(0);
  };

  // ==================== PlanItem 管理函数 ====================
  
  // 加载 PlanItems
  useEffect(() => {
    const loadPlanItems = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.PLAN_ITEMS);
        if (saved) {
          const items = JSON.parse(saved);
          setPlanItems(items);
          AppLogger.log('📋 [App] 加载计划�?', items.length);
        }
      } catch (error) {
        AppLogger.error('�?[App] 加载计划项失�?', error);
      }
    };

    loadPlanItems();
  }, []);

  // 保存 PlanItem
  const handleSavePlanItem = useCallback((item: PlanItem) => {
    setPlanItems(prev => {
      const exists = prev.find(p => p.id === item.id);
      const updated = exists
        ? prev.map(p => p.id === item.id ? item : p)
        : [...prev, item];
      
      // 持久�?
      localStorage.setItem(STORAGE_KEYS.PLAN_ITEMS, JSON.stringify(updated));
      AppLogger.log('💾 [App] 保存计划�?', item.title);
      
      return updated;
    });
  }, []);

  // 删除 PlanItem
  const handleDeletePlanItem = useCallback((id: string) => {
    setPlanItems(prev => {
      const updated = prev.filter(item => item.id !== id);
      localStorage.setItem(STORAGE_KEYS.PLAN_ITEMS, JSON.stringify(updated));
      AppLogger.log('🗑�?[App] 删除计划�?', id);
      return updated;
    });
  }, []);

  // 创建 UnifiedTimeline Event
  const handleCreateEvent = useCallback(async (event: Event) => {
    const result = await EventService.createEvent(event);
    if (result.success) {
      setAllEvents(EventService.getAllEvents());
      AppLogger.log('�?[App] Event created via EventService:', event.title);
    } else {
      AppLogger.error('�?[App] EventService failed:', result.error);
    }
  }, []);

  // 更新 UnifiedTimeline Event
  const handleUpdateEvent = useCallback(async (eventId: string, updates: Partial<Event>) => {
    const result = await EventService.updateEvent(eventId, updates);
    if (result.success) {
      setAllEvents(EventService.getAllEvents());
      AppLogger.log('�?[App] Event updated via EventService:', eventId);
    } else {
      AppLogger.error('�?[App] EventService failed:', result.error);
    }
  }, []);

  // ==================== End PlanItem 管理 ====================

  const stopTimer = () => {
    if (currentTask) {
      // 保存会话记录
      const session: TimerSession = {
        id: Date.now().toString(),
        taskName: currentTask,
        startTime: formatTimeForStorage(new Date(Date.now() - seconds * 1000)),
        endTime: formatTimeForStorage(new Date()),
        duration: seconds,
        completedAt: formatTimeForStorage(new Date())
      };
      
      setTimerSessions(prev => {
        const updated = [...prev, session];
        localStorage.setItem('timer-sessions', JSON.stringify(updated));
        return updated;
      });
    }
    
    // 重置状�?
    setIsActive(false);
    setCurrentTask('');
    setSeconds(0);
  };

  // 计时器效果（老系统）
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSeconds(prev => prev + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  // 全局计时器效�?- 强制UI更新以显示实时时�?
  useEffect(() => {
    let updateInterval: NodeJS.Timeout | null = null;
    
    if (globalTimer?.isRunning) {
      // 每秒强制更新一次以显示实时时间
      updateInterval = setInterval(() => {
        // 触发重新渲染
        setGlobalTimer(prev => prev ? { ...prev } : null);
      }, 1000);
    }

    return () => {
      if (updateInterval) {
        clearInterval(updateInterval);
      }
    };
  }, [globalTimer?.isRunning]);

  // 加载历史会话
  useEffect(() => {
    try {
      const sessions = localStorage.getItem('timer-sessions');
      if (sessions) {
        setTimerSessions(JSON.parse(sessions));
      }
    } catch (error) {
      AppLogger.warn('历史会话加载失败:', error);
    }
  }, []);

  // 监听认证状态变化并初始化同步管理器
  useEffect(() => {
    const currentAuthState = microsoftService?.isSignedIn() || false;
    
    // 💾 同步认证状态到 localStorage（供 Widget 读取�?
    try {
      localStorage.setItem('remarkable-outlook-authenticated', currentAuthState.toString());
      AppLogger.log('💾 [AUTH] Saved auth status to localStorage:', currentAuthState);
    } catch (error) {
      AppLogger.error('�?[AUTH] Failed to save auth status:', error);
    }
    
    if (currentAuthState !== lastAuthState) {
      setLastAuthState(currentAuthState);
      
      if (currentAuthState) {
        AppLogger.log('🚀 用户已登录，初始化同步管理器...');
        
        // 创建同步管理器实�?
        if (!syncManager) {
          try {
            const newSyncManager = new ActionBasedSyncManager(microsoftService);
            setSyncManager(newSyncManager);
            
            // 🔧 初始�?EventService（注入同步管理器�?
            EventService.initialize(newSyncManager);
            
            // 启动同步管理器（会延�?秒后执行首次同步�?
            newSyncManager.start();
            AppLogger.log('�?同步管理器初始化成功（首次同步延�?秒）');
            AppLogger.log('�?EventService 初始化成�?);
            
            // 暴露到全局用于调试
            if (typeof window !== 'undefined') {
              (window as any).syncManager = newSyncManager;
            }
          } catch (error) {
            AppLogger.error('�?同步管理器初始化失败:', error);
          }
        } else {
          AppLogger.log('�?同步管理器已存在，无需重新启动');
          // 不再重复调用 start()，避免重复同�?
        }
      } else {
        AppLogger.log('⏸️ 用户已登出，停止同步管理�?..');
        if (syncManager) {
          syncManager.stop();
        }
      }
    }
  }, [microsoftService?.isSignedIn()]);

  // 🔄 定期更新 lastSyncTime（与 DesktopCalendarWidget 保持一致）
  useEffect(() => {
    if (!syncManager) return;
    
    const updateSyncTime = () => {
      try {
        const time = syncManager.getLastSyncTime?.();
        if (time) {
          setLastSyncTime(time);
        }
      } catch (error) {
        AppLogger.error('�?[App] 获取同步时间失败:', error);
      }
    };
    
    // 立即更新一�?
    updateSyncTime();
    
    // �?0秒更新一�?
    const syncTimeInterval = setInterval(updateSyncTime, 10000);
    
    return () => clearInterval(syncTimeInterval);
  }, [syncManager]);

  // 保存事件更改
  const saveEventChanges = async () => {
    if (!editingEventId) return;
    
    try {
      // 这里应该调用事件更新API
      AppLogger.log('保存事件更改:', {
        id: editingEventId,
        title: editingEventTitle,
        description: editingEventDescription,
        tagId: editingEventTagId
      });
      
      setShowEventEditModal(false);
    } catch (error) {
      AppLogger.error('保存事件失败:', error);
    }
  };

  // 处理设置变化的回�?
  const handleSettingsChange = (settingKey: string, value: any) => {
    saveAppSettings({ [settingKey]: value });
  };

  // 获取当前计时器显示的时间（秒�?
  const getCurrentTimerSeconds = (): number => {
    if (globalTimer) {
      const elapsed = globalTimer.elapsedTime + 
        (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);
      return Math.floor(elapsed / 1000);
    }
    return seconds;
  };

  // 获取层级标签的完整路径（例如�?Parent/#Child�?
  const getHierarchicalTagPath = (tagId: string): string => {
    const flatTags = TagService.getFlatTags();
    const tag = flatTags.find(t => t.id === tagId);
    
    if (!tag) return '';
    
    // 调试：输出标签信�?
    AppLogger.log('🏷�?[getHierarchicalTagPath] Tag info:', {
      tagId,
      tagName: tag.name,
      emoji: tag.emoji,
      parentId: tag.parentId,
      level: (tag as any).level,
      allTags: flatTags.map(t => ({ 
        id: t.id, 
        name: t.name, 
        parentId: t.parentId,
        level: (t as any).level 
      }))
    });
    
    // 构建层级路径，包含emoji
    const pathParts: { emoji?: string; name: string }[] = [];
    let currentTag = tag;
    
    while (currentTag) {
      pathParts.unshift({
        emoji: currentTag.emoji,
        name: currentTag.name
      });
      
      AppLogger.log('🔗 [getHierarchicalTagPath] Processing tag:', {
        id: currentTag.id,
        name: currentTag.name,
        emoji: currentTag.emoji,
        parentId: currentTag.parentId,
        pathSoFar: pathParts.map(p => `${p.emoji}${p.name}`).join('/')
      });
      
      if (currentTag.parentId) {
        const parentTag = flatTags.find(t => t.id === currentTag.parentId) as any;
        if (parentTag) {
          AppLogger.log('�?[getHierarchicalTagPath] Found parent:', {
            parentId: parentTag.id,
            parentName: parentTag.name,
            parentEmoji: parentTag.emoji
          });
          currentTag = parentTag;
        } else {
          AppLogger.warn('⚠️ [getHierarchicalTagPath] Parent not found:', currentTag.parentId);
          break;
        }
      } else {
        AppLogger.log('🔚 [getHierarchicalTagPath] No parent, stopping');
        break;
      }
    }
    
    const result = pathParts.map(part => `#${part.emoji || ''}${part.name}`).join('/');
    AppLogger.log('�?[getHierarchicalTagPath] Final path:', result);
    return result;
  };
  
  // 获取最底层标签的颜�?
  const getBottomTagColor = (tagId: string): string => {
    const flatTags = TagService.getFlatTags();
    const tag = flatTags.find(t => t.id === tagId);
    return tag?.color || '#3b82f6';
  };

  // 🔧 页面渲染函数 - 使用 useMemo 优化性能
  const renderCurrentPage = useMemo(() => {
    AppLogger.log(`🎨 [App] Rendering page: ${currentPage}`);
    const renderStart = performance.now();
    
    let content;
    switch (currentPage) {
      case 'home':
        content = (
          <PageContainer title="首页" subtitle="时间管理与任务概�?>
            <div className="home-content" style={{ 
              display: 'grid',
              gridTemplateColumns: '280px 1fr',
              gap: '24px',
              alignItems: 'stretch', /* 改为stretch，让两个卡片高度始终一�?*/
              padding: '12px', /* 增加padding以确保阴影完全显�?*/
              overflow: 'visible' /* 允许阴影溢出 */
            }}>
              {/* 计时器卡�?- 左侧，固定宽�?*/}
              <TimerCard
                tagId={globalTimer?.tagId}
                tagName={globalTimer?.tagName}
                tagEmoji={globalTimer ? (() => {
                  const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
                  return tag?.emoji || '⏱️';
                })() : undefined}
                tagPath={globalTimer ? getHierarchicalTagPath(globalTimer.tagId) : undefined}
                tagColor={globalTimer ? getBottomTagColor(globalTimer.tagId) : undefined}
                startTime={globalTimer?.startTime}
                originalStartTime={globalTimer?.originalStartTime}
                elapsedTime={globalTimer?.elapsedTime}
                isRunning={globalTimer?.isRunning}
                eventEmoji={globalTimer?.eventEmoji}
                eventTitle={globalTimer?.eventTitle}
                onPause={globalTimer ? (globalTimer.isRunning ? handleTimerPause : handleTimerResume) : undefined}
                onStop={globalTimer ? handleTimerStop : undefined}
                onCancel={globalTimer ? handleTimerCancel : undefined}
                onEdit={handleTimerEdit}
                onStart={() => {
                  // 打开编辑框让用户选择标签和输入标�?
                  handleTimerEdit();
                }}
                onStartTimeChange={handleStartTimeChange}
              />
              
              {/* 今日统计卡片 */}
              <DailyStatsCard events={allEvents} />
            </div>
          </PageContainer>
        );
        break;

      case 'time':
        content = (
          <PageContainer title="时光" subtitle="时光日志与我的日�? className="time-calendar">
            <TimeCalendar 
              onStartTimer={handleStartTimer}
              microsoftService={microsoftService}
              syncManager={syncManager}
              lastSyncTime={lastSyncTime}
              availableTags={availableTagsForEdit}
              globalTimer={globalTimer}
            />
          </PageContainer>
        );
        break;

      case 'log':
        content = (
          <PageContainer title="日志" subtitle="系统日志与操作记�?>
            <div className="log-section">
              <div className="section-header">
                <div className="title-indicator"></div>
                <h3>系统日志</h3>
              </div>
              <div className="log-placeholder">
                <p>📋 系统操作日志将在这里显示</p>
                <p>包括同步记录、错误日志、操作历史等</p>
              </div>
            </div>
          </PageContainer>
        );
        break;

      case 'tag':
        content = (
          <PageContainer title="标签" subtitle="标签管理与专注表盘配�?>
            <div className="tag-management-layout">
              {/* 左侧标签设置区域 */}
              <div className="tag-setting-section">
                <div className="section-header">
                  <div className="title-indicator"></div>
                  <h3>标签管理</h3>
                </div>
                
                <div className="tag-management-hint">
                  <p>子标签删除，事件默认使用父标签及其映射的日历</p>
                  <p>父标签删除，事件默认同步至原先日�?/p>
                </div>

                {/* TagManager 组件 - 使用 emoji-mart 的新版本 */}
                <TagManager 
                  microsoftService={microsoftService}
                  globalTimer={globalTimer}
                  onTimerStart={handleTimerStart}
                  onTimerPause={handleTimerPause}
                  onTimerResume={handleTimerResume}
                  onTimerStop={handleTimerStop}
                  onTagsChange={handleTagsChange}
                />
              </div>

              {/* 右侧专注表盘配置区域 */}
              <div className="focus-setting-section">
                <div className="section-header">
                  <div className="title-indicator"></div>
                  <h3>配置专注表盘</h3>
                </div>
                
                <div className="focus-hint">
                  <p>点击表盘拖曳标签编辑</p>
                  <p>在时�?gt;&gt;专注面板享用</p>
                </div>

                <div className="focus-dials">
                  <div className="dial-item">
                    <span>🧐开学啦</span>
                  </div>
                  <div className="dial-item">
                    <span>😍假期假期</span>
                  </div>
                  <div className="dial-item">
                    <span>🐶实习�?/span>
                  </div>
                  <div className="dial-item add-dial">
                    <span>➕点击添�?/span>
                  </div>
                </div>
              </div>
            </div>
          </PageContainer>
        );
        break;

      case 'plan':
        content = (
          <PageContainer title="计划" subtitle="我的任务与日程管�?>
            <PlanManager
              items={planItems}
              onSave={handleSavePlanItem}
              onDelete={handleDeletePlanItem}
              availableTags={availableTagsForEdit.map(t => t.name)}
              onCreateEvent={handleCreateEvent}
              onUpdateEvent={handleUpdateEvent}
            />
          </PageContainer>
        );
        break;

      case 'sync':
        content = (
          <PageContainer title="同步" subtitle="日历同步设置与状�?>
            <CalendarSync 
              microsoftService={microsoftService}
              syncManager={syncManager}
              onSettingsChange={handleSettingsChange}
            />
          </PageContainer>
        );
        break;

      default:
        content = (
          <PageContainer title="首页">
            <div>未找到页�?/div>
          </PageContainer>
        );
    }
    
    // 性能监控
    const renderDuration = performance.now() - renderStart;
    AppLogger.log(`�?[App] Page "${currentPage}" rendered in ${renderDuration.toFixed(2)}ms`);
    
    if (renderDuration > 100) {
      AppLogger.warn(`⚠️ [App] Page "${currentPage}" took too long: ${renderDuration.toFixed(2)}ms`);
    }
    
    return content;
  }, [
    currentPage,
    globalTimer,
    allEvents,
    microsoftService,
    syncManager,
    lastSyncTime,
    availableTagsForEdit,
    appTags,
    showEventEditModal,
    handleStartTimer,
    handleTimerPause,
    handleTimerResume,
    handleTimerStop,
    handleTagsChange,
    handleSettingsChange
  ]); // 🔧 关键依赖�?

  return (
    <ClickTracker enabled={clickTrackerEnabled}>
      <AppLayout 
        currentPage={currentPage} 
        onPageChange={handlePageChange}
        clickTrackerEnabled={clickTrackerEnabled}
        onClickTrackerToggle={toggleClickTracker}
        onSettingsClick={() => setShowSettingsModal(true)}
        globalTimer={globalTimer}
        onTimerClick={() => setCurrentPage('home')}
      >
      {renderCurrentPage}

      {/* 同步通知组件 */}
      <SyncNotification />

      {/* 设置模态框 */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />

      {/* 计时器事件编辑模态框 */}
      {timerEditModal.isOpen && timerEditModal.event && (
        <EventEditModal
          event={timerEditModal.event}
          isOpen={timerEditModal.isOpen}
          onClose={() => setTimerEditModal({ isOpen: false, event: null })}
          onSave={handleTimerEditSave}
          hierarchicalTags={TagService.getTags()}
          onStartTimeChange={handleStartTimeChange}
          globalTimer={globalTimer}
          availableCalendars={getAvailableCalendarsForSettings()}
        />
      )}

      {/* 事件编辑模态框 */}
      {showEventEditModal && (
        <div className="edit-modal-overlay">
          <div className="edit-modal" onClick={(e) => e.stopPropagation()}>
            <h3>编辑事件</h3>
            
            <div style={{ marginBottom: '12px' }}>
              <label>标题:</label>
              <input
                type="text"
                value={editingEventTitle}
                onChange={(e) => setEditingEventTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '12px' }}>
              <label>描述:</label>
              <textarea
                value={editingEventDescription}
                onChange={(e) => setEditingEventDescription(e.target.value)}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label>标签:</label>
              <select
                value={editingEventTagId}
                onChange={(e) => setEditingEventTagId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="">选择标签...</option>
                {availableTagsForEdit.map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowEventEditModal(false)}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  backgroundColor: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
              <button
                onClick={saveEventChanges}
                style={{
                  padding: '8px 16px',
                  border: 'none',
                  backgroundColor: '#007acc',
                  color: 'white',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
    </ClickTracker>
  );
}

// 导出主应用或悬浮窗口页面
export default function AppWrapper() {
  // 检查是否为悬浮窗口模式
  const isWidgetMode = window.location.hash === '#/widget-v3';
  
  // 如果是悬浮窗口模式，渲染桌面日历组件
  if (isWidgetMode) {
    return <DesktopCalendarWidget />;
  }
  
  // 否则渲染完整应用
  return <App />;
}
