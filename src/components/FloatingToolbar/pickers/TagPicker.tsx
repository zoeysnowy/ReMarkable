/**
 * TagPicker - 标签选择器
 */

import React, { useState } from 'react';
import './TagPicker.css';

interface TagPickerProps {
  availableTags: string[];
  selectedTags: string[];
  onSelect: (tag: string) => void;
  onClose: () => void;
}

export const TagPicker: React.FC<TagPickerProps> = ({
  availableTags,
  selectedTags,
  onSelect,
  onClose,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [newTagInput, setNewTagInput] = useState('');

  const filteredTags = availableTags.filter(
    (tag) =>
      tag.toLowerCase().includes(searchTerm.toLowerCase()) &&
      !selectedTags.includes(tag)
  );

  const handleCreateTag = () => {
    if (newTagInput.trim()) {
      onSelect(newTagInput.trim());
      setNewTagInput('');
    }
  };

  return (
    <div className="tag-picker-panel">
      <div className="picker-header">
        <input
          type="text"
          className="tag-search-input"
          placeholder="搜索或创建标签..."
          value={searchTerm || newTagInput}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setNewTagInput(e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              handleCreateTag();
            }
          }}
          autoFocus
        />
        <button className="picker-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="tag-list">
        {/* 已选中的标签 */}
        {selectedTags.length > 0 && (
          <div className="tag-section">
            <div className="tag-section-title">已选中</div>
            {selectedTags.map((tag) => (
              <div
                key={tag}
                className="tag-item selected"
                onClick={() => onSelect(tag)}
              >
                <span className="tag-icon">#</span>
                {tag}
                <span className="tag-checkmark">✓</span>
              </div>
            ))}
          </div>
        )}

        {/* 可选标签 */}
        {filteredTags.length > 0 && (
          <div className="tag-section">
            <div className="tag-section-title">可用标签</div>
            {filteredTags.map((tag) => (
              <div
                key={tag}
                className="tag-item"
                onClick={() => onSelect(tag)}
              >
                <span className="tag-icon">#</span>
                {tag}
              </div>
            ))}
          </div>
        )}

        {/* 创建新标签 */}
        {newTagInput && !availableTags.includes(newTagInput) && (
          <div className="tag-section">
            <div
              className="tag-item create-new"
              onClick={handleCreateTag}
            >
              <span className="tag-icon">+</span>
              创建 "{newTagInput}"
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
