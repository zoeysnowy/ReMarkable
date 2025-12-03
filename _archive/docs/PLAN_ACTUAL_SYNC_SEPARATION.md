# Plan vs Actual 同步分离实施方案

> **目标**: 明确区分父事件（Plan）和子事件（Actual）的同步配置  
> **基于**: EventEditModal v2 PRD v2.0.3  
> **日期**: 2025-11-26

---

## 📌 核心原则（严格遵照 PRD）

### 1. **子事件的定义**
```typescript
// 三种子事件类型
const isSubEvent = event.isTimer || event.isTimeLog || event.isOutsideApp;
```

### 2. **子事件的标题和标签规则**（PRD § 1.2）
```typescript
// ✅ 子事件显示父事件的标题
function getDisplayTitle(event: Event): string {
  const isSubEvent = event.isTimer || event.isTimeLog || event.isOutsideApp;
  
  if (isSubEvent && event.parentEventId) {
    const parentEvent = EventService.getEventById(event.parentEventId);
    return parentEvent?.title || event.title;
  }
  return event.title;
}

// ✅ 修改标题时保存到父事件
const handleTitleChange = async (newTitle: string) => {
  const isSubEvent = event.isTimer || event.isTimeLog || event.isOutsideApp;
  
  if (isSubEvent && event.parentEventId) {
    const parentEvent = EventService.getEventById(event.parentEventId);
    if (!parentEvent) return;
    
    // 直接更新父事件的标题
    await EventService.update(parentEvent.id, { title: newTitle });
    setFormData({ ...formData, title: newTitle });
    return;
  }
  
  // 非子事件，正常保存
  setFormData({ ...formData, title: newTitle });
};
```

### 3. **Plan vs Actual 的同步语义**

| 配置 | 含义 | 作用对象 | UI 区域 |
|-----|------|---------|--------|
| `planSyncConfig` | **计划安排**的同步配置 | 父事件本身（标题、时间、参会人等元数据） | 计划安排区域 |
| `actualSyncConfig` | **实际进展**的同步配置 | 所有子事件（Timer/TimeLog/OutsideApp） | 实际进展区域 |

---

## 🔧 实施步骤

### **步骤 1: 废弃混淆的 `calendarIds` 字段**

**问题**:
```typescript
// ❌ 当前：calendarIds 语义不清（是 Plan 还是 Actual？）
{
  id: 'event-parent',
  calendarIds: ['outlook-work'],  // ？？？
  planSyncConfig: { targetCalendars: ['outlook-work'] },
  actualSyncConfig: { targetCalendars: ['google-personal'] }
}
```

**解决**:
```typescript
// ✅ 修正后：完全基于 planSyncConfig 和 actualSyncConfig
{
  id: 'event-parent',
  planSyncConfig: {
    mode: 'send-only',
    targetCalendars: ['outlook-work']  // Plan 同步到这里
  },
  actualSyncConfig: {
    mode: 'bidirectional',
    targetCalendars: ['google-personal']  // Actual 同步到这里
  },
  // calendarIds 字段废弃（向后兼容保留，但不再使用）
}
```

### **步骤 2: 修正 EventEditModalV2 保存逻辑**

**当前代码** (EventEditModalV2.tsx L1707-1718):
```typescript
// ❌ 错误：同时更新 calendarIds 和 planSyncConfig
onMultiSelectionChange={(calendarIds) => {
  setFormData(prev => ({
    ...prev,
    calendarIds: calendarIds,  // ❌ 应该移除
    planSyncConfig: {
      ...prev.planSyncConfig,
      mode: prev.planSyncConfig?.mode || 'send-only',
      targetCalendars: calendarIds  // ✅ 正确
    }
  }));
}}
```

**修正方案**:
```typescript
// ✅ 正确：只更新 planSyncConfig
onMultiSelectionChange={(calendarIds) => {
  setFormData(prev => ({
    ...prev,
    planSyncConfig: {
      ...prev.planSyncConfig,
      mode: prev.planSyncConfig?.mode || 'send-only',
      targetCalendars: calendarIds
    }
    // 移除 calendarIds 的更新
  }));
}}
```

### **步骤 3: 修正 handleSave 逻辑**

**当前代码** (EventEditModalV2.tsx L556-557):
```typescript
// ❌ 错误：传递 calendarIds
const updatedEvent: Event = {
  ...event,
  calendarIds: formData.calendarIds,  // ❌ 应该移除
  planSyncConfig: formData.planSyncConfig,
  actualSyncConfig: formData.actualSyncConfig,
};
```

**修正方案**:
```typescript
// ✅ 正确：只传递同步配置
const updatedEvent: Event = {
  ...event,
  planSyncConfig: formData.planSyncConfig,
  actualSyncConfig: formData.actualSyncConfig,
  // 移除 calendarIds
};
```

### **步骤 4: 修正 ActionBasedSyncManager 同步逻辑**

**当前代码** (ActionBasedSyncManager.ts L2107-2127):
```typescript
// ❌ 错误：使用 event.calendarIds
if (action.data.calendarIds?.length > 0) {
  syncTargetCalendarId = action.data.calendarIds[0];
}
```

**修正方案**:
```typescript
// ✅ 正确：根据 action.type 区分 Plan vs Actual
function getSyncTargetCalendar(event: Event, action: SyncAction): string | null {
  // 判断是 Plan 还是 Actual 同步
  const isPlanSync = action.type === 'CREATE' || action.type === 'UPDATE' || action.type === 'DELETE';
  const isActualSync = action.type === 'CREATE_TIMER' || action.type === 'UPDATE_TIMER';
  
  if (isPlanSync) {
    // 🔵 Plan 同步：使用 planSyncConfig
    const targetCalendars = event.planSyncConfig?.targetCalendars || [];
    if (targetCalendars.length > 0) {
      return targetCalendars[0];
    }
  } else if (isActualSync) {
    // 🟢 Actual 同步：使用 actualSyncConfig（或继承 planSyncConfig）
    const actualConfig = event.actualSyncConfig || event.planSyncConfig;
    const targetCalendars = actualConfig?.targetCalendars || [];
    if (targetCalendars.length > 0) {
      return targetCalendars[0];
    }
  }
  
  // 兜底：标签映射或默认日历
  if (event.tags?.length > 0) {
    return this.getCalendarIdForTag(event.tags[0]);
  }
  
  return this.microsoftService.getSelectedCalendarId();
}
```

### **步骤 5: 更新 Event 类型定义**

**types.ts**:
```typescript
export interface Event {
  id: string;
  title: EventTitle | string;
  
  // ... 其他字段
  
  // 🔵 计划安排同步配置（父事件）
  planSyncConfig: PlanSyncConfig;
  syncedPlanEventId?: string;  // Plan 创建的远程事件 ID
  
  // 🟢 实际进展同步配置（子事件）
  actualSyncConfig?: ActualSyncConfig | null;
  
  // 子事件相关
  isTimer?: boolean;
  isTimeLog?: boolean;
  isOutsideApp?: boolean;
  parentEventId?: string | null;
  timerChildEvents?: string[];
  
  // ❌ 废弃字段（向后兼容）
  /** @deprecated 使用 planSyncConfig.targetCalendars 代替 */
  calendarIds?: string[];
}
```

---

## 📊 数据流示例

### 场景 1: 用户选择计划同步日历

```typescript
// 用户在 "同步" 选择器中选择 Outlook
// ↓
formData.planSyncConfig.targetCalendars = ['outlook-work'];
// ↓
handleSave() 保存到 EventService
// ↓
ActionBasedSyncManager 检测到 Plan 更新
// ↓
读取 event.planSyncConfig.targetCalendars
// ↓
同步父事件到 Outlook
```

### 场景 2: 用户选择实际进展同步日历

```typescript
// 用户在 "同步到" 选择器中选择 Google
// ↓
formData.actualSyncConfig.targetCalendars = ['google-personal'];
// ↓
handleSave() 保存到 EventService
// ↓
ActionBasedSyncManager 检测到 Actual 更新
// ↓
读取 event.actualSyncConfig.targetCalendars
// ↓
同步所有 Timer 子事件到 Google（每个子事件创建独立远程事件）
```

---

## ✅ 验证清单

### 代码修改验证
- [ ] EventEditModalV2.tsx L1707: 移除 `calendarIds` 更新
- [ ] EventEditModalV2.tsx L1900: 实际进展日历选择器正确更新 `actualSyncConfig`
- [ ] EventEditModalV2.tsx L556: handleSave 不传递 `calendarIds`
- [ ] ActionBasedSyncManager.ts L2107: 根据 action.type 区分 Plan/Actual
- [ ] types.ts: 标记 `calendarIds` 为 `@deprecated`

### 功能验证
- [ ] 打开 EventEditModalV2
- [ ] 计划区域选择 Outlook 日历
- [ ] 实际进展区域选择 Google 日历
- [ ] 保存事件
- [ ] 查看日志：`planSyncConfig.targetCalendars: ['outlook-xxx']`
- [ ] 查看日志：`actualSyncConfig.targetCalendars: ['google-xxx']`
- [ ] 无 `calendarIds` 字段
- [ ] 刷新页面，选择保持

### 同步验证
- [ ] Plan 事件同步到 Outlook
- [ ] Timer 子事件同步到 Google
- [ ] 两个独立的远程事件被创建

---

## 🚧 注意事项

### 1. 向后兼容
保留 `calendarIds` 字段但标记为废弃，避免破坏现有数据：
```typescript
// 迁移逻辑（EventService.ts）
if (event.calendarIds && !event.planSyncConfig?.targetCalendars) {
  event.planSyncConfig = {
    mode: 'send-only',
    targetCalendars: event.calendarIds
  };
}
```

### 2. 子事件的标题/标签规则
**严格遵照 PRD § 1.2**：
- ✅ 子事件**显示**父事件的标题
- ✅ 修改标题**保存到**父事件
- ✅ 标签、参会人等元数据同理

### 3. 实际进展继承计划配置
如果 `actualSyncConfig` 为 `null`，继承 `planSyncConfig`：
```typescript
const effectiveActualConfig = event.actualSyncConfig || event.planSyncConfig;
```

---

## 📝 实施顺序

1. ✅ **先修正 EventEditModalV2**（最小改动，立即生效）
2. ✅ **再修正 ActionBasedSyncManager**（同步逻辑适配）
3. ✅ **最后更新类型定义**（文档和类型安全）

---

**准备好开始实施了吗？**
