/**
 * UnifiedSlateEditor - 节点类型定义
 * 
 * 基于 Event 的单实例 Slate 编辑器
 * 支持跨行选择、富文本复制粘贴、缩进管理
 */

import { BaseEditor, Descendant } from 'slate';
import { ReactEditor } from 'slate-react';
import { HistoryEditor } from 'slate-history';

// ==================== 编辑器类型 ====================

export type CustomEditor = BaseEditor & ReactEditor & HistoryEditor;

// ==================== 节点类型 ====================

/**
 * EventLine - 对应一个 Event 的一行（可能是 title 或 description）
 */
export interface EventLineNode {
  type: 'event-line';
  eventId?: string;        // 关联的 Event ID（新建时为空）
  lineId: string;          // 行唯一ID（用于编辑器内部定位）
  level: number;           // 缩进层级 (0, 1, 2, ...)
  mode: 'title' | 'description';  // 行模式
  children: ParagraphNode[];
  
  // 🆕 v1.5: 元数据透传（保留业务字段，避免字段丢失）
  metadata?: EventMetadata;
}

/**
 * Event 元数据（完整业务字段透传）
 * 
 * v1.6: 扩展所有业务字段，避免字段丢失
 */
export interface EventMetadata {
  // 时间字段
  startTime?: string | null;
  endTime?: string | null;
  dueDate?: string | null;
  isAllDay?: boolean;
  timeSpec?: any;
  
  // 样式字段
  emoji?: string;
  color?: string;
  
  // 业务字段
  priority?: string;
  category?: string;
  isCompleted?: boolean;
  isTask?: boolean;
  type?: string;
  
  // Plan 相关
  isPlan?: boolean;
  isTimeCalendar?: boolean;
  
  // 同步字段
  calendarId?: string;
  calendarIds?: string[];
  todoListIds?: string[]; // 🆕 To Do List IDs
  source?: string;
  syncStatus?: string;
  externalId?: string;
  remarkableSource?: boolean;
  
  // 时间戳
  createdAt?: string;
  updatedAt?: string;
  
  // 扩展字段（允许其他未列出的字段）
  [key: string]: any;
}

/**
 * Paragraph - 段落节点
 */
export interface ParagraphNode {
  type: 'paragraph';
  children: (TextNode | TagNode | DateMentionNode)[];
}

/**
 * Text - 文本叶子节点（支持格式）
 */
export interface TextNode {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
}

/**
 * Tag - 标签元素
 */
export interface TagNode {
  type: 'tag';
  tagId: string;
  tagName: string;
  tagColor?: string;
  tagEmoji?: string;
  mentionOnly?: boolean;  // description 模式下的只读标签
  children: [{ text: '' }];
}

/**
 * DateMention - 日期提及元素
 */
export interface DateMentionNode {
  type: 'dateMention';
  startDate: string;      // ISO string
  endDate?: string;       // ISO string
  mentionOnly?: boolean;  // description 模式下的只读提及
  eventId?: string;       // 🆕 关联的事件 ID
  children: [{ text: '' }];
}

// ==================== 类型导出 ====================

export type CustomElement = EventLineNode | ParagraphNode | TagNode | DateMentionNode;
export type CustomText = TextNode;

// ==================== 工具类型 ====================

/**
 * EventLine 数据（用于序列化/反序列化）
 */
export interface EventLineData {
  lineId: string;
  eventId?: string;
  level: number;
  mode: 'title' | 'description';
  content: string;  // HTML 格式
}

/**
 * 编辑器配置
 */
export interface UnifiedSlateEditorConfig {
  placeholder?: string;
  readOnly?: boolean;
  autoFocus?: boolean;
  maxLevel?: number;  // 最大缩进层级
}
