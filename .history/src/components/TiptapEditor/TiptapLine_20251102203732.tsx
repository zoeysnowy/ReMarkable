import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import { Color } from '@tiptap/extension-color';
import { TextStyle } from '@tiptap/extension-text-style';
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
  className?: string;
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
  className = '',
}) => {
  const isFirstRender = useRef(true);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 保持 paragraph 启用以满足 listItem 对 "paragraph block*" 的依赖
        // 通过键盘事件拦截来实现 Title 的单行行为，而不是禁用 paragraph
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        // 禁用列表相关扩展，避免对 paragraph 的强依赖
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
      Color,
      TextStyle,
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
        class: `tiptap-line-editor ${mode === 'description' ? 'tiptap-line-description' : ''}`,
      },
      handleKeyDown: (view, event) => {
        // Enter: Title 模式创建新行，Description 模式换行
        if (event.key === 'Enter' && !event.shiftKey) {
          console.log('[TiptapLine] Enter pressed, mode:', mode);
          if (mode === 'title') {
            event.preventDefault();
            console.log('[TiptapLine] Calling onEnter, lineId:', lineId);
            onEnter?.();
            return true;
          }
          // Description 模式允许默认换行
          return false;
        }

        // Shift+Enter: 模式切换
        if (event.key === 'Enter' && event.shiftKey) {
          console.log('[TiptapLine] Shift+Enter pressed, lineId:', lineId);
          event.preventDefault();
          console.log('[TiptapLine] Calling onShiftEnter');
          onShiftEnter?.();
          return true;
        }

        // Tab: 增加缩进（只在 Title 模式）
        if (event.key === 'Tab' && !event.shiftKey && mode === 'title') {
          event.preventDefault();
          onTab?.();
          return true;
        }

        // Shift+Tab: 减少缩进
        if (event.key === 'Tab' && event.shiftKey) {
          event.preventDefault();
          onShiftTab?.();
          return true;
        }

        // ArrowUp/Down: 导航到上下行（光标在行首/行尾时）
        if (event.key === 'ArrowUp') {
          const { selection } = view.state;
          const isAtStart = selection.$anchor.pos === 1; // 光标在开头
          console.log('[TiptapLine] ArrowUp, isAtStart:', isAtStart, 'pos:', selection.$anchor.pos);
          if (isAtStart) {
            event.preventDefault();
            console.log('[TiptapLine] Calling onArrowUp with lineId:', lineId);
            onArrowUp?.(lineId);
            return true;
          }
        }

        if (event.key === 'ArrowDown') {
          const { selection } = view.state;
          const docSize = view.state.doc.content.size;
          const isAtEnd = selection.$anchor.pos >= docSize - 1; // 光标在末尾
          console.log('[TiptapLine] ArrowDown, isAtEnd:', isAtEnd, 'pos:', selection.$anchor.pos, 'docSize:', docSize);
          if (isAtEnd) {
            event.preventDefault();
            console.log('[TiptapLine] Calling onArrowDown with lineId:', lineId);
            onArrowDown?.(lineId);
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
      style={{
        paddingLeft: mode === 'description' ? `${(level + 1) * 24}px` : `${level * 24}px`,
      }}
    >
      <EditorContent editor={editor} />
    </div>
  );
};
