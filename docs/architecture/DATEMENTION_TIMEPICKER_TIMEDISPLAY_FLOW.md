# DateMention、TimePicker、TimeDisplay 关联更新逻辑

> **文档版本**: v2.8.3  
> **创建日期**: 2025-11-15  
> **核心组件关系**: DateMention ↔ TimeHub ↔ TimePicker ↔ TimeDisplay

---

## 📊 核心架构图

```
┌──────────────────────────────────────────────────────────────────────┐
│ 用户层                                                                 │
│ ┌─────────────┐  ┌──────────────┐  ┌──────────────┐                 │
│ │  自然语言    │  │ TimePicker   │  │  TimeDisplay │                 │
│ │  @明天下午2点│  │  手动选择时间 │  │  显示相对时间 │                 │
│ └──────┬──────┘  └──────┬───────┘  └──────┬───────┘                 │
└────────┼─────────────────┼─────────────────┼──────────────────────────┘
         │                 │                 │
         ▼                 ▼                 ▼
┌──────────────────────────────────────────────────────────────────────┐
│ Slate 编辑器层 (PlanSlate.tsx)                               │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ 1. 自然语言解析                                                │     │
│ │    用户输入: @明天下午2点                                       │     │
│ │    ↓                                                          │     │
│ │    parseNaturalLanguage("明天下午2点")                        │     │
│ │    ↓                                                          │     │
│ │    { startHour: 14, endHour: 0 } ← endHour=0 表示无结束时间    │     │
│ └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ 2. handleMentionSelect (Line 1186)                           │     │
│ │    ↓                                                          │     │
│ │    Step 1: 写入 TimeHub                                       │     │
│ │      await TimeHub.setEventTime(eventId, {                   │     │
│ │        start: "2025-11-15 14:00:00",  // 本地时间字符串        │     │
│ │        end: undefined,                // ✅ 无结束时间         │     │
│ │        source: 'mention'                                      │     │
│ │      })                                                       │     │
│ │    ↓                                                          │     │
│ │    Step 2: 插入 DateMention 节点                              │     │
│ │      insertDateMention(editor, startStr, endStr, false,      │     │
│ │        eventId, "明天下午2点")                                │     │
│ └──────────────────────────────────────────────────────────────┘     │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ 3. DateMention 节点结构 (DateMentionNode)                     │     │
│ │    {                                                          │     │
│ │      type: 'dateMention',                                     │     │
│ │      startDate: "2025-11-15 14:00:00",                       │     │
│ │      endDate: undefined,          // ✅ 无结束时间             │     │
│ │      eventId: "event-uuid",                                   │     │
│ │      originalText: "明天下午2点",  // 用户原始输入             │     │
│ │      isOutdated: false            // 是否过期                 │     │
│ │    }                                                          │     │
│ └──────────────────────────────────────────────────────────────┘     │
└────────┬───────────────────────┬───────────────────────────────────┬─┘
         │                       │                                   │
         ▼                       ▼                                   ▼
┌─────────────────────┐ ┌──────────────────────┐ ┌──────────────────────┐
│ TimeHub.ts          │ │ DateMentionElement   │ │ serialization.ts     │
│ (状态管理)           │ │ (UI渲染)             │ │ (序列化)              │
│                     │ │                      │ │                      │
│ setEventTime({     │ │ useEventTime(eventId)│ │ slateNodesToPlanItems│
│   eventId,         │ │ ↓                    │ │ ↓                    │
│   start,           │ │ 订阅 TimeHub 实时数据 │ │ 检测 DateMention:    │
│   end,             │ │ ↓                    │ │   if (dateMention) { │
│   allDay           │ │ formatRelativeDate() │ │     item.startTime = │
│ })                 │ │ ↓                    │ │       dateMention... │
│ ↓                  │ │ 显示: "明天下午2点"   │ │   }                  │
│ 通知所有订阅者      │ │                      │ │ ↓                    │
│ (useEventTime)     │ │ 🔴 isOutdated?       │ │ 时间优先级:           │
└─────────────────────┘ │ 显示更新/移除按钮     │ │ DateMention > meta   │
                        └──────────────────────┘ └──────────────────────┘
         │                       │                                   │
         ▼                       ▼                                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ PlanManager.tsx (TimeDisplay 显示层)                                  │
│                                                                        │
│ ┌──────────────────────────────────────────────────────────────┐     │
│ │ PlanItemTimeDisplay (Line 58)                                │     │
│ │   ↓                                                          │     │
│ │   useEventTime(eventId) ← 订阅 TimeHub 实时数据               │     │
│ │   ↓                                                          │     │
│ │   formatRelativeTimeDisplay(start, end, isAllDay)           │     │
│ │   ↓                                                          │     │
│ │   显示: "明天 14:00后"  // ✅ 动态计算相对时间                 │     │
│ └──────────────────────────────────────────────────────────────┘     │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 数据流详解

### 1. **用户输入 → DateMention 创建**

**触发方式**:
- 用户输入 `@明天下午2点` 并按 Enter
- 或点击 TimePicker 选择时间

**处理流程**:

```typescript
// Step 1: 自然语言解析 (naturalLanguageTimeDictionary.ts)
parseNaturalLanguage("明天下午2点")
↓
{
  dateRange: { start: 2025-11-15, end: 2025-11-15 },
  timePeriod: {
    name: "下午2点",
    startHour: 14,
    startMinute: 0,
    endHour: 0,        // ✅ 0 表示无结束时间
    endMinute: 0,
    isFuzzyTime: false,
    timeType: 'start'
  }
}

// Step 2: 写入 TimeHub (handleMentionSelect)
await TimeHub.setEventTime(eventId, {
  start: "2025-11-15 14:00:00",  // ✅ 本地时间字符串
  end: undefined,                // ✅ 无结束时间
  kind: 'fixed',
  source: 'mention',
  rawText: "明天下午2点"
})

// Step 3: 插入 DateMention 节点
insertDateMention(editor, 
  "2025-11-15 14:00:00",  // startDate
  undefined,              // endDate
  false,                  // mentionOnly
  eventId,                // eventId
  "明天下午2点"            // originalText
)

// Step 4: Slate 节点结构
{
  type: 'dateMention',
  startDate: "2025-11-15 14:00:00",
  endDate: undefined,
  eventId: "event-uuid",
  originalText: "明天下午2点",  // ✅ 用于显示
  isOutdated: false,
  children: [{ text: '' }]  // void 元素
}
```

---

### 2. **DateMention 显示 (UI 渲染)**

**组件**: `DateMentionElementComponent` (Line 1-263)

**关键逻辑**:

```typescript
// 1. 订阅 TimeHub 实时数据
const { timeSpec, start, end, loading } = useEventTime(eventId);

// 2. 检测是否过期
const isOutdated = useMemo(() => {
  if (!start || !dateMentionElement.startDate) return false;
  return isDateMentionOutdated(dateMentionElement.startDate, start);
}, [start, dateMentionElement.startDate]);

// 3. 显示优先级
const displayText = useMemo(() => {
  // 🎯 优先级 1: 用户原始输入 (originalText)
  if (dateMentionElement.originalText) {
    return dateMentionElement.originalText;  // "明天下午2点"
  }
  
  // 🎯 优先级 2: TimeHub 实时数据
  if (start) {
    return formatRelativeDate(new Date(start));  // "明天"
  }
  
  // 🎯 优先级 3: element 自带数据
  if (dateMentionElement.startDate) {
    return formatRelativeDate(new Date(dateMentionElement.startDate));
  }
  
  return '未知日期';
}, [start, end, dateMentionElement]);

// 4. 过期检测和更新提示
if (isOutdated) {
  // 显示红色背景 + 更新/移除按钮
  // 点击可更新到 TimeHub 当前值
}
```

**显示效果**:
- ✅ 正常状态: `明天下午2点` (蓝色背景)
- 🔴 过期状态: `明天下午2点` (红色背景) + Popover 提示

---

### 3. **时间优先级机制 (谁后更新，以谁为准)**

**场景**: DateMention 与 TimeHub 不一致时

**实现**: `serialization.ts` L384-397

```typescript
// slateNodesToPlanItems 序列化时
if (fragment) {
  const dateMention = fragment.find((n): n is DateMentionNode => 
    'type' in n && n.type === 'dateMention'
  );
  
  if (dateMention) {
    // 🔥 DateMention 存在 → 覆盖 metadata 的时间
    item.startTime = dateMention.startDate;
    item.endTime = dateMention.endDate || undefined;
    
    console.log('[🔄 时间优先级] DateMention 覆盖时间:', {
      eventId: baseId.slice(-10),
      startTime: dateMention.startDate,
      endTime: dateMention.endDate,
    });
  }
}
```

**优先级规则**:
1. **DateMention 节点** (最高优先级)
   - 用户最近通过 @mention 输入的时间
   - 序列化时覆盖 metadata
2. **TimeHub 快照** (中等优先级)
   - Picker 手动选择的时间
   - 直接写入 TimeHub
3. **Event metadata** (最低优先级)
   - 初始化时的时间
   - 会被 DateMention 覆盖

---

### 4. **TimePicker 交互流程**

**触发方式**:
- 点击 DateMention → 打开 TimePicker
- 或直接点击 FloatingBar 时间按钮

**组件**: `UnifiedDateTimePicker` (Line 2079-2092)

```typescript
// 1. 初始化 Picker
<UnifiedDateTimePicker
  initialStart={mentionInitialStart}  // Date 对象或 undefined
  initialEnd={mentionInitialEnd}      // Date 对象或 undefined
  onApplied={handleMentionSelect}     // 确认回调
  onClose={handleMentionClose}        // 关闭回调
/>

// 2. 初始化逻辑 (Line 372)
const end = initialEnd
  ? dayjs(typeof initialEnd === 'string' ? parseLocalTimeString(initialEnd) : initialEnd)
  : null;  // ✅ v2.8.3 修复：不回退到 start

// 3. 用户确认后回调
const handleApply = () => {
  const startIso = startDateTime.format('YYYY-MM-DD HH:mm:ss');
  const endIso = endDateTime ? endDateTime.format('YYYY-MM-DD HH:mm:ss') : undefined;
  
  // 写入 TimeHub
  await TimeHub.setEventTime(eventId, {
    start: startIso,
    end: endIso,
    allDay: allDaySelected,
    source: 'picker'
  });
  
  // 触发回调
  onApplied?.(startIso, endIso, allDaySelected);
}
```

**数据流**:
```
用户选择时间 → Picker 状态更新 → 点击确定
  ↓
handleApply
  ↓
TimeHub.setEventTime(eventId, { start, end })
  ↓
通知所有 useEventTime 订阅者
  ↓
DateMentionElement 自动更新显示
  ↓
PlanManager TimeDisplay 自动更新
```

---

### 5. **TimeDisplay 动态显示**

**组件**: `PlanItemTimeDisplay` (PlanManager.tsx Line 58)

**逻辑**:

```typescript
// 1. 订阅 TimeHub 实时数据
const { start, end, loading, isFuzzyTime, fuzzyTimeName } = useEventTime(eventId);

// 2. 动态格式化时间
const relativeTimeDisplay = formatRelativeTimeDisplay(
  start,  // "2025-11-15 14:00:00"
  end,    // undefined
  false,  // isAllDay
  isFuzzyTime,
  fuzzyTimeName
);
// 返回: "明天 14:00后"

// 3. 根据场景显示
if (isFuzzyTime && fuzzyTimeName) {
  return `明天 下午`;  // 模糊时间段
} else if (!end) {
  return `明天 14:00后`;  // 只有开始时间
} else {
  return `明天 14:00 - 16:00`;  // 时间范围
}
```

**显示规则**:

| 时间类型 | `start` | `end` | `isAllDay` | `fuzzyTimeName` | 显示效果 |
|---------|---------|-------|-----------|----------------|---------|
| 全天事件 | `null` | `null` | `true` | `null` | `明天 全天` |
| 开始时间 | `14:00` | `null` | `false` | `null` | `明天 14:00后` |
| 时间范围 | `14:00` | `16:00` | `false` | `null` | `明天 14:00 - 16:00` |
| 模糊时间 | `13:00` | `18:00` | `false` | `'下午'` | `明天 下午` |
| 截止时间 | `null` | `22:00` | `false` | `null` | `明天 22:00前` |

---

## 🔄 更新同步机制

### 1. **TimeHub → DateMention 同步**

**触发**: TimeHub.setEventTime() 调用后

```typescript
// TimeHub 发布更新
TimeHub.setEventTime(eventId, { start, end })
  ↓
通知所有 useEventTime(eventId) 订阅者
  ↓
DateMentionElement 收到新数据
  ↓
useMemo 重新计算 displayText
  ↓
自动重新渲染
```

**过期检测**:
```typescript
// DateMentionElement.tsx Line 39
const isOutdated = useMemo(() => {
  if (!start || !dateMentionElement.startDate) return false;
  // 比较 TimeHub 时间 vs DateMention 存储的时间
  return isDateMentionOutdated(dateMentionElement.startDate, start);
}, [start, dateMentionElement.startDate]);

// 如果过期 → 显示红色背景 + 更新按钮
```

---

### 2. **DateMention → TimeHub 更新**

**方式 1: 用户点击 "更新" 按钮**

```typescript
// DateMentionElement.tsx Line 138
const handleUpdateToCurrentTime = async () => {
  const editor = (window as any).__slateEditor;
  const path = ReactEditor.findPath(editor, element);
  
  // 更新 DateMention 节点到 TimeHub 当前值
  Transforms.setNodes(editor, {
    startDate: start,         // 使用 TimeHub 的值
    endDate: end || start,
    isOutdated: false,
  }, { at: path });
  
  console.log('[DateMentionElement] ✅ 已更新到当前时间');
}
```

**方式 2: 序列化时自动覆盖**

```typescript
// serialization.ts L384-397
// 保存到数据库时，DateMention 的时间会覆盖 metadata
item.startTime = dateMention.startDate;
item.endTime = dateMention.endDate || undefined;
```

---

## 🎯 关键设计决策

### 1. **为什么 DateMention 优先于 TimeHub？**

**原因**:
- DateMention 是用户**最近**的输入意图
- TimeHub 可能被其他方式修改（Picker、远程同步）
- 保留用户原始输入文本（originalText）更直观

**实现**:
```typescript
// 序列化时检测 DateMention，覆盖 metadata
if (dateMention) {
  item.startTime = dateMention.startDate;  // 覆盖
  item.endTime = dateMention.endDate;      // 覆盖
}
```

---

### 2. **为什么使用 originalText 而不是动态格式化？**

**优势**:
- 保留用户原始表达（"下周二下午3点" vs "11月18日 15:00"）
- 更符合用户心理预期
- 避免格式化后丢失语义信息

**实现**:
```typescript
// DateMentionElement.tsx Line 88
if (dateMentionElement.originalText) {
  return dateMentionElement.originalText;  // "下周二下午3点"
}
```

---

### 3. **为什么需要 isOutdated 检测？**

**场景**:
- 用户输入 "@明天下午2点"
- 然后通过 Picker 修改为 "明天下午3点"
- DateMention 显示过期提示，允许用户更新或移除

**实现**:
```typescript
// 比较 TimeHub 时间 vs DateMention 时间
const isOutdated = isDateMentionOutdated(
  dateMentionElement.startDate,  // "2025-11-15 14:00:00"
  start                          // "2025-11-15 15:00:00" (TimeHub)
);
// 如果不一致 → isOutdated = true
```

---

## 🐛 常见问题 & 解决方案

### Q1: DateMention 显示时间与 Picker 选择不一致？

**原因**: DateMention 节点未更新

**解决**:
1. 点击 DateMention 显示的更新按钮
2. 或重新输入 @mention

---

### Q2: TimePicker 显示 14:00→14:00 而不是 14:00→--？

**原因**: v2.8.2 之前的 bug，初始化时错误回退 `end = start`

**已修复** (v2.8.3):
```typescript
// ❌ 修复前
const end = initialEnd ? dayjs(...) : start;

// ✅ 修复后
const end = initialEnd ? dayjs(...) : null;
```

---

### Q3: 全天勾选后取消，自动填充了 9:00-10:00？

**原因**: v2.8.2 之前的设计

**已修复** (v2.8.3):
```typescript
// ✅ 取消全天时不自动设置时间
toggleAllDay = () => {
  if (newAllDay) {
    setStartTime(null);
    setEndTime(null);
  } else {
    // 不修改时间，保持原状态
  }
}
```

---

## 📋 测试场景

### 场景 1: 自然语言输入

```
用户输入: @明天下午2点
预期结果:
  - DateMention 显示: "明天下午2点"
  - TimeHub 存储: { start: "2025-11-15 14:00:00", end: undefined }
  - TimeDisplay 显示: "明天 14:00后"
```

### 场景 2: Picker 修改时间

```
操作:
  1. 输入 @明天下午2点
  2. 点击 Picker 修改为 15:00
预期结果:
  - DateMention 显示红色: "明天下午2点" (过期)
  - Popover 提示: "时间已变化"
  - TimeHub 存储: { start: "2025-11-15 15:00:00" }
  - TimeDisplay 显示: "明天 15:00后"
```

### 场景 3: DateMention 更新

```
操作:
  1. 点击红色 DateMention
  2. 点击 "更新到当前时间"
预期结果:
  - DateMention 更新为: { startDate: "2025-11-15 15:00:00", isOutdated: false }
  - 显示变为蓝色: "明天下午2点" (originalText 不变)
  - 序列化时以 15:00 为准
```

---

## 🔧 维护指南

### 修改 DateMention 显示逻辑

**文件**: `DateMentionElement.tsx`

**关键位置**:
- Line 88: `displayText` 计算逻辑
- Line 39: `isOutdated` 检测逻辑
- Line 138: `handleUpdateToCurrentTime` 更新逻辑

### 修改时间优先级

**文件**: `serialization.ts`

**关键位置**:
- Line 384-397: DateMention 优先级检测
- 修改此处可改变优先级规则

### 修改 TimeDisplay 格式

**文件**: `relativeDateFormatter.ts`

**关键函数**:
- `formatRelativeTimeDisplay()`: 主格式化函数
- `formatRelativeDate()`: 相对日期格式化

---

## 📖 相关文档

- [TIME_PICKER_AND_DISPLAY_PRD.md](../PRD/TIME_PICKER_AND_DISPLAY_PRD.md)
- [UNDEFINED_TIME_FIELD_REFACTOR_PLAN.md](./UNDEFINED_TIME_FIELD_REFACTOR_PLAN.md)
- [TIME_ARCHITECTURE.md](../docs/TIME_ARCHITECTURE.md)
