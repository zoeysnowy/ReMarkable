import React, { useEffect, useRef } from 'react';
import { useEditor, EditorContent, Editor, BubbleMenu } from '@tiptap/react';
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 保持 paragraph 启用；Title 单行通过键盘事件控制
        heading: false,
        codeBlock: false,
        horizontalRule: false,
        // 启用列表支持，供 description 使用
        bulletList: true,
        orderedList: true,
        listItem: true,
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
          console.log('[TiptapLine] ArrowUp, isAtStart:', isAtStart, 'pos:', selection.$anchor.pos, 'lineId:', lineId);
          if (isAtStart) {
            event.preventDefault();
            console.log('[TiptapLine] Calling onArrowUp');
            onArrowUp?.();
            return true;
          }
        }

        if (event.key === 'ArrowDown') {
          const { selection } = view.state;
          const docSize = view.state.doc.content.size;
          const isAtEnd = selection.$anchor.pos >= docSize - 1; // 光标在末尾
          console.log('[TiptapLine] ArrowDown, isAtEnd:', isAtEnd, 'pos:', selection.$anchor.pos, 'docSize:', docSize, 'lineId:', lineId);
          if (isAtEnd) {
            event.preventDefault();
            console.log('[TiptapLine] Calling onArrowDown');
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
      onEditorReady?.(lineId, editor);
      return () => {
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
      style={undefined}
    >
      {editor && mode === 'description' && (
        <BubbleMenu editor={editor} tippyOptions={{ duration: 100 }}>
          <div style={{ display: 'flex', gap: 6, padding: '6px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, boxShadow: '0 4px 14px rgba(0,0,0,0.08)' }}>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBold().run()} style={{ fontWeight: 700 }}>B</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleItalic().run()} style={{ fontStyle: 'italic' }}>I</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleUnderline().run()} style={{ textDecoration: 'underline' }}>U</button>
            <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleBulletList().run()}>●• 列表</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. 列表</button>
            <span style={{ width: 1, background: '#e5e7eb', margin: '0 4px' }} />
            {/* 字体颜色 */}
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setColor('#ef4444').run()} style={{ color: '#ef4444' }}>A</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setColor('#3b82f6').run()} style={{ color: '#3b82f6' }}>A</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetColor().run()}>清色</button>
            {/* 高亮（用 TextStyle 的 backgroundColor 模拟） */}
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setMark('textStyle', { backgroundColor: '#fde68a' }).run()} style={{ background: '#fde68a' }}>HL</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().setMark('textStyle', { backgroundColor: '#a7f3d0' }).run()} style={{ background: '#a7f3d0' }}>HL</button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => editor.chain().focus().unsetMark('textStyle').run()}>清高亮</button>
          </div>
        </BubbleMenu>
      )}
      <EditorContent editor={editor} />
    </div>
  );
};
