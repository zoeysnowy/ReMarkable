/**
 * 层级缩进管理 Hook
 * 参照 TagManager 的层级逻辑，处理 Tab/Shift+Tab 缩进
 */

import { useCallback } from 'react';
import { MultiLineEditorItem, IndentChangeResult } from '../types';

export const useIndentManager = <T,>() => {
  /**
   * 增加缩进（Tab）
   * 智能限制：最多比上一个项目多 1 级
   */
  const increaseIndent = useCallback(
    (
      itemId: string,
      currentLevel: number,
      items: MultiLineEditorItem<T>[]
    ): IndentChangeResult | null => {
      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === itemId);

      if (currentIndex === -1) return null;

      // 如果是第一项，不能增加缩进
      if (currentIndex === 0) {
        console.log('🚫 [IndentManager] 第一项无法增加缩进');
        return null;
      }

      // 获取上一项的层级
      const previousItem = sortedItems[currentIndex - 1];
      const previousLevel = previousItem.level || 0;

      // 智能限制：最多比上一项多 1 级
      const maxAllowedLevel = previousLevel + 1;

      if (currentLevel >= maxAllowedLevel) {
        console.log(
          `🚫 [IndentManager] 已达到最大层级限制 (${maxAllowedLevel})`
        );
        return null;
      }

      const newLevel = currentLevel + 1;

      // 查找新的父项：向前找第一个层级比新层级小的项目
      let newParentId: string | undefined = undefined;

      for (let i = currentIndex - 1; i >= 0; i--) {
        if ((sortedItems[i].level || 0) < newLevel) {
          newParentId = sortedItems[i].id;
          console.log('🎯 [IndentManager] 找到父项:', {
            childId: itemId,
            parentId: newParentId,
            parentName: sortedItems[i].content,
            newLevel,
          });
          break;
        }
      }

      return { newLevel, newParentId };
    },
    []
  );

  /**
   * 减少缩进（Shift+Tab）
   */
  const decreaseIndent = useCallback(
    (
      itemId: string,
      currentLevel: number,
      items: MultiLineEditorItem<T>[]
    ): IndentChangeResult | null => {
      if (currentLevel === 0) {
        console.log('🚫 [IndentManager] 已经是顶级层级');
        return null;
      }

      const sortedItems = [...items].sort((a, b) => a.position - b.position);
      const currentIndex = sortedItems.findIndex((item) => item.id === itemId);

      if (currentIndex === -1) return null;

      const newLevel = currentLevel - 1;

      // 查找新的父项：向前找第一个层级比新层级小的项目
      let newParentId: string | undefined = undefined;

      if (newLevel > 0) {
        for (let i = currentIndex - 1; i >= 0; i--) {
          if ((sortedItems[i].level || 0) < newLevel) {
            newParentId = sortedItems[i].id;
            console.log('🎯 [IndentManager] 找到新父项:', {
              childId: itemId,
              parentId: newParentId,
              parentName: sortedItems[i].content,
              newLevel,
            });
            break;
          }
        }
      }

      return { newLevel, newParentId };
    },
    []
  );

  /**
   * 修复项目的 position 值（去重）
   */
  const fixPositions = useCallback((items: MultiLineEditorItem<T>[]): MultiLineEditorItem<T>[] => {
    const sortedItems = [...items].sort((a, b) => (a.position || 0) - (b.position || 0));

    // 检查是否有重复的 position
    const positions = sortedItems.map((item) => item.position || 0);
    const uniquePositions = Array.from(new Set(positions));

    if (positions.length !== uniquePositions.length) {
      console.warn('⚠️ [IndentManager] 发现重复的 position，正在修复...');
      return sortedItems.map((item, index) => ({
        ...item,
        position: index,
      }));
    }

    return items;
  }, []);

  /**
   * 计算项目的层级（基于 parentId）
   */
  const calculateLevel = useCallback(
    (
      item: MultiLineEditorItem<T>,
      allItems: MultiLineEditorItem<T>[],
      visited = new Set<string>()
    ): number => {
      // 如果已经有 level，直接返回
      if (item.level !== undefined) {
        return item.level;
      }

      // 如果没有 parentId，是顶级项目
      if (!item.parentId) {
        return 0;
      }

      // 防止循环引用
      if (visited.has(item.id)) {
        console.warn('⚠️ [IndentManager] 检测到循环引用:', item.id, item.content);
        return 0;
      }
      visited.add(item.id);

      // 找到父项目
      const parent = allItems.find((t) => t.id === item.parentId);
      if (!parent) {
        console.warn(
          '⚠️ [IndentManager] 找不到父项目:',
          item.parentId,
          '对于项目:',
          item.content
        );
        return 0;
      }

      // 递归计算父项目的 level，然后 +1
      return calculateLevel(parent, allItems, visited) + 1;
    },
    []
  );

  return {
    increaseIndent,
    decreaseIndent,
    fixPositions,
    calculateLevel,
  };
};
