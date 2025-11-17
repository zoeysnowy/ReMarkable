/**
 * EditableField - 内联编辑组件
 * 
 * 功能：
 * - 点击查看模式切换到编辑模式
 * - 支持单行文本和多行文本
 * - Enter 保存，Esc 取消
 */

import React, { useState, useRef, useEffect } from 'react';
import './EditableField.css';

export interface EditableFieldProps {
  label: string;
  value?: string;
  multiline?: boolean;
  placeholder?: string;
  onSave: (value: string) => void;
  className?: string;
}

export const EditableField: React.FC<EditableFieldProps> = ({
  label,
  value,
  multiline = false,
  placeholder = '点击添加',
  onSave,
  className = '',
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || '');
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // 选中所有文本
      if (inputRef.current instanceof HTMLInputElement || inputRef.current instanceof HTMLTextAreaElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing]);

  const handleSave = () => {
    if (editValue !== value) {
      onSave(editValue);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditValue(value || '');
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      handleCancel();
    }
  };

  return (
    <div className={`editable-field ${className}`}>
      <label className="editable-field-label">{label}</label>
      {isEditing ? (
        <div className="editable-field-edit-mode">
          {multiline ? (
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="editable-field-textarea"
              rows={3}
            />
          ) : (
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="editable-field-input"
            />
          )}
          <div className="editable-field-actions">
            <button 
              className="editable-field-btn editable-field-btn-save" 
              onClick={handleSave}
              title="保存 (Enter)"
            >
              ✓
            </button>
            <button 
              className="editable-field-btn editable-field-btn-cancel" 
              onClick={handleCancel}
              title="取消 (Esc)"
            >
              ✕
            </button>
          </div>
        </div>
      ) : (
        <div 
          className="editable-field-view-mode" 
          onClick={() => setIsEditing(true)}
        >
          <span className={value ? 'editable-field-value' : 'editable-field-placeholder'}>
            {value || placeholder}
          </span>
        </div>
      )}
    </div>
  );
};
