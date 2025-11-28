# PlanSlateEditor 独有功能全量分析

**文档版本**: v1.0  
**最后更新**: 2025-11-28  
**编写目的**: 梳理 PlanSlateEditor 独有且需要保留的功能，为 SlateCore 共享层重构提供依据

---

## 📋 目录

1. [核心架构特性](#1-核心架构特性)
2. [EventLine 双模式架构](#2-eventline-双模式架构)
3. [多事件管理能力](#3-多事件管理能力)
4. [Checkbox 集成系统](#4-checkbox-集成系统)
5. [元数据透传机制](#5-元数据透传机制)
6. [序列化系统](#6-序列化系统)
7. [可视化状态系统](#7-可视化状态系统)
8. [与 PlanManager 的深度集成](#8-与-planmanager-的深度集成)
9. [功能对比总结](#9-功能对比总结)

---

## 1. 核心架构特性

### 1.1 EventLine 节点架构

**独有特性**: PlanSlate 使用 `event-line` 作为顶层节点，支持双模式（title/eventlog）

```typescript
interface EventLineNode {
  type: 'event-line';
  eventId?: string;        // 关联的 Event ID
  lineId: string;          // 行唯一ID（用于编辑器内部定位）
  level: number;           // 缩进层级 (0, 1, 2, ...)
  mode: 'title' | 'eventlog';  // ✅ 独有：双模式切换
  children: ParagraphNode[];
  metadata?: EventMetadata;     // ✅ 独有：完整元数据透传
}
```

**与 Slate 对比**:
- **PlanSlate**: `event-line` → `paragraph[]`（两层结构，支持模式切换）
- **Slate**: `paragraph[]`（扁平结构，无模式概念）

**用途**: 
- `title` 模式：事件标题行，显示 checkbox、emoji、时间、标签等
- `eventlog` 模式：实际进展内容，支持 bullet、缩进、timestamp

---

## 2. EventLine 双模式架构

### 2.1 Title 模式（标题行）

**显示元素**:
- ✅ **EventLinePrefix**（左侧装饰）:
  - Checkbox（根据 `checkType` 显示）
  - Emoji
  - 状态标签（New/Updated/Done/Missed/Del）
  
- ✅ **EventLineSuffix**（右侧装饰）:
  - 时间显示（startTime/endTime）
  - More 图标（打开 EventEditModal）
  - 标签列表

**特有样式**:
```css
.unified-event-line {
  min-height: 32px;  /* 标题行较高 */
  align-items: center;  /* 垂直居中对齐 */
}
```

### 2.2 Eventlog 模式（内容行）

**显示元素**:
- ❌ 不显示 EventLinePrefix（无 checkbox、emoji）
- ❌ 不显示 EventLineSuffix（无时间、标签）
- ✅ 支持 Bullet 列表（缩进层级 0-4）
- ✅ 支持 Timestamp 自动插入（⚠️ **需要外部传递 `enableTimestamp` 和 `eventId` props**）
- ✅ 支持多段落（每个段落独立一个 EventLineNode）

**⚠️ Timestamp 显示控制**（由外部 props 决定）:
- **显示 Timestamp 的场景**:
  - EventEditModal 的 eventlog 编辑区域（传递 `enableTimestamp={true}` 和 `eventId={event.id}`）
  - TimeLog 页面（待开发，传递相同 props）
  
- **不显示 Timestamp 的场景**:
  - PlanManager 的 eventlog 编辑（未传递 `enableTimestamp` 和 `eventId` props）
  - 原因：PlanManager 用于快速记录和管理，不需要详细的时间戳分隔
  
- **启用条件**: `hasTextInsertion && enableTimestamp && eventId`（三个条件缺一不可）
- **注意**: PlanManager 可以使用 Shift+Enter 进入 eventlog 模式编辑内容，只是不显示 timestamp

**特有样式**:
```css
.unified-event-line.eventlog-mode {
  min-height: 20px;  /* eventlog 行较紧凑 */
  align-items: flex-start;  /* 顶部对齐 */
  padding-left: calc((level + 1) * 24px);  /* eventlog 额外缩进 1 级 */
}
```

### 2.3 模式切换快捷键

**Shift+Enter**: 在 title 行按下 → 创建 eventlog 行
**Shift+Tab**: 在 eventlog 行按下 → 转换为 title 行

```typescript
// PlanSlateEditor.tsx - handleKeyDown
if (event.key === 'Enter' && event.shiftKey) {
  event.preventDefault();
  
  // 创建新的 eventlog 行
  const newEventlogLine: EventLineNode = {
    type: 'event-line',
    eventId: currentEventId,
    lineId: `${currentEventId}-desc-${Date.now()}`,
    level: 0,
    mode: 'eventlog',  // ✅ 切换到 eventlog 模式
    children: [{ type: 'paragraph', children: [{ text: '' }] }],
    metadata: currentMetadata,
  };
  
  Transforms.insertNodes(editor, newEventlogLine);
}
```

---

## 3. 多事件管理能力

### 3.1 一个编辑器管理多个 Event

**独有特性**: PlanSlate 在同一个编辑器实例中管理多个独立事件

```typescript
// PlanManager 传递多个事件给编辑器
<PlanSlateEditor
  items={[
    { id: 'event-1', title: '会议', ... },
    { id: 'event-2', title: '写代码', ... },
    { id: 'event-3', title: '健身', ... },
  ]}
  onChange={(updatedItems) => { /* 批量保存 */ }}
/>
```

**与 Slate 对比**:
- **PlanSlate**: 多事件管理（PlanManager 页面显示事件列表）
- **Slate**: 单内容编辑（EventEditModal 只编辑一个事件的 eventlog）

### 3.2 事件分组与层级管理

**Level 字段作用**:
- `level=0`: 顶级事件（无缩进）
- `level=1,2,3...`: 子事件（缩进显示层级关系）

```typescript
// serialization.ts - planItemsToSlateNodes
const titleNode: EventLineNode = {
  type: 'event-line',
  eventId: item.eventId,
  lineId: item.id,
  level: item.level || 0,  // ✅ 保留层级信息
  mode: 'title',
  children: [/* ... */],
  metadata: extractedMetadata,
};
```

**视觉效果**:
```css
/* 根据 level 动态计算缩进 */
padding-left: calc(level * 24px);  /* title 行 */
padding-left: calc((level + 1) * 24px);  /* eventlog 行额外缩进 */
```

### 3.3 事件批量操作

**独有能力**: 跨事件选择、复制、粘贴、格式化

```typescript
// PlanSlateEditor 支持跨行选择
editor.selection = {
  anchor: { path: [0, 0, 0], offset: 5 },  // 第一个事件
  focus: { path: [3, 0, 0], offset: 10 },  // 第四个事件
};

// 一次性复制多个事件的内容
const fragment = Editor.fragment(editor, editor.selection);
```

---

## 4. Checkbox 集成系统

### 4.1 checkType 字段控制

**独有特性**: 使用 `checkType` 字段控制 checkbox 显示逻辑

```typescript
// EventMetadata 接口
interface EventMetadata {
  checkType?: 'none' | 'once' | 'recurring';
  checked?: string[];    // 签到时间戳数组
  unchecked?: string[];  // 取消签到时间戳数组
  // ...
}
```

**显示规则**:
- `checkType='once'`: 显示 checkbox（单次任务）
- `checkType='recurring'`: 显示 checkbox（循环任务）
- `checkType='none'` 或 `undefined`: 不显示 checkbox

### 4.2 EventLinePrefix 集成

**组件**: `EventLinePrefix.tsx`

```typescript
export const EventLinePrefix: React.FC<EventLinePrefixProps> = ({ element, onSave }) => {
  const metadata = element.metadata || {};
  const checkType = metadata.checkType;
  const showCheckbox = checkType === 'once' || checkType === 'recurring';
  
  // ✅ 直接从 metadata 计算 checked 状态
  const lastChecked = metadata.checked?.[metadata.checked.length - 1];
  const lastUnchecked = metadata.unchecked?.[metadata.unchecked.length - 1];
  const isCompleted = lastChecked && (!lastUnchecked || lastChecked > lastUnchecked);
  
  return (
    <div>
      {showCheckbox && (
        <input
          type="checkbox"
          checked={!!isCompleted}
          onChange={(e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
              EventService.checkIn(element.eventId);
            } else {
              EventService.uncheck(element.eventId);
            }
          }}
        />
      )}
      {/* Emoji、状态标签等 */}
    </div>
  );
};
```

### 4.3 Checkbox 状态同步

**数据流**:
```
用户点击 Checkbox
  ↓
EventService.checkIn/uncheck(eventId)
  ↓
更新 localStorage (checked/unchecked 数组)
  ↓
触发 window.eventsUpdated 事件
  ↓
PlanSlateEditor 监听事件
  ↓
更新 Slate metadata (checked/unchecked 数组)
  ↓
EventLinePrefix 重新渲染 ✅
```

**与 EventService 的强耦合**:
- PlanSlate 必须调用 `EventService.checkIn()` 来持久化状态
- Slate 不需要 checkbox 功能（EventEditModal 无签到需求）

---

## 5. 元数据透传机制

### 5.1 完整的 EventMetadata

**独有特性**: PlanSlate 在节点中保留完整的事件元数据，避免字段丢失

```typescript
interface EventMetadata {
  // 时间字段（20+ 字段）
  startTime?: string | null;
  endTime?: string | null;
  dueDate?: string | null;
  isAllDay?: boolean;
  timeSpec?: any;
  
  // 样式字段
  emoji?: string;
  color?: string;
  
  // 业务字段
  priority?: string;
  isCompleted?: boolean;
  isTask?: boolean;
  type?: string;
  checkType?: 'none' | 'once' | 'recurring';
  checked?: string[];
  unchecked?: string[];
  
  // Plan 相关
  isPlan?: boolean;
  isTimeCalendar?: boolean;
  
  // 同步字段
  calendarIds?: string[];
  todoListIds?: string[];
  source?: string;
  syncStatus?: string;
  externalId?: string;
  remarkableSource?: boolean;
  
  // 时间戳
  createdAt?: string;
  updatedAt?: string;
  
  // ✅ Snapshot 模式：已删除标记
  _isDeleted?: boolean;
  _deletedAt?: string;
  
  // 扩展字段（允许其他未列出的字段）
  [key: string]: any;
}
```

**透传流程**:
```typescript
// serialization.ts - planItemsToSlateNodes
const metadata: EventMetadata = {
  startTime: item.startTime,
  endTime: item.endTime,
  checkType: item.checkType || 'once',
  checked: item.checked || [],
  unchecked: item.unchecked || [],
  // ... 透传所有字段
};

const titleNode: EventLineNode = {
  type: 'event-line',
  metadata,  // ✅ 完整透传
  // ...
};
```

### 5.2 元数据用途

**EventLinePrefix** 使用元数据:
- `checkType`, `checked`, `unchecked` → Checkbox 显示与状态
- `emoji` → Emoji 显示
- `_isDeleted` → 删除线样式

**EventLineSuffix** 使用元数据:
- `startTime`, `endTime` → 时间显示
- `calendarIds` → 日历来源标识

**StatusLineContainer** 使用元数据:
- `_isDeleted`, `createdAt`, `updatedAt` → 状态竖线计算

**与 Slate 对比**:
- **PlanSlate**: 保留完整元数据，供多个组件使用
- **Slate**: 无需元数据（只编辑纯文本内容）

---

## 6. 序列化系统

### 6.1 PlanItem ↔ EventLine 双向转换

**独有特性**: PlanSlate 负责 PlanItem（EventService 数据格式）与 EventLine（Slate 节点）的转换

#### 6.1.1 planItemsToSlateNodes

**输入**: `PlanItem[]`（来自 EventService）
**输出**: `EventLineNode[]`（Slate 编辑器节点）

```typescript
export function planItemsToSlateNodes(items: any[]): EventLineNode[] {
  const nodes: EventLineNode[] = [];
  
  items.forEach(item => {
    // ✅ 1. 提取完整元数据
    const metadata: EventMetadata = {
      startTime: item.startTime,
      endTime: item.endTime,
      checkType: item.checkType || 'once',
      checked: item.checked || [],
      unchecked: item.unchecked || [],
      // ... 所有字段
    };
    
    // ✅ 2. Title 行（始终创建）
    const titleChildren = item.title?.fullTitle 
      ? JSON.parse(item.title.fullTitle) 
      : [{ text: '' }];
    
    const titleNode: EventLineNode = {
      type: 'event-line',
      eventId: item.eventId || item.id,
      lineId: item.id,
      level: item.level || 0,
      mode: 'title',
      children: [{ type: 'paragraph', children: titleChildren }],
      metadata,
    };
    nodes.push(titleNode);
    
    // ✅ 3. EventLog 行（只有 eventlog 存在时才创建）
    if (item.eventlog) {
      const eventlogContent = typeof item.eventlog === 'object' 
        ? item.eventlog.html || item.eventlog.plainText 
        : item.eventlog;
      
      const paragraphsWithLevel = parseHtmlToParagraphsWithLevel(eventlogContent);
      
      paragraphsWithLevel.forEach((pwl, index) => {
        const descNode: EventLineNode = {
          type: 'event-line',
          eventId: item.eventId || item.id,
          lineId: index === 0 ? `${item.id}-desc` : `${item.id}-desc-${Date.now()}-${index}`,
          level: pwl.level,  // ✅ 保留每个段落的层级
          mode: 'eventlog',
          children: [pwl.paragraph],
          metadata,
        };
        nodes.push(descNode);
      });
    }
  });
  
  return nodes;
}
```

#### 6.1.2 slateNodesToPlanItems

**输入**: `EventLineNode[]`（Slate 编辑器节点）
**输出**: `PlanItem[]`（供 EventService 保存）

```typescript
export function slateNodesToPlanItems(nodes: EventLineNode[]): any[] {
  const items: Map<string, any> = new Map();
  
  nodes.forEach(node => {
    const baseId = node.eventId;
    
    if (!items.has(baseId)) {
      // ✅ 从 metadata 提取所有字段
      const metadata = node.metadata || {};
      
      items.set(baseId, {
        id: baseId,
        eventId: node.eventId,
        level: node.level,
        title: '',
        eventlog: '',
        startTime: metadata.startTime,
        endTime: metadata.endTime,
        checkType: metadata.checkType || 'once',
        checked: metadata.checked || [],
        unchecked: metadata.unchecked || [],
        // ... 所有字段
      });
    }
    
    const item = items.get(baseId)!;
    
    if (node.mode === 'title') {
      // ✅ Title 行：保存为 title.fullTitle（Slate JSON）
      const fragment = node.children[0]?.children;
      item.title = {
        fullTitle: fragment ? JSON.stringify(fragment) : '',
      };
    } else if (node.mode === 'eventlog') {
      // ✅ EventLog 行：累积为 HTML
      const html = slateNodesToRichHtml([node]);
      item.eventlog = (item.eventlog || '') + html;
    }
  });
  
  return Array.from(items.values());
}
```

### 6.2 JSON 序列化（Slate 原生格式）

**核心原则**: PlanSlate 和 SlateEditor 统一使用 **Slate JSON 格式**存储富文本

```typescript
// ✅ Title 序列化为 Slate JSON
const titleNode: EventLineNode = {
  type: 'event-line',
  mode: 'title',
  children: [{
    type: 'paragraph',
    children: item.title?.fullTitle 
      ? JSON.parse(item.title.fullTitle)  // ✅ fullTitle 是 Slate JSON 字符串
      : [{ text: '' }]
  }],
  // ...
};

// ✅ EventLog 序列化为 Slate JSON
if (node.mode === 'title') {
  const fragment = node.children[0]?.children;
  item.title = {
    fullTitle: fragment ? JSON.stringify(fragment) : '',  // ✅ 保存为 Slate JSON
  };
} else if (node.mode === 'eventlog') {
  // ✅ EventLog 同样使用 JSON 格式
  const fragment = node.children[0]?.children;
  const jsonStr = JSON.stringify(fragment);
  item.eventlog = (item.eventlog || '') + jsonStr + '\n';
}
```

**为什么使用 JSON 而非 HTML？**
1. ✅ **完整保留 Slate 结构**: bullet、层级、格式化、inline 元素（Tag、Emoji、DateMention）
2. ✅ **避免信息丢失**: HTML 转换会丢失 Slate 内部属性
3. ✅ **回读精确**: JSON.parse() 直接还原 Slate 节点，无需解析 HTML
4. ✅ **统一格式**: title.fullTitle 和 eventlog 都用 JSON，架构一致

**回读支持**:
```typescript
// ✅ 从 JSON 字符串恢复 Slate 节点（无损还原）
function parseEventLogToSlateNodes(eventlogJson: string): EventLineNode[] {
  // eventlog 格式: 多个 JSON 对象用换行符分隔
  const jsonLines = eventlogJson.split('\n').filter(line => line.trim());
  
  return jsonLines.map((jsonStr, index) => {
    const fragment = JSON.parse(jsonStr);  // ✅ 直接 parse JSON
    
    return {
      type: 'event-line',
      mode: 'eventlog',
      lineId: `eventlog-${index}`,
      level: 0,  // 从 paragraph.bullet/bulletLevel 计算
      children: [{
        type: 'paragraph',
        children: fragment  // ✅ Slate JSON 直接还原
      }]
    };
  });
}
```

**JSON vs HTML 对比**:
```typescript
// ❌ HTML 格式（旧架构）- 信息丢失
"<p data-bullet='true' data-level='1'><span style='color: red'>重要</span></p>"
// 问题: Slate 的 inline 元素、格式化属性可能丢失

// ✅ JSON 格式（当前架构）- 完整保留
"[{\"type\":\"paragraph\",\"bullet\":true,\"bulletLevel\":1,\"children\":[{\"text\":\"重要\",\"color\":\"red\"}]}]"
// 优势: Slate 结构完整保留，JSON.parse() 直接还原
```

### 6.3 与 Slate 序列化对比

| 特性 | PlanSlate | Slate |
|------|--------------|------------|
| **序列化格式** | ✅ JSON（Slate 原生格式） | ✅ JSON（Slate 原生格式） |
| **存储方式** | title.fullTitle + eventlog（JSON 字符串） | content（JSON 字符串） |
| **层级信息** | ✅ 保留 level（EventLine 层级） + bulletLevel（段落层级） | ✅ 保留 bulletLevel（段落层级） |
| **多段落支持** | ✅ 每个段落独立 EventLine | ✅ 扁平 paragraph[] |
| **元数据保留** | ✅ 完整 metadata 对象（EventMetadata） | ❌ 无需元数据 |
| **事件分组** | ✅ 按 eventId 分组（多事件管理） | ❌ 单一内容 |
| **架构统一性** | ✅ 与 Slate 相同的 JSON 格式 | ✅ 标准 Slate JSON |

---

## 7. 可视化状态系统

### 7.1 StatusLineContainer 集成

**独有特性**: PlanSlate 配合 StatusLineContainer 显示事件状态竖线

```typescript
// PlanManager.tsx - getEventStatus
const getEventStatus = (eventId: string, dateRange: {start: Date, end: Date}) => {
  if (!dateRange) return undefined;
  
  // 查询事件历史
  const history = EventHistoryService.queryHistory({
    eventId,
    startTime: formatTimeForStorage(dateRange.start),
    endTime: formatTimeForStorage(dateRange.end)
  });
  
  if (!history || history.length === 0) return undefined;
  
  // 取最新操作
  const latestAction = history.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )[0];
  
  // 映射状态
  const statusMap = {
    'created': 'new',
    'updated': 'updated',
    'completed': 'done',
    'missed': 'missed',
    'deleted': 'deleted'
  };
  
  return statusMap[latestAction.action];
};
```

### 7.2 状态标签显示

**5 种状态类型**:
- **New**（蓝色 #3B82F6）: 新建事件
- **Updated**（黄色 #F59E0B）: 更新事件
- **Done**（绿色 #10B981）: 完成事件
- **Missed**（红色 #EF4444）: 错过事件
- **Del**（灰色 #9CA3AF）: 删除事件

**显示位置**: EventLinePrefix 中，Checkbox 和 Emoji 之间

```typescript
// EventLinePrefix.tsx
const statusConfig = getStatusConfig(eventStatus);

return (
  <div>
    {showCheckbox && <input type="checkbox" />}
    
    {/* ✅ 状态标签 */}
    {statusConfig && (
      <div className="event-status-label" style={{ 
        backgroundColor: statusConfig.color,
        color: statusConfig.labelColor 
      }}>
        {statusConfig.label}
      </div>
    )}
    
    {emoji && <span>{emoji}</span>}
  </div>
);
```

### 7.3 删除线样式

**Snapshot 模式**: 已删除事件显示删除线

```css
/* EventLineElement.css */
.unified-event-line.deleted-line {
  text-decoration: line-through;
  opacity: 0.6;
  pointer-events: none;  /* 禁止交互 */
}
```

```typescript
// EventLineElement.tsx
const isDeleted = (element.metadata as any)?._isDeleted || eventStatus === 'deleted';

<div
  className={`unified-event-line ${isDeleted ? 'deleted-line' : ''}`}
  style={{
    textDecoration: isDeleted ? 'line-through' : 'none',
    opacity: isDeleted ? 0.6 : 1,
    pointerEvents: isDeleted ? 'none' : 'auto',
  }}
>
  {children}
</div>
```

---

## 8. 与 PlanManager 的深度集成

### 8.1 数据双向绑定

**PlanManager → PlanSlate**:
```typescript
// PlanManager.tsx
const [items, setItems] = useState<PlanItem[]>([]);

<PlanSlateEditor
  items={items}  // ✅ 传递多个事件
  onChange={(updatedItems) => {
    // ✅ 接收批量更新
    setItems(updatedItems);
    
    // 同步到 EventService
    updatedItems.forEach(item => {
      EventService.updateEvent(item.id, item);
    });
  }}
  // ❌ 不传递 enableTimestamp 和 eventId（Timestamp 不启用）
/>
```

**PlanSlate → PlanManager**:
- `onFocus`: 焦点变化回调（用于显示 FloatingToolbar）
- `onDeleteRequest`: 删除请求回调（通知外部删除事件）
- `onSave`: 保存回调（Checkbox 点击触发）
- `onTimeClick`: 时间点击回调（打开时间选择器）
- `onMoreClick`: More 图标点击回调（打开 EventEditModal）

**⚠️ Timestamp 在 PlanManager 中不显示**:
- PlanManager **支持编辑 eventlog**（Shift+Enter 进入 eventlog 模式）
- 但 PlanManager 中**不显示 Timestamp**（未传递 `enableTimestamp` 和 `eventId` props）
- 原因：PlanManager 用于快速记录和管理，不需要详细的时间戳分隔
- Timestamp 主要用于：
  - **EventEditModal** 的 eventlog 编辑区域（详细记录实际进展）
  - **TimeLog 页面**（待开发，用于时间日志记录）

### 8.2 状态查询接口

**getEventStatus**: PlanManager 提供状态查询函数

```typescript
<PlanSlateEditor
  getEventStatus={(eventId) => {
    // ✅ 查询事件在当前时间范围的状态
    return getEventStatus(eventId, currentDateRange);
  }}
/>
```

### 8.3 Snapshot 模式支持

**Snapshot 快照模式**: 查看历史时间范围的事件状态（PlanSlate 独有核心功能）

#### 8.3.1 Snapshot 模式概念

Snapshot 模式允许用户"穿越"到过去的时间点，查看当时的事件状态：

```typescript
// PlanManager.tsx - Snapshot 状态
const [snapshotRange, setSnapshotRange] = useState<{start: Date, end: Date} | null>(null);
const [isSnapshotMode, setIsSnapshotMode] = useState(false);

// 查询历史事件（包括已删除）
const snapshotItems = snapshotRange
  ? EventHistoryService.queryEventsInRange({
      startTime: formatTimeForStorage(snapshotRange.start),
      endTime: formatTimeForStorage(snapshotRange.end),
      includeDeleted: true  // ✅ 包括已删除事件
    })
  : [];

<PlanSlateEditor
  items={isSnapshotMode ? snapshotItems : currentItems}
  getEventStatus={(eventId) => getEventStatus(eventId, snapshotRange || currentDateRange)}
  readOnly={isSnapshotMode}  // ✅ Snapshot 模式下只读
/>
```

#### 8.3.2 StatusLineContainer 集成

Snapshot 模式与 `StatusLineContainer` 深度集成，显示历史状态竖线：

```typescript
// PlanSlateEditor.tsx - StatusLineContainer
{mode === 'title' && (
  <StatusLineContainer
    eventId={node.eventId}
    status={eventStatus}  // ✅ 来自 getEventStatus(eventId, snapshotRange)
    isDeleted={metadata._isDeleted || false}
    level={node.level}
  >
    {/* EventLinePrefix + 内容 */}
  </StatusLineContainer>
)}
```

**StatusLineContainer 状态映射**:
```typescript
// 5种状态 + 删除标记
type EventStatus = 'new' | 'updated' | 'done' | 'missed' | 'untouched';

// 状态线颜色映射
const statusColors = {
  new: '#4CAF50',      // 绿色 - 新建
  updated: '#2196F3',  // 蓝色 - 更新
  done: '#9E9E9E',     // 灰色 - 完成
  missed: '#F44336',   // 红色 - 错过
  untouched: 'transparent'
};

// ✅ 删除事件显示红色竖线 + 半透明
if (isDeleted) {
  return <div style={{ borderLeft: '4px solid #F44336', opacity: 0.5 }} />;
}
```

#### 8.3.3 删除标记 (_isDeleted / _deletedAt)

Snapshot 模式依赖 `_isDeleted` 和 `_deletedAt` 字段标记已删除事件：

```typescript
// EventService.ts - 软删除
async deleteEvent(eventId: string) {
  const event = await this.getEvent(eventId);
  event._isDeleted = true;
  event._deletedAt = new Date().toISOString();
  await this.storage.setItem(`event_${eventId}`, event);
}

// EventHistoryService.ts - 查询历史
queryEventsInRange(options: {
  startTime: string;
  endTime: string;
  includeDeleted?: boolean;  // ✅ Snapshot 模式需要 includeDeleted = true
}) {
  const events = await this.getAllEvents();
  return events.filter(event => {
    const inRange = isInTimeRange(event, startTime, endTime);
    if (options.includeDeleted) {
      return inRange;  // ✅ 包括已删除事件
    }
    return inRange && !event._isDeleted;
  });
}
```

#### 8.3.4 getEventStatus() 函数

`getEventStatus()` 根据 `snapshotRange` 计算历史状态：

```typescript
// PlanManager.tsx - 状态计算
function getEventStatus(eventId: string, dateRange: {start: Date, end: Date}): EventStatus {
  const event = getEventById(eventId);
  if (!event) return 'untouched';
  
  const createTime = new Date(event.createTime);
  const updateTime = event.updateTime ? new Date(event.updateTime) : null;
  
  // ✅ Snapshot 模式：计算事件在历史时间范围的状态
  if (isInRange(createTime, dateRange)) {
    return 'new';  // 在该时间范围内创建
  }
  if (updateTime && isInRange(updateTime, dateRange)) {
    return 'updated';  // 在该时间范围内更新
  }
  if (event.checkType && event.checked?.includes(eventId)) {
    return 'done';  // 已完成
  }
  if (event.datetime && isPast(event.datetime, dateRange.end)) {
    return 'missed';  // 错过（时间已过但未完成）
  }
  
  return 'untouched';  // 未触碰
}
```

#### 8.3.5 只读模式保护

Snapshot 模式下编辑器自动进入只读状态，防止修改历史数据：

```typescript
<PlanSlateEditor
  items={snapshotItems}
  readOnly={isSnapshotMode}  // ✅ Snapshot 模式下只读
  getEventStatus={(eventId) => getEventStatus(eventId, snapshotRange)}
/>

// PlanSlateEditor.tsx - 只读渲染
const renderElement = useCallback((props: RenderElementProps) => {
  if (readOnly) {
    // ✅ 禁用所有交互（Checkbox、时间点击、More 按钮）
    return <EventLineElementReadOnly {...props} />;
  }
  return <EventLineElement {...props} />;
}, [readOnly]);
```

#### 8.3.6 与 Slate 的对比

| 功能 | PlanSlate | Slate |
|------|--------------|------------|
| **Snapshot 模式** | ✅ 支持 | ❌ 无需（单内容编辑） |
| **历史查询** | ✅ queryEventsInRange | ❌ |
| **删除标记** | ✅ _isDeleted / _deletedAt | ❌ |
| **状态计算** | ✅ getEventStatus(eventId, dateRange) | ❌ |
| **只读保护** | ✅ readOnly prop | ✅ 支持（通用） |
| **StatusLineContainer** | ✅ 历史状态竖线 | ❌ 无竖线 |

**为什么 Slate 不需要 Snapshot?**
- Slate 用于编辑单个内容（eventlog / timelog），不管理多个事件
- Snapshot 是 PlanManager 的需求（查看历史时间范围的事件状态）
- Slate 的历史记录由外部组件管理（EventEditModal 的历史面板）

---

## 9. 功能对比总结

### 9.1 架构层面

| 功能 | PlanSlate | Slate | 是否共享 |
|------|--------------|------------|----------|
| **节点结构** | `event-line` → `paragraph[]` | `paragraph[]` | ❌ |
| **双模式** | title / eventlog | 无（单一内容） | ❌ |
| **多事件管理** | ✅ 多个 Event | ❌ 单个内容 | ❌ |
| **元数据透传** | ✅ 完整 metadata | ❌ 无需元数据 | ❌ |
| **层级管理** | level（0-∞） | bulletLevel（0-4） | ⚠️ 部分共享 |

### 9.2 UI 元素

| 功能 | PlanSlate | Slate | 是否共享 |
|------|--------------|------------|----------|
| **Checkbox** | ✅ EventLinePrefix | ❌ | ❌ |
| **Emoji** | ✅ EventLinePrefix | ❌ | ❌ |
| **状态标签** | ✅ New/Updated/Done/Missed/Del | ❌ | ❌ |
| **时间显示** | ✅ EventLineSuffix | ❌ | ❌ |
| **标签列表** | ✅ EventLineSuffix | ❌ | ❌ |
| **Bullet** | ✅（eventlog 模式） | ✅ | ✅ |
| **Timestamp** | ✅（eventlog 模式） | ✅ | ✅ |

### 9.3 序列化

| 功能 | PlanSlate | Slate | 是否共享 |
|------|--------------|------------|----------|
| **序列化格式** | HTML（带 data-*） | JSON（Slate 结构） | ❌ |
| **反序列化** | parseHtmlToParagraphs | jsonToSlateNodes | ❌ |
| **事件分组** | ✅ 按 eventId 分组 | ❌ | ❌ |
| **层级保留** | level + bulletLevel | bulletLevel | ⚠️ 部分共享 |

### 9.4 键盘操作

| 功能 | PlanSlate | Slate | 是否共享 |
|------|--------------|------------|----------|
| **Enter** | 新建事件/段落 | 新建段落 | ⚠️ 逻辑不同 |
| **Shift+Enter** | 切换到 eventlog 模式 | 无特殊功能 | ❌ |
| **Tab** | 增加缩进 | 增加 bullet 层级 | ✅ |
| **Shift+Tab** | 减少缩进/退出 eventlog | 减少 bullet 层级 | ⚠️ 逻辑不同 |
| **Backspace** | 删除行/合并 | Bullet 删除机制 | ⚠️ 逻辑不同 |

### 9.5 外部集成

| 功能 | PlanSlate | Slate | 是否共享 |
|------|--------------|------------|----------|
| **与 PlanManager 集成** | ✅ 深度集成 | ❌ | ❌ |
| **与 EventEditModal 集成** | ❌ | ✅ | ❌ |
| **与 EventService 集成** | ✅ 批量保存 | ✅ 单个保存 | ⚠️ 接口不同 |
| **StatusLineContainer** | ✅ | ❌ | ❌ |
| **FloatingToolbar** | ✅ | ✅ | ✅ |

---

## 10. SlateCore 重构建议

### 10.1 完全独立的功能（不可提炼）

1. **EventLine 节点架构**
   - `event-line` 类型定义
   - 双模式（title/eventlog）切换
   - EventLineElement 组件
   - EventLinePrefix 组件（Checkbox、Emoji、状态标签）
   - EventLineSuffix 组件（时间、标签）

2. **多事件管理逻辑**
   - PlanItem[] ↔ EventLineNode[] 序列化
   - 事件分组（按 eventId）
   - 批量操作支持

3. **Checkbox 系统**
   - checkType 字段逻辑
   - checked/unchecked 数组管理
   - 与 EventService.checkIn/uncheck 的集成

4. **元数据透传**
   - EventMetadata 完整字段
   - metadata 在节点中的保存与读取

5. **可视化状态系统**
   - getEventStatus 接口
   - 状态标签渲染
   - 删除线样式

### 10.2 可以提炼到 SlateCore 的功能

1. **节点操作**
   - `findNodeByType()` - 查找特定类型节点
   - `isNodeEmpty()` - 判断节点是否为空
   - `getParentPath()` - 获取父节点路径

2. **段落操作**（需要适配双模式）
   - `moveParagraphUp/Down()` - 段落上下移动
   - `swapNodes()` - 交换两个节点
   - 注意：PlanSlate 的段落移动需要考虑 event-line 边界

3. **Bullet 操作**
   - `increaseBulletLevel()` - 增加层级
   - `decreaseBulletLevel()` - 减少层级
   - OneNote 删除机制（行首 Backspace）

4. **Inline 元素**
   - `insertTag()` - 插入标签
   - `insertEmoji()` - 插入 Emoji
   - `insertDateMention()` - 插入 DateMention

5. **序列化工具**（需要适配）
   - HTML ↔ Slate 转换
   - 保留 data-* 属性（PlanSlate 需要）
   - JSON ↔ Slate 转换（Slate 需要）

6. **格式化**
   - `applyTextFormat()` - 应用文本格式
   - `getActiveFormats()` - 获取当前格式

7. **Timestamp 服务**（⚠️ 需要外部传递 `enableTimestamp` 和 `eventId` props）
   - EventLogTimestampService（完全可共享）
   - 5 分钟间隔检测
   - 自动插入/清理逻辑
   - **显示场景**: EventEditModal、TimeLog 页面（待开发）
   - **不显示场景**: PlanManager（虽然可以编辑 eventlog，但不显示 timestamp）

### 10.3 重构优先级

**P0（核心共享层，优先提炼）**:
1. Timestamp 服务（⚠️ 需要外部 props 控制显示/隐藏）
2. Inline 元素操作（Tag、Emoji、DateMention）
3. 格式化工具（Bold、Italic、Color）
4. Bullet 操作（Tab/Shift+Tab）

**P1（需要适配，次优先）**:
1. 段落移动（需要适配 event-line 边界）
2. 序列化工具（需要支持双格式）
3. 节点操作（通用工具函数）

**P2（保留在各自编辑器中）**:
1. EventLine 架构（PlanSlate 独有）
2. Checkbox 系统（PlanSlate 独有）
3. 元数据透传（PlanSlate 独有）
4. 可视化状态系统（PlanSlate 独有）
5. 与 PlanManager 的集成逻辑

---

## 11. 总结

### 11.1 PlanSlate 核心价值

1. **多事件管理能力**: 一个编辑器管理多个独立事件（PlanManager 页面）
2. **双模式架构**: title/eventlog 分离，支持复杂的事件信息展示
3. **Checkbox 集成**: 完整的任务签到系统，与 EventService 深度集成
4. **可视化状态**: Snapshot 模式、状态竖线、删除线等历史追溯功能
5. **完整元数据**: 透传 20+ 业务字段，保证数据一致性

### 11.2 与 Slate 的本质区别

| 维度 | PlanSlate | Slate |
|------|--------------|------------|
| **定位** | 多事件管理编辑器 | 单内容编辑器 |
| **使用场景** | PlanManager 页面 | EventEditModal、TimeLog 页面 |
| **复杂度** | 高（2700+ lines） | 低（~500 lines） |
| **核心架构** | event-line 双模式 | paragraph 扁平结构 |
| **业务耦合** | EventService、PlanManager | 独立使用，低耦合 |

### 11.3 重构建议

1. **保留 PlanSlate 的独有功能**:
   - EventLine 架构
   - Checkbox 系统
   - 多事件管理
   - 可视化状态

2. **提炼到 SlateCore 的共享功能**:
   - Timestamp 服务（完全可共享，通过外部 props 控制显示场景）
   - Inline 元素操作（Tag、Emoji、DateMention）
   - Bullet 操作（Tab/Shift+Tab）
   - 格式化工具（Bold、Italic、Color）

3. **适配性改造**:
   - 段落移动：增加 event-line 边界检测参数
   - 序列化：提供双格式支持（HTML + JSON）
   - 节点操作：提供通用工具函数，编辑器自行调用

4. **不建议提炼的功能**:
   - EventLinePrefix/Suffix 组件（业务逻辑强）
   - PlanItem 序列化（PlanSlate 专用）
   - 元数据透传机制（PlanSlate 专用）

---

**文档结束**

详细架构设计请参考：
- [SlateCore 共享层架构设计](./SLATE_EDITOR_ARCHITECTURE.md)
- [SlateEditor PRD](./SlateEditor_PRD.md)
- [PlanSlateEditor 段落移动功能](./SLATE_EDITOR_PRD.md#v215-段落移动功能)
