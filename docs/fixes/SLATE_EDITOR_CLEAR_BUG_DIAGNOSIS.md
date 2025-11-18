# Slate 编辑器清空问题诊断报告

**创建日期**: 2025-11-18  
**问题描述**: Slate 编辑器内容突然清空，需要切换页面才能恢复  
**严重程度**: 🔴 高（影响用户体验）

---

## 🔍 问题表现

### 用户报告
- **症状**: 编辑器突然清空，所有内容消失
- **恢复方法**: 切换到其他页面再回来，内容恢复
- **频率**: 偶发性
- **触发条件**: 未知（需诊断）

### 技术分析
这是一个**渲染层面的问题**，而非数据丢失：
- ✅ 数据仍在 `EventService` 中（切换页面后能恢复）
- ❌ Slate 编辑器的 `value` 状态被意外清空
- ❌ `items` prop 被传入空数组

---

## 🐛 根本原因分析

通过代码审查，我发现了 **5 个可能导致空数组的触发点**：

### 1. 🔴 初始化竞态条件（最可能）

**位置**: `UnifiedSlateEditor.tsx` L619-627

```typescript
const isInitializedRef = React.useRef(false);
useEffect(() => {
  if (!isInitializedRef.current && items.length > 0) {
    logOperation('初始化编辑器内容', { itemCount: items.length });
    
    setValue(enhancedValue);  // 🔴 问题：enhancedValue 可能是旧值
    isInitializedRef.current = true;
  }
}, []); // ✅ 空依赖，只执行一次
```

**问题分析**:
- `useEffect` 依赖为空，**只执行一次**
- 但 `enhancedValue` 在 `useMemo` 中计算，依赖 `items`
- **竞态场景**:
  ```
  时刻 T0: items = [] (初始空数组)
  时刻 T1: enhancedValue = planItemsToSlateNodes([]) = [placeholderLine]
  时刻 T2: useEffect 执行，setValue(enhancedValue) → 只有 placeholder
  时刻 T3: items 从 EventService 加载 → items = [100 条数据]
  时刻 T4: enhancedValue 重新计算 → [100 条 + placeholder]
  时刻 T5: ❌ useEffect 不再执行（空依赖），编辑器卡在 T2 的空状态
  ```

**触发条件**:
- 页面快速切换
- EventService 数据加载延迟
- React 18 并发渲染模式

**复现概率**: ⭐️⭐️⭐️⭐️⭐️ 极高（最可能原因）

---

### 2. 🟡 PlanManager 过滤逻辑

**位置**: `PlanManager.tsx` L324-333

```typescript
const filtered = allEvents.filter((event: Event) => {
  if (!event.isPlan) return false;              // 过滤非 Plan 事件
  if (event.parentEventId) return false;        // 过滤子事件
  if (event.isTimeCalendar) {                   // 🔴 TimeCalendar 事件的时间检查
    const endTime = new Date(event.endTime);
    return now < endTime;  // 只显示未结束的事件
  }
  return true;
});
```

**问题分析**:
- 如果所有 `isPlan` 事件都是 `isTimeCalendar` 且已过期 → `filtered = []`
- 或者 `EventService.getAllEvents()` 返回空数组

**触发条件**:
- 所有 TimeCalendar 事件已结束
- EventService 初始化失败
- 数据同步丢失 `isPlan` 标记

**复现概率**: ⭐️⭐️ 低（除非数据异常）

---

### 3. 🟡 EventHub 批量删除

**位置**: `PlanManager.tsx` L695-702

```typescript
// 阶段 1: 跨行删除检测
const currentItemIds = items.map(i => i.id);
const updatedItemIds = updatedItems.map((i: any) => i.id);
const crossDeletedIds = currentItemIds.filter(id => !updatedItemIds.includes(id));

if (crossDeletedIds.length > 0) {
  actions.delete.push(...crossDeletedIds);  // 🔴 如果所有 ID 都被删除
  dbg('plan', `📋 收集跨行删除动作: ${crossDeletedIds.length} 个`);
}
```

**问题分析**:
- 如果 `updatedItems = []`（空数组），则 `crossDeletedIds = 所有 ID`
- 会触发批量删除所有事件

**触发条件**:
- Slate 编辑器 `onChange` 回调传入空数组
- 序列化函数 `slateNodesToPlanItems` 返回空数组

**复现概率**: ⭐️⭐️⭐️ 中等

---

### 4. 🟠 eventsUpdated 事件监听器

**位置**: `PlanManager.tsx` L406-428

```typescript
useEffect(() => {
  const handleEventUpdated = (e: CustomEvent) => {
    const { eventId, isDeleted, isNewEvent } = e.detail || {};
    
    if (isDeleted) {
      // 增量删除
      setItems(prev => prev.filter(event => event.id !== eventId));  // 🔴 多次删除
    }
    // ...
  };
  
  window.addEventListener('eventsUpdated', handleEventUpdated as EventListener);
  return () => window.removeEventListener('eventsUpdated', handleEventUpdated as EventListener);
}, []);
```

**问题分析**:
- 如果外部系统连续触发多个 `isDeleted` 事件
- 可能导致 `items` 被逐步清空

**触发条件**:
- 同步服务批量删除
- 多窗口并发操作
- EventHub 误触发删除事件

**复现概率**: ⭐️⭐️ 低（除非外部异常）

---

### 5. 🟢 序列化过滤逻辑

**位置**: `serialization.ts` L493-502

```typescript
const result = Array.from(items.values()).filter(item => {
  const isEmpty = !item.title?.trim() && 
                 !item.content?.trim() && 
                 !item.description?.trim() &&
                 (!item.tags || item.tags.length === 0);
  return !isEmpty;  // 只保留非空节点  // 🔴 如果所有节点都是空的
});
```

**问题分析**:
- 如果用户快速删除所有内容，所有节点被判定为空
- `slateNodesToPlanItems` 返回空数组

**触发条件**:
- 用户连续按 Backspace 删除所有内容
- Placeholder 行被误判为空节点

**复现概率**: ⭐️⭐️⭐️ 中等

---

## 🎯 诊断建议

### 立即添加防御性日志

在以下位置添加警告日志，捕获空数组的产生点：

#### 1. PlanManager.tsx

```typescript
// L324 过滤逻辑后
console.log('[PlanManager] 过滤后的 Plan 事件:', {
  过滤后数量: filtered.length,
  总事件数: allEvents.length,
  ⚠️警告: filtered.length === 0 ? '所有事件被过滤！' : undefined,
});

if (filtered.length === 0 && allEvents.length > 0) {
  console.error('🔴 [PlanManager] 警告：所有事件被过滤，可能导致编辑器清空！', {
    allEvents: allEvents.slice(0, 5),
  });
}

return filtered;
```

#### 2. UnifiedSlateEditor.tsx

```typescript
// L625 初始化后
setValue(enhancedValue);
console.log('[UnifiedSlateEditor] 初始化完成:', {
  enhancedValue长度: enhancedValue.length,
  items长度: items.length,
  ⚠️警告: enhancedValue.length === 0 ? 'enhancedValue 为空！' : undefined,
});

if (enhancedValue.length === 0 && items.length > 0) {
  console.error('🔴 [UnifiedSlateEditor] 警告：items 有数据但 enhancedValue 为空！', {
    items: items.slice(0, 5),
  });
}
```

#### 3. onChange 回调

```typescript
// UnifiedSlateEditor.tsx L1064
const planItems = slateNodesToPlanItems(filteredNodes);

console.log('[UnifiedSlateEditor] onChange 保存:', {
  filteredNodes长度: filteredNodes.length,
  planItems长度: planItems.length,
  ⚠️警告: planItems.length === 0 ? '转换后为空数组！' : undefined,
});

if (planItems.length === 0 && filteredNodes.length > 0) {
  console.error('🔴 [UnifiedSlateEditor] 警告：filteredNodes 有数据但 planItems 为空！', {
    filteredNodes: filteredNodes.slice(0, 3),
  });
}

onChange(planItems);
```

---

## 🔧 修复方案

### 方案 A：修复初始化竞态（推荐）⭐️⭐️⭐️⭐️⭐️

**问题**: 初始化 `useEffect` 可能在 `items` 加载前执行

**修复代码**:

```typescript
// UnifiedSlateEditor.tsx L619-627

// ❌ 旧版本
const isInitializedRef = React.useRef(false);
useEffect(() => {
  if (!isInitializedRef.current && items.length > 0) {
    setValue(enhancedValue);
    isInitializedRef.current = true;
  }
}, []); // 空依赖，只执行一次

// ✅ 新版本
const isInitializedRef = React.useRef(false);
useEffect(() => {
  // 🔧 修复：只有当 items 真正有数据时才初始化
  if (!isInitializedRef.current && items.length > 0) {
    console.log('[初始化] 设置编辑器内容:', { itemCount: items.length });
    setValue(enhancedValue);
    isInitializedRef.current = true;
  }
}, [items.length, enhancedValue]); // ✅ 依赖 items.length 和 enhancedValue

// 🔥 或者更激进的修复：每次 items 变化都同步（如果未初始化）
useEffect(() => {
  if (items.length > 0) {
    if (!isInitializedRef.current) {
      console.log('[初始化] 设置编辑器内容:', { itemCount: items.length });
      setValue(enhancedValue);
      isInitializedRef.current = true;
    }
  } else if (isInitializedRef.current) {
    // 🆕 如果 items 变成空数组，重置初始化标志
    console.warn('[重置] items 变为空，重置初始化标志');
    isInitializedRef.current = false;
  }
}, [items.length, enhancedValue]);
```

**优点**:
- ✅ 修复竞态条件
- ✅ 确保 `enhancedValue` 是最新的
- ✅ 支持 items 从空 → 有数据的动态加载

**风险**: 可能增加重新渲染次数（性能影响小）

---

### 方案 B：防御性检查（安全网）⭐️⭐️⭐️⭐️

**在多个关键点添加空数组保护**

#### 1. PlanManager 过滤后

```typescript
// PlanManager.tsx L353
const filtered = allEvents.filter(/* ... */);

// 🆕 防御性检查
if (filtered.length === 0 && allEvents.length > 0) {
  console.error('🔴 [PlanManager] 所有事件被过滤，保留原数据避免清空');
  // 降级策略：返回所有 isPlan 的事件（忽略时间过滤）
  return allEvents.filter(e => e.isPlan && !e.parentEventId);
}

return filtered;
```

#### 2. onChange 回调

```typescript
// PlanManager.tsx L930
const handleLinesChange = (newLines: FreeFormLine<Event>[]) => {
  // 🆕 防御性检查
  if (newLines.length === 0 && items.length > 0) {
    console.error('🔴 [PlanManager] onChange 收到空数组，忽略此次更新！');
    return; // 不触发保存
  }
  
  // ... 原有逻辑
};
```

#### 3. setValue 调用

```typescript
// UnifiedSlateEditor.tsx L625
if (!isInitializedRef.current && items.length > 0) {
  // 🆕 防御性检查
  if (enhancedValue.length === 0 || enhancedValue.length === 1) {
    console.error('🔴 [UnifiedSlateEditor] enhancedValue 异常，跳过初始化');
    return;
  }
  
  setValue(enhancedValue);
  isInitializedRef.current = true;
}
```

**优点**:
- ✅ 多层保护
- ✅ 不改变核心逻辑
- ✅ 记录异常日志便于调试

---

### 方案 C：添加状态保护机制⭐️⭐️⭐️

**引入"上一次有效状态"缓存**

```typescript
// UnifiedSlateEditor.tsx

// 🆕 缓存上一次有效的 value
const lastValidValueRef = useRef<EventLineNode[]>([]);

const handleEditorChange = useCallback((newValue: Descendant[]) => {
  // ... 原有逻辑
  
  // 🆕 检测异常清空
  const hasContent = (newValue as EventLineNode[]).some(node => 
    node.eventId !== '__placeholder__'
  );
  
  if (!hasContent && lastValidValueRef.current.length > 0) {
    console.error('🔴 [UnifiedSlateEditor] 检测到异常清空，恢复上一次有效状态');
    setValue(lastValidValueRef.current);
    return;
  }
  
  // 更新有效状态缓存
  if (hasContent) {
    lastValidValueRef.current = newValue as EventLineNode[];
  }
  
  setValue(newValue as unknown as EventLineNode[]);
}, [/* ... */]);
```

**优点**:
- ✅ 自动恢复机制
- ✅ 用户无感知

**缺点**:
- ⚠️ 可能掩盖真实的用户删除操作

---

## 📊 推荐实施顺序

### 第一步：添加诊断日志（今天，10 分钟）

在 3 个关键位置添加警告日志：
1. PlanManager 过滤后
2. UnifiedSlateEditor 初始化
3. onChange 回调

**目的**: 捕获下一次空数组出现的具体位置

### 第二步：修复初始化竞态（明天，30 分钟）

实施**方案 A**，修改 `useEffect` 依赖

**目的**: 解决最可能的根本原因

### 第三步：添加防御性检查（后天，1 小时）

实施**方案 B**，在多个关键点添加保护

**目的**: 建立安全网，防止未知边缘情况

### 第四步：验证修复（持续观察）

- 正常使用 1 周
- 检查控制台日志
- 确认问题不再出现

---

## 🧪 测试用例

### 复现测试

尝试手动触发空数组场景：

```javascript
// 在浏览器控制台运行

// 1. 测试初始化竞态
window.__testInitRace = () => {
  // 清空 EventService
  EventService._events = [];
  
  // 快速切换页面（触发 unmount/mount）
  window.location.hash = '#/calendar';
  setTimeout(() => {
    window.location.hash = '#/plan';
  }, 100);
};

// 2. 测试过滤逻辑
window.__testFilterEmpty = () => {
  // 修改所有事件为非 Plan
  const events = EventService.getAllEvents();
  events.forEach(e => {
    e.isPlan = false;
  });
  
  // 触发 re-render
  window.dispatchEvent(new CustomEvent('eventsUpdated', {
    detail: { eventId: events[0]?.id }
  }));
};

// 3. 测试批量删除
window.__testBatchDelete = () => {
  const events = EventService.getAllEvents();
  events.forEach(e => {
    window.dispatchEvent(new CustomEvent('eventsUpdated', {
      detail: { eventId: e.id, isDeleted: true }
    }));
  });
};
```

### 回归测试

正常操作确保不破坏功能：
- [ ] 创建新事件
- [ ] 编辑现有事件
- [ ] 删除事件
- [ ] 页面切换
- [ ] 多窗口同步
- [ ] @提及插入

---

## ✅ 预期成果

实施修复后，应达到：

1. **零异常清空**: 不再出现编辑器突然清空的情况
2. **详细日志**: 如果再次出现，立即知道原因
3. **自动恢复**: 即使异常，也能自动恢复上一次有效状态

---

## 📝 下一步行动

**立即执行**（今天）:
1. 添加诊断日志到 3 个关键位置
2. 提交代码，观察线上日志

**本周完成**:
1. 实施方案 A（修复初始化竞态）
2. 实施方案 B（防御性检查）
3. 编写自动化测试

**需要协助**:
- 生成修复代码
- Code Review
- 测试用例编写

---

**文档版本**: v1.0  
**作者**: GitHub Copilot  
**审核状态**: 待确认
