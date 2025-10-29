/**
 * MultiLineEditor - 多行键盘编辑器组件
 *
 * 核心特性：
 * - 键盘导航：↑↓ 移动焦点，Shift+Alt+↑↓ 移动项目
 * - 层级缩进：Tab/Shift+Tab 调整层级
 * - 快速创建：Enter 创建同级，Shift+Enter 创建子项
 * - 批量操作：支持文本选区多选，批量删除/移动
 * - 插槽系统：renderItemPrefix/Suffix/Content 实现业务逻辑分离
 * - Gray Text：底部固定提示区域，点击快速创建
 *
 * 使用示例：
 * ```tsx
 * <MultiLineEditor
 *   items={items}
 *   onChange={setItems}
 *   renderItemPrefix={(item) => <Checkbox checked={item.data.checked} />}
 *   renderItemSuffix={(item) => <TagList tags={item.data.tags} />}
 *   placeholder="输入内容..."
 *   grayText="点击创建新项..."
 * />
 * ```
 */

export { MultiLineEditor } from './MultiLineEditor';
export type {
  MultiLineEditorItem,
  MultiLineEditorProps,
  KeyboardShortcuts,
  EditorState,
  EditorCallbacks,
} from './types';

// 可选：导出 Hooks 供高级用户使用
export { useKeyboardNav } from './hooks/useKeyboardNav';
export { useIndentManager } from './hooks/useIndentManager';
export { useBatchOperations } from './hooks/useBatchOperations';

// 导出简化版编辑器（参照 TagManager 架构）
export { FreeFormEditor } from './FreeFormEditor';
export type { FreeFormEditorProps, FreeFormLine } from './FreeFormEditor';

