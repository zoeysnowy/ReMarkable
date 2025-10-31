import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import type { Event } from '../types';
import { FreeFormEditor, FreeFormLine } from './MultiLineEditor/FreeFormEditor';
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { HeadlessFloatingToolbar } from './FloatingToolbar/HeadlessFloatingToolbar';
import { ToolbarConfig } from './FloatingToolbar/types';
import { TagService } from '../services/TagService';
import { DateMentionPicker } from './shared/DateMentionPicker';
import { formatDateDisplay } from '../utils/dateParser';
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
      console.log(`📋 [PlanManager] 菜单选择: 索引 ${menuIndex}, 功能 ${toolbarConfig.features[menuIndex]}`);
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
    
    container.addEventListener('focusin', handleFocus);
    
    return () => {
      container.removeEventListener('focusin', handleFocus);
    };
  }, [items]);

  // 监听 TagService 变化
  const [tagServiceVersion, setTagServiceVersion] = useState(0);
  
  useEffect(() => {
    // 订阅标签变化
    const listener = () => {
      console.log('🏷️ [PlanManager] TagService 标签已更新');
      setTagServiceVersion(v => v + 1);
    };
    
    TagService.addListener(listener);
    
    // 初始加载时检查一次
    const tags = TagService.getFlatTags();
    if (tags.length > 0) {
      console.log('🏷️ [PlanManager] 初始标签加载成功:', tags.length);
    } else {
      console.warn('⚠️ [PlanManager] 标签为空，可能 TagService 未初始化');
    }
    
    return () => TagService.removeListener(listener);
  }, []);

  // 获取所有已使用的标签
  const existingTags = useMemo(() => {
    const allTags = TagService.getFlatTags();
    if (allTags.length > 0) {
      console.log('🏷️ [PlanManager] 获取标签:', allTags.length, '个');
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
    return items.map((item, index) => ({
      id: item.id,
      // 优先使用 content（HTML），fallback 到 title（纯文本）
      content: item.content || item.title,
      level: item.level || 0,
      data: item,
    }));
  }, [items]);

  // 处理编辑器内容变化
  const handleLinesChange = (newLines: FreeFormLine<PlanItem>[]) => {
    newLines.forEach((line) => {
      // 从 HTML 内容中提取纯文本和标签
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = line.content;
      
      // 提取标签
      const tagElements = tempDiv.querySelectorAll('.inline-tag');
      const extractedTags: string[] = [];
      tagElements.forEach(tagEl => {
        const tagName = tagEl.getAttribute('data-tag-name');
        if (tagName) extractedTags.push(tagName);
      });
      
      // 提取纯文本（移除标签后的文本）
      const plainText = tempDiv.textContent || '';
      
      if (line.data) {
        const updatedItem = { 
          ...line.data, 
          title: plainText,
          content: line.content, // 保存 HTML 用于显示
          tags: extractedTags,
          level: line.level,
        };
        onSave(updatedItem);
      } else {
        // 创建新项目
        const newItem: PlanItem = {
          id: line.id,
          title: plainText,
          content: line.content,
          tags: extractedTags,
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
          level: line.level,
        };
        onSave(newItem);
        syncToUnifiedTimeline(newItem);
      }
    });
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

  const getPriorityColor = (priority: string) => {
    const colors = { urgent: '#FF3B30', high: '#FF9500', medium: '#007AFF', low: '#34C759' };
    return colors[priority as keyof typeof colors] || '#999';
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

  // 渲染右侧后缀（时间 + 优先级指示器）
  const renderLineSuffix = (line: FreeFormLine<PlanItem>) => {
    const item = line.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
        {/* 时间 */}
        {(item.dueDate || item.startTime) && (
          <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
            ⏰ {item.startTime 
              ? new Date(item.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : `截止 ${new Date(item.dueDate!).toLocaleDateString('zh-CN')}`
            }
          </span>
        )}
        {/* 优先级指示器 */}
        <div
          style={{
            width: '4px',
            height: '24px',
            borderRadius: '2px',
            backgroundColor: getPriorityColor(item.priority || 'medium'),
          }}
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
      {/* 左侧列表 */}
      <div className="plan-list">
        <div className="plan-list-header">
          <h2>📝 计划清单</h2>
        </div>

        <div className="plan-items" ref={editorContainerRef}>
          <FreeFormEditor
            lines={editorLines}
            onLinesChange={handleLinesChange}
            renderLinePrefix={renderLinePrefix}
            renderLineSuffix={renderLineSuffix}
            placeholder="✨ 点击创建新任务，按 Enter 快速创建，Tab 调整层级，↑↓ 导航"
            onLineClick={(line) => {
              if (line.data) {
                setSelectedItemId(line.data.id);
                setEditingItem(line.data);
              }
            }}
          />
        </div>
      </div>

      {/* 右侧详情面板 */}
      {selectedItemId && editingItem && (
        <div className="plan-detail-panel">
          <div className="plan-detail-header">
            <h3>详细信息</h3>
            <button onClick={() => setSelectedItemId(null)}>✕</button>
          </div>

          <div className="plan-detail-content">
            {/* 类型 */}
            <div className="plan-detail-section">
              <label>类型</label>
              <div className="plan-type-indicator">
                {getTypeIcon(editingItem)} {
                  getItemType(editingItem) === 'todo' ? '待办事项' : 
                  getItemType(editingItem) === 'task' ? '任务（有截止日期）' : 
                  '日程（有时间段）'
                }
              </div>
            </div>

            {/* 时间设置 */}
            <div className="plan-detail-section">
              <label>⏰ 时间</label>
              <div className="plan-time-radios">
                <label>
                  <input
                    type="radio"
                    checked={!editingItem.dueDate && !editingItem.startTime}
                    onChange={() => setEditingItem({ ...editingItem, dueDate: undefined, startTime: undefined, endTime: undefined })}
                  />
                  无日期
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!!editingItem.dueDate && !editingItem.startTime}
                    onChange={() => setEditingItem({ ...editingItem, dueDate: new Date().toISOString().slice(0, 10), startTime: undefined, endTime: undefined })}
                  />
                  截止日期
                </label>
                <label>
                  <input
                    type="radio"
                    checked={!!editingItem.startTime}
                    onChange={() => {
                      const now = new Date();
                      setEditingItem({ 
                        ...editingItem, 
                        dueDate: undefined,
                        startTime: now.toISOString().slice(0, 16), 
                        endTime: new Date(now.getTime() + 3600000).toISOString().slice(0, 16) 
                      });
                    }}
                  />
                  时间段
                </label>
              </div>

              {editingItem.dueDate && !editingItem.startTime && (
                <input
                  type="date"
                  value={editingItem.dueDate.slice(0, 10)}
                  onChange={(e) => setEditingItem({ ...editingItem, dueDate: e.target.value })}
                />
              )}

              {editingItem.startTime && (
                <>
                  <input
                    type="datetime-local"
                    value={editingItem.startTime.slice(0, 16)}
                    onChange={(e) => setEditingItem({ ...editingItem, startTime: e.target.value })}
                  />
                  <input
                    type="datetime-local"
                    value={editingItem.endTime?.slice(0, 16) || ''}
                    onChange={(e) => setEditingItem({ ...editingItem, endTime: e.target.value })}
                  />
                </>
              )}
            </div>

            {/* 优先级 */}
            <div className="plan-detail-section">
              <label>🎯 优先级</label>
              <div className="plan-priority-buttons">
                {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                  <button
                    key={p}
                    className={editingItem.priority === p ? 'active' : ''}
                    style={{
                      backgroundColor: editingItem.priority === p ? getPriorityColor(p) : 'transparent',
                      color: editingItem.priority === p ? 'white' : getPriorityColor(p),
                      borderColor: getPriorityColor(p),
                    }}
                    onClick={() => setEditingItem({ ...editingItem, priority: p })}
                  >
                    {p.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* 标签 */}
            <div className="plan-detail-section">
              <label>🏷️ 标签</label>
              <div className="plan-tags-selector">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={editingItem.tags.includes(tag) ? 'active' : ''}
                    onClick={() => {
                      const newTags = editingItem.tags.includes(tag)
                        ? editingItem.tags.filter(t => t !== tag)
                        : [...editingItem.tags, tag];
                      setEditingItem({ ...editingItem, tags: newTags });
                    }}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Emoji */}
            <div className="plan-detail-section">
              <label>😊 表情</label>
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
                {editingItem.emoji || '选择表情'}
              </button>
            </div>

            {/* 备注 */}
            <div className="plan-detail-section">
              <label>📝 备注</label>
              <textarea
                value={editingItem.notes || ''}
                onChange={(e) => setEditingItem({ ...editingItem, notes: e.target.value })}
                rows={4}
              />
            </div>

            {/* 操作按钮 */}
            <div className="plan-detail-actions">
              <button
                className="plan-save-btn"
                onClick={() => {
                  onSave({ ...editingItem, type: getItemType(editingItem) });
                  syncToUnifiedTimeline(editingItem);
                  setSelectedItemId(null);
                }}
              >
                保存
              </button>
              <button
                className="plan-delete-btn"
                onClick={() => {
                  if (window.confirm('确定删除？')) {
                    onDelete(editingItem.id);
                    setSelectedItemId(null);
                  }
                }}
              >
                删除
              </button>
            </div>
          </div>
        </div>
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
          console.log('🏷️ [onTagSelect] 收到标签 IDs:', tagIds);
          console.log('🏷️ [onTagSelect] 之前选中的标签 (ref):', currentSelectedTagsRef.current);
          
          // 找出新增的标签（只插入新增的）
          const newTagIds = tagIds.filter(id => !currentSelectedTagsRef.current.includes(id));
          console.log('🏷️ [onTagSelect] 新增的标签:', newTagIds);
          
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
                    cursor: default;
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
          console.log('Selected emoji:', emoji);
        }}
        onDateRangeSelect={(start: Date, end: Date) => {
          // TODO: 应用日期范围到当前选中的项目
          console.log('Selected date range:', start, end);
        }}
        onPrioritySelect={(priority: 'low' | 'medium' | 'high' | 'urgent') => {
          // TODO: 应用优先级到当前选中的项目
          console.log('Selected priority:', priority);
        }}
        onColorSelect={(color: string) => {
          // TODO: 应用颜色到当前选中的项目
          console.log('Selected color:', color);
        }}
        availableTags={existingTags}
        currentTags={currentSelectedTags}
      />
    </div>
  );
};

export default PlanManager;
