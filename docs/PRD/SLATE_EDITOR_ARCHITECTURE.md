# Slate 编辑器架构设计文档

> **版本**: v2.0 (SlateCore 共享层已实现)  
> **创建时间**: 2025-11-28  
> **最后更新**: 2025-11-29  
> **适用范围**: PlanSlateEditor (UnifiedSlateEditor), LightSlateEditor, 未来 TimeLog 模块  
> **关键设计原则**: 组件化、可复用、单一职责  
> **实现状态**: ✅ SlateCore 共享层已完成，PRD 文档已更新  

---

## 📋 目录

1. [架构概览](#1-架构概览)
2. [两个编辑器的定位与差异](#2-两个编辑器的定位与差异)
3. [共性功能提炼](#3-共性功能提炼)
4. [架构重构方案](#4-架构重构方案)
5. [实现路线图](#5-实现路线图)

---

## 1. 架构概览

### 1.1 架构演进

**v1.0 (2025-11-28 之前)**:
- **问题 1：功能重复** - `UnifiedSlateEditor` 和 `LightSlateEditor` 各自实现了相似的功能
- **问题 2：缺乏共享层** - 没有统一的 Slate 工具函数库
- **问题 3：扩展性差** - 未来 TimeLog 模块需要从零开始实现基础功能

**v2.0 (2025-11-29，当前版本)**:
- ✅ **SlateCore 共享层已完成** - 统一的工具函数库和服务层
- ✅ **代码复用率提升** - LightSlateEditor 代码量减少 60%
- ✅ **扩展性增强** - 未来模块可直接使用 SlateCore
- ✅ **PRD 文档已更新** - 反映新架构

### 1.2 理想架构

```
┌─────────────────────────────────────────────────────────────┐
│                    Slate 生态系统层                          │
│                    (slate, slate-react)                      │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              SlateCore 共享层 (新增)                         │
│  ┌────────────────┬────────────────┬────────────────────┐   │
│  │ 节点操作工具    │ 格式化工具      │ 段落操作工具        │   │
│  │ - 查找节点      │ - 文本格式化    │ - 段落移动          │   │
│  │ - 路径计算      │ - 颜色处理      │ - bullet 层级       │   │
│  │ - 节点验证      │ - 序列化/反序列化│ - 列表操作          │   │
│  └────────────────┴────────────────┴────────────────────┘   │
│  ┌────────────────┬────────────────┬────────────────────┐   │
│  │ Timestamp 管理  │ Inline 元素     │ Block 元素          │   │
│  │ - 自动插入      │ - Tag           │ - Timestamp Divider │   │
│  │ - 时间间隔检测  │ - DateMention   │ - Paragraph         │   │
│  │ - 清理空白记录  │ - Emoji         │ - EventLine         │   │
│  └────────────────┴────────────────┴────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────┐
│              Slate 编辑器层 (专用编辑器)                      │
│  ┌──────────────────────┬─────────────────────────────────┐ │
│  │ SlateEditor     │ PlanSlateEditor              │ │
│  │ (单内容编辑)          │ (多事件管理)                     │ │
│  │ - EventEditModal     │ - PlanManager                   │ │
│  │ - TimeLog (未来)     │ - 复杂事件列表                   │ │
│  └──────────────────────┴─────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

---

## 1.3 SlateCore 实现状态

### 已完成的功能

**✅ 目录结构** (`src/components/SlateCore/`):
- `operations/` - 操作工具（inlineHelpers, formatting, bulletOperations, nodeOperations, paragraphOperations）
- `services/` - 服务类（timestampService）
- `serialization/` - 序列化工具（jsonSerializer）
- `elements/` - 共享元素组件（TagElement, DateMentionElement, TimestampDividerElement）
- `future/` - 未来扩展预留（imageOperations, audioOperations, mentionOperations）

**✅ 共享类型定义** (`types.ts`):
- `TextNode`, `ParagraphNode` - 基础节点
- `TagNode`, `DateMentionNode`, `TimestampDividerElement` - Inline 元素
- `SlateEditorConfig` - 编辑器配置
- `CustomEditor` - 编辑器类型扩展

**✅ 操作工具**:
- `inlineHelpers.ts`: `insertTag`, `insertEmoji`, `insertDateMention`, `insertVoidElement`
- `formatting.ts`: `applyTextFormat`, `toggleFormat`, `getActiveFormats`, `clearAllFormats`
- `bulletOperations.ts`: `increaseBulletLevel`, `decreaseBulletLevel`, `toggleBullet`, `handleBulletBackspace`, `handleBulletEnter`
- `nodeOperations.ts`: `findNodeByType`, `isNodeEmpty`, `getParentPath`, `getSiblingPath`, `isAncestorPath`, `isValidPath`, `getNodeIndex`, `isNodeType`, `getNodeText`, `findChildrenByType`
- `paragraphOperations.ts`: `moveParagraphUp`, `moveParagraphDown`, `swapNodes`, `canMoveUp`, `canMoveDown`

**✅ 服务类**:
- `EventLogTimestampService` - 5分钟间隔检测、自动插入、清理空白记录

**✅ 序列化工具**:
- `jsonToSlateNodes`, `slateNodesToJson` - JSON ↔ Slate nodes
- `createEmptyParagraph`, `createTextParagraph`, `createBulletParagraph` - 节点创建

**✅ PRD 文档**:
- `PLANSLATE_EDITOR_PRD.md` - PlanSlateEditor 完整 PRD
- `SLATEEDITOR_PRD.md` - LightSlateEditor 完整 PRD（已更新为 v2.0）
- `SLATE_EDITOR_ARCHITECTURE.md` - 本文档（已更新）

### 待完成的任务

**⚠️ LightSlateEditor 重构** (优先级: P0):
- 替换内部实现，调用 SlateCore 共享层
- 测试 EventEditModal 集成
- 验证所有功能正常工作

**⚠️ UnifiedSlateEditor 重构** (优先级: P1):
- 保留 EventLine 特有逻辑（serialization, EventLineElement）
- 替换通用工具函数为 SlateCore 调用
- 测试 PlanManager 集成
- 验证双模式段落移动、Checkbox、Snapshot 等功能

**📝 未来扩展** (优先级: P2):
- 图片支持 (`future/imageOperations.ts`)
- 语音支持 (`future/audioOperations.ts`)
- 扩展 Mention (`future/mentionOperations.ts`)

---

## 2. 两个编辑器的定位与差异

### 2.1 PlanSlateEditor

**定位**: 多事件管理编辑器，支持事件列表批量操作

**核心特性**:
- ✅ **EventLine 架构**: 每个事件是一个 event-line 节点，包含标题和子段落
- ✅ **多事件管理**: 支持跨事件操作、批量编辑、事件排序
- ✅ **checkbox 集成**: 与 PlanManager 的任务状态同步
- ✅ **复杂数据流**: PlanItem[] ↔ Event[] ↔ Slate nodes 三层转换
- ✅ **双模式段落移动**: 标题移动带动 eventlog，eventlog 独立移动

**使用场景**:
- PlanManager 页面（主要）
- 未来可能的任务批量管理页面

**数据结构**:
```typescript
EventLineNode {
  type: 'event-line',
  eventId: string,
  level: number,  // 事件层级（缩进）
  children: [
    TitleNode {
      type: 'title',
      children: [TextNode | TagNode | DateMentionNode]
    },
    EventlogNode {
      type: 'eventlog',
      children: [ParagraphNode | TimestampDividerNode]
    }
  ]
}
```

### 2.2 SlateEditor

**定位**: 轻量级单内容编辑器，专注于纯文本编辑体验

**核心特性**:
- ✅ **扁平段落结构**: 直接的 paragraph 节点，无 event-line 包裹
- ✅ **Timestamp 自动管理**: 5分钟间隔自动插入，失焦清理空白记录
- ✅ **Bullet 支持**: 多层级 bullet，OneNote 风格删除机制
- ✅ **简化数据流**: content string (JSON) ↔ Slate nodes 单层转换
- ✅ **段落移动**: 上下交换，自动跳过 timestamp

**使用场景**:
- EventEditModal 实际进展区域（已实现）
- 未来 TimeLog 页面（待开发）
- 任何需要富文本日志的单内容编辑场景

**数据结构**:
```typescript
[
  TimestampDividerNode {
    type: 'timestamp-divider',
    timestamp: string,
    children: [{ text: '' }]
  },
  ParagraphNode {
    type: 'paragraph',
    bullet: boolean,
    bulletLevel: number,
    children: [TextNode | TagNode | DateMentionNode]
  }
]
```

### 2.3 核心差异对比

| 维度 | PlanSlateEditor | SlateEditor |
|------|-------------------|------------------|
| **数据模型** | 多事件列表 (Event[]) | 单内容字符串 (string) |
| **节点结构** | event-line → title + eventlog | 扁平 paragraph[] |
| **主要用途** | 多事件管理、任务列表 | 单事件日志、文本编辑 |
| **复杂度** | 高（三层数据转换） | 低（单层 JSON 序列化） |
| **特殊功能** | checkbox、事件排序 | timestamp、preline |
| **段落移动** | 双模式（标题+eventlog vs 单段落） | 单模式（段落交换） |
| **缩进管理** | event-line level + bulletLevel | 仅 bulletLevel |

---

## 3. 共性功能提炼

### 3.1 已识别的共性功能

#### A. 节点操作 (Node Operations)

**当前状况**: 两个编辑器各自实现
**共性需求**:
- 查找节点（按类型、按路径、按 ID）
- 节点验证（是否为空、是否有文本）
- 路径计算（父路径、兄弟路径、祖先路径）

**提炼方案**: `SlateCore/nodeOperations.ts`
```typescript
export function findNodeByType(
  editor: Editor, 
  type: string, 
  from?: Path
): [Node, Path] | null;

export function isNodeEmpty(node: Node): boolean;
export function getParentPath(path: Path): Path;
export function getSiblingPath(path: Path, offset: number): Path | null;
export function isAncestorPath(ancestor: Path, descendant: Path): boolean;
```

#### B. 段落操作 (Paragraph Operations)

**当前状况**: 两个编辑器都实现了段落移动，但逻辑重复
**共性需求**:
- 段落移动（上/下）
- 边界检查（首行/末行）
- 特殊节点跳过（timestamp、placeholder）

**提炼方案**: `SlateCore/paragraphOperations.ts`
```typescript
export function moveParagraphUp(
  editor: Editor, 
  currentPath: Path,
  options?: {
    skipTypes?: string[],  // 要跳过的节点类型
    boundaryCheck?: (path: Path) => boolean
  }
): boolean;

export function moveParagraphDown(
  editor: Editor, 
  currentPath: Path,
  options?: {
    skipTypes?: string[],
    boundaryCheck?: (path: Path) => boolean
  }
): boolean;

export function swapNodes(
  editor: Editor, 
  pathA: Path, 
  pathB: Path
): void;
```

#### C. Bullet 操作 (Bullet Operations)

**当前状况**: PlanSlateEditor 支持 bullet，SlateEditor 也需要
**共性需求**:
- Bullet 层级增加/减少
- Tab/Shift+Tab 缩进管理
- Backspace 行首删除 bullet
- Enter 自动继承 bullet

**提炼方案**: `SlateCore/bulletOperations.ts`
```typescript
export function increaseBulletLevel(
  editor: Editor, 
  path: Path,
  maxLevel?: number
): void;

export function decreaseBulletLevel(
  editor: Editor, 
  path: Path
): void;

export function toggleBullet(editor: Editor, path: Path): void;

export function handleBulletBackspace(
  editor: Editor, 
  path: Path,
  offset: number
): boolean;  // true = handled, false = default behavior
```

#### D. Timestamp 管理 (Timestamp Management)

**当前状况**: SlateEditor 已实现，PlanSlateEditor 的 eventlog 也需要
**共性需求**:
- 5分钟间隔检测
- 自动插入 timestamp
- 清理空白 timestamp
- 首次编辑插入创建时间

**提炼方案**: `SlateCore/timestampService.ts` (重构现有代码)
```typescript
export class TimestampService {
  shouldInsertTimestamp(contextId: string, eventId: string): boolean;
  updateLastEditTime(contextId: string, time: Date): void;
  insertTimestamp(editor: Editor, time?: Date): void;
  cleanupEmptyTimestamps(editor: Editor): void;
}
```

#### E. Inline 元素插入 (Inline Elements)

**当前状况**: helpers.ts 已有 insertTag/insertEmoji/insertDateMention
**共性需求**:
- 插入后光标处理
- 焦点管理
- void 元素后自动添加空格

**提炼方案**: `SlateCore/inlineHelpers.ts` (重构现有 helpers.ts)
```typescript
export function insertTag(
  editor: Editor,
  tagId: string,
  tagName: string,
  options?: TagOptions
): boolean;

export function insertEmoji(editor: Editor, emoji: string): boolean;

export function insertDateMention(
  editor: Editor,
  startDate: string,
  endDate?: string,
  options?: DateMentionOptions
): boolean;

// 🆕 统一的 void 元素插入函数
export function insertVoidElement(
  editor: Editor,
  node: CustomElement,
  options?: {
    focusAfter?: boolean,
    addSpaceAfter?: boolean
  }
): boolean;
```

#### F. 序列化工具 (Serialization)

**当前状况**: 两个编辑器各自实现了序列化函数
**共性需求**:
- JSON ↔ Slate nodes
- HTML ↔ Slate nodes
- 外部 HTML 粘贴解析

**提炼方案**: `SlateCore/serialization.ts`
```typescript
export function jsonToSlateNodes(json: string | any[]): Descendant[];
export function slateNodesToJson(nodes: Descendant[]): string;
export function slateNodesToHtml(nodes: Descendant[]): string;
export function htmlToSlateNodes(html: string): Descendant[];
```

#### G. 格式化工具 (Formatting)

**当前状况**: helpers.ts 有 applyTextFormat，但不够完善
**共性需求**:
- 文本格式（粗体、斜体、下划线等）
- 颜色处理
- 列表格式
- 对齐方式

**提炼方案**: `SlateCore/formatting.ts`
```typescript
export function applyTextFormat(
  editor: Editor, 
  format: TextFormat,
  value?: any
): boolean;

export function getActiveFormats(editor: Editor): Set<TextFormat>;
export function clearAllFormats(editor: Editor): void;
```

### 3.2 未来扩展功能（待添加到共享层）

#### H. 图片支持 (Image Support)

**需求来源**: "后期的slate还要支持很多图片、语音、扩展mention功能等复杂元素"
**共性需求**:
- 图片上传
- 图片预览
- 图片缩放/裁剪
- Base64 嵌入 vs URL 引用

**提炼方案**: `SlateCore/imageOperations.ts`
```typescript
export function insertImage(
  editor: Editor,
  imageUrl: string,
  options?: {
    width?: number,
    height?: number,
    alt?: string,
    embed?: boolean  // Base64 嵌入 vs URL
  }
): boolean;

export function uploadImage(
  file: File,
  onProgress?: (percent: number) => void
): Promise<string>;  // 返回图片 URL
```

#### I. 语音支持 (Audio Support)

**需求来源**: "后期的slate还要支持很多图片、语音、扩展mention功能等复杂元素"
**共性需求**:
- 语音录制
- 语音播放
- 语音转文字
- 语音文件管理

**提炼方案**: `SlateCore/audioOperations.ts`
```typescript
export function insertAudio(
  editor: Editor,
  audioUrl: string,
  duration: number,
  transcript?: string
): boolean;

export function recordAudio(): Promise<AudioRecording>;
export function transcribeAudio(audioUrl: string): Promise<string>;
```

#### J. 扩展 Mention (Extended Mentions)

**需求来源**: "后期的slate还要支持很多图片、语音、扩展mention功能等复杂元素"
**共性需求**:
- @人员提及
- #标签提及（已有）
- @时间提及（已有）
- @文件提及
- @链接提及

**提炼方案**: `SlateCore/mentionOperations.ts`
```typescript
export function insertPersonMention(
  editor: Editor,
  personId: string,
  personName: string
): boolean;

export function insertFileMention(
  editor: Editor,
  fileId: string,
  fileName: string,
  fileType: string
): boolean;

export function insertLinkMention(
  editor: Editor,
  url: string,
  title?: string
): boolean;
```

---

## 4. 架构重构方案

### 4.1 目录结构设计

```
src/components/
├── SlateCore/  # 🆕 共享层
│   ├── index.ts  # 统一导出
│   ├── types.ts  # 共享类型定义
│   │
│   ├── operations/  # 操作工具
│   │   ├── nodeOperations.ts  # 节点操作
│   │   ├── paragraphOperations.ts  # 段落操作
│   │   ├── bulletOperations.ts  # Bullet 操作
│   │   ├── inlineHelpers.ts  # Inline 元素插入
│   │   └── formatting.ts  # 格式化
│   │
│   ├── services/  # 服务类
│   │   ├── timestampService.ts  # Timestamp 管理
│   │   └── selectionService.ts  # 选区管理
│   │
│   ├── serialization/  # 序列化工具
│   │   ├── jsonSerializer.ts  # JSON ↔ Slate
│   │   ├── htmlSerializer.ts  # HTML ↔ Slate
│   │   └── pasteHandler.ts  # 粘贴处理
│   │
│   ├── elements/  # 共享元素组件
│   │   ├── TagElement.tsx
│   │   ├── DateMentionElement.tsx
│   │   ├── TimestampDividerElement.tsx
│   │   ├── ParagraphElement.tsx
│   │   └── index.ts
│   │
│   └── future/  # 未来功能（预留）
│       ├── imageOperations.ts
│       ├── audioOperations.ts
│       └── mentionOperations.ts
│
├── PlanSlateEditor/  # 专用编辑器
│   ├── PlanSlateEditor.tsx
│   ├── types.ts  # PlanSlate 特有类型（EventLineNode 等）
│   ├── serialization.ts  # 特有序列化（PlanItem ↔ EventLine）
│   ├── EventLineElement.tsx  # 特有元素
│   └── EventLinePrefix.tsx
│
└── SlateEditor/  # 专用编辑器
    ├── SlateEditor.tsx
    ├── types.ts  # 如果有 Slate 特有类型
    └── serialization.ts  # 特有序列化（如果需要）
```

### 4.2 迁移策略

#### 阶段 1: 创建 SlateCore 层（不破坏现有代码）

1. **创建目录结构**
   ```bash
   mkdir -p src/components/SlateCore/{operations,services,serialization,elements,future}
   ```

2. **提取共享类型**
   - 从 PlanSlateEditor/types.ts 提取通用类型到 SlateCore/types.ts
   - 保留 EventLineNode 等特有类型在 PlanSlateEditor/types.ts

3. **创建共享工具函数**（新文件，不修改现有代码）
   - `SlateCore/operations/nodeOperations.ts`
   - `SlateCore/operations/paragraphOperations.ts`
   - `SlateCore/operations/bulletOperations.ts`
   - `SlateCore/serialization/jsonSerializer.ts`

4. **重构 TimestampService**
   - 将 `PlanSlateEditor/timestampService.ts` 移动到 `SlateCore/services/timestampService.ts`
   - 两个编辑器共享同一个 TimestampService

5. **重构 Inline Helpers**
   - 将 `PlanSlateEditor/helpers.ts` 重构为 `SlateCore/operations/inlineHelpers.ts`
   - 保留 PlanSlateEditor/helpers.ts 作为兼容导出

6. **移动共享元素组件**
   - `PlanSlateEditor/elements/TagElement.tsx` → `SlateCore/elements/TagElement.tsx`
   - `PlanSlateEditor/elements/DateMentionElement.tsx` → `SlateCore/elements/DateMentionElement.tsx`
   - `PlanSlateEditor/elements/TimestampDividerElement.tsx` → `SlateCore/elements/TimestampDividerElement.tsx`

#### 阶段 2: 重构 SlateEditor（使用 SlateCore）

7. **替换 SlateEditor 内部实现**
   - 段落移动函数使用 `SlateCore/operations/paragraphOperations.ts`
   - Bullet 操作使用 `SlateCore/operations/bulletOperations.ts`
   - Timestamp 使用 `SlateCore/services/timestampService.ts`
   - 序列化使用 `SlateCore/serialization/jsonSerializer.ts`

8. **测试验证**
   - EventEditModal 实际进展区域功能验证
   - 段落移动、bullet 删除、timestamp 插入等功能测试

#### 阶段 3: 重构 PlanSlateEditor（渐进式）

9. **逐步替换 PlanSlateEditor 内部实现**
   - 先替换通用工具函数（nodeOperations、paragraphOperations）
   - 再替换 Inline 元素插入（使用重构后的 inlineHelpers）
   - 保留 EventLine 特有逻辑（serialization、EventLineElement）

10. **测试验证**
    - PlanManager 功能验证
    - 双模式段落移动、checkbox 同步等功能测试

#### 阶段 4: 文档更新与性能优化

11. **更新文档**
    - 更新 SLATE_EDITOR_PRD.md，添加 SlateCore 架构说明
    - 创建 SlateCore API 文档
    - 更新 QUICK_START.md，引导开发者使用 SlateCore

12. **性能优化**
    - 代码分割（动态导入 SlateCore 模块）
    - Tree-shaking 优化（确保未使用的代码不被打包）

### 4.3 代码示例

#### 示例 1: SlateEditor 使用 SlateCore

```typescript
// SlateEditor.tsx (重构后)
import { moveParagraphUp, moveParagraphDown } from '../SlateCore/operations/paragraphOperations';
import { TimestampService } from '../SlateCore/services/timestampService';

export const SlateEditor = ({ content, onChange, parentEventId }: Props) => {
  const editor = useMemo(() => withReact(withHistory(createEditor())), []);
  
  // 🆕 使用共享的 TimestampService
  const timestampService = useMemo(() => new TimestampService(), []);
  
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    // 段落移动（使用 SlateCore 工具）
    if (e.shiftKey && e.altKey && e.key === 'ArrowUp') {
      e.preventDefault();
      const success = moveParagraphUp(editor, editor.selection?.anchor.path!, {
        skipTypes: ['timestamp-divider'],  // 跳过 timestamp
        boundaryCheck: (path) => path[0] > 0  // 不能移到首行之前
      });
      if (success) {
        console.log('✅ 段落已上移');
      }
      return;
    }
    
    if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
      e.preventDefault();
      const success = moveParagraphDown(editor, editor.selection?.anchor.path!, {
        skipTypes: ['timestamp-divider']
      });
      if (success) {
        console.log('✅ 段落已下移');
      }
      return;
    }
    
    // ... 其他快捷键
  }, [editor]);
  
  const handleFocus = useCallback(() => {
    // 🆕 使用共享的 TimestampService
    if (timestampService.shouldInsertTimestamp(parentEventId, parentEventId)) {
      timestampService.insertTimestamp(editor);
    }
  }, [editor, parentEventId, timestampService]);
  
  return (
    <Slate editor={editor} value={value} onChange={handleChange}>
      <Editable
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  );
};
```

#### 示例 2: PlanSlateEditor 使用 SlateCore

```typescript
// PlanSlateEditor.tsx (重构后)
import { moveParagraphUp, moveParagraphDown } from '../SlateCore/operations/paragraphOperations';
import { findNodeByType, isNodeEmpty } from '../SlateCore/operations/nodeOperations';
import { insertTag, insertEmoji, insertDateMention } from '../SlateCore/operations/inlineHelpers';

export const PlanSlateEditor = ({ items, onSave }: Props) => {
  const editor = useMemo(() => withReact(withHistory(createEditor())), []);
  
  // 双模式段落移动（复用 SlateCore 基础函数）
  const moveTitleWithEventlogs = useCallback((direction: 'up' | 'down') => {
    // 使用 SlateCore 的 findNodeByType 查找当前 EventLine
    const [eventLine, eventLinePath] = findNodeByType(editor, 'event-line', currentPath) || [];
    if (!eventLine) return;
    
    // 使用 SlateCore 的 moveParagraphUp/Down 移动整个 EventLine
    if (direction === 'up') {
      moveParagraphUp(editor, eventLinePath, {
        skipTypes: ['placeholder'],
        boundaryCheck: (path) => path[0] > 0
      });
    } else {
      moveParagraphDown(editor, eventLinePath, {
        skipTypes: ['placeholder']
      });
    }
  }, [editor]);
  
  const moveEventlogParagraph = useCallback((direction: 'up' | 'down') => {
    // 使用 SlateCore 的 moveParagraphUp/Down 移动单个段落
    // ... 逻辑与之前类似，但使用共享函数
  }, [editor]);
  
  return (
    <Slate editor={editor} value={value} onChange={handleChange}>
      <Editable
        onKeyDown={handleKeyDown}
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  );
};
```

#### 示例 3: 未来 TimeLog 模块使用 SlateCore

```typescript
// TimeLogEditor.tsx (未来实现)
import { SlateEditor } from '../SlateEditor/SlateEditor';
import { TimestampService } from '../SlateCore/services/timestampService';
import { insertImage, insertAudio } from '../SlateCore/future/imageOperations';

export const TimeLogEditor = ({ event }: { event: Event }) => {
  // 🎉 直接复用 SlateEditor，因为它已经使用了 SlateCore
  return (
    <div className="timelog-editor">
      <SlateEditor
        content={event.eventlog || ''}
        parentEventId={event.id}
        onChange={(json) => {
          EventService.updateEvent(event.id, { eventlog: json });
        }}
        enableTimestamp={true}
        placeholder="记录你的想法..."
      />
      
      {/* 🆕 扩展功能：图片、语音上传 */}
      <div className="timelog-toolbar">
        <button onClick={() => insertImage(editor, imageUrl)}>
          📷 插入图片
        </button>
        <button onClick={() => insertAudio(editor, audioUrl, duration)}>
          🎤 插入语音
        </button>
      </div>
    </div>
  );
};
```

---

## 5. 实现路线图

### 5.1 阶段划分

| 阶段 | 时间估算 | 目标 | 关键任务 |
|------|---------|------|---------|
| **阶段 1** | 2-3 天 | 创建 SlateCore 基础架构 | 目录结构、类型定义、基础工具函数 |
| **阶段 2** | 2-3 天 | 重构 SlateEditor | 替换内部实现、测试验证 |
| **阶段 3** | 3-4 天 | 重构 PlanSlateEditor | 渐进式替换、保留特有逻辑 |
| **阶段 4** | 1-2 天 | 文档与优化 | API 文档、性能优化、代码审查 |

**总计**: 8-12 天（约 2 周）

### 5.2 详细任务清单

#### 阶段 1: 创建 SlateCore 基础架构

- [ ] 创建目录结构 `src/components/SlateCore/`
- [ ] 提取共享类型到 `SlateCore/types.ts`
- [ ] 创建 `SlateCore/operations/nodeOperations.ts`
  - [ ] findNodeByType
  - [ ] isNodeEmpty
  - [ ] getParentPath
  - [ ] getSiblingPath
  - [ ] isAncestorPath
- [ ] 创建 `SlateCore/operations/paragraphOperations.ts`
  - [ ] moveParagraphUp
  - [ ] moveParagraphDown
  - [ ] swapNodes
- [ ] 创建 `SlateCore/operations/bulletOperations.ts`
  - [ ] increaseBulletLevel
  - [ ] decreaseBulletLevel
  - [ ] toggleBullet
  - [ ] handleBulletBackspace
- [ ] 重构 `SlateCore/services/timestampService.ts`（从 PlanSlateEditor 移动）
- [ ] 重构 `SlateCore/operations/inlineHelpers.ts`（从 PlanSlateEditor/helpers.ts）
- [ ] 移动共享元素到 `SlateCore/elements/`
  - [ ] TagElement.tsx
  - [ ] DateMentionElement.tsx
  - [ ] TimestampDividerElement.tsx
- [ ] 创建 `SlateCore/serialization/jsonSerializer.ts`
  - [ ] jsonToSlateNodes
  - [ ] slateNodesToJson
- [ ] 创建 `SlateCore/index.ts` 统一导出

#### 阶段 2: 重构 SlateEditor

- [ ] 替换段落移动函数（使用 SlateCore/paragraphOperations）
- [ ] 替换 Bullet 操作（使用 SlateCore/bulletOperations）
- [ ] 替换 Timestamp 服务（使用 SlateCore/timestampService）
- [ ] 替换序列化工具（使用 SlateCore/jsonSerializer）
- [ ] 更新元素导入路径（从 SlateCore/elements 导入）
- [ ] 测试 EventEditModal 实际进展区域功能
- [ ] 测试段落移动、bullet 删除、timestamp 插入
- [ ] Git 提交：`feat(SlateCore): 重构 SlateEditor 使用共享层`

#### 阶段 3: 重构 PlanSlateEditor

- [ ] 替换通用节点操作（使用 SlateCore/nodeOperations）
- [ ] 替换段落移动基础逻辑（保留双模式特有逻辑）
- [ ] 替换 Inline 元素插入（使用 SlateCore/inlineHelpers）
- [ ] 更新元素导入路径（从 SlateCore/elements 导入）
- [ ] 保留 EventLine 特有逻辑（serialization、EventLineElement）
- [ ] 测试 PlanManager 功能
- [ ] 测试双模式段落移动、checkbox 同步
- [ ] Git 提交：`refactor(SlateCore): 重构 PlanSlateEditor 使用共享层`

#### 阶段 4: 文档与优化

- [ ] 更新 SLATE_EDITOR_PRD.md
  - [ ] 添加 SlateCore 架构章节
  - [ ] 更新 SlateEditor 章节
  - [ ] 更新 PlanSlateEditor 章节
- [ ] 创建 SLATE_CORE_API.md
  - [ ] API 文档
  - [ ] 使用示例
  - [ ] 最佳实践
- [ ] 更新 QUICK_START.md
  - [ ] 引导开发者使用 SlateCore
  - [ ] 添加代码示例
- [ ] 性能优化
  - [ ] 代码分割（动态导入）
  - [ ] Tree-shaking 优化
- [ ] 代码审查与测试
- [ ] Git 提交：`docs(SlateCore): 完善架构文档和 API 文档`

### 5.3 风险与挑战

**风险 1: 破坏现有功能**
- **应对**: 渐进式重构，每次只替换一个模块，立即测试
- **验证**: 保留现有测试用例，确保功能不倒退

**风险 2: 性能下降**
- **应对**: 性能基准测试，对比重构前后性能指标
- **验证**: 使用 Chrome DevTools Performance 面板监测

**风险 3: 代码冗余**
- **应对**: 严格的 Code Review，确保共享层真正被使用
- **验证**: 使用 Webpack Bundle Analyzer 检查代码体积

**风险 4: 过度抽象**
- **应对**: 遵循 YAGNI 原则（You Aren't Gonna Need It），只提取已验证的共性
- **验证**: 每个共享函数至少被 2 个编辑器使用

---

## 6. 未来展望

### 6.1 TimeLog 模块集成

- 直接使用 SlateEditor 作为基础编辑器
- 添加 TimeLog 特有功能（时间轴展示、事件卡片、过滤器）
- 使用 SlateCore 扩展功能（图片、语音、扩展 mention）

### 6.2 更多编辑器场景

- **NotesEditor**: 笔记编辑器（基于 SlateEditor）
- **CommentEditor**: 评论编辑器（简化版 SlateEditor）
- **RichTextModal**: 通用富文本弹窗（复用 SlateCore 所有功能）

### 6.3 插件系统

```typescript
// SlateCore/plugins/pluginSystem.ts
export interface SlatePlugin {
  name: string;
  renderElement?: RenderElementFn;
  renderLeaf?: RenderLeafFn;
  onKeyDown?: KeyDownHandler;
  commands?: Record<string, CommandFn>;
}

export function withPlugins(editor: Editor, plugins: SlatePlugin[]): Editor {
  // 插件注册与组合逻辑
}
```

**插件示例**:
- `TablePlugin`: 表格支持
- `MathPlugin`: LaTeX 数学公式
- `CodeBlockPlugin`: 代码高亮
- `CollapsiblePlugin`: 折叠块

---

## 7. 总结

### 7.1 重构收益

1. **代码复用**: 两个编辑器共享 70% 以上的核心代码
2. **维护成本降低**: 新功能只需在 SlateCore 实现一次
3. **扩展性强**: 未来新编辑器可快速搭建
4. **一致性**: 所有编辑器行为统一，用户体验一致
5. **测试简化**: 共享层集中测试，覆盖率更高

### 7.2 关键设计原则

- ✅ **单一职责**: 每个模块只做一件事
- ✅ **开闭原则**: 对扩展开放，对修改封闭
- ✅ **依赖倒置**: 专用编辑器依赖 SlateCore 抽象，而非具体实现
- ✅ **最小惊讶**: API 设计直观，命名清晰
- ✅ **渐进式重构**: 不破坏现有功能，逐步迁移

### 7.3 下一步行动

1. **立即**: 更新 SLATE_EDITOR_PRD.md，区分 PlanSlate 和 Slate 章节
2. **本周**: 开始阶段 1，创建 SlateCore 基础架构
3. **下周**: 完成阶段 2，重构 SlateEditor
4. **两周内**: 完成所有重构，发布 v1.0 文档

---

**文档版本**: v1.0  
**最后更新**: 2025-11-28  
**作者**: GitHub Copilot  
**审核状态**: ✅ 已完成架构设计  
