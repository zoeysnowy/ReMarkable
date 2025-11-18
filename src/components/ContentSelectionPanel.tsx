import React, { useState } from 'react';
import './ContentSelectionPanel.css';

// 导入本地 SVG 图标
import SearchIconSvg from '../assets/icons/Search.svg';
import HideIconSvg from '../assets/icons/hide.svg';
import UnhideIconSvg from '../assets/icons/unhide.svg';
import DownIconSvg from '../assets/icons/down.svg';
import PiechartIconSvg from '../assets/icons/piechart.svg';

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

interface ContentSelectionPanelProps {
  onFilterChange?: (filter: 'tags' | 'tasks' | 'favorites' | 'new') => void;
  onSearchChange?: (query: string) => void;
  onDateSelect?: (date: Date) => void;
}

const ContentSelectionPanel: React.FC<ContentSelectionPanelProps> = ({
  onFilterChange,
  onSearchChange,
  onDateSelect,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'tags' | 'tasks' | 'favorites' | 'new'>('tags');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date(2025, 9, 1)); // October 2025
  const [isCalendarVisible, setIsCalendarVisible] = useState(true);

  // Sample task tree data - matching Figma design
  const [taskTree, setTaskTree] = useState<TaskNode[]>([
    {
      id: '1',
      title: '#🔮Remarkable开发',
      tag: 'Remarkable开发',
      color: '#a855f7',
      isExpanded: true,
      stats: { completed: 3, total: 7, hours: 12 },
      children: [
        {
          id: '1-1',
          title: '#🔮PRD文档',
          tag: 'PRD文档',
          color: '#3b82f6',
          stats: { completed: 3, total: 7, hours: 6 },
        },
        {
          id: '1-2',
          title: '#🔮码代码',
          tag: '码代码',
          color: '#10b981',
          stats: { completed: 3, total: 7, hours: 3 },
        },
      ],
    },
    {
      id: '2',
      title: '#🔮Remarkable开发',
      tag: 'Remarkable开发',
      color: '#a855f7',
      isExpanded: true,
      stats: { completed: 3, total: 7, hours: 12 },
      children: [
        {
          id: '2-1',
          title: '#🔮PRD文档',
          tag: 'PRD文档',
          color: '#3b82f6',
          stats: { completed: 3, total: 7, hours: 6 },
        },
        {
          id: '2-2',
          title: '#🔮码代码',
          tag: '码代码',
          color: '#10b981',
          stats: { completed: 3, total: 7, hours: 3 },
        },
      ],
    },
    {
      id: '3',
      title: '#🔮Remarkable开发',
      tag: 'Remarkable开发',
      color: '#a855f7',
      isExpanded: false,
      isHidden: true,
      stats: { completed: 3, total: 7, hours: 12 },
    },
  ]);

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
    setSelectedDate(date);
    onDateSelect?.(date);
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
        <div className="calendar-days">
          {weeks.map((week, weekIndex) => (
            <div key={weekIndex} className="calendar-week">
              {week.map((day, dayIndex) => (
                <div
                  key={dayIndex}
                  className={`calendar-day ${
                    day === null ? 'calendar-day-empty' : ''
                  } ${
                    day &&
                    selectedDate.getDate() === day &&
                    selectedDate.getMonth() === month &&
                    selectedDate.getFullYear() === year
                      ? 'calendar-day-selected'
                      : ''
                  }`}
                  onClick={() => day && handleDateSelect(new Date(year, month, day))}
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
              <button className="task-visibility-btn task-visibility-btn-visible">
                <HideSmallIcon className="task-icon task-icon-hidden" />
              </button>
            ) : (
              <button className="task-visibility-btn task-visibility-btn-hidden">
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
    const updateNode = (nodes: TaskNode[]): TaskNode[] => {
      return nodes.map(node => {
        if (node.id === nodeId) {
          return { ...node, isExpanded: !node.isExpanded };
        }
        if (node.children) {
          return { ...node, children: updateNode(node.children) };
        }
        return node;
      });
    };
    setTaskTree(updateNode(taskTree));
  };

  return (
    <div className="content-selection-panel">
      {/* Section Header - 完全匹配计划清单结构 */}
      <div className="section-header">
        <div className="title-indicator" />
        <h3>内容选取</h3>
        <button className="panel-toggle-btn" onClick={toggleCalendar}>
          <HideIcon />
        </button>
        <button className="panel-show-all-btn">显示全部</button>
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
        {taskTree.map((node) => renderTaskNode(node))}
      </div>
    </div>
  );
};

export default ContentSelectionPanel;
