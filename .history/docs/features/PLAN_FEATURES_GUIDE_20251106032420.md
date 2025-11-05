# Plan 页面功能指南

> **最后更新**: 2025-11-06  
> **状态**: ✅ 已实现

---

## 📋 目录

1. [架构设计](#架构设计)
2. [核心组件](#核心组件)
3. [双模式输入](#双模式输入)
4. [数据结构](#数据结构)
5. [使用指南](#使用指南)

---

## 架构设计

### 核心理念

**统一架构：Event 为唯一数据源**

- ✅ **单一数据源**：只有 Event，不再使用 PlanItem
- ✅ **isPlan 标记**：通过 `isPlan: true` 区分 Plan 页面事件
- ✅ **EventHub 管理**：所有事件通过 EventService 和 EventHub 统一管理
- ✅ **TimeHub 集成**：时间字段通过 TimeHub 处理

### Event 扩展字段（支持 Plan 功能）

```typescript
interface Event {
  // 基础字段
  id: string;
  title: string;
  description?: string;
  
  // Plan 特定字段
  isPlan?: boolean;           // 🆕 标记为 Plan 页面事件
  content?: string;           // 富文本内容（HTML）
  emoji?: string;             // Emoji 图标
  color?: string;             // 自定义颜色
  dueDate?: string;           // 截止日期
  notes?: string;             // 备注
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isCompleted?: boolean;      // 完成状态
  level?: number;             // 层级缩进 (0-5)
  mode?: 'title' | 'description';  // 当前输入模式
  type?: 'todo' | 'task' | 'event'; // 类型
  
  // 标签和时间
  tags?: string[];
  start?: Date;
  end?: Date;
}
```

### 组件架构

```
PlanManager (容器组件)
  ├─ PlanItemEditor (编辑器)
  │   ├─ Emoji Picker
  │   ├─ Color Picker
  │   ├─ Priority Selector
  │   ├─ Tag Manager
  │   ├─ Time Picker
  │   └─ Timer
  ├─ FloatingButton (快速操作)
  │   ├─ 新建计划
  │   ├─ 快速任务
  │   └─ 日程安排
  └─ FloatingToolbar (文本工具栏)
      ├─ 格式化工具
      ├─ 标签插入
      ├─ 时间插入
      └─ Emoji 插入
```

---

## 核心组件

### 1. PlanItemEditor

**功能特性**:
- 📝 **富文本编辑**：支持 emoji、标签、颜色、项目符号
- ⏰ **时间管理**：开始/结束时间、计时器、时长跟踪
- 🎯 **优先级**：四级优先级（低/中/高/紧急）
- 🏷️ **标签管理**：多标签选择、快速创建
- 🔄 **自动同步**：与 UnifiedTimeline 自动同步

**安装依赖**:
```bash
npm install @emoji-mart/react @emoji-mart/data --legacy-peer-deps
```

**基础用法**:
```typescript
import { PlanItemEditor } from '@/components/PlanItemEditor';

function PlanPage() {
  const [event, setEvent] = useState<Event>({
    id: generateId(),
    isPlan: true,
    title: '',
    level: 0
  });
  
  return (
    <PlanItemEditor
      event={event}
      onChange={(updated) => setEvent(updated)}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  );
}
```

### 2. FloatingButton

**快速操作**:
- 📝 **新建计划**：创建空白计划项
- ✓ **快速任务**：带 checkbox 的任务
- 📅 **日程安排**：预设 1 小时时段的事件

**配置位置和方向**:
```typescript
<FloatingButton
  position="bottom-right"  // top-left | top-right | bottom-left | bottom-right
  direction="up"           // up | down | left | right
  actions={[
    { icon: <FaPlus />, label: '新建计划', onClick: handleCreate },
    { icon: <FaCheck />, label: '快速任务', onClick: handleTask },
    { icon: <FaCalendar />, label: '日程', onClick: handleSchedule }
  ]}
/>
```

---

## 双模式输入

### 功能概述

每个计划项支持 **Title/Description 双模式** 输入：
- **Title 模式**: 简短标题，用于列表显示
- **Description 模式**: 详细描述，支持多行文本

### 数据模型

```typescript
interface Event {
  id: string;
  title: string;              // Title 内容
  content?: string;           // Title 的 HTML 格式
  description?: string;       // Description 的 HTML 格式
  mode?: 'title' | 'description'; // 当前模式
}
```

### 编辑器行映射

每个 Event 最多生成 2 行：
1. **Title 行**: `id = event.id`
2. **Description 行**: `id = event.id + '-desc'` (仅在有 description 时)

### 键盘快捷键

| 快捷键 | Title 模式 | Description 模式 |
|--------|-----------|------------------|
| `Enter` | 创建新的同级 Event | 换行 |
| `Shift+Enter` | 切换到 Description 模式 | 切换回 Title 模式 |
| `Backspace` | 空行删除当前 Event | 空行切换回 Title |
| `Tab` | 增加缩进 | 增加缩进 |
| `Shift+Tab` | 减少缩进 | 减少缩进 |

### 模式切换逻辑

```typescript
// PlanManager.tsx
const handleShiftEnter = (lineId: string) => {
  const event = events.find(e => e.id === lineId || lineId === e.id + '-desc');
  if (!event) return;
  
  if (lineId === event.id) {
    // Title → Description：创建 description 行
    if (!event.description) {
      updateEvent(event.id, { 
        description: '', 
        mode: 'description' 
      });
    }
    focusLine(event.id + '-desc');
  } else {
    // Description → Title：切换回标题
    updateEvent(event.id, { mode: 'title' });
    focusLine(event.id);
  }
};
```

### 智能关联模式

FloatingToolbar 根据当前模式自动调整标签和时间的关联：

- **Title 模式**: Tag/Time → **关联到 Event 元数据**
  - 影响筛选、搜索、日历显示
  - 同步到 Outlook

- **Description 模式**: Tag/Time → **仅作为 mention 显示**
  - 纯视觉展示，不影响元数据
  - 不同步到远程

**模式检测**:
```typescript
const [currentFocusedMode, setCurrentFocusedMode] = useState<'title' | 'description'>('title');

const handleFocus = (e: FocusEvent) => {
  const target = e.target as HTMLElement;
  const lineId = target.getAttribute('data-line-id');
  const isDescriptionLine = lineId?.includes('-desc');
  setCurrentFocusedMode(isDescriptionLine ? 'description' : 'title');
};
```

---

## 数据结构

### Event 完整接口

```typescript
interface Event {
  // 基础标识
  id: string;
  isPlan?: boolean;
  
  // 内容
  title: string;
  content?: string;           // Title HTML
  description?: string;       // Description HTML
  notes?: string;             // 备注
  
  // 显示
  emoji?: string;
  color?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  level?: number;             // 缩进层级 0-5
  mode?: 'title' | 'description';
  
  // 分类
  tags?: string[];
  type?: 'todo' | 'task' | 'event';
  
  // 时间
  start?: Date;
  end?: Date;
  dueDate?: string;
  allDay?: boolean;
  
  // 状态
  isCompleted?: boolean;
  
  // 同步
  externalId?: string;
  syncStatus?: 'pending' | 'synced' | 'error';
  lastModified?: Date;
}
```

### 与 EventService 集成

```typescript
import EventService from '@/services/EventService';

// 创建 Plan 事件
const createPlanEvent = async (title: string) => {
  const event: Event = {
    id: generateId(),
    isPlan: true,
    title,
    level: 0,
    priority: 'medium',
    tags: []
  };
  
  await EventService.createEvent(event);
  return event;
};

// 更新事件
const updatePlanEvent = async (id: string, updates: Partial<Event>) => {
  await EventService.updateEvent(id, updates);
};

// 查询 Plan 事件
const loadPlanEvents = async () => {
  const allEvents = await EventService.getEvents();
  return allEvents.filter(e => e.isPlan === true);
};
```

---

## 使用指南

### 快速开始

1. **创建计划项**
   ```typescript
   const newEvent = {
     id: generateId(),
     isPlan: true,
     title: '新计划',
     level: 0
   };
   await EventService.createEvent(newEvent);
   ```

2. **添加标签**
   ```typescript
   await EventService.updateEvent(eventId, {
     tags: ['工作', '紧急']
   });
   ```

3. **设置时间**
   ```typescript
   await EventService.updateEvent(eventId, {
     start: new Date('2025-11-06 09:00'),
     end: new Date('2025-11-06 10:00')
   });
   ```

4. **设置优先级**
   ```typescript
   await EventService.updateEvent(eventId, {
     priority: 'high'
   });
   ```

### 层级管理

**增加缩进**:
```typescript
const increaseLevel = (eventId: string) => {
  const event = events.find(e => e.id === eventId);
  if (event && event.level < 5) {
    EventService.updateEvent(eventId, {
      level: event.level + 1
    });
  }
};
```

**减少缩进**:
```typescript
const decreaseLevel = (eventId: string) => {
  const event = events.find(e => e.id === eventId);
  if (event && event.level > 0) {
    EventService.updateEvent(eventId, {
      level: event.level - 1
    });
  }
};
```

### 富文本编辑

**插入 Emoji**:
```typescript
import { insertEmoji } from '@/components/UnifiedSlateEditor/helpers';

const handleEmojiSelect = (emoji: string) => {
  insertEmoji(editor, emoji);
};
```

**插入标签**:
```typescript
import { insertTag } from '@/components/UnifiedSlateEditor/helpers';

const handleTagSelect = (tag: Tag) => {
  if (currentFocusedMode === 'title') {
    // Title 模式：更新元数据
    EventService.updateEvent(eventId, {
      tags: [...event.tags, tag.name]
    });
  } else {
    // Description 模式：插入 mention
    insertTag(editor, tag);
  }
};
```

### 计时器功能

```typescript
import { Timer } from '@/components/PlanItemEditor';

// 开始计时
const startTimer = () => {
  timer.start();
};

// 暂停计时
const pauseTimer = () => {
  timer.pause();
};

// 重置计时
const resetTimer = () => {
  timer.reset();
};

// 保存时长
const saveElapsedTime = () => {
  EventService.updateEvent(eventId, {
    elapsedTime: timer.elapsedSeconds
  });
};
```

---

## 最佳实践

### 1. 数据一致性

✅ **统一使用 EventService**
```typescript
// ✅ 正确
await EventService.updateEvent(id, updates);

// ❌ 错误：直接修改状态
setEvents(events.map(e => e.id === id ? { ...e, ...updates } : e));
```

### 2. 性能优化

✅ **使用 EventHub 批量更新**
```typescript
import EventHub from '@/services/EventHub';

// 批量更新多个字段
await EventHub.updateFields(eventId, {
  title: '新标题',
  tags: ['标签1', '标签2'],
  priority: 'high'
}, { source: 'PlanManager' });
```

### 3. 错误处理

```typescript
const updateEvent = async (id: string, updates: Partial<Event>) => {
  try {
    await EventService.updateEvent(id, updates);
  } catch (error) {
    console.error('更新失败:', error);
    toast.error('保存失败，请重试');
  }
};
```

### 4. 键盘快捷键

推荐的快捷键配置：
- `Ctrl/Cmd + Enter`: 快速保存
- `Ctrl/Cmd + D`: 复制当前项
- `Ctrl/Cmd + Shift + ↑/↓`: 移动顺序
- `Ctrl/Cmd + /`: 切换完成状态

---

## 常见问题

### Q: Plan 事件会同步到 TimeCalendar 吗？

**A**: 是的，设置了 `start` 和 `end` 时间的 Plan 事件会自动显示在 TimeCalendar 中。

### Q: 如何区分 TODO 和 Task？

**A**: 通过 `type` 字段：
- `todo`: 简单待办（无时间）
- `task`: 任务（有截止日期）
- `event`: 事件（有明确时间段）

### Q: 层级最多支持多少级？

**A**: 支持 0-5 级，共 6 级缩进（24px/级）。

### Q: Description 模式下插入的标签会同步吗？

**A**: 不会。Description 中的标签仅作为 mention 显示，不影响 Event 的 `tags` 元数据。

---

## 相关文档

- `docs/PRD/PLANMANAGER_MODULE_PRD.md` - 完整的 PRD 文档
- `docs/SLATE_DEVELOPMENT_GUIDE.md` - Slate 编辑器开发指南
- `docs/features/FLOATING_TOOLBAR_GUIDE.md` - 浮动工具栏使用
- `docs/architecture/EventService-Architecture.md` - EventService 架构

---

**维护者**: ReMarkable Team  
**最后更新**: 2025-11-06
