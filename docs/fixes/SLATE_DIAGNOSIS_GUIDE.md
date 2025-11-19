# Slate 编辑器清空问题 - 诊断脚本使用指南

**创建日期**: 2025-11-18  
**状态**: ✅ 已部署诊断日志  
**目的**: 捕获编辑器突然清空的根本原因

---

## 🎯 诊断脚本已部署位置

### 1. PlanManager.tsx

#### ✅ 过滤逻辑诊断（L324-375）
```typescript
// 检测点：过滤后的事件数量
if (filtered.length === 0 && allEvents.length > 0) {
  console.error('🔴 [诊断] PlanManager 所有事件被过滤！', {
    总事件数: allEvents.length,
    isPlan事件: allEvents.filter(e => e.isPlan).length,
    有parentEventId的: allEvents.filter(e => e.parentEventId).length,
    TimeCalendar事件: allEvents.filter(e => e.isTimeCalendar).length,
    TimeCalendar已过期: allEvents.filter(e => e.isTimeCalendar && e.endTime && new Date(e.endTime) <= now).length,
    示例事件: [...]
  });
}
```

**触发条件**: 所有 Plan 事件被过滤（例如：都是 TimeCalendar 且已过期）

---

#### ✅ editorItems 诊断（L943-968）
```typescript
// 检测点：传给编辑器的数据
if (result.length === 0 && items.length > 0) {
  console.error('🔴 [诊断] editorItems 为空但 items 有数据！', {
    items数量: items.length,
    pendingEmptyItems数量: pendingEmptyItems.size,
    // 🆕 新增：检查pendingEmptyItems的详细内容
    pendingEmptyItems详情: Array.from(pendingEmptyItems.entries()).map(([id, item]) => ({
      id: id.substring(0, 20),
      title: item.title?.substring(0, 15) || '空',
      hasContent: !!(item.title?.trim() || item.content?.trim()),
      创建时间: item.createdAt
    })),
    allItems数量: allItems.length,
    过滤后数量: result.length,
    items示例: [...]
  });
}
```

**触发条件**: items 转换为 editorItems 时数据丢失

---

#### ✅ onChange 回调诊断（L915-926）
```typescript
// 检测点：onChange 收到的数据
if (updatedItems.length === 0 && items.length > 0) {
  console.error('🔴 [诊断] onChange 收到空数组！', {
    当前items数量: items.length,
    收到updatedItems数量: updatedItems.length,
    调用栈: new Error().stack,
    items示例: [...]
  });
}
```

**触发条件**: Slate 编辑器 onChange 回传空数组

---

### 2. UnifiedSlateEditor.tsx

#### ✅ 初始化诊断（L619-648）
```typescript
// 检测点：初始化过程
console.log('🔍 [诊断] 初始化 useEffect 执行:', {
  isInitialized: isInitializedRef.current,
  items数量: items.length,
  enhancedValue数量: enhancedValue.length,
  value数量: value.length,
  时间戳: new Date().toISOString()
});

// 检测点：enhancedValue 异常
if (enhancedValue.length === 0 || (enhancedValue.length === 1 && enhancedValue[0].eventId === '__placeholder__')) {
  console.error('🔴 [诊断] enhancedValue 异常为空！', {
    items数量: items.length,
    enhancedValue: enhancedValue,
    items示例: [...]
  });
}
```

**触发条件**: 初始化时 enhancedValue 为空但 items 有数据（竞态条件）

---

#### ✅ enhancedValue 计算诊断（L530-561）
```typescript
// 检测点：enhancedValue 重新计算
console.log('🔍 [诊断] enhancedValue 重新计算:', {
  items数量: items.length,
  时间戳: new Date().toISOString()
});

// 检测点：planItemsToSlateNodes 返回空
if (baseNodes.length === 0 && items.length > 0) {
  console.error('🔴 [诊断] planItemsToSlateNodes 返回空数组！', {
    items数量: items.length,
    items示例: [...]
  });
}

// 检测点：最终结果
console.log('📊 [诊断] enhancedValue 计算完成:', {
  baseNodes数量: baseNodes.length,
  最终数量: result.length,
  items数量: items.length
});
```

**触发条件**: items → Slate nodes 转换失败

---

#### ✅ 自动保存诊断（L1062-1089）
```typescript
// 检测点：过滤后节点为空
if (filteredNodes.length === 0) {
  console.error('🔴 [诊断] 自动保存 - filteredNodes 为空！', {
    pendingChanges数量: (pendingChangesRef.current as any[])?.length,
    调用栈: new Error().stack?.split('\n').slice(0, 10)
  });
}

// 检测点：序列化返回空
if (planItems.length === 0 && filteredNodes.length > 0) {
  console.error('🔴 [诊断] slateNodesToPlanItems 返回空数组！', {
    filteredNodes数量: filteredNodes.length,
    planItems数量: planItems.length,
    filteredNodes示例: [...]
  });
}
```

**触发条件**: 保存时序列化失败

---

#### ✅ setValue 调用诊断（L920-936）
```typescript
// 检测点：setValue 即将清空编辑器
const hasRealContent = newValueAsNodes.some(node => node.eventId !== '__placeholder__');

if (!hasRealContent && value.some(node => node.eventId !== '__placeholder__')) {
  console.error('🔴 [诊断] setValue 即将清空编辑器！', {
    当前value有内容: value.filter(n => n.eventId !== '__placeholder__').length,
    新value只有placeholder: !hasRealContent,
    newValue数量: newValueAsNodes.length,
    调用栈: new Error().stack?.split('\n').slice(0, 10)
  });
}
```

**触发条件**: setValue 被调用且新值只包含 placeholder

---

## 📋 如何使用

### 1. 打开浏览器控制台

按 `F12` 或右键 → 检查 → Console

### 2. 正常使用应用

像往常一样使用 Plan 页面：
- 创建事件
- 编辑事件
- 删除事件
- 添加标签、时间
- 切换页面

### 3. 观察日志

#### 正常情况
你会看到绿色的诊断日志：
```
🔍 [诊断] 初始化 useEffect 执行: { items数量: 45, ... }
📊 [诊断] enhancedValue 计算完成: { baseNodes数量: 45, ... }
✅ [诊断] 初始化完成: { 设置的value数量: 46 }
```

#### 问题出现时
你会看到红色的错误日志：
```
🔴 [诊断] XXX 为空/异常！
```

### 4. 截图或复制日志

**当问题出现时**：
1. 立即停止操作
2. 截图控制台的红色错误
3. 或复制完整的错误对象（展开查看详情）
4. 记录当时的操作步骤

---

## 🔍 预期发现的问题类型

### 类型 A：初始化竞态

**日志特征**:
```
🔴 [诊断] enhancedValue 异常为空！
  items数量: 45  ← items 有数据
  enhancedValue: [{ eventId: "__placeholder__" }]  ← 只有占位符
```

**原因**: useEffect 在 items 加载前执行

---

### 类型 B：过滤导致清空

**日志特征**:
```
🔴 [诊断] PlanManager 所有事件被过滤！
  总事件数: 50
  isPlan事件: 50
  TimeCalendar已过期: 50  ← 所有 TimeCalendar 事件都过期了
```

**原因**: 过滤条件过于严格

---

### 类型 C：序列化失败

**日志特征**:
```
🔴 [诊断] planItemsToSlateNodes 返回空数组！
  items数量: 45  ← 输入有数据
```

**原因**: 转换函数逻辑错误

---

### 类型 D：onChange 空数组

**日志特征**:
```
🔴 [诊断] onChange 收到空数组！
  当前items数量: 45
  收到updatedItems数量: 0  ← Slate 回传空数组
```

**原因**: Slate 编辑器内部异常

---

### 类型 E：setValue 清空

**日志特征**:
```
🔴 [诊断] setValue 即将清空编辑器！
  当前value有内容: 45
  新value只有placeholder: true
  调用栈: [...]  ← 查看是谁调用的
```

**原因**: 某处代码错误调用 setValue

---

## 🎓 调用栈分析示例

当看到错误日志时，展开 `调用栈` 字段：

```javascript
调用栈: [
  "Error",
  "    at handleEditorChange (PlanManager.tsx:918)",
  "    at handleEditorChange (UnifiedSlateEditor.tsx:1065)",
  "    at onChange (UnifiedSlateEditor.tsx:916)",
  "    at flushPendingChanges (UnifiedSlateEditor.tsx:1122)",
  "    at handleKeyDown (UnifiedSlateEditor.tsx:1675)",
  ...
]
```

这告诉我们：
1. 用户按键 (`handleKeyDown`)
2. 触发立即保存 (`flushPendingChanges`)
3. 调用 `onChange` 回调
4. 传给 `PlanManager.handleEditorChange`
5. ❌ 这时收到了空数组

---

## 🚨 紧急情况处理

### 如果编辑器清空了

**不要慌！数据还在！**

1. **不要刷新页面**（会丢失控制台日志）
2. **截图控制台的所有红色错误**
3. **复制错误详情**
4. 切换到其他页面（如 Calendar）
5. 切回 Plan 页面 → 内容恢复

### 如果问题频繁出现

**添加额外监控**:

在控制台运行：
```javascript
// 监控所有 setValue 调用
const originalSetValue = window.__slateEditor?.setValue;
if (originalSetValue) {
  window.__slateEditor.setValue = function(newValue) {
    console.log('🔍 setValue 被调用:', {
      newValue数量: newValue?.length,
      调用栈: new Error().stack
    });
    return originalSetValue.call(this, newValue);
  };
}
```

---

## ✅ 成功标准

诊断成功的标志：

1. ✅ 捕获到至少 1 个红色错误日志
2. ✅ 错误日志包含完整的上下文（items数量、调用栈等）
3. ✅ 能复现问题（知道触发条件）

一旦达到以上标准，我们就能：
- 定位根本原因
- 编写针对性修复
- 添加防御性代码

---

## 📊 日志收集清单

当问题出现时，收集以下信息：

- [ ] 完整的错误日志（JSON 对象）
- [ ] 调用栈（Stack trace）
- [ ] 触发问题的操作步骤
- [ ] 当时的页面状态（有多少个事件）
- [ ] 浏览器版本
- [ ] 是否在快速操作（连续按键、快速切换页面等）

---

## 🔄 下一步

1. **正常使用应用**，等待问题自然出现
2. **捕获日志** 后立即报告
3. **我会分析日志**，确定根本原因
4. **编写修复代码**，彻底解决问题

---

**备注**：
- 诊断日志不会影响性能
- 所有日志仅在控制台显示，不上传
- 修复完成后会移除诊断代码

**预计诊断时间**: 1-7 天（取决于问题复现频率）

---

**文档版本**: v1.0  
**最后更新**: 2025-11-18
