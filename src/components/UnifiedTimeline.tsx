import React, { useState, useEffect, useCallback } from 'react';
import { Event } from '../types';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import { formatTimeForStorage, parseLocalTimeString, formatTimeForInput, formatDateForInput, formatDisplayTime, formatDateTimeForInput } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';
import { PersistentStorage, PERSISTENT_OPTIONS } from '../utils/persistentStorage';
import DescriptionEditor from './DescriptionEditor';

interface EventTag {
  id: string;
  name: string;
  color: string;
  outlookCalendarId?: string;
  category: 'ongoing' | 'planning';
}

interface UnifiedTimelineProps {
  onStartTimer: (taskTitle: string) => void;
  microsoftService?: MicrosoftCalendarService;
  syncManager?: any; // ActionBasedSyncManager instance
  lastSyncTime?: Date | null;
}

export const UnifiedTimeline: React.FC<UnifiedTimelineProps> = ({ 
  onStartTimer, 
  microsoftService,
  syncManager,
  lastSyncTime
}) => {
  console.log('🔍 [UnifiedTimeline] Component rendered with syncManager:', !!syncManager);
  console.log('🔍 [UnifiedTimeline] syncManager type:', typeof syncManager);
  
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  
  // DescriptionEditor states
  const [showDescriptionEditor, setShowDescriptionEditor] = useState(false);
  const [editingEventForDescription, setEditingEventForDescription] = useState<Event | null>(null);
  
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    reminder: 15,
    category: 'planning' as 'ongoing' | 'planning',
    tagId: ''
  });

  // 时间显示配置
  const [ongoingDaysConfig, setOngoingDaysConfig] = useState(7);
  const [showOngoingConfig, setShowOngoingConfig] = useState(false);
  const [tempOngoingDays, setTempOngoingDays] = useState('7');

  // 加载事件数据
  const loadEvents = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (saved) {
      const allEvents = JSON.parse(saved);
      setEvents(allEvents);
    } else {
      // 如果没有事件数据，创建一些测试事件
      const testEvents = [
        {
          id: 'test-event-1',
          title: '测试工作事件',
          description: '这是一个测试工作事件的描述，用于展示统一时间线功能',
          startTime: formatTimeForStorage(new Date(Date.now() - 2 * 60 * 60 * 1000)),
          endTime: formatTimeForStorage(new Date(Date.now() - 1 * 60 * 60 * 1000)),
          tagId: 'work',
          isAllDay: false,
          category: 'ongoing',
          createdAt: formatTimeForStorage(new Date()),
          updatedAt: formatTimeForStorage(new Date())
        },
        {
          id: 'test-event-2', 
          title: '测试生活事件',
          description: '这是一个测试生活事件的描述',
          startTime: formatTimeForStorage(new Date(Date.now() - 4 * 60 * 60 * 1000)),
          endTime: formatTimeForStorage(new Date(Date.now() - 3 * 60 * 60 * 1000)),
          tagId: 'life',
          isAllDay: false,
          category: 'ongoing',
          createdAt: formatTimeForStorage(new Date()),
          updatedAt: formatTimeForStorage(new Date())
        },
        {
          id: 'test-event-future-1',
          title: '未来的会议',
          description: '明天的重要会议',
          startTime: formatTimeForStorage(new Date(Date.now() + 24 * 60 * 60 * 1000)),
          endTime: formatTimeForStorage(new Date(Date.now() + 25 * 60 * 60 * 1000)),
          tagId: 'work',
          isAllDay: false,
          category: 'planning',
          createdAt: formatTimeForStorage(new Date()),
          updatedAt: formatTimeForStorage(new Date())
        }
      ];
      
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(testEvents));
      setEvents(testEvents);
    }
  }, []);

  // 加载标签数据
  const loadEventTags = useCallback(() => {
    const saved = localStorage.getItem(STORAGE_KEYS.EVENT_TAGS);
    if (saved) {
      setEventTags(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    // 加载用户设置
    try {
      const settings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (settings) {
        const parsedSettings = JSON.parse(settings);
        const savedOngoingDays = parsedSettings.ongoingDays || parsedSettings.ongoing || 7;
        setOngoingDaysConfig(savedOngoingDays);
        setTempOngoingDays(savedOngoingDays.toString());
        console.log(`⚙️ [Timeline] Loaded ongoingDays config: ${savedOngoingDays} days`);
      } else {
        // 🔧 如果没有设置，创建默认设置并立即保存
        const defaultSettings = { ongoingDays: 7 };
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
        setOngoingDaysConfig(7);
        setTempOngoingDays('7');
        console.log(`⚙️ [Timeline] Created default ongoingDays config: 7 days`);
      }
    } catch (error) {
      console.error('❌ Error loading ongoingDays config:', error);
      // 出错时也要设置默认值
      const defaultSettings = { ongoingDays: 7 };
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(defaultSettings));
      setOngoingDaysConfig(7);
      setTempOngoingDays('7');
    }
    
    // 🔄 监听同步完成事件
    const handleSyncCompleted = () => {
      console.log('🔄 [Timeline] Sync completed, reloading events');
      loadEvents();
    };

    // 🔄 监听本地事件变化（如日历迁移）
    const handleLocalEventsChanged = (event: unknown) => {
      const customEvent = event as CustomEvent;
      console.log('🔄 [Timeline] Local events changed, reloading events:', customEvent.detail);
      loadEvents();
    };

    window.addEventListener('action-sync-completed', handleSyncCompleted);
    window.addEventListener('outlook-sync-completed', handleSyncCompleted);
    window.addEventListener('local-events-changed', handleLocalEventsChanged as any);
    
    loadEvents();
    loadEventTags();
    
    // 清理事件监听器
    return () => {
      window.removeEventListener('action-sync-completed', handleSyncCompleted);
      window.removeEventListener('outlook-sync-completed', handleSyncCompleted);
      window.removeEventListener('local-events-changed', handleLocalEventsChanged as any);
    };
  }, [loadEvents, loadEventTags]);

  // 分离过去和未来的事件
  const now = new Date();
  const cutoffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ongoingDaysConfig);
  
  const pastEvents = events.filter(event => {
    const eventTime = parseLocalTimeString(event.startTime);
    return eventTime.getTime() < now.getTime() && eventTime.getTime() >= cutoffTime.getTime();
  }).sort((a, b) => {
    const timeA = parseLocalTimeString(a.startTime).getTime();
    const timeB = parseLocalTimeString(b.startTime).getTime();
    return timeB - timeA; // 倒序：最新的在前
  });

  const futureEvents = events.filter(event => {
    const eventTime = parseLocalTimeString(event.startTime);
    return eventTime.getTime() >= now.getTime();
  }).sort((a, b) => {
    const timeA = parseLocalTimeString(a.startTime).getTime();
    const timeB = parseLocalTimeString(b.startTime).getTime();
    return timeA - timeB; // 正序：最早的在前
  });

  // 获取标签到日历的映射
  const getTargetCalendarId = (event: Event): string | null => {
    if (!event.tagId) return null;
    
    try {
      const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
      if (!savedTags) return null;
      
      const availableTags = flattenTags(savedTags);
      const foundTag = availableTags.find(tag => tag.id === event.tagId);
      
      console.log('🔍 [getTargetCalendarId] Event', `"${event.title}"`, 'with tagId', `"${event.tagId}"`, {
        foundTag,
        calendarMapping: foundTag?.calendarMapping || null,
        calendarId: foundTag?.calendarMapping?.calendarId || null,
        availableTags
      });
      
      return foundTag?.calendarMapping?.calendarId || null;
    } catch (error) {
      console.error('❌ [getTargetCalendarId] Error:', error);
      return null;
    }
  };

  // 扁平化标签
  const flattenTags = (tags: any[]): any[] => {
    const result: any[] = [];
    
    const flatten = (tagList: any[], parentName = '') => {
      tagList.forEach(tag => {
        const displayName = parentName ? `${parentName} > ${tag.name}` : tag.name;
        result.push({
          ...tag,
          displayName,
          parentName
        });
        
        if (tag.children && tag.children.length > 0) {
          flatten(tag.children, displayName);
        }
      });
    };
    
    flatten(tags);
    return result;
  };

  // 同步事件到 Outlook
  const syncEventToOutlook = async (event: Event): Promise<string | null> => {
    if (!microsoftService) {
      throw new Error('Microsoft Calendar service not available');
    }
    
    const targetCalendarId = getTargetCalendarId(event);
    
    if (targetCalendarId) {
      console.log(`🎯 [UnifiedTimeline] Syncing event "${event.title}" to calendar:`, targetCalendarId);
      return await microsoftService.syncEventToCalendar(event, targetCalendarId);
    } else {
      console.log(`🎯 [UnifiedTimeline] Syncing event "${event.title}" to default calendar`);
      return await microsoftService.createEvent(event);
    }
  };

  // 添加/编辑事件
  const addEvent = async () => {
    if (!formData.title) return;

    try {
      let startTime, endTime;
      
      if (formData.isAllDay) {
        // 🔧 使用本地日期避免时区转换问题
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = selectedDate.getDate().toString().padStart(2, '0');
        const selectedDateStr = `${year}-${month}-${day}`;
        
        const allDayStart = new Date(`${selectedDateStr}T00:00:00`);
        const allDayEnd = new Date(`${selectedDateStr}T23:59:59`);
        
        startTime = formatTimeForStorage(allDayStart);
        endTime = formatTimeForStorage(allDayEnd);
      } else {
        // 🔧 使用本地日期避免时区转换问题
        const year = selectedDate.getFullYear();
        const month = (selectedDate.getMonth() + 1).toString().padStart(2, '0');
        const day = selectedDate.getDate().toString().padStart(2, '0');
        const selectedDateStr = `${year}-${month}-${day}`;
        
        const startDateTime = new Date(`${selectedDateStr}T${formData.startTime}:00`);
        const endDateTime = new Date(`${selectedDateStr}T${formData.endTime}:00`);
        
        startTime = formatTimeForStorage(startDateTime);
        endTime = formatTimeForStorage(endDateTime);
      }

      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const existingEvents = saved ? JSON.parse(saved) : [];

      if (editingEvent) {
        // 编辑现有事件
        const eventIndex = existingEvents.findIndex((e: Event) => e.id === editingEvent.id);
        if (eventIndex !== -1) {
          const originalEvent = existingEvents[eventIndex]; // 保存原始事件数据
          const updatedEvent: Event = {
            ...existingEvents[eventIndex],
            title: formData.title,
            description: formData.description,
            startTime,
            endTime,
            location: formData.location || '',
            isAllDay: formData.isAllDay,
            category: formData.category,
            tagId: formData.tagId || '',
            updatedAt: formatTimeForStorage(new Date()),
          };

          existingEvents[eventIndex] = updatedEvent;
          
          // 同步到 syncManager
          if (syncManager) {
            try {
              await syncManager.recordLocalAction('update', 'event', updatedEvent.id, updatedEvent, originalEvent);
              console.log('✅ Event updated and synced through syncManager');
            } catch (error) {
              console.error('❌ Failed to sync updated event through syncManager:', error);
            }
          }
        }
      } else {
        // 创建新事件
        const newEvent: Event = {
          id: Date.now().toString(),
          title: formData.title,
          description: formData.description,
          startTime,
          endTime,
          location: formData.location || '',
          isAllDay: formData.isAllDay,
          category: formData.category,
          tagId: formData.tagId || '',
          createdAt: formatTimeForStorage(new Date()),
          updatedAt: formatTimeForStorage(new Date()),
        };

        existingEvents.push(newEvent);

        // 同步到 syncManager
        if (syncManager) {
          try {
            await syncManager.recordLocalAction('create', 'event', newEvent.id, newEvent);
            console.log('✅ Event created and synced through syncManager');
          } catch (error) {
            console.error('❌ Failed to sync new event through syncManager:', error);
          }
        }
      }
      
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      setEvents(existingEvents);

      // 重置表单
      setFormData({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        location: '',
        isAllDay: false,
        reminder: 15,
        category: 'planning',
        tagId: ''
      });
      setShowAddForm(false);
      setEditingEvent(null);
    } catch (error) {
      console.error('保存事件失败:', error);
    }
  };

  // 删除事件
  const deleteEvent = (eventId: string) => {
    console.log('🗑️ [UnifiedTimeline] deleteEvent called for:', eventId);
    console.log('🗑️ [UnifiedTimeline] syncManager available:', !!syncManager);
    console.log('🗑️ [UnifiedTimeline] syncManager value:', syncManager);
    
    const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (saved) {
      const existingEvents = JSON.parse(saved);
      const eventToDelete = existingEvents.find((e: Event) => e.id === eventId);
      console.log('🗑️ [UnifiedTimeline] Found event to delete:', eventToDelete?.title);
      
      const updatedEvents = existingEvents.filter((e: Event) => e.id !== eventId);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      setEvents(updatedEvents);
      
      // 同步删除操作 - 使用window.syncManager作为备选方案
      const activeSyncManager = syncManager || (window as any).syncManager;
      console.log('🗑️ [UnifiedTimeline] Active syncManager:', !!activeSyncManager);
      
      if (activeSyncManager) {
        if (eventToDelete) {
          console.log('🗑️ [UnifiedTimeline] Calling syncManager.recordLocalAction for DELETE');
          activeSyncManager.recordLocalAction('delete', 'event', eventId, null, eventToDelete);
        } else {
          console.log('❌ [UnifiedTimeline] Event to delete not found in localStorage');
        }
      } else {
        console.log('❌ [UnifiedTimeline] syncManager is not available - DELETE will not sync to Outlook!');
        console.log('❌ [UnifiedTimeline] Available on window?', !!(window as any).syncManager);
      }
    } else {
      console.log('❌ [UnifiedTimeline] No events found in localStorage');
    }
  };

  // 重新同步事件
  const resyncEvent = async (event: Event) => {
    try {
      console.log('🔄 Re-syncing event to Outlook:', event.title);
      
      // 使用 ActionBasedSyncManager 来处理重新同步，这样会正确处理更新逻辑
      if (syncManager) {
        // 将重新同步作为更新操作处理，这样会触发正确的同步逻辑
        await syncManager.recordLocalAction('update', 'event', event.id, event, event);
        console.log('✅ Re-sync successful through syncManager');
      } else {
        // 如果 syncManager 不可用，回退到直接创建
        await syncEventToOutlook(event);
        console.log('✅ Re-sync successful (fallback)');
      }
    } catch (error) {
      console.error('❌ Re-sync failed:', error);
    }
  };

  // 渲染事件项
  const renderEventItem = (event: Event, isLeftColumn: boolean = false) => (
    <div 
      key={event.id}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        marginBottom: '6px',
        backgroundColor: isLeftColumn ? '#f8f9fa' : '#fff',
        border: '1px solid #e9ecef',
        borderRadius: '4px',
        fontSize: '0.85rem'
      }}
    >
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
        
        {/* 显示标签 */}
        {event.tagId && (
          <div style={{ 
            fontSize: '0.7rem', 
            color: '#007bff',
            marginTop: '4px'
          }}>
            #{getTagDisplayName(event.tagId)}
          </div>
        )}
      </div>
          
      <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setEditingEvent(event);
            setFormData({
              title: event.title,
              description: event.description || '',
              startTime: formatTimeForInput(event.startTime),
              endTime: formatTimeForInput(event.endTime),
              location: event.location || '',
              isAllDay: event.isAllDay || false,
              reminder: 15,
              category: (event.category as 'ongoing' | 'planning') || 'planning',
              tagId: event.tagId || ''
            });
            setSelectedDate(parseLocalTimeString(event.startTime));
          }}
          style={{
            background: 'red',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.9rem',
            padding: '2px 4px',
            borderRadius: '2px',
            color: 'white'
          }}
          title="编辑"
        >
          APP
        </button>
        <button
          onClick={() => resyncEvent(event)}
          style={{
            background: '#28a745',
            border: 'none',
            cursor: 'pointer',
            fontSize: '0.8rem',
            padding: '2px 4px',
            borderRadius: '2px',
            color: 'white'
          }}
          title="重新同步"
        >
          🔄
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (window.confirm('确定要删除这条记录吗？')) {
              deleteEvent(event.id);
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
    </div>
  );

  // 获取标签显示名称
  const getTagDisplayName = (tagId: string): string => {
    try {
      const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
      if (!savedTags) return '未分类';
      
      const findTagName = (tags: any[], tagId: string): string => {
        for (const tag of tags) {
          if (tag.id === tagId) return tag.name;
          if (tag.children) {
            const childName = findTagName(tag.children, tagId);
            if (childName) return childName;
          }
        }
        return '未分类';
      };
      
      return findTagName(savedTags, tagId);
    } catch (error) {
      return '未分类';
    }
  };

  // 应用时间范围配置
  const applyOngoingConfig = () => {
    const days = parseInt(tempOngoingDays);
    if (days > 0 && days <= 30) {
      setOngoingDaysConfig(days);
      setShowOngoingConfig(false);
      
      // 🔧 保存到localStorage设置中
      try {
        const currentSettings = localStorage.getItem(STORAGE_KEYS.SETTINGS);
        const settings = currentSettings ? JSON.parse(currentSettings) : {};
        settings.ongoingDays = days;
        localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
        console.log(`⚙️ [Timeline] Saved ongoingDays config: ${days} days`);
        
        // 触发事件刷新以应用新的天数设置
        if (syncManager && microsoftService && microsoftService.isSignedIn()) {
          console.log('🔄 [Timeline] Refreshing events with new days config');
          loadEvents();
        }
      } catch (error) {
        console.error('❌ Error saving ongoingDays config:', error);
      }
    }
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100%', 
      gap: '20px',
      background: 'rgba(255, 255, 255, 0.95)',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 4px 16px rgba(0, 0, 0, 0.1)',
      border: '1px solid rgba(255, 255, 255, 0.3)'
    }}>
      {/* 左侧：时光日志（过去的事件） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '0 4px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#495057' }}>
            ⏰ 时光日志
          </h3>
          {/* 同步状态信息 */}
          <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>
            🔄 {microsoftService && microsoftService.isSignedIn() ? '已连接' : '未连接'}
            {lastSyncTime && microsoftService && microsoftService.isSignedIn() && (
              <span style={{ marginLeft: '8px', color: '#28a745' }}>
                | 最后同步: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowOngoingConfig(!showOngoingConfig)}
              style={{
                background: 'none',
                border: '1px solid #dee2e6',
                cursor: 'pointer',
                fontSize: '0.75rem',
                padding: '4px 8px',
                borderRadius: '4px',
                color: '#6c757d'
              }}
              title="配置显示天数"
            >
              ⚙️ {ongoingDaysConfig}天
            </button>
            
            {showOngoingConfig && (
              <div style={{
                position: 'absolute',
                top: '100%',
                right: 0,
                marginTop: '4px',
                padding: '8px',
                backgroundColor: 'white',
                border: '1px solid #dee2e6',
                borderRadius: '4px',
                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                zIndex: 1000,
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                minWidth: '200px'
              }}>
                <span style={{ color: '#666', whiteSpace: 'nowrap', fontSize: '0.75rem' }}>显示天数:</span>
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
                  onClick={applyOngoingConfig}
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
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          padding: '12px',
          backgroundColor: '#f8f9fa'
        }}>
          {pastEvents.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              fontSize: '0.9rem'
            }}>
              暂无历史记录
            </div>
          ) : (
            pastEvents.map(event => renderEventItem(event, true))
          )}
        </div>
      </div>

      {/* 右侧：我的日程（未来的事件） */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          marginBottom: '16px',
          padding: '0 4px'
        }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', color: '#495057' }}>
            📅 我的日程
          </h3>
          {/* 同步状态信息 */}
          <div style={{ fontSize: '0.8rem', color: '#6c757d', marginRight: '10px' }}>
            🔄 {microsoftService && microsoftService.isSignedIn() ? '已连接' : '未连接'}
            {lastSyncTime && microsoftService && microsoftService.isSignedIn() && (
              <span style={{ marginLeft: '8px', color: '#28a745' }}>
                | 最后同步: {lastSyncTime.toLocaleTimeString()}
              </span>
            )}
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              backgroundColor: '#007bff',
              color: 'white',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            ➕ 添加日程
          </button>
        </div>

        <div style={{ 
          flex: 1, 
          overflowY: 'auto',
          border: '1px solid #dee2e6',
          borderRadius: '6px',
          padding: '12px',
          backgroundColor: '#fff'
        }}>
          {futureEvents.length === 0 ? (
            <div style={{
              padding: '20px',
              textAlign: 'center',
              color: '#666',
              fontSize: '0.9rem'
            }}>
              暂无未来日程
            </div>
          ) : (
            futureEvents.map(event => renderEventItem(event, false))
          )}
        </div>
      </div>

      {/* 添加/编辑事件弹窗 */}
      {(showAddForm || editingEvent) && (
        <div style={{
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
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '24px',
            borderRadius: '8px',
            width: '90%',
            maxWidth: '600px',
            maxHeight: '80vh',
            overflow: 'auto'
          }}>
            <h3>{editingEvent ? '编辑事件' : '添加新事件'}</h3>
            
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>标题 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({...formData, title: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
                placeholder="请输入事件标题"
              />
            </div>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>描述</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({...formData, description: e.target.value})}
                rows={4}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  resize: 'vertical'
                }}
                placeholder="请输入事件描述"
              />
            </div>

            {/* 时间配置 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={(e) => setFormData({...formData, isAllDay: e.target.checked})}
                  style={{ marginRight: '8px' }}
                />
                全天事件
              </label>
              
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div>
                  <label style={{ display: 'block', marginBottom: '4px' }}>日期</label>
                  <input
                    type="date"
                    value={formatDateForInput(selectedDate)}
                    onChange={(e) => setSelectedDate(new Date(e.target.value + 'T00:00:00'))}
                    style={{
                      padding: '8px',
                      border: '1px solid #ddd',
                      borderRadius: '4px'
                    }}
                  />
                </div>
                
                {!formData.isAllDay && (
                  <>
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px' }}>开始时间</label>
                      <input
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                        style={{
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', marginBottom: '4px' }}>结束时间</label>
                      <input
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({...formData, endTime: e.target.value})}
                        style={{
                          padding: '8px',
                          border: '1px solid #ddd',
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 标签选择 */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', marginBottom: '4px' }}>标签</label>
              <select
                value={formData.tagId}
                onChange={(e) => setFormData({...formData, tagId: e.target.value})}
                style={{
                  width: '100%',
                  padding: '8px',
                  border: '1px solid #ddd',
                  borderRadius: '4px'
                }}
              >
                <option value="">选择标签</option>
                {(() => {
                  try {
                    const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
                    if (!savedTags) return [];
                    return flattenTags(savedTags);
                  } catch {
                    return [];
                  }
                })().map(tag => (
                  <option key={tag.id} value={tag.id}>
                    {tag.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setEditingEvent(null);
                  setFormData({
                    title: '',
                    description: '',
                    startTime: '',
                    endTime: '',
                    location: '',
                    isAllDay: false,
                    reminder: 15,
                    category: 'planning',
                    tagId: ''
                  });
                }}
                style={{
                  padding: '8px 16px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  backgroundColor: '#f8f9fa'
                }}
              >
                取消
              </button>
              
              <button
                onClick={addEvent}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {editingEvent ? '保存修改' : '添加事件'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedTimeline;