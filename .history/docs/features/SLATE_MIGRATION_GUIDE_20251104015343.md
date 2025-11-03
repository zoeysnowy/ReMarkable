# Slate.js 编辑器迁移指南

## 概述

将 ReMarkable 项目从 Tiptap 编辑器迁移到 Slate.js + Tippy.js + Headless UI 架构。

## 迁移日期

2025-11-04

## 技术栈变更

### 之前（Tiptap）
- **编辑器框架**: Tiptap (基于 ProseMirror)
- **版本**: @tiptap/react ^3.10.1
- **特点**: 
  - 高层封装，开箱即用
  - 扩展系统强大
  - 文档丰富

### 之后（Slate.js）
- **编辑器框架**: Slate.js
- **版本**: 
  - slate ^0.118.1
  - slate-react ^0.118.2
  - slate-dom ^0.118.1
  - slate-history ^0.113.1
  - slate-android-plugin ^0.118.1 (移动端支持)
- **UI 组件**: Tippy.js ^6.3.7, @headlessui/react ^2.2.9
- **特点**:
  - 更灵活的架构
  - 更细粒度的控制
  - 更轻量级
  - 更好的 TypeScript 支持
  - **移动端优化**：集成 slate-android-plugin，解决 Android 输入法问题

## 架构对比

### Tiptap 架构

```
TiptapFreeFormEditor
  └─ TiptapLine (每行一个 Tiptap 实例)
       ├─ TagNode (自定义节点)
       ├─ DateMention (扩展)
       └─ StarterKit (内置扩展)
```

### Slate.js 架构

```
SlateFreeFormEditor
  └─ SlateLine (每行一个 Slate 实例)
       ├─ TagElement (自定义元素)
       ├─ DateMentionElement (自定义元素)
       └─ 自定义插件系统
```

## 核心组件

### 1. SlateLine.tsx
替代 `TiptapLine.tsx`，提供单行编辑功能。

**主要功能**:
- 单行编辑器实例
- 自定义元素渲染（Tag, DateMention）
- 键盘事件处理
- 格式化支持（粗体、斜体、下划线等）
- HTML 序列化/反序列化

### 2. SlateFreeFormEditor.tsx
替代 `TiptapFreeFormEditor.tsx`，提供多行编辑功能。

**主要功能**:
- 多行管理
- 缩进控制
- 行导航（上下箭头）
- 多行选择
- 行前缀/后缀渲染

### 3. SlateFloatingToolbar.tsx
新增组件，使用 Tippy.js 实现浮动工具栏。

**主要功能**:
- 文本选择时显示
- 格式化按钮（B/I/U/S/Code）
- 自动定位

### 4. 自定义元素

#### TagElement.tsx
渲染标签元素，支持：
- 颜色自定义
- Emoji 显示
- 与 TagService 同步
- 交互式高亮

#### DateMentionElement.tsx
渲染日期提及元素，支持：
- 日期显示
- 格式化
- 交互式高亮

## 类型系统

### types.ts
定义所有 Slate 相关类型：

```typescript
// 自定义元素类型
export type CustomElement = 
  | ParagraphElement 
  | TagElement 
  | DateMentionElement;

// 自定义文本类型
export type CustomText = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color?: string;
  code?: boolean;
};
```

## 工具函数

### utils.ts
提供核心工具函数：

1. **serializeToHtml** - Slate 内容转 HTML
2. **deserializeFromHtml** - HTML 转 Slate 内容
3. **insertTag** - 插入标签节点
4. **insertDateMention** - 插入日期提及
5. **toggleMark** - 切换文本格式
6. **isMarkActive** - 检查格式状态

## 功能对比

| 功能 | Tiptap | Slate.js | 状态 |
|------|--------|----------|------|
| 单行编辑 | ✅ | ✅ | 完成 |
| 多行编辑 | ✅ | ✅ | 完成 |
| 自定义节点 | ✅ | ✅ | 完成 |
| 格式化 | ✅ | ✅ | 完成 |
| 快捷键 | ✅ | ✅ | 完成 |
| 浮动工具栏 | ✅ | ✅ | 完成 |
| 缩进控制 | ✅ | ✅ | 完成 |
| HTML 序列化 | ✅ | ✅ | 完成 |
| 历史记录 | ✅ | ✅ | 完成 |

## 键盘快捷键

### 格式化
- `Ctrl/Cmd + B` - 粗体
- `Ctrl/Cmd + I` - 斜体
- `Ctrl/Cmd + U` - 下划线

### 导航
- `Enter` - 创建新行（Title 模式）/ 换行（Description 模式）
- `Shift + Enter` - 创建描述行（Title 模式）/ 换行（Description 模式）
- `Tab` - 增加缩进
- `Shift + Tab` - 减少缩进
- `↑` - 聚焦上一行（光标在开始时）
- `↓` - 聚焦下一行（光标在末尾时）
- `Backspace` - 删除空行

### 多选
- `Shift + Click` - 范围选择
- `Ctrl/Cmd + Click` - 多选

## 样式系统

### SlateLine.css
单行编辑器样式：
- `.slate-line` - 行容器
- `.slate-line-description` - 描述模式
- `.inline-tag` - 标签元素
- `.date-mention` - 日期提及

### SlateFloatingToolbar.css
浮动工具栏样式：
- `.slate-floating-toolbar` - 工具栏容器
- `.toolbar-button` - 按钮
- `.toolbar-button.active` - 激活状态

## 迁移步骤

### 1. 安装依赖
```bash
npm install slate slate-react slate-history --legacy-peer-deps
npm install --save-dev @types/slate @types/slate-react
```

### 2. 创建 Slate 组件
- [x] 类型定义 (types.ts)
- [x] 工具函数 (utils.ts)
- [x] 核心组件 (SlateLine.tsx)
- [x] 多行编辑器 (SlateFreeFormEditor.tsx)
- [x] 自定义元素 (TagElement.tsx, DateMentionElement.tsx)
- [x] 浮动工具栏 (SlateFloatingToolbar.tsx)

### 3. 更新组件引用
- [x] PlanManager.tsx - 更新导入和使用

### 4. 移除旧代码
- [ ] 删除 TiptapLine.tsx
- [ ] 删除 TiptapFreeFormEditor.tsx
- [ ] 删除 TiptapEditor 相关文件
- [ ] 卸载 Tiptap 依赖

## 优势

### 1. 更灵活的架构
Slate.js 提供了更细粒度的控制，可以轻松定制编辑器行为。

### 2. 更好的 TypeScript 支持
Slate.js 的类型系统更完善，提供更好的类型推导和错误检查。

### 3. 更小的包体积
相比 Tiptap + ProseMirror，Slate.js 更轻量。

### 4. 更好的性能
Slate.js 使用 React 的渲染机制，与 React 应用集成更自然。

### 5. 统一的 UI 库
使用 Tippy.js 和 Headless UI 提供一致的 UI 体验。

## 注意事项

### 1. 内容迁移
现有的 HTML 内容需要通过 `deserializeFromHtml` 函数转换。

### 2. 插件系统
Slate.js 的插件系统与 Tiptap 不同，需要重新实现自定义功能。

### 3. 性能优化
- 使用 `useMemo` 缓存编辑器实例
- 避免不必要的重渲染
- 合理使用 `React.memo`

### 4. 浏览器兼容性
Slate.js 需要现代浏览器支持，确保测试兼容性。

## 测试清单

- [ ] 基本文本编辑
- [ ] 格式化（粗体、斜体、下划线等）
- [ ] 自定义元素（Tag、DateMention）
- [ ] 多行导航
- [ ] 缩进控制
- [ ] 浮动工具栏
- [ ] 快捷键
- [ ] HTML 序列化/反序列化
- [ ] 与 PlanManager 集成
- [ ] 多行选择
- [ ] 撤销/重做

## 下一步

1. **测试覆盖** - 编写单元测试和集成测试
2. **性能优化** - 使用 React DevTools 分析性能
3. **用户反馈** - 收集使用反馈，持续改进
4. **文档完善** - 补充使用文档和 API 文档
5. **清理旧代码** - 移除 Tiptap 相关代码和依赖

## 参考资料

- [Slate.js 官方文档](https://docs.slatejs.org/)
- [Tippy.js 官方文档](https://atomiks.github.io/tippyjs/)
- [Headless UI 官方文档](https://headlessui.com/)
- [原 Tiptap 实现](./TIPTAP_PHASE2_INTEGRATION.md)

## 贡献者

- Zoey Gong (主要开发者)

---

最后更新: 2025-11-04
