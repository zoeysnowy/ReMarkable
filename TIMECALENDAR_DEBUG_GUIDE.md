# TimeCalendar 没有事件显示 - 调试指南

> **问题**: 登录后 TimeCalendar 不显示任何事件  
> **症状**: 日历页面是空白的，没有任何事件卡片  
> **创建时间**: 2025-01-XX

---

## 🚀 快速调试步骤

### 步骤 1: 运行诊断脚本

1. 打开应用程序
2. 按 `F12` 打开开发者工具
3. 切换到 **Console** 标签
4. 复制粘贴 `diagnose-timecalendar.js` 中的代码
5. 按 Enter 运行

诊断脚本会自动检查：
- ✅ localStorage 中是否有事件数据
- ✅ 事件是否在当前视图的日期范围内
- ✅ 标签筛选器是否过滤了所有事件
- ✅ 日历筛选器是否过滤了所有事件
- ✅ 去重逻辑是否正常工作

---

### 步骤 2: 根据诊断结果采取行动

#### 场景 A: localStorage 中没有事件数据

**诊断输出**:
```
❌ 诊断失败：localStorage 中没有事件数据
```

**原因**: Outlook 同步失败或没有保存到 localStorage

**解决方案**:
1. 检查 Outlook 登录状态（是否已登录？）
2. 检查同步状态（Console 中搜索 "sync" 关键字）
3. 手动触发同步：
   - 点击"同步"按钮
   - 或者刷新页面重新登录
4. 检查 `MicrosoftCalendarService` 的日志

---

#### 场景 B: 事件都在视图范围外

**诊断输出**:
```
⚠️ 所有事件都在视图范围外！
```

**原因**: 当前查看的日期与事件时间不匹配

**解决方案**:
1. 点击日历工具栏的 **"今天"** 按钮
2. 或者使用左右箭头导航到事件所在的日期

---

#### 场景 C: 标签筛选器过滤了所有事件

**诊断输出**:
```
❌ 标签筛选器过滤掉了所有事件！
```

**原因**: 设置面板中选择的标签与事件的标签不匹配

**解决方案**:

**方法 1: 通过 UI 清空筛选器**
1. 点击日历工具栏的 **设置** 按钮（⚙️ 图标）
2. 在"标签筛选"部分，取消勾选所有标签（或勾选正确的标签）
3. 关闭设置面板

**方法 2: 通过 Console 清空筛选器**
```javascript
// 在 Console 中运行
const settings = JSON.parse(localStorage.getItem('remarkable-calendar-settings'));
settings.visibleTags = [];
localStorage.setItem('remarkable-calendar-settings', JSON.stringify(settings));
location.reload(); // 刷新页面
```

---

#### 场景 D: 日历筛选器过滤了所有事件

**诊断输出**:
```
❌ 日历筛选器过滤掉了所有事件！
```

**原因**: 设置面板中选择的日历与事件的日历 ID 不匹配

**解决方案**:

**方法 1: 通过 UI 清空筛选器**
1. 点击日历工具栏的 **设置** 按钮（⚙️ 图标）
2. 在"日历筛选"部分，取消勾选所有日历（或勾选正确的日历）
3. 关闭设置面板

**方法 2: 通过 Console 清空筛选器**
```javascript
// 在 Console 中运行
const settings = JSON.parse(localStorage.getItem('remarkable-calendar-settings'));
settings.visibleCalendars = [];
localStorage.setItem('remarkable-calendar-settings', JSON.stringify(settings));
location.reload(); // 刷新页面
```

---

#### 场景 E: 诊断显示应该有事件，但日历仍然是空的

**诊断输出**:
```
✅ 最终结果：应该显示 X 个事件
💡 如果日历仍然是空的，可能是渲染层的问题
```

**原因**: 事件数据正常，但 TUI Calendar 渲染失败

**解决方案**:

1. **检查 Console 错误**:
   - 查看是否有 React 错误
   - 查看是否有 TUI Calendar 错误

2. **检查 useMemo 日志**:
   - 在 Console 中搜索 `[useMemo]`
   - 应该看到类似这样的日志：
     ```
     🎨 [useMemo #1] Computing calendar events: 42 raw events
     📅 [useMemo] Date range filter: 42 → 38 events
     ⏱️ [useMemo] Total: 12.5ms | Filtered: 38 events
     ```
   - 如果没有这些日志，说明 `useMemo` 没有执行

3. **检查 calendarEvents 状态**:
   ```javascript
   // 在 Console 中运行
   // 注意：需要在 React DevTools 中选中 TimeCalendar 组件后才能访问
   // 或者在组件代码中添加 console.log
   ```

4. **强制刷新 TUI Calendar**:
   ```javascript
   // 在 Console 中运行
   localStorage.removeItem('remarkable-calendar-settings');
   localStorage.removeItem('remarkable-calendar-current-date');
   location.reload();
   ```

5. **检查 ToastUIReactCalendar 组件**:
   - 打开 React DevTools
   - 找到 `ToastUIReactCalendar` 组件
   - 检查 `events` prop 是否有值
   - 检查 `calendars` prop 是否正确

---

## 🔧 代码修复建议

基于代码分析，发现以下潜在问题：

### 修复 1: 确保组件挂载时加载事件

**文件**: `src/features/Calendar/TimeCalendar.tsx`  
**位置**: L576-582

**当前代码**:
```typescript
// 初始加载 - 从缓存加载，确保离线可用（只加载一次）
if (!eventsLoadedRef.current) {
  console.log('📦 [INIT] Initial loading events from cache');
  loadEvents();
  loadHierarchicalTags();
  eventsLoadedRef.current = true;
}
```

**问题**: 如果 `eventsLoadedRef.current` 被意外设置为 `true`，初始化加载会被跳过

**建议**: 移除条件检查，确保每次挂载都加载

```typescript
// 🔧 修复：确保每次挂载都加载事件
console.log('🚀 [INIT] Loading initial data on mount...');
loadEvents();
loadHierarchicalTags();
```

---

### 修复 2: 统一筛选器清理逻辑

**文件**: `src/features/Calendar/TimeCalendar.tsx`  
**位置**: L391-420 `validateAndCleanSettings()`

**问题**: 标签筛选器有"太少自动清空"逻辑，日历筛选器没有

**当前代码**:
```typescript
// ✅ 标签筛选器有这个逻辑
if (validVisibleTags.length > 0 && validVisibleTags.length < 2) {
  console.log('✅ [TimeCalendar] Too few valid tags after cleanup, clearing tag filter');
  validVisibleTags = [];
}

// ❌ 日历筛选器缺少类似逻辑
```

**建议**: 为日历筛选器添加相同逻辑

```typescript
// 🔧 添加：日历筛选器清理逻辑
if (validVisibleCalendars.length > 0 && validVisibleCalendars.length < 2) {
  console.log('✅ [TimeCalendar] Too few valid calendars after cleanup, clearing calendar filter');
  validVisibleCalendars = [];
}
```

---

### 修复 3: 添加去重监控

**文件**: `src/features/Calendar/TimeCalendar.tsx`  
**位置**: L1474-1481

**问题**: 去重逻辑没有日志，无法发现被跳过的事件

**当前代码**:
```typescript
const uniqueByIdMap = new Map<string, any>();
filteredByCalendars.forEach(e => {
  if (e && e.id && !uniqueByIdMap.has(e.id)) {
    uniqueByIdMap.set(e.id, e);
  }
});
const uniqueFiltered = Array.from(uniqueByIdMap.values());
```

**建议**: 添加日志记录

```typescript
const uniqueByIdMap = new Map<string, any>();
const skipped: any[] = [];

filteredByCalendars.forEach(e => {
  if (!e || !e.id) {
    skipped.push(e);
  } else if (!uniqueByIdMap.has(e.id)) {
    uniqueByIdMap.set(e.id, e);
  }
});

const uniqueFiltered = Array.from(uniqueByIdMap.values());

if (skipped.length > 0) {
  console.warn(`⚠️ [DEDUP] Skipped ${skipped.length} events with invalid IDs:`, 
    skipped.map(e => e?.title || '(无标题)'));
}
```

---

## 📋 检查清单

在报告问题之前，请确认：

- [ ] 已运行 `diagnose-timecalendar.js` 诊断脚本
- [ ] 已检查 Console 中是否有错误日志
- [ ] 已检查 localStorage 中是否有 `remarkable-events` 数据
- [ ] 已尝试点击"今天"按钮回到当前日期
- [ ] 已尝试打开设置面板检查筛选器
- [ ] 已尝试刷新页面
- [ ] 已尝试清空筛选器（通过 UI 或 Console）
- [ ] 已检查 Outlook 同步状态

---

## 🔍 深度调试

如果上述步骤都无法解决问题，尝试以下深度调试：

### 1. 启用详细日志

在 `TimeCalendar.tsx` 中，取消注释所有 `console.log` 语句：

**搜索并替换**:
- 查找: `// console.log`
- 替换: `console.log`

刷新页面，收集所有日志。

---

### 2. 检查事件监听器

```javascript
// 在 Console 中运行
window.addEventListener('local-events-changed', (e) => {
  console.log('🔔 [DEBUG] local-events-changed triggered:', e.detail);
});

window.addEventListener('action-sync-completed', (e) => {
  console.log('🔔 [DEBUG] action-sync-completed triggered');
});

window.addEventListener('eventsUpdated', (e) => {
  console.log('🔔 [DEBUG] eventsUpdated triggered:', e.detail);
});

console.log('✅ 已添加事件监听器，触发事件时会显示日志');
```

---

### 3. 手动触发事件加载

```javascript
// 在 Console 中运行
window.dispatchEvent(new CustomEvent('local-events-changed', {
  detail: { action: 'manual-debug' }
}));

console.log('✅ 已手动触发 local-events-changed 事件');
```

---

### 4. 检查 React 组件状态

1. 安装 React DevTools 浏览器扩展
2. 打开 React DevTools
3. 找到 `TimeCalendar` 组件
4. 检查 `events` state 是否有值
5. 检查 `calendarEvents` memoized value 是否有值
6. 检查 `calendarSettings` state 是否正确

---

## 📞 获取帮助

如果问题仍然存在，请提供以下信息：

1. **诊断脚本输出**: 复制 `diagnose-timecalendar.js` 的完整输出
2. **Console 日志**: 复制所有相关的 Console 日志（特别是错误和警告）
3. **localStorage 数据**:
   ```javascript
   // 在 Console 中运行
   console.log({
     events: JSON.parse(localStorage.getItem('remarkable-events')).length,
     settings: localStorage.getItem('remarkable-calendar-settings'),
     currentDate: localStorage.getItem('remarkable-calendar-current-date')
   });
   ```
4. **浏览器信息**: Chrome/Edge/Firefox 版本
5. **操作系统**: Windows/macOS/Linux 版本

---

## 📚 相关文档

- [TIMECALENDAR_ANALYSIS.md](./TIMECALENDAR_ANALYSIS.md) - 完整的代码分析和 PRD 对照
- [PRD/TIMECALENDAR_MODULE_PRD.md](./docs/PRD/TIMECALENDAR_MODULE_PRD.md) - TimeCalendar 模块需求文档
- [diagnose-timecalendar.js](./diagnose-timecalendar.js) - 诊断脚本
