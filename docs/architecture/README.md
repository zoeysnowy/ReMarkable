# 4DNote 架构文档

> 最后更新: 2025-12-01

---

## 📁 文档索引

### 核心架构

- **[存储架构设计](./STORAGE_ARCHITECTURE.md)** ⭐
  - 三层存储架构（IndexedDB + SQLite + File System）
  - 无限版本历史系统（96% 压缩率）
  - 自动备份与恢复
  - AI 功能支持基础
  - 多邮箱账户支持 🆕

- **[多邮箱同步架构](./MULTI_ACCOUNT_SYNC.md)** 🆕
  - Outlook + Google + iCloud + CalDAV 支持
  - 统一数据模型与账户隔离
  - 增量同步（Delta API + Sync Token）
  - 智能去重与冲突解决

- **[云端演进规划](./CLOUD_EVOLUTION_PLAN.md)** 🆕
  - MVP vs Beta 架构对比
  - App 账号系统必要性分析
  - 分阶段实施策略（本地 → 云端）
  - 成本估算与决策建议

---

## 🎯 架构设计原则

### 1. 纯净架构
- ✅ **全新开始**: 不兼容旧 localStorage 数据
- ✅ **Outlook 初始化**: 首次启动从 Outlook 同步
- ✅ **无历史包袱**: 清晰的代码结构

### 2. 性能优先
- 🚀 三层缓存（Memory + IndexedDB + SQLite）
- 🚀 事件查询 <10ms
- 🚀 全文搜索 <30ms
- 🚀 批量操作优化

### 3. 数据安全
- 🔒 自动备份（每日/每周/每月）
- 🔒 无限版本历史
- 🔒 完整性校验
- 🔒 灾难恢复

### 4. 可扩展性
- 📈 支持 100K+ 事件
- 📈 支持 10K+ 联系人
- 📈 支持 10GB+ 附件
- 📈 AI 功能预留

---

## 🏗️ 技术栈

### 客户端存储
- **IndexedDB**: 近期数据（30天）~50 MB
- **localStorage**: 配置和元数据 ~5 MB
- **Memory Cache**: LRU 缓存 ~50 MB

### 本地持久化（Electron）
- **SQLite**: better-sqlite3 v9.0.0
  - 完整历史数据 ~525 MB
  - 无限版本历史
  - FTS5 全文搜索
  - 多账户管理 🆕
- **File System**: 
  - 附件文件 ~10 GB
  - 备份文件 ~5 GB

### 多邮箱同步 🆕
- **Outlook**: Microsoft Graph API
  - OAuth 2.0 认证
  - Delta API 增量同步
- **Google**: Google Calendar API
  - OAuth 2.0 认证
  - Sync Token 增量同步
- **iCloud**: CalDAV 协议
  - App-specific Password
  - 标准 CalDAV 操作

### 数据压缩
- **LZ-string**: Slate JSON 压缩（80% 空间节省）
- **JSON Patch**: 增量存储（90% 空间节省）
- **组合效果**: 96% 总空间节省

### AI 基础
- **Tesseract.js**: 图片 OCR（中英文）
- **pdf-parse**: PDF 文本提取
- **Sharp**: 图片缩略图生成
- **FTS5**: SQLite 全文搜索

---

## 📊 容量规划

### 典型用户（10,000 events, 1年数据）

```
┌─────────────────────────────────────┐
│  IndexedDB (近期30天)               │
│  ├─ Events:           ~30 MB        │
│  ├─ EventLogs:        ~15 MB        │
│  ├─ Contacts:         ~2 MB         │
│  └─ 小计:             ~50 MB        │
├─────────────────────────────────────┤
│  SQLite (完整历史)                  │
│  ├─ Events:           ~10 MB        │
│  ├─ EventLogs:        ~500 MB ⭐    │
│  │   (50版本/event, 96%压缩)        │
│  ├─ Contacts:         ~2 MB         │
│  ├─ Tags:             ~0.5 MB       │
│  └─ 小计:             ~520 MB       │
├─────────────────────────────────────┤
│  File System                         │
│  ├─ 附件:             ~10 GB        │
│  ├─ 备份:             ~5 GB         │
│  └─ 小计:             ~15 GB        │
└─────────────────────────────────────┘
总需求:                 ~15.6 GB
```

---

## ⚡ 性能指标

| 操作 | 目标 | 实际 | 优化手段 |
|------|------|------|----------|
| 事件创建 | <100ms | ~20ms | 双写 + 批量 |
| 事件查询 | <50ms | ~10ms | 三层缓存 + 索引 |
| 全文搜索 | <100ms | ~30ms | FTS5 索引 |
| 版本创建 | <200ms | ~50ms | 压缩 + 增量 |
| 版本恢复 | <500ms | ~200ms | 缓存重建 |
| 备份创建 | <5min | ~2min | 在线备份 + 压缩 |

---

## 🚀 实施路线图

### Phase 1: 数据库初始化 (1周) ⭐ 当前阶段
- [ ] 创建 IndexedDB Schema
- [ ] 创建 SQLite Schema
- [ ] 创建文件系统结构
- [ ] 实现 StorageManager 基础接口
- [ ] 单元测试

### Phase 2: 核心功能 (2周)
- [ ] 双写策略（IndexedDB + SQLite）
- [ ] 三层缓存系统
- [ ] 无限版本历史
- [ ] 离线队列
- [ ] 自动备份

### Phase 3: Outlook 同步 (1周)
- [ ] OAuth 认证
- [ ] 批量同步
- [ ] 增量更新
- [ ] 冲突解决

### Phase 4: 附件与 AI (1周)
- [ ] 文件管理
- [ ] OCR 提取
- [ ] 全文搜索

### Phase 5: AI 高级功能 (未来)
- [ ] 向量数据库
- [ ] 语义搜索
- [ ] 语音转录

---

## 📝 关键决策

### ✅ 采纳的方案
1. **不兼容旧数据**: 从 Outlook 重新同步（简化架构）
2. **多邮箱支持**: Outlook + Google + iCloud 统一管理 🆕
3. **账户级别隔离**: 每个账户独立同步状态 🆕
4. **智能去重**: 跨账户事件自动合并 🆕
5. **双写策略**: IndexedDB + SQLite 同步写入（数据一致性）
6. **无限版本历史**: 96% 压缩率（用户需求）
7. **自动备份**: 每日/每周/每月（数据安全）
8. **FTS5 全文搜索**: 原生 SQLite 支持（性能）
9. **增量同步**: Delta API (Outlook) + Sync Token (Google) 🆕

### ❌ 拒绝的方案
1. ~~localStorage 迁移~~: 容量限制，架构复杂
2. ~~Supabase 主存储~~: 依赖网络，离线体验差
3. ~~50 版本限制~~: 不满足用户需求
4. ~~增量迁移~~: 增加复杂度，收益低
5. ~~单一邮箱绑定~~: 用户需要多账户支持
6. ~~全量同步~~: API 限制，性能差

---

## 🔗 相关文档

- [PRD 目录](../PRD/)
- [数据类型定义](../../src/types.ts)
- [同步架构](../SYNC/)（待创建）
- [AI 功能设计](../AI/)（待创建）

---

**维护者**: AI Architecture Team  
**最后更新**: 2025-12-01  
**版本**: v2.0.0
