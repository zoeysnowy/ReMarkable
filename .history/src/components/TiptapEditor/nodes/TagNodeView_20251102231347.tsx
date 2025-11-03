import React from 'react';
import { NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import { TagService } from '../../../services/TagService';

/**
 * Tag 节点的 React 渲染组件
 */
export const TagNodeView: React.FC<NodeViewProps> = ({ node, updateAttributes }) => {
  const { tagId, mentionOnly } = node.attrs as { tagId: string; mentionOnly?: boolean };

  // 从节点属性作为初始值，随后与 TagService 对齐
  const initialName = node.attrs.tagName as string;
  const initialColor = (node.attrs.tagColor as string) || '#666';
  const initialEmoji = (node.attrs.tagEmoji as string) || '';

  // 尝试从 TagService 获取最新数据
  const latest = React.useMemo(() => {
    const t = tagId ? TagService.getTagById(tagId) : null;
    return {
      name: t?.name ?? initialName,
      color: t?.color ?? initialColor,
      emoji: t?.emoji ?? initialEmoji,
    };
  }, [tagId, initialName, initialColor, initialEmoji]);

  // 监听 TagService 更新，自动同步节点属性（保持序列化一致）
  React.useEffect(() => {
    const listener = () => {
      const t = tagId ? TagService.getTagById(tagId) : null;
      if (!t) return;
      const nextAttrs: any = {};
      if (t.name && t.name !== node.attrs.tagName) nextAttrs.tagName = t.name;
      if (t.color && t.color !== node.attrs.tagColor) nextAttrs.tagColor = t.color;
      // emoji 允许为空字符串
      if ((t.emoji || '') !== (node.attrs.tagEmoji || '')) nextAttrs.tagEmoji = t.emoji || '';
      if (Object.keys(nextAttrs).length > 0) {
        updateAttributes?.(nextAttrs);
      }
    };
    TagService.addListener(listener as any);
    return () => TagService.removeListener(listener as any);
    // 仅在 tagId 变化时重订阅
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagId]);

  // UI：渲染为 #emojitagname 形式；# 与 name 加粗并采用标签颜色
  return (
    <NodeViewWrapper
      as="span"
      contentEditable={false}
      className={`inline-tag ${mentionOnly ? 'mention-only' : ''}`}
      data-type="tag"
      data-tag-id={tagId}
      data-tag-name={latest.name}
      data-tag-color={latest.color}
      data-tag-emoji={latest.emoji}
      data-mention-only={mentionOnly ? 'true' : 'false'}
      style={{
        display: 'inline',
        margin: '0 2px',
        color: latest.color,
        userSelect: 'none',
      }}
    >
      <span style={{ fontWeight: 700, color: latest.color }}>#</span>
      {latest.emoji && (
        <span style={{ fontWeight: 400 }}>{latest.emoji}</span>
      )}
      <span style={{ fontWeight: 700, color: latest.color }}>{latest.name}</span>
    </NodeViewWrapper>
  );
};
