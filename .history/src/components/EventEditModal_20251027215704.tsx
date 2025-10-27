import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Event } from '../types';
import { STORAGE_KEYS } from '../constants/storage';
import { formatTimeForStorage, parseLocalTimeString, formatDateTimeForInput } from '../utils/timeUtils';
import { CalendarPicker } from './CalendarPicker';
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
  globalTimer?: { startTime: number; originalStartTime?: number; elapsedTime: number; isRunning: boolean } | null; // 全局计时器状态
  microsoftService?: any; // 微软日历服务
  availableCalendars?: any[]; // 可用的日历列表
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
  microsoftService,
  availableCalendars = []
}) => {
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

  // 🔧 修复：直接使用已扁平化的数据，不要重复扁平化
  const flatTags = useMemo(() => {
    console.group('🔍 [EventEditModal] 标签层级诊断 - Step 1: 接收数据');
    console.log('hierarchicalTags 原始输入:', hierarchicalTags);
    console.log('数据类型:', Array.isArray(hierarchicalTags) ? 'Array' : typeof hierarchicalTags);
    console.log('数据长度:', hierarchicalTags?.length);
    if (hierarchicalTags?.length > 0) {
      console.log('第一个标签示例:', hierarchicalTags[0]);
      console.log('是否有 children:', hierarchicalTags[0]?.children);
      console.log('是否有 level:', hierarchicalTags[0]?.level);
      console.log('❗ 数据是否已扁平化:', hierarchicalTags[0]?.level !== undefined && !hierarchicalTags[0]?.children);
    }
    console.groupEnd();
    
    // ✅ 检测数据是否已经扁平化（包含level字段且无children）
    const isAlreadyFlat = hierarchicalTags.length > 0 && 
                         hierarchicalTags[0].level !== undefined && 
                         !hierarchicalTags[0].children;
    
    let flattened: any[];
    
    if (isAlreadyFlat) {
      // ✅ 数据已扁平化，直接使用
      console.log('✅ 数据已扁平化，直接使用原始数据');
      flattened = hierarchicalTags;
    } else {
      // ❌ 数据是层级结构，需要扁平化
      console.log('❌ 数据是层级结构，执行扁平化');
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
      
      flattened = flatten(hierarchicalTags);
    }
    
    console.group('📊 [EventEditModal] 标签层级诊断 - Step 2: 扁平化结果');
    console.log('flatTags 总数:', flattened.length);
    console.table(flattened.map(t => ({ 
      name: t.name, 
      level: t.level,
      hasChildren: !!t.children,
      path: t.path || t.name
    })));
    console.groupEnd();
    
    // 🔧 添加全局调试函数
    if (typeof window !== 'undefined') {
      (window as any).debugTagHierarchy = () => {
        console.clear();
        console.log('═══════════════════════════════════════════');
        console.log('🔍 EventEditModal 标签层级完整诊断');
        console.log('═══════════════════════════════════════════\n');
        
        console.log('📥 Step 1: 原始输入数据 (hierarchicalTags)');
        console.log('-------------------------------------------');
        console.log('数据:', hierarchicalTags);
        console.log('类型:', Array.isArray(hierarchicalTags) ? 'Array' : typeof hierarchicalTags);
        console.log('长度:', hierarchicalTags?.length);
        console.table(hierarchicalTags?.map((t: any) => ({
          name: t.name,
          hasLevel: t.level !== undefined,
          level: t.level,
          hasChildren: !!t.children,
          childrenCount: t.children?.length || 0
        })));
        
        console.log('\n📊 Step 2: 扁平化处理结果 (flatTags)');
        console.log('-------------------------------------------');
        console.log('总数:', flattened.length);
        console.table(flattened.map(t => ({
          name: t.name,
          level: t.level,
          paddingPx: (t.level || 0) * 12,
          path: t.path
        })));
        
        console.log('\n🎨 Step 3: DOM 元素检查');
        console.log('-------------------------------------------');
        const tagContents = document.querySelectorAll('.tag-dropdown-list .tag-content');
        console.log('找到的 .tag-content 元素数量:', tagContents.length);
        tagContents.forEach((el, idx) => {
          const name = el.getAttribute('data-name');
          const level = el.getAttribute('data-level');
          const padding = el.getAttribute('data-padding');
          const computedStyle = window.getComputedStyle(el);
          const actualPaddingLeft = computedStyle.paddingLeft;
          
          console.log(`元素 ${idx + 1}: ${name}`, {
            'data-level': level,
            'data-padding': padding,
            'style.paddingLeft (设置)': (el as HTMLElement).style.paddingLeft,
            'computedStyle.paddingLeft (实际)': actualPaddingLeft,
            '是否被覆盖': padding !== actualPaddingLeft
          });
        });
        
        console.log('\n═══════════════════════════════════════════');
        console.log('💡 如果实际 paddingLeft 为 0px:');
        console.log('   1. 检查 CSS 是否有 !important 覆盖');
        console.log('   2. 检查是否有全局样式影响 .tag-content');
        console.log('   3. 确认 inline style 是否正确应用');
        console.log('═══════════════════════════════════════════');
      };
      
      console.log('💡 在控制台运行 window.debugTagHierarchy() 获取完整诊断');
    }
    
    return flattened;
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
      // 使用timeUtils正确解析时间
      const startTime = event.startTime ? formatDateTimeForInput(parseLocalTimeString(event.startTime)) : '';
      const endTime = event.endTime ? formatDateTimeForInput(parseLocalTimeString(event.endTime)) : '';
      
      setFormData({
        title: event.title || '',
        description: event.description || '',
        startTime,
        endTime,
        location: event.location || '',
        isAllDay: event.isAllDay || false,
        tags: event.tags || (event.tagId ? [event.tagId] : []),
        calendarIds: event.calendarIds || (event.calendarId ? [event.calendarId] : []),
      });
    }
  }, [event, isOpen]);

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
        console.log('🗓️ [EventEditModal] Auto-mapping calendars from tags:', {
          selectedTags: formData.tags,
          mappedCalendarIds,
          finalCalendarIds: uniqueCalendarIds
        });
        
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

    const updatedEvent: Event = {
      ...event,
      title: finalTitle,
      description: formData.description,
      startTime: formatTimeForStorage(parseLocalTimeString(formData.startTime)),
      endTime: formatTimeForStorage(parseLocalTimeString(formData.endTime)),
      location: formData.location,
      isAllDay: formData.isAllDay,
      tags: formData.tags,
      tagId: formData.tags.length > 0 ? formData.tags[0] : undefined, // 兼容旧的单标签字段
      calendarId: formData.calendarIds.length > 0 ? formData.calendarIds[0] : undefined, // 兼容单日历字段，使用第一个
      calendarIds: formData.calendarIds, // 多日历分组
      updatedAt: formatTimeForStorage(new Date()),
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

  return (
    <div className="event-edit-modal-overlay" onClick={onClose}>
      <div className="event-edit-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
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
              placeholder="事件标题"
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
              <label>→</label>
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
                  onChange={(e) => setFormData({ ...formData, isAllDay: e.target.checked })}
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
                          
                          // 每个标签渲染时单独记录
                          console.log(`🏷️ 渲染标签 "${tag.name}":`, {
                            level: tag.level,
                            paddingLeft,
                            computedPadding,
                            style对象: { paddingLeft }
                          });
                          
                          return (
                            <label
                              key={tag.id}
                              className={`tag-option ${formData.tags.includes(tag.id) ? 'selected' : ''}`}
                              onClick={() => toggleTag(tag.id)}
                            >
                              <input
                                type="checkbox"
                                checked={formData.tags.includes(tag.id)}
                                readOnly
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
            <label>日历分组</label>
            <CalendarPicker
              availableCalendars={availableCalendars}
              selectedCalendarIds={formData.calendarIds}
              onSelectionChange={(selectedIds) => {
                setFormData(prev => ({ ...prev, calendarIds: selectedIds }));
              }}
              placeholder="选择日历分组..."
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
