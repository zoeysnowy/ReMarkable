# 事件管理架构规范

**更新时间**: 2025-11-08  
**架构版本**: v1.6  
**强制执行**: ✅ 必须遵守

---

## 🎯 核心原则

### 数据流向规范

```
组件层 (PlanManager, TimeCalendar, etc.)
    ↓ ↑ (只能通过)
EventHub (事件管理中心 - 唯一入口)
    ↓ ↑
TimeHub (时间管理) + EventService (持久化)
```

**严禁**:
- ❌ 组件直接调用 `EventService.createEvent/updateEvent/deleteEvent`
- ❌ 组件直接调用 `TimeHub.setEventTime`（除非是底层工具函数）
- ❌ 跨层级调用

**正确**:
- ✅ 组件通过 `EventHub.createEvent/updateFields/deleteEvent`
- ✅ 组件通过 `EventHub.setEventTime` 更新时间
- ✅ 组件通过 `EventHub.getSnapshot` 读取事件

---

## 📐 架构层次

### 第 1 层：组件层（UI）

**职责**: 展示数据、接收用户输入

**允许调用**:
- ✅ `EventHub.getSnapshot(id)` - 读取事件
- ✅ `EventHub.createEvent(event)` - 创建事件
- ✅ `EventHub.updateFields(id, updates)` - 更新字段
- ✅ `EventHub.setEventTime(id, time)` - 更新时间
- ✅ `EventHub.deleteEvent(id)` - 删除事件
- ✅ `EventHub.saveEvent(event)` - 自动判断创建/更新

**禁止调用**:
- ❌ `EventService.*` - 绕过 EventHub
- ❌ `TimeHub.setEventTime` - 应通过 EventHub

**示例（正确）**:
```typescript
// PlanManager.tsx
import { EventHub } from '../services/EventHub';

// ✅ 创建事件
const newEvent = await EventHub.createEvent({
  id: generateEventId(),
  title: 'New Task',
  // ...
});

// ✅ 更新字段
await EventHub.updateFields(eventId, {
  title: 'Updated Title',
  tags: ['tag1', 'tag2'],
}, {
  source: 'planmanager'
});

// ✅ 更新时间
await EventHub.setEventTime(eventId, {
  start: '2025-11-08T10:00:00',
  end: '2025-11-08T11:00:00',
  allDay: false,
});

// ✅ 删除事件
await EventHub.deleteEvent(eventId);
```

**示例（错误）**:
```typescript
// ❌ 错误：直接调用 EventService
import { EventService } from '../services/EventService';

await EventService.createEvent(event);  // 绕过 EventHub！
await EventService.updateEvent(id, updates);  // 绕过 EventHub！
```

---

### 第 2 层：EventHub（事件管理中心）

**职责**:
- 维护事件内存快照（缓存）
- 提供增量更新 API
- 协调 TimeHub 和 EventService
- 发出全局事件通知

**API 列表**:
```typescript
class EventHub {
  // 读取
  getSnapshot(eventId: string): Event | null;
  
  // 创建
  createEvent(event: Event): Promise<{ success, event?, error? }>;
  
  // 更新（增量）
  updateFields(
    eventId: string, 
    updates: Partial<Event>,
    options?: { skipSync?, source? }
  ): Promise<{ success, event?, error? }>;
  
  // 更新时间（便捷方法）
  setEventTime(
    eventId: string,
    time: { start?, end?, allDay?, ... },
    options?: { skipSync? }
  ): Promise<{ success, event?, error? }>;
  
  // 保存（自动判断创建/更新）
  saveEvent(event: Event): Promise<Event>;
  
  // 删除
  deleteEvent(eventId: string, skipSync?: boolean): Promise<{ success, error? }>;
  
  // 缓存管理
  invalidate(eventId: string): void;
  invalidateAll(): void;
}
```

**内部调用**:
- ✅ `EventService.*` - 持久化数据
- ✅ `TimeHub.setEventTime` - 更新时间元数据

---

### 第 3 层：TimeHub + EventService（数据层）

**TimeHub**:
- 职责：管理时间意图（TimeSpec）和时间快照
- 调用者：仅 EventHub

**EventService**:
- 职责：持久化到 localStorage，触发同步
- 调用者：仅 EventHub

---

## 🔧 工具函数规范

### timeManager.ts

时间管理工具函数**可以**调用 EventHub（因为它是底层工具）:

```typescript
// src/utils/timeManager.ts
import { EventHub } from '../services/EventHub';
import { TimeHub } from '../services/TimeHub';

// ✅ 统一时间管理接口
export async function setEventTime(eventId, time) {
  // 通过 EventHub 更新（推荐）
  await EventHub.setEventTime(eventId, time);
  
  return { ... };
}

export function getEventTime(eventId, fallback) {
  // 读取时间：TimeHub > EventService > fallback
  const snapshot = TimeHub.getSnapshot(eventId);
  if (snapshot.start && snapshot.end) {
    return snapshot;
  }
  
  const event = EventService.getEventById(eventId);
  // ...
}
```

---

## 🚨 常见错误

### 错误 1: 绕过 EventHub

```typescript
// ❌ 错误
import { EventService } from '../services/EventService';

const saveEvent = async (item) => {
  await EventService.updateEvent(item.id, item);  // 绕过 EventHub！
};
```

**修复**:
```typescript
// ✅ 正确
import { EventHub } from '../services/EventHub';

const saveEvent = async (item) => {
  await EventHub.updateFields(item.id, item, {
    source: 'planmanager'
  });
};
```

---

### 错误 2: 直接调用 TimeHub

```typescript
// ❌ 错误
import { TimeHub } from '../services/TimeHub';

const updateTime = async (eventId, start, end) => {
  await TimeHub.setEventTime(eventId, { start, end });  // 绕过 EventHub！
};
```

**修复**:
```typescript
// ✅ 正确
import { EventHub } from '../services/EventHub';

const updateTime = async (eventId, start, end) => {
  await EventHub.setEventTime(eventId, { start, end });
};
```

---

### 错误 3: 混合调用

```typescript
// ❌ 错误
await EventHub.updateFields(id, { title: 'New' });
await EventService.updateEvent(id, { tags: ['tag1'] });  // 混合调用！
```

**修复**:
```typescript
// ✅ 正确：合并为一次调用
await EventHub.updateFields(id, {
  title: 'New',
  tags: ['tag1']
}, {
  source: 'planmanager'
});
```

---

## 📋 修复清单

### PlanManager 修复项

- [ ] ~~`EventService.createEvent`~~ → `EventHub.createEvent`
- [ ] ~~`EventService.updateEvent`~~ → `EventHub.updateFields`
- [ ] ~~`EventService.deleteEvent`~~ → `EventHub.deleteEvent`
- [ ] ~~`TimeHub.setEventTime`~~ → `EventHub.setEventTime`

### 其他组件检查项

- [ ] TimeCalendar
- [ ] EventEditModal
- [ ] FloatingToolbar
- [ ] UnifiedTimeline

---

## 🧪 测试验证

### 手动验证

1. **检查调用链**:
   ```bash
   # 搜索所有直接调用 EventService 的地方
   grep -r "EventService\.(createEvent|updateEvent|deleteEvent)" src/components/
   
   # 应该只在 EventHub.ts 中出现
   ```

2. **调试日志**:
   ```typescript
   // EventHub 会输出所有操作日志
   // 浏览器控制台应该看到：
   // 📝 [EventHub] 增量更新 { eventId, fields, source }
   // 🕐 [EventHub] 更新时间字段 { eventId, timeInput }
   ```

3. **全局事件监听**:
   ```javascript
   // 浏览器控制台
   window.addEventListener('eventUpdated', (e) => {
     console.log('Event updated:', e.detail);
   });
   ```

### 自动化测试

```typescript
// EventHub.test.ts
describe('EventHub Architecture', () => {
  it('should be the only entry point for event operations', () => {
    // 确保组件不直接调用 EventService
    const planManagerCode = fs.readFileSync('src/components/PlanManager.tsx', 'utf-8');
    
    expect(planManagerCode).not.toContain('EventService.createEvent');
    expect(planManagerCode).not.toContain('EventService.updateEvent');
    expect(planManagerCode).not.toContain('EventService.deleteEvent');
  });
});
```

---

## 🎯 迁移指南

### Step 1: 替换导入

```typescript
// ❌ 删除
import { EventService } from '../services/EventService';

// ✅ 添加
import { EventHub } from '../services/EventHub';
```

### Step 2: 替换调用

```typescript
// ❌ 旧代码
await EventService.createEvent(event);
await EventService.updateEvent(id, updates);
await EventService.deleteEvent(id);

// ✅ 新代码
await EventHub.createEvent(event);
await EventHub.updateFields(id, updates, { source: 'your-component' });
await EventHub.deleteEvent(id);
```

### Step 3: 替换时间更新

```typescript
// ❌ 旧代码
await TimeHub.setEventTime(id, { start, end });

// ✅ 新代码
await EventHub.setEventTime(id, { start, end });
```

---

## 📚 相关文档

- [EventHub 源码](../src/services/EventHub.ts)
- [TimeHub 源码](../src/services/TimeHub.ts)
- [EventService 源码](../src/services/EventService.ts)
- [PlanManager 修复总结](./PLANMANAGER_SLATE_FIX_SUMMARY.md)

---

## 🔍 调试工具

### 浏览器控制台

```javascript
// 查看 EventHub 缓存
window.debugEventHub.getCacheStats();

// 查看特定事件快照
window.debugEventHub.getSnapshot('event-123');

// 清除缓存
window.debugEventHub.invalidate('event-123');
window.debugEventHub.invalidateAll();
```

---

**强制执行日期**: 2025-11-08  
**违反处罚**: Code Review 不通过  
**审查者**: 所有开发者
