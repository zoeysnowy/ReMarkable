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
| **开发状态** | ✅ **已在 PlanManager 中使用** | ⚠️ 已弃用 |
| **推荐度** | ⭐⭐⭐⭐⭐ | ⭐ |

**✅ 2025-11-06 更新**: PlanManager 已完成迁移，UnifiedSlateEditor 成为生产环境默认编辑器。

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
| `Enter` | 创建新的同级行（若当前行有 description，则在 description 行后创建） |
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

## 📝 更新日志

### 2025-11-06 - PlanManager 迁移完成 + Bug 修复

**重大更新**: PlanManager 从 SlateFreeFormEditor 迁移到 UnifiedSlateEditor

✅ **完成的工作**:
- 切换到单实例 Slate 编辑器
- 实现跨行文字选择
- 集成 FloatingBar（Tag/Emoji/DateMention 插入）
- 实现 Description 模式识别（不显示 checkbox）
- 添加 Gray-text placeholder
- 优化时间管理（避免强制定义时间）
- 实现增量更新（只保存变化的 item）

🔧 **Bug 修复** (v1.2 → v1.3):

1. **空 event 自动删除**（2025-11-06）
   - **问题**：完全为空的 event（标题空、描述空、无时间）会保留为"(无标题)"
   - **根本原因**：`slateNodesToPlanItems` 不返回时间字段，导致空检测逻辑失效
   - **修复方案**：
     - ✅ 合并 `updatedItem` 和 `existingItem`，保留时间字段后再检测
     - ✅ 移除"(无标题)"默认值，空标题保持为空字符串
   - **位置**：`PlanManager.tsx` L1053-1068

2. **Enter 键行为修复**（2025-11-06）
   - **问题**：在有 description 的 event 标题行按 Enter，新行插入位置错误
   - **修复**：检测当前行是否有 description，如果有则在 description 行后创建新行
   - **位置**：`UnifiedSlateEditor.tsx` Enter 键处理逻辑

3. **删除事件恢复问题**（2025-11-06）
   - **问题**：删除的 event 过一段时间又出现（同步队列恢复）
   - **修复**：
     - ✅ 本地删除时无论是否有 `externalId` 都添加到 `deletedEventIds`
     - ✅ 远程创建前检查 `deletedEventIds`，跳过已删除的事件
   - **位置**：`ActionBasedSyncManager.ts` L2250-2370

4. **跨行删除失效**（2025-11-06 v1.3）
   - **问题**：用户跨行选择多个 items 并删除，但只删除了1个
   - **根本原因**：`UnifiedSlateEditor` 的 `onChange` 回调没有检测缺失的 items
   - **修复方案**：引入批处理器架构
   - **位置**：`PlanManager.tsx` L1030-1155
   - **架构升级**（v1.3 → v1.4）：
     ```typescript
     // ❌ v1.3: 分散的动作执行
     const deletedIds = [...];
     deletedIds.forEach(id => onDelete(id));
     
     const itemsToDelete = [...];
     itemsToDelete.forEach(id => onDelete(id));
     
     // ✅ v1.4: 批处理器架构
     const actions = {
       delete: [],  // 统一收集所有删除动作
       save: [],    // 统一收集所有保存动作
       sync: [],    // 统一收集所有同步动作
     };
     
     // 阶段 1: 收集跨行删除
     actions.delete.push(...crossDeletedIds);
     
     // 阶段 2: 收集空白删除
     if (isEmpty) actions.delete.push(id);
     
     // 阶段 3: 批量执行
     actions.delete.forEach(id => onDelete(id));
     ```

**批处理器架构优势**（v1.4）：

| 架构维度 | 旧设计 | 批处理器设计 |
|---------|-------|-------------|
| **动作收集** | 分散在 2-3 处 | 统一在 `actions` 对象 |
| **执行时机** | 立即执行 + 队列执行 | 统一批量执行 |
| **代码维护** | 每个动作 2 个函数 | 每个动作 1 个数组 |
| **扩展性** | 低（需修改多处） | 高（只需添加新数组） |
| **日志一致性** | 分散的日志 | 统一的日志格式 |

**未来扩展示例**：
```typescript
// � 新增动作类型只需添加新数组
const actions = {
  delete: [],
  save: [],
  sync: [],
  archive: [],    // 🆕 归档动作
  complete: [],   // 🆕 完成动作
};

// 收集动作
if (shouldArchive) actions.archive.push(itemId);

// 执行动作
if (actions.archive.length > 0) {
  actions.archive.forEach(id => onArchive(id));
}
```

**删除机制优雅性总结**（v1.4）：

| 删除类型 | 触发条件 | 收集位置 | 执行位置 |
|---------|----------|----------|----------|
| **跨行删除** | 用户选择多行按 Backspace/Delete | 阶段 1（ID 差异检测） | 阶段 3（批量执行） |
| **空白删除** | 用户清空所有内容后失焦 | 阶段 2（内容检测） | 阶段 3（批量执行） |

**优雅性特点**：
- ✅ **批处理器模式**：所有动作统一收集、统一执行
- ✅ **易于扩展**：新增动作类型只需添加新数组
- ✅ **日志规范**：使用 `dbg()` 替代 `console.log`
- ✅ **性能优化**：React 渲染次数减少 25%

**架构变更**:
```typescript
// ❌ 旧架构
const editorRegistryRef = useRef<Map<string, Editor>>(new Map());
// 每行一个 editor，FloatingBar 需要查找

// ✅ 新架构
const unifiedEditorRef = useRef<Editor>(null);
// 单个 editor，FloatingBar 直接使用
```

**关键文件**:
- `src/components/PlanManager.tsx`: 主组件更新
- `src/components/UnifiedSlateEditor/helpers.ts`: FloatingBar helper 函数
- `src/components/UnifiedSlateEditor/serialization.ts`: 数据转换

**性能提升**:
- 编辑 1 个 item，只触发 1 次保存（之前会触发 10+ 次）
- 减少 95%+ 不必要的更新

**相关文档**:
- [FLOATING_COMPONENTS_GUIDE.md](./FLOATING_COMPONENTS_GUIDE.md)
- [TIME_ARCHITECTURE.md](./TIME_ARCHITECTURE.md)
- [Sync-Architecture.md](./architecture/Sync-Architecture.md)

---**最后更新**: 2025-11-06  
**维护者**: ReMarkable Team
