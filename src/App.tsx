import React, { useState, useEffect, useRef } from 'react';
import { MicrosoftCalendarService } from './services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from './services/ActionBasedSyncManager';
import { electronService } from './services/ElectronService';
import { EventManager } from './components/EventManager';
import TaskManager from './components/TaskManager';
import CalendarSync from './components/CalendarSync';
import TagManager from './components/TagManager';
import DescriptionEditor from './components/DescriptionEditor';
import UnifiedTimeline from './components/UnifiedTimeline';
import { TimerSession } from './types';
import { formatTimeForStorage, formatDisplayTime, parseLocalTimeString } from './utils/timeUtils';
import { STORAGE_KEYS, CacheManager } from './constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from './utils/persistentStorage';
import { TagService } from './services/TagService';
import './App.css';

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
  const [currentTask, setCurrentTask] = useState('');
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 服务和同步管理器状态
  const [syncManager, setSyncManager] = useState<any>(null);
  const [microsoftService, setMicrosoftService] = useState<any>(microsoftCalendarService);
  const [lastAuthState, setLastAuthState] = useState(false);

  // 编辑相关状态
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [editingEventDescription, setEditingEventDescription] = useState('');
  const [editingEventTagId, setEditingEventTagId] = useState('');
  const [availableTagsForEdit, setAvailableTagsForEdit] = useState<any[]>([]);
  const [showEventEditModal, setShowEventEditModal] = useState(false);
  const [showTagManager, setShowTagManager] = useState(false);

  // 当前计时任务描述编辑器状态
  const [currentTaskEditor, setCurrentTaskEditor] = useState({
    isOpen: false,
    title: '',
    description: '',
    tags: [] as string[]
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

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 开发调试面板状态
  const [showDebugPanel, setShowDebugPanel] = useState(process.env.NODE_ENV === 'development');

  // 设置管理函数
  const loadAppSettings = () => {
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        setAppSettings(prev => ({ ...prev, ...settings }));
        
        // 应用加载的设置
        // ongoing天数配置已移至UnifiedTimeline组件
        
        // 设置选中的日历
        if (settings.selectedCalendarId && microsoftService) {
          microsoftService.setSelectedCalendar(settings.selectedCalendarId);
        }
        
        console.log('✅ App settings loaded:', settings);
      }
    } catch (error) {
      console.error('❌ Failed to load app settings:', error);
    }
  };

  const saveAppSettings = (newSettings: Partial<typeof appSettings>) => {
    try {
      const updatedSettings = { ...appSettings, ...newSettings };
      setAppSettings(updatedSettings);
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updatedSettings));
      console.log('✅ App settings saved:', updatedSettings);
    } catch (error) {
      console.error('❌ Failed to save app settings:', error);
    }
  };

  // 加载可用标签
  const loadAvailableTagsForEdit = () => {
    try {
      // 使用TagService获取标签
      if (!TagService.isInitialized()) {
        console.log('🏷️ [Tags] TagService not initialized yet, waiting...');
        setAvailableTagsForEdit([]);
        return;
      }

      const flatTags = TagService.getFlatTags();
      console.log('🏷️ [Tags] Loading tags from TagService:', flatTags.length);
      
      // 转换为编辑器需要的格式
      const tagsForEdit = flatTags.map(tag => ({
        id: tag.id,
        name: TagService.getTagDisplayName(tag.id)
      }));
      
      setAvailableTagsForEdit(tagsForEdit);
    } catch (error) {
      console.error('❌ [Tags] Failed to load tags for editing:', error);
      setAvailableTagsForEdit([]);
    }
  };

  // 保存编辑的ongoing事件
  const updateOngoingEvent = async (eventId: string, updates: { title?: string; description?: string; tagId?: string }) => {
    try {
      console.log('🔄 [UPDATE EVENT] Starting update for event:', eventId, 'with updates:', updates);
      
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === eventId);
        
        if (eventIndex !== -1) {
          const originalEvent = events[eventIndex];
          console.log('🔄 [UPDATE EVENT] Original event:', originalEvent);
          
          // 🔍 [NEW] 获取标签的日历映射
          let calendarId = originalEvent.calendarId; // 保持原有的calendarId
          
          if (updates.tagId) {
            console.log('🔍 [TAG-CALENDAR-UPDATE] Tag changed to:', updates.tagId);
            
            // 使用TagService获取标签的日历映射
            try {
              const tag = TagService.getTagById(updates.tagId);
              if (tag && tag.calendarMapping) {
                calendarId = tag.calendarMapping.calendarId;
                console.log('🔍 [TAG-CALENDAR-UPDATE] Updated calendarId to:', calendarId);
              } else {
                console.log('🔍 [TAG-CALENDAR-UPDATE] No calendar mapping found for tag:', updates.tagId);
              }
            } catch (error) {
              console.error('🔍 [TAG-CALENDAR-UPDATE] Error finding tag mapping:', error);
            }
          }

          // 创建更新后的事件对象
          const updatedEvent = {
            ...originalEvent,
            ...updates,
            calendarId, // 🔍 [NEW] 确保包含正确的日历ID
            updatedAt: formatTimeForStorage(new Date()),
            localVersion: (originalEvent.localVersion || 1) + 1,
            lastLocalChange: formatTimeForStorage(new Date()),
            syncStatus: 'pending'
          };

          console.log('🔄 [UPDATE EVENT] Updated event:', updatedEvent);

          // 更新localStorage中的事件
          events[eventIndex] = updatedEvent;
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

          // 📡 [SYNC] 记录同步操作
          if (syncManager) {
            console.log('🔄 [UPDATE EVENT] Recording sync action with calendar ID:', calendarId);
            syncManager.recordLocalAction('update', 'event', eventId, updatedEvent, originalEvent);
          }
          
          console.log('✅ [UPDATE EVENT] Event updated successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to update ongoing event:', error);
      alert('保存失败，请重试');
    }
  };

  // 删除ongoing事件
  const deleteOngoingEvent = async (eventId: string) => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventToDelete = events.find((event: any) => event.id === eventId);
        
        if (eventToDelete) {
          // 立即更新缓存状态 - 缓存已移除，UnifiedTimeline 组件将处理事件管理
          
          // 记录同步操作
          if (syncManager) {
            syncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete);
          }
          
          // 更新localStorage
          const updatedEvents = events.filter((event: any) => event.id !== eventId);
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
          
          console.log('✅ Event deleted successfully');
        }
      }
    } catch (error) {
      console.error('❌ Failed to delete ongoing event:', error);
      alert('删除失败，请重试');
      // UnifiedTimeline 组件将自动处理事件刷新
    }
  };

  // 保存事件更改
  const saveEventChanges = async () => {
    if (!editingEventId) return;
    
    try {
      await updateOngoingEvent(editingEventId, {
        title: editingEventTitle,
        description: editingEventDescription,
        tagId: editingEventTagId
      });
      
      // 关闭弹窗并清空编辑状态
      setShowEventEditModal(false);
      setEditingEventId(null);
      setEditingEventTitle('');
      setEditingEventDescription('');
      setEditingEventTagId('');
      
      console.log('✅ Event changes saved successfully');
    } catch (error) {
      console.error('❌ Failed to save event changes:', error);
      alert('保存失败，请重试');
    }
  };

  // 🔧 开发调试面板清除函数
  const performSmartClear = () => {
    console.log('🧹 开始智能清除...');
    
    // 只清除非持久化的remarkable数据
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('remarkable-') && !key.includes('dev-persistent')) {
        keysToRemove.push(key);
      }
    }
    
    keysToRemove.forEach(key => {
      console.log('清除运行时缓存:', key);
      localStorage.removeItem(key);
    });
    
    // 清除sessionStorage
    sessionStorage.clear();
    
    console.log('✅ 智能清除完成，持久化数据已保留');
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const performDevFriendlyClear = () => {
    console.log('🔧 开发友好清除...');
    
    // 保存重要的持久化数据
    const persistentKeys: Array<{key: string, value: string}> = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && (key.includes('dev-persistent') || key.includes('user-config'))) {
        const value = localStorage.getItem(key);
        if (value !== null) {
          persistentKeys.push({
            key: key,
            value: value
          });
        }
      }
    }
    
    console.log('保存的持久化数据:', persistentKeys.length, '项');
    
    // 清除所有数据
    localStorage.clear();
    sessionStorage.clear();
    
    // 恢复持久化数据
    persistentKeys.forEach(item => {
      localStorage.setItem(item.key, item.value);
      console.log('恢复:', item.key);
    });
    
    console.log('✅ 开发友好清除完成');
    
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const performFullClear = () => {
    if (!window.confirm('⚠️ 这将清除所有数据，包括标签配置！确定要继续吗？')) {
      return;
    }
    
    console.log('🚨 完全清除所有数据...');
    
    localStorage.clear();
    sessionStorage.clear();
    
    if ('caches' in window) {
      caches.keys().then(names => {
        names.forEach(name => {
          console.log('删除缓存:', name);
          caches.delete(name);
        });
      });
    }
    
    // 尝试清除IndexedDB
    if (window.indexedDB && window.indexedDB.deleteDatabase) {
      window.indexedDB.deleteDatabase('meaningful-db');
    }
    
    console.log('✅ 完全清除完成');
    
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  };

  // 应用启动时加载设置
  useEffect(() => {
    loadAppSettings();
    loadAvailableTagsForEdit();
    
    // � [NEW] 监听标签更新事件
    const handleTagsUpdated = () => {
      console.log('🏷️ [Tags] Received tags-updated event, reloading tags');
      loadAvailableTagsForEdit();
    };
    
    window.addEventListener('tags-updated', handleTagsUpdated);
    
    //  [DEBUG] 暴露调试函数到全局
    if (typeof window !== 'undefined') {
      (window as any).debugApp = {
        getAppSettings: () => appSettings,
        getAvailableTags: () => availableTagsForEdit,
        checkTagMapping: (tagId: string) => {
          try {
            const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
            if (!savedTags) return null;
            console.log('🔍 [DEBUG] All tags:', savedTags);
            return savedTags;
          } catch (error) {
            console.error('🔍 [DEBUG] Error loading tags:', error);
            return null;
          }
        },
        getAllEvents: () => {
          try {
            const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
            return savedEvents ? JSON.parse(savedEvents) : [];
          } catch (error) {
            console.error('🔍 [DEBUG] Error loading events:', error);
            return [];
          }
        }
      };
      console.log('🔍 [DEBUG] App debug functions available via window.debugApp');
    }
    
    // 🔧 [NEW] Cleanup函数
    return () => {
      window.removeEventListener('tags-updated', handleTagsUpdated);
    };
  }, []);

  // 服务初始化
  useEffect(() => {
    const initializeServices = async () => {
      try {
        if (syncManager && (window as any).actionBasedSyncManager) {
          return;
        }
        
        if (electronService.isElectron) {
          console.log('🔧 Running in Electron environment');
        }
        
        setMicrosoftService(microsoftCalendarService);
        
        if (typeof window !== 'undefined') {
          window.microsoftCalendarService = microsoftCalendarService;
        }

        const syncMgr = new ActionBasedSyncManager(microsoftCalendarService);
        setSyncManager(syncMgr);

        if (typeof window !== 'undefined') {
          (window as any).actionBasedSyncManager = syncMgr;
          (window as any).syncManager = syncMgr;
        }

        // 🔄 监听同步完成事件
        const handleSyncCompleted = () => {
          console.log('🔄 [App] Sync completed, updating lastSyncTime');
          setLastSyncTime(new Date());
        };

        window.addEventListener('action-sync-completed', handleSyncCompleted);
        window.addEventListener('outlook-sync-completed', handleSyncCompleted);

        // 返回清理函数
        return () => {
          window.removeEventListener('action-sync-completed', handleSyncCompleted);
          window.removeEventListener('outlook-sync-completed', handleSyncCompleted);
        };

      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
      }
    };

    if (!syncManager) {
      initializeServices();
    }
  }, [syncManager]); 

  // 设置初始化
  useEffect(() => {
    if (settingsLoaded) return;
    
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        // ongoing天数配置已移至UnifiedTimeline组件
      }
      
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsLoaded(true);
    }
  }, [settingsLoaded]);

  // 计时器逻辑
  useEffect(() => {
    if (isActive) {
      intervalRef.current = setInterval(() => {
        setSeconds(seconds => seconds + 1);
      }, 1000);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isActive]);

  // 加载计时记录
  useEffect(() => {
    const savedSessions = localStorage.getItem(STORAGE_KEYS.TIMER_SESSIONS);
    if (savedSessions) {
      try {
        const parsedSessions = JSON.parse(savedSessions).map((session: any) => ({
          ...session,
          startTime: new Date(session.startTime),
          endTime: new Date(session.endTime),
          completedAt: new Date(session.completedAt || session.endTime)
        }));
        setTimerSessions(parsedSessions);
      } catch (error) {
        console.error('Failed to load timer sessions:', error);
        setTimerSessions([]);
        localStorage.removeItem(STORAGE_KEYS.TIMER_SESSIONS);
      }
    }
  }, []);

  // 格式化时间函数
  const formatTime = (totalSeconds: number) => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const secs = totalSeconds % 60;
    
    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 获取今日总时间
  const getTodayTotalTime = () => {
    const today = new Date().toDateString();
    const todaySessions = timerSessions.filter(
      (session: TimerSession) => {
        const completedAt = session.completedAt || session.endTime;
        const completedDate = parseLocalTimeString(completedAt);
        return completedDate.toDateString() === today;
      }
    );
    return todaySessions.reduce((total: number, session: TimerSession) => total + session.duration, 0);
  };

  // 计时器控制函数
  const startTimerFromExternal = (taskTitle: string) => {
    setCurrentTask(taskTitle);
    setIsActive(true);
    setSeconds(0);
  };

  const startTimer = () => {
    if (!taskName.trim()) {
      alert('请输入任务名称！');
      return;
    }
    setCurrentTask(taskName);
    setIsActive(true);
    setTaskName('');
    setCurrentTaskEditor({
      isOpen: false,
      title: '',
      description: '',
      tags: []
    });
    localStorage.removeItem('currentTaskEditData');
  };

  const pauseTimer = () => {
    setIsActive(false);
  };

  const stopTimer = () => {
    setIsActive(false);
    if (seconds > 0) {
      const now = new Date();
      const session: TimerSession = {
        id: Date.now().toString(),
        taskName: currentTask,
        duration: seconds,
        startTime: formatTimeForStorage(new Date(now.getTime() - seconds * 1000)),
        endTime: formatTimeForStorage(now),
        completedAt: formatTimeForStorage(now),
        description: currentTaskEditor.description || undefined,
        tags: currentTaskEditor.tags.length > 0 ? currentTaskEditor.tags : undefined
      };
      
      const updatedSessions = [...timerSessions, session];
      setTimerSessions(updatedSessions);
      localStorage.setItem(STORAGE_KEYS.TIMER_SESSIONS, JSON.stringify(updatedSessions));

      alert(`任务"${currentTask}"完成！用时：${formatTime(seconds)}`);
    }
    setSeconds(0);
    setCurrentTask('');
    setCurrentTaskEditor({
      isOpen: false,
      title: '',
      description: '',
      tags: []
    });
    localStorage.removeItem('currentTaskEditData');
  };

  // 打开当前计时任务的描述编辑器
  const openCurrentTaskEditor = () => {
    if (!currentTask) return;
    
    // 尝试从缓存恢复数据
    const cachedData = localStorage.getItem('currentTaskEditData');
    let description = currentTaskEditor.description;
    let tags = currentTaskEditor.tags;
    
    if (cachedData) {
      try {
        const parsed = JSON.parse(cachedData);
        if (parsed.taskName === currentTask) {
          description = parsed.description || '';
          tags = parsed.tags || [];
        }
      } catch (error) {
        console.error('Failed to parse cached task data:', error);
      }
    }
    
    setCurrentTaskEditor({
      isOpen: true,
      title: currentTask,
      description,
      tags
    });
  };

  // 保存当前计时任务的编辑
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

  // 处理设置变化的回调
  const handleSettingsChange = (settingKey: string, value: any) => {
    saveAppSettings({ [settingKey]: value });
  };

  return (
    <div className="container">
      <header>
        <h1>
          ReMarkable - 时间管理工具
          {electronService.isElectron && (
            <span className="platform-indicator" title="桌面应用版本">
              🖥️
            </span>
          )}
        </h1>
        <div className="daily-stats">
          <span>今日专注时间: {formatTime(getTodayTotalTime())}</span>
          <span className="sync-status">
            🔄 {microsoftService && microsoftService.isSignedIn() ? '已连接' : '未连接'}
            {lastSyncTime && microsoftService && microsoftService.isSignedIn() && (
              <span> | 最后同步: {lastSyncTime.toLocaleTimeString()}</span>
            )}
          </span>
          {electronService.isElectron && (
            <span className="electron-status" title="桌面应用功能">
              📱 系统监听: 已启用
            </span>
          )}
          {process.env.NODE_ENV === 'development' && (
            <button
              onClick={() => setShowDebugPanel(!showDebugPanel)}
              style={{
                padding: '4px 8px',
                fontSize: '0.7rem',
                backgroundColor: showDebugPanel ? '#dc3545' : '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                marginLeft: '10px'
              }}
              title="开发调试面板"
            >
              🔧 {showDebugPanel ? '隐藏' : '调试'}
            </button>
          )}
        </div>
      </header>

      <div className="app-layout" style={{ 
        display: 'grid',
        gridTemplateColumns: '1fr',
        gridTemplateRows: 'auto 1fr',
        gap: '20px', 
        height: 'calc(100vh - 200px)' 
      }}>
        {/* 上方区域：计时器 + 智能同步 */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '480px 1fr',
          gap: '20px',
          alignItems: 'start'
        }}>
          {/* 计时器区域 */}
          <div className="timer-section" style={{ 
            marginBottom: '0',
            maxWidth: '460px'
          }}>
            <div className="timer-display">
              <h2 className="time">{formatTime(seconds)}</h2>
              {currentTask && (
                <div className="current-task-section">
                  <p className="current-task">当前任务: {currentTask}</p>
                  <button
                    onClick={openCurrentTaskEditor}
                    className="btn btn-edit-task"
                    title="添加描述和标签"
                  >
                    ✏️ 编辑
                  </button>
                </div>
              )}
            </div>

            {!isActive && !currentTask ? (
              <div className="start-section">
                <input
                  type="text"
                  placeholder="输入任务名称..."
                  value={taskName}
                  onChange={(e) => setTaskName(e.target.value)}
                  className="task-input"
                  onKeyPress={(e) => e.key === 'Enter' && startTimer()}
                />
                <button onClick={startTimer} className="btn btn-start">
                  开始计时
                </button>
              </div>
            ) : (
              <div className="controls">
                {isActive ? (
                  <button onClick={pauseTimer} className="btn btn-pause">
                    暂停
                  </button>
                ) : (
                  <button onClick={() => setIsActive(true)} className="btn btn-resume">
                    继续
                  </button>
                )}
                <button onClick={stopTimer} className="btn btn-stop">
                  结束任务
                </button>
              </div>
            )}
          </div>

          {/* 标签管理区域 - 独立于日历连接状态 */}
          <div className="feature-section" style={{ 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              color: '#495057',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🏷️ 标签系统
            </h3>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={() => setShowTagManager(true)}
                className="btn"
                style={{
                  padding: '8px 16px',
                  fontSize: '0.9rem',
                  backgroundColor: '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  minWidth: '100px'
                }}
              >
                🏷️ 标签管理
              </button>
              <div style={{ 
                fontSize: '0.8rem', 
                color: '#6c757d',
                alignSelf: 'center'
              }}>
                管理标签分类和日历映射
              </div>
            </div>
          </div>

          {/* 智能同步区域 */}
          <div className="feature-section" style={{ 
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.1), 0 2px 8px rgba(0, 0, 0, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            maxHeight: '320px',
            minWidth: '480px',
            overflowY: 'auto'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              color: '#495057',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🔄 智能同步
              {syncManager && syncManager.isActive && syncManager.isActive() && (
                <span className="sync-indicator" style={{ fontSize: '0.8rem' }}>🔄</span>
              )}
            </h3>
            
            {microsoftService && syncManager ? (
              <CalendarSync 
                syncManager={syncManager}
                microsoftService={microsoftService}
                onSettingsChange={handleSettingsChange}
                onTagsUpdated={(tags) => saveAppSettings({ hierarchicalTags: tags })}
              />
            ) : (
              <div style={{ 
                padding: '10px', 
                textAlign: 'center', 
                color: '#666',
                fontSize: '0.9rem'
              }}>
                正在初始化同步服务...
              </div>
            )}
          </div>
        </div>

        {/* 🔧 开发调试面板 */}
        {showDebugPanel && (
          <div className="debug-panel" style={{
            background: 'rgba(255, 255, 255, 0.95)',
            backdropFilter: 'blur(20px)',
            borderRadius: '20px',
            padding: '20px',
            boxShadow: '0 8px 32px rgba(255, 0, 0, 0.1), 0 2px 8px rgba(255, 0, 0, 0.05)',
            border: '2px solid #ff6b6b',
            marginBottom: '20px'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              color: '#dc3545',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              🔧 开发调试面板
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
              <button
                onClick={performSmartClear}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="清除运行时缓存，保留标签配置"
              >
                🧹 智能清除
              </button>
              
              <button
                onClick={performDevFriendlyClear}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="开发友好清除，保留用户配置"
              >
                🔧 友好清除
              </button>
              
              <button
                onClick={performFullClear}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="⚠️ 清除所有数据，包括标签配置"
              >
                🚨 完全清除
              </button>
              
              <button
                onClick={() => {
                  console.log('=== 当前状态 ===');
                  console.log('TagService:', TagService.isInitialized(), TagService.getTags()?.length);
                  console.log('Storage Version:', localStorage.getItem('remarkable-storage-version'));
                  console.log('Persistent Tags:', PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS));
                }}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.9rem',
                  backgroundColor: '#6f42c1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: 'pointer'
                }}
                title="在控制台输出当前状态信息"
              >
                📊 状态检查
              </button>
            </div>
            
            <div style={{
              marginTop: '12px',
              padding: '8px 12px',
              backgroundColor: 'rgba(255, 193, 7, 0.1)',
              borderRadius: '6px',
              fontSize: '0.8rem',
              color: '#856404'
            }}>
              <strong>提示：</strong> 使用"智能清除"进行正常的开发测试，它会保留你的标签配置。
              只有在需要测试全新安装状态时才使用"完全清除"。
            </div>
          </div>
        )}

        {/* 下方区域：统一时间线 + 待办事项 */}
        <div style={{ 
          display: 'grid',
          gridTemplateColumns: '1fr 300px',
          gap: '20px',
          minHeight: '0'
        }}>
          {/* 统一时间线区域 */}
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column',
            minHeight: '0'
          }}>
            {microsoftService && syncManager ? (
              <UnifiedTimeline 
                onStartTimer={startTimerFromExternal}
                microsoftService={microsoftService}
                syncManager={syncManager}
                lastSyncTime={lastSyncTime}
              />
            ) : (
              <div style={{ 
                padding: '20px', 
                textAlign: 'center', 
                color: '#666',
                border: '1px solid #dee2e6',
                borderRadius: '6px',
                backgroundColor: '#f8f9fa'
              }}>
                正在初始化服务...
              </div>
            )}
          </div>

          {/* 待办事项区域 */}
          <div className="feature-section" style={{ 
            display: 'flex',
            flexDirection: 'column',
            minHeight: '0'
          }}>
            <h3 style={{ 
              margin: '0 0 16px 0', 
              fontSize: '1.1rem', 
              color: '#495057',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '0 4px'
            }}>
              📝 待办事项
            </h3>
            
            <div style={{ flex: 1, minHeight: '0', overflowY: 'auto' }}>
              <TaskManager onStartTimer={startTimerFromExternal} />
            </div>
          </div>
        </div>
      </div>

      {/* 事件编辑弹窗 */}
      {showEventEditModal && (
        <div 
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
          onClick={() => setShowEventEditModal(false)}
        >
          <div 
            style={{
              backgroundColor: 'white',
              padding: '24px',
              borderRadius: '8px',
              width: '90%',
              maxWidth: '600px',
              maxHeight: '80vh',
              overflow: 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ marginTop: 0, marginBottom: '20px' }}>编辑事件</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                事件标题:
              </label>
              <input
                type="text"
                value={editingEventTitle}
                onChange={(e) => setEditingEventTitle(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                描述 (日志):
              </label>
              <textarea
                value={editingEventDescription}
                onChange={(e) => setEditingEventDescription(e.target.value)}
                placeholder="在这里写下你的想法、笔记或日志..."
                style={{
                  width: '100%',
                  height: '200px',
                  padding: '12px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px',
                  fontFamily: 'inherit',
                  resize: 'vertical'
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '4px', fontWeight: 'bold' }}>
                标签:
              </label>
              <select
                value={editingEventTagId}
                onChange={(e) => setEditingEventTagId(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  fontSize: '14px'
                }}
              >
                <option value="">选择标签</option>
                {availableTagsForEdit.map((tag) => (
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

      {/* 标签管理器 */}
      <TagManager
        isOpen={showTagManager}
        onClose={() => setShowTagManager(false)}
        microsoftService={microsoftService}
        onTagsUpdated={(tags) => {
          // 标签更新时的回调，TagService会自动处理
          console.log('标签已更新:', tags.length);
        }}
      />
    </div>
  );
}

export default App;
