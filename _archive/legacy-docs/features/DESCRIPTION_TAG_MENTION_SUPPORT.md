# Description 标签提及支持

**版本**: v1.9.6  
**日期**: 2025-11-12  
**状态**: ✅ 已实现

---

## 📋 功能概述

在 **Description** 字段中支持插入标签，但这些标签仅作为**提及（Mention）**，不会成为 Event 的正式 tags。

在同步到远程日历（Microsoft Outlook/Google Calendar）时，这些标签会被转换为纯文本格式：`#emoji tagName`。

---

## 🎯 核心需求

### 1. Description 中可以插入标签

- ✅ 用户可以在 Description 编辑器中通过 FloatingToolbar 插入标签
- ✅ 插入的标签带有 `mentionOnly: true` 标记
- ✅ 这些标签**不会**添加到 Event 的 `tags` 数组中

### 2. 标签仅作为提及

```typescript
// Title 模式插入的标签（正式标签）
{
  type: 'tag',
  tagId: 'tag-123',
  tagName: '工作',
  tagEmoji: '💼',
  mentionOnly: false,  // ❌ 会添加到 Event.tags
  children: [{ text: '' }]
}

// Description 模式插入的标签（仅提及）
{
  type: 'tag',
  tagId: 'tag-123',
  tagName: '工作',
  tagEmoji: '💼',
  mentionOnly: true,   // ✅ 不会添加到 Event.tags
  children: [{ text: '' }]
}
```

### 3. 同步时转换为纯文本

在同步到远程日历时，description 中的标签会被转换为：

```
原始 HTML:
<span data-mention-only="true" data-tag-emoji="💼" data-tag-name="工作">💼 工作</span>

同步后:
#💼 工作
```

---

## 🔧 实现细节

### 1. 插入标签时自动设置 `mentionOnly`

**位置**: `src/components/PlanManager.tsx` L1883-1891

```typescript
const isDescriptionMode = currentFocusedMode === 'description';

const success = insertTag(
  editor,
  insertId,
  tag.name,
  tag.color || '#666',
  tag.emoji || '',
  isDescriptionMode  // 🔥 Description 模式下自动设置为 true
);
```

### 2. 提取标签时过滤 `mentionOnly`

**位置**: `src/components/PlanSlate/serialization.ts` L358

```typescript
function extractTags(fragment: (TextNode | TagNode | DateMentionNode)[]): string[] {
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[extractTags] fragment 不是数组', { fragment });
    return [];
  }
  
  return fragment
    .filter((node): node is TagNode => 
      'type' in node && 
      node.type === 'tag' && 
      !node.mentionOnly  // 🔥 过滤掉 mention-only 标签
    )
    .map(node => node.tagName);
}
```

### 3. 同步时转换为纯文本

**位置**: `src/services/ActionBasedSyncManager.ts` L930-962

```typescript
// 🆕 将 HTML 中的 mention-only 标签转换为纯文本格式（#emojitext）
private convertMentionTagsToPlainText(html: string): string {
  if (!html) return '';
  
  // 匹配 <span data-mention-only="true" ...>content</span> 格式的标签
  const mentionTagPattern = /<span[^>]*data-mention-only="true"[^>]*data-tag-emoji="([^"]*)"[^>]*data-tag-name="([^"]*)"[^>]*>.*?<\/span>/g;
  
  let result = html.replace(mentionTagPattern, (match, emoji, tagName) => {
    // 转换为 #emojitext 格式
    const emojiPart = emoji ? emoji + ' ' : '';
    return `#${emojiPart}${tagName}`;
  });
  
  // 也处理另一种可能的属性顺序
  const mentionTagPattern2 = /<span[^>]*data-tag-name="([^"]*)"[^>]*data-tag-emoji="([^"]*)"[^>]*data-mention-only="true"[^>]*>.*?<\/span>/g;
  
  result = result.replace(mentionTagPattern2, (match, tagName, emoji) => {
    const emojiPart = emoji ? emoji + ' ' : '';
    return `#${emojiPart}${tagName}`;
  });
  
  // 处理只有 data-mention-only 和 data-tag-name 的情况（没有 emoji）
  const mentionTagPattern3 = /<span[^>]*data-mention-only="true"[^>]*data-tag-name="([^"]*)"[^>]*>.*?<\/span>/g;
  
  result = result.replace(mentionTagPattern3, (match, tagName) => {
    return `#${tagName}`;
  });
  
  return result;
}
```

**调用位置**: `processEventDescription` 函数在清理 HTML 之前

```typescript
private processEventDescription(htmlContent: string, ...): string {
  // 🆕 0. 在清理 HTML 之前，先将 mention-only 标签转换为纯文本格式
  let preprocessedHtml = this.convertMentionTagsToPlainText(htmlContent);
  
  // 1. 清理HTML内容，得到纯文本
  let cleanText = this.cleanHtmlContent(preprocessedHtml);
  
  // ...
}
```

---

## 📊 数据流

### 本地编辑流程

```
用户在 Description 中插入标签
         ↓
PlanManager 检测到 isDescriptionMode = true
         ↓
调用 insertTag(..., mentionOnly: true)
         ↓
Slate 编辑器插入 TagNode { mentionOnly: true }
         ↓
序列化时：extractTags 过滤掉 mentionOnly 标签
         ↓
Event.tags 数组不包含这个标签 ✅
```

### 同步到远程流程

```
本地 Event 保存
         ↓
ActionBasedSyncManager 检测到变化
         ↓
调用 processEventDescription(event.description)
         ↓
convertMentionTagsToPlainText 转换标签为 #emojitext
         ↓
cleanHtmlContent 清理其他 HTML 标签
         ↓
同步到 Microsoft Outlook/Google Calendar
         ↓
远程日历显示：Description 中有 #💼 工作 ✅
```

### 从远程同步回来

```
Microsoft Outlook 事件
         ↓
body.content: "这是描述 #💼 工作"
         ↓
getEventDescription 提取纯文本
         ↓
保存到本地 Event.description
         ↓
UI 显示：纯文本 "#💼 工作" ✅
```

---

## 🎨 UI 表现

### Title 模式（正式标签）

```
┌─────────────────────────────────┐
│ [📝] 完成项目方案 💼 工作      │  ← Tag 是胶囊样式，可点击
└─────────────────────────────────┘
    ↑
    Event.tags = ['tag-work']
```

### Description 模式（仅提及）

```
┌─────────────────────────────────┐
│ [📝] 完成项目方案               │
│                                 │
│ 📄 这是关于 💼 工作 的任务...  │  ← Tag 是胶囊样式，但不可编辑
└─────────────────────────────────┘
    ↑
    Event.tags = [] (空数组)
    Event.description 包含 HTML tag
```

### 同步到远程后

```
Microsoft Outlook:
┌─────────────────────────────────┐
│ 📧 完成项目方案                 │
│                                 │
│ 这是关于 #💼 工作 的任务...    │  ← 纯文本形式
└─────────────────────────────────┘
```

---

## 🧪 测试场景

### 测试 1: Description 插入标签不影响 Event.tags

**步骤**:
1. 创建新 Event
2. 在 Title 中插入 `#工作`
3. 在 Description 中插入 `#学习`
4. 保存并查看 Event 数据

**预期**:
```json
{
  "title": "完成任务",
  "tags": ["tag-work"],  // ✅ 只有 Title 中的标签
  "description": "<span data-mention-only=\"true\">💼 工作</span>"
}
```

### 测试 2: 同步到远程转换为纯文本

**步骤**:
1. 创建包含 Description 标签的 Event
2. 同步到 Microsoft Outlook
3. 在 Outlook 中查看事件

**预期**:
- Description 显示：`这是关于 #💼 工作 的任务`（纯文本）

### 测试 3: 从远程同步回来保持纯文本

**步骤**:
1. 在 Outlook 中手动编辑事件 Description：`测试 #💼 工作`
2. 同步回 ReMarkable
3. 查看本地 Description

**预期**:
- Description 显示：`测试 #💼 工作`（保持纯文本）

---

## ✅ 优势

1. **语义清晰**：
   - Title 的标签 = 正式分类
   - Description 的标签 = 内容提及

2. **远程兼容**：
   - 远程日历不支持富文本标签
   - 转换为纯文本保持可读性

3. **数据准确**：
   - Event.tags 只包含真正的分类标签
   - 不会因为 Description 的提及而污染标签数据

4. **用户友好**：
   - 在 Description 中也能快速插入标签引用
   - 不需要手动输入 `#emoji name`

---

## 📝 代码变更总结

### 新增功能

1. **ActionBasedSyncManager.ts**:
   - 新增 `convertMentionTagsToPlainText()` 方法
   - 修改 `processEventDescription()` 调用顺序

### 已有支持

1. **PlanManager.tsx**: 已支持根据 `isDescriptionMode` 设置 `mentionOnly`
2. **serialization.ts**: 已有 `extractTags()` 过滤逻辑
3. **TagElement.tsx**: 已有 `mentionOnly` 属性支持

---

**版本**: v1.9.6  
**作者**: GitHub Copilot  
**日期**: 2025-11-12
