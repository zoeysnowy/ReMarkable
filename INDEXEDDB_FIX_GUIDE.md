# IndexedDB 修复指南

## 问题背景

之前遇到 IndexedDB 损坏的 "Internal error"，我们实施了一个临时方案：让应用在 IndexedDB 失败时跳过并仅使用 SQLite。但这不是正确的做法 —— IndexedDB 应该被正确清理和重新初始化。

## 正确的解决方案

### 1. Electron 主进程清理 API

**文件**: `electron/main.js`

```javascript
// 🗑️ 清理存储数据（包括IndexedDB）
ipcMain.handle('clear-storage-data', createIPCHandler('clear-storage-data', async () => {
  const { session } = require('electron');
  try {
    console.log('🗑️ [Main] 开始清理存储数据...');
    await session.defaultSession.clearStorageData({
      storages: ['indexdb', 'localstorage', 'cookies', 'serviceworkers', 'cachestorage']
    });
    console.log('✅ [Main] 存储数据清理完成');
    return { success: true };
  } catch (error) {
    console.error('❌ [Main] 清理存储数据失败:', error);
    return { success: false, error: error.message };
  }
}));
```

### 2. Preload 桥接

**文件**: `electron/preload.js`

```javascript
// 🗑️ 清理存储数据（包括IndexedDB）
clearStorageData: () => ipcRenderer.invoke('clear-storage-data'),
```

### 3. 开发工具集成

**文件**: `src/utils/dev-reset.ts`

更新了 `resetAllData()` 和 `clearIndexedDB()` 函数：

- 优先使用 Electron 的 `clearStorageData()` API
- 在 Electron 环境中能彻底清理 IndexedDB
- 浏览器环境回退到标准 API

### 4. StorageManager 严格模式

**文件**: `src/services/storage/StorageManager.ts`

移除了 IndexedDB 错误容忍代码：

```typescript
// ❌ 旧代码（错误容忍）
if (this.indexedDBService) {
  await this.indexedDBService.createEvent(event);
}

// ✅ 新代码（严格模式）
await this.indexedDBService.createEvent(event);
```

现在如果 IndexedDB 失败，应用会抛出错误而不是静默跳过。这能帮助我们及时发现问题。

## 测试流程

### 方法 1: 自动测试（推荐）

在 Console 运行：

```javascript
testIndexedDBFix()
```

这会：
1. ✅ 使用 Electron API 清理存储
2. ✅ 重新初始化 StorageManager
3. ✅ 测试创建事件（双写）
4. ✅ 验证 IndexedDB 和 SQLite 数据一致性

### 方法 2: 手动测试

1. **清理数据**：
   ```javascript
   resetAllData()
   ```

2. **重启应用**：
   - 完全关闭 Electron
   - 重新运行 `npm run e`

3. **验证功能**：
   - 打开 DevTools → Application → IndexedDB
   - 确认 "ReMarkableDB" 数据库存在
   - 创建测试事件
   - 确认数据同时写入 IndexedDB 和 SQLite

## 技术细节

### 为什么不能直接用 `indexedDB.deleteDatabase()`？

在 Electron 环境中，`indexedDB.deleteDatabase()` 可能会遇到：
- 文件系统锁定
- 多进程访问冲突
- 缓存未清理

Electron 的 `session.clearStorageData()` 能：
- ✅ 清理所有持久化存储
- ✅ 释放所有文件锁
- ✅ 清除内存缓存
- ✅ 重置存储配额

### 双写策略

StorageManager 现在严格执行双写：

```typescript
// 创建事件时同步写入
await this.indexedDBService.createEvent(event);  // 必须成功
await this.sqliteService.createEvent(event);      // 可选（仅Electron）

// 查询时优先级：
// 1. SQLite（如果可用）- 更快，支持复杂查询
// 2. IndexedDB（Web环境）
// 3. 内存缓存（降级）
```

## 故障排查

### 如果 `testIndexedDBFix()` 失败

1. **检查 Console 错误**：
   - 查看是否有 IndexedDB 权限错误
   - 确认 Electron IPC 是否正常

2. **手动清理**：
   ```powershell
   # 停止应用
   # 删除数据库文件
   Remove-Item -Recurse -Force database/
   New-Item -ItemType Directory database/
   
   # 清理 Electron 用户数据
   Remove-Item -Recurse -Force "$env:LOCALAPPDATA/remarkable-desktop"
   ```

3. **DevTools 手动清理**：
   - F12 打开 DevTools
   - Application → Clear storage
   - 勾选所有选项
   - Clear site data

### 如果双写失败

检查 StorageManager 初始化日志：

```
[StorageManager] Initializing storage services...
[StorageManager] ✅ IndexedDB initialized
[StorageManager] ✅ SQLite enabled (Electron)
[StorageManager] ✅ Storage services initialized
```

如果 IndexedDB 初始化失败，应用会抛出错误而不是继续运行。

## 下一步

修复完成后，运行完整的 CRUD 测试：

```javascript
testCRUDIntegration()
```

预期结果：
- ✅ 7/7 测试通过
- ✅ IndexedDB 和 SQLite 数据一致
- ✅ 缓存正常工作
- ✅ 批量操作正常

## 相关文件

- `electron/main.js` - IPC 清理处理器
- `electron/preload.js` - IPC 桥接
- `src/utils/dev-reset.ts` - 开发工具
- `src/services/storage/StorageManager.ts` - 存储管理器
- `src/tests/test-indexeddb-fix.ts` - 修复验证测试

## 版本信息

- StorageManager: v1.1.0 → v1.2.0
- 新增功能: Electron 存储清理 API
- 修复: 移除 IndexedDB 错误容忍代码
- 状态: ✅ 修复完成，等待测试验证
