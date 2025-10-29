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
  renderLinePrefix,
  renderLineSuffix,
  onLineClick,
  placeholder = '开始输入...',
  className = '',
  style,
}: FreeFormEditorProps<T>) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [internalLines, setInternalLines] = useState<FreeFormLine<T>[]>(lines);
  
  // ==================== 同步外部数据 ====================
  useEffect(() => {
    setInternalLines(lines);
  }, [lines]);
  
  // ==================== 监听内容变化 ====================
  const handleInput = useCallback(() => {
    if (!editorRef.current) return;
    
    // 遍历所有行元素，提取内容
    const lineElements = editorRef.current.querySelectorAll('.free-form-line');
    const updatedLines: FreeFormLine<T>[] = [];
    
    lineElements.forEach((lineElement, index) => {
      const lineId = lineElement.getAttribute('data-line-id');
      const textSpan = lineElement.querySelector('.line-text') as HTMLElement;
      const content = textSpan?.innerText || '';
      
      const existingLine = internalLines.find(l => l.id === lineId);
      
      updatedLines.push({
        id: lineId || `line-${Date.now()}-${index}`,
        content,
        level: existingLine?.level || 0,
        data: existingLine?.data,
      });
    });
    
    setInternalLines(updatedLines);
    onLinesChange(updatedLines);
  }, [internalLines, onLinesChange]);
  
  // ==================== Enter 键创建新行 ====================
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const selection = window.getSelection();
    if (!selection || !editorRef.current) return;
    
    // Enter: 创建新行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      // 获取当前行
      const range = selection.getRangeAt(0);
      let currentLineElement = range.startContainer as Node;
      
      // 向上查找到 .free-form-line 元素
      while (currentLineElement && !(currentLineElement as Element).classList?.contains('free-form-line')) {
        currentLineElement = currentLineElement.parentNode!;
      }
      
      if (!currentLineElement) return;
      
      const currentLineId = (currentLineElement as Element).getAttribute('data-line-id');
      const currentLineIndex = internalLines.findIndex(l => l.id === currentLineId);
      
      if (currentLineIndex === -1) return;
      
      // 创建新行
      const newLine: FreeFormLine<T> = {
        id: `line-${Date.now()}`,
        content: '',
        level: internalLines[currentLineIndex].level,
        data: undefined,
      };
      
      const newLines = [
        ...internalLines.slice(0, currentLineIndex + 1),
        newLine,
        ...internalLines.slice(currentLineIndex + 1),
      ];
      
      setInternalLines(newLines);
      onLinesChange(newLines);
      
      // 聚焦到新行
      setTimeout(() => {
        const newLineElement = editorRef.current?.querySelector(`[data-line-id="${newLine.id}"] .line-text`) as HTMLElement;
        if (newLineElement) {
          newLineElement.focus();
          
          // 将光标移到开头
          const newRange = document.createRange();
          const sel = window.getSelection();
          newRange.setStart(newLineElement, 0);
          newRange.collapse(true);
          sel?.removeAllRanges();
          sel?.addRange(newRange);
        }
      }, 10);
    }
    
    // Tab: 增加缩进
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      
      const range = selection.getRangeAt(0);
      let currentLineElement = range.startContainer as Node;
      
      while (currentLineElement && !(currentLineElement as Element).classList?.contains('free-form-line')) {
        currentLineElement = currentLineElement.parentNode!;
      }
      
      if (!currentLineElement) return;
      
      const currentLineId = (currentLineElement as Element).getAttribute('data-line-id');
      const updatedLines = internalLines.map(line => 
        line.id === currentLineId 
          ? { ...line, level: Math.min(line.level + 1, 5) }
          : line
      );
      
      setInternalLines(updatedLines);
      onLinesChange(updatedLines);
    }
    
    // Shift+Tab: 减少缩进
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      
      const range = selection.getRangeAt(0);
      let currentLineElement = range.startContainer as Node;
      
      while (currentLineElement && !(currentLineElement as Element).classList?.contains('free-form-line')) {
        currentLineElement = currentLineElement.parentNode!;
      }
      
      if (!currentLineElement) return;
      
      const currentLineId = (currentLineElement as Element).getAttribute('data-line-id');
      const updatedLines = internalLines.map(line => 
        line.id === currentLineId 
          ? { ...line, level: Math.max(line.level - 1, 0) }
          : line
      );
      
      setInternalLines(updatedLines);
      onLinesChange(updatedLines);
    }
    
    // Backspace: 如果内容为空，删除行
    else if (e.key === 'Backspace') {
      const range = selection.getRangeAt(0);
      const textSpan = range.startContainer.parentElement;
      
      if (textSpan?.classList.contains('line-text') && textSpan.innerText === '' && range.startOffset === 0) {
        e.preventDefault();
        
        let currentLineElement = textSpan.parentElement;
        if (!currentLineElement?.classList.contains('free-form-line')) return;
        
        const currentLineId = currentLineElement.getAttribute('data-line-id');
        const currentLineIndex = internalLines.findIndex(l => l.id === currentLineId);
        
        if (currentLineIndex > 0) {
          // 删除当前行，聚焦到上一行
          const newLines = internalLines.filter(l => l.id !== currentLineId);
          setInternalLines(newLines);
          onLinesChange(newLines);
          
          setTimeout(() => {
            const prevLineId = internalLines[currentLineIndex - 1].id;
            const prevLineText = editorRef.current?.querySelector(`[data-line-id="${prevLineId}"] .line-text`) as HTMLElement;
            if (prevLineText) {
              prevLineText.focus();
              
              // 光标移到末尾
              const newRange = document.createRange();
              const sel = window.getSelection();
              newRange.selectNodeContents(prevLineText);
              newRange.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(newRange);
            }
          }, 10);
        }
      }
    }
  }, [internalLines, onLinesChange]);
  
  // ==================== 渲染 ====================
  return (
    <div
      ref={editorRef}
      className={`free-form-editor ${className}`}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      style={{
        outline: 'none',
        padding: '16px',
        minHeight: '200px',
        ...style,
      }}
    >
      {internalLines.map((line) => (
        <div
          key={line.id}
          className="free-form-line"
          data-line-id={line.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            paddingLeft: `${line.level * 24}px`,
            minHeight: '32px',
          }}
          onClick={() => onLineClick?.(line)}
        >
          {/* 不可编辑的前缀装饰 */}
          {renderLinePrefix && (
            <span
              className="line-prefix"
              contentEditable={false}
              suppressContentEditableWarning
              style={{
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {renderLinePrefix(line)}
            </span>
          )}
          
          {/* 可编辑的文本内容 */}
          <span
            className="line-text"
            contentEditable
            suppressContentEditableWarning
            style={{
              flex: 1,
              outline: 'none',
              border: 'none',
              minWidth: '100px',
            }}
          >
            {line.content}
          </span>
          
          {/* 不可编辑的后缀装饰 */}
          {renderLineSuffix && (
            <span
              className="line-suffix"
              contentEditable={false}
              suppressContentEditableWarning
              style={{
                userSelect: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              {renderLineSuffix(line)}
            </span>
          )}
        </div>
      ))}
      
      {/* 空状态提示 */}
      {internalLines.length === 0 && (
        <div
          className="empty-placeholder"
          style={{
            color: '#9ca3af',
            fontSize: '14px',
            padding: '8px 0',
          }}
        >
          {placeholder}
        </div>
      )}
    </div>
  );
};
