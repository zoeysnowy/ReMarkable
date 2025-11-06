/**
 * SlateFreeFormEditor - 使用 Slate.js 重写�?FreeFormEditor
 * 
 * 替代 TiptapFreeFormEditor，使�?Slate.js + Headless UI + Tippy.js
 * 
 * 关键特性：
 * 1. 每行使用 SlateLine 组件
 * 2. 保留原有的多行编辑、缩进、快捷键功能
 * 3. 使用 Headless UI 管理状�?
 * 4. 使用 Tippy.js 实现浮动工具�?
 */

import React, { useCallback, useState, useRef, useEffect, useMemo } from 'react';
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
  onLineFocus?: (lineId: string) => void;
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
  onLineFocus,
  onEditorReady,
  onEditorDestroy,
  placeholder = '开始输�?..',
  className = '',
  style,
}: SlateFreeFormEditorProps<T>) => {
  
  // 本地编辑器注册表（用于光标控制）
  const localEditorRegistry = useRef<Map<string, Editor>>(new Map());
  
  // 多行选择状�?
  const [selectedLineIds, setSelectedLineIds] = useState<Set<string>>(new Set());
  const [lastClickedLineId, setLastClickedLineId] = useState<string | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  
  // 🆕 本地状态：暂存编辑中的行内容（key: lineId, value: html）
  const [localLineContents, setLocalLineContents] = useState<Map<string, string>>(new Map());
  
  // 🆕 合并 props.lines 和本地编辑状态
  const displayLines = useMemo(() => {
    return lines.map(line => {
      const localContent = localLineContents.get(line.id);
      return localContent !== undefined ? { ...line, content: localContent } : line;
    });
  }, [lines, localLineContents]);
  
  // ==================== 行操作回�?====================
  
  /**
   * 处理行内容更新（实时，不触发保存）
   */
  const handleLineUpdate = useCallback((lineId: string, html: string) => {
    setLocalLineContents(prev => new Map(prev).set(lineId, html));
  }, []);
  
  /**
   * 处理行失焦（提交保存）
   */
  const handleLineBlur = useCallback((lineId: string) => {
    const localContent = localLineContents.get(lineId);
    if (localContent !== undefined) {
      // 有本地修改，提交到父组件
      const updatedLines = lines.map(line =>
        line.id === lineId ? { ...line, content: localContent } : line
      );
      onLinesChange(updatedLines);
      
      // 清除本地缓存
      setLocalLineContents(prev => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
    }
  }, [lines, localLineContents, onLinesChange]);
  
  /**
   * 处理 Enter �?- 创建新行
   */
  const handleLineEnter = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    const currentLine = lines[currentIndex];
    
    // 🆕 先提交当前行的本地修改
    let updatedLines = lines;
    const localContent = localLineContents.get(lineId);
    if (localContent !== undefined) {
      updatedLines = lines.map(line =>
        line.id === lineId ? { ...line, content: localContent } : line
      );
      // 清除本地缓存
      setLocalLineContents(prev => {
        const next = new Map(prev);
        next.delete(lineId);
        return next;
      });
    }
    
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: currentLine.level,
      data: undefined,
    };
    
    const insertIndex = currentIndex + 1;
    
    const newLines = [
      ...updatedLines.slice(0, insertIndex),
      newLine,
      ...updatedLines.slice(insertIndex),
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
  }, [lines, localLineContents, onLinesChange]);
  
  /**
   * 处理 Shift+Enter - Title �?Description 模式切换
   */
  const handleLineShiftEnter = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;
    
    const currentLine = lines[currentIndex];
    const isDescriptionMode = (currentLine.data as any)?.mode === 'description';
    
    if (!isDescriptionMode) {
      // Title �?Description: 创建新的 description �?
      // 🔧 创建 description 行时，不复制 startTime/endTime/description 字段，保持空白
      const { startTime, endTime, description, ...restData } = (currentLine.data || {}) as any;
      
      console.log('[🔍 DEBUG Shift+Enter] 创建 description 行', {
        标题行ID: lineId,
        标题行data: currentLine.data,
        排除的字段: { startTime, endTime, description },
        剩余字段: restData
      });
      
      const descLine: FreeFormLine<T> = {
        id: `${lineId}-desc`,
        content: '',
        level: currentLine.level + 1,
        data: { ...restData, mode: 'description', description: '' } as T,
      };
      
      console.log('[🔍 DEBUG Shift+Enter] 新 description 行', {
        descLineId: descLine.id,
        descLineContent: descLine.content,
        descLineData: descLine.data
      });
      
      const newLines = [
        ...lines.slice(0, currentIndex + 1),
        descLine,
        ...lines.slice(currentIndex + 1),
      ];
      
      onLinesChange(newLines);
      
      // 聚焦�?description �?
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${descLine.id}"] [data-slate-editor]`) as HTMLElement;
          if (element) {
            element.focus();
          }
        }, 50);
      });
    } else {
      // Description �?Title: 删除 description 行（如果为空�?
      const isEmpty = !currentLine.content || currentLine.content === '<p></p>';
      
      if (isEmpty) {
        const newLines = lines.filter(l => l.id !== lineId);
        onLinesChange(newLines);
      }
      
      // 聚焦�?title �?
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
   * 处理 Shift+Tab - 减少缩进（Description 模式特殊处理�?
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
          // 转换�?Title 行：不设�?data，交�?PlanManager 创建/更新
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
   * 处理 ArrowUp - 聚焦上一�?
   */
  const handleLineArrowUp = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex > 0) {
      const prevLine = lines[currentIndex - 1];
      const element = document.querySelector(`[data-line-id="${prevLine.id}"] [data-slate-editor]`) as HTMLElement;
      if (element) {
        element.focus();
        // 将光标移到末�?
        const selection = window.getSelection();
        if (selection) {
          selection.selectAllChildren(element);
          selection.collapseToEnd();
        }
      }
    }
  }, [lines]);
  
  /**
   * 处理 ArrowDown - 聚焦下一�?
   */
  const handleLineArrowDown = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex < lines.length - 1) {
      const nextLine = lines[currentIndex + 1];
      const element = document.querySelector(`[data-line-id="${nextLine.id}"] [data-slate-editor]`) as HTMLElement;
      if (element) {
        element.focus();
        // 将光标移到开�?
        const selection = window.getSelection();
        if (selection) {
          selection.selectAllChildren(element);
          selection.collapseToStart();
        }
      }
    }
  }, [lines]);
  
  /**
   * 处理行删除（Backspace 删除空行�?
   */
  const handleLineDelete = useCallback((lineId: string) => {
    const currentIndex = lines.findIndex(l => l.id === lineId);
    if (currentIndex === -1) return;

    const isDescription = lineId.includes('-desc') || (lines[currentIndex].data as any)?.mode === 'description';

    let newLines = [...lines];
    if (isDescription) {
      // 删除描述�?
      newLines = newLines.filter(l => l.id !== lineId);
      onLinesChange(newLines);

      // 聚焦回对应的 title 行（光标定位到末尾）
      const titleLineId = lineId.replace('-desc', '');
      requestAnimationFrame(() => {
        setTimeout(() => {
          const element = document.querySelector(`[data-line-id="${titleLineId}"] [data-slate-editor]`) as HTMLElement;
          if (element) {
            element.focus();
            // 将光标移到末�?
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
              // 将光标移到末尾，这样用户可以继续�?Backspace 删除
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
   * 🆕 处理 Gray Text 点击 - 创建新行
   */
  const handleGrayTextClick = useCallback(() => {
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: 0,
      data: undefined,
    };
    
    onLinesChange([...lines, newLine]);
    
    // 聚焦新行
    requestAnimationFrame(() => {
      setTimeout(() => {
        const element = document.querySelector(`[data-line-id="${newLine.id}"] [data-slate-editor]`) as HTMLElement;
        if (element) {
          element.focus();
        }
      }, 100);
    });
  }, [lines, onLinesChange]);
  
  /**
   * 处理行点击（用于多选）
   */
  const handleLineClickInternal = useCallback((line: FreeFormLine<T>, event: React.MouseEvent) => {
    // ✅ 只在点击行的空白区域（不是编辑器内部）时处理多选
    // 如果点击的是编辑器或其内部元素，不处理多选逻辑
    const target = event.target as HTMLElement;
    const isClickingEditor = target.hasAttribute('data-slate-editor') || 
                            target.closest('[data-slate-editor]') ||
                            target.classList.contains('slate-line-editor');
    
    if (isClickingEditor) {
      // 点击编辑器内部，不处理多选，保持当前选择状态
      return;
    }
    
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
  
  /**
   * 🆕 处理 Shift + Arrow 多�?
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
    
    // 聚焦目标�?
    const targetLineId = lines[targetIndex].id;
    const element = document.querySelector(`[data-line-id="${targetLineId}"] [data-slate-editor]`) as HTMLElement;
    element?.focus();
  }, [lines, selectedLineIds]);
  
  /**
   * 🆕 删除选中的多�?
   */
  const handleDeleteSelectedLines = useCallback(() => {
    if (selectedLineIds.size === 0) return;
    
    // 删除选中的行（包括对应的描述行）
    const idsToDelete = new Set<string>();
    selectedLineIds.forEach(id => {
      idsToDelete.add(id);
      idsToDelete.add(`${id}-desc`); // 同时删除描述�?
    });
    
    const newLines = lines.filter(l => !idsToDelete.has(l.id));
    onLinesChange(newLines);
    
    // 清除选择
    setSelectedLineIds(new Set());
    setLastClickedLineId(null);
    
    // 聚焦到删除位置的上一�?
    const firstSelectedIndex = lines.findIndex(l => selectedLineIds.has(l.id));
    if (firstSelectedIndex > 0 && newLines.length > 0) {
      const prevLineId = lines[firstSelectedIndex - 1].id;
      if (!idsToDelete.has(prevLineId)) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            const element = document.querySelector(`[data-line-id="${prevLineId}"] [data-slate-editor]`) as HTMLElement;
            if (element) {
              element.focus();
            }
          }, 100);
        });
      }
    }
  }, [lines, selectedLineIds, onLinesChange]);
  
  // 🆕 监听全局键盘事件（用于多行删除和 Shift+Arrow 选择�?
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete �?Backspace 删除选中的多�?
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedLineIds.size > 0) {
        // 确保不在编辑器内（避免干扰正常输入）
        const target = e.target as HTMLElement;
        if (!target.hasAttribute('data-slate-editor') && !target.closest('[data-slate-editor]')) {
          e.preventDefault();
          handleDeleteSelectedLines();
        }
      }
      
      // Shift + Arrow Up/Down 多�?
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
  
  return (
    <div className={`slate-freeform-editor ${className}`} style={style}>
      {displayLines.map((line: FreeFormLine<T>, index: number) => {
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
              // 🆕 多选行的视觉反馈
              backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'transparent',
              borderRadius: '4px',
              transition: 'background-color 0.15s',
              // ✅ 移除 cursor: 'pointer'，让编辑器区域显示默认光标
            }}
            onClick={(e) => handleLineClickInternal(line, e)}
          >
            {/* 前缀装饰（Checkbox、Emoji 等）- Description 模式不显�?*/}
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
              onBlur={() => handleLineBlur(line.id)}
              onFocus={() => {
                // console.log('[SlateFreeFormEditor] Line focused', line.id);
                onLineFocus?.(line.id);
              }}
              onEditorReady={(lineId, editor) => {
                // 注册到本�?registry（用于光标控制）
                localEditorRegistry.current.set(lineId, editor);
                // 转发给外部（PlanManager�?
                onEditorReady?.(lineId, editor);
              }}
              onEditorDestroy={(lineId) => {
                // 从本�?registry 移除
                localEditorRegistry.current.delete(lineId);
                // 转发给外部（PlanManager�?
                onEditorDestroy?.(lineId);
              }}
              className="freeform-line-editor"
            />
            
            {/* 后缀装饰（标签、时间等�? Description 模式不显�?*/}
            {renderLineSuffix && !isDescriptionMode && (
              <div className="line-suffix">{renderLineSuffix(line)}</div>
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
