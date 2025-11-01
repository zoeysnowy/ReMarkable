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
    
    const currentLine = lines[currentIndex];
    const isDescriptionMode = (currentLine.data as any)?.mode === 'description';
    
    // 🆕 Shift+Enter: Title ↔ Description 模式切换
    if (e.key === 'Enter' && e.shiftKey) {
      e.preventDefault();
      
      // Title → Description: 创建新的 description 行
      if (!isDescriptionMode) {
        const descLine: FreeFormLine<T> = {
          id: `${lineId}-desc`,
          content: '',
          level: level + 1,
          data: { ...(currentLine.data || {}), mode: 'description' } as T,
        };
        
        // 插入 description 行在当前行后面
        const newLines = [
          ...lines.slice(0, currentIndex + 1),
          descLine,
          ...lines.slice(currentIndex + 1),
        ];
        
        onLinesChange(newLines);
        
        // 聚焦到新创建的 description 行
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${descLine.id}"]`) as HTMLElement;
          element?.focus();
        }, 10);
        return;
      }
      
      // Description → Title: 返回对应的 title 行
      const target = e.currentTarget as HTMLElement;
      const isEmpty = target.textContent?.trim() === '';
      
      // 先保存当前 description 内容（如果有内容）
      if (!isEmpty) {
        handleLineBlur(lineId, target);
      }
      
      // 如果 description 为空，删除该行；否则保留
      const newLines = isEmpty 
        ? lines.filter(l => l.id !== lineId)
        : lines;
      
      onLinesChange(newLines);
      
      // 聚焦到对应的 title 行
      const titleLineId = lineId.replace('-desc', '');
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${titleLineId}"]`) as HTMLElement;
        if (element) {
          element.focus();
          // 光标移到末尾
          const range = document.createRange();
          const sel = window.getSelection();
          range.selectNodeContents(element);
          range.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(range);
        }
      }, 10);
      return;
    }
    
    // Enter: 创建新 Event（title 模式）或在 description 模式下换行
    if (e.key === 'Enter' && !e.shiftKey) {
      // Description 模式：允许换行（多行描述）
      if (isDescriptionMode) {
        // 不阻止默认行为，让浏览器插入 <br>
        return;
      }
      
      // Title 模式：创建新 Event（level 0）
      e.preventDefault();
      
      const newLine: FreeFormLine<T> = {
        id: `line-${Date.now()}`,
        content: '',
        level: 0, // 🎯 新 Event 总是 level 0
        data: { mode: 'title' } as T,
      };
      
      // 🎯 插入到当前 Event 的所有相关行（title + description）之后
      // 找到下一个 level 0 的 title 行，或者到数组末尾
      let insertIndex = currentIndex + 1;
      while (insertIndex < lines.length && lines[insertIndex].level > 0) {
        insertIndex++;
      }
      
      const newLines = [
        ...lines.slice(0, insertIndex),
        newLine,
        ...lines.slice(insertIndex),
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
    
    // Tab: 增加缩进（仅 Title 模式）
    else if (e.key === 'Tab' && !e.shiftKey && !isDescriptionMode) {
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
      
      if (isDescriptionMode) {
        // Description 模式：减少缩进，如果已经 level 0 则转换为 Title
        if (level > 0) {
          // 减少缩进
          const updatedLines = lines.map(line =>
            line.id === lineId
              ? { ...line, level: Math.max(line.level - 1, 0) }
              : line
          );
          onLinesChange(updatedLines);
        } else {
          // level 0：转换为 Title 模式
          const target = e.currentTarget as HTMLElement;
          const content = target.innerHTML;
          
          // 保存当前 description 内容
          handleLineBlur(lineId, target);
          
          // 删除 description 行，创建新的 title 行
          const newLine: FreeFormLine<T> = {
            id: `line-${Date.now()}`,
            content,
            level: 0,
            data: { mode: 'title' } as T,
          };
          
          const newLines = [
            ...lines.slice(0, currentIndex),
            newLine,
            ...lines.slice(currentIndex + 1),
          ];
          
          onLinesChange(newLines);
          
          // 聚焦到新行
          setTimeout(() => {
            const element = document.querySelector(`[data-line-id="${newLine.id}"]`) as HTMLElement;
            if (element) {
              element.focus();
              // 光标移到末尾
              const range = document.createRange();
              const sel = window.getSelection();
              range.selectNodeContents(element);
              range.collapse(false);
              sel?.removeAllRanges();
              sel?.addRange(range);
            }
          }, 10);
        }
      } else {
        // Title 模式：减少缩进
        const updatedLines = lines.map(line =>
          line.id === lineId
            ? { ...line, level: Math.max(line.level - 1, 0) }
            : line
        );
        onLinesChange(updatedLines);
      }
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
      {lines.map((line) => {
        const isDescriptionMode = (line.data as any)?.mode === 'description';
        
        return (
          <div
            key={line.id}
            className="free-form-line"
            style={{
              display: 'flex',
              alignItems: 'flex-start', // 🔧 改为顶部对齐，防止多行文本时首行向上移动
              marginBottom: '4px',
              paddingLeft: isDescriptionMode ? `${(line.level + 1) * 24}px` : `${line.level * 24}px`, // 🆕 description 模式额外缩进
              width: '100%', // 🔧 确保占满宽度，suffix 才能右对齐到边缘
            }}
          >
            {/* 前缀装饰（Checkbox、Emoji 等）- Description 模式不显示 */}
            {renderLinePrefix && !isDescriptionMode && (
              <span className="line-prefix" style={{ 
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                paddingTop: '2px' // 🔧 轻微向下偏移，与首行文字对齐
              }}>
                {renderLinePrefix(line)}
              </span>
            )}
            
            {/* 可编辑文本 */}
            <span
              className={`line-text ${isDescriptionMode ? 'description-mode' : ''}`}
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
                // 🆕 Description 模式样式
                ...(isDescriptionMode && {
                  fontSize: '13px',
                  color: '#6b7280',
                  lineHeight: '1.6',
                  fontStyle: 'italic',
                }),
              }}
            />
            
            {/* 后缀装饰（标签、时间等）- Description 模式不显示 */}
            {renderLineSuffix && !isDescriptionMode && (
              <span className="line-suffix" style={{ marginLeft: 'auto', paddingLeft: '8px' }}>
                {renderLineSuffix(line)}
              </span>
            )}
          </div>
        );
      })}
      
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
