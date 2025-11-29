# ReMarkable 浮动组件开发指南

**最后更新**: 2025-11-06

## 📖 概述

ReMarkable 提供两套浮动 UI 组件，用于增强文本编辑和快速操作体验：

1. **FloatingToolbar** - 文本选中工具栏（类似 Notion/Tiptap）
2. **FloatingButton** - 浮动操作按钮（固定位置的快捷入口）

**✅ 重要更新 (2025-11-06)**: FloatingBar 已与 PlanSlate 完成集成，使用全新的 helper 函数架构。

---

# Part 1: FloatingToolbar 文本选中工具栏

## ✨ 功能特性

### 触发方式
- **鼠标选中文本**：自动弹出工具栏
- **快捷键 `Alt + 1-5`**：切换工具栏显示/隐藏（仅在编辑器内激活时有效）
  - `Alt+1`：标签功能
  - `Alt+2`：表情功能
  - `Alt+3`：日期功能
  - `Alt+4`：优先级功能
  - `Alt+5`：颜色功能
- **点击外部区域**：自动隐藏

### 支持的 ReMarkable 组件
- **插入标签** 🏷️ - 使用独立的 `TagPicker` 组件
- **插入 Emoji** 😀 - 使用 `EmojiPicker` 组件
- **插入 @ 引用** 🔗 - 搜索并引用 Event 或联系人（联系人功能待开发）
- **插入时间** ⏰ - 呼出 `TimePicker`，支持：
  - 起始/结束时间
  - 单独输入其中之一
  - 全天事件 (allDay)
  - Milestone 标记
  - 选择同步日历

### 支持的文本格式
- ✅ **粗体** (Ctrl+B)
- ✅ **斜体** (Ctrl+I)
- ✅ **删除线**
- ✅ **下划线** (Ctrl+U)
- ✅ **文字颜色**（7种预设颜色）
- ✅ **清除格式**
- 📋 **待添加**：
  - 文字背景色
  - Bullet Point（支持无限层级缩进，至少5种样式，可展开/收缩，快捷键支持）

## 🎨 设计特点

- 深色半透明背景 + 毛玻璃效果
- 浮动在选区上方，水平居中
- 平滑的淡入/淡出动画
- 响应式适配（移动端优化）
- 自动支持深色/浅色主题

## 🚀 基础集成

### 在组件中使用

```tsx
import FloatingToolbar from '@/components/FloatingToolbar';

function MyEditor() {
  const editorRef = useRef<HTMLDivElement>(null);

  return (
    <div>
      <div ref={editorRef} contentEditable>
        可编辑内容...
      </div>
      <FloatingToolbar editorRef={editorRef} />
    </div>
  );
}
```

### 完整配置示例（PlanManager）

```tsx
<FloatingToolbar
  editorRef={editorRef}
  onTagSelect={(tagName) => {
    const content = addTagToLine(tagName, focusedLineId);
    updateEventContent(focusedLineId, content);
  }}
  onEmojiSelect={(emoji) => {
    const content = addEmojiToLine(emoji, focusedLineId);
    updateEventContent(focusedLineId, content);
  }}
  onTimeSelect={(timeData) => {
    updateEventTime(focusedLineId, timeData);
  }}
/>
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

| 快捷键 | 功能 | 适用场景 |
|--------|------|----------|
| `Ctrl+B` | 粗体 | 文本编辑 |
| `Ctrl+I` | 斜体 | 文本编辑 |
| `Ctrl+U` | 下划线 | 文本编辑 |
| `Ctrl+K` | 插入链接 | 文本编辑 |
| `Alt+1` | 标签功能 | 编辑器激活 |
| `Alt+2` | 表情功能 | 编辑器激活 |
| `Alt+3` | 日期功能 | 编辑器激活 |
| `Alt+4` | 优先级功能 | 编辑器激活 |
| `Alt+5` | 颜色功能 | 编辑器激活 |

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
- 编辑计划项标题和描述
- 添加标签、emoji、时间
- 智能区分 Title/Description 模式

### 2. EventEditModal 集成
- 快速格式化事件描述
- 添加富文本内容
- 插入标签和时间信息

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

- [ ] 支持文字背景色
- [ ] Bullet Point 层级缩进功能
- [ ] 展开/收缩动效
- [ ] 自定义快捷键配置
- [ ] Markdown 快捷输入支持
- [ ] 多语言国际化

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
- **FloatingButton** - 适用于快速操作入口，固定位置悬浮

两者结合使用，可以为用户提供高效、流畅的交互体验。

---

## 🆕 PlanSlate 集成 (2025-11-06)

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
import { insertTag, insertEmoji, insertDateMention } from '@/components/PlanSlate/helpers';

const unifiedEditorRef = useRef<Editor>(null);

<PlanSlate
  onEditorReady={(editor) => {
    unifiedEditorRef.current = editor;
  }}
/>

onTagSelect={(tagIds) => {
  const editor = unifiedEditorRef.current;
  const tag = TagService.getTagById(tagIds[0]);
  insertTag(editor, tag.id, tag.name, tag.color, tag.emoji);
  // ✅ PlanSlate 的 onChange 会自动保存
}}
```

### 新增 Helper 函数

```typescript
// src/components/PlanSlate/helpers.ts

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

**现在**: PlanSlate 自动保存，只需同步 EventService
```typescript
// ✅ 新代码
onTimeApplied={(startIso, endIso) => {
  // TimeHub 已更新时间
  // PlanSlate 的 onChange 会自动保存内容
  
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

## 🔗 相关文档

- [PlanManager 模块 PRD](./PRD/PLANMANAGER_MODULE_PRD.md)
- [Slate 开发指南](./SLATE_DEVELOPMENT_GUIDE.md)
- [组件开发指南](./component-development-guide.md)
