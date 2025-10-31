/**
 * HierarchicalTagPicker - 通用层级标签选择器
 * 
 * 功能特性：
 * - ✅ 支持层级标签展示（带缩进）
 * - ✅ 支持颜色和 Emoji
 * - ✅ 单选/多选模式
 * - ✅ 搜索功能
 * - ✅ 全选/清空
 * - ✅ 已选标签显示（chips 模式）
 * - ✅ 下拉/弹出模式
 * 
 * 使用场景：
 * 1. FloatingToolbar - 快速标签选择
 * 2. EventEditModal - 事件标签编辑
 * 3. CalendarSettingsPanel - 标签筛选
 */

import React, { useState, useRef, useEffect } from 'react';
import './HierarchicalTagPicker.css';

export interface HierarchicalTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  level?: number;
  parentId?: string;
}

export interface HierarchicalTagPickerProps {
  /** 可选标签列表（层级结构） */
  availableTags: HierarchicalTag[];
  
  /** 已选标签ID列表 */
  selectedTagIds: string[];
  
  /** 标签选择回调 */
  onSelectionChange: (selectedIds: string[]) => void;
  
  /** 是否多选模式（默认 true） */
  multiple?: boolean;
  
  /** 是否显示搜索框（默认 true） */
  searchable?: boolean;
  
  /** 是否显示已选标签 chips（默认 true） */
  showSelectedChips?: boolean;
  
  /** 是否显示全选/清空按钮（默认 true） */
  showBulkActions?: boolean;
  
  /** 占位符文本 */
  placeholder?: string;
  
  /** 是否自动关闭（单选模式默认 true） */
  autoClose?: boolean;
  
  /** 关闭回调（用于弹出模式） */
  onClose?: () => void;
  
  /** 自定义类名 */
  className?: string;
  
  /** 显示模式：'dropdown' 下拉 | 'inline' 内联 */
  mode?: 'dropdown' | 'inline';
}

export const HierarchicalTagPicker: React.FC<HierarchicalTagPickerProps> = ({
  availableTags,
  selectedTagIds,
  onSelectionChange,
  multiple = true,
  searchable = true,
  showSelectedChips = true,
  showBulkActions = true,
  placeholder = '选择标签...',
  autoClose,
  onClose,
  className = '',
  mode = 'dropdown'
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(mode === 'inline');
  const containerRef = useRef<HTMLDivElement>(null);

  // 自动关闭默认值：单选模式默认 true
  const shouldAutoClose = autoClose !== undefined ? autoClose : !multiple;

  // 过滤标签（搜索）
  const filteredTags = searchQuery.trim()
    ? availableTags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : availableTags;

  // 切换标签选择
  const toggleTag = (tagId: string) => {
    if (multiple) {
      const newSelection = selectedTagIds.includes(tagId)
        ? selectedTagIds.filter(id => id !== tagId)
        : [...selectedTagIds, tagId];
      onSelectionChange(newSelection);
    } else {
      // 单选模式
      onSelectionChange([tagId]);
      if (shouldAutoClose) {
        setIsOpen(false);
        onClose?.();
      }
    }
  };

  // 全选
  const handleSelectAll = () => {
    onSelectionChange(availableTags.map(t => t.id));
  };

  // 清空
  const handleClearAll = () => {
    onSelectionChange([]);
  };

  // 通过 ID 获取标签
  const getTagById = (id: string) => availableTags.find(t => t.id === id);

  // 点击外部关闭
  useEffect(() => {
    if (mode !== 'dropdown' || !isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, mode]);

  return (
    <div 
      className={`hierarchical-tag-picker ${mode} ${className}`}
      ref={containerRef}
    >
      {/* 触发器 + 已选标签 */}
      {mode === 'dropdown' && (
        <div 
          className="tag-picker-trigger"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="selected-tags-chips">
            {showSelectedChips && selectedTagIds.length > 0 ? (
              selectedTagIds.map(tagId => {
                const tag = getTagById(tagId);
                return tag ? (
                  <span 
                    key={tagId} 
                    className="tag-chip" 
                    style={{ 
                      backgroundColor: tag.color + '20',
                      borderColor: tag.color,
                      color: tag.color
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTag(tagId);
                    }}
                  >
                    {tag.emoji && <span className="tag-chip-emoji">{tag.emoji}</span>}
                    #{tag.name}
                    <button 
                      className="tag-chip-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTag(tagId);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                ) : null;
              })
            ) : (
              <span className="tag-picker-placeholder">{placeholder}</span>
            )}
          </div>
          <span className="tag-picker-arrow">{isOpen ? '▲' : '▼'}</span>
        </div>
      )}

      {/* 下拉列表 */}
      {isOpen && (
        <div className="tag-picker-dropdown">
          {/* 头部：搜索 + 操作按钮 */}
          <div className="tag-picker-header">
            {searchable && (
              <input
                type="text"
                className="tag-search-input"
                placeholder="搜索标签..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            )}
            
            {multiple && showBulkActions && (
              <div className="tag-picker-actions">
                <button 
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectAll();
                  }}
                >
                  全选
                </button>
                <button 
                  className="action-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearAll();
                  }}
                >
                  清空
                </button>
              </div>
            )}
            
            {onClose && (
              <button 
                className="tag-picker-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                  onClose();
                }}
              >
                ✕
              </button>
            )}
          </div>

          {/* 标签列表（层级展示） */}
          <div className="tag-picker-list">
            {filteredTags.length > 0 ? (
              filteredTags.map(tag => {
                const isSelected = selectedTagIds.includes(tag.id);
                const paddingLeft = `${(tag.level || 0) * 16}px`;
                
                return (
                  <label
                    key={tag.id}
                    className={`tag-option ${isSelected ? 'selected' : ''}`}
                  >
                    {multiple && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTag(tag.id)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div 
                      className="tag-content"
                      style={{ paddingLeft }}
                      onClick={() => toggleTag(tag.id)}
                    >
                      <span 
                        className="tag-hash" 
                        style={{ color: tag.color }}
                      >
                        #
                      </span>
                      {tag.emoji && (
                        <span className="tag-emoji">{tag.emoji}</span>
                      )}
                      <span 
                        className="tag-name"
                        style={{ color: tag.color }}
                      >
                        {tag.name}
                      </span>
                    </div>
                    {isSelected && !multiple && (
                      <span className="tag-checkmark">✓</span>
                    )}
                  </label>
                );
              })
            ) : (
              <div className="no-tags">
                {searchQuery ? '没有找到匹配的标签' : '暂无标签'}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
