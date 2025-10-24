# IndexMap 完整性检查设计文档

## 🎯 目标

确保 EventIndexMap 与 localStorage 数据的一致性，在不阻塞 UI 的前提下进行数据完整性验证和自动修复。

## 📊 检查项目

### 1. IndexMap 一致性检查

#### 检查内容
- ✅ **孤立索引**：IndexMap 中有，localStorage 中无
- ✅ **缺失索引**：localStorage 中有，IndexMap 中无
- ✅ **过期数据**：IndexMap 中的引用与 localStorage 中的数据不一致
- ✅ **重复索引**：同一个 externalId 指向多个不同的事件

#### 严重程度
- 🔴 **Critical**：数据不一致导致同步错误
- 🟡 **Warning**：性能问题或潜在风险
- 🟢 **Info**：统计信息

### 2. 事件数据完整性检查

#### 检查内容
```typescript
interface EventIntegrityIssue {
  eventId: string;
  type: 'missing-field' | 'invalid-time' | 'duplicate-external-id' | 'invalid-sync-status';
  severity: 'critical' | 'warning' | 'info';
  details: string;
  autoFixable: boolean;
}
```

#### 必填字段检查
- `id`: 必须存在且唯一
- `startTime`: 必须是有效的 ISO 8601 时间
- `endTime`: 必须是有效的 ISO 8601 时间
- `title`: 必须存在（可以为空字符串）

#### 业务逻辑检查
- `endTime >= startTime`
- `externalId` 如果存在，必须唯一
- `syncStatus` 必须是合法值

### 3. 同步队列完整性检查

#### 检查内容
- 队列中的事件引用是否有效
- 已同步的操作是否可以清理
- 失败重试的操作是否应该放弃

## 🕐 运行策略

### 策略 1: 空闲时增量检查（推荐用于生产环境）

```typescript
// 使用 requestIdleCallback (浏览器空闲时)
schedule: {
  trigger: 'idle',
  minIdleTime: 5000,        // 用户无操作 5 秒后
  batchSize: 50,            // 每批检查 50 个事件
  maxDuration: 50,          // 每批最多 50ms
  checkInterval: 30000      // 30 秒检查一次是否需要运行
}
```

**优点**：
- ✅ 不阻塞用户操作
- ✅ 自动根据系统负载调整
- ✅ 浏览器原生支持

**实现**：
```typescript
private scheduleIdleIntegrityCheck() {
  if ('requestIdleCallback' in window) {
    requestIdleCallback((deadline) => {
      this.runIncrementalIntegrityCheck(deadline);
    }, { timeout: 60000 }); // 最多等待 60 秒
  } else {
    // Fallback for browsers without requestIdleCallback
    setTimeout(() => this.runIncrementalIntegrityCheck(), 5000);
  }
}
```

### 策略 2: 定时深度检查（后台维护）

```typescript
schedule: {
  trigger: 'interval',
  interval: 300000,         // 每 5 分钟
  condition: '!syncInProgress && !userActive',
  fullScan: true,
  repair: true
}
```

**优点**：
- ✅ 定期全面检查
- ✅ 自动修复问题
- ✅ 可预测的维护时间

### 策略 3: 触发式检查（关键时刻）

```typescript
triggers: [
  {
    event: 'after-sync',
    delay: 0,
    quick: true,           // 快速检查，只验证关键项
    logOnly: true          // 只记录不修复
  },
  {
    event: 'after-batch-save',
    delay: 100,
    verify: 'affected-only' // 只验证刚保存的事件
  },
  {
    event: 'on-error',
    immediate: true,
    fullScan: false,
    repair: false          // 错误时不自动修复，防止雪崩
  }
]
```

## 🔧 修复策略

### 自动修复（Auto-fix）

```typescript
autoFixRules: [
  {
    issue: 'orphaned-index',
    action: 'remove-from-index',
    safe: true,
    log: 'info'
  },
  {
    issue: 'missing-index',
    action: 'add-to-index',
    safe: true,
    log: 'info'
  },
  {
    issue: 'stale-reference',
    action: 'update-index',
    safe: true,
    log: 'warning'
  },
  {
    issue: 'duplicate-external-id',
    action: 'log-only',    // 不自动修复，需要人工介入
    safe: false,
    log: 'critical'
  }
]
```

### 警告日志（Log-only）

```typescript
logOnlyIssues: [
  'suspicious-time-range',  // 跨度超过 24 小时的事件
  'missing-calendar-id',    // 缺少 calendarId 但有 externalId
  'unsynced-old-events'     // 创建超过 1 小时还未同步的事件
]
```

### 用户通知（User-notification）

```typescript
notifyUser: [
  {
    issue: 'data-loss-detected',
    severity: 'critical',
    action: 'show-banner',
    message: '检测到数据异常，建议刷新页面'
  },
  {
    issue: 'sync-queue-stalled',
    severity: 'warning',
    action: 'show-notification',
    message: '部分事件同步失败，点击重试'
  }
]
```

## 📈 性能指标

### 目标性能
- **增量检查**：< 50ms per batch
- **全量检查**：< 500ms total (分片执行)
- **内存开销**：< 5MB (临时数据结构)
- **CPU 占用**：< 10% average

### 监控指标
```typescript
metrics: {
  totalChecks: number,
  issuesFound: number,
  issuesFixed: number,
  avgCheckDuration: number,
  lastCheckTime: Date,
  healthScore: number        // 0-100，100 表示完全健康
}
```

## 🚦 健康评分

```typescript
calculateHealthScore(): number {
  const weights = {
    indexConsistency: 0.4,    // IndexMap 一致性占 40%
    dataIntegrity: 0.3,       // 数据完整性占 30%
    syncQueueHealth: 0.2,     // 同步队列健康占 20%
    performanceScore: 0.1     // 性能得分占 10%
  };
  
  return (
    weights.indexConsistency * this.calculateIndexConsistency() +
    weights.dataIntegrity * this.calculateDataIntegrity() +
    weights.syncQueueHealth * this.calculateSyncQueueHealth() +
    weights.performanceScore * this.calculatePerformanceScore()
  );
}
```

## 🔄 完整执行流程

```
用户停止操作 5 秒
  ↓
requestIdleCallback 触发
  ↓
检查系统负载 (syncInProgress?)
  ↓ (负载低)
取出 50 个事件进行检查
  ↓
检查 IndexMap 一致性
  ↓
检查数据完整性
  ↓
发现问题 → 自动修复 → 记录日志
  ↓
检查耗时 < 50ms? 
  ↓ (是)
继续下一批 (还有未检查的事件)
  ↓ (否)
暂停，等待下次空闲
  ↓
所有事件检查完成
  ↓
计算健康评分
  ↓
触发 'integrity-check-completed' 事件
```

## 🛡️ 安全机制

### 防止过度修复
```typescript
safeguards: {
  maxAutoFixPerRun: 20,          // 单次最多自动修复 20 个问题
  maxIndexRebuildsPerHour: 2,    // 每小时最多重建 2 次索引
  requireConfirmationThreshold: 10 // 超过 10 个问题需要用户确认
}
```

### 回滚机制
```typescript
backup: {
  beforeAutoFix: true,            // 自动修复前备份
  snapshotEvery: 100,             // 每 100 次修改创建快照
  maxSnapshots: 3,                // 最多保留 3 个快照
  retentionTime: 3600000          // 快照保留 1 小时
}
```

## 🧪 测试用例

### 模拟异常场景
1. **孤立索引**：手动添加不存在的事件到 IndexMap
2. **缺失索引**：直接修改 localStorage 绕过 IndexMap
3. **重复 externalId**：创建两个相同 externalId 的事件
4. **数据损坏**：删除事件的必填字段
5. **并发冲突**：同时进行同步和完整性检查

### 验证指标
- ✅ 所有问题被检测到
- ✅ 自动修复成功率 > 95%
- ✅ 无数据丢失
- ✅ 性能指标达标

## 📝 实现清单

- [ ] 实现 `verifyIndexMapIntegrity()` - 增量检查
- [ ] 实现 `runFullIntegrityCheck()` - 全量检查
- [ ] 实现 `autoRepairIssues()` - 自动修复
- [ ] 实现 `scheduleIdleIntegrityCheck()` - 空闲调度
- [ ] 实现 `calculateHealthScore()` - 健康评分
- [ ] 添加完整性检查日志
- [ ] 集成到现有同步流程
- [ ] 性能测试和优化
- [ ] 编写单元测试

## 🎨 用户界面建议

### 开发者工具
```typescript
window.debugSyncManager = {
  ...existing,
  integrity: {
    runCheck: () => this.runFullIntegrityCheck(),
    getHealthScore: () => this.calculateHealthScore(),
    getLastReport: () => this.lastIntegrityReport,
    forceRepair: () => this.autoRepairIssues(true)
  }
}
```

### 用户设置
```typescript
settings: {
  integrityCheck: {
    enabled: true,
    autoRepair: true,
    notifyOnIssues: 'critical-only' | 'all' | 'none'
  }
}
```

## 🔮 未来扩展

1. **机器学习**：预测可能出现问题的事件
2. **性能分析**：识别导致性能问题的数据模式
3. **自动优化**：根据使用模式优化索引结构
4. **云端备份**：关键数据自动备份到云端
5. **跨设备同步验证**：多设备间数据一致性检查

