# 📋 TagManager 键盘功能与交互设计分析

## 🎯 核心设计理念

TagManager 是一个**完全基于键盘操作的多行编辑器**，设计理念类似 Notion、Roam Research：

- ✅ **contentEditable 原生编辑**：每个标签都是独立的 contentEditable 元素
- ✅ **无需点击按钮**：所有操作都可以通过键盘完成
- ✅ **智能提示区域**：最后一行有固定的灰色提示文字（Gray Text）
- ✅ **即时保存**：失焦（blur）时自动保存，无需手动点击保存按钮
- ✅ **批量操作支持**：通过文本选区实现多标签批量编辑

---

## ⌨️ 键盘快捷键完整列表

### 1. **创建与导航**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Enter` | 创建同级标签 | `handleTagKeyDown` | 保存当前标签，在下方创建新的同级标签，光标自动聚焦 |
| `↑` | 上一个标签 | `handleTagKeyDown` → `focusPreviousTag` | 移动光标到上一个标签，自动保存当前标签 |
| `↓` | 下一个标签 | `handleTagKeyDown` → `focusNextTag` | 移动光标到下一个标签，自动保存当前标签 |

### 2. **层级调整**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Tab` | 增加缩进（向右） | `handleTagKeyDown` | 智能限制：最多比上一个标签多 1 级，自动更新 `parentId` |
| `Shift + Tab` | 减少缩进（向左） | `handleTagKeyDown` | 减少 level，智能更新 `parentId` |

**智能层级限制逻辑**：
```typescript
// 查找上一个标签的层级
const previousLevel = previousTag.level || 0;
const maxAllowedLevel = Math.min(currentLevel + 1, previousLevel + 1);

if (currentLevel < maxAllowedLevel) {
  // 允许增加缩进
}
```

### 3. **位置移动**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Shift + Alt + ↑` | 向上移动标签 | `handleTagKeyDown` → `moveTagUp` | 与上一个标签交换 `position` |
| `Shift + Alt + ↓` | 向下移动标签 | `handleTagKeyDown` → `moveTagDown` | 与下一个标签交换 `position` |

### 4. **批量操作**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Delete` / `Backspace` | 批量删除 | 全局 `handleKeyDown` | 删除所有选中的标签（需确认） |
| `Shift + Alt + ↑` / `↓` | 批量移动 | 全局 `handleKeyDown` | 批量上下移动选中的标签 |
| `Shift + Alt + M` | 批量设置日历映射 | 全局 `handleKeyDown` | 为选中的所有标签设置相同的日历映射 |

### 5. **编辑操作**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Escape` | 取消创建 | Gray Text `onKeyDown` | 取消新标签创建，恢复提示文字 |
| `Ctrl + C` | 复制标签 | 全局 `copy` 事件 | 复制选中标签的完整数据（JSON 格式） |
| `Ctrl + X` | 剪切标签 | 全局 `cut` 事件 | 剪切标签到剪贴板 |
| `Ctrl + V` | 粘贴标签 | 全局 `paste` 事件 | 粘贴标签到当前位置 |

### 6. **调试工具**

| 快捷键 | 功能 | 实现位置 | 说明 |
|--------|------|---------|------|
| `Ctrl + F9` | 修复 position | `handleTagKeyDown` → `fixTagPositions` | 手动触发 position 值修复 |

---

## 🎨 UI 交互设计

### 1. **Gray Text 提示区域**

位置：标签列表最下方

**设计特点**：
- 始终存在，不会消失
- 灰色文字（`color: '#9ca3af'`）
- 明确的操作提示："点击新增标签，Tab/Shift+Tab切换层级，Shift+Alt+↑/↓上下移动标签"
- 可点击激活，自动清空内容并进入编辑模式

**交互逻辑**：
```typescript
// 1. 点击时
onClick={(e) => {
  console.log('🖱️ Gray text clicked');
  handleNewTagActivation(); // 激活创建模式
  e.currentTarget.textContent = ''; // 清空提示文字
  e.currentTarget.focus(); // 自动聚焦
}}

// 2. 聚焦时
onFocus={(e) => {
  if (!isCreatingNewTag && e.currentTarget.textContent.includes('点击新增标签')) {
    handleNewTagActivation();
    e.currentTarget.textContent = '';
  }
}}

// 3. 失焦时
onBlur={(e) => {
  const content = e.currentTarget.textContent || '';
  if (isCreatingNewTag) {
    if (content.trim() === '') {
      handleCancelNewTag(); // 取消创建
      e.currentTarget.textContent = '点击新增标签...';
    } else {
      setIsCreatingNewTag(false); // 保存新标签
    }
  }
}}
```

### 2. **标签行结构**

```
┌────────────────────────────────────────────────────────────────┐
│ [缩进空格] # 🎯 标签名称  [日历映射] [打卡按钮] [计时器] [删除] │
└────────────────────────────────────────────────────────────────┘
```

**左侧区域（可编辑）**：
- `#` 符号：点击修改颜色
- Emoji：点击修改表情
- 标签名称：contentEditable，可直接编辑

**右侧区域（功能按钮）**：
- 日历映射：点击设置，支持批量操作
- 打卡按钮：显示打卡次数
- 计时器：显示运行时间
- 删除按钮：悬停显示

### 3. **批量操作指示器**

当选中多个标签时：
- 蓝色边框：`border: '2px solid #3b82f6'`
- 数量徽章：右上角显示选中数量
- Tooltip 提示："批量设置 (N个标签)"

```typescript
{selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 && (
  <div style={{
    position: 'absolute',
    top: '-6px',
    right: '-6px',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '50%',
    width: '18px',
    height: '18px',
    fontSize: '10px',
    fontWeight: 'bold'
  }}>
    {selectedTagIds.length}
  </div>
)}
```

---

## 🔧 核心实现细节

### 1. **contentEditable 配置**

```typescript
<span 
  data-tag-id={tag.id}
  style={{
    outline: 'none',
    border: 'none',
    background: 'transparent',
    cursor: 'text',
    userSelect: 'text', // 允许文本选择
    WebkitUserSelect: 'text',
    MozUserSelect: 'text'
  }}
  contentEditable
  suppressContentEditableWarning
  onBlur={(e) => {
    const newName = e.currentTarget.textContent || '';
    handleTagSave(tag.id, newName); // 失焦时自动保存
  }}
  onKeyDown={(e) => handleTagKeyDown(e, tag.id, tag.level || 0)}
  onMouseDown={(e) => {
    e.stopPropagation(); // 防止事件冒泡，确保可以选择文字
  }}
>
  {tag.name}
</span>
```

**关键点**：
- `suppressContentEditableWarning`：禁止 React 警告
- `onBlur` 自动保存：无需手动点击保存按钮
- `onMouseDown` 阻止冒泡：确保文本可选择

### 2. **智能批量操作检测**

```typescript
const handleCalendarMappingClick = (tagId: string, event: React.MouseEvent) => {
  const selection = window.getSelection();
  const selectedTagIds: string[] = [];
  
  if (selection && selection.rangeCount > 0) {
    tags.forEach(tag => {
      const tagElement = document.querySelector(`[data-tag-id="${tag.id}"]`);
      if (tagElement && selection.containsNode(tagElement, true)) {
        selectedTagIds.push(tag.id);
      }
    });
  }
  
  const isTagSelected = selectedTagIds.includes(tagId);
  const shouldBatchUpdate = isTagSelected && selectedTagIds.length > 1;
  
  if (shouldBatchUpdate) {
    console.log('📅 [Smart Batch] Batch mode enabled');
    setShowCalendarPicker({
      show: true,
      tagId: `batch:${selectedTagIds.join(',')}`, // 特殊前缀标记批量操作
      position: { x: rect.left, y: rect.bottom + 5 }
    });
  }
}
```

### 3. **层级管理**

**数据结构**：
```typescript
interface ExtendedHierarchicalTag {
  id: string;
  name: string;
  level?: number;      // 层级（0, 1, 2, ...）
  parentId?: string;   // 父标签 ID
  position?: number;   // 列表中的位置顺序
}
```

**缩进样式**：
```typescript
paddingLeft: `${(tag.level || 0) * 24}px`
```

**智能 parentId 更新**：
```typescript
// Tab 增加缩进时
const newLevel = currentLevel + 1;
let newParentId: string | undefined = undefined;

// 向前查找第一个层级比新层级小的标签
for (let i = currentIndex - 1; i >= 0; i--) {
  if ((sortedTags[i].level || 0) < newLevel) {
    newParentId = sortedTags[i].id;
    break;
  }
}
```

### 4. **自动保存机制**

```typescript
// 监听 tags 变化，自动保存到 localStorage
useEffect(() => {
  if (tags.length > 0) {
    saveTagsToStorage(tags);
    if (onTagsChange) {
      onTagsChange(tags);
    }
  }
}, [tags, onTagsChange]);
```

### 5. **position 值修复**

防止重复的 position 导致排序混乱：

```typescript
const validateAndFixPositions = (tagsToCheck: ExtendedHierarchicalTag[]): ExtendedHierarchicalTag[] => {
  const sortedTags = [...tagsToCheck].sort((a, b) => (a.position || 0) - (b.position || 0));
  
  // 检查是否有重复的 position
  const positions = sortedTags.map(tag => tag.position || 0);
  const uniquePositions = Array.from(new Set(positions));
  
  if (positions.length !== uniquePositions.length) {
    console.warn('⚠️ Found duplicate positions, fixing...');
    return sortedTags.map((tag, index) => ({
      ...tag,
      position: index
    }));
  }
  
  return tagsToCheck;
};
```

---

## 📊 右侧菜单实现

### 1. **日历映射选择器**

```typescript
<div 
  onClick={(e) => handleCalendarMappingClick(tag.id, e)}
  style={{
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    width: '180px',
    border: selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 
      ? '2px solid #3b82f6' // 批量模式边框
      : 'none'
  }}
  title={
    selectedTagIds.includes(tag.id) && selectedTagIds.length > 1 
      ? `批量设置 (${selectedTagIds.length}个标签)` 
      : "点击设置日历映射"
  }
>
  {/* 颜色圆点 */}
  <div style={{
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: tag.calendarMapping?.color || '#9ca3af'
  }} />
  
  {/* 日历名称 */}
  <span style={{
    overflow: 'hidden',
    textOverflow: 'ellipsis', 
    whiteSpace: 'nowrap',
    flex: 1
  }}>
    {tag.calendarMapping?.calendarName || '未映射'}
  </span>
</div>
```

### 2. **打卡按钮**

```typescript
<div
  onClick={() => handleCheckin(tag.id)}
  style={{
    position: 'relative',
    cursor: 'pointer',
    transition: 'all 0.2s'
  }}
  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
  title={`打卡 (已打卡${checkinCounts[tag.id] || 0}次)`}
>
  <img src={icons.multiCheckinColor} alt="打卡" width="25" height="25" />
  
  {/* 打卡次数徽章 */}
  {checkinCounts[tag.id] > 0 && (
    <span style={{
      position: 'absolute',
      top: '-8px',
      right: '-8px',
      backgroundColor: '#ef4444',
      color: 'white',
      borderRadius: '50%',
      width: '18px',
      height: '18px',
      fontSize: '11px',
      fontWeight: 'bold'
    }}>
      {checkinCounts[tag.id]}
    </span>
  )}
</div>
```

### 3. **计时器显示**

```typescript
<div style={{
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '16px',
  color: '#000000',
  width: '100px'
}}>
  {globalTimer && globalTimer.tagId === tag.id ? (
    // 运行中的计时器
    <>
      <span>{formatTime(elapsedTime)}</span>
      <button onClick={() => {
        if (globalTimer.isRunning) {
          onTimerPause?.();
        } else {
          onTimerResume?.();
        }
      }}>
        {globalTimer.isRunning ? '⏸' : '▶'}
      </button>
      <button onClick={onTimerStop}>⏹</button>
    </>
  ) : (
    // 未运行的计时器
    <button onClick={() => onTimerStart?.(tag.id)}>
      ⏱️ 开始计时
    </button>
  )}
</div>
```

### 4. **删除按钮**

```typescript
<button
  onClick={() => {
    if (confirm(`确定要删除 "${tag.name}" 吗？`)) {
      deleteTag(tag.id);
    }
  }}
  style={{
    opacity: hoveredTagId === tag.id ? 1 : 0, // 悬停时显示
    transition: 'opacity 0.2s',
    cursor: 'pointer',
    color: '#ef4444'
  }}
  title="删除标签"
>
  🗑️
</button>
```

---

## 🎯 与 Plan 编辑器的差距对比

### TagManager 的优势

| 特性 | TagManager | 当前 Plan 编辑器 | 差距 |
|------|-----------|----------------|-----|
| **多行编辑** | ✅ 每行独立 contentEditable | ❌ 单个卡片编辑 | 巨大 |
| **键盘导航** | ✅ Enter/↑/↓ 快速切换 | ❌ 需要鼠标点击 | 巨大 |
| **层级缩进** | ✅ Tab/Shift+Tab | ❌ 无层级概念 | 巨大 |
| **位置移动** | ✅ Shift+Alt+↑/↓ | ❌ 无快捷键 | 巨大 |
| **批量操作** | ✅ 文本选区批量编辑 | ❌ 无批量功能 | 巨大 |
| **自动保存** | ✅ 失焦自动保存 | ❌ 需要点击保存 | 中等 |
| **Gray Text 提示** | ✅ 始终显示操作提示 | ❌ 弹窗提示遮挡 | 中等 |
| **FloatingToolbar** | ❌ 无富文本功能 | ✅ 有文本格式化 | 小 |

### 建议改进方向

#### 1. **改造 Plan 为多行编辑器**

```typescript
// 将 PlanItem 列表改为类似 TagManager 的结构
<div className="plan-items">
  {planItems.map((item, index) => (
    <div key={item.id} className="plan-item-row">
      {/* 左侧：缩进 + contentEditable 标题 */}
      <div style={{ paddingLeft: `${item.level * 24}px` }}>
        <span
          data-item-id={item.id}
          contentEditable
          onBlur={(e) => handleSave(item.id, e.currentTarget.textContent)}
          onKeyDown={(e) => handleKeyDown(e, item.id, item.level)}
        >
          {item.title}
        </span>
      </div>
      
      {/* 右侧：功能按钮 */}
      <div className="item-actions">
        <button onClick={() => toggleComplete(item.id)}>
          {item.isCompleted ? '✓' : '○'}
        </button>
        {/* 更多按钮... */}
      </div>
    </div>
  ))}
  
  {/* Gray Text 提示区域 */}
  <div className="gray-text-placeholder">
    # 按 Enter 创建计划，Tab/Shift+Tab 调整层级，/ 打开命令面板
  </div>
</div>
```

#### 2. **用 Gray Text 替代 FloatingToolbar 提示**

❌ 移除：`<span className="floating-toolbar-hint">按 Ctrl+/ 切换工具栏</span>`

✅ 改为：在最后一行显示固定的 Gray Text：
```
# 按 Enter 创建任务，/ 插入命令，Tab 缩进，Shift+Alt+↑/↓ 移动
```

#### 3. **实现 Shift+Enter 创建同级项**

```typescript
const handleKeyDown = (e: React.KeyboardEvent, itemId: string, level: number) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    if (e.shiftKey) {
      // Shift+Enter: 创建同级项
      createSiblingItem(itemId, level);
    } else {
      // Enter: 创建子项
      createChildItem(itemId, level + 1);
    }
  } else if (e.key === 'Tab') {
    e.preventDefault();
    if (e.shiftKey) {
      decreaseIndent(itemId);
    } else {
      increaseIndent(itemId);
    }
  }
}
```

#### 4. **添加 / 命令面板**

```typescript
const handleKeyDown = (e: React.KeyboardEvent) => {
  if (e.key === '/' && !e.ctrlKey) {
    e.preventDefault();
    // 打开命令面板
    showCommandPalette({
      position: getCursorPosition(),
      commands: [
        { icon: '✓', label: '待办事项', action: insertTodo },
        { icon: '📅', label: '时间选择', action: insertTime },
        { icon: '🏷️', label: '添加标签', action: insertTag },
        { icon: '😊', label: '插入表情', action: insertEmoji },
        { icon: '@', label: '引用事件', action: insertMention }
      ]
    });
  }
}
```

---

## 📝 总结

TagManager 的核心设计思想是**"零鼠标操作"**：

1. **contentEditable 多行编辑**：每行独立编辑，Enter 创建新行
2. **键盘快捷键完整覆盖**：创建、导航、缩进、移动、批量操作
3. **Gray Text 固定提示**：始终可见，不遮挡内容
4. **自动保存机制**：失焦即保存，无需手动点击
5. **批量操作支持**：通过文本选区实现智能批量编辑

**建议 Plan 编辑器全面参考 TagManager 的设计**，特别是：
- 改为多行 contentEditable 结构
- 用 Gray Text 替代 FloatingToolbar 提示
- 实现完整的键盘快捷键
- 添加 / 命令面板触发 FloatingToolbar

---

**创建日期**: 2025-10-28  
**版本**: 1.0.0
