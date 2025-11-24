import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Event } from '../types';
import { UnifiedSlateEditor } from './UnifiedSlateEditor/UnifiedSlateEditor';
import { insertTag, insertEmoji, insertDateMention, applyTextFormat, extractTagsFromLine } from './UnifiedSlateEditor/helpers';
import { StatusLineContainer, StatusLineSegment } from './StatusLineContainer';
import { useFloatingToolbar } from './FloatingToolbar/useFloatingToolbar';
import { HeadlessFloatingToolbar } from './FloatingToolbar/HeadlessFloatingToolbar';
import { ToolbarConfig } from './FloatingToolbar/types';
import { TagService } from '../services/TagService';
import UnifiedDateTimePicker from './FloatingToolbar/pickers/UnifiedDateTimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { formatDateDisplay } from '../utils/dateParser';
import { EventEditModal } from './EventEditModal'; // v1 - 待迁移
import { EventEditModalV2 } from './EventEditModal/EventEditModalV2'; // v2 - 新版本
import { EventHub } from '../services/EventHub'; // 🎯 使用 EventHub 而不是 EventService
import { EventService } from '../services/EventService'; // 🔧 仅用于查询（getEventById）
import { EventHistoryService } from '../services/EventHistoryService'; // 🆕 用于事件历史快照
import { generateEventId } from '../utils/calendarUtils';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import { icons } from '../assets/icons';
import { useEventTime } from '../hooks/useEventTime';
import { TimeHub } from '../services/TimeHub';
import { getEventTime, setEventTime, isTask as isTaskByTime } from '../utils/timeManager'; // 🆕 统一时间管理
import './PlanManager.css';
import { dbg, warn, error } from '../utils/debugLogger';
import { formatRelativeTimeDisplay } from '../utils/relativeDateFormatter';
import TimeHoverCard from './TimeHoverCard';
import { calculateFixedPopupPosition } from '../utils/popupPositionUtils';
import ContentSelectionPanel from './ContentSelectionPanel';
import UpcomingEventsPanel from './UpcomingEventsPanel';

// � 初始化调试标志 - 在模块加载时立即从 localStorage 读取
if (typeof window !== 'undefined') {
  try {
    const saved = localStorage.getItem('SLATE_DEBUG');
    if (saved === 'true') {
      (window as any).SLATE_DEBUG = true;
      console.log('%c[🚀] SLATE_DEBUG 已从 localStorage 恢复 (PlanManager)', 'background: #FF9800; color: white; padding: 2px 6px; border-radius: 3px;');
    }
  } catch (e) {
    // ignore
  }
}

// �🔧 常量定义
const DESCRIPTION_INDENT_OFFSET = 1; // Description 行相对于 Title 行的缩进增量

// 🔧 类型定义：编辑器行数据结构
interface FreeFormLine<T = any> {
  id: string;
  content: string;
  level: number;
  data?: T;
}

// 时间显示组件，订阅 TimeHub 更新
// 🔧 性能优化：使用 React.memo 避免不必要的重新渲染
const PlanItemTimeDisplay = React.memo<{
  item: Event;
  onEditClick: (anchor: HTMLElement) => void;
}>(({ item, onEditClick }) => {
  // 直接使用 item.id 订阅 TimeHub
  const eventTime = useEventTime(item.id);
  
  // 悬浮卡片状态管理
  const [showHoverCard, setShowHoverCard] = useState(false);
  const hoverTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // 🔧 [FIX] 空字符串视为 undefined（TimeHub 用空字符串清空时间字段）
  const startTime = (eventTime.start && eventTime.start !== '') ? new Date(eventTime.start) : (item.startTime ? new Date(item.startTime) : null);
  const endTime = (eventTime.end && eventTime.end !== '') ? new Date(eventTime.end) : (item.endTime ? new Date(item.endTime) : null);
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
  const isAllDay = eventTime.timeSpec?.allDay ?? item.isAllDay;
  // displayHint 已移除，使用动态计算
  
  // 🆕 v2.5: 获取 timeFieldState（时间字段状态位图）
  const timeFieldState = eventTime.timeFieldState ?? item.timeFieldState ?? null;
  const isFuzzyDate = eventTime.isFuzzyDate ?? item.isFuzzyDate ?? false;
  
  // 🆕 v2.7: 获取 isFuzzyTime 和 fuzzyTimeName（模糊时间段）
  const isFuzzyTime = eventTime.isFuzzyTime ?? (item as any).isFuzzyTime ?? false;
  const fuzzyTimeName = eventTime.fuzzyTimeName ?? (item as any).fuzzyTimeName ?? null;
  
  // 🆕 v1.2: 获取原始的本地时间字符串（用于 formatRelativeTimeDisplay）
  const startTimeStr = (eventTime.start && eventTime.start !== '') ? eventTime.start : (item.startTime || null);
  const endTimeStr = (eventTime.end && eventTime.end !== '') ? eventTime.end : (item.endTime || null);
  const dueDateStr = item.dueDate || null;
  
  // 清理定时器
  useEffect(() => {
    return () => {
      if (hoverTimerRef.current !== null) {
        window.clearTimeout(hoverTimerRef.current);
      }
    };
  }, []);

  // 鼠标悬浮处理（简化版 - Tippy 负责定位）
  const handleMouseEnter = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
    }
    
    // 0.5秒延迟显示悬浮卡片
    hoverTimerRef.current = window.setTimeout(() => {
      setShowHoverCard(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 延迟关闭，给用户时间移动到悬浮卡片
    hoverTimerRef.current = window.setTimeout(() => {
      setShowHoverCard(false);
    }, 500); // 从 200ms 改为 500ms
  };

  const handleCardMouseEnter = () => {
    // 鼠标进入悬浮卡片，取消关闭定时器
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
  };

  const handleCardMouseLeave = () => {
    // 鼠标离开悬浮卡片，延迟 500ms 关闭
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    hoverTimerRef.current = window.setTimeout(() => {
      setShowHoverCard(false);
    }, 500);
  };

  // 处理编辑按钮点击
  const handleEditClick = (e?: React.MouseEvent<HTMLElement>) => {
    if (e) {
      e.stopPropagation();
    }
    setShowHoverCard(false);
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    // 如果从悬浮卡片的修改按钮点击，使用容器元素
    // 如果从时间显示本身点击，使用点击的元素
    if (containerRef.current) {
      onEditClick(containerRef.current);
    }
  };

  // ✅ v2.8: 简化逻辑 - 只要有任何时间信息就显示
  if (!startTime && !dueDate) return null;

  // 使用相对时间格式化（动态计算）
  const relativeTimeDisplay = formatRelativeTimeDisplay(
    startTimeStr,
    endTimeStr,
    isAllDay ?? false,
    dueDateStr
  );

  // 🎨 统一的渲染组件
  return (
    <Tippy
      content={
        <TimeHoverCard
          startTime={startTimeStr}
          endTime={endTimeStr}
          dueDate={dueDateStr}
          isAllDay={isAllDay ?? false}
          onEditClick={handleEditClick}
          onMouseEnter={handleCardMouseEnter}
          onMouseLeave={handleCardMouseLeave}
        />
      }
      visible={showHoverCard}
      placement="bottom-start"
      offset={({ reference, popper }) => {
        return [reference.width - popper.width, 8];
      }}
      interactive={true}
      arrow={false}
      appendTo={() => document.body}
      onClickOutside={() => setShowHoverCard(false)}
    >
      <div 
        ref={containerRef}
        style={{ display: 'inline-block' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        <span
          style={{ color: '#6b7280', whiteSpace: 'nowrap', cursor: 'pointer' }}
          onClick={handleEditClick}
        >
          {relativeTimeDisplay}
        </span>
      </div>
    </Tippy>
  );
}, (prevProps, nextProps) => {
  // 🔧 自定义比较函数：只在关键属性变化时才重新渲染
  return (
    prevProps.item.id === nextProps.item.id &&
    prevProps.item.startTime === nextProps.item.startTime &&
    prevProps.item.endTime === nextProps.item.endTime &&
    prevProps.item.dueDate === nextProps.item.dueDate &&
    prevProps.item.isAllDay === nextProps.item.isAllDay
  );
});

// 🔧 PlanManager 不再使用 Event，直接使用 Event
// Event 中已包含所有 Plan 相关字段（content, level, mode, emoji, color, priority, isCompleted 等）

export interface PlanManagerProps {
  // ❌ [REMOVED] items: Event[] - PlanManager 自己管理
  onSave: (item: Event) => void;
  onDelete: (id: string) => void;
  availableTags?: string[];
  onCreateEvent?: (event: Event) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
  microsoftService?: any; // 🆕 Microsoft 服务实例
}

// 🔍 调试开关 - 通过 window.SLATE_DEBUG = true 开启
const isDebugEnabled = () => {
  if (typeof window === 'undefined') return false;
  return (window as any).SLATE_DEBUG === true;
};

// 🔧 优化：提取 Checkbox 为独立组件，使用 React.memo 避免重复渲染
const PlanItemCheckbox = React.memo<{
  isCompleted: boolean;
  onChange: (checked: boolean) => void;
  emoji?: string;
}>(({ isCompleted, onChange, emoji }) => {
  return (
    <>
      <input
        type="checkbox"
        checked={isCompleted || false}
        onChange={(e) => {
          e.stopPropagation();
          onChange(e.target.checked);
        }}
        style={{
          cursor: 'pointer',
          opacity: 1,
        }}
      />
      {emoji && <span style={{ fontSize: '16px', lineHeight: '1' }}>{emoji}</span>}
    </>
  );
}, (prevProps, nextProps) => {
  // 只在关键属性变化时才重新渲染
  return prevProps.isCompleted === nextProps.isCompleted &&
         prevProps.emoji === nextProps.emoji;
  // onChange 函数引用变化不触发重渲染（因为它是从 useCallback 来的）
});

const PlanManager: React.FC<PlanManagerProps> = ({
  onSave,
  onDelete,
  availableTags = [],
  onCreateEvent,
  onUpdateEvent,
  microsoftService, // 🆕 接收 Microsoft 服务
}) => {
  // ✅ PlanManager 自己维护 items state
  // 🛡️ PERFORMANCE FIX: 使用useRef缓存初始数据，避免重复计算
  const initialItemsRef = useRef<Event[] | null>(null);
  
  const [items, setItems] = useState<Event[]>(() => {
    if (initialItemsRef.current) {
      console.log('[PlanManager] 使用缓存的初始数据:', {
        数量: initialItemsRef.current.length,
        示例: initialItemsRef.current.slice(0, 3).map(e => ({
          id: e.id?.slice(-10),
          title: e.title?.slice(0, 20),
          isPlan: e.isPlan
        }))
      });
      return initialItemsRef.current;
    }
    
    // 初始化：从 EventService 加载 Plan 事件
    const now = new Date();
    const rawEvents = EventService.getAllEvents();
    
    // 🛡️ 过滤掉 ghost 事件（带 _isDeleted 标记的临时事件）
    const allEvents = rawEvents.filter(e => !(e as any)._isDeleted);
    
    if (rawEvents.length !== allEvents.length) {
      console.warn('[PlanManager] 🚨 发现并过滤了', rawEvents.length - allEvents.length, '个 ghost 事件！');
    }
    
    // 🔍 DEBUG: 检查 EventService 返回的数据
    console.log('[PlanManager] 初始化 - 从 EventService 加载:', {
      总事件数: allEvents.length,
      示例事件: allEvents.slice(0, 3).map(e => {
        const eventlog = (e as any).eventlog;
        const eventlogType = typeof eventlog;
        const eventlogContent = eventlogType === 'object' && eventlog !== null
          ? eventlog.descriptionHtml || eventlog.content || ''
          : eventlog || '';
        
        return {
          id: e.id?.substring(0, 30),
          title: e.title?.substring(0, 20),
          isPlan: e.isPlan,
          eventlogType,
          hasEventlog: !!eventlog,
          hasDescription: !!e.description,
          eventlogContentLength: eventlogContent.length,
          descriptionLength: (e.description || '').length,
        };
      })
    });
    
    // 🎯 三步过滤公式：isPlan + checkType - 系统事件
    const filtered = allEvents.filter((event: Event) => {
      // 步骤 1: 必须是 Plan 事件
      if (!event.isPlan) {
        return false;
      }
      
      // 步骤 2: checkType 过滤（只排除明确为 'none' 的，undefined 视为历史数据保留）
      if (event.checkType === 'none') {
        return false;
      }
      
      // 步骤 3: TimeCalendar 时间范围检查
      if (event.isTimeCalendar) {
        if (event.endTime) {
          const endTime = new Date(event.endTime);
          if (now >= endTime) {
            return false; // TimeCalendar 已过期
          }
        } else {
          return false; // 没有endTime的TimeCalendar事件视为已过期
        }
      }
      
      // 步骤 4: 排除系统事件（使用严格比较 === true）
      if (event.isTimer === true || 
          event.isOutsideApp === true || 
          event.isTimeLog === true) {
        return false;
      }
      
      return true;
    });
    
    // 🔍 DIAGNOSIS: 检查过滤后的数据
    console.log('[PlanManager] 初始化 - 过滤后的 Plan 事件:', {
      过滤后数量: filtered.length,
      示例: filtered.slice(0, 3).map(e => {
        const eventlog = (e as any).eventlog;
        const eventlogType = typeof eventlog;
        const eventlogContent = eventlogType === 'object' && eventlog !== null
          ? eventlog.descriptionHtml || eventlog.content || ''
          : eventlog || '';
        
        return {
          id: e.id?.substring(0, 30),
          title: e.title?.substring(0, 20),
          eventlogType,
          hasEventlog: !!eventlog,
          hasDescription: !!e.description,
          eventlogContentLength: eventlogContent.length,
          descriptionLength: (e.description || '').length,
        };
      })
    });
    
    // 🚨 DIAGNOSIS: 检测空数组异常
    if (filtered.length === 0 && allEvents.length > 0) {
      console.error('🔴 [诊断] PlanManager 所有事件被过滤！', {
        总事件数: allEvents.length,
        isPlan事件: allEvents.filter(e => e.isPlan).length,
        有parentEventId的: allEvents.filter(e => e.parentEventId).length,
        TimeCalendar事件: allEvents.filter(e => e.isTimeCalendar).length,
        TimeCalendar已过期: allEvents.filter(e => e.isTimeCalendar && e.endTime && new Date(e.endTime) <= now).length,
        示例事件: allEvents.slice(0, 3).map(e => ({
          id: e.id?.substring(0, 20),
          title: e.title?.substring(0, 20),
          isPlan: e.isPlan,
          isTimeCalendar: e.isTimeCalendar,
          parentEventId: e.parentEventId,
          endTime: e.endTime
        }))
      });
    }
    
    return filtered;
  });
  
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<Event | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
  // 🆕 本地临时状态：管理尚未保存到EventService的空行（graytext点击创建的）
  const [pendingEmptyItems, setPendingEmptyItems] = useState<Map<string, Event>>(new Map());
  
  // 当前选中的标签（用于 FloatingToolbar）
  const [currentSelectedTags, setCurrentSelectedTags] = useState<string[]>([]);
  // 使用 ref 追踪最新的选中标签，避免闭包问题
  const currentSelectedTagsRef = useRef<string[]>([]);
  
  // 保存当前聚焦的行 ID，用于添加标签等操作
  const [currentFocusedLineId, setCurrentFocusedLineId] = useState<string | null>(null);
  
  // 🆕 保存当前聚焦行的模式（title 或 description）
  const [currentFocusedMode, setCurrentFocusedMode] = useState<'title' | 'description'>('title');
  
  // 🆕 保存当前聚焦行的 isTask 状态
  const [currentIsTask, setCurrentIsTask] = useState<boolean>(false);
  
  // 🆕 ContentSelectionPanel 状态管理
  const [dateRange, setDateRange] = useState<{start: Date, end: Date}>(() => {
    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // 本周开始
    weekStart.setHours(0, 0, 0, 0); // 设置为 00:00:00
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6); // 本周结束
    weekEnd.setHours(23, 59, 59, 999); // 设置为 23:59:59
    return { start: weekStart, end: weekEnd };
  });
  const [activeFilter, setActiveFilter] = useState<'tags' | 'tasks' | 'favorites' | 'new'>('tags');
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🆕 强制 snapshot 重新计算的版本号
  const [snapshotVersion, setSnapshotVersion] = useState(0);
  
  // 🚀 性能优化: 缓存事件状态查询结果
  const eventStatusCacheRef = useRef<Map<string, { status: 'new' | 'updated' | 'done' | 'missed' | 'deleted' | undefined, timestamp: number }>>(new Map());
  
  // 🆕 事件状态计算函数 (带缓存)
  const getEventStatus = useCallback((eventId: string): 'new' | 'updated' | 'done' | 'missed' | 'deleted' | undefined => {
    if (!dateRange) return undefined;
    
    // 🚀 检查缓存 (5秒内有效)
    const cached = eventStatusCacheRef.current.get(eventId);
    if (cached && Date.now() - cached.timestamp < 5000) {
      return cached.status;
    }
    
    try {
      // 从EventHistoryService获取事件在指定时间段的历史记录
      const startTime = formatTimeForStorage(dateRange.start);
      const endTime = formatTimeForStorage(dateRange.end);
      const history = EventHistoryService.queryHistory({ 
        eventId, 
        startTime, 
        endTime 
      });
      
      if (!history || history.length === 0) {
        const result = undefined;
        eventStatusCacheRef.current.set(eventId, { status: result, timestamp: Date.now() });
        return result;
      }
      
      // 按时间排序，最新的在前 - 使用 parseLocalTimeString 确保本地时间解析
      const sortedHistory = history.sort((a, b) => parseLocalTimeString(b.timestamp).getTime() - parseLocalTimeString(a.timestamp).getTime());
      const latestAction = sortedHistory[0];
      
      // 根据最新操作确定状态
      let status: 'new' | 'updated' | 'done' | 'missed' | 'deleted' | undefined;
      
      switch (latestAction.operation) {
        case 'create':
          status = 'new';
          break;
        case 'update':
          status = 'updated';
          break;
        case 'delete':
          status = 'deleted';
          break;
        case 'checkin':
          // 检查checkin历史的具体action来判断是签到还是取消签到
          if (latestAction.metadata?.action === 'check-in') {
            status = 'done';
          } else if (latestAction.metadata?.action === 'uncheck') {
            // 取消签到后，需要进一步判断事件状态
            const event = EventService.getEventById(eventId);
            if (event && event.startTime) {
              const eventTime = new Date(event.startTime);
              const now = new Date();
              if (eventTime < now) {
                status = 'missed'; // 过了时间但取消了签到
              } else {
                status = 'updated'; // 还没到时间或没有时间设置
              }
            } else {
              status = 'updated';
            }
          } else {
            status = 'done';
          }
          break;
        default:
          // 检查事件的当前签到状态
          const event = EventService.getEventById(eventId);
          if (event) {
            const checkInStatus = EventService.getCheckInStatus(eventId);
            if (checkInStatus.isChecked) {
              status = 'done';
              break;
            }
            
            // 检查是否有计划时间但未完成（missed）
            if (event.startTime) {
              const eventTime = new Date(event.startTime);
              const now = new Date();
              if (eventTime < now && !checkInStatus.isChecked) {
                status = 'missed';
                break;
              }
            }
          }
          status = 'updated';
          break;
      }
      
      // 缓存并返回状态
      eventStatusCacheRef.current.set(eventId, { status, timestamp: Date.now() });
      return status;
    } catch (error) {
      console.warn(`[getEventStatus] Error getting status for event ${eventId}:`, error);
      return undefined;
    }
  }, [dateRange]);
  
  // 避免重复插入同一标签的防抖标记（同一行同一标签在短时间内仅插入一次）
  const lastTagInsertRef = useRef<{ lineId: string; tagId: string; time: number } | null>(null);
  // 🆕 UnifiedSlateEditor 的单个编辑器实例
  const unifiedEditorRef = useRef<any>(null);
  // 注册每一行的 Tiptap 编辑器实例（用于精准插入到光标位置）
  const editorRegistryRef = useRef<Map<string, any>>(new Map());
  
  // 🆕 v1.5: onChange 防抖优化（300ms）
  const onChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatedItemsRef = useRef<any[] | null>(null);
  
  // 清理定时器和缓存
  useEffect(() => {
    // 🔍 组件挂载
    if (isDebugEnabled()) {
      // Debug mode enabled
    }
    
    return () => {
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current);
      }
      // 🧹 清理缓存
      eventStatusCacheRef.current.clear();
      snapshotCacheRef.current = null;
    };
  }, []);
  
  // ✅ 监听 eventsUpdated，增量更新 items（带循环防护）
  useEffect(() => {
    const handleEventUpdated = (e: CustomEvent) => {
      const { eventId, isDeleted, isNewEvent, updateId, isLocalUpdate, originComponent, source } = e.detail || {};
      
      // 🚫 循环更新防护：跳过本组件发出的更新
      if (isLocalUpdate && originComponent === 'PlanManager') {
        console.log('🔄 [PlanManager] 跳过本地更新，避免循环', { eventId: eventId?.slice(-10), source });
        return;
      }
      
      // 🚫 双重检查：询问EventService确认
      if (updateId && EventService.isLocalUpdate(eventId, updateId)) {
        console.log('🔄 [PlanManager] EventService确认为本地更新，跳过', { eventId: eventId?.slice(-10) });
        return;
      }
      
      // ✅ 确认为外部更新，执行同步
      console.log('📡 [PlanManager] 外部更新，执行同步', { eventId: eventId?.slice(-10), source, originComponent });
      
      // 🧹 清除该事件的状态缓存
      eventStatusCacheRef.current.delete(eventId);
      snapshotCacheRef.current = null;
      
      if (isDeleted) {
        // 增量删除
        setItems(prev => prev.filter(event => event.id !== eventId));
        setSnapshotVersion(v => v + 1); // 强制更新 snapshot
      } else if (isNewEvent) {
        // 增量添加
        const newEvent = EventService.getEventById(eventId);
        console.log('[PlanManager] 新建事件检查:', {
          eventId: eventId?.slice(-10),
          找到事件: !!newEvent,
          isPlan: newEvent?.isPlan,
          parentEventId: newEvent?.parentEventId,
          isTimeCalendar: newEvent?.isTimeCalendar,
          endTime: newEvent?.endTime,
          满足条件: newEvent && newEvent.isPlan && !newEvent.parentEventId
        });
        
        if (newEvent && newEvent.isPlan && !newEvent.parentEventId) {
          const now = new Date();
          // 检查是否应该显示
          if (!newEvent.isTimeCalendar || (newEvent.endTime && now < new Date(newEvent.endTime))) {
            console.log('[PlanManager] ✅ 添加新事件到列表:', eventId?.slice(-10));
            setItems(prev => [...prev, newEvent]);
          } else {
            console.log('[PlanManager] ❌ 新事件不满足显示条件 (TimeCalendar已过期)');
          }
        } else {
          console.log('[PlanManager] ❌ 新事件不满足基本条件');
        }
        setSnapshotVersion(v => v + 1); // 强制更新 snapshot
      } else {
        // 增量更新
        const updatedEvent = EventService.getEventById(eventId);
        if (updatedEvent) {
          setItems(prev => {
            return prev.map((e: Event) => e.id === eventId ? updatedEvent : e);
          });
        }
        setSnapshotVersion(v => v + 1); // 强制更新 snapshot
      }
    };
    
    window.addEventListener('eventsUpdated', handleEventUpdated as EventListener);
    return () => window.removeEventListener('eventsUpdated', handleEventUpdated as EventListener);
  }, []);
  
  // 日期提及弹窗
  const [showDateMention, setShowDateMention] = useState(false);
  const [showUnifiedPicker, setShowUnifiedPicker] = useState(false);
  // 仅保存真实 DOM 锚点（span 或可点击预览元素）
  const dateAnchorRef = useRef<HTMLElement | null>(null);
  // 保存键盘触发时的光标矩形，供 Tippy 使用虚拟定位，避免参考元素被编辑器重绘移除
  const caretRectRef = useRef<DOMRect | null>(null);
  const pickerTargetItemIdRef = useRef<string | null>(null);

  // 设置 dayjs 语言环境为中文，确保与 UnifiedDateTimePicker 的展示一致
  dayjs.locale('zh-cn');
  
  // 🆕 v1.6: 统一删除接口（单一删除入口）
  const deleteItems = useCallback((itemIds: string[], reason: string) => {
    if (itemIds.length === 0) return;
    
    dbg('delete', `🗑️ 统一删除 ${itemIds.length} 个 items`, { reason, ids: itemIds });
    
    // 1. 从 pendingEmptyItems 移除
    setPendingEmptyItems(prev => {
      const next = new Map(prev);
      itemIds.forEach(id => next.delete(id));
      return next;
    });
    
    // 2. 调用外部删除（EventService + PlanManager 父组件）
    itemIds.forEach(id => {
      try {
        onDelete(id);
      } catch (err) {
        error('delete', `删除 ${id} 失败`, { error: err });
      }
    });
    
    dbg('delete', `✅ 删除完成`, { count: itemIds.length });
  }, [onDelete]);
  
  // 标签替换
  const [replacingTagElement, setReplacingTagElement] = useState<HTMLElement | null>(null);
  const [showTagReplace, setShowTagReplace] = useState(false);
  
  // FloatingToolbar 配置
  const toolbarConfig: ToolbarConfig = {
    mode: 'quick-action',
    features: [], // 🆕 features 由 HeadlessFloatingToolbar 根据 mode 自动决定
  };
  
  // FloatingToolbar Hook - 自动管理模式切换
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [activePickerIndex, setActivePickerIndex] = useState<number | null>(null);
  const [isSubPickerOpen, setIsSubPickerOpen] = useState<boolean>(false); // 🆕 追踪子选择器（颜色选择器）是否打开
  
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorContainerRef as React.RefObject<HTMLElement>,
    enabled: true,
    menuItemCount: 7, // 🆕 最大菜单项数：text_floatingbar 有 7 个菜单项，menu_floatingbar 有 5 个菜单项
    onMenuSelect: (menuIndex: number) => {
      setActivePickerIndex(menuIndex);
    },
    isSubPickerOpen, // 🔑 传递子选择器状态
  });

  // 🆕 监听 TagPicker 打开，同步实际的标签状态
  useEffect(() => {
    // 🎯 只在 TagPicker 打开时（activePickerIndex 从非0变为0）同步 Slate 状态
    if (activePickerIndex !== 0 || !currentFocusedLineId) return;
    
    // 📌 Description 模式下不同步状态（mention-only 标签不记住勾选）
    if (currentFocusedMode === 'description') {
      setCurrentSelectedTags([]);
      currentSelectedTagsRef.current = [];
      console.log('[TagPicker Sync] Description 模式，清空勾选状态');
      return;
    }
    
    const editor = unifiedEditorRef.current;
    if (!editor) return;

    // 🔧 使用 helpers 中的 extractTagsFromLine 函数
    const tagIds = extractTagsFromLine(editor, currentFocusedLineId);
    
    // 更新状态
    setCurrentSelectedTags(tagIds);
    currentSelectedTagsRef.current = tagIds;
    console.log('[TagPicker Sync] Title 模式，同步已选标签:', tagIds);
  }, [activePickerIndex, currentFocusedMode, currentFocusedLineId]); // 🔥 添加 currentFocusedLineId 依赖

  // 将文本格式命令路由到当前 Slate 编辑器
  const handleTextFormat = useCallback((command: string, value?: string) => {
    // 🆕 使用 UnifiedSlateEditor 的 applyTextFormat 函数
    const editor = unifiedEditorRef.current;
    if (!editor) {
      console.warn('[handleTextFormat] Editor not ready');
      return;
    }
    
    const success = applyTextFormat(editor, command, value);
    
    // 如果是 bullet 切换，隐藏 FloatingBar
    if (success && command === 'toggleBulletList') {
      floatingToolbar.hideToolbar();
    }
  }, [floatingToolbar]);

  // 监听编辑器内的 focus 事件，保存当前聚焦的行 ID
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;
    
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.hasAttribute('contenteditable')) {
        const lineId = target.getAttribute('data-line-id');
        if (lineId) {
          // 更新当前聚焦的行 ID
          setCurrentFocusedLineId(lineId);
          
          // 🆕 检测当前行的模式
          const isDescriptionLine = lineId.includes('-desc') || target.classList.contains('description-mode');
          setCurrentFocusedMode(isDescriptionLine ? 'description' : 'title');
          
          // 找到对应的 Event，更新当前选中的标签和 isTask 状态
          const actualItemId = lineId.replace('-desc', ''); // 移除 -desc 后缀获取真实 item id
          const item = items.find(i => i.id === actualItemId);
          if (item) {
            // 🆕 更新 isTask 状态
            setCurrentIsTask(item.isTask || false);
            
            // 🔥 标签状态由 useEffect (L776-822) 从 Slate 节点同步，不在这里设置
            // 避免使用过时的 item.tags 覆盖 Slate 中最新的标签状态
          } else {
            // 🔥 新行没有 item，标签状态会在 useEffect 中自动清空
            setCurrentIsTask(false);
          }
        }
      }
    };
    
    // 监听 @ 键触发日期输入，Ctrl+; 触发统一日期时间选择器
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.hasAttribute('contenteditable')) return;
      
      // 检测 Ctrl+; 打开统一日期时间选择器（UnifiedDateTimePicker）
      if (e.ctrlKey && (e.key === ';')) {
        e.preventDefault();
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          // 记录当前光标矩形（用于 getReferenceClientRect）
          try {
            const rect = range.getBoundingClientRect();
            if (rect) caretRectRef.current = rect;
          } catch {}
          // 创建真实锚点（同上）
          const anchor = document.createElement('span');
          anchor.className = 'temp-picker-anchor';
          anchor.style.cssText = 'display: inline-block; width: 1px; height: 1px; vertical-align: text-bottom;';
          range.insertNode(anchor);
          range.setStartAfter(anchor);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          dateAnchorRef.current = anchor;
          // 记录当前行对应的 itemId 作为目标
          if (currentFocusedLineId) {
            pickerTargetItemIdRef.current = currentFocusedLineId.replace('-desc','');
          }
          setShowUnifiedPicker(true);
        }
        return;
      }
    };
    
    // 监听点击标签元素
    const handleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      // 检查是否点击了标签
      if (target.classList.contains('inline-tag')) {
        e.preventDefault();
        e.stopPropagation();
        
        // 保存被点击的标签元素
        setReplacingTagElement(target);
        setShowTagReplace(true);
      }
    };
    
    container.addEventListener('focusin', handleFocus);
    container.addEventListener('keydown', handleKeyDown);
    container.addEventListener('click', handleClick);
    
    return () => {
      container.removeEventListener('focusin', handleFocus);
      container.removeEventListener('keydown', handleKeyDown);
      container.removeEventListener('click', handleClick);
    };
  }, [items]);

  // 监听 TagService 变化
  const [tagServiceVersion, setTagServiceVersion] = useState(0);
  
  useEffect(() => {
    // 订阅标签变化
    const listener = () => {
      setTagServiceVersion(v => v + 1);
    };
    
    TagService.addListener(listener);
    
    // 初始加载时检查一次
    const tags = TagService.getFlatTags();
    if (tags.length > 0) {
    } else {
    }
    
    return () => TagService.removeListener(listener);
  }, []);

  // 获取所有已使用的标签
  const existingTags = useMemo(() => {
    const allTags = TagService.getFlatTags();
    if (allTags.length > 0) {
    }
    
    // 获取当前计划项中使用的标签名
    const usedTagNames = new Set<string>();
    items.forEach(item => {
      item.tags?.forEach(tag => usedTagNames.add(tag));
    });
    
    // 返回所有标签，优先显示正在使用的标签
    return allTags;
  }, [items, tagServiceVersion]);

  // 🔧 创建 itemsMap 用于快速查找
  const itemsMap = useMemo(() => {
    const map: Record<string, Event> = {};
    items.forEach(item => {
      map[item.id] = item;
    });
    return map;
  }, [items]);

  // 🆕 v1.5: 批处理执行函数（从 onChange 中提取）
  const executeBatchUpdate = useCallback((updatedItems: any[]) => {
    // 🔧 过滤掉 ghost events（Snapshot 模式的虚拟事件，不应该保存）
    const realItems = updatedItems.filter(item => !(item as any)._isDeleted);
    
    if (realItems.length < updatedItems.length) {
      console.log('[executeBatchUpdate] 🔧 过滤掉 ghost events:', {
        原始数量: updatedItems.length,
        过滤后: realItems.length,
        过滤掉: updatedItems.length - realItems.length
      });
    }
    
    // 🆕 v1.5 批处理器架构 + 透传模式
    const actions = {
      delete: [] as string[],    // 待删除的 IDs
      save: [] as Event[],        // 待保存的 Events
      sync: [] as Event[],        // 需要同步到 Calendar 的 Events
    };
    
    // ===== 阶段 1: 跨行删除检测 =====
    const currentItemIds = items.map(i => i.id);
    const updatedItemIds = realItems.map((i: any) => i.id);
    const crossDeletedIds = currentItemIds.filter(id => !updatedItemIds.includes(id));
    
    if (crossDeletedIds.length > 0) {
      actions.delete.push(...crossDeletedIds);
      dbg('plan', `📋 收集跨行删除动作: ${crossDeletedIds.length} 个`);
    }
    
    // ===== 阶段 2: 内容处理（更新、空白删除） =====
    realItems.forEach((updatedItem: any) => {
      const existingItem = itemsMap[updatedItem.id];
      
      // 🔧 v1.5: 直接使用 updatedItem（包含完整字段，无需合并）
      // Slate 通过 metadata 透传了所有业务字段
      
      // 🆕 空白检测（使用透传后的字段）
      const isEmpty = (
        !updatedItem.title?.trim() && 
        !updatedItem.content?.trim() && 
        !updatedItem.description?.trim() &&
        !updatedItem.eventlog?.trim() && // 🆕 v1.8: 检测富文本描述
        !updatedItem.startTime &&
        !updatedItem.endTime &&
        !updatedItem.dueDate &&
        // 🔧 [FIX] 避免删除测试事件或有特殊来源的事件
        !updatedItem.source?.includes('test') &&
        !updatedItem.id?.includes('test') &&
        !updatedItem.id?.includes('console')
      );
      
      // 空 event 处理
      if (isEmpty) {
        if (existingItem) {
          actions.delete.push(updatedItem.id);
          dbg('plan', `📋 收集空白删除动作: ${updatedItem.id}`);
        }
        return; // 新空白行跳过
      }
      
      // 变更检测
      const isChanged = !existingItem || 
        existingItem.title !== updatedItem.title ||
        existingItem.content !== updatedItem.content ||
        existingItem.description !== updatedItem.description ||
        existingItem.eventlog !== updatedItem.eventlog || // 🆕 v1.8: 检测 eventlog 变化
        JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);
      
      if (isChanged) {
        const now = new Date();
        const nowISO = formatTimeForStorage(now);
        
        // 🆕 v1.8: 从标签中提取 calendarIds
        const tagIds = (updatedItem.tags || []).map((t: string) => {
          const tag = TagService.getFlatTags().find(x => x.id === t || x.name === t);
          return tag ? tag.id : t;
        });
        
        const calendarIds = tagIds
          .map((tagId: string) => {
            const tag = TagService.getFlatTags().find(t => t.id === tagId);
            return tag?.calendarMapping?.calendarId;
          })
          .filter((id: string | undefined): id is string => !!id);
        
        console.log('[executeBatchUpdate] 标签到日历映射:', {
          eventId: updatedItem.id,
          title: updatedItem.title?.substring(0, 20),
          tags: updatedItem.tags,
          tagIds,
          calendarIds,
          hasSyncMapping: calendarIds.length > 0
        });
        
        // 🔧 v2.9: 保留 updatedItem 中的时间字段(来自 serialization.ts → TimeHub)
        // serialization.ts 已经从 TimeHub.getSnapshot() 读取最新时间
        // 🔥 [FIX] 但为了确保最新，再次从 TimeHub 读取（防止时序问题）
        const timeSnapshot = TimeHub.getSnapshot(updatedItem.id);
        
        const eventItem: Event = {
          ...(existingItem || {}),
          ...updatedItem,  // ✅ 包含从 Slate 来的内容字段
          // 🔥 强制使用 TimeHub 的最新时间（覆盖 updatedItem 中可能过期的值）
          startTime: timeSnapshot.start || updatedItem.startTime || existingItem?.startTime,
          endTime: timeSnapshot.end !== undefined ? timeSnapshot.end : (updatedItem.endTime || existingItem?.endTime),
          tags: tagIds, // 使用规范化的 tagIds
          calendarIds: calendarIds.length > 0 ? calendarIds : undefined, // 🆕 v1.8: 设置 calendarIds
          priority: updatedItem.priority || existingItem?.priority || 'medium',
          isCompleted: updatedItem.isCompleted ?? existingItem?.isCompleted ?? false,
          type: existingItem?.type || 'todo',
          isPlan: true,
          isTask: true,
          isTimeCalendar: false,
          remarkableSource: true,
          createdAt: existingItem?.createdAt || nowISO,
          updatedAt: nowISO,
          source: 'local',
          syncStatus: calendarIds.length > 0 ? 'pending' : 'local-only', // 🆕 v1.8: 根据日历映射设置同步状态
        } as Event;
        
        // 🆕 v1.5: 保留 timeSpec
        if (timeSnapshot.timeSpec || updatedItem.timeSpec) {
          (eventItem as any).timeSpec = timeSnapshot.timeSpec || updatedItem.timeSpec;
        }
        
        // 🔍 调试：显示时间来源
        console.log('[executeBatchUpdate] 时间字段来源:', {
          eventId: updatedItem.id,
          title: updatedItem.title?.substring(0, 20),
          timeHubStart: timeSnapshot.start,
          updatedItemStart: updatedItem.startTime,
          existingStart: existingItem?.startTime,
          finalStart: eventItem.startTime,
          finalEnd: eventItem.endTime,
        });
        
        actions.save.push(eventItem);
        
        // 判断是否需要同步到 Calendar
        const hasAnyTime = !!(eventItem.startTime || eventItem.endTime || eventItem.dueDate);
        if (hasAnyTime) {
          actions.sync.push(eventItem);
        }
      }
    });
    
    // ===== 阶段 3: 批量执行动作 =====
    // 3.1 批量删除（使用统一接口）
    if (actions.delete.length > 0) {
      deleteItems(actions.delete, 'batch-update-empty-items');
    }
    
    // 3.2 批量保存
    if (actions.save.length > 0) {
      dbg('plan', `💾 执行批量保存: ${actions.save.length} 个`, { 
        titles: actions.save.map(e => e.title) 
      });
      // 🔍 v1.8: 调试 eventlog 字段
      actions.save.forEach(item => {
        console.log('[PlanManager] 准备保存到 EventService:', {
          id: item.id,
          title: item.title?.substring(0, 20),
          hasEventlog: !!(item as any).eventlog,
          hasDescription: !!item.description,
          eventlogLength: ((item as any).eventlog || '').length,
          descriptionLength: (item.description || '').length,
          calendarIds: (item as any).calendarIds, // 🆕 v1.8: 显示 calendarIds
          tags: item.tags,
          startTime: item.startTime, // 🔍 显示时间字段(来自 serialization.ts → TimeHub)
          endTime: item.endTime,
        });
        onSave(item);
      });
    }
    
    // 🆕 v1.8: 移除批量同步到 Calendar（因为 onSave 已经触发同步）
    // ActionBasedSyncManager 会根据 calendarIds 和 syncStatus 自动同步
    // 不再需要显式调用 syncToUnifiedTimeline
    
    // 📊 执行摘要
    if (actions.delete.length > 0 || actions.save.length > 0) {
      dbg('plan', `✅ 批处理完成 (v1.5 透传架构 + 防抖)`, {
        deleted: actions.delete.length,
        saved: actions.save.length,
      });
    }
  }, [items, itemsMap, onSave, onDelete]);

  // 🆕 定期清理空的 pendingEmptyItems（超过5分钟未填充内容的空行）
  useEffect(() => {
    const cleanupTimer = setInterval(() => {
      const now = Date.now();
      setPendingEmptyItems(prev => {
        const next = new Map(prev);
        let cleanedCount = 0;
        
        for (const [id, item] of prev.entries()) {
          // 检查是否为完全空白的事件
          const isEmpty = (
            !item.title?.trim() && 
            !item.content?.trim() && 
            !item.description?.trim() &&
            !item.startTime &&
            !item.endTime &&
            !item.dueDate
          );
          
          // 检查创建时间是否超过5分钟
          const createdTime = new Date(item.createdAt || 0).getTime();
          const isOld = now - createdTime > 5 * 60 * 1000; // 5分钟
          
          if (isEmpty && isOld) {
            next.delete(id);
            cleanedCount++;
          }
        }
        
        if (cleanedCount > 0) {
          dbg('plan', '🧹 清理过期空行', { cleanedCount, remainingCount: next.size });
        }
        
        return next;
      });
    }, 60000); // 每分钟检查一次
    
    return () => clearInterval(cleanupTimer);
  }, []);

  // 🆕 v1.8: 立即状态同步（不防抖）- 用于更新 UI 状态
  const immediateStateSync = useCallback((updatedItems: any[]) => {
    // 🎯 目标：立即更新 pendingEmptyItems，让勾选框立即显示
    // 不执行保存操作，只更新本地状态
    
    updatedItems.forEach((updatedItem: any) => {
      const existingItem = itemsMap[updatedItem.id];
      
      // 检查是否为空白新行
      const isEmpty = (
        !updatedItem.title?.trim() && 
        !updatedItem.content?.trim() && 
        !updatedItem.description?.trim() &&
        !updatedItem.startTime &&
        !updatedItem.endTime &&
        !updatedItem.dueDate
      );
      
      if (isEmpty && !existingItem) {
        // 新空白行：立即添加到 pendingEmptyItems
        const now = new Date();
        const nowISO = formatTimeForStorage(now);
        
        const newPendingItem: Event = {
          id: updatedItem.id,
          title: '',
          content: updatedItem.content || '',
          description: updatedItem.description || '',
          eventlog: updatedItem.eventlog, // 🆕 v1.8: 保留富文本描述
          tags: updatedItem.tags || [],
          level: updatedItem.level || 0,
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
          isPlan: true,
          isTask: true,
          isTimeCalendar: false,
          remarkableSource: true,
          startTime: '',
          endTime: '',
          isAllDay: false,
          createdAt: nowISO,
          updatedAt: nowISO,
          source: 'local',
          syncStatus: 'local-only',
        } as Event;
        
        setPendingEmptyItems(prev => new Map(prev).set(updatedItem.id, newPendingItem));
      }
    });
  }, [itemsMap]);

  // 🆕 v1.5: 防抖处理函数（用于批量保存）
  const debouncedOnChange = useCallback((updatedItems: any[]) => {
    // ✅ 立即同步状态（不等待防抖）
    immediateStateSync(updatedItems);
    
    // 清除之前的定时器
    if (onChangeTimerRef.current) {
      clearTimeout(onChangeTimerRef.current);
    }
    
    // 保存最新的 updatedItems
    pendingUpdatedItemsRef.current = updatedItems;
    
    // 设置新的定时器（300ms 后执行保存操作）
    onChangeTimerRef.current = setTimeout(() => {
      const itemsToProcess = pendingUpdatedItemsRef.current;
      if (!itemsToProcess) return;
      
      // 执行批处理逻辑
      executeBatchUpdate(itemsToProcess);
      
      // 清空缓存
      pendingUpdatedItemsRef.current = null;
      onChangeTimerRef.current = null;
    }, 300);
  }, [immediateStateSync, executeBatchUpdate]);

  // 🆕 生成事件变更快照 (带缓存)
  const snapshotCacheRef = useRef<{ snapshot: any, timestamp: number, dateRangeKey: string } | null>(null);
  
  const generateEventSnapshot = useCallback(() => {
    if (!dateRange) {
      return {
        created: 0, updated: 0, completed: 0, deleted: 0, details: []
      };
    }
    
    try {
      // 从EventHistoryService获取指定时间范围的历史记录
      const startTimeStr = formatTimeForStorage(dateRange.start);
      const endTimeStr = formatTimeForStorage(dateRange.end);
      const dateRangeKey = `${startTimeStr}-${endTimeStr}`;
      
      // 🚀 检查缓存 (3秒内有效)
      if (snapshotCacheRef.current && 
          snapshotCacheRef.current.dateRangeKey === dateRangeKey &&
          Date.now() - snapshotCacheRef.current.timestamp < 3000) {
        return snapshotCacheRef.current.snapshot;
      }
      
      console.log('[PlanManager] 生成 Snapshot:', {
        dateRange: {
          start: startTimeStr,
          end: endTimeStr
        },
        snapshotVersion
      });
      
      // 使用 EventHistoryService 的新方法获取结构化的操作摘要
      const summary = EventHistoryService.getEventOperationsSummary(
        startTimeStr,
        endTimeStr
      );
      
      const result = {
        created: summary.created.length,
        updated: summary.updated.length,
        completed: summary.completed.length,
        deleted: summary.deleted.length,
        details: [...summary.created, ...summary.updated, ...summary.completed, ...summary.deleted]
      };
      
      console.log('[PlanManager] Snapshot 统计:', result);
      
      // 🚀 缓存结果
      snapshotCacheRef.current = {
        snapshot: result,
        timestamp: Date.now(),
        dateRangeKey
      };
      
      return result;
    } catch (error) {
      console.warn('[PlanManager] EventHistoryService not available, using fallback', error);
      return {
        created: 0, updated: 0, completed: 0, deleted: 0, details: []
      };
    }
  }, [dateRange, snapshotVersion]); // 添加 snapshotVersion 依赖
  
  // 🆕 过滤后的事件列表
  const filteredItems = useMemo(() => {
    let result = [...items, ...Array.from(pendingEmptyItems.values())];
    
    // 应用标签隐藏过滤
    if (hiddenTags.size > 0) {
      result = result.filter(item => {
        const itemTags = item.tags || [];
        return !itemTags.some(tag => hiddenTags.has(tag));
      });
    }
    
    // 🔧 移除日期范围过滤 - 显示所有事件，状态竖线根据选定时间段显示活动状态
    // 日期范围仅用于计算事件状态竖线，不用于过滤事件显示
    
    // 应用搜索过滤
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item.content?.toLowerCase().includes(query)
      );
    }
    
    return result;
  }, [items, pendingEmptyItems, hiddenTags, dateRange, searchQuery]);
  
  // 将 Event[] 转换为 FreeFormLine<Event>[]
  // ✅ 重构: 直接准备 Event[] 给 UnifiedSlateEditor，移除 FreeFormLine 中间层
  // 🆕 Snapshot 模式：添加已删除的事件
  const editorItems = useMemo(() => {
    let allItems = filteredItems;
    
    // 🚨 诊断：检查 filteredItems 是否包含 ghost 事件
    const ghostsInFiltered = filteredItems.filter((item: any) => item._isDeleted);
    if (ghostsInFiltered.length > 0) {
      console.error('[PlanManager] 🚨 filteredItems 中发现', ghostsInFiltered.length, '个 ghost 事件！', 
        ghostsInFiltered.map((item: any) => ({
          id: item.id?.slice(-8),
          title: item.title?.substring(0, 20) || item.content?.substring(0, 20),
          _isDeleted: item._isDeleted,
          _deletedAt: item._deletedAt ? new Date(item._deletedAt).toLocaleString() : 'N/A'
        }))
      );
    }
    
    // ✅ Snapshot 模式：最简单的逻辑
    // 1. startDateTime 时刻存在的所有事件（基准状态）
    // 2. startDateTime 到 endDateTime 期间的所有操作（显示变化）
    if (dateRange) {
      const startTime = formatTimeForStorage(dateRange.start);
      const endTime = formatTimeForStorage(dateRange.end);
      
      // 1️⃣ 获取起点时刻的所有事件
      const existingAtStart = EventHistoryService.getExistingEventsAtTime(startTime);
      console.log('[PlanManager] 📊 Snapshot 时间范围:', {
        起点: new Date(startTime).toLocaleString(),
        终点: new Date(endTime).toLocaleString(),
        起点存在事件数: existingAtStart.size
      });
      
      // 2️⃣ 筛选出起点时存在的事件（未删除的）
      allItems = filteredItems.filter(item => existingAtStart.has(item.id));
      console.log('[PlanManager] ✅ 起点存在且未删除:', allItems.length, '个');
      
      // 3️⃣ 查询时间范围内的所有操作
      const operations = EventHistoryService.queryHistory({
        startTime,
        endTime
      });
      console.log('[PlanManager] 📝 时间范围内操作:', operations.length, '条');
      
      // 4️⃣ 添加范围内删除的事件为 ghost
      const deleteOpsInRange = operations.filter(op => op.operation === 'delete' && op.before && op.eventId);
      console.log('[PlanManager] 🗑️ 范围内删除操作:', deleteOpsInRange.length, '条');
      
      // ✅ 修改逻辑：显示"在起点存在 OR 在范围内创建"并且"在范围内被删除"的事件
      // 查找范围内创建的事件
      const createdInRange = new Set(
        operations
          .filter(op => op.operation === 'create' && op.eventId)
          .map(op => op.eventId)
      );
      console.log('[PlanManager] 🆕 范围内创建:', createdInRange.size, '个');
      
      // 过滤：在起点存在 OR 在范围内创建
      const deletedInRange = deleteOpsInRange.filter(op => 
        op.eventId && (existingAtStart.has(op.eventId) || createdInRange.has(op.eventId))
      );
      console.log('[PlanManager] 🎯 其中在起点存在或范围内创建的:', deletedInRange.length, '条');
      
      deletedInRange.forEach(log => {
        // 防御性检查：确保 log.eventId 和 log.before 存在
        if (!log.eventId || !log.before) {
          console.warn('[PlanManager] ⚠️ 跳过无效的删除记录:', log);
          return;
        }
        
        // 🎯 步骤 1: checkType 过滤（只排除明确为 'none' 的，undefined 视为历史数据保留）
        if (log.before.checkType === 'none') {
          console.log('[PlanManager] ⏭️ 跳过 checkType=none ghost:', log.eventId.slice(-8));
          return;
        }
        
        // 🎯 步骤 2: 业务类型过滤（空白事件）
        const hasContent = log.before.title || log.before.content || 
                          log.before.simpleTitle || log.before.fullTitle;
        if (!hasContent) {
          console.log('[PlanManager] ⏭️ 跳过空白 ghost:', log.eventId.slice(-8));
          return;
        }
        
        // 🎯 步骤 3: 系统事件过滤（使用严格比较 === true）
        if (log.before.isTimer === true || 
            log.before.isTimeLog === true || 
            log.before.isOutsideApp === true) {
          console.log('[PlanManager] ⏭️ 跳过系统事件 ghost:', log.eventId.slice(-8));
          return;
        }
        
        console.log('[PlanManager] 👻 添加 ghost:', {
          eventId: log.eventId.slice(-8),
          title: log.before.title,
          content: log.before.content,
          simpleTitle: log.before.simpleTitle,
          fullTitle: log.before.fullTitle,
          删除于: new Date(log.timestamp).toLocaleString(),
          before完整信息: log.before
        });
        allItems.push({
          ...log.before,
          _isDeleted: true,
          _deletedAt: log.timestamp
        } as any);
      });
      
      // 记录被跳过的删除操作
      const skippedDeletes = deleteOpsInRange.filter(op => 
        op.eventId && !existingAtStart.has(op.eventId) && !createdInRange.has(op.eventId)
      );
      if (skippedDeletes.length > 0) {
        console.log('[PlanManager] ⏭️ 跳过（不在起点也不在范围内创建）:', skippedDeletes.length, '条', 
          skippedDeletes.map(op => `${op.eventId?.slice(-8) || 'unknown'}-${op.before?.title?.substring(0, 15) || 'no title'}`));
      }
      
      console.log('[PlanManager] 📊 Snapshot 完成：最终', allItems.length, '个事件', `(${allItems.filter((i: any) => i._isDeleted).length} ghost)`);
    }
    
    // 排序确保新建行按期望顺序显示
    const result = allItems
      .filter(item => item.id) // 过滤掉无 id 的项
      .sort((a: any, b: any) => {
        const pa = (a as any).position ?? allItems.indexOf(a);
        const pb = (b as any).position ?? allItems.indexOf(b);
        return pa - pb;
      });
    
    // 🚨 DIAGNOSIS: 检测 editorItems 异常
    if (result.length === 0 && items.length > 0) {
      console.error('🔴 [诊断] editorItems 为空但 items 有数据！', {
        items数量: items.length,
        pendingEmptyItems数量: pendingEmptyItems.size,
        allItems数量: allItems.length,
        过滤后数量: result.length,
        items示例: items.slice(0, 3).map(i => ({ id: i.id, title: i.title?.substring(0, 20) }))
      });
    }
    
    return result;
  }, [items, pendingEmptyItems, dateRange]);

  // 🆕 状态配置映射函数
  const getStatusConfig = useCallback((status?: string) => {
    switch (status) {
      case 'new':
        return { label: 'New', color: '#3B82F6' };
      case 'done':
        return { label: 'Done', color: '#10B981' };
      case 'updated':
        return { label: 'Updated', color: '#F59E0B' };
      case 'missed':
        return { label: 'Missed', color: '#EF4444' };
      case 'deleted':
        return { label: 'Del', color: '#9CA3AF' };
      default:
        return null;
    }
  }, []);

  // 🆕 获取事件的所有状态（支持多状态）
  const getEventStatuses = useCallback((eventId: string): Array<'new' | 'updated' | 'done' | 'missed' | 'deleted'> => {
    if (!dateRange) return [];
    
    try {
      const startTime = formatTimeForStorage(dateRange.start);
      const endTime = formatTimeForStorage(dateRange.end);
      
      // 获取事件基本信息
      const event = EventService.getEventById(eventId);
      const eventTitle = event?.title?.substring(0, 15) || 'Unknown';
      
      // 🔍 检查事件的实际打勾状态
      const checkInStatus = EventService.getCheckInStatus(eventId);
      console.log(`[getEventStatuses] 🔍 ${eventTitle} 完整事件信息:`, {
        事件ID: eventId,
        标题: event?.title,
        isCompleted: event?.isCompleted, // 旧的完成状态字段
        checked数组: event?.checked,
        unchecked数组: event?.unchecked,
        已打勾: checkInStatus.isChecked,
        打勾次数: checkInStatus.checkInCount,
        取消次数: checkInStatus.uncheckCount,
        最后打勾时间: checkInStatus.lastCheckIn,
        最后取消时间: checkInStatus.lastUncheck
      });
      
      // 查询历史记录（已经按时间范围过滤）
      const history = EventHistoryService.queryHistory({ 
        eventId, 
        startTime, 
        endTime 
      });
      
      console.log(`[getEventStatuses] 📊 ${eventTitle} 历史记录 (${startTime} ~ ${endTime}):`, {
        历史记录数: history.length,
        记录详情: history.map(log => ({
          时间: log.timestamp,
          操作: log.operation,
          完整metadata: log.metadata, // 🔍 显示完整 metadata
          action: log.metadata?.action,
          changes: log.changes?.slice(0, 5) // 只显示前5个 changes，避免太长
        }))
      });
      
      if (!history || history.length === 0) {
        console.log(`[getEventStatuses] ❌ ${eventTitle}: 无历史记录`);
        return [];
      }
      
      // 收集所有独特的状态
      const statuses = new Set<'new' | 'updated' | 'done' | 'missed' | 'deleted'>();
      const rangeStart = new Date(startTime);
      const rangeEnd = new Date(endTime);
      
      // ✅ 使用 EventService.getCheckInStatus() 判断当前是否已勾选
      // 该方法内部已经合并并比较了 checked 和 unchecked 数组
      const checkStatus = EventService.getCheckInStatus(eventId);
      const isCurrentlyChecked = checkStatus.isChecked;
      
      console.log(`[getEventStatuses]   📌 ${eventTitle}: 勾选状态:`, {
        已勾选: isCurrentlyChecked,
        最后打勾: checkStatus.lastCheckIn,
        最后取消: checkStatus.lastUncheck
      });
      
      // 遍历历史记录（这些记录已经被 queryHistory 按时间范围过滤过了）
      history.forEach(log => {
        const logTime = new Date(log.timestamp);
        
        console.log(`[getEventStatuses]   - ${eventTitle}: ${log.operation} at ${log.timestamp}`, {
          在范围内: logTime >= rangeStart && logTime <= rangeEnd,
          action: log.metadata?.action
        });
        
        switch (log.operation) {
          case 'create':
            statuses.add('new');
            console.log(`[getEventStatuses]   ✅ ${eventTitle}: 添加 NEW 状态`);
            break;
          case 'update':
            statuses.add('updated');
            console.log(`[getEventStatuses]   ✅ ${eventTitle}: 添加 UPDATED 状态`);
            break;
          case 'delete':
            statuses.add('deleted');
            console.log(`[getEventStatuses]   ✅ ${eventTitle}: 添加 DELETED 状态`);
            break;
          case 'checkin':
            // 不在这里判断，等循环结束后根据最后一次操作判断
            break;
        }
      });
      
      // ✅ 根据当前勾选状态决定是否添加 Done 状态
      if (isCurrentlyChecked) {
        statuses.add('done');
        console.log(`[getEventStatuses]   ✅ ${eventTitle}: 添加 DONE 状态（当前已勾选）`);
      } else {
        console.log(`[getEventStatuses]   ⏭️ ${eventTitle}: 不添加 DONE（当前未勾选）`);
      }
      
      // 🔧 判断 "missed" 状态：事件时间已过（取当前时间和范围结束时间的较早者），且在范围内没有完成
      if (event && event.startTime) {
        const eventTime = new Date(event.startTime);
        const now = new Date();
        const cutoffTime = now < rangeEnd ? now : rangeEnd; // 取较早的时间点
        
        console.log(`[getEventStatuses]   🕐 ${eventTitle}: 检查 MISSED 状态`, {
          事件时间: event.startTime,
          当前时间: now.toISOString(),
          范围结束: endTime,
          判定截止时间: cutoffTime.toISOString(),
          事件已过期: eventTime < cutoffTime,
          已有DONE: statuses.has('done')
        });
        
        // 事件时间已过判定截止时间且没有 DONE 状态
        if (eventTime < cutoffTime && !statuses.has('done')) {
          statuses.add('missed');
          console.log(`[getEventStatuses]   ✅ ${eventTitle}: 添加 MISSED 状态（事件时间 < 判定截止时间，且未完成）`);
        } else {
          console.log(`[getEventStatuses]   ⏭️ ${eventTitle}: 不算 MISSED（事件未到期或已完成）`);
        }
      }
      
      const result = Array.from(statuses);
      console.log(`[getEventStatuses] ✅ ${eventTitle}: 最终状态 = ${JSON.stringify(result)}`);
      return result;
    } catch (error) {
      console.error('[getEventStatuses] ❌ 错误:', error);
      return [];
    }
  }, [dateRange]);

  // 🆕 计算状态竖线段 - 支持多状态显示
  const statusLineSegments = useMemo((): StatusLineSegment[] => {
    const segments: StatusLineSegment[] = [];
    
    console.log('[PlanManager] 📊 开始生成segments:', {
      dateRange: dateRange ? {
        start: formatTimeForStorage(dateRange.start),
        end: formatTimeForStorage(dateRange.end)
      } : null,
      editorItems数量: editorItems.length,
      前3个: editorItems.slice(0, 3).map((item, idx) => ({
        index: idx,
        id: item.id?.substring(0, 10),
        title: item.title?.substring(0, 20)
      }))
    });
    
    editorItems.forEach((item, index) => {
      if (!item.id) return;
      
      const eventStatuses = getEventStatuses(item.id);
      
      console.log(`[PlanManager] Event[${index}] ${item.title?.substring(0, 20)}: ${eventStatuses.length}个状态 ${JSON.stringify(eventStatuses)}`);
      
      // 为每个状态创建一个segment
      eventStatuses.forEach(status => {
        const statusConfig = getStatusConfig(status);
        if (statusConfig) {
          segments.push({
            startIndex: index,
            endIndex: index,
            status: status,
            label: statusConfig.label
          });
        }
      });
    });
    
    console.log('[PlanManager] 📊 生成segments详情:', {
      总数: segments.length,
      详细列表: segments.map(s => ({
        index: s.startIndex,
        status: s.status,
        label: s.label
      }))
    });
    
    return segments;
  }, [editorItems, getEventStatuses, getStatusConfig, dateRange]);

  // 处理编辑器内容变化
  const handleLinesChange = (newLines: FreeFormLine<Event>[]) => {
    // 🔧 性能优化：只更新真正变化的 item
    const changedItems: Event[] = [];
    const unchangedItemIds = new Set<string>();
    
    // 记录新顺序中每个 title 行的 itemId 顺序
    const orderedItemIds: string[] = [];

    // 按 item id 分组（title + description），同时保留顺序
    const itemGroups = new Map<string, { title?: FreeFormLine<Event>, description?: FreeFormLine<Event> }>();

    newLines.forEach((line) => {
      if (!line.id) return;
      const itemId = line.id.includes('-desc') ? line.id.replace('-desc', '') : line.id;
      const isDescription = line.id.includes('-desc') || (line.data as any)?.mode === 'eventlog';

      if (!itemGroups.has(itemId)) {
        itemGroups.set(itemId, {});
        // 第一次遇到某个 itemId 的 title 行时，记录其顺序
        if (!isDescription) orderedItemIds.push(itemId);
      }

      const group = itemGroups.get(itemId)!;
      if (isDescription) {
        group.description = line;
      } else {
        group.title = line;
      }
    });

    // 删除检测：找出被移除的标题行对应的 itemId
    const currentItemIds = items.map(i => i.id);
    const pendingItemIds = Array.from(pendingEmptyItems.keys());
    const allCurrentIds = [...currentItemIds, ...pendingItemIds];
    
    const newItemIds = Array.from(itemGroups.keys());
    const deletedIds = allCurrentIds.filter(id => !newItemIds.includes(id));
    
    deletedIds.forEach(id => {
      // 从 pendingEmptyItems 中移除
      setPendingEmptyItems(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      // 如果在 items 中，也调用 onDelete
      if (currentItemIds.includes(id)) {
        onDelete(id);
      }
    });

    // 保存/更新每个 item（带 position）
    itemGroups.forEach((group, itemId) => {
      const titleLine = group.title;
      const descLine = group.description;
      if (!titleLine) return;

      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = titleLine.content;
      const tagElements = tempDiv.querySelectorAll('.inline-tag');
      const extractedTags: string[] = [];
      tagElements.forEach(tagEl => {
        const tagId = tagEl.getAttribute('data-tag-id');
        if (tagId) extractedTags.push(tagId);
        tagEl.remove();
      });
      const plainText = tempDiv.textContent || '';

      // 计算 position（按本次 newLines 的顺序）
      const position = orderedItemIds.indexOf(itemId);

      if (titleLine.data) {
        // 更新现有item
        const hasContent = plainText.trim() || descLine?.content?.trim();
        
        const updatedItem: Event = {
          ...(titleLine.data as any),
          id: (titleLine.data as any)?.id ?? itemId,
          title: hasContent ? plainText : '', // 保持空标题检查
          content: titleLine.content,
          tags: extractedTags,
          level: titleLine.level,
          mode: (descLine ? 'description' : 'title') as 'title' | 'description',
          description: descLine?.content || undefined,
          ...(Number.isFinite(position) ? { position } : {}),
        } as any;
        
        // 🔧 变更检测：只更新真正变化的字段
        const existingItem = itemsMap[itemId];
        const isContentChanged = !existingItem || 
          existingItem.title !== updatedItem.title ||
          existingItem.content !== updatedItem.content ||
          existingItem.description !== updatedItem.description ||
          existingItem.mode !== updatedItem.mode ||
          JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);
        
        // ✅ position 变化时也需要保存（自动被 EventHistoryService 忽略）
        const isPositionChanged = existingItem && (existingItem as any).position !== (updatedItem as any).position;
        
        if (isContentChanged || isPositionChanged) {
          changedItems.push(updatedItem);
        } else {
          unchangedItemIds.add(itemId);
        }
        
        // 🆕 如果这是一个之前为空、现在有内容的item
        const wasPending = pendingEmptyItems.has(itemId);
        if (wasPending && hasContent) {
          // 从 pendingEmptyItems 移除
          setPendingEmptyItems(prev => {
            const next = new Map(prev);
            next.delete(itemId);
            return next;
          });
        } else if (wasPending && !hasContent) {
          // 还是空的，保持在 pendingEmptyItems
          setPendingEmptyItems(prev => new Map(prev).set(itemId, updatedItem));
        }
      } else {
        // 🔧 新行：可能是空行（刚点击graytext）或有内容的新item
        const hasContent = plainText.trim() || descLine?.content?.trim();
        const wasPending = pendingEmptyItems.has(titleLine.id);
        
        const now = new Date();
        const nowISO = formatTimeForStorage(now);
        
        const newItem: Event = {
          id: titleLine.id,
          title: hasContent ? (plainText || '(无标题)') : '', // 空行保持空标题
          content: titleLine.content,
          tags: extractedTags,
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
          level: titleLine.level,
          mode: descLine ? 'description' : 'title',
          description: descLine?.content || undefined,
          ...(Number.isFinite(position) ? { position } : {}),
          // 🆕 Plan 页面创建的 item 配置：
          isPlan: true, // ✅ 显示在 Plan 页面
          isTask: true, // ✅ 标记为待办事项
          isTimeCalendar: false, // ✅ 不是 TimeCalendar 创建的事件
          remarkableSource: true, // ✅ 标识事件来源（用于同步识别）
          // ✅ 默认不设置时间，用户通过 FloatingBar 或 @chrono 自行定义
          startTime: '', // ✅ 空字符串表示无时间
          endTime: '',   // ✅ 空字符串表示无时间
          dueDate: undefined, // ✅ 不预设截止日期
          isAllDay: false,
          createdAt: nowISO, // ✅ 使用 timeUtils 格式化，避免时区问题
          updatedAt: nowISO,
          source: 'local',
          syncStatus: 'local-only',
        } as any;
        
        // 🔧 新建 item 也加入 changedItems
        changedItems.push(newItem);
        
        if (wasPending && hasContent) {
          // 🔥 从 pending 转为正式：移除 pending，添加到 changedItems
          setPendingEmptyItems(prev => {
            const next = new Map(prev);
            next.delete(titleLine.id);
            return next;
          });
          dbg('plan', '✅ 空行有内容，从 pending 转为正式事件', { id: titleLine.id, title: newItem.title?.substring(0, 20) });
        } else if (wasPending && !hasContent) {
          // 🔧 仍然是空行：更新 pending 中的数据但不转为正式
          setPendingEmptyItems(prev => new Map(prev).set(titleLine.id, newItem));
          dbg('plan', '📝 更新空行 pending 数据', { id: titleLine.id });
        } else if (!wasPending && hasContent) {
          // 🆕 直接创建有内容的新 item（比如粘贴文本）
          dbg('plan', '🚀 直接创建有内容的新事件', { id: titleLine.id, title: newItem.title?.substring(0, 20) });
        } else {
          // ⚠️ 这种情况理论上不应该发生，因为用户激活时已经创建了 pending
          dbg('plan', '⚠️ 意外情况：新空行但未在 pending 中', { id: titleLine.id });
          setPendingEmptyItems(prev => new Map(prev).set(titleLine.id, newItem));
        }
      }
    });
    
    // 🔧 批量更新：只更新真正变化的 item
    if (changedItems.length > 0) {
      // 🔥 [FIX] 立即更新本地 items 状态，避免时间插入时找不到事件
      const newItems = changedItems.filter(item => !items.some(existing => existing.id === item.id));
      if (newItems.length > 0) {
        setItems(prev => [...prev, ...newItems]);
        dbg('plan', '🆕 立即添加新事件到本地状态', { newItemIds: newItems.map(i => i.id) });
      }
      
      // 批量保存
      changedItems.forEach(item => {
        onSave(item);
      });
      
      // 批量同步到日历
      changedItems.forEach(item => {
        syncToUnifiedTimeline(item);
      });
    }
  };

  // 将 Event 转换为 Event（用于 EventEditModal）
  const convertPlanItemToEvent = (item: Event): Event => {
    // 清理描述中的内联HTML（如标签/日期）
    const sanitize = (html?: string): string => {
      if (!html) return '';
      const div = document.createElement('div');
      div.innerHTML = html;
      div.querySelectorAll('.inline-tag, .inline-date').forEach(el => el.remove());
      return div.textContent || '';
    };
    const mappedTags = (item.tags || []).map(t => {
      const tag = TagService.getFlatTags().find(x => x.id === t || x.name === t);
      return tag ? tag.id : t;
    });
    
    // 🆕 v1.8: 从标签中提取 calendarIds
    const calendarIds = mappedTags
      .map((tagId: string) => {
        const tag = TagService.getFlatTags().find(t => t.id === tagId);
        return tag?.calendarMapping?.calendarId;
      })
      .filter((id: string | undefined): id is string => !!id);
    
    return {
      id: item.id || `event-${Date.now()}`,
      title: item.title,
      description: item.notes || sanitize(item.description || item.content || ''),
      startTime: item.startTime || item.dueDate || '', // 🔧 没有时间的任务保持为空字符串
      endTime: item.endTime || item.dueDate || '', // 🔧 没有时间的任务保持为空字符串
      location: '', // Event 没有 location 字段，保留空值
      isAllDay: !item.startTime && !!item.dueDate,
      tags: mappedTags,
      calendarIds: item.calendarIds || (calendarIds.length > 0 ? calendarIds : undefined), // 🔧 优先保留已有值，否则使用标签映射
      todoListIds: item.todoListIds, // 🔧 保留 To Do Lists 映射
      source: 'local',
      syncStatus: calendarIds.length > 0 ? 'pending' : 'local-only', // 🆕 v1.8: 根据日历映射设置同步状态
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date()),
      remarkableSource: true,
    };
  };

  // 将 HTML 内容清洗为纯文本（移除标签/日期等内联元素的HTML）
  const sanitizeHtmlToPlainText = (html?: string): string => {
    if (!html) return '';
    const container = document.createElement('div');
    container.innerHTML = html;
    // 移除我们内联的标签/日期标记，保留其文本（若有）
    container.querySelectorAll('.inline-tag, .inline-date').forEach(el => el.remove());
    return container.textContent || '';
  };

  // 同步到UnifiedTimeline
  const syncToUnifiedTimeline = (item: Event) => {
    // 🔍 诊断：强制输出日志（不经过 dbg 检查）
    console.log('%c[🔴 SYNC] syncToUnifiedTimeline 被调用', 'color: red; font-size: 16px; font-weight: bold', {
      itemId: item.id,
      eventId: item.id,
      startTime: item.startTime,
      endTime: item.endTime,
      dueDate: item.dueDate,
      调用栈: new Error().stack?.split('\n').slice(1, 5).join('\n')
    });
    
    // � 使用统一时间管理接口
    const eventTime = getEventTime(item.id, {
      start: item.startTime || null,
      end: item.endTime || null,
      dueDate: item.dueDate || null,
      isAllDay: item.isAllDay,
      timeSpec: (item as any).timeSpec,
    });
    
    const finalStartTime = eventTime.start || '';
    const finalEndTime = eventTime.end || '';
    const isTask = isTaskByTime(eventTime);

    // 🆕 v1.8: 根据标签映射到日历分组
    const tagIds = (item.tags || []).map(t => {
      // 如果是有效的ID，直接返回；否则尝试按名称映射
      const tag = TagService.getFlatTags().find(x => x.id === t || x.name === t);
      return tag ? tag.id : t;
    });
    
    // 从标签中提取 calendarIds
    const calendarIds = tagIds
      .map(tagId => {
        const tag = TagService.getFlatTags().find(t => t.id === tagId);
        return tag?.calendarMapping?.calendarId;
      })
      .filter((id): id is string => !!id); // 过滤掉 undefined
    
    console.log('[syncToUnifiedTimeline] 标签到日历映射:', {
      itemId: item.id,
      tags: tagIds,
      calendarIds,
      hasCalendarMapping: calendarIds.length > 0
    });
    
    const event: Event = {
      id: item.id || `event-${Date.now()}`,
      title: `${item.emoji || ''}${item.title}`.trim(),
      // 避免在描述中出现一堆 HTML，将其清洗为纯文本
      description: sanitizeHtmlToPlainText(item.description || item.content || item.notes || ''),
      // ✅ v1.8: 修复空字符串处理 - 转换为 undefined
      startTime: finalStartTime || undefined,
      endTime: finalEndTime || undefined,
      // 全天：显式勾选优先；否则当起止为同一天且均为 00:00 视为全天
      isAllDay: (() => {
        if (item.isAllDay) return true;
        if (finalStartTime && finalEndTime) {
          // parseLocalTimeString 已在文件顶部导入
          const s = parseLocalTimeString(finalStartTime);
          const e = parseLocalTimeString(finalEndTime);
          const bothMidnight = s.getHours() === 0 && s.getMinutes() === 0 && e.getHours() === 0 && e.getMinutes() === 0;
          const sameDay = s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
          return bothMidnight && sameDay;
        }
        return false;
      })(),
      tags: tagIds,
      calendarIds: calendarIds.length > 0 ? calendarIds : item.calendarIds, // 🆕 v1.8: 优先使用标签映射，否则保留原有值
      todoListIds: item.todoListIds, // 🔧 保留 To Do Lists 映射
      source: 'local',
      syncStatus: calendarIds.length > 0 ? 'pending' : 'local-only', // 🆕 v1.8: 有日历映射时标记为待同步（但不立即同步，由 ActionBasedSyncManager 统一处理）
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date()),
      isTask: isTask,
      checkType: item.checkType || 'once', // 🆕 Plan事件默认有checkbox
      remarkableSource: true,
    };

    console.log('[syncToUnifiedTimeline] 准备保存事件到 EventService:', {
      eventId: event.id,
      title: event.title,
      calendarIds: event.calendarIds,
      todoListIds: event.todoListIds, // 🔍 添加 todoListIds 调试
      syncStatus: event.syncStatus,
      willTriggerSync: event.syncStatus === 'pending'
    });

    // 检查事件是否已存在于 EventService，决定调用 create 还是 update
    const existingEvent = EventService.getEventById(event.id);
    
    if (existingEvent) {
      // 事件已存在 → 更新
      if (onUpdateEvent) {
        onUpdateEvent(event.id, event);
      }
    } else {
      // 事件不存在 → 创建
      if (onCreateEvent) {
        onCreateEvent(event);
      }
    }
  };

  const getTypeIcon = (item: Event) => {
    // 根据时间字段判断图标
    const hasStart = !!item.startTime;
    const hasEnd = !!item.endTime;
    
    if (item.isAllDay || (hasStart && hasEnd)) {
      return '📅'; // event
    } else if (hasStart || hasEnd || item.dueDate) {
      return '📋'; // task
    }
    return ''; // 无时间
  };

  // 🔄 v2.8.3: 渲染逻辑已迁移到 UnifiedSlateEditor 内部
  // PlanManager 不再直接渲染 Checkbox、Emoji、TimeDisplay 等
  // 这些渲染由 EventLinePrefix 和 EventLineSuffix 组件处理

  // 渲染内容样式（不需要自己实现 contentEditable，只提供样式）
  const getContentStyle = (item: Event) => ({
    color: item.color || '#111827',
    textDecoration: item.isCompleted ? 'line-through' : 'none',
    opacity: item.isCompleted ? 0.6 : 1,
  });

  return (
    <div className="plan-manager-container">
      {/* 左侧面板 - 内容选取 */}
      <ContentSelectionPanel
        dateRange={dateRange}
        snapshot={generateEventSnapshot()}
        tags={TagService.getFlatTags()}
        hiddenTags={hiddenTags}
        onFilterChange={(filter) => {
          setActiveFilter(filter);
          console.log('[PlanManager] 切换过滤模式:', filter);
        }}
        onSearchChange={(query) => {
          setSearchQuery(query);
          console.log('[PlanManager] 搜索查询:', query);
        }}
        onDateSelect={(date) => {
          // 选择单个日期时，设置为该日期的范围
          const dayStart = new Date(date);
          dayStart.setHours(0, 0, 0, 0);
          const dayEnd = new Date(date);
          dayEnd.setHours(23, 59, 59, 999);
          setDateRange({ start: dayStart, end: dayEnd });
          console.log('[PlanManager] 选择日期:', date);
        }}
        onDateRangeChange={(start, end) => {
          // 标准化时间：start 设为 00:00:00，end 设为 23:59:59
          const normalizedStart = new Date(start);
          normalizedStart.setHours(0, 0, 0, 0);
          const normalizedEnd = new Date(end);
          normalizedEnd.setHours(23, 59, 59, 999);
          setDateRange({ start: normalizedStart, end: normalizedEnd });
          console.log('[PlanManager] 日期范围变更:', { start: normalizedStart, end: normalizedEnd });
        }}
        onTagVisibilityChange={(tagId, visible) => {
          setHiddenTags(prev => {
            const next = new Set(prev);
            if (visible) {
              next.delete(tagId);
            } else {
              next.add(tagId);
            }
            return next;
          });
          console.log('[PlanManager] 标签可见性变更:', { tagId, visible });
        }}
      />

      {/* 中间主内容区 - 计划清单 */}
      <div className="plan-manager">
        {/* 内联样式 */}
        <style>{`
          .plan-list-scroll-container {
            flex: 1;
            overflow-y: auto;
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE/Edge */
            min-height: 0;
            padding: 0;
          }
          
          .plan-list-scroll-container::-webkit-scrollbar {
            display: none; /* Chrome/Safari/Opera */
          }
        `}</style>

      <div className="section-header">
        <div className="title-indicator"></div>
        <h3>计划清单</h3>
      </div>

      <div className="plan-list-scroll-container" ref={editorContainerRef}>
        <StatusLineContainer 
          segments={statusLineSegments}
          editorItems={editorItems}
          lineHeight={32}
          totalLines={editorItems.length}
        >
          <UnifiedSlateEditor
            key={dateRange ? `snapshot-${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'normal'}
            items={editorItems}
            onChange={debouncedOnChange}
            getEventStatus={getEventStatus}
          onFocus={(lineId) => {
            // ✅ 重构: 直接从 lineId 判断模式
            setCurrentFocusedLineId(lineId);
            const isDescMode = lineId.includes('-desc');
            setCurrentFocusedMode(isDescMode ? 'description' : 'title');
            
            // 查找 item 更新 isTask
            const baseId = lineId.replace('-desc', '');
            const matchedItem = editorItems.find(item => item.id === baseId);
            if (matchedItem) {
              setCurrentIsTask(matchedItem.isTask || false);
            } else {
              // 🆕 用户激活新行时，立即创建 pendingEmptyItems
              const existsInPending = pendingEmptyItems.has(baseId);
              const existsInItems = items.some(item => item.id === baseId);
              
              if (!existsInPending && !existsInItems) {
                const now = new Date();
                const nowISO = formatTimeForStorage(now);
                
                const newPendingItem: Event = {
                  id: baseId,
                  title: '',
                  content: '',
                  description: '',
                  tags: [],
                  level: 0,
                  priority: 'medium',
                  isCompleted: false,
                  type: 'todo',
                  isPlan: true,
                  isTask: true,
                  isTimeCalendar: false,
                  remarkableSource: true,
                  startTime: '',
                  endTime: '',
                  isAllDay: false,
                  createdAt: nowISO,
                  updatedAt: nowISO,
                  source: 'local',
                  syncStatus: 'local-only',
                } as Event;
                
                setPendingEmptyItems(prev => new Map(prev).set(baseId, newPendingItem));
                dbg('plan', '🆕 用户激活新行，创建 pendingEmptyItems', { lineId: baseId });
              }
              setCurrentIsTask(false);
            }
          }}
          onEditorReady={(editorApi) => {
            // 🆕 保存完整的 UnifiedSlateEditor API
            (unifiedEditorRef as any).editorApi = editorApi;
            unifiedEditorRef.current = editorApi.getEditor();
          }}
          onDeleteRequest={(lineId) => {
            // 🆕 v1.6: 使用统一删除接口
            deleteItems([lineId.replace('-desc', '')], 'user-backspace-delete');
          }}
          onSave={(eventId, updates) => {
            // 🆕 保存事件更新
            const existingEvent = EventService.getEventById(eventId);
            if (existingEvent) {
              const updatedEvent = { ...existingEvent, ...updates };
              if (onUpdateEvent) {
                onUpdateEvent(eventId, updatedEvent);
              }
            }
          }}
          onTimeClick={(eventId, anchor) => {
            // 🆕 时间点击 - 打开 UnifiedDateTimePicker
            dbg('ui', '🖱️ 点击右侧时间区域，打开 UnifiedDateTimePicker', { eventId });
            dateAnchorRef.current = anchor;
            pickerTargetItemIdRef.current = eventId;
            setShowUnifiedPicker(true);
          }}
          onMoreClick={(eventId) => {
            // 🆕 More 图标点击 - 打开 EventEditModal
            const item = editorItems.find(i => i.id === eventId);
            if (item) {
              setSelectedItemId(eventId);
              setEditingItem(item);
            }
          }}
        />
        </StatusLineContainer>
      </div>

      {/* 右侧编辑面板 - 使用 EventEditModalV2 */}
      {selectedItemId && editingItem && (
        <EventEditModalV2
          event={convertPlanItemToEvent(editingItem)}
          isOpen={true}
          onClose={() => {
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          onSave={(updatedEvent) => {
            // 🔍 调试：检查 todoListIds 是否被正确传递
            console.log('🔍 [PlanManager] EventEditModalV2 onSave:', {
              updatedEvent_todoListIds: updatedEvent.todoListIds,
              updatedEvent_calendarIds: updatedEvent.calendarIds,
              editingItem_todoListIds: editingItem.todoListIds,
              editingItem_id: editingItem.id
            });
            
            // 更新 Event
            const updatedPlanItem: Event = {
              ...editingItem,
              ...updatedEvent, // 直接合并所有字段
              content: updatedEvent.description || editingItem.content,
            };
            
            console.log('🔍 [PlanManager] 合并后的 updatedPlanItem:', {
              id: updatedPlanItem.id,
              todoListIds: updatedPlanItem.todoListIds,
              calendarIds: updatedPlanItem.calendarIds
            });
            
            onSave(updatedPlanItem);
            syncToUnifiedTimeline(updatedPlanItem);
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          onDelete={(eventId) => {
            deleteItems([editingItem.id], 'user-manual-delete');
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          hierarchicalTags={existingTags}
          globalTimer={null} // PlanManager 不使用 Timer
        />
      )}

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="plan-picker-modal" onClick={() => setShowEmojiPicker(false)}>
          <div onClick={(e) => e.stopPropagation()}>
            <Picker
              data={data}
              onEmojiSelect={(emoji: any) => {
                if (editingItem) {
                  setEditingItem({ ...editingItem, emoji: emoji.native });
                }
                setShowEmojiPicker(false);
              }}
              locale="zh"
            />
          </div>
        </div>
      )}

      {/* Headless FloatingToolbar V3 - 支持双模式 */}
      <HeadlessFloatingToolbar
        position={floatingToolbar.position}
        mode={floatingToolbar.mode}
        config={toolbarConfig}
        activePickerIndex={activePickerIndex}
        onActivePickerIndexConsumed={() => setActivePickerIndex(null)} // 🔑 立即重置
        onSubPickerStateChange={(isOpen) => setIsSubPickerOpen(isOpen)} // 🔑 追踪子选择器状态
        eventId={currentFocusedLineId ? (() => {
          const actualItemId = currentFocusedLineId.replace('-desc','');
          // 🔧 [FIX] 先在 items 中查找，再检查 pendingEmptyItems
          const item = items.find(i => i.id === actualItemId) || pendingEmptyItems.get(actualItemId);
          return item?.id;
        })() : undefined}
        useTimeHub={true}
        editorMode={currentFocusedMode === 'description' ? 'eventlog' : currentFocusedMode}
        slateEditorRef={unifiedEditorRef}
        onRequestClose={() => {
          // 🆕 Picker 关闭时自动关闭整个 FloatingBar
          console.log('%c[PlanManager] onRequestClose 被调用', 'background: #E91E63; color: white;');
          setActivePickerIndex(null); // 🔧 重置 activePickerIndex
          floatingToolbar.hideToolbar();
        }}
        onTimeApplied={async (startIso, endIso) => {
          dbg('picker', '📌 HeadlessFloatingToolbar.onTimeApplied 被调用', { 
            startIso, 
            endIso, 
            focusedLineId: currentFocusedLineId,
            对应的eventId: currentFocusedLineId ? (() => {
              const actualItemId = currentFocusedLineId.replace('-desc','');
              const item = items.find(i => i.id === actualItemId) || pendingEmptyItems.get(actualItemId);
              return item?.id;
            })() : undefined
          });
          
          const targetId = currentFocusedLineId || '';
          if (!targetId) {
            warn('picker', '⚠️ onTimeApplied: 没有 focusedLineId，跳过');
            return;
          }
          
          const actualItemId = targetId.replace('-desc','');
          let item = items.find(i => i.id === actualItemId);

          // 🔧 [FIX] 如果在 items 中找不到，检查 pendingEmptyItems（新创建的事件）
          if (!item) {
            item = pendingEmptyItems.get(actualItemId);
            if (item) {
              dbg('picker', '✅ 在 pendingEmptyItems 中找到新创建的事件', { actualItemId, itemTitle: item.title });
            }
          }

          if (!item) {
            warn('picker', '⚠️ onTimeApplied: 找不到对应的 item', { 
              targetId, 
              actualItemId, 
              itemsCount: items.length, 
              pendingCount: pendingEmptyItems.size,
              availableItemIds: items.slice(0, 5).map(i => i.id), // 显示前5个ID用于调试
              availablePendingIds: Array.from(pendingEmptyItems.keys()).slice(0, 5)
            });
            return;
          }

          try {
            // 🎯 使用统一时间管理接口
            // 🔧 v2.9: 不要用 endIso || startIso，允许 undefined
            const updatedTime = await setEventTime(item.id, {
              start: startIso,
              end: endIso,  // ✅ 允许 undefined
              isAllDay: false,
            });
            
            dbg('picker', '✅ 时间更新成功（TimeHub + EventService 已同步）', { 
              eventId: item.id,
              ...updatedTime,
            });
            
            // 🔧 v2.9: TimeHub 已经更新了 EventService，不需要再次调用 onSave
            // 只需要触发 Slate 同步即可
            // 🆕 更新 item 的时间字段（保持 metadata 同步）
            const updatedItem: Event = {
              ...item,
              startTime: updatedTime.start || undefined,
              endTime: updatedTime.end || undefined,  // ✅ 允许 undefined
              isAllDay: updatedTime.isAllDay,
              timeSpec: updatedTime.timeSpec,
            } as Event;
            
            // 🔧 v2.9: 不调用 onSave，避免重复更新 EventService
            // TimeHub.setEventTime 已经调用了 EventService.updateEvent
            // 只需要触发 Slate 重新渲染（通过 eventsUpdated 事件已自动触发）
            
            // 同步到日历（如果有时间）
            if (updatedTime.start) {
              syncToUnifiedTimeline(updatedItem);
            }
          } catch (err) {
            error('picker', '❌ 时间更新失败', { error: err });
          }
        }}
        onTextFormat={handleTextFormat}
        onTagSelect={(tagIds: string[]) => {
          // 🔧 v2.10: TagPicker 已通过 slateEditorRef 直接插入标签
          // 这里只需要更新 selectedTags 状态即可
          console.log('[PlanManager] onTagSelect 被调用（仅更新状态）', { tagIds });
          
          currentSelectedTagsRef.current = tagIds;
          setCurrentSelectedTags(tagIds);
        }}
        onEmojiSelect={(emoji: string) => {
          // 🆕 使用 UnifiedSlateEditor 的 helper 函数
          const editor = unifiedEditorRef.current;
          const editorApi = (unifiedEditorRef as any).editorApi;
          if (!editor || !editorApi || !currentFocusedLineId) return;
          
          const success = insertEmoji(editor, emoji);
          if (success) {
            console.log(`[✅ Emoji 插入成功] ${emoji}`);
            // 🔥 立即保存变更
            setTimeout(() => editorApi.flushPendingChanges(), 100);
          }
        }}
        onDateRangeSelect={(start: Date, end: Date) => {
          // 🆕 使用 UnifiedSlateEditor 的 helper 函数插入 DateMention
          const editor = unifiedEditorRef.current;
          const editorApi = (unifiedEditorRef as any).editorApi;
          if (!editor || !editorApi || !currentFocusedLineId) {
            console.warn('[onDateRangeSelect] 没有编辑器或焦点行');
            return;
          }
          
          const actualItemId = currentFocusedLineId.replace('-desc', '');
          const item = items.find(i => i.id === actualItemId);
          if (!item) {
            console.warn('[onDateRangeSelect] 找不到对应的 item');
            return;
          }
          
          const isDescriptionMode = currentFocusedMode === 'description';
          const startIso = formatTimeForStorage(start);
          const endIso = end && end.getTime() !== start.getTime() ? formatTimeForStorage(end) : undefined;
          
          // 使用 helper 函数插入 DateMention（传入 eventId 用于 TimeHub 同步）
          const success = insertDateMention(
            editor,
            startIso,
            endIso,
            isDescriptionMode,
            item.id  // 🔥 传入 eventId，让 DateMention 能通过 TimeHub 同步
          );
          
          if (success) {
            console.log(`[✅ DateMention 插入成功] ${item.id}`);
            // 🔥 立即保存变更
            setTimeout(() => editorApi.flushPendingChanges(), 100);
          }
        }}
        onPrioritySelect={(priority: 'low' | 'medium' | 'high' | 'urgent') => {
          // TODO: 应用优先级到当前选中的项目
        }}
        onColorSelect={(color: string) => {
          // TODO: 应用颜色到当前选中的项目
        }}
        availableTags={existingTags}
        currentTags={currentSelectedTags}
        currentIsTask={currentIsTask}
        onTaskToggle={(isTask: boolean) => {
          // 🆕 切换任务状态
          if (currentFocusedLineId && currentFocusedMode === 'title') {
            const actualItemId = currentFocusedLineId.replace('-desc', '');
            const item = items.find(i => i.id === actualItemId);
            if (item) {
              const updatedItem: Event = {
                ...item,
                isTask,
              };
              onSave(updatedItem);
              setCurrentIsTask(isTask); // 更新本地状态
            }
          }
        }}
      />
      
      {/* 统一日期时间选择器 - 键盘快捷键 Ctrl+; 呼出 */}
      {dateAnchorRef.current && (
        <Tippy
          visible={showUnifiedPicker}
          reference={dateAnchorRef.current}
          getReferenceClientRect={() => {
            if (caretRectRef.current) return caretRectRef.current;
            try {
              return dateAnchorRef.current?.getBoundingClientRect?.() || new DOMRect(0, 0, 0, 0);
            } catch {
              return new DOMRect(0, 0, 0, 0);
            }
          }}
          placement="bottom-start"
          interactive={true}
          arrow={false}
          offset={[0, 8]}
          appendTo={() => document.body}
          maxWidth="none"
          className="unified-picker-tippy"
          popperOptions={{ modifiers: [{ name: 'hide', enabled: false }] }}
          theme="light"
          onClickOutside={() => {
            setShowUnifiedPicker(false);
            if (dateAnchorRef.current) {
              const el = dateAnchorRef.current;
              if (el.classList && el.classList.contains('temp-picker-anchor')) {
                el.remove();
              }
              dateAnchorRef.current = null;
            }
            caretRectRef.current = null;
          }}
          content={
            <div style={{ padding: 0 }}>
              <UnifiedDateTimePicker
                eventId={(() => {
                  const targetId = (pickerTargetItemIdRef.current || currentFocusedLineId || '').replace('-desc','');
                  if (!targetId) return undefined;
                  // 🔧 [FIX] 先在 items 中查找，再检查 pendingEmptyItems
                  const item = items.find(i => i.id === targetId) || pendingEmptyItems.get(targetId);
                  return item?.id;
                })()}
                useTimeHub={true}
                initialStart={(items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId || '').replace('-desc',''))?.startTime) || undefined}
                initialEnd={(items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId || '').replace('-desc',''))?.endTime) || undefined}
                onApplied={async () => {
                  const targetId = pickerTargetItemIdRef.current || currentFocusedLineId || '';
                  if (!targetId) return;
                  const item = items.find(i => i.id === targetId || i.id === targetId.replace('-desc',''));
                  const editableElement = document.querySelector(
                    `[data-line-id="${targetId}"] .ProseMirror`
                  ) as HTMLElement | null;
                  const isDescriptionMode = currentFocusedMode === 'description';

                  // ✅ 修复：从 TimeHub 读取最新时间，而不是使用旧的 item 数据
                  if (item) {
                    // 从 TimeHub 获取最新时间
                    const { TimeHub } = await import('../services/TimeHub');
                    const timeSnapshot = TimeHub.getSnapshot(item.id);
                    
                    dbg('ui', '📝 UnifiedDateTimePicker.onApplied - 从 TimeHub 读取最新时间', {
                      itemId: item.id,
                      旧数据: { start: item.startTime, end: item.endTime },
                      TimeHub快照: timeSnapshot,
                    });
                    
                    const updatedItem: Event = {
                      ...item,
                      // ✅ 使用 TimeHub 的最新时间
                      startTime: timeSnapshot?.start || item.startTime,
                      endTime: timeSnapshot?.end || item.endTime,
                      isAllDay: timeSnapshot?.timeSpec?.allDay ?? item.isAllDay,
                      ...(isDescriptionMode
                        ? { description: editableElement?.innerHTML || item.description }
                        : { content: editableElement?.innerHTML || item.content }
                      ),
                    };
                    
                    // 保留 timeSpec
                    if (timeSnapshot?.timeSpec) {
                      (updatedItem as any).timeSpec = timeSnapshot.timeSpec;
                    }
                    
                    dbg('ui', '💾 保存更新后的事件', {
                      itemId: updatedItem.id,
                      最终保存的时间: { start: updatedItem.startTime, end: updatedItem.endTime },
                    });
                    
                    onSave(updatedItem);
                    syncToUnifiedTimeline(updatedItem);
                  }
                }}
                onClose={() => {
                  setShowUnifiedPicker(false);
                  if (dateAnchorRef.current) {
                    const el = dateAnchorRef.current;
                    if (el.classList && el.classList.contains('temp-picker-anchor')) {
                      el.remove();
                    }
                    dateAnchorRef.current = null;
                  }
                  caretRectRef.current = null;
                  pickerTargetItemIdRef.current = null;
                }}
              />
            </div>
          }
        />
      )}
      
      {/* 标签替换弹窗 - 点击标签时显示 */}
      {replacingTagElement && (
        <Tippy
          visible={showTagReplace}
          reference={replacingTagElement}
          placement="bottom"
          interactive={true}
          arrow={false}
          offset={[0, 8]}
          appendTo={() => document.body}
          theme="light"
          onClickOutside={() => {
            setShowTagReplace(false);
            setReplacingTagElement(null);
          }}
          content={
            <div
              style={{
                  // 仅保存当前编辑的HTML，时间由 TimeHub 已更新（不插入 📅 mention）
                overflow: 'auto',
              }}
            >
              <div style={{ padding: '8px 12px', fontSize: '13px', color: '#6b7280', borderBottom: '1px solid #e5e7eb' }}>
                选择新标签替换
              </div>
              {existingTags.map((tag) => {
                const tagColor = tag.color || '#666';
                const tagEmoji = tag.emoji || '';
                const displayName = tagEmoji ? `${tagEmoji}${tag.name}` : tag.name;
                
                const hexToRgba = (hex: string, alpha: number) => {
                  const r = parseInt(hex.slice(1, 3), 16);
                  const g = parseInt(hex.slice(3, 5), 16);
                  const b = parseInt(hex.slice(5, 7), 16);
                  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                };
                
                return (
                  <div
                    key={tag.id}
                    onClick={() => {
                      // 替换标签
                      const item = items.find(i => i.id === currentFocusedLineId);
                      const editableElement = document.querySelector(
                        `[data-line-id="${currentFocusedLineId}"] .ProseMirror`
                      ) as HTMLElement;
                      
                      if (editableElement && editableElement.isContentEditable) {
                        // 更新标签元素的属性和样式
                        replacingTagElement.setAttribute('data-tag-id', tag.id);
                        replacingTagElement.setAttribute('data-tag-name', tag.name);
                        replacingTagElement.style.backgroundColor = hexToRgba(tagColor, 0.15);
                        replacingTagElement.style.color = tagColor;
                        replacingTagElement.textContent = `#${displayName}`;
                        
                        // 保存更新
                        const updatedContent = editableElement.innerHTML;
                        const tempDiv = document.createElement('div');
                        tempDiv.innerHTML = updatedContent;
                        
                        const tagElements = tempDiv.querySelectorAll('.inline-tag');
                        const extractedTags: string[] = [];
                        tagElements.forEach(tagEl => {
                          const tagId = tagEl.getAttribute('data-tag-id');
                          if (tagId) extractedTags.push(tagId);
                          tagEl.remove();
                        });
                        
                        const plainText = tempDiv.textContent || '';
                        
                        if (item) {
                          const updatedItem = {
                            ...item,
                            title: plainText,
                            content: updatedContent,
                            tags: extractedTags,
                          };
                          onSave(updatedItem);
                        }
                      }
                      
                      setShowTagReplace(false);
                      setReplacingTagElement(null);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      transition: 'background-color 0.15s',
                      borderBottom: '1px solid #f3f4f6',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = '#f9fafb';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: hexToRgba(tagColor, 0.15),
                        color: tagColor,
                        fontWeight: 600,
                      }}
                    >
                      #{displayName}
                    </span>
                  </div>
                );
              })}
            </div>
          }
        />
      )}
      </div>

      {/* 右侧面板 - 即将到来 */}
      <UpcomingEventsPanel
        onTimeFilterChange={(filter) => {
          console.log('[PlanManager] Time filter changed:', filter);
          // TODO: 根据时间过滤更新右侧面板事件显示
        }}
      />
    </div>
  );
};

export default PlanManager;

