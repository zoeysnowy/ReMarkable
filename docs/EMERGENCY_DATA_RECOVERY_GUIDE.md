# 数据丢失问题 - 紧急修复指南

**问题**: ActionBasedSyncManager 同步失败导致大量事件被删除（1000+ → 400）

**根本原因**: 时间格式验证错误 - ActionBasedSyncManager 内部使用 ISO 8601 格式（`2025-11-25T13:00:00`），但 EventService 验证器要求空格分隔格式（`2025-11-25 13:00:00`）

---

## 🚨 紧急恢复步骤

### 第 1 步：立即备份当前数据

在浏览器控制台执行：

```javascript
// 备份当前 localStorage
const backup = {};
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  backup[key] = localStorage.getItem(key);
}
console.log('备份完成，共', Object.keys(backup).length, '个键');

// 保存备份到文件（可选）
const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `remarkable-backup-${new Date().toISOString()}.json`;
a.click();
```

### 第 2 步：运行数据恢复脚本

1. 打开浏览器控制台（F12）
2. 复制 `scripts/emergency-data-recovery.js` 的内容
3. 粘贴到控制台并执行
4. 查看恢复报告

```javascript
// 脚本会自动：
// - 扫描所有备份源
// - 合并当前数据和备份数据
// - 显示恢复摘要
```

### 第 3 步：应用恢复（如果恢复了数据）

如果脚本显示可以恢复数据，执行：

```javascript
// 应用恢复（脚本返回的对象中有此方法）
recoveryResult.applyRecovery();

// 或手动执行：
localStorage.setItem('remarkable-events', JSON.stringify(recoveryResult.recovery.mergedEvents));
location.reload();
```

### 第 4 步：修复时间格式问题

恢复数据后，运行时间格式修复脚本：

1. 复制 `scripts/fix-sync-time-validation.js` 的内容
2. 粘贴到控制台并执行
3. 刷新页面

---

## 🔧 代码层面的修复（已完成）

### 修复 1: ActionBasedSyncManager.ts

**问题**: 内部定义了错误的 `formatTimeForStorage` 函数

**修复**:
```typescript
// ❌ 旧代码（L7-35）- 返回 ISO 8601 格式
const formatTimeForStorage = (date: Date | string): string => {
  // ...
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}`; // 错误！
};

// ✅ 新代码 - 使用标准工具函数
import { formatTimeForStorage, parseLocalTimeString } from '../utils/timeUtils';
```

### 修复 2: safeFormatDateTime 方法

**问题**: 未检测已经是正确格式的字符串

**修复**:
```typescript
private safeFormatDateTime(dateInput: any): string {
  // 🔧 如果输入已经是正确格式，直接返回
  if (typeof dateInput === 'string') {
    const localFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (localFormat.test(dateInput)) {
      return dateInput; // ✅ 避免重复转换
    }
  }
  
  // 使用 parseLocalTimeString 而不是 new Date()
  dateObj = parseLocalTimeString(dateInput);
  return formatTimeForStorage(dateObj);
}
```

### 修复 3: 减少警告日志刷屏

**问题**: 几百个"Event not found"警告

**修复**:
```typescript
if (!localEvent) {
  // 只输出前3个警告
  if (failCount < 3) {
    console.warn(`⚠️ [SyncRemote] Event not found (likely deleted): ${action.entityId}`);
  }
  action.synchronized = true;
  skippedCount++; // 计入 skipped 而不是 failed
  continue;
}
```

---

## 📊 数据恢复可能的来源

1. **localStorage 备份**:
   - `remarkable-events_backup`
   - `remarkable-events-backup`

2. **开发环境持久化备份**:
   - `remarkable-dev-persistent-remarkable-events`
   - `remarkable-dev-persistent-remarkable-events-backup`

3. **代码自动备份**（PersistentStorage）:
   - 每次写入时自动创建 `_backup` 后缀的备份

4. **Outlook 远程数据**:
   - 如果事件已同步到 Outlook，可以从远程拉取
   - 需要触发完整同步

---

## ⚠️ 预防未来问题

### 1. 启用自动备份

在 `src/services/EventService.ts` 中添加：

```typescript
// 每次保存前自动备份
private static backupEvents() {
  const events = localStorage.getItem('remarkable-events');
  if (events) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    localStorage.setItem(`remarkable-events-auto-backup-${timestamp}`, events);
    
    // 只保留最近 5 个备份
    const keys = Object.keys(localStorage).filter(k => k.startsWith('remarkable-events-auto-backup-'));
    if (keys.length > 5) {
      keys.sort().slice(0, keys.length - 5).forEach(k => localStorage.removeItem(k));
    }
  }
}
```

### 2. 添加时间格式验证

在同步逻辑中添加验证：

```typescript
// 同步前验证时间格式
if (updates.startTime && !isValidTimeFormat(updates.startTime)) {
  console.error('❌ Invalid time format before sync:', updates.startTime);
  updates.startTime = formatTimeForStorage(new Date(updates.startTime));
}
```

### 3. 添加同步失败保护

```typescript
// 如果同步失败次数过多，暂停同步
if (failedSyncCount > 10) {
  console.error('🚨 Too many sync failures, pausing sync');
  this.pauseSync = true;
  // 通知用户检查数据
}
```

---

## 📝 检查清单

- [ ] 执行备份当前数据
- [ ] 运行 `emergency-data-recovery.js`
- [ ] 检查恢复摘要
- [ ] 应用恢复（如果有可恢复数据）
- [ ] 运行 `fix-sync-time-validation.js`
- [ ] 刷新页面验证
- [ ] 检查事件总数是否恢复
- [ ] 测试同步功能是否正常
- [ ] 检查控制台是否还有错误

---

## 🆘 如果仍然无法恢复

### 方案 A: 从 Outlook 完整拉取

```javascript
// 在控制台执行
// 1. 清空本地事件（谨慎！）
localStorage.setItem('remarkable-events', '[]');

// 2. 清空同步队列
localStorage.removeItem('sync-action-queue');

// 3. 触发完整同步
// 刷新页面，ActionBasedSyncManager 会从 Outlook 拉取所有事件
location.reload();
```

### 方案 B: 手动导入备份文件

如果你有之前导出的 JSON 备份文件：

```javascript
// 1. 读取备份文件内容
const backupData = /* 粘贴备份 JSON 内容 */;

// 2. 恢复数据
localStorage.setItem('remarkable-events', JSON.stringify(backupData));
location.reload();
```

---

## 📞 联系支持

如果以上方法都无法解决问题，请提供：

1. 控制台错误日志截图
2. `emergency-data-recovery.js` 的执行结果
3. `localStorage.length` 的值
4. 是否能访问 Outlook 数据

---

**最后更新**: 2025-12-01
**相关文件**:
- `scripts/emergency-data-recovery.js`
- `scripts/fix-sync-time-validation.js`
- `src/services/ActionBasedSyncManager.ts`
- `src/utils/timeUtils.ts`
