import React, { useState, useEffect, useRef } from 'react';
import { MicrosoftCalendarService } from './services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from './services/ActionBasedSyncManager';
import { electronService } from './services/ElectronService';
import { EventManager } from './components/EventManager';
import TaskManager from './components/TaskManager';
import CalendarSync from './components/CalendarSync';
import { TimerSession } from './types';
import { formatTimeForStorage, formatDisplayTime, parseLocalTimeString } from './utils/timeUtils';
import { STORAGE_KEYS, CacheManager } from './constants/storage';
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
  // 🔧 初始化缓存管理
  useEffect(() => {
    CacheManager.checkAndClearOldCache();
    
    // 暴露缓存管理工具到全局供调试使用
    if (typeof window !== 'undefined') {
      (window as any).ReMarkableCache = {
        clear: CacheManager.clearAllCache,
        info: CacheManager.getCacheInfo,
        version: () => localStorage.getItem('remarkable-storage-version')
      };
    }
  }, []);

  // 基础状态
  const [seconds, setSeconds] = useState(0);
  const [isActive, setIsActive] = useState(false);
  const [taskName, setTaskName] = useState('');
  const [currentTask, setCurrentTask] = useState('');
  const [timerSessions, setTimerSessions] = useState<TimerSession[]>([]);
  const [activeTab, setActiveTab] = useState('tasks');
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // 服务和同步管理器状态
  const [syncManager, setSyncManager] = useState<any>(null);
  const [microsoftService, setMicrosoftService] = useState<any>(microsoftCalendarService);
  const [lastAuthState, setLastAuthState] = useState(false);

  // 编辑相关状态
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingEventTitle, setEditingEventTitle] = useState('');
  const [ongoingEventsCache, setOngoingEventsCache] = useState<any[]>([]);
  const [editingEventDescription, setEditingEventDescription] = useState('');

  // ongoing 记录配置状态
  const [ongoingDays, setOngoingDays] = useState(1);
  const [tempOngoingDays, setTempOngoingDays] = useState('1');
  const [showOngoingConfig, setShowOngoingConfig] = useState(false);

  // 服务初始化
  useEffect(() => {
    const initializeServices = async () => {
      try {
        // 防止重复初始化
        if (syncManager && (window as any).actionBasedSyncManager) {
          return;
        }
        
        // 🔧 初始化Electron服务
        if (electronService.isElectron) {
          console.log('🔧 Running in Electron environment');
          
          // 获取应用信息
          const appInfo = await electronService.getAppInfo();
          console.log('📱 App Info:', appInfo);
          
          // 启动系统监听
          const monitoringStarted = await electronService.startSystemMonitoring();
          if (monitoringStarted) {
            electronService.onSystemActivity((data) => {
              console.log('🔍 System activity detected:', data);
              // 这里可以记录用户活动日志
            });
          }
          
          // 显示欢迎通知
          await electronService.showNotification(
            'ReMarkable 已启动',
            '智能日历和任务管理应用已准备就绪'
          );
        }
        
        setMicrosoftService(microsoftCalendarService);
        
        if (typeof window !== 'undefined') {
          window.microsoftCalendarService = microsoftCalendarService;
        }

        const syncMgr = new ActionBasedSyncManager(microsoftCalendarService);
        setSyncManager(syncMgr);

        if (typeof window !== 'undefined') {
          (window as any).actionBasedSyncManager = syncMgr;
          (window as any).actionSyncManager = syncMgr;
          (window as any).syncManager = syncMgr;
          (window as any).electronService = electronService;
        }

      } catch (error) {
        console.error('❌ Failed to initialize services:', error);
      }
    };

    if (!syncManager) {
      initializeServices();
    }
  }, [syncManager]); 

  // 🔧 Electron事件监听器
  useEffect(() => {
    if (!electronService.isElectron) return;

    // 监听Electron触发的同步事件
    const handleElectronSync = () => {
      console.log('🔄 Electron triggered sync');
      if (syncManager) {
        syncManager.performSyncNow().catch(console.error);
      }
    };

    // 监听Electron触发的设置事件
    const handleElectronSettings = () => {
      console.log('⚙️ Electron triggered sync settings');
      setShowOngoingConfig(true);
    };

    window.addEventListener('electron-trigger-sync', handleElectronSync);
    window.addEventListener('electron-open-sync-settings', handleElectronSettings);

    return () => {
      window.removeEventListener('electron-trigger-sync', handleElectronSync);
      window.removeEventListener('electron-open-sync-settings', handleElectronSettings);
    };
  }, [syncManager]);

  // 🔧 组件卸载时清理Electron服务
  useEffect(() => {
    return () => {
      if (electronService.isElectron) {
        electronService.cleanup();
      }
    };
  }, []); 

  const [settingsLoaded, setSettingsLoaded] = useState(false);

  // 获取 ongoing 事件
  const getTodayOngoingEvents = () => {
    try {
      const settings = JSON.parse(localStorage.getItem(STORAGE_KEYS.SETTINGS) || '{}');
      const ongoingDaysValue = settings.ongoingDays || 1;
      
      console.log('🔍 [getTodayOngoingEvents] Settings:', `${ongoingDaysValue} days back (from localStorage)`);
      
      const today = new Date();
      const startDate = new Date(today);
      startDate.setDate(today.getDate() - ongoingDaysValue);
      startDate.setHours(0, 0, 0, 0);
      
      const endDate = new Date(today);
      endDate.setDate(today.getDate() + 1);
      endDate.setHours(23, 59, 59, 999);
      
      console.log('🔍 [getTodayOngoingEvents] Filter range:', 
        `${startDate.getFullYear()}/${(startDate.getMonth()+1).toString().padStart(2,'0')}/${startDate.getDate().toString().padStart(2,'0')} to ${endDate.getFullYear()}/${(endDate.getMonth()+1).toString().padStart(2,'0')}/${endDate.getDate().toString().padStart(2,'0')}`
      );
      
      const storedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (!storedEvents) {
        console.log('🔍 [getTodayOngoingEvents] No events in storage');
        return [];
      }
      
      const allEvents = JSON.parse(storedEvents);
      console.log('🔍 [getTodayOngoingEvents] Total events in storage:', allEvents.length);
      
      // 🔧 添加详细的事件分析
      console.log('🔍 [Event Analysis] Breakdown:');
      try {
        allEvents.forEach((event: any, index: number) => {
          try {
            if (!event) {
              console.log(`  ⚠️ Event ${index + 1}: NULL or undefined event`);
              return;
            }
            
            const eventStartTime = event.startTime ? new Date(event.startTime) : new Date(event.createdAt || new Date());
            const isInRange = eventStartTime >= startDate && eventStartTime <= endDate;
            
            console.log(`  📅 Event ${index + 1}: "${event.title || 'No Title'}" | Start: ${eventStartTime.toLocaleString()} | InRange: ${isInRange} | ExternalId: ${event.externalId ? 'Yes' : 'No'} | Category: ${event.category || 'No Category'}`);
          } catch (eventError) {
            console.error(`❌ Error processing event ${index + 1}:`, eventError, event);
          }
        });
      } catch (forEachError) {
        console.error('❌ Error in forEach loop:', forEachError);
      }
      
      const filteredEvents = allEvents.filter((event: any) => {
        try {
          if (!event) {
            console.log('⚠️ Null/undefined event found');
            return false;
          }
          
          if (!event.startTime && !event.createdAt) {
            console.log('⚠️ Event missing both startTime and createdAt:', event);
            return false;
          }
          
          const eventStartTime = new Date(event.startTime || event.createdAt);
          
          // 检查日期是否有效
          if (isNaN(eventStartTime.getTime())) {
            console.log('⚠️ Invalid date for event:', event);
            return false;
          }
          
          const isInRange = eventStartTime >= startDate && eventStartTime <= endDate;
          
          if (!isInRange) {
            console.log(`🚫 Event out of range: "${event.title || 'No Title'}" (${eventStartTime.toLocaleString()})`);
          }
          
          return isInRange;
        } catch (filterError) {
          console.error('❌ Error filtering event:', filterError, event);
          return false;
        }
      });
      
      console.log('🔍 [getTodayOngoingEvents] Filtered events count:', filteredEvents.length);
      console.log('🔍 [getTodayOngoingEvents] Missing events:', allEvents.length - filteredEvents.length);
      
      // 🔧 显示被过滤掉的事件
      const excludedEvents = allEvents.filter((event: any) => {
        try {
          if (!event) return true;
          if (!event.startTime && !event.createdAt) return true;
          
          const eventStartTime = new Date(event.startTime || event.createdAt);
          if (isNaN(eventStartTime.getTime())) return true;
          
          return !(eventStartTime >= startDate && eventStartTime <= endDate);
        } catch (error) {
          console.error('❌ Error processing excluded event:', error, event);
          return true; // 如果出错，就认为是被排除的
        }
      });
      
      if (excludedEvents.length > 0) {
        console.log('🚫 Excluded events:');
        try {
          excludedEvents.forEach((event: any, index: number) => {
            try {
              if (!event) {
                console.log(`  ${index + 1}. NULL/undefined event`);
                return;
              }
              
              const eventStartTime = event.startTime ? new Date(event.startTime) : 
                                   event.createdAt ? new Date(event.createdAt) : null;
              const timeDisplay = eventStartTime && !isNaN(eventStartTime.getTime()) ? 
                                eventStartTime.toLocaleString() : 'Invalid/No time';
                                
              console.log(`  ${index + 1}. "${event.title || 'No Title'}" - Start: ${timeDisplay}`);
            } catch (itemError) {
              console.error(`❌ Error displaying excluded event ${index + 1}:`, itemError, event);
            }
          });
        } catch (excludedForEachError) {
          console.error('❌ Error in excluded events forEach:', excludedForEachError);
        }
      }
      
      return filteredEvents;
      
    } catch (error) {
      console.error('❌ Error in getTodayOngoingEvents:', error);
      return [];
    }
  };
  
  // 设置初始化
  useEffect(() => {
    if (settingsLoaded) return; // 防止重复加载
    
    try {
      const savedSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      
      if (savedSettings) {
        const settings = JSON.parse(savedSettings);
        const days = Number(settings.ongoingDays);
        
        if (days >= 1 && days <= 30) {
          setOngoingDays(days);
          setTempOngoingDays(days.toString());
        }
      }
      
      setSettingsLoaded(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
      setSettingsLoaded(true);
    }
  }, [settingsLoaded]);

  // 缓存更新
  useEffect(() => {
    if (!settingsLoaded) return;
    
    const timer = setTimeout(() => {
      const events = getTodayOngoingEvents();
      setOngoingEventsCache(events);
    }, 100);
    
    return () => clearTimeout(timer);
  }, [ongoingDays, settingsLoaded]);

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
        completedAt: formatTimeForStorage(now)
      };
      
      const updatedSessions = [...timerSessions, session];
      setTimerSessions(updatedSessions);
      localStorage.setItem(STORAGE_KEYS.TIMER_SESSIONS, JSON.stringify(updatedSessions));

      if (microsoftService) {
        createOngoingEventFromTimer(session, microsoftService);
      }

      alert(`任务"${currentTask}"完成！用时：${formatTime(seconds)}`);
    }
    setSeconds(0);
    setCurrentTask('');
  };

  // 保存编辑
  const saveOngoingEventEdit = async (eventId: string, newTitle: string, newDescription?: string) => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const events = JSON.parse(savedEvents);
        const eventIndex = events.findIndex((event: any) => event.id === eventId);
        
        if (eventIndex !== -1) {
          const originalEvent = events[eventIndex];
          let cleanTitle = newTitle.trim();
          if (cleanTitle.startsWith('🍅')) {
            cleanTitle = cleanTitle.replace(/^🍅+\s*/, '');
          }
          
          const updatedEvent = {
            ...originalEvent,
            title: cleanTitle,
            description: newDescription?.trim() || '',
            updatedAt: formatTimeForStorage(new Date()),
            localVersion: (originalEvent.localVersion || 1) + 1,
            lastLocalChange: formatTimeForStorage(new Date()),
            syncStatus: 'pending'
          };
          
          events[eventIndex] = updatedEvent;
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
          
          if (syncManager) {
            syncManager.recordLocalAction('update', 'event', eventId, updatedEvent, originalEvent);
          }
          
          setOngoingEventsCache((prevCache: any[]) => 
            prevCache.map((cachedEvent: any) => 
              cachedEvent.id === eventId 
                ? { ...cachedEvent, title: cleanTitle, description: newDescription?.trim() || '', updatedAt: formatTimeForStorage(new Date()) }
                : cachedEvent
            )
          );
          
          setEditingEventId(null);
          setEditingEventTitle('');
          setEditingEventDescription('');
        }
      }
    } catch (error) {
      console.error('❌ Failed to save ongoing event edit:', error);
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
          // 立即更新缓存状态
          setOngoingEventsCache((prevCache: any[]) => prevCache.filter((event: any) => event.id !== eventId));
          
          // 记录同步操作 - 确保传递完整的事件数据包括externalId
          if (syncManager) {
            console.log('🗑️ Recording delete action for event:', {
              id: eventId,
              externalId: eventToDelete.externalId,
              title: eventToDelete.title
            });
            
            // 如果事件有externalId，先尝试立即删除远程事件
            if (eventToDelete.externalId && microsoftService && microsoftService.isSignedIn()) {
              try {
                // 清理externalId，移除可能的前缀
                let cleanExternalId = eventToDelete.externalId;
                if (cleanExternalId.startsWith('outlook-')) {
                  cleanExternalId = cleanExternalId.replace('outlook-', '');
                }
                
                console.log('🗑️ Deleting event from Outlook with cleaned ID:', cleanExternalId);
                await microsoftService.deleteEvent(cleanExternalId);
                console.log('✅ Successfully deleted event from Outlook:', cleanExternalId);
              } catch (error) {
                console.error('❌ Failed to delete event from Outlook:', error);
                // 即使远程删除失败，也记录本地操作以供后续重试
              }
            }
            
            syncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete);
          }
          
          // 更新localStorage
          const updatedEvents = events.filter((event: any) => event.id !== eventId);
          localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
        }
      }
    } catch (error) {
      console.error('❌ Failed to delete ongoing event:', error);
      alert('删除失败，请重试');
      // 发生错误时重新加载
      const events = getTodayOngoingEvents();
      setOngoingEventsCache(events);
    }
  };

  // 从计时会话创建 Ongoing 日程
  const createOngoingEventFromTimer = async (session: TimerSession, microsoftService: any) => {
    try {
      const ongoingEvent: any = {
        id: `timer-${session.id}`,
        title: session.taskName,
        description: `计时记录 - 用时${formatTime(session.duration)}`,
        startTime: session.startTime,
        endTime: session.endTime,
        isAllDay: false,
        reminder: 0,
        syncStatus: 'pending',
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date()),
        externalId: undefined,
        calendarId: undefined,
        timerSessionId: session.id,
        category: 'ongoing',
        remarkableSource: true
      };

      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const events = savedEvents ? JSON.parse(savedEvents) : [];
      events.push(ongoingEvent);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

      if (syncManager) {
        syncManager.recordLocalAction('create', 'event', ongoingEvent.id, ongoingEvent);
      }
      
      window.dispatchEvent(new CustomEvent('local-events-changed', {
        detail: { action: 'create', eventId: ongoingEvent.id }
      }));

    } catch (error) {
      console.error('❌ Failed to create ongoing event:', error);
    }
  };

  // ongoing 天数配置
  const applyOngoingDaysConfig = () => {
    const newDays = parseInt(tempOngoingDays);
    if (newDays >= 1 && newDays <= 30) {
      setOngoingDays(newDays);
      
      const settings = {
        ongoingDays: newDays,
        syncAllOutlookEvents: true,
        lastUpdated: formatTimeForStorage(new Date())
      };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
      
      setShowOngoingConfig(false);
      
      // 触发全量同步
      if (syncManager) {
        console.log('🔄 [Settings] Days changed, triggering full sync');
        syncManager.triggerFullSync();
      } else if (microsoftService) {
        setTimeout(() => {
          microsoftService.forceSync().catch((error: any) => {
            console.error('Auto-sync failed:', error);
          });
        }, 500);
      }
    }
  };

  // 渲染 ongoing 事件
  const renderOngoingEvents = () => {
    return (
      <div className="ongoing-logs" style={{ marginTop: '20px' }}>
        {/* 配置区域 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', flexWrap: 'wrap' }}>
          <h4 style={{ margin: '0', fontSize: '0.9rem', color: '#666' }}>
            时光日志 ({ongoingEventsCache.length})
          </h4>
          <button
            onClick={() => setShowOngoingConfig(!showOngoingConfig)}
            style={{
              background: 'none',
              border: '1px solid #ccc',
              borderRadius: '4px',
              padding: '4px 8px',
              fontSize: '0.75rem',
              cursor: 'pointer',
              color: '#666'
            }}
            title="配置显示天数"
          >
            {ongoingDays}天
          </button>
          {showOngoingConfig && (
            <div style={{ 
              display: 'flex', 
              gap: '6px', 
              alignItems: 'center',
              padding: '6px 10px',
              background: '#f8f9fa',
              border: '1px solid #dee2e6',
              borderRadius: '6px',
              fontSize: '0.75rem'
            }}>
              <span style={{ color: '#666', whiteSpace: 'nowrap' }}>显示天数:</span>
              <input
                type="number"
                min="1"
                max="30"
                value={tempOngoingDays}
                onChange={(e) => setTempOngoingDays(e.target.value)}
                style={{
                  width: '60px',
                  padding: '4px 6px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  textAlign: 'center'
                }}
              />
              <button
                onClick={applyOngoingDaysConfig}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                确定
              </button>
              <button
                onClick={() => setShowOngoingConfig(false)}
                style={{
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 事件列表 */}
        {ongoingEventsCache.length === 0 ? (
          <div style={{
            padding: '10px',
            textAlign: 'center',
            color: '#666',
            fontSize: '0.8rem'
          }}>
            暂无记录
          </div>
        ) : (
          // 按开始时间倒序排列（最新的在前面）
          [...ongoingEventsCache]
            .sort((a: any, b: any) => {
              const timeA = new Date(a.startTime || a.createdAt).getTime();
              const timeB = new Date(b.startTime || b.createdAt).getTime();
              return timeB - timeA; // 倒序：新的在前
            })
            .map((event: any) => (
            <div 
              key={event.id} 
              className="ongoing-log-item"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '8px 12px',
                marginBottom: '6px',
                backgroundColor: '#f8f9fa',
                border: '1px solid #e9ecef',
                borderRadius: '4px',
                fontSize: '0.85rem'
              }}
            >
              {editingEventId === event.id ? (
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '6px' }}>
                  <input
                    type="text"
                    value={editingEventTitle}
                    onChange={(e) => setEditingEventTitle(e.target.value)}
                    placeholder="输入标题..."
                    style={{
                      border: '1px solid #007bff',
                      borderRadius: '2px',
                      padding: '4px 6px',
                      fontSize: '0.85rem'
                    }}
                    autoFocus
                  />
                  
                  <textarea
                    value={editingEventDescription}
                    onChange={(e) => setEditingEventDescription(e.target.value)}
                    placeholder="输入描述（可选）..."
                    style={{
                      border: '1px solid #007bff',
                      borderRadius: '2px',
                      padding: '4px 6px',
                      fontSize: '0.75rem',
                      minHeight: '40px',
                      resize: 'vertical',
                      fontFamily: 'inherit'
                    }}
                    rows={2}
                  />
                  
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <button
                      onClick={() => saveOngoingEventEdit(event.id, editingEventTitle, editingEventDescription)}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        backgroundColor: '#28a745',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                      title="保存"
                    >
                      ✓ 保存
                    </button>
                    <button
                      onClick={() => {
                        setEditingEventId(null);
                        setEditingEventTitle('');
                        setEditingEventDescription('');
                      }}
                      style={{
                        padding: '2px 6px',
                        fontSize: '0.7rem',
                        backgroundColor: '#6c757d',
                        color: 'white',
                        border: 'none',
                        borderRadius: '2px',
                        cursor: 'pointer'
                      }}
                      title="取消"
                    >
                      ✕ 取消
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div style={{ flex: 1 }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'space-between',
                      marginBottom: event.description ? '4px' : '0'
                    }}>
                      <span style={{ color: '#495057', fontWeight: '500' }}>
                        {event.title}
                      </span>
                      <small style={{ color: '#6c757d', marginLeft: '8px' }}>
                        {formatDisplayTime(event.startTime)}
                      </small>
                    </div>
                    
                    {event.description && event.description.trim() && (
                      <div style={{ 
                        fontSize: '0.75rem', 
                        color: '#6c757d',
                        lineHeight: '1.3',
                        marginBottom: '2px',
                        maxHeight: '2.6em',
                        overflow: 'hidden',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {event.description}
                      </div>
                    )}
                  </div>
                  
                  <div className="log-actions" style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingEventId(event.id);
                        setEditingEventTitle(event.title);
                        setEditingEventDescription(event.description || '');
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '2px 4px',
                        borderRadius: '2px',
                        color: '#007bff'
                      }}
                      title="编辑"
                    >
                      ✏️
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm('确定要删除这条记录吗？')) {
                          deleteOngoingEvent(event.id);
                        }
                      }}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9rem',
                        padding: '2px 4px',
                        borderRadius: '2px',
                        color: '#dc3545'
                      }}
                      title="删除"
                    >
                      🗑️
                    </button>
                  </div>
                </>
              )}
            </div>
          ))
        )}
      </div>
    );
  };

  // 监听事件更新
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    
    const handleSyncCompleted = (event: CustomEvent) => {
      setLastSyncTime(new Date());
      
      if (!editingEventId) {
        if (refreshTimeout) {
          clearTimeout(refreshTimeout);
        }
        
        refreshTimeout = setTimeout(() => {
          setOngoingEventsCache(prevCache => {
            const events = getTodayOngoingEvents();
            if (events.length !== prevCache.length || 
                JSON.stringify(events.map((e:any) => e.id)) !== JSON.stringify(prevCache.map((e:any) => e.id))) {
              return events;
            }
            return prevCache;
          });
        }, 500);
      }
    };

    const handleLocalEventsChanged = (event: CustomEvent) => {
      console.log('🔄 [App] handleLocalEventsChanged received:', {
        action: event.detail?.action,
        eventId: event.detail?.event?.id,
        eventTitle: event.detail?.event?.title,
        eventDescription: event.detail?.event?.description?.substring(0, 100) + '...',
        editingEventId
      });
      
      if (!editingEventId) {
        setOngoingEventsCache(prevCache => {
          const events = getTodayOngoingEvents();
          console.log('🔄 [App] Updating ongoing events cache:', {
            prevCount: prevCache.length,
            newCount: events.length,
            updatedEventId: event.detail?.event?.id
          });
          
          if (events.length !== prevCache.length || 
              JSON.stringify(events.map((e:any) => e.id)) !== JSON.stringify(prevCache.map((e:any) => e.id))) {
            return events;
          }
          
          // 🔧 即使数量相同，也要检查内容是否有变化（比如描述更新）
          const hasContentChange = events.some((newEvent: any, index: number) => {
            const oldEvent = prevCache[index];
            return oldEvent && (
              newEvent.title !== oldEvent.title ||
              newEvent.description !== oldEvent.description ||
              newEvent.location !== oldEvent.location
            );
          });
          
          if (hasContentChange) {
            console.log('🔄 [App] Content changed, updating cache');
            return events;
          }
          
          return prevCache;
        });
      } else {
        console.log('⏸️ [App] Skipping update because event is being edited');
      }
    };

    window.addEventListener('outlook-sync-completed', handleSyncCompleted as EventListener);
    window.addEventListener('action-sync-completed', handleSyncCompleted as EventListener);
    window.addEventListener('local-events-changed', handleLocalEventsChanged as EventListener);

    return () => {
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }
      
      window.removeEventListener('outlook-sync-completed', handleSyncCompleted as EventListener);
      window.removeEventListener('action-sync-completed', handleSyncCompleted as EventListener);
      window.removeEventListener('local-events-changed', handleLocalEventsChanged as EventListener);
    };
  }, [editingEventId]);

  // Microsoft 服务状态变化监听
  useEffect(() => {
    const handleAuthStateChange = (isSignedIn: boolean) => {
      if (!isSignedIn && syncManager && !microsoftService?.simulationMode) {
        if (typeof syncManager.stop === 'function') {
          syncManager.stop();
        } else if (typeof syncManager.stopSync === 'function') {
          syncManager.stopSync();
        } else if (typeof syncManager.pause === 'function') {
          syncManager.pause();
        }
      }
    };

    const interval = setInterval(() => {
      if (microsoftService) {
        const currentAuthState = microsoftService.isSignedIn();
        
        if (!microsoftService.simulationMode && currentAuthState !== lastAuthState) {
          setLastAuthState(currentAuthState);
          handleAuthStateChange(currentAuthState);
        } else if (microsoftService.simulationMode && lastAuthState !== true) {
          setLastAuthState(true);
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [microsoftService, syncManager, lastAuthState]);

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
        </div>
      </header>

      <div className="app-layout">
        {/* 左侧计时器区域 */}
        <div className="timer-section">
          <div className="timer-display">
            <h2 className="time">{formatTime(seconds)}</h2>
            {currentTask && (
              <p className="current-task">当前任务: {currentTask}</p>
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

          {renderOngoingEvents()}
        </div>

        {/* 右侧功能区域 */}
        <div className="feature-section">
          <div className="tab-navigation">
            <button
              className={`tab-button ${activeTab === 'tasks' ? 'active' : ''}`}
              onClick={() => setActiveTab('tasks')}
            >
              📝 待办事项
            </button>
            <button
              className={`tab-button ${activeTab === 'events' ? 'active' : ''}`}
              onClick={() => setActiveTab('events')}
            >
              📅 我的日程
              {syncManager && syncManager.isActive && syncManager.isActive() && (
                <span className="sync-indicator">🔄</span>
              )}
            </button>
            <button
              className={`tab-button ${activeTab === 'sync' ? 'active' : ''}`}
              onClick={() => setActiveTab('sync')}
            >
              🔄 智能同步
              {syncManager && syncManager.isActive && syncManager.isActive() && (
                <span className="sync-indicator">🔄</span>
              )}
            </button>
          </div>

          <div className="tab-content">
            {activeTab === 'tasks' && (
              <TaskManager onStartTimer={startTimerFromExternal} />
            )}
            {activeTab === 'events' && microsoftService && syncManager && (
              <EventManager 
                onStartTimer={startTimerFromExternal} 
                microsoftService={microsoftService}
              />
            )}
            {activeTab === 'sync' && microsoftService && syncManager && (
              <CalendarSync 
                syncManager={syncManager}
                microsoftService={microsoftService}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;