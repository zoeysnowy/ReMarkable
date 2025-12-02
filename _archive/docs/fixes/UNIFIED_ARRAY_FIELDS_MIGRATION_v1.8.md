# 统一数组字段迁移计划 v1.8

**目标**: 将所有事件的 `tags` 和 `calendarIds` 统一为数组格式，同时保留向后兼容字段

**背景**: 当前代码混用单一字段（`tagId`, `calendarId`）和数组字段（`tags`, `calendarIds`），导致：
1. Plan 事件无法立即同步（ActionBasedSyncManager 只检查单一字段）
2. 代码逻辑复杂，容易出错
3. 未来扩展困难（多标签、多日历支持）

**原则**:
- **数组优先**: 所有新代码使用 `tags[]` 和 `calendarIds[]`
- **向后兼容**: 保留 `tagId` 和 `calendarId`，设置为数组第一个元素
- **渐进式迁移**: 从核心服务开始，逐步扩展到所有组件

---

## 修改范围

### 1. 核心服务层

#### 1.1 EventService.ts
- [x] createEvent: 确保同时设置 `tags/tagId`, `calendarIds/calendarId`
- [x] updateEvent: 确保同时设置 `tags/tagId`, `calendarIds/calendarId`
- [ ] 添加验证逻辑：如果只有 `tagId`，自动补充 `tags`；反之亦然

#### 1.2 EventHub.ts
- [ ] createEvent: 同步设置数组和单一字段
- [ ] updateFields: 处理字段更新时同步两种格式
- [ ] setEventTime: 确保时间字段更新时不影响标签/日历字段

#### 1.3 ActionBasedSyncManager.ts
- [ ] **CREATE 逻辑**: 优先使用数组字段（`calendarIds`, `tags`）
- [ ] **UPDATE 逻辑**: 优先使用数组字段（`calendarIds`, `tags`）
- [ ] **UPDATE→CREATE 转换**: 使用数组字段获取日历ID
- [ ] 添加诊断日志，显示使用的字段来源

### 2. UI 组件层

#### 2.1 EventEditModal.tsx
- [x] 表单提交：同时设置 `tags/tagId`, `calendarIds/calendarId`
- [ ] 验证：检查现有逻辑是否正确处理数组

#### 2.2 PlanManager.tsx
- [x] executeBatchUpdate: 同时设置 `tags/tagId`, `calendarIds/calendarId`
- [ ] syncToUnifiedTimeline: 验证字段设置
- [ ] 其他事件创建点：检查是否遗漏

#### 2.3 TimeCalendar.tsx
- [ ] 查找所有创建事件的地方
- [ ] 确保使用数组格式

### 3. 辅助函数

#### 3.1 创建统一的字段设置函数
```typescript
// src/utils/eventFieldHelpers.ts
export function normalizeEventFields(event: Partial<Event>): Event {
  const normalized = { ...event };
  
  // 标签字段规范化
  if (event.tags && event.tags.length > 0) {
    normalized.tagId = event.tags[0]; // 向后兼容
  } else if (event.tagId) {
    normalized.tags = [event.tagId]; // 自动补充数组
  }
  
  // 日历字段规范化
  if (event.calendarIds && event.calendarIds.length > 0) {
    normalized.calendarId = event.calendarIds[0]; // 向后兼容
  } else if (event.calendarId) {
    normalized.calendarIds = [event.calendarId]; // 自动补充数组
  }
  
  return normalized as Event;
}
```

---

## 实施步骤

### Phase 1: 核心服务层（当前）
1. ✅ PlanManager.executeBatchUpdate - 添加 `tagId` 和 `calendarId`
2. ✅ EventService - 添加诊断日志
3. ⏳ ActionBasedSyncManager - 修改日历ID获取逻辑（优先数组）

### Phase 2: EventHub 和 EditModal
1. EventHub.createEvent - 规范化字段
2. EventHub.updateFields - 规范化字段
3. EventEditModal - 验证字段设置

### Phase 3: TimeCalendar 和其他组件
1. TimeCalendar - 查找所有事件创建点
2. 其他组件 - 逐个检查和修复

### Phase 4: 清理和验证
1. 添加 ESLint 规则，警告直接使用 `tagId/calendarId` 而不设置数组
2. 全局搜索 `tagId` 和 `calendarId` 使用情况
3. 编写单元测试验证字段规范化逻辑

---

## 测试计划

### 测试场景
1. Plan 页面创建事件并添加标签 → 应立即同步到 Outlook
2. EditModal 创建事件并选择日历 → 应正确保存到目标日历
3. 编辑现有事件更改标签 → 应更新到新日历
4. 刷新页面 → 所有字段应正确加载

### 验证点
- [ ] `tags` 和 `tagId` 保持一致
- [ ] `calendarIds` 和 `calendarId` 保持一致
- [ ] ActionBasedSyncManager 日志显示正确的字段来源
- [ ] 同步成功，事件出现在 Outlook 对应日历

---

## 风险和注意事项

### 风险
1. **数据一致性**: 现有事件可能只有单一字段，需要在加载时自动补充
2. **性能影响**: 字段规范化可能增加计算开销
3. **向后兼容**: 旧版本数据需要正确处理

### 缓解措施
1. 添加数据迁移逻辑（EventService 加载时自动补充缺失字段）
2. 使用 useMemo 缓存规范化结果
3. 保留单一字段，确保旧代码仍能运行

---

## 当前状态

**已完成**:
- ✅ PlanManager.executeBatchUpdate 添加向后兼容字段
- ✅ EventService 添加诊断日志
- ✅ App.handleSavePlanItem 添加诊断日志

**进行中**:
- ⏳ ActionBasedSyncManager 日历ID获取逻辑优化

**待办**:
- EventHub 字段规范化
- EventEditModal 验证
- TimeCalendar 检查
- 添加工具函数 normalizeEventFields
- 数据迁移逻辑

**最后更新**: 2025-11-12
