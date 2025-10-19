import React, { useState } from 'react';

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
  position: { x: number; y: number };
  isVisible: boolean;
}

// 完整的Emoji选择器组件 - 带有多个分类tab
const EmojiPicker: React.FC<EmojiPickerProps> = ({ 
  onSelect, 
  onClose, 
  position, 
  isVisible 
}) => {
  const emojiCategories = {
    '常用': [
      '😀', '😃', '😄', '😊', '😍', '🤔', '😢', '😂', '❤️', '👍', 
      '👎', '✨', '🎉', '🚀', '💻', '📱', '🎯', '⭐', '🔥', '💡'
    ],
    '表情': [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇',
      '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚',
      '😋', '😛', '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩',
      '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣',
      '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬'
    ],
    '手势': [
      '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉',
      '👆', '🖕', '👇', '☝️', '👋', '🤚', '🖐', '✋', '🖖', '👏',
      '🙌', '👐', '🤲', '🙏', '✍️', '💪', '🦵', '🦶', '👂', '👃'
    ],
    '活动': [
      '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
      '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
      '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️'
    ],
    '工作': [
      '💻', '📱', '⌨️', '🖥️', '🖨️', '🖱️', '🖲️', '🕹️', '📀', '💿',
      '💾', '💽', '📼', '📷', '📸', '📹', '🎥', '📽️', '🎞️', '📞',
      '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️', '🧮', '💡'
    ],
    '生活': [
      '🏠', '🏡', '🏘️', '🏚️', '🏗️', '🏭', '🏢', '🏬', '🏣', '🏤',
      '🏥', '🏦', '🏨', '🏪', '🏫', '🏩', '💒', '🏛️', '⛪', '🕌',
      '🛍️', '🛒', '🍱', '🍕', '🍔', '🍟', '🌭', '🥪', '🌮', '🌯'
    ],
    '符号': [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
      '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
      '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐'
    ]
  };

  const [activeCategory, setActiveCategory] = useState('常用');

  if (!isVisible) return null;

  return (
    <div 
      style={{ 
        position: 'fixed', 
        left: 0,
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        backgroundColor: 'rgba(0, 0, 0, 0.3)'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          position: 'absolute',
          left: Math.min(position.x, window.innerWidth - 360),
          top: Math.min(position.y, window.innerHeight - 450),
          width: '360px',
          height: '450px',
          backgroundColor: 'white',
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 10px 40px rgba(0, 0, 0, 0.15)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{
          padding: '16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: '#f8fafc'
        }}>
          <span style={{ fontWeight: '600', fontSize: '16px' }}>选择表情</span>
          <button onClick={onClose} style={{
            background: 'none',
            border: 'none',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            color: '#64748b',
            borderRadius: '4px'
          }}>×</button>
        </div>
        
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid #e2e8f0', 
          padding: '12px 16px',
          backgroundColor: '#fafafa',
          overflowX: 'auto'
        }}>
          {Object.keys(emojiCategories).map(category => (
            <button
              key={category}
              onClick={() => setActiveCategory(category)}
              style={{
                padding: '6px 12px',
                margin: '0 4px',
                border: 'none',
                borderRadius: '6px',
                background: activeCategory === category ? '#3b82f6' : 'transparent',
                color: activeCategory === category ? 'white' : '#64748b',
                cursor: 'pointer',
                fontSize: '12px',
                fontWeight: '500',
                whiteSpace: 'nowrap',
                transition: 'all 0.2s'
              }}
            >
              {category}
            </button>
          ))}
        </div>
        
        <div 
          style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(8, 1fr)', 
            gap: '4px', 
            padding: '16px',
            maxHeight: '320px',
            overflowY: 'auto',
            width: '100%'
          }}
        >
          {emojiCategories[activeCategory as keyof typeof emojiCategories].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => {
                onSelect(emoji);
                onClose();
              }}
              style={{
                width: '36px',
                height: '36px',
                padding: '4px',
                border: 'none',
                borderRadius: '6px',
                background: 'transparent',
                fontSize: '20px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.transform = 'scale(1.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
                e.currentTarget.style.transform = 'scale(1)';
              }}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default EmojiPicker;