# FloatingBar 智能关联功能指南

## 功能概述

FloatingBar 现在支持 **智能关联模式**，根据当前编辑的是标题 (Title) 还是描述 (Description) 自动调整标签和时间的关联行为：

- **Title 模式**: Tag/Time → **关联到 Event 元数据**（影响筛选、搜索、日历显示）
- **Description 模式**: Tag/Time → **仅作为 mention 显示**（纯视觉展示，不影响元数据）

## 核心实现

### 1. 模式检测

**PlanManager 新增状态跟踪**:
```typescript
// 保存当前聚焦行的模式
const [currentFocusedMode, setCurrentFocusedMode] = useState<'title' | 'description'>('title');

// 在 focus 事件中检测模式
const handleFocus = (e: FocusEvent) => {
  const target = e.target as HTMLElement;
  const lineId = target.getAttribute('data-line-id');
  
  // 检测是否为 description 行
  const isDescriptionLine = lineId.includes('-desc') || target.classList.contains('description-mode');
  setCurrentFocusedMode(isDescriptionLine ? 'description' : 'title');
};
```

**检测依据**:
1. Line ID 包含 `-desc` 后缀
2. Element 有 `description-mode` class

### 2. 标签关联 (onTagSelect)

**Title 模式**:
```typescript
if (!isDescriptionMode) {
  // 提取标签（只提取非 mention-only 的标签）
  const tagElements = tempDiv.querySelectorAll('.inline-tag:not(.mention-only)');
  const extractedTags: string[] = [];
  tagElements.forEach(tagEl => {
    const tagName = tagEl.getAttribute('data-tag-name');
    if (tagName) extractedTags.push(tagName);
  });
  
  const updatedItem = {
    ...item,
    title: plainText,
    content: updatedContent,
    tags: extractedTags, // 🎯 关联到 Event.tags 元数据
  };
  
  onSave(updatedItem);
}
```

**Description 模式**:
```typescript
if (isDescriptionMode) {
  // 仅更新 description HTML，不提取标签
  const updatedItem = {
    ...item,
    description: updatedContent, // 保存 HTML（包含 mention 标签）
  };
  onSave(updatedItem);
}
```

**视觉区分**:
- Title 模式标签: `class="inline-tag"`
- Description 模式标签: `class="inline-tag mention-only"`

CSS 可选样式差异：
```css
.inline-tag.mention-only {
  opacity: 0.8; /* 可选：降低透明度 */
  font-style: italic; /* 可选：斜体 */
}
```

### 3. 时间关联 (onDateRangeSelect)

**Title 模式**:
```typescript
if (!isDescriptionMode) {
  const updatedItem = {
    ...item,
    content: updatedContent, // HTML 显示
    startTime: start.toISOString(), // 🎯 关联到 Event.startTime
    endTime: end.toISOString(),     // 🎯 关联到 Event.endTime
  };
  onSave(updatedItem);
}
```

**Description 模式**:
```typescript
if (isDescriptionMode) {
  const updatedItem = {
    ...item,
    description: updatedContent, // 仅保存 HTML（包含时间 mention）
    // 不更新 startTime/endTime
  };
  onSave(updatedItem);
}
```

**视觉创建**:
```typescript
const dateSpan = document.createElement('span');
dateSpan.className = isDescriptionMode ? 'inline-date mention-only' : 'inline-date';
dateSpan.setAttribute('data-start-date', start.toISOString());
if (end) {
  dateSpan.setAttribute('data-end-date', end.toISOString());
}
dateSpan.textContent = `📅 ${formatDateDisplay(start, true)}`;
```

## 数据结构

### PlanItem 接口
```typescript
export interface PlanItem {
  id: string;
  title: string;          // Title 纯文本
  content?: string;       // Title HTML（包含标签/时间 span）
  description?: string;   // Description HTML（包含 mention span）
  mode?: 'title' | 'description';
  
  // 🎯 元数据字段（仅 Title 模式关联）
  tags: string[];         // 标签名称数组
  startTime?: string;     // ISO 8601 时间
  endTime?: string;       // ISO 8601 时间
}
```

### HTML 结构对比

**Title 行 HTML**:
```html
完成 <span class="inline-tag" data-tag-id="tag-123" data-tag-name="工作">#工作</span> 报告
<span class="inline-date" data-start-date="2025-01-05T00:00:00Z">📅 1月5日</span>
```
→ 提取: `tags: ['工作']`, `startTime: '2025-01-05T00:00:00Z'`

**Description 行 HTML**:
```html
需要参考 <span class="inline-tag mention-only" data-tag-name="项目">#项目</span> 的资料
预计 <span class="inline-date mention-only" data-start-date="2025-01-10T00:00:00Z">📅 1月10日</span> 完成
```
→ 不提取标签和时间到元数据

## 用户体验流程

### 场景 1: 在标题中添加标签

1. 用户聚焦到 Title 行
2. 选中文本 → FloatingBar 出现
3. 选择标签 "工作"
4. **结果**:
   - 视觉: 插入 `#工作` 蓝色标签 span
   - 元数据: `PlanItem.tags = ['工作']`
   - 影响: 可在 TagManager 筛选，可在搜索中匹配

### 场景 2: 在描述中添加标签

1. 用户按 `Shift+Enter` 进入 Description 行
2. 选中文本 → FloatingBar 出现
3. 选择标签 "项目"
4. **结果**:
   - 视觉: 插入 `#项目` 蓝色标签 span（mention-only）
   - 元数据: `PlanItem.tags` **不变**
   - 影响: 仅作为描述文本的一部分，不影响筛选

### 场景 3: 在标题中添加时间

1. 用户聚焦到 Title 行
2. 选择日期范围 "1月5日 - 1月7日"
3. **结果**:
   - 视觉: 插入 `📅 1月5日 - 1月7日` span
   - 元数据: `startTime: '2025-01-05T00:00:00Z'`, `endTime: '2025-01-07T23:59:59Z'`
   - 影响: 显示在 TimeCalendar 对应日期

### 场景 4: 在描述中添加时间

1. 用户在 Description 行
2. 选择日期 "1月10日"
3. **结果**:
   - 视觉: 插入 `📅 1月10日` span（mention-only）
   - 元数据: `startTime/endTime` **不变**
   - 影响: 仅作为描述文本，不显示在日历

## 技术细节

### mention-only CSS Selector

使用 `:not(.mention-only)` 排除 mention 标签：
```typescript
const tagElements = tempDiv.querySelectorAll('.inline-tag:not(.mention-only)');
```

确保只提取真正关联到元数据的标签。

### Line ID 映射

Description 行 ID 包含后缀：
- Title: `line-12345`
- Description: `line-12345-desc`

提取实际 item ID：
```typescript
const actualItemId = currentFocusedLineId.replace('-desc', '');
const item = items.find(i => i.id === actualItemId);
```

### 模式持久化

模式存储在 `PlanItem.mode` 字段：
- 有 description 内容且 `mode === 'description'` → 显示 description 行
- `mode === 'title'` 或无 description → 仅显示 title 行

## 集成测试场景

### 功能测试

- [x] Title 模式插入标签 → 元数据更新
- [x] Description 模式插入标签 → 元数据不变
- [x] Title 模式插入时间 → startTime/endTime 更新
- [x] Description 模式插入时间 → startTime/endTime 不变
- [x] 模式检测准确（-desc 后缀 + class）
- [x] mention-only class 正确应用

### 数据测试

- [ ] Title 标签提取排除 mention-only
- [ ] Description 标签不提取到 tags 数组
- [ ] 时间格式转换正确（ISO 8601）
- [ ] 多次添加标签累积正确

### UI 测试

- [ ] mention-only 标签视觉区分（可选样式）
- [ ] FloatingBar 在两种模式下均正常显示
- [ ] 光标位置正确恢复
- [ ] 标签/时间 span 不可编辑

### 边界测试

- [ ] 快速切换 Title ↔ Description 模式
- [ ] 同一行既有关联标签又有 mention 标签
- [ ] Description 为空时删除后 mode 重置
- [ ] 标签删除后元数据同步更新

## 后续增强

### 待实现功能

1. **Emoji 和 Priority 关联**
   - Title 模式: 更新 `PlanItem.emoji` 和 `priority`
   - Description 模式: 仅插入 emoji 字符

2. **Color 关联**
   - Title 模式: 更新 `PlanItem.color`
   - Description 模式: 应用文本颜色样式

3. **Mention 点击交互**
   - 点击 mention-only 标签 → 显示标签详情
   - 点击 mention-only 时间 → 无跳转（不同于关联时间）

4. **视觉增强**
   - mention-only 标签添加虚线边框
   - Hover 提示 "此为提及，不影响筛选"

### 性能优化

- [ ] 防抖标签提取逻辑（减少 DOM 操作）
- [ ] 缓存 tempDiv 避免重复创建
- [ ] 优化 querySelectorAll 选择器性能

## 相关文件

- `src/components/PlanManager.tsx` - 主实现，模式检测和关联逻辑
- `src/components/FloatingToolbar/HeadlessFloatingToolbar.tsx` - FloatingBar UI
- `src/hooks/useFloatingToolbar.ts` - 工具栏 Hook
- `docs/features/PLAN_DUAL_MODE_GUIDE.md` - 双模式输入功能文档

## 设计理念

### 为什么区分关联和 Mention？

1. **信息架构清晰**
   - Title = Event 核心属性（用于组织和筛选）
   - Description = 补充说明（富文本内容）

2. **用户意图明确**
   - 在标题中添加标签 → "这个任务属于工作类别"
   - 在描述中提及标签 → "可能需要参考工作相关资料"

3. **避免元数据污染**
   - Description 中的临时提及不应影响筛选结果
   - 保持 Event 标签的精确性和可维护性

4. **符合自然语言习惯**
   - 标题简洁，包含关键信息
   - 描述详细，可自由提及相关概念

### 类比：Email vs Mention

类似于：
- **To/CC**: 真正的收件人（Title 关联标签）
- **Email 正文中 @someone**: 提及某人但不通知（Description mention）

---

**文档版本**: v1.0  
**创建时间**: 2025-01-02  
**最后更新**: 2025-01-02
