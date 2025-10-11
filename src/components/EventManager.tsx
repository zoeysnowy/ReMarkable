import React, { useState, useEffect, useCallback } from 'react';
import { Event } from '../types';
import { MicrosoftCalendarService } from '../services/MicrosoftCalendarService';
import { formatTimeForStorage, parseLocalTimeString, formatTimeForInput, formatDateForInput, formatDisplayTime } from '../utils/timeUtils';
import { STORAGE_KEYS } from '../constants/storage';

// 🔧 移除重复的函数定义，只使用导入的版本

interface EventTag {
  id: string;
  name: string;
  color: string;
  outlookCalendarId?: string;
  category: 'ongoing' | 'planning';
}

interface EventManagerProps {
  onStartTimer: (taskTitle: string) => void;
  microsoftService?: MicrosoftCalendarService;
}

export const EventManager: React.FC<EventManagerProps> = ({ 
  onStartTimer, 
  microsoftService 
}) => {
  const [events, setEvents] = useState<Event[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [eventTags, setEventTags] = useState<EventTag[]>([]);
  
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

  // 格式化时间的辅助函数
  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}小时${minutes.toString().padStart(2, '0')}分`;
    } else if (minutes > 0) {
      return `${minutes}分${secs.toString().padStart(2, '0')}秒`;
    } else {
      return `${secs}秒`;
    }
  };

  // 检查是否为计时器创建的事件
  const isTimerEvent = (event: Event): boolean => {
    return !!(event as any).timerSessionId || event.id.startsWith('timer-');
  };

  // 获取事件持续时间
  const getEventDuration = (event: Event): number => {
    const startTime = parseLocalTimeString(event.startTime); // 🔧 使用工具函数
    const endTime = parseLocalTimeString(event.endTime);     // 🔧 使用工具函数
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  };

  // 加载事件数据
  const loadEvents = useCallback(() => {
    try {
      const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
      if (savedEvents) {
        const parsedEvents = JSON.parse(savedEvents);
        setEvents(parsedEvents);
        console.log('📅 [EventManager] Loaded events:', parsedEvents.length);
      } else {
        setEvents([]);
      }
    } catch (error) {
      console.error('❌ [EventManager] Failed to load events:', error);
      setEvents([]);
    }
  }, []);

  // 初始加载事件
  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  // 监听事件更新
  useEffect(() => {
    const handleOngoingEventsUpdate = (event: CustomEvent) => {
      console.log('📥 [EventManager] Received ongoing events update');
      loadEvents();
    };

    const handleOutlookEventsUpdate = (event: CustomEvent) => {
      console.log('📥 [EventManager] Received Outlook events update');
      loadEvents();
    };

    window.addEventListener('timer-events-updated', handleOngoingEventsUpdate as EventListener);
    window.addEventListener('outlook-events-updated', handleOutlookEventsUpdate as EventListener);
    window.addEventListener('ongoing-sync-completed', handleOngoingEventsUpdate as EventListener);

    return () => {
      window.removeEventListener('timer-events-updated', handleOngoingEventsUpdate as EventListener);
      window.removeEventListener('outlook-events-updated', handleOutlookEventsUpdate as EventListener);
      window.removeEventListener('ongoing-sync-completed', handleOngoingEventsUpdate as EventListener);
    };
  }, [loadEvents]);

  // 监听来自左侧的编辑事件请求
  useEffect(() => {
    const handleEditOngoingEvent = (event: CustomEvent) => {
      const { eventId } = event.detail;
      const eventToEdit = events.find((e: any) => e.id === eventId);
      if (eventToEdit) {
        setEditingEvent(eventToEdit);
        setSelectedDate(parseLocalTimeString(eventToEdit.startTime)); // 🔧 使用工具函数
        
        const eventTag = getEventTag(eventToEdit);
        
        setFormData({
          title: eventToEdit.title,
          description: eventToEdit.description || '',
          startTime: formatTimeForInput(eventToEdit.startTime), // 🔧 使用工具函数
          endTime: formatTimeForInput(eventToEdit.endTime),     // 🔧 使用工具函数
          location: eventToEdit.location || '',
          isAllDay: eventToEdit.isAllDay || false,
          reminder: eventToEdit.reminder || 15,
          category: eventTag?.category || 'planning',
          tagId: (eventToEdit as any).tagId || ''
        });
        setShowAddForm(true);
      }
    };

    window.addEventListener('edit-ongoing-event', handleEditOngoingEvent as EventListener);

    return () => {
      window.removeEventListener('edit-ongoing-event', handleEditOngoingEvent as EventListener);
    };
  }, [events, eventTags]);

  // 加载事件标签
  useEffect(() => {
    const savedTags = localStorage.getItem(STORAGE_KEYS.EVENT_TAGS);
    if (savedTags) {
      setEventTags(JSON.parse(savedTags));
    } else {
      const defaultTags: EventTag[] = [
        { id: 'ongoing-work', name: '工作', color: '#007bff', category: 'ongoing' },
        { id: 'ongoing-exercise', name: '运动', color: '#28a745', category: 'ongoing' },
        { id: 'ongoing-life', name: '生活', color: '#ffc107', category: 'ongoing' },
        { id: 'ongoing-entertainment', name: '娱乐', color: '#e83e8c', category: 'ongoing' },
        { id: 'planning-meeting', name: '会议', color: '#6610f2', category: 'planning' },
        { id: 'planning-deadline', name: '截止日期', color: '#dc3545', category: 'planning' },
        { id: 'planning-reminder', name: '提醒', color: '#20c997', category: 'planning' }
      ];
      setEventTags(defaultTags);
      localStorage.setItem(STORAGE_KEYS.EVENT_TAGS, JSON.stringify(defaultTags));
    }
  }, []);

  // 保存事件到localStorage
  const saveEvents = (updatedEvents: Event[]) => {
    setEvents(updatedEvents);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
  };

  // 获取事件的标签
  const getEventTag = (event: Event): EventTag | undefined => {
    return eventTags.find((tag: any) => tag.id === (event as any).tagId);
  };

  // 重置表单
  const resetForm = () => {
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
    setEditingEvent(null);
    setShowAddForm(false);
  };

  // 取消表单
  const cancelForm = () => {
    resetForm();
  };

  // 处理表单提交
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (editingEvent) {
      await saveEditedEvent();
    } else {
      await addEvent();
    }
  };

  // 编辑事件
  const editEvent = (event: Event) => {
    setEditingEvent(event);
    setSelectedDate(parseLocalTimeString(event.startTime)); // 🔧 使用工具函数
    
    const eventTag = getEventTag(event);
    
    setFormData({
      title: event.title,
      description: event.description || '',
      startTime: formatTimeForInput(event.startTime), // 🔧 使用工具函数
      endTime: formatTimeForInput(event.endTime),     // 🔧 使用工具函数
      location: event.location || '',
      isAllDay: event.isAllDay || false,
      reminder: event.reminder || 15,
      category: eventTag?.category || 'planning',
      tagId: (event as any).tagId || ''
    });
    setShowAddForm(true);
  };

  // 保存编辑的事件
  const saveEditedEvent = async () => {
    if (!editingEvent || !formData.title.trim()) {
      alert('请输入事件标题！');
      return;
    }

    try {
      let startTime: string;
      let endTime: string;

      if (formData.isAllDay) {
        const allDayStart = new Date(selectedDate);
        allDayStart.setHours(0, 0, 0, 0);
        const allDayEnd = new Date(selectedDate);
        allDayEnd.setHours(23, 59, 59, 999);
        
        startTime = formatTimeForStorage(allDayStart);
        endTime = formatTimeForStorage(allDayEnd);
      } else {
        const startDateTime = new Date(`${formatDateForInput(selectedDate)}T${formData.startTime}:00`);
        const endDateTime = new Date(`${formatDateForInput(selectedDate)}T${formData.endTime}:00`);
        
        startTime = formatTimeForStorage(startDateTime);
        endTime = formatTimeForStorage(endDateTime);
      }

      if (parseLocalTimeString(startTime) >= parseLocalTimeString(endTime) && !formData.isAllDay) {
        alert('结束时间必须晚于开始时间！');
        return;
      }

      const updatedEvent: any = {
        ...editingEvent,
        title: formData.title,
        description: formData.description || undefined,
        startTime,
        endTime,
        location: formData.location || undefined,
        isAllDay: formData.isAllDay,
        reminder: formData.reminder,
        updatedAt: formatTimeForStorage(new Date()),
        ...(formData.tagId ? { tagId: formData.tagId } : {})
      };

      // 检查是否为 ongoing 事件，如果是则同步到 Outlook
      const isOngoingEvent = (editingEvent as any).timerSessionId || 
                            editingEvent.id.startsWith('timer-') ||
                            (editingEvent as any).category === 'ongoing';

      if (isOngoingEvent || ((editingEvent as any).externalId && (editingEvent as any).calendarId === 'microsoft')) {
        if (microsoftService?.isSignedIn()) {
          try {
            if ((editingEvent as any).externalId) {
              await microsoftService.updateEvent((editingEvent as any).externalId, updatedEvent);
              updatedEvent.syncStatus = 'synced';
              console.log('✅ Updated ongoing event in Outlook:', updatedEvent.title);
            } else {
              const createdOutlookEvent = await microsoftService.createEvent(updatedEvent);
              updatedEvent.externalId = createdOutlookEvent.id;
              updatedEvent.calendarId = 'microsoft';
              updatedEvent.syncStatus = 'synced';
              console.log('✅ Created ongoing event in Outlook:', updatedEvent.title);
            }
          } catch (error) {
            console.error('❌ Failed to sync ongoing event to Outlook:', error);
            updatedEvent.syncStatus = 'error';
          }
        } else {
          updatedEvent.syncStatus = 'pending';
        }
      }

      const updatedEvents = events.map((event: any) =>
        event.id === editingEvent.id ? updatedEvent : event
      );
      saveEvents(updatedEvents);
      resetForm();

      // 如果是 ongoing 事件，触发 timer 事件更新
      if (isOngoingEvent) {
        window.dispatchEvent(new CustomEvent('timer-events-updated', {
          detail: { events: updatedEvents }
        }));
      }

    } catch (error) {
      alert(`保存失败: ${error}`);
    }
  };

  // 添加新事件
  const addEvent = async () => {
    if (!formData.title.trim()) {
      alert('请输入事件标题！');
      return;
    }

    if (!formData.isAllDay && (!formData.startTime || !formData.endTime)) {
      alert('请设置开始和结束时间！');
      return;
    }

    try {
      let startTime: string;
      let endTime: string;

      if (formData.isAllDay) {
        const allDayStart = new Date(selectedDate);
        allDayStart.setHours(0, 0, 0, 0);
        const allDayEnd = new Date(selectedDate);
        allDayEnd.setHours(23, 59, 59, 999);
        
        startTime = formatTimeForStorage(allDayStart);
        endTime = formatTimeForStorage(allDayEnd);
      } else {
        const startDateTime = new Date(`${formatDateForInput(selectedDate)}T${formData.startTime}:00`);
        const endDateTime = new Date(`${formatDateForInput(selectedDate)}T${formData.endTime}:00`);
        
        startTime = formatTimeForStorage(startDateTime);
        endTime = formatTimeForStorage(endDateTime);
      }

      if (parseLocalTimeString(startTime) >= parseLocalTimeString(endTime) && !formData.isAllDay) {
        alert('结束时间必须晚于开始时间！');
        return;
      }

      const event: any = {
        id: Date.now().toString(),
        title: formData.title,
        description: formData.description || undefined,
        startTime,
        endTime,
        location: formData.location || undefined,
        isAllDay: formData.isAllDay,
        reminder: formData.reminder,
        syncStatus: 'pending',
        createdAt: formatTimeForStorage(new Date()),
        updatedAt: formatTimeForStorage(new Date()),
        ...(formData.tagId ? { tagId: formData.tagId } : {})
      };

      if (microsoftService?.isSignedIn()) {
        try {
          const createdOutlookEvent = await microsoftService.createEvent(event);
          event.externalId = createdOutlookEvent.id;
          event.calendarId = 'microsoft';
          event.syncStatus = 'synced';
        } catch (error) {
          console.error('Failed to sync to Outlook:', error);
          event.syncStatus = 'error';
        }
      }

      const updatedEvents = [...events, event].sort((a: any, b: any) => 
        parseLocalTimeString(a.startTime).getTime() - parseLocalTimeString(b.startTime).getTime()
      );
      saveEvents(updatedEvents);
      resetForm();

    } catch (error) {
      alert(`创建事件失败: ${error}`);
    }
  };

  // 删除事件
  const deleteEvent = async (id: string) => {
    if (window.confirm('确定要删除这个事件吗？')) {
      const eventToDelete = events.find((e: any) => e.id === id);
      
      if (eventToDelete?.externalId && (eventToDelete as any).calendarId === 'microsoft') {
        if (microsoftService?.isSignedIn()) {
          try {
            await microsoftService.deleteEvent((eventToDelete as any).externalId);
          } catch (error) {
            console.error('Failed to delete from Outlook:', error);
            if (!window.confirm('从 Outlook 删除失败，是否仍要从本地删除？')) {
              return;
            }
          }
        }
      }

      const updatedEvents = events.filter((event: any) => event.id !== id);
      saveEvents(updatedEvents);
    }
  };

  // 重新同步事件
  const resyncEvent = async (event: Event) => {
    if (!microsoftService?.isSignedIn()) {
      alert('请先连接Microsoft Calendar');
      return;
    }

    try {
      console.log('🔄 Re-syncing event to Outlook:', event.title);
      
      let updatedEvent: any;
      
      if ((event as any).externalId && (event as any).calendarId === 'microsoft') {
        try {
          await microsoftService.updateEvent((event as any).externalId, event);
          updatedEvent = {
            ...event,
            syncStatus: 'synced',
            updatedAt: formatTimeForStorage(new Date())
          };
          alert(`事件"${event.title}"已成功更新到Outlook！`);
        } catch (updateError: any) {
          const createdOutlookEvent = await microsoftService.createEvent(event);
          updatedEvent = {
            ...event,
            externalId: createdOutlookEvent.id,
            calendarId: 'microsoft',
            syncStatus: 'synced',
            updatedAt: formatTimeForStorage(new Date())
          };
          alert(`原事件已被删除，已重新创建并同步"${event.title}"到Outlook！`);
        }
      } else {
        const createdOutlookEvent = await microsoftService.createEvent(event);
        updatedEvent = {
          ...event,
          externalId: createdOutlookEvent.id,
          calendarId: 'microsoft',
          syncStatus: 'synced',
          updatedAt: formatTimeForStorage(new Date())
        };
        alert(`事件"${event.title}"已成功同步到Outlook！`);
      }

      const updatedEvents = events.map((e: any) => 
        e.id === event.id ? updatedEvent : e
      );
      saveEvents(updatedEvents);
      
    } catch (error) {
      console.error('❌ Re-sync failed:', error);
      
      const updatedEvents = events.map((e: any) => 
        e.id === event.id ? { ...e, syncStatus: 'error' as const } : e
      );
      saveEvents(updatedEvents);
      
      alert(`重新同步失败: ${error}`);
    }
  };

  // 渲染事件项
  const renderEventItem = (event: Event) => {
    const eventTag = getEventTag(event);
    const isFromTimer = isTimerEvent(event);
    
    // 如果是计时器创建的 ongoing 事件，使用简洁的一行 log 样式
    if (isFromTimer) {
      const duration = getEventDuration(event);
      const startTime = formatDisplayTime(event.startTime); // 🔧 使用工具函数
      
      return (
        <div key={event.id} className="ongoing-log-item-detailed">
          <span className="log-time">{startTime}</span>
          <span className="log-task">{event.title}</span>
          <span className="log-duration">用时{formatDuration(duration)}</span>
          <span 
            className="log-tag" 
            style={{ color: eventTag?.color || '#007bff' }}
          >
            #{eventTag?.name || '未分类'}
          </span>
          <div className="log-actions">
            <button
              onClick={() => editEvent(event)}
              className="btn-edit-mini"
              title="编辑"
            >
              ✏️
            </button>
            <button
              onClick={() => deleteEvent(event.id)}
              className="btn-delete-mini"
              title="删除"
            >
              🗑️
            </button>
          </div>
        </div>
      );
    }
    
    // 原有的事件项样式（用于规划事件等）
    return (
      <div key={event.id} className="event-item">
        <div className="event-header">
          <div className="event-title-section">
            <h4 className="event-title">{event.title}</h4>
            {eventTag && (
              <span 
                className="event-tag" 
                style={{ 
                  backgroundColor: eventTag.color,
                  color: 'white',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  fontSize: '0.8rem',
                  marginLeft: '8px'
                }}
              >
                {eventTag.name}
              </span>
            )}
          </div>
          <div className="event-sync-status">
            {(event as any).syncStatus === 'synced' && <span className="sync-badge synced">✅</span>}
            {(event as any).syncStatus === 'pending' && <span className="sync-badge pending">⏳</span>}
            {(event as any).syncStatus === 'error' && <span className="sync-badge error">❌</span>}
          </div>
        </div>
        
        <div className="event-details">
          <div className="event-time">
            {event.isAllDay ? (
              <span>🗓️ 全天</span>
            ) : (
              <span>
                ⏰ {formatDisplayTime(event.startTime)} - {formatDisplayTime(event.endTime)} {/* 🔧 使用工具函数 */}
              </span>
            )}
          </div>
          
          {event.location && (
            <div className="event-location">📍 {event.location}</div>
          )}
          
          {event.description && (
            <div className="event-description">{event.description}</div>
          )}
        </div>

        <div className="event-actions">
          <button
            onClick={() => editEvent(event)}
            className="btn btn-edit"
            title="编辑事件"
          >
            ✏️
          </button>
          <button
            onClick={() => onStartTimer(event.title)}
            className="btn btn-timer"
            title="开始计时"
          >
            ⏰
          </button>
          {microsoftService?.isSignedIn() && (
            <button
              onClick={() => resyncEvent(event)}
              className="btn btn-sync-single"
              title={(event as any).syncStatus === 'synced' ? '重新同步到Outlook' : '同步到Outlook'}
            >
              🔄
            </button>
          )}
          <button
            onClick={() => deleteEvent(event.id)}
            className="btn btn-delete"
            title="删除事件"
          >
            🗑️
          </button>
        </div>
      </div>
    );
  };

  // 渲染事件列表
  const renderEventsList = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const planningEvents = events.filter((event: any) => {
      const eventTag = getEventTag(event);
      const isFromTimer = isTimerEvent(event);
      return !isFromTimer && 
             (eventTag?.category === 'planning' || (!eventTag && !isFromTimer)) && 
             parseLocalTimeString(event.startTime).getTime() >= tomorrow.getTime();
    });

    return (
      <div className="events-container">
        {/* 日程规划 */}
        <div className="events-section">
          <h3>📋 日程规划</h3>
          <p className="section-description">为提醒自己而设立的未来日程</p>
          
          {planningEvents.length === 0 ? (
            <p className="no-events">暂无日程规划</p>
          ) : (
            <div className="events-list">
              {planningEvents.map((event: any) => renderEventItem(event))}
            </div>
          )}
        </div>
      </div>
    );
  };

  // 事件表单
  const renderEventForm = () => {
    if (!showAddForm && !editingEvent) return null;

    const availableTags = eventTags.filter((tag: any) => tag.category === formData.category);

    return (
      <div className="event-form-overlay">
        <div className="event-form">
          <div className="form-header">
            <h3>{editingEvent ? '编辑日程' : '添加新日程'}</h3>
            <button 
              onClick={cancelForm}
              className="btn btn-close"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            {/* 日程类别选择 */}
            <div className="form-group">
              <label>日程类别:</label>
              <div className="category-selector">
                <label className="radio-option">
                  <input
                    type="radio"
                    value="ongoing"
                    checked={formData.category === 'ongoing'}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      category: e.target.value as 'ongoing' | 'planning',
                      tagId: ''
                    })}
                  />
                  🔄 Ongoing日程
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    value="planning"
                    checked={formData.category === 'planning'}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      category: e.target.value as 'ongoing' | 'planning',
                      tagId: ''
                    })}
                  />
                  📋 日程规划
                </label>
              </div>
            </div>

            {/* 标签选择 */}
            <div className="form-group">
              <label>标签:</label>
              <select
                value={formData.tagId}
                onChange={(e) => setFormData({ ...formData, tagId: e.target.value })}
                className="form-control"
              >
                <option value="">选择标签...</option>
                {availableTags.map((tag: any) => (
                  <option key={tag.id} value={tag.id}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            {/* 标题 */}
            <div className="form-group">
              <label>标题:</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
                className="form-control"
              />
            </div>

            {/* 描述 */}
            <div className="form-group">
              <label>描述:</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="form-control"
                rows={3}
              />
            </div>

            {/* 日期 */}
            <div className="form-group">
              <label>日期:</label>
              <input
                type="date"
                value={formatDateForInput(selectedDate)} // 🔧 修复：使用本地时间格式
                onChange={(e) => {
                  // 🔧 修复：正确解析日期，避免时区转换
                  const dateParts = e.target.value.split('-');
                  const newDate = new Date(
                    parseInt(dateParts[0]), // 年
                    parseInt(dateParts[1]) - 1, // 月（0-11）
                    parseInt(dateParts[2]) // 日
                  );
                  setSelectedDate(newDate);
                }}
                className="form-control"
              />
            </div>

            {/* 全天事件 */}
            <div className="form-group">
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
                />
                全天事件
              </label>
            </div>

            {/* 时间 */}
            {!formData.isAllDay && (
              <div className="form-row">
                <div className="form-group">
                  <label>开始时间:</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    className="form-control"
                  />
                </div>
                <div className="form-group">
                  <label>结束时间:</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                    className="form-control"
                  />
                </div>
              </div>
            )}

            {/* 地点 */}
            <div className="form-group">
              <label>地点:</label>
              <input
                type="text"
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                className="form-control"
              />
            </div>

            {/* 提醒 */}
            <div className="form-group">
              <label>提醒:</label>
              <select
                value={formData.reminder}
                onChange={(e) => setFormData({ ...formData, reminder: parseInt(e.target.value) })}
                className="form-control"
              >
                <option value={0}>无提醒</option>
                <option value={5}>5分钟前</option>
                <option value={15}>15分钟前</option>
                <option value={30}>30分钟前</option>
                <option value={60}>1小时前</option>
                <option value={1440}>1天前</option>
              </select>
            </div>

            <div className="form-actions">
              <button type="submit" className="btn btn-primary">
                {editingEvent ? '更新日程' : '添加日程'}
              </button>
              <button type="button" onClick={cancelForm} className="btn btn-secondary">
                取消
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="event-manager">
      <div className="event-manager-header">
        <h2>📅 我的日程</h2>
        <div className="header-actions">
          <button
            onClick={() => setShowAddForm(true)}
            className="btn btn-primary"
          >
            ➕ 添加日程
          </button>
        </div>
      </div>

      {renderEventsList()}
      {renderEventForm()}
    </div>
  );
};

export default EventManager;