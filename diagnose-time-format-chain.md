# 时间格式链路诊断报告

## 🔍 链路追踪：UnifiedDateTimePicker → EventService → localStorage → Display

### ✅ 1. UnifiedDateTimePicker 输出格式

**位置**: `src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.tsx` L668-673

```typescript
const startIso = startDateTime.format('YYYY-MM-DD HH:mm:ss');
const endIso = endDateTime ? endDateTime.format('YYYY-MM-DD HH:mm:ss') : undefined;
```

**输出类型**:
- `startIso`: `string` (格式: "YYYY-MM-DD HH:mm:ss")
- `endIso`: `string | undefined` (格式: "YYYY-MM-DD HH:mm:ss" 或 `undefined`)

**✅ undefined 支持**: 是 - 当没有结束时间时返回 `undefined`

---

### ✅ 2. TimeHub.setEventTime() 处理

**位置**: `src/services/TimeHub.ts` L142-220

```typescript
async setEventTime(
  eventId: string, 
  input: SetEventTimeInput,
  options: { skipSync?: boolean } = {}
): Promise<{ success: boolean; event?: Event; error?: string }>

// 标准化函数
const normalize = (v?: string | Date) => {
  console.log('[TimeHub.normalize] 输入:', v, typeof v);
  if (!v) return undefined;  // ✅ 处理 undefined
  const d = v instanceof Date ? v : parseLocalTimeString(v);
  const result = formatTimeForStorage(d);
  console.log('[TimeHub.normalize] 输出:', result);
  return result;
};

const start = normalize(input.start);
const end = normalize(input.end);  // ✅ 可以是 undefined
```

**✅ undefined 支持**: 是 - `normalize` 函数正确处理 `undefined` 输入

**时间规范化**:
- 输入: `string | Date | undefined`
- 处理: 通过 `parseLocalTimeString()` 和 `formatTimeForStorage()`
- 输出: `string | undefined` (格式: "YYYY-MM-DD HH:mm:ss")

**TimeSpec 生成**:
```typescript
// v2.7: 单个时间点时，end 应该是 undefined（不是 start）
const finalEnd = kind === 'range' ? end : undefined;

timeSpec = {
  kind,
  rawText: input.rawText,
  source: input.source ?? 'picker',
  policy,
  start,
  end: finalEnd,  // ✅ 可以是 undefined
  allDay: input.allDay,
  resolved: { start, end: finalEnd },
};
```

**✅ undefined 支持**: 是 - `finalEnd` 在非范围模式下为 `undefined`

---

### ⚠️ 3. EventService.updateEvent() 处理

**位置**: `src/services/EventService.ts` L650-730

```typescript
// 🆕 v1.8: 只合并非 undefined 的字段，避免覆盖已有数据
// 🔧 v2.9: 但对于时间字段，允许显式设为 undefined 以清除
const filteredUpdates: Partial<Event> = {};

Object.keys(updatesWithSync).forEach(key => {
  const typedKey = key as keyof Event;
  const value = updatesWithSync[typedKey];
  
  // 🔧 如果值不是 undefined，直接包含
  if (value !== undefined) {
    filteredUpdates[typedKey] = value as any;
  } 
  // 🔧 如果值是 undefined 但 key 存在于 updatesWithSync（显式设置），也包含
  else if (Object.prototype.hasOwnProperty.call(updatesWithSync, key)) {
    // 显式设置为 undefined（用于清除字段）
    filteredUpdates[typedKey] = undefined as any;
    console.log(`[EventService] 📝 显式清除字段: ${key}`);
  }
});

// 合并更新
const updatedEvent: Event = {
  ...originalEvent,
  ...filteredUpdates,  // 使用过滤后的 updates
  id: eventId,
  updatedAt: formatTimeForStorage(new Date())
};
```

**✅ undefined 支持**: 是 - 允许显式设置 `undefined` 来清除字段

**潜在问题**: 
- 如果 `endTime: undefined` 在 `updatesWithSync` 中，会被合并到 `filteredUpdates`
- 在 JSON.stringify 时，`undefined` 会被忽略（不会出现在 JSON 中）
- 从 localStorage 读取时，该字段会消失

---

### ⚠️ 4. localStorage 存储

**位置**: `src/services/EventService.ts` L724

```typescript
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
```

**JSON.stringify 行为**:
- `{ startTime: "2025-11-24 10:00:00", endTime: undefined }` 
  → `{"startTime":"2025-11-24 10:00:00"}` (endTime 被忽略)
- `{ startTime: "2025-11-24 10:00:00", endTime: null }` 
  → `{"startTime":"2025-11-24 10:00:00","endTime":null}`

**❌ 问题**: `undefined` 在 JSON 序列化时会丢失！

---

### ✅ 5. 显示层处理

**位置**: `src/components/PlanSlate/EventLineSuffix.tsx` L38-48

```typescript
// 从 TimeHub 或 metadata 读取时间
const startTimeStr = (eventTime.start && eventTime.start !== '') 
  ? eventTime.start 
  : (metadata.startTime || null);  // ✅ 使用 null 兜底
  
const endTimeStr = (eventTime.end && eventTime.end !== '') 
  ? eventTime.end 
  : (metadata.endTime || null);  // ✅ 使用 null 兜底

// 格式化时间显示
const relativeTimeDisplay = startTime || dueDate 
  ? formatRelativeTimeDisplay(startTimeStr, endTimeStr, isAllDay ?? false, dueDateStr)
  : null;
```

**✅ undefined 支持**: 是 - 转换为 `null` 处理

**位置**: `src/utils/relativeDateFormatter.ts` L300-366

```typescript
export function formatRelativeTimeDisplay(
  startTime?: string | null,  // ✅ 接受 undefined 和 null
  endTime?: string | null,    // ✅ 接受 undefined 和 null
  isAllDay?: boolean,
  dueDate?: string | null
): string {
  const now = new Date();
  
  // 优先使用开始时间，其次是截止日期
  const primaryDate = startTime || dueDate;
  
  if (!primaryDate) {
    return ''; // ✅ 没有任何日期信息返回空字符串
  }
  
  // ... 格式化逻辑
}
```

**✅ undefined/null 支持**: 完全支持，正确处理所有情况

---

## 🐛 发现的问题

### ❌ 问题 1: JSON 序列化丢失 undefined

**现象**: 
- Picker 传递 `endTime: undefined`
- TimeHub 处理后传递 `end: undefined` 给 EventService
- EventService 更新时 `endTime: undefined`
- localStorage 保存时 `JSON.stringify()` 忽略 `undefined`
- 从 localStorage 读取后，`endTime` 字段不存在（既不是 `undefined` 也不是 `null`）

**影响**:
- 如果之前有 `endTime` 值，现在设置为 `undefined`，实际上不会清除旧值
- `{ ...originalEvent, ...{ endTime: undefined } }` → 旧的 `endTime` 仍然存在

**根本原因**:
- JavaScript 对象的 `undefined` 值在 spread 时会覆盖
- 但 `JSON.stringify` 会忽略 `undefined`
- 导致存储和读取不一致

---

## ✅ 解决方案

### 方案 1: 使用 null 代替 undefined（推荐）

**修改 UnifiedDateTimePicker**:
```typescript
// 当前 (L670)
const endIso = endDateTime ? endDateTime.format('YYYY-MM-DD HH:mm:ss') : undefined;

// 修改为
const endIso = endDateTime ? endDateTime.format('YYYY-MM-DD HH:mm:ss') : null;
```

**修改 TimeHub**:
```typescript
// 当前 (L166-167)
const normalize = (v?: string | Date) => {
  if (!v) return undefined;  // ❌
  // ...
};

// 修改为
const normalize = (v?: string | Date | null) => {
  if (!v) return null;  // ✅ 返回 null 而不是 undefined
  // ...
};
```

**优点**:
- `null` 会被 JSON.stringify 保留
- 明确表示"没有结束时间"
- 与现有代码兼容（显示层已经处理 `null`）

### 方案 2: EventService 显式删除字段

**修改 EventService.updateEvent()**:
```typescript
// 在序列化前，显式删除值为 undefined 的字段
Object.keys(updatedEvent).forEach(key => {
  if (updatedEvent[key as keyof Event] === undefined) {
    delete updatedEvent[key as keyof Event];
  }
});

// 然后再保存
localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
```

**优点**:
- 保持链路中 `undefined` 语义
- 明确区分"未设置"(undefined) 和"清除"(delete)

**缺点**:
- 增加复杂度
- delete 操作性能较差

---

## 🎯 推荐实施

### 立即修复 (高优先级)

1. **UnifiedDateTimePicker** 返回 `null` 而不是 `undefined`
2. **TimeHub.normalize()** 返回 `null` 而不是 `undefined`
3. **类型定义统一**:
   ```typescript
   // Event 类型
   interface Event {
     startTime?: string | null;  // 而不是 string | undefined
     endTime?: string | null;
   }
   
   // SetEventTimeInput 类型
   export type SetEventTimeInput = {
     start?: string | Date | null;
     end?: string | Date | null;
   }
   ```

### 测试验证

创建测试用例：
1. 创建事件，只设置开始时间（不设置结束时间）→ localStorage 中无 `endTime` 字段或为 `null`
2. 修改事件，清除结束时间 → localStorage 中 `endTime` 变为 `null`
3. 刷新页面后，时间显示正确（不显示错误的结束时间）

---

## 📋 检查清单

- [x] UnifiedDateTimePicker 输出格式检查
- [x] TimeHub 时间规范化检查
- [x] EventService 更新逻辑检查
- [x] localStorage 序列化行为检查
- [x] 显示层 undefined/null 处理检查
- [x] **已分析**: JSON.stringify 丢失 undefined 问题（已确认为根本原因）
- [x] **已规划**: 类型定义统一使用 `| null`（详见 UNDEFINED_VS_NULL_TIME_FIELDS_FIX.md）
- [x] **已完成**: 文档更新（已更新 4 个架构文档）
- [ ] **待实施**: 代码修复（4 个文件需修改）
- [ ] **待测试**: 完整链路端到端测试

---

**诊断日期**: 2025-11-24  
**更新日期**: 2025-11-25  
**诊断人**: GitHub Copilot
