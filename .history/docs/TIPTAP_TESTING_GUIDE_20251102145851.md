# Tiptap 集成测试指南

## ✅ Phase 2 完成状态

### 已解决的问题
1. **Schema 冲突** - `listItem` 需要 `paragraph`，但 title 模式禁用了它
   - **解决方案**: 保持 `paragraph` 启用，禁用 `bulletList/orderedList/listItem`
   - **文件**: `src/components/TiptapEditor/TiptapLine.tsx`

2. **架构清理** - 删除了冲突的自定义节点
   - 已删除: `EventTitle.ts`, `EventDescription.ts`, `PlanEditor.tsx`
   - 保留: `TiptapLine.tsx` (核心), `TiptapFreeFormEditor.tsx` (容器), `TagNode.ts` (inline)

## 🧪 功能测试清单

### 1. 基础输入测试
- [ ] 打开"计划清单"页面
- [ ] 点击 "Gray Text" placeholder
- [ ] 输入文字，观察是否正常显示
- [ ] 光标是否正常移动

### 2. Enter 键测试 (创建新行)
**Title 模式**:
- [ ] 输入一行文字
- [ ] 按 `Enter`
- [ ] **期望**: 创建新的 Event (新行) 在下方，光标跳转到新行
- [ ] **不应该**: 在当前行内换行

**Description 模式**:
- [ ] 切换到 description 模式 (见下一步)
- [ ] 按 `Enter`
- [ ] **期望**: 在 description 内换行
- [ ] **不应该**: 创建新 Event

### 3. Shift+Enter 键测试 (模式切换)
- [ ] 在 Title 行，按 `Shift+Enter`
- [ ] **期望**: 切换到 Description 模式，缩进增加
- [ ] 再按 `Shift+Enter`
- [ ] **期望**: 切换回 Title 模式

### 4. Tab 键测试 (缩进)
- [ ] 在任意行按 `Tab`
- [ ] **期望**: 缩进增加 (level + 1)，视觉上向右移动
- [ ] 按 `Shift+Tab`
- [ ] **期望**: 缩进减少 (level - 1)，视觉上向左移动

### 5. 方向键测试 (导航)
- [ ] 创建多行内容
- [ ] 光标在行首，按 `ArrowUp`
- [ ] **期望**: 聚焦到上一行
- [ ] 光标在行尾，按 `ArrowDown`
- [ ] **期望**: 聚焦到下一行

### 6. 内容持久化测试
- [ ] 创建几个 plan item
- [ ] 输入一些内容（包括 HTML 格式：加粗、颜色等）
- [ ] 刷新页面 (F5)
- [ ] **期望**: 所有内容保留，格式不丢失

### 7. 前缀/后缀渲染测试
- [ ] Checkbox 是否显示在 Title 行前面
- [ ] Emoji 是否显示
- [ ] 标签胶囊是否显示在 Title 行后面
- [ ] 时间显示是否正常
- [ ] Description 行**不应该**显示 prefix/suffix

### 8. 样式测试
- [ ] Title 行和 Description 行的缩进是否正确
  - Title: `level * 24px`
  - Description: `(level + 1) * 24px`
- [ ] Placeholder 是否显示
  - Title: "开始输入..."
  - Description: "添加描述..."

## 🐛 已知问题

### React Warning: "Each child in a list should have a unique key"
- **状态**: 需进一步排查
- **位置**: 可能在 PlanManager 渲染 TiptapFreeFormEditor 时
- **影响**: 不影响功能，但应修复
- **优先级**: 低

## 📋 下一步计划

### Phase 3: FloatingBar 重构
- 使用 `editor.chain().insertContent()` 插入 Tag
- 使用 `editor.view.coordsAtPos()` 定位浮动工具栏
- 实现 Alt+Alt 快捷键

### 数据恢复
用户清除缓存后丢失了：
- Tags (标签)
- PlanItems (计划项)
- Events (事件)

**恢复方案**:
1. 创建示例标签 (Work, Personal, Urgent)
2. 创建示例计划项
3. 或提供导入功能（如果有备份）

## 🎯 测试结果

请在完成测试后填写：

**日期**: ___________

**测试通过** ✅:
- [ ] 基础输入
- [ ] Enter 键
- [ ] Shift+Enter 键
- [ ] Tab 键
- [ ] 方向键
- [ ] 内容持久化
- [ ] 前缀/后缀渲染
- [ ] 样式正确

**遇到的问题** ❌:
1. ___________
2. ___________
3. ___________

**备注**:
___________
