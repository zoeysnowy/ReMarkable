import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Event } from '../types';
// import { STORAGE_KEYS } from '../constants/storage';
import { formatTimeForStorage, parseLocalTimeString, formatDateForInput } from '../utils/timeUtils';
import { CalendarPicker } from './CalendarPicker';
import './EventEditModal.css';
import { useEventTime } from '../hooks/useEventTime';

// interface EventTag {
//   id: string;
//   name: string;
//   color: string;
//   outlookCalendarId?: string;
//   category: 'ongoing' | 'planning';
//   parentId?: string | null;
//   children?: EventTag[];
// }

interface EventEditModalProps {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
  onDelete?: (eventId: string) => void;
  hierarchicalTags: any[];
  onStartTimeChange?: (newStartTime: number) => void;
  globalTimer?: { startTime: number; originalStartTime?: number; elapsedTime: number; isRunning: boolean } | null;
  availableCalendars?: any[];
  draggable?: boolean; // 是否可拖拽
  resizable?: boolean; // 是否可调整大小
}

export const EventEditModal: React.FC<EventEditModalProps> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags,
  onStartTimeChange,
  globalTimer,
  availableCalendars = [],
  draggable = false,
  resizable = false,
}) => {
  const eventTime = useEventTime(event?.id);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    tags: [] as string[], // 多选标签
    calendarIds: [] as string[], // 多选日历分组
  });

  const [tagSearchQuery, setTagSearchQuery] = useState('');
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const tagSelectorRef = useRef<HTMLDivElement>(null);

  // 拖拽和调整大小状态
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [modalSize, setModalSize] = useState({ width: 600, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

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

  // 拖拽处理
  const handleDragStart = (e: React.MouseEvent) => {
    if (!draggable) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y });
  };

  const handleDragMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !draggable) return;
    setModalPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, draggable, dragStart]);

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  // 调整大小处理
  const handleResizeStart = (e: React.MouseEvent) => {
    if (!resizable) return;
    e.stopPropagation();
    setIsResizing(true);
    const rect = modalRef.current?.getBoundingClientRect();
    if (rect) {
      setResizeStart({ 
        x: e.clientX, 
        y: e.clientY, 
        width: rect.width, 
        height: rect.height 
      });
    }
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizable) return;
    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;
    setModalSize({
      width: Math.max(400, resizeStart.width + deltaX),
      height: Math.max(300, resizeStart.height + deltaY),
    });
  }, [isResizing, resizable, resizeStart]);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
  }, []);

  // 监听拖拽和调整大小的鼠标事件
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleDragMove);
      document.addEventListener('mouseup', handleDragEnd);
    }
    if (isResizing) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    }
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
    };
  }, [isDragging, isResizing, handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

  const flatTags = useMemo(() => {
    const isAlreadyFlat = hierarchicalTags.length > 0 && 
                         hierarchicalTags[0].level !== undefined && 
                         !hierarchicalTags[0].children;
    
    if (isAlreadyFlat) {
      return hierarchicalTags;
    }
    
    const flatten = (tags: any[], level: number = 0, parentPath: string = ''): any[] => {
      let result: any[] = [];
      tags.forEach(tag => {
        const path = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
        const flattenedTag = {
          ...tag,
          level,
          path,
          displayName: '  '.repeat(level) + tag.name
        };
        result.push(flattenedTag);
        
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

  // 初始化表单数据（优先使用 TimeHub 的快照）
  useEffect(() => {
    if (event && isOpen) {
      const startStr = eventTime?.start || event.startTime || '';
      const endStr = eventTime?.end || event.endTime || '';

      const startDateObj = startStr ? parseLocalTimeString(startStr) : undefined;
      const endDateObj = endStr ? parseLocalTimeString(endStr) : undefined;

      const isAllDay = !!event.isAllDay;
      const startTime = isAllDay
        ? (startDateObj ? formatDateForInput(startDateObj) : '')
        : (startDateObj ? formatDateTimeForInput(startDateObj) : '');
      const endTime = isAllDay
        ? (endDateObj ? formatDateForInput(endDateObj) : '')
        : (endDateObj ? formatDateTimeForInput(endDateObj) : '');

      setFormData({
        title: event.title || '',
        description: event.description || '',
        startTime,
        endTime,
        location: event.location || '',
        isAllDay: isAllDay,
        tags: event.tags || (event.tagId ? [event.tagId] : []),
        calendarIds: event.calendarIds || (event.calendarId ? [event.calendarId] : []),
      });

      if (draggable || resizable) {
        setModalPosition({ x: 0, y: 0 });
        setModalSize({ width: 600, height: 0 });
      }
    }
  }, [event, isOpen, draggable, resizable, eventTime?.start, eventTime?.end]);

  // 当标签变化时，自动根据标签的日历映射填写日历分组
  useEffect(() => {
    if (formData.tags.length > 0 && availableCalendars.length > 0) {
      // 收集所有选中标签的日历映射
      const mappedCalendarIds = formData.tags
        .map(tagId => {
          const tag = getTagById(tagId);
          return tag?.calendarMapping?.calendarId;
        })
        .filter((id): id is string => Boolean(id));
      
      // 去重并自动添加到日历选择中
      const uniqueCalendarIds = Array.from(new Set([...formData.calendarIds, ...mappedCalendarIds]));
      
      if (uniqueCalendarIds.length !== formData.calendarIds.length) {
        setFormData(prev => ({
          ...prev,
          calendarIds: uniqueCalendarIds
        }));
      }
    }
  }, [formData.tags, availableCalendars]); // 依赖标签和可用日历

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

    // 处理时间：全天模式下构造 00:00:00 ~ 23:59:59 的时间段
    let startISO: string = '';
    let endISO: string = '';
    if (formData.isAllDay) {
      const startDateStr = formData.startTime || formData.endTime || formatDateForInput(new Date());
      const endDateStr = formData.endTime || formData.startTime || startDateStr;
      const [sy, sm, sd] = startDateStr.split('T')[0].split('-').map(Number);
      const [ey, em, ed] = endDateStr.split('T')[0].split('-').map(Number);
      const startDate = new Date(sy, (sm || 1) - 1, sd || 1, 0, 0, 0);
      const endDate = new Date(ey, (em || 1) - 1, ed || 1, 23, 59, 59);
      startISO = formatTimeForStorage(startDate);
      endISO = formatTimeForStorage(endDate);
    } else {
      startISO = formData.startTime ? formatTimeForStorage(parseLocalTimeString(formData.startTime)) : '';
      endISO = formData.endTime ? formatTimeForStorage(parseLocalTimeString(formData.endTime)) : '';
    }

    // 通过 TimeHub 写入时间，避免直接覆写 startTime/endTime
    if (event?.id) {
      import('../services/TimeHub').then(async ({ TimeHub }) => {
        try {
          await TimeHub.setEventTime(event.id, {
            start: startISO,
            end: endISO,
            kind: startISO && endISO && startISO !== endISO ? 'range' : 'fixed',
            allDay: formData.isAllDay,
            source: 'picker',
          });
        } catch {}

        const updatedEvent: Event = {
          ...event,
          title: finalTitle,
          // 🔒 保护 description：只在真正有内容时才更新，避免空值覆盖原有内容
          description: formData.description || event.description || '',
          // 不直接修改 startTime/endTime，由 TimeHub 已写入
          location: formData.location,
          isAllDay: formData.isAllDay,
          tags: formData.tags,
          tagId: formData.tags.length > 0 ? formData.tags[0] : undefined,
          calendarId: formData.calendarIds.length > 0 ? formData.calendarIds[0] : undefined,
          calendarIds: formData.calendarIds,
          updatedAt: formatTimeForStorage(new Date()),
        } as Event;

        onSave(updatedEvent);
        onClose();
      });
    } else {
      // 兜底：没有 eventId 的情况下维持旧逻辑
      const updatedEvent: Event = {
        ...event,
        title: finalTitle,
        description: formData.description,
        startTime: startISO,
        endTime: endISO,
        location: formData.location,
        isAllDay: formData.isAllDay,
        tags: formData.tags,
        tagId: formData.tags.length > 0 ? formData.tags[0] : undefined,
        calendarId: formData.calendarIds.length > 0 ? formData.calendarIds[0] : undefined,
        calendarIds: formData.calendarIds,
        updatedAt: formatTimeForStorage(new Date()),
      } as Event;
      onSave(updatedEvent);
      onClose();
    }
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

  const handleStartTimeEdit = (newStartTimeStr: string) => {
    setFormData({ ...formData, startTime: newStartTimeStr });
    
    if (onStartTimeChange && globalTimer) {
      let newStartTime: number;
      
      try {
        if (newStartTimeStr.includes('T')) {
          newStartTime = new Date(newStartTimeStr).getTime();
        } else if (newStartTimeStr.includes('/')) {
          const cleanedStr = newStartTimeStr.replace(/\//g, '-').replace(' ', 'T');
          newStartTime = new Date(cleanedStr).getTime();
        } else {
          newStartTime = new Date(newStartTimeStr).getTime();
        }
        
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
    
    // 🔧 简化计算：如果有 originalStartTime，直接使用它
    const hasOriginalStartTime = globalTimer.originalStartTime && 
                                !isNaN(globalTimer.originalStartTime) && 
                                globalTimer.originalStartTime > 0;
    
    if (globalTimer.isRunning && hasOriginalStartTime && globalTimer.originalStartTime) {
      // 使用简单直观的计算：当前时间 - 用户设定的开始时间
      totalElapsed = now - globalTimer.originalStartTime;
      console.log('📊 [EventEditModal] 使用简化计算:', {
        当前时间: new Date(now).toLocaleString(),
        原始开始时间: new Date(globalTimer.originalStartTime).toLocaleString(),
        计算时长分钟: Math.round(totalElapsed / 60000)
      });
    } else if (globalTimer.isRunning) {
      // 回退到旧逻辑（兼容性）
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

  const modalStyle: React.CSSProperties = draggable || resizable ? {
    position: 'fixed',
    left: modalPosition.x || '50%',
    top: modalPosition.y || '50%',
    transform: modalPosition.x ? 'none' : 'translate(-50%, -50%)',
    width: modalSize.width,
    maxWidth: 'none',
    height: resizable && modalSize.height ? modalSize.height : 'auto',
    maxHeight: resizable ? 'none' : '90vh',
  } : {};

  return (
    <div 
      className="event-edit-modal-overlay" 
      onClick={draggable ? undefined : onClose}
      style={draggable ? { backgroundColor: 'rgba(0, 0, 0, 0.3)' } : {}}
    >
      <div 
        ref={modalRef}
        className="event-edit-modal" 
        onClick={(e) => e.stopPropagation()}
        style={modalStyle}
      >
        <div 
          className="modal-header"
          onMouseDown={handleDragStart}
          style={draggable ? { cursor: isDragging ? 'grabbing' : 'grab' } : {}}
        >
          <h2>编辑事件</h2>
          <button className="close-button" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* 标题 */}
          <div className="form-group form-group-inline">
            <label>标题</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder=""
              required
            />
          </div>

          {/* 时间（开始、结束、全天在同一行） */}
          <div className="form-row form-row-with-checkbox">
            <div className="form-group form-group-inline">
              <label>时间</label>
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
            <div className="form-group form-group-inline">
              <div className="duration-arrow-container">
                {(() => {
                  // 计算时间段
                  if (!formData.isAllDay && formData.startTime && formData.endTime) {
                    const start = new Date(formData.startTime);
                    const end = new Date(formData.endTime);
                    const diffMs = end.getTime() - start.getTime();
                    
                    if (diffMs > 0) {
                      const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
                      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                      
                      let durationText = '';
                      
                      // 如果超过24小时，显示天数
                      if (totalHours >= 24) {
                        const days = Math.floor(totalHours / 24);
                        const hours = totalHours % 24;
                        durationText = `${days}d`;
                        if (hours > 0) {
                          durationText += `${hours}h`;
                        }
                      } else if (totalHours > 0) {
                        durationText = `${totalHours}h`;
                        if (minutes > 0) {
                          durationText += `${minutes}min`;
                        }
                      } else if (minutes > 0) {
                        durationText = `${minutes}min`;
                      }
                      
                      if (durationText) {
                        return <span className="duration-hint">{durationText}</span>;
                      }
                    }
                  }
                  return null;
                })()}
                <label>→</label>
              </div>
              <input
                type={formData.isAllDay ? 'date' : 'datetime-local'}
                value={formData.endTime}
                onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                required
              />
            </div>
            <div className="form-group form-group-inline all-day-checkbox">
              <label>
                <input
                  type="checkbox"
                  checked={formData.isAllDay}
                  onChange={(e) => {
                    const nextIsAllDay = e.target.checked;
                    // 转换当前表单中的时间值以匹配控件类型
                    if (nextIsAllDay) {
                      // 切换为全天：仅保留日期部分
                      const baseDateStr = formData.startTime || formData.endTime || formatDateForInput(new Date());
                      const dateOnly = baseDateStr.includes('T') ? baseDateStr.split('T')[0] : baseDateStr;
                      setFormData(prev => ({
                        ...prev,
                        isAllDay: true,
                        startTime: dateOnly,
                        endTime: prev.endTime ? (prev.endTime.includes('T') ? prev.endTime.split('T')[0] : prev.endTime) : dateOnly,
                      }));
                    } else {
                      // 取消全天：为日期补上合理的时间片段
                      const dateOnlyStart = (formData.startTime || formatDateForInput(new Date())).split('T')[0];
                      const dateOnlyEnd = (formData.endTime || dateOnlyStart).split('T')[0];
                      const startWithTime = `${dateOnlyStart}T09:00`;
                      const endWithTime = `${dateOnlyEnd}T10:00`;
                      setFormData(prev => ({
                        ...prev,
                        isAllDay: false,
                        startTime: startWithTime,
                        endTime: endWithTime,
                      }));
                    }
                  }}
                />
                全天
              </label>
            </div>
          </div>

          {/* 标签（多选 + 搜索） */}
          <div className="form-group form-group-inline">
            <label>标签</label>
            <div className="tag-selector" ref={tagSelectorRef}>
              {/* 已选标签 + 搜索框合并 */}
              <div 
                className="selected-tags-with-search"
                onClick={() => setShowTagDropdown(true)}
              >
                {formData.tags.map(tagId => {
                  const tag = getTagById(tagId);
                  return tag ? (
                    <span 
                      key={tagId} 
                      className="tag-chip" 
                      style={{ backgroundColor: tag.color }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {tag.emoji && <span className="tag-chip-emoji">{tag.emoji}</span>}
                      #{tag.name}
                      <button onClick={() => toggleTag(tagId)}>✕</button>
                    </span>
                  ) : null;
                })}
                <input
                  type="text"
                  className="tag-search-inline"
                  placeholder={formData.tags.length === 0 ? "选择标签..." : "搜索..."}
                  value={tagSearchQuery}
                  onChange={(e) => setTagSearchQuery(e.target.value)}
                  onFocus={() => setShowTagDropdown(true)}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>

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
                      (() => {
                        console.group('� [EventEditModal] 标签层级诊断 - Step 3: UI 渲染');
                        console.log('filteredTags 总数:', filteredTags.length);
                        console.table(filteredTags.map(tag => ({
                          name: tag.name,
                          level: tag.level,
                          paddingLeft: `${(tag.level || 0) * 12}px`,
                          计算结果: (tag.level || 0) * 12
                        })));
                        console.groupEnd();
                        
                        return filteredTags.map(tag => {
                          const paddingLeft = `${(tag.level || 0) * 12}px`;
                          const computedPadding = (tag.level || 0) * 12;
                          
                          return (
                            <label
                              key={tag.id}
                              className={`tag-option ${formData.tags.includes(tag.id) ? 'selected' : ''}`}
                            >
                              <input
                                type="checkbox"
                                checked={formData.tags.includes(tag.id)}
                                onChange={() => toggleTag(tag.id)}
                              />
                              <div 
                                className="tag-content"
                                style={{ paddingLeft }}
                                data-level={tag.level || 0}
                                data-padding={paddingLeft}
                                data-name={tag.name}
                              >
                                <span className="tag-color" style={{ color: tag.color }}>#</span>
                                {tag.emoji && <span className="tag-emoji">{tag.emoji}</span>}
                                <span className="tag-name" style={{ color: tag.color }}>{tag.name}</span>
                              </div>
                            </label>
                          );
                        });
                      })()
                    ) : (
                      <div className="no-tags">没有找到匹配的标签</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* 日历分组（多选） */}
          <div className="form-group form-group-inline">
            <label>日历</label>
            <CalendarPicker
              availableCalendars={availableCalendars}
              selectedCalendarIds={formData.calendarIds}
              onSelectionChange={(selectedIds) => {
                setFormData(prev => ({ ...prev, calendarIds: selectedIds }));
              }}
              maxSelection={5}
            />
          </div>

          {/* 位置 */}
          <div className="form-group form-group-inline">
            <label>位置</label>
            <input
              type="text"
              value={formData.location}
              onChange={(e) => setFormData({ ...formData, location: e.target.value })}
            />
          </div>

          {/* 描述（放在位置下方，与位置输入框宽度一致） */}
          <div className="form-group form-group-inline form-group-description">
            <label>描述</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
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

        {/* 调整大小手柄 */}
        {resizable && (
          <div
            className="resize-handle"
            onMouseDown={handleResizeStart}
            style={{
              position: 'absolute',
              right: 0,
              bottom: 0,
              width: '20px',
              height: '20px',
              cursor: 'nwse-resize',
              background: 'linear-gradient(135deg, transparent 50%, #999 50%)',
            }}
          />
        )}
      </div>
    </div>
  );
};
