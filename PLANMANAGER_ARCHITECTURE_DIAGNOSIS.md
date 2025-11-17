# PlanManager 架构诊断报告

## 🔴 核心问题：混合架构导致数据流混乱

### 当前架构（2层转换）

```
Event (EventService/localStorage)
    ↓ [转换1: PlanManager lines 1256-1340]
FreeFormLine<Event>[] (editorLines)
    ↓ [转换2: PlanManager lines 1774-1810]  
UnifiedSlateEditor items (包含 mode, startTime, endTime 等)
    ↓ [转换3: UnifiedSlateEditor 内部]
Slate Document (EventLineNode + ParagraphNode)
```

### 问题分析

#### 1. **FreeFormLine 是冗余的中间层**
```typescript
// PlanManager.tsx line 49-54
interface FreeFormLine<T = any> {
  id: string;
  content: string;
  level: number;
  data?: T;  // ❌ 完整 Event 对象藏在这里
}
```

**问题**:
- `FreeFormLine` 不是 Slate 的数据结构
- 只是一个临时包装器，将 Event 转换为"行"的概念
- `data` 字段包含完整 Event，但 `content`/`level` 字段重复了部分信息
- 导致数据冗余和不一致风险

#### 2. **二次转换丢失字段**
```typescript
// PlanManager.tsx lines 1774-1810
items={useMemo(() => editorLines.map(line => {
  const item = line.data;
  return {
    id: line.id,
    eventId: item.id,
    level: line.level,
    title: item.title,
    content: line.content,  // ← 从 FreeFormLine 拿
    // ... 手动复制 20+ 个字段
    mode: item.mode,  // ← 刚刚才添加的修复
  };
}), [editorLines])}
```

**问题**:
- 手动逐字段复制，容易遗漏（如刚刚发现的 `mode` 字段）
- `content` 和 `title` 数据重复
- 维护成本高：每次 Event 添加字段都要改 3 个地方

#### 3. **UnifiedSlateEditor 已支持直接接收 Event**
```typescript
// UnifiedSlateEditor.tsx line 109
export interface UnifiedSlateEditorProps {
  items: any[];  // ✅ 实际上就是 Event[]
  onChange: (items: any[]) => void;
  // ...
}
```

**关键发现**:
- `UnifiedSlateEditor` 内部会将 `items` 转换为 Slate 文档
- 它根本不关心 `FreeFormLine` 这个结构
- `items` 只需要包含 Event 的必要字段即可

---

## ✅ 推荐方案：移除 FreeFormLine 中间层

### 简化后的架构（1层转换）

```
Event (EventService/localStorage)
    ↓ [直接传递]
UnifiedSlateEditor items (Event[])
    ↓ [转换: UnifiedSlateEditor 内部]
Slate Document (EventLineNode + ParagraphNode)
```

### 实施步骤

#### Step 1: 分析 `editorLines` 的用途

当前 `editorLines` 被用于：

**用途1: 生成 Title + Description 行**
```typescript
// line 1256-1340: 构造 editorLines
sortedItems.forEach((item) => {
  // Title 行
  lines.push({
    id: item.id,
    content: item.content || item.title,
    level: item.level || 0,
    data: { ...item, mode: 'title', description: undefined },
  });
  
  // Description 行（如果有）
  if (item.mode === 'description') {
    lines.push({
      id: `${item.id}-desc`,
      content: item.description || '',
      level: (item.level || 0) + 1,
      data: { ...item, mode: 'description' },
    });
  }
});
```

**用途2: 在 renderLinePrefix/renderLineSuffix 中查找匹配的 Event**
```typescript
// lines 1836-1884
renderLinePrefix={(line) => {
  const matchedLine = editorLines.find(l => l.id === line.lineId);
  // ...
  return renderLinePrefix(matchedLine);
}}
```

**结论**: 
- `editorLines` 的核心作用是**展开 Title + Description 成多行**
- UnifiedSlateEditor 内部**已经支持这个功能**！

#### Step 2: 检查 UnifiedSlateEditor 内部实现

```typescript
// UnifiedSlateEditor.tsx 内部已经处理了 Title + Description 分离
// serialization.ts: planItemsToSlateNodes
export function planItemsToSlateNodes(items: any[]): Descendant[] {
  return items.flatMap((item) => {
    const titleNode: EventLineNode = {
      type: 'event-line',
      eventId: item.eventId || item.id,
      lineId: item.id,
      level: item.level || 0,
      mode: 'title',  // ← 内部已处理
      children: [/* ... */],
      metadata: { /* 透传完整字段 */ }
    };
    
    // Description 节点（如果有）
    const nodes: Descendant[] = [titleNode];
    if (item.mode === 'description' && item.description) {
      nodes.push(/* description EventLineNode */);
    }
    
    return nodes;
  });
}
```

**关键发现**:
- UnifiedSlateEditor 内部的 `planItemsToSlateNodes` **已经处理了 Title/Description 分离**
- `editorLines` 的逻辑**完全重复**了这个功能！

---

## 🎯 重构方案

### 方案 A: 最小改动（推荐）

**移除 editorLines，直接传递 items**

```typescript
// PlanManager.tsx

// ❌ 删除
const editorLines = useMemo<FreeFormLine<Event>[]>(() => {
  // ... 1000+ 行复杂逻辑
}, [items, pendingEmptyItems]);

// ✅ 简化为
const editorItems = useMemo(() => {
  return [...items, ...Array.from(pendingEmptyItems.values())]
    .sort((a, b) => {
      const pa = (a as any).position ?? items.indexOf(a);
      const pb = (b as any).position ?? items.indexOf(b);
      return pa - pb;
    });
}, [items, pendingEmptyItems]);

// ✅ 直接传递
<UnifiedSlateEditor
  items={editorItems}
  onChange={debouncedOnChange}
  // ...
/>
```

**renderLinePrefix/renderLineSuffix 修改**:
```typescript
renderLinePrefix={(element) => {
  // ✅ element 已经是 EventLineNode，包含完整 metadata
  const item = {
    id: element.eventId,
    ...element.metadata
  } as Event;
  
  return <Checkbox item={item} />;
}}

renderLineSuffix={(element) => {
  const item = {
    id: element.eventId,
    ...element.metadata
  } as Event;
  
  return <PlanItemTimeDisplay item={item} />;
}}
```

**优势**:
- 移除 500+ 行冗余代码
- 数据流清晰：Event → UnifiedSlateEditor → Slate
- 字段不会丢失（通过 metadata 透传）
- 修复当前的 mode 字段问题

### 方案 B: 完全重构（激进）

**让 PlanManager 完全不关心 Slate 内部结构**

```typescript
// PlanManager.tsx 只负责业务逻辑
function PlanManager() {
  const [events, setEvents] = useState<Event[]>([]);
  
  return (
    <UnifiedSlateEditor
      items={events}
      onChange={setEvents}
      // 其他业务配置
    />
  );
}
```

**UnifiedSlateEditor 负责**:
- Event ↔ Slate 转换
- Title/Description 分离
- 缩进处理
- 焦点管理

---

## 📊 对比分析

| 维度 | 当前架构 | 方案 A | 方案 B |
|------|---------|--------|--------|
| 代码行数 | ~2400 行 | ~1800 行 | ~1200 行 |
| 转换层数 | 3 层 | 1 层 | 1 层 |
| 字段丢失风险 | 高（手动复制） | 低（metadata 透传） | 低 |
| 维护成本 | 高 | 中 | 低 |
| 重构风险 | - | 低（渐进式） | 中（需大量测试） |

---

## 🚀 立即可执行的优化

### 临时修复（已完成）
✅ 添加 `mode` 字段到 items 传递（line 1810）

### 短期优化（1-2小时）
1. 移除 `editorLines`，改用 `editorItems`
2. 修改 `renderLinePrefix`/`renderLineSuffix` 使用 `element.metadata`
3. 删除 `FreeFormLine` 类型定义

### 长期重构（1天）
1. 将 PlanManager 拆分为：
   - `PlanManager` (业务逻辑)
   - `PlanEditor` (基于 UnifiedSlateEditor 的高级组件)
2. 统一数据流：EventService → PlanManager → UnifiedSlateEditor

---

## 💡 建议

**立即执行**: 方案 A（移除 editorLines）

**理由**:
1. 解决当前 mode 字段丢失问题的根本原因
2. 减少 500+ 行冗余代码
3. 降低未来字段丢失风险
4. 渐进式重构，风险可控

**不建议**: 继续维护当前架构
- 每次添加字段都要改 3 个地方
- FreeFormLine 完全是冗余层
- 数据流混乱，难以调试
