# EventEditModal v2 缺失功能诊断报告

**诊断时间**: 2025-11-24  
**对比基准**: EventEditModal v1 (src/components/EventEditModal.tsx)  
**目标版本**: EventEditModalV2 (src/components/EventEditModal/EventEditModalV2.tsx)

---

## 📊 诊断总结

### ✅ 已实现的核心功能
1. ✅ 基础事件编辑（标题、标签、时间、地点、描述）
2. ✅ ModalSlate 集成（Event Log 富文本编辑）
3. ✅ Timer 计时按钮集成
4. ✅ EventHub 架构集成（create/updateFields）
5. ✅ 任务勾选功能 (isTask)
6. ✅ Emoji 选择器
7. ✅ 标签选择器 (HierarchicalTagPicker)
8. ✅ 时间选择器 (UnifiedDateTimePicker)
9. ✅ 位置输入 (LocationInput)
10. ✅ Auto-resize 标题输入框

### ❌ 缺失的功能（v1 有但 v2 无）

---

## 🔴 高优先级缺失功能

### 1. ⚠️ **冲突检测 (ConflictDetectionService)**

**v1 实现位置**: Line 344-369

```typescript
// v1 代码
import { ConflictDetectionService, ConflictInfo } from '../services/ConflictDetectionService';

const [conflictInfo, setConflictInfo] = useState<ConflictInfo[]>([]);

useEffect(() => {
  const checkConflicts = async () => {
    if (!formData.startTime || !formData.endTime) {
      setConflictInfo([]);
      return;
    }

    try {
      const startStr = formatTimeForStorage(parseLocalTimeString(formData.startTime));
      const endStr = formatTimeForStorage(parseLocalTimeString(formData.endTime));

      const conflicts = await ConflictDetectionService.detectConflicts(
        { start: startStr, end: endStr, attendees: formData.attendees },
        event?.id
      );

      setConflictInfo(conflicts);
    } catch (error) {
      console.error('[EventEditModal] Failed to detect conflicts:', error);
    }
  };

  // 使用防抖避免频繁检测
  const timeoutId = setTimeout(checkConflicts, 500);
  return () => clearTimeout(timeoutId);
}, [formData.startTime, formData.endTime, formData.attendees, formData.isAllDay, event?.id]);
```

**v2 状态**: ❌ **完全缺失**

**影响**:
- 用户无法看到时间冲突警告
- 可能导致重复预订时间段
- 参会人时间冲突无法提示

**修复优先级**: 🔴 **P0 - 必须实现**

---

### 2. 📅 **Calendar/To Do List 同步选择器 (SyncTargetPicker)**

**v1 实现位置**: Line 1029-1042

```typescript
// v1 代码
import { SyncTargetPicker } from './EventEditModal/SyncTargetPicker';

<SyncTargetPicker
  startTime={formData.startTime}
  endTime={formData.endTime}
  selectedCalendarIds={formData.calendarIds || []}
  selectedTodoListIds={formData.todoListIds || []}
  onCalendarIdsChange={handleCalendarIdsChange}
  onTodoListIdsChange={handleTodoListIdsChange}
  microsoftService={microsoftService}
/>
```

**v2 状态**: ⚠️ **部分实现**
- ✅ 有 `availableCalendars` 数据源
- ✅ 有 `SimpleCalendarDropdown` 组件
- ❌ 没有 `SyncTargetPicker` 智能切换逻辑
- ❌ 没有 `todoListIds` 字段集成

**v2 现有代码**:
```typescript
// Line 281
const availableCalendars = getAvailableCalendarsForSettings();

// Line 1431, 1582 - 只有 Calendar Picker，没有 To Do List
<SimpleCalendarDropdown
  availableCalendars={availableCalendars}
  // ...
/>
```

**缺失内容**:
1. ❌ To Do List 选择器集成
2. ❌ 智能切换逻辑（有时间 → Calendar，无时间 → To Do List）
3. ❌ `microsoftService` prop 接收和传递
4. ❌ `todoListIds` 字段在 `formData` 中

**修复优先级**: 🟠 **P1 - 高优先级**

---

### 3. 👥 **参会人管理 (Attendees)**

**v1 实现位置**: Line 1054-1180

```typescript
// v1 代码
import { ContactPicker } from './common/ContactPicker';
import { Avatar, AvatarGroup } from './common/Avatar';

// State
const [showContactPicker, setShowContactPicker] = useState(false);

// UI - 组织者显示
{formData.organizer && formData.organizer.email && (
  <div className="organizer-display">
    <Avatar contact={formData.organizer} size={24} />
    <span className="organizer-name">{formData.organizer.name}</span>
  </div>
)}

// UI - 参会人列表
<AttendeeDisplay 
  attendees={formData.attendees}
  onRemove={(index) => {
    const newAttendees = [...formData.attendees];
    newAttendees.splice(index, 1);
    setFormData({ ...formData, attendees: newAttendees });
  }}
  onUpdateStatus={(index, status) => {
    const newAttendees = [...formData.attendees];
    newAttendees[index].status = status;
    setFormData({ ...formData, attendees: newAttendees });
  }}
/>

// UI - 添加按钮
<button 
  className="add-attendee-btn" 
  onClick={() => setShowContactPicker(true)}
>
  + 添加参会人
</button>

// ContactPicker 弹窗
<ContactPicker
  visible={showContactPicker}
  onClose={() => setShowContactPicker(false)}
  onSelect={(contacts) => {
    const newAttendees = [...formData.attendees];
    contacts.forEach(contact => {
      const exists = newAttendees.some(a => a.email === contact.email);
      if (!exists) {
        newAttendees.push({
          ...contact,
          type: contact.type || 'required',
          status: contact.status || 'none',
        });
      }
    });
    setFormData({ ...formData, attendees: newAttendees });
  }}
  selectedContacts={formData.attendees}
/>
```

**v2 状态**: ⚠️ **部分实现**
- ✅ `formData` 中有 `organizer` 和 `attendees` 字段
- ✅ 数据保存时包含 `organizer` 和 `attendees`
- ❌ UI 中完全没有显示和编辑功能
- ❌ 没有 `ContactPicker` 集成
- ❌ 没有 `Avatar` 组件显示

**v2 现有代码**:
```typescript
// Line 206-207 - formData 定义中有字段
organizer: event.organizer,
attendees: event.attendees || [],

// Line 410-411 - 保存时包含
organizer: formData.organizer,
attendees: formData.attendees,

// ❌ 但 UI 中完全没有相关元素
```

**修复优先级**: 🟠 **P1 - 高优先级**

---

### 4. 🏷️ **标签自动映射到日历**

**v1 实现位置**: Line 372-391

```typescript
// v1 代码
useEffect(() => {
  if (formData.tags.length > 0 && availableCalendars.length > 0) {
    // 收集所有选中标签的日历映射
    const mappedCalendarIds = formData.tags
      .map(tagId => {
        const tag = getTagById(tagId);
        return tag?.calendarMapping?.calendarId;
      })
      .filter((id): id is string => Boolean(id));
    
    // 去重并自动添加到日历选择中
    const uniqueCalendarIds = Array.from(new Set([...formData.calendarIds, ...mappedCalendarIds]));
    
    if (uniqueCalendarIds.length !== formData.calendarIds.length) {
      setFormData(prev => ({
        ...prev,
        calendarIds: uniqueCalendarIds
      }));
    }
  }
}, [formData.tags, availableCalendars]);
```

**v2 状态**: ❌ **完全缺失**

**影响**:
- 用户选择标签后，需要手动选择日历
- 无法利用标签的 `calendarMapping` 配置
- 降低用户体验

**修复优先级**: 🟡 **P2 - 中优先级**

---

### 5. ⏱️ **Timer 时长计算和显示**

**v1 实现位置**: Line 691-736

```typescript
// v1 代码
const calculateDuration = () => {
  if (!globalTimer) return null;
  
  const now = Date.now();
  
  // 安全检查各个时间值
  if (!globalTimer.elapsedTime || isNaN(globalTimer.elapsedTime) || globalTimer.elapsedTime < 0) {
    console.warn('⚠️ [calculateDuration] 异常的 elapsedTime:', globalTimer.elapsedTime);
    return null;
  }
  
  if (!globalTimer.startTime || isNaN(globalTimer.startTime) || globalTimer.startTime <= 0) {
    console.warn('⚠️ [calculateDuration] 异常的 startTime:', globalTimer.startTime);
    return null;
  }
  
  let totalElapsed: number;
  
  // 🔧 简化计算：如果有 originalStartTime，直接使用它
  const hasOriginalStartTime = globalTimer.originalStartTime && 
                              !isNaN(globalTimer.originalStartTime) && 
                              globalTimer.originalStartTime > 0;
  
  if (globalTimer.isRunning && hasOriginalStartTime && globalTimer.originalStartTime) {
    // 使用简单直观的计算：当前时间 - 用户设定的开始时间
    totalElapsed = now - globalTimer.originalStartTime;
  } else if (globalTimer.isRunning) {
    // 回退到旧逻辑（兼容性）
    const currentRunTime = now - globalTimer.startTime;
    totalElapsed = globalTimer.elapsedTime + currentRunTime;
  } else {
    totalElapsed = globalTimer.elapsedTime;
  }
  
  const totalMinutes = Math.floor(totalElapsed / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  
  return { hours, minutes, totalMinutes };
};

// UI 显示
const duration = calculateDuration();
{duration && (
  <div className="timer-duration">
    已计时: {duration.hours > 0 ? `${duration.hours}小时` : ''}{duration.minutes}分钟
  </div>
)}
```

**v2 状态**: ❌ **完全缺失**

**v2 现有代码**:
```typescript
// Line 704-727 - 只有 Timer 更新逻辑，没有时长计算
useEffect(() => {
  if (!isOpen || !globalTimer?.isRunning) return;

  const interval = setInterval(() => {
    setCurrentTime(Date.now());
  }, 1000);

  return () => clearInterval(interval);
}, [isOpen, globalTimer?.isRunning]);
```

**缺失内容**:
1. ❌ `calculateDuration()` 函数
2. ❌ 时长显示 UI
3. ❌ 安全检查（elapsedTime, startTime 验证）

**修复优先级**: 🟠 **P1 - 高优先级**（如果支持 Timer 功能）

---

### 6. 🖼️ **Modal 拖拽和调整大小**

**v1 实现位置**: Line 115-197

```typescript
// v1 代码
const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
const [modalSize, setModalSize] = useState({ width: 600, height: 0 });
const [isDragging, setIsDragging] = useState(false);
const [isResizing, setIsResizing] = useState(false);
const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
const modalRef = useRef<HTMLDivElement>(null);

// 拖拽处理
const handleDragStart = (e: React.MouseEvent) => {
  if (!draggable) return;
  setIsDragging(true);
  setDragStart({ x: e.clientX - modalPosition.x, y: e.clientY - modalPosition.y });
};

const handleDragMove = useCallback((e: MouseEvent) => {
  if (!isDragging || !draggable) return;
  setModalPosition({
    x: e.clientX - dragStart.x,
    y: e.clientY - dragStart.y,
  });
}, [isDragging, draggable, dragStart]);

const handleDragEnd = useCallback(() => {
  setIsDragging(false);
}, []);

// 调整大小处理
const handleResizeStart = (e: React.MouseEvent) => {
  if (!resizable) return;
  e.stopPropagation();
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
  const newWidth = Math.max(400, resizeStart.width + (e.clientX - resizeStart.x));
  const newHeight = Math.max(300, resizeStart.height + (e.clientY - resizeStart.y));
  setModalSize({ width: newWidth, height: newHeight });
}, [isResizing, resizable, resizeStart]);

const handleResizeEnd = useCallback(() => {
  setIsResizing(false);
}, []);

// useEffect 监听
useEffect(() => {
  if (isDragging) {
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  }
  return () => {
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
  };
}, [isDragging, handleDragMove, handleDragEnd]);

useEffect(() => {
  if (isResizing) {
    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  }
  return () => {
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  };
}, [isResizing, handleResizeMove, handleResizeEnd]);

// UI
<div 
  ref={modalRef}
  className={`edit-modal ${isDragging ? 'dragging' : ''} ${isResizing ? 'resizing' : ''}`}
  style={{
    width: draggable || resizable ? `${modalSize.width}px` : undefined,
    height: resizable ? `${modalSize.height}px` : undefined,
    transform: draggable ? `translate(${modalPosition.x}px, ${modalPosition.y}px)` : undefined,
  }}
>
  <div className="modal-header" onMouseDown={handleDragStart}>
    <h3>编辑事件</h3>
  </div>
  
  {/* Resize handle */}
  {resizable && (
    <div className="resize-handle" onMouseDown={handleResizeStart} />
  )}
</div>
```

**v2 状态**: ❌ **完全缺失**

**v2 Props**:
```typescript
// Line 161-162
draggable?: boolean;
resizable?: boolean;
```

**影响**:
- Props 定义了但没有实现
- 无法拖拽 Modal
- 无法调整 Modal 大小

**修复优先级**: 🟢 **P3 - 低优先级**（Nice to have）

---

## 🟡 中优先级缺失功能

### 7. 📝 **表单验证增强**

**v1 实现位置**: Line 408-453

```typescript
// v1 代码
const handleSave = () => {
  if (!event) return;

  // 🔧 Issue #15 修复：表单验证
  const errors: string[] = [];
  
  // 验证标题（如果没有标签则必须有标题）
  if (!formData.title?.trim() && formData.tags.length === 0) {
    errors.push('请输入标题或选择标签');
  }
  
  // 验证时间范围
  if (formData.startTime && formData.endTime) {
    const start = parseLocalTimeString(formData.startTime);
    const end = parseLocalTimeString(formData.endTime);
    
    if (start && end && start.getTime() >= end.getTime()) {
      errors.push('结束时间必须晚于开始时间');
    }
  }
  
  // 验证参会人邮箱格式
  const invalidEmails = formData.attendees.filter(a => {
    if (!a.email) return true;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return !emailRegex.test(a.email);
  });
  
  if (invalidEmails.length > 0) {
    errors.push(`无效的邮箱地址: ${invalidEmails.map(a => a.email || '空').join(', ')}`);
  }
  
  // 显示错误
  if (errors.length > 0) {
    alert('请修正以下问题:\n\n' + errors.map((e, i) => `${i + 1}. ${e}`).join('\n'));
    return;
  }
  
  // ... 保存逻辑
};
```

**v2 状态**: ⚠️ **部分实现**
- ✅ 有基本的标题验证（Line 335-340）
- ❌ 没有时间范围验证
- ❌ 没有邮箱格式验证
- ❌ 没有统一的错误提示

**v2 现有代码**:
```typescript
// Line 335-340 - 只有标题验证
const finalTitle = formData.title.trim() || (() => {
  if (formData.tags.length > 0) {
    const firstTag = TagService.getFlatTags().find(t => t.id === formData.tags[0]);
    return firstTag ? (firstTag.emoji ? `${firstTag.emoji} ${firstTag.name}` : firstTag.name) : 'Untitled';
  }
  return 'Untitled';
})();
```

**修复优先级**: 🟡 **P2 - 中优先级**

---

### 8. 🔄 **microsoftService 集成**

**v1 Props**:
```typescript
microsoftService?: any; // 🆕 Microsoft 服务实例
```

**v2 Props**:
```typescript
// ❌ 没有 microsoftService prop
```

**影响**:
- 无法传递 Microsoft 服务实例
- `SyncTargetPicker` 无法使用（需要此 prop）
- Outlook 日历和 To Do List 功能受限

**修复优先级**: 🟡 **P2 - 中优先级**

---

## 🟢 低优先级缺失功能

### 9. 🏷️ **标签扁平化缓存优化**

**v1 实现位置**: Line 199-253

```typescript
// v1 代码
const [isTagsLoading, setIsTagsLoading] = useState(false);
const [flatTagsCache, setFlatTagsCache] = useState<any[]>([]);

useEffect(() => {
  if (!isOpen || hierarchicalTags.length === 0) return;

  setIsTagsLoading(true);
  
  const timeoutId = setTimeout(() => {
    const startTime = performance.now();
    
    const flatten = (tags: any[], level: number = 0, parentPath: string = ''): any[] => {
      let result: any[] = [];
      tags.forEach(tag => {
        const path = parentPath ? `${parentPath} > ${tag.name}` : tag.name;
        const flattenedTag = {
          ...tag,
          level,
          path,
          displayName: '  '.repeat(level) + tag.name
        };
        result.push(flattenedTag);
        
        if (tag.children && tag.children.length > 0) {
          result = result.concat(flatten(tag.children, level + 1, path));
        }
      });
      return result;
    };
    
    const flattened = flatten(hierarchicalTags);
    const elapsed = performance.now() - startTime;
    
    if (process.env.NODE_ENV === 'development') {
      console.log(`🏷️ [EventEditModal] Tag flattening took ${elapsed.toFixed(2)}ms for ${flattened.length} tags`);
    }
    
    setFlatTagsCache(flattened);
    setIsTagsLoading(false);
  }, 0);

  return () => clearTimeout(timeoutId);
}, [hierarchicalTags, isOpen]);
```

**v2 状态**: ❌ **缺失**
- v2 使用 `TagService.getFlatTags()` 直接获取
- 没有缓存机制
- 没有性能监控

**影响**: 
- 每次访问都重新扁平化
- 对性能影响较小（TagService 本身可能有缓存）

**修复优先级**: 🟢 **P3 - 低优先级**

---

### 10. 📅 **startTime 变化时通知父组件**

**v1 实现位置**: Line 645-667

```typescript
// v1 代码
const debouncedStartTimeChange = useMemo(() => {
  if (onStartTimeChange) {
    return debounce(onStartTimeChange, 500);
  }
  return null;
}, [onStartTimeChange]);

useEffect(() => {
  return () => {
    if (debouncedStartTimeChange && (debouncedStartTimeChange as any).cancel) {
      (debouncedStartTimeChange as any).cancel();
    }
  };
}, [debouncedStartTimeChange]);

const handleStartTimeEdit = (newStartTimeStr: string) => {
  if (onStartTimeChange && debouncedStartTimeChange) {
    try {
      const parsed = parseLocalTimeString(newStartTimeStr);
      if (parsed && !isNaN(parsed.getTime())) {
        const newStartTime = parsed.getTime();
        if (globalTimer && Math.abs(newStartTime - globalTimer.startTime) > 60000) {
          debouncedStartTimeChange(newStartTime);
        }
      }
    } catch (error) {
      console.error('❌ 时间解析异常:', error, newStartTimeStr);
    }
  }
};
```

**v2 状态**: ⚠️ **部分实现**
- ✅ 有 `onStartTimeChange` prop (Line 157)
- ❌ 没有调用逻辑
- ❌ 没有防抖处理

**修复优先级**: 🟢 **P3 - 低优先级**（取决于 Timer 功能需求）

---

## 📋 修复建议和优先级

### Phase 1: P0 - 必须实现 (本周)
1. **冲突检测 (ConflictDetectionService)**
   - 添加 `conflictInfo` state
   - 实现 `useEffect` 检测逻辑
   - 添加冲突警告 UI

### Phase 2: P1 - 高优先级 (下周)
2. **Calendar/To Do List 同步选择器**
   - 集成 `SyncTargetPicker` 组件
   - 添加 `microsoftService` prop
   - 添加 `todoListIds` 字段支持

3. **参会人管理**
   - 集成 `ContactPicker` 组件
   - 添加 `Avatar` 和 `AvatarGroup` 显示
   - 添加参会人编辑 UI

4. **Timer 时长计算和显示**
   - 实现 `calculateDuration()` 函数
   - 添加时长显示 UI
   - 添加安全检查

### Phase 3: P2 - 中优先级 (两周内)
5. **标签自动映射到日历**
   - 实现 `useEffect` 监听标签变化
   - 自动填充 `calendarIds`

6. **表单验证增强**
   - 添加时间范围验证
   - 添加邮箱格式验证
   - 统一错误提示

7. **microsoftService 集成**
   - 添加 prop 定义
   - 传递给子组件

### Phase 4: P3 - 低优先级 (有时间再做)
8. **Modal 拖拽和调整大小**
   - 实现拖拽逻辑
   - 实现调整大小逻辑

9. **标签扁平化缓存优化**
   - 添加缓存机制
   - 添加性能监控

10. **startTime 变化通知**
    - 实现防抖调用
    - 添加 Timer 同步逻辑

---

## 🔧 技术债务

### 架构层面
1. **Props 不一致**
   - v1 有 `microsoftService`, v2 没有
   - v1 有 `draggable`/`resizable`, v2 定义了但没实现

2. **数据流差异**
   - v1: 直接调用 `EventService`
   - v2: 通过 `EventHub` 调用（✅ 正确）

3. **UI 组件差异**
   - v1 使用传统 CSS 布局
   - v2 使用双视图设计（更先进）

### 兼容性考虑
- 建议保留 v1 作为 fallback
- v2 功能完善前不要完全移除 v1
- 可以使用 Feature Flag 控制启用哪个版本

---

## 📊 完成度评估

| 模块 | v1 功能数 | v2 已实现 | 完成度 |
|------|----------|----------|--------|
| 基础编辑 | 10 | 10 | 100% ✅ |
| Timer 功能 | 3 | 2 | 67% ⚠️ |
| 同步集成 | 3 | 1 | 33% ❌ |
| 联系人管理 | 4 | 0 | 0% ❌ |
| 冲突检测 | 1 | 0 | 0% ❌ |
| UI 交互 | 2 | 0 | 0% ❌ |
| **总计** | **23** | **13** | **57%** |

---

## 🎯 结论

EventEditModalV2 已经实现了核心的事件编辑功能，但在以下关键领域存在显著缺失：

1. **冲突检测** - 影响用户体验和数据完整性
2. **同步功能** - 无法充分利用 Outlook 集成
3. **参会人管理** - 会议功能不完整
4. **Timer 时长显示** - 计时功能体验不完整

建议按照 P0 → P1 → P2 → P3 的顺序逐步完善，确保关键功能优先上线。

**生成时间**: 2025-11-24  
**作者**: GitHub Copilot  
**版本**: v1.0
