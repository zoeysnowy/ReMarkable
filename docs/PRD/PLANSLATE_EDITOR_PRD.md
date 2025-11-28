# PlanSlateEditor 产品需求文档 (PRD)

> **模块路径**: `src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx`  
> **代码行数**: ~2774 lines  
> **架构版本**: v2.0 (使用 SlateCore 共享层)  
> **最后更新**: 2025-11-29  
> **设计理念**: 多事件管理、事件列表编辑、深度 PlanManager 集成  
> **关联文档**: 
> - [PLANSLATE_UNIQUE_FEATURES.md](./PLANSLATE_UNIQUE_FEATURES.md) - 独有功能全量分析
> - [SLATE_EDITOR_ARCHITECTURE.md](./SLATE_EDITOR_ARCHITECTURE.md) - 架构设计
> - [SLATEEDITOR_PRD.md](./SLATEEDITOR_PRD.md) - LightSlateEditor PRD
> - [PlanManager_PRD.md](./PlanManager_PRD.md) - PlanManager 集成

---

## 📋 目录

1. [设计目标与定位](#1-设计目标与定位)
2. [核心特性](#2-核心特性)
3. [EventLine 双模式架构](#3-eventline-双模式架构)
4. [多事件管理能力](#4-多事件管理能力)
5. [Checkbox 集成系统](#5-checkbox-集成系统)
6. [元数据透传机制](#6-元数据透传机制)
7. [Snapshot 快照模式](#7-snapshot-快照模式)
8. [与 PlanManager 的集成](#8-与-planmanager-的集成)
9. [API 文档](#9-api-文档)
10. [与 LightSlateEditor 的差异](#10-与-lightslate编辑器的差异)

---

## 1. 设计目标与定位

### 1.1 设计目标

**核心理念**: "多事件管理、事件列表编辑、深度 PlanManager 集成"

PlanSlateEditor (UnifiedSlateEditor) 是为**多事件列表管理场景**优化的 Slate 编辑器，支持在同一编辑器实例中管理多个独立事件，提供双模式（title/eventlog）架构和丰富的可视化状态系统。

**设计原则**:
- ✅ **EventLine 架构**: `event-line` 顶层节点，支持 title/eventlog 双模式
- ✅ **多事件管理**: 一个编辑器实例管理多个事件（PlanManager 页面）
- ✅ **元数据透传**: 完整保留事件业务字段（20+ 字段）
- ✅ **可视化状态**: Snapshot 模式、状态竖线、删除线等历史追溯
- ✅ **深度集成**: 与 PlanManager、EventService 深度耦合

### 1.2 与 LightSlateEditor 的差异

| 维度 | PlanSlateEditor | LightSlateEditor |
|------|-------------------|------------------|
| **数据模型** | 多事件列表 (`Event[]`) | 单内容字符串 (`string`) |
| **节点结构** | `event-line` → `title` + `eventlog` | 扁平 `paragraph[]` |
| **主要用途** | 多事件管理、任务列表 | 单事件日志、文本编辑 |
| **复杂度** | 高（三层数据转换） | 低（单层 JSON 序列化） |
| **特殊功能** | Checkbox、事件排序、Snapshot | Timestamp、Preline |
| **段落移动** | 双模式（标题+eventlog vs 单段落） | 单模式（段落交换） |
| **缩进管理** | `event-line level` + `bulletLevel` | 仅 `bulletLevel` |
| **使用场景** | PlanManager | EventEditModal、TimeLog |

### 1.3 架构版本演进

**v1.0 - v1.9**: 独立实现所有功能（2700+ lines）
**v2.0 (当前)**: 使用 SlateCore 共享层，保留 EventLine 特有逻辑

---

## 2. 核心特性

### 2.1 特性列表

- ✅ **EventLine 架构**: 每个事件是一个 `event-line` 节点，包含标题和子段落
- ✅ **双模式支持**: `title` 模式（标题行）和 `eventlog` 模式（内容行）
- ✅ **多事件管理**: 支持跨事件操作、批量编辑、事件排序
- ✅ **Checkbox 集成**: 与 PlanManager 的任务状态同步（checkType 控制显示）
- ✅ **元数据透传**: 完整保留 20+ 业务字段，避免字段丢失
- ✅ **可视化状态**: 状态竖线、删除线、状态标签（New/Updated/Done/Missed/Del）
- ✅ **Snapshot 模式**: 查看历史时间范围的事件状态（包括已删除事件）
- ✅ **空白事件过滤**: 三层防护机制，确保空白事件不显示
- ✅ **双模式段落移动**: 标题移动带动 eventlog，eventlog 独立移动
- ✅ **Inline 元素**: Tag、DateMention、Emoji（使用 SlateCore）
- ✅ **富文本格式**: 粗体、斜体、颜色等（使用 SlateCore.applyTextFormat）
- ✅ **Bullet 支持**: 多层级 bullet（使用 SlateCore.bulletOperations）

### 2.2 SlateCore 集成

**v2.0 新增**: 使用 SlateCore 共享层，减少代码冗余

**从 SlateCore 导入的功能**:
```typescript
import {
  // 类型
  TextNode, ParagraphNode, TagNode, DateMentionNode, TimestampDividerElement,
  
  // 服务
  EventLogTimestampService,
  
  // 操作工具
  insertTag, insertEmoji, insertDateMention,
  applyTextFormat, toggleFormat,
  increaseBulletLevel, decreaseBulletLevel, handleBulletBackspace,
  findNodeByType, isNodeEmpty, getParentPath,
  moveParagraphUp, moveParagraphDown, swapNodes,
  
  // 序列化
  jsonToSlateNodes, slateNodesToJson,
} from '../SlateCore';
```

**PlanSlateEditor 特有逻辑**:
- `EventLineNode` 类型定义（`event-line` 节点）
- `EventMetadata` 元数据透传
- `serialization.ts`（PlanItem ↔ EventLine 转换）
- `EventLineElement.tsx`（EventLine 渲染组件）
- `EventLinePrefix.tsx`（Checkbox、Emoji、状态标签）
- `EventLineSuffix.tsx`（时间、标签）
- 双模式段落移动逻辑

---

## 3. EventLine 双模式架构

### 3.1 EventLineNode 结构

```typescript
interface EventLineNode {
  type: 'event-line';
  eventId?: string;        // 关联的 Event ID
  lineId: string;          // 行唯一ID（用于编辑器内部定位）
  level: number;           // 缩进层级 (0, 1, 2, ...)
  mode: 'title' | 'eventlog';  // ✅ 双模式切换
  children: ParagraphNode[];
  metadata?: EventMetadata;     // ✅ 完整元数据透传
}
```

### 3.2 Title 模式（标题行）

**显示元素**:
- **EventLinePrefix**（左侧装饰）:
  - Checkbox（根据 `checkType` 显示）
  - Emoji
  - 状态标签（New/Updated/Done/Missed/Del）
  
- **EventLineSuffix**（右侧装饰）:
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

### 3.3 Eventlog 模式（内容行）

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

**特有样式**:
```css
.unified-event-line.eventlog-mode {
  min-height: 20px;  /* eventlog 行较紧凑 */
  align-items: flex-start;  /* 顶部对齐 */
  padding-left: calc((level + 1) * 24px);  /* eventlog 额外缩进 1 级 */
}
```

### 3.4 模式切换快捷键

**Shift+Enter**: 在 title 行按下 → 创建 eventlog 行
**Shift+Tab**: 在 eventlog 行按下 → 转换为 title 行

---

## 4. 多事件管理能力

### 4.1 一个编辑器管理多个 Event

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

### 4.2 事件分组与层级管理

**Level 字段作用**:
- `level=0`: 顶级事件（无缩进）
- `level=1,2,3...`: 子事件（缩进显示层级关系）

**视觉效果**:
```css
/* 根据 level 动态计算缩进 */
padding-left: calc(level * 24px);  /* title 行 */
padding-left: calc((level + 1) * 24px);  /* eventlog 行额外缩进 */
```

---

## 5. Checkbox 集成系统

### 5.1 checkType 字段控制

```typescript
interface EventMetadata {
  checkType?: 'none' | 'once' | 'recurring';
  checked?: string[];    // 签到时间戳数组
  unchecked?: string[];  // 取消签到时间戳数组
}
```

**显示规则**:
- `checkType='once'`: 显示 checkbox（单次任务）
- `checkType='recurring'`: 显示 checkbox（循环任务）
- `checkType='none'` 或 `undefined`: 不显示 checkbox

### 5.2 Checkbox 状态同步

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

---

## 6. 元数据透传机制

### 6.1 完整的 EventMetadata

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

---

## 7. Snapshot 快照模式

### 7.1 Snapshot 模式概念

Snapshot 模式允许用户"穿越"到过去的时间点，查看当时的事件状态：

```typescript
// PlanManager.tsx - Snapshot 状态
const [snapshotRange, setSnapshotRange] = useState<{start: Date, end: Date} | null>(null);
const [isSnapshotMode, setIsSnapshotMode] = useState(false);

<PlanSlateEditor
  items={isSnapshotMode ? snapshotItems : currentItems}
  getEventStatus={(eventId) => getEventStatus(eventId, snapshotRange || currentDateRange)}
  readOnly={isSnapshotMode}  // ✅ Snapshot 模式下只读
/>
```

### 7.2 删除标记 (_isDeleted / _deletedAt)

```typescript
// EventService.ts - 软删除
async deleteEvent(eventId: string) {
  const event = await this.getEvent(eventId);
  event._isDeleted = true;
  event._deletedAt = new Date().toISOString();
  await this.storage.setItem(`event_${eventId}`, event);
}
```

---

## 8. 与 PlanManager 的集成

### 8.1 数据双向绑定

```typescript
// PlanManager.tsx
<PlanSlateEditor
  items={items}  // ✅ 传递多个事件
  onChange={(updatedItems) => {
    setItems(updatedItems);
    updatedItems.forEach(item => {
      EventService.updateEvent(item.id, item);
    });
  }}
  // ❌ 不传递 enableTimestamp 和 eventId（Timestamp 不启用）
/>
```

### 8.2 空白事件过滤机制（v2.5 2025-11-29 新增）

**三层防护机制**:

1. **初始化过滤** (PlanManager.tsx L383-415)
2. **eventsUpdated 监听器过滤** (PlanManager.tsx L718-744)
3. **Snapshot Ghost 过滤** (PlanManager.tsx L1548-1578)

**统一的空白检测标准**:
```typescript
// 标题检查
const hasTitle = event.content || 
                (typeof titleObj === 'string' ? titleObj : 
                 (titleObj && (titleObj.simpleTitle || titleObj.fullTitle || titleObj.colorTitle)));

// eventlog 检查
if (typeof eventlogField === 'string') {
  hasEventlog = eventlogField.trim().length > 0;
} else if (typeof eventlogField === 'object' && eventlogField !== null) {
  const slateContent = eventlogField.slateJson || '';
  const htmlContent = eventlogField.html || '';
  const plainContent = eventlogField.plainText || '';
  hasEventlog = slateContent.trim().length > 0 || 
               htmlContent.trim().length > 0 || 
               plainContent.trim().length > 0;
}

// 过滤规则
if (!hasTitle && !hasEventlog) {
  return false; // 完全空白事件 → 过滤掉
}
```

---

## 9. API 文档

### 9.1 Props

```typescript
interface PlanSlateEditorProps {
  items: PlanItem[];                    // 事件列表
  onChange: (updatedItems: PlanItem[]) => void;  // 变更回调
  onFocus?: (lineId: string) => void;   // 焦点变化回调
  onDeleteRequest?: (lineId: string) => void;  // 删除请求回调
  onSave?: (lineId: string) => void;    // 保存回调
  onTimeClick?: (lineId: string) => void;  // 时间点击回调
  onMoreClick?: (lineId: string) => void;  // More 图标点击回调
  getEventStatus?: (eventId: string) => EventStatus;  // 状态查询函数
  readOnly?: boolean;                   // 只读模式（Snapshot）
  enableTimestamp?: boolean;            // 启用 Timestamp（默认 false）
}
```

### 9.2 快捷键

| 快捷键 | 功能 | 适用模式 |
|--------|------|----------|
| **Enter** | 创建新事件/段落 | Title/Eventlog |
| **Shift+Enter** | 切换到 eventlog 模式 | Title |
| **Shift+Tab** | 转换为 title 行 | Eventlog |
| **Tab** | 增加缩进 | Title/Eventlog |
| **Shift+Tab** | 减少缩进/退出 eventlog | Title/Eventlog |
| **Shift+Alt+↑** | 段落上移 | Title/Eventlog |
| **Shift+Alt+↓** | 段落下移 | Title/Eventlog |
| **Backspace** | 删除行/合并 | Title/Eventlog |

---

## 10. 与 LightSlateEditor 的差异

### 10.1 架构层面

| 功能 | PlanSlateEditor | LightSlateEditor | 是否共享 |
|------|--------------|------------|----------|
| **使用场景** | PlanManager（多事件列表） | EventEditModal（单事件详情） | ❌ |
| **编辑器实例** | 1个实例管理多事件 | 1个实例编辑1个eventlog | ❌ |
| **节点结构** | `event-line` → `paragraph[]` | `paragraph[]` | ❌ |
| **双模式** | title / eventlog | 无（单一内容） | ❌ |
| **多事件管理** | ✅ 多个 Event | ❌ 单个 eventlog | ❌ |
| **元数据透传** | ✅ 完整 metadata | ❌ 无需元数据 | ❌ |
| **层级管理** | level（0-∞） | bulletLevel（0-4） | ⚠️ 部分共享 |

### 10.2 序列化

| 功能 | PlanSlateEditor | LightSlateEditor | 是否共享 |
|------|--------------|------------|----------|
| **序列化格式** | ✅ JSON（Slate 原生格式） | ✅ JSON（Slate 原生格式） | ✅ |
| **存储字段** | title.fullTitle + eventlog | eventlog | ⚠️ 字段不同 |
| **反序列化** | JSON.parse(fullTitle/eventlog) | JSON.parse(eventlog) | ✅ |
| **事件分组** | ✅ 按 eventId 分组（多事件） | ❌（单 eventlog） | ❌ |
| **层级保留** | level + bulletLevel | bulletLevel | ⚠️ 部分共享 |

---

**文档结束**

详细架构设计请参考：
- [PLANSLATE_UNIQUE_FEATURES.md](./PLANSLATE_UNIQUE_FEATURES.md)
- [SLATE_EDITOR_ARCHITECTURE.md](./SLATE_EDITOR_ARCHITECTURE.md)
- [SLATEEDITOR_PRD.md](./SLATEEDITOR_PRD.md)
