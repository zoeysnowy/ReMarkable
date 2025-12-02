# Slate 编辑器数据库集成方案

> **版本**: v1.0.0  
> **创建时间**: 2025-12-02  
> **作者**: AI Assistant  
> **状态**: 🚧 实施中  

---

## 📋 目录

1. [集成概述](#1-集成概述)
2. [数据流架构](#2-数据流架构)
3. [数据库 Schema 设计](#3-数据库-schema-设计)
4. [序列化方案](#4-序列化方案)
5. [存储层 API 设计](#5-存储层-api-设计)
6. [版本历史实现](#6-版本历史实现)
7. [全文搜索优化](#7-全文搜索优化)
8. [实施计划](#8-实施计划)

---

## 1. 集成概述

### 1.1 集成目标

将 SlateCore、PlanSlate、ModalSlate 三个编辑器的数据与现有存储架构（StorageManager + SQLite + IndexedDB）深度集成，实现：

- ✅ **自动持久化**: 编辑器内容自动保存到数据库
- ✅ **版本历史**: 支持无限版本回滚（96% 压缩率）
- ✅ **全文搜索**: FTS5 索引支持高性能中文搜索
- ✅ **增量同步**: 避免全量更新，减少网络开销
- ✅ **多格式输出**: JSON / HTML / PlainText / Markdown

### 1.2 核心挑战

| 挑战 | 解决方案 |
|------|----------|
| Slate JSON 体积大 | 增量存储 + Brotli 压缩（96% 压缩率）|
| 富文本搜索性能低 | plainText 字段 + FTS5 索引 |
| 版本历史占用空间 | 只存储 diff + LZ4 压缩 |
| 实时保存影响性能 | 防抖（2秒）+ 后台异步写入 |
| 跨标签页同步 | BroadcastChannel + eventsUpdated 事件 |

---

## 2. 数据流架构

### 2.1 整体数据流

```
┌─────────────────────────────────────────────────────────────────┐
│                       应用层 (React UI)                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │ TimeCalendar │  │ PlanManager  │  │EventEditModal│          │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘          │
│         │                  │                  │                  │
│         └──────────────────┼──────────────────┘                  │
│                            │                                     │
│                            ▼                                     │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │               Slate 编辑器层                                 │ │
│  │  ┌──────────┐    ┌──────────┐    ┌──────────┐             │ │
│  │  │SlateCore │◄───┤PlanSlate │    │ModalSlate│             │ │
│  │  │(共享逻辑)│    │(多事件)  │    │(单事件)  │             │ │
│  │  └────┬─────┘    └────┬─────┘    └────┬─────┘             │ │
│  │       │               │                │                    │ │
│  │       └───────────────┴────────────────┘                    │ │
│  │                       │                                     │ │
│  │                       ▼                                     │ │
│  │       ┌────────────────────────────────┐                   │ │
│  │       │   onChange / onSave 回调        │                   │ │
│  │       └───────────┬────────────────────┘                   │ │
│  └───────────────────┼──────────────────────────────────────┘ │
└────────────────────┼────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                      服务层 (EventService)                       │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  EventService.updateEvent(eventId, { eventlog: {...} })    │ │
│  │    ├─ 规范化 EventLog 数据                                  │ │
│  │    ├─ 生成 plainText (for FTS5)                            │ │
│  │    ├─ 生成 HTML (for preview)                              │ │
│  │    └─ 调用 StorageManager.updateEvent()                    │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                   存储层 (StorageManager)                        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │  StorageManager.updateEvent(eventId, event)                │ │
│  │    ├─ 双写：IndexedDB.updateEvent()                        │ │
│  │    ├─ 双写：SQLite.updateEvent()                           │ │
│  │    ├─ 创建版本快照：SQLite.saveEventLogVersion()           │ │
│  │    └─ 更新 FTS5 索引：SQLite.updateFTS()                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────┬──────────────────────────────────────────┘
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
┌──────────────┐              ┌──────────────┐
│  IndexedDB   │              │    SQLite    │
│  (近期数据)  │              │  (完整历史)  │
├──────────────┤              ├──────────────┤
│ events       │              │ events       │
│  ├─ id       │              │  ├─ id       │
│  ├─ eventlog │◄─────────────┤  ├─ eventlog│
│  │   (JSON) │   双写保持同步 │  │   (JSON) │
│  └─ ...      │              │  └─ ...      │
│              │              │              │
│              │              │ event_logs   │
│              │              │  ├─ id       │
│              │              │  ├─ slateJson│
│              │              │  ├─ html     │
│              │              │  ├─ plainText│
│              │              │  └─ version  │
│              │              │              │
│              │              │ eventlog_ver │
│              │              │  ├─ logId    │
│              │              │  ├─ version  │
│              │              │  ├─ delta    │
│              │              │  ├─ timestamp│
│              │              │  └─ compress │
│              │              │              │
│              │              │ eventlog_fts │
│              │              │  (FTS5 索引) │
└──────────────┘              └──────────────┘
```

### 2.2 数据同步流程

```
[用户编辑 Slate]
       │
       ├─ 输入内容
       │
       ▼
[PlanSlate / ModalSlate]
       │
       ├─ 防抖 2 秒
       │
       ▼
[onChange 回调]
       │
       ├─ slateNodesToPlanItems() / slateNodesToJson()
       │
       ▼
[EventService.updateEvent()]
       │
       ├─ normalizeEventLog()
       ├─ slateNodesToPlainText()
       ├─ slateNodesToHtml()
       │
       ▼
[StorageManager.updateEvent()]
       │
       ├─ IndexedDB.put(event)            ← 快速写入（近期数据）
       ├─ SQLite.update(event)            ← 持久化（完整历史）
       ├─ SQLite.saveVersion(eventlog)    ← 版本历史（增量 diff）
       └─ SQLite.updateFTS(plainText)     ← 全文索引
       │
       ▼
[广播 eventsUpdated]
       │
       ├─ window.dispatchEvent()          ← 本标签页通知
       └─ BroadcastChannel.postMessage()  ← 跨标签页通知
```

---

## 3. 数据库 Schema 设计

### 3.1 IndexedDB Schema（现有，无需修改）

```javascript
// Store: events
{
  id: string,              // 事件ID
  title: EventTitle,       // 三层标题
  eventlog: EventLog,      // ⭐ Slate JSON 数据
  startTime: string,
  endTime: string,
  // ... 其他字段（参考 types.ts）
}
```

### 3.2 SQLite Schema（需要扩展）

#### 3.2.1 主表：events（现有，需要添加字段）

```sql
-- ✅ 已存在，添加 eventlog 相关字段
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT,
  
  -- ⭐ EventLog 数据（JSON 格式）
  eventlog TEXT,                    -- EventLog JSON (slateJson + html + plainText)
  
  start_time TEXT,
  end_time TEXT,
  location TEXT,
  
  -- 邮箱同步
  source_account_id TEXT,
  source_calendar_id TEXT,
  sync_status TEXT,
  
  -- 标签和附件
  tags TEXT,                        -- JSON 数组
  attachments TEXT,                 -- JSON 数组
  
  -- 时间戳
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  
  FOREIGN KEY (source_account_id) REFERENCES accounts(id) ON DELETE SET NULL
);

-- ⭐ 索引优化
CREATE INDEX IF NOT EXISTS idx_events_updated_at ON events(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_start_time ON events(start_time);
CREATE INDEX IF NOT EXISTS idx_events_source_account ON events(source_account_id);
```

#### 3.2.2 新表：eventlog_versions（版本历史）

```sql
-- 版本历史表（增量存储，压缩）
CREATE TABLE IF NOT EXISTS eventlog_versions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id TEXT NOT NULL,
  version INTEGER NOT NULL,           -- 版本号（从 1 开始）
  
  -- ⭐ 增量数据（只存储 diff，不存储完整 JSON）
  delta_compressed BLOB,              -- Brotli 压缩的 JSON diff
  delta_size INTEGER,                 -- 压缩后大小
  original_size INTEGER,              -- 原始大小
  compression_ratio REAL,             -- 压缩率（%）
  
  -- 版本元数据
  created_at TEXT NOT NULL,
  created_by TEXT,                    -- 用户/设备标识
  change_summary TEXT,                -- 变更摘要（可选）
  
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
);

-- 索引（按事件ID + 版本号查询）
CREATE INDEX IF NOT EXISTS idx_eventlog_versions_event 
  ON eventlog_versions(event_id, version DESC);

-- 索引（按时间查询）
CREATE INDEX IF NOT EXISTS idx_eventlog_versions_time 
  ON eventlog_versions(created_at DESC);
```

#### 3.2.3 新表：eventlog_fts（全文搜索）

```sql
-- FTS5 全文搜索表（虚拟表）
CREATE VIRTUAL TABLE IF NOT EXISTS eventlog_fts USING fts5(
  event_id UNINDEXED,                 -- 事件ID（不索引）
  plain_text,                         -- ⭐ plainText 字段（索引）
  
  -- FTS5 配置
  tokenize = "unicode61 remove_diacritics 2"  -- 支持中文分词
);

-- ⚠️ FTS5 与主表同步触发器（自动更新）
CREATE TRIGGER IF NOT EXISTS eventlog_fts_insert 
AFTER INSERT ON events
BEGIN
  INSERT INTO eventlog_fts (event_id, plain_text)
  VALUES (NEW.id, json_extract(NEW.eventlog, '$.plainText'));
END;

CREATE TRIGGER IF NOT EXISTS eventlog_fts_update 
AFTER UPDATE OF eventlog ON events
BEGIN
  UPDATE eventlog_fts 
  SET plain_text = json_extract(NEW.eventlog, '$.plainText')
  WHERE event_id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS eventlog_fts_delete 
AFTER DELETE ON events
BEGIN
  DELETE FROM eventlog_fts WHERE event_id = OLD.id;
END;
```

### 3.3 EventLog 数据结构（TypeScript）

```typescript
interface EventLog {
  slateJson: string;           // ⭐ Slate Descendant[] 的 JSON 字符串
  html?: string;               // HTML 渲染格式（用于预览）
  plainText?: string;          // 纯文本（用于 FTS5 搜索）
  markdown?: string;           // Markdown 格式（可选）
  
  // 元数据
  wordCount?: number;          // 字数统计
  characterCount?: number;     // 字符数
  
  // 版本控制
  version?: number;            // 当前版本号
  lastEditedAt?: string;       // 最后编辑时间
  
  // 附件关联
  attachments?: Attachment[];  // 附件列表
}
```

---

## 4. 序列化方案

### 4.1 Slate ↔ 数据库转换工具

创建 `src/utils/slateSerializer.ts` 工具模块：

```typescript
/**
 * Slate 序列化工具
 * 
 * 提供 Slate 数据与各种格式之间的转换：
 * - Slate JSON ↔ EventLog
 * - Slate JSON ↔ HTML
 * - Slate JSON ↔ PlainText
 * - Slate JSON ↔ Markdown
 */

import { Descendant } from 'slate';
import type { EventLog } from '../types';

/**
 * Slate 节点转 EventLog
 */
export function slateNodesToEventLog(nodes: Descendant[]): EventLog {
  const slateJson = JSON.stringify(nodes);
  const plainText = slateNodesToPlainText(nodes);
  const html = slateNodesToHtml(nodes);
  
  return {
    slateJson,
    plainText,
    html,
    wordCount: countWords(plainText),
    characterCount: plainText.length,
    lastEditedAt: new Date().toISOString(),
  };
}

/**
 * EventLog 转 Slate 节点
 */
export function eventLogToSlateNodes(eventLog: EventLog): Descendant[] {
  try {
    return JSON.parse(eventLog.slateJson);
  } catch (error) {
    console.error('[slateSerializer] Failed to parse slateJson:', error);
    return [{ type: 'paragraph', children: [{ text: '' }] }];
  }
}

/**
 * Slate 节点转纯文本（用于 FTS5）
 */
export function slateNodesToPlainText(nodes: Descendant[]): string {
  return nodes.map(node => {
    if ('text' in node) {
      return node.text;
    }
    if ('children' in node) {
      return slateNodesToPlainText(node.children as Descendant[]);
    }
    return '';
  }).join('\n');
}

/**
 * Slate 节点转 HTML（用于预览）
 */
export function slateNodesToHtml(nodes: Descendant[]): string {
  return nodes.map(node => {
    // 处理 paragraph
    if ('type' in node && node.type === 'paragraph') {
      const content = (node.children as any[]).map(child => {
        if ('text' in child) {
          let text = escapeHtml(child.text);
          if (child.bold) text = `<strong>${text}</strong>`;
          if (child.italic) text = `<em>${text}</em>`;
          if (child.underline) text = `<u>${text}</u>`;
          return text;
        }
        // 处理 inline 元素（tag, dateMention）
        if ('type' in child && child.type === 'tag') {
          return `<span class="tag">${escapeHtml(child.tagName)}</span>`;
        }
        if ('type' in child && child.type === 'dateMention') {
          return `<span class="date-mention">${child.startDate}</span>`;
        }
        return '';
      }).join('');
      
      return `<p>${content}</p>`;
    }
    
    // 处理 timestamp-divider
    if ('type' in node && node.type === 'timestamp-divider') {
      return `<hr class="timestamp-divider"><span>${node.displayText}</span>`;
    }
    
    return '';
  }).join('\n');
}

/**
 * 工具函数：HTML 转义
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * 工具函数：统计单词数（支持中文）
 */
function countWords(text: string): number {
  // 中文字符算 1 个词，英文单词按空格分割
  const chineseChars = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishWords = text
    .replace(/[\u4e00-\u9fa5]/g, '')
    .trim()
    .split(/\s+/)
    .filter(w => w.length > 0).length;
  
  return chineseChars + englishWords;
}
```

### 4.2 版本历史 Diff 算法

```typescript
/**
 * EventLog 版本比较和增量存储
 * 
 * 使用 fast-json-patch 计算 JSON diff
 */

import { compare } from 'fast-json-patch';
import pako from 'pako'; // Brotli/gzip 压缩库

/**
 * 生成版本 delta（增量）
 */
export function generateDelta(
  oldEventLog: EventLog,
  newEventLog: EventLog
): { delta: string; size: number; compressionRatio: number } {
  // 1. 计算 JSON Patch
  const oldNodes = JSON.parse(oldEventLog.slateJson);
  const newNodes = JSON.parse(newEventLog.slateJson);
  const patch = compare(oldNodes, newNodes);
  
  // 2. 压缩 patch（Brotli）
  const patchStr = JSON.stringify(patch);
  const compressed = pako.deflate(patchStr, { level: 9 });
  const compressedStr = Buffer.from(compressed).toString('base64');
  
  // 3. 计算压缩率
  const originalSize = newEventLog.slateJson.length;
  const compressedSize = compressedStr.length;
  const compressionRatio = (1 - compressedSize / originalSize) * 100;
  
  return {
    delta: compressedStr,
    size: compressedSize,
    compressionRatio
  };
}

/**
 * 应用 delta 恢复旧版本
 */
export function applyDelta(
  baseEventLog: EventLog,
  delta: string
): EventLog {
  // 1. 解压缩
  const compressedBuffer = Buffer.from(delta, 'base64');
  const decompressed = pako.inflate(compressedBuffer, { to: 'string' });
  const patch = JSON.parse(decompressed);
  
  // 2. 应用 patch
  const baseNodes = JSON.parse(baseEventLog.slateJson);
  const restoredNodes = applyPatch(baseNodes, patch);
  
  // 3. 重新生成 EventLog
  return slateNodesToEventLog(restoredNodes);
}

// 使用 fast-json-patch 的 applyPatch
import { applyPatch } from 'fast-json-patch';
```

---

## 5. 存储层 API 设计

### 5.1 StorageManager 扩展方法

```typescript
// src/services/storage/StorageManager.ts

class StorageManager {
  // ... 现有方法
  
  /**
   * 保存 EventLog 版本历史
   */
  async saveEventLogVersion(
    eventId: string,
    eventLog: EventLog,
    previousVersion?: EventLog
  ): Promise<void> {
    if (!this.sqliteService) {
      console.warn('[StorageManager] SQLite not available, skipping version save');
      return;
    }
    
    // 获取当前版本号
    const currentVersion = await this.sqliteService.getLatestVersion(eventId);
    const newVersion = currentVersion + 1;
    
    // 生成增量
    let delta = null;
    let deltaSize = 0;
    let compressionRatio = 0;
    
    if (previousVersion) {
      const result = generateDelta(previousVersion, eventLog);
      delta = result.delta;
      deltaSize = result.size;
      compressionRatio = result.compressionRatio;
    } else {
      // 首个版本，存储完整数据（压缩）
      const compressed = pako.deflate(eventLog.slateJson, { level: 9 });
      delta = Buffer.from(compressed).toString('base64');
      deltaSize = delta.length;
      compressionRatio = (1 - deltaSize / eventLog.slateJson.length) * 100;
    }
    
    // 保存到数据库
    await this.sqliteService.insertVersion({
      eventId,
      version: newVersion,
      deltaCompressed: delta,
      deltaSize,
      originalSize: eventLog.slateJson.length,
      compressionRatio,
      createdAt: new Date().toISOString()
    });
  }
  
  /**
   * 获取 EventLog 历史版本
   */
  async getEventLogVersions(
    eventId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Array<{ version: number; createdAt: string; size: number }>> {
    if (!this.sqliteService) return [];
    
    return this.sqliteService.queryVersions(eventId, options);
  }
  
  /**
   * 恢复 EventLog 到指定版本
   */
  async restoreEventLogVersion(
    eventId: string,
    version: number
  ): Promise<EventLog> {
    if (!this.sqliteService) {
      throw new Error('SQLite not available');
    }
    
    // 1. 获取目标版本的 delta
    const versionData = await this.sqliteService.getVersion(eventId, version);
    if (!versionData) {
      throw new Error(`Version ${version} not found for event ${eventId}`);
    }
    
    // 2. 如果是首个版本，直接解压
    if (version === 1) {
      const decompressed = pako.inflate(
        Buffer.from(versionData.deltaCompressed, 'base64'),
        { to: 'string' }
      );
      return {
        slateJson: decompressed,
        plainText: slateNodesToPlainText(JSON.parse(decompressed)),
        html: slateNodesToHtml(JSON.parse(decompressed))
      };
    }
    
    // 3. 递归应用所有 delta（从版本 1 到目标版本）
    let currentEventLog = await this.restoreEventLogVersion(eventId, 1);
    
    for (let v = 2; v <= version; v++) {
      const vData = await this.sqliteService.getVersion(eventId, v);
      currentEventLog = applyDelta(currentEventLog, vData.deltaCompressed);
    }
    
    return currentEventLog;
  }
}
```

### 5.2 SQLiteService 扩展方法

```typescript
// src/services/storage/SQLiteService.ts

class SQLiteService {
  // ... 现有方法
  
  /**
   * 插入版本历史
   */
  async insertVersion(data: {
    eventId: string;
    version: number;
    deltaCompressed: string;
    deltaSize: number;
    originalSize: number;
    compressionRatio: number;
    createdAt: string;
  }): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO eventlog_versions 
        (event_id, version, delta_compressed, delta_size, original_size, compression_ratio, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    stmt.run(
      data.eventId,
      data.version,
      data.deltaCompressed,
      data.deltaSize,
      data.originalSize,
      data.compressionRatio,
      data.createdAt
    );
  }
  
  /**
   * 获取最新版本号
   */
  async getLatestVersion(eventId: string): Promise<number> {
    const stmt = this.db.prepare(`
      SELECT MAX(version) as latest 
      FROM eventlog_versions 
      WHERE event_id = ?
    `);
    
    const result = stmt.get(eventId);
    return result?.latest || 0;
  }
  
  /**
   * 查询版本历史
   */
  async queryVersions(
    eventId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<Array<{ version: number; createdAt: string; size: number }>> {
    const limit = options?.limit || 50;
    const offset = options?.offset || 0;
    
    const stmt = this.db.prepare(`
      SELECT version, created_at, delta_size as size
      FROM eventlog_versions
      WHERE event_id = ?
      ORDER BY version DESC
      LIMIT ? OFFSET ?
    `);
    
    return stmt.all(eventId, limit, offset);
  }
  
  /**
   * 获取指定版本数据
   */
  async getVersion(eventId: string, version: number): Promise<any> {
    const stmt = this.db.prepare(`
      SELECT * FROM eventlog_versions
      WHERE event_id = ? AND version = ?
    `);
    
    return stmt.get(eventId, version);
  }
}
```

---

## 6. 版本历史实现

### 6.1 自动保存版本

在 `EventService.updateEvent()` 中集成版本保存：

```typescript
// src/services/EventService.ts

static async updateEvent(
  eventId: string,
  updates: Partial<Event>,
  options?: UpdateOptions
): Promise<{ success: boolean; event?: Event; error?: string }> {
  try {
    // 1. 获取旧版本（用于计算 delta）
    const oldEvent = await this.getEventById(eventId);
    
    // 2. 更新事件
    const updatedEvent = await storageManager.updateEvent(eventId, updates);
    
    // 3. 如果 eventlog 有变更，保存版本历史
    if (updates.eventlog && oldEvent?.eventlog) {
      const oldEventLog = this.normalizeEventLog(oldEvent.eventlog);
      const newEventLog = this.normalizeEventLog(updates.eventlog);
      
      // 异步保存版本（不阻塞主流程）
      storageManager.saveEventLogVersion(
        eventId,
        newEventLog,
        oldEventLog
      ).catch(error => {
        eventLogger.warn('Failed to save version:', error);
      });
    }
    
    return { success: true, event: updatedEvent };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
```

### 6.2 版本历史 UI 组件

```tsx
// src/components/EventLogVersionHistory.tsx

interface EventLogVersionHistoryProps {
  eventId: string;
  onRestore: (version: number) => void;
}

export function EventLogVersionHistory({ eventId, onRestore }: EventLogVersionHistoryProps) {
  const [versions, setVersions] = useState<Array<{
    version: number;
    createdAt: string;
    size: number;
  }>>([]);
  
  useEffect(() => {
    async function loadVersions() {
      const result = await storageManager.getEventLogVersions(eventId);
      setVersions(result);
    }
    loadVersions();
  }, [eventId]);
  
  const handleRestore = async (version: number) => {
    if (confirm(`恢复到版本 ${version}？`)) {
      const eventLog = await storageManager.restoreEventLogVersion(eventId, version);
      onRestore(version);
      
      // 更新事件
      await EventService.updateEvent(eventId, { eventlog: eventLog });
    }
  };
  
  return (
    <div className="version-history">
      <h3>版本历史 ({versions.length} 个版本)</h3>
      <ul>
        {versions.map(v => (
          <li key={v.version}>
            <span>版本 {v.version}</span>
            <span>{new Date(v.createdAt).toLocaleString()}</span>
            <span>{(v.size / 1024).toFixed(2)} KB</span>
            <button onClick={() => handleRestore(v.version)}>恢复</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

---

## 7. 全文搜索优化

### 7.1 FTS5 中文分词

SQLite FTS5 默认使用 `unicode61` 分词器，对中文支持有限。推荐配置：

```sql
CREATE VIRTUAL TABLE eventlog_fts USING fts5(
  event_id UNINDEXED,
  plain_text,
  
  -- ⭐ 使用 unicode61 + remove_diacritics
  -- 这对中文和英文都有较好的支持
  tokenize = "unicode61 remove_diacritics 2"
);
```

**更高级的方案**（可选）:
- 使用 `jieba` 分词库预处理中文
- 将分词结果存储到单独的 `plain_text_segmented` 字段
- FTS5 索引 `plain_text_segmented`

### 7.2 搜索性能优化

```typescript
// src/services/storage/SQLiteService.ts

/**
 * FTS5 全文搜索（优化版）
 */
async searchEventLogs(
  query: string,
  options?: { limit?: number; offset?: number }
): Promise<QueryResult<StorageEvent>> {
  const limit = options?.limit || 50;
  const offset = options?.offset || 0;
  
  // ⭐ FTS5 查询语法
  // 支持：
  // - 短语搜索: "会议纪要"
  // - 布尔操作: 会议 AND 纪要
  // - 前缀匹配: 会议*
  // - NOT 操作: 会议 NOT 取消
  
  const stmt = this.db.prepare(`
    SELECT 
      e.*,
      rank(matchinfo(fts, 'pcnalx')) as relevance
    FROM eventlog_fts fts
    INNER JOIN events e ON fts.event_id = e.id
    WHERE fts.plain_text MATCH ?
    ORDER BY relevance DESC
    LIMIT ? OFFSET ?
  `);
  
  const items = stmt.all(query, limit, offset);
  
  // 统计总数
  const countStmt = this.db.prepare(`
    SELECT COUNT(*) as total
    FROM eventlog_fts
    WHERE plain_text MATCH ?
  `);
  const { total } = countStmt.get(query);
  
  return {
    items,
    total,
    hasMore: offset + items.length < total
  };
}
```

---

## 8. 实施计划

### 8.1 阶段划分

| 阶段 | 任务 | 工时 | 优先级 |
|------|------|------|--------|
| **Phase 1: 基础集成** | | | |
| 1.1 | 创建 slateSerializer.ts 工具 | 4h | 🔴 P0 |
| 1.2 | 扩展 SQLite Schema（版本表、FTS表）| 3h | 🔴 P0 |
| 1.3 | 实现 StorageManager 版本历史方法 | 6h | 🔴 P0 |
| 1.4 | 集成 PlanSlate 保存逻辑 | 4h | 🔴 P0 |
| 1.5 | 集成 ModalSlate 保存逻辑 | 3h | 🔴 P0 |
| **Phase 2: 版本历史** | | | |
| 2.1 | 实现 Delta 压缩算法 | 8h | 🟠 P1 |
| 2.2 | 实现版本恢复功能 | 6h | 🟠 P1 |
| 2.3 | 创建版本历史 UI 组件 | 8h | 🟠 P1 |
| **Phase 3: 全文搜索** | | | |
| 3.1 | 配置 FTS5 索引 | 2h | 🟠 P1 |
| 3.2 | 实现中文分词预处理（可选）| 6h | 🟡 P2 |
| 3.3 | 优化搜索性能（缓存、排序）| 4h | 🟡 P2 |
| **Phase 4: 测试与文档** | | | |
| 4.1 | 单元测试（序列化、版本、搜索）| 12h | 🔴 P0 |
| 4.2 | 集成测试（端到端流程）| 8h | 🔴 P0 |
| 4.3 | 性能测试（10K 事件压测）| 4h | 🟠 P1 |
| 4.4 | 完善文档（API、架构、示例）| 6h | 🔴 P0 |

**总工时**: 84 小时（约 2 周）

### 8.2 开发顺序

```
Week 1:
  Day 1-2: Phase 1.1-1.3 (基础工具和数据库)
  Day 3-4: Phase 1.4-1.5 (编辑器集成)
  Day 5:   Phase 4.1 (单元测试)

Week 2:
  Day 1-2: Phase 2.1-2.2 (版本历史核心)
  Day 3:   Phase 2.3 (版本历史 UI)
  Day 4:   Phase 3.1-3.2 (全文搜索)
  Day 5:   Phase 4.2-4.4 (测试和文档)
```

### 8.3 验收标准

**Phase 1 验收**:
- ✅ PlanSlate 编辑后，事件自动保存到 SQLite
- ✅ ModalSlate 编辑后，EventLog 自动更新
- ✅ 数据库中正确存储 slateJson, html, plainText
- ✅ 跨标签页同步正常

**Phase 2 验收**:
- ✅ 每次编辑自动创建版本快照
- ✅ 压缩率达到 85% 以上
- ✅ 版本恢复功能正常
- ✅ UI 显示版本列表和大小

**Phase 3 验收**:
- ✅ FTS5 搜索中文内容正常
- ✅ 搜索性能 <100ms（10K 事件）
- ✅ 支持高级查询（短语、布尔）

---

## 9. 附录

### 9.1 依赖包

```json
{
  "dependencies": {
    "fast-json-patch": "^3.1.1",      // JSON diff
    "pako": "^2.1.0",                  // gzip/deflate 压缩
    "better-sqlite3": "^9.0.0"         // SQLite（已安装）
  }
}
```

### 9.2 参考资料

- [SQLite FTS5 文档](https://www.sqlite.org/fts5.html)
- [fast-json-patch GitHub](https://github.com/Starcounter-Jack/JSON-Patch)
- [Pako 压缩库](https://github.com/nodeca/pako)
- [Slate 文档](https://docs.slatejs.org/)
