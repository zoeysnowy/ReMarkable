# 数据库损坏修复指南

## 🐛 问题症状

**错误日志**：
```
[IndexedDBService] Failed to open database: DOMException: Internal error.
[IndexedDBService] Attempting to reset corrupted database...
[IndexedDBService] ❌ Failed to delete database: DOMException: Internal error.
[StorageManager] ❌ Initialization failed: DOMException: Internal error.
```

**Chromium 底层错误**：
```
[ERROR:quota_database.cc(950)] Could not open the quota database, resetting.
[ERROR:quota_database.cc(955)] Failed to reset the quota database.
```

## 🔍 问题根源

Electron (Chromium) 的 **Quota Database 损坏**，导致：
- IndexedDB 无法打开
- 自动重置失败
- StorageManager 初始化失败
- TagService 无法加载数据

## ✅ 解决方案

### 方案 1：使用自动修复脚本（推荐）

**Windows 批处理**：
```bash
# 双击运行或在终端执行
fix-database.bat
```

**PowerShell 脚本**：
```powershell
# 在终端运行
.\fix-corrupted-database.ps1
```

**操作内容**：
- ✅ 删除损坏的 IndexedDB
- ✅ 删除损坏的 QuotaManager
- ✅ 删除损坏的 Session/Local Storage
- ✅ 删除损坏的 blob_storage
- ✅ **保留** SQLite 数据库 (`remarkable.db`)
- ✅ **保留** Attachments 附件

### 方案 2：手动清理

**步骤**：

1. **关闭应用**
   ```bash
   # 确保 Electron 完全退出
   taskkill /F /IM electron.exe
   ```

2. **删除损坏的数据库**
   ```powershell
   # Windows 路径
   $userData = "$env:APPDATA\remarkable-desktop"
   
   # 删除以下目录
   Remove-Item "$userData\IndexedDB" -Recurse -Force
   Remove-Item "$userData\QuotaManager" -Recurse -Force
   Remove-Item "$userData\Session Storage" -Recurse -Force
   Remove-Item "$userData\Local Storage" -Recurse -Force
   Remove-Item "$userData\blob_storage" -Recurse -Force
   ```

3. **保留重要数据**
   ```powershell
   # 保留 SQLite 数据库
   # $userData\remarkable.db
   
   # 保留附件
   # $userData\attachments\
   ```

4. **重启应用**
   ```bash
   npm run e
   ```

### 方案 3：核弹级清理（数据会丢失）

**仅在方案 1 和 2 失败后使用**：

1. **完全删除 userData 目录**
   ```powershell
   # ⚠️ 警告：会删除所有数据
   Remove-Item "$env:APPDATA\remarkable-desktop" -Recurse -Force
   ```

2. **重启应用**
   ```bash
   npm run e
   ```

3. **在 Console 重建 SQLite**（如果有备份）
   ```javascript
   rebuildSQLiteDatabase()
   ```

## 🧪 验证修复

启动应用后检查 Console：

**成功标志**：
```
[StorageManager] Initializing storage services...
[StorageManager] ✅ IndexedDB initialized
[StorageManager] ✅ SQLite initialized
🏷️ [TagService] Initializing with StorageManager...
✅ [TagService] Loaded tags from StorageManager: {count: X}
```

**失败标志**：
```
❌ [StorageManager] Initialization failed
❌ [TagService] Failed to initialize
```

## 📊 TagService 迁移状态

### ✅ 已完成的修复

1. **UUID ID 生成**
   - ✅ nanoid 集成
   - ✅ `generateEventId()`, `generateTagId()` 等
   - ✅ EventService 自动生成 UUID

2. **软删除机制**
   - ✅ Event 接口添加 `deletedAt`
   - ✅ EventService: `deleteEvent()`, `restoreEvent()`, `hardDeleteEvent()`
   - ✅ Tag 接口添加 `deletedAt`

3. **TagService 迁移**
   - ✅ 从 PersistentStorage 切换到 StorageManager
   - ✅ 移除所有 PersistentStorage 引用
   - ✅ 修复 `getFlatTags()` 同步降级逻辑
   - ✅ 添加 UUID ID 自动迁移
   - ✅ 添加软删除支持

4. **StorageManager Tag 方法**
   - ✅ `createTag()`, `updateTag()`, `deleteTag()`
   - ✅ `hardDeleteTag()`, `getTag()`, `queryTags()`
   - ✅ `batchCreateTags()`

5. **SQLiteService Tag CRUD**
   - ✅ Tags 表 Schema (已存在)
   - ✅ CRUD 方法实现
   - ✅ 自动过滤 `deleted_at IS NULL`

### ⚠️ 当前阻塞问题

**IndexedDB 损坏** 导致：
- StorageManager 初始化失败
- TagService 无法加载数据
- 默认标签无法保存

**解决方法**：执行上述修复方案

## 🔧 Console 调试工具

应用启动后，Console 会加载以下工具：

```javascript
// 1. 开发环境重置工具
resetAllData()           // 完全重置（带确认）
resetAllDataQuick()      // 快速重置（无确认）
clearIndexedDB()         // 仅清空 IndexedDB
nuclearReset()           // 核弹级清理指南

// 2. SQLite 测试工具
testSQLiteModule()       // 测试 SQLite CRUD
rebuildSQLiteDatabase()  // 重建损坏的 SQLite

// 3. CRUD 集成测试
testCRUDIntegration()    // 测试 Event CRUD

// 4. IndexedDB 修复测试
testIndexedDBFix()       // 测试 IndexedDB 修复
```

## 📝 修复后测试清单

- [ ] 1. 应用正常启动，无 DOMException 错误
- [ ] 2. Console 显示 "✅ IndexedDB initialized"
- [ ] 3. Console 显示 "✅ SQLite initialized"
- [ ] 4. TagService 加载成功，显示标签数量
- [ ] 5. DailyStatsCard 显示标签统计
- [ ] 6. 创建新标签，ID 格式为 `tag_xxxxxxxxxxxxxxxxxxxxx`
- [ ] 7. 创建新事件，ID 格式为 `event_xxxxxxxxxxxxxxxxxxxxx`
- [ ] 8. SQLite 数据库包含 tags 表和数据

## 🐛 常见问题

### Q1: 修复后仍然报错 "Internal error"
**A**: 检查文件是否被占用：
```powershell
# 结束所有 Electron 进程
taskkill /F /IM electron.exe
# 重试修复
.\fix-corrupted-database.ps1
```

### Q2: SQLite 数据库丢失
**A**: 检查备份：
```powershell
Get-ChildItem "$env:APPDATA\remarkable-desktop\*.db*"
```

### Q3: 标签数据丢失
**A**: TagService 会自动创建默认标签：
- 工作、生活、学习、健康、娱乐、其他

### Q4: 修复后无法保存数据
**A**: 检查权限：
```powershell
# 检查 userData 目录权限
icacls "$env:APPDATA\remarkable-desktop"
```

## 📞 技术支持

如果以上方案均失败，请提供以下信息：

1. **完整错误日志** (Console 输出)
2. **userData 目录结构**
   ```powershell
   Get-ChildItem "$env:APPDATA\remarkable-desktop" -Recurse | Select-Object FullName
   ```
3. **Electron 版本**
   ```javascript
   // 在 Console 运行
   process.versions
   ```
4. **操作系统版本**
   ```powershell
   Get-WmiObject -Class Win32_OperatingSystem | Select-Object Caption, Version
   ```

---

**最后更新**: 2025-12-02  
**相关文件**:
- `fix-database.bat` - 快速修复批处理
- `fix-corrupted-database.ps1` - PowerShell 修复脚本
- `src/services/storage/IndexedDBService.ts` - IndexedDB 服务
- `src/services/storage/SQLiteService.ts` - SQLite 服务
- `src/services/TagService.ts` - 标签服务
