# 🎯 Unified Mention 功能 PRD

## 📋 文档信息

- **版本**: v1.0.0
- **创建日期**: 2025-12-02
- **最后更新**: 2025-12-02
- **状态**: ✅ 已实现（Tags 搜索已修复）
- **负责人**: ReMarkable Team

---

## 🎯 产品目标

### 核心价值
实现类似 Notion/Linear 的统一 @ 提及菜单，用户通过 `@` 触发，可快速搜索并插入：
- 📄 **事件引用** (Event Links)
- 🏷️ **标签** (Tags) - 支持层级标签，如 `#工作/#项目A`
- 👤 **联系人** (@人名 或 @邮箱)
- 📅 **时间表达** (自然语言时间，如 "下周三 9am")
- 🤖 **AI 助手** (触发 AI 功能)

### 业务目标
1. **提升输入效率**: 200ms 内返回搜索结果，无需手动翻页
2. **统一交互体验**: 所有提及类型共享同一个菜单，降低学习成本
3. **智能推荐**: 根据最近访问、上下文权重优化排序
4. **离线优先**: 基于本地内存索引，无网络依赖

---

## ✅ 当前实现状态

### 已完成功能

#### 1. 核心搜索引擎 ✅
**文件**: `src/services/search/UnifiedSearchIndex.ts`

**功能**:
- ✅ 内存索引 (Fuse.js) 实现快速搜索
- ✅ 支持事件、标签、时间表达的搜索
- ✅ 智能排序（最近访问 + 模糊匹配 + 上下文权重）
- ✅ 增量更新（监听 EventHub 自动同步）

**性能指标**:
```typescript
搜索时间: < 200ms
索引大小: ~1000 events → ~2MB 内存
防抖延迟: 150ms
```

**核心 API**:
```typescript
// 搜索接口
interface SearchOptions {
  query: string;
  context?: 'editor' | 'comment' | 'title';
  limit?: number;
  includeTypes?: MentionType[];
}

// 搜索结果
interface SearchResult {
  topHit?: MentionItem;     // 最佳匹配
  events: MentionItem[];    // 事件列表
  tags: MentionItem[];      // 标签列表
  time: MentionItem[];      // 时间表达
  ai?: MentionItem;         // AI 助手
  newPage?: MentionItem;    // 创建新页面
}
```

#### 2. UI 菜单组件 ✅
**文件**: `src/components/UnifiedMentionMenu.tsx`

**功能**:
- ✅ 150ms 防抖优化
- ✅ 键盘导航（↑↓ 选择，Enter 确认，Esc 关闭）
- ✅ 分组显示（Top Hit、Events、Tags、Time、AI）
- ✅ 智能定位（跟随光标位置）

**交互流程**:
```
用户输入 @  →  显示菜单  →  输入搜索词
              ↓
         防抖 150ms
              ↓
    UnifiedSearchIndex 搜索
              ↓
         渲染分组结果
              ↓
    用户选择（键盘/鼠标）
              ↓
         插入对应元素
```

#### 3. 标签搜索修复 ✅
**问题**: 之前 Tags 搜索结果为空（`tagsMap.size = 0`）

**根因**: TagService 数据未同步到 UnifiedSearchIndex

**修复方案**:
```typescript
// src/services/search/UnifiedSearchIndex.ts
private async _buildIndex(): Promise<void> {
  // 1. 从 EventService 加载所有事件
  const events = await EventService.getAllEvents();
  
  // 2. 构建事件索引
  this.eventsIndex = new Fuse(events, {
    keys: ['title.simpleTitle', 'eventlog.plainText', 'tags'],
    threshold: 0.4,
  });
  
  // 3. 🔥 关键修复：从 TagService 直接加载标签
  const { TagService } = await import('../TagService');
  const allTags = TagService.getFlatTags(); // 扁平化标签列表
  
  this.tagsMap.clear();
  allTags.forEach(tag => {
    this.tagsMap.set(tag.name, {
      name: tag.name,
      count: 0, // 初始计数
      events: [],
    });
  });
  
  // 4. 统计每个标签的事件数量
  events.forEach(event => {
    event.tags?.forEach(tagName => {
      const tag = this.tagsMap.get(tagName);
      if (tag) {
        tag.count++;
        tag.events.push(event.id);
      }
    });
  });
}
```

**验证结果**:
- ✅ 搜索 "4DNote" → 返回结果 ✅
- ✅ 搜索 "工作" → 返回层级标签 "工作/项目A" ✅
- ✅ tagsMap.size > 0 ✅

---

## 🏗️ 架构设计

### 1. 数据流架构

```
┌─────────────────────────────────────────────────────────┐
│                    应用层 (React)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ PlanSlate    │  │EventEditModal│  │ CommentBox   │  │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  │
│         │                 │                 │          │
│         └─────────────────┼─────────────────┘          │
│                           ▼                            │
│            ┌─────────────────────────────┐             │
│            │ UnifiedMentionMenu          │             │
│            │  - 防抖搜索 (150ms)         │             │
│            │  - 键盘导航                 │             │
│            │  - 智能定位                 │             │
│            └─────────────┬───────────────┘             │
└──────────────────────────┼─────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│                 搜索引擎层 (Service)                    │
│            ┌─────────────────────────────┐             │
│            │ UnifiedSearchIndex          │             │
│            │  - 内存索引 (Fuse.js)       │             │
│            │  - 最近访问权重             │             │
│            │  - 上下文感知排序           │             │
│            └─────────────┬───────────────┘             │
│                          ▼                             │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│    │ Events   │  │  Tags    │  │  Time    │          │
│    │ Index    │  │  Map     │  │  Parser  │          │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘          │
└─────────┼─────────────┼─────────────┼─────────────────┘
          ▼             ▼             ▼
┌─────────────────────────────────────────────────────────┐
│                 数据层 (Storage)                        │
│    ┌──────────┐  ┌──────────┐  ┌──────────┐          │
│    │EventSvc  │  │ TagSvc   │  │TimeUtils │          │
│    └────┬─────┘  └────┬─────┘  └────┬─────┘          │
│         │             │             │                 │
│         ▼             ▼             ▼                 │
│  ┌──────────────────────────────────────────┐        │
│  │      StorageManager (双写策略)           │        │
│  │  ┌────────────┐       ┌────────────┐    │        │
│  │  │ IndexedDB  │       │  SQLite    │    │        │
│  │  └────────────┘       └────────────┘    │        │
│  └──────────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────┘
```

### 2. 标签搜索数据流

```
用户输入 @4D
    ↓
UnifiedMentionMenu (防抖 150ms)
    ↓
UnifiedSearchIndex.search({ query: '4D' })
    ↓
_searchTags('4d') 方法
    ↓
遍历 tagsMap (来自 TagService.getFlatTags())
    ↓
模糊匹配: '4DNote'.toLowerCase().includes('4d') ✅
    ↓
返回 MentionItem: {
  id: 'tag_4dnote',
  type: 'tag',
  title: '#4DNote',
  subtitle: '0 个事件',
  icon: '🏷️',
  score: 0.95
}
    ↓
UnifiedMentionMenu 渲染菜单项
```

---

## 🔧 技术实现细节

### 1. 标签索引构建

**问题**: 如何高效构建标签索引？

**方案**: 双源合并策略
```typescript
// Step 1: 加载 TagService 中的所有标签（包括未使用的标签）
const allTags = TagService.getFlatTags();
allTags.forEach(tag => {
  this.tagsMap.set(tag.name, {
    name: tag.name,
    count: 0,
    events: [],
  });
});

// Step 2: 遍历所有事件，统计标签使用次数
events.forEach(event => {
  event.tags?.forEach(tagName => {
    const tag = this.tagsMap.get(tagName);
    if (tag) {
      tag.count++;
      tag.events.push(event.id);
    } else {
      // 兜底：如果事件中的标签不在 TagService 中（脏数据）
      this.tagsMap.set(tagName, {
        name: tagName,
        count: 1,
        events: [event.id],
      });
    }
  });
});
```

**优点**:
- ✅ 包含所有标签（即使未被使用）
- ✅ 准确统计事件数量
- ✅ 容错处理脏数据

### 2. 模糊搜索实现

**事件搜索** (使用 Fuse.js):
```typescript
this.eventsIndex = new Fuse(events, {
  keys: [
    'title.simpleTitle',      // 搜索标题
    'eventlog.plainText',     // 搜索正文
    'tags',                   // 搜索关联标签
  ],
  threshold: 0.4,             // 模糊度（0=精确, 1=任意匹配）
  includeScore: true,         // 返回匹配分数
});
```

**标签搜索** (手动实现):
```typescript
private _searchTags(query: string, limit: number): MentionItem[] {
  const results: MentionItem[] = [];
  
  this.tagsMap.forEach((tag, name) => {
    const normalizedName = name.toLowerCase();
    const normalizedQuery = query.toLowerCase();
    
    // 前缀匹配优先（score 更高）
    if (normalizedName.startsWith(normalizedQuery)) {
      results.push({
        id: `tag_${name}`,
        type: 'tag',
        title: `#${name}`,
        subtitle: `${tag.count} 个事件`,
        icon: '🏷️',
        score: 0.9, // 高分
      });
    }
    // 包含匹配
    else if (normalizedName.includes(normalizedQuery)) {
      results.push({
        id: `tag_${name}`,
        type: 'tag',
        title: `#${name}`,
        subtitle: `${tag.count} 个事件`,
        icon: '🏷️',
        score: 0.7, // 中分
      });
    }
  });
  
  // 按分数排序
  return results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, limit);
}
```

### 3. 上下文权重调整

**问题**: 在标题栏 @ 时，应优先显示事件；在编辑器 @ 时，应优先显示标签和时间。

**方案**: 动态权重计算
```typescript
private _applyContextWeight(
  items: MentionItem[],
  context: 'editor' | 'comment' | 'title',
  type: MentionType
): MentionItem[] {
  const weights = {
    editor: { event: 1.0, tag: 1.2, time: 1.1 },  // 编辑器：标签优先
    comment: { event: 1.1, tag: 1.0, time: 0.9 }, // 评论：事件优先
    title: { event: 1.3, tag: 0.8, time: 0.7 },   // 标题：事件优先
  };
  
  const weight = weights[context][type] || 1.0;
  
  return items.map(item => ({
    ...item,
    score: (item.score || 0) * weight,
  })).sort((a, b) => (b.score || 0) - (a.score || 0));
}
```

### 4. 最近访问权重

**问题**: 用户刚刚访问的事件应该在搜索结果中排名更高。

**方案**: 时间衰减算法
```typescript
private recentAccess: Map<string, number> = new Map(); // id -> timestamp

recordAccess(id: string, type: MentionType): void {
  this.recentAccess.set(`${type}:${id}`, Date.now());
}

private _calculateRecencyBoost(id: string, type: MentionType): number {
  const key = `${type}:${id}`;
  const lastAccess = this.recentAccess.get(key);
  
  if (!lastAccess) return 0;
  
  const hoursSinceAccess = (Date.now() - lastAccess) / (1000 * 60 * 60);
  
  // 1小时内: +0.2 分
  if (hoursSinceAccess < 1) return 0.2;
  // 24小时内: +0.1 分
  if (hoursSinceAccess < 24) return 0.1;
  // 超过24小时: 不加分
  return 0;
}
```

---

## 🔗 双向链接集成（v2.17.0）

### 功能概述

用户在 EventLog 中输入 `@事件名称` 并选择事件后，自动在两个事件之间创建双向链接关系。

### 数据流

```
用户在事件 A 的 EventLog 中输入 @
    ↓
UnifiedMentionMenu 显示事件搜索结果
    ↓
用户选择事件 B（Enter 或点击）
    ↓
handleItemClick() 触发
    ↓
检测：item.type === 'event' && currentEventId 存在
    ↓
调用 UnifiedSearchIndex.createBidirectionalLink(A.id, B.id)
    ↓
调用 EventService.addLink(A.id, B.id)
    ↓
更新数据库：
  - eventA.linkedEventIds = [..., B.id]
  - eventB.backlinks = [..., A.id]
    ↓
插入 @mention 节点到 Slate 编辑器
    ↓
完成
```

### 代码实现

#### 1. UnifiedMentionMenu 集成

**新增 Props**:
```typescript
interface UnifiedMentionMenuProps {
  // ... 现有 props ...
  currentEventId?: string; // 🆕 当前编辑的事件 ID
}
```

**选择事件时的处理**:
```typescript
const handleItemClick = useCallback(async (item: MentionItem) => {
  // 🔗 如果选择的是事件，且当前有编辑的事件，自动创建双向链接
  if (item.type === 'event' && currentEventId && item.id !== currentEventId) {
    await unifiedSearchIndex.createBidirectionalLink(currentEventId, item.id);
  }
  
  onSelect(item);
  unifiedSearchIndex.recordAccess(item.id, item.type);
}, [onSelect, currentEventId]);
```

#### 2. UnifiedSearchIndex 新增方法

```typescript
/**
 * 🔗 创建双向链接
 * 当用户在 EventLog 中 @mention 另一个事件时调用
 * 
 * @param fromEventId 当前编辑的事件 ID
 * @param toEventId 被提及的事件 ID
 * @returns 是否成功
 */
async createBidirectionalLink(fromEventId: string, toEventId: string): Promise<boolean> {
  try {
    const { EventService } = await import('../EventService');
    const result = await EventService.addLink(fromEventId, toEventId);
    
    if (result.success) {
      AppLogger.log('🔗 [UnifiedSearchIndex] 创建双向链接成功:', {
        from: fromEventId,
        to: toEventId,
      });
    } else {
      AppLogger.warn('⚠️ [UnifiedSearchIndex] 创建双向链接失败:', result.error);
    }
    
    return result.success;
  } catch (error) {
    AppLogger.error('❌ [UnifiedSearchIndex] 创建双向链接异常:', error);
    return false;
  }
}
```

### 使用示例

#### EventEditModal 中集成

```tsx
import { UnifiedMentionMenu } from '@/components/UnifiedMentionMenu';
import { EventService } from '@/services/EventService';

function EventEditModalV2({ event }: { event: Event }) {
  const [showMentionMenu, setShowMentionMenu] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  
  const handleSlateKeyDown = (e: KeyboardEvent) => {
    if (e.key === '@') {
      setShowMentionMenu(true);
      setMentionQuery('');
    }
  };
  
  const handleMentionSelect = (item: MentionItem) => {
    if (item.type === 'event') {
      // 插入事件 mention 节点到 Slate 编辑器
      Editor.insertNodes(editor, {
        type: 'event-mention',
        eventId: item.id,
        eventTitle: item.title,
        children: [{ text: '' }],
      });
    }
    setShowMentionMenu(false);
  };
  
  return (
    <div>
      <SlateEditor onKeyDown={handleSlateKeyDown} />
      
      {showMentionMenu && (
        <UnifiedMentionMenu
          query={mentionQuery}
          currentEventId={event.id} {/* 🆕 传入当前事件 ID */}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentionMenu(false)}
          context="editor"
        />
      )}
    </div>
  );
}
```

### 特性

#### ✅ 自动防重
- 如果链接已存在，`EventService.addLink()` 会跳过
- 不会重复添加到 `linkedEventIds`

#### ✅ 防止自环
```typescript
if (item.id !== currentEventId) {
  // 只有选择的事件不是自己，才创建链接
}
```

#### ✅ 自动同步 backlinks
- `EventService.addLink()` 内部会调用 `rebuildBacklinks()`
- 自动更新目标事件的 `backlinks` 字段

#### ✅ 错误处理
- 如果创建失败（如事件不存在），会在控制台打印警告
- 不会阻止 @mention 节点的插入

### 验证方式

#### 1. 测试链接创建
```typescript
// 在事件 A 的 EventLog 中输入 @
// 搜索并选择事件 B

// 验证事件 A
const eventA = await EventService.getEventById('event-a-id');
console.log(eventA.linkedEventIds); // ['event-b-id']

// 验证事件 B
const eventB = await EventService.getEventById('event-b-id');
console.log(eventB.backlinks); // ['event-a-id']
```

#### 2. 测试防重
```typescript
// 在同一个事件中多次 @mention 同一个事件
// linkedEventIds 应该只包含一次该事件 ID
```

#### 3. 测试自环防护
```typescript
// 在事件 A 中尝试 @mention 自己
// 不应该创建链接
```

### 未来优化

#### 🔄 删除 @mention 时自动移除链接
```typescript
// 监听 Slate 编辑器的节点删除事件
const handleNodeRemove = async (node: any) => {
  if (node.type === 'event-mention') {
    await EventService.removeLink(currentEventId, node.eventId);
  }
};
```

#### 🔄 链接关系可视化
- 在 EventEditModal 的关联区域显示双向链接
- 堆叠卡片展示（Vessels as Stacks）

#### 🔄 链接语义推断
- 使用 AI 自动分析链接类型（依赖、参考、相关）
- 在 UI 中以不同颜色/图标区分

---

## 📊 与 Storage Architecture 的集成

### 当前集成状态 ✅

#### 1. 数据读取层
```typescript
// UnifiedSearchIndex 通过 EventService 和 TagService 读取数据
async _buildIndex() {
  // ✅ 使用 EventService（已集成 StorageManager）
  const events = await EventService.getAllEvents();
  
  // ✅ 使用 TagService（已集成 PersistentStorage）
  const tags = TagService.getFlatTags();
}
```

#### 2. 实时更新机制
```typescript
// UnifiedSearchIndex 监听 EventHub 自动同步
private _setupEventListeners(): void {
  window.addEventListener('eventsUpdated', async (event: any) => {
    const detail = event.detail;
    
    if (detail.action === 'create' || detail.action === 'update') {
      // 增量更新事件索引
      this._updateEventIndex(detail.event);
    } else if (detail.action === 'delete') {
      // 从索引中移除
      this._removeFromIndex(detail.eventId);
    }
  });
  
  // 监听 TagService 变化
  TagService.addListener(() => {
    this._rebuildTagsMap();
  });
}
```

#### 3. 数据流完整性
```
用户操作 (PlanSlate/EventEditModal)
    ↓
EventService.createEvent() / updateEvent()
    ↓
StorageManager.createEvent() / updateEvent()
    ↓
双写: IndexedDB + SQLite
    ↓
触发 EventHub 事件: 'eventsUpdated'
    ↓
UnifiedSearchIndex 监听并增量更新索引
    ↓
用户下次 @ 搜索时，索引已是最新状态
```

### 存储架构兼容性 ✅

| 功能 | 当前实现 | 存储层 | 状态 |
|------|---------|--------|------|
| 事件搜索 | EventService.getAllEvents() | StorageManager (IndexedDB+SQLite) | ✅ 兼容 |
| 标签搜索 | TagService.getFlatTags() | PersistentStorage (LocalStorage) | ✅ 兼容 |
| 实时同步 | EventHub 监听 | StorageManager 触发事件 | ✅ 兼容 |
| 增量更新 | 内存索引差异计算 | 无依赖 | ✅ 兼容 |

---

## 🚀 上云准备 - Mention 相关改造

### 问题 1: 标签数据仍在 LocalStorage ⚠️

**现状**:
```typescript
// TagService 使用 PersistentStorage (封装 LocalStorage)
PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
```

**风险**:
- ❌ LocalStorage 容量限制（5-10MB）
- ❌ 无法跨设备同步
- ❌ 不支持增量查询

**改造方案**:
```typescript
// 将 TagService 迁移到 StorageManager

// 1. 在 StorageManager 添加标签表
interface StorageTag {
  id: string;
  name: string;
  color: string;
  emoji?: string;
  parentId?: string;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string; // 软删除
}

// 2. TagService 使用 StorageManager
class TagServiceClass {
  async getTags(): Promise<HierarchicalTag[]> {
    const tags = await storageManager.queryTags({});
    return this._buildHierarchy(tags.items);
  }
  
  async createTag(tag: HierarchicalTag): Promise<void> {
    await storageManager.createTag({
      ...tag,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  }
}
```

**预计工作量**: 4 小时

### 问题 2: 搜索索引无法持久化 ⚠️

**现状**:
```typescript
// UnifiedSearchIndex 使用内存索引，每次刷新重建
private eventsIndex: Fuse<Event> | null = null;
```

**风险**:
- ❌ 应用重启需要重建索引（~1s）
- ❌ 无法支持服务端搜索

**改造方案**:
```typescript
// 使用 SQLite FTS5 或 ElasticSearch

// Electron: 使用 SQLite FTS5
await db.exec(`
  CREATE VIRTUAL TABLE search_index USING fts5(
    id,
    type,
    title,
    content,
    tags
  );
`);

// Web: 使用 Orama (轻量级 FTS)
import { create, insert, search } from '@orama/orama';

const searchDB = await create({
  schema: {
    id: 'string',
    type: 'string',
    title: 'string',
    content: 'string',
  },
});
```

**预计工作量**: 8 小时

### 问题 3: 缺少用户协作搜索 ⚠️

**现状**:
- ✅ 可以搜索事件、标签
- ❌ 无法搜索其他用户创建的事件
- ❌ 无法 @ 提及协作者

**改造方案**:
```typescript
// 1. 添加用户表
interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
}

// 2. 在 UnifiedSearchIndex 添加用户搜索
private _searchPeople(query: string, limit: number): MentionItem[] {
  const results: MentionItem[] = [];
  
  this.peopleMap.forEach((user) => {
    if (user.name.includes(query) || user.email?.includes(query)) {
      results.push({
        id: user.id,
        type: 'person',
        title: user.name,
        subtitle: user.email,
        icon: user.avatar || '👤',
      });
    }
  });
  
  return results.slice(0, limit);
}

// 3. 插入 @ 提及时创建 Person 节点
insertMention(item: MentionItem) {
  if (item.type === 'person') {
    Editor.insertNodes(editor, {
      type: 'mention',
      userId: item.id,
      userName: item.title,
      children: [{ text: '' }],
    });
  }
}
```

**预计工作量**: 6 小时

---

## 📋 上云改造 Checklist

### 阶段一：本地架构优化（本周）
- [x] ✅ 修复标签搜索（已完成）
- [x] ✅ 集成双向链接（已完成 - v2.17.0）
- [ ] 🔄 将 TagService 迁移到 StorageManager
- [ ] 🔄 实现标签软删除
- [ ] 🔄 添加标签 UUID ID 生成

### 阶段二：搜索引擎升级（2 周）
- [ ] 🔄 SQLite FTS5 集成（Electron）
- [ ] 🔄 Orama 集成（Web）
- [ ] 🔄 搜索索引持久化
- [ ] 🔄 增量索引更新优化

### 阶段三：协作功能准备（4 周）
- [ ] 🔄 用户系统集成
- [ ] 🔄 @ 提及协作者
- [ ] 🔄 事件共享和权限
- [ ] 🔄 实时协作搜索

---

## 📚 相关文档

- [Storage Architecture 设计文档](../docs/STORAGE_ARCHITECTURE.md)
- [Unified Mention 使用指南](../docs/UNIFIED_MENTION_USAGE_GUIDE.md)
- [Tag Service 架构文档](../docs/TAG_SERVICE_ARCHITECTURE.md)
- [上云准备架构检查报告](../CLOUD_READINESS_AUDIT_REPORT.md)

---

## 🎉 总结

### 当前成就 ✅
1. ✅ 实现了统一 @ 提及菜单（类似 Notion）
2. ✅ 修复了标签搜索问题（4DNote 可正常搜索）
3. ✅ 集成了 Storage Architecture（双写策略）
4. ✅ 实现了实时索引更新（监听 EventHub）
5. ✅ **集成双向链接功能** (v2.17.0)
   - ✅ @mention 事件时自动创建双向链接
   - ✅ UnifiedSearchIndex.createBidirectionalLink() 方法
   - ✅ 防止自己链接自己
   - ✅ 自动更新 linkedEventIds 和 backlinks

### 待改进项 ⚠️
1. ⚠️ TagService 仍使用 LocalStorage（需迁移到 StorageManager）
2. ⚠️ 搜索索引无法持久化（需集成 FTS5/Orama）
3. ⚠️ 缺少协作功能（@ 提及用户）

### 上云风险评估 🟡
**风险等级**: 🟡 MEDIUM

**主要风险**:
- 标签数据在 LocalStorage（容量限制 + 无同步）
- 搜索索引每次重建（性能问题）

**建议优先级**:
1. 🔴 P0: 修复 UUID ID 生成（EventService）
2. 🔴 P0: 实现软删除（EventService + TagService）
3. 🟡 P1: TagService 迁移到 StorageManager
4. 🟢 P2: 搜索引擎升级（FTS5/Orama）
