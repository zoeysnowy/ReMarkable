# LightSlateEditor 产品需求文档 (PRD)

> **模块路径**: `src/components/LightSlateEditor/LightSlateEditor.tsx`  
> **代码行数**: ~1265 lines  
> **架构版本**: v1.0  
> **最后更新**: 2025-11-28  
> **设计理念**: 轻量级、专注单内容编辑、高度可复用  
> **关联文档**: 
> - [SLATE_EDITOR_PRD.md](./SLATE_EDITOR_PRD.md) - Slate 编辑器总览
> - [SLATE_EDITOR_ARCHITECTURE.md](./SLATE_EDITOR_ARCHITECTURE.md) - 架构设计
> - [EVENTEDITMODAL_V2_PRD.md](./EVENTEDITMODAL_V2_PRD.md) - EventEditModal 集成
> - [TimeLog_&_Description_PRD.md](./TimeLog_&_Description_PRD.md) - TimeLog 模块规划

---

## 📋 目录

1. [设计目标与定位](#1-设计目标与定位)
2. [核心特性](#2-核心特性)
3. [数据流与架构](#3-数据流与架构)
4. [Timestamp 自动管理](#4-timestamp-自动管理)
5. [Bullet 操作系统](#5-bullet-操作系统)
6. [段落移动功能](#6-段落移动功能)
7. [使用场景](#7-使用场景)
8. [API 文档](#8-api-文档)
9. [未来扩展](#9-未来扩展)

---

## 1. 设计目标与定位

### 1.1 设计目标

**核心理念**: "轻量级、专注单内容编辑、高度可复用"

LightSlateEditor 是为**单内容编辑场景**优化的 Slate 编辑器，移除了 PlanManager 特定的复杂功能（event-line、多事件管理），保留核心编辑能力，专注于提供流畅的文本编辑体验。

**设计原则**:
- ✅ **简化数据流**: content string (JSON) ↔ Slate nodes（单层转换）
- ✅ **扁平结构**: 直接的 paragraph 节点，无 event-line 包裹
- ✅ **自动化管理**: Timestamp 自动插入与清理，用户无感知
- ✅ **直觉操作**: OneNote 风格的 bullet 删除，符合用户习惯
- ✅ **高度复用**: 支持多种使用场景（EventEditModal、TimeLog 等）

### 1.2 与 UnifiedSlateEditor 的差异

| 维度 | LightSlateEditor | UnifiedSlateEditor |
|------|-----------------|-------------------|
| **数据模型** | 单内容字符串 (`string`) | 多事件列表 (`Event[]`) |
| **节点结构** | 扁平 `paragraph[]` | `event-line` → `title` + `eventlog` |
| **主要用途** | 单事件日志、文本编辑 | 多事件管理、任务列表 |
| **复杂度** | 低（单层 JSON 序列化） | 高（三层数据转换） |
| **特殊功能** | Timestamp、Preline | Checkbox、事件排序 |
| **段落移动** | 单模式（段落交换） | 双模式（标题+eventlog vs 单段落） |
| **缩进管理** | 仅 `bulletLevel` | `event-line level` + `bulletLevel` |
| **使用场景** | EventEditModal、TimeLog | PlanManager |

---

## 2. 核心特性

### 2.1 特性列表

- ✅ **扁平段落结构**: 直接的 paragraph 节点，易于理解和操作
- ✅ **Timestamp 自动管理**: 5分钟间隔自动插入，失焦清理空白记录
- ✅ **Bullet 支持**: 多层级 bullet（0-4级），OneNote 风格删除机制
- ✅ **段落移动**: Shift+Alt+↑/↓ 快捷键，自动跳过 timestamp
- ✅ **Inline 元素**: 支持 Tag、DateMention、Emoji
- ✅ **富文本格式**: 粗体、斜体、下划线、删除线、颜色
- ✅ **Preline 视觉**: timestamp 后的段落显示垂直时间线
- ✅ **Timestamp 保护**: 禁止用户删除 timestamp 节点
- ✅ **简化数据流**: content string ↔ Slate nodes（单层序列化）

### 2.2 特性详解

#### 2.2.1 扁平段落结构

**设计理念**: 去除复杂的嵌套结构，专注内容本身

**节点类型**:
```typescript
[
  TimestampDividerNode {  // 时间分隔符（系统自动插入）
    type: 'timestamp-divider',
    timestamp: string,     // ISO 8601 格式
    children: [{ text: '' }]
  },
  ParagraphNode {         // 段落节点（用户编辑）
    type: 'paragraph',
    bullet: boolean,       // 是否为 bullet
    bulletLevel: number,   // 层级 (0-4)
    children: [
      TextNode | TagNode | DateMentionNode  // Inline 元素
    ]
  }
]
```

**优势**:
- 简单直观，易于序列化和反序列化
- 降低学习成本，新开发者快速上手
- 减少节点嵌套层级，提升性能

#### 2.2.2 Timestamp 自动管理

**核心逻辑**: 无感知的时间记录，自动插入和清理

**5分钟间隔规则**:
- 距离上次编辑 ≥ 5 分钟 → 自动插入新 timestamp
- 距离上次编辑 < 5 分钟 → 不插入，继续在当前 timestamp 下编辑

**自动清理机制**:
- 失焦时检查 timestamp 后是否有实际内容
- 空 bullet 段落不算内容（会被一起清理）
- 只有实际文本才保留 timestamp

**首次编辑特殊处理**:
- 从 EventHistoryService 获取事件创建时间
- 使用创建时间作为首个 timestamp
- 如果获取失败，使用当前时间

**实现位置**: `EventLogTimestampService` (复用自 UnifiedSlateEditor)

#### 2.2.3 Bullet 操作系统

**OneNote 风格删除机制**:
- **行首 + Level > 0**: Backspace 降低一级层级
- **行首 + Level 0**: Backspace 删除 bullet，保留文本
- **非行首**: Backspace 正常删除字符

**Tab/Shift+Tab 缩进**:
- Tab: 增加一级层级（最多 4 级）
- Shift+Tab: 减少一级层级

**Enter 自动继承**:
- 按 Enter 创建新段落
- 自动继承当前 bullet 和 bulletLevel
- 空 bullet 行按 Enter → 删除 bullet

**实现位置**: `LightSlateEditor.tsx` (L700-850)

#### 2.2.4 Preline 视觉

**设计目的**: 视觉化时间流，增强时间感知

**渲染规则**:
- Timestamp 后的段落左侧显示垂直灰线
- 多个段落连续显示，形成时间轴效果
- 不同 timestamp 组之间有 8px 间距
- 空段落（光标位置）也显示 preline，提供视觉反馈

**CSS 实现**:
```css
.paragraph-with-preline {
  position: relative;
  padding-left: 28px;
}

.paragraph-with-preline::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #d1d5db;
}
```

---

## 3. 数据流与架构

### 3.1 数据流图

```
┌─────────────────────────────────────────────────────────────┐
│ EventService                                                 │
│ event.eventlog (Slate JSON string)                          │
└─────────────────────────────────────────────────────────────┘
                       ↓ jsonToSlateNodes
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ LightSlateEditor State                                       │
│ value: Descendant[]                                          │
│  ├─ TimestampDividerNode                                    │
│  ├─ ParagraphNode (bullet, bulletLevel)                     │
│  ├─ ParagraphNode (bullet, bulletLevel)                     │
│  └─ ...                                                      │
└─────────────────────────────────────────────────────────────┘
                       ↓ onChange
                       ↓ slateNodesToJson
┌─────────────────────────────────────────────────────────────┐
│ Parent Component                                             │
│ onChange(slateJson: string)                                  │
└─────────────────────────────────────────────────────────────┘
                       ↓
┌─────────────────────────────────────────────────────────────┐
│ EventService                                                 │
│ EventService.updateEvent(id, { eventlog: slateJson })       │
└─────────────────────────────────────────────────────────────┘
```

### 3.2 序列化工具

#### jsonToSlateNodes

```typescript
export function jsonToSlateNodes(slateJson: string | any[] | undefined): Descendant[] {
  // 1. 处理空值
  if (!slateJson || (typeof slateJson === 'string' && !slateJson.trim())) {
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  
  // 2. 处理已是数组的情况
  if (Array.isArray(slateJson)) {
    return slateJson.length > 0 ? slateJson : [{ type: 'paragraph', children: [{ text: '' }] }];
  }
  
  // 3. 解析 JSON 字符串
  try {
    const parsed = JSON.parse(slateJson as string);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return [{ type: 'paragraph', children: [{ text: '' }] }];
    }
    
    // 4. 验证节点结构
    const isValid = parsed.every(node => 
      node.type && 
      Array.isArray(node.children) &&
      node.children.length > 0
    );
    
    return isValid ? parsed : [{ type: 'paragraph', children: [{ text: '' }] }];
  } catch (err) {
    console.error('[jsonToSlateNodes] 解析失败:', err);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
}
```

#### slateNodesToJson

```typescript
export function slateNodesToJson(nodes: Descendant[]): string {
  try {
    return JSON.stringify(nodes);
  } catch (err) {
    console.error('[slateNodesToJson] 序列化失败:', err);
    return '[]';
  }
}
```

### 3.3 props 接口

```typescript
export interface LightSlateEditorProps {
  /** Slate JSON 内容 (来自 event.eventlog) */
  content: string;
  
  /** 父事件 ID (用于 timestamp 上下文) */
  parentEventId: string;
  
  /** 内容变化回调 - 返回 Slate JSON 字符串 */
  onChange: (slateJson: string) => void;
  
  /** 是否启用 timestamp 自动插入 (默认 true) */
  enableTimestamp?: boolean;
  
  /** 占位符文本 (默认 '记录你的想法...') */
  placeholder?: string;
  
  /** CSS 类名 */
  className?: string;
  
  /** 是否只读 (默认 false) */
  readOnly?: boolean;
}
```

---

## 4. Timestamp 自动管理

### 4.1 核心逻辑

**TimestampService 职责**:
- 维护每个 contextId (parentEventId) 的最后编辑时间
- 判断是否应该插入新 timestamp（距上次 ≥ 5 分钟）
- 提供统一的 timestamp 插入接口

**关键方法**:
```typescript
class EventLogTimestampService {
  // 判断是否应该插入 timestamp
  shouldInsertTimestamp({ contextId, eventId }: TimestampContext): boolean;
  
  // 更新最后编辑时间
  updateLastEditTime(contextId: string, time: Date): void;
  
  // 清除上下文（事件删除时调用）
  clearContext(contextId: string): void;
}
```

### 4.2 自动插入时机

**时机 1: 用户聚焦编辑器 (handleFocus)**
```typescript
const handleFocus = useCallback(() => {
  if (!enableTimestamp || !parentEventId || !timestampServiceRef.current) return;
  
  // 检查是否应该插入 timestamp
  const shouldInsert = timestampServiceRef.current.shouldInsertTimestamp({
    contextId: parentEventId,
    eventId: parentEventId
  });
  
  if (!shouldInsert) return;
  
  // 检查是否有实际内容
  const hasContent = editor.children.some((node: any) => {
    if (node.type === 'paragraph') {
      return node.children?.some((child: any) => child.text?.trim());
    }
    return node.type !== 'paragraph';  // timestamp 等非段落节点算有内容
  });
  
  if (!hasContent) return;  // 空编辑器不插入
  
  // 在末尾插入 timestamp
  const timestampNode: TimestampDividerType = {
    type: 'timestamp-divider',
    timestamp: new Date().toISOString(),
    children: [{ text: '' }]
  };
  
  Transforms.insertNodes(editor, timestampNode as any, {
    at: [editor.children.length]
  });
  
  // 更新最后编辑时间
  timestampServiceRef.current.updateLastEditTime(parentEventId, new Date());
}, [editor, enableTimestamp, parentEventId]);
```

**时机 2: 首次编辑空内容 (useEffect)**
```typescript
useEffect(() => {
  if (!enableTimestamp || !parentEventId || !timestampServiceRef.current) return;
  if (contentLoadedRef.current) return;  // 已加载过，跳过
  
  // 检查是否有实际内容
  const hasActualContent = editor.children.some((node: any) => {
    if (node.type === 'paragraph') {
      return node.children?.some((child: any) => child.text?.trim());
    }
    return node.type !== 'paragraph';
  });
  
  if (!hasActualContent) {
    contentLoadedRef.current = true;
    return;  // 空内容不插入
  }
  
  // 检查是否已有 timestamp
  const hasTimestamp = editor.children.some((node: any) => 
    node.type === 'timestamp-divider'
  );
  
  if (hasTimestamp) {
    // 提取最后一个 timestamp，更新 timestampService
    const timestamps = editor.children.filter((node: any) => 
      node.type === 'timestamp-divider'
    );
    const lastTimestamp = timestamps[timestamps.length - 1] as any;
    timestampServiceRef.current.updateLastEditTime(
      parentEventId, 
      new Date(lastTimestamp.timestamp)
    );
    contentLoadedRef.current = true;
    return;
  }
  
  // 有内容但无 timestamp，插入首个 timestamp
  // 从 EventHistoryService 获取创建时间
  const createdTime = EventHistoryService.getCreatedTime(parentEventId);
  const timestampTime = createdTime || new Date();
  
  const timestampNode: TimestampDividerType = {
    type: 'timestamp-divider',
    timestamp: timestampTime.toISOString(),
    children: [{ text: '' }]
  };
  
  Editor.withoutNormalizing(editor, () => {
    Transforms.insertNodes(editor, timestampNode as any, { at: [0] });
  });
  
  timestampServiceRef.current.updateLastEditTime(parentEventId, timestampTime);
  contentLoadedRef.current = true;
}, [editor, enableTimestamp, parentEventId]);
```

### 4.3 自动清理机制

**时机: 失焦 (handleBlur)**
```typescript
const handleBlur = useCallback(() => {
  if (!enableTimestamp) return;
  
  Editor.withoutNormalizing(editor, () => {
    const nodesToRemove: Path[] = [];
    
    // 扫描所有 timestamp
    editor.children.forEach((node: any, index: number) => {
      if (node.type !== 'timestamp-divider') return;
      
      // 检查 timestamp 后是否有实际内容
      let hasContentAfter = false;
      for (let i = index + 1; i < editor.children.length; i++) {
        const nextNode = editor.children[i] as any;
        
        // 遇到下一个 timestamp，停止检查
        if (nextNode.type === 'timestamp-divider') break;
        
        // 检查段落是否有文本
        if (nextNode.type === 'paragraph') {
          const hasText = nextNode.children?.some((child: any) => 
            child.text && child.text.trim() !== ''
          );
          if (hasText) {
            hasContentAfter = true;
            break;
          }
        }
      }
      
      // 如果 timestamp 后没有内容，标记删除
      if (!hasContentAfter) {
        nodesToRemove.push([index]);
        
        // 同时删除 timestamp 后的空 bullet 段落
        for (let i = index + 1; i < editor.children.length; i++) {
          const nextNode = editor.children[i] as any;
          if (nextNode.type === 'timestamp-divider') break;
          if (nextNode.type === 'paragraph') {
            const isEmpty = !nextNode.children?.some((child: any) => 
              child.text && child.text.trim() !== ''
            );
            if (isEmpty && nextNode.bullet) {
              nodesToRemove.push([i]);
            }
          }
        }
      }
    });
    
    // 执行删除（从后往前，避免路径变化）
    nodesToRemove.reverse().forEach(path => {
      Transforms.removeNodes(editor, { at: path });
    });
  });
}, [editor, enableTimestamp]);
```

### 4.4 Timestamp 保护

**禁止用户删除 timestamp**:
```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  // ... 其他快捷键处理
  
  // 禁止删除 timestamp（Backspace/Delete）
  if (e.key === 'Backspace' || e.key === 'Delete') {
    const { selection } = editor;
    if (!selection) return;
    
    const [currentNode] = Editor.node(editor, selection.anchor.path);
    
    // 检测是否在尝试删除 timestamp
    if ((currentNode as any).type === 'timestamp-divider') {
      e.preventDefault();
      console.warn('⚠️ Timestamp 不可删除，只能由系统自动清理');
      return;
    }
  }
}, [editor]);
```

---

## 5. Bullet 操作系统

### 5.1 OneNote 风格删除机制

**设计理念**: 符合用户在 OneNote/Notion 中的操作习惯

**行为规则**:
```typescript
if (e.key === 'Backspace') {
  const { selection } = editor;
  if (!selection || !Range.isCollapsed(selection)) return;  // 有选区时正常删除
  
  const [currentNode, currentPath] = Editor.node(editor, selection.anchor.path);
  const paragraph = currentNode as any;
  
  // 检查是否在行首
  const isAtStart = selection.anchor.offset === 0;
  
  if (paragraph.type === 'paragraph' && paragraph.bullet && isAtStart) {
    e.preventDefault();
    
    const currentLevel = paragraph.bulletLevel || 0;
    
    if (currentLevel > 0) {
      // 行首 + Level > 0: 降低一级层级
      Transforms.setNodes(
        editor,
        { bulletLevel: currentLevel - 1 } as any,
        { at: currentPath }
      );
      console.log(`✅ Bullet 层级降低: ${currentLevel} → ${currentLevel - 1}`);
    } else {
      // 行首 + Level 0: 删除 bullet，保留文本
      Transforms.setNodes(
        editor,
        { bullet: false, bulletLevel: 0 } as any,
        { at: currentPath }
      );
      console.log('✅ 已删除 bullet，保留文本');
    }
    
    return;
  }
}
```

### 5.2 Tab/Shift+Tab 缩进管理

```typescript
// Tab: 增加层级
if (e.key === 'Tab' && !e.shiftKey) {
  e.preventDefault();
  
  const [currentNode, currentPath] = Editor.node(editor, selection.anchor.path);
  const paragraph = currentNode as any;
  
  if (paragraph.type === 'paragraph' && paragraph.bullet) {
    const currentLevel = paragraph.bulletLevel || 0;
    const newLevel = Math.min(currentLevel + 1, 4);  // 最多 4 级
    
    Transforms.setNodes(
      editor,
      { bulletLevel: newLevel } as any,
      { at: currentPath }
    );
    console.log(`✅ Bullet 层级增加: ${currentLevel} → ${newLevel}`);
  }
  
  return;
}

// Shift+Tab: 减少层级
if (e.key === 'Tab' && e.shiftKey) {
  e.preventDefault();
  
  const [currentNode, currentPath] = Editor.node(editor, selection.anchor.path);
  const paragraph = currentNode as any;
  
  if (paragraph.type === 'paragraph' && paragraph.bullet) {
    const currentLevel = paragraph.bulletLevel || 0;
    if (currentLevel > 0) {
      const newLevel = currentLevel - 1;
      
      Transforms.setNodes(
        editor,
        { bulletLevel: newLevel } as any,
        { at: currentPath }
      );
      console.log(`✅ Bullet 层级减少: ${currentLevel} → ${newLevel}`);
    }
  }
  
  return;
}
```

### 5.3 Enter 自动继承

```typescript
if (e.key === 'Enter') {
  const { selection } = editor;
  if (!selection) return;
  
  const [currentNode] = Editor.node(editor, selection.anchor.path);
  const paragraph = currentNode as any;
  
  if (paragraph.type === 'paragraph' && paragraph.bullet) {
    // 检查当前 bullet 行是否为空
    const isEmpty = !paragraph.children?.some((child: any) => 
      child.text && child.text.trim() !== ''
    );
    
    if (isEmpty) {
      // 空 bullet 行按 Enter → 删除 bullet，创建普通段落
      e.preventDefault();
      
      Transforms.setNodes(
        editor,
        { bullet: false, bulletLevel: 0 } as any,
        { at: selection.anchor.path }
      );
      
      Transforms.splitNodes(editor);
      return;
    }
    
    // 非空 bullet 行按 Enter → 继承 bullet 和 bulletLevel
    e.preventDefault();
    
    Transforms.splitNodes(editor);
    Transforms.setNodes(
      editor,
      { 
        bullet: true, 
        bulletLevel: paragraph.bulletLevel || 0 
      } as any
    );
    return;
  }
}
```

---

## 6. 段落移动功能

### 6.1 功能概览

**快捷键**: Shift+Alt+↑/↓  
**行为**: 交换当前段落与相邻段落的位置  
**特性**: 自动跳过 timestamp-divider 节点

### 6.2 实现详解

#### moveParagraphUp

```typescript
const moveParagraphUp = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;
  
  const [currentNode, currentPath] = Editor.node(editor, selection.anchor.path);
  const currentIndex = currentPath[0];
  
  // 边界检查：不能移动首行之前
  if (currentIndex === 0) {
    console.log('⚠️ 已是首行，无法上移');
    return;
  }
  
  // 查找上方第一个非 timestamp 节点
  let targetIndex = currentIndex - 1;
  while (targetIndex >= 0) {
    const targetNode = editor.children[targetIndex] as any;
    if (targetNode.type !== 'timestamp-divider') {
      break;
    }
    targetIndex--;
  }
  
  if (targetIndex < 0) {
    console.log('⚠️ 上方没有可交换的段落');
    return;
  }
  
  // 交换节点
  const targetNode = editor.children[targetIndex];
  
  Editor.withoutNormalizing(editor, () => {
    // 移除当前节点
    Transforms.removeNodes(editor, { at: [currentIndex] });
    
    // 在目标位置插入当前节点
    Transforms.insertNodes(editor, currentNode as any, { at: [targetIndex] });
    
    // 在原位置插入目标节点
    Transforms.insertNodes(editor, targetNode as any, { at: [currentIndex] });
    
    // 恢复光标位置
    Transforms.select(editor, {
      anchor: { path: [targetIndex, 0], offset: 0 },
      focus: { path: [targetIndex, 0], offset: 0 }
    });
  });
  
  console.log(`✅ 段落已上移: ${currentIndex} → ${targetIndex}`);
}, [editor]);
```

#### moveParagraphDown

```typescript
const moveParagraphDown = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;
  
  const [currentNode, currentPath] = Editor.node(editor, selection.anchor.path);
  const currentIndex = currentPath[0];
  
  // 边界检查：不能移动末行之后
  if (currentIndex >= editor.children.length - 1) {
    console.log('⚠️ 已是末行，无法下移');
    return;
  }
  
  // 查找下方第一个非 timestamp 节点
  let targetIndex = currentIndex + 1;
  while (targetIndex < editor.children.length) {
    const targetNode = editor.children[targetIndex] as any;
    if (targetNode.type !== 'timestamp-divider') {
      break;
    }
    targetIndex++;
  }
  
  if (targetIndex >= editor.children.length) {
    console.log('⚠️ 下方没有可交换的段落');
    return;
  }
  
  // 交换节点
  const targetNode = editor.children[targetIndex];
  
  Editor.withoutNormalizing(editor, () => {
    // 移除目标节点
    Transforms.removeNodes(editor, { at: [targetIndex] });
    
    // 在当前位置插入目标节点
    Transforms.insertNodes(editor, targetNode as any, { at: [currentIndex] });
    
    // 移除当前节点（路径已变化）
    Transforms.removeNodes(editor, { at: [currentIndex + 1] });
    
    // 在目标位置插入当前节点
    Transforms.insertNodes(editor, currentNode as any, { at: [targetIndex] });
    
    // 恢复光标位置
    Transforms.select(editor, {
      anchor: { path: [targetIndex, 0], offset: 0 },
      focus: { path: [targetIndex, 0], offset: 0 }
    });
  });
  
  console.log(`✅ 段落已下移: ${currentIndex} → ${targetIndex}`);
}, [editor]);
```

### 6.3 快捷键集成

```typescript
const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
  // Shift+Alt+↑: 段落上移
  if (e.shiftKey && e.altKey && e.key === 'ArrowUp') {
    e.preventDefault();
    moveParagraphUp();
    return;
  }
  
  // Shift+Alt+↓: 段落下移
  if (e.shiftKey && e.altKey && e.key === 'ArrowDown') {
    e.preventDefault();
    moveParagraphDown();
    return;
  }
  
  // ... 其他快捷键
}, [editor, moveParagraphUp, moveParagraphDown]);
```

---

## 7. 使用场景

### 7.1 EventEditModal 实际进展区域

**集成位置**: `src/components/EventEditModal/EventEditModalV2.tsx`

**使用示例**:
```typescript
<LightSlateEditor
  content={event.eventlog || ''}
  parentEventId={event.id}
  onChange={(slateJson) => {
    // 更新本地状态
    setFormData(prev => ({ ...prev, eventlog: slateJson }));
  }}
  enableTimestamp={true}
  placeholder="记录实际进展..."
  className="actual-progress-editor"
/>
```

**特性**:
- ✅ Timestamp 自动插入（5分钟间隔）
- ✅ Preline 时间轴展示
- ✅ Bullet 支持多层级笔记
- ✅ 段落移动快捷键

**详见**: [EVENTEDITMODAL_V2_PRD.md](./EVENTEDITMODAL_V2_PRD.md) - 实际进展章节

### 7.2 未来 TimeLog 页面（待开发）

**规划**: TimeLog 页面是 Event 集合的时间轴展示页面

**使用场景**:
- 左侧：智能搜索 + 日历选择器 + 标签/事件/收藏选择器
- 右侧：时间轴展示所有 Events，每个 Event 卡片使用 LightSlateEditor

**使用示例**:
```typescript
<div className="timelog-page">
  <aside className="timelog-sidebar">
    {/* 搜索、日历、过滤器 */}
  </aside>
  
  <main className="timelog-timeline">
    {events.map(event => (
      <div key={event.id} className="event-card">
        <header>
          <h3>{event.title}</h3>
          <span>{formatTime(event.startTime, event.endTime)}</span>
        </header>
        
        {/* 使用 LightSlateEditor 显示 eventlog */}
        <LightSlateEditor
          content={event.eventlog || ''}
          parentEventId={event.id}
          onChange={(slateJson) => {
            EventService.updateEvent(event.id, { eventlog: slateJson });
          }}
          enableTimestamp={true}
          placeholder="添加时间日志..."
        />
      </div>
    ))}
  </main>
</div>
```

**特性**:
- ✅ 复用 LightSlateEditor，无需重新开发编辑器
- ✅ 所有核心功能开箱即用（timestamp、bullet、段落移动）
- ✅ 未来扩展功能（图片、语音）可从 SlateCore 共享层获取

**详见**: [TimeLog_&_Description_PRD.md](./TimeLog_&_Description_PRD.md)

### 7.3 其他潜在场景

- **NotesEditor**: 笔记编辑器（简化版，去除 timestamp）
- **CommentEditor**: 评论编辑器（极简版，去除 bullet）
- **RichTextModal**: 通用富文本弹窗（完整功能）

---

## 8. API 文档

### 8.1 Props

| Prop | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| `content` | `string` | ✅ | - | Slate JSON 内容（来自 `event.eventlog`） |
| `parentEventId` | `string` | ✅ | - | 父事件 ID（用于 timestamp 上下文） |
| `onChange` | `(slateJson: string) => void` | ✅ | - | 内容变化回调，返回 Slate JSON 字符串 |
| `enableTimestamp` | `boolean` | ❌ | `true` | 是否启用 timestamp 自动插入 |
| `placeholder` | `string` | ❌ | `'记录你的想法...'` | 占位符文本 |
| `className` | `string` | ❌ | - | CSS 类名 |
| `readOnly` | `boolean` | ❌ | `false` | 是否只读 |

### 8.2 快捷键

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Shift+Alt+↑` | 段落上移 | 与上方段落交换位置，跳过 timestamp |
| `Shift+Alt+↓` | 段落下移 | 与下方段落交换位置，跳过 timestamp |
| `Tab` | 增加 bullet 层级 | Bullet 段落缩进一级（最多 4 级） |
| `Shift+Tab` | 减少 bullet 层级 | Bullet 段落退出一级 |
| `Backspace` (行首 + Level > 0) | 降低 bullet 层级 | OneNote 风格 |
| `Backspace` (行首 + Level 0) | 删除 bullet | 保留文本，取消 bullet |
| `Enter` (空 bullet 行) | 取消 bullet | 创建普通段落 |
| `Enter` (非空 bullet 行) | 继承 bullet | 新段落继承 bullet 和层级 |

### 8.3 导出接口

```typescript
// 序列化工具
export { jsonToSlateNodes, slateNodesToJson } from './serialization';

// 编辑器组件
export { LightSlateEditor, type LightSlateEditorProps } from './LightSlateEditor';
```

---

## 9. 未来扩展

### 9.1 SlateCore 共享层集成

**目标**: 提炼共性功能到 `SlateCore` 共享层，支持未来复杂功能

**重构计划**:
- 段落操作工具 → `SlateCore/operations/paragraphOperations.ts`
- Bullet 操作工具 → `SlateCore/operations/bulletOperations.ts`
- Timestamp 服务 → `SlateCore/services/timestampService.ts`
- 序列化工具 → `SlateCore/serialization/jsonSerializer.ts`

**详见**: [SLATE_EDITOR_ARCHITECTURE.md](./SLATE_EDITOR_ARCHITECTURE.md)

### 9.2 图片支持

**需求**: 支持插入图片、预览、缩放、裁剪

**实现方案**:
```typescript
// SlateCore/future/imageOperations.ts
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
```

**节点类型**:
```typescript
interface ImageNode extends CustomElement {
  type: 'image',
  url: string,
  width?: number,
  height?: number,
  alt?: string,
  children: [{ text: '' }]
}
```

### 9.3 语音支持

**需求**: 支持语音录制、播放、语音转文字

**实现方案**:
```typescript
// SlateCore/future/audioOperations.ts
export function insertAudio(
  editor: Editor,
  audioUrl: string,
  duration: number,
  transcript?: string
): boolean;

export function recordAudio(): Promise<AudioRecording>;
export function transcribeAudio(audioUrl: string): Promise<string>;
```

**节点类型**:
```typescript
interface AudioNode extends CustomElement {
  type: 'audio',
  url: string,
  duration: number,
  transcript?: string,
  children: [{ text: '' }]
}
```

### 9.4 扩展 Mention

**需求**: 支持 @人员、@文件、@链接 等多种提及类型

**实现方案**:
```typescript
// SlateCore/future/mentionOperations.ts
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

**节点类型**:
```typescript
interface PersonMentionNode extends CustomElement {
  type: 'person-mention',
  personId: string,
  personName: string,
  children: [{ text: '' }]
}

interface FileMentionNode extends CustomElement {
  type: 'file-mention',
  fileId: string,
  fileName: string,
  fileType: string,
  children: [{ text: '' }]
}

interface LinkMentionNode extends CustomElement {
  type: 'link-mention',
  url: string,
  title?: string,
  children: [{ text: '' }]
}
```

---

## 10. 总结

### 10.1 核心优势

- ✅ **简单直观**: 扁平段落结构，易于理解和使用
- ✅ **自动化**: Timestamp 自动管理，用户无感知
- ✅ **高度可复用**: 支持多种使用场景（EventEditModal、TimeLog）
- ✅ **直觉操作**: OneNote 风格 bullet 删除，符合用户习惯
- ✅ **高效编辑**: 段落移动快捷键，快速调整内容顺序
- ✅ **可扩展**: 为未来图片、语音、扩展 mention 等功能预留空间

### 10.2 关键设计决策

1. **扁平结构 vs 嵌套结构**: 选择扁平结构，降低复杂度
2. **Timestamp 自动化 vs 手动插入**: 选择自动化，提升用户体验
3. **OneNote 风格 vs 自定义逻辑**: 选择 OneNote 风格，符合习惯
4. **单层序列化 vs 多层转换**: 选择单层序列化，简化数据流

### 10.3 未来方向

- 🚀 **SlateCore 共享层**: 提炼共性功能，支持更多编辑器
- 🎨 **复杂元素支持**: 图片、语音、扩展 mention
- 📊 **性能优化**: 大文档渲染优化、虚拟滚动
- 🔌 **插件系统**: 表格、LaTeX、代码高亮等插件化功能

---

**文档版本**: v1.0  
**最后更新**: 2025-11-28  
**作者**: GitHub Copilot  
**审核状态**: ✅ 已完成功能实现  
