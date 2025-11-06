# Slate.js 编辑器开发指南

> **状态**: ✅ 生产环境使用中  
> **最后更新**: 2025-11-06  
> **框架版本**: Slate.js 0.118+  
> **重要更新**: PlanManager 已成功迁移到 UnifiedSlateEditor

---

## 📋 目录

1. [项目概述](#项目概述)
2. [当前架构](#当前架构)
3. [核心组件](#核心组件)
4. [使用指南](#使用指南)
5. [开发规范](#开发规范)
6. [待完成功能](#待完成功能)

---

## 项目概述

### 迁移背景

ReMarkable 项目正在从 Tiptap 编辑器迁移到 Slate.js，原因：
- **更灵活的架构**：Slate.js 提供更底层的控制
- **更好的跨行选择**：支持多行文字选择和操作
- **更简单的数据结构**：纯 JSON，无需 ProseMirror Schema
- **移动端优化**：集成 slate-android-plugin 解决输入法问题

### 技术栈

```json
{
  "slate": "^0.118.1",
  "slate-react": "^0.118.2",
  "slate-dom": "^0.118.1",
  "slate-history": "^0.113.1",
  "slate-android-plugin": "^0.118.1"
}
```

### 安装命令

```bash
npm install slate slate-react slate-history --legacy-peer-deps
npm install --save-dev @types/slate @types/slate-react
npm install slate-android-plugin --save --legacy-peer-deps
```

---

## 当前架构

### 文件结构

```
src/components/
├── UnifiedSlateEditor/          # 单实例编辑器（主推荐）
│   ├── UnifiedSlateEditor.tsx
│   ├── types.ts
│   ├── helpers.ts
│   └── UnifiedSlateEditor.css
├── MultiLineEditor/             # 多实例编辑器（备选）
│   ├── SlateFreeFormEditor.tsx
│   ├── SlateLine.tsx
│   └── SlateFloatingToolbar.tsx
└── SlateComponents/             # 共享组件
    ├── renderers.tsx            # 自定义渲染组件
    └── serializers.ts           # HTML <-> Slate 转换
```

### 两种架构对比

| 特性 | UnifiedSlateEditor | SlateFreeFormEditor |
|------|-------------------|---------------------|
| **实例数** | 单实例 | 每行一个实例 |
| **跨行选择** | ✅ 完全支持 | ❌ 不支持 |
| **复制粘贴** | ✅ 富文本保留格式 | ⚠️ 仅单行 |
| **性能** | ✅ 优秀 | ⚠️ 多实例开销大 |
| **复杂度** | 中等 | 较高 |
| **开发状态** | 🚧 开发中 | ✅ 已实现 |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ |

---

## 核心组件

### 1. UnifiedSlateEditor（推荐使用）

**文件**: `src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx`

#### 基础用法

```typescript
import { UnifiedSlateEditor } from '@/components/UnifiedSlateEditor';

function PlanManager() {
  const [items, setItems] = useState<PlanItem[]>([]);
  
  return (
    <UnifiedSlateEditor
      items={items}
      onChange={(updatedItems) => setItems(updatedItems)}
      placeholder="开始输入..."
    />
  );
}
```

#### Props 接口

```typescript
interface UnifiedSlateEditorProps {
  items: PlanItem[];                                    // 数据源
  onChange: (items: PlanItem[]) => void;                // 变更回调
  placeholder?: string;                                 // 占位符
  renderLinePrefix?: (line: EventLineNode) => ReactNode;  // 行前缀（如checkbox）
  renderLineSuffix?: (line: EventLineNode) => ReactNode;  // 行后缀（如时间）
}
```

#### 数据结构

```typescript
interface PlanItem {
  id: string;              // 行ID（必需）
  eventId?: string;        // 关联的事件ID
  level: number;           // 缩进层级 (0, 1, 2, ...)
  title: string;           // 纯文本标题
  content: string;         // HTML 内容
  description?: string;    // HTML 描述（可选）
  tags: string[];          // 标签数组
}
```

#### 键盘快捷键

| 快捷键 | 功能 |
|--------|------|
| `Enter` | 创建新的同级行 |
| `Shift+Enter` | 切换 Description 模式 |
| `Tab` | 增加缩进（最多比上一行多1级） |
| `Shift+Tab` | 减少缩进 |
| `Backspace` | 在空行首删除当前行 |
| `Ctrl/Cmd+B` | 粗体 |
| `Ctrl/Cmd+I` | 斜体 |
| `Ctrl/Cmd+U` | 下划线 |

### 2. SlateFreeFormEditor（备选）

**文件**: `src/components/MultiLineEditor/SlateFreeFormEditor.tsx`

多实例架构，每行独立的 Slate 编辑器。适用于需要独立行操作的场景。

```typescript
<SlateFreeFormEditor
  lines={lines}
  onLineUpdate={(lineId, content) => updateLine(lineId, content)}
  onLineCreate={(afterLineId) => createNewLine(afterLineId)}
  onLineDelete={(lineId) => deleteLine(lineId)}
/>
```

### 3. 辅助工具

#### HTML 序列化

```typescript
import { serializeToHtml, deserializeFromHtml } from '@/components/SlateComponents/serializers';

// Slate 内容 → HTML
const html = serializeToHtml(slateNodes);

// HTML → Slate 内容
const nodes = deserializeFromHtml(htmlString);
```

#### 插入自定义元素

```typescript
import { insertTag, insertEmoji, insertDateMention } from '@/components/UnifiedSlateEditor/helpers';

// 插入标签
insertTag(editor, { id: 'tag-1', name: '工作' });

// 插入 Emoji
insertEmoji(editor, '🎉');

// 插入日期提及
insertDateMention(editor, { date: '2025-11-06', text: '今天' });
```

---

## 使用指南

### 集成到 PlanManager

```typescript
import { UnifiedSlateEditor } from '@/components/UnifiedSlateEditor';
import { insertTag } from '@/components/UnifiedSlateEditor/helpers';

function PlanManager() {
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const editorRef = useRef<any>(null);
  
  // 处理标签插入
  const handleTagSelect = (tag: Tag) => {
    if (editorRef.current) {
      insertTag(editorRef.current, tag);
    }
  };
  
  return (
    <div className="plan-manager">
      <UnifiedSlateEditor
        ref={editorRef}
        items={planItems}
        onChange={setPlanItems}
        renderLinePrefix={(line) => (
          <input 
            type="checkbox"
            checked={line.eventId && getEvent(line.eventId)?.isCompleted}
            onChange={(e) => toggleComplete(line.eventId, e.target.checked)}
          />
        )}
        renderLineSuffix={(line) => (
          <div className="line-suffix">
            {line.tags.map(tag => <TagBadge key={tag} name={tag} />)}
            <TimeDisplay eventId={line.eventId} />
          </div>
        )}
      />
      
      <FloatingToolbar onTagSelect={handleTagSelect} />
    </div>
  );
}
```

### 与 EventService 集成

```typescript
// 保存事件时同步 Slate 内容
const saveEvent = async (item: PlanItem) => {
  const event = {
    id: item.eventId || generateId(),
    title: item.title,
    description: item.description,
    content: item.content,  // 保存 HTML
    tags: item.tags,
    level: item.level
  };
  
  await EventService.updateEvent(event);
};

// 从事件恢复 Slate 内容
const loadEvents = async () => {
  const events = await EventService.getEvents();
  const items: PlanItem[] = events.map(event => ({
    id: event.id,
    eventId: event.id,
    level: event.level || 0,
    title: event.title,
    content: event.content,
    description: event.description,
    tags: event.tags || []
  }));
  
  setPlanItems(items);
};
```

---

## 开发规范

### 1. 类型定义

所有 Slate 相关类型定义在 `types.ts` 中：

```typescript
// 自定义元素类型
type CustomElement = 
  | EventLineNode 
  | ParagraphNode 
  | TagNode 
  | DateMentionNode
  | EmojiNode;

// 自定义文本格式
interface CustomText {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

// 扩展 Slate 类型
declare module 'slate' {
  interface CustomTypes {
    Editor: BaseEditor & ReactEditor;
    Element: CustomElement;
    Text: CustomText;
  }
}
```

### 2. 渲染组件

使用 `renderElement` 和 `renderLeaf` 自定义渲染：

```typescript
const renderElement = useCallback((props: RenderElementProps) => {
  switch (props.element.type) {
    case 'event-line':
      return <EventLineElement {...props} />;
    case 'tag':
      return <TagElement {...props} />;
    case 'date-mention':
      return <DateMentionElement {...props} />;
    default:
      return <DefaultElement {...props} />;
  }
}, []);

const renderLeaf = useCallback((props: RenderLeafProps) => {
  let { children } = props;
  
  if (props.leaf.bold) children = <strong>{children}</strong>;
  if (props.leaf.italic) children = <em>{children}</em>;
  if (props.leaf.underline) children = <u>{children}</u>;
  
  return <span {...props.attributes}>{children}</span>;
}, []);
```

### 3. 性能优化

```typescript
// 使用 React.memo 避免不必要的重渲染
const EventLineElement = React.memo(({ attributes, children, element }: RenderElementProps) => {
  return (
    <div 
      {...attributes}
      className={`event-line level-${element.level}`}
      style={{ paddingLeft: `${element.level * 24}px` }}
    >
      {children}
    </div>
  );
});

// 使用 useMemo 缓存计算结果
const serializedContent = useMemo(() => {
  return serializeToHtml(editor.children);
}, [editor.children]);
```

### 4. 测试规范

```typescript
// 单元测试示例
describe('UnifiedSlateEditor', () => {
  it('should create new line on Enter', () => {
    const { getByRole } = render(<UnifiedSlateEditor items={[]} onChange={jest.fn()} />);
    const editor = getByRole('textbox');
    
    fireEvent.keyDown(editor, { key: 'Enter' });
    
    expect(onChange).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ level: 0 })
      ])
    );
  });
});
```

---

## 待完成功能

### 高优先级 🔴

- [ ] **UnifiedSlateEditor 完整实现**
  - [x] 基础编辑功能
  - [x] 跨行选择
  - [ ] Description 模式切换
  - [ ] Tag/DateMention 插入
  - [ ] 完整的键盘快捷键

- [ ] **数据持久化**
  - [ ] 自动保存机制
  - [ ] 离线编辑支持
  - [ ] 版本历史

- [ ] **与现有系统集成**
  - [ ] EventService 双向同步
  - [ ] TagManager 集成
  - [ ] FloatingToolbar 适配

### 中优先级 🟡

- [ ] **富文本功能**
  - [ ] 链接插入
  - [ ] 图片上传
  - [ ] 代码块
  - [ ] 引用块

- [ ] **协作功能**
  - [ ] 实时协作（Yjs 集成）
  - [ ] 评论系统
  - [ ] 变更追踪

### 低优先级 🟢

- [ ] **高级功能**
  - [ ] Markdown 导入/导出
  - [ ] 模板系统
  - [ ] 快捷输入（Slash Commands）
  - [ ] AI 辅助写作

---

## 参考资源

### 官方文档
- [Slate.js 文档](https://docs.slatejs.org/)
- [Slate Examples](https://github.com/ianstormtaylor/slate/tree/main/site/examples)

### 项目内部文档
- `docs/UNIFIED_SLATE_EDITOR_GUIDE.md` - 详细使用指南
- `docs/features/SLATE_MIGRATION_GUIDE.md` - 迁移记录
- `docs/Slate 时间轴编辑器：生产级架构设计文档 v2.0.md` - 架构设计

### 相关 Issues
- `docs/issues/TAGMANAGER_SLATE_REFACTOR.md` - TagManager 重构计划

---

## 常见问题

### Q: 为什么选择 UnifiedSlateEditor 而不是 SlateFreeFormEditor？

**A**: UnifiedSlateEditor 使用单实例架构，支持跨行选择、富文本复制粘贴，性能更好。SlateFreeFormEditor 的多实例架构限制了这些功能。

### Q: 如何处理中文输入法？

**A**: Slate.js 天然支持 IME（Input Method Editor），确保使用 `slate-android-plugin` 处理移动端输入法问题：

```typescript
import { withAndroidInputManager } from 'slate-android-plugin';

const editor = useMemo(() => 
  withAndroidInputManager(
    withHistory(
      withReact(createEditor())
    )
  ), 
[]);
```

### Q: 如何调试 Slate 状态？

**A**: 使用 Slate DevTools 或直接打印编辑器状态：

```typescript
console.log('Editor state:', JSON.stringify(editor.children, null, 2));
```

---

## 贡献指南

1. **代码风格**: 遵循项目 ESLint 规则
2. **提交信息**: 使用 Conventional Commits 格式
3. **文档更新**: 功能变更需同步更新本文档
4. **测试覆盖**: 新功能需要对应的单元测试

---

**最后更新**: 2025-11-06  
**维护者**: ReMarkable Team
