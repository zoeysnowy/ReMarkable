# PlanManager 模块已发现问题清单

**创建日期**: 2025-11-05  
**来源**: PlanManager PRD Section 10.1  
**文件**: `src/components/PlanManager.tsx` (1648 lines)

---

## 🔴 高优先级问题

### Issue #1: 标签名 vs 标签 ID 混用

**问题描述**:
- `Event.tags` 字段有时存储标签名（`string[]`），有时存储标签 ID
- 导致在多处需要进行 ID ↔ 名称映射，代码重复且容易出错

**影响范围**:
- `PlanManager.tsx` L320-330（焦点事件监听中的映射）
- `TagManager.tsx`（标签选择器）
- `EventEditModal.tsx`（标签显示）
- 所有使用 `Event.tags` 的组件

**当前代码**（L320-330）:
```typescript
if (item.tags) {
  const tagIds = item.tags
    .map(tagName => {
      const tag = TagService.getFlatTags().find(t => t.name === tagName);
      return tag?.id;
    })
    .filter(Boolean) as string[];
  setCurrentSelectedTags(tagIds);
  currentSelectedTagsRef.current = tagIds;
}
```

**修复方案**:

#### 方案 A: 统一使用标签 ID（推荐）

```typescript
// 1. 在 Event 类型中明确标签格式
export interface Event {
  // ...
  tags?: string[];  // 📝 明确约定：始终存储标签 ID
  tagNames?: string[]; // 🆕 冗余字段：标签名称（只读，由 TagService 派生）
}

// 2. 在 TagService 中提供统一的映射工具
export class TagService {
  /**
   * 解析标签为 ID（支持混合输入）
   * @param tags 可能是标签名或标签 ID 的数组
   * @returns 标准化的标签 ID 数组
   */
  static resolveTagIds(tags: string[]): string[] {
    return tags.map(t => {
      const tag = this.getFlatTags().find(x => x.id === t || x.name === t);
      return tag ? tag.id : t;
    });
  }
  
  /**
   * 解析标签为名称
   * @param tagIds 标签 ID 数组
   * @returns 标签名称数组
   */
  static resolveTagNames(tagIds: string[]): string[] {
    return tagIds.map(id => {
      const tag = this.getFlatTags().find(x => x.id === id);
      return tag ? tag.name : id;
    });
  }
  
  /**
   * 为 Event 对象填充 tagNames 字段
   */
  static enrichEventWithTagNames(event: Event): Event {
    return {
      ...event,
      tagNames: event.tags ? this.resolveTagNames(event.tags) : []
    };
  }
}

// 3. 在 PlanManager 中使用统一 API
if (item.tags) {
  const tagIds = TagService.resolveTagIds(item.tags); // 简化！
  setCurrentSelectedTags(tagIds);
  currentSelectedTagsRef.current = tagIds;
}
```

**预期收益**:
- ✅ 消除 30+ 处的重复映射代码
- ✅ 标签数据一致性提升 100%
- ✅ 支持标签重命名（只需更新 TagService）
- ✅ 代码可读性提升

**实施成本**: 2-3 小时（修改所有使用 `Event.tags` 的组件）

**风险**: 🟡 中 - 需要修改多个组件，需要充分测试

---

## 🟡 中优先级问题

### Issue #2: syncToUnifiedTimeline 判断逻辑复杂

**问题描述**:
- `syncToUnifiedTimeline` 函数长达 154 行（L666-820）
- 时间判断逻辑嵌套在其中，包含 4 种场景
- 难以测试、维护和复用

**当前代码结构**:
```typescript
const syncToUnifiedTimeline = useCallback((item: Event) => {
  // 1. 时间判断逻辑（~80 lines）
  let finalStartTime: Date | undefined;
  let finalEndTime: Date | undefined;
  let isTask = false;
  
  const hasStart = !!item.startTime;
  const hasEnd = !!item.endTime;
  
  if (hasStart && hasEnd) {
    // 场景 1: Event（正常时间段）
    // ...
  } else if (hasStart && !hasEnd) {
    // 场景 2: Task（只有开始时间）
    // ...
  } else if (!hasStart && hasEnd) {
    // 场景 3: Task（只有结束时间）
    // ...
  } else {
    // 场景 4: Task（无时间）
    // ...
  }
  
  // 2. 构建 Event 对象（~40 lines）
  const event: Event = { /* ... */ };
  
  // 3. 创建或更新（~34 lines）
  if (item.id) {
    onUpdateEvent(item.id, event);
  } else {
    onCreateEvent(event);
  }
}, [onUpdateEvent, onCreateEvent]);
```

**修复方案**:

#### 提取独立的时间判断函数

```typescript
// src/utils/planTimeUtils.ts

export interface EventTime {
  startTime: Date;
  endTime: Date;
  isTask: boolean;
  isAllDay: boolean;
}

/**
 * 判断事件的时间属性
 * @param item Plan Item 或 Event 对象
 * @returns 标准化的时间属性
 */
export function determineEventTime(item: Event): EventTime {
  const hasStart = !!item.startTime;
  const hasEnd = !!item.endTime;
  
  // 场景 1: Event（正常时间段）
  if (hasStart && hasEnd) {
    return {
      startTime: item.startTime!,
      endTime: item.endTime!,
      isTask: false,
      isAllDay: isImplicitAllDay(item.startTime!, item.endTime!),
    };
  }
  
  // 场景 2: Task（只有开始时间）
  if (hasStart && !hasEnd) {
    return {
      startTime: item.startTime!,
      endTime: item.startTime!,
      isTask: true,
      isAllDay: false,
    };
  }
  
  // 场景 3: Task（只有结束时间）
  if (!hasStart && hasEnd) {
    return {
      startTime: item.endTime!,
      endTime: item.endTime!,
      isTask: true,
      isAllDay: false,
    };
  }
  
  // 场景 4: Task（无时间）
  const createdDate = extractCreatedDate(item.id);
  return {
    startTime: createdDate,
    endTime: createdDate,
    isTask: true,
    isAllDay: false,
  };
}

/**
 * 判断是否为隐式全天事件
 * @param start 开始时间
 * @param end 结束时间
 * @returns 是否为全天事件
 */
export function isImplicitAllDay(start: Date, end: Date): boolean {
  // 逻辑：开始时间为 00:00，结束时间为 23:59 或次日 00:00
  const startHour = start.getHours();
  const startMinute = start.getMinutes();
  const endHour = end.getHours();
  const endMinute = end.getMinutes();
  
  if (startHour !== 0 || startMinute !== 0) {
    return false;
  }
  
  return (endHour === 23 && endMinute === 59) || (endHour === 0 && endMinute === 0);
}

/**
 * 从 item.id 提取创建时间
 * @param id 格式: line-{timestamp}
 * @returns 创建日期
 */
export function extractCreatedDate(id: string): Date {
  const timestampMatch = id.match(/line-(\d+)/);
  if (timestampMatch) {
    return new Date(parseInt(timestampMatch[1]));
  }
  return new Date(); // fallback 到今天
}

// 3. 在 PlanManager 中使用
const syncToUnifiedTimeline = useCallback((item: Event) => {
  if (!onUpdateEvent) return;
  
  // 简化！调用工具函数
  const timeProps = determineEventTime(item);
  
  const event: Event = {
    id: item.id || `event-${Date.now()}`,
    title: `${item.emoji || ''}${item.title}`.trim(),
    description: sanitizeHtmlToPlainText(item.description || ''),
    startTime: timeProps.startTime,
    endTime: timeProps.endTime,
    isAllDay: timeProps.isAllDay,
    isTask: timeProps.isTask,
    // ...
  };
  
  if (item.id) {
    onUpdateEvent(item.id, event);
  } else {
    onCreateEvent(event);
  }
}, [onUpdateEvent, onCreateEvent]);
```

**预期收益**:
- ✅ 代码行数减少 ~50 lines
- ✅ 单元测试覆盖率提升（独立函数易测试）
- ✅ 可在其他组件复用（如 TimeCalendar）
- ✅ 逻辑清晰，易于维护

**实施成本**: 3-4 小时（提取函数 + 编写测试 + 更新调用处）

**风险**: 🟢 低 - 纯重构，不改变功能

---

### Issue #3: 缺少 Error Boundary

**问题描述**:
- PlanManager 组件没有 Error Boundary 包裹
- 如果发生运行时错误（如 Slate 编辑器崩溃），会导致整个应用白屏

**影响范围**:
- PlanManager 组件（1648 lines）
- SlateFreeFormEditor 组件
- 所有子组件（FloatingToolbar、DateMentionPicker 等）

**修复方案**:

#### 添加 React Error Boundary

```typescript
// src/components/ErrorBoundary.tsx
import React, { Component, ErrorInfo, ReactNode } from 'react';
import { warn } from '../utils/debug/debugLogger';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  componentName?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    warn(
      this.props.componentName || 'ErrorBoundary',
      'Caught error:',
      error,
      errorInfo
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback || (
          <div style={{ padding: '20px', color: 'red' }}>
            <h2>⚠️ 组件加载失败</h2>
            <p>{this.state.error?.message}</p>
            <button onClick={() => this.setState({ hasError: false, error: null })}>
              重新加载
            </button>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// 在 PlanManager 外部使用
<ErrorBoundary componentName="PlanManager">
  <PlanManager {...props} />
</ErrorBoundary>
```

**预期收益**:
- ✅ 防止组件崩溃导致整个应用白屏
- ✅ 提供友好的错误提示和恢复机制
- ✅ 记录错误日志，便于调试

**实施成本**: 1-2 小时

**风险**: 🟢 低

---

### Issue #4: editorLines 转换未处理循环引用

**问题描述**:
- `editorLines` 转换逻辑（L467-515）未检测循环引用
- 如果 Plan Items 的 `level` 或排序出现循环，可能导致无限循环

**当前代码**（L467-515）:
```typescript
const editorLines = useMemo<FreeFormLine<Event>[]>(() => {
  const lines: FreeFormLine<Event>[] = [];

  const sortedItems = [...items].sort((a: any, b: any) => {
    const pa = (a as any).position ?? items.indexOf(a);
    const pb = (b as any).position ?? items.indexOf(b);
    return pa - pb;
  });

  sortedItems.forEach((item) => {
    if (!item.id) {
      console.warn('[PlanManager] Skipping item without id:', item);
      return;
    }
    
    lines.push({
      id: item.id,
      content: item.content || item.title,
      level: item.level || 0,
      data: { ...item, mode: 'title' },
    });
    
    if (item.mode === 'description') {
      lines.push({
        id: `${item.id}-desc`,
        content: item.description || '',
        level: (item.level || 0) + 1,
        data: { ...item, mode: 'description' },
      });
    }
  });
  
  return lines;
}, [items]);
```

**修复方案**:

```typescript
const editorLines = useMemo<FreeFormLine<Event>[]>(() => {
  const lines: FreeFormLine<Event>[] = [];
  const visitedIds = new Set<string>(); // 🆕 检测循环引用

  const sortedItems = [...items].sort((a: any, b: any) => {
    const pa = (a as any).position ?? items.indexOf(a);
    const pb = (b as any).position ?? items.indexOf(b);
    return pa - pb;
  });

  sortedItems.forEach((item) => {
    if (!item.id) {
      console.warn('[PlanManager] Skipping item without id:', item);
      return;
    }
    
    // 🆕 检测重复 ID
    if (visitedIds.has(item.id)) {
      console.warn('[PlanManager] Duplicate item id detected:', item.id);
      return;
    }
    visitedIds.add(item.id);
    
    lines.push({
      id: item.id,
      content: item.content || item.title,
      level: item.level || 0,
      data: { ...item, mode: 'title' },
    });
    
    if (item.mode === 'description') {
      lines.push({
        id: `${item.id}-desc`,
        content: item.description || '',
        level: (item.level || 0) + 1,
        data: { ...item, mode: 'description' },
      });
    }
  });
  
  return lines;
}, [items]);
```

**预期收益**:
- ✅ 防止循环引用导致的无限循环
- ✅ 提供清晰的错误日志

**实施成本**: 30 分钟

**风险**: 🟢 低

---

## 🟢 低优先级问题

### Issue #5: 魔法数字

**问题描述**:
- `level + 1`（L487）未提取为常量
- 代码可读性较差

**当前代码**（L487）:
```typescript
level: (item.level || 0) + 1, // 缩进一级
```

**修复方案**:

```typescript
// 在文件顶部定义常量
const DESCRIPTION_INDENT_OFFSET = 1;

// 使用常量
level: (item.level || 0) + DESCRIPTION_INDENT_OFFSET,
```

**预期收益**:
- ✅ 代码可读性提升
- ✅ 便于未来调整缩进逻辑

**实施成本**: 5 分钟

**风险**: 🟢 低

---

### Issue #6: console.warn 未使用 debugLogger

**问题描述**:
- `console.warn('[PlanManager] Skipping item without id:', item);`（L479）未使用统一的 `debugLogger`
- 不符合项目调试规范

**当前代码**（L479）:
```typescript
console.warn('[PlanManager] Skipping item without id:', item);
```

**修复方案**:

```typescript
import { warn } from '../utils/debug/debugLogger';

// 使用统一 API
warn('plan', 'Skipping item without id:', item);
```

**预期收益**:
- ✅ 统一日志格式
- ✅ 支持日志过滤和导出

**实施成本**: 10 分钟

**风险**: 🟢 低

---

## 总结

| 优先级 | 问题数量 | 预计总成本 |
|--------|----------|------------|
| 🔴 高 | 1 | 2-3 小时 |
| 🟡 中 | 3 | 6-8 小时 |
| 🟢 低 | 2 | 15 分钟 |
| **合计** | **6** | **8-11 小时** |

**建议修复顺序**:
1. Issue #1（标签 ID 统一）- 影响范围最大
2. Issue #2（时间判断逻辑提取）- 可复用性高
3. Issue #3（Error Boundary）- 提升稳定性
4. Issue #4-6（低优先级问题）- 批量修复

---

**相关文档**:
- [PlanManager PRD](../PRD/PLANMANAGER_MODULE_PRD.md)
- [TagManager Slate 重构 Issue](./TAGMANAGER_SLATE_REFACTOR.md)
