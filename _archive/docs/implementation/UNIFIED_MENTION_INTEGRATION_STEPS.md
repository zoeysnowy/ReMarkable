# 🔧 Unified Mention 集成步骤（代码示例）

## Step 1: 初始化搜索索引（App.tsx）

```typescript
// src/App.tsx

import { unifiedSearchIndex } from './services/search/UnifiedSearchIndex';

// 在现有的 useEffect 中添加
useEffect(() => {
  // ... 其他初始化代码
  
  // 🆕 初始化 Unified Mention 搜索索引
  console.log('🔍 初始化 Unified Mention 搜索索引...');
  unifiedSearchIndex.initialize()
    .then(() => {
      console.log('✅ 搜索索引初始化完成');
    })
    .catch(err => {
      console.error('❌ 搜索索引初始化失败:', err);
    });
}, []);
```

---

## Step 2: 扩展 PlanSlate 的 @ 触发逻辑

```typescript
// src/components/PlanSlate/PlanSlate.tsx

// 🆕 添加新的状态
const [mentionType, setMentionType] = useState<'time' | 'search' | null>(null);
const [searchQuery, setSearchQuery] = useState('');
const [showSearchMenu, setShowSearchMenu] = useState(false);

// 修改现有的 @ 检测逻辑（约在 line 1214）
const atMatch = textBeforeCursor.match(/@([^\s]*)$/);

if (atMatch) {
  const text = atMatch[1];
  console.log('[@ Mention] 检测到@输入:', text);
  
  // 🎯 智能判断：时间 vs 搜索
  if (text.length > 0) {
    // 1️⃣ 优先尝试时间解析
    const timeParsed = parseNaturalLanguage(text);
    
    if (timeParsed && timeParsed.matched) {
      // ✅ 时间解析成功 → 显示时间预览
      console.log('[@ Mention] 解析为时间:', timeParsed);
      setMentionType('time');
      setShowSearchMenu(false);
      
      // ... 原有的时间处理逻辑
      if (startTime) {
        setMentionText(text);
        setMentionInitialStart(startTime);
        setMentionInitialEnd(endTime);
        setShowMentionPicker(true);
      }
    } else if (text.length >= 2) {
      // 2️⃣ 时间解析失败 → 触发搜索
      console.log('[@ Mention] 解析为搜索查询:', text);
      setMentionType('search');
      setSearchQuery(text);
      setShowMentionPicker(false);
      setShowSearchMenu(true);
    }
  } else {
    // @ 后没有输入，显示空搜索菜单
    setMentionType('search');
    setSearchQuery('');
    setShowSearchMenu(true);
  }
} else {
  // 不在 @ 上下文
  if (showMentionPicker || showSearchMenu) {
    setShowMentionPicker(false);
    setShowSearchMenu(false);
  }
}
```

---

## Step 3: 添加搜索结果处理

```typescript
// src/components/PlanSlate/PlanSlate.tsx

// 🆕 处理搜索菜单选中
const handleSearchSelect = useCallback((item: MentionItem) => {
  console.log('[@ Mention] 搜索选中:', item);
  
  if (!editor.selection) return;
  
  // 1. 删除 @xxx 文本
  const { anchor } = editor.selection;
  const [node] = Editor.node(editor, anchor.path);
  
  if (SlateText.isText(node)) {
    const textBeforeCursor = node.text.slice(0, anchor.offset);
    const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
    
    if (atMatch) {
      const fullMatch = atMatch[0];
      const deleteRange = {
        anchor: { ...anchor, offset: anchor.offset - fullMatch.length },
        focus: anchor,
      };
      
      Transforms.delete(editor, { at: deleteRange });
    }
  }
  
  // 2. 根据类型插入不同的节点
  switch (item.type) {
    case 'event':
      // 插入事件链接
      Transforms.insertNodes(editor, {
        type: 'event-mention',
        eventId: item.id,
        children: [{ text: item.title }],
      } as any);
      break;
      
    case 'tag':
      // 插入标签节点
      insertTag(editor, item.id.replace('#', ''));
      break;
      
    case 'time':
      // 插入时间提及
      insertDateMention(
        editor,
        item.metadata.pointInTime?.date || new Date(),
        item.title,
        false,
        eventId
      );
      break;
      
    case 'ai':
      // 触发 AI 助手
      console.log('🤖 AI 助手:', item.metadata.prompt);
      // TODO: 集成 AI 服务
      break;
      
    case 'new':
      // 创建新事件
      console.log('➕ 创建新页面:', item.title);
      // TODO: 调用创建事件的逻辑
      break;
  }
  
  // 3. 关闭菜单
  setShowSearchMenu(false);
  
  // 4. 移动光标到插入节点后面
  Transforms.move(editor);
}, [editor, eventId]);
```

---

## Step 4: 渲染 UnifiedMentionMenu

```typescript
// src/components/PlanSlate/PlanSlate.tsx

// 在 return 的 JSX 中添加（约在 line 2800）

return (
  <div className="plan-slate-container" ref={containerRef}>
    {/* ... 现有的 Slate 编辑器 */}
    
    {/* ✅ 原有的时间提及预览 */}
    {showMentionPicker && mentionType === 'time' && mentionAnchorRef.current && (
      <Tippy
        reference={mentionAnchorRef.current}
        visible={showMentionPicker}
        placement="bottom-start"
        interactive={true}
        appendTo={() => document.body}
        content={
          <UnifiedDateTimePicker
            initialStart={mentionInitialStart}
            initialEnd={mentionInitialEnd}
            initialText={mentionText}
            onConfirm={handleMentionConfirm}
            onSearchChange={handleMentionSearchChange}
            onCancel={() => setShowMentionPicker(false)}
          />
        }
      />
    )}
    
    {/* 🆕 新增的事件/标签搜索菜单 */}
    {showSearchMenu && mentionType === 'search' && mentionAnchorRef.current && (
      <Tippy
        reference={mentionAnchorRef.current}
        visible={showSearchMenu}
        placement="bottom-start"
        interactive={true}
        appendTo={() => document.body}
        content={
          <UnifiedMentionMenu
            query={searchQuery}
            onSelect={handleSearchSelect}
            onClose={() => setShowSearchMenu(false)}
            context="editor"
          />
        }
      />
    )}
    
    {/* ... 其他组件 */}
  </div>
);
```

---

## Step 5: 添加事件提及元素（新节点类型）

```typescript
// src/components/SlateCore/elements/EventMentionElement.tsx (新建)

import React from 'react';
import { RenderElementProps } from 'slate-react';
import { useNavigate } from 'react-router-dom';
import EventService from '../../../services/EventService';

export interface EventMentionNode {
  type: 'event-mention';
  eventId: string;
  children: { text: string }[];
}

const EventMentionElement: React.FC<RenderElementProps> = ({ 
  attributes, 
  children, 
  element 
}) => {
  const navigate = useNavigate();
  const node = element as EventMentionNode;
  
  const handleClick = async () => {
    // 导航到事件详情或打开编辑模态框
    const event = await EventService.getEventById(node.eventId);
    if (event) {
      console.log('打开事件:', event);
      // TODO: 打开 EventEditModal
    }
  };
  
  return (
    <span
      {...attributes}
      contentEditable={false}
      className="event-mention"
      onClick={handleClick}
      style={{
        display: 'inline-block',
        padding: '2px 6px',
        margin: '0 2px',
        borderRadius: '4px',
        backgroundColor: '#e3f2fd',
        color: '#1976d2',
        cursor: 'pointer',
        fontSize: '0.9em',
        fontWeight: 500,
      }}
    >
      📄 {children}
    </span>
  );
};

export default EventMentionElement;
```

---

## Step 6: 注册新元素类型

```typescript
// src/components/PlanSlate/PlanSlate.tsx

import EventMentionElement from '../SlateCore/elements/EventMentionElement';

// 在 renderElement 函数中添加（约在 line 2650）
const renderElement = useCallback((props: RenderElementProps) => {
  const { element } = props;

  switch (element.type) {
    // ... 现有的 case
    
    case 'dateMention':
      return <DateMentionElement {...props} />;
      
    // 🆕 新增事件提及
    case 'event-mention':
      return <EventMentionElement {...props} />;
      
    default:
      return <p {...props.attributes}>{props.children}</p>;
  }
}, []);
```

---

## Step 7: 更新类型定义

```typescript
// src/types/slate.d.ts (或相关类型文件)

import { EventMentionNode } from '../components/SlateCore/elements/EventMentionElement';

// 添加到 CustomElement 类型联合
type CustomElement = 
  | ParagraphNode 
  | TagNode 
  | DateMentionNode 
  | EventMentionNode  // 🆕
  | EventLineNode 
  | TimestampDividerType;
```

---

## 测试清单

### ✅ 功能测试

1. **时间提及（原有功能）**
   ```
   输入: @明天
   预期: 显示 UnifiedDateTimePicker（时间预览）
   ```

2. **事件搜索（新功能）**
   ```
   输入: @会议
   预期: 显示 UnifiedMentionMenu，列出匹配的事件
   ```

3. **标签搜索（新功能）**
   ```
   输入: @#工作
   预期: 显示 UnifiedMentionMenu，列出匹配的标签
   ```

4. **智能切换**
   ```
   输入: @明天 → 时间预览
   继续输入: @明天会议 → 切换到搜索菜单
   ```

5. **空搜索**
   ```
   输入: @
   预期: 显示空搜索菜单（所有事件/标签）
   ```

### ⚡ 性能测试

在浏览器 Console 中运行：

```javascript
// 1. 测试搜索速度
console.time('search');
await unifiedSearchIndex.search({ query: '会议' });
console.timeEnd('search'); // 预期: <50ms

// 2. 测试菜单渲染速度
// 输入 @ 并观察菜单打开延迟（预期: <200ms）
```

---

## 常见问题

### Q1: 时间解析和事件搜索如何区分？

**A**: 采用"时间优先"策略：
1. 先尝试 `parseNaturalLanguage(text)`
2. 如果匹配成功（`matched: true`），显示时间预览
3. 如果匹配失败，触发事件/标签搜索

### Q2: 两个菜单会冲突吗？

**A**: 不会，使用 `mentionType` 状态控制：
- `mentionType === 'time'` → 显示 `UnifiedDateTimePicker`
- `mentionType === 'search'` → 显示 `UnifiedMentionMenu`

### Q3: 如何处理歧义输入（如 "@周五会议"）？

**A**: 当前策略是"时间优先"，"周五会议"会被解析为时间。可以优化为：
- 显示时间预览的同时，在底部添加"或搜索事件"按钮
- 用户可以手动切换

---

## 下一步优化

1. **混合菜单**: 在时间预览下方添加"或搜索事件"链接
2. **快捷键**: 支持 Tab 键在时间预览和搜索菜单间切换
3. **缓存**: 搜索结果缓存，避免重复查询
4. **增量索引**: 监听 `eventsUpdated` 事件，增量更新索引
