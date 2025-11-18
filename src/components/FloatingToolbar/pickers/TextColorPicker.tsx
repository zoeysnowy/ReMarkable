/**
 * TextColorPicker - 文字颜色选择器
 * 使用 Headless UI 保持设计统一
 * 支持键盘导航：↑↓ 选择，Enter 确认，Esc 关闭
 * 数字快捷键：1-9 快速选择对应颜色
 */

import React, { Fragment, useEffect } from 'react';
import { Listbox, Transition } from '@headlessui/react';
import './TextColorPicker.css';

interface TextColorPickerProps {
  onSelect: (color: string) => void;
  onClose: () => void;
  onPreview?: (color: string) => void;
}

const TEXT_COLORS = [
  { value: '#000000', label: '黑色（默认）', key: '1' },
  { value: '#ef4444', label: '红色', key: '2' },
  { value: '#f59e0b', label: '橙色', key: '3' },
  { value: '#eab308', label: '黄色', key: '4' },
  { value: '#22c55e', label: '绿色', key: '5' },
  { value: '#3b82f6', label: '蓝色', key: '6' },
  { value: '#8b5cf6', label: '紫色', key: '7' },
  { value: '#ec4899', label: '粉色', key: '8' },
  { value: '#6b7280', label: '灰色', key: '9' },
];

export const TextColorPicker: React.FC<TextColorPickerProps> = ({
  onSelect,
  onClose,
  onPreview,
}) => {
  // 数字键快捷选择
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '1' && e.key <= '9') {
        const index = parseInt(e.key) - 1;
        if (index < TEXT_COLORS.length) {
          e.preventDefault();
          onSelect(TEXT_COLORS[index].value);
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onSelect, onClose]);

  return (
    <div 
      className="color-picker-panel"
      onMouseDown={(e) => {
        e.preventDefault();
        console.log('[TextColorPicker] 🔒 阻止默认事件，保持编辑器选区');
      }}
    >
      <div className="picker-header">
        <span className="picker-title">文字颜色</span>
        <span className="picker-header-tip">提示：按 1-9 快速选择</span>
        <button 
          className="picker-close-btn" 
          onClick={onClose}
          onMouseDown={(e) => e.preventDefault()}
        >
          ✕
        </button>
      </div>

      <Listbox value={undefined} onChange={onSelect}>
        <div className="color-grid">
          {TEXT_COLORS.map((color) => (
            <Listbox.Option
              key={color.value}
              value={color.value}
              as={Fragment}
            >
              {({ active }) => (
                <button
                  className={`color-item ${active ? 'color-item-active' : ''}`}
                  onMouseEnter={() => {
                    console.log('[TextColorPicker] 🎨 预览颜色:', color);
                    onPreview?.(color.value);
                  }}
                  onMouseDown={(e) => e.preventDefault()}
                  title={color.label}
                >
                  <span className="color-shortcut">{color.key}</span>
                  <span 
                    className="color-sample" 
                    style={{ color: color.value }}
                  >
                    A
                  </span>
                </button>
              )}
            </Listbox.Option>
          ))}
        </div>
      </Listbox>
    </div>
  );
};
