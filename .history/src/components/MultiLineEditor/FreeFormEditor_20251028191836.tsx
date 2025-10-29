/**
 * FreeFormEditor - 混合模式编辑器（类似 Notion）
 * 
 * 架构：
 * 1. 一个大的 contentEditable 容器
 * 2. 每一行包含：
 *    - contentEditable="false" 的装饰元素（Checkbox、Emoji）
 *    - contentEditable="true" 的文本 span
 * 3. 用户可以自由编辑文本，但装饰元素保持可交互且不被编辑
 * 
 * 优势：
 * - 像文本编辑器一样流畅的多行编辑
 * - Checkbox 等元素真实可点击
 * - 支持 Enter 换行、Backspace 删除
 */

import React, { useRef, useCallback, useState, useEffect } from 'react';
import './FreeFormEditor.css';

export interface FreeFormLine<T = any> {
  id: string;
  content: string;  // 纯文本内容
  level: number;    // 缩进层级
  data?: T;         // 业务数据（如 completed、tags 等）
}

export interface FreeFormEditorProps<T = any> {
  // 行数据
  lines: FreeFormLine<T>[];
  
  // 行数据变化回调
  onLinesChange: (lines: FreeFormLine<T>[]) => void;
  
  // 渲染行内不可编辑装饰（Checkbox、Emoji）
  // 这些元素会被设置为 contentEditable="false"
  renderLinePrefix?: (line: FreeFormLine<T>) => React.ReactNode;
  
  // 渲染行尾装饰（标签、时间等）
  renderLineSuffix?: (line: FreeFormLine<T>) => React.ReactNode;
  
  // 行点击回调
  onLineClick?: (line: FreeFormLine<T>) => void;
  
  // Placeholder
  placeholder?: string;
  
  // CSS
  className?: string;
  style?: React.CSSProperties;
}

export const FreeFormEditor = <T,>({
  lines,
  onLinesChange,
  renderLineDecorator,
  placeholder = '开始输入...',
  className = '',
  style,
}: FreeFormEditorProps<T>) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [internalLines, setInternalLines] = useState<FreeFormLine<T>[]>(lines);
  
  // ==================== 文本 → 行结构解析 ====================
  const parseTextToLines = useCallback((text: string): FreeFormLine<T>[] => {
    const textLines = text.split('\n');
    
    return textLines.map((lineText, index) => {
      // 计算缩进层级（每 2 个空格 = 1 级）
      const leadingSpaces = lineText.match(/^(\s*)/)?.[0].length || 0;
      const level = Math.floor(leadingSpaces / 2);
      const content = lineText.trim();
      
      // 尝试匹配现有行的 ID，否则创建新 ID
      const existingLine = internalLines[index];
      const id = existingLine?.id || `line-${Date.now()}-${index}`;
      
      return {
        id,
        content,
        level,
        data: existingLine?.data,
      };
    });
  }, [internalLines]);
  
  // ==================== 行结构 → HTML ====================
  const linesToHTML = useCallback((linesToConvert: FreeFormLine<T>[]): string => {
    return linesToConvert
      .map(line => {
        const indent = '  '.repeat(line.level);  // 每级 2 个空格
        return `${indent}${line.content}`;
      })
      .join('\n');
  }, []);
  
  // ==================== 监听输入 ====================
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    
    const text = editorRef.current.innerText || '';
    const parsedLines = parseTextToLines(text);
    
    setInternalLines(parsedLines);
    onLinesChange(parsedLines);
  }, [parseTextToLines, onLinesChange]);
  
  // ==================== 初始化内容 ====================
  useEffect(() => {
    if (editorRef.current && lines.length > 0) {
      const html = linesToHTML(lines);
      if (editorRef.current.innerText !== html) {
        editorRef.current.innerText = html;
      }
    }
  }, []);  // 只在挂载时执行一次
  
  // ==================== 键盘快捷键 ====================
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // Tab: 增加缩进
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      document.execCommand('insertText', false, '  ');  // 插入 2 个空格
    }
    
    // Shift+Tab: 减少缩进
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      
      const selection = window.getSelection();
      if (!selection || !editorRef.current) return;
      
      const range = selection.getRangeAt(0);
      const currentLine = range.startContainer.textContent || '';
      
      // 删除行首的 2 个空格
      if (currentLine.startsWith('  ')) {
        const textNode = range.startContainer as Text;
        textNode.textContent = currentLine.substring(2);
        
        // 保持光标位置
        const newRange = document.createRange();
        newRange.setStart(textNode, Math.max(0, range.startOffset - 2));
        newRange.collapse(true);
        selection.removeAllRanges();
        selection.addRange(newRange);
        
        handleInput();
      }
    }
  }, [handleInput]);
  
  // ==================== 渲染 ====================
  return (
    <div className={`free-form-editor-container ${className}`} style={style}>
      {/* 装饰层 - 绝对定位在文本上方 */}
      {renderLineDecorator && (
        <div className="decorator-layer">
          {internalLines.map((line, index) => (
            <div
              key={line.id}
              className="line-decorator"
              style={{
                top: `${index * 32}px`,  // 假设每行 32px 高
                left: `${line.level * 24}px`,  // 假设每级 24px 缩进
              }}
            >
              {renderLineDecorator(line, index)}
            </div>
          ))}
        </div>
      )}
      
      {/* 编辑层 - contentEditable */}
      <div
        ref={editorRef}
        className="free-form-editor"
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        data-placeholder={placeholder}
        spellCheck={false}
        style={{
          outline: 'none',
          border: 'none',
          whiteSpace: 'pre-wrap',  // 保留空格和换行
          wordWrap: 'break-word',
          minHeight: '200px',
          padding: '16px',
          fontFamily: 'monospace',  // 等宽字体便于对齐
          fontSize: '14px',
          lineHeight: '32px',  // 与装饰层对齐
        }}
      />
    </div>
  );
};
