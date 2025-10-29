/**
 * EmojiPickerPanel - Emoji 选择器
 */

import React, { useState } from 'react';
import './EmojiPickerPanel.css';

interface EmojiPickerPanelProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

// 常用 Emoji 分类
const EMOJI_CATEGORIES = {
  常用: ['😊', '😂', '❤️', '👍', '🎉', '🔥', '✨', '💡', '🚀', '⭐'],
  表情: ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😌', '😍', '🥰', '😘'],
  手势: ['👋', '🤚', '🖐', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉'],
  物品: ['📱', '💻', '⌨️', '🖥', '🖨', '🖱', '📷', '📹', '🎥', '📞', '☎️', '📠', '📺', '📻', '🎙'],
  符号: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗'],
};

export const EmojiPickerPanel: React.FC<EmojiPickerPanelProps> = ({
  onSelect,
  onClose,
}) => {
  const [activeCategory, setActiveCategory] = useState<string>('常用');

  return (
    <div className="emoji-picker-panel">
      <div className="picker-header">
        <span className="picker-title">选择 Emoji</span>
        <button className="picker-close-btn" onClick={onClose}>
          ✕
        </button>
      </div>

      {/* 分类标签 */}
      <div className="emoji-categories">
        {Object.keys(EMOJI_CATEGORIES).map((category) => (
          <button
            key={category}
            className={`category-btn ${activeCategory === category ? 'active' : ''}`}
            onClick={() => setActiveCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji 网格 */}
      <div className="emoji-grid">
        {EMOJI_CATEGORIES[activeCategory as keyof typeof EMOJI_CATEGORIES].map((emoji) => (
          <button
            key={emoji}
            className="emoji-item"
            onClick={() => onSelect(emoji)}
            title={emoji}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
};
