# 日历同步配置 - 场景矩阵分析

> **文档版本**: v1.0  
> **创建时间**: 2025-11-19  
> **目的**: 分析 Plan 和 Actual 日历选择与同步模式的所有组合场景

---

## 📋 场景矩阵

### 维度说明

- **日历选择**: Plan 和 Actual 选择的日历是否相同
  - **相同**: `plannedCalendarIds = actualCalendarIds`（如都选择 "Outlook: 工作"）
  - **不同**: `plannedCalendarIds ≠ actualCalendarIds`（如 Plan 选择 "Outlook: 工作"，Actual 选择 "Outlook: 个人"）
  - **部分重叠**: `intersection(plannedCalendarIds, actualCalendarIds) ≠ ∅`（如 Plan 选择 ["工作", "团队"]，Actual 选择 ["工作", "个人"]）

- **同步模式**:
  - **📥 只接收同步 (receive-only)**: 从外部日历接收事件，不回写
  - **📤 只发送同步 (send-only)**: 回写到外部日历，不接收更新
  - **🔄 双向同步 (bidirectional)**: 双向同步

---

## 🎯 场景矩阵: 相同日历的 9 种严格规划

> **核心原则**: 当 Plan 和 Actual 选择相同日历时，必须严格规划同步行为，避免数据冲突和重复事件。

---

## 📋 场景 A: Plan 【只接收】时，Actual 的 3 种情况

### A1. Plan 只接收 + Actual 只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**同步行为**:
- 📥 **只接收，不发送**: 不创建远程事件
- 📥 **Outlook → Plan**: 如果 Outlook "工作" 日历已有事件，接收同步到 Plan 的 startTime/endTime
- ❌ **Actual 禁用**: 同一日历只能有一个接收源，Plan 优先

**数据流向**:
```
Outlook "工作" 日历（已有事件）
    ↓ 📥 接收
Plan (startTime/endTime)
    ↓ ❌ Actual 不参与同步
```

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'receive-only',
  remoteEventCount: 0,  // 不创建远程事件
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work',
      syncFields: ['startTime', 'endTime', 'title', 'description']
    },
    actual: {
      shouldSync: false,
      reason: 'same-calendar-conflict',
      note: 'Plan 已占据该日历的接收通道'
    }
  }
}
```

**远程事件数量**: **0 个**

---

### A2. Plan 只接收 + Actual 只发送

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'send-only' }
}
```

**同步行为**:
- 📥 **Plan 接收**: Outlook → Plan (startTime/endTime)
- 📤 **Actual 发送**: 在 Outlook 创建事件，同步 Actual 的合并时间段
- ⚠️ **冲突可能性**: Plan 和 Actual 共享同一个远程日历，可能产生时间冲突

**数据流向**:
```
本地 Actual (segments: 9:00-10:00, 14:00-15:00)
    ↓ 📤 发送（合并为 9:00-15:00）
Outlook "工作" 日历（新建事件）
    ↓ 📥 接收
本地 Plan (startTime: 9:00, endTime: 15:00)
```

**关键问题**: 
- ❓ Actual 发送的事件会被 Plan 接收回来吗？
- ✅ **答案**: 会！需要**去重逻辑**（通过 ReMarkable ID 标识）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'mixed-bidirectional',  // ⚠️ 实际上形成了双向循环
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work',
      deduplication: {
        enabled: true,
        strategy: 'ignore-self-created',  // 忽略 Actual 创建的事件
        identifyBy: 'remarkableEventId'
      }
    },
    actual: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work',
      mergeSegments: true,
      metadata: {
        addRemarkableId: true  // ✅ 在远程事件添加 ReMarkable ID
      }
    }
  }
}
```

**远程事件数量**: **1 个**（Actual 创建）

**去重策略**: 
```typescript
// 在 Plan 接收时，检查远程事件是否由 Actual 创建
if (remoteEvent.extendedProperties?.remarkableEventId === localEvent.id) {
  console.log('跳过同步：此事件由本地 Actual 创建');
  return;
}
```

---

### A3. Plan 只接收 + Actual 双向同步

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**同步行为**:
- 📥 **Plan 接收**: Outlook → Plan (只读)
- 🔄 **Actual 双向**: Outlook ↔ Actual (读写)
- ⚠️ **严重冲突**: Plan 和 Actual 同时接收同一个远程事件

**数据流向**:
```
Outlook "工作" 日历
    ↓ 📥 接收到 Plan
    ↓ 🔄 双向同步到 Actual
本地 Plan (startTime/endTime) ← Outlook
本地 Actual (segments) ↔ Outlook
```

**关键问题**:
1. ❓ Actual 创建的事件会被 Plan 接收吗？ → **会！需要去重**
2. ❓ Outlook 修改时，Plan 和 Actual 都会更新吗？ → **会！产生冲突**
3. ❓ 如果 Plan 的时间范围是 9:00-17:00，Actual 的片段是 9:00-10:00 + 14:00-15:00，Outlook 应该显示哪个？

**冲突解决策略**:
- **方案 1**: Actual 优先（双向 > 只接收）
  - Plan 禁用同步
  - 只有 Actual 与 Outlook 双向同步
  
- **方案 2**: Plan 优先（先到先得）
  - Actual 只能同步到其他日历
  
- **方案 3（推荐）**: 强制用户修改配置
  - 检测到冲突时，UI 显示警告："Plan 和 Actual 不能同时接收同一个日历，请调整配置"

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'conflict',  // ⚠️ 严重冲突
  remoteEventCount: 1,  // Actual 创建
  syncStrategy: {
    plan: {
      shouldSync: false,  // ❌ 禁用 Plan 同步
      reason: 'conflict-with-actual-bidirectional',
      warning: 'Plan（只接收）和 Actual（双向）不能共享同一个日历'
    },
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      mergeSegments: true,
      priority: 'actual-wins'  // Actual 优先
    }
  },
  uiWarning: {
    show: true,
    message: '⚠️ 配置冲突：Plan 和 Actual 都选择了 "工作" 日历，且同步模式冲突。建议：\n1. Plan 选择其他日历\n2. 或将 Actual 改为 "只发送"'
  }
}
```

**远程事件数量**: **1 个**（Actual 创建）

**推荐方案**: **禁止此配置**，在 UI 层显示错误提示。

---

## 📋 场景 B: Plan 【只发送】时，Actual 的 3 种情况

### B1. Plan 只发送 + Actual 只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**同步行为**:
- 📤 **Plan 发送**: Plan (startTime/endTime) → Outlook（创建事件）
- 📥 **Actual 接收**: Outlook → Actual（接收 Plan 创建的事件）
- ✅ **形成闭环**: Plan 发送 → Outlook → Actual 接收

**数据流向**:
```
本地 Plan (startTime: 9:00, endTime: 17:00)
    ↓ 📤 发送
Outlook "工作" 日历（新建事件 9:00-17:00）
    ↓ 📥 接收
本地 Actual (segments: [9:00-17:00])  ← 自动生成单片段
```

**关键问题**:
- ❓ Actual 接收到 Plan 创建的事件后，应该覆盖本地 segments 吗？
- ✅ **答案**: 需要**智能合并策略**

**智能合并策略**:
```typescript
// 场景 1: Actual 本地没有 segments → 直接接收
if (!event.actualProgress?.segments || event.actualProgress.segments.length === 0) {
  event.actualProgress.segments = [{ start: remoteEvent.start, end: remoteEvent.end }];
}

// 场景 2: Actual 本地已有 segments → 警告用户
else {
  showWarning('Actual 本地已有时间片段，是否覆盖？\n本地: 9:00-10:00, 14:00-15:00\n远程: 9:00-17:00');
}
```

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'plan-to-actual-via-remote',  // Plan → Outlook → Actual
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work',
      metadata: { addRemarkableId: true }
    },
    actual: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work',
      deduplication: {
        enabled: true,
        strategy: 'smart-merge',  // 智能合并本地 segments
        identifyBy: 'remarkableEventId'
      }
    }
  }
}
```

**远程事件数量**: **1 个**（Plan 创建）

---

### B2. Plan 只发送 + Actual 只发送

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'send-only' }
}
```

**同步行为**:
- 📤 **Plan 发送**: Plan → Outlook（创建事件 A）
- 📤 **Actual 发送**: Actual → Outlook（创建事件 B）
- ⚠️ **问题**: 同一个日历创建 2 个事件？还是覆盖？

**关键问题**:
1. ❓ 应该创建 2 个独立的远程事件吗？
   - 如果是 → Outlook 显示 2 个重叠的事件（混乱）
   - 如果否 → 谁覆盖谁？

2. ❓ Plan 的时间范围 vs Actual 的合并时间段，哪个优先？

**推荐方案**: **禁止此配置**

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'conflict',  // ⚠️ 冲突
  remoteEventCount: 1,  // Plan 优先
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work'
    },
    actual: {
      shouldSync: false,  // ❌ 禁用 Actual 发送
      reason: 'conflict-duplicate-send',
      warning: 'Plan 和 Actual 不能同时发送到同一个日历'
    }
  },
  uiWarning: {
    show: true,
    message: '⚠️ 配置冲突：Plan 和 Actual 都要发送到 "工作" 日历，会创建重复事件。建议：\n1. 只保留一个发送方\n2. 或选择不同的日历'
  }
}
```

**远程事件数量**: **1 个**（Plan 优先，Actual 禁用）

**推荐方案**: **禁止此配置**，在 UI 层显示错误提示。

---

### B3. Plan 只发送 + Actual 双向同步

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**同步行为**:
- 📤 **Plan 发送**: Plan → Outlook（创建事件）
- 🔄 **Actual 双向**: Actual ↔ Outlook（读写）
- ⚠️ **冲突**: Plan 发送的事件会被 Actual 接收并可能修改

**数据流向**:
```
本地 Plan (9:00-17:00)
    ↓ 📤 发送
Outlook "工作" 日历（事件 9:00-17:00）
    ↓ 🔄 双向同步
本地 Actual (segments) ↔ Outlook
    ↑ ❌ Actual 修改后不会回写到 Plan（Plan 是 send-only）
```

**关键问题**:
1. ❓ Actual 修改 segments 后，Outlook 的事件会更新吗？ → **会！**
2. ❓ Outlook 更新后，Plan 会收到通知吗？ → **不会！**（Plan 是 send-only）
3. ❓ 这样会导致 Plan 和 Actual 的数据不一致！

**推荐方案**: **Actual 优先**（双向 > 只发送）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'actual-bidirectional-wins',  // Actual 优先
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: false,  // ❌ 禁用 Plan 发送
      reason: 'overridden-by-actual-bidirectional',
      warning: 'Actual（双向）优先级高于 Plan（只发送）'
    },
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      mergeSegments: true,
      priority: 'actual-wins'
    }
  },
  uiWarning: {
    show: true,
    message: 'ℹ️ Plan 的同步已被禁用，因为 Actual 使用双向同步（优先级更高）'
  }
}
```

**远程事件数量**: **1 个**（Actual 创建并管理）

---

## 📋 场景 C: Plan 【双向同步】时，Actual 的 3 种情况

### C1. Plan 双向同步 + Actual 只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**同步行为**:
- 🔄 **Plan 双向**: Plan ↔ Outlook（读写）
- 📥 **Actual 接收**: Outlook → Actual（只读）
- ✅ **可行性**: Plan 主导，Actual 跟随

**数据流向**:
```
本地 Plan (9:00-17:00) ↔ Outlook "工作" 日历
    ↓ 📥 Actual 只接收
本地 Actual (segments: [9:00-17:00])
```

**关键问题**:
- ❓ Plan 和 Actual 都接收同一个远程事件，会冲突吗？
- ✅ **答案**: 不会！Plan 双向优先级高，Actual 跟随 Plan

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'plan-bidirectional-actual-follows',
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      priority: 'plan-wins'
    },
    actual: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work',
      source: 'follow-plan',  // ✅ 跟随 Plan
      deduplication: {
        enabled: true,
        strategy: 'sync-after-plan',  // Plan 同步完成后再同步 Actual
        identifyBy: 'remarkableEventId'
      }
    }
  }
}
```

**同步顺序**:
```typescript
1. Plan ↔ Outlook（双向同步）
2. Actual ← Outlook（接收 Plan 已同步的数据）
```

**远程事件数量**: **1 个**（Plan 创建并管理）

---

### C2. Plan 双向同步 + Actual 只发送

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'send-only' }
}
```

**同步行为**:
- 🔄 **Plan 双向**: Plan ↔ Outlook
- 📤 **Actual 发送**: Actual → Outlook
- ⚠️ **冲突**: Plan 和 Actual 都要写入同一个远程事件

**关键问题**:
1. ❓ Plan 的时间范围 vs Actual 的合并时间段，谁覆盖谁？
2. ❓ Actual 发送后，Plan 会接收回来吗？ → **会！**（Plan 是双向）
3. ❓ 这样会形成无限循环吗？

**推荐方案**: **Plan 优先**（双向 > 只发送）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'plan-bidirectional-wins',
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      priority: 'plan-wins'
    },
    actual: {
      shouldSync: false,  // ❌ 禁用 Actual 发送
      reason: 'overridden-by-plan-bidirectional',
      warning: 'Plan（双向）优先级高于 Actual（只发送）'
    }
  },
  uiWarning: {
    show: true,
    message: 'ℹ️ Actual 的同步已被禁用，因为 Plan 使用双向同步（优先级更高）'
  }
}
```

**远程事件数量**: **1 个**（Plan 创建并管理）

---

### C3. Plan 双向同步 + Actual 双向同步

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**同步行为**:
- 🔄 **Plan 双向**: Plan ↔ Outlook
- 🔄 **Actual 双向**: Actual ↔ Outlook
- ⚠️ **严重冲突**: 两者都要读写同一个远程事件

**关键问题**:
1. ❓ Plan 修改时间 → Outlook → Actual 接收 → Actual 修改 → Outlook → Plan 接收 → 无限循环？
2. ❓ Plan 的时间范围 vs Actual 的时间片段，谁覆盖谁？

**推荐方案**: **Plan 优先**

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'plan-bidirectional-wins',
  remoteEventCount: 1,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      priority: 'plan-wins',
      fields: ['startTime', 'endTime', 'title', 'description']
    },
    actual: {
      shouldSync: false,  // ❌ 禁用 Actual 双向同步
      reason: 'same-calendar-conflict',
      warning: 'Plan 和 Actual 不能同时双向同步到同一个日历'
    }
  },
  uiWarning: {
    show: true,
    message: '⚠️ 配置冲突：Plan 和 Actual 都要双向同步到 "工作" 日历。建议：\n1. 保留 Plan 双向，Actual 改为只接收\n2. 或选择不同的日历'
  }
}
```

**远程事件数量**: **1 个**（Plan 创建并管理）

**推荐方案**: **禁止此配置**，在 UI 层显示错误提示。

---

---

## 📊 相同日历场景总结表

| 场景 | Plan 模式 | Actual 模式 | 远程事件 | Plan 同步 | Actual 同步 | 关键逻辑 | UI 警告 |
|------|-----------|-------------|----------|-----------|-------------|----------|---------|
| **A1** | 只接收 | 只接收 | 0 个 | ✅ 接收 | ❌ 禁用 | Plan 优先接收 | - |
| **A2** | 只接收 | 只发送 | 1 个 | ✅ 接收（去重） | ✅ 发送 | 形成循环，需去重 | ⚠️ 提示去重逻辑 |
| **A3** | 只接收 | 双向 | 1 个 | ❌ 禁用 | ✅ 双向 | Actual 优先 | ⚠️ 配置冲突 |
| **B1** | 只发送 | 只接收 | 1 个 | ✅ 发送 | ✅ 接收（智能合并） | Plan → Outlook → Actual | - |
| **B2** | 只发送 | 只发送 | 1 个 | ✅ 发送 | ❌ 禁用 | Plan 优先发送 | ⚠️ 禁止重复发送 |
| **B3** | 只发送 | 双向 | 1 个 | ❌ 禁用 | ✅ 双向 | Actual 优先 | ℹ️ Actual 优先级高 |
| **C1** | 双向 | 只接收 | 1 个 | ✅ 双向 | ✅ 接收（跟随 Plan） | Plan 主导，Actual 跟随 | - |
| **C2** | 双向 | 只发送 | 1 个 | ✅ 双向 | ❌ 禁用 | Plan 优先 | ℹ️ Plan 优先级高 |
| **C3** | 双向 | 双向 | 1 个 | ✅ 双向 | ❌ 禁用 | Plan 优先 | ⚠️ 禁止双双向 |

**优先级规则**:
1. **双向 > 只发送 > 只接收**
2. **Plan 优先** 当优先级相同时
3. **相同日历只创建 1 个远程事件**

---

## 🎯 场景 D: Plan 和 Actual 选择【不同日历】

> **核心特性**: Actual 支持**多日历同步**（如同时同步到 "工作" + "个人" + "团队"）

### D1. 不同日历 + 都是双向同步

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal', 'outlook-calendar-team'],  // ✅ Actual 支持多日历
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**行为**:
- ✅ 在 Outlook "工作" 日历创建 **1 个事件**（Plan 时间范围）
- ✅ 在 Outlook "个人" 日历创建 **1 个事件**（Actual 合并时间段）
- ✅ 在 Outlook "团队" 日历创建 **1 个事件**（Actual 合并时间段，相同内容）

**数据流向**:
```
本地 Plan (9:00-17:00) ↔ Outlook "工作" 日历
本地 Actual (segments: 9:00-10:00, 14:00-15:00)
    ↓ 合并为 9:00-15:00
    ↓ 复制到多个日历
    ↔ Outlook "个人" 日历（事件 A）
    ↔ Outlook "团队" 日历（事件 B，内容相同）
```

**关键问题**:
- ❓ Actual 在 "个人" 日历修改后，"团队" 日历要同步修改吗？
- ✅ **答案**: 是！需要**多日历同步协调器**

**多日历同步策略**:
```typescript
// 当 Actual 在任一日历修改时
function onActualCalendarUpdate(calendarId: string, updatedEvent: Event) {
  // 1. 更新本地 Actual segments
  updateLocalActualSegments(updatedEvent);
  
  // 2. 同步到其他所有 Actual 日历
  const otherCalendars = actualCalendarIds.filter(id => id !== calendarId);
  for (const otherId of otherCalendars) {
    syncToCalendar(otherId, updatedEvent);  // 保持内容一致
  }
}
```

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'bidirectional',
  remoteEventCount: 3,  // Plan 1 个 + Actual 2 个
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendars: ['outlook-calendar-work']
    },
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendars: ['outlook-calendar-personal', 'outlook-calendar-team'],  // 多日历
      mergeSegments: true,
      multiCalendarSync: {
        enabled: true,
        strategy: 'keep-consistent',  // 保持所有日历内容一致
        conflictResolution: 'last-write-wins'  // 最后修改的日历优先
      }
    }
  }
}
```

**远程事件数量**: **3 个**（Plan 1 个 + Actual 2 个）

---

### D2. 不同日历 + Actual 多日历 + 混合模式

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal', 'google-calendar-fitness'],  // ✅ 跨平台多日历
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'send-only' }  // Actual 只发送
}
```

**行为**:
- ✅ Outlook "工作" 日历创建 1 个事件（Plan 双向）
- ✅ Outlook "个人" 日历创建 1 个事件（Actual 只发送）
- ✅ Google "健身" 日历创建 1 个事件（Actual 只发送，跨平台）

**跨平台同步注意事项**:
```typescript
// Outlook 和 Google 的事件格式不同
const outlookEvent = {
  subject: event.title,  // Outlook 使用 subject
  start: { dateTime: '2025-11-19T09:00:00', timeZone: 'UTC' },
  end: { dateTime: '2025-11-19T15:00:00', timeZone: 'UTC' }
};

const googleEvent = {
  summary: event.title,  // Google 使用 summary
  start: { dateTime: '2025-11-19T09:00:00+00:00' },
  end: { dateTime: '2025-11-19T15:00:00+00:00' }
};
```

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'mixed',
  remoteEventCount: 3,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendars: ['outlook-calendar-work'],
      platform: 'outlook'
    },
    actual: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendars: ['outlook-calendar-personal', 'google-calendar-fitness'],
      mergeSegments: true,
      multiCalendarSync: {
        enabled: true,
        platforms: ['outlook', 'google'],  // ✅ 跨平台
        formatAdapters: {
          outlook: 'OutlookEventAdapter',
          google: 'GoogleEventAdapter'
        }
      }
    }
  }
}
```

**远程事件数量**: **3 个**（跨平台）

---

### D3. 不同日历 + Actual 多日历 + 部分重叠

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work', 'outlook-calendar-personal', 'outlook-calendar-team'],  // ⚠️ "工作" 重叠
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**行为**:
- ✅ Outlook "工作" 日历创建 **1 个事件**（Plan 管理，Actual 自动去重）
- ✅ Outlook "个人" 日历创建 **1 个事件**（Actual）
- ✅ Outlook "团队" 日历创建 **1 个事件**（Actual）

**去重逻辑**:
```typescript
// Actual 自动去掉与 Plan 重叠的日历
const actualUniqueCalendars = actualCalendarIds.filter(
  id => !plannedCalendarIds.includes(id)
);
// actualUniqueCalendars = ['outlook-calendar-personal', 'outlook-calendar-team']
```

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'bidirectional',
  remoteEventCount: 3,
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendars: ['outlook-calendar-work']
    },
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendars: ['outlook-calendar-personal', 'outlook-calendar-team'],  // ✅ 自动去重 "工作"
      mergeSegments: true,
      deduplication: {
        enabled: true,
        removedCalendars: ['outlook-calendar-work'],  // 已被 Plan 占据
        reason: 'overlap-with-plan'
      }
    }
  }
}
```

**远程事件数量**: **3 个**（去重后）

---

### 2.2 不同日历 + Plan 双向 + Actual 只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal'],
  planSyncConfig: { mode: 'bidirectional' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**行为**:
- ✅ 在 Outlook "工作" 日历创建 **1 个事件**（Plan 时间范围）
- ❌ Outlook "个人" 日历**不创建事件**（Actual 是 receive-only）
- ✅ 如果 "个人" 日历已有该事件，可以接收同步到 Actual

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'mixed',  // Plan 双向 + Actual 只接收
  targetCalendars: ['outlook-calendar-work'],  // 只有 Plan 创建远程事件
  syncStrategy: {
    plan: { 
      shouldSync: true, 
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work'
    },
    actual: { 
      shouldSync: true, 
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-personal'
    }
  }
}
```

**远程事件数量**: **1 个**

---

### 2.3 不同日历 + Plan 只接收 + Actual 双向

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'bidirectional' }
}
```

**行为**:
- ❌ Outlook "工作" 日历**不创建事件**（Plan 是 receive-only）
- ✅ 在 Outlook "个人" 日历创建 **1 个事件**（Actual 合并时间段）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'mixed',
  targetCalendars: ['outlook-calendar-personal'],  // 只有 Actual 创建远程事件
  syncStrategy: {
    plan: { 
      shouldSync: true, 
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work'
    },
    actual: { 
      shouldSync: true, 
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-personal',
      mergeSegments: true
    }
  }
}
```

**远程事件数量**: **1 个**

---

### 2.4 不同日历 + 都是只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**行为**:
- ❌ **不创建任何远程事件**
- ✅ 可以接收两个日历的事件同步到本地

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'receive-only',
  targetCalendars: [],  // 不创建远程事件
  syncStrategy: {
    plan: { shouldSync: true, direction: 'receive-only', targetCalendar: 'outlook-calendar-work' },
    actual: { shouldSync: true, direction: 'receive-only', targetCalendar: 'outlook-calendar-personal' }
  }
}
```

**远程事件数量**: **0 个**

---

### 2.5 不同日历 + 都是只发送

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'send-only' }
}
```

**行为**:
- ✅ 在 Outlook "工作" 日历创建 **1 个事件**（Plan 时间范围）
- ✅ 在 Outlook "个人" 日历创建 **1 个事件**（Actual 合并时间段）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'send-only',
  targetCalendars: ['outlook-calendar-work', 'outlook-calendar-personal'],
  syncStrategy: {
    plan: { shouldSync: true, direction: 'send-only', targetCalendar: 'outlook-calendar-work' },
    actual: { shouldSync: true, direction: 'send-only', targetCalendar: 'outlook-calendar-personal', mergeSegments: true }
  }
}
```

**远程事件数量**: **2 个**

---

### 2.6 不同日历 + Plan 只发送 + Actual 只接收

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-personal'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'receive-only' }
}
```

**行为**:
- ✅ 在 Outlook "工作" 日历创建 **1 个事件**（Plan 时间范围）
- ❌ Outlook "个人" 日历不创建事件（Actual 是 receive-only）

**SyncConfig 合并逻辑**:
```typescript
{
  mergedMode: 'mixed',
  targetCalendars: ['outlook-calendar-work'],
  syncStrategy: {
    plan: { shouldSync: true, direction: 'send-only', targetCalendar: 'outlook-calendar-work' },
    actual: { shouldSync: true, direction: 'receive-only', targetCalendar: 'outlook-calendar-personal' }
  }
}
```

**远程事件数量**: **1 个**

---

**远程事件数量**: **3 个**（去重后）

---

## 📊 不同日历场景总结

| 场景 | Plan 日历 | Actual 日历（支持多选） | Plan 模式 | Actual 模式 | 远程事件 | 关键逻辑 |
|------|-----------|-------------------------|-----------|-------------|----------|----------|
| **D1** | 工作 | 个人+团队（2 个） | 双向 | 双向 | 3 个 | Actual 多日历保持一致 |
| **D2** | 工作 | 个人+Google 健身 | 双向 | 只发送 | 3 个 | 跨平台多日历 |
| **D3** | 工作 | 工作+个人+团队（重叠） | 双向 | 双向 | 3 个 | Actual 自动去重 "工作" |
| **D4** | 工作 | 个人+团队 | 双向 | 只接收 | 1 个 | 只有 Plan 创建 |
| **D5** | 工作 | 个人+团队 | 只接收 | 双向 | 2 个 | 只有 Actual 创建 |
| **D6** | 工作 | 个人+团队 | 只接收 | 只接收 | 0 个 | 都不发送 |

**核心特性**:
1. ✅ **Actual 支持多日历同步** - 可同步到多个日历（同平台或跨平台）
2. ✅ **自动去重** - Actual 自动去掉与 Plan 重叠的日历
3. ✅ **多日历一致性** - Actual 的多个日历保持内容一致（last-write-wins）
4. ✅ **跨平台支持** - Outlook + Google + iCloud 混合同步

---

## 🔑 最终数据模型设计

基于以上 9 种相同日历场景 + 不同日历场景，数据模型设计如下：

```typescript
// ============================================================
// 1. 基础同步配置
// ============================================================
export interface SyncConfig {
  /** 同步模式 */
  mode: 'receive-only' | 'send-only' | 'bidirectional';
  
  /** 目标日历 ID 列表（支持多日历） */
  targetCalendars?: string[];
  
  /** 最后同步时间 */
  lastSyncTime?: string;
  
  /** 多日历同步策略（仅 Actual 使用） */
  multiCalendarSync?: {
    /** 是否启用多日历同步 */
    enabled: boolean;
    
    /** 冲突解决策略 */
    conflictResolution: 'last-write-wins' | 'first-write-wins' | 'manual';
    
    /** 跨平台格式适配器 */
    platformAdapters?: {
      [platform: string]: string;  // e.g., { outlook: 'OutlookEventAdapter', google: 'GoogleEventAdapter' }
    };
  };
}

// ============================================================
// 2. Event 接口扩展
// ============================================================
export interface Event {
  // ... 现有字段 ...
  
  /** Plan 关联的日历 ID 列表 */
  plannedCalendarIds?: string[];
  
  /** Actual 关联的日历 ID 列表（✅ 支持多日历） */
  actualCalendarIds?: string[];
  
  /** Plan 的同步配置 */
  planSyncConfig?: SyncConfig | null;
  
  /** Actual 的同步配置 */
  actualSyncConfig?: SyncConfig | null;
  
  /** 合并后的同步配置（运行时计算，不持久化） */
  _mergedSyncConfig?: MergedSyncConfig;
}

// ============================================================
// 3. 合并同步配置（运行时）
// ============================================================
export interface MergedSyncConfig {
  /** 合并后的同步模式 */
  mergedMode: 'receive-only' | 'send-only' | 'bidirectional' | 'mixed' | 'conflict';
  
  /** 预计创建的远程事件数量 */
  remoteEventCount: number;
  
  /** 所有目标日历（去重后） */
  allTargetCalendars: string[];
  
  /** 同步策略 */
  syncStrategy: {
    plan: {
      /** 是否启用 Plan 同步 */
      shouldSync: boolean;
      
      /** 同步方向 */
      direction?: 'receive-only' | 'send-only' | 'bidirectional';
      
      /** 目标日历列表 */
      targetCalendars?: string[];
      
      /** 同步字段 */
      syncFields?: string[];
      
      /** 去重配置 */
      deduplication?: {
        enabled: boolean;
        strategy: 'ignore-self-created' | 'smart-merge' | 'sync-after-actual';
        identifyBy: 'remarkableEventId' | 'externalId';
      };
      
      /** 不同步的原因 */
      reason?: string;
    };
    
    actual: {
      /** 是否启用 Actual 同步 */
      shouldSync: boolean;
      
      /** 同步方向 */
      direction?: 'receive-only' | 'send-only' | 'bidirectional';
      
      /** 目标日历列表（✅ 支持多日历） */
      targetCalendars?: string[];
      
      /** 是否合并时间片段 */
      mergeSegments?: boolean;
      
      /** 多日历同步配置 */
      multiCalendarSync?: {
        enabled: boolean;
        platforms: string[];
        conflictResolution: 'last-write-wins' | 'first-write-wins';
      };
      
      /** 去重配置 */
      deduplication?: {
        enabled: boolean;
        removedCalendars?: string[];  // 被去重的日历
        reason?: 'overlap-with-plan' | 'same-calendar-conflict';
      };
      
      /** 不同步的原因 */
      reason?: string;
      
      /** 警告信息 */
      warning?: string;
    };
  };
  
  /** UI 警告 */
  uiWarning?: {
    show: boolean;
    level: 'info' | 'warning' | 'error';
    message: string;
  };
}

// ============================================================
// 4. 工具函数
// ============================================================

/**
 * 计算合并后的同步配置
 */
export function getMergedSyncConfig(event: Event): MergedSyncConfig {
  const { plannedCalendarIds = [], actualCalendarIds = [], planSyncConfig, actualSyncConfig } = event;
  
  // 1. 检查日历重叠
  const overlappingCalendars = plannedCalendarIds.filter(id => actualCalendarIds.includes(id));
  const hasSameCalendar = overlappingCalendars.length > 0;
  
  // 2. 如果是相同日历，使用相同日历规则（9 种场景）
  if (hasSameCalendar) {
    return handleSameCalendarScenarios(event, overlappingCalendars);
  }
  
  // 3. 如果是不同日历，直接合并
  return handleDifferentCalendarScenarios(event);
}

/**
 * 处理相同日历的 9 种场景
 */
function handleSameCalendarScenarios(event: Event, overlappingCalendars: string[]): MergedSyncConfig {
  const planMode = event.planSyncConfig?.mode;
  const actualMode = event.actualSyncConfig?.mode;
  
  // 场景 A: Plan 只接收
  if (planMode === 'receive-only') {
    if (actualMode === 'receive-only') return scenarioA1(event);
    if (actualMode === 'send-only') return scenarioA2(event);
    if (actualMode === 'bidirectional') return scenarioA3(event);  // ⚠️ 冲突
  }
  
  // 场景 B: Plan 只发送
  if (planMode === 'send-only') {
    if (actualMode === 'receive-only') return scenarioB1(event);
    if (actualMode === 'send-only') return scenarioB2(event);  // ⚠️ 冲突
    if (actualMode === 'bidirectional') return scenarioB3(event);
  }
  
  // 场景 C: Plan 双向
  if (planMode === 'bidirectional') {
    if (actualMode === 'receive-only') return scenarioC1(event);
    if (actualMode === 'send-only') return scenarioC2(event);
    if (actualMode === 'bidirectional') return scenarioC3(event);  // ⚠️ 冲突
  }
  
  throw new Error('未知的同步模式组合');
}

/**
 * 处理不同日历场景
 */
function handleDifferentCalendarScenarios(event: Event): MergedSyncConfig {
  const { plannedCalendarIds = [], actualCalendarIds = [], planSyncConfig, actualSyncConfig } = event;
  
  // Actual 自动去重与 Plan 重叠的日历
  const actualUniqueCalendars = actualCalendarIds.filter(id => !plannedCalendarIds.includes(id));
  
  return {
    mergedMode: 'mixed',
    remoteEventCount: calculateRemoteEventCount(event),
    allTargetCalendars: [...plannedCalendarIds, ...actualUniqueCalendars],
    syncStrategy: {
      plan: {
        shouldSync: planSyncConfig?.mode !== undefined,
        direction: planSyncConfig?.mode,
        targetCalendars: plannedCalendarIds
      },
      actual: {
        shouldSync: actualSyncConfig?.mode !== undefined,
        direction: actualSyncConfig?.mode,
        targetCalendars: actualUniqueCalendars,  // ✅ 去重后
        mergeSegments: true,
        multiCalendarSync: {
          enabled: actualUniqueCalendars.length > 1,
          platforms: extractPlatforms(actualUniqueCalendars),
          conflictResolution: 'last-write-wins'
        }
      }
    }
  };
}

/**
 * 合并 Actual 的多个时间片段为单时间段
 */
export function mergeActualSegments(segments: TimeSegment[]): { startTime: string; endTime: string } {
  if (!segments || segments.length === 0) {
    return { startTime: '', endTime: '' };
  }
  
  const sorted = [...segments].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
  
  return {
    startTime: sorted[0].start,
    endTime: sorted[sorted.length - 1].end
  };
}
```

---

## 🎯 UI 层实现建议

### 1. 日历选择组件

```typescript
// CalendarSelector.tsx
interface CalendarSelectorProps {
  mode: 'plan' | 'actual';
  selectedCalendars: string[];
  onChange: (calendarIds: string[]) => void;
  multiSelect?: boolean;  // ✅ Actual 支持多选
}

function CalendarSelector({ mode, selectedCalendars, onChange, multiSelect = false }: CalendarSelectorProps) {
  return (
    <div>
      {multiSelect ? (
        <MultiCalendarPicker value={selectedCalendars} onChange={onChange} />
      ) : (
        <SingleCalendarPicker value={selectedCalendars[0]} onChange={id => onChange([id])} />
      )}
      
      {/* 显示去重提示 */}
      {mode === 'actual' && hasOverlapWithPlan(selectedCalendars) && (
        <Alert severity="info">
          ℹ️ "工作" 日历已被 Plan 使用，Actual 只会同步到其他日历
        </Alert>
      )}
    </div>
  );
}
```

### 2. 同步模式选择器

```typescript
// SyncModeSelector.tsx
interface SyncModeSelectorProps {
  mode: 'receive-only' | 'send-only' | 'bidirectional';
  onChange: (mode: SyncConfig['mode']) => void;
  disabled?: boolean;
}

function SyncModeSelector({ mode, onChange, disabled }: SyncModeSelectorProps) {
  return (
    <RadioGroup value={mode} onChange={e => onChange(e.target.value as SyncConfig['mode'])}>
      <Radio value="receive-only" disabled={disabled}>
        📥 只接收同步 - 从外部日历接收，不回写
      </Radio>
      <Radio value="send-only" disabled={disabled}>
        📤 只发送同步 - 回写到外部日历，不接收更新
      </Radio>
      <Radio value="bidirectional" disabled={disabled}>
        🔄 双向同步 - 双向同步
      </Radio>
    </RadioGroup>
  );
}
```

### 3. 冲突检测与警告

```typescript
// useConflictDetection.ts
function useConflictDetection(event: Event) {
  const mergedConfig = useMemo(() => getMergedSyncConfig(event), [event]);
  
  return {
    hasConflict: mergedConfig.mergedMode === 'conflict',
    warning: mergedConfig.uiWarning,
    remoteEventCount: mergedConfig.remoteEventCount
  };
}

// 在 EventEditModal 中使用
function EventEditModal({ event }: EventEditModalProps) {
  const { hasConflict, warning } = useConflictDetection(event);
  
  return (
    <div>
      {warning?.show && (
        <Alert severity={warning.level}>
          {warning.message}
        </Alert>
      )}
      
      {/* ... */}
    </div>
  );
}
```

---

## 📝 下一步行动

1. ✅ **数据模型已定义** - 基于 9 种相同日历场景 + 不同日历场景
2. ⏳ **实现工具函数** - `getMergedSyncConfig()`, `mergeActualSegments()` 等
3. ⏳ **UI 组件开发** - CalendarSelector, SyncModeSelector, 冲突警告
4. ⏳ **同步服务适配** - ActionBasedSyncManager 增加冲突检测和多日历支持
5. ⏳ **测试** - 覆盖所有 9 种场景 + 多日历场景

**需要确认的问题**:
1. ✅ 相同日历的 9 种场景是否符合预期？
2. ✅ Actual 支持多日历是否满足需求？
3. ❓ 是否需要在 UI 层禁止某些冲突配置（如 A3, B2, C3）？
