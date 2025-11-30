# 🌳 EventTree 统一架构设计

**设计日期**: 2025-12-01  
**核心原则**: 单一字段管理所有类型的子事件，避免字段碎片化

---

## 1. 问题背景

### ❌ 旧设计的问题

```typescript
// 按类型分散字段 - 难以维护
export interface Event {
  timerLogs?: string[];          // Timer 子事件
  userSubTaskIds?: string[];     // 用户子任务
  outsideAppEventIds?: string[]; // 外部应用事件
  // 未来还要加更多字段？
}
```

**问题**：
1. **字段爆炸**：每增加一种子事件类型，就要加一个新字段
2. **查询复杂**：需要遍历多个字段才能获取所有子事件
3. **维护困难**：创建/删除子事件时要判断类型，更新对应字段
4. **语义混乱**：`timerLogs` 命名暗示"日志"，但实际是事件 ID

---

## 2. 统一架构设计

### ✅ 新设计：单一字段 + 类型标记

```typescript
export interface Event {
  // 🔗 父子关联（统一字段）
  parentEventId?: string;      // 指向父事件 ID
  childEventIds?: string[];    // 所有子事件 ID（不区分类型）
  
  // 🏷️ 事件类型标记（用于过滤和显示逻辑）
  isTimer?: boolean;           // Timer 计时记录
  isTimeLog?: boolean;         // 时间日志
  isOutsideApp?: boolean;      // 外部应用同步事件
  isPlan?: boolean;            // 用户计划事件
  isTask?: boolean;            // 任务类型
}
```

---

## 3. 核心优势

### 3.1 统一管理

```typescript
// ✅ 一个字段存储所有子事件
parentEvent {
  id: "parent-123",
  childEventIds: [
    "timer-1",      // 系统 Timer
    "timer-2",      // 系统 Timer
    "subtask-1",    // 用户子任务
    "subtask-2",    // 用户子任务
    "external-1",   // 外部同步事件
    "external-2"    // 外部同步事件
  ]
}

// ❌ 旧设计需要多个字段
parentEvent {
  timerLogs: ["timer-1", "timer-2"],
  userSubTaskIds: ["subtask-1", "subtask-2"],
  outsideAppEventIds: ["external-1", "external-2"]
}
```

### 3.2 简化 CRUD 操作

```typescript
// ✅ 创建子事件（统一逻辑）
static async createChildEvent(parentId: string, childEvent: Event): Promise<void> {
  // 1. 设置子事件的父 ID
  childEvent.parentEventId = parentId;
  
  // 2. 创建子事件
  await this.createEvent(childEvent);
  
  // 3. 更新父事件的子事件列表（统一字段）
  const parent = this.getEventById(parentId);
  if (parent) {
    if (!parent.childEventIds) parent.childEventIds = [];
    parent.childEventIds.push(childEvent.id);
    await this.updateEvent(parentId, parent);
  }
}

// ❌ 旧设计需要判断类型
if (childEvent.isTimer) {
  parent.timerLogs.push(childEvent.id);
} else if (childEvent.isPlan) {
  parent.userSubTaskIds.push(childEvent.id);
} else if (childEvent.isOutsideApp) {
  parent.outsideAppEventIds.push(childEvent.id);
}
```

### 3.3 灵活的查询和过滤

```typescript
// ✅ 获取所有子事件
static getChildEvents(parentId: string): Event[] {
  const parent = this.getEventById(parentId);
  if (!parent?.childEventIds) return [];
  
  return parent.childEventIds
    .map(id => this.getEventById(id))
    .filter(e => e !== null) as Event[];
}

// ✅ 按类型过滤
static getTimerChildren(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => e.isTimer);
}

static getUserSubTasks(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => 
    e.isPlan && !e.isTimer && !e.isOutsideApp
  );
}

static getExternalChildren(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => e.isOutsideApp);
}
```

### 3.4 可扩展性

```typescript
// ✅ 未来添加新类型：只需加类型标记，无需新字段
export interface Event {
  childEventIds?: string[];  // 字段不变
  
  // 只需添加新的类型标记
  isRecurring?: boolean;     // 循环事件
  isTemplate?: boolean;      // 模板事件
  isArchived?: boolean;      // 归档事件
}

// 查询逻辑也很简单
static getRecurringChildren(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => e.isRecurring);
}
```

---

## 4. 实现细节

### 4.1 自动维护双向关联

```typescript
// EventService.ts

/**
 * 创建事件时自动维护父子关联
 */
static async createEvent(event: Event, skipSync = false): Promise<...> {
  // ... 现有逻辑 ...
  
  // 🆕 自动维护父子关联
  if (event.parentEventId) {
    const parent = this.getEventById(event.parentEventId);
    if (parent) {
      if (!parent.childEventIds) parent.childEventIds = [];
      
      // 避免重复添加
      if (!parent.childEventIds.includes(event.id)) {
        parent.childEventIds.push(event.id);
        await this.updateEvent(parent.id, parent, true); // skipSync=true 避免循环
        
        eventLogger.log('🔗 已关联子事件到父事件:', {
          parentId: parent.id,
          childId: event.id,
          childType: this.getEventType(event),
          totalChildren: parent.childEventIds.length
        });
      }
    }
  }
  
  // ... 现有逻辑 ...
}

/**
 * 更新事件时同步父子关联
 */
static async updateEvent(id: string, updates: Partial<Event>, skipSync = false): Promise<...> {
  const oldEvent = this.getEventById(id);
  
  // 检测 parentEventId 变化
  if (updates.parentEventId !== undefined && 
      updates.parentEventId !== oldEvent?.parentEventId) {
    
    // 从旧父事件移除
    if (oldEvent?.parentEventId) {
      const oldParent = this.getEventById(oldEvent.parentEventId);
      if (oldParent?.childEventIds) {
        oldParent.childEventIds = oldParent.childEventIds.filter(cid => cid !== id);
        await this.updateEvent(oldParent.id, oldParent, true);
      }
    }
    
    // 添加到新父事件
    if (updates.parentEventId) {
      const newParent = this.getEventById(updates.parentEventId);
      if (newParent) {
        if (!newParent.childEventIds) newParent.childEventIds = [];
        if (!newParent.childEventIds.includes(id)) {
          newParent.childEventIds.push(id);
          await this.updateEvent(newParent.id, newParent, true);
        }
      }
    }
  }
  
  // ... 现有更新逻辑 ...
}

/**
 * 删除事件时清理父子关联
 */
static async deleteEvent(id: string): Promise<...> {
  const event = this.getEventById(id);
  
  // 从父事件移除
  if (event?.parentEventId) {
    const parent = this.getEventById(event.parentEventId);
    if (parent?.childEventIds) {
      parent.childEventIds = parent.childEventIds.filter(cid => cid !== id);
      await this.updateEvent(parent.id, parent, true);
    }
  }
  
  // 递归删除所有子事件（可选）
  if (event?.childEventIds && event.childEventIds.length > 0) {
    for (const childId of event.childEventIds) {
      await this.deleteEvent(childId);
    }
  }
  
  // ... 现有删除逻辑 ...
}
```

### 4.2 辅助方法

```typescript
/**
 * 获取事件类型描述（用于日志和调试）
 */
static getEventType(event: Event): string {
  if (event.isTimer) return 'Timer';
  if (event.isTimeLog) return 'TimeLog';
  if (event.isOutsideApp) return 'OutsideApp';
  if (event.isPlan) return 'UserSubTask';
  return 'Event';
}

/**
 * 判断是否为附属事件（系统自动生成，无独立 Plan 状态）
 */
static isSubordinateEvent(event: Event): boolean {
  return !!(event.isTimer || event.isTimeLog || event.isOutsideApp);
}

/**
 * 判断是否为用户子事件（用户主动创建，有完整 Plan 状态）
 */
static isUserSubEvent(event: Event): boolean {
  return !!(event.isPlan && event.parentEventId && !this.isSubordinateEvent(event));
}

/**
 * 获取所有子事件（包括所有类型）
 */
static getChildEvents(parentId: string): Event[] {
  const parent = this.getEventById(parentId);
  if (!parent?.childEventIds) return [];
  
  return parent.childEventIds
    .map(id => this.getEventById(id))
    .filter((e): e is Event => e !== null);
}

/**
 * 获取附属事件（Timer/TimeLog/OutsideApp）
 */
static getSubordinateEvents(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => this.isSubordinateEvent(e));
}

/**
 * 获取用户子任务
 */
static getUserSubTasks(parentId: string): Event[] {
  return this.getChildEvents(parentId).filter(e => this.isUserSubEvent(e));
}

/**
 * 递归获取整个事件树
 */
static getEventTree(rootId: string): Event[] {
  const result: Event[] = [];
  const queue = [rootId];
  
  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const event = this.getEventById(currentId);
    
    if (event) {
      result.push(event);
      
      // 添加子事件到队列
      if (event.childEventIds) {
        queue.push(...event.childEventIds);
      }
    }
  }
  
  return result;
}

/**
 * 计算事件总时长（包括所有子事件）
 */
static getTotalDuration(parentId: string): number {
  const children = this.getSubordinateEvents(parentId);
  return children.reduce((sum, child) => {
    if (child.startTime && child.endTime) {
      const start = new Date(child.startTime).getTime();
      const end = new Date(child.endTime).getTime();
      return sum + (end - start);
    }
    return sum;
  }, 0);
}
```

---

## 5. 前端组件适配

### 5.1 EventEditModal 更新

```typescript
// EventEditModalV2.tsx

// ✅ 使用统一字段读取子事件
const childEvents = React.useMemo(() => {
  if (!event?.id) return [];
  
  // 刷新时重新读取最新数据
  const latestEvent = EventService.getEventById(event.id);
  if (!latestEvent?.childEventIds) return [];
  
  return EventService.getChildEvents(event.id);
}, [event?.id, refreshCounter]);

// 按类型分组显示
const timerEvents = childEvents.filter(e => e.isTimer);
const subTasks = childEvents.filter(e => EventService.isUserSubEvent(e));
const externalEvents = childEvents.filter(e => e.isOutsideApp);
```

### 5.2 PlanManager 过滤逻辑

```typescript
// PlanManager.tsx

// ✅ 过滤逻辑保持不变（基于类型标记）
const shouldHideEvent = (event: Event): boolean => {
  // 隐藏系统附属事件
  return EventService.isSubordinateEvent(event);
};

// 用户子任务正常显示
const userEvents = allEvents.filter(e => !shouldHideEvent(e));
```

---

## 6. 数据迁移

### 6.1 迁移脚本

```typescript
/**
 * 将 timerLogs 迁移到 childEventIds
 */
function migrateTimerLogsToChildEventIds() {
  const events = EventService.getAllEvents();
  let migratedCount = 0;
  
  events.forEach(event => {
    // 如果有旧字段 timerLogs
    if (event.timerLogs && event.timerLogs.length > 0) {
      // 合并到 childEventIds
      if (!event.childEventIds) {
        event.childEventIds = [];
      }
      
      event.timerLogs.forEach(timerId => {
        if (!event.childEventIds!.includes(timerId)) {
          event.childEventIds!.push(timerId);
          migratedCount++;
        }
      });
      
      // 删除旧字段
      delete (event as any).timerLogs;
      
      console.log(`✅ 迁移事件 ${event.id}: ${event.childEventIds.length} 个子事件`);
    }
  });
  
  // 保存更新后的数据
  localStorage.setItem('remarkable-events', JSON.stringify(events));
  
  console.log(`🎉 迁移完成: ${migratedCount} 个子事件已迁移`);
}

// 在浏览器控制台执行
migrateTimerLogsToChildEventIds();
```

### 6.2 兼容性处理（过渡期）

```typescript
// EventService.ts

/**
 * 读取子事件时兼容旧数据
 */
static getChildEvents(parentId: string): Event[] {
  const parent = this.getEventById(parentId);
  if (!parent) return [];
  
  // 🆕 优先使用新字段
  if (parent.childEventIds) {
    return parent.childEventIds
      .map(id => this.getEventById(id))
      .filter((e): e is Event => e !== null);
  }
  
  // ⚠️ 回退到旧字段（兼容性）
  if ((parent as any).timerLogs) {
    console.warn(`⚠️ Event ${parentId} 仍使用旧字段 timerLogs，请运行迁移脚本`);
    return (parent as any).timerLogs
      .map((id: string) => this.getEventById(id))
      .filter((e: Event | null): e is Event => e !== null);
  }
  
  return [];
}
```

---

## 7. 测试清单

| 测试场景 | 预期结果 | 状态 |
|---------|---------|------|
| **创建 Timer 子事件** | | |
| 1. Timer 开始计时 | `child.parentEventId = parentId` | ⏳ |
| 2. 检查父事件 | `parent.childEventIds` 包含 Timer ID | ⏳ |
| **创建用户子任务** | | |
| 3. Plan 页面创建子任务 | `child.parentEventId = parentId`, `child.isPlan = true` | ⏳ |
| 4. 检查父事件 | `parent.childEventIds` 包含子任务 ID | ⏳ |
| **混合子事件** | | |
| 5. 父事件同时有 Timer 和用户子任务 | `parent.childEventIds = ["timer-1", "subtask-1"]` | ⏳ |
| 6. 按类型过滤 | Timer: 1个, 用户子任务: 1个 | ⏳ |
| **更新 parentEventId** | | |
| 7. 修改子事件的父事件 | 旧父移除，新父添加 | ⏳ |
| **删除子事件** | | |
| 8. 删除 Timer | `parent.childEventIds` 不再包含 | ⏳ |
| 9. 删除父事件 | 所有子事件被删除（或变为孤立） | ⏳ |
| **数据迁移** | | |
| 10. 执行迁移脚本 | `timerLogs` → `childEventIds` | ⏳ |
| 11. 验证数据完整性 | 无数据丢失 | ⏳ |

---

## 8. 总结

### ✅ 新架构优势

1. **单一数据源**：`childEventIds` 管理所有类型子事件
2. **类型灵活**：通过 `isTimer/isPlan/isOutsideApp` 标记区分
3. **易于扩展**：新增类型只需加标记，无需新字段
4. **查询高效**：O(1) 获取子事件列表，按需过滤类型
5. **维护简单**：统一的 CRUD 逻辑，无需类型判断

### 📈 可扩展性

未来支持更多子事件类型：
- ✅ Timer 计时记录
- ✅ 用户子任务
- ✅ 外部应用同步事件
- 🔜 循环事件实例
- 🔜 模板事件副本
- 🔜 归档事件引用

**核心原则**：字段结构不变，只需添加类型标记

---

**设计者**: GitHub Copilot  
**审核者**: Zoey  
**状态**: ✅ 设计完成，待实施
