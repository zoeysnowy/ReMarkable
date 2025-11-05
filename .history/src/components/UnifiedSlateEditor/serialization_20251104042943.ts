/**
 * 序列化/反序列化工具
 * 
 * 负责 Slate 节点 ↔ PlanItem 数组的双向转换
 */

import { Descendant, Text } from 'slate';
import { 
  EventLineNode, 
  ParagraphNode, 
  TextNode, 
  TagNode, 
  DateMentionNode,
  CustomElement,
  EventLineData 
} from './types';

// ==================== PlanItem → Slate 节点 ====================

/**
 * 将 PlanItem 数组转换为 Slate 节点数组
 */
export function planItemsToSlateNodes(items: any[]): Descendant[] {
  const nodes: EventLineNode[] = [];
  
  items.forEach(item => {
    // Title 行
    if (item.content || item.title) {
      const titleNode: EventLineNode = {
        type: 'event-line',
        eventId: item.eventId,
        lineId: item.id,
        level: item.level || 0,
        mode: 'title',
        children: [
          {
            type: 'paragraph',
            children: htmlToSlateFragment(item.content || item.title),
          },
        ],
      };
      nodes.push(titleNode);
    }
    
    // Description 行
    if (item.description) {
      const descNode: EventLineNode = {
        type: 'event-line',
        eventId: item.eventId,
        lineId: `${item.id}-desc`,
        level: item.level || 0,
        mode: 'description',
        children: [
          {
            type: 'paragraph',
            children: htmlToSlateFragment(item.description),
          },
        ],
      };
      nodes.push(descNode);
    }
  });
  
  // 如果没有节点，创建一个空的
  if (nodes.length === 0) {
    nodes.push(createEmptyEventLine());
  }
  
  return nodes;
}

/**
 * 将 HTML 转换为 Slate fragment
 */
function htmlToSlateFragment(html: string): (TextNode | TagNode | DateMentionNode)[] {
  if (!html) return [{ text: '' }];
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const fragment: (TextNode | TagNode | DateMentionNode)[] = [];
  
  function processNode(node: Node): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text) {
        fragment.push({ text });
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      
      // Tag 元素
      if (element.hasAttribute('data-tag-id')) {
        fragment.push({
          type: 'tag',
          tagId: element.getAttribute('data-tag-id') || '',
          tagName: element.getAttribute('data-tag-name') || '',
          tagColor: element.getAttribute('data-tag-color') || undefined,
          tagEmoji: element.getAttribute('data-tag-emoji') || undefined,
          mentionOnly: element.hasAttribute('data-mention-only'),
          children: [{ text: '' }],
        });
      }
      // DateMention 元素
      else if (element.hasAttribute('data-start-date')) {
        fragment.push({
          type: 'dateMention',
          startDate: element.getAttribute('data-start-date') || '',
          endDate: element.getAttribute('data-end-date') || undefined,
          mentionOnly: element.hasAttribute('data-mention-only'),
          children: [{ text: '' }],
        });
      }
      // 格式化文本
      else if (element.tagName === 'STRONG' || element.tagName === 'B') {
        const children: (TextNode | TagNode | DateMentionNode)[] = [];
        element.childNodes.forEach(child => processNode(child));
        // TODO: 处理嵌套格式
      }
      // 递归处理子节点
      else {
        element.childNodes.forEach(child => processNode(child));
      }
    }
  }
  
  tempDiv.childNodes.forEach(node => processNode(node));
  
  return fragment.length > 0 ? fragment : [{ text: '' }];
}

/**
 * 创建空的 EventLine 节点
 */
export function createEmptyEventLine(level: number = 0): EventLineNode {
  return {
    type: 'event-line',
    lineId: `line-${Date.now()}-${Math.random()}`,
    level,
    mode: 'title',
    children: [
      {
        type: 'paragraph',
        children: [{ text: '' }],
      },
    ],
  };
}

// ==================== Slate 节点 → PlanItem ====================

/**
 * 将 Slate 节点数组转换为 PlanItem 数组
 */
export function slateNodesToPlanItems(nodes: Descendant[]): any[] {
  const items: Map<string, any> = new Map();
  
  (nodes as EventLineNode[]).forEach(node => {
    if (node.type !== 'event-line') return;
    
    const baseId = node.lineId.replace('-desc', '');
    
    if (!items.has(baseId)) {
      items.set(baseId, {
        id: baseId,
        eventId: node.eventId,
        level: node.level,
        title: '',
        content: '',
        description: '',
        tags: [],
      });
    }
    
    const item = items.get(baseId)!;
    const html = slateFragmentToHtml(node.children[0].children);
    
    if (node.mode === 'title') {
      item.content = html;
      item.title = extractPlainText(node.children[0].children);
      item.tags = extractTags(node.children[0].children);
    } else {
      item.description = html;
    }
  });
  
  return Array.from(items.values());
}

/**
 * 将 Slate fragment 转换为 HTML
 */
function slateFragmentToHtml(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  return fragment.map(node => {
    if ('text' in node) {
      let text = node.text;
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.strikethrough) text = `<s>${text}</s>`;
      if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
      return text;
    } else if (node.type === 'tag') {
      const attrs = [
        `data-type="tag"`,
        `data-tag-id="${node.tagId}"`,
        `data-tag-name="${node.tagName}"`,
        node.tagColor ? `data-tag-color="${node.tagColor}"` : '',
        node.tagEmoji ? `data-tag-emoji="${node.tagEmoji}"` : '',
        node.mentionOnly ? `data-mention-only="true"` : '',
      ].filter(Boolean).join(' ');
      
      const emoji = node.tagEmoji ? node.tagEmoji + ' ' : '';
      return `<span ${attrs} contenteditable="false" class="inline-tag">${emoji}${node.tagName}</span>`;
    } else if (node.type === 'dateMention') {
      const attrs = [
        `data-type="dateMention"`,
        `data-start-date="${node.startDate}"`,
        node.endDate ? `data-end-date="${node.endDate}"` : '',
        node.mentionOnly ? `data-mention-only="true"` : '',
      ].filter(Boolean).join(' ');
      
      const startDate = new Date(node.startDate);
      const endDate = node.endDate ? new Date(node.endDate) : null;
      const dateText = formatDateForDisplay(startDate, endDate);
      
      return `<span ${attrs} contenteditable="false" class="inline-date">📅 ${dateText}</span>`;
    }
    return '';
  }).join('');
}

/**
 * 提取纯文本
 */
function extractPlainText(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  return fragment.map(node => {
    if ('text' in node) return node.text;
    if (node.type === 'tag') return `#${node.tagName}`;
    if (node.type === 'dateMention') {
      const start = new Date(node.startDate);
      return formatDateForDisplay(start, node.endDate ? new Date(node.endDate) : null);
    }
    return '';
  }).join('');
}

/**
 * 提取标签
 */
function extractTags(fragment: (TextNode | TagNode | DateMentionNode)[]): string[] {
  return fragment
    .filter((node): node is TagNode => node.type === 'tag' && !node.mentionOnly)
    .map(node => node.tagName);
}

/**
 * 格式化日期显示
 */
function formatDateForDisplay(start: Date, end: Date | null): string {
  const formatDate = (d: Date) => {
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${month}-${day}`;
  };
  
  if (end && end.getTime() !== start.getTime()) {
    return `${formatDate(start)} - ${formatDate(end)}`;
  }
  return formatDate(start);
}

// ==================== HTML 复制增强 ====================

/**
 * 将 Slate 节点转换为富文本 HTML（用于跨应用复制）
 */
export function slateNodesToRichHtml(nodes: Descendant[]): string {
  const eventLines = nodes as EventLineNode[];
  
  // 按 level 构建嵌套列表
  const html: string[] = ['<ul style="list-style-type: disc; padding-left: 20px;">'];
  
  eventLines.forEach(node => {
    if (node.type !== 'event-line') return;
    
    const indent = '  '.repeat(node.level);
    const content = slateFragmentToRichHtml(node.children[0].children);
    const style = node.mode === 'description' ? ' style="color: #666; font-size: 0.9em;"' : '';
    
    html.push(`${indent}<li${style}>${content}</li>`);
  });
  
  html.push('</ul>');
  
  return html.join('\n');
}

/**
 * 将 Slate fragment 转换为富文本 HTML
 */
function slateFragmentToRichHtml(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  return fragment.map(node => {
    if ('text' in node) {
      let text = node.text || '';
      if (node.bold) text = `<strong>${text}</strong>`;
      if (node.italic) text = `<em>${text}</em>`;
      if (node.underline) text = `<u>${text}</u>`;
      if (node.strikethrough) text = `<s>${text}</s>`;
      if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
      return text;
    } else if (node.type === 'tag') {
      const emoji = node.tagEmoji ? node.tagEmoji + ' ' : '';
      return `<span style="display: inline-block; padding: 2px 6px; background: ${node.tagColor || '#e5e7eb'}; border-radius: 4px; font-size: 0.85em;">${emoji}#${node.tagName}</span>`;
    } else if (node.type === 'dateMention') {
      const start = new Date(node.startDate);
      const end = node.endDate ? new Date(node.endDate) : null;
      const dateText = formatDateForDisplay(start, end);
      return `<span style="display: inline-block; padding: 2px 6px; background: #dbeafe; border-radius: 4px; font-size: 0.85em;">📅 ${dateText}</span>`;
    }
    return '';
  }).join('');
}

// ==================== HTML 粘贴解析 ====================

/**
 * 从外部 HTML 解析为 Slate 节点（智能识别缩进和日期）
 */
export function parseExternalHtml(html: string): Descendant[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const nodes: EventLineNode[] = [];
  
  // 递归处理列表
  function processList(ul: HTMLElement, level: number = 0): void {
    const items = ul.querySelectorAll(':scope > li');
    items.forEach(li => {
      const content = li.innerHTML;
      const lineId = `line-${Date.now()}-${Math.random()}`;
      
      nodes.push({
        type: 'event-line',
        lineId,
        level,
        mode: 'title',
        children: [
          {
            type: 'paragraph',
            children: parseHtmlFragment(content),
          },
        ],
      });
      
      // 处理嵌套列表
      const nestedUl = li.querySelector(':scope > ul');
      if (nestedUl) {
        processList(nestedUl as HTMLElement, level + 1);
      }
    });
  }
  
  // 查找列表
  const ul = tempDiv.querySelector('ul');
  if (ul) {
    processList(ul);
  } else {
    // 没有列表，处理段落
    const paragraphs = tempDiv.querySelectorAll('p');
    if (paragraphs.length > 0) {
      paragraphs.forEach(p => {
        nodes.push({
          type: 'event-line',
          lineId: `line-${Date.now()}-${Math.random()}`,
          level: 0,
          mode: 'title',
          children: [
            {
              type: 'paragraph',
              children: parseHtmlFragment(p.innerHTML),
            },
          ],
        });
      });
    } else {
      // 纯文本
      nodes.push({
        type: 'event-line',
        lineId: `line-${Date.now()}-${Math.random()}`,
        level: 0,
        mode: 'title',
        children: [
          {
            type: 'paragraph',
            children: parseHtmlFragment(tempDiv.innerHTML),
          },
        ],
      });
    }
  }
  
  return nodes.length > 0 ? nodes : [createEmptyEventLine()];
}

/**
 * 解析 HTML fragment（保留格式，智能识别日期）
 */
function parseHtmlFragment(html: string): (TextNode | TagNode | DateMentionNode)[] {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const fragment: (TextNode | TagNode | DateMentionNode)[] = [];
  
  function processNode(node: Node, formats: Partial<TextNode> = {}): void {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || '';
      if (text.trim()) {
        // 尝试智能识别日期
        const dateMatch = text.match(/(\d{4}[-/]\d{1,2}[-/]\d{1,2})/);
        if (dateMatch) {
          const beforeDate = text.substring(0, dateMatch.index);
          const dateStr = dateMatch[1];
          const afterDate = text.substring(dateMatch.index! + dateStr.length);
          
          if (beforeDate) fragment.push({ text: beforeDate, ...formats });
          
          fragment.push({
            type: 'dateMention',
            startDate: new Date(dateStr).toISOString(),
            children: [{ text: '' }],
          });
          
          if (afterDate) fragment.push({ text: afterDate, ...formats });
        } else {
          fragment.push({ text, ...formats });
        }
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      const newFormats = { ...formats };
      
      if (element.tagName === 'STRONG' || element.tagName === 'B') {
        newFormats.bold = true;
      } else if (element.tagName === 'EM' || element.tagName === 'I') {
        newFormats.italic = true;
      } else if (element.tagName === 'U') {
        newFormats.underline = true;
      } else if (element.tagName === 'S' || element.tagName === 'DEL') {
        newFormats.strikethrough = true;
      }
      
      element.childNodes.forEach(child => processNode(child, newFormats));
    }
  }
  
  tempDiv.childNodes.forEach(node => processNode(node));
  
  return fragment.length > 0 ? fragment : [{ text: '' }];
}
