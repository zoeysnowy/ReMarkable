import React, { useState, useMemo, useEffect } from 'react';
import { Event } from '../types';
import { TagService } from '../services/TagService';
import './DailyStatsCard.css';

interface DailyStatsCardProps {
  events: Event[]; // 所有事件数据
  selectedDate?: Date; // 选中的日期，默认为今天
  onDateChange?: (date: Date) => void; // 日期变化回调
}

interface TagStats {
  id: string;
  name: string;
  emoji?: string;
  color: string;
  duration: number; // 毫秒
  percentage: number;
  level: number; // 层级深度
  children?: TagStats[];
}

export const DailyStatsCard: React.FC<DailyStatsCardProps> = ({
  events: propEvents, // 重命名以区分
  selectedDate = new Date(),
  onDateChange
}) => {
  const [currentDate, setCurrentDate] = useState<Date>(selectedDate);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [events, setEvents] = useState<Event[]>(propEvents); // 使用本地 state

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem('remarkable-events');
        if (saved) {
          const latestEvents = JSON.parse(saved);
          setEvents(latestEvents);
        }
      } catch (error) {
        console.error('❌ [DailyStats] Failed to load events:', error);
      }
      setRefreshKey(prev => prev + 1);
    };

    window.addEventListener('eventsUpdated', handleStorageChange);
    
    return () => {
      window.removeEventListener('eventsUpdated', handleStorageChange);
    };
  }, []);

  // 🔧 当 prop 变化时同步到本地 state
  useEffect(() => {
    setEvents(propEvents);
  }, [propEvents]);

  // 格式化日期为输入框格式 YYYY-MM-DD
  const formatDateForInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const tagStats = useMemo(() => {
    const targetDateStr = Date().toDateString();
    const dayEvents = events.filter(event => {
      const eventDate = new Date(event.startTime);
      return eventDate.toDateString() === targetDateStr;
    });

    const tagDurations = new Map<string, number>();
    let totalDuration = 0;
    let maxDuration = 0;
    const now = new Date();

    dayEvents.forEach(event => {
      const tags = event.tags || (event.tagId ? [event.tagId] : []);
      
      tags.forEach(tagId => {
        const start = new Date(event.startTime).getTime();
        const end = new Date(event.endTime).getTime();
        const nowTime = now.getTime();
        
        const effectiveEnd = Math.min(end, nowTime);
        
        let duration = 0;
        if (effectiveEnd > start) {
          duration = effectiveEnd - start;
        }

        if (duration > 0) {
          tagDurations.set(tagId, (tagDurations.get(tagId) || 0) + duration);
          totalDuration += duration;
        }
      });
    });

    const flatTags = TagService.getFlatTags();

    // 构建层级统计树（从扁平结构）
    const buildTagStatsFromFlat = (): TagStats[] => {
      // 首先为所有有数据的标签创建统计对象
      const statsMap = new Map<string, TagStats>();
      
      // 初始化所有标签
      flatTags.forEach(tag => {
        const directDuration = tagDurations.get(tag.id) || 0;
        statsMap.set(tag.id, {
          id: tag.id,
          name: tag.name,
          emoji: tag.emoji,
          color: tag.color || '#999',
          duration: directDuration,
          percentage: 0, // 稍后计算
          level: 0, // 稍后计算
          children: []
        });
      });

      flatTags.forEach(tag => {
        const childStat = statsMap.get(tag.id);
        if (!childStat || childStat.duration === 0) return;
        
        let currentParentId = tag.parentId;
        while (currentParentId) {
          const parentStat = statsMap.get(currentParentId);
          if (parentStat) {
            parentStat.duration += childStat.duration;
            
            const parentTag = flatTags.find(t => t.id === currentParentId);
            currentParentId = parentTag?.parentId;
          } else {
            break;
          }
        }
      });

      statsMap.forEach(stat => {
        stat.percentage = totalDuration > 0 ? (stat.duration / totalDuration) * 100 : 0;
      });

      const rootStats: TagStats[] = [];
      const childrenMap = new Map<string, TagStats[]>();

      // 计算每个标签的层级深度
      const getTagLevel = (tagId: string): number => {
        const tag = flatTags.find(t => t.id === tagId);
        if (!tag || !tag.parentId) return 0;
        return 1 + getTagLevel(tag.parentId);
      };

      flatTags.forEach(tag => {
        const stat = statsMap.get(tag.id);
        
        if (!stat || stat.duration === 0) return;

        stat.level = getTagLevel(tag.id);

        if (tag.parentId) {
          if (!childrenMap.has(tag.parentId)) {
            childrenMap.set(tag.parentId, []);
          }
          childrenMap.get(tag.parentId)!.push(stat);
        } else {
          rootStats.push(stat);
        }
      });

      // 将children递归关联到父标签（支持多层级）
      const attachChildren = (stat: TagStats) => {
        if (childrenMap.has(stat.id)) {
          stat.children = childrenMap.get(stat.id)!.sort((a, b) => b.duration - a.duration);
          // 递归处理子标签的children
          stat.children.forEach(child => attachChildren(child));
        }
      };

      rootStats.forEach(stat => attachChildren(stat));

      console.log('📊 [DailyStats] Built stats from flat structure:', {
        rootCount: rootStats.length,
        roots: rootStats.map(s => ({
          name: s.name,
          duration: s.duration,
          level: s.level,
          childrenCount: s.children?.length || 0,
          children: s.children?.map(c => ({
            name: c.name,
            duration: c.duration,
            level: c.level,
            childrenCount: c.children?.length || 0
          }))
        }))
      });

      return rootStats.sort((a, b) => b.duration - a.duration);
    };

    const stats = buildTagStatsFromFlat();

    // 计算所有标签的最大时长（包括子标签）
    const findMaxDuration = (tagStats: TagStats[]): number => {
      let max = 0;
      tagStats.forEach(stat => {
        max = Math.max(max, stat.duration);
        if (stat.children && stat.children.length > 0) {
          max = Math.max(max, findMaxDuration(stat.children));
        }
      });
      return max;
    };

    const maxTagDuration = findMaxDuration(stats);

    // 动态计算进度条基准
    // 初始4小时，如果最大时长>4小时，每超出1小时增加1小时，最多12小时
    const FOUR_HOURS = 4 * 3600000;
    const TWELVE_HOURS = 12 * 3600000;
    const ONE_HOUR = 3600000;

    let barBaseline = FOUR_HOURS;
    if (maxTagDuration > FOUR_HOURS) {
      const hoursOver = Math.ceil((maxTagDuration - FOUR_HOURS) / ONE_HOUR);
      barBaseline = Math.min(FOUR_HOURS + (hoursOver * ONE_HOUR), TWELVE_HOURS);
    }

    console.log('📊 [DailyStats] Progress bar baseline:', {
      maxTagDuration,
      maxTagHours: maxTagDuration / 3600000,
      barBaseline,
      barBaselineHours: barBaseline / 3600000
    });

    return {
      stats,
      totalDuration,
      barBaseline // 返回动态基准线
    };
  }, [events, currentDate, refreshKey]); // 🔧 添加 refreshKey 依赖

  // 调试日志
  useEffect(() => {
    if (tagStats.stats.length > 0) {
      console.log('📊 [DailyStats] Tag stats structure:', {
        totalStats: tagStats.stats.length,
        stats: tagStats.stats.map(s => ({
          name: s.name,
          level: s.level,
          duration: s.duration,
          hasChildren: !!s.children?.length,
          childrenCount: s.children?.length || 0
        }))
      });
    }
  }, [tagStats]);

  // 格式化时长
  const formatDuration = (ms: number): string => {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}小时 ${minutes}分钟`;
    }
    return `${minutes}分钟`;
  };

  // 计算进度条的填充百分比（基于动态基准线）
  const calculateBarPercentage = (ms: number): number => {
    const baseline = tagStats.barBaseline || (4 * 3600000); // 默认4小时
    const percentage = (ms / baseline) * 100;
    return Math.min(percentage, 100); // 最大100%
  };

  // 递归渲染标签统计
  const renderTagStat = (stat: TagStats) => {
    const indentPx = stat.level * 24; // 每层级缩进24px
    const isChild = stat.level > 0;
    const barPercentage = calculateBarPercentage(stat.duration);
    
    return (
      <div key={stat.id} className="tag-stat-item">
        <div 
          className={`tag-stat-row ${isChild ? 'tag-stat-row-child' : ''}`}
        >
          <div className="tag-stat-label" style={{ paddingLeft: `${indentPx}px` }}>
            <span className="tag-stat-name" style={{ color: stat.color }}>
              #{stat.emoji}{stat.name}
            </span>
          </div>
          <div className="tag-stat-time">
            <span className="tag-stat-duration">{formatDuration(stat.duration)}</span>
            <div className="tag-stat-bar-wrapper">
              <div className="tag-stat-bar-background">
                <div 
                  className="tag-stat-bar-fill" 
                  style={{ 
                    width: `${barPercentage}%`,
                    backgroundColor: stat.color,
                    opacity: isChild ? 0.8 : 1
                  }}
                />
              </div>
            </div>
            <span className="tag-stat-percentage">{stat.percentage.toFixed(1)}%</span>
          </div>
        </div>
        {stat.children && stat.children.length > 0 && stat.children.map(child => renderTagStat(child))}
      </div>
    );
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = new Date(e.target.value);
    if (!isNaN(newDate.getTime())) {
      setCurrentDate(newDate);
      onDateChange?.(newDate);
    }
  };

  return (
    <div className="daily-stats-card">
      <div className="stats-header">
        <h3>今日统计</h3>
        <div className="date-selector">
          <input
            type="date"
            value={formatDateForInput(currentDate)}
            onChange={handleDateChange}
            className="date-input"
          />
        </div>
      </div>

      <div className="stats-content">
        {tagStats.stats.length > 0 ? (
          <div className="tag-stats-list">
            {tagStats.stats.map(stat => renderTagStat(stat))}
          </div>
        ) : (
          <div className="empty-stats">
            <span className="empty-icon">📊</span>
            <p>暂无数据</p>
            <span className="empty-hint">该日期没有记录的事件</span>
          </div>
        )}

        {tagStats.totalDuration > 0 && (
          <div className="stats-footer">
            <div className="total-time">
              <span className="total-label">总计</span>
              <span className="total-value">{formatDuration(tagStats.totalDuration)}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
