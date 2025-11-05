# Tiptap Phase 2 - 快速启动指南

## 🎯 验证集成成功

### 1. 启动应用
```bash
cd electron
npm start
# 或使用快捷方式
.\quick-start.bat
```

### 2. 打开计划管理器
- 点击侧边栏 "计划清单" 或 "Plan Manager"
- 应该看到使用 Tiptap 编辑器的界面

### 3. 基础功能测试清单

#### ✅ 显示测试
- [ ] 现有计划项正常显示
- [ ] Title 和 Description 正确渲染
- [ ] Checkbox、Emoji 前缀显示
- [ ] Tags、时间后缀显示
- [ ] 层级缩进正确（24px/level）

#### ✅ 输入测试
- [ ] 点击 Gray Text 创建新行
- [ ] 输入文本实时保存
- [ ] 中文输入正常
- [ ] Emoji 输入正常

#### ✅ 键盘交互测试
- [ ] **Enter** (title): 创建新 Event at level 0
- [ ] **Enter** (description): 允许换行
- [ ] **Shift+Enter** (title): 创建 description
- [ ] **Shift+Enter** (description, 空): 删除并回到 title
- [ ] **Tab** (title): 增加缩进
- [ ] **Shift+Tab**: 减少缩进
- [ ] **ArrowUp**: 光标在行首时跳到上一行
- [ ] **ArrowDown**: 光标在行尾时跳到下一行

#### ✅ 数据持久化测试
- [ ] 输入内容后刷新页面
- [ ] 内容正确保留
- [ ] Description 换行保留
- [ ] HTML 格式正确（`<p>`, `<br>` 标签）

---

## 🐛 常见问题排查

### 问题 0: "No node type 'paragraph' found" 错误 ✅ 已修复
**错误消息**: `No node type or group 'paragraph' found (in content expression 'paragraph block*')`

**原因**: 
- PlanEditor.tsx 使用了 EventTitle/EventDescription 节点
- 这些节点的 content 定义依赖 StarterKit 的 paragraph/block 节点
- 即使不导出，webpack 在开发模式下仍会解析并尝试创建 Schema

**解决方案**: 
1. 重命名 PlanEditor.tsx → PlanEditor.tsx.backup
2. 重命名 PlanEditor.css → PlanEditor.css.backup
3. 重命名节点文件：
   - EventTitle.ts → EventTitle.ts.backup
   - EventDescription.ts → EventDescription.ts.backup
4. 注释掉 index.ts 中的导出（已完成）

```typescript
// src/components/TiptapEditor/index.ts
// export { PlanEditor } from './PlanEditor';
// export { EventTitle } from './nodes/EventTitle';
// export { EventDescription } from './nodes/EventDescription';
```

**说明**:
- Phase 2 使用 **TiptapLine**（每行独立编辑器）而非 PlanEditor（单一大编辑器）
- PlanEditor 保留为 .backup，供 Phase 4 EventBlock 节点参考
- EventTitle/EventDescription 节点定义保留，但不参与编译

---

### 问题 1: 编辑器无法输入
**可能原因**: TiptapLine 未正确挂载

**排查步骤**:
1. 打开浏览器 DevTools (F12)
2. 在 Console 输入:
   ```javascript
   document.querySelectorAll('.tiptap-line-editor').length
   ```
3. 应该等于计划项数量

**解决方案**:
- 检查 `TiptapLine.tsx` 导入路径
- 确认 `TiptapFreeFormEditor` 正确导出

---

### 问题 2: Enter 不创建新行
**可能原因**: `onEnter` callback 未触发

**排查步骤**:
1. 在 TiptapLine 的 handleKeyDown 添加 log:
   ```typescript
   if (event.key === 'Enter' && !event.shiftKey) {
     console.log('Enter pressed, mode:', mode);
     if (mode === 'title') {
       event.preventDefault();
       console.log('Calling onEnter');
       onEnter?.();
       return true;
     }
   }
   ```

**解决方案**:
- 确认 mode 为 'title'
- 检查 TiptapFreeFormEditor 的 `handleLineEnter` 逻辑

---

### 问题 3: 内容不保存
**可能原因**: `isFirstRender` 阻止了更新

**排查步骤**:
1. 在 TiptapLine 的 onUpdate 添加 log:
   ```typescript
   onUpdate: ({ editor }) => {
     console.log('onUpdate called, isFirstRender:', isFirstRender.current);
     if (!isFirstRender.current) {
       onUpdate(editor.getHTML());
     }
   },
   ```

**解决方案**:
- 确认 `isFirstRender.current` 在首次渲染后变为 `false`
- 检查 useEffect 的 cleanup 逻辑

---

### 问题 4: Tab 键不工作
**可能原因**: 浏览器默认 Tab 行为未阻止

**排查步骤**:
1. 在 handleKeyDown 添加 log:
   ```typescript
   if (event.key === 'Tab' && !event.shiftKey && mode === 'title') {
     console.log('Tab pressed');
     event.preventDefault();
     onTab?.();
     return true;
   }
   ```

**解决方案**:
- 确认 `event.preventDefault()` 被调用
- 检查 TiptapFreeFormEditor 的 `handleTab` 逻辑

---

## 🔄 回退到旧版编辑器

如果遇到严重问题，可以快速回退：

### 步骤
1. 打开 `src/components/PlanManager.tsx`
2. 找到 line 512:
   ```typescript
   <TiptapFreeFormEditor
   ```
3. 改回:
   ```typescript
   <FreeFormEditor
   ```
4. 保存文件，应用自动重载

---

## 📊 性能监控

### 编辑器实例数量
```javascript
// 在浏览器 Console 运行
const editors = document.querySelectorAll('.tiptap-line-editor');
console.log('Total Tiptap instances:', editors.length);
```

**建议**: 
- 少于 50 个实例：性能良好
- 50-100 个实例：可接受
- 超过 100 个：考虑虚拟滚动

### 内存占用
```javascript
// 检查 Editor 实例是否正确销毁
performance.memory.usedJSHeapSize / 1024 / 1024 + ' MB'
```

---

## 🎨 样式调整

### 修改 Title 样式
编辑 `src/components/TiptapEditor/TiptapLine.css`:
```css
.tiptap-line-editor {
  font-size: 14px;    /* 字体大小 */
  font-weight: 400;   /* 字体粗细 */
  color: #1f2937;     /* 文字颜色 */
}
```

### 修改 Description 样式
```css
.tiptap-line-description {
  font-size: 13px;
  color: #6b7280;
  font-style: italic;
  line-height: 1.6;
}
```

### 修改 Placeholder 样式
```css
.tiptap-line-editor .ProseMirror p.is-editor-empty:first-child::before {
  color: #9ca3af;      /* 提示文字颜色 */
  font-style: italic;
}
```

---

## 🔍 调试技巧

### 查看 Tiptap 状态
```javascript
// 获取第一个编辑器实例
const firstEditor = document.querySelector('.tiptap-line-editor');
const editorView = firstEditor.__tiptap__view; // 内部属性

// 查看当前内容
editorView.editor.getHTML();

// 查看当前光标位置
editorView.state.selection.$anchor.pos;
```

### 监听所有 Tiptap 事件
在 `TiptapLine.tsx` 添加:
```typescript
onCreate: ({ editor }) => {
  console.log('Editor created:', lineId);
},
onDestroy: () => {
  console.log('Editor destroyed:', lineId);
},
onTransaction: ({ editor, transaction }) => {
  console.log('Transaction:', transaction.docChanged);
},
```

---

## 📝 下一步

测试完成后，继续 Phase 3:

1. **FloatingBar 重构** (3-4 hours)
   - 文件: `src/components/FloatingToolbar/HeadlessFloatingToolbar.tsx`
   - 任务: 使用 `editor.view.coordsAtPos()` 定位

2. **TagNode 迁移** (2-3 hours)
   - 文件: `src/components/TiptapEditor/nodes/TagNode.ts`
   - 任务: 从 HTML spans 迁移到 Tiptap Node

3. **数据持久化优化** (2-3 hours)
   - 文件: `src/services/PlanService.ts`
   - 任务: PlanItem JSON ↔ Tiptap JSON 互转

---

**文档版本**: Phase 2 - v1.0  
**最后更新**: 2024-01-XX  
**作者**: GitHub Copilot
