# EventTitle 架构重构后的显示问题诊断报告

## 📋 诊断目标

分析 EventTitle 重构（v2.14）后，TimeCalendar 和 EventEditModal 无法正确显示事件标题的根本原因。

---

## 🏗️ EventTitle 架构回顾

### 类型定义
```typescript
interface EventTitle {
  fullTitle?: string;    // Slate JSON - PlanSlate 使用
  colorTitle?: string;   // HTML - UpcomingPanel/EditModal 使用
  simpleTitle?: string;  // 纯文本 - TimeCalendar/搜索/同步使用
}

interface Event {
  title: EventTitle;  // ✅ v2.14 - 从 string 改为对象
}
```

### 转换机制
- **EventService.normalizeTitle()**: 自动填充缺失的层级
- **组件职责**: 
  - TimeCalendar 读取 `title.simpleTitle`
  - EventEditModalV2 读写 `title.colorTitle`
  - PlanSlate 读写 `title.fullTitle`

---

## 🔍 诊断结果

### ✅ 已正确实现的部分

#### 1. TimeCalendar (src/features/Calendar/TimeCalendar.tsx)
- ✅ Line 1400: `e.title?.simpleTitle?.startsWith('[专注中]')` - Timer 前缀检查
- ✅ Line 1904: `!updatedEvent.title || !updatedEvent.title.simpleTitle?.trim()` - 空标题检查
- ✅ Line 1911: 创建新 EventTitle 对象 `{ simpleTitle: tagTitle, colorTitle: undefined, fullTitle: undefined }`
- ✅ Line 2563, 2609: `const title = event.title?.simpleTitle || '';` - 提取 simpleTitle 显示

**结论**: TimeCalendar 已完全适配 EventTitle 架构 ✅

#### 2. EventEditModalV2 (src/components/EventEditModal/EventEditModalV2.tsx)
- ✅ Line 220: 初始化 `title: event.title?.colorTitle || event.title?.simpleTitle || ''`
- ✅ Line 404: `let finalTitle = formData.title;` - formData.title 是字符串（存储 colorTitle）
- ✅ Line 823: 重新打开时使用 `event.title?.colorTitle || event.title?.simpleTitle || ''`

**formData 设计**:
```typescript
interface MockEvent {
  title: string;  // ✅ 正确 - 存储 colorTitle 字符串用于表单编辑
  // ...
}
```

**结论**: EventEditModalV2 的 formData.title 设计是正确的（字符串类型），用于表单输入 ✅

---

### ⚠️ 潜在问题点

#### 1. calendarUtils.ts - convertToCalendarEvent()

**当前实现** (Line 312):
```typescript
let displayTitle: string = event.title?.simpleTitle || '';
```

**问题分析**:
- ✅ **正确提取** `simpleTitle` 用于 TUI Calendar 显示
- ✅ 后续逻辑正确处理 displayTitle（添加"[专注中]"前缀、使用 displayHint）

**结论**: 此处实现正确 ✅

#### 2. calendarUtils.ts - convertFromCalendarEvent()

**当前实现** (Line 372):
```typescript
// 情况1: 有原始事件数据
return {
  ...calendarEvent.raw.remarkableEvent,
  title: calendarEvent.title 
    ? { simpleTitle: calendarEvent.title, colorTitle: undefined, fullTitle: undefined } 
    : calendarEvent.raw.remarkableEvent.title,
  // ...
};

// 情况2: 创建新事件
return {
  title: { simpleTitle: calendarEvent.title || '(无标题)', colorTitle: undefined, fullTitle: undefined },
  // ...
};
```

**问题分析**:
- ✅ **正确创建** EventTitle 对象
- ❓ **潜在优化**: 当 `calendarEvent.title` 存在时，是否应该保留原 `colorTitle` 和 `fullTitle`？

**当前逻辑**:
- 如果 TUI Calendar 的 title 改变 → 清空 colorTitle 和 fullTitle
- 如果 TUI Calendar 的 title 未改变 → 保留原 EventTitle

**结论**: 逻辑合理，但可能导致富文本信息丢失（设计决策问题）⚠️

#### 3. EventEditModalV2 - 保存逻辑

**需要检查的关键点**:
- formData.title (字符串) → Event.title (EventTitle 对象) 的转换

让我查看 handleSave 函数中 title 的处理：

**Line 404-414**:
```typescript
let finalTitle = formData.title;
if (!finalTitle || finalTitle.trim() === '') {
  if (formData.tags && formData.tags.length > 0) {
    const flatTags = TagService.getFlatTags();
    const tag = flatTags.find(t => t.id === formData.tags[0]);
    if (tag) {
      finalTitle = tag.emoji ? `${tag.emoji} ${tag.name}` : tag.name;
    }
  }
}
```

**❓ 问题**: 
- `finalTitle` 是字符串（colorTitle）
- 保存时需要转换为 EventTitle 对象
- **但代码中没有显示这个转换逻辑**

**需要确认**:
1. handleSave() 中是否调用了 EventHub.createEvent() 或 EventHub.updateFields()
2. 传递的 title 参数是字符串还是 EventTitle 对象
3. EventHub/EventService 是否自动调用 normalizeTitle()

---

## 🎯 需要进一步检查的代码

### 1. EventEditModalV2.tsx - handleSave() 完整逻辑
```typescript
// 需要查看 Line 450-550 区域
// 确认 title 如何传递给 EventHub
```

### 2. EventHub - createEvent() / updateFields()
```typescript
// 确认是否自动调用 EventService.normalizeTitle()
// 确认 title 参数类型（string | EventTitle）
```

### 3. PlanManager.tsx - 创建事件逻辑
```typescript
// 您提到 "Planmanager用slate创建的都是json格式title"
// 需要确认：
// - Line 1155, 2132 创建事件时的 title 格式
// - 是否使用 fullTitle (Slate JSON) 而非 simpleTitle
```

---

## 📊 诊断结论

### 已验证正确的部分 ✅
1. **TimeCalendar**: 完全适配 EventTitle，正确使用 `title.simpleTitle`
2. **EventEditModalV2 formData**: 设计合理，使用字符串存储 colorTitle
3. **calendarUtils 读取**: `convertToCalendarEvent()` 正确提取 simpleTitle

### 需要进一步验证的部分 ❓
1. **EventEditModalV2 保存**: 字符串 title → EventTitle 对象的转换逻辑
2. **PlanManager**: Slate JSON title 的创建和传递
3. **EventHub/EventService**: normalizeTitle() 的自动调用机制

### 可能的显示问题根源 🎯
1. **保存时未正确转换**: formData.title (string) 保存时没有包装成 EventTitle 对象
2. **normalizeTitle() 未执行**: 创建/更新事件时没有自动填充缺失的层级
3. **Slate JSON title 处理**: PlanManager 创建的事件使用了错误的 title 格式

---

## ✅ 最终验证结果

### EventEditModalV2 - handleSave() (Line 523)
```typescript
title: { colorTitle: finalTitle, simpleTitle: undefined, fullTitle: undefined },
```

**验证结论**: ✅ **实现正确**
- EventEditModalV2 只需要设置 `colorTitle`
- EventService.createEvent() 会自动调用 `normalizeTitle()` (Line 312)
- normalizeTitle() 场景2 会自动生成 `simpleTitle` 和 `fullTitle`

### EventService.normalizeTitle() - 场景2 (Line 1325-1339)
```typescript
// 场景 2: 只有 colorTitle → 升级生成 fullTitle，降级生成 simpleTitle
else if (colorTitle && !fullTitle && !simpleTitle) {
  result.colorTitle = colorTitle;
  result.simpleTitle = this.colorTitleToSimpleTitle(colorTitle);  // ✅ 自动生成
  result.fullTitle = this.simpleTitleToFullTitle(result.simpleTitle);
}
```

**验证结论**: ✅ **转换机制完善**
- colorTitle (HTML) → simpleTitle (纯文本)
- simpleTitle → fullTitle (Slate JSON)
- 所有字段自动填充

---

## 🎯 真正的问题所在

### 如果 TimeCalendar 和 EventEditModal 显示空白，问题**不在架构层面**，而可能在：

### 1. 浏览器缓存问题
- ❓ localStorage 中的旧事件可能仍使用 `title: string` 格式
- ❓ 需要清除缓存或运行迁移脚本

### 2. 转换函数问题
需要检查以下函数是否正确实现：
- `EventService.colorTitleToSimpleTitle()` - HTML → 纯文本
- `EventService.simpleTitleToFullTitle()` - 纯文本 → Slate JSON
- `EventService.fullTitleToColorTitle()` - Slate JSON → HTML

### 3. 事件创建流程问题
- ❓ PlanManager 使用 Slate JSON 创建事件时，是否直接设置了 `fullTitle`？
- ❓ 如果是，normalizeTitle() 应该走场景1（fullTitle → colorTitle + simpleTitle）

---

## 🔧 建议的调试步骤

### 步骤 1: 检查 localStorage 中的实际数据
```javascript
// 在浏览器控制台运行
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
console.log('所有事件的 title 字段:', events.map(e => ({
  id: e.id,
  title: e.title
})));
```

**预期结果**:
- 新事件: `title: { simpleTitle: '...', colorTitle: '...', fullTitle: '...' }`
- 旧事件: `title: "字符串"` 或 `title: { simpleTitle: undefined, ... }`

### 步骤 2: 检查转换函数的输出
```javascript
// 测试 normalizeTitle()
const testTitle = { colorTitle: '<b>测试标题</b>', simpleTitle: undefined, fullTitle: undefined };
// 在 EventService.createEvent() 中打断点，查看 normalizedTitle 的值
```

### 步骤 3: 检查 PlanManager 的事件创建
- 找到 Line 1155, 2132（您提到的创建新事件位置）
- 确认 title 字段的格式：
  - 如果是 `fullTitle: '[{"type":"paragraph",...]'` → 应该走场景1
  - 如果是 `title: ''` → **这就是问题！** 应该是 `title: { fullTitle: '...', ... }`

### 步骤 4: 运行数据迁移（如果需要）
```typescript
// 如果 localStorage 中有旧格式数据，运行迁移脚本
const events = EventService.getAllEvents();
events.forEach(event => {
  if (typeof event.title === 'string') {
    // 旧格式：title 是字符串
    EventService.updateEvent(event.id, {
      ...event,
      title: {
        simpleTitle: event.title,
        colorTitle: event.title,
        fullTitle: undefined
      }
    });
  }
});
```

---

## 📊 最终诊断结论

### ✅ 架构层面：完全正确
1. EventTitle 三层架构设计合理
2. normalizeTitle() 自动转换机制完善
3. EventEditModalV2 实现正确
4. TimeCalendar 读取逻辑正确
5. calendarUtils 转换逻辑正确

### ❓ 可能的实际问题
1. **localStorage 数据迁移不完整** - 旧事件仍使用 `title: string`
2. **转换函数实现有 Bug** - colorTitleToSimpleTitle() 返回空字符串
3. **PlanManager 创建逻辑错误** - 直接使用 `title: ''` 而非 EventTitle 对象

### 🎯 下一步行动
**请提供以下信息**（不要我修改代码，只需要诊断）：
1. 浏览器控制台运行步骤1的代码，发送输出结果
2. PlanManager Line 1155, 2132 的代码内容
3. EventService 的转换函数实现（colorTitleToSimpleTitle, simpleTitleToFullTitle）

有了这些信息，我就能精确定位问题根源！
