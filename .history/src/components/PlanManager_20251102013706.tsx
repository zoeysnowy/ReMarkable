import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import type { Event } from '../types';
import { FreeFormEditor, FreeFormLine } from './MultiLineEditor/FreeFormEditor';
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { HeadlessFloatingToolbar } from './FloatingToolbar/HeadlessFloatingToolbar';
import { ToolbarConfig } from './FloatingToolbar/types';
import { TagService } from '../services/TagService';
import { DateMentionPicker } from './shared/DateMentionPicker';
import { formatDateDisplay } from '../utils/dateParser';
import { EventEditModal } from './EventEditModal';
import { icons } from '../assets/icons';
import './PlanManager.css';

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
  
  isCompleted?: boolean;
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
  
  // 日期提及弹窗
  const [showDateMention, setShowDateMention] = useState(false);
  const dateAnchorRef = useRef<HTMLSpanElement | null>(null);
  
  // 标签替换
  const [replacingTagElement, setReplacingTagElement] = useState<HTMLElement | null>(null);
  const [showTagReplace, setShowTagReplace] = useState(false);
  
  // FloatingToolbarV2 配置 - quick-action 模式
  const toolbarConfig: ToolbarConfig = {
    mode: 'quick-action',
    features: ['tag', 'emoji', 'dateRange', 'priority', 'color'],
  };
  
  // FloatingToolbar
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const [activePickerIndex, setActivePickerIndex] = useState<number | null>(null);
  
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorContainerRef as React.RefObject<HTMLElement>,
    enabled: true,
    menuItemCount: toolbarConfig.features.length,
    onMenuSelect: (menuIndex: number) => {
      setActivePickerIndex(menuIndex);
      // 延迟重置，确保 HeadlessFloatingToolbar 能接收到变化
      setTimeout(() => setActivePickerIndex(null), 100);
    },
  });

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
          
          // 找到对应的 PlanItem，更新当前选中的标签
          const item = items.find(i => i.id === lineId);
          if (item && item.tags) {
            // 将标签名称转换为标签ID
            const tagIds = item.tags
              .map(tagName => {
                const tag = TagService.getFlatTags().find(t => t.name === tagName);
                return tag?.id;
              })
              .filter(Boolean) as string[];
            setCurrentSelectedTags(tagIds);
            currentSelectedTagsRef.current = tagIds; // 同步更新 ref
          } else {
            setCurrentSelectedTags([]);
            currentSelectedTagsRef.current = []; // 同步更新 ref
          }
        }
      }
    };
    
    // 监听 @ 键触发日期输入
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (!target.hasAttribute('contenteditable')) return;
      
      // 检测 @ 键（Shift+2）
      if (e.key === '@' || (e.shiftKey && e.key === '2')) {
        e.preventDefault(); // 阻止 @ 字符输入
        
        const selection = window.getSelection();
        if (selection && selection.rangeCount > 0) {
          const range = selection.getRangeAt(0);
          
          // 创建一个隐藏的 anchor 元素用于定位
          const anchor = document.createElement('span');
          anchor.style.cssText = 'display: inline-block; width: 0; height: 0;';
          range.insertNode(anchor);
          
          // 保存 anchor 引用
          dateAnchorRef.current = anchor;
          
          // 显示日期选择器
          setShowDateMention(true);
        }
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
    
    items.forEach((item) => {
      // Title 行
      lines.push({
        id: item.id,
        content: item.content || item.title,
        level: item.level || 0,
        data: { ...item, mode: item.mode || 'title' },
      });
      
      // 如果有 description，添加 description 行
      if (item.description && item.mode === 'description') {
        lines.push({
          id: `${item.id}-desc`,
          content: item.description,
          level: (item.level || 0) + 1, // 缩进一级
          data: { ...item, mode: 'description' },
        });
      }
    });
    
    return lines;
  }, [items]);

  // 处理编辑器内容变化
  const handleLinesChange = (newLines: FreeFormLine<PlanItem>[]) => {
    // 按 item id 分组（title + description）
    const itemGroups = new Map<string, { title?: FreeFormLine<PlanItem>, description?: FreeFormLine<PlanItem> }>();
    
    newLines.forEach((line) => {
      const itemId = line.id.includes('-desc') ? line.id.replace('-desc', '') : line.id;
      const isDescription = line.id.includes('-desc') || line.data?.mode === 'description';
      
      if (!itemGroups.has(itemId)) {
        itemGroups.set(itemId, {});
      }
      
      const group = itemGroups.get(itemId)!;
      if (isDescription) {
        group.description = line;
      } else {
        group.title = line;
      }
    });
    
    // 处理每个 item 组
    itemGroups.forEach((group, itemId) => {
      const titleLine = group.title;
      const descLine = group.description;
      
      if (!titleLine) return; // 没有 title 行，跳过
      
      // 从 title HTML 内容中提取纯文本和标签
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = titleLine.content;
      
      // 提取标签
      const tagElements = tempDiv.querySelectorAll('.inline-tag');
      const extractedTags: string[] = [];
      tagElements.forEach(tagEl => {
        const tagName = tagEl.getAttribute('data-tag-name');
        if (tagName) extractedTags.push(tagName);
      });
      
      // 提取纯文本（移除标签后的文本）
      const plainText = tempDiv.textContent || '';
      
      if (titleLine.data) {
        const updatedItem = { 
          ...titleLine.data, 
          title: plainText,
          content: titleLine.content, // 保存 HTML 用于显示
          tags: extractedTags,
          level: titleLine.level,
          mode: descLine ? 'description' : 'title', // 🆕 有 description 行则标记为 description 模式
          description: descLine?.content || undefined, // 🆕 保存 description HTML
        };
        onSave(updatedItem);
      } else {
        // 创建新项目
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
        };
        onSave(newItem);
        syncToUnifiedTimeline(newItem);
      }
    });
  };

  // 将 PlanItem 转换为 Event（用于 EventEditModal）
  const convertPlanItemToEvent = (item: PlanItem): Event => {
    return {
      id: item.eventId || `event-${Date.now()}`,
      title: item.title,
      description: item.notes || item.content || '',
      startTime: item.startTime || item.dueDate || new Date().toISOString(),
      endTime: item.endTime || item.dueDate || new Date().toISOString(),
      location: '', // PlanItem 没有 location 字段，保留空值
      isAllDay: !item.startTime && !!item.dueDate,
      tags: item.tags,
      tagId: item.tags.length > 0 ? item.tags[0] : undefined,
      calendarId: undefined,
      calendarIds: [],
      source: 'local',
      syncStatus: 'local-only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      remarkableSource: true,
    };
  };

  // 计算类型
  const getItemType = (item: PlanItem): 'todo' | 'task' | 'event' => {
    if (item.startTime && item.endTime) return 'event';
    if (item.dueDate) return 'task';
    return 'todo';
  };

  // 同步到UnifiedTimeline
  const syncToUnifiedTimeline = (item: PlanItem) => {
    const type = getItemType(item);
    if (type === 'todo') return;

    const event: Event = {
      id: item.eventId || `event-${Date.now()}`,
      title: `${item.emoji || ''}${item.title}`.trim(),
      description: item.content || item.notes || '',
      startTime: item.startTime || item.dueDate || new Date().toISOString(),
      endTime: item.endTime || item.dueDate || new Date().toISOString(),
      isAllDay: !item.startTime && !!item.dueDate,
      tags: item.tags,
      source: 'local',
      syncStatus: 'local-only',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isTask: type === 'task',
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
    const type = getItemType(item);
    // 不再返回 ☐，因为已经有真实的 checkbox
    return type === 'event' ? '📅' : type === 'task' ? '📋' : '';
  };

  // 渲染左侧前缀（Checkbox + Emoji，无类型图标）
  const renderLinePrefix = (line: FreeFormLine<PlanItem>) => {
    const item = line.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Checkbox */}
        <input
          type="checkbox"
          checked={item.isCompleted || false}
          onChange={(e) => {
            e.stopPropagation();
            const updatedItem = { ...item, isCompleted: e.target.checked };
            onSave(updatedItem);
          }}
          style={{ cursor: 'pointer', width: '18px', height: '18px' }}
        />
        {/* Emoji（可选） */}
        {item.emoji && <span style={{ fontSize: '16px' }}>{item.emoji}</span>}
      </div>
    );
  };

  // 渲染右侧后缀（时间 + More 图标）
  const renderLineSuffix = (line: FreeFormLine<PlanItem>) => {
    const item = line.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px', justifyContent: 'flex-end' }}>
        {/* 时间 */}
        {(item.dueDate || item.startTime) && (
          <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
            ⏰ {item.startTime 
              ? new Date(item.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : `截止 ${new Date(item.dueDate!).toLocaleDateString('zh-CN')}`
            }
          </span>
        )}
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
        <FreeFormEditor
            lines={editorLines}
            onLinesChange={handleLinesChange}
            renderLinePrefix={renderLinePrefix}
            renderLineSuffix={renderLineSuffix}
            placeholder="✨ 点击创建新任务，按 Enter 快速创建，Tab 调整层级，↑↓ 导航"
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

      {/* Headless FloatingToolbar V3 */}
      <HeadlessFloatingToolbar
        position={floatingToolbar.position}
        config={toolbarConfig}
        activePickerIndex={activePickerIndex}
        onTextFormat={floatingToolbar.applyFormat}
        onTagSelect={(tagIds: string[]) => {
          
          // 找出新增的标签（只插入新增的）
          const newTagIds = tagIds.filter(id => !currentSelectedTagsRef.current.includes(id));
          
          // 立即更新 ref，避免连续调用时重复
          currentSelectedTagsRef.current = tagIds;
          
          // 更新当前选中的标签 state
          setCurrentSelectedTags(tagIds);
          
          // 只插入新增的标签到光标位置
          if (currentFocusedLineId && newTagIds.length > 0) {
            const item = items.find(i => i.id === currentFocusedLineId);
            
            if (item) {
              // 获取当前聚焦的 contentEditable 元素
              const editableElement = document.querySelector(
                `[data-line-id="${currentFocusedLineId}"]`
              ) as HTMLElement;
              
              if (editableElement && editableElement.isContentEditable) {
                // 确保元素有焦点
                if (document.activeElement !== editableElement) {
                  editableElement.focus();
                }
                
                // 只为新增的标签创建 HTML
                newTagIds.forEach(tagId => {
                  const tag = TagService.getTagById(tagId);
                  if (!tag) return;
                  
                  // 将颜色转换为 rgba
                  const hexToRgba = (hex: string, alpha: number) => {
                    const r = parseInt(hex.slice(1, 3), 16);
                    const g = parseInt(hex.slice(3, 5), 16);
                    const b = parseInt(hex.slice(5, 7), 16);
                    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
                  };
                  
                  const tagColor = tag.color || '#666';
                  const tagEmoji = tag.emoji || '';
                  const displayName = tagEmoji ? `${tagEmoji}${tag.name}` : tag.name;
                  
                  // 创建标签 span（不可编辑）
                  const tagSpan = document.createElement('span');
                  tagSpan.contentEditable = 'false';
                  tagSpan.setAttribute('data-tag-id', tagId);
                  tagSpan.setAttribute('data-tag-name', tag.name);
                  tagSpan.className = 'inline-tag';
                  tagSpan.style.cssText = `
                    display: inline-block;
                    padding: 2px 6px;
                    margin: 0 2px;
                    border-radius: 4px;
                    background-color: ${hexToRgba(tagColor, 0.15)};
                    color: ${tagColor};
                    font-size: 12px;
                    font-weight: 500;
                    cursor: pointer;
                    user-select: none;
                  `;
                  tagSpan.textContent = `#${displayName}`;
                  
                  // 在光标位置插入
                  const selection = window.getSelection();
                  if (selection && selection.rangeCount > 0) {
                    const range = selection.getRangeAt(0);
                    range.deleteContents();
                    range.insertNode(tagSpan);
                    
                    // 在标签后添加一个空格，方便继续输入
                    const space = document.createTextNode(' ');
                    range.collapse(false);
                    range.insertNode(space);
                    
                    // 移动光标到空格后
                    range.setStartAfter(space);
                    range.setEndAfter(space);
                    selection.removeAllRanges();
                    selection.addRange(range);
                  }
                });
                
                // 手动触发保存（不使用 blur/focus，避免焦点混乱）
                const updatedContent = editableElement.innerHTML;
                
                // 从 HTML 内容中提取纯文本和标签
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = updatedContent;
                
                // 提取标签
                const tagElements = tempDiv.querySelectorAll('.inline-tag');
                const extractedTags: string[] = [];
                tagElements.forEach(tagEl => {
                  const tagName = tagEl.getAttribute('data-tag-name');
                  if (tagName) extractedTags.push(tagName);
                });
                
                // 提取纯文本
                const plainText = tempDiv.textContent || '';
                
                const updatedItem = {
                  ...item,
                  title: plainText,
                  content: updatedContent,
                  tags: extractedTags,
                };
                
                onSave(updatedItem);
              }
            }
          }
        }}
        onEmojiSelect={(emoji: string) => {
          // TODO: 应用 emoji 到当前选中的项目
        }}
        onDateRangeSelect={(start: Date, end: Date) => {
          // TODO: 应用日期范围到当前选中的项目
        }}
        onPrioritySelect={(priority: 'low' | 'medium' | 'high' | 'urgent') => {
          // TODO: 应用优先级到当前选中的项目
        }}
        onColorSelect={(color: string) => {
          // TODO: 应用颜色到当前选中的项目
        }}
        availableTags={existingTags}
        currentTags={currentSelectedTags}
      />
      
      {/* 日期提及弹窗 - 使用 Tippy 定位 */}
      {dateAnchorRef.current && (
        <Tippy
          visible={showDateMention}
          reference={dateAnchorRef.current}
          placement="bottom-start"
          interactive={true}
          arrow={false}
          offset={[0, 8]}
          appendTo={() => document.body}
          theme="light"
          onClickOutside={() => {
            setShowDateMention(false);
            // 清理 anchor
            if (dateAnchorRef.current) {
              dateAnchorRef.current.remove();
              dateAnchorRef.current = null;
            }
          }}
          content={
            <DateMentionPicker
                onDateSelect={(startDate, endDate) => {
                  // 在 anchor 位置插入日期 mention
                  if (currentFocusedLineId && dateAnchorRef.current) {
                    const item = items.find(i => i.id === currentFocusedLineId);
                    const editableElement = document.querySelector(
                      `[data-line-id="${currentFocusedLineId}"]`
                    ) as HTMLElement;
                    
                    if (editableElement && editableElement.isContentEditable) {
                      // 创建日期 span
                      const dateSpan = document.createElement('span');
                      dateSpan.contentEditable = 'false';
                      dateSpan.className = 'inline-date';
                      dateSpan.setAttribute('data-start-date', startDate.toISOString());
                      if (endDate) {
                        dateSpan.setAttribute('data-end-date', endDate.toISOString());
                      }
                      dateSpan.style.cssText = `
                        display: inline-block;
                        padding: 2px 8px;
                        margin: 0 2px;
                        border-radius: 4px;
                        background-color: rgba(59, 130, 246, 0.1);
                        color: #3b82f6;
                        font-size: 13px;
                        font-weight: 500;
                        cursor: default;
                        user-select: none;
                      `;
                      dateSpan.textContent = `📅 ${formatDateDisplay(startDate, true)}`;
                      
                      // 在 anchor 位置插入日期
                      const anchor = dateAnchorRef.current;
                      anchor.parentNode?.insertBefore(dateSpan, anchor);
                      
                      // 添加空格
                      const space = document.createTextNode(' ');
                      anchor.parentNode?.insertBefore(space, anchor);
                      
                      // 移动光标到空格后
                      const selection = window.getSelection();
                      const range = document.createRange();
                      range.setStartAfter(space);
                      range.collapse(true);
                      selection?.removeAllRanges();
                      selection?.addRange(range);
                      
                      // 清理 anchor
                      anchor.remove();
                      
                      // 更新 PlanItem 的日期字段
                      if (item) {
                        const updatedItem = {
                          ...item,
                          startTime: startDate.toISOString(),
                          endTime: endDate?.toISOString() || startDate.toISOString(),
                          content: editableElement.innerHTML,
                        };
                        onSave(updatedItem);
                      }
                    }
                  }
                  
                  setShowDateMention(false);
                  dateAnchorRef.current = null;
                }}
                onClose={() => {
                  setShowDateMention(false);
                  // 清理 anchor
                  if (dateAnchorRef.current) {
                    dateAnchorRef.current.remove();
                    dateAnchorRef.current = null;
                  }
                }}
              />
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
                maxHeight: '400px',
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
                      if (replacingTagElement && currentFocusedLineId) {
                        const item = items.find(i => i.id === currentFocusedLineId);
                        const editableElement = document.querySelector(
                          `[data-line-id="${currentFocusedLineId}"]`
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
                            const tagName = tagEl.getAttribute('data-tag-name');
                            if (tagName) extractedTags.push(tagName);
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
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: hexToRgba(tagColor, 0.15),
                        color: tagColor,
                        fontSize: '12px',
                        fontWeight: '500',
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
