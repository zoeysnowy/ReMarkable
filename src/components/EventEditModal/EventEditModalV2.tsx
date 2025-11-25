/**
 * EventEditModal v2 - 双视图事件编辑模态框
 * 
 * ==================== 功能概览 ====================
 * 1. 左侧事件标识区（Emoji、标题、标签、任务勾选）
 * 2. Timer 计时按钮交互
 * 3. 计划安排编辑（时间、地点、参会人）
 * 4. 实际进展显示
 * 5. Event Log 富文本编辑（LightSlateEditor）
 * 
 * ==================== 架构集成 ====================
 * 
 * 数据流向（遵循 EVENTHUB_TIMEHUB_ARCHITECTURE.md）:
 * ```
 * 用户输入
 *   ↓
 * formData（本地状态）
 *   ↓
 * handleSave()
 *   ↓
 * EventHub.createEvent() / EventHub.updateFields()
 *   ↓
 * EventService.createEvent() / EventService.updateEvent()
 *   ↓
 * localStorage 持久化 + BroadcastChannel 同步
 *   ↓
 * eventsUpdated 事件 → TimeCalendar 监听 → UI 刷新
 * ```
 * 
 * 职责分离：
 * - EventEditModal: UI 层，负责表单输入和展示
 * - EventHub: 状态管理层，负责缓存和增量更新
 * - EventService: 持久化层，负责 localStorage 和跨 Tab 同步
 * - TimeHub: 时间管理层（本组件不直接调用，时间字段随事件保存）
 * 
 * 关键原则：
 * 1. ✅ 所有事件操作通过 EventHub（禁止直接调用 EventService）
 * 2. ✅ 增量更新使用 updateFields（避免覆盖其他字段）
 * 3. ✅ 创建 vs 更新：检查 EventService（持久化层）而非 EventHub 缓存
 * 4. ✅ 原子性保存：所有字段一起保存（避免部分保存导致数据不一致）
 * 5. ✅ 时间字段：与其他字段一起保存，不单独调用 TimeHub.setEventTime()
 * 
 * ==================== 数据结构 ====================
 * 
 * MockEvent（formData）:
 * - 非时间字段: title, tags, isTask, location, organizer, attendees, eventlog, description
 * - 时间字段: startTime, endTime, allDay
 * - 元数据: id, parentEventId, isTimer
 * 
 * Event（完整事件）:
 * - 继承 MockEvent 的所有字段
 * - 额外字段: createdAt, updatedAt, syncStatus, remarkableSource, calendarIds, todoListIds
 * 
 * eventlog 字段格式兼容：
 * - 旧格式: 字符串（HTML）
 * - 新格式: EventLog 对象 { content: Slate JSON, descriptionPlainText, ... }
 * - LightSlateEditor 需要: Slate JSON 字符串
 * 
 * ==================== 性能优化 ====================
 * 
 * 1. 条件渲染: !isOpen 时不渲染（减少 DOM 节点）
 * 2. 懒加载: 动态 import EventHub（减少初始包大小）
 * 3. 依赖优化: useEffect 只监听 event?.id（避免频繁更新）
 * 4. 联系人提取: 初始化时自动提取 organizer/attendees 到 ContactService
 * 
 * ==================== 相关文档 ====================
 * 
 * - EVENTHUB_TIMEHUB_ARCHITECTURE.md: 核心架构规范
 * - EVENTEDITMODAL_V2_IMPLEMENTATION.md: 实现细节
 * - EVENT_ARCHITECTURE.md: 旧版架构文档（已归档）
 * 
 * @author Zoey Gong
 * @version 2.0.1
 * @lastModified 2025-11-24
 */

import React, { useState, useCallback, useRef, useEffect, RefObject } from 'react';
import { createPortal } from 'react-dom';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';

import { TagService } from '../../services/TagService';
import { EventService } from '../../services/EventService';
import { ContactService } from '../../services/ContactService';
import { EventHistoryService } from '../../services/EventHistoryService';
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
import { jsonToSlateNodes, slateNodesToHtml, slateNodesToJson } from '../LightSlateEditor/serialization';
import { HeadlessFloatingToolbar } from '../FloatingToolbar/HeadlessFloatingToolbar';
import { useFloatingToolbar } from '../FloatingToolbar/useFloatingToolbar';
import { insertTag, insertEmoji, insertDateMention, applyTextFormat } from '../UnifiedSlateEditor/helpers';
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
import backIcon from '../../assets/icons/back.svg';
import remarkableLogo from '../../assets/icons/LOGO.svg';

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
  // 🆕 日历同步配置
  calendarIds?: string[];
  planSyncConfig?: {
    mode?: string;
    targetCalendars?: string[];
    tagMapping?: { [key: string]: string[] };
  };
  actualSyncConfig?: {
    mode?: string;
    targetCalendars?: string[];
    tagMapping?: { [key: string]: string[] };
  } | null;
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
  onTimerAction?: (action: 'start' | 'pause' | 'resume' | 'stop' | 'cancel', tagIds?: string | string[], eventIdOrParentId?: string) => void; // 🔧 修改：统一参数格式
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
  
  /**
   * ==================== formData 初始化 ====================
   * 
   * 数据来源：
   * 1. 编辑已有事件：props.event（来自 EventService.getAllEvents()）
   * 2. 创建新事件：TimeCalendar 传入的临时对象（带 local-${timestamp} ID）
   * 
   * 字段说明：
   * - 非时间字段：title, tags, isTask, location, attendees, eventlog, description
   * - 时间字段：startTime, endTime, allDay（存储但不在此处管理）
   * - 元数据：id, parentEventId（Timer父子关系）, organizer（Outlook同步）
   * 
   * eventlog 字段处理：
   * - 旧格式：字符串（HTML）
   * - 新格式：EventLog 对象 { content: Slate JSON, ... }
   * - LightSlateEditor 需要 Slate JSON 字符串
   * 
   * 架构分层：
   * - EventEditModal：UI层，负责用户输入和展示
   * - EventHub：状态管理层，负责缓存和增量更新
   * - EventService：持久化层，负责 localStorage 存储
   * - TimeHub：时间管理层，负责 TimeSpec 和时间意图（本组件不直接调用）
   */
  const [formData, setFormData] = useState<MockEvent>(() => {
    if (event) {
      return {
        id: event.id,
        title: event.title?.colorTitle || event.title?.simpleTitle || '',
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
        eventlog: (() => {
          // 处理 eventlog 字段的多种格式
          if (!event.eventlog) return '[]';
          
          if (typeof event.eventlog === 'string') {
            // 如果是字符串，直接返回（假设已经是 Slate JSON）
            return event.eventlog;
          }
          
          // 如果是 EventLog 对象，提取 content 字段
          // content 字段本身已经是 JSON 字符串，不需要再 JSON.stringify
          return event.eventlog.content || '[]';
        })(),
        description: event.description || '',
        // 🆕 日历同步配置
        calendarIds: event.calendarIds || [],
        planSyncConfig: event.planSyncConfig || {
          mode: 'receive-only',
          targetCalendars: []
        },
        actualSyncConfig: event.actualSyncConfig || null,
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
      // 🆕 日历同步配置
      calendarIds: [],
      planSyncConfig: {
        mode: 'receive-only',
        targetCalendars: []
      },
      actualSyncConfig: null,
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
  
  // 打印接收到的原始 event 数据
  React.useEffect(() => {
    console.log('==================== EventEditModalV2 Debug ====================');
    console.log('📥 props.event:', event);
    console.log('📥 props.event.eventlog:', event?.eventlog);
    console.log('📥 eventlog type:', typeof event?.eventlog);
    console.log('📦 formData.eventlog:', formData.eventlog);
    console.log('📦 formData.eventlog type:', typeof formData.eventlog);
    console.log('================================================================');
  }, [event, formData.eventlog]);

  // TimeLog 相关状态 - 直接使用 formData.eventlog
  const timelogContent = formData.eventlog || '[]';
  
  const [activePickerIndex, setActivePickerIndex] = useState(-1);
  const [isSubPickerOpen, setIsSubPickerOpen] = useState(false); // 🆕 追踪子选择器（颜色选择器）是否打开

  // 获取真实的可用日历数据
  const availableCalendars = getAvailableCalendarsForSettings();

  // 日历来源状态 - 从 formData.calendarIds 初始化（多选）
  const [sourceCalendarIds, setSourceCalendarIds] = useState<string[]>(() => {
    if (event?.calendarIds && event.calendarIds.length > 0) {
      return event.calendarIds;
    }
    return availableCalendars.length > 0 ? [availableCalendars[0].id] : ['local-created'];
  });
  const [syncCalendarIds, setSyncCalendarIds] = useState<string[]>(() => {
    if (event?.planSyncConfig?.targetCalendars && event.planSyncConfig.targetCalendars.length > 0) {
      return event.planSyncConfig.targetCalendars;
    }
    return availableCalendars.length > 1 ? [availableCalendars[1].id] : [];
  });

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

  // FloatingToolbar Hook
  const floatingToolbar = useFloatingToolbar({
    editorRef: rightPanelRef as RefObject<HTMLElement>,
    enabled: isDetailView,
    menuItemCount: 5, // tag, emoji, dateRange, addTask, textStyle
    isSubPickerOpen, // 🆕 传递子选择器状态，打开时不拦截数字键
    onMenuSelect: (index) => {
      console.log('[EventEditModalV2] Menu selected:', index);
      setActivePickerIndex(index);
    },
  });
  
  const [sourceSyncMode, setSourceSyncMode] = useState('receive-only');
  const [syncSyncMode, setSyncSyncMode] = useState('bidirectional');

  /**
   * 🚫 计算保存按钮是否应该禁用
   * 根据 PRD：当 !formData.title && formData.tags.length === 0 时禁用
   */
  const isSaveDisabled = !formData.title?.trim() && (!formData.tags || formData.tags.length === 0);

  /**
   * 💾 统一保存处理函数
   * 
   * 架构说明：
   * 1. 遵循 EventHub 架构规范（EVENTHUB_TIMEHUB_ARCHITECTURE.md）
   * 2. 数据流：EventEditModal → EventHub → EventService → localStorage
   * 3. 职责分离：
   *    - EventHub: 管理非时间字段（title, tags, description, attendees, eventlog等）
   *    - TimeHub: 管理时间字段（startTime, endTime, isAllDay, timeSpec）
   * 4. 创建 vs 更新：
   *    - 检查 EventService（持久化层）判断事件是否存在
   *    - 新建：EventHub.createEvent() - 一次性创建完整事件
   *    - 更新：EventHub.updateFields() - 增量更新指定字段
   */
  const handleSave = async () => {
    try {
      console.log('💾 [EventEditModalV2] Saving event:', formData.id);
      
      // 🔧 Step 0: 准备 eventlog（Slate JSON 字符串）
      // 原因：用户可能直接点击保存按钮，2秒防抖还没触发
      // 策略：
      //   - 如果编辑器有焦点 → 读取编辑器最新内容（Slate JSON）
      //   - 如果编辑器无焦点 → 使用 formData（已通过失焦保存更新）
      // 
      // ✅ 架构优化：只传递 Slate JSON 字符串给 EventService
      // EventService 会自动转换为 EventLog 对象（content, descriptionHtml, descriptionPlainText）
      let currentEventlog = formData.eventlog;
      
      if (slateEditorRef.current?.editor) {
        const editorElement = document.querySelector('.slate-editable');
        if (editorElement && editorElement.contains(document.activeElement)) {
          console.log('📝 [EventEditModalV2] 编辑器有焦点，读取最新内容');
          try {
            const editorContent = slateEditorRef.current.editor.children;
            currentEventlog = slateNodesToJson(editorContent);
          } catch (error) {
            console.error('❌ [EventEditModalV2] 读取编辑器内容失败，使用 formData:', error);
          }
        } else {
          console.log('📝 [EventEditModalV2] 编辑器无焦点，使用 formData（已通过失焦或自动保存更新）');
        }
      }
      
      // 🔧 Step 1: 使用用户输入的标题（不自动替换为标签名称）
      let finalTitle = formData.title;
      
      // 🔧 Step 2: 处理时间格式 - 确保符合 EventService 的要求
      // EventService 要求时间格式为 "YYYY-MM-DD HH:mm:ss"（空格分隔）
      let startTimeForStorage = formData.startTime;
      let endTimeForStorage = formData.endTime;
      
      if (formData.startTime) {
        const { formatTimeForStorage } = await import('../../utils/timeUtils');
        // 如果 startTime 是 ISO 格式或其他格式，转换为存储格式
        const startDate = new Date(formData.startTime);
        if (!isNaN(startDate.getTime())) {
          startTimeForStorage = formatTimeForStorage(startDate);
        }
      }
      
      if (formData.endTime) {
        const { formatTimeForStorage } = await import('../../utils/timeUtils');
        const endDate = new Date(formData.endTime);
        if (!isNaN(endDate.getTime())) {
          endTimeForStorage = formatTimeForStorage(endDate);
        }
      }
      
      // 🔧 Step 3: 检查是否是运行中的 Timer
      // Timer 运行中，应该使用 globalTimer.eventId，而不是 formData.id
      const isRunningTimer = formData.isTimer && 
                            globalTimer?.isRunning && 
                            globalTimer?.eventId;
      
      console.log('🔍 [EventEditModalV2] Timer check:', {
        isTimer: formData.isTimer,
        globalTimerIsRunning: globalTimer?.isRunning,
        globalTimerEventId: globalTimer?.eventId,
        formDataId: formData.id,
        isRunningTimer
      });
      
      // 🔧 Step 4: 确定正确的 eventId
      // 如果是运行中的 Timer，使用 globalTimer.eventId
      // 否则使用 formData.id 或生成新 ID
      let eventId: string;
      if (isRunningTimer && globalTimer?.eventId) {
        eventId = globalTimer.eventId;
        console.log('⏱️ [EventEditModalV2] Using Timer eventId:', eventId);
      } else if (formData.id && formData.id.trim() !== '') {
        eventId = formData.id;
      } else {
        eventId = `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        console.log('🆕 [EventEditModalV2] Generated new eventId:', eventId);
      }
      
      // 🔧 Step 5: 确定 syncStatus
      const timerSyncStatus = isRunningTimer ? 'local-only' : (event?.syncStatus || 'pending');
      
      console.log('🔍 [EventEditModalV2] Final event ID and sync status:', {
        eventId,
        syncStatus: timerSyncStatus
      });
      
      // 🔧 Step 6: 处理 Private 模式（send-only-private, bidirectional-private）
      // 如果选择了 Private 模式，参与者不邀请，添加到 description
      const isPrivateMode = formData.planSyncConfig?.mode?.includes('-private');
      let finalAttendees = formData.attendees;
      let finalDescription = formData.description || '';
      
      if (isPrivateMode && formData.attendees && formData.attendees.length > 0) {
        console.log('🔒 [EventEditModalV2] Private mode detected, formatting participants to description');
        const participantText = formatParticipantsToDescription(formData.attendees);
        finalDescription = participantText + finalDescription;
        finalAttendees = []; // Private 模式下清空 attendees
      }

      // 🔧 Step 6.5: 标签自动映射（根据同步目标日历自动添加标签）
      let finalTags = [...(formData.tags || [])];
      const targetCalendars = formData.planSyncConfig?.targetCalendars || [];
      
      if (targetCalendars.length > 0) {
        console.log('🏷️ [EventEditModalV2] Auto-mapping tags from target calendars:', targetCalendars);
        const autoTags: string[] = [];
        
        targetCalendars.forEach(calendarId => {
          // 假设日历 ID 格式为 "outlook-work", "google-personal", "icloud-family"
          if (calendarId.includes('outlook')) {
            autoTags.push('工作', 'Outlook');
          } else if (calendarId.includes('google')) {
            autoTags.push('生活', 'Google');
          } else if (calendarId.includes('icloud')) {
            autoTags.push('个人', 'iCloud');
          }
        });
        
        // 去重合并
        finalTags = Array.from(new Set([...finalTags, ...autoTags]));
        console.log('🏷️ [EventEditModalV2] Final tags after auto-mapping:', finalTags);
      }

      // 🔧 Step 7: 构建完整的 Event 对象
      const updatedEvent: Event = {
        ...event, // 保留原有字段（如 createdAt, syncStatus 等）
        ...formData,
        id: eventId, // 使用验证后的 ID
        title: { colorTitle: finalTitle, simpleTitle: undefined, fullTitle: undefined }, // ✅ EventEditModal 使用 colorTitle（HTML格式）
        tags: finalTags, // 🏷️ 使用自动映射后的标签
        isTask: formData.isTask,
        isTimer: formData.isTimer,
        parentEventId: formData.parentEventId,
        startTime: startTimeForStorage,
        endTime: endTimeForStorage,
        isAllDay: formData.allDay,
        location: formData.location,
        organizer: formData.organizer,
        attendees: finalAttendees, // 🔒 Private 模式下为空数组
        description: finalDescription, // 🔒 Private 模式下包含参与者文本
        eventlog: currentEventlog as any,  // ✅ Slate JSON 字符串（EventService 会自动转换）
        syncStatus: timerSyncStatus, // 🔧 Timer 运行中保持 local-only
        // 🆕 日历同步配置
        calendarIds: formData.calendarIds,
        planSyncConfig: formData.planSyncConfig,
        actualSyncConfig: formData.actualSyncConfig,
      } as Event;

      // 🔧 调试日志：验证 eventlog 字段
      console.log('💾 [EventEditModalV2] Saving event with Slate JSON:', {
        hasEventlog: !!currentEventlog,
        eventlogType: typeof currentEventlog,
        eventlogLength: typeof currentEventlog === 'string' ? currentEventlog.length : JSON.stringify(currentEventlog).length,
        eventlogPreview: typeof currentEventlog === 'string' 
          ? currentEventlog.substring(0, 100) 
          : JSON.stringify(currentEventlog).substring(0, 100)
      });

      // 🔧 Step 7: 特殊处理 - 新 Timer 事件创建
      // 如果是通过 App.tsx 的 timerEditModal 打开（event.id === '' && event.isTimer === true）
      // 则跳过 EventHub 操作，直接调用 onSave 让 App.handleTimerEditSave 处理
      // 原因：App.handleTimerEditSave 会创建 Timer 事件并启动计时器
      // 如果 EventEditModalV2 也创建事件，会导致重复创建
      if (event?.id === '' && event?.isTimer === true) {
        console.log('⏱️ [EventEditModalV2] New Timer creation, delegating to parent (App.handleTimerEditSave)');
        onSave(updatedEvent);
        return;
      }
      
      // 🔧 Step 8: 导入 EventHub（统一事件管理中心）
      const { EventHub } = await import('../../services/EventHub');
      
      // 🔧 Step 9: 判断是创建还是更新
      // 检查 EventService（持久化层）而不是 EventHub 缓存
      // 原因：EventHub 可能缓存了 TimeCalendar 传入的临时对象
      const allEvents = EventService.getAllEvents();
      const existingEvent = allEvents.find(e => e.id === eventId);
      
      let result;
      
      if (!existingEvent) {
        // ==================== 场景 1: 创建新事件 (非Timer) ====================
        console.log('🆕 [EventEditModalV2] Creating new event:', eventId);
        
        // 🔧 确保使用正确的 eventId
        updatedEvent.id = eventId;
        
        // 使用 EventHub.createEvent() 创建完整事件
        // EventHub 会自动：
        // 1. 缓存事件快照
        // 2. 调用 EventService.createEvent() 持久化
        // 3. EventService 触发 eventsUpdated 事件
        // 4. TimeCalendar 监听 eventsUpdated 自动刷新
        result = await EventHub.createEvent(updatedEvent);
        
        if (result.success) {
          console.log('✅ [EventEditModalV2] Event created via EventHub:', result.event?.id);
          
          // 记录创建历史（用于 EventLog timestamp）
          if (result.event) {
            EventHistoryService.logCreate(result.event);
            console.log('📝 [EventEditModalV2] Event creation logged to EventHistoryService');
          }
        } else {
          throw new Error(result.error || 'Failed to create event');
        }
      } else {
        // ==================== 场景 2: 更新已存在事件 ====================
        console.log('📝 [EventEditModalV2] Updating existing event:', eventId);
        
        // 🔧 确保使用正确的 eventId
        updatedEvent.id = eventId;
        
        // 使用 EventHub.updateFields() 增量更新
        // 优势：
        // 1. 只更新变化的字段，避免覆盖其他字段
        // 2. 自动记录变化日志（调试用）
        // 3. 合并当前快照，确保数据完整性
        // 
        // 🔧 Timer 运行中：保持 syncStatus='local-only'
        result = await EventHub.updateFields(eventId, {
          title: updatedEvent.title,
          tags: updatedEvent.tags,
          isTask: updatedEvent.isTask,
          isTimer: updatedEvent.isTimer,
          parentEventId: updatedEvent.parentEventId,
          startTime: updatedEvent.startTime,
          endTime: updatedEvent.endTime,
          isAllDay: updatedEvent.isAllDay,
          location: updatedEvent.location,
          organizer: updatedEvent.organizer,
          attendees: updatedEvent.attendees,
          eventlog: updatedEvent.eventlog,
          description: updatedEvent.description,
          syncStatus: updatedEvent.syncStatus, // 🔧 包含 Timer 的 local-only 状态
          // 🆕 日历同步配置字段
          calendarIds: updatedEvent.calendarIds,
          planSyncConfig: updatedEvent.planSyncConfig,
          actualSyncConfig: updatedEvent.actualSyncConfig,
        }, {
          source: 'EventEditModalV2' // 标记更新来源，用于调试
        });
        
        if (result.success) {
          console.log('✅ [EventEditModalV2] Event updated via EventHub');
        } else {
          throw new Error(result.error || 'Failed to update event');
        }
      }

      // 🔧 Step 10: 通知父组件（TimeCalendar 或 App.handleTimerEditSave）
      // onSave 回调会触发：
      // - TimeCalendar: handleSaveEventFromModal() → 关闭弹窗、清理状态
      // - App.tsx: handleTimerEditSave() → 启动计时器、创建 Timer 事件（已被 Step 7 拦截）
      onSave(updatedEvent);
      
    } catch (error) {
      console.error('❌ [EventEditModalV2] Save failed:', error);
      // TODO: 显示错误提示给用户
    }
  };

  // 获取日历显示信息（单个）
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

  // 获取多选日历显示信息（第一个 + 等）
  const getMultiCalendarDisplayInfo = (calendarIds: string[]) => {
    if (calendarIds.length === 0) {
      return { displayText: '选择日历...', color: '#999999', hasMore: false };
    }
    
    const firstCalendar = availableCalendars.find(c => c.id === calendarIds[0]);
    if (!firstCalendar) {
      return { displayText: '未知日历', color: '#999999', hasMore: calendarIds.length > 1 };
    }
    
    const cleanName = firstCalendar.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '');
    const [mainName, subName] = cleanName.includes(': ') ? cleanName.split(': ') : [cleanName, ''];
    
    return {
      displayText: mainName,
      subName: subName ? `: ${subName}` : '',
      color: firstCalendar.color,
      hasMore: calendarIds.length > 1
    };
  };

  /**
   * 格式化参与者为 description 文本（Private 模式）
   * 📧 参与者：alice@company.com, bob@company.com
   */
  const formatParticipantsToDescription = (attendees: Contact[]): string => {
    if (!attendees || attendees.length === 0) return '';
    
    const participantList = attendees
      .map(contact => contact.email || contact.name)
      .filter(Boolean)
      .join(', ');
    
    return participantList ? `📧 参与者：${participantList}\n\n` : '';
  };

  /**
   * 从 description 中提取参与者（Private 模式接收时使用）
   */
  const extractParticipantsFromDescription = (description: string): { attendees: Contact[], cleanDescription: string } => {
    const participantPattern = /^📧 参与者：(.+?)\n\n/;
    const match = description.match(participantPattern);
    
    if (!match) {
      return { attendees: [], cleanDescription: description };
    }
    
    const participantText = match[1];
    const attendees: Contact[] = participantText.split(',').map(email => ({
      email: email.trim(),
      name: email.trim().split('@')[0]
    }));
    
    const cleanDescription = description.replace(participantPattern, '');
    
    return { attendees, cleanDescription };
  };

  /**
   * 获取事件来源信息（按照 PRD 的 6 层优先级）
   * 优先级：
   * 1. Timer 子事件继承父事件来源
   * 2. 外部日历事件（Outlook/Google/iCloud）
   * 3. 独立 Timer 事件
   * 4. Plan 事件
   * 5. TimeCalendar 事件
   * 6. 其他本地事件
   */
  const getEventSourceInfo = (evt: Event | null) => {
    if (!evt) {
      return { emoji: null, name: 'ReMarkable', icon: remarkableLogo, color: '#3b82f6' };
    }

    // 1. Timer 子事件 - 递归获取父事件的来源
    if (evt.isTimer && evt.parentEventId) {
      const parentEvent = EventService.getEventById(evt.parentEventId);
      if (parentEvent) {
        return getEventSourceInfo(parentEvent);
      }
    }

    // 2. 外部日历事件
    if (evt.source === 'outlook' || evt.source === 'google' || evt.source === 'icloud') {
      const calendarId = evt.calendarIds?.[0];
      const calendar = calendarId ? availableCalendars.find(c => c.id === calendarId) : null;
      const calendarName = calendar ? calendar.name.replace(/^[\uD83C-\uDBFF\uDC00-\uDFFF]+\s*/, '') : '默认';
      
      switch (evt.source) {
        case 'outlook':
          return { emoji: null, name: `Outlook: ${calendarName}`, icon: '📧', color: '#0078d4' };
        case 'google':
          return { emoji: null, name: `Google: ${calendarName}`, icon: '📅', color: '#4285f4' };
        case 'icloud':
          return { emoji: null, name: `iCloud: ${calendarName}`, icon: '☁️', color: '#007aff' };
      }
    }

    // 3. 独立 Timer 事件（没有父事件的 Timer）
    if (evt.isTimer && !evt.parentEventId) {
      return { emoji: '⏱️', name: 'ReMarkable计时', icon: null, color: '#f59e0b' };
    }

    // 4. Plan 事件
    if (evt.isPlan) {
      return { emoji: '✅', name: 'ReMarkable计划', icon: null, color: '#10b981' };
    }

    // 5. TimeCalendar 事件
    if (evt.isTimeCalendar) {
      return { emoji: null, name: 'ReMarkable', icon: remarkableLogo, color: '#3b82f6' };
    }

    // 6. 其他本地事件
    return { emoji: null, name: 'ReMarkable', icon: remarkableLogo, color: '#3b82f6' };
  };

  // 获取同步模式显示信息
  const getSyncModeInfo = (modeId: string) => {
    const mode = syncModes.find(m => m.id === modeId);
    return mode || { id: 'unknown', name: '未知模式', emoji: '❓' };
  };

  /**
   * ==================== props.event 变化同步 ====================
   * 
   * 触发场景：
   * 1. 打开编辑弹窗：TimeCalendar 传入新的 event 对象
   * 2. 切换事件：用户在弹窗中切换编辑不同事件（未实现）
   * 
   * 同步策略：
   * - 依赖 event.id 变化（避免频繁更新）
   * - 完整覆盖 formData（清除之前的编辑状态）
   * - 保持 eventlog 格式一致性（Slate JSON 字符串）
   * 
   * 注意：
   * - 不监听 event 对象本身（会导致无限循环）
   * - event?.id 可能为 undefined（新建事件）
   * - 时间字段从 event.startTime/endTime 同步（不调用 TimeHub）
   */
  // 🔧 [BUG FIX] 修复 Timer 编辑时 formData.id 为空的问题
  // 对比 EventEditModal v1 发现：v1 使用 [event, isOpen] 作为依赖
  // v2 之前只监听 [event?.id]，导致：
  // 1. 当 event.id 相同时（如同一个 Timer），useEffect 不触发
  // 2. formData 保持旧值，导致 formData.id = ''
  // 解决方案：添加 isOpen 依赖，确保 Modal 打开时总是同步最新的 event 数据
  useEffect(() => {
    console.log('🔄 [EventEditModalV2] Syncing formData with event prop:', {
      eventId: event?.id,
      isOpen,
      currentFormDataId: formData.id
    });
    
    if (event && isOpen) {
      setFormData({
        id: event.id,
        title: event.title?.colorTitle || event.title?.simpleTitle || '',
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
        eventlog: (() => {
          // 处理 eventlog 字段的多种格式
          if (!event.eventlog) return '[]';
          
          if (typeof event.eventlog === 'string') {
            return event.eventlog;
          }
          
          // 如果是 EventLog 对象，提取 content 字段（已经是字符串）
          return event.eventlog.content || '[]';
        })(),
        description: event.description || '',
      });
    }
  }, [event?.id, isOpen]); // 🔧 添加 isOpen 依赖，确保 Modal 打开时同步数据

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
    // MockEvent.title 是 string，但从 Event 读取时可能是 EventTitle 对象
    const titleText = event.title; // MockEvent 中已经是 string
    const titleEmoji = extractFirstEmoji(titleText);
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
   * 
   * 架构说明：
   * 1. UnifiedDateTimePicker 返回 ISO 格式时间字符串
   * 2. 暂存到 formData（本地状态）
   * 3. 保存时统一通过 EventHub.createEvent/updateFields 持久化
   * 4. EventHub 会将时间字段保存到 EventService
   * 
   * 注意：
   * - 不在此处调用 TimeHub.setEventTime()（避免部分保存）
   * - 时间字段随其他字段一起在 handleSave() 中保存
   * - 遵循"原子性保存"原则：要么全部保存，要么全部回滚
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
   * @param slateJson - Slate JSON 字符串（从 LightSlateEditor 的 onChange 回调接收）
   */
  const handleTimelogChange = (slateJson: string) => {
    // ✅ 架构优化：只保存 Slate JSON 字符串
    // EventService 会在保存时自动转换为 EventLog 对象
    console.log('📝 [EventEditModalV2] EventLog 变化:', {
      slateJsonLength: slateJson.length,
      preview: slateJson.substring(0, 100)
    });
    
    setFormData({
      ...formData,
      eventlog: slateJson as any,  // ✅ Slate JSON 字符串
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
    if (slateEditorRef.current?.editor) {
      // emoji 可能是对象（来自 emoji-mart）或字符串
      const emojiStr = typeof emoji === 'string' ? emoji : emoji.native;
      insertEmoji(slateEditorRef.current.editor, emojiStr);
    }
    setActivePickerIndex(-1); // 关闭 picker
  };

  /**
   * FloatingToolbar 标签选择 - 暂时禁用
   */
  const handleTagSelect = (tagId: string) => {
    if (slateEditorRef.current?.editor) {
      const tag = TagService.getTagById(tagId);
      if (tag) {
        insertTag(
          slateEditorRef.current.editor,
          tagId,
          tag.name,
          tag.color || '#999999',
          tag.emoji || '',
          false // mentionOnly
        );
      }
    }
    setActivePickerIndex(-1); // 关闭 picker
  };

  /**
   * FloatingToolbar 日期范围选择
   */
  const handleDateRangeSelect = (startDate: string, endDate?: string) => {
    if (slateEditorRef.current?.editor) {
      insertDateMention(
        slateEditorRef.current.editor,
        startDate,
        endDate,
        false // mentionOnly
      );
    }
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
                            // 🔧 传递 tagIds 数组和 eventId
                            onTimerAction('start', formData.tags || [], formData.id);
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
                            // 🔧 暂停/继续不需要 tagIds
                            onTimerAction(isPaused ? 'resume' : 'pause');
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
                            // 🔧 stop 不需要额外参数，使用 globalTimer.eventId
                            onTimerAction('stop');
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
                            // 🔧 cancel 不需要额外参数
                            onTimerAction('cancel');
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

                {/* 日历来源（只读显示）*/}
                <div className="eventmodal-v2-plan-row" style={{ marginTop: '4px' }}>
                  <span style={{ flexShrink: 0, color: '#6b7280' }}>来自</span>
                  <div className="eventmodal-v2-plan-content" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    {/* 只读显示事件来源（6层优先级）*/}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', maxWidth: '180px', minWidth: '120px' }}>
                      {(() => {
                        const sourceInfo = getEventSourceInfo(event);
                        return (
                          <>
                            {sourceInfo.emoji && (
                              <span style={{ fontSize: '16px', flexShrink: 0 }}>{sourceInfo.emoji}</span>
                            )}
                            {sourceInfo.icon && (
                              typeof sourceInfo.icon === 'string' && sourceInfo.icon.endsWith('.svg') ? (
                                <img src={sourceInfo.icon} alt="" style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                              ) : (
                                <span style={{ fontSize: '16px', flexShrink: 0 }}>{sourceInfo.icon}</span>
                              )
                            )}
                            <span style={{ 
                              fontSize: 'clamp(10px, 2vw, 14px)', 
                              color: '#374151', 
                              fontWeight: 500,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0
                            }}>
                              {sourceInfo.name}
                            </span>
                          </>
                        );
                      })()}
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
                        <span style={{ pointerEvents: 'none' }}>{getSyncModeInfo(sourceSyncMode).emoji}</span>
                        <span style={{ pointerEvents: 'none' }}>{getSyncModeInfo(sourceSyncMode).name}</span>
                      </div>
                      
                      {showSourceSyncModePicker && createPortal(
                        <div 
                          onClick={(e) => e.stopPropagation()}
                          onMouseDown={(e) => e.stopPropagation()}
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
                              setFormData(prev => ({
                                ...prev,
                                planSyncConfig: {
                                  ...prev.planSyncConfig,
                                  mode: modeId as any
                                }
                              }));
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
                      <div style={{ position: 'relative', maxWidth: '200px', minWidth: '140px' }}>
                        <div 
                          ref={syncCalendarRef}
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            gap: '6px',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            borderRadius: '4px',
                            transition: 'background-color 0.15s',
                            maxWidth: '100%'
                          }}
                          onClick={() => setShowSyncCalendarPicker(!showSyncCalendarPicker)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flex: 1, minWidth: 0, pointerEvents: 'none' }}>
                            <span style={{ 
                              width: '8px', 
                              height: '8px', 
                              background: getMultiCalendarDisplayInfo(syncCalendarIds).color, 
                              borderRadius: '50%',
                              flexShrink: 0
                            }}></span>
                            <strong style={{ 
                              color: '#1f2937',
                              fontSize: 'clamp(10px, 2vw, 14px)',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                              minWidth: 0
                            }}>{getMultiCalendarDisplayInfo(syncCalendarIds).displayText}</strong>
                            {getMultiCalendarDisplayInfo(syncCalendarIds).hasMore && (
                              <span style={{ color: '#6b7280', fontSize: '13px', flexShrink: 0 }}>等</span>
                            )}
                          </span>
                          <span style={{ 
                            color: '#6b7280',
                            fontSize: 'clamp(10px, 2vw, 13px)',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: '60px',
                            pointerEvents: 'none'
                          }}>{getMultiCalendarDisplayInfo(syncCalendarIds).subName}</span>
                        </div>
                        
                        {showSyncCalendarPicker && createPortal(
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
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
                              selectedCalendarIds={syncCalendarIds}
                              multiSelect={true}
                              onMultiSelectionChange={(calendarIds) => {
                                setSyncCalendarIds(calendarIds);
                                setFormData(prev => ({
                                  ...prev,
                                  planSyncConfig: {
                                    ...prev.planSyncConfig,
                                    targetCalendars: calendarIds
                                  }
                                }));
                              }}
                              onClose={() => setShowSyncCalendarPicker(false)}
                              title="选择同步日历（可多选）"
                            />
                          </div>,
                          document.body
                        )}
                      </div>
                      
                      {/* 同步模式选择区域 */}
                      <div style={{ position: 'relative', flexShrink: 0 }}>
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
                            transition: 'background-color 0.15s',
                            whiteSpace: 'nowrap'
                          }}
                          onClick={() => setShowSyncSyncModePicker(!showSyncSyncModePicker)}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f9fafb'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <span style={{ flexShrink: 0, pointerEvents: 'none' }}>{getSyncModeInfo(syncSyncMode).emoji}</span>
                          <span style={{ flexShrink: 0, pointerEvents: 'none' }}>{getSyncModeInfo(syncSyncMode).name}</span>
                        </div>
                        
                        {showSyncSyncModePicker && createPortal(
                          <div 
                            onClick={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
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
                                
                                // 🆕 自动从标签映射中提取 calendarIds
                                const mappedCalendarIds: string[] = [];
                                if (formData.tags && formData.tags.length > 0) {
                                  const flatTags = TagService.getFlatTags();
                                  formData.tags.forEach(tagId => {
                                    const tag = flatTags.find(t => t.id === tagId);
                                    if (tag?.calendarMapping?.calendarId) {
                                      if (!mappedCalendarIds.includes(tag.calendarMapping.calendarId)) {
                                        mappedCalendarIds.push(tag.calendarMapping.calendarId);
                                      }
                                    }
                                  });
                                }
                                
                                // 合并用户选择的日历和标签映射的日历
                                const allCalendarIds = [...new Set([...syncCalendarIds, ...mappedCalendarIds])];
                                
                                setFormData(prev => ({
                                  ...prev,
                                  calendarIds: allCalendarIds.length > 0 ? allCalendarIds : prev.calendarIds,
                                  actualSyncConfig: {
                                    mode: modeId as any,
                                    targetCalendars: allCalendarIds,
                                    tagMapping: prev.actualSyncConfig?.tagMapping
                                  }
                                }));
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
                  {/* 收起按钮 - 固定在右侧中间 */}
                  <button className="collapse-button" onClick={() => setIsDetailView(false)}>
                    <img src={backIcon} alt="收起" className="collapse-icon" />
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
                  <div ref={rightPanelRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px' }}>
                    <LightSlateEditor
                      ref={slateEditorRef}
                      key={`editor-${formData.id}-${timelogContent.length}`}
                      content={timelogContent}
                      parentEventId={formData.id || 'new-event'}
                      enableTimestamp={true}
                      placeholder="记录时间轴..."
                      onChange={handleTimelogChange}
                      className="eventlog-editor"
                    />
                  </div>

                  {/* HeadlessFloatingToolbar */}
                  {floatingToolbar.mode !== 'hidden' && (
                    <HeadlessFloatingToolbar
                      position={floatingToolbar.position}
                      mode={floatingToolbar.mode}
                      config={{ 
                        features: [],
                        mode: 'basic' as any
                      }}
                      slateEditorRef={slateEditorRef}
                      activePickerIndex={activePickerIndex}
                      onActivePickerIndexConsumed={() => setActivePickerIndex(-1)}
                      onSubPickerStateChange={setIsSubPickerOpen} // 🆕 追踪颜色选择器状态
                      onTextFormat={(command, value) => {
                        if (slateEditorRef.current?.editor) {
                          applyTextFormat(slateEditorRef.current.editor, command, value);
                        }
                      }}
                      onTagSelect={(tagIds) => {
                        const tagId = Array.isArray(tagIds) ? tagIds[0] : tagIds;
                        handleTagSelect(tagId);
                        floatingToolbar.hideToolbar();
                      }}
                      onEmojiSelect={(emoji) => {
                        handleEmojiSelect(emoji);
                        floatingToolbar.hideToolbar();
                      }}
                      onDateRangeSelect={(start, end) => {
                        // ✅ 使用 formatTimeForStorage 而不是 toISOString()
                        const formattedTime = start ? formatTimeForStorage(start) : '';
                        handleDateRangeSelect(formattedTime);
                        floatingToolbar.hideToolbar();
                      }}
                      onRequestClose={floatingToolbar.hideToolbar}
                      availableTags={hierarchicalTags}
                      currentTags={formData.tags}
                      eventId={formData.id}
                      editorMode="eventlog"
                    />
                  )}
                </div>
              )}
            </div>
            {/* modal-content 结束 */}

            {/* 底部按钮 */}
            {isDetailView ? (
              <div className="detail-footer">
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-delete"
                  onClick={() => {
                    if (window.confirm('确定要删除这个事件吗？此操作无法撤销。')) {
                      onDelete?.(formData.id);
                      onClose();
                    }
                  }}
                >
                  删除
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel"
                    onClick={onClose}
                  >
                    取消
                  </button>
                  <button 
                    className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-save"
                    onClick={handleSave}
                    disabled={isSaveDisabled}
                    style={{
                      opacity: isSaveDisabled ? 0.5 : 1,
                      cursor: isSaveDisabled ? 'not-allowed' : 'pointer'
                    }}
                    title={isSaveDisabled ? '请输入标题或选择标签' : ''}
                  >
                    保存
                  </button>
                </div>
              </div>
            ) : (
              <div className="compact-footer">
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-delete"
                  onClick={() => {
                    if (window.confirm('确定要删除这个事件吗？此操作无法撤销。')) {
                      onDelete?.(formData.id);
                      onClose();
                    }
                  }}
                >
                  删除
                </button>
                <button 
                  className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-expand" 
                  onClick={() => setIsDetailView(true)}
                >
                  📝 展开日志
                </button>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <button 
                    className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-cancel"
                    onClick={onClose}
                  >
                    取消
                  </button>
                  <button 
                    className="eventmodal-v2-footer-btn eventmodal-v2-footer-btn-save"
                    onClick={handleSave}
                    disabled={isSaveDisabled}
                    style={{
                      opacity: isSaveDisabled ? 0.5 : 1,
                      cursor: isSaveDisabled ? 'not-allowed' : 'pointer'
                    }}
                    title={isSaveDisabled ? '请输入标题或选择标签' : ''}
                  >
                    保存
                  </button>
                </div>
              </div>
            )}
        </div>
      </div>
    );
};
