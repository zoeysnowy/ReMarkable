/**
 * HierarchicalTagPicker - 通用层级标签选择器
 * 
 * 功能：
 * - 支持层级标签展示（根据 level 缩进）
 * - 支持单选/多选模式
 * - 支持搜索过滤
 * - 显示标签颜色、Emoji
 * - 支持全选/清空操作
 * - 支持两种模式：内联（inline）和弹出（popup）
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import React, { useState, useRef, useEffect } from 'react';
import './HierarchicalTagPicker.css';

export interface HierarchicalTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  level?: number; // 层级，0 = 父标签，1 = 子标签，2 = 孙标签...
  parentId?: string;
  calendarId?: string;
}

export interface HierarchicalTagPickerProps {
  /** 可用标签列表 */
  availableTags: HierarchicalTag[];
  /** 已选标签 ID 列表 */
  selectedTagIds: string[];
  /** 选择变化回调 */
  onSelectionChange: (selectedIds: string[]) => void;
  /** 是否多选模式（默认 true） */
  multiSelect?: boolean;
  /** 显示模式：inline（内联）或 popup（弹出） */
  mode?: 'inline' | 'popup';
  /** 占位符文本 */
  placeholder?: string;
  /** 是否显示全选/清空按钮 */
  showBulkActions?: boolean;
  /** 最大选择数量（仅多选模式） */
  maxSelection?: number;
  /** 是否自动聚焦搜索框 */
  autoFocus?: boolean;
  /** 关闭回调（仅 popup 模式） */
  onClose?: () => void;
}

export const HierarchicalTagPicker: React.FC<HierarchicalTagPickerProps> = ({
  availableTags,
  selectedTagIds,
  onSelectionChange,
  multiSelect = true,
  mode = 'inline',
  placeholder = '选择标签...',
  showBulkActions = true,
  maxSelection,
  autoFocus = false,
  onClose
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(mode === 'popup');
  const containerRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉框
  useEffect(() => {
    if (mode === 'inline') {
      const handleClickOutside = (event: MouseEvent) => {
        if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
          setShowDropdown(false);
        }
      };

      if (showDropdown) {
        document.addEventListener('mousedown', handleClickOutside);
      }

      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
      };
    }
  }, [showDropdown, mode]);

  // 过滤标签
  const filteredTags = availableTags.filter(tag =>
    tag.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // 获取标签对象
  const getTagById = (id: string): HierarchicalTag | undefined => {
    return availableTags.find(tag => tag.id === id);
  };

  // 切换标签选择
  const toggleTag = (tagId: string) => {
    if (multiSelect) {
      const isSelected = selectedTagIds.includes(tagId);
      if (isSelected) {
        onSelectionChange(selectedTagIds.filter(id => id !== tagId));
      } else {
        // 检查最大选择数量
        if (maxSelection && selectedTagIds.length >= maxSelection) {
          alert(`最多只能选择 ${maxSelection} 个标签`);
          return;
        }
        onSelectionChange([...selectedTagIds, tagId]);
      }
    } else {
      // 单选模式
      onSelectionChange([tagId]);
      setShowDropdown(false);
      if (mode === 'popup' && onClose) {
        onClose();
      }
    }
  };

  // 移除已选标签（用于 chip）
  const removeTag = (tagId: string, e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onSelectionChange(selectedTagIds.filter(id => id !== tagId));
  };

  // 全选
  const handleSelectAll = () => {
    const allIds = availableTags.map(t => t.id);
    if (maxSelection) {
      onSelectionChange(allIds.slice(0, maxSelection));
    } else {
      onSelectionChange(allIds);
    }
  };

  // 清空
  const handleDeselectAll = () => {
    onSelectionChange([]);
  };

  // Inline 模式渲染
  if (mode === 'inline') {
    return (
      <div className="hierarchical-tag-picker" ref={containerRef}>
        {/* 已选标签 + 搜索框 */}
        <div 
          className="selected-tags-with-search"
          onClick={() => setShowDropdown(true)}
        >
          {selectedTagIds.map(tagId => {
            const tag = getTagById(tagId);
            return tag ? (
              <span 
                key={tagId} 
                className="tag-chip" 
                style={{ backgroundColor: tag.color }}
                onClick={(e) => e.stopPropagation()}
              >
                {tag.emoji && <span className="tag-chip-emoji">{tag.emoji}</span>}
                #{tag.name}
                <button onClick={(e) => removeTag(tagId, e)}>✕</button>
              </span>
            ) : null;
          })}
          <input
            type="text"
            className="tag-search-inline"
            placeholder={selectedTagIds.length === 0 ? placeholder : '搜索...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setShowDropdown(true)}
            onClick={(e) => e.stopPropagation()}
            autoFocus={autoFocus}
          />
        </div>

        {/* 下拉列表 */}
        {showDropdown && (
          <div className="tag-dropdown">
            <div className="tag-dropdown-header">
              <span className="tag-dropdown-title">选择标签</span>
              {showBulkActions && multiSelect && (
                <div className="tag-dropdown-actions">
                  <button onClick={handleSelectAll} type="button">全选</button>
                  <button onClick={handleDeselectAll} type="button">清空</button>
                </div>
              )}
              <button
                className="tag-dropdown-close"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowDropdown(false);
                }}
                type="button"
              >
                ✕
              </button>
            </div>
            <div className="tag-dropdown-list">
              {filteredTags.length > 0 ? (
                filteredTags.map(tag => {
                  const paddingLeft = `${(tag.level || 0) * 12}px`;
                  const isSelected = selectedTagIds.includes(tag.id);
                  
                  return (
                    <label
                      key={tag.id}
                      className={`tag-option ${isSelected ? 'selected' : ''}`}
                    >
                      <input
                        type={multiSelect ? 'checkbox' : 'radio'}
                        checked={isSelected}
                        onChange={() => toggleTag(tag.id)}
                      />
                      <div 
                        className="tag-content"
                        style={{ paddingLeft }}
                        data-level={tag.level || 0}
                      >
                        <span className="tag-color" style={{ color: tag.color }}>#</span>
                        {tag.emoji && <span className="tag-emoji">{tag.emoji}</span>}
                        <span className="tag-name" style={{ color: tag.color }}>{tag.name}</span>
                      </div>
                    </label>
                  );
                })
              ) : (
                <div className="no-tags">没有找到匹配的标签</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Popup 模式渲染（类似 FloatingToolbar 的弹出面板）
  return (
    <div className="hierarchical-tag-picker-popup">
      <div className="popup-header">
        <input
          type="text"
          className="tag-search-input"
          placeholder={placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          autoFocus={autoFocus}
        />
        {showBulkActions && multiSelect && (
          <div className="popup-actions">
            <button onClick={handleSelectAll} type="button">全选</button>
            <button onClick={handleDeselectAll} type="button">清空</button>
          </div>
        )}
        {onClose && (
          <button className="popup-close-btn" onClick={onClose}>
            ✕
          </button>
        )}
      </div>

      {/* 已选标签 */}
      {multiSelect && selectedTagIds.length > 0 && (
        <div className="selected-tags-section">
          <div className="section-title">已选中 ({selectedTagIds.length})</div>
          <div className="selected-tags-list">
            {selectedTagIds.map(tagId => {
              const tag = getTagById(tagId);
              return tag ? (
                <span 
                  key={tagId} 
                  className="tag-chip-small" 
                  style={{ borderColor: tag.color, color: tag.color }}
                >
                  {tag.emoji && <span>{tag.emoji}</span>}
                  #{tag.name}
                  <button onClick={() => removeTag(tagId)}>✕</button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      {/* 可选标签列表 */}
      <div className="popup-tag-list">
        {filteredTags.length > 0 ? (
          filteredTags.map(tag => {
            const paddingLeft = `${(tag.level || 0) * 12}px`;
            const isSelected = selectedTagIds.includes(tag.id);
            
            return (
              <label
                key={tag.id}
                className={`tag-option ${isSelected ? 'selected' : ''}`}
              >
                <input
                  type={multiSelect ? 'checkbox' : 'radio'}
                  checked={isSelected}
                  onChange={() => toggleTag(tag.id)}
                />
                <div 
                  className="tag-content"
                  style={{ paddingLeft }}
                  data-level={tag.level || 0}
                >
                  <span className="tag-color" style={{ color: tag.color }}>#</span>
                  {tag.emoji && <span className="tag-emoji">{tag.emoji}</span>}
                  <span className="tag-name" style={{ color: tag.color }}>{tag.name}</span>
                </div>
              </label>
            );
          })
        ) : (
          <div className="no-tags">没有找到匹配的标签</div>
        )}
      </div>
    </div>
  );
};
