# PlanSlate - 使用指南

## 概述

**PlanSlate** 是一个基于 Slate.js 的单实例富文本编辑器，专为 ReMarkable 应用的 Plan 页面设计。

### 核心特性

✅ **跨行文字选择** - 支持鼠标拖动选择多行文字  
✅ **富文本复制粘贴** - 保留缩进、格式，与外部应用（Word/Email/Notion）互通  
✅ **智能缩进管理** - Tab/Shift+Tab 控制层级，自动限制最大缩进  
✅ **Description 模式** - Shift+Enter 切换标题/描述双模式  
✅ **Tag/DateMention 支持** - 内联元素，支持复制粘贴  
✅ **IME 友好** - 完整支持中文/日文输入法  

---

## 快速开始

### 1. 基础使用

```typescript
import { PlanSlate } from './components/PlanSlate';

function MyComponent() {
  const [items, setItems] = useState<PlanItem[]>([]);
  
  return (
    <PlanSlate
      items={items}
      onChange={(updatedItems) => setItems(updatedItems)}
      placeholder="开始输入..."
    />
  );
}
```

### 2. 带装饰的使用

```typescript
<PlanSlate
  items={items}
  onChange={handleChange}
  renderLinePrefix={(line) => (
    <input 
      type="checkbox" 
      checked={line.eventId && items.find(i => i.id === line.lineId)?.isCompleted}
    />
  )}
  renderLineSuffix={(line) => (
    <TimeDisplay eventId={line.eventId} />
  )}
/>
```

---

## 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| **Enter** | 创建新的 EventLine（同级） |
| **Shift+Enter** | 切换 Description 模式 |
| **Tab** | 增加缩进（最多比上一行多 1 级） |
| **Shift+Tab** | 减少缩进 |
| **Delete/Backspace** | 在空行首删除当前行 |
| **Ctrl/Cmd+B** | 粗体 |
| **Ctrl/Cmd+I** | 斜体 |
| **Ctrl/Cmd+U** | 下划线 |

---

## 数据结构

### PlanItem（输入/输出）

```typescript
interface PlanItem {
  id: string;              // 行ID
  eventId?: string;        // 关联的 Event ID
  level: number;           // 缩进层级 (0, 1, 2, ...)
  title: string;           // 纯文本标题
  content: string;         // HTML 内容
  description?: string;    // HTML 描述（可选）
  tags: string[];          // 标签名称数组
}
```

### EventLineNode（内部）

```typescript
interface EventLineNode {
  type: 'event-line';
  eventId?: string;
  lineId: string;
  level: number;
  mode: 'title' | 'description';
  children: ParagraphNode[];
}
```

---

## 复制粘贴功能

### 从 ReMarkable 复制

**复制内容示例：**
```html
<ul>
  <li><strong>项目计划</strong></li>
  <li style="padding-left: 24px;">
    <span style="background: #e5e7eb;">📅 01-15 - 01-20</span> 设计阶段
  </li>
  <li style="padding-left: 24px;">开发阶段</li>
</ul>
```

**粘贴到 Word/Notion：**
- ✅ 保留层级缩进（转为嵌套列表）
- ✅ 保留文字格式（粗体、斜体等）
- ✅ Tag 转为可读文本（如 `#工作`）
- ✅ 日期转为可读文本（如 `📅 01-15`）

### 粘贴到 ReMarkable

**从 Word 复制：**
```html
<ul>
  <li>任务 A</li>
  <li style="margin-left: 20px;">子任务 1 <strong>2024-01-15</strong></li>
  <li style="margin-left: 20px;">子任务 2</li>
</ul>
```

**自动解析为：**
- ✅ 识别缩进结构，自动创建多层级 Event
- ✅ 保留格式（粗体、斜体）
- ✅ 智能识别日期（`2024-01-15` → DateMention 元素）
- ✅ 每个 `<li>` 创建一个 PlanItem

---

## 插入 Tag/Emoji/DateMention

### 使用辅助函数

```typescript
import { insertTag, insertEmoji, insertDateMention } from './components/PlanSlate/helpers';

// 插入 Tag
const success = insertTag(
  editor, 
  'tag-123', 
  '工作', 
  '#3b82f6',  // 颜色
  '💼'        // Emoji
);

// 插入 Emoji
insertEmoji(editor, '😊');

// 插入 DateMention
insertDateMention(
  editor,
  '2024-01-15T00:00:00Z',  // 开始
  '2024-01-20T00:00:00Z'   // 结束（可选）
);
```

---

## 与 PlanManager 集成

### 完整示例

```typescript
// 在 PlanManager 中替换 SlateFreeFormEditor
import { PlanSlate } from './PlanSlate';
import { insertTag, insertEmoji, insertDateMention } from './PlanSlate/helpers';

function PlanManager({ items, onSave }: PlanManagerProps) {
  const editorRef = useRef<Editor | null>(null);
  
  const handleEditorReady = (editor: Editor) => {
    editorRef.current = editor;
  };
  
  const handleTagInsert = (tagId: string, tagName: string) => {
    if (editorRef.current) {
      const tag = TagService.getTagById(tagId);
      insertTag(
        editorRef.current,
        tagId,
        tagName,
        tag?.color,
        tag?.emoji
      );
    }
  };
  
  return (
    <>
      <PlanSlate
        items={items}
        onChange={onSave}
        onEditorReady={handleEditorReady}
        renderLinePrefix={(line) => (
          // Checkbox 等装饰
        )}
        renderLineSuffix={(line) => (
          // 时间显示等装饰
        )}
      />
      
      <FloatingBar
        onTagSelect={handleTagInsert}
        onEmojiSelect={(emoji) => insertEmoji(editorRef.current!, emoji)}
        onDateSelect={(start, end) => insertDateMention(editorRef.current!, start, end)}
      />
    </>
  );
}
```

---

## 注意事项

### 1. 类型安全

由于 Slate 的类型系统复杂，部分类型使用了 `as unknown as` 转换。这是**已知的临时方案**，不影响运行时行为。

### 2. 性能优化

- 大量数据时（>100 行），考虑虚拟滚动
- 避免频繁的 `onChange` 回调，使用 debounce

### 3. IME 支持

编辑器已完整支持 IME，但需注意：
- 组字期间不会触发 `onChange`
- 组字完成后才会保存内容

---

## 迁移指南

### 从 SlateFreeFormEditor 迁移

**旧代码：**
```typescript
<SlateFreeFormEditor
  lines={lines}
  onLinesChange={setLines}
  onEditorReady={(lineId, editor) => {
    editorRegistry.set(lineId, editor);
  }}
/>
```

**新代码：**
```typescript
<PlanSlate
  items={items}  // PlanItem[] 而不是 FreeFormLine[]
  onChange={setItems}
  onEditorReady={(editor) => {
    // 只有一个编辑器实例
    singleEditorRef.current = editor;
  }}
/>
```

**关键变化：**
1. ❌ 不再有多个编辑器实例（每行一个）
2. ✅ 只有一个编辑器实例（整个文档）
3. ❌ 不再需要 `editorRegistry`
4. ✅ 使用 `singleEditorRef` 即可

---

## 故障排除

### Q: 无法跨行选择文字？
**A:** 确保使用的是 `PlanSlate` 而不是旧的 `SlateFreeFormEditor`。

### Q: 复制时格式丢失？
**A:** 检查 `handleCopy` 是否正确设置了 `text/html` 数据。

### Q: 粘贴外部内容后层级错乱？
**A:** `parseExternalHtml` 会尝试解析 `<ul><li>` 结构，确保外部 HTML 有正确的嵌套。

### Q: Tag/DateMention 无法插入？
**A:** 确保传入了正确的 `editor` 引用，并且编辑器已完成初始化。

---

## 完整示例

见 `src/components/PlanSlate/PlanSlate.tsx` 的实现。

---

## 后续计划

- [ ] 虚拟滚动支持（大数据性能优化）
- [ ] Markdown 快捷输入（如 `# ` 转标题）
- [ ] 拖拽排序支持
- [ ] 协作编辑支持
