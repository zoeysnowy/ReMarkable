# 完整调试日志指南

## 🎯 目标

通过详细的中文调试日志，追踪从**用户操作 → 数据更新 → UI显示**的完整数据流。

---

## 📋 已增强的日志模块

### 1. **UnifiedDateTimePicker（时间选择器）**

#### 记录内容：
- ✅ 用户点击的快捷按钮（明天、本周、下周、上午、下午、晚上）
- ✅ 用户点击日历选择的日期范围
- ✅ 最终提交时的日期、时间、快捷按钮状态
- ✅ TimeHub 写入的参数（eventId, startIso, endIso, allDay）
- ✅ 写入成功/失败状态

#### 日志示例：
```
[picker] 👆 用户点击快捷按钮: 下午
  { 目标日期: '2025-11-06', 时间范围: '12:00 - 18:00' }

[picker] 🎯 UnifiedDateTimePicker 点击确定
  { 
    选择的日期: { start: '2025-11-06', end: '2025-11-06' },
    选择的时间: { startTime: {hour: 12, minute: 0}, endTime: {hour: 18, minute: 0} },
    快捷按钮: 'afternoon',
    计算后的DateTime: { start: '2025-11-06 12:00', end: '2025-11-06 18:00' }
  }

[picker] 📝 准备写入 TimeHub
  { eventId: 'event-xxx', startIso: '2025-11-06 12:00', endIso: '2025-11-06 18:00', allDaySelected: false }

[picker] ✅ TimeHub 写入成功，准备调用 onApplied
  { eventId: 'event-xxx' }
```

---

### 2. **TimeHub（时间数据中心）**

#### 记录内容：
- ✅ setEventTime 的输入参数（start, end, kind, allDay, source）
- ✅ 标准化后的时间值
- ✅ 持久化到 EventService 的数据
- ✅ 缓存更新状态
- ✅ 订阅者数量
- ✅ timeChanged 事件广播

#### 日志示例：
```
[timehub] 📥 收到 setEventTime 调用
  { 
    eventId: 'event-xxx',
    输入start: '2025-11-06T12:00',
    输入end: '2025-11-06T18:00',
    kind: 'range',
    allDay: false,
    source: 'picker'
  }

[timehub] 🔄 标准化后的时间
  { 标准化start: '2025-11-06 12:00', 标准化end: '2025-11-06 18:00' }

[timehub] 💾 准备持久化到 EventService
  { 
    eventId: 'event-xxx',
    更新的startTime: '2025-11-06 12:00',
    更新的endTime: '2025-11-06 18:00',
    isAllDay: false
  }

[timehub] ✅ 持久化成功，缓存已更新，准备通知订阅者
  { 
    eventId: 'event-xxx',
    快照start: '2025-11-06 12:00',
    快照end: '2025-11-06 18:00',
    allDay: false,
    订阅者数量: 1
  }

[timehub] 📡 已广播 timeChanged 事件
  { eventId: 'event-xxx' }
```

---

### 3. **PlanManager（计划管理器 UI）**

#### 记录内容：
- ✅ PlanItemTimeDisplay 接收的快照数据
- ✅ TimeHub 快照 vs PlanItem 本地时间
- ✅ 最终渲染到右侧的时间值
- ✅ onTimeApplied 回调的参数和执行路径
- ✅ 对应的 itemId 和 eventId

#### 日志示例：
```
[ui] 🖼️ PlanItemTimeDisplay 快照更新
  {
    itemId: 'plan-xxx',
    eventId: 'event-xxx',
    TimeHub快照start: '2025-11-06 12:00',
    TimeHub快照end: '2025-11-06 18:00',
    TimeHub快照allDay: false,
    item本地startTime: null,
    item本地endTime: null,
    最终渲染的start: '2025-11-06T12:00:00.000Z',
    最终渲染的end: '2025-11-06T18:00:00.000Z'
  }

[picker] 📌 HeadlessFloatingToolbar.onTimeApplied 被调用 (TimeHub已更新)
  {
    startIso: '2025-11-06 12:00',
    endIso: '2025-11-06 18:00',
    focusedLineId: 'plan-xxx',
    对应的eventId: 'event-xxx'
  }

[picker] 💾 onTimeApplied: 保存 item (仅非时间字段)
  { itemId: 'plan-xxx', eventId: 'event-xxx', isDescriptionMode: false, 内容长度: 120 }

[picker] ✅ Event 更新成功
  { eventId: 'event-xxx' }
```

---

### 4. **EventService（事件持久化服务）**

#### 记录内容：
- ✅ 创建/更新 Event 的参数
- ✅ 更新的字段列表
- ✅ 最终保存的时间值
- ✅ 事件总数
- ✅ 成功/失败状态

#### 日志示例：
```
[EventService] ✏️ Updating event: event-xxx

[EventService] 📋 更新字段:
  {
    eventId: 'event-xxx',
    更新的字段: ['startTime', 'endTime', 'updatedAt'],
    startTime: '2025-11-06 12:00',
    endTime: '2025-11-06 18:00',
    title: '测试任务',
    isAllDay: false
  }

[EventService] 💾 Event updated in localStorage

[EventService] ✅ 更新成功:
  {
    eventId: 'event-xxx',
    title: '测试任务',
    startTime: '2025-11-06 12:00',
    endTime: '2025-11-06 18:00',
    isAllDay: false
  }
```

---

## 🔍 如何使用调试日志

### 步骤 1: 启用调试日志

在浏览器控制台输入：

```javascript
localStorage.RE_DEBUG = '1'
```

然后刷新页面。

### 步骤 2: 重现问题

1. 在计划项中点击右侧时间区域，打开选择器
2. 点击快捷按钮（如"下午"）或手动选择日期时间
3. 点击"确定"

### 步骤 3: 查看完整日志链路

在控制台中按时间顺序查看：

1. **用户操作日志**（蓝色）
   - `[picker] 👆 用户点击快捷按钮`
   - `[picker] 👆 用户点击日历`

2. **数据写入日志**（蓝色）
   - `[picker] 🎯 点击确定`
   - `[picker] 📝 准备写入 TimeHub`
   - `[timehub] 📥 收到 setEventTime 调用`
   - `[timehub] 🔄 标准化后的时间`
   - `[timehub] 💾 准备持久化`

3. **持久化日志**
   - `[EventService] ✏️ Updating event`
   - `[EventService] ✅ 更新成功`

4. **UI 更新日志**（蓝色）
   - `[timehub] ✅ 持久化成功，准备通知订阅者`
   - `[timehub] 📡 已广播 timeChanged 事件`
   - `[ui] 🖼️ PlanItemTimeDisplay 快照更新`

5. **回调执行日志**（蓝色）
   - `[picker] 📌 HeadlessFloatingToolbar.onTimeApplied 被调用`
   - `[picker] 💾 onTimeApplied: 保存 item`
   - `[picker] ✅ Event 更新成功`

---

## ⚠️ 常见问题诊断

### 问题 1: 点击"下午"后出现 📅 mention

**查看日志中是否有：**
```
[picker] 📝 使用旧回调 onSelect (非TimeHub模式)
```

**原因：** 走了错误的代码路径（legacy 路径），应该走 TimeHub 路径。

**检查日志中的条件判断：**
```
[picker] 🚀 handleApply 被调用
  { 
    useTimeHub: true/false,
    eventId: 'event-xxx' 或 undefined,
    条件判断: 'useTimeHub=true && eventId=undefined => false'
  }
```

**已修复：** 现在即使 `eventId` 为 `undefined`，只要 `useTimeHub=true`，就会走 TimeHub 路径：
1. 先调用 `onTimeApplied`
2. 外层创建新 Event
3. 写入 TimeHub
4. 回写 eventId 到 item

**新的日志流程：**
```
[picker] 🆕 TimeHub 模式但没有 eventId，先调用 onApplied
[picker] 🆕 创建新 Event (item 没有 eventId)
[EventService] ✅ 创建成功
[picker] ✅ TimeHub 写入成功，回写 eventId 到 item
```

---

### 问题 2: 右侧时间显示为 12:00→12:00（应该是 12:00→18:00）

**查看日志链路：**
1. Picker 提交的数据：
   ```
   [picker] 📝 准备写入 TimeHub
     { endIso: '2025-11-06 18:00' }  ← 检查这里是否正确
   ```

2. TimeHub 标准化后的数据：
   ```
   [timehub] 🔄 标准化后的时间
     { 标准化end: '2025-11-06 18:00' }  ← 检查这里是否正确
   ```

3. EventService 持久化的数据（第一次）：
   ```
   [EventService] ✅ 更新成功:
     { endTime: '2025-11-06 18:00' }  ← 检查这里是否正确
   ```

4. **检查是否有第二次更新覆盖：**
   ```
   [EventService] ✏️ Updating event: event-xxx
   [EventService] 更新字段: { endTime: '2025-11-06 15:59' }  ← ❌ 旧时间覆盖！
   ```

**已修复：** 移除了 `onTimeApplied` 中的 `syncToUnifiedTimeline` 调用，避免用 item 的旧时间覆盖 TimeHub 刚写入的新时间。

5. UI 渲染的数据：
   ```
   [ui] 🖼️ PlanItemTimeDisplay 快照更新
     { 最终渲染的end: '2025-11-06T18:00:00.000Z' }  ← 检查这里是否正确
   ```

---

### 问题 3: 点击确定后右侧时间没有更新

**检查订阅者通知：**
```
[timehub] ✅ 持久化成功，准备通知订阅者
  { 订阅者数量: 0 }  ← 如果是 0，说明没有订阅者
```

**原因：** PlanItemTimeDisplay 没有订阅 TimeHub。

**检查：** itemId 和 eventId 是否正确关联？

---

## 📊 日志分类

| 分类 | 标签 | 颜色 | 用途 |
|------|------|------|------|
| 用户操作 | `[picker]` | 蓝色 | 追踪用户点击了什么 |
| 数据流转 | `[timehub]` | 蓝色 | 追踪 TimeHub 的数据处理 |
| UI 更新 | `[ui]` | 蓝色 | 追踪界面如何响应数据变化 |
| 持久化 | `[EventService]` | 默认 | 追踪 localStorage 存储 |
| 警告 | `⚠️` | 橙色 | 不应该出现的代码路径 |
| 错误 | `❌` | 红色 | 失败/异常情况 |

---

## 🎨 日志格式说明

所有调试日志包含**中文时间戳**，格式为：`[HH:mm:ss.SSS]`

示例：
```
[14:23:15.123] [picker] 👆 用户点击快捷按钮: 下午
```

这样你可以精确追踪每个操作的时间顺序。

---

## 🚀 下一步

现在日志已经非常详细，你可以：

1. 启用 `localStorage.RE_DEBUG = '1'`
2. 重现问题
3. 复制控制台日志
4. 分析完整的数据流

如果仍有问题，请提供完整的控制台日志，我可以帮你诊断！
