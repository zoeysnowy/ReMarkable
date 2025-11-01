import { Node, mergeAttributes } from '@tiptap/core';

/**
 * EventDescription 节点
 * 
 * 特性：
 * - 富文本编辑（Bullet Points、颜色等）
 * - 支持多行（Enter 换行）
 * - Shift+Enter 返回 Title
 */
export const EventDescription = Node.create({
  name: 'eventDescription',
  
  group: 'block',
  
  content: 'block+', // 允许多个块级元素
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="event-description"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return [
      'div', 
      mergeAttributes(HTMLAttributes, { 
        'data-type': 'event-description',
        style: 'font-size: 13px; color: #6b7280; font-style: italic; padding-left: 24px;'
      }), 
      0
    ];
  },
  
  addKeyboardShortcuts() {
    return {
      // Shift+Enter: 返回 Title
      'Shift-Enter': () => {
        const event = new CustomEvent('switchToTitle');
        window.dispatchEvent(event);
        return true;
      },
    };
  },
});
