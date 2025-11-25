# EventLog 迁移测试指南

## 📋 测试目标

验证 EventLog 字段重构和数据迁移功能是否正常工作，确保：
1. 旧格式数据能正确迁移到新格式
2. 新旧格式兼容，应用正常运行
3. description ↔ eventlog 双向同步正常
4. 迁移过程有备份保护，支持回滚

---

## 🧪 测试场景

### 场景 1: 初次启动迁移（有旧数据）

**前置条件**:
- localStorage 中有旧格式事件（`eventlog` 为字符串或空）

**步骤**:
1. 启动应用，打开浏览器控制台
2. 观察初始化日志

**预期结果**:
```
🚀 [App] Initializing application...
📦 [EventLogMigration] Starting migration...
💾 [EventLogMigration] Backup created: events_backup_migration
✅ [EventLogMigration] Migration completed: { total: 50, migrated: 45, skipped: 0, failed: 5 }
✅ [App] EventLog migration completed: {...}
```

**验证点**:
- ✅ 控制台显示迁移统计
- ✅ localStorage 中有 `events_backup_migration` 键
- ✅ 查看 Event 对象，`eventlog` 字段变为对象格式：
  ```javascript
  // 控制台执行
  const events = JSON.parse(localStorage.getItem('remarkable_events'));
  console.log(events[0].eventlog);
  // 预期输出: 
  // {
  //   content: "[{\"type\":\"paragraph\",\"children\":[{\"text\":\"...\"}]}]",
  //   descriptionHtml: "...",
  //   descriptionPlainText: "...",
  //   attachments: [],
  //   versions: [],
  //   syncState: { status: "pending", contentHash: "..." },
  //   createdAt: "...",
  //   updatedAt: "..."
  // }
  ```

---

### 场景 2: 二次启动（已迁移）

**前置条件**:
- 已完成一次迁移，所有事件已是新格式

**步骤**:
1. 刷新页面或重启应用
2. 观察控制台日志

**预期结果**:
```
✅ [App] EventLog migration skipped (all events already in new format)
```

**验证点**:
- ✅ 不会重复迁移
- ✅ 没有重复的备份生成
- ✅ 事件数据保持不变

---

### 场景 3: 创建新事件（自动使用新格式）

**步骤**:
1. 在 TimeCalendar 中创建新事件
2. 填写标题和描述（如果有描述输入框）
3. 保存事件
4. 在控制台查看事件对象

**预期结果**:
```javascript
const events = JSON.parse(localStorage.getItem('remarkable_events'));
const newEvent = events.find(e => e.title === '测试事件');
console.log(newEvent.eventlog);
// 预期输出: EventLog 对象
```

**验证点**:
- ✅ `eventlog` 字段是对象格式
- ✅ `eventlog.slateJson` 包含 Slate JSON
- ✅ `eventlog.createdAt` 和 `updatedAt` 已设置
- ✅ `eventlog.syncState.status` 为 "pending"

---

### 场景 4: 更新事件描述（同步到 eventlog）

**步骤**:
1. 选中一个已有事件
2. 编辑 `description` 字段（如通过 Outlook 同步或其他方式）
3. 调用 EventService 更新：
   ```javascript
   EventService.updateEvent(eventId, { description: '新的描述内容' });
   ```
4. 查看事件对象

**预期结果**:
```javascript
const event = EventService.getAllEvents().find(e => e.id === eventId);
console.log({
  description: event.description,
  eventlog: event.eventlog
});
// 预期:
// description: "新的描述内容"
// eventlog.html: "新的描述内容"
// eventlog.plainText: "新的描述内容"
// eventlog.slateJson: "[{\"type\":\"paragraph\",\"children\":[{\"text\":\"新的描述内容\"}]}]"
// eventlog.syncState.contentHash: "已更新"
```

**验证点**:
- ✅ `description` → `eventlog` 自动同步
- ✅ `eventlog.updatedAt` 已更新
- ✅ `eventlog.syncState.contentHash` 已更新
- ✅ 控制台显示同步日志：
  ```
  [EventService] description 增量更新 → 同步到 eventlog
  ```

---

### 场景 5: 更新 eventlog（同步到 description）

**步骤**:
1. 模拟更新 `eventlog` 字段（通过 EventService）：
   ```javascript
   const newEventLog = {
     content: '[{"type":"paragraph","children":[{"text":"富文本内容"}]}]',
     descriptionHtml: '<p>富文本内容</p>',
     descriptionPlainText: '富文本内容',
     attachments: [],
     versions: [],
     syncState: { status: 'pending' },
     createdAt: '2024-01-15T10:00:00Z',
     updatedAt: '2024-01-15T10:00:00Z'
   };
   
   EventService.updateEvent(eventId, { eventlog: newEventLog });
   ```
2. 查看事件对象

**预期结果**:
```javascript
const event = EventService.getAllEvents().find(e => e.id === eventId);
console.log(event.description);
// 预期输出: "<p>富文本内容</p>" 或 "富文本内容"
```

**验证点**:
- ✅ `eventlog` → `description` 自动同步
- ✅ 控制台显示同步日志：
  ```
  [EventService] eventlog 增量更新 → 同步到 description
  ```

---

### 场景 6: 迁移失败处理

**模拟步骤**:
1. 修改一个事件的 `eventlog` 为非法格式（如 `eventlog: 123`）
2. 刷新页面，触发迁移

**预期结果**:
```
❌ [EventLogMigration] Failed to migrate event [eventId]: ...
📊 [EventLogMigration] Migration stats: { total: 50, migrated: 49, skipped: 0, failed: 1 }
```

**验证点**:
- ✅ 迁移不会因单个失败而中断
- ✅ 统计数据正确记录失败数量
- ✅ 应用仍能正常启动

---

### 场景 7: 回滚测试

**步骤**:
1. 打开控制台
2. 执行回滚命令：
   ```javascript
   const EventLogMigrationService = await import('./services/EventLogMigrationService').then(m => m.EventLogMigrationService);
   const result = EventLogMigrationService.restoreBackup();
   console.log(result);
   ```
3. 刷新页面

**预期结果**:
```
🔄 [EventLogMigration] Restore backup: 50 events restored
```

**验证点**:
- ✅ 事件数据恢复到迁移前状态
- ✅ `eventlog` 字段恢复为旧格式（字符串）
- ✅ 刷新后会再次触发迁移

---

## 🔍 调试工具

### 1. 查看所有事件的 eventlog 格式

```javascript
const events = JSON.parse(localStorage.getItem('remarkable_events'));
const formatStats = events.reduce((acc, e) => {
  const type = typeof e.eventlog;
  acc[type] = (acc[type] || 0) + 1;
  return acc;
}, {});
console.log('EventLog 格式统计:', formatStats);
// 预期输出: { "object": 50 } (全部迁移完成)
// 或: { "string": 20, "object": 30 } (部分迁移)
```

### 2. 检查备份是否存在

```javascript
const backup = localStorage.getItem('events_backup_migration');
if (backup) {
  const backupEvents = JSON.parse(backup);
  console.log('备份数量:', backupEvents.length);
  console.log('备份示例:', backupEvents[0]);
} else {
  console.log('无备份（未迁移或备份已删除）');
}
```

### 3. 手动触发迁移

```javascript
const EventLogMigrationService = await import('./services/EventLogMigrationService').then(m => m.EventLogMigrationService);
const stats = await EventLogMigrationService.migrateAllEvents();
console.log('迁移结果:', stats);
```

### 4. 查看单个事件完整结构

```javascript
const events = JSON.parse(localStorage.getItem('remarkable_events'));
const event = events[0];
console.log(JSON.stringify(event, null, 2));
```

---

## ✅ 验收标准

| 测试项 | 状态 | 备注 |
|--------|------|------|
| 旧数据自动迁移 | ⏳ | 场景 1 |
| 重复启动不重复迁移 | ⏳ | 场景 2 |
| 新事件使用新格式 | ⏳ | 场景 3 |
| description → eventlog 同步 | ⏳ | 场景 4 |
| eventlog → description 同步 | ⏳ | 场景 5 |
| 迁移失败不影响启动 | ⏳ | 场景 6 |
| 备份恢复功能正常 | ⏳ | 场景 7 |

**通过标准**: 全部测试项 ✅

---

## 🐛 常见问题

### 1. 迁移后事件丢失

**原因**: 迁移过程中出错
**解决**: 
```javascript
const EventLogMigrationService = await import('./services/EventLogMigrationService').then(m => m.EventLogMigrationService);
EventLogMigrationService.restoreBackup();
```

### 2. 控制台没有迁移日志

**原因**: 已经全部迁移完成
**验证**:
```javascript
const events = JSON.parse(localStorage.getItem('remarkable_events'));
console.log('第一个事件:', events[0].eventlog);
```

### 3. description 和 eventlog 不同步

**原因**: 更新时同时设置了两个字段
**解决**: 单独更新一个字段，让同步机制自动处理

---

## 📊 性能监控

### 迁移耗时

```javascript
// 在 App.tsx 中添加性能监控
const t0 = performance.now();
await EventLogMigrationService.migrateAllEvents();
const t1 = performance.now();
console.log(`迁移耗时: ${(t1 - t0).toFixed(2)}ms`);
```

**预期**: 
- 100 条事件: < 100ms
- 1000 条事件: < 1s

---

## 🔗 相关文档

- [EVENTLOG_REFACTOR_PLAN.md](./EVENTLOG_REFACTOR_PLAN.md) - 重构计划
- [TimeLog PRD](./PRD/TimeLog_&_Description_PRD.md) - 功能设计
