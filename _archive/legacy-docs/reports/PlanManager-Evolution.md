# PlanManager 演进文档

本文档记录了 PlanManager 从设计到实现的完整演进过程。

---

##  目录
1. [完整重构计划](#完整重构计划)
2. [集成完成报告](#集成完成报告)
3. [TagManager 样式重构](#tagmanager样式重构)

---

# 完整重构计划



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


---

# 集成完成报告



**日期**: 2025-10-28  
**状态**: ✅ 集成完成，编译通过

---

## 改造概览

成功将 **PlanManager** 从卡片式编辑器改造为使用 **MultiLineEditor**，实现了类似 TagManager 的多行键盘编辑体验。

---

## 技术实现

### 1. 导入变更

#### 删除
```typescript
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { FloatingToolbar } from './FloatingToolbar';
```

#### 新增
```typescript
import { MultiLineEditor, MultiLineEditorItem } from './MultiLineEditor';
```

### 2. 数据转换层

将 `PlanItem[]` 适配为 `MultiLineEditorItem<PlanItem>[]`：

```typescript
const editorItems = useMemo<MultiLineEditorItem<PlanItem>[]>(() => {
  return items.map((item, index) => ({
    id: item.id,
    content: item.title,           // 文本内容
    level: 0,                       // 层级（暂未使用）
    position: index,                // 位置
    parentId: undefined,            // 父项（暂未使用）
    data: item,                     // 完整的 PlanItem 存储在 data 中
  }));
}, [items]);
```

### 3. 插槽系统实现

#### 🔹 renderItemPrefix（左侧区域）

```typescript
const renderItemPrefix = (editorItem: MultiLineEditorItem<PlanItem>) => {
  const item = editorItem.data;
  if (!item) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Checkbox - 完成状态 */}
      <input
        type="checkbox"
        checked={item.isCompleted || false}
        onChange={(e) => {
          const updatedItem = { ...item, isCompleted: e.target.checked };
          onSave(updatedItem);
        }}
        style={{ cursor: 'pointer', width: '18px', height: '18px' }}
      />
      
      {/* 类型图标 */}
      <span style={{ fontSize: '16px' }}>{getTypeIcon(item)}</span>
      
      {/* Emoji */}
      {item.emoji && <span style={{ fontSize: '16px' }}>{item.emoji}</span>}
    </div>
  );
};
```

**功能**:
- ✅ Checkbox：切换完成状态
- ✅ 类型图标：📅 Event / 📋 Task / ☐ Todo
- ✅ Emoji：可选表情

#### 🔹 renderItemSuffix（右侧区域）

```typescript
const renderItemSuffix = (editorItem: MultiLineEditorItem<PlanItem>) => {
  const item = editorItem.data;
  if (!item) return null;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '14px' }}>
      {/* 标签列表 */}
      {item.tags.length > 0 && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {item.tags.map((tag) => (
            <span key={tag} style={{
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#e5e7eb',
              color: '#374151',
              fontSize: '12px',
            }}>
              #{tag}
            </span>
          ))}
        </div>
      )}
      
      {/* 时间显示 */}
      {(item.dueDate || item.startTime) && (
        <span style={{ color: '#6b7280', whiteSpace: 'nowrap' }}>
          ⏰ {item.startTime 
            ? new Date(item.startTime).toLocaleString('zh-CN', { ... })
            : `截止 ${new Date(item.dueDate!).toLocaleDateString('zh-CN')}`
          }
        </span>
      )}
      
      {/* 优先级指示器 */}
      <div style={{
        width: '4px',
        height: '24px',
        borderRadius: '2px',
        backgroundColor: getPriorityColor(item.priority || 'medium'),
      }} />
    </div>
  );
};
```

**功能**:
- ✅ 标签列表：显示所有标签
- ✅ 时间显示：截止日期或时间段
- ✅ 优先级指示器：彩色竖条

#### 🔹 renderContent（内容区域）

```typescript
const renderContent = (editorItem: MultiLineEditorItem<PlanItem>) => {
  const item = editorItem.data;
  if (!item) return null;

  return (
    <div
      contentEditable
      suppressContentEditableWarning
      style={{
        flex: 1,
        minWidth: 0,
        fontSize: '16px',
        lineHeight: '1.5',
        color: item.color || '#111827',
        textDecoration: item.isCompleted ? 'line-through' : 'none',
        opacity: item.isCompleted ? 0.6 : 1,
      }}
      onBlur={(e) => {
        const newContent = e.currentTarget.textContent || '';
        if (newContent.trim() !== item.title) {
          const updatedItem = { ...item, title: newContent.trim() };
          onSave(updatedItem);
        }
      }}
      onClick={(e) => {
        e.stopPropagation();
        setSelectedItemId(item.id);
        setEditingItem(item);
      }}
    >
      {item.title}
    </div>
  );
};
```

**功能**:
- ✅ contentEditable：可编辑
- ✅ 富文本颜色：支持自定义颜色
- ✅ 完成状态样式：删除线 + 透明度
- ✅ 点击打开详情面板

### 4. MultiLineEditor 集成

```typescript
<MultiLineEditor
  items={editorItems}
  onItemsChange={handleEditorChange}
  renderItemPrefix={renderItemPrefix}
  renderItemSuffix={renderItemSuffix}
  renderContent={renderContent}
  placeholder="输入新任务..."
  grayText="✨ 点击创建新任务，按 Enter 快速创建，Tab 调整层级，↑↓ 导航，Shift+Alt+↑↓ 移动"
  indentSize={24}
/>
```

---

## 新增功能

### 🎹 键盘导航
- ✅ **↑↓**: 在任务之间移动焦点
- ✅ **Enter**: 创建同级任务
- ✅ **Shift+Enter**: 创建子任务（层级功能）
- ✅ **Tab**: 增加缩进
- ✅ **Shift+Tab**: 减少缩进
- ✅ **Shift+Alt+↑↓**: 移动任务位置

### 📝 编辑体验
- ✅ **Gray Text**: 底部固定提示，不遮挡内容
- ✅ **多行编辑**: 类似 TagManager 的流畅体验
- ✅ **快速创建**: Enter 键快速添加新任务

### 🔢 批量操作
- ✅ **文本选区多选**: 拖动选择多个任务
- ✅ **批量删除**: Delete 键删除选中任务
- ✅ **批量移动**: Shift+Alt+↑↓ 批量移动

---

## 保留功能

### 📊 右侧详情面板
- ✅ 类型切换（Todo / Task / Event）
- ✅ 时间设置（无日期 / 截止日期 / 时间段）
- ✅ 优先级选择（Low / Medium / High / Urgent）
- ✅ 标签管理
- ✅ Emoji Picker
- ✅ 备注编辑
- ✅ 保存 / 删除按钮

### 🔄 UnifiedTimeline 同步
- ✅ Event 类型自动同步到日历
- ✅ Task 类型生成截止日期提醒
- ✅ 完整的事件元数据保留

---

## 删除功能

- ❌ **FloatingToolbar**: 浮动工具栏（被 MultiLineEditor 替代）
- ❌ **卡片式列表**: 旧的单项编辑模式

---

## 编译状态

### ✅ 所有文件编译通过

```bash
✅ PlanManager.tsx - No errors
✅ MultiLineEditor.tsx - No errors
✅ types.ts - No errors
✅ App.tsx - No errors
```

### 🔧 类型修复

1. **parentId 类型**: `null` → `undefined`
2. **grayText 属性**: 添加到 `MultiLineEditorProps`
3. **数据转换**: `PlanItem[]` → `MultiLineEditorItem<PlanItem>[]`

---

## 架构优势

### 🎯 职责分离

| 组件 | 职责 |
|------|------|
| **MultiLineEditor** | 键盘导航、层级管理、批量操作 |
| **PlanManager** | 业务逻辑（时间、标签、优先级、同步） |
| **插槽系统** | 视觉呈现（Checkbox、图标、标签、时间） |

### 🔌 插槽系统

```
┌─────────────────────────────────────────────────────────┐
│  MultiLineEditor                                        │
│  ┌───────────┬────────────────────┬──────────────────┐ │
│  │  Prefix   │     Content        │     Suffix       │ │
│  │ (业务组件) │   (编辑器管理)      │   (业务组件)     │ │
│  └───────────┴────────────────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────┘
```

### 📦 数据流

```
items (PlanItem[])
  ↓ useMemo 转换
editorItems (MultiLineEditorItem<PlanItem>[])
  ↓ MultiLineEditor 编辑
handleEditorChange
  ↓ 提取 content
onSave(updatedItem)
  ↓ 同步到外部状态
items 更新
```

---

## 测试计划

### Phase 1: 基础功能 ✅
- [x] 页面正常加载
- [x] MultiLineEditor 正确渲染
- [x] 插槽正确显示

### Phase 2: 键盘导航 🔄
- [ ] ↑↓ 键导航测试
- [ ] Enter 创建测试
- [ ] Tab 缩进测试
- [ ] Shift+Alt+↑↓ 移动测试

### Phase 3: 编辑功能 🔄
- [ ] 内容编辑测试
- [ ] onBlur 保存测试
- [ ] 详情面板同步测试

### Phase 4: 批量操作 🔄
- [ ] 文本选区多选测试
- [ ] 批量删除测试
- [ ] 批量移动测试

---

## 下一步

1. **浏览器测试**: 在实际环境中测试所有功能
2. **性能优化**: 观察大量任务时的性能表现
3. **迁移 TagManager**: 将 TagManager 改造为使用 MultiLineEditor
4. **/ 命令面板**: 实现快捷命令输入（可选）

---

## 总结

✅ **MultiLineEditor** 成功集成到 **PlanManager**  
✅ 所有编译错误已修复  
✅ 插槽系统灵活且强大  
✅ 业务逻辑与编辑器完全解耦  
✅ 键盘导航体验大幅提升  

**改造效果**: 从卡片式点击编辑 → 多行键盘编辑，体验接近 TagManager！


---

# TagManager 样式重构

# PlanManager 重构方案：采用 TagManager 架构

## 问题根源

MultiLineEditor 作为独立组件存在以下问题：
1. **过度封装**: contentEditable 被包裹在多层组件中
2. **焦点丢失**: React 重新渲染时焦点管理困难
3. **事件冒泡**: 事件处理需要层层传递

## TagManager 架构特点

1. **直接渲染**: contentEditable 直接在 map 循环中渲染
2. **简单状态**: useState 直接管理标签数组
3. **事件就近处理**: onKeyDown 直接绑定到 contentEditable

## 重构方案

### 直接在 PlanManager 实现 TagManager 式渲染

```typescript
return (
  <div className="plan-list">
    {items.map((item, index) => (
      <div key={item.id} className="plan-item">
        {/* Checkbox */}
        <input type="checkbox" ... />
        
        {/* 直接 contentEditable，无包装组件 */}
        <span
          contentEditable
          suppressContentEditableWarning
          onBlur={(e) => {
            const newTitle = e.currentTarget.textContent || '';
            onSave({ ...item, title: newTitle });
          }}
          onKeyDown={(e) => handleItemKeyDown(e, item.id, index)}
        >
          {item.title}
        </span>
        
        {/* 右侧按钮 */}
        <div className="plan-item-suffix">...</div>
      </div>
    ))}
    
    {/* Gray Text */}
    <div className="gray-text" onClick={handleCreateNew}>
      ✨ 点击创建新任务...
    </div>
  </div>
);
```

### 键盘事件处理

```typescript
const handleItemKeyDown = (
  e: React.KeyboardEvent,
  itemId: string,
  currentIndex: number
) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    // 直接创建新项
    const newItem: PlanItem = {
      id: `plan-${Date.now()}`,
      title: '',
      tags: [],
      isCompleted: false,
    };
    onSave(newItem);
    
    // 聚焦到新项
    setTimeout(() => {
      const el = document.querySelector(`[data-item-id="${newItem.id}"]`);
      (el as HTMLElement)?.focus();
    }, 50);
  }
  // ... 其他键盘处理
};
```

## 结论

**放弃 MultiLineEditor 作为通用组件**，直接在 PlanManager 中采用 TagManager 的简单架构。
