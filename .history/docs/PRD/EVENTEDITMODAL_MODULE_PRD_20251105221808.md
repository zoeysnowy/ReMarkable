# ReMarkable EventEditModal 模块产品需求文档 (PRD)

> **AI 生成时间**: 2025-11-05  
> **关联代码版本**: master  
> **文档类型**: 功能模块 PRD  
> **依赖模块**: EventHub, TimeHub, TagManager, CalendarPicker  
> **关联文档**: [Timer 模块 PRD](./TIMER_MODULE_PRD.md), [TimeCalendar 模块 PRD](./TIMECALENDAR_MODULE_PRD.md)

**关键点**：
- ✅ 记录初始尺寸（`resizeStart.width/height`）
- ✅ 计算增量（`deltaX/deltaY`）并应用最小值限制
- ✅ 调整手柄位于模态框右下角（CSS 实现，见 L858-870）

### 6.4 事件监听管理

```typescript
// 位置：L134-151
useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }
  if (isResizing) {
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }
  return () => {
    // 清理监听器，避免内存泄漏
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
}, [isDragging, isResizing, handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);

**最佳实践**：
- ✅ 使用 `useCallback` 避免重复创建监听器
- ✅ 在 `useEffect` 清理函数中移除监听器
- ✅ 依赖数组包含所有回调函数

### 6.5 样式适配

```typescript
// 位置：L555-564
const modalStyle: React.CSSProperties = draggable || resizable ? {
  position: 'fixed',
  left: modalPosition.x || '50%',
  top: modalPosition.y || '50%',
  transform: modalPosition.x ? 'none' : 'translate(-50%, -50%)', // 初始居中
  width: modalSize.width,
  maxWidth: 'none',
  height: resizable && modalSize.height ? modalSize.height : 'auto',
  maxHeight: resizable ? 'none' : '90vh',
} : {};
```

**设计要点**：
- ✅ 初始位置居中（`left: 50%, top: 50%, transform: translate(-50%, -50%)`）
- ✅ 拖拽后取消 `transform`，使用绝对定位（`left/top` 为像素值）
- ✅ 调整大小后固定高度，否则使用 `auto`

---

## 7. 标签处理

### 7.1 层级扁平化

**目的**：将层级标签树转换为扁平数组，便于搜索和渲染

```typescript
// 位置：L153-184
const flatTags = useMemo(() => {
  // 检测是否已经是扁平结构
  const isAlreadyFlat = hierarchicalTags.length > 0 && 
                       hierarchicalTags[0].level !== undefined && 
                       !hierarchicalTags[0].children;
  
  if (isAlreadyFlat) {
    return hierarchicalTags;
  }
  
  const flatten = (tags: any[], level: number = 0, parentPath: string = ''): any[] => {
    let result: any[] = [];
    tags.forEach(tag => {
      const path = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
      const flattenedTag = {
        ...tag,
        level,                                    // 层级深度（用于缩进）
        path,                                     // 完整路径（用于搜索）
        displayName: '  '.repeat(level) + tag.name // 带缩进的显示名称
      };
      result.push(flattenedTag);
      
      if (tag.children && tag.children.length > 0) {
        result = result.concat(flatten(tag.children, level + 1, path));
      }
    });
    return result;
  };
  
  return flatten(hierarchicalTags);
}, [hierarchicalTags]);
```

**数据结构示例**：

```typescript
// 输入（层级结构）
[
  {
    id: '1',
    name: '工作',
    children: [
      { id: '1-1', name: '产品设计', children: [] },
      { id: '1-2', name: '开发', children: [] }
    ]
  }
]

// 输出（扁平结构）
[
  { id: '1', name: '工作', level: 0, path: '工作', displayName: '工作' },
  { id: '1-1', name: '产品设计', level: 1, path: '工作 > 产品设计', displayName: '  产品设计' },
  { id: '1-2', name: '开发', level: 1, path: '工作 > 开发', displayName: '  开发' }
]
```

### 7.2 搜索过滤

```typescript
// 位置：L186-194
const filteredTags = useMemo(() => {
  if (!tagSearchQuery.trim()) return flatTags;
  const query = tagSearchQuery.toLowerCase();
  return flatTags.filter(tag => 
    tag.name.toLowerCase().includes(query) ||
    tag.path.toLowerCase().includes(query)  // 支持搜索完整路径
  );
}, [flatTags, tagSearchQuery]);
```

**搜索示例**：
- 搜索 `"产品"` → 匹配 `"产品设计"`
- 搜索 `"工作 > 产品"` → 匹配 `"工作 > 产品设计"`

### 7.3 标签日历自动映射

```typescript
// 位置：L246-264
useEffect(() => {
  if (formData.tags.length > 0 && availableCalendars.length > 0) {
    // 收集所有选中标签的日历映射
    const mappedCalendarIds = formData.tags
      .map(tagId => {
        const tag = getTagById(tagId);
        return tag?.calendarMapping?.calendarId; // 从标签配置中读取映射
      })
      .filter((id): id is string => Boolean(id));
    
    // 去重并自动添加到日历选择中
    const uniqueCalendarIds = Array.from(new Set([
      ...formData.calendarIds, 
      ...mappedCalendarIds
    ]));
    
    if (uniqueCalendarIds.length !== formData.calendarIds.length) {
      setFormData(prev => ({
        ...prev,
        calendarIds: uniqueCalendarIds
      }));
    }
  }
}, [formData.tags, availableCalendars]);
```

**工作流程**：
1. 用户选择标签 `"工作/#产品设计"`
2. 系统检测该标签有 `calendarMapping: { calendarId: 'work-calendar-id' }`
3. 自动将 `'work-calendar-id'` 添加到 `formData.calendarIds`
4. CalendarPicker 组件显示该日历已选中

**设计价值**：
- ✅ 减少用户重复操作（不需要手动选择日历）
- ✅ 确保标签和日历的一致性（标签规则自动应用）

---

*继续阅读第三部分...*
  isOpen={showEventEditModal}
  onClose={() => setShowEventEditModal(false)}
  onSave={handleSaveEvent}
  onDelete={handleDeleteEvent}
  hierarchicalTags={hierarchicalTags}
  availableCalendars={availableCalendars}
  draggable={false}   // 居中模态框
  resizable={false}
/>
```

#### PlanManager 调用示例

```typescript
// 位置：PlanManager.tsx L895-905
<EventEditModal
  event={selectedPlanAsEvent}
  isOpen={!!selectedPlan}
  onClose={() => setSelectedPlan(null)}
  onSave={handleSavePlanFromModal}
  hierarchicalTags={hierarchicalTags}
  availableCalendars={availableCalendars}
  draggable={true}    // 支持拖动到侧边栏位置
  resizable={true}    // 支持调整大小
/>
```

### 4.3 Props 设计原则

| Props | 设计原则 | 原因 |
|-------|---------|------|
| `event` | 传入完整 Event 对象 | 包含所有字段，避免部分字段丢失 |
| `onSave` | 回调中返回完整 Event | 调用方自行决定后续操作（刷新列表、关闭模态框等） |
| `hierarchicalTags` | 父组件负责数据结构 | EventEditModal 只负责展示和选择，不关心标签如何加载 |
| `globalTimer` | 可选参数 | 仅 Timer 场景需要，其他场景传 `null` 或 `undefined` |
| `draggable/resizable` | 可选布尔值 | 默认 false，仅特定场景（如 PlanManager）启用 |

---

## 5. 状态管理

### 5.1 核心状态定义

```typescript
// 位置：L47-56
const [formData, setFormData] = useState({
  title: '',
  description: '',
  startTime: '',             // 格式：YYYY-MM-DD 或 YYYY-MM-DDTHH:mm
  endTime: '',
  location: '',
  isAllDay: false,
  tags: [] as string[],      // 多选标签 ID 数组
  calendarIds: [] as string[], // 多选日历 ID 数组
});
```

### 5.2 UI 交互状态

```typescript
// 位置：L58-68
const [tagSearchQuery, setTagSearchQuery] = useState('');      // 标签搜索关键词
const [showTagDropdown, setShowTagDropdown] = useState(false); // 标签下拉显示状态

// 拖拽和调整大小状态
const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
const [modalSize, setModalSize] = useState({ width: 600, height: 0 });
const [isDragging, setIsDragging] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
```

### 5.3 状态初始化逻辑

```typescript
// 位置：L197-244
useEffect(() => {
  if (event && isOpen) {
    // 🎯 优先使用 TimeHub 的快照（保证时间字段的一致性）
    const startStr = eventTime?.start || event.startTime || '';
    const endStr = eventTime?.end || event.endTime || '';

    // 根据 isAllDay 决定时间格式
    const isAllDay = !!event.isAllDay;
    const startTime = isAllDay
      ? formatDateForInput(startDateObj)      // YYYY-MM-DD
      : formatDateTimeForInput(startDateObj); // YYYY-MM-DDTHH:mm
    
    setFormData({
      title: event.title || '',
      description: event.description ?? '', // 🔍 使用 ?? 而非 ||，保留空字符串
      startTime,
      endTime,
      location: event.location || '',
      isAllDay: isAllDay,
      tags: event.tags || (event.tagId ? [event.tagId] : []),
      calendarIds: event.calendarIds || (event.calendarId ? [event.calendarId] : []),
    });
  }
}, [event, isOpen, eventTime?.start, eventTime?.end]);
```

**关键设计**：
- ✅ **优先使用 TimeHub 快照**：`eventTime?.start` 优先于 `event.startTime`，避免运行中 Timer 的时间不准确
- ✅ **description 无损传递**：使用 `??` 空值合并运算符，保留空字符串，避免用户清空日志后被还原
- ✅ **兼容单标签/多标签**：`event.tags` 优先，回退到 `event.tagId`（兼容旧数据）

---

## 6. 拖拽和调整大小

### 6.1 功能设计

**启用条件**：
- `draggable=true` 时启用拖拽
- `resizable=true` 时启用调整大小
- 通常用于 **PlanManager** 的侧边栏编辑模式

### 6.2 拖拽实现

```typescript
// 位置：L92-102
const handleDragStart = (e: React.MouseEvent) => {
  if (!draggable) return;
  setIsDragging(true);
  setDragStart({ 
    x: e.clientX - modalPosition.x, 
    y: e.clientY - modalPosition.y 
  });
};

const handleDragMove = useCallback((e: MouseEvent) => {
  if (!isDragging || !draggable) return;
  setModalPosition({
    x: e.clientX - dragStart.x,
    y: e.clientY - dragStart.y,
  });
}, [isDragging, draggable, dragStart]);
```

**关键点**：
- ✅ 记录鼠标按下时的偏移量（`dragStart`）
- ✅ 移动时计算新位置（`e.clientX - dragStart.x`）
- ✅ 在 `document` 上监听 `mousemove` 和 `mouseup` 事件（避免鼠标移出模态框时失效）

### 6.3 调整大小实现

```typescript
// 位置：L108-131
const handleResizeStart = (e: React.MouseEvent) => {
  if (!resizable) return;
  e.stopPropagation(); // 防止触发拖拽
  setIsResizing(true);
  const rect = modalRef.current?.getBoundingClientRect();
  if (rect) {
    setResizeStart({ 
      x: e.clientX, 
      y: e.clientY, 
      width: rect.width, 
      height: rect.height 
    });
  }
};

const handleResizeMove = useCallback((e: MouseEvent) => {
  if (!isResizing || !resizable) return;
  const deltaX = e.clientX - resizeStart.x;
  const deltaY = e.clientY - resizeStart.y;
  setModalSize({
    width: Math.max(400, resizeStart.width + deltaX),  // 最小宽度 400px
    height: Math.max(300, resizeStart.height + deltaY), // 最小高度 300px
  });
}, [isResizing, resizable, resizeStart]);
```

**关键点**：
- ✅ 记录初始尺寸（`resizeStart.width/height`）
- ✅ 计算增量（`deltaX/deltaY`）并应用最小值限制
- ✅ 调整手柄位于模态框右下角（CSS 实现，见 L858-870）

### 6.4 事件监听管理

```typescript
// 位置：L134-151
useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }
  if (isResizing) {
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }
  return () => {
    // 清理监听器，避免内存泄漏
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
}, [isDragging, isResizing, handleDragMove, handleDragEnd, handleResizeMove, handleResizeEnd]);
```

**最佳实践**：
- ✅ 使用 `useCallback` 避免重复创建监听器
- ✅ 在 `useEffect` 清理函数中移除监听器
- ✅ 依赖数组包含所有回调函数

### 6.5 样式适配

```typescript
// 位置：L555-564
const modalStyle: React.CSSProperties = draggable || resizable ? {
  position: 'fixed',
  left: modalPosition.x || '50%',
  top: modalPosition.y || '50%',
  transform: modalPosition.x ? 'none' : 'translate(-50%, -50%)', // 初始居中
  width: modalSize.width,
  maxWidth: 'none',
  height: resizable && modalSize.height ? modalSize.height : 'auto',
  maxHeight: resizable ? 'none' : '90vh',
} : {};
```

**设计要点**：
- ✅ 初始位置居中（`left: 50%, top: 50%, transform: translate(-50%, -50%)`）
- ✅ 拖拽后取消 `transform`，使用绝对定位（`left/top` 为像素值）
- ✅ 调整大小后固定高度，否则使用 `auto`

---

## 7. 标签处理

### 7.1 层级扁平化

**目的**：将层级标签树转换为扁平数组，便于搜索和渲染

```typescript
// 位置：L153-184
const flatTags = useMemo(() => {
  // 检测是否已经是扁平结构
  const isAlreadyFlat = hierarchicalTags.length > 0 && 
                       hierarchicalTags[0].level !== undefined && 
                       !hierarchicalTags[0].children;
  
  if (isAlreadyFlat) {
    return hierarchicalTags;
  }
  
  const flatten = (tags: any[], level: number = 0, parentPath: string = ''): any[] => {
    let result: any[] = [];
    tags.forEach(tag => {
      const path = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
      const flattenedTag = {
        ...tag,
        level,                                    // 层级深度（用于缩进）
        path,                                     // 完整路径（用于搜索）
        displayName: '  '.repeat(level) + tag.name // 带缩进的显示名称
      };
      result.push(flattenedTag);
      
      if (tag.children && tag.children.length > 0) {
        result = result.concat(flatten(tag.children, level + 1, path));
      }
    });
    return result;
  };
  
  return flatten(hierarchicalTags);
}, [hierarchicalTags]);
```

**数据结构示例**：

```typescript
// 输入（层级结构）
[
  {
    id: '1',
    name: '工作',
    children: [
      { id: '1-1', name: '产品设计', children: [] },
      { id: '1-2', name: '开发', children: [] }
    ]
  }
]

// 输出（扁平结构）
[
  { id: '1', name: '工作', level: 0, path: '工作', displayName: '工作' },
  { id: '1-1', name: '产品设计', level: 1, path: '工作 > 产品设计', displayName: '  产品设计' },
  { id: '1-2', name: '开发', level: 1, path: '工作 > 开发', displayName: '  开发' }
]
```

### 7.2 搜索过滤

```typescript
// 位置：L186-194
const filteredTags = useMemo(() => {
  if (!tagSearchQuery.trim()) return flatTags;
  const query = tagSearchQuery.toLowerCase();
  return flatTags.filter(tag => 
    tag.name.toLowerCase().includes(query) ||
    tag.path.toLowerCase().includes(query)  // 支持搜索完整路径
  );
}, [flatTags, tagSearchQuery]);
```

**搜索示例**：
- 搜索 `"产品"` → 匹配 `"产品设计"`
- 搜索 `"工作 > 产品"` → 匹配 `"工作 > 产品设计"`

### 7.3 标签日历自动映射

```typescript
// 位置：L246-264
useEffect(() => {
  if (formData.tags.length > 0 && availableCalendars.length > 0) {
    // 收集所有选中标签的日历映射
    const mappedCalendarIds = formData.tags
      .map(tagId => {
        const tag = getTagById(tagId);
        return tag?.calendarMapping?.calendarId; // 从标签配置中读取映射
      })
      .filter((id): id is string => Boolean(id));
    
    // 去重并自动添加到日历选择中
    const uniqueCalendarIds = Array.from(new Set([
      ...formData.calendarIds, 
      ...mappedCalendarIds
    ]));
    
    if (uniqueCalendarIds.length !== formData.calendarIds.length) {
      setFormData(prev => ({
        ...prev,
        calendarIds: uniqueCalendarIds
      }));
    }
  }
}, [formData.tags, availableCalendars]);
```

**工作流程**：
1. 用户选择标签 `"工作/#产品设计"`
2. 系统检测该标签有 `calendarMapping: { calendarId: 'work-calendar-id' }`
3. 自动将 `'work-calendar-id'` 添加到 `formData.calendarIds`
4. CalendarPicker 组件显示该日历已选中

**设计价值**：
- ✅ 减少用户重复操作（不需要手动选择日历）
- ✅ 确保标签和日历的一致性（标签规则自动应用）

---

*继续阅读第三部分...*
