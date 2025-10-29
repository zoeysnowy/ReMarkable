/**
 * 批量操作 Hook
 * 参照 TagManager 的批量操作逻辑，处理文本选区批量删除、移动
 */

import { useCallback, useEffect, useState } from 'react';
import { MultiLineEditorItem } from '../types';

export const useBatchOperations = <T,>(items: MultiLineEditorItem<T>[]) => {
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  /**
   * 获取当前选中的项目 ID 列表
   */
  const getSelectedItems = useCallback((): string[] => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return [];

    const selectedIds: string[] = [];

    items.forEach((item) => {
      const itemElement = document.querySelector(
        `[data-editor-item-id="${item.id}"]`
      );
      if (itemElement && selection.containsNode(itemElement, true)) {
        selectedIds.push(item.id);
      }
    });

    return selectedIds;
  }, [items]);

  /**
   * 批量删除项目
   */
  const batchDelete = useCallback(
    (itemIds: string[]): MultiLineEditorItem<T>[] => {
      if (itemIds.length === 0) return items;

      console.log('🗑️ [BatchOperations] 批量删除:', itemIds.length, '个项目');

      const idsSet = new Set(itemIds);
      return items.filter((item) => !idsSet.has(item.id));
    },
    [items]
  );

  /**
   * 批量向上移动
   */
  const batchMoveUp = useCallback(
    (itemIds: string[]): MultiLineEditorItem<T>[] | null => {
      if (itemIds.length === 0) return null;

      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const idsSet = new Set(itemIds);

      // 找到选中项目的索引
      const selectedIndices = sortedItems
        .map((item, index) => (idsSet.has(item.id) ? index : -1))
        .filter((index) => index !== -1);

      if (selectedIndices.length === 0) return null;

      const minIndex = Math.min(...selectedIndices);
      const maxIndex = Math.max(...selectedIndices);

      // 检查是否已经在顶部
      if (minIndex === 0) {
        console.log('⚠️ [BatchOperations] 已经在最顶部');
        return null;
      }

      // 向上移动：与上一个项目交换
      const temp = sortedItems[minIndex - 1];
      sortedItems.splice(minIndex - 1, 1);
      sortedItems.splice(maxIndex, 0, temp);

      // 重新分配 position
      return sortedItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    },
    [items]
  );

  /**
   * 批量向下移动
   */
  const batchMoveDown = useCallback(
    (itemIds: string[]): MultiLineEditorItem<T>[] | null => {
      if (itemIds.length === 0) return null;

      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const idsSet = new Set(itemIds);

      // 找到选中项目的索引
      const selectedIndices = sortedItems
        .map((item, index) => (idsSet.has(item.id) ? index : -1))
        .filter((index) => index !== -1);

      if (selectedIndices.length === 0) return null;

      const minIndex = Math.min(...selectedIndices);
      const maxIndex = Math.max(...selectedIndices);

      // 检查是否已经在底部
      if (maxIndex === sortedItems.length - 1) {
        console.log('⚠️ [BatchOperations] 已经在最底部');
        return null;
      }

      // 向下移动：与下一个项目交换
      const temp = sortedItems[maxIndex + 1];
      sortedItems.splice(maxIndex + 1, 1);
      sortedItems.splice(minIndex, 0, temp);

      // 重新分配 position
      return sortedItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    },
    [items]
  );

  /**
   * 监听选区变化，更新选中的项目列表
   */
  useEffect(() => {
    const updateSelection = () => {
      const ids = getSelectedItems();
      setSelectedItemIds(ids);
    };

    // 监听 selectionchange 事件
    document.addEventListener('selectionchange', updateSelection);

    // 初始化
    updateSelection();

    return () => {
      document.removeEventListener('selectionchange', updateSelection);
    };
  }, [getSelectedItems]);

  return {
    selectedItemIds,
    getSelectedItems,
    batchDelete,
    batchMoveUp,
    batchMoveDown,
  };
};
