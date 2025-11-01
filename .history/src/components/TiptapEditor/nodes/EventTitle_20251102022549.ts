import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

/**
 * EventTitle 节点
 * 
 * 特性：
 * - 纯文本输入（不支持富文本）
 * - Enter 提交事件
 * - Shift+Enter 切换到 Description
 * - 不允许换行
 */
export const EventTitle = Node.create({
  name: 'eventTitle',
  
  group: 'block',
  
  content: 'inline*', // 只允许内联内容，不允许块级元素
  
  parseHTML() {
    return [
      {
        tag: 'div[data-type="event-title"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'event-title' }), 0];
  },
  
  addKeyboardShortcuts() {
    return {
      // Enter: 提交事件
      'Enter': () => {
        // 触发自定义事件，由父组件处理
        const event = new CustomEvent('submitEvent', {
          detail: { content: this.editor.getHTML() }
        });
        window.dispatchEvent(event);
        return true; // 阻止默认换行
      },
      
      // Shift+Enter: 切换到 Description
      'Shift-Enter': () => {
        const event = new CustomEvent('switchToDescription');
        window.dispatchEvent(event);
        return true;
      },
    };
  },
});
