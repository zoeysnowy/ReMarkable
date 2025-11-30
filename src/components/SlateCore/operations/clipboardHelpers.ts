/**
 * SlateCore - 剪贴板操作工具
 * 
 * 处理 Bullet List 的复制粘贴功能
 * 支持 Microsoft Office、微信等多平台格式兼容
 * 
 * @version 1.0.0
 * @date 2025-11-30
 */

import { Editor, Element, Node as SlateNode, Text } from 'slate';
import { getBulletChar } from './bulletOperations';

/**
 * Bullet 项数据结构
 */
export interface BulletItem {
  level: number;
  text: string;
  marks?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
    color?: string;
    backgroundColor?: string;
  };
}

/**
 * 剪贴板数据格式
 */
export interface ClipboardData {
  'text/plain': string;
  'text/html': string;
}

/**
 * 从 Slate 节点提取 Bullet 项
 */
export function extractBulletItems(editor: Editor, nodes: SlateNode[]): BulletItem[] {
  const items: BulletItem[] = [];

  for (const node of nodes) {
    if (Element.isElement(node) && node.type === 'paragraph') {
      const para = node as any;
      
      if (para.bullet) {
        const level = para.bulletLevel || 0;
        const textParts: string[] = [];
        let marks = {};

        // 提取文本和格式
        for (const child of para.children) {
          if (Text.isText(child)) {
            textParts.push(child.text);
            // 记录第一个文本节点的格式
            if (Object.keys(marks).length === 0 && Object.keys(child).length > 1) {
              marks = {
                bold: child.bold,
                italic: child.italic,
                underline: child.underline,
                strikethrough: child.strikethrough,
                color: child.color,
                backgroundColor: child.backgroundColor,
              };
            }
          } else if (Element.isElement(child)) {
            // 处理 inline 元素（tag, dateMention）
            if (child.type === 'tag') {
              textParts.push(`#${(child as any).name || ''}`);
            } else if (child.type === 'dateMention') {
              const dm = child as any;
              textParts.push(`📅${dm.displayText || ''}`);
            }
          }
        }

        items.push({
          level,
          text: textParts.join(''),
          marks: Object.keys(marks).length > 0 ? marks : undefined,
        });
      }
    }
  }

  return items;
}

/**
 * 生成纯文本格式（适用于微信、Notes 等）
 */
export function generatePlainText(items: BulletItem[]): string {
  return items.map(item => {
    const indent = '  '.repeat(item.level); // 每级 2 空格
    const bullet = getBulletChar(item.level);
    return `${indent}${bullet} ${item.text}`;
  }).join('\n');
}

/**
 * 生成 HTML 格式（适用于 Microsoft Office、富文本环境）
 */
export function generateHTML(items: BulletItem[]): string {
  const htmlParts = [
    '<div style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, sans-serif; line-height: 1.6;">',
  ];

  for (const item of items) {
    const indent = item.level * 20; // 每级 20px
    const bullet = getBulletChar(item.level);
    
    let textStyle = '';
    if (item.marks) {
      const styles: string[] = [];
      if (item.marks.bold) styles.push('font-weight: bold');
      if (item.marks.italic) styles.push('font-style: italic');
      if (item.marks.underline) styles.push('text-decoration: underline');
      if (item.marks.strikethrough) styles.push('text-decoration: line-through');
      if (item.marks.color) styles.push(`color: ${item.marks.color}`);
      if (item.marks.backgroundColor) styles.push(`background-color: ${item.marks.backgroundColor}`);
      textStyle = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';
    }

    htmlParts.push(
      `<div style="margin: 4px 0; margin-left: ${indent}px; padding-left: 20px; text-indent: -20px;">` +
      `<span style="display: inline-block; width: 20px; text-align: center;">${bullet}</span>` +
      `<span${textStyle}>${escapeHtml(item.text)}</span>` +
      `</div>`
    );
  }

  htmlParts.push('</div>');
  return htmlParts.join('');
}

/**
 * 生成剪贴板数据（同时包含纯文本和 HTML）
 */
export function generateClipboardData(items: BulletItem[]): ClipboardData {
  return {
    'text/plain': generatePlainText(items),
    'text/html': generateHTML(items),
  };
}

/**
 * 解析粘贴的纯文本 Bullet 内容
 */
export function parsePlainTextBullets(text: string): BulletItem[] {
  const lines = text.split('\n');
  const items: BulletItem[] = [];

  for (const line of lines) {
    // 匹配格式：[空格]*[bullet符号][空格]内容
    const match = line.match(/^(\s*)([●○–□▸•◦▪\-*➢])\s?(.*)$/);
    
    if (match) {
      const [, spaces, , content] = match;
      const level = Math.floor(spaces.length / 2); // 每 2 空格 = 1 级
      
      items.push({
        level: Math.min(level, 4), // 最多 5 级（0-4）
        text: content,
      });
    } else if (line.trim()) {
      // 非空行但不匹配 bullet 格式，作为普通文本
      items.push({
        level: 0,
        text: line.trim(),
      });
    }
  }

  return items;
}

/**
 * 解析 HTML Bullet 内容（从 Office、浏览器粘贴）
 */
export function parseHTMLBullets(html: string): BulletItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const items: BulletItem[] = [];

  // 尝试解析 <ul>/<ol> 结构
  const listItems = doc.querySelectorAll('ul li, ol li');
  if (listItems.length > 0) {
    listItems.forEach((li, index) => {
      const text = li.textContent?.trim() || '';
      const style = (li as HTMLElement).style;
      const marginLeft = parseInt(style.marginLeft || '0', 10);
      const level = Math.floor(marginLeft / 20); // 每 20px = 1 级

      items.push({
        level: Math.min(level, 4),
        text,
      });
    });
    return items;
  }

  // 回退：尝试解析自定义 div 结构（从我们自己的 HTML 复制）
  const divs = doc.querySelectorAll('div[style*="margin-left"]');
  divs.forEach(div => {
    const text = div.textContent?.trim() || '';
    const style = (div as HTMLElement).style;
    const marginLeft = parseInt(style.marginLeft || '0', 10);
    const level = Math.floor(marginLeft / 20);

    if (text) {
      items.push({
        level: Math.min(level, 4),
        text,
      });
    }
  });

  return items;
}

/**
 * 检测平台环境
 */
export function detectPlatform(): {
  isWeChat: boolean;
  isMobile: boolean;
  isOffice: boolean;
} {
  const ua = navigator.userAgent;
  return {
    isWeChat: /MicroMessenger/i.test(ua),
    isMobile: /iPhone|iPad|iPod|Android/i.test(ua),
    isOffice: /Word|Excel|PowerPoint/i.test(ua),
  };
}

/**
 * 根据平台调整格式
 */
export function adjustFormatForPlatform(items: BulletItem[]): BulletItem[] {
  const { isWeChat, isMobile } = detectPlatform();

  if (isWeChat || isMobile) {
    // 微信/移动端：最多 2 级缩进，使用简单符号
    return items.map(item => ({
      ...item,
      level: Math.min(item.level, 1), // 只保留 0-1 级
    }));
  }

  return items;
}

/**
 * HTML 转义
 */
function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
