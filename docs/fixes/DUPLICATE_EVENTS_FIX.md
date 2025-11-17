# 重复事件问题诊断与修复方案

## 问题分析

### 发现的问题
localStorage 中事件数量从预期的 1000+ 爆炸到 7600+，怀疑是同步或索引重建过程中产生了重复。

### 根本原因

#### 1. **eventlog 字段丢失导致事件被判定为"更新"**
   
**背景**: 
- v1.8 引入了 `eventlog` 字段（富文本，ReMarkable 内部使用）
- `description` 字段用于 Outlook 同步（纯文本）
- 参考文档: `docs/TIMELOG_ARCHITECTURE.md`

**问题**:
在 `ActionBasedSyncManager.ts` 的同步逻辑中：

```typescript
// ❌ 旧代码 - create case (Line 2770)
events[eventIndex] = {
  ...newEvent,
  id: existingEvent.id,
  tagId: existingEvent.tagId || newEvent.tagId,
  syncStatus: 'synced',
  // ⚠️ 缺少: eventlog 字段被覆盖为 undefined
};

// ❌ 旧代码 - update case (Line 2831)
const updatedEvent = {
  ...events[eventIndex],
  title: action.data.subject || '',
  description: cleanDescription,
  // ⚠️ 缺少: eventlog 字段可能被覆盖
  ...
};
```

**后果**:
1. 本地事件有 `eventlog` 字段（富文本）
2. Outlook 同步回来的事件没有 `eventlog`
3. 字段差异导致事件被判定为"需要更新"
4. 每次同步都创建"更新"，实际可能创建了重复事件

#### 2. **去重检查的时机问题**

`deduplicateEvents()` 函数只在初始化时调用，没有在每次同步后执行。如果同步过程中产生重复，需要等到下次重启才会清理。

## 修复方案

### ✅ 修复 1: 保留 eventlog 字段

**文件**: `src/services/ActionBasedSyncManager.ts`

**修改位置 1** (Line ~2770, create case):
```typescript
events[eventIndex] = {
  ...newEvent,
  id: existingEvent.id,
  tagId: existingEvent.tagId || newEvent.tagId,
  eventlog: existingEvent.eventlog || newEvent.eventlog,  // 🆕 保留本地的 eventlog 字段
  syncStatus: 'synced',
};
```

**修改位置 2** (Line ~2831, update case):
```typescript
const updatedEvent = {
  ...events[eventIndex], // ✅ 已经包含 eventlog，不会被覆盖
  title: action.data.subject || '',
  description: cleanDescription,
  // eventlog: 不更新，保留本地的富文本内容
  startTime: ...,
  endTime: ...,
  // 🔧 不覆盖 source, calendarId, externalId, eventlog 等字段
};
```

**原理**:
- `...events[eventIndex]` 会保留所有现有字段（包括 `eventlog`）
- 只显式更新需要同步的字段（title, description, startTime等）
- `eventlog` 不在显式更新列表中，自然保留

### 📊 诊断工具

**文件**: `diagnose-duplicate-events.js`

**使用方法**:
1. 在 DevTools Console 中加载脚本:
   ```javascript
   // 将脚本内容粘贴到 Console 运行
   ```

2. 查看诊断报告:
   - 总事件数
   - externalId 重复检查
   - ID 重复检查（严重问题）
   - eventlog vs description 字段分布

3. 手动清理重复（如果需要）:
   ```javascript
   deduplicateEventsManual()
   ```

**预期输出**:
```
📊 统计结果
========================================
📌 总事件数: 7600
   - 有 externalId: 7200
   - 无 externalId (本地事件): 400

🔍 externalId 重复检查:
   - 重复组数: 2200
   - 重复事件数: 6600
   - 预期删除后事件数: 1000

🔍 eventlog vs description 字段:
   - 两者都有: 500 (6.6%)
   - 只有 eventlog: 100 (1.3%)
   - 只有 description: 7000 (92.1%)
   - 两者都没有: 0 (0.0%)
```

**分析**:
- 如果"只有 description"占比很高，说明 eventlog 字段在同步中被覆盖
- 如果重复事件数量巨大，说明去重逻辑没有正常工作

## 后续优化建议

### 1. 同步后自动去重
在 `syncWithOutlook()` 完成后自动调用 `deduplicateEvents()`:

```typescript
async syncWithOutlook() {
  // ... 同步逻辑
  
  // 🆕 同步完成后自动去重
  this.deduplicateEvents();
}
```

### 2. 字段白名单机制
明确定义哪些字段应该从 Outlook 同步，哪些应该保留本地：

```typescript
const OUTLOOK_SYNC_FIELDS = [
  'title', 'description', 'startTime', 'endTime', 
  'location', 'isAllDay', 'reminder'
];

const LOCAL_ONLY_FIELDS = [
  'eventlog',  // 富文本，本地专用
  'tagId',     // ReMarkable 标签系统
  'source',    // 事件来源标记
  'isTimer',   // Timer 标记
  'segments'   // Timer 时间片段
];
```

### 3. 版本迁移
对现有的重复数据执行一次性清理：

```typescript
// App.tsx 启动时
useEffect(() => {
  const version = localStorage.getItem('data-version');
  if (version !== 'v1.8.1') {
    // 执行数据迁移
    deduplicateEvents();
    mergeEventlogFields();
    localStorage.setItem('data-version', 'v1.8.1');
  }
}, []);
```

## 验证步骤

### 1. 修复前诊断
```javascript
// 在 Console 运行
diagnoseDuplicateEvents()
```

### 2. 应用修复
- 更新 `ActionBasedSyncManager.ts`
- 刷新页面

### 3. 手动去重
```javascript
deduplicateEventsManual()
```

### 4. 修复后验证
```javascript
diagnoseDuplicateEvents()
```

**预期结果**:
- 事件数量回到 1000+ 左右
- 重复组数 = 0
- eventlog 字段保留率提升

### 5. 同步测试
- 修改一个事件的 eventlog（富文本）
- 等待同步到 Outlook
- Outlook 同步回写
- 检查 eventlog 是否保留

## 关联文档

- `docs/TIMELOG_ARCHITECTURE.md` - eventlog vs description 字段设计
- `docs/architecture/SYNC_MECHANISM_PRD.md` - 同步机制说明
- `src/services/ActionBasedSyncManager.ts` - 同步实现
