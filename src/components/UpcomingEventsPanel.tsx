import React, { useState, useEffect, useMemo } from 'react';
import './UpcomingEventsPanel.css';
import { Event } from '../types';
import { 
  TimeFilter, 
  filterAndSortEvents, 
  formatCountdown
} from '../utils/upcomingEventsHelper';
import { shouldShowCheckbox } from '../utils/eventHelpers';
import { EventService } from '../services/EventService';
import { TagService } from '../services/TagService';
import { formatRelativeDate, formatRelativeTimeDisplay } from '../utils/relativeDateFormatter';

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
  onCheckboxChange?: (eventId: string, checked: boolean) => void; // checkbox 状态变化
}

const UpcomingEventsPanel: React.FC<UpcomingEventsPanelProps> = ({ 
  onTimeFilterChange,
  onEventClick,
  onCheckboxChange
}) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);
  const [showExpired, setShowExpired] = useState(false); // 是否展开过期事件
  const [allEvents, setAllEvents] = useState<Event[]>([]); // 从 EventService 加载的所有事件

  // 从 EventService 加载所有事件
  useEffect(() => {
    const loadEvents = () => {
      const events = EventService.getAllEvents();
      
      // 🔍 [DEBUG] 检查计时事件的 isTimer 字段
      const timerEvents = events.filter(e => 
        e.description?.includes('[⏱️ 计时') || e.isTimer === true
      );
      console.log('🔍 [UpcomingEventsPanel] 从 EventService 加载的计时事件:', 
        timerEvents.map(e => ({
          id: e.id.slice(-8),
          title: e.title?.colorTitle || e.title?.simpleTitle || '',
          isTimer: e.isTimer,
          description: e.description?.substring(0, 50)
        }))
      );
      
      setAllEvents(events);
    };

    // 初始加载
    loadEvents();

    // 监听事件更新
    const handleEventsUpdated = (e: any) => {
      console.log('[UpcomingEventsPanel] 收到 eventsUpdated 事件:', e.detail);
      loadEvents();
    };

    window.addEventListener('eventsUpdated', handleEventsUpdated as EventListener);

    return () => {
      window.removeEventListener('eventsUpdated', handleEventsUpdated);
    };
  }, []);

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
    console.log('[UpcomingEventsPanel] handleCheckboxChange 被调用:', { eventId: eventId.slice(-10), checked });
    
    // 获取当前状态
    const beforeStatus = EventService.getCheckInStatus(eventId);
    console.log('[UpcomingEventsPanel] 操作前状态:', beforeStatus);
    
    onCheckboxChange?.(eventId, checked);
    
    // 延迟检查状态（等待 EventService 更新）
    setTimeout(() => {
      const afterStatus = EventService.getCheckInStatus(eventId);
      console.log('[UpcomingEventsPanel] 操作后状态:', afterStatus);
    }, 100);
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
    // 使用 formatRelativeTimeDisplay 格式化时间显示
    const timeLabel = formatRelativeTimeDisplay(
      event.startTime,
      event.endTime,
      event.isAllDay
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
    if (isExpired && (event.startTime || event.endTime)) {
      const eventDate = new Date(event.startTime || event.endTime!);
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
                const checkStatus = EventService.getCheckInStatus(event.id);
                console.log(`[UpcomingEventsPanel] 渲染 checkbox [${event.id.slice(-10)}]:`, {
                  isChecked: checkStatus.isChecked,
                  lastCheckIn: checkStatus.lastCheckIn,
                  lastUncheck: checkStatus.lastUncheck,
                  checkInCount: checkStatus.checkInCount,
                  uncheckCount: checkStatus.uncheckCount
                });
                
                return (
                  <div className="event-checkbox">
                    <input 
                      type="checkbox" 
                      checked={checkStatus.isChecked} 
                      onChange={(e) => {
                        e.stopPropagation(); // 阻止触发卡片点击
                        console.log(`[UpcomingEventsPanel] onChange 触发:`, { 
                          eventId: event.id.slice(-10), 
                          newChecked: e.target.checked 
                        });
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
