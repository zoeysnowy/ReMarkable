# 日历同步配置 - 场景矩阵分析

> **文档版本**: v1.0  
> **创建时间**: 2025-11-19  
> **目的**: 分析 Plan 和 Actual 日历选择与同步模式的所有组合场景

---

## 🎉 架构更新 (2025-11-19)

### 循环更新防护集成

基于刚完成的循环更新防护机制，日历同步现在具备更强的稳定性：

#### EventService 层面增强
```typescript
// 支持多事件同步时的循环防护
class EventService {
  static createTimerSubEvent(parentEvent: Event, timerData: TimerLog): Event {
    const subEventId = `${parentEvent.id}-timer-${Date.now()}`;
    const updateId = this.generateUpdateId();
    
    // 创建Timer子事件，继承父事件的同步配置
    const timerEvent = {
      id: subEventId,
      parentEventId: parentEvent.id,
      type: 'timer',
      title: `${parentEvent.title} - 实际进展`,
      startTime: timerData.startTime,
      endTime: timerData.endTime,
      eventlog: timerData.description,
      // 继承父事件的Actual同步配置
      actualCalendarIds: parentEvent.actualCalendarIds,
      actualSyncConfig: parentEvent.actualSyncConfig
    };
    
    // 记录更新来源，防止循环
    this.recordPendingUpdate(subEventId, updateId);
    
    return this.createEvent(timerEvent, false, {
      originComponent: 'EventService',
      updateId,
      source: 'timer-creation'
    });
  }
}
```

#### A2场景循环防护
场景A2（Plan只接收 + Actual只发送）现在具备完整的循环防护：

```typescript
// Plan接收外部事件时，自动忽略本地Timer创建的远程事件
function onPlanReceiveEvent(remoteEvent: OutlookEvent, localEvent: Event) {
  // ✅ 检查是否是本地Timer子事件创建的远程事件
  if (remoteEvent.extendedProperties?.remarkableType === 'timer-sub-event' &&
      remoteEvent.extendedProperties?.remarkableParentId === localEvent.id) {
    console.log('[🛡️ 日历同步] 跳过Timer子事件，防止循环');
    return;
  }
  
  // ✅ 接收外部创建的真实事件
  updateLocalPlan(remoteEvent);
}
```

### Event Tree 稳定性保障
- **Timer子事件创建**: 具备完整的来源追踪和循环防护
- **多事件同步**: 每个Timer→独立Outlook事件，无循环风险
- **跨Tab同步**: BroadcastChannel过滤机制确保多Tab稳定性
- **测试保护**: 日历同步测试事件不会被意外删除

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

### A2. Plan 只接收 + Actual 只发送 ⭐ 核心场景

> **典型用例**: 用户从 Outlook 接收外部日程（如会议邀请），不想修改原日程，但想记录自己的实际工作进展（计时、日志、会议纪要等）

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
- 📥 **Plan 接收**: Outlook → Plan (startTime/endTime) - **只读**，不修改外部日程
- 📤 **Actual 发送**: 每个 Timer 子事件 → Outlook 创建**独立的新事件**
- ✅ **Event Tree 结构**: ReMarkable 内部维护 ParentEventID 关联，但 Outlook 看到的是多个独立事件

---

#### 💡 场景示例：接收会议邀请并记录工作进展

**步骤 1: 接收外部会议**
```
Outlook "工作" 日历
  └─ 📅 "产品评审会" (9:00-10:00, 由项目经理创建)
      ↓ 📥 接收
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual: 空（尚未开始计时）
```

**步骤 2: 用户开始第一次计时**
```
用户操作: 点击 Timer 按钮 → 开始计时 9:05-9:45
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual: 
          └─ Timer 子事件 #1234-1 (9:05-9:45)
              ├─ 时间片段: 9:05-9:45
              ├─ TimerLog: "讨论了新功能需求"
              └─ 📤 发送到 Outlook

Outlook "工作" 日历（新增事件）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始事件)
  └─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45, 由 ReMarkable 创建)
      └─ 描述: "讨论了新功能需求"
```

**步骤 3: 用户第二次计时（同一天下午继续工作）**
```
用户操作: 再次点击 Timer → 14:00-15:30
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual: 
          ├─ Timer 子事件 #1234-1 (9:05-9:45)
          └─ Timer 子事件 #1234-2 (14:00-15:30) ← 新增
              ├─ 时间片段: 14:00-15:30
              ├─ TimerLog: "实现了需求文档"
              └─ 📤 发送到 Outlook

Outlook "工作" 日历（再次新增事件）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始事件)
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45)
  └─ 📅 "产品评审会 - 实际进展 2" (14:00-15:30, 新增) ← 新创建
      └─ 描述: "实现了需求文档"
```

**步骤 4: 用户查看 ReMarkable**
```
ReMarkable Event Tree 视图（用户不需要知道这个架构）
  └─ "产品评审会" (ParentEvent #1234)
      ├─ Plan: 9:00-10:00 (来自 Outlook)
      ├─ Actual 总时长: 2h 10min (9:05-9:45 + 14:00-15:30)
      ├─ Timer 子事件 1: 9:05-9:45 (40 min)
      │   └─ 日志: "讨论了新功能需求"
      └─ Timer 子事件 2: 14:00-15:30 (1h 30min)
          └─ 日志: "实现了需求文档"
```

**步骤 5: Outlook 用户视角**
```
Outlook "工作" 日历视图
  11月19日
    ├─ 9:00-10:00  📅 "产品评审会" (原始会议)
    ├─ 9:05-9:45   📅 "产品评审会 - 实际进展 1" (Zoey 做了什么)
    └─ 14:00-15:30 📅 "产品评审会 - 实际进展 2" (Zoey 继续工作)
```

---

#### 🔑 核心设计原则

**0. Event Tree 中的两种子事件 + 两层同步系统**

ReMarkable 的 Event Tree 支持两种类型的子事件，关键理解：**每个事件都有独立的同步系统**

| 类型 | 创建方式 | 同步配置 | EditModal | ParentEvent 的 Plan 是否忽略子事件创建的远程事件 |
|------|----------|----------|-----------|---------------------------------------------|
| **Timer 子事件** | 系统自动创建（停止 Timer） | ❌ 继承 ParentEvent 的 Actual 配置 | ❌ 无独立 EditModal | ✅ 忽略（子事件与父事件无关） |
| **用户手动子事件** | 用户手动添加（Event/Task） | ✅ 有独立的 planSyncConfig/actualSyncConfig | ✅ 有独立 EditModal | ✅ 忽略（子事件与父事件无关） |

**关键理解 - 两层同步系统**:

```typescript
// ParentEvent "产品评审会" - 第一层同步系统
{
  id: '1234',
  title: '产品评审会',
  plannedCalendarIds: ['outlook-work'],
  planSyncConfig: { mode: 'receive-only' },  // ← ParentEvent 的 Plan 同步
  actualSyncConfig: { mode: 'send-only' },
  
  childEvents: [
    // Timer 子事件（继承 ParentEvent 的 Actual 配置）
    { 
      id: '1234-timer-1',
      type: 'timer', 
      planSyncConfig: undefined,  // 继承 ParentEvent
      actualSyncConfig: undefined 
      // ⚠️ 当 Timer 子事件同步到 Outlook 创建远程事件时：
      // ParentEvent 的 Plan 接收会忽略这个远程事件（因为是自己的子事件创建的）
    },
    
    // 用户手动子事件 - 第二层独立同步系统
    { 
      id: '1234-manual-1',
      type: 'event', 
      title: '准备演示 Demo',
      plannedCalendarIds: ['outlook-work'],
      planSyncConfig: { mode: 'bidirectional' },  // ← 子事件的 Plan 同步（独立）
      actualSyncConfig: { mode: 'send-only' }
      // ⚠️ 当子事件同步到 Outlook 创建远程事件时：
      // 1. ParentEvent 的 Plan 接收会忽略这个远程事件（因为是子事件创建的）
      // 2. 子事件自己的 Plan 接收会正常处理（独立的同步系统）
    }
  ]
}
```

**两层逻辑**:

1️⃣ **ParentEvent (id: 1234) 的 Plan 接收**:
```typescript
function onParentEventPlanReceive(remoteEvent: OutlookEvent) {
  // ✅ 忽略所有子事件创建的远程事件（无论 Timer 还是手动）
  if (remoteEvent.extendedProperties?.remarkableParentId === '1234') {
    console.log('忽略：这是子事件创建的，与 ParentEvent 无关');
    return;
  }
  
  // 只接收外部创建的事件
  updateLocalPlan(remoteEvent);
}
```

2️⃣ **子事件 (id: 1234-manual-1) 自己的 Plan 接收**:
```typescript
function onChildEventPlanReceive(remoteEvent: OutlookEvent) {
  // ✅ 子事件有独立的 planSyncConfig，正常处理自己的同步
  if (remoteEvent.extendedProperties?.remarkableEventId === '1234-manual-1') {
    updateLocalPlan(remoteEvent);  // 正常同步
  }
}
```

---

**1. 每个 Timer 子事件 = 一个独立的 Outlook 事件**
```typescript
// 当用户创建新的 Timer 子事件时
function onTimerStop(parentEvent: Event, timerSubEvent: Event) {
  if (parentEvent.actualSyncConfig?.mode === 'send-only') {
    // 创建独立的远程事件
    const remoteEvent = {
      id: `${parentEvent.id}-timer-${timerSubEvent.id}`,  // ✅ 独立 ID
      title: `${parentEvent.title} - 实际进展 ${getTimerIndex(timerSubEvent)}`,
      start: timerSubEvent.startTime,
      end: timerSubEvent.endTime,
      description: timerSubEvent.eventlog || '',
      extendedProperties: {
        remarkableParentId: parentEvent.id,  // ✅ 关联 ParentEvent
        remarkableTimerId: timerSubEvent.id,
        remarkableType: 'timer-sub-event'
      }
    };
    
    // 发送到 Outlook
    syncToOutlook(parentEvent.actualCalendarIds[0], remoteEvent);
  }
}
```

**2. ParentEvent 的 Plan 接收时忽略所有子事件创建的远程事件**
```typescript
// 当 ParentEvent 的 Plan 接收 Outlook 事件时
function onParentEventPlanReceive(remoteEvent: OutlookEvent, parentEvent: Event) {
  // ✅ 检查是否是本地子事件（无论 Timer 还是手动）创建的远程事件
  if (remoteEvent.extendedProperties?.remarkableParentId === parentEvent.id) {
    console.log('跳过同步：这是子事件创建的远程事件，与 ParentEvent 无关');
    return;  // 不覆盖 ParentEvent 的 Plan
  }
  
  // ✅ 只接收外部创建的事件
  updateParentEventPlan(remoteEvent);  // 更新 ParentEvent 的 startTime/endTime
}

// 用户手动子事件有自己独立的 Plan 接收逻辑
function onChildEventPlanReceive(remoteEvent: OutlookEvent, childEvent: Event) {
  // ✅ 子事件自己的同步系统，正常处理
  if (childEvent.planSyncConfig?.mode === 'receive-only' || 
      childEvent.planSyncConfig?.mode === 'bidirectional') {
    updateChildEventPlan(remoteEvent);  // 子事件正常同步
  }
}
```

**重要说明**:
- ✅ **ParentEvent 的 Plan 接收**：忽略所有子事件（Timer + 手动）创建的远程事件
  - 原因：子事件与 ParentEvent 本身无关
  
- ✅ **子事件自己的 Plan 接收**：用户手动子事件有独立的 `planSyncConfig`
  - 这是两个独立的同步系统
  - 子事件正常处理自己的同步逻辑

---

#### 📊 两层同步系统的完整示例

**场景**: ParentEvent "产品评审会" + Timer 子事件 + 用户手动子事件 "准备演示 Demo"

**Outlook "工作" 日历的最终状态**:
```
Outlook "工作" 日历
  ├─ 📅 "产品评审会" (9:00-10:00, 外部创建)
  │   └─ 由 ParentEvent 的 Plan 接收
  │
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45, ReMarkable 创建)
  │   └─ 由 Timer 子事件的 Actual 发送
  │   └─ extendedProperties: { remarkableParentId: '1234' }
  │
  ├─ 📅 "产品评审会 - 实际进展 2" (14:00-15:30, ReMarkable 创建)
  │   └─ 由 Timer 子事件的 Actual 发送
  │
  └─ 📅 "准备演示 Demo" (16:00-17:00, ReMarkable 创建)
      └─ 由用户手动子事件自己的同步系统创建
      └─ extendedProperties: { remarkableEventId: '1234-manual-1', remarkableParentId: '1234' }
```

**同步逻辑分层**:

```typescript
// 🔄 当 Outlook "工作" 日历有更新时，ReMarkable 接收同步

// 第 1 层：ParentEvent #1234 的 Plan 接收
function syncParentEvent1234() {
  const remoteEvents = fetchOutlookEvents('outlook-work');
  
  for (const remoteEvent of remoteEvents) {
    // ✅ 忽略所有子事件创建的远程事件
    if (remoteEvent.extendedProperties?.remarkableParentId === '1234') {
      console.log(`跳过：这是子事件创建的，与 ParentEvent #1234 无关`);
      continue;  // ← "实际进展 1/2" 和 "准备演示 Demo" 被忽略
    }
    
    // ✅ 只接收外部创建的 "产品评审会"
    if (remoteEvent.title === '产品评审会' && !remoteEvent.extendedProperties?.remarkableParentId) {
      updateParentEventPlan('1234', {
        startTime: remoteEvent.start,
        endTime: remoteEvent.end
      });
    }
  }
}

// 第 2 层：用户手动子事件 #1234-manual-1 自己的 Plan 接收
function syncChildEvent1234Manual1() {
  const remoteEvents = fetchOutlookEvents('outlook-work');
  
  for (const remoteEvent of remoteEvents) {
    // ✅ 子事件只关心自己创建的远程事件
    if (remoteEvent.extendedProperties?.remarkableEventId === '1234-manual-1') {
      updateChildEventPlan('1234-manual-1', {
        startTime: remoteEvent.start,
        endTime: remoteEvent.end
      });
      console.log('子事件 "准备演示 Demo" 同步成功');
    }
  }
}
```

**关键点**:
1. ✅ ParentEvent 的 Plan 接收：**只接收外部创建的事件，忽略所有子事件创建的远程事件**
2. ✅ 子事件自己的 Plan 接收：**独立的同步系统，正常处理自己创建的远程事件**
3. ✅ Timer 子事件：**没有 Plan 配置，只通过 Actual 发送**

---

**3. Event Tree 内部关联（用户无感知）**
```typescript
// ReMarkable 内部数据结构
{
  id: '1234',  // ParentEvent
  title: '产品评审会',
  source: 'outlook',
  type: 'parent',  // ✅ ParentEvent 类型
  
  // Plan 部分（只读）
  startTime: '2025-11-19T09:00:00',
  endTime: '2025-11-19T10:00:00',
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  
  // Actual 部分（可写）
  actualCalendarIds: ['outlook-calendar-work'],
  actualSyncConfig: { mode: 'send-only' },
  
  // 子事件列表（Event Tree）
  childEvents: [
    // ============================================================
    // 类型 1: Timer 子事件（系统自动创建，无独立同步配置）
    // ============================================================
    {
      id: '1234-timer-1',
      parentEventId: '1234',  // ✅ 关联 ParentEvent
      type: 'timer',  // ✅ Timer 类型
      startTime: '2025-11-19T09:05:00',
      endTime: '2025-11-19T09:45:00',
      eventlog: '讨论了新功能需求',
      
      // ❌ Timer 子事件继承 ParentEvent 的 Actual 配置，没有独立配置
      plannedCalendarIds: undefined,
      actualCalendarIds: undefined,
      planSyncConfig: undefined,
      actualSyncConfig: undefined,
      
      // ✅ 同步状态
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-1'
    },
    
    {
      id: '1234-timer-2',
      parentEventId: '1234',
      type: 'timer',
      startTime: '2025-11-19T14:00:00',
      endTime: '2025-11-19T15:30:00',
      eventlog: '实现了需求文档',
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-2'
    },
    
    // ============================================================
    // 类型 2: 用户手动创建的子事件（有独立同步配置和 EditModal）
    // ============================================================
    {
      id: '1234-manual-1',
      parentEventId: '1234',  // ✅ 关联 ParentEvent（可选）
      type: 'event',  // ✅ 用户创建的事件类型
      title: '准备演示 Demo',
      startTime: '2025-11-19T16:00:00',
      endTime: '2025-11-19T17:00:00',
      
      // ✅ 有自己独立的同步配置
      plannedCalendarIds: ['outlook-calendar-work'],
      actualCalendarIds: ['outlook-calendar-personal'],  // 可以选择不同的日历
      planSyncConfig: { mode: 'bidirectional' },  // 独立的 Plan 配置
      actualSyncConfig: { mode: 'send-only' },  // 独立的 Actual 配置
      
      // ✅ 有自己独立的同步状态
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-3'
    },
    
    {
      id: '1234-manual-2',
      parentEventId: '1234',
      type: 'task',  // ✅ 用户创建的任务类型（时间缺省）
      title: '整理会议纪要',
      
      // ✅ 任务也有独立的同步配置
      plannedCalendarIds: ['outlook-calendar-work'],
      planSyncConfig: { mode: 'send-only' },
      
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-4'
    }
  ]
}
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-receive-actual-send-multi-events',  // ✅ 新模式
  remoteEventCount: 'dynamic',  // ❗ 动态数量（取决于 Timer 子事件数量）
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendar: 'outlook-calendar-work',
      
      // ✅ 去重逻辑：ParentEvent 忽略所有子事件创建的远程事件
      deduplication: {
        enabled: true,
        strategy: 'ignore-child-events',  // ParentEvent 忽略所有子事件
        filter: (remoteEvent, parentEvent) => {
          // ParentEvent 只忽略自己子事件创建的远程事件
          return remoteEvent.extendedProperties?.remarkableParentId === parentEvent.id;
        },
        note: '子事件有独立的同步系统，ParentEvent 不处理子事件创建的远程事件'
      }
    },
    
    actual: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work',
      
      // ✅ 多事件策略：每个 Timer 子事件创建独立的远程事件
      multiEventSync: {
        enabled: true,
        strategy: 'one-timer-one-event',  // 一个 Timer → 一个 Outlook 事件
        titleTemplate: '{{parentTitle}} - 实际进展 {{timerIndex}}',
        includeTimerLog: true,  // 包含 TimerLog 作为事件描述
        linkToParent: true  // 通过 extendedProperties 关联 ParentEvent
      }
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ 每次计时或写日志都会在 Outlook 创建新事件，方便外部查看你的工作进展'
  }
}
```

---

#### 🎯 用户价值

**对于 ReMarkable 用户**:
- ✅ 接收外部日程，不修改原始计划
- ✅ 自由记录实际工作进展（计时、日志、会议纪要）
- ✅ Event Tree 自动关联，无需手动管理
- ✅ 一目了然查看总时长和详细时间片段

**对于 Outlook 用户（同事、项目经理）**:
- ✅ 看到原始会议（9:00-10:00）
- ✅ 看到 Zoey 的实际工作时间（9:05-9:45, 14:00-15:30）
- ✅ 看到 Zoey 的工作内容（"讨论了新功能需求"，"实现了需求文档"）
- ✅ 无需了解 ReMarkable 的 Event Tree 架构

---

#### 远程事件数量

**动态数量**: **N 个** (N = Timer 子事件数量)

- 原始会议事件：**不创建**（Plan 只接收）
- Timer 子事件 1：**1 个** Outlook 事件
- Timer 子事件 2：**1 个** Outlook 事件
- ...
- Timer 子事件 N：**1 个** Outlook 事件

**总计**: Plan 接收 1 个外部事件，Actual 发送 N 个子事件

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

| 场景 | Plan 模式 | Actual 模式 | 远程事件 | Plan 同步 | Actual 同步 | 关键逻辑 | UI 警告 | 典型用例 |
|------|-----------|-------------|----------|-----------|-------------|----------|---------|----------|
| **A1** | 只接收 | 只接收 | 0 个 | ✅ 接收 | ❌ 禁用 | Plan 优先接收 | - | 只读外部日程 |
| **A2** ⭐ | 只接收 | 只发送 | N 个 | ✅ 接收（忽略子事件） | ✅ 每个 Timer → 1 个事件 | Event Tree 多事件同步 | ℹ️ 多事件提示 | 接收会议 + 记录工作进展 |
| **A3** | 只接收 | 双向 | 1 个 | ❌ 禁用 | ✅ 双向 | Actual 优先 | ⚠️ 配置冲突 | 不推荐 |
| **B1** | 只发送 | 只接收 | 1 个 | ✅ 发送 | ✅ 接收（智能合并） | Plan → Outlook → Actual | - | Plan 主导 + Actual 跟随 |
| **B2** | 只发送 | 只发送 | 1 个 | ✅ 发送 | ❌ 禁用 | Plan 优先发送 | ⚠️ 禁止重复发送 | 不推荐 |
| **B3** | 只发送 | 双向 | 1 个 | ❌ 禁用 | ✅ 双向 | Actual 优先 | ℹ️ Actual 优先级高 | Actual 主导同步 |
| **C1** | 双向 | 只接收 | 1 个 | ✅ 双向 | ✅ 接收（跟随 Plan） | Plan 主导，Actual 跟随 | - | Plan 完全控制 |
| **C2** | 双向 | 只发送 | 1 个 | ✅ 双向 | ❌ 禁用 | Plan 优先 | ℹ️ Plan 优先级高 | Plan 完全控制 |
| **C3** | 双向 | 双向 | 1 个 | ✅ 双向 | ❌ 禁用 | Plan 优先 | ⚠️ 禁止双双向 | 不推荐 |

**优先级规则**:
1. **双向 > 只发送 > 只接收**
2. **Plan 优先** 当优先级相同时
3. **A2 场景特殊**: 每个 Timer 子事件创建独立的远程事件（N 个）
4. **其他场景**: 相同日历只创建 1 个远程事件

**⭐ 推荐场景**:
- **A2**: 接收外部日程，记录自己的工作进展（最常见）
- **B1**: 自己创建日程，实际进展自动跟随计划
- **C1**: 完全控制日程，实际进展只读跟随

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
  
  // ============================================================
  // ✅ Event Tree 相关字段
  // ============================================================
  
  /** 父事件 ID（Timer 子事件关联到 ParentEvent） */
  parentEventId?: string | null;
  
  /** 子事件列表（ParentEvent 包含的所有 Timer 子事件） */
  childEvents?: Event[];
  
  /** 事件类型 */
  type?: 'parent' | 'timer' | 'plan';
  
  /** 已同步到 Outlook 的事件 ID（仅 Timer 子事件） */
  syncedOutlookEventId?: string | null;
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
      
      /** ✅ 多事件同步配置（A2 场景专用） */
      multiEventSync?: {
        enabled: boolean;
        strategy: 'one-timer-one-event';  // 每个 Timer 子事件创建一个独立的远程事件
        titleTemplate: string;  // 事件标题模板，如 "{{parentTitle}} - 实际进展 {{timerIndex}}"
        includeTimerLog: boolean;  // 是否包含 TimerLog 作为事件描述
        linkToParent: boolean;  // 是否通过 extendedProperties 关联 ParentEvent
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
    if (actualMode === 'send-only') return scenarioA2(event);  // ⭐ 多事件同步
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
 * 场景 A2 的具体实现（多事件同步）
 * 
 * @description Plan 只接收 + Actual 只发送，每个 Timer 子事件创建独立的远程事件
 */
function scenarioA2(event: Event): MergedSyncConfig {
  return {
    mergedMode: 'plan-receive-actual-send-multi-events',
    remoteEventCount: event.childEvents?.length || 0,  // 动态数量
    allTargetCalendars: event.plannedCalendarIds || [],
    
    syncStrategy: {
      plan: {
        shouldSync: true,
        direction: 'receive-only',
        targetCalendars: event.plannedCalendarIds,
        deduplication: {
          enabled: true,
          strategy: 'ignore-child-events',  // ✅ ParentEvent 忽略所有子事件
          identifyBy: 'remarkableParentId'
        }
      },
      actual: {
        shouldSync: true,
        direction: 'send-only',
        targetCalendars: event.actualCalendarIds,
        multiEventSync: {
          enabled: true,
          strategy: 'one-timer-one-event',
          titleTemplate: '{{parentTitle}} - 实际进展 {{timerIndex}}',
          includeTimerLog: true,
          linkToParent: true
        }
      }
    },
    
    uiWarning: {
      show: true,
      level: 'info',
      message: 'ℹ️ 每次计时或写日志都会在 Outlook 创建新事件，方便外部查看你的工作进展'
    }
  };
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
