# Shift+Alt+↑/↓ 段落移动功能实现方案

> **版本**: v1.0  
> **创建时间**: 2025-11-28  
> **目标组件**: LightSlateEditor, UnifiedSlateEditor  
> **参考实现**: TagManager.tsx, Microsoft Word/OneNote

---

## 📋 需求概述

### 功能描述

在 LightSlateEditor 和 UnifiedSlateEditor 中实现 `Shift+Alt+↑/↓` 快捷键，用于调整当前段落/行/bulletpoint 的上下位置。

### 用户场景

1. **重新组织内容**: 用户编写 Event Log 时，需要调整段落顺序
2. **调整 bullet 层级**: 移动 bullet 时保持或调整其层级关系
3. **快速编辑**: 无需鼠标拖拽，仅用键盘快速调整结构

### 参考实现

#### Microsoft Word/OneNote
- `Alt+Shift+↑`: 将当前段落向上移动一行
- `Alt+Shift+↓`: 将当前段落向下移动一行
- 移动时保持段落格式（粗体、斜体、缩进等）
- 支持多行选中批量移动

#### TagManager (ReMarkable 现有实现)
- `Shift+Alt+↑`: 向上移动标签，自动调整 position 和 level
- `Shift+Alt+↓`: 向下移动标签，验证并修复 position 冲突
- 交换相邻元素的位置值，保持排序一致性

---

## 🏗️ 架构设计

### 核心原理

Slate.js 使用 **不可变数据结构** 管理文档树，段落移动的本质是：

1. **查找**: 定位当前段落在 children 数组中的索引
2. **验证**: 检查是否可以移动（边界检查）
3. **交换**: 使用 Slate Transform API 交换节点位置
4. **保持选区**: 移动后光标跟随到新位置

### Slate Transform API

```typescript
// 移动节点的核心 API
Transforms.moveNodes(editor, {
  at: path,        // 要移动的节点路径
  to: targetPath   // 目标路径
});

// 或者使用更底层的删除+插入
Transforms.removeNodes(editor, { at: sourcePath });
Transforms.insertNodes(editor, nodes, { at: targetPath });
```

### 数据结构

```typescript
// Slate 文档结构
{
  children: [
    { type: 'paragraph', bullet: true, bulletLevel: 0, children: [...] },  // Index 0
    { type: 'paragraph', bullet: true, bulletLevel: 1, children: [...] },  // Index 1
    { type: 'timestamp-divider', ... },                                    // Index 2
    { type: 'paragraph', bullet: false, children: [...] },                 // Index 3
  ]
}
```

---

## 🔧 实现方案

### 方案 A: Slate 原生 moveNodes (推荐)

**优点**:
- ✅ 使用 Slate 官方 API，符合最佳实践
- ✅ 自动处理选区更新和历史记录
- ✅ 性能最优，单次操作

**缺点**:
- ⚠️ 需要理解 Slate 路径系统
- ⚠️ 跨越 void 节点（timestamp）时需要特殊处理

**实现代码**:

```typescript
// LightSlateEditor.tsx

/**
 * 向上移动当前段落
 * 遵循 Microsoft Word 行为：与上一个段落交换位置
 */
const moveParagraphUp = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;

  // 1. 获取当前段落节点和路径
  const [currentParagraph] = Editor.nodes(editor, {
    match: (n: any) => 
      !Editor.isEditor(n) && 
      SlateElement.isElement(n) && 
      n.type === 'paragraph',
  });

  if (!currentParagraph) {
    console.warn('[moveParagraphUp] 当前不在段落节点中');
    return;
  }

  const [node, path] = currentParagraph;
  const currentIndex = path[0]; // 顶层节点的索引

  // 2. 边界检查：已经是第一个段落
  if (currentIndex === 0) {
    console.log('[moveParagraphUp] 已经在第一行，无法上移');
    return;
  }

  // 3. 查找上一个可移动的段落（跳过 void 节点）
  let targetIndex = currentIndex - 1;
  let targetNode = editor.children[targetIndex];

  // 跳过 void 节点（timestamp-divider 等）
  while (targetIndex > 0 && Editor.isVoid(editor, targetNode as any)) {
    targetIndex--;
    targetNode = editor.children[targetIndex];
  }

  // 如果上一个节点是 void，无法移动
  if (Editor.isVoid(editor, targetNode as any)) {
    console.log('[moveParagraphUp] 上方是不可移动的节点（如 timestamp）');
    return;
  }

  // 4. 执行移动：将当前节点移动到目标位置
  Transforms.moveNodes(editor, {
    at: [currentIndex],
    to: [targetIndex]
  });

  // 5. 更新选区：光标跟随到新位置
  const newPath = [targetIndex];
  Transforms.select(editor, {
    anchor: { path: [...newPath, 0], offset: 0 },
    focus: { path: [...newPath, 0], offset: 0 }
  });

  console.log('[moveParagraphUp] ✅ 段落已上移:', {
    from: currentIndex,
    to: targetIndex
  });
}, [editor]);

/**
 * 向下移动当前段落
 */
const moveParagraphDown = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;

  // 1. 获取当前段落节点和路径
  const [currentParagraph] = Editor.nodes(editor, {
    match: (n: any) => 
      !Editor.isEditor(n) && 
      SlateElement.isElement(n) && 
      n.type === 'paragraph',
  });

  if (!currentParagraph) {
    console.warn('[moveParagraphDown] 当前不在段落节点中');
    return;
  }

  const [node, path] = currentParagraph;
  const currentIndex = path[0];

  // 2. 边界检查：已经是最后一个段落
  if (currentIndex >= editor.children.length - 1) {
    console.log('[moveParagraphDown] 已经在最后一行，无法下移');
    return;
  }

  // 3. 查找下一个可移动的段落（跳过 void 节点）
  let targetIndex = currentIndex + 1;
  let targetNode = editor.children[targetIndex];

  // 跳过 void 节点
  while (targetIndex < editor.children.length - 1 && Editor.isVoid(editor, targetNode as any)) {
    targetIndex++;
    targetNode = editor.children[targetIndex];
  }

  // 如果下一个节点是 void，无法移动
  if (Editor.isVoid(editor, targetNode as any)) {
    console.log('[moveParagraphDown] 下方是不可移动的节点（如 timestamp）');
    return;
  }

  // 4. 执行移动
  // 注意：向下移动时，目标路径需要 +1（因为是插入到目标节点后面）
  Transforms.moveNodes(editor, {
    at: [currentIndex],
    to: [targetIndex + 1]
  });

  // 5. 更新选区
  const newPath = [targetIndex + 1];
  Transforms.select(editor, {
    anchor: { path: [...newPath, 0], offset: 0 },
    focus: { path: [...newPath, 0], offset: 0 }
  });

  console.log('[moveParagraphDown] ✅ 段落已下移:', {
    from: currentIndex,
    to: targetIndex + 1
  });
}, [editor]);

// 在 handleKeyDown 中添加快捷键
const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
  // ... 现有代码 ...

  // 🆕 Shift+Alt+↑/↓: 移动段落
  if (event.shiftKey && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
    event.preventDefault();
    
    if (event.key === 'ArrowUp') {
      moveParagraphUp();
    } else {
      moveParagraphDown();
    }
    return;
  }

  // ... 现有代码 ...
}, [editor, moveParagraphUp, moveParagraphDown]);
```

---

### 方案 B: 手动交换节点 (备选)

**适用场景**: 需要更精细的控制（例如调整 bullet 层级）

**实现代码**:

```typescript
const moveParagraphUp = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;

  const [currentParagraph] = Editor.nodes(editor, {
    match: (n: any) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'paragraph',
  });

  if (!currentParagraph) return;

  const [currentNode, currentPath] = currentParagraph;
  const currentIndex = currentPath[0];

  if (currentIndex === 0) return;

  // 获取上一个节点
  const previousIndex = currentIndex - 1;
  const previousNode = editor.children[previousIndex] as any;

  // 跳过 void 节点
  if (Editor.isVoid(editor, previousNode)) {
    console.log('[moveParagraphUp] 无法与 void 节点交换');
    return;
  }

  // 🎯 层级调整逻辑（可选）
  const currentBullet = (currentNode as any).bullet;
  const currentLevel = (currentNode as any).bulletLevel || 0;
  const previousLevel = previousNode.bulletLevel || 0;

  // 如果当前是 bullet，移动后层级不能超过新上方节点的层级+1
  let adjustedLevel = currentLevel;
  if (currentBullet && currentLevel > previousLevel + 1) {
    adjustedLevel = previousLevel + 1;
    console.log('[moveParagraphUp] 调整层级:', currentLevel, '→', adjustedLevel);
  }

  // 执行交换：删除当前节点 → 插入到上方
  Editor.withoutNormalizing(editor, () => {
    // 1. 删除当前节点
    Transforms.removeNodes(editor, { at: [currentIndex] });

    // 2. 插入到目标位置
    const nodeToInsert = {
      ...currentNode,
      bulletLevel: adjustedLevel
    };
    Transforms.insertNodes(editor, nodeToInsert as any, { at: [previousIndex] });

    // 3. 更新选区
    Transforms.select(editor, {
      anchor: { path: [previousIndex, 0], offset: 0 },
      focus: { path: [previousIndex, 0], offset: 0 }
    });
  });

  console.log('[moveParagraphUp] ✅ 段落已上移并调整层级');
}, [editor]);
```

---

## 🎯 特殊场景处理

### 1. Timestamp 分隔线

**问题**: `timestamp-divider` 是 void 节点，不能移动，也不能被跨越

**解决方案**:
```typescript
// 检测 void 节点并跳过
while (targetIndex > 0 && Editor.isVoid(editor, targetNode as any)) {
  targetIndex--;
  targetNode = editor.children[targetIndex];
}

// 如果无可移动的目标，提示用户
if (Editor.isVoid(editor, targetNode as any)) {
  console.log('[moveParagraph] 无法跨越 timestamp 分隔线');
  return;
}
```

**用户体验**:
- ✅ 段落移动时自动跳过 timestamp
- ✅ 如果上方/下方只有 timestamp，不执行移动
- ⚠️ 未来可考虑：将 timestamp 也一起移动（作为一个组）

### 2. Bullet 层级约束

**规则**:
- 子 bullet 的层级不能超过父 bullet 层级 +1
- 移动到第一行时，强制设为 Level 0
- 移动后检查并调整不合法的层级

**实现**:
```typescript
// 向上移动时的层级调整
if (currentBullet) {
  const newPreviousNode = editor.children[targetIndex - 1] as any;
  const newPreviousLevel = newPreviousNode?.bulletLevel || 0;
  
  // 确保层级合法
  adjustedLevel = Math.min(currentLevel, newPreviousLevel + 1);
  
  // 特殊情况：移动到第一行
  if (targetIndex === 0) {
    adjustedLevel = 0;
  }
}
```

### 3. 多行选中批量移动

**阶段 1 (MVP)**: 仅支持单行移动

**阶段 2 (扩展)**: 支持多行选中批量移动

```typescript
const moveParagraphsUp = useCallback(() => {
  const { selection } = editor;
  if (!selection) return;

  // 获取选中范围内的所有段落
  const paragraphs = Array.from(
    Editor.nodes(editor, {
      at: selection,
      match: (n: any) => !Editor.isEditor(n) && SlateElement.isElement(n) && n.type === 'paragraph',
    })
  );

  if (paragraphs.length === 0) return;

  // 检查是否可以整体上移
  const firstPath = paragraphs[0][1];
  const firstIndex = firstPath[0];
  
  if (firstIndex === 0) {
    console.log('[moveParagraphsUp] 已经在顶部，无法上移');
    return;
  }

  // 批量移动：从前往后依次上移
  Editor.withoutNormalizing(editor, () => {
    paragraphs.forEach(([node, path], index) => {
      const currentIndex = path[0];
      const targetIndex = currentIndex - 1;
      
      Transforms.moveNodes(editor, {
        at: [currentIndex - index], // 修正索引偏移
        to: [targetIndex - index]
      });
    });
  });

  console.log(`[moveParagraphsUp] ✅ 批量上移 ${paragraphs.length} 个段落`);
}, [editor]);
```

---

## 📊 实现步骤

### Phase 1: LightSlateEditor (核心实现)

#### Step 1: 添加移动函数 (2h)
- [ ] 实现 `moveParagraphUp` 函数
- [ ] 实现 `moveParagraphDown` 函数
- [ ] 添加边界检查和 void 节点跳过逻辑

#### Step 2: 快捷键集成 (1h)
- [ ] 在 `handleKeyDown` 中添加 `Shift+Alt+↑/↓` 检测
- [ ] 测试快捷键冲突（与浏览器默认行为）

#### Step 3: 测试验证 (2h)
- [ ] 测试普通段落移动
- [ ] 测试 bullet 段落移动
- [ ] 测试跨越 timestamp 的场景
- [ ] 测试边界情况（第一行/最后一行）

### Phase 2: UnifiedSlateEditor (扩展实现)

#### Step 1: 代码复用 (1h)
- [ ] 将移动逻辑提取为独立工具函数 `moveParagraph(editor, direction)`
- [ ] 放置在 `src/components/UnifiedSlateEditor/helpers.ts`

#### Step 2: 集成到 UnifiedSlateEditor (1h)
- [ ] 在 UnifiedSlateEditor 的 `handleKeyDown` 中调用移动函数
- [ ] 测试与 LightSlateEditor 行为一致性

### Phase 3: 高级功能 (可选)

#### 扩展 1: 多行批量移动 (3h)
- [ ] 实现 `moveParagraphsUp/Down` 支持选区批量移动
- [ ] 添加选区范围检测和边界检查

#### 扩展 2: 可视化反馈 (2h)
- [ ] 移动时添加过渡动画（CSS transition）
- [ ] 添加移动成功/失败的视觉提示

#### 扩展 3: 撤销/重做支持 (已自动支持)
- Slate 自动记录历史，`Ctrl+Z` 可撤销移动

---

## 🧪 测试用例

### 基础功能测试

| 用例ID | 场景描述 | 操作 | 预期结果 |
|--------|---------|------|----------|
| T1 | 普通段落上移 | 光标在第2段，按 `Shift+Alt+↑` | 第2段移到第1段位置 |
| T2 | 普通段落下移 | 光标在第1段，按 `Shift+Alt+↓` | 第1段移到第2段位置 |
| T3 | 第一行上移 | 光标在第1段，按 `Shift+Alt+↑` | 无变化，控制台提示 |
| T4 | 最后一行下移 | 光标在最后段，按 `Shift+Alt+↓` | 无变化，控制台提示 |

### Bullet 测试

| 用例ID | 场景描述 | 操作 | 预期结果 |
|--------|---------|------|----------|
| B1 | Bullet 段落上移 | Level 1 bullet 上移 | 移动后层级自动调整 |
| B2 | Bullet 段落下移 | Level 0 bullet 下移 | 移动后层级保持合法 |
| B3 | 移动到第一行 | Bullet 上移到第一行 | 强制设为 Level 0 |

### Timestamp 测试

| 用例ID | 场景描述 | 操作 | 预期结果 |
|--------|---------|------|----------|
| T1 | Timestamp 上方段落 | 光标在 timestamp 上方，按 `Shift+Alt+↓` | 自动跳过 timestamp |
| T2 | Timestamp 下方段落 | 光标在 timestamp 下方，按 `Shift+Alt+↑` | 自动跳过 timestamp |
| T3 | 只有 Timestamp | 上下都是 timestamp | 无法移动，控制台提示 |

### 边界情况测试

| 用例ID | 场景描述 | 操作 | 预期结果 |
|--------|---------|------|----------|
| E1 | 空编辑器 | 按 `Shift+Alt+↑` | 无操作，不报错 |
| E2 | 只有一行 | 按 `Shift+Alt+↓` | 无操作，控制台提示 |
| E3 | 无选区 | 失焦状态按快捷键 | 无操作，不报错 |

---

## 📝 代码清单

### 修改文件

1. **src/components/LightSlateEditor/LightSlateEditor.tsx**
   - 添加 `moveParagraphUp` 函数 (~50 行)
   - 添加 `moveParagraphDown` 函数 (~50 行)
   - 修改 `handleKeyDown` 添加快捷键 (~10 行)
   - 总计: ~110 行

2. **src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx**
   - 调用共享的移动函数 (~5 行)
   - 修改 `handleKeyDown` 添加快捷键 (~10 行)
   - 总计: ~15 行

3. **src/components/UnifiedSlateEditor/helpers.ts** (新增)
   - 提取共享的 `moveParagraph` 工具函数 (~80 行)

### 文档更新

1. **docs/PRD/EVENTEDITMODAL_V2_PRD.md**
   - 更新键盘快捷键章节
   - 添加 `Shift+Alt+↑/↓` 说明

2. **CHANGELOG.md**
   - 记录新功能发布

3. **SHIFT_ALT_ARROW_MOVE_IMPLEMENTATION.md** (本文档)
   - 详细实现方案

---

## 🎯 成功标准

### 功能完整性
- ✅ LightSlateEditor 支持 `Shift+Alt+↑/↓` 移动段落
- ✅ UnifiedSlateEditor 支持 `Shift+Alt+↑/↓` 移动段落
- ✅ 自动跳过 void 节点（timestamp）
- ✅ Bullet 层级自动调整
- ✅ 边界检查（第一行/最后一行）

### 用户体验
- ✅ 响应速度 < 100ms
- ✅ 光标跟随到新位置
- ✅ 移动后可以立即撤销 (Ctrl+Z)
- ✅ 不干扰其他键盘快捷键

### 代码质量
- ✅ 符合 Slate.js 最佳实践
- ✅ 使用 TypeScript 类型安全
- ✅ 添加详细的 console.log 调试日志
- ✅ 通过所有测试用例

---

## 📚 参考资料

### Slate.js 官方文档
- [Transforms API](https://docs.slatejs.org/api/transforms)
- [moveNodes](https://docs.slatejs.org/api/transforms/node#moveNodes)
- [Editor.isVoid](https://docs.slatejs.org/api/nodes/editor#isvoid)

### Microsoft 快捷键规范
- [Word 键盘快捷键](https://support.microsoft.com/en-us/office/keyboard-shortcuts-in-word-95ef89dd-7142-4b50-afb2-f762f663ceb2)
- Alt+Shift+↑/↓: 移动段落

### ReMarkable 现有实现
- `TagManager.tsx` (L1578-1750): Shift+Alt+↑/↓ 移动标签
- 参考交换逻辑、层级调整和边界检查

---

## 🚀 下一步行动

### 立即开始 (今天)
1. ✅ 在 LightSlateEditor 中实现 `moveParagraphUp` 和 `moveParagraphDown`
2. ✅ 测试基础功能（普通段落移动）
3. ✅ 测试 Timestamp 跳过逻辑

### 本周完成
1. ✅ 完成 UnifiedSlateEditor 集成（双模式移动）
2. ⏳ 完成所有测试用例
3. ✅ 更新相关文档

### 未来优化
1. 支持多行批量移动
2. 添加移动动画效果
3. 优化 Bullet 层级调整算法

---

## 🎯 UnifiedSlateEditor 特殊实现

### 节点结构差异

UnifiedSlateEditor 使用 `EventLineNode`，包含两种模式：

```typescript
interface EventLineNode {
  type: 'event-line';
  eventId?: string;        // 关联的 Event ID
  lineId: string;          // 行唯一ID
  level: number;           // 缩进层级
  mode: 'title' | 'eventlog';  // 标题行 vs 日志内容
  children: ParagraphNode[];
  metadata?: EventMetadata;
}
```

### 双模式移动逻辑

#### 1. 标题移动（mode='title'）

**行为**: 移动整个事件组（标题 + 所有关联的 eventlog 段落）

```typescript
function moveTitleWithEventlogs(editor, titleLineIndex, direction) {
  // 1. 找到该标题的所有 eventlog 行（相同 eventId）
  const relatedEventlogs = findRelatedEventlogs(titleLineIndex);
  
  // 2. 批量移动整个事件组
  const eventGroupIndices = [titleLineIndex, ...relatedEventlogs];
  
  // 3. 计算目标位置（跳过其他事件的 eventlog 行）
  const targetIndex = direction === 'up' 
    ? findPreviousTitleIndex(titleLineIndex)
    : titleLineIndex + eventGroupIndices.length + nextEventGroupSize;
  
  // 4. 移动节点并恢复光标
  Editor.withoutNormalizing(editor, () => {
    // 提取 → 删除 → 插入 → 恢复光标
  });
}
```

**边界检查**:
- 向上移动：不能移动到第一行之前
- 向下移动：不能移动到 placeholder 之后
- 保持事件组的完整性和相对顺序

#### 2. EventLog 段落移动（mode='eventlog'）

**行为**: 只移动当前 eventlog 段落，标题不跟随

```typescript
function moveEventlogParagraph(editor, eventlogLineIndex, direction) {
  // 1. 找到相邻的目标行
  const targetIndex = direction === 'up' 
    ? eventlogLineIndex - 1 
    : eventlogLineIndex + 1;
  
  // 2. 验证目标位置
  if (targetLine.mode === 'title') {
    console.log('无法移动到标题行之前/其他事件的标题行后');
    return;
  }
  
  // 3. 交换节点位置
  Editor.withoutNormalizing(editor, () => {
    // 删除两个节点 → 重新插入 → 恢复光标
  });
}
```

**边界检查**:
- 不能移动到标题行之前
- 不能移动到其他事件的标题行之后
- 不能移动到 placeholder 之后

### 键盘事件处理

```typescript
if (event.shiftKey && event.altKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
  event.preventDefault();
  
  const eventLine = getCurrentEventLine(editor);
  const direction = event.key === 'ArrowUp' ? 'up' : 'down';
  
  // 根据 mode 决定移动逻辑
  if (eventLine.mode === 'title') {
    moveTitleWithEventlogs(editor, currentPath[0], direction);
  } else {
    moveEventlogParagraph(editor, currentPath[0], direction);
  }
}
```

### 用户体验设计

| 场景 | 操作 | 行为 | 用途 |
|------|------|------|------|
| 标题行 | Shift+Alt+↑/↓ | 移动整个事件（标题 + 所有 eventlog） | 调整事件顺序 |
| EventLog 行 | Shift+Alt+↑/↓ | 只移动当前段落 | 重新组织日志内容 |
| 边界保护 | 任意移动 | 自动检测并阻止非法操作 | 防止破坏文档结构 |

### 测试用例（UnifiedSlateEditor 特有）

```typescript
// TC-15: 标题移动带动 eventlog
const initialValue = [
  { mode: 'title', eventId: 'e1', children: [{ text: '事件A' }] },
  { mode: 'eventlog', eventId: 'e1', children: [{ text: 'A的日志1' }] },
  { mode: 'eventlog', eventId: 'e1', children: [{ text: 'A的日志2' }] },
  { mode: 'title', eventId: 'e2', children: [{ text: '事件B' }] },
  { mode: 'eventlog', eventId: 'e2', children: [{ text: 'B的日志' }] },
];

// 在"事件A"按 Shift+Alt+↓
// 预期结果：整个事件A（3行）移动到事件B之后
const expectedValue = [
  { mode: 'title', eventId: 'e2', children: [{ text: '事件B' }] },
  { mode: 'eventlog', eventId: 'e2', children: [{ text: 'B的日志' }] },
  { mode: 'title', eventId: 'e1', children: [{ text: '事件A' }] },
  { mode: 'eventlog', eventId: 'e1', children: [{ text: 'A的日志1' }] },
  { mode: 'eventlog', eventId: 'e1', children: [{ text: 'A的日志2' }] },
];

// TC-16: EventLog 移动不影响标题
// 在"A的日志2"按 Shift+Alt+↑
// 预期结果：只有"A的日志2"和"A的日志1"交换位置

// TC-17: EventLog 不能移动到标题行之前
// 在"A的日志1"按 Shift+Alt+↑
// 预期结果：控制台警告，操作被阻止
```

---

**实现优先级**: P1 (高优先级)  
**实际工时**: 8 小时（已完成）  
**风险评估**: 低（Slate API 成熟，有 TagManager 参考实现）

**实现状态**:
- ✅ LightSlateEditor - 已完成（2025-11-28）
  - moveParagraphUp/Down 函数
  - Shift+Alt+↑/↓ 快捷键
  - Timestamp 自动跳过
  - 边界保护
- ✅ UnifiedSlateEditor - 已完成（2025-11-28）
  - moveTitleWithEventlogs 函数
  - moveEventlogParagraph 函数
  - 双模式移动逻辑
  - 事件完整性保护
- ⏳ 完整测试验证 - 进行中
