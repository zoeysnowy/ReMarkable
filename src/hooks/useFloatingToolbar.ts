import { useEffect, useState, useCallback, RefObject } from 'react';

import { logger } from '../utils/logger';

const FloatingToolbarLogger = logger.module('FloatingToolbar');
export interface FloatingToolbarPosition {
  top: number;
  left: number;
  show: boolean;
}

export interface UseFloatingToolbarOptions {
  /** 编辑区域�?ref */
  editorRef: RefObject<HTMLElement>;
  /** 是否启用（默�?true�?*/
  enabled?: boolean;
  /** 工具栏菜单项数量（用于数字键选择�?*/
  menuItemCount?: number;
  /** 数字键选择回调 */
  onMenuSelect?: (index: number) => void;
}

/**
 * 浮动工具�?Hook
 * 监听文本选中和快捷键，计算工具栏显示位置
 * 快捷键：双击 Alt 呼出工具栏，然后按数字键 1-9 选择菜单�?
 * 只有在编辑器内有焦点（编辑状态激活）时，快捷键才会生�?
 */
export function useFloatingToolbar(options: UseFloatingToolbarOptions) {
  const { editorRef, enabled = true, menuItemCount = 5, onMenuSelect } = options;

  const [position, setPosition] = useState<FloatingToolbarPosition>({
    top: 0,
    left: 0,
    show: false,
  });

  // 双击 Alt 检测状�?
  const [lastAltPressTime, setLastAltPressTime] = useState<number>(0);
  const [toolbarActive, setToolbarActive] = useState<boolean>(false); // 工具栏是否已呼出（等待数字键选择�?

  // 计算工具栏位置（基于当前选区或光标）
  const calculatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 如果选区为空（没有选中文本�?
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    // 工具栏显示在选区上方，水平居�?
    const TOOLBAR_OFFSET = 8; // 距离选区顶部的偏�?
    const top = rect.top + window.scrollY - TOOLBAR_OFFSET;
    const left = rect.left + window.scrollX + rect.width / 2;

    return { top, left };
  }, []);

  // 显示工具�?
  const showToolbar = useCallback(() => {
    const pos = calculatePosition();
    if (pos) {
      setPosition({
        top: pos.top,
        left: pos.left,
        show: true,
      });
    }
  }, [calculatePosition]);

  // 隐藏工具�?
  const hideToolbar = useCallback(() => {
    setPosition((prev) => ({ ...prev, show: false }));
  }, []);

  // 监听鼠标选中
  const handleMouseUp = useCallback(() => {
    if (!enabled) return;

    // 延迟检查，确保选区已更�?
    setTimeout(() => {
      const selection = window.getSelection();
      const selectedText = selection?.toString().trim();

      if (selectedText) {
        showToolbar();
      } else {
        hideToolbar();
      }
    }, 10);
  }, [enabled, showToolbar, hideToolbar]);

  // 监听快捷键：双击 Alt 呼出工具栏，按数字键 1-9 选择菜单
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 检查是否在编辑器区域内
      const target = event.target as HTMLElement;
      const isInEditor = editorRef.current?.contains(target);
      
      // 只有在编辑器内（编辑状态激活时）才响应快捷�?
      if (!isInEditor) return;

      // 1. 检测双�?Alt �?
      if (event.key === 'Alt') {
        event.preventDefault();
        
        const now = Date.now();
        const timeSinceLastPress = now - lastAltPressTime;
        
        // 双击检测：两次按键间隔小于 500ms
        if (timeSinceLastPress < 500) {
          FloatingToolbarLogger.log('🎯 [FloatingToolbar] 双击 Alt 检测成�?);
          
          // 显示工具�?- 优先在光标位置显�?
          const selection = window.getSelection();
          
          if (selection && selection.rangeCount > 0) {
            const range = selection.getRangeAt(0);
            
            // 如果有选中文本，使用选区位置
            if (selection.toString().trim()) {
              const rect = range.getBoundingClientRect();
              // 显示在选区左侧的下�?
              setPosition({
                top: rect.bottom + window.scrollY + 8,
                left: rect.left + window.scrollX,
                show: true,
              });
            } else {
              // 没有选中文本，使用光标位�?
              // 尝试多种方法获取光标位置
              let cursorRect: DOMRect | null = null;
              
              // 方法1: 使用新的 range
              try {
                const cursorRange = document.createRange();
                cursorRange.setStart(range.startContainer, range.startOffset);
                cursorRange.collapse(true);
                cursorRect = cursorRange.getBoundingClientRect();
                FloatingToolbarLogger.log('📍 [FloatingToolbar] 方法1 cursorRect:', cursorRect);
              } catch (e) {
                FloatingToolbarLogger.warn('⚠️ [FloatingToolbar] 方法1 失败:', e);
              }
              
              // 方法2: 如果方法1失败或返回无效矩形，使用 activeElement
              if (!cursorRect || (cursorRect.width === 0 && cursorRect.height === 0)) {
                const activeElement = document.activeElement as HTMLElement;
                if (activeElement) {
                  cursorRect = activeElement.getBoundingClientRect();
                  FloatingToolbarLogger.log('📍 [FloatingToolbar] 方法2 activeElement rect:', cursorRect);
                }
              }
              
              if (cursorRect && cursorRect.height > 0) {
                // 显示在光标的右下方，偏移一些距离避免挡住文�?
                setPosition({
                  top: cursorRect.bottom + window.scrollY + 8,
                  left: cursorRect.left + window.scrollX + 20,
                  show: true,
                });
              } else {
                FloatingToolbarLogger.warn('⚠️ [FloatingToolbar] 无法获取有效的光标位�?);
                // 降级方案：在屏幕中间偏右位置显示
                setPosition({
                  top: window.scrollY + 100,
                  left: window.scrollX + 200,
                  show: true,
                });
              }
            }
            
            setToolbarActive(true);
            FloatingToolbarLogger.log('�?[FloatingToolbar] 工具栏已呼出，等待数字键选择');
          } else {
            FloatingToolbarLogger.warn('⚠️ [FloatingToolbar] 无法获取光标位置');
          }
          
          // 重置计时�?
          setLastAltPressTime(0);
        } else {
          // 记录本次按键时间
          setLastAltPressTime(now);
        }
        
        return;
      }

      // 2. 如果工具栏已激活，监听数字�?1-9
      if (toolbarActive && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        
        const menuIndex = parseInt(event.key) - 1;
        
        // 检查是否在菜单范围�?
        if (menuIndex < menuItemCount) {
          FloatingToolbarLogger.log(`🎯 [FloatingToolbar] 选择菜单�?${event.key} (索引 ${menuIndex})`);
          
          // 触发菜单选择回调
          if (onMenuSelect) {
            onMenuSelect(menuIndex);
          }
          
          // 不再隐藏工具栏，只是取消激活状�?
          // 这样工具栏保持显示，用户可以与打开�?picker 交互
          setToolbarActive(false);
          FloatingToolbarLogger.log('�?[FloatingToolbar] 菜单已打开，工具栏保持显示');
        } else {
          FloatingToolbarLogger.warn(`⚠️ [FloatingToolbar] 菜单索引 ${menuIndex} 超出范围 (最�?${menuItemCount - 1})`);
        }
        
        return;
      }

      // 3. �?Escape 取消工具�?
      if (toolbarActive && event.key === 'Escape') {
        event.preventDefault();
        hideToolbar();
        setToolbarActive(false);
        FloatingToolbarLogger.log('🚫 [FloatingToolbar] 已取消工具栏');
        return;
      }
    },
    [enabled, editorRef, lastAltPressTime, toolbarActive, menuItemCount, onMenuSelect, calculatePosition, hideToolbar]
  );

  // 监听点击外部区域
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !position.show) return;

      const target = event.target as HTMLElement;

      // 如果点击的是工具栏内部（包括所有版本）�?Picker 面板/Tippy 内容，不隐藏
      if (
        target.closest('.floating-toolbar') || 
        target.closest('.floating-toolbar-v2') ||
        target.closest('.headless-floating-toolbar') ||
        target.closest('.emoji-mart') ||
        target.closest('.tippy-box') ||
        target.closest('.tippy-content') ||
        target.closest('[class*="-picker-panel"]') ||
        target.closest('[class*="-tippy-content"]') ||
        target.closest('[data-tippy-root]') ||
        target.closest('.headless-date-range-popup') ||
        target.closest('.ant-picker-dropdown')
      ) {
        return;
      }

      // 如果点击的是编辑区域外部，隐藏工具栏
      if (!editorRef.current?.contains(target)) {
        hideToolbar();
        setToolbarActive(false); // 点击外部时取消工具栏激活状�?
      }
    },
    [enabled, position.show, editorRef, hideToolbar]
  );

  // 注册事件监听
  useEffect(() => {
    if (!enabled || !editorRef.current) return;

    const editor = editorRef.current;

    editor.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      editor.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [enabled, editorRef, handleMouseUp, handleKeyDown, handleClickOutside]);

  // 获取当前选区的文�?
  const getSelectedText = useCallback(() => {
    const selection = window.getSelection();
    return selection?.toString() || '';
  }, []);

  // 应用文本格式�?
  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  return {
    position,
    toolbarActive, // 工具栏是否已激活（等待数字键选择�?
    showToolbar,
    hideToolbar,
    getSelectedText,
    applyFormat,
  };
}
