import React, { useState, useMemo } from 'react';
import './ContentSelectionPanel.css';

// 导入本地 SVG 图标
import SearchIconSvg from '../assets/icons/Search.svg';
import HideIconSvg from '../assets/icons/hide.svg';
import UnhideIconSvg from '../assets/icons/unhide.svg';
import DownIconSvg from '../assets/icons/down.svg';
import PiechartIconSvg from '../assets/icons/piechart.svg';
import NoticeIconSvg from '../assets/icons/Notice.svg';

// 图标组件
const SearchIcon = ({ className }: { className?: string }) => <img src={SearchIconSvg} alt="" className={className} style={{ width: '23px', height: '23px', opacity: 0.6 }} />;
const HideIcon = ({ className }: { className?: string }) => <img src={HideIconSvg} alt="" className={className} style={{ width: '20px', height: '20px', opacity: 0.6 }} />;
const UnhideIcon = ({ className }: { className?: string }) => <img src={UnhideIconSvg} alt="" className={className} style={{ width: '20px', height: '20px', opacity: 0.6 }} />;
const DownIcon = ({ isExpanded }: { isExpanded?: boolean }) => (
  <img 
    src={DownIconSvg} 
    alt="" 
    style={{ 
      width: '12px', 
      height: '12px',
      transition: 'transform 0.2s',
      transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)'
    }} 
  />
);
const UnhideSmallIcon = ({ className }: { className?: string }) => <img src={UnhideIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const HideSmallIcon = ({ className }: { className?: string }) => <img src={HideIconSvg} alt="" className={className} style={{ width: '16px', height: '16px' }} />;
const PiechartIcon = ({ color, className }: { color?: string; className?: string }) => (
  <img src={PiechartIconSvg} alt="" className={className} style={{ width: '14px', height: '14px' }} />
);
const NoticeIcon = ({ className }: { className?: string }) => <img src={NoticeIconSvg} alt="" className={className} style={{ width: '20px', height: '20px' }} />;

interface TaskNode {
  id: string;
  title: string;
  tag: string;
  color: string;
  children?: TaskNode[];
  stats?: {
    completed: number;
    total: number;
    hours: number;
  };
  isExpanded?: boolean;
  isHidden?: boolean;
  isFavorite?: boolean;
}

interface EventSnapshot {
  created: number;
  updated: number;
  completed: number;
  deleted: number;
  details: any[];
}

interface Tag {
  id: string;
  name: string;
  color?: string;
  emoji?: string;
}

interface ContentSelectionPanelProps {
  dateRange?: { start: Date; end: Date } | null;
  snapshot?: EventSnapshot;
  tags?: Tag[];
  hiddenTags?: Set<string>;
  onFilterChange?: (filter: 'tags' | 'tasks' | 'favorites' | 'new') => void;
  onSearchChange?: (query: string) => void;
  onDateSelect?: (date: Date) => void;
  onDateRangeChange?: (start: Date | null, end: Date | null) => void;
  onTagVisibilityChange?: (tagId: string, visible: boolean) => void;
}

const ContentSelectionPanel: React.FC<ContentSelectionPanelProps> = ({
  dateRange,
  snapshot,
  tags = [],
  hiddenTags = new Set(),
  onFilterChange,
  onSearchChange,
  onDateSelect,
  onDateRangeChange,
  onTagVisibilityChange,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'tags' | 'tasks' | 'favorites' | 'new'>('tags');
  const [selectedDate, setSelectedDate] = useState(dateRange?.start || new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 10, 1)); // November 2025
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);
  
  // 日期范围选择状态
  const [rangeStart, setRangeStart] = useState<Date | null>(dateRange?.start || null);
  const [rangeEnd, setRangeEnd] = useState<Date | null>(dateRange?.end || null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [hoverDate, setHoverDate] = useState<Date | null>(null);

  // 基于真实标签数据构建任务树
  const taskTree = useMemo(() => {
    return tags.map(tag => {
      const isHidden = hiddenTags.has(tag.id);
      return {
        id: tag.id,
        title: `${tag.emoji || '#'}${tag.name}`,
        tag: tag.name,
        color: tag.color || '#6b7280',
        isExpanded: !isHidden,
        isHidden,
        stats: {
          completed: snapshot?.details?.filter((log: any) => 
            log.operation === 'update' && 
            log.changes?.some((change: any) => 
              change.field === 'isCompleted' && 
              change.after === true
            ) &&
            log.after?.tags?.includes(tag.id)
          ).length || 0,
          total: snapshot?.details?.filter((log: any) => 
            (log.operation === 'create' || log.operation === 'update') &&
            (log.after?.tags?.includes(tag.id) || log.before?.tags?.includes(tag.id))
          ).length || 0,
          hours: 0 // TODO: 从时间记录计算
        }
      } as TaskNode;
    });
  }, [tags, hiddenTags, snapshot]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    onSearchChange?.(query);
  };

  const handleFilterChange = (filter: 'tags' | 'tasks' | 'favorites' | 'new') => {
    setActiveFilter(filter);
    onFilterChange?.(filter);
  };

  const handleDateSelect = (date: Date) => {
    if (!isSelecting || !rangeStart) {
      // 开始选择范围
      setRangeStart(date);
      setRangeEnd(null);
      setIsSelecting(true);
      setSelectedDate(date);
    } else {
      // 完成范围选择
      const start = rangeStart < date ? rangeStart : date;
      const end = rangeStart < date ? date : rangeStart;
      setRangeStart(start);
      setRangeEnd(end);
      setIsSelecting(false);
      setHoverDate(null);
      
      // 通知父组件日期范围改变
      onDateRangeChange?.(start, end);
    }
  };
  
  const handleDateHover = (date: Date) => {
    if (isSelecting && rangeStart) {
      setHoverDate(date);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const toggleCalendar = () => {
    setIsCalendarVisible(!isCalendarVisible);
  };

  const renderCalendar = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDayOfWeek = firstDay.getDay();
    const daysInMonth = lastDay.getDate();
    
    // 今日日期判断
    const today = new Date();
    const isToday = (date: Date) => {
      return date.getFullYear() === today.getFullYear() &&
             date.getMonth() === today.getMonth() &&
             date.getDate() === today.getDate();
    };

    const weeks: (number | null)[][] = [];
    let week: (number | null)[] = new Array(startingDayOfWeek).fill(null);

    for (let day = 1; day <= daysInMonth; day++) {
      week.push(day);
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
    }

    if (week.length > 0) {
      while (week.length < 7) {
        week.push(null);
      }
      weeks.push(week);
    }

    return (
      <div className="calendar-container">
        <div className="calendar-header">
          <button className="calendar-nav-btn" onClick={handlePrevMonth}>
            ‹
          </button>
          <div className="calendar-title">
            {year}年 {month + 1}月
          </div>
          <button className="calendar-nav-btn" onClick={handleNextMonth}>
            ›
          </button>
        </div>
        <div className="calendar-weekdays">
          {['日', '一', '二', '三', '四', '五', '六'].map((day) => (
            <div key={day} className="calendar-weekday">
              {day}
            </div>
          ))}
        </div>
        
        {isSelecting && (
          <div className="selection-hint">
            点击结束日期完成范围选择
          </div>
        )}
        
        <div className="calendar-days">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`calendar-day ${
                    day === null ? 'calendar-day-empty' : ''
                  } ${
                    day && isToday(new Date(year, month, day))
                      ? 'calendar-day-today'
                      : ''
                  } ${
                    day && isDateInRange(new Date(year, month, day))
                      ? 'calendar-day-in-range'
                      : ''
                  } ${
                    day && isDateRangeEnd(new Date(year, month, day))
                      ? 'calendar-day-range-end'
                      : ''
                  } ${
                    day && isDateRangeStart(new Date(year, month, day))
                      ? 'calendar-day-range-start'
                      : ''
                  }`}
                  onClick={() => day && handleDateSelect(new Date(year, month, day))}
                  onMouseEnter={() => day && handleDateHover(new Date(year, month, day))}
                >
                  {day}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTaskNode = (node: TaskNode, depth: number = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const baseIndent = -8; // 向左偏移，因为hide/unhide按钮平时不显示
    const indent = baseIndent + (depth * 16); // 每级增加16px缩进
    
    return (
      <div key={node.id} className={`task-node task-node-depth-${depth}`}>
        <div className="task-node-row" style={{ marginLeft: `${indent}px` }}>
          {/* 可见性图标 */}
          <div className="task-visibility-container">
            {node.isHidden ? (
              <button 
                className="task-visibility-btn task-visibility-btn-visible"
                onClick={() => onTagVisibilityChange?.(node.id, true)}
                title="显示此标签的事件"
              >
                <HideSmallIcon className="task-icon task-icon-hidden" />
              </button>
            ) : (
              <button 
                className="task-visibility-btn task-visibility-btn-hidden"
                onClick={() => onTagVisibilityChange?.(node.id, false)}
                title="隐藏此标签的事件"
              >
                <UnhideSmallIcon className="task-icon task-icon-visible" />
              </button>
            )}
          </div>
          
          {/* 展开/收缩按钮 */}
          {hasChildren && (
            <button 
              className="task-expand-btn"
              onClick={() => toggleTaskNode(node.id)}
            >
              <DownIcon isExpanded={node.isExpanded} />
            </button>
          )}
          
          {/* 收藏图标 */}
          {node.isFavorite && (
            <span className="task-icon task-icon-favorite">⭐</span>
          )}
          
          {/* 任务标题 */}
          <div className="task-title" style={{ color: node.color }}>
            {node.title}
          </div>
          
          {/* 统计信息 */}
          {node.stats && (
            <div className="task-stats">
              <div className="task-stats-top">
                <div className="task-stats-left">
                  <PiechartIcon className="task-pie-chart" color={node.color} />
                  <span className="task-progress-text">
                    {node.stats.completed}/{node.stats.total}
                  </span>
                </div>
                <span className="task-hours">{node.stats.hours}h</span>
              </div>
              <div className="task-time-bar">
                <div
                  className="task-time-fill"
                  style={{
                    width: `${(node.stats.completed / node.stats.total) * 100}%`,
                    background: node.color === '#8b5cf6' 
                      ? 'linear-gradient(to right, #a855f7, #9333ea)'
                      : node.color === '#3b82f6'
                      ? 'linear-gradient(to right, #3b82f6, #2563eb)'
                      : node.color === '#10b981'
                      ? 'linear-gradient(to right, #10b981, #059669)'
                      : node.color,
                  }}
                />
              </div>
            </div>
          )}
        </div>
        
        {/* 子任务 */}
        {node.isExpanded && hasChildren && (
          <div className="task-children">
            {node.children?.map((child) => renderTaskNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const toggleTaskNode = (nodeId: string) => {
    // TODO: 实现标签展开/收起状态管理
    console.log('Toggle task node:', nodeId);
  };
  
  // 日期范围判断辅助函数
  const isDateInRange = (date: Date): boolean => {
    if (!rangeStart) return false;
    
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    
    if (rangeEnd) {
      // 已完成选择，显示确定的范围
      const start = new Date(rangeStart);
      const end = new Date(rangeEnd);
      start.setHours(0, 0, 0, 0);
      end.setHours(0, 0, 0, 0);
      return compareDate >= start && compareDate <= end;
    } else if (isSelecting && hoverDate) {
      // 选择中，显示预览范围
      const start = rangeStart < hoverDate ? rangeStart : hoverDate;
      const end = rangeStart < hoverDate ? hoverDate : rangeStart;
      const startTime = new Date(start);
      const endTime = new Date(end);
      startTime.setHours(0, 0, 0, 0);
      endTime.setHours(0, 0, 0, 0);
      return compareDate >= startTime && compareDate <= endTime;
    } else {
      // 只选择了起始日期
      const start = new Date(rangeStart);
      start.setHours(0, 0, 0, 0);
      return compareDate.getTime() === start.getTime();
    }
  };
  
  const isDateRangeStart = (date: Date): boolean => {
    if (!rangeStart) return false;
    const start = new Date(rangeStart);
    start.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === start.getTime();
  };
  
  const isDateRangeEnd = (date: Date): boolean => {
    if (!rangeEnd) return false;
    const end = new Date(rangeEnd);
    end.setHours(0, 0, 0, 0);
    const compareDate = new Date(date);
    compareDate.setHours(0, 0, 0, 0);
    return compareDate.getTime() === end.getTime();
  };

  const handleExitSnapshot = () => {
    // 清除日期范围选择，回到普通模式
    setRangeStart(null);
    setRangeEnd(null);
    setIsSelecting(false);
    setHoverDate(null);
    // 通知父组件清除日期范围（回到当天此刻的计划清单，不显示 snapshot 竖线）
    onDateRangeChange?.(null, null);
  };

  // 判断是否在 snapshot 模式：有 dateRange 或者正在选择日期
  const isInSnapshotMode = dateRange !== null && dateRange !== undefined;

  return (
    <div className="content-selection-panel">
      {/* Section Header - 完全匹配计划清单结构 */}
      <div className="section-header">
        <div className="title-indicator" />
        <h3>内容选取</h3>
        <button className="panel-toggle-btn" onClick={toggleCalendar}>
          <HideIcon />
        </button>
        {isInSnapshotMode ? (
          <button className="panel-show-all-btn" onClick={handleExitSnapshot}>
            退出<br />Review模式
          </button>
        ) : (
          <div className="panel-notice-icon-wrapper" title="选择日期进入Review模式">
            <NoticeIcon className="panel-notice-icon" />
          </div>
        )}
        {false && (<button className="panel-show-all-btn" onClick={handleExitSnapshot}>
          {isInSnapshotMode ? (
            <>
              退出<br />Review模式
            </>
          ) : (
            <>
              选择日期<br />进入Review模式
            </>
          )}
        </button>)}
      </div>

      {/* Search Bar */}
      <div className="search-container">
        <div className="search-input-wrapper">
          <SearchIcon className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder='输入"上个月没完成的任务"试试'
            value={searchQuery}
            onChange={handleSearchChange}
          />
        </div>
      </div>

      {/* Calendar */}
      {isCalendarVisible && renderCalendar()}



      {/* Filter Buttons */}
      <div className="filter-buttons">
        <button
          className={`filter-btn ${activeFilter === 'tags' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('tags')}
        >
          标签
        </button>
        <button
          className={`filter-btn ${activeFilter === 'tasks' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('tasks')}
        >
          事项
        </button>
        <button
          className={`filter-btn ${activeFilter === 'favorites' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('favorites')}
        >
          收藏
        </button>
        <button
          className={`filter-btn ${activeFilter === 'new' ? 'filter-btn-active' : ''}`}
          onClick={() => handleFilterChange('new')}
        >
          New
        </button>
      </div>

      {/* Task Tree */}
      <div className="task-tree">
        {taskTree.map((node: TaskNode) => renderTaskNode(node))}
      </div>
    </div>
  );
};

export default ContentSelectionPanel;
