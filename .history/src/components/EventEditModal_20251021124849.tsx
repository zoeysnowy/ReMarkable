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
  onStartTimeChange?: (newStartTime: number) => void; // 用于全局计时器开始时间修改
  globalTimer?: { startTime: number; elapsedTime: number; isRunning: boolean } | null; // 全局计时器状态
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags,
  onStartTimeChange,
  globalTimer
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

    // 如果没有输入标题，但选择了标签，使用第一个标签的emoji和名称作为标题
    let finalTitle = formData.title;
    if (!finalTitle.trim() && formData.tags.length > 0) {
      const firstTag = getTagById(formData.tags[0]);
      if (firstTag) {
        finalTitle = `${firstTag.emoji || ''}${firstTag.name}`;
        console.log('📝 [EventEditModal] Auto-filling title from tag:', {
          tagId: firstTag.id,
          tagName: firstTag.name,
          emoji: firstTag.emoji,
          generatedTitle: finalTitle
        });
      }
    }

    const updatedEvent: Event = {
      ...event,
      title: finalTitle,
      description: formData.description,
      startTime: new Date(formData.startTime).toISOString(),
      endTime: new Date(formData.endTime).toISOString(),
      location: formData.location,
      isAllDay: formData.isAllDay,
      tags: formData.tags,
      tagId: formData.tags.length > 0 ? formData.tags[0] : undefined, // 兼容旧的单标签字段
      updatedAt: new Date().toISOString(),
    };

    console.log('💾 [EventEditModal] Saving event with tags:', {
      eventId: event.id,
      eventTitle: updatedEvent.title,
      originalTags: event.tags,
      newTags: updatedEvent.tags,
      tagsChanged: JSON.stringify(event.tags) !== JSON.stringify(updatedEvent.tags)
    });

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
    console.log('🏷️ [EventEditModal] Tag toggled:', {
      tagId,
      action: formData.tags.includes(tagId) ? 'removed' : 'added',
      currentTags: formData.tags,
      newTags: formData.tags.includes(tagId)
        ? formData.tags.filter(id => id !== tagId)
        : [...formData.tags, tagId]
    });
    
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

  // 处理开始时间修改（用于全局计时器）
  const handleStartTimeEdit = (newStartTimeStr: string) => {
    setFormData({ ...formData, startTime: newStartTimeStr });
    
    // 如果有全局计时器回调且当前事件是计时器事件，调用回调
    if (onStartTimeChange && globalTimer) {
      // 安全解析时间字符串
      let newStartTime: number;
      
      try {
        // datetime-local 格式: "2025-10-21T12:10"
        // 确保正确解析本地时间
        if (newStartTimeStr.includes('T')) {
          // 标准 datetime-local 格式
          newStartTime = new Date(newStartTimeStr).getTime();
        } else if (newStartTimeStr.includes('/')) {
          // 可能的其他格式 "2025/10/21 12:10"
          const cleanedStr = newStartTimeStr.replace(/\//g, '-').replace(' ', 'T');
          newStartTime = new Date(cleanedStr).getTime();
        } else {
          // 备用解析
          newStartTime = new Date(newStartTimeStr).getTime();
        }
        
        console.log('🔧 [EventEditModal] 解析开始时间:', {
          原始字符串: newStartTimeStr,
          解析后时间戳: newStartTime,
          解析后日期: new Date(newStartTime).toLocaleString(),
          是否有效: !isNaN(newStartTime)
        });
        
        if (!isNaN(newStartTime) && newStartTime > 0) {
          onStartTimeChange(newStartTime);
        } else {
          console.error('❌ 时间解析失败:', newStartTimeStr);
        }
      } catch (error) {
        console.error('❌ 时间解析异常:', error, newStartTimeStr);
      }
    }
  };

  // 计算当前时长（用于显示）
  const calculateDuration = () => {
    if (!globalTimer) return null;
    
    const now = Date.now();
    
    // 安全检查各个时间值
    if (!globalTimer.elapsedTime || isNaN(globalTimer.elapsedTime) || globalTimer.elapsedTime < 0) {
      console.warn('⚠️ [calculateDuration] 异常的 elapsedTime:', globalTimer.elapsedTime);
      return null;
    }
    
    if (!globalTimer.startTime || isNaN(globalTimer.startTime) || globalTimer.startTime <= 0) {
      console.warn('⚠️ [calculateDuration] 异常的 startTime:', globalTimer.startTime);
      return null;
    }
    
    let totalElapsed: number;
    
    if (globalTimer.isRunning) {
      const currentRunTime = now - globalTimer.startTime;
      if (currentRunTime < 0) {
        console.warn('⚠️ [calculateDuration] 负的运行时间，startTime 在未来:', {
          now: new Date(now).toLocaleString(),
          startTime: new Date(globalTimer.startTime).toLocaleString(),
          diff: currentRunTime
        });
        totalElapsed = globalTimer.elapsedTime; // 只使用已保存的时长
      } else {
        totalElapsed = globalTimer.elapsedTime + currentRunTime;
      }
    } else {
      totalElapsed = globalTimer.elapsedTime;
    }
    
    // 确保总时长为正数且合理
    totalElapsed = Math.max(0, totalElapsed);
    if (totalElapsed > 86400000 * 365) { // 超过1年的时长肯定不正常
      console.error('❌ [calculateDuration] 异常的总时长:', {
        totalElapsed,
        elapsedTime: globalTimer.elapsedTime,
        startTime: globalTimer.startTime,
        now,
        isRunning: globalTimer.isRunning
      });
      return null;
    }
    
    const hours = Math.floor(totalElapsed / 3600000);
    const minutes = Math.floor((totalElapsed % 3600000) / 60000);
    const seconds = Math.floor((totalElapsed % 60000) / 1000);
    
    return { hours, minutes, seconds, totalElapsed };
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
                onChange={(e) => globalTimer ? handleStartTimeEdit(e.target.value) : setFormData({ ...formData, startTime: e.target.value })}
                required
              />
              {globalTimer && (() => {
                const duration = calculateDuration();
                return duration && (
                  <div className="timer-duration-hint">
                    <span className="hint-icon">⏱️</span>
                    <span className="hint-text">
                      当前时长: {duration.hours.toString().padStart(2, '0')}:{duration.minutes.toString().padStart(2, '0')}:{duration.seconds.toString().padStart(2, '0')}
                    </span>
                    <span className="hint-note">修改开始时间会自动调整计时时长</span>
                  </div>
                );
              })()}
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
                      {tag.emoji && <span className="tag-chip-emoji">{tag.emoji}</span>}
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
                          {tag.emoji && <span className="tag-emoji">{tag.emoji}</span>}
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
            <button 
              className="save-button" 
              onClick={handleSave} 
              disabled={!formData.title && formData.tags.length === 0}
            >
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
