import React, { useState, useRef, useCallback, useEffect } from 'react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import FloatingButton, { FloatingButtonAction } from './FloatingButton';
import { Event } from '../types';
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
import './PlanItemEditor.css';

// 计划项数据接口
export interface PlanItem {
  id: string;
  title: string;
  content: string;
  tags: string[];
  color?: string;
  backgroundColor?: string;
  emoji?: string;
  bulletStyle?: 'none' | 'dot' | 'number' | 'checkbox';
  startTime?: string;
  endTime?: string;
  duration?: number;
  isCompleted?: boolean;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  reminders?: string[];
  notes?: string;
  location?: string;
  isAllDay?: boolean;
}

export interface PlanItemEditorProps {
  item?: PlanItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: PlanItem) => void;
  availableTags?: string[];
  onCreateTag?: (tagName: string) => void;
  // 🆕 UnifiedTimeline 集成
  syncManager?: any; // ActionBasedSyncManager 实例
  onEventCreated?: (event: Event) => void; // 创建事件后的回调
}

const PlanItemEditor: React.FC<PlanItemEditorProps> = ({
  item,
  isOpen,
  onClose,
  onSave,
  availableTags = [],
  onCreateTag,
}) => {
  // 编辑状态
  const [title, setTitle] = useState(item?.title || '');
  const [content, setContent] = useState(item?.content || '');
  const [selectedTags, setSelectedTags] = useState<string[]>(item?.tags || []);
  const [textColor, setTextColor] = useState(item?.color || '#000000');
  const [backgroundColor, setBackgroundColor] = useState(item?.backgroundColor || '#FFFFFF');
  const [emoji, setEmoji] = useState(item?.emoji || '');
  const [bulletStyle, setBulletStyle] = useState<'none' | 'dot' | 'number' | 'checkbox'>(
    item?.bulletStyle || 'none'
  );
  const [startTime, setStartTime] = useState(item?.startTime || '');
  const [endTime, setEndTime] = useState(item?.endTime || '');
  const [duration, setDuration] = useState(item?.duration || 0);
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>(
    item?.priority || 'medium'
  );
  const [notes, setNotes] = useState(item?.notes || '');
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);

  // UI 状态
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);
  const [showTagSelector, setShowTagSelector] = useState(false);
  const [showDetailPanel, setShowDetailPanel] = useState(false);

  // Refs
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const timerIntervalRef = useRef<number | null>(null);

  // 初始化数据
  useEffect(() => {
    if (item) {
      setTitle(item.title || '');
      setContent(item.content || '');
      setSelectedTags(item.tags || []);
      setTextColor(item.color || '#000000');
      setBackgroundColor(item.backgroundColor || '#FFFFFF');
      setEmoji(item.emoji || '');
      setBulletStyle(item.bulletStyle || 'none');
      setStartTime(item.startTime || '');
      setEndTime(item.endTime || '');
      setDuration(item.duration || 0);
      setPriority(item.priority || 'medium');
      setNotes(item.notes || '');
    }
  }, [item]);

  // 计时器逻辑
  useEffect(() => {
    if (isTimerRunning) {
      timerIntervalRef.current = window.setInterval(() => {
        setTimerSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [isTimerRunning]);

  // 格式化时间显示
  const formatTimer = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // FloatingButton 操作配置
  const editorActions: FloatingButtonAction[] = [
    {
      id: 'emoji',
      label: '添加表情',
      icon: emoji || '😊',
      onClick: () => setShowEmojiPicker(!showEmojiPicker),
    },
    {
      id: 'tag',
      label: '添加标签',
      icon: '#️⃣',
      onClick: () => setShowTagSelector(!showTagSelector),
    },
    {
      id: 'bullet',
      label: '项目符号',
      icon: bulletStyle === 'dot' ? '●' : bulletStyle === 'number' ? '1.' : bulletStyle === 'checkbox' ? '☑' : '○',
      onClick: () => {
        const styles: Array<'none' | 'dot' | 'number' | 'checkbox'> = ['none', 'dot', 'number', 'checkbox'];
        const currentIndex = styles.indexOf(bulletStyle);
        const nextStyle = styles[(currentIndex + 1) % styles.length];
        setBulletStyle(nextStyle);
      },
    },
    {
      id: 'textColor',
      label: '字体颜色',
      icon: <div style={{ width: 20, height: 20, backgroundColor: textColor, borderRadius: '50%', border: '2px solid white' }} />,
      onClick: () => setShowColorPicker(!showColorPicker),
    },
    {
      id: 'bgColor',
      label: '背景颜色',
      icon: <div style={{ width: 20, height: 20, backgroundColor: backgroundColor, borderRadius: 4, border: '2px solid white' }} />,
      onClick: () => setShowBgColorPicker(!showBgColorPicker),
    },
  ];

  // 处理 Emoji 选择
  const handleEmojiSelect = (emojiData: any) => {
    setEmoji(emojiData.native);
    setShowEmojiPicker(false);
  };

  // 处理标签选择
  const handleTagToggle = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  // 处理保存
  const handleSave = () => {
    const planItem: PlanItem = {
      id: item?.id || `plan-${Date.now()}`,
      title,
      content,
      tags: selectedTags,
      color: textColor,
      backgroundColor,
      emoji,
      bulletStyle,
      startTime,
      endTime,
      duration: duration + timerSeconds,
      priority,
      notes,
      isCompleted: item?.isCompleted || false,
    };
    onSave(planItem);
    onClose();
  };

  // 处理取消
  const handleCancel = () => {
    onClose();
  };

  // 计算优先级颜色
  const getPriorityColor = (p: string) => {
    switch (p) {
      case 'urgent': return '#FF3B30';
      case 'high': return '#FF9500';
      case 'medium': return '#007AFF';
      case 'low': return '#34C759';
      default: return '#999999';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="plan-item-editor-overlay" onClick={handleCancel}>
      <div className="plan-item-editor-container" onClick={(e) => e.stopPropagation()}>
        {/* 左侧主编辑区 */}
        <div className="plan-editor-main">
          {/* 顶部工具栏 */}
          <div className="plan-editor-header">
            <div className="plan-editor-title-row">
              {emoji && <span className="plan-emoji">{emoji}</span>}
              <span className="plan-priority-badge" style={{ backgroundColor: getPriorityColor(priority) }}>
                {priority.toUpperCase()}
              </span>
              <button className="plan-close-btn" onClick={handleCancel}>
                ✕
              </button>
            </div>
          </div>

          {/* 标题输入 */}
          <div className="plan-editor-section">
            <div className="plan-title-wrapper">
              {bulletStyle !== 'none' && (
                <span className="plan-bullet">
                  {bulletStyle === 'dot' && '●'}
                  {bulletStyle === 'number' && '1.'}
                  {bulletStyle === 'checkbox' && '☑'}
                </span>
              )}
              <textarea
                ref={titleRef}
                className="plan-title-input"
                placeholder="输入任务标题..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ color: textColor }}
                rows={1}
              />
            </div>
          </div>

          {/* 标签显示 */}
          {selectedTags.length > 0 && (
            <div className="plan-tags-display">
              {selectedTags.map((tag) => (
                <span key={tag} className="plan-tag">
                  #{tag}
                  <button
                    className="plan-tag-remove"
                    onClick={() => handleTagToggle(tag)}
                  >
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* 内容输入 */}
          <div className="plan-editor-section">
            <textarea
              ref={contentRef}
              className="plan-content-input"
              placeholder="添加详细描述..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              style={{ 
                color: textColor,
                backgroundColor: backgroundColor 
              }}
              rows={8}
            />
          </div>

          {/* 备注 */}
          <div className="plan-editor-section">
            <label className="plan-label">备注</label>
            <textarea
              className="plan-notes-input"
              placeholder="添加备注..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* 底部操作栏 */}
          <div className="plan-editor-footer">
            <button className="plan-btn plan-btn-cancel" onClick={handleCancel}>
              取消
            </button>
            <button className="plan-btn plan-btn-save" onClick={handleSave}>
              保存
            </button>
          </div>
        </div>

        {/* 右侧工具面板 */}
        <div className="plan-editor-sidebar">
          {/* 时间选择器 */}
          <div className="plan-sidebar-section">
            <h3 className="plan-sidebar-title">⏰ 时间设置</h3>
            <div className="plan-time-inputs">
              <label>
                <span>开始时间</span>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="plan-time-input"
                />
              </label>
              <label>
                <span>结束时间</span>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="plan-time-input"
                />
              </label>
            </div>
          </div>

          {/* 计时器 */}
          <div className="plan-sidebar-section">
            <h3 className="plan-sidebar-title">⏱️ 计时器</h3>
            <div className="plan-timer">
              <div className="plan-timer-display">{formatTimer(timerSeconds)}</div>
              <div className="plan-timer-controls">
                <button
                  className="plan-timer-btn"
                  onClick={() => setIsTimerRunning(!isTimerRunning)}
                >
                  {isTimerRunning ? '⏸ 暂停' : '▶ 开始'}
                </button>
                <button
                  className="plan-timer-btn"
                  onClick={() => setTimerSeconds(0)}
                >
                  ⏹ 重置
                </button>
              </div>
              <div className="plan-timer-total">
                总时长: {formatTimer(duration + timerSeconds)}
              </div>
            </div>
          </div>

          {/* 优先级 */}
          <div className="plan-sidebar-section">
            <h3 className="plan-sidebar-title">🎯 优先级</h3>
            <div className="plan-priority-selector">
              {(['low', 'medium', 'high', 'urgent'] as const).map((p) => (
                <button
                  key={p}
                  className={`plan-priority-option ${priority === p ? 'active' : ''}`}
                  style={{
                    backgroundColor: priority === p ? getPriorityColor(p) : 'transparent',
                    color: priority === p ? 'white' : getPriorityColor(p),
                    borderColor: getPriorityColor(p),
                  }}
                  onClick={() => setPriority(p)}
                >
                  {p.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* 详细设置 */}
          <div className="plan-sidebar-section">
            <button
              className="plan-detail-toggle"
              onClick={() => setShowDetailPanel(!showDetailPanel)}
            >
              ⚙️ 详细设置 {showDetailPanel ? '▼' : '▶'}
            </button>
            {showDetailPanel && (
              <div className="plan-detail-panel">
                <p className="plan-detail-info">
                  创建时间: {new Date(parseInt(item?.id?.split('-')[1] || Date.now().toString())).toLocaleString()}
                </p>
                <p className="plan-detail-info">
                  已完成: {item?.isCompleted ? '是' : '否'}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* FloatingButton - 富文本工具栏 */}
        <FloatingButton
          icon="✏️"
          actions={editorActions}
          position="bottom-right"
          expandDirection="up"
          color="#007AFF"
          tooltip="编辑工具"
        />

        {/* Emoji 选择器弹窗 */}
        {showEmojiPicker && (
          <div className="plan-picker-overlay" onClick={() => setShowEmojiPicker(false)}>
            <div className="plan-picker-container" onClick={(e) => e.stopPropagation()}>
              <Picker data={data} onEmojiSelect={handleEmojiSelect} locale="zh" />
            </div>
          </div>
        )}

        {/* 颜色选择器 */}
        {showColorPicker && (
          <div className="plan-picker-overlay" onClick={() => setShowColorPicker(false)}>
            <div className="plan-color-picker" onClick={(e) => e.stopPropagation()}>
              <h4>选择字体颜色</h4>
              <div className="plan-color-grid">
                {['#000000', '#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#007AFF', '#5856D6', '#999999'].map((color) => (
                  <button
                    key={color}
                    className="plan-color-option"
                    style={{ backgroundColor: color }}
                    onClick={() => {
                      setTextColor(color);
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={textColor}
                onChange={(e) => setTextColor(e.target.value)}
                className="plan-color-input"
              />
            </div>
          </div>
        )}

        {/* 背景颜色选择器 */}
        {showBgColorPicker && (
          <div className="plan-picker-overlay" onClick={() => setShowBgColorPicker(false)}>
            <div className="plan-color-picker" onClick={(e) => e.stopPropagation()}>
              <h4>选择背景颜色</h4>
              <div className="plan-color-grid">
                {['#FFFFFF', '#FFF3E0', '#E3F2FD', '#F3E5F5', '#E8F5E9', '#FFF9C4', '#FFEBEE', '#F5F5F5'].map((color) => (
                  <button
                    key={color}
                    className="plan-color-option"
                    style={{ backgroundColor: color, border: '2px solid #DDD' }}
                    onClick={() => {
                      setBackgroundColor(color);
                      setShowBgColorPicker(false);
                    }}
                  />
                ))}
              </div>
              <input
                type="color"
                value={backgroundColor}
                onChange={(e) => setBackgroundColor(e.target.value)}
                className="plan-color-input"
              />
            </div>
          </div>
        )}

        {/* 标签选择器 */}
        {showTagSelector && (
          <div className="plan-picker-overlay" onClick={() => setShowTagSelector(false)}>
            <div className="plan-tag-selector" onClick={(e) => e.stopPropagation()}>
              <h4>选择标签</h4>
              <div className="plan-tag-list">
                {availableTags.map((tag) => (
                  <button
                    key={tag}
                    className={`plan-tag-option ${selectedTags.includes(tag) ? 'selected' : ''}`}
                    onClick={() => handleTagToggle(tag)}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
              <div className="plan-tag-create">
                <input
                  type="text"
                  placeholder="创建新标签..."
                  className="plan-tag-input"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      const newTag = (e.target as HTMLInputElement).value.trim();
                      if (newTag && onCreateTag) {
                        onCreateTag(newTag);
                        handleTagToggle(newTag);
                        (e.target as HTMLInputElement).value = '';
                      }
                    }
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanItemEditor;
