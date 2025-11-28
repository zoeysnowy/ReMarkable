# FloatingBar 键盘导航增强功能设计方案

**创建时间**: 2025-11-18  
**需求来源**: 用户需求 - 数字键打开菜单后的完整键盘导航体验

---

## 📋 需求概述

**用户需求**：
> FloatingBar 需要支持 keyboard 按数字键，打开对应位置的菜单，然后打开的菜单默认候选第一个元素，用户可以通过 keyboard 上下左右选择元素，然后按 enter 插入元素，光标停留在插入的元素后

**核心功能点**：
1. ✅ 数字键（1-9）打开对应位置的菜单（已实现）
2. 🆕 **打开菜单后自动聚焦第一个元素**（新增）
3. ✅ 方向键导航选择元素（已实现 useKeyboardNavigation）
4. ✅ Enter 确认插入（已实现）
5. 🆕 **插入后光标停留在插入元素后**（需增强）

---

## 🎯 现有架构分析

### 已实现功能

#### 1. 数字键打开菜单机制
**位置**: `useFloatingToolbar.ts`
```typescript
// 捕获阶段监听，优先级高于 Slate 编辑器
document.addEventListener('keydown', handleKeyDown, true);

// 数字键激活菜单
if ((toolbarActive || mode === 'menu_floatingbar' || mode === 'text_floatingbar') && /^[1-9]$/.test(event.key)) {
  event.preventDefault();
  event.stopPropagation();
  
  const menuIndex = parseInt(event.key) - 1;
  onMenuSelect(menuIndex); // 触发 activePickerIndex 更新
}
```

**HeadlessFloatingToolbar** 监听 `activePickerIndex` 变化：
```typescript
useEffect(() => {
  if (activePickerIndex !== null) {
    const feature = effectiveFeatures[activePickerIndex];
    
    if (textFormatCommands.includes(feature)) {
      // 文本格式化：直接执行
      onTextFormat?.(btnConfig.command);
      onRequestClose?.();
    } else {
      // 快捷操作：打开 Picker
      setActivePicker(feature);
    }
  }
}, [activePickerIndex]);
```

#### 2. Picker 键盘导航
**位置**: `useKeyboardNavigation.ts`

所有 Picker（PriorityPicker、ColorPicker、TagPicker）已支持：
- **↑↓ 或 ←→**: 在选项之间导航
- **Enter**: 确认选择
- **Esc**: 关闭 Picker
- **鼠标悬停**: 自动同步 hoveredIndex

**关键特性**：
- 默认 `hoveredIndex = 0`（第一个元素）
- 自动滚动到焦点项（`scrollIntoView`）
- CSS 焦点样式 `.keyboard-focused`

### 需要增强的部分

#### ❌ 问题 1：打开 Picker 时焦点未自动设置
**现象**：数字键打开 Picker 后，虽然 `hoveredIndex = 0`，但可能需要确保焦点状态正确初始化

**解决方案**：
- ✅ `useKeyboardNavigation` 已默认设置 `hoveredIndex = 0`
- ✅ 只需确保 Picker 渲染时立即应用焦点样式

#### ❌ 问题 2：插入元素后光标位置未保持
**现象**：
- Tag、Emoji、DateMention 插入后，光标可能跳到其他位置
- 用户期望光标停留在插入的元素**之后**，方便继续输入

**当前实现**：
```typescript
// helpers.ts - insertTag
export function insertTag(editor: Editor, tagId: string, tagName: string): boolean {
  Transforms.insertNodes(editor, tagNode);
  Transforms.move(editor); // 🔧 光标移动到 tag 后
  return true;
}
```

**问题**：
- `Transforms.move(editor)` 可能不够明确
- Slate 编辑器的焦点可能在插入后丢失

---

## 🚀 增强方案设计

### 方案 1：确保 Picker 打开时焦点正确

**目标**：数字键打开 Picker 后，第一个元素立即高亮

**实现位置**：`useKeyboardNavigation.ts`

**当前代码**：
```typescript
export function useKeyboardNavigation<T>({...}) {
  const [hoveredIndex, setHoveredIndex] = useState(0); // ✅ 已默认为 0
  
  // ...键盘事件处理
}
```

**增强方案**：
```typescript
// 🆕 添加 items 变化时重置焦点
useEffect(() => {
  setHoveredIndex(0); // 每次 items 更新时重置到第一项
}, [items]);
```

**影响范围**：
- ✅ PriorityPicker
- ✅ ColorPicker
- ✅ TagPicker（需特殊处理搜索框）

---

### 方案 2：插入元素后恢复编辑器焦点并定位光标

**目标**：
1. 插入 Tag/Emoji/DateMention 后，Slate 编辑器重新获得焦点
2. 光标停留在插入元素的**后面**（inline 元素右侧）
3. 用户可以立即继续输入

**实现位置**：`PlanSlateEditor/helpers.ts`

#### 2.1 Tag 插入增强

**当前代码**：
```typescript
export function insertTag(editor: Editor, tagId: string, tagName: string): boolean {
  const tagNode: TagNode = {
    type: 'tag',
    tagId,
    tagName,
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, tagNode);
  Transforms.move(editor); // 光标移动
  return true;
}
```

**增强方案**：
```typescript
export function insertTag(editor: Editor, tagId: string, tagName: string): boolean {
  const { ReactEditor } = require('slate-react');
  
  // 1. 确保编辑器有焦点
  ReactEditor.focus(editor);
  
  const tagNode: TagNode = {
    type: 'tag',
    tagId,
    tagName,
    children: [{ text: '' }],
  };

  // 2. 插入 Tag 节点
  Transforms.insertNodes(editor, tagNode);
  
  // 3. 光标移动到 Tag 之后（明确移动到下一个位置）
  Transforms.move(editor, { distance: 1, unit: 'offset' });
  
  // 4. 插入一个空格（可选，避免光标紧贴 Tag）
  Transforms.insertText(editor, ' ');
  
  return true;
}
```

#### 2.2 Emoji 插入增强

**当前代码**：
```typescript
export function insertEmoji(editor: Editor, emoji: string): boolean {
  Transforms.insertText(editor, emoji);
  return true;
}
```

**增强方案**：
```typescript
export function insertEmoji(editor: Editor, emoji: string): boolean {
  const { ReactEditor } = require('slate-react');
  
  // 1. 确保编辑器有焦点
  ReactEditor.focus(editor);
  
  // 2. 插入 Emoji 文本
  Transforms.insertText(editor, emoji);
  
  // 3. 光标已经在 emoji 后面，再插入一个空格（可选）
  Transforms.insertText(editor, ' ');
  
  return true;
}
```

#### 2.3 DateMention 插入增强

**当前代码**：
```typescript
export function insertDateMention(
  editor: Editor,
  startDate: string,
  endDate?: string,
  mentionOnly?: boolean,
  eventId?: string,
  displayHint?: string
): boolean {
  const dateMentionNode: DateMentionNode = {
    type: 'dateMention',
    // ...
    children: [{ text: '' }],
  };

  Transforms.insertNodes(editor, dateMentionNode);
  Transforms.move(editor);
  return true;
}
```

**增强方案**：
```typescript
export function insertDateMention(...): boolean {
  const { ReactEditor } = require('slate-react');
  
  // 1. 确保编辑器有焦点
  ReactEditor.focus(editor);
  
  const dateMentionNode: DateMentionNode = {
    type: 'dateMention',
    // ...
    children: [{ text: '' }],
  };

  // 2. 插入 DateMention 节点
  Transforms.insertNodes(editor, dateMentionNode);
  
  // 3. 光标移动到 DateMention 之后
  Transforms.move(editor, { distance: 1, unit: 'offset' });
  
  // 4. 插入一个空格
  Transforms.insertText(editor, ' ');
  
  return true;
}
```

---

### 方案 3：TagPicker 特殊处理

**问题**：TagPicker 支持搜索，需要区分两种状态：
1. **搜索框有焦点**：允许输入，不拦截箭头键
2. **搜索框失焦**：启用键盘导航

**当前实现**（`TagPicker.tsx`）：
```typescript
const { hoveredIndex, setHoveredIndex, containerRef } = useKeyboardNavigation({
  items: filteredTags,
  onSelect: (tag) => handleTagToggle(tag.id),
  onClose,
  enabled: !isSearchFocused, // 🔧 搜索框聚焦时禁用键盘导航
  gridColumns: 1,
});
```

**增强方案**：确保数字键打开 TagPicker 时，默认**不聚焦**搜索框

**实现**：
```typescript
// TagPicker.tsx
export const TagPicker: React.FC<TagPickerProps> = ({...}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  
  // 🆕 Picker 打开时不自动聚焦搜索框（允许键盘导航）
  // 用户可以手动点击或按 `/` 激活搜索
  
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    // 按 `/` 激活搜索框
    if (event.key === '/' && !isSearchFocused) {
      event.preventDefault();
      searchInputRef.current?.focus();
      setIsSearchFocused(true);
    }
  }, [isSearchFocused]);
  
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);
  
  return (
    <div className="tag-picker-panel">
      {/* 搜索框 */}
      <input
        ref={searchInputRef}
        type="text"
        placeholder="搜索标签（按 / 激活）"
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        onFocus={() => setIsSearchFocused(true)}
        onBlur={() => setIsSearchFocused(false)}
      />
      
      {/* 标签列表 */}
      <div ref={containerRef}>
        {filteredTags.map((tag, index) => (
          <div
            className={`tag-option ${index === hoveredIndex ? 'keyboard-focused' : ''}`}
            onClick={() => handleTagToggle(tag.id)}
            onMouseEnter={() => setHoveredIndex(index)}
          >
            {tag.name}
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

## 📋 实施步骤

### Step 1: 更新 PRD 文档

**文件**: `docs/PRD/FLOATING_COMPONENTS_PRD.md`

**添加章节**: `## 🎹 键盘导航增强 (2025-11-18)`

**内容**：
- 数字键打开 Picker 后默认高亮第一项
- 插入元素后光标自动停留在元素后
- TagPicker 搜索框按需激活（按 `/`）

### Step 2: 增强 helpers.ts 插入函数

**文件**: `src/components/PlanSlateEditor/helpers.ts`

**修改函数**：
- `insertTag()` - 添加焦点恢复和光标定位
- `insertEmoji()` - 添加焦点恢复
- `insertDateMention()` - 添加焦点恢复和光标定位

**关键点**：
- 使用 `ReactEditor.focus(editor)` 恢复焦点
- 使用 `Transforms.move(editor, { distance: 1, unit: 'offset' })` 明确移动光标
- 可选：插入空格避免元素粘连

### Step 3: 增强 useKeyboardNavigation.ts

**文件**: `src/components/FloatingToolbar/pickers/useKeyboardNavigation.ts`

**添加逻辑**：
```typescript
// 每次 items 变化时重置到第一项
useEffect(() => {
  setHoveredIndex(0);
}, [items]);
```

### Step 4: 增强 TagPicker.tsx

**文件**: `src/components/FloatingToolbar/pickers/TagPicker.tsx`

**修改**：
- 搜索框默认不自动聚焦
- 添加 `/` 快捷键激活搜索
- 更新 placeholder 提示

### Step 5: 测试验证

**测试场景**：

1. **数字键打开 PriorityPicker**
   - ✅ 第一项自动高亮
   - ✅ 方向键可导航
   - ✅ Enter 确认后光标在原位置

2. **数字键打开 TagPicker**
   - ✅ 第一项自动高亮
   - ✅ 搜索框未聚焦（允许键盘导航）
   - ✅ 按 `/` 激活搜索
   - ✅ Enter 选中 tag 后光标在 tag 后

3. **数字键打开 EmojiPicker**
   - ✅ 选择 emoji 后光标在 emoji 后

4. **数字键打开 DatePicker**
   - ✅ 选择日期后光标在 dateMention 后

---

## 🎨 用户体验流程

### 完整操作流程

```
1. 用户双击 Alt → FloatingBar 出现（menu_floatingbar 模式）

2. 用户按数字键 `1` → TagPicker 打开
   - 第一个 tag 自动高亮（.keyboard-focused 样式）
   - 搜索框未聚焦（允许方向键导航）
   
3. 用户按 ↓ 键 → 第二个 tag 高亮
   
4. 用户按 ↓ 键 → 第三个 tag 高亮
   
5. 用户按 Enter → 第三个 tag 插入到编辑器
   - Tag 节点插入
   - 光标移动到 tag 之后
   - 自动插入一个空格
   - 编辑器重新获得焦点
   - TagPicker 关闭
   - FloatingBar 关闭
   
6. 用户可以立即继续输入文本
```

---

## ⚙️ 技术细节

### 焦点管理优先级

1. **Slate 编辑器焦点**
   - 最高优先级
   - 插入元素后必须恢复

2. **Picker 键盘导航**
   - Picker 打开时生效
   - 不干扰编辑器焦点

3. **TagPicker 搜索框**
   - 按需激活（按 `/`）
   - 聚焦时禁用键盘导航

### 光标定位策略

**Slate Transforms API**：
```typescript
// 方案 1：相对移动（推荐）
Transforms.move(editor, { distance: 1, unit: 'offset' });

// 方案 2：绝对定位
Transforms.select(editor, {
  anchor: { path: [0, 1], offset: 0 },
  focus: { path: [0, 1], offset: 0 }
});

// 方案 3：移动到节点后
Transforms.collapse(editor, { edge: 'end' });
```

**推荐使用方案 1**：
- 简单明确
- 适用于 inline 元素插入
- 自动处理复杂结构

### CSS 焦点样式

已实现（参考 `PriorityPicker.css`）：
```css
.priority-item.keyboard-focused {
  background-color: #e0f2fe;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}
```

---

## 🔍 边缘情况处理

### 1. 编辑器失去焦点
**场景**：用户点击其他区域后按数字键

**处理**：
- `useFloatingToolbar` 已检查 `editorRef.current?.contains(target)`
- 只在编辑器内响应快捷键

### 2. 插入空文档
**场景**：编辑器为空时插入元素

**处理**：
- Slate 自动创建段落节点
- `Transforms.insertNodes` 处理边界情况

### 3. TagPicker 搜索结果为空
**场景**：搜索后无匹配结果

**处理**：
```typescript
useEffect(() => {
  setHoveredIndex(0); // 重置到第一项
}, [filteredTags]);

// 渲染时检查
{filteredTags.length === 0 && (
  <div className="no-results">未找到标签</div>
)}
```

---

## 📊 实施优先级

| 功能 | 优先级 | 难度 | 影响范围 |
|------|--------|------|---------|
| helpers.ts 插入函数增强 | 🔴 高 | 简单 | 所有 Picker |
| useKeyboardNavigation 重置逻辑 | 🟡 中 | 简单 | 所有 Picker |
| TagPicker 搜索框优化 | 🟡 中 | 中等 | TagPicker |
| PRD 文档更新 | 🟢 低 | 简单 | 文档 |

---

## 🚀 预期效果

**提升点**：
1. ✅ **无缝键盘操作**：从打开到插入全程无需鼠标
2. ✅ **即时反馈**：第一项自动高亮，用户知道当前焦点
3. ✅ **光标定位准确**：插入后立即可以继续输入
4. ✅ **体验流畅**：焦点自动恢复，无需手动点击编辑器

**用户体验**：
- 双击 Alt → 按 1 → ↓↓↓ → Enter → 继续输入
- **全程 6 个操作，无需鼠标**

---

## 📝 相关文档

- [FLOATING_COMPONENTS_PRD.md](./FLOATING_COMPONENTS_PRD.md) - FloatingBar 完整文档
- [SLATE_EDITOR_PRD.md](./SLATE_EDITOR_PRD.md) - Slate 编辑器文档
- [useKeyboardNavigation.ts](../../src/components/FloatingToolbar/pickers/useKeyboardNavigation.ts) - 键盘导航 Hook

---

**设计者**: GitHub Copilot  
**最后更新**: 2025-11-18
