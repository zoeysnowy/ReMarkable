/**
 * SlateFreeFormEditor - 使用 Slate.js 重写的 FreeFormEditor
 * 
 * 替代 TiptapFreeFormEditor，使用 Slate.js + Headless UI + Tippy.js
 * 
 * 关键特性：
 * 1. 每行使用 SlateLine 组件
 * 2. 保留原有的多行编辑、缩进、快捷键功能
 * 3. 使用 Headless UI 管理状态
 * 4. 使用 Tippy.js 实现浮动工具栏
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Editor as SlateEditor } from 'slate';
import { SlateLine } from '../SlateEditor/SlateLine';
import './FreeFormEditor.css';

export interface FreeFormLine<T = any> {
  id: string;
  content: string;
  level: number;
  data?: T;
}

export interface SlateFreeFormEditorProps<T = any> {
  lines: FreeFormLine<T>[];
  onLinesChange: (lines: FreeFormLine<T>[]) => void;
  renderLinePrefix?: (line: FreeFormLine<T>) => React.ReactNode;
  renderLineSuffix?: (line: FreeFormLine<T>) => React.ReactNode;
  onLineClick?: (line: FreeFormLine<T>) => void;
  placeholder?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const SlateFreeFormEditor = <T,>({
  lines,
  onLinesChange,
  renderLinePrefix,
  renderLineSuffix,
  onLineClick,
  placeholder = '开始输入...',
  className = '',
  style,
}: SlateFreeFormEditorProps<T>) => {
  
  // 多行选择状态
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [lastClickedLineId, setLastClickedLineId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // ==================== 行操作回调 ====================
  
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
   * 处理 Enter 键 - 创建新行
   */
  const handleLineEnter = useCallback((lineId: string) => {
    console.log('[SlateFreeFormEditor] handleLineEnter called:', lineId);
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    const currentLine = lines[currentIndex];
    
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: currentLine.level,
      data: undefined,
    };
    
    const insertIndex = currentIndex + 1;
    
    const newLines = [
      ...lines.slice(0, insertIndex),
      newLine,
      ...lines.slice(insertIndex),
    ];
    
    onLinesChange(newLines);
    
    // 聚焦新行
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${newLine.id}"] [data-slate-editor]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 50);
    });
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Shift+Enter - 创建描述行
   */
  const handleLineShiftEnter = useCallback((lineId: string) => {
    console.log('[SlateFreeFormEditor] handleLineShiftEnter called:', lineId);
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    const currentLine = lines[currentIndex];
    
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}-desc`,
      content: '',
      level: currentLine.level + 1,
      data: undefined,
    };
    
    const insertIndex = currentIndex + 1;
    
    const newLines = [
      ...lines.slice(0, insertIndex),
      newLine,
      ...lines.slice(insertIndex),
    ];
    
    onLinesChange(newLines);
    
    // 聚焦新行
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${newLine.id}"] [data-slate-editor]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 50);
    });
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Tab - 增加缩进（检查层级连续性）
   */
  const handleLineTab = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    const currentLine = lines[currentIndex];
    const prevLine = currentIndex > 0 ? lines[currentIndex - 1] : null;
    
    // 计算允许的最大层级：上一行的层级 + 1
    const maxAllowedLevel = prevLine ? prevLine.level + 1 : 0;
    
    const updatedLines = lines.map(line => {
      if (selectedLineIds.size > 0 && selectedLineIds.has(line.id)) {
        const lineIndex = lines.findIndex(l => l.id === line.id);
        const linePrev = lineIndex > 0 ? lines[lineIndex - 1] : null;
        const lineMaxLevel = linePrev ? linePrev.level + 1 : 0;
        return { ...line, level: Math.min(line.level + 1, lineMaxLevel, 5) };
      } else if (line.id === lineId) {
        return { ...line, level: Math.min(currentLine.level + 1, maxAllowedLevel, 5) };
      }
      return line;
    });
    onLinesChange(updatedLines);
  }, [lines, selectedLineIds, onLinesChange]);
  
  /**
   * 处理 Shift+Tab - 减少缩进
   */
  const handleLineShiftTab = useCallback((lineId: string) => {
    const updatedLines = lines.map(line => {
      if (selectedLineIds.size > 0 && selectedLineIds.has(line.id)) {
        return { ...line, level: Math.max(line.level - 1, 0) };
      } else if (line.id === lineId) {
        return { ...line, level: Math.max(line.level - 1, 0) };
      }
      return line;
    });
    onLinesChange(updatedLines);
  }, [lines, selectedLineIds, onLinesChange]);
  
  /**
   * 处理 ArrowUp - 聚焦上一行
   */
  const handleLineArrowUp = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex > 0) {
      const prevLine = lines[currentIndex - 1];
      const element = document.querySelector(`[data-line-id="${prevLine.id}"] [data-slate-editor]`) as HTMLElement;
      if (element) {
        element.focus();
        // 将光标移到末尾
        const selection = window.getSelection();
        if (selection) {
          selection.selectAllChildren(element);
          selection.collapseToEnd();
        }
      }
    }
  }, [lines]);
  
  /**
   * 处理 ArrowDown - 聚焦下一行
   */
  const handleLineArrowDown = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex < lines.length - 1) {
      const nextLine = lines[currentIndex + 1];
      const element = document.querySelector(`[data-line-id="${nextLine.id}"] [data-slate-editor]`) as HTMLElement;
      if (element) {
        element.focus();
        // 将光标移到开始
        const selection = window.getSelection();
        if (selection) {
          selection.selectAllChildren(element);
          selection.collapseToStart();
        }
      }
    }
  }, [lines]);
  
  /**
   * 处理行删除
   */
  const handleLineDelete = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1 || lines.length === 1) return;
    
    // 删除当前行
    const newLines = lines.filter(l => l.id !== lineId);
    onLinesChange(newLines);
    
    // 聚焦上一行或下一行
    const targetIndex = currentIndex > 0 ? currentIndex - 1 : 0;
    const targetLine = newLines[targetIndex];
    if (targetLine) {
      requestAnimationFrame(() => {
        const element = document.querySelector(`[data-line-id="${targetLine.id}"] [data-slate-editor]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      });
    }
  }, [lines, onLinesChange]);
  
  /**
   * 处理行点击（用于多选）
   */
  const handleLineClickInternal = useCallback((line: FreeFormLine<T>, event: React.MouseEvent) => {
    if (event.shiftKey && lastClickedLineId) {
      // Shift+点击：范围选择
      const lastIndex = lines.findIndex(l => l.id === lastClickedLineId);
      const currentIndex = lines.findIndex(l => l.id === line.id);
      
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const newSelected = new Set<string>();
        
        for (let i = start; i <= end; i++) {
          newSelected.add(lines[i].id);
        }
        
        setSelectedLineIds(newSelected);
      }
    } else if (event.ctrlKey || event.metaKey) {
      // Ctrl/Cmd+点击：多选
      const newSelected = new Set(selectedLineIds);
      if (newSelected.has(line.id)) {
        newSelected.delete(line.id);
      } else {
        newSelected.add(line.id);
      }
      setSelectedLineIds(newSelected);
      setLastClickedLineId(line.id);
    } else {
      // 普通点击：单选
      setSelectedLineIds(new Set([line.id]));
      setLastClickedLineId(line.id);
    }
    
    onLineClick?.(line);
  }, [lines, selectedLineIds, lastClickedLineId, onLineClick]);
  
  /**
   * 判断行模式
   */
  const getLineMode = useCallback((line: FreeFormLine<T>): 'title' | 'description' => {
    // 简单判断：level > 0 为 description
    return line.level > 0 ? 'description' : 'title';
  }, []);
  
  return (
    <div className={`slate-freeform-editor ${className}`} style={style}>
      {lines.map((line, index) => (
        <div
          key={line.id}
          className={`freeform-line ${selectedLineIds.has(line.id) ? 'selected' : ''}`}
          style={{
            paddingLeft: `${line.level * 24}px`,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
          onClick={(e) => handleLineClickInternal(line, e)}
        >
          {renderLinePrefix && (
            <div className="line-prefix">{renderLinePrefix(line)}</div>
          )}
          
          <SlateLine
            content={line.content}
            lineId={line.id}
            mode={getLineMode(line)}
            placeholder={index === 0 ? placeholder : ''}
            level={line.level}
            onUpdate={(html) => handleLineUpdate(line.id, html)}
            onEnter={() => handleLineEnter(line.id)}
            onShiftEnter={() => handleLineShiftEnter(line.id)}
            onTab={() => handleLineTab(line.id)}
            onShiftTab={() => handleLineShiftTab(line.id)}
            onArrowUp={() => handleLineArrowUp(line.id)}
            onArrowDown={() => handleLineArrowDown(line.id)}
            onDelete={() => handleLineDelete(line.id)}
            className="freeform-line-editor"
          />
          
          {renderLineSuffix && (
            <div className="line-suffix">{renderLineSuffix(line)}</div>
          )}
        </div>
      ))}
    </div>
  );
};
