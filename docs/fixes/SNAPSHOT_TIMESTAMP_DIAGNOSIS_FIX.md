# Snapshot & Timestamp 系统诊断与修复报告

> **创建时间**: 2025-11-30  
> **问题类型**: Snapshot 数据丢失 + Timestamp 延迟/重叠  
> **影响范围**: Plan 页面保存、EventEditModal 加载历史内容

---

## 🔍 问题诊断

### 问题 1: Plan 页面新增内容未被 Snapshot 保存

**现象**:
- 用户在 Plan 页面重构后添加的内容（如高亮、颜色等富文本格式）
- 在 EventEditModal 打开时无法正确加载显示

**根本原因**:
```typescript
// ❌ serialization.ts L439: 只读取 TimeHub snapshot
const timeSnapshot = TimeHub.getSnapshot(baseId);

// ⚠️ 问题: TimeHub.getSnapshot() 只包含时间信息，不包含富文本内容
interface TimeGetResult {
  timeSpec?: TimeSpec;
  start: string | null;
  end: string | null | undefined;
}

// ❌ 缺失: 没有保存 title 的富文本格式（colorTitle）到 TimeHub
```

**数据流缺陷**:
```
Plan页面编辑富文本标题
  ↓
slateNodesToPlanItems (serialization.ts)
  ↓
只保存 fullTitle (Slate JSON)
  ↓
TimeHub.getSnapshot() - 无 title 数据
  ↓
EventEditModal 加载 - 丢失富文本格式 ❌
```

---

### 问题 2: Timestamp 插入延迟 + 与文本重叠

**现象**:
- EditModal 打开后，过去内容没有 timestamp
- 插入光标需要很长延时
- Timestamp 会和之前的文本重叠

**日志分析**:
```javascript
// ✅ ModalSlate 正确检测到需要插入
[ModalSlate] 聚焦时插入 timestamp（等待用户输入）

// ✅ TimestampService 正确创建
[TimestampService] 创建 timestamp 节点: {
  type: 'timestamp-divider',
  timestamp: '2025-11-29T18:03:35.749Z',  // ❌ 使用了 ISO 格式
  displayText: '2025-11-30 02:03:35',
  isFirstOfDay: true
}

// ⚠️ 插入位置有问题
[TimestampService] 插入位置: [1]  // 在第2个节点插入
[TimestampService] 光标已移动到新段落: [2, 0]  // 移动到第3个节点

// ❌ 已有内容变化检测
[ModalSlate] 解析内容为节点: {content: Array(3), nodes: Array(3)}
// 说明已有 3 个节点，但 timestamp 插入逻辑没有考虑已有内容
```

**根本原因**:
1. **时间格式错误**: `timestamp: '2025-11-29T18:03:35.749Z'` 违反 Time Architecture（应使用 `YYYY-MM-DD HH:mm:ss`）
2. **插入位置错误**: 在已有内容（3个节点）的情况下，插入到 `[1]` 导致覆盖/重叠
3. **历史内容无 timestamp**: 旧数据没有 timestamp，新打开时逻辑认为是"首次"

---

## 🛠️ 修复方案

### 修复 1: 增强 TimeHub Snapshot 包含标题

**方案 A: 扩展 TimeGetResult 接口（推荐）**

```typescript
// src/services/TimeHub.ts

// 🆕 扩展接口包含标题
interface TimeGetResult {
  timeSpec?: TimeSpec;
  start: string | null;
  end: string | null | undefined;
  title?: {
    fullTitle?: string;
    colorTitle?: string;
    simpleTitle?: string;
  };  // 🆕 添加标题字段
}

// 修改 getSnapshot 方法
getSnapshot(eventId: string): TimeGetResult {
  const event = EventService.getEventById(eventId);
  if (!event) {
    return { start: null, end: null };
  }
  
  return {
    timeSpec: event.timeSpec,
    start: event.startTime,
    end: event.endTime,
    title: event.title  // 🆕 返回完整标题对象
  };
}

// 修改 saveSnapshot 方法
saveSnapshot(eventId: string, data: { 
  start?: string; 
  end?: string; 
  timeSpec?: TimeSpec;
  title?: { fullTitle?: string; colorTitle?: string; simpleTitle?: string; };  // 🆕
}) {
  const event = EventService.getEventById(eventId);
  if (!event) return;
  
  await EventService.updateEvent(eventId, {
    startTime: data.start,
    endTime: data.end,
    timeSpec: data.timeSpec,
    title: data.title  // 🆕 同时保存标题
  });
}
```

**方案 B: 使用独立的 TitleSnapshot 服务**

```typescript
// src/services/TitleSnapshotService.ts

class TitleSnapshotService {
  private snapshots: Map<string, EventTitle> = new Map();
  
  saveTitle(eventId: string, title: EventTitle) {
    this.snapshots.set(eventId, title);
    // 持久化到 localStorage
    this.persist();
  }
  
  getTitle(eventId: string): EventTitle | null {
    return this.snapshots.get(eventId) || null;
  }
  
  private persist() {
    const data = Array.from(this.snapshots.entries());
    localStorage.setItem('remarkable-title-snapshots', JSON.stringify(data));
  }
}

export const titleSnapshotService = new TitleSnapshotService();
```

**推荐**: 方案 A - 直接扩展 TimeHub，保持数据一致性。

---

### 修复 2: Timestamp 时间格式修复

```typescript
// src/services/timestampService.ts

createTimestampDivider(eventId: string): TimestampDividerNode {
  // ❌ 旧代码
  const timestamp = new Date().toISOString();
  
  // ✅ 新代码 - 使用 Time Architecture 规范格式
  const timestamp = formatTimeForStorage(new Date());  // "YYYY-MM-DD HH:mm:ss"
  
  return {
    type: 'timestamp-divider',
    timestamp,
    displayText: formatTimestampForDisplay(timestamp),
    isFirstOfDay: this.isFirstEditOfDay(eventId),
    minutesSinceLast: this.getMinutesSinceLast(eventId),
    children: [{ text: '' }]
  };
}

// 🆕 添加显示格式化函数
function formatTimestampForDisplay(timestamp: string): string {
  // "2025-11-30 02:03:35" → "02:03"
  const [date, time] = timestamp.split(' ');
  const [hour, minute] = time.split(':');
  return `${hour}:${minute}`;
}
```

---

### 修复 3: Timestamp 插入位置智能检测

```typescript
// src/services/timestampService.ts

insertTimestamp(
  editor: Editor,
  timestampNode: TimestampDividerNode,
  eventId: string
): void {
  Transforms.select(editor, []);  // 清除选区

  const hasContent = editor.children.length > 0 && 
    editor.children.some(node => {
      if ('type' in node && node.type === 'timestamp-divider') return false;
      const text = Node.string(node);
      return text.trim().length > 0;
    });

  if (!hasContent) {
    // ✅ 空编辑器 - 插入到开头
    Transforms.insertNodes(editor, [timestampNode, createEmptyParagraph()], { at: [0] });
    Transforms.select(editor, [1, 0]);  // 光标移到空段落
  } else {
    // ✅ 已有内容 - 找到最后一个实际内容节点，插入到其后
    let lastContentIndex = editor.children.length - 1;
    
    // 跳过末尾的空段落
    while (lastContentIndex >= 0) {
      const node = editor.children[lastContentIndex];
      if ('type' in node && node.type === 'timestamp-divider') {
        lastContentIndex--;
        continue;
      }
      const text = Node.string(node);
      if (text.trim().length > 0) break;
      lastContentIndex--;
    }
    
    const insertIndex = lastContentIndex + 1;
    Transforms.insertNodes(
      editor,
      [timestampNode, createEmptyParagraph()],
      { at: [insertIndex] }
    );
    Transforms.select(editor, [insertIndex + 1, 0]);  // 光标移到新段落
  }

  // 🆕 强制滚动到光标位置
  setTimeout(() => {
    const el = ReactEditor.toDOMNode(editor, editor);
    const selection = window.getSelection();
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0);
      range.startContainer.parentElement?.scrollIntoView({ 
        block: 'nearest', 
        behavior: 'smooth' 
      });
    }
  }, 50);

  this.updateLastEditTime(eventId);
}
```

---

### 修复 4: 历史内容 Timestamp 补全

```typescript
// src/components/ModalSlate/ModalSlate.tsx

useEffect(() => {
  if (!enableTimestamp || !content) return;
  
  // 🆕 检查历史内容是否缺少 timestamp
  const hasTimestamp = content.some((node: any) => 
    node.type === 'timestamp-divider'
  );
  
  if (!hasTimestamp && content.length > 0) {
    // 历史内容缺少 timestamp，补充一个
    const event = EventService.getEventById(parentEventId);
    if (event && event.createdAt) {
      console.log('[ModalSlate] 🔧 为历史内容补充初始 timestamp');
      
      const initialTimestamp = {
        type: 'timestamp-divider',
        timestamp: event.createdAt,  // 使用事件创建时间
        displayText: formatTimestampForDisplay(event.createdAt),
        isFirstOfDay: true,
        children: [{ text: '' }]
      };
      
      // 插入到开头
      Transforms.insertNodes(editor, [initialTimestamp], { at: [0] });
    }
  }
}, [content, enableTimestamp, parentEventId, editor]);
```

---

## ✅ 实施步骤

### Step 1: 扩展 TimeHub (高优先级) ✅ 已完成

1. ✅ 修改 `loadFromEventService()` 返回完整标题
2. ⏳ 需要验证：serialization.ts 是否正确使用 title 字段

**已修改文件**:
- `src/services/TimeHub.ts` - L124 添加 `title` 返回

### Step 2: 修复 Timestamp 格式 (高优先级) ✅ 已完成

1. ✅ 修改 `timestampService.ts` 使用 `formatDateTime()`
2. ✅ 移除 `.toISOString()` 调用（2处）
3. ✅ 使用 Time Architecture 规范格式 "YYYY-MM-DD HH:mm:ss"

**已修改文件**:
- `src/components/SlateCore/services/timestampService.ts` - L121 createTimestampDivider
- `src/components/ModalSlate/ModalSlate.tsx` - L318 initialValue 中的 timestamp 创建

### Step 3: 优化 Timestamp 插入逻辑 (中优先级)

1. 修改 `insertTimestamp()` 智能检测已有内容
2. 添加末尾空段落跳过逻辑
3. 添加自动滚动到光标位置

### Step 4: 历史内容补全 (低优先级)

1. 添加历史内容 timestamp 检测
2. 使用 `event.createdAt` 补充初始 timestamp

---

## 🧪 测试验证

### 测试场景 1: 富文本标题保存

```
1. 在 Plan 页面创建事件
2. 标题添加高亮、颜色
3. 保存并关闭
4. 重新打开 EventEditModal
5. ✅ 验证标题保留富文本格式
```

### 测试场景 2: Timestamp 不重叠

```
1. 打开已有内容的事件
2. 聚焦 EventLog 编辑器
3. ✅ 验证 timestamp 插入到内容末尾
4. ✅ 验证光标自动定位到新段落
5. ✅ 验证没有文本重叠
```

### 测试场景 3: 时间格式正确

```
1. 插入 timestamp
2. ✅ 验证存储格式: "2025-11-30 02:03:35"
3. ✅ 验证显示格式: "02:03"
4. ❌ 确认无 ISO 格式 (不应有 'T' 或 'Z')
```

---

## 📋 后续优化

1. **Snapshot 定期清理**: 实现 `snapshotService.cleanupOldSnapshots(30)` 定期清理
2. **CRDT 合并优化**: 优化 Yjs CRDT 状态合并性能
3. **Timestamp 间隔可配置**: 允许用户配置 5 分钟间隔
4. **离线编辑支持**: 增强离线编辑时的 snapshot 机制

---

## 🔗 相关文档

- [TIME_ARCHITECTURE.md](../TIME_ARCHITECTURE.md) - 时间格式规范
- [EVENTHUB_TIMEHUB_ARCHITECTURE.md](../architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md) - TimeHub 架构
- [NULL_TIME_FIELD_AUDIT_REPORT.md](../audits/NULL_TIME_FIELD_AUDIT_REPORT.md) - 时间字段审计
