import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './DescriptionEditor.css';
import { STORAGE_KEYS } from '../constants/storage';

interface Tag {
  id: string;
  name: string;
  color: string;
  parentId?: string;
  children?: Tag[];
}

interface EventEditData {
  title: string;
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  isAllDay: boolean;
  reminder: number;
}

interface DescriptionEditorProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (description: string, tags: string[], eventData?: EventEditData) => void;
  initialDescription?: string;
  initialTags?: string[];
  title?: string;
  // 新增：完整事件编辑支持
  isFullEventEdit?: boolean;
  initialEventData?: EventEditData;
}

const DescriptionEditor: React.FC<DescriptionEditorProps> = ({
  isOpen,
  onClose,
  onSave,
  initialDescription = '',
  initialTags = [],
  title = '编辑描述',
  isFullEventEdit = false,
  initialEventData
}) => {
  const [description, setDescription] = useState(initialDescription);
  const [selectedTags, setSelectedTags] = useState<string[]>(initialTags);
  const [availableTags, setAvailableTags] = useState<Tag[]>([]);
  const [searchTag, setSearchTag] = useState('');
  const [showTagSelector, setShowTagSelector] = useState(false);

  // 事件编辑状态
  const [eventData, setEventData] = useState<EventEditData>(
    initialEventData || {
      title: '',
      description: initialDescription,
      startTime: '',
      endTime: '',
      location: '',
      isAllDay: false,
      reminder: 15
    }
  );

  useEffect(() => {
    if (isOpen) {
      if (isFullEventEdit && initialEventData) {
        // 完整事件编辑模式：使用事件数据中的所有信息
        setDescription(initialEventData.description);
        setEventData(initialEventData);
      } else {
        // 仅描述编辑模式：使用传入的初始描述
        setDescription(initialDescription);
      }
      setSelectedTags(initialTags);
      loadAvailableTags();
    }
  }, [isOpen, initialDescription, initialTags, initialEventData, isFullEventEdit]);

  const loadAvailableTags = () => {
    // 从标签管理器加载层级标签
    const savedHierarchicalTags = localStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS);
    if (savedHierarchicalTags) {
      try {
        const hierarchicalTags = JSON.parse(savedHierarchicalTags);
        // 将层级标签转换为扁平的Tag格式
        const flatTags: Tag[] = [];
        
        const flattenTags = (tags: any[], parentPath = '') => {
          tags.forEach(tag => {
            const displayName = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
            flatTags.push({
              id: tag.id,
              name: displayName,
              color: tag.color,
              parentId: tag.parentId,
              children: tag.children
            });
            
            if (tag.children && tag.children.length > 0) {
              flattenTags(tag.children, displayName);
            }
          });
        };
        
        flattenTags(hierarchicalTags);
        setAvailableTags(flatTags);
      } catch (error) {
        console.error('Failed to parse hierarchical tags:', error);
        loadDefaultTags();
      }
    } else {
      loadDefaultTags();
    }
  };

  const loadDefaultTags = () => {
    // 兼容旧的用户标签
    const savedTags = localStorage.getItem('userTags');
    if (savedTags) {
      setAvailableTags(JSON.parse(savedTags));
    } else {
      // 默认标签
      const defaultTags: Tag[] = [
        { id: '1', name: '工作', color: '#3b82f6' },
        { id: '2', name: '学习', color: '#10b981' },
        { id: '3', name: '生活', color: '#f59e0b' },
        { id: '4', name: '健康', color: '#ef4444' },
        { id: '5', name: '娱乐', color: '#8b5cf6' }
      ];
      setAvailableTags(defaultTags);
      localStorage.setItem('userTags', JSON.stringify(defaultTags));
    }
  };

  const handleSave = () => {
    if (isFullEventEdit) {
      // 检查事件数据是否有实际变化
      const hasEventDataChanges = initialEventData && (
        eventData.title !== initialEventData.title ||
        eventData.startTime !== initialEventData.startTime ||
        eventData.endTime !== initialEventData.endTime ||
        eventData.location !== initialEventData.location ||
        eventData.isAllDay !== initialEventData.isAllDay ||
        eventData.reminder !== initialEventData.reminder
      );
      
      if (hasEventDataChanges) {
        // 有事件详情变化，发送完整事件数据
        const finalEventData = {
          ...eventData,
          description: description
        };
        onSave(description, selectedTags, finalEventData);
      } else {
        // 只有描述和标签变化，不发送事件数据
        onSave(description, selectedTags);
      }
    } else {
      onSave(description, selectedTags);
    }
    onClose();
  };

  const handleTagToggle = (tagId: string) => {
    setSelectedTags(prev => 
      prev.includes(tagId) 
        ? prev.filter(id => id !== tagId)
        : [...prev, tagId]
    );
  };

  const getTagById = (tagId: string): Tag | undefined => {
    return availableTags.find(tag => tag.id === tagId);
  };

  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchTag.toLowerCase())
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      handleSave();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="description-editor-overlay" onClick={onClose}>
      <div className="description-editor-modal" onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className="description-editor-header">
          <h3>{title}</h3>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <div className="description-editor-content">
          {/* 描述输入区域 */}
          <div className="description-section">
            <label htmlFor="description">描述内容</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="输入详细描述..."
              rows={6}
              autoFocus
            />
          </div>

          {/* 标签选择区域 */}
          <div className="tags-section">
            <div className="tags-header">
              <label>标签</label>
              <button 
                className="toggle-tag-selector"
                onClick={() => setShowTagSelector(!showTagSelector)}
              >
                {showTagSelector ? '收起' : '选择标签'}
              </button>
            </div>

            {/* 已选择的标签 */}
            <div className="selected-tags">
              {selectedTags.map(tagId => {
                const tag = getTagById(tagId);
                return tag ? (
                  <span 
                    key={tagId} 
                    className="tag selected"
                    style={{ backgroundColor: tag.color }}
                    onClick={() => handleTagToggle(tagId)}
                  >
                    {tag.name}
                    <span className="tag-remove">×</span>
                  </span>
                ) : null;
              })}
            </div>

            {/* 标签选择器 */}
            {showTagSelector && (
              <div className="tag-selector">
                <input
                  type="text"
                  placeholder="搜索标签..."
                  value={searchTag}
                  onChange={(e) => setSearchTag(e.target.value)}
                  className="tag-search"
                />
                <div className="available-tags">
                  {filteredTags.map(tag => (
                    <span
                      key={tag.id}
                      className={`tag ${selectedTags.includes(tag.id) ? 'selected' : ''}`}
                      style={{ backgroundColor: tag.color }}
                      onClick={() => handleTagToggle(tag.id)}
                    >
                      {tag.name}
                      {selectedTags.includes(tag.id) && <span className="tag-check">✓</span>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 事件详情编辑区域 - 仅在完整编辑模式下显示 */}
          {isFullEventEdit && (
            <div className="event-details-section">
              <h4>事件详情</h4>
              
              {/* 标题 */}
              <div className="form-row">
                <label htmlFor="event-title">标题 *</label>
                <input
                  id="event-title"
                  type="text"
                  value={eventData.title}
                  onChange={(e) => setEventData({ ...eventData, title: e.target.value })}
                  placeholder="输入事件标题..."
                  required
                />
              </div>

              {/* 时间设置 */}
              <div className="form-row">
                <div className="checkbox-row">
                  <input
                    id="all-day"
                    type="checkbox"
                    checked={eventData.isAllDay}
                    onChange={(e) => setEventData({ ...eventData, isAllDay: e.target.checked })}
                  />
                  <label htmlFor="all-day">全天事件</label>
                </div>
              </div>

              {!eventData.isAllDay && (
                <>
                  <div className="form-row">
                    <label htmlFor="start-time">开始时间</label>
                    <input
                      id="start-time"
                      type="datetime-local"
                      value={eventData.startTime}
                      onChange={(e) => setEventData({ ...eventData, startTime: e.target.value })}
                    />
                  </div>

                  <div className="form-row">
                    <label htmlFor="end-time">结束时间</label>
                    <input
                      id="end-time"
                      type="datetime-local"
                      value={eventData.endTime}
                      onChange={(e) => setEventData({ ...eventData, endTime: e.target.value })}
                    />
                  </div>
                </>
              )}

              {/* 地点 */}
              <div className="form-row">
                <label htmlFor="location">地点</label>
                <input
                  id="location"
                  type="text"
                  value={eventData.location}
                  onChange={(e) => setEventData({ ...eventData, location: e.target.value })}
                  placeholder="输入地点..."
                />
              </div>

              {/* 提醒 */}
              <div className="form-row">
                <label htmlFor="reminder">提醒</label>
                <select
                  id="reminder"
                  value={eventData.reminder}
                  onChange={(e) => setEventData({ ...eventData, reminder: parseInt(e.target.value) })}
                >
                  <option value={0}>无提醒</option>
                  <option value={5}>5分钟前</option>
                  <option value={15}>15分钟前</option>
                  <option value={30}>30分钟前</option>
                  <option value={60}>1小时前</option>
                  <option value={1440}>1天前</option>
                </select>
              </div>
            </div>
          )}
        </div>

        <div className="description-editor-footer">
          <button className="cancel-button" onClick={onClose}>
            取消
          </button>
          <button className="save-button" onClick={handleSave}>
            保存 <span className="shortcut">(Ctrl+Enter)</span>
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DescriptionEditor;