import { useEffect, useState, useCallback, RefObject } from 'react';

export interface FloatingToolbarPosition {
  top: number;
  left: number;
  show: boolean;
}

export interface UseFloatingToolbarOptions {
  /** 编辑区域的 ref */
  editorRef: RefObject<HTMLElement>;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 工具栏菜单项数量（用于数字键选择） */
  menuItemCount?: number;
  /** 数字键选择回调 */
  onMenuSelect?: (index: number) => void;
}

/**
 * 浮动工具栏 Hook
 * 监听文本选中和快捷键，计算工具栏显示位置
 * 快捷键：双击 Alt 呼出工具栏，然后按数字键 1-9 选择菜单项
 * 只有在编辑器内有焦点（编辑状态激活）时，快捷键才会生效
 */
export function useFloatingToolbar(options: UseFloatingToolbarOptions) {
  const { editorRef, enabled = true, menuItemCount = 5, onMenuSelect } = options;

  const [position, setPosition] = useState<FloatingToolbarPosition>({
    top: 0,
    left: 0,
    show: false,
  });

  // 双击 Alt 检测状态
  const [lastAltPressTime, setLastAltPressTime] = useState<number>(0);
  const [toolbarActive, setToolbarActive] = useState<boolean>(false); // 工具栏是否已呼出（等待数字键选择）

  // 计算工具栏位置（基于当前选区或光标）
  const calculatePosition = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) {
      return null;
    }

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();

    // 如果选区为空（没有选中文本）
    if (rect.width === 0 && rect.height === 0) {
      return null;
    }

    // 工具栏显示在选区上方，水平居中
    const TOOLBAR_OFFSET = 8; // 距离选区顶部的偏移
    const top = rect.top + window.scrollY - TOOLBAR_OFFSET;
    const left = rect.left + window.scrollX + rect.width / 2;

    return { top, left };
  }, []);

  // 显示工具栏
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

  // 隐藏工具栏
  const hideToolbar = useCallback(() => {
    setPosition((prev) => ({ ...prev, show: false }));
  }, []);

  // 监听鼠标选中
  const handleMouseUp = useCallback(() => {
    if (!enabled) return;

    // 延迟检查，确保选区已更新
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
      
      // 只有在编辑器内（编辑状态激活时）才响应快捷键
      if (!isInEditor) return;

      // 1. 检测双击 Alt 键
      if (event.key === 'Alt') {
        event.preventDefault();
        
        const now = Date.now();
        const timeSinceLastPress = now - lastAltPressTime;
        
        // 双击检测：两次按键间隔小于 500ms
        if (timeSinceLastPress < 500) {
          console.log('🎯 [FloatingToolbar] 双击 Alt 检测成功');
          
          // 显示工具栏
          const selection = window.getSelection();
          const selectedText = selection?.toString().trim();
          
          if (selectedText || selection?.rangeCount) {
            // 有选区或光标位置
            const pos = calculatePosition();
            if (!pos && selection?.rangeCount) {
              // 没有选区时，在光标位置显示
              const range = document.createRange();
              const sel = window.getSelection();
              if (sel && sel.anchorNode) {
                range.setStart(sel.anchorNode, sel.anchorOffset);
                range.collapse(true);
                const rect = range.getBoundingClientRect();
                
                setPosition({
                  top: rect.top + window.scrollY - 8,
                  left: rect.left + window.scrollX,
                  show: true,
                });
              }
            } else if (pos) {
              setPosition({
                top: pos.top,
                left: pos.left,
                show: true,
              });
            }
            
            setToolbarActive(true);
            console.log('✅ [FloatingToolbar] 工具栏已呼出，等待数字键选择');
          }
          
          // 重置计时器
          setLastAltPressTime(0);
        } else {
          // 记录本次按键时间
          setLastAltPressTime(now);
        }
        
        return;
      }

      // 2. 如果工具栏已激活，监听数字键 1-9
      if (toolbarActive && /^[1-9]$/.test(event.key)) {
        event.preventDefault();
        
        const menuIndex = parseInt(event.key) - 1;
        
        // 检查是否在菜单范围内
        if (menuIndex < menuItemCount) {
          console.log(`🎯 [FloatingToolbar] 选择菜单项 ${event.key} (索引 ${menuIndex})`);
          
          // 触发菜单选择回调
          if (onMenuSelect) {
            onMenuSelect(menuIndex);
          }
          
          // 隐藏工具栏
          hideToolbar();
          setToolbarActive(false);
        } else {
          console.warn(`⚠️ [FloatingToolbar] 菜单索引 ${menuIndex} 超出范围 (最大 ${menuItemCount - 1})`);
        }
        
        return;
      }

      // 3. 按 Escape 取消工具栏
      if (toolbarActive && event.key === 'Escape') {
        event.preventDefault();
        hideToolbar();
        setToolbarActive(false);
        console.log('🚫 [FloatingToolbar] 已取消工具栏');
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

      // 如果点击的是工具栏内部（包括所有版本）或 Picker 面板/Tippy 内容，不隐藏
      if (
        target.closest('.floating-toolbar') || 
        target.closest('.floating-toolbar-v2') ||
        target.closest('.headless-floating-toolbar') ||
        target.closest('.emoji-mart') ||
        target.closest('.tippy-box') ||
        target.closest('.tippy-content')
      ) {
        return;
      }

      hideToolbar();
      setToolbarActive(false); // 点击外部时取消工具栏激活状态
    },
    [enabled, position.show, hideToolbar]
  );
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

  // 获取当前选区的文本
  const getSelectedText = useCallback(() => {
    const selection = window.getSelection();
    return selection?.toString() || '';
  }, []);

  // 应用文本格式化
  const applyFormat = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value);
  }, []);

  return {
    position,
    showToolbar,
    hideToolbar,
    getSelectedText,
    applyFormat,
  };
}
