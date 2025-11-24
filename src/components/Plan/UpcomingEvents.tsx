/**
 * UpcomingEvents - 即将到来事件列表组件
 * 显示今天、明天、本周、下周的即将到来的事件
 */

import React, { useState, useMemo } from 'react';
import { 
  Clock, 
  MapPin, 
  Users, 
  ChevronRight 
} from 'lucide-react';
import { ReactComponent as TaskGrayIcon } from '../../assets/icons/task_gray.svg';
import { ReactComponent as TimerStartIcon } from '../../assets/icons/timer_start.svg';
import { ReactComponent as HideIcon } from '../../assets/icons/hide.svg';
import './UpcomingEvents.css';

interface UpcomingEvent {
  id: string;
  title: string;
  emoji?: string;
  tag?: {
    name: string;
    color: string;
  };
  startTime: Date;
  endTime?: Date;
  isAllDay: boolean;
  location?: string;
  attendees?: string[];
  description?: string;
  type: 'event' | 'task';
}

interface UpcomingEventsProps {
  events?: UpcomingEvent[];
  onEventClick?: (event: UpcomingEvent) => void;
}

type TimeFilter = 'today' | 'tomorrow' | 'thisWeek' | 'nextWeek';

const UpcomingEvents: React.FC<UpcomingEventsProps> = ({ 
  events = [],
  onEventClick 
}) => {
  const [activeFilter, setActiveFilter] = useState<TimeFilter>('today');
  const [isCollapsed, setIsCollapsed] = useState(false);

  // 过滤事件
  const filteredEvents = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + (7 - today.getDay()));

    return events.filter(event => {
      const eventDate = new Date(event.startTime);
      
      switch (activeFilter) {
        case 'today':
          return eventDate >= today && eventDate < tomorrow;
        case 'tomorrow':
          const dayAfterTomorrow = new Date(tomorrow);
          dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
          return eventDate >= tomorrow && eventDate < dayAfterTomorrow;
        case 'thisWeek':
          return eventDate >= today && eventDate < endOfWeek;
        case 'nextWeek':
          const endOfNextWeek = new Date(endOfWeek);
          endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);
          return eventDate >= endOfWeek && eventDate < endOfNextWeek;
        default:
          return true;
      }
    }).sort((a, b) => a.startTime.getTime() - b.startTime.getTime());
  }, [events, activeFilter]);

  // 格式化时间
  const formatTime = (date: Date, isAllDay: boolean) => {
    if (isAllDay) return '全天';
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };

  // 计算时间差
  const getTimeUntil = (startTime: Date) => {
    const now = new Date();
    const diff = startTime.getTime() - now.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours < 0) return '已开始';
    if (hours === 0) return `还有${minutes}分钟`;
    if (hours < 24) return `还有${hours}小时`;
    
    const days = Math.floor(hours / 24);
    return `${days}天后`;
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    return `${date.getMonth() + 1}-${String(date.getDate()).padStart(2, '0')}（${weekdays[date.getDay()]}）`;
  };

  if (isCollapsed) {
    return (
      <div className="upcoming-events collapsed">
        <div className="upcoming-header">
          <h3 className="upcoming-title">即将到来</h3>
          <button 
            className="upcoming-toggle-btn"
            onClick={() => setIsCollapsed(false)}
            aria-label="展开"
          >
            <HideIcon />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="upcoming-events">
      {/* 时间过滤器 */}
      <div className="upcoming-filters">
        <button
          className={`filter-btn ${activeFilter === 'today' ? 'active' : ''}`}
          onClick={() => setActiveFilter('today')}
        >
          今天
        </button>
        <button
          className={`filter-btn ${activeFilter === 'tomorrow' ? 'active' : ''}`}
          onClick={() => setActiveFilter('tomorrow')}
        >
          明天
        </button>
        <button
          className={`filter-btn ${activeFilter === 'thisWeek' ? 'active' : ''}`}
          onClick={() => setActiveFilter('thisWeek')}
        >
          本周
        </button>
        <button
          className={`filter-btn ${activeFilter === 'nextWeek' ? 'active' : ''}`}
          onClick={() => setActiveFilter('nextWeek')}
        >
          下周
        </button>
      </div>

      {/* 事件列表 */}
      <div className="upcoming-list">
        {filteredEvents.length === 0 ? (
          <div className="upcoming-empty">
            <p>暂无{activeFilter === 'today' ? '今天' : activeFilter === 'tomorrow' ? '明天' : activeFilter === 'thisWeek' ? '本周' : '下周'}的事件</p>
          </div>
        ) : (
          filteredEvents.map((event) => (
            <div 
              key={event.id}
              className="upcoming-event-card"
              onClick={() => onEventClick?.(event)}
            >
              {/* 左侧彩色竖线 */}
              <div className="event-left-border" style={{ backgroundColor: event.tag?.color || '#ef4444' }} />
              
              {/* 事件内容 */}
              <div className="event-content">
                {/* 第一行：标题 + 时间 */}
                <div className="event-row-1">
                  <div className="event-title-wrapper">
                    {event.type === 'task' ? (
                      <TaskGrayIcon className="title-icon" />
                    ) : (
                      <Clock className="title-icon" size={16} />
                    )}
                    <h4 className="event-title">{event.title}</h4>
                  </div>
                  <div className="event-time-wrapper">
                    <Clock className="time-icon" size={14} />
                    <span className="event-time">
                      {formatTime(event.startTime, event.isAllDay)}
                      {event.type === 'event' ? '开始' : '截止'}
                    </span>
                  </div>
                </div>

                {/* 第二行：标签 + 倒计时 */}
                <div className="event-row-2">
                  {event.tag && (
                    <div className="event-tag">
                      #{event.emoji || ''}{event.tag.name}
                    </div>
                  )}
                  {event.startTime > new Date() && (
                    <div className="event-countdown">
                      {getTimeUntil(event.startTime)}
                    </div>
                  )}
                </div>

                {/* 第三行：参与者 */}
                {event.attendees && event.attendees.length > 0 && (
                  <div className="event-row-meta">
                    <Users className="meta-icon" size={14} />
                    <span className="meta-text">{event.attendees.join('; ')}</span>
                  </div>
                )}

                {/* 第四行：地点 */}
                {event.location && (
                  <div className="event-row-meta">
                    <MapPin className="meta-icon" size={14} />
                    <span className="meta-text">{event.location}</span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default UpcomingEvents;
