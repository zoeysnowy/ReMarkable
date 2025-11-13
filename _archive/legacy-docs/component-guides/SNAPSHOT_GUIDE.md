# 📸 增量快照功能使用指南

## 🎯 功能概述

增量快照 (Incremental Snapshot) 是一个基于差异存储的历史记录系统，允许用户：

- 📅 **按日期查看计划状态**：在日历上点选不同日期，查看当天的 todo-list 状态
- ✅ **追踪完成情况**：查看哪些任务被勾选完成 (checked)
- ⏸️ **追踪搁置任务**：查看哪些任务未完成但被搁置 (dropped)
- ➕ **追踪新增任务**：查看哪些任务是新添加的
- ❌ **追踪删除任务**：查看哪些任务被删除

---

## 🏗️ 技术架构

### 核心原理

采用 **Git-like 增量存储**，而非全量快照：

1. **基准快照 (Base Snapshot)**：每天/每周创建一次完整的状态副本
2. **变化记录 (Change Records)**：记录每次操作产生的差异 (patches)
3. **状态重建**：通过 `Base Snapshot + Patches` 重建任意时间点的状态

```
┌─────────────────────────────────────────────────────────┐
│ 2025-10-28 00:00:00 - Base Snapshot (完整状态)         │
├─────────────────────────────────────────────────────────┤
│ 2025-10-28 09:15:23 - Change: 添加任务 #123            │
│ 2025-10-28 10:30:45 - Change: 完成任务 #45             │
│ 2025-10-28 14:20:10 - Change: 删除任务 #67             │
├─────────────────────────────────────────────────────────┤
│ 2025-10-29 00:00:00 - Base Snapshot (完整状态)         │
└─────────────────────────────────────────────────────────┘
```

---

## 📦 依赖库

```json
{
  "yjs": "^13.6.15",        // CRDT 核心库（无冲突协作）
  "y-protocols": "^1.0.6",  // Yjs 协议扩展
  "lib0": "^0.2.97"         // Yjs 底层工具库
}
```

**为什么选择 Yjs (CRDT)？**

| 特性 | Yjs (CRDT) | fast-json-patch |
|------|-----------|-----------------|
| **冲突解决** | ✅ 自动无冲突合并 | ❌ 需要手动处理冲突 |
| **离线协作** | ✅ 原生支持 | ⚠️ 需要额外实现 |
| **性能** | ✅ 增量更新高效 | ⚠️ 大数据时较慢 |
| **TypeScript** | ✅ 完整支持 | ✅ 完整支持 |
| **大小** | ~35KB (gzip) | ~8KB (gzip) |
| **多用户协作** | ✅ 天然支持 | ❌ 需要 OT 算法 |
| **状态压缩** | ✅ 自动优化 | ❌ 需要手动实现 |
| **网络同步** | ✅ 内置 WebSocket/WebRTC | ❌ 需要自己实现 |

**CRDT 优势**：
- 🔄 **无冲突合并**：多用户同时编辑自动合并，无需锁定
- 🌐 **分布式**：支持 P2P 同步，无需中心服务器
- ⚡ **高性能**：增量更新，只传输变化部分
- 📱 **离线优先**：断网时继续编辑，联网后自动同步

---

## 🔧 核心 API

### 1. 创建基准快照

```typescript
import { snapshotService } from './services/snapshotService';

// 手动创建基准快照（推荐每天创建一次）
const snapshot = snapshotService.createBaseSnapshot(planItems);

console.log(snapshot);
// {
//   id: "base-2025-10-28",
//   date: "2025-10-28",
//   timestamp: 1730102400000,
//   items: [...], // 完整的 PlanItem 列表
//   version: 1
// }
```

### 2. 记录变化

```typescript
// 在每次操作后记录变化（添加/删除/修改任务）
const oldItems = [...]; // 修改前的状态
const newItems = [...]; // 修改后的状态

const record = snapshotService.recordChange(oldItems, newItems);

console.log(record);
// {
//   id: "change-1730102450000",
//   date: "2025-10-28",
//   timestamp: 1730102450000,
//   patches: [
//     { op: "add", path: "/items/-", value: {...} },
//     { op: "replace", path: "/items/0/isCompleted", value: true }
//   ]
// }
```

### 3. 恢复快照

```typescript
// 恢复指定日期的状态
const items = snapshotService.restoreSnapshot('2025-10-28');

console.log(items); // 2025-10-28 当天的完整 PlanItem 列表
```

### 4. 获取每日快照视图

```typescript
// 获取包含变化分析的快照
const dailySnapshot = snapshotService.getDailySnapshot('2025-10-28');

console.log(dailySnapshot);
// {
//   date: "2025-10-28",
//   items: [...], // 当天的完整列表
//   changes: {
//     added: [...],   // 新增的任务
//     checked: [...], // 完成的任务
//     dropped: [...], // 搁置的任务
//     deleted: ['id1', 'id2'] // 删除的任务 ID
//   }
// }
```

### 5. 清理旧快照

```typescript
// 保留最近 30 天的数据（性能优化）
snapshotService.cleanupOldSnapshots(30);
```

---

## 🚀 在 PlanManager 中集成

### 步骤 1: 监听数据变化

```typescript
// src/components/PlanManager.tsx
import { snapshotService } from '../services/snapshotService';
import { useEffect, useRef } from 'react';

function PlanManager() {
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const prevItemsRef = useRef<PlanItem[]>([]);

  // 初始化时创建基准快照
  useEffect(() => {
    const savedItems = loadFromLocalStorage();
    setPlanItems(savedItems);
    
    // 创建今天的基准快照（如果还没有）
    snapshotService.createBaseSnapshot(savedItems);
    prevItemsRef.current = savedItems;
  }, []);

  // 监听数据变化，自动记录
  useEffect(() => {
    if (prevItemsRef.current.length === 0) return;

    // 记录变化
    snapshotService.recordChange(prevItemsRef.current, planItems);
    prevItemsRef.current = planItems;
  }, [planItems]);

  // ... rest of component
}
```

### 步骤 2: 日历点击时查看历史

```typescript
// 在日历组件中
function CalendarView() {
  const [selectedDate, setSelectedDate] = useState<string>('2025-10-28');

  const handleDateClick = (date: string) => {
    setSelectedDate(date);
    
    // 获取该日期的快照
    const dailySnapshot = snapshotService.getDailySnapshot(date);
    
    // 显示在 UI 中
    console.log('该日期的任务:', dailySnapshot.items);
    console.log('新增任务:', dailySnapshot.changes.added);
    console.log('完成任务:', dailySnapshot.changes.checked);
    console.log('搁置任务:', dailySnapshot.changes.dropped);
    console.log('删除任务:', dailySnapshot.changes.deleted);
  };

  return (
    <Calendar onDateClick={handleDateClick} />
  );
}
```

---

## 📊 数据结构详解

### 1. PlanItem 扩展（建议）

为了支持 "dropped" 状态，建议扩展 `PlanItem` 接口：

```typescript
export interface PlanItem {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  dueDate?: string;
  startTime?: string;
  endTime?: string;
  isCompleted: boolean;
  isDropped?: boolean; // 新增：是否已搁置
  priority?: number;
  children?: PlanItem[];
  level?: number;
  createdAt?: string;
  updatedAt?: string;
}
```

### 2. JSON Patch 格式示例 → Yjs CRDT 更新

**传统 JSON Patch 方式**（已弃用）：
```typescript
// 添加任务
{ "op": "add", "path": "/items/-", "value": {...} }

// 完成任务
{ "op": "replace", "path": "/items/0/isCompleted", "value": true }

// 删除任务
{ "op": "remove", "path": "/items/2" }
```

**现代 CRDT 方式**（当前实现）：
```typescript
import * as Y from 'yjs';

// 创建 CRDT 文档
const ydoc = new Y.Doc();
const yarray = ydoc.getArray<PlanItem>('planItems');

// 添加任务（自动生成唯一 ID，无冲突）
yarray.push([{
  id: 'item-123',
  title: '新任务',
  isCompleted: false
}]);

// 完成任务（即使多人同时修改也能正确合并）
const item = yarray.get(0);
yarray.delete(0, 1);
yarray.insert(0, [{ ...item, isCompleted: true }]);

// 删除任务（删除操作自动传播到所有客户端）
yarray.delete(2, 1);

// 获取增量更新（用于网络传输）
const update = Y.encodeStateAsUpdate(ydoc);

// 应用增量更新（合并远程变化）
Y.applyUpdate(ydoc, update);
```

**CRDT 关键概念**：
- **Y.Doc**: CRDT 文档，管理所有共享数据
- **Y.Array**: 共享数组类型，支持 push/insert/delete
- **encodeStateAsUpdate**: 编码增量更新（比 JSON Patch 更高效）
- **applyUpdate**: 应用更新（自动解决冲突）
- **状态向量**: 追踪每个客户端的版本，避免重复应用

---

## 💾 存储策略

### LocalStorage 键名

```typescript
const STORAGE_KEYS = {
  BASE_SNAPSHOTS: 'remarkable-plan-base-snapshots',
  CHANGE_RECORDS: 'remarkable-plan-change-records',
  CURRENT_STATE: 'remarkable-plan-items',
  DATE_INDEX: 'remarkable-plan-date-index', // 优化查询
};
```

### 存储占用估算

| 数据类型 | 单条大小 | 30天存储 | 说明 |
|---------|---------|---------|------|
| Base Snapshot | ~50KB | 1.5MB | 假设 500 个任务 |
| Change Record | ~1KB | 30KB | 假设每天 30 次操作 |
| **总计** | - | **~2MB** | 可接受的存储占用 |

---

## 🎨 UI 设计建议

### 1. 日历上的日期标记

```tsx
<Calendar
  renderDate={(date) => (
    <div className="calendar-date">
      <span>{date.getDate()}</span>
      {/* 显示当天的任务变化数量 */}
      <span className="badge">
        +{dailySnapshot.changes.added.length}
        ✓{dailySnapshot.changes.checked.length}
      </span>
    </div>
  )}
/>
```

### 2. 变化详情面板

```tsx
function DailyChangesPanel({ date }: { date: string }) {
  const snapshot = snapshotService.getDailySnapshot(date);

  return (
    <div className="changes-panel">
      <h3>📅 {date} 的变化</h3>
      
      {/* 新增任务 */}
      <section>
        <h4>➕ 新增 ({snapshot.changes.added.length})</h4>
        {snapshot.changes.added.map(item => (
          <TaskCard key={item.id} item={item} />
        ))}
      </section>

      {/* 完成任务 */}
      <section>
        <h4>✅ 完成 ({snapshot.changes.checked.length})</h4>
        {snapshot.changes.checked.map(item => (
          <TaskCard key={item.id} item={item} />
        ))}
      </section>

      {/* 搁置任务 */}
      <section>
        <h4>⏸️ 搁置 ({snapshot.changes.dropped.length})</h4>
        {snapshot.changes.dropped.map(item => (
          <TaskCard key={item.id} item={item} />
        ))}
      </section>

      {/* 删除任务 */}
      <section>
        <h4>❌ 删除 ({snapshot.changes.deleted.length})</h4>
        {snapshot.changes.deleted.map(id => (
          <div key={id} className="deleted-task">{id}</div>
        ))}
      </section>
    </div>
  );
}
```

---

## ⚙️ 配置选项

### 基准快照创建策略

```typescript
// 1. 每天午夜创建基准快照（推荐）
setInterval(() => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() === 0) {
    snapshotService.createBaseSnapshot(planItems);
  }
}, 60000);

// 2. 每周创建基准快照（节省空间）
setInterval(() => {
  const now = new Date();
  if (now.getDay() === 0 && now.getHours() === 0) {
    snapshotService.createBaseSnapshot(planItems);
  }
}, 60000);
```

### 清理策略

```typescript
// 每周清理一次旧快照
setInterval(() => {
  snapshotService.cleanupOldSnapshots(30); // 保留 30 天
}, 7 * 24 * 60 * 60 * 1000);
```

---

## 🔍 调试工具

```typescript
// 查看当前存储的快照
console.log('基准快照:', JSON.parse(
  localStorage.getItem('remarkable-plan-base-snapshots') || '[]'
));

console.log('变化记录:', JSON.parse(
  localStorage.getItem('remarkable-plan-change-records') || '[]'
));

console.log('日期索引:', JSON.parse(
  localStorage.getItem('remarkable-plan-date-index') || '{}'
));
```

---

## ⚠️ 注意事项

### 1. 性能优化

- ✅ **使用日期索引**：快速查询特定日期的记录
- ✅ **定期清理**：避免 LocalStorage 超限（5-10MB）
- ✅ **懒加载**：只在需要时恢复快照

### 2. 数据一致性

- ⚠️ 确保 `prevItems` 和 `newItems` 来自同一时间点
- ⚠️ 避免并发修改导致的 patch 丢失
- ⚠️ 在 `recordChange` 前先更新 LocalStorage

### 3. 边界情况

```typescript
// 第一天没有基准快照
const items = snapshotService.restoreSnapshot('2025-10-28');
// 返回: [] (空数组)

// 恢复未来日期
const futureItems = snapshotService.restoreSnapshot('2099-12-31');
// 返回: 最近的基准快照状态
```

---

## 🚀 未来扩展

### 1. 时间旅行 (Time Travel)

```typescript
// 回到任意时间点（精确到秒）
const itemsAt = snapshotService.restoreSnapshotAtTime(1730102450000);
```

### 2. 多用户实时协作 ⭐ NEW

```typescript
import { WebsocketProvider } from 'y-websocket';

// 连接到协作服务器（支持多用户同时编辑）
const provider = new WebsocketProvider(
  'wss://your-server.com',
  'remarkable-room',
  ydoc
);

// 监听远程更新
ydoc.on('update', (update, origin) => {
  console.log('收到远程更新:', origin);
  // 自动合并，无冲突！
});

// 意识状态（显示其他用户光标位置）
const awareness = provider.awareness;
awareness.setLocalState({
  user: { name: 'Zoey', color: '#00ff00' },
  cursor: { line: 5, col: 10 }
});
```

### 3. 离线协作 ⭐ NEW

```typescript
// 离线时保存更新
const updates: Uint8Array[] = [];
ydoc.on('update', (update) => {
  updates.push(update);
  localStorage.setItem('pending-updates', JSON.stringify(updates));
});

// 联网后批量同步
const pendingUpdates = JSON.parse(localStorage.getItem('pending-updates') || '[]');
pendingUpdates.forEach((update: number[]) => {
  Y.applyUpdate(ydoc, new Uint8Array(update));
});
```

### 4. 导出历史数据

```typescript
// 导出 CSV/JSON
snapshotService.exportHistory('2025-10-01', '2025-10-31', 'json');
```

### 5. 统计分析

```typescript
// 分析生产力趋势
const stats = snapshotService.analyzeProductivity('2025-10-01', '2025-10-31');
// {
//   totalAdded: 150,
//   totalCompleted: 120,
//   completionRate: 0.8,
//   avgTasksPerDay: 5
// }
```

### 6. 版本分支与合并 ⭐ NEW

```typescript
// 创建分支（类似 Git）
const branchDoc = ydoc.clone();

// 在分支上修改
branchDoc.getArray('planItems').push([newItem]);

// 合并分支（自动解决冲突）
const branchUpdate = Y.encodeStateAsUpdate(branchDoc);
Y.applyUpdate(ydoc, branchUpdate);
```

---

## 📚 参考资源

- [Yjs 官方文档](https://docs.yjs.dev/)
- [CRDT 技术详解](https://crdt.tech/)
- [Yjs GitHub](https://github.com/yjs/yjs)
- [y-websocket 协作](https://github.com/yjs/y-websocket)
- [y-protocols](https://github.com/yjs/y-protocols)
- [CRDT 论文集](https://crdt.tech/papers.html)
- [实时协作编辑器设计](https://josephg.com/blog/crdts-are-the-future/)

---

**创建日期**: 2025-10-28  
**更新日期**: 2025-11-04 (迁移到 Yjs CRDT)  
**版本**: 2.0.0 (从 JSON Patch 升级到 CRDT)  
**作者**: ReMarkable Team
