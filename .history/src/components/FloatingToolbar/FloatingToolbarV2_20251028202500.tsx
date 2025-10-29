/**
 * FloatingToolbarV2 - 可配置的浮动工具栏
 * 
 * 特性：
 * - 支持两种模式：快捷操作(Ctrl+/ 或 Ctrl+,) 和 文本格式化(选中文本)
 * - 可配置的功能组合
 * - 各个 Picker 组件独立封装
 */

import React, { useState, useRef, useEffect } from 'react';
import { ToolbarConfig, ToolbarFeatureType, FloatingToolbarProps } from './types';
import { TagPicker } from './pickers/TagPicker';
import EmojiPicker from '../EmojiPicker'; // 使用现有的完整 EmojiPicker
import { DateRangePicker } from './pickers/DateRangePicker';
import { PriorityPicker } from './pickers/PriorityPicker';
import { ColorPicker } from './pickers/ColorPicker';
import './FloatingToolbarV2.css';

export const FloatingToolbarV2: React.FC<FloatingToolbarProps> = ({
  position,
  config,
  onTextFormat,
  onTagSelect,
  onEmojiSelect,
  onDateRangeSelect,
  onPrioritySelect,
  onColorSelect,
  availableTags = [],
  currentTags = [],
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activePicker, setActivePicker] = useState<string | null>(null);
  const [emojiPickerPosition, setEmojiPickerPosition] = useState({ x: 0, y: 0 });

  // 根据 position 调整工具栏位置，避免超出屏幕
  useEffect(() => {
    if (!position.show || !toolbarRef.current) return;

    const toolbar = toolbarRef.current;
    const rect = toolbar.getBoundingClientRect();
    
    // 如果超出右边界，向左调整
    if (rect.right > window.innerWidth) {
      toolbar.style.left = `${position.left - (rect.right - window.innerWidth) - 10}px`;
    }
    
    // 如果超出上边界，向下显示
    if (rect.top < 0) {
      toolbar.style.top = `${position.top + rect.height + 20}px`;
    }
  }, [position]);

  if (!position.show) return null;

  // 渲染文本格式化按钮
  const renderTextFormatButton = (feature: ToolbarFeatureType) => {
    const formatMap: Record<string, { icon: string; label: string; command: string }> = {
      bold: { icon: 'B', label: '粗体', command: 'bold' },
      italic: { icon: 'I', label: '斜体', command: 'italic' },
      underline: { icon: 'U', label: '下划线', command: 'underline' },
      strikethrough: { icon: 'S', label: '删除线', command: 'strikeThrough' },
      clearFormat: { icon: '✕', label: '清除格式', command: 'removeFormat' },
    };

    const config = formatMap[feature];
    if (!config) return null;

    return (
      <button
        key={feature}
        className="toolbar-btn"
        title={config.label}
        onClick={() => onTextFormat?.(config.command)}
      >
        <span style={{ fontWeight: feature === 'bold' ? 'bold' : 'normal' }}>
          {config.icon}
        </span>
      </button>
    );
  };

  // 渲染快捷操作按钮
  const renderQuickActionButton = (feature: ToolbarFeatureType) => {
    const actionMap: Record<string, { icon: string; label: string }> = {
      tag: { icon: '#', label: '添加标签' },
      emoji: { icon: '😊', label: '添加表情' },
      dateRange: { icon: '📅', label: '选择日期' },
      priority: { icon: '⚡', label: '设置优先级' },
      color: { icon: '🎨', label: '选择颜色' },
      link: { icon: '🔗', label: '插入链接' },
    };

    const actionConfig = actionMap[feature];
    if (!actionConfig) return null;

    return (
      <button
        key={feature}
        className={`toolbar-btn ${activePicker === feature ? 'active' : ''}`}
        title={actionConfig.label}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          console.log('Button clicked:', feature, 'Current activePicker:', activePicker);
          
          // 如果是 emoji 按钮，计算 EmojiPicker 的显示位置
          if (feature === 'emoji') {
            const buttonRect = e.currentTarget.getBoundingClientRect();
            setEmojiPickerPosition({
              x: buttonRect.left,
              y: buttonRect.bottom + 8, // 按钮下方 8px
            });
          }
          
          setActivePicker(activePicker === feature ? null : feature);
        }}
      >
        {actionConfig.icon}
      </button>
    );
  };

  return (
    <div
      ref={toolbarRef}
      className="floating-toolbar-v2"
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        transform: 'translateX(-50%)',
        zIndex: 10000,
      }}
      onClick={(e) => {
        e.stopPropagation();
      }}
      onMouseDown={(e) => {
        e.stopPropagation();
      }}
    >
      {/* 主工具栏 */}
      <div className="toolbar-main">
        {config.features.map((feature) => {
          // 文本格式化功能
          if (['bold', 'italic', 'underline', 'strikethrough', 'clearFormat'].includes(feature)) {
            return renderTextFormatButton(feature);
          }
          // 快捷操作功能
          return renderQuickActionButton(feature);
        })}
      </div>

      {/* Picker 面板 */}
      {activePicker === 'tag' && (
        <TagPicker
          availableTags={availableTags}
          selectedTags={currentTags}
          onSelect={(tag) => {
            onTagSelect?.(tag);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
        />
      )}

      {/* 使用现有的 EmojiPicker（独立浮层） */}
      <EmojiPicker
        isVisible={activePicker === 'emoji'}
        position={emojiPickerPosition}
        onSelect={(emoji: string) => {
          onEmojiSelect?.(emoji);
          setActivePicker(null);
        }}
        onClose={() => setActivePicker(null)}
      />

      {activePicker === 'dateRange' && (
        <DateRangePicker
          onSelect={(start, end) => {
            onDateRangeSelect?.(start, end);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
        />
      )}

      {activePicker === 'priority' && (
        <PriorityPicker
          onSelect={(priority) => {
            onPrioritySelect?.(priority);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
        />
      )}

      {activePicker === 'color' && (
        <ColorPicker
          onSelect={(color) => {
            onColorSelect?.(color);
            setActivePicker(null);
          }}
          onClose={() => setActivePicker(null)}
        />
      )}
    </div>
  );
};
