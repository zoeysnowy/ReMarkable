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
    console.log('[insertTag] 开始插入 Tag:', tagName);
    console.log('[insertTag] 当前 selection:', editor.selection);
    
    const tagNode: TagNode = {
      type: 'tag',
      tagId,
      tagName,
      tagColor,
      tagEmoji,
      mentionOnly,
      children: [{ text: '' }],
    };
    
    // 🔧 只在没有选区时才设置焦点
    if (!editor.selection) {
      console.log('[insertTag] 无 selection，设置焦点');
      ReactEditor.focus(editor as ReactEditor);
      // 不再强制设置选区，让编辑器恢复上次光标位置
    }
    
    // 如果此时仍然没有 selection，说明编辑器状态异常，直接返回
    if (!editor.selection) {
      console.warn('[insertTag] No selection after focus, aborting');
      return false;
    }
    
    // 🔥 使用 Editor.withoutNormalizing 确保插入过程不被 normalize 打断
    Editor.withoutNormalizing(editor, () => {
      console.log('[insertTag] 插入节点前 selection:', JSON.stringify(editor.selection));
      Transforms.insertNodes(editor, tagNode as any);
      console.log('[insertTag] 插入节点后 selection:', JSON.stringify(editor.selection));
      
      // 🔥 插入空格，光标会自动移动到空格后
      Transforms.insertText(editor, ' ');
      console.log('[insertTag] 插入空格后 selection:', JSON.stringify(editor.selection));
    });
    
    // ✅ 退出 withoutNormalizing 后，normalizeNode 会运行一次，确保结构正确
    // 但此时光标已经在正确位置（空格后），不会再跳动
    
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
    // 🔧 只在没有选区时才设置焦点
    if (!editor.selection) {
      ReactEditor.focus(editor as ReactEditor);
    }
    
    // 如果此时仍然没有 selection，说明编辑器状态异常，直接返回
    if (!editor.selection) {
      console.warn('[insertEmoji] No selection after focus, aborting');
      return false;
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
  mentionOnly?: boolean,
  eventId?: string  // 🆕 添加 eventId 参数，用于 TimeHub 同步
): boolean {
  try {
    const dateMentionNode: DateMentionNode = {
      type: 'dateMention',
      startDate,
      endDate,
      mentionOnly,
      eventId,  // 🆕 保存 eventId
      children: [{ text: '' }],
    };
    
    // 🔧 只在没有选区时才设置焦点
    if (!editor.selection) {
      ReactEditor.focus(editor as ReactEditor);
    }
    
    // 如果此时仍然没有 selection，说明编辑器状态异常，直接返回
    if (!editor.selection) {
      console.warn('[insertDateMention] No selection after focus, aborting');
      return false;
    }
    
    Transforms.insertNodes(editor, dateMentionNode as any);
    
    // � Gemini方案：插入空格后，normalizeNode会确保dateMention后总有空格
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
  // 🔧 安全检查
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[helpers.slateFragmentToHtml] fragment 不是数组', { fragment });
    return '';
  }
  
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
