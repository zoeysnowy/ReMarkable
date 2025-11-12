# SyncTargetPicker 使用文档

## 📋 功能概述

`SyncTargetPicker` 是一个智能同步目标选择器，**完全复用 CalendarPicker 的 UI 风格**，可以根据事件是否有时间字段，自动在 **Calendar Picker** 和 **To Do List Picker** 之间切换，同时保留双方的选择状态。

## 🎨 设计理念

**无缝体验，样式统一**：
- ✅ 完全复用 `CalendarPicker.css` 样式
- ✅ 相同的候选框、下拉列表、芯片标签风格
- ✅ 一致的交互动画和颜色设计
- ✅ 用户无需适应新的 UI 风格

## 🎯 核心特性

### 1. 完全一致的 UI 风格

SyncTargetPicker 与 CalendarPicker 在视觉上**完全一致**：

**CalendarPicker**:
```
┌─────────────────────────────────────────────┐
│ [工作日历] [个人日历] 搜索...               │
└─────────────────────────────────────────────┘
  ↓ 点击展开
┌─────────────────────────────────────────────┐
│ 选择日历                               ✕   │
├─────────────────────────────────────────────┤
│ ☐ ● 工作日历                               │
│ ☑ ● 个人日历                               │
│ ☐ ● 项目日历                               │
└─────────────────────────────────────────────┘
```

**SyncTargetPicker (事件模式)**:
```
┌─────────────────────────────────────────────┐
│ [工作日历] [个人日历] 选择日历...           │
└─────────────────────────────────────────────┘
  ↓ 点击展开（完全相同的样式）
┌─────────────────────────────────────────────┐
│ 选择日历                               ✕   │
├─────────────────────────────────────────────┤
│ ☐ ● 工作日历                               │
│ ☑ ● 个人日历                               │
│ ☐ ● 项目日历                               │
└─────────────────────────────────────────────┘
```

**SyncTargetPicker (任务模式)**:
```
💡 检测到已选择 2 个日历，添加时间后将同步到日历

┌─────────────────────────────────────────────┐
│ [工作任务] 选择任务列表...                  │
└─────────────────────────────────────────────┘
  ↓ 点击展开（相同样式，不同颜色）
┌─────────────────────────────────────────────┐
│ 选择任务列表                           ✕   │
├─────────────────────────────────────────────┤
│ ☑ ● 工作任务（绿色）                        │
│ ☐ ● 今日待办（绿色）                        │
└─────────────────────────────────────────────┘
```

### 2. 智能切换
- **有时间** (`startTime && endTime`) → 显示 **Outlook Calendar Picker**
- **无时间** (`!startTime || !endTime`) → 显示 **Microsoft To Do List Picker**

### 3. 双状态保留
用户在两种模式下的选择会被**同时保存**，切换时不会丢失数据：

```typescript
// 场景 1: 用户选择了 Calendar，然后删除时间
✅ Calendar 选择保留在 event.calendarIds
✅ 界面切换到 To Do List Picker
✅ 用户可以选择 To Do Lists → 保存到 event.todoListIds
✅ 如果用户重新添加时间 → 界面回到 Calendar Picker
✅ 之前选择的 Calendars 仍然存在！

// 场景 2: 用户选择了 To Do Lists，然后添加时间
✅ To Do List 选择保留在 event.todoListIds
✅ 界面切换到 Calendar Picker
✅ 用户可以选择 Calendars → 保存到 event.calendarIds
✅ 如果用户删除时间 → 界面回到 To Do List Picker
✅ 之前选择的 To Do Lists 仍然存在！
```

### 4. 提示信息
当用户切换状态时，会显示友好的提示：

```typescript
// 当前是任务模式，但已选择了 Calendars
💡 检测到已选择 2 个日历，添加时间后将同步到日历

// 当前是事件模式，但已选择了 To Do Lists
💡 检测到已选择 1 个任务列表，删除时间后将同步到任务列表
```

## 📦 使用方法

### 在 EventEditModal 中集成

```tsx
import { SyncTargetPicker } from './EventEditModal/SyncTargetPicker';

export const EventEditModal: React.FC<EventEditModalProps> = ({
  event,
  availableCalendars,
  availableTodoLists, // 🆕 传入可用的 To Do Lists
  // ... 其他 props
}) => {
  const [formData, setFormData] = useState({
    // ... 其他字段
    calendarIds: [] as string[],
    todoListIds: [] as string[], // 🆕 添加 To Do List IDs
  });

  return (
    <div className="event-edit-modal">
      {/* ... 其他表单字段 ... */}
      
      {/* 同步目标选择器 */}
      <SyncTargetPicker
        event={formData}
        onCalendarIdsChange={(calendarIds) => {
          setFormData(prev => ({ ...prev, calendarIds }));
        }}
        onTodoListIdsChange={(todoListIds) => {
          setFormData(prev => ({ ...prev, todoListIds }));
        }}
        availableCalendars={availableCalendars}
        availableTodoLists={availableTodoLists}
      />
    </div>
  );
};
```

### 获取 To Do Lists 数据

```typescript
// 在父组件中获取 To Do Lists
import { MicrosoftTodoService } from '../services/MicrosoftTodoService';

const [availableTodoLists, setAvailableTodoLists] = useState([]);

useEffect(() => {
  async function fetchTodoLists() {
    const todoService = new MicrosoftTodoService(msalClient);
    const lists = await todoService.getTaskLists();
    
    setAvailableTodoLists(
      lists.map(list => ({
        id: list.id,
        name: list.displayName,
        color: '#10b981', // To Do 默认绿色
      }))
    );
  }
  
  fetchTodoLists();
}, []);
```

## 🔧 Event Interface 扩展

确保你的 Event 类型包含以下字段：

```typescript
export interface Event {
  // ... 现有字段 ...
  
  calendarIds?: string[];   // Outlook Calendar IDs（多选）
  todoListIds?: string[];   // Microsoft To Do List IDs（多选）
  
  startTime: string;        // 用于判断是否为任务
  endTime: string;          // 用于判断是否为任务
}
```

## 🎨 样式定制

组件**完全复用** CalendarPicker 的样式，无需额外定制：

```tsx
// 自动引入 CalendarPicker 样式
import '../../features/Calendar/styles/CalendarPicker.css';
```

所有 UI 元素都使用相同的 class：
- `.calendar-picker` - 主容器
- `.selected-calendars-with-search` - 已选项 + 搜索框
- `.calendar-chip` - 芯片标签（透明毛玻璃质感 + 彩色边框）
- `.calendar-dropdown` - 下拉列表
- `.filter-item` - 候选项
- `.calendar-dot` - 颜色圆点

**样式特点**：
- 🎨 **透明毛玻璃质感芯片**：`background: rgba(255, 255, 255, 0.6)` + `backdrop-filter: blur(8px)`
- 🌈 **彩色边框**：根据 Calendar/To Do List 的颜色动态设置
- ✨ **优雅动画**：hover 时向上浮动 + 阴影效果
- 📦 **内联搜索**：已选项和搜索框在同一行，无边框设计

### 颜色自定义

Calendar 和 To Do List 可以有不同的默认颜色：

```typescript
const getItemColor = (item: any) => {
  return item.color || (isTask ? '#10b981' : '#3b82f6');
  //                    ^^^^^^^^   ^^^^^^^^
  //                    To Do 绿色  Calendar 蓝色
};
```

## 🔍 调试模式

开发环境下会显示调试信息：

```typescript
{
  "isTask": false,
  "hasTime": true,
  "calendarIds": ["calendar-1", "calendar-2"],
  "todoListIds": ["list-1"]
}
```

这有助于验证状态切换和数据保留是否正确工作。

## ⚡ 性能优化

组件使用 `useMemo` 来计算 `isTask` 状态，只有当 `startTime` 或 `endTime` 变化时才会重新计算：

```typescript
const isTask = useMemo(() => {
  return !event.startTime || !event.endTime;
}, [event.startTime, event.endTime]);
```

## 🧪 测试场景

### 场景 1: 任务 → 事件
1. 创建新事件，不填写时间（任务模式）
2. 选择 To Do List: "工作任务"
3. 填写开始时间和结束时间
4. ✅ 界面切换到 Calendar Picker
5. 选择 Calendar: "工作日历"
6. 保存
7. ✅ `event.todoListIds = ["工作任务"]`
8. ✅ `event.calendarIds = ["工作日历"]`

### 场景 2: 事件 → 任务
1. 打开已有事件（有时间）
2. 当前选择了 Calendar: "工作日历", "个人日历"
3. 删除开始时间或结束时间
4. ✅ 界面切换到 To Do List Picker
5. ✅ 显示提示: "检测到已选择 2 个日历，添加时间后将同步到日历"
6. 选择 To Do List: "今日待办"
7. 保存
8. ✅ `event.calendarIds = ["工作日历", "个人日历"]` 保留
9. ✅ `event.todoListIds = ["今日待办"]`

### 场景 3: 反复切换
1. 创建事件 → 选择 Calendar A
2. 删除时间 → 选择 To Do List B
3. 添加时间 → Calendar A 仍然勾选 ✅
4. 删除时间 → To Do List B 仍然勾选 ✅
5. 保存时两者都保留 ✅

## 🚀 未来扩展

### 支持的扩展方向

1. **单选模式**: 添加 `mode: 'single' | 'multiple'` prop
2. **最大选择数**: 分别限制 Calendar 和 To Do List 的最大选择数
3. **分组显示**: 支持 Calendar 和 To Do List 的分组折叠
4. **快捷操作**: "全选"、"清空"、"反选" 按钮
5. **拖拽排序**: 调整已选 Calendar/To Do List 的优先级
6. **同步状态**: 显示每个目标的同步状态图标

## 📝 注意事项

1. **数据保存**: 确保在 `handleSave` 中同时保存 `calendarIds` 和 `todoListIds`
2. **同步逻辑**: `ActionBasedSyncManager` 需要根据 `isTask` 路由到不同的同步服务
3. **初始化**: 打开 Modal 时需要从 `event` 中加载两个字段
4. **空状态**: 未选择任何目标时，显示警告提示
5. **权限**: 确保用户已授权 `Calendars.ReadWrite` 和 `Tasks.ReadWrite` 权限

## 💡 最佳实践

1. **提前加载**: 在应用启动时预加载 Calendars 和 To Do Lists
2. **缓存策略**: 使用 `localStorage` 缓存列表数据，减少 API 调用
3. **错误处理**: 网络失败时显示友好提示，允许离线保存
4. **用户引导**: 首次使用时提供 Tooltip 或 Tour 引导
5. **快捷键**: 支持键盘快捷键快速切换选择

---

**作者**: ReMarkable Team  
**版本**: 1.0.0  
**更新时间**: 2025-11-12
