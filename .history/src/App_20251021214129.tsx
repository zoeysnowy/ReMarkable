import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MicrosoftCalendarService } from './services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from './services/ActionBasedSyncManager';
import { EventManager } from './components/EventManager';
import TaskManager from './components/TaskManager';
import CalendarSync from './components/CalendarSync';
import FigmaTagManagerV3 from './components/FigmaTagManagerV3';
import TimeCalendar from './components/TimeCalendar';
import DescriptionEditor from './components/DescriptionEditor';
// import UnifiedTimeline from './components/UnifiedTimeline'; // 暂时未使用
import AppLayout, { PageType } from './components/AppLayout';
import PageContainer from './components/PageContainer';
import WidgetPage from './pages/WidgetPage'; // 悬浮窗口页面
import WidgetPage_v3 from './pages/WidgetPage_v3'; // 悬浮窗口页面 v3（完全复刻测试页）
import DesktopCalendarTest from './pages/DesktopCalendarTest'; // 测试页面
import { MicrosoftAuthDemo } from './components/MicrosoftAuthDemo'; // Microsoft认证演示
import { TimerCard } from './components/TimerCard'; // 计时卡片组件
import { DailyStatsCard } from './components/DailyStatsCard'; // 今日统计卡片组件
import { TimerSession, Event } from './types';
import { formatTimeForStorage } from './utils/timeUtils';
import { STORAGE_KEYS, CacheManager } from './constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from './utils/persistentStorage';
import { TagService } from './services/TagService';
import ClickTracker from './components/ClickTracker';
import { EventEditModal } from './components/EventEditModal';
import SettingsModal from './components/SettingsModal';
import './App.css';

// 🚀 性能优化：生产环境禁用 console.log
if (process.env.NODE_ENV === 'production') {
  const noop = () => {};
  console.log = noop;
  console.debug = noop;
  // 保留 warn 和 error
}

// 检查是否为悬浮窗口模式
const isWidgetMode = window.location.hash === '#/widget';
const isWidgetModeV3 = window.location.hash === '#/widget-v3';

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
            console.warn('⚠️ 使用 ReMarkableCache.clearOnlyRuntime() 清除运行时缓存，或 ReMarkableCache.clearAll() 清除所有数据');
          },
          clearOnlyRuntime: CacheManager.clearAllCache,
          clearAll: () => {
            CacheManager.clearAllCache();
            PersistentStorage.clear(PERSISTENT_OPTIONS.TAGS);
            console.log('🧹 所有数据已清除，包括持久化存储');
          },
          info: CacheManager.getCacheInfo,
          version: () => localStorage.getItem('remarkable-storage-version'),
          // 新增持久化存储调试工具
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

  // 监听TagService的变化
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

  // 基础状态
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [currentTask, setCurrentTask] = useState('');
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 服务和同步管理器状态
  const [syncManager, setSyncManager] = useState<any>(null);
  const [microsoftService] = useState<any>(microsoftCalendarService);
  const [lastAuthState, setLastAuthState] = useState(false);

  // 编辑相关状态
  const [editingEventId, setEditingEventId] = useState('');
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventDescription, setEditingEventDescription] = useState('');
  const [editingEventTagId, setEditingEventTagId] = useState('');
  const [availableTagsForEdit, setAvailableTagsForEdit] = useState<any[]>([]);
  const [showEventEditModal, setShowEventEditModal] = useState(false);

  // 当前计时任务描述编辑器状态
  const [currentTaskEditor, setCurrentTaskEditor] = useState({
    isOpen: false,
    title: '',
    description: '',
    tags: [] as string[]
  });

  // 全局计时器状态
  const [globalTimer, setGlobalTimer] = useState<{
    isRunning: boolean;
    tagId: string;
    tagName: string;
    tagEmoji?: string; // 标签emoji
    tagColor?: string; // 标签颜色
    startTime: number; // 当前计时周期的开始时间（用于计算当前运行时长）
    originalStartTime: number; // 真正的开始时间（用户设置或初始开始时间）
    elapsedTime: number;
    isPaused: boolean;
    eventEmoji?: string; // 用户自定义事件emoji
    eventTitle?: string; // 用户自定义事件标题
  } | null>(null);

  // 标签数据状态 - 同步FigmaTagManager的标签变化
  const [appTags, setAppTags] = useState<any[]>([]);

  // 处理标签变化的回调函数
  const handleTagsChange = useCallback((newTags: any[]) => {
    console.log('🏷️ [App] Received tags update from FigmaTagManager:', newTags.length);
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
          parentId: tag.parentId,
          calendarMapping: tag.calendarMapping
        }));
        
        TagService.updateTags(hierarchicalTags);
        console.log('✅ [App] Successfully synced tags to TagService');
      } catch (error) {
        console.error('❌ [App] Failed to sync tags to TagService:', error);
      }
    }
  }, []);

  // 事件数据状态（用于首页统计）
  const [allEvents, setAllEvents] = useState<Event[]>([]);

  // 加载所有事件数据
  useEffect(() => {
    const loadEvents = () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
        if (saved) {
          const events = JSON.parse(saved);
          setAllEvents(events);
          console.log('📊 [App] Loaded events for stats:', events.length);
        }
      } catch (error) {
        console.error('❌ [App] Failed to load events:', error);
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

  // 计时器编辑模态框状态
  const [timerEditModal, setTimerEditModal] = useState<{
    isOpen: boolean;
    event: Event | null;
  }>({
    isOpen: false,
    event: null
  });

  // 应用设置状态
  const [appSettings, setAppSettings] = useState({
    selectedCalendarId: '',
    calendarGroups: [] as any[],
    hierarchicalTags: [] as any[],
    syncConfig: {},
    lastUpdated: '',
    theme: 'light'
  });

  // Click Tracker 调试状态
  const [clickTrackerEnabled, setClickTrackerEnabled] = useState(false);

  // Click Tracker 切换函数
  const toggleClickTracker = () => {
    setClickTrackerEnabled(prev => !prev);
  };

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 页面状态管理
  const [currentPage, setCurrentPage] = useState<PageType>('home');
  
  // 增强的页面切换处理器
  const handlePageChange = useCallback((page: PageType) => {
    console.log(`📄 [App] Page change requested: ${currentPage} -> ${page}`);
    
    // Electron环境下的额外调试
    if (window.electronAPI?.debugLog) {
      window.electronAPI.debugLog('App page change', {
        from: currentPage,
        to: page,
        timestamp: new Date().toISOString()
      });
    }
    
    setCurrentPage(page);
    console.log(`📄 [App] Page state updated to: ${page}`);
  }, [currentPage]);

  // 设置模态框状态
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  // UnifiedTimeline引用 (暂时移除，等待后续实现)
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
      console.warn('设置加载失败:', error);
    }
    setSettingsLoaded(true);
  };

  const saveAppSettings = (newSettings: Partial<typeof appSettings>) => {
    const updated = { ...appSettings, ...newSettings, lastUpdated: formatTimeForStorage(new Date()) };
    setAppSettings(updated);
    localStorage.setItem('remarkable-settings', JSON.stringify(updated));
  };

  // 加载可编辑标签列表
  const loadAvailableTagsForEdit = () => {
    const flatTags = TagService.getFlatTags();
    setAvailableTagsForEdit(flatTags);
  };

  // 全局计时器管理函数
  const handleTimerStart = (tagId: string) => {
    const tag = TagService.getFlatTags().find(t => t.id === tagId);
    if (!tag) {
      console.error('标签未找到:', tagId);
      return;
    }

    console.log('🏷️ [Timer] 开始计时，标签信息:', {
      id: tag.id,
      name: tag.name,
      emoji: tag.emoji,
      color: tag.color
    });

      const startTime = Date.now();
      setGlobalTimer({
        isRunning: true,
        tagId: tagId,
        tagName: tag.name,
        tagEmoji: tag.emoji, // 传递标签emoji
        tagColor: tag.color, // 传递标签颜色
        startTime: startTime,
        originalStartTime: startTime, // 保存真正的开始时间
        elapsedTime: 0,
        isPaused: false
      });    console.log('⏰ 开始计时:', tag.name);
  };

  const handleTimerPause = () => {
    if (!globalTimer) return;

    const currentElapsed = globalTimer.elapsedTime + (Date.now() - globalTimer.startTime);
    
    setGlobalTimer({
      ...globalTimer,
      isRunning: false,
      isPaused: true,
      elapsedTime: currentElapsed
    });

    console.log('⏸️ 暂停计时');
  };

  const handleTimerResume = () => {
    if (!globalTimer) return;

    setGlobalTimer({
      ...globalTimer,
      isRunning: true,
      isPaused: false,
      startTime: Date.now()
    });

    console.log('▶️ 继续计时');
  };

  const handleTimerCancel = () => {
    if (!globalTimer) return;
    
    if (window.confirm('确定要取消计时吗？当前计时将不会被保存。')) {
      console.log('❌ 取消计时');
      setGlobalTimer(null);
    }
  };

  const handleStartTimeChange = (newStartTime: number) => {
    if (!globalTimer) return;
    
    // 验证时间戳有效性
    if (!newStartTime || isNaN(newStartTime) || newStartTime <= 0) {
      console.error('❌ [App] 无效的开始时间戳:', newStartTime);
      return;
    }
    
    const now = Date.now();
    
    // 🔧 关键修复：使用 originalStartTime 而不是 startTime
    const oldOriginalStartTime = globalTimer.originalStartTime || globalTimer.startTime;
    
    // 计算用户想要的时间差
    // 如果提前开始时间（newStartTime < oldOriginalStartTime），应该增加已计时时长
    // 如果推迟开始时间（newStartTime > oldOriginalStartTime），应该减少已计时时长
    const timeDiff = oldOriginalStartTime - newStartTime; // 正数=提前开始（增加时长），负数=延后开始（减少时长）
    
    console.log('⏰ [App] 修改开始时间:', {
      旧原始开始时间: new Date(oldOriginalStartTime).toLocaleString(),
      新开始时间: new Date(newStartTime).toLocaleString(),
      时间差毫秒: timeDiff,
      时间差分钟: Math.round(timeDiff / 60000),
      当前elapsedTime毫秒: globalTimer.elapsedTime,
      当前elapsedTime分钟: Math.round(globalTimer.elapsedTime / 60000),
      isRunning: globalTimer.isRunning
    });
    
    if (globalTimer.isRunning) {
      // 计时中：需要考虑当前运行时长
      const currentRunningTime = now - globalTimer.startTime; // 当前这轮运行的时长
      const totalElapsed = globalTimer.elapsedTime + currentRunningTime; // 总已用时长
      
      // 调整后的总时长 = 原总时长 + 时间差
      const adjustedTotalElapsed = Math.max(0, totalElapsed + timeDiff);
      
      // 重新设置计时器，更新 originalStartTime 和 elapsedTime
      setGlobalTimer({
        ...globalTimer,
        startTime: now, // 重置为当前时间（用于下次计算运行时长）
        originalStartTime: newStartTime, // 更新真正的开始时间
        elapsedTime: adjustedTotalElapsed // 调整后的已用时长
      });
      
      console.log('⏰ [App] 计时中修改结果:', {
        当前运行时长毫秒: currentRunningTime,
        原总时长毫秒: totalElapsed,
        调整后总时长毫秒: adjustedTotalElapsed,
        调整后总时长分钟: Math.round(adjustedTotalElapsed / 60000)
      });
    } else {
      // 暂停中：直接调整 elapsedTime 和 originalStartTime
      const adjustedElapsedTime = Math.max(0, globalTimer.elapsedTime + timeDiff);
      
      setGlobalTimer({
        ...globalTimer,
        originalStartTime: newStartTime, // 更新真正的开始时间
        elapsedTime: adjustedElapsedTime
      });
      
      console.log('⏰ [App] 暂停中修改结果:', {
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
    const startTime = new Date(endTime.getTime() - totalElapsed);
    
    console.log('⏹️ 停止计时，总时长:', totalElapsed, 'ms');
    console.log('⏹️ 计时器信息:', {
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
        console.error('❌ 标签未找到:', globalTimer.tagId);
        return;
      }

      // 创建新事件，使用用户自定义的标题和emoji（如果有）
      const eventTitle = globalTimer.eventTitle || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
      const eventEmoji = globalTimer.eventEmoji || tag.emoji;
      
      const newEvent: Event = {
        id: `timer-${Date.now()}`,
        title: eventTitle, // 使用用户自定义或标签名称
        startTime: formatTimeForStorage(startTime),
        endTime: formatTimeForStorage(endTime),
        tags: [globalTimer.tagId],
        tagId: globalTimer.tagId,
        description: `专注计时 ${Math.floor(totalElapsed / 60000)} 分钟`,
        isAllDay: false,
        remarkableSource: true, // 🔧 标记为本地创建的事件
        syncStatus: 'pending' as const, // 🔧 标记为待同步
        isTimer: true,
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date())
      };

      // 保存到 localStorage
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const existingEvents = saved ? JSON.parse(saved) : [];
      existingEvents.push(newEvent);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      
      // 更新本地状态以触发统计更新
      setAllEvents(existingEvents);
      
      console.log('✅ [App] 事件已创建:', newEvent);

      // � 立即切换到时间页面，不等待同步完成（避免卡顿）
      setCurrentPage('time');

      // �🔄 异步同步到 Outlook（不阻塞 UI）
      if (syncManager) {
        // 使用 setTimeout 将同步操作放到下一个事件循环
        setTimeout(async () => {
          try {
            await syncManager.recordLocalAction('create', 'event', newEvent.id, newEvent);
            console.log('✅ [App] 事件已异步同步到 Outlook');
          } catch (error) {
            console.error('❌ [App] 异步同步失败:', error);
          }
        }, 0);
      }
    } catch (error) {
      console.error('❌ [App] 创建事件失败:', error);
    }
    
    // 清除计时器状态
    setGlobalTimer(null);
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

    // 创建临时事件对象供编辑
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

  // 保存计时器事件编辑
  const handleTimerEditSave = (updatedEvent: Event) => {
    // 提取emoji（使用Array.from正确处理多字节字符）
    const titleChars = Array.from(updatedEvent.title);
    const firstChar = titleChars.length > 0 ? titleChars[0] : '';
    
    // 如果没有计时器，创建新的计时器
    if (!globalTimer) {
      // 必须选择至少一个标签
      if (!updatedEvent.tags || updatedEvent.tags.length === 0) {
        alert('请至少选择一个标签');
        return;
      }

      const tagId = updatedEvent.tags[0];
      const tag = TagService.getFlatTags().find(t => t.id === tagId);
      
      if (!tag) {
        alert('标签不存在');
        return;
      }

      // 确定计时起始时间
      // 1. 如果用户修改了开始时间（与当前时间差距超过1分钟），使用用户设置的时间
      // 2. 否则使用当前时间（点击保存的时间）
      const eventStartTime = new Date(updatedEvent.startTime);
      const now = new Date();
      const timeDiff = Math.abs(now.getTime() - eventStartTime.getTime());
      const useEventTime = timeDiff > 60000; // 超过1分钟认为用户修改了时间
      
      const timerStartTime = useEventTime ? eventStartTime.getTime() : Date.now();

      console.log('⏰ [Timer Init] Determining start time:', {
        eventStartTime: eventStartTime.toISOString(),
        currentTime: now.toISOString(),
        timeDiff: `${(timeDiff / 1000).toFixed(1)}s`,
        useEventTime,
        finalStartTime: new Date(timerStartTime).toISOString()
      });

      // 创建新的计时器
      setGlobalTimer({
        isRunning: true,
        tagId: tagId,
        tagName: tag.name,
        tagEmoji: tag.emoji, // 添加标签emoji
        tagColor: tag.color, // 添加标签颜色
        startTime: timerStartTime,
        originalStartTime: eventStartTime.getTime(), // 使用用户设置的事件开始时间
        elapsedTime: 0,
        isPaused: false,
        eventEmoji: firstChar,
        eventTitle: updatedEvent.title || tag.name
      });

      setTimerEditModal({
        isOpen: false,
        event: null
      });
      
      console.log('⏰ 开始新计时:', updatedEvent.title || tag.name);
      return;
    }

    // 更新现有计时器中的自定义内容
    const possibleEmoji = firstChar && firstChar.length > 0 ? firstChar : globalTimer.eventEmoji;
    
    setGlobalTimer({
      ...globalTimer,
      eventTitle: updatedEvent.title,
      eventEmoji: possibleEmoji,
      // 如果标签改变了，也更新标签及其emoji和颜色
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

  // 初始化效果
  useEffect(() => {
    loadAppSettings();
    loadAvailableTagsForEdit();
  }, []);

  // 格式化时间显示
  const formatTime = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 计算今日总专注时间
  const getTodayTotalTime = (): number => {
    const today = new Date().toDateString();
    return timerSessions
      .filter(session => new Date(session.startTime).toDateString() === today)
      .reduce((total, session) => total + session.duration, 0);
  };

  // 计时器控制函数
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

  const stopTimer = () => {
    if (currentTask) {
      // 保存会话记录
      const session: TimerSession = {
        id: Date.now().toString(),
        taskName: currentTask,
        startTime: formatTimeForStorage(new Date(Date.now() - seconds * 1000)),
        endTime: formatTimeForStorage(new Date()),
        duration: seconds,
        description: currentTaskEditor.description || undefined,
        tags: currentTaskEditor.tags.length > 0 ? currentTaskEditor.tags : undefined,
        completedAt: formatTimeForStorage(new Date())
      };
      
      setTimerSessions(prev => {
        const updated = [...prev, session];
        localStorage.setItem('timer-sessions', JSON.stringify(updated));
        return updated;
      });
    }
    
    // 重置状态
    setIsActive(false);
    setCurrentTask('');
    setSeconds(0);
    setCurrentTaskEditor({
      isOpen: false,
      title: '',
      description: '',
      tags: []
    });
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

  // 全局计时器效果 - 强制UI更新以显示实时时间
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
      console.warn('历史会话加载失败:', error);
    }
  }, []);

  // 监听认证状态变化并初始化同步管理器
  useEffect(() => {
    const currentAuthState = microsoftService?.isSignedIn() || false;
    
    if (currentAuthState !== lastAuthState) {
      setLastAuthState(currentAuthState);
      
      if (currentAuthState) {
        console.log('🚀 用户已登录，初始化同步管理器...');
        
        // 创建同步管理器实例
        if (!syncManager) {
          try {
            const newSyncManager = new ActionBasedSyncManager(microsoftService);
            setSyncManager(newSyncManager);
            
            // 启动同步管理器
            newSyncManager.start();
            console.log('✅ 同步管理器初始化成功');
            
            // 暴露到全局用于调试
            if (typeof window !== 'undefined') {
              (window as any).syncManager = newSyncManager;
            }
          } catch (error) {
            console.error('❌ 同步管理器初始化失败:', error);
          }
        } else {
          console.log('🔄 重新启动现有同步管理器...');
          syncManager.start();
        }
      } else {
        console.log('⏸️ 用户已登出，停止同步管理器...');
        if (syncManager) {
          syncManager.stop();
        }
      }
    }
  }, [microsoftService?.isSignedIn()]);

  // 打开当前任务编辑器
  const openCurrentTaskEditor = () => {
    if (!currentTask) return;
    
    // 尝试从localStorage恢复之前的编辑数据
    let description = currentTaskEditor.description;
    let tags = currentTaskEditor.tags;
    
    try {
      const savedData = localStorage.getItem('currentTaskEditData');
      if (savedData) {
        const parsed = JSON.parse(savedData);
        if (parsed.taskName === currentTask) {
          description = parsed.description || '';
          tags = parsed.tags || [];
        }
      }
    } catch (error) {
      console.warn('任务数据恢复失败:', error);
    }
    
    setCurrentTaskEditor({
      isOpen: true,
      title: currentTask,
      description,
      tags
    });
  };

  // 保存当前任务编辑
  const saveCurrentTaskEdit = (description: string, tags: string[]) => {
    setCurrentTaskEditor({
      ...currentTaskEditor,
      isOpen: false,
      description,
      tags
    });
    
    // 同时保存到localStorage作为临时缓存
    const currentTaskData = {
      taskName: currentTask,
      description,
      tags,
      timestamp: Date.now()
    };
    localStorage.setItem('currentTaskEditData', JSON.stringify(currentTaskData));
  };

  // 保存事件更改
  const saveEventChanges = async () => {
    if (!editingEventId) return;
    
    try {
      // 这里应该调用事件更新API
      console.log('保存事件更改:', {
        id: editingEventId,
        title: editingEventTitle,
        description: editingEventDescription,
        tagId: editingEventTagId
      });
      
      setShowEventEditModal(false);
    } catch (error) {
      console.error('保存事件失败:', error);
    }
  };

  // 处理设置变化的回调
  const handleSettingsChange = (settingKey: string, value: any) => {
    saveAppSettings({ [settingKey]: value });
  };

  // 获取当前计时器显示的时间（秒）
  const getCurrentTimerSeconds = (): number => {
    if (globalTimer) {
      const elapsed = globalTimer.elapsedTime + 
        (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);
      return Math.floor(elapsed / 1000);
    }
    return seconds;
  };

  // 获取层级标签的完整路径（例如：#Parent/#Child）
  const getHierarchicalTagPath = (tagId: string): string => {
    const flatTags = TagService.getFlatTags();
    const tag = flatTags.find(t => t.id === tagId);
    
    if (!tag) return '';
    
    // 调试：输出标签信息
    console.log('🏷️ [getHierarchicalTagPath] Tag info:', {
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
      
      console.log('🔗 [getHierarchicalTagPath] Processing tag:', {
        id: currentTag.id,
        name: currentTag.name,
        emoji: currentTag.emoji,
        parentId: currentTag.parentId,
        pathSoFar: pathParts.map(p => `${p.emoji}${p.name}`).join('/')
      });
      
      if (currentTag.parentId) {
        const parentTag = flatTags.find(t => t.id === currentTag.parentId) as any;
        if (parentTag) {
          console.log('✅ [getHierarchicalTagPath] Found parent:', {
            parentId: parentTag.id,
            parentName: parentTag.name,
            parentEmoji: parentTag.emoji
          });
          currentTag = parentTag;
        } else {
          console.warn('⚠️ [getHierarchicalTagPath] Parent not found:', currentTag.parentId);
          break;
        }
      } else {
        console.log('🔚 [getHierarchicalTagPath] No parent, stopping');
        break;
      }
    }
    
    const result = pathParts.map(part => `#${part.emoji || ''}${part.name}`).join('/');
    console.log('✅ [getHierarchicalTagPath] Final path:', result);
    return result;
  };
  
  // 获取最底层标签的颜色
  const getBottomTagColor = (tagId: string): string => {
    const flatTags = TagService.getFlatTags();
    const tag = flatTags.find(t => t.id === tagId);
    return tag?.color || '#3b82f6';
  };

  // 页面渲染函数
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <PageContainer title="首页" subtitle="时间管理与任务概览">
            <div className="home-content" style={{ 
              display: 'grid',
              gridTemplateColumns: '280px 1fr',
              gap: '24px',
              alignItems: 'stretch', /* 改为stretch，让两个卡片高度始终一致 */
              padding: '12px', /* 增加padding以确保阴影完全显示 */
              overflow: 'visible' /* 允许阴影溢出 */
            }}>
              {/* 计时器卡片 - 左侧，固定宽度 */}
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
                  // 打开编辑框让用户选择标签和输入标题
                  handleTimerEdit();
                }}
                onStartTimeChange={handleStartTimeChange}
              />
              
              {/* 今日统计卡片 */}
              <DailyStatsCard events={allEvents} />
            </div>
          </PageContainer>
        );

      case 'time':
        return (
          <PageContainer title="时光" subtitle="时光日志与我的日程" className="time-calendar">
            <TimeCalendar 
              onStartTimer={handleStartTimer}
              microsoftService={microsoftService}
              syncManager={syncManager}
              lastSyncTime={lastSyncTime}
              availableTags={availableTagsForEdit}
            />
          </PageContainer>
        );

      case 'log':
        return (
          <PageContainer title="日志" subtitle="系统日志与操作记录">
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

      case 'tag':
        return (
          <PageContainer title="标签" subtitle="标签管理与专注表盘配置">
            <div className="tag-management-layout">
              {/* 左侧标签设置区域 */}
              <div className="tag-setting-section">
                <div className="section-header">
                  <div className="title-indicator"></div>
                  <h3>标签管理</h3>
                </div>
                
                <div className="tag-management-hint">
                  <p>多标签事件默认同步至首个标签映射的日历</p>
                  <p>子标签删除，事件默认使用父标签及其映射的日历</p>
                  <p>父标签删除，事件默认同步至原先日历</p>
                </div>

                {/* FigmaTagManagerV3 组件 - 使用 emoji-mart 的新版本 */}
                <FigmaTagManagerV3 
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
                  <p>在时光&gt;&gt;专注面板享用</p>
                </div>

                <div className="focus-dials">
                  <div className="dial-item">
                    <span>🧐开学啦</span>
                  </div>
                  <div className="dial-item">
                    <span>😍假期假期</span>
                  </div>
                  <div className="dial-item">
                    <span>🐶实习狗</span>
                  </div>
                  <div className="dial-item add-dial">
                    <span>➕点击添加</span>
                  </div>
                </div>
              </div>
            </div>
          </PageContainer>
        );

      case 'plan':
        return (
          <PageContainer title="计划" subtitle="我的任务与日程安排">
            <div className="plan-layout">
              {/* 左侧我的任务 */}
              <div className="task-section">
                <div className="section-header">
                  <div className="title-indicator"></div>
                  <h3>我的任务</h3>
                </div>
                <TaskManager onStartTimer={handleStartTimer} />
              </div>

              {/* 右侧我的日程 */}
              <div className="event-section">
                <div className="section-header">
                  <div className="title-indicator"></div>
                  <h3>我的日程</h3>
                </div>
                <EventManager 
                  microsoftService={microsoftService}
                  onStartTimer={handleStartTimer}
                />
              </div>
            </div>
          </PageContainer>
        );

      case 'sync':
        return (
          <PageContainer title="同步" subtitle="日历同步设置与状态">
            <CalendarSync 
              microsoftService={microsoftService}
              syncManager={syncManager}
              onSettingsChange={handleSettingsChange}
            />
          </PageContainer>
        );

      case 'test':
        return <DesktopCalendarTest />;

      case 'msauth':
        return (
          <PageContainer title="Microsoft认证测试">
            <MicrosoftAuthDemo />
          </PageContainer>
        );

      default:
        return (
          <PageContainer title="首页">
            <div>未找到页面</div>
          </PageContainer>
        );
    }
  };

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
      {renderCurrentPage()}

      {/* 设置模态框 */}
      <SettingsModal 
        isOpen={showSettingsModal} 
        onClose={() => setShowSettingsModal(false)} 
      />

      {/* 当前任务描述编辑器 */}
      <DescriptionEditor
        isOpen={currentTaskEditor.isOpen}
        title={currentTaskEditor.title}
        initialDescription={currentTaskEditor.description}
        initialTags={currentTaskEditor.tags}
        onSave={saveCurrentTaskEdit}
        onClose={() => setCurrentTaskEditor({ ...currentTaskEditor, isOpen: false })}
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
  // 如果是悬浮窗口模式，直接渲染WidgetPage
  if (isWidgetMode) {
    return <WidgetPage />;
  }
  
  // 否则渲染完整应用
  return <App />;
}
