# Plan 页面架构设计 ✅

## 🎯 核心设计理念 (2025-11-05 更新)

### ♻️ 统一架构：Event 为唯一数据源
**不再使用 PlanItem**，所有计划数据都是 Event，通过 `isPlan` 标记区分：
- **isPlan = true** → 显示在 Plan 页面
- **isPlan = false/undefined** → 仅在 TimeCalendar 显示

### 数据一致性
- ✅ **单一数据源**：只有 Event，消除了 PlanItem ↔ Event 同步问题
- ✅ **统一管理**：通过 EventService 和 EventHub 管理所有事件
- ✅ **TimeHub 集成**：时间字段通过 TimeHub 处理（EventHub 的底层依赖）

### Event 扩展字段（支持 Plan 功能）
```typescript
interface Event {
  // ... 基础字段
  isPlan?: boolean;      // 🆕 标记为 Plan 页面事件
  content?: string;      // 文本内容（富文本编辑）
  emoji?: string;        // emoji 图标
  color?: string;        // 自定义颜色
  dueDate?: string;      // 截止日期（任务类型）
  notes?: string;        // 备注
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  isCompleted?: boolean; // 完成状态
  level?: number;        // 层级缩进
  mode?: 'title' | 'description'; // 显示模式
  type?: 'todo' | 'task' | 'event'; // 类型标记
}
```

## 🎨 交互设计

### 1. 主界面布局（类似 TagManager）
```
┌─────────────────────┬──────────────────────┐
│   左侧：项目列表     │   右侧：详情编辑面板  │
│                     │                      │
│ ☐ 完成项目提案      │  📝 详细信息          │
│ 📅 团队周会         │                      │
│ 📋 学习 React       │  ⏰ 时间设置          │
│ ✨ [新建...]        │  🎯 优先级           │
│                     │  🏷️  标签             │
└─────────────────────┴──────────────────────┘
```

### 2. 输入交互
- **直接输入**：在列表中 contentEditable 输入框直接输入
- **按 Enter**：创建当前项，自动生成下一个新输入框
- **点击项目**：在右侧面板编辑详细信息
- **实时保存**：失焦自动保存标题

### 3. 类型自动判断
用户在右侧面板选择时间类型：
- [ ] 无日期（待办）
- [ ] 截止日期（任务）
- [ ] 时间段（日程）

系统自动设置 `type` 字段并同步到 Event。

## 📁 文件结构

### 主要文件
```
src/components/
├── PlanManager.tsx        # Plan 管理组件（直接使用 Event[]）
└── PlanManager.css        # 样式文件

src/types.ts               # Event 类型定义（包含 Plan 字段）
src/services/
├── EventService.ts        # Event CRUD
├── EventHub.ts           # Event 状态管理
└── TimeHub.ts            # 时间字段处理（EventHub 依赖）
```

## 🔧 技术实现

### ♻️ 数据流（2025-11-05 更新）

```
用户操作 → PlanManager → EventHub → TimeHub → EventService → localStorage
                              ↓
                          缓存管理
                              ↓
                         React 状态更新
```

### App.tsx 过滤逻辑
```typescript
// Plan 页面：过滤 isPlan=true 的事件
const filteredPlanItems = allEvents.filter((event: Event) => {
  if (!event.isPlan) return false;
  
  // TimeCalendar 创建的事件：只显示未过期的
  if (event.remarkableSource === true) {
    const endTime = new Date(event.endTime);
    return new Date() < endTime;
  }
  
  return true;
});
```

### PlanManager 组件接口
```typescript
export interface PlanManagerProps {
  items: Event[];  // 🔧 直接使用 Event[]，不再是 PlanItem[]
  onSave: (item: Event) => void;
  onDelete: (id: string) => void;
  availableTags?: string[];
  onCreateEvent?: (event: Event) => void;
  onUpdateEvent?: (eventId: string, updates: Partial<Event>) => void;
}
```

### Event 同步到 TimeCalendar
```typescript
const syncToUnifiedTimeline = (event: Event) => {
  // 所有 Plan 事件都会同步到 EventService
  // 通过 isPlan 标记区分显示位置
  EventService.updateEvent(event.id, {
    ...event,
    isPlan: true,  // 标记为 Plan 事件
  });
};
```
    title: `${item.emoji || ''}${item.title}`.trim(),
    startTime: item.startTime || item.dueDate || ...,
    endTime: item.endTime || item.dueDate || ...,
    isAllDay: !item.startTime && !!item.dueDate,
    isTask: type === 'task',  // Task 标记
    remarkableSource: true,
    // ...
  };

  if (item.eventId) {
    onUpdateEvent(item.eventId, event);
  } else {
    onCreateEvent(event);
  }
};
```

## 🎯 使用方法

### App.tsx 集成
```tsx
import PlanManager, { PlanItem } from './components/PlanManager';

// 在 case 'plan':
<PlanManager
  items={planItems}
  onSave={handleSavePlanItem}
  onDelete={handleDeletePlanItem}
  availableTags={availableTagsForEdit.map(t => t.name)}
  onCreateEvent={handleCreateEvent}
  onUpdateEvent={handleUpdateEvent}
/>
```

### 用户操作流程

1. **创建新项**
   - 点击 "+ 新建" 按钮
   - 或在最后一个项目按 Enter

2. **输入标题**
   - 在 contentEditable 输入框直接输入
   - 按 Enter 创建

3. **设置详情**
   - 点击项目在右侧编辑
   - 选择时间类型（无/截止日期/时间段）
   - 设置优先级、标签、emoji、备注

4. **保存**
   - 点击 "保存" 按钮
   - 自动同步到 UnifiedTimeline

## 🎨 UI/UX 特点

### 视觉设计
- **左右分栏**：类似 TagManager 的布局
- **优先级颜色**：左边框颜色表示优先级
- **类型图标**：📅 Event / 📋 Task / ☐ Todo
- **选中高亮**：蓝色背景 + 外框
- **完成状态**：半透明显示

### 交互体验
- **快速输入**：Enter 连续创建
- **即时编辑**：点击即可编辑
- **实时保存**：失焦自动保存
- **右侧详情**：不打断主流程

### 响应式
- 平板：左右分栏
- 手机：上下堆叠

## 📊 与 TimeCalendar 集成

### 显示规则
```
PlanItem 类型       TimeCalendar 显示位置
─────────────────────────────────────────
todo (无日期)       不显示
task (截止日期)     Task 列表
event (时间段)      日历视图
```

### 数据流
```
PlanManager (创建/编辑)
      ↓
自动判断类型 + 同步
      ↓
handleCreateEvent / handleUpdateEvent
      ↓
localStorage (STORAGE_KEYS.EVENTS)
      ↓
TimeCalendar / DesktopCalendarWidget (监听 storage 事件)
```

## 🔄 数据持久化

### LocalStorage 键
- `remarkable-plan-items`: PlanItem 数组
- `remarkable-events`: Event 数组（包含同步的）

### 启动加载
```typescript
useEffect(() => {
  const loadPlanItems = () => {
    const saved = localStorage.getItem(STORAGE_KEYS.PLAN_ITEMS);
    if (saved) {
      const items = JSON.parse(saved);
      setPlanItems(items);
    }
  };
  loadPlanItems();
}, []);
```

## ✅ 完成清单

- [x] 移除 FloatingButton 和旧 PlanItemEditor
- [x] 创建 PlanManager 组件
- [x] 实现 TagManager 风格布局
- [x] 实现 Enter 创建交互
- [x] 实现自动类型判断
- [x] UnifiedTimeline 同步逻辑
- [x] 右侧详情编辑面板
- [x] 时间设置（无/截止/时间段）
- [x] 优先级、标签、emoji 选择
- [x] 完整 CSS 样式
- [x] 响应式适配
- [x] App.tsx 集成

## 🚀 下一步

1. **测试 UnifiedTimeline 同步**
   - 创建有时间的 PlanItem
   - 在 TimeCalendar 中查看

2. **优化交互细节**
   - Backspace 删除空项
   - 方向键导航
   - 拖拽排序

3. **FloatingButton 格式化工具**（可选）
   - 文本选择时显示
   - 颜色、粗体、斜体等

---
📅 更新时间：2025-10-28  
👤 开发者：GitHub Copilot  
✨ 设计理念：简洁、高效、智能
