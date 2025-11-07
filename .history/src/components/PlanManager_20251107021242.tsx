import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Event } from '../types';
import { FreeFormLine } from './MultiLineEditor/FreeFormEditor';
import { UnifiedSlateEditor } from './UnifiedSlateEditor/UnifiedSlateEditor';
import { insertTag, insertEmoji, insertDateMention } from './UnifiedSlateEditor/helpers';
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { HeadlessFloatingToolbar } from './FloatingToolbar/HeadlessFloatingToolbar';
import { ToolbarConfig } from './FloatingToolbar/types';
import { TagService } from '../services/TagService';
import { DateMentionPicker } from './shared/DateMentionPicker';
import UnifiedDateTimePicker from './FloatingToolbar/pickers/UnifiedDateTimePicker';
import dayjs from 'dayjs';
import 'dayjs/locale/zh-cn';
import { formatDateDisplay } from '../utils/dateParser';
import { EventEditModal } from './EventEditModal';
import { EventService } from '../services/EventService';
import { generateEventId } from '../utils/calendarUtils';
import { formatTimeForStorage } from '../utils/timeUtils';
import { icons } from '../assets/icons';
import { useEventTime } from '../hooks/useEventTime';
import { TimeHub } from '../services/TimeHub';
import './PlanManager.css';
import { dbg, warn, error } from '../utils/debugLogger';

// 🔧 常量定义
const DESCRIPTION_INDENT_OFFSET = 1; // Description 行相对于 Title 行的缩进增量

// 时间显示组件，订阅 TimeHub 更新
const PlanItemTimeDisplay: React.FC<{
  item: Event;
  onEditClick: (anchor: HTMLElement) => void;
}> = ({ item, onEditClick }) => {
  // 直接使用 item.id 订阅 TimeHub
  const eventTime = useEventTime(item.id);

  const startTime = eventTime.start ? new Date(eventTime.start) : (item.startTime ? new Date(item.startTime) : null);
  const endTime = eventTime.end ? new Date(eventTime.end) : (item.endTime ? new Date(item.endTime) : null);
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
  const isAllDay = eventTime.timeSpec?.allDay ?? item.isAllDay;
  // 观察订阅的时间变化，输出调试日志
  useEffect(() => {
    dbg('ui', '🖼️ PlanItemTimeDisplay 快照更新', {
      itemId: item.id,
      TimeHub快照start: eventTime.start,
      TimeHub快照end: eventTime.end,
      TimeHub快照allDay: eventTime.timeSpec?.allDay,
      item本地startTime: item.startTime,
      item本地endTime: item.endTime,
      最终渲染的start: startTime,
      最终渲染的end: endTime,
    });
  }, [item.id, eventTime.start, eventTime.end, eventTime.timeSpec?.allDay, item.startTime, item.endTime]);

  if (!startTime && !dueDate) return null;

  // 任务（仅截止日期）
  if (!startTime && dueDate) {
    const month = dueDate.getMonth() + 1;
    const day = dueDate.getDate();
    return (
      <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
        截止 {month}月{day}日
      </span>
    );
  }

  // 事件（起止时间）
  if (startTime && endTime) {
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const dsStart = dayjs(startTime);
    const dsEnd = dayjs(endTime);

    const dateStr = dsStart.format('YYYY-MM-DD（ddd）');
    const startTimeStr = `${pad2(startTime.getHours())}:${pad2(startTime.getMinutes())}`;
    const endTimeStr = `${pad2(endTime.getHours())}:${pad2(endTime.getMinutes())}`;

    const isSingleDay = dsStart.isSame(dsEnd, 'day');
    const looksLikeSingleDayAllDay = isSingleDay && startTime.getHours() === 0 && startTime.getMinutes() === 0 && endTime.getHours() === 23 && endTime.getMinutes() === 59;
    
    // 单天全天
    if ((isAllDay && isSingleDay) || looksLikeSingleDayAllDay) {
      return (
        <span
          style={{ color: '#6b7280', whiteSpace: 'nowrap', cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(e.currentTarget as HTMLElement);
          }}
        >
          {dateStr} 全天
        </span>
      );
    }

    // 多天全天
    if (isAllDay && !isSingleDay) {
      const endDateStr = dsEnd.format('YYYY-MM-DD（ddd）');
      return (
        <div
          style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer' }}
          onClick={(e) => {
            e.stopPropagation();
            onEditClick(e.currentTarget as HTMLElement);
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{dateStr}</span>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 6px' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#22d3ee' }}>全天</span>
          </div>
          <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{endDateStr}</span>
        </div>
      );
    }

    // 正常时间段
    const diffMinutes = Math.max(0, Math.floor((endTime.getTime() - startTime.getTime()) / 60000));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    const durationText = hours > 0 ? (minutes > 0 ? `${hours}h${minutes}m` : `${hours}h`) : `${minutes}m`;

    return (
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 0, cursor: 'pointer' }}
        onClick={(e) => {
          e.stopPropagation();
          onEditClick(e.currentTarget as HTMLElement);
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{dateStr} {startTimeStr}</span>
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
        <span style={{ fontSize: 14, fontWeight: 500, color: '#374151' }}>{endTimeStr}</span>
      </div>
    );
  }

  return null;
};

// 🔧 PlanManager 不再使用 Event，直接使用 Event
// Event 中已包含所有 Plan 相关字段（content, level, mode, emoji, color, priority, isCompleted 等）

export interface PlanManagerProps {
  items: Event[];
  onSave: (item: Event) => void;
  onDelete: (id: string) => void;
  availableTags?: string[];
  onCreateEvent?: (event: Event) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
}

// 🔍 调试开关 - 通过 window.SLATE_DEBUG = true 开启
const isDebugEnabled = () => typeof window !== 'undefined' && (window as any).SLATE_DEBUG === true;

const PlanManager: React.FC<PlanManagerProps> = ({
  items,
  onSave,
  onDelete,
  availableTags = [],
  onCreateEvent,
  onUpdateEvent,
}) => {
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
    // 🔍 组件挂载日志
    if (isDebugEnabled()) {
      const timestamp = new Date().toISOString().split('T')[1].slice(0, 12);
      window.console.log(`%c[🚀 ${timestamp}] PlanManager mounted with DEBUG LOGGING ENABLED`, 
        'background: #FF9800; color: white; padding: 4px 8px; border-radius: 3px; font-weight: bold;');
      window.console.log(`%c[📊 ${timestamp}] Initial items count: ${items.length}`, 
        'color: #FF5722; font-weight: bold;');
    }
    
    return () => {
      if (onChangeTimerRef.current) {
        clearTimeout(onChangeTimerRef.current);
      }
    };
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

  // 将文本格式命令路由到当前 Slate 编辑器
  const handleTextFormat = useCallback((command: string) => {
    // 🆕 使用 UnifiedSlateEditor 的编辑器实例
    const editor = unifiedEditorRef.current;
    if (!editor) return;
    
    // Slate API
    const { Editor } = require('slate');
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
            // 更新标签
            if (item.tags) {
              const tagIds = item.tags
                .map(tagName => {
                  const tag = TagService.getFlatTags().find(t => t.name === tagName);
                  return tag?.id;
                })
                .filter(Boolean) as string[];
              setCurrentSelectedTags(tagIds);
              currentSelectedTagsRef.current = tagIds;
            } else {
              setCurrentSelectedTags([]);
              currentSelectedTagsRef.current = [];
            }
            
            // 🆕 更新 isTask 状态
            setCurrentIsTask(item.isTask || false);
          } else {
            setCurrentSelectedTags([]);
            currentSelectedTagsRef.current = []; // 同步更新 ref
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
        JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);
      
      if (isChanged) {
        const now = new Date();
        const nowISO = formatTimeForStorage(now);
        
        const eventItem: Event = {
          ...(existingItem || {}),
          ...updatedItem,
          id: updatedItem.id,
          title: updatedItem.title || '',
          content: updatedItem.content,
          description: updatedItem.description,
          tags: updatedItem.tags || [],
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
          syncStatus: 'local-only',
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
    const batchTimestamp = new Date().toISOString().split('T')[1].slice(0, 12);
    
    // 3.1 批量删除
    if (actions.delete.length > 0) {
      console.log(`[🗑️ ${batchTimestamp}] Executing batch delete`, {
        count: actions.delete.length,
        ids: actions.delete,
      });
      dbg('plan', `🗑️ 执行批量删除: ${actions.delete.length} 个`, { 
        ids: actions.delete 
      });
      actions.delete.forEach(id => onDelete(id));
    }
    
    // 3.2 批量保存
    if (actions.save.length > 0) {
      console.log(`[💾 ${batchTimestamp}] Executing batch save`, {
        count: actions.save.length,
        items: actions.save.map(e => ({
          id: e.id,
          title: e.title,
          isCompleted: e.isCompleted,
        })),
      });
      dbg('plan', `💾 执行批量保存: ${actions.save.length} 个`, { 
        titles: actions.save.map(e => e.title) 
      });
      actions.save.forEach(item => onSave(item));
    }
    
    // 3.3 批量同步到 Calendar
    if (actions.sync.length > 0) {
      console.log(`[📅 ${batchTimestamp}] Executing batch sync`, {
        count: actions.sync.length,
      });
      dbg('plan', `📅 执行批量同步: ${actions.sync.length} 个`, { 
        titles: actions.sync.map(e => e.title) 
      });
      actions.sync.forEach(item => syncToUnifiedTimeline(item));
    }
    
    // 📊 执行摘要
    if (actions.delete.length > 0 || actions.save.length > 0 || actions.sync.length > 0) {
      console.log(`[✅ ${batchTimestamp}] Batch update completed`, {
        deleted: actions.delete.length,
        saved: actions.save.length,
        synced: actions.sync.length,
      });
      dbg('plan', `✅ 批处理完成 (v1.5 透传架构 + 防抖)`, {
        deleted: actions.delete.length,
        saved: actions.save.length,
        synced: actions.sync.length,
      });
    }
  }, [items, itemsMap, onSave, onDelete]);

  // 🆕 v1.5: 防抖处理函数
  const debouncedOnChange = useCallback((updatedItems: any[]) => {
    // 清除之前的定时器
    if (onChangeTimerRef.current) {
      clearTimeout(onChangeTimerRef.current);
    }
    
    // 保存最新的 updatedItems
    pendingUpdatedItemsRef.current = updatedItems;
    
    // 设置新的定时器（300ms 后执行）
    onChangeTimerRef.current = setTimeout(() => {
      const itemsToProcess = pendingUpdatedItemsRef.current;
      if (!itemsToProcess) return;
      
      // 执行批处理逻辑
      executeBatchUpdate(itemsToProcess);
      
      // 清空缓存
      pendingUpdatedItemsRef.current = null;
      onChangeTimerRef.current = null;
    }, 300);
  }, [executeBatchUpdate]);

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
    
    // 🆕 添加删除日志
    if (deletedIds.length > 0) {
      console.log(`[🗑️ 跨行删除检测] 检测到 ${deletedIds.length} 个被删除的行:`, deletedIds);
    }
    
    deletedIds.forEach(id => {
      // 从 pendingEmptyItems 中移除
      setPendingEmptyItems(prev => {
        const next = new Map(prev);
        next.delete(id);
        return next;
      });
      // 如果在 items 中，也调用 onDelete
      if (currentItemIds.includes(id)) {
        console.log(`[🗑️ 调用 onDelete] ${id}`);
        onDelete(id);
      } else {
        console.log(`[⏭️ 跳过删除] ${id} (不在 items 中，可能在 pendingEmptyItems)`);
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
      console.log(`[⚡ 批量更新] ${changedItems.length} 个变更`);
      
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
    return {
      id: item.id || `event-${Date.now()}`,
      title: item.title,
      description: item.notes || sanitize(item.description || item.content || ''),
      startTime: item.startTime || item.dueDate || formatTimeForStorage(new Date()),
      endTime: item.endTime || item.dueDate || formatTimeForStorage(new Date()),
      location: '', // Event 没有 location 字段，保留空值
      isAllDay: !item.startTime && !!item.dueDate,
      tags: mappedTags,
      tagId: mappedTags.length > 0 ? mappedTags[0] : undefined,
      calendarId: undefined,
      calendarIds: [],
      source: 'local',
      syncStatus: 'local-only',
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
    
    // 🆕 确定最终时间和 isTask 标志
    let finalStartTime: string;
    let finalEndTime: string;
    let isTask: boolean;
    
    const hasStart = !!item.startTime;
    const hasEnd = !!item.endTime;
    
    // 检查 event 是否已经在 EventService 中
    const existsInEventService = EventService.getEventById(item.id);
    
    if (existsInEventService) {
      // Event 已存在 → 从 TimeHub 读取最新时间（TimeHub 是时间的唯一数据源）
      const snapshot = TimeHub.getSnapshot(item.id);
      if (snapshot.start && snapshot.end) {
        finalStartTime = snapshot.start;
        finalEndTime = snapshot.end;
        // 根据时间判断 isTask
        isTask = !(hasStart && hasEnd) && !item.isAllDay;
        console.log('%c[🔴 SYNC] ✅ 使用 TimeHub 的最新时间', 'color: green; font-size: 14px', {
          eventId: item.id,
          TimeHub最新: { start: snapshot.start, end: snapshot.end },
          item旧字段: { start: item.startTime, end: item.endTime },
          isTask
        });
      } else {
        // 🔧 TimeHub 无数据，使用 item 字段（fallback）
        // 如果 item 也没有时间，保持空字符串，不自动生成当前时间
        if (item.startTime || item.endTime || item.dueDate) {
          const now = formatTimeForStorage(new Date());
          finalStartTime = item.startTime || item.dueDate || now;
          finalEndTime = item.endTime || item.dueDate || now;
          isTask = !(hasStart && hasEnd) && !item.isAllDay;
          console.log('%c[🔴 SYNC] ⚠️ TimeHub 无时间数据，使用 item 字段', 'color: orange; font-size: 14px', {
            eventId: item.id,
            snapshot,
            fallback: { start: finalStartTime, end: finalEndTime },
            isTask
          });
        } else {
          // item 也没有任何时间，保持空白
          finalStartTime = '';
          finalEndTime = '';
          isTask = true;
          console.log('%c[🔴 SYNC] ⚠️ TimeHub 和 item 都无时间，保持空白', 'color: orange; font-size: 14px', {
            eventId: item.id,
            保持空时间: true
          });
        }
      }
    } else {
      // Event 未创建 → 根据 item 的时间字段判断类型和时间
      if (hasStart && hasEnd) {
        // 有开始和结束 → event (time/allday)
        finalStartTime = item.startTime!;
        finalEndTime = item.endTime!;
        isTask = false;
        console.log('%c[🔴 SYNC] 📅 Event: 有完整时间', 'color: green; font-size: 14px', { start: finalStartTime, end: finalEndTime });
      } else if (hasStart && !hasEnd) {
        // 只有开始时间 → task (日期=开始日期)
        finalStartTime = item.startTime!;
        finalEndTime = item.startTime!;
        isTask = true;
        console.log('%c[🔴 SYNC] 📋 Task: 只有开始时间', 'color: blue; font-size: 14px', { date: finalStartTime });
      } else if (!hasStart && hasEnd) {
        // 只有结束时间 → task (日期=结束日期)
        finalStartTime = item.endTime!;
        finalEndTime = item.endTime!;
        isTask = true;
        console.log('%c[🔴 SYNC] 📋 Task: 只有结束时间', 'color: blue; font-size: 14px', { date: finalEndTime });
      } else {
        // 🔧 完全没有时间 → 保持空时间，不自动生成（用户通过 FloatingBar/@chrono 手动设置）
        finalStartTime = '';
        finalEndTime = '';
        isTask = true;
        console.log('%c[🔴 SYNC] 📋 Task: 无约定时间，保持空白（待用户手动设置）', 'color: blue; font-size: 14px', { 
          eventId: item.id,
          保持空时间: true
        });
      }
    }

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
      // 确保事件标签为 tagId 列表；若历史数据为名称，尝试映射
      tags: (item.tags || []).map(t => {
        // 如果是有效的ID，直接返回；否则尝试按名称映射
        const tag = TagService.getFlatTags().find(x => x.id === t || x.name === t);
        return tag ? tag.id : t;
      }),
      source: 'local',
      syncStatus: 'local-only',
      createdAt: formatTimeForStorage(new Date()),
      updatedAt: formatTimeForStorage(new Date()),
      isTask: isTask,
      category: `priority-${item.priority}`,
      remarkableSource: true,
    };

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
  const renderLinePrefix = (line: FreeFormLine<Event>) => {
    const item = line.data;
    if (!item) return null;

    // 🔧 Description 行不显示 checkbox
    const isDescriptionMode = item.mode === 'description';
    if (isDescriptionMode) {
      return null;
    }

    return (
      <>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.isCompleted || false}
          onChange={(e) => {
            e.stopPropagation();
            const updatedItem = { ...item, isCompleted: e.target.checked };
            onSave(updatedItem);
          }}
        />
        {/* Emoji（可选） */}
        {item.emoji && <span style={{ fontSize: '16px', lineHeight: '1' }}>{item.emoji}</span>}
      </>
    );
  };

  // 渲染右侧后缀（时间 + More 图标）
  const renderLineSuffix = (line: FreeFormLine<Event>) => {
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
  };

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
          items={items.map(item => ({
            id: item.id,
            eventId: item.id,
            level: item.level || 0,
            title: item.title,
            content: item.content || item.title,
            description: item.description,
            tags: item.tags || [],
            // 🆕 v1.5: 透传完整的时间字段和元数据（无字段过滤）
            startTime: item.startTime,
            endTime: item.endTime,
            dueDate: item.dueDate,
            priority: item.priority,
            isCompleted: item.isCompleted,
            isAllDay: item.isAllDay,
            timeSpec: (item as any).timeSpec,
          }))}
          onChange={debouncedOnChange}
          onFocus={(lineId) => {
            // 🆕 更新焦点跟踪
            setCurrentFocusedLineId(lineId);
            
            // 查找当前行的 item 和 mode
            const item = items.find(i => i.id === lineId || i.id === lineId.replace('-desc', ''));
            if (item) {
              const isDescMode = lineId.includes('-desc');
              setCurrentFocusedMode(isDescMode ? 'description' : 'title');
              setCurrentIsTask(item.isTask || false);
            }
          }}
          onEditorReady={(editor) => {
            // 🆕 保存 UnifiedSlateEditor 的编辑器实例
            unifiedEditorRef.current = editor;
          }}
          renderLinePrefix={(line) => {
            // 🔧 移除 -desc 后缀来查找对应的 item
            const baseLineId = line.lineId.replace('-desc', '');
            const item = items.find(i => i.id === baseLineId);
            
            if (!item) return null;
            
            const fakeFormLine: FreeFormLine<Event> = {
              id: line.lineId,
              content: '',
              level: line.level,
              data: { ...item, mode: line.mode },
            };
            
            return renderLinePrefix(fakeFormLine);
          }}
          renderLineSuffix={(line) => {
            // 🔧 移除 -desc 后缀来查找对应的 item
            const baseLineId = line.lineId.replace('-desc', '');
            const item = items.find(i => i.id === baseLineId);
            if (!item) return null;
            
            const fakeFormLine: FreeFormLine<Event> = {
              id: line.lineId,
              content: '',
              level: line.level,
              data: { ...item, mode: line.mode },
            };
            
            return renderLineSuffix(fakeFormLine);
          }}
          placeholder="✨ Enter 创建新事件 | Shift+Enter 切换描述模式 | Tab 调整层级 | ↑↓ 导航"
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
            // 更新 Event
            const updatedPlanItem: Event = {
              ...editingItem,
              ...updatedEvent, // 直接合并所有字段
              content: updatedEvent.description || editingItem.content,
            };
            
            onSave(updatedPlanItem);
            syncToUnifiedTimeline(updatedPlanItem);
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          onDelete={(eventId) => {
            onDelete(editingItem.id);
            setSelectedItemId(null);
            setEditingItem(null);
          }}
          hierarchicalTags={existingTags}
          availableCalendars={[]} // 可以从 props 传入
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
        onTimeApplied={(startIso, endIso) => {
          dbg('picker', '📌 HeadlessFloatingToolbar.onTimeApplied 被调用 (TimeHub已更新)', { 
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

          // 🆕 UnifiedSlateEditor 的 onChange 会自动保存内容
          // 这里只需要确保 EventService 同步时间
          dbg('picker', '💾 onTimeApplied: 时间已由 TimeHub 更新', { 
            itemId: item.id, 
            eventId: item.id,
          });
          
          // ⚠️ 不调用 onSave，因为 UnifiedSlateEditor 的 onChange 会处理
          // ⚠️ 不调用 syncToUnifiedTimeline，因为它会用 item 的旧时间覆盖 TimeHub 刚写入的新时间

          // 统一到 Event：若已有 eventId 则更新时间+非时间字段；若没有则先创建 Event 再写入 TimeHub
          (async () => {
            try {
              if (item.id) {
                // 已有 Event：只更新非时间字段（时间已由 TimeHub 更新）
                dbg('picker', '📝 更新现有 Event (仅非时间字段)', { eventId: item.id });
                await EventService.updateEvent(item.id, {
                  title: item.title,
                  description: item.description || item.content,
                  tags: item.tags,
                  isTask: item.isTask,
                });
                dbg('picker', '✅ Event 更新成功 (仅非时间字段)', { eventId: item.id });
              } else if (startIso) {
                // 没有 Event：先创建 Event，再写入 TimeHub，最后回写 eventId 到 item
                dbg('picker', '🆕 创建新 Event (item 没有 eventId)', { startIso, endIso });
                const newId = generateEventId();
                const createRes = await EventService.createEvent({
                  id: newId,
                  title: item.title || '未命名',
                  description: item.description || item.content,
                  startTime: startIso,
                  endTime: endIso || startIso,
                  isAllDay: false,
                  tags: item.tags,
                  createdAt: formatTimeForStorage(new Date()),
                  updatedAt: formatTimeForStorage(new Date()),
                  remarkableSource: true,
                  isPlan: true, // 🆕 标记为 Plan 事件
                } as any);
                if (createRes.success && createRes.event) {
                  dbg('picker', '✅ 新 Event 创建成功，准备写入 TimeHub', { eventId: newId });
                  // 写入 TimeHub
                  const { TimeHub } = await import('../services/TimeHub');
                  await TimeHub.setEventTime(newId, {
                    start: startIso,
                    end: endIso || startIso,
                    kind: startIso !== (endIso || startIso) ? 'range' : 'fixed',
                    allDay: false,
                    source: 'picker',
                  });
                  dbg('picker', '✅ TimeHub 写入成功', { eventId: newId });
                  // Event 已创建，保存更新后的 item（关联 eventId）
                  const updatedItem = { ...item, id: newId };
                  onSave(updatedItem);
                  // ⚠️ 不要调用 syncToUnifiedTimeline，Event 已创建且 TimeHub 已写入时间
                } else {
                  error('picker', '❌ 创建 Event 失败', { createRes });
                }
              }
            } catch (err) {
              error('picker', '❌ Event 更新/创建异常', { error: err });
            }
          })();
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
          dbg('picker', '⚠️ onDateRangeSelect 被调用 (旧的非TimeHub路径!)', { 
            start: formatTimeForStorage(start), 
            end: formatTimeForStorage(end),
            currentFocusedLineId,
            对应的eventId: currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.id) : undefined,
            警告: '这个回调会插入📅 mention，应该走 onTimeApplied 路径！'
          });
          // 🆕 根据模式决定行为
          if (currentFocusedLineId) {
            const actualItemId = currentFocusedLineId.replace('-desc', '');
            const item = items.find(i => i.id === actualItemId);
            const editor = editorRegistryRef.current.get(currentFocusedLineId);
            
            if (item && editor) {
              const isDescriptionMode = currentFocusedMode === 'description';
              
              // 构建日期 HTML（使用 Tiptap editor.insertContent）
              const dateText = `📅 ${formatDateDisplay(start, true)}${end && end.getTime() !== start.getTime() ? ' - ' + formatDateDisplay(end, true) : ''}`;
              const dateHTML = `<span contenteditable="false" class="${isDescriptionMode ? 'inline-date mention-only' : 'inline-date'}" data-start-date="${formatTimeForStorage(start)}"${end && end.getTime() !== start.getTime() ? ` data-end-date="${formatTimeForStorage(end)}"` : ''} style="display: inline-block; padding: 2px 8px; margin: 0 2px; border-radius: 4px; background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; font-size: 13px; font-weight: 500; cursor: default; user-select: none;">${dateText}</span> `;
              
              editor.chain().focus().insertContent(dateHTML).run();
              
              // 🆕 区分模式保存
              const updatedContent = editor.getHTML();
              
              if (isDescriptionMode) {
                // Description 模式：仅更新 description 内容
                const updatedItem = {
                  ...item,
                  description: updatedContent,
                };
                onSave(updatedItem);
                syncToUnifiedTimeline(updatedItem);
                // 若已关联事件，统一同步非时间字段
                if (updatedItem.id) {
                  EventService.updateEvent(updatedItem.id, {
                    description: updatedItem.description,
                    tags: updatedItem.tags,
                    isTask: updatedItem.isTask,
                  });
                }
              } else {
                // Title 模式：更新 content 并关联时间到元数据
                const updatedItem = {
                  ...item,
                  content: updatedContent,
                  startTime: formatTimeForStorage(start), // 🎯 关联到 Event 元数据
                  endTime: formatTimeForStorage(end && end.getTime() !== start.getTime() ? end : start),
                };
                onSave(updatedItem);
                syncToUnifiedTimeline(updatedItem);

                // 统一到 Event：创建或更新事件
                (async () => {
                  try {
                    const startIso = formatTimeForStorage(start);
                    const endIso = formatTimeForStorage(end && end.getTime() !== start.getTime() ? end : start);
                    if (updatedItem.id) {
                      await EventService.updateEvent(updatedItem.id, {
                        title: updatedItem.title,
                        description: updatedItem.description || updatedItem.content,
                        startTime: startIso,
                        endTime: endIso,
                        isAllDay: false,
                        tags: updatedItem.tags,
                        isTask: updatedItem.isTask,
                      });
                    } else {
                      const newId = generateEventId();
                      const createRes = await EventService.createEvent({
                        id: newId,
                        title: updatedItem.title || '未命名',
                        description: updatedItem.description || updatedItem.content,
                        startTime: startIso,
                        endTime: endIso,
                        isAllDay: false,
                        tags: updatedItem.tags,
                        createdAt: formatTimeForStorage(new Date()),
                        updatedAt: formatTimeForStorage(new Date()),
                        remarkableSource: true,
                        isPlan: true, // 🆕 标记为 Plan 事件
                      } as any);
                      if (createRes.success && createRes.event) {
                        // Event 已创建，直接保存（id已经是newId）
                        onSave(updatedItem);
                        syncToUnifiedTimeline(updatedItem);
                      }
                    }
                  } catch {}
                })();
              }
            }
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
                            await EventService.updateEvent(updatedItem.id, {
                              title: updatedItem.title,
                              description: updatedItem.description || updatedItem.content,
                              tags: updatedItem.tags,
                              isTask: updatedItem.isTask,
                            });
                            dbg('mention', 'Updated existing event (non-time fields) after mention insert', { eventId: updatedItem.id });
                          } else {
                            const newId = generateEventId();
                            const createRes = await EventService.createEvent({
                              id: newId,
                              title: updatedItem.title || '未命名',
                              description: updatedItem.description || updatedItem.content,
                              startTime: formatTimeForStorage(startDate),
                              endTime: formatTimeForStorage(endDate || startDate),
                              isAllDay: false,
                              tags: updatedItem.tags,
                              createdAt: formatTimeForStorage(new Date()),
                              updatedAt: formatTimeForStorage(new Date()),
                              remarkableSource: true,
                              isPlan: true, // 🆕 标记为 Plan 事件
                            } as any);
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
                onApplied={() => {
                  const targetId = pickerTargetItemIdRef.current || currentFocusedLineId || '';
                  if (!targetId) return;
                  const item = items.find(i => i.id === targetId || i.id === targetId.replace('-desc',''));
                  const editableElement = document.querySelector(
                    `[data-line-id="${targetId}"] .ProseMirror`
                  ) as HTMLElement | null;
                  const isDescriptionMode = currentFocusedMode === 'description';

                  // 仅保存当前编辑的HTML，时间由 TimeHub 已更新
                  if (item) {
                    const updatedItem: Event = {
                      ...item,
                      ...(isDescriptionMode
                        ? { description: editableElement?.innerHTML || item.description }
                        : { content: editableElement?.innerHTML || item.content }
                      ),
                    };
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

