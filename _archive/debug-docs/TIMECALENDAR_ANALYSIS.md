# TimeCalendar 实现分析 - PRD vs 代码对照

> **分析时间**: 2025-01-XX  
> **分析范围**: src/features/Calendar/TimeCalendar.tsx vs docs/PRD/TIMECALENDAR_MODULE_PRD.md

---

## 🔴 **核心问题：登录后没有事件显示**

### 问题根因

**代码中的事件过滤逻辑默认启用了筛选模式，导致所有事件被过滤掉。**

#### 代码位置：TimeCalendar.tsx L1237-1520

```typescript
const { visibleTags, visibleCalendars, eventOpacity } = calendarSettings;

const calendarEvents = useMemo(() => {
  // ... 事件加载逻辑 ...
  
  // 🔴 问题代码：过滤逻辑检查
  const hasTagFilter = visibleTags.length > 0;
  const hasCalendarFilter = visibleCalendars.length > 0;
  
  // 如果 visibleTags 为空数组 []，hasTagFilter = false，应该显示所有事件 ✅
  // 但如果用户从未打开过设置面板，calendarSettings 使用默认值：
  // visibleTags: []
  // visibleCalendars: []
  
  // 标签过滤
  const filteredByTags = filteredByDateRange.filter(event => {
    if (hasTagFilter) {
      const eventTags = event.tags || (event.tagId ? [event.tagId] : []);
      
      const hasNoTagOption = visibleTags.includes('no-tag');
      
      if (eventTags.length === 0) {
        return hasNoTagOption; // 没有标签的事件只有勾选"未定义标签"才显示
      }
      
      return eventTags.some(tagId => visibleTags.includes(tagId));
    }
    return true; // ✅ 没有筛选时显示全部
  });
  
  // 日历过滤
  const filteredByCalendars = filteredByTags.filter(event => {
    if (hasCalendarFilter) {
      const hasLocalCreatedOption = visibleCalendars.includes('local-created');
      const hasNotSyncedOption = visibleCalendars.includes('not-synced');
      
      const isLocalCreated = event.source === 'local' || event.remarkableSource === true;
      const isNotSynced = !event.calendarId || !event.externalId;
      
      if (isLocalCreated && hasLocalCreatedOption) return true;
      if (isNotSynced && hasNotSyncedOption) return true;
      
      if (!event.calendarId) return false; // 🔴 问题：没有 calendarId 的事件被过滤
      
      return visibleCalendars.includes(event.calendarId);
    }
    return true; // ✅ 没有筛选时显示全部
  });
  
  // ...
}, [events, hierarchicalTags, visibleTags, visibleCalendars, ...]);
```

### 逻辑分析

#### 场景 1：新用户首次登录

1. **初始状态**:
   ```typescript
   calendarSettings = {
     visibleTags: [],
     visibleCalendars: [],
     eventOpacity: 85,
     // ...
   }
   ```

2. **从 Outlook 同步事件**:
   ```typescript
   events = [
     {
       id: 'event-1',
       title: '会议',
       calendarId: 'outlook-calendar-id-12345', // ✅ 有 calendarId
       tagId: null, // ❌ 没有分配标签
       tags: [],
       // ...
     },
     // ... 更多事件
   ]
   ```

3. **过滤逻辑执行**:
   ```typescript
   hasTagFilter = visibleTags.length > 0 = false; // ✅ 标签过滤未启用
   hasCalendarFilter = visibleCalendars.length > 0 = false; // ✅ 日历过滤未启用
   
   // 标签过滤
   filteredByTags.filter(event => {
     if (false) { ... } // 跳过
     return true; // ✅ 所有事件通过标签过滤
   });
   
   // 日历过滤
   filteredByCalendars.filter(event => {
     if (false) { ... } // 跳过
     return true; // ✅ 所有事件通过日历过滤
   });
   ```

4. **结论**: ✅ **理论上应该显示所有事件**

#### 场景 2：用户打开过设置面板但没有选择任何标签/日历

1. **状态变化**:
   ```typescript
   // 用户打开设置面板，但没有勾选任何标签/日历
   // CalendarSettingsPanel 可能更新了 visibleTags/visibleCalendars
   calendarSettings = {
     visibleTags: [], // 用户手动取消了所有标签？
     visibleCalendars: [], // 用户手动取消了所有日历？
     // ...
   }
   ```

2. **过滤逻辑执行**: 同场景 1，应该显示所有事件

#### 场景 3：localStorage 中存在损坏的设置数据

1. **损坏的设置**:
   ```typescript
   // localStorage 中保存了无效的标签 ID
   localStorage.getItem('remarkable-calendar-settings') = {
     visibleTags: ['deleted-tag-id-123', 'non-existent-tag-456'],
     visibleCalendars: ['deleted-calendar-id-789'],
     // ...
   }
   ```

2. **验证与清理** (L368-427 `validateAndCleanSettings`):
   ```typescript
   const validTagIds = new Set(['current-tag-1', 'current-tag-2']); // 当前有效标签
   
   let validVisibleTags = ['deleted-tag-id-123', 'non-existent-tag-456']
     .filter(id => validTagIds.has(id)); // ❌ 都被过滤掉
   // validVisibleTags = []
   
   // 🔴 关键逻辑：如果清理后标签太少，直接清空
   if (validVisibleTags.length > 0 && validVisibleTags.length < 2) {
     console.log('✅ [TimeCalendar] Too few valid tags after cleanup, clearing tag filter');
     validVisibleTags = []; // ✅ 清空筛选
   }
   
   // 更新设置
   setCalendarSettings({
     ...settings,
     visibleTags: validVisibleTags, // []
     visibleCalendars: validVisibleCalendars // []
   });
   ```

3. **结论**: ✅ **清理机制正确，应该显示所有事件**

---

### 🔍 **深入调试：为什么没有事件显示？**

#### 检查点 1: localStorage 中是否有事件数据？

**验证步骤**:
```javascript
// 在浏览器 Console 运行
const eventsData = localStorage.getItem('remarkable-events');
if (eventsData) {
  const events = JSON.parse(eventsData);
  console.log(`✅ 找到 ${events.length} 个事件:`, events);
  
  // 检查事件结构
  events.slice(0, 3).forEach(e => {
    console.log({
      id: e.id,
      title: e.title,
      startTime: e.startTime,
      endTime: e.endTime,
      calendarId: e.calendarId,
      tagId: e.tagId,
      tags: e.tags
    });
  });
} else {
  console.error('❌ localStorage 中没有事件数据');
}
```

**预期结果**:
- ✅ 有事件数据 → 进入检查点 2
- ❌ 没有事件数据 → **问题在同步机制，Outlook 事件没有保存到 localStorage**

---

#### 检查点 2: calendarSettings 的实际值是什么？

**验证步骤**:
```javascript
// 在浏览器 Console 运行
const settings = localStorage.getItem('remarkable-calendar-settings');
if (settings) {
  const parsed = JSON.parse(settings);
  console.log('📋 当前设置:', parsed);
  console.log('📊 筛选状态:', {
    hasTagFilter: (parsed.visibleTags?.length || 0) > 0,
    hasCalendarFilter: (parsed.visibleCalendars?.length || 0) > 0,
    visibleTags: parsed.visibleTags,
    visibleCalendars: parsed.visibleCalendars
  });
} else {
  console.log('📋 使用默认设置 (没有筛选)');
}
```

**预期结果**:
- `visibleTags: []` 且 `visibleCalendars: []` → 应该显示所有事件
- `visibleTags: ['some-id']` 或 `visibleCalendars: ['some-id']` → **问题在筛选逻辑，检查这些 ID 是否有效**

---

#### 检查点 3: 事件在日期范围内吗？

**代码位置**: TimeCalendar.tsx L1383-1399

```typescript
// 🚀 性能优化：只加载当前视图范围 ±3个月的事件
const viewStart = new Date(currentDate);
viewStart.setMonth(viewStart.getMonth() - 3);
viewStart.setHours(0, 0, 0, 0);

const viewEnd = new Date(currentDate);
viewEnd.setMonth(viewEnd.getMonth() + 3);
viewEnd.setHours(23, 59, 59, 999);

const filteredByDateRange = eventsToProcess.filter(event => {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  // 事件与视图范围有重叠即加载
  return eventEnd >= viewStart && eventStart <= viewEnd;
});
```

**验证步骤**:
```javascript
// 在浏览器 Console 运行
const eventsData = localStorage.getItem('remarkable-events');
const currentDateStr = localStorage.getItem('remarkable-calendar-current-date');
const currentDate = currentDateStr ? new Date(currentDateStr) : new Date();

console.log('📅 当前查看日期:', currentDate);

const viewStart = new Date(currentDate);
viewStart.setMonth(viewStart.getMonth() - 3);
viewStart.setHours(0, 0, 0, 0);

const viewEnd = new Date(currentDate);
viewEnd.setMonth(viewEnd.getMonth() + 3);
viewEnd.setHours(23, 59, 59, 999);

console.log('📅 视图范围:', {
  start: viewStart,
  end: viewEnd
});

if (eventsData) {
  const events = JSON.parse(eventsData);
  const inRange = events.filter(e => {
    const eventStart = new Date(e.startTime);
    const eventEnd = new Date(e.endTime);
    return eventEnd >= viewStart && eventStart <= viewEnd;
  });
  
  console.log(`✅ 在视图范围内的事件: ${inRange.length}/${events.length}`);
  
  if (inRange.length === 0) {
    console.log('⚠️ 所有事件都在视图范围外，显示前3个事件的时间:');
    events.slice(0, 3).forEach(e => {
      console.log({
        title: e.title,
        start: new Date(e.startTime),
        end: new Date(e.endTime)
      });
    });
  }
}
```

**预期结果**:
- 有事件在范围内 → 进入检查点 4
- 没有事件在范围内 → **问题在日期范围，用户查看的日期与事件时间不匹配**

---

#### 检查点 4: 事件被标签/日历筛选器过滤了吗？

**验证步骤**:
```javascript
// 在浏览器 Console 运行（完整模拟过滤逻辑）
const eventsData = localStorage.getItem('remarkable-events');
const settings = localStorage.getItem('remarkable-calendar-settings');

if (eventsData) {
  const events = JSON.parse(eventsData);
  const parsed = settings ? JSON.parse(settings) : { visibleTags: [], visibleCalendars: [] };
  
  const visibleTags = parsed.visibleTags || [];
  const visibleCalendars = parsed.visibleCalendars || [];
  
  const hasTagFilter = visibleTags.length > 0;
  const hasCalendarFilter = visibleCalendars.length > 0;
  
  console.log('🔍 筛选器状态:', {
    hasTagFilter,
    hasCalendarFilter,
    visibleTags,
    visibleCalendars
  });
  
  // 标签过滤
  const filteredByTags = events.filter(event => {
    if (hasTagFilter) {
      const eventTags = event.tags || (event.tagId ? [event.tagId] : []);
      const hasNoTagOption = visibleTags.includes('no-tag');
      
      if (eventTags.length === 0) {
        return hasNoTagOption;
      }
      
      return eventTags.some(tagId => visibleTags.includes(tagId));
    }
    return true;
  });
  
  console.log(`✅ 标签过滤后: ${filteredByTags.length}/${events.length} 事件`);
  
  // 日历过滤
  const filteredByCalendars = filteredByTags.filter(event => {
    if (hasCalendarFilter) {
      const hasLocalCreatedOption = visibleCalendars.includes('local-created');
      const hasNotSyncedOption = visibleCalendars.includes('not-synced');
      
      const isLocalCreated = event.source === 'local' || event.remarkableSource === true;
      const isNotSynced = !event.calendarId || !event.externalId;
      
      if (isLocalCreated && hasLocalCreatedOption) return true;
      if (isNotSynced && hasNotSyncedOption) return true;
      
      if (!event.calendarId) return false;
      
      return visibleCalendars.includes(event.calendarId);
    }
    return true;
  });
  
  console.log(`✅ 日历过滤后: ${filteredByCalendars.length}/${filteredByTags.length} 事件`);
  
  if (filteredByCalendars.length === 0 && filteredByTags.length > 0) {
    console.error('❌ 日历过滤器过滤掉了所有事件！');
    console.log('🔍 检查前3个事件的 calendarId:');
    filteredByTags.slice(0, 3).forEach(e => {
      console.log({
        title: e.title,
        calendarId: e.calendarId,
        source: e.source,
        remarkableSource: e.remarkableSource,
        externalId: e.externalId
      });
    });
  }
}
```

**预期结果**:
- `filteredByCalendars.length > 0` → 应该有事件显示，**问题可能在渲染层**
- `filteredByCalendars.length === 0` → **找到问题！筛选器过滤了所有事件**

---

## 📋 **PRD vs 代码矛盾清单**

### 1. ❌ **事件加载逻辑缺少主动触发机制**

#### PRD 要求 (L600-650)

> **数据加载与转换 > 加载事件数据**
> 
> 组件挂载时应立即加载事件数据：
> ```typescript
> useEffect(() => {
>   loadEvents(); // 挂载时立即加载
>   loadHierarchicalTags(); // 加载标签
> }, []);
> ```

#### 实际代码

**TimeCalendar.tsx L465-593**: 事件加载**只**在以下情况触发：
- ✅ 事件监听器触发 (`action-sync-completed`, `local-events-changed`, `eventsUpdated`)
- ✅ Widget 模式：localStorage 轮询检测到变化
- ❌ **缺少**: 组件挂载时的主动加载

**代码片段**:
```typescript
useEffect(() => {
  // ✅ 绑定事件监听器
  window.addEventListener('action-sync-completed', handleSyncCompleted);
  // ... 其他监听器
  
  // ❌ 缺少：初始化加载
  // loadEvents(); // 应该有这一行
  // loadHierarchicalTags(); // 应该有这一行
  
  return () => {
    // 清理监听器
  };
}, []);
```

**影响**:
- 如果用户登录后同步事件，但**没有触发 `action-sync-completed` 事件**（例如同步失败或延迟），则日历永远不会加载事件
- Widget 模式可能通过轮询机制部分缓解，但主应用模式完全依赖事件触发

**修复建议**:
```typescript
useEffect(() => {
  // 🔧 初始化加载
  console.log('🚀 [INIT] Loading initial data...');
  loadEvents();
  loadHierarchicalTags();
  
  // 绑定事件监听器
  // ...
}, [loadEvents, loadHierarchicalTags]);
```

---

### 2. ❌ **日历筛选逻辑与 Outlook 同步事件不兼容**

#### PRD 要求 (无明确说明，但隐含)

> 从 Outlook 同步的事件应该默认显示，除非用户明确选择筛选

#### 实际代码

**TimeCalendar.tsx L1446-1472**: 日历过滤器对没有 `calendarId` 的事件处理不当

**问题代码**:
```typescript
const filteredByCalendars = filteredByTags.filter(event => {
  if (hasCalendarFilter) {
    // ... 特殊选项处理 ...
    
    if (!event.calendarId) return false; // 🔴 问题：直接过滤
    
    return visibleCalendars.includes(event.calendarId);
  }
  return true;
});
```

**场景**:
1. 用户从 Outlook 同步事件，所有事件都有 `calendarId: 'outlook-calendar-123'`
2. 用户第一次打开设置面板，没有勾选任何日历
3. `visibleCalendars = []` → `hasCalendarFilter = false`
4. 理论上应该显示所有事件 ✅

**但是**，如果 localStorage 中存在旧的 `visibleCalendars: ['deleted-calendar-id']`：
1. `validateAndCleanSettings()` 清理后 → `visibleCalendars = []`
2. 但是清理后的设置**立即保存**到 localStorage
3. 下次加载时，`hasCalendarFilter = false`，应该显示所有事件 ✅

**实际问题可能在于**:
- 清理逻辑可能有 bug，没有正确清空 `visibleCalendars`
- 或者用户手动取消了所有日历勾选，导致 `visibleCalendars = []` 但同时 `hasCalendarFilter = false`

**检查代码**: TimeCalendar.tsx L391-420

```typescript
let validVisibleCalendars = (settings.visibleCalendars || [])
  .filter(id => validCalendarIds.has(id));

// 🔴 关键：日历筛选器没有"太少自动清空"的逻辑
// 与标签筛选器不一致！

// 标签有这个逻辑：
if (validVisibleTags.length > 0 && validVisibleTags.length < 2) {
  validVisibleTags = [];
}

// 日历缺少类似逻辑
// 如果应该加上：
if (validVisibleCalendars.length > 0 && validVisibleCalendars.length < 2) {
  validVisibleCalendars = [];
}
```

**修复建议**:
```typescript
// 在 validateAndCleanSettings() 中添加
if (validVisibleCalendars.length > 0 && validVisibleCalendars.length < 2) {
  console.log('✅ [TimeCalendar] Too few valid calendars after cleanup, clearing calendar filter');
  validVisibleCalendars = [];
}
```

---

### 3. ⚠️ **事件去重逻辑可能意外过滤正常事件**

#### PRD 要求 (无)

> 去重逻辑应该只移除真正重复的事件，不应影响正常显示

#### 实际代码

**TimeCalendar.tsx L1474-1481**: 去重逻辑

```typescript
const uniqueByIdMap = new Map<string, any>();
filteredByCalendars.forEach(e => {
  if (e && e.id && !uniqueByIdMap.has(e.id)) {
    uniqueByIdMap.set(e.id, e);
  }
});
const uniqueFiltered = Array.from(uniqueByIdMap.values());
```

**潜在问题**:
- 如果 `e.id` 为 `null` 或 `undefined`，事件被跳过
- 如果两个不同的事件意外共享相同的 `id`，后面的事件被去重

**验证步骤**:
```javascript
const eventsData = localStorage.getItem('remarkable-events');
if (eventsData) {
  const events = JSON.parse(eventsData);
  
  // 检查是否有无效 ID
  const invalidIds = events.filter(e => !e.id);
  console.log(`❌ 无效 ID 的事件数量: ${invalidIds.length}`);
  
  // 检查是否有重复 ID
  const idCounts = events.reduce((acc, e) => {
    if (e.id) {
      acc[e.id] = (acc[e.id] || 0) + 1;
    }
    return acc;
  }, {});
  
  const duplicates = Object.entries(idCounts).filter(([id, count]) => count > 1);
  console.log(`⚠️ 重复 ID 的事件:`, duplicates);
}
```

**修复建议**:
```typescript
// 添加日志记录被跳过的事件
const skipped: any[] = [];
filteredByCalendars.forEach(e => {
  if (!e || !e.id) {
    skipped.push(e);
  } else if (!uniqueByIdMap.has(e.id)) {
    uniqueByIdMap.set(e.id, e);
  }
});

if (skipped.length > 0) {
  console.warn(`⚠️ [DEDUP] Skipped ${skipped.length} events with invalid IDs`);
}
```

---

### 4. ✅ **视图范围过滤逻辑正确**

#### PRD 要求 (L600-650)

> 只加载当前视图范围 ±3 个月的事件，优化性能

#### 实际代码

**TimeCalendar.tsx L1383-1399**: 视图范围过滤

```typescript
const viewStart = new Date(currentDate);
viewStart.setMonth(viewStart.getMonth() - 3);
viewStart.setHours(0, 0, 0, 0);

const viewEnd = new Date(currentDate);
viewEnd.setMonth(viewEnd.getMonth() + 3);
viewEnd.setHours(23, 59, 59, 999);

const filteredByDateRange = eventsToProcess.filter(event => {
  const eventStart = new Date(event.startTime);
  const eventEnd = new Date(event.endTime);
  return eventEnd >= viewStart && eventStart <= viewEnd;
});
```

**评价**: ✅ 逻辑正确，与 PRD 一致

---

### 5. ✅ **Timer 事件实时更新机制正确**

#### PRD 要求 (L600-650)

> Widget 模式通过 localStorage 轮询检测 Timer 状态变化

#### 实际代码

**TimeCalendar.tsx L187-216**: localStorage 轮询

```typescript
useEffect(() => {
  if (!globalTimer) { // 只在 Widget 场景启用
    const checkTimer = () => {
      const eventsData = localStorage.getItem('remarkable-events');
      const timerState = localStorage.getItem('remarkable-global-timer');
      
      if (eventsData !== lastEventsStateRef.current) {
        lastEventsStateRef.current = eventsData;
        setLocalStorageTimerTrigger(prev => prev + 1);
      }
      
      if (timerState !== lastTimerStateRef.current) {
        lastTimerStateRef.current = timerState;
        setLocalStorageTimerTrigger(prev => prev + 1);
      }
    };
    
    checkTimer();
    const interval = setInterval(checkTimer, 2000);
    
    return () => clearInterval(interval);
  }
}, [globalTimer]);
```

**评价**: ✅ 逻辑正确，Widget 模式下 Timer 事件能实时更新

---

### 6. ❌ **CalendarSettingsPanel 与 TimeCalendar 状态同步问题**

#### PRD 要求 (无明确说明)

> 设置面板应该正确反映当前筛选状态，用户修改后立即生效

#### 潜在问题

**假设**：CalendarSettingsPanel 组件可能在初始化时设置了 `visibleTags` 或 `visibleCalendars` 的默认值

**需要检查**:
1. CalendarSettingsPanel 初始化时是否强制设置 `visibleTags = []`？
2. 用户"全选"后再"取消全选"，是否错误地保留了 `visibleTags.length > 0`？
3. 设置面板关闭时，是否正确保存状态到 localStorage？

**验证步骤**:
```javascript
// 在浏览器 Console 运行
// 1. 检查设置面板初始状态
const settingsPanel = document.querySelector('[data-component="CalendarSettingsPanel"]');
console.log('设置面板 DOM:', settingsPanel);

// 2. 监听设置变化
let originalSetItem = localStorage.setItem;
localStorage.setItem = function(key, value) {
  if (key === 'remarkable-calendar-settings') {
    console.log('🔍 [STORAGE] Settings updated:', JSON.parse(value));
  }
  return originalSetItem.apply(this, arguments);
};
```

**修复建议**: 需要检查 `CalendarSettingsPanel.tsx` 的实现（不在当前分析范围）

---

## 🎯 **问题总结与修复优先级**

### P0 - 必须立即修复

#### ❌ **缺少组件挂载时的初始化加载**

**问题**: TimeCalendar 挂载后不会主动加载事件，完全依赖事件触发

**修复**:
```typescript
// TimeCalendar.tsx L465 附近添加
useEffect(() => {
  // 🔧 初始化加载
  console.log('🚀 [INIT] Loading initial data on mount...');
  loadEvents();
  loadHierarchicalTags();
  
  // 原有的事件监听器绑定代码...
}, [loadEvents, loadHierarchicalTags]);
```

**预期效果**: 用户登录后立即看到事件，无需等待同步完成事件

---

### P1 - 建议尽快修复

#### ⚠️ **日历筛选器清理逻辑不一致**

**问题**: 标签筛选器有"太少自动清空"逻辑，日历筛选器没有

**修复**:
```typescript
// TimeCalendar.tsx validateAndCleanSettings() 中添加
if (validVisibleCalendars.length > 0 && validVisibleCalendars.length < 2) {
  console.log('✅ [TimeCalendar] Too few valid calendars after cleanup, clearing calendar filter');
  validVisibleCalendars = [];
}
```

**预期效果**: 清理无效日历 ID 后，如果只剩 1 个有效日历，自动清空筛选，显示所有事件

---

### P2 - 可选优化

#### 📊 **去重逻辑添加监控**

**问题**: 没有日志记录被跳过的无效事件

**修复**:
```typescript
// TimeCalendar.tsx 去重逻辑中添加
const skipped: any[] = [];
filteredByCalendars.forEach(e => {
  if (!e || !e.id) {
    skipped.push(e);
  } else if (!uniqueByIdMap.has(e.id)) {
    uniqueByIdMap.set(e.id, e);
  }
});

if (skipped.length > 0) {
  console.warn(`⚠️ [DEDUP] Skipped ${skipped.length} events with invalid IDs:`, skipped.map(e => e?.title));
}
```

**预期效果**: 发现数据质量问题时能及时定位

---

## 🔧 **调试建议**

### 1. 打开开发者工具 Console

在浏览器中按 `F12` 打开开发者工具，查看控制台日志：

**期望看到的日志**:
```
🚀 [INIT] Loading initial data on mount...
📅 [LOAD] Loading 42 events from localStorage
📥 [LOAD] Loading 15 tags
🎨 [useMemo #1] Computing calendar events: 42 raw events
📅 [useMemo] Date range filter: 42 → 38 events
⏱️ [useMemo] Total: 12.5ms | Filtered: 38 events
```

**如果看到**:
```
⚠️ [LOAD] No events found in localStorage
```
→ 问题在同步机制，Outlook 事件没有保存到 localStorage

**如果看到**:
```
🎨 [useMemo] Computing calendar events: 42 raw events
📅 [useMemo] Date range filter: 42 → 0 events
```
→ 问题在日期范围，事件时间与当前查看日期不匹配

**如果看到**:
```
🎨 [useMemo] Computing calendar events: 42 raw events
📅 [useMemo] Date range filter: 42 → 38 events
⏱️ [useMemo] Total: 10.2ms | Filtered: 0 events
```
→ 问题在筛选器，检查 `visibleTags` 和 `visibleCalendars`

---

### 2. 手动运行诊断脚本

在浏览器 Console 中粘贴以下完整诊断脚本：

```javascript
console.log('🔍 === TimeCalendar 诊断开始 ===');

// 1. 检查 localStorage 事件数据
const eventsData = localStorage.getItem('remarkable-events');
if (!eventsData) {
  console.error('❌ 诊断失败：localStorage 中没有事件数据');
  console.log('💡 可能原因：');
  console.log('   - Outlook 同步失败');
  console.log('   - 同步完成但没有触发保存到 localStorage');
  console.log('   - localStorage 被清空或损坏');
} else {
  const events = JSON.parse(eventsData);
  console.log(`✅ 找到 ${events.length} 个事件`);
  
  // 2. 检查日期范围
  const currentDateStr = localStorage.getItem('remarkable-calendar-current-date');
  const currentDate = currentDateStr ? new Date(currentDateStr) : new Date();
  
  const viewStart = new Date(currentDate);
  viewStart.setMonth(viewStart.getMonth() - 3);
  viewStart.setHours(0, 0, 0, 0);
  
  const viewEnd = new Date(currentDate);
  viewEnd.setMonth(viewEnd.getMonth() + 3);
  viewEnd.setHours(23, 59, 59, 999);
  
  const inRange = events.filter(e => {
    const eventStart = new Date(e.startTime);
    const eventEnd = new Date(e.endTime);
    return eventEnd >= viewStart && eventStart <= viewEnd;
  });
  
  console.log(`✅ 在视图范围内的事件: ${inRange.length}/${events.length}`);
  console.log(`📅 当前查看日期: ${currentDate.toLocaleDateString()}`);
  console.log(`📅 视图范围: ${viewStart.toLocaleDateString()} ~ ${viewEnd.toLocaleDateString()}`);
  
  if (inRange.length === 0) {
    console.warn('⚠️ 所有事件都在视图范围外');
    console.log('💡 显示最近的3个事件:');
    events.slice(0, 3).forEach(e => {
      console.log(`   - ${e.title}: ${new Date(e.startTime).toLocaleString()}`);
    });
  } else {
    // 3. 检查筛选器
    const settingsStr = localStorage.getItem('remarkable-calendar-settings');
    const settings = settingsStr ? JSON.parse(settingsStr) : { visibleTags: [], visibleCalendars: [] };
    
    const visibleTags = settings.visibleTags || [];
    const visibleCalendars = settings.visibleCalendars || [];
    
    const hasTagFilter = visibleTags.length > 0;
    const hasCalendarFilter = visibleCalendars.length > 0;
    
    console.log(`✅ 筛选器状态:`);
    console.log(`   - hasTagFilter: ${hasTagFilter} (visibleTags: ${JSON.stringify(visibleTags)})`);
    console.log(`   - hasCalendarFilter: ${hasCalendarFilter} (visibleCalendars: ${JSON.stringify(visibleCalendars)})`);
    
    // 标签过滤
    const filteredByTags = inRange.filter(event => {
      if (hasTagFilter) {
        const eventTags = event.tags || (event.tagId ? [event.tagId] : []);
        const hasNoTagOption = visibleTags.includes('no-tag');
        
        if (eventTags.length === 0) {
          return hasNoTagOption;
        }
        
        return eventTags.some(tagId => visibleTags.includes(tagId));
      }
      return true;
    });
    
    console.log(`✅ 标签过滤后: ${filteredByTags.length}/${inRange.length} 事件`);
    
    // 日历过滤
    const filteredByCalendars = filteredByTags.filter(event => {
      if (hasCalendarFilter) {
        const hasLocalCreatedOption = visibleCalendars.includes('local-created');
        const hasNotSyncedOption = visibleCalendars.includes('not-synced');
        
        const isLocalCreated = event.source === 'local' || event.remarkableSource === true;
        const isNotSynced = !event.calendarId || !event.externalId;
        
        if (isLocalCreated && hasLocalCreatedOption) return true;
        if (isNotSynced && hasNotSyncedOption) return true;
        
        if (!event.calendarId) return false;
        
        return visibleCalendars.includes(event.calendarId);
      }
      return true;
    });
    
    console.log(`✅ 日历过滤后: ${filteredByCalendars.length}/${filteredByTags.length} 事件`);
    
    // 4. 最终结果
    if (filteredByCalendars.length === 0) {
      console.error('❌ 诊断结果：所有事件被筛选器过滤掉了');
      console.log('💡 可能原因：');
      
      if (hasTagFilter && filteredByTags.length === 0) {
        console.log('   - 标签筛选器过滤了所有事件');
        console.log('   - 检查 visibleTags 是否包含有效的标签 ID');
        console.log(`   - 当前 visibleTags: ${JSON.stringify(visibleTags)}`);
        console.log('   - 前3个事件的标签:');
        inRange.slice(0, 3).forEach(e => {
          const eventTags = e.tags || (e.tagId ? [e.tagId] : []);
          console.log(`     - ${e.title}: ${JSON.stringify(eventTags)}`);
        });
      }
      
      if (hasCalendarFilter && filteredByCalendars.length === 0) {
        console.log('   - 日历筛选器过滤了所有事件');
        console.log('   - 检查 visibleCalendars 是否包含有效的日历 ID');
        console.log(`   - 当前 visibleCalendars: ${JSON.stringify(visibleCalendars)}`);
        console.log('   - 前3个事件的日历 ID:');
        filteredByTags.slice(0, 3).forEach(e => {
          console.log(`     - ${e.title}: calendarId=${e.calendarId}, source=${e.source}`);
        });
      }
    } else {
      console.log(`✅ 诊断结果：应该显示 ${filteredByCalendars.length} 个事件`);
      console.log('💡 如果日历仍然是空的，可能是渲染层的问题');
      console.log('💡 检查 TUI Calendar 实例是否正确初始化');
      console.log('💡 检查 calendarEvents 是否正确传递给 ToastUIReactCalendar');
    }
  }
}

console.log('🔍 === TimeCalendar 诊断结束 ===');
```

---

### 3. 临时禁用筛选器

如果怀疑筛选器导致问题，可以临时清空筛选设置：

```javascript
// 在浏览器 Console 运行
localStorage.setItem('remarkable-calendar-settings', JSON.stringify({
  eventOpacity: 85,
  visibleTags: [],
  visibleCalendars: [],
  showDeadline: true,
  showTask: true,
  showAllDay: true,
  deadlineHeight: 24,
  taskHeight: 24,
  allDayHeight: 24
}));

console.log('✅ 已清空筛选器设置，请刷新页面');
location.reload();
```

---

## 📝 **总结**

### 根本原因

**TimeCalendar 组件没有在挂载时主动加载事件数据**，完全依赖事件监听器触发。如果同步完成事件没有正确触发，或者用户在同步完成前就打开了日历，就会看到空白的日历。

### 修复方案

1. **立即修复 (P0)**: 在 `useEffect` 中添加 `loadEvents()` 和 `loadHierarchicalTags()` 初始化调用
2. **建议修复 (P1)**: 统一标签和日历筛选器的清理逻辑
3. **长期优化 (P2)**: 添加更多调试日志和数据验证

### 验证步骤

1. 运行诊断脚本，确定问题具体在哪一层
2. 根据诊断结果应用相应的修复
3. 刷新页面，检查是否能看到事件
4. 如果仍然有问题，检查 CalendarSettingsPanel 和 TUI Calendar 渲染逻辑
