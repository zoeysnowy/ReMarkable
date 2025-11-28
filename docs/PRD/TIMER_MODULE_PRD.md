# ReMarkable Timer 模块产品需求文档 (PRD)

> **AI 生成时间**: 2025-11-05  
> **最后更新**: 2025-11-16  
> **关联代码版本**: v1.8.0  
> **文档类型**: 功能模块 PRD  
> **依赖模块**: 同步机制, TagService, EventService  
> **关联文档**: [同步机制 PRD](../architecture/SYNC_MECHANISM_PRD.md), [App 架构 PRD](../architecture/APP_ARCHITECTURE_PRD.md), [Timer Bug 修复文档](../fixes/TIMER_EVENT_DUPLICATION_FIX.md)

> **🔥 v1.8.0 重大更新** (2025-11-16):
> - ✅ **零门槛启动**: 支持无标签、无标题启动 Timer（自动生成标题 "专注计时YYYY-MM-DD HH:mm:ss"）
> - ✅ **固定 eventId**: Timer 启动时立即生成固定 ID，避免重复事件（修复 6000+ 重复事件 Bug）
> - ✅ **统一生命周期**: START (local-only) → RUNNING (auto-save 30s) → STOP (pending)
> - ✅ **时间格式统一**: 所有时间使用 `formatTimeForStorage()`，禁用 `toISOString()`
> - ✅ **集中式管理**: 所有组件统一使用 `App.tsx` 的 Timer 函数（handleTimerStart/Stop/Pause/Resume/Cancel）
> 
> **💡 v1.7.2 更新**: 修复 Timer 创建时 startTime 计算问题（以点击确定时间为准）
> 
> **💡 v1.7.1 更新**: 完成旧计时器系统和死代码清理，App.tsx 状态从 21个减至 18个

---

## ⚠️ 时间字段规范（CRITICAL）

**严禁使用 ISO 8601 标准时间格式！**

所有时间字段必须使用 `timeUtils.ts` 中的工具函数处理：
- ✅ **存储时间**: `formatTimeForStorage(date)` → `"YYYY-MM-DD HH:mm:ss"`（空格分隔，本地时间）
- ✅ **解析时间**: `parseLocalTimeString(timeString)` → `Date` 对象
- ❌ **禁止**: `new Date().toISOString()` - 会转为 UTC 时间
- ❌ **禁止**: `toLocaleString()` - 格式不一致
- ❌ **禁止**: 时间字符串包含 `Z` 后缀、`T` 分隔符或 `+08:00` 等时区标记

**原因**: 
1. ISO 格式会导致时区转换（18:06 → 10:06 UTC）
2. 数据同步到 Outlook 会被误认为 UTC 时间，造成 8 小时偏移
3. localStorage 中的所有事件必须使用统一的本地时间格式

**参考文件**: 
- `src/utils/timeUtils.ts` - 时间工具函数
- `docs/TIME_ARCHITECTURE.md` - 时间架构文档
- `docs/fixes/TIMER_EVENT_DUPLICATION_FIX.md` - Timer Bug 修复案例

---

## 📋 目录

1. [模块概述](#1-模块概述)
2. [用户场景](#2-用户场景)
3. [功能架构](#3-功能架构)
4. [状态管理](#4-状态管理)
5. [生命周期](#5-生命周期)
6. [UI 交互](#6-ui-交互)
7. [同步集成](#7-同步集成)
8. [数据持久化](#8-数据持久化)

---

## 1. 模块概述

### 1.1 核心目标

Timer 模块是 ReMarkable 的核心功能之一，为用户提供**自主时间记录**能力：
- ✅ 帮助用户追踪任务的实际耗时，**不打断心流状态**
- ✅ 自动创建时间事件，无需手动记录
- ✅ 支持暂停/恢复/取消，灵活应对工作中断
- ✅ 与标签系统深度集成，实现分类计时
- ✅ **无定时提醒、无强制休息**，用户完全自主决定计时节奏
- ✅ **时间即索引，事件即容器**：支持在计时事件中记录详细日志、会议纪要、资料收集等

### 1.2 核心价值

| 用户价值 | 实现方式 | 业务价值 |
|---------|---------|---------|
| **无感记录** | 自动保存为日历事件 | 提升数据完整性 |
| **自主掌控** | 用户完全控制开始/停止时机，无提醒打断 | 尊重心流状态 |
| **灵活调整** | 支持修改开始时间、标题、标签 | 适应真实工作场景 |
| **持久化** | localStorage + Widget 读取 | 跨窗口状态同步 |
| **可视化** | 实时时长显示 + 脉冲动效 | 轻量级反馈，不干扰专注 |
| **日志容器** | 事件 description 字段承载会议纪要、资料收集等内容 | 时间轴即信息检索入口 |
| **跨平台同步** | description 内容同步到 Outlook | 信息不受设备限制 |

### 1.3 设计理念

**"开始即创建，停止即同步"**

```mermaid
graph LR
    A[用户点击开始] --> B[创建 local-only 事件]
    B --> C[每 30 秒保存进度]
    C --> D{用户操作?}
    D -->|停止| E[转为 pending 状态]
    D -->|取消| F[删除事件]
    D -->|继续计时| C
    E --> G[5秒后同步到 Outlook]
    F --> H[不同步]
```

### 1.4 独立 Timer 二次计时自动升级机制

**触发条件**:
当用户对一个已完成的独立 Timer 事件再次启动计时时，系统会自动将其升级为父子结构。

**检测条件**:
```typescript
// 满足以下所有条件时触发自动升级
event.isTimer === true &&        // 是 Timer 事件
event.parentEventId == null &&   // 无父事件（独立 Timer）
event.timerLogs &&               // 已有计时记录
event.timerLogs.length > 0       // 至少完成一次计时
```

**升级流程**:
```mermaid
graph TB
    A[用户对独立 Timer 再次启动计时] --> B{检测是否满足升级条件}
    B -->|是| C[Step 1: 创建父事件]
    B -->|否| Z[直接启动 Timer]
    C --> D[Step 2: 将原 Timer 转为子事件]
    D --> E[Step 3: 保存父事件]
    E --> F[Step 4: 为父事件启动新 Timer]
    F --> G[Step 5: 新 Timer 成为第二个子事件]
    G --> H[用户无感知，计时继续]
```

**数据示例**:
```typescript
// === 升级前 ===
const timerBefore = {
  id: 'timer-1',
  title: '学习英语',
  isTimer: true,
  parentEventId: null,  // 独立 Timer
  timerLogs: ['timer-1'] // 已完成一次计时
};

// === 升级后 ===
const parentEvent = {
  id: 'parent-1732000000000',
  title: '学习英语',         // 继承原 Timer 标题
  isTimer: false,           // 父事件不是 Timer
  isTimeCalendar: true,     // 标记为 TimeCalendar 创建
  timerLogs: ['timer-1', 'timer-2'] // 包含所有子 Timer
};

const timer1Updated = {
  id: 'timer-1',
  title: '学习英语',
  isTimer: true,
  parentEventId: 'parent-1732000000000', // ✅ 已挂载到父事件
  timerLogs: ['timer-1']
};

const timer2New = {
  id: 'timer-2',
  title: '学习英语',
  isTimer: true,
  parentEventId: 'parent-1732000000000', // ✅ 挂载到父事件
  timerLogs: ['timer-2']
};
```

**继承的元数据**:
父事件会继承原 Timer 的所有元数据，确保用户视角的一致性：
- ✅ 标题 (title, simpleTitle, fullTitle)
- ✅ 描述 (description)
- ✅ Emoji
- ✅ 标签 (tags[])
- ✅ 颜色 (color)
- ✅ 日历分组 (calendarIds)
- ✅ 位置 (location)
- ✅ 组织者/参会人 (organizer, attendees)
- ✅ 备注和优先级 (notes, priority)
- ✅ 日志内容 (eventlog)

**用户体验保证**:
- ✅ **完全无感知**: 用户只看到计时继续，不知道发生了升级
- ✅ **数据完整**: 所有元数据（标题、标签、emoji、描述）完整保留
- ✅ **视图一致**: EventEditModal 自动显示父事件，汇总所有计时
- ✅ **可追溯**: TimeCalendar 上显示父事件 + 所有子事件色块

**实现位置**: `App.tsx` → `handleTimerStart()` 函数

---

### 1.5 实时刷新机制（v2.15 架构改进）

**问题背景**:
停止计时后，如果 EventEditModal 正在显示该事件（或其父事件），Modal 的实际进展区域应该**立即显示**新的 timerLog，而不需要用户关闭再打开。

**EventHub 架构原则**:

EventService 采用 **EventHub 架构**，通过 BroadcastChannel 实现跨标签页同步，同时避免同标签页内的循环更新：

```typescript
// EventService.ts - 防循环机制
broadcastChannel.onmessage = (event) => {
  const { senderId, eventId, type } = event.data;
  
  if (senderId === tabId) {
    // ✅ 忽略自己的广播消息（防止循环）
    eventLogger.log('🔄 [EventService] 忽略自己的广播消息');
    return;
  }
  
  // 处理其他标签页的更新
  window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { eventId } }));
};

// 同标签页的更新：直接触发事件（不经过 BroadcastChannel）
this.dispatchEventUpdate(eventId, { isUpdate: true });
// ↓
window.dispatchEvent(new CustomEvent('eventsUpdated', { detail: { eventId } }));
```

**架构原则**:
1. **单一数据源（SSOT）**: EventService 是数据的唯一真实来源
2. **主动读取**: 组件应该主动从 EventService 读取最新数据，而不是被动等待事件通知
3. **防循环机制**: 同标签页内，BroadcastChannel 的消息会被忽略（`senderId === tabId`）
4. **自己负责渲染**: 更新数据的模块应该自己负责 UI 刷新，不依赖广播回调

**EventEditModalV2 的实现**:

```typescript
// ✅ 关键修复：每次都从 EventService 重新读取最新数据
const childEvents = React.useMemo(() => {
  if (!event?.id) return [];
  
  // 🆕 从 EventService 重新读取当前事件的最新数据
  const latestEvent = EventService.getEventById(event.id);
  if (!latestEvent) return [];
  
  // 情况 1: 当前是子事件 → 读取父事件的最新 timerLogs
  if (latestEvent.parentEventId) {
    const latestParent = EventService.getEventById(latestEvent.parentEventId);
    if (!latestParent) return [];
    
    const timerLogs = latestParent.timerLogs || [];
    return timerLogs
      .map(childId => EventService.getEventById(childId))
      .filter(e => e !== null) as Event[];
  }
  
  // 情况 2: 当前是父事件 → 读取自己的最新 timerLogs
  const timerLogs = latestEvent.timerLogs || [];
  return timerLogs
    .map(childId => EventService.getEventById(childId))
    .filter(e => e !== null) as Event[];
}, [event?.id, refreshCounter]); // ✅ 简化依赖：不再依赖过时的 prop

// 监听同标签页和跨标签页的事件更新
React.useEffect(() => {
  const handleEventsUpdated = (e: any) => {
    const updatedEventId = e.detail?.eventId || e.detail;
    
    if (updatedEventId === event?.id || updatedEventId === event?.parentEventId) {
      setRefreshCounter(prev => prev + 1); // 触发 useMemo 重新执行
    }
  };
  
  window.addEventListener('eventsUpdated', handleEventsUpdated);
  return () => window.removeEventListener('eventsUpdated', handleEventsUpdated);
}, [event?.id, event?.parentEventId]);
```

**数据流**:
```
App.tsx 停止计时
  ↓
EventService.updateEvent(parentId, { timerLogs: [..., newTimerId] })
  ↓
localStorage 保存成功
  ↓
dispatchEventUpdate(parentId) → window.dispatchEvent('eventsUpdated')
  ↓
EventEditModalV2 监听到事件 → setRefreshCounter(+1)
  ↓
childEvents useMemo 重新执行
  ↓
EventService.getEventById(parentId) → 读取最新 timerLogs ✅
  ↓
渲染新的 timerLog 列表 ✅
```

**关键改进**:
- ❌ **修复前**: 依赖过时的 `event.timerLogs` prop，停止计时后不刷新
- ✅ **修复后**: 主动从 EventService 读取最新数据，立即刷新
- ✅ **架构正确**: 遵循 EventHub 的 SSOT 原则，不依赖广播回调

---

## 2. 用户场景

### 2.1 典型用户故事

#### 故事 1: 自主专注计时

> **作为** 需要记录工作时间的知识工作者  
> **我希望** 能够自由地开始和结束计时  
> **以便** 追踪我的实际专注时长，并在日历中回顾我的时间分布

**流程**:
1. 打开 ReMarkable 首页
2. 点击 TimerCard 的"开始"按钮
3. 选择标签"#工作/#产品设计"
4. 输入任务标题"设计用户流程图"
5. 开始计时，进入心流状态
6. 当任务完成或需要休息时，点击"停止"
7. 自动创建日历事件，同步到 Outlook

**设计理念**: 
- ✅ **不打断用户**: 没有任何定时提醒或强制休息通知
- ✅ **尊重心流**: 让用户自己决定何时开始、何时停止
- ✅ **无感记录**: 专注时不需要关注时间，停止时自动生成完整记录

#### 故事 2: 需要中断的任务

> **作为** 需要处理临时事务的工作者  
> **我希望** 能够暂停/恢复计时  
> **以便** 准确记录实际专注时长，排除中断时间

**流程**:
1. 开始计时"#开发/#Bug修复"
2. 10 分钟后收到会议通知或需要处理临时任务
3. 点击"暂停"，离开当前任务
4. 处理完临时事务后，点击"继续"
5. 再工作 15 分钟后，感觉任务告一段落，点击"停止"
6. 最终事件显示"专注 25 分钟"（自动排除了中断时间）

**设计理念**: 
- ✅ **真实反映专注时长**: 只记录用户实际工作的时间
- ✅ **无心理负担**: 暂停/继续随时可用，不会影响记录完整性

#### 故事 3: 需要调整开始时间

> **作为** 沉浸在工作中忘记开启计时的用户  
> **我希望** 能够回溯开始时间  
> **以便** 准确记录真实的任务时长

**流程**:
1. 9:00 开始工作，完全沉浸在任务中，忘记开 Timer
2. 9:30 想起来要记录时间，点击"开始"
3. 点击"开始时间 09:30"，弹出编辑框
4. 修改为 9:00（回溯真实开始时间）
5. Timer 显示已经运行 30 分钟
6. 继续工作直到任务完成...

**设计理念**: 
- ✅ **弥补遗忘**: 沉浸工作时忘记开 Timer 是正常的，允许事后补救
- ✅ **数据准确**: 回溯功能确保时间记录反映真实情况
- ✅ **无惩罚机制**: 忘记开 Timer 不会损失任何数据

#### 故事 4: 随手记录日志

> **作为** 需要记录会议纪要、资料收集等碎片信息的用户  
> **我希望** 能够在计时的同时记录详细内容  
> **以便** 所有信息都按时间自动归档，无需额外思考"记在哪里"

**场景 A - 会议纪要记录**:
1. 日历中已有下午 2:00 的"产品评审会议"事件
2. 会议开始时，打开 TimeCalendar 的该事件
3. 点击编辑，在 description 字段直接输入会议纪要：
   ```
   参会人员：张三、李四、王五
   讨论要点：
   1. 新功能 A 的技术方案确认
   2. UI 设计稿第二版反馈
   3. 下周发布时间表
   
   待办事项：
   - @张三 完成技术文档
   - @李四 修改设计稿
   ```
4. 保存后自动同步到 Outlook
5. **价值体现**: 
   - ✅ 再也不需要回忆"某个会议在什么时间开"
   - ✅ 会议纪要不会散落在不同的笔记本中
   - ✅ 时间、地点、人物已经在日程中，纪要只需记录内容本身

**场景 B - 资料收集归档**:
1. 周二上午 10:00 开始搜集竞品分析资料
2. 点击 Timer 开始计时"#工作/#竞品分析"
3. 边搜索边在 description 中粘贴：
   ```
   竞品 A：https://example.com/product-a
   - 核心功能：XXX
   - 定价策略：$99/月
   - 用户评价：4.5星
   
   竞品 B：https://example.com/product-b
   - 核心功能：YYY
   - 截图：[图片链接]
   ```
4. 搜集完成后停止 Timer
5. **价值体现**: 
   - ✅ 不需要思考"这些资料记在哪个笔记上"
   - ✅ 通过时间轴快速定位："上周二我搜了什么资料"
   - ✅ 资料与计时自动关联，清晰记录任务投入时长

**场景 C - 实时想法捕捉**:
1. Timer 正在运行"#写作/#博客文章"
2. 写作过程中突然有灵感或需要记录的想法
3. 不停止 Timer，直接点击编辑按钮
4. 在 description 中追加内容：
   ```
   11:30 - 想到一个更好的开头
   11:45 - 需要补充的数据来源：[链接]
   12:00 - 文章结构调整：先讲案例再讲原理
   ```
5. 继续计时，所有想法都实时追加到同一个事件中

**设计理念**: 
- ✅ **时间即索引**: 用户不需要思考"记在哪里"，时间轴就是天然的索引
- ✅ **事件即容器**: 每个事件都是一个信息容器，承载时长、标签、内容、附件
- ✅ **无缝同步**: description 内容自动同步到 Outlook，跨设备可访问
- ✅ **未来扩展**: 当前支持纯文本，未来升级为富文本"日志"：
  - 支持 Markdown 格式
  - 支持图片、附件上传
  - 支持语音记录
  - 与 Outlook description 字段的富文本互通（需考虑格式兼容性）

**技术挑战** (未来考虑):
- 📝 **富文本同步**: Outlook 的 description 字段支持 HTML，但需要处理：
  - 本地富文本 → HTML 的转换
  - 图片/附件的云端存储与引用
  - 不同客户端（Outlook Web/Desktop/Mobile）的显示一致性
- 📝 **大文本性能**: description 可能包含大量内容，需要优化：
  - 分页加载或懒加载
  - 搜索性能优化
  - 同步时的差异检测（避免全量上传）

#### 故事 5: 零门槛启动计时 (v1.8.0 新增)

> **作为** 想要快速开始专注的用户  
> **我希望** 能够无需选择标签、无需输入标题，直接开始计时  
> **以便** 降低启动门槛，专注进入心流状态

**流程**:
1. 打开 ReMarkable 首页
2. 点击 TimerCard 的"开始"按钮
3. **直接点击"开始"，无需选择标签或输入标题**
4. Timer 立即开始运行，显示默认 emoji ⏱️
5. 工作完成后点击"停止"
6. 自动创建日历事件，标题为 "专注计时2025-11-16 13:35:44"（自动生成）
7. 标签为空，可事后补充

**设计理念**: 
- ✅ **零门槛启动**: 任何时候想专注都可以立即开始，无需思考"该打什么标签"
- ✅ **自动命名**: 系统自动生成时间戳标题，确保事件可识别
- ✅ **事后补充**: 用户可在事件创建后补充标签、标题、描述等元数据
- ✅ **降低心理负担**: 不强制用户提前规划，支持"先做后整理"的工作方式

**实现细节**:
```typescript
// handleTimerStart 支持空标签和空标题
const handleTimerStart = (tagIds?: string | string[], parentEventId?: string) => {
  const tagIdArray = tagIds ? (Array.isArray(tagIds) ? tagIds : [tagIds]) : [];  // 可为空数组
  const startTime = Date.now();
  
  const initialEvent: Event = {
    id: `timer-${tagIdArray[0] || 'notag'}-${startTime}`,
    title: '计时中的事件',  // 临时标题
    tags: tagIdArray,  // 可为空数组
    // ...
  };
  EventService.createEvent(initialEvent, true);
};

// handleTimerStop 自动生成标题
const handleTimerStop = async () => {
  const hasUserTitle = globalTimer.eventTitle && globalTimer.eventTitle.trim();
  const hasUserTags = globalTimer.tagIds && globalTimer.tagIds.length > 0;
  
  if (!hasUserTitle && !hasUserTags) {
    // 无标题且无标签 → 自动生成标题
    const timeStr = formatTimeForStorage(startTime);  // "2025-11-16 13:35:44"
    eventTitle = `专注计时${timeStr}`;
  }
  
  const finalEvent: Event = {
    id: timerEventId,
    title: eventTitle,  // 自动生成或用户输入
    syncStatus: 'pending',  // 触发同步
    // ...
  };
  EventService.updateEvent(timerEventId, finalEvent);
};
```

**用户价值**:
- 💡 **快速进入心流**: 不被标签选择打断思路
- 💡 **减少决策疲劳**: 无需提前思考"这算什么任务"
- 💡 **灵活补充**: 事后可根据实际情况补充元数据
- 💡 **适应不同工作风格**: 既支持预先规划（选标签+写标题），也支持即兴专注（直接开始）

---

## 3. 功能架构

### 3.1 组件结构

```mermaid
graph TB
    subgraph "UI Layer"
        A[TimerCard.tsx]
        B[EventEditModal.tsx]
    end
    
    subgraph "Logic Layer - App.tsx"
        C[globalTimer State]
        D[handleTimerStart]
        E[handleTimerPause]
        F[handleTimerResume]
        G[handleTimerStop]
        H[handleTimerCancel]
        I[handleTimerEdit]
        J[handleStartTimeChange]
    end
    
    subgraph "Service Layer"
        K[EventService]
        L[TagService]
    end
    
    subgraph "Storage Layer"
        M[localStorage events]
        N[localStorage timer state]
    end
    
    A --> C
    A --> D
    A --> E
    A --> F
    A --> G
    A --> H
    A --> I
    A --> J
    
    B --> I
    
    D --> K
    G --> K
    H --> K
    
    D --> L
    
    K --> M
    C --> N
    
    style C fill:#ff9,stroke:#f66,stroke-width:3px
```

### 3.2 文件清单

| 文件路径 | 职责 | 代码行数 |
|---------|------|---------|
| `src/components/TimerCard.tsx` | Timer UI 组件 | 244 行 |
| `src/components/EventEditModal.tsx` | 事件编辑模态框 | ~800 行 |
| `src/App.tsx` (Timer 部分) | Timer 逻辑控制 | ~600 行 |
| `src/services/EventService.ts` | 事件 CRUD 入口 | ~200 行 |
| `src/services/TagService.ts` | 标签管理服务 | ~300 行 |

---

## 4. 状态管理

### 4.1 全局单 Timer 架构（v1.8.0）

**核心理念**: 同一时间只允许一个 Timer 运行，保证用户专注

**架构说明**:
- ✅ **单一 `globalTimer` 对象** - 简化状态管理，避免多 Timer 冲突
- ✅ Timer 状态独立于 UI 组件（Modal 关闭不影响 Timer）
- ✅ 所有组件通过 `App.tsx` 统一管理 Timer（集中式控制）
- ✅ 跨窗口同步：localStorage 持久化 + Widget 读取

**为什么选择单 Timer**:
1. **用户心流保护**: 同时运行多个 Timer 会分散注意力，违反专注原则
2. **状态明确**: 单一活跃 Timer 让用户清楚"当前在做什么"
3. **实现简单**: 避免多 Timer 间的冲突和复杂的优先级管理

### 4.2 TimerState 数据结构

**代码位置**: `src/App.tsx` L147-161

```typescript
interface TimerState {
  isRunning: boolean;          // 是否正在运行
  isPaused: boolean;           // 是否暂停
  tagId: string;               // 第一个标签 ID（向后兼容）
  tagIds: string[];            // 完整的标签数组（可能为空）✨ v1.8.0
  tagName: string;             // 标签名称（无标签时为"未分类"）
  tagEmoji?: string;           // 标签 emoji（无标签时为 ⏱️）
  tagColor?: string;           // 标签颜色（无标签时为灰色）
  startTime: number;           // 当前计时周期的开始时间戳（用于计算运行时长）
  originalStartTime: number;   // 用户设定的真实开始时间戳（可回溯修改）
  elapsedTime: number;         // 已累积的时长（毫秒），包含暂停前的时长
  eventEmoji?: string;         // 用户自定义事件 emoji（覆盖标签 emoji）
  eventTitle?: string;         // 用户自定义事件标题（覆盖标签名称）
  eventId: string;             // 固定事件 ID（整个计时过程不变）✨ v1.8.0
  parentEventId?: string;      // 关联的父事件 ID（可选）✨ v1.8.0
}
```

**v1.8.0 关键字段**:
- `eventId`: Timer 启动时立即生成（`timer-{tagId||'notag'}-{timestamp}`），运行过程中保持不变
- `tagIds`: 支持空数组（零门槛启动）
- `parentEventId`: 支持从现有事件启动 Timer（事件关联）

**存储位置**: 
- 内存: `useState<TimerState | null>(null)`
- 持久化: `localStorage['remarkable-global-timer']` - 跨窗口同步

### 4.3 状态转换图（v1.8.0 生命周期）

```mermaid
stateDiagram-v2
    [*] --> Idle: 应用启动
    Idle --> Creating: handleTimerStart()
    Creating --> Running: 立即创建 eventId + 初始事件
    Running --> Paused: handleTimerPause()
    Paused --> Running: handleTimerResume()
    Running --> Stopped: handleTimerStop()
    Paused --> Stopped: handleTimerStop()
    Running --> Cancelled: handleTimerCancel()
    Paused --> Cancelled: handleTimerCancel()
    Stopped --> Idle: 清除 globalTimer
    Cancelled --> Idle: 清除 globalTimer + 删除事件
    
    Idle: globalTimer = null
    Creating: 生成 eventId, 创建初始事件(local-only)
    Running: isRunning=true, isPaused=false, 每30s自动保存
    Paused: isRunning=false, isPaused=true
    Stopped: 更新事件(syncStatus=pending), 触发同步
    Cancelled: 删除事件(skipSync=true)
```

**关键生命周期阶段**:

1. **START (Creating → Running)**:
   ```tsx
   const eventId = `timer-${tagId||'notag'}-${Date.now()}`;  // 固定 ID
   const initialEvent = {
     id: eventId,
     syncStatus: 'local-only',  // 运行中不同步
     title: '计时中的事件',
     // ...
   };
   EventService.createEvent(initialEvent, true);  // 立即保存
   setGlobalTimer({ eventId, isRunning: true, ... });
   ```

2. **RUNNING (Auto-save every 30s)**:
   ```tsx
   useEffect(() => {
     const interval = setInterval(() => {
       // 更新同一个事件（使用固定 eventId）
       const timerEvent = {
         id: globalTimer.eventId,  // 不变
         syncStatus: 'local-only',  // 保持 local-only
         endTime: formatTimeForStorage(new Date()),  // 更新结束时间
       };
       // 静默保存，不触发 eventsUpdated
     }, 30000);
   }, [globalTimer]);
   ```

3. **STOP (Finalize & Sync)**:
   ```tsx
   const finalEvent = {
     id: globalTimer.eventId,  // 复用同一个 ID
     syncStatus: 'pending',  // 改为 pending，触发同步
     title: hasUserTitle ? userTitle : `专注计时${timeStr}`,  // 自动生成标题
     endTime: formatTimeForStorage(endTime),  // 最终时间
   };
   EventService.updateEvent(eventId, finalEvent);  // 同步到 Outlook
   setGlobalTimer(null);  // 清除状态
   ```

### 4.4 时长计算逻辑

**核心公式**: 

```typescript
// 运行中
if (globalTimer?.isRunning && !globalTimer.isPaused) {
  totalElapsed = globalTimer.elapsedTime + (Date.now() - globalTimer.startTime);
}

// 暂停时
if (globalTimer?.isPaused) {
  totalElapsed = globalTimer.elapsedTime;
}

// 格式化显示
const totalSeconds = Math.floor(totalElapsed / 1000);
const hours = Math.floor(totalSeconds / 3600);
const minutes = Math.floor((totalSeconds % 3600) / 60);
const seconds = totalSeconds % 60;
const display = hours > 0 
  ? `${hours}:${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`
  : `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
```

**字段含义**:
- `elapsedTime`: 之前所有计时周期累积的时长（包含暂停前的）
- `startTime`: 当前这轮计时的开始时间（每次恢复都会重置）
- `Date.now() - startTime`: 当前这轮运行的时长

**示例**:

| 操作 | elapsedTime | startTime | Date.now() | totalElapsed |
|------|------------|-----------|-----------|-------------|
| 开始计时 | 0 | 9:00:00 | 9:10:00 | 10 分钟 |
| 暂停 | 10 分钟 | - | - | 10 分钟 |
| 继续 | 10 分钟 | 9:15:00 | 9:25:00 | 20 分钟 |
| 再次暂停 | 20 分钟 | - | - | 20 分钟 |
| 继续 | 20 分钟 | 9:30:00 | 9:35:00 | 25 分钟 |
| 停止 | 25 分钟 | - | - | 25 分钟 |

---

## 5. 生命周期

### 5.1 启动流程 (handleTimerStart)

**代码位置**: `src/App.tsx` L322-345 + L667-736

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as TimerCard/Modal
    participant Logic as App.tsx
    participant Tag as TagService
    participant ES as EventService
    participant LS as localStorage
    participant Map as activeTimers Map
    
    User->>UI: 点击"开始计时"按钮
    UI->>Logic: 触发 onStart(eventId)
    Logic->>Logic: 打开 EventEditModal
    User->>Logic: 选择标签 + 输入标题
    Logic->>Tag: 查找标签信息
    Tag-->>Logic: 返回 tag 对象
    
    Logic->>Logic: 创建 TimerState
    Note over Logic: isRunning=true<br/>startTime=Date.now()<br/>elapsedTime=0
    
    Logic->>Map: activeTimers.set(eventId, timerState)
    Logic->>LS: 持久化 activeTimers
    
    Logic->>ES: createEvent(timerEvent, skipSync=true)
    Note over ES: syncStatus='local-only'
    ES->>LS: 保存事件到 localStorage
    
    ES-->>Logic: 返回成功
    Logic-->>UI: 更新 UI 显示（Timer 运行中）
    
    Note over UI: 用户可以关闭 Modal<br/>Timer 继续后台运行
```

**关键代码**:

```typescript
// App.tsx - 启动 Timer
const handleTimerStart = async (eventId: string, tagId: string, title: string) => {
  const tag = TagService.getFlatTags().find(t => t.id === tagId);
  
  const timerStartTime = Date.now();
  const realTimerEventId = eventId || `timer-${tagId}-${timerStartTime}`;
  
  // 创建 Timer 状态
  const newTimer: TimerState = {
    eventId: realTimerEventId,
    isRunning: true,
    isPaused: false,
    tagId,
    tagName: tag.name,
    tagEmoji: tag.emoji,
    tagColor: tag.color,
    startTime: timerStartTime,
    originalStartTime: timerStartTime,
    elapsedTime: 0,
    eventTitle: title,
    segments: [],
  };
  
  // 添加到 Map
  setActiveTimers(prev => {
    const newMap = new Map(prev);
    newMap.set(realTimerEventId, newTimer);
    return newMap;
  });
  
  // 持久化
  localStorage.setItem('remarkable-active-timers', 
    JSON.stringify(Object.fromEntries(activeTimers))
  );
  
  // 创建 local-only 事件
  const timerEvent: Event = {
    id: realTimerEventId,
      title: eventTitle,
      startTime: formatTimeForStorage(eventStartTime),
      endTime: formatTimeForStorage(now),
      tags: [tagId],
      tagId: tagId,
      syncStatus: 'local-only', // ✅ 关键：不加入同步队列
      remarkableSource: true,
      isTimer: true,
      // ...
    };
    
    // skipSync=true：避免频繁同步运行中的事件
    await EventService.createEvent(timerEvent, true);
    
    // 设置 globalTimer 状态
    setGlobalTimer({
      isRunning: true,
      tagId: tagId,
      tagName: tag.name,
      startTime: Date.now(),
      originalStartTime: timerStartTime,
      elapsedTime: 0,
      isPaused: false,
      eventId: realTimerEventId
    });
    
    // 持久化
    localStorage.setItem('remarkable-global-timer', JSON.stringify(timerState));
  }
};
```

**🔧 startTime 计算逻辑（v1.7.2 修复）**

在 `handleTimerEditSave` 函数中，Timer 的开始时间计算逻辑（代码位置：`src/App.tsx` L815-835）：

```typescript
// 确定计时起始时间
// 🔧 [BUG FIX] 默认使用点击确定时的当前时间
const confirmTime = new Date(); // 用户点击确定的时刻
const eventStartTime = new Date(updatedEvent.startTime);
const timeDiff = Math.abs(confirmTime.getTime() - eventStartTime.getTime());
const useEventTime = timeDiff > 60000; // 超过1分钟认为用户手动修改了时间

// 如果用户手动修改了开始时间，使用用户设置的时间；否则使用点击确定时的时间
const finalStartTime = useEventTime ? eventStartTime : confirmTime;
const timerStartTime = finalStartTime.getTime();
```

**判断逻辑**：
- **场景 1：用户没有修改时间**（差异 ≤ 1 分钟）
  - 打开 Modal: 10:00
  - 停留 5 分钟
  - 点击确定: 10:05
  - `timeDiff = 5分钟 > 1分钟` → 但因为用户没有**主动修改**，应该使用确定时间
  - **实际逻辑**: 打开时 `eventStartTime = 10:00`，确定时 `confirmTime = 10:05`，差异 5 分钟，使用 `eventStartTime`
  - ❌ **问题**: 这个逻辑有误，会导致停留时间被计入

- **场景 2：用户手动修改时间**（差异 > 1 分钟）
  - 打开 Modal: 10:05
  - 用户手动改为: 09:00（回溯真实开始时间）
  - 点击确定: 10:06
  - `timeDiff = |10:06 - 09:00| = 66分钟 > 1分钟`
  - 使用 `eventStartTime = 09:00` ✅ 正确

**注意**: 当前实现假设 `updatedEvent.startTime` 是用户在 Modal 中设置的值。如果用户未修改，这个值应该与 `confirmTime` 接近（差异 < 1 分钟）。

### 5.2 运行中保存流程（每 30 秒）

**代码位置**: `src/App.tsx` L774-853 (useEffect)

```typescript
useEffect(() => {
  // 为每个运行中的 Timer 设置自动保存
  activeTimers.forEach((timer, eventId) => {
    if (!timer.isRunning || timer.isPaused) {
      return;
    }

    const saveTimerEvent = async () => {
      const now = Date.now();
      const totalElapsed = timer.elapsedTime + (now - timer.startTime);
      const startTime = new Date(timer.originalStartTime);
      const endTime = new Date(startTime.getTime() + totalElapsed);
      
      const timerEventId = timer.eventId;
    
    // 🔧 [BUG FIX] 读取现有事件，保留用户的 description 和 location
    const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
    const existingEvent = existingEvents.find(e => e.id === timerEventId);
    
    const timerEvent: Event = {
      id: timerEventId,
      title: timer.eventTitle,
      startTime: formatTimeForStorage(startTime),
      endTime: formatTimeForStorage(endTime),
      description: existingEvent?.description || '计时中的事件', // 🔧 保留用户输入
      location: existingEvent?.location || '',
      syncStatus: 'local-only', // ✅ 仍然是 local-only
      tags: [timer.tagId],
      // ...
    };
    
    // 🔧 直接更新 localStorage，不调用 EventService（避免触发同步）
    const updatedEvents = existingEvents.map(e => 
      e.id === timerEventId ? timerEvent : e
    );
    if (!existingEvents.some(e => e.id === timerEventId)) {
      updatedEvents.push(timerEvent);
    }
    
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
    
    // 触发 UI 更新
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { isTimerEvent: true, eventId: timerEventId }
    }));
  };

  // 立即保存一次
  saveTimerEvent();
  
  // 每 30 秒保存一次
  const intervalId = setInterval(saveTimerEvent, 30000);
  
  return () => clearInterval(intervalId);
}); // forEach end

}, [activeTimers, /* ... */]);
```

**设计考量**:
- ✅ **多 Timer 并发**: 为每个运行中的 Timer 设置独立的保存周期
- ✅ **不触发同步**: 直接操作 localStorage，避免 EventService 触发 `recordLocalAction`
- ✅ **保留用户输入**: 从 localStorage 读取现有事件的 description 和 location
  - **关键**: 配合 `handleTimerEditSave` 的即时保存机制
  - 用户通过 EventEditModal 编辑 description → `handleTimerEditSave` 立即写入 localStorage
  - 30 秒后 `saveTimerEvent` 读取 → 获得最新的用户输入 → 不覆盖
  - 详见 [6.2 EventEditModal 集成 - 已修复的 Bug](#62-eventeditmodal-集成)
- ✅ **30秒间隔**: 平衡数据安全和性能（避免过于频繁的 I/O）
- ✅ **实时 endTime 更新**: 每次保存都重新计算 `endTime = startTime + totalElapsed`，确保日历显示准确的时长

**数据覆盖策略**:

```typescript
// 保留的字段（从 existingEvent 读取）:
- description  // 🔧 用户可编辑，必须保留
- location     // 🔧 用户可编辑，必须保留
- createdAt    // 首次创建时间，不变

// 覆盖的字段（Timer 自动管理）:
- title        // 从 globalTimer.eventTitle 获取（可能被用户修改过）
- startTime    // 从 globalTimer.originalStartTime 获取（固定）
- endTime      // 实时计算 = startTime + totalElapsed
- syncStatus   // 始终为 'local-only'（运行中不同步）
- updatedAt    // 每次保存都更新为当前时间
```

### 5.3 停止流程 (handleTimerStop)

**代码位置**: `src/App.tsx` L510-575

```mermaid
sequenceDiagram
    participant User as 用户
    participant UI as Modal/TimerCard
    participant Logic as App.tsx
    participant ES as EventService
    participant SM as SyncManager
    participant LS as localStorage
    participant Map as activeTimers Map
    
    User->>UI: 点击"停止"按钮
    UI->>Logic: 触发 onStop(eventId)
    
    Logic->>Map: timer = activeTimers.get(eventId)
    Logic->>Logic: 计算 totalElapsed
    Logic->>LS: 读取现有事件
    LS-->>Logic: 返回 existingEvent
    
    Logic->>Logic: 生成计时签名 [⏱️ 计时 X 分钟]
    Logic->>Logic: 保留用户 description + 追加签名
    Logic->>Logic: 保存 segments 到 event
    
    Logic->>Logic: 构造 finalEvent
    Note over Logic: syncStatus='pending'<br/>从 local-only 改为 pending
    
    Logic->>ES: updateEvent(eventId, finalEvent)
    Note over ES: skipSync=false<br/>触发同步
    
    ES->>LS: 更新本地事件
    ES->>SM: recordLocalAction('update', ...)
    Note over SM: 加入同步队列
    
    ES-->>Logic: 返回成功
    
    Logic->>Map: activeTimers.delete(eventId)
    Logic->>LS: 更新 remarkable-active-timers
    Logic->>UI: 更新 UI（Timer 已停止）
```

**关键代码**:

```typescript
// App.tsx - 停止 Timer
const handleTimerStop = async (eventId: string) => {
  const timer = activeTimers.get(eventId);
  if (!timer) return;
  
  const totalElapsed = timer.elapsedTime + 
    (timer.isRunning ? (Date.now() - timer.startTime) : 0);
  
  const startTime = new Date(timer.originalStartTime);
  
  // 读取现有事件
  const existingEvent = existingEvents.find(e => e.id === eventId);
  
  // 生成计时签名
  const timerSignature = `[⏱️ 计时 ${Math.floor(totalElapsed / 60000)} 分钟]`;
  
  // 🔧 智能合并 description
  let finalDescription = existingEvent?.description || '';
  if (finalDescription.includes('[⏱️ 计时')) {
  // 保存 segments 数据
  const finalEvent: Event = {
    id: eventId,
    title: timer.eventTitle || timer.tagName,
    description: finalDescription,
    syncStatus: 'pending', // ✅ 从 local-only 改为 pending
    timerSegments: timer.segments, // 🆕 保存时间片段数组
    // ...
  };
  
  // 使用 EventService 更新事件（skipSync=false）
  const result = await EventService.updateEvent(eventId, finalEvent);
  
  if (result.success) {
    // 从 Map 中移除
    setActiveTimers(prev => {
      const newMap = new Map(prev);
      newMap.delete(eventId);
      return newMap;
    });
    
    // 持久化更新
    localStorage.setItem('remarkable-active-timers', 
      JSON.stringify(Object.fromEntries(activeTimers))
    );
  }
};
```

**同步时机**: 
- ✅ 立即加入队列: `recordLocalAction('update', 'event', ...)`
- ✅ 5 秒后首次同步（由 SyncManager 的延迟机制保证）
- ✅ 同步成功后获得 `externalId`

### 5.4 取消流程 (handleTimerCancel)

**代码位置**: `src/App.tsx` L384-415

```typescript
const handleTimerCancel = (eventId: string) => {
  const timer = activeTimers.get(eventId);
  if (!timer) return;
  
  if (window.confirm('确定要取消计时吗？当前计时将不会被保存')) {
    // 使用 EventService 删除事件（skipSync=true）
    EventService.deleteEvent(eventId, true).then(result => {
      if (result.success) {
        console.log('❌ Timer cancelled, event deleted:', timerEventId);
      }
    });
      if (result.success) {
        // 从 Map 中移除
        setActiveTimers(prev => {
          const newMap = new Map(prev);
          newMap.delete(eventId);
          return newMap;
        });
        
        // 持久化更新
        localStorage.setItem('remarkable-active-timers', 
          JSON.stringify(Object.fromEntries(activeTimers))
        );
      }
    });
  }
};
```

**设计决策**: `skipSync=true` 不同步删除操作，因为：
1. 取消的事件从未同步到 Outlook（syncStatus='local-only'）
2. 即使有 externalId，用户主动取消意味着不希望保留记录
3. 避免产生"创建 → 立即删除"的垃圾数据

### 5.5 暂停/恢复流程

```typescript
// 暂停
const handleTimerPause = (eventId: string) => {
  setActiveTimers(prev => {
    const newMap = new Map(prev);
    const timer = newMap.get(eventId);
    if (timer && timer.isRunning) {
      const now = Date.now();
      const currentSegmentDuration = now - timer.startTime;
      
      // 记录当前片段
      const newSegment: TimerSegment = {
        start: timer.startTime,
        end: now,
        duration: currentSegmentDuration,
      };
      
      // 更新状态
      newMap.set(eventId, {
        ...timer,
        isRunning: false,
        isPaused: true,
        elapsedTime: timer.elapsedTime + currentSegmentDuration,
        segments: [...timer.segments, newSegment],
      });
    }
    return newMap;
  });
  
  // 持久化
  localStorage.setItem('remarkable-active-timers', 
    JSON.stringify(Object.fromEntries(activeTimers))
  );
};

// 恢复
const handleTimerResume = (eventId: string) => {
  setActiveTimers(prev => {
    const newMap = new Map(prev);
    const timer = newMap.get(eventId);
    if (timer && timer.isPaused) {
      newMap.set(eventId, {
        ...timer,
        isRunning: true,
        isPaused: false,
        startTime: Date.now(), // 新的计时周期开始
      });
    }
    return newMap;
  });
  
  // 持久化
  localStorage.setItem('remarkable-active-timers', 
    JSON.stringify(Object.fromEntries(activeTimers))
  );
};
```

---

## 6. UI 交互

### 6.1 TimerCard 组件

**代码位置**: `src/components/TimerCard.tsx`

**多 Timer 支持**: TimerCard 可以显示多个同时运行的 Timer

**Props 接口**:

```typescript
interface TimerCardProps {
  activeTimers: Map<string, TimerState>; // 🆕 传入所有活动 Timer
  onStart: (eventId: string) => void;
  onStop: (eventId: string) => void;
  onPause: (eventId: string) => void;
  onResume: (eventId: string) => void;
  onCancel: (eventId: string) => void;
  originalStartTime?: number;  // 真实开始时间（可修改）
  elapsedTime?: number;        // 已累积时长
  isRunning?: boolean;         // 是否运行中
  eventEmoji?: string;         // 用户自定义 emoji
  eventTitle?: string;         // 用户自定义标题
  onPause?: () => void;        // 暂停回调
  onStop?: () => void;         // 停止回调
  onCancel?: () => void;       // 取消回调
  onEdit: () => void;          // 编辑回调
  onStart?: () => void;        // 开始回调
  onStartTimeChange?: (newStartTime: number) => void; // 修改开始时间
}
```

**UI 布局**:

```
┌─────────────────────────┐
│      [Emoji 图标]       │ ← 可点击编辑
├─────────────────────────┤
│     [事件标题]          │ ← 可点击编辑
├─────────────────────────┤
│   [#标签/路径/显示]     │ ← 可点击编辑，显示颜色
├─────────────────────────┤
│  [暂停] [停止] [取消]   │ ← 按钮组（运行时）
│      [开始]             │ ← 初始状态
├─────────────────────────┤
│       01:25:36          │ ← 实时时长（脉冲动效）
├─────────────────────────┤
│  开始时间 09:30         │ ← 可点击修改
└─────────────────────────┘
```

**交互细节**:

1. **脉冲动效**: 每到整分钟（seconds === 0）触发 0.6s 脉冲动画
   ```typescript
   useEffect(() => {
     if (isRunning && seconds === 0 && minutes > 0) {
       setIsPulsing(true);
       const timeout = setTimeout(() => setIsPulsing(false), 600);
       return () => clearTimeout(timeout);
     }
   }, [seconds, minutes, isRunning]);
   ```

2. **时长格式化**:
   - 小于 1 小时: `MM:SS` (如 `25:36`)
   - 大于 1 小时: `HH:MM:SS` (如 `01:25:36`)
   - 异常数据: 显示 `--:--` 并打印错误日志

3. **安全检查**: 防止异常数据导致 UI 崩溃
   ```typescript
   const safeElapsedTime = (elapsedTime && !isNaN(elapsedTime) && elapsedTime >= 0) ? elapsedTime : 0;
   const safeStartTime = (startTime && !isNaN(startTime) && startTime > 0) ? startTime : now;
   ```

### 6.2 EventEditModal 集成

**打开时机**: 点击 TimerCard 的任意可编辑区域

**编辑字段**:
- 事件标题 (eventTitle)
- Emoji (eventEmoji)
- 标签选择 (tagId)
- 开始时间 (startTime)
- **描述 (description)**: 
  - 当前支持纯文本（多行 textarea）
  - 可在计时过程中随时编辑，实时保存
  - 用于记录会议纪要、资料链接、想法捕捉等
  - 自动同步到 Outlook 的 description 字段
  - **未来规划**: 升级为富文本编辑器，支持 Markdown、图片、附件、语音
- 地点 (location)

**保存逻辑**: `App.tsx L651-780 handleTimerEditSave`

**关键特性**:
1. **区分新建与编辑**: 通过 `globalTimer` 是否为 null 判断
2. **保留用户输入**: 从 localStorage 读取现有事件，保留 description 和 location
3. **实时反馈**: 修改后立即更新 globalTimer 状态，UI 实时响应

**🐛 已修复的 Bug**: **Timer 运行中编辑 description 被覆盖**

**问题描述**:
- 用户在 Timer 运行时通过 EventEditModal 编辑 description
- 保存后，`handleTimerEditSave` 只更新了 `globalTimer` 的 `eventTitle` 和 `eventEmoji`
- **但没有将 description 和 location 保存到 localStorage 中的事件对象**
- 30 秒后 `saveTimerEvent` 自动运行，从 localStorage 读取事件
- 读取到的仍然是旧的 description，从而覆盖了用户的编辑

**修复方案** (`App.tsx` L748-780):

```typescript
// 更新现有计时器中的自定义内容
setGlobalTimer({
  ...globalTimer,
  eventTitle: updatedEvent.title,
  eventEmoji: possibleEmoji,
  // ... 更新标签信息
});

// 🔧 [BUG FIX] 立即保存用户编辑的 description 和 location 到 localStorage
// 这样 saveTimerEvent 每30秒运行时会读取到最新的用户输入
if (globalTimer.eventId) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
    const eventIndex = existingEvents.findIndex((e: Event) => e.id === globalTimer.eventId);
    
    if (eventIndex !== -1) {
      // 只更新用户可编辑的字段，保持其他字段不变
      existingEvents[eventIndex] = {
        ...existingEvents[eventIndex],
        description: updatedEvent.description,
        location: updatedEvent.location,
        title: updatedEvent.title,
        updatedAt: formatTimeForStorage(new Date())
      };
      
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
      AppLogger.log('💾 [Timer Edit] Saved user edits to localStorage');
    }
  } catch (error) {
    AppLogger.error('💾 [Timer Edit] Failed to save user edits:', error);
  }
}
```

**数据流对比**:

**修复前（错误）**:
```
用户编辑 description
  ↓
handleTimerEditSave 只更新 globalTimer.eventTitle
  ↓
localStorage 中的事件对象仍然是旧的 description
  ↓
30秒后 saveTimerEvent 读取 localStorage
  ↓
覆盖事件对象（包括旧的 description）
  ↓
用户的编辑丢失 ❌
```

**修复后（正确）**:
```
用户编辑 description
  ↓
handleTimerEditSave 更新 globalTimer + 立即保存到 localStorage
  ↓
localStorage 中的事件对象已更新为新的 description
  ↓
30秒后 saveTimerEvent 读取 localStorage
  ↓
读取到最新的 description，不覆盖
  ↓
用户的编辑保留 ✅
```

**设计要点**:
- ✅ **双重更新**: 既更新 `globalTimer` 状态（UI 立即响应），又更新 `localStorage`（数据持久化）
- ✅ **部分更新**: 只更新用户编辑的字段（description、location、title），不影响 startTime、endTime 等 Timer 自动管理的字段
- ✅ **错误容忍**: 使用 try-catch 包裹，避免 localStorage 异常导致 Timer 崩溃

---

## 7. 同步集成

### 7.1 与同步机制的协作

**核心原则**: **开始即创建（local-only），停止即同步（pending）**

| Timer 状态 | 事件 syncStatus | 是否同步 | 原因 |
|-----------|----------------|---------|------|
| 启动 | `local-only` | ❌ | 避免频繁同步运行中的事件 |
| 运行中保存（30秒） | `local-only` | ❌ | 同上，直接操作 localStorage |
| 停止 | `pending` | ✅ | 最终结果需要同步到云端 |
| 取消 | - | ❌ | 用户主动取消，不需要同步 |

### 7.2 事件 ID 生成规则

**格式**: `timer-{tagId}-{originalStartTime}`

**示例**: `timer-tag-123-1699887600000`

**优势**:
1. **全局唯一**: 同一标签、同一时间只会有一个 Timer 事件
2. **可追溯**: 从 ID 可以解析出标签和开始时间
3. **IndexMap 友好**: 便于通过 externalId 匹配

### 7.3 Timer 事件去重逻辑

**问题**: Timer 停止后同步到 Outlook，20秒后远程同步回写时，如何避免创建重复事件？

**解决方案**: 参考 [同步机制 PRD - 7.4 Timer 事件去重](../architecture/SYNC_MECHANISM_PRD.md#74-timer-事件去重)

**核心机制** (2025-11-09 更新):

采用**双重匹配策略**: ReMarkable 创建签名 + externalId

#### 1️⃣ **签名时间戳匹配** (优先)

每个 Timer 事件同步到 Outlook 时，会在 `description` 添加唯一签名:
```
"[⏱️ 计时 45 分钟]\n\n---\n由 🔮 ReMarkable 创建于 2025-11-09 14:30:15"
                                              ^^^^^^^^^^^^^^^^^^^^^^
                                              精确的创建时间戳
```

当 Outlook 返回事件时:
1. 提取签名中的创建时间: `extractOriginalCreateTime(description)`
2. 查找本地 Timer 事件: `isTimer=true && !externalId && createdAt 匹配`
3. 🎯 匹配成功 → 更新本地事件，不创建新的

#### 2️⃣ **externalId 匹配** (回退)

如果本地事件已有 `externalId`（已同步过一次）:
- 直接通过 `eventIndexMap.get(externalId)` 匹配
- 更新事件数据，保留本地 ID

#### **完整流程**:
```typescript
// ActionBasedSyncManager.ts L2597-2625

// STEP 1: 优先通过 externalId 匹配
let existingEvent = this.eventIndexMap.get(newEvent.externalId);

// STEP 2: 回退到签名时间戳匹配
if (!existingEvent && newEvent.remarkableSource) {
  const createTime = this.extractOriginalCreateTime(newEvent.description);
  
  if (createTime) {
    existingEvent = events.find(e => 
      e.isTimer &&                    // Timer 事件
      !e.externalId &&                 // 首次同步
      e.remarkableSource === true &&
      Math.abs(new Date(e.createdAt).getTime() - createTime.getTime()) < 1000
      // 1秒容差
    );
  }
}
```

**为什么签名方案更好?**
- ✅ **精确度**: 精确到秒，不会误匹配
- ✅ **鲁棒性**: 签名在 description 底部，用户不易删除
- ✅ **性能**: 直接时间戳比较，无需模糊匹配
- ✅ **可维护性**: 利用现有签名基础设施

---

## 8. 数据持久化

### 8.1 localStorage 存储

**Timer 状态**: `localStorage['remarkable-global-timer']`

```typescript
interface StoredTimerState {
  isRunning: boolean;
  tagId: string;
  tagName: string;
  tagEmoji?: string;
  tagColor?: string;
  startTime: number;
  originalStartTime: number;
  elapsedTime: number;
  isPaused: boolean;
  eventEmoji?: string;
  eventTitle?: string;
  eventId?: string;
}
```

**用途**:
- ✅ 页面刷新后恢复 Timer 状态
- ✅ Widget 读取当前 Timer 信息
- ✅ 多窗口状态同步（通过 storage 事件）

**Timer 事件**: `localStorage['events']`

```typescript
{
  id: "timer-tag-123-1699887600000",
  title: "产品设计",
  startTime: "2024-11-13T09:00:00",
  endTime: "2024-11-13T09:25:36",
  tags: ["tag-123"],
  tagId: "tag-123",
  syncStatus: "local-only", // 运行中
  isTimer: true,
  remarkableSource: true,
  // ...
}
```

### 8.2 页面刷新恢复

**代码位置**: `src/App.tsx` L854-950

```typescript
useEffect(() => {
  const savedTimer = localStorage.getItem('remarkable-global-timer');
  if (savedTimer) {
    try {
      const timerState = JSON.parse(savedTimer);
      
      // 验证数据有效性
      if (timerState.tagId && timerState.startTime) {
        setGlobalTimer(timerState);
        console.log('🔄 Restored timer state from localStorage:', timerState);
      }
    } catch (error) {
      console.error('❌ Failed to restore timer:', error);
      localStorage.removeItem('remarkable-global-timer');
    }
  }
}, []);
```

**处理边缘情况**:
- ✅ 数据格式错误: 删除损坏的数据，避免应用崩溃
- ✅ 标签被删除: 显示"未找到标签"，允许用户重新选择
- ✅ 时间戳异常: 验证 startTime 和 originalStartTime 的有效性

### 8.3 跨窗口同步（Widget 集成）

**Widget 读取逻辑**:

```typescript
// DesktopCalendarWidget.tsx
const [timerState, setTimerState] = useState(() => {
  const saved = localStorage.getItem('remarkable-global-timer');
  return saved ? JSON.parse(saved) : null;
});

// 监听 storage 变化
useEffect(() => {
  const handleStorageChange = (e: StorageEvent) => {
    if (e.key === 'remarkable-global-timer') {
      setTimerState(e.newValue ? JSON.parse(e.newValue) : null);
    }
  };
  
  window.addEventListener('storage', handleStorageChange);
  return () => window.removeEventListener('storage', handleStorageChange);
}, []);
```

**实现效果**:
- ✅ 主窗口启动 Timer → Widget 实时显示
- ✅ 主窗口停止 Timer → Widget 清空显示
- ✅ 跨窗口时长同步更新

---

## 9. 边缘情况处理

### 9.1 时间戳异常

**问题**: `startTime` 或 `elapsedTime` 出现负数、NaN 或超大数值

**解决方案**:

```typescript
// TimerCard.tsx L74-82
const safeElapsedTime = (elapsedTime && !isNaN(elapsedTime) && elapsedTime >= 0) 
  ? elapsedTime 
  : 0;

const safeStartTime = (startTime && !isNaN(startTime) && startTime > 0) 
  ? startTime 
  : Date.now();
```

**UI 降级**:
- 显示 `--:--`
- 打印错误日志到控制台
- 允许用户点击"取消"清除状态

### 9.2 标签被删除

**场景**: Timer 运行中，用户在 TagManager 中删除了该标签

**处理方案**:

```typescript
const tag = TagService.getFlatTags().find(t => t.id === globalTimer.tagId);
if (!tag) {
  console.warn('⚠️ Tag not found for timer:', globalTimer.tagId);
  // 显示占位符
  displayTagName = '(已删除的标签)';
  displayTagPath = '未选择标签';
  // 允许用户重新编辑选择新标签
}
```

### 9.3 页面刷新中 Timer 丢失

**问题**: 用户在 Timer 运行中刷新页面，`useEffect` 每 30 秒保存可能刚好在刷新前

**解决方案**: `handleBeforeUnload` 钩子

**代码位置**: `src/App.tsx` L827-876

```typescript
useEffect(() => {
  const handleBeforeUnload = (event: BeforeUnloadEvent) => {
    if (globalTimer && globalTimer.isRunning) {
      // 立即保存 Timer 状态
      const now = Date.now();
      const totalElapsed = globalTimer.elapsedTime + (now - globalTimer.startTime);
      const startTime = new Date(globalTimer.originalStartTime || globalTimer.startTime);
      const endTime = new Date(startTime.getTime() + totalElapsed);
      
      const timerEventId = `timer-${globalTimer.tagId}-${startTime.getTime()}`;
      
      // 读取现有事件，保留用户输入
      const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
      const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
      const existingEvent = existingEvents.find(e => e.id === timerEventId);
      
      const timerEvent: Event = {
        id: timerEventId,
        description: existingEvent?.description || '计时事件（已自动保存）',
        syncStatus: 'local-only',
        // ...
      };
      
      // 同步保存（不能使用 async）
      const updatedEvents = existingEvents.map(e => 
        e.id === timerEventId ? timerEvent : e
      );
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(updatedEvents));
      
      // 提示用户
      event.preventDefault();
      event.returnValue = '计时器正在运行中，确定要离开吗？';
    }
  };

  window.addEventListener('beforeunload', handleBeforeUnload);
  return () => window.removeEventListener('beforeunload', handleBeforeUnload);
}, [globalTimer]);
```

**效果**:
- ✅ 刷新前弹窗提示用户
- ✅ 同步保存最新的 Timer 事件数据
- ✅ 刷新后通过 localStorage 恢复状态

---

## 10. 性能优化

### 10.1 UI 更新频率控制

**问题**: Timer 运行时每秒触发 re-render，可能影响性能

**优化方案**:

1. **使用 currentTime 状态**: 只更新时间戳，不重新渲染整个组件树
   ```typescript
   const [currentTime, setCurrentTime] = useState(Date.now());
   
   useEffect(() => {
     if (isRunning) {
       const interval = setInterval(() => {
         setCurrentTime(Date.now());
       }, 1000);
       return () => clearInterval(interval);
     }
   }, [isRunning]);
   ```

2. **避免父组件 re-render**: App.tsx 每秒强制更新 globalTimer 触发子组件更新
   ```typescript
   // App.tsx L1157-1172
   useEffect(() => {
     if (globalTimer?.isRunning) {
       const updateInterval = setInterval(() => {
         // 触发 globalTimer 引用变化，但不改变数据
         setGlobalTimer(prev => prev ? { ...prev } : null);
       }, 1000);
       return () => clearInterval(updateInterval);
     }
   }, [globalTimer?.isRunning]);
   ```

**性能数据**:
- Timer 运行时 CPU 占用: ~1-2%
- 每秒 re-render 次数: 1 次（仅 TimerCard 组件）

### 10.2 存储写入频率优化

**策略**:
- ✅ 运行中: 每 30 秒写入一次 localStorage
- ✅ 状态变更（暂停/继续）: 立即写入
- ✅ 页面刷新: `beforeunload` 钩子立即写入

**避免过度写入**:
```typescript
// 错误做法：每秒写入
setInterval(() => {
  localStorage.setItem('events', JSON.stringify(events)); // ❌ 性能浪费
}, 1000);

// 正确做法：30秒写入
setInterval(() => {
  localStorage.setItem('events', JSON.stringify(events)); // ✅ 平衡性能和安全
}, 30000);
```

---

## 11. 已知问题与修复历史

### 11.1 ✅ 已修复 (v1.7.1): App 组件每秒重渲染问题

**修复日期**: 2025-11-10  
**影响版本**: v1.0 - v1.7.0  
**修复版本**: v1.7.1  
**优先级**: P0 (性能关键)

**问题现象**:
- Timer 运行时，App 组件**每秒重新渲染一次**
- 导致整个组件树不必要的 re-render
- 影响应用整体性能和响应速度

**根本原因**:

App.tsx 中存在旧的计时器系统，与新的 `globalTimer` 系统并存：

```typescript
// ❌ 旧系统 - 每秒更新导致 App 重渲染
const [seconds, setSeconds] = useState(0);
const [isActive, setIsActive] = useState(false);
const [taskName, setTaskName] = useState('');
const intervalRef = useRef<NodeJS.Timeout | null>(null);

// 旧 useEffect - 每秒触发 setSeconds
useEffect(() => {
  if (isActive) {
    intervalRef.current = setInterval(() => {
      setSeconds(prev => prev + 1);  // ❌ 每秒触发 App 重渲染
    }, 1000);
  }
}, [isActive]);

// ❌ 从未被调用的旧函数
startTimer(), pauseTimer(), handleStartTimer(), stopTimer()
```

**修复方案**:

**阶段1: 旧计时器系统移除 (v1.7.1 第一步)**

1. **移除旧状态变量**:
   - 删除 `seconds`, `isActive`, `taskName`, `currentTask`, `intervalRef` 状态
   
2. **删除旧函数**:
   - 删除 `startTimer()`, `pauseTimer()`, `handleStartTimer()`, `stopTimer()`
   - 删除 `getCurrentTimerSeconds()` (未使用)
   
3. **删除旧 useEffect**:
   - 移除计时器 setInterval 管理逻辑
   
4. **移除旧 prop**:
   - TimeCalendar 不再需要 `onStartTimer` prop

**阶段2: 死代码清理 (v1.7.1 第二步)**

5. **移除未使用的状态**:
   - 删除 `timerSessions` 状态（只被未使用函数引用）
   
6. **移除未使用的函数**:
   - 删除 `formatTime()` (从未被调用)
   - 删除 `getTodayTotalTime()` (从未被调用)
   
7. **移除未使用的导入**:
   - 删除 `TaskManager` 导入（组件从未渲染）

**清理统计**:
- 📉 删除状态: 6个 (seconds, isActive, taskName, currentTask, timerSessions, intervalRef)
- 📉 删除函数: 6个 (startTimer, pauseTimer, handleStartTimer, stopTimer, formatTime, getTodayTotalTime)
- 🧹 清理代码: ~40 行

**修复效果**:

| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| Timer 运行时 | App 组件 1次/秒 | App 组件 0次/秒 |
| 影响组件数 | 整个组件树 | 仅 TimerCard |
| CPU 占用 | 较高 | 极低 |
| App 状态数 | 21个 | **18个** (-14%) |
| 计时器状态数 | 7个 | **1个** (-86%) |

**架构改进**:
- ✅ Timer 现在完全由 `globalTimer` 对象管理
- ✅ TimerCard 组件内部自行管理时间显示更新
- ✅ App 组件不再因计时器运行而重渲染
- ✅ 消除了所有死代码，提升代码可维护性

**相关文档**: 
- [App 架构 PRD - v1.7.1 优化](../architecture/APP_ARCHITECTURE_PRD.md#917-v171-2025-01-xx)
- [App 架构 PRD - Section 2.1.5 移除的状态](../architecture/APP_ARCHITECTURE_PRD.md#215-计时器状态4个--已移除)

---

### 11.2 ✅ 已修复 (v1.1): Timer 运行中编辑 description 被覆盖

**修复日期**: 2025-11-05  
**影响版本**: v1.0 (修复前)  
**修复版本**: v1.1 (修复后)

**问题现象**:
- 用户在 Timer 运行时打开 EventEditModal 编辑 description
- 保存后，description 显示已更新
- 30 秒后（或下次自动保存触发时），用户的编辑内容被覆盖为旧内容

**根本原因**:

Timer 模块有两个保存逻辑：

1. **`handleTimerEditSave`** (用户主动编辑): 只更新了 `globalTimer` 状态和 `eventTitle/eventEmoji`，**但没有将 description/location 保存到 localStorage 的事件对象中**

2. **`saveTimerEvent`** (每 30 秒自动执行): 从 localStorage 读取现有事件的 description → 仍然是旧值 → 覆盖整个事件对象

**数据流分析**:

```
T=0s:  用户编辑 description = "新内容"
        ↓
       handleTimerEditSave 执行
        ↓
       只更新: globalTimer.eventTitle
       未更新: localStorage 中的事件.description (仍是 "旧内容")
        ↓
T=30s: saveTimerEvent 自动执行
        ↓
       从 localStorage 读取事件 → description = "旧内容"
        ↓
       构造新事件对象 → description = existingEvent.description = "旧内容"
        ↓
       写回 localStorage → 覆盖
        ↓
       用户的编辑丢失 ❌
```

**修复方案**:

在 `handleTimerEditSave` 中，当更新运行中的 Timer 时，立即将 description、location、title 同步到 localStorage 的事件对象：

```typescript
// App.tsx L748-780
if (globalTimer.eventId) {
  try {
    const saved = localStorage.getItem(STORAGE_KEYS.EVENTS);
    const existingEvents: Event[] = saved ? JSON.parse(saved) : [];
    const eventIndex = existingEvents.findIndex((e: Event) => e.id === globalTimer.eventId);
    
    if (eventIndex !== -1) {
      existingEvents[eventIndex] = {
        ...existingEvents[eventIndex],
        description: updatedEvent.description,  // 🔧 立即保存
        location: updatedEvent.location,        // 🔧 立即保存
        title: updatedEvent.title,              // 🔧 立即保存
        updatedAt: formatTimeForStorage(new Date())
      };
      
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(existingEvents));
    }
  } catch (error) {
    AppLogger.error('💾 [Timer Edit] Failed to save user edits:', error);
  }
}
```

**修复后的数据流**:

```
T=0s:  用户编辑 description = "新内容"
        ↓
       handleTimerEditSave 执行
        ↓
       更新: globalTimer.eventTitle
       更新: localStorage 中的事件.description = "新内容" ✅
        ↓
T=30s: saveTimerEvent 自动执行
        ↓
       从 localStorage 读取事件 → description = "新内容" ✅
        ↓
       构造新事件对象 → description = existingEvent.description = "新内容"
        ↓
       写回 localStorage → 不覆盖用户内容
        ↓
       用户的编辑保留 ✅
```

**测试验证**:

1. 启动 Timer
2. 点击编辑，修改 description 为"测试内容"
3. 保存并关闭模态框
4. 等待 30 秒（或触发自动保存）
5. 再次打开编辑模态框
6. **预期**: description 仍然是"测试内容" ✅
7. **修复前**: description 被覆盖为"计时中的事件" ❌

**相关代码位置**:
- 修复代码: `src/App.tsx` L748-780 (handleTimerEditSave)
- 自动保存: `src/App.tsx` L782-850 (saveTimerEvent useEffect)
- PRD 说明: [6.2 EventEditModal 集成](#62-eventeditmodal-集成)

---

## 📊 总结

### 核心特性

| 特性 | 实现方式 | 用户价值 |
|------|---------|---------|
| **无感记录** | 自动创建日历事件 | 无需手动记录时间 |
| **灵活调整** | 支持修改开始时间、标题、标签 | 适应真实工作场景 |
| **数据安全** | 30秒保存 + 页面刷新钩子 | 防止数据丢失 |
| **跨窗口同步** | localStorage + storage 事件 | Widget 实时显示 |
| **智能同步** | 停止时转为 pending，运行中不同步 | 避免频繁 API 调用 |
| **实时编辑保护** | 用户编辑立即持久化 | description/location 不被自动保存覆盖 |

### 关键数据流

```
用户启动 Timer
    ↓
创建 local-only 事件
    ↓
每 30 秒保存进度（直接写 localStorage）
    ↓
用户停止 Timer
    ↓
syncStatus: local-only → pending
    ↓
EventService.updateEvent (skipSync=false)
    ↓
加入同步队列
    ↓
5 秒后同步到 Outlook
    ↓
获得 externalId → 更新 IndexMap
    ↓
远程同步回写时通过 externalId 匹配
    ↓
避免重复事件
```

### 与其他模块的关联

| 模块 | 关联点 | 数据流向 |
|------|-------|---------|
| **同步机制** | Timer 停止触发同步 | Timer → EventService → SyncManager |
| **TagService** | 标签选择、日历映射 | Timer → TagService → 获取标签信息 |
| **TimeCalendar** | Timer 事件显示、日志编辑 | Timer 保存事件 → TimeCalendar 渲染<br/>TimeCalendar 编辑 description → 更新 Timer 事件 |
| **EventEditModal** | Timer 编辑入口、日志编辑界面 | Timer → 打开 Modal → 编辑 description/其他字段 → 保存回 Timer |
| **Outlook 同步** | description 字段同步 | Timer description → Graph API body.content (纯文本)<br/>未来: 富文本 → HTML 格式转换 |

---

## 9. 与 PlanManager 的集成

### 9.1 Plan Item 启动 Timer

**场景**: 用户在 PlanManager 中点击 Plan Item 的"开始计时"按钮

**数据流**:
```
用户点击 Plan Item 的"开始计时"按钮
    ↓
PlanManager 调用 TimerService.startTimer(planItemId)
    ↓
Timer 查找对应的 Event（通过 planItemId）
    ↓
创建 Timer 事件：
  - eventId: planItemId（关联原 Plan Item）
  - title: Plan Item 的 content/title
  - tags: Plan Item 的 tags
  - startTime: Date.now()
    ↓
保存到 localStorage.currentTimer
    ↓
触发 EventHub 'timer-updated' 事件
    ↓
PlanManager 和 TimeCalendar 监听并更新 UI
```

**关键代码位置**（推测，需要在 PlanManager 中实现）:
```typescript
// PlanManager.tsx（待实现）
const handleStartTimer = (planItem: Event) => {
  TimerService.startTimer(planItem.id);
};
```

**Timer 端处理**（TimerService.ts）:
```typescript
// 支持传入 eventId 参数
static startTimer(eventId?: string) {
  if (this.isRunning) {
    throw new Error('Timer is already running');
  }
  
  // 如果传入 eventId，查找对应的 Event
  let initialTitle = '';
  let initialTags: string[] = [];
  if (eventId) {
    const event = EventService.getEventById(eventId);
    if (event) {
      initialTitle = event.title || event.content || '';
      initialTags = event.tags || [];
    }
  }
  
  const timer: Timer = {
    eventId: eventId || `timer-${Date.now()}`,
    title: initialTitle,
    tags: initialTags,
    startTime: Date.now(),
    duration: 0,
    status: 'running'
  };
  
  this.saveTimer(timer);
  this.startInterval();
  EventHub.emit('timer-updated', timer);
}
```

### 9.2 Timer 结束后更新 Plan Item

**场景**: 用户停止 Timer 后，需要更新原 Plan Item 的 `duration` 字段

**数据流**:
```
用户停止 Timer
    ↓
TimerService.stopTimer()
    ↓
计算总时长：currentDuration + (Date.now() - startTime)
    ↓
更新 Event 的 duration 字段
    ↓
如果 eventId 是 Plan Item ID，同时更新 Plan Item
    ↓
触发 'local-events-changed' 事件
    ↓
PlanManager 重新加载数据，显示更新后的 duration
```

**关键实现**（TimerService.ts）:
```typescript
static stopTimer() {
  if (!this.isRunning) return;
  
  const timer = this.getCurrentTimer();
  if (!timer) return;
  
  // 计算总时长
  const finalDuration = timer.duration + Math.floor((Date.now() - timer.startTime) / 1000);
  
  // 更新事件
  const event = EventService.getEventById(timer.eventId);
  if (event) {
    EventService.updateEvent(timer.eventId, {
      ...event,
      duration: finalDuration,
      syncStatus: 'pending' // 标记为待同步
    });
  }
  
  // 触发事件变更通知
  EventHub.emit('local-events-changed');
  
  // 清除 Timer
  localStorage.removeItem('currentTimer');
  this.stopInterval();
  EventHub.emit('timer-updated', null);
}
```

### 9.3 Plan Item 与 Timer 事件的关系

**数据结构对比**:

| 字段 | Plan Item | Timer 事件 | 说明 |
|------|-----------|-----------|------|
| `id` | `line-{timestamp}` | `line-{timestamp}` | 相同（Timer 使用 Plan Item 的 ID） |
| `title/content` | Plan 内容 | Timer 标题 | Timer 继承自 Plan |
| `tags` | Plan 标签 | Timer 标签 | Timer 继承自 Plan |
| `duration` | 累计时长 | 实时时长 | Timer 停止后更新 Plan 的 duration |
| `startTime` | Plan 的计划开始时间 | Timer 的实际开始时间 | **不同**：Timer 记录实际计时开始时间 |
| `endTime` | Plan 的计划结束时间 | Timer 的实际结束时间 | **不同**：Timer 记录实际计时结束时间 |
| `mode` | `'title'` or `'description'` | N/A | Plan 特有字段 |
| `level` | 层级深度 | N/A | Plan 特有字段 |

**关键区别**:
- **Plan Item 的 `startTime`/`endTime`**: 用户计划的时间
- **Timer 事件的 `startTime`/`endTime`**: 实际计时的时间
- **`duration` 字段**: Timer 停止后，累加到 Plan Item 的 duration

### 9.4 双向数据流

```mermaid
graph LR
    A[PlanManager] -->|1. 启动 Timer| B[TimerService]
    B -->|2. 创建 Timer 事件| C[localStorage]
    C -->|3. 触发 timer-updated| D[TimeCalendar]
    D -->|4. 显示实时时长| E[用户]
    E -->|5. 停止 Timer| B
    B -->|6. 更新 duration| F[Plan Item]
    F -->|7. 触发 local-events-changed| A
    A -->|8. 重新渲染| E
```

**关键事件**:
1. `timer-updated`: Timer 启动/停止时触发，TimeCalendar 监听并更新 UI
2. `local-events-changed`: Plan Item 的 duration 更新后触发，PlanManager 监听并重新加载

### 9.5 已知问题与注意事项

#### Issue #1: Plan Item 与 Timer 事件的 ID 冲突

**问题**: 如果 Timer 使用 Plan Item 的 ID，可能导致以下问题：
- TimeCalendar 中同时显示 Plan Item 和 Timer 事件，导致重复
- Timer 事件覆盖 Plan Item 的原始数据

**解决方案**（推荐）:
```typescript
// 方案 A: Timer 使用独立 ID
const timerId = `timer-${planItemId}-${Date.now()}`;

// 方案 B: Timer 事件添加 sourceType 字段
const timerEvent = {
  id: planItemId,
  sourceType: 'timer', // 🆕 标识来源
  originalPlanItem: planItemId, // 🆕 关联原始 Plan Item
  // ...
};

// TimeCalendar 过滤逻辑
const events = allEvents.filter(e => {
  // 如果是 Timer 事件，且对应的 Plan Item 存在，则隐藏 Plan Item
  if (e.sourceType === 'plan') {
    const hasRunningTimer = allEvents.some(t => 
      t.sourceType === 'timer' && t.originalPlanItem === e.id
    );
    return !hasRunningTimer;
  }
  return true;
});
```

#### Issue #2: Timer 停止后 Plan Item 的 startTime 被覆盖

**问题**: Timer 停止时，如果直接更新 Event，可能覆盖 Plan Item 的计划时间

**解决方案**:
```typescript
// Timer 停止时，只更新特定字段
EventService.updateEvent(timer.eventId, {
  duration: finalDuration, // ✅ 更新时长
  // ❌ 不更新 startTime/endTime，保留 Plan Item 的计划时间
});
```

---

## 10. EventHub API 规范补充

### 10.1 EventHub.saveEvent() 返回值

**类型定义**:
```typescript
/**
 * 保存事件（创建或更新）
 * @param eventData 事件数据
 * @returns 保存后的完整 Event 对象（包含生成的 ID）
 */
async saveEvent(eventData: Event): Promise<Event>
```

**返回值说明**:
- 如果 `eventData.id` 以 `temp-` 或 `timer-` 开头，调用 `EventService.createEvent()`，返回生成的 UUID
- 否则调用 `EventService.updateEvent()`，返回更新后的 Event 对象
- 返回值包含所有字段，包括 `outlookEventId`、`outlookCalendarId`（如果已同步）

**使用示例**（TimeCalendar PRD L1645）:
```typescript
const savedEvent = await EventHub.saveEvent(eventData);

// 如果是 Outlook 事件，触发同步
if (savedEvent.outlookCalendarId) {
  await ActionBasedSyncManager.getInstance().syncSpecificCalendar(
    savedEvent.outlookCalendarId
  );
}
```

### 10.2 syncStatus 枚举定义

**类型定义**:
```typescript
type SyncStatus = 
  | 'local-only'    // 本地创建，未同步
  | 'synced'        // 已同步到 Outlook
  | 'pending'       // 等待同步
  | 'conflict'      // 同步冲突
  | 'error';        // 同步失败
```

**状态转换**:
```mermaid
graph LR
    A[local-only] -->|用户请求同步| B[pending]
    B -->|同步成功| C[synced]
    B -->|同步失败| D[error]
    B -->|检测到冲突| E[conflict]
    C -->|本地修改| B
    D -->|重试| B
    E -->|用户解决冲突| B
```

**各状态说明**:

| 状态 | 触发时机 | UI 显示 | 用户操作 |
|------|----------|---------|---------|
| `local-only` | 创建事件、Timer 启动 | 无同步图标 | 可点击"同步到 Outlook" |
| `pending` | Timer 停止、用户修改事件 | 同步中图标（旋转） | 等待同步完成 |
| `synced` | 同步成功 | 对勾图标 | 可继续编辑（会重新进入 pending） |
| `error` | 网络错误、API 限流 | 错误图标 | 点击重试 |
| `conflict` | 本地和远程版本不一致 | 警告图标 | 打开冲突解决界面 |

---

**文档版本**: v1.4  
**最后更新**: 2025-11-11  
**维护者**: GitHub Copilot  
**更新日志**:
- v1.4 (2025-11-11): **BUG FIX v1.7.2** - 修复 Timer 创建时 startTime 计算问题
  - **问题**: 用户在 EditModal 中停留较久时，startTime 会以打开 Modal 的时间为准，而非点击确定的时间
  - **原因**: `handleTimerEditSave` 中使用 `updatedEvent.startTime`（打开 Modal 时设置）作为默认值
  - **修复**: 改为使用 `confirmTime`（点击确定时的时间）作为默认值，仅当用户手动修改时间（差异 >1 分钟）才使用用户设置的时间
  - **影响文件**: `src/App.tsx` L815-835
  - **测试场景**: 
    - ✅ 用户打开 EditModal 停留 5 分钟后点击确定 → startTime 为点击确定的时间
    - ✅ 用户手动修改开始时间为 10:00 后点击确定 → startTime 为 10:00（保留用户设置）
- v1.3 (2025-11-10): **性能优化 v1.7.1** - 移除 App.tsx 中旧计时器系统（seconds, isActive, taskName, intervalRef），解决每秒重渲染问题
- v1.2 (2025-11-05): **新增 Section 9**（与 PlanManager 的集成）和 **Section 10**（EventHub API 规范补充）
- v1.2 (2025-11-05): 补充 `EventHub.saveEvent()` 返回值定义和 `syncStatus` 枚举
- v1.1 (2025-11-05): 添加"已知问题与修复历史"章节，记录 description 覆盖 bug 的修复
- v1.1 (2025-11-05): 完善 6.2 节，详细说明 `handleTimerEditSave` 的双重更新机制
- v1.1 (2025-11-05): 更新 5.2 节，说明 `saveTimerEvent` 如何配合用户编辑保存
- v1.0 (2025-11-05): 初始版本，完整记录 Timer 模块的设计与实现

**相关文档**:
- [PlanManager PRD](./PLANMANAGER_MODULE_PRD.md)
- [TimeCalendar PRD](./TIMECALENDAR_MODULE_PRD.md)
- [EventEditModal PRD](./EVENTEDITMODAL_MODULE_PRD.md)
- [App 架构 PRD](../architecture/APP_ARCHITECTURE_PRD.md) - 包含 Timer 性能优化详情
