/**
 * 键盘导航 Hook
 * 参照 TagManager 的键盘逻辑，处理 Enter、↑↓、Shift+Alt+↑↓
 */

import { useCallback } from 'react';
import { MultiLineEditorItem } from '../types';

export const useKeyboardNav = <T,>() => {
  /**
   * 聚焦到指定项目
   */
  const focusItem = useCallback((itemId: string) => {
    setTimeout(() => {
      const element = document.querySelector(
        `[data-editor-item-id="${itemId}"]`
      ) as HTMLElement;
      if (element) {
        element.focus();
      }
    }, 10);
  }, []);

  /**
   * 导航到上一个项目
   */
  const navigatePrevious = useCallback(
    (currentItemId: string, items: MultiLineEditorItem<T>[]): string | null => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === currentItemId);

      if (currentIndex > 0) {
        const previousItem = sortedItems[currentIndex - 1];
        focusItem(previousItem.id);
        return previousItem.id;
      }

      return null;
    },
    [focusItem]
  );

  /**
   * 导航到下一个项目
   */
  const navigateNext = useCallback(
    (currentItemId: string, items: MultiLineEditorItem<T>[]): string | null => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === currentItemId);

      if (currentIndex < sortedItems.length - 1) {
        const nextItem = sortedItems[currentIndex + 1];
        focusItem(nextItem.id);
        return nextItem.id;
      }

      return null;
    },
    [focusItem]
  );

  /**
   * 向上移动项目（交换 position）
   */
  const moveItemUp = useCallback(
    (itemId: string, items: MultiLineEditorItem<T>[]): MultiLineEditorItem<T>[] | null => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === itemId);

      if (currentIndex === 0) {
        console.log('⚠️ [KeyboardNav] 已经在最顶部');
        return null;
      }

      // 与上一个项目交换 position
      const temp = sortedItems[currentIndex - 1];
      sortedItems[currentIndex - 1] = sortedItems[currentIndex];
      sortedItems[currentIndex] = temp;

      // 重新分配 position
      return sortedItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    },
    []
  );

  /**
   * 向下移动项目（交换 position）
   */
  const moveItemDown = useCallback(
    (itemId: string, items: MultiLineEditorItem<T>[]): MultiLineEditorItem<T>[] | null => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === itemId);

      if (currentIndex === sortedItems.length - 1) {
        console.log('⚠️ [KeyboardNav] 已经在最底部');
        return null;
      }

      // 与下一个项目交换 position
      const temp = sortedItems[currentIndex + 1];
      sortedItems[currentIndex + 1] = sortedItems[currentIndex];
      sortedItems[currentIndex] = temp;

      // 重新分配 position
      return sortedItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    },
    []
  );

  /**
   * 创建新项目（同级）
   */
  const createSiblingItem = useCallback(
    (afterItemId: string, level: number, items: MultiLineEditorItem<T>[]): {
      newItemId: string;
      newItems: MultiLineEditorItem<T>[];
    } => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === afterItemId);

      const newItemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newPosition = currentIndex + 1;

      // 找到父项目 ID
      let parentId: string | undefined = undefined;
      if (level > 0) {
        for (let i = currentIndex; i >= 0; i--) {
          if ((sortedItems[i].level || 0) < level) {
            parentId = sortedItems[i].id;
            break;
          }
        }
      }

      const newItem: MultiLineEditorItem<T> = {
        id: newItemId,
        content: '',
        level,
        position: newPosition,
        parentId,
      };

      // 插入新项目，并更新后续项目的 position
      const updatedItems = [
        ...sortedItems.slice(0, newPosition),
        newItem,
        ...sortedItems.slice(newPosition).map((item) => ({
          ...item,
          position: item.position + 1,
        })),
      ];

      console.log('➕ [KeyboardNav] 创建同级项目:', {
        newItemId,
        level,
        position: newPosition,
        parentId,
      });

      return { newItemId, newItems: updatedItems };
    },
    []
  );

  /**
   * 创建子项目
   */
  const createChildItem = useCallback(
    (parentItemId: string, items: MultiLineEditorItem<T>[]): {
      newItemId: string;
      newItems: MultiLineEditorItem<T>[];
    } => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const parentIndex = sortedItems.findIndex((item) => item.id === parentItemId);
      const parentItem = sortedItems[parentIndex];

      const newItemId = `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const newLevel = (parentItem.level || 0) + 1;
      const newPosition = parentIndex + 1;

      const newItem: MultiLineEditorItem<T> = {
        id: newItemId,
        content: '',
        level: newLevel,
        position: newPosition,
        parentId: parentItemId,
      };

      // 插入新项目
      const updatedItems = [
        ...sortedItems.slice(0, newPosition),
        newItem,
        ...sortedItems.slice(newPosition).map((item) => ({
          ...item,
          position: item.position + 1,
        })),
      ];

      console.log('➕ [KeyboardNav] 创建子项目:', {
        newItemId,
        level: newLevel,
        position: newPosition,
        parentId: parentItemId,
      });

      return { newItemId, newItems: updatedItems };
    },
    []
  );

  return {
    focusItem,
    navigatePrevious,
    navigateNext,
    moveItemUp,
    moveItemDown,
    createSiblingItem,
    createChildItem,
  };
};
