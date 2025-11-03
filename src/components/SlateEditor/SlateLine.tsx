/**
 * SlateLine - 单行 Slate 编辑器
 * 
 * 用于替代 TiptapLine，每行作为独立的 Slate 实例
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createEditor, Descendant, Editor, Transforms, Range, Element as SlateElement } from 'slate';
import { Slate, Editable, withReact, RenderElementProps, RenderLeafProps } from 'slate-react';
import { withHistory } from 'slate-history';
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
  // 创建编辑器实例
  const editor = useMemo(() => withCustom(withHistory(withReact(createEditor()))), []);
  
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

  // 当外部 content 变化时更新
  useEffect(() => {
    try {
      const newValue = deserializeFromHtml(content || '<p></p>');
      if (newValue.length > 0 && JSON.stringify(newValue) !== JSON.stringify(value)) {
        setValue(newValue);
        editor.children = newValue;
        Editor.normalize(editor, { force: true });
      }
    } catch (e) {
      console.error('[SlateLine] Failed to update content:', e);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

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

    // Backspace 删除空行
    if (event.key === 'Backspace') {
      const { selection } = editor;
      if (selection && Range.isCollapsed(selection)) {
        const [start] = Range.edges(selection);
        const isAtStart = Editor.isStart(editor, start, start.path);
        const isEmpty = Editor.string(editor, []) === '';
        
        if (isAtStart && isEmpty) {
          event.preventDefault();
          onDelete?.();
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
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
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
