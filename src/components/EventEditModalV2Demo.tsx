/**
 * EventEditModal v2 Demo Page
 * 
 * 独立的测试页面，用于开发和测试 EventEditModal v2 的交互功能
 * 
 * 功能：
 * 1. 左侧事件标识区（Emoji、标题、标签、任务勾选）
 * 2. Timer 计时按钮交互
 * 3. 计划安排编辑
 * 4. 实际进展显示
 * 5. Event Log 富文本编辑
 * 
 * @author Zoey Gong
 * @version 2.0.0
 */

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import Tippy from '@tippyjs/react';
import 'tippy.js/dist/tippy.css';
import { TagService } from '../services/TagService';
import { EventService } from '../services/EventService';
import { ContactService } from '../services/ContactService';
import { Event, Contact } from '../types';
import { HierarchicalTagPicker } from './HierarchicalTagPicker/HierarchicalTagPicker';
import UnifiedDateTimePicker from './FloatingToolbar/pickers/UnifiedDateTimePicker';
import { AttendeeDisplay } from './common/AttendeeDisplay';
import { LocationInput } from './common/LocationInput';
import './EventEditModalV2Demo.css';

// Import SVG icons
import timerStartIcon from '../assets/icons/timer_start.svg';
import pauseIcon from '../assets/icons/pause.svg';
import stopIcon from '../assets/icons/stop.svg';
import cancelIcon from '../assets/icons/cancel.svg';
import rotationColorIcon from '../assets/icons/rotation_color.svg';
import attendeeIcon from '../assets/icons/Attendee.svg';
import datetimeIcon from '../assets/icons/datetime.svg';
import locationIcon from '../assets/icons/Location.svg';
import arrowBlueIcon from '../assets/icons/Arrow_blue.svg';
import timerCheckIcon from '../assets/icons/timer_check.svg';
import addTaskColorIcon from '../assets/icons/Add_task_color.svg';
import ddlAddIcon from '../assets/icons/ddl_add.svg';
import ddlCheckedIcon from '../assets/icons/ddl_checked.svg';
import taskGrayIcon from '../assets/icons/task_gray.svg';
import ddlWarnIcon from '../assets/icons/ddl_warn.svg';
import linkColorIcon from '../assets/icons/link_color.svg';

interface MockEvent {
  id: string;
  title: string;
  tags: string[];
  isTask: boolean;
  isTimer: boolean;
  parentEventId: string | null;
  startTime: string | null; // ISO 8601 string
  endTime: string | null;   // ISO 8601 string
  allDay: boolean;
  location?: string;
  organizer?: Contact;
  attendees?: Contact[];
}

interface EventEditModalV2DemoProps {
  globalTimer?: {
    isRunning: boolean;
    tagId: string;
    tagIds: string[];
    tagName: string;
    tagEmoji?: string;
    tagColor?: string;
    startTime: number;
    originalStartTime: number;
    elapsedTime: number;
    isPaused: boolean;
    eventEmoji?: string;
    eventTitle?: string;
    eventId?: string;
    parentEventId?: string;
  } | null;
  onTimerStart?: (tagIds?: string | string[], parentEventId?: string) => void;
  onTimerPause?: () => void;
  onTimerResume?: () => void;
  onTimerStop?: () => void;
  onTimerCancel?: () => void;
}

export const EventEditModalV2Demo: React.FC<EventEditModalV2DemoProps> = ({
  globalTimer,
  onTimerStart,
  onTimerPause,
  onTimerResume,
  onTimerStop,
  onTimerCancel
}) => {
  // 模拟事件数据
  const [formData, setFormData] = useState<MockEvent>({
    id: 'event-1',
    title: '',
    tags: [],
    isTask: true,
    isTimer: false,
    parentEventId: null,
    startTime: '2025-10-18T10:00:00',
    endTime: '2025-10-18T12:30:00',
    allDay: false,
    organizer: {
      id: 'organizer-001',
      name: 'Zoey Gong',
      email: 'zoey.gong@company.com',
      organization: '产品部',
      position: '产品经理',
      isOutlook: true,
    },
    attendees: [
      {
        id: 'attendee-001',
        name: 'Jenny Wong',
        email: 'jenny.wong@company.com',
        organization: '设计部',
        position: '设计师',
        isGoogle: true,
      },
      {
        id: 'attendee-002',
        name: 'Cindy Cai',
        email: 'cindy.cai@company.com',
        organization: '研发部',
        isReMarkable: true,
      },
    ],
  });

  // UI 状态
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [isDetailView, setIsDetailView] = useState(true);
  const [tagPickerPosition, setTagPickerPosition] = useState({ top: 0, left: 0, width: 0 });
  const [currentTime, setCurrentTime] = useState<number>(Date.now());

  // 初始化时手动提取演示数据的联系人到联系人库
  useEffect(() => {
    console.log('[EventEditModalV2Demo] 初始化：手动提取演示联系人');
    ContactService.extractAndAddFromEvent(formData.organizer, formData.attendees);
  }, []); // 只在挂载时执行一次

  // Ref for title input
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const tagPickerDropdownRef = useRef<HTMLDivElement>(null);

  // 动态调整标题输入框宽度
  const autoResizeInput = useCallback((input: HTMLInputElement | null) => {
    if (!input) return;
    
    const span = document.createElement('span');
    span.style.visibility = 'hidden';
    span.style.position = 'absolute';
    span.style.whiteSpace = 'pre';
    span.style.font = window.getComputedStyle(input).font;
    span.textContent = input.value || input.placeholder || '';
    document.body.appendChild(span);
    input.style.width = (span.offsetWidth + 10) + 'px';
    document.body.removeChild(span);
  }, []);

  // 监听标题变化并自动调整宽度
  useEffect(() => {
    autoResizeInput(titleInputRef.current);
  }, [formData.title, autoResizeInput]);

  // 点击外部关闭标签选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInside = 
        (tagPickerRef.current && tagPickerRef.current.contains(target)) ||
        (tagPickerDropdownRef.current && tagPickerDropdownRef.current.contains(target));
      
      if (!clickedInside) {
        setShowTagPicker(false);
      }
    };

    if (showTagPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagPicker]);

  // Timer 状态检测
  const isCurrentEventRunning = globalTimer?.isRunning && globalTimer?.parentEventId === formData.id;
  const isPaused = globalTimer?.isPaused || false;

  // Update current time every second when timer is running
  useEffect(() => {
    if (isCurrentEventRunning && !isPaused) {
      const interval = setInterval(() => {
        setCurrentTime(Date.now());
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [isCurrentEventRunning, isPaused]);

  // ==================== Emoji 处理函数 ====================
  
  /**
   * 从字符串中提取第一个 emoji
   */
  const extractFirstEmoji = (text: string): string | null => {
    if (!text) return null;
    // 使用简单的字符范围检测常见 emoji
    const emojiPattern = /[\uD800-\uDBFF][\uDC00-\uDFFF]|[\u2600-\u27BF]/;
    const match = text.match(emojiPattern);
    return match ? match[0] : null;
  };

  /**
   * 获取显示的 emoji（优先级：标题 > 首个标签 > Timer状态 > 默认）
   */
  const getDisplayEmoji = useCallback((event: MockEvent): string => {
    // 优先级 1: 标题中的 emoji
    const titleEmoji = extractFirstEmoji(event.title);
    if (titleEmoji) return titleEmoji;
    
    // 优先级 2: 首个标签的 emoji
    if (event.tags && event.tags.length > 0) {
      const firstTag = TagService.getTagById(event.tags[0]);
      if (firstTag?.emoji) return firstTag.emoji;
    }
    
    // 优先级 3: Timer 运行中显示沙漏
    const isTimerActive = globalTimer?.eventId === event.id && globalTimer?.isRunning;
    if (isTimerActive) return '⏳';
    
    // 优先级 4: 默认图标（待填写的事件）
    return '📝';
  }, [globalTimer]);

  /**
   * 选择 emoji
   */
  const handleEmojiSelect = (emoji: any) => {
    // 1. 移除标题中现有的 emoji
    let newTitle = formData.title;
    const existingEmoji = extractFirstEmoji(newTitle);
    if (existingEmoji) {
      newTitle = newTitle.replace(existingEmoji, '').trim();
    }
    
    // 2. 将新 emoji 添加到标题开头
    newTitle = `${emoji.native} ${newTitle}`;
    
    // 3. 更新表单数据
    setFormData({ ...formData, title: newTitle });
    
    // 4. 关闭 Picker
    setShowEmojiPicker(false);
  };

  // ==================== 标题处理函数 ====================
  
  /**
   * 从标题中移除emoji，用于显示
   */
  const removeEmojiFromTitle = (title: string): string => {
    const emoji = extractFirstEmoji(title);
    if (emoji) {
      return title.replace(emoji, '').trim();
    }
    return title;
  };

  const getTitlePlaceholder = (tags: string[]): string => {
    // 根据标签动态生成 placeholder
    if (!tags || tags.length === 0) return '事件标题';
    const firstTag = TagService.getTagById(tags[0]);
    // Timer 标签直接显示标签名，不添加"事项"
    return firstTag?.name || '事件标题';
  };

  const handleTitleChange = (newTitle: string) => {
    // 如果已有emoji，保留它；如果输入了新emoji，也保留
    const existingEmoji = extractFirstEmoji(formData.title);
    const newEmoji = extractFirstEmoji(newTitle);
    
    let finalTitle = newTitle;
    
    // 如果新输入中没有emoji，但原来有emoji，则保留原emoji
    if (!newEmoji && existingEmoji) {
      finalTitle = `${existingEmoji} ${newTitle}`;
    }
    
    setFormData({ ...formData, title: finalTitle });
  };

  // ==================== 标签处理函数 ====================
  
  /**
   * 构建标签层级路径
   */
  const buildTagPath = (tagId: string): string => {
    const parts: string[] = [];
    let currentTag = TagService.getTagById(tagId);
    
    while (currentTag) {
      parts.unshift(`${currentTag.emoji || ''}${currentTag.name}`);
      currentTag = currentTag.parentId ? TagService.getTagById(currentTag.parentId) : null;
    }
    
    return parts.join('/');
  };

  /**
   * 获取标签显示文本
   */
  const getTagsDisplayText = (tags: string[]): string => {
    if (!tags || tags.length === 0) return '选择标签...';
    
    const firstPath = buildTagPath(tags[0]);
    
    if (tags.length > 1) {
      return `#${firstPath} 等`;
    }
    return `#${firstPath}`;
  };

  // ==================== 时间处理函数 ====================
  
  /**
   * 格式化计时器运行时间
   */
  const formatElapsedTime = () => {
    if (!globalTimer || !isCurrentEventRunning) return '00:00';

    const safeElapsedTime = (globalTimer.elapsedTime && !isNaN(globalTimer.elapsedTime) && globalTimer.elapsedTime >= 0) 
      ? globalTimer.elapsedTime : 0;
    const safeStartTime = (globalTimer.startTime && !isNaN(globalTimer.startTime) && globalTimer.startTime > 0) 
      ? globalTimer.startTime : Date.now();

    let totalElapsed: number;
    if (globalTimer.isRunning && !globalTimer.isPaused) {
      // Running: accumulated + current session
      totalElapsed = safeElapsedTime + (Date.now() - safeStartTime);
    } else {
      // Paused: only accumulated
      totalElapsed = safeElapsedTime;
    }

    const totalSeconds = Math.floor(totalElapsed / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  /**
   * 格式化时间显示
   */
  const formatTimeDisplay = (startTime: string | null, endTime: string | null) => {
    if (!startTime) return null;
    
    const start = new Date(startTime);
    const end = endTime ? new Date(endTime) : null;
    
    // 格式化日期和星期
    const dateStr = start.toLocaleDateString('zh-CN', { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit' 
    }).replace(/\//g, '-');
    
    const weekday = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][start.getDay()];
    
    // 格式化时间
    const startTimeStr = start.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    if (!end) {
      return {
        dateStr,
        weekday,
        startTimeStr,
        endTimeStr: null,
        duration: null
      };
    }
    
    const endTimeStr = end.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
    
    // 计算时长
    const diffMs = end.getTime() - start.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const hours = Math.floor(diffMinutes / 60);
    const minutes = diffMinutes % 60;
    
    let duration = '';
    if (hours > 0) {
      duration += `${hours}h`;
    }
    if (minutes > 0) {
      duration += `${minutes}min`;
    }
    
    return {
      dateStr,
      weekday,
      startTimeStr,
      endTimeStr,
      duration
    };
  };

  /**
   * 处理时间选择完成
   */
  const handleTimeApplied = (startIso: string, endIso?: string, allDay?: boolean) => {
    setFormData({
      ...formData,
      startTime: startIso,
      endTime: endIso || null,
      allDay: allDay || false
    });
    setShowTimePicker(false);
  };

  /**
   * 打开标签选择器并计算位置
   */
  const handleOpenTagPicker = () => {
    if (tagRowRef.current) {
      const rect = tagRowRef.current.getBoundingClientRect();
      setTagPickerPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width
      });
    }
    setShowTagPicker(true);
  };

  // ==================== Checkbox 处理 ====================
  
  const handleTaskCheckboxChange = (checked: boolean) => {
    setFormData({ ...formData, isTask: checked });
  };

  // ==================== 渲染函数 ====================

  return (
    <div className="eventmodal-v2-demo-container">
      <div className="demo-header">
        <h1>🎨 EventEditModal v2 交互开发</h1>
        <div className="demo-actions">
          <button 
            className={`view-switch-btn ${isDetailView ? 'active' : ''}`}
            onClick={() => setIsDetailView(true)}
          >
            📋 详情视图
          </button>
          <button 
            className={`view-switch-btn ${!isDetailView ? 'active' : ''}`}
            onClick={() => setIsDetailView(false)}
          >
            📱 收缩视图
          </button>
        </div>
      </div>

      <div className="demo-content">
        {/* 左侧：说明面板 */}
        <div className="demo-info-panel">
          <h2>🛠️ 开发说明</h2>
          <div className="info-section">
            <h3>✅ 已实现功能</h3>
            <ul>
              <li>Emoji 选择（emoji-mart）</li>
              <li>标题输入与自动提取 emoji</li>
              <li>标签显示与层级路径</li>
              <li>任务勾选框</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>🚧 开发中功能</h3>
            <ul>
              <li>HierarchicalTagPicker 集成</li>
              <li>Timer 计时按钮交互</li>
              <li>UnifiedDateTimePicker 集成</li>
              <li>Slate 编辑器集成</li>
            </ul>
          </div>

          <div className="info-section">
            <h3>📚 参考文档</h3>
            <ul>
              <li><code>docs/PRD/EVENTEDITMODAL_V2_PRD.md</code></li>
              <li><code>src/components/FloatingToolbar/</code></li>
              <li><code>src/components/HierarchicalTagPicker/</code></li>
            </ul>
          </div>

          <div className="info-section">
            <h3>🎯 当前数据</h3>
            <pre>{JSON.stringify(formData, null, 2)}</pre>
          </div>
        </div>

        {/* 右侧：模态框预览 */}
        <div className="demo-preview-panel">
          <div className={`event-edit-modal-v2 ${isDetailView ? 'detail-view' : 'compact-view'}`}>
            <div className="modal-content">
              {/* 左侧：Event Overview */}
              <div className="event-overview">
                {/* 上 Section - 事件标识区 */}
                <div className="section-identity">
                  {/* Emoji (大图标) */}
                  <div 
                    className="emoji-large" 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  >
                    {getDisplayEmoji(formData)}
                  </div>

                  {/* Emoji Picker */}
                  {showEmojiPicker && (
                    <div className="emoji-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
                      <div className="emoji-picker-wrapper" onClick={(e) => e.stopPropagation()}>
                        <Picker
                          data={data}
                          onEmojiSelect={handleEmojiSelect}
                          theme="light"
                          locale="zh"
                          perLine={8}
                          emojiSize={24}
                          previewPosition="none"
                          skinTonePosition="none"
                        />
                      </div>
                    </div>
                  )}

                  {/* Checkbox + 标题行 */}
                  <div className="title-checkbox-row">
                    <div 
                      className={`custom-checkbox ${formData.isTask ? 'checked' : ''}`}
                      onClick={() => handleTaskCheckboxChange(!formData.isTask)}
                    />
                    <input
                      ref={titleInputRef}
                      type="text"
                      className="title-input"
                      value={removeEmojiFromTitle(formData.title)}
                      placeholder={getTitlePlaceholder(formData.tags)}
                      onChange={(e) => handleTitleChange(e.target.value)}
                      style={{ 
                        width: `${Math.max(
                          (removeEmojiFromTitle(formData.title) || getTitlePlaceholder(formData.tags)).length * 10 + 20,
                          120
                        )}px` 
                      }}
                    />
                  </div>

                  {/* 标签行 */}
                  <div className="eventmodal-v2-tags-row-wrapper" ref={tagPickerRef}>
                    <div 
                      className="eventmodal-v2-tags-row" 
                      ref={tagRowRef}
                      onClick={handleOpenTagPicker}
                    >
                      {formData.tags.length > 0 ? (
                        <>
                          {formData.tags.slice(0, 2).map((tagId, index) => {
                            const tag = TagService.getTagById(tagId);
                            if (!tag) return null;
                            return (
                              <React.Fragment key={tagId}>
                                {index > 0 && <span className="eventmodal-v2-tag-separator">/</span>}
                                <span className="eventmodal-v2-tag-chip" style={{ color: tag.color }}>
                                  #{tag.emoji && <span>{tag.emoji}</span>}
                                  {tag.name}
                                </span>
                              </React.Fragment>
                            );
                          })}
                          {formData.tags.length > 2 && <span className="eventmodal-v2-tag-etc">等</span>}
                        </>
                      ) : (
                        <span className="tag-placeholder">选择标签...</span>
                      )}
                    </div>
                  </div>

                  {/* HierarchicalTagPicker Popup - Fixed positioning */}
                  {showTagPicker && (
                    <div 
                      ref={tagPickerDropdownRef}
                      className="tag-picker-dropdown" 
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'fixed',
                        top: `${tagPickerPosition.top}px`,
                        left: `${tagPickerPosition.left}px`,
                        minWidth: `${Math.max(tagPickerPosition.width, 300)}px`,
                        zIndex: 9999
                      }}
                    >
                      <HierarchicalTagPicker
                        availableTags={TagService.getTags().map((tag: any) => ({
                          id: tag.id,
                          name: tag.name,
                          color: tag.color,
                          emoji: tag.emoji,
                          level: tag.level || 0,
                          parentId: tag.parentId
                        }))}
                        selectedTagIds={formData.tags}
                        onSelectionChange={(selectedIds) => {
                          setFormData({ ...formData, tags: selectedIds });
                          setShowTagPicker(false);
                        }}
                        multiSelect={true}
                        mode="popup"
                        placeholder="搜索标签..."
                        onClose={() => setShowTagPicker(false)}
                      />
                    </div>
                  )}
                </div>

                {/* Timer 按钮 - 状态机实现 */}
                {(() => {
                  // 检查当前事件是否正在计时
                  // Timer 的 eventId 是自动生成的 timer-xxx，需要通过 parentEventId 匹配
                  const isCurrentEventRunning = globalTimer?.isRunning && globalTimer?.parentEventId === formData.id;
                  const isPaused = globalTimer?.isPaused;

                  // 状态1: 未开始计时 - 显示"开始专注"按钮
                  if (!isCurrentEventRunning) {
                    return (
                      <button 
                        className="timer-button-start"
                        onClick={() => {
                          if (onTimerStart) {
                            // 如果有标签就传标签，否则传空数组
                            onTimerStart(formData.tags.length > 0 ? formData.tags : [], formData.id);
                          }
                        }}
                        title="开始计时"
                      >
                        <img src={timerStartIcon} alt="" />
                        开始专注
                      </button>
                    );
                  }

                  // 状态2: 正在计时 - 显示暂停/继续、结束、取消按钮组
                  return (
                    <div className="timer-buttons">
                      <button 
                        className="timer-btn pause-btn"
                        onClick={() => {
                          if (isPaused && onTimerResume) {
                            onTimerResume();
                          } else if (!isPaused && onTimerPause) {
                            onTimerPause();
                          }
                        }}
                        title={isPaused ? '继续' : '暂停'}
                      >
                        <img src={pauseIcon} alt={isPaused ? '继续' : '暂停'} />
                      </button>
                      <button 
                        className="timer-btn stop-btn"
                        onClick={() => {
                          if (onTimerStop && window.confirm('确定要结束计时并保存吗？')) {
                            onTimerStop();
                          }
                        }}
                        title="停止并保存"
                      >
                        <img src={stopIcon} alt="停止" />
                      </button>
                      <button 
                        className="timer-btn cancel-btn"
                        onClick={() => {
                          if (onTimerCancel && window.confirm('确定要取消计时吗？当前计时将不会被保存。')) {
                            onTimerCancel();
                          }
                        }}
                        title="取消计时"
                      >
                        <img src={cancelIcon} alt="取消" />
                      </button>
                    </div>
                  );
                })()}

                {/* Timer elapsed time display */}
                {isCurrentEventRunning && (
                  <div className="timer-display">
                    {formatElapsedTime()}
                  </div>
                )}

                {/* 计划安排区域 */}
                <div className="eventmodal-v2-section-header">
                  <div className="eventmodal-v2-section-header-title">计划安排</div>
                  <div className="eventmodal-v2-section-header-buttons">
                    <button className="eventmodal-v2-header-text-btn">每周</button>
                    <button className="eventmodal-v2-header-icon-btn">
                      <img src={rotationColorIcon} alt="" />
                    </button>
                    <button className="eventmodal-v2-header-icon-btn">
                      <img src={addTaskColorIcon} alt="" />
                    </button>
                    <button className="eventmodal-v2-header-icon-btn">
                      <img src={ddlAddIcon} alt="" />
                    </button>
                  </div>
                </div>

                {/* 组织者和参与者 */}
                <AttendeeDisplay
                  event={formData as any}
                  currentUserEmail="current.user@company.com"
                  onChange={(attendees, organizer) => {
                    console.log('[EventEditModalV2Demo] Attendees changed:', { attendees, organizer });
                    
                    // 更新本地状态
                    setFormData(prev => ({
                      ...prev,
                      attendees,
                      organizer,
                    }));
                    
                    // ✨ 立即提取并保存联系人到联系人库
                    ContactService.extractAndAddFromEvent(organizer, attendees);
                    console.log('✅ [EventEditModalV2Demo] 已自动提取联系人到联系人库');
                  }}
                />

                {/* 时间显示 */}
                <Tippy
                  content={
                    <UnifiedDateTimePicker
                      initialStart={formData.startTime || undefined}
                      initialEnd={formData.endTime || undefined}
                      onApplied={handleTimeApplied}
                      onClose={() => setShowTimePicker(false)}
                    />
                  }
                  visible={showTimePicker}
                  onClickOutside={() => setShowTimePicker(false)}
                  interactive={true}
                  placement="bottom"
                  popperOptions={{
                    strategy: 'fixed',
                    modifiers: [
                      {
                        name: 'flip',
                        enabled: false, // 禁止自动翻转到上方
                      },
                      {
                        name: 'preventOverflow',
                        options: {
                          altAxis: true,
                          tether: false, // 允许超出边界
                        },
                      },
                    ],
                  }}
                  theme="light"
                  arrow={false}
                  offset={[0, 8]}
                  appendTo={document.body}
                  maxWidth="none"
                >
                  <div 
                    className="eventmodal-v2-plan-row" 
                    onClick={() => setShowTimePicker(true)} 
                    style={{ cursor: 'pointer' }}
                  >
                    <img src={datetimeIcon} alt="" className="eventmodal-v2-plan-icon" />
                    <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      {(() => {
                        const timeInfo = formatTimeDisplay(formData.startTime, formData.endTime);
                        if (!timeInfo) {
                          return <span style={{ color: '#9ca3af' }}>添加时间...</span>;
                        }
                        
                        return (
                          <>
                            <span>{timeInfo.dateStr} ({timeInfo.weekday}) {timeInfo.startTimeStr}</span>
                            {timeInfo.endTimeStr && timeInfo.duration && (
                              <>
                                <div className="time-arrow-section">
                                  <span className="duration-text">{timeInfo.duration}</span>
                                  <img src={arrowBlueIcon} alt="" className="arrow-icon" />
                                </div>
                                <span>{timeInfo.endTimeStr}</span>
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                </Tippy>

                {/* 地点 */}
                <div className="eventmodal-v2-plan-row" style={{ cursor: 'pointer' }}>
                  <img src={locationIcon} alt="" className="eventmodal-v2-plan-icon" />
                  {isEditingLocation ? (
                    <LocationInput
                      value={formData.location || ''}
                      onChange={(value) => {
                        setFormData(prev => ({ ...prev, location: value }));
                      }}
                      onSelect={() => setIsEditingLocation(false)}
                      onBlur={() => setIsEditingLocation(false)}
                      placeholder="添加地点..."
                    />
                  ) : (
                    <div 
                      className="eventmodal-v2-plan-content" 
                      onClick={() => setIsEditingLocation(true)}
                    >
                      {formData.location || <span style={{ color: '#9ca3af' }}>添加地点...</span>}
                    </div>
                  )}
                </div>

                {/* 日历来源和同步模式 */}
                <div className="eventmodal-v2-plan-row" style={{ marginTop: '4px' }}>
                  <span style={{ flexShrink: 0, color: '#6b7280' }}>来自</span>
                  <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                        <strong style={{ color: '#1f2937' }}>Outlook</strong>
                      </span>
                      <span style={{ color: '#6b7280' }}>: 默认</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
                      <span>📥</span>
                      <span>只接收同步</span>
                    </div>
                  </div>
                </div>

                {/* 实际进展区域 */}
                <div className="eventmodal-v2-section-header" style={{ marginTop: '20px' }}>
                  <div className="eventmodal-v2-section-header-title">实际进展</div>
                  <span className="total-duration">总时长: 3小时</span>
                </div>

                {/* 实际进展滚动容器 */}
                <div className="progress-section-wrapper">
                  {/* 时间片段列表 */}
                  <div className="timer-segments-list">
                    {/* 片段 1 */}
                    <div className="timer-segment">
                      <img src={timerCheckIcon} alt="" className="timer-check-icon" />
                      <span>2025-10-18 (周六) 10:00</span>
                      <div className="time-arrow-section">
                        <span className="duration-text">2h30min</span>
                        <img src={arrowBlueIcon} alt="" className="arrow-icon" />
                      </div>
                      <span>12:00</span>
                    </div>
                    
                    {/* 片段 2 (跨天) */}
                    <div className="timer-segment">
                      <img src={timerCheckIcon} alt="" className="timer-check-icon" />
                      <span>2025-10-18 (周六) 23:00</span>
                      <div className="time-arrow-section">
                        <span className="duration-text">2h</span>
                        <img src={arrowBlueIcon} alt="" className="arrow-icon" />
                      </div>
                      <span>01:00<sup style={{ color: '#3b82f6', fontSize: '10px', marginLeft: '2px' }}>+1</sup></span>
                    </div>
                  </div>

                  {/* 同步状态 */}
                  <div className="eventmodal-v2-plan-row" style={{ marginTop: '12px' }}>
                    <span style={{ flexShrink: 0, color: '#6b7280' }}>同步</span>
                    <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ width: '8px', height: '8px', background: '#ef4444', borderRadius: '50%' }}></span>
                          <strong style={{ color: '#1f2937' }}>Outlook</strong>
                        </span>
                        <span style={{ color: '#6b7280' }}>: 工作等</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#6b7280', fontSize: '13px' }}>
                        <span>🔄</span>
                        <span>双向同步</span>
                      </div>
                    </div>
                  </div>

                  {/* 对比信息 */}
                  <div style={{ marginTop: '12px', padding: '8px 12px', background: '#fef3c7', borderRadius: '6px', fontSize: '13px', color: '#92400e' }}>
                    比计划多 30min
                  </div>

                  {/* ddl完成状态 */}
                  <div className="ddl-completion">
                    <img src={ddlCheckedIcon} alt="" />
                    <span>ddl提前3h完成于2025-10-19 13:16</span>
                  </div>
                </div>
              </div>

              {/* 右侧：Event Log（仅详情视图） */}
              {isDetailView && (
                <div className="event-log">
                  <button className="back-button" onClick={() => setIsDetailView(false)}>
                    ← back
                  </button>
                  
                  {/* 标签区域 */}
                  <div className="tags-area">
                    <span className="tag-mention tag-work">#🔗工作/#📝文档编辑</span>
                    <span className="tag-mention tag-client">#📮重点客户/#📮腾讯</span>
                  </div>

                  {/* Plan 提示区域 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280', marginBottom: '12px', lineHeight: '26px' }}>
                    <img src={taskGrayIcon} style={{ width: '16px', height: '16px' }} alt="" />
                    <img src={ddlWarnIcon} style={{ width: '20px', height: '20px' }} alt="" />
                    <span>创建于 12h前，ddl 还有 2h30min</span>
                  </div>

                  {/* 关联区域 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: '#6b7280', marginBottom: '16px', lineHeight: '26px' }}>
                    <img src={linkColorIcon} style={{ width: '20px', height: '20px' }} alt="" />
                    <span>上级任务：Project Ace (5/7)</span>
                  </div>

                  {/* Slate 编辑区 */}
                  <div style={{ flex: 1, background: 'white', display: 'flex', flexDirection: 'column' }}>
                    
                    {/* 第一条日志 */}
                    <div style={{ position: 'relative', paddingLeft: '8px', marginBottom: '24px' }}>
                      {/* 左侧竖线 */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: '#e5e7eb' }}></div>
                      
                      {/* 时间戳 */}
                      <p style={{ fontSize: '16px', color: '#e5e7eb', lineHeight: 1, margin: '0 0 8px 0', padding: 0, fontFamily: "'Microsoft YaHei', Arial" }}>
                        2025-10-19 10:21:18
                      </p>

                      <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: "'Inter', 'Microsoft YaHei', Arial" }}>
                        处理完了一些出差的logistics，还有报销整理，现在终于可以开干了！<br />
                        准备先一个提纲丢给GPT，看看情况
                      </p>
                    </div>

                    {/* 第二条日志 */}
                    <div style={{ position: 'relative', paddingLeft: '8px', marginBottom: '24px' }}>
                      {/* 左侧竖线 */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: '#e5e7eb' }}></div>
                      
                      {/* 时间戳 */}
                      <p style={{ fontSize: '16px', color: '#e5e7eb', lineHeight: 1, margin: '0 0 8px 0', padding: 0, fontFamily: "'Microsoft YaHei', Arial" }}>
                        2025-10-19 10:35:18 | 16min later
                      </p>

                      <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: "'Inter', 'Microsoft YaHei', Arial" }}>
                        太强了！居然直接成稿了，那现在就只要做些检查了<br />
                        感觉主要是一些流程和逻辑错误，语言上没有太多可以修缮的，文采比我好太多了QUQ
                      </p>
                    </div>

                    {/* 第三条日志 - 可编辑区域 */}
                    <div style={{ position: 'relative', paddingLeft: '8px', marginBottom: '24px' }}>
                      {/* 左侧竖线 */}
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: '#e5e7eb' }}></div>
                      
                      {/* 时间戳 */}
                      <p style={{ fontSize: '16px', color: '#e5e7eb', lineHeight: 1, margin: '0 0 8px 0', padding: 0, fontFamily: "'Microsoft YaHei', Arial" }}>
                        2025-10-19 10:35:18 | 16min later
                      </p>

                      {/* 可编辑区域提示文字 */}
                      <p style={{ color: '#9ca3af', fontSize: '14px', lineHeight: 1.6, margin: 0, fontFamily: "'Inter', 'Microsoft YaHei', Arial" }}>
                        双击"Alt"召唤表情、格式等，点击右下方问号浮窗查看更多高效快捷键哦
                      </p>
                    </div>

                    {/* FloatingBar 组件将在这里引入 */}
                  </div>
                </div>
              )}
            </div>

            {/* 底部按钮 */}
            {isDetailView ? (
              <div className="detail-footer">
                <button className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel">取消</button>
                <button className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-save">保存</button>
              </div>
            ) : (
              <div className="compact-footer">
                <button className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel">取消</button>
                <button className="eventmodal-v2-footer-btn" style={{ color: '#3b82f6' }}>📝 展开日志</button>
                <button className="footer-btn footer-btn-save">保存</button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
