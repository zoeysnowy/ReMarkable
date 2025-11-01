# Plan 页面双模式输入功能指南

## 功能概述

Plan 页面现在支持 **Title/Description 双模式** 输入，提供更灵活的任务管理体验。每个计划项可以有一个标题和一个可选的描述，通过键盘快捷键轻松切换。

## 架构设计

### 数据模型

**PlanItem 接口更新**:
```typescript
export interface PlanItem {
  id: string;
  title: string;
  content?: string;          // HTML 格式的标题内容
  mode?: 'title' | 'description'; // 🆕 当前模式
  description?: string;      // 🆕 HTML 格式的描述内容
  // ...其他字段
}
```

### 编辑器结构

**FreeFormEditor 行模型**:
- 每个 PlanItem 最多生成 2 行：
  1. **Title 行**: `id = item.id`
  2. **Description 行**: `id = item.id + '-desc'` (仅在有 description 时)

**行数据映射** (PlanManager.tsx):
```typescript
const editorLines = useMemo(() => {
  const lines: FreeFormLine<PlanItem>[] = [];
  
  items.forEach((item) => {
    // Title 行
    lines.push({
      id: item.id,
      content: item.content || item.title,
      level: item.level || 0,
      data: { ...item, mode: item.mode || 'title' },
    });
    
    // Description 行（条件渲染）
    if (item.description && item.mode === 'description') {
      lines.push({
        id: `${item.id}-desc`,
        content: item.description,
        level: (item.level || 0) + 1, // 缩进一级
        data: { ...item, mode: 'description' },
      });
    }
  });
  
  return lines;
}, [items]);
```

## 用户交互

### 键盘快捷键

| 快捷键 | 模式 | 行为 |
|--------|------|------|
| **Shift+Enter** | Title | 创建 Description 行，聚焦到 Description |
| **Shift+Tab** | Description | 返回 Title 行（空内容则删除 Description 行） |
| **Enter** | Title | 创建新的 Title 行（新事件） |
| **Enter** | Description (空) | 创建新的 Title 行（新事件） |
| **Enter** | Description (有内容) | 在 Description 内换行（多行编辑） |
| **Tab** | Title | 增加缩进 |
| **Shift+Tab** | Title | 减少缩进 |

### 视觉区分

**Title 模式**:
- 正常字体大小 (14px)
- 黑色文字 (`#111827`)
- 显示 Checkbox 前缀
- 显示 More 图标后缀
- 无额外缩进

**Description 模式**:
- 较小字体 (13px)
- 灰色文字 (`#6b7280`)
- 斜体样式 (`italic`)
- 额外缩进一级 (24px)
- 不显示 Checkbox 和 More 图标
- 行高 1.6（更好的多行阅读体验）

**实现代码** (FreeFormEditor.tsx):
```typescript
const isDescriptionMode = (line.data as any)?.mode === 'description';

<span
  className={`line-text ${isDescriptionMode ? 'description-mode' : ''}`}
  style={{
    // ...基础样式
    ...(isDescriptionMode && {
      fontSize: '13px',
      color: '#6b7280',
      lineHeight: '1.6',
      fontStyle: 'italic',
    }),
  }}
/>
```

## 核心实现

### 1. 模式切换逻辑 (FreeFormEditor.tsx)

**Title → Description (Shift+Enter)**:
```typescript
if (e.key === 'Enter' && e.shiftKey && !isDescriptionMode) {
  e.preventDefault();
  
  // 创建新的 description 行
  const descLine: FreeFormLine<T> = {
    id: `${lineId}-desc`,
    content: '',
    level: level + 1,
    data: { ...(currentLine.data || {}), mode: 'description' } as T,
  };
  
  // 插入到当前行后面
  const newLines = [
    ...lines.slice(0, currentIndex + 1),
    descLine,
    ...lines.slice(currentIndex + 1),
  ];
  
  onLinesChange(newLines);
  
  // 聚焦到新行
  setTimeout(() => {
    document.querySelector(`[data-line-id="${descLine.id}"]`)?.focus();
  }, 10);
}
```

**Description → Title (Shift+Tab)**:
```typescript
if (e.key === 'Tab' && e.shiftKey && isDescriptionMode) {
  e.preventDefault();
  
  const target = e.currentTarget as HTMLElement;
  const isEmpty = target.textContent?.trim() === '';
  
  // 保存非空内容
  if (!isEmpty) {
    handleLineBlur(lineId, target);
  }
  
  // 空内容则删除行，否则保留
  const newLines = isEmpty 
    ? lines.filter(l => l.id !== lineId)
    : lines;
  
  onLinesChange(newLines);
  
  // 聚焦到 title 行
  const titleLineId = lineId.replace('-desc', '');
  setTimeout(() => {
    const element = document.querySelector(`[data-line-id="${titleLineId}"]`);
    element?.focus();
    // 光标移到末尾...
  }, 10);
}
```

**Enter in Description Mode**:
```typescript
if (e.key === 'Enter' && !e.shiftKey && isDescriptionMode) {
  e.preventDefault();
  
  const target = e.currentTarget as HTMLElement;
  const isEmpty = target.textContent?.trim() === '';
  
  if (isEmpty) {
    // 空内容：创建新事件
    const newLine: FreeFormLine<T> = {
      id: `line-${Date.now()}`,
      content: '',
      level: 0,
      data: { mode: 'title' } as T,
    };
    // 插入并聚焦...
  } else {
    // 有内容：允许多行（浏览器默认 <br>）
    return;
  }
}
```

### 2. 数据同步 (PlanManager.tsx)

**handleLinesChange 更新**:
```typescript
const handleLinesChange = (newLines: FreeFormLine<PlanItem>[]) => {
  // 按 item id 分组
  const itemGroups = new Map<string, { title?, description? }>();
  
  newLines.forEach((line) => {
    const itemId = line.id.includes('-desc') 
      ? line.id.replace('-desc', '') 
      : line.id;
    const isDescription = line.id.includes('-desc') || line.data?.mode === 'description';
    
    if (!itemGroups.has(itemId)) {
      itemGroups.set(itemId, {});
    }
    
    const group = itemGroups.get(itemId)!;
    if (isDescription) {
      group.description = line;
    } else {
      group.title = line;
    }
  });
  
  // 处理每个组
  itemGroups.forEach((group, itemId) => {
    const titleLine = group.title;
    const descLine = group.description;
    
    if (!titleLine) return;
    
    // 提取标签和纯文本...
    
    const updatedItem: PlanItem = { 
      ...titleLine.data, 
      title: plainText,
      content: titleLine.content,
      tags: extractedTags,
      level: titleLine.level,
      mode: (descLine ? 'description' : 'title') as 'title' | 'description',
      description: descLine?.content || undefined,
    };
    
    onSave(updatedItem);
  });
};
```

## 使用流程示例

### 场景 1: 创建带描述的任务

1. 用户输入标题 "完成项目报告"
2. 按 `Shift+Enter` → 进入 Description 模式
3. 输入多行描述:
   ```
   - 收集数据
   - 分析结果
   - 撰写结论
   ```
4. 按 `Shift+Tab` → 返回 Title（Description 保留）
5. 按 `Enter` → 创建新任务

### 场景 2: 编辑描述

1. 点击 More 图标 → 打开 EventEditModal
2. 在 Modal 中编辑完整描述
3. 保存 → 更新 `item.description`
4. Description 行自动显示更新内容

### 场景 3: 删除描述

1. 在 Description 行按 `Ctrl+A` → 全选
2. 按 `Delete` → 清空内容
3. 按 `Shift+Tab` → 返回 Title（空 Description 被删除）

## Tab 键行为冲突解决

**问题**: `Shift+Tab` 用于两个功能：
- Title 模式：减少缩进
- Description 模式：返回 Title

**解决方案**: 条件判断优先级
```typescript
// 1. Description → Title (最高优先级)
if (e.key === 'Tab' && e.shiftKey && isDescriptionMode) {
  // 处理模式切换
  return;
}

// 2. Title 缩进控制
else if (e.key === 'Tab' && e.shiftKey && !isDescriptionMode) {
  // 处理缩进减少
}
```

## 注意事项

### 1. ID 命名约定
- Title 行: `item.id`
- Description 行: `item.id + '-desc'`
- 必须保持一致，用于关联和查找

### 2. 数据持久化
- Title 和 Description 都存储 HTML 格式
- 通过 `handleLineBlur` 自动保存
- `Shift+Tab` 时手动触发保存（非空内容）

### 3. 前缀/后缀渲染
- Description 行不渲染 `renderLinePrefix` (Checkbox)
- Description 行不渲染 `renderLineSuffix` (More 图标)
- 通过条件判断 `isDescriptionMode` 控制

### 4. 多行编辑支持
- Description 模式下 Enter 不阻止默认行为
- 浏览器插入 `<br>` 实现多行
- HTML 格式保留完整格式

## 后续增强

### 待实现功能

1. **FloatingBar 自动关联** (任务 4)
   - Title 模式: Tag/Time 关联到 Event 元数据
   - Description 模式: Tag/Time 仅显示为 mention

2. **Tiptap 富文本编辑** (任务 5)
   - 替换 Description 的 contentEditable
   - 支持格式化: 粗体、斜体、列表、链接
   - HTML 输出兼容当前存储格式

3. **add_task 开关** (任务 6)
   - FloatingBar 新增 toggle 按钮
   - 控制 Event.isTask 字段
   - 影响 TimeCalendar 显示位置

### 性能优化

- [ ] 使用 React.memo 优化 line 渲染
- [ ] 防抖 handleLinesChange 调用
- [ ] 虚拟滚动支持长列表

### 用户体验

- [ ] 添加视觉提示 (placeholder: "按 Shift+Enter 添加描述")
- [ ] 模式切换动画效果
- [ ] 键盘快捷键帮助面板

## 相关文件

- `src/components/PlanManager.tsx` - 主组件，数据映射和同步
- `src/components/MultiLineEditor/FreeFormEditor.tsx` - 编辑器，键盘逻辑和渲染
- `src/components/MultiLineEditor/FreeFormEditor.css` - 基础样式
- `src/components/PlanManager.css` - Plan 页面样式

## 测试场景

### 功能测试

- [x] Shift+Enter 创建 Description 行
- [x] Shift+Tab 返回 Title（保留非空内容）
- [x] Shift+Tab 返回 Title（删除空内容）
- [x] Enter in Description (空) 创建新事件
- [x] Enter in Description (有内容) 多行编辑
- [x] 视觉样式正确（字体、颜色、缩进）
- [x] 前缀/后缀不显示在 Description 行

### 数据测试

- [x] Title + Description 正确保存
- [x] Description 更新正确同步
- [x] Description 删除后 mode 切回 title
- [x] 标签提取仅在 Title 行
- [x] Level 缩进正确传递

### 边界测试

- [ ] 快速连续模式切换
- [ ] 大量多行 Description 性能
- [ ] 特殊字符 HTML 转义
- [ ] 刷新后数据恢复

---

**文档版本**: v1.0  
**创建时间**: 2025-01-02  
**最后更新**: 2025-01-02
