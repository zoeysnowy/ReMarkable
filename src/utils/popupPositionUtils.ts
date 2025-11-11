/**
 * 浮窗位置计算工具函数
 * 
 * 用于计算浮窗的最佳显示位置，确保不超出窗口边界
 * 
 * @author Zoey Gong
 * @version 1.0.0
 */

export interface PopupPosition {
  top: number;
  left: number;
}

export interface PopupSize {
  width: number;
  height: number;
}

/**
 * 计算浮窗位置，确保不超出窗口边界
 * 
 * @param triggerRect - 触发元素的 DOMRect
 * @param popupSize - 浮窗的尺寸
 * @param options - 可选配置
 * @returns 计算后的位置
 * 
 * @example
 * ```tsx
 * const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
 *   const rect = e.currentTarget.getBoundingClientRect();
 *   const position = calculatePopupPosition(rect, {
 *     width: 300,
 *     height: 100
 *   });
 *   setHoverCardPosition(position);
 * };
 * ```
 */
export function calculatePopupPosition(
  triggerRect: DOMRect,
  popupSize: PopupSize,
  options: {
    /** 垂直偏移量（默认为触发元素下方 8px） */
    offsetY?: number;
    /** 水平偏移量（默认为 0） */
    offsetX?: number;
    /** 最小边距（默认 10px） */
    minMargin?: number;
    /** 优先显示在触发元素的哪一侧（默认 'bottom'） */
    preferredSide?: 'top' | 'bottom' | 'left' | 'right';
  } = {}
): PopupPosition {
  const {
    offsetY = 8,
    offsetX = 0,
    minMargin = 10,
    preferredSide = 'bottom'
  } = options;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const scrollY = window.scrollY;
  const scrollX = window.scrollX;

  let top = triggerRect.bottom + offsetY;
  let left = triggerRect.left + offsetX;

  // 根据优先显示方向调整初始位置
  if (preferredSide === 'top') {
    top = triggerRect.top - popupSize.height - offsetY;
  } else if (preferredSide === 'left') {
    left = triggerRect.left - popupSize.width - offsetX;
    top = triggerRect.top + (triggerRect.height - popupSize.height) / 2;
  } else if (preferredSide === 'right') {
    left = triggerRect.right + offsetX;
    top = triggerRect.top + (triggerRect.height - popupSize.height) / 2;
  }

  // 右边界检查：如果浮窗超出右侧，向左调整
  if (left + popupSize.width > viewportWidth - minMargin) {
    left = viewportWidth - popupSize.width - minMargin;
  }

  // 左边界检查
  if (left < minMargin) {
    left = minMargin;
  }

  // 下边界检查：如果浮窗超出底部，尝试显示在触发元素上方
  if (top + popupSize.height > viewportHeight + scrollY - minMargin) {
    if (preferredSide === 'bottom') {
      // 尝试翻转到上方
      const topAlternative = triggerRect.top - popupSize.height - offsetY;
      if (topAlternative >= scrollY + minMargin) {
        top = topAlternative;
      } else {
        // 上方也放不下，强制显示在底部并裁剪
        top = viewportHeight + scrollY - popupSize.height - minMargin;
      }
    }
  }

  // 上边界检查
  if (top < scrollY + minMargin) {
    top = scrollY + minMargin;
  }

  return { top, left };
}

/**
 * 计算浮窗位置（简化版，用于 fixed 定位）
 * 
 * @param triggerRect - 触发元素的 DOMRect
 * @param popupSize - 浮窗的尺寸
 * @param options - 可选配置
 * @returns 计算后的位置
 */
export function calculateFixedPopupPosition(
  triggerRect: DOMRect,
  popupSize: PopupSize,
  options: {
    offsetY?: number;
    offsetX?: number;
    minMargin?: number;
    preferredSide?: 'top' | 'bottom' | 'left' | 'right';
  } = {}
): PopupPosition {
  const {
    offsetY = 8,
    offsetX = 0,
    minMargin = 10,
    preferredSide = 'bottom'
  } = options;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = triggerRect.bottom + offsetY;
  let left = triggerRect.left + offsetX;

  // 根据优先显示方向调整初始位置
  if (preferredSide === 'top') {
    top = triggerRect.top - popupSize.height - offsetY;
  } else if (preferredSide === 'left') {
    left = triggerRect.left - popupSize.width - offsetX;
    top = triggerRect.top + (triggerRect.height - popupSize.height) / 2;
  } else if (preferredSide === 'right') {
    left = triggerRect.right + offsetX;
    top = triggerRect.top + (triggerRect.height - popupSize.height) / 2;
  }

  // 右边界检查
  if (left + popupSize.width > viewportWidth - minMargin) {
    left = viewportWidth - popupSize.width - minMargin;
  }

  // 左边界检查
  if (left < minMargin) {
    left = minMargin;
  }

  // 下边界检查
  if (top + popupSize.height > viewportHeight - minMargin) {
    if (preferredSide === 'bottom') {
      const topAlternative = triggerRect.top - popupSize.height - offsetY;
      if (topAlternative >= minMargin) {
        top = topAlternative;
      } else {
        top = viewportHeight - popupSize.height - minMargin;
      }
    }
  }

  // 上边界检查
  if (top < minMargin) {
    top = minMargin;
  }

  return { top, left };
}
