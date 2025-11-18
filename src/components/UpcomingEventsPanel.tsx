import React, { useState, useEffect } from 'react';
import './UpcomingEventsPanel.css';

// 导入本地 SVG 图标
import TimerStartIconSvg from '../assets/icons/timer_start.svg';
import TaskGrayIconSvg from '../assets/icons/task_gray.svg';
import AttendeeIconSvg from '../assets/icons/Attendee.svg';
import LocationIconSvg from '../assets/icons/Location.svg';
import RightIconSvg from '../assets/icons/right.svg';
import HideIconSvg from '../assets/icons/hide.svg';

// 图标组件
const TimerStartIcon = ({ className }: { className?: string }) => <img src={TimerStartIconSvg} alt="" className={className} style={{ width: '20px', height: '20px' }} />;
const TaskGrayIcon = ({ className }: { className?: string }) => <img src={TaskGrayIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const AttendeeIcon = ({ className }: { className?: string }) => <img src={AttendeeIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const LocationIcon = ({ className }: { className?: string }) => <img src={LocationIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const RightIcon = ({ className }: { className?: string }) => <img src={RightIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const HideIcon = ({ className }: { className?: string }) => <img src={HideIconSvg} alt="" className={className} style={{ width: '20px', height: '20px', opacity: 0.6 }} />;

type ActionIndicatorType = 'start' | 'deadline' | 'new' | 'updated' | 'done';

interface EventItem {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  isAllDay?: boolean;
  attendees?: string[];
  location?: string;
  description?: string;
  actionIndicator: ActionIndicatorType;
  countdown?: string;
}

interface UpcomingEventsPanelProps {
  onTimeFilterChange?: (filter: 'today' | 'tomorrow' | 'week' | 'nextWeek') => void;
}

const UpcomingEventsPanel: React.FC<UpcomingEventsPanelProps> = ({ onTimeFilterChange }) => {
  const [activeFilter, setActiveFilter] = useState<'today' | 'tomorrow' | 'week' | 'nextWeek'>('today');
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isVisible, setIsVisible] = useState(true);

  // Update current time every minute
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  // Sample event data matching Figma design
  const [events] = useState<EventItem[]>([
    {
      id: '1',
      title: '🎙️ 议程讨论',
      tag: '#🧐展会',
      tagColor: '#10b981',
      startTime: '13:00开始',
      countdown: '还有1h',
      attendees: ['Zoey Gong', 'Jenny Wong', 'Cindy Cai'],
      location: '静安嘉里中心2座F38，RM工作室，5号会议室',
      actionIndicator: 'start',
    },
    {
      id: '2',
      title: '📚 协议定稿',
      tag: '#🧮采购',
      tagColor: '#3b82f6',
      endTime: '17:00截止',
      countdown: '还有1h',
      attendees: ['Zoey Gong', 'Jenny Wong', 'Cindy Cai'],
      location: '静安嘉里中心2座F38，RM工作室，5号会议室',
      actionIndicator: 'deadline',
    },
    {
      id: '3',
      title: '🎆️ 巴塞罗那美食source',
      tag: '#🤩丰富多彩的快乐生活',
      tagColor: '#a855f7',
      startTime: '晚上',
      description: '西班牙海鲜炖饭（Paella）、塔帕斯...',
      actionIndicator: 'new',
    },
  ]);

  const handleFilterChange = (filter: 'today' | 'tomorrow' | 'week' | 'nextWeek') => {
    setActiveFilter(filter);
    onTimeFilterChange?.(filter);
  };

  const toggleVisibility = () => {
    setIsVisible(!isVisible);
  };

  const getActionIndicatorIcon = (type: ActionIndicatorType) => {
    switch (type) {
      case 'start':
        return <TimerStartIcon />;
      case 'deadline':
        return <TaskGrayIcon />;
      case 'new':
        return <TaskGrayIcon />;
      case 'updated':
        return <TaskGrayIcon />;
      case 'done':
        return <TaskGrayIcon />;
      default:
        return <TaskGrayIcon />;
    }
  };

  const getActionIndicatorColor = (type: ActionIndicatorType) => {
    switch (type) {
      case 'start':
        return '#ef4444'; // Red
      case 'deadline':
        return '#f59e0b'; // Orange
      case 'new':
        return '#6366f1'; // Indigo
      case 'updated':
        return '#9ca3af'; // Gray
      case 'done':
        return '#10b981'; // Green
      default:
        return '#6366f1';
    }
  };

  const renderEventCard = (event: EventItem) => {
    const indicatorColor = getActionIndicatorColor(event.actionIndicator);
    const indicatorIcon = getActionIndicatorIcon(event.actionIndicator);

    return (
      <div key={event.id} className="event-card">
        {/* Action Indicator Line */}
        <div
          className="event-indicator-line"
          style={{ backgroundColor: indicatorColor }}
        />

        <div className="event-card-content">
          {/* Event Header */}
          <div className="event-header">
            <div className="event-icon">{indicatorIcon}</div>
            <h4 className="event-title">{event.title}</h4>
          </div>

          {/* Event Tag */}
          <div className="event-tag" style={{ color: event.tagColor }}>
            {event.tag}
          </div>

          {/* Event Time Info */}
          <div className="event-time-row">
            {event.startTime && (
              <div className="event-time-info">
                <span className="event-time-label">{event.startTime}</span>
              </div>
            )}
            {event.endTime && (
              <div className="event-time-info">
                <span className="event-time-label">{event.endTime}</span>
              </div>
            )}
            {event.countdown && (
              <div
                className="event-countdown"
                style={{
                  background: `linear-gradient(to right, #22d3ee, #3b82f6)`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {event.countdown}
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

          {/* Event Description */}
          {event.description && (
            <div className="event-description">
              <RightIcon className="event-description-icon" />
              <span className="event-description-text">{event.description}</span>
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
      </div>

      {/* Divider Lines with Action Indicator Labels */}
      <div className="event-divider">
        <div className="event-divider-line" />
      </div>

      {/* Event Cards */}
      <div className="event-list">
        {events.map((event) => renderEventCard(event))}
      </div>
    </div>
  );
};

export default UpcomingEventsPanel;
