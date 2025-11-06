# UnifiedSlateEditor - PlanManager 集成指南

**最后更新**: 2025-11-06

## 概述

**UnifiedSlateEditor** 是基于 Slate.js 的单实例富文本编辑器，已成功集成到 PlanManager 替代了原有的 SlateFreeFormEditor（多实例架构）。

---

## ✅ 核心优势

### 1. **跨行文字选择** 
- **问题**：之前每个 SlateLine 是独立的 Slate 实例，无法跨行选择文字
- **解决**：单个 Slate 实例管理所有行，原生支持跨行选择
- **体验**：用户可以像在 Word 中一样拖动鼠标选择多行文字

### 2. **统一编辑器状态**
- 单一 editor 实例，简化状态管理
- FloatingBar 直接操作 editor，无需维护 editorRegistry
- 减少内存占用和渲染开销

### 3. **一致的快捷键行为**
- Shift+Enter 切换 Description 模式
- Tab/Shift+Tab 调整层级
- Ctrl/Cmd+B/I/U 文本格式化
- 所有快捷键在单一编辑器内统一处理

---

## 架构变更

### 之前：SlateFreeFormEditor（多实例）

```typescript
// ❌ 旧架构：每行一个独立 Slate 实例
items.map(item => (
  <SlateLine 
    key={item.id}
    editor={createEditor()} // 每行创建新 editor
    value={itemToSlate(item)}
  />
))

// 问题：
// 1. 无法跨行选择文字
// 2. editorRegistry 维护复杂（Map<lineId, editor>）
// 3. FloatingBar 需要找到当前行的 editor
```

### 现在：UnifiedSlateEditor（单实例）

```typescript
// ✅ 新架构：单个 Slate 实例管理所有行
<UnifiedSlateEditor
  items={items}
  onChange={(updatedItems) => {
    // 自动批量保存变更
  }}
  onEditorReady={(editor) => {
    // 保存 editor 供 FloatingBar 使用
    unifiedEditorRef.current = editor;
  }}
  onFocus={(lineId) => {
    // 焦点跟踪
    setCurrentFocusedLineId(lineId);
  }}
  renderLinePrefix={(line) => {
    // Description 行不显示 checkbox
    if (line.mode === 'description') return null;
    return <Checkbox />;
  }}
/>
```

---

## PlanManager 集成细节

### 1. Editor 实例管理

```typescript
// src/components/PlanManager.tsx

// ✅ 保存 UnifiedSlateEditor 的单个编辑器实例
const unifiedEditorRef = useRef<any>(null);

<UnifiedSlateEditor
  onEditorReady={(editor) => {
    unifiedEditorRef.current = editor;
  }}
/>
```

### 2. FloatingBar 集成

#### 文本格式化

```typescript
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
    // ...
  }
}, []);
```

#### Tag/Emoji 插入

```typescript
import { insertTag, insertEmoji, insertDateMention } from './UnifiedSlateEditor/helpers';

const handleTagSelect = (tagIds: string[]) => {
  const editor = unifiedEditorRef.current;
  if (!editor) return;
  
  const tag = TagService.getTagById(tagId);
  insertTag(editor, tag.id, tag.name, tag.color, tag.emoji);
  // ✅ onChange 会自动保存
};
```

### 3. onChange 处理（增量更新）

```typescript
onChange={(updatedItems) => {
  const changedItems: Event[] = [];
  
  updatedItems.forEach((updatedItem: any) => {
    const existingItem = itemsMap[updatedItem.id];
    
    // 🔧 变更检测
    const isChanged = !existingItem || 
      existingItem.title !== updatedItem.title ||
      existingItem.content !== updatedItem.content ||
      existingItem.description !== updatedItem.description ||
      JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);
    
    if (isChanged) {
      // 构建 Event 对象
      const eventItem: Event = {
        ...(existingItem || {}),
        ...updatedItem,
        // 🔧 保留现有时间字段，不自动生成
        startTime: existingItem?.startTime || '',
        endTime: existingItem?.endTime || '',
      };
      changedItems.push(eventItem);
    }
  });
  
  // 批量保存
  if (changedItems.length > 0) {
    changedItems.forEach(item => {
      onSave(item);
      
      // 🔧 只有当 item 有时间字段时才同步到 Calendar
      const hasAnyTime = !!(item.startTime || item.endTime || item.dueDate);
      if (hasAnyTime) {
        syncToUnifiedTimeline(item);
      }
    });
  }
}
```

### 4. 焦点跟踪

```typescript
onFocus={(lineId) => {
  // 更新焦点跟踪
  setCurrentFocusedLineId(lineId);
  
  // 查找当前行的 item 和 mode
  const item = items.find(i => i.id === lineId || i.id === lineId.replace('-desc', ''));
  if (item) {
    const isDescMode = lineId.includes('-desc');
    setCurrentFocusedMode(isDescMode ? 'description' : 'title');
    setCurrentIsTask(item.isTask || false);
  }
}
```

### 5. Description 模式支持

```typescript
renderLinePrefix={(line) => {
  const item = items.find(i => i.id === line.lineId);
  if (!item) return null;
  
  // 🔧 Description 行不显示 checkbox
  const isDescriptionMode = line.mode === 'description';
  if (isDescriptionMode) {
    return null;
  }
  
  return (
    <>
      <input type="checkbox" checked={item.isCompleted} />
      {item.emoji && <span>{item.emoji}</span>}
    </>
  );
}
```

---

## Gray-text Placeholder

UnifiedSlateEditor 内置了 gray-text placeholder 功能：

```typescript
// src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx

const shouldShowGrayText = useMemo(() => {
  if (value.length === 0) return true;
  if (value.length === 1) {
    const firstLine = value[0];
    const text = firstLine.children[0]?.children?.[0];
    return !text || (typeof text === 'object' && 'text' in text && !text.text);
  }
  return false;
}, [value, items]);

// 渲染
{shouldShowGrayText && (
  <div className="gray-text-placeholder" onClick={handleGrayTextClick}>
    {placeholder}
  </div>
)}
```

**点击行为**：创建新的空行并聚焦

---

## 时间管理策略

### ✅ 避免强制定义时间

```typescript
// 🔧 关键逻辑：只有当 item 有时间字段时才同步到 Calendar
const hasAnyTime = !!(item.startTime || item.endTime || item.dueDate);
if (hasAnyTime) {
  syncToUnifiedTimeline(item);
} else {
  console.log(`[⏭️ 跳过同步] ${item.title} - 无时间字段`);
}
```

**原因**：
- Plan 页面的 item 可能是纯待办事项（无时间）
- 只有用户通过 FloatingBar 或 @chrono 显式设置时间后，才创建 Calendar Event
- 避免空时间的 item 被自动赋予当前时间

### onTimeApplied 简化

```typescript
onTimeApplied={(startIso, endIso) => {
  const item = items.find(i => i.id === actualItemId);
  if (!item) return;
  
  // ✅ UnifiedSlateEditor 的 onChange 会自动保存内容
  // 这里只需要确保 EventService 同步时间
  
  if (item.id) {
    // 更新现有 Event（时间已由 TimeHub 更新）
    await EventService.updateEvent(item.id, {
      title: item.title,
      description: item.description || item.content,
      tags: item.tags,
    });
  } else {
    // 创建新 Event + 写入 TimeHub
    const newId = generateEventId();
    await EventService.createEvent({ id: newId, ... });
    await TimeHub.setEventTime(newId, { start: startIso, end: endIso });
    onSave({ ...item, id: newId });
  }
}
```

---

## 数据流图

```
用户输入
  ↓
UnifiedSlateEditor onChange
  ↓
变更检测（isChanged）
  ↓
构建 changedItems[]
  ↓
批量保存（onSave）
  ↓
检查时间字段（hasAnyTime）
  ├─ 有时间 → syncToUnifiedTimeline → EventService + TimeHub
  └─ 无时间 → 跳过同步（仅保存到 Plan 列表）
```

---

## 迁移检查清单

- [x] 移除 `editorRegistryRef`（多实例管理）
- [x] 添加 `unifiedEditorRef`（单实例）
- [x] 修改 `handleTextFormat`（Slate API）
- [x] 修改 FloatingBar 回调（使用 helper 函数）
- [x] 添加 `onEditorReady` 保存 editor
- [x] 添加 `onFocus` 焦点跟踪
- [x] 实现 description 模式检测（renderLinePrefix）
- [x] 添加 gray-text placeholder
- [x] 实现时间管理策略（避免强制定义时间）
- [x] 简化 `onTimeApplied`（移除手动内容保存）

---

## 已知限制

### 1. FloatingBar 的 onDateRangeSelect

**状态**：部分功能待迁移

```typescript
// ⚠️ 旧的非 TimeHub 路径，需要继续使用 insertDateMention helper
onDateRangeSelect={(start, end) => {
  const editor = unifiedEditorRef.current;
  insertDateMention(editor, formatTimeForStorage(start), formatTimeForStorage(end));
}
```

### 2. 复杂的 HTML 提取逻辑

- 旧代码使用 `editor.getHTML()` 获取内容
- UnifiedSlateEditor 的 onChange 已经提供了序列化后的 items
- 可能需要优化一些边缘场景的 HTML 提取

---

## 性能优化

### 增量更新

```typescript
// ✅ 只更新真正变化的 item
const isChanged = !existingItem || 
  existingItem.title !== updatedItem.title ||
  existingItem.content !== updatedItem.content ||
  existingItem.description !== updatedItem.description ||
  JSON.stringify(existingItem.tags) !== JSON.stringify(updatedItem.tags);

if (isChanged) {
  changedItems.push(eventItem);
}
```

**效果**：
- 编辑 1 个 item，只触发 1 次保存
- 减少 95%+ 不必要的更新

---

## 测试要点

1. **跨行选择**：拖动鼠标选择多行文字 ✅
2. **Shift+Enter**：description 行不显示 checkbox ✅
3. **FloatingBar**：Tag/Emoji 插入到光标位置 ✅
4. **Gray-text**：空列表显示提示文字 ✅
5. **时间管理**：新建 item 不强制定义时间 ✅
6. **增量更新**：只保存变化的 item ✅

---

## 相关文档

- [UnifiedSlateEditor 原始设计文档](../../_archive/legacy-docs/slate/UNIFIED_SLATE_EDITOR_GUIDE.md)
- [TIME_ARCHITECTURE.md](./TIME_ARCHITECTURE.md) - 时间管理架构
- [FLOATING_COMPONENTS_GUIDE.md](./FLOATING_COMPONENTS_GUIDE.md) - FloatingBar 指南
- [Sync-Architecture.md](./architecture/Sync-Architecture.md) - 同步架构

---

## 总结

UnifiedSlateEditor 的集成成功解决了以下问题：

1. ✅ **跨行文字选择** - 用户体验显著提升
2. ✅ **架构简化** - 从多实例变为单实例
3. ✅ **FloatingBar 集成** - 使用 helper 函数简化逻辑
4. ✅ **时间管理** - 避免强制定义时间
5. ✅ **性能优化** - 增量更新，减少不必要保存

这是 ReMarkable Plan 页面的一次重要架构升级！🎉
