# 🐛 Bug Fix: 添加标签后未同步到日历分组

**问题报告时间**: 2025-11-06  
**修复时间**: 2025-11-06  
**影响范围**: EventEditModal, 同步逻辑  
**严重程度**: 中等（需要手动编辑才能触发正确的同步）

---

## 问题描述

### 用户报告的现象
1. 创建事件（无标签）→ 同步到默认日历 ✅
2. 添加标签（已映射到特定日历分组）→ **未同步到标签对应的日历** ❌
3. 手动编辑事件 → 才同步到正确的日历 ⚠️

### 期望行为
- 添加或修改标签后，事件应该**自动同步**到该标签映射的日历分组
- 无需手动编辑即可触发正确的同步

---

## 根本原因

### 代码分析路径

1. **标签选择组件**: `HierarchicalTagPicker`
   - 用户选择/取消标签 → 调用 `onSelectionChange(selectedIds)`
   
2. **EventEditModal 表单状态**: `formData.tags`
   - `toggleTag()` 更新 `formData.tags` 数组
   - `useEffect` 监听 `formData.tags` 变化 (line 258-279)
   
3. **日历 ID 自动填充逻辑** (EventEditModal.tsx, L258-279):
   ```tsx
   useEffect(() => {
     if (formData.tags.length > 0 && availableCalendars.length > 0) {
       const mappedCalendarIds = formData.tags
         .map(tagId => {
           const tag = getTagById(tagId);
           return tag?.calendarMapping?.calendarId;
         })
         .filter((id): id is string => Boolean(id));
       
       // ❌ BUG: 只是追加，不替换
       const uniqueCalendarIds = Array.from(new Set([
         ...formData.calendarIds,  // 保留旧的日历 ID
         ...mappedCalendarIds      // 添加新的日历 ID
       ]));
       
       setFormData(prev => ({
         ...prev,
         calendarIds: uniqueCalendarIds
       }));
     }
   }, [formData.tags, availableCalendars]);
   ```

4. **保存逻辑的问题** (EventEditModal.tsx, L410-423):
   ```tsx
   await EventHub.updateFields(event.id, {
     tags: formData.tags,
     tagId: formData.tags[0],
     calendarId: formData.calendarIds[0],  // ❌ BUG: 取第一个，可能是旧的
     calendarIds: formData.calendarIds,
   }, { source: 'EventEditModal', skipSync: shouldSkipSync });
   ```

### Bug 详细说明

**场景示例**:
```
1. 创建事件（无标签）
   → calendarIds = ['AAMkAD...default']
   → calendarId = 'AAMkAD...default'

2. 用户添加标签 "工作"（映射到 'AAMkAD...work'）
   → useEffect 触发
   → calendarIds = ['AAMkAD...default', 'AAMkAD...work']  // 追加，不替换！
   → calendarId 仍然是 'AAMkAD...default'  // ❌ 错误！

3. 保存
   → EventHub.updateFields({ calendarId: 'AAMkAD...default' })
   → 同步到默认日历，而不是工作日历 ❌
```

### 为什么手动编辑能触发正确同步？

手动编辑时，用户可能修改了标题/时间等字段，这些修改会重新触发 `EventHub.updateFields()`，而此时 `formData.calendarIds` 可能已经包含了正确的日历 ID（如果用户在编辑时重新打开了模态框）。

---

## 修复方案

### 核心思路
**优先使用标签映射的日历 ID，而不是数组中的第一个**

### 修复代码 (3处)

#### 1. 新建事件 (EventEditModal.tsx, L365-396)
```tsx
if (isNewEvent) {
  // 🔧 [NEW] 计算正确的 calendarId：优先使用标签映射的日历
  let targetCalendarId: string | undefined;
  if (formData.tags.length > 0) {
    // 如果有标签，尝试获取第一个标签的日历映射
    const firstTag = getTagById(formData.tags[0]);
    targetCalendarId = firstTag?.calendarMapping?.calendarId;
  }
  // 如果没有标签映射，使用用户手动选择的日历
  if (!targetCalendarId && formData.calendarIds.length > 0) {
    targetCalendarId = formData.calendarIds[0];
  }
  
  const newEvent: Event = {
    ...event,
    tags: formData.tags,
    tagId: formData.tags[0],
    calendarId: targetCalendarId, // ✅ 使用计算后的 calendarId
    calendarIds: targetCalendarId ? [targetCalendarId] : formData.calendarIds,
    // ...
  };
}
```

#### 2. 编辑现有事件 (EventEditModal.tsx, L407-439)
```tsx
// 📝 编辑现有事件
// 🔧 [NEW] 计算正确的 calendarId：优先使用标签映射的日历
let targetCalendarId: string | undefined;
if (formData.tags.length > 0) {
  const firstTag = getTagById(formData.tags[0]);
  targetCalendarId = firstTag?.calendarMapping?.calendarId;
}
if (!targetCalendarId && formData.calendarIds.length > 0) {
  targetCalendarId = formData.calendarIds[0];
}

await EventHub.updateFields(event.id, {
  tags: formData.tags,
  tagId: formData.tags[0],
  calendarId: targetCalendarId, // ✅ 使用计算后的 calendarId
  calendarIds: targetCalendarId ? [targetCalendarId] : formData.calendarIds,
}, { source: 'EventEditModal', skipSync: shouldSkipSync });
```

#### 3. 兜底逻辑 (EventEditModal.tsx, L460-485)
```tsx
// 兜底：没有 eventId 的情况
let targetCalendarId: string | undefined;
if (formData.tags.length > 0) {
  const firstTag = getTagById(formData.tags[0]);
  targetCalendarId = firstTag?.calendarMapping?.calendarId;
}
if (!targetCalendarId && formData.calendarIds.length > 0) {
  targetCalendarId = formData.calendarIds[0];
}

const updatedEvent: Event = {
  ...event,
  tags: formData.tags,
  calendarId: targetCalendarId, // ✅ 使用计算后的 calendarId
  calendarIds: targetCalendarId ? [targetCalendarId] : formData.calendarIds,
  // ...
};
```

---

## 修复逻辑说明

### 优先级规则
1. **优先**: 标签的日历映射 (`tag.calendarMapping.calendarId`)
2. **备选**: 用户手动选择的日历 (`formData.calendarIds[0]`)
3. **兜底**: `undefined`（使用默认日历）

### 代码流程
```
formData.tags[0] (第一个标签)
  ↓
getTagById(tagId)
  ↓
tag?.calendarMapping?.calendarId
  ↓
targetCalendarId = tag映射的日历 || formData.calendarIds[0] || undefined
  ↓
calendarId: targetCalendarId  // 保存到事件
calendarIds: [targetCalendarId]  // 更新数组（确保一致性）
  ↓
EventHub.updateFields() / EventHub.createEvent()
  ↓
EventService.updateEvent(..., skipSync=false)
  ↓
syncManagerInstance.recordLocalAction('update', 'event', eventId, updatedEvent)
  ↓
同步到正确的日历 ✅
```

---

## 测试场景

### 场景 1: 创建事件后添加标签
1. 创建事件（无标签） → 同步到默认日历
2. 打开编辑模态框
3. 添加标签"工作"（映射到 work-calendar）
4. 保存
5. **期望**: 事件同步到 work-calendar ✅
6. **验证**: 检查 Outlook，事件应出现在 work-calendar

### 场景 2: 切换标签
1. 事件当前标签："个人"（映射到 personal-calendar）
2. 打开编辑模态框
3. 移除"个人"标签，添加"工作"标签（映射到 work-calendar）
4. 保存
5. **期望**: 
   - 事件从 personal-calendar 删除 ✅
   - 事件在 work-calendar 创建 ✅
6. **验证**: 检查 Outlook 两个日历的变化

### 场景 3: 移除标签
1. 事件当前标签："工作"（映射到 work-calendar）
2. 打开编辑模态框
3. 移除"工作"标签
4. 保存
5. **期望**: 事件同步到默认日历 ✅
6. **验证**: 检查 Outlook，事件应出现在默认日历

### 场景 4: 标签无映射
1. 创建事件
2. 添加标签"无映射标签"（未配置日历映射）
3. 保存
4. **期望**: 使用默认日历或保持原日历 ✅
5. **验证**: 检查 `calendarId` 字段

---

## 性能影响

### 新增操作
- `getTagById()` 调用: **O(n)** 复杂度（n = 标签数量，通常 < 100）
- 每次保存时执行 **1次** 标签查找
- **影响**: 可忽略不计（< 1ms）

### 同步行为变化
- **修复前**: 添加标签不触发正确同步 → 需要手动编辑
- **修复后**: 添加标签立即触发同步 → 自动更新日历

### API 调用优化
- 配合队列合并优化（已实施）
- 多次快速编辑 → 只发送最后一次更新
- **节省**: 90% API 调用（参考 SYNC_MECHANISM_PRD.md 8.5 章节）

---

## 相关文件

### 修改的文件
- `src/components/EventEditModal.tsx` (3处修改)

### 相关服务
- `src/services/EventHub.ts`: `updateFields()`, `createEvent()`
- `src/services/EventService.ts`: `updateEvent()`
- `src/services/ActionBasedSyncManager.ts`: `recordLocalAction()`, `getCalendarIdForTag()`
- `src/services/TagService.ts`: `getTagById()`, `getFlatTags()`

### 数据流
```
EventEditModal
  ↓ handleSave()
EventHub.updateFields({ calendarId: targetCalendarId })
  ↓
EventService.updateEvent(eventId, updatedEvent, skipSync=false)
  ↓ dispatchEventUpdate()
  ↓ recordLocalAction()
ActionBasedSyncManager
  ↓ syncSingleAction() / syncPendingLocalActions()
MicrosoftCalendarService
  ↓ updateEventInCalendar()
Microsoft Graph API
  ↓ PATCH /me/calendars/{calendarId}/events/{eventId}
Outlook 日历更新 ✅
```

---

## 配套文档更新

### 需要更新的文档
1. **SYNC_MECHANISM_PRD.md** (已更新)
   - 添加章节 8.6: 标签日历映射同步修复
   - 更新版本号: v1.1 → v1.2

2. **Sync-Architecture.md** (已更新)
   - 添加"标签日历映射逻辑"章节
   - 更新版本号: v1.2 → v1.3

3. **event_display.md** (建议更新)
   - 添加标签与日历联动的说明

---

## 回归测试清单

- [ ] 创建无标签事件 → 同步到默认日历
- [ ] 创建有标签事件（标签有映射）→ 同步到映射日历
- [ ] 创建有标签事件（标签无映射）→ 同步到默认日历
- [ ] 添加标签到现有事件 → 同步到新日历
- [ ] 移除标签 → 同步到默认日历
- [ ] 切换标签 → 从旧日历删除 + 在新日历创建
- [ ] 运行中的 Timer 添加标签 → **不触发同步** (skipSync=true)
- [ ] 手动选择日历（无标签）→ 同步到选择的日历
- [ ] 标签映射优先级 > 手动选择

---

## 变更日志

### 2025-11-06 - v1.0 初始修复
- **问题**: 添加标签后未同步到日历分组
- **修复**: EventEditModal 优先使用标签映射的日历 ID
- **影响**: 新建事件、编辑事件、兜底逻辑（3处）
- **测试**: 待用户验证

---

## 后续优化建议

### 1. 多标签的日历分组策略
**现状**: 只使用第一个标签的映射  
**问题**: 事件有多个标签时，如何决定同步到哪个日历？

**可能方案**:
- **选项 A**: 优先级标签（用户标记"主标签"）
- **选项 B**: 创建副本到多个日历（复杂，可能重复）
- **选项 C**: 保持现状（第一个标签优先）

### 2. UI 反馈优化
**现状**: 用户看不到事件将同步到哪个日历  
**建议**: 
- 在标签选择器下方显示"将同步到: [日历名称]"
- 允许用户覆盖自动计算的日历

### 3. 历史事件批量修正
**问题**: 已存在的事件可能有错误的日历映射  
**建议**: 创建迁移脚本，批量修正历史数据

---

## 参考资料

- [SYNC_MECHANISM_PRD.md](../architecture/SYNC_MECHANISM_PRD.md) - 同步机制 PRD
- [Sync-Architecture.md](../architecture/Sync-Architecture.md) - 同步架构文档
- [ActionBasedSyncManager.ts](../../src/services/ActionBasedSyncManager.ts) - 同步管理器实现
- [TagService.ts](../../src/services/TagService.ts) - 标签服务

---

**修复者**: GitHub Copilot  
**审核者**: 待定  
**状态**: ✅ 已修复，待测试
