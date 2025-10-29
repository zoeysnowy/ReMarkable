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
