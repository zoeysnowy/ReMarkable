# 颜色预览功能调试指南

## 问题描述

颜色选择器的实时预览功能未生效，需要诊断原因。

## 调试日志位置

已在以下位置添加详细的调试日志：

### 1. Picker 组件层 (UI 触发)

**TextColorPicker.tsx**
```typescript
onMouseEnter={() => {
  console.log('[TextColorPicker] 🎨 预览颜色:', {
    color: color.value,
    label: color.label,
    index,
    hasPreviewCallback: !!onPreview
  });
  onPreview?.(color.value);
}}
```

**BackgroundColorPicker.tsx**
```typescript
onMouseEnter={() => {
  console.log('[BackgroundColorPicker] 🖍 预览背景色:', {
    color: color.value,
    label: color.label,
    index,
    hasPreviewCallback: !!onPreview
  });
  onPreview?.(color.value);
}}
```

### 2. HeadlessFloatingToolbar 层 (回调传递)

```typescript
onPreview={(color) => {
  console.log('[HeadlessFloatingToolbar] 🎨 触发文本颜色预览:', { color });
  onTextFormat?.('textColor', color);
}}

onPreview={(color) => {
  console.log('[HeadlessFloatingToolbar] 🖍 触发背景颜色预览:', { color });
  onTextFormat?.('backgroundColor', color);
}}
```

### 3. applyTextFormat 层 (Slate API 调用)

```typescript
console.log('[applyTextFormat] 🎨 执行格式化命令:', {
  command,
  value,
  isFocused: ReactEditor.isFocused(editor as ReactEditor),
  selection: editor.selection,
  hasSelection: !!editor.selection,
  isCollapsed: editor.selection ? Range.isCollapsed(editor.selection) : null,
});

// 选区检查
if (!editor.selection) {
  console.error('[applyTextFormat] ❌ 无选区，无法应用格式');
  return false;
}

if (Range.isCollapsed(editor.selection)) {
  console.warn('[applyTextFormat] ⚠️ 选区已折叠（无选中文本），mark只会影响下次输入');
}

// Mark 应用
console.log('[applyTextFormat] ✅ 添加文本颜色 mark:', { color: value });
Editor.addMark(editor, 'color', value);
console.log('[applyTextFormat] 📊 当前 marks:', Editor.marks(editor));
```

### 4. 选区保持机制

**防止失焦处理：**
```typescript
<div 
  className="text-color-picker-panel"
  onMouseDown={(e) => {
    e.preventDefault(); // 🔒 防止点击 Picker 时编辑器失焦，保持选区
    console.log('[TextColorPicker] 🔒 阻止默认事件，保持编辑器选区');
  }}
>
```

## 测试步骤

### 步骤 1: 选中文本
1. 打开浏览器控制台 (F12)
2. 在 PlanManager 中选中一段文字
3. 观察控制台是否有选区信息

### 步骤 2: 打开颜色选择器
1. 点击 🎨 或 🖍 图标打开颜色选择器
2. 观察控制台日志，确认 Picker 已渲染

### 步骤 3: 鼠标悬停预览
1. 将鼠标移动到不同颜色选项上
2. 观察控制台日志，检查以下内容：

**预期日志流程：**
```
[TextColorPicker] 🎨 预览颜色: { color: '#ef4444', label: '红色', ... }
  ↓
[HeadlessFloatingToolbar] 🎨 触发文本颜色预览: { color: '#ef4444' }
  ↓
[applyTextFormat] 🎨 执行格式化命令: { command: 'textColor', value: '#ef4444', ... }
  ↓
[applyTextFormat] ✅ 添加文本颜色 mark: { color: '#ef4444' }
  ↓
[applyTextFormat] 📊 当前 marks: { color: '#ef4444' }
```

### 步骤 4: 诊断选区状态

**如果看到以下日志，说明选区丢失：**
```
[applyTextFormat] ❌ 无选区，无法应用格式
```

**可能的原因：**
1. ❌ `onMouseDown` 的 `e.preventDefault()` 未生效
2. ❌ Tippy.js 的配置导致焦点转移
3. ❌ 浏览器行为差异

**解决方案：**
- 检查浏览器控制台是否有 `[TextColorPicker] 🔒 阻止默认事件` 日志
- 如果没有，说明 `onMouseDown` 未触发

**如果看到以下日志，说明选区折叠：**
```
[applyTextFormat] ⚠️ 选区已折叠（无选中文本），mark只会影响下次输入
```

**可能的原因：**
1. ❌ 鼠标点击导致选区取消
2. ❌ 编辑器焦点切换导致选区重置

### 步骤 5: 检查 marks 应用

**如果 marks 正常添加，但颜色未显示：**
```
[applyTextFormat] 📊 当前 marks: { color: '#ef4444' }
```

**可能的原因：**
1. ❌ `renderLeaf` 函数未正确渲染 mark
2. ❌ CSS 样式被覆盖
3. ❌ React 重新渲染问题

**调试方法：**
- 使用 React DevTools 检查 Leaf 组件的 props
- 检查渲染的 `<span>` 元素的 `style` 属性
- 使用浏览器开发者工具检查实际 DOM

## 常见问题排查

### 问题 1: onPreview 回调未触发

**症状：** 鼠标悬停时无任何控制台日志

**检查点：**
- [ ] `onPreview` prop 是否正确传递给 Picker 组件
- [ ] `onMouseEnter` 事件是否正确绑定
- [ ] 鼠标是否真的悬停在按钮上（检查 CSS 布局）

### 问题 2: 选区丢失

**症状：** 出现 `❌ 无选区，无法应用格式`

**检查点：**
- [ ] `onMouseDown` 的 `e.preventDefault()` 是否执行
- [ ] Tippy.js 的 `interactive={true}` 是否设置
- [ ] 浏览器是否支持 `Selection API`

**临时解决方案：**
保存选区到状态，在 hover 时恢复：
```typescript
const [savedSelection, setSavedSelection] = useState<Range | null>(null);

// 打开 Picker 时保存选区
useEffect(() => {
  if (activePicker === 'textColor') {
    setSavedSelection(editor.selection);
  }
}, [activePicker]);

// 预览时恢复选区
onPreview={(color) => {
  if (savedSelection) {
    Transforms.select(editor, savedSelection);
  }
  onTextFormat?.('textColor', color);
}}
```

### 问题 3: marks 添加成功但不显示

**症状：** 日志显示 `📊 当前 marks: { color: '#ef4444' }` 但文字颜色未变

**检查点：**
1. 检查 `renderLeaf` 函数：
```typescript
const renderLeaf = useCallback((props: RenderLeafProps) => {
  let { attributes, children, leaf } = props;
  
  // 检查这里是否正确处理 color 和 backgroundColor
  const style: React.CSSProperties = {};
  if (leaf.color) style.color = leaf.color;
  if (leaf.backgroundColor) style.backgroundColor = leaf.backgroundColor;
  
  console.log('[renderLeaf] 渲染 leaf:', { leaf, style });
  
  return <span {...attributes} style={style}>{children}</span>;
}, []);
```

2. 使用 React DevTools 查看 Leaf 组件的 props
3. 使用浏览器检查器查看实际 DOM 的 style 属性

## 预期行为

✅ **正常流程：**
1. 选中文本 → 选区存在
2. 打开 Picker → 选区保持
3. 鼠标悬停 → 触发 onPreview
4. 调用 Editor.addMark → 添加 mark
5. Slate 重新渲染 → renderLeaf 应用样式
6. 文字颜色实时改变 → 用户看到预览

## 进一步调试

如果以上日志仍无法定位问题，可以：

1. **检查 Slate Editor 实例：**
```typescript
console.log('[DEBUG] Editor instance:', {
  editor,
  selection: editor.selection,
  children: editor.children,
  marks: Editor.marks(editor)
});
```

2. **检查 ReactEditor 状态：**
```typescript
console.log('[DEBUG] ReactEditor state:', {
  isFocused: ReactEditor.isFocused(editor),
  hasDOMNode: ReactEditor.hasDOMNode(editor, editor)
});
```

3. **监听 Slate onChange：**
在 UnifiedSlateEditor 的 onChange 中添加日志，查看 marks 变化

4. **使用 Slate DevTools：**
安装 `slate-devtools` 插件可视化查看 Slate 状态
