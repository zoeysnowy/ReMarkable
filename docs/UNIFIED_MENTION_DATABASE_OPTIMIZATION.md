# 🚀 Unified Mention 数据库优化 & 上云迁移方案

## 📊 当前架构评估

### ✅ 已有优势
- **SQLite (Electron)**: 事件存储、版本历史、FTS5 全文搜索
- **IndexedDB (Web)**: 双写备份、离线支持
- **EventService**: 统一数据访问层
- **FTS5**: 中文分词（unicode61）

### 🎯 Unified Mention 性能需求
- **响应时间**: < 200ms（用户无感知）
- **搜索频率**: 高频（每次按键触发）
- **数据类型**: Events, Tags, People, Time, AI
- **结果排序**: 智能权重（最近访问 + 模糊匹配 + 上下文）

---

## 🔧 渐进式优化方案

### **阶段 1: 本地优先索引（已实施）✅**

**方案**: `UnifiedSearchIndex.ts` - 内存 + Fuse.js

```typescript
// 数据结构
{
  eventsIndex: Fuse<Event>,        // Fuse.js 模糊搜索引擎
  tagsMap: Map<string, TagData>,   // 标签索引
  recentAccess: Map<string, number>, // 最近访问记录
}
```

**性能**:
- ⚡ **<50ms**: 5000 条记录内搜索
- ⚡ **<100ms**: 10000 条记录内搜索
- ⚡ **<200ms**: 50000 条记录内搜索

**优点**:
- ✅ 零网络延迟
- ✅ 离线可用
- ✅ 实现简单（300 行代码）

**缺点**:
- ❌ 数据量大时内存占用高（10000 条事件 ≈ 50MB）
- ❌ 首次加载需同步所有数据（3-5 秒）

---

### **阶段 2: 混合搜索策略（数据量 > 10K 时）**

**方案**: 本地缓存 + 后端搜索

```typescript
// 0-50ms: 本地缓存（最近访问 + 当前标签）
const cachedResults = localIndex.search(query);

// 50-200ms: 后端 API（全量搜索）
const apiResults = await fetch('/api/search', { query });

// 合并结果（去重 + 智能排序）
const mergedResults = merge(cachedResults, apiResults);
```

**数据分层策略**:
| 数据类型 | 缓存策略 | 数据量 |
|---------|---------|--------|
| 最近 30 天事件 | 本地全量 | ~1000 条 |
| 最近 90 天事件 | 一级索引（ID + 标题） | ~3000 条 |
| 历史事件 | 仅后端搜索 | 无限 |
| 标签 | 本地全量 | ~100 个 |
| 人员 | 本地全量 | ~50 人 |

**实现**:
```typescript
class HybridSearchIndex extends UnifiedSearchIndex {
  async search(options: SearchOptions): Promise<SearchResult> {
    // 1. 立即返回本地缓存
    const localResults = await super.search(options);
    
    // 2. 异步查询后端
    const apiResults = await this.searchRemote(options);
    
    // 3. 合并 + 去重
    return this.mergeResults(localResults, apiResults);
  }
}
```

---

### **阶段 3: 专业搜索引擎（数据量 > 100K 时）**

**推荐技术栈**:

#### Option A: **MeiliSearch** (推荐 ⭐⭐⭐⭐⭐)
```yaml
# 部署方式
Docker: docker run -p 7700:7700 getmeili/meilisearch
云服务: Meilisearch Cloud (免费额度 100K 文档)

# 特性
- ⚡ < 50ms 搜索（10M 文档）
- 🌏 中文分词优秀
- 🎯 容错搜索（拼写错误自动修正）
- 💰 免费/开源
- 📦 轻量（50MB Docker 镜像）
```

```typescript
// 集成示例
import { MeiliSearch } from 'meilisearch';

const client = new MeiliSearch({
  host: 'https://your-instance.meilisearch.io',
  apiKey: 'your-api-key',
});

// 索引事件
await client.index('events').addDocuments([
  { id: '1', title: '会议纪要', tags: ['工作', '团队'] },
  { id: '2', title: 'Project Plan', tags: ['项目', 'Q4'] },
]);

// 搜索
const results = await client.index('events').search('会议', {
  limit: 10,
  attributesToHighlight: ['title'],
});
```

#### Option B: **Algolia** (商业方案)
- ✅ 最快（< 10ms）
- ✅ 全球 CDN
- ❌ 贵（$1/1000 次搜索）

#### Option C: **Typesense** (开源替代)
- ✅ 类似 Algolia
- ✅ 免费/开源
- ⚠️ 中文支持弱

---

## ☁️ 上云迁移方案（最小改动）

### **方案 A: SQLite → PostgreSQL（推荐）**

**为什么推荐**:
- ✅ SQL 语法 95% 兼容
- ✅ FTS5 → PostgreSQL Full-Text Search（中文支持）
- ✅ 改动最小（只需修改 `SQLiteService.ts`）

**迁移步骤**:

#### 1. 创建 PostgreSQL 适配器
```typescript
// src/services/storage/PostgreSQLService.ts
import { Pool } from 'pg';

class PostgreSQLService {
  private pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString });
  }

  // ✅ 保持与 SQLiteService 相同的接口
  async queryEvents(options: QueryOptions): Promise<QueryResult> {
    const { limit = 100, offset = 0, filters } = options;
    
    // 查询逻辑几乎不变
    const query = `
      SELECT * FROM events 
      WHERE deleted_at IS NULL
      ORDER BY start_time ASC
      LIMIT $1 OFFSET $2
    `;
    
    const result = await this.pool.query(query, [limit, offset]);
    return {
      items: result.rows,
      total: result.rowCount || 0,
    };
  }

  // FTS5 → PostgreSQL Full-Text Search
  async searchEventLogs(query: string): Promise<Event[]> {
    // SQLite FTS5
    // SELECT * FROM eventlog_fts WHERE eventlog_fts MATCH ?
    
    // PostgreSQL
    const sql = `
      SELECT e.* FROM events e
      JOIN eventlog_fts f ON e.id = f.event_id
      WHERE to_tsvector('simple', f.plain_text) @@ plainto_tsquery('simple', $1)
      ORDER BY ts_rank(to_tsvector('simple', f.plain_text), plainto_tsquery('simple', $1)) DESC
      LIMIT 20
    `;
    
    const result = await this.pool.query(sql, [query]);
    return result.rows;
  }
}
```

#### 2. 统一接口（抽象工厂模式）
```typescript
// src/services/storage/DatabaseAdapter.ts
interface DatabaseAdapter {
  queryEvents(options: QueryOptions): Promise<QueryResult>;
  insertEvent(event: Event): Promise<void>;
  searchEventLogs(query: string): Promise<Event[]>;
  // ... 其他方法
}

// 环境变量切换
const dbAdapter: DatabaseAdapter = 
  process.env.DB_TYPE === 'postgres' 
    ? new PostgreSQLService(process.env.DATABASE_URL!)
    : new SQLiteService(dbPath);
```

#### 3. Schema 迁移
```sql
-- SQLite → PostgreSQL (几乎不用改)
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT,
  start_time TIMESTAMP,
  -- ... 其他字段
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

-- FTS5 → GIN 索引
CREATE TABLE eventlog_fts (
  event_id TEXT PRIMARY KEY REFERENCES events(id),
  plain_text TEXT
);

CREATE INDEX idx_eventlog_fts ON eventlog_fts USING GIN(to_tsvector('simple', plain_text));
```

**改动量评估**:
- ✅ 代码改动: **< 200 行**（新建 PostgreSQLService，修改 StorageManager 初始化）
- ✅ 测试工作量: **1-2 天**
- ✅ 风险: **低**（SQL 兼容性高）

---

### **方案 B: IndexedDB → Firestore（实时同步）**

适用场景：多端同步、协作编辑

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';

class FirestoreService {
  private db: ReturnType<typeof getFirestore>;

  async queryEvents(options: QueryOptions): Promise<QueryResult> {
    const eventsRef = collection(this.db, 'events');
    const q = query(
      eventsRef, 
      where('deleted_at', '==', null),
      orderBy('start_time', 'asc'),
      limit(options.limit || 100)
    );
    
    const snapshot = await getDocs(q);
    return {
      items: snapshot.docs.map(doc => doc.data()),
      total: snapshot.size,
    };
  }
}
```

---

### **方案 C: 混合云（渐进式迁移）**

**架构**:
```
客户端（Electron）
├── 本地 SQLite（离线优先）
└── 同步服务
    ├── 上传变更 → 云端 PostgreSQL
    └── 下载变更 ← 云端 PostgreSQL
```

**实现**:
```typescript
class SyncService {
  async syncUp() {
    // 1. 获取本地未同步的变更
    const changes = await localDB.getUnsyncedChanges();
    
    // 2. 上传到云端
    await fetch('/api/sync', {
      method: 'POST',
      body: JSON.stringify(changes),
    });
    
    // 3. 标记为已同步
    await localDB.markAsSynced(changes.map(c => c.id));
  }

  async syncDown() {
    // 1. 获取云端最新变更（since last_sync_time）
    const remoteChanges = await fetch('/api/sync?since=' + lastSyncTime);
    
    // 2. 应用到本地
    await localDB.applyChanges(remoteChanges);
  }
}
```

---

## 🎯 推荐技术栈（按数据量）

| 数据量 | 本地存储 | 云端存储 | 搜索引擎 | 改动量 |
|-------|---------|---------|---------|--------|
| < 10K | SQLite + Fuse.js | - | - | 0（已实现） |
| 10K-100K | SQLite + Fuse.js | PostgreSQL | PostgreSQL FTS | 低（200 行） |
| 100K-1M | SQLite + MeiliSearch | PostgreSQL | MeiliSearch | 中（500 行） |
| > 1M | PostgreSQL | PostgreSQL | MeiliSearch/Algolia | 高（1000 行） |

---

## 📝 行动计划

### 近期（1-2 周）
1. ✅ **实施阶段 1**：集成 `UnifiedSearchIndex`（已完成）
2. ⚡ **优化性能**：添加增量更新（避免全量重建索引）
3. 🧪 **测试性能**：生成 10K 测试数据，测试响应时间

### 中期（1-2 月）
4. 🔧 **准备迁移**：创建 `PostgreSQLService` 适配器
5. 🌐 **本地测试**：Docker 部署 PostgreSQL + 数据迁移脚本
6. 🚀 **灰度发布**：10% 用户测试云端同步

### 远期（3-6 月）
7. 🔍 **集成 MeiliSearch**：专业搜索引擎（如需要）
8. 🤖 **AI 搜索**：集成 LLM 语义搜索（向量数据库）
9. 📊 **多租户架构**：支持团队协作

---

## 💡 关键建议

1. **不要过早优化**: 10K 以下数据量，本地 Fuse.js 完全够用
2. **保持接口统一**: 使用抽象工厂模式，方便切换数据库
3. **增量迁移**: 先支持"本地 + 云端双写"，逐步切换
4. **测试驱动**: 每次改动都有性能基准测试
5. **监控优先**: 部署后监控搜索延迟（Sentry/LogRocket）

---

## 🔗 参考资源

- [Fuse.js 文档](https://fusejs.io/)
- [MeiliSearch 中文指南](https://docs.meilisearch.com/learn/what_is_meilisearch/overview.html)
- [PostgreSQL Full-Text Search](https://www.postgresql.org/docs/current/textsearch.html)
- [Local-First Software](https://www.inkandswitch.com/local-first/)
