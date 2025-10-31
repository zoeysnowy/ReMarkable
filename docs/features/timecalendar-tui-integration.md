# TimeCalendar TUI Calendar 集成方案

## 📋 项目背景

ReMarkable 的 TimeCalendar 组件需要使用 TUI Calendar 进行美化，同时保持 UnifiedTimeline 的所有功能，包括：
- ✅ 与 Outlook 的双向实时同步
- ✅ 标签系统与日历分组映射
- ✅ 事件 CRUD 操作
- ✅ 本地计时器创建的事件同步

## 🎯 核心要求

- **编码**: UTF-8
- **字体**: Microsoft YaHei, Arial, sans-serif
- **双向同步**: 保持与 UnifiedTimeline 相同的同步机制
- **用户体验**: 提供日/周/月视图切换

## 🏗️ 架构分析

### 当前状态 (v1.0.0)

#### TimeCalendar 组件 (基础实现)
```
src/components/TimeCalendar.tsx (321行)
├── 使用 ToastUIReactCalendar 包装器
├── 从 localStorage 加载事件和标签
├── 基础事件处理器 (placeholder)
└── 简单的视图控制
```

#### UnifiedTimeline 组件 (完整功能)
```
src/components/UnifiedTimeline.tsx (1010行)
├── 完整的事件 CRUD 逻辑
├── ActionBasedSyncManager 集成
├── 标签到日历的映射 (calendarMapping)
├── 描述编辑器集成
└── 时间范围配置 (ongoing/planning)
```

### 关键数据流

```
本地事件 <---> ActionBasedSyncManager <---> Outlook Calendar
    ↓                     ↓                          ↓
localStorage          记录操作                  Graph API
(EVENTS)           (待同步队列)              (远程日历)
    ↑                     ↑                          ↑
标签系统            日历映射                    日历分组
(TAGS)          (calendarMapping)           (Calendar ID)
```

### 同步机制

1. **本地操作记录**
   ```typescript
   syncManager.recordLocalAction('create'|'update'|'delete', 'event', eventId, newData, oldData)
   ```

2. **事件监听**
   ```typescript
   window.addEventListener('action-sync-completed', handler)
   window.addEventListener('outlook-sync-completed', handler)
   window.addEventListener('local-events-changed', handler)
   ```

3. **标签到日历映射**
   ```typescript
   tag.calendarMapping = {
     provider: 'outlook',
     calendarId: 'calendar-id-from-outlook',
     calendarName: 'Calendar Name'
   }
   ```

## 🔧 实现计划

### Phase 1: 增强 TimeCalendar 事件处理 ✅

**目标**: 实现完整的事件 CRUD 功能

**文件**: `src/components/TimeCalendar.tsx`

**要实现的功能**:
1. ✅ 事件创建 (onBeforeCreateEvent)
2. ✅ 事件更新 (onBeforeUpdateEvent)
3. ✅ 事件删除 (onBeforeDeleteEvent)
4. ✅ 集成 ActionBasedSyncManager
5. ✅ 监听同步事件并刷新

### Phase 2: 自定义样式主题 ✅

**文件**: `src/styles/calendar.css`

**样式要求**:
```css
/* UTF-8 编码 */
@charset "UTF-8";

/* 字体设置 */
* {
  font-family: "Microsoft YaHei", Arial, sans-serif;
}

/* ReMarkable 主题色 */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --success-color: #28a745;
  --danger-color: #dc3545;
  --warning-color: #ffc107;
  --info-color: #17a2b8;
}
```

### Phase 3: 日历分组集成 ✅

**功能**: 将 hierarchicalTags 映射到 TUI Calendar 的 calendars 配置

**实现**:
```typescript
const getCalendars = () => {
  const savedTags = PersistentStorage.getItem(STORAGE_KEYS.HIERARCHICAL_TAGS, PERSISTENT_OPTIONS.TAGS);
  const eventTags = flattenTags(savedTags).filter(tag => 
    tag.category === 'ongoing' || tag.category === 'planning'
  );
  
  return [
    { id: 'default', name: '默认日历', backgroundColor: '#3788d8' },
    ...eventTags.map(tag => ({
      id: tag.id,
      name: tag.displayName || tag.name,
      backgroundColor: tag.color,
      borderColor: tag.color
    }))
  ];
};
```

### Phase 4: 事件数据转换层 ✅

**文件**: `src/utils/calendarUtils.ts` (新建)

**功能**: Event ↔️ TUI Calendar EventObject 转换

```typescript
// ReMarkable Event -> TUI Calendar Event
export function convertToCalendarEvent(event: Event, tags: any[]): Partial<EventObject> {
  return {
    id: event.id,
    title: event.title,
    start: parseLocalTimeString(event.startTime),
    end: parseLocalTimeString(event.endTime),
    category: event.isAllDay ? 'allday' : 'time',
    isAllDay: event.isAllDay,
    body: event.description || '',
    location: event.location || '',
    calendarId: event.tagId || 'default',
    backgroundColor: getTagColor(event.tagId, tags),
    borderColor: getTagColor(event.tagId, tags)
  };
}

// TUI Calendar Event -> ReMarkable Event
export function convertFromCalendarEvent(calendarEvent: any, originalEvent?: Event): Event {
  return {
    id: calendarEvent.id || generateId(),
    title: calendarEvent.title,
    description: calendarEvent.body || '',
    startTime: formatTimeForStorage(calendarEvent.start),
    endTime: formatTimeForStorage(calendarEvent.end),
    isAllDay: calendarEvent.isAllDay || false,
    location: calendarEvent.location || '',
    tagId: calendarEvent.calendarId !== 'default' ? calendarEvent.calendarId : '',
    category: originalEvent?.category || 'planning',
    createdAt: originalEvent?.createdAt || formatTimeForStorage(new Date()),
    updatedAt: formatTimeForStorage(new Date())
  };
}
```

### Phase 5: 描述编辑器集成 ✅

**功能**: 点击事件后弹出描述编辑器（参考 UnifiedTimeline）

```typescript
const handleClickEvent = (eventInfo: any) => {
  const event = events.find(e => e.id === eventInfo.event.id);
  if (event) {
    setEditingEventForDescription(event);
    setShowDescriptionEditor(true);
  }
};
```

### Phase 6: 测试与优化 ✅

**测试场景**:
1. ✅ 在 TimeCalendar 创建事件 -> 检查 localStorage -> 检查 Outlook
2. ✅ 在 Outlook 创建事件 -> 等待同步 -> 检查 TimeCalendar 显示
3. ✅ 修改事件标签 -> 检查事件迁移到对应日历分组
4. ✅ 在 UnifiedTimeline 和 TimeCalendar 之间切换 -> 检查数据一致性
5. ✅ 删除事件 -> 检查双向同步

## 🎨 UI/UX 优化

### 视图控制
- 月视图: 显示整月日历
- 周视图: 显示一周时间表
- 日视图: 显示单日详细时间线

### 自定义工具栏
```tsx
<div className="calendar-toolbar">
  <div className="view-switcher">
    <button onClick={() => setView('month')}>月</button>
    <button onClick={() => setView('week')}>周</button>
    <button onClick={() => setView('day')}>日</button>
  </div>
  <div className="date-navigator">
    <button onClick={prev}>◀</button>
    <button onClick={today}>今天</button>
    <button onClick={next}>▶</button>
  </div>
  <div className="sync-status">
    {lastSyncTime && `最后同步: ${lastSyncTime.toLocaleString()}`}
  </div>
</div>
```

### 事件卡片样式
- 显示标签颜色边框
- 显示事件标题和时间
- 悬停显示完整描述
- 点击进入详细编辑

## 📝 代码规范

### 文件头部注释
```typescript
/**
 * TimeCalendar Component
 * 
 * 使用 TUI Calendar 实现的时光日历组件
 * 支持与 Outlook 的双向实时同步
 * 
 * @charset UTF-8
 * @author Zoey Gong
 * @version 1.0.0
 */
```

### 注释风格
```typescript
// 🔧 配置日历主题
// 📊 加载事件数据
// 🔄 同步到 Outlook
// ✅ 成功
// ❌ 失败
// 🎯 核心逻辑
```

## 🔍 调试工具

在浏览器控制台可用：
```javascript
// 查看缓存信息
ReMarkableCache.info()

// 查看标签配置
ReMarkableCache.tags.getTags()

// 查看事件数据
localStorage.getItem('remarkable-events')

// 手动触发同步
window.syncManager.syncAllPendingActions()
```

## 📚 参考资源

- TUI Calendar 官方文档: https://github.com/nhn/tui.calendar
- TUI Calendar React: https://github.com/nhn/tui.calendar/tree/main/apps/react-calendar
- Microsoft Graph API: https://docs.microsoft.com/en-us/graph/api/resources/event

## ✨ 未来扩展

- [ ] Google Calendar 集成
- [ ] iCloud Calendar 集成
- [ ] 拖拽调整事件时间
- [ ] 批量操作事件
- [ ] 日历视图打印
- [ ] 导入/导出 .ics 文件
