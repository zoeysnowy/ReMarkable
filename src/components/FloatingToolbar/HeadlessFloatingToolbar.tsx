/**
 * HeadlessFloatingToolbar - 使用 Headless UI 设计的优雅浮动工具栏
 * 支持两种显示模式：
 * - menu_floatingbar: 完整菜单（双击 Alt 触发）- 显示 tag, emoji, dateRange, priority, color, addTask
 * - text_floatingbar: 文本格式（选中文字触发）- 显示 bold, italic, underline, strikethrough 等
 */

import React, { useState, useRef, useEffect } from 'react';
import Tippy from '@tippyjs/react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import 'tippy.js/dist/tippy.css';
import { /* ToolbarConfig, */ ToolbarFeatureType, FloatingToolbarProps, FloatingBarMode } from './types';
import { TagPicker } from './pickers/TagPicker';
import UnifiedDateTimePicker from './pickers/UnifiedDateTimePicker';
// import { SimpleDatePicker } from './pickers/SimpleDatePicker';
import { PriorityPicker } from './pickers/PriorityPicker';
import { ColorPicker } from './pickers/ColorPicker';
import './HeadlessFloatingToolbar.css';

export const HeadlessFloatingToolbar: React.FC<FloatingToolbarProps & { mode?: FloatingBarMode }> = ({
  position,
  config,
  mode = 'menu_floatingbar', // 🆕 默认为菜单模式
  slateEditorRef, // 🆕 Slate Editor 引用
  onTextFormat,
  onTagSelect,
  onEmojiSelect,
  onDateRangeSelect,
  onPrioritySelect,
  onColorSelect,
  onTaskToggle,
  onRequestClose,
  availableTags = [],
  currentTags = [],
  currentIsTask = false,
  activePickerIndex,
  eventId,
  useTimeHub,
  onTimeApplied,
  editorMode, // 🆕 接收编辑器模式
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // 🆕 根据 mode 决定显示的功能集合（提前计算，供 useEffect 使用）
  const menuFloatingbarFeaturesBase: ToolbarFeatureType[] = ['tag', 'emoji', 'dateRange', 'priority', 'color', 'addTask', 'bullet'];
  const textFloatingbarFeatures: ToolbarFeatureType[] = ['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'];
  
  // 🔧 标题模式下隐藏 bullet 菜单（因为标题已有勾选框）
  const menuFloatingbarFeatures = editorMode === 'title' 
    ? menuFloatingbarFeaturesBase.filter(f => f !== 'bullet')
    : menuFloatingbarFeaturesBase;
  
  // 根据 mode 覆盖 config.features（如果外层没有提供）
  const effectiveFeatures = mode === 'text_floatingbar' 
    ? (config.features.some(f => textFloatingbarFeatures.includes(f)) ? config.features : textFloatingbarFeatures)
    : (config.features.some(f => menuFloatingbarFeatures.includes(f)) ? config.features : menuFloatingbarFeatures);

  // 功能按钮配置（提前定义，供 useEffect 使用）
  const textFeatureConfig = {
    bold: { icon: '𝐁', label: '粗体', command: 'bold' },
    italic: { icon: '𝑰', label: '斜体', command: 'italic' },
    underline: { icon: '𝐔', label: '下划线', command: 'underline' },
    strikethrough: { icon: '𝐒', label: '删除线', command: 'strikeThrough' },
    clearFormat: { icon: '✕', label: '清除格式', command: 'removeFormat' },
    bullet: { icon: 'bulletpoints-svg', label: '项目符号', command: 'toggleBulletList' },
  };

  // 监听 activePickerIndex 变化，通过数字键激活对应的 picker
  useEffect(() => {
    if (activePickerIndex !== null && activePickerIndex !== undefined) {
      const feature = effectiveFeatures[activePickerIndex]; // 🔧 使用 effectiveFeatures 而不是 config.features
      if (feature) {
        console.log('[HeadlessFloatingToolbar] 数字键激活功能:', { activePickerIndex, feature, mode });
        
        // 🔧 区分需要打开 Picker 的功能和直接执行的命令
        const textFormatCommands = ['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'];
        
        if (textFormatCommands.includes(feature)) {
          // 文本格式化命令：直接执行，不打开 Picker
          const btnConfig = textFeatureConfig[feature as keyof typeof textFeatureConfig];
          if (btnConfig) {
            onTextFormat?.(btnConfig.command);
            onRequestClose?.(); // 执行完命令后关闭 FloatingBar
          }
        } else {
          // 快捷操作功能：打开对应的 Picker
          setActivePicker(feature);
        }
      }
    }
  }, [activePickerIndex, effectiveFeatures, mode, onTextFormat, onRequestClose]);

  // 🆕 FloatingBar 重新打开时重置 activePicker（避免显示上次的 Picker 状态）
  useEffect(() => {
    if (position.show) {
      setActivePicker(null); // 🔧 每次打开时重置
    }
  }, [position.show]);

  // 监听 activePicker 变化
  useEffect(() => {
  }, [activePicker]);

  if (!position.show) return null;

  const actionFeatureConfig = {
    tag: { icon: '#', label: '添加标签', color: '#3b82f6' },
    emoji: { icon: '😊', label: '添加表情', color: '#f59e0b' },
    dateRange: { icon: '📅', label: '选择日期', color: '#10b981' },
    priority: { icon: '⚡', label: '设置优先级', color: '#ef4444' },
    color: { icon: '🎨', label: '选择颜色', color: '#8b5cf6' },
    addTask: { icon: '☑', label: '任务模式', color: '#6b7280' }, // 🆕 任务开关
  };

  // 渲染文本格式化按钮
  const renderTextFormatButton = (feature: ToolbarFeatureType) => {
    const btnConfig = textFeatureConfig[feature as keyof typeof textFeatureConfig];
    if (!btnConfig) return null;

    // 🆕 bullet 特殊处理：使用 SVG 图标（直接内嵌路径）
    if (feature === 'bullet') {
      return (
        <Tippy key={feature} content={btnConfig.label} placement="top">
          <button
            className="headless-toolbar-btn headless-toolbar-text-btn"
            onClick={(e) => {
              e.stopPropagation();
              onTextFormat?.(btnConfig.command);
              // 🆕 执行完 bullet 命令后关闭 FloatingBar
              onRequestClose?.();
            }}
          >
            <svg width="16" height="14" viewBox="0 0 16 14" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: 'block' }}>
              <path d="M1.33333 2.66667C1.68696 2.66667 2.02609 2.52619 2.27614 2.27614C2.52619 2.02609 2.66667 1.68696 2.66667 1.33333C2.66667 0.979711 2.52619 0.640573 2.27614 0.390524C2.02609 0.140476 1.68696 0 1.33333 0C0.979711 0 0.640573 0.140476 0.390524 0.390524C0.140476 0.640573 0 0.979711 0 1.33333C0 1.68696 0.140476 2.02609 0.390524 2.27614C0.640573 2.52619 0.979711 2.66667 1.33333 2.66667ZM5.66667 0.333333C5.40145 0.333333 5.1471 0.43869 4.95956 0.626226C4.77202 0.813763 4.66667 1.06812 4.66667 1.33333C4.66667 1.59855 4.77202 1.8529 4.95956 2.04044C5.1471 2.22798 5.40145 2.33333 5.66667 2.33333H15C15.2652 2.33333 15.5196 2.22798 15.7071 2.04044C15.8946 1.8529 16 1.59855 16 1.33333C16 1.06812 15.8946 0.813763 15.7071 0.626226C15.5196 0.43869 15.2652 0.333333 15 0.333333H5.66667ZM5.66667 6C5.40145 6 5.1471 6.10536 4.95956 6.29289C4.77202 6.48043 4.66667 6.73478 4.66667 7C4.66667 7.26522 4.77202 7.51957 4.95956 7.70711C5.1471 7.89464 5.40145 8 5.66667 8H15C15.2652 8 15.5196 7.89464 15.7071 7.70711C15.8946 7.51957 16 7.26522 16 7C16 6.73478 15.8946 6.48043 15.7071 6.29289C15.5196 6.10536 15.2652 6 15 6H5.66667ZM5.66667 11.6667C5.40145 11.6667 5.1471 11.772 4.95956 11.9596C4.77202 12.1471 4.66667 12.4015 4.66667 12.6667C4.66667 12.9319 4.77202 13.1862 4.95956 13.3738C5.1471 13.5613 5.40145 13.6667 5.66667 13.6667H15C15.2652 13.6667 15.5196 13.5613 15.7071 13.3738C15.8946 13.1862 16 12.9319 16 12.6667C16 12.4015 15.8946 12.1471 15.7071 11.9596C15.5196 11.772 15.2652 11.6667 15 11.6667H5.66667ZM2.66667 12.6667C2.66667 13.0203 2.52619 13.3594 2.27614 13.6095C2.02609 13.8595 1.68696 14 1.33333 14C0.979711 14 0.640573 13.8595 0.390524 13.6095C0.140476 13.3594 0 13.0203 0 12.6667C0 12.313 0.140476 11.9739 0.390524 11.7239C0.640573 11.4738 0.979711 11.3333 1.33333 11.3333C1.68696 11.3333 2.02609 11.4738 2.27614 11.7239C2.52619 11.9739 2.66667 12.313 2.66667 12.6667ZM1.33333 8.33333C1.68696 8.33333 2.02609 8.19286 2.27614 7.94281C2.52619 7.69276 2.66667 7.35362 2.66667 7C2.66667 6.64638 2.52619 6.30724 2.27614 6.05719C2.02609 5.80714 1.68696 5.66667 1.33333 5.66667C0.979711 5.66667 0.640573 5.80714 0.390524 6.05719C0.140476 6.30724 0 6.64638 0 7C0 7.35362 0.140476 7.69276 0.390524 7.94281C0.640573 8.19286 0.979711 8.33333 1.33333 8.33333Z" fill="#4B5563"/>
            </svg>
          </button>
        </Tippy>
      );
    }

    return (
      <Tippy key={feature} content={btnConfig.label} placement="top">
        <button
          className="headless-toolbar-btn headless-toolbar-text-btn"
          onClick={(e) => {
            e.stopPropagation();
            onTextFormat?.(btnConfig.command);
          }}
        >
          <span className={feature === 'bold' ? 'font-bold' : feature === 'italic' ? 'italic' : ''}>
            {btnConfig.icon}
          </span>
        </button>
      </Tippy>
    );
  };

  // 渲染快捷操作按钮
  const renderQuickActionButton = (feature: ToolbarFeatureType) => {
    const btnConfig = actionFeatureConfig[feature as keyof typeof actionFeatureConfig];
    if (!btnConfig) return null;

    // 🆕 addTask 特殊处理：Toggle 按钮
    if (feature === 'addTask') {
      return (
        <Tippy key={feature} content={btnConfig.label} placement="top">
          <button
            className={`headless-toolbar-btn headless-toolbar-action-btn ${
              currentIsTask ? 'headless-toolbar-btn-active' : ''
            }`}
            style={{ 
              backgroundColor: currentIsTask ? btnConfig.color : undefined,
              opacity: currentIsTask ? 1 : 0.6,
            }}
            onClick={(e) => {
              e.stopPropagation();
              onTaskToggle?.(!currentIsTask);
            }}
          >
            {btnConfig.icon}
          </button>
        </Tippy>
      );
    }

    // Emoji 按钮使用 Tippy.js
    if (feature === 'emoji') {
      return (
        <Tippy
          key={feature}
          content={
            <div className="headless-emoji-tippy-content">
              {/* 只在 picker 激活时才渲染 Emoji Picker */}
              {activePicker === feature && (
                <Picker
                  data={data}
                  onEmojiSelect={(emoji: any) => {
                    onEmojiSelect?.(emoji.native);
                    setActivePicker(null);
                    onRequestClose?.(); // 🆕 选择 Emoji 后自动关闭 FloatingBar
                  }}
                  theme="light"
                  set="native"
                  locale="zh"
                  perLine={8}
                  emojiSize={20}
                  previewPosition="none"
                  skinTonePosition="none"
                />
              )}
            </div>
          }
          visible={activePicker === feature}
          onClickOutside={() => setActivePicker(null)}
          placement="bottom-start"
          interactive={true}
          offset={[0, 8]}
          maxWidth="none"
          animation="scale"
          theme="transparent"
        >
          <button
            className={`headless-toolbar-btn headless-toolbar-action-btn ${
              activePicker === feature ? 'headless-toolbar-btn-active' : ''
            }`}
            style={{ backgroundColor: activePicker === feature ? btnConfig.color : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePicker(activePicker === feature ? null : feature);
            }}
          >
            {btnConfig.icon}
          </button>
        </Tippy>
      );
    }

    // DateRange 使用 Tippy.js 进行正确定位
    if (feature === 'dateRange') {
      return (
        <Tippy
          key={feature}
          content={
            <div className="headless-date-tippy-content">
              {/* 只在 picker 激活时才渲染 DateTimePicker */}
              {activePicker === feature && (
                <UnifiedDateTimePicker
                  eventId={eventId}
                  useTimeHub={useTimeHub}
                  onApplied={(startIso, endIso, allDay) => {
                    // TimeHub 模式：时间已由 TimeHub 写入，这里通知外层插入可视化/保存其它字段
                    onTimeApplied?.(startIso, endIso, allDay);
                    setActivePicker(null);
                    onRequestClose?.(); // 🆕 选择日期后自动关闭 FloatingBar
                  }}
                  // 非 TimeHub 模式下，沿用原有 onSelect 回调
                  onSelect={(!useTimeHub || !eventId) ? ((start: string | null, end: string | null) => {
                    if (start && end) {
                      onDateRangeSelect?.(new Date(start), new Date(end));
                    }
                    setActivePicker(null);
                    onRequestClose?.(); // 🆕 选择日期后自动关闭 FloatingBar
                  }) : undefined}
                  onClose={() => {
                    setActivePicker(null);
                    onRequestClose?.(); // 🆕 关闭 DatePicker 也关闭 FloatingBar
                  }}
                />
              )}
            </div>
          }
          visible={activePicker === feature}
          onClickOutside={() => {
            setActivePicker(null);
          }}
          placement="bottom-start"
          interactive={true}
          interactiveBorder={20}
          interactiveDebounce={0}
          offset={[0, 8]}
          maxWidth="none"
          animation="shift-away"
          duration={200}
          appendTo={() => document.body}
          zIndex={99999}
          theme="light-no-padding"
        >
          <button
            className={`headless-toolbar-btn headless-toolbar-action-btn ${
              activePicker === feature ? 'headless-toolbar-btn-active' : ''
            }`}
            style={{ backgroundColor: activePicker === feature ? btnConfig.color : undefined }}
            onClick={(e) => {
              e.stopPropagation();
              setActivePicker(activePicker === feature ? null : feature);
            }}
          >
            {btnConfig.icon}
          </button>
        </Tippy>
      );
    }

    // 其他按钮也使用 Tippy.js
    return (
      <Tippy
        key={feature}
        content={
          <div className="headless-picker-tippy-content">
            {/* 只在 picker 激活时才渲染对应的组件 */}
            {activePicker === feature && feature === 'tag' && (
              <TagPicker
                availableTags={availableTags}
                selectedTags={currentTags}
                editorMode={editorMode}
                slateEditorRef={slateEditorRef}
                onSelect={(tagIds) => {
                  // 标签选择是多选模式，不应该在每次选择后关闭
                  onTagSelect?.(tagIds);
                  // setActivePicker(null); // 移除自动关闭
                }}
                onClose={() => {
                  setActivePicker(null);
                  onRequestClose?.(); // 🆕 通知父组件关闭整个 FloatingBar
                }}
              />
            )}
            
            {activePicker === feature && feature === 'priority' && (
              <PriorityPicker
                onSelect={(priority) => {
                  onPrioritySelect?.(priority);
                  setActivePicker(null);
                  onRequestClose?.(); // 🆕 选择后自动关闭 FloatingBar
                }}
                onClose={() => {
                  setActivePicker(null);
                  onRequestClose?.(); // 🆕 关闭 Picker 也关闭 FloatingBar
                }}
              />
            )}

            {activePicker === feature && feature === 'color' && (
              <ColorPicker
                onSelect={(color) => {
                  onColorSelect?.(color);
                  setActivePicker(null);
                  onRequestClose?.(); // 🆕 选择后自动关闭 FloatingBar
                }}
                onClose={() => {
                  setActivePicker(null);
                  onRequestClose?.(); // 🆕 关闭 Picker 也关闭 FloatingBar
                }}
              />
            )}
          </div>
        }
        visible={activePicker === feature}
        onClickOutside={() => setActivePicker(null)}
        placement="bottom-start"
        interactive={true}
        offset={[0, 8]}
        maxWidth="none"
        animation="scale"
        theme="transparent"
      >
        <button
          className={`headless-toolbar-btn headless-toolbar-action-btn ${
            activePicker === feature ? 'headless-toolbar-btn-active' : ''
          }`}
          style={{ backgroundColor: activePicker === feature ? btnConfig.color : undefined }}
          onClick={(e) => {
            e.stopPropagation();
            setActivePicker(activePicker === feature ? null : feature);
          }}
        >
          {btnConfig.icon}
        </button>
      </Tippy>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="headless-floating-toolbar"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 10000,
      }}
    >
      <div className="headless-toolbar-container">
        <div className="headless-toolbar-main">
          {effectiveFeatures.map((feature) => {
            // 文本格式化功能
            if (['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'].includes(feature)) {
              return renderTextFormatButton(feature);
            }
            // 快捷操作功能
            return renderQuickActionButton(feature);
          })}
        </div>
      </div>
    </div>
  );
};