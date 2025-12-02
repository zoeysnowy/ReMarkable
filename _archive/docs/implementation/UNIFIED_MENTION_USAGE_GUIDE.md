# 🎯 Unified Mention 使用指南

## 快速开始

### 1. 安装依赖

```bash
npm install fuse.js
```

### 2. 在应用启动时初始化索引

```typescript
// src/App.tsx
import { unifiedSearchIndex } from './services/search/UnifiedSearchIndex';

useEffect(() => {
  // 应用启动时初始化搜索索引（异步，不阻塞 UI）
  unifiedSearchIndex.initialize().then(() => {
    console.log('✅ 搜索索引初始化完成');
  });
}, []);
```

### 3. 在编辑器中集成 @ 菜单

```typescript
import React, { useState } from 'react';
import { UnifiedMentionMenu } from './components/UnifiedMentionMenu';

function Editor() {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionPosition, setMentionPosition] = useState({ x: 0, y: 0 });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // 监听 @ 符号
    if (e.key === '@') {
      const selection = window.getSelection();
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        
        setMentionPosition({ x: rect.left, y: rect.bottom + 4 });
        setShowMentionMenu(true);
        setMentionQuery('');
      }
    }
    
    // 如果菜单已打开，更新搜索词
    if (showMentionMenu && e.key !== 'Escape' && e.key !== 'Enter') {
      setMentionQuery(prev => prev + e.key);
    }
  };

  const handleSelect = (item: MentionItem) => {
    // 插入提及
    console.log('选中项:', item);
    
    // 根据类型处理
    switch (item.type) {
      case 'event':
        insertEventLink(item.id);
        break;
      case 'tag':
        insertTag(item.title);
        break;
      case 'time':
        insertTimeBlock(item.metadata);
        break;
      case 'ai':
        triggerAIAssistant(item.metadata.prompt);
        break;
      case 'new':
        createNewEvent(item.title);
        break;
    }
    
    setShowMentionMenu(false);
  };

  return (
    <div>
      <div
        contentEditable
        onKeyDown={handleKeyDown}
        style={{ padding: 20, border: '1px solid #ccc' }}
      >
        在这里输入 @ 来触发提及菜单
      </div>

      {showMentionMenu && (
        <UnifiedMentionMenu
          query={mentionQuery}
          onSelect={handleSelect}
          onClose={() => setShowMentionMenu(false)}
          context="editor"
          position={mentionPosition}
        />
      )}
    </div>
  );
}
```

---

## 🎨 完整示例：在 Slate 编辑器中集成

```typescript
import { Editor, Transforms, Range } from 'slate';
import { ReactEditor } from 'slate-react';

// 1. 检测 @ 符号
const handleKeyDown = (event: React.KeyboardEvent, editor: Editor) => {
  if (event.key === '@') {
    // 获取光标位置
    const { selection } = editor;
    if (!selection || !Range.isCollapsed(selection)) return;

    // 记录 @ 的位置（用于后续替换）
    const mentionStart = selection.anchor;

    // 显示菜单
    setShowMentionMenu(true);
    setMentionStart(mentionStart);
  }
};

// 2. 监听输入，更新搜索词
const handleChange = (value: Descendant[]) => {
  if (!showMentionMenu) return;

  // 提取从 @ 到光标之间的文本
  const { selection } = editor;
  if (!selection) return;

  const beforeRange = {
    anchor: mentionStart,
    focus: selection.anchor,
  };

  const beforeText = Editor.string(editor, beforeRange);
  const match = beforeText.match(/^@(\w*)$/);

  if (match) {
    // 更新搜索词（去掉 @）
    setMentionQuery(match[1]);
  } else {
    // 光标移出 @ 范围，关闭菜单
    setShowMentionMenu(false);
  }
};

// 3. 选中项后，插入 Mention 节点
const handleSelect = (item: MentionItem) => {
  if (!mentionStart) return;

  // 删除 @ 和搜索词
  Transforms.delete(editor, {
    at: {
      anchor: mentionStart,
      focus: editor.selection?.anchor,
    },
  });

  // 插入 Mention 节点
  switch (item.type) {
    case 'event':
      Transforms.insertNodes(editor, {
        type: 'event-mention',
        eventId: item.id,
        children: [{ text: item.title }],
      });
      break;

    case 'tag':
      Transforms.insertNodes(editor, {
        type: 'tag-mention',
        tag: item.id,
        children: [{ text: item.title }],
      });
      break;

    case 'time':
      Transforms.insertNodes(editor, {
        type: 'date-mention',
        date: item.metadata.pointInTime?.date,
        children: [{ text: item.title }],
      });
      break;
  }

  // 移动光标到插入节点后面
  Transforms.move(editor);

  setShowMentionMenu(false);
};
```

---

## 🔧 自定义搜索行为

### 添加自定义数据类型

```typescript
// 扩展 UnifiedSearchIndex
class CustomSearchIndex extends UnifiedSearchIndex {
  // 添加"人员"搜索
  async searchPeople(query: string): Promise<MentionItem[]> {
    const people = await getPeopleFromDatabase();
    
    return people
      .filter(p => p.name.toLowerCase().includes(query))
      .map(p => ({
        id: p.id,
        type: 'person',
        title: p.name,
        subtitle: p.email,
        icon: p.avatar || '👤',
        score: 1.0,
      }));
  }

  async search(options: SearchOptions): Promise<SearchResult> {
    const baseResults = await super.search(options);
    
    // 添加人员搜索
    const people = await this.searchPeople(options.query);
    
    return {
      ...baseResults,
      people,
    };
  }
}
```

### 调整排序权重

```typescript
// 修改 _applyContextWeight 方法
private _applyContextWeight(items: MentionItem[], context: string): MentionItem[] {
  return items.map(item => {
    let weight = item.score || 0;

    // 自定义权重规则
    if (context === 'comment') {
      // 评论区更倾向于提及人
      if (item.type === 'person') weight *= 1.5;
      if (item.type === 'event') weight *= 0.7;
    } else if (context === 'title') {
      // 标题更倾向于标签
      if (item.type === 'tag') weight *= 1.3;
    }

    return { ...item, score: weight };
  }).sort((a, b) => (b.score || 0) - (a.score || 0));
}
```

---

## 🎨 UI 定制

### 自定义菜单样式

```css
/* 修改 UnifiedMentionMenu.css */

.unified-mention-menu {
  /* 自定义宽度 */
  width: 480px;
  
  /* 自定义阴影 */
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  
  /* 自定义圆角 */
  border-radius: 12px;
}

/* 自定义选中项颜色 */
.mention-item.selected {
  background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
  color: white;
}
```

### 添加快捷预览

```typescript
const MentionItemView: React.FC<Props> = ({ item }) => {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div
      className="mention-item"
      onMouseEnter={() => setShowPreview(true)}
      onMouseLeave={() => setShowPreview(false)}
    >
      {/* 原有内容 */}
      
      {/* 悬停预览 */}
      {showPreview && item.type === 'event' && (
        <div className="mention-preview">
          <EventPreview eventId={item.id} />
        </div>
      )}
    </div>
  );
};
```

---

## 🚀 性能优化建议

### 1. 延迟初始化

```typescript
// 只在用户首次输入 @ 时才初始化
const [indexInitialized, setIndexInitialized] = useState(false);

const handleAtSymbol = async () => {
  if (!indexInitialized) {
    await unifiedSearchIndex.initialize();
    setIndexInitialized(true);
  }
  setShowMentionMenu(true);
};
```

### 2. 虚拟滚动（大量结果时）

```typescript
import { FixedSizeList } from 'react-window';

<FixedSizeList
  height={400}
  itemCount={allItems.length}
  itemSize={48}
  width="100%"
>
  {({ index, style }) => (
    <div style={style}>
      <MentionItemView item={allItems[index]} />
    </div>
  )}
</FixedSizeList>
```

### 3. 缓存搜索结果

```typescript
const searchCache = useRef<Map<string, SearchResult>>(new Map());

const search = async (query: string) => {
  // 检查缓存
  if (searchCache.current.has(query)) {
    return searchCache.current.get(query);
  }

  // 搜索
  const result = await unifiedSearchIndex.search({ query });
  
  // 缓存结果（5 分钟）
  searchCache.current.set(query, result);
  setTimeout(() => searchCache.current.delete(query), 5 * 60 * 1000);

  return result;
};
```

---

## 📊 监控和调试

### 添加性能监控

```typescript
const search = async (query: string) => {
  const startTime = performance.now();

  const result = await unifiedSearchIndex.search({ query });

  const elapsedTime = performance.now() - startTime;
  
  // 记录慢查询
  if (elapsedTime > 200) {
    console.warn('⚠️ 慢查询:', { query, time: elapsedTime });
  }

  return result;
};
```

### Debug 模式

```typescript
// 开启 Debug
window.SEARCH_DEBUG = true;

// 在 UnifiedSearchIndex 中添加
if ((window as any).SEARCH_DEBUG) {
  console.log('[Search] Query:', query);
  console.log('[Search] Results:', results);
  console.log('[Search] Time:', elapsedTime, 'ms');
}
```

---

## 🐛 常见问题

### Q: 搜索结果为空？
**A**: 检查索引是否初始化成功：
```typescript
console.log('索引状态:', unifiedSearchIndex['initialized']);
console.log('事件数量:', unifiedSearchIndex['eventsIndex']?.getIndex().size);
```

### Q: 响应太慢？
**A**: 
1. 检查数据量（`events.length`）
2. 调整 Fuse.js 配置：
```typescript
threshold: 0.6, // 提高模糊度（减少匹配精度，提升速度）
```

### Q: 中文搜索不准确？
**A**: Fuse.js 对中文支持有限，建议：
1. 预处理：拼音转换
2. 升级到 MeiliSearch（中文分词更好）

---

## 🔗 相关文档

- [数据库优化方案](./UNIFIED_MENTION_DATABASE_OPTIMIZATION.md)
- [Fuse.js 文档](https://fusejs.io/)
- [Slate 插件开发](https://docs.slatejs.org/concepts/08-plugins)
