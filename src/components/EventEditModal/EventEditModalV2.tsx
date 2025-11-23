/**
 * EventEditModal v2 - 双视图事件编辑模态框
 * 
 * 完整的事件编辑器，支持详情视图和收缩视图
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
import { createPortal } from 'react-dom';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

import { TagService } from '../../services/TagService';
import { EventService } from '../../services/EventService';
import { ContactService } from '../../services/ContactService';
import { Event, Contact } from '../../types';
import { HierarchicalTagPicker } from '../HierarchicalTagPicker/HierarchicalTagPicker';
import UnifiedDateTimePicker from '../FloatingToolbar/pickers/UnifiedDateTimePicker';
import { AttendeeDisplay } from '../common/AttendeeDisplay';
import { LocationInput } from '../common/LocationInput';
import { CalendarPicker } from '../../features/Calendar/components/CalendarPicker';
import { SimpleCalendarDropdown } from '../EventEditModalV2Demo/SimpleCalendarDropdown';
import { SyncModeDropdown } from '../EventEditModalV2Demo/SyncModeDropdown';
import { getAvailableCalendarsForSettings, getCalendarGroupColor } from '../../utils/calendarUtils';
// TimeLog 相关导入
import { LightSlateEditor } from '../LightSlateEditor';
// import { insertTag, insertEmoji, insertDateMention } from '../UnifiedSlateEditor/helpers';
// import { parseExternalHtml, slateNodesToRichHtml } from '../UnifiedSlateEditor/serialization';
import { formatTimeForStorage } from '../../utils/timeUtils';
import './EventEditModalV2.css';

// Import SVG icons
import timerStartIcon from '../../assets/icons/timer_start.svg';
import pauseIcon from '../../assets/icons/pause.svg';
import stopIcon from '../../assets/icons/stop.svg';
import cancelIcon from '../../assets/icons/cancel.svg';
import rotationColorIcon from '../../assets/icons/rotation_color.svg';
import attendeeIcon from '../../assets/icons/Attendee.svg';
import datetimeIcon from '../../assets/icons/datetime.svg';
import locationIcon from '../../assets/icons/Location.svg';
import arrowBlueIcon from '../../assets/icons/Arrow_blue.svg';
import timerCheckIcon from '../../assets/icons/timer_check.svg';
import addTaskColorIcon from '../../assets/icons/Add_task_color.svg';
import ddlAddIcon from '../../assets/icons/ddl_add.svg';
import ddlCheckedIcon from '../../assets/icons/ddl_checked.svg';
import taskGrayIcon from '../../assets/icons/task_gray.svg';
import ddlWarnIcon from '../../assets/icons/ddl_warn.svg';
import linkColorIcon from '../../assets/icons/link_color.svg';

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
  eventlog?: string; // Slate JSON string for TimeLog content
  description?: string; // HTML export for Outlook sync
}

interface EventEditModalV2Props {
  event: Event | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updatedEvent: Event) => void;
  onDelete?: (eventId: string) => void;
  hierarchicalTags: any[];
  globalTimer?: {
    startTime: number;
    originalStartTime?: number;
    elapsedTime: number;
    isRunning: boolean;
    isPaused?: boolean;
    eventId?: string;
    parentEventId?: string;
  } | null;
  onStartTimeChange?: (newStartTime: number) => void;
  onTimerAction?: (action: 'start' | 'pause' | 'stop' | 'cancel', eventId?: string) => void;
  // v1 兼容 props（保留但不使用）
  microsoftService?: any;
  availableCalendars?: any[];
  availableTodoLists?: any[];
  draggable?: boolean;
  resizable?: boolean;
}

export const EventEditModalV2: React.FC<EventEditModalV2Props> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags,
  globalTimer,
  onTimerAction,
}) => {
  // 如果modal未打开，不渲染
  if (!isOpen) return null;
  // 从 props.event 初始化表单数据
  const [formData, setFormData] = useState<MockEvent>(() => {
    if (event) {
      return {
        id: event.id,
        title: event.title || '',
        tags: event.tags || [],
        isTask: event.isTask || false,
        isTimer: event.isTimer || false,
        parentEventId: event.parentEventId || null,
        startTime: event.startTime || null,
        endTime: event.endTime || null,
        allDay: event.isAllDay || false,
        location: event.location || '',
        organizer: event.organizer,
        attendees: event.attendees || [],
        eventlog: typeof event.eventlog === 'string' ? event.eventlog : JSON.stringify(event.eventlog?.content || []),
        description: event.description || '',
      };
    }
    // 新建事件时的默认值
    return {
      id: `event-${Date.now()}`,
      title: '',
      tags: [],
      isTask: false,
      isTimer: false,
      parentEventId: null,
      startTime: null,
      endTime: null,
      allDay: false,
      location: '',
      attendees: [],
      eventlog: '[]',
      description: '',
    };
  });

  // UI 状态
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTagPicker, setShowTagPicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [showSourceCalendarPicker, setShowSourceCalendarPicker] = useState(false);
  const [showSyncCalendarPicker, setShowSyncCalendarPicker] = useState(false);
  const [showSourceSyncModePicker, setShowSourceSyncModePicker] = useState(false);
  const [showSyncSyncModePicker, setShowSyncSyncModePicker] = useState(false);
  const [isDetailView, setIsDetailView] = useState(true);
  const [tagPickerPosition, setTagPickerPosition] = useState({ top: 0, left: 0, width: 0 });
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  
  // TimeLog 相关状态 - 使用 Slate JSON 字符串
  const timelogContent = formData.eventlog || '[]'; // 默认空的 Slate JSON 数组
  
  const [activePickerIndex, setActivePickerIndex] = useState(-1);

  // 获取真实的可用日历数据
  const availableCalendars = getAvailableCalendarsForSettings();

  // 日历来源状态 - 使用真实日历的第一个作为默认值
  const [sourceCalendarId, setSourceCalendarId] = useState(() => availableCalendars[0]?.id || 'local-created');
  const [syncCalendarId, setSyncCalendarId] = useState(() => availableCalendars[1]?.id || availableCalendars[0]?.id || 'not-synced');

  // 同步模式数据
  const syncModes = [
    { id: 'receive-only', name: '只接收同步', emoji: '📥' },
    { id: 'send-only', name: '只发送同步', emoji: '📤' },
    { id: 'send-only-private', name: '只发送（仅自己）', emoji: '📤🔒' },
    { id: 'bidirectional', name: '双向同步', emoji: '🔄' },
    { id: 'bidirectional-private', name: '双向同步（仅自己）', emoji: '🔄🔒' },
  ];

  // TimeLog 相关 refs
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const slateEditorRef = useRef<any>(null);
  
  // FloatingBar 图标配置
  const floatingBarIcons = [
    { icon: '😀', alt: '表情' },
    { icon: '#', alt: '标签' },
    { icon: '📅', alt: '日期' },
    { icon: '•', alt: '列表' },
    { icon: '🎨', alt: '颜色' },
    { icon: '+', alt: '添加任务' }
  ];
  const [sourceSyncMode, setSourceSyncMode] = useState('receive-only');
  const [syncSyncMode, setSyncSyncMode] = useState('bidirectional');

  // 获取日历显示信息
  const getCalendarInfo = (calendarId: string) => {
    const calendar = availableCalendars.find(c => c.id === calendarId);
    if (!calendar) return { name: 'Unknown', subName: '', color: '#999999' };
    
    // 从 calendar.name 中解析名称，去除 emoji 前缀（使用兼容的正则表达式）
    const cleanName = calendar.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, ''); // 去除 emoji
    const [mainName, subName] = cleanName.includes(': ') ? cleanName.split(': ') : [cleanName, ''];
    
    return {
      name: mainName,
      subName: subName ? `: ${subName}` : '',
      color: calendar.color
    };
  };

  // 获取同步模式显示信息
  const getSyncModeInfo = (modeId: string) => {
    const mode = syncModes.find(m => m.id === modeId);
    return mode || { id: 'unknown', name: '未知模式', emoji: '❓' };
  };

  // 当 event 变化时同步到 formData
  useEffect(() => {
    if (event) {
      setFormData({
        id: event.id,
        title: event.title || '',
        tags: event.tags || [],
        isTask: event.isTask || false,
        isTimer: event.isTimer || false,
        parentEventId: event.parentEventId || null,
        startTime: event.startTime || null,
        endTime: event.endTime || null,
        allDay: event.isAllDay || false,
        location: event.location || '',
        organizer: event.organizer,
        attendees: event.attendees || [],
        eventlog: typeof event.eventlog === 'string' ? event.eventlog : JSON.stringify(event.eventlog?.content || []),
        description: event.description || '',
      });
    }
  }, [event?.id]); // 只在 event.id 变化时执行

  // 初始化时手动提取演示数据的联系人到联系人库
  useEffect(() => {
    console.log('[EventEditModalV2] 初始化：手动提取联系人');
    ContactService.extractAndAddFromEvent(formData.organizer, formData.attendees);
  }, []); // 只在挂载时执行一次

  // Ref for title input
  const titleInputRef = useRef<HTMLInputElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const tagRowRef = useRef<HTMLDivElement>(null);
  const tagPickerDropdownRef = useRef<HTMLDivElement>(null);
  const sourceCalendarRef = useRef<HTMLDivElement>(null);
  const sourceSyncModeRef = useRef<HTMLDivElement>(null);
  const syncCalendarRef = useRef<HTMLDivElement>(null);
  const syncSyncModeRef = useRef<HTMLDivElement>(null);

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

  // 点击外部关闭各种选择器
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      
      // 检查标签选择器
      const clickedInTagPicker = 
        (tagPickerRef.current && tagPickerRef.current.contains(target)) ||
        (tagPickerDropdownRef.current && tagPickerDropdownRef.current.contains(target));
      
      if (!clickedInTagPicker && showTagPicker) {
        setShowTagPicker(false);
      }

      // 检查来源日历选择器
      const clickedInSourceCalendar = sourceCalendarRef.current?.parentElement?.contains(target);
      if (!clickedInSourceCalendar && showSourceCalendarPicker) {
        setShowSourceCalendarPicker(false);
      }

      // 检查来源同步模式选择器
      const clickedInSourceSyncMode = sourceSyncModeRef.current?.parentElement?.contains(target);
      if (!clickedInSourceSyncMode && showSourceSyncModePicker) {
        setShowSourceSyncModePicker(false);
      }

      // 检查同步日历选择器
      const clickedInSyncCalendar = syncCalendarRef.current?.parentElement?.contains(target);
      if (!clickedInSyncCalendar && showSyncCalendarPicker) {
        setShowSyncCalendarPicker(false);
      }

      // 检查同步模式选择器
      const clickedInSyncSyncMode = syncSyncModeRef.current?.parentElement?.contains(target);
      if (!clickedInSyncSyncMode && showSyncSyncModePicker) {
        setShowSyncSyncModePicker(false);
      }

      // 时间选择器通过遮罩层处理点击外部关闭，这里不需要额外处理
    };

    if (showTagPicker || showSourceCalendarPicker || showSyncCalendarPicker || showSourceSyncModePicker || showSyncSyncModePicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showTagPicker, showSourceCalendarPicker, showSyncCalendarPicker, showSourceSyncModePicker, showSyncSyncModePicker]);

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
   * 选择 emoji（标题用）
   */
  const handleTitleEmojiSelect = (emoji: any) => {
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

  // ==================== TimeLog 处理函数 ====================
  
  /**
   * TimeLog 内容变化处理（LightSlateEditor）
   */
  const handleTimelogChange = (htmlContent: string) => {
    setFormData({
      ...formData,
      description: htmlContent,
      eventlog: htmlContent // 保持向后兼容
    });
  };

  /**
   * Slate 编辑器就绪回调
   */
  const handleSlateEditorReady = (editor: any) => {
    slateEditorRef.current = editor;
  };

  /**
   * FloatingToolbar 表情选择 - 暂时禁用
   */
  const handleEmojiSelect = (emoji: any) => {
    // TODO: 重新实现 LightSlateEditor 的 emoji 插入
    // if (slateEditorRef.current) {
    //   insertEmoji(slateEditorRef.current, emoji.native);
    // }
    setActivePickerIndex(-1); // 关闭 picker
  };

  /**
   * FloatingToolbar 标签选择 - 暂时禁用
   */
  const handleTagSelect = (tagId: string) => {
    // TODO: 重新实现 LightSlateEditor 的 tag 插入
    // if (slateEditorRef.current) {
    //   const tag = TagService.getTagById(tagId);
    //   if (tag) {
    //     insertTag(
    //       slateEditorRef.current,
    //       tagId,
    //       tag.name,
    //       tag.color || '#999999',
    //       tag.emoji || '',
    //       false // mentionOnly
    //     );
    //   }
    // }
    setActivePickerIndex(-1); // 关闭 picker
  };

  /**
   * FloatingToolbar 日期范围选择
   */
  const handleDateRangeSelect = (startDate: string, endDate?: string) => {
    // TODO: 重新实现 LightSlateEditor 的 date mention 插入
    // if (slateEditorRef.current) {
    //   insertDateMention(
    //     slateEditorRef.current,
    //     startDate,
    //     endDate,
    //     false // mentionOnly
    //   );
    // }
    setActivePickerIndex(-1); // 关闭 picker
  };

  // ==================== 渲染函数 ====================

  return (
    <div className="event-edit-modal-v2-overlay" onClick={onClose}>
      <div 
        className={`event-edit-modal-v2 ${isDetailView ? 'detail-view' : 'compact-view'}`}
        onClick={(e) => e.stopPropagation()}
      >
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
                          onEmojiSelect={handleTitleEmojiSelect}
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
                          if (onTimerAction) {
                            onTimerAction('start', formData.id);
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
                          if (onTimerAction) {
                            onTimerAction(isPaused ? 'pause' : 'pause', formData.id);
                          }
                        }}
                        title={isPaused ? '继续' : '暂停'}
                      >
                        <img src={pauseIcon} alt={isPaused ? '继续' : '暂停'} />
                      </button>
                      <button 
                        className="timer-btn stop-btn"
                        onClick={() => {
                          if (onTimerAction && window.confirm('确定要结束计时并保存吗？')) {
                            onTimerAction('stop', formData.id);
                          }
                        }}
                        title="停止并保存"
                      >
                        <img src={stopIcon} alt="停止" />
                      </button>
                      <button 
                        className="timer-btn cancel-btn"
                        onClick={() => {
                          if (onTimerAction && window.confirm('确定要取消计时吗？当前计时将不会被保存。')) {
                            onTimerAction('cancel', formData.id);
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

                {/* 时间选择器弹出层 */}
                {showTimePicker && (
                  <div
                    style={{
                      position: 'fixed',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      zIndex: 1000,
                      backgroundColor: 'white',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                    }}
                  >
                    <UnifiedDateTimePicker
                      initialStart={formData.startTime || undefined}
                      initialEnd={formData.endTime || undefined}
                      onApplied={handleTimeApplied}
                      onClose={() => setShowTimePicker(false)}
                    />
                  </div>
                )}

                {/* 时间选择器背景遮罩 */}
                {showTimePicker && (
                  <div
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.5)',
                      zIndex: 999
                    }}
                    onClick={() => setShowTimePicker(false)}
                  />
                )}

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
                <div className="eventmodal-v2-plan-row" style={{ marginTop: '4px', position: 'relative' }}>
                  <span style={{ flexShrink: 0, color: '#6b7280' }}>来自</span>
                  <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* 日历选择区域 */}
                    <div style={{ position: 'relative' }}>
                      <div 
                        ref={sourceCalendarRef}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.15s'
                        }}
                        onClick={() => setShowSourceCalendarPicker(!showSourceCalendarPicker)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          <span style={{ 
                            width: '8px', 
                            height: '8px', 
                            background: getCalendarInfo(sourceCalendarId).color, 
                            borderRadius: '50%' 
                          }}></span>
                          <strong style={{ color: '#1f2937' }}>{getCalendarInfo(sourceCalendarId).name}</strong>
                        </span>
                        <span style={{ color: '#6b7280' }}>{getCalendarInfo(sourceCalendarId).subName}</span>
                      </div>
                      
                      {showSourceCalendarPicker && createPortal(
                        <div 
                          style={{
                            position: 'fixed',
                            top: sourceCalendarRef.current ? (sourceCalendarRef.current.getBoundingClientRect().bottom + 4) : '50%',
                            left: sourceCalendarRef.current ? sourceCalendarRef.current.getBoundingClientRect().left : '50%',
                            zIndex: 9999,
                            minWidth: '200px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          <SimpleCalendarDropdown
                            availableCalendars={availableCalendars}
                            selectedCalendarId={sourceCalendarId}
                            onSelectionChange={(calendarId) => {
                              setSourceCalendarId(calendarId);
                              setShowSourceCalendarPicker(false);
                            }}
                            onClose={() => setShowSourceCalendarPicker(false)}
                            title="选择来源日历"
                          />
                        </div>,
                        document.body
                      )}
                    </div>
                    
                    {/* 同步模式选择区域 */}
                    <div style={{ position: 'relative' }}>
                      <div 
                        ref={sourceSyncModeRef}
                        style={{ 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: '6px', 
                          color: '#6b7280', 
                          fontSize: '13px',
                          cursor: 'pointer',
                          padding: '2px 4px',
                          borderRadius: '4px',
                          transition: 'background-color 0.15s'
                        }}
                        onClick={() => setShowSourceSyncModePicker(!showSourceSyncModePicker)}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <span>{getSyncModeInfo(sourceSyncMode).emoji}</span>
                        <span>{getSyncModeInfo(sourceSyncMode).name}</span>
                      </div>
                      
                      {showSourceSyncModePicker && createPortal(
                        <div 
                          style={{
                            position: 'fixed',
                            top: sourceSyncModeRef.current ? (sourceSyncModeRef.current.getBoundingClientRect().bottom + 4) : '50%',
                            right: sourceSyncModeRef.current ? (window.innerWidth - sourceSyncModeRef.current.getBoundingClientRect().right) : 'auto',
                            left: sourceSyncModeRef.current ? 'auto' : '50%',
                            zIndex: 9999,
                            minWidth: '200px',
                            backgroundColor: '#ffffff',
                            border: '1px solid #e5e7eb',
                            borderRadius: '8px',
                            boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                          }}
                        >
                          <SyncModeDropdown
                            availableModes={syncModes}
                            selectedModeId={sourceSyncMode}
                            onSelectionChange={(modeId) => {
                              setSourceSyncMode(modeId);
                              setShowSourceSyncModePicker(false);
                            }}
                            onClose={() => setShowSourceSyncModePicker(false)}
                            title="选择同步模式"
                          />
                        </div>,
                        document.body
                      )}
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
                  <div className="eventmodal-v2-plan-row" style={{ marginTop: '12px', position: 'relative' }}>
                    <span style={{ flexShrink: 0, color: '#6b7280' }}>同步</span>
                    <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      {/* 日历选择区域 */}
                      <div style={{ position: 'relative' }}>
                        <div 
                          ref={syncCalendarRef}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            transition: 'background-color 0.15s'
                          }}
                          onClick={() => setShowSyncCalendarPicker(!showSyncCalendarPicker)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              background: getCalendarInfo(syncCalendarId).color, 
                              borderRadius: '50%' 
                            }}></span>
                            <strong style={{ color: '#1f2937' }}>{getCalendarInfo(syncCalendarId).name}</strong>
                          </span>
                          <span style={{ color: '#6b7280' }}>{getCalendarInfo(syncCalendarId).subName}</span>
                        </div>
                        
                        {showSyncCalendarPicker && createPortal(
                          <div 
                            style={{
                              position: 'fixed',
                              top: syncCalendarRef.current ? (syncCalendarRef.current.getBoundingClientRect().bottom + 4) : '50%',
                              left: syncCalendarRef.current ? syncCalendarRef.current.getBoundingClientRect().left : '50%',
                              zIndex: 9999,
                              minWidth: '200px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            }}
                          >
                            <SimpleCalendarDropdown
                              availableCalendars={availableCalendars}
                              selectedCalendarId={syncCalendarId}
                              onSelectionChange={(calendarId) => {
                                setSyncCalendarId(calendarId);
                                setShowSyncCalendarPicker(false);
                              }}
                              onClose={() => setShowSyncCalendarPicker(false)}
                              title="选择同步日历"
                            />
                          </div>,
                          document.body
                        )}
                      </div>
                      
                      {/* 同步模式选择区域 */}
                      <div style={{ position: 'relative' }}>
                        <div 
                          ref={syncSyncModeRef}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px', 
                            color: '#6b7280', 
                            fontSize: '13px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            transition: 'background-color 0.15s'
                          }}
                          onClick={() => setShowSyncSyncModePicker(!showSyncSyncModePicker)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span>{getSyncModeInfo(syncSyncMode).emoji}</span>
                          <span>{getSyncModeInfo(syncSyncMode).name}</span>
                        </div>
                        
                        {showSyncSyncModePicker && createPortal(
                          <div 
                            style={{
                              position: 'fixed',
                              top: syncSyncModeRef.current ? (syncSyncModeRef.current.getBoundingClientRect().bottom + 4) : '50%',
                              right: syncSyncModeRef.current ? (window.innerWidth - syncSyncModeRef.current.getBoundingClientRect().right) : 'auto',
                              left: syncSyncModeRef.current ? 'auto' : '50%',
                              zIndex: 9999,
                              minWidth: '200px',
                              backgroundColor: '#ffffff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)'
                            }}
                          >
                            <SyncModeDropdown
                              availableModes={syncModes}
                              selectedModeId={syncSyncMode}
                              onSelectionChange={(modeId) => {
                                setSyncSyncMode(modeId);
                                setShowSyncSyncModePicker(false);
                              }}
                              onClose={() => setShowSyncSyncModePicker(false)}
                              title="选择同步模式"
                            />
                          </div>,
                          document.body
                        )}
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

                  {/* TimeLog 编辑区 */}
                  <div ref={rightPanelRef} style={{ flex: 1, background: 'white', display: 'flex', flexDirection: 'column' }}>
                    <LightSlateEditor
                      content={timelogContent}
                      parentEventId={formData.id || 'new-event'}
                      enableTimestamp={true}
                      placeholder="记录时间轴..."
                      onChange={(slateJson) => {
                        setFormData({ ...formData, eventlog: slateJson });
                      }}
                      className="eventlog-editor"
                    />
                    
                    {/* 简单的 FloatingToolbar 演示 */}
                    <div style={{
                      position: 'absolute',
                      bottom: '20px',
                      right: '20px',
                      background: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      padding: '8px',
                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
                      display: 'flex',
                      gap: '4px'
                    }}>
                      {floatingBarIcons.map((iconConfig, index) => (
                        <button
                          key={index}
                          style={{
                            background: activePickerIndex === index ? '#f3f4f6' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            padding: '8px',
                            cursor: 'pointer',
                            fontSize: '16px',
                            minWidth: '36px',
                            minHeight: '36px'
                          }}
                          onClick={() => {
                            // 简单的功能演示
                            if (index === 0) { // 表情
                              handleEmojiSelect({ native: '😊' });
                            } else if (index === 1) { // 标签
                              handleTagSelect('work'); // 假设有个工作标签
                            } else if (index === 2) { // 日期
                              handleDateRangeSelect(new Date().toISOString());
                            }
                            setActivePickerIndex(activePickerIndex === index ? -1 : index);
                          }}
                          title={iconConfig.alt}
                        >
                          {iconConfig.icon}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            {/* modal-content 结束 */}

            {/* 底部按钮 */}
            {isDetailView ? (
              <div className="detail-footer">
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel"
                  onClick={onClose}
                >
                  取消
                </button>
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-save"
                  onClick={() => {
                    // 保存时转换 formData 为 Event
                    const updatedEvent: Event = {
                      ...event,
                      ...formData,
                      id: formData.id,
                      title: formData.title,
                      tags: formData.tags,
                      isTask: formData.isTask,
                      isTimer: formData.isTimer,
                      parentEventId: formData.parentEventId,
                      startTime: formData.startTime,
                      endTime: formData.endTime,
                      allDay: formData.allDay,
                      location: formData.location,
                      organizer: formData.organizer,
                      attendees: formData.attendees,
                      eventlog: formData.eventlog,
                      description: formData.description,
                    } as Event;
                    onSave(updatedEvent);
                  }}
                >
                  保存
                </button>
              </div>
            ) : (
              <div className="compact-footer">
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel"
                  onClick={onClose}
                >
                  取消
                </button>
                <button 
                  className="eventmodal-v2-footer-btn" 
                  style={{ color: '#3b82f6' }}
                  onClick={() => setIsDetailView(true)}
                >
                  📝 展开日志
                </button>
                <button 
                  className="footer-btn footer-btn-save"
                  onClick={() => {
                    const updatedEvent: Event = {
                      ...event,
                      ...formData,
                    } as Event;
                    onSave(updatedEvent);
                  }}
                >
                  保存
                </button>
              </div>
            )}
        </div>
      </div>
    );
};
