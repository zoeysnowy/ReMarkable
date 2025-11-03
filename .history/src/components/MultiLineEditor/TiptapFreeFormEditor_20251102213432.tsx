/**
 * TiptapFreeFormEditor - 使用 Tiptap 重写的 FreeFormEditor
 * 
 * 关键差异：
 * 1. 每行使用 TiptapLine 替代 contentEditable span
 * 2. Enter/Shift+Enter 逻辑移到 TiptapLine 的 callbacks
 * 3. 保留原有的 prefix/suffix 渲染逻辑
 * 4. 保留 Tab/Shift+Tab/ArrowUp/ArrowDown 逻辑
 */

import React, { useCallback } from 'react';
import { TiptapLine } from '../TiptapEditor/TiptapLine';
import './FreeFormEditor.css';

export interface FreeFormLine<T = any> {
  id: string;
  content: string;
  level: number;
  data?: T;
}

export interface TiptapFreeFormEditorProps<T = any> {
  lines: FreeFormLine<T>[];
  onLinesChange: (lines: FreeFormLine<T>[]) => void;
  renderLinePrefix?: (line: FreeFormLine<T>) => React.ReactNode;
  renderLineSuffix?: (line: FreeFormLine<T>) => React.ReactNode;
  onLineClick?: (line: FreeFormLine<T>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const TiptapFreeFormEditor = <T,>({
  lines,
  onLinesChange,
  renderLinePrefix,
  renderLineSuffix,
  onLineClick,
  placeholder = '开始输入...',
  className = '',
  style,
}: TiptapFreeFormEditorProps<T>) => {
  
  // ==================== TiptapLine Callbacks ====================
  
  /**
   * 处理行内容更新
   */
  const handleLineUpdate = useCallback((lineId: string, html: string) => {
    const updatedLines = lines.map(line =>
      line.id === lineId ? { ...line, content: html } : line
    );
    onLinesChange(updatedLines);
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Enter 键 - 创建新 Event（title 模式）
   */
  const handleLineEnter = useCallback((lineId: string) => {
    console.log('[TiptapFreeFormEditor] handleLineEnter called:', lineId);
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: 0, // 新 Event 总是 level 0
      data: { mode: 'title' } as T,
    };
    
    // 插入到当前 Event 的所有相关行（title + description）之后
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
    
    // 聚焦新行 - 使用 requestAnimationFrame 确保 DOM 已更新
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${newLine.id}"] .ProseMirror`) as HTMLElement;
        if (element) {
          element.focus();
          console.log('[TiptapFreeFormEditor] Focused new line successfully');
        } else {
          console.error('[TiptapFreeFormEditor] Cannot find element for:', newLine.id);
        }
      }, 100);
    });
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Shift+Enter - Title ↔ Description 模式切换
   */
  const handleLineShiftEnter = useCallback((lineId: string) => {
    console.log('[TiptapFreeFormEditor] handleLineShiftEnter called:', lineId);
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    const currentLine = lines[currentIndex];
    const isDescriptionMode = (currentLine.data as any)?.mode === 'description';
    
    if (!isDescriptionMode) {
      // Title → Description: 创建新的 description 行
      const descLine: FreeFormLine<T> = {
        id: `${lineId}-desc`,
        content: '',
        level: currentLine.level + 1,
        data: { ...(currentLine.data || {}), mode: 'description' } as T,
      };
      
      const newLines = [
        ...lines.slice(0, currentIndex + 1),
        descLine,
        ...lines.slice(currentIndex + 1),
      ];
      
      onLinesChange(newLines);
      
      // 聚焦新 description 行
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${descLine.id}"] .ProseMirror`) as HTMLElement;
          if (element) {
            element.focus();
            console.log('[TiptapFreeFormEditor] Focused description line successfully');
          }
        }, 100);
      });
    } else {
      // Description → Title: 删除 description 行（如果为空）
      // TiptapLine 会在 onUpdate 中保存内容
      const isEmpty = !currentLine.content || currentLine.content === '<p></p>';
      
      if (isEmpty) {
        const newLines = lines.filter(l => l.id !== lineId);
        onLinesChange(newLines);
      }
      
      // 聚焦回 title 行
      const titleLineId = lineId.replace('-desc', '');
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${titleLineId}"] .ProseMirror`) as HTMLElement;
          element?.focus();
        }, 100);
      });
    }
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Tab - 增加缩进
   */
  const handleTab = useCallback((lineId: string) => {
    const updatedLines = lines.map(line =>
      line.id === lineId
        ? { ...line, level: Math.min(line.level + 1, 5) }
        : line
    );
    onLinesChange(updatedLines);
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Shift+Tab - 减少缩进
   */
  const handleShiftTab = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    const currentLine = lines[currentIndex];
    const isDescriptionMode = (currentLine.data as any)?.mode === 'description';
    
    if (isDescriptionMode) {
      // Description 模式：减少缩进，如果已经 level 0 则转换为 Title
      if (currentLine.level > 0) {
        const updatedLines = lines.map(line =>
          line.id === lineId
            ? { ...line, level: Math.max(line.level - 1, 0) }
            : line
        );
        onLinesChange(updatedLines);
      } else {
        // level 0：转换为 Title 模式
        const newLine: FreeFormLine<T> = {
          id: `line-${Date.now()}`,
          content: currentLine.content,
          level: 0,
          data: { mode: 'title' } as T,
        };
        
        const newLines = [
          ...lines.slice(0, currentIndex),
          newLine,
          ...lines.slice(currentIndex + 1),
        ];
        
        onLinesChange(newLines);
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
  }, [lines, onLinesChange]);
  
  /**
   * 处理 ArrowUp - 聚焦上一行
   */
  const handleArrowUp = useCallback((lineId: string) => {
    console.log('[TiptapFreeFormEditor] handleArrowUp called:', lineId);
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex > 0) {
      const prevLineId = lines[currentIndex - 1].id;
      const prevElement = document.querySelector(`[data-line-id="${prevLineId}"] .ProseMirror`) as HTMLElement;
      console.log('[TiptapFreeFormEditor] Found prev element:', prevElement);
      prevElement?.focus();
    }
  }, [lines]);
  
  /**
   * 处理 ArrowDown - 聚焦下一行
   */
  const handleArrowDown = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex < lines.length - 1) {
      const nextLineId = lines[currentIndex + 1].id;
      const nextElement = document.querySelector(`[data-line-id="${nextLineId}"] .ProseMirror`) as HTMLElement;
      nextElement?.focus();
    }
  }, [lines]);
  
  /**
   * Gray Text 点击
   */
  const handleGrayTextClick = useCallback(() => {
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: 0,
      data: { mode: 'title' } as T,
    };
    
    onLinesChange([...lines, newLine]);
    
    // 聚焦新行
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${newLine.id}"] .ProseMirror`) as HTMLElement;
        element?.focus();
      }, 100);
    });
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
            data-line-id={line.id}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              marginBottom: '4px',
              paddingLeft: isDescriptionMode 
                ? `${(line.level + 1) * 24}px` 
                : `${line.level * 24}px`,
              width: '100%',
            }}
          >
            {/* 前缀装饰（Checkbox、Emoji 等）- Description 模式不显示 */}
            {renderLinePrefix && !isDescriptionMode && (
              <span className="line-prefix" style={{ 
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center',
                paddingTop: '2px'
              }}>
                {renderLinePrefix(line)}
              </span>
            )}
            
            {/* Tiptap 编辑器 */}
            <TiptapLine
              content={line.content}
              lineId={line.id}
              mode={isDescriptionMode ? 'description' : 'title'}
              level={line.level}
              placeholder={isDescriptionMode ? '添加描述...' : '开始输入...'}
              onUpdate={(html) => handleLineUpdate(line.id, html)}
              onEnter={() => handleLineEnter(line.id)}
              onShiftEnter={() => handleLineShiftEnter(line.id)}
              onTab={() => handleTab(line.id)}
              onShiftTab={() => handleShiftTab(line.id)}
              onArrowUp={() => handleArrowUp(line.id)}
              onArrowDown={() => handleArrowDown(line.id)}
              onFocus={() => onLineClick?.(line)}
              onBlur={() => {}}
            />
            
            {/* 后缀装饰（标签、时间等）- Description 模式不显示 */}
            {renderLineSuffix && !isDescriptionMode && (
              <span className="line-suffix" style={{ 
                marginLeft: 'auto', 
                paddingLeft: '8px' 
              }}>
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
