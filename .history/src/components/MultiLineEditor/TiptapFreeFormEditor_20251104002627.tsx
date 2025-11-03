/**
 * TiptapFreeFormEditor - 使用 Tiptap 重写的 FreeFormEditor
 * 
 * 关键差异：
 * 1. 每行使用 TiptapLine 替代 contentEditable span
 * 2. Enter/Shift+Enter 逻辑移到 TiptapLine 的 callbacks
 * 3. 保留原有的 prefix/suffix 渲染逻辑
 * 4. 保留 Tab/Shift+Tab/ArrowUp/ArrowDown 逻辑
 */

import React, { useCallback, useRef, useState, useEffect } from 'react';
import type { Editor } from '@tiptap/react';
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
  onEditorReady?: (lineId: string, editor: Editor) => void;
  onEditorDestroy?: (lineId: string) => void;
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
  onEditorReady,
  onEditorDestroy,
}: TiptapFreeFormEditorProps<T>) => {
  
  // 本地维护 editor registry，用于精确控制光标
  const localEditorRegistry = useRef<Map<string, Editor>>(new Map());
  
  // 🆕 多行选择状态
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [lastClickedLineId, setLastClickedLineId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
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
    const currentLine = lines[currentIndex];
    
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: currentLine.level, // 新建同级
      // 对于新创建的 title 行，不设置 data，交由 PlanManager 判定并创建带 id 的条目
      data: undefined,
    };
    
    // 直接插入到当前行的下一行（不跳过子任务/描述）
    let insertIndex = currentIndex + 1;
    
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
   * 🆕 处理行点击（用于多选）
   */
  const handleLineClickForSelection = useCallback((lineId: string, event: React.MouseEvent) => {
    const isShiftClick = event.shiftKey;
    const isCtrlClick = event.ctrlKey || event.metaKey;
    
    if (isShiftClick && lastClickedLineId) {
      // Shift + Click: 选择范围
      const lastIndex = lines.findIndex(l => l.id === lastClickedLineId);
      const currentIndex = lines.findIndex(l => l.id === lineId);
      if (lastIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastIndex, currentIndex);
        const end = Math.max(lastIndex, currentIndex);
        const rangeIds = new Set<string>();
        for (let i = start; i <= end; i++) {
          rangeIds.add(lines[i].id);
        }
        setSelectedLineIds(rangeIds);
      }
    } else if (isCtrlClick) {
      // Ctrl + Click: 切换单行选择
      const newSelection = new Set(selectedLineIds);
      if (newSelection.has(lineId)) {
        newSelection.delete(lineId);
      } else {
        newSelection.add(lineId);
      }
      setSelectedLineIds(newSelection);
      setLastClickedLineId(lineId);
    } else {
      // 普通点击：清除选择
      setSelectedLineIds(new Set());
      setLastClickedLineId(lineId);
    }
  }, [lines, lastClickedLineId, selectedLineIds]);
  
  /**
   * 🆕 处理 Shift + Arrow 多选
   */
  const handleShiftArrow = useCallback((lineId: string, direction: 'up' | 'down') => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    let targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= lines.length) return;
    
    const newSelection = new Set(selectedLineIds);
    newSelection.add(lineId);
    newSelection.add(lines[targetIndex].id);
    setSelectedLineIds(newSelection);
    setLastClickedLineId(lines[targetIndex].id);
    
    // 聚焦目标行
    const targetLineId = lines[targetIndex].id;
    const element = document.querySelector(`[data-line-id="${targetLineId}"] .ProseMirror`) as HTMLElement;
    element?.focus();
  }, [lines, selectedLineIds]);
  
  /**
   * 🆕 删除选中的多行
   */
  const handleDeleteSelectedLines = useCallback(() => {
    if (selectedLineIds.size === 0) return;
    
    // 删除选中的行（包括对应的描述行）
    const idsToDelete = new Set<string>();
    selectedLineIds.forEach(id => {
      idsToDelete.add(id);
      idsToDelete.add(`${id}-desc`); // 同时删除描述行
    });
    
    const newLines = lines.filter(l => !idsToDelete.has(l.id));
    onLinesChange(newLines);
    
    // 清除选择
    setSelectedLineIds(new Set());
    setLastClickedLineId(null);
    
    // 聚焦到删除位置的上一行
    const firstSelectedIndex = lines.findIndex(l => selectedLineIds.has(l.id));
    if (firstSelectedIndex > 0) {
      const prevLineId = lines[firstSelectedIndex - 1].id;
      requestAnimationFrame(() => {
        setTimeout(() => {
          const editor = localEditorRegistry.current.get(prevLineId);
          if (editor && !editor.isDestroyed) {
            editor.commands.focus('end');
          }
        }, 50);
      });
    }
  }, [lines, selectedLineIds, onLinesChange]);
  
  /**
   * 处理 Backspace 删除空行
   */
  const handleDeleteLine = useCallback((lineId: string) => {
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
          const editor = localEditorRegistry.current.get(titleLineId);
          if (editor && !editor.isDestroyed) {
            editor.commands.focus('end');
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
            const editor = localEditorRegistry.current.get(prevLineId);
            if (editor && !editor.isDestroyed) {
              // 将光标定位到末尾，这样用户可以继续按 Backspace 删除
              editor.commands.focus('end');
            }
          }, 50);
        });
      }
    }
  }, [lines, onLinesChange]);
  
  /**
   * 处理 Tab - 增加缩进
   */
  const handleTab = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    const prevLevel = currentIndex > 0 ? lines[currentIndex - 1].level : 0;
    const updatedLines = lines.map(line => {
      if (line.id !== lineId) return line;
      const nextLevel = Math.min(line.level + 1, prevLevel + 1); // 不允许跳级：最多比上一行多 1 级
      return { ...line, level: nextLevel };
    });
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
      // 灰字点击创建 title 行：不设置 data
      data: undefined,
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
  
  // 🆕 监听全局键盘事件（用于多行删除和 Shift+Arrow 选择）
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete 或 Backspace 删除选中的多行
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLineIds.size > 0) {
        // 确保不在编辑器内（避免干扰正常输入）
        const target = e.target as HTMLElement;
        if (!target.classList.contains('ProseMirror')) {
          e.preventDefault();
          handleDeleteSelectedLines();
        }
      }
      
      // Shift + Arrow Up/Down 多选
      if (e.shiftKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
        const activeElement = document.activeElement as HTMLElement;
        const lineElement = activeElement?.closest('[data-line-id]') as HTMLElement;
        if (lineElement) {
          const lineId = lineElement.getAttribute('data-line-id');
          if (lineId) {
            e.preventDefault();
            handleShiftArrow(lineId, e.key === 'ArrowUp' ? 'up' : 'down');
          }
        }
      }
      
      // Escape 取消选择
      if (e.key === 'Escape' && selectedLineIds.size > 0) {
        setSelectedLineIds(new Set());
        setLastClickedLineId(null);
      }
    };
    
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [selectedLineIds, handleDeleteSelectedLines, handleShiftArrow]);
  
  // ==================== 渲染 ====================
  return (
    <div className={`free-form-editor ${className}`} style={style}>
      {lines.map((line) => {
        const isDescriptionMode = (line.data as any)?.mode === 'description';
        const isSelected = selectedLineIds.has(line.id);
        
        return (
          <div
            key={line.id}
            className={`free-form-line${isDescriptionMode ? ' description-line' : ''}${isSelected ? ' selected' : ''}`}
            data-line-id={line.id}
            onClick={(e) => {
              // 只在点击左侧区域时触发多选（避免点击编辑器内容时触发）
              const target = e.target as HTMLElement;
              if (!target.classList.contains('ProseMirror') && !target.closest('.ProseMirror')) {
                handleLineClickForSelection(line.id, e);
              }
            }}
            style={{
              display: 'flex',
              alignItems: isDescriptionMode ? 'flex-start' : 'center',
              marginBottom: '4px',
              paddingLeft: isDescriptionMode 
                ? `${(line.level + 1) * 16}px` 
                : `${line.level * 16}px`,
              width: '100%',
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              borderRadius: '4px',
              transition: 'background-color 0.15s',
              cursor: 'pointer',
            }}
          >
            {/* 前缀装饰（Checkbox、Emoji 等）- Description 模式不显示 */}
            {renderLinePrefix && !isDescriptionMode && (
              <span className="line-prefix" style={{ 
                marginRight: '8px',
                display: 'flex',
                alignItems: 'center'
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
              onDelete={() => handleDeleteLine(line.id)}
              onTab={() => handleTab(line.id)}
              onShiftTab={() => handleShiftTab(line.id)}
              onArrowUp={() => handleArrowUp(line.id)}
              onArrowDown={() => handleArrowDown(line.id)}
              onFocus={() => onLineClick?.(line)}
              onBlur={() => {}}
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
