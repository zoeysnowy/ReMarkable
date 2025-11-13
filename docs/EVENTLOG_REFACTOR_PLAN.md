# EventLog 字段重构方案

> **目标**: 将 `Event.eventlog` 从简单字符串重构为完整的 Slate JSON + 元数据结构  
> **影响范围**: types.ts, EventService.ts, localStorage 数据迁移  
> **预计工时**: 2-3 小时

---

## 📊 当前状态

### 现有数据结构（简化版）

```typescript
// src/types.ts L146
interface Event {
  // ... 其他字段
  eventlog?: string;     // 🔴 当前：简单 HTML 字符串
  description?: string;  // Outlook 同步字段
}
```

### PRD 要求的目标结构

```typescript
interface Event {
  // ... 其他字段
  
  /**
   * 🆕 重构后：完整的 EventLog 对象
   * - content: Slate JSON（主存储，用户编辑）
   * - descriptionHtml: 简化 HTML（Outlook 同步，自动生成）
   * - versions: 版本历史（最多 50 个）
   * - syncState: 同步状态
   */
  eventlog?: {
    content: string;              // Slate JSON 字符串
    descriptionHtml?: string;     // 从 content 自动转换的 HTML
    descriptionPlainText?: string; // 纯文本（用于搜索）
    attachments?: Attachment[];   // 媒体附件元数据
    versions?: EventLogVersion[]; // 版本历史
    syncState?: {
      lastSyncedAt?: string;      // 最后同步时间
      contentHash?: string;        // 内容哈希（冲突检测用）
      status?: 'pending' | 'synced' | 'conflict';
    };
    createdAt?: string;
    updatedAt?: string;
  };
  
  /**
   * description 保留为向后兼容（Outlook 同步）
   * 自动从 eventlog.descriptionHtml 复制
   */
  description?: string;
}
```

---

## 🎯 实施步骤

### Step 1: 更新类型定义

**文件**: `src/types.ts`

**任务**:
1. 新增 `EventLog` 接口定义
2. 新增 `EventLogVersion` 接口（版本历史）
3. 新增 `Attachment` 接口（附件元数据）
4. 新增 `SyncState` 接口
5. 更新 `Event.eventlog` 类型

**代码**:
```typescript
// 附件元数据
export interface Attachment {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  localPath?: string;        // 本地路径（Electron userData）
  cloudUrl?: string;         // 云端 URL（OneDrive）
  status: 'local-only' | 'synced' | 'pending-upload' | 'cloud-only' | 'upload-failed';
  uploadedAt: string;
  lastAccessedAt?: string;
  isPinned?: boolean;        // 是否固定（不自动清理）
}

// 版本快照
export interface EventLogVersion {
  id: string;
  createdAt: string;         // 版本创建时间
  content: string;           // Slate JSON 快照
  diff?: any;                // Delta（可选，用于压缩存储）
  triggerType: 'auto' | 'manual' | 'sync' | 'conflict-resolved';
  changesSummary?: string;   // 变更摘要（如 "添加 3 段，删除 1 段"）
  contentHash?: string;      // SHA-256 哈希
}

// EventLog 完整结构
export interface EventLog {
  content: string;              // Slate JSON 字符串
  descriptionHtml?: string;     // HTML（自动生成）
  descriptionPlainText?: string; // 纯文本（搜索用）
  attachments?: Attachment[];   // 附件列表
  versions?: EventLogVersion[]; // 版本历史（最多 50 个）
  syncState?: {
    lastSyncedAt?: string;
    contentHash?: string;
    status?: 'pending' | 'synced' | 'conflict';
  };
  createdAt?: string;
  updatedAt?: string;
}

// 更新 Event 接口
export interface Event {
  // ... 其他字段保持不变
  
  /**
   * 🆕 EventLog 对象（重构后）
   * - 未重构的旧数据：eventlog 可能仍是 string
   * - 重构后的新数据：eventlog 为 EventLog 对象
   */
  eventlog?: string | EventLog;
  
  /**
   * description 保留（向后兼容 + Outlook 同步）
   * 自动从 eventlog.descriptionHtml 同步
   */
  description?: string;
}
```

---

### Step 2: 数据迁移工具

**文件**: `src/services/EventLogMigrationService.ts`（新建）

**任务**:
1. 检测旧数据（eventlog 为 string 类型）
2. 转换为新格式（EventLog 对象）
3. 保留版本历史（如果有）
4. 应用启动时自动运行

**代码**:
```typescript
import { Event, EventLog } from '../types';
import { EventService } from './EventService';

export class EventLogMigrationService {
  /**
   * 迁移单个 Event 的 eventlog 字段
   */
  static migrateEvent(event: Event): Event {
    // 已是新格式，跳过
    if (typeof event.eventlog === 'object' && event.eventlog !== null) {
      return event;
    }
    
    // 旧格式（string）或无 eventlog
    const oldEventlog = event.eventlog || '';
    const now = new Date().toISOString();
    
    // 创建新的 EventLog 对象
    const newEventlog: EventLog = {
      content: this.htmlToSlateJSON(oldEventlog), // HTML → Slate JSON
      descriptionHtml: oldEventlog,                // 保留原 HTML
      descriptionPlainText: this.stripHtml(oldEventlog),
      attachments: [],
      versions: [],
      syncState: {
        lastSyncedAt: event.lastSyncTime,
        contentHash: this.hashContent(oldEventlog),
        status: event.syncStatus === 'synced' ? 'synced' : 'pending',
      },
      createdAt: event.createdAt || now,
      updatedAt: event.updatedAt || now,
    };
    
    return {
      ...event,
      eventlog: newEventlog,
      description: oldEventlog, // 保留原 description（Outlook 同步用）
    };
  }
  
  /**
   * 批量迁移所有 Events
   */
  static async migrateAllEvents(): Promise<number> {
    const events = EventService.getAllEvents();
    let migratedCount = 0;
    
    for (const event of events) {
      const original = event.eventlog;
      const migrated = this.migrateEvent(event);
      
      // 检测是否有变更
      if (migrated.eventlog !== original) {
        await EventService.updateEvent(event.id, { eventlog: migrated.eventlog }, {
          skipSync: true, // 迁移时不触发同步
        });
        migratedCount++;
      }
    }
    
    console.log(`✅ [Migration] 已迁移 ${migratedCount}/${events.length} 个 Events`);
    return migratedCount;
  }
  
  /**
   * HTML → Slate JSON 转换（简化版）
   * TODO: 使用完整的 html-to-slate 转换器
   */
  private static htmlToSlateJSON(html: string): string {
    if (!html) {
      return JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]);
    }
    
    // 简单实现：将 HTML 按行拆分为 paragraph 节点
    const lines = html.replace(/<[^>]*>/g, '\n').split('\n').filter(l => l.trim());
    const slateNodes = lines.map(line => ({
      type: 'paragraph',
      children: [{ text: line.trim() }],
    }));
    
    return JSON.stringify(slateNodes.length > 0 ? slateNodes : [
      { type: 'paragraph', children: [{ text: '' }] }
    ]);
  }
  
  /**
   * 移除 HTML 标签，获取纯文本
   */
  private static stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  }
  
  /**
   * 计算内容哈希（用于冲突检测）
   */
  private static hashContent(content: string): string {
    // 简化版：使用内容长度作为"哈希"（TODO: 使用 crypto.subtle.digest）
    return `hash_${content.length}_${Date.now()}`;
  }
}
```

---

### Step 3: 更新 EventService

**文件**: `src/services/EventService.ts`

**任务**:
1. `createEvent()` - 创建新 Event 时使用新格式
2. `updateEvent()` - 更新时自动生成 `descriptionHtml`
3. 自动同步 `description` ← `eventlog.descriptionHtml`

**关键修改**:
```typescript
class EventService {
  // 创建事件时初始化 EventLog 对象
  static async createEvent(event: Partial<Event>, options?: { skipSync?: boolean }): Promise<Event> {
    const now = new Date().toISOString();
    
    // 初始化 eventlog 为新格式
    const eventlog: EventLog = {
      content: typeof event.eventlog === 'string' 
        ? event.eventlog 
        : JSON.stringify([{ type: 'paragraph', children: [{ text: '' }] }]),
      descriptionHtml: event.description || '',
      descriptionPlainText: event.description ? stripHtml(event.description) : '',
      attachments: [],
      versions: [],
      syncState: {
        lastSyncedAt: undefined,
        contentHash: hashContent(event.eventlog || ''),
        status: 'pending',
      },
      createdAt: now,
      updatedAt: now,
    };
    
    const newEvent: Event = {
      ...event,
      id: event.id || generateId(),
      eventlog: eventlog,
      description: eventlog.descriptionHtml, // 同步到 description
      createdAt: now,
      updatedAt: now,
    };
    
    // ... 保存逻辑
  }
  
  // 更新事件时自动转换 eventlog.content → descriptionHtml
  static async updateEvent(
    eventId: string, 
    updates: Partial<Event>, 
    options?: { skipSync?: boolean }
  ): Promise<Event> {
    const existingEvent = this.getEventById(eventId);
    
    // 如果更新了 eventlog.content，自动生成 descriptionHtml
    if (updates.eventlog && typeof updates.eventlog === 'object') {
      const eventlog = updates.eventlog as EventLog;
      
      // Slate JSON → HTML
      eventlog.descriptionHtml = slateToHtml(JSON.parse(eventlog.content));
      eventlog.descriptionPlainText = stripHtml(eventlog.descriptionHtml);
      eventlog.updatedAt = new Date().toISOString();
      
      // 同步到 description 字段（Outlook 使用）
      updates.description = eventlog.descriptionHtml;
    }
    
    // ... 更新逻辑
  }
}
```

---

### Step 4: 应用启动时自动迁移

**文件**: `src/App.tsx` 或 `src/main.tsx`

**任务**: 在应用初始化时运行迁移

**代码**:
```typescript
import { EventLogMigrationService } from './services/EventLogMigrationService';

// 应用启动时
useEffect(() => {
  const runMigration = async () => {
    try {
      const migratedCount = await EventLogMigrationService.migrateAllEvents();
      
      if (migratedCount > 0) {
        console.log(`✅ EventLog 迁移完成: ${migratedCount} 个事件已更新`);
      }
    } catch (error) {
      console.error('❌ EventLog 迁移失败:', error);
    }
  };
  
  runMigration();
}, []);
```

---

## ✅ 验证清单

### 数据迁移验证
- [ ] 旧数据（eventlog 为 string）成功转换为新格式
- [ ] `eventlog.content` 包含有效的 Slate JSON
- [ ] `eventlog.descriptionHtml` 保留原 HTML
- [ ] `description` 字段正确同步

### 功能验证
- [ ] PlanManager 编辑 eventlog 正常工作
- [ ] EventEditModal 显示 eventlog 正常
- [ ] TimeLog 页面（未实现）预留兼容性
- [ ] Outlook 同步仍使用 `description` 字段

### 性能验证
- [ ] localStorage 大小未显著增加（<10% 增长）
- [ ] 迁移过程 <5 秒（1000 个事件）
- [ ] 应用启动速度未受影响

---

## 🚨 注意事项

### 兼容性策略
- `Event.eventlog` 支持 `string | EventLog` 双类型
- 读取时使用类型守卫判断：`typeof event.eventlog === 'object'`
- 写入时优先使用新格式

### 降级方案
- 如果迁移失败，保留原 eventlog（string）
- 应用仍可正常运行（向后兼容）

### 数据备份
- 迁移前自动备份 localStorage（`events_backup_YYYYMMDD`）
- 提供恢复功能（设置页面）

---

## 📅 实施时间表

| 步骤 | 预计时间 | 负责人 | 状态 |
|------|---------|--------|------|
| Step 1: 类型定义 | 30 min | Copilot | ✅ 已完成 |
| Step 2: 迁移工具 | 60 min | Copilot | ✅ 已完成 |
| Step 3: EventService 更新 | 45 min | Copilot | ✅ 已完成 |
| Step 4: 启动集成 | 15 min | Copilot | ✅ 已完成 |
| 测试验证 | 30 min | Zoey | ⏳ 待测试 |
| **总计** | **3 小时** | | **80% 完成** |

---

## 🔗 相关文档

- [TimeLog PRD](./TimeLog_&_Description_PRD.md) - 完整设计文档
- [Time Architecture](../TIME_ARCHITECTURE.md) - 时间处理规范
- [Slate Development Guide](../SLATE_DEVELOPMENT_GUIDE.md) - Slate 编辑器指南
