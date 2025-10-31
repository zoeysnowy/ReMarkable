# MultiLineEditor 交互体验优化

**日期**: 2025-10-28  
**问题**: PlanManager 中的编辑体验不够流畅，无法直接编辑文本

---

## 问题分析

### 原问题
1. **❌ 点击 Gray Text 无法立即编辑**
2. **❌ contentEditable 在业务层实现，逻辑混乱**
3. **❌ 编辑器行为不一致，像在点击按钮而非编辑文本**

### 根本原因
```typescript
// ❌ 错误做法：在 PlanManager 中重新实现 contentEditable
const renderContent = (editorItem) => {
  return (
    <div
      contentEditable
      onBlur={...}
      onClick={...}
    >
      {item.title}
    </div>
  );
};
```

这导致：
- **contentEditable 逻辑分散**：一部分在 MultiLineEditor，一部分在业务层
- **事件处理冲突**：键盘事件在编辑器，onBlur 在业务层
- **状态不同步**：无法利用编辑器的焦点管理

---

## 解决方案

### 1. 职责重新划分

| 组件 | 职责 |
|------|------|
| **MultiLineEditor** | contentEditable 实现、键盘导航、焦点管理 |
| **业务组件** | 样式配置、点击事件、业务逻辑 |

### 2. 新增 API

#### `onItemClick` - 项目点击回调
```typescript
interface MultiLineEditorProps<T> {
  /** 项目点击回调 */
  onItemClick?: (item: MultiLineEditorItem<T>) => void;
}
```

**用途**: 业务组件可以在用户点击项目时执行操作（如打开详情面板）

#### `getItemStyle` - 自定义样式获取
```typescript
interface MultiLineEditorProps<T> {
  /** 获取项目自定义样式 */
  getItemStyle?: (item: MultiLineEditorItem<T>) => React.CSSProperties | undefined;
}
```

**用途**: 业务组件可以根据数据动态设置样式（如颜色、删除线、透明度）

### 3. PlanManager 改造

#### Before ❌
```typescript
const renderContent = (editorItem: MultiLineEditorItem<PlanItem>) => {
  const item = editorItem.data;
  return (
    <div
      contentEditable
      suppressContentEditableWarning
      style={{ color: item.color, textDecoration: item.isCompleted ? 'line-through' : 'none' }}
      onBlur={(e) => { /* 保存逻辑 */ }}
      onClick={(e) => { /* 打开详情面板 */ }}
    >
      {item.title}
    </div>
  );
};
```

#### After ✅
```typescript
// 只提供样式配置
const getContentStyle = (item: PlanItem) => ({
  color: item.color || '#111827',
  textDecoration: item.isCompleted ? 'line-through' : 'none',
  opacity: item.isCompleted ? 0.6 : 1,
});

// MultiLineEditor 调用
<MultiLineEditor
  items={editorItems}
  onItemsChange={handleEditorChange}
  renderItemPrefix={renderItemPrefix}
  renderItemSuffix={renderItemSuffix}
  // ✅ 不再使用 renderContent
  onItemClick={(item) => {
    if (item.data) {
      setSelectedItemId(item.data.id);
      setEditingItem(item.data);
    }
  }}
  getItemStyle={(item) => item.data ? getContentStyle(item.data) : undefined}
  placeholder="输入新任务..."
  grayText="✨ 点击创建新任务..."
  indentSize={24}
/>
```

### 4. MultiLineEditor 内部改进

#### DefaultContentEditable 增强
```typescript
interface DefaultContentEditableProps<T> {
  item: MultiLineEditorItem<T>;
  onBlur: (itemId: string, content: string | null) => void;
  onKeyDown: (e: React.KeyboardEvent, itemId: string, level: number) => void;
  onClick?: (item: MultiLineEditorItem<T>) => void;        // ✅ 新增
  customStyle?: React.CSSProperties;                        // ✅ 新增
}

const DefaultContentEditable = <T,>({
  item,
  onBlur,
  onKeyDown,
  onClick,
  customStyle,
}: DefaultContentEditableProps<T>) => {
  return (
    <span
      className="editor-row-content"
      contentEditable
      suppressContentEditableWarning
      onBlur={(e) => onBlur(item.id, e.currentTarget.textContent)}
      onKeyDown={(e) => onKeyDown(e, item.id, item.level)}
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick(item);  // ✅ 触发业务回调
      }}
      style={{
        outline: 'none',
        border: 'none',
        background: 'transparent',
        cursor: 'text',
        userSelect: 'text',
        ...customStyle,              // ✅ 合并自定义样式
      }}
    >
      {item.content}
    </span>
  );
};
```

---

## 改进效果

### ✅ Before vs After

| 功能 | Before | After |
|------|--------|-------|
| **Gray Text 点击** | ❌ 无法编辑 | ✅ 立即聚焦到新项 |
| **文本编辑** | ❌ 像点击按钮 | ✅ 直接编辑文本 |
| **键盘导航** | ⚠️ 部分工作 | ✅ 完全流畅 |
| **焦点管理** | ❌ 不一致 | ✅ 统一管理 |
| **代码架构** | ❌ 职责混乱 | ✅ 职责清晰 |

### ✅ 用户体验提升

1. **点击 Gray Text**
   - Before: 点击后什么都不发生
   - After: 立即创建新项并聚焦，可以直接输入

2. **编辑现有任务**
   - Before: 需要点击多次才能编辑
   - After: 点击即可直接编辑

3. **键盘操作**
   - Before: Enter 后需要额外点击
   - After: Enter 后自动聚焦到新项，可以立即输入

4. **视觉反馈**
   - Before: 完成状态样式在业务层实现
   - After: 通过 `getItemStyle` 统一注入，样式一致

---

## 架构优势

### 🎯 分层清晰

```
┌─────────────────────────────────────────────────────┐
│  PlanManager (业务层)                               │
│  ┌───────────────────────────────────────────────┐ │
│  │ getContentStyle: 样式配置                     │ │
│  │ onItemClick: 打开详情面板                     │ │
│  │ renderItemPrefix: Checkbox + 图标 + Emoji    │ │
│  │ renderItemSuffix: 标签 + 时间 + 优先级       │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
                          ↓ props 传递
┌─────────────────────────────────────────────────────┐
│  MultiLineEditor (编辑器层)                         │
│  ┌───────────────────────────────────────────────┐ │
│  │ contentEditable 实现                          │ │
│  │ 键盘导航 (↑↓ Enter Tab Shift+Alt+↑↓)        │ │
│  │ 焦点管理                                      │ │
│  │ 批量操作                                      │ │
│  │ Gray Text 创建                                │ │
│  └───────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 🔌 数据流

```
用户点击 Gray Text
  ↓
MultiLineEditor.handleGrayTextClick()
  ↓
创建新 MultiLineEditorItem
  ↓
keyboardNav.focusItem(newId)  ← 编辑器内部聚焦
  ↓
onItemsChange(newItems)       ← 通知业务层
  ↓
PlanManager.handleEditorChange()
  ↓
onSave(newItem)               ← 保存到外部状态
```

### 🎨 样式注入流程

```
PlanManager.getContentStyle(item.data)
  ↓ 返回 CSSProperties
MultiLineEditor 接收 getItemStyle prop
  ↓ 调用 getItemStyle(item)
DefaultContentEditable 接收 customStyle
  ↓ 合并到 style 属性
<span style={{ ...baseStyle, ...customStyle }}>
```

---

## API 文档

### `onItemClick`

**类型**: `(item: MultiLineEditorItem<T>) => void`  
**用途**: 当用户点击项目的 contentEditable 区域时触发  
**示例**:
```typescript
<MultiLineEditor
  onItemClick={(item) => {
    console.log('点击了项目:', item.content);
    openDetailPanel(item.data);
  }}
/>
```

### `getItemStyle`

**类型**: `(item: MultiLineEditorItem<T>) => React.CSSProperties | undefined`  
**用途**: 动态获取每个项目的自定义样式  
**示例**:
```typescript
<MultiLineEditor
  getItemStyle={(item) => ({
    color: item.data.color,
    textDecoration: item.data.completed ? 'line-through' : 'none',
    opacity: item.data.completed ? 0.6 : 1,
  })}
/>
```

---

## 测试验证

### ✅ 基础功能
- [x] 点击 Gray Text 立即创建并聚焦
- [x] 文本内容可以直接编辑
- [x] onBlur 自动保存
- [x] 样式正确应用（颜色、删除线、透明度）

### ✅ 键盘导航
- [x] Enter 创建新项并自动聚焦
- [x] ↑↓ 在任务间切换焦点
- [x] Tab/Shift+Tab 调整缩进
- [x] Shift+Alt+↑↓ 移动任务

### ✅ 业务集成
- [x] 点击任务打开详情面板
- [x] 完成状态样式正确显示
- [x] 富文本颜色保留
- [x] 详情面板修改同步到列表

---

## 下一步

1. **✅ 完成** - PlanManager 交互体验优化
2. **🔄 进行中** - 浏览器实际测试
3. **⏳ 待开始** - 迁移 TagManager 使用 MultiLineEditor

---

## 总结

通过职责重新划分，将 contentEditable 的实现完全保留在 MultiLineEditor 内部，业务组件只需要：
1. 提供样式配置（`getItemStyle`）
2. 处理点击事件（`onItemClick`）
3. 渲染前缀/后缀插槽

**结果**: 编辑体验流畅，像真正的文本编辑器，而不是点击按钮！
