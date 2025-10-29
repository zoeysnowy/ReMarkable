import React, { useState } from 'react';
import './FloatingToolbar.css';

export interface FloatingToolbarProps {
  /** 工具栏位置 */
  position: {
    top: number;
    left: number;
    show: boolean;
  };
  /** 应用格式化的回调 */
  onFormat: (command: string, value?: string) => void;
  /** 获取当前选中文本 */
  getSelectedText?: () => string;
}

/**
 * 浮动文本格式化工具栏
 * 类似 Notion/Tiptap 的文本选中工具栏
 */
export const FloatingToolbar: React.FC<FloatingToolbarProps> = ({
  position,
  onFormat,
  getSelectedText,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showBgColorPicker, setShowBgColorPicker] = useState(false);

  if (!position.show) {
    return null;
  }

  // 格式化按钮点击处理
  const handleFormat = (command: string, value?: string) => {
    onFormat(command, value);
    // 格式化后保持焦点在编辑区域
    setTimeout(() => {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        range.collapse(false); // 光标移到选区末尾
      }
    }, 0);
  };

  // 颜色选择
  const colors = [
    { name: '默认', value: 'inherit' },
    { name: '红色', value: '#FF3B30' },
    { name: '橙色', value: '#FF9500' },
    { name: '黄色', value: '#FFCC00' },
    { name: '绿色', value: '#34C759' },
    { name: '蓝色', value: '#007AFF' },
    { name: '紫色', value: '#AF52DE' },
  ];

  return (
    <div
      className="floating-toolbar"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
      onMouseDown={(e) => e.preventDefault()} // 防止失去焦点
    >
      <div className="floating-toolbar-content">
        {/* 文本格式化组 */}
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            title="粗体 (Ctrl+B)"
            onClick={() => handleFormat('bold')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
              <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
            </svg>
          </button>

          <button
            className="toolbar-btn"
            title="斜体 (Ctrl+I)"
            onClick={() => handleFormat('italic')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 4h8v2h-3l-4 12h3v2H6v-2h3l4-12H10V4z" />
            </svg>
          </button>

          <button
            className="toolbar-btn"
            title="删除线"
            onClick={() => handleFormat('strikeThrough')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 11h18v2H3v-2zm6-6h6a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6zm0 12h6a3 3 0 0 1 0 6H9a3 3 0 0 1 0-6z" />
            </svg>
          </button>

          <button
            className="toolbar-btn"
            title="下划线 (Ctrl+U)"
            onClick={() => handleFormat('underline')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 3v7a6 6 0 0 0 12 0V3h-2v7a4 4 0 0 1-8 0V3H6zm-1 17h14v2H5v-2z" />
            </svg>
          </button>
        </div>

        <div className="toolbar-separator" />

        {/* 颜色组 */}
        <div className="toolbar-group">
          <div className="toolbar-color-picker">
            <button
              className="toolbar-btn"
              title="文字颜色"
              onClick={() => setShowColorPicker(!showColorPicker)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 3l-8 9h5v7h6v-7h5l-8-9z" />
              </svg>
            </button>

            {showColorPicker && (
              <div className="color-picker-popup">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className="color-swatch"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    onClick={() => {
                      handleFormat('foreColor', color.value);
                      setShowColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {/* 背景色选择器 */}
          <div className="toolbar-color-picker">
            <button
              className="toolbar-btn"
              title="背景颜色"
              onClick={() => setShowBgColorPicker(!showBgColorPicker)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M16.56 8.94L7.62 0 6.21 1.41l2.38 2.38-5.15 5.15c-.59.59-.59 1.54 0 2.12l5.5 5.5c.29.29.68.44 1.06.44s.77-.15 1.06-.44l5.5-5.5c.59-.58.59-1.53 0-2.12zM5.21 10L10 5.21 14.79 10H5.21zM19 11.5s-2 2.17-2 3.5c0 1.1.9 2 2 2s2-.9 2-2c0-1.33-2-3.5-2-3.5z"/>
                <path fillOpacity="0.36" d="M0 20h24v4H0z"/>
              </svg>
            </button>

            {showBgColorPicker && (
              <div className="color-picker-popup">
                {colors.map((color) => (
                  <button
                    key={color.value}
                    className="color-swatch"
                    style={{ backgroundColor: color.value }}
                    title={color.name}
                    onClick={() => {
                      handleFormat('hiliteColor', color.value);
                      setShowBgColorPicker(false);
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="toolbar-separator" />

        {/* 清除格式 */}
        <div className="toolbar-group">
          <button
            className="toolbar-btn"
            title="清除格式"
            onClick={() => handleFormat('removeFormat')}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M6 5v.18L8.82 8h2.4l-.72 1.68 2.1 2.1L14.21 8H20V5H6zm14 14l-1.41-1.41L3.59 2.59 2.18 4l6.37 6.37L6 16h3l1.5-3.5L15.41 17 17 18.41 18.41 20 20 18.41z" />
            </svg>
          </button>
        </div>
      </div>

      {/* 提示文本 */}
      <div className="toolbar-hint">按 Ctrl+/ 切换工具栏</div>
    </div>
  );
};
