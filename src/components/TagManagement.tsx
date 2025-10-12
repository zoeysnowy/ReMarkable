// 🎨 标签管理页面 - 渐进式开发模板

import React, { useState, useRef } from 'react';
import './TagManagement.css';

// 基础数据结构（基于现有的TagService）
interface Tag {
  id: string;
  name: string;
  emoji?: string;
  color?: string;
  children?: Tag[];
  calendarMapping?: {
    calendarId: string;
    calendarName: string;
  };
}

const TagManagement: React.FC = () => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [editingTag, setEditingTag] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // TODO: 从 TagService 加载实际数据
  const loadTags = () => {
    // if (window.TagService) {
    //   const hierarchicalTags = window.TagService.getHierarchicalTags();
    //   setTags(hierarchicalTags);
    // }
  };

  return (
    <div className="tag-management">
      {/* 页面头部 - 请在Figma中复制具体样式 */}
      <div className="tag-management__header">
        <h1 className="tag-management__title">
          标签管理
        </h1>
        
        {/* 主要操作按钮 - 请从Figma复制按钮样式 */}
        <button 
          className="tag-management__add-button"
          onClick={() => setIsAddingTag(true)}
        >
          {/* 请替换为Figma中的具体图标和文本 */}
          + 添加标签
        </button>
      </div>

      {/* 标签列表区域 */}
      <div className="tag-management__content">
        {/* 标签树形结构 */}
        <div className="tag-tree">
          {tags.map(tag => (
            <TagNode 
              key={tag.id}
              tag={tag}
              level={0}
              isEditing={editingTag === tag.id}
              onEdit={(id) => setEditingTag(id)}
              onSave={() => setEditingTag(null)}
              onCancel={() => setEditingTag(null)}
            />
          ))}
        </div>

        {/* 空状态 - 请从Figma复制空状态设计 */}
        {tags.length === 0 && (
          <div className="tag-tree__empty">
            {/* 请替换为Figma中的空状态内容 */}
            <p>还没有标签，点击"添加标签"开始吧</p>
          </div>
        )}
      </div>

      {/* 添加标签模态框 - 请从Figma复制模态框样式 */}
      {isAddingTag && (
        <TagCreator 
          onSave={() => setIsAddingTag(false)}
          onCancel={() => setIsAddingTag(false)}
        />
      )}

      {/* 表情选择器 - 请从Figma复制选择器样式 */}
      {showEmojiPicker && (
        <EmojiPicker 
          onSelect={() => setShowEmojiPicker(false)}
          onClose={() => setShowEmojiPicker(false)}
        />
      )}
    </div>
  );
};

// 标签节点组件
const TagNode: React.FC<{
  tag: Tag;
  level: number;
  isEditing: boolean;
  onEdit: (id: string) => void;
  onSave: () => void;
  onCancel: () => void;
}> = ({ tag, level, isEditing, onEdit, onSave, onCancel }) => {
  return (
    <div className={`tag-node tag-node--level-${level}`}>
      {/* 标签项内容 - 请从Figma复制具体布局 */}
      <div className="tag-item">
        {/* 拖拽手柄 - 如果Figma中有的话 */}
        <div className="tag-item__drag-handle">
          ⋮⋮
        </div>

        {/* 标签图标/表情 */}
        <div className="tag-item__icon">
          {tag.emoji || '📁'}
        </div>

        {/* 标签名称 */}
        {isEditing ? (
          <input 
            className="tag-item__name-input"
            defaultValue={tag.name}
            autoFocus
          />
        ) : (
          <span className="tag-item__name">
            {tag.name}
          </span>
        )}

        {/* 标签颜色指示器 */}
        {tag.color && (
          <div 
            className="tag-item__color"
            style={{ backgroundColor: tag.color }}
          />
        )}

        {/* 操作按钮组 - 请从Figma复制按钮样式和布局 */}
        <div className="tag-item__actions">
          {isEditing ? (
            <>
              <button className="tag-action tag-action--save" onClick={onSave}>
                ✓
              </button>
              <button className="tag-action tag-action--cancel" onClick={onCancel}>
                ✕
              </button>
            </>
          ) : (
            <>
              <button className="tag-action tag-action--edit" onClick={() => onEdit(tag.id)}>
                ✏️
              </button>
              <button className="tag-action tag-action--delete">
                🗑️
              </button>
            </>
          )}
        </div>
      </div>

      {/* 子标签 */}
      {tag.children && tag.children.length > 0 && (
        <div className="tag-children">
          {tag.children.map(child => (
            <TagNode 
              key={child.id}
              tag={child}
              level={level + 1}
              isEditing={false}
              onEdit={onEdit}
              onSave={onSave}
              onCancel={onCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
};

// 标签创建器组件
const TagCreator: React.FC<{
  onSave: () => void;
  onCancel: () => void;
}> = ({ onSave, onCancel }) => {
  return (
    <div className="tag-creator-overlay">
      <div className="tag-creator">
        {/* 请从Figma复制具体的表单布局和样式 */}
        <h3>添加新标签</h3>
        
        <div className="form-group">
          <label>标签名称</label>
          <input type="text" placeholder="输入标签名称" />
        </div>

        <div className="form-group">
          <label>选择图标</label>
          <button className="emoji-picker-trigger">📁</button>
        </div>

        <div className="form-group">
          <label>选择颜色</label>
          <div className="color-picker">
            {/* 颜色选择器 */}
          </div>
        </div>

        <div className="form-actions">
          <button onClick={onCancel}>取消</button>
          <button onClick={onSave} className="primary">保存</button>
        </div>
      </div>
    </div>
  );
};

// 表情选择器组件
const EmojiPicker: React.FC<{
  onSelect: (emoji: string) => void;
  onClose: () => void;
}> = ({ onSelect, onClose }) => {
  return (
    <div className="emoji-picker-overlay">
      <div className="emoji-picker">
        {/* 请从Figma复制表情选择器的具体设计 */}
        <div className="emoji-picker__header">
          <h4>选择图标</h4>
          <button onClick={onClose}>✕</button>
        </div>
        
        <div className="emoji-picker__search">
          <input type="text" placeholder="搜索图标..." />
        </div>
        
        <div className="emoji-picker__content">
          {/* 表情网格 */}
        </div>
      </div>
    </div>
  );
};

export default TagManagement;