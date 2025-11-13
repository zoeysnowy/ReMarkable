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
  } | null;
  onStartTimeChange?: (newStartTime: number) => void;
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
    organizer: { name: '', email: '' },
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
        organizer: event.organizer || { name: '', email: '' },
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
              onChange={(updates) => setFormData({ ...formData, ...updates })}
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
              onChange={(updates) => setFormData({ ...formData, ...updates })}
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

const EventIdentitySection: React.FC<any> = ({ emoji, title, tags, isTask, onChange }) => (
  <div className="identity-section">
    <div className="emoji-large">{emoji || '📅'}</div>
    <input
      type="text"
      className="title-input"
      value={title}
      onChange={(e) => onChange({ title: e.target.value })}
      placeholder="事件标题"
    />
    <div className="tags-display">
      {tags.length > 0 ? `#${tags.join(' #')}` : '选择标签...'}
    </div>
    {isTask && (
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

const TimerButtonSection: React.FC<any> = ({ globalTimer, event }) => {
  const isRunning = globalTimer?.isRunning && globalTimer?.eventId === event?.id;
  
  if (!isRunning) {
    return (
      <button className="timer-button-start">
        ▶️ 开始专注
      </button>
    );
  }

  return (
    <div className="timer-buttons-group">
      <button className="timer-button-circle gray">⏸️</button>
      <button className="timer-button-circle gray">⏹️</button>
      <button className="timer-button-circle gradient-red">❌</button>
    </div>
  );
};

const PlannedScheduleSection: React.FC<any> = ({ startTime, endTime, location, onChange }) => (
  <div className="planned-schedule">
    <h3 className="section-title">计划安排</h3>
    <div className="time-row">
      <input
        type="datetime-local"
        value={startTime}
        onChange={(e) => onChange({ startTime: e.target.value })}
      />
      <span className="arrow">→</span>
      <input
        type="datetime-local"
        value={endTime}
        onChange={(e) => onChange({ endTime: e.target.value })}
      />
    </div>
    <input
      type="text"
      className="location-input"
      value={location}
      onChange={(e) => onChange({ location: e.target.value })}
      placeholder="📍 地点"
    />
  </div>
);

const ActualProgressSection: React.FC<any> = ({ event }) => (
  <div className="actual-progress">
    <div className="section-header">
      <h3 className="section-title">实际进展</h3>
      <span className="total-duration">总时长: 0h</span>
    </div>
    <p className="placeholder-text">暂无计时记录</p>
  </div>
);

// ==================== 工具函数 ====================

function extractEmoji(text: string): string | null {
  if (!text) return null;
  const emojiRegex = /[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu;
  const match = text.match(emojiRegex);
  return match ? match[0] : null;
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
