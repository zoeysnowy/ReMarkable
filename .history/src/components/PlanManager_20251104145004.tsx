import React, { useState, useRef, useEffect, useMemo, useCallback, useLayoutEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Event } from '../types';
import { FreeFormLine } from './MultiLineEditor/FreeFormEditor';
import { UnifiedSlateEditor } from './UnifiedSlateEditor';
import { insertTag, insertEmoji, insertDateMention, getEditorHTML } from './UnifiedSlateEditor/helpers';
import type { Editor } from 'slate';
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

// 时间显示组件，订阅 TimeHub 更新
const PlanItemTimeDisplay: React.FC<{
  item: PlanItem;
  onEditClick: (anchor: HTMLElement) => void;
}> = ({ item, onEditClick }) => {
  // 如果有 eventId，订阅 TimeHub；否则直接使用 PlanItem 的时间字段
  const eventTime = useEventTime(item.eventId);

  const startTime = eventTime.start ? new Date(eventTime.start) : (item.startTime ? new Date(item.startTime) : null);
  const endTime = eventTime.end ? new Date(eventTime.end) : (item.endTime ? new Date(item.endTime) : null);
  const dueDate = item.dueDate ? new Date(item.dueDate) : null;
  const isAllDay = eventTime.timeSpec?.allDay ?? item.isAllDay;
  // 观察订阅的时间变化，输出调试日志
  useEffect(() => {
    dbg('ui', '🖼️ PlanItemTimeDisplay 快照更新', {
      itemId: item.id,
      eventId: item.eventId,
      TimeHub快照start: eventTime.start,
      TimeHub快照end: eventTime.end,
      TimeHub快照allDay: eventTime.timeSpec?.allDay,
      item本地startTime: item.startTime,
      item本地endTime: item.endTime,
      最终渲染的start: startTime?.toISOString(),
      最终渲染的end: endTime?.toISOString(),
    });
  }, [item.eventId, eventTime.start, eventTime.end, eventTime.timeSpec?.allDay, item.startTime, item.endTime]);

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

// 计划项接口
export interface PlanItem {
  id: string;
  title: string;
  content?: string;
  tags: string[];
  color?: string;
  emoji?: string;
  
  // 时间字段 - 决定类型
  dueDate?: string;      // 截止日期 → Task
  startTime?: string;    // 开始时间 → Event  
  endTime?: string;      // 结束时间 → Event
  isAllDay?: boolean;    // 全天
  
  isCompleted?: boolean;
  isTask?: boolean;      // 🆕 标记为任务（控制 checkbox 显示和任务区域归属）
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  duration?: number;
  notes?: string;
  eventId?: string;
  type?: 'todo' | 'task' | 'event';
  
  // 层级缩进
  level?: number;
  
  // 🆕 双模式支持
  mode?: 'title' | 'description';
  description?: string; // HTML 格式的描述内容
}

export interface PlanManagerProps {
  items: PlanItem[];
  onSave: (item: PlanItem) => void;
  onDelete: (id: string) => void;
  availableTags?: string[];
  onCreateEvent?: (event: Event) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
}

const PlanManager: React.FC<PlanManagerProps> = ({
  items,
  onSave,
  onDelete,
  availableTags = [],
  onCreateEvent,
  onUpdateEvent,
}) => {
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<PlanItem | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  
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
  // 注册单一 UnifiedSlateEditor 实例
  const unifiedEditorRef = useRef<Editor | null>(null);
  
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
    if (!currentFocusedLineId) return;
    const editor = editorRegistryRef.current.get(currentFocusedLineId);
    if (!editor) return;
    const chain = editor.chain().focus();
    switch (command) {
      case 'bold':
        chain.toggleBold().run();
        break;
      case 'italic':
        chain.toggleItalic().run();
        break;
      case 'underline':
        chain.toggleUnderline().run();
        break;
      case 'strikeThrough':
        chain.toggleStrike().run();
        break;
      case 'removeFormat':
        chain.unsetAllMarks().run();
        break;
      // 项目符号
      case 'toggleBulletList':
        chain.toggleBulletList().run();
        break;
      case 'sinkListItem':
        chain.sinkListItem('listItem').run();
        break;
      case 'liftListItem':
        chain.liftListItem('listItem').run();
        break;
      case 'collapseListItem': {
        const view = (editor as any).view as import('prosemirror-view').EditorView;
        const { selection } = view.state;
        const domInfo = view.domAtPos(selection.from);
        const anchorEl = (domInfo.node as HTMLElement).nodeType === 1 ? (domInfo.node as HTMLElement) : (domInfo.node as any).parentElement;
        const li = anchorEl?.closest ? anchorEl.closest('li') : null;
        if (li) li.classList.add('collapsed');
        break;
      }
      case 'expandListItem': {
        const view = (editor as any).view as import('prosemirror-view').EditorView;
        const { selection } = view.state;
        const domInfo = view.domAtPos(selection.from);
        const anchorEl = (domInfo.node as HTMLElement).nodeType === 1 ? (domInfo.node as HTMLElement) : (domInfo.node as any).parentElement;
        const li = anchorEl?.closest ? anchorEl.closest('li') : null;
        if (li) li.classList.remove('collapsed');
        break;
      }
      default:
        break;
    }
  }, [currentFocusedLineId]);

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
          
          // 找到对应的 PlanItem，更新当前选中的标签和 isTask 状态
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

  // 将 PlanItem[] 转换为 FreeFormLine<PlanItem>[]
  const editorLines = useMemo<FreeFormLine<PlanItem>[]>(() => {
    const lines: FreeFormLine<PlanItem>[] = [];

    // 根据 position（若无则按原数组索引）进行排序，确保新建行按期望顺序显示
    const sortedItems = [...items].sort((a: any, b: any) => {
      const pa = (a as any).position ?? items.indexOf(a);
      const pb = (b as any).position ?? items.indexOf(b);
      return pa - pb;
    });

  sortedItems.forEach((item) => {
      // 🔴 安全检查：跳过没有 id 的 item
      if (!item.id) {
        console.warn('[PlanManager] Skipping item without id:', item);
        return;
      }
      
      // Title 行
      lines.push({
        id: item.id,
        content: item.content || item.title,
        level: item.level || 0,
        // 强制 Title 行始终是 title 模式，避免 Shift+Enter 后把现有行变成 description
        data: { ...item, mode: 'title' },
      });
      
      // 如果处于 description 模式，则无论内容是否为空都渲染描述行
      if (item.mode === 'description') {
        lines.push({
          id: `${item.id}-desc`,
          content: item.description || '',
          level: (item.level || 0) + 1, // 缩进一级
          data: { ...item, mode: 'description' },
        });
      }
    });
    
    return lines;
  }, [items]);

  // 处理编辑器内容变化
  const handleLinesChange = (newLines: FreeFormLine<PlanItem>[]) => {
    // 记录新顺序中每个 title 行的 itemId 顺序
    const orderedItemIds: string[] = [];

    // 按 item id 分组（title + description），同时保留顺序
    const itemGroups = new Map<string, { title?: FreeFormLine<PlanItem>, description?: FreeFormLine<PlanItem> }>();

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
    const newItemIds = Array.from(itemGroups.keys());
    const deletedIds = currentItemIds.filter(id => !newItemIds.includes(id));
    deletedIds.forEach(id => onDelete(id));

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
        const updatedItem: PlanItem = {
          ...(titleLine.data as any),
          id: (titleLine.data as any)?.id ?? itemId,
          title: plainText,
          content: titleLine.content,
          tags: extractedTags,
          level: titleLine.level,
          mode: (descLine ? 'description' : 'title') as 'title' | 'description',
          description: descLine?.content || undefined,
          ...(Number.isFinite(position) ? { position } : {}),
        } as any;
        
        // 🔍 诊断日志：检查 eventId 来源
        dbg('picker', '📊 handleLinesChange: 检查 eventId', {
          itemId: updatedItem.id,
          'titleLine.data.eventId': (titleLine.data as any)?.eventId,
          'updatedItem.eventId': updatedItem.eventId,
          '从items数组查找': items.find(i => i.id === updatedItem.id)?.eventId,
        });
        
        onSave(updatedItem);
        // 🆕 更新时也同步到日历（但如果有 eventId，时间由 TimeHub 管理，跳过时间同步）
        if (!updatedItem.eventId) {
          dbg('picker', '🔄 handleLinesChange: 调用 syncToUnifiedTimeline (无 eventId)', { itemId: updatedItem.id });
          syncToUnifiedTimeline(updatedItem);
        } else {
          dbg('picker', '⏭️ handleLinesChange: 跳过 syncToUnifiedTimeline (item 有 eventId，时间由 TimeHub 管理)', { itemId: updatedItem.id, eventId: updatedItem.eventId });
        }
      } else {
        const newItem: PlanItem = {
          id: titleLine.id,
          title: plainText,
          content: titleLine.content,
          tags: extractedTags,
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
          level: titleLine.level,
          mode: descLine ? 'description' : 'title',
          description: descLine?.content || undefined,
          ...(Number.isFinite(position) ? { position } : {}),
        } as any;
        onSave(newItem);
        // 新 item 没有 eventId，正常同步
        syncToUnifiedTimeline(newItem);
      }
    });
  };

  // 将 PlanItem 转换为 Event（用于 EventEditModal）
  const convertPlanItemToEvent = (item: PlanItem): Event => {
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
      id: item.eventId || `event-${Date.now()}`,
      title: item.title,
      description: item.notes || sanitize(item.description || item.content || ''),
      startTime: item.startTime || item.dueDate || new Date().toISOString(),
      endTime: item.endTime || item.dueDate || new Date().toISOString(),
      location: '', // PlanItem 没有 location 字段，保留空值
      isAllDay: !item.startTime && !!item.dueDate,
      tags: mappedTags,
      tagId: mappedTags.length > 0 ? mappedTags[0] : undefined,
      calendarId: undefined,
      calendarIds: [],
      source: 'local',
      syncStatus: 'local-only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
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
  const syncToUnifiedTimeline = (item: PlanItem) => {
    // 🔍 诊断：强制输出日志（不经过 dbg 检查）
    console.log('%c[🔴 SYNC] syncToUnifiedTimeline 被调用', 'color: red; font-size: 16px; font-weight: bold', {
      itemId: item.id,
      eventId: item.eventId,
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
    
    if (item.eventId) {
      // 如果有 eventId，从 TimeHub 读取最新时间
      const snapshot = TimeHub.getSnapshot(item.eventId);
      if (snapshot.start && snapshot.end) {
        finalStartTime = snapshot.start;
        finalEndTime = snapshot.end;
        // 根据时间判断 isTask
        isTask = !(hasStart && hasEnd) && !item.isAllDay;
        console.log('%c[🔴 SYNC] ✅ 使用 TimeHub 的最新时间', 'color: green; font-size: 14px', {
          eventId: item.eventId,
          TimeHub最新: { start: snapshot.start, end: snapshot.end },
          item旧字段: { start: item.startTime, end: item.endTime },
          isTask
        });
      } else {
        // TimeHub 无数据，使用 item 字段（fallback）
        const now = new Date().toISOString();
        finalStartTime = item.startTime || item.dueDate || now;
        finalEndTime = item.endTime || item.dueDate || now;
        isTask = !(hasStart && hasEnd) && !item.isAllDay;
        console.log('%c[🔴 SYNC] ⚠️ TimeHub 无时间数据，使用 item 字段', 'color: orange; font-size: 14px', {
          eventId: item.eventId,
          snapshot,
          fallback: { start: finalStartTime, end: finalEndTime },
          isTask
        });
      }
    } else {
      // 没有 eventId，根据时间字段判断
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
        // 完全没有时间 → task (日期=创建日期)
        // 从 item.id 提取创建时间戳（格式: line-{timestamp}）
        const timestampMatch = item.id.match(/line-(\d+)/);
        const createdDate = timestampMatch 
          ? new Date(parseInt(timestampMatch[1])).toISOString()
          : new Date().toISOString(); // fallback 到今天
        finalStartTime = createdDate;
        finalEndTime = createdDate;
        isTask = true;
        console.log('%c[🔴 SYNC] 📋 Task: 无约定时间，使用创建日期', 'color: blue; font-size: 14px', { 
          date: createdDate,
          从itemId提取: timestampMatch ? '成功' : '失败(使用今天)'
        });
      }
    }

    const event: Event = {
      id: item.eventId || `event-${Date.now()}`,
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTask: isTask,
      category: `priority-${item.priority}`,
      remarkableSource: true,
    };

    if (item.eventId && onUpdateEvent) {
      onUpdateEvent(item.eventId, event);
    } else if (onCreateEvent) {
      onCreateEvent(event);
      item.eventId = event.id;
    }
  };

  const getTypeIcon = (item: PlanItem) => {
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
  const renderLinePrefix = (line: FreeFormLine<PlanItem>) => {
    const item = line.data;
    if (!item) return null;

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
  const renderLineSuffix = (line: FreeFormLine<PlanItem>) => {
    const item = line.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 0, fontSize: '14px', justifyContent: 'flex-end' }}>
        {/* 时间显示（使用订阅 TimeHub 的组件） */}
        <PlanItemTimeDisplay
          item={item}
          onEditClick={(anchor) => {
            dbg('ui', '🖱️ 点击右侧时间区域，打开 UnifiedDateTimePicker', { eventId: item.eventId, itemId: item.id });
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

  // EventLineNode 适配器 - 将 EventLineNode 转换为 FreeFormLine 供现有渲染器使用
  const renderLinePrefixAdapter = useCallback((node: { eventId?: string; lineId: string; level: number; mode: 'title' | 'description' }) => {
    const item = items.find(i => i.id === node.eventId);
    if (!item) return null;
    
    return renderLinePrefix({
      id: node.lineId,
      content: '',
      level: node.level,
      data: item,
    } as FreeFormLine<PlanItem>);
  }, [items]);

  const renderLineSuffixAdapter = useCallback((node: { eventId?: string; lineId: string; level: number; mode: 'title' | 'description' }) => {
    const item = items.find(i => i.id === node.eventId);
    if (!item) return null;
    
    return renderLineSuffix({
      id: node.lineId,
      content: '',
      level: node.level,
      data: item,
    } as FreeFormLine<PlanItem>);
  }, [items]);

  // 渲染内容样式（不需要自己实现 contentEditable，只提供样式）
  const getContentStyle = (item: PlanItem) => ({
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
        <SlateFreeFormEditor
            lines={editorLines}
            onLinesChange={handleLinesChange}
            renderLinePrefix={renderLinePrefix}
            renderLineSuffix={renderLineSuffix}
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
            // 将 Event 转回 PlanItem
            const updatedPlanItem: PlanItem = {
              ...editingItem,
              title: updatedEvent.title,
              content: updatedEvent.description || editingItem.content,
              tags: updatedEvent.tags || [],
              startTime: updatedEvent.startTime,
              endTime: updatedEvent.endTime,
              isAllDay: updatedEvent.isAllDay,
              notes: updatedEvent.description,
              eventId: updatedEvent.id,
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
        eventId={currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.eventId) : undefined}
        useTimeHub={true}
        onTimeApplied={(startIso, endIso) => {
          dbg('picker', '📌 HeadlessFloatingToolbar.onTimeApplied 被调用 (TimeHub已更新)', { 
            startIso, 
            endIso, 
            focusedLineId: currentFocusedLineId,
            对应的eventId: currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.eventId) : undefined
          });
          const targetId = currentFocusedLineId || '';
          if (!targetId) {
            warn('picker', '⚠️ onTimeApplied: 没有 focusedLineId，跳过');
            return;
          }
          const actualItemId = targetId.replace('-desc','');
          const item = items.find(i => i.id === actualItemId);
          const editor = editorRegistryRef.current.get(targetId);
          const isDescriptionMode = currentFocusedMode === 'description';

          if (!item) {
            warn('picker', '⚠️ onTimeApplied: 找不到对应的 item', { targetId, actualItemId });
            return;
          }
          if (!editor) {
            warn('picker', '⚠️ onTimeApplied: 找不到对应的 editor', { targetId });
            return;
          }

          // 保存（外层只更新非时间字段；时间由 TimeHub 维护）
          const updatedHTML = editor.getHTML();
          const updatedItem: PlanItem = {
            ...item,
            ...(isDescriptionMode
              ? { description: updatedHTML }
              : { content: updatedHTML }
            ),
          };
          dbg('picker', '💾 onTimeApplied: 保存 item (仅非时间字段)', { 
            itemId: updatedItem.id, 
            eventId: updatedItem.eventId,
            isDescriptionMode,
            内容长度: updatedHTML.length
          });
          onSave(updatedItem);
          // ⚠️ 不要调用 syncToUnifiedTimeline，因为它会用 item 的旧时间覆盖 TimeHub 刚写入的新时间
          // syncToUnifiedTimeline(updatedItem);

          // 统一到 Event：若已有 eventId 则更新时间+非时间字段；若没有则先创建 Event 再写入 TimeHub
          (async () => {
            try {
              if (updatedItem.eventId) {
                // 已有 Event：只更新非时间字段（时间已由 TimeHub 更新）
                dbg('picker', '📝 更新现有 Event (仅非时间字段)', { eventId: updatedItem.eventId });
                await EventService.updateEvent(updatedItem.eventId, {
                  title: updatedItem.title,
                  description: updatedItem.description || updatedItem.content,
                  tags: updatedItem.tags,
                  isTask: updatedItem.isTask,
                });
                dbg('picker', '✅ Event 更新成功 (仅非时间字段)', { eventId: updatedItem.eventId });
              } else if (startIso) {
                // 没有 Event：先创建 Event，再写入 TimeHub，最后回写 eventId 到 item
                dbg('picker', '🆕 创建新 Event (item 没有 eventId)', { startIso, endIso });
                const newId = generateEventId();
                const createRes = await EventService.createEvent({
                  id: newId,
                  title: updatedItem.title || '未命名',
                  description: updatedItem.description || updatedItem.content,
                  startTime: startIso,
                  endTime: endIso || startIso,
                  isAllDay: false,
                  tags: updatedItem.tags,
                  createdAt: formatTimeForStorage(new Date()),
                  updatedAt: formatTimeForStorage(new Date()),
                  remarkableSource: true,
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
                  dbg('picker', '✅ TimeHub 写入成功，回写 eventId 到 item', { eventId: newId });
                  // 回写 eventId
                  const withEvent: PlanItem = { ...updatedItem, eventId: newId };
                  onSave(withEvent);
                  // ⚠️ 不要调用 syncToUnifiedTimeline，Event 已创建且 TimeHub 已写入时间
                  // syncToUnifiedTimeline(withEvent);
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
          // 计算新增标签（与上一次所选差集）
          const addedIds = tagIds.filter(id => !currentSelectedTagsRef.current.includes(id));

          // 先更新当前所选标签状态（避免后续 diff 再次重复）
          currentSelectedTagsRef.current = tagIds;
          setCurrentSelectedTags(tagIds);

          // 仅插入最新新增的那一个，避免多次插入造成重复
          if (!currentFocusedLineId || addedIds.length === 0) return;
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

          const editor = editorRegistryRef.current.get(currentFocusedLineId);
          if (!editor) return;

          // 使用 Tiptap 命令在当前光标处插入，确保光标位置正确恢复
          editor.chain().focus().run();

          const isDescriptionMode = currentFocusedMode === 'description';
          const tag = TagService.getTagById(insertId);
          if (!tag) return;

          const hexToRgba = (hex: string, alpha: number) => {
            const r = parseInt(hex.slice(1, 3), 16);
            const g = parseInt(hex.slice(3, 5), 16);
            const b = parseInt(hex.slice(5, 7), 16);
            return `rgba(${r}, ${g}, ${b}, ${alpha})`;
          };

          const tagColor = tag.color || '#666';
          const tagEmoji = tag.emoji || '';
          const displayName = tagEmoji ? `${tagEmoji}${tag.name}` : tag.name;

          // 通过自定义 TagNode 在正确位置插入，并追加空格
          editor
            .chain()
            .focus()
            .insertContent({
              type: 'tag',
              attrs: {
                tagId: insertId,
                tagName: tag.name,
                tagColor,
                tagEmoji,
                mentionOnly: isDescriptionMode,
              },
            })
            .insertContent(' ')
            .run();

          // 保存（Title: 提取标签并更新元数据；Description: 仅更新 description HTML）
          const updatedContent = editor.getHTML();
          if (isDescriptionMode) {
            const updatedItem = { ...item, description: updatedContent };
            onSave(updatedItem);
          } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = updatedContent;
            const tagElements = tempDiv.querySelectorAll('[data-type="tag"]:not([data-mention-only="true"])');
            const extractedTags: string[] = [];
            tagElements.forEach(tagEl => {
              const tagName = tagEl.getAttribute('data-tag-name');
              if (tagName) extractedTags.push(tagName);
            });
            const plainText = tempDiv.textContent || '';
            const updatedItem = { ...item, title: plainText, content: updatedContent, tags: extractedTags };
            onSave(updatedItem);
          }
        }}
        onEmojiSelect={(emoji: string) => {
          if (!currentFocusedLineId) return;
          const actualItemId = currentFocusedLineId.replace('-desc', '');
          const item = items.find(i => i.id === actualItemId);
          const editor = editorRegistryRef.current.get(currentFocusedLineId);
          if (!item || !editor) return;

          // 使用 Tiptap 插入 emoji，确保使用编辑器保存的选区
          editor.chain().focus().insertContent(emoji + ' ').run();

          // 保存变更
          const updatedContent = editor.getHTML();
          const isDescriptionMode = currentFocusedMode === 'description';
          if (isDescriptionMode) {
            const updatedItem = { ...item, description: updatedContent };
            onSave(updatedItem);
          } else {
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = updatedContent;
            const plainText = tempDiv.textContent || '';
            const updatedItem = { ...item, title: plainText, content: updatedContent };
            onSave(updatedItem);
          }
        }}
        onDateRangeSelect={(start: Date, end: Date) => {
          dbg('picker', '⚠️ onDateRangeSelect 被调用 (旧的非TimeHub路径!)', { 
            start: start.toISOString(), 
            end: end.toISOString(),
            currentFocusedLineId,
            对应的eventId: currentFocusedLineId ? (items.find(i => i.id === currentFocusedLineId.replace('-desc',''))?.eventId) : undefined,
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
              const dateHTML = `<span contenteditable="false" class="${isDescriptionMode ? 'inline-date mention-only' : 'inline-date'}" data-start-date="${start.toISOString()}"${end && end.getTime() !== start.getTime() ? ` data-end-date="${end.toISOString()}"` : ''} style="display: inline-block; padding: 2px 8px; margin: 0 2px; border-radius: 4px; background-color: rgba(59, 130, 246, 0.1); color: #3b82f6; font-size: 13px; font-weight: 500; cursor: default; user-select: none;">${dateText}</span> `;
              
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
                if (updatedItem.eventId) {
                  EventService.updateEvent(updatedItem.eventId, {
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
                  startTime: start.toISOString(), // 🎯 关联到 Event 元数据
                  endTime: (end && end.getTime() !== start.getTime()) ? end.toISOString() : start.toISOString(),
                };
                onSave(updatedItem);
                syncToUnifiedTimeline(updatedItem);

                // 统一到 Event：创建或更新事件
                (async () => {
                  try {
                    const startIso = formatTimeForStorage(start);
                    const endIso = formatTimeForStorage(end && end.getTime() !== start.getTime() ? end : start);
                    if (updatedItem.eventId) {
                      await EventService.updateEvent(updatedItem.eventId, {
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
                      } as any);
                      if (createRes.success && createRes.event) {
                        const withEvent: PlanItem = { ...updatedItem, eventId: newId };
                        onSave(withEvent);
                        syncToUnifiedTimeline(withEvent);
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
              const updatedItem: PlanItem = {
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
                eventId={(pickerTargetItemIdRef.current || currentFocusedLineId) ? (items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId)!.replace('-desc',''))?.eventId) : undefined}
                useTimeHub={true}
                onDateSelect={(startDate, endDate, rawText) => {
                  dbg('mention', 'DateMentionPicker onDateSelect', {
                    targetItemId: pickerTargetItemIdRef.current || currentFocusedLineId,
                    eventId: (pickerTargetItemIdRef.current || currentFocusedLineId) ? (items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId)!.replace('-desc',''))?.eventId) : undefined,
                    start: startDate?.toISOString?.(),
                    end: endDate?.toISOString?.(),
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
                      // 更新 PlanItem，并统一到 Event
                      const updatedHTML = editor.getHTML();
                      const updatedItem = {
                        ...item,
                        startTime: startDate.toISOString(),
                        endTime: endDate?.toISOString() || startDate.toISOString(),
                        content: updatedHTML,
                      } as PlanItem;
                      onSave(updatedItem);
                      syncToUnifiedTimeline(updatedItem);

                      // 同步到 Event：若已有 eventId，仅更新非时间字段；若没有，则创建 Event 并回写 eventId
                      (async () => {
                        try {
                          if (updatedItem.eventId) {
                            await EventService.updateEvent(updatedItem.eventId, {
                              title: updatedItem.title,
                              description: updatedItem.description || updatedItem.content,
                              tags: updatedItem.tags,
                              isTask: updatedItem.isTask,
                            });
                            dbg('mention', 'Updated existing event (non-time fields) after mention insert', { eventId: updatedItem.eventId });
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
                            } as any);
                            if (createRes.success && createRes.event) {
                              const withEvent: PlanItem = { ...updatedItem, eventId: newId };
                              onSave(withEvent);
                              syncToUnifiedTimeline(withEvent);
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
                eventId={(items.find(i => i.id === (pickerTargetItemIdRef.current || currentFocusedLineId || '').replace('-desc',''))?.eventId) || undefined}
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
                    const updatedItem: PlanItem = {
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
