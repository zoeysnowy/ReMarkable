/**
 * Slate Editor 类型定义
 * 
 * 定义编辑器中使用的自定义元素和文本类型
 */

import { BaseEditor, Descendant } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

// 自定义元素类型
export type CustomElement = 
  | ParagraphElement 
  | TagElement 
  | DateMentionElement;

// 自定义文本类型
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  code?: boolean;
};

// 段落元素
export interface ParagraphElement {
  type: 'paragraph';
  children: (CustomText | CustomElement)[];
}

// Tag 元素
export interface TagElement {
  type: 'tag';
  tagId: string;
  tagName: string;
  tagColor?: string;
  tagEmoji?: string;
  mentionOnly?: boolean;
  children: CustomText[]; // Inline 元素必须有 children
}

// Date Mention 元素
export interface DateMentionElement {
  type: 'dateMention';
  date: string;
  displayText: string;
  children: CustomText[]; // Inline 元素必须有 children
}

// 扩展 Slate 类型
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor & HistoryEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}

// 辅助类型
export type SlateNode = CustomElement | CustomText;
export type SlateDescendant = Descendant;
