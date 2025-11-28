# Snapshot 状态可视化系统 PRD

**模块路径**: `src/components/StatusLineContainer.tsx` & `PlanManager.tsx`  
**功能版本**: v1.0  
**最后更新**: 2025-11-23  
**设计参考**: [Figma - ReMarkable 0.1](https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=290-2646&m=dev)  
**状态**: ✅ 已完成并测试验证

---

## 📋 概述

### 功能定位

Snapshot（快照）功能是 PlanManager 的核心可视化特性，通过**彩色竖线 + 状态标签**的形式，直观展示事件在特定时间范围内的变化历史和当前状态。

### 业务价值

1. **历史追溯**: 快速了解事件在某个时间段的创建、更新、完成情况
2. **进度可视化**: 通过竖线颜色和位置，直观看出项目进展
3. **状态连续性**: 相同状态的竖线在同一列连续显示，清晰展示时间线
4. **多状态支持**: 一个事件可能同时拥有多个状态（如：新建+更新，或更新+完成）
5. **删除可见性**: Ghost 事件（已删除）以删除线样式显示，保持历史完整性

### 核心特性

- ✅ **5种状态类型**: New（新建）、Updated（更新）、Done（完成）、Missed（错过）、Deleted（删除）
- ✅ **多线并行**: 每个事件可以同时显示多条不同颜色的竖线
- ✅ **智能列分配**: 相同状态的连续事件使用同一列，实现竖线连续性
- ✅ **自适应缩进**: 根据竖线数量动态调整内容左侧缩进
- ✅ **实时响应**: 日期范围变化时竖线实时更新
- ✅ **DOM精确定位**: 基于实际DOM元素位置测量，支持事件多行内容（eventlog）
- ✅ **标签智能定位**: 每个状态只显示一次标签，自动定位到对应竖线的中心
- ✅ **Ghost 事件**: 显示在时间范围内删除的事件，带删除线和灰色竖线
- ✅ **编辑器隔离**: 通过 `key` 强制重置，确保时间范围切换时状态完全刷新

---

## 🎨 视觉设计

### 状态颜色规范

| 状态 | 颜色 | 标签 | 含义 |
|------|------|------|------|
| New | `#3B82F6` (蓝色) | New | 事件在时间范围内被创建 |
| Updated | `#F59E0B` (黄色) | Updated | 事件在时间范围内被修改 |
| Done | `#10B981` (绿色) | Done | 事件当前状态为已完成（checked） |
| Missed | `#EF4444` (红色) | Missed | 事件开始时间已过且未完成 |
| Deleted | `#9CA3AF` (灰色) | Del | 事件在时间范围内被删除 |

### 布局规范

```
[标签区域] [竖线区域] [内容区域]
   New      │││        📅 事件标题
   Updated  │││        🔹 事件详情
            │││        🔸 时间日志
            
- 竖线宽度: 2px
- 竖线间距: 3px
- 标签与竖线间距: 8px
- 基础左边距: 5px
```

### 竖线渲染规则

1. **高度**: 从事件标题行顶部延伸到最后一行 eventlog 底部
2. **位置**: 通过 `getBoundingClientRect()` 获取实际 DOM 位置
3. **分组**: 按 `eventId` 分组，一个事件的所有行（title + eventlog）共享竖线
4. **列分配**: 
   - 相同状态连续事件 → 使用同一列（竖线连续）
   - 新状态或不连续 → 分配新列（避免重叠）

---

## 🏗️ 技术架构

### 核心组件

#### 1. StatusLineContainer

**文件**: `src/components/StatusLineContainer.tsx`  
**职责**: 竖线渲染容器，负责布局计算和DOM测量

**核心特性**:

```typescript
interface StatusLineSegment {
  startIndex: number;      // 起始行索引（editorItems中的位置）
  endIndex: number;        // 结束行索引
  status: 'new' | 'updated' | 'done' | 'missed' | 'deleted';
  label: string;           // 状态标签文本
}

interface StatusLineContainerProps {
  children: React.ReactNode;
  segments: StatusLineSegment[];     // 所有竖线段
  editorItems: any[];                // 事件列表（用于查找eventId）
  lineHeight?: number;               // 行高（默认32px）
  totalLines?: number;               // 总行数
}
```

**关键算法**:

1. **列分配算法**（`segmentColumns` useMemo）:
```typescript
// 维护每一行的 status→column 映射
const statusColumnsAtLine = new Map<number, Map<string, number>>();

sortedSegments.forEach(segment => {
  const { startIndex, status } = segment;
  const prevLineColumns = statusColumnsAtLine.get(startIndex - 1);
  
  if (prevLineColumns?.has(status)) {
    // ✅ 继承上一行相同status的列号
    column = prevLineColumns.get(status)!;
  } else {
    // ✅ 分配新列（找第一个不冲突的列）
    column = 0;
    while (occupiedColumns.has(column)) column++;
  }
  
  // 记录此segment覆盖的所有行的映射
  for (let line = startIndex; line <= endIndex; line++) {
    statusColumnsAtLine.get(line)!.set(status, column);
  }
});
```

2. **DOM精确定位**（`useEffect` + `ResizeObserver`）:
```typescript
// 按 eventId 分组所有行
const eventIdToLines = new Map<string, HTMLElement[]>();
allEventLines.forEach(line => {
  const eventId = line.dataset.eventId;
  if (eventId) {
    eventIdToLines.get(eventId).push(line);
  }
});

// 计算每个segment的实际位置
baseSegments.map(segment => {
  const eventItem = editorItems[segment.startIndex];
  const lines = eventIdToLines.get(eventItem.id);
  
  const startElement = lines[0];              // 标题行
  const endElement = lines[lines.length - 1]; // 最后的eventlog
  
  const startRect = startElement.getBoundingClientRect();
  const endRect = endElement.getBoundingClientRect();
  
  return {
    ...segment,
    top: startRect.top - containerRect.top,
    height: endRect.bottom - startRect.top
  };
});
```

3. **标签定位算法**:
```typescript
// 每个status只显示一次标签，放在最左侧位置
const statusFirstSegment = new Map<string, typeof renderedSegments[0]>();

renderedSegments.forEach(seg => {
  if (!statusFirstSegment.has(seg.status) || 
      seg.column < statusFirstSegment.get(seg.status)!.column) {
    statusFirstSegment.set(seg.status, seg);
  }
});

// 标签垂直居中对齐竖线
const labelTop = segment.top + lineHeight / 2;
```

4. **响应式更新**:
```typescript
useEffect(() => {
  const resizeObserver = new ResizeObserver(() => {
    updateSegmentPositions(); // 容器尺寸变化时重新计算
  });
  
  resizeObserver.observe(containerRef.current);
  return () => resizeObserver.disconnect();
}, [baseSegments, segments.length, editorItems]);
```

#### 2. PlanManager - 状态计算逻辑

**文件**: `src/components/PlanManager.tsx`  
**职责**: 计算每个事件的状态，生成 `StatusLineSegment[]`

**核心方法**: `getEventStatuses(eventId: string)`

**输入**:
- `eventId`: 事件ID
- `dateRange`: 当前快照的时间范围（start ~ end）

**输出**:
- `Array<'new' | 'updated' | 'done' | 'missed' | 'deleted'>`: 事件的所有状态

**状态判定规则**:

```typescript
const getEventStatuses = useCallback((eventId: string) => {
  const event = EventService.getEventById(eventId);
  const startTime = formatTimeForStorage(dateRange.start); // "YYYY-MM-DD 00:00:00"
  const endTime = formatTimeForStorage(dateRange.end);     // "YYYY-MM-DD 23:59:59"
  
  // 1️⃣ 查询时间范围内的历史记录
  const history = EventHistoryService.queryHistory({ 
    eventId, 
    startTime, 
    endTime 
  });
  
  const statuses = new Set<Status>();
  
  // 2️⃣ 分析历史记录
  history.forEach(log => {
    switch (log.operation) {
      case 'create':
        statuses.add('new');
        break;
      case 'update':
        statuses.add('updated');
        break;
      case 'delete':
        statuses.add('deleted');
        break;
    }
  });
  
  // 3️⃣ 判断 DONE 状态（合并 checked 和 unchecked 数组）
  const checkedArray = event?.checked || [];
  const uncheckedArray = event?.unchecked || [];
  
  const allCheckActions = [
    ...checkedArray.map(ts => ({ action: 'check-in', timestamp: ts })),
    ...uncheckedArray.map(ts => ({ action: 'uncheck', timestamp: ts }))
  ];
  
  // 按时间排序，找最后一次操作
  allCheckActions.sort((a, b) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
  
  const isCurrentlyChecked = allCheckActions[0]?.action === 'check-in';
  if (isCurrentlyChecked) {
    statuses.add('done');
  }
  
  // 4️⃣ 判断 MISSED 状态 (⚠️ 修复于 2025-11-24)
  if (event?.startTime) {
    const eventTime = new Date(event.startTime);
    const now = new Date();
    const rangeEnd = new Date(endTime);
    const cutoffTime = now < rangeEnd ? now : rangeEnd; // 取较早的时间点
    
    if (eventTime < cutoffTime && !statuses.has('done')) {
      statuses.add('missed');
    }
  }
  
  return Array.from(statuses);
}, [dateRange]);
```

**关键优化点**:

1. **日期规范化**: 
```typescript
// 确保查询范围是完整的天
const weekStart = new Date(startDate);
weekStart.setHours(0, 0, 0, 0);    // 00:00:00

const weekEnd = new Date(endDate);
weekEnd.setHours(23, 59, 59, 999); // 23:59:59
```

2. **Check状态合并**: 
   - 不依赖历史记录的 `checkin` operation
   - 直接从 `event.checked[]` 和 `event.unchecked[]` 数组合并
   - 比较时间戳找到最后一次操作
   - 性能优化：避免每次都查询历史

3. **MISSED 判定逻辑** (⚠️ 已修复 2025-11-24):
   ```typescript
   // 取当前时间和范围结束时间的较早者作为判定截止时间
   const cutoffTime = now < rangeEnd ? now : rangeEnd;
   if (eventTime < cutoffTime && !statuses.has('done')) {
     statuses.add('missed');
   }
   ```
   - **查看当前/未来时间范围**: 使用 `now` 作为截止时间，只有真正过期的事件才算missed
   - **查看历史时间范围**: 使用 `rangeEnd` 作为截止时间，在那个历史范围内应完成但未完成的事件算missed
   - **修复前问题**: 直接使用 `eventTime < rangeEnd` 会导致未来事件也被标记为missed

### Ghost 事件机制 (⚠️ Critical Feature)

**什么是 Ghost 事件？**

Ghost 事件是指在选定时间范围内被删除的事件，以**删除线样式 + 灰色竖线**的形式显示，让用户了解"在这段时间里有哪些任务被删除了"。

**核心原则**:
1. **仅显示原则**: Ghost 事件仅用于 Snapshot 可视化，永远不会保存到 localStorage
2. **临时标记**: 使用 `_isDeleted: true` 和 `_deletedAt: timestamp` 标记
3. **时间准确性**: 只显示"在起点时存在 + 在范围内被删除"的事件
4. **隔离机制**: 通过编辑器 `key` 确保状态隔离，避免跨时间范围污染

**生成逻辑**:

```typescript
// PlanManager.tsx - editorItems useMemo
if (dateRange) {
  const startTime = formatTimeForStorage(dateRange.start);
  const endTime = formatTimeForStorage(dateRange.end);
  
  // 1️⃣ 获取起点时刻存在的所有事件（基准状态）
  const existingAtStart = EventHistoryService.getExistingEventsAtTime(startTime);
  
  // 2️⃣ 筛选出起点时存在的事件（未删除的）
  allItems = filteredItems.filter(item => existingAtStart.has(item.id));
  
  // 3️⃣ 查询时间范围内的所有操作
  const operations = EventHistoryService.queryHistory({ startTime, endTime });
  
  // 4️⃣ 添加范围内删除的事件为 ghost
  const deleteOpsInRange = operations.filter(op => 
    op.operation === 'delete' && 
    op.before &&
    existingAtStart.has(op.eventId)  // ⚠️ 关键检查：必须在起点时存在
  );
  
  deleteOpsInRange.forEach(log => {
    // 🎯 三步过滤公式（v2.4 2025-11-28 优化：检查标题+eventlog）
    
    // 步骤 1: checkType 过滤（必须有有效的 checkType 且不为 'none'）
    if (!log.before.checkType || log.before.checkType === 'none') {
      console.log('[PlanManager] ⏭️ 跳过 checkType 无效 ghost:', log.eventId.slice(-8));
      return;
    }
    
    // 步骤 2: 业务类型过滤（完全空白事件：标题和eventlog都为空）
    // 2.1 检查标题内容
    const titleObj = log.before.title;
    const hasTitle = log.before.content || 
                    (typeof titleObj === 'string' ? titleObj : 
                     (titleObj && (titleObj.simpleTitle || titleObj.fullTitle)));
    
    // 2.2 检查 eventlog 内容
    const eventlogField = log.before.eventlog;
    let hasEventlog = false;
    
    if (eventlogField) {
      if (typeof eventlogField === 'string') {
        // 字符串格式：去除空白后检查是否有内容
        hasEventlog = eventlogField.trim().length > 0;
      } else if (typeof eventlogField === 'object' && eventlogField !== null) {
        // EventLog 对象格式：检查 slateJson, html, plainText
        const slateContent = eventlogField.slateJson || '';
        const htmlContent = eventlogField.html || '';
        const plainContent = eventlogField.plainText || '';
        
        // 任一字段有实质内容即算有 eventlog
        hasEventlog = slateContent.trim().length > 0 || 
                     htmlContent.trim().length > 0 || 
                     plainContent.trim().length > 0;
      }
    }
    
    // 只有标题和eventlog都为空时才跳过
    if (!hasTitle && !hasEventlog) {
      console.log('[PlanManager] ⏭️ 跳过完全空白 ghost (无标题且无eventlog):', log.eventId.slice(-8));
      return;
    }
    
    // 步骤 3: 系统事件过滤（使用严格比较 === true）
    if (log.before.isTimer === true || 
        log.before.isTimeLog === true || 
        log.before.isOutsideApp === true) {
      console.log('[PlanManager] ⏭️ 跳过系统事件 ghost:', log.eventId.slice(-8));
      return;
    }
    
    console.log('[PlanManager] 👻 添加 ghost:', {
      eventId: log.eventId.slice(-8),
      title: log.before?.title,
      hasTitle,
      hasEventlog,
      eventlogType: typeof log.before.eventlog,
      删除于: new Date(log.timestamp).toLocaleString()
    });
    
    allItems.push({
      ...log.before,         // 恢复删除前的完整事件数据
      _isDeleted: true,      // 临时标记：已删除
      _deletedAt: log.timestamp  // 删除时间戳
    } as any);
  });
}
```

**空白事件防护机制**（v2.5 2025-11-29 完善）:

Ghost 过滤（上述步骤 2）是**第一层防护**，确保 Snapshot 模式下不显示空白的已删除事件。

完整的**三层防护链**:

1. **初始化过滤** (PlanManager.tsx L383-415)
   - 从 EventService.getAllEvents() 加载时过滤空白事件
   - 步骤 2.5: 检查标题和 eventlog → 都为空则过滤掉
   
2. **eventsUpdated 监听器过滤** (PlanManager.tsx L718-744)
   - EventService 触发事件更新时早期过滤
   - 空白事件 → 直接忽略，不触发状态更新
   
3. **Snapshot Ghost 过滤** (PlanManager.tsx L1548-1578)
   - 已删除事件恢复为 ghost 时检测空白
   - 步骤 2: 标题和 eventlog 都为空 → 跳过不添加 ghost

**关键检查**: `existingAtStart.has(op.eventId)`
- ✅ **通过**: 事件在 28 号创建，29 号删除 → 查询 28-29 号显示 ghost
- ❌ **不通过**: 事件在 23 号删除 → 查询 28-29 号**不显示** ghost（因为 28 号起点时已不存在）

**防护机制**（v2.5 2025-11-29 完善）:

```typescript
// 1. 初始化过滤：从 localStorage 加载时移除 ghost + 过滤空白事件
const rawEvents = EventService.getAllEvents();
const allEvents = rawEvents.filter(e => !(e as any)._isDeleted);

// 1.5 空白事件过滤（新增 L383-415）
const filtered = allEvents.filter(event => {
  // ... 包含条件、系统事件排除 ...
  
  // 🆕 步骤 2.5: 空白事件过滤
  const titleObj = event.title;
  const hasTitle = event.content || 
                  (typeof titleObj === 'string' ? titleObj : 
                   (titleObj && (titleObj.simpleTitle || titleObj.fullTitle || titleObj.colorTitle)));
  
  const eventlogField = (event as any).eventlog;
  let hasEventlog = false;
  
  if (eventlogField) {
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
  }
  
  if (!hasTitle && !hasEventlog) {
    return false; // 完全空白的事件，过滤掉
  }
  
  return true;
});

// 2. 保存时过滤：确保 ghost 不会被保存
const realItems = updatedItems.filter(item => !(item as any)._isDeleted);
EventService.batchUpdate(realItems);

// 3. 编辑器隔离：强制重置避免跨时间范围污染
<PlanSlateEditor
  key={dateRange ? `snapshot-${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'normal'}
  items={editorItems}
/>

// 4. eventsUpdated 监听器过滤（新增 L718-744）
EventHub.on('eventsUpdated', (changes) => {
  changes.forEach(change => {
    const event = change.event;
    
    // ... 包含条件、系统事件排除 ...
    
    // 🆕 空白事件检查
    const titleObj = event.title;
    const hasTitle = event.content || 
                    (typeof titleObj === 'string' ? titleObj : 
                     (titleObj && (titleObj.simpleTitle || titleObj.fullTitle || titleObj.colorTitle)));
    
    const eventlogField = (event as any).eventlog;
    let hasEventlog = false;
    
    if (eventlogField) {
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
    }
    
    if (!hasTitle && !hasEventlog) {
      return; // 完全空白的事件，直接忽略
    }
    
    // 处理事件更新...
  });
});
```

**视觉样式**:

```css
/* EventLineElement.tsx */
.unified-event-line.deleted-line {
  text-decoration: line-through;
  opacity: 0.6;
  pointer-events: none;  /* 禁止交互 */
}
```

**状态竖线**: 灰色 (`#9CA3AF`) + "Del" 标签

**EventHistoryService.getExistingEventsAtTime()**:

这个方法是 Ghost 事件准确性的核心，负责计算"某个时间点存在哪些事件"：

```typescript
static getExistingEventsAtTime(timestamp: string): Set<string> {
  const targetTime = parseLocalTimeString(timestamp);
  
  // 1. 从当前存在的事件开始
  const existingEvents = new Set<string>(
    EventService.getAllEvents().map(e => e.id)
  );
  
  // 2. 分析每个事件的生命周期
  const eventLifecycle = new Map<string, { createTime?: Date; deleteTime?: Date }>();
  allLogs.forEach(log => {
    if (log.operation === 'create') lifecycle.createTime = logTime;
    if (log.operation === 'delete') lifecycle.deleteTime = logTime;
  });
  
  // 3. 调整事件集合
  eventLifecycle.forEach((lifecycle, eventId) => {
    // 创建时间晚于目标 → 移除（目标时刻还没创建）
    if (lifecycle.createTime && lifecycle.createTime > targetTime) {
      existingEvents.delete(eventId);
    }
    // 删除时间晚于目标 && 创建时间早于目标 → 添加（目标时刻还存在）
    else if (lifecycle.deleteTime && lifecycle.deleteTime > targetTime &&
             (!lifecycle.createTime || lifecycle.createTime <= targetTime)) {
      existingEvents.add(eventId);
    }
  });
  
  return existingEvents;
}
```

**边界情况处理**:
- ✅ 事件在历史记录之前就存在（没有 create 记录）→ 默认算作存在
- ✅ 事件创建和删除都在目标时间之后 → 不存在
- ✅ 事件删除在目标时间之前 → 不存在
- ✅ 事件删除在目标时间之后 → 存在

**状态到竖线的转换**:

```typescript
const eventStatuses = useMemo(() => {
  const statusMap = new Map<string, Set<Status>>();
  
  editorItems.forEach((item, index) => {
    const statuses = getEventStatuses(item.id);
    statuses.forEach(status => {
      if (!statusMap.has(status)) {
        statusMap.set(status, new Set());
      }
      statusMap.get(status)!.add(index);
    });
  });
  
  return statusMap;
}, [editorItems, dateRange]);

// 生成 segments
const segments = useMemo(() => {
  const result: StatusLineSegment[] = [];
  
  eventStatuses.forEach((indices, status) => {
    const sortedIndices = Array.from(indices).sort((a, b) => a - b);
    
    // 合并连续的索引为一个 segment
    let segmentStart = sortedIndices[0];
    let segmentEnd = sortedIndices[0];
    
    for (let i = 1; i < sortedIndices.length; i++) {
      if (sortedIndices[i] === segmentEnd + 1) {
        segmentEnd = sortedIndices[i];
      } else {
        result.push({
          startIndex: segmentStart,
          endIndex: segmentEnd,
          status,
          label: getStatusLabel(status)
        });
        segmentStart = sortedIndices[i];
        segmentEnd = sortedIndices[i];
      }
    }
    
    result.push({
      startIndex: segmentStart,
      endIndex: segmentEnd,
      status,
      label: getStatusLabel(status)
    });
  });
  
  return result;
}, [eventStatuses]);
```

---

## 🔄 数据流

```
用户选择日期范围
     ↓
onDateRangeChange(start, end)
     ↓
触发 getEventStatuses() 重新计算
     ↓
遍历 editorItems，查询每个事件的状态
     ↓
生成 statusMap: Map<Status, Set<index>>
     ↓
合并连续索引，生成 segments[]
     ↓
传递给 StatusLineContainer
     ↓
计算列分配（相同状态连续则使用同列）
     ↓
DOM 测量（getBoundingClientRect）
     ↓
渲染竖线 + 标签
```

---

## 🧪 测试验证

### 功能测试

#### 1. 基础状态显示
- [x] New 状态：创建新事件后在时间范围内显示蓝色竖线
- [x] Updated 状态：修改事件内容后显示黄色竖线
- [x] Done 状态：勾选事件后显示绿色竖线
- [x] Missed 状态：未完成的过期事件显示红色竖线
- [x] Deleted 状态：删除事件后显示灰色竖线

#### 2. 复杂场景
- [x] 多状态共存：一个事件同时显示 New + Updated 竖线
- [x] 状态连续性：相邻事件的相同状态在同一列连续
- [x] 日期范围切换：切换时间范围后竖线实时更新
- [x] Check/Uncheck 切换：勾选→取消勾选→再勾选，状态正确

#### 3. Done 状态精确性
- [x] 场景1：事件最后操作是 check-in → 显示 Done ✅
- [x] 场景2：事件最后操作是 uncheck → 不显示 Done ✅
- [x] 场景3：checked 和 unchecked 数组都有值 → 比较时间戳 ✅
- [x] 场景4：旧事件只有 isCompleted 字段 → 迁移到新机制 ✅

#### 4. EventLog 多行支持
- [x] 事件有多行 eventlog → 竖线覆盖所有行
- [x] 添加/删除 eventlog → 竖线高度自动调整
- [x] 折叠/展开 eventlog → ResizeObserver 自动更新

#### 5. EventLog 多行支持
- [x] 事件有多行 eventlog → 竖线覆盖所有行
- [x] 添加/删除 eventlog → 竖线高度自动调整
- [x] 折叠/展开 eventlog → ResizeObserver 自动更新

#### 6. Ghost 事件过滤（v2.5 2025-11-29 更新）

**空白事件过滤逻辑**（三层防护）:

1. **Snapshot Ghost 过滤** (PlanManager.tsx L1548-1578) ✅
   - [x] 场景1：标题为空 + eventlog 为空 → **不显示** ghost ✅
   - [x] 场景2：标题为空 + eventlog 有内容 → 显示 ghost ✅
   - [x] 场景3：标题有内容 + eventlog 为空 → 显示 ghost ✅
   - [x] 场景4：标题有内容 + eventlog 有内容 → 显示 ghost ✅
   - [x] 场景5：eventlog 为字符串格式（空白） → 正确识别为空 ✅
   - [x] 场景6：eventlog 为 EventLog 对象（所有字段为空） → 正确识别为空 ✅
   - [x] 场景7：eventlog 为 EventLog 对象（任一字段有内容） → 正确识别为非空 ✅

2. **初始化过滤** (PlanManager.tsx L383-415) ✅ 新增
   - [x] 从 EventService 加载时过滤空白事件 → 不加载到内存
   - [x] 与 Ghost 过滤逻辑一致 → 标题和 eventlog 都为空则过滤

3. **eventsUpdated 监听器过滤** (PlanManager.tsx L718-744) ✅ 新增
   - [x] 外部事件更新时检测空白 → 直接忽略，不触发状态更新
   - [x] 与 Ghost 过滤逻辑一致 → 标题和 eventlog 都为空则忽略

**统一的空白检测标准**:
```typescript
// 标题检查（支持多种格式）
const hasTitle = event.content || 
                (titleObj?.simpleTitle || titleObj?.fullTitle || titleObj?.colorTitle);

// eventlog 检查（支持字符串和对象格式）
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

// 过滤规则：标题和 eventlog 都为空 → 完全空白事件
if (!hasTitle && !hasEventlog) {
  return false; // 过滤掉
}
```

**修复效果**:
- ✅ **正常模式**: 不显示空白事件
- ✅ **Snapshot 模式**: 不显示空白事件（包括 ghost）
- ✅ **外部更新**: 忽略空白事件更新
- ✅ **性能优化**: filter-not-load 策略，不加载到内存

#### 7. 性能测试
- [x] 100+ 事件 → 竖线渲染流畅（< 100ms）
- [x] 快速切换日期 → 防抖避免重复计算
- [x] 滚动列表 → 竖线位置跟随正确

---

## 📝 代码文件清单

### 新增文件
- `src/components/StatusLineContainer.tsx` (343 lines)
- `src/components/StatusLineContainer.css` (125 lines)

### 修改文件
- `src/components/PlanManager.tsx`:
  - `getEventStatuses()` 方法 (L1320-1470)
  - `eventStatuses` useMemo (L1472-1495)
  - `segments` useMemo (L1497-1542)
  - 日期范围规范化 (L379-385, L1153-1164)
  - StatusLineContainer 集成 (L2020-2028)

- `src/components/PlanSlateEditor/EventLinePrefix.tsx`:
  - 从 `isCompleted` 迁移到 `getCheckInStatus()` (L23-25)
  - 更新 onChange 逻辑 (L70-81)
  - 更新 React.memo 比较逻辑 (L107-117)

- `src/services/EventHistoryService.ts`:
  - `queryHistory()` 时间范围过滤优化 (L169-178)

- `src/services/EventService.ts`:
  - `getCheckInStatus()` 返回详细信息 (L932-966)

### 依赖的现有服务
- `EventService`: 事件查询和状态获取
- `EventHistoryService`: 历史记录查询
- `formatTimeForStorage()`: 时间格式化

---

## 🔧 配置与常量

```typescript
// StatusLineContainer.tsx
const LINE_WIDTH = 2;        // 竖线宽度（px）
const LINE_SPACING = 3;      // 竖线间距（px）
const LABEL_SPACING = 8;     // 标签与竖线间距（px）
const BASE_LEFT = 5;         // 基础左边距（px）

// 状态颜色映射
const STATUS_COLORS = {
  'new': '#3B82F6',
  'updated': '#F59E0B',
  'done': '#10B981',
  'missed': '#EF4444',
  'deleted': '#9CA3AF'
};

// 状态标签映射
const STATUS_LABELS = {
  'new': 'New',
  'updated': 'Updated',
  'done': 'Done',
  'missed': 'Missed',
  'deleted': 'Del'
};
```

---

## 🚀 未来优化方向

### v1.1 计划功能
- [ ] **标签可点击**: 点击标签过滤显示对应状态的事件
- [ ] **Hover 提示**: 鼠标悬停竖线显示详细信息（变更时间、操作人等）
- [ ] **动画过渡**: 日期切换时竖线淡入淡出动画
- [ ] **虚拟滚动**: 超大列表（1000+ 事件）性能优化

### v1.2 增强特性
- [ ] **自定义状态**: 允许用户自定义状态类型和颜色
- [ ] **批量操作**: 框选某列竖线批量处理事件
- [ ] **导出视图**: 导出快照为图片或PDF
- [ ] **协作标注**: 多人协作时显示操作者头像

---

## 📚 相关文档

- [PlanManager 模块 PRD](./PLANMANAGER_MODULE_PRD.md)
- [EventHistoryService 架构](../architecture/EVENT_HISTORY_SERVICE.md)
- [PlanSlateEditor PRD](./SLATE_EDITOR_PRD.md)
- [时间架构文档](../TIME_ARCHITECTURE.md)

---

## 🎓 开发者笔记

### 关键设计决策

1. **为什么使用 DOM 测量而不是虚拟计算？**
   - EventLog 多行内容高度不固定
   - 用户可能自定义字体大小
   - DOM 测量确保像素级精准

2. **为什么 Done 状态不依赖历史记录？**
   - 性能优化：避免每次都查询历史
   - 数据一致性：`checked[]` 数组是唯一真相来源
   - 旧数据迁移：历史记录可能不完整

3. **为什么竖线列分配要保持连续性？**
   - 用户体验：清晰看出哪些事件属于同一个"流程"
   - 视觉简洁：避免竖线跳跃造成混乱
   - 设计规范：符合 Figma 设计意图

### 常见问题排查

**问题1**: 竖线位置不准确
- 检查 `data-event-line` 和 `data-event-id` 属性是否正确
- 确认 `editorItems` 的 index 与 DOM 顺序一致
- 查看 ResizeObserver 是否正常触发

**问题2**: Done 状态不正确
- 检查 `event.checked` 和 `event.unchecked` 数组
- 确认时间戳格式为 ISO 8601
- 验证 `EventService.getCheckInStatus()` 的排序逻辑

**问题3**: 竖线不连续
- 查看控制台 `[StatusLineContainer] 🔗/🆕` 日志
- 确认 `statusColumnsAtLine` 映射正确
- 检查 segment 的 `startIndex/endIndex` 是否连续

---

## 📝 更新日志

### 2025-11-24

#### Bug Fix 1: Missed 状态判定逻辑错误
- **问题**: 直接使用 `eventTime < rangeEnd` 导致未来事件被错误标记为 missed
- **修复**: 使用 `min(now, rangeEnd)` 作为判定截止时间
- **影响**: 查看当前时间范围时，未来事件不再被标记为 missed
- **文件**: `PlanManager.tsx` - `getEventStatuses()` 函数

#### Bug Fix 2: Ghost 事件显示错误时间范围 ⚠️ **Critical Fix**
- **问题描述**: 
  - 页面初始加载时默认选择"本周"时间范围（包含今天）
  - 本周范围内删除的事件会被添加为 ghost 事件（带删除线的灰色事件）
  - Ghost 事件被序列化到 Slate 编辑器的内部状态中
  - 当用户切换到其他时间范围（如 28-29 号）时，虽然 `editorItems` 重新计算不包含 ghost，但编辑器已渲染的 ghost 事件无法移除
  - 导致在错误的时间范围内显示 ghost 事件（例如：23 号删除的事件出现在 28-29 号的快照中）

- **根本原因**: React 组件缓存机制
  - PlanSlateEditor 没有 `key` 属性
  - 当 `dateRange` 变化时，React 认为是同一个组件，只更新 props
  - Slate 编辑器的内部状态（已渲染的节点）不会被重置
  - Ghost 事件标记（`_isDeleted: true`）被保留在编辑器中

- **修复方案**: 强制编辑器重置
  ```typescript
  <PlanSlateEditor
    key={dateRange ? `snapshot-${dateRange.start.getTime()}-${dateRange.end.getTime()}` : 'normal'}
    items={editorItems}
    onChange={debouncedOnChange}
    getEventStatus={getEventStatus}
  />
  ```
  - 每次 `dateRange` 变化时，`key` 改变
  - React 完全销毁旧编辑器组件，创建新实例
  - 新编辑器从 `editorItems` 重新初始化，不包含旧的 ghost 事件
  - 切换回正常模式时，`key='normal'` 确保编辑器重置

- **防御性修复**: 多层 Ghost 事件过滤
  ```typescript
  // 1. 初始化时过滤（PlanManager.tsx L298-303）
  const rawEvents = EventService.getAllEvents();
  const allEvents = rawEvents.filter(e => !(e as any)._isDeleted);
  if (rawEvents.length !== allEvents.length) {
    console.warn('[PlanManager] 🚨 发现并过滤了', rawEvents.length - allEvents.length, '个 ghost 事件！');
  }
  
  // 2. 保存时过滤（PlanManager.tsx L876）
  const realItems = updatedItems.filter(item => !(item as any)._isDeleted);
  
  // 3. Snapshot 模式诊断（PlanManager.tsx L1291-1299）
  const ghostsInFiltered = filteredItems.filter((item: any) => item._isDeleted);
  if (ghostsInFiltered.length > 0) {
    console.error('[PlanManager] 🚨 filteredItems 中发现 ghost 事件！', ...);
  }
  ```

- **Snapshot Ghost 事件生成逻辑**（正确实现）:
  ```typescript
  // PlanManager.tsx - editorItems useMemo (L1283-1350)
  if (dateRange) {
    const startTime = formatTimeForStorage(dateRange.start);
    const endTime = formatTimeForStorage(dateRange.end);
    
    // 1. 获取起点时刻存在的所有事件
    const existingAtStart = EventHistoryService.getExistingEventsAtTime(startTime);
    
    // 2. 筛选出起点时存在的事件（未删除的）
    allItems = filteredItems.filter(item => existingAtStart.has(item.id));
    
    // 3. 查询时间范围内的所有操作
    const operations = EventHistoryService.queryHistory({ startTime, endTime });
    
    // 4. 添加范围内删除的事件为 ghost（仅当它们在起点时存在）
    const deleteOpsInRange = operations.filter(op => 
      op.operation === 'delete' && 
      op.before &&
      existingAtStart.has(op.eventId)
    );
    
    deleteOpsInRange.forEach(log => {
      allItems.push({
        ...log.before,
        _isDeleted: true,
        _deletedAt: log.timestamp
      } as any);
    });
  }
  ```

- **影响范围**: 
  - Snapshot 功能的所有时间范围切换
  - Ghost 事件（删除的事件）的显示准确性
  - 编辑器状态管理的可靠性

- **测试验证**:
  - ✅ 页面加载默认本周 → 显示本周删除的 ghost 事件
  - ✅ 切换到未来日期（28-29 号）→ ghost 事件消失
  - ✅ 切换回本周 → ghost 事件重新出现
  - ✅ 编辑器内容完全重置，无残留状态

- **相关文件**:
  - `PlanManager.tsx` - L2043 (PlanSlateEditor key 属性)
  - `PlanManager.tsx` - L1283-1350 (Ghost 事件生成逻辑)
  - `PlanManager.tsx` - L298-303 (初始化过滤)
  - `PlanManager.tsx` - L876 (保存时过滤)

### 2025-11-25

#### Bug Fix 3: Snapshot 模式下 checkbox 状态刷新后丢失 ⚠️ **Critical Fix**

- **问题描述**:
  - 在 Snapshot 模式下勾选事件 checkbox，界面立即显示勾选状态
  - 刷新页面后，"Done" 状态竖线仍然显示，但 checkbox 变回未勾选状态
  - 普通模式（非 Snapshot）下 checkbox 状态正常持久化

- **根本原因**: Ghost 事件的 `checked/unchecked` 数组未传递到 Slate metadata
  1. Ghost 事件从 `EventHistoryService` 的 `log.before` 创建，包含删除时的完整状态
  2. `planItemsToSlateNodes()` 将事件转换为 Slate 节点时创建 `metadata` 对象
  3. **关键缺失**: `metadata` 没有包含 `checked` 和 `unchecked` 数组
  4. `EventLinePrefix` 从 `metadata.checked/unchecked` 计算 `isCompleted` 状态
  5. 由于 metadata 缺少这些数组，checkbox 总是显示为未勾选

- **数据流分析**:
  ```typescript
  // ❌ 修复前：checked/unchecked 数组丢失
  EventHistoryService.log.before (含 checked[])
    → PlanManager.editorItems (含 checked[])
      → planItemsToSlateNodes() 
        → metadata (❌ 不含 checked/unchecked)
          → EventLinePrefix.isCompleted (总是 false)
  
  // ✅ 修复后：完整传递
  EventHistoryService.log.before (含 checked[])
    → PlanManager.editorItems (含 checked[])
      → planItemsToSlateNodes() 
        → metadata (✅ 含 checked/unchecked)
          → EventLinePrefix.isCompleted (正确计算)
  ```

- **修复方案**:
  ```typescript
  // src/components/PlanSlateEditor/serialization.ts
  const metadata: EventMetadata = {
    // ... 其他字段 ...
    
    // ✅ v2.14: Checkbox 状态数组（用于 EventLinePrefix 计算 isCompleted）
    checked: item.checked || [],
    unchecked: item.unchecked || [],
    
    // ... 其他字段 ...
  };
  ```

- **为什么 "Done" 竖线仍然正确显示？**
  - `getEventStatuses()` 直接从 `EventService.getCheckInStatus(eventId)` 读取状态
  - EventService 的数据来自 localStorage，不受 Slate metadata 影响
  - 所以 "Done" 状态竖线显示正确，但 checkbox UI 状态错误

- **影响范围**:
  - Snapshot 模式下的所有事件（包括 ghost 事件）
  - 普通模式不受影响（因为 eventsUpdated 监听器会同步状态）
  - 页面刷新后的状态持久化

- **测试验证**:
  - ✅ Snapshot 模式勾选事件 → checkbox 立即显示
  - ✅ 刷新页面 → checkbox 状态保持
  - ✅ "Done" 竖线和 checkbox 状态一致
  - ✅ Ghost 事件的 checkbox 状态也正确显示

- **相关文件**:
  - `serialization.ts` - L107-109 (添加 checked/unchecked 到 metadata)

---

### 2025-11-28

#### Enhancement 1: 完全空白事件过滤优化 ✨ **Feature Enhancement**

- **问题描述**:
  - Snapshot 模式下显示已删除的 ghost 事件（带删除线）
  - 原有过滤逻辑只检查 `title` 字段是否为空
  - 用户可能创建了有 eventlog 但无标题的事件，删除后仍显示在 snapshot 中
  - 或者创建了完全空白的事件（标题和 eventlog 都为空），删除后不应该显示

- **用户需求**: "完全空白的event（标题和eventlog都空白），不应该出现在snapshot里"

- **优化方案**: 增强 Ghost 事件过滤逻辑（步骤 2）
  ```typescript
  // PlanManager.tsx - L1375-1409
  
  // 步骤 2.1: 检查标题内容
  const titleObj = log.before.title;
  const hasTitle = log.before.content || 
                  (typeof titleObj === 'string' ? titleObj : 
                   (titleObj && (titleObj.simpleTitle || titleObj.fullTitle)));
  
  // 步骤 2.2: 检查 eventlog 内容
  const eventlogField = log.before.eventlog;
  let hasEventlog = false;
  
  if (eventlogField) {
    if (typeof eventlogField === 'string') {
      // 字符串格式：去除空白后检查是否有内容
      hasEventlog = eventlogField.trim().length > 0;
    } else if (typeof eventlogField === 'object' && eventlogField !== null) {
      // EventLog 对象格式：检查 slateJson, html, plainText
      const slateContent = eventlogField.slateJson || '';
      const htmlContent = eventlogField.html || '';
      const plainContent = eventlogField.plainText || '';
      
      // 任一字段有实质内容即算有 eventlog
      hasEventlog = slateContent.trim().length > 0 || 
                   htmlContent.trim().length > 0 || 
                   plainContent.trim().length > 0;
    }
  }
  
  // 只有标题和eventlog都为空时才跳过
  if (!hasTitle && !hasEventlog) {
    console.log('[PlanManager] ⏭️ 跳过完全空白 ghost (无标题且无eventlog):', log.eventId.slice(-8));
    return;
  }
  ```

- **过滤规则更新** (v2.4 三步过滤公式):
  1. **checkType 过滤**: 必须有有效的 checkType 且不为 'none'
  2. **完全空白过滤**: 标题 **AND** eventlog 都为空才跳过（从 **OR** 改为 **AND**）
  3. **系统事件过滤**: isTimer/isTimeLog/isOutsideApp === true

- **过滤场景覆盖**:
  | 标题 | EventLog | 结果 | 说明 |
  |------|----------|------|------|
  | ❌ 空 | ❌ 空 | **不显示** ghost | 完全空白事件 ✅ |
  | ❌ 空 | ✅ 有内容 | 显示 ghost | 有实质内容 |
  | ✅ 有内容 | ❌ 空 | 显示 ghost | 有实质内容 |
  | ✅ 有内容 | ✅ 有内容 | 显示 ghost | 有实质内容 |

- **EventLog 格式支持**:
  - ✅ 字符串格式: `eventlog: "content"` → 检查 `trim().length > 0`
  - ✅ 对象格式: `eventlog: { slateJson, html, plainText }` → 检查所有字段
  - ✅ 空字符串: `eventlog: ""` → 正确识别为空
  - ✅ 空白字符: `eventlog: "   "` → 正确识别为空（trim 后）

- **改进效果**:
  - 🎯 **精准过滤**: 只过滤真正没有任何内容的事件
  - 📊 **完整展示**: 有 eventlog 记录的事件保留在 snapshot 中
  - 🧹 **清理噪音**: 删除测试事件/空白占位符不再污染 snapshot 视图
  - 💡 **符合直觉**: 用户删除空白事件后不会在历史中看到它

- **测试验证**:
  - ✅ 创建空白事件（标题和eventlog都为空）→ 删除 → snapshot 不显示 ✅
  - ✅ 创建标题为空但有eventlog的事件 → 删除 → snapshot 显示 ✅
  - ✅ 创建有标题但eventlog为空的事件 → 删除 → snapshot 显示 ✅
  - ✅ 创建有标题且有eventlog的事件 → 删除 → snapshot 显示 ✅
  - ✅ EventLog 字符串格式空白 → 正确识别为空 ✅
  - ✅ EventLog 对象格式所有字段空白 → 正确识别为空 ✅

- **相关文件**:
  - `PlanManager.tsx` - L1375-1409 (Ghost 事件过滤逻辑)
  - `SNAPSHOT_STATUS_VISUALIZATION_PRD.md` - L330-378 (PRD 文档更新)
  - `EventLinePrefix.tsx` - L27-35 (从 metadata 计算 isCompleted)
  - `PlanManager.tsx` - L1485-1575 (getEventStatuses 使用 EventService)

- **关联修复**: 
  - v2.14 Checkbox 状态实时同步机制（2025-11-24）
  - 确保 eventsUpdated 事件同步 checked/unchecked 数组到 Slate metadata

---

**最后更新**: 2025-11-25  
**维护者**: GitHub Copilot + Zoey  
**版本**: v1.0.2 - 修复 Snapshot 模式下 checkbox 状态刷新后丢失

