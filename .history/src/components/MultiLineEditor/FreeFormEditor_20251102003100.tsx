/**
 * FreeFormEditor - 简化版编辑器（参照 TagManager）
 * 
 * 架构：
 * 1. 外层普通 div 容器（不是 contentEditable）
 * 2. 每一行包含：
 *    - 普通 span/div 装饰元素（Checkbox、Emoji）
 *    - contentEditable span 文本
 * 3. Enter 键通过逻辑创建新行，而不是依赖浏览器换行
 * 
 * 这个架构与 TagManager 完全一致！
 */

import React, { useCallback, useRef, useEffect } from 'react';
import './FreeFormEditor.css';

export interface FreeFormLine<T = any> {
  id: string;
  content: string;
  level: number;
  data?: T;
}

export interface FreeFormEditorProps<T = any> {
  lines: FreeFormLine<T>[];
  onLinesChange: (lines: FreeFormLine<T>[]) => void;
  renderLinePrefix?: (line: FreeFormLine<T>) => React.ReactNode;
  renderLineSuffix?: (line: FreeFormLine<T>) => React.ReactNode;
  onLineClick?: (line: FreeFormLine<T>) => void;
  placeholder?: string;
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
  
  // 记录已经初始化过内容的行
  const initializedLinesRef = useRef<Set<string>>(new Set());
  
  // 当 lines 变化时，重置初始化标记（除非是用户正在编辑）
  useEffect(() => {
    const activeElement = document.activeElement;
    const activeLineId = activeElement?.getAttribute('data-line-id');
    
    // 清除不存在的行的标记
    const currentLineIds = new Set(lines.map(l => l.id));
    initializedLinesRef.current.forEach(lineId => {
      if (!currentLineIds.has(lineId)) {
        initializedLinesRef.current.delete(lineId);
      }
    });
    
    // 更新内容（跳过正在编辑的行）
    lines.forEach(line => {
      if (line.id !== activeLineId) {
        const element = document.querySelector(`[data-line-id="${line.id}"]`) as HTMLElement;
        if (element && element.innerHTML !== line.content) {
          element.innerHTML = line.content || '';
        }
      }
    });
  }, [lines]);
  
  // ==================== 文本保存 ====================
  const handleLineBlur = useCallback((lineId: string, element: HTMLElement) => {
    // 保存整个 innerHTML（包含标签 spans）
    const content = element.innerHTML;
    const updatedLines = lines.map(line =>
      line.id === lineId ? { ...line, content } : line
    );
    onLinesChange(updatedLines);
  }, [lines, onLinesChange]);
  
  // ==================== 键盘事件 ====================
  const handleLineKeyDown = useCallback((
    e: React.KeyboardEvent,
    lineId: string,
    level: number
  ) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    // Enter: 创建新行
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      
      const newLine: FreeFormLine<T> = {
        id: `line-${Date.now()}`,
        content: '',
        level,
        data: undefined,
      };
      
      const newLines = [
        ...lines.slice(0, currentIndex + 1),
        newLine,
        ...lines.slice(currentIndex + 1),
      ];
      
      onLinesChange(newLines);
      
      // 聚焦到新行
      setTimeout(() => {
        const newElement = document.querySelector(
          `[data-line-id="${newLine.id}"]`
        ) as HTMLElement;
        newElement?.focus();
      }, 10);
    }
    
    // Backspace: 删除标签或删除空行
    else if (e.key === 'Backspace') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // 检查光标前面是否是标签
        if (range.collapsed) {
          const container = range.startContainer;
          const offset = range.startOffset;
          
          // 如果光标在文本节点开头
          if (container.nodeType === Node.TEXT_NODE && offset === 0) {
            const prevSibling = container.previousSibling;
            // 如果前一个兄弟节点是标签
            if (prevSibling && (prevSibling as HTMLElement).classList?.contains('inline-tag')) {
              e.preventDefault();
              prevSibling.remove();
              // 触发保存
              const target = e.currentTarget as HTMLElement;
              handleLineBlur(lineId, target);
              return;
            }
          }
          // 如果光标在元素开头
          else if (container.nodeType === Node.ELEMENT_NODE) {
            const childAtOffset = (container as Element).childNodes[offset - 1];
            if (childAtOffset && (childAtOffset as HTMLElement).classList?.contains('inline-tag')) {
              e.preventDefault();
              childAtOffset.remove();
              // 触发保存
              const target = e.currentTarget as HTMLElement;
              handleLineBlur(lineId, target);
              return;
            }
          }
        }
      }
      
      // 原有逻辑：如果内容为空，删除行并聚焦上一行
      const target = e.currentTarget as HTMLElement;
      if (target.textContent === '' && currentIndex > 0) {
        e.preventDefault();
        
        const newLines = lines.filter(l => l.id !== lineId);
        onLinesChange(newLines);
        
        // 聚焦到上一行
        setTimeout(() => {
          const prevLineId = lines[currentIndex - 1].id;
          const prevElement = document.querySelector(
            `[data-line-id="${prevLineId}"]`
          ) as HTMLElement;
          if (prevElement) {
            prevElement.focus();
            // 光标移到末尾
            const range = document.createRange();
            const sel = window.getSelection();
            range.selectNodeContents(prevElement);
            range.collapse(false);
            sel?.removeAllRanges();
            sel?.addRange(range);
          }
        }, 10);
      }
    }
    
    // Delete: 删除光标后的标签
    else if (e.key === 'Delete') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        
        // 检查光标后面是否是标签
        if (range.collapsed) {
          const container = range.startContainer;
          const offset = range.startOffset;
          
          // 如果光标在文本节点末尾
          if (container.nodeType === Node.TEXT_NODE && offset === container.textContent!.length) {
            const nextSibling = container.nextSibling;
            // 如果后一个兄弟节点是标签
            if (nextSibling && (nextSibling as HTMLElement).classList?.contains('inline-tag')) {
              e.preventDefault();
              nextSibling.remove();
              // 触发保存
              const target = e.currentTarget as HTMLElement;
              handleLineBlur(lineId, target);
              return;
            }
          }
          // 如果光标在元素中
          else if (container.nodeType === Node.ELEMENT_NODE) {
            const childAtOffset = (container as Element).childNodes[offset];
            if (childAtOffset && (childAtOffset as HTMLElement).classList?.contains('inline-tag')) {
              e.preventDefault();
              childAtOffset.remove();
              // 触发保存
              const target = e.currentTarget as HTMLElement;
              handleLineBlur(lineId, target);
              return;
            }
          }
        }
      }
    }
    
    // Tab: 增加缩进
    else if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const updatedLines = lines.map(line =>
        line.id === lineId
          ? { ...line, level: Math.min(line.level + 1, 5) }
          : line
      );
      onLinesChange(updatedLines);
    }
    
    // Shift+Tab: 减少缩进
    else if (e.key === 'Tab' && e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      
      const updatedLines = lines.map(line =>
        line.id === lineId
          ? { ...line, level: Math.max(line.level - 1, 0) }
          : line
      );
      onLinesChange(updatedLines);
    }
    
    // 上箭头: 聚焦到上一行
    else if (e.key === 'ArrowUp' && currentIndex > 0) {
      e.preventDefault();
      const prevLineId = lines[currentIndex - 1].id;
      const prevElement = document.querySelector(
        `[data-line-id="${prevLineId}"]`
      ) as HTMLElement;
      prevElement?.focus();
    }
    
    // 下箭头: 聚焦到下一行
    else if (e.key === 'ArrowDown' && currentIndex < lines.length - 1) {
      e.preventDefault();
      const nextLineId = lines[currentIndex + 1].id;
      const nextElement = document.querySelector(
        `[data-line-id="${nextLineId}"]`
      ) as HTMLElement;
      nextElement?.focus();
    }
  }, [lines, onLinesChange]);
  
  // ==================== Gray Text 点击 ====================
  const handleGrayTextClick = useCallback(() => {
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: 0,
      data: undefined,
    };
    
    onLinesChange([...lines, newLine]);
    
    setTimeout(() => {
      const newElement = document.querySelector(
        `[data-line-id="${newLine.id}"]`
      ) as HTMLElement;
      newElement?.focus();
    }, 10);
  }, [lines, onLinesChange]);
  
  // ==================== 渲染 ====================
  return (
    <div className={`free-form-editor ${className}`} style={style}>
      {lines.map((line) => (
        <div
          key={line.id}
          className="free-form-line"
          style={{
            display: 'flex',
            alignItems: 'flex-start', // 🔧 改为顶部对齐，防止多行文本时首行向上移动
            marginBottom: '4px',
            paddingLeft: `${line.level * 24}px`,
          }}
        >
          {/* 前缀装饰（Checkbox、Emoji 等）*/}
          {renderLinePrefix && (
            <span className="line-prefix" style={{ marginRight: '8px' }}>
              {renderLinePrefix(line)}
            </span>
          )}
          
          {/* 可编辑文本 */}
          <span
            className="line-text"
            data-line-id={line.id}
            contentEditable
            suppressContentEditableWarning
            onBlur={(e) => handleLineBlur(line.id, e.currentTarget)}
            onKeyDown={(e) => handleLineKeyDown(e, line.id, line.level)}
            onClick={() => onLineClick?.(line)}
            ref={(el) => {
              if (el && !initializedLinesRef.current.has(line.id)) {
                // 只在首次渲染时设置 innerHTML
                if (el.innerHTML !== line.content) {
                  el.innerHTML = line.content || '';
                }
                initializedLinesRef.current.add(line.id);
              }
            }}
            style={{
              outline: 'none',
              border: 'none',
              background: 'transparent',
              flex: 1,
              cursor: 'text',
              userSelect: 'text',
              minWidth: '100px',
            }}
          />
          
          {/* 后缀装饰（标签、时间等）*/}
          {renderLineSuffix && (
            <span className="line-suffix" style={{ marginLeft: '8px' }}>
              {renderLineSuffix(line)}
            </span>
          )}
        </div>
      ))}
      
      {/* Gray Text 提示 */}
      <div
        className="gray-text-placeholder"
        onClick={handleGrayTextClick}
        style={{
          padding: '8px 16px',
          color: '#9ca3af',
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        {placeholder}
      </div>
    </div>
  );
};
