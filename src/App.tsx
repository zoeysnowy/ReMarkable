import React, { useState, useEffect, useRef } from 'react';
import { MicrosoftCalendarService } from './services/MicrosoftCalendarService';
import { ActionBasedSyncManager } from './services/ActionBasedSyncManager';
import { EventManager } from './components/EventManager';
import TaskManager from './components/TaskManager';
import CalendarSync from './components/CalendarSync';
import FigmaTagManagerV3 from './components/FigmaTagManagerV3';
import TimeCalendar from './components/TimeCalendar';
import DescriptionEditor from './components/DescriptionEditor';
import UnifiedTimeline from './components/UnifiedTimeline';
import AppLayout, { PageType } from './components/AppLayout';
import PageContainer from './components/PageContainer';
import { TimerSession } from './types';
import { formatTimeForStorage } from './utils/timeUtils';
import { STORAGE_KEYS, CacheManager } from './constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from './utils/persistentStorage';
import { TagService } from './services/TagService';
import ClickTracker from './components/ClickTracker';
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
    startTime: number;
    elapsedTime: number;
    isPaused: boolean;
  } | null>(null);

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

  // 开发调试面板状态
  const [showDebugPanel, setShowDebugPanel] = useState(process.env.NODE_ENV === 'development');

  // 页面状态管理
  const [currentPage, setCurrentPage] = useState<PageType>('home');

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

    setGlobalTimer({
      isRunning: true,
      tagId: tagId,
      tagName: tag.name,
      startTime: Date.now(),
      elapsedTime: 0,
      isPaused: false
    });

    console.log('⏰ 开始计时:', tag.name);
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

  const handleTimerStop = () => {
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

    // TODO: 这里应该弹出UnifiedTimeline的编辑对话框
    // 创建一个带有 'from timer' 标记的事件
    
    // 暂时直接切换到时间页面，用户可以手动创建事件
    setCurrentPage('time');
    
    // 清除计时器状态
    setGlobalTimer(null);
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

  // 计时器效果
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

  // 页面渲染函数
  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'home':
        return (
          <PageContainer title="首页" subtitle="时间管理与任务概览">
            <div className="home-content">
              {/* 计时器区域 */}
              <div className="timer-section">
                <div className="timer-display">
                  <div className="time">{formatTime(seconds)}</div>
                  {currentTask && (
                    <div className="current-task">
                      <span>当前任务: {currentTask}</span>
                      <button 
                        onClick={() => setCurrentTaskEditor({
                          isOpen: true,
                          title: currentTask,
                          description: currentTaskEditor.description,
                          tags: currentTaskEditor.tags
                        })}
                        className="edit-task-btn"
                      >
                        📝 编辑描述
                      </button>
                    </div>
                  )}
                </div>

                {!currentTask ? (
                  <div className="task-input-section">
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
                  <div className="timer-controls">
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

              {/* 今日统计 */}
              <div className="daily-stats-card">
                <h3>今日统计</h3>
                <div className="stats-grid">
                  <div className="stat-item">
                    <span className="stat-label">专注时间</span>
                    <span className="stat-value">{formatTime(getTodayTotalTime())}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">同步状态</span>
                    <span className="stat-value">
                      {microsoftService && microsoftService.isSignedIn() ? '🟢 已连接' : '🔴 未连接'}
                    </span>
                  </div>
                </div>
              </div>
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
                  onTimerStop={handleTimerStop}
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
        onPageChange={setCurrentPage}
        clickTrackerEnabled={clickTrackerEnabled}
        onClickTrackerToggle={toggleClickTracker}
      >
      {renderCurrentPage()}

      {/* 当前任务描述编辑器 */}
      <DescriptionEditor
        isOpen={currentTaskEditor.isOpen}
        title={currentTaskEditor.title}
        initialDescription={currentTaskEditor.description}
        initialTags={currentTaskEditor.tags}
        onSave={saveCurrentTaskEdit}
        onClose={() => setCurrentTaskEditor({ ...currentTaskEditor, isOpen: false })}
      />

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

export default App;