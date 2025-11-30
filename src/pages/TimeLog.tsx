import React, { useState, useMemo, useEffect } from 'react';
import ContentSelectionPanel from '../components/ContentSelectionPanel';
import { EventService } from '../services/EventService';
import { TagService } from '../services/TagService';
import type { Event } from '../types';
import './TimeLog.css';

// 导入图标
import ExportIconSvg from '../assets/icons/export.svg';
import LinkIconSvg from '../assets/icons/link_gray.svg';
import MoreIconSvg from '../assets/icons/more.svg';

const TimeLog: React.FC = () => {
  const [dateRange, setDateRange] = useState<{ start: Date; end: Date } | null>(null);
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'tags' | 'tasks' | 'favorites' | 'new'>('tags');
  const [tagServiceVersion, setTagServiceVersion] = useState(0);

  // 订阅标签服务变化（与 PlanManager 一致）
  useEffect(() => {
    const listener = () => {
      console.log('📌 [TimeLog] Tags updated, incrementing version');
      setTagServiceVersion(v => v + 1);
    };

    TagService.addListener(listener);
    
    // 初始加载时检查一次
    const tags = TagService.getFlatTags();
    if (tags.length > 0) {
      console.log('📌 [TimeLog] Initial tags loaded:', tags.length);
    }
    
    return () => TagService.removeListener(listener);
  }, []);

  // 获取所有标签（与 PlanManager 一致）
  const allTags = useMemo(() => {
    const tags = TagService.getFlatTags();
    console.log('📌 [TimeLog] Loaded tags:', tags.length);
    return tags;
  }, [tagServiceVersion]);

  // 获取当前显示的日期（单日或范围）
  const displayDate = useMemo(() => {
    if (!dateRange) {
      const today = new Date();
      return {
        date: today,
        isRange: false,
        text: formatDateDisplay(today)
      };
    }
    
    const isSameDay = 
      dateRange.start.getFullYear() === dateRange.end.getFullYear() &&
      dateRange.start.getMonth() === dateRange.end.getMonth() &&
      dateRange.start.getDate() === dateRange.end.getDate();
    
    return {
      date: dateRange.start,
      isRange: !isSameDay,
      text: isSameDay 
        ? formatDateDisplay(dateRange.start)
        : `${formatDateDisplay(dateRange.start)} - ${formatDateDisplay(dateRange.end)}`
    };
  }, [dateRange]);

  // 格式化日期显示
  function formatDateDisplay(date: Date): string {
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekday = weekdays[date.getDay()];
    return `${month}月${day}日 | ${weekday}`;
  }

  // 获取事件列表（根据日期范围筛选）
  const events = useMemo(() => {
    // TODO: 临时硬编码示例数据，用于展示 Figma 设计
    const mockEvents = [
      {
        id: 'mock-1',
        title: '完成 ReMarkable 日志页面 UI 设计',
        emoji: '🎨',
        startTime: '2025-12-01T09:00:00',
        endTime: '2025-12-01T11:30:00',
        tags: ['ReMarkable开发', '工作'],
        description: '根据 Figma 设计稿实现时光日志页面，包括时间轴、事件卡片、标签系统等核心功能。需要注意紫蓝渐变色的应用和交互细节。',
        source: 'Outlook Calendar',
        createdAt: Date.now() - 3600000,
        dueDate: '2025-12-02T18:00:00'
      },
      {
        id: 'mock-2',
        title: '团队周会 - Sprint Review',
        emoji: '👥',
        startTime: '2025-12-01T14:00:00',
        endTime: '2025-12-01T15:00:00',
        tags: ['工作', '会议'],
        description: '回顾本周的开发进度，展示新完成的功能模块，讨论下周的工作安排。',
        source: 'Google Calendar',
        createdAt: Date.now() - 7200000
      },
      {
        id: 'mock-3',
        title: '阅读《设计心理学》',
        emoji: '📚',
        startTime: '2025-12-01T19:30:00',
        endTime: '2025-12-01T20:30:00',
        tags: ['个人', '学习'],
        description: '继续阅读第3章关于用户心智模型的内容，思考如何应用到产品设计中。',
        createdAt: Date.now() - 14400000
      }
    ];
    
    return mockEvents;
    
    // 原有逻辑（暂时注释）
    // const allEvents = EventService.getAllEvents();
    // if (!dateRange) {
    //   const today = new Date();
    //   today.setHours(0, 0, 0, 0);
    //   const tomorrow = new Date(today);
    //   tomorrow.setDate(tomorrow.getDate() + 1);
    //   return allEvents.filter(event => {
    //     const eventDate = event.startTime ? new Date(event.startTime) : new Date(event.createdAt || Date.now());
    //     return eventDate >= today && eventDate < tomorrow;
    //   });
    // }
    // const start = new Date(dateRange.start);
    // start.setHours(0, 0, 0, 0);
    // const end = new Date(dateRange.end);
    // end.setHours(23, 59, 59, 999);
    // return allEvents.filter(event => {
    //   const eventDate = event.startTime ? new Date(event.startTime) : new Date(event.createdAt || Date.now());
    //   return eventDate >= start && eventDate <= end;
    // });
  }, [dateRange]);

  // 处理日期范围变化
  const handleDateRangeChange = (start: Date | null, end: Date | null) => {
    if (start && end) {
      setDateRange({ start, end });
    } else {
      setDateRange(null);
    }
  };

  // 处理标签可见性变化
  const handleTagVisibilityChange = (tagId: string, visible: boolean) => {
    setHiddenTags(prev => {
      const next = new Set(prev);
      if (visible) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // 处理导出
  const handleExport = () => {
    console.log('导出时光日志');
    // TODO: 实现导出功能
  };

  // 处理复制链接
  const handleCopyLink = () => {
    console.log('复制链接');
    // TODO: 实现复制链接功能
  };

  // 处理更多选项
  const handleMore = () => {
    console.log('更多选项');
    // TODO: 实现更多选项功能
  };

  return (
    <div className="timelog-page">
      {/* 左侧内容选取区 - 完全复用 ContentSelectionPanel */}
      <ContentSelectionPanel
        dateRange={dateRange}
        tags={allTags}
        hiddenTags={hiddenTags}
        onFilterChange={setActiveFilter}
        onSearchChange={setSearchQuery}
        onDateRangeChange={handleDateRangeChange}
        onTagVisibilityChange={handleTagVisibilityChange}
      />

      {/* 中间时光日志区 - 整个内容在一个白色背景卡片里 */}
      <div className="timelog-main-card">
          {/* 时光日志标题区 */}
          <div className="timelog-header-section">
            <div className="timelog-header-border">
              <div className="timelog-gradient-bar"></div>
              <h1 className="timelog-title">时光日志</h1>
            </div>
          </div>

          {/* 日期显示 */}
          <div className="timelog-date-display">
            <p className="timelog-date-text">{displayDate.text}</p>
          </div>

          {/* Event 列表 */}
          <div className="timelog-events-list">
          {events.length === 0 ? (
            <div className="timelog-empty">
              <p>暂无事件记录</p>
            </div>
          ) : (
            events.map(event => (
              <div key={event.id} className="event-item">
                {/* 时间轴线条 */}
                <div className="event-timeline-line"></div>

                {/* 左侧：时间信息 */}
                <div className="event-left">
                  <div className="event-time-icons">
                    <span>📅</span>
                    <span>⏰</span>
                  </div>
                  <div className="event-time-text">
                    {event.startTime && event.endTime ? (
                      `${formatTime(event.startTime)} — ${formatTime(event.endTime)}`
                    ) : event.startTime ? (
                      formatTime(event.startTime)
                    ) : (
                      '未设置时间'
                    )}
                  </div>
                  {event.startTime && event.endTime && (
                    <div className="event-time-arrow">
                      <span className="event-duration-badge">
                        {formatDuration(event.startTime, event.endTime)}
                      </span>
                    </div>
                  )}
                </div>

                {/* 中间：事件主要内容 */}
                <div className="event-center">
                  <div className="event-main-row">
                    {event.emoji && <span className="event-emoji">{event.emoji}</span>}
                    <h3 className="event-title-new">
                      {typeof event.title === 'string' ? event.title : '无标题'}
                    </h3>
                  </div>

                  {event.tags && event.tags.length > 0 && (
                    <div className="event-tags-new">
                      {event.tags.map((tagId, index) => (
                        <span key={index} className="event-tag tag-blue">
                          #{tagId}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="event-meta-row">
                    <span className="task-icon">📋</span>
                    <span className="task-meta">
                      创建于 {formatRelativeTime(event.createdAt)}
                      {event.dueDate && ` • 距ddl还有 ${formatDueDateRemaining(event.dueDate)}`}
                    </span>
                  </div>

                  {event.source && (
                    <div className="event-source-row">
                      <span>来自</span>
                      <span className="source-name">{event.source}</span>
                      <span className={`source-status ${event.source ? 'active' : ''}`}></span>
                      <span className="source-sync">同步中</span>
                    </div>
                  )}
                </div>

                {/* 右侧：描述和操作 */}
                <div className="event-right">
                  {event.description && (
                    <div className="event-description">
                      <p>{event.description}</p>
                    </div>
                  )}
                  <div className="event-actions">
                    <button className="event-action-btn btn-favorite" title="收藏">⭐</button>
                    <button className="event-action-btn btn-expand" title="展开">›</button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* 右侧按钮区 */}
      <div className="timelog-actions">
        <button 
          className="action-button" 
          onClick={handleExport}
          title="导出"
        >
          <img src={ExportIconSvg} alt="导出" />
        </button>

        <button 
          className="action-button" 
          onClick={handleCopyLink}
          title="复制链接"
        >
          <img src={LinkIconSvg} alt="链接" />
        </button>

        <button 
          className="action-button" 
          onClick={handleMore}
          title="更多选项"
        >
          <img src={MoreIconSvg} alt="更多" />
        </button>
      </div>
    </div>
  );
};

// 辅助函数：格式化时间
function formatTime(dateStr: string | Date): string {
  const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  return `${hours}:${minutes}`;
}

// 辅助函数：格式化时长
function formatDuration(startStr: string | Date, endStr: string | Date): string {
  const start = typeof startStr === 'string' ? new Date(startStr) : startStr;
  const end = typeof endStr === 'string' ? new Date(endStr) : endStr;
  const diff = end.getTime() - start.getTime();
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours > 0 && minutes > 0) {
    return `${hours}h${minutes}min`;
  } else if (hours > 0) {
    return `${hours}h`;
  } else {
    return `${minutes}min`;
  }
}

// 辅助函数：格式化相对时间
function formatRelativeTime(timestamp: number | string | undefined): string {
  if (!timestamp) return '未知';
  
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const now = Date.now();
  const diff = now - date.getTime();
  
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  
  if (minutes < 1) return '刚刚';
  if (minutes < 60) return `${minutes}分钟前`;
  if (hours < 24) return `${hours}小时前`;
  if (days < 7) return `${days}天前`;
  
  return date.toLocaleDateString('zh-CN');
}

// 辅助函数：格式化截止日期剩余时间
function formatDueDateRemaining(dueDate: string | Date): string {
  const date = typeof dueDate === 'string' ? new Date(dueDate) : dueDate;
  const now = Date.now();
  const diff = date.getTime() - now;
  
  if (diff < 0) return '已过期';
  
  const hours = Math.floor(diff / 3600000);
  const minutes = Math.floor((diff % 3600000) / 60000);
  
  if (hours < 24) {
    return `${hours}小时${minutes}分钟`;
  }
  
  const days = Math.floor(diff / 86400000);
  return `${days}天`;
}

// 辅助函数：格式化完整日期时间
function formatDateTime(timestamp: number | string): string {
  const date = typeof timestamp === 'string' ? new Date(timestamp) : new Date(timestamp);
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  const hours = date.getHours().toString().padStart(2, '0');
  const minutes = date.getMinutes().toString().padStart(2, '0');
  const seconds = date.getSeconds().toString().padStart(2, '0');
  
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}

export default TimeLog;
