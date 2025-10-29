/**
 * MultiLineEditor 类型定义
 * 参照 TagManager 的设计，提供通用的多行编辑能力
 */

import React from 'react';

// ==================== 核心数据结构 ====================

/**
 * 多行编辑器的单个项目
 * 使用泛型 T 存储业务数据，保持编辑器的通用性
 */
export interface MultiLineEditorItem<T = any> {
  /** 唯一标识符 */
  id: string;
  
  /** 主要编辑内容（纯文本或 HTML） */
  content: string;
  
  /** 层级缩进（0, 1, 2, ...） */
  level: number;
  
  /** 列表中的位置顺序 */
  position: number;
  
  /** 父项 ID（用于层级关系） */
  parentId?: string;
  
  /** 业务数据（由父组件管理，编辑器不关心） */
  data?: T;
}

// ==================== 键盘快捷键配置 ====================

export interface KeyboardShortcuts {
  /** 创建同级项（默认：Enter） */
  createSibling?: string;
  
  /** 创建子项（默认：Shift+Enter） */
  createChild?: string;
  
  /** 增加缩进（默认：Tab） */
  increaseIndent?: string;
  
  /** 减少缩进（默认：Shift+Tab） */
  decreaseIndent?: string;
  
  /** 向上导航（默认：ArrowUp） */
  navigateUp?: string;
  
  /** 向下导航（默认：ArrowDown） */
  navigateDown?: string;
  
  /** 向上移动项目（默认：Shift+Alt+ArrowUp） */
  moveUp?: string;
  
  /** 向下移动项目（默认：Shift+Alt+ArrowDown） */
  moveDown?: string;
  
  /** 删除项目（默认：Delete/Backspace） */
  delete?: string;
}

// ==================== 组件 Props ====================

export interface MultiLineEditorProps<T = any> {
  /** 数据源 */
  items: MultiLineEditorItem<T>[];
  
  /** 数据变化回调 */
  onItemsChange: (items: MultiLineEditorItem<T>[]) => void;
  
  // ========== 插槽系统 ==========
  
  /** 自定义每行左侧内容（如 emoji、checkbox、颜色标记） */
  renderItemPrefix?: (item: MultiLineEditorItem<T>) => React.ReactNode;
  
  /** 自定义每行右侧内容（如功能按钮、日历映射、计时器） */
  renderItemSuffix?: (item: MultiLineEditorItem<T>) => React.ReactNode;
  
  /** 自定义内容渲染（用于富文本编辑器） */
  renderContent?: (
    item: MultiLineEditorItem<T>,
    defaultRender: () => React.ReactNode
  ) => React.ReactNode;
  
  // ========== 配置选项 ==========
  
  /** Gray Text 占位符文本 */
  placeholder?: string;
  
  /** 缩进大小（像素，默认 24） */
  indentSize?: number;
  
  /** 最大层级限制（默认无限制） */
  maxLevel?: number;
  
  /** 键盘快捷键配置 */
  shortcuts?: KeyboardShortcuts;
  
  /** 是否启用自动保存（默认 true） */
  autoSave?: boolean;
  
  /** 自动保存回调 */
  onAutoSave?: (items: MultiLineEditorItem<T>[]) => void;
  
  /** 是否启用批量操作（默认 true） */
  enableBatchOperations?: boolean;
  
  /** 批量删除回调 */
  onBatchDelete?: (itemIds: string[]) => void;
  
  /** 是否启用 Gray Text 创建功能（默认 true） */
  enableGrayTextCreation?: boolean;
  
  /** CSS 类名 */
  className?: string;
  
  /** 自定义样式 */
  style?: React.CSSProperties;
}

// ==================== 内部状态 ====================

export interface EditorState {
  /** 是否正在创建新项目 */
  isCreatingNew: boolean;
  
  /** 新项目的 ID */
  newItemId: string | null;
  
  /** 选中的项目 ID 列表 */
  selectedItemIds: string[];
  
  /** 悬停的项目 ID */
  hoveredItemId: string | null;
}

// ==================== 事件回调 ====================

export interface EditorCallbacks<T = any> {
  /** 创建新项目 */
  onCreateItem: (level: number, afterItemId?: string) => void;
  
  /** 删除项目 */
  onDeleteItem: (itemId: string) => void;
  
  /** 批量删除项目 */
  onBatchDeleteItems: (itemIds: string[]) => void;
  
  /** 更新项目内容 */
  onUpdateContent: (itemId: string, content: string) => void;
  
  /** 更新项目层级 */
  onUpdateLevel: (itemId: string, level: number, parentId?: string) => void;
  
  /** 移动项目位置 */
  onMoveItem: (itemId: string, direction: 'up' | 'down') => void;
  
  /** 批量移动项目 */
  onBatchMoveItems: (itemIds: string[], direction: 'up' | 'down') => void;
  
  /** 导航到上一项 */
  onNavigatePrevious: (currentItemId: string) => void;
  
  /** 导航到下一项 */
  onNavigateNext: (currentItemId: string) => void;
}

// ==================== 工具类型 ====================

export type ItemWithIndex<T> = MultiLineEditorItem<T> & { index: number };

export interface IndentChangeResult {
  newLevel: number;
  newParentId?: string;
}
