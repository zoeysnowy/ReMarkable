# UpcomingEventsPanel 使用文档

## 概述

`UpcomingEventsPanel` 是一个用于显示即将到来事件的面板组件，支持按时间筛选、事件排序、过期事件管理等功能。

## 核心功能

### 1. 时间筛选
- **今天**：显示今天 00:00 - 23:59 的事件
- **明天**：显示明天的事件  
- **本周**：显示本周（周一到周日）的事件
- **下周**：显示下周的事件
- **全部**：显示所有未来事件

### 2. 事件排序
事件按以下优先级排序：
1. **即将开始的事件**：按开始时间从近到远排序
2. **已过期事件**：
   - 默认收缩显示，点击展开
   - 按过期时间从近到远排序（刚过期的在前）

### 3. 条件渲染
每个事件卡片只显示有内容的字段：
- ✅ 有时间 → 显示时间和倒计时
- ✅ 有参会人 → 显示参会人列表
- ✅ 有地点 → 显示地点信息
- ✅ 有 EventLog → 显示预览（5行）
- ✅ 有 checkbox → 根据 `checkType` 显示

### 4. Checkbox 逻辑
- `checkType === 'none'` 或 `undefined` → 不显示 checkbox
- `checkType === 'once'` → 显示一次性 checkbox
- `checkType === 'recurring'` → 显示循环 checkbox

## 使用方式

### 基础用法

```typescript
import { UpcomingEventsPanel } from '../components/UpcomingEventsPanel';
import { EventService } from '../services/EventService';

function MyComponent() {
  const handleTimeFilterChange = (filter: TimeFilter) => {
    console.log('筛选器变更:', filter);
  };

  const handleEventClick = (event: Event) => {
    console.log('点击事件:', event);
    // 打开事件详情弹窗
  };

  const handleCheckboxChange = (eventId: string, checked: boolean) => {
    console.log('Checkbox 变更:', eventId, checked);
    // 更新事件的 checked 状态
    EventService.updateEvent(eventId, { checked });
  };

  return (
    <UpcomingEventsPanel
      onTimeFilterChange={handleTimeFilterChange}
      onEventClick={handleEventClick}
      onCheckboxChange={handleCheckboxChange}
    />
  );
}
```

**注意**：组件会自动从 `EventService.getAllEvents()` 获取数据，并监听 `eventsUpdated` 事件自动刷新。无需手动传入 events 数据
```

### Props 说明

| Prop | 类型 | 必需 | 说明 |
|------|------|------|------|
| `onTimeFilterChange` | `(filter: TimeFilter) => void` | ❌ | 时间筛选器变更回调 |
| `onEventClick` | `(event: Event) => void` | ❌ | 点击事件卡片回调 |
| `onCheckboxChange` | `(eventId: string, checked: boolean) => void` | ❌ | Checkbox 状态变更回调 |

**数据源**：组件内部自动从 `EventService.getAllEvents()` 获取数据，避免受 PlanManager Snapshot 模式影响

### TimeFilter 类型

```typescript
type TimeFilter = 'today' | 'tomorrow' | 'week' | 'nextWeek' | 'all';
```

## 工具函数

### 1. filterAndSortEvents

筛选并排序事件：

```typescript
import { filterAndSortEvents } from '../utils/upcomingEventsHelper';

const { upcoming, expired } = filterAndSortEvents(events, 'today');
console.log('即将开始:', upcoming);
console.log('已过期:', expired);
```

### 2. formatCountdown

格式化倒计时文本：

```typescript
import { formatCountdown } from '../utils/upcomingEventsHelper';

const countdown = formatCountdown(event);
// 输出: "还有2h" | "还有30min" | "还有3天" | undefined
```

### 3. formatTimeLabel

格式化时间显示：

```typescript
import { formatTimeLabel } from '../utils/upcomingEventsHelper';

const timeLabel = formatTimeLabel(event);
// 输出: "13:00-15:00" | "13:00开始" | "17:00截止" | "全天" | undefined
```

## 样式定制

组件使用 CSS Module，可以通过覆盖 CSS 变量来定制样式：

```css
.upcoming-events-panel {
  --primary-color: #3b82f6;
  --tag-color: #10b981;
  --expired-color: #9ca3af;
}
```

## 注意事项

### 1. Event 字段要求

确保 Event 对象包含以下必需字段：
- `id`: 事件唯一标识
- `title`: 事件标题
- `date`: 事件日期（YYYY-MM-DD 格式）
- `startTime`: 开始时间（HH:mm:ss 格式，可选）
- `endTime`: 结束时间（HH:mm:ss 格式，可选）

### 2. 标签处理

目前标签简化处理：
- 使用 `event.tags[0]` 作为主标签 ID
- 颜色使用 `event.color` 或默认灰色 `#6b7280`
- 显示文本使用 `event.category` 或标签 ID

**TODO**: 需要集成 `TagService` 获取标签的完整信息（名称、颜色等）

### 3. EventLog 预览

EventLog 字段可能是：
- 字符串（旧格式 HTML）
- EventLog 对象（新格式 Slate JSON）

需要在显示前进行类型检测和转换。

## 性能优化

组件使用 `useMemo` 优化性能：
- 事件筛选和排序结果会被缓存
- 只有当 `events`、`activeFilter` 或 `currentTime` 变化时才重新计算
- 每分钟更新一次当前时间，自动刷新倒计时

## 下一步

- [ ] 集成 TagService 获取标签完整信息
- [ ] 支持 EventLog 富文本预览
- [ ] 添加事件拖拽排序
- [ ] 支持批量操作（批量完成、删除等）
- [ ] 添加事件搜索功能
