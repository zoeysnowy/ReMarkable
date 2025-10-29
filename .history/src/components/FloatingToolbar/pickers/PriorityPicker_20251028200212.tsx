/**
 * PriorityPicker - 优先级选择器
 */

import React from 'react';
import './PriorityPicker.css';

interface PriorityPickerProps {
  onSelect: (priority: 'low' | 'medium' | 'high' | 'urgent') => void;
  onClose: () => void;
}

const PRIORITIES = [
  { value: 'urgent' as const, label: '紧急', color: '#ef4444', icon: '🔴' },
  { value: 'high' as const, label: '高', color: '#f59e0b', icon: '🟠' },
  { value: 'medium' as const, label: '中', color: '#3b82f6', icon: '🔵' },
  { value: 'low' as const, label: '低', color: '#6b7280', icon: '⚪' },
];

export const PriorityPicker: React.FC<PriorityPickerProps> = ({
  onSelect,
  onClose,
}) => {
  return (
    <div className="priority-picker-panel">
      <div className="picker-header">
        <span className="picker-title">设置优先级</span>
        <button className="picker-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="priority-list">
        {PRIORITIES.map((priority) => (
          <button
            key={priority.value}
            className="priority-item"
            onClick={() => onSelect(priority.value)}
            style={{ borderLeftColor: priority.color }}
          >
            <span className="priority-icon">{priority.icon}</span>
            <span className="priority-label">{priority.label}</span>
            <span
              className="priority-badge"
              style={{ backgroundColor: priority.color }}
            >
              {priority.value}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
