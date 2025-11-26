# 日历同步配置功能 - 技术分析与实施方案

> **⚠️ 文档状态**: **已废弃** - 此文档描述的是旧的 `planSyncConfig`/`actualSyncConfig` 双配置架构  
> **废弃日期**: 2025-11-27  
> **替代方案**: 请参考 v2.15 的单一配置架构（calendarIds + syncMode + subEventConfig）  
> **最新文档**: 
> - [EventEditModal V2 PRD v2.0.4](./EVENTEDITMODAL_V2_PRD.md)
> - [EventHub Architecture v2.15](../architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md)
> - [同步配置修复文档](../fixes/EVENTEDITMODAL_V2_SYNC_CONFIG_FIX.md)

---

> **文档版本**: v2.0（基于场景矩阵分析 - 已废弃）  
> **创建时间**: 2025-11-19  
> **更新时间**: 2025-11-19（已废弃：2025-11-27）  
> **负责人**: Zoey & AI Assistant  
> **关联 PRD**: [EVENTEDITMODAL_V2_PRD.md](./EVENTEDITMODAL_V2_PRD.md#24-来源日历--同步机制选择)  
> **⚠️ 必读**: 场景矩阵分析已整合到 [EventEditModal v2 PRD](./EVENTEDITMODAL_V2_PRD.md#242-日历同步场景矩阵概览) - 详细规划了相同日历 9 种场景和 Actual 多日历支持

---

## 📋 目录

1. [功能需求概述](#1-功能需求概述)
2. [现有架构分析](#2-现有架构分析)
3. [数据模型设计](#3-数据模型设计)
4. [影响范围评估](#4-影响范围评估)
5. [实施方案](#5-实施方案)
6. [风险识别与缓解](#6-风险识别与缓解)
7. [测试策略](#7-测试策略)

---

## 1. 功能需求概述

### 1.1 UI 需求（来自 PRD）

**红框 1 - 计划安排区域**：
```
来自 ● Outlook : 默认        📥 只接收同步
```

**红框 2 - 实际进展区域**：
```
同步 ● Outlook : 工作等      🔄 双向同步
```

### 1.2 核心功能

1. **CalendarSourceDisplay** - 日历来源只读显示
   - 显示平台图标（Outlook/Google/iCloud）或 ReMarkable Emoji
   - 显示日历名称（如 "Outlook: 默认"）
   - 显示日历颜色圆点
   - Timer 子事件显示父事件的来源

2. **SyncModeSelector** - 同步模式选择器
   - 3 种模式：
     - 📥 只接收同步（receive-only）- 从外部日历接收，不回写
     - 📤 只发送同步（send-only）- 回写到外部日历，不接收更新
     - 🔄 双向同步（bidirectional）- 双向同步
   - 点击按钮循环切换模式
   - 外部事件的计划安排不可更改（disabled）

3. **两个独立配置**：
   - `planSyncConfig` - 计划安排的同步配置
   - `actualSyncConfig` - 实际进展的同步配置（可选，null 时继承 planSyncConfig）

---

## 2. 现有架构分析

### 2.1 Event 数据模型（src/types.ts）

**已有相关字段**：
```typescript
export interface Event {
  // ========== 同步相关字段（已存在）==========
  source?: 'local' | 'outlook' | 'google' | 'icloud'; // 事件来源
  syncStatus?: SyncStatusType; // 同步状态
  calendarIds?: string[];  // 🆕 多日历分组支持（用于事件同步到 Calendar）
  externalId?: string;     // 外部平台事件 ID
  lastSyncTime?: string;   // 最后同步时间
  
  // ========== 缺失字段 ==========
  // ❌ 没有 planSyncConfig
  // ❌ 没有 actualSyncConfig
  // ❌ 没有 calendarId (单数，指定唯一所属日历)
}
```

**关键发现**：
1. ✅ **已有** `source` 字段 - 标识事件来源平台
2. ✅ **已有** `calendarIds` 字段 - 但是**数组类型**，用于多日历分组
3. ❌ **缺失** `calendarId` (单数) - 用于指定事件所属的唯一日历
4. ❌ **缺失** 同步配置字段（`planSyncConfig`, `actualSyncConfig`）

### 2.2 EventHub/TimeHub 架构

**EventHub 职责**（src/services/EventHub.ts）：
- 管理事件的**所有非时间字段**
- 提供**快照缓存**，避免频繁读取 localStorage
- 支持**增量更新**，只更新变化字段
- 通过 `eventUpdated` 事件通知 UI

**TimeHub 职责**（src/services/TimeHub.ts）：
- 管理事件的**时间字段和时间意图**
- 存储 `TimeSpec`（时间语义）
- 支持 `undefined` 时间字段（Task 类型）

**关键原则**：
- ✅ 所有**非时间字段**的写入都通过 `EventHub.updateEvent()`
- ✅ 所有**时间字段**的写入都通过 `TimeHub.setEventTime()`
- ✅ 所有字段最终通过 `EventService.updateEvent()` 持久化到 localStorage

**结论**：`syncConfig` 属于**非时间字段**，应该由 **EventHub** 管理。

### 2.3 EventService 实现（src/services/EventService.ts）

**核心方法**：
```typescript
// 创建事件
createEvent(event: Partial<Event>): Event

// 更新事件（增量更新）
updateEvent(eventId: string, updates: Partial<Event>): Event

// 删除事件
deleteEvent(eventId: string): void
```

**关键发现**：
- ✅ `updateEvent` 支持 `Partial<Event>`，可以只更新部分字段
- ✅ 更新后会触发 `window.dispatchEvent(new CustomEvent('eventsUpdated'))`
- ✅ EventHub 订阅了 `eventsUpdated` 事件，会自动更新缓存

**结论**：添加 `syncConfig` 字段后，`EventService` 无需修改，自动支持。

### 2.4 同步服务分析

**MicrosoftCalendarService**（src/services/MicrosoftCalendarService.ts）：
- 负责与 Microsoft Graph API 交互
- 提供 `getCachedCalendars()` 方法获取日历列表
- 提供 `syncEventToCalendar()` 方法同步事件到 Outlook

**ActionBasedSyncManager**（src/services/ActionBasedSyncManager.ts）：
- 负责双向同步逻辑
- 处理创建/更新/删除事件的同步
- 处理冲突解决

**关键发现**：
- ✅ 当前同步逻辑是**双向自动同步**
- ❌ **没有**按事件配置同步模式的能力
- ❌ **没有**读取 `syncConfig` 的逻辑

**需要修改**：
- ActionBasedSyncManager 需要在同步前检查 `event.planSyncConfig.mode`
- 根据模式决定是否执行同步操作

---

## 3. 数据模型设计

> **📌 基于**: [场景矩阵分析](./EVENTEDITMODAL_V2_PRD.md#242-日历同步场景矩阵概览) - 严格规划的相同日历 9 种场景 + Actual 多日历支持（已整合到 EventEditModal v2 PRD）

### 3.1 核心数据模型

**设计原则**:
1. ✅ **使用数组** - `plannedCalendarIds` 和 `actualCalendarIds` 都使用数组，保持数据格式一致性
2. ✅ **Actual 支持多日历** - 可同步到多个日历（同平台或跨平台）
3. ✅ **统筹 SyncConfig** - 通过 `MergedSyncConfig` 统一管理，避免重复创建远程事件
4. ✅ **冲突检测** - 自动检测相同日历的 9 种场景并应用对应规则

### 3.2 SyncConfig 接口定义

```typescript
/**
 * 同步配置
 */
export interface SyncConfig {
  /** 同步模式 */
  mode: 'receive-only' | 'send-only' | 'bidirectional';
  
  /** 目标日历 ID 列表（用于实际进展同步到多个日历，可选） */
  targetCalendars?: string[];
  
  /** 最后同步时间 */
  lastSyncTime?: string;
}

/**
 * 同步模式类型
 */
export type SyncMode = 'receive-only' | 'send-only' | 'bidirectional';
```

### 3.2 Event 接口扩展

```typescript
export interface Event {
  // ... 现有字段 ...
  
  // ========== 🆕 新增字段 ==========
  
  /**
   * 所属日历 ID（单数，指定唯一所属日历）
   * 
   * 注意：
   * - 外部同步事件（source = 'outlook'/'google'/'icloud'）：必须指定 calendarId
   * - 本地创建事件（source = 'local'）：可选，默认为 null
   * - Timer 子事件：继承父事件的 calendarId
   */
  calendarId?: string | null;
  
  /**
   * 计划安排同步配置
   * 
   * 默认值：
   * - 外部同步事件：{ mode: 'receive-only' }
   * - 本地创建事件：null（不同步）
   */
  planSyncConfig?: SyncConfig | null;
  
  /**
   * 实际进展同步配置
   * 
   * 默认值：
   * - null（继承 planSyncConfig）
   * - 如果需要不同的同步策略，可以独立设置
   */
  actualSyncConfig?: SyncConfig | null;
}
```

### 3.3 向后兼容策略

**问题**：现有事件没有 `syncConfig` 字段，如何处理？

**方案 1 - 动态计算默认值**（推荐）：
```typescript
/**
 * 获取事件的计划同步配置（含默认值逻辑）
 */
function getPlanSyncConfig(event: Event): SyncConfig | null {
  // 1. 如果显式设置了，直接返回
  if (event.planSyncConfig) {
    return event.planSyncConfig;
  }
  
  // 2. 根据 source 计算默认值
  if (event.source === 'outlook' || event.source === 'google' || event.source === 'icloud') {
    return { mode: 'receive-only' }; // 外部事件默认只接收
  }
  
  // 3. 本地事件默认不同步
  return null;
}

/**
 * 获取事件的实际进展同步配置（含继承逻辑）
 */
function getActualSyncConfig(event: Event): SyncConfig | null {
  // 1. 如果显式设置了，直接返回
  if (event.actualSyncConfig) {
    return event.actualSyncConfig;
  }
  
  // 2. 继承计划同步配置
  return getPlanSyncConfig(event);
}
```

**方案 2 - 数据迁移脚本**（可选，不推荐）：
- 优点：数据完整性好，无需动态计算
- 缺点：增加复杂度，可能导致数据丢失
- 结论：**不推荐**，使用方案 1 更安全

---

## 4. 影响范围评估

### 4.1 数据层修改

| 文件 | 修改内容 | 风险等级 | 影响范围 |
|------|---------|---------|---------|
| **src/types.ts** | 添加 `SyncConfig` 接口 + 扩展 `Event` 接口 | 🟢 低 | 类型定义，无运行时影响 |
| **src/services/EventService.ts** | 无需修改（自动支持新字段） | 🟢 无 | - |
| **src/services/EventHub.ts** | 无需修改（自动支持新字段） | 🟢 无 | - |

### 4.2 服务层修改

| 文件 | 修改内容 | 风险等级 | 影响范围 |
|------|---------|---------|---------|
| **ActionBasedSyncManager.ts** | 同步前检查 `syncConfig.mode`，决定是否执行 | 🟡 中 | 所有 Outlook 同步逻辑 |
| **MicrosoftCalendarService.ts** | 添加 `getCalendarById()` 方法 | 🟢 低 | 仅新增方法，不影响现有逻辑 |

### 4.3 UI 层修改

| 文件 | 修改内容 | 风险等级 | 影响范围 |
|------|---------|---------|---------|
| **新增**: `CalendarSourceDisplay.tsx` | 新组件 | 🟢 无 | 独立组件 |
| **新增**: `SyncModeSelector.tsx` | 新组件 | 🟢 无 | 独立组件 |
| **修改**: `EventEditModalV2Demo.tsx` | 集成两个新组件 | 🟢 低 | 仅影响 EventEditModal |

### 4.4 数据依赖与冲突分析

**潜在冲突点 1**: `calendarIds` (数组) vs `calendarId` (单数)
- **现状**: Event 已有 `calendarIds` 字段（数组类型）
- **新增**: `calendarId` 字段（单数，表示唯一所属日历）
- **冲突**: 两者语义不同，可能导致混淆
- **解决方案**:
  - `calendarId` - 事件所属的主日历（唯一）
  - `calendarIds` - 事件同步到的多个日历（多选，用于实际进展同步）
  - 在代码中明确区分使用场景

**潜在冲突点 2**: `source` vs `planSyncConfig`
- **现状**: `source` 字段标识事件来源（'local' | 'outlook' | 'google' | 'icloud'）
- **新增**: `planSyncConfig.mode` 控制同步行为
- **冲突**: 两者有关联，但不冲突
- **规则**:
  - `source = 'outlook'` 且 `planSyncConfig = null` → 默认为 `{ mode: 'receive-only' }`
  - `source = 'local'` 且 `planSyncConfig = null` → 不同步
  - 用户可以修改 `planSyncConfig`，覆盖默认行为

**潜在冲突点 3**: Timer 子事件的同步配置
- **问题**: Timer 子事件是否需要独立的同步配置？
- **答案**: **否**，Timer 子事件继承父事件的同步配置
- **实现**:
  ```typescript
  function getSyncConfigForEvent(event: Event): SyncConfig | null {
    // Timer 子事件：从父事件读取
    if (event.isTimer && event.parentEventId) {
      const parentEvent = EventService.getEventById(event.parentEventId);
      return parentEvent ? getPlanSyncConfig(parentEvent) : null;
    }
    
    // 普通事件：直接读取
    return getPlanSyncConfig(event);
  }
  ```

---

## 5. 实施方案

### 5.1 Phase 1: 数据模型扩展 ✅ **无风险**

**任务清单**:
1. ✅ 在 `src/types.ts` 添加 `SyncConfig` 接口
2. ✅ 在 `Event` 接口添加 `calendarId`, `planSyncConfig`, `actualSyncConfig` 字段
3. ✅ 添加工具函数 `getPlanSyncConfig()`, `getActualSyncConfig()`

**预期工作量**: 0.5 天

### 5.2 Phase 2: 服务层适配 ⚠️ **中等风险**

**任务清单**:
1. ✅ 在 `MicrosoftCalendarService.ts` 添加 `getCalendarById(calendarId)` 方法
2. ⚠️ 在 `ActionBasedSyncManager.ts` 修改同步逻辑：
   ```typescript
   // 修改点 1: 创建事件同步检查
   async syncNewEventToOutlook(event: Event) {
     const syncConfig = getPlanSyncConfig(event);
     
     // 只接收同步 → 不发送
     if (syncConfig?.mode === 'receive-only') {
       logger.log('[Sync] Skip sync (receive-only mode)');
       return;
     }
     
     // 继续原有同步逻辑...
   }
   
   // 修改点 2: 更新事件同步检查
   async syncEventUpdateToOutlook(event: Event) {
     const syncConfig = getPlanSyncConfig(event);
     
     // 只接收同步 → 不发送
     if (syncConfig?.mode === 'receive-only') {
       logger.log('[Sync] Skip sync (receive-only mode)');
       return;
     }
     
     // 只发送同步 + 双向同步 → 发送
     // 继续原有同步逻辑...
   }
   
   // 修改点 3: 接收事件同步检查
   async syncEventFromOutlook(outlookEvent: GraphEvent) {
     const localEvent = EventService.getEventById(outlookEvent.id);
     const syncConfig = getPlanSyncConfig(localEvent);
     
     // 只发送同步 → 不接收
     if (syncConfig?.mode === 'send-only') {
       logger.log('[Sync] Skip sync (send-only mode)');
       return;
     }
     
     // 只接收同步 + 双向同步 → 接收
     // 继续原有同步逻辑...
   }
   ```

**风险点**:
- ❌ 可能破坏现有同步逻辑
- ❌ 需要详细测试各种场景

**缓解措施**:
- ✅ 添加详细日志（`logger.log`）
- ✅ 添加单元测试
- ✅ 分阶段上线（先禁用，测试后再启用）

**预期工作量**: 2 天

### 5.3 Phase 3: UI 组件开发 ✅ **低风险**

**任务清单**:
1. ✅ 创建 `CalendarSourceDisplay.tsx` 组件（只读显示）
2. ✅ 创建 `SyncModeSelector.tsx` 组件（模式选择器）
3. ✅ 在 `EventEditModalV2Demo.tsx` 集成两个组件
4. ✅ 复用 `CalendarPicker.css` 样式

**预期工作量**: 1.5 天

### 5.4 Phase 4: 测试与文档 ✅ **必须**

**任务清单**:
1. ✅ 单元测试（`syncConfig` 默认值逻辑）
2. ✅ 集成测试（Outlook 同步各种模式）
3. ✅ 更新 PRD 文档（标记已完成）
4. ✅ 更新架构文档（添加 `syncConfig` 说明）

**预期工作量**: 1 天

---

## 6. 风险识别与缓解

### 6.1 高风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **同步逻辑破坏** | 🔴 严重 | 🟡 中 | 1. 详细日志<br>2. 单元测试<br>3. 分阶段上线 |
| **数据丢失** | 🔴 严重 | 🟢 低 | 1. 向后兼容（动态默认值）<br>2. 不执行数据迁移 |

### 6.2 中风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **字段冲突** | 🟡 中等 | 🟡 中 | 明确 `calendarId` vs `calendarIds` 的语义 |
| **Timer 子事件同步** | 🟡 中等 | 🟢 低 | 继承父事件配置，无需独立处理 |

### 6.3 低风险项

| 风险 | 影响 | 概率 | 缓解措施 |
|------|------|------|----------|
| **UI 显示错误** | 🟢 轻微 | 🟢 低 | UI 单元测试 |
| **性能问题** | 🟢 轻微 | 🟢 极低 | 新增字段很少，无性能影响 |

---

## 7. 测试策略

### 7.1 单元测试

**测试文件**: `src/utils/__tests__/syncConfigUtils.test.ts`

```typescript
describe('getPlanSyncConfig', () => {
  it('应该返回显式设置的 syncConfig', () => {
    const event = {
      id: '1',
      source: 'outlook',
      planSyncConfig: { mode: 'bidirectional' }
    };
    expect(getPlanSyncConfig(event)).toEqual({ mode: 'bidirectional' });
  });
  
  it('外部事件默认为 receive-only', () => {
    const event = { id: '1', source: 'outlook' };
    expect(getPlanSyncConfig(event)).toEqual({ mode: 'receive-only' });
  });
  
  it('本地事件默认为 null', () => {
    const event = { id: '1', source: 'local' };
    expect(getPlanSyncConfig(event)).toBeNull();
  });
});

describe('getActualSyncConfig', () => {
  it('应该继承 planSyncConfig', () => {
    const event = {
      id: '1',
      source: 'outlook',
      planSyncConfig: { mode: 'receive-only' }
    };
    expect(getActualSyncConfig(event)).toEqual({ mode: 'receive-only' });
  });
  
  it('应该返回独立设置的 actualSyncConfig', () => {
    const event = {
      id: '1',
      planSyncConfig: { mode: 'receive-only' },
      actualSyncConfig: { mode: 'bidirectional' }
    };
    expect(getActualSyncConfig(event)).toEqual({ mode: 'bidirectional' });
  });
});
```

### 7.2 集成测试

**测试场景**:
1. ✅ **receive-only 模式**: 本地修改不同步到 Outlook
2. ✅ **send-only 模式**: Outlook 修改不同步到本地
3. ✅ **bidirectional 模式**: 双向同步正常工作
4. ✅ **模式切换**: 从 receive-only 切换到 bidirectional 后同步生效

---

## 8. 总结

### 8.1 关键决策

| 决策 | 理由 |
|------|------|
| **动态默认值 vs 数据迁移** | 选择动态默认值，避免数据风险 |
| **独立字段 vs 复用字段** | 新增 `calendarId` (单数)，与 `calendarIds` (数组) 共存 |
| **Timer 子事件配置** | 继承父事件配置，简化逻辑 |
| **同步逻辑修改点** | 在 ActionBasedSyncManager 的 3 个关键位置检查 `syncConfig.mode` |

### 8.2 交付物清单

- [ ] `src/types.ts` - 新增 `SyncConfig` 接口和 Event 字段扩展
- [ ] `src/utils/syncConfigUtils.ts` - 工具函数（`getPlanSyncConfig`, `getActualSyncConfig`）
- [ ] `src/components/common/CalendarSourceDisplay.tsx` - 日历来源显示组件
- [ ] `src/components/common/SyncModeSelector.tsx` - 同步模式选择器组件
- [ ] `src/services/ActionBasedSyncManager.ts` - 同步逻辑适配
- [ ] `src/services/MicrosoftCalendarService.ts` - 添加 `getCalendarById` 方法
- [ ] `src/components/EventEditModalV2Demo.tsx` - 集成新组件
- [ ] `src/utils/__tests__/syncConfigUtils.test.ts` - 单元测试
- [ ] `docs/PRD/EVENTEDITMODAL_V2_PRD.md` - 更新文档（标记已完成）
- [ ] `docs/architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md` - 更新架构文档

### 8.3 预估工作量

| 阶段 | 工作量 | 风险等级 |
|------|--------|----------|
| Phase 1: 数据模型扩展 | 0.5 天 | 🟢 低 |
| Phase 2: 服务层适配 | 2 天 | 🟡 中 |
| Phase 3: UI 组件开发 | 1.5 天 | 🟢 低 |
| Phase 4: 测试与文档 | 1 天 | 🟢 低 |
| **总计** | **5 天** | **🟡 中等** |

---

## 9. 下一步行动

1. ✅ **Review 本文档**，确认技术方案
2. ✅ **开始 Phase 1**：数据模型扩展（最安全，可立即开始）
3. ⏳ **等待 Phase 1 完成**后，进行 Phase 2 的详细代码审查
4. ⏳ **并行开发** Phase 3 UI 组件（与 Phase 2 独立）

---

**文档状态**: ✅ **待审核**  
**下一步**: 等待 Zoey 确认技术方案后开始实施
