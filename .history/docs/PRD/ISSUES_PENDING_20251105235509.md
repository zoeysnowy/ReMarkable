# ReMarkable 项目待处理问题统一清单

> **最后更新**: 2025-11-05  
> **来源**: 6个核心模块 PRD + Cross-Check 报告  
> **状态**: 待优先级评审

---

## 📊 问题统计

| 优先级 | 数量 | 来源 | 预计总工时 |
|--------|------|------|------------|
| 🔴 **高** | 4 | EventEditModal, PlanManager, Cross-Check | 6-8 小时 |
| 🟡 **中** | 8 | EventEditModal, PlanManager, Timer | 12-16 小时 |
| 🟢 **低** | 3 | EventEditModal, PlanManager | 2-3 小时 |
| **合计** | **15** | - | **20-27 小时** |

---

## 🔴 高优先级问题（影响功能正确性）

### Issue #1: EventHub.saveEvent() 返回值不明确 🆕

**来源**: CROSS_CHECK_REPORT.md Issue #2

**问题描述**:
- TimeCalendar PRD L1645 中使用 `const savedEvent = await EventHub.saveEvent(eventData)`，期望返回保存后的 Event 对象
- 当前实现可能不返回值或返回 `void`
- 导致无法获取 `outlookCalendarId` 触发同步

**影响范围**:
- `src/services/EventHub.ts`
- `src/components/TimeCalendar.tsx` (L1752-1785)
- `src/components/PlanManager.tsx`（如使用 EventHub）

**修复方案**:
```typescript
// src/services/EventHub.ts
export const EventHub = {
  /**
   * 保存事件（创建或更新）
   * @param eventData 事件数据
   * @returns 保存后的完整 Event 对象（包含生成的 ID）
   */
  async saveEvent(eventData: Event): Promise<Event> {
    if (eventData.id.startsWith('temp-') || eventData.id.startsWith('timer-')) {
      return await EventService.createEvent(eventData);
    } else {
      return await EventService.updateEvent(eventData.id, eventData);
    }
  }
};
```

**验证方法**:
1. 创建新事件（临时 ID 场景）
2. 确认返回值包含正确的最终 ID 和 outlookCalendarId
3. 检查 TimeCalendar 能正确触发同步

**预计工时**: 1-2 小时

---

### Issue #2: syncStatus 枚举值硬编码 🆕

**来源**: CROSS_CHECK_REPORT.md Issue #3

**问题描述**:
- 代码中使用字符串字面量：`syncStatus === 'local-only'`
- 缺少统一的枚举定义，容易拼写错误

**影响范围**:
- `src/types.ts`
- `src/components/EventEditModal.tsx` (L357)
- `src/components/Timer.tsx`
- `src/components/TimeCalendar.tsx` (L1472-1538)
- `src/services/ActionBasedSyncManager.ts`

**修复方案**:
```typescript
// src/types.ts
export enum SyncStatus {
  LOCAL_ONLY = 'local-only',   // 本地创建，未同步
  PENDING = 'pending',          // 等待同步
  SYNCED = 'synced',            // 已同步到 Outlook
  CONFLICT = 'conflict',        // 同步冲突
  ERROR = 'error'               // 同步失败
}

// 工具函数
export const isRunningTimer = (event: Event): boolean => {
  return event.syncStatus === SyncStatus.LOCAL_ONLY;
};
```

**状态转换**:
```
local-only → pending → synced
            ↓         ↓
          error → pending
            ↓
        conflict → pending（用户解决后）
```

**预计工时**: 1-2 小时

---

### Issue #3: Event.tags 数据格式不明确 🆕

**来源**: CROSS_CHECK_REPORT.md Issue #1, PLANMANAGER_ISSUES.md Issue #1

**问题描述**:
- `Event.tags` 字段有时存储标签名（`string[]`），有时存储标签 ID
- PlanManager PRD L320-330 中需要进行标签名 → 标签ID 映射
- 导致代码重复且容易出错

**影响范围**:
- `src/types.ts` (Event 接口定义)
- `src/services/TagService.ts`
- `src/components/PlanManager.tsx` (L320-330)
- `src/components/TagManager.tsx`
- `src/components/EventEditModal.tsx`

**修复方案**:
```typescript
// src/types.ts
export interface Event {
  // ...
  tags?: string[];  // 📝 明确约定：始终存储标签 ID
  tagNames?: string[]; // 🆕 冗余字段：标签名称（只读，由 TagService 派生）
}

// src/services/TagService.ts
export class TagService {
  /**
   * 解析标签为 ID（支持混合输入）
   */
  static resolveTagIds(tags: string[]): string[] {
    return tags.map(t => {
      const tag = this.getFlatTags().find(x => x.id === t || x.name === t);
      return tag ? tag.id : t;
    });
  }
  
  /**
   * 解析标签为名称
   */
  static resolveTagNames(tagIds: string[]): string[] {
    return tagIds.map(id => {
      const tag = this.getFlatTags().find(x => x.id === id);
      return tag ? tag.name : id;
    });
  }
}

// PlanManager.tsx 简化
if (item.tags) {
  const tagIds = TagService.resolveTagIds(item.tags); // ✅ 简化！
  setCurrentSelectedTags(tagIds);
}
```

**预期收益**:
- 消除 30+ 处的重复映射代码
- 标签数据一致性提升 100%
- 支持标签重命名（只需更新 TagService）

**预计工时**: 2-3 小时

---

### Issue #4: PlanManager syncToUnifiedTimeline 判断逻辑复杂 🆕

**来源**: PLANMANAGER_ISSUES.md Issue #2

**问题描述**:
- `syncToUnifiedTimeline` 函数长达 154 行（L666-820）
- 时间判断逻辑嵌套在其中，包含 4 种场景
- 难以测试、维护和复用

**影响范围**:
- `src/components/PlanManager.tsx` (L666-820)
- 可能影响 TimeCalendar 中的类似逻辑

**修复方案**:
提取独立函数 `determineEventTime()` 到 `src/utils/planTimeUtils.ts`

**详细方案**: 见 PLANMANAGER_ISSUES.md Issue #2

**预期收益**:
- 代码行数减少 ~50 lines
- 单元测试覆盖率提升
- 可在 TimeCalendar 中复用

**预计工时**: 3-4 小时

---

## 🟡 中优先级问题（影响用户体验）

### Issue #5: onStartTimeChange 回调高频调用

**来源**: EVENTEDITMODAL_MODULE_PRD.md Section 9.1

**问题描述**:
- 用户在 UnifiedDateTimePicker 中拖动时间选择器时，每次变更都触发 `onStartTimeChange`
- 父组件（EventEditModal）的 `formData` 频繁更新，触发重新渲染
- 可能导致性能问题和闪烁

**影响范围**:
- `src/components/EventEditModal.tsx` (L196-207)
- `src/components/UnifiedDateTimePicker.tsx`

**修复方案**:
```typescript
import { debounce } from 'lodash';

const debouncedStartTimeChange = useMemo(
  () => debounce((date: Date | null) => {
    setFormData(prev => ({ ...prev, start: date }));
  }, 300),
  []
);

// 在组件卸载时清理
useEffect(() => {
  return () => {
    debouncedStartTimeChange.cancel();
  };
}, [debouncedStartTimeChange]);
```

**预计工时**: 1-2 小时

---

### Issue #6: isRunningTimer 判断逻辑分散

**来源**: EVENTEDITMODAL_MODULE_PRD.md Section 9.1

**问题描述**:
- 当前判断逻辑：`event?.syncStatus === 'local-only'`
- 在多处重复出现（EventEditModal、TimeCalendar、Timer）
- 未来可能需要考虑更多条件（如 `runningStatus` 字段）

**修复方案**:
```typescript
// src/utils/timerUtils.ts
export const isRunningTimer = (event?: Event | null): boolean => {
  if (!event) return false;
  return event.syncStatus === 'local-only';
  // 未来扩展：
  // return event.syncStatus === 'local-only' && event.runningStatus === 'active';
};

// EventEditModal.tsx 使用
import { isRunningTimer } from '../utils/timerUtils';

const shouldSkipSync = isRunningTimer(event);
```

**预计工时**: 30 分钟

---

### Issue #7: editorLines 转换未处理循环引用 🆕

**来源**: PLANMANAGER_ISSUES.md Issue #4

**问题描述**:
- `editorLines` 转换逻辑（L467-515）未检测循环引用
- 如果 Plan Items 的 `level` 或排序出现循环，可能导致无限循环

**影响范围**:
- `src/components/PlanManager.tsx` (L467-515)

**修复方案**:
```typescript
const editorLines = useMemo<FreeFormLine<Event>[]>(() => {
  const lines: FreeFormLine<Event>[] = [];
  const visitedIds = new Set<string>(); // 🆕 检测循环引用

  sortedItems.forEach((item) => {
    if (!item.id) {
      warn('plan', 'Skipping item without id:', item);
      return;
    }
    
    // 🆕 检测重复 ID
    if (visitedIds.has(item.id)) {
      warn('plan', 'Duplicate item id detected:', item.id);
      return;
    }
    visitedIds.add(item.id);
    
    // ... 其余逻辑
  });
  
  return lines;
}, [items]);
```

**预计工时**: 30 分钟

---

### Issue #8: PlanManager 缺少 Error Boundary 🆕

**来源**: PLANMANAGER_ISSUES.md Issue #3

**问题描述**:
- PlanManager 组件没有 Error Boundary 包裹
- 如果发生运行时错误（如 Slate 编辑器崩溃），会导致整个应用白屏

**影响范围**:
- `src/components/PlanManager.tsx`（1648 lines）
- `src/components/SlateFreeFormEditor.tsx`
- 所有子组件

**修复方案**:
创建 `src/components/ErrorBoundary.tsx`，包裹 PlanManager

**详细方案**: 见 PLANMANAGER_ISSUES.md Issue #3

**预计工时**: 1-2 小时

---

### Issue #9: Timer 与 Plan Item 的 ID 冲突 🆕

**来源**: TIMER_MODULE_PRD.md Section 9.5 Issue #1

**问题描述**:
- Timer 使用 Plan Item 的 ID 时，TimeCalendar 中同时显示 Plan Item 和 Timer 事件，导致重复
- Timer 事件可能覆盖 Plan Item 的原始数据

**影响范围**:
- `src/components/TimerService.ts`
- `src/components/TimeCalendar.tsx`（事件过滤逻辑）
- `src/components/PlanManager.tsx`

**修复方案**（推荐）:
```typescript
// 方案 A: Timer 使用独立 ID
const timerId = `timer-${planItemId}-${Date.now()}`;

// 方案 B: Timer 事件添加 sourceType 字段
const timerEvent = {
  id: planItemId,
  sourceType: 'timer', // 🆕 标识来源
  originalPlanItem: planItemId, // 🆕 关联原始 Plan Item
  // ...
};

// TimeCalendar 过滤逻辑
const events = allEvents.filter(e => {
  if (e.sourceType === 'plan') {
    const hasRunningTimer = allEvents.some(t => 
      t.sourceType === 'timer' && t.originalPlanItem === e.id
    );
    return !hasRunningTimer; // 隐藏有运行中 Timer 的 Plan Item
  }
  return true;
});
```

**预计工时**: 2-3 小时

---

### Issue #10: Timer 停止时 Plan Item 的 startTime 被覆盖 🆕

**来源**: TIMER_MODULE_PRD.md Section 9.5 Issue #2

**问题描述**:
- Timer 停止时，如果直接更新 Event，可能覆盖 Plan Item 的计划时间

**影响范围**:
- `src/services/TimerService.ts` (stopTimer)

**修复方案**:
```typescript
// Timer 停止时，只更新特定字段
EventService.updateEvent(timer.eventId, {
  duration: finalDuration, // ✅ 更新时长
  // ❌ 不更新 startTime/endTime，保留 Plan Item 的计划时间
});
```

**预计工时**: 1 小时

---

### Issue #11: TimeHub 数据更新延迟

**来源**: EVENTEDITMODAL_MODULE_PRD.md Section 9.2

**问题描述**:
- EventEditModal 中使用 `useEventTime(event.id)` 订阅 TimeHub
- 用户修改时间后，TimeHub 可能未及时更新（取决于 TimeHub 实现）
- 导致表单显示的时间与 TimeHub 快照不一致

**建议方案**:
```typescript
// 方案 A: 增加 TimeHub 的更新机制
EventHub.emit('event-time-updated', { eventId, newTime });
// TimeHub 监听并立即更新快照

// 方案 B: 在 EventEditModal 中手动刷新 TimeHub
const refreshTimeHub = () => {
  TimeHub.refreshSnapshot(event.id);
};

useEffect(() => {
  if (formData.start !== eventTime?.start) {
    refreshTimeHub();
  }
}, [formData.start]);
```

**预计工时**: 2-3 小时

---

### Issue #12: PlanManager 与 Timer 的交互缺失 🆕

**来源**: CROSS_CHECK_REPORT.md Issue #4, TIMER_MODULE_PRD.md Section 9

**问题描述**:
- PlanManager PRD 中未说明如何启动 Timer
- Timer PRD 中未明确如何处理 Plan Item

**影响范围**:
- `src/components/PlanManager.tsx`（需添加"开始计时"按钮）
- `src/services/TimerService.ts`（需支持传入 eventId）

**修复方案**:
已在 TIMER_MODULE_PRD.md Section 9 中补充完整说明

**待实现**:
1. PlanManager 中添加"开始计时"按钮
2. TimerService.startTimer() 支持传入 planItemId

**预计工时**: 3-4 小时

---

## 🟢 低优先级问题（代码质量）

### Issue #13: PlanManager 魔法数字 🆕

**来源**: PLANMANAGER_ISSUES.md Issue #5

**问题描述**:
- `level + 1`（L487）未提取为常量

**修复方案**:
```typescript
const DESCRIPTION_INDENT_OFFSET = 1;

level: (item.level || 0) + DESCRIPTION_INDENT_OFFSET,
```

**预计工时**: 5 分钟

---

### Issue #14: PlanManager console.warn 未使用 debugLogger 🆕

**来源**: PLANMANAGER_ISSUES.md Issue #6

**问题描述**:
- `console.warn('[PlanManager] ...')` 未使用统一的 `debugLogger`

**修复方案**:
```typescript
import { warn } from '../utils/debug/debugLogger';

warn('plan', 'Skipping item without id:', item);
```

**预计工时**: 10 分钟

---

### Issue #15: EventEditModal 表单验证不完整

**来源**: EVENTEDITMODAL_MODULE_PRD.md Section 9.3

**问题描述**:
- 当前只验证 `start` 和 `end` 的顺序关系
- 缺少必填字段验证（如 title）
- 缺少时间格式验证（如 allDay 事件的时间必须为 00:00）

**建议方案**:
```typescript
const validateForm = (): string[] => {
  const errors: string[] = [];
  
  if (!formData.title?.trim()) {
    errors.push('标题不能为空');
  }
  
  if (formData.start && formData.end && formData.start > formData.end) {
    errors.push('开始时间不能晚于结束时间');
  }
  
  if (formData.allDay) {
    const start = formData.start;
    if (start && (start.getHours() !== 0 || start.getMinutes() !== 0)) {
      errors.push('全天事件的开始时间必须为 00:00');
    }
  }
  
  return errors;
};
```

**预计工时**: 1-2 小时

---

## 📈 问题修复优先级建议

### Phase 1: 功能正确性（高优先级）

| Issue | 标题 | 预计工时 | 风险 |
|-------|------|----------|------|
| #1 | EventHub.saveEvent() 返回值 | 1-2h | 🟡 中 |
| #2 | syncStatus 枚举定义 | 1-2h | 🟢 低 |
| #3 | Event.tags 格式统一 | 2-3h | 🟡 中 |
| #4 | PlanManager 时间判断逻辑提取 | 3-4h | 🟢 低 |

**小计**: 7-11 小时

### Phase 2: 用户体验（中优先级）

| Issue | 标题 | 预计工时 | 风险 |
|-------|------|----------|------|
| #5 | onStartTimeChange 防抖 | 1-2h | 🟢 低 |
| #6 | isRunningTimer 工具函数 | 0.5h | 🟢 低 |
| #7 | editorLines 循环引用检测 | 0.5h | 🟢 低 |
| #8 | PlanManager Error Boundary | 1-2h | 🟢 低 |
| #9 | Timer 与 Plan Item ID 冲突 | 2-3h | 🟡 中 |
| #10 | Timer 停止时字段覆盖 | 1h | 🟢 低 |
| #11 | TimeHub 数据更新延迟 | 2-3h | 🟡 中 |
| #12 | PlanManager ↔ Timer 集成 | 3-4h | 🟡 中 |

**小计**: 11-17 小时

### Phase 3: 代码质量（低优先级）

| Issue | 标题 | 预计工时 |
|-------|------|----------|
| #13 | PlanManager 魔法数字 | 5min |
| #14 | PlanManager debugLogger | 10min |
| #15 | EventEditModal 表单验证 | 1-2h |

**小计**: 1-2 小时

---

**总计**: 19-30 小时（约 2.5-4 个工作日）

---

## 📝 相关文档

- [EventEditModal PRD](./EVENTEDITMODAL_MODULE_PRD.md)
- [PlanManager PRD](./PLANMANAGER_MODULE_PRD.md)
- [Timer PRD](./TIMER_MODULE_PRD.md)
- [Cross-Check Report](./CROSS_CHECK_REPORT.md)
- [PlanManager Issues](../issues/PLANMANAGER_ISSUES.md)
- [TagManager Slate Refactor](../issues/TAGMANAGER_SLATE_REFACTOR.md)

**来源**: `docs/PRD/EVENTEDITMODAL_MODULE_PRD.md` Section 9.2

**问题描述**:
- 用户在开始时间控件快速输入时，`onStartTimeChange(newStartTime)` 被高频调用
- 如果回调涉及持久化或复杂计算，可能导致性能问题

**建议方案**:
```typescript
// EventEditModal.tsx
import { debounce } from 'lodash'; // 或自实现

const debouncedStartTimeChange = useMemo(
  () => onStartTimeChange 
    ? debounce((time: number) => onStartTimeChange(time), 300)
    : undefined,
  [onStartTimeChange]
);

const handleStartTimeEdit = (newStartTimeStr: string) => {
  setFormData({ ...formData, startTime: newStartTimeStr });
  
  if (debouncedStartTimeChange && globalTimer) {
    // ... 解析时间
    debouncedStartTimeChange(newStartTime);
  }
};
```

**影响范围**:
- `src/components/EventEditModal.tsx` (L447-470)
- 需要安装 `lodash` 或实现轻量级 debounce

**验证方法**:
1. 在时间控件快速手动输入
2. 观察 `onStartTimeChange` 调用频率（应为 300ms 间隔）
3. 检查 localStorage 写入次数

---

#### Issue #4: 保存按钮缺少 Loading 状态

**来源**: `docs/PRD/EVENTEDITMODAL_MODULE_PRD.md` Section 12.4

**问题描述**:
- 用户点击保存后，在异步操作完成前可以重复点击
- 可能导致并发请求或 UI 状态不一致

**建议方案**:
```typescript
// EventEditModal.tsx
const [isSaving, setIsSaving] = useState(false);

const handleSave = async () => {
  if (isSaving) return; // 防止重复提交
  
  setIsSaving(true);
  try {
    // ... 原有保存逻辑
  } finally {
    setIsSaving(false);
  }
};

// JSX
<button 
  className="save-button" 
  onClick={handleSave} 
  disabled={!formData.title && formData.tags.length === 0 || isSaving}
>
  {isSaving ? '保存中...' : '保存'}
</button>
```

**影响范围**:
- `src/components/EventEditModal.tsx` (L280-420, L836-850)

**验证方法**:
1. 点击保存后立即再次点击
2. 确认按钮变为禁用状态并显示 "保存中..."
3. 保存完成后按钮恢复

---

### 🟢 低优先级（优化与未来扩展）

#### Issue #5: 可访问性（A11y）改进

**来源**: `docs/PRD/EVENTEDITMODAL_MODULE_PRD.md` Section 12.5

**建议改进**:
1. **ARIA 属性**:
   ```tsx
   <div 
     className="event-edit-modal-overlay"
     role="dialog"
     aria-modal="true"
     aria-labelledby="event-edit-title"
   >
     <h2 id="event-edit-title">编辑事件</h2>
   ```

2. **Label 关联**:
   ```tsx
   <label htmlFor="event-title">标题</label>
   <input id="event-title" type="text" ... />
   ```

3. **键盘快捷键**:
   ```typescript
   const handleKeyDown = (e: React.KeyboardEvent) => {
     if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
       handleSave();
     }
     if (e.key === 'Escape') {
       onClose();
     }
   };
   ```

**影响范围**:
- `src/components/EventEditModal.tsx` (多处)

---

#### Issue #6: description 富文本支持（未来）

**来源**: `docs/PRD/EVENTEDITMODAL_MODULE_PRD.md` Section 11

**未来规划**:
1. **Markdown 支持**:
   - 客户端：使用 `react-markdown` 或 `tiptap`
   - 保存：Markdown 原文 + HTML 预览（用于 Outlook 同步）

2. **图片/附件**:
   - 设计云端存储策略（Azure Blob / OneDrive）
   - description 中使用 URL 引用
   - Outlook 同步时嵌入图片链接

3. **变更历史**:
   - 为 description 提供简易版本记录（最近 5 次）
   - 支持恢复误删内容

**技术挑战**:
- Outlook description 字段的 HTML 格式兼容性
- 不同客户端（Web/Desktop/Mobile）的显示一致性
- 图片/附件的权限控制与过期管理

---

#### Issue #7: 自动保存草稿

**来源**: `docs/PRD/EVENTEDITMODAL_MODULE_PRD.md` Section 11

**建议方案**:
```typescript
// EventEditModal.tsx
useEffect(() => {
  if (!event?.id || !isOpen) return;
  
  const saveDraft = debounce(() => {
    localStorage.setItem(`draft-${event.id}`, JSON.stringify(formData));
  }, 2000); // 2秒防抖
  
  saveDraft();
  
  return () => saveDraft.cancel();
}, [formData, event?.id, isOpen]);

// 初始化时恢复草稿
useEffect(() => {
  if (event && isOpen) {
    const draft = localStorage.getItem(`draft-${event.id}`);
    if (draft) {
      const confirmed = window.confirm('发现未保存的草稿，是否恢复？');
      if (confirmed) {
        setFormData(JSON.parse(draft));
      }
      localStorage.removeItem(`draft-${event.id}`);
    }
  }
}, [event, isOpen]);
```

**影响范围**:
- `src/components/EventEditModal.tsx`
- 需要考虑草稿过期清理策略

---

## 🎯 实施计划

### Phase 1: Cross-check 后统一处理（当前阶段）
1. ✅ 完成所有模块 PRD 编写
2. ⏳ Cross-check PRD 之间的一致性
3. ⏳ 根据 Cross-check 结果调整本清单

### Phase 2: 高优先级问题修复
- [ ] Issue #1: EventHub.createEvent 返回值
- [ ] Issue #2: syncStatus 枚举统一

### Phase 3: 中优先级体验优化
- [ ] Issue #3: onStartTimeChange 防抖
- [ ] Issue #4: 保存按钮 Loading 状态

### Phase 4: 低优先级改进（按需）
- [ ] Issue #5: 可访问性改进
- [ ] Issue #6: description 富文本支持（v2.0）
- [ ] Issue #7: 自动保存草稿

---

## 📝 跟踪规则

- 每个 Issue 修复后，在此文档标记为 `[✓]`
- 修复时创建对应的 Git commit，引用 Issue 编号
- 修复后更新相关 PRD 文档（标注已修复）

---

**最后更新**: 2025-11-05  
**下一步**: 继续编写 TagManager PRD → PlanManager PRD → Cross-check
