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
  /** 快捷键（默认 'Ctrl+/'） */
  shortcut?: string;
}

/**
 * 浮动工具栏 Hook
 * 监听文本选中和快捷键，计算工具栏显示位置
 */
export function useFloatingToolbar(options: UseFloatingToolbarOptions) {
  const { editorRef, enabled = true, shortcut = 'Ctrl+/' } = options;

  const [position, setPosition] = useState<FloatingToolbarPosition>({
    top: 0,
    left: 0,
    show: false,
  });

  // 计算工具栏位置（基于当前选区）
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

  // 监听快捷键 (Ctrl+/)
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (!enabled) return;

      // 解析快捷键
      const isCtrlSlash =
        (event.ctrlKey || event.metaKey) && event.key === '/';

      if (isCtrlSlash) {
        event.preventDefault();

        const selection = window.getSelection();
        const selectedText = selection?.toString().trim();

        // 修改逻辑：允许在没有选中文本时也显示工具栏
        // 工具栏会显示在光标位置
        if (position.show) {
          hideToolbar();
        } else {
          // 如果有选中文本，显示在选区上方
          // 如果没有选中文本，显示在光标位置
          if (selectedText || selection?.rangeCount) {
            showToolbar();
          } else {
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
          }
        }
      }
    },
    [enabled, position.show, showToolbar, hideToolbar]
  );

  // 监听点击外部区域
  const handleClickOutside = useCallback(
    (event: MouseEvent) => {
      if (!enabled || !position.show) return;

      const target = event.target as HTMLElement;

      // 如果点击的是工具栏内部，不隐藏
      if (target.closest('.floating-toolbar')) {
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

    // 添加全局键盘监听测试
    const testKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/') {
        console.log('🔑 [Global Test] Slash key detected!', {
          key: e.key,
          ctrl: e.ctrlKey,
          meta: e.metaKey,
          shift: e.shiftKey,
          alt: e.altKey,
          target: (e.target as HTMLElement).tagName,
        });
      }
    };

    editor.addEventListener('mouseup', handleMouseUp);
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', testKeyDown);  // 测试监听器
    document.addEventListener('mousedown', handleClickOutside);

    return () => {
      editor.removeEventListener('mouseup', handleMouseUp);
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', testKeyDown);
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
