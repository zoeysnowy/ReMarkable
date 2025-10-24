# 今日统计实时更新检查清单

## 📋 更新场景检查

### ✅ 场景 1: 用户更改 event 标签
**触发位置**: `src/components/TimeCalendar.tsx` line ~997
```typescript
// 🔔 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: updatedEvent.id,
    isNewEvent,
    tags: updatedEvent.tags
  }
}));
```
**状态**: ✅ 已实现

---

### ✅ 场景 2: 用户开启 Timer
**触发位置**: `src/App.tsx` line ~816
```typescript
// 🔔 触发事件更新通知（让 TimeCalendar 和 DailyStatsCard 刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: timerEventId,
    isTimerEvent: true,
    tags: [globalTimer.tagId]
  }
}));
```
**频率**: 每 5 秒触发一次（实时更新）
**状态**: ✅ 已实现

---

### ✅ 场景 3: 用户停止 Timer
**触发位置**: `src/App.tsx` line ~518
```typescript
// 🔔 触发事件更新通知
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: timerEventId,
    isTimerEvent: true,
    isStopped: true,
    tags: [globalTimer.tagId]
  }
}));
```
**状态**: ✅ 已实现

---

### ✅ 场景 4: 用户新建 Event（有标签）
**触发位置**: `src/components/TimeCalendar.tsx` line ~997
```typescript
// 🔔 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: updatedEvent.id,
    isNewEvent: true,  // ← 新建事件标记
    tags: updatedEvent.tags
  }
}));
```
**状态**: ✅ 已实现

---

### ✅ 场景 5: 用户删除 Event（通过日历）
**触发位置**: `src/components/TimeCalendar.tsx` line ~914 **[本次修复]**
```typescript
// 🔔 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: eventId,
    isDeleted: true,  // ← 删除标记
    tags: eventToDelete.tags
  }
}));
```
**状态**: ✅ 已修复（之前遗漏）

---

### ✅ 场景 6: 用户删除 Event（通过编辑弹窗）
**触发位置**: `src/components/TimeCalendar.tsx` line ~1046 **[本次修复]**
```typescript
// 🔔 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: eventId,
    isDeleted: true,
    tags: eventToDelete.tags
  }
}));
```
**状态**: ✅ 已修复（之前遗漏）

---

### ✅ 场景 7: Timer 编辑（实时保存期间）
**触发位置**: `src/App.tsx` line ~642
```typescript
// 🔔 [FIX] 触发全局事件更新通知（通知DailyStatsCard等组件刷新）
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: updatedEvent.id,
    isNewEvent,
    tags: updatedEvent.tags
  }
}));
```
**状态**: ✅ 已实现（用于Timer运行中编辑标题/emoji）

---

## 🎯 DailyStatsCard 监听器

**位置**: `src/components/DailyStatsCard.tsx` line ~33
```typescript
useEffect(() => {
  const handleStorageChange = () => {
    setRefreshKey(prev => prev + 1); // 触发重新计算
  };

  // 监听自定义事件（从TimeCalendar触发）
  window.addEventListener('eventsUpdated', handleStorageChange);
  
  return () => {
    window.removeEventListener('eventsUpdated', handleStorageChange);
  };
}, []);
```

**机制**:
1. 监听 `eventsUpdated` 事件
2. 更新 `refreshKey`（触发 `useMemo` 重新计算）
3. 重新计算 `tagStats`（按标签统计时长）

---

## 🔧 本次修复内容

### 问题
删除事件时，今日统计不会实时更新，需要手动刷新。

### 根本原因
`TimeCalendar.tsx` 的两个删除函数没有触发 `eventsUpdated` 事件：
- `handleBeforeDeleteEvent` - 直接在日历上删除事件
- `handleDeleteEventFromModal` - 通过编辑弹窗删除事件

### 解决方案
在两个删除函数中添加事件触发：
```typescript
window.dispatchEvent(new CustomEvent('eventsUpdated', {
  detail: { 
    eventId: eventId,
    isDeleted: true,
    tags: eventToDelete.tags
  }
}));
```

---

## ✅ 测试清单

### 测试 1: 编辑标签
1. 打开 Homepage，记录当前统计
2. 编辑一个今日事件，修改标签
3. ✅ 验证：统计立即更新，无需刷新

### 测试 2: 开启 Timer
1. 打开 Homepage，记录当前统计
2. 开启一个 Timer
3. ✅ 验证：统计每 5 秒更新，显示累加时长

### 测试 3: 停止 Timer
1. 停止正在运行的 Timer
2. ✅ 验证：统计立即更新为最终时长

### 测试 4: 新建 Event
1. 打开 Homepage，记录当前统计
2. 创建一个今日事件，设置标签
3. ✅ 验证：统计立即增加新事件时长

### 测试 5: 删除 Event（日历）
1. 打开 Homepage，记录当前统计
2. 在 TimeCalendar 日历视图中删除一个今日事件
3. ✅ 验证：统计立即减少该事件时长

### 测试 6: 删除 Event（弹窗）
1. 打开 Homepage，记录当前统计
2. 点击事件打开编辑弹窗，点击删除按钮
3. ✅ 验证：统计立即减少该事件时长

---

## 🎯 总结

| 场景 | 状态 | 触发位置 |
|------|------|---------|
| 1. 更改事件标签 | ✅ | TimeCalendar.tsx ~997 |
| 2. 开启 Timer | ✅ | App.tsx ~816 (每5秒) |
| 3. 停止 Timer | ✅ | App.tsx ~518 |
| 4. 新建 Event | ✅ | TimeCalendar.tsx ~997 |
| 5. 删除 Event (日历) | ✅ 修复 | TimeCalendar.tsx ~914 |
| 6. 删除 Event (弹窗) | ✅ 修复 | TimeCalendar.tsx ~1046 |
| 7. Timer 编辑 | ✅ | App.tsx ~642 |

**所有场景均已覆盖** ✅

---

## 📝 注意事项

1. **Timer 实时更新**: Timer 运行期间每 5 秒触发一次 `eventsUpdated`，确保统计实时反映累计时长
2. **事件详情**: `eventsUpdated` 携带 `detail` 对象，包含 `eventId`, `isNewEvent`, `isDeleted`, `isTimerEvent`, `tags` 等信息
3. **监听器清理**: DailyStatsCard 在组件卸载时会移除事件监听器（避免内存泄漏）
4. **计算优化**: 使用 `useMemo` + `refreshKey` 机制，只在事件变化时重新计算统计数据

