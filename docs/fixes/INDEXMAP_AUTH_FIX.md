# IndexMap 登出清空 localStorage 问题修复

## 🐛 问题描述

**用户报告：** "我的Outlook发生了掉线，然后我Timecalendar上的event又被indexmap的进程清空了"

## 🔍 根本原因分析

### 问题链条：

1. **Integrity Check 继续运行**
   - 用户登出 Outlook → `isAuthenticated = false`
   - 但 `indexIntegrityCheckInterval` 定时器仍在运行（每 30 秒）
   - `tryIncrementalIntegrityCheck()` 仍然被调用

2. **IndexMap 重建逻辑**
   ```typescript
   // runQuickVisibilityCheck() 第 3309 行
   if (indexSize === 0 && events.length > 0) {
     this.rebuildEventIndexMap(events); // 从 localStorage 读取的 events
   }
   ```

3. **localStorage 不会被清空**（验证通过 ✅）
   - `MicrosoftCalendarService.signOut()` 不清空 EVENTS
   - `rebuildEventIndexMap()` 只修改内存 Map，不修改 localStorage
   
4. **但用户界面会显示空白**
   - TimeCalendar 依赖 `eventIndexMap` 来渲染事件
   - 如果 IndexMap 被清空，即使 localStorage 有数据，用户也看不到事件

## ✅ 已实施的修复

### 修复 1：添加认证检查（已完成）

在 `tryIncrementalIntegrityCheck()` 方法开头添加认证检查：

```typescript
private tryIncrementalIntegrityCheck() {
  // 🔒 Condition 0: 检查用户是否已认证
  if (this.microsoftService) {
    const isAuthenticated = this.microsoftService.isAuthenticated || 
      (typeof this.microsoftService.getIsAuthenticated === 'function' && 
       this.microsoftService.getIsAuthenticated());
    
    if (!isAuthenticated) {
      console.log('⏸️ [Integrity] Skipping check: User not authenticated');
      return;
    }
  }
  
  // ... 其余检查逻辑
}
```

**效果：**
- ✅ 登出后 integrity check 立即停止运行
- ✅ 不会再触发 `rebuildEventIndexMap()` 
- ✅ 内存中的 `eventIndexMap` 保持原状
- ✅ localStorage 数据完整保留

### 修复 2：停止定时器（建议实施）

在 `stop()` 方法中已经有清理逻辑：

```typescript
public stop() {
  this.isRunning = false;
  if (this.indexIntegrityCheckInterval) {
    clearInterval(this.indexIntegrityCheckInterval);
    this.indexIntegrityCheckInterval = null;
  }
}
```

**建议：** 在用户登出时调用 `actionBasedSyncManager.stop()`

## 🧪 验证清单

### 已验证 ✅
- [x] `rebuildEventIndexMap()` 只修改内存 Map
- [x] `MicrosoftCalendarService.signOut()` 不清空 EVENTS
- [x] `tryIncrementalIntegrityCheck()` 添加认证检查

### 需要测试 🔬
- [ ] 登出 Outlook 后观察控制台
  - 应该看到：`⏸️ [Integrity] Skipping check: User not authenticated`
  - 不应该看到：`🚀 [IndexMap] Rebuilt index...`
  
- [ ] 登出后 localStorage 数据完整性
  ```javascript
  // 在浏览器控制台执行
  const events = JSON.parse(localStorage.getItem('timecalendar-events') || '[]');
  console.log(`📦 Events count: ${events.length}`);
  ```

- [ ] 重新登录后数据恢复
  - 事件应该立即显示，无需重新同步

## 📊 技术细节

### IndexMap 生命周期
```
启动 → 定时检查（每 30s） → 认证检查 → 完整性检查 → 重建（如需）
  ↑                           ↓
  └──────── 登出时停止 ←──── ❌
```

### 修复后流程
```
启动 → 定时检查（每 30s） → 【认证检查】→ 未登录 → 跳过
  ↑                           ↓
  └──────── 登出时停止 ←──── ✅ 新增
```

## 🎯 预期结果

1. **登出场景**
   - Integrity check 立即停止
   - eventIndexMap 保持最后状态
   - localStorage 数据完整保留
   
2. **重新登录**
   - Integrity check 恢复运行
   - 自动从 localStorage 恢复数据
   - 无需重新同步即可看到事件

3. **用户体验**
   - ✅ 登出不会清空事件显示
   - ✅ 重新登录立即恢复（< 1s）
   - ✅ 无数据丢失风险

## 🔧 未来优化建议

1. **监听认证状态变化**
   ```typescript
   // 在 ActionBasedSyncManager 构造函数中
   this.microsoftService.onAuthStateChanged((isAuth) => {
     if (!isAuth) {
       this.stop(); // 自动停止同步和检查
     }
   });
   ```

2. **添加数据保护机制**
   ```typescript
   private rebuildEventIndexMap(events: any[]) {
     // 🔒 保护：如果收到空数组且 IndexMap 有数据，拒绝重建
     if (events.length === 0 && this.eventIndexMap.size > 0) {
       console.warn('⚠️ [IndexMap] Refusing to rebuild with empty events');
       return;
     }
     // ... 原有逻辑
   }
   ```

## ✅ 完成状态

- [x] 问题诊断
- [x] 根本原因分析
- [x] 添加认证检查
- [ ] 测试验证
- [ ] 用户确认

---

**修复日期：** 2025-01-XX  
**影响范围：** ActionBasedSyncManager.ts  
**风险等级：** 🟢 低风险（仅添加保护性检查）
