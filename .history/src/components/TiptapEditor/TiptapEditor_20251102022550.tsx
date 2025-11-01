import React from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import './TiptapEditor.css';

interface TiptapEditorProps {
  content?: string;
  placeholder?: string;
  onUpdate?: (content: string) => void;
  onSubmit?: () => void; // Enter 键提交
  className?: string;
}

/**
 * 基础 Tiptap 编辑器组件
 * 用于替换 contentEditable
 */
export const TiptapEditor: React.FC<TiptapEditorProps> = ({
  content = '',
  placeholder = '开始输入...',
  onUpdate,
  onSubmit,
  className = '',
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // 暂时禁用一些功能，后续逐步启用
        heading: false,
        codeBlock: false,
        horizontalRule: false,
      }),
      Placeholder.configure({
        placeholder,
      }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onUpdate?.(html);
    },
    // 自定义键盘事件
    editorProps: {
      handleKeyDown: (view, event) => {
        // Enter 键提交（不创建新段落）
        if (event.key === 'Enter' && !event.shiftKey) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
  });

  return (
    <div className={`tiptap-editor ${className}`}>
      <EditorContent editor={editor} />
    </div>
  );
};
