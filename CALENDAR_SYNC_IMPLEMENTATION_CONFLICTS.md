# EventEditModal V2 - 日历与同步机制实现冲突项

> **创建时间**: 2025-11-24  
> **状态**: 待用户确认  
> **相关文档**: 
> - [EventEditModal V2 PRD](./docs/PRD/EVENTEDITMODAL_V2_PRD.md)
> - [EventEditModal V1](./src/components/EventEditModal.tsx)
> - [Event Types](./src/utils/holidays/types.ts)

---

## 📋 冲突项列表

### 冲突 1: 日历字段命名与结构

**V1 实现**:
```typescript
// EventEditModal.tsx
formData.calendarIds: string[]  // 多选日历数组
```

**V2 PRD 定义**:
```typescript
// EVENTEDITMODAL_V2_PRD.md - Line 2654
sourceCalendarId: string         // 单个来源日历
syncCalendarId: string           // 单个同步日历
planSyncConfig.targetCalendars: string[]  // 同步目标日历数组
```

**Event 类型定义** (types.ts):
```typescript
// src/utils/holidays/types.ts - Line 91
calendarIds?: string[]; // 🆕 多日历分组支持（已统一使用数组）
```

**当前 V2 实现**:
```typescript
// EventEditModalV2.tsx - Line 285-286
const [sourceCalendarId, setSourceCalendarId] = useState(...);
const [syncCalendarId, setSyncCalendarId] = useState(...);
// ⚠️ 只是 UI 状态变量，未连接到 formData 和 Event 对象
```

**问题分析**:
1. V1 使用 `calendarIds[]` 多选模式
2. V2 PRD 使用 `sourceCalendarId` (单个) + `syncCalendarId` (单个)
3. types.ts 定义支持 `calendarIds[]` 多选
4. 当前 V2 实现的状态变量未保存到 Event 对象

**❓ 请确认**:
- [ ] **选项 A**: 保持 V1 的 `calendarIds[]` 多选模式（向后兼容）
- [ ] **选项 B**: 使用 PRD 的 `sourceCalendar` + `syncCalendars[]` 独立字段
- [ ] **选项 C**: 两者并存，通过数据迁移转换

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

### 冲突 2: 同步配置数据结构

**V2 PRD 定义**:
```typescript
// EVENTEDITMODAL_V2_PRD.md - Line 2680
type PlanSyncConfig = {
  mode: 'receive-only' | 'send-only' | 'send-only-private' | 'bidirectional' | 'bidirectional-private';
  targetCalendars: string[];
  tagMapping?: { [calendarId: string]: string[] };
};

type ActualSyncConfig = {
  mode: 'send-only' | 'send-only-private' | 'bidirectional' | 'bidirectional-private';  // 不支持 receive-only
  targetCalendars: string[];
  tagMapping?: { [calendarId: string]: string[] };
} | null;  // null 表示继承 planSyncConfig

event.planSyncConfig = { ... };
event.actualSyncConfig = { ... };
```

**V1 实现**:
```typescript
// EventEditModal.tsx - 没有同步配置结构
// 只有简单的 event.syncStatus: 'pending' | 'synced' | 'error'
```

**Event 类型定义** (types.ts):
```typescript
// src/utils/holidays/types.ts - Line 93
syncStatus?: SyncStatusType; // 'pending' | 'synced' | 'error'
// ⚠️ 没有 planSyncConfig 和 actualSyncConfig 字段
```

**当前 V2 实现**:
```typescript
// EventEditModalV2.tsx - Line 312-313
const [sourceSyncMode, setSourceSyncMode] = useState('receive-only');
const [syncSyncMode, setSyncSyncMode] = useState('bidirectional');
// ⚠️ 只是 UI 状态变量，未保存到 Event 对象
```

**问题分析**:
1. PRD 定义了复杂的同步配置结构（Plan vs Actual，tagMapping）
2. 当前 types.ts 中 Event 接口没有这些字段
3. V1 只有简单的 `syncStatus` 状态字段
4. 需要扩展 Event 类型定义

**❓ 请确认**:
- [ ] **选项 A**: 立即完整实现 `planSyncConfig` + `actualSyncConfig` (按 PRD)
- [ ] **选项 B**: 先实现简化版 `syncMode: string` 字段，后续扩展
- [ ] **选项 C**: 保持 V1 的 `syncStatus` 字段，不实现同步模式选择

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

### 冲突 3: 日历来源显示逻辑复杂度

**V2 PRD 定义** (非常详细的优先级规则):
```typescript
// EVENTEDITMODAL_V2_PRD.md - Line 2726
/**
 * 日历来源显示优先级：
 * 1. Timer 子事件继承父事件来源 (event.isTimer && event.parentEventId)
 * 2. 外部日历事件 (event.source === 'outlook'|'google'|'icloud')
 * 3. 独立 Timer 事件 (event.isTimer && !event.parentEventId) → ⏱️ ReMarkable计时
 * 4. Plan 事件 (event.isPlan) → ✅ ReMarkable计划
 * 5. TimeCalendar 事件 (event.isTimeCalendar) → 🚀 ReMarkable
 * 6. 其他本地事件 (event.source === 'local') → 🚀 ReMarkable
 */
```

**当前 V2 实现**:
```typescript
// EventEditModalV2.tsx - Line 567-582
const getCalendarInfo = (calendarId: string) => {
  const calendar = availableCalendars.find(c => c.id === calendarId);
  if (!calendar) return { name: 'Unknown', subName: '', color: '#999999' };
  // ... 只是简单的名称解析
};
// ⚠️ 没有实现 PRD 的来源判断逻辑
```

**V1 实现**:
```typescript
// EventEditModal.tsx - 没有来源显示功能
```

**问题分析**:
1. PRD 定义了 6 层优先级的复杂判断逻辑
2. 依赖 `event.source`, `event.isTimer`, `event.isPlan`, `event.parentEventId` 等字段
3. 当前实现只显示日历名称，未读取这些字段
4. Timer 子事件继承父事件来源的逻辑较复杂

**❓ 请确认**:
- [ ] **选项 A**: 完整实现 PRD 的 6 层优先级逻辑
- [ ] **选项 B**: 简化为只显示 `event.calendarId` 对应的日历名称
- [ ] **选项 C**: 分阶段实现：先实现外部日历显示，后续再加 Timer 继承逻辑

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

### 冲突 4: Private 模式实现范围

**V2 PRD 定义**:
```typescript
// EVENTEDITMODAL_V2_PRD.md - Line 2695
/**
 * 📌 Private 模式说明：
 * - send-only-private: 只发送（仅自己），不邀请 participants，将 participants 作为文本添加到 description
 * - bidirectional-private: 双向同步（仅自己），不邀请 participants，将 participants 作为文本添加到 description
 * 
 * 🔑 核心机制：
 * 普通模式: { attendees: ['alice@company.com'], description: '...' }
 * Private模式: { attendees: [], description: '📧 参与者：alice@company.com\n\n...' }
 */

// 提供了 formatParticipantsToDescription 等函数
```

**当前 V2 实现**:
```typescript
// EventEditModalV2.tsx - Line 289-295
const syncModes = [
  { id: 'receive-only', name: '只接收同步', emoji: '📥' },
  { id: 'send-only', name: '只发送同步', emoji: '📤' },
  { id: 'send-only-private', name: '只发送（仅自己）', emoji: '📤🔒' },
  { id: 'bidirectional', name: '双向同步', emoji: '🔄' },
  { id: 'bidirectional-private', name: '双向同步（仅自己）', emoji: '🔄🔒' },
];
// ✅ UI 已有 Private 模式选项
// ⚠️ 但保存逻辑和参与者处理逻辑未实现
```

**问题分析**:
1. UI 已经有 `send-only-private` 和 `bidirectional-private` 选项
2. PRD 详细定义了参与者处理逻辑（不邀请，添加到 description）
3. 需要实现 `formatParticipantsToDescription` 函数
4. 需要在保存时判断模式并处理参与者

**❓ 请确认**:
- [ ] **选项 A**: 本次完整实现 Private 模式（UI + 数据处理 + 参与者逻辑）
- [ ] **选项 B**: 先预留 UI，保存时暂不处理，后续再实现数据逻辑
- [ ] **选项 C**: 暂时移除 Private 模式选项，等后端同步逻辑完善后再加

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

### 冲突 5: 实际进展多日历同步

**V2 PRD 定义**:
```typescript
// EVENTEDITMODAL_V2_PRD.md - Line 3048
/**
 * 实际进展同步机制：
 * - 多日历同步：实际进展可同步到多个外部日历
 * - 标签自动映射：根据日历类型自动应用对应标签
 * - 双向同步：支持与外部日历的双向数据同步
 * - 继承计划设置：默认继承计划安排的同步配置
 */

type ActualSyncConfig = {
  mode: 'send-only' | 'bidirectional';
  targetCalendars: string[];  // 目标日历ID列表（多选）
  tagMapping: { [calendarId: string]: string[] };
} | null;  // null表示继承planSyncConfig
```

**当前 V2 实现**:
```typescript
// EventEditModalV2.tsx - Line 286
const [syncCalendarId, setSyncCalendarId] = useState(...);
// ⚠️ 只支持单个日历，不支持多选
```

**问题分析**:
1. PRD 要求实际进展支持同步到**多个**外部日历
2. 当前 UI 只有单选日历选择器
3. 需要实现 `CalendarMultiSelector` 组件
4. 需要实现标签自动映射逻辑

**❓ 请确认**:
- [ ] **选项 A**: 完整实现多日历同步（多选 UI + tagMapping + 保存逻辑）
- [ ] **选项 B**: 先实现单日历同步，后续扩展为多日历
- [ ] **选项 C**: 实际进展和计划安排都只支持单日历同步（简化 PRD）

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

### 冲突 6: 数据迁移与向后兼容

**问题分析**:
1. V1 事件使用 `calendarIds[]` 字段
2. V2 可能引入新的字段结构（如 `sourceCalendar`, `syncCalendars`, `planSyncConfig`）
3. 需要考虑旧数据的迁移和兼容

**示例场景**:
```typescript
// V1 旧事件
const oldEvent = {
  id: 'event-123',
  calendarIds: ['outlook-work', 'google-personal'],
  syncStatus: 'synced'
};

// V2 新事件（如果采用新字段）
const newEvent = {
  id: 'event-456',
  sourceCalendar: 'outlook-work',
  syncCalendars: ['google-personal'],
  planSyncConfig: { mode: 'bidirectional', targetCalendars: ['google-personal'] }
};
```

**❓ 请确认**:
- [ ] **选项 A**: 完全向后兼容，保持 `calendarIds[]` 字段，新字段作为扩展
- [ ] **选项 B**: 实现数据迁移脚本，启动时自动转换旧数据
- [ ] **选项 C**: 破坏性更新，不兼容旧数据（用户需重新设置）

**你的决定**: 
```
[请在此填写你的选择和理由]


```

---

## 💡 推荐实现方案（供参考）

基于复杂度和优先级，我建议采用**渐进式实现**策略：

### Phase 1: 基础日历选择（本次实现）

```typescript
// 1. 扩展 Event 类型（向后兼容）
interface Event {
  // V1 字段（保留）
  calendarIds?: string[];
  syncStatus?: 'pending' | 'synced' | 'error';
  
  // V2 新增字段（可选）
  sourceCalendar?: string;      // 来源日历
  syncCalendars?: string[];     // 同步目标日历（单选或多选）
  syncMode?: 'receive-only' | 'send-only' | 'bidirectional';  // 简化的同步模式
}

// 2. EventEditModalV2 数据链路
formData = {
  ...formData,
  sourceCalendar: sourceCalendarId,
  syncCalendars: [syncCalendarId]
}

// 3. handleSave 保存逻辑
updatedEvent = {
  ...event,
  sourceCalendar: formData.sourceCalendar,
  syncCalendars: formData.syncCalendars,
  syncMode: sourceSyncMode,  // 只保存一个模式
  // 兼容 V1
  calendarIds: [...new Set([formData.sourceCalendar, ...formData.syncCalendars])].filter(Boolean)
}
```

**优点**:
- ✅ 保持向后兼容
- ✅ 数据链路完整
- ✅ 实现简单，风险低

**缺点**:
- ❌ 未完整实现 PRD 的 planSyncConfig/actualSyncConfig
- ❌ 未实现 Private 模式数据处理

### Phase 2: 完整同步配置（后续扩展）

```typescript
interface Event {
  // Phase 1 字段（保留）
  
  // Phase 2 扩展字段
  planSyncConfig?: {
    mode: '...',
    targetCalendars: string[],
    tagMapping?: { ... }
  };
  actualSyncConfig?: { ... } | null;
}
```

---

## 📝 填写指南

请在每个冲突项的 **"你的决定"** 部分填写：
1. 选择哪个选项（A/B/C）
2. 你的理由或特殊要求
3. 任何需要我注意的细节

填写完成后，我将按照你的决定进行实现。

---

**填写完成请通知我，我会立即开始实现！** 🚀
