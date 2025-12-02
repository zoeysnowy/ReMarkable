# Mention 功能架构设计

## 📐 架构分层

### 1. SlateCore 层（通用基础设施）

**位置**: `src/components/SlateCore/`

**职责**: 提供可复用的 Slate 元素和服务

#### 核心组件

1. **EventMentionElement.tsx** - 事件提及元素
   - 纯展示组件，不包含业务逻辑
   - 接受 `onMentionClick` 回调，由父组件决定点击行为
   - 样式：蓝色背景 + 悬停效果

2. **UnifiedMentionMenu.tsx** - 统一提及菜单
   - 显示搜索结果（事件、标签、时间、AI 建议）
   - 处理键盘导航（↑↓ 选择、Enter 确认、Esc 关闭）
   - 返回选中项的类型和数据

3. **UnifiedSearchIndex.ts** - 统一搜索索引
   - Fuse.js 全文搜索
   - 缓存事件列表，自动更新
   - 支持模糊匹配和拼音搜索

---

### 2. PlanSlate 层（业务逻辑）

**位置**: `src/components/PlanSlate/PlanSlate.tsx`

**职责**: 根据输入位置决定 Mention 的处理方式

#### 两种处理模式

### 模式 A: 标题行输入（event-line）→ **直接修改 Event 字段**

```typescript
// 用户在标题行输入 @ 并选择
handleSearchSelect = (result) => {
  if (isInEventLine()) {
    switch (result.type) {
      case 'time':
        // ✅ 解析时间，存入 event.startTime/endTime
        const parsed = parseDateMention(result.value);
        EventService.updateEvent(eventId, {
          startTime: parsed.start,
          endTime: parsed.end
        });
        // ✅ 插入 dateMention 元素（仅用于展示）
        insertDateMention(parsed);
        break;
        
      case 'tag':
        // ✅ 存入 event.tags[]
        EventService.updateEvent(eventId, {
          tags: [...event.tags, result.value]
        });
        // ✅ 插入 tag 元素（仅用于展示）
        insertTag(result.value);
        break;
        
      case 'event':
        // ⚠️ 仅插入 event-mention 元素（不修改 event 字段）
        insertEventMention(result.id, result.title);
        break;
    }
  }
}
```

**关键特性**：
- `@明天9点` → 解析后存入 `event.startTime = "2025-12-03 09:00"`
- `@工作` → 存入 `event.tags = ["工作"]`
- `@年度报告` → 仅作为 Mention 显示，不修改 event

---

### 模式 B: EventLog 输入（正文）→ **仅作为 Mention 显示**

```typescript
// 用户在正文输入 @ 并选择
handleSearchSelect = (result) => {
  if (isInEventLog()) {
    switch (result.type) {
      case 'time':
        // ⚠️ 不修改 event.startTime，仅插入 dateMention
        insertDateMention(result.value);
        break;
        
      case 'tag':
        // ⚠️ 不修改 event.tags，仅插入 tag
        insertTag(result.value);
        break;
        
      case 'event':
        // ⚠️ 仅插入 event-mention
        insertEventMention(result.id, result.title);
        break;
    }
  }
}
```

**关键特性**：
- 所有 Mention 都只是富文本元素
- 不会修改 Event 对象的字段
- 可以在正文中引用其他事件、时间、标签

---

## 🔄 数据流

### 标题行输入流程

```
用户输入 "@明天9点"
  ↓
UnifiedMentionMenu 显示搜索结果
  ↓
用户选择 "明天 9:00"
  ↓
PlanSlate.handleSearchSelect()
  ├─ 判断：在标题行 (event-line)
  ├─ 解析时间: "2025-12-03 09:00"
  ├─ 调用: EventService.updateEvent(eventId, { startTime: ... })
  └─ 插入: DateMentionElement (展示用)
  ↓
Event 对象更新
  event.startTime = "2025-12-03 09:00:00"
  event.title.nodes = [..., { type: 'dateMention', value: '明天 9:00' }]
```

### EventLog 输入流程

```
用户输入 "@年度报告"
  ↓
UnifiedMentionMenu 显示搜索结果
  ↓
用户选择 "2024年度报告"
  ↓
PlanSlate.handleSearchSelect()
  ├─ 判断：在正文 (eventlog)
  └─ 插入: EventMentionElement (仅展示)
  ↓
Event 对象更新
  event.eventlog.nodes = [..., { type: 'event-mention', eventId: 'evt_123', eventTitle: '2024年度报告' }]
```

---

## 🎨 元素类型定义

### EventMentionNode (新增)

```typescript
interface EventMentionNode {
  type: 'event-mention';
  eventId: string;        // 引用的事件 ID
  eventTitle: string;     // 事件标题（缓存，避免查询）
  children: [{ text: '' }]; // Slate 要求
}
```

### 现有元素类型

```typescript
interface TagNode {
  type: 'tag';
  value: string;          // 标签名
  children: [{ text: '' }];
}

interface DateMentionNode {
  type: 'dateMention';
  value: string;          // 时间文本（如 "明天 9:00"）
  parsed?: {
    start: string;        // ISO 时间戳
    end?: string;
  };
  children: [{ text: '' }];
}
```

---

## 🛠️ 实现清单

### ✅ 已完成
- [x] UnifiedSearchIndex - 统一搜索服务
- [x] UnifiedMentionMenu - 搜索菜单 UI
- [x] EventMentionElement - 事件提及元素
- [x] PlanSlate 添加 @ 检测和菜单显示逻辑
- [x] 配置 isInline/isVoid 支持 event-mention

### 🔄 待完成
- [ ] **handleSearchSelect 实现** - 根据位置分发处理逻辑
  - [ ] 检测当前光标在 event-line 还是 eventlog
  - [ ] 标题行：调用 EventService.updateEvent()
  - [ ] 正文：仅插入元素
  
- [ ] **insertEventMention 方法** - 插入事件提及元素
  ```typescript
  const insertEventMention = (eventId: string, eventTitle: string) => {
    Transforms.insertNodes(editor, {
      type: 'event-mention',
      eventId,
      eventTitle,
      children: [{ text: '' }]
    });
  };
  ```

- [ ] **点击 Mention 跳转** - 实现 onMentionClick 回调
  - [ ] 在 PlanManager 中滚动到目标事件
  - [ ] 高亮显示目标事件

- [ ] **测试场景**
  - [ ] 标题行输入 @时间 → 验证 event.startTime 更新
  - [ ] 标题行输入 @标签 → 验证 event.tags 更新
  - [ ] 正文输入 @事件 → 验证仅插入元素，不修改字段
  - [ ] 点击 event-mention → 验证跳转功能

---

## 📝 代码示例

### 判断当前位置

```typescript
const isInEventLine = () => {
  const [match] = Editor.nodes(editor, {
    match: n => SlateElement.isElement(n) && n.type === 'event-line',
    mode: 'lowest'
  });
  return !!match;
};

const isInEventLog = () => !isInEventLine();
```

### 插入事件提及

```typescript
const insertEventMention = (eventId: string, eventTitle: string) => {
  const mention: EventMentionNode = {
    type: 'event-mention',
    eventId,
    eventTitle,
    children: [{ text: '' }]
  };
  
  Transforms.insertNodes(editor, mention);
  Transforms.move(editor); // 移动光标到元素后
};
```

### 处理点击跳转

```typescript
// 在 PlanSlate 中传递回调
<EventMentionElement 
  onMentionClick={(eventId) => {
    // 通知 PlanManager 滚动到目标事件
    onNavigateToEvent?.(eventId);
  }}
/>

// 在 PlanManager 中实现跳转
const handleNavigateToEvent = (eventId: string) => {
  const targetElement = document.querySelector(`[data-event-id="${eventId}"]`);
  if (targetElement) {
    targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // 高亮 3 秒
    targetElement.classList.add('highlight-flash');
    setTimeout(() => targetElement.classList.remove('highlight-flash'), 3000);
  }
};
```

---

## 🎯 核心设计原则

1. **分层清晰**：SlateCore 不知道 Event 的存在，PlanSlate 负责业务逻辑
2. **位置敏感**：标题行和正文的 Mention 行为不同
3. **数据一致性**：标题行的时间/标签既存字段，又存元素（双重记录）
4. **可扩展性**：未来可以添加 `@人员`、`@地点` 等新类型

---

## 🔗 相关文件

- `src/components/SlateCore/elements/EventMentionElement.tsx`
- `src/components/SlateCore/UnifiedMentionMenu.tsx`
- `src/services/search/UnifiedSearchIndex.ts`
- `src/components/PlanSlate/PlanSlate.tsx`
