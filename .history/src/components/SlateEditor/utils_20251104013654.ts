/**
 * Slate Editor 工具函数
 * 
 * 提供序列化、反序列化和常用操作
 */

import { Editor, Element, Text, Transforms, Node, Path, Range } from 'slate';
import { CustomElement, CustomText, TagElement, DateMentionElement } from './types';

/**
 * 将 Slate 内容序列化为 HTML
 */
export const serializeToHtml = (nodes: any[]): string => {
  return nodes.map(node => serializeNode(node)).join('');
};

const serializeNode = (node: any): string => {
  if (Text.isText(node)) {
    let text = escapeHtml(node.text);
    
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.strikethrough) text = `<s>${text}</s>`;
    if (node.code) text = `<code>${text}</code>`;
    if (node.color) text = `<span style="color: ${node.color}">${text}</span>`;
    
    return text;
  }

  const children = node.children.map((n: any) => serializeNode(n)).join('');

  switch (node.type) {
    case 'paragraph':
      return `<p>${children}</p>`;
      
    case 'tag':
      return `<span data-type="tag" data-tag-id="${node.tagId}" data-tag-name="${escapeHtml(node.tagName)}" data-tag-color="${node.tagColor || '#666'}" data-tag-emoji="${escapeHtml(node.tagEmoji || '')}" data-mention-only="${node.mentionOnly ? 'true' : 'false'}" class="inline-tag ${node.mentionOnly ? 'mention-only' : ''}" contenteditable="false">#${node.tagEmoji || ''}${escapeHtml(node.tagName)}</span>`;
      
    case 'dateMention':
      return `<span data-type="date-mention" data-date="${node.date}" contenteditable="false">${escapeHtml(node.displayText)}</span>`;
      
    default:
      return children;
  }
};

/**
 * 将 HTML 反序列化为 Slate 内容
 */
export const deserializeFromHtml = (html: string): any[] => {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return deserializeElement(doc.body);
};

const deserializeElement = (el: HTMLElement): any[] => {
  if (el.nodeType === Node.TEXT_NODE) {
    return [{ text: el.textContent || '' }];
  }

  const nodeName = el.nodeName.toLowerCase();
  let children: any[] = Array.from(el.childNodes).flatMap(node => 
    deserializeElement(node as HTMLElement)
  );

  if (children.length === 0) {
    children = [{ text: '' }];
  }

  // 处理特殊节点
  if (el.getAttribute('data-type') === 'tag') {
    return [{
      type: 'tag',
      tagId: el.getAttribute('data-tag-id') || '',
      tagName: el.getAttribute('data-tag-name') || '',
      tagColor: el.getAttribute('data-tag-color') || '#666',
      tagEmoji: el.getAttribute('data-tag-emoji') || '',
      mentionOnly: el.getAttribute('data-mention-only') === 'true',
      children: [{ text: '' }],
    }];
  }

  if (el.getAttribute('data-type') === 'date-mention') {
    return [{
      type: 'dateMention',
      date: el.getAttribute('data-date') || '',
      displayText: el.textContent || '',
      children: [{ text: '' }],
    }];
  }

  // 处理格式化标签
  switch (nodeName) {
    case 'strong':
    case 'b':
      return children.map(child => ({ ...child, bold: true }));
    case 'em':
    case 'i':
      return children.map(child => ({ ...child, italic: true }));
    case 'u':
      return children.map(child => ({ ...child, underline: true }));
    case 's':
    case 'del':
      return children.map(child => ({ ...child, strikethrough: true }));
    case 'code':
      return children.map(child => ({ ...child, code: true }));
    case 'span':
      const color = el.style.color;
      if (color) {
        return children.map(child => ({ ...child, color }));
      }
      return children;
    case 'p':
      return [{ type: 'paragraph', children }];
    case 'br':
      return [{ text: '\n' }];
    default:
      return children;
  }
};

/**
 * 转义 HTML 特殊字符
 */
const escapeHtml = (text: string): string => {
  const map: { [key: string]: string } = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, m => map[m]);
};

/**
 * 插入 Tag 节点
 */
export const insertTag = (
  editor: Editor,
  tag: { id: string; name: string; color?: string; emoji?: string; mentionOnly?: boolean }
) => {
  const tagNode: TagElement = {
    type: 'tag',
    tagId: tag.id,
    tagName: tag.name,
    tagColor: tag.color || '#666',
    tagEmoji: tag.emoji || '',
    mentionOnly: tag.mentionOnly || false,
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, tagNode);
  Transforms.move(editor); // 将光标移到 tag 之后
};

/**
 * 插入 Date Mention 节点
 */
export const insertDateMention = (
  editor: Editor,
  date: string,
  displayText: string
) => {
  const dateMentionNode: DateMentionElement = {
    type: 'dateMention',
    date,
    displayText,
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, dateMentionNode);
  Transforms.move(editor);
};

/**
 * 切换文本格式
 */
export const toggleMark = (editor: Editor, format: keyof Omit<CustomText, 'text'>) => {
  const isActive = isMarkActive(editor, format);

  if (isActive) {
    Editor.removeMark(editor, format);
  } else {
    Editor.addMark(editor, format, true);
  }
};

/**
 * 检查文本格式是否激活
 */
export const isMarkActive = (editor: Editor, format: keyof Omit<CustomText, 'text'>): boolean => {
  const marks = Editor.marks(editor);
  return marks ? marks[format] === true : false;
};

/**
 * 获取编辑器纯文本内容
 */
export const getPlainText = (nodes: any[]): string => {
  return nodes.map(n => Node.string(n)).join('\n');
};

/**
 * 判断节点是否为 inline 元素
 */
export const isInlineElement = (element: CustomElement): boolean => {
  return element.type === 'tag' || element.type === 'dateMention';
};

/**
 * 创建空段落
 */
export const createEmptyParagraph = (): CustomElement => {
  return {
    type: 'paragraph',
    children: [{ text: '' }],
  };
};
