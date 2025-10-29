/**
 * HeadlessFloatingToolbar - 使用 Headless UI 设计的优雅浮动工具栏
 */

import React, { useState, useRef, useEffect, Fragment } from 'react';
import { Menu, Transition, Popover } from '@headlessui/react';
import Tippy from '@tippyjs/react';
import Picker from '@emoji-mart/react';
import data from '@emoji-mart/data';
import 'tippy.js/dist/tippy.css';
import { ToolbarConfig, ToolbarFeatureType, FloatingToolbarProps } from './types';
import { TagPicker } from './pickers/TagPicker';
import { AntDateRangePicker } from './pickers/AntDateRangePicker';
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
  availableTags = [],
  currentTags = [],
}) => {
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [activePicker, setActivePicker] = useState<string | null>(null);

  // 计算最佳位置
  const calculateOptimalPosition = (rect: DOMRect, pickerWidth = 352, pickerHeight = 435) => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const scrollY = window.scrollY;
    
    let x = rect.left;
    let y = rect.bottom + 5;
    
    if (x + pickerWidth > viewportWidth) {
      x = viewportWidth - pickerWidth - 10;
    }
    if (x < 10) {
      x = 10;
    }
    if (y + pickerHeight > viewportHeight + scrollY) {
      y = rect.top - pickerHeight - 5;
    }
    if (y < scrollY + 10) {
      y = scrollY + 10;
    }
    
    return { x, y };
  };

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
          onClick={() => onTextFormat?.(btnConfig.command)}
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

    // Emoji 按钮使用 Popover
    if (feature === 'emoji') {
      return (
        <Popover key={feature} className="headless-toolbar-popover">
          {({ open, close }) => (
            <>
              <Tippy content={btnConfig.label} placement="top" disabled={open}>
                <Popover.Button
                  className={`headless-toolbar-btn headless-toolbar-action-btn ${
                    open ? 'headless-toolbar-btn-active' : ''
                  }`}
                  style={{ backgroundColor: open ? btnConfig.color : undefined }}
                >
                  {btnConfig.icon}
                </Popover.Button>
              </Tippy>

              <Transition
                as={Fragment}
                show={open}
                enter="transition ease-out duration-200"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-150"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Popover.Panel className="headless-toolbar-panel headless-emoji-panel">
                  <Picker
                    data={data}
                    onEmojiSelect={(emoji: any) => {
                      onEmojiSelect?.(emoji.native);
                      close();
                    }}
                    theme="light"
                    set="native"
                    locale="zh"
                    perLine={8}
                    emojiSize={20}
                    previewPosition="none"
                    skinTonePosition="none"
                  />
                </Popover.Panel>
              </Transition>
            </>
          )}
        </Popover>
      );
    }

    // 其他按钮使用 Menu
    return (
      <Menu key={feature} as="div" className="headless-toolbar-menu">
        {({ open, close }) => (
          <>
            <Tippy content={btnConfig.label} placement="top" disabled={open}>
              <Menu.Button
                className={`headless-toolbar-btn headless-toolbar-action-btn ${
                  open ? 'headless-toolbar-btn-active' : ''
                }`}
                style={{ backgroundColor: open ? btnConfig.color : undefined }}
              >
                {btnConfig.icon}
              </Menu.Button>
            </Tippy>

            <Transition
              as={Fragment}
              show={open}
              enter="transition ease-out duration-200"
              enterFrom="transform opacity-0 scale-95"
              enterTo="transform opacity-100 scale-100"
              leave="transition ease-in duration-150"
              leaveFrom="transform opacity-100 scale-100"
              leaveTo="transform opacity-0 scale-95"
            >
              <Menu.Items className="headless-toolbar-panel">
                {feature === 'tag' && (
                  <TagPicker
                    availableTags={availableTags}
                    selectedTags={currentTags}
                    onSelect={(tag) => {
                      onTagSelect?.(tag);
                      close();
                    }}
                    onClose={close}
                  />
                )}
                
                {feature === 'dateRange' && (
                  <AntDateRangePicker
                    onSelect={(start, end) => {
                      onDateRangeSelect?.(start, end);
                      close();
                    }}
                    onClose={close}
                  />
                )}

                {feature === 'priority' && (
                  <PriorityPicker
                    onSelect={(priority) => {
                      onPrioritySelect?.(priority);
                      close();
                    }}
                    onClose={close}
                  />
                )}

                {feature === 'color' && (
                  <ColorPicker
                    onSelect={(color) => {
                      onColorSelect?.(color);
                      close();
                    }}
                    onClose={close}
                  />
                )}
              </Menu.Items>
            </Transition>
          </>
        )}
      </Menu>
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
        transform: 'translateX(-50%)',
        zIndex: 10000,
      }}
    >
      <Transition
        show={true}
        appear={true}
        enter="transition ease-out duration-300"
        enterFrom="transform opacity-0 scale-95 translate-y-2"
        enterTo="transform opacity-100 scale-100 translate-y-0"
        leave="transition ease-in duration-200"
        leaveFrom="transform opacity-100 scale-100 translate-y-0"
        leaveTo="transform opacity-0 scale-95 translate-y-2"
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
      </Transition>
    </div>
  );
};