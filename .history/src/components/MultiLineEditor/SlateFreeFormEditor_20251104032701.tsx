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

import React, { useCallback, useState, useRef } from 'react';
import { Editor } from 'slate';
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
  onEditorReady?: (lineId: string, editor: Editor) => void;
  onEditorDestroy?: (lineId: string) => void;
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
  onEditorReady,
  onEditorDestroy,
  placeholder = '开始输入...',
  className = '',
  style,
}: SlateFreeFormEditorProps<T>) => {
  
  // 本地编辑器注册表（用于光标控制）
  const localEditorRegistry = useRef<Map<string, Editor>>(new Map());
  
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
   * 处理 Shift+Enter - Title ↔ Description 模式切换
   */
  const handleLineShiftEnter = useCallback((lineId: string) => {
    console.log('[SlateFreeFormEditor] handleLineShiftEnter called:', lineId);
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
          const element = document.querySelector(`[data-line-id="${descLine.id}"] [data-slate-editor]`) as HTMLElement;
          if (element) {
            element.focus();
            console.log('[SlateFreeFormEditor] Focused description line successfully');
          }
        }, 50);
      });
    } else {
      // Description → Title: 删除 description 行（如果为空）
      const isEmpty = !currentLine.content || currentLine.content === '<p></p>';
      
      if (isEmpty) {
        const newLines = lines.filter(l => l.id !== lineId);
        onLinesChange(newLines);
      }
      
      // 聚焦回 title 行
      const titleLineId = lineId.replace('-desc', '');
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${titleLineId}"] [data-slate-editor]`) as HTMLElement;
          element?.focus();
        }, 50);
      });
    }
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
    
    // 如果有选中的行，只处理选中的行
    if (selectedLineIds.size > 0) {
      const updatedLines = lines.map(line => {
        if (selectedLineIds.has(line.id)) {
          const lineIndex = lines.findIndex(l => l.id === line.id);
          const linePrev = lineIndex > 0 ? lines[lineIndex - 1] : null;
          const lineMaxLevel = linePrev ? linePrev.level + 1 : 0;
          return { ...line, level: Math.min(line.level + 1, lineMaxLevel, 5) };
        }
        return line;
      });
      onLinesChange(updatedLines);
    } else {
      // 没有选中行，只处理当前行
      const updatedLines = lines.map(line =>
        line.id === lineId
          ? { ...line, level: Math.min(currentLine.level + 1, maxAllowedLevel, 5) }
          : line
      );
      onLinesChange(updatedLines);
    }
  }, [lines, selectedLineIds, onLinesChange]);
  
  /**
   * 处理 Shift+Tab - 减少缩进（Description 模式特殊处理）
   */
  const handleLineShiftTab = useCallback((lineId: string) => {
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
          // 转换为 Title 行：不设置 data，交由 PlanManager 创建/更新
          data: undefined,
        };
        
        const newLines = [
          ...lines.slice(0, currentIndex),
          newLine,
          ...lines.slice(currentIndex + 1),
        ];
        
        onLinesChange(newLines);
      }
    } else {
      // Title 模式：减少缩进（支持多选）
      if (selectedLineIds.size > 0) {
        const updatedLines = lines.map(line =>
          selectedLineIds.has(line.id)
            ? { ...line, level: Math.max(line.level - 1, 0) }
            : line
        );
        onLinesChange(updatedLines);
      } else {
        // 没有选中行，只处理当前行
        const updatedLines = lines.map(line =>
          line.id === lineId
            ? { ...line, level: Math.max(line.level - 1, 0) }
            : line
        );
        onLinesChange(updatedLines);
      }
    }
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
   * 处理行删除（Backspace 删除空行）
   */
  const handleLineDelete = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;

    const isDescription = lineId.includes('-desc') || (lines[currentIndex].data as any)?.mode === 'description';

    let newLines = [...lines];
    if (isDescription) {
      // 删除描述行
      newLines = newLines.filter(l => l.id !== lineId);
      onLinesChange(newLines);

      // 聚焦回对应的 title 行（光标定位到末尾）
      const titleLineId = lineId.replace('-desc', '');
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${titleLineId}"] [data-slate-editor]`) as HTMLElement;
          if (element) {
            element.focus();
            // 将光标移到末尾
            const selection = window.getSelection();
            if (selection) {
              selection.selectAllChildren(element);
              selection.collapseToEnd();
            }
          }
        }, 50);
      });
    } else {
      // 删除标题行（以及其紧随的描述行）
      const baseId = lineId;
      newLines = newLines.filter(l => !(l.id === baseId || l.id === `${baseId}-desc`));
      onLinesChange(newLines);

      // 聚焦上一行（光标定位到末尾）
      const prevLineId = lines[currentIndex - 1]?.id;
      if (prevLineId) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const element = document.querySelector(`[data-line-id="${prevLineId}"] [data-slate-editor]`) as HTMLElement;
            if (element) {
              element.focus();
              // 将光标移到末尾，这样用户可以继续按 Backspace 删除
              const selection = window.getSelection();
              if (selection) {
                selection.selectAllChildren(element);
                selection.collapseToEnd();
              }
            }
          }, 50);
        });
      }
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
      // 普通点击：清除选择状态
      setSelectedLineIds(new Set());
      setLastClickedLineId(line.id);
    }
    
    onLineClick?.(line);
  }, [lines, selectedLineIds, lastClickedLineId, onLineClick]);
  
  return (
    <div className={`slate-freeform-editor ${className}`} style={style}>
      {lines.map((line, index) => {
        const isDescriptionMode = (line.data as any)?.mode === 'description';
        const isSelected = selectedLineIds.has(line.id);
        
        return (
          <div
            key={line.id}
            className={`freeform-line${isDescriptionMode ? ' description-line' : ''}${isSelected ? ' selected' : ''}`}
            data-line-id={line.id}
            style={{
              paddingLeft: isDescriptionMode 
                ? `${(line.level + 1) * 24}px` 
                : `${line.level * 24}px`,
              display: 'flex',
              alignItems: isDescriptionMode ? 'flex-start' : 'center',
              gap: '8px',
            }}
            onClick={(e) => handleLineClickInternal(line, e)}
          >
            {/* 前缀装饰（Checkbox、Emoji 等）- Description 模式不显示 */}
            {renderLinePrefix && !isDescriptionMode && (
              <div className="line-prefix">{renderLinePrefix(line)}</div>
            )}
            
            <SlateLine
              content={line.content}
              lineId={line.id}
              mode={isDescriptionMode ? 'description' : 'title'}
              placeholder={isDescriptionMode ? '添加描述...' : (index === 0 ? placeholder : '')}
              level={line.level}
              onUpdate={(html) => handleLineUpdate(line.id, html)}
              onEnter={() => handleLineEnter(line.id)}
              onShiftEnter={() => handleLineShiftEnter(line.id)}
              onTab={() => handleLineTab(line.id)}
              onShiftTab={() => handleLineShiftTab(line.id)}
              onArrowUp={() => handleLineArrowUp(line.id)}
              onArrowDown={() => handleLineArrowDown(line.id)}
              onDelete={() => handleLineDelete(line.id)}
              onEditorReady={(lineId, editor) => {
                // 注册到本地 registry（用于光标控制）
                localEditorRegistry.current.set(lineId, editor);
                // 转发给外部（PlanManager）
                onEditorReady?.(lineId, editor);
              }}
              onEditorDestroy={(lineId) => {
                // 从本地 registry 移除
                localEditorRegistry.current.delete(lineId);
                // 转发给外部（PlanManager）
                onEditorDestroy?.(lineId);
              }}
              className="freeform-line-editor"
            />
            
            {/* 后缀装饰（标签、时间等）- Description 模式不显示 */}
            {renderLineSuffix && !isDescriptionMode && (
              <div className="line-suffix">{renderLineSuffix(line)}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};
