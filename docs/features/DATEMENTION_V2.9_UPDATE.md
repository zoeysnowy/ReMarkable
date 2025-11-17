# DateMention v2.9 功能更新文档

**更新日期**: 2025-11-17  
**版本**: v2.9  
**状态**: ✅ 已实现

---

## 📋 更新概览

本次更新对 DateMention 组件进行了全面优化，包括：
1. **过期检测与悬浮卡片**：支持时间差异提示和一键更新
2. **"大后天"支持**：相对日期格式化引擎增强
3. **时间类型标识**：区分"开始"、"结束"、"截止"
4. **智能时间显示**：悬浮卡片与列表显示的差异化处理

---

## 🎯 核心功能

### 1. 过期检测与悬浮卡片

#### 功能描述
当 DateMention 引用的时间与 TimeHub 中的实际时间不一致时，自动标记为过期状态，并在鼠标悬浮时显示详细的差异提示卡片。

#### 实现原理
```typescript
// 1. 实时过期检测（依赖 TimeHub 订阅）
const isOutdated = useMemo(() => {
  // 优先使用节点的 isOutdated 标记
  if (dateMentionElement.isOutdated) return true;
  
  // 实时计算：对比 DateMention 时间 vs TimeHub 时间
  return isDateMentionOutdated(
    dateMentionElement.startDate, // DateMention 存储的时间
    start,                         // TimeHub 的当前时间
    dateMentionElement.endDate,
    end
  );
}, [start, end, dateMentionElement.startDate, dateMentionElement.endDate]);

// 2. 时间差异计算
const timeDiff = useMemo(() => {
  const mentionTime = dateMentionElement.startDate || dateMentionElement.endDate;
  const hubTime = start || end;
  
  // 参数顺序：hubTime 在前（原始时间），mentionTime 在后（当前时间）
  // direction='earlier' → TimeHub 提前了
  // direction='later' → TimeHub 延后了
  return calculateTimeDiff(hubTime, mentionTime);
}, [start, end, dateMentionElement.startDate, dateMentionElement.endDate]);
```

#### 悬浮卡片设计规范（Figma）
- **宽度**: 200px
- **圆角**: 20px
- **内边距**: 20px
- **阴影**: `0px 4px 10px 0px rgba(0,0,0,0.25)`
- **字体**: 13.8px / 500 weight
- **颜色**: 
  - 主文本: `#374151`
  - 链接: `#767676` (hover: `#999`)
  - 警告: `#dc2626`

#### 悬浮卡片内容结构
```
🚧 当前时间已[提前/延后]了2天
   是否更新提及时间为

📅 2025-11-20（周四）
   3天后 16:30 开始

[取消]  [删除]  [更新]
```

#### 三个操作按钮
| 按钮 | 功能 | 实现 |
|------|------|------|
| **取消** | 关闭悬浮卡片，保持 DateMention 不变 | `handleCancel()` |
| **删除** | 移除 DateMention 节点 | `handleRemove()` |
| **更新** | 同步 DateMention 时间到 TimeHub | `handleUpdateToCurrentTime()` |

```typescript
// 更新操作：同步到 TimeHub 的最新时间
const handleUpdateToCurrentTime = async () => {
  Transforms.setNodes(editor, {
    startDate: start,       // TimeHub 的当前时间
    endDate: end || start,
    isOutdated: false,      // 清除过期标记
    originalText: undefined, // 强制重新格式化
  }, { at: path });
};
```

---

### 2. "大后天"相对日期支持

#### 功能描述
`formatRelativeDate` 函数现在支持"大后天"（daysDiff = 3），避免显示"周X"造成的重复。

#### 更新代码
```typescript
// relativeDateFormatter.ts
export function formatRelativeDate(targetDate: Date, today: Date = new Date()): string {
  const daysDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  
  // 优先级 1: 核心口语
  if (daysDiff === 0) return "今天";
  if (daysDiff === 1) return "明天";
  if (daysDiff === -1) return "昨天";
  
  // 优先级 2: 本周范围
  if (daysDiff === 2) return "后天";
  if (daysDiff === 3) return "大后天"; // 🆕 新增
  
  // 其余逻辑...
}
```

#### 优先级规则
| 天数差 | 显示文本 | 说明 |
|--------|---------|------|
| 0 | 今天 | - |
| 1 | 明天 | - |
| -1 | 昨天 | - |
| 2 | 后天 | - |
| **3** | **大后天** | 🆕 新增 |
| 4-6 | 周X | 如"周五"（本周范围内） |
| 7+ | 下周X | 如"下周一" |

---

### 3. 时间类型标识（开始/结束/截止）

#### 功能描述
在列表显示（EventLineSuffix）中，根据时间类型自动添加颜色标识：
- **开始**：绿色 `#10b981`
- **结束**：深灰色 `#4b5563`
- **截止**：深红色 `#dc2626`

#### 判断逻辑
```typescript
// EventLineSuffix.tsx
let timeLabel = null;
let timeLabelColor = '#6b7280';

if (startTimeStr && endTimeStr && startTimeStr !== endTimeStr) {
  // 有时间段：显示"结束"
  timeLabel = '结束';
  timeLabelColor = '#4b5563'; // 深灰色
} else if (startTimeStr && (!endTimeStr || startTimeStr === endTimeStr)) {
  // 单一时间：根据 isDeadline 显示"开始"或"截止"
  if (isDeadline) {
    timeLabel = '截止';
    timeLabelColor = '#dc2626'; // 深红色
  } else {
    timeLabel = '开始';
    timeLabelColor = '#10b981'; // 绿色
  }
}
```

#### 显示效果
```
今天 13:00 开始     (绿色)
今天 14:00 - 15:00 结束   (深灰色)
明天 18:00 截止     (深红色)
```

---

### 4. 智能时间显示差异化

#### 悬浮卡片 vs 列表显示
为避免信息重复，悬浮卡片第二行的时间显示进行了优化：

| 场景 | 第一行 | 第二行（优化前） | 第二行（优化后） |
|------|--------|----------------|----------------|
| 本周范围 | 2025-11-20（**周四**） | **周四** 16:30 开始 | **3天后** 16:30 开始 |
| 跨周 | 2025-11-25（周二） | 下周二 10:00 开始 | 下周二 10:00 开始 |

#### 实现代码
```typescript
// 悬浮卡片第二行时间显示
let relativeText = formatRelativeDate(date);

if (relativeText.startsWith('周')) {
  // 如果是"周X"格式，改为"X天后/前"
  const now = new Date();
  const daysDiff = Math.round((startOfDate.getTime() - startOfToday.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysDiff > 0) {
    relativeText = `${daysDiff}天后`;
  } else if (daysDiff < 0) {
    relativeText = `${Math.abs(daysDiff)}天前`;
  }
}

return relativeText + ' ' + timeStr + suffix;
```

---

### 5. 显示文本自动更新

#### 问题修复
之前点击"更新"按钮后，DateMention 只显示日期，没有显示时间。

#### 修复方案
在 `displayText` 计算逻辑中，使用 `formatRelativeTimeDisplay` 替代 `formatRelativeDate`：

```typescript
// DateMentionElement.tsx
const displayText = useMemo(() => {
  // ... 其他逻辑
  
  if (primaryTime) {
    // 🔧 使用 formatRelativeTimeDisplay 显示完整时间
    const displayText = formatRelativeTimeDisplay(
      start || null,
      (start && end && start !== end) ? end : null,
      false, // isAllDay
      null   // dueDate
    );
    return displayText || formatRelativeDate(new Date(primaryTime));
  }
  
  return null;
}, [start, end, dateMentionElement.originalText, ...]);
```

#### 效果对比
| 场景 | 修复前 | 修复后 |
|------|--------|--------|
| 更新后 | 明天 | 明天 14:30 |
| 时间段 | 后天 | 后天 09:00 - 10:00 |

---

## 🔧 技术细节

### 依赖关系
```
DateMentionElement
  ├── useEventTime(eventId)        // TimeHub 订阅
  ├── EventService.getEventById()  // 获取 isDeadline
  ├── formatRelativeDate()         // 日期格式化
  ├── formatRelativeTimeDisplay()  // 时间显示
  ├── calculateTimeDiff()          // 时间差异计算
  └── isDateMentionOutdated()      // 过期判断
```

### 数据流
```
TimeHub.setEventTime()
  ↓
TimeHub.emit(eventId)
  ↓
useEventTime() 收到通知
  ↓
DateMentionElement 重新渲染
  ↓
isOutdated useMemo 重新计算
  ↓
显示过期状态 + 悬浮卡片
```

### 关键钩子依赖
```typescript
// isOutdated 依赖项
useMemo(..., [
  start,                      // TimeHub 的 start
  end,                        // TimeHub 的 end
  dateMentionElement.startDate,  // 节点的 startDate
  dateMentionElement.endDate,    // 节点的 endDate
  dateMentionElement.isOutdated, // 节点的过期标记
  eventId
]);
```

---

## 📊 性能优化

### React.memo 优化
```typescript
export default React.memo(DateMentionElementComponent, (prevProps, nextProps) => {
  const prevElement = prevProps.element as DateMentionNode;
  const nextElement = nextProps.element as DateMentionNode;
  
  const isSame = (
    prevElement.startDate === nextElement.startDate &&
    prevElement.endDate === nextElement.endDate &&
    prevElement.eventId === nextElement.eventId &&
    prevElement.isOutdated === nextElement.isOutdated &&
    prevElement.originalText === nextElement.originalText
  );
  
  return isSame; // true = 不重新渲染
});
```

### 避免不必要的重新渲染
- ✅ 只有时间相关属性变化时才重新渲染
- ✅ `useEventTime` 使用 `useSyncExternalStore` 高效订阅
- ✅ `useMemo` 缓存计算结果

---

## 🎨 UI/UX 改进

### 1. 视觉反馈
- **正常状态**: 默认样式
- **过期状态**: 橙色/红色背景
- **悬浮状态**: 显示详细卡片
- **时间类型**: 颜色标签（绿/灰/红）

### 2. 交互优化
- **Tippy.js**: 替代 Ant Design Popover（解决 contentEditable 冲突）
- **悬浮延迟**: 避免误触
- **点击关闭**: 点击外部自动关闭

### 3. 信息层次
- **第一行**: 完整日期 + 星期
- **第二行**: 相对时间 + 具体时间 + 类型标签
- **操作区**: 三个明确的操作按钮

---

## 🚀 使用示例

### 基础用法
```typescript
// 插入 DateMention
insertDateMention(editor, {
  eventId: 'event-123',
  startDate: '2025-11-20 16:30:00',
  endDate: null,
  originalText: '大后天下午4点半'
});
```

### 更新时间
```typescript
// 用户在 TimeHub 修改时间后，DateMention 自动检测差异
// 用户鼠标悬浮时显示：
// 🚧 当前时间已延后了2天
//    是否更新提及时间为
// 📅 2025-11-22（周六）
//    5天后 16:30 开始
// [取消] [删除] [更新]
```

---

## 📝 测试场景

### 1. 过期检测
- [ ] 修改 TimeHub 时间后，DateMention 显示为过期状态
- [ ] 悬浮显示正确的时间差异（提前/延后）
- [ ] 点击"更新"后，DateMention 同步到最新时间

### 2. 相对日期
- [ ] 今天、明天、昨天显示正确
- [ ] 后天、大后天显示正确
- [ ] 本周范围内显示"周X"
- [ ] 下周范围显示"下周X"

### 3. 时间类型
- [ ] 单一时间显示"开始"（绿色）
- [ ] 时间段显示"结束"（深灰色）
- [ ] 截止日期显示"截止"（深红色）

### 4. 悬浮卡片
- [ ] 第一行显示完整日期
- [ ] 第二行避免重复（周X → X天后）
- [ ] 三个按钮功能正确

---

## 🔄 版本历史

| 版本 | 日期 | 更新内容 |
|------|------|---------|
| v2.9 | 2025-11-17 | 完整功能实现 |
| v2.8 | 2025-11-16 | 过期检测与悬浮卡片 |
| v2.7 | 2025-11-15 | Tippy.js 迁移 |
| v2.6 | 2025-11-14 | 时间类型标识 |

---

## 📚 相关文档

- [TIME_PICKER_AND_DISPLAY_PRD.md](../PRD/TIME_PICKER_AND_DISPLAY_PRD.md) - 时间选择与显示规范
- [SLATE_EDITOR_PRD.md](../PRD/SLATE_EDITOR_PRD.md) - Slate 编辑器架构
- [EVENTHUB_TIMEHUB_ARCHITECTURE.md](../architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md) - TimeHub 架构设计

---

## 🐛 已知问题

无

---

## 💡 未来改进

1. **批量更新**: 支持一次性更新多个过期的 DateMention
2. **快捷键**: 添加键盘快捷键（如 `Alt+U` 更新）
3. **自定义格式**: 支持用户自定义相对日期格式
4. **国际化**: 支持多语言（英文、日文等）

---

**文档维护者**: GitHub Copilot  
**最后更新**: 2025-11-17
