# ReMarkable 云端演进规划

> **版本**: v1.0.0  
> **创建时间**: 2025-12-01  
> **状态**: 📋 规划阶段  
> **演进路径**: MVP (本地) → Beta (云端) → Production (完整云服务)

---

## 🎯 核心问题

### 用户痛点

**当前 MVP 架构的限制**:
```
❌ 换设备后数据丢失
❌ 无法跨设备同步
❌ 本地创建的事件仅限本机
❌ 邮箱同步事件依赖邮箱服务
```

**云端架构的价值**:
```
✅ 数据永久保存（云端备份）
✅ 跨设备无缝同步（手机/平板/电脑）
✅ 本地事件独立存在（不依赖邮箱）
✅ 灵活的同步控制（per-event 配置）
```

---

## 📊 架构对比

### 方案 A：邮箱账号 = 数据源（MVP 阶段）

```
用户设备 A
  └─ 本地存储 (IndexedDB + SQLite)
       ├─ Outlook 同步事件
       ├─ Google 同步事件
       └─ 本地创建事件（仅限设备 A）

用户设备 B（新设备）
  └─ 空数据库
       ├─ 需重新授权邮箱
       └─ 本地事件丢失 ❌
```

**优势**:
- ✅ 快速开发（2-3周）
- ✅ 无运维成本
- ✅ 完全离线可用
- ✅ 邮箱数据自动备份

**劣势**:
- ❌ 无法跨设备
- ❌ 本地事件易丢失
- ❌ 换设备体验差

### 方案 B：App 账号 + 云端（Beta 阶段）⭐

```
ReMarkable 云端
  └─ 用户账号 (user@remarkable.com)
       ├─ 所有事件（统一管理）
       │    ├─ 本地创建事件
       │    ├─ Outlook 同步事件
       │    └─ Google 同步事件
       ├─ 关联邮箱账号
       │    ├─ Outlook (bidirectional)
       │    ├─ Google (read-only)
       │    └─ iCloud (push-only)
       └─ 同步配置（per-event）

用户设备 A、B、C
  └─ 自动从云端同步所有数据 ✅
```

**优势**:
- ✅ 跨设备无缝同步
- ✅ 数据永久保存
- ✅ 本地事件独立存在
- ✅ 灵活同步控制

**劣势**:
- ❌ 开发复杂度高（4-6周）
- ❌ 需要云端运维
- ❌ 服务器成本（$50-200/月）

---

## 🚀 演进策略

### Phase 1: MVP 阶段（当前 - 3个月）

**目标**: 快速验证核心功能，获得用户反馈

**架构**:
- ✅ 本地存储（IndexedDB + SQLite）
- ✅ 邮箱同步（Outlook/Google/iCloud）
- ✅ 完全离线可用
- ❌ 无云端同步

**用户场景**:
- **单设备用户**（90%）: ✅ 完全满足
- **多设备用户**（10%）: ⚠️ 需手动重新授权邮箱

**数据模型**（预留云端扩展）:
```typescript
interface Event {
  id: string;
  
  // 当前使用
  sourceAccountId?: string;       // 邮箱账号
  sourceCalendarId?: string;
  
  // 预留字段（暂不使用）
  remarkableUserId?: string;      // ⭐ App 账号ID
  syncMode?: 'local-only' | 'bidirectional' | 'push-only';
  cloudSyncStatus?: 'synced' | 'pending' | 'conflict';
  lastCloudSyncAt?: string;
}
```

**技术栈**:
- Frontend: Electron + React
- Local Storage: IndexedDB + SQLite
- Email Sync: Microsoft Graph API + Google Calendar API + CalDAV

**时间线**:
- Week 1-2: IndexedDB + SQLite 实现
- Week 3-4: 邮箱同步集成
- Week 5-6: UI 完善 + 测试
- Week 7-12: 用户反馈迭代

### Phase 2: Beta 阶段（3-6个月后）

**触发条件**（需同时满足）:
1. ✅ MVP 稳定运行 3 个月
2. ✅ 活跃用户 > 1000 人
3. ✅ 用户调研：60%+ 需要跨设备同步
4. ✅ 团队有后端工程师 + DevOps
5. ✅ 融资或收入可覆盖云端成本（$100-500/月）

**架构升级**:
```
[本地存储 Layer 1-2] ← 保持不变
         ↓
[新增 Layer 3: 云端同步] ⭐
         ↓
[ReMarkable Cloud API]
  ├─ App 账号系统
  ├─ 事件云端存储
  ├─ 跨设备同步
  └─ 数据备份
```

**技术栈**:
- Backend: Supabase (推荐) 或 Node.js + PostgreSQL
- Auth: Supabase Auth 或 Firebase Auth
- Storage: PostgreSQL + Supabase Storage
- Sync: WebSocket (实时) + REST API (批量)

**实施步骤**:

#### Step 1: 云端基础设施（Week 1-2）

```bash
# 使用 Supabase（推荐）
1. 创建 Supabase 项目
2. 配置 PostgreSQL 数据库
3. 启用 Row Level Security (RLS)
4. 配置 Storage Buckets（附件存储）
```

**数据库 Schema**:
```sql
-- 用户表
CREATE TABLE remarkable_users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT UNIQUE NOT NULL,
    display_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 设备表
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES remarkable_users(id),
    device_name TEXT NOT NULL,
    device_type TEXT, -- 'desktop' | 'mobile' | 'web'
    last_sync_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 事件表（云端）
CREATE TABLE cloud_events (
    id TEXT PRIMARY KEY,  -- 与本地 ID 一致
    user_id UUID REFERENCES remarkable_users(id),
    
    -- 事件数据（JSON）
    data JSONB NOT NULL,
    
    -- 同步元数据
    sync_mode TEXT DEFAULT 'local-only',
    cloud_sync_status TEXT DEFAULT 'synced',
    last_cloud_sync_at TIMESTAMPTZ DEFAULT NOW(),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 邮箱账号关联
CREATE TABLE user_email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES remarkable_users(id),
    provider TEXT NOT NULL,
    email TEXT NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    sync_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE cloud_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can only access their own events"
    ON cloud_events FOR ALL
    USING (user_id = auth.uid());
```

#### Step 2: App 账号系统（Week 3）

**注册/登录流程**:
```typescript
// 使用 Supabase Auth
class ReMarkableAuth {
  async signUp(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signUp({
      email,
      password
    });
    
    if (error) throw error;
    
    // 创建用户记录
    await supabase.from('remarkable_users').insert({
      id: data.user.id,
      email: data.user.email
    });
    
    return data.user;
  }
  
  async signIn(email: string, password: string): Promise<User> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });
    
    if (error) throw error;
    return data.user;
  }
  
  async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }
}
```

#### Step 3: 云端同步 API（Week 4）

**同步接口设计**:
```typescript
interface CloudSyncAPI {
  // 全量同步（首次登录）
  initialSync(): Promise<SyncResult>;
  
  // 增量同步（定期更新）
  incrementalSync(lastSyncAt: string): Promise<SyncResult>;
  
  // 推送本地变更
  pushChanges(changes: Change[]): Promise<void>;
  
  // 拉取云端变更
  pullChanges(lastSyncAt: string): Promise<Change[]>;
  
  // 冲突解决
  resolveConflicts(conflicts: Conflict[]): Promise<void>;
}

interface SyncResult {
  events: Event[];
  contacts: Contact[];
  tags: Tag[];
  lastSyncAt: string;
}

interface Change {
  entityType: 'event' | 'contact' | 'tag';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: string;
}
```

**实现示例**:
```typescript
class CloudSyncService {
  /**
   * 全量同步（首次登录）
   */
  async initialSync(): Promise<SyncResult> {
    const userId = await this.auth.getUserId();
    
    // 从云端拉取所有数据
    const { data, error } = await supabase
      .from('cloud_events')
      .select('*')
      .eq('user_id', userId);
    
    if (error) throw error;
    
    // 保存到本地
    for (const cloudEvent of data) {
      await this.storage.createEvent(JSON.parse(cloudEvent.data));
    }
    
    return {
      events: data.map(e => JSON.parse(e.data)),
      contacts: [],
      tags: [],
      lastSyncAt: new Date().toISOString()
    };
  }
  
  /**
   * 增量同步
   */
  async incrementalSync(lastSyncAt: string): Promise<SyncResult> {
    const userId = await this.auth.getUserId();
    
    // 拉取云端变更
    const cloudChanges = await this.pullChanges(lastSyncAt);
    
    // 推送本地变更
    const localChanges = await this.getLocalChanges(lastSyncAt);
    await this.pushChanges(localChanges);
    
    // 应用云端变更
    for (const change of cloudChanges) {
      await this.applyChange(change);
    }
    
    return {
      events: cloudChanges.filter(c => c.entityType === 'event').map(c => c.data),
      contacts: [],
      tags: [],
      lastSyncAt: new Date().toISOString()
    };
  }
  
  /**
   * 冲突解决（时间戳优先）
   */
  async resolveConflict(conflict: Conflict): Promise<void> {
    const cloudVersion = conflict.cloudVersion;
    const localVersion = conflict.localVersion;
    
    // 最新修改优先
    if (new Date(cloudVersion.updatedAt) > new Date(localVersion.updatedAt)) {
      await this.storage.updateEvent(cloudVersion);
    } else {
      await this.pushChanges([{
        entityType: 'event',
        entityId: localVersion.id,
        action: 'update',
        data: localVersion,
        timestamp: localVersion.updatedAt
      }]);
    }
  }
}
```

#### Step 4: 客户端集成（Week 5）

**StorageManager 升级**:
```typescript
class StorageManager {
  private cloudSync?: CloudSyncService;
  
  async createEvent(event: Event): Promise<Event> {
    // 双写本地（保持不变）
    await Promise.all([
      this.indexedDB.put(event),
      this.sqlite.insert(event)
    ]);
    
    // ⭐ 新增：同步到云端
    if (this.cloudSync && await this.auth.isLoggedIn()) {
      await this.cloudSync.pushChanges([{
        entityType: 'event',
        entityId: event.id,
        action: 'create',
        data: event,
        timestamp: event.createdAt
      }]);
    }
    
    // 同步到邮箱（保持不变）
    if (event.syncMode === 'bidirectional') {
      await this.emailSync.push(event);
    }
    
    return event;
  }
}
```

#### Step 5: 数据迁移（Week 6）

**本地 → 云端首次上传**:
```typescript
class DataMigrationService {
  async migrateLocalToCloud(): Promise<void> {
    // 1. 获取所有本地事件
    const localEvents = await this.storage.getAllEvents();
    
    // 2. 批量上传到云端
    const batchSize = 100;
    for (let i = 0; i < localEvents.length; i += batchSize) {
      const batch = localEvents.slice(i, i + batchSize);
      
      await supabase.from('cloud_events').insert(
        batch.map(event => ({
          id: event.id,
          user_id: this.auth.getUserId(),
          data: JSON.stringify(event),
          sync_mode: event.syncMode || 'local-only',
          created_at: event.createdAt,
          updated_at: event.updatedAt
        }))
      );
    }
    
    console.log(`✅ 迁移完成: ${localEvents.length} 个事件`);
  }
}
```

### Phase 3: Production 阶段（6-12个月后）

**完整云服务**:
- ✅ 实时同步（WebSocket）
- ✅ 协作功能（共享日历）
- ✅ 高级搜索（全文 + 语义）
- ✅ 移动端 App（iOS/Android）
- ✅ 企业版功能（团队管理）

---

## 💰 成本估算

### MVP 阶段

| 项目 | 成本 | 说明 |
|------|------|------|
| 开发成本 | 2-3 周 | 1 个前端工程师 |
| 云端服务 | $0/月 | 无云端 |
| **总计** | **$0/月** | 纯本地应用 |

### Beta 阶段

| 项目 | 成本 | 说明 |
|------|------|------|
| 开发成本 | 4-6 周 | 1 个全栈工程师 |
| Supabase | $25-100/月 | Pro 套餐（10GB 数据库 + 100GB 存储）|
| CDN | $10-30/月 | 附件分发 |
| 监控 | $10-20/月 | Sentry + DataDog |
| **总计** | **$45-150/月** | 1000 用户以内 |

### Production 阶段

| 项目 | 成本 | 说明 |
|------|------|------|
| 云服务器 | $200-500/月 | 10K 用户 |
| 数据库 | $100-300/月 | PostgreSQL |
| 存储 | $50-150/月 | 文件存储 + CDN |
| 监控 | $50-100/月 | 完整监控体系 |
| **总计** | **$400-1050/月** | 10K 用户 |

---

## 🎯 决策建议

### **现在（MVP 阶段）: 不开发 App 账号系统** ✅

**理由**:
1. **快速验证**: 2-3 周上线，快速获得用户反馈
2. **降低风险**: 先验证产品可行性，再投入云端
3. **用户覆盖**: 90% 单设备用户完全满足
4. **技术可扩展**: 数据模型已预留云端字段，未来升级不需要重构

### **未来（Beta 阶段）: 开发 App 账号系统** 🔮

**触发条件**:
- ✅ MVP 稳定 3 个月
- ✅ 活跃用户 > 1000
- ✅ 用户强烈需求跨设备
- ✅ 团队能力具备
- ✅ 成本可承受

---

## 📝 总结

### 当前架构优势

✅ **无需重构**: 数据模型已预留云端扩展字段  
✅ **平滑升级**: Layer 3 云端层独立，不影响 Layer 1-2  
✅ **快速上线**: MVP 2-3 周完成，Beta 4-6 周升级  
✅ **成本可控**: MVP $0/月，Beta $45-150/月  

### 演进路线

```
MVP 阶段 (0-3 月)
  ├─ 本地存储 ✅
  ├─ 邮箱同步 ✅
  └─ 离线可用 ✅
        ↓
Beta 阶段 (3-6 月)
  ├─ App 账号 🔮
  ├─ 云端同步 🔮
  └─ 跨设备可用 🔮
        ↓
Production 阶段 (6-12 月)
  ├─ 实时同步 🔮
  ├─ 协作功能 🔮
  └─ 企业版 🔮
```

---

**下一步**: 专注 MVP 开发，快速验证核心功能！
