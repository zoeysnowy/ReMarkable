# Timelog 字段架构说明

## 概述

为了支持 ReMarkable 内部的富文本描述（包括标签、图片等），同时保持与 Outlook Calendar 的兼容性，我们引入了 `timelog` 字段。

## 字段设计

### Event 接口新增字段

```typescript
interface Event {
  // ... 其他字段
  
  // 🆕 v1.8: Rich-text description support
  timelog?: string;      // 富文本日志（HTML 格式，ReMarkable 内部展示用，支持标签、图片等）
  description?: string;  // 纯文本描述（用于 Outlook Calendar 同步）
}
```

## 数据流

### 保存流程 (Slate → Event)

```
用户在 Description 编辑器中输入内容（富文本 + 标签）
    ↓
slateNodesToPlanItems() 序列化
    ↓
    ├─→ timelog: 完整 HTML（包含 <span data-type="tag"> 等元素）
    └─→ description: 纯文本（标签转换为 #tagName 文本）
    ↓
EventService.updateEvent() 保存到 localStorage
    ↓
ActionBasedSyncManager 同步到 Outlook
    ├─→ timelog: 不同步（ReMarkable 内部字段）
    └─→ description: 同步到 Outlook.description（纯文本）
```

### 加载流程 (Event → Slate)

```
EventService.getAllEvents() 从 localStorage 加载
    ↓
planItemsToSlateNodes() 反序列化
    ↓
优先使用 timelog || 回退到 description
    ↓
htmlToSlateFragment() 解析 HTML 为 Slate 节点
    ↓
渲染到 UnifiedSlateEditor（富文本显示）
```

## 示例

### 输入内容
```
用户输入: "今天完成了 #工作 项目，进展顺利 #个人"
```

### 保存结果

**timelog (富文本 HTML)**
```html
今天完成了 <span data-type="tag" data-tag-id="work-123" data-tag-name="工作" data-tag-emoji="💼" data-mention-only="true">💼工作</span> 项目，进展顺利 <span data-type="tag" data-tag-id="personal-456" data-tag-name="个人" data-tag-emoji="🏠" data-mention-only="true">🏠个人</span>
```

**description (纯文本)**
```
今天完成了 #工作 项目，进展顺利 #个人
```

## 关键函数

### slateNodesToPlanItems() - L258-270

```typescript
if (node.mode === 'title') {
  item.content = html;
  item.title = fragment ? extractPlainText(fragment) : '';
  item.tags = fragment ? extractTags(fragment) : [];
} else {
  // 🆕 v1.8: 描述行保存到 timelog (富文本) 和 description (纯文本)
  item.timelog = html; // 富文本，用于 ReMarkable 内部显示
  item.description = fragment ? extractPlainText(fragment) : ''; // 纯文本，用于 Outlook 同步
}
```

### planItemsToSlateNodes() - L87-95

```typescript
// 🆕 v1.8: 优先使用 timelog (富文本)，回退到 description (纯文本)
const descriptionContent = item.timelog || item.description;
if (descriptionContent) {
  const descNode: EventLineNode = {
    type: 'event-line',
    eventId: item.eventId || item.id,
    lineId: `${item.id}-desc`,
    mode: 'description',
    children: [
      {
        type: 'paragraph',
        children: htmlToSlateFragment(descriptionContent),
      },
    ],
    metadata,
  };
  nodes.push(descNode);
}
```

## 兼容性

### 向后兼容

- **旧数据**: 如果 `timelog` 不存在，自动回退到 `description`
- **新数据**: 同时保存 `timelog` 和 `description`，确保与 Outlook 同步兼容

### Outlook Calendar 同步

- **description**: 纯文本，直接同步到 Outlook
- **timelog**: 不同步，仅 ReMarkable 内部使用

## 优势

1. **富文本支持**: `timelog` 支持标签、图片、格式化等富文本内容
2. **同步兼容**: `description` 提供纯文本版本，确保与 Outlook 无缝同步
3. **数据完整**: 不丢失富文本信息，ReMarkable 内部完整展示
4. **向后兼容**: 旧数据自动回退，无需迁移

## 测试检查清单

- [ ] 在 Description 编辑器中输入文本
- [ ] 插入 mention-only 标签（使用 # 快捷键）
- [ ] 保存后刷新页面，验证内容保留
- [ ] 检查 localStorage，确认 `timelog` 包含 HTML，`description` 包含纯文本
- [ ] 同步到 Outlook，验证 `description` 正确显示

## 相关文件

- `src/types.ts` - Event 接口定义
- `src/components/UnifiedSlateEditor/serialization.ts` - 序列化/反序列化逻辑
- `src/services/ActionBasedSyncManager.ts` - Outlook 同步（需确保 `timelog` 不被同步）

## 版本历史

- **v1.8** (2025-11-12): 初始实现 `timelog` 字段，支持富文本描述
