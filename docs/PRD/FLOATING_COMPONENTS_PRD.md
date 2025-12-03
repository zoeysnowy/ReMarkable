# 4DNote 浮动组件产品需求文档 (PRD)

**最后更新**: 2025-11-18

## 📖 概述

ReMarkable 提供基于 **Headless UI** 设计的浮动工具栏组件，用于增强文本编辑和快速操作体验：

**核心组件**: `HeadlessFloatingToolbar` - 统一的浮动工具栏，支持两种模式

**✅ 重要更新**: 
- **2025-11-18**: 文本颜色和背景颜色功能上线，支持实时预览
- **2025-11-14**: Bullet Point 多级列表功能已完成，支持 5 级缩进和持久化保存
- **2025-11-14**: 删除后层级自动调整功能已实现

---

# Part 1: HeadlessFloatingToolbar 统一浮动工具栏

## 🎯 两种工作模式

`HeadlessFloatingToolbar` 是一个统一组件，根据 `mode` 属性显示不同的功能集：

### 1️⃣ Menu FloatingBar 模式 (`menu_floatingbar`)

**触发方式**: 
- 双击 `Alt` 键
- **快捷键 `Alt + 1-7`**：直接激活对应功能
  - `Alt+1`：标签功能 (Tag)
  - `Alt+2`：表情功能 (Emoji)
  - `Alt+3`：日期功能 (Date Range)
  - `Alt+4`：优先级功能 (Priority)
  - `Alt+5`：颜色功能 (Color)
  - `Alt+6`：任务功能 (Add Task)
  - `Alt+7`：Bullet Point (仅 eventlog 模式) 🆕

**快速选择**: FloatingBar 显示时，按 `1-7` 数字键快速激活对应位置的功能
- **文本格式化命令**（Bold, Italic, Bullet 等）：**直接执行**，无需打开 Picker
- **快捷操作功能**（Tag, Emoji, Date 等）：**打开对应 Picker** 进行选择

**功能列表**:
- 🏷️ **Tag** - 标签选择器
- 😀 **Emoji** - 表情选择器
- 📅 **Date Range** - 日期时间选择器
- ⚡ **Priority** - 优先级设置
- 🎨 **Color** - 颜色标记
- ✅ **Add Task** - 创建任务
- ● **Bullet Point** - 多级列表（仅 eventlog 模式显示）🆕

**适用场景**: 快速设置事件元数据（标签、时间、优先级等）+ eventlog 列表格式化

**插入元素后光标处理**: 
- Tag、Emoji、DateMention 等 void 元素插入后，需要正确设置光标位置
- 详见 [SLATE_EDITOR_PRD.md - 插入 Void 元素后的光标设置](./SLATE_EDITOR_PRD.md#插入-void-元素后的光标设置-)

### 2️⃣ Text FloatingBar 模式 (`text_floatingbar`)

**触发方式**: 
- **鼠标选中文本**
- **键盘选中文本**（Shift + 方向键）🆕

**功能列表**:
- **B** - 粗体 (Ctrl+B)
- *I* - 斜体 (Ctrl+I)
- <u>U</u> - 下划线 (Ctrl+U)
- ~~S~~ - 删除线
- 🎨 **文本颜色** - 9种颜色选择（黑、红、橙、黄、绿、蓝、紫、粉、灰）🆕
- 🖍️ **背景颜色** - 8种颜色 + 无背景选项 🆕
- 🧹 **Clear Format** - 清除格式
- ● **Bullet** - Bullet Point 列表 🆕

**颜色选择器特性** (2025-11-18):
- ✅ **实时预览**: 鼠标悬停即可看到颜色效果，无需点击
- ✅ **键盘导航**: 使用数字键 1-9 快速选择颜色
- ✅ **同时应用**: 文本颜色和背景颜色可以同时设置
- ✅ **选区保持**: 预览时选区不会丢失或变化
- ✅ **CSS优化**: 使用 `-webkit-text-fill-color` 确保选中状态下颜色可见

**适用场景**: 文本格式化编辑 + 内容高亮标注

## ✨ Bullet Point 功能特性 (2025-11-14)

- ✅ **5 级缩进层级** (●○–□▸)
- ✅ **Tab/Shift+Tab 快捷键**调整层级
- ✅ **自动同步** EventLine.level (缩进) 和 paragraph.bulletLevel (符号)
- ✅ **持久化保存** (HTML data-* 属性)
- ✅ **多行 EventLog 支持**，每行独立层级
- ✅ **删除后自动调整** - 删除 level 0 行后，level 1 自动降级为 level 0
- 📋 **待添加**：
  - Bullet Point 折叠/展开功能
  - Bullet Point 拖拽排序

## 🎨 文本颜色功能特性 (2025-11-18)

### 核心能力
- ✅ **9种文本颜色** - 黑/红/橙/黄/绿/蓝/紫/粉/灰
- ✅ **8种背景颜色** - 红底/橙底/黄底/绿底/蓝底/紫底/粉底/灰底 + 无背景
- ✅ **实时预览** - 鼠标悬停即可预览颜色效果，无需点击
- ✅ **键盘快捷键** - 数字键 1-9 快速选择颜色
- ✅ **同时应用** - 文本颜色和背景颜色可同时设置
- ✅ **选区保持** - 预览和选择过程中选区不会丢失

### 技术实现亮点
1. **预览机制优化**
   - 使用 `Editor.addMark()` 直接操作 marks，避免触发复杂的格式化逻辑
   - 保存原始选区 `savedSelectionRef`，预览期间选区保持不变
   - 关闭时恢复选区，确保用户体验流畅

2. **CSS 选中样式突破**
   - 浏览器默认选中样式（蓝底白字）会覆盖自定义颜色
   - 使用 `-webkit-text-fill-color: unset !important` 强制保持颜色
   - 选中背景降至极淡（0.15 透明度），颜色清晰可见

3. **Tippy.js 配置优化**
   - `interactiveBorder={20}` - 防止鼠标移入时菜单自动关闭
   - `appendTo={() => document.body}` - 避免 z-index 层级问题

### 使用示例
```typescript
// 用户操作流程
1. 选中文本 "重要提醒"
2. Text FloatingBar 自动显示
3. 点击 🎨 文本颜色图标 → 打开颜色选择器
4. 鼠标悬停红色 → 文字实时变红色（预览）
5. 按数字键 2 或点击红色 → 确认应用
6. 点击 🖍️ 背景颜色图标 → 打开背景色选择器
7. 选择红底 → 文字有红色背景
8. 结果: <span style="color: #ef4444; background-color: #fee2e2">重要提醒</span>
```

### 颜色调色板

**文本颜色（TextColorPicker）**:
```typescript
const textColors = [
  { value: '#000000', label: '黑色（默认）' },
  { value: '#ef4444', label: '红色' },
  { value: '#f59e0b', label: '橙色' },
  { value: '#eab308', label: '黄色' },
  { value: '#22c55e', label: '绿色' },
  { value: '#3b82f6', label: '蓝色' },
  { value: '#8b5cf6', label: '紫色' },
  { value: '#ec4899', label: '粉色' },
  { value: '#6b7280', label: '灰色' },
];
```

**背景颜色（BackgroundColorPicker）**:
```typescript
const backgroundColors = [
  { value: '#fee2e2', label: '红底' },
  { value: '#fed7aa', label: '橙底' },
  { value: '#fef3c7', label: '黄底' },
  { value: '#d1fae5', label: '绿底' },
  { value: '#dbeafe', label: '蓝底' },
  { value: '#e0e7ff', label: '紫底' },
  { value: '#fce7f3', label: '粉底' },
  { value: '#f3f4f6', label: '灰底' },
  { value: '', label: '无背景' }, // 清除背景色
];
```

## 🎨 设计特点

- 深色半透明背景 + 毛玻璃效果
- 浮动在选区上方，水平居中
- 平滑的淡入/淡出动画
- 响应式适配（移动端优化）
- 自动支持深色/浅色主题

## 🚀 基础集成

### TypeScript 类型定义

```typescript
interface FloatingToolbarProps {
  // Slate editor 实例引用
  unifiedEditorRef: React.RefObject<Editor>;
  
  // 工作模式（menu 或 text）
  mode?: 'menu_floatingbar' | 'text_floatingbar';
  
  // 标签选择回调
  onTagSelect?: (tagIds: string[]) => void;
  
  // 时间应用回调
  onTimeApplied?: (start: string, end?: string) => void;
  
  // 其他回调...
}
```

### Menu 模式集成（PlanManager）

```tsx
import { HeadlessFloatingToolbar } from '@/components/FloatingToolbar/HeadlessFloatingToolbar';

function PlanManager() {
  const unifiedEditorRef = useRef<Editor>(null);

  return (
    <>
      <PlanSlateEditor
        onEditorReady={(editor) => {
          unifiedEditorRef.current = editor;
        }}
      />
      
      {/* Menu FloatingBar - 双击 Alt 触发 */}
      <HeadlessFloatingToolbar
        mode="menu_floatingbar"
        unifiedEditorRef={unifiedEditorRef}
        onTagSelect={(tagIds) => {
          const tag = TagService.getTagById(tagIds[0]);
          insertTag(unifiedEditorRef.current, tag.id, tag.name, tag.color);
        }}
        onTimeApplied={(start, end) => {
          insertDateMention(unifiedEditorRef.current, start, end);
        }}
      />
      
      {/* Text FloatingBar - 选中文字触发 */}
      <HeadlessFloatingToolbar
        mode="text_floatingbar"
        unifiedEditorRef={unifiedEditorRef}
      />
    </>
  );
}
```

## 🎯 智能关联功能

FloatingBar 支持 **智能关联模式**，根据当前编辑的是标题 (Title) 还是描述 (Description) 自动调整行为：

### Title 模式
- **标签/时间** → 关联到 Event 元数据
- 影响筛选、搜索、日历显示
- 标签保存在 `event.tags` 数组
- 时间保存在 `event.start/end`

### Description 模式
- **标签/时间** → 仅作为 mention 显示（纯视觉）
- 不影响元数据
- 使用 `.mention-only` class 标记

### 模式检测实现

```typescript
// PlanManager 中跟踪当前聚焦模式
const [currentFocusedMode, setCurrentFocusedMode] = useState<'title' | 'description'>('title');

const handleFocus = (e: FocusEvent) => {
  const target = e.target as HTMLElement;
  const lineId = target.getAttribute('data-line-id');
  
  // 检测是否为 description 行
  const isDescriptionLine = lineId.includes('-desc') || target.classList.contains('description-mode');
  setCurrentFocusedMode(isDescriptionLine ? 'description' : 'title');
};
```

### 标签关联逻辑

**Title 模式：更新元数据**
```typescript
if (!isDescriptionMode) {
  // 提取非 mention-only 标签
  const tagElements = tempDiv.querySelectorAll('.inline-tag:not(.mention-only)');
  const extractedTags: string[] = [];
  tagElements.forEach(tagEl => {
    const tagName = tagEl.getAttribute('data-tag-name');
    if (tagName) extractedTags.push(tagName);
  });
  
  const updatedItem = {
    ...item,
    tags: extractedTags,  // ✅ 更新元数据
    content: updatedContent
  };
  handleUpdateItem(updatedItem);
}
```

**Description 模式：仅插入视觉标签**
```typescript
else {
  // 插入 mention-only 标签
  const tagMentionHtml = `<span class="inline-tag mention-only" 
                            data-tag-name="${tagName}" 
                            contenteditable="false"
                            style="background: #e0e0e0; padding: 2px 6px; border-radius: 4px; margin: 0 2px;">
                            #${tagName}
                          </span>`;
  insertHtmlAtCursor(tagMentionHtml);
}
```

### 数据结构示例

```typescript
// Title 模式 - 元数据更新
{
  id: "event-123",
  title: "完成项目设计 #urgent",  // 富文本
  tags: ["urgent"],                 // ✅ 元数据
  start: "2024-01-15T14:00:00Z",   // ✅ 元数据
  content: "<p>完成项目设计 <span class='inline-tag'>urgent</span></p>"
}

// Description 模式 - 仅视觉
{
  id: "event-123-desc",
  title: "完成项目设计",
  tags: [],                         // ❌ 不更新
  content: "<p>需要与 #urgent 团队协作</p>"  // mention-only
}
```

## 🎯 快捷键列表

### 全局快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| **双击 Alt** | 打开 Menu FloatingBar | 显示完整菜单 |
| `Alt+1` | 标签功能 | 直接打开标签选择器 |
| `Alt+2` | 表情功能 | 直接打开表情选择器 |
| `Alt+3` | 日期功能 | 直接打开日期时间选择器 |
| `Alt+4` | 优先级功能 | 直接打开优先级设置 |
| `Alt+5` | 颜色功能 | 直接打开颜色选择 |
| `Alt+6` | 任务功能 | 直接创建任务 |
| `Alt+7` | Bullet Point | 切换列表（仅 eventlog 模式）🆕 |

### FloatingBar 显示时

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `1` | 激活第 1 个菜单 | Tag |
| `2` | 激活第 2 个菜单 | Emoji |
| `3` | 激活第 3 个菜单 | Date Range |
| `4` | 激活第 4 个菜单 | Priority |
| `5` | 激活第 5 个菜单 | Color |
| `6` | 激活第 6 个菜单 | Add Task |
| `7` | 激活第 7 个菜单 | Bullet Point (eventlog 模式) 🆕 |
| `Esc` | 关闭 FloatingBar | - |

### Text FloatingBar 快捷键

| 快捷键 | 功能 | 适用模式 |
|--------|------|----------|
| `Ctrl+B` | 粗体 | Text FloatingBar |
| `Ctrl+I` | 斜体 | Text FloatingBar |
| `Ctrl+U` | 下划线 | Text FloatingBar |
| `Tab` | 增加 Bullet 层级 | Bullet 编辑 |
| `Shift+Tab` | 减少 Bullet 层级 | Bullet 编辑 |

## 🔧 实现注意事项

### 数字键事件处理

FloatingBar 使用**捕获阶段**（capture phase）监听数字键，确保在 Slate 编辑器之前拦截数字键输入：

```typescript
// useFloatingToolbar.ts
document.addEventListener('keydown', handleKeyDown, true); // 🔧 capture: true

// 处理数字键
if ((toolbarActive || mode === 'menu_floatingbar' || mode === 'text_floatingbar') && /^[1-9]$/.test(event.key)) {
  event.preventDefault();
  event.stopPropagation(); // 🔧 阻止事件冒泡到 Slate 编辑器
  
  const menuIndex = parseInt(event.key) - 1;
  onMenuSelect(menuIndex);
}
```

**关键点**：
- `capture: true` 确保 FloatingBar 优先于 Slate 编辑器接收事件
- `stopPropagation()` 阻止数字键被插入到编辑器内容中
- 支持三种状态：`toolbarActive`、`menu_floatingbar`、`text_floatingbar`

### 功能类型区分

数字键激活功能时，系统会自动区分两类行为：

```typescript
// HeadlessFloatingToolbar.tsx
const textFormatCommands = ['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'];

if (textFormatCommands.includes(feature)) {
  // 文本格式化：直接执行命令
  const btnConfig = textFeatureConfig[feature];
  onTextFormat?.(btnConfig.command);
  onRequestClose?.(); // 执行后关闭 FloatingBar
} else {
  // 快捷操作：打开 Picker
  setActivePicker(feature);
}
```

### effectiveFeatures 计算

系统根据 `mode` 动态决定显示的功能列表：

```typescript
const menuFloatingbarFeatures = ['tag', 'emoji', 'dateRange', 'priority', 'color', 'addTask', 'bullet'];
const textFloatingbarFeatures = ['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'];

const effectiveFeatures = mode === 'text_floatingbar' 
  ? textFloatingbarFeatures 
  : menuFloatingbarFeatures;

// 数字键激活时使用 effectiveFeatures
const feature = effectiveFeatures[activePickerIndex];
```

**重要**：`effectiveFeatures` 必须在 `useEffect` **之前**计算，否则数字键无法正确激活功能。

### Bullet Point 对齐

Bullet 点使用相对单位实现自适应对齐：

```css
.slate-bullet-paragraph[data-level="0"]::before {
  font-size: 0.65em; /* 🔧 相对字体大小 */
  line-height: 1; /* 🔧 bullet 自身行高 */
  top: 0.5em; /* 🔧 相对偏移，与第一行文字居中 */
}

.slate-bullet-paragraph {
  padding-left: 1.5em; /* 🔧 bullet 与文字间距 */
}
```

**优势**：
- 用户修改字体大小时，bullet 点自动缩放和对齐
- 不依赖 hardcoded 像素值，支持响应式设计

## ⌨️ 键盘导航 (2025-11-14)

FloatingBar 的 Picker 组件支持完整的键盘导航：

### 通用键盘快捷键

- **↑/↓ 或 ←/→**: 在选项之间导航（自动高亮）
- **空格键**: 切换当前项的选中状态（仅多选模式，如 TagPicker）
- **Enter**: 确认选择并关闭 Picker（触发插入）
- **Esc**: 取消选择并关闭 Picker
- **鼠标悬停**: 自动更新焦点索引
- **`/` 键**: 激活搜索框（TagPicker 专用）

### 支持的 Picker 组件

| Picker | 布局类型 | 导航键 | 状态 |
|--------|---------|--------|------|
| **PriorityPicker** | 列表布局 | ↑/↓ | ✅ 已实现 |
| **ColorPicker** | 4列网格 | ↑/↓/←/→ | ✅ 已实现 |
| **TagPicker** | 层级列表 + 搜索 | ↑/↓ | ✅ 已实现 |
| **SimpleDatePicker** | Ant Design | 内置支持 | ⚠️ 废弃 |
| **UnifiedDateTimePicker** | 复杂组件 | 自定义滚动 | ⏳ 待实现 |

### TagPicker 特殊处理

TagPicker 基于 `HierarchicalTagPicker` 组件，支持智能键盘导航：

- **搜索框获得焦点时**：允许正常输入，不拦截箭头键
- **搜索框失焦后**：启用键盘导航，↑↓ 选择标签
- **空格键**：切换当前高亮标签的选中状态（支持多选）
- **Enter 键**：确认并关闭 Picker（触发插入所有已选标签到编辑器）
- **`/` 键**：激活搜索框（按需搜索）
- **过滤结果改变时**：自动重置 `hoveredIndex` 到第一项
- **鼠标悬停**：自动同步 `hoveredIndex`

**多选模式交互流程**：
```
1. 打开 TagPicker（第一项自动高亮）
2. 按 ↓ 或 ↑ 导航到其他标签
3. 按 空格 切换选中状态（可多次操作）
4. 按 Enter 确认并插入所有已选标签
5. FloatingBar 和 TagPicker 自动关闭
6. 光标停留在最后一个 Tag 后
```

### 实现细节：useKeyboardNavigation Hook

所有 Picker 共享一个通用 Hook `useKeyboardNavigation`，提供：

```typescript
const { hoveredIndex, setHoveredIndex, containerRef } = useKeyboardNavigation({
  items: PRIORITIES,              // 选项数组
  onSelect: (item) => {...},      // 选择回调
  onClose: () => {...},           // 关闭回调
  enabled: true,                  // 是否启用
  gridColumns: 1,                 // 网格列数（1=列表，4=ColorPicker 网格）
});
```

**功能特性**：
- 自动滚动到焦点项（`scrollIntoView`）
- 网格布局支持 2D 导航（↑↓ 移动行，←→ 移动列）
- 鼠标悬停自动同步 `hoveredIndex`
- 视觉反馈：`.keyboard-focused` CSS 类

### CSS 焦点样式示例

```css
/* PriorityPicker */
.priority-item.keyboard-focused {
  background-color: #e0f2fe;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
}

/* ColorPicker */
.color-item.keyboard-focused {
  border-color: #1e293b;
  box-shadow: 0 0 0 2px white, 0 0 0 4px #1e293b;
  transform: scale(1.15);
}
.color-item.keyboard-focused .color-checkmark {
  display: block; /* 显示 ✓ 符号 */
}

/* TagPicker */
.tag-option.keyboard-focused {
  background: #e0f2fe;
  border-left: 3px solid #3b82f6;
  padding-left: 9px; /* 补偿边框宽度 */
}
.tag-option.keyboard-focused.selected {
  background: #bfdbfe; /* 已选中 + 键盘焦点 */
}
```

## 🎹 键盘导航增强 (2025-11-18)

### 完整键盘操作流程

FloatingBar 现已支持**从打开到插入的全程键盘操作**，无需鼠标：

```
1. 双击 Alt → FloatingBar 出现（menu_floatingbar 模式）
2. 按数字键 1-7 → 对应 Picker 打开，第一项自动高亮
3. 按 ↑↓←→ → 在选项间导航
4. 按 Enter → 选中并插入元素
5. 光标自动停留在插入元素后 → 可立即继续输入
```

**示例场景**：插入标签
```
双击 Alt → 按 1 → ↓↓ → Enter → 继续输入
全程 6 个操作，无需鼠标 ✨
```

### 增强功能详解

#### 1️⃣ 打开 Picker 时自动聚焦第一项

**功能**：数字键打开 Picker 后，第一个元素立即高亮显示

**实现**：
```typescript
// useKeyboardNavigation.ts
const [hoveredIndex, setHoveredIndex] = useState(0); // 默认第一项

// items 变化时重置焦点
useEffect(() => {
  setHoveredIndex(0);
}, [items]);
```

**用户体验**：
- ✅ 无需额外按键，立即知道当前焦点位置
- ✅ 可直接按 Enter 选择第一项
- ✅ 或按方向键导航到其他项

#### 2️⃣ 插入元素后光标自动定位

**功能**：插入 Tag/Emoji/DateMention 后，光标停留在元素**之后**，可立即继续输入

**实现**：
```typescript
// helpers.ts - insertTag
export function insertTag(editor: Editor, tagId: string, tagName: string): boolean {
  const { ReactEditor } = require('slate-react');
  
  // 1. 确保编辑器有焦点
  ReactEditor.focus(editor);
  
  // 2. 插入 Tag 节点
  Transforms.insertNodes(editor, tagNode);
  
  // 3. 光标移动到 Tag 之后
  Transforms.move(editor, { distance: 1, unit: 'offset' });
  
  // 4. 插入空格（避免元素粘连）
  Transforms.insertText(editor, ' ');
  
  return true;
}
```

**适用于**：
- `insertTag()` - Tag 节点插入
- `insertEmoji()` - Emoji 文本插入
- `insertDateMention()` - DateMention 节点插入

**用户体验**：
- ✅ 插入后编辑器自动获得焦点
- ✅ 光标精确定位在插入元素后
- ✅ 自动插入空格，避免元素粘连
- ✅ 无需手动点击编辑器

#### 3️⃣ TagPicker 搜索框按需激活

**问题**：TagPicker 有搜索框，如果自动聚焦会干扰键盘导航

**解决方案**：
- **默认**：搜索框不聚焦，启用键盘导航（↑↓ 选择标签）
- **按 `/` 键**：激活搜索框，可输入搜索关键词
- **搜索框失焦**：自动恢复键盘导航

**实现**：
```typescript
// TagPicker.tsx
const searchInputRef = useRef<HTMLInputElement>(null);
const [isSearchFocused, setIsSearchFocused] = useState(false);

// 按 `/` 激活搜索框
const handleKeyDown = useCallback((event: KeyboardEvent) => {
  if (event.key === '/' && !isSearchFocused) {
    event.preventDefault();
    searchInputRef.current?.focus();
  }
}, [isSearchFocused]);

// 键盘导航仅在搜索框失焦时启用
const { hoveredIndex, setHoveredIndex } = useKeyboardNavigation({
  items: filteredTags,
  onSelect: handleTagToggle,
  enabled: !isSearchFocused, // 🔧 关键逻辑
});
```

**用户体验**：
- ✅ 打开 TagPicker 后可直接用方向键导航
- ✅ 需要搜索时按 `/` 激活搜索框
- ✅ 搜索完成后按 Esc 回到导航模式

### 技术细节

#### 焦点管理优先级

1. **Slate 编辑器焦点**（最高优先级）
   - 插入元素后必须恢复
   - 使用 `ReactEditor.focus(editor)`

2. **Picker 键盘导航**
   - Picker 打开时生效
   - 不干扰编辑器焦点

3. **TagPicker 搜索框**
   - 按需激活（按 `/`）
   - 聚焦时禁用键盘导航

#### 光标定位策略

```typescript
// 推荐：相对移动（适用于 inline 元素）
Transforms.move(editor, { distance: 1, unit: 'offset' });

// 备选：移动到节点后
Transforms.collapse(editor, { edge: 'end' });

// 不推荐：绝对定位（需要计算 path）
Transforms.select(editor, { anchor: {...}, focus: {...} });
```

### 支持的 Picker 列表

| Picker | 打开后默认焦点 | 键盘导航 | 插入后光标定位 | 状态 |
|--------|--------------|---------|---------------|------|
| **PriorityPicker** | ✅ 第一项高亮 | ✅ ↑↓ | ✅ 原位置 | ✅ 已实现 |
| **ColorPicker** | ✅ 第一项高亮 | ✅ ↑↓←→ | ✅ 原位置 | ✅ 已实现 |
| **TagPicker** | ✅ 第一项高亮 | ✅ ↑↓ + `/` 搜索 | ✅ Tag 后 | ✅ 已实现 |
| **EmojiPicker** | ✅ 默认面板 | ✅ 内置导航 | ✅ Emoji 后 | ✅ 已实现 |
| **UnifiedDateTimePicker** | ✅ 默认日期 | ✅ 自定义滚动 | ✅ DateMention 后 | ✅ 已实现 |

### 完整操作示例

#### 场景 1：插入标签
```
1. 双击 Alt → FloatingBar 出现
2. 按 1 → TagPicker 打开，第一个标签高亮
3. 按 ↓↓ → 导航到第三个标签
4. 按 Enter → 标签插入，光标在标签后
5. 输入 "项目进展" → 文字紧跟标签后
```

#### 场景 2：插入日期
```
1. 双击 Alt → FloatingBar 出现
2. 按 3 → DatePicker 打开
3. 选择日期 → DateMention 插入，光标在后
4. 输入 "开会" → 文字紧跟日期后
```

#### 场景 3：搜索并插入标签
```
1. 双击 Alt → FloatingBar 出现
2. 按 1 → TagPicker 打开
3. 按 / → 搜索框激活
4. 输入 "工作" → 过滤显示匹配标签
5. 按 Esc → 退出搜索，回到键盘导航
6. 按 ↓ → 选择标签
7. 按 Enter → 标签插入
```

### 相关文档

详细设计方案请参考：
- [FloatingBar 键盘导航增强设计方案](./FLOATING_KEYBOARD_NAVIGATION_ENHANCEMENT.md)
- [useKeyboardNavigation Hook 实现](../../src/components/FloatingToolbar/pickers/useKeyboardNavigation.ts)

## 🐛 常见问题排查

### 1. 数字键无法激活菜单

**现象**：按数字键后无响应，或数字被插入到编辑器中

**原因**：
1. 事件监听器未使用捕获阶段
2. 缺少 `event.stopPropagation()`
3. `effectiveFeatures` 为空数组

**解决方案**：
```typescript
// 检查 1: 确认使用捕获阶段
document.addEventListener('keydown', handleKeyDown, true);

// 检查 2: 确认阻止事件传播
event.preventDefault();
event.stopPropagation();

// 检查 3: 确认 effectiveFeatures 非空
console.log('effectiveFeatures:', effectiveFeatures);
// 应该输出: ['tag', 'emoji', 'dateRange', ...]
```

### 2. Bullet 点位置不对

**现象**：Bullet 点偏上或偏下，未与文字居中对齐

**原因**：使用了 hardcoded 像素值或错误的 `transform`

**解决方案**：使用相对单位
```css
.slate-bullet-paragraph[data-level="0"]::before {
  font-size: 0.65em; /* ✅ 相对 */
  top: 0.5em; /* ✅ 相对 */
  /* ❌ 避免: font-size: 10px; top: 0; transform: translateY(0.3em); */
}
```

### 3. 按 Bullet 数字键无响应

**现象**：按数字键 7（Bullet）时无反应，但其他数字键正常

**原因**：Bullet 被错误当作 Picker 处理，而非直接执行的命令

**解决方案**：在 `useEffect` 中区分两类功能
```typescript
const textFormatCommands = ['bold', 'italic', 'underline', 'strikethrough', 'clearFormat', 'bullet'];

if (textFormatCommands.includes(feature)) {
  // 直接执行命令
  onTextFormat?.(textFeatureConfig[feature].command);
} else {
  // 打开 Picker
  setActivePicker(feature);
}
```

## 🎨 颜色预设

支持 7 种文字颜色（通过 `color` 属性配置）：

```javascript
const colors = [
  { name: '红色', value: '#ef4444' },
  { name: '橙色', value: '#f97316' },
  { name: '黄色', value: '#eab308' },
  { name: '绿色', value: '#22c55e' },
  { name: '蓝色', value: '#3b82f6' },
  { name: '紫色', value: '#a855f7' },
  { name: '灰色', value: '#6b7280' }
];
```

## 📝 应用场景

### 1. PlanManager 集成
- **Menu 模式**: 双击 Alt 快速添加标签、时间、优先级
- **Text 模式**: 选中文字格式化，创建 Bullet Point 列表
- 智能区分 Title/Description 模式

### 2. EventEditModal 集成
- **Menu 模式**: 快速设置事件元数据
- **Text 模式**: 格式化事件描述，添加富文本内容

### 3. 通用文本编辑器
- 任何需要富文本编辑的场景
- 支持自定义回调函数
- 灵活的配置选项

## ⚠️ 注意事项

### 性能优化
1. **防抖处理**：选区变化监听使用 100ms 防抖
2. **按需渲染**：工具栏仅在需要时渲染
3. **事件清理**：组件卸载时清理所有监听器

### 兼容性
- 支持现代浏览器（Chrome 90+, Firefox 88+, Safari 14+）
- 移动端需要特殊处理（触摸选区）

### 已知问题
1. 在某些 IME 输入法下可能出现定位偏移
2. 移动端长按选中后工具栏可能与系统菜单重叠
3. 嵌套格式（如粗体+斜体）的清除可能不完全

## 🔮 未来扩展

- [x] 支持文字背景色
- [x] Bullet Point 层级缩进功能 ✅ (2025-11-14)
- [ ] Bullet Point 展开/收缩动效
- [ ] Bullet Point 拖拽排序
- [ ] Bullet Point Checkbox 任务列表样式
- [ ] 自定义快捷键配置
- [ ] Markdown 快捷输入支持 (输入 `- ` 自动转 bullet)
- [ ] 多语言国际化

---

## 📋 Bullet Point 功能详解 (2025-11-14)

> **完整技术文档**: [SLATE_EDITOR_PRD.md - Bullet Point 章节](./SLATE_EDITOR_PRD.md#bullet-point-多级列表功能-2025-11-14)

### 功能概述

**Bullet Point** 是 FloatingToolbar 集成的核心富文本功能，支持最多 **5 级**缩进的层级列表。

**视觉效果**:
```
● Level 1 (bulletLevel: 0)
  ○ Level 2 (bulletLevel: 1)
    – Level 3 (bulletLevel: 2)
      □ Level 4 (bulletLevel: 3)
        ▸ Level 5 (bulletLevel: 4)
```

### 用户交互

#### 启用 Bullet
1. 选中文本
2. 点击 FloatingToolbar 的 **Bullet** 按钮
3. 段落自动转换为 Level 1 bullet (●)

#### 调整层级
- **Tab**: 增加层级 (bulletLevel + 1, 最大 4)
  - 同时增加 EventLine.level (缩进)
  - 符号自动切换 (● → ○ → – → □ → ▸)
- **Shift+Tab**: 减少层级 (bulletLevel - 1)
  - 同时减少 EventLine.level
  - Level 0 时按 Shift+Tab 移除 bullet

#### 多行支持
- 按 **Enter** 键创建新行
- 每行独立管理 bullet 属性
- 保存时自动累积所有行的 HTML 内容

### 技术架构

#### 数据结构
```typescript
// ParagraphNode 扩展
interface ParagraphNode {
  type: 'paragraph';
  bullet?: boolean;        // 是否启用 bullet
  bulletLevel?: number;    // 0-4 (对应 5 个层级)
  children: CustomText[];
}

// EventLineNode 扩展
interface EventLineNode {
  type: 'event-line';
  eventId: string;
  level: number;           // 控制缩进 (padding-left)
  children: ParagraphNode[];
}
```

**关键区别**:
- `EventLineNode.level`: 控制整行的 **缩进**（padding-left）
- `ParagraphNode.bulletLevel`: 控制段落的 **bullet 符号**（●○–□▸）

#### 持久化格式

**保存** (HTML data-* 属性):
```html
<!-- Event 的 eventlog 多行内容 -->
<p data-bullet="true" data-bullet-level="0" data-level="0">完成项目设计</p>
<p data-bullet="true" data-bullet-level="1" data-level="1">确认需求文档</p>
<p data-bullet="true" data-bullet-level="2" data-level="2">需求文档 v2.0</p>
```

**关键属性**:
- `data-bullet="true"`: 标记为 bullet paragraph
- `data-bullet-level="0-4"`: bullet 符号层级 (●○–□▸)
- `data-level="0-N"`: 缩进层级 (padding-left)

**🆕 v1.8.3 更新 (2025-11-14)**:
- 每个 `<p>` 标签都保存独立的 `data-level` 属性
- 读取时为每个段落创建独立的 `EventLineNode`
- 支持多行 eventlog 每行有不同的缩进层级

**读取** (解析 data-* 属性):
```typescript
function parseHtmlToParagraphsWithLevel(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const paragraphs = doc.querySelectorAll('p');
  
  return Array.from(paragraphs).map(p => ({
    paragraph: {
      type: 'paragraph',
      bullet: p.getAttribute('data-bullet') === 'true',
      bulletLevel: parseInt(p.getAttribute('data-bullet-level') || '0', 10),
      children: [{ text: p.textContent || '' }],
    },
    level: parseInt(p.getAttribute('data-level') || '0', 10),
  }));
}

// 为每个段落创建独立的 EventLineNode
paragraphsWithLevel.forEach((pwl, index) => {
  nodes.push({
    type: 'event-line',
    level: pwl.level,  // ✅ 每行独立的缩进
    children: [pwl.paragraph],
  });
});
```

#### CSS 渲染

**符号样式** (PlanSlateEditor.css):
```css
/* Level 1: ● */
.slate-bullet-paragraph[data-level="0"]::before {
  content: '●';
  font-size: 10px;
  left: 0;
}

/* Level 2: ○ */
.slate-bullet-paragraph[data-level="1"]::before {
  content: '○';
  font-size: 11px;
  left: 20px;
}

/* ... 其他层级 */
```

**关键设计**:
- 使用 `::before` 伪元素插入符号
- `data-level` 属性驱动符号选择
- `transform: translateY(-50%)` 垂直居中对齐
- eventlog 模式下 `line-height: 1.3` 保持紧凑

### FloatingToolbar 集成

#### 按钮实现

```typescript
// FloatingToolbar.tsx
<button
  onClick={() => toggleBulletPoint()}
  className="toolbar-button"
  title="Bullet Point"
>
  <List size={16} /> {/* lucide-react icon */}
</button>

const toggleBulletPoint = () => {
  const editor = unifiedEditorRef.current;
  if (!editor) return;
  
  const { selection } = editor;
  if (!selection) return;
  
  const [node] = Editor.node(editor, selection.anchor.path.slice(0, -1));
  const paragraph = node as ParagraphNode;
  const isBullet = paragraph.bullet === true;
  
  Editor.withoutNormalizing(editor, () => {
    Transforms.setNodes(
      editor,
      {
        bullet: !isBullet,
        bulletLevel: isBullet ? undefined : 0,
      },
      { at: selection.anchor.path.slice(0, -1) }
    );
  });
};
```

#### Tab 键处理

**文件**: `PlanSlateEditor.tsx` (L1295-1380)

```typescript
const handleKeyDown = (event: React.KeyboardEvent) => {
  if (event.key === 'Tab') {
    event.preventDefault();
    
    const { selection } = editor;
    if (!selection) return;
    
    const [node, path] = Editor.node(editor, selection.anchor.path.slice(0, -1));
    const paragraph = node as ParagraphNode;
    
    if (paragraph.bullet) {
      const currentLevel = paragraph.bulletLevel ?? 0;
      const shift = event.shiftKey;
      
      // 使用 Editor.withoutNormalizing 确保原子性更新
      Editor.withoutNormalizing(editor, () => {
        if (shift) {
          // Shift+Tab: 减少层级
          if (currentLevel > 0) {
            Transforms.setNodes(editor, { bulletLevel: currentLevel - 1 }, { at: path });
            // 同步 EventLine.level
            updateEventLineLevel(editor, path, -1);
          } else {
            // Level 0 时移除 bullet
            Transforms.setNodes(editor, { bullet: false, bulletLevel: undefined }, { at: path });
            updateEventLineLevel(editor, path, 0);
          }
        } else {
          // Tab: 增加层级
          if (currentLevel < 4) {
            Transforms.setNodes(editor, { bulletLevel: currentLevel + 1 }, { at: path });
            updateEventLineLevel(editor, path, 1);
          }
        }
      });
    }
  }
};
```

**关键设计**:
- 使用 `Editor.withoutNormalizing()` 包裹更新，确保 **原子性**
- 同时更新 `paragraph.bulletLevel` (符号) 和 `EventLine.level` (缩进)
- 避免单独更新导致符号变化但缩进消失

### 已知问题

1. **Title 模式冲突**: Title 行不应显示 bullet，但目前未限制
   - **临时方案**: 用户自行避免在 Title 行启用
   - **未来**: 检测 `isEventlogMode`，禁用 Title 行 bullet

2. **跨行选择删除**: 选择多行 bullet 删除时，属性可能残留
   - **临时方案**: 手动清除格式
   - **未来**: 实现 `normalizeNode` 自动清理

3. **复制粘贴格式**: 粘贴时 bullet 格式可能丢失
   - **临时方案**: 粘贴后手动重新设置
   - **未来**: 实现自定义 `insertData` 处理 HTML

4. ~~**多行缩进层级**~~: ✅ **已修复 (v1.8.3 - 2025-11-14)**
   - ✅ 每个 `<p>` 标签都保存 `data-level` 属性
   - ✅ 读取时为每个段落创建独立的 `EventLineNode`
   - ✅ 支持多行 eventlog 每行独立缩进

### 测试用例

#### 手动测试步骤
1. 创建新 Event，进入 eventlog 模式
2. 输入文本，选中后点击 Text FloatingBar 的 Bullet 按钮
3. 按 Tab 键增加层级（观察符号变化 ● → ○ → – → □ → ▸）
4. 按 Shift+Tab 键减少层级
5. 创建多行 bullet（按 Enter 键）
6. **为不同行设置不同的缩进层级**
   - 第 1 行：Level 1 (●)
   - 第 2 行：Tab → Level 2 (○)
   - 第 3 行：Tab → Level 3 (–)
7. **测试删除后自动调整**
   - 删除第 1 行 (Level 1)
   - 确认第 2 行自动降级为 Level 1 (● 符号)
   - 确认第 3 行自动降级为 Level 2 (○ 符号)
8. 保存并刷新页面，检查：
   - ✅ 每行的 bullet 符号正确恢复
   - ✅ 每行的缩进层级独立保持
9. 测试单行独立调整：
   - 选中第 2 行，Shift+Tab 减少缩进
   - 确认只有第 2 行改变，其他行不受影响

### 性能优化

- ✅ 使用 CSS 伪元素渲染符号（避免额外 DOM 节点）
- ✅ `data-level` 属性驱动样式（避免内联样式计算）
- ✅ 使用 `Array.map().join('')` 一次性生成 HTML
- ✅ 缓存 `DOMParser` 实例

### 未来扩展

- [ ] **折叠/展开**: 点击父级 bullet 折叠/展开子项
- [ ] **拖拽排序**: 拖动 bullet 项调整顺序
- [ ] **Checkbox Bullet**: 支持任务列表样式 `☐`/`☑`
- [ ] **自定义符号**: 允许用户自定义 5 个层级的符号
- [ ] **Markdown 快捷输入**: 输入 `- ` 自动转换为 bullet

---

# Part 2: FloatingButton 浮动操作按钮

## 📖 组件概述

`FloatingButton` 是基于 Tippy.js 和 Headless UI 构建的浮动操作按钮，适用于 Plan、Log 等页面的快速操作入口。

## 🛠️ 技术栈

- **Tippy.js (@tippyjs/react)**: Tooltip 提示
- **Headless UI (@headlessui/react)**: 可访问的下拉菜单
- **React 19**: 组件框架
- **TypeScript**: 类型安全

## ✨ 组件特性

### 核心功能
- ✅ 可配置的主按钮（图标/文本）
- ✅ 多个子操作按钮
- ✅ 4 个位置选项（四个角落）
- ✅ 4 个展开方向（上/下/左/右）
- ✅ Tooltip 提示支持
- ✅ 自定义颜色
- ✅ 禁用状态
- ✅ 响应式设计
- ✅ 深色模式适配
- ✅ 无障碍访问支持

### 组件 API

```typescript
interface FloatingButtonProps {
  // 主按钮的图标（React 节点）
  icon?: React.ReactNode;
  
  // 主按钮的文本（如果没有图标）
  label?: string;
  
  // 子操作列表
  actions: FloatingButtonAction[];
  
  // 主按钮的位置
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  
  // 主按钮的颜色
  color?: string;
  
  // 是否禁用
  disabled?: boolean;
  
  // 展开方向
  direction?: 'up' | 'down' | 'left' | 'right';
  
  // 主按钮点击回调
  onClick?: () => void;
  
  // 主按钮的 Tooltip 文本
  tooltip?: string;
}

interface FloatingButtonAction {
  // 操作的唯一标识
  id: string;
  
  // 显示的图标
  icon: React.ReactNode;
  
  // Tooltip 文本
  tooltip: string;
  
  // 点击回调
  onClick: () => void;
  
  // 是否禁用
  disabled?: boolean;
  
  // 自定义颜色
  color?: string;
}
```

## 🚀 使用示例

### 基础用法

```tsx
import { Plus, FileText, Calendar, Tag } from 'lucide-react';
import FloatingButton from '@/components/FloatingButton';

function MyPage() {
  const actions = [
    {
      id: 'new-note',
      icon: <FileText size={20} />,
      tooltip: '新建笔记',
      onClick: () => handleCreateNote(),
    },
    {
      id: 'new-event',
      icon: <Calendar size={20} />,
      tooltip: '新建事件',
      onClick: () => handleCreateEvent(),
    },
    {
      id: 'new-tag',
      icon: <Tag size={20} />,
      tooltip: '新建标签',
      onClick: () => handleCreateTag(),
    },
  ];

  return (
    <div>
      {/* 你的页面内容 */}
      <FloatingButton
        icon={<Plus size={24} />}
        actions={actions}
        position="bottom-right"
        tooltip="快速创建"
      />
    </div>
  );
}
```

### Plan 页面集成

```tsx
<FloatingButton
  icon={<Plus size={24} />}
  actions={[
    {
      id: 'add-plan',
      icon: <ListPlus size={20} />,
      tooltip: '添加计划',
      onClick: () => handleAddPlan(),
    },
    {
      id: 'add-task',
      icon: <CheckSquare size={20} />,
      tooltip: '添加任务',
      onClick: () => handleAddTask(),
    },
  ]}
  position="bottom-right"
  direction="up"
  color="#3b82f6"
  tooltip="添加新项目"
/>
```

### Log 页面集成

```tsx
<FloatingButton
  icon={<PenLine size={24} />}
  actions={[
    {
      id: 'quick-note',
      icon: <Zap size={20} />,
      tooltip: '快速记录',
      onClick: () => handleQuickNote(),
    },
    {
      id: 'voice-note',
      icon: <Mic size={20} />,
      tooltip: '语音输入',
      onClick: () => handleVoiceNote(),
    },
  ]}
  position="bottom-left"
  direction="up"
  color="#10b981"
/>
```

## 🎨 位置和方向配置

### 位置选项
- `bottom-right` - 右下角（默认）
- `bottom-left` - 左下角
- `top-right` - 右上角
- `top-left` - 左上角

### 展开方向
- `up` - 向上展开（推荐用于底部按钮）
- `down` - 向下展开（推荐用于顶部按钮）
- `left` - 向左展开
- `right` - 向右展开

## 🎨 样式自定义

```tsx
// 自定义主按钮颜色
<FloatingButton
  color="#ef4444"  // 红色
  {...otherProps}
/>

// 自定义单个操作按钮颜色
const actions = [
  {
    id: 'urgent',
    icon: <AlertCircle />,
    tooltip: '紧急任务',
    onClick: handleUrgent,
    color: '#dc2626'  // 深红色
  }
];
```

## 📦 协作开发方案

### 推荐流程
1. **先在一个页面试用** - 选择一个代表性页面集成
2. **根据实际效果调整参数** - 测试位置、方向、颜色
3. **复制到其他页面并调整** - 根据不同页面需求微调

### 分工建议
- **UI 开发者**：负责样式、动画、响应式
- **功能开发者**：负责集成到具体页面，实现回调逻辑
- **测试人员**：测试各种交互场景、无障碍访问

## 🎯 图标选择建议

推荐使用 `lucide-react` 图标库：

```bash
npm install lucide-react
```

常用图标：
- **Plus** - 通用添加
- **PenLine** - 快速记录
- **Calendar** - 日历事件
- **CheckSquare** - 任务
- **FileText** - 笔记
- **Tag** - 标签
- **Star** - 收藏/重要
- **Upload** - 上传/导入

## ⚡ 性能优化建议

1. **避免频繁重新渲染**
   ```tsx
   const actions = useMemo(() => [
     { id: 'action1', ... },
     { id: 'action2', ... }
   ], [dependencies]);
   ```

2. **回调函数使用 useCallback**
   ```tsx
   const handleAction = useCallback(() => {
     // 处理逻辑
   }, [dependencies]);
   ```

3. **条件渲染**
   ```tsx
   {showFloatingButton && <FloatingButton {...props} />}
   ```

## ♿ 可访问性说明

- 支持键盘导航（Tab/Enter/Esc）
- 使用 ARIA 属性（role, aria-label, aria-expanded）
- 提供 Tooltip 文本说明
- 符合 WCAG 2.1 AA 标准

## 🌐 浏览器兼容性

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🐛 故障排除

### 问题：Tooltip 不显示
**解决方案**：确保安装了 `@tippyjs/react` 和 `tippy.js`

```bash
npm install @tippyjs/react tippy.js
```

### 问题：按钮位置不正确
**解决方案**：检查父容器是否设置了 `position: relative`

### 问题：点击事件不响应
**解决方案**：确保 `onClick` 回调正确绑定，检查是否被其他元素遮挡

### 问题：深色模式下颜色不协调
**解决方案**：使用 Tailwind 的 `dark:` 前缀或根据主题动态设置颜色

## 📚 相关文件

- 组件文件：`src/components/FloatingButton.tsx`
- 类型定义：`src/types/FloatingButton.ts`
- 样式文件：`src/styles/FloatingButton.module.css`

---

## 📄 总结

ReMarkable 的浮动组件体系提供了两套互补的 UI 方案：

- **FloatingToolbar** - 适用于文本编辑场景，智能关联元数据
  - 支持 Bullet Point 多级列表 (5 级缩进，●○–□▸)
  - Tab/Shift+Tab 快捷键调整层级
  - 持久化保存 (HTML data-* 属性)
- **FloatingButton** - 适用于快速操作入口，固定位置悬浮

两者结合使用，可以为用户提供高效、流畅的交互体验。

---

## 🔗 相关文档

- [Slate Editor PRD](./SLATE_EDITOR_PRD.md) - Slate 编辑器完整文档
- [Slate Editor PRD - Bullet Point 章节](./SLATE_EDITOR_PRD.md#bullet-point-多级列表功能-2025-11-14) - Bullet Point 技术详解
- [PlanManager PRD](./PLANMANAGER_MODULE_PRD.md) - PlanManager 模块文档
- [Time Architecture](../TIME_ARCHITECTURE.md) - 时间架构文档

---

**最后更新**: 2025-11-14  
**维护者**: 4DNote Team

## 🆕 PlanSlateEditor 集成 (2025-11-06)

### 架构变更

**之前**: 使用 `editorRegistryRef` 管理多个 Tiptap editor 实例
```typescript
// ❌ 旧架构
const editorRegistryRef = useRef<Map<string, TiptapEditor>>(new Map());

onTagSelect={(tagId) => {
  const editor = editorRegistryRef.current.get(currentFocusedLineId);
  editor.chain().focus().insertContent({ ... }).run();
}}
```

**现在**: 使用单个 Slate editor 实例 + helper 函数
```typescript
// ✅ 新架构
import { insertTag, insertEmoji, insertDateMention } from '@/components/PlanSlateEditor/helpers';

const unifiedEditorRef = useRef<Editor>(null);

<PlanSlateEditor
  onEditorReady={(editor) => {
    unifiedEditorRef.current = editor;
  }}
/>

onTagSelect={(tagIds) => {
  const editor = unifiedEditorRef.current;
  const tag = TagService.getTagById(tagIds[0]);
  insertTag(editor, tag.id, tag.name, tag.color, tag.emoji);
  // ✅ PlanSlateEditor 的 onChange 会自动保存
}}
```

### 新增 Helper 函数

```typescript
// src/components/PlanSlateEditor/helpers.ts

/**
 * 插入 Tag 元素
 */
export function insertTag(
  editor: Editor,
  tagId: string,
  tagName: string,
  tagColor?: string,
  tagEmoji?: string,
  mentionOnly?: boolean  // Description 模式使用
): boolean

/**
 * 插入 Emoji
 */
export function insertEmoji(
  editor: Editor,
  emoji: string
): boolean

/**
 * 插入 DateMention 元素
 */
export function insertDateMention(
  editor: Editor,
  startDate: string,
  endDate?: string,
  mentionOnly?: boolean
): boolean
```

### 文本格式化更新

```typescript
// Slate API (替代 Tiptap chain API)
const handleTextFormat = useCallback((command: string) => {
  const editor = unifiedEditorRef.current;
  if (!editor) return;
  
  const { Editor } = require('slate');
  const { ReactEditor } = require('slate-react');
  
  ReactEditor.focus(editor);
  
  switch (command) {
    case 'bold':
      Editor.addMark(editor, 'bold', true);
      break;
    case 'italic':
      Editor.addMark(editor, 'italic', true);
      break;
    case 'underline':
      Editor.addMark(editor, 'underline', true);
      break;
    case 'strikethrough':
      Editor.addMark(editor, 'strikethrough', true);
      break;
    case 'removeFormat':
      Editor.removeMark(editor, 'bold');
      Editor.removeMark(editor, 'italic');
      Editor.removeMark(editor, 'underline');
      Editor.removeMark(editor, 'strikethrough');
      break;
  }
}, []);
```

### onTimeApplied 简化

**之前**: 需要手动获取 editor HTML 并保存
```typescript
// ❌ 旧代码
const editor = editorRegistryRef.current.get(targetId);
const updatedHTML = editor.getHTML();
const updatedItem = { ...item, content: updatedHTML };
onSave(updatedItem);
```

**现在**: PlanSlateEditor 自动保存，只需同步 EventService
```typescript
// ✅ 新代码
onTimeApplied={(startIso, endIso) => {
  // TimeHub 已更新时间
  // PlanSlateEditor 的 onChange 会自动保存内容
  
  // 只需同步 EventService
  if (item.id) {
    await EventService.updateEvent(item.id, {
      title: item.title,
      description: item.description,
      tags: item.tags,
    });
  }
}}
```

### 关键优势

1. **简化代码**: 不再需要维护 `editorRegistryRef` Map
2. **性能提升**: 单实例架构，减少内存占用
3. **自动保存**: onChange 自动处理，无需手动调用 `editor.getHTML()`
4. **类型安全**: helper 函数提供明确的类型定义
5. **可维护性**: 集中管理插入逻辑，易于测试和调试

---

## 🐛 重要 Bug 修复记录

### 2025-11-19: textStyle 子菜单状态管理修复

**问题描述**:
1. 按数字键 5 打开 textStyle 菜单后，菜单立即关闭，只留下定位小三角
2. 点击 textStyle 菜单内的 textColor/bgColor 按钮后，颜色选择器无法打开，整个 FloatingBar 消失

**根本原因**:
1. **activePickerIndex useEffect 的依赖数组包含 activePicker**：当 activePicker 变化时，useEffect 重新执行，调用 `onActivePickerIndexConsumed()` 触发父组件重新渲染，导致状态混乱
2. **Tippy visible 条件不完整**：textStyle 的 Tippy 使用 `visible={activePicker === feature}`，当 activePicker 变为 'textColor' 时，textStyle 菜单被隐藏，导致 textColor 按钮被卸载
3. **内容渲染条件不匹配**：textStyle 菜单内容使用 `{activePicker === feature && ...}` 条件，当 activePicker 变为 'textColor' 时内容消失

**解决方案**:

**1. 在 activePickerIndex useEffect 开头添加守卫**：
```typescript
useEffect(() => {
  // 守卫：如果 activePickerIndex 为 null，说明没有数字键按下，直接返回
  if (activePickerIndex === null || activePickerIndex === undefined) {
    return;
  }
  // ... 原有逻辑
}, [activePickerIndex, effectiveFeatures, mode, activePicker, ...]);
```

**2. 修复 textStyle Tippy 的 visible 条件**（第 599-602 行）：
```typescript
visible={
  activePicker === feature || 
  (feature === 'textStyle' && (activePicker === 'textColor' || activePicker === 'bgColor'))
}
```
确保当 activePicker 是 textColor/bgColor 时，**只有 textStyle 的 Tippy** 保持显示，其他按钮（tag, emoji 等）不受影响。

**3. 修复 textStyle 菜单内容渲染条件**（第 586 行）：
```typescript
{(activePicker === 'textStyle' || activePicker === 'textColor' || activePicker === 'bgColor') && feature === 'textStyle' && (
  <div className="text-style-menu">
    {/* textColor/bgColor 按钮在这里 */}
  </div>
)}
```
确保当打开颜色选择器时，textStyle 菜单内容（包括按钮）仍然渲染，避免按钮被卸载。

**4. 移除不必要的 setTimeout 延时**：
- 之前使用 `setTimeout(() => setActivePickerIndex(null), 100)` 尝试延时重置状态
- 改为使用回调模式：`onActivePickerIndexConsumed={() => setActivePickerIndex(null)}`
- 确保状态重置在正确的时机执行，避免 race condition

**修复后的完整流程**:
1. 用户按 5 或点击 textStyle 按钮 → `setActivePicker('textStyle')`
2. textStyle Tippy 显示（`visible = true`），内容渲染（包括 6 个子按钮）
3. 用户点击 textColor 按钮 → `setActivePicker('textColor')`
4. textStyle Tippy **保持显示**（`visible = true`，因为新增的条件满足）
5. textStyle 菜单内容**保持渲染**（条件改为检查 activePicker 是否为 textStyle/textColor/bgColor）
6. textColor 的 Tippy 显示颜色选择器（`visible = activePicker === 'textColor'`）
7. 用户可以正常选择颜色并应用

**技术要点**:
- **嵌套菜单的状态管理**：父菜单在打开子菜单时需要保持显示和内容渲染
- **React 状态更新的批处理**：注意 useEffect 的依赖数组，避免不必要的重新执行
- **Tippy.js 的 visible 控制**：使用受控模式时，需要精确控制每个 Tippy 的显示条件
- **条件渲染的一致性**：Tippy 的 visible 和内容的渲染条件必须匹配，否则会出现"空 Tippy"（只有小三角没有内容）

**影响范围**:
- ✅ 修复了 textStyle 菜单键盘快捷键（数字 5）无法打开的问题
- ✅ 修复了 textColor/bgColor 颜色选择器无法打开的问题
- ✅ 确保其他按钮（tag, emoji 等）不受影响，不会出现误显示的小三角
- ✅ 提升了整体的用户体验和交互流畅度

---

### 2025-11-19: 颜色选择器键盘交互修复

**问题描述**:
打开颜色选择器（textColor/bgColor）后，按数字键 1-9 无法选择颜色，窗口停滞不动。

**根本原因**:
`useFloatingToolbar` hook 在 FloatingBar 打开时会拦截所有数字键 1-9，用于主菜单项选择。当颜色选择器打开后，数字键仍然被 hook 拦截，导致颜色选择器内部的键盘监听器无法接收到按键事件。

**解决方案**:

**1. 添加 `isSubPickerOpen` 参数到 useFloatingToolbar**：
```typescript
// useFloatingToolbar.ts
export interface UseFloatingToolbarOptions {
  // ... 其他参数
  /** 子选择器是否打开（textColor/bgColor picker），打开时不拦截数字键 */
  isSubPickerOpen?: boolean;
}
```

**2. 修改数字键拦截逻辑**：
```typescript
// 🔑 关键：如果子选择器（颜色选择器）已打开，不拦截数字键，让子选择器自己处理
if (!isSubPickerOpen && (toolbarActive || mode === 'menu_floatingbar' || mode === 'text_floatingbar') && /^[1-9]$/.test(event.key)) {
  // ... 主菜单数字键处理逻辑
}
```

**3. 在 HeadlessFloatingToolbar 中监听 activePicker 变化**：
```typescript
// 监听 activePicker 变化，通知父组件子选择器状态
useEffect(() => {
  const isSubPickerOpen = activePicker === 'textColor' || activePicker === 'bgColor';
  onSubPickerStateChange?.(isSubPickerOpen);
}, [activePicker, onSubPickerStateChange]);
```

**4. 在 PlanManager 中管理状态并传递**：
```typescript
const [isSubPickerOpen, setIsSubPickerOpen] = useState<boolean>(false);

const floatingToolbar = useFloatingToolbar({
  // ... 其他配置
  isSubPickerOpen, // 🔑 传递子选择器状态
});

<HeadlessFloatingToolbar
  // ... 其他 props
  onSubPickerStateChange={(isOpen) => setIsSubPickerOpen(isOpen)}
/>
```

**完整的键盘交互流程**:
1. 用户选中文字，按数字键 4 打开 bgColor 选择器
2. bgColor 选择器打开，`activePicker` 变为 'bgColor'
3. HeadlessFloatingToolbar 通知 PlanManager：`onSubPickerStateChange(true)`
4. PlanManager 更新 `isSubPickerOpen = true`
5. `useFloatingToolbar` hook 检测到 `isSubPickerOpen = true`，**不再拦截数字键**
6. 用户按数字键 1-9，事件直接传递到 BackgroundColorPicker 内部的键盘监听器
7. BackgroundColorPicker 接收按键，调用 `onSelect(BG_COLORS[index].value)` 应用颜色
8. 颜色选择器关闭，`activePicker` 变为 null，`isSubPickerOpen` 重置为 false

**技术要点**:
- **状态提升**: 将子选择器的打开状态提升到 PlanManager 层级管理
- **条件拦截**: 根据 `isSubPickerOpen` 状态决定是否拦截数字键
- **回调传递**: 使用 `onSubPickerStateChange` 回调实现跨组件状态同步
- **事件优先级**: 子选择器打开时，数字键事件优先传递给子组件处理

**附加修复：移除颜色预览功能**:

发现颜色选择器的 `onMouseEnter` 预览功能存在 bug：鼠标悬停时应用的临时颜色在移开后不会被清除，导致颜色叠加覆盖文字。为避免复杂的状态管理，**临时移除了预览功能**，只在用户明确选择（点击或按数字键）时才应用颜色。

```typescript
// 移除前（有 bug）:
onMouseEnter={() => { onPreview?.(color.value); }}

// 移除后：
// 不再有 onMouseEnter/onMouseLeave，只在 onChange/onSelect 时应用颜色
```

**影响范围**:
- ✅ 修复了颜色选择器键盘数字键 1-9 无法响应的问题
- ✅ textColor 和 bgColor 选择器都支持数字键快速选择
- ✅ 移除了预览功能，避免颜色叠加 bug（未来可能需要重新实现预览，需要保存/恢复原始颜色状态）
- ✅ 保持了主菜单和子菜单的键盘交互独立性

---

## 🔗 相关文档

- [PlanManager 模块 PRD](./PRD/PLANMANAGER_MODULE_PRD.md)
- [Slate 开发指南](./SLATE_DEVELOPMENT_GUIDE.md)
- [组件开发指南](./component-development-guide.md)
