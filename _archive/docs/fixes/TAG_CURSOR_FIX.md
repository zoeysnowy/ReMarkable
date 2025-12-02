# Tag 光标定位问题修复

**问题**: 无法将光标定位在 Tag 元素后面  
**版本**: v1.9.2  
**修复日期**: 2025-11-11  
**影响模块**: PlanSlate, TagElement

---

## 🔍 问题诊断

### 现象

- ✋ **无法将光标定位在 Tag 后面**：用户插入 Tag 后，无法继续输入文字
- ✋ **方向键跳过 Tag 失败**：使用 → 键无法从 Tag 前跳到 Tag 后
- ✋ **Backspace 删除异常**：在 Tag 后按 Backspace，可能删除 Tag 而不是前面的文字

### 根本原因

#### 原因 1: TagElement DOM 结构错误 ❌

**问题代码**（`TagElement.tsx` 修复前）：

```tsx
return (
  <>
    {/* 可视部分：不可编辑 */}
    <span
      {...attributes}  // ⚠️ attributes 应该应用在包含 children 的元素上
      contentEditable={false}
      className="inline-tag"
      // ...
    >
      <span>#</span>
      <span>{tagData.name}</span>
    </span>
    {/* ❌ children 被隐藏，导致 Slate 无法在其中放置光标 */}
    <span style={{ display: 'none' }}>{children}</span>
  </>
);
```

**问题分析**：

1. **违反 Slate Void 元素规范**：
   - Slate 的 void 元素必须包含 `children`，且 `children` 不能被隐藏
   - `{...attributes}` 必须应用在包含 `children` 的元素上
   - `children` 是 Slate 放置光标的锚点，隐藏它会导致无法定位光标

2. **DOM 结构不一致**：
   - `DateMentionElement` 正确地将 `children` 放在 `span` 内部
   - `TagElement` 错误地将 `children` 分离到外部，并隐藏

#### 原因 2: normalizeNode 路径计算错误 ❌

**问题代码**（`PlanSlate.tsx` 修复前）：

```typescript
editor.normalizeNode = entry => {
  const [node, path] = entry;
  
  if (SlateElement.isElement(node) && (node.type === 'tag' || node.type === 'dateMention')) {
    // ❌ 使用 Path.next() 可能获取错误的路径（深度优先遍历的下一个节点）
    const nextPath = Path.next(path);
    let nextNode: Node | null = null;
    
    try {
      nextNode = Node.get(editor, nextPath);
    } catch (e) {
      // 经常抛出异常，因为 Path.next() 不一定是兄弟节点
    }
    
    // ...
  }
};
```

**问题分析**：

- `Path.next(path)` 返回的是**深度优先遍历**的下一个节点，不一定是同级的兄弟节点
- 对于 inline void 元素，应该检查**同级的下一个兄弟节点**，而不是 `Path.next()`
- 例如：`[0, 0, 1]` 的 `Path.next()` 是 `[0, 0, 1, 0]`（子节点），而不是 `[0, 0, 2]`（兄弟节点）

---

## ✅ 解决方案

### 修复 1: TagElement DOM 结构重构

**修复代码**（`src/components/SlateEditor/elements/TagElement.tsx`）：

```tsx
return (
  <span
    {...attributes}  // ✅ attributes 应用在包含 children 的元素上
    contentEditable={false}
    data-type="tag"
    data-tag-id={tagElement.tagId}
    data-tag-name={tagData.name}
    data-tag-color={tagData.color}
    data-tag-emoji={tagData.emoji}
    data-mention-only={tagElement.mentionOnly ? 'true' : 'false'}
    className={`inline-tag ${tagElement.mentionOnly ? 'mention-only' : ''}`}
    style={{
      display: 'inline-block',  // ✅ 改为 inline-block，避免布局问题
      margin: '0 2px',
      padding: '2px 6px',
      borderRadius: '4px',
      backgroundColor: `${tagData.color}15`,
      border: `1px solid ${tagData.color}40`,
      color: tagData.color,
      userSelect: 'none',
      cursor: 'pointer',
      transition: 'all 0.2s',
      verticalAlign: 'baseline',  // ✅ 与文字基线对齐
      boxShadow: 'none',
      outline: 'none',
    }}
  >
    <span style={{ fontWeight: 700, color: tagData.color }}>#</span>
    {tagData.emoji && <span style={{ fontWeight: 400, marginRight: '2px' }}>{tagData.emoji}</span>}
    <span style={{ fontWeight: 700, color: tagData.color }}>{tagData.name}</span>
    {/* ✅ children 必须在 void 元素内部，且不能隐藏 */}
    {children}
  </span>
);
```

**关键改动**：

1. ✅ 移除外部的 `<>...</>` 片段，使用单一的 `<span>` 元素
2. ✅ `{...attributes}` 应用在包含 `children` 的 `<span>` 上
3. ✅ `children` 不再隐藏，直接放在 `<span>` 内部（与 DateMention 一致）
4. ✅ `display: inline` → `inline-block`，避免内联元素嵌套问题
5. ✅ 添加 `verticalAlign: 'baseline'`，确保与文字对齐

### 修复 2: normalizeNode 正确获取兄弟节点

**修复代码**（`src/components/PlanSlate/PlanSlate.tsx` L136-234）：

```typescript
editor.normalizeNode = entry => {
  const [node, path] = entry;

  // 检查 tag 或 dateMention 元素
  if (SlateElement.isElement(node) && (node.type === 'tag' || node.type === 'dateMention')) {
    console.log('%c[normalizeNode] 检查 void 元素', 'background: #673AB7; color: white;', {
      type: (node as any).type,
      path: JSON.stringify(path),
    });
    
    // ✅ 获取父节点和当前节点在父节点中的索引
    const parentPath = Path.parent(path);
    const parent = Node.get(editor, parentPath);
    const nodeIndex = path[path.length - 1];
    
    if (!SlateElement.isElement(parent)) {
      console.log('%c[normalizeNode] 父节点不是元素', 'background: #FFC107; color: black;');
      normalizeNode(entry);
      return;
    }
    
    // ✅ 检查下一个兄弟节点（同级）
    const nextSiblingIndex = nodeIndex + 1;
    const nextSibling = nextSiblingIndex < parent.children.length 
      ? parent.children[nextSiblingIndex] 
      : null;
    
    console.log('%c[normalizeNode] 下一个兄弟节点信息', 'background: #2196F3; color: white;', {
      nodeIndex,
      nextSiblingIndex,
      hasNextSibling: !!nextSibling,
      isText: nextSibling ? SlateText.isText(nextSibling) : false,
      text: nextSibling && SlateText.isText(nextSibling) ? nextSibling.text : 'N/A',
      startsWithSpace: nextSibling && SlateText.isText(nextSibling) ? nextSibling.text.startsWith(' ') : false,
    });

    // 如果后面没有节点，或者下一个节点不是文本节点，或者不以空格开头
    const needsSpace = !nextSibling || 
                      !SlateText.isText(nextSibling) || 
                      !nextSibling.text.startsWith(' ');
    
    if (needsSpace) {
      console.log('%c[normalizeNode] ⚠️ 检测到 void 元素后缺少空格，准备修复', 'background: #FF5722; color: white;', {
        type: (node as any).type,
        path: JSON.stringify(path),
        reason: !nextSibling ? 'no-next-sibling' : 
                !SlateText.isText(nextSibling) ? 'not-text' : 
                'no-space',
      });

      // 💾 保存当前光标位置
      const currentSelection = editor.selection;
      
      // ✅ 在 void 元素之后插入空格文本节点
      Editor.withoutNormalizing(editor, () => {
        const insertPath = [...parentPath, nextSiblingIndex];
        
        console.log('%c[normalizeNode] 插入空格文本节点', 'background: #4CAF50; color: white;', {
          insertPath: JSON.stringify(insertPath),
          hasSelection: !!currentSelection,
        });
        
        // 如果下一个节点是文本但不以空格开头，在文本开头插入空格
        if (nextSibling && SlateText.isText(nextSibling)) {
          Transforms.insertText(editor, ' ', { 
            at: { path: insertPath, offset: 0 } 
          });
        } else {
          // 否则插入新的空格文本节点
          Transforms.insertNodes(
            editor,
            { text: ' ' },
            { at: insertPath }
          );
        }
        
        // 🔧 恢复光标位置
        if (currentSelection) {
          try {
            Transforms.select(editor, currentSelection);
          } catch (e) {
            console.warn('%c[normalizeNode] 无法恢复光标位置', 'background: #FFC107; color: black;', e);
          }
        }
      });
      
      console.log('%c[normalizeNode] ✅ 空格已插入', 'background: #4CAF50; color: white;');
      
      // 由于修改了树，立即返回让 Slate 重新 normalize
      return;
    }
    
    console.log('%c[normalizeNode] ✅ void 元素后已有空格，无需修复', 'background: #4CAF50; color: white;');
  }

  // 对于其他节点，执行默认的 normalize
  normalizeNode(entry);
};
```

**关键改动**：

1. ✅ 使用 `Path.parent(path)` 获取父节点路径
2. ✅ 使用 `path[path.length - 1]` 获取当前节点在父节点中的索引
3. ✅ 使用 `parent.children[nextSiblingIndex]` 获取下一个兄弟节点（而不是 `Path.next()`）
4. ✅ 区分两种情况：
   - 下一个节点是文本但不以空格开头 → 在文本开头插入空格
   - 下一个节点不存在或不是文本 → 插入新的空格文本节点
5. ✅ 使用 `Editor.withoutNormalizing()` 包裹插入操作，避免循环 normalize

---

## 🎯 修复效果

### 修复前 ❌

| 操作 | 结果 | 原因 |
|------|------|------|
| 插入 Tag 后输入文字 | ❌ 无法输入 | children 被隐藏，无法放置光标 |
| 按 → 键跳过 Tag | ❌ 光标不移动 | Slate 无法在隐藏的 children 中定位 |
| 删除 Tag 后的空格 | ❌ 空格不会恢复 | normalizeNode 路径计算错误 |

### 修复后 ✅

| 操作 | 结果 | 原因 |
|------|------|------|
| 插入 Tag 后输入文字 | ✅ 可以输入 | children 在 void 元素内部，光标可定位 |
| 按 → 键跳过 Tag | ✅ 光标跳到 Tag 后 | Slate 正确处理 void 元素导航 |
| 删除 Tag 后的空格 | ✅ 自动补充空格 | normalizeNode 正确插入空格文本节点 |

---

## 🧪 测试验证

### 测试步骤

#### 测试 1: 插入 Tag 后光标定位

1. 在 PlanManager 中创建一个新行
2. 双击 Alt 键，按 1 打开 TagPicker
3. 选择一个标签
4. **预期**: 光标出现在 Tag 后面（不是 Tag 内部）
5. 输入文字，**预期**: 文字出现在 Tag 后面

#### 测试 2: 使用方向键导航

1. 在包含 Tag 的行中，光标在 Tag 前面
2. 按右方向键 →
3. **预期**: 光标跳过 Tag，定位在 Tag 后面
4. 按左方向键 ←
5. **预期**: 光标跳过 Tag，定位在 Tag 前面

#### 测试 3: 删除 Tag 后的空格

1. 在包含 Tag 的行中，光标在 Tag 后面
2. 按 Backspace 删除 Tag 后面的空格
3. **预期**: normalizeNode 自动补充空格
4. 确认光标仍然可以定位在 Tag 后面

#### 测试 4: Tag 在行尾的情况

1. 创建一行：输入文字后插入 Tag（Tag 在行尾）
2. **预期**: Tag 后面有空格（即使是行尾）
3. 按右方向键，**预期**: 光标定位在 Tag 后的空格处
4. 继续输入文字，**预期**: 可以正常输入

### 诊断工具

运行 `diagnose-tag-cursor.js` 脚本：

```javascript
// 在浏览器控制台运行
window.diagnoseCursorAfterTag()  // 诊断 Tag DOM 结构
window.testCursorAfterTag()      // 测试光标定位
```

### 调试日志

打开 PlanSlate 的调试日志（包含 normalizeNode 日志）：

```javascript
window.SLATE_DEBUG = true;
localStorage.setItem('SLATE_DEBUG', 'true');
location.reload();
```

---

## 📚 技术原理

### Slate Void 元素规范

**官方文档**: https://docs.slatejs.org/concepts/09-rendering#void-vs-not-void

1. **Void 元素定义**：
   - 内容不可编辑（`contentEditable={false}`）
   - 作为一个整体被选中和删除
   - 必须包含一个空的 `children` 属性（`[{ text: '' }]`）

2. **DOM 结构要求**：
   ```tsx
   <span {...attributes} contentEditable={false}>
     {/* 可视内容 */}
     <span>可见的元素</span>
     {/* children 必须在元素内部，供 Slate 放置光标 */}
     {children}
   </span>
   ```

3. **错误示例**：
   ```tsx
   {/* ❌ 错误：children 在外部 */}
   <>
     <span {...attributes} contentEditable={false}>可见的元素</span>
     {children}
   </>
   
   {/* ❌ 错误：children 被隐藏 */}
   <span {...attributes}>
     <span contentEditable={false}>可见的元素</span>
     <span style={{ display: 'none' }}>{children}</span>
   </span>
   ```

### normalizeNode 工作原理

1. **触发时机**：
   - 每次编辑操作后（插入、删除、格式化等）
   - Slate 会遍历整个文档树，对每个节点调用 `normalizeNode`

2. **修复策略**：
   - 检测不符合规范的节点结构
   - 使用 `Transforms` API 修复节点
   - 修复后返回，让 Slate 重新 normalize（避免循环）

3. **常见模式**：
   ```typescript
   editor.normalizeNode = entry => {
     const [node, path] = entry;
     
     // 检测需要修复的情况
     if (needsFixing) {
       // 使用 Editor.withoutNormalizing 避免循环
       Editor.withoutNormalizing(editor, () => {
         Transforms.doSomething(editor, ...);
       });
       return; // 立即返回，让 Slate 重新 normalize
     }
     
     // 否则调用默认的 normalizeNode
     normalizeNode(entry);
   };
   ```

### 空格文本节点的作用

1. **为什么需要空格**：
   - Void 元素后如果没有文本节点，光标无法定位在其后
   - 空格提供了一个"着陆点"，让光标可以停留

2. **空格的位置**：
   - 必须是**兄弟节点**（同级），而不是 void 元素的子节点
   - 必须是**文本节点**（`{ text: ' ' }`），而不是元素节点

3. **示例结构**：
   ```
   paragraph
     ├─ text: "hello "
     ├─ tag (void)
     │   └─ text: ""  ← children（空文本）
     └─ text: " world"  ← 这个空格允许光标定位在 tag 后
   ```

---

## 🔗 相关文件

| 文件 | 修改内容 | 行号 |
|------|---------|------|
| `src/components/SlateEditor/elements/TagElement.tsx` | 重构 DOM 结构，children 不再隐藏 | 全文 |
| `src/components/PlanSlate/PlanSlate.tsx` | 修复 normalizeNode 兄弟节点获取逻辑 | L136-234 |
| `diagnose-tag-cursor.js` | 新增诊断工具 | - |
| `test-tag-cursor-fix.js` | 新增测试指南 | - |

---

## 📝 总结

### 问题本质

Tag 光标定位问题的根本原因是 **违反了 Slate Void 元素规范**：

1. `children` 被隐藏或分离到外部，导致 Slate 无法在其中放置光标
2. `normalizeNode` 使用错误的路径计算方法，无法正确插入空格修复节点

### 解决方案

1. **重构 TagElement**：将 `children` 放在 void 元素内部，不隐藏
2. **修复 normalizeNode**：使用父节点和索引正确获取兄弟节点，插入空格文本节点

### 关键改进

- ✅ 符合 Slate Void 元素规范
- ✅ 与 DateMentionElement 保持一致的 DOM 结构
- ✅ 自动修复缺失的空格文本节点
- ✅ 光标可以正常定位在 Tag 前后
- ✅ 方向键可以正常跳过 void 元素

---

**版本**: v1.9.2  
**更新日期**: 2025-11-11  
**作者**: GitHub Copilot
