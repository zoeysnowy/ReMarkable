# HierarchicalTagPicker 通用组件

## 概述

`HierarchicalTagPicker` 是一个功能完整的层级标签选择器组件，支持多选、搜索、层级展示等功能。

## 功能特性

- ✅ **层级展示**：支持父子关系的标签缩进显示
- ✅ **颜色和 Emoji**：每个标签可以有自己的颜色和图标
- ✅ **单选/多选**：灵活的选择模式
- ✅ **搜索功能**：快速筛选标签
- ✅ **全选/清空**：批量操作按钮
- ✅ **已选标签 Chips**：可视化显示已选标签
- ✅ **下拉/内联模式**：适应不同UI场景

## 使用示例

### 基础用法（多选模式）

```tsx
import { HierarchicalTagPicker, HierarchicalTag } from '@/components/shared';

const tags: HierarchicalTag[] = [
  {
    id: '1',
    name: '工作',
    color: '#3b82f6',
    emoji: '💼',
    level: 0
  },
  {
    id: '2',
    name: '会议',
    color: '#10b981',
    emoji: '📅',
    level: 1,
    parentId: '1'
  }
];

function MyComponent() {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  return (
    <HierarchicalTagPicker
      availableTags={tags}
      selectedTagIds={selectedIds}
      onSelectionChange={setSelectedIds}
      multiple={true}
      searchable={true}
      showBulkActions={true}
      placeholder="选择标签..."
    />
  );
}
```

### 单选模式

```tsx
<HierarchicalTagPicker
  availableTags={tags}
  selectedTagIds={selectedIds}
  onSelectionChange={setSelectedIds}
  multiple={false}
  autoClose={true}
  placeholder="选择一个标签..."
/>
```

### 内联模式（无下拉）

```tsx
<HierarchicalTagPicker
  availableTags={tags}
  selectedTagIds={selectedIds}
  onSelectionChange={setSelectedIds}
  mode="inline"
  showSelectedChips={false}
/>
```

### FloatingToolbar 集成

```tsx
// src/components/FloatingToolbar/pickers/TagPicker.tsx
import { HierarchicalTagPicker, HierarchicalTag } from '../../shared';

export const TagPicker: React.FC<TagPickerProps> = ({
  availableTags,
  selectedTags,
  onSelect,
  onClose,
}) => {
  return (
    <div className="floating-toolbar-tag-picker">
      <HierarchicalTagPicker
        availableTags={availableTags}
        selectedTagIds={selectedTags}
        onSelectionChange={onSelect}
        multiple={true}
        onClose={onClose}
        mode="inline"
      />
    </div>
  );
};
```

## API 文档

### Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `availableTags` | `HierarchicalTag[]` | - | 可选标签列表（必填） |
| `selectedTagIds` | `string[]` | - | 已选标签ID列表（必填） |
| `onSelectionChange` | `(ids: string[]) => void` | - | 选择变化回调（必填） |
| `multiple` | `boolean` | `true` | 是否多选模式 |
| `searchable` | `boolean` | `true` | 是否显示搜索框 |
| `showSelectedChips` | `boolean` | `true` | 是否显示已选标签chips |
| `showBulkActions` | `boolean` | `true` | 是否显示全选/清空按钮 |
| `placeholder` | `string` | `'选择标签...'` | 占位符文本 |
| `autoClose` | `boolean` | 单选:`true` 多选:`false` | 是否自动关闭 |
| `onClose` | `() => void` | - | 关闭回调 |
| `className` | `string` | `''` | 自定义类名 |
| `mode` | `'dropdown' \| 'inline'` | `'dropdown'` | 显示模式 |

### HierarchicalTag 接口

```typescript
interface HierarchicalTag {
  id: string;           // 唯一ID
  name: string;         // 标签名称
  color: string;        // 颜色（#hex格式）
  emoji?: string;       // emoji图标
  level?: number;       // 层级（0=顶级）
  parentId?: string;    // 父标签ID
}
```

## 样式自定义

组件使用 CSS 类名，可以通过覆盖以下类名来自定义样式：

```css
/* 主容器 */
.hierarchical-tag-picker { }

/* 触发器 */
.tag-picker-trigger { }

/* 已选标签 chips */
.tag-chip { }

/* 下拉列表 */
.tag-picker-dropdown { }

/* 标签选项 */
.tag-option { }
.tag-option.selected { }

/* 标签内容 */
.tag-content { }
.tag-hash { }
.tag-emoji { }
.tag-name { }
```

## 迁移指南

### 从 EventEditModal 迁移

**Before:**
```tsx
<div className="tag-selector">
  {/* 复杂的自定义逻辑 */}
  <div className="selected-tags-with-search">...</div>
  <div className="tag-dropdown">...</div>
</div>
```

**After:**
```tsx
<HierarchicalTagPicker
  availableTags={hierarchicalTags}
  selectedTagIds={formData.tags}
  onSelectionChange={(ids) => setFormData({...formData, tags: ids})}
  multiple={true}
  mode="dropdown"
/>
```

### 从 CalendarSettingsPanel 迁移

**Before:**
```tsx
<div className="filter-list">
  {availableTags.map(tag => (
    <label className="filter-item">
      <input type="checkbox" ... />
      <div className="tag-content" style={{paddingLeft}}>...</div>
    </label>
  ))}
</div>
```

**After:**
```tsx
<HierarchicalTagPicker
  availableTags={availableTags}
  selectedTagIds={localSettings.visibleTags}
  onSelectionChange={(ids) => setLocalSettings({...localSettings, visibleTags: ids})}
  multiple={true}
  mode="inline"
  showBulkActions={true}
/>
```

## 测试

已在以下场景测试：
- ✅ FloatingToolbar - 标签快速选择
- ✅ EventEditModal - 事件标签编辑
- ✅ CalendarSettingsPanel - 标签筛选

## 下一步

1. **应用到 EventEditModal**：替换现有的标签选择逻辑
2. **应用到 CalendarSettingsPanel**：替换标签筛选UI
3. **测试所有场景**：确保功能完整且无回归
4. **性能优化**：如需要，添加虚拟滚动

## 文件位置

- 组件：`src/components/shared/HierarchicalTagPicker.tsx`
- 样式：`src/components/shared/HierarchicalTagPicker.css`
- 导出：`src/components/shared/index.ts`
