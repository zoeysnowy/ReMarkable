/**
 * ColorPicker - 颜色选择器
 */

import React from 'react';
import './ColorPicker.css';

interface ColorPickerProps {
  onSelect: (color: string) => void;
  onClose: () => void;
}

const COLORS = [
  { value: '#ef4444', label: '红色' },
  { value: '#f59e0b', label: '橙色' },
  { value: '#eab308', label: '黄色' },
  { value: '#22c55e', label: '绿色' },
  { value: '#3b82f6', label: '蓝色' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#ec4899', label: '粉色' },
  { value: '#6b7280', label: '灰色' },
];

export const ColorPicker: React.FC<ColorPickerProps> = ({
  onSelect,
  onClose,
}) => {
  return (
    <div className="color-picker-panel">
      <div className="picker-header">
        <span className="picker-title">选择颜色</span>
        <button className="picker-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="color-grid">
        {COLORS.map((color) => (
          <button
            key={color.value}
            className="color-item"
            onClick={() => onSelect(color.value)}
            title={color.label}
            style={{
              backgroundColor: color.value,
            }}
          >
            <span className="color-checkmark">✓</span>
          </button>
        ))}
      </div>
    </div>
  );
};
