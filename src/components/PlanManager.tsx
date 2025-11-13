import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Event } from '../types';
import { UnifiedSlateEditor } from './UnifiedSlateEditor/UnifiedSlateEditor';
import { insertTag, insertEmoji, insertDateMention } from './UnifiedSlateEditor/helpers';
import { useFloatingToolbar } from './FloatingToolbar/useFloatingToolbar';
import { HeadlessFloatingToolbar } from './FloatingToolbar/HeadlessFloatingToolbar';
import { ToolbarConfig } from './FloatingToolbar/types';
import { TagService } from '../services/TagService';
import { DateMentionPicker } from './shared/DateMentionPicker';
import UnifiedDateTimePicker from './FloatingToolbar/pickers/UnifiedDateTimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { formatDateDisplay } from '../utils/dateParser';
import { EventEditModal } from './EventEditModal';
import { EventHub } from '../services/EventHub'; // 🎯 使用 EventHub 而不是 EventService
import { EventService } from '../services/EventService'; // 🔧 仅用于查询（getEventById）
import { generateEventId } from '../utils/calendarUtils';
import { formatTimeForStorage } from '../utils/timeUtils';
import { icons } from '../assets/icons';
import { useEventTime } from '../hooks/useEventTime';
import { TimeHub } from '../services/TimeHub';
import { getEventTime, setEventTime, isTask as isTaskByTime } from '../utils/timeManager'; // 🆕 统一时间管理
import './PlanManager.css';
import { dbg, warn, error } from '../utils/debugLogger';
import { formatRelativeTimeDisplay } from '../utils/relativeDateFormatter';
import TimeHoverCard from './TimeHoverCard';
import { calculateFixedPopupPosition } from '../utils/popupPositionUtils';

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

  const startTime = eventTime.start ? new Date(eventTime.start) : (item.startTime ? new Date(item.startTime) : null);
  const endTime = eventTime.end ? new Date(eventTime.end) : (item.endTime ? new Date(item.endTime) : null);
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
  const isAllDay = eventTime.timeSpec?.allDay ?? item.isAllDay;
  const displayHint = eventTime.displayHint ?? item.displayHint ?? null; // 🆕 v1.1: 获取 displayHint
  
  // 🆕 v2.5: 获取 timeFieldState（时间字段状态位图）
  const timeFieldState = eventTime.timeFieldState ?? item.timeFieldState ?? null;
  const isFuzzyDate = eventTime.isFuzzyDate ?? item.isFuzzyDate ?? false;
  
  // 🆕 v2.7: 获取 isFuzzyTime 和 fuzzyTimeName（模糊时间段）
  const isFuzzyTime = eventTime.isFuzzyTime ?? (item as any).isFuzzyTime ?? false;
  const fuzzyTimeName = eventTime.fuzzyTimeName ?? (item as any).fuzzyTimeName ?? null;
  
  // 🆕 v1.2: 获取原始的本地时间字符串（用于 formatRelativeTimeDisplay）
  const startTimeStr = eventTime.start || item.startTime || null;
  const endTimeStr = eventTime.end || item.endTime || null;
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

  if (!startTime && !dueDate) return null;

  // 使用相对时间格式化
  // 🆕 v1.2: 直接传递本地时间字符串，而不是 ISO 格式
  const relativeTimeDisplay = formatRelativeTimeDisplay(
    startTimeStr,
    endTimeStr,
    isAllDay ?? false,
    dueDateStr,
    displayHint // 🆕 v1.1: 传递 displayHint
  );

  // 🆕 v2.7.2: 优先级最高 - 如果是模糊时间段，只显示名称（不显示具体时间）
  if (isFuzzyTime && fuzzyTimeName) {
    // 从 relativeTimeDisplay 中提取日期部分
    // 例如: "明天 12:00 --> 18:00" → "明天"
    // 或者: "周末" (如果是模糊日期) → "周末"
    const displayText = isFuzzyDate 
      ? `${displayHint}${fuzzyTimeName}`  // 模糊日期 + 模糊时间段: "周末下午"
      : `${relativeTimeDisplay.split(' ')[0]} ${fuzzyTimeName}`;  // 具体日期 + 模糊时间段: "明天 下午"
    
    return (
      <Tippy
        content={
          <TimeHoverCard
            startTime={startTimeStr}
            endTime={endTimeStr}
            dueDate={dueDateStr}
            isAllDay={false}
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
            {displayText}
          </span>
        </div>
      </Tippy>
    );
  }

  // 任务（仅截止日期）
  if (!startTime && dueDate) {
    return (
      <Tippy
        content={
          <TimeHoverCard
            startTime={null}
            endTime={null}
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
          <span style={{ color: '#6b7280', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            {relativeTimeDisplay}
          </span>
        </div>
      </Tippy>
    );
  }

  // 事件（起止时间）
  if (startTime && endTime) {
    const dsStart = dayjs(startTime);
    const dsEnd = dayjs(endTime);
    const isSingleDay = dsStart.isSame(dsEnd, 'day');
    
    // 单天全天
    if (isAllDay && isSingleDay) {
      return (
        <Tippy
          content={
            <TimeHoverCard
              startTime={startTimeStr}
              endTime={endTimeStr}
              dueDate={dueDateStr}
              isAllDay={true}
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
    }

    // 多天全天
    if (isAllDay && !isSingleDay) {
      return (
        <Tippy
          content={
            <TimeHoverCard
              startTime={startTimeStr}
              endTime={endTimeStr}
              dueDate={dueDateStr}
              isAllDay={true}
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
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={handleEditClick}
            >
              <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{relativeTimeDisplay}</span>
            </div>
          </div>
        </Tippy>
      );
    }

    // 🆕 v2.7.4: 使用 timeFieldState 判断如何显示时间
    // timeFieldState = [startHour, startMinute, endHour, endMinute] 存储实际值，null 表示未设置
    const hasStartTimeField = timeFieldState && timeFieldState[0] !== null && timeFieldState[1] !== null;
    const hasEndTimeField = timeFieldState && timeFieldState[2] !== null && timeFieldState[3] !== null;
    
    // 如果是模糊日期且没有用户设置的时间字段，只显示 displayHint
    if (isFuzzyDate && !hasStartTimeField && !hasEndTimeField) {
      return (
        <Tippy
          content={
            <TimeHoverCard
              startTime={startTimeStr}
              endTime={endTimeStr}
              dueDate={dueDateStr}
              isAllDay={false}
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
    }

    // 🆕 v2.5: 根据 timeFieldState 判断显示格式
    // - 只有开始时间：显示单个时间点（如 "下周日 12:00"）
    // - 开始和结束时间：显示时间范围（如 "下周日 12:00 --> 14:00"）
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const startTimeDisplay = `${pad2(startTime.getHours())}:${pad2(startTime.getMinutes())}`;
    const endTimeDisplay = `${pad2(endTime.getHours())}:${pad2(endTime.getMinutes())}`;
    
    // 从完整的相对时间字符串中提取日期部分（去掉时间部分）
    const relativeDateOnly = relativeTimeDisplay.split(' ')[0]; // "明天" from "明天 14:30 - 15:30"
    
    // 如果只有开始时间字段，显示单个时间点
    if (hasStartTimeField && !hasEndTimeField) {
      return (
        <Tippy
          content={
            <TimeHoverCard
              startTime={startTimeStr}
              endTime={endTimeStr}
              dueDate={dueDateStr}
              isAllDay={false}
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
            <div
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
              onClick={handleEditClick}
            >
              <span style={{ fontSize: 14, color: '#6b7280' }}>{relativeDateOnly}</span>
              <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{startTimeDisplay}</span>
              <span 
                style={{ 
                  fontSize: 12, 
                  fontWeight: 500, 
                  color: '#10b981',
                  backgroundColor: '#f0fdf4',
                  padding: '2px 6px',
                  borderRadius: '4px'
                }}
              >
                开始
              </span>
            </div>
          </div>
        </Tippy>
      );
    }
    
    // 如果有开始和结束时间字段，显示时间范围
    // 计算持续时间
    const diffMinutes = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 60000));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const durationText = hours > 0 ? (minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`) : `${minutes}m`;

    return (
      <Tippy
        content={
          <TimeHoverCard
            startTime={startTimeStr}
            endTime={endTimeStr}
            dueDate={dueDateStr}
            isAllDay={false}
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
          <div
            style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer' }}
            onClick={handleEditClick}
          >
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {relativeDateOnly} {startTimeDisplay}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 6px' }}>
              <span style={{ fontSize: 12, fontWeight: 600, background: 'linear-gradient(135deg, #22d3ee, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', lineHeight: 1 }}>
                {durationText}
              </span>
              {/* arrow.svg inline */}
              <svg width={52} height={9} viewBox="0 0 52 9" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" style={{ display: 'block' }}>
                <path d="M51.3889 4.43908C51.6037 4.2243 51.6037 3.87606 51.3889 3.66127L47.8887 0.161088C47.6739 -0.0537006 47.3257 -0.0537006 47.1109 0.161088C46.8961 0.375876 46.8961 0.724117 47.1109 0.938905L50.2222 4.05018L47.1109 7.16144C46.8961 7.37623 46.8961 7.72447 47.1109 7.93926C47.3257 8.15405 47.6739 8.15405 47.8887 7.93926L51.3889 4.43908ZM0 4.05017L-4.80825e-08 4.60017L51 4.60018L51 4.05018L51 3.50018L4.80825e-08 3.50017L0 4.05017Z" fill="url(#gradArrow)"/>
                <defs>
                  <linearGradient id="gradArrow" x1="0" y1="4.55" x2="51" y2="4.55" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#22D3EE"/>
                    <stop offset="1" stopColor="#3B82F6"/>
                  </linearGradient>
                </defs>
              </svg>
            </div>
            <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>
              {endTimeDisplay}
            </span>
          </div>
        </div>
      </Tippy>
    );
  }

  return null;
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
  const [items, setItems] = useState<Event[]>(() => {
    // 初始化：从 EventService 加载 Plan 事件
    const now = new Date();
    const allEvents = EventService.getAllEvents();
    
    // 🔍 DEBUG: 检查 EventService 返回的数据
    console.log('[PlanManager] 初始化 - 从 EventService 加载:', {
      总事件数: allEvents.length,
      示例事件: allEvents.slice(0, 3).map(e => ({
        id: e.id?.substring(0, 30),
        title: e.title?.substring(0, 20),
        isPlan: e.isPlan,
        hasEventlog: !!(e as any).eventlog,
        hasDescription: !!e.description,
        eventlogLength: ((e as any).eventlog || '').length,
        descriptionLength: (e.description || '').length,
      }))
    });
    
    const filtered = allEvents.filter((event: Event) => {
      if (!event.isPlan) return false;
      if (event.parentEventId) return false;
      if (event.isTimeCalendar) {
        const endTime = new Date(event.endTime);
        return now < endTime;
      }
      return true;
    });
    
    // 🔍 DEBUG: 检查过滤后的数据
    console.log('[PlanManager] 初始化 - 过滤后的 Plan 事件:', {
      过滤后数量: filtered.length,
      示例: filtered.slice(0, 3).map(e => ({
        id: e.id?.substring(0, 30),
        title: e.title?.substring(0, 20),
        hasEventlog: !!(e as any).eventlog,
        hasDescription: !!e.description,
        eventlogLength: ((e as any).eventlog || '').length,
        descriptionLength: (e.description || '').length,
      }))
    });
    
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
  
  // 避免重复插入同一标签的防抖标记（同一行同一标签在短时间内仅插入一次）
  const lastTagInsertRef = useRef<{ lineId: string; tagId: string; time: number } | null>(null);
  // 🆕 UnifiedSlateEditor 的单个编辑器实例
  const unifiedEditorRef = useRef<any>(null);
  // 注册每一行的 Tiptap 编辑器实例（用于精准插入到光标位置）
  const editorRegistryRef = useRef<Map<string, any>>(new Map());
  
  // 🆕 v1.5: onChange 防抖优化（300ms）
  const onChangeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const pendingUpdatedItemsRef = useRef<any[] | null>(null);
  
  // 清理定时器
  useEffect(() => {
    // 🔍 组件挂载
    if (isDebugEnabled()) {
      // Debug mode enabled
    }
    
    return () => {
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current);
      }
    };
  }, []);
  
  // ✅ 监听 eventsUpdated，增量更新 items
  useEffect(() => {
    const handleEventUpdated = (e: CustomEvent) => {
      const { eventId, isDeleted, isNewEvent } = e.detail || {};
      
      if (isDeleted) {
        // 增量删除
        setItems(prev => prev.filter(event => event.id !== eventId));
      } else if (isNewEvent) {
        // 增量添加
        const newEvent = EventService.getEventById(eventId);
        if (newEvent && newEvent.isPlan && !newEvent.parentEventId) {
          const now = new Date();
          // 检查是否应该显示
          if (!newEvent.isTimeCalendar || now < new Date(newEvent.endTime)) {
            setItems(prev => [...prev, newEvent]);
          }
        }
      } else {
        // 增量更新
        const updatedEvent = EventService.getEventById(eventId);
        if (updatedEvent) {
          setItems(prev => {
            return prev.map((e: Event) => e.id === eventId ? updatedEvent : e);
          });
        }
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
  
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorContainerRef as React.RefObject<HTMLElement>,
    enabled: true,
    menuItemCount: 6, // menu_floatingbar 有 6 个菜单项：tag, emoji, dateRange, priority, color, addTask
    onMenuSelect: (menuIndex: number) => {
      setActivePickerIndex(menuIndex);
      // 延迟重置，确保 HeadlessFloatingToolbar 能接收到变化
      setTimeout(() => setActivePickerIndex(null), 100);
    },
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

    // 扫描当前聚焦行的 Slate 节点，提取所有 Tag 元素
    try {
      const { Node } = require('slate');
      
      // 查找当前行的节点
      const lineNode = editor.children.find((node: any) => {
        return node.lineId === currentFocusedLineId || 
               node.lineId === currentFocusedLineId.replace('-desc', '');
      });

      if (lineNode) {
        // 扫描所有子节点，提取 type='tag' 的元素
        const tagIds = new Set<string>();
        const descendants = Array.from(Node.descendants(lineNode as any));
        
        descendants.forEach((entry: any) => {
          const [node] = entry;
          if (node.type === 'tag' && node.tagId) {
            tagIds.add(node.tagId);
          }
        });

        // 转换为数组
        const actualTagIds = Array.from(tagIds);
        
        // 更新状态
        setCurrentSelectedTags(actualTagIds);
        currentSelectedTagsRef.current = actualTagIds;
        console.log('[TagPicker Sync] Title 模式，同步已选标签:', actualTagIds);
      }
    } catch (err) {
      console.error('[TagPicker Sync] Failed:', err);
    }
  }, [activePickerIndex, currentFocusedMode, currentFocusedLineId]); // 🔥 添加 currentFocusedLineId 依赖

  // 将文本格式命令路由到当前 Slate 编辑器
  const handleTextFormat = useCallback((command: string) => {
    // 🆕 使用 UnifiedSlateEditor 的编辑器实例
    const editor = unifiedEditorRef.current;
    if (!editor) return;
    
    // Slate API
    const { Editor, Transforms, Element, Node } = require('slate');
    const { ReactEditor } = require('slate-react');
    
    try {
      ReactEditor.focus(editor);
      
      switch (command) {
        case 'bold':
          Editor.addMark(editor, 'bold', true);
          break;
        case 'italic':
          Editor.addMark(editor, 'italic', true);
          break;
        case 'underline':
          Editor.addMark(editor, 'underline', true);
          break;
        case 'strikeThrough':
          Editor.addMark(editor, 'strikethrough', true);
          break;
        case 'removeFormat':
          // 移除所有格式
          Editor.removeMark(editor, 'bold');
          Editor.removeMark(editor, 'italic');
          Editor.removeMark(editor, 'underline');
          Editor.removeMark(editor, 'strikethrough');
          break;
        case 'toggleBulletList':
          // 🆕 Toggle bullet list（设置/取消段落的 bullet 属性）
          const [paraMatch] = Editor.nodes(editor, {
            match: (n: any) => !Editor.isEditor(n) && Element.isElement(n) && (n as any).type === 'paragraph',
          });
          
          if (paraMatch) {
            const [node] = paraMatch;
            const para = node as any;
            
            if (para.bullet) {
              // 已是 bullet，取消
              Transforms.setNodes(editor, { bullet: undefined, bulletLevel: undefined } as any);
            } else {
              // 设置为 bullet（默认 level 0）
              Transforms.setNodes(editor, { bullet: true, bulletLevel: 0 } as any);
            }
          }
          break;
        default:
          break;
      }
    } catch (err) {
      console.error('[handleTextFormat] Error:', err);
    }
  }, []);

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
      
      // 检测 @ 键（Shift+2）
      if (e.key === '@' || (e.shiftKey && e.key === '2')) {
        e.preventDefault(); // 阻止 @ 字符输入
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          // 记录当前光标矩形（用于 getReferenceClientRect）
          try {
            const rect = range.getBoundingClientRect();
            if (rect) caretRectRef.current = rect;
          } catch {}
          // 使用 1px span 作为真实锚点，确保后续可在其位置插入文本
          const anchor = document.createElement('span');
          anchor.className = 'temp-picker-anchor';
          anchor.style.cssText = 'display: inline-block; width: 1px; height: 1px; vertical-align: text-bottom;';
          range.insertNode(anchor);
          range.setStartAfter(anchor);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
          dateAnchorRef.current = anchor;
          
          // 显示日期选择器
          setShowDateMention(true);
        }
        return;
       }

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
    // 🆕 v1.5 批处理器架构 + 透传模式
    const actions = {
      delete: [] as string[],    // 待删除的 IDs
      save: [] as Event[],        // 待保存的 Events
      sync: [] as Event[],        // 需要同步到 Calendar 的 Events
    };
    
    // ===== 阶段 1: 跨行删除检测 =====
    const currentItemIds = items.map(i => i.id);
    const updatedItemIds = updatedItems.map((i: any) => i.id);
    const crossDeletedIds = currentItemIds.filter(id => !updatedItemIds.includes(id));
    
    if (crossDeletedIds.length > 0) {
      actions.delete.push(...crossDeletedIds);
      dbg('plan', `📋 收集跨行删除动作: ${crossDeletedIds.length} 个`);
    }
    
    // ===== 阶段 2: 内容处理（更新、空白删除） =====
    updatedItems.forEach((updatedItem: any) => {
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
        !updatedItem.dueDate
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
        
        const eventItem: Event = {
          ...(existingItem || {}),
          ...updatedItem,
          id: updatedItem.id,
          title: updatedItem.title || '',
          content: updatedItem.content,
          description: updatedItem.description,
          eventlog: updatedItem.eventlog ?? existingItem?.eventlog, // 🆕 v1.8: 保留富文本描述（使用 ?? 避免覆盖）
          tags: tagIds, // 使用规范化的 tagIds
          calendarIds: calendarIds.length > 0 ? calendarIds : undefined, // 🆕 v1.8: 设置 calendarIds
          level: updatedItem.level || 0,
          priority: updatedItem.priority || existingItem?.priority || 'medium',
          isCompleted: updatedItem.isCompleted ?? existingItem?.isCompleted ?? false,
          type: existingItem?.type || 'todo',
          isPlan: true,
          isTask: true,
          isTimeCalendar: false,
          remarkableSource: true,
          // 🆕 v1.5: 使用透传的时间字段（不再丢失）
          startTime: updatedItem.startTime ?? existingItem?.startTime ?? '',
          endTime: updatedItem.endTime ?? existingItem?.endTime ?? '',
          dueDate: updatedItem.dueDate ?? existingItem?.dueDate,
          isAllDay: updatedItem.isAllDay ?? existingItem?.isAllDay ?? false,
          createdAt: existingItem?.createdAt || nowISO,
          updatedAt: nowISO,
          source: 'local',
          syncStatus: calendarIds.length > 0 ? 'pending' : 'local-only', // 🆕 v1.8: 根据日历映射设置同步状态
        } as Event;
        
        // 🆕 v1.5: 保留 timeSpec
        if (updatedItem.timeSpec) {
          (eventItem as any).timeSpec = updatedItem.timeSpec;
        }
        
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
          tags: item.tags
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

  // 将 Event[] 转换为 FreeFormLine<Event>[]
  const editorLines = useMemo<FreeFormLine<Event>[]>(() => {
    const lines: FreeFormLine<Event>[] = [];
    const visitedIds = new Set<string>(); // 🆕 检测循环引用/重复ID

    // 🆕 合并 items 和 pendingEmptyItems
    const allItems = [...items, ...Array.from(pendingEmptyItems.values())];

    // 根据 position（若无则按原数组索引）进行排序，确保新建行按期望顺序显示
    const sortedItems = [...allItems].sort((a: any, b: any) => {
      const pa = (a as any).position ?? allItems.indexOf(a);
      const pb = (b as any).position ?? allItems.indexOf(b);
      return pa - pb;
    });

  sortedItems.forEach((item) => {
      // 🔴 安全检查：跳过没有 id 的 item
      if (!item.id) {
        warn('plan', 'Skipping item without id:', item);
        return;
      }
      
      // 🆕 检测重复 ID
      if (visitedIds.has(item.id)) {
        warn('plan', 'Duplicate item id detected', { itemId: item.id });
        return;
      }
      visitedIds.add(item.id);
      
      // Title 行
      lines.push({
        id: item.id,
        content: item.content || item.title,
        level: item.level || 0,
        // 🔧 BUG FIX: 标题行不应该携带 description 字段，避免 Shift+Enter 后污染新 description 行
        data: { ...item, mode: 'title', description: undefined } as Event,
      });
      
      // 如果处于 description 模式，则无论内容是否为空都渲染描述行
      if (item.mode === 'description') {
        lines.push({
          id: `${item.id}-desc`,
          content: item.description || '',
          level: (item.level || 0) + DESCRIPTION_INDENT_OFFSET, // 🔧 使用常量
          data: { ...item, mode: 'description' },
        });
      }
    });
    
    return lines;
  }, [items, pendingEmptyItems]); // 🆕 添加 pendingEmptyItems 依赖

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
      const isDescription = line.id.includes('-desc') || line.data?.mode === 'description';

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
        const isChanged = !existingItem || 
          existingItem.title !== updatedItem.title ||
          existingItem.content !== updatedItem.content ||
          existingItem.description !== updatedItem.description ||
          existingItem.mode !== updatedItem.mode ||
          JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);
        
        if (isChanged) {
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
          // 从 pending 转为正式：移除 pending
          setPendingEmptyItems(prev => {
            const next = new Map(prev);
            next.delete(titleLine.id);
            return next;
          });
        } else if (wasPending && !hasContent) {
          // 仍然是空行：保持在 pending
          setPendingEmptyItems(prev => new Map(prev).set(titleLine.id, newItem));
        } else if (!wasPending && hasContent) {
          // 直接创建有内容的新 item（比如粘贴文本）
          // 不再在这里调用 onSave，等批量更新
        } else {
          // 新空行：添加到 pending
          setPendingEmptyItems(prev => new Map(prev).set(titleLine.id, newItem));
        }
      }
    });
    
    // 🔧 批量更新：只更新真正变化的 item
    if (changedItems.length > 0) {
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
      startTime: finalStartTime,
      endTime: finalEndTime,
      // 全天：显式勾选优先；否则当起止为同一天且均为 00:00 视为全天
      isAllDay: (() => {
        if (item.isAllDay) return true;
        if (finalStartTime && finalEndTime) {
          const { parseLocalTimeString } = require('../utils/timeUtils');
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
      category: `priority-${item.priority}`,
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

  // 渲染左侧前缀（Checkbox + Emoji，无类型图标）
  // 🔧 使用 useCallback 避免每次渲染都创建新函数，减少 DOM 变化
  const renderLinePrefix = useCallback((line: FreeFormLine<Event>) => {
    const item = line.data;
    if (!item) return null;

    // 🔧 Description 行不显示 checkbox
    const isDescriptionMode = item.mode === 'description';
    if (isDescriptionMode) {
      return null;
    }

    // ✅ 使用 React.memo 组件，避免 checkbox 重复渲染
    return (
      <PlanItemCheckbox
        isCompleted={item.isCompleted || false}
        emoji={item.emoji}
        onChange={(checked) => {
          const updatedItem = { ...item, isCompleted: checked };
          onSave(updatedItem);
        }}
      />
    );
  }, [onSave]); // 依赖 onSave，但 onSave 也应该是稳定的（useCallback）

  // 渲染右侧后缀（时间 + More 图标）
  // 🔧 使用 useCallback 避免每次渲染都创建新函数
  const renderLineSuffix = useCallback((line: FreeFormLine<Event>) => {
    const item = line.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: '14px', justifyContent: 'flex-end' }}>
        {/* 时间显示（使用订阅 TimeHub 的组件） */}
        <PlanItemTimeDisplay
          item={item}
          onEditClick={(anchor) => {
            dbg('ui', '🖱️ 点击右侧时间区域，打开 UnifiedDateTimePicker', { eventId: item.id, itemId: item.id });
            dateAnchorRef.current = anchor;
            pickerTargetItemIdRef.current = item.id;
            setShowUnifiedPicker(true);
          }}
        />
        {/* More 图标 - 点击打开 EditModal */}
        <img
          src={icons.more}
          alt="More"
          onClick={(e) => {
            e.stopPropagation();
            setSelectedItemId(item.id);
            setEditingItem(item);
          }}
          style={{
            width: '20px',
            height: '20px',
            cursor: 'pointer',
            opacity: 0.6,
            transition: 'opacity 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
        />
      </div>
    );
  }, []); // 依赖为空，因为使用的都是 ref 或 setState

  // 渲染内容样式（不需要自己实现 contentEditable，只提供样式）
  const getContentStyle = (item: Event) => ({
    color: item.color || '#111827',
    textDecoration: item.isCompleted ? 'line-through' : 'none',
    opacity: item.isCompleted ? 0.6 : 1,
  });

  return (
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
        <UnifiedSlateEditor
          items={useMemo(() => editorLines.map(line => {
            // 🔧 v1.8: 使用 editorLines（包含 pendingEmptyItems），确保新行立即显示勾选框
            const item = line.data;
            if (!item) {
              // 安全回退：如果没有 data，返回空对象
              return {
                id: line.id,
                eventId: line.id,
                level: line.level,
                title: '',
                content: line.content,
                description: '',
                tags: [],
                startTime: '',
                endTime: '',
                priority: 'medium',
                isCompleted: false,
                isAllDay: false,
              };
            }
            return {
              id: line.id,
              eventId: item.id,
              level: line.level,
              title: item.title,
              content: line.content,
              description: item.description,
              eventlog: (item as any).eventlog,  // 🆕 v1.8: 传递 eventlog 字段
              tags: item.tags || [],
              calendarIds: (item as any).calendarIds, // 🆕 v1.8: 传递 calendarIds 字段
              // 🆕 v1.5: 透传完整的时间字段和元数据（无字段过滤）
              startTime: item.startTime,
              endTime: item.endTime,
              dueDate: item.dueDate,
              priority: item.priority,
              isCompleted: item.isCompleted,
              isAllDay: item.isAllDay,
              timeSpec: (item as any).timeSpec,
              syncStatus: (item as any).syncStatus, // 🆕 v1.8: 传递 syncStatus
            };
          }), [editorLines])}
          onChange={debouncedOnChange}
          onFocus={(lineId) => {
            // 🆕 v1.8: 更新焦点跟踪，从 editorLines 查找
            setCurrentFocusedLineId(lineId);
            
            // 查找当前行的 item 和 mode
            const matchedLine = editorLines.find(l => l.id === lineId);
            if (matchedLine && matchedLine.data) {
              const isDescMode = lineId.includes('-desc');
              setCurrentFocusedMode(isDescMode ? 'description' : 'title');
              setCurrentIsTask(matchedLine.data.isTask || false);
            }
          }}
          onEditorReady={(editorApi) => {
            // 🆕 保存 UnifiedSlateEditor 的编辑器实例
            unifiedEditorRef.current = editorApi.getEditor();
          }}
          onDeleteRequest={(lineId) => {
            // 🆕 v1.6: 使用统一删除接口
            deleteItems([lineId.replace('-desc', '')], 'user-backspace-delete');
          }}
          renderLinePrefix={(line) => {
            // 🆕 v1.8: 检查是否是 placeholder 行（最后一行提示）
            if ((line.metadata as any)?.isPlaceholder || line.eventId === '__placeholder__') {
              return (
                <span style={{ 
                  color: '#9ca3af', 
                  fontSize: '14px',
                  userSelect: 'none',
                  cursor: 'text',
                }}>
                  🖱️点击创建新事件 | ⌨️Shift+Enter 添加描述 | Tab/Shift+Tab 层级缩进 | Shift+Alt+↑↓移动所选事件
                </span>
              );
            }
            
            // 🔧 v1.8: 从 editorLines 查找（包含立即同步的 pendingEmptyItems）
            const matchedLine = editorLines.find(l => l.id === line.lineId);
            
            if (!matchedLine || !matchedLine.data) {
              // 极端情况：渲染默认勾选框（通常不会到这里，因为 immediateStateSync）
              if (line.mode === 'description') return null;
              
              return (
                <input
                  type="checkbox"
                  checked={false}
                  disabled
                  style={{ cursor: 'not-allowed', opacity: 0.5 }}
                />
              );
            }
            
            return renderLinePrefix(matchedLine);
          }}
          renderLineSuffix={(line) => {
            // 🔧 v1.8: 从 editorLines 查找（包含 pendingEmptyItems）
            const matchedLine = editorLines.find(l => l.id === line.lineId);
            if (!matchedLine || !matchedLine.data) return null;
            
            return renderLineSuffix(matchedLine);
          }}
        />
      </div>

      {/* 右侧编辑面板 - 使用 EventEditModal */}
      {selectedItemId && editingItem && (
        <EventEditModal
          event={convertPlanItemToEvent(editingItem)}
          isOpen={true}
          onClose={() => {
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          onSave={(updatedEvent) => {
            // 🔍 调试：检查 todoListIds 是否被正确传递
            console.log('🔍 [PlanManager] EventEditModal onSave:', {
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
          microsoftService={microsoftService} // 🆕 传递 Microsoft 服务
          // 移除 availableCalendars - 让 SyncTargetPicker 自己从 microsoftService 加载
          draggable={true}
          resizable={true}
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
        eventId={currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.id) : undefined}
        useTimeHub={true}
        editorMode={currentFocusedMode}
        onRequestClose={() => {
          // 🆕 Picker 关闭时自动关闭整个 FloatingBar
          console.log('%c[PlanManager] onRequestClose 被调用', 'background: #E91E63; color: white;');
          floatingToolbar.hideToolbar();
        }}
        onTimeApplied={async (startIso, endIso) => {
          dbg('picker', '📌 HeadlessFloatingToolbar.onTimeApplied 被调用', { 
            startIso, 
            endIso, 
            focusedLineId: currentFocusedLineId,
            对应的eventId: currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.id) : undefined
          });
          
          const targetId = currentFocusedLineId || '';
          if (!targetId) {
            warn('picker', '⚠️ onTimeApplied: 没有 focusedLineId，跳过');
            return;
          }
          
          const actualItemId = targetId.replace('-desc','');
          const item = items.find(i => i.id === actualItemId);

          if (!item) {
            warn('picker', '⚠️ onTimeApplied: 找不到对应的 item', { targetId, actualItemId });
            return;
          }

          try {
            // 🎯 使用统一时间管理接口
            const updatedTime = await setEventTime(item.id, {
              start: startIso,
              end: endIso || startIso,
              isAllDay: false,
            });
            
            dbg('picker', '✅ 时间更新成功（TimeHub + EventService 已同步）', { 
              eventId: item.id,
              ...updatedTime,
            });
            
            // 🆕 更新 item 的时间字段（保持 metadata 同步）
            const updatedItem: Event = {
              ...item,
              startTime: updatedTime.start || '',
              endTime: updatedTime.end || '',
              isAllDay: updatedTime.isAllDay,
              timeSpec: updatedTime.timeSpec,
            } as Event;
            
            // 保存更新后的 item（onSave 会触发 Slate 同步）
            onSave(updatedItem);
            
            // 同步到日历（如果有时间）
            if (updatedTime.start && updatedTime.end) {
              syncToUnifiedTimeline(updatedItem);
            }
          } catch (err) {
            error('picker', '❌ 时间更新失败', { error: err });
          }
        }}
        onTextFormat={handleTextFormat}
        onTagSelect={(tagIds: string[]) => {
          // 🆕 使用 UnifiedSlateEditor 的 helper 函数
          const editor = unifiedEditorRef.current;
          if (!editor || !currentFocusedLineId) return;
          
          // 计算新增标签（与上一次所选差集）
          const addedIds = tagIds.filter(id => !currentSelectedTagsRef.current.includes(id));
          
          // 先更新当前所选标签状态（避免后续 diff 再次重复）
          currentSelectedTagsRef.current = tagIds;
          setCurrentSelectedTags(tagIds);
          
          // 仅插入最新新增的那一个
          if (addedIds.length === 0) return;
          const insertId = addedIds[addedIds.length - 1];
          
          // 防抖：避免同一行同一标签在极短时间内被多次处理
          const now = Date.now();
          const last = lastTagInsertRef.current;
          if (last && last.lineId === currentFocusedLineId && last.tagId === insertId && (now - last.time) < 500) {
            return;
          }
          lastTagInsertRef.current = { lineId: currentFocusedLineId, tagId: insertId, time: now };
          
          const actualItemId = currentFocusedLineId.replace('-desc', '');
          const item = items.find(i => i.id === actualItemId);
          if (!item) return;
          
          const tag = TagService.getTagById(insertId);
          if (!tag) return;
          
          const isDescriptionMode = currentFocusedMode === 'description';
          
          // 使用 helper 函数插入 tag
          const success = insertTag(
            editor,
            insertId,
            tag.name,
            tag.color || '#666',
            tag.emoji || '',
            isDescriptionMode
          );
          
          if (success) {
            console.log(`[✅ Tag 插入成功] ${tag.name}`);
            
            if (isDescriptionMode) {
              // 📌 Description 模式：插入后立即关闭 Picker 和 FloatingBar
              floatingToolbar.hideToolbar();
              console.log('[Description Mode] Tag 插入后自动关闭 FloatingBar');
            } else {
              // 📌 Title 模式：更新选中状态，保持 Picker 打开
              if (!currentSelectedTags.includes(insertId)) {
                const newSelectedTags = [...currentSelectedTags, insertId];
                setCurrentSelectedTags(newSelectedTags);
                currentSelectedTagsRef.current = newSelectedTags;
              }
            }
            // 注意：UnifiedSlateEditor 的 onChange 会自动保存
          }
        }}
        onEmojiSelect={(emoji: string) => {
          // 🆕 使用 UnifiedSlateEditor 的 helper 函数
          const editor = unifiedEditorRef.current;
          if (!editor || !currentFocusedLineId) return;
          
          const success = insertEmoji(editor, emoji);
          if (success) {
            console.log(`[✅ Emoji 插入成功] ${emoji}`);
            // 注意：UnifiedSlateEditor 的 onChange 会自动保存
          }
        }}
        onDateRangeSelect={(start: Date, end: Date) => {
          // 🆕 使用 UnifiedSlateEditor 的 helper 函数插入 DateMention
          const editor = unifiedEditorRef.current;
          if (!editor || !currentFocusedLineId) {
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
            // 注意：UnifiedSlateEditor 的 onChange 会自动保存（延迟2秒或Enter/失焦时立即保存）
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
      
      {/* 日期提及弹窗 - 使用 Tippy 定位 */}
      {dateAnchorRef.current && (
        <Tippy
          visible={showDateMention}
          reference={dateAnchorRef.current}
          // 使用虚拟定位，防止参考元素被裁剪/隐藏后回退到左上角
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
          className="mention-picker-tippy"
          popperOptions={{ modifiers: [{ name: 'hide', enabled: false }] }}
          theme="light"
          onClickOutside={() => {
            setShowDateMention(false);
            // 清理 anchor
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
            <DateMentionPicker
                eventId={(pickerTargetItemIdRef.current || currentFocusedLineId) ? (items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId)!.replace('-desc',''))?.id) : undefined}
                useTimeHub={true}
                onDateSelect={(startDate, endDate, rawText) => {
                  dbg('mention', 'DateMentionPicker onDateSelect', {
                    targetItemId: pickerTargetItemIdRef.current || currentFocusedLineId,
                    eventId: (pickerTargetItemIdRef.current || currentFocusedLineId) ? (items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId)!.replace('-desc',''))?.id) : undefined,
                    start: startDate ? formatTimeForStorage(startDate) : undefined,
                    end: endDate ? formatTimeForStorage(endDate) : undefined,
                    rawText,
                  });
                  // 在 anchor 位置插入日期 mention
                  if (dateAnchorRef.current) {
                    const targetId = pickerTargetItemIdRef.current || currentFocusedLineId || '';
                    const item = items.find(i => i.id === targetId || i.id === targetId.replace('-desc',''));
                    const editor = editorRegistryRef.current.get(targetId);
                    
                    if (editor && item) {
                      // 通过 Tiptap 在当前光标处插入原始自然语言文本（如“明天”），再补一个空格
                      // 插入一个带样式的 mention（📅 + 原始文本）
                      const html = `<span class="time-mention">📅 ${rawText}</span>&nbsp;`;
                      editor.chain().focus().insertContent(html).run();
                      // 清理定位锚点（如果存在）
                      try { dateAnchorRef.current?.remove?.(); } catch {}
                      // 更新 Event，并统一到 Event
                      const updatedHTML = editor.getHTML();
                      const updatedItem = {
                        ...item,
                        startTime: formatTimeForStorage(startDate),
                        endTime: formatTimeForStorage(endDate || startDate),
                        content: updatedHTML,
                      } as Event;
                      onSave(updatedItem);
                      syncToUnifiedTimeline(updatedItem);

                      // 同步到 Event：若已有 eventId，仅更新非时间字段；若没有，则创建 Event 并回写 eventId
                      (async () => {
                        try {
                          if (updatedItem.id) {
                            // ✅ 使用 EventHub.updateFields 替代直接调用
                            await EventHub.updateFields(updatedItem.id, {
                              title: updatedItem.title,
                              description: updatedItem.description || updatedItem.content,
                              tags: updatedItem.tags,
                              isTask: updatedItem.isTask,
                            }, { source: 'planmanager-mention' });
                            dbg('mention', 'Updated existing event (non-time fields) after mention insert', { eventId: updatedItem.id });
                          } else {
                            const newId = generateEventId();
                            
                            // 🆕 v1.8: 从标签中提取 calendarIds（与 executeBatchUpdate 一致）
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
                            
                            console.log('[PlanManager] 日期提及创建事件 - 标签到日历映射:', {
                              eventId: newId,
                              title: updatedItem.title?.substring(0, 20),
                              tags: updatedItem.tags,
                              tagIds,
                              calendarIds,
                              hasSyncMapping: calendarIds.length > 0
                            });
                            
                            // ✅ 使用 EventHub.createEvent 替代直接调用
                            const createRes = await EventHub.createEvent({
                              id: newId,
                              title: updatedItem.title || '未命名',
                              description: updatedItem.description || updatedItem.content,
                              startTime: formatTimeForStorage(startDate),
                              endTime: formatTimeForStorage(endDate || startDate),
                              isAllDay: false,
                              tags: tagIds, // 使用规范化的 tagIds
                              calendarIds: calendarIds.length > 0 ? calendarIds : undefined, // 🆕 v1.8: 设置 calendarIds
                              createdAt: formatTimeForStorage(new Date()),
                              updatedAt: formatTimeForStorage(new Date()),
                              remarkableSource: true,
                              isPlan: true, // 🆕 标记为 Plan 事件
                              syncStatus: calendarIds.length > 0 ? 'pending' : 'local-only', // 🆕 v1.8: 根据日历映射设置同步状态
                            } as Event);
                            if (createRes.success && createRes.event) {
                              // Event 已创建，直接保存（id已经是newId）
                              onSave(updatedItem);
                              syncToUnifiedTimeline(updatedItem);
                              dbg('mention', 'Created new event from mention insert', { eventId: newId });
                            }
                          }
                        } catch {}
                      })();
                    }
                  }
                  
                  setShowDateMention(false);
                  if (dateAnchorRef.current) {
                    const el = dateAnchorRef.current;
                    if (el.classList && el.classList.contains('temp-picker-anchor')) {
                      el.remove();
                    }
                  }
                  dateAnchorRef.current = null;
                  caretRectRef.current = null;
                  pickerTargetItemIdRef.current = null;
                }}
                onClose={() => {
                  setShowDateMention(false);
                  // 清理 anchor
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
          }
        />
      )}

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
                eventId={(items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId || '').replace('-desc',''))?.id) || undefined}
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
  );
};

export default PlanManager;

