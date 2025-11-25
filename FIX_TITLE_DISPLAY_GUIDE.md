# TimeCalendar 标题显示空白问题 - 修复指南

## 🔍 问题诊断

### 症状
- TimeCalendar 中所有事件标题显示为空白
- 即使是本地新创建的事件也显示空白
- Plan 页面可能正常显示

### 根本原因
1. **代码问题**（已修复 ✅）
   - `calendarUtils.convertToCalendarEvent` 中 `displayTitle` 初始化为 `event.title` 对象
   - 某些代码分支没有将其转换为字符串
   - TUI Calendar 期望字符串，但收到了对象
   - `EventService.normalizeTitle` 对空 EventTitle 对象处理不完整

2. **数据问题**（需要手动修复 ⏳）
   - localStorage 中的事件可能有以下格式错误：
     - `title: "字符串"` → 应该是 `{ simpleTitle: "...", colorTitle: "...", fullTitle: "..." }`
     - `title: { simpleTitle: undefined, colorTitle: undefined, fullTitle: undefined }` → 空对象
     - `title: undefined` → 完全缺失

## 🛠️ 修复步骤

### 步骤 1: 诊断数据问题

在浏览器控制台运行：
```javascript
// 加载诊断脚本
const script = document.createElement('script');
script.src = 'diagnose-title-flow.js';
document.head.appendChild(script);

// 等待加载完成后，会自动输出诊断结果
```

### 步骤 2: 修复数据（推荐）

在浏览器控制台运行：
```javascript
// 加载修复脚本
const script = document.createElement('script');
script.src = 'fix-all-titles.js';
document.head.appendChild(script);

// 等待加载完成后运行：
window.fixAllTitleIssues();

// 输出示例：
// ✅ 总共修复: 1196 个事件
//   - String → Object: 1196
//   - 空对象填充: 0
//   - 缺失 simpleTitle: 0
```

### 步骤 3: 刷新页面

```javascript
location.reload();
```

### 步骤 2（备选）: 清空数据重新开始

⚠️ **警告：此操作会删除所有本地事件数据！**

如果你的数据已经完全损坏，或者你不介意重新开始：

```javascript
// 清空所有事件
localStorage.removeItem('EVENTS');

// 刷新页面
location.reload();
```

## 📊 修复脚本说明

### `fix-all-titles.js`

自动修复三种常见的数据格式错误：

1. **String → Object**
   ```javascript
   // 修复前
   { title: "会议标题" }
   
   // 修复后
   { 
     title: {
       simpleTitle: "会议标题",
       colorTitle: "会议标题",
       fullTitle: '[{"type":"paragraph","children":[{"text":"会议标题"}]}]'
     }
   }
   ```

2. **空对象填充**
   ```javascript
   // 修复前
   { title: { simpleTitle: undefined, colorTitle: undefined, fullTitle: undefined } }
   
   // 修复后
   { 
     title: {
       simpleTitle: "",
       colorTitle: "",
       fullTitle: '[{"type":"paragraph","children":[{"text":""}]}]'
     }
   }
   ```

3. **缺失 simpleTitle**
   ```javascript
   // 修复前
   { title: { colorTitle: "<span>标题</span>", fullTitle: "[...]" } }
   
   // 修复后
   { 
     title: {
       simpleTitle: "标题",  // 从 colorTitle 提取
       colorTitle: "<span>标题</span>",
       fullTitle: "[...]"
     }
   }
   ```

### `diagnose-title-flow.js`

分析整个数据流：localStorage → EventService → TimeCalendar

输出示例：
```
========== STEP 1: LocalStorage 数据检查 ==========
✅ 总事件数: 1196
📊 前 5 个事件的 title 结构:
[0] outlook-AAMk...: { titleType: "string", title: "📊深度行研", ... }
[1] timer-notag-...: { titleType: "string", title: "专注计时2025-11-16 14:40:59", ... }

📈 Title 类型统计:
{
  stringType: 1196,
  objectType: 0,
  undefined: 0,
  objectWithSimpleTitle: 0,
  objectWithoutSimpleTitle: 0
}

========== STEP 2: EventService 读取检查 ==========
EventService.getAllEvents() 返回: 1196 个事件

========== STEP 3: TimeCalendar 显示检查 ==========
检查 calendarUtils.convertToCalendarEvent 使用的字段

========== 建议 ==========
⚠️ 发现格式错误的数据:
  - String 类型 title: 1196
  - 没有 simpleTitle 的对象: 0

💡 建议清空并重新创建数据:
  localStorage.removeItem("EVENTS");
  location.reload();
```

## ✅ 验证修复

修复完成后，在 TimeCalendar 中检查：

1. **周视图/日视图** - 事件标题正常显示
2. **月视图** - 事件标题正常显示
3. **新建事件** - 标题正常保存和显示
4. **计时事件** - "[专注中]" 前缀正常显示
5. **Outlook 同步事件** - 标题正常显示

## 🔧 代码修复详情

### 已修复的文件

1. **calendarUtils.ts**
   - `convertToCalendarEvent` 函数中 `displayTitle` 类型修正
   - 确保传递给 TUI Calendar 的 title 始终是字符串

2. **EventService.ts**
   - `normalizeTitle` 函数增加边界情况处理
   - 自动处理字符串类型的 title（向后兼容）

3. **MicrosoftCalendarService.ts**
   - Outlook 同步时直接创建 EventTitle 对象

4. **ActionBasedSyncManager.ts**
   - 远程事件转换时直接创建 EventTitle 对象

5. **TimeCalendar.tsx**
   - 新建事件时使用 EventTitle 对象
   - 实时计时事件使用 EventTitle 对象

## 🎯 预防措施

未来创建事件时，请确保：

1. ✅ 使用 `EventService.createEvent()` 或 `EventService.updateEvent()`
2. ✅ 传入的 title 可以是字符串或 EventTitle 对象（自动转换）
3. ✅ 不要直接修改 localStorage（使用 EventService API）

## 📞 问题反馈

如果修复后仍然有问题，请提供：
1. 浏览器控制台的完整输出（运行诊断脚本）
2. localStorage 中的事件数据样本（匿名化）
3. 复现步骤

---
**最后更新**: 2025-11-25
**修复版本**: v2.14+
