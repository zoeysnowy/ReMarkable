# 存储架构 - 待完成任务清单

> **最后更新**: 2025-12-02  
> **当前状态**: Phase 1-2 已完成 ✅  
> **测试状态**: CRUD集成测试 7/7 通过 (100%) 🎉

---

## ✅ 已完成 (Phase 1-2)

### 核心存储层
- ✅ IndexedDB Schema 设计与实现
- ✅ SQLite 数据库设计（24字段）
- ✅ StorageManager 双写策略（IndexedDB + SQLite）
- ✅ 查询优化（优先SQLite）
- ✅ FTS5全文搜索修复（外部内容表触发器）
- ✅ CRUD集成测试（100%通过）

### 关键修复
- ✅ **FTS5 UPDATE触发器语法错误修复**
  - 问题：`SQLITE_CORRUPT_VTAB` 错误导致UPDATE失败
  - 根因：FTS5外部内容表不支持常规DELETE/UPDATE语句
  - 解决：使用FTS5特殊命令 `INSERT INTO fts(fts) VALUES ('delete')`
  - 结果：UPDATE操作100%成功，搜索功能正常

---

## 🚧 待完成任务

### 优先级 P0 (本周完成)

#### 1. 清理调试日志
**位置**: 
- `src/services/storage/SQLiteService.ts` (行696-860)
- `electron/main.js` (行614-670)

**任务**:
- [ ] 移除或条件化详细参数日志（仅在开发模式启用）
- [ ] 保留关键错误日志和性能监控
- [ ] 添加日志级别配置（ERROR/WARN/INFO/DEBUG）

**影响**: 减少生产环境日志噪音，提升性能

---

#### 2. FTS5 搜索单元测试
**位置**: `src/tests/test-storage-fts5.ts` (新建)

**任务**:
- [ ] 测试基础搜索（标题、描述、地点）
- [ ] 测试更新后搜索（验证触发器正常）
- [ ] 测试中文搜索（分词测试）
- [ ] 测试模糊搜索（MATCH语法）
- [ ] 性能测试（<50ms查询延迟）

**用例**:
```typescript
// 场景1: 事件创建后搜索
createEvent({ simpleTitle: '重要会议' });
searchEvents('重要'); // 应找到事件

// 场景2: 事件更新后搜索
updateEvent(id, { simpleTitle: '非常重要的会议' });
searchEvents('非常'); // 应找到更新后的事件

// 场景3: 事件删除后搜索
deleteEvent(id);
searchEvents('重要'); // 不应找到已删除事件
```

---

#### 3. FTS5 外部内容表文档化
**位置**: `docs/technical/FTS5_EXTERNAL_CONTENT_PATTERN.md` (新建)

**内容**:
- [ ] 外部内容表概念说明
- [ ] 为什么使用外部内容表（节省空间）
- [ ] 正确的触发器语法
- [ ] 常见错误和解决方案
- [ ] 性能优化建议
- [ ] 代码示例

**关键点**:
```markdown
### FTS5 外部内容表触发器正确写法

❌ **错误** (导致 SQLITE_CORRUPT_VTAB):
```sql
CREATE TRIGGER fts_update AFTER UPDATE ON events BEGIN
    DELETE FROM events_fts WHERE rowid = old.rowid;  -- 错误！
    INSERT INTO events_fts(rowid, ...) VALUES (new.rowid, ...);
END;
```

✅ **正确** (使用 FTS5 'delete' 命令):
```sql
CREATE TRIGGER fts_update AFTER UPDATE ON events BEGIN
    -- 使用 FTS5 特殊命令删除旧索引
    INSERT INTO events_fts(events_fts, rowid, ...)
    VALUES ('delete', old.rowid, ...);
    
    -- 插入新索引
    INSERT INTO events_fts(rowid, ...) VALUES (new.rowid, ...);
END;
```
```

---

### 优先级 P1 (下周完成)

#### 4. 数据库健康监控
**位置**: `src/services/storage/DatabaseHealthMonitor.ts` (新建)

**任务**:
- [ ] 完整性检查（PRAGMA integrity_check）
- [ ] 大小监控（超过阈值报警）
- [ ] 索引使用率分析（EXPLAIN QUERY PLAN）
- [ ] 性能慢查询日志（>100ms）
- [ ] 自动VACUUM优化（每周）

**监控指标**:
```typescript
interface HealthReport {
  timestamp: string;
  status: 'healthy' | 'warning' | 'critical';
  checks: {
    integrity: { passed: boolean; errors?: string[] };
    size: { currentMB: number; limitMB: number; usage: string };
    indexes: { total: number; unused: string[] };
    performance: { avgQueryMs: number; slowQueries: number };
  };
}
```

---

#### 5. 备份恢复系统
**位置**: `src/services/storage/BackupManager.ts` (已有架构设计)

**任务**:
- [ ] 实现每日自动备份（3:00 AM）
- [ ] 实现每周备份（周日 2:00 AM）
- [ ] 实现每月备份（1号 1:00 AM）
- [ ] 备份压缩（gzip）
- [ ] 备份保留策略（7天/8周/12个月）
- [ ] 恢复功能（带完整性验证）
- [ ] 备份UI界面（查看/恢复/删除）

---

#### 6. 存储统计仪表板
**位置**: `src/components/settings/StorageStatsPanel.tsx` (新建)

**功能**:
- [ ] 显示存储使用情况（IndexedDB/SQLite/文件系统）
- [ ] 显示事件数量、版本数量、附件数量
- [ ] 显示压缩率统计
- [ ] 显示备份列表
- [ ] 手动触发备份/恢复
- [ ] 数据库优化（VACUUM）

**UI设计**:
```
┌──────────────────────────────────────────────┐
│ 存储使用情况                                  │
├──────────────────────────────────────────────┤
│ 📊 IndexedDB:       50 MB / 250 MB (20%)     │
│ 💾 SQLite:         525 MB / 10 GB (5%)       │
│ 📁 附件文件:        10 GB / 50 GB (20%)      │
├──────────────────────────────────────────────┤
│ 📝 事件总数:        10,245                   │
│ 📚 版本历史:        512,250 (压缩率 96%)     │
│ 📎 附件数量:        1,523                    │
├──────────────────────────────────────────────┤
│ [🔄 备份数据库]  [♻️ 优化数据库]  [📥 恢复] │
└──────────────────────────────────────────────┘
```

---

### 优先级 P2 (两周内完成)

#### 7. 版本历史UI
**位置**: `src/components/event/VersionHistoryModal.tsx` (新建)

**功能**:
- [ ] 显示事件所有版本列表
- [ ] 版本对比（diff显示）
- [ ] 恢复到指定版本
- [ ] 版本删除（释放空间）
- [ ] 版本导出（JSON）

**架构设计中已有的后端支持**:
- `VersionHistoryManager.getVersionContent()`
- `VersionHistoryManager.compareVersions()`
- `VersionHistoryManager.restoreVersion()`

---

#### 8. 离线队列UI
**位置**: `src/components/sync/SyncQueuePanel.tsx` (新建)

**功能**:
- [ ] 显示待同步队列（pending/processing/failed）
- [ ] 手动重试失败项
- [ ] 查看错误详情
- [ ] 清空队列
- [ ] 同步进度显示

---

#### 9. 性能监控面板
**位置**: `src/components/debug/PerformanceMonitor.tsx` (新建)

**功能**:
- [ ] 实时查询延迟监控
- [ ] 慢查询日志
- [ ] 内存缓存命中率
- [ ] IndexedDB vs SQLite 查询对比
- [ ] FTS5 搜索性能

---

### 优先级 P2 (两周内完成) - 🔥 调整为刚需

#### 10. EventLog 富媒体支持 ⭐ **刚需功能**
**位置**: `src/components/ModalSlate/` + `src/services/AttachmentService.ts`

**核心功能**:
- [ ] **Slate 编辑器图片节点**
  - [ ] 图片拖拽上传（粘贴图片自动上传）
  - [ ] 图片内联显示（可调整大小）
  - [ ] 图片说明文字
  - [ ] 每张图片带 timestamp
  
- [ ] **批量上传图册**
  - [ ] 支持一次上传几百/几千张图片
  - [ ] 自动生成缩略图（提升性能）
  - [ ] 按时间排序自动插入到 EventLog
  
- [ ] **图册预览模式** (Gallery Mode)
  - [ ] 切换按钮：文字+图片 ↔ 纯图片
  - [ ] 瀑布流/网格布局（仅显示图片）
  - [ ] 幻灯片播放
  - [ ] 图片放大查看
  - [ ] 批量选择/删除

**技术方案**:
```typescript
// Slate 图片节点结构
interface ImageElement {
  type: 'image';
  url: string;           // 本地路径（file://...）
  attachmentId: string;  // 关联附件ID
  width?: number;
  height?: number;
  caption?: string;      // 图片说明
  timestamp: string;     // 拍摄/上传时间
  children: [{ text: '' }];
}

// EventLog 附件引用
interface EventLog {
  slateJson: string;     // 包含 ImageElement 节点
  attachmentIds: string[]; // 所有附件ID（快速查询）
  attachmentCount: {
    images: number;
    videos: number;
    audios: number;
    documents: number;
  };
}
```

**UI 设计**:
```
┌─────────────────────────────────────────────┐
│ EventLog 编辑器                [📷 图册模式] │
├─────────────────────────────────────────────┤
│ 今天去了故宫，天气很好 ☀️                    │
│                                             │
│ ┌─────────────┐  ← 图片可以内联在文本中      │
│ │   故宫大门   │                             │
│ │  [Image]    │  (timestamp: 14:23)        │
│ └─────────────┘                             │
│                                             │
│ 人很多，但景色确实震撼...                     │
│                                             │
│ ┌──────┐ ┌──────┐ ┌──────┐                │
│ │[Img] │ │[Img] │ │[Img] │  ← 批量上传图片  │
│ └──────┘ └──────┘ └──────┘                │
│ 14:45    15:02    15:30                    │
└─────────────────────────────────────────────┘

[点击 "图册模式" 后]

┌─────────────────────────────────────────────┐
│ 图册预览                      [📝 编辑模式] │
├─────────────────────────────────────────────┤
│ ┌────┐ ┌────┐ ┌────┐ ┌────┐               │
│ │    │ │    │ │    │ │    │               │
│ │Img1│ │Img2│ │Img3│ │Img4│               │
│ │    │ │    │ │    │ │    │               │
│ └────┘ └────┘ └────┘ └────┘               │
│ 14:23  14:45  15:02  15:30                 │
│                                             │
│ ┌────┐ ┌────┐ ┌────┐                      │
│ │Img5│ │Img6│ │Img7│  ...                 │
│ └────┘ └────┘ └────┘                      │
│ 16:12  17:03  18:20                        │
│                                             │
│ [▶️ 幻灯片播放]  [🗑️ 批量删除]             │
└─────────────────────────────────────────────┘
```

**工作量**: 3-4天
**优先级**: P2 → **P1**（刚需）

---

### 优先级 P3 (后续迭代)

#### 11. 多邮箱同步集成 (Phase 3)
**时间**: 1-2周

**任务**:
- [ ] 统一认证抽象层（OAuth 2.0）
  - [ ] Outlook (Microsoft Graph API)
  - [ ] Google (Google Calendar API)
  - [ ] iCloud (CalDAV)
- [ ] 账户管理系统
  - [ ] 添加/删除账户UI
  - [ ] Token 自动刷新
  - [ ] 账户状态监控
- [ ] 批量同步
  - [ ] 并行拉取多账户事件
  - [ ] 智能去重（基于remoteEventId）
- [ ] 增量同步
  - [ ] Delta API (Outlook/Google)
  - [ ] Sync Token 管理
- [ ] 冲突解决
  - [ ] 时间戳优先策略
  - [ ] 用户手动选择

**数据库表已预留**:
- `accounts` 表
- `calendars` 表
- `event_calendar_mappings` 表
- `sync_queue` 表

---

#### 12. 视频/音频支持
**时间**: 1周

**任务**:
- [ ] 视频播放器（内联）
- [ ] 音频播放器（内联）
- [ ] 视频缩略图生成
- [ ] 音频波形图
- [ ] 视频/音频 OCR（语音转文字）

---

#### 13. AI 功能 (Phase 5)
**时间**: 未定

**任务**:
- [ ] 向量数据库集成（Pinecone/Weaviate）
- [ ] 语义搜索（非精确匹配）
- [ ] 语音转文字（会议记录）
- [ ] 智能推荐（相关事件）
- [ ] 自动标签建议

---

## 📊 进度总览

```
Phase 1-2: 核心存储层         ████████████████████ 100% ✅
Phase 3: 多邮箱同步          ░░░░░░░░░░░░░░░░░░░░   0% 🚧
Phase 4: 附件管理            ░░░░░░░░░░░░░░░░░░░░   0% 🔮
Phase 5: AI 功能             ░░░░░░░░░░░░░░░░░░░░   0% 🔮

总体进度:                    ████████░░░░░░░░░░░░  40%
```

---

## 🎯 本周目标 (2025-12-02 ~ 2025-12-08)

1. ✅ **已完成**: FTS5修复 + CRUD测试通过
2. 🎯 **P0任务**: 清理调试日志
3. 🎯 **P0任务**: FTS5搜索单元测试
4. 🎯 **P0任务**: FTS5外部内容表文档化

**预计完成时间**: 本周五 (2025-12-06)

---

## 🐛 已知问题

### 无（当前运行稳定）

**历史已修复问题**:
- ✅ FTS5 UPDATE触发器 `SQLITE_CORRUPT_VTAB` 错误 (2025-12-02修复)
- ✅ 参数数量不匹配 (21 params needed)
- ✅ null类型检查顺序错误 (`typeof null === 'object'`)
- ✅ `updated_at` 时间格式问题

---

## 📚 参考资料

### 技术文档
- [SQLite FTS5 官方文档](https://www.sqlite.org/fts5.html)
- [FTS5 外部内容表](https://www.sqlite.org/fts5.html#external_content_tables)
- [IndexedDB API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Electron 文件系统访问](https://www.electronjs.org/docs/latest/api/app#appgetpathname)

### 项目文档
- [STORAGE_ARCHITECTURE.md](./architecture/STORAGE_ARCHITECTURE.md)
- [STORAGEMANAGER_COMPLETION_REPORT.md](./STORAGEMANAGER_COMPLETION_REPORT.md)
- [STORAGE_TEST_GUIDE.md](./STORAGE_TEST_GUIDE.md)

---

**维护人**: Copilot + Zoey  
**最后更新**: 2025-12-02 03:15
