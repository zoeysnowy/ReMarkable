# 日历同步配置 - 场景矩阵分析

> **文档版本**: v2.0  
> **创建时间**: 2025-11-19  
> **最后更新**: 2025-11-19  
> **目的**: 分析 Plan 和 Actual 日历选择与同步模式的所有组合场景

---

## 🎉 架构更新 (2025-11-19)

### v2.1 - 私有同步模式（仅自己）

**新增同步模式**:
- ✅ **send-only-private**: 只发送（仅自己）- 不邀请参与者，participants 作为文本添加到 description
- ✅ **bidirectional-private**: 双向同步（仅自己）- 不邀请参与者，participants 作为文本添加到 description

**UI 选项**:
- **Plan SyncMode 下拉菜单**:
  - 只接收 (receive-only)
  - 只发送（全部参会人）(send-only)
  - 只发送（仅自己）(send-only-private) ⭐ 新增
  - 双向同步（全部参会人）(bidirectional)
  - 双向同步（仅自己）(bidirectional-private) ⭐ 新增

- **Actual SyncMode 下拉菜单**:
  - 只发送（全部参会人）(send-only)
  - 只发送（仅自己）(send-only-private) ⭐ 新增
  - 双向同步（全部参会人）(bidirectional)
  - 双向同步（仅自己）(bidirectional-private) ⭐ 新增

**典型用例**:
- ✅ 避免频繁同步打扰参与者（Timer/TimeLog 子事件不发送邀请）
- ✅ 保留参与者信息供自己查看（participants 在 description 中）
- ✅ 会议日程创建后暂不发送邀请

**技术实现**:
```typescript
// 原本的 participants
event.participants = ['alice@company.com', 'bob@company.com'];

// 同步到 Remote 时（private 模式）
remoteEvent = {
  attendees: [],  // ❌ 不邀请任何人
  description: `
📧 参与者：alice@company.com, bob@company.com

${event.description || ''}
  `
};
```

---

### v2.0 - 移除 Actual 的 receive-only 模式

**核心理念变化**:
- ❌ **移除**: Actual 的 "只接收" (receive-only) 模式
- ✅ **原因**: 外部进来的信息都应该归为 **Plan**（计划），Actual 只记录和发送**实际发生的事情**
- ✅ **Actual 只支持 4 种模式**: send-only, send-only-private, bidirectional, bidirectional-private

**场景数量变化**:
- 相同日历：从 9 种场景 → **6 种场景**（移除 A1, B1, C1）
- 不同日历：从 6 种场景 → **4 种场景**（移除 D4, D6）

**核心场景调整**:
- ⭐ **A1 (原 A2)**: Plan 只接收 + Actual 只发送 - 接收外部会议并记录工作进展（最常见场景）

**子事件类型扩展**:
- ✅ **Timer 子事件**: 系统自动（停止 Timer 时创建）
- ✅ **TimeLog 子事件**: 用户随手记录笔记（会议纪要、思考、发现等）
- ✅ **OutsideApp 子事件**: 系统自动记录（使用的 App、录屏、听的音乐等）
- 📌 这些子事件都继承 ParentEvent 的 Actual 配置，每个创建独立的远程事件

---

### v1.0 - Event Tree + 多事件同步 + 多日历支持

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
// Plan接收外部事件时，自动忽略本地子事件（Timer/TimeLog/OutsideApp）创建的远程事件
function onPlanReceiveEvent(remoteEvent: OutlookEvent, localEvent: Event) {
  // ✅ 检查是否是本地子事件创建的远程事件
  const subEventTypes = ['timer-sub-event', 'timelog-sub-event', 'outsideapp-sub-event'];
  if (subEventTypes.includes(remoteEvent.extendedProperties?.remarkableType) &&
      remoteEvent.extendedProperties?.remarkableParentId === localEvent.id) {
    console.log(`[🛡️ 日历同步] 跳过子事件（${remoteEvent.extendedProperties?.remarkableType}），防止循环`);
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
  - **Plan 的 3 种模式**:
    - **📥 只接收 (receive-only)**: 从外部日历接收事件，不回写
    - **📤 只发送 (send-only)**: 回写到外部日历，不接收更新
    - **🔄 双向同步 (bidirectional)**: 双向同步
  
  - **Actual 的 2 种模式**（❌ 无 receive-only）:
    - **📤 只发送 (send-only)**: 发送实际进展到外部日历
    - **🔄 双向同步 (bidirectional)**: 发送并接收外部对实际进展的修改
    - ⚠️ **Actual 不应该有 "只接收" 模式**，因为外部进来的信息都应该归为 Plan

---

## 🎯 场景矩阵: 相同日历的 6 种严格规划

> **核心原则**: 当 Plan 和 Actual 选择相同日历时，必须严格规划同步行为，避免数据冲突和重复事件。
> 
> **Actual 只有 2 种模式**: send-only（只发送）和 bidirectional（双向），**不支持 receive-only**，因为外部进来的信息都应该归为 Plan。

---

## 📋 场景 A: Plan 【只接收】时，Actual 的 2 种情况

> ⚠️ Actual 不支持 "只接收" 模式，所以场景 A 只有 2 种情况

### ~~A1. Plan 只接收 + Actual 只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

---

### A1. Plan 只接收 + Actual 只发送 ⭐ 核心场景

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

**步骤 3: 用户记录笔记（TimeLog）**
```
用户操作: 在会议进行中随手记录笔记
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual:
          ├─ Timer 子事件 #1234-timer-1 (9:05-9:45)
          └─ TimeLog 子事件 #1234-timelog-1 (10:30) ← 新增
              ├─ 笔记: "会议纪要：决定采用方案 A"
              └─ 📤 发送到 Outlook

Outlook "工作" 日历（新增笔记事件）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始事件)
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45)
  └─ 📅 "产品评审会 - 笔记 1" (10:30) ← 新创建
      └─ 描述: "会议纪要：决定采用方案 A"
```

**步骤 4: 系统记录使用的 App（OutsideApp）**
```
系统自动检测: 用户在工作期间使用了 Figma、录屏、听音乐
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual:
          ├─ Timer 子事件 #1234-timer-1 (9:05-9:45)
          ├─ TimeLog 子事件 #1234-timelog-1 (10:30)
          └─ OutsideApp 子事件 #1234-outsideapp-1 (9:05-9:45) ← 新增
              ├─ 使用记录: "Figma, 录屏, Spotify"
              └─ 📤 发送到 Outlook

Outlook "工作" 日历（新增使用记录）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始事件)
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45)
  ├─ 📅 "产品评审会 - 笔记 1" (10:30)
  └─ 📅 "产品评审会 - 使用记录 1" (9:05-9:45) ← 新创建
      └─ 描述: "使用应用: Figma (设计原型)\n录屏: screen-recording-001.mp4\n听音乐: Spotify"
```

**步骤 5: 用户第二次计时（同一天下午继续工作）**
```
用户操作: 再次点击 Timer → 14:00-15:30
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual: 
          ├─ Timer 子事件 #1234-timer-1 (9:05-9:45)
          ├─ TimeLog 子事件 #1234-timelog-1 (10:30)
          ├─ OutsideApp 子事件 #1234-outsideapp-1 (9:05-9:45)
          └─ Timer 子事件 #1234-timer-2 (14:00-15:30) ← 新增
              ├─ 时间片段: 14:00-15:30
              ├─ TimerLog: "实现了需求文档"
              └─ 📤 发送到 Outlook

Outlook "工作" 日历（再次新增事件）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始事件)
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45)
  ├─ 📅 "产品评审会 - 笔记 1" (10:30)
  ├─ 📅 "产品评审会 - 使用记录 1" (9:05-9:45)
  └─ 📅 "产品评审会 - 实际进展 2" (14:00-15:30, 新增) ← 新创建
      └─ 描述: "实现了需求文档"
```

**步骤 6: 用户查看 ReMarkable**
```
ReMarkable Event Tree 视图（用户不需要知道这个架构）
  └─ "产品评审会" (ParentEvent #1234)
      ├─ Plan: 9:00-10:00 (来自 Outlook)
      ├─ Actual 总时长: 2h 10min (9:05-9:45 + 14:00-15:30)
      ├─ 📊 Timer 子事件 1: 9:05-9:45 (40 min)
      │   └─ 日志: "讨论了新功能需求"
      ├─ 📝 TimeLog 子事件 1: 10:30
      │   └─ 笔记: "会议纪要：决定采用方案 A"
      ├─ 💻 OutsideApp 子事件 1: 9:05-9:45
      │   └─ 使用记录: "Figma, 录屏, Spotify"
      └─ 📊 Timer 子事件 2: 14:00-15:30 (1h 30min)
          └─ 日志: "实现了需求文档"
```

**步骤 7: Outlook 用户视角**
```
Outlook "工作" 日历视图
  11月19日
    ├─ 9:00-10:00  📅 "产品评审会" (原始会议)
    ├─ 9:05-9:45   📅 "产品评审会 - 实际进展 1" (Zoey 计时 40min)
    ├─ 10:30       📅 "产品评审会 - 笔记 1" (Zoey 的会议纪要)
    ├─ 9:05-9:45   📅 "产品评审会 - 使用记录 1" (Zoey 使用的工具)
    └─ 14:00-15:30 📅 "产品评审会 - 实际进展 2" (Zoey 继续工作 1.5h)
```

---

#### 🔑 核心设计原则

**0. Event Tree 中的两种子事件 + 两层同步系统**

ReMarkable 的 Event Tree 支持两种类型的子事件，关键理解：**每个事件都有独立的同步系统**

| 类型 | 创建方式 | 同步配置 | EditModal | ParentEvent 的 Plan 是否忽略子事件创建的远程事件 |
|------|----------|----------|-----------|---------------------------------------------|
| **Timer 子事件** | 系统自动（停止 Timer） | ❌ 继承 ParentEvent Actual 配置 | ❌ 无 | ✅ 忽略 |
| **TimeLog 子事件** | 用户随手记录笔记 | ❌ 继承 ParentEvent Actual 配置 | ❌ 无 | ✅ 忽略 |
| **OutsideApp 子事件** | 系统自动记录（使用的 App、录屏、听的音乐等） | ❌ 继承 ParentEvent Actual 配置 | ❌ 无 | ✅ 忽略 |
| **用户手动子事件** | 用户手动添加（Event/Task） | ✅ 有独立 planSyncConfig/actualSyncConfig | ✅ 有独立 EditModal | ✅ 忽略 |

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
    // Timer 子事件（系统自动 - 计时）
    { 
      id: '1234-timer-1',
      type: 'timer',
      isTimer: true,
      planSyncConfig: undefined,  // 继承 ParentEvent
      actualSyncConfig: undefined
    },
    
    // TimeLog 子事件（用户随手记录笔记）
    {
      id: '1234-timelog-1',
      type: 'timelog',
      isTimeLog: true,
      planSyncConfig: undefined,  // 继承 ParentEvent
      actualSyncConfig: undefined
    },
    
    // OutsideApp 子事件（系统自动记录使用的 App、录屏、音乐等）
    {
      id: '1234-outsideapp-1',
      type: 'outsideapp',
      isOutsideApp: true,
      planSyncConfig: undefined,  // 继承 ParentEvent
      actualSyncConfig: undefined
      // ⚠️ 当这些子事件同步到 Outlook 创建远程事件时：
      // ParentEvent 的 Plan 接收会忽略这些远程事件（因为是自己的子事件创建的）
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

**1. 每个子事件（Timer/TimeLog/OutsideApp）= 一个独立的 Outlook 事件**
```typescript
// 当用户创建新的子事件时（Timer/TimeLog/OutsideApp）
function onSubEventCreate(parentEvent: Event, subEvent: Event) {
  if (parentEvent.actualSyncConfig?.mode === 'send-only' || 
      parentEvent.actualSyncConfig?.mode === 'bidirectional') {
    
    // 确定子事件类型
    const subEventType = subEvent.isTimer ? 'timer' : 
                        subEvent.isTimeLog ? 'timelog' : 
                        subEvent.isOutsideApp ? 'outsideapp' : 'unknown';
    
    // 创建独立的远程事件
    const remoteEvent = {
      id: `${parentEvent.id}-${subEventType}-${subEvent.id}`,  // ✅ 独立 ID
      title: getSubEventTitle(parentEvent, subEvent, subEventType),
      start: subEvent.startTime,
      end: subEvent.endTime,
      description: subEvent.eventlog || '',
      extendedProperties: {
        remarkableParentId: parentEvent.id,  // ✅ 关联 ParentEvent
        remarkableSubEventId: subEvent.id,
        remarkableType: `${subEventType}-sub-event`  // 'timer-sub-event', 'timelog-sub-event', 'outsideapp-sub-event'
      }
    };
    
    // 发送到 Outlook
    syncToOutlook(parentEvent.actualCalendarIds[0], remoteEvent);
  }
}

// 根据子事件类型生成标题
function getSubEventTitle(parent: Event, subEvent: Event, type: string): string {
  const index = getSubEventIndex(parent, subEvent, type);
  
  switch (type) {
    case 'timer':
      return `${parent.title} - 实际进展 ${index}`;
    case 'timelog':
      return `${parent.title} - 笔记 ${index}`;
    case 'outsideapp':
      return `${parent.title} - 使用记录 ${index}`;
    default:
      return `${parent.title} - 记录 ${index}`;
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
    // 类型 1: 继承 ParentEvent Actual 配置的子事件（无独立同步配置）
    // ============================================================
    
    // 1a. Timer 子事件（计时）
    {
      id: '1234-timer-1',
      parentEventId: '1234',
      type: 'timer',
      isTimer: true,
      startTime: '2025-11-19T09:05:00',
      endTime: '2025-11-19T09:45:00',
      eventlog: '讨论了新功能需求',
      
      // ❌ 继承 ParentEvent 的 Actual 配置
      plannedCalendarIds: undefined,
      actualCalendarIds: undefined,
      planSyncConfig: undefined,
      actualSyncConfig: undefined,
      
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-1'
    },
    
    // 1b. TimeLog 子事件（用户随手记录笔记）
    {
      id: '1234-timelog-1',
      parentEventId: '1234',
      type: 'timelog',
      isTimeLog: true,
      startTime: '2025-11-19T10:30:00',
      endTime: '2025-11-19T10:30:00',  // 可能无时间范围
      eventlog: '会议纪要：决定采用方案 A',
      
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-2'
    },
    
    // 1c. OutsideApp 子事件（系统自动记录）
    {
      id: '1234-outsideapp-1',
      parentEventId: '1234',
      type: 'outsideapp',
      isOutsideApp: true,
      startTime: '2025-11-19T09:05:00',
      endTime: '2025-11-19T09:45:00',
      eventlog: '使用应用: Figma (设计原型)\n录屏: screen-recording-001.mp4\n听音乐: Spotify - Focus Playlist',
      
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-3'
    },
    
    // 1d. 第二次计时
    {
      id: '1234-timer-2',
      parentEventId: '1234',
      type: 'timer',
      isTimer: true,
      startTime: '2025-11-19T14:00:00',
      endTime: '2025-11-19T15:30:00',
      eventlog: '实现了需求文档',
      syncedToOutlook: true,
      outlookEventId: 'outlook-event-xyz-4'
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
  remoteEventCount: 1 + (event.childEvents?.length || 0),  // ⭐ Plan 1个 + Actual N个子事件
  
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

### A2. Plan 只接收 + Actual 双向同步

> **核心理解**: 与 A1 场景本质相同，只是 **Remote 端可以编辑 Actual 发送的事件**，Actual 会接收这些修改。

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'bidirectional' }  // ← 唯一区别：Actual 可以接收 Remote 的修改
}
```

**典型用例**: 
- 接收外部会议邀请（Plan）
- 记录自己的工作进展（Actual Timer 子事件）
- **允许外部同事修改你发送的进展事件**（如调整时间、添加备注）

---

#### 💡 场景示例：接收会议 + 允许外部修改进展

**步骤 1-3**: 与 A1 场景相同
```
Outlook "工作" 日历
  ├─ 📅 "产品评审会" (9:00-10:00, 外部创建)
  ├─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45, ReMarkable 创建)
  └─ 📅 "产品评审会 - 实际进展 2" (14:00-15:30, ReMarkable 创建)
```

**步骤 4: 外部同事在 Outlook 修改了进展事件**
```
外部同事操作: 在 Outlook 修改 "产品评审会 - 实际进展 1"
  - 原时间: 9:05-9:45
  - 修改为: 9:00-10:00
  - 添加备注: "实际从会议开始就参与了"
```

**步骤 5: Actual 接收外部修改**
```
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      └─ Actual:
          ├─ Timer 子事件 #1234-timer-1 (9:00-10:00) ← ✅ 已更新
          │   └─ eventlog: "实际从会议开始就参与了"（外部修改）
          └─ Timer 子事件 #1234-timer-2 (14:00-15:30)
```

---

#### 🔑 与 A1 场景的对比

| 特性 | A1 (Actual 只发送) | A2 (Actual 双向) |
|------|-------------------|-----------------|
| **Plan 接收外部会议** | ✅ 是 | ✅ 是 |
| **Actual 发送 Timer 子事件** | ✅ 是 | ✅ 是 |
| **Actual 接收外部修改** | ❌ 否 | ✅ **是**（关键区别） |
| **Remote 端修改进展事件** | ❌ 修改无效 | ✅ 同步回 ReMarkable |
| **典型用例** | 单向记录工作进展 | 协作调整工作进展 |

---

#### 📊 同步行为

**Plan 同步**:
- 📥 **只接收**: Outlook → Plan（只读，与 A1 相同）
- ✅ **忽略所有子事件**: 通过 `remarkableParentId` 识别（与 A1 相同）

**Actual 同步**:
- 📤 **发送**: Timer 子事件 → Outlook（与 A1 相同）
- 📥 **接收**: Outlook 修改 → Timer 子事件（⭐ 新增）
- 🔄 **双向**: Actual ↔ Outlook

**数据流向**:
```
1️⃣ Plan 接收外部会议
   Outlook "产品评审会" (9:00-10:00) → Plan (只读)

2️⃣ Actual 发送 Timer 子事件（与 A1 相同）
   Timer #1234-timer-1 → Outlook "实际进展 1" (9:05-9:45)
   Timer #1234-timer-2 → Outlook "实际进展 2" (14:00-15:30)

3️⃣ Actual 接收外部修改（⭐ A2 独有）
   Outlook "实际进展 1" (修改为 9:00-10:00) → Timer #1234-timer-1 更新
```

---

#### 🔑 去重逻辑（与 A1 相同）

**ParentEvent 的 Plan 接收**:
```typescript
function onParentEventPlanReceive(remoteEvent: OutlookEvent, parentEvent: Event) {
  // ✅ 忽略所有子事件创建的远程事件（与 A1 相同）
  if (remoteEvent.extendedProperties?.remarkableParentId === parentEvent.id) {
    console.log('跳过同步：这是子事件创建的远程事件');
    return;
  }
  
  // 只接收外部创建的 "产品评审会"
  updateParentEventPlan(remoteEvent);
}
```

**子事件的 Actual 接收（Timer/TimeLog/OutsideApp）**:
```typescript
function onSubEventActualReceive(remoteEvent: OutlookEvent, subEvent: Event) {
  // ⭐ A2 独有：接收外部对子事件的修改
  if (remoteEvent.extendedProperties?.remarkableSubEventId === subEvent.id) {
    updateSubEvent(subEvent, {
      startTime: remoteEvent.start,
      endTime: remoteEvent.end,
      eventlog: remoteEvent.description  // 外部可能添加了备注
    });
    console.log(`子事件已更新（外部修改）: ${subEvent.type}`);
  }
}
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-receive-actual-bidirectional-multi-events',  // ⭐ 双向
  remoteEventCount: 1 + (event.childEvents?.length || 0),  // ⭐ Plan 1个 + Actual N个子事件
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'receive-only',
      targetCalendars: event.plannedCalendarIds,
      deduplication: {
        enabled: true,
        strategy: 'ignore-child-events',  // 与 A1 相同
        identifyBy: 'remarkableParentId'
      }
    },
    
    actual: {
      shouldSync: true,
      direction: 'bidirectional',  // ⭐ 双向（关键区别）
      targetCalendars: event.actualCalendarIds,
      multiEventSync: {
        enabled: true,
        strategy: 'one-timer-one-event',
        titleTemplate: '{{parentTitle}} - 实际进展 {{timerIndex}}',
        includeTimerLog: true,
        linkToParent: true,
        acceptExternalEdits: true  // ⭐ 接受外部编辑
      }
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ Actual 双向同步：外部同事可以修改你发送的进展事件（如调整时间、添加备注），修改会同步回 ReMarkable'
  }
}
```

---

#### 🎯 用户价值

**对于 ReMarkable 用户**:
- ✅ 接收外部日程（Plan）
- ✅ 记录实际工作进展（Actual Timer）
- ✅ **接受外部同事的调整**（如 "你实际是 9:00 开始的，不是 9:05"）

**对于 Outlook 用户（同事）**:
- ✅ 看到原始会议
- ✅ 看到 Zoey 的工作进展
- ✅ **可以修改 Zoey 发送的进展事件**（调整时间、添加备注）

---

#### 远程事件数量

**动态数量**: **1 + N 个**
- Plan 接收：**1 个**外部事件（由外部创建）
- Actual 双向：**N 个**子事件（Timer/TimeLog/OutsideApp，各自独立）

**总计**: 1 + N 个（Plan 和 Actual 子事件各自独立管理）

---

#### ⚠️ 注意事项

**与 A1 的关键区别**:
- **A1**: Actual 只发送，外部修改无效（单向记录）
- **A2**: Actual 双向，外部修改会同步回来（协作调整）

**推荐场景**:
- ✅ **A1**: 大多数情况（你只记录自己的进展）
- ✅ **A2**: 需要团队协作调整进展时间（如项目经理需要统一调整时间）

---

## 📋 场景 B: Plan 【只发送】时，Actual 的 2 种情况

> ⚠️ Actual 不支持 "只接收" 模式，所以场景 B 只有 2 种情况

### ~~B1. Plan 只发送 + Actual 只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

---

### B1. Plan 只发送 + Actual 只发送

> **核心理解**: 与 A1 场景类似，但 **ReMarkable 不再接收 Remote 端（日历端）的信息**，只单向修改 Remote 端。
> 
> **Remote 端说明**: 日历端（目前支持 Outlook，未来支持 Google Calendar 和 iCloud Calendar）

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only' },
  actualSyncConfig: { mode: 'send-only' }
}
```

**典型用例**: 
- 用户在 ReMarkable 创建日程（Plan）
- 记录自己的实际工作进展（Actual 子事件：Timer/TimeLog/OutsideApp）
- **所有信息单向推送到日历端**，不接收日历端的修改

---

#### 💡 场景示例：创建日程并记录工作进展

**步骤 1: 用户在 ReMarkable 创建日程**
```
ReMarkable 本地
  └─ Event #5678 (ParentEvent)
      ├─ Plan: 9:00-10:00 "技术分享会"
      └─ Actual: 空（尚未开始工作）
      
      📤 发送到 Outlook

Outlook "工作" 日历（新增事件）
  └─ 📅 "技术分享会" (9:00-10:00, 由 ReMarkable 创建)
```

**步骤 2-5**: 与 A1 场景相同
```
用户操作: 计时、记录笔记、使用工具
ReMarkable 本地
  └─ Event #5678 (ParentEvent)
      ├─ Plan: 9:00-10:00 "技术分享会"
      └─ Actual:
          ├─ Timer 子事件 #5678-timer-1 (9:05-9:45)
          ├─ TimeLog 子事件 #5678-timelog-1 (10:30)
          ├─ OutsideApp 子事件 #5678-outsideapp-1 (9:05-9:45)
          └─ Timer 子事件 #5678-timer-2 (14:00-15:30)

Outlook "工作" 日历（完整记录）
  ├─ 📅 "技术分享会" (9:00-10:00, Plan 创建)
  ├─ 📅 "技术分享会 - 实际进展 1" (9:05-9:45)
  ├─ 📅 "技术分享会 - 笔记 1" (10:30)
  ├─ 📅 "技术分享会 - 使用记录 1" (9:05-9:45)
  └─ 📅 "技术分享会 - 实际进展 2" (14:00-15:30)
```

**步骤 6: 外部同事在 Outlook 修改了事件**
```
外部同事操作: 在 Outlook 修改 "技术分享会" 的时间
  - 原时间: 9:00-10:00
  - 修改为: 10:00-11:00
  
ReMarkable 本地
  └─ Event #5678 (ParentEvent)
      ├─ Plan: 9:00-10:00 ← ❌ 不更新（send-only）
      └─ Actual: （子事件不受影响）
```

---

#### 🔑 与 A1 场景的对比

| 特性 | A1 (Plan 只接收 + Actual 只发送) | B1 (Plan 只发送 + Actual 只发送) |
|------|----------------------------------|----------------------------------|
| **Plan 同步方向** | 📥 只接收 Remote 端信息 | 📤 只发送到 Remote 端 |
| **Actual 同步方向** | 📤 只发送到 Remote 端 | 📤 只发送到 Remote 端 |
| **Remote 端修改 Plan** | ✅ 同步回 ReMarkable | ❌ 不同步（单向推送） |
| **Remote 端修改 Actual 子事件** | ❌ 不同步（send-only） | ❌ 不同步（send-only） |
| **典型用例** | 接收外部会议邀请 + 记录进展 | 自己创建日程 + 记录进展 |
| **适用场景** | 参与外部会议（被动） | 自己主导日程（主动） |

---

#### 📊 同步行为

**Plan 同步**:
- 📤 **只发送**: ReMarkable Plan → Remote 端（Outlook/Google/iCloud）
- ✅ **创建远程事件**: "技术分享会" (9:00-10:00)
- ❌ **不接收修改**: Remote 端修改不会同步回 ReMarkable

**Actual 同步** (与 A1 完全相同):
- 📤 **发送**: 每个子事件（Timer/TimeLog/OutsideApp）→ Remote 端创建**独立事件**
- ❌ **不接收修改**: Remote 端修改不会同步回 ReMarkable

**数据流向**:
```
1️⃣ Plan 发送
   ReMarkable Plan "技术分享会" (9:00-10:00) → Remote 端

2️⃣ Actual 发送子事件（与 A1 相同）
   Timer #5678-timer-1 → Remote "实际进展 1" (9:05-9:45)
   TimeLog #5678-timelog-1 → Remote "笔记 1" (10:30)
   OutsideApp #5678-outsideapp-1 → Remote "使用记录 1" (9:05-9:45)
   Timer #5678-timer-2 → Remote "实际进展 2" (14:00-15:30)

3️⃣ Remote 端修改（❌ 不同步回 ReMarkable）
   Remote 修改 "技术分享会" 时间 → ReMarkable 不更新
```

---

#### 🔑 核心设计原则（与 A1 相同）

**1. 每个子事件（Timer/TimeLog/OutsideApp）= 一个独立的 Remote 事件**
```typescript
function onSubEventCreate(parentEvent: Event, subEvent: Event) {
  if (parentEvent.actualSyncConfig?.mode === 'send-only') {
    const subEventType = subEvent.isTimer ? 'timer' : 
                        subEvent.isTimeLog ? 'timelog' : 
                        subEvent.isOutsideApp ? 'outsideapp' : 'unknown';
    
    const remoteEvent = {
      id: `${parentEvent.id}-${subEventType}-${subEvent.id}`,
      title: getSubEventTitle(parentEvent, subEvent, subEventType),
      start: subEvent.startTime,
      end: subEvent.endTime,
      description: subEvent.eventlog || '',
      extendedProperties: {
        remarkableParentId: parentEvent.id,
        remarkableSubEventId: subEvent.id,
        remarkableType: `${subEventType}-sub-event`
      }
    };
    
    syncToRemoteCalendar(parentEvent.actualCalendarIds[0], remoteEvent);
  }
}
```

**2. ParentEvent 也创建独立的远程事件**
```typescript
function onPlanCreate(parentEvent: Event) {
  if (parentEvent.planSyncConfig?.mode === 'send-only') {
    const remoteEvent = {
      id: `${parentEvent.id}-plan`,
      title: parentEvent.title,
      start: parentEvent.startTime,
      end: parentEvent.endTime,
      description: parentEvent.description || '',
      extendedProperties: {
        remarkableEventId: parentEvent.id,
        remarkableType: 'plan-event'
      }
    };
    
    syncToRemoteCalendar(parentEvent.plannedCalendarIds[0], remoteEvent);
  }
}
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-send-actual-send-multi-events',  // 双只发送
  remoteEventCount: 1 + (event.childEvents?.length || 0),  // Plan 1个 + Actual N个
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendars: event.plannedCalendarIds,
      
      // ❌ 不接收 Remote 端修改
      receiveUpdates: false
    },
    
    actual: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendars: event.actualCalendarIds,
      multiEventSync: {
        enabled: true,
        strategy: 'one-timer-one-event',
        titleTemplate: '{{parentTitle}} - {{subEventType}} {{index}}',
        includeTimerLog: true,
        linkToParent: true
      },
      
      // ❌ 不接收 Remote 端修改
      receiveUpdates: false
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ 单向推送模式：所有信息推送到日历端，日历端的修改不会同步回 ReMarkable'
  }
}
```

---

#### 🎯 用户价值

**对于 ReMarkable 用户**:
- ✅ 完全控制日程（自己创建 Plan）
- ✅ 自由记录实际工作进展（计时、日志、工具使用）
- ✅ 单向推送到日历端，避免外部修改覆盖本地数据
- ✅ ReMarkable 是唯一的数据源

**对于 Remote 端用户（同事、项目经理）**:
- ✅ 看到完整的日程安排（Plan）
- ✅ 看到详细的工作进展（Actual 子事件）
- ⚠️ 修改不会同步回 ReMarkable（单向推送）

---

#### 远程事件数量

**动态数量**: **1 + N 个** (1 = Plan 事件，N = 所有子事件数量)

- Plan 事件：**1 个** Remote 事件
- Timer 子事件 1：**1 个** Remote 事件
- TimeLog 子事件 1：**1 个** Remote 事件
- OutsideApp 子事件 1：**1 个** Remote 事件
- Timer 子事件 2：**1 个** Remote 事件
- ...

**总计**: Plan 发送 1 个，Actual 发送 N 个子事件

---

### B2. Plan 只发送 + Actual 双向同步

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
- 📤 **Plan 发送**: Plan → Outlook 事件 A
- 🔄 **Actual 双向**: Actual ↔ Outlook 事件 B
- ✅ **两个独立的远程事件**，各自管理各自的数据

**典型用例**: 
- 用户创建日程（Plan），单向推送到日历
- Actual 记录实际进展，需要接收外部修改（双向）
- Remote 端看到 2 个事件：Plan 的日程 + Actual 的实际进展

---

#### 🔑 核心设计：两个独立的远程事件

**数据结构**:
```typescript
// ReMarkable 本地
const event = {
  id: '5678',
  title: '技术分享会',
  
  // Plan 部分
  startTime: '9:00',
  endTime: '10:00',
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only' },
  syncedPlanEventId: 'outlook-plan-event-abc',  // ⭐ Plan 的远程事件 ID
  
  // Actual 部分
  actualSegments: [{ start: '9:05', end: '9:45' }],
  actualCalendarIds: ['outlook-calendar-work'],
  actualSyncConfig: { mode: 'bidirectional' },
  syncedActualEventId: 'outlook-actual-event-def'  // ⭐ Actual 的远程事件 ID
};
```

**远程日历结构**:
```typescript
// Outlook "工作" 日历
const events = [
  // Plan 的远程事件
  {
    id: 'outlook-plan-event-abc',
    title: '技术分享会',
    start: '9:00',
    end: '10:00',
    extendedProperties: {
      remarkableEventId: '5678',
      remarkableType: 'plan-event'
    }
  },
  
  // Actual 的远程事件
  {
    id: 'outlook-actual-event-def',
    title: '技术分享会 - 实际进展',
    start: '9:05',
    end: '9:45',
    extendedProperties: {
      remarkableEventId: '5678',
      remarkableType: 'actual-event'
    }
  }
];
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-send-actual-bidirectional',
  remoteEventCount: 2,  // ⭐ 2 个独立的远程事件
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedPlanEventId,
      eventType: 'plan-event'
    },
    
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedActualEventId,
      eventType: 'actual-event',
      titleSuffix: ' - 实际进展',
      mergeSegments: true
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ 将在日历中创建 2 个事件：Plan 的日程（只发送）+ Actual 的实际进展（双向同步）'
  }
}
```

**远程事件数量**: **2 个**（Plan 1 个 + Actual 1 个，各自独立管理）

---

## 📋 场景 C: Plan 【双向同步】时，Actual 的 2 种情况

> ⚠️ Actual 不支持 "只接收" 模式，所以场景 C 只有 2 种情况

### ~~C1. Plan 双向 + Actual 只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

---

### C1. Plan 双向同步 + Actual 只发送

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
- 🔄 **Plan 双向**: Plan ↔ Outlook 事件 A
- 📤 **Actual 发送**: Actual → Outlook 事件 B
- ✅ **两个独立的远程事件**，各自管理各自的数据

**典型用例**: 
- 用户完全控制 Plan（时间、标题、描述），需要与 Remote 端双向同步
- Actual 只记录实际进展（只发送，不接收）
- Remote 端看到 2 个事件：Plan 的日程 + Actual 的实际进展

---

#### 🔑 核心设计：两个独立的远程事件

**数据结构**:
```typescript
// ReMarkable 本地
const event = {
  id: '1234',
  title: '产品评审会',
  
  // Plan 部分
  startTime: '9:00',
  endTime: '10:00',
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional' },
  syncedPlanEventId: 'outlook-plan-event-123',  // ⭐ Plan 的远程事件 ID
  
  // Actual 部分
  actualSegments: [{ start: '9:05', end: '9:45' }],
  actualCalendarIds: ['outlook-calendar-work'],
  actualSyncConfig: { mode: 'send-only' },
  syncedActualEventId: 'outlook-actual-event-456'  // ⭐ Actual 的远程事件 ID
};
```

**远程日历结构**:
```typescript
// Outlook "工作" 日历
const events = [
  // Plan 的远程事件
  {
    id: 'outlook-plan-event-123',
    title: '产品评审会',
    start: '9:00',
    end: '10:00',
    extendedProperties: {
      remarkableEventId: '1234',
      remarkableType: 'plan-event'  // ⭐ 标记为 Plan 事件
    }
  },
  
  // Actual 的远程事件
  {
    id: 'outlook-actual-event-456',
    title: '产品评审会 - 实际进展',
    start: '9:05',
    end: '9:45',
    extendedProperties: {
      remarkableEventId: '1234',
      remarkableType: 'actual-event'  // ⭐ 标记为 Actual 事件
    }
  }
];
```

**同步逻辑**:
```typescript
// Plan 同步（双向）
function syncPlan(event: Event) {
  const planEvent = {
    id: event.syncedPlanEventId || generateEventId(),
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    extendedProperties: {
      remarkableEventId: event.id,
      remarkableType: 'plan-event'
    }
  };
  
  // 发送 Plan 到远程
  OutlookCalendarService.createOrUpdateEvent(
    event.plannedCalendarIds[0],
    planEvent
  );
  
  // 接收远程 Plan 的修改
  const remotePlanEvent = OutlookCalendarService.getEvent(event.syncedPlanEventId);
  if (remotePlanEvent) {
    updateLocalPlan(event, {
      startTime: remotePlanEvent.start,
      endTime: remotePlanEvent.end,
      title: remotePlanEvent.title
    });
  }
}

// Actual 同步（只发送）
function syncActual(event: Event) {
  const mergedSegments = mergeActualSegments(event.actualSegments);
  
  const actualEvent = {
    id: event.syncedActualEventId || generateEventId(),
    title: `${event.title} - 实际进展`,
    start: mergedSegments.startTime,
    end: mergedSegments.endTime,
    extendedProperties: {
      remarkableEventId: event.id,
      remarkableType: 'actual-event'
    }
  };
  
  // 只发送 Actual 到远程
  OutlookCalendarService.createOrUpdateEvent(
    event.actualCalendarIds[0],
    actualEvent
  );
}
```

---

#### 🔄 完整数据流示例

**场景：用户在 ReMarkable 记录 Actual 时间片段**

```
步骤 1: 用户计时 9:05-9:45
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 9:00-10:00 (unchanged)
        │   └─ syncedPlanEventId: 'outlook-plan-event-123'
        └─ Actual: 9:05-9:45 ✅ 新增

步骤 2: Actual 发送到 Remote（创建新事件）
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - Plan 的事件
    │   └─ 9:00-10:00
    └─ 📅 事件 B (outlook-actual-event-456) - Actual 的事件 ✅ 新创建
        └─ 9:05-9:45
  
  ReMarkable 本地
    └─ Event #1234
        └─ syncedActualEventId: 'outlook-actual-event-456' ✅ 记录 Actual 的远程事件 ID
```

**场景：外部用户在 Outlook 修改 Plan 事件时间**

```
步骤 1: 外部用户在 Outlook 修改事件 A (Plan) 的时间 9:00-10:00 → 10:00-11:00
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 修改 ✅
    │   └─ 10:00-11:00
    └─ 📅 事件 B (outlook-actual-event-456) - 不变
        └─ 9:05-9:45

步骤 2: Plan 接收 Remote 更新
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 10:00-11:00 ✅ 更新
        └─ Actual: 9:05-9:45 (unchanged)
```

**场景：外部用户修改 Actual 事件**

```
步骤 1: 外部用户在 Outlook 修改事件 B (Actual) 的时间
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 不变
    │   └─ 10:00-11:00
    └─ 📅 事件 B (outlook-actual-event-456) - 修改
        └─ 9:00-10:00

步骤 2: Actual 不接收（send-only）
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 10:00-11:00 (unchanged)
        └─ Actual: 9:05-9:45 ✅ 不受影响（只发送，不接收）
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-bidirectional-actual-send',
  remoteEventCount: 2,  // ⭐ 2 个独立的远程事件
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedPlanEventId,  // ⭐ Plan 的远程事件 ID
      eventType: 'plan-event'
    },
    
    actual: {
      shouldSync: true,
      direction: 'send-only',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedActualEventId,  // ⭐ Actual 的远程事件 ID
      eventType: 'actual-event',
      titleSuffix: ' - 实际进展'  // ⭐ 区分标题
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ 将在日历中创建 2 个事件：Plan 的日程 + Actual 的实际进展'
  }
}
```

---

#### 🎯 用户价值

**对于 ReMarkable 用户**:
- ✅ Plan 完全控制时间范围（双向同步）
- ✅ Actual 只记录实际进展（只发送）
- ✅ Plan 和 Actual 独立管理，互不干扰

**对于 Remote 端用户**:
- ✅ 看到 2 个独立的事件：
  - 事件 A: "产品评审会" (9:00-10:00) - Plan 的日程
  - 事件 B: "产品评审会 - 实际进展" (9:05-9:45) - Actual 的记录

---

#### 远程事件数量

**2 个**（Plan 1 个 + Actual 1 个，各自独立管理）

---

### C2. Plan 双向同步 + Actual 双向同步

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
- 🔄 **Plan 双向**: Plan ↔ Outlook 事件 A
- 🔄 **Actual 双向**: Actual ↔ Outlook 事件 B
- ✅ **两个独立的远程事件**，各自管理各自的数据

**典型用例**: 
- 用户完全掌控日程，Plan 和 Actual 都需要与 Remote 端双向同步
- 不想区分 Plan/Actual，只想让所有数据保持同步
- Remote 端看到 2 个事件：Plan 的日程 + Actual 的实际进展

---

#### 🔑 核心设计：两个独立的远程事件

**数据结构**:
```typescript
// ReMarkable 本地
const event = {
  id: '1234',
  title: '产品评审会',
  
  // Plan 部分
  startTime: '9:00',
  endTime: '10:00',
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional' },
  syncedPlanEventId: 'outlook-plan-event-123',  // ⭐ Plan 的远程事件 ID
  
  // Actual 部分
  actualSegments: [{ start: '9:05', end: '9:45' }],
  actualCalendarIds: ['outlook-calendar-work'],
  actualSyncConfig: { mode: 'bidirectional' },
  syncedActualEventId: 'outlook-actual-event-456'  // ⭐ Actual 的远程事件 ID
};
```

**远程日历结构**:
```typescript
// Outlook "工作" 日历
const events = [
  // Plan 的远程事件
  {
    id: 'outlook-plan-event-123',
    title: '产品评审会',
    start: '9:00',
    end: '10:00',
    extendedProperties: {
      remarkableEventId: '1234',
      remarkableType: 'plan-event'  // ⭐ 标记为 Plan 事件
    }
  },
  
  // Actual 的远程事件
  {
    id: 'outlook-actual-event-456',
    title: '产品评审会 - 实际进展',
    start: '9:05',
    end: '9:45',
    extendedProperties: {
      remarkableEventId: '1234',
      remarkableType: 'actual-event'  // ⭐ 标记为 Actual 事件
    }
  }
];
```

**同步逻辑**:
```typescript
// Plan 同步（双向）
function syncPlan(event: Event) {
  const planEvent = {
    id: event.syncedPlanEventId || generateEventId(),
    title: event.title,
    start: event.startTime,
    end: event.endTime,
    extendedProperties: {
      remarkableEventId: event.id,
      remarkableType: 'plan-event'
    }
  };
  
  // 发送 Plan 到远程
  OutlookCalendarService.createOrUpdateEvent(
    event.plannedCalendarIds[0],
    planEvent
  );
  
  // 接收远程 Plan 的修改
  const remotePlanEvent = OutlookCalendarService.getEvent(event.syncedPlanEventId);
  if (remotePlanEvent && remotePlanEvent.extendedProperties?.remarkableType === 'plan-event') {
    updateLocalPlan(event, {
      startTime: remotePlanEvent.start,
      endTime: remotePlanEvent.end,
      title: remotePlanEvent.title
    });
  }
}

// Actual 同步（双向）
function syncActual(event: Event) {
  const mergedSegments = mergeActualSegments(event.actualSegments);
  
  const actualEvent = {
    id: event.syncedActualEventId || generateEventId(),
    title: `${event.title} - 实际进展`,
    start: mergedSegments.startTime,
    end: mergedSegments.endTime,
    extendedProperties: {
      remarkableEventId: event.id,
      remarkableType: 'actual-event'
    }
  };
  
  // 发送 Actual 到远程
  OutlookCalendarService.createOrUpdateEvent(
    event.actualCalendarIds[0],
    actualEvent
  );
  
  // 接收远程 Actual 的修改
  const remoteActualEvent = OutlookCalendarService.getEvent(event.syncedActualEventId);
  if (remoteActualEvent && remoteActualEvent.extendedProperties?.remarkableType === 'actual-event') {
    updateLocalActualSegments(event, {
      startTime: remoteActualEvent.start,
      endTime: remoteActualEvent.end
    });
  }
}
```

---

#### 🔄 完整数据流示例

**场景：用户在 ReMarkable 修改 Plan 时间**

```
步骤 1: 用户修改 Plan 时间 9:00-10:00 → 10:00-11:00
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 10:00-11:00 ✅
        ├─ syncedPlanEventId: 'outlook-plan-event-123'
        └─ Actual: 9:05-9:45 (unchanged)
            └─ syncedActualEventId: 'outlook-actual-event-456'

步骤 2: Plan 发送到 Remote（更新事件 A）
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 更新 ✅
    │   └─ 10:00-11:00
    └─ 📅 事件 B (outlook-actual-event-456) - 不变
        └─ 9:05-9:45
```

**场景：用户在 ReMarkable 记录 Actual 时间片段**

```
步骤 1: 用户计时 14:00-15:00
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 10:00-11:00 (unchanged)
        └─ Actual: 9:05-9:45, 14:00-15:00 ✅ 新增

步骤 2: Actual 发送到 Remote（更新事件 B）
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 不变
    │   └─ 10:00-11:00
    └─ 📅 事件 B (outlook-actual-event-456) - 更新 ✅
        └─ 9:05-15:00（合并后的时间段）
```

**场景：外部用户在 Outlook 修改事件 A (Plan)**

```
步骤 1: 外部用户修改事件 A 的时间 10:00-11:00 → 11:00-12:00
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 修改 ✅
    │   └─ 11:00-12:00
    └─ 📅 事件 B (outlook-actual-event-456) - 不变
        └─ 9:05-15:00

步骤 2: Plan 接收 Remote 更新
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 11:00-12:00 ✅ 更新
        └─ Actual: 9:05-9:45, 14:00-15:00 (unchanged)
```

**场景：外部用户在 Outlook 修改事件 B (Actual)**

```
步骤 1: 外部用户修改事件 B 的时间 9:05-15:00 → 9:00-16:00
  Outlook "工作" 日历
    ├─ 📅 事件 A (outlook-plan-event-123) - 不变
    │   └─ 11:00-12:00
    └─ 📅 事件 B (outlook-actual-event-456) - 修改 ✅
        └─ 9:00-16:00

步骤 2: Actual 接收 Remote 更新
  ReMarkable 本地
    └─ Event #1234
        ├─ Plan: 11:00-12:00 (unchanged)
        └─ Actual: 9:00-16:00 ✅ 更新
```

---

#### 📊 SyncConfig 合并逻辑

```typescript
{
  mergedMode: 'plan-actual-bidirectional',
  remoteEventCount: 2,  // ⭐ 2 个独立的远程事件
  
  syncStrategy: {
    plan: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedPlanEventId,  // ⭐ Plan 的远程事件 ID
      eventType: 'plan-event'
    },
    
    actual: {
      shouldSync: true,
      direction: 'bidirectional',
      targetCalendar: 'outlook-calendar-work',
      remoteEventId: event.syncedActualEventId,  // ⭐ Actual 的远程事件 ID
      eventType: 'actual-event',
      titleSuffix: ' - 实际进展'  // ⭐ 区分标题
    }
  },
  
  uiWarning: {
    show: true,
    level: 'info',
    message: 'ℹ️ 将在日历中创建 2 个事件：Plan 的日程 + Actual 的实际进展，各自独立双向同步'
  }
}
```

---

#### 🎯 用户价值

**对于 ReMarkable 用户**:
- ✅ Plan 和 Actual 都完全控制，双向同步
- ✅ Plan 和 Actual 独立管理，互不干扰
- ✅ 外部修改会正确同步回对应的 Plan 或 Actual

**对于 Remote 端用户**:
- ✅ 看到 2 个独立的事件：
  - 事件 A: "产品评审会" (10:00-11:00) - Plan 的日程
  - 事件 B: "产品评审会 - 实际进展" (9:05-15:00) - Actual 的记录
- ✅ 可以分别修改两个事件，修改会同步回 ReMarkable

---

#### 远程事件数量

**2 个**（Plan 1 个 + Actual 1 个，各自独立管理）

---

---

## 📊 相同日历场景总结表

> ⚠️ **Actual 只支持 2 种模式**: send-only（只发送）和 bidirectional（双向），**不支持 receive-only**，因为外部进来的信息都应该归为 Plan。

| 场景 | Plan 模式 | Actual 模式 | 远程事件 | Plan 同步 | Actual 同步 | 说明 | UI 警告 | 典型用例 |
|------|-----------|-------------|----------|-----------|-------------|------|---------|----------|
| ~~**A1**~~ | ~~只接收~~ | ~~只接收~~ | - | - | - | ❌ 已移除 | - | Actual 不支持只接收 |
| **A1** ⭐ | 只接收 | 只发送 | N 个 | ✅ 接收（忽略子事件） | ✅ 每个子事件 → 1 个事件 | Plan 接收外部，子事件各创建独立事件 | ℹ️ 多事件提示 | 接收会议 + 记录工作进展 |
| **A2** | 只接收 | 双向 | 1+1 个 | ✅ 接收 | ✅ 双向 | Plan 和 Actual 各创建独立事件 | ℹ️ 2 个独立事件 | 不推荐 |
| ~~**B1**~~ | ~~只发送~~ | ~~只接收~~ | - | - | - | ❌ 已移除 | - | Actual 不支持只接收 |
| **B1** | 只发送 | 只发送 | 1+N 个 | ✅ 发送 | ✅ 多事件发送 | Plan 1个 + 每个子事件 1个 | ℹ️ Plan + Actual 多事件 | 自己创建日程 + 记录进展 |
| **B2** | 只发送 | 双向 | 1+1 个 | ✅ 发送 | ✅ 双向 | Plan 和 Actual 各创建独立事件 | ℹ️ 2 个独立事件 | Actual 主导同步 |
| ~~**C1**~~ | ~~双向~~ | ~~只接收~~ | - | - | - | ❌ 已移除 | - | Actual 不支持只接收 |
| **C1** | 双向 | 只发送 | 1+1 个 | ✅ 双向 | ✅ 发送 | Plan 和 Actual 各创建独立事件 | ℹ️ 2 个独立事件 | Plan 完全控制 + Actual 发送 |
| **C2** | 双向 | 双向 | 1+1 个 | ✅ 双向 | ✅ 双向 | Plan 和 Actual 各创建独立事件 | ℹ️ 2 个独立事件 | Plan + Actual 都双向同步 |

**关键变化**:
- ❌ **移除 3 个场景**: A1 (Plan只接收+Actual只接收), B1 (Plan只发送+Actual只接收), C1 (Plan双向+Actual只接收)
- ✅ **保留 6 个场景**: A1, A2, B1, B2, C1, C2（重新编号）
- ⭐ **A1 成为核心场景**: Plan 只接收 + Actual 只发送（最常见的使用场景）
- 🔑 **核心理解**: **Plan 和 Actual 永远创建独立的远程事件**，各自有独立的 `syncedPlanEventId` 和 `syncedActualEventId`

**远程事件数量规则**:
1. **A1/B1**: Plan 1个 + 每个子事件（Timer/TimeLog/OutsideApp）1个 = **1+N 个**
2. **A2/B2/C1/C2**: Plan 1个 + Actual 1个 = **2 个**（各自独立管理）

**优先级规则**:
1. **Actual 只支持 4 种模式**: send-only, send-only-private, bidirectional, bidirectional-private
2. **双向 > 只发送** 当 Plan 和 Actual 冲突时
3. **Plan 优先** 当优先级相同时
4. **A1/B1 场景特殊**: 每个子事件创建独立的远程事件（1+N 个）
5. **C1/C2 场景**: 使用去重策略，只创建 1 个远程事件

**⭐ 推荐场景**:
- **A1**: 接收外部日程，记录自己的工作进展（最常见）⭐
- **B1**: 自己创建日程，记录自己的工作进展
- **C1**: Plan 完全控制 + Actual 发送实际进展
- **C2**: Plan + Actual 都双向同步（自动去重）

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

### ~~2.2 不同日历 + Plan 双向 + Actual 只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

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

### ~~2.4 不同日历 + 都是只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

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

### ~~2.6 不同日历 + Plan 只发送 + Actual 只接收~~ ❌ 已移除

> **原因**: Actual 不应该有 "只接收" 模式，外部进来的信息都应该归为 Plan。

---

**远程事件数量**: **3 个**（去重后）

---

## 📊 不同日历场景总结

> ⚠️ **Actual 只支持 2 种模式**: send-only（只发送）和 bidirectional（双向），**不支持 receive-only**

| 场景 | Plan 日历 | Actual 日历（支持多选） | Plan 模式 | Actual 模式 | 远程事件 | 关键逻辑 |
|------|-----------|-------------------------|-----------|-------------|----------|----------|
| **D1** | 工作 | 个人+团队（2 个） | 双向 | 双向 | 3 个 | Actual 多日历保持一致 |
| **D2** | 工作 | 个人+Google 健身 | 双向 | 只发送 | 3 个 | 跨平台多日历 |
| **D3** | 工作 | 工作+个人+团队（重叠） | 双向 | 双向 | 3 个 | Actual 自动去重 "工作" |
| ~~**D4**~~ | ~~工作~~ | ~~个人+团队~~ | ~~双向~~ | ~~只接收~~ | - | ❌ 已移除（Actual 不支持只接收） |
| **D5** | 工作 | 个人+团队 | 只接收 | 双向 | 2 个 | 只有 Actual 创建 |
| ~~**D6**~~ | ~~工作~~ | ~~个人+团队~~ | ~~只接收~~ | ~~只接收~~ | - | ❌ 已移除（Actual 不支持只接收） |

**核心特性**:
1. ✅ **Actual 支持多日历同步** - 可同步到多个日历（同平台或跨平台）
2. ✅ **自动去重** - Actual 自动去掉与 Plan 重叠的日历
3. ✅ **多日历一致性** - Actual 的多个日历保持内容一致（last-write-wins）
4. ✅ **跨平台支持** - Outlook + Google + iCloud 混合同步
5. ⚠️ **Actual 不支持 receive-only** - 外部进来的信息都应该归为 Plan

---

## 🔑 最终数据模型设计

基于以上 9 种相同日历场景 + 不同日历场景，数据模型设计如下：

```typescript
// ============================================================
// 1. 基础同步配置
// ============================================================

/** Plan 支持的同步模式（5 种） */
export type PlanSyncMode = 
  | 'receive-only'           // 只接收
  | 'send-only'              // 只发送（全部参会人）
  | 'send-only-private'      // 只发送（仅自己）⭐ 新增
  | 'bidirectional'          // 双向同步（全部参会人）
  | 'bidirectional-private'; // 双向同步（仅自己）⭐ 新增

/** Actual 支持的同步模式（4 种，不支持 receive-only） */
export type ActualSyncMode = 
  | 'send-only'              // 只发送（全部参会人）
  | 'send-only-private'      // 只发送（仅自己）⭐ 新增
  | 'bidirectional'          // 双向同步（全部参会人）
  | 'bidirectional-private'; // 双向同步（仅自己）⭐ 新增

export interface SyncConfig {
  /** 
   * 同步模式
   * 
   * ⚠️ Plan 支持 5 种模式：receive-only, send-only, send-only-private, bidirectional, bidirectional-private
   * ⚠️ Actual 只支持 4 种模式：send-only, send-only-private, bidirectional, bidirectional-private（不支持 receive-only）
   * 
   * 🔑 Private 模式说明：
   * - send-only-private: 只发送（仅自己），不邀请 participants，将 participants 作为文本添加到 description
   * - bidirectional-private: 双向同步（仅自己），不邀请 participants，将 participants 作为文本添加到 description
   */
  mode: PlanSyncMode | ActualSyncMode;
  
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
  type?: 'parent' | 'timer' | 'timelog' | 'outsideapp' | 'event' | 'task';
  
  /** 子事件标识（继承 ParentEvent Actual 配置的子事件类型） */
  isTimer?: boolean;      // Timer 子事件（计时）
  isTimeLog?: boolean;    // TimeLog 子事件（用户随手记录笔记）
  isOutsideApp?: boolean; // OutsideApp 子事件（使用的 App、录屏、音乐等）
  
  // ============================================================
  // ✅ 远程事件同步 ID（Plan 和 Actual 各自独立）
  // ============================================================
  
  /** Plan 已同步到远程的事件 ID */
  syncedPlanEventId?: string | null;
  
  /** Actual 已同步到远程的事件 ID（或子事件同步的远程事件 ID） */
  syncedActualEventId?: string | null;
  
  /** @deprecated 使用 syncedPlanEventId 和 syncedActualEventId 代替 */
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
  
  // ⚠️ Actual 不支持 receive-only 模式，外部信息都应该归为 Plan
  if (actualMode === 'receive-only') {
    throw new Error('Actual 不支持 receive-only 模式');
  }
  
  // 场景 A: Plan 只接收
  if (planMode === 'receive-only') {
    if (actualMode === 'send-only') return scenarioA1(event);  // ⭐ 1+N 事件
    if (actualMode === 'bidirectional') return scenarioA2(event);  // ⚠️ 冲突
  }
  
  // 场景 B: Plan 只发送
  if (planMode === 'send-only') {
    if (actualMode === 'send-only') return scenarioB1(event);  // ⭐ 1+N 事件
    if (actualMode === 'bidirectional') return scenarioB2(event);  // 2 个独立事件
  }
  
  // 场景 C: Plan 双向
  if (planMode === 'bidirectional') {
    if (actualMode === 'send-only') return scenarioC1(event);  // 2 个独立事件
    if (actualMode === 'bidirectional') return scenarioC2(event);  // 2 个独立事件
  }
  
  throw new Error('未知的同步模式组合');
}

/**
 * 场景 A1 的具体实现（多事件同步）
 * 
 * @description Plan 只接收 + Actual 只发送，Plan 1个 + 每个子事件创建独立的远程事件
 */
function scenarioA1(event: Event): MergedSyncConfig {
  return {
    mergedMode: 'plan-receive-actual-send-multi-events',
    remoteEventCount: 1 + (event.childEvents?.length || 0),  // ⭐ Plan 1个 + Actual N个子事件
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
    remoteEventCount: 1 + actualUniqueCalendars.length,  // ⭐ Plan 1个 + Actual N个（每个日历1个）
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

// ============================================================
// 5. Private Mode 同步处理（仅自己）
// ============================================================

/**
 * 检查是否为 Private 模式
 */
export function isPrivateMode(mode: PlanSyncMode | ActualSyncMode | undefined): boolean {
  return mode === 'send-only-private' || mode === 'bidirectional-private';
}

/**
 * 格式化参与者列表到 description（Private 模式专用）
 * 
 * @example
 * participants: ['alice@company.com', 'bob@company.com']
 * originalDescription: '讨论项目进展'
 * 
 * 返回:
 * ```
 * 📧 参与者：alice@company.com, bob@company.com
 * 
 * 讨论项目进展
 * ```
 */
export function formatParticipantsToDescription(
  participants: string[] | undefined,
  originalDescription?: string
): string {
  if (!participants || participants.length === 0) {
    return originalDescription || '';
  }
  
  const participantsText = `📧 参与者：${participants.join(', ')}`;
  
  return originalDescription 
    ? `${participantsText}\n\n${originalDescription}`
    : participantsText;
}

/**
 * 从 description 中提取参与者列表（接收 Private 模式的远程事件时）
 * 
 * @example
 * description: '📧 参与者：alice@company.com, bob@company.com\n\n讨论项目进展'
 * 
 * 返回:
 * {
 *   participants: ['alice@company.com', 'bob@company.com'],
 *   cleanedDescription: '讨论项目进展'
 * }
 */
export function extractParticipantsFromDescription(description?: string): {
  participants: string[];
  cleanedDescription: string;
} {
  if (!description) {
    return { participants: [], cleanedDescription: '' };
  }
  
  const participantsRegex = /^📧 参与者：(.+)$/m;
  const match = description.match(participantsRegex);
  
  if (!match) {
    return { participants: [], cleanedDescription: description };
  }
  
  const participants = match[1].split(',').map(p => p.trim());
  const cleanedDescription = description
    .replace(participantsRegex, '')
    .replace(/^\n+/, '')  // 移除开头的空行
    .trim();
  
  return { participants, cleanedDescription };
}

/**
 * 同步到远程日历（支持 Private 模式）
 * 
 * @param event - 要同步的事件
 * @param syncMode - 同步模式（支持 private 变体）
 * @param calendarId - 目标日历 ID
 * 
 * @example
 * // 普通模式：邀请所有参与者
 * syncToRemoteCalendar(event, 'send-only', 'outlook-work');
 * // Remote: attendees = ['alice@company.com', 'bob@company.com']
 * 
 * // Private 模式：不邀请参与者，participants 作为文本添加到 description
 * syncToRemoteCalendar(event, 'send-only-private', 'outlook-work');
 * // Remote: attendees = [], description = '📧 参与者：alice@company.com, bob@company.com\n\n讨论项目进展'
 */
export function syncToRemoteCalendar(
  event: Event,
  syncMode: PlanSyncMode | ActualSyncMode,
  calendarId: string,
  syncType: 'plan' | 'actual' = 'plan'  // ⭐ 新增：指定是 Plan 还是 Actual 同步
): void {
  const isPrivate = isPrivateMode(syncMode);
  
  // ⭐ 根据同步类型选择对应的远程事件 ID
  const remoteEventId = syncType === 'plan' 
    ? event.syncedPlanEventId 
    : event.syncedActualEventId;
  
  const remoteEvent = {
    id: remoteEventId || generateRemoteEventId(event.id, syncType),
    title: syncType === 'actual' ? `${event.title} - 实际进展` : event.title,
    start: event.startTime,
    end: event.endTime,
    
    // 🔑 Private 模式处理
    description: isPrivate 
      ? formatParticipantsToDescription(event.participants, event.description)
      : event.description,
    
    attendees: isPrivate ? [] : (event.participants || []),
    
    // 扩展属性（用于识别 ReMarkable 创建的事件）
    extendedProperties: {
      remarkableEventId: event.id,
      remarkableType: syncType === 'plan' ? 'plan-event' : 'actual-event',  // ⭐ 明确标记类型
      remarkableParentId: event.parentEventId,
      remarkableSubEventId: event.id,
      remarkableIsPrivate: isPrivate
    }
  };
  
  // 发送到远程日历（Outlook/Google/iCloud）
  const updatedRemoteEventId = OutlookCalendarService.createOrUpdateEvent(calendarId, remoteEvent);
  
  // ⭐ 更新本地事件的远程事件 ID
  if (syncType === 'plan') {
    event.syncedPlanEventId = updatedRemoteEventId;
  } else {
    event.syncedActualEventId = updatedRemoteEventId;
  }
}

/**
 * 从远程事件接收并更新本地事件（支持 Private 模式）
 * 
 * @param remoteEvent - 远程事件
 * @param localEvent - 本地事件
 * @param syncMode - 同步模式
 */
export function receiveFromRemoteCalendar(
  remoteEvent: RemoteEvent,
  localEvent: Event,
  syncMode: PlanSyncMode | ActualSyncMode
): Partial<Event> {
  const isPrivate = isPrivateMode(syncMode);
  
  if (isPrivate || remoteEvent.extendedProperties?.remarkableIsPrivate) {
    // Private 模式：从 description 提取 participants
    const { participants, cleanedDescription } = extractParticipantsFromDescription(
      remoteEvent.description
    );
    
    return {
      title: remoteEvent.title,
      startTime: remoteEvent.start,
      endTime: remoteEvent.end,
      description: cleanedDescription,
      participants: participants.length > 0 ? participants : localEvent.participants
    };
  } else {
    // 普通模式：直接使用 attendees
    return {
      title: remoteEvent.title,
      startTime: remoteEvent.start,
      endTime: remoteEvent.end,
      description: remoteEvent.description,
      participants: remoteEvent.attendees?.map(a => a.email)
    };
  }
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

## 🔐 Private 模式（仅自己）- 使用场景

### 为什么需要 Private 模式？

**问题场景**:
1. 🔴 **频繁同步打扰参与者**: 用户每次计时（Timer）或记录笔记（TimeLog）都会创建新的 Outlook 事件，如果邀请了参与者，会给他们发送大量通知邮件
2. 🔴 **日程草稿阶段**: 用户创建会议日程但还未确定参与者，暂时不想发送邀请
3. 🔴 **个人工作记录**: 用户记录自己的工作进展，参与者信息只是备忘，不需要实际邀请

**解决方案**: 使用 `send-only-private` 或 `bidirectional-private` 模式

---

### 场景 1: Actual 子事件使用 Private 模式（推荐）

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  actualCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'receive-only' },
  actualSyncConfig: { mode: 'send-only-private' }  // ⭐ Private 模式
}
```

**典型用例**: 接收外部会议邀请，记录自己的工作进展，但不打扰参与者

**步骤 1: 接收外部会议（带参与者）**
```
Outlook "工作" 日历
  └─ 📅 "产品评审会" (9:00-10:00)
      └─ 参与者: Alice, Bob, Charlie
      
      ↓ 📥 接收
      
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      ├─ Plan: 9:00-10:00 (只读)
      ├─ participants: ['alice@company.com', 'bob@company.com', 'charlie@company.com']
      └─ Actual: 空
```

**步骤 2: 用户计时（Private 模式）**
```
用户操作: 点击 Timer → 9:05-9:45
ReMarkable 本地
  └─ Event #1234 (ParentEvent)
      └─ Actual:
          └─ Timer 子事件 #1234-timer-1 (9:05-9:45)
              └─ 📤 发送到 Outlook (Private 模式)

Outlook "工作" 日历（新增事件）
  ├─ 📅 "产品评审会" (9:00-10:00, 原始会议)
  │   └─ 参与者: Alice, Bob, Charlie ✅
  └─ 📅 "产品评审会 - 实际进展 1" (9:05-9:45) ← 新创建
      ├─ 参与者: 无 ❌（不发送邀请）
      └─ 描述:
          📧 参与者：alice@company.com, bob@company.com, charlie@company.com
          
          讨论了新功能需求
```

**关键效果**:
- ✅ Alice, Bob, Charlie **不会收到**计时事件的邀请通知
- ✅ 用户在 Outlook 中仍能看到参与者信息（在 description 中）
- ✅ 避免频繁同步打扰团队成员

---

### 场景 2: Plan 使用 Private 模式（日程草稿）

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'send-only-private' },  // ⭐ Private 模式
  actualCalendarIds: ['outlook-calendar-work'],
  actualSyncConfig: { mode: 'send-only-private' }
}
```

**典型用例**: 用户创建会议日程但还未确定，暂时不发送邀请

**步骤 1: 用户在 ReMarkable 创建日程（含参与者）**
```
ReMarkable 本地
  └─ Event #5678 (新创建)
      ├─ title: "技术分享会"
      ├─ startTime: 9:00-10:00
      ├─ participants: ['alice@company.com', 'bob@company.com']
      └─ planSyncConfig: { mode: 'send-only-private' }
      
      📤 发送到 Outlook (Private 模式)

Outlook "工作" 日历（新增事件）
  └─ 📅 "技术分享会" (9:00-10:00)
      ├─ 参与者: 无 ❌（不发送邀请）
      └─ 描述:
          📧 参与者：alice@company.com, bob@company.com
          
          讨论下一代架构设计
```

**步骤 2: 用户确认后切换为普通模式**
```
用户操作: 确定参与者后，切换 planSyncConfig.mode = 'send-only'
ReMarkable 本地
  └─ Event #5678
      └─ planSyncConfig: { mode: 'send-only' }  // ⭐ 切换为普通模式
      
      📤 更新 Outlook 事件

Outlook "工作" 日历（更新事件）
  └─ 📅 "技术分享会" (9:00-10:00)
      ├─ 参与者: Alice, Bob ✅（现在发送邀请）
      └─ 描述: "讨论下一代架构设计"
      
Alice 和 Bob 收到会议邀请 ✉️
```

---

### 场景 3: Bidirectional-Private（双向同步但不邀请参与者）

**用户配置**:
```typescript
{
  plannedCalendarIds: ['outlook-calendar-work'],
  planSyncConfig: { mode: 'bidirectional-private' },  // ⭐ 双向但 Private
  actualCalendarIds: [],
  actualSyncConfig: null
}
```

**典型用例**: 用户在 ReMarkable 和 Outlook 之间同步日程，但不想打扰参与者

**步骤 1: 用户在 ReMarkable 创建日程**
```
ReMarkable 本地
  └─ Event #7890
      ├─ title: "客户电话会议"
      ├─ participants: ['client@external.com']
      └─ planSyncConfig: { mode: 'bidirectional-private' }
      
      📤 发送到 Outlook

Outlook "工作" 日历
  └─ 📅 "客户电话会议" (14:00-15:00)
      ├─ 参与者: 无 ❌
      └─ 描述: "📧 参与者：client@external.com"
```

**步骤 2: 用户在 Outlook 修改时间**
```
Outlook "工作" 日历
  └─ 📅 "客户电话会议" (15:00-16:00) ← 修改时间
      
      ↓ 📥 同步回 ReMarkable

ReMarkable 本地
  └─ Event #7890
      ├─ startTime: 15:00-16:00 ✅ 更新
      └─ participants: ['client@external.com'] ✅ 保持不变
```

**步骤 3: 用户在 Outlook 修改 description（添加参与者）**
```
Outlook "工作" 日历
  └─ 📅 "客户电话会议" (15:00-16:00)
      └─ 描述:
          📧 参与者：client@external.com, manager@company.com ← 手动添加
          
      ↓ 📥 同步回 ReMarkable

ReMarkable 本地
  └─ Event #7890
      └─ participants: ['client@external.com', 'manager@company.com'] ✅ 更新
```

---

### Private 模式对比

| 模式 | Plan | Actual | Remote 参与者 | 典型用例 |
|------|------|--------|---------------|----------|
| **普通 send-only** | 发送 | - | ✅ 邀请所有人 | 正式会议邀请 |
| **send-only-private** | 发送 | - | ❌ 不邀请，作为文本 | 日程草稿、个人记录 |
| **普通 bidirectional** | 双向 | - | ✅ 邀请所有人 | 正式会议，需双向同步 |
| **bidirectional-private** | 双向 | - | ❌ 不邀请，作为文本 | 个人日程，需双向同步但不打扰人 |
| **A1 + Actual Private** | 接收 | Private 发送 | ❌ 子事件不邀请 | 接收外部会议 + 记录进展（不打扰团队） |

---

### UI 实现建议

```typescript
// SyncModeSelector.tsx
function SyncModeSelector({ mode, onChange, type }: SyncModeSelectorProps) {
  const options: Array<{ value: PlanSyncMode | ActualSyncMode; label: string; icon: string }> = 
    type === 'plan' ? [
      { value: 'receive-only', label: '只接收', icon: '📥' },
      { value: 'send-only', label: '只发送（全部参会人）', icon: '📤' },
      { value: 'send-only-private', label: '只发送（仅自己）', icon: '📤🔒' },
      { value: 'bidirectional', label: '双向同步（全部参会人）', icon: '🔄' },
      { value: 'bidirectional-private', label: '双向同步（仅自己）', icon: '🔄🔒' }
    ] : [
      { value: 'send-only', label: '只发送（全部参会人）', icon: '📤' },
      { value: 'send-only-private', label: '只发送（仅自己）', icon: '📤🔒' },
      { value: 'bidirectional', label: '双向同步（全部参会人）', icon: '🔄' },
      { value: 'bidirectional-private', label: '双向同步（仅自己）', icon: '🔄🔒' }
    ];

  return (
    <Select value={mode} onChange={e => onChange(e.target.value)}>
      {options.map(opt => (
        <MenuItem key={opt.value} value={opt.value}>
          <Box display="flex" alignItems="center" gap={1}>
            <span>{opt.icon}</span>
            <span>{opt.label}</span>
          </Box>
        </MenuItem>
      ))}
    </Select>
  );
}
```

---

## 📝 下一步行动

1. ✅ **数据模型已定义** - 基于 9 种相同日历场景 + 不同日历场景 + Private 模式
2. ✅ **Private 模式函数已定义** - `formatParticipantsToDescription()`, `extractParticipantsFromDescription()`, `syncToRemoteCalendar()`
3. ⏳ **实现工具函数** - `getMergedSyncConfig()`, `mergeActualSegments()` 等
4. ⏳ **UI 组件开发** - CalendarSelector, SyncModeSelector (支持 Private 选项), 冲突警告
5. ⏳ **同步服务适配** - ActionBasedSyncManager 增加 Private 模式支持、冲突检测和多日历支持
6. ⏳ **测试** - 覆盖所有 9 种场景 + 多日历场景 + Private 模式场景

**需要确认的问题**:
1. ✅ 相同日历的 9 种场景是否符合预期？
2. ✅ Actual 支持多日历是否满足需求？
3. ✅ Private 模式是否满足需求？
4. ❓ 是否需要在 UI 层禁止某些冲突配置（如 A3, B2, C3）？
