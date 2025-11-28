# EventTitle 三层架构导致的事件保存失败 - 修复报告

> **日期**: 2025-11-28  
> **严重程度**: 🔴 Critical（所有事件编辑无法保存）  
> **影响范围**: Plan 页面、Review 模式、页面切换  
> **修复状态**: ✅ 已完成  
> **相关提交**: c6d5535

---

## 问题现象

用户报告：
1. 编辑 7 个事件后，进入 Review 模式再退出，所有内容被清空
2. 切换页面后返回，编辑的内容全部丢失
3. 之前的 Plan 页面不会出现此问题

**核心表现**：所有事件编辑操作无法持久化保存。

---

## 问题诊断

### 1. 时间线分析

通过 `git log` 发现最近一周有大量 title 字段相关提交：

```bash
83e20b1 fix(EventHub): 修复所有 EventHub 调用中的 title 字段传递
586b22c fix(PlanManager): 修复所有 title 字符串赋值问题 - 统一使用 EventTitle 格式
89a4e3e fix(Title): 修复所有事件标题显示空白的根本问题
88827d0 fix: 系统性修复所有 title 字段类型错误
```

**关键变更**：v2.14 EventTitle 三层架构重构
- `Event.title` 从 `string` 改为 `EventTitle` 对象
- 包含三个层级：`fullTitle` (Slate JSON) / `colorTitle` (HTML) / `simpleTitle` (纯文本)

### 2. 根本原因定位

#### 原因 1：序列化层的空节点过滤逻辑错误

**位置**：`src/components/UnifiedSlateEditor/serialization.ts` L569-575

```typescript
// ❌ 错误代码
const result = Array.from(items.values()).filter(item => {
  const isEmpty = !item.title?.simpleTitle?.trim() &&  // 🔥 simpleTitle 是 undefined！
                 !item.content?.trim() && 
                 !item.description?.trim() &&
                 (!item.tags || item.tags.length === 0);
  return !isEmpty;
});
```

**问题**：
- 在 L487-490，title 被设置为 `{ fullTitle: '...', colorTitle: undefined, simpleTitle: undefined }`
- 空节点过滤只检查 `simpleTitle`，但 `simpleTitle` 在这里是 `undefined`
- **所有有 fullTitle 但 simpleTitle 为 undefined 的事件都被误判为空节点过滤掉**

**数据流**：
```
用户编辑 "测试标题"
  ↓
Slate Editor 保存为 fullTitle: '[{"text":"测试标题"}]'
  ↓
slateNodesToPlanItems 转换: { fullTitle: '[...]', simpleTitle: undefined }
  ↓
空节点过滤: !undefined.trim() → true → 被过滤掉！
  ↓
返回空数组 []
  ↓
用户看到：所有内容消失
```

#### 原因 2：PlanManager 的空白检测逻辑不一致

**位置**：`src/components/PlanManager.tsx` L950-963

```typescript
// ❌ 错误代码
const isEmpty = (
  !updatedItem.title?.simpleTitle?.trim() &&  // 🔥 只检查 simpleTitle
  !updatedItem.content?.trim() && 
  // ...
);
```

**问题**：与序列化层相同，只检查 `simpleTitle`，导致有 `fullTitle` 的事件被误判为空。

#### 原因 3：对象引用比较导致的变更检测失效

**位置**：`src/components/PlanManager.tsx` L979

```typescript
// ❌ 错误代码
const isChanged = !existingItem || 
  existingItem.title !== updatedItem.title ||  // 🔥 对象引用比较！
  existingItem.content !== updatedItem.content ||
  // ...
```

**问题**：
- `title` 现在是对象，用 `!==` 比较永远不相等（不同引用）
- 即使内容完全一样，每次都认为有变化
- 导致不必要的保存操作，性能问题 + 日志噪音

**示例**：
```javascript
const old = { simpleTitle: "测试" };
const new = { simpleTitle: "测试" };
old !== new  // true（不同对象引用）
JSON.stringify(old) !== JSON.stringify(new)  // false（内容相同）
```

#### 原因 4：Review 模式退出时的时序问题

**位置**：`src/components/PlanManager.tsx` L2104

```typescript
// ❌ 原代码
if (start === null || end === null) {
  setDateRange(null as any);  // 立即清空 dateRange
  // UnifiedSlateEditor key 变化 → 编辑器重装
  // pendingUpdatedItemsRef 中的数据可能丢失
  return;
}
```

**问题**：
- UnifiedSlateEditor 的 key 依赖 `dateRange`
- `dateRange` 变化 → key 变化 → 编辑器重装
- 待保存的编辑（300ms 防抖）还未提交就被丢弃

---

## 修复方案

### 修复 1：序列化层 - 检查所有 title 字段

**文件**：`src/components/UnifiedSlateEditor/serialization.ts` L567-577

```typescript
// ✅ 修复后
const result = Array.from(items.values()).filter(item => {
  // 检查所有 title 字段（fullTitle/colorTitle/simpleTitle）
  const hasTitle = item.title?.fullTitle?.trim() || 
                  item.title?.simpleTitle?.trim() || 
                  item.title?.colorTitle?.trim();
  const isEmpty = !hasTitle && 
                 !item.content?.trim() && 
                 !item.description?.trim() &&
                 !item.eventlog?.trim() &&  // 也检查 eventlog
                 (!item.tags || item.tags.length === 0);
  return !isEmpty;
});
```

**效果**：
- ✅ 只要 `fullTitle` / `colorTitle` / `simpleTitle` 任一有内容就保留
- ✅ 与 EventTitle 三层架构一致
- ✅ 避免误过滤有效事件

### 修复 2：PlanManager - 统一空白检测逻辑

**文件**：`src/components/PlanManager.tsx` L950-963

```typescript
// ✅ 修复后
const hasTitle = updatedItem.title?.fullTitle?.trim() || 
                updatedItem.title?.simpleTitle?.trim() || 
                updatedItem.title?.colorTitle?.trim();
const isEmpty = (
  !hasTitle && 
  !updatedItem.content?.trim() && 
  !updatedItem.description?.trim() &&
  !updatedItem.eventlog?.trim() &&
  // ...
);
```

**效果**：
- ✅ 与序列化层逻辑完全一致
- ✅ 避免空白检测的误判

### 修复 3：深度比较 title 对象

**文件**：`src/components/PlanManager.tsx` L976-982

```typescript
// ✅ 修复后
const titleChanged = JSON.stringify(existingItem?.title) !== JSON.stringify(updatedItem.title);
const isChanged = !existingItem || 
  titleChanged ||
  existingItem.content !== updatedItem.content ||
  // ...
```

**效果**：
- ✅ 正确检测 title 内容变化（而不是引用变化）
- ✅ 避免误触发保存
- ✅ 提升性能，减少日志噪音

### 修复 4：Review 模式退出前强制保存

**文件**：`src/components/PlanManager.tsx` L2102-2113

```typescript
// ✅ 修复后
if (start === null || end === null) {
  // 退出 snapshot 前，强制保存所有待处理的编辑
  if (onChangeTimerRef.current) {
    clearTimeout(onChangeTimerRef.current);
    onChangeTimerRef.current = null;
  }
  
  if (pendingUpdatedItemsRef.current) {
    console.log('[PlanManager] 🔧 退出 snapshot 前保存待处理编辑:', pendingUpdatedItemsRef.current.length, '个');
    executeBatchUpdate(pendingUpdatedItemsRef.current);
    pendingUpdatedItemsRef.current = null;
  }
  
  setDateRange(null as any);
  return;
}
```

**效果**：
- ✅ 退出 Review 模式前，先提交所有待保存的编辑
- ✅ 清空防抖定时器，避免冲突
- ✅ 防止编辑器重装导致数据丢失

---

## 测试验证

### 测试场景

1. **基本编辑保存**
   - 编辑事件标题 → 切换页面 → 返回
   - ✅ 预期：内容保留

2. **Review 模式数据保留**
   - 编辑 7 个事件 → 进入 Review 模式 → 退出
   - ✅ 预期：所有编辑保留

3. **新建事件保存**
   - 创建新事件 → 输入标题 → 切换页面
   - ✅ 预期：新事件成功保存

4. **空白事件清理**
   - 创建新行不输入内容 → 失焦
   - ✅ 预期：空白行被自动删除（正常行为）

### 控制台日志验证

```javascript
// 正常流程日志
[slateNodesToPlanItems] 返回结果: [
  { id: "xxx", title: "测试标题", hasEventlog: true, ... }
]  // ✅ 不再被过滤

[executeBatchUpdate] 开始处理: {
  总数: 7,
  items: [...]
}  // ✅ 所有事件都被处理

[PlanManager] 🔧 退出 snapshot 前保存待处理编辑: 7 个
// ✅ Review 模式退出前强制保存
```

---

## 影响分析

### 破坏性影响

**v2.14 EventTitle 重构的副作用**：
- ❌ 序列化层未完全适配新的 title 结构
- ❌ 业务逻辑层仍使用字符串比较逻辑
- ❌ 导致事件保存机制完全失效

**受影响的用户操作**：
- Plan 页面的所有编辑操作
- Review 模式的查看和退出
- 页面切换（包括 Plan ↔ Calendar ↔ Upcoming）

### 修复后的改进

**数据完整性**：
- ✅ 所有事件编辑正确保存
- ✅ Review 模式不丢失数据
- ✅ 页面切换保持数据一致

**性能优化**：
- ✅ 减少不必要的保存操作（正确的变更检测）
- ✅ 减少日志噪音
- ✅ 避免重复序列化

**架构一致性**：
- ✅ 序列化层与 EventTitle 架构一致
- ✅ 业务逻辑层正确处理对象比较
- ✅ 各层逻辑统一，易于维护

---

## 经验总结

### 架构重构的教训

1. **类型变更需全量排查**
   - `string` → `object` 的变更影响范围很广
   - 需要排查所有字符串比较、空值检测、序列化逻辑

2. **测试覆盖不足**
   - 缺少端到端测试覆盖保存流程
   - 应该有自动化测试验证数据持久化

3. **日志的重要性**
   - 详细的日志帮助快速定位问题
   - 应该在关键数据流节点添加日志

### 最佳实践

1. **序列化层的健壮性**
   ```typescript
   // ✅ 好：检查所有可能的字段
   const hasTitle = item.title?.fullTitle || 
                   item.title?.simpleTitle || 
                   item.title?.colorTitle;
   
   // ❌ 坏：只检查一个字段
   const hasTitle = item.title?.simpleTitle;
   ```

2. **对象比较**
   ```typescript
   // ✅ 好：深度比较
   JSON.stringify(a) !== JSON.stringify(b)
   
   // ❌ 坏：引用比较
   a !== b  // 对象永远不相等
   ```

3. **防抖保存的清理**
   ```typescript
   // ✅ 好：退出前强制提交
   if (pendingRef.current) {
     executeSave(pendingRef.current);
     pendingRef.current = null;
   }
   
   // ❌ 坏：直接退出，数据丢失
   setMode(null);
   ```

### 后续改进建议

1. **添加自动化测试**
   - 端到端测试：编辑 → 保存 → 加载 → 验证
   - 单元测试：序列化/反序列化、空值检测、变更检测

2. **类型安全增强**
   - 使用 TypeScript strict mode
   - 添加类型守卫防止 undefined 错误

3. **性能监控**
   - 监控保存操作的频率
   - 检测不必要的重复保存

4. **文档更新**
   - 更新 EventTitle 迁移指南
   - 补充序列化层的注意事项

---

## 相关文档

- [EventHub & TimeHub Architecture](../architecture/EVENTHUB_TIMEHUB_ARCHITECTURE.md) - v2.14 EventTitle 三层架构
- [Slate Editor PRD](../PRD/SLATE_EDITOR_PRD.md) - UnifiedSlateEditor 序列化规范
- [PlanManager PRD](../PRD/PLANMANAGER_MODULE_PRD.md) - 事件保存流程

---

## Changelog

- **2025-11-28**: 初始版本，修复 EventTitle 三层架构导致的保存失败问题
- **Commit**: c6d5535 - `fix(PlanManager): 修复 EventTitle 三层架构导致的事件保存失败问题`
