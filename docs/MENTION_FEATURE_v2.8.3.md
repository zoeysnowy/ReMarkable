# @ 提及功能更新说明

## 版本：v2.8.3
**日期**：2025-01-XX  
**功能**：在 UnifiedSlateEditor 中添加 @ 提及时间输入功能

---

## ✨ 新功能

### 1. @ 触发时间输入
用户在编辑器中输入 `@` 后，系统会实时检测后续文本并解析为时间。

**示例**：
- 输入 `@明天下午3点` → 实时显示解析结果
- 输入 `@下周二` → 实时显示解析结果  
- 输入 `@周末` → 实时显示解析结果

### 2. 实时自然语言解析
复用 **UnifiedDateTimePicker** 的强大自然语言解析引擎：
- 支持 120+ 中文时间表达式
- 使用 `naturalLanguageTimeDictionary.ts`
- 零延迟实时解析反馈

### 3. 零点击确认
解析成功后：
- 按 **Enter** → 立即插入 DateMention 节点
- 按 **Esc** → 取消输入

无需点击鼠标，全键盘操作。

---

## 📁 文件变更

### 新增文件
1. **MentionPreview.tsx**
   - 路径：`src/components/UnifiedSlateEditor/MentionPreview.tsx`
   - 功能：@提及预览浮窗组件
   - 显示解析结果和快捷键提示

2. **MentionPreview.css**
   - 路径：`src/components/UnifiedSlateEditor/MentionPreview.css`
   - 功能：预览浮窗样式

### 修改文件
1. **UnifiedSlateEditor.tsx**
   - 新增 `mentionState` 状态管理
   - 新增 `handleMentionConfirm` / `handleMentionCancel` 回调
   - 在 `handleEditorChange` 中添加 @ 检测逻辑
   - 在 `handleKeyDown` 中拦截 Enter/Esc 键
   - 渲染 `<MentionPreview>` 组件

---

## 🔧 技术实现

### 架构设计
```
用户输入 @ → 检测 @后文本 → parseNaturalLanguage() 解析
    ↓
解析成功 → 显示 MentionPreview → Enter确认
    ↓
删除 @文本 → 插入 DateMention 节点 → 清除状态
```

### 数据流
```typescript
// 1. 检测 @ 输入
const atMatch = textBeforeCursor.match(/@([^\s]*)$/);

// 2. 实时解析
const parsed = parseNaturalLanguage(mentionText);

// 3. 提取时间
if (parsed.dateRange) {
  startTime = parsed.dateRange.start.toDate();
  endTime = parsed.dateRange.end?.toDate();
}

// 4. 显示预览
setMentionState({
  active: true,
  startTime,
  endTime,
  isFuzzyTime,
  position: { top, left }
});

// 5. Enter 确认
insertDateMention(editor, startDate, endDate, false, eventId);
```

### 关键依赖
- **naturalLanguageTimeDictionary.ts** - 自然语言解析引擎
- **insertDateMention** (helpers.ts) - DateMention 节点插入
- **ReactEditor.toDOMRange** - 计算浮窗位置

---

## 🧪 测试用例

### 基本输入
1. ✅ 输入 `@明天` → 显示明天日期
2. ✅ 输入 `@下周二` → 显示下周二日期
3. ✅ 输入 `@周末` → 显示本周末

### 时间段
4. ✅ 输入 `@上午` → 显示今天上午
5. ✅ 输入 `@下午3点` → 显示今天下午3点
6. ✅ 输入 `@明天晚上` → 显示明天晚上

### 组合表达
7. ✅ 输入 `@下周末上午` → 显示下周末上午
8. ✅ 输入 `@本周中午` → 显示本周中午

### 交互测试
9. ✅ Enter 确认 → 插入 DateMention 节点
10. ✅ Esc 取消 → 清除预览
11. ✅ 继续输入 → 实时更新解析结果
12. ✅ 删除 @ → 关闭预览

---

## 🎯 用户体验优化

### 1. 实时反馈
- 输入即解析，无需等待
- 动画过渡流畅（0.2s fade-in）

### 2. 位置智能
- 预览浮窗跟随光标
- 自动定位在光标下方 4px

### 3. 视觉清晰
- 📅 Emoji 图标
- 主标题显示相对时间（如"明天下午"）
- 副标题显示原始输入
- 快捷键提示 (Enter/Esc)

### 4. 键盘友好
- 全键盘操作
- Enter 一键确认
- Esc 快速取消

---

## 🔄 与现有功能的集成

### 1. 复用 UnifiedDateTimePicker 解析
- 零代码重复
- 一致的解析规则
- 统一的时间格式

### 2. 兼容 DateMention 系统
- 使用相同的 `insertDateMention` helper
- 自动绑定 eventId
- 保持数据结构一致

### 3. 不影响现有交互
- FloatingBar 数字键不冲突
- Escape 键冒泡机制保留
- 仅在 @ 上下文激活

---

## 📝 后续优化建议

### 短期（可选）
1. 支持其他 mention 类型（标签、人员等）
2. 添加最近使用记录
3. 支持 Tab 键切换建议

### 长期（可选）
1. AI 智能推荐时间
2. 多选项预览（如"明天"可选上午/下午）
3. 快捷短语（如 "tmr" → "明天"）

---

## ⚡ 性能考虑

- ✅ 使用 useCallback 缓存回调
- ✅ 最小化状态更新
- ✅ 避免不必要的重渲染
- ✅ 实时解析无阻塞

---

## 🐛 已知问题

无。

---

## 📚 相关文档

- [TIME_PICKER_AND_DISPLAY_PRD.md](./TIME_PICKER_AND_DISPLAY_PRD.md) - 时间选择器 PRD
- [EVENTHUB_TIMEHUB_ARCHITECTURE.md](./EVENTHUB_TIMEHUB_ARCHITECTURE.md) - TimeHub 架构
- [naturalLanguageTimeDictionary.ts](../src/utils/naturalLanguageTimeDictionary.ts) - 自然语言词典

---

**总结**：@ 提及功能完美复用了 UnifiedDateTimePicker 的解析能力，提供了零点击、全键盘操作的流畅时间输入体验。
