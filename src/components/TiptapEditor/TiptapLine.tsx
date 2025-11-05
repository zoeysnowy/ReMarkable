import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
import Underline from '@tiptap/extension-underline';
import { TagNode } from './nodes/TagNode';
import './TiptapLine.css';

interface TiptapLineProps {
  content: string;
  lineId: string;
  mode?: 'title' | 'description';
  placeholder?: string;
  level?: number;
  onUpdate: (html: string) => void;
  onEnter?: () => void;
  onShiftEnter?: () => void;
  onTab?: () => void;
  onShiftTab?: () => void;
  onArrowUp?: () => void;
  onArrowDown?: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  onDelete?: () => void;
  className?: string;
  onEditorReady?: (lineId: string, editor: Editor) => void;
  onEditorDestroy?: (lineId: string) => void;
}

/**
 * 单行 Tiptap 编辑器
 * 
 * 用于逐步替换 FreeFormEditor 中的 contentEditable
 * 每一行是一个独立的 Tiptap 实例
 */
export const TiptapLine: React.FC<TiptapLineProps> = ({
  content,
  lineId,
  mode = 'title',
  placeholder = '',
  level = 0,
  onUpdate,
  onEnter,
  onShiftEnter,
  onTab,
  onShiftTab,
  onArrowUp,
  onArrowDown,
  onFocus,
  onBlur,
  onDelete,
  className = '',
  onEditorReady,
  onEditorDestroy,
}) => {
  const isFirstRender = useRef(true);
  // 移除本地悬浮菜单，统一回用 HeadlessFloatingToolbar（PlanManager 控制）
  const editorRef = useRef<Editor | null>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 保持 paragraph 启用；Title 单行通过键盘事件控制
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        // 列表保持默认启用（不显式传 true）
      }),
      Placeholder.configure({
        placeholder,
      }),
      Color,
      TextStyle,
  Underline,
      TagNode,
    ],
    content,
    onUpdate: ({ editor }) => {
      if (!isFirstRender.current) {
        onUpdate(editor.getHTML());
      }
    },
    onFocus: () => {
      onFocus?.();
    },
    onBlur: () => {
      onBlur?.();
    },
      editorProps: {
      attributes: {
        'data-line-id': lineId,
        'data-mode': mode,
        // 确保包含 ProseMirror 默认类名，便于选择器定位
        class: `ProseMirror tiptap-line-editor ${mode === 'description' ? 'tiptap-line-description' : ''}`,
      },
      handleKeyDown: (view, event) => {
        // Enter: Title 模式创建新行，Description 模式换行
        if (event.key === 'Enter' && !event.shiftKey) {
          if (mode === 'title') {
            event.preventDefault();
            onEnter?.();
            return true;
          }
          // Description 模式允许默认换行
          return false;
        }

        // Shift+Enter: 模式切换
        if (event.key === 'Enter' && event.shiftKey) {
          event.preventDefault();
          onShiftEnter?.();
          return true;
        }

        // Backspace: 空行时删除当前行
        if (event.key === 'Backspace') {
          const { selection, doc } = view.state;
          const isAtStart = selection.$anchor.pos === 1; // 光标在开头
          const isEmpty = (doc.textContent || '').length === 0;
          if (isAtStart && isEmpty) {
            if (onDelete) {
              event.preventDefault();
              onDelete();
              return true;
            }
          }
        }

        // Tab: 增加缩进（Title 模式外由列表处理）
        if (event.key === 'Tab' && !event.shiftKey && mode === 'title') {
          event.preventDefault();
          onTab?.();
          return true;
        }

        // Shift+Tab: 减少缩进（Title 模式）；描述模式交给列表（Outdent）
        if (event.key === 'Tab' && event.shiftKey) {
          if (mode === 'title') {
            event.preventDefault();
            onShiftTab?.();
            return true;
          }
          // 描述模式：交由列表处理（tiptap 命令）
          const editorInst = editorRef.current;
          if (editorInst) {
            event.preventDefault();
            editorInst.chain().focus().liftListItem('listItem').run();
            return true;
          }
          return false;
        }

        // 描述模式下：Tab 缩进当前列表项
        if (event.key === 'Tab' && !event.shiftKey && mode === 'description') {
          const editorInst = editorRef.current;
          if (editorInst) {
            event.preventDefault();
            editorInst.chain().focus().sinkListItem('listItem').run();
            return true;
          }
          return false;
        }

        // 描述模式下：Ctrl+↑ 收起 / Ctrl+↓ 展开 当前列表项的子级可见性
        if (mode === 'description' && event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
          const { selection } = view.state;
          const domInfo = view.domAtPos(selection.from);
          const anchorEl = (domInfo.node as HTMLElement).nodeType === 1 ? (domInfo.node as HTMLElement) : (domInfo.node as any).parentElement;
          const li = anchorEl?.closest ? anchorEl.closest('li') : null;
          if (li) {
            event.preventDefault();
            if (event.key === 'ArrowUp') {
              li.classList.add('collapsed');
            } else {
              li.classList.remove('collapsed');
            }
            return true;
          }
        }

        // ArrowUp/Down: 导航到上下行（光标在行首/行尾时）
        if (event.key === 'ArrowUp') {
          const { selection } = view.state;
          const isAtStart = selection.$anchor.pos === 1; // 光标在开头
          if (isAtStart) {
            event.preventDefault();
            onArrowUp?.();
            return true;
          }
        }

        if (event.key === 'ArrowDown') {
          const { selection } = view.state;
          const docSize = view.state.doc.content.size;
          const isAtEnd = selection.$anchor.pos >= docSize - 1; // 光标在末尾
          if (isAtEnd) {
            event.preventDefault();
            onArrowDown?.();
            return true;
          }
        }

        return false;
      },
    },
  });

  // 首次渲染后标记
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
    }
  }, []);

  // 暴露 editor 给上层用于插入（避免手动 DOM range 导致的光标错位）
  useEffect(() => {
    if (editor) {
      editorRef.current = editor;
      onEditorReady?.(lineId, editor);
      return () => {
        editorRef.current = null;
        onEditorDestroy?.(lineId);
      };
    }
  }, [editor, lineId, onEditorReady, onEditorDestroy]);

  // 当外部 content 变化时更新编辑器
  useEffect(() => {
    if (editor && !editor.isDestroyed && !isFirstRender.current) {
      const currentContent = editor.getHTML();
      if (currentContent !== content) {
        editor.commands.setContent(content, { emitUpdate: false });
      }
    }
  }, [content, editor]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={`tiptap-line ${className}`}
      data-line-id={lineId}
      data-mode={mode}
      style={{ position: 'relative' as const }}
    >
      {/* 悬浮文本菜单交由 HeadlessFloatingToolbar 统一管理 */}
      <EditorContent editor={editor} />
    </div>
  );
};
