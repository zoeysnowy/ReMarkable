import React, { useState, useEffect, useMemo } from 'react';
import './UpcomingEventsPanel.css';
import { Event } from '../types';
import { 
  TimeFilter, 
  filterAndSortEvents, 
  formatCountdown, 
  formatTimeLabel 
} from '../utils/upcomingEventsHelper';
import { shouldShowCheckbox } from '../utils/eventHelpers';

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
  events: Event[]; // 传入的事件列表
  onTimeFilterChange?: (filter: TimeFilter) => void;
  onEventClick?: (event: Event) => void; // 点击事件卡片
  onCheckboxChange?: (eventId: string, checked: boolean) => void; // checkbox 状态变化
}

const UpcomingEventsPanel: React.FC<UpcomingEventsPanelProps> = ({ 
  events,
  onTimeFilterChange,
  onEventClick,
  onCheckboxChange
}) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);
  const [showExpired, setShowExpired] = useState(false); // 是否展开过期事件

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // 筛选和排序事件
  const { upcoming, expired } = useMemo(() => {
    return filterAndSortEvents(events, activeFilter, currentTime);
  }, [events, activeFilter, currentTime]);

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
    onCheckboxChange?.(eventId, checked);
  };

  const handleEventClick = (event: Event) => {
    onEventClick?.(event);
  };

  const renderEventCard = (event: Event) => {
    const timeLabel = formatTimeLabel(event);
    const countdown = formatCountdown(event, currentTime);
    
    // 获取第一个标签作为显示（目前简化处理，使用默认颜色）
    const primaryTagId = event.tags && event.tags.length > 0 ? event.tags[0] : null;
    // TODO: 从 TagService 获取标签的真实颜色和名称
    const tagColor = event.color || '#6b7280'; // 使用 event.color 或默认灰色

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
              {shouldShowCheckbox(event) && (
                <div className="event-checkbox">
                  <input 
                    type="checkbox" 
                    checked={!!event.checked} 
                    onChange={(e) => {
                      e.stopPropagation(); // 阻止触发卡片点击
                      handleCheckboxChange(event.id, e.target.checked);
                    }}
                  />
                </div>
              )}
              <h4 className="event-title">{event.title}</h4>
            </div>
            {timeLabel && (
              <div className="event-time-info">
                <TimerStartIcon />
                <span className="event-time-label">{timeLabel}</span>
              </div>
            )}
          </div>

          {/* 第二行: 标签 | 倒计时 */}
          <div className="event-row-2">
            {primaryTagId && (
              <div className="event-tag" style={{ color: tagColor }}>
                {event.category || primaryTagId}
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
