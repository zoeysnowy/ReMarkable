# PlanManager 完整重构计划

**目标**: 实现 TagManager 级别的编辑体验

---

## 🎯 核心需求

### 1. 双模式编辑
- **标题模式** (默认)
  - 单行文本
  - Enter → 创建新任务
  - Shift+Enter → 进入描述模式
  - Tab/Shift+Tab → 调整层级

- **描述模式**
  - 多行文本
  - Enter → 换行（在描述内继续编辑）
  - Escape 或点击 Gray Text → 退出描述模式，回到标题模式

### 2. FloatingToolbar 集成
- Ctrl+/ → 打开 FloatingToolbar
- 插入元素：
  - ⏰ 时间（RangeTimePicker）
  - 🏷️ 标签
  - 😊 Emoji
  - 🎨 颜色

### 3. 最小化详情面板
- 只在用户明确点击"更多"按钮时打开
- 大部分编辑在列表内完成

---

## 📋 实现步骤

### Phase 1: ✅ 基础修复（已完成）
- [x] 删除重复的 Checkbox
- [x] 恢复 FloatingToolbar
- [x] 修复 getTypeIcon 返回空字符串

### Phase 2: 🔄 数据结构扩展
#### 2.1 扩展 MultiLineEditorItem
```typescript
export interface MultiLineEditorItem<T = any> {
  id: string;
  content: string;           // 标题
  description?: string;      // ✅ 新增：描述（多行）
  level: number;
  position: number;
  parentId?: string;
  data?: T;
  isDescriptionMode?: boolean; // ✅ 新增：是否在描述编辑模式
}
```

#### 2.2 更新 PlanItem 映射
```typescript
const editorItems = useMemo<MultiLineEditorItem<PlanItem>[]>(() => {
  return items.map((item, index) => ({
    id: item.id,
    content: item.title,
    description: item.notes,     // ✅ 映射描述
    level: 0,
    position: index,
    parentId: undefined,
    data: item,
    isDescriptionMode: false,
  }));
}, [items]);
```

### Phase 3: 🔄 MultiLineEditor 键盘逻辑增强
#### 3.1 修改 Enter 键处理
```typescript
// 在 MultiLineEditor.tsx handleItemKeyDown
if (e.key === 'Enter') {
  const item = items.find(i => i.id === itemId);
  
  // 如果在描述模式，Enter 只换行
  if (item?.isDescriptionMode && !e.shiftKey) {
    // 不阻止默认行为，让 contentEditable 换行
    return;
  }
  
  // 标题模式 + Enter: 创建新任务
  if (!e.shiftKey && !item?.isDescriptionMode) {
    e.preventDefault();
    const { newItemId, newItems } = keyboardNav.createSiblingItem(...);
    // ...
  }
  
  // 标题模式 + Shift+Enter: 进入描述模式
  if (e.shiftKey && !item?.isDescriptionMode) {
    e.preventDefault();
    const updatedItems = items.map(i => 
      i.id === itemId 
        ? { ...i, isDescriptionMode: true }
        : i
    );
    onItemsChange(updatedItems);
    // 聚焦到描述编辑区域
    setTimeout(() => {
      const descEl = document.querySelector(`[data-description-id="${itemId}"]`);
      (descEl as HTMLElement)?.focus();
    }, 50);
  }
}
```

#### 3.2 添加 Escape 键退出描述模式
```typescript
if (e.key === 'Escape') {
  const item = items.find(i => i.id === itemId);
  if (item?.isDescriptionMode) {
    e.preventDefault();
    const updatedItems = items.map(i => 
      i.id === itemId 
        ? { ...i, isDescriptionMode: false }
        : i
    );
    onItemsChange(updatedItems);
  }
}
```

### Phase 4: 🔄 渲染增强
#### 4.1 修改 DefaultContentEditable
```typescript
const DefaultContentEditable = <T,>({
  item,
  onBlur,
  onKeyDown,
  onClick,
  customStyle,
}: DefaultContentEditableProps<T>) => {
  return (
    <div className="editor-content-wrapper">
      {/* 标题 */}
      <div
        className="editor-row-content"
        data-editor-item-id={item.id}
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onBlur(item.id, e.currentTarget.textContent)}
        onKeyDown={(e) => onKeyDown(e, item.id, item.level)}
        onClick={(e) => {
          e.stopPropagation();
          if (onClick) onClick(item);
        }}
        style={{
          outline: 'none',
          border: 'none',
          background: 'transparent',
          cursor: 'text',
          ...customStyle,
        }}
      >
        {item.content}
      </div>
      
      {/* 描述（仅在描述模式显示） */}
      {item.isDescriptionMode && (
        <div
          className="editor-description"
          data-description-id={item.id}
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            // 保存描述
            const updatedItem = { ...item, description: e.currentTarget.textContent || '' };
            // 触发回调
          }}
          style={{
            marginTop: '8px',
            padding: '8px',
            background: '#f9fafb',
            borderRadius: '4px',
            minHeight: '60px',
            fontSize: '14px',
            color: '#6b7280',
          }}
        >
          {item.description || ''}
        </div>
      )}
    </div>
  );
};
```

### Phase 5: 🔄 Gray Text 交互
#### 5.1 点击 Gray Text 退出所有描述模式
```typescript
const handleGrayTextClick = useCallback(() => {
  // 1. 退出所有描述模式
  const updatedItems = items.map(i => ({
    ...i,
    isDescriptionMode: false,
  }));
  onItemsChange(updatedItems);
  
  // 2. 创建新任务
  const { newItemId, newItems } = keyboardNav.createSiblingItem(...);
  setNewItemId(newItemId);
  onItemsChange(newItems);
  
  // 3. 聚焦
  setTimeout(() => {
    keyboardNav.focusItem(newItemId);
  }, 50);
}, [items, keyboardNav, onItemsChange]);
```

### Phase 6: 🔄 FloatingToolbar 功能增强
#### 6.1 添加时间插入
```typescript
// 在 FloatingToolbar 中添加时间按钮
<button onClick={() => {
  // 打开时间选择器
  // 插入时间元素到 contentEditable
}}>
  ⏰ 时间
</button>
```

#### 6.2 添加标签插入
```typescript
<button onClick={() => {
  // 插入标签
  document.execCommand('insertHTML', false, '<span class="tag">#标签</span>');
}}>
  🏷️ 标签
</button>
```

---

## 🎨 样式优化

### 描述编辑区域
```css
.editor-description {
  margin-top: 8px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 6px;
  min-height: 80px;
  font-size: 14px;
  line-height: 1.6;
  color: #6b7280;
  border: 1px dashed #d1d5db;
  transition: all 0.2s;
}

.editor-description:focus {
  background: #fff;
  border-color: #3b82f6;
  outline: none;
}

.editor-description:empty::before {
  content: '输入描述...按 Escape 退出';
  color: #9ca3af;
  pointer-events: none;
}
```

### Gray Text 视觉反馈
```css
.gray-text-placeholder {
  padding: 16px 24px;
  color: #9ca3af;
  font-size: 14px;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  border-radius: 6px;
  margin: 12px 0;
  border: 2px dashed transparent;
}

.gray-text-placeholder:hover {
  background-color: #f3f4f6;
  color: #6b7280;
  border-color: #d1d5db;
}

.gray-text-placeholder:active {
  background-color: #e5e7eb;
  transform: scale(0.98);
}
```

---

## 🧪 测试用例

### 测试 1: 标题 → 描述切换
1. 输入任务标题 "买菜"
2. 按 Shift+Enter
3. **预期**: 进入描述模式，出现描述输入框
4. 输入 "去超市买\n蔬菜\n水果"
5. 按 Escape
6. **预期**: 退出描述模式，描述收起

### 测试 2: Enter 创建新任务
1. 在标题模式输入 "任务1"
2. 按 Enter
3. **预期**: 创建新任务，光标在新任务标题
4. 不应该在描述模式

### 测试 3: Gray Text 退出描述
1. 进入任意任务的描述模式
2. 点击 Gray Text
3. **预期**: 
   - 所有任务退出描述模式
   - 创建新任务
   - 光标在新任务标题

### 测试 4: FloatingToolbar
1. 选中任意文本
2. 按 Ctrl+/
3. **预期**: FloatingToolbar 出现
4. 点击颜色按钮
5. **预期**: 文本颜色改变

### 测试 5: 描述模式 Enter 换行
1. 进入描述模式
2. 按 Enter
3. **预期**: 光标换行，继续在描述中编辑
4. 不应该创建新任务

---

## 📊 优先级

| 功能 | 优先级 | 预计时间 |
|------|--------|----------|
| Phase 2: 数据结构扩展 | 🔴 高 | 30分钟 |
| Phase 3: 键盘逻辑增强 | 🔴 高 | 1小时 |
| Phase 4: 渲染增强 | 🔴 高 | 1小时 |
| Phase 5: Gray Text 交互 | 🟡 中 | 30分钟 |
| Phase 6: FloatingToolbar 增强 | 🟢 低 | 1小时 |
| 样式优化 | 🟢 低 | 30分钟 |

**总计**: 约 4.5 小时

---

## 🚀 下一步行动

1. ✅ **立即开始 Phase 2**: 扩展数据结构
2. ✅ **实现双模式切换**: Shift+Enter / Escape
3. ✅ **Gray Text 退出机制**: 点击 = 退出所有描述模式 + 创建新任务
4. 🔄 **测试验证**: 确保所有键盘快捷键正常工作
5. 🔄 **FloatingToolbar 增强**: 添加时间、标签插入功能

---

## 💡 关键设计决策

### 为什么用 isDescriptionMode 而不是独立组件？
- ✅ **状态管理简单**: 只是一个布尔标志
- ✅ **性能更好**: 不需要挂载/卸载组件
- ✅ **动画流畅**: CSS transition 实现展开/收起

### 为什么 Gray Text 退出所有描述模式？
- ✅ **符合直觉**: 用户点击 Gray Text = "我要创建新任务"
- ✅ **保持专注**: 强制用户回到标题编辑模式
- ✅ **减少混乱**: 避免多个描述同时展开

### 为什么描述模式用 Escape 退出？
- ✅ **标准交互**: Escape = "取消/退出"
- ✅ **不冲突**: 不影响 Enter 换行
- ✅ **快捷方便**: 单键操作，无需组合键

---

准备开始实现？请确认！
