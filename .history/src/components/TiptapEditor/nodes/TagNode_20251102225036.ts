import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import { TagNodeView } from './TagNodeView';

export interface TagAttributes {
  tagId: string;
  tagName: string;
  tagColor?: string;
  tagEmoji?: string;
  mentionOnly?: boolean;
}

/**
 * Tag 自定义节点
 * 
 * 特性：
 * - 可交互的标签胶囊
 * - 支持颜色、Emoji
 * - 可点击编辑/删除
 * - 在 Title 模式关联到元数据，在 Description 模式仅为 mention
 */
export const TagNode = Node.create({
  name: 'tag',
  
  group: 'inline',
  
  inline: true,
  
  atom: true, // 不可分割的原子节点
  
  addAttributes() {
    return {
      tagId: {
        default: null,
        parseHTML: element => element.getAttribute('data-tag-id'),
        renderHTML: attributes => {
          if (!attributes.tagId) {
            return {};
          }
          return {
            'data-tag-id': attributes.tagId,
          };
        },
      },
      tagName: {
        default: '',
        parseHTML: element => element.getAttribute('data-tag-name'),
        renderHTML: attributes => {
          return {
            'data-tag-name': attributes.tagName,
          };
        },
      },
      tagColor: {
        default: '#666',
        parseHTML: element => element.getAttribute('data-tag-color'),
        renderHTML: attributes => {
          return {
            'data-tag-color': attributes.tagColor,
          };
        },
      },
      tagEmoji: {
        default: '',
        parseHTML: element => element.getAttribute('data-tag-emoji'),
        renderHTML: attributes => {
          return {
            'data-tag-emoji': attributes.tagEmoji,
          };
        },
      },
      mentionOnly: {
        default: false,
        parseHTML: element => element.getAttribute('data-mention-only') === 'true',
        renderHTML: attributes => {
          return {
            'data-mention-only': attributes.mentionOnly ? 'true' : 'false',
          };
        },
      },
    };
  },
  
  parseHTML() {
    return [
      {
        tag: 'span[data-type="tag"]',
      },
    ];
  },
  
  renderHTML({ HTMLAttributes }) {
    // 叶子节点（atom）不允许内容孔（0），只返回包裹元素
    const classes = ['inline-tag'];
    if (HTMLAttributes['data-mention-only'] === 'true') {
      classes.push('mention-only');
    }
    return ['span', mergeAttributes(HTMLAttributes, { 'data-type': 'tag', class: classes.join(' ') })];
  },
  
  // 使用 React 组件渲染
  addNodeView() {
    return ReactNodeViewRenderer(TagNodeView);
  },
});
