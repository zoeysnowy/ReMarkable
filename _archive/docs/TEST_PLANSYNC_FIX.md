# 计划同步配置修复验证指南

> **问题**: EventEditModalV2 保存时 `planSyncConfig` 被显式清除  
> **原因**: "来自"区域只读显示，缺少日历选择器  
> **修复**: 添加计划日历多选 Picker，"来自" → "同步"  
> **提交**: 5a1574a

---

## 📋 验证步骤

### 1. 打开控制台查看日志

```javascript
// 打开浏览器开发者工具 Console
// 筛选 [EventService] 日志
```

### 2. 创建新事件并选择日历

1. 打开 EventEditModalV2（任意方式）
2. 找到 "同步" 行（原 "来自"）
3. 点击日历名称区域
4. 应该弹出日历选择 Picker
5. 勾选一个或多个日历（如 Outlook: 默认）
6. 点击确定或点击外部关闭

**预期结果**:
- 显示 "第一个日历名" 或 "第一个日历名 等"
- 日历圆点颜色正确

### 3. 保存事件并检查日志

1. 填写标题（如 "🐳 测试同步"）
2. 点击 "保存修改" 或自动保存
3. 查看控制台日志

**✅ 修复后（正确日志）**:
```
💾 [EventEditModalV2] Saving event: local-xxx
📝 [EventService] Updating event: local-xxx
📋 [EventService] 更新字段: {
  calendarIds: ['AAMkADVj...'],
  planSyncConfig: {
    mode: 'send-only',
    targetCalendars: ['AAMkADVj...']
  }
}
💾 [EventService] Event updated in localStorage
```

**❌ 修复前（错误日志）**:
```
📝 [EventService] 显式清除字段: planSyncConfig  // ❌ 不应该出现
```

### 4. 验证数据持久化

1. 刷新页面（F5）
2. 重新打开该事件
3. 检查 "同步" 行的日历选择

**预期结果**:
- 显示之前选择的日历
- planSyncConfig 正确保存

### 5. 验证同步逻辑（可选）

1. 创建事件并选择 Outlook 日历
2. 保存事件
3. 等待 ActionBasedSyncManager 同步
4. 打开 Outlook 日历网页版，查看事件是否同步

---

## 🐛 已知问题（待实现）

### 1. "来源"标志缺失
- **现象**: 从外部日历同步的事件，日历选择器中没有显示 "来源" 标志
- **原因**: Picker 使用的是标准 SimpleCalendarDropdown，未实现自定义标识
- **影响**: 用户无法区分哪个是来源日历
- **PRD**: § 2.4 CalendarPickerOption.isSource

### 2. 标签智能映射缺失
- **现象**: 添加标签后，对应日历不自动勾选
- **原因**: 未实现 getTagMappedCalendarIds() 逻辑
- **影响**: 用户需要手动勾选标签映射的日历
- **PRD**: § 2.4 标签智能映射

### 3. 实际进展同步配置缺失
- **现象**: 实际进展区域的日历选择器正确更新 actualSyncConfig
- **验证**: 查看日志中是否包含 actualSyncConfig 字段
- **状态**: ✅ 已实现（L1893-1904，11-24 修复）

---

## 📊 数据流验证

### formData 初始化
```typescript
// L267-271: 编辑已有事件
planSyncConfig: event.planSyncConfig || {
  mode: 'receive-only',
  targetCalendars: []
}

// L291-295: 创建新事件
planSyncConfig: {
  mode: 'receive-only',
  targetCalendars: []
}
```

### 用户选择日历
```typescript
// L1707-1718: onMultiSelectionChange
setFormData(prev => ({
  ...prev,
  calendarIds: calendarIds,          // 🆕 用于 ActionBasedSyncManager
  planSyncConfig: {
    ...prev.planSyncConfig,
    mode: prev.planSyncConfig?.mode || 'send-only',
    targetCalendars: calendarIds     // 🆕 计划同步目标
  }
}));
```

### 保存到 EventService
```typescript
// L556-557: 构建 updatedEvent
planSyncConfig: formData.planSyncConfig,
actualSyncConfig: formData.actualSyncConfig,
```

### ActionBasedSyncManager 同步
```typescript
// 优先使用 event.calendarIds 决定同步目标
// 参考: ActionBasedSyncManager.ts L2107-2127
```

---

## 🔍 调试技巧

### 1. 查看 formData 实时状态
在 EventEditModalV2.tsx 中添加：
```typescript
useEffect(() => {
  console.log('🔍 [DEBUG] formData.planSyncConfig:', formData.planSyncConfig);
}, [formData.planSyncConfig]);
```

### 2. 查看保存前的完整事件
在 handleSave 中（L561 之前）添加：
```typescript
console.log('🔍 [DEBUG] updatedEvent before save:', {
  calendarIds: updatedEvent.calendarIds,
  planSyncConfig: updatedEvent.planSyncConfig,
  actualSyncConfig: updatedEvent.actualSyncConfig
});
```

### 3. 查看 EventService 接收的数据
在 EventService.ts updateEvent 中（L662 之前）添加：
```typescript
console.log('🔍 [DEBUG] EventService received:', {
  eventId,
  'updates.planSyncConfig': updates.planSyncConfig,
  'updates.calendarIds': updates.calendarIds
});
```

---

## ✅ 验证清单

- [ ] 打开 EventEditModalV2
- [ ] "来自" 已改为 "同步"
- [ ] 点击日历名称弹出 Picker
- [ ] 可以勾选多个日历
- [ ] 显示 "第一个日历名 等"
- [ ] 保存后日志中包含 planSyncConfig
- [ ] 刷新页面后日历选择保持
- [ ] 控制台无 "显式清除字段: planSyncConfig" 错误

---

**测试完成后请反馈结果！**
