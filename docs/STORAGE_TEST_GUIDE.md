# Storage Module Test Guide

## 测试环境说明

我们的存储架构支持 **Web** 和 **Electron** 两种环境，测试方法略有不同：

### 🌐 Web 环境（仅 IndexedDB）

**启动方式**：
```bash
npm run dev
```

**测试方式**：
```javascript
// 在浏览器开发者工具控制台运行
await testStorageModule()
```

**测试内容**：
- ✅ IndexedDB 初始化（8个 object stores）
- ✅ Account CRUD
- ✅ Calendar CRUD
- ✅ Event CRUD
- ✅ 批量创建（5 events）
- ✅ 查询（with filters）
- ✅ 存储统计
- ✅ 数据清理

**预期结果**：
```
🧪 Storage Module Test Started
✅ All 8 tests passed!
```

---

### 🖥️ Electron 环境（IndexedDB + SQLite）

**启动方式**：
```bash
npm run e
```

**测试方式 1 - IndexedDB 测试**：
```javascript
// 在 Electron 开发者工具控制台运行
await testStorageModule()
```

**测试方式 2 - SQLite 测试**：
```javascript
// 在 Electron 开发者工具控制台运行
await testSQLiteModule()
```

**测试内容（SQLite）**：
1. ✅ SQLite 初始化（10个表 + WAL + FTS5）
2. ✅ Account CRUD
3. ✅ Calendar CRUD
4. ✅ Event CRUD
5. ✅ 批量创建（5 events，事务支持）
6. ✅ 查询（with filters + pagination）
7. ✅ FTS5 全文搜索（<30ms）
8. ✅ 存储统计
9. ✅ Event Update
10. ✅ 数据清理

**预期结果**：
```
🧪 SQLite Storage Module Test Started
✅ All SQLite tests passed!
```

---

## 测试覆盖率

### IndexedDB 测试
| 功能 | 测试状态 | 测试文件 |
|------|----------|----------|
| 初始化 | ✅ Passed | test-storage.ts |
| Account CRUD | ✅ Passed | test-storage.ts |
| Calendar CRUD | ✅ Passed | test-storage.ts |
| Event CRUD | ✅ Passed | test-storage.ts |
| 批量操作 | ✅ Passed | test-storage.ts |
| 查询系统 | ✅ Passed | test-storage.ts |
| 存储统计 | ✅ Passed | test-storage.ts |
| 数据清理 | ✅ Passed | test-storage.ts |

### SQLite 测试
| 功能 | 测试状态 | 测试文件 |
|------|----------|----------|
| 初始化（WAL + FTS5） | 📋 Pending | test-storage-sqlite.ts |
| Account CRUD | 📋 Pending | test-storage-sqlite.ts |
| Calendar CRUD | 📋 Pending | test-storage-sqlite.ts |
| Event CRUD | 📋 Pending | test-storage-sqlite.ts |
| 批量操作（事务） | 📋 Pending | test-storage-sqlite.ts |
| 查询系统 | 📋 Pending | test-storage-sqlite.ts |
| FTS5 全文搜索 | 📋 Pending | test-storage-sqlite.ts |
| 存储统计 | 📋 Pending | test-storage-sqlite.ts |
| Update 操作 | 📋 Pending | test-storage-sqlite.ts |
| 数据清理 | 📋 Pending | test-storage-sqlite.ts |

### StorageManager 双写测试
| 功能 | 测试状态 | 说明 |
|------|----------|------|
| 环境检测 | ✅ Implemented | Web: IndexedDB only, Electron: Both |
| createEvent 双写 | ✅ Implemented | IndexedDB + SQLite |
| updateEvent 双写 | ✅ Implemented | IndexedDB + SQLite |
| deleteEvent 双写 | ✅ Implemented | Soft delete on both |
| LRU Cache | ✅ Implemented | 50 MB (30+10+10) |
| 动态导入 | ✅ Implemented | SQLite only in Electron |

---

## 故障排查

### 问题 1: "better-sqlite3 not available"
**原因**: 在 Web 环境尝试使用 SQLite
**解决**: SQLite 仅在 Electron 环境可用，使用 `npm run e` 启动

### 问题 2: "Failed to resolve import better-sqlite3"
**原因**: Vite 尝试静态解析 Node.js 模块
**解决**: ✅ 已修复（commit 03c5f39），通过动态 import() 实现

### 问题 3: IndexedDB 测试在 Electron 中失败
**原因**: Electron 可能有不同的 IndexedDB 实现
**解决**: 检查 Electron 版本和 Chrome 版本兼容性

### 问题 4: SQLite 数据库文件权限错误
**原因**: Electron 应用没有写入权限
**解决**: 检查 `database/` 目录权限，或使用 `app.getPath('userData')`

---

## 性能基准

### IndexedDB 性能
- **单次写入**: ~1ms
- **批量写入** (100 events): ~50ms
- **查询** (with index): ~5ms
- **全表扫描** (10K events): ~100ms

### SQLite 性能（目标）
- **单次写入**: ~0.5ms (WAL mode)
- **批量写入** (1000 events): ~100ms (transaction)
- **FTS5 搜索** (100K events): <30ms
- **索引查询**: <5ms
- **数据库大小**: ~525 MB (1年数据)

---

## 下一步测试计划

### A. 完成 SQLite 测试验证 ✅ **当前任务**
1. 启动 Electron: `npm run e`
2. 运行测试: `await testSQLiteModule()`
3. 验证所有 10 个测试通过
4. 检查性能指标（FTS5 <30ms）

### B. 集成测试
1. 测试双写一致性（create/update/delete）
2. 测试 Web → Electron 数据迁移
3. 测试并发读写（WAL mode）
4. 测试错误恢复机制

### C. 压力测试
1. 插入 10,000 events
2. 验证 FTS5 搜索性能
3. 验证数据库文件大小
4. 验证内存使用（LRU cache）

### D. FileSystemService 开发
1. 实现附件存储
2. 实现备份管理
3. 实现日志系统
4. 完成三层架构

---

## 已知限制

1. **better-sqlite3 仅支持 Electron**
   - Web 环境无法使用 SQLite
   - 需要 Node.js 原生模块支持

2. **FTS5 索引构建时间**
   - 初次构建可能较慢（10K events ~1s）
   - 后续增量更新很快（<1ms）

3. **数据库文件锁定**
   - WAL mode 需要文件系统支持
   - 网络驱动器可能有问题

4. **跨平台路径**
   - 需要使用 `path.join()` 处理路径
   - Electron `app.getPath()` API

---

## 测试日志

### 2025-12-01 - Phase 1 完成
- ✅ IndexedDB 测试全部通过（8/8）
- ✅ SQLite 服务实现完成（10 tables）
- ✅ 双写策略实现完成
- ✅ 动态导入修复完成（Web/Electron 双支持）
- 📋 SQLite 测试待验证（10 tests）

---

## 参考文档
- [STORAGE_ARCHITECTURE.md](../docs/architecture/STORAGE_ARCHITECTURE.md)
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [better-sqlite3 文档](https://github.com/WiseLibs/better-sqlite3)
- [SQLite FTS5](https://www.sqlite.org/fts5.html)
