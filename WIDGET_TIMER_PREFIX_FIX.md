# Widget "[专注中]" 前缀显示问题修复

## 问题描述
DesktopCalendarWidget 无法在计时中的事件标题上显示 "[专注中]" 前缀，而主应用的 TimeCalendar 可以正常显示。

## 根本原因分析

### 实现机制
"[专注中]" 前缀是在 **UI 渲染时** 动态添加的，而不是保存在 localStorage 中：

1. **数据层**：localStorage 中保存的事件标题是原始标题（无前缀）
2. **UI 层**：`convertToCalendarEvent` 函数根据 `runningTimerEventId` 判断是否添加前缀
3. **关键代码**（`src/utils/calendarUtils.ts:289-292`）：
   ```typescript
   const isTimerRunning = runningTimerEventId !== null && event.id === runningTimerEventId;
   const displayTitle = isTimerRunning ? `[专注中] ${event.title}` : event.title;
   ```

### Widget 失效原因
Widget 模式下，TimeCalendar 组件的 `calendarEvents` useMemo 缺少关键依赖项：

**修复前**：
```typescript
}, [events, hierarchicalTags, visibleTags, visibleCalendars, eventOpacity, currentDate, globalTimer]);
```

**问题**：缺少 `localStorageTimerTrigger` 依赖，导致：
1. Widget 中 localStorage timer 状态变化时
2. `localStorageTimerTrigger` 更新
3. 但 `calendarEvents` useMemo 不重新计算
4. UI 不更新，无法显示 "[专注中]" 前缀

## 修复方案

### ✅ 选择的方案：修复 useMemo 依赖项
**优势**：
- 🚀 **最小修改**：只需添加一个依赖项
- 🚀 **零性能影响**：复用现有的监听机制
- 🚀 **高效率**：没有额外的监听进程
- 🚀 **架构一致**：与现有实现完全兼容

**修复代码**：
```typescript
}, [events, hierarchicalTags, visibleTags, visibleCalendars, eventOpacity, currentDate, globalTimer, localStorageTimerTrigger]);
```

### ❌ 其他考虑过的方案

1. **添加额外的事件监听器**
   - ❌ 增加系统复杂度
   - ❌ 潜在的内存泄漏风险
   - ❌ 与用户要求不符（避免过多监听进程）

2. **修改数据存储结构**
   - ❌ 破坏现有架构
   - ❌ 需要大量修改
   - ❌ 可能影响数据同步

3. **独立的 Widget 渲染逻辑**
   - ❌ 代码重复
   - ❌ 维护成本高
   - ❌ 容易产生不一致

## 技术细节

### Timer 状态检测机制
```typescript
const getRunningTimerEventId = () => {
  // 1. 优先使用 globalTimer prop（主应用）
  if (globalTimer && globalTimer.isRunning) {
    return `timer-${globalTimer.tagId}-${globalTimer.originalStartTime || globalTimer.startTime}`;
  }
  
  // 2. 从 localStorage 读取（Widget）
  const saved = localStorage.getItem('remarkable-global-timer');
  if (saved) {
    const timer = JSON.parse(saved);
    if (timer && timer.isRunning) {
      return `timer-${timer.tagId}-${timer.originalStartTime || timer.startTime}`;
    }
  }
  
  return null;
};
```

### 现有监听机制
Widget 已经有完善的 localStorage 监听：
1. **轮询检测**（每2秒）：`setInterval(checkTimer, 2000)`
2. **storage 事件**：`window.addEventListener('storage', handleStorageChange)`
3. **状态触发器**：`localStorageTimerTrigger` 状态变化

### 数据流向
```
Timer 启动 → localStorage 更新 → 监听器触发 → localStorageTimerTrigger++ → useMemo 重新计算 → UI 更新显示 "[专注中]"
```

## 预期效果

修复后，Widget 将能够：
1. ✅ **实时显示** "[专注中]" 前缀
2. ✅ **与主应用完全一致** 的 timer 状态显示
3. ✅ **零延迟** 响应 timer 状态变化
4. ✅ **保持高性能** 无额外监听进程

## 测试建议

1. **基础功能测试**：
   - 在主应用启动 Timer
   - 检查 Widget 是否立即显示 "[专注中]" 前缀
   - 停止 Timer，检查前缀是否立即消失

2. **跨窗口同步测试**：
   - 同时打开主应用和 Widget
   - 在任一窗口启动/停止 Timer
   - 验证两个窗口显示完全一致

3. **性能测试**：
   - 监控 CPU 使用率
   - 确认没有引入额外的性能开销

这个修复方案完美平衡了功能需求和性能要求，用最小的代码变更解决了问题。