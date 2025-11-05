/**
 * 统一文档格式 - 编辑器无关的数据层
 * 
 * 目标：
 * 1. 可以从Slate转换而来
 * 2. 可以转换为Lexical
 * 3. 支持未来的ContextMarker等自定义节点
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

export type UnifiedDocumentVersion = '1.0';

export interface UnifiedDocument {
  version: UnifiedDocumentVersion;
  metadata?: {
    createdAt?: string;
    updatedAt?: string;
    author?: string;
  };
  content: UnifiedNode[];
}

// 基础节点类型
export type UnifiedNodeType = 
  | 'paragraph'
  | 'heading'
  | 'context-marker'  // 时间轴标记节点
  | 'activity-span'   // 活动记录节点
  | 'tag'
  | 'date-mention'
  | 'emoji'
  | 'image'
  | 'audio'
  | 'table'
  | 'table-row'
  | 'table-cell'
  | 'list'
  | 'list-item';

// 文本样式
export interface TextStyle {
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  code?: boolean;
  color?: string;
}

// 文本节点
export interface UnifiedTextNode {
  type: 'text';
  text: string;
  style?: TextStyle;
}

// 段落节点
export interface UnifiedParagraphNode {
  type: 'paragraph';
  children: (UnifiedTextNode | UnifiedInlineNode)[];
}

// 标题节点
export interface UnifiedHeadingNode {
  type: 'heading';
  level: 1 | 2 | 3 | 4 | 5 | 6;
  children: (UnifiedTextNode | UnifiedInlineNode)[];
}

// 时间轴标记节点（你的核心创新）
export interface UnifiedContextMarkerNode {
  type: 'context-marker';
  timestamp: string; // ISO 8601
  activities: UnifiedActivitySpan[];
  // 可选：压缩显示标志
  compressed?: boolean;
}

// 活动记录
export interface UnifiedActivitySpan {
  appId: string;
  appName: string;
  appColor: string; // HEX
  title?: string;
  duration: number; // 秒
  // 可选：图标URL
  iconUrl?: string;
}

// 标签节点
export interface UnifiedTagNode {
  type: 'tag';
  tagId: string;
  tagName: string;
  tagColor: string;
  tagEmoji?: string;
}

// 日期提及节点
export interface UnifiedDateMentionNode {
  type: 'date-mention';
  dateString: string; // ISO date or natural language
  parsedDate?: string; // ISO 8601
}

// Emoji节点
export interface UnifiedEmojiNode {
  type: 'emoji';
  emoji: string;
  native: string;
}

// 图片节点
export interface UnifiedImageNode {
  type: 'image';
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  caption?: string;
}

// 音频节点
export interface UnifiedAudioNode {
  type: 'audio';
  src: string;
  duration?: number;
  waveform?: number[]; // 波形数据
  transcript?: string; // 语音转文字
}

// 表格节点
export interface UnifiedTableNode {
  type: 'table';
  rows: UnifiedTableRowNode[];
  headers?: boolean;
}

export interface UnifiedTableRowNode {
  type: 'table-row';
  cells: UnifiedTableCellNode[];
}

export interface UnifiedTableCellNode {
  type: 'table-cell';
  children: UnifiedBlockNode[];
  colspan?: number;
  rowspan?: number;
}

// 列表节点
export interface UnifiedListNode {
  type: 'list';
  listType: 'bullet' | 'ordered' | 'task';
  children: UnifiedListItemNode[];
}

export interface UnifiedListItemNode {
  type: 'list-item';
  checked?: boolean; // for task lists
  children: (UnifiedBlockNode | UnifiedTextNode)[];
}

// 联合类型
export type UnifiedInlineNode = 
  | UnifiedTagNode 
  | UnifiedDateMentionNode 
  | UnifiedEmojiNode;

export type UnifiedBlockNode = 
  | UnifiedParagraphNode 
  | UnifiedHeadingNode 
  | UnifiedContextMarkerNode
  | UnifiedImageNode
  | UnifiedAudioNode
  | UnifiedTableNode
  | UnifiedListNode;

export type UnifiedNode = 
  | UnifiedTextNode 
  | UnifiedInlineNode 
  | UnifiedBlockNode;
