/**
 * 插入辅助函数 - 用于 FloatingBar 集成
 */

import { Editor, Transforms, Node } from 'slate';
import { ReactEditor } from 'slate-react';
import { TagNode, DateMentionNode, TextNode, EventLineNode } from './types';

/**
 * 插入 Tag 元素
 */
export function insertTag(
  editor: Editor,
  tagId: string,
  tagName: string,
  tagColor?: string,
  tagEmoji?: string,
  mentionOnly?: boolean
): boolean {
  try {
    const tagNode: TagNode = {
      type: 'tag',
      tagId,
      tagName,
      tagColor,
      tagEmoji,
      mentionOnly,
      children: [{ text: '' }],
    };
    
    // 先聚焦编辑器
    ReactEditor.focus(editor as ReactEditor);
    
    // 如果没有选区，选择最后一个位置
    if (!editor.selection) {
      const lastPath = [editor.children.length - 1, 0, 0];
      Transforms.select(editor, {
        anchor: { path: lastPath, offset: 0 },
        focus: { path: lastPath, offset: 0 },
      });
    }
    
    Transforms.insertNodes(editor, tagNode as any);
    Transforms.insertText(editor, ' ');
    
    return true;
  } catch (err) {
    console.error('[insertTag] Failed:', err);
    return false;
  }
}

/**
 * 插入 Emoji
 */
export function insertEmoji(editor: Editor, emoji: string): boolean {
  try {
    ReactEditor.focus(editor as ReactEditor);
    
    // 如果没有选区，选择最后一个位置
    if (!editor.selection) {
      const lastPath = [editor.children.length - 1, 0, 0];
      Transforms.select(editor, {
        anchor: { path: lastPath, offset: 0 },
        focus: { path: lastPath, offset: 0 },
      });
    }
    
    Transforms.insertText(editor, emoji + ' ');
    return true;
  } catch (err) {
    console.error('[insertEmoji] Failed:', err);
    return false;
  }
}

/**
 * 插入 DateMention 元素
 */
export function insertDateMention(
  editor: Editor,
  startDate: string,
  endDate?: string,
  mentionOnly?: boolean
): boolean {
  try {
    const dateMentionNode: DateMentionNode = {
      type: 'dateMention',
      startDate,
      endDate,
      mentionOnly,
      children: [{ text: '' }],
    };
    
    ReactEditor.focus(editor as ReactEditor);
    
    // 如果没有选区，选择最后一个位置
    if (!editor.selection) {
      const lastPath = [editor.children.length - 1, 0, 0];
      Transforms.select(editor, {
        anchor: { path: lastPath, offset: 0 },
        focus: { path: lastPath, offset: 0 },
      });
    }
    
    Transforms.insertNodes(editor, dateMentionNode as any);
    Transforms.insertText(editor, ' ');
    
    return true;
  } catch (err) {
    console.error('[insertDateMention] Failed:', err);
    return false;
  }
}

/**
 * 将 Slate fragment 转换为 HTML（内部使用）
 */
function slateFragmentToHtml(fragment: (TextNode | TagNode | DateMentionNode)[]): string {
  return fragment.map(node => {
    if ('text' in node) {
      let text = node.text;
      if (!text) return '';
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
 * 格式化日期显示
 */
function formatDateForDisplay(start: Date, end: Date | null): string {
  if (!end || start.toDateString() === end.toDateString()) {
    return start.toLocaleDateString('zh-CN');
  }
  return `${start.toLocaleDateString('zh-CN')} - ${end.toLocaleDateString('zh-CN')}`;
}

/**
 * 获取当前编辑器某一行的 HTML 内容
 * 用于 FloatingBar 插入后更新 PlanItem
 */
export function getEditorHTML(editor: Editor): string {
  try {
    // 获取当前选区所在的 event-line
    const { selection } = editor;
    if (!selection) return '';
    
    const match = Editor.above(editor, {
      match: n => (n as any).type === 'event-line',
    });
    
    if (!match) return '';
    
    const [node] = match;
    const eventLine = node as unknown as EventLineNode;
    
    // 获取 paragraph 的 children
    if (eventLine.children && eventLine.children[0]) {
      const paragraph = eventLine.children[0];
      if (paragraph.children) {
        return slateFragmentToHtml(paragraph.children);
      }
    }
    
    return '';
  } catch (err) {
    console.error('[getEditorHTML] Failed:', err);
    return '';
  }
}
