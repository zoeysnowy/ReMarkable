# Tag 光标定位问题 - 快速修复指南

## 🔍 问题现象

- ❌ 无法将光标定位在 Tag 元素后面
- ❌ 插入 Tag 后无法继续输入文字
- ❌ 方向键无法跳过 Tag 元素

## ✅ 修复内容

### 1. TagElement DOM 结构修复

**文件**: `src/components/SlateEditor/elements/TagElement.tsx`

```tsx
// ❌ 修复前：children 被隐藏
<>
  <span {...attributes} contentEditable={false}>...</span>
  <span style={{ display: 'none' }}>{children}</span>
</>

// ✅ 修复后：children 在元素内部
<span {...attributes} contentEditable={false}>
  ...
  {children}  {/* 不再隐藏 */}
</span>
```

### 2. normalizeNode 路径计算修复

**文件**: `src/components/PlanSlate/PlanSlate.tsx` (L136-234)

```typescript
// ❌ 修复前：使用 Path.next()（错误）
const nextPath = Path.next(path);
let nextNode = Node.get(editor, nextPath);

// ✅ 修复后：使用兄弟节点索引（正确）
const parentPath = Path.parent(path);
const parent = Node.get(editor, parentPath);
const nodeIndex = path[path.length - 1];
const nextSiblingIndex = nodeIndex + 1;
const nextSibling = parent.children[nextSiblingIndex];
```

## 🧪 快速测试

1. 在 PlanManager 中插入一个 Tag
2. 尝试在 Tag 后面输入文字
3. **预期**: ✅ 可以正常输入

## 📚 详细文档

参见: `docs/fixes/TAG_CURSOR_FIX.md`

## 🛠️ 诊断工具

```javascript
// 在浏览器控制台运行
window.diagnoseCursorAfterTag()  // 诊断 DOM 结构
window.testCursorAfterTag()      // 测试光标定位
```

**脚本**: `diagnose-tag-cursor.js`

---

**版本**: v1.9.2  
**更新**: 2025-11-11
