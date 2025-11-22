/**
 * LightSlateEditor 序列化工具
 * 简化版本，专用于单内容编辑场景
 */

import { Descendant, Text } from 'slate';
import { 
  ParagraphNode, 
  CustomElement,
  TimestampDividerElement,
  TagNode,
  EmojiNode,
  DateMentionNode
} from '../UnifiedSlateEditor/types';

/**
 * 将 HTML 字符串转换为 Slate nodes
 * 简化版本：主要处理段落、timestamp、inline elements
 */
export function htmlToSlateNodes(html: string): Descendant[] {
  if (!html?.trim()) {
    return [{
      type: 'paragraph',
      children: [{ text: '' }]
    } as ParagraphNode];
  }

  // TODO: 实现完整的 HTML 解析
  // 当前简化实现：将 HTML 按行分割处理
  const lines = html.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    return [{
      type: 'paragraph',
      children: [{ text: '' }]
    } as ParagraphNode];
  }

  return lines.map(line => {
    // 移除基本的 HTML 标签（简化处理）
    const cleanText = line
      .replace(/<[^>]*>/g, '') // 移除所有HTML标签
      .trim();
    
    return {
      type: 'paragraph',
      children: [{ text: cleanText }]
    } as ParagraphNode;
  });
}

/**
 * 将 Slate nodes 转换为 HTML 字符串
 */
export function slateNodesToHtml(nodes: Descendant[]): string {
  return nodes
    .map(node => {
      if ('type' in node) {
        switch (node.type) {
          case 'paragraph':
            const text = extractTextFromNode(node);
            return text ? `<p>${text}</p>` : '';
          
          case 'timestamp-divider':
            const timestampElement = node as TimestampDividerElement;
            return `<div class="timestamp-divider" data-timestamp="${timestampElement.timestamp}">${timestampElement.displayText || new Date(timestampElement.timestamp).toLocaleString()}</div>`;
          
          case 'tag':
            const tagElement = node as TagNode;
            return `<span class="tag" data-tag-id="${tagElement.tagId}">${tagElement.name}</span>`;
          
          case 'emoji':
            const emojiElement = node as EmojiNode;
            return emojiElement.emoji;
          
          case 'date-mention':
            const dateElement = node as DateMentionNode;
            return `<span class="date-mention" data-date="${dateElement.date}">${dateElement.displayText || dateElement.text}</span>`;
          
          default:
            return extractTextFromNode(node);
        }
      }
      
      return Text.isText(node) ? node.text : '';
    })
    .filter(html => html.trim())
    .join('\n');
}

/**
 * 从节点中提取纯文本
 */
function extractTextFromNode(node: any): string {
  if (Text.isText(node)) {
    return node.text;
  }
  
  if ('children' in node && Array.isArray(node.children)) {
    return node.children
      .map((child: any) => extractTextFromNode(child))
      .join('');
  }
  
  return '';
}

/**
 * 将 Slate nodes 转换为纯文本（用于搜索等场景）
 */
export function slateNodesToPlainText(nodes: Descendant[]): string {
  return nodes
    .map(node => extractTextFromNode(node))
    .filter(text => text.trim())
    .join('\n');
}