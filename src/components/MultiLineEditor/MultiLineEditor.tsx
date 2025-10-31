/**
 * MultiLineEditor - 多行编辑器核心组件
 * 参照 TagManager 设计，提供通用的键盘导航、层级管理、批量操作能力
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { MultiLineEditorProps, MultiLineEditorItem } from './types';
import { useKeyboardNav } from './hooks/useKeyboardNav';
import { useIndentManager } from './hooks/useIndentManager';
import { useBatchOperations } from './hooks/useBatchOperations';
import './MultiLineEditor.css';

export const MultiLineEditor = <T,>({
  items,
  onItemsChange,
  renderItemPrefix,
  renderItemSuffix,
  renderContent,
  placeholder = '# 按 Enter 创建新项，Tab 缩进，Shift+Alt+↑/↓ 移动',
  grayText = '点击创建新项...',
  indentSize = 24,
  maxLevel,
  autoSave = true,
  onAutoSave,
  enableBatchOperations = true,
  onBatchDelete,
  enableGrayTextCreation = true,
  onItemClick,
  getItemStyle,
  className = '',
  style = {},
}: MultiLineEditorProps<T>) => {
  // ==================== Hooks ====================
  const keyboardNav = useKeyboardNav<T>();
  const indentManager = useIndentManager<T>();
  const batchOps = useBatchOperations<T>(items);

  // ==================== 状态管理 ====================
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newItemId, setNewItemId] = useState<string | null>(null);
  const grayTextRef = useRef<HTMLDivElement>(null);

  // ==================== 自动保存 ====================
  useEffect(() => {
    if (autoSave && onAutoSave && items.length > 0) {
      onAutoSave(items);
    }
  }, [items, autoSave, onAutoSave]);

  // ==================== 内容更新 ====================
  const handleContentBlur = useCallback(
    (itemId: string, newContent: string | null) => {
      const content = newContent?.trim() || '';

      // 如果是空内容且不是新创建的项目，删除
      if (content === '' && itemId !== newItemId) {
        onItemsChange(items.filter((item) => item.id !== itemId));
        return;
      }

      // 更新内容
      const updatedItems = items.map((item) =>
        item.id === itemId ? { ...item, content } : item
      );

      onItemsChange(updatedItems);

      // 如果是新创建的项目，清除标记
      if (itemId === newItemId) {
        setNewItemId(null);
      }
    },
    [items, newItemId, onItemsChange]
  );

  // ==================== 键盘事件处理 ====================
  const handleItemKeyDown = useCallback(
    (e: React.KeyboardEvent, itemId: string, level: number) => {

      // Enter: 创建同级项
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const { newItemId: createdId, newItems } = keyboardNav.createSiblingItem(
          itemId,
          level,
          items
        );
        setNewItemId(createdId);
        onItemsChange(newItems);
        keyboardNav.focusItem(createdId);
      }

      // Shift+Enter: 创建子项
      else if (e.key === 'Enter' && e.shiftKey) {
        e.preventDefault();
        const { newItemId: createdId, newItems } = keyboardNav.createChildItem(
          itemId,
          items
        );
        setNewItemId(createdId);
        onItemsChange(newItems);
        keyboardNav.focusItem(createdId);
      }

      // Tab: 增加缩进
      else if (e.key === 'Tab' && !e.shiftKey) {
        e.preventDefault();
        const result = indentManager.increaseIndent(itemId, level, items);
        if (result) {
          const updatedItems = items.map((item) =>
            item.id === itemId
              ? { ...item, level: result.newLevel, parentId: result.newParentId }
              : item
          );
          onItemsChange(updatedItems);
        }
      }

      // Shift+Tab: 减少缩进
      else if (e.key === 'Tab' && e.shiftKey) {
        e.preventDefault();
        const result = indentManager.decreaseIndent(itemId, level, items);
        if (result) {
          const updatedItems = items.map((item) =>
            item.id === itemId
              ? { ...item, level: result.newLevel, parentId: result.newParentId }
              : item
          );
          onItemsChange(updatedItems);
        }
      }

      // ↑: 导航到上一项
      else if (e.key === 'ArrowUp' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        keyboardNav.navigatePrevious(itemId, items);
      }

      // ↓: 导航到下一项
      else if (e.key === 'ArrowDown' && !e.shiftKey && !e.altKey) {
        e.preventDefault();
        keyboardNav.navigateNext(itemId, items);
      }

      // Shift+Alt+↑: 向上移动
      else if (e.key === 'ArrowUp' && e.shiftKey && e.altKey) {
        e.preventDefault();
        const newItems = keyboardNav.moveItemUp(itemId, items);
        if (newItems) {
          onItemsChange(newItems);
        }
      }

      // Shift+Alt+↓: 向下移动
      else if (e.key === 'ArrowDown' && e.shiftKey && e.altKey) {
        e.preventDefault();
        const newItems = keyboardNav.moveItemDown(itemId, items);
        if (newItems) {
          onItemsChange(newItems);
        }
      }
    },
    [items, keyboardNav, indentManager, onItemsChange]
  );

  // ==================== 批量操作键盘事件 ====================
  useEffect(() => {
    if (!enableBatchOperations) return;

    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;

      // 如果在编辑框内，跳过批量操作
      if (
        target.contentEditable === 'true' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA'
      ) {
        return;
      }

      const selectedIds = batchOps.getSelectedItems();
      if (selectedIds.length === 0) return;

      // Delete/Backspace: 批量删除
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();

        if (confirm(`确定要删除选中的 ${selectedIds.length} 个项目吗？`)) {
          const newItems = batchOps.batchDelete(selectedIds);
          onItemsChange(newItems);
          window.getSelection()?.removeAllRanges();

          if (onBatchDelete) {
            onBatchDelete(selectedIds);
          }
        }
      }

      // Shift+Alt+↑: 批量向上移动
      else if (e.shiftKey && e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        const newItems = batchOps.batchMoveUp(selectedIds);
        if (newItems) {
          onItemsChange(newItems);
        }
      }

      // Shift+Alt+↓: 批量向下移动
      else if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
        e.preventDefault();
        const newItems = batchOps.batchMoveDown(selectedIds);
        if (newItems) {
          onItemsChange(newItems);
        }
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);

    return () => {
      document.removeEventListener('keydown', handleGlobalKeyDown);
    };
  }, [enableBatchOperations, batchOps, onItemsChange, onBatchDelete]);

  // ==================== Gray Text 处理 ====================
  const handleGrayTextClick = useCallback((e: React.MouseEvent) => {
    if (!enableGrayTextCreation) return;

    e.stopPropagation();
    
    setIsCreatingNew(true);

    // 创建新项目
    const newId = `item-${Date.now()}`;
    const maxPosition = items.length > 0 
      ? Math.max(...items.map(item => item.position)) 
      : -1;
    
    const newItem: MultiLineEditorItem<T> = {
      id: newId,
      content: '',
      level: 0,
      position: maxPosition + 1,
      parentId: undefined,
    };

    const newItems = [...items, newItem];
    setNewItemId(newId);
    onItemsChange(newItems);

    // 聚焦到新创建的元素
    setTimeout(() => {
      const element = document.querySelector(
        `[data-editor-item-id="${newId}"]`
      ) as HTMLElement;
      if (element) {
        element.focus();
        // 清空 Gray Text（如果需要）
        if (grayTextRef.current && grayTextRef.current.textContent === grayText) {
          grayTextRef.current.textContent = '';
        }
      }
    }, 50);
  }, [enableGrayTextCreation, items, onItemsChange, grayText]);

  // ==================== 渲染 ====================
  const sortedItems = [...items].sort((a, b) => a.position - b.position);

  return (
    <div className={`multi-line-editor ${className}`} style={style}>
      {/* 项目列表 */}
      {sortedItems.map((item) => (
        <div
          key={item.id}
          className={`editor-row ${
            batchOps.selectedItemIds.includes(item.id) ? 'selected' : ''
          }`}
          style={{ paddingLeft: `${item.level * indentSize}px` }}
          data-item-id={item.id}
        >
          {/* 左侧插槽 */}
          {renderItemPrefix && (
            <div className="editor-row-prefix">{renderItemPrefix(item)}</div>
          )}

          {/* 中间：contentEditable */}
          {renderContent ? (
            renderContent(item, () => (
              <DefaultContentEditable
                item={item}
                onBlur={handleContentBlur}
                onKeyDown={handleItemKeyDown}
                onClick={onItemClick}
                customStyle={getItemStyle ? getItemStyle(item) : undefined}
              />
            ))
          ) : (
            <DefaultContentEditable
              item={item}
              onBlur={handleContentBlur}
              onKeyDown={handleItemKeyDown}
              onClick={onItemClick}
              customStyle={getItemStyle ? getItemStyle(item) : undefined}
            />
          )}

          {/* 右侧插槽 */}
          {renderItemSuffix && (
            <div className="editor-row-suffix">{renderItemSuffix(item)}</div>
          )}
        </div>
      ))}

      {/* Gray Text 提示区域 - contentEditable */}
      {enableGrayTextCreation && (
        <div
          ref={grayTextRef}
          className="gray-text-placeholder"
          contentEditable
          suppressContentEditableWarning
          onClick={handleGrayTextClick}
          onFocus={(e) => {
            // 如果不在创建模式，激活创建
            if (!isCreatingNew) {
              handleGrayTextClick(e as any);
            }
          }}
          style={{
            outline: 'none',
            cursor: 'pointer',
          }}
        >
          {grayText}
        </div>
      )}
    </div>
  );
};

// ==================== 默认 ContentEditable 组件 ====================

interface DefaultContentEditableProps<T> {
  item: MultiLineEditorItem<T>;
  onBlur: (itemId: string, content: string | null) => void;
  onKeyDown: (e: React.KeyboardEvent, itemId: string, level: number) => void;
  onClick?: (item: MultiLineEditorItem<T>) => void;
  customStyle?: React.CSSProperties;
}

const DefaultContentEditable = <T,>({
  item,
  onBlur,
  onKeyDown,
  onClick,
  customStyle,
}: DefaultContentEditableProps<T>) => {
  return (
    <span
      className="editor-row-content"
      data-editor-item-id={item.id}
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onBlur(item.id, e.currentTarget.textContent)}
      onKeyDown={(e) => onKeyDown(e, item.id, item.level)}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(item);
      }}
      onMouseDown={(e) => e.stopPropagation()} // 允许文本选择
      style={{
        outline: 'none',
        border: 'none',
        background: 'transparent',
        cursor: 'text',
        userSelect: 'text',
        WebkitUserSelect: 'text',
        MozUserSelect: 'text',
        ...customStyle,
      }}
    >
      {item.content}
    </span>
  );
};

// 导出类型
export type { MultiLineEditorProps, MultiLineEditorItem } from './types';
