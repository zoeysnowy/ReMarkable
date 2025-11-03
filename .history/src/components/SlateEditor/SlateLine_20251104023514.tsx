/**
 * SlateLine - 单行 Slate 编辑器
 * 
 * 用于替代 TiptapLine，每行作为独立的 Slate 实例
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
import { useAndroidPlugin } from 'slate-android-plugin';
import { TagElementComponent } from './elements/TagElement';
import { DateMentionElementComponent } from './elements/DateMentionElement';
import { deserializeFromHtml, serializeToHtml, isInlineElement, createEmptyParagraph } from './utils';
import './SlateLine.css';

interface SlateLineProps {
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
}

/**
 * 自定义 Slate 编辑器配置
 */
const withCustom = (editor: Editor) => {
  const { isInline, isVoid } = editor;

  // 定义 inline 和 void 元素
  editor.isInline = element => {
    return (element.type === 'tag' || element.type === 'dateMention') ? true : isInline(element);
  };

  editor.isVoid = element => {
    return (element.type === 'tag' || element.type === 'dateMention') ? true : isVoid(element);
  };

  return editor;
};

/**
 * SlateLine 组件
 */
export const SlateLine: React.FC<SlateLineProps> = ({
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
}) => {
  // 创建编辑器实例 - 应用插件链（正确顺序）：
  // 1. createEditor() - 创建基础编辑器
  // 2. withReact() - React 绑定（必须在最内层，处理输入法事件）
  // 3. withHistory() - 撤销/重做
  // 4. withCustom() - 自定义配置
  // 5. useAndroidPlugin() - Android 兼容（最外层）
  const baseEditor = useMemo(() => withCustom(withHistory(withReact(createEditor()))), []);
  
  // 应用 Android 插件（使用 Hook，确保移动端兼容性）
  const editor = useAndroidPlugin(baseEditor);
  
  // 🆕 使用 key 强制重新挂载编辑器（当 content 从外部完全改变时）
  const [editorKey, setEditorKey] = useState(0);
  
  // 初始化内容
  const [value, setValue] = useState<Descendant[]>(() => {
    try {
      const parsed = deserializeFromHtml(content || '<p></p>');
      return parsed.length > 0 ? parsed : [createEmptyParagraph()];
    } catch (e) {
      console.error('[SlateLine] Failed to parse content:', e);
      return [createEmptyParagraph()];
    }
  });

  // 🆕 使用 ref 跟踪上一次的 content，检测是否需要重新初始化
  const prevContentRef = React.useRef(content);
  const isUserChangeRef = React.useRef(false);

  // 当外部 content 发生重大变化时，重新初始化编辑器
  useEffect(() => {
    // 🆕 如果是用户操作引起的变化，跳过
    if (isUserChangeRef.current) {
      isUserChangeRef.current = false;
      return;
    }

    // 检测 content 是否有实质性变化
    const currentHtml = serializeToHtml(value);
    const contentChanged = content !== prevContentRef.current && content !== currentHtml;
    
    if (contentChanged) {
      try {
        const newValue = deserializeFromHtml(content || '<p></p>');
        if (newValue.length > 0) {
          // 🆕 强制重新挂载编辑器以避免状态冲突
          setEditorKey(prev => prev + 1);
          setValue(newValue);
        }
      } catch (e) {
        console.error('[SlateLine] Failed to update content:', e);
      }
      prevContentRef.current = content;
    }
  }, [content, value]);

  // 渲染元素
  const renderElement = useCallback((props: RenderElementProps) => {
    switch (props.element.type) {
      case 'tag':
        return <TagElementComponent {...props} />;
      case 'dateMention':
        return <DateMentionElementComponent {...props} />;
      case 'paragraph':
        return <p {...props.attributes}>{props.children}</p>;
      default:
        return <p {...props.attributes}>{props.children}</p>;
    }
  }, []);

  // 渲染文本叶子节点
  const renderLeaf = useCallback((props: RenderLeafProps) => {
    let { children } = props;
    const { leaf } = props;

    if (leaf.bold) {
      children = <strong>{children}</strong>;
    }
    if (leaf.italic) {
      children = <em>{children}</em>;
    }
    if (leaf.underline) {
      children = <u>{children}</u>;
    }
    if (leaf.strikethrough) {
      children = <s>{children}</s>;
    }
    if (leaf.code) {
      children = <code>{children}</code>;
    }
    if (leaf.color) {
      children = <span style={{ color: leaf.color }}>{children}</span>;
    }

    return <span {...props.attributes}>{children}</span>;
  }, []);

  // 处理内容变化
  const handleChange = useCallback((newValue: Descendant[]) => {
    setValue(newValue);
    
    // 🆕 标记这是用户操作引起的变化
    isUserChangeRef.current = true;
    
    // 序列化并通知父组件
    const html = serializeToHtml(newValue);
    onUpdate(html);
  }, [onUpdate]);

  // 处理键盘事件
  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const { selection } = editor;

    // 格式化快捷键
    if ((event.ctrlKey || event.metaKey) && !event.shiftKey && !event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'b':
          event.preventDefault();
          Editor.addMark(editor, 'bold', true);
          return;
        case 'i':
          event.preventDefault();
          Editor.addMark(editor, 'italic', true);
          return;
        case 'u':
          event.preventDefault();
          Editor.addMark(editor, 'underline', true);
          return;
      }
    }

    // Enter 键
    if (event.key === 'Enter') {
      if (event.shiftKey) {
        // Shift+Enter: Description 模式换行，Title 模式创建描述行
        if (mode === 'description') {
          // 默认行为：换行
          return;
        } else {
          event.preventDefault();
          onShiftEnter?.();
        }
      } else {
        event.preventDefault();
        
        if (mode === 'title') {
          // Title 模式：创建新行
          onEnter?.();
        } else {
          // Description 模式：换行
          editor.insertBreak();
        }
      }
      return;
    }

    // Tab 键
    if (event.key === 'Tab') {
      event.preventDefault();
      if (event.shiftKey) {
        onShiftTab?.();
      } else {
        onTab?.();
      }
      return;
    }

    // 上下箭头键
    if (event.key === 'ArrowUp') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [start] = Range.edges(selection);
        const isAtStart = Editor.isStart(editor, start, start.path);
        if (isAtStart) {
          event.preventDefault();
          onArrowUp?.();
        }
      }
      return;
    }

    if (event.key === 'ArrowDown') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [end] = Range.edges(selection);
        const isAtEnd = Editor.isEnd(editor, end, end.path);
        if (isAtEnd) {
          event.preventDefault();
          onArrowDown?.();
        }
      }
      return;
    }

    // Backspace 删除空行或退出 description 模式
    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [start] = Range.edges(selection);
        const isAtStart = Editor.isStart(editor, start, start.path);
        const isEmpty = Editor.string(editor, []) === '';
        
        // 如果在 description 模式下，光标在开头且内容为空，退出 description 模式
        if (mode === 'description' && isAtStart && isEmpty) {
          event.preventDefault();
          onDelete?.(); // 通知父组件删除此 description 行，回到 title 模式
          return;
        }
        
        // Title 模式下，删除空行
        if (mode === 'title' && isAtStart && isEmpty) {
          event.preventDefault();
          onDelete?.();
          return;
        }
      }
      return;
    }
  }, [editor, mode, onEnter, onShiftEnter, onTab, onShiftTab, onArrowUp, onArrowDown, onDelete]);

  return (
    <div 
      className={`slate-line ${mode === 'description' ? 'slate-line-description' : ''} ${className}`}
      data-line-id={lineId}
      data-mode={mode}
    >
      <Slate 
        key={editorKey} 
        editor={editor} 
        initialValue={value} 
        onChange={handleChange}
      >
        <Editable
          renderElement={renderElement}
          renderLeaf={renderLeaf}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          spellCheck={false}
        />
      </Slate>
    </div>
  );
};
