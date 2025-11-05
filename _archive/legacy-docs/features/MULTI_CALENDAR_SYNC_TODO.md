# 多日历同步功能 - 实施清单 (Multi-Calendar Sync TODO)

> **预计工作量**: 4-7 个工作日  
> **开始日期**: 2025-11-02  
> **完成日期**: 2025-11-08 (最快 4 天)
> 
> **核心难点**: 不是同步逻辑本身（约 1 小时代码修改），而是**远程多日历事件的变化维护**

---

## 总览 (Overview)

本文档将 **多日历同步功能** 的开发拆分为 **3 个核心阶段** + **可选优化**：

### 必须完成 (4-5 天)
1. **Day 1: 数据结构改造** - `externalId` → `externalIds: { [calendarId]: string }`
2. **Day 2: 同步循环改造** - CREATE/UPDATE/DELETE 改为 `for` 循环
3. **Day 3: 远程变更维护逻辑** - 处理远程多日历的修改/删除场景（**核心难点**）
4. **Day 4: 迁移脚本 + 基础测试** - 老数据转换和功能验证

### 可选优化 (1-2 天)
5. **Day 5-6: 并行优化 + UI 改进** - `Promise.all` 批量请求 + 状态徽章

---

## 🎯 核心难点：远程多日历事件的变更维护

**问题本质**: 本地 1 个事件 → 远程 N 个日历，任意远程日历的修改/删除如何反映到本地？

### 场景 1: 远程某个日历修改了事件

**情况描述**:
```
本地: Event { 
  id: 'local-123', 
  title: 'Meeting',
  externalIds: { 'cal-A': 'ext-1', 'cal-B': 'ext-2' } 
}

远程: cal-A 上的事件标题从 "Meeting" 改为 "Important Meeting"
      cal-B 上的事件未变化
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 以最后修改时间为准，更新本地事件（简单直接）
- ⚠️ **选项 B**: 弹窗提示用户选择（cal-A 还是 cal-B 的版本）- 体验差
- ⚠️ **选项 C**: 创建冲突副本，保留两个版本 - 数据膨胀

**实现要点**:
```typescript
// 当前逻辑位置: ActionBasedSyncManager.ts, line 1290-1350
// 现在: 单一 externalId 查找
const existingLocal = this.eventIndexMap.get(pureOutlookId);
const remoteModified = new Date(event.lastModifiedDateTime);

// 改造后: 遍历所有 externalIds，找出最新修改的版本
for (const [calId, extId] of Object.entries(event.externalIds)) {
  const remoteEvent = await fetchEventByExternalId(extId);
  if (remoteEvent.lastModifiedDateTime > localEvent.updatedAt) {
    // 发现更新，以最新的远程版本为准
    this.recordRemoteAction('update', 'event', event.id, remoteEvent);
  }
}
```

**测试用例**:
- [ ] cal-A 修改标题，cal-B 不变 → 本地标题更新
- [ ] cal-A 修改时间，cal-B 修改描述 → 以最新修改时间的版本为准
- [ ] 所有日历都未修改 → 本地不变

---

### 场景 2: 远程某个日历删除了事件

**情况描述**:
```
本地: Event { 
  externalIds: { 'cal-A': 'ext-1', 'cal-B': 'ext-2', 'cal-C': 'ext-3' } 
}

远程: cal-B 上的事件被删除了
      cal-A 和 cal-C 还存在
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 从 `externalIds` 中移除 `cal-B`，保留本地事件（灵活性）
- ⚠️ **选项 B**: 如果所有日历都删除了，才删除本地事件 - 逻辑复杂
- ⚠️ **选项 C**: 提示用户是否要同时删除其他日历 - 用户负担重

**实现要点**:
```typescript
// 当前逻辑位置: ActionBasedSyncManager.ts, line 1440-1480
// 现在: 单一 externalId 检查
if (!remoteEventIds.has(cleanExternalId)) {
  // 远程找不到，标记删除候选
}

// 改造后: 检查每个日历
const stillExistingCalendars = Object.entries(event.externalIds)
  .filter(([calId, extId]) => remoteEventIds.has(extId));

if (stillExistingCalendars.length === 0) {
  // 所有日历都删除了，删除本地事件
  this.recordRemoteAction('delete', 'event', event.id);
} else if (stillExistingCalendars.length < Object.keys(event.externalIds).length) {
  // 部分日历删除了，更新 externalIds（移除已删除的）
  event.externalIds = Object.fromEntries(stillExistingCalendars);
  this.recordRemoteAction('update', 'event', event.id, { externalIds: event.externalIds });
  
  console.log(`📝 [Multi-Calendar] Removed deleted calendar from event`, {
    eventId: event.id,
    remainingCalendars: Object.keys(event.externalIds)
  });
}
```

**测试用例**:
- [ ] 3 个日历中删除 1 个 → 本地事件保留，externalIds 只剩 2 个
- [ ] 3 个日历中删除 2 个 → 本地事件保留，externalIds 只剩 1 个
- [ ] 所有日历都删除 → 本地事件删除（见场景 3）

---

### 场景 3: 远程所有日历都删除了事件

**情况描述**:
```
本地: Event { 
  externalIds: { 'cal-A': 'ext-1', 'cal-B': 'ext-2' } 
}

远程: cal-A 和 cal-B 都删除了这个事件
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 删除本地事件（完全同步，用户预期）
- ⚠️ **选项 B**: 保留本地事件但标记为 `local-only` - 造成数据不一致
- ⚠️ **选项 C**: 移动到"已删除"文件夹，保留 30 天 - 增加复杂度

**实现要点**:
```typescript
// 接续场景 2 的代码
if (stillExistingCalendars.length === 0) {
  // 所有日历都删除了，删除本地事件
  this.recordRemoteAction('delete', 'event', event.id);
  
  console.log(`🗑️ [Multi-Calendar] All calendars deleted, removing local event`, {
    eventId: event.id,
    title: event.title
  });
}
```

**测试用例**:
- [ ] 所有日历删除 → 本地事件删除
- [ ] 删除检测的两轮确认机制仍然生效（防误删）

---

### 场景 4: 远程不同日历的修改时间不一致

**情况描述**:
```
本地: Event { 
  updatedAt: '2025-11-01 10:00',
  externalIds: { 'cal-A': 'ext-1', 'cal-B': 'ext-2' } 
}

远程: 
  - cal-A: lastModifiedDateTime = '2025-11-01 10:30', 标题 = "Meeting v2"
  - cal-B: lastModifiedDateTime = '2025-11-01 10:20', 标题 = "Meeting v1"
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 以最新的修改时间为准（cal-A 的版本）- 符合直觉
- ⚠️ **选项 B**: 保留本地版本，添加同步冲突标记 - 用户困惑
- ⚠️ **选项 C**: 检测到冲突时停止同步，等待用户手动处理 - 打断流程

**实现要点**:
```typescript
// 找出所有日历中最新修改的版本
const remoteVersions = await Promise.all(
  Object.entries(event.externalIds).map(async ([calId, extId]) => {
    try {
      return await this.microsoftService.getEventById(extId);
    } catch (error) {
      console.warn(`⚠️ Failed to fetch event from ${calId}:`, error);
      return null;
    }
  })
);

// 过滤掉获取失败的日历
const validVersions = remoteVersions.filter(v => v !== null);

if (validVersions.length === 0) {
  console.warn(`⚠️ No valid remote versions found for event ${event.id}`);
  return;
}

// 找出最新的版本
const latestVersion = validVersions.reduce((latest, current) => {
  const latestTime = new Date(latest.lastModifiedDateTime).getTime();
  const currentTime = new Date(current.lastModifiedDateTime).getTime();
  return currentTime > latestTime ? current : latest;
});

// 以最新版本更新本地
this.recordRemoteAction('update', 'event', event.id, latestVersion);

console.log(`🔄 [Multi-Calendar] Using latest version from remote`, {
  eventId: event.id,
  latestTime: latestVersion.lastModifiedDateTime,
  title: latestVersion.subject
});
```

**测试用例**:
- [ ] cal-A 修改时间较新 → 以 cal-A 的数据为准
- [ ] cal-B 修改时间较新 → 以 cal-B 的数据为准
- [ ] 某个日历获取失败 → 使用其他日历的数据

---

### 场景 5: 本地删除事件后，远程还有残留

**情况描述**:
```
本地: 用户在 ReMarkable 中删除了 Event

远程: cal-A 和 cal-B 上的事件还存在
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 删除所有日历上的远程事件（当前实现）
- ⚠️ **选项 B**: 只删除用户选择的日历 - 需要额外的 UI 交互

**实现要点**:
```typescript
// 当前逻辑位置: ActionBasedSyncManager.ts, line 2450
// 现在: 单一 externalId 删除
await this.microsoftService.deleteEvent(cleanExternalId);

// 改造后: 批量删除所有日历
const deleteResults = await Promise.allSettled(
  Object.entries(event.externalIds).map(async ([calId, extId]) => {
    try {
      await this.microsoftService.deleteEvent(extId);
      console.log(`🗑️ [Multi-Calendar] Deleted from ${calId}`);
      return { calId, success: true };
    } catch (error) {
      console.error(`❌ [Multi-Calendar] Failed to delete from ${calId}:`, error);
      return { calId, success: false, error };
    }
  })
);

// 统计删除结果
const successCount = deleteResults.filter(r => r.status === 'fulfilled' && r.value.success).length;
const failCount = deleteResults.length - successCount;

if (failCount > 0) {
  console.warn(`⚠️ [Multi-Calendar] ${failCount} calendars failed to delete`);
  // 可选: 重试失败的日历
}
```

**测试用例**:
- [ ] 删除所有日历上的事件成功
- [ ] 某个日历删除失败（网络错误）→ 记录错误，继续删除其他日历
- [ ] 事件已经在某个日历上被删除 → 忽略 404 错误

---

### 场景 6: 远程新增的日历出现了重复事件

**情况描述**:
```
本地: Event { 
  id: 'local-123', 
  externalIds: { 'cal-A': 'ext-1' } 
}

远程: 用户在 Outlook 中把 cal-A 的事件复制到了 cal-B
      cal-B 现在有一个新事件 'ext-2'，但内容与 'ext-1' 完全相同
```

**处理策略** (推荐 **选项 A**):
- ✅ **选项 A**: 自动识别为同一事件，合并到 `externalIds`（用户友好）
- ⚠️ **选项 B**: 创建新的本地事件（认为是用户有意复制）- 数据重复
- ⚠️ **选项 C**: 提示用户是否合并 - 频繁打扰

**实现要点**:
```typescript
// 当前逻辑位置: ActionBasedSyncManager.ts, line 1280 (创建新事件)
// 改造后: 在创建前检查是否是重复事件

// 检测潜在的重复事件（标题、时间、描述相同）
const isDuplicate = (event1: any, event2: any): boolean => {
  const titleMatch = event1.subject === event2.title;
  const startMatch = Math.abs(
    new Date(event1.start.dateTime).getTime() - new Date(event2.startTime).getTime()
  ) < 60000; // 1分钟内
  const descriptionMatch = 
    this.extractCoreContent(event1.body?.content || '') === 
    this.extractCoreContent(event2.description || '');
  
  return titleMatch && startMatch && descriptionMatch;
};

// 在创建新事件前，检查是否与现有事件重复
const potentialDuplicate = localEvents.find((local: any) => 
  isDuplicate(remoteEvent, local)
);

if (potentialDuplicate) {
  // 合并而不是创建新事件
  console.log(`🔗 [Multi-Calendar] Detected duplicate, merging`, {
    localId: potentialDuplicate.id,
    remoteId: remoteEvent.id,
    calendarId: calendarId
  });
  
  // 添加到现有事件的 externalIds
  potentialDuplicate.externalIds[calendarId] = remoteEvent.id.replace('outlook-', '');
  this.recordRemoteAction('update', 'event', potentialDuplicate.id, {
    externalIds: potentialDuplicate.externalIds
  });
  
  return; // 不创建新事件
}

// 没有重复，正常创建新事件
this.recordRemoteAction('create', 'event', remoteEvent.id, remoteEvent);
```

**测试用例**:
- [ ] 远程新增重复事件 → 自动合并到现有事件的 externalIds
- [ ] 远程新增不同事件 → 正常创建新的本地事件
- [ ] 时间差在 1 分钟内 → 认为是同一事件

---

## 决策总结

基于 ReMarkable 的使用场景（个人时间管理工具），推荐以下策略：

| 场景 | 策略 | 理由 |
|------|------|------|
| 1. 远程某日历修改 | **以最新时间为准** | 简单直接，符合用户预期 |
| 2. 远程某日历删除 | **从 externalIds 移除** | 保留其他日历，灵活性高 |
| 3. 远程全部删除 | **删除本地事件** | 完全同步，避免数据不一致 |
| 4. 修改时间不一致 | **以最新修改为准** | 避免回滚，符合直觉 |
| 5. 本地删除事件 | **删除所有远程** | 当前实现，简单有效 |
| 6. 远程重复事件 | **自动合并** | 用户友好，减少数据重复 |

---

## Day 1: 数据结构改造

### 任务清单

#### 1.1 修改 Event 类型定义
- [ ] **文件**: `src/types.ts` (约 line 35)
- [ ] **改动**:
  ```typescript
  // 旧版本
  externalId?: string;
  
  // 新版本
  externalIds?: { [calendarId: string]: string };  // { 'cal-A': 'ext-1', 'cal-B': 'ext-2' }
  
  // 🔧 向后兼容字段（迁移期间保留）
  externalId?: string;  // @deprecated 使用 externalIds 替代
  ```
- [ ] **验证**: TypeScript 编译无错误

#### 1.2 更新 eventIndexMap 索引逻辑
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 2960-3010)
- [ ] **改动**:
  ```typescript
  // 现在: 单一 externalId 索引
  if (event.externalId) {
    this.eventIndexMap.set(event.externalId, event);
  }
  
  // 改造后: 多个 externalIds 索引
  if (event.externalIds) {
    Object.values(event.externalIds).forEach(extId => {
      this.eventIndexMap.set(extId, event);
    });
  }
  
  // 🔧 向后兼容
  if (event.externalId && !event.externalIds) {
    this.eventIndexMap.set(event.externalId, event);
  }
  ```

#### 1.3 更新 updateLocalEventExternalId 方法
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 3130)
- [ ] **重命名**: `updateLocalEventExternalId` → `updateLocalEventExternalIds`
- [ ] **改动**:
  ```typescript
  // 新签名
  private updateLocalEventExternalIds(
    localEventId: string, 
    externalIds: { [calendarId: string]: string },
    description?: string
  ) {
    // 实现略
  }
  ```

**验收标准**:
- [ ] TypeScript 编译通过
- [ ] 老数据（externalId）仍能被索引查找到
- [ ] 新数据（externalIds）可以正确存储和检索

**预计耗时**: 2-3 小时

---

## Day 2: 同步循环改造

### 任务清单

#### 2.1 改造 CREATE 操作
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 1770-1890)
- [ ] **改动**:
  ```typescript
  // 现在: 单次创建
  const newEvent = await this.microsoftService.createEvent(eventData, syncTargetCalendarId);
  this.updateLocalEventExternalId(action.entityId, newEvent.id);
  
  // 改造后: 循环创建
  const calendarIds = action.data.calendarIds || [action.data.calendarId];
  const externalIds: { [calendarId: string]: string } = {};
  
  for (const calId of calendarIds) {
    try {
      const newEvent = await this.microsoftService.createEvent(eventData, calId);
      externalIds[calId] = newEvent.id;
      console.log(`✅ [Multi-Calendar] Created in ${calId}`);
    } catch (error) {
      console.error(`❌ [Multi-Calendar] Failed to create in ${calId}:`, error);
      // 记录失败，但继续处理其他日历
    }
  }
  
  // 更新本地事件，存储所有 externalIds
  this.updateLocalEventExternalIds(action.entityId, externalIds);
  ```
- [ ] **测试用例**:
  - [ ] 单个日历创建成功
  - [ ] 多个日历创建成功
  - [ ] 某个日历创建失败，其他日历继续

#### 2.2 改造 UPDATE 操作
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 1900-2430)
- [ ] **改动**:
  ```typescript
  // 现在: 单次更新
  await this.microsoftService.updateEvent(cleanExternalId, updatePayload);
  
  // 改造后: 循环更新
  const updateResults = [];
  for (const [calId, extId] of Object.entries(event.externalIds)) {
    try {
      await this.microsoftService.updateEvent(extId, updatePayload);
      updateResults.push({ calId, success: true });
      console.log(`✅ [Multi-Calendar] Updated in ${calId}`);
    } catch (error) {
      console.error(`❌ [Multi-Calendar] Failed to update in ${calId}:`, error);
      updateResults.push({ calId, success: false, error });
    }
  }
  
  // 统计结果
  const successCount = updateResults.filter(r => r.success).length;
  const failCount = updateResults.length - successCount;
  
  if (failCount > 0) {
    console.warn(`⚠️ [Multi-Calendar] ${failCount}/${updateResults.length} updates failed`);
  }
  ```
- [ ] **测试用例**:
  - [ ] 所有日历更新成功
  - [ ] 某个日历更新失败（网络错误）
  - [ ] 事件在某个日历上已被删除（404 错误）

#### 2.3 改造 DELETE 操作
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 2450-2550)
- [ ] **改动**:
  ```typescript
  // 现在: 单次删除
  await this.microsoftService.deleteEvent(cleanExternalId);
  
  // 改造后: 批量删除
  const deleteResults = await Promise.allSettled(
    Object.entries(event.externalIds).map(async ([calId, extId]) => {
      try {
        await this.microsoftService.deleteEvent(extId);
        return { calId, success: true };
      } catch (error) {
        // 404 错误正常（已被删除），其他错误需要记录
        if (error.message.includes('404')) {
          return { calId, success: true, note: 'already deleted' };
        }
        throw error;
      }
    })
  );
  ```
- [ ] **测试用例**:
  - [ ] 所有日历删除成功
  - [ ] 事件在某个日历上已被删除（404）
  - [ ] 某个日历删除失败（网络错误）

**验收标准**:
- [ ] CREATE/UPDATE/DELETE 都支持多日历
- [ ] 部分失败不影响整体流程
- [ ] 错误日志清晰，便于调试

**预计耗时**: 2-3 小时

---

## Day 3: 远程变更维护逻辑

### 任务清单

#### 3.1 实现场景 1: 远程修改检测
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 1290-1350)
- [ ] **改动**: 遍历所有 externalIds，找出最新修改的版本
- [ ] **测试用例**: 
  - [ ] cal-A 修改，cal-B 不变
  - [ ] cal-A 和 cal-B 都修改，时间不同

#### 3.2 实现场景 2 & 3: 远程删除检测
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts` (line 1440-1480)
- [ ] **改动**: 
  ```typescript
  // 检查每个 externalId 是否还在远程
  const stillExistingCalendars = Object.entries(event.externalIds)
    .filter(([calId, extId]) => remoteEventIds.has(extId));
  
  if (stillExistingCalendars.length === 0) {
    // 所有日历都删除了
    this.recordRemoteAction('delete', 'event', event.id);
  } else if (stillExistingCalendars.length < Object.keys(event.externalIds).length) {
    // 部分日历删除了
    event.externalIds = Object.fromEntries(stillExistingCalendars);
    this.recordRemoteAction('update', 'event', event.id, { externalIds: event.externalIds });
  }
  ```
- [ ] **测试用例**:
  - [ ] 3 个日历删除 1 个
  - [ ] 3 个日历删除 2 个
  - [ ] 所有日历都删除

#### 3.3 实现场景 4: 时间冲突处理
- [ ] **改动**: 获取所有远程版本，以最新的为准
- [ ] **测试用例**: 不同日历的修改时间不一致

#### 3.4 实现场景 6: 重复事件检测
- [ ] **改动**: 在创建前检查 `isDuplicate()`
- [ ] **测试用例**: 远程复制事件到另一个日历

**验收标准**:
- [ ] 所有 6 个场景都有对应的处理逻辑
- [ ] 单元测试覆盖率 > 80%
- [ ] 手动测试所有场景通过

**预计耗时**: 4-6 小时（核心难点）

---

## Day 4: 迁移脚本 + 基础测试

### 任务清单

#### 4.1 编写迁移脚本
- [ ] **文件**: `src/services/ActionBasedSyncManager.ts`
- [ ] **新增方法**:
  ```typescript
  private migrateExternalIdToExternalIds() {
    const events = this.getLocalEvents();
    let migratedCount = 0;
    
    events.forEach((event: any) => {
      if (event.externalId && !event.externalIds) {
        // 老数据：externalId → externalIds
        const calendarId = event.calendarId || 'default';
        event.externalIds = { [calendarId]: event.externalId };
        
        // 保留 externalId 字段（向后兼容）
        // delete event.externalId;  // 可选：完全删除
        
        migratedCount++;
      }
    });
    
    if (migratedCount > 0) {
      this.saveLocalEvents(events, true);
      console.log(`✅ [Migration] Migrated ${migratedCount} events`);
    }
  }
  ```
- [ ] **触发时机**: 在 `ActionBasedSyncManager` 初始化时自动执行

#### 4.2 基础功能测试
- [ ] 创建事件到 1 个日历
- [ ] 创建事件到 3 个日历
- [ ] 更新多日历事件
- [ ] 删除多日历事件
- [ ] 远程删除部分日历
- [ ] 远程删除所有日历

#### 4.3 数据完整性测试
- [ ] 老数据迁移后能正常同步
- [ ] 新数据能正常保存和读取
- [ ] eventIndexMap 能正确索引多 externalIds

**验收标准**:
- [ ] 迁移脚本自动执行且无错误
- [ ] 老数据和新数据混合场景正常工作
- [ ] 核心功能手动测试通过

**预计耗时**: 3-4 小时

---

## Day 5-6: 可选优化 (Optional)

### 5.1 并行请求优化
- [ ] **改动**:
  ```typescript
  // 串行 → 并行
  const results = await Promise.allSettled(
    calendarIds.map(calId => this.microsoftService.createEvent(eventData, calId))
  );
  ```
- [ ] **测试**: 3 个日历同步时间从 3 秒降到 1 秒
- [ ] **预计耗时**: 1-2 小时

### 5.2 UI 状态显示
- [ ] **文件**: `src/components/EventEditModal.tsx`
- [ ] **改动**: 在日历选择器旁边显示同步状态徽章
  ```tsx
  {calendarIds.map(calId => (
    <span key={calId}>
      {calId} 
      {externalIds[calId] ? '✅' : '⏳'}
    </span>
  ))}
  ```
- [ ] **预计耗时**: 2-3 小时

### 5.3 性能测试
- [ ] 100 个事件 × 3 个日历 = 300 次同步
- [ ] 目标: 总时间 < 30 秒
- [ ] **预计耗时**: 1 小时

---

## 风险与缓解

| 风险 | 缓解措施 |
|------|----------|
| API 限流 | 使用 `Promise.allSettled` 控制并发数 |
| 部分日历失败 | 记录错误但继续处理其他日历 |
| 迁移数据丢失 | 保留 `externalId` 字段作为备份 |
| 远程冲突复杂 | 采用最简策略（最新时间优先） |

---

## 总结

**核心工作量**: 4 天（Day 1-4）  
**可选优化**: 1-2 天（Day 5-6）  

**最大难点**: Day 3 的远程变更维护逻辑（6 个场景）  
**最简单**: Day 1-2 的数据结构和循环改造（约 1 小时代码修改）

**建议**: 
- 先完成 Day 1-4，验证核心功能可用
- 再根据实际需求决定是否做 Day 5-6 的优化
