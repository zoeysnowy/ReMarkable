# Description 标签提及 - 快速参考

## ✅ 已完成

Description 中现在可以插入标签，这些标签仅作为提及（mention），不会成为 Event 的正式 tags。

---

## 🎯 核心区别

| 位置 | 插入标签 | mentionOnly | 添加到 Event.tags | 同步到远程 |
|------|---------|-------------|------------------|-----------|
| **Title** | ✅ | `false` | ✅ 是 | HTML 标签 |
| **Description** | ✅ | `true` | ❌ 否 | `#emoji text` |

---

## 🔧 使用方法

### 1. 在 Description 中插入标签

1. 点击 Description 编辑器
2. 打开 FloatingToolbar（点击 # 按钮）
3. 选择标签
4. 标签会自动以 `mentionOnly: true` 插入

### 2. 查看效果

**本地显示**：
- Description 中的标签显示为**胶囊样式**
- 但不会添加到 Event 的 tags 数组

**同步到远程后**：
- 标签转换为纯文本：`#💼 工作`
- 在 Outlook/Google Calendar 中可读

---

## 📊 示例

### 创建事件

```typescript
// Title: "完成项目方案"
// Title 标签: #工作
// Description: "这是关于 #学习 的任务"

// 保存后的数据：
{
  "title": "完成项目方案",
  "tags": ["tag-work"],          // ✅ 只有 Title 的标签
  "description": "<span data-mention-only=\"true\" data-tag-emoji=\"📚\" data-tag-name=\"学习\">📚 学习</span>"
}
```

### 同步到 Outlook

```
Outlook 中显示:
━━━━━━━━━━━━━━━━━━━━━
📧 完成项目方案

这是关于 #📚 学习 的任务
━━━━━━━━━━━━━━━━━━━━━
```

---

## 🚀 技术实现

### 关键函数

1. **insertTag()**: 根据 `isDescriptionMode` 自动设置 `mentionOnly`
2. **extractTags()**: 过滤掉 `mentionOnly` 标签
3. **convertMentionTagsToPlainText()**: 将 HTML 标签转换为 `#emoji text`

### 数据流

```
插入标签 → mentionOnly: true → 不添加到 tags[] → 同步时转换为纯文本
```

---

## 📝 版本

- **v1.9.6** - 2025-11-12
- 新增 `convertMentionTagsToPlainText()` 函数
- 优化同步流程
