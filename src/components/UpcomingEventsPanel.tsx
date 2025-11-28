import React, { useState, useEffect, useMemo } from 'react';
import './UpcomingEventsPanel.css';
import { Event } from '../types';
import { 
  TimeFilter, 
  filterAndSortEvents, 
  formatCountdown,
  getTimeRange
} from '../utils/upcomingEventsHelper';
import { shouldShowCheckbox } from '../utils/eventHelpers';
import { EventService } from '../services/EventService';
import { TagService } from '../services/TagService';
import { formatRelativeDate, formatRelativeTimeDisplay } from '../utils/relativeDateFormatter';
import { formatTimeForStorage } from '../utils/timeUtils';

// 导入本地 SVG 图标
import TimerStartIconSvg from '../assets/icons/timer_start.svg';
import TaskGrayIconSvg from '../assets/icons/task_gray.svg';
import AttendeeIconSvg from '../assets/icons/Attendee.svg';
import LocationIconSvg from '../assets/icons/Location.svg';
import RightIconSvg from '../assets/icons/right.svg';
import HideIconSvg from '../assets/icons/hide.svg';

// 图标组件
const TimerStartIcon = ({ className }: { className?: string }) => <img src={TimerStartIconSvg} alt="Timer Start" className={className} style={{ width: '20px', height: '20px' }} />;
const TaskGrayIcon = ({ className }: { className?: string }) => <img src={TaskGrayIconSvg} alt="Task" className={className} style={{ width: '16px', height: '16px' }} />;
const AttendeeIcon = ({ className }: { className?: string }) => <img src={AttendeeIconSvg} alt="Attendee" className={className} style={{ width: '16px', height: '16px' }} />;
const LocationIcon = ({ className }: { className?: string }) => <img src={LocationIconSvg} alt="Location" className={className} style={{ width: '16px', height: '16px' }} />;
const RightIcon = ({ className }: { className?: string }) => <img src={RightIconSvg} alt="Expand" className={className} style={{ width: '16px', height: '16px' }} />;
const HideIcon = ({ className }: { className?: string }) => <img src={HideIconSvg} alt="Hide" className={className} style={{ width: '20px', height: '20px', opacity: 0.6 }} />;

interface UpcomingEventsPanelProps {
  onTimeFilterChange?: (filter: TimeFilter) => void;
  onEventClick?: (event: Event) => void; // 点击事件卡片
}

const UpcomingEventsPanel: React.FC<UpcomingEventsPanelProps> = ({ 
  onTimeFilterChange,
  onEventClick
}) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);
  const [showExpired, setShowExpired] = useState(false); // 是否展开过期事件
  const [allEvents, setAllEvents] = useState<Event[]>([]); // 从 EventService 加载的所有事件

  // 从 EventService 加载所有事件
  useEffect(() => {
    // 🚀 [性能优化] 使用 getEventsByRange 按范围加载事件
    const loadEventsByFilter = (filter: TimeFilter) => {
      // 计算时间范围（复用 upcomingEventsHelper 的逻辑）
      const { start, end } = getTimeRange(filter, currentTime);
      
      // 使用性能优化的范围查询
      const events = EventService.getEventsByRange(start, end);
      
      console.log('🔍 [UpcomingEventsPanel] 按范围加载事件:', {
        filter,
        range: `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
        count: events.length
      });
      
      setAllEvents(events);
    };

    // 初始加载
    loadEventsByFilter(activeFilter);

    // 🎯 [性能优化] 增量更新：只更新变化的单个事件
    const handleEventsUpdated = (e: any) => {
      const { eventId, isNewEvent } = e.detail || {};
      
      if (!eventId) {
        // 没有 eventId，fallback 到全量重载
        console.log('[UpcomingEventsPanel] 无 eventId，全量重载');
        loadEventsByFilter(activeFilter);
        return;
      }
      
      console.log('[UpcomingEventsPanel] 收到 eventsUpdated 事件，增量更新:', {
        eventId: eventId.slice(-8),
        isNewEvent
      });
      
      // 增量更新：只更新这一个事件
      const updatedEvent = EventService.getEventById(eventId);
      
      setAllEvents(prev => {
        if (!updatedEvent) {
          // 事件被删除
          return prev.filter(e => e.id !== eventId);
        }
        
        // 检查事件是否已存在
        const existingIndex = prev.findIndex(e => e.id === eventId);
        
        if (existingIndex >= 0) {
          // 更新现有事件
          const updated = [...prev];
          updated[existingIndex] = updatedEvent;
          return updated;
        } else if (isNewEvent) {
          // 新事件，添加到列表
          return [...prev, updatedEvent];
        } else {
          // 事件不在当前列表中，且不是新事件，忽略
          return prev;
        }
      });
    };

    window.addEventListener('eventsUpdated', handleEventsUpdated as EventListener);

    return () => {
      window.removeEventListener('eventsUpdated', handleEventsUpdated);
    };
  }, [activeFilter, currentTime]);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // 筛选和排序事件
  const { upcoming, expired } = useMemo(() => {
    return filterAndSortEvents(allEvents, activeFilter, currentTime);
  }, [allEvents, activeFilter, currentTime]);

  const handleFilterChange = (filter: TimeFilter) => {
    setActiveFilter(filter);
    onTimeFilterChange?.(filter);
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const toggleExpiredSection = () => {
    setShowExpired(!showExpired);
  };

  const handleCheckboxChange = (eventId: string, checked: boolean) => {
    console.log('[UpcomingEventsPanel] handleCheckboxChange:', { eventId: eventId.slice(-10), checked });
    
    // ✅ 1. 立即更新本地 UI（乐观更新）
    setAllEvents(prev => {
      const updated = prev.map(e => {
        if (e.id === eventId) {
          // 更新本地 checked/unchecked 数组
          const timestamp = new Date().toISOString();
          if (checked) {
            return { ...e, checked: [...(e.checked || []), timestamp] };
          } else {
            return { ...e, unchecked: [...(e.unchecked || []), timestamp] };
          }
        }
        return e;
      });
      return updated;
    });
    
    // ✅ 2. 调用 EventService 持久化
    if (checked) {
      EventService.checkIn(eventId);
    } else {
      EventService.uncheck(eventId);
    }
    
    // ✅ 3. EventService.dispatchEventUpdate 会触发 eventsUpdated 事件
    //    useEffect 监听器会重新加载，确保和 localStorage 同步
  };

  const handleEventClick = (event: Event) => {
    onEventClick?.(event);
  };

  /**
   * 从标题中移除标签和日期mention元素
   * 标签格式: #tagName 或 #emoji tagName
   * 日期格式: 📅 日期文本
   */
  const cleanEventTitle = (title: string): string => {
    if (!title) return '';
    
    return title
      // 移除标签（# 开头，后面可能有emoji和文字）
      .replace(/#[^\s#📅]*/g, '')
      // 移除日期mention（📅 开头的内容）
      .replace(/📅[^📅#]*/g, '')
      // 移除多余空格
      .replace(/\s+/g, ' ')
      .trim();
  };

  const renderEventCard = (event: Event) => {
    // ✅ 符合 TIME_ARCHITECTURE：优先使用 timeSpec.resolved
    const resolvedTime = event.timeSpec?.resolved || {
      start: event.startTime,
      end: event.endTime
    };
    const isAllDay = event.timeSpec?.allDay ?? event.isAllDay;
    
    // 使用 formatRelativeTimeDisplay 格式化时间显示
    const timeLabel = formatRelativeTimeDisplay(
      resolvedTime.start,
      resolvedTime.end,
      isAllDay
    );
    
    const countdown = formatCountdown(event, currentTime);
    const isExpired = !countdown; // 过期事件没有倒计时
    
    // 获取第一个标签的信息
    const primaryTagId = event.tags && event.tags.length > 0 ? event.tags[0] : null;
    const primaryTag = primaryTagId ? TagService.getTagById(primaryTagId) : null;
    const tagColor = primaryTag?.color || event.color || '#6b7280';
    const tagEmoji = primaryTag?.emoji;
    const tagName = primaryTag?.name;
    
    // 移除标签和日期mention的纯文本标题（用于显示）
    const rawTitle = event.title?.colorTitle || event.title?.simpleTitle || '';
    const cleanTitle = cleanEventTitle(rawTitle);
    
    // 计算是否需要显示日期（仅过期事件需要）
    let dateDisplay: string | undefined;
    if (isExpired && (resolvedTime.start || resolvedTime.end)) {
      const eventDate = new Date(resolvedTime.start || resolvedTime.end!);
      const relativeDate = formatRelativeDate(eventDate, currentTime);
      // 只有不是"今天"或"明天"时才显示
      if (relativeDate !== '今天' && relativeDate !== '明天') {
        dateDisplay = relativeDate;
      }
    }

    return (
      <div 
        key={event.id} 
        className="event-card"
        onClick={() => handleEventClick(event)}
      >
        {/* Action Indicator Line - 使用标签颜色 */}
        <div
          className="event-indicator-line"
          style={{ backgroundColor: tagColor }}
        />

        <div className="event-card-content">
          {/* 第一行: checkbox? + title | 时间icon + 时间 */}
          <div className="event-row-1">
            <div className="event-header">
              {shouldShowCheckbox(event) && (() => {
                // ✅ 直接从 event 对象计算 checked 状态，不调用 EventService
                const lastChecked = event.checked && event.checked.length > 0 
                  ? event.checked[event.checked.length - 1] 
                  : null;
                const lastUnchecked = event.unchecked && event.unchecked.length > 0 
                  ? event.unchecked[event.unchecked.length - 1] 
                  : null;
                
                // 比较最后的时间戳
                const isChecked = lastChecked && (!lastUnchecked || lastChecked > lastUnchecked);
                
                return (
                  <div className="event-checkbox">
                    <input 
                      type="checkbox" 
                      checked={!!isChecked} 
                      onChange={(e) => {
                        e.stopPropagation(); // 阻止触发卡片点击
                        handleCheckboxChange(event.id, e.target.checked);
                      }}
                    />
                  </div>
                );
              })()}
              <h4 className="event-title">{cleanTitle}</h4>
            </div>
            {timeLabel && (
              <div className="event-time-info">
                <TimerStartIcon />
                <span className="event-time-label">{timeLabel}</span>
              </div>
            )}
          </div>

          {/* 第二行: 标签 | 倒计时/日期 */}
          <div className="event-row-2">
            {tagName && (
              <div className="event-tag" style={{ color: tagColor }}>
                #{tagEmoji ? `${tagEmoji} ` : ''}{tagName}
              </div>
            )}
            {countdown && (
              <div
                className="event-countdown"
                style={{
                  background: `linear-gradient(to right, #22d3ee, #3b82f6)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {countdown}
              </div>
            )}
            {dateDisplay && (
              <div className="event-date">
                {dateDisplay}
              </div>
            )}
          </div>

          {/* Event Attendees */}
          {event.attendees && (
            <div className="event-attendees">
              <AttendeeIcon className="event-attendees-icon" />
              <span className="event-attendees-text">
                {event.attendees.join('; ')}
              </span>
            </div>
          )}

          {/* Event Location */}
          {event.location && (
            <div className="event-location">
              <LocationIcon className="event-location-icon" />
              <span className="event-location-text">{event.location}</span>
            </div>
          )}

          {/* Event Log Preview */}
          {event.description && (
            <div className="event-log-preview">
              <RightIcon className="event-log-expand-icon" />
              <span className="event-log-text">{event.description}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="upcoming-events-panel">
      {/* Section Header - 完全匹配计划清单结构 */}
      <div className="section-header">
        <div className="title-indicator" />
        <h3>即将到来</h3>
        <button className="panel-toggle-btn" onClick={toggleVisibility}>
          <HideIcon />
        </button>
      </div>

      {/* Time Filter Buttons */}
      <div className="filter-buttons">
        <button
          className={`filter-btn ${activeFilter === 'today' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('today')}
        >
          今天
        </button>
        <button
          className={`filter-btn ${activeFilter === 'tomorrow' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('tomorrow')}
        >
          明天
        </button>
        <button
          className={`filter-btn ${activeFilter === 'week' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('week')}
        >
          本周
        </button>
        <button
          className={`filter-btn ${activeFilter === 'nextWeek' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('nextWeek')}
        >
          下周
        </button>
        <button
          className={`filter-btn ${activeFilter === 'all' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('all')}
        >
          全部
        </button>
      </div>

      {/* Event Cards */}
      <div className="event-list">
        {/* 即将开始的事件 */}
        {upcoming.map((event) => renderEventCard(event))}

        {/* 过期事件分隔符 */}
        {expired.length > 0 && (
          <div className="expired-divider" onClick={toggleExpiredSection}>
            <div className="expired-divider-line" />
            <span className="expired-label">
              已过期 ({expired.length})
            </span>
            <RightIcon 
              className={`expired-expand-icon ${showExpired ? 'expanded' : ''}`}
            />
          </div>
        )}

        {/* 已过期的事件（可展开/收缩） */}
        {showExpired && expired.map((event) => renderEventCard(event))}
      </div>
    </div>
  );
};

export default UpcomingEventsPanel;
