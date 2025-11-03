import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';

/**
 * Tag 节点的 React 渲染组件
 */
export const TagNodeView: React.FC<NodeViewProps> = ({ node, deleteNode }) => {
  const { tagId, tagName, tagColor, tagEmoji, mentionOnly } = node.attrs;
  
  // 将颜色转换为 rgba
  const hexToRgba = (hex: string, alpha: number) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const displayName = tagEmoji ? `${tagEmoji}${tagName}` : tagName;
  
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`inline-tag ${mentionOnly ? 'mention-only' : ''}`}
      data-type="tag"
      data-tag-id={tagId}
      data-tag-name={tagName}
      data-tag-color={tagColor}
      data-tag-emoji={tagEmoji}
      data-mention-only={mentionOnly ? 'true' : 'false'}
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        margin: '0 2px',
        borderRadius: '4px',
        fontSize: '12px',
        fontWeight: 500,
        backgroundColor: hexToRgba(tagColor, 0.15),
        color: tagColor,
        border: `1px solid ${hexToRgba(tagColor, 0.3)}`,
        cursor: 'pointer',
        userSelect: 'none',
      }}
      onClick={(e: React.MouseEvent) => {
        e.stopPropagation();
        // 触发标签替换事件
        const event = new CustomEvent('tagClick', {
          detail: { tagId: node.attrs.tagId }
        });
        window.dispatchEvent(event);
      }}
    >
      {displayName}
      <span
        style={{
          marginLeft: '4px',
          opacity: 0.6,
          fontSize: '10px',
        }}
        onClick={(e: React.MouseEvent) => {
          e.stopPropagation();
          deleteNode();
        }}
      >
        ×
      </span>
    </NodeViewWrapper>
  );
};
