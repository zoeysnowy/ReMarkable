import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import './EventEditModal.css';

interface EventTag {
  id: string;
  name: string;
  color: string;
  outlookCalendarId?: string;
  category: 'ongoing' | 'planning';
  parentId?: string | null;
  children?: EventTag[];
}

interface EventEditModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
  onDelete?: (eventId: string) => void;
  hierarchicalTags: any[];
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    tags: [] as string[], // 多选标签
  });

  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagSelectorRef.current && !tagSelectorRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false);
      }
    };

    if (showTagDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagDropdown]);

  // 扁平化标签树
  const flatTags = useMemo(() => {
    const flatten = (tags: any[], level: number = 0, parentPath: string = ''): any[] => {
      let result: any[] = [];
      tags.forEach(tag => {
        const path = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
        result.push({
          ...tag,
          level,
          path,
          displayName: '  '.repeat(level) + tag.name
        });
        if (tag.children && tag.children.length > 0) {
          result = result.concat(flatten(tag.children, level + 1, path));
        }
      });
      return result;
    };
    return flatten(hierarchicalTags);
  }, [hierarchicalTags]);

  // 搜索过滤标签
  const filteredTags = useMemo(() => {
    if (!tagSearchQuery.trim()) return flatTags;
    const query = tagSearchQuery.toLowerCase();
    return flatTags.filter(tag => 
      tag.name.toLowerCase().includes(query) ||
      tag.path.toLowerCase().includes(query)
    );
  }, [flatTags, tagSearchQuery]);

  // 初始化表单数据
  useEffect(() => {
    if (event && isOpen) {
      setFormData({
        title: event.title || '',
        description: event.description || '',
        startTime: formatDateTimeForInput(event.startTime),
        endTime: formatDateTimeForInput(event.endTime),
        location: event.location || '',
        isAllDay: event.isAllDay || false,
        tags: event.tags || (event.tagId ? [event.tagId] : []),
      });
    }
  }, [event, isOpen]);

  const formatDateTimeForInput = (date: Date | string | undefined): string => {
    if (!date) return '';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const handleSave = () => {
    if (!event) return;

    const updatedEvent: Event = {
      ...event,
      title: formData.title,
      description: formData.description,
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      location: formData.location,
      isAllDay: formData.isAllDay,
      tags: formData.tags,
      tagId: formData.tags.length > 0 ? formData.tags[0] : undefined, // 兼容旧的单标签字段
      updatedAt: new Date().toISOString(),
    };

    onSave(updatedEvent);
    onClose();
  };

  const handleDelete = () => {
    if (!event || !onDelete) return;
    if (window.confirm('确定要删除这个事件吗？')) {
      onDelete(event.id);
      onClose();
    }
  };

  const toggleTag = (tagId: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(id => id !== tagId)
        : [...prev.tags, tagId]
    }));
  };

  const getTagById = (tagId: string) => {
    return flatTags.find(tag => tag.id === tagId);
  };

  if (!isOpen || !event) return null;

  return (
    <div className="event-edit-modal-overlay" onClick={onClose}>
      <div className="event-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>编辑事件</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* 标题 */}
          <div className="form-group">
            <label>标题 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="事件标题"
              required
            />
          </div>

          {/* 时间 */}
          <div className="form-group">
            <label>
              <input
                type="checkbox"
                checked={formData.isAllDay}
                onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
              />
              全天事件
            </label>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>开始时间 *</label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.startTime}
                onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>结束时间 *</label>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
          </div>

          {/* 标签（多选 + 搜索） */}
          <div className="form-group">
            <label>标签</label>
            <div className="tag-selector" ref={tagSelectorRef}>
              {/* 已选标签 */}
              <div className="selected-tags">
                {formData.tags.map(tagId => {
                  const tag = getTagById(tagId);
                  return tag ? (
                    <span key={tagId} className="tag-chip" style={{ backgroundColor: tag.color }}>
                      {tag.name}
                      <button onClick={() => toggleTag(tagId)}>✕</button>
                    </span>
                  ) : null;
                })}
                {formData.tags.length === 0 && <span className="placeholder">选择标签...</span>}
              </div>

              {/* 搜索框 */}
              <input
                type="text"
                className="tag-search"
                placeholder="搜索标签..."
                value={tagSearchQuery}
                onChange={(e) => setTagSearchQuery(e.target.value)}
                onFocus={() => setShowTagDropdown(true)}
              />

              {/* 下拉列表（层级显示） */}
              {showTagDropdown && (
                <div className="tag-dropdown">
                  <div className="tag-dropdown-header">
                    <span className="tag-dropdown-title">选择标签</span>
                    <button
                      className="tag-dropdown-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowTagDropdown(false);
                      }}
                      type="button"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="tag-dropdown-list">
                    {filteredTags.length > 0 ? (
                      filteredTags.map(tag => (
                        <div
                          key={tag.id}
                          className={`tag-option ${formData.tags.includes(tag.id) ? 'selected' : ''}`}
                          onClick={() => toggleTag(tag.id)}
                          style={{ paddingLeft: `${8 + tag.level * 16}px` }}
                        >
                          <input
                            type="checkbox"
                            checked={formData.tags.includes(tag.id)}
                            readOnly
                          />
                          <span className="tag-color" style={{ backgroundColor: tag.color }}></span>
                          <span className="tag-name">{tag.name}</span>
                          <span className="tag-path">{tag.path}</span>
                        </div>
                      ))
                    ) : (
                      <div className="no-tags">没有找到匹配的标签</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 位置 */}
          <div className="form-group">
            <label>位置</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              placeholder="事件位置"
            />
          </div>

          {/* 描述 */}
          <div className="form-group">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="事件描述"
              rows={4}
            />
          </div>
        </div>

        <div className="modal-footer">
          <div className="footer-left">
            {onDelete && (
              <button className="delete-button" onClick={handleDelete}>
                🗑️ 删除
              </button>
            )}
          </div>
          <div className="footer-right">
            <button className="cancel-button" onClick={onClose}>
              取消
            </button>
            <button className="save-button" onClick={handleSave} disabled={!formData.title}>
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
