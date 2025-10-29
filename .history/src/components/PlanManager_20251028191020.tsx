import React, { useState, useRef, useEffect, useMemo } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Event } from '../types';
import { MultiLineEditor, MultiLineEditorItem } from './MultiLineEditor';
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { FloatingToolbar } from './FloatingToolbar';
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
  
  // FloatingToolbar
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorContainerRef as React.RefObject<HTMLElement>,
    enabled: true,
  });

  // 将 PlanItem[] 转换为 MultiLineEditorItem<PlanItem>[]
  const editorItems = useMemo<MultiLineEditorItem<PlanItem>[]>(() => {
    return items.map((item, index) => ({
      id: item.id,
      content: item.title,
      level: 0,
      position: index,
      parentId: undefined,
      data: item,
    }));
  }, [items]);

  // 处理编辑器内容变化
  const handleEditorChange = (newItems: MultiLineEditorItem<PlanItem>[]) => {
    newItems.forEach((item) => {
      if (item.data) {
        const updatedItem = { ...item.data, title: item.content };
        onSave(updatedItem);
      }
    });
  };

  // 将 PlanItem[] 转换为 MultiLineEditorItem<PlanItem>[]
  const editorItems = useMemo<MultiLineEditorItem<PlanItem>[]>(() => {
    return items.map((item, index) => ({
      id: item.id,
      content: item.title,
      level: 0,
      position: index,
      parentId: undefined,
      data: item,
    }));
  }, [items]);

  // 处理编辑器内容变化
  const handleEditorChange = (newItems: MultiLineEditorItem<PlanItem>[]) => {
    newItems.forEach((item) => {
      if (item.data) {
        const updatedItem = { ...item.data, title: item.content };
        onSave(updatedItem);
      }
    });
  };

  // 计算类型
  const getItemType = (item: PlanItem): 'todo' | 'task' | 'event' => {
    if (item.startTime && item.endTime) return 'event';
    if (item.dueDate) return 'task';
    return 'todo';
  };

  // 处理新建项目
  const handleCreateItem = (content: string): MultiLineEditorItem<PlanItem> => {
    const newItem: PlanItem = {
      id: `plan-${Date.now()}`,
      title: content,
      tags: [],
      priority: 'medium',
      isCompleted: false,
      type: 'todo',
    };
    onSave(newItem);
    syncToUnifiedTimeline(newItem);

    return {
      id: newItem.id,
      content: newItem.title,
      level: 0,
      position: items.length,
      parentId: undefined,
      data: newItem,
    };
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
  const renderItemPrefix = (editorItem: MultiLineEditorItem<PlanItem>) => {
    const item = editorItem.data;
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

  // 渲染右侧后缀（标签 + 时间 + 优先级指示器）
  const renderItemSuffix = (editorItem: MultiLineEditorItem<PlanItem>) => {
    const item = editorItem.data;
    if (!item) return null;

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
        {/* 标签 */}
        {item.tags.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
            {item.tags.map((tag) => (
              <span
                key={tag}
                style={{
                  padding: '2px 8px',
                  borderRadius: '4px',
                  backgroundColor: '#e5e7eb',
                  color: '#374151',
                  fontSize: '12px',
                }}
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
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
          <MultiLineEditor
            items={editorItems}
            onItemsChange={handleEditorChange}
            renderItemPrefix={renderItemPrefix}
            renderItemSuffix={renderItemSuffix}
            placeholder="输入新任务..."
            grayText="✨ 点击创建新任务，按 Enter 快速创建，Tab 调整层级，↑↓ 导航，Shift+Alt+↑↓ 移动"
            indentSize={24}
            onItemClick={(item) => {
              if (item.data) {
                setSelectedItemId(item.data.id);
                setEditingItem(item.data);
              }
            }}
            getItemStyle={(item) => item.data ? getContentStyle(item.data) : undefined}
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

      {/* FloatingToolbar */}
      <FloatingToolbar
        position={floatingToolbar.position}
        onFormat={floatingToolbar.applyFormat}
        getSelectedText={floatingToolbar.getSelectedText}
      />
    </div>
  );
};

export default PlanManager;
