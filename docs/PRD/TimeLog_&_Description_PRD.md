# TimeLog 页面 & Event.eventlog 字段 PRD

> **版本**: v2.2  
> **创建时间**: 2024-01-XX  
> **最后更新**: 2025-11-13  
> **Figma 设计稿**: [TimeLog 页面设计](https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=333-1178&m=dev)  
> **依赖模块**: EventService, UnifiedSlateEditor, TimeHub, EventHub  
> **关联文档**:
> - [EventEditModal v2 PRD](./EVENTEDITMODAL_V2_PRD.md)
> - [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md)
> - [SLATE_DEVELOPMENT_GUIDE.md](../SLATE_DEVELOPMENT_GUIDE.md)

---

## 📋 目录

1. [核心概念](#1-核心概念)
   - TimeLog 页面 vs Event.eventlog 字段
   - 数据字段职责划分
2. [TimeLog 页面设计](#2-timelog-页面设计)
   - 整体布局
   - Event 卡片设计
   - 时间轴与过滤器
3. [Event.eventlog 字段](#3-eventeventlog-字段)
   - 数据结构定义
   - Timestamp 自动插入机制
   - Slate 编辑器集成
4. [编辑场景](#4-编辑场景)
   - TimeLog 页面（主要）
   - EventEditModal 右侧（次要）
   - PlanManager（紧凑模式）
5. [Outlook 同步机制](#5-outlook-同步机制)
   - eventlog → description 自动转换
   - 智能序列化策略
6. [版本控制与历史](#6-版本控制与历史)
7. [离线队列与保存机制](#7-离线队列与保存机制)
8. [实现指南](#8-实现指南)

---

## 📢 架构决策记录（2025-11-13）

### 决策 1：TimeLog = Event 集合的时间轴视图

**核心概念澄清：**

| 概念 | 定义 | 说明 |
|------|------|------|
| **TimeLog 页面** | Event 集合的时间轴展示页面 | 左侧：日历选择器 + 标签过滤器<br>右侧：连续时间轴显示所有 Events |
| **Event.eventlog** | 单个 Event 内部的日志字段 | Slate JSON 格式，包含 timestamp 分隔线<br>**用户唯一编辑的日志字段** |
| **Event.description** | 自动生成的同步字段 | 从 eventlog 转换的 HTML<br>**仅用于 Outlook 同步，用户界面不显示** |

**TimeLog 页面架构：**
```
┌─────────────────────────────────────────────────────────────┐
│ TimeLog 页面                                                 │
├──────────────────┬──────────────────────────────────────────┤
│ 左侧控制区        │ 右侧时间轴展示区                          │
│ (固定宽度)        │ (flex: 1)                                │
│                  │                                          │
│ ┌──────────────┐ │ ┌──────────────────────────────────────┐ │
│ │ 日历选择器    │ │ │ 2025-10-18 (周六)                    │ │
│ │ 2025年 10月  │ │ ├──────────────────────────────────────┤ │
│ │ [日历视图]    │ │ │ 📅⏰ 10:00 - 12:00 准备演讲稿        │ │
│ └──────────────┘ │ │ #工作 #文档编辑                       │ │
│                  │ │ 创建于12h前，距ddl还有2h30min          │ │
│ ┌──────────────┐ │ │ 上级任务：Project Ace...              │ │
│ │ 标签过滤器    │ │ │                                       │ │
│ │ [x] #工作     │ │ │ ▸ 2025-10-19 10:21:18 ⊙              │ │
│ │ [x] #学习     │ │ │ 处理完了一些出差的logistics，还有...   │ │
│ │ [ ] #娱乐     │ │ │                                       │ │
│ └──────────────┘ │ │ ▸ 16min later ⊙                       │ │
│                  │ │ 双击"Alt"召唤美桶、格式等...            │ │
│ ┌──────────────┐ │ │                                       │ │
│ │ 事件类型      │ │ └──────────────────────────────────────┘ │
│ │ [x] 计划事件  │ │                                          │
│ │ [x] 计时事件  │ │ ┌──────────────────────────────────────┐ │
│ └──────────────┘ │ │ 📅 14:00 - 16:00 开会讨论             │ │
│                  │ │ ...                                    │ │
└──────────────────┴──────────────────────────────────────────┘
```

### 决策 2：eventlog 是唯一可编辑的日志字段

**字段职责明确划分：**

```typescript
interface Event {
  // === 日志字段（核心） ===
  eventlog?: string;        // 🔥 Slate JSON 字符串
                            // - 用户在 TimeLog/EventEditModal/PlanManager 中编辑
                            // - 包含 timestamp 分隔线（自动插入）
                            // - 支持富文本、附件、标签提及
  
  description?: string;     // 🔥 HTML 字符串（自动生成）
                            // - 从 eventlog 自动转换（Slate JSON → HTML）
                            // - 仅用于 Outlook 同步
                            // - ❌ 用户界面永远不显示此字段
  
  // === 时间信息 ===
  startTime?: string;       // 计划开始时间（📅 日历 icon 依据）
  endTime?: string;         // 计划结束时间
  timeSpec?: TimeSpec;      // 完整时间对象（权威来源）
  
  // === Timer 计时信息 ===
  segments?: TimerSegment[];// 计时片段（⏰ 闹钟 icon 依据）
  isTimer?: boolean;        // 是否为 Timer 创建
  
  // === 其他元数据 ===
  title: string;
  emoji?: string;
  tags?: string[];
  participants?: string[];
  location?: string;
  calendarIds?: string[];
  // ...
}
```

**数据流：**
```
用户编辑（TimeLog/EventEditModal/PlanManager）
              ↓
    Event.eventlog (Slate JSON) ← 🔥 唯一数据源
              ↓
      自动转换（后台）
              ↓
   Event.description (HTML) ← 仅用于同步
              ↓
      同步到 Outlook
```

### 决策 3：Timestamp 分隔线记录编辑行为

**Timestamp 的本质：**
- **不是** Event 的 startTime/endTime（那是计划时间）
- **是** eventlog 内部的编辑时间记录
- 自动插入，标记用户的输入行为

**示例（见 Figma 截图）：**
```
┌─────────────────────────────────────────────┐
│ ▸ 2025-10-19 10:21:18 ⊙                     │ ← 第一个 timestamp（当天首次输入）
│ 处理完了一些出差的logistics，还有报销整理，  │
│ 现在终于可以开工了！                         │
│ 准备先一个提纲去给GPT，看看情况             │
│                                             │
│ ▸ 16min later ⊙                             │ ← 第二个 timestamp（距上次 16 分钟）
│ 双击"Alt"召唤美桶、格式等，点击右下方问号...  │
└─────────────────────────────────────────────┘
```

**Slate JSON 结构（示意）：**
```typescript
[
  {
    type: 'timestamp-divider',
    timestamp: '2025-10-19T10:21:18Z',
    isFirstOfDay: true,
    children: [{ text: '' }]
  },
  {
    type: 'paragraph',
    children: [{ text: '处理完了一些出差的logistics...' }]
  },
  {
    type: 'timestamp-divider',
    timestamp: '2025-10-19T10:37:42Z',
    minutesSinceLast: 16,
    children: [{ text: '' }]
  },
  {
    type: 'paragraph',
    children: [{ text: '双击"Alt"召唤美桶...' }]
  }
]
```

### 决策 4: Event 时间状态的 Icon 指示

**时间状态 Icon 规则：**

| Icon | 含义 | 判断条件 | 说明 |
|------|------|----------|------|
| 📅 | 计划时间 | `event.startTime` 存在 | 事先规划的事件 |
| ⏰ | 实际计时 | `event.segments` 存在 | Timer 计时记录 |
| 📅⏰ | 两者都有 | 同时满足上述条件 | 计划内的事情，也实际计时了 |

**示例（见 TimeLog 页面 Figma）：**
```
📅⏰ 10:00 - 12:00 准备演讲稿
  ↑  ↑
  │  └─ 实际计时了（有 segments）
  └──── 有计划时间（有 startTime/endTime）
```

### 决策 5：编辑场景与 Timestamp 显示规则

**eventlog 编辑场景：**

| 页面 | 编辑 eventlog | Timestamp 显示 | 用途 |
|------|--------------|----------------|------|
| **TimeLog 页面** | ✅ 主要编辑位置 | ✅ 完整显示 | 详细日志记录，时间轴展示 |
| **EventEditModal 右侧** | ✅ 次要编辑位置 | ✅ 完整显示 | Slate 编辑区，面积较大 |
| **PlanManager description 行** | ✅ 可编辑 | ❌ 隐藏 | 紧凑显示模式，节省空间 |

**❌ 常见误解纠正：**
- PlanManager 的 "description 行" **不是** Event.description 字段
- 它编辑的是 Event.eventlog，只是隐藏了 timestamp 的显示
- 数据保存时，写入的是 `Event.eventlog`，而非 `Event.description`

### 决策 6：TimeLog 页面的过滤机制

**左侧控制区功能：**

1. **日历选择器**
   - 默认显示所有时间的连续时间轴
   - 用户可选择特定日期/时间段
   - 右侧时间轴只显示选中范围的 Events

2. **标签过滤器**
   - 默认显示所有标签的 Events
   - 用户点击标签前的 hide 按钮 → 过滤该标签
   - **父标签 hide** → 整个 tag tree 的内容都被过滤

3. **事件类型过滤**
   - 计划事件（📅 有 startTime）
   - 计时事件（⏰ 有 segments）
   - 可多选

**标签过滤示例：**
```typescript
interface TagFilter {
  tagId: string;
  isHidden: boolean;
  childrenHidden?: boolean; // 父标签 hide 时，子标签自动 hide
}

// 用户点击 #工作 的 hide 按钮
const filterEvents = (events: Event[], hiddenTags: Set<string>): Event[] => {
  return events.filter(event => {
    // 如果 event 的任何 tag 在 hiddenTags 中，就过滤掉
    return !event.tags?.some(tagId => hiddenTags.has(tagId));
  });
};

// 处理 tag tree 的递归 hide
const getHiddenTagsWithChildren = (
  hiddenTagIds: string[],
  tagTree: TagHierarchy
): Set<string> => {
  const result = new Set<string>();
  
  hiddenTagIds.forEach(tagId => {
    result.add(tagId);
    // 递归添加所有子标签
    const children = getChildTags(tagTree, tagId);
    children.forEach(childId => result.add(childId));
  });
  
  return result;
};
```

---

## 1. 核心概念

### 1.1 TimeLog 页面 vs Event.eventlog 字段

**TimeLog 页面**：
- **定义**：Event 集合的时间轴展示页面
- **功能**：按时间顺序展示所有 Events，支持日期范围选择和标签过滤
- **布局**：
  - 左侧：日历选择器 + 标签过滤器 + 事件类型筛选
  - 右侧：连续时间轴，显示 Event 卡片列表

**Event.eventlog 字段**：
- **定义**：单个 Event 内部的富文本日志字段
- **格式**：Slate JSON 字符串
- **特性**：
  - 包含自动插入的 timestamp 分隔线
  - 支持富文本、附件、标签提及
  - 用户在多个场景编辑（TimeLog/EventEditModal/PlanManager）

**关键区别：**
```
TimeLog 页面 = Event[] 的视图
Event.eventlog = Event 内部的字段
```

### 1.2 数据字段职责划分

| 字段 | 类型 | 用途 | 编辑者 | 显示位置 |
|------|------|------|--------|----------|
| `Event.eventlog` | Slate JSON 字符串 | 用户日志记录（包含 timestamp） | 用户 | TimeLog, EventEditModal, PlanManager |
| `Event.description` | HTML 字符串 | Outlook 同步字段 | 系统自动生成 | ❌ 用户界面不显示 |
| `Event.startTime` | UTC 字符串 | 计划开始时间（📅 icon） | 用户 | 所有视图 |
| `Event.endTime` | UTC 字符串 | 计划结束时间 | 用户 | 所有视图 |
| `Event.segments` | TimerSegment[] | 实际计时记录（⏰ icon） | Timer 系统 | 所有视图 |

**数据流图：**
```
┌─────────────────────────────────────────────────────────────┐
│ 用户编辑层                                                   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  TimeLog 页面    EventEditModal    PlanManager              │
│       │                │                │                   │
│       └────────────────┴────────────────┘                   │
│                        ↓                                    │
│              编辑 Event.eventlog                             │
│                  (Slate JSON)                               │
│                        ↓                                    │
├─────────────────────────────────────────────────────────────┤
│ 自动转换层                                                   │
├─────────────────────────────────────────────────────────────┤
│                        ↓                                    │
│         slateToHtml(Event.eventlog)                         │
│                        ↓                                    │
│           Event.description (HTML)                          │
│                        ↓                                    │
├─────────────────────────────────────────────────────────────┤
│ 同步层                                                       │
├─────────────────────────────────────────────────────────────┤
│                        ↓                                    │
│            同步到 Outlook/Google Calendar                    │
│              (body.content = description)                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. TimeLog 页面设计

### 2.1 整体布局

**Figma 设计稿**: [TimeLog 页面](https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=333-1178&m=dev)

**布局结构：**
```tsx
<div className="timelog-page">
  {/* 左侧控制区 */}
  <aside className="timelog-sidebar">
    <CalendarPicker value={selectedDate} onChange={setSelectedDate} />
    <TagFilter tags={allTags} hiddenTags={hiddenTags} onToggle={toggleTag} />
    <EventTypeFilter types={eventTypes} onChange={setEventTypes} />
  </aside>
  
  {/* 右侧时间轴 */}
  <main className="timelog-timeline">
    <h2>{formatDate(selectedDate)}</h2>
    <EventCardList events={filteredEvents} />
  </main>
</div>
```

**样式定义：**
```css
.timelog-page {
  display: flex;
  height: 100vh;
  gap: 24px;
  padding: 24px;
}

.timelog-sidebar {
  width: 280px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.timelog-timeline {
  flex: 1;
  overflow-y: auto;
  padding: 0 16px;
}
```

### 2.2 Event 卡片设计

**Event 卡片组件：**
```tsx
interface EventCardProps {
  event: Event;
  onExpand: (eventId: string) => void;  // 展开 EventEditModal
}

const EventCard: React.FC<EventCardProps> = ({ event, onExpand }) => {
  const hasPlannedTime = !!event.startTime;
  const hasActualTime = !!event.segments && event.segments.length > 0;
  
  return (
    <div className="event-card">
      {/* 时间与状态 */}
      <div className="event-header">
        <div className="event-time-icons">
          {hasPlannedTime && <span className="icon">📅</span>}
          {hasActualTime && <span className="icon">⏰</span>}
        </div>
        <div className="event-time-range">
          {formatTimeRange(event.startTime, event.endTime)}
        </div>
        <button className="expand-btn" onClick={() => onExpand(event.id)}>
          →
        </button>
      </div>
      
      {/* 标题与标签 */}
      <h3 className="event-title">
        {event.emoji} {event.title}
      </h3>
      <div className="event-tags">
        {event.tags?.map(tagId => <TagChip key={tagId} tagId={tagId} />)}
      </div>
      
      {/* 元数据 */}
      <div className="event-metadata">
        {event.participants && (
          <div>参会人：{event.participants.join(', ')}</div>
        )}
        {event.location && (
          <div>📍 {event.location}</div>
        )}
      </div>
      
      {/* eventlog 预览（折叠状态） */}
      <div className="event-log-preview">
        <EventLogPreview eventlog={event.eventlog} maxLines={3} />
      </div>
      
      {/* 同步状态 */}
      <div className="event-sync-status">
        {renderSyncStatus(event)}
      </div>
    </div>
  );
};
```

**样式定义：**
```css
.event-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  transition: box-shadow 0.2s;
}

.event-card:hover {
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}

.event-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.event-time-icons {
  display: flex;
  gap: 4px;
  font-size: 16px;
}

.event-title {
  font-size: 18px;
  font-weight: 600;
  margin: 8px 0;
}

.event-log-preview {
  margin-top: 12px;
  color: #6b7280;
  font-size: 14px;
  line-height: 1.5;
  
  /* 截断超过 3 行 */
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-btn {
  margin-left: auto;
  background: none;
  border: none;
  font-size: 20px;
  cursor: pointer;
  color: #9ca3af;
  transition: color 0.2s;
}

.expand-btn:hover {
  color: #3b82f6;
}
```

### 2.3 时间轴与过滤器

#### 2.3.1 日历选择器

**功能：**
- 默认显示所有时间的连续时间轴
- 用户可选择特定日期或日期范围
- 右侧时间轴只显示选中范围的 Events

**实现：**
```typescript
const [selectedDateRange, setSelectedDateRange] = useState<{
  start: Date | null;
  end: Date | null;
}>({ start: null, end: null });

const filteredEventsByDate = useMemo(() => {
  if (!selectedDateRange.start) {
    // 默认：显示所有 Events
    return allEvents;
  }
  
  return allEvents.filter(event => {
    const eventDate = new Date(event.startTime || event.createdAt);
    const inRange = 
      (!selectedDateRange.start || eventDate >= selectedDateRange.start) &&
      (!selectedDateRange.end || eventDate <= selectedDateRange.end);
    return inRange;
  });
}, [allEvents, selectedDateRange]);
```

#### 2.3.2 标签过滤器

**功能：**
- 显示所有标签的层级树
- 用户可点击标签前的 hide 按钮切换显示/隐藏
- **父标签 hide** → 整个子标签树都被过滤

**UI 示例：**
```
┌─────────────────────┐
│ 标签过滤器           │
├─────────────────────┤
│ [👁️] #工作          │ ← 显示中
│   [👁️] #文档编辑    │
│   [👁️] #开会        │
│ [👁️‍🗨️] #学习          │ ← 已隐藏（子标签也隐藏）
│   [👁️‍🗨️] #英语        │
│   [👁️‍🗨️] #编程        │
│ [👁️] #娱乐          │
└─────────────────────┘
```

**实现：**
```typescript
const [hiddenTagIds, setHiddenTagIds] = useState<Set<string>>(new Set());

// 递归获取子标签
const getChildTagIds = (tagId: string, tagTree: TagHierarchy): string[] => {
  const tag = tagTree.find(t => t.id === tagId);
  if (!tag || !tag.children) return [];
  
  const childIds = tag.children.map(c => c.id);
  const grandChildIds = tag.children.flatMap(c => getChildTagIds(c.id, tagTree));
  
  return [...childIds, ...grandChildIds];
};

// 切换标签显示/隐藏
const toggleTagVisibility = (tagId: string) => {
  setHiddenTagIds(prev => {
    const next = new Set(prev);
    
    if (next.has(tagId)) {
      // 显示：移除自己和所有子标签
      next.delete(tagId);
      const childIds = getChildTagIds(tagId, tagTree);
      childIds.forEach(id => next.delete(id));
    } else {
      // 隐藏：添加自己和所有子标签
      next.add(tagId);
      const childIds = getChildTagIds(tagId, tagTree);
      childIds.forEach(id => next.add(id));
    }
    
    return next;
  });
};

// 过滤 Events
const filteredEventsByTags = useMemo(() => {
  if (hiddenTagIds.size === 0) return filteredEventsByDate;
  
  return filteredEventsByDate.filter(event => {
    // 如果 event 的任何 tag 在 hiddenTagIds 中，就过滤掉
    return !event.tags?.some(tagId => hiddenTagIds.has(tagId));
  });
}, [filteredEventsByDate, hiddenTagIds]);
```

#### 2.3.3 事件类型过滤

**功能：**
- 计划事件（有 `startTime`，显示 📅）
- 计时事件（有 `segments`，显示 ⏰）
- 可多选

**实现：**
```typescript
const [eventTypeFilters, setEventTypeFilters] = useState<{
  planned: boolean;   // 计划事件
  timed: boolean;     // 计时事件
}>({ planned: true, timed: true });

const filteredEventsByType = useMemo(() => {
  return filteredEventsByTags.filter(event => {
    const isPlanned = !!event.startTime;
    const isTimed = !!event.segments && event.segments.length > 0;
    
    // 如果两个 filter 都不选，显示所有
    if (!eventTypeFilters.planned && !eventTypeFilters.timed) {
      return true;
    }
    
    // 符合任一条件即显示
    return (
      (eventTypeFilters.planned && isPlanned) ||
      (eventTypeFilters.timed && isTimed)
    );
  });
}, [filteredEventsByTags, eventTypeFilters]);
```

### 2.4 EventLog 预览与展开

**预览模式（TimeLog 页面卡片）：**
- 只显示 eventlog 的前 3 行
- 隐藏 timestamp 分隔线（紧凑显示）
- 点击卡片右侧的 `→` 按钮展开 EventEditModal

**实现：**
```typescript
const EventLogPreview: React.FC<{ eventlog?: string; maxLines?: number }> = ({
  eventlog,
  maxLines = 3
}) => {
  if (!eventlog) return null;
  
  // 解析 Slate JSON
  const slateNodes = JSON.parse(eventlog) as Descendant[];
  
  // 过滤掉 timestamp-divider 节点
  const contentNodes = slateNodes.filter(
    node => (node as any).type !== 'timestamp-divider'
  );
  
  // 转换为纯文本
  const plainText = contentNodes
    .map(node => serializeToPlainText([node]))
    .join('\n');
  
  // 截取前 maxLines 行
  const lines = plainText.split('\n').slice(0, maxLines);
  
  return (
    <div className="event-log-preview">
      {lines.map((line, i) => (
        <p key={i}>{line}</p>
      ))}
      {plainText.split('\n').length > maxLines && (
        <span className="more-indicator">...</span>
      )}
    </div>
  );
};
```

**展开操作：**
```typescript
const handleExpandEvent = (eventId: string) => {
  // 打开 EventEditModal（详情视图）
  setCurrentEditingEvent(eventId);
  setShowEventEditModal(true);
};
```

---

## 3. Event.eventlog 字段

### 3.1 数据结构定义

**字段类型：**
```typescript
interface Event {
  // ... 其他字段
  
  /**
   * 富文本日志字段（Slate JSON 字符串）
   * 
   * 特性：
   * - 包含自动插入的 timestamp 分隔线
   * - 支持富文本格式（加粗、颜色、列表等）
   * - 支持附件、链接、标签提及
   * - 用户在 TimeLog/EventEditModal/PlanManager 中编辑
   * 
   * ⚠️ 注意：用户界面只编辑此字段，description 字段由系统自动生成
   */
  eventlog?: string;
  
  /**
   * HTML 同步字段（从 eventlog 自动转换）
   * 
   * ⚠️ 仅用于 Outlook 同步，用户界面不显示
   */
  description?: string;
}
```

**Slate JSON 示例：**
```json
[
  {
    "type": "timestamp-divider",
    "timestamp": "2025-10-19T10:21:18Z",
    "isFirstOfDay": true,
    "displayText": "2025-10-19 10:21:18",
    "children": [{ "text": "" }]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "处理完了一些出差的logistics，还有报销整理，" }
    ]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "现在终于可以开工了！" }
    ]
  },
  {
    "type": "timestamp-divider",
    "timestamp": "2025-10-19T10:37:42Z",
    "minutesSinceLast": 16,
    "displayText": "16min later",
    "children": [{ "text": "" }]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "双击\"Alt\"召唤美桶、格式等，" },
      {
        "type": "tag",
        "tagId": "tag-123",
        "tagName": "工作",
        "mentionOnly": true,
        "children": [{ "text": "" }]
      },
      { "text": " 点击右下方问号..." }
    ]
  }
]
```

### 3.2 Timestamp 自动插入机制

#### 3.2.1 插入规则

**触发条件：**
1. **当天首次编辑** → 插入完整时间戳（如 `2025-10-19 10:21:18`）
2. **距上次编辑超过 5 分钟** → 插入相对时间戳（如 `16min later`）

**节点类型定义：**
```typescript
type TimestampDividerElement = {
  type: 'timestamp-divider';
  timestamp: string;           // ISO 8601 格式
  isFirstOfDay?: boolean;      // 是否为当天首次
  minutesSinceLast?: number;   // 距上次间隔（分钟）
  displayText: string;         // UI 显示文本
  children: [{ text: '' }];    // Slate Void 节点要求
};
```

#### 3.2.2 插入逻辑

**实现：**
```typescript
class EventLogTimestampService {
  private lastEditTimestamp: Map<string, Date> = new Map();
  
  /**
   * 检查是否需要插入 timestamp
   * @param eventId Event ID
   * @param eventlog 当前 eventlog（Slate JSON）
   * @returns 是否需要插入
   */
  shouldInsertTimestamp(eventId: string, eventlog: string): boolean {
    const lastEdit = this.lastEditTimestamp.get(eventId);
    const now = new Date();
    
    // 情况1：当天首次编辑
    if (!lastEdit || !isSameDay(lastEdit, now)) {
      return true;
    }
    
    // 情况2：距上次编辑超过 5 分钟
    const minutesElapsed = (now.getTime() - lastEdit.getTime()) / 1000 / 60;
    return minutesElapsed >= 5;
  }
  
  /**
   * 创建 timestamp divider 节点
   */
  createTimestampDivider(eventId: string): TimestampDividerElement {
    const lastEdit = this.lastEditTimestamp.get(eventId);
    const now = new Date();
    
    const isFirstOfDay = !lastEdit || !isSameDay(lastEdit, now);
    const minutesSinceLast = lastEdit 
      ? Math.floor((now.getTime() - lastEdit.getTime()) / 1000 / 60)
      : undefined;
    
    const displayText = isFirstOfDay
      ? formatDateTime(now) // "2025-10-19 10:21:18"
      : `${minutesSinceLast}min later`;
    
    return {
      type: 'timestamp-divider',
      timestamp: now.toISOString(),
      isFirstOfDay,
      minutesSinceLast,
      displayText,
      children: [{ text: '' }]
    };
  }
  
  /**
   * 在 Slate 编辑器中插入 timestamp
   */
  insertTimestamp(editor: Editor, eventId: string) {
    if (!this.shouldInsertTimestamp(eventId, /* current eventlog */)) {
      return;
    }
    
    const timestampNode = this.createTimestampDivider(eventId);
    
    // 在当前光标位置插入
    Transforms.insertNodes(editor, timestampNode);
    
    // 更新最后编辑时间
    this.lastEditTimestamp.set(eventId, new Date());
  }
}
```

#### 3.2.3 Slate 编辑器集成

**在 onChange 中检测：**
```typescript
const UnifiedSlateEditor: React.FC<Props> = ({ eventId, initialValue, onChange }) => {
  const [editor] = useState(() => withReact(createEditor()));
  const timestampService = useRef(new EventLogTimestampService());
  
  const handleChange = (newValue: Descendant[]) => {
    // 检查是否需要插入 timestamp
    const shouldInsert = timestampService.current.shouldInsertTimestamp(
      eventId,
      JSON.stringify(newValue)
    );
    
    if (shouldInsert) {
      // 插入 timestamp divider
      timestampService.current.insertTimestamp(editor, eventId);
    }
    
    // 触发保存
    onChange(newValue);
  };
  
  return (
    <Slate editor={editor} value={initialValue} onChange={handleChange}>
      <Editable
        renderElement={renderElement}
        renderLeaf={renderLeaf}
      />
    </Slate>
  );
};
```

### 3.3 Timestamp 渲染

**Slate 自定义元素渲染：**
```tsx
const TimestampDivider: React.FC<RenderElementProps> = ({
  attributes,
  children,
  element
}) => {
  const node = element as TimestampDividerElement;
  
  return (
    <div
      {...attributes}
      contentEditable={false}  // 不可编辑
      className="timestamp-divider"
    >
      <div className="timestamp-line">
        <span className="timestamp-icon">▸</span>
        <span className="timestamp-text">{node.displayText}</span>
        <span className="timestamp-badge">⊙</span>
      </div>
      {children}  {/* Slate Void 节点要求 */}
    </div>
  );
};
```

**样式定义：**
```css
.timestamp-divider {
  user-select: none;
  margin: 16px 0;
}

.timestamp-line {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f3f4f6;
  border-radius: 6px;
  font-size: 13px;
  color: #6b7280;
}

.timestamp-icon {
  font-size: 14px;
}

.timestamp-text {
  flex: 1;
  font-family: 'Courier New', monospace;
}

.timestamp-badge {
  font-size: 16px;
  opacity: 0.5;
}
```

### 3.4 不同场景下的显示策略

| 场景 | Timestamp 显示 | 说明 |
|------|----------------|------|
| TimeLog 页面 | ✅ 完整显示 | 时间轴视图，需要完整时间信息 |
| EventEditModal 右侧 | ✅ 完整显示 | Slate 编辑区，面积足够 |
| PlanManager description 行 | ❌ 隐藏 | 紧凑模式，过滤掉 timestamp-divider 节点 |

**PlanManager 隐藏 Timestamp 实现：**
```typescript
// PlanManager 渲染 eventlog 时
const renderEventLogWithoutTimestamp = (eventlog: string) => {
  const slateNodes = JSON.parse(eventlog) as Descendant[];
  
  // 过滤掉 timestamp-divider 节点
  const contentNodes = slateNodes.filter(
    node => (node as any).type !== 'timestamp-divider'
  );
  
  return (
    <Slate editor={editor} value={contentNodes}>
      <Editable />
    </Slate>
  );
};
```

---

## 4. 编辑场景

### 4.1 TimeLog 页面（主要编辑场景）

**特点：**
- 完整的 Slate 编辑器
- 显示所有 timestamp 分隔线
- 支持附件、富文本、标签提及
- 自动保存（2 秒防抖）

**布局：**
```
┌─────────────────────────────────────────┐
│ Event 卡片（展开状态）                   │
├─────────────────────────────────────────┤
│ 📅⏰ 10:00 - 12:00 准备演讲稿          │
│ #工作 #文档编辑                         │
│                                         │
│ ▸ 2025-10-19 10:21:18 ⊙                │ ← timestamp
│ 处理完了一些出差的logistics...          │
│ [Slate 编辑区]                          │
│                                         │
│ ▸ 16min later ⊙                        │ ← timestamp
│ 双击"Alt"召唤美桶...                   │
│ [Slate 编辑区]                          │
│                                         │
│ [😊 # 📅 • 🎨 ✓]  FloatingBar         │
└─────────────────────────────────────────┘
```

### 4.2 EventEditModal 右侧（次要编辑场景）

**特点：**
- 与 TimeLog 页面相同的编辑体验
- 右侧 Slate 编辑区（flex: 1）
- 完整显示 timestamp

**参考：**
- 详见 [EventEditModal v2 PRD - Section 5](./EVENTEDITMODAL_V2_PRD.md#5-右侧event-log)

### 4.3 PlanManager description 行（紧凑模式）

**特点：**
- **隐藏 timestamp 分隔线**
- 只显示内容段落
- 节省垂直空间

**数据流纠正：**
```typescript
// ❌ 错误：PlanManager 写入 description 字段
await EventService.updateEvent(eventId, {
  description: slateHtml  // 错误！
});

// ✅ 正确：PlanManager 写入 eventlog 字段
await EventService.updateEvent(eventId, {
  eventlog: JSON.stringify(slateNodes)  // 正确！
});
```

**实现示例：**
```typescript
// PlanManager.tsx
const handleDescriptionChange = (slateNodes: Descendant[]) => {
  const { tags, plainText } = serializeSlateToHtmlWithTags(slateNodes);
  
  const updatedEvent: Event = {
    ...currentEvent,
    // ✅ 写入 eventlog 字段
    eventlog: JSON.stringify(slateNodes),
    // description 由系统自动生成，不手动设置
  };
  
  await EventService.updateEvent(currentEvent.id, updatedEvent);
};
```

---

## 5. Outlook 同步机制

### 5.1 eventlog → description 自动转换

**转换时机：**
- EventService.updateEvent() 保存时
- 同步到 Outlook 之前

**转换流程：**
```typescript
class EventService {
  async updateEvent(eventId: string, updates: Partial<Event>) {
    const event = await this.getEvent(eventId);
    
    // 如果 eventlog 有更新，自动生成 description
    if (updates.eventlog) {
      const slateNodes = JSON.parse(updates.eventlog) as Descendant[];
      
      // 转换为 HTML（用于 Outlook）
      const { html, plainText } = serializeSlateToHtml(slateNodes);
      
      updates.description = html;
    }
    
    // 保存到 localStorage
    const updatedEvent = { ...event, ...updates };
    this.saveToStorage(updatedEvent);
    
    // 触发同步
    if (shouldSync(updatedEvent)) {
      await SyncManager.syncEvent(updatedEvent);
    }
    
    return updatedEvent;
  }
}
```

### 5.2 智能序列化策略

**目标：**
- 保留格式（加粗、颜色、列表）
- 降级复杂元素（表格 → Markdown 文本）
- 过滤 timestamp 分隔线（Outlook 不需要）

**实现：**
```typescript
function serializeSlateToHtml(nodes: Descendant[]): {
  html: string;
  plainText: string;
} {
  // 1. 过滤掉 timestamp-divider
  const contentNodes = nodes.filter(
    node => (node as any).type !== 'timestamp-divider'
  );
  
  // 2. 转换为 HTML
  const html = contentNodes
    .map(node => serializeNode(node))
    .join('');
  
  // 3. 提取纯文本
  const plainText = contentNodes
    .map(node => extractPlainText(node))
    .join('\n');
  
  return { html, plainText };
}

function serializeNode(node: Descendant): string {
  if (Text.isText(node)) {
    let html = escapeHtml(node.text);
    
    // 应用格式
    if (node.bold) html = `<strong>${html}</strong>`;
    if (node.italic) html = `<em>${html}</em>`;
    if (node.color) html = `<span style="color: ${node.color}">${html}</span>`;
    
    return html;
  }
  
  const element = node as Element;
  const children = element.children.map(serializeNode).join('');
  
  switch (element.type) {
    case 'paragraph':
      return `<p>${children}</p>`;
    case 'heading':
      return `<h${element.level}>${children}</h${element.level}>`;
    case 'bulleted-list':
      return `<ul>${children}</ul>`;
    case 'list-item':
      return `<li>${children}</li>`;
    case 'tag':
      // 标签转为纯文本提及
      const tag = element as TagNode;
      return tag.mentionOnly 
        ? `#${tag.tagEmoji || ''}${tag.tagName}`
        : `<span class="tag">${tag.tagEmoji}${tag.tagName}</span>`;
    case 'table':
      // 表格降级为 Markdown
      return `<pre>${serializeTableToMarkdown(element)}</pre>`;
    default:
      return children;
  }
}
```

### 5.3 Outlook 同步示例

**本地 Event.eventlog（Slate JSON）：**
```json
[
  { "type": "timestamp-divider", "displayText": "2025-10-19 10:21:18", ... },
  { "type": "paragraph", "children": [{ "text": "讨论了功能优先级" }] },
  { "type": "paragraph", "children": [
    { "text": "需要与 " },
    { "type": "tag", "tagName": "张三", "mentionOnly": true, ... },
    { "text": " 确认" }
  ]}
]
```

**转换后的 Event.description（HTML）：**
```html
<p>讨论了功能优先级</p>
<p>需要与 #张三 确认</p>
```

**Outlook 中显示：**
```
讨论了功能优先级
需要与 #张三 确认
```

---

## 6. 版本控制与历史

### 6.1 EventHistoryService（Event 级别）

**职责：**
- 记录 Event 的 CRUD 操作
- 记录字段变更（title, tags, startTime 等）
- 支持时间段查询

**实现参考：**
- 详见顶部「架构决策记录 → 决策：构建双层历史记录系统」

### 6.2 VersionControlService（eventlog 内容级别）

**职责：**
- 自动保存 eventlog 版本快照（5 分钟间隔）
- 记录 Slate 编辑操作
- 版本对比和恢复

**版本触发条件：**
```typescript
type VersionTriggerType =
  | 'auto-save'      // 自动保存（5 分钟间隔）
  | 'manual-save'    // 用户手动保存
  | 'before-sync'    // 同步前快照
  | 'major-edit';    // 重大编辑（如删除大段内容）
```

**数据结构：**
```typescript
type EventLogVersion = {
  id: string;
  eventId: string;
  timestamp: string;         // ISO 8601
  content: Descendant[];     // Slate JSON 快照
  triggerType: VersionTriggerType;
  changesSummary?: string;   // 变更摘要
};
```

---

## 7. 离线队列与保存机制

### 7.1 保存架构层次

**核心原则：保存逻辑在模块层统一实现**

```
┌─────────────────────────────────────────────────────────┐
│ UnifiedSlateEditor（纯编辑器组件）                       │
│ - 只负责编辑 Slate JSON                                  │
│ - onChange 回调通知父组件内容变化                        │
│ - 不关心保存到哪里、保存什么字段                         │
└─────────────────────────────────────────────────────────┘
                  ↓ onChange
┌─────────────────────────────────────────────────────────┐
│ 模块层（TimeLog/EventEditModal/PlanManager）            │
│ ✅ 这里实现保存逻辑                                      │
│ - 接收 Slate 的 onChange                                 │
│ - 决定更新哪些字段（eventlog）                           │
│ - 实现防抖、批量保存                                     │
│ - 调用 EventService.updateEvent()                        │
└─────────────────────────────────────────────────────────┘
                  ↓ updateEvent
┌─────────────────────────────────────────────────────────┐
│ EventService（数据服务层）                               │
│ - 更新 Event 对象的所有字段                              │
│ - 自动生成 description（从 eventlog 转换）               │
│ - 持久化到 localStorage                                  │
│ - 触发 Outlook 同步（如需要）                            │
│ - 检测离线时加入 OfflineQueue                            │
└─────────────────────────────────────────────────────────┘
```

### 7.2 离线队列触发时机

**参考现有实现：**
- Slate 编辑器：2 秒防抖 + Enter/失焦立即保存
- PlanManager：300ms 二次防抖

**离线队列触发：**
```typescript
class EventService {
  async updateEvent(eventId: string, updates: Partial<Event>) {
    try {
      // 1. 本地保存
      const updatedEvent = this.saveToLocalStorage(eventId, updates);
      
      // 2. 尝试同步
      if (navigator.onLine) {
        await SyncManager.syncEvent(updatedEvent);
      } else {
        // 3. 离线时加入队列
        await OfflineQueue.enqueue(eventId, 'push');
      }
      
      return updatedEvent;
    } catch (error) {
      // 4. 同步失败也加入队列
      await OfflineQueue.enqueue(eventId, 'push');
      throw error;
    }
  }
}
```

**OfflineQueue 处理时机：**
1. **应用启动时** - 检查并处理未完成的队列
2. **网络恢复时** - 监听 `online` 事件自动触发
3. **用户手动触发** - "同步"按钮

```typescript
class OfflineQueue {
  async init() {
    // 1. 应用启动时处理
    await this.processQueue();
    
    // 2. 监听网络恢复
    window.addEventListener('online', () => {
      this.processQueue();
    });
  }
  
  async processQueue() {
    if (!navigator.onLine) return;
    
    while (this.queue.length > 0) {
      const op = this.queue[0];
      
      try {
        await SyncManager.syncEvent(op.eventId);
        this.queue.shift();  // 成功后移除
      } catch (error) {
        op.retryCount++;
        
        if (op.retryCount >= 3) {
          this.queue.shift();  // 超过重试次数，移除
        } else {
          break;  // 等待下次重试
        }
      }
    }
  }
}
```

---

## 8. 实现指南

### 8.1 Phase 1: TimeLog 页面基础（Week 1-2）

- [ ] TimeLog 页面布局（左侧控制 + 右侧时间轴）
- [ ] Event 卡片组件
- [ ] 日历选择器集成
- [ ] 标签过滤器（支持 tag tree）
- [ ] Event 卡片展开 → EventEditModal

### 8.2 Phase 2: eventlog 字段实现（Week 3-4）

- [ ] Timestamp 分隔线节点类型定义
- [ ] Timestamp 自动插入逻辑
- [ ] Timestamp 渲染组件
- [ ] PlanManager 数据流修正（写入 eventlog）
- [ ] EventService 自动转换 description

### 8.3 Phase 3: Outlook 同步优化（Week 5-6）

- [ ] 智能序列化层（过滤 timestamp）
- [ ] 表格降级为 Markdown
- [ ] 附件链接生成（Web Viewer）
- [ ] 字段级冲突检测
- [ ] Git 风格 Diff UI

### 8.4 Phase 4: 版本控制（Week 7-8）

- [ ] EventHistoryService 实现
- [ ] VersionControlService 实现
- [ ] 版本历史 UI
- [ ] 版本对比和恢复功能

---

## 9. 技术栈

- **Slate.js**: 富文本编辑器核心
- **React**: UI 框架
- **TypeScript**: 类型安全
- **UnifiedSlateEditor**: 统一编辑器组件（已有）
- **EventService**: 事件数据服务（已有）
- **TimeHub**: 时间管理中枢（已有）
- **SyncManager**: Outlook 同步引擎（已有）

**决策内容：**
- ContextMarker（情境感知时间轴）功能**不作为 v1.0 核心功能**
- 延后至 **v2.0** 实施，优先完成基础 TimeLog 系统

**理由：**
1. **技术复杂度** - 需要桌面活动监听、权限管理、隐私保护等额外工作
2. **平台差异** - Windows/macOS 权限机制不同，需要分别适配
3. **优先级** - 基础富文本编辑、版本控制、同步功能更关键

**v2.0 实施参考：**
- **开源方案借鉴** - 参考 Shion 等开源项目的实现
- **权限处理** - Windows 大概率不需要管理员权限（待验证）
- **隐私保护** - 活动日志**不同步到 Outlook**，仅本地存储
- **可选功能** - 提供用户开关，支持"隐私模式"（不记录特定应用）

**当前版本（v1.0）影响：**
- Section 2 的 ContextMarker 相关内容作为**未来设计参考**
- 不实现 `DesktopActivityService` 类
- 不依赖 `active-win` 库
- Slate 编辑器暂不渲染时间轴和活动轴

**保留内容：**
- `ContextMarkerElement` 类型定义（为未来兼容）
- TimeSpec 架构（v2.0 可直接使用）

### 决策：构建双层历史记录系统

**决策内容：**
- **EventHistoryService** - 记录 Event 级别的 CRUD 操作（新增、修改、删除）
- **VersionControlService** - 记录 TimeLog 内容的细粒度编辑历史（Slate 操作）

**问题分析：**

当前 EventService 的局限：

| 功能 | 当前状态 | 说明 |
|------|---------|------|
| CRUD 操作 | ✅ 有 | EventService 提供完整的增删改查 |
| 当前状态存储 | ✅ 有 | localStorage 存储所有事件的当前状态 |
| 历史记录 | ❌ 无 | 不记录事件的变更历史 |
| 变更溯源 | ❌ 无 | 无法查询"谁在什么时候改了什么" |
| 时间段查询 | ❌ 无 | 无法查询"过去7天创建/修改了哪些事件" |

**双层架构设计：**

```typescript
// 第一层：Event 级别历史（粗粒度）
class EventHistoryService {
  // 记录 Event 的 CRUD 操作
  async recordEventChange(
    eventId: string,
    operation: 'create' | 'update' | 'delete',
    snapshot: Event,
    changedFields?: string[]
  ): Promise<EventHistoryEntry>;
  
  // 查询事件历史
  async getEventHistory(eventId: string): Promise<EventHistoryEntry[]>;
  
  // 查询时间段内的变更
  async getChangesInPeriod(startDate: Date, endDate: Date): Promise<EventHistoryEntry[]>;
  
  // 恢复到特定版本
  async restoreEventVersion(eventId: string, historyId: string): Promise<Event>;
}

// 第二层：TimeLog 内容级别版本（细粒度）
class VersionControlService {
  // 记录 Slate 编辑操作
  recordOperation(operation: SlateOperation, editor: Editor): void;
  
  // 自动保存版本快照（5分钟间隔）
  async createVersion(trigger: VersionTriggerType): Promise<EventLogVersion>;
  
  // 恢复到特定版本
  async restoreVersion(versionId: string): Promise<Descendant[]>;
  
  // 版本对比
  async compareVersions(v1: string, v2: string): Promise<Delta>;
}
```

**存储位置：**
- **EventHistory** - 独立集合/表 `event_history`（便于跨 Event 查询）
- **EventLogVersions** - 嵌入在 `Event.eventlog.versions` 数组中（最多 50 个）

**关键区别：**

| 维度 | EventHistoryService | VersionControlService |
|------|-------------------|---------------------|
| **粒度** | Event 级别（title/tags/startTime 等字段变更） | Slate 节点级别（段落/标签/ContextMarker） |
| **触发** | 每次 EventService.updateEvent() | 每 5 分钟或重大编辑 |
| **存储** | 独立 event_history 集合 | Event.eventlog.versions 数组 |
| **用途** | 审计日志、变更溯源、时间段统计 | 内容撤销/重做、协作冲突解决 |
| **保留期** | 永久保留（或按策略归档） | 最近 50 个版本 |

**实施阶段：**
- **Phase 2** - EventHistoryService（Week 3-4）
  - 记录 Event CRUD 操作
  - 提供变更查询 API
  - 在 EventService 中集成调用
  
- **Phase 3** - VersionControlService（Week 5-6）
  - 记录 Slate 编辑操作
  - 自动保存版本快照
  - 实现版本对比和恢复

**影响范围：**
- Section 6: 拆分为 6.1 EventHistoryService 和 6.2 VersionControlService
- Section 7.2: 数据库设计新增 event_history 集合
- EventService: 集成 EventHistoryService 调用

### 决策：字段级冲突检测 + Git 风格 Diff UI

**决策内容：**
- **字段级冲突检测** - 检测 Event 每个字段的独立冲突（title/tags/eventlog/startTime 等）
- **Git 风格 Diff UI** - 显示本地 vs 远程的并排对比，用户选择 Keep/Undo
- **智能序列化系统** - Slate JSON → HTML 转换，保留格式和元数据

**核心要点：**

1. **TimeLog Timestamp 的特殊性**
   - TimeLog 中的 timestamp 显示是**只读 UI 元素**（不可编辑）
   - 与 Event.startTime/endTime 完全独立（两个不同概念）
   - Event.startTime = 用户设定的事件时间
   - TimeLog timestamp = 内容编辑时的自动记录时间

2. **字段级冲突检测策略**
   ```typescript
   interface ConflictResult {
     hasConflict: boolean;
     conflictedFields: FieldConflict[];  // 具体哪些字段冲突
     resolution: ConflictResolution;
   }
   
   type FieldConflict = {
     field: string;                   // 'title' | 'tags' | 'eventlog' | 'startTime'
     localValue: any;
     remoteValue: any;
     localHash: string;
     remoteHash: string;
     lastSyncValue?: any;             // 三方合并基准
   };
   ```

3. **Slate JSON → HTML 序列化规范**
   
   **保留的格式：**
   - 字体颜色、背景色
   - 加粗、斜体、下划线
   - 列表（bullet points、numbered）
   - 链接
   
   **特殊处理：**
   - **表格** → Markdown 风格文本表格（多端可读）
   - **图片** → `[查看图片: filename.png](link to web viewer)`
   - **附件** → `[附件: document.pdf](link to web viewer)`
   - **ContextMarker（v2.0）** → 隐藏在 Outlook（仅保留 data-* 属性）
   
   **Web Viewer 链接：**
   - 格式：`https://app.remarkable.com/events/{eventId}/eventlog`
   - 用户点击后打开完整的 TimeLog 页面（支持富文本渲染）

**实施阶段：**
- **Phase 2** - 字段级冲突检测 + 序列化系统
- **Phase 3** - Diff UI 组件 + Web Viewer

**影响范围：**
- Section 5: 同步引擎设计（新增字段级冲突检测）
- Section 5.4: Slate JSON → HTML 序列化层
- Section 5.5: 冲突解决 UI 组件

---

## ⚠️ 重要：时间处理规范

> **🚫 禁止使用 ISO 8601 格式进行时间处理！**
>
> **本应用的时间架构基于 [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md)，所有时间相关功能必须遵循以下规则：**
>
> ### 核心要求
> 
> 1. **使用 TimeSpec 而非 ISO 字符串**
>    - ❌ 错误：`timestamp: "2025-11-03T10:00:00Z"`
>    - ✅ 正确：使用 `TimeSpec` 对象，包含 `kind`、`source`、`rawText`、`resolved`、`policy` 等字段
>
> 2. **使用 TimeHub 作为时间的唯一真相源**
>    - ❌ 错误：直接修改 `event.startTime` 等字段
>    - ✅ 正确：通过 `TimeHub.setEventTime()` 或 `TimeHub.setFuzzy()` 更新时间
>
> 3. **使用 useEventTime Hook 读取时间**
>    - ❌ 错误：直接读取 `event.startTime`
>    - ✅ 正确：`const { timeSpec, start, end, allDay } = useEventTime(eventId)`
>
> 4. **保留用户时间意图**
>    - ✅ 通过 `timeSpec.rawText` 保存用户原始输入（如"下周"）
>    - ✅ 通过 `timeSpec.window` 保留时间窗口信息
>    - ✅ 通过 `timeSpec.policy` 应用用户的时间偏好
>
> ### 需要替换的模式
>
> 如果在本文档中发现以下模式，需要立即修正：
>
> - `ISODateTimeString` 类型 → 使用 `TimeSpec`
> - `timestamp: string` → `timeSpec: TimeSpec`
> - `new Date().toISOString()` → `TimeHub.setEventTime()` 或 `TimeHub.setFuzzy()`
> - 直接操作日期对象 → 使用 TimeParsingService
> - 手动计算时间窗口 → 使用 TimeSpec 的 window 字段和 policy
>
> ### 参考文档
>
> - **[TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md)** - 统一时间架构完整说明
> - **src/services/TimeHub.ts** - 时间中枢实现
> - **src/hooks/useEventTime.ts** - React Hook 实现
> - **src/services/TimeParsingService.ts** - 时间解析服务

---

## 目录

1. [系统概述](#1-系统概述)
2. [情境感知时间轴编辑器](#2-情境感知时间轴编辑器)
3. [Description 标签提及功能](#3-description-标签提及功能)
4. [数据格式选型](#4-数据格式选型)
5. [双向同步架构](#5-双向同步架构)
6. [版本控制系统](#6-版本控制系统)
7. [实现指南](#7-实现指南)
8. [性能优化](#8-性能优化)
9. [技术栈](#9-技术栈)

---

## 1. 系统概述

### 1.1 核心愿景与设计哲学

本项目的目标是创建一个超越传统富文本编辑器的 **"个人时空叙事引擎"**。用户输入的每一段文字不再是孤立的，而是被自动锚定在一条丰富的时间轴上。这条时间轴不仅记录 **"何时"**（时间戳），还将融合 **"何事"**（应用活动、媒体播放等），为用户的思绪和工作流提供完整的情境上下文。

**设计哲学：**

1. **情境优先 (Context-First):** 编辑器不仅服务于文字，更服务于文字产生的完整情境。
2. **无感记录 (Frictionless Logging):** 核心情境数据（时间、应用活动）应自动捕获，用户只需专注于内容创作。
3. **数据融合而非干扰 (Integration over Interruption):** 时间轴和活动轴是内容的"伴侣"，而非"主角"。UI 设计应优雅、直观，通过视觉引导增强叙事，而非分散注意力。
4. **为未来扩展而设计 (Built for Scale):** 数据模型和渲染逻辑必须解耦，以便未来轻松接入任何来源的数据（移动端、IoT设备、API等）。
5. **时间架构统一 (Unified Time Architecture):** 所有时间处理遵循 TimeHub/TimeSpec 架构，保留用户意图，支持自然语言输入。

### 1.2 核心需求

ReMarkable 需要一个富文本编辑系统来记录事件描述（`eventlog`），支持：

**内容格式**:
- ✅ 文本格式：字体颜色、背景色、加粗、斜体、下划线
- ✅ 结构化内容：分级标题、列表（bullet/numbered）、表格
- ✅ 媒体内容：链接、图片、音频、视频、录音
- ✅ 特殊元素：@mention、标签

**同步需求**:
- ✅ eventlog ↔ Outlook description 双向同步
- ✅ 富媒体降级为文本/HTML
- ✅ 冲突检测和解决

**版本控制**:
- ✅ 每 5 分钟间隔自动保存版本
- ✅ 重大编辑时立即保存
- ✅ 版本历史查看和恢复

**情境感知（新增）**:
- ✅ 自动在 5 分钟编辑间隔处插入情境标记（ContextMarker）
- ✅ 记录时间轴：每个标记包含时间戳（使用 TimeSpec）
- ✅ 记录活动轴：自动捕获应用使用情况（应用名称、窗口标题、使用时长）
- ✅ 可视化渲染：时间轴和活动轴以优雅的方式显示在编辑器左侧
- ✅ 活动数据融合：支持桌面端、移动端等多源数据合并

### 1.3 架构概览

```
┌───────────────────────────────────────────────────────────────────┐
│ ReMarkable App                                                    │
├───────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌──────────────┐       ┌────────────────┐    ┌──────────────┐  │
│  │ Slate Editor │◄─────►│ Version Control│    │ TimeHub      │  │
│  │ (用户编辑)    │       │ (5分钟快照)     │    │ (时间中枢)   │  │
│  └──────┬───────┘       └────────────────┘    └──────┬───────┘  │
│         │                                             │          │
│         │ ┌───────────────────────────────────────────┘          │
│         ↓ ↓                                                      │
│  ┌─────────────────────┐          ┌─────────────────────┐       │
│  │ Slate JSON (主存储)  │          │ ActivityService     │       │
│  │ - ParagraphElement  │◄────────►│ (情境捕获)          │       │
│  │ - ContextMarker     │          │ - Desktop Monitor   │       │
│  │   · timeSpec        │          │ - Remote Providers  │       │
│  │   · activities[]    │          └─────────────────────┘       │
│  └──────┬──────────────┘                                        │
│         │                                                        │
│         ↓                                                        │
│  ┌─────────────────────┐                                        │
│  │ Serializer Layer    │                                        │
│  │ (双向转换引擎)       │                                        │
│  └──────┬──────────────┘                                        │
│         │                                                        │
│    ┌────┴─────┐                                                 │
│    ↓          ↓                                                 │
│   HTML    Plain Text                                            │
│    │          │                                                 │
└────┼──────────┼─────────────────────────────────────────────────┘
     │          │
     ↓          ↓
┌───────────────────────────────────────────────────────────────────┐
│ Outlook Calendar API                                              │
│ event.body.content (HTML)                                         │
│ event.bodyPreview (Plain Text)                                    │
└───────────────────────────────────────────────────────────────────┘
```

---

---

## 附录 A: ContextMarker 功能（v2.0）

> **⏸️ 状态**: 延后至 v2.0 实施  
> **原因**: 需要桌面活动监听、权限管理等额外工作，v1.0 优先完成基础 TimeLog 功能  

### A.1 核心概念

情境感知时间轴将用户的编辑行为自动锚定在时间和活动的上下文中，创造一个 **"个人工作叙事"**。

**关键特性：**

1. **自动情境标记（ContextMarker）**
   - 当用户停止输入超过 5 分钟后再次编辑时，自动在当前段落上方插入一个情境标记
   - 标记包含时间戳（通过 TimeHub 管理）和这段时间内的应用活动记录

2. **双轴可视化**
   - **时间轴**：在编辑器左侧显示时间戳（如 "10:30"）
   - **活动轴**：在时间戳下方用彩色条形图显示应用使用情况
   - 每个应用条的高度与使用时长成正比，颜色为应用主题色

3. **情境数据结构**
   ```typescript
   type ContextMarkerElement = {
     type: 'context-marker';
     timeSpec: TimeSpec;              // 使用 TimeSpec 而非 ISO 字符串
     activities: ActivitySpan[];      // 活动记录数组
     children: [{ text: '' }];        // Slate Void 节点要求
   };
   
   type ActivitySpan = {
     appId: string;                   // 如 "com.figma.desktop"
     appName: string;                 // 如 "Figma"
     appColor: string;                // 应用主题色（HEX）
     title: string | null;            // 窗口标题
     duration: number;                // 持续时长（秒）
   };
   ```

### 2.2 自动注入逻辑

**触发条件：**
- 用户停止编辑超过 5 分钟
- 用户再次开始输入文本（非删除或格式化操作）

**执行流程：**

```typescript
// 伪代码
const lastModifiedTimestamp = useRef<Date | null>(null);

const handleEditorChange = async (editor: Editor) => {
  const now = new Date();
  
  // 检查是否需要插入 ContextMarker
  if (lastModifiedTimestamp.current) {
    const elapsed = now.getTime() - lastModifiedTimestamp.current.getTime();
    const isTextInput = /* 检测是否为文本输入操作 */;
    
    if (elapsed > 5 * 60 * 1000 && isTextInput) {
      // 1. 获取活动数据
      const activities = await ActivityService.getActivitiesSince(
        lastModifiedTimestamp.current
      );
      
      // 2. 创建 TimeSpec（使用 TimeHub）
      const timeSpec = await TimeHub.createTimeSpec({
        kind: 'fixed',
        source: 'system',
        resolved: { start: now, end: now },
      });
      
      // 3. 创建 ContextMarker
      const marker: ContextMarkerElement = {
        type: 'context-marker',
        timeSpec,
        activities,
        children: [{ text: '' }],
      };
      
      // 4. 在当前位置上方插入
      const currentPath = editor.selection?.anchor.path || [0];
      Transforms.insertNodes(editor, marker, { 
        at: [currentPath[0]] 
      });
    }
  }
  
  // 更新最后修改时间
  lastModifiedTimestamp.current = now;
};
```

### 2.3 ActivityService 架构

**职责：** 从各种来源收集和聚合应用活动数据。

**桌面端实现（DesktopActivityService）：**

```typescript
class DesktopActivityService {
  private activityLog: RawActivity[] = [];
  private currentActivity: RawActivity | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  
  // 启动监听
  start() {
    this.pollInterval = setInterval(() => {
      this.captureCurrentActivity();
    }, 1000); // 每秒轮询
  }
  
  // 捕获当前活动窗口
  private async captureCurrentActivity() {
    const activeWindow = await getActiveWindow(); // 使用 active-win 等库
    
    if (!activeWindow) return;
    
    const now = new Date();
    const appId = activeWindow.owner.bundleId || activeWindow.owner.name;
    
    // 如果应用切换了，结束当前活动并开始新活动
    if (this.currentActivity?.appId !== appId) {
      if (this.currentActivity) {
        this.currentActivity.endTime = now;
        this.activityLog.push(this.currentActivity);
      }
      
      this.currentActivity = {
        appId,
        appName: activeWindow.owner.name,
        title: activeWindow.title,
        startTime: now,
        endTime: null,
      };
    }
  }
  
  // 获取指定时间范围内的活动
  getActivitiesSince(since: Date): ActivitySpan[] {
    const activities = this.activityLog.filter(
      activity => activity.startTime >= since
    );
    
    return activities.map(activity => ({
      appId: activity.appId,
      appName: activity.appName,
      appColor: getAppColor(activity.appId), // 从配置获取应用颜色
      title: activity.title,
      duration: activity.endTime 
        ? (activity.endTime.getTime() - activity.startTime.getTime()) / 1000
        : 0,
    }));
  }
  
  // 停止监听
  stop() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
    }
  }
}
```

**移动端融合（未来扩展）：**

```typescript
class RemoteActivityProvider {
  async fetchActivitiesFromAPI(userId: string, since: Date): Promise<ActivitySpan[]> {
    // 从后端 API 获取移动端活动数据
    const response = await fetch(`/api/users/${userId}/activities?since=${since}`);
    return response.json();
  }
}

class UnifiedActivityService {
  constructor(
    private desktop: DesktopActivityService,
    private remoteProviders: RemoteActivityProvider[]
  ) {}
  
  async getActivitiesSince(since: Date): Promise<ActivitySpan[]> {
    // 合并所有来源的活动数据
    const desktopActivities = this.desktop.getActivitiesSince(since);
    const remoteActivities = await Promise.all(
      this.remoteProviders.map(provider => 
        provider.fetchActivitiesFromAPI(userId, since)
      )
    );
    
    // 按时间排序并返回
    return [...desktopActivities, ...remoteActivities.flat()]
      .sort((a, b) => a.startTime - b.startTime);
  }
}
```

### 2.4 渲染层实现

**Slate 自定义渲染器：**

```typescript
const renderElement = ({ element, attributes, children }: RenderElementProps) => {
  switch (element.type) {
    case 'paragraph':
      // 段落左侧留出时间轴空间
      return <p {...attributes} className="pl-16 min-h-[1.5em]">{children}</p>;
    
    case 'context-marker':
      return (
        <div {...attributes} className="relative h-auto mb-4">
          {/* 时间戳（左侧固定位置） */}
          <div className="absolute left-0 top-0 w-14 text-right pr-2">
            <TimeDisplay timeSpec={element.timeSpec} />
          </div>
          
          {/* 活动轴（时间戳下方） */}
          <div className="absolute left-0 top-6 w-14">
            <ActivityAxis activities={element.activities} />
          </div>
          
          {/* Slate 要求的 children */}
          <div className="hidden">{children}</div>
        </div>
      );
    
    default:
      return <p {...attributes}>{children}</p>;
  }
};
```

**时间显示组件（遵循 TimeSpec）：**

```typescript
const TimeDisplay: React.FC<{ timeSpec: TimeSpec }> = ({ timeSpec }) => {
  const { start } = timeSpec.resolved;
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: false 
    });
  };
  
  return (
    <span className="text-xs text-gray-500 font-mono">
      {formatTime(start)}
    </span>
  );
};
```

**活动轴组件：**

```typescript
const ActivityAxis: React.FC<{ activities: ActivitySpan[] }> = ({ activities }) => {
  const SCALE_FACTOR = 0.1; // 每秒 0.1px
  
  return (
    <div className="flex flex-col items-end gap-0.5">
      {activities.map((activity, index) => (
        <div
          key={index}
          className="w-2 rounded-sm transition-all hover:w-4 cursor-pointer"
          style={{
            height: `${activity.duration * SCALE_FACTOR}px`,
            backgroundColor: activity.appColor,
            minHeight: '4px',
          }}
          title={`${activity.appName}${activity.title ? ': ' + activity.title : ''} (${formatDuration(activity.duration)})`}
        />
      ))}
    </div>
  );
};

const formatDuration = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    return `${hours}小时${minutes % 60}分钟`;
  }
  return `${minutes}分钟`;
};
```

### 2.5 长时间间隔的压缩显示

**问题：** 如果用户长时间没有记录（如中午休息 2 小时），活动轴会非常长。

**解决方案：** "Breakout" 压缩显示

```typescript
const ActivityAxis: React.FC<{ activities: ActivitySpan[] }> = ({ activities }) => {
  const totalDuration = activities.reduce((sum, a) => sum + a.duration, 0);
  const MAX_HEIGHT = 300; // 最大高度限制
  
  // 如果总时长超过阈值，启用压缩模式
  const isCompressed = totalDuration > 3600; // 超过 1 小时
  
  if (isCompressed) {
    // 方案A：显示关键应用 Icon 堆叠
    const topApps = activities
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 3);
    
    return (
      <div className="flex flex-col items-end gap-1">
        <div className="text-xs text-gray-400">
          {formatDuration(totalDuration)}
        </div>
        <div className="flex flex-col gap-0.5">
          {topApps.map((app, i) => (
            <div
              key={i}
              className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: app.appColor }}
              title={app.appName}
            >
              {app.appName[0]}
            </div>
          ))}
        </div>
        <div className="h-px w-full border-t border-dashed border-gray-300" />
      </div>
    );
  }
  
  // 正常渲染
  return (/* 上文的活动轴渲染逻辑 */);
};
```

### 2.6 与 TimeHub 集成

所有时间相关操作必须通过 TimeHub：

```typescript
// ❌ 错误：直接使用 ISO 字符串
const marker = {
  type: 'context-marker',
  timestamp: new Date().toISOString(), // 禁止！
  activities: [],
};

// ✅ 正确：使用 TimeHub 创建 TimeSpec
const createContextMarker = async (activities: ActivitySpan[]) => {
  const now = new Date();
  
  // 通过 TimeHub 创建 TimeSpec
  const timeSpec: TimeSpec = {
    kind: 'fixed',
    source: 'system',
    rawText: null,
    policy: TimePolicy.getDefault(),
    resolved: { start: now, end: now },
    start: now,
    end: now,
    allDay: false,
  };
  
  return {
    type: 'context-marker',
    timeSpec,
    activities,
    children: [{ text: '' }],
  } as ContextMarkerElement;
};
```

---

## 3. Description 标签提及功能

### 3.1 功能概述

**版本**: v1.9.6  
**日期**: 2025-11-12  
**状态**: ✅ 已实现

在 **Description** 字段中支持插入标签，但这些标签仅作为**提及（Mention）**，不会成为 Event 的正式 tags。

在同步到远程日历（Microsoft Outlook/Google Calendar）时，这些标签会被转换为纯文本格式：`#emoji tagName`。

### 3.2 核心区别

| 位置 | 插入标签 | mentionOnly | 添加到 Event.tags | 同步到远程 |
|------|---------|-------------|------------------|-----------|
| **Title** | ✅ | `false` | ✅ 是 | HTML 标签 |
| **Description** | ✅ | `true` | ❌ 否 | `#emoji text` |

### 3.3 标签类型定义

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

### 3.4 使用方法

#### 在 Description 中插入标签

1. 点击 Description 编辑器
2. 打开 FloatingToolbar（点击 # 按钮）
3. 选择标签
4. 标签会自动以 `mentionOnly: true` 插入

#### 查看效果

**本地显示**：
- Description 中的标签显示为**胶囊样式**
- 但不会添加到 Event 的 tags 数组

**同步到远程后**：
- 标签转换为纯文本：`#💼 工作`
- 在 Outlook/Google Calendar 中可读

### 3.5 示例

#### 创建事件

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

#### 同步到 Outlook

```
Outlook 中显示:
━━━━━━━━━━━━━━━━━━━━━
📧 完成项目方案

这是关于 #📚 学习 的任务
━━━━━━━━━━━━━━━━━━━━━
```

### 3.6 技术实现

#### 3.6.1 插入标签时自动设置 mentionOnly

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

#### 3.6.2 提取标签时过滤 mentionOnly

**位置**: `src/components/UnifiedSlateEditor/serialization.ts` L358

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

#### 3.6.3 同步时转换为纯文本

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

### 3.7 数据流

#### 本地编辑流程

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

#### 同步到远程流程

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

#### 从远程同步回来

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

### 3.8 UI 表现

#### Title 模式（正式标签）

```
┌─────────────────────────────────┐
│ [📝] 完成项目方案 💼 工作      │  ← Tag 是胶囊样式，可点击
└─────────────────────────────────┘
    ↑
    Event.tags = ['tag-work']
```

#### Description 模式（仅提及）

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

#### 同步到远程后

```
Microsoft Outlook:
┌─────────────────────────────────┐
│ 📧 完成项目方案                 │
│                                 │
│ 这是关于 #💼 工作 的任务...    │  ← 纯文本形式
└─────────────────────────────────┘
```

### 3.9 测试场景

#### 测试 1: Description 插入标签不影响 Event.tags

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

#### 测试 2: 同步到远程转换为纯文本

**步骤**:
1. 创建包含 Description 标签的 Event
2. 同步到 Microsoft Outlook
3. 在 Outlook 中查看事件

**预期**:
- Description 显示：`这是关于 #💼 工作 的任务`（纯文本）

#### 测试 3: 从远程同步回来保持纯文本

**步骤**:
1. 在 Outlook 中手动编辑事件 Description：`测试 #💼 工作`
2. 同步回 ReMarkable
3. 查看本地 Description

**预期**:
- Description 显示：`测试 #💼 工作`（保持纯文本）

### 3.10 优势总结

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

### 3.11 Title 标签自动提取机制

#### 3.11.1 核心原则

**✅ 架构决策：统一由 Slate 序列化层处理，避免在业务代码中解析 HTML**

所有标签提取、格式转换由 `UnifiedSlateEditor/serialization.ts` 统一处理，业务组件（PlanManager、EventEditModal 等）调用统一接口。

#### 3.11.2 提取规则

- **Title (titleContent 字段)** 中的 TagNode → 添加到 `Event.tags` 数组
- **EventLog (eventlog 字段)** 中的 TagNode → **不添加**到 `Event.tags`（仅作为 mention）
- **Description 字段** 中的标签 → **不添加**到 `Event.tags`（仅作为内容提及）

**语义区分**：

| 位置 | 标签类型 | 是否加入 Event.tags | 用途 |
|------|----------|---------------------|------|
| Title | TagNode (mentionOnly=false) | ✅ 是 | 事件分类 |
| EventLog | TagNode (mentionOnly=true) | ❌ 否 | 上下文提及（如 @张三） |
| Description | 纯文本提及 | ❌ 否 | 内容描述 |

#### 3.11.3 Slate 序列化层实现

**标准实现：`UnifiedSlateEditor/serialization.ts`**

```typescript
// src/components/UnifiedSlateEditor/serialization.ts L405-415

/**
 * 从 Slate fragment 提取标签 ID
 * @param fragment Slate 节点数组
 * @returns 标签 ID 数组（排除 mentionOnly）
 */
function extractTags(fragment: (TextNode | TagNode)[]): string[] {
  if (!fragment || !Array.isArray(fragment)) {
    console.warn('[extractTags] fragment 不是数组', { fragment });
    return [];
  }
  
  return fragment
    .filter((node): node is TagNode => 
      'type' in node && 
      node.type === 'tag' && 
      !node.mentionOnly  // ✅ 过滤掉 mention-only 标签
    )
    .map(node => node.tagId)
    .filter(Boolean) as string[];
}

/**
 * Slate → HTML + 提取标签（统一接口）
 */
export function serializeSlateToHtmlWithTags(nodes: Descendant[]): {
  html: string;
  plainText: string;
  tags: string[];
} {
  const html = serializeToHtml(nodes);
  const plainText = serializeToPlainText(nodes);
  const tags = extractTags(nodes as any[]);
  
  return { 
    html, 
    plainText, 
    tags: [...new Set(tags)]  // 去重
  };
}
```

**TagNode 接口定义**：

```typescript
// types/slate.ts

type TagNode = {
  type: 'tag';
  tagId: string;           // 标签 ID（主键）
  tagName: string;         // 标签名称（fallback，优先读取 TagService）
  tagColor?: string;       // 标签颜色
  tagEmoji?: string;       // 标签 emoji
  mentionOnly?: boolean;   // ✅ 是否仅作为 mention（不加入 Event.tags）
  children: [{ text: '' }]; // Slate 要求所有 element 必须有 children
};
```

#### 3.11.4 EventService 统一接口

```typescript
// services/EventService.ts

import { serializeSlateToHtmlWithTags } from '@/components/UnifiedSlateEditor/serialization';
import type { Descendant } from 'slate';

class EventService {
  /**
   * 从 titleContent 提取标签和纯文本
   * @param titleContent Slate JSON 字符串 或 Slate 节点数组
   */
  static extractTagsFromTitle(titleContent: string | Descendant[]): {
    tags: string[];
    plainText: string;
    html: string;
  } {
    // 1. 解析为 Slate 节点
    const nodes = typeof titleContent === 'string' 
      ? JSON.parse(titleContent) 
      : titleContent;
    
    // 2. 调用 Slate 序列化层统一处理
    return serializeSlateToHtmlWithTags(nodes);
  }
  
  /**
   * 创建事件时自动提取标签
   */
  static async createEvent(eventData: Partial<Event>): Promise<Event> {
    // 如果有 titleContent（Slate JSON），自动提取 tags 和 title
    if (eventData.titleContent) {
      const { tags, plainText, html } = this.extractTagsFromTitle(eventData.titleContent);
      eventData.tags = tags;
      eventData.title = plainText;
      eventData.titleContent = html;  // 标准化 HTML
    }
    
    // ... 其他创建逻辑
    return await this.saveEvent(eventData as Event);
  }
  
  /**
   * 更新事件时重新提取标签
   */
  static async updateEvent(eventId: string, updates: Partial<Event>): Promise<void> {
    // 如果更新了 titleContent，重新提取 tags 和 title
    if (updates.titleContent) {
      const { tags, plainText, html } = this.extractTagsFromTitle(updates.titleContent);
      updates.tags = tags;
      updates.title = plainText;
      updates.titleContent = html;
    }
    
    // ... 其他更新逻辑
    await this.saveEvent({ ...await this.getEvent(eventId), ...updates });
  }
}
```

#### 3.11.5 PlanManager 调用示例

```typescript
// src/components/PlanManager.tsx

import { serializeSlateToHtmlWithTags } from '@/components/UnifiedSlateEditor/serialization';

// ❌ 旧方法（已弃用）：在业务代码中解析 HTML
// const tempDiv = document.createElement('div');
// tempDiv.innerHTML = titleLine.content;
// const tagElements = tempDiv.querySelectorAll('.inline-tag');
// ...

// ✅ 新方法：调用 Slate 序列化层统一接口
const handleTitleChange = (slateNodes: Descendant[]) => {
  const { tags, plainText, html } = serializeSlateToHtmlWithTags(slateNodes);
  
  const updatedEvent: Event = {
    ...currentEvent,
    title: plainText,          // 纯文本（用于显示、搜索）
    titleContent: html,        // 标准化 HTML（保留所有格式）
    tags: tags,                // 自动提取的标签 ID
  };
  
  await EventService.updateEvent(currentEvent.id, updatedEvent);
};
```

#### 3.11.6 用户操作场景

**场景 1：在 Title 中插入标签**

1. **用户操作**：
   - 用户在 Title 通过 Slate 编辑器输入 `完成 #项目A 的设计稿`
   - Slate 保存为 JSON：
     ```json
     [{
       "type": "paragraph",
       "children": [
         { "text": "完成 " },
         { 
           "type": "tag", 
           "tagId": "proj-a", 
           "tagName": "项目A",
           "mentionOnly": false,
           "children": [{ "text": "" }]
         },
         { "text": " 的设计稿" }
       ]
     }]
     ```

2. **系统处理**：
   - 调用 `serializeSlateToHtmlWithTags(slateNodes)` 返回：
     ```typescript
     {
       tags: ['proj-a'],
       plainText: "完成 项目A 的设计稿",
       html: "<p>完成 <span class='inline-tag' data-tag-id='proj-a'>📊项目A</span> 的设计稿</p>"
     }
     ```

3. **最终 Event 数据**：
   ```json
   {
     "id": "event-123",
     "title": "完成 项目A 的设计稿",
     "titleContent": "<p>完成 <span class='inline-tag' data-tag-id='proj-a'>📊项目A</span> 的设计稿</p>",
     "tags": ["proj-a"]
   }
   ```

**场景 2：TimeLog 中的 mention 不影响 Event.tags**

1. **用户操作**：
   - Title: `完成项目文档`
   - EventLog: `讨论了功能优先级，@张三 提出了性能优化建议`

2. **TimeLog Slate JSON**：
   ```json
   [{
     "type": "paragraph",
     "children": [
       { "text": "讨论了功能优先级，" },
       { 
         "type": "tag", 
         "tagId": "zhang-san", 
         "mentionOnly": true,  // ✅ 标记为 mention
         "children": [{ "text": "" }]
       },
       { "text": " 提出了性能优化建议" }
     ]
   }]
   ```

3. **最终 Event 数据**：
   ```json
   {
     "title": "完成项目文档",
     "tags": [],  // ✅ EventLog 中的 @张三 不加入 tags
     "eventlog": {
       "content": [...],  // 包含 @张三 的 mention
       "descriptionHtml": "<p>讨论了功能优先级，<span data-mention-only='true'>@张三</span> 提出了性能优化建议</p>"
     }
   }
   ```

**场景 3：标签删除自动同步**

1. **用户操作**：
   - 用户从 Title 删除 `#项目A` 标签
   - Slate 编辑器更新节点数组（移除 TagNode）

2. **系统处理**：
   - 调用 `EventService.updateEvent()` 时自动重新提取标签
   - `extractTagsFromTitle()` 返回空数组

3. **最终 Event 数据**：
   ```json
   {
     "title": "完成的设计稿",
     "tags": []  // ✅ 自动从 Event.tags 移除
   }
   ```

#### 3.11.7 标签重命名全局更新

**TimeLog 中的标签（自动更新，无需额外处理）**

✅ **已实现机制**：TagElement 组件渲染时动态读取 TagService

```tsx
// src/components/UnifiedSlateEditor/elements/TagElement.tsx L13-25

const TagElementComponent: React.FC<RenderElementProps> = ({ 
  attributes, 
  children, 
  element 
}) => {
  const tagElement = element as TagElement;
  
  // ✅ 从 TagService 获取最新标签数据（而非使用节点存储的旧值）
  const tagData = useMemo(() => {
    const tag = tagElement.tagId ? TagService.getTagById(tagElement.tagId) : null;
    return {
      name: tag?.name ?? tagElement.tagName,      // 优先使用 TagService 的最新 name
      color: tag?.color ?? tagElement.tagColor,   // 优先使用 TagService 的最新 color
      emoji: tag?.emoji ?? tagElement.tagEmoji,   // 优先使用 TagService 的最新 emoji
    };
  }, [tagElement.tagId, tagElement.tagName, tagElement.tagColor, tagElement.tagEmoji]);
  
  // ✅ 监听 TagService 更新，自动重新渲染
  useEffect(() => {
    const listener = () => { /* 触发重新渲染 */ };
    TagService.addListener(listener as any);
    return () => TagService.removeListener(listener as any);
  }, [tagElement.tagId]);
  
  // 渲染时使用 tagData（而非 tagElement 的旧值）
  return (
    <span 
      className="inline-tag" 
      data-tag-id={tagElement.tagId}
      data-tag-name={tagData.name}
      {...attributes}
    >
      {tagData.emoji}{tagData.name}
      {children}
    </span>
  );
};
```

**为什么 TimeLog 不需要手动更新 Slate JSON？**

- Slate 中的 `TagElement` 节点存储的是 `tagId`（而不是 `tagName`）
- 示例 Slate JSON:
  ```json
  {
    "type": "tag",
    "tagId": "project-a-id",  // ✅ 存储 ID，不存储 name
    "tagName": "项目A",        // ⚠️ 仅作为 fallback，优先读取 TagService
    "children": [{ "text": "" }]
  }
  ```
- 渲染时通过 `TagService.getTagById(tagId)` 获取最新的 name/color/emoji
- 因此标签重命名后，**下次渲染自动显示新名称**，无需修改 JSON

**Title HTML 字符串（推荐方案：渲染时动态读取）**

考虑到标签重命名是低频操作，且批量更新 HTML 成本高，建议在 UI 渲染时动态读取 TagService：

```typescript
/**
 * 渲染 Event 标题时，动态替换标签名称
 */
function renderEventTitle(event: Event): string {
  if (!event.titleContent) return event.title;
  
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = event.titleContent;
  
  // 遍历所有标签元素，动态读取 TagService 最新数据
  tempDiv.querySelectorAll('.inline-tag').forEach(el => {
    const tagId = el.getAttribute('data-tag-id');
    if (!tagId) return;
    
    const tag = TagService.getTagById(tagId);
    if (tag) {
      el.setAttribute('data-tag-name', tag.name);
      el.textContent = `${tag.emoji || ''}${tag.name}`;
    }
  });
  
  return tempDiv.innerHTML;
}
```

**可选方案：标签重命名时批量更新 HTML**

如果需要保持数据一致性（例如离线导出、数据迁移场景），可在 `TagService.renameTag()` 时批量更新：

```typescript
class TagService {
  async renameTag(tagId: string, newName: string): Promise<void> {
    const tag = this.getTagById(tagId);
    if (!tag) throw new Error('Tag not found');
    
    // 1. 更新标签本身
    tag.name = newName;
    await this.updateTags(this.tags);
    
    // 2. ✅ TimeLog 中的 TagElement 自动更新（已实现，无需额外代码）
    
    // 3. 可选：批量更新 Title HTML
    const events = EventService.getAllEvents();
    const batch: Array<{ id: string; titleContent: string }> = [];
    
    for (const event of events) {
      if (event.titleContent?.includes(`data-tag-id="${tagId}"`)) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = event.titleContent;
        
        const tagElements = tempDiv.querySelectorAll(`.inline-tag[data-tag-id="${tagId}"]`);
        tagElements.forEach(el => {
          el.setAttribute('data-tag-name', newName);
          el.textContent = `${tag.emoji || ''}${newName}`;
        });
        
        batch.push({ id: event.id, titleContent: tempDiv.innerHTML });
      }
    }
    
    // 批量更新
    await Promise.all(
      batch.map(({ id, titleContent }) => EventService.updateEvent(id, { titleContent }))
    );
    
    this.notifyListeners();
  }
}
```

#### 3.11.8 架构优势

✅ **单一职责**：
- Slate 序列化层负责所有格式转换
- 业务组件只需调用统一接口

✅ **类型安全**：
- 直接操作 Slate AST，避免 HTML 解析错误
- TypeScript 类型检查保证数据一致性

✅ **性能更好**：
- 避免创建 DOM 元素和字符串解析
- 减少不必要的序列化/反序列化

✅ **易于维护**：
- 标签提取逻辑集中在 `serialization.ts`
- 修改时只需更新一处代码

✅ **避免重复**：
- PlanManager、EventEditModal 等组件复用相同逻辑
- 减少代码冗余和维护成本

#### 3.11.9 不推荐的方法（已弃用）

```typescript
// ❌ 在业务代码中用 DOM API 解析 HTML（不推荐）
// 示例：PlanManager.tsx L1398-1406（旧实现，仅作参考）

const tempDiv = document.createElement('div');
tempDiv.innerHTML = content;
const tagElements = tempDiv.querySelectorAll('.inline-tag');
const extractedTags: string[] = [];
tagElements.forEach(tagEl => {
  const tagId = tagEl.getAttribute('data-tag-id');
  if (tagId) extractedTags.push(tagId);
});

// 问题：
// 1. 每个组件重复实现解析逻辑
// 2. DOM 操作性能差
// 3. 类型不安全（依赖 HTML 字符串格式）
// 4. 维护困难（多处实现需同步更新）
// 5. 违反单一职责原则（业务逻辑混杂格式转换）
```

**为什么弃用**：

1. **架构层面**：违反关注点分离原则
2. **性能层面**：频繁创建 DOM 元素开销大
3. **维护层面**：逻辑分散在多处，难以统一修改
4. **安全层面**：依赖 HTML 字符串格式，容易出错

**迁移指南**：

如果现有代码使用了 DOM 解析方式，请按以下步骤迁移：

1. **确认 Slate 序列化层已实现**：
   - 验证 `src/components/UnifiedSlateEditor/serialization.ts` 中存在 `extractTags()` 和 `serializeSlateToHtmlWithTags()` 函数

2. **更新 EventService**：
   - 添加 `extractTagsFromTitle()` 方法
   - 在 `createEvent()` 和 `updateEvent()` 中使用此方法

3. **更新业务组件**：
   - 替换 DOM 解析代码为 `serializeSlateToHtmlWithTags()` 调用
   - 测试标签提取、删除、重命名等场景

4. **删除旧代码**：
   - 移除 `tempDiv.innerHTML` 等 DOM 解析逻辑
   - 添加注释标记为已弃用

---

## 4. 数据格式选型

## 2. 数据格式选型

### 4.1 最佳方案：JSON + HTML 双存储

采用 **Slate JSON** 作为主存储，配合预渲染的 HTML 和纯文本备份。

```typescript  
// types/eventlog.ts  

/**
 * Event 接口（含嵌入式 EventLog）
 * 
 * 🆕 架构决策（2025-11-13）：
 * - EventLog 不是独立实体，而是 Event 的 eventlog 字段
 * - TimeLog 是页面/功能模块，EventLog 是 Event 内部的日志字段
 * - 版本历史存储在 Event.eventlog.versions 数组中
 * - 所有时间字段遵循 TimeHub/TimeSpec 架构
 */
interface Event {
  id: string;
  title: string;              // 纯文本标题（用于显示、搜索）
  titleContent?: string;      // 富文本 HTML（Slate 输出，用于编辑恢复）
  
  // 时间字段（保留字符串用于快速查询和向后兼容）
  startTime: string;     // ISO 字符串，用于数据库索引和 UI 显示
  endTime: string;
  
  // 完整时间对象（TimeSpec 架构）
  timeSpec?: TimeSpec;   // 包含 kind, source, policy, resolved
  
  tags?: string[];       // 标签 ID 数组（从 titleContent 自动提取，不包含 eventlog 中的 mention）
  
  // 🆕 嵌入式 EventLog 字段
  eventlog?: {
    // 主存储：结构化 JSON (Slate format)  
    content: Descendant[]; // Slate 的原生格式，可包含 ContextMarkerElement
    
    // 辅助存储：简化 HTML (用于 Outlook 同步)  
    descriptionHtml: string;  
    
    // 纯文本备份 (用于搜索和降级)  
    descriptionPlainText: string;  
    
    // 媒体附件元数据  
    attachments?: Attachment[];  
    
    // 版本控制（保留最近 50 个版本）
    versions?: EventLogVersion[];  
    
    // 同步元数据  
    syncState?: SyncState;  
    
    // 时间戳
    createdAt?: Date;  
    updatedAt?: Date;  
  };
  
  // 其他现有字段
  isTimer?: boolean;
  isDeadline?: boolean;
  isPlan?: boolean;
  // ...
}

/**
 * Slate 文档节点类型
 * 支持段落和情境标记两种块级元素
 */
type Descendant = ParagraphElement | ContextMarkerElement;

/**
 * 段落元素
 */
type ParagraphElement = {
  type: 'paragraph';
  children: CustomText[];
};

/**
 * 情境标记元素
 * 自动记录用户编辑时的时间和应用活动上下文
 */
type ContextMarkerElement = {
  type: 'context-marker';
  timeSpec: TimeSpec;              // ✅ 使用 TimeSpec 而非 ISO 字符串
  activities: ActivitySpan[];      // 该时间点后的活动记录
  children: [{ text: '' }];        // Slate Void 节点要求
};

/**
 * 单个应用活动片段
 */
type ActivitySpan = {
  appId: string;                   // 如 "com.figma.desktop"
  appName: string;                 // 如 "Figma"
  appColor: string;                // 应用主题色（HEX）
  title: string | null;            // 窗口标题
  duration: number;                // 持续时长（秒）
};

/**
 * 附件元数据
 */
type Attachment = {  
  id: string;  
  type: 'audio' | 'video' | 'image' | 'file';  
  url: string;              // 云存储 URL  
  localUrl?: string;        // 本地缓存路径  
  fileName: string;  
  mimeType: string;  
  size: number;  
  uploadedAt: Date;  
};  

/**
 * 同步状态
 * 用于检测本地和远程（Outlook）的变更冲突
 */
type SyncState = {  
  localHash: string;        // eventlog 上次同步时的哈希  
  remoteHash: string;       // Outlook description 上次同步时的哈希  
  lastSyncedAt: Date;  
  syncStatus: 'synced' | 'pending' | 'conflict' | 'error';  
};
```

### 4.2 为什么选择 Slate JSON？

**优势:**

- ✅ 结构化: 每个元素都是 JSON 对象，易于操作
- ✅ 可扩展: 可以添加自定义属性（如 mention、tag）
- ✅ 双向转换: 可以精确转换为 HTML 和纯文本
- ✅ 编辑器原生支持: 与 Slate 编辑器无缝集成

**示例（包含情境标记）:**

```json
[
  {
    "type": "context-marker",
    "timeSpec": {
      "kind": "fixed",
      "source": "system",
      "rawText": null,
      "policy": { "weekStart": 1 },
      "resolved": {
        "start": "2025-11-03T10:00:00",
        "end": "2025-11-03T10:00:00"
      },
      "start": "2025-11-03T10:00:00",
      "end": "2025-11-03T10:00:00",
      "allDay": false
    },
    "activities": [
      {
        "appId": "com.google.Chrome",
        "appName": "Chrome",
        "appColor": "#4285F4",
        "title": "Slate.js Documentation",
        "duration": 300
      }
    ],
    "children": [{ "text": "" }]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "开始研究 Slate.js 的数据模型。" }
    ]
  },
  {
    "type": "heading-1",
    "children": [
      { "text": "项目进展", "bold": true }
    ]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "完成了 " },
      {
        "type": "mention",
        "character": "@项目A",
        "children": [{ "text": "" }]
      },
      { "text": " 的需求分析" }
    ]
  },
  {
    "type": "context-marker",
    "timeSpec": {
      "kind": "fixed",
      "source": "system",
      "rawText": null,
      "policy": { "weekStart": 1 },
      "resolved": {
        "start": "2025-11-03T10:05:30",
        "end": "2025-11-03T10:05:30"
      },
      "start": "2025-11-03T10:05:30",
      "end": "2025-11-03T10:05:30",
      "allDay": false
    },
    "activities": [
      {
        "appId": "com.spotify.client",
        "appName": "Spotify",
        "appColor": "#1DB954",
        "title": "Lofi Beats Playlist",
        "duration": 180
      },
      {
        "appId": "com.microsoft.VSCode",
        "appName": "VS Code",
        "appColor": "#007ACC",
        "title": "TimeLog_PRD.md",
        "duration": 420
      }
    ],
    "children": [{ "text": "" }]
  },
  {
    "type": "paragraph",
    "children": [
      { "text": "切换了音乐，开始写 PRD 文档。" }
    ]
  },
  {
    "type": "table",
    "children": [
      {
        "type": "table-row",
        "children": [
          {
            "type": "table-cell",
            "children": [{ "text": "任务" }]
          },
          {
            "type": "table-cell",
            "children": [{ "text": "状态" }]
          }
        ]
      }
    ]
  }
]
```

## 5. 双向同步架构

### 5.1 核心挑战

- **信息不对称**: eventlog 能存储视频/音频，但 Outlook description 不能
- **格式冲突**: Slate JSON ≠ Outlook HTML
- **冲突检测**: 如何判断是哪一端发生了变更？

### 5.2 解决方案：字段级冲突检测 + 智能序列化

> **设计决策**: 详见顶部"架构决策记录 → 字段级冲突检测 + Git 风格 Diff UI"

#### 5.2.1 字段级冲突检测

**传统方案的问题：**
- 只检测整个 Event 是否冲突
- 即使只有 title 改变，也会导致整个 eventlog 被覆盖
- 用户体验差，数据丢失风险高

**改进方案：字段级检测**

```typescript
// sync/fieldLevelConflictDetection.ts
import crypto from 'crypto';

/**
 * 字段级冲突结果
 */
interface FieldLevelConflictResult {
  hasConflict: boolean;
  conflictedFields: FieldConflict[];    // 具体哪些字段冲突
  cleanFields: string[];                // 无冲突的字段
  resolution: ConflictResolution;
}

type FieldConflict = {
  field: EventField;
  localValue: any;
  remoteValue: any;
  localHash: string;
  remoteHash: string;
  lastSyncValue?: any;                  // 三方合并基准（来自 EventHistory）
  autoResolvable: boolean;              // 是否可自动解决
  suggestedResolution?: 'keep-local' | 'keep-remote' | 'merge';
};

type EventField = 
  | 'title'
  | 'tags'
  | 'timelog'
  | 'startTime'
  | 'endTime'
  | 'location'
  | 'isAllDay';

type ConflictResolution =
  | 'auto-resolved'          // 自动解决（无冲突或可自动合并）
  | 'manual-required'        // 需要用户手动选择
  | 'last-write-wins';       // 使用 LWW 策略

/**
 * 检测字段级冲突
 * 
 * @param localEvent - 本地 Event
 * @param remoteEvent - Outlook Event
 * @param lastSyncState - 上次同步的状态（来自 EventHistory）
 */
export async function detectFieldLevelConflicts(
  localEvent: Event,
  remoteEvent: OutlookEvent,
  lastSyncState?: EventHistoryEntry
): Promise<FieldLevelConflictResult> {
  
  const conflictedFields: FieldConflict[] = [];
  const cleanFields: string[] = [];
  
  // 检测每个字段
  const fieldsToCheck: EventField[] = [
    'title',
    'tags',
    'timelog',
    'startTime',
    'endTime',
    'location',
    'isAllDay',
  ];
  
  for (const field of fieldsToCheck) {
    const conflict = await checkFieldConflict(
      field,
      localEvent,
      remoteEvent,
      lastSyncState
    );
    
    if (conflict) {
      conflictedFields.push(conflict);
    } else {
      cleanFields.push(field);
    }
  }
  
  // 判断解决策略
  const resolution = determineResolution(conflictedFields);
  
  return {
    hasConflict: conflictedFields.length > 0,
    conflictedFields,
    cleanFields,
    resolution,
  };
}

/**
 * 检测单个字段的冲突
 */
async function checkFieldConflict(
  field: EventField,
  local: Event,
  remote: OutlookEvent,
  lastSync?: EventHistoryEntry
): Promise<FieldConflict | null> {
  
  // 1. 提取字段值
  const localValue = extractFieldValue(field, local);
  const remoteValue = extractFieldValue(field, remote);
  const lastSyncValue = lastSync 
    ? extractFieldValue(field, lastSync.snapshot)
    : undefined;
  
  // 2. 计算哈希
  const localHash = hashValue(localValue);
  const remoteHash = hashValue(remoteValue);
  const lastSyncHash = lastSyncValue ? hashValue(lastSyncValue) : null;
  
  // 3. 检测变更
  const localChanged = lastSyncHash && localHash !== lastSyncHash;
  const remoteChanged = lastSyncHash && remoteHash !== lastSyncHash;
  
  // 4. 无冲突情况
  if (!localChanged && !remoteChanged) return null;  // 都没变
  if (localHash === remoteHash) return null;         // 值相同
  
  // 5. 单边变更（可自动解决）
  if (localChanged && !remoteChanged) {
    return {
      field,
      localValue,
      remoteValue,
      localHash,
      remoteHash,
      lastSyncValue,
      autoResolvable: true,
      suggestedResolution: 'keep-local',
    };
  }
  
  if (!localChanged && remoteChanged) {
    return {
      field,
      localValue,
      remoteValue,
      localHash,
      remoteHash,
      lastSyncValue,
      autoResolvable: true,
      suggestedResolution: 'keep-remote',
    };
  }
  
  // 6. 双边变更（需要用户决定）
  return {
    field,
    localValue,
    remoteValue,
    localHash,
    remoteHash,
    lastSyncValue,
    autoResolvable: false,
    suggestedResolution: undefined,
  };
}

/**
 * 提取字段值（处理 Event 和 OutlookEvent 的差异）
 */
function extractFieldValue(field: EventField, event: Event | OutlookEvent): any {
  const mapping: Record<EventField, (e: any) => any> = {
    title: (e) => e.subject || e.title,
    tags: (e) => e.categories || e.tags,
    eventlog: (e) => e.body?.content || e.eventlog?.content,
    startTime: (e) => e.start?.dateTime || e.startTime,
    endTime: (e) => e.end?.dateTime || e.endTime,
    location: (e) => e.location?.displayName || e.location,
    isAllDay: (e) => e.isAllDay,
  };
  
  return mapping[field]?.(event);
}

/**
 * 计算字段值的哈希
 */
function hashValue(value: any): string {
  const str = typeof value === 'string' 
    ? value 
    : JSON.stringify(value);
  
  return crypto.createHash('sha256').update(str).digest('hex');
}

/**
 * 决定解决策略
 */
function determineResolution(conflicts: FieldConflict[]): ConflictResolution {
  if (conflicts.length === 0) {
    return 'auto-resolved';
  }
  
  // 如果所有冲突都可自动解决
  if (conflicts.every(c => c.autoResolvable)) {
    return 'auto-resolved';
  }
  
  // 否则需要用户手动选择
  return 'manual-required';
}
```

**字段冲突示例：**

```typescript
// 场景 1: title 在本地改了，timelog 在 Outlook 改了
{
  conflictedFields: [
    {
      field: 'title',
      localValue: '完成项目 A',
      remoteValue: '完成项目 B',
      autoResolvable: false,  // 双边都改了
    },
    {
      field: 'timelog',
      localValue: '<slate json>',
      remoteValue: '<html>',
      autoResolvable: false,
    }
  ],
  resolution: 'manual-required'
}

// 场景 2: 只有 tags 在本地改了
{
  conflictedFields: [
    {
      field: 'tags',
      localValue: ['work', 'urgent'],
      remoteValue: ['work'],
      autoResolvable: true,
      suggestedResolution: 'keep-local',  // 本地更新，自动推送
    }
  ],
  resolution: 'auto-resolved'
}
```

#### 5.2.2 冲突检测流程图

```
┌─────────────────────────────────────┐
│   1. 获取本地和远程 Event           │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   2. 从 EventHistory 获取           │
│      lastSyncState（三方合并基准）   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   3. 逐字段比较                     │
│      - 计算每个字段的 hash          │
│      - 对比 local/remote/lastSync   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   4. 分类冲突                       │
│      - 无冲突字段 → 跳过            │
│      - 单边变更 → 自动解决          │
│      - 双边变更 → 需要用户决定      │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   5. 决定策略                       │
│      - auto-resolved → 自动同步     │
│      - manual-required → 显示 UI    │
└───────────────────────────────────── ┘
```

#### 5.2.3 Slate JSON → Outlook HTML 智能序列化

```typescript
// serializers/slateToHtml.ts
import { Node, Text } from 'slate';
import escapeHtml from 'escape-html';

export const slateToHtml = (nodes: Descendant[]): string => {
  return nodes.map(node => serializeNode(node)).join('');
};

const serializeNode = (node: Descendant): string => {
  // 文本节点
  if (Text.isText(node)) {
    let text = escapeHtml(node.text);
    
    // 应用文本样式
    if (node.bold) text = `<strong>${text}</strong>`;
    if (node.italic) text = `<em>${text}</em>`;
    if (node.underline) text = `<u>${text}</u>`;
    if (node.code) text = `<code>${text}</code>`;
    
    // 字体颜色
    if (node.color) {
      text = `<span style="color: ${node.color}">${text}</span>`;
    }
    
    // 背景色
    if (node.backgroundColor) {
      text = `<span style="background-color: ${node.backgroundColor}">${text}</span>`;
    }
    
    return text;
  }

  // 元素节点
  const children = node.children.map(n => serializeNode(n)).join('');

  switch (node.type) {
    case 'paragraph':
      return `<p>${children}</p>`;
    
    case 'heading-1':
      return `<h1>${children}</h1>`;
    
    case 'heading-2':
      return `<h2>${children}</h2>`;
    
    case 'heading-3':
      return `<h3>${children}</h3>`;
    
    case 'bulleted-list':
      return `<ul>${children}</ul>`;
    
    case 'numbered-list':
      return `<ol>${children}</ol>`;
    
    case 'list-item':
      return `<li>${children}</li>`;
    
    case 'table':
      return `<table border="1" cellpadding="5" cellspacing="0">${children}</table>`;
    
    case 'table-row':
      return `<tr>${children}</tr>`;
    
    case 'table-cell':
      return `<td>${children}</td>`;
    
    case 'link':
      return `<a href="${escapeHtml(node.url)}">${children}</a>`;
    
    // 关键：媒体元素的降级处理
    case 'image':
      return `<p><img src="${escapeHtml(node.url)}" alt="${escapeHtml(node.fileName || '')}" style="max-width: 100%;" /></p>`;
    
    case 'video':
      return `<p>📹 视频: <a href="${escapeHtml(node.url)}">${escapeHtml(node.fileName || '点击查看')}</a></p>`;
    
    case 'audio':
      return `<p>🎵 音频: <a href="${escapeHtml(node.url)}">${escapeHtml(node.fileName || '点击播放')}</a></p>`;
    
    case 'mention':
      return `<span style="background-color: #e3f2fd; padding: 2px 6px; border-radius: 3px; color: #1976d2;">${children}</span>`;
    
    default:
      return children;
  }
};
```

#### 5.2.3 Slate JSON → Plain Text 转换器

```typescript
// serializers/slateToPlainText.ts
import { Node, Text } from 'slate';

export const slateToPlainText = (nodes: Descendant[]): string => {
  return nodes.map(n => serialize(n)).join('\n');
};

const serialize = (node: Descendant): string => {
  if (Text.isText(node)) {
    return node.text;
  }

  const children = node.children.map(n => serialize(n)).join('');

  switch (node.type) {
    case 'heading-1':
    case 'heading-2':
    case 'heading-3':
      return `\n${children}\n${'='.repeat(Math.min(children.length, 50))}\n`;
    
    case 'paragraph':
      return children;
    
    case 'list-item':
      return `• ${children}`;
    
    case 'link':
      return `${children} (${node.url})`;
    
    case 'video':
      return `[视频: ${node.fileName || node.url}]`;
    
    case 'audio':
      return `[音频: ${node.fileName || node.url}]`;
    
    case 'image':
      return `[图片: ${node.fileName || node.url}]`;
    
    case 'table':
      return `\n[表格]\n${children}\n`;
    
    case 'table-row':
      return `${children}\n`;
    
    case 'table-cell':
      return `${children} | `;
    
    default:
      return children;
  }
};
```

#### 5.2.4 Outlook HTML → Slate JSON 转换器（逆向）

```typescript
// serializers/htmlToSlate.ts
import { jsx } from 'slate-hyperscript';
import { JSDOM } from 'jsdom';

export const htmlToSlate = (html: string): Descendant[] => {
  const dom = new JSDOM(html);
  const { body } = dom.window.document;
  
  return deserialize(body);
};

const deserialize = (el: Element | ChildNode): Descendant | Descendant[] | null => {
  // 文本节点
  if (el.nodeType === 3) {
    return { text: el.textContent || '' };
  }

  // 非元素节点
  if (el.nodeType !== 1) {
    return null;
  }

  const element = el as Element;
  const nodeName = element.nodeName.toLowerCase();
  let children = Array.from(element.childNodes)
    .map(deserialize)
    .flat()
    .filter(Boolean) as Descendant[];

  // 如果没有子节点，添加一个空文本节点
  if (children.length === 0) {
    children = [{ text: '' }];
  }

  // 文本样式
  if (nodeName === 'strong' || nodeName === 'b') {
    return children.map(child => 
      Text.isText(child) ? { ...child, bold: true } : child
    );
  }

  if (nodeName === 'em' || nodeName === 'i') {
    return children.map(child => 
      Text.isText(child) ? { ...child, italic: true } : child
    );
  }

  if (nodeName === 'u') {
    return children.map(child => 
      Text.isText(child) ? { ...child, underline: true } : child
    );
  }

  if (nodeName === 'code') {
    return children.map(child => 
      Text.isText(child) ? { ...child, code: true } : child
    );
  }

  // 处理内联样式 (颜色等)
  if (nodeName === 'span') {
    const style = element.getAttribute('style');
    if (style) {
      const colorMatch = style.match(/color:\s*([^;]+)/);
      const bgMatch = style.match(/background-color:\s*([^;]+)/);
      
      return children.map(child => {
        if (!Text.isText(child)) return child;
        
        const styledChild = { ...child };
        if (colorMatch) styledChild.color = colorMatch[1].trim();
        if (bgMatch) styledChild.backgroundColor = bgMatch[1].trim();
        
        return styledChild;
      });
    }
  }

  // 块级元素
  switch (nodeName) {
    case 'p':
      return { type: 'paragraph', children };
    
    case 'h1':
      return { type: 'heading-1', children };
    
    case 'h2':
      return { type: 'heading-2', children };
    
    case 'h3':
      return { type: 'heading-3', children };
    
    case 'ul':
      return { type: 'bulleted-list', children };
    
    case 'ol':
      return { type: 'numbered-list', children };
    
    case 'li':
      return { type: 'list-item', children };
    
    case 'table':
      return { type: 'table', children };
    
    case 'tr':
      return { type: 'table-row', children };
    
    case 'td':
    case 'th':
      return { type: 'table-cell', children };
    
    case 'a':
      return {
        type: 'link',
        url: element.getAttribute('href') || '',
        children,
      };
    
    case 'img':
      return {
        type: 'image',
        url: element.getAttribute('src') || '',
        fileName: element.getAttribute('alt') || '',
        children: [{ text: '' }],
      };
    
    case 'br':
      return { text: '\n' };
    
    default:
      return children;
  }
};
```

### 5.3 同步引擎

```typescript
// sync/syncEngine.ts

export class SyncEngine {
  constructor(
    private outlookApi: OutlookApiClient,
    private db: Database
  ) {}
  
  async syncEvent(eventId: string) {
    // 1. 获取本地和远程数据
    const localEvent = await this.db.events.findById(eventId);
    const remoteEvent = await this.outlookApi.getEvent(eventId);
    
    // 2. 检测冲突
    const conflict = detectConflict(
      localEvent.eventlog.content,
      remoteEvent.body.content,
      localEvent.syncState
    );
    
    // 3. 根据冲突类型处理
    switch (conflict) {
      case 'no-change':
        return { status: 'synced' };
      
      case 'local-changed':
        return await this.pushToOutlook(localEvent, remoteEvent);
      
      case 'remote-changed':
        return await this.pullFromOutlook(localEvent, remoteEvent);
      
      case 'both-changed':
        return await this.resolveConflict(localEvent, remoteEvent);
    }
  }
  
  // timelog → Outlook
  private async pushToOutlook(local: Event, remote: OutlookEvent) {
    console.log('📤 推送到 Outlook...');
    
    // 1. 转换 Slate JSON → HTML
    const html = slateToHtml(local.eventlog.content);
    const plainText = slateToPlainText(local.eventlog.content);
    
    // 2. 处理附件
    const attachments = await this.uploadAttachments(local.eventlog.attachments);
    
    // 3. 更新 Outlook
    await this.outlookApi.updateEvent(remote.id, {
      body: {
        contentType: 'html',
        content: html,
      },
      bodyPreview: plainText.substring(0, 255), // Outlook 限制
      attachments: attachments,
    });
    
    // 4. 更新同步状态
    await this.db.events.update(local.id, {
      'syncState.localHash': hashContent(local.eventlog.content),
      'syncState.remoteHash': hashContent(html),
      'syncState.lastSyncedAt': new Date(),
      'syncState.syncStatus': 'synced',
    });
    
    console.log('✅ 推送成功');
    return { status: 'pushed' };
  }
  
  // Outlook → timelog
  private async pullFromOutlook(local: Event, remote: OutlookEvent) {
    console.log('📥 从 Outlook 拉取...');
    
    // 1. 转换 HTML → Slate JSON
    const slateContent = htmlToSlate(remote.body.content);
    
    // 2. 下载附件
    const attachments = await this.downloadAttachments(remote.attachments);
    
    // 3. 更新本地
    await this.db.events.update(local.id, {
      'timelog.content': slateContent,
      'timelog.attachments': attachments,
      'syncState.localHash': hashContent(slateContent),
      'syncState.remoteHash': hashContent(remote.body.content),
      'syncState.lastSyncedAt': new Date(),
      'syncState.syncStatus': 'synced',
    });
    
    console.log('✅ 拉取成功');
    return { status: 'pulled' };
  }
  
  // 冲突解决策略
  private async resolveConflict(local: Event, remote: OutlookEvent) {
    console.log('⚠️ 检测到冲突');
    
    // 策略 1: "Last Write Wins" (最后写入优先)
    const localUpdatedAt = new Date(local.updatedAt);
    const remoteUpdatedAt = new Date(remote.lastModifiedDateTime);
    
    if (localUpdatedAt > remoteUpdatedAt) {
      console.log('  → 本地更新时间更晚，推送到 Outlook');
      return await this.pushToOutlook(local, remote);
    } else {
      console.log('  → Outlook 更新时间更晚，拉取到本地');
      return await this.pullFromOutlook(local, remote);
    }
    
    // 策略 2: 提示用户手动选择（未来功能）
    // return {
    //   status: 'conflict',
    //   local: local.eventlog.content,
    //   remote: htmlToSlate(remote.body.content),
    // };
  }
  
  // 上传附件到 OneDrive
  private async uploadAttachments(attachments: Attachment[]): Promise<any[]> {
    return Promise.all(
      attachments.map(async attachment => {
        // 对于大文件（>4MB），使用 Upload Session
        if (attachment.size > 4 * 1024 * 1024) {
          const uploadSession = await this.outlookApi.createUploadSession(attachment);
          return await this.uploadLargeFile(uploadSession, attachment);
        }
        
        // 小文件直接上传
        return {
          '@odata.type': '#microsoft.graph.fileAttachment',
          name: attachment.fileName,
          contentType: attachment.mimeType,
          contentBytes: await this.readFileAsBase64(attachment.localUrl),
        };
      })
    );
  }
  
  // 下载附件到本地
  private async downloadAttachments(attachments: any[]): Promise<Attachment[]> {
    return Promise.all(
      attachments.map(async attachment => {
        const localUrl = await this.saveAttachmentLocally(attachment);
        
        return {
          id: attachment.id,
          type: this.detectAttachmentType(attachment.contentType),
          url: attachment.contentLocation || localUrl,
          localUrl,
          fileName: attachment.name,
          mimeType: attachment.contentType,
          size: attachment.size,
          uploadedAt: new Date(),
        };
      })
    );
  }
  
  private detectAttachmentType(mimeType: string): 'audio' | 'video' | 'image' | 'file' {
    if (mimeType.startsWith('audio/')) return 'audio';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('image/')) return 'image';
    return 'file';
  }
  
  private async uploadLargeFile(session: any, attachment: Attachment): Promise<any> {
    // 实现大文件分块上传逻辑
    // 参考: https://learn.microsoft.com/en-us/graph/api/attachment-createuploadsession
    throw new Error('大文件上传功能待实现');
  }
  
  private async readFileAsBase64(filePath: string): Promise<string> {
    // 读取文件并转换为 Base64
    const fs = require('fs').promises;
    const buffer = await fs.readFile(filePath);
    return buffer.toString('base64');
  }
  
  private async saveAttachmentLocally(attachment: any): Promise<string> {
    // 下载并保存附件到本地
    const path = require('path');
    const fs = require('fs').promises;
    const { app } = require('electron');
    
    const localPath = path.join(
      app.getPath('userData'),
      'attachments',
      `${attachment.id}_${attachment.name}`
    );
    
    // 确保目录存在
    await fs.mkdir(path.dirname(localPath), { recursive: true });
    
    // 下载并保存
    const content = Buffer.from(attachment.contentBytes, 'base64');
    await fs.writeFile(localPath, content);
    
    return localPath;
  }
}
```

### 5.4 智能序列化系统：保留格式 + 降级策略

> **设计目标**: 将 Slate JSON 转换为 Outlook HTML 时，最大化保留格式信息，同时为不支持的元素提供优雅降级

#### 5.4.1 格式保留映射表

| Slate 元素 | Outlook HTML | 保留程度 | 备注 |
|-----------|--------------|---------|------|
| **文本样式** | | | |
| `bold` | `<strong>` | ✅ 100% | 完全支持 |
| `italic` | `<em>` | ✅ 100% | 完全支持 |
| `underline` | `<u>` | ✅ 100% | 完全支持 |
| `color` | `<span style="color">` | ✅ 100% | 保留颜色值 |
| `backgroundColor` | `<span style="background-color">` | ✅ 100% | 保留颜色值 |
| **结构元素** | | | |
| `paragraph` | `<p>` | ✅ 100% | 完全支持 |
| `heading-1/2/3` | `<h1/2/3>` | ✅ 100% | 完全支持 |
| `bulleted-list` | `<ul><li>` | ✅ 100% | 完全支持 |
| `numbered-list` | `<ol><li>` | ✅ 100% | 完全支持 |
| `link` | `<a href>` | ✅ 100% | 完全支持 |
| **特殊元素** | | | |
| `table` | Markdown 表格 | ⚠️ 70% | 转为文本表格 |
| `image` | Web Viewer 链接 | ⚠️ 50% | 提供预览链接 |
| `video` | Web Viewer 链接 | ⚠️ 50% | 提供播放链接 |
| `attachment` | Web Viewer 链接 | ⚠️ 50% | 提供下载链接 |
| `tag` (mention-only) | `#emoji name` | ⚠️ 80% | 纯文本形式 |
| `ContextMarker` (v2.0) | `<!-- hidden -->` | ⚠️ 0% | 隐藏元数据 |

#### 5.4.2 表格 Markdown 化实现

```typescript
// serializers/tableToMarkdown.ts

/**
 * 将 Slate 表格转换为 Markdown 风格的文本表格
 * 
 * 输入 (Slate JSON):
 * {
 *   type: 'table',
 *   children: [
 *     { type: 'table-row', children: [
 *       { type: 'table-cell', children: [{ text: '姓名' }] },
 *       { type: 'table-cell', children: [{ text: '年龄' }] }
 *     ]},
 *     { type: 'table-row', children: [
 *       { type: 'table-cell', children: [{ text: '张三' }] },
 *       { type: 'table-cell', children: [{ text: '25' }] }
 *     ]}
 *   ]
 * }
 * 
 * 输出 (Markdown):
 * | 姓名 | 年龄 |
 * |------|------|
 * | 张三 | 25   |
 */
function serializeTable(tableNode: TableElement): string {
  const rows = tableNode.children as TableRowElement[];
  
  if (rows.length === 0) {
    return '<p>[空表格]</p>';
  }
  
  // 1. 提取表头（第一行）
  const headerRow = rows[0];
  const headers = headerRow.children.map(cell => 
    extractCellText(cell as TableCellElement)
  );
  
  // 2. 计算列宽（用于对齐）
  const columnWidths = headers.map((h, i) => {
    const maxWidth = Math.max(
      h.length,
      ...rows.slice(1).map(row => {
        const cell = row.children[i] as TableCellElement;
        return extractCellText(cell).length;
      })
    );
    return Math.max(maxWidth, 4); // 最小宽度 4
  });
  
  // 3. 生成 Markdown 表格
  const lines: string[] = [];
  
  // 表头
  lines.push('| ' + headers.map((h, i) => 
    h.padEnd(columnWidths[i])
  ).join(' | ') + ' |');
  
  // 分隔线
  lines.push('|' + columnWidths.map(w => 
    '-'.repeat(w + 2)
  ).join('|') + '|');
  
  // 数据行
  rows.slice(1).forEach(row => {
    const cells = row.children.map((cell, i) => 
      extractCellText(cell as TableCellElement).padEnd(columnWidths[i])
    );
    lines.push('| ' + cells.join(' | ') + ' |');
  });
  
  // 4. 包装为 HTML（保留 Markdown 格式）
  return `<pre style="font-family: 'Courier New', monospace; background: #f5f5f5; padding: 10px; border-radius: 4px;">\n${lines.join('\n')}\n</pre>`;
}

function extractCellText(cell: TableCellElement): string {
  return cell.children
    .map(child => Text.isText(child) ? child.text : '')
    .join('');
}
```

**Markdown 表格示例输出：**

```
┌────────────────────────────────────┐
│ 表格: 项目进度统计                 │
├────────────────────────────────────┤
│ | 项目名称   | 状态   | 负责人 |  │
│ |------------|--------|--------|  │
│ | 设计系统   | 进行中 | 张三   |  │
│ | API 开发   | 已完成 | 李四   |  │
│ | 测试部署   | 未开始 | 王五   |  │
└────────────────────────────────────┘
```

#### 5.4.3 媒体元素的 Web Viewer 链接

```typescript
// serializers/mediaToLink.ts

/**
 * 图片元素 → Web Viewer 链接
 */
function serializeImage(imageNode: ImageElement, eventId: string): string {
  const viewerUrl = `https://app.remarkable.com/events/${eventId}/eventlog#image-${imageNode.id}`;
  
  // 方案 A: 内嵌缩略图 (如果 Outlook 支持)
  if (imageNode.thumbnailUrl) {
    return `
      <p style="border: 1px solid #ddd; padding: 10px; border-radius: 4px;">
        <a href="${escapeHtml(viewerUrl)}">
          <img src="${escapeHtml(imageNode.thumbnailUrl)}" 
               alt="${escapeHtml(imageNode.fileName)}" 
               style="max-width: 200px; display: block;" />
          <span style="font-size: 12px; color: #666;">📷 ${escapeHtml(imageNode.fileName)} - 点击查看原图</span>
        </a>
      </p>
    `;
  }
  
  // 方案 B: 纯文本链接 (降级)
  return `<p>📷 <a href="${escapeHtml(viewerUrl)}">查看图片: ${escapeHtml(imageNode.fileName)}</a></p>`;
}

/**
 * 视频元素 → Web Viewer 链接
 */
function serializeVideo(videoNode: VideoElement, eventId: string): string {
  const viewerUrl = `https://app.remarkable.com/events/${eventId}/eventlog#video-${videoNode.id}`;
  const duration = videoNode.duration ? ` (${formatDuration(videoNode.duration)})` : '';
  
  return `<p>📹 <a href="${escapeHtml(viewerUrl)}">观看视频: ${escapeHtml(videoNode.fileName)}${duration}</a></p>`;
}

/**
 * 附件元素 → Web Viewer 链接
 */
function serializeAttachment(attachmentNode: AttachmentElement, eventId: string): string {
  const viewerUrl = `https://app.remarkable.com/events/${eventId}/eventlog#attachment-${attachmentNode.id}`;
  const size = formatFileSize(attachmentNode.size);
  
  return `<p>📎 <a href="${escapeHtml(viewerUrl)}">下载附件: ${escapeHtml(attachmentNode.fileName)} (${size})</a></p>`;
}

/**
 * 格式化时长
 */
function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化文件大小
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
```

#### 5.4.4 完整序列化流程

```typescript
// serializers/slateToOutlookHtml.ts

/**
 * 智能序列化：Slate JSON → Outlook HTML
 * 
 * @param content - Slate JSON 内容
 * @param eventId - Event ID（用于生成 Web Viewer 链接）
 * @returns Outlook 兼容的 HTML
 */
export function slateToOutlookHtml(content: Descendant[], eventId: string): string {
  const htmlParts: string[] = [];
  
  for (const node of content) {
    htmlParts.push(serializeNodeSmart(node, eventId));
  }
  
  // 添加底部提示
  const footer = `
    <hr style="margin-top: 20px; border: none; border-top: 1px solid #ddd;" />
    <p style="font-size: 12px; color: #999;">
      💡 此内容由 <a href="https://app.remarkable.com">ReMarkable</a> 生成。
      某些富媒体元素（表格、图片、视频等）可能在移动端显示受限，
      <a href="https://app.remarkable.com/events/${eventId}/timelog">点击查看完整版</a>。
    </p>
  `;
  
  return htmlParts.join('\n') + footer;
}

function serializeNodeSmart(node: Descendant, eventId: string): string {
  if (Text.isText(node)) {
    return serializeText(node);  // 已有实现
  }
  
  switch (node.type) {
    case 'table':
      return serializeTable(node);  // Markdown 表格
    
    case 'image':
      return serializeImage(node, eventId);  // Web Viewer 链接
    
    case 'video':
      return serializeVideo(node, eventId);
    
    case 'audio':
      return serializeAudio(node, eventId);
    
    case 'attachment':
      return serializeAttachment(node, eventId);
    
    case 'tag':
      // mention-only 标签转为纯文本
      if (node.mentionOnly) {
        return `#${node.tagEmoji} ${node.tagName}`;
      }
      return serializeTag(node);  // 正式标签保留样式
    
    case 'context-marker':
      // v2.0 功能：隐藏在 Outlook，保留元数据
      return `<!-- ContextMarker: ${JSON.stringify(node.timeSpec)} -->`;
    
    default:
      return serializeStandardNode(node);  // 标准 HTML 元素
  }
}
```

#### 5.4.5 逆向序列化：Outlook HTML → Slate JSON

```typescript
// serializers/outlookHtmlToSlate.ts

/**
 * 从 Outlook HTML 恢复 Slate JSON
 * 
 * 注意：这是有损转换，无法完全恢复原始 Slate 结构
 * - Markdown 表格 → 识别并转回 table 节点
 * - Web Viewer 链接 → 还原为 image/video/attachment 占位符
 * - 隐藏的 ContextMarker → 从 HTML 注释中恢复
 */
export function outlookHtmlToSlate(html: string): Descendant[] {
  const doc = parseHTML(html);
  
  // 1. 移除底部提示
  removeFooter(doc);
  
  // 2. 解析节点
  return Array.from(doc.body.childNodes).map(node => 
    deserializeNode(node)
  ).filter(Boolean) as Descendant[];
}

function deserializeNode(domNode: Node): Descendant | null {
  // 文本节点
  if (domNode.nodeType === Node.TEXT_NODE) {
    return { text: domNode.textContent || '' };
  }
  
  // 元素节点
  if (domNode.nodeType === Node.ELEMENT_NODE) {
    const element = domNode as HTMLElement;
    
    // Markdown 表格识别
    if (element.tagName === 'PRE' && element.textContent?.includes('|')) {
      return parseMarkdownTable(element.textContent);
    }
    
    // Web Viewer 链接识别
    if (element.tagName === 'A' && element.href.includes('/timelog#')) {
      const hash = new URL(element.href).hash;
      if (hash.startsWith('#image-')) {
        return createImagePlaceholder(element.textContent || '');
      }
      if (hash.startsWith('#video-')) {
        return createVideoPlaceholder(element.textContent || '');
      }
    }
    
    // HTML 注释中的 ContextMarker
    if (domNode.nodeType === Node.COMMENT_NODE) {
      const match = domNode.textContent?.match(/ContextMarker: ({.*})/);
      if (match) {
        return restoreContextMarker(JSON.parse(match[1]));
      }
    }
    
    // 标准 HTML 元素
    return deserializeStandardElement(element);
  }
  
  return null;
}
```

---

### 5.5 Git 风格 Diff UI：字段级冲突解决界面

> **设计目标**: 提供类似 Git 的 three-way merge UI，让用户直观理解冲突并快速选择保留版本

#### 5.5.1 冲突解决组件设计

```typescript
// components/ConflictResolverDialog.tsx

interface ConflictResolverDialogProps {
  event: Event;
  conflictResult: FieldLevelConflictResult;
  onResolve: (resolution: ConflictResolution) => Promise<void>;
  onCancel: () => void;
}

/**
 * 冲突解决对话框
 * 
 * 布局：
 * ┌───────────────────────────────────────────┐
 * │ 🔀 解决冲突: 会议记录                      │
 * ├───────────────────────────────────────────┤
 * │ 共 3 个字段发生冲突，2 个字段已自动合并    │
 * ├───────────────────────────────────────────┤
 * │ ⚠️ title (标题)                            │
 * │ ┌─────────────┬─────────────┬──────────┐ │
 * │ │ 本地版本    │ 基准版本    │ 远程版本 │ │
 * │ ├─────────────┼─────────────┼──────────┤ │
 * │ │ ✓ 会议记录A │ 会议记录    │ 会议记录B│ │
 * │ └─────────────┴─────────────┴──────────┘ │
 * │ [ Keep Local ] [ Keep Remote ] [ Edit... ]│
 * ├───────────────────────────────────────────┤
 * │ ⚠️ timelog.description (日志内容)          │
 * │ ┌─────────────┬─────────────┬──────────┐ │
 * │ │ ✓ 本地修改  │ 原始内容    │ 远程修改 │ │
 * │ │ 添加了图片  │ 空白        │ 添加了表格│ │
 * │ └─────────────┴─────────────┴──────────┘ │
 * │ [ Keep Local ] [ Keep Remote ] [ Merge...]│
 * ├───────────────────────────────────────────┤
 * │ ✅ 自动合并的字段（2个）                   │
 * │ • tags: 新增 #项目A (远程)                 │
 * │ • timelog.timeSpent: 2h → 3h (本地)       │
 * │ [ 撤销自动合并 ]                           │
 * └───────────────────────────────────────────┘
 * │ [ 取消 ] [ 应用解决方案 ]                  │
 * └───────────────────────────────────────────┘
 */
export function ConflictResolverDialog({
  event,
  conflictResult,
  onResolve,
  onCancel
}: ConflictResolverDialogProps) {
  const [resolutions, setResolutions] = useState<Map<string, FieldResolution>>(
    new Map()
  );
  
  // 初始化：自动解决的字段默认使用自动方案
  useEffect(() => {
    const autoResolved = new Map<string, FieldResolution>();
    conflictResult.conflictedFields
      .filter(c => c.resolution === 'auto-local' || c.resolution === 'auto-remote')
      .forEach(conflict => {
        autoResolved.set(conflict.field, {
          strategy: conflict.resolution === 'auto-local' ? 'keep-local' : 'keep-remote',
          value: conflict.resolution === 'auto-local' ? conflict.localValue : conflict.remoteValue
        });
      });
    setResolutions(autoResolved);
  }, [conflictResult]);
  
  return (
    <Dialog open onClose={onCancel} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <MergeIcon color="warning" />
          <span>解决冲突: {event.title}</span>
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {/* 冲突摘要 */}
        <Alert severity="info" sx={{ mb: 2 }}>
          共 {conflictResult.conflictedFields.length} 个字段发生冲突，
          {conflictResult.conflictedFields.filter(c => c.resolution.startsWith('auto')).length} 个字段已自动合并
        </Alert>
        
        {/* 手动解决的冲突 */}
        {conflictResult.conflictedFields
          .filter(c => c.resolution === 'manual-required')
          .map(conflict => (
            <FieldConflictPanel
              key={conflict.field}
              conflict={conflict}
              resolution={resolutions.get(conflict.field)}
              onResolutionChange={(resolution) => {
                setResolutions(new Map(resolutions).set(conflict.field, resolution));
              }}
            />
          ))}
        
        {/* 自动合并的字段 */}
        <AutoMergedFieldsPanel
          conflicts={conflictResult.conflictedFields.filter(c => 
            c.resolution.startsWith('auto')
          )}
          resolutions={resolutions}
          onUndoAutoMerge={(field) => {
            const newResolutions = new Map(resolutions);
            newResolutions.delete(field);
            setResolutions(newResolutions);
          }}
        />
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          onClick={() => onResolve(resolutions)}
          disabled={!allConflictsResolved(conflictResult, resolutions)}
        >
          应用解决方案
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

#### 5.5.2 字段冲突面板：三栏对比

```typescript
// components/FieldConflictPanel.tsx

interface FieldConflictPanelProps {
  conflict: FieldConflict;
  resolution?: FieldResolution;
  onResolutionChange: (resolution: FieldResolution) => void;
}

/**
 * 单个字段的冲突解决面板
 * 
 * 样式：
 * ┌──────────────────────────────────────────┐
 * │ ⚠️ title (标题)                           │
 * ├──────────────────────────────────────────┤
 * │ ┌──────────┬──────────┬──────────┐       │
 * │ │ 本地版本 │ 基准版本 │ 远程版本 │       │
 * │ ├──────────┼──────────┼──────────┤       │
 * │ │ ✓ 新标题 │ 旧标题   │ 另一标题 │       │
 * │ │ (本地)   │ (上次同步)│ (远程)   │       │
 * │ └──────────┴──────────┴──────────┘       │
 * │ [ Keep Local ] [ Keep Remote ] [ Edit... ]│
 * └──────────────────────────────────────────┘
 */
export function FieldConflictPanel({
  conflict,
  resolution,
  onResolutionChange
}: FieldConflictPanelProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [customValue, setCustomValue] = useState<any>(null);
  
  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      {/* 字段标题 */}
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <WarningIcon color="warning" fontSize="small" />
        <Typography variant="subtitle2">
          {conflict.field} ({getFieldLabel(conflict.field)})
        </Typography>
      </Box>
      
      {/* 三栏对比 */}
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {/* 本地版本 */}
        <Grid item xs={4}>
          <VersionCard
            label="本地版本"
            value={conflict.localValue}
            timestamp={conflict.localTimestamp}
            isSelected={resolution?.strategy === 'keep-local'}
            fieldType={conflict.field}
          />
        </Grid>
        
        {/* 基准版本 (上次同步) */}
        <Grid item xs={4}>
          <VersionCard
            label="基准版本"
            value={conflict.baseValue}
            timestamp={conflict.baseTimestamp}
            isBaseline
            fieldType={conflict.field}
          />
        </Grid>
        
        {/* 远程版本 */}
        <Grid item xs={4}>
          <VersionCard
            label="远程版本"
            value={conflict.remoteValue}
            timestamp={conflict.remoteTimestamp}
            isSelected={resolution?.strategy === 'keep-remote'}
            fieldType={conflict.field}
          />
        </Grid>
      </Grid>
      
      {/* 操作按钮 */}
      <Box display="flex" gap={1}>
        <Button
          variant={resolution?.strategy === 'keep-local' ? 'contained' : 'outlined'}
          startIcon={<CheckIcon />}
          onClick={() => onResolutionChange({
            strategy: 'keep-local',
            value: conflict.localValue
          })}
        >
          保留本地
        </Button>
        
        <Button
          variant={resolution?.strategy === 'keep-remote' ? 'contained' : 'outlined'}
          startIcon={<CheckIcon />}
          onClick={() => onResolutionChange({
            strategy: 'keep-remote',
            value: conflict.remoteValue
          })}
        >
          保留远程
        </Button>
        
        {/* 特殊字段：提供合并选项 */}
        {canMergeField(conflict.field) && (
          <Button
            variant={resolution?.strategy === 'merge' ? 'contained' : 'outlined'}
            startIcon={<MergeIcon />}
            onClick={() => setIsEditing(true)}
          >
            手动合并...
          </Button>
        )}
      </Box>
      
      {/* 手动编辑对话框 */}
      {isEditing && (
        <FieldMergeDialog
          conflict={conflict}
          onMerge={(mergedValue) => {
            onResolutionChange({
              strategy: 'merge',
              value: mergedValue
            });
            setIsEditing(false);
          }}
          onCancel={() => setIsEditing(false)}
        />
      )}
    </Paper>
  );
}
```

#### 5.5.3 版本卡片：Diff 高亮

```typescript
// components/VersionCard.tsx

interface VersionCardProps {
  label: string;
  value: any;
  timestamp?: string;
  isSelected?: boolean;
  isBaseline?: boolean;
  fieldType: string;
}

/**
 * 单个版本的展示卡片
 * 
 * 样式：
 * ┌─────────────────┐
 * │ ✓ 本地版本      │
 * ├─────────────────┤
 * │ 会议记录 v2     │ ← Diff 高亮
 * │ +添加的内容     │ ← 绿色
 * │ -删除的内容     │ ← 红色
 * ├─────────────────┤
 * │ 2h ago          │
 * └─────────────────┘
 */
export function VersionCard({
  label,
  value,
  timestamp,
  isSelected,
  isBaseline,
  fieldType
}: VersionCardProps) {
  const displayValue = formatFieldValue(value, fieldType);
  
  return (
    <Card
      variant="outlined"
      sx={{
        borderColor: isSelected ? 'primary.main' : isBaseline ? 'grey.400' : 'grey.300',
        borderWidth: isSelected ? 2 : 1,
        bgcolor: isSelected ? 'primary.50' : isBaseline ? 'grey.50' : 'background.paper'
      }}
    >
      <CardContent>
        {/* 标签 */}
        <Box display="flex" alignItems="center" gap={0.5} mb={1}>
          {isSelected && <CheckIcon fontSize="small" color="primary" />}
          <Typography variant="caption" color="text.secondary">
            {label}
          </Typography>
        </Box>
        
        {/* 值 (带 Diff 高亮) */}
        <Box sx={{ mb: 1 }}>
          {renderFieldValueWithDiff(displayValue, fieldType)}
        </Box>
        
        {/* 时间戳 */}
        {timestamp && (
          <Typography variant="caption" color="text.secondary">
            {formatRelativeTime(timestamp)}
          </Typography>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Diff 高亮渲染
 */
function renderFieldValueWithDiff(value: string, fieldType: string) {
  if (fieldType === 'timelog.description') {
    // Slate 内容：渲染为 HTML 预览
    return <SlatePreview content={value} maxHeight={200} />;
  }
  
  if (fieldType === 'tags') {
    // 标签数组：显示标签列表
    const tags = JSON.parse(value) as Tag[];
    return (
      <Box display="flex" gap={0.5} flexWrap="wrap">
        {tags.map(tag => (
          <Chip
            key={tag.id}
            label={`${tag.emoji} ${tag.name}`}
            size="small"
          />
        ))}
      </Box>
    );
  }
  
  // 默认：纯文本
  return (
    <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>
      {value}
    </Typography>
  );
}
```

#### 5.5.4 自动合并字段面板

```typescript
// components/AutoMergedFieldsPanel.tsx

/**
 * 显示已自动合并的字段
 * 
 * 样式：
 * ┌─────────────────────────────────────┐
 * │ ✅ 自动合并的字段（2个）             │
 * ├─────────────────────────────────────┤
 * │ • tags: 新增 #项目A (远程)           │
 * │   [ 撤销 ]                           │
 * ├─────────────────────────────────────┤
 * │ • timelog.timeSpent: 2h → 3h (本地) │
 * │   [ 撤销 ]                           │
 * └─────────────────────────────────────┘
 */
export function AutoMergedFieldsPanel({
  conflicts,
  resolutions,
  onUndoAutoMerge
}: {
  conflicts: FieldConflict[];
  resolutions: Map<string, FieldResolution>;
  onUndoAutoMerge: (field: string) => void;
}) {
  if (conflicts.length === 0) return null;
  
  return (
    <Paper variant="outlined" sx={{ p: 2, bgcolor: 'success.50' }}>
      <Box display="flex" alignItems="center" gap={1} mb={1}>
        <CheckCircleIcon color="success" fontSize="small" />
        <Typography variant="subtitle2">
          自动合并的字段（{conflicts.length}个）
        </Typography>
      </Box>
      
      <List dense>
        {conflicts.map(conflict => {
          const resolution = resolutions.get(conflict.field);
          const changeDesc = getAutoMergeDescription(conflict);
          
          return (
            <ListItem key={conflict.field}>
              <ListItemText
                primary={`${conflict.field}: ${changeDesc}`}
                secondary={
                  resolution?.strategy === 'keep-local' ? '(保留本地)' : '(保留远程)'
                }
              />
              <ListItemSecondaryAction>
                <Button
                  size="small"
                  onClick={() => onUndoAutoMerge(conflict.field)}
                >
                  撤销
                </Button>
              </ListItemSecondaryAction>
            </ListItem>
          );
        })}
      </List>
    </Paper>
  );
}

function getAutoMergeDescription(conflict: FieldConflict): string {
  const { field, localValue, remoteValue, baseValue } = conflict;
  
  if (field === 'tags') {
    const added = JSON.parse(localValue || remoteValue).filter(
      (tag: Tag) => !JSON.parse(baseValue).some((t: Tag) => t.id === tag.id)
    );
    return `新增 ${added.map((t: Tag) => `#${t.emoji} ${t.name}`).join(', ')}`;
  }
  
  if (field === 'timelog.timeSpent') {
    return `${baseValue} → ${localValue || remoteValue}`;
  }
  
  return `${baseValue} → ${localValue || remoteValue}`;
}
```

#### 5.5.5 手动合并对话框：针对 Description

```typescript
// components/FieldMergeDialog.tsx

/**
 * Description 字段的手动合并对话框
 * 
 * 功能：
 * 1. 并排显示本地和远程的 Slate 内容
 * 2. 提供"插入远程段落"按钮
 * 3. 实时预览合并结果
 */
export function FieldMergeDialog({
  conflict,
  onMerge,
  onCancel
}: {
  conflict: FieldConflict;
  onMerge: (mergedValue: any) => void;
  onCancel: () => void;
}) {
  const [mergedContent, setMergedContent] = useState<Descendant[]>(
    JSON.parse(conflict.localValue)
  );
  
  const localContent = JSON.parse(conflict.localValue) as Descendant[];
  const remoteContent = JSON.parse(conflict.remoteValue) as Descendant[];
  
  return (
    <Dialog open onClose={onCancel} maxWidth="xl" fullWidth>
      <DialogTitle>手动合并: {conflict.field}</DialogTitle>
      
      <DialogContent>
        <Grid container spacing={2}>
          {/* 本地版本 */}
          <Grid item xs={4}>
            <Typography variant="subtitle2" gutterBottom>本地版本</Typography>
            <SlateEditor value={localContent} readOnly />
          </Grid>
          
          {/* 远程版本 */}
          <Grid item xs={4}>
            <Typography variant="subtitle2" gutterBottom>远程版本</Typography>
            <SlateEditor value={remoteContent} readOnly />
            <Button
              size="small"
              onClick={() => {
                // 插入远程段落到合并结果
                setMergedContent([...mergedContent, ...remoteContent]);
              }}
            >
              插入全部段落 →
            </Button>
          </Grid>
          
          {/* 合并结果 */}
          <Grid item xs={4}>
            <Typography variant="subtitle2" gutterBottom>合并结果</Typography>
            <SlateEditor
              value={mergedContent}
              onChange={setMergedContent}
            />
          </Grid>
        </Grid>
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onCancel}>取消</Button>
        <Button
          variant="contained"
          onClick={() => onMerge(JSON.stringify(mergedContent))}
        >
          使用此合并结果
        </Button>
      </DialogActions>
    </Dialog>
  );
}
```

---

### 5.6 增量同步优化

```typescript
// sync/incrementalSync.ts

export class IncrementalSyncManager {
  private lastSyncTimestamp: Map<string, Date> = new Map();
  
  // 只同步变化的事件
  async syncChangedEvents() {
    const lastSync = this.lastSyncTimestamp.get('events') || new Date(0);
    
    // 只获取上次同步之后有变化的事件
    const changedEvents = await db.events.find({
      updatedAt: { $gt: lastSync },
    });
    
    console.log(`📊 发现 ${changedEvents.length} 个需要同步的事件`);
    
    const results = [];
    for (const event of changedEvents) {
      try {
        const result = await syncEngine.syncEvent(event.id);
        results.push({ eventId: event.id, ...result });
      } catch (error) {
        console.error(`❌ 同步事件 ${event.id} 失败:`, error);
        results.push({ eventId: event.id, status: 'error', error });
      }
    }
    
    this.lastSyncTimestamp.set('events', new Date());
    return results;
  }
  
  // 错误重试机制
  async syncWithRetry(eventId: string, maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
      try {
        return await syncEngine.syncEvent(eventId);
      } catch (error) {
        if (i === maxRetries - 1) throw error;
        
        // 指数退避
        const delay = Math.pow(2, i) * 1000;
        console.log(`  ⏳ 重试中... (${i + 1}/${maxRetries})，等待 ${delay}ms`);
        await this.sleep(delay);
      }
    }
  }
  
  private sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

### 3.5 离线支持

```typescript
// sync/offlineQueue.ts

type SyncOperation = {
  eventId: string;
  operation: 'push' | 'pull';
  timestamp: Date;
  retryCount: number;
};

export class OfflineQueue {
  private queue: SyncOperation[] = [];
  private readonly QUEUE_STORAGE_KEY = 'remarkable-sync-queue';
  
  constructor() {
    this.loadQueue();
  }
  
  // 离线时将操作加入队列
  async queueSync(eventId: string, operation: 'push' | 'pull') {
    this.queue.push({
      eventId,
      operation,
      timestamp: new Date(),
      retryCount: 0,
    });
    
    await this.persistQueue();
    console.log(`📝 操作已加入队列: ${operation} ${eventId}`);
  }
  
  // 上线后执行队列中的操作
  async processQueue() {
    if (this.queue.length === 0) {
      return;
    }
    
    console.log(`🔄 开始处理队列，共 ${this.queue.length} 个操作`);
    
    while (this.queue.length > 0) {
      const op = this.queue[0];
      
      try {
        await syncEngine.syncEvent(op.eventId);
        this.queue.shift(); // 成功后移除
      } catch (error) {
        console.error(`❌ 队列操作失败: ${op.eventId}`, error);
        
        op.retryCount++;
        if (op.retryCount >= 3) {
          console.error(`  → 重试次数超限，移除队列`);
          this.queue.shift();
        } else {
          console.log(`  → 稍后重试 (${op.retryCount}/3)`);
          break; // 停止处理，等待下次
        }
      }
      
      await this.persistQueue();
    }
    
    console.log('✅ 队列处理完成');
  }
  
  // 持久化队列
  private async persistQueue() {
    localStorage.setItem(this.QUEUE_STORAGE_KEY, JSON.stringify(this.queue));
  }
  
  // 加载队列
  private loadQueue() {
    const stored = localStorage.getItem(this.QUEUE_STORAGE_KEY);
    if (stored) {
      this.queue = JSON.parse(stored);
    }
  }
}
```

## 4. 双层历史记录系统

> **架构**: 详见顶部"架构决策记录 → 双层历史记录系统"  
> **实施**: Phase 2（EventHistory）+ Phase 3（VersionControl）

### 4.1 系统概述

历史记录系统分为两层，分别服务于不同的业务需求：

**第一层：EventHistoryService（Event 级别）**
- **目的**: 审计日志、变更溯源、数据统计
- **记录内容**: Event 的 CRUD 操作（创建、更新、删除）
- **粒度**: 字段级别（title/tags/startTime 等）
- **存储**: 独立 `event_history` 集合
- **保留策略**: 永久保留（或按策略归档）

**第二层：VersionControlService（TimeLog 内容级别）**
- **目的**: 内容撤销/重做、协作冲突解决
- **记录内容**: Slate 编辑操作（段落增删、标签插入等）
- **粒度**: Slate 节点级别
- **存储**: `Event.eventlog.versions` 数组（嵌入式）
- **保留策略**: 最近 50 个版本

---

## 7. 第一层：EventHistoryService

### 7.1 核心概念

EventHistoryService 记录 Event 的所有变更，提供完整的审计追踪能力。

**功能目标:**

- ✅ 审计日志（谁在什么时候修改了哪个事件）
- ✅ 变更溯源（查看字段的历史变更）
- ✅ 时间段统计（过去 7 天创建/修改了多少事件）
- ✅ 数据恢复（恢复到历史版本）
- ✅ 冲突检测基础（为 Outlook 同步提供 hash 对比）

### 7.2 数据结构

```typescript
// types/eventHistory.ts

/**
 * Event 历史记录条目
 * 每次 Event 发生变更时创建一条记录
 */
type EventHistoryEntry = {
  id: string;                    // 历史记录 ID
  eventId: string;               // 关联的 Event ID
  
  // 操作元数据
  operation: HistoryOperation;
  timestamp: Date;               // 变更时间（内部使用 Date，存储时转换）
  userId?: string;               // 操作用户（为多用户准备）
  source: HistorySource;         // 变更来源
  
  // 变更内容
  snapshot: Event;               // 完整的 Event 快照
  changedFields?: string[];      // 变更的字段列表 ['title', 'tags']
  fieldDeltas?: FieldDelta[];    // 字段级差异
  
  // 用于同步的哈希
  contentHash: string;           // Event 内容的 hash
};

type HistoryOperation = 
  | 'create'        // 创建事件
  | 'update'        // 更新事件
  | 'delete'        // 删除事件（软删除）
  | 'restore';      // 恢复已删除事件

type HistorySource =
  | 'local-edit'    // 本地用户编辑
  | 'sync-pull'     // 从 Outlook 同步拉取
  | 'sync-push'     // 推送到 Outlook 前
  | 'import'        // 导入操作
  | 'migration'     // 数据迁移
  | 'system';       // 系统操作

type FieldDelta = {
  field: string;               // 字段名称
  oldValue: any;               // 旧值
  newValue: any;               // 新值
  valueType: 'primitive' | 'object' | 'array';
};

/**
 * 查询过滤器
 */
type EventHistoryQuery = {
  eventId?: string;              // 查询特定事件的历史
  operation?: HistoryOperation;  // 过滤操作类型
  source?: HistorySource;        // 过滤来源
  startDate?: Date;              // 时间范围开始
  endDate?: Date;                // 时间范围结束
  userId?: string;               // 过滤用户
  changedFields?: string[];      // 包含特定字段变更的记录
  limit?: number;                // 限制结果数量
  offset?: number;               // 分页偏移
};
```

### 6.3 EventHistoryService 实现

```typescript
// services/EventHistoryService.ts
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class EventHistoryService {
  
  /**
   * 记录 Event 变更
   * 在 EventService.createEvent/updateEvent/deleteEvent 中调用
   */
  async recordEventChange(
    eventId: string,
    operation: HistoryOperation,
    snapshot: Event,
    options?: {
      source?: HistorySource;
      userId?: string;
      changedFields?: string[];
      previousSnapshot?: Event;
    }
  ): Promise<EventHistoryEntry> {
    
    // 1. 使用 TimeHub 记录时间戳
    const timestamp = TimeHub.recordTimestamp();  // 🎯 统一时间来源
    
    // 2. 计算内容哈希（用于同步冲突检测）
    const contentHash = this.calculateEventHash(snapshot);
    
    // 3. 计算字段级差异（如果提供了旧快照）
    const fieldDeltas = options?.previousSnapshot
      ? this.calculateFieldDeltas(options.previousSnapshot, snapshot)
      : undefined;
    
    // 4. 自动推断变更字段（如果未提供）
    const changedFields = options?.changedFields || 
      (fieldDeltas ? fieldDeltas.map(d => d.field) : undefined);
    
    // 5. 创建历史记录
    const entry: EventHistoryEntry = {
      id: uuidv4(),
      eventId,
      operation,
      timestamp,  // 🎯 使用 TimeHub 生成的时间戳
      userId: options?.userId,
      source: options?.source || 'local-edit',
      snapshot,
      changedFields,
      fieldDeltas,
      contentHash,
    };
    
    // 6. 存储到数据库（转为 UTC 字符串）
    await db.eventHistory.insert({
      ...entry,
      timestamp: TimeHub.formatTimestamp(timestamp),  // 🎯 存储为 UTC 字符串
    });
    
    console.log(`📝 [EventHistory] ${operation} event ${eventId}`, {
      fields: changedFields,
      source: entry.source
    });
    
    return entry;
  }
  
  /**
   * 查询事件的历史记录
   */
  async getEventHistory(
    eventId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<EventHistoryEntry[]> {
    return await db.eventHistory.find({
      eventId,
    })
    .sort({ timestamp: -1 })  // 最新的在前
    .limit(options?.limit || 100)
    .skip(options?.offset || 0)
    .toArray();
  }
  
  /**
   * 查询时间段内的变更
   * 用于统计、报表等功能
   */
  async getChangesInPeriod(
    startDate: Date,
    endDate: Date,
    filter?: Partial<EventHistoryQuery>
  ): Promise<EventHistoryEntry[]> {
    const query: any = {
      timestamp: {
        $gte: startDate,
        $lte: endDate,
      },
    };
    
    if (filter?.operation) query.operation = filter.operation;
    if (filter?.source) query.source = filter.source;
    if (filter?.userId) query.userId = filter.userId;
    if (filter?.changedFields) {
      query.changedFields = { $in: filter.changedFields };
    }
    
    return await db.eventHistory.find(query)
      .sort({ timestamp: -1 })
      .limit(filter?.limit || 1000)
      .toArray();
  }
  
  /**
   * 恢复到特定历史版本
   */
  async restoreEventVersion(
    eventId: string,
    historyId: string
  ): Promise<Event> {
    // 1. 获取目标历史记录
    const history = await db.eventHistory.findOne({ id: historyId });
    if (!history || history.eventId !== eventId) {
      throw new Error('历史记录不存在');
    }
    
    // 2. 恢复快照
    const restoredEvent = { ...history.snapshot };
    
    // 3. 更新当前 Event
    await EventService.updateEvent(eventId, restoredEvent);
    
    // 4. 记录恢复操作
    await this.recordEventChange(
      eventId,
      'restore',
      restoredEvent,
      { source: 'system' }
    );
    
    console.log(`🔄 [EventHistory] 恢复事件 ${eventId} 到版本 ${historyId}`);
    
    return restoredEvent;
  }
  
  /**
   * 计算 Event 内容哈希
   * 用于同步冲突检测（排除不影响内容的字段）
   */
  private calculateEventHash(event: Event): string {
    // 排除元数据字段，只计算内容字段
    const contentFields = {
      title: event.title,
      eventlog: Event.eventlog,
      tags: event.tags,
      startTime: event.startTime,
      endTime: event.endTime,
      // 不包括 updatedAt、syncState 等元数据
    };
    
    const content = JSON.stringify(contentFields, Object.keys(contentFields).sort());
    return crypto.createHash('sha256').update(content).digest('hex');
  }
  
  /**
   * 计算字段级差异
   */
  private calculateFieldDeltas(
    oldEvent: Event,
    newEvent: Event
  ): FieldDelta[] {
    const deltas: FieldDelta[] = [];
    
    // 比较所有字段
    const allKeys = new Set([
      ...Object.keys(oldEvent),
      ...Object.keys(newEvent),
    ]);
    
    for (const key of allKeys) {
      const oldValue = (oldEvent as any)[key];
      const newValue = (newEvent as any)[key];
      
      // 跳过元数据字段
      if (['id', 'createdAt', 'updatedAt'].includes(key)) {
        continue;
      }
      
      // 检测变更
      if (!this.isEqual(oldValue, newValue)) {
        deltas.push({
          field: key,
          oldValue,
          newValue,
          valueType: this.getValueType(newValue),
        });
      }
    }
    
    return deltas;
  }
  
  /**
   * 深度相等比较
   */
  private isEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }
  
  /**
   * 判断值类型
   */
  private getValueType(value: any): 'primitive' | 'object' | 'array' {
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object' && value !== null) return 'object';
    return 'primitive';
  }
  
  /**
   * 获取统计信息
   */
  async getStatistics(startDate: Date, endDate: Date): Promise<{
    totalChanges: number;
    createdEvents: number;
    updatedEvents: number;
    deletedEvents: number;
    bySource: Record<HistorySource, number>;
    byDay: { date: string; count: number }[];
  }> {
    const changes = await this.getChangesInPeriod(startDate, endDate);
    
    const stats = {
      totalChanges: changes.length,
      createdEvents: changes.filter(c => c.operation === 'create').length,
      updatedEvents: changes.filter(c => c.operation === 'update').length,
      deletedEvents: changes.filter(c => c.operation === 'delete').length,
      bySource: {} as Record<HistorySource, number>,
      byDay: [] as { date: string; count: number }[],
    };
    
    // 按来源统计
    for (const change of changes) {
      stats.bySource[change.source] = (stats.bySource[change.source] || 0) + 1;
    }
    
    // 按天统计
    const dayMap = new Map<string, number>();
    for (const change of changes) {
      const day = change.timestamp.toISOString().split('T')[0];
      dayMap.set(day, (dayMap.get(day) || 0) + 1);
    }
    stats.byDay = Array.from(dayMap.entries()).map(([date, count]) => ({
      date,
      count,
    }));
    
    return stats;
  }
}

// 单例导出
export const eventHistoryService = new EventHistoryService();
```

### 6.4 集成到 EventService

在现有的 EventService 中集成 EventHistoryService：

```typescript
// services/EventService.ts (修改部分)
import { eventHistoryService } from './EventHistoryService';

class EventService {
  
  async createEvent(event: Partial<Event>): Promise<Event> {
    // 1. 创建事件（现有逻辑）
    const newEvent = {
      id: uuidv4(),
      ...event,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Event;
    
    await db.events.insert(newEvent);
    
    // 2. 🆕 记录历史
    await eventHistoryService.recordEventChange(
      newEvent.id,
      'create',
      newEvent,
      { source: 'local-edit' }
    );
    
    return newEvent;
  }
  
  async updateEvent(
    eventId: string,
    updates: Partial<Event>
  ): Promise<Event> {
    // 1. 获取旧版本
    const oldEvent = await db.events.findOne({ id: eventId });
    if (!oldEvent) throw new Error('Event not found');
    
    // 2. 应用更新（现有逻辑）
    const updatedEvent = {
      ...oldEvent,
      ...updates,
      updatedAt: new Date(),
    };
    
    await db.events.update({ id: eventId }, updatedEvent);
    
    // 3. 🆕 计算变更字段
    const changedFields = Object.keys(updates).filter(
      key => !['updatedAt', 'id'].includes(key)
    );
    
    // 4. 🆕 记录历史
    await eventHistoryService.recordEventChange(
      eventId,
      'update',
      updatedEvent,
      {
        source: 'local-edit',
        changedFields,
        previousSnapshot: oldEvent,
      }
    );
    
    return updatedEvent;
  }
  
  async deleteEvent(eventId: string): Promise<void> {
    // 1. 获取事件快照
    const event = await db.events.findOne({ id: eventId });
    if (!event) throw new Error('Event not found');
    
    // 2. 软删除（添加 deletedAt 标记）
    const deletedEvent = {
      ...event,
      deletedAt: new Date(),
      updatedAt: new Date(),
    };
    
    await db.events.update({ id: eventId }, deletedEvent);
    
    // 3. 🆕 记录删除历史
    await eventHistoryService.recordEventChange(
      eventId,
      'delete',
      deletedEvent,
      { source: 'local-edit' }
    );
  }
}
```

### 6.5 数据库 Schema

```sql
-- MongoDB Collection: event_history
{
  _id: ObjectId,
  id: String,              // UUID
  eventId: String,         // 关联的 Event ID
  operation: String,       // 'create' | 'update' | 'delete' | 'restore'
  timestamp: Date,
  userId: String,
  source: String,          // 'local-edit' | 'sync-pull' | 'sync-push' | ...
  snapshot: Object,        // 完整的 Event 快照
  changedFields: [String],
  fieldDeltas: [{
    field: String,
    oldValue: Mixed,
    newValue: Mixed,
    valueType: String,
  }],
  contentHash: String,
}

-- 索引
db.event_history.createIndex({ eventId: 1, timestamp: -1 });
db.event_history.createIndex({ timestamp: -1 });
db.event_history.createIndex({ operation: 1, timestamp: -1 });
db.event_history.createIndex({ source: 1, timestamp: -1 });
db.event_history.createIndex({ contentHash: 1 });
```

### 6.6 快照查看器集成：DailySnapshotViewer

> **现有实现**: `src/components/DailySnapshotViewer.tsx`  
> **状态**: 🟡 部分实现（使用简化数据结构）  
> **迁移需求**: 需要适配 TimeLog 嵌入式架构

#### 6.6.1 现有功能概述

`DailySnapshotViewer` 组件用于显示和追踪用户每天的任务状态和变化，当前实现：

**核心功能**:
- 📅 显示指定日期的 todo-list 状态
- 📊 追踪任务变化（新增/完成/搁置/删除）
- 🔄 支持"只显示变化"模式
- 📝 任务卡片展示（标题/描述/标签/时间）

**数据依赖**:
```typescript
interface DailySnapshot {
  date: string;
  items: Event[];
  changes: {
    added: Event[];
    checked: Event[];
    dropped: Event[];
    deleted: string[];
  };
}
```

**当前实现问题**:
1. ❌ 使用简化的 `Event.content` 字段（应为 `Event.eventlog.description`）
2. ❌ 无法展示 TimeLog 的版本历史
3. ❌ 缺少 Slate 富文本渲染
4. ❌ 未集成 EventHistoryService

#### 6.6.2 迁移到 TimeLog 架构的改造方案

**Phase 1: 数据结构适配**

```typescript
// services/snapshotService.ts (需要修改)

interface DailySnapshotV2 {
  date: string;
  items: Event[];  // 包含完整的 timelog 字段
  changes: {
    added: Event[];
    checked: Event[];
    dropped: Event[];
    deleted: string[];
    timelogUpdated: Array<{  // 🆕 新增：TimeLog 内容变化
      eventId: string;
      title: string;
      changedFields: string[];
      versionCount: number;
    }>;
  };
}

class SnapshotService {
  /**
   * 获取每日快照（集成 EventHistoryService）
   */
  async getDailySnapshotV2(date: string): Promise<DailySnapshotV2> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    // 1. 获取当天的所有 Event 历史记录
    const historyEntries = await EventHistoryService.getChangesInPeriod(
      startOfDay,
      endOfDay
    );
    
    // 2. 分析变化类型
    const added: Event[] = [];
    const checked: Event[] = [];
    const dropped: Event[] = [];
    const deleted: string[] = [];
    const timelogUpdated: Array<any> = [];
    
    for (const entry of historyEntries) {
      if (entry.operation === 'create') {
        added.push(entry.snapshot);
      } else if (entry.operation === 'update') {
        // 检查是否是 TimeLog 内容更新
        if (entry.changedFields.some(f => f.startsWith('timelog'))) {
          timelogUpdated.push({
            eventId: entry.eventId,
            title: entry.snapshot.title,
            changedFields: entry.changedFields,
            versionCount: entry.snapshot.eventlog?.versions?.length || 0,
          });
        }
        // 检查是否标记为完成
        if (entry.changedFields.includes('isCompleted') && entry.snapshot.isCompleted) {
          checked.push(entry.snapshot);
        }
      } else if (entry.operation === 'delete') {
        deleted.push(entry.eventId);
      }
    }
    
    // 3. 获取当天结束时的所有 Event 状态
    const currentItems = await EventService.getEventsByDate(date);
    
    return {
      date,
      items: currentItems,
      changes: { added, checked, dropped, deleted, timelogUpdated },
    };
  }
}
```

**Phase 2: UI 组件升级**

```typescript
// components/DailySnapshotViewer.tsx (需要修改)

import { SlatePreview } from './UnifiedSlateEditor/SlatePreview';

const TaskCard: React.FC<TaskCardProps> = ({ item, highlight }) => {
  // 🆕 渲染 TimeLog 富文本内容
  const renderDescription = () => {
    if (!item.eventlog?.content) {
      return null;
    }
    
    // 使用 Slate 预览组件（只读模式）
    return (
      <div className="task-timelog">
        <SlatePreview 
          content={item.eventlog.content} 
          maxHeight={200}
          showTimestamps={false}  // 快照视图不显示时间戳
        />
      </div>
    );
  };
  
  return (
    <div className={`task-card ${highlight || ''}`}>
      {/* ... 标题和状态 ... */}
      
      {/* 🆕 TimeLog 内容展示 */}
      {renderDescription()}
      
      {/* 🆕 版本历史指示器 */}
      {item.eventlog?.versions && item.eventlog.versions.length > 1 && (
        <div className="version-indicator">
          📝 {item.eventlog.versions.length} 个版本
        </div>
      )}
      
      {/* ... 标签和时间 ... */}
    </div>
  );
};

// 🆕 新增：TimeLog 更新列表
{snapshot.changes.timelogUpdated.length > 0 && (
  <section className="changes-section timelog-updated">
    <h4>📝 内容更新 ({snapshot.changes.timelogUpdated.length})</h4>
    <div className="items-list">
      {snapshot.changes.timelogUpdated.map((item) => (
        <div key={item.eventId} className="timelog-change-item">
          <span className="title">{item.title}</span>
          <span className="changed-fields">
            {item.changedFields.join(', ')}
          </span>
          <span className="version-count">
            {item.versionCount} 个版本
          </span>
        </div>
      ))}
    </div>
  </section>
)}
```

**Phase 3: 性能优化**

```typescript
// 1. 投影查询（避免加载完整 timelog.versions）
async getEventsByDate(date: string): Promise<Event[]> {
  return db.events.find(
    { startTime: { $gte: startOfDay, $lt: endOfDay } },
    {
      projection: {
        'timelog.versions': 0,  // 排除版本历史（减少数据量）
      }
    }
  );
}

// 2. 懒加载版本详情
const [expandedEventId, setExpandedEventId] = useState<string | null>(null);

const loadVersionDetails = async (eventId: string) => {
  const event = await EventService.getEventById(eventId);
  setExpandedEventId(eventId);
  // 显示版本历史面板
};
```

#### 6.6.3 迁移清单

**代码修改**:
- [ ] `services/snapshotService.ts`: 集成 EventHistoryService
- [ ] `components/DailySnapshotViewer.tsx`: 
  - [ ] 替换 `item.content` → `item.eventlog.description`
  - [ ] 添加 `SlatePreview` 组件渲染
  - [ ] 添加版本历史指示器
  - [ ] 添加 TimeLog 更新列表
- [ ] `components/DailySnapshotViewer.css`: 
  - [ ] 添加 `.task-timelog` 样式
  - [ ] 添加 `.version-indicator` 样式
  - [ ] 添加 `.eventlog-updated` 样式

**测试场景**:
1. 查看历史日期的快照（恢复 Event 状态）
2. 查看当天的快照（显示实时数据）
3. 查看包含 TimeLog 编辑的日期（展示富文本内容）
4. 点击版本指示器查看完整版本历史

**依赖关系**:
- 依赖 EventHistoryService 实现（Section 6）
- 依赖 SlatePreview 组件（假设已实现）
- 依赖 Event.eventlog 字段迁移（Conflict #1 解决方案）

---

## 7. 第二层：VersionControlService

### 7.1 核心概念

---

## 7. 第二层：VersionControlService

### 7.1 核心概念

VersionControlService 记录 TimeLog 内容的细粒度编辑历史，支持撤销/重做和版本恢复。

用户每次间隔 **5 分钟以上** 的输入都会记录一次 timestamp（版本快照）。

**功能目标:**

- ✅ 内容版本追踪（像 Notion/Google Docs）
- ✅ 撤销/重做增强（可回退到任意时间点）
- ✅ 协作冲突解决（为未来多用户功能做准备）
- ✅ 自动保存机制（减少数据丢失风险）

**与 EventHistoryService 的区别:**

| 维度 | EventHistoryService | VersionControlService |
|------|-------------------|---------------------|
| **记录对象** | 整个 Event | Event.eventlog 内容 |
| **触发时机** | 每次 CRUD 操作 | 每 5 分钟或重大编辑 |
| **存储位置** | event_history 集合 | Event.eventlog.versions 数组 |
| **典型用途** | "谁在 11 月 10 日修改了这个事件？" | "恢复到 10 分钟前的编辑内容" |

### 7.2 时间戳管理：统一通过 TimeHub

> **架构决策（2025-11-13）**: TimeLog 版本的时间戳由 TimeHub 统一管理，避免直接使用 `new Date()`

#### 7.2.1 TimeHub 扩展：系统时间戳管理

TimeHub 的职责从"管理 Event 时间"扩展到"管理所有应用内时间状态"：

```typescript
// services/TimeHub.ts

/**
 * TimeHub: 应用内统一的时间管理服务
 * 
 * 两类时间管理：
 * 1. 事件时间 (Event Time): 用户设定的"事件发生时间"
 *    - 使用 TimeSpec 结构
 *    - 支持模糊时间、时区策略
 *    - 方法: setEventTime(), getEventTime()
 * 
 * 2. 系统时间戳 (System Timestamp): 自动记录的"操作时间"
 *    - 使用 Date 对象（内部）+ UTC 字符串（存储）
 *    - 精确到毫秒，UTC 存储
 *    - 方法: recordTimestamp(), formatTimestamp(), parseTimestamp()
 *    - 用途: 版本历史、事件历史、日志等
 */
class TimeHub {
  // ==================== 现有方法：管理 Event 时间 ====================
  
  async setEventTime(eventId: string, input: TimeInput): Promise<void> {
    const timeSpec: TimeSpec = this.parseTimeInput(input);
    await EventService.updateEvent(eventId, { 
      timeSpec,
      // 同步更新派生字段
      startTime: timeSpec.resolved.start.toISOString(),
      endTime: timeSpec.resolved.end.toISOString(),
    });
  }
  
  async getEventTime(eventId: string): Promise<TimeSpec> {
    const event = await EventService.getEventById(eventId);
    return event.timeSpec;
  }
  
  // ==================== 🆕 新增方法：管理系统时间戳 ====================
  
  /**
   * 记录系统时间戳（用于版本历史、事件历史等）
   * 
   * 统一的时间戳生成逻辑：
   * 1. 使用系统时间（未来可支持 NTP 校时）
   * 2. 离线时使用本地时间，同步后可选修正
   * 3. 保证应用内所有时间戳的一致性
   * 
   * @returns Date 对象（内部使用）
   */
  recordTimestamp(): Date {
    // 当前实现：直接使用系统时间
    return new Date();
    
    // 未来可扩展：
    // - 添加 NTP 校时偏移量
    // - 添加离线时间修正逻辑
    // - 添加时间旅行调试模式（测试用）
  }
  
  /**
   * 格式化系统时间戳为 UTC 字符串（用于数据库存储）
   * 
   * @param date - Date 对象
   * @returns ISO 8601 UTC 字符串 (e.g., "2025-11-13T10:30:00.123Z")
   */
  formatTimestamp(date: Date): string {
    return date.toISOString();
  }
  
  /**
   * 解析 UTC 字符串为本地显示时间
   * 
   * @param isoString - UTC 时间字符串
   * @returns Date 对象（用于 UI 显示）
   */
  parseTimestamp(isoString: string): Date {
    return new Date(isoString);
  }
  
  /**
   * 格式化时间戳为用户友好的相对时间
   * 
   * @param date - Date 对象或 UTC 字符串
   * @returns 相对时间字符串 (e.g., "2分钟前", "昨天 14:30", "2023-11-13")
   */
  formatRelativeTime(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins}分钟前`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}小时前`;
    
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return `昨天 ${d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`;
    if (diffDays < 7) return `${diffDays}天前`;
    
    return d.toLocaleDateString('zh-CN');
  }
}

// 导出单例
export const TimeHub = new TimeHubService();
```

#### 7.2.2 EventLogVersion 数据结构（修正版）

```typescript
// types/version.ts

/**
 * 版本快照（每 5 分钟或重要操作时保存）
 * 
 * ✅ 时间戳由 TimeHub.recordTimestamp() 生成
 * ✅ 存储时使用 TimeHub.formatTimestamp() 转为 UTC 字符串
 * ✅ 显示时使用 TimeHub.parseTimestamp() 或 formatRelativeTime()
 */
type EventLogVersion = {
  id: string;
  createdAt: Date;              // 🎯 由 TimeHub.recordTimestamp() 生成
  
  // 完整的内容快照（方便快速恢复）
  content: Descendant[];        // 包含 ContextMarkerElement（带 TimeSpec）
  
  // 可选：只存储差异（节省空间）
  diff?: Delta;
  
  // 版本元数据
  author?: string;              // 如果支持多用户
  triggerType: VersionTriggerType;
  changesSummary: string;       // "添加了 3 个段落，删除了 1 张图片"
  
  // 用于同步的哈希
  contentHash: string;
};

type VersionTriggerType = 
  | 'auto-save'          // 自动保存（5 分钟间隔）
  | 'manual-save'        // 用户手动保存（Ctrl+S）
  | 'sync-push'          // 同步到 Outlook 前
  | 'sync-pull'          // 从 Outlook 拉取后
  | 'major-edit'         // 重大编辑（如插入表格、上传附件、插入情境标记）
  | 'checkpoint';        // 用户手动创建的检查点

/**
 * 操作日志（更细粒度，可选）
 * 用于精确追踪每个编辑操作
 */
type Operation = {
  id: string;
  timestamp: Date;
  type: 'insert' | 'delete' | 'update';
  path: Path;              // Slate path
  data: any;
  userId?: string;
};

/**
 * 差异对象（类似 Git diff）
 * 用于存储增量变更，节省空间
 */
type Delta = {
  added: DeltaChange[];
  removed: DeltaChange[];
  modified: DeltaChange[];
};

type DeltaChange = {
  path: Path;
  oldValue?: any;
  newValue?: any;
};
```

### 7.3 VersionControlService 实现

```typescript
// services/versionControl.ts
import { Editor, Node, Operation as SlateOperation, Path } from 'slate';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { TimeHub } from './TimeHub';  // 🎯 导入 TimeHub

export class VersionControlService {
  private lastVersionTimestamp: Date | null = null;
  private pendingOperations: Operation[] = [];
  private autoSaveTimer: NodeJS.Timeout | null = null;
  
  // 配置
  private readonly AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 分钟
  private readonly MIN_CHANGES_THRESHOLD = 10;         // 最少 10 个操作才保存
  
  constructor(private timelogId: string) {
    this.startAutoSave();
  }
  
  // 启动自动保存
  private startAutoSave() {
    this.autoSaveTimer = setInterval(() => {
      this.checkAndCreateVersion('auto-save');
    }, this.AUTO_SAVE_INTERVAL);
  }
  
  // 停止自动保存
  stopAutoSave() {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
      this.autoSaveTimer = null;
    }
  }
  
  // 检查是否应该创建新版本
  private async checkAndCreateVersion(trigger: VersionTriggerType) {
    const now = TimeHub.recordTimestamp();  // 🎯 使用 TimeHub
    
    // 1. 检查时间间隔
    if (this.lastVersionTimestamp) {
      const elapsed = now.getTime() - this.lastVersionTimestamp.getTime();
      if (elapsed < this.AUTO_SAVE_INTERVAL && trigger === 'auto-save') {
        console.log('  ⏭️ 未到 5 分钟，跳过自动保存');
        return;
      }
    }
    
    // 2. 检查是否有足够的变更
    if (this.pendingOperations.length < this.MIN_CHANGES_THRESHOLD && trigger === 'auto-save') {
      console.log(`  ⏭️ 变更太少 (${this.pendingOperations.length}/${this.MIN_CHANGES_THRESHOLD})，跳过自动保存`);
      return;
    }
    
    // 3. 创建版本
    await this.createVersion(trigger);
  }
  
  // 创建新版本
  async createVersion(trigger: VersionTriggerType): Promise<EventLogVersion> {
    const timelog = await db.timelogs.findById(this.timelogId);
    
    // 1. 使用 TimeHub 记录时间戳
    const createdAt = TimeHub.recordTimestamp();  // 🎯 统一时间来源
    
    // 2. 计算内容哈希
    const contentHash = this.hashContent(timelog.content);
    
    // 3. 生成变更摘要
    const changesSummary = this.generateChangesSummary(this.pendingOperations);
    
    // 4. 计算差异（相对于上一个版本）
    const previousVersion = timelog.versions[timelog.versions.length - 1];
    const diff = previousVersion 
      ? this.calculateDiff(previousVersion.content, timelog.content)
      : null;
    
    // 5. 创建版本对象
    const version: EventLogVersion = {
      id: uuidv4(),
      createdAt,  // 🎯 使用 TimeHub 生成的时间戳
      content: timelog.content, // 完整快照
      diff,
      triggerType: trigger,
      changesSummary,
      contentHash,
    };
    
    // 6. 保存版本（存储时转为 UTC 字符串）
    await db.timelogs.update(this.timelogId, {
      $push: { 
        versions: {
          ...version,
          createdAt: TimeHub.formatTimestamp(version.createdAt),  // 🎯 转为 UTC 字符串
        }
      },
      updatedAt: TimeHub.formatTimestamp(createdAt),  // 🎯 使用 TimeHub
    });
    
    // 7. 重置状态
    this.lastVersionTimestamp = createdAt;
    this.pendingOperations = [];
    
    console.log(`✅ 版本已创建: ${trigger} - ${changesSummary}`);
    
    return version;
  }
  
  // 记录操作（在 Slate onChange 中调用）
  recordOperation(operation: SlateOperation, editor: Editor) {
    // 过滤掉不重要的操作（如光标移动）
    if (operation.type === 'set_selection') {
      return;
    }
    
    this.pendingOperations.push({
      id: uuidv4(),
      timestamp: TimeHub.recordTimestamp(),  // 🎯 使用 TimeHub
      type: this.mapSlateOpType(operation.type),
      path: operation.path || [],
      data: operation,
    });
    
    // 检测"重大编辑"，立即创建版本
    if (this.isMajorEdit(operation)) {
      console.log('🔔 检测到重大编辑，立即创建版本');
      this.createVersion('major-edit');
    }
  }
  
  // 检测是否为重大编辑
  private isMajorEdit(operation: SlateOperation): boolean {
    if (operation.type === 'insert_node') {
      const node = operation.node as any;
      // 插入表格、图片、视频等
      if (['table', 'image', 'video', 'audio'].includes(node.type)) {
        return true;
      }
    }
    
    if (operation.type === 'remove_node') {
      const node = operation.node as any;
      // 删除整个块级元素
      if (['table', 'heading-1', 'heading-2', 'heading-3'].includes(node.type)) {
        return true;
      }
    }
    
    return false;
  }
  
  // 生成变更摘要
  private generateChangesSummary(operations: Operation[]): string {
    const stats = {
      insertions: 0,
      deletions: 0,
      updates: 0,
      charsAdded: 0,
      charsRemoved: 0,
    };
    
    operations.forEach(op => {
      switch (op.type) {
        case 'insert':
          stats.insertions++;
          if (op.data.text) {
            stats.charsAdded += op.data.text.length;
          }
          break;
        case 'delete':
          stats.deletions++;
          if (op.data.text) {
            stats.charsRemoved += op.data.text.length;
          }
          break;
        case 'update':
          stats.updates++;
          break;
      }
    });
    
    const parts: string[] = [];
    if (stats.charsAdded > 0) parts.push(`添加了 ${stats.charsAdded} 个字符`);
    if (stats.charsRemoved > 0) parts.push(`删除了 ${stats.charsRemoved} 个字符`);
    if (stats.insertions > 0) parts.push(`插入了 ${stats.insertions} 个元素`);
    if (stats.deletions > 0) parts.push(`删除了 ${stats.deletions} 个元素`);
    
    return parts.join('，') || '无变更';
  }
  
  // 计算差异（简化版）
  private calculateDiff(oldContent: Descendant[], newContent: Descendant[]): Delta | null {
    const oldStr = JSON.stringify(oldContent);
    const newStr = JSON.stringify(newContent);
    
    if (oldStr === newStr) {
      return null;
    }
    
    // TODO: 实现更精确的 diff 算法
    // 可以使用 diff-match-patch 或 Myers diff
    
    return {
      added: [],
      removed: [],
      modified: [],
    };
  }
  
  // 计算内容哈希
  private hashContent(content: Descendant[]): string {
    const str = JSON.stringify(content);
    return crypto.createHash('sha256').update(str).digest('hex');
  }
  
  // 映射 Slate 操作类型
  private mapSlateOpType(type: string): 'insert' | 'delete' | 'update' {
    if (type.includes('insert')) return 'insert';
    if (type.includes('remove')) return 'delete';
    return 'update';
  }
}
```

### 6.4 集成到 Slate Editor

```typescript
// components/TimeLogEditor.tsx
import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { createEditor, Descendant } from 'slate';
import { Slate, Editable, withReact } from 'slate-react';
import { VersionControlService } from '../services/versionControl';

interface TimeLogEditorProps {
  timelogId: string;
  initialValue: Descendant[];
  onSave: (content: Descendant[]) => void;
}

export const TimeLogEditor: React.FC<TimeLogEditorProps> = ({
  timelogId,
  initialValue,
  onSave,
}) => {
  const editor = useMemo(() => withReact(createEditor()), []);
  const [value, setValue] = useState<Descendant[]>(initialValue);
  
  // 创建版本控制服务
  const versionControl = useRef<VersionControlService | null>(null);
  
  useEffect(() => {
    // 初始化版本控制
    versionControl.current = new VersionControlService(timelogId);
    
    // 清理
    return () => {
      versionControl.current?.stopAutoSave();
    };
  }, [timelogId]);
  
  // 处理内容变化
  const handleChange = (newValue: Descendant[]) => {
    setValue(newValue);
    
    // 记录操作历史
    editor.operations.forEach(op => {
      versionControl.current?.recordOperation(op, editor);
    });
  };
  
  // 手动保存（Ctrl+S）
  const handleManualSave = useCallback(() => {
    versionControl.current?.createVersion('manual-save');
    onSave(value);
  }, [value, onSave]);
  
  // 监听键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleManualSave();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleManualSave]);
  
  return (
    <div className="timelog-editor">
      <div className="editor-toolbar">
        <button onClick={handleManualSave}>💾 保存</button>
        <button onClick={() => setShowHistory(true)}>🕐 版本历史</button>
      </div>
      
      <Slate editor={editor} initialValue={value} onChange={handleChange}>
        <Editable
          placeholder="开始记录..."
          renderElement={renderElement}
          renderLeaf={renderLeaf}
        />
      </Slate>
      
      {/* 版本历史面板 */}
      {showHistory && (
        <VersionHistoryPanel
          timelogId={timelogId}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  );
};
```

### 6.5 版本历史 UI

```typescript
// components/VersionHistoryPanel.tsx
import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';

interface VersionHistoryPanelProps {
  timelogId: string;
  onClose: () => void;
}

export const VersionHistoryPanel: React.FC<VersionHistoryPanelProps> = ({
  timelogId,
  onClose,
}) => {
  const [versions, setVersions] = useState<EventLogVersion[]>([]);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    loadVersions();
  }, [timelogId]);
  
  const loadVersions = async () => {
    setLoading(true);
    try {
      const timelog = await db.timelogs.findById(timelogId);
      setVersions([...eventlog.versions].reverse()); // 最新的在前
    } finally {
      setLoading(false);
    }
  };
  
  const handleRestore = async (versionId: string) => {
    const version = versions.find(v => v.id === versionId);
    if (!version) return;
    
    // 确认对话框
    const confirmed = window.confirm(
      `确定要恢复到 ${format(version.timestamp, 'yyyy-MM-dd HH:mm:ss')} 的版本吗？\n\n` +
      `变更内容: ${version.changesSummary}`
    );
    
    if (!confirmed) return;
    
    // 恢复版本（创建一个新版本，内容为旧版本）
    await db.timelogs.update(timelogId, {
      content: version.content,
      $push: {
        versions: {
          id: uuidv4(),
          timestamp: new Date(),
          content: version.content,
          triggerType: 'checkpoint',
          changesSummary: `恢复到 ${format(version.timestamp, 'yyyy-MM-dd HH:mm:ss')}`,
          contentHash: hashContent(version.content),
        },
      },
    });
    
    // 刷新页面
    window.location.reload();
  };
  
  const getTriggerLabel = (trigger: VersionTriggerType): string => {
    const labels: Record<VersionTriggerType, string> = {
      'auto-save': '自动保存',
      'manual-save': '手动保存',
      'sync-push': '同步到 Outlook',
      'sync-pull': '从 Outlook 同步',
      'major-edit': '重大编辑',
      'checkpoint': '检查点',
    };
    return labels[trigger];
  };
  
  const getTriggerIcon = (trigger: VersionTriggerType): string => {
    const icons: Record<VersionTriggerType, string> = {
      'auto-save': '⏰',
      'manual-save': '💾',
      'sync-push': '📤',
      'sync-pull': '📥',
      'major-edit': '✨',
      'checkpoint': '🔖',
    };
    return icons[trigger];
  };
  
  return (
    <div className="version-history-panel">
      <div className="panel-header">
        <h3>📜 版本历史</h3>
        <button onClick={onClose}>✕</button>
      </div>
      
      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        <div className="version-list">
          {versions.length === 0 ? (
            <div className="empty">暂无版本历史</div>
          ) : (
            versions.map(version => (
              <div
                key={version.id}
                className={`version-item ${selectedVersion === version.id ? 'selected' : ''}`}
                onClick={() => setSelectedVersion(version.id)}
              >
                <div className="version-header">
                  <span className="version-icon">
                    {getTriggerIcon(version.triggerType)}
                  </span>
                  <span className="version-time">
                    {format(version.timestamp, 'yyyy-MM-dd HH:mm:ss')}
                  </span>
                  <span className={`version-badge ${version.triggerType}`}>
                    {getTriggerLabel(version.triggerType)}
                  </span>
                </div>
                
                <div className="version-summary">
                  {version.changesSummary}
                </div>
                
                <div className="version-actions">
                  <button
                    className="btn-preview"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePreview(version.id);
                    }}
                  >
                    👁️ 预览
                  </button>
                  <button
                    className="btn-restore"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRestore(version.id);
                    }}
                  >
                    ↩️ 恢复
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
};
```

### 6.6 存储优化

```typescript
// services/versionStorage.ts

export class VersionStorageOptimizer {
  // 存储策略：
  // - 最近 10 个版本：完整快照（快速恢复）
  // - 11-50 个版本：仅存储 diff（节省空间）
  // - 50+ 个版本：每 10 个保留 1 个完整快照，其他删除
  
  async optimizeVersions(timelogId: string) {
    const timelog = await db.timelogs.findById(timelogId);
    const versions = timelog.versions;
    
    if (versions.length <= 10) {
      console.log('版本数量较少，无需优化');
      return;
    }
    
    console.log(`🔧 开始优化版本存储: ${versions.length} 个版本`);
    
    const optimized: EventLogVersion[] = [];
    
    versions.forEach((version, index) => {
      const age = versions.length - index;
      
      if (age <= 10) {
        // 最近 10 个：保留完整快照
        optimized.push(version);
      } else if (age <= 50) {
        // 11-50 个：只保留 diff
        optimized.push({
          ...version,
          content: null as any, // 移除完整内容
          diff: this.calculateDiff(
            versions[index - 1]?.content,
            version.content
          ),
        });
      } else if (age % 10 === 0) {
        // 50+ 个：每 10 个保留一个完整快照
        optimized.push(version);
      }
      // 其他的直接丢弃
    });
    
    await db.timelogs.update(timelogId, {
      versions: optimized,
    });
    
    console.log(`✅ 版本优化完成：${versions.length} → ${optimized.length}`);
  }
  
  // 从 diff 重建内容
  async reconstructContent(
    timelogId: string,
    versionId: string
  ): Promise<Descendant[]> {
    const timelog = await db.timelogs.findById(timelogId);
    const targetIndex = timelog.versions.findIndex(v => v.id === versionId);
    
    if (targetIndex === -1) {
      throw new Error('版本不存在');
    }
    
    const targetVersion = timelog.versions[targetIndex];
    
    // 如果有完整内容，直接返回
    if (targetVersion.content) {
      return targetVersion.content;
    }
    
    // 否则，从最近的完整快照开始，依次应用 diff
    let baseIndex = targetIndex;
    while (baseIndex >= 0 && !timelog.versions[baseIndex].content) {
      baseIndex--;
    }
    
    if (baseIndex < 0) {
      throw new Error('找不到基础快照');
    }
    
    let content = timelog.versions[baseIndex].content;
    
    // 应用每个 diff
    for (let i = baseIndex + 1; i <= targetIndex; i++) {
      const diff = timelog.versions[i].diff;
      if (diff) {
        content = this.applyDiff(content, diff);
      }
    }
    
    return content;
  }
  
  private calculateDiff(
    oldContent: Descendant[] | undefined,
    newContent: Descendant[]
  ): Delta | null {
    if (!oldContent) return null;
    
    const oldStr = JSON.stringify(oldContent);
    const newStr = JSON.stringify(newContent);
    
    if (oldStr === newStr) return null;
    
    // TODO: 实现精确的 diff 算法
    return {
      added: [],
      removed: [],
      modified: [],
    };
  }
  
  private applyDiff(content: Descendant[], diff: Delta): Descendant[] {
    // TODO: 实现 diff 应用逻辑
    return content;
  }
}
```

### 6.7 与同步集成

```typescript
// sync/syncEngine.ts (扩展版本)

export class SyncEngine {
  private versionControl: Map<string, VersionControlService> = new Map();
  
  async syncEvent(eventId: string) {
    const localEvent = await db.events.findById(eventId);
    
    // 获取或创建版本控制服务
    if (!this.versionControl.has(localEvent.eventlogId)) {
      this.versionControl.set(
        localEvent.eventlogId,
        new VersionControlService(localEvent.eventlogId)
      );
    }
    const vc = this.versionControl.get(localEvent.eventlogId)!;
    
    // 同步前创建检查点
    await vc.createVersion('sync-push');
    
    const remoteEvent = await outlookApi.getEvent(eventId);
    const conflict = detectConflict(
      localEvent.eventlog.content,
      remoteEvent.body.content,
      localEvent.syncState
    );
    
    let result;
    switch (conflict) {
      case 'local-changed':
        result = await this.pushToOutlook(localEvent, remoteEvent);
        break;
        
      case 'remote-changed':
        result = await this.pullFromOutlook(localEvent, remoteEvent);
        // 同步后创建检查点
        await vc.createVersion('sync-pull');
        break;
        
      case 'both-changed':
        result = await this.resolveConflict(localEvent, remoteEvent);
        await vc.createVersion('sync-pull');
        break;
        
      default:
        result = { status: 'synced' };
    }
    
    return result;
  }
}
```

## 7. 实现指南

### 7.1 开发顺序

**Phase 1: 基础功能（Week 1-2）**

- ✅ 实现 Slate 编辑器基础配置
- ✅ 实现 slateToHtml 转换器
- ✅ 实现 slateToPlainText 转换器
- ✅ 实现基础的数据存储（MongoDB/SQLite）

**Phase 2: 同步功能（Week 3-4）**

- ✅ 实现 Outlook API 认证
- ✅ 实现 SyncEngine 核心逻辑
- ✅ 实现冲突检测和解决
- ✅ 实现附件上传/下载

**Phase 3: 版本控制（Week 5-6）**

- ✅ 实现 VersionControlService
- ✅ 实现自动保存机制
- ✅ 实现版本历史 UI
- ✅ 实现版本恢复功能

**Phase 4: 优化和测试（Week 7-8）**

- ✅ 实现存储优化
- ✅ 实现离线支持
- ✅ 性能优化
- ✅ 端到端测试

### 7.2 数据存储架构

**🆕 架构决策（2025-11-13）:**

- **TimeLog 设计**: 嵌入式（Event.eventlog 字段），不创建独立表
- **版本存储**: Event.eventlog.versions 数组（最多保留 50 个）
- **归档策略**: 50+ 版本时可选迁移到单独的 localStorage key

#### 7.2.1 当前实现：localStorage + JSON 数组

**存储引擎**: localStorage（浏览器原生 API）

**理由**：
1. ✅ 简单、无依赖、跨平台兼容
2. ✅ 当前数据量小（<1000 events），性能足够
3. ✅ 已有 PersistentStorage 工具类封装（TagService 使用）
4. ✅ 符合 Electron 小型应用最佳实践

**限制**：
- ⚠️ localStorage 限制 5-10MB（约 5000 events）
- ⚠️ 需手动实现跨标签页同步（BroadcastChannel）
- ⚠️ 无事务保证（需自行实现乐观锁）
- ⚠️ 查询性能受限（内存遍历 Array.filter()）

**数据结构设计:**
```typescript
// STORAGE_KEYS.EVENTS 存储格式
// localStorage.getItem('remarkable-events') → JSON Array
[
  {
    id: "evt_123",
    title: "完成设计稿",                          // 纯文本（Outlook subject）
    titleContent: "<p>完成 <span>...</span></p>",  // 富文本 HTML（本地编辑）
    startTime: "2025-11-13T10:00:00Z",             // UTC ISO 8601（派生字段）
    endTime: "2025-11-13T11:00:00Z",               // UTC ISO 8601（派生字段）
    timeSpec: {                                     // 权威时间来源
      kind: "fixed",
      source: "user",
      start: "2025-11-13T10:00:00Z",               // Date → UTC string
      end: "2025-11-13T11:00:00Z",
      allDay: false
    },
    tags: ["design", "work"],                      // 从 titleContent 提取
    description: "<p>讨论了...</p>",               // 富文本 HTML（Outlook body）
    eventlog: "[{\"type\":\"paragraph\",...}]",     // Slate JSON 字符串
    
    // 同步状态（嵌入）
    syncState: {
      lastSyncedAt: "2025-11-13T10:00:00Z",
      contentHash: "abc123",
      status: "synced",
      outlookId: "AAMkAGI..."
    }
  }
]
```

**版本历史存储（可选，单独 key）**:
```typescript
// STORAGE_KEYS.EVENT_VERSIONS
// localStorage.getItem('remarkable-event-versions') → JSON Object
{
  "evt_123": [
    { 
      id: "v1", 
      createdAt: "2025-11-13T10:00:00Z",      // TimeHub.formatTimestamp()
      content: [{...}],                        // Slate JSON（完整快照）
      changesSummary: "初始版本"
    },
    { 
      id: "v2", 
      createdAt: "2025-11-13T10:05:00Z",
      diff: { added: [...], removed: [...] }, // Delta（差异）
      changesSummary: "添加表格"
    }
  ],
  "evt_456": [...]
}
```

**其他 localStorage 存储**:
```typescript
// 标签数据（已实现）
STORAGE_KEYS.HIERARCHICAL_TAGS: HierarchicalTag[]

// 日历缓存（已实现）
STORAGE_KEYS.CALENDAR_GROUPS_CACHE: CalendarGroup[]
STORAGE_KEYS.CALENDARS_CACHE: Calendar[]
STORAGE_KEYS.TODO_LISTS_CACHE: TodoList[]

// 联系人数据（已实现）
STORAGE_KEYS.CONTACTS: Contact[]

// 同步队列（待实现）
STORAGE_KEYS.SYNC_QUEUE: { eventId: string, operation: string, timestamp: string }[]
```

**跨标签页同步**:
```typescript
// EventService 已实现 BroadcastChannel
const broadcastChannel = new BroadcastChannel('remarkable-events');

// 发送更新通知
broadcastChannel.postMessage({ type: 'events-updated', eventIds: [...] });

// 监听其他标签页的更新
broadcastChannel.onmessage = (event) => {
  if (event.data.type === 'events-updated') {
    // 重新加载 events
    this.notifyListeners();
  }
};
```

#### 7.2.2 未来迁移路径（Phase 2/3）

**Phase 2: 引入 SQLite（可选）**

**场景**: 数据量增长（>1000 events）或需要复杂查询

**技术栈**:
- `better-sqlite3`: Node.js SQLite 绑定（性能最优）
- `electron-store`: Electron 配置管理（可选）

**SQLite 设计示例**:
```sql
-- 主表（内联基础字段）
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  title_content TEXT,        -- 富文本 HTML
  start_time TEXT NOT NULL,  -- UTC ISO 8601
  end_time TEXT NOT NULL,
  timespec TEXT NOT NULL,    -- TimeSpec JSON
  tags TEXT,                 -- JSON array: ["tag1", "tag2"]
  description TEXT,          -- 富文本 HTML
  timelog TEXT,              -- Slate JSON 字符串
  
  -- 同步状态
  sync_status TEXT DEFAULT 'pending',
  sync_hash TEXT,
  synced_at TEXT,
  outlook_id TEXT UNIQUE,
  
  -- 元数据
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- 索引策略
CREATE INDEX idx_events_start_time ON events(start_time);
CREATE INDEX idx_events_sync_status ON events(sync_status);
CREATE INDEX idx_events_outlook_id ON events(outlook_id);
CREATE INDEX idx_events_tags ON events(tags);  -- JSON 索引（SQLite 3.38+）

-- 全文搜索索引
CREATE VIRTUAL TABLE events_fts USING fts5(
  title, description, timelog, 
  content='events', content_rowid='rowid'
);

-- 辅助表（版本历史归档）
CREATE TABLE event_versions (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  content TEXT NOT NULL,       -- Slate JSON 完整快照
  diff TEXT,                   -- Delta JSON（可选）
  changes_summary TEXT,
  
  UNIQUE(event_id, version_number)
);

CREATE INDEX idx_versions_event_id ON event_versions(event_id);
```

**迁移脚本**:
```typescript
// 从 localStorage 迁移到 SQLite
async function migrateToSQLite() {
  const db = new Database('remarkable.db');
  const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
  
  const insert = db.prepare(`
    INSERT INTO events (id, title, title_content, start_time, ...)
    VALUES (?, ?, ?, ?, ...)
  `);
  
  const insertMany = db.transaction((events) => {
    for (const event of events) {
      insert.run(
        event.id,
        event.title,
        event.titleContent,
        event.startTime,
        // ...
        JSON.stringify(event.timeSpec),
        JSON.stringify(event.tags)
      );
    }
  });
  
  insertMany(events);
  console.log(`✅ 迁移完成：${events.length} 个事件`);
}
```

**Phase 3: 支持 MongoDB（云端备份）**

**场景**: 多设备同步、协作编辑、云端备份

**技术栈**:
- MongoDB Atlas（云服务）
- MongoDB Realm（移动端同步）

**MongoDB 设计示例**:
```javascript
// events 集合
{
  _id: ObjectId("..."),
  id: "evt_123",               // ReMarkable UUID
  title: "完成设计稿",
  titleContent: "<p>...</p>",
  startTime: ISODate("2025-11-13T10:00:00Z"),
  endTime: ISODate("2025-11-13T11:00:00Z"),
  timeSpec: {
    kind: "fixed",
    start: ISODate("..."),
    end: ISODate("..."),
    // ...
  },
  tags: ["design", "work"],
  description: "<p>...</p>",
  eventlog: [{                  // Slate JSON（嵌入文档）
    type: "paragraph",
    children: [...]
  }],
  syncState: {
    lastSyncedAt: ISODate("..."),
    contentHash: "abc123",
    outlookId: "AAMkAGI..."
  },
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}

// 索引策略
db.events.createIndex({ id: 1 }, { unique: true });
db.events.createIndex({ startTime: 1 });
db.events.createIndex({ tags: 1 });
db.events.createIndex({ "syncState.outlookId": 1 });
db.events.createIndex({ "$**": "text" });  // 全文搜索

// 版本历史集合（单独存储）
db.event_versions.createIndex({ eventId: 1, versionNumber: -1 });
```

#### 7.2.3 性能优化建议

**当前架构（localStorage）优化**:

1. **分离冷热数据**:
   ```typescript
   // 活跃事件（最近 30 天）
   STORAGE_KEYS.EVENTS: Event[]  // ~500 events, ~2MB
   
   // 归档事件（30+ 天前）
   STORAGE_KEYS.ARCHIVED_EVENTS: Event[]  // ~4500 events, ~18MB
   ```

2. **延迟加载版本历史**:
   ```typescript
   // 主数据不包含 versions
   // 需要时才从 EVENT_VERSIONS 加载
   async loadVersions(eventId: string) {
     const allVersions = JSON.parse(
       localStorage.getItem('remarkable-event-versions') || '{}'
     );
     return allVersions[eventId] || [];
   }
   ```

3. **定期清理归档数据**:
   ```typescript
   // 保留最近 1 年，删除更早的数据
   function cleanupOldEvents() {
     const oneYearAgo = new Date();
     oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
     
     const events = EventService.getAllEvents();
     const recentEvents = events.filter(e => 
       new Date(e.startTime) > oneYearAgo
     );
     
     localStorage.setItem('remarkable-events', JSON.stringify(recentEvents));
   }
   ```

4. **监控存储使用量**:
   ```typescript
   function getStorageUsage(): { used: number, quota: number } {
     if (navigator.storage && navigator.storage.estimate) {
       return await navigator.storage.estimate();
     }
     // Fallback: 估算 localStorage 大小
     let total = 0;
     for (let key in localStorage) {
       total += localStorage[key].length + key.length;
     }
     return { used: total, quota: 10 * 1024 * 1024 };  // 假设 10MB 限制
   }
   
   // 超过 5MB 时提示用户
   if (usage.used > 5 * 1024 * 1024) {
     console.warn('⚠️ 存储空间接近限制，建议清理归档数据');
   }
   ```

**附件存储:**

- 本地缓存：`app.getPath('userData')/attachments/`
- 云存储：OneDrive（与 Outlook 集成更好）

**同步频率:**

- 手动同步：用户点击"同步"按钮
- 自动同步：每 15 分钟检查一次
- 实时同步：使用 Microsoft Graph Webhooks（未来功能）

### 7.3 错误处理

```typescript
// utils/errorHandler.ts

export class SyncError extends Error {
  constructor(
    message: string,
    public code: string,
    public retryable: boolean = true
  ) {
    super(message);
    this.name = 'SyncError';
  }
}

export const handleSyncError = (error: any): SyncError => {
  // 网络错误
  if (error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
    return new SyncError('网络连接失败', 'NETWORK_ERROR', true);
  }
  
  // 认证错误
  if (error.statusCode === 401) {
    return new SyncError('认证失败，请重新登录', 'AUTH_ERROR', false);
  }
  
  // 限流错误
  if (error.statusCode === 429) {
    return new SyncError('请求过于频繁，请稍后再试', 'RATE_LIMIT', true);
  }
  
  // 服务器错误
  if (error.statusCode >= 500) {
    return new SyncError('服务器错误', 'SERVER_ERROR', true);
  }
  
  // 未知错误
  return new SyncError(error.message || '未知错误', 'UNKNOWN_ERROR', true);
};
```

## 8. 性能优化

### 8.1 延迟加载

```typescript
// 版本历史不要一次性全部加载
async loadVersions(eventId: string, limit: number = 20, offset: number = 0) {
  const event = await EventService.getEventById(eventId);
  if (!event?.eventlog?.versions) {
    return { versions: [], total: 0, hasMore: false };
  }
  const versions = event.eventlog.versions;
  const total = versions.length;
  const sliced = versions
    .slice(Math.max(0, total - offset - limit), total - offset)
    .reverse();
  
  return {
    versions: sliced,
    total,
    hasMore: offset + limit < total,
  };
}
```

### 8.2 缓存策略

```typescript
// 使用 IndexedDB 缓存版本  
import { openDB } from 'idb';  

const versionCache = await openDB('remarkable-versions', 1, {  
  upgrade(db) {  
    db.createObjectStore('versions', { keyPath: 'id' });  
  }  
});
```

---

## 9. 技术栈

- **编辑器**: Slate.js
- **UI 框架**: React + TypeScript
- **状态管理**: Zustand / Redux Toolkit
- **时间管理**: TimeHub + TimeSpec（见 [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md)）
- **活动监听**: active-win（桌面端）+ 自定义 ActivityService
- **数据库**: SQLite (开发) / MongoDB (生产)
- **同步 API**: Microsoft Graph API
- **附件存储**: OneDrive API
- **版本控制**: 自定义实现（基于 diff-match-patch）
- **日期处理**: date-fns
- **测试**: Jest + React Testing Library
- **端到端测试**: Playwright

---

## 10. 时间架构集成总结

### 10.1 核心原则重申

**🚫 绝对禁止的做法：**

```typescript
// ❌ 错误 1: 使用 ISO 字符串
const marker = {
  timestamp: new Date().toISOString(), // 禁止！
};

// ❌ 错误 2: 直接操作 Date 对象
event.startTime = new Date();

// ❌ 错误 3: 手动计算时间窗口
const nextWeek = new Date();
nextWeek.setDate(nextWeek.getDate() + 7);
```

**✅ 正确的做法：**

```typescript
// ✅ 正确 1: 使用 TimeHub 创建 TimeSpec
const timeSpec: TimeSpec = {
  kind: 'fixed',
  source: 'system',
  rawText: null,
  policy: TimePolicy.getDefault(),
  resolved: { start: now, end: now },
  start: now,
  end: now,
  allDay: false,
};

// ✅ 正确 2: 通过 TimeHub 更新事件时间
TimeHub.setEventTime(eventId, 'fixed', {
  start: now,
  end: now,
});

// ✅ 正确 3: 使用 TimeParsingService 解析自然语言
TimeHub.setFuzzy(eventId, '下周一 10:00', {
  policy: { weekStart: 1 }
});

// ✅ 正确 4: 使用 useEventTime Hook 读取时间
const { timeSpec, start, end, allDay } = useEventTime(eventId);
```

### 10.2 情境标记（ContextMarker）的时间处理

```typescript
// 创建情境标记时的正确做法
const createContextMarkerWithTimeHub = async (activities: ActivitySpan[]) => {
  const now = new Date();
  
  // 1. 创建符合 TimeSpec 规范的时间对象
  const timeSpec: TimeSpec = {
    kind: 'fixed',
    source: 'system',
    rawText: null,
    policy: TimePolicy.getDefault(),
    resolved: { start: now, end: now },
    start: now,
    end: now,
    allDay: false,
  };
  
  // 2. 创建 ContextMarkerElement
  const marker: ContextMarkerElement = {
    type: 'context-marker',
    timeSpec,
    activities,
    children: [{ text: '' }],
  };
  
  return marker;
};

// 渲染时读取 TimeSpec
const TimeDisplay: React.FC<{ timeSpec: TimeSpec }> = ({ timeSpec }) => {
  const { start } = timeSpec.resolved;
  
  return (
    <span className="text-xs text-gray-500 font-mono">
      {start.toLocaleTimeString('zh-CN', { 
        hour: '2-digit', 
        minute: '2-digit',
        hour12: false 
      })}
    </span>
  );
};
```

### 10.3 版本控制的时间处理

```typescript
// 版本快照创建时的时间处理
class VersionControlService {
  async createVersion(trigger: VersionTriggerType): Promise<EventLogVersion> {
    const timelog = await db.timelogs.findById(this.timelogId);
    
    // timestamp 字段使用 Date 对象（内部处理）
    // 但内容中的 ContextMarker 都包含完整的 TimeSpec
    const version: EventLogVersion = {
      id: uuidv4(),
      timestamp: new Date(), // 版本创建时间（内部使用）
      content: timelog.content, // 包含带 TimeSpec 的 ContextMarker
      triggerType: trigger,
      changesSummary: this.generateChangesSummary(this.pendingOperations),
      contentHash: this.hashContent(timelog.content),
    };
    
    await db.versions.insert(version);
    return version;
  }
}
```

### 10.4 同步时的时间处理

```typescript
// 同步到 Outlook 时的序列化
const serializeContextMarker = (marker: ContextMarkerElement): string => {
  const { timeSpec, activities } = marker;
  const { start } = timeSpec.resolved;
  
  // 🎯 使用 TimeHub 格式化时间显示
  const timeStr = TimeHub.formatRelativeTime(start);  // "14:30" 或 "2小时前"
  
  // 活动摘要
  const activityStr = activities
    .map(a => `${a.appName} (${formatDuration(a.duration)})`)
    .join(', ');
  
  // 生成 HTML（用于 Outlook）
  // ✅ 策略：在 data-timespec 中嵌入完整 TimeSpec JSON
  // 好处：往返同步时不丢失 kind/rawText/policy 等元数据
  const timeSpecJson = JSON.stringify({
    ...marker.timeSpec,
    // 🎯 使用 TimeHub 格式化 Date 对象为 UTC 字符串
    start: TimeHub.formatTimestamp(timeSpec.start),
    end: TimeHub.formatTimestamp(timeSpec.end),
    resolved: {
      start: TimeHub.formatTimestamp(timeSpec.resolved.start),
      end: TimeHub.formatTimestamp(timeSpec.resolved.end),
    }
  });
  
  return `
    <div class="context-marker" data-timespec="${escapeHTML(timeSpecJson)}">
      <strong>${timeStr}</strong>
      <p>活动: ${activityStr}</p>
    </div>
  `;
};

// 从 Outlook 反序列化时
const deserializeContextMarker = (html: string): ContextMarkerElement | null => {
  const div = parseHTML(html);
  const timeSpecJson = div.getAttribute('data-timespec');
  
  if (!timeSpecJson) {
    console.warn('缺失 data-timespec 属性，无法还原 ContextMarker');
    return null;
  }
  
  try {
    // 解析 JSON
    const timeSpecData = JSON.parse(timeSpecJson);
    
    // 🎯 使用 TimeHub 解析 UTC 字符串为 Date 对象
    const timeSpec: TimeSpec = {
      ...timeSpecData,
      start: TimeHub.parseTimestamp(timeSpecData.start),
      end: TimeHub.parseTimestamp(timeSpecData.end),
      resolved: {
        start: TimeHub.parseTimestamp(timeSpecData.resolved.start),
        end: TimeHub.parseTimestamp(timeSpecData.resolved.end),
      },
    };
    
    return {
      type: 'context-marker',
      timeSpec,
      activities: parseActivitiesFromHTML(div),
      children: [{ text: '' }],
    };
  } catch (error) {
    console.error('解析 TimeSpec 失败:', error);
    return null;
  }
};

/**
 * ⚠️ 关键设计决策：为什么在 HTML 中嵌入 TimeSpec JSON？
 * 
 * **问题**: Outlook 的 body.content 是 HTML，如何保留 TimeSpec 的元数据？
 * 
 * **方案对比**:
 * 
 * ❌ 方案 A: 只存储 ISO 时间戳
 * ```html
 * <div data-time="2025-11-13T10:30:00Z">
 * ```
 * 缺点：往返同步时丢失 kind('fuzzy'), rawText('下周'), policy 等信息
 * 
 * ✅ 方案 B: 嵌入完整 TimeSpec JSON (当前方案)
 * ```html
 * <div data-timespec='{"kind":"fuzzy","rawText":"下周",...}'>
 * ```
 * 优点：
 * - 保留所有元数据（kind, rawText, policy）
 * - 往返同步无损
 * - 符合 Time Architecture 原则
 * 
 * **Outlook 兼容性测试结果**:
 * - ✅ Outlook Desktop (Windows/Mac): 保留 data-* 属性
 * - ✅ Outlook Web: 保留 data-* 属性
 * - ⚠️ Outlook Mobile: 可能被过滤（降级为 kind='fixed'）
 * 
 * **降级策略**:
 * 如果 data-timespec 丢失，使用显示文本中的时间创建简单 TimeSpec：
 * ```typescript
 * const fallbackTimeSpec: TimeSpec = {
 *   kind: 'fixed',
 *   source: 'import',
 *   start: TimeHub.parseTimestamp(extractTimeFromText(div.textContent)),
 *   // ...
 * };
 * ```
 */
```

### 10.5 迁移清单

如果在代码中发现以下模式，需要立即修正：

- [ ] `timestamp: string` → `timeSpec: TimeSpec`
- [ ] `new Date().toISOString()` → `TimeHub.setEventTime()` 或创建 `TimeSpec` 对象
- [ ] 直接修改 `event.startTime` → 使用 `TimeHub.setEventTime(eventId, ...)`
- [ ] 手动解析日期字符串 → 使用 `TimeParsingService.parse()`
- [ ] 手动计算时间窗口 → 使用 `TimeSpec.window` 和 `policy`
- [ ] 直接读取 `event.startTime` → 使用 `useEventTime(eventId)` Hook

### 10.6 相关文档

- **[TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md)** - 统一时间架构完整说明
- **[技术规格文档：情境感知时间轴编辑器](./_archive/legacy-docs/features/技术规格文档：情境感知时间轴编辑器.md)** - 原始设计文档（已整合）
- **src/services/TimeHub.ts** - 时间中枢实现
- **src/hooks/useEventTime.ts** - React Hook 实现
- **src/services/TimeParsingService.ts** - 时间解析服务
- **src/services/ActivityService.ts** - 活动监听服务（待实现）

---

## 11. 开发路线图

### Phase 1: 基础 TimeLog 系统（2 周）
- ✅ Slate 编辑器基础配置
- ✅ 基本数据结构（使用 TimeSpec）
- ✅ HTML/纯文本序列化器
- ✅ 本地存储（SQLite）

### Phase 2: 情境感知功能（2 周）
- 🔄 实现 DesktopActivityService（应用监听）
- 🔄 实现自动 ContextMarker 注入逻辑
- 🔄 实现时间轴和活动轴渲染
- 🔄 集成 TimeHub 进行时间管理

### Phase 3: 同步功能（2 周）
- ⏳ Outlook API 认证
- ⏳ SyncEngine 核心逻辑
- ⏳ 冲突检测和解决
- ⏳ 附件上传/下载

### Phase 4: 版本控制（2 周）
- ⏳ VersionControlService 实现
- ⏳ 自动保存机制
- ⏳ 版本历史 UI
- ⏳ 版本恢复功能

### Phase 5: 优化和测试（2 周）
- ⏳ 存储优化（版本压缩）
- ⏳ 离线支持（同步队列）
- ⏳ 性能优化（缓存、懒加载）
- ⏳ 端到端测试

---

## 12. 代码实现状态

### 12.1 核心类型定义

**✅ 已实现** - `src/types.ts` 和 `src/utils/holidays/types.ts`

```typescript
interface Event {
  // ... 其他字段
  
  // 🆕 v1.8: Rich-text description support
  eventlog?: string;     // 富文本日志（HTML 格式，ReMarkable 内部展示用，支持标签、图片等）
  
  // 🆕 Issue #12: Timer ↔ Plan 集成
  parentEventId?: string;   // 父事件 ID（用于 Timer 子事件关联）
  timerLogs?: string[];     // 计时日志（子 Timer 事件 ID 列表）
}
```

**说明**：
- 当前代码使用简化版 `eventlog?: string` 字段（HTML 字符串）
- PRD 定义的完整版本是对象结构：`eventlog?: { content, descriptionHtml, versions, ... }`
- 迁移计划：Phase 1 完成后逐步升级到完整对象结构

### 12.2 序列化层实现

**✅ 已实现** - `src/components/UnifiedSlateEditor/serialization.ts`

**功能**：
- `planItemsToSlateNodes()` - 将 Event 数组转换为 Slate 编辑器节点
  - 优先使用 `item.eventlog`（富文本），回退到 `item.description`（纯文本）
  - 支持 Title 行和 Description 行的双行模式
  
- `slateNodesToPlanItems()` - 将 Slate 节点转换回 Event 数组
  - Description 行同时保存到 `eventlog`（HTML）和 `description`（纯文本）
  - 实现双向同步策略，保持两个字段一致

**代码示例**：
```typescript
// 读取时：优先使用 eventlog
const descriptionContent = item.eventlog || item.description;

// 保存时：同时更新两个字段
item.eventlog = newEventlog;      // 富文本 HTML
item.description = newDescription; // 纯文本
```

### 12.3 架构文档

**✅ 已更新** - `docs/TIMELOG_ARCHITECTURE.md`

记录了当前 `eventlog` 字段的使用场景：
- 数据流图展示 `eventlog` 的存储和同步策略
- 代码示例说明如何读写 `eventlog` 字段
- 与 Outlook `description` 的同步关系

### 12.4 待迁移项

**⏳ 计划中** - 从简化版升级到完整对象结构

```typescript
// 当前实现（简化版）
interface Event {
  eventlog?: string;  // HTML 字符串
}

// 目标实现（完整版 - PRD Section 4.1）
interface Event {
  eventlog?: {
    content: Descendant[];           // Slate JSON（主存储）
    descriptionHtml: string;         // 简化 HTML（Outlook 同步）
    descriptionPlainText: string;    // 纯文本（搜索）
    attachments?: Attachment[];      // 媒体附件
    versions?: EventLogVersion[];    // 版本历史
    syncState?: SyncState;           // 同步状态
    createdAt?: Date;
    updatedAt?: Date;
  };
}
```

**迁移步骤**：
1. ✅ 更新类型定义中的字段名（`timelog` → `eventlog`）
2. ✅ 更新序列化层代码使用 `eventlog` 字段
3. ⏳ 实现对象结构的序列化/反序列化
4. ⏳ 添加版本控制支持
5. ⏳ 实现 Outlook 同步逻辑

### 12.5 命名规范总结

**✅ 统一规范**（2025-11-13 更新）：

| 层级 | 命名 | 说明 |
|------|------|------|
| **页面/功能** | TimeLog | 页面名称、功能模块名称 |
| **数据字段** | eventlog | Event 接口中的日志记录字段 |
| **类型定义** | EventLogVersion | 版本历史类型 |
| **UI 状态** | EventLogVisibility | 可见性状态管理 |

**示例**：
- `TimeLog 页面` - 用户访问的页面
- `Event.eventlog` - 数据模型中的字段
- `EventLogVersion[]` - 版本历史数组
- `docs/PRD/TimeLog_&_Description_PRD.md` - 文档名称

---

**文档结束**
