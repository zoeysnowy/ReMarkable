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

### 核心特性

- ✅ **5种状态类型**: New（新建）、Updated（更新）、Done（完成）、Missed（错过）、Deleted（删除）
- ✅ **多线并行**: 每个事件可以同时显示多条不同颜色的竖线
- ✅ **智能列分配**: 相同状态的连续事件使用同一列，实现竖线连续性
- ✅ **自适应缩进**: 根据竖线数量动态调整内容左侧缩进
- ✅ **实时响应**: 日期范围变化时竖线实时更新
- ✅ **DOM精确定位**: 基于实际DOM元素位置测量，支持事件多行内容（eventlog）
- ✅ **标签智能定位**: 每个状态只显示一次标签，自动定位到对应竖线的中心

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

#### 5. 性能测试
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

- `src/components/UnifiedSlateEditor/EventLinePrefix.tsx`:
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
- [UnifiedSlateEditor PRD](./SLATE_EDITOR_PRD.md)
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
  - UnifiedSlateEditor 没有 `key` 属性
  - 当 `dateRange` 变化时，React 认为是同一个组件，只更新 props
  - Slate 编辑器的内部状态（已渲染的节点）不会被重置
  - Ghost 事件标记（`_isDeleted: true`）被保留在编辑器中

- **修复方案**: 强制编辑器重置
  ```typescript
  <UnifiedSlateEditor
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
  - `PlanManager.tsx` - L2043 (UnifiedSlateEditor key 属性)
  - `PlanManager.tsx` - L1283-1350 (Ghost 事件生成逻辑)
  - `PlanManager.tsx` - L298-303 (初始化过滤)
  - `PlanManager.tsx` - L876 (保存时过滤)

---

**最后更新**: 2025-11-24  
**维护者**: GitHub Copilot + Zoey  
**版本**: v1.0.1 - 修复 Ghost 事件显示错误和 Missed 状态判定
