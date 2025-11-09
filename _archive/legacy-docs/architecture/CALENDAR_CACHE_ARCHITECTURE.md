# 日历缓存架构文档

## 概述

日历缓存是事件同步的**关键前置依赖**，用于存储用户的日历列表。如果缓存为空，`getAllCalendarsEvents()` 将返回空数组，导致无法同步任何事件。

## 核心设计原则

### 1. 自动化加载
- **触发时机**：所有身份验证成功的时机点
- **执行方式**：异步非阻塞（`.catch()` 模式）
- **并发控制**：互斥锁防止重复请求

### 2. 存储规范
- **Key**: `STORAGE_KEYS.CALENDARS_CACHE = 'remarkable-calendars-cache'`
- **Value**: JSON数组，包含用户所有日历的元数据
- **更新方法**: `syncCalendarGroupsFromRemote()` → `setCachedCalendars()`

### 3. 防御性检查
- **读取前验证**：`ensureCalendarCacheLoaded()` 确保缓存存在
- **并发保护**：`calendarCacheLoadingPromise` 互斥锁
- **失败降级**：API失败时返回空数组而非阻塞流程

---

## 调用链路（6个节点）

### 🔐 认证恢复路径（4个 - 自动触发）

#### 1. Electron Token 恢复
**位置**: `MicrosoftCalendarService.ts:475`

```typescript
this.acquireToken().then(() => {
  this.ensureCalendarCacheLoaded().catch(error => {
    MSCalendarLogger.error('❌ Failed to load calendar cache:', error);
  });
});
```

**场景**: Electron环境启动时，从localStorage恢复token  
**特点**: 非阻塞，失败不影响主流程  
**频率**: 每次应用启动（token有效时）

---

#### 2. Web Token 恢复
**位置**: `MicrosoftCalendarService.ts:556`

```typescript
this.acquireToken().then(() => {
  this.ensureCalendarCacheLoaded().catch(error => {
    MSCalendarLogger.error('❌ Failed to load calendar cache:', error);
  });
});
```

**场景**: Web环境启动时，从localStorage恢复token  
**特点**: 非阻塞，失败不影响主流程  
**频率**: 每次页面刷新（token有效时）

---

#### 3. acquireTokenSilent 成功
**位置**: `MicrosoftCalendarService.ts:589`

```typescript
this.ensureCalendarCacheLoaded().catch(error => {
  MSCalendarLogger.error('❌ Failed to load calendar cache after silent token acquisition:', error);
});
```

**场景**: 静默token刷新成功  
**特点**: 非阻塞，token续期时自动同步日历列表  
**频率**: token过期前的自动刷新（30分钟左右）

---

#### 4. acquireTokenPopup 成功
**位置**: `MicrosoftCalendarService.ts:617`

```typescript
this.ensureCalendarCacheLoaded().catch(error => {
  MSCalendarLogger.error('❌ Failed to load calendar cache after popup token acquisition:', error);
});
```

**场景**: 弹窗授权成功  
**特点**: 非阻塞，fallback认证方式  
**频率**: 静默刷新失败时触发

---

### 🔄 手动刷新路径（2个 - 用户主动）

#### 5. getAllCalendarData (forceRefresh=true) - 主调用
**位置**: `MicrosoftCalendarService.ts:489`

```typescript
// 如果有缓存，直接返回（即使forceRefresh=true）
if (cachedGroups.length > 0 || cachedCalendars.length > 0) {
  MSCalendarLogger.log('📋 [Cache] Using cached calendar data');
  
  // 🔄 后台检查日历列表是否有变化（24小时检查一次）
  if (forceRefresh) {
    this.checkCalendarListChanges().catch(error => {
      MSCalendarLogger.error('❌ Background check failed:', error);
    });
  }
  
  return { groups: cachedGroups, calendars: cachedCalendars };
}
```

**场景**: UI中"立即同步"按钮点击  
**特点**: 
- **✅ 不再强制刷新日历列表**（避免低频数据的高频请求）
- **✅ 后台增量检查**：24小时检查一次日历数量变化
- **✅ 轻量级API**：只请求 `$select=id` 对比数量
**频率**: 用户手动操作，较频繁

**优化说明**:
> 日历列表的更新频率极低（用户很少新建/删除日历），每次"立即同步"都刷新会造成：
> 1. API配额浪费
> 2. 用户等待时间增加
> 3. 不必要的网络请求
>
> 新策略：
> - 缓存存在 → 直接返回，后台24小时检查一次
> - 缓存为空 → 立即同步（防御性措施）

---

#### 6. getAllCalendarData (缓存为空) - Fallback
**位置**: `MicrosoftCalendarService.ts:504`

```typescript
// 缓存为空，必须从远程同步
MSCalendarLogger.log('📋 [Cache] No cached data found, syncing from remote...');
return await this.syncCalendarGroupsFromRemote();
```

**场景**: 缓存异常清空时的自动修复  
**特点**: 防御性编程，理论上不应触发（有 `ensureCalendarCacheLoaded` 保护）  
**频率**: 极少（异常情况）

---

### ❌ 已移除：冗余路径

#### ~~7. signInWithPopup 成功~~
**原位置**: `MicrosoftCalendarService.ts:867` (已删除)

```typescript
// ❌ 冗余！因为 acquireToken() 已经调用 ensureCalendarCacheLoaded()
await this.syncCalendarGroupsFromRemote();
```

**问题**: 
- `signInWithPopup()` 内部调用 `acquireToken()`
- `acquireToken()` 成功后触发 `ensureCalendarCacheLoaded()`
- 该路径会导致**同一登录流程中调用2次API**

**优化**: 
- 移除直接调用，依赖 `acquireToken()` 中的自动触发
- 减少API请求，提升用户体验

---

## 增量同步机制

### 设计原则

日历列表的变化频率极低（用户很少新建/删除日历），但事件数据变化频繁。因此需要区分对待：

- **日历列表**: 低频更新 → 24小时增量检查
- **事件数据**: 高频更新 → 实时/手动同步

### 检查策略

**触发时机**:
1. `ensureCalendarCacheLoaded()` - 缓存存在时自动检查
2. `getAllCalendarData(forceRefresh=true)` - 用户点击"立即同步"时后台检查

**检查逻辑**:
```typescript
private async checkCalendarListChanges(): Promise<void> {
  // 1. 检查上次检查时间（24小时内跳过）
  const meta = this.getSyncMeta();
  const lastCheck = meta?.lastCalendarListSyncTime;
  if (lastCheck && hoursSince(lastCheck) < 24) return;
  
  // 2. 轻量级API请求（仅获取ID）
  const response = await fetch('...?$select=id&$top=999');
  const remoteCount = response.value.length;
  
  // 3. 对比数量
  const cachedCount = meta?.calendarsCount;
  
  // 4. 数量变化 → 触发完整同步
  if (remoteCount !== cachedCount) {
    await this.syncCalendarGroupsFromRemote();
  }
  
  // 5. 更新检查时间
  meta.lastCalendarListSyncTime = now;
}
```

### 性能优化

**轻量级请求**:
```
https://graph.microsoft.com/v1.0/me/calendars?$select=id&$top=999
```
- 只返回 `id` 字段（减少数据传输）
- 最多999个日历（远超实际需求）
- 响应体积 < 50KB（完整请求 > 500KB）

**非阻塞执行**:
```typescript
// ✅ 后台检查，不阻塞主流程
this.checkCalendarListChanges().catch(error => {
  MSCalendarLogger.error('❌ Background check failed:', error);
});
```

### 存储结构

```typescript
interface CalendarSyncMeta {
  lastSyncTime: string;              // 事件数据最后同步时间
  lastCalendarListSyncTime: string;  // 🆕 日历列表最后检查时间
  calendarGroupsCount: number;       // 缓存的日历分组数量
  calendarsCount: number;            // 缓存的日历数量（用于增量对比）
  isOfflineMode: boolean;
}
```

### 数据流对比

**优化前**（每次立即同步都刷新日历列表）:
```
用户点击"立即同步" 
  → getAllCalendarData(forceRefresh=true)
    → syncCalendarGroupsFromRemote() ❌ 每次都请求完整日历列表
      → fetchAllCalendars() 
      → 同步事件
```

**优化后**（24小时增量检查）:
```
用户点击"立即同步"
  → getAllCalendarData(forceRefresh=true)
    → 返回缓存 ✅ 立即返回，不阻塞
    → checkCalendarListChanges() (后台) 
      → 24小时内？ → 跳过 ✅
      → 24小时外？ → 轻量级检查
        → 数量变化？ → 完整同步 ✅
        → 数量不变？ → 跳过 ✅
    → 同步事件
```

---

## 互斥锁机制

### 实现原理

```typescript
private calendarCacheLoadingPromise: Promise<void> | null = null;

private async ensureCalendarCacheLoaded(): Promise<void> {
  // 🔒 检查是否正在加载
  if (this.calendarCacheLoadingPromise) {
    MSCalendarLogger.log('⏳ Calendar cache loading in progress, waiting...');
    return this.calendarCacheLoadingPromise; // 返回现有Promise
  }
  
  const cached = localStorage.getItem(STORAGE_KEYS.CALENDARS_CACHE);
  if (!cached || JSON.parse(cached).length === 0) {
    // 🔒 设置加载锁
    this.calendarCacheLoadingPromise = this.syncCalendarGroupsFromRemote()
      .finally(() => {
        // 🔓 完成后释放锁
        this.calendarCacheLoadingPromise = null;
      });
    
    await this.calendarCacheLoadingPromise;
  }
}
```

### 保护场景

**场景1: 多组件并发初始化**
```
Component A → ensureCalendarCacheLoaded() → API Request 1
Component B → ensureCalendarCacheLoaded() → ⏳ Wait for Request 1
Component C → ensureCalendarCacheLoaded() → ⏳ Wait for Request 1
```

**场景2: Token恢复 + 手动同步**
```
App Start → acquireToken() → ensureCalendarCacheLoaded() → API Request
User Click → forceSync() → ensureCalendarCacheLoaded() → ⏳ Wait
```

### 锁释放策略

- **成功**: `syncCalendarGroupsFromRemote()` 完成 → `finally()` 清空锁
- **失败**: 异常抛出 → `finally()` 清空锁（不阻止后续重试）
- **超时**: Graph API 自带30秒超时 → 自动触发 `finally()`

---

## 数据流图

```
┌─────────────────────────────────────────────────────┐
│                   用户登录/启动                      │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│        acquireToken() / acquireTokenSilent()        │
│           (4个认证恢复路径都会触发)                  │
└────────────┬────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────┐
│          ensureCalendarCacheLoaded()                │
│        🔒 检查互斥锁 + 缓存状态                      │
└────────────┬────────────────────────────────────────┘
             │
             ▼
         缓存存在？
         │         │
      是 │         │ 否
         │         │
         │         ▼
         │  ┌─────────────────────────────────┐
         │  │ syncCalendarGroupsFromRemote()  │
         │  │   (调用 Microsoft Graph API)    │
         │  └─────────────┬───────────────────┘
         │                │
         │                ▼
         │  ┌─────────────────────────────────┐
         │  │    setCachedCalendars()         │
         │  │ 保存到 localStorage              │
         │  └─────────────┬───────────────────┘
         │                │
         └────────────────┤
                          │
                          ▼
┌─────────────────────────────────────────────────────┐
│          getAllCalendarsEvents()                    │
│      读取缓存 → 批量获取日历事件                      │
└─────────────────────────────────────────────────────┘
```

---

## 异步非阻塞策略

### 为什么使用 `.catch()` 而非 `await`?

**认证恢复路径（1-4）** 使用 `.catch()` 的原因:

```typescript
// ✅ 非阻塞模式
this.ensureCalendarCacheLoaded().catch(error => {
  MSCalendarLogger.error('❌ Failed to load calendar cache:', error);
});
```

**优点:**
1. **不阻塞用户登录流程**: 即使日历列表同步失败，用户也能看到界面
2. **提升启动速度**: Token恢复立即完成，日历缓存后台加载
3. **容错性强**: API失败不会导致应用卡死

**手动刷新路径（5-6）** 使用 `await` 的原因:

```typescript
// ✅ 阻塞模式
if (forceRefresh) {
  await this.syncCalendarGroupsFromRemote();
}
```

**优点:**
1. **用户预期**: 点击"刷新"按钮，希望看到加载指示器
2. **数据一致性**: 确保刷新完成后再显示最新数据
3. **错误反馈**: 失败时可显示错误提示

---

## 常见问题 (FAQ)

### Q1: 为什么不在 `signInWithPopup()` 中直接调用同步？

**A**: 因为 `signInWithPopup()` 内部调用 `acquireToken()`，后者已经触发 `ensureCalendarCacheLoaded()`。重复调用会：
- 增加API请求次数（浪费配额）
- 延长用户登录等待时间
- 增加并发冲突风险

### Q2: 互斥锁会导致死锁吗？

**A**: 不会。`finally()` 确保无论成功/失败/超时都会释放锁。Graph API有30秒超时保护。

### Q3: 如果缓存加载失败，事件同步会崩溃吗？

**A**: 不会。`getAllCalendarsEvents()` 检查缓存为空时返回 `[]`，日志记录错误但不中断流程。

### Q4: 为什么认证恢复路径不 `await`？

**A**: 提升用户体验。Token恢复后立即显示界面，日历缓存后台加载。失败也不影响主流程。

### Q5: 如何判断日历缓存是否加载中？

**A**: 检查 `calendarCacheLoadingPromise !== null`。诊断脚本 `diagnose-sync.js` 提供完整检查工具。

---

## 调试工具

### 诊断脚本
路径: `cleanup-untitled-events.js` → `diagnose-sync.js`

**核心功能**:
```javascript
// 1. 检查日历缓存状态
diagnoseSyncStatus();

// 2. 修复空缓存
fixCalendarCache();

// 3. 测试完整同步流程
testSync();

// 4. 实时监控同步过程
watchSync();
```

### 日志标记
所有日志使用 `MSCalendarLogger` 统一管理:

- `🔒` - 互斥锁操作
- `⏳` - 等待中状态
- `📅` - 日历缓存操作
- `✅` - 成功完成
- `❌` - 错误失败
- `🔄` - 同步操作

---

## 维护指南

### 新增认证路径时

1. **必须调用** `ensureCalendarCacheLoaded()`
2. **使用** `.catch()` 异步模式（除非用户主动触发）
3. **记录日志** 使用统一的emoji标记
4. **更新本文档** 添加新的调用链路节点

### 修改缓存逻辑时

1. **测试所有7个调用路径** 确保无遗漏
2. **验证互斥锁** 模拟并发场景
3. **检查存储Key** 确保使用 `STORAGE_KEYS.CALENDARS_CACHE`
4. **更新诊断脚本** 保持工具与代码同步

### 性能优化时

- **不要移除** `ensureCalendarCacheLoaded()` 调用（关键防御）
- **不要移除** 互斥锁（防止API滥用）
- **可以优化** `syncCalendarGroupsFromRemote()` 的API调用（如缓存过期策略）

---

## 参考文件

- `src/services/MicrosoftCalendarService.ts` - 主服务类
- `src/services/ActionBasedSyncManager.ts` - 事件同步管理器
- `src/constants/index.ts` - STORAGE_KEYS定义
- `diagnose-sync.js` - 诊断工具脚本

---

**最后更新**: 2025-01-XX  
**维护者**: Zoey  
**版本**: 2.0 (优化后架构)
