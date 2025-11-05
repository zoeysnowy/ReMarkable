/**
 * Slate → Unified Document 转换器
 * 
 * 将Slate.js的数据格式转换为统一的中间格式
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

import { Descendant, Text, Element as SlateElement } from 'slate';
import {
  UnifiedDocument,
  UnifiedNode,
  UnifiedParagraphNode,
  UnifiedTextNode,
  UnifiedTagNode,
  UnifiedDateMentionNode,
  UnifiedEmojiNode,
  UnifiedContextMarkerNode,
  TextStyle,
} from '../types/unified-document';

/**
 * 转换Slate文档为统一格式
 */
export function slateToUnified(slateNodes: Descendant[]): UnifiedDocument {
  return {
    version: '1.0',
    metadata: {
      createdAt: new Date().toISOString(),
    },
    content: slateNodes.map(convertSlateNode).filter(Boolean) as UnifiedNode[],
  };
}

/**
 * 转换单个Slate节点
 */
function convertSlateNode(node: Descendant): UnifiedNode | null {
  // 文本节点
  if (Text.isText(node)) {
    const style: TextStyle = {};
    if (node.bold) style.bold = true;
    if (node.italic) style.italic = true;
    if (node.underline) style.underline = true;
    if (node.strikethrough) style.strikethrough = true;
    if (node.code) style.code = true;

    return {
      type: 'text',
      text: node.text,
      ...(Object.keys(style).length > 0 && { style }),
    } as UnifiedTextNode;
  }

  // 元素节点
  const element = node as SlateElement;

  switch (element.type) {
    case 'paragraph':
      return {
        type: 'paragraph',
        children: element.children.map(convertSlateNode).filter(Boolean),
      } as UnifiedParagraphNode;

    case 'tag':
      return {
        type: 'tag',
        tagId: (element as any).tagId || '',
        tagName: (element as any).tagName || '',
        tagColor: (element as any).tagColor || '#000000',
        tagEmoji: (element as any).tagEmoji,
      } as UnifiedTagNode;

    case 'date-mention':
      return {
        type: 'date-mention',
        dateString: (element as any).dateString || '',
        parsedDate: (element as any).parsedDate,
      } as UnifiedDateMentionNode;

    case 'emoji':
      return {
        type: 'emoji',
        emoji: (element as any).emoji || '',
        native: (element as any).native || '',
      } as UnifiedEmojiNode;

    case 'context-marker':
      return {
        type: 'context-marker',
        timestamp: (element as any).timestamp || new Date().toISOString(),
        activities: (element as any).activities || [],
        compressed: (element as any).compressed,
      } as UnifiedContextMarkerNode;

    default:
      console.warn('[slateToUnified] Unknown node type:', element.type);
      return null;
  }
}

/**
 * 提取纯文本内容（用于搜索、预览等）
 */
export function extractPlainText(slateNodes: Descendant[]): string {
  return slateNodes
    .map((node) => {
      if (Text.isText(node)) {
        return node.text;
      }
      const element = node as SlateElement;
      if (element.children) {
        return extractPlainText(element.children);
      }
      return '';
    })
    .join('');
}

/**
 * 提取所有标签（用于搜索、筛选）
 */
export function extractTags(slateNodes: Descendant[]): UnifiedTagNode[] {
  const tags: UnifiedTagNode[] = [];

  function traverse(nodes: Descendant[]) {
    for (const node of nodes) {
      if (!Text.isText(node)) {
        const element = node as SlateElement;
        if (element.type === 'tag') {
          tags.push({
            type: 'tag',
            tagId: (element as any).tagId || '',
            tagName: (element as any).tagName || '',
            tagColor: (element as any).tagColor || '#000000',
            tagEmoji: (element as any).tagEmoji,
          });
        }
        if (element.children) {
          traverse(element.children);
        }
      }
    }
  }

  traverse(slateNodes);
  return tags;
}

/**
 * 提取所有时间标记（用于时间轴可视化）
 */
export function extractContextMarkers(
  slateNodes: Descendant[]
): UnifiedContextMarkerNode[] {
  const markers: UnifiedContextMarkerNode[] = [];

  for (const node of slateNodes) {
    if (!Text.isText(node)) {
      const element = node as SlateElement;
      if (element.type === 'context-marker') {
        markers.push({
          type: 'context-marker',
          timestamp: (element as any).timestamp || new Date().toISOString(),
          activities: (element as any).activities || [],
          compressed: (element as any).compressed,
        });
      }
    }
  }

  return markers;
}
