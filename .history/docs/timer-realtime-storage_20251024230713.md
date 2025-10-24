# Timer 实时存储优化文档

## 概述

优化 Timer 功能，使其在运行过程中实时保存事件到 localStorage，并在 TimeCalendar 中显示不断变长的事件。事件标题在运行时显示 "[专注中]" 前缀，停止后移除前缀。

## 实现时间

2025-01-XX

## 问题描述

原有 Timer 功能存在以下问题：

1. **事件仅在停止时创建**：Timer 运行期间，TimeCalendar 上看不到任何事件
2. **无实时反馈**：用户无法实时看到自己的专注进度
3. **数据丢失风险**：如果用户刷新页面或关闭标签，计时数据会丢失
4. **事件重复问题**：每次停止都创建新事件（ID 使用 `Date.now()`），无法更新现有事件

## 解决方案

### 1. 一致的事件 ID 策略

**格式**：`timer-${tagId}-${startTime.getTime()}`

**优势**：
- 同一次计时使用相同 ID
- 实时保存和最终保存使用相同 ID
- 避免重复事件
- 可以通过 ID 定位和更新事件

**实现位置**：
- `src/App.tsx` - Real-time save useEffect (line ~773)
- `src/App.tsx` - handleTimerStop (line ~477)

### 2. 实时保存机制

**保存频率**：每 5 秒自动保存一次

**触发条件**：
- Timer 正在运行 (`globalTimer.isRunning === true`)
- Timer 未暂停 (`globalTimer.isPaused === false`)

**保存内容**：
```typescript
{
  id: `timer-${globalTimer.tagId}-${startTime.getTime()}`,
  title: `[专注中] ${eventTitle}`,
  startTime: formatTimeForStorage(startTime),
  endTime: formatTimeForStorage(new Date(startTime.getTime() + totalElapsed)),
  // ... 其他字段
}
```

**实现代码** (src/App.tsx, line ~756):
```typescript
useEffect(() => {
  if (!globalTimer || !globalTimer.isRunning || globalTimer.isPaused) {
    return;
  }

  const saveTimerEvent = () => {
    // 生成一致的事件 ID
    const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
    
    // 创建/更新事件
    const timerEvent: Event = {
      id: timerEventId,
      title: `[专注中] ${eventTitle}`, // 专注标记
      startTime: formatTimeForStorage(startTime),
      endTime: formatTimeForStorage(new Date(startTime.getTime() + totalElapsed)),
      // ...
    };

    // 查找并更新或创建新事件
    const eventIndex = existingEvents.findIndex(e => e.id === timerEventId);
    if (eventIndex === -1) {
      existingEvents.push(timerEvent);
    } else {
      existingEvents[eventIndex] = timerEvent;
    }

    // 保存到 localStorage
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
    
    // 触发 UI 更新
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { eventId: timerEventId, isTimerEvent: true }
    }));
  };

  // 立即保存一次
  saveTimerEvent();

  // 每 5 秒保存一次
  const saveInterval = setInterval(saveTimerEvent, 5000);

  return () => clearInterval(saveInterval);
}, [globalTimer, /* dependencies */]);
```

### 3. 断点保护机制

**保护场景**：
- 用户刷新页面 (F5)
- 用户关闭标签页
- 浏览器崩溃
- 系统意外关机

**实现方式**：监听 `beforeunload` 事件

**实现代码** (src/App.tsx, line ~832):
```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => {
    if (globalTimer && globalTimer.isRunning && !globalTimer.isPaused) {
      try {
        const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
        if (!tag) return;

        const now = Date.now();
        const totalElapsed = globalTimer.elapsedTime + (now - globalTimer.startTime);
        const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);

        const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
        const eventTitle = globalTimer.eventTitle || (tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name);
        
        // 保存最终状态（不带 "[专注中]" 标记）
        const finalEvent: Event = {
          id: timerEventId,
          title: eventTitle, // 移除 "[专注中]" 前缀
          startTime: formatTimeForStorage(startTime),
          endTime: formatTimeForStorage(new Date(startTime.getTime() + totalElapsed)),
          // ...
        };

        const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
        const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
        const eventIndex = existingEvents.findIndex(e => e.id === timerEventId);
        
        if (eventIndex === -1) {
          existingEvents.push(finalEvent);
        } else {
          existingEvents[eventIndex] = finalEvent;
        }
        
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      } catch (error) {
        console.error('❌ [beforeunload] 保存失败:', error);
      }
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [globalTimer]);
```

### 4. Timer 停止时的最终保存

**修改位置**：`src/App.tsx` - `handleTimerStop` 函数

**关键修改**：

#### 4.1 使用正确的开始时间

**修改前**：
```typescript
const startTime = new Date(endTime.getTime() - totalElapsed); // ❌ 错误计算
```

**修改后**：
```typescript
const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime); // ✅ 使用原始开始时间
```

#### 4.2 使用一致的事件 ID

**修改前**：
```typescript
const newEvent: Event = {
  id: `timer-${Date.now()}`, // ❌ 每次都生成新 ID
  // ...
};
```

**修改后**：
```typescript
const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`; // ✅ 一致的 ID

const finalEvent: Event = {
  id: timerEventId,
  // ...
};
```

#### 4.3 更新现有事件而非创建新事件

**修改前**：
```typescript
const existingEvents = saved ? JSON.parse(saved) : [];
existingEvents.push(newEvent); // ❌ 总是创建新事件
```

**修改后**：
```typescript
const existingEvents = saved ? JSON.parse(saved) : [];
const eventIndex = existingEvents.findIndex((e: Event) => e.id === timerEventId);

if (eventIndex === -1) {
  existingEvents.push(finalEvent);
  console.log('✅ [Timer Stop] 创建最终事件:', timerEventId);
} else {
  existingEvents[eventIndex] = finalEvent; // ✅ 更新现有事件
  console.log('✅ [Timer Stop] 更新最终事件:', timerEventId);
}
```

#### 4.4 移除 "[专注中]" 标记

**实现**：
```typescript
const finalEvent: Event = {
  id: timerEventId,
  title: eventTitle, // ✅ 不包含 "[专注中]" 前缀
  // ...
};
```

**对比实时保存**：
```typescript
const timerEvent: Event = {
  id: timerEventId,
  title: `[专注中] ${eventTitle}`, // 运行时包含前缀
  // ...
};
```

## 数据流程

### Timer 运行中

```
1. 用户点击 "开始计时"
   ↓
2. globalTimer 状态更新 (isRunning: true)
   ↓
3. Real-time save useEffect 触发
   ↓
4. 立即保存一次到 localStorage
   ├─ 创建事件，ID: timer-{tagId}-{startTime}
   ├─ 标题: "[专注中] {title}"
   └─ 触发 eventsUpdated 事件
   ↓
5. TimeCalendar 监听到 eventsUpdated
   ↓
6. TimeCalendar 重新加载事件并渲染
   ↓
7. 用户看到带 "[专注中]" 标记的事件
   ↓
8. 每 5 秒重复步骤 4-7
   └─ endTime 不断更新，事件视觉上变长
```

### Timer 停止时

```
1. 用户点击 "停止计时"
   ↓
2. handleTimerStop 执行
   ↓
3. 使用相同的 timerEventId
   ↓
4. 创建 finalEvent（无 "[专注中]" 标记）
   ↓
5. 查找 existingEvents 中的相同 ID
   ├─ 找到 → 更新现有事件
   └─ 未找到 → 创建新事件（正常情况不应发生）
   ↓
6. 保存到 localStorage
   ↓
7. 触发 eventsUpdated 事件 (isStopped: true)
   ↓
8. TimeCalendar 刷新，显示最终事件
   ↓
9. 异步同步到 Outlook
   ↓
10. 清除 globalTimer 状态
```

### 断点保护 (用户刷新/关闭)

```
1. 用户触发 beforeunload 事件
   ↓
2. 检查 globalTimer.isRunning
   ↓ (true)
3. 计算当前总时长
   ↓
4. 使用相同的 timerEventId
   ↓
5. 创建最终事件（无 "[专注中]" 标记）
   ↓
6. 更新 localStorage
   ↓
7. 页面关闭/刷新
   ↓
8. 重新打开后，事件已保存在 TimeCalendar 中
```

## UI 显示

### TimeCalendar 显示

**运行中**：
```
09:00 - 09:23  [专注中] 📚 学习React
```

**停止后**：
```
09:00 - 09:45  📚 学习React
```

**视觉效果**：
- 事件每 5 秒更新一次 endTime
- 事件条在日历上不断变长
- "[专注中]" 前缀提供清晰的视觉提示

### DailyStatsCard 更新

**触发机制**：
- Real-time save 触发 `eventsUpdated` 事件
- DailyStatsCard 监听该事件
- 自动重新计算当天统计数据

**更新内容**：
- 总专注时长
- 标签统计
- 事件数量

## 技术细节

### 1. 事件 ID 生成

**格式**：`timer-${tagId}-${startTime.getTime()}`

**组成部分**：
- `timer-`：前缀，标识为计时器事件
- `${tagId}`：标签 ID，确保每个标签独立
- `${startTime.getTime()}`：开始时间戳，确保每次计时唯一

**示例**：
```
timer-tag_20250120_001-1737370800000
```

### 2. 时间计算

**开始时间**：
```typescript
const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
```
- 优先使用 `originalStartTime`（如果存在）
- 否则使用当前的 `startTime`

**结束时间**：
```typescript
const endTime = new Date(startTime.getTime() + totalElapsed);
```
- 基于开始时间 + 总时长计算
- 确保时间一致性

**总时长**：
```typescript
const totalElapsed = globalTimer.elapsedTime + 
  (globalTimer.isRunning ? (Date.now() - globalTimer.startTime) : 0);
```
- 已暂停时长 + 当前运行时长

### 3. 事件查找和更新

```typescript
const eventIndex = existingEvents.findIndex((e: Event) => e.id === timerEventId);

if (eventIndex === -1) {
  // 新事件（首次保存）
  existingEvents.push(timerEvent);
} else {
  // 更新现有事件（后续保存）
  existingEvents[eventIndex] = timerEvent;
}
```

### 4. 事件通知

```typescript
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: timerEventId,
    isTimerEvent: true,
    isStopped: false, // 运行中为 false，停止时为 true
    tags: [globalTimer.tagId]
  }
}));
```

**监听方**：
- `TimeCalendar`：重新加载并渲染事件
- `DailyStatsCard`：重新计算统计数据

## 测试建议

### 1. 实时保存测试

**步骤**：
1. 开始一个 Timer
2. 打开 TimeCalendar
3. 观察是否出现带 "[专注中]" 的事件
4. 等待 10 秒
5. 观察事件是否变长

**预期结果**：
- ✅ 事件立即出现
- ✅ 标题包含 "[专注中]" 前缀
- ✅ 每 5 秒事件 endTime 更新
- ✅ 视觉上事件不断变长

### 2. 停止保存测试

**步骤**：
1. 开始一个 Timer 并等待 30 秒
2. 停止 Timer
3. 检查 TimeCalendar

**预期结果**：
- ✅ 事件保留在日历上
- ✅ "[专注中]" 前缀已移除
- ✅ 时长准确（约 30 秒）
- ✅ 没有重复事件

### 3. 断点保护测试

**测试场景 A：刷新页面**
1. 开始 Timer 并等待 20 秒
2. 刷新页面 (F5)
3. 检查 TimeCalendar

**预期结果**：
- ✅ 事件已保存
- ✅ 无 "[专注中]" 前缀
- ✅ 时长约 20 秒

**测试场景 B：关闭标签**
1. 开始 Timer 并等待 15 秒
2. 关闭标签页
3. 重新打开应用
4. 检查 TimeCalendar

**预期结果**：
- ✅ 事件已保存
- ✅ 数据未丢失

### 4. 事件去重测试

**步骤**：
1. 开始 Timer
2. 等待 10 秒（触发至少 2 次自动保存）
3. 停止 Timer
4. 检查 localStorage 中的 events

**预期结果**：
- ✅ 只有一个事件
- ✅ 事件 ID 格式正确
- ✅ 事件时长准确

### 5. DailyStatsCard 更新测试

**步骤**：
1. 打开 Homepage，查看 DailyStatsCard
2. 开始一个 Timer
3. 等待 10 秒
4. 观察 DailyStatsCard

**预期结果**：
- ✅ 统计数据实时更新
- ✅ 总时长增加
- ✅ 对应标签时长增加

## 潜在问题和注意事项

### 1. 性能考虑

**问题**：每 5 秒保存和触发 UI 更新可能影响性能

**缓解措施**：
- 仅在 Timer 运行时激活
- 使用 `useEffect` 清理机制
- localStorage 操作相对快速
- 事件更新使用 CustomEvent，异步处理

### 2. 数据一致性

**问题**：多个地方修改同一事件可能导致冲突

**解决方案**：
- 使用一致的事件 ID
- 始终通过 `findIndex` 查找现有事件
- 优先更新而非创建

### 3. 浏览器兼容性

**beforeunload 事件**：
- 现代浏览器支持良好
- 部分移动浏览器可能不可靠
- 作为备份机制，不应依赖为唯一保护

### 4. localStorage 限制

**容量限制**：
- 通常 5-10MB
- 对于事件数据应足够
- 考虑定期清理旧事件

### 5. 暂停状态

**当前行为**：
- Timer 暂停时不保存
- 恢复后继续保存

**可能改进**：
- 暂停时也保存最后状态
- 防止暂停期间数据丢失

## 代码位置

### src/App.tsx

**Real-time Save useEffect** (line ~756):
```typescript
useEffect(() => {
  if (!globalTimer || !globalTimer.isRunning || globalTimer.isPaused) return;
  
  const saveTimerEvent = () => { /* ... */ };
  
  saveTimerEvent();
  const saveInterval = setInterval(saveTimerEvent, 5000);
  return () => clearInterval(saveInterval);
}, [globalTimer, /* deps */]);
```

**Breakpoint Protection useEffect** (line ~832):
```typescript
useEffect(() => {
  const handleBeforeUnload = (e: BeforeUnloadEvent) => { /* ... */ };
  
  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [globalTimer]);
```

**handleTimerStop** (line ~451):
- 使用 `globalTimer.originalStartTime`
- 使用一致的 `timerEventId`
- 查找并更新现有事件
- 移除 "[专注中]" 标记

## 相关文档

- [Widget Cleanup Summary](./widget-cleanup-summary.md)
- [Event Disappear Fix](./event-disappear-fix.md)
- [Event Tag Edit Sync Fix](./event-tag-edit-sync-fix.md)

## 版本历史

- **v1.0** (2025-01-XX): 初始实现
  - 实时保存机制
  - 断点保护
  - 一致事件 ID
  - "[专注中]" 标记

## 作者

Copilot + Zoey Gong

---

**状态**: ✅ 已完成
**测试状态**: 待测试
**部署状态**: 待部署
