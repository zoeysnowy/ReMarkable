/**
 * Slate 浮动工具栏
 * 
 * 使用 Tippy.js 实现文本选择时的格式化工具栏
 */

import React, { useEffect, useRef, useState } from 'react';
import { Editor, Range } from 'slate';
import { useSlate } from 'slate-react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import 'tippy.js/dist/tippy.css';
import { toggleMark, isMarkActive } from '../utils';
import './SlateFloatingToolbar.css';

export const SlateFloatingToolbar: React.FC = () => {
  const editor = useSlate();
  const toolbarRef = useRef<HTMLDivElement>(null);
  const tippyInstanceRef = useRef<TippyInstance | null>(null);
  const [selection, setSelection] = useState<Range | null>(null);

  // 监听选择变化
  useEffect(() => {
    const { selection } = editor;

    if (
      !selection ||
      !Range.isCollapsed(selection) ||
      Editor.string(editor, selection) === ''
    ) {
      // 没有选择或选择为空，隐藏工具栏
      if (tippyInstanceRef.current) {
        tippyInstanceRef.current.hide();
      }
      setSelection(null);
      return;
    }

    setSelection(selection);

    // 显示工具栏
    if (toolbarRef.current && !tippyInstanceRef.current) {
      const domSelection = window.getSelection();
      if (!domSelection || domSelection.rangeCount === 0) return;

      const domRange = domSelection.getRangeAt(0);
      const rect = domRange.getBoundingClientRect();

      // 创建虚拟元素作为 Tippy 的参考
      const virtualElement = {
        getBoundingClientRect: () => rect,
      };

      tippyInstanceRef.current = tippy(virtualElement as any, {
        content: toolbarRef.current,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'top',
        theme: 'slate-toolbar',
        arrow: true,
        offset: [0, 10],
      });
    } else if (tippyInstanceRef.current) {
      tippyInstanceRef.current.show();
    }

    return () => {
      if (tippyInstanceRef.current) {
        tippyInstanceRef.current.destroy();
        tippyInstanceRef.current = null;
      }
    };
  }, [editor]);

  const handleFormat = (format: 'bold' | 'italic' | 'underline' | 'strikethrough' | 'code') => {
    toggleMark(editor, format);
  };

  if (!selection) {
    return null;
  }

  return (
    <div ref={toolbarRef} className="slate-floating-toolbar">
      <button
        className={`toolbar-button ${isMarkActive(editor, 'bold') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleFormat('bold');
        }}
        title="粗体 (Ctrl+B)"
      >
        <strong>B</strong>
      </button>
      
      <button
        className={`toolbar-button ${isMarkActive(editor, 'italic') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleFormat('italic');
        }}
        title="斜体 (Ctrl+I)"
      >
        <em>I</em>
      </button>
      
      <button
        className={`toolbar-button ${isMarkActive(editor, 'underline') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleFormat('underline');
        }}
        title="下划线 (Ctrl+U)"
      >
        <u>U</u>
      </button>
      
      <button
        className={`toolbar-button ${isMarkActive(editor, 'strikethrough') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleFormat('strikethrough');
        }}
        title="删除线"
      >
        <s>S</s>
      </button>
      
      <button
        className={`toolbar-button ${isMarkActive(editor, 'code') ? 'active' : ''}`}
        onMouseDown={(e) => {
          e.preventDefault();
          handleFormat('code');
        }}
        title="代码"
      >
        <code>&lt;/&gt;</code>
      </button>
    </div>
  );
};
