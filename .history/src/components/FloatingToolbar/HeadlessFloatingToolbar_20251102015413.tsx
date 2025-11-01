/**
 * HeadlessFloatingToolbar - 使用 Headless UI 设计的优雅浮动工具栏
 */

import React, { useState, useRef, useEffect, Fragment } from 'react';
import Tippy from '@tippyjs/react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import 'tippy.js/dist/tippy.css';
import { ToolbarConfig, ToolbarFeatureType, FloatingToolbarProps } from './types';
import { TagPicker } from './pickers/TagPicker';
import UnifiedDateTimePicker from './pickers/UnifiedDateTimePicker';
import { SimpleDatePicker } from './pickers/SimpleDatePicker';
import { PriorityPicker } from './pickers/PriorityPicker';
import { ColorPicker } from './pickers/ColorPicker';
import './HeadlessFloatingToolbar.css';

export const HeadlessFloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position,
  config,
  onTextFormat,
  onTagSelect,
  onEmojiSelect,
  onDateRangeSelect,
  onPrioritySelect,
  onColorSelect,
  onTaskToggle,
  availableTags = [],
  currentTags = [],
  currentIsTask = false,
  activePickerIndex,
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // 监听 activePickerIndex 变化，通过数字键激活对应的 picker
  useEffect(() => {
    if (activePickerIndex !== null && activePickerIndex !== undefined) {
      const feature = config.features[activePickerIndex];
      if (feature) {
        setActivePicker(feature);
      }
    }
  }, [activePickerIndex, config.features]);

  // 监听 activePicker 变化
  useEffect(() => {
  }, [activePicker]);

  if (!position.show) return null;

  // 功能按钮配置
  const textFeatureConfig = {
    bold: { icon: '𝐁', label: '粗体', command: 'bold' },
    italic: { icon: '𝑰', label: '斜体', command: 'italic' },
    underline: { icon: '𝐔', label: '下划线', command: 'underline' },
    strikethrough: { icon: '𝐒', label: '删除线', command: 'strikeThrough' },
    clearFormat: { icon: '✕', label: '清除格式', command: 'removeFormat' },
  };

  const actionFeatureConfig = {
    tag: { icon: '#', label: '添加标签', color: '#3b82f6' },
    emoji: { icon: '😊', label: '添加表情', color: '#f59e0b' },
    dateRange: { icon: '📅', label: '选择日期', color: '#10b981' },
    priority: { icon: '⚡', label: '设置优先级', color: '#ef4444' },
    color: { icon: '🎨', label: '选择颜色', color: '#8b5cf6' },
  };

  // 渲染文本格式化按钮
  const renderTextFormatButton = (feature: ToolbarFeatureType) => {
    const btnConfig = textFeatureConfig[feature as keyof typeof textFeatureConfig];
    if (!btnConfig) return null;

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
                  onSelect={(start: string | null, end: string | null) => {
                    if (start && end) {
                      onDateRangeSelect?.(new Date(start), new Date(end));
                    }
                    setActivePicker(null);
                  }}
                  onClose={() => {
                    setActivePicker(null);
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
                onSelect={(tagIds) => {
                  // 标签选择是多选模式，不应该在每次选择后关闭
                  onTagSelect?.(tagIds);
                  // setActivePicker(null); // 移除自动关闭
                }}
                onClose={() => setActivePicker(null)}
              />
            )}
            
            {activePicker === feature && feature === 'priority' && (
              <PriorityPicker
                onSelect={(priority) => {
                  onPrioritySelect?.(priority);
                  setActivePicker(null);
                }}
                onClose={() => setActivePicker(null)}
              />
            )}

            {activePicker === feature && feature === 'color' && (
              <ColorPicker
                onSelect={(color) => {
                  onColorSelect?.(color);
                  setActivePicker(null);
                }}
                onClose={() => setActivePicker(null)}
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
          {config.features.map((feature) => {
            // 文本格式化功能
            if (['bold', 'italic', 'underline', 'strikethrough', 'clearFormat'].includes(feature)) {
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