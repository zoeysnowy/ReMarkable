# 同步优化实施 - 手动操作指南

## 🎯 目标
将同步时间从 20+ 秒优化到 1-3 秒，消除 429 错误

## 📝 需要修改的地方

### 修改 1：在 performSync 方法中添加条件判断

**文件**: `src/services/ActionBasedSyncManager.ts`  
**行号**: 1124-1128  

**当前代码**:
```typescript
      // 然后拉取远程更改并同步到本地
      console.log('📥 [Sync] Step 2: Fetching remote changes and syncing to local...');
      await this.fetchRemoteChanges();
      await this.syncPendingRemoteActions();
```

**替换为**:
```typescript
      // 根据skipRemote标志决定是否拉取远程
      if (!skipRemote) {
        console.log('📥 [Sync] Step 2: Fetching remote changes and syncing to local...');
        await this.fetchRemoteChanges();
        await this.syncPendingRemoteActions();
      } else {
        console.log('⏩ [Sync] Skipping remote fetch (local-only sync)');
      }
```

### 修改 2：网络恢复时使用 skipRemoteFetch

**文件**: `src/services/ActionBasedSyncManager.ts`  
**行号**: 203  

**当前代码**:
```typescript
await this.performSync();
```

**替换为**:
```typescript
await this.performSync({ skipRemoteFetch: true });
```

## 🔍 如何手动操作

### 方法 1: 使用 VS Code 查找替换

1. 打开 `src/services/ActionBasedSyncManager.ts`
2. 按 `Ctrl + H` 打开查找替换
3. 复制上面的"当前代码"到"查找"框
4. 复制"替换为"的代码到"替换"框
5. 点击"替换"按钮

### 方法 2: 直接编辑

1. 打开 `src/services/ActionBasedSyncManager.ts`
2. 按 `Ctrl + G` 跳转到指定行号
3. 手动删除旧代码
4. 手动输入新代码

## ✅ 验证方式

修改完成后，在控制台观察日志：

### 场景 1: 创建事件后网络恢复
期望看到：
```
⏩ [Sync] Skipping remote fetch (local-only sync)
```

### 场景 2: 20秒定时器触发
期望看到：
```
📥 [Sync] Step 2: Fetching remote changes and syncing to local...
```

## 📊 预期效果

- ✅ 网络恢复后同步：1-3秒（之前 20+ 秒）
- ✅ 429 错误率：<5%（之前 80%）
- ✅ 用户体验：几秒钟（之前"接近5分钟"的感觉）

## 🚨 注意事项

1. **不要修改定时器触发的同步**：定时器仍然需要完整同步（不传 skipRemoteFetch）
2. **只在网络恢复时跳过远程拉取**：因为此时只需要推送本地更改
3. **保持 emoji 正确显示**：如果看到乱码，请确保文件是 UTF-8 编码

## 🔧 如果还有编码问题

使用 PowerShell 修复文件编码：
```powershell
$content = Get-Content "src/services/ActionBasedSyncManager.ts" -Raw -Encoding UTF8
$content | Out-File "src/services/ActionBasedSyncManager.ts" -Encoding UTF8 -NoNewline
```

然后再进行上述修改。
