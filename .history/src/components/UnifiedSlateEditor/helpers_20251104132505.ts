/**
 * 插入辅助函数 - 用于 FloatingBar 集成
 */

import { Editor, Transforms } from 'slate';
import { ReactEditor } from 'slate-react';
import { TagNode, DateMentionNode } from './types';

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
    
    ReactEditor.focus(editor as ReactEditor);
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
    Transforms.insertNodes(editor, dateMentionNode as any);
    Transforms.insertText(editor, ' ');
    
    return true;
  } catch (err) {
    console.error('[insertDateMention] Failed:', err);
    return false;
  }
}

/**
 * 获取编辑器 HTML 内容
 */
export function getEditorHTML(editor: Editor): string {
  // 这个函数需要从 serialization 中导出
  // 暂时返回简单的文本
  return Editor.string(editor, []);
}
