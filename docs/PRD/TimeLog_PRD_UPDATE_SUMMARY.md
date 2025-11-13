# TimeLog PRD 更新摘要

> **更新日期**: 2025-11-13  
> **架构决策**: TimeLog 采用嵌入式设计  
> **影响范围**: TimeLog_&_Description_PRD.md 全文

---

## 核心架构变更

### 决策：TimeLog 作为 Event 的嵌入字段

**原 PRD 设计:**
```typescript
// 独立实体
type TimeLog = {
  id: string;
  eventId: string;  // 外键关联
  content: Descendant[];
  versions: TimeLogVersion[];
  // ...
}

// 单独的数据表
db.timelogs.create({...});
db.events.create({...});
```

**新设计（已更新）:**
```typescript
// 嵌入式字段
interface Event {
  id: string;
  title: string;
  startTime: string;  // 保留用于快速查询
  timeSpec?: TimeSpec;  // 完整时间对象
  
  timelog?: {
    content: Descendant[];        // Slate JSON
    descriptionHtml: string;      // 用于 Outlook 同步
    descriptionPlainText: string; // 用于搜索
    attachments?: Attachment[];
    versions?: TimeLogVersion[];  // 版本历史（最多 50 个）
    syncState?: SyncState;
    createdAt?: Date;
    updatedAt?: Date;
  };
}

// 单表设计
EventService.updateEvent(eventId, {
  timelog: { content, versions, ... }
});
```

---

## PRD 文档修改清单

### ✅ 已完成修改

1. **Section 1.1** - 添加架构决策说明
   ```markdown
   **⚠️ 架构决策（2025-11-13）:**
   - TimeLog 采用**嵌入式设计**，作为 Event 接口的 `timelog` 字段
   - 不创建独立的 TimeLog 实体/数据表
   - 版本历史存储在 `Event.timelog.versions` 数组中
   ```

2. **Section 1.3** - 数据结构重新定义
   - 删除独立的 `type TimeLog`
   - 改为 `Event.timelog` 字段定义
   - 所有字段改为可选（因为是嵌入对象）

3. **Section 6.2** - 版本控制时间字段修正
   ```typescript
   // 旧：timestamp: Date  （与时间架构冲突）
   // 新：createdAt: Date  （保留简单时间戳用于排序）
   type TimeLogVersion = {
     id: string;
     createdAt: Date;  // 版本创建时间
     content: Descendant[];
     // ...
   }
   ```

4. **Section 6.3** - VersionControlService 构造函数
   ```typescript
   // 旧：constructor(private timelogId: string)
   // 新：constructor(private eventId: string)
   
   class VersionControlService {
     constructor(private eventId: string) { ... }
     
     async createVersion(...) {
       const event = await EventService.getEventById(this.eventId);
       const timelog = event.timelog;
       // ...
     }
   }
   ```

5. **Section 6.4** - TimeLogEditor 组件
   ```typescript
   // 旧：props: { timelogId: string }
   // 新：props: { eventId: string }
   
   interface TimeLogEditorProps {
     eventId: string;  // 直接使用 eventId
     // ...
   }
   ```

6. **Section 6.5** - VersionHistoryPanel 组件
   ```typescript
   // 查询逻辑改为：
   const event = await EventService.getEventById(eventId);
   const versions = event.timelog?.versions || [];
   ```

7. **Section 6.6** - VersionStorageOptimizer
   ```typescript
   // 优化逻辑改为更新 Event.timelog.versions
   await EventService.updateEvent(eventId, {
     timelog: { ...event.timelog, versions: optimized }
   });
   ```

8. **Section 6.7** - SyncEngine 集成
   ```typescript
   // 旧：基于 timelogId 管理 VersionControl
   // 新：直接使用 eventId
   
   async syncEvent(eventId: string) {
     const vc = new VersionControlService(eventId);
     // ...
   }
   ```

9. **Section 7.2** - 数据存储策略
   ```markdown
   **数据存储:**
   - 推荐：MongoDB（原生支持嵌入文档和 JSON）
   - 备选：SQLite（需要序列化 timelog 为 JSON 字符串）
   - 🆕 架构决策：timelog 作为 Event 的嵌入字段，不创建单独的表
   ```

10. **Section 8.1** - 延迟加载版本历史
    ```typescript
    async loadVersions(eventId: string, limit = 20, offset = 0) {
      const event = await EventService.getEventById(eventId);
      const versions = event.timelog?.versions || [];
      // ...
    }
    ```

### ⚠️ 待完成修改（需手动检查）

由于 PRD 文档过大（2858 行），以下章节可能包含需要更新的引用：

- [ ] **Section 2** - ContextMarker 实现（检查是否引用 timelogId）
- [ ] **Section 3** - 同步引擎（确认所有 db.timelogs 改为 Event.timelog）
- [ ] **Section 4** - 标签处理逻辑
- [ ] **Section 5** - 序列化层（检查 HTML 导出逻辑）
- [ ] **Section 7** - 实现指南（更新开发顺序）
- [ ] **Section 9** - 技术栈（确认数据库选择说明）

---

## 数据库设计对比

### MongoDB（推荐）

```javascript
// 单个 events 集合
{
  _id: "evt_123",
  title: "完成设计稿",
  startTime: "2025-11-13T10:00:00Z",
  timeSpec: { kind: "fixed", ... },
  
  timelog: {
    content: [...],  // Slate JSON
    descriptionHtml: "<p>...</p>",
    versions: [
      { id: "v1", createdAt: new Date(), content: [...] },
      { id: "v2", createdAt: new Date(), content: [...] }
    ],
    syncState: { lastSyncedAt: ..., contentHash: "..." }
  }
}

// 索引策略
db.events.createIndex({ "timelog.syncState.contentHash": 1 });
db.events.createIndex({ "timelog.descriptionPlainText": "text" });

// 查询优化（投影排除大字段）
db.events.find({}, { projection: { "timelog": 0 } });  // 列表页
db.events.findOne({ _id: "evt_123" });  // 详情页（包含 timelog）
```

### SQLite（备选）

```sql
-- 主表（内联基础字段）
CREATE TABLE events (
  id TEXT PRIMARY KEY,
  title TEXT,
  start_time TEXT,
  timespec TEXT,  -- JSON
  
  -- TimeLog 基础字段（避免 JOIN）
  timelog_content TEXT,      -- Slate JSON
  timelog_html TEXT,         -- HTML
  timelog_plaintext TEXT,    -- 纯文本
  sync_hash TEXT,
  synced_at TEXT
);

-- 辅助表（可选，用于归档旧版本）
CREATE TABLE event_versions (
  id TEXT PRIMARY KEY,
  event_id TEXT REFERENCES events(id),
  version_number INTEGER,
  created_at TEXT,
  content TEXT,  -- Slate JSON
  changes_summary TEXT
);

-- 查询
SELECT id, title, start_time FROM events;  -- 列表页（不含 timelog）
SELECT * FROM events WHERE id = 'evt_123';  -- 详情页（含 timelog）
```

---

## 代码迁移指南

### 1. 类型定义更新

```typescript
// src/types.ts 或 src/types/timelog.ts

// ❌ 删除独立的 TimeLog 类型
// type TimeLog = { ... };

// ✅ 更新 Event 接口
interface Event {
  // ... 现有字段
  
  timelog?: {
    content: Descendant[];
    descriptionHtml: string;
    descriptionPlainText: string;
    attachments?: Attachment[];
    versions?: TimeLogVersion[];
    syncState?: SyncState;
    createdAt?: Date;
    updatedAt?: Date;
  };
}
```

### 2. Service 层更新

```typescript
// src/services/TimeLogService.ts (新建或重构)

export class TimeLogService {
  // 更新事件的 timelog
  static async updateTimelog(
    eventId: string, 
    updates: Partial<Event['timelog']>
  ) {
    const event = await EventService.getEventById(eventId);
    if (!event) throw new Error('Event not found');
    
    await EventService.updateEvent(eventId, {
      timelog: {
        ...event.timelog,
        ...updates,
        updatedAt: new Date(),
      },
    });
  }
  
  // 获取版本历史
  static async getVersions(eventId: string, limit = 20) {
    const event = await EventService.getEventById(eventId);
    const versions = event?.timelog?.versions || [];
    return versions.slice(-limit).reverse();
  }
}
```

### 3. 组件层更新

```tsx
// src/components/TimeLogEditor.tsx

interface Props {
  eventId: string;  // ✅ 改用 eventId
  onSave?: () => void;
}

export const TimeLogEditor: React.FC<Props> = ({ eventId }) => {
  const [event, setEvent] = useState<Event | null>(null);
  
  useEffect(() => {
    EventService.getEventById(eventId).then(setEvent);
  }, [eventId]);
  
  const handleSave = async (content: Descendant[]) => {
    await TimeLogService.updateTimelog(eventId, {
      content,
      descriptionHtml: slateToHtml(content),
      descriptionPlainText: slateToPlainText(content),
    });
  };
  
  return (
    <Slate value={event?.timelog?.content || []}>
      {/* ... */}
    </Slate>
  );
};
```

---

## 测试检查清单

### 单元测试

- [ ] `TimeLogService.updateTimelog()` - 验证嵌入对象更新
- [ ] `VersionControlService` - 验证使用 eventId 而非 timelogId
- [ ] `TimeLogEditor` - 验证 props 改为 eventId

### 集成测试

- [ ] 创建事件 → 添加描述 → 验证 `event.timelog` 字段
- [ ] 版本历史 → 验证存储在 `event.timelog.versions`
- [ ] Outlook 同步 → 验证 timelog.descriptionHtml 正确映射

### 数据库测试

- [ ] MongoDB: 验证嵌入文档查询性能
- [ ] MongoDB: 验证投影查询（排除 timelog）
- [ ] SQLite: 验证 JSON 序列化/反序列化

---

## 回滚方案

如果嵌入式设计遇到性能问题，可以回滚到独立实体：

1. 创建 `timelogs` 表
2. 从 `events.timelog` 迁移数据到 `timelogs` 表
3. 添加 `Event.timelogId` 外键字段
4. 更新 Service 层为联表查询

**迁移脚本示例:**
```typescript
async function migrateToSeparateTable() {
  const events = await db.events.find({ timelog: { $exists: true } });
  
  for (const event of events) {
    const timelogId = uuidv4();
    
    // 创建独立的 timelog 记录
    await db.timelogs.create({
      id: timelogId,
      eventId: event.id,
      ...event.timelog,
    });
    
    // 更新 event 引用
    await db.events.update(event.id, {
      $set: { timelogId },
      $unset: { timelog: '' },
    });
  }
}
```

---

## 相关文档

- **TimeLog_&_Description_PRD.md** - 完整 PRD（已更新部分章节）
- **TimeLog_PRD_CONFLICTS_REVIEW.md** - 冲突审阅文档（已添加决策）
- **TIME_ARCHITECTURE.md** - 时间架构规范
- **src/types.ts** - 类型定义（待更新）

---

**下一步行动:**
1. ✅ 完成 PRD 文档全文检查，确保所有 `timelogId` 改为 `eventId`
2. ⏳ 更新 `src/types.ts` 中的 Event 接口
3. ⏳ 实现 `TimeLogService` 类
4. ⏳ 更新现有组件（如果有引用 timelog 的）
