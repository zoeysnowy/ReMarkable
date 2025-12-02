# 上云准备架构检查报告

## 📊 检查日期
2025-12-02

## 🎯 检查目标
根据 Gemini 的"上云准备清单"，检查当前 ReMarkable 应用架构是否满足平滑上云的条件。

---

## ✅ 检查结果总览

| 检查项 | 状态 | 评分 | 风险等级 |
|--------|------|------|----------|
| 1. ID 生成策略 | ⚠️ **未找到 UUID 生成** | ❌ 0/10 | 🔴 **HIGH** |
| 2. 软删除机制 | ❌ **使用硬删除** | ❌ 0/10 | 🔴 **HIGH** |
| 3. 变更追踪 | ✅ **有 updatedAt** | ✅ 10/10 | 🟢 LOW |
| 4. 统一 ORM 层 | ⚠️ **部分统一** | ⚠️ 6/10 | 🟡 MEDIUM |
| 5. 全文搜索方案 | ✅ **已分离实现** | ✅ 9/10 | 🟢 LOW |

**总体评分**: ⚠️ **25/50 (50%)** - **需要重构**

**上云风险评估**: 🔴 **如果不修复 ID 和删除机制，未来上云会遇到数据冲突和同步错误**

---

## 🔍 详细检查结果

### 1. ID 生成策略 ❌ CRITICAL

#### 当前状态
```typescript
// 文件：src/types.ts (Event 接口)
export interface Event {
  id: string; // ❌ 类型声明没问题，但实际生成方式未找到
  createdAt: string;
  updatedAt: string;
  // ...
}
```

#### 问题发现
1. **没有找到 UUID/CUID/NanoID 的导入和使用**
   - 搜索 `nanoid`, `uuid`, `cuid`, `generateId` 均未在 EventService 中找到
   - 唯一找到的 `generateId` 在 AttachmentService 中 (`src/utils/id.ts`)，但该文件不存在

2. **Event ID 生成位置不明确**
   - EventService.createEvent() 要求 `event.id` 已存在
   - 未在 PlanManager, TimeCalendar, EventEditModal 等创建入口找到 ID 生成逻辑

3. **可能的风险场景**
   ```typescript
   // 如果使用时间戳 ID（猜测）
   const eventId = `event_${Date.now()}`; // ❌ 错误做法
   
   // 两个用户同时离线创建
   用户 A 离线: event_1733126400000
   用户 B 离线: event_1733126400000
   // → 同步时 ID 冲突！
   ```

#### 推荐修复方案
```typescript
// 1. 安装 nanoid
npm install nanoid

// 2. 创建 src/utils/idGenerator.ts
import { nanoid } from 'nanoid';

export function generateEventId(): string {
  return `event_${nanoid(16)}`; // event_V1StGXR8_Z5jdHi6
}

export function generateAttachmentId(): string {
  return `attach_${nanoid(16)}`;
}

// 3. 在 EventService.createEvent() 使用
import { generateEventId } from '../utils/idGenerator';

static async createEvent(event: Event, ...) {
  if (!event.id) {
    event.id = generateEventId(); // ✅ 应用层生成 ID
  }
  // ...
}
```

**预计工作量**: 2 小时
**优先级**: 🔴 P0 (必须修复)

---

### 2. 软删除机制 ❌ CRITICAL

#### 当前状态
```typescript
// 文件：src/services/storage/StorageManager.ts:325
async deleteEvent(id: string): Promise<void> {
  await this.indexedDBService.deleteEvent(id);
  
  if (this.sqliteService) {
    await this.sqliteService.deleteEvent(id); // ❌ 硬删除
  }
  
  this.eventCache.delete(id);
}

// 文件：src/services/storage/SQLiteService.ts
// 使用 DELETE FROM 语句（未找到软删除字段）
```

#### 问题发现
1. **使用了 SQL DELETE 语句**
   - 数据直接从数据库删除，无法恢复
   - EventService.deleteEvent() → StorageManager.deleteEvent() → 真实删除

2. **没有 deleted_at 或 is_deleted 字段**
   - Event 接口中未找到软删除标记
   - 搜索 `deleted_at`, `is_deleted`, `_isDeleted` 均无结果

3. **同步冲突场景**
   ```
   时间 T1: 用户 A 离线删除事件 E1
   时间 T2: 用户 B 离线修改事件 E1
   时间 T3: 两者同步到云端
   
   结果：
   - A 的本地：E1 被删除（硬删除，数据消失）
   - B 的本地：E1 有新内容
   - 云端：无法判断哪个是最新状态
   - 可能结果：B 的修改覆盖 A 的删除（诈尸），或 A 的删除覆盖 B 的修改（数据丢失）
   ```

#### 推荐修复方案

**方案 A: 最小改动方案**（推荐）
```typescript
// 1. 修改 Event 接口
export interface Event {
  id: string;
  deletedAt?: string | null; // ✅ 新增字段
  // ...
}

// 2. 修改 EventService.deleteEvent()
static async deleteEvent(eventId: string, skipSync: boolean = false) {
  // ❌ 旧代码
  // await storageManager.deleteEvent(eventId);
  
  // ✅ 新代码：软删除
  await this.updateEvent(eventId, {
    deletedAt: formatTimeForStorage(new Date())
  }, skipSync);
}

// 3. 修改查询逻辑
static async getAllEvents(): Promise<Event[]> {
  const allEvents = await storageManager.queryEvents({});
  return allEvents.items.filter(e => !e.deletedAt); // ✅ 过滤已删除
}

// 4. 定期清理（可选）
static async purgeOldDeletedEvents(olderThan: Date) {
  // 真正删除 30 天前的已删除事件
  const oldDeleted = await storageManager.queryEvents({
    filters: { deletedBefore: olderThan }
  });
  
  for (const event of oldDeleted.items) {
    await storageManager.hardDeleteEvent(event.id); // 真实删除
  }
}
```

**方案 B: 数据迁移方案**
```typescript
// 数据库迁移脚本
async function migrateToSoftDelete() {
  const events = await EventService.getAllEvents();
  
  // 为所有现有事件添加 deletedAt 字段（初始值为 null）
  for (const event of events) {
    if (!('deletedAt' in event)) {
      await EventService.updateEvent(event.id, {
        deletedAt: null
      }, true); // skipSync
    }
  }
}
```

**预计工作量**: 4 小时（包括测试）
**优先级**: 🔴 P0 (必须修复)
**数据迁移**: ✅ 需要（但可以渐进式）

---

### 3. 变更追踪 (updated_at) ✅ PASS

#### 当前状态
```typescript
// 文件：src/types.ts
export interface Event {
  id: string;
  createdAt: string;   // ✅ 有创建时间
  updatedAt: string;   // ✅ 有更新时间
  // ...
}
```

#### 验证通过
1. ✅ **Event 接口有 updatedAt 字段**
2. ✅ **使用字符串格式存储**（'YYYY-MM-DD HH:mm:ss'）
3. ✅ **EventService 自动维护**（通过 normalizeEvent）

#### 未来增量同步示例
```typescript
// 云端 API
async function syncIncrementalChanges(lastSyncTime: string) {
  // ✅ 只同步 lastSyncTime 之后修改的事件
  const changes = await storageManager.queryEvents({
    filters: {
      updatedAfter: lastSyncTime
    }
  });
  
  return changes.items;
}
```

**评分**: ✅ 10/10
**优先级**: 🟢 P3 (已满足)

---

### 4. 统一 ORM 层 ⚠️ PARTIAL PASS

#### 当前状态
```typescript
// StorageManager 作为统一接口
class StorageManager {
  async createEvent(event: StorageEvent): Promise<void> {
    // 双写：IndexedDB + SQLite
    await this.indexedDBService.createEvent(event);
    if (this.sqliteService) {
      await this.sqliteService.createEvent(event);
    }
  }
}

// EventService 使用 StorageManager
class EventService {
  static async createEvent(event: Event, ...) {
    await storageManager.createEvent(storageEvent); // ✅ 统一接口
  }
}
```

#### 评估结果
**优点** ✅:
1. ✅ 有统一的 StorageManager 层
2. ✅ EventService 不直接操作数据库
3. ✅ 支持双写（IndexedDB + SQLite）

**不足** ⚠️:
1. ⚠️ **没有使用成熟的 ORM**（如 Kysely, RxDB）
2. ⚠️ **手动维护两套存储逻辑**
   ```typescript
   // 需要手动同步两个服务的实现
   await this.indexedDBService.createEvent(event);
   await this.sqliteService.createEvent(event);
   ```
3. ⚠️ **查询逻辑分散**
   - 有的地方用 `storageManager.queryEvents()`
   - 有的地方用 `EventService.getEventById()`
   - 有的地方直接用 `storageManager.getAllEvents()`

#### 推荐优化方案

**方案 A: 引入 RxDB**（推荐，适合上云）
```bash
npm install rxdb rxjs
```

```typescript
// RxDB 会自动处理：
// 1. IndexedDB 和 SQLite 的适配
// 2. 同步协议（支持 CouchDB, GraphQL, WebSocket）
// 3. 查询优化和索引

import { createRxDatabase } from 'rxdb';

const db = await createRxDatabase({
  name: 'remarkable',
  storage: getRxStorageSQLite(), // Electron 用 SQLite
  // storage: getRxStorageIndexedDB(), // Web 用 IndexedDB
});

// 定义 schema
const eventSchema = {
  version: 0,
  primaryKey: 'id',
  type: 'object',
  properties: {
    id: { type: 'string', maxLength: 100 },
    title: { type: 'object' },
    updatedAt: { type: 'string' },
    deletedAt: { type: ['string', 'null'] }
  }
};

const eventsCollection = await db.addCollections({
  events: { schema: eventSchema }
});

// 使用（API 完全一致）
await eventsCollection.insert(event);
const event = await eventsCollection.findOne(id).exec();
```

**方案 B: 继续使用 StorageManager，但优化**
```typescript
// 统一查询方法
class EventService {
  // ❌ 删除这些方法
  // static getEventById()
  // static getAllEvents()
  
  // ✅ 只保留一个方法
  static async queryEvents(options: QueryOptions) {
    return storageManager.queryEvents(options);
  }
}
```

**预计工作量**: 
- 方案 A: 16 小时（重构）
- 方案 B: 4 小时（优化）

**优先级**: 🟡 P1 (建议修复，但不阻塞上云)

---

### 5. 全文搜索方案 ✅ GOOD

#### 当前状态
```typescript
// Electron: SQLite FTS5
// 文件：src/services/storage/SQLiteService.ts
async searchEventLogs(query: string) {
  const stmt = this.db.prepare(`
    SELECT e.*
    FROM eventlog_fts fts
    INNER JOIN events e ON fts.event_id = e.id
    WHERE fts.plain_text MATCH ?
    ORDER BY bm25(fts) DESC
  `);
  return stmt.all(query);
}

// Web: UnifiedSearchIndex (Fuse.js)
// 文件：src/services/search/UnifiedSearchIndex.ts
this.eventsIndex = new Fuse(events, {
  keys: ['title.simpleTitle', 'eventlog.plainText', 'tags'],
  threshold: 0.4
});
```

#### 评估结果
✅ **架构合理**:
1. ✅ Electron 用 SQLite FTS5（性能好，支持中文）
2. ✅ Web 用 Fuse.js（纯 JS，无需后端）
3. ✅ 两者接口相似（都返回事件数组）

**建议**:
- 考虑在 Web 端也使用 SQLite（通过 sql.js）
- 或者统一使用 FlexSearch（比 Fuse.js 更快）

**评分**: ✅ 9/10
**优先级**: 🟢 P3 (已基本满足)

---

## 🚀 上云路线图

### 阶段一：修复核心问题（2-4 周）

**MUST DO** 🔴:
1. ✅ **实现 UUID ID 生成**（2 小时）
   - 安装 nanoid
   - 创建 idGenerator.ts
   - 修改所有创建入口

2. ✅ **实现软删除**（4 小时）
   - 添加 deletedAt 字段
   - 修改 deleteEvent() 逻辑
   - 更新查询过滤器

3. ✅ **数据迁移脚本**（4 小时）
   - 为现有事件添加 deletedAt=null
   - 验证所有事件有 UUID 格式的 ID

### 阶段二：本地优化（1-2 周）

**SHOULD DO** 🟡:
1. 统一查询接口（4 小时）
2. 添加索引（updatedAt, deletedAt）（2 小时）
3. 优化 StorageManager 缓存策略（4 小时）

### 阶段三：云端集成（4-8 周）

**技术选型**:

**方案 A: PowerSync**（推荐）
```typescript
// 安装
npm install @powersync/web

// 配置
const powerSync = new PowerSync({
  database: sqliteDB,
  remote: {
    endpoint: 'https://your-backend.com/sync',
    apiKey: 'xxx'
  }
});

// 开始同步
await powerSync.connect();

// 业务代码几乎不用改
const events = await powerSync.getAll('SELECT * FROM events WHERE deleted_at IS NULL');
```

**方案 B: ElectricSQL**
```typescript
// 安装
npm install electric-sql

// 配置
const electric = await electrify(sqliteDB, {
  url: 'wss://your-electric-server.com'
});

// 同步自动发生
const { db } = electric;
const events = await db.events.findMany({
  where: { deletedAt: null }
});
```

**方案 C: 自建同步服务**
```typescript
// 增量同步 API
async function syncChanges() {
  const lastSync = localStorage.getItem('lastSyncTime');
  
  // 1. 下拉远程更改
  const remoteChanges = await fetch(`/api/sync/pull?since=${lastSync}`);
  for (const change of remoteChanges) {
    await EventService.updateEvent(change.id, change.data, true);
  }
  
  // 2. 上推本地更改
  const localChanges = await storageManager.queryEvents({
    filters: { updatedAfter: lastSync }
  });
  await fetch('/api/sync/push', {
    method: 'POST',
    body: JSON.stringify(localChanges.items)
  });
  
  localStorage.setItem('lastSyncTime', new Date().toISOString());
}
```

---

## 📊 对比表：修复前 vs 修复后

| 场景 | 修复前 ❌ | 修复后 ✅ |
|------|---------|---------|
| **用户 A 离线创建事件** | ID 可能冲突 | UUID 保证唯一 |
| **用户 A 删除，用户 B 修改** | 数据丢失或诈尸 | 以 updatedAt 为准，保留修改 |
| **设备离线 30 天后同步** | 无法判断哪些是新数据 | 通过 updatedAt 增量同步 |
| **误删事件恢复** | 无法恢复（数据已删除） | 可以恢复（30 天内） |
| **跨平台数据一致性** | 需手动处理冲突 | 自动合并（CRD或 OT） |

---

## 🎯 建议行动清单

### 立即执行（本周内）
- [ ] 1. 安装 nanoid 包
- [ ] 2. 创建 src/utils/idGenerator.ts
- [ ] 3. 在 EventService.createEvent() 中生成 UUID ID
- [ ] 4. 修改 Event 接口，添加 `deletedAt?: string | null`
- [ ] 5. 修改 EventService.deleteEvent() 改为软删除

### 短期执行（1-2 周）
- [ ] 6. 编写数据迁移脚本
- [ ] 7. 测试软删除逻辑（PlanManager, TimeCalendar）
- [ ] 8. 添加 "撤销删除" 功能（可选）
- [ ] 9. 优化查询性能（添加索引）

### 中期执行（1-2 月）
- [ ] 10. 评估 PowerSync vs ElectricSQL
- [ ] 11. 搭建测试后端（PostgreSQL）
- [ ] 12. 实现基本同步逻辑
- [ ] 13. 多设备同步测试

---

## 🔗 参考资料

1. **nanoid 文档**: https://github.com/ai/nanoid
2. **PowerSync 文档**: https://www.powersync.com/docs
3. **ElectricSQL 文档**: https://electric-sql.com/docs
4. **RxDB 文档**: https://rxdb.info/

---

## 📝 总结

**当前状态**: ⚠️ **不符合上云准备清单**

**关键问题**:
1. ❌ ID 生成策略未使用 UUID（会导致多设备冲突）
2. ❌ 使用硬删除（会导致同步数据丢失）
3. ✅ 有 updatedAt 字段（增量同步基础已具备）

**上云风险评估**:
- 🔴 **如果不修复**：多设备同步会出现严重问题（ID 冲突、数据丢失）
- 🟢 **修复后**：可以平滑上云，使用 PowerSync/ElectricSQL 等工具

**预计修复时间**: 2-4 周（包括测试）

**建议优先级**: 🔴 **P0 - 在考虑上云之前必须修复**
