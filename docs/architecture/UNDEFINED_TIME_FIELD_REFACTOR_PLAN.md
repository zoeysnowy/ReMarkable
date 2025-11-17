# 时间字段 Optional 重构方案

> **文档版本**: v1.4  
> **创建时间**: 2025-11-14  
> **最后更新**: 2025-11-14  
> **状态**: ✅ 实施完成  
> **目标**: 支持 `startTime/endTime/isAllDay` 为 `undefined`，实现 Task vs Calendar 事件差异化处理  
> **关联文档**: EVENTHUB_TIMEHUB_ARCHITECTURE.md, TIME_ARCHITECTURE.md

---

## 📝 版本更新历史

| 版本 | 日期 | 主要变更 |
|------|------|----------|
| **v1.0** | 2025-11-14 | 初始版本，定义 undefined 字段重构方案 |
| **v1.1** | 2025-11-14 | 🔥 移除 clearEventTime() 方法，统一使用 setEventTime({ start: undefined }) |
| **v1.2** | 2025-11-14 | 🆕 补充 PlanManager syncToUnifiedTimeline 和 UnifiedSlateEditor 序列化逻辑 |
| **v1.3** | 2025-11-14 | 🗑️ 移除数据清洗工具，改为清空 localStorage 缓存 |
| **v1.4** | 2025-11-14 | ✅ 实施完成，所有 TODO 已完成 |

---

## 📋 背景

### 当前问题

**架构矛盾**：
- **文档说明**：`isTask = true` 时，`startTime/endTime` **可以为 `undefined`**（支持无时间任务）
- **类型定义**：`startTime?: string` 已经是可选，但缺少相关验证和处理逻辑
- **实际问题**：PlanManager auto-save 会用空字符串覆盖 TimeHub 的时间数据

**业务需求**：
- **Task 类型**（Microsoft To Do）：允许无时间任务（如待办清单）
- **Calendar 事件**（Outlook Calendar）：必须有明确的开始/结束时间
- **混合场景**：用户可能先创建 Task，后续添加时间转为 Calendar 事件

---

## 🎯 重构目标

### 1. 类型系统明确性

```typescript
// ✅ 目标：类型层面明确时间字段可选性
interface Event {
  startTime?: string | undefined;      // 明确允许 undefined
  endTime?: string | undefined;        // 明确允许 undefined
  isAllDay?: boolean | undefined;      // 明确允许 undefined
  
  // 事件类型标记
  isTask?: boolean;                    // true = Task (时间可选)
                                        // false/undefined = Calendar (时间必需)
}
```

### 2. 验证逻辑差异化

```typescript
// ✅ 目标：根据 isTask 区分验证规则
function validateEvent(event: Event): ValidationResult {
  if (event.isTask === true) {
    // Task 验证：时间可选
    return { valid: true };
  } else {
    // Calendar 验证：时间必需
    if (!event.startTime || !event.endTime) {
      return { valid: false, error: 'Calendar event requires time' };
    }
    return { valid: true };
  }
}
```

### 3. 同步路由智能化

```typescript
// ✅ 目标：自动路由到正确的同步目标
function determineSyncTarget(event: Event): 'calendar' | 'todo' | 'none' {
  if (event.isTask === true) {
    return 'todo';      // → Microsoft To Do
  }
  
  if (event.startTime && event.endTime) {
    return 'calendar';  // → Outlook Calendar
  }
  
  return 'none';        // 本地专用事件
}
```

### 4. UI 适配健壮性

```typescript
// ✅ 目标：优雅处理 undefined 时间显示
function formatEventTime(event: Event): string {
  if (event.isTask && !event.startTime) {
    return '无时间';    // Task 无时间提示
  }
  
  if (!event.startTime) {
    return '待设置';    // Calendar 事件缺少时间
  }
  
  return formatTime(event.startTime);
}
```

---

## 📝 详细实施方案

### TODO 1: 类型系统重构 - 时间字段改为可选

**优先级**: 🔴 P0 - 基础架构  
**预计工时**: 1-2 小时  
**影响范围**: 类型定义、编译器检查

#### 1.1 更新 `src/types.ts` Event 接口

**文件**: `src/types.ts`

**变更内容**:
```typescript
interface Event {
  // ========== 时间字段（由 TimeHub 管理） ==========
  // ⚠️ v1.8 重要变更：时间字段允许 undefined
  // - Task 类型（isTask=true）：时间可选，支持无时间待办事项
  // - Calendar 事件（isTask=false/undefined）：时间必需，同步到 Outlook Calendar
  
  startTime?: string;              // 开始时间（'YYYY-MM-DD HH:mm:ss' 格式 或 undefined）
  endTime?: string;                // 结束时间（'YYYY-MM-DD HH:mm:ss' 格式 或 undefined）
  isAllDay?: boolean;              // 是否全天事件（undefined 表示未设置）
  dueDate?: string;                // 截止日期
  timeSpec?: TimeSpec;             // 时间意图对象
  
  // ========== 事件类型 ==========
  isTask?: boolean;                // 任务类型（影响时间字段要求）
  // ...
}
```

**测试要点**:
```typescript
// ✅ 合法：Task 无时间
const task: Event = {
  id: '1',
  title: '待办事项',
  isTask: true,
  startTime: undefined,
  endTime: undefined,
};

// ✅ 合法：Calendar 事件有时间
const calendarEvent: Event = {
  id: '2',
  title: '会议',
  isTask: false,
  startTime: '2025-11-14 14:00:00',
  endTime: '2025-11-14 15:00:00',
};

// ⚠️ 警告：Calendar 事件缺少时间（应由验证逻辑捕获）
const invalidEvent: Event = {
  id: '3',
  title: '无效会议',
  isTask: false,
  startTime: undefined,  // 运行时验证应报错
  endTime: undefined,
};
```

---

### TODO 2: 验证逻辑更新 - 区分 Task 和 Calendar 事件

**优先级**: 🔴 P0 - 核心功能  
**预计工时**: 2-3 小时  
**影响范围**: EventService, EventHub

#### 2.1 创建验证工具函数

**新建文件**: `src/utils/eventValidation.ts`

```typescript
/**
 * 事件时间字段验证工具
 * 根据 isTask 字段区分验证规则
 */

export interface ValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

/**
 * 验证事件的时间字段
 */
export function validateEventTime(event: Event): ValidationResult {
  const warnings: string[] = [];
  
  // Task 类型：时间可选
  if (event.isTask === true) {
    // Task 允许无时间
    if (!event.startTime && !event.endTime) {
      warnings.push('Task has no time - will sync to Microsoft To Do');
    }
    
    // 如果 Task 设置了时间，也需要完整
    if ((event.startTime && !event.endTime) || (!event.startTime && event.endTime)) {
      return {
        valid: false,
        error: 'Task with time must have both startTime and endTime',
      };
    }
    
    return { valid: true, warnings };
  }
  
  // Calendar 事件：时间必需
  if (!event.startTime || !event.endTime) {
    return {
      valid: false,
      error: 'Calendar event requires both startTime and endTime',
    };
  }
  
  // 验证时间格式
  if (!isValidTimeFormat(event.startTime) || !isValidTimeFormat(event.endTime)) {
    return {
      valid: false,
      error: 'Invalid time format - must be "YYYY-MM-DD HH:mm:ss"',
    };
  }
  
  // 验证时间逻辑（开始时间 <= 结束时间）
  if (new Date(event.startTime) > new Date(event.endTime)) {
    return {
      valid: false,
      error: 'Start time must be before or equal to end time',
    };
  }
  
  return { valid: true, warnings };
}

/**
 * 验证时间格式是否为 'YYYY-MM-DD HH:mm:ss'
 */
function isValidTimeFormat(timeStr: string): boolean {
  const pattern = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  return pattern.test(timeStr);
}

/**
 * 检查事件是否需要时间字段
 */
export function requiresTime(event: Event): boolean {
  return event.isTask !== true;
}

/**
 * 检查事件是否有有效时间
 */
export function hasValidTime(event: Event): boolean {
  return !!(event.startTime && event.endTime);
}
```

#### 2.2 在 EventService 中集成验证

**文件**: `src/services/EventService.ts`

**变更位置**: `createEvent` 和 `updateEvent` 方法

```typescript
import { validateEventTime, ValidationResult } from '../utils/eventValidation';

// 在 createEvent 中添加验证
export async function createEvent(event: Event): Promise<Event> {
  // ✅ 验证时间字段
  const validation = validateEventTime(event);
  if (!validation.valid) {
    console.error('[EventService] Event validation failed:', validation.error);
    throw new Error(validation.error);
  }
  
  if (validation.warnings && validation.warnings.length > 0) {
    console.warn('[EventService] Event warnings:', validation.warnings);
  }
  
  // 原有逻辑...
  const events = getAllEvents();
  events.push(event);
  saveEvents(events);
  
  return event;
}

// 在 updateEvent 中添加验证
export async function updateEvent(eventId: string, updates: Partial<Event>): Promise<Event> {
  const existingEvent = getEventById(eventId);
  if (!existingEvent) {
    throw new Error(`Event not found: ${eventId}`);
  }
  
  // 合并更新
  const updatedEvent = { ...existingEvent, ...updates };
  
  // ✅ 验证合并后的事件
  const validation = validateEventType(updatedEvent);
  if (!validation.valid) {
    console.error('[EventService] Update validation failed:', validation.error);
    throw new Error(validation.error);
  }
  
  // 原有逻辑...
  const events = getAllEvents();
  const index = events.findIndex(e => e.id === eventId);
  events[index] = updatedEvent;
  saveEvents(events);
  
  return updatedEvent;
}
```

**测试场景**:
```typescript
// ✅ 应成功：Task 无时间
await createEvent({
  id: '1',
  title: '待办',
  isTask: true,
});

// ✅ 应成功：Calendar 事件有时间
await createEvent({
  id: '2',
  title: '会议',
  startTime: '2025-11-14 14:00:00',
  endTime: '2025-11-14 15:00:00',
});

// ❌ 应失败：Calendar 事件缺时间
await createEvent({
  id: '3',
  title: '无效会议',
  isTask: false,
  // 缺少 startTime/endTime
});
// Expected error: "Calendar event requires both startTime and endTime"
```

---

### TODO 3: 同步逻辑更新 - 路由到 Calendar 或 To Do

**优先级**: 🟡 P1 - 外部集成  
**预计工时**: 3-4 小时  
**影响范围**: SyncService, MicrosoftGraphService

#### 3.1 创建同步路由工具

**新建文件**: `src/utils/syncRouter.ts`

```typescript
/**
 * 同步路由工具
 * 根据事件类型决定同步目标
 */

export type SyncTarget = 'calendar' | 'todo' | 'none';

export interface SyncRoute {
  target: SyncTarget;
  reason: string;
}

/**
 * 决定事件的同步目标
 */
export function determineSyncTarget(event: Event): SyncRoute {
  // 1. Task 类型 → Microsoft To Do
  if (event.isTask === true) {
    return {
      target: 'todo',
      reason: 'Task event syncs to Microsoft To Do',
    };
  }
  
  // 2. Calendar 事件且有时间 → Outlook Calendar
  if (event.startTime && event.endTime) {
    return {
      target: 'calendar',
      reason: 'Calendar event with time syncs to Outlook Calendar',
    };
  }
  
  // 3. Calendar 事件但无时间 → 不同步
  return {
    target: 'none',
    reason: 'Calendar event without time cannot sync',
  };
}

/**
 * 检查事件是否应该同步
 */
export function shouldSync(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target !== 'none';
}

/**
 * 检查事件是否应该同步到 Calendar
 */
export function shouldSyncToCalendar(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target === 'calendar';
}

/**
 * 检查事件是否应该同步到 To Do
 */
export function shouldSyncToTodo(event: Event): boolean {
  const route = determineSyncTarget(event);
  return route.target === 'todo';
}
```

#### 3.2 更新 SyncService

**文件**: `src/services/SyncService.ts`

**变更内容**: 在同步前检查路由

```typescript
import { determineSyncTarget, shouldSyncToCalendar, shouldSyncToTodo } from '../utils/syncRouter';

/**
 * 同步单个事件到 Microsoft 服务
 */
export async function syncEventToMicrosoft(event: Event): Promise<void> {
  const route = determineSyncTarget(event);
  
  console.log(`[SyncService] Event ${event.id} route:`, route);
  
  if (route.target === 'none') {
    console.log(`[SyncService] Skipping sync: ${route.reason}`);
    return;
  }
  
  try {
    if (route.target === 'calendar') {
      // 同步到 Outlook Calendar
      await syncToOutlookCalendar(event);
    } else if (route.target === 'todo') {
      // 同步到 Microsoft To Do
      await syncToMicrosoftTodo(event);
    }
  } catch (error) {
    console.error(`[SyncService] Sync failed:`, error);
    throw error;
  }
}

/**
 * 同步到 Outlook Calendar
 */
async function syncToOutlookCalendar(event: Event): Promise<void> {
  // 验证必需字段
  if (!event.startTime || !event.endTime) {
    throw new Error('Calendar sync requires startTime and endTime');
  }
  
  // 调用 Microsoft Graph API
  // ... 现有逻辑
}

/**
 * 同步到 Microsoft To Do
 */
async function syncToMicrosoftTodo(event: Event): Promise<void> {
  // Task 可以无时间
  const todoItem = {
    title: event.title,
    body: event.description,
    isComplete: event.isCompleted || false,
    dueDateTime: event.dueDate ? {
      dateTime: event.dueDate,
      timeZone: 'Local',
    } : undefined,
    // 如果 Task 有时间，也可以设置 reminderDateTime
    reminderDateTime: event.startTime ? {
      dateTime: event.startTime,
      timeZone: 'Local',
    } : undefined,
  };
  
  // 调用 Microsoft Graph API for To Do
  // ... 实现逻辑
}
```

---

### TODO 4: UI 组件适配 - 处理 undefined 时间显示

**优先级**: 🟡 P1 - 用户体验  
**预计工时**: 4-6 小时  
**影响范围**: PlanManager, EventEditModal, TimeCalendar, UnifiedSlateEditor, TimeDisplay 组件

#### 4.1 更新时间显示工具

**新建文件**: `src/utils/timeDisplay.ts`

```typescript
/**
 * 格式化事件时间显示（适配 undefined）
 */
export function formatEventTimeDisplay(event: Event): string {
  // Task 无时间
  if (event.isTask === true && !event.startTime) {
    return ''; // 空字符串，不显示时间
  }
  
  // Calendar 事件缺少时间（异常情况）
  if (!event.startTime) {
    return '⚠️ 待设置时间';
  }
  
  // 正常显示时间
  return formatRelativeTimeDisplay({
    startTime: event.startTime,
    endTime: event.endTime,
    isAllDay: event.isAllDay,
  });
}

/**
 * 获取时间显示的 CSS 类名
 */
export function getTimeDisplayClass(event: Event): string {
  if (event.isTask === true && !event.startTime) {
    return 'time-display--empty';
  }
  
  if (!event.startTime) {
    return 'time-display--warning';
  }
  
  return 'time-display--normal';
}
```

#### 4.2 更新 PlanManager 时间显示

**文件**: `src/components/PlanManager.tsx`

**变更内容**: TimeDisplay 组件适配 + syncToUnifiedTimeline 修复

```typescript
import { formatEventTimeDisplay, getTimeDisplayClass } from '../utils/timeDisplay';

// ✅ 修复 1: 时间显示组件
const EventTimeComponent = ({ itemId }: { itemId: string }) => {
  const eventTime = useEventTime(itemId);
  const event = EventHub.getSnapshot(itemId);
  
  if (!event) return null;
  
  const timeText = formatEventTimeDisplay(event);
  const timeClass = getTimeDisplayClass(event);
  
  // Task 无时间时不显示
  if (event.isTask && !timeText) {
    return null;
  }
  
  return (
    <span className={`time-display ${timeClass}`}>
      {timeText}
    </span>
  );
};

// ✅ 修复 2: syncToUnifiedTimeline 函数
const syncToUnifiedTimeline = (item: Event) => {
  // ⚠️ 关键修复：转换空字符串为 undefined
  const cleanedItem = {
    ...item,
    startTime: item.startTime || undefined,  // '' → undefined
    endTime: item.endTime || undefined,      // '' → undefined
  };
  
  const eventTime = getEventTime(cleanedItem.id, {
    start: cleanedItem.startTime,  // ✅ 现在是 undefined 而不是 ''
    end: cleanedItem.endTime,
    dueDate: cleanedItem.dueDate || null,
    isAllDay: cleanedItem.isAllDay,
    timeSpec: (cleanedItem as any).timeSpec,
  });
  
  const finalStartTime = eventTime.start || undefined;  // ✅ 统一使用 undefined
  const finalEndTime = eventTime.end || undefined;
  
  // ... 原有逻辑
  const event: Event = {
    id: cleanedItem.id || `event-${Date.now()}`,
    title: `${cleanedItem.emoji || ''}${cleanedItem.title}`.trim(),
    description: sanitizeHtmlToPlainText(cleanedItem.description || ''),
    startTime: finalStartTime,  // ✅ 可能是 undefined
    endTime: finalEndTime,      // ✅ 可能是 undefined
    isAllDay: cleanedItem.isAllDay,
    // ... 其他字段
  };
  
  // 不再直接调用 EventService，而是通过 EventHub
  const existingEvent = EventService.getEventById(event.id);
  if (existingEvent) {
    // ✅ 使用 EventHub.updateFields 而不是直接更新
    await EventHub.updateFields(event.id, {
      title: event.title,
      description: event.description,
      // ⚠️ 时间字段通过 TimeHub 更新
    });
    
    // 单独更新时间（如果有变化）
    if (event.startTime !== existingEvent.startTime || event.endTime !== existingEvent.endTime) {
      await TimeHub.setEventTime(event.id, {
        start: event.startTime,  // ✅ 支持 undefined
        end: event.endTime,
        source: 'plan-manager'
      });
    }
  } else {
    if (onCreateEvent) {
      onCreateEvent(event);
    }
  }
};
```

**关键修复点**:
1. **空字符串转换**: `item.startTime || undefined` 确保不会传递 `''`
2. **分离时间更新**: 非时间字段用 `EventHub.updateFields`，时间字段用 `TimeHub.setEventTime`
3. **支持 undefined**: 所有时间字段都明确允许 `undefined`

#### 4.3 更新 EventEditModal 时间输入

**文件**: `src/components/EventEditModal.tsx`

**变更内容**: 时间输入可清空

```typescript
// 时间选择器组件
const TimePickerSection = ({ event, onUpdate }: Props) => {
  const [hasTime, setHasTime] = useState<boolean>(!!event.startTime);
  
  // Task 类型时显示"添加时间"开关
  if (event.isTask === true) {
    return (
      <div className="time-section">
        <label>
          <input
            type="checkbox"
            checked={hasTime}
            onChange={(e) => {
              setHasTime(e.target.checked);
              
              if (!e.target.checked) {
                // ✅ 清空时间：直接调用 TimeHub
                await TimeHub.setEventTime(event.id, {
                  start: undefined,
                  end: undefined,
                  source: 'user'
                });
              } else {
                // 设置默认时间
                const now = new Date();
                await TimeHub.setEventTime(event.id, {
                  start: formatTimeForStorage(now),
                  end: formatTimeForStorage(new Date(now.getTime() + 3600000)),
                  source: 'user'
                });
              }
            }}
          />
          添加时间
        </label>
        
        {hasTime && (
          <UnifiedDateTimePicker
            startTime={event.startTime}
            endTime={event.endTime}
            onChange={(start, end) => {
              // ✅ 通过 TimeHub 更新
              await TimeHub.setEventTime(event.id, {
                start,
                end,
                source: 'picker'
              });
            }}
          />
        )}
      </div>
    );
  }
  
  // Calendar 事件：时间必需
  return (
    <div className="time-section">
      <UnifiedDateTimePicker
        startTime={event.startTime}
        endTime={event.endTime}
        onChange={(start, end) => {
          await TimeHub.setEventTime(event.id, {
            start,
            end,
            source: 'picker'
          });
        }}
        required
      />
    </div>
  );
};
```

#### 4.4 🆕 更新 UnifiedSlateEditor 序列化逻辑

**文件**: `src/components/UnifiedSlateEditor/serialization.ts`

**问题**: 序列化时使用了 `?? null`，可能导致空字符串

**变更内容**:
```typescript
// ✅ 修复：序列化时保持 undefined
export function serializeEventToSlate(event: Event): SlateEventNode {
  return {
    type: 'event',
    id: event.id,
    title: event.title,
    // ⚠️ 关键修复：不要用 ?? null，直接保持 undefined
    startTime: event.startTime,     // undefined 保持 undefined
    endTime: event.endTime,         // undefined 保持 undefined
    isAllDay: event.isAllDay,
    timeSpec: event.timeSpec,
    // ... 其他字段
  };
}

// ✅ 修复：反序列化时保持 undefined
export function deserializeSlateToEvent(node: SlateEventNode): Event {
  return {
    id: node.id,
    title: node.title,
    // ⚠️ 关键修复：不要转换为空字符串
    startTime: node.startTime,      // undefined 保持 undefined
    endTime: node.endTime,          // undefined 保持 undefined
    isAllDay: node.isAllDay,
    timeSpec: node.timeSpec,
    // ... 其他字段
  };
}
```

**关键修复点**:
1. **移除 `?? null`**: 直接传递 `undefined`，不转换为 `null`
2. **移除 `?? undefined`**: 反序列化时不做额外转换
3. **保持类型一致**: `startTime?: string` 始终是 `string | undefined`

---

### TODO 5: TimeHub 逻辑增强 - setEventTime 支持 undefined

**优先级**: 🟡 P1 - 核心功能  
**预计工时**: 1-2 小时  
**影响范围**: TimeHub

**架构说明**:
- ❌ **不需要** 单独的 `clearEventTime()` 方法
- ✅ **直接使用** `setEventTime({ start: undefined, end: undefined })`
- 保持 API 简洁，一个功能一个方法

#### 5.1 更新 setEventTime 支持 undefined

**文件**: `src/services/TimeHub.ts`

**变更内容**: 允许显式传入 undefined 并正确处理

```typescript
export async function setEventTime(
  eventId: string,
  input: SetEventTimeInput,
  options?: { skipSync?: boolean }
): Promise<Result> {
  console.log(`[TimeHub] Setting time for event ${eventId}`, {
    start: input.start,
    end: input.end,
    isUndefined: input.start === undefined && input.end === undefined,
  });
  
  try {
    // ✅ 允许显式设置为 undefined（清空时间）
    const updates: Partial<Event> = {
      startTime: input.start === undefined ? undefined : formatTimeForStorage(input.start),
      endTime: input.end === undefined ? undefined : formatTimeForStorage(input.end),
      isAllDay: input.allDay,
    };
    
    // 如果时间被清空，也清空 timeSpec
    if (input.start === undefined && input.end === undefined) {
      updates.timeSpec = undefined;
      console.log('[TimeHub] Clearing time fields and timeSpec');
    } else if (input.timeSpec) {
      updates.timeSpec = input.timeSpec;
    }
    
    // 从 EventService 更新
    await EventService.updateEvent(eventId, updates, { skipSync: options?.skipSync });
    
    // 清除缓存
    cache.delete(eventId);
    
    // 通知订阅者
    notifySubscribers(eventId);
    
    // 触发全局事件
    window.dispatchEvent(new CustomEvent('timeChanged', {
      detail: { 
        eventId, 
        cleared: input.start === undefined && input.end === undefined 
      }
    }));
    
    return { success: true };
  } catch (error) {
    console.error(`[TimeHub] Failed to set time:`, error);
    return { success: false, error: String(error) };
  }
}
```

#### 5.2 使用示例

```typescript
// ✅ 设置时间
await TimeHub.setEventTime('event-123', {
  start: '2025-11-14 09:00:00',
  end: '2025-11-14 10:00:00',
  source: 'picker'
});

// ✅ 清空时间（Task 类型）
await TimeHub.setEventTime('event-123', {
  start: undefined,
  end: undefined,
  source: 'user'
});
```

---

### TODO 6: 文档更新 - 补充架构变更说明

**优先级**: 🟢 P2 - 维护性  
**预计工时**: 1 小时  
**影响范围**: 架构文档

#### 6.1 更新 EVENTHUB_TIMEHUB_ARCHITECTURE.md

**文件**: `docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md`

**新增章节**:

```markdown
## 10. 时间字段 Optional 架构（v1.8）

### 10.1 设计原则

**时间字段可选性**：
- `startTime?: string | undefined` - Task 可以无时间，Calendar 必须有时间
- `endTime?: string | undefined` - 与 startTime 规则一致
- `isAllDay?: boolean | undefined` - undefined 表示未设置

**类型驱动验证**：
- `isTask = true` → 时间可选，同步到 Microsoft To Do
- `isTask = false/undefined` → 时间必需，同步到 Outlook Calendar

### 10.2 验证规则

**Task 类型（isTask = true）**：
```typescript
// ✅ 允许：无时间 Task
{ isTask: true, startTime: undefined, endTime: undefined }

// ✅ 允许：有时间 Task
{ isTask: true, startTime: '2025-11-14 09:00:00', endTime: '2025-11-14 10:00:00' }

// ❌ 禁止：部分时间 Task
{ isTask: true, startTime: '2025-11-14 09:00:00', endTime: undefined }
```

**Calendar 事件（isTask = false/undefined）**：
```typescript
// ✅ 允许：完整时间 Calendar
{ isTask: false, startTime: '2025-11-14 09:00:00', endTime: '2025-11-14 10:00:00' }

// ❌ 禁止：无时间 Calendar
{ isTask: false, startTime: undefined, endTime: undefined }
```

### 10.3 同步路由

| 事件类型 | startTime | endTime | 同步目标 |
|---------|-----------|---------|---------|
| Task | undefined | undefined | Microsoft To Do |
| Task | 有值 | 有值 | Microsoft To Do（带提醒时间） |
| Calendar | 有值 | 有值 | Outlook Calendar |
| Calendar | undefined | undefined | ❌ 不同步（验证失败） |

### 10.4 UI 显示规则

**PlanManager 时间显示**：
- Task 无时间：不显示时间字段（空）
- Task 有时间：显示相对时间（如 "明天 14:00"）
- Calendar 无时间：显示 "⚠️ 待设置时间"
- Calendar 有时间：显示相对时间

**EventEditModal 时间输入**：
- Task：显示 "添加时间" 开关，默认关闭
- Calendar：时间输入必填，无开关

### 10.5 相关工具函数

**验证**: `src/utils/eventValidation.ts`
- `validateEventTime(event)` - 验证时间字段完整性
- `requiresTime(event)` - 检查是否需要时间
- `hasValidTime(event)` - 检查是否有有效时间

**同步路由**: `src/utils/syncRouter.ts`
- `determineSyncTarget(event)` - 决定同步目标
- `shouldSyncToCalendar(event)` - 是否同步到 Calendar
- `shouldSyncToTodo(event)` - 是否同步到 To Do

**时间显示**: `src/utils/timeDisplay.ts`
- `formatEventTimeDisplay(event)` - 格式化时间显示（适配 undefined）
- `getTimeDisplayClass(event)` - 获取时间显示样式类
```

#### 6.2 更新版本历史

**文件**: `docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md`

**在版本更新历史表格中添加**:
```markdown
| **v1.8** | 2025-11-14 | 🔥 支持时间字段 undefined，实现 Task vs Calendar 差异化验证和同步 |
```

---

## 🎯 实施优先级和顺序

### 阶段 1：基础架构（必需，1-2 天）
1. ✅ **TODO 1**: 类型系统重构 - 时间字段改为可选
2. ✅ **TODO 2**: 验证逻辑更新 - 区分 Task 和 Calendar 事件
3. ✅ **TODO 5**: TimeHub 逻辑增强 - setEventTime 支持 undefined

### 阶段 2：外部集成（重要，1-2 天）
4. ✅ **TODO 3**: 同步逻辑更新 - 路由到 Calendar 或 To Do

### 阶段 3：用户体验（优化，1-2 天）
5. ✅ **TODO 4**: UI 组件适配 - 处理 undefined 时间显示（PlanManager, EventEditModal, UnifiedSlateEditor）

### 阶段 4：文档维护（维护，半天）
6. ✅ **TODO 6**: 文档更新 - 补充架构变更说明

**总预计工时**: 3-5 天

**数据迁移**: 🗑️ 不需要专门迁移，清空 localStorage 缓存即可

**关键设计决策**:
- ✅ 不创建单独的 `clearEventTime()` 方法
- ✅ `setEventTime` 支持 `undefined` 即可实现清空功能
- ✅ 保持 API 简洁，减少学习成本

---

## ⚠️ 风险和注意事项

### 1. 数据迁移风险

**问题**: 现有数据可能有空字符串 `""` 而非 `undefined`

**解决方案**: 
```typescript
// 💡 简单方案：清空 localStorage 缓存
localStorage.removeItem('events');
localStorage.removeItem('remarkable-events');
// 或者直接在浏览器开发者工具中清空 Application > Local Storage

// ✅ 新代码会自动将空字符串转换为 undefined
// PlanManager.syncToUnifiedTimeline 已有转换逻辑：
const cleanedItem = {
  ...item,
  startTime: item.startTime || undefined,  // '' → undefined
  endTime: item.endTime || undefined,
};
```

### 2. PlanManager auto-save 兼容性

**问题**: 现有 auto-save 逻辑可能仍然传递空字符串

**解决方案**: 
```typescript
// PlanManager.tsx 中
const updatedItem = {
  ...item,
  startTime: item.startTime || undefined,  // 转换空字符串为 undefined
  endTime: item.endTime || undefined,
};
```

### 3. TypeScript 严格模式检查

**问题**: 启用 `strictNullChecks` 后可能有大量类型错误

**解决方案**: 
- 逐步修复，优先核心模块
- 使用类型守卫函数减少类型断言

### 4. 外部同步 API 兼容性

**问题**: Microsoft Graph API 可能不接受 undefined

**解决方案**:
```typescript
// 同步前过滤 undefined
const calendarEvent = {
  subject: event.title,
  ...(event.startTime && { start: { dateTime: event.startTime } }),
  ...(event.endTime && { end: { dateTime: event.endTime } }),
};
```

---

## 📊 测试计划

### 单元测试

**文件**: `src/utils/__tests__/eventValidation.test.ts`

```typescript
describe('validateEventTime', () => {
  it('should allow Task without time', () => {
    const result = validateEventTime({
      id: '1',
      title: 'Task',
      isTask: true,
      startTime: undefined,
      endTime: undefined,
    });
    expect(result.valid).toBe(true);
  });
  
  it('should reject Calendar without time', () => {
    const result = validateEventTime({
      id: '2',
      title: 'Calendar Event',
      isTask: false,
      startTime: undefined,
      endTime: undefined,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('requires both startTime and endTime');
  });
  
  // ... 更多测试用例
});
```

### 集成测试

**测试场景**:
1. 创建无时间 Task → 同步到 Microsoft To Do
2. 为 Task 添加时间 → 更新 To Do 提醒
3. 清空 Task 时间 → TimeHub.setEventTime({ start: undefined, end: undefined })
4. 创建 Calendar 事件 → 验证时间必需
5. PlanManager syncToUnifiedTimeline → 不会传递空字符串
6. UnifiedSlateEditor 序列化/反序列化 → 保持 undefined

### 手动测试清单

- [x] **TODO 1**: TypeScript 编译通过，无类型错误 ✅
- [x] **TODO 2**: 创建 `eventValidation.ts` 验证工具 ✅
- [x] **TODO 2**: EventService 集成验证逻辑 ✅
- [x] **TODO 3**: 创建 `syncRouter.ts` 同步路由工具 ✅
- [x] **TODO 3**: EventService 集成同步路由逻辑 ✅
- [x] **TODO 4**: PlanManager `syncToUnifiedTimeline` 修复空字符串转 undefined ✅
- [x] **TODO 4**: UnifiedSlateEditor 序列化/反序列化移除 `?? null` ✅
- [x] **TODO 4**: EventEditModal 已使用 TimeHub（无需修改）✅
- [x] **TODO 5**: TimeHub.setEventTime 已支持 undefined ✅
- [ ] **集成测试**: PlanManager 创建 Task，不设置时间
- [ ] **集成测试**: EventService 验证拒绝无时间 Calendar 事件
- [ ] **集成测试**: EventEditModal 为 Task 添加时间
- [ ] **集成测试**: EventEditModal 清空 Task 时间
- [ ] **数据迁移**: 清空 localStorage 缓存后重新测试

---

## ✅ 实施总结

### 已完成的变更

**v1.4 (2025-11-14) - 实施完成**:

1. **类型系统 (TODO 1)** ✅
   - 文件：`src/types.ts`
   - 变更：Event 接口时间字段添加明确注释，支持 `undefined`
   - 影响：编译器级别的类型检查增强

2. **验证逻辑 (TODO 2)** ✅
   - 新增：`src/utils/eventValidation.ts`
   - 函数：
     - `validateEventTime()` - Task/Calendar 差异化验证
     - `requiresTime()` - 检查是否需要时间
     - `hasValidTime()` - 检查是否有有效时间
     - `hasAnyTime()` - 检查是否有任何时间信息
   - 集成：`EventService.createEvent()` 和 `updateEvent()`

3. **同步路由 (TODO 3)** ✅
   - 新增：`src/utils/syncRouter.ts`
   - 函数：
     - `determineSyncTarget()` - 决定同步目标（Calendar/To Do/None）
     - `shouldSync()` - 是否应该同步
     - `shouldSyncToCalendar()` - 是否同步到日历
     - `shouldSyncToTodo()` - 是否同步到待办
   - 集成：`EventService.createEvent()` 和 `updateEvent()`

4. **UI 适配 (TODO 4)** ✅
   - **PlanManager.tsx**：
     - `syncToUnifiedTimeline()` 修复空字符串转 undefined
     - 变更：`startTime: finalStartTime || undefined`
   - **UnifiedSlateEditor/serialization.ts**：
     - 移除序列化时的 `?? null` 转换
     - 移除反序列化时的 `?? undefined` 默认值
     - 保留原始 undefined 值
   - **EventEditModal**：
     - 已使用 TimeHub，无需修改 ✅

5. **TimeHub 支持 (TODO 5)** ✅
   - 验证：TimeHub.setEventTime 已通过 `normalize()` 函数支持 undefined
   - 代码：`if (!v) return undefined;` ✅

### 数据迁移

**方案**：简单清空 localStorage 缓存
```javascript
// 开发者控制台运行
localStorage.removeItem('remarkable-events');
localStorage.removeItem('remarkable-timehub-cache');
```

### 后续工作

- [ ] 编写单元测试（`eventValidation.test.ts`）
- [ ] 集成测试验证 Task/Calendar 差异化行为
- [ ] 用户手册更新（如何创建无时间任务）

---

## 📚 相关文档

- [EVENTHUB_TIMEHUB_ARCHITECTURE.md](./EVENTHUB_TIMEHUB_ARCHITECTURE.md) - EventHub & TimeHub 架构
- [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md) - 统一时间架构
- [EventEditModal v2 PRD](../PRD/EVENTEDITMODAL_V2_PRD.md) - EventEditModal v2 产品需求

---

**文档版本**: v1.4  
**创建时间**: 2025-11-14  
**最后更新**: 2025-11-14  
**状态**: ✅ 实施完成  
**维护者**: GitHub Copilot  
**变更记录**:
- v1.0 (2025-11-14): 初始版本
- v1.1 (2025-11-14): 移除 `clearEventTime()` 方法，统一使用 `setEventTime({ start: undefined })`
- v1.2 (2025-11-14): 补充 PlanManager 和 UnifiedSlateEditor 实施方案
- v1.3 (2025-11-14): 移除数据清洗工具，简化为清空缓存
- v1.4 (2025-11-14): **实施完成**，所有 TODO 已完成，添加实施总结
- v1.3 (2025-11-14): 🗑️ 移除数据清洗工具（TODO 7），改为清空 localStorage 缓存的简单方案
