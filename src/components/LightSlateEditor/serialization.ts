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
 * 将 Slate JSON 字符串转换为 Slate nodes
 * 处理从 eventlog 字段读取的 JSON 数据
 */
export function jsonToSlateNodes(slateJson: string): Descendant[] {
  // 处理空值或空字符串
  if (!slateJson?.trim()) {
    console.log('[LightSlateEditor] 空内容，返回默认段落');
    return [{
      type: 'paragraph',
      children: [{ text: '' }]
    } as ParagraphNode];
  }

  try {
    // 尝试解析 JSON
    const parsed = JSON.parse(slateJson);
    
    // 如果是数组
    if (Array.isArray(parsed)) {
      // 验证数组内容，确保每个节点都有有效的结构
      if (parsed.length === 0) {
        console.log('[LightSlateEditor] 空数组，返回默认段落');
        return [{
          type: 'paragraph',
          children: [{ text: '' }]
        } as ParagraphNode];
      }
      
      // 验证并修复每个节点
      const validatedNodes = parsed.map((node, index) => {
        if (typeof node !== 'object' || node === null) {
          console.warn(`[LightSlateEditor] 节点 ${index} 无效，转换为段落:`, node);
          return {
            type: 'paragraph',
            children: [{ text: String(node) }]
          } as ParagraphNode;
        }
        
        // 确保节点有 type 和 children
        if (!node.type) {
          node.type = 'paragraph';
        }
        
        if (!node.children || !Array.isArray(node.children)) {
          node.children = [{ text: '' }];
        }
        
        // 确保 children 中至少有一个文本节点
        if (node.children.length === 0) {
          node.children = [{ text: '' }];
        }
        
        return node;
      });
      
      console.log('[LightSlateEditor] 解析 JSON 成功，节点数量:', validatedNodes.length);
      return validatedNodes as Descendant[];
    }
    
    // 如果是单个对象，包装成数组
    if (typeof parsed === 'object' && parsed !== null) {
      const node = { ...parsed };
      
      // 确保节点结构有效
      if (!node.type) {
        node.type = 'paragraph';
      }
      if (!node.children || !Array.isArray(node.children)) {
        node.children = [{ text: '' }];
      }
      
      console.log('[LightSlateEditor] 单个对象转换为节点数组');
      return [node] as Descendant[];
    }
    
    // 其他情况，作为纯文本处理
    console.log('[LightSlateEditor] 非对象类型，转换为文本段落:', typeof parsed);
    return [{
      type: 'paragraph',
      children: [{ text: String(parsed) }]
    } as ParagraphNode];
    
  } catch (error) {
    console.warn('[LightSlateEditor] JSON 解析失败，作为纯文本处理:', error);
    
    // JSON 解析失败，作为纯文本处理
    return [{
      type: 'paragraph',
      children: [{ text: slateJson }]
    } as ParagraphNode];
  }
}

/**
 * 将 Slate nodes 转换为 JSON 字符串
 * 保存到 eventlog 字段
 */
export function slateNodesToJson(nodes: Descendant[]): string {
  try {
    return JSON.stringify(nodes, null, 0); // 紧凑格式
  } catch (error) {
    console.error('[LightSlateEditor] Slate nodes 序列化失败:', error);
    return '[]'; // 返回空数组的 JSON
  }
}

/**
 * 将 Slate nodes 转换为 HTML 字符串（用于 description 字段同步）
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