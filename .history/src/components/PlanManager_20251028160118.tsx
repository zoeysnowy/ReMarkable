import React, { useState, useRef, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import { Event } from '../types';
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
  const inputRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  
  // 永远显示的新建输入框
  const newItemRef = useRef<HTMLDivElement | null>(null);
  const [newItemId] = useState(`new-${Date.now()}`);

  // 浮动工具栏编辑区域 ref
  const editorContainerRef = useRef<HTMLDivElement>(null);

  // 浮动工具栏 Hook
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorContainerRef,
    enabled: true,
  });

  // 计算类型
  const getItemType = (item: PlanItem): 'todo' | 'task' | 'event' => {
    if (item.startTime && item.endTime) return 'event';
    if (item.dueDate) return 'task';
    return 'todo';
  };

  // 点击列表空白处聚焦到新建输入框
  const handleListClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      newItemRef.current?.focus();
    }
  };

  // 处理Enter键
  const handleKeyDown = (e: React.KeyboardEvent, item: PlanItem) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const title = (e.currentTarget as HTMLDivElement).textContent || '';
      if (title.trim()) {
        const savedItem = { ...item, title: title.trim(), type: getItemType(item) };
        onSave(savedItem);
        syncToUnifiedTimeline(savedItem);
        
        // 清空输入框，准备下一个
        (e.currentTarget as HTMLDivElement).textContent = '';
      }
    }
  };
  
  // 处理新建输入框的Enter
  const handleNewItemKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const title = (e.currentTarget as HTMLDivElement).textContent || '';
      if (title.trim()) {
        const newItem: PlanItem = {
          id: `plan-${Date.now()}`,
          title: title.trim(),
          tags: [],
          priority: 'medium',
          isCompleted: false,
          type: 'todo',
        };
        onSave(newItem);
        syncToUnifiedTimeline(newItem);
        
        // 清空输入框
        (e.currentTarget as HTMLDivElement).textContent = '';
      }
    }
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
    return type === 'event' ? '📅' : type === 'task' ? '📋' : '☐';
  };

  return (
    <div className="plan-manager">
      {/* 左侧列表 */}
      <div className="plan-list">
        <div className="plan-list-header">
          <h2>📝 我的计划</h2>
        </div>

        <div className="plan-items" onClick={handleListClick}>
          {items.map((item) => (
            <div
              key={item.id}
              className={`plan-item ${selectedItemId === item.id ? 'selected' : ''} ${item.isCompleted ? 'completed' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedItemId(item.id);
                setEditingItem(item);
              }}
              style={{ borderLeft: `4px solid ${getPriorityColor(item.priority || 'medium')}` }}
            >
              <div className="plan-item-main">
                <span className="plan-item-icon">{getTypeIcon(item)}</span>
                {item.emoji && <span className="plan-item-emoji">{item.emoji}</span>}
                <div
                  ref={(el) => { inputRefs.current[item.id] = el; }}
                  className="plan-item-title"
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => {
                    const newTitle = e.currentTarget.textContent || '';
                    if (newTitle.trim() !== item.title) {
                      onSave({ ...item, title: newTitle.trim() });
                    }
                  }}
                  onKeyDown={(e) => handleKeyDown(e, item)}
                  style={{ color: item.color }}
                >
                  {item.title}
                </div>
              </div>

              {item.tags.length > 0 && (
                <div className="plan-item-tags">
                  {item.tags.map((tag) => (
                    <span key={tag} className="plan-tag">#{tag}</span>
                  ))}
                </div>
              )}

              {(item.dueDate || item.startTime) && (
                <div className="plan-item-time">
                  ⏰ {item.startTime 
                    ? new Date(item.startTime).toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                    : `截止 ${new Date(item.dueDate!).toLocaleDateString('zh-CN')}`
                  }
                </div>
              )}
            </div>
          ))}

          {/* 永远显示的新建输入框 */}
          <div className="plan-item plan-item-new" style={{ borderLeft: '4px solid #34C759' }}>
            <div className="plan-item-main">
              <span className="plan-item-icon">✨</span>
              <div
                ref={newItemRef}
                className="plan-item-title"
                contentEditable
                suppressContentEditableWarning
                onKeyDown={handleNewItemKeyDown}
                data-placeholder="输入新任务，按 Enter 创建..."
              />
            </div>
          </div>
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
    </div>
  );
};

export default PlanManager;
