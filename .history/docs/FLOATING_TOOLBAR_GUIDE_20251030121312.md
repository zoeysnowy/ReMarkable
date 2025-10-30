# 浮动工具栏使用指南

## 📖 概述

`FloatingToolbar` 是一个类似 Notion/Tiptap 的文本选中工具栏组件，当用户选中文本时自动弹出，提供富文本编辑功能。

## ✨ 功能特性

### 触发方式
- **鼠标选中文本**：自动弹出工具栏
- **快捷键 `Alt + 1-5`**：切换工具栏显示/隐藏（仅在编辑器内激活时有效）
  - Alt+1：标签功能
  - Alt+2：表情功能
  - Alt+3：日期功能
  - Alt+4：优先级功能
  - Alt+5：颜色功能
- **点击外部区域**：自动隐藏

### 支持的ReMarkable组件
- # 插入标签，我们有tagpicker，如果没有的话可以从Editmodal/CalendarSettingsPanel里找到，highly recommend你将tagpicker独立成一个组件，然后再交给这些模块使用
- # 插入emoji，我们有emojipicker
- # 插入@，这是一个类似搜索然后引用的功能,用户可以引用event，也可以引用人（待开发，通讯录功能）
- # 插入时间，呼出一个Timepicker，用户可以输入起始时间，结束时间，也可以只输入其中之一，也可以勾选全天/allday，也可以勾选Milestone，也可以勾选需要同步的日历


### 支持的文本格式
- ✅ **粗体** (Ctrl+B)
- ✅ **斜体** (Ctrl+I)
- ✅ **删除线**
- ✅ **下划线** (Ctrl+U)
- ✅ **代码** 【删除】
- ✅ **插入链接** (Ctrl+K) 【删除】
- ✅ **文字颜色**（7种预设颜色）
- 【待添加】文字背景色
- 【待添加】bullet point，支持无限层级缩进，至少5个point的样式for 不同层级，支持点击point展开/收缩，有下级菜单的point在收缩状态下有动效，需要为层级展开和收缩添加快捷键
- ✅ **清除格式**

## 🎨 设计特点

- 深色半透明背景 + 毛玻璃效果
- 浮动在选区上方，水平居中
- 平滑的淡入/淡出动画
- 响应式适配（移动端优化）
- 自动支持深色/浅色主题

## 🚀 使用方式

### 1. 基础集成

```tsx
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { FloatingToolbar } from './FloatingToolbar';

function MyEditor() {
  const editorRef = useRef<HTMLDivElement>(null);
  
  const floatingToolbar = useFloatingToolbar({
    editorRef: editorRef as React.RefObject<HTMLElement>,
    enabled: true,
  });

  return (
    <div>
      <div ref={editorRef} contentEditable>
        可编辑内容...
      </div>
      
      <FloatingToolbar
        position={floatingToolbar.position}
        onFormat={floatingToolbar.applyFormat}
        getSelectedText={floatingToolbar.getSelectedText}
      />
    </div>
  );
}
```

### 2. Hook 参数

```tsx
interface UseFloatingToolbarOptions {
  /** 编辑区域的 ref（必需） */
  editorRef: RefObject<HTMLElement>;
  
  /** 是否启用（默认 true） */
  enabled?: boolean;
  
  /** 快捷键（默认 'Alt+1-5'，仅在编辑器内激活时生效） */
  shortcut?: string;
}
```

### 3. Hook 返回值

```tsx
const {
  position,         // 工具栏位置 { top, left, show }
  showToolbar,      // 手动显示工具栏
  hideToolbar,      // 手动隐藏工具栏
  getSelectedText,  // 获取选中的文本
  applyFormat,      // 应用文本格式
} = useFloatingToolbar(options);
```

## 📝 应用场景

### 在 PlanManager 中的使用
```tsx
// src/components/PlanManager.tsx
const editorContainerRef = useRef<HTMLDivElement>(null);

const floatingToolbar = useFloatingToolbar({
  editorRef: editorContainerRef as React.RefObject<HTMLElement>,
  enabled: true,
});

return (
  <div className="plan-items" ref={editorContainerRef}>
    {/* 可编辑的计划项 */}
    <div contentEditable>...</div>
    
    {/* 浮动工具栏 */}
    <FloatingToolbar
      position={floatingToolbar.position}
      onFormat={floatingToolbar.applyFormat}
      getSelectedText={floatingToolbar.getSelectedText}
    />
  </div>
);
```

### 在笔记编辑器中使用
```tsx
function NoteEditor() {
  const noteRef = useRef<HTMLTextAreaElement>(null);
  
  const floatingToolbar = useFloatingToolbar({
    editorRef: noteRef as React.RefObject<HTMLElement>,
    enabled: true,
  });

  return (
    <div>
      <textarea ref={noteRef} />
      <FloatingToolbar {...floatingToolbar} />
    </div>
  );
}
```

## 🎯 快捷键列表

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Alt + 1` | 标签功能 | 仅在编辑器内激活时有效 |
| `Alt + 2` | 表情功能 | 仅在编辑器内激活时有效 |
| `Alt + 3` | 日期功能 | 仅在编辑器内激活时有效 |
| `Alt + 4` | 优先级功能 | 仅在编辑器内激活时有效 |
| `Alt + 5` | 颜色功能 | 仅在编辑器内激活时有效 |
| `Ctrl + B` | 粗体 | 原生浏览器快捷键 |
| `Ctrl + I` | 斜体 | 原生浏览器快捷键 |
| `Ctrl + U` | 下划线 | 原生浏览器快捷键 |

## 🎨 颜色预设

工具栏提供 7 种预设颜色：

```tsx
const colors = [
  { name: '默认', value: 'inherit' },
  { name: '红色', value: '#FF3B30' },
  { name: '橙色', value: '#FF9500' },
  { name: '黄色', value: '#FFCC00' },
  { name: '绿色', value: '#34C759' },
  { name: '蓝色', value: '#007AFF' },
  { name: '紫色', value: '#AF52DE' },
];
```

## 🔧 自定义样式

### 修改工具栏背景色
```css
.floating-toolbar-content {
  background: rgba(30, 30, 30, 0.95); /* 深色模式 */
  /* 或 */
  background: rgba(255, 255, 255, 0.95); /* 浅色模式 */
}
```

### 修改按钮悬停效果
```css
.toolbar-btn:hover {
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
}
```

### 修改动画速度
```css
@keyframes floatingToolbarFadeIn {
  from {
    opacity: 0;
    transform: translate(-50%, -100%) scale(0.95);
  }
  to {
    opacity: 1;
    transform: translate(-50%, -100%) scale(1);
  }
}
```

## ⚠️ 注意事项

### 1. contentEditable 要求
工具栏依赖 `document.execCommand`，需要在 `contentEditable` 元素中使用。

### 2. 事件冒泡处理
```tsx
// 防止工具栏点击时失去焦点
<div onMouseDown={(e) => e.preventDefault()}>
  <button onClick={handleFormat}>格式化</button>
</div>
```

### 3. 移动端兼容性
- iOS/Android 浏览器支持 `document.execCommand`
- 移动端会自动隐藏提示文本
- 按钮尺寸自动缩小以适应小屏幕

### 4. 快捷键冲突
- `Ctrl+Space` 与输入法切换冲突 ❌
- `Alt` 与系统菜单栏冲突 ❌
- `Ctrl+/` 冲突较少 ✅（推荐）

## 🐛 常见问题

### Q: 工具栏不显示？
**A:** 检查以下几点：
1. `editorRef` 是否正确绑定到编辑区域
2. 编辑区域是否设置了 `contentEditable`
3. 是否有文本被选中（空选区不会显示）

### Q: 格式化不生效？
**A:** 确保：
1. 使用 `contentEditable` 而非 `<textarea>`
2. 浏览器支持 `document.execCommand`（现代浏览器均支持）
3. 没有其他脚本拦截了选区

### Q: 如何禁用工具栏？
**A:** 设置 `enabled` 参数：
```tsx
const floatingToolbar = useFloatingToolbar({
  editorRef: editorRef,
  enabled: false, // 禁用
});
```

### Q: 如何更改快捷键？
**A:** 传入自定义快捷键（需修改 Hook 代码）：
```tsx
const floatingToolbar = useFloatingToolbar({
  editorRef: editorRef,
  shortcut: 'Ctrl+K', // 自定义快捷键
});
```

## 📦 文件结构

```
src/
├── hooks/
│   └── useFloatingToolbar.ts    # Hook 核心逻辑
├── components/
│   ├── FloatingToolbar.tsx      # 工具栏组件
│   └── FloatingToolbar.css      # 工具栏样式
└── docs/
    └── FLOATING_TOOLBAR_GUIDE.md # 本文档
```

## 🔮 未来扩展

### 可能的增强功能
- [ ] 支持更多格式（标题、引用、代码块）
- [ ] 自定义按钮配置
- [ ] AI 辅助功能（润色、翻译）
- [ ] Markdown 语法支持
- [ ] 表情符号快捷插入
- [ ] @提及功能
- [ ] 斜杠命令（/command）

### 性能优化
- [ ] 虚拟滚动（大量文本场景）
- [ ] 防抖/节流优化
- [ ] 懒加载颜色选择器

## 📚 参考资源

- [Notion 编辑器](https://www.notion.so/)
- [Tiptap 编辑器](https://tiptap.dev/)
- [MDN: execCommand](https://developer.mozilla.org/en-US/docs/Web/API/Document/execCommand)
- [Selection API](https://developer.mozilla.org/en-US/docs/Web/API/Selection)

## 📄 License

MIT

---

**创建日期**: 2025-10-28  
**最后更新**: 2025-10-28  
**版本**: 1.0.0
