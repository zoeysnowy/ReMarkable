/**
 * EventEditModal v2 - 双视图事件编辑器
 * 
 * 功能特性：
 * - 详情视图（左右分栏）：Event Overview + Event Log
 * - 收缩视图：隐藏右侧 Event Log，专注计时和元数据
 * - 支持 Timer 集成、Plan 任务管理、富文本日志
 * 
 * @version 2.0.0
 * @see docs/PRD/EVENTEDITMODAL_V2_PRD.md
 * @figma https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=201-630&m=dev
 */

import React, { useState, useEffect, useRef } from 'react';
import { Event } from '../../types';
import './EventEditModalV2.css';

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
  } | null;
  onStartTimeChange?: (newStartTime: number) => void;
  onTimerAction?: (action: 'start' | 'pause' | 'stop' | 'cancel', eventId?: string) => void;
}

export const EventEditModalV2: React.FC<EventEditModalV2Props> = ({
  event,
  isOpen,
  onClose,
  onSave,
  onDelete,
  hierarchicalTags,
  globalTimer,
  onStartTimeChange,
  onTimerAction,
}) => {
  // ==================== 状态管理 ====================
  
  // 视图控制：是否显示右侧 Event Log
  const [showEventLog, setShowEventLog] = useState(true);
  
  // 表单数据
  const [formData, setFormData] = useState({
    title: '',
    emoji: '',
    tags: [] as string[],
    isTask: false,
    organizer: null as any,
    attendees: [] as any[],
    startTime: '',
    endTime: '',
    location: '',
    isAllDay: false,
    calendarIds: [] as string[],
    syncMode: 'receive-only' as 'receive-only' | 'bidirectional',
    eventlog: '',
  });

  // ==================== 生命周期 ====================
  
  useEffect(() => {
    if (event) {
      setFormData({
        title: event.title || '',
        emoji: extractEmoji(event.title) || '',
        tags: event.tags || [],
        isTask: event.isTask || false,
        organizer: event.organizer || null,
        attendees: event.attendees || [],
        startTime: event.startTime ? formatDateTimeLocal(event.startTime) : '',
        endTime: event.endTime ? formatDateTimeLocal(event.endTime) : '',
        location: event.location || '',
        isAllDay: event.isAllDay || false,
        calendarIds: (event as any).calendarIds || [],
        syncMode: 'receive-only',
        eventlog: typeof event.eventlog === 'string' ? event.eventlog : '',
      });
    }
  }, [event]);

  // ==================== 事件处理 ====================
  
  const handleSave = () => {
    if (!event) return;
    
    const updatedEvent: Event = {
      ...event,
      ...formData,
      updatedAt: new Date().toISOString(),
    };
    
    onSave(updatedEvent);
  };

  const handleCancel = () => {
    onClose();
  };

  const toggleEventLog = () => {
    setShowEventLog(!showEventLog);
  };

  // ==================== 渲染 ====================
  
  if (!isOpen || !event) return null;

  return (
    <div className="event-edit-modal-v2-overlay" onClick={handleCancel}>
      <div 
        className={`event-edit-modal-v2 ${showEventLog ? 'detail-view' : 'compact-view'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 左侧：Event Overview */}
        <div className="event-overview">
          {/* 上 Section - 事件标识 */}
          <section className="overview-section section-top">
            <EventIdentitySection
              emoji={formData.emoji}
              title={formData.title}
              tags={formData.tags}
              isTask={formData.isTask}
              hierarchicalTags={hierarchicalTags}
              onChange={(updates: any) => setFormData({ ...formData, ...updates })}
            />
          </section>

          {/* 计时按钮区域 */}
          <section className="timer-button-section">
            <TimerButtonSection
              globalTimer={globalTimer}
              event={event}
            />
          </section>

          {/* 中 Section - 计划安排 */}
          <section className="overview-section section-middle">
            <PlannedScheduleSection
              organizer={formData.organizer}
              attendees={formData.attendees}
              startTime={formData.startTime}
              endTime={formData.endTime}
              location={formData.location}
              isAllDay={formData.isAllDay}
              calendarIds={formData.calendarIds}
              syncMode={formData.syncMode}
              onChange={(updates: any) => setFormData({ ...formData, ...updates })}
            />
          </section>

          {/* 下 Section - 实际进展 */}
          <section className="overview-section section-bottom">
            <ActualProgressSection
              event={event}
              globalTimer={globalTimer}
            />
          </section>

          {/* 底部按钮 */}
          {!showEventLog && (
            <div className="compact-footer">
              <button className="footer-btn-text" onClick={handleCancel}>
                取消
              </button>
              <button className="footer-btn-text expand-log-btn" onClick={toggleEventLog}>
                📝 展开日志
              </button>
              <button className="footer-btn-text" onClick={handleSave}>
                保存修改
              </button>
            </div>
          )}
        </div>

        {/* 右侧：Event Log（条件渲染） */}
        {showEventLog && (
          <div className="event-log">
            {/* 右侧顶部：back 按钮 */}
            <div className="event-log-header">
              <button className="back-button" onClick={toggleEventLog}>
                ← back
              </button>
            </div>

            {/* 标签区域 */}
            <div className="event-log-tags">
              {formData.tags.map(tagId => (
                <span key={tagId} className="event-log-tag">
                  {getTagPath(tagId, hierarchicalTags)}
                </span>
              ))}
            </div>

            {/* Plan 提示区域 */}
            {event.isPlan && (
              <div className="event-log-plan-info">
                <span className="plan-icon">☑</span>
                <span className="plan-icon">⏰</span>
                <span className="plan-icon">🚩</span>
                <span className="plan-info-text">
                  创建于 {formatRelativeTime(event.createdAt || '')}, 
                  ddl 还有 {calculateTimeUntilDue(event.dueDate)}
                </span>
              </div>
            )}

            {/* 关联任务区域 */}
            {event.parentEventId && (
              <div className="event-log-relation">
                🔗 上级任务：{getParentEventTitle(event.parentEventId)}
              </div>
            )}

            {/* Slate 编辑区（占位） */}
            <div className="event-log-editor">
              <p className="placeholder-text">
                📝 Slate 编辑器区域（待集成 UnifiedSlateEditor）
              </p>
              <textarea
                className="temp-editor"
                value={formData.eventlog}
                onChange={(e) => setFormData({ ...formData, eventlog: e.target.value })}
                placeholder="在此记录会议纪要、工作日志..."
              />
            </div>

            {/* FloatingBar（占位） */}
            <div className="event-log-floating-bar">
              [😊 # 📅 • 🎨 ✓] FloatingBar
            </div>
          </div>
        )}

        {/* 详情视图底部按钮 */}
        {showEventLog && (
          <div className="detail-footer">
            <button className="footer-btn-cancel" onClick={handleCancel}>
              取消
            </button>
            <button className="footer-btn-save" onClick={handleSave}>
              保存修改
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ==================== 子组件（占位实现）====================

const EventIdentitySection: React.FC<any> = ({ emoji, title, tags, isTask, hierarchicalTags, onChange }) => {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  
  const getTagPath = (tagId: string): string => {
    const tag = hierarchicalTags.find((t: any) => t.id === tagId);
    if (!tag) return tagId;
    
    const path = [];
    let current = tag;
    while (current) {
      path.unshift(current.name);
      if (current.parentId) {
        current = hierarchicalTags.find((t: any) => t.id === current.parentId);
      } else {
        break;
      }
    }
    return path.join('/');
  };

  // 简化版 emoji 选择器（实际应使用专业组件）
  const commonEmojis = ['📅', '⏰', '💼', '📝', '✅', '🎯', '💡', '🔔', '📧', '👥', '🎨', '🏃'];

  return (
    <div className="identity-section">
      {/* Emoji 选择器 */}
      <div className="emoji-large" onClick={() => setShowEmojiPicker(!showEmojiPicker)}>
        {emoji || '📅'}
      </div>
      {showEmojiPicker && (
        <div className="emoji-picker-dropdown" style={{
          position: 'absolute',
          zIndex: 100,
          background: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gap: '8px'
        }}>
          {commonEmojis.map((e) => (
            <div
              key={e}
              style={{ fontSize: '28px', cursor: 'pointer', textAlign: 'center' }}
              onClick={() => {
                onChange({ emoji: e });
                setShowEmojiPicker(false);
              }}
            >
              {e}
            </div>
          ))}
        </div>
      )}

      {/* 标题输入 */}
      <input
        type="text"
        className="title-input"
        value={title}
        onChange={(e) => {
          const newTitle = e.target.value;
          // 简单检测标题开头的 emoji
          const commonEmojis = ['📅', '⏰', '💼', '📝', '✅', '🎯', '💡', '🔔', '📧', '👥', '🎨', '🏃'];
          for (const emoji of commonEmojis) {
            if (newTitle.startsWith(emoji)) {
              onChange({ emoji, title: newTitle.replace(emoji, '').trim() });
              return;
            }
          }
          onChange({ title: newTitle });
        }}
        placeholder="事件标题"
      />

      {/* 标签显示与选择 */}
      <div className="tags-display" onClick={() => setShowTagSelector(!showTagSelector)}>
        {tags.length > 0 
          ? tags.map((tagId: string) => getTagPath(tagId)).join(' · ')
          : '选择标签...'}
      </div>
      {showTagSelector && (
        <div className="tag-selector-dropdown" style={{
          position: 'absolute',
          zIndex: 100,
          background: 'white',
          padding: '12px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          maxHeight: '200px',
          overflowY: 'auto'
        }}>
          {hierarchicalTags.map((tag: any) => (
            <label key={tag.id} style={{ display: 'block', padding: '6px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={tags.includes(tag.id)}
                onChange={(e) => {
                  if (e.target.checked) {
                    onChange({ tags: [...tags, tag.id] });
                  } else {
                    onChange({ tags: tags.filter((id: string) => id !== tag.id) });
                  }
                }}
              />
              {' '}{getTagPath(tag.id)}
            </label>
          ))}
        </div>
      )}

      {/* 任务模式复选框 */}
      {isTask !== undefined && (
        <label className="task-checkbox">
          <input
            type="checkbox"
            checked={isTask}
            onChange={(e) => onChange({ isTask: e.target.checked })}
          />
          <span>任务模式</span>
        </label>
      )}
    </div>
  );
};

const TimerButtonSection: React.FC<any> = ({ globalTimer, event, onTimerAction }) => {
  const isRunning = globalTimer?.isRunning && globalTimer?.eventId === event?.id;
  const isPaused = isRunning && globalTimer?.isPaused;
  
  const handleStart = () => {
    if (onTimerAction) {
      onTimerAction('start', event?.id);
    }
  };

  const handlePause = () => {
    if (onTimerAction) {
      onTimerAction('pause');
    }
  };

  const handleStop = () => {
    if (onTimerAction) {
      onTimerAction('stop');
    }
  };

  const handleCancel = () => {
    if (onTimerAction) {
      onTimerAction('cancel');
    }
  };

  if (!isRunning) {
    return (
      <button className="timer-button-start" onClick={handleStart}>
        ▶️ 开始专注
      </button>
    );
  }

  return (
    <div className="timer-buttons-group">
      <button 
        className="timer-button-circle gray" 
        onClick={handlePause}
        title={isPaused ? "继续" : "暂停"}
      >
        {isPaused ? '▶️' : '⏸️'}
      </button>
      <button 
        className="timer-button-circle gray" 
        onClick={handleStop}
        title="停止"
      >
        ⏹️
      </button>
      <button 
        className="timer-button-circle gradient-red" 
        onClick={handleCancel}
        title="取消并删除本次计时"
      >
        ❌
      </button>
    </div>
  );
};

const PlannedScheduleSection: React.FC<any> = ({ 
  organizer, 
  attendees, 
  startTime, 
  endTime, 
  location, 
  isAllDay,
  calendarIds,
  syncMode,
  onChange 
}) => {
  const [showOrganizerPicker, setShowOrganizerPicker] = useState(false);
  const [showAttendeesPicker, setShowAttendeesPicker] = useState(false);
  const [showSyncSettings, setShowSyncSettings] = useState(false);

  const formatDateTimeLocal = (isoString: string | null): string => {
    if (!isoString) return '';
    const date = new Date(isoString);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const calculateDuration = (): string => {
    if (!startTime || !endTime) return '';
    const start = new Date(startTime);
    const end = new Date(endTime);
    const durationMs = end.getTime() - start.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    }
    return `${minutes}min`;
  };

  return (
    <div className="planned-schedule">
      <h3 className="section-title">计划安排</h3>
      
      {/* 组织者与参与者 */}
      <div className="organizer-attendees">
        <div className="field-row" style={{ marginBottom: '8px' }}>
          <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
            组织者
          </label>
          <div 
            className="contact-display" 
            onClick={() => setShowOrganizerPicker(!showOrganizerPicker)}
            style={{
              padding: '8px 12px',
              background: '#f9fafb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#1f2937'
            }}
          >
            {organizer?.name || organizer?.email || '选择组织者...'}
          </div>
        </div>

        <div className="field-row">
          <label style={{ fontSize: '13px', color: '#6b7280', marginBottom: '4px', display: 'block' }}>
            参与者
          </label>
          <div 
            className="contact-display" 
            onClick={() => setShowAttendeesPicker(!showAttendeesPicker)}
            style={{
              padding: '8px 12px',
              background: '#f9fafb',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '14px',
              color: '#1f2937'
            }}
          >
            {attendees && attendees.length > 0 
              ? attendees.map((a: any) => a.name || a.email).join(', ')
              : '添加参与者...'}
          </div>
        </div>
      </div>

      {/* 时间选择 */}
      <div className="time-row" style={{ marginTop: '12px' }}>
        <input
          type="datetime-local"
          value={formatDateTimeLocal(startTime)}
          onChange={(e) => onChange({ startTime: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
        <span className="arrow">→</span>
        <input
          type="datetime-local"
          value={formatDateTimeLocal(endTime)}
          onChange={(e) => onChange({ endTime: e.target.value ? new Date(e.target.value).toISOString() : null })}
        />
      </div>
      
      {/* 时长显示 */}
      {calculateDuration() && (
        <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '4px', textAlign: 'right' }}>
          时长: {calculateDuration()}
        </div>
      )}

      {/* 全天事件 */}
      <label className="all-day-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
        <input
          type="checkbox"
          checked={isAllDay || false}
          onChange={(e) => onChange({ isAllDay: e.target.checked })}
        />
        <span style={{ fontSize: '14px', color: '#6b7280' }}>全天事件</span>
      </label>

      {/* 地点 */}
      <input
        type="text"
        className="location-input"
        value={location || ''}
        onChange={(e) => onChange({ location: e.target.value })}
        placeholder="📍 地点"
        style={{ marginTop: '12px' }}
      />

      {/* 日历同步设置 */}
      <div className="sync-settings" style={{ marginTop: '12px' }}>
        <div 
          className="sync-toggle"
          onClick={() => setShowSyncSettings(!showSyncSettings)}
          style={{
            padding: '8px 12px',
            background: '#eff6ff',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '13px',
            color: '#3b82f6',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <span>📅 日历同步设置</span>
          <span>{showSyncSettings ? '▲' : '▼'}</span>
        </div>
        
        {showSyncSettings && (
          <div style={{ marginTop: '8px', padding: '12px', background: '#f9fafb', borderRadius: '6px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <input
                type="radio"
                name="syncMode"
                value="receive-only"
                checked={syncMode === 'receive-only'}
                onChange={(e) => onChange({ syncMode: e.target.value })}
              />
              <span style={{ fontSize: '13px' }}>仅接收更新</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <input
                type="radio"
                name="syncMode"
                value="bidirectional"
                checked={syncMode === 'bidirectional'}
                onChange={(e) => onChange({ syncMode: e.target.value })}
              />
              <span style={{ fontSize: '13px' }}>双向同步</span>
            </label>
            <div style={{ marginTop: '8px', fontSize: '12px', color: '#9ca3af' }}>
              同步至: {calendarIds && calendarIds.length > 0 ? calendarIds.join(', ') : '未选择日历'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const ActualProgressSection: React.FC<any> = ({ event, globalTimer }) => {
  // 计算总时长
  const calculateTotalDuration = (): string => {
    if (!event?.segments || event.segments.length === 0) {
      return '0h 0min';
    }

    const totalMs = event.segments.reduce((sum: number, segment: any) => {
      const start = new Date(segment.startTime).getTime();
      const end = segment.endTime ? new Date(segment.endTime).getTime() : Date.now();
      return sum + (end - start);
    }, 0);

    const hours = Math.floor(totalMs / (1000 * 60 * 60));
    const minutes = Math.floor((totalMs % (1000 * 60 * 60)) / (1000 * 60));
    return `${hours}h ${minutes}min`;
  };

  // 格式化时间段
  const formatSegment = (segment: any): string => {
    const start = new Date(segment.startTime);
    const end = segment.endTime ? new Date(segment.endTime) : null;
    const formatTime = (date: Date) => {
      const pad = (n: number) => String(n).padStart(2, '0');
      return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
    };

    if (end) {
      const durationMs = end.getTime() - start.getTime();
      const minutes = Math.floor(durationMs / (1000 * 60));
      return `${formatTime(start)} - ${formatTime(end)} (${minutes}min)`;
    } else {
      return `${formatTime(start)} - 进行中`;
    }
  };

  // 检查是否有正在运行的计时
  const isTimerRunning = globalTimer?.isRunning && globalTimer?.eventId === event?.id;

  return (
    <div className="actual-progress">
      <div className="section-header">
        <h3 className="section-title">实际进展</h3>
        <span className="total-duration">总时长: {calculateTotalDuration()}</span>
      </div>

      {event?.segments && event.segments.length > 0 ? (
        <div className="segments-list" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {event.segments.map((segment: any, index: number) => (
            <div 
              key={index}
              className="segment-item"
              style={{
                padding: '8px 12px',
                background: segment.endTime ? '#f9fafb' : '#eff6ff',
                borderRadius: '6px',
                fontSize: '13px',
                color: '#1f2937',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <span>⏱️ {formatSegment(segment)}</span>
              {!segment.endTime && isTimerRunning && (
                <span style={{ 
                  fontSize: '11px', 
                  color: '#3b82f6', 
                  fontWeight: '600',
                  animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
                }}>
                  ● 进行中
                </span>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="placeholder-text">暂无计时记录</p>
      )}

      {/* 同步状态显示 */}
      {event?.calendarIds && event.calendarIds.length > 0 && (
        <div className="sync-status" style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: '#ecfdf5',
          borderRadius: '6px',
          fontSize: '12px',
          color: '#047857',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>✓</span>
          <span>已同步至 {event.calendarIds.length} 个日历</span>
        </div>
      )}

      {/* 里程碑完成状态（如果是任务） */}
      {event?.isTask && event?.status && (
        <div className="task-status" style={{
          marginTop: '12px',
          padding: '8px 12px',
          background: event.status === 'completed' ? '#dcfce7' : '#fef3c7',
          borderRadius: '6px',
          fontSize: '12px',
          color: event.status === 'completed' ? '#15803d' : '#92400e',
          display: 'flex',
          alignItems: 'center',
          gap: '6px'
        }}>
          <span>{event.status === 'completed' ? '✅' : '⏳'}</span>
          <span>{event.status === 'completed' ? '任务已完成' : '任务进行中'}</span>
        </div>
      )}
    </div>
  );
};

// ==================== 工具函数 ====================

function extractEmoji(text: string): string | null {
  if (!text) return null;
  // 使用简单的方法检测常见 emoji
  const commonEmojis = ['📅', '⏰', '💼', '📝', '✅', '🎯', '💡', '🔔', '📧', '👥', '🎨', '🏃'];
  for (const emoji of commonEmojis) {
    if (text.includes(emoji)) {
      return emoji;
    }
  }
  return null;
}

function formatDateTimeLocal(isoString: string): string {
  if (!isoString) return '';
  return isoString.slice(0, 16); // 截取 YYYY-MM-DDTHH:mm
}

function getTagPath(tagId: string, hierarchicalTags: any[]): string {
  // TODO: 实现标签路径获取
  return `#${tagId}`;
}

function formatRelativeTime(isoString: string): string {
  // TODO: 实现相对时间格式化
  return '12h前';
}

function calculateTimeUntilDue(dueDate?: string): string {
  // TODO: 实现 ddl 计算
  return '2h30min';
}

function getParentEventTitle(parentEventId: string): string {
  // TODO: 从 EventService 获取父事件标题
  return 'Parent Event';
}
