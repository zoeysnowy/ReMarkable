# 两阶段同步优化方案

## 问题分析

### 当前实现
- **一次性拉取完整事件数据**（包含所有字段：subject, body, attendees 等）
- 数据传输量大，耗时长
- 即使只是检查删除，也要拉取完整数据

### 优化目标
Claude 提出的方案：
1. **阶段 1（轻量）**：只拉取 `id` 和 `lastModifiedDateTime` → 用于删除/创建检测
2. **阶段 2（按需）**：只拉取需要更新的事件的完整字段

## 为什么暂不实施

### 1. Microsoft Graph API 的限制
- `$select` 参数虽然可以指定字段，但：
  - **网络请求数量不变**（仍需要遍历所有日历和分页）
  - **速率限制不变**（429 错误主要由请求频率触发，而非数据量）
  - **批次间延迟仍需要**（800ms * 5 批次 = 4 秒）

### 2. 实际瓶颈不在数据传输
从用户日志看：
```
⚡ [getAllCalendarsEvents] Fetching 10 calendars in 5 batches
📦 [Batch 1/5] Processing 2 calendars...  ← 800ms 延迟
📦 [Batch 2/5] Processing 2 calendars...  ← 800ms 延迟
...
⚠️ [performSync] Sync took too long: 4245ms  ← 主要是批次延迟
```

**瓶颈在于**：
- 批次处理的总耗时（5 批 * 800ms = 4秒）
- API 速率限制保护（429 错误）
- **不是数据传输量**

### 3. 复杂度 vs 收益
**如果实施两阶段同步**：
```typescript
// 阶段 1：拉取元数据
const metadata = await getAllCalendarsMetadata();  // 4秒（5批次）

// 阶段 2：拉取完整数据
const eventsToUpdate = identifyUpdates(metadata);
const fullEvents = await fetchFullEvents(eventsToUpdate);  // 额外耗时
```

**问题**：
- 仍需要 4 秒拉取元数据（批次延迟）
- 阶段 2 可能需要再等 2-3 秒
- **总耗时反而增加**

### 4. Graph API 的 $select 优化有限
Microsoft Graph API 文档说明：
> `$select` reduces the response payload size, but **does not significantly reduce server-side processing time or network round trips**.

**实际测试**（假设）：
```
完整字段请求：50KB 响应 + 200ms 处理时间
只 id 字段：   5KB 响应 + 190ms 处理时间  ← 节省很少
```

## 当前已实施的有效优化

✅ **批次并发限制**：
- 从 3 降到 2（减少 429 错误）
- 批次间延迟 800ms（保护速率限制）

✅ **动态删除确认时间**：
- 公式：`Math.max(60000, 批次数 * 800 + 30000)`
- 避免批次未完成就误判删除

✅ **窗口激活检查**：
- 删除轮询只在窗口非激活时进行
- 避免打断用户操作

✅ **索引优化**：
- `eventIndexMap` 使用 Map 数据结构
- O(1) 查找时间

## 未来可考虑的优化

### 方案 1：增量同步（Delta Query）
Microsoft Graph 支持 Delta Query API：
```typescript
// 第一次全量同步
GET /me/calendarView/delta?startDateTime=...&endDateTime=...

// 后续只拉取变更
GET /me/calendarView/delta?$deltatoken=...
```

**优势**：
- 只拉取变更的事件
- 减少数据传输和处理

**挑战**：
- 需要维护 deltaToken
- 首次同步仍需全量
- 实现复杂度高

### 方案 2：WebHook 推送
订阅 Outlook 事件变更通知：
```typescript
POST /subscriptions
{
  "changeType": "created,updated,deleted",
  "notificationUrl": "https://your-endpoint.com/webhook",
  "resource": "/me/events"
}
```

**优势**：
- 实时推送，无需轮询
- 最小化同步延迟

**挑战**：
- 需要公网可访问的 WebHook 端点
- Electron 应用难以接收推送
- 需要处理订阅过期和续订

### 方案 3：优化批次策略
```typescript
// 根据日历事件数量动态调整
const CONCURRENT_LIMIT = calendars.length < 10 ? 3 :
                         calendars.length < 50 ? 2 : 1;

// 根据网络状况动态调整延迟
const batchDelay = lastRequestFailed ? 1600 : 800;
```

## 结论

**当前不实施两阶段同步**，原因：
1. 网络请求数和延迟不变
2. 瓶颈在批次处理时间，而非数据量
3. 增加复杂度，收益有限

**推荐方案**：
1. ✅ 保持当前的批次并发优化
2. ✅ 继续使用动态删除确认时间
3. 🔜 未来考虑 Delta Query API（真正的增量同步）
4. 🔜 监控 429 错误频率，动态调整批次延迟

## 性能对比

### 当前方案
```
拉取 10 个日历，每个 ~100 事件
- 批次数：5
- 每批延迟：800ms
- 总耗时：~4-5 秒
- 数据传输：~500KB
```

### 两阶段方案（理论）
```
阶段 1：拉取元数据
- 批次数：5
- 每批延迟：800ms
- 阶段 1 耗时：~4 秒
- 数据传输：~50KB

阶段 2：拉取完整数据（假设 20% 需要更新）
- 批次数：2
- 每批延迟：800ms
- 阶段 2 耗时：~2 秒
- 数据传输：~100KB

总耗时：~6 秒（反而增加 50%）
数据传输：~150KB（减少 70%，但总耗时增加）
```

## 参考资料

- [Microsoft Graph API Delta Query](https://learn.microsoft.com/en-us/graph/delta-query-overview)
- [Microsoft Graph API Best Practices](https://learn.microsoft.com/en-us/graph/best-practices-concept)
- [Microsoft Graph Throttling Guidance](https://learn.microsoft.com/en-us/graph/throttling)
