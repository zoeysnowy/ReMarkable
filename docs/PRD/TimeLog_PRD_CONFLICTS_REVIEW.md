# TimeLog PRD 冲突与矛盾审阅文档

> **说明**: 请在每个问题下方的 `> 👤 Zoey 回复:` 部分添加你的回复/决策
> 
> **审阅日期**: 2025-11-13  
> **审阅人**: GitHub Copilot  
> **文档版本**: TimeLog_&_Description_PRD.md (2858行)

---

## ⚠️ CRITICAL 级别冲突（阻塞实施）

### 冲突 #1: TimeLog 数据结构架构差异

**PRD 期望（Section 1.3）:**
```typescript
type TimeLog = {
  id: string;
  eventId: string;
  content: Descendant[];        // Slate JSON 富文本
  descriptionHtml: string;
  descriptionPlainText: string;
  attachments: Attachment[];
  versions: TimeLogVersion[];
  syncState: SyncState;
  createdAt: Date;
  updatedAt: Date;
}
```

**当前实现 (src/types.ts L136):**
```typescript
interface Event {
  id: string;
  title: string;
  timelog?: string;  // ❌ 只是简单的 HTML 字符串
  // ... 其他字段
}
```

**冲突说明:**
- PRD 要求 `TimeLog` 是**独立实体**（单独的数据表/集合），与 Event 一对一关联
- 当前代码中 `timelog` 是 Event 接口的**可选字段**
- 这是架构级差异，影响：
  - 数据库设计（是否需要单独的 timelogs 表）
  - 版本控制实现（versions 字段存储位置）
  - 同步逻辑（Event 和 TimeLog 是否分开同步）

**问题:**
1. **是否需要将 TimeLog 拆分为独立实体？**
   - 优点：符合关系型设计，版本历史独立存储，易于查询优化
   - 缺点：增加复杂度，需要额外的联表查询

2. **如果保持嵌入式设计（timelog 作为 Event 字段），需要修改哪些 PRD 内容？**
   - versions 数组存储位置
   - 数据库 schema 设计
   - API 接口设计

> 👤 **Zoey 回复:**
> ✅ **采用嵌入式设计** - timelog 作为 Event 的字段
> 
> **决策理由:**
> 1. TimeLog 本质是"事件的详细描述"，是 1:1 关系
> 2. 简化数据操作，一次查询即可获取完整事件
> 3. Outlook 同步更自然（body 直接对应 timelog）
> 4. 避免事务一致性问题和孤儿记录
> 
> **实施方案:**
> - Event.timelog 字段类型改为对象：`{ content, descriptionHtml, versions, syncState }`
> - 版本数组存储在 `Event.timelog.versions`（最多保留 50 个）
> - MongoDB 优先（原生支持嵌入文档），SQLite 备选（JSON 序列化）
> - 旧版本归档策略：50+ 版本时移至单独的 `event_versions` 表
> 
> **需修改 PRD 章节:**
> - Section 1.3: 删除独立 TimeLog 类型，改为 Event.timelog 字段
> - Section 6: 版本控制基于 Event.timelog.versions
> - Section 3: 同步逻辑简化为单实体同步
> - Section 7.2: 数据库设计改为单表 + 可选归档表
> 
> 


---

### 冲突 #2: TimeSpec 时间字段未完全迁移


**PRD 第 10 节警告 (L2649):**
> 🚫 绝对禁止的做法：
> ```typescript
> // ❌ 错误: 使用 ISO 字符串或 Date 对象
> const marker = { timestamp: new Date().toISOString() };
> event.startTime = new Date();
> ```
> 
> ✅ 正确做法：
> ```typescript
> const timeSpec: TimeSpec = {
>   kind: 'fixed',
>   source: 'system',
>   rawText: null,
>   policy: TimePolicy.getDefault(),
>   resolved: { start: now, end: now },
>   start: now,
>   end: now,
>   allDay: false,
> };
> ```

**当前实现 (src/types.ts L80-92):**
```typescript
interface Event {
  startTime: string;      // ❌ ISO 字符串（与 PRD 冲突）
  endTime: string;        // ❌ ISO 字符串
  timeSpec?: TimeSpec;    // ⚠️ 可选字段（双重状态）
  // ...
}
```

**从 TimeHub.ts 代码看:**
```typescript
// src/services/TimeHub.ts 已实现 TimeSpec 架构
async setEventTime(eventId: string, input: {...}) {
  const timeSpec: TimeSpec = {...};
  await EventService.updateEvent(eventId, { timeSpec });
}
```

**冲突说明:**
- `TimeHub` 服务已正确实现 TimeSpec 架构
- 但 `Event` 接口仍保留 `startTime/endTime` 字符串字段
- 代码中存在**双重时间状态**：既有 `timeSpec` 又有 `startTime/endTime`

**问题:**
1. **是否应该移除 `startTime/endTime` 字符串字段，完全迁移到 TimeSpec？**
   - 如果是：需要修改所有读取 `event.startTime` 的代码（包括 Outlook 同步）
   - 如果否：如何保证两者一致性？谁是 source of truth？

2. **PRD 中 ContextMarkerElement 使用 TimeSpec，但 Event 仍用字符串，是否矛盾？**

3. **数据库存储时如何序列化 TimeSpec？**（它包含 Date 对象和函数 policy）

> 👤 **Zoey 回复:**
> ✅ **采用方案 A：保留双重状态，明确职责**
> 
> **澄清误解：**
> - `Event.startTime/endTime` 不仅用于 timelog，还用于日历渲染、事件查询、Outlook 同步
> - 这些字段必须保留，但需要明确：它们是**派生字段**，不是 source of truth
> 
> **决策内容：**
> 1. **timeSpec 作为权威来源**（source of truth）
>    - 所有应用内的时间显示、查询都从 timeSpec 读取
>    - timeSpec 必填（不再是可选字段）
> 
> 2. **startTime/endTime 作为派生字段**（仅用于存储和同步）
>    - 用途：数据库索引、Outlook API 交互
>    - 更新规则：每次 TimeHub 更新 timeSpec 时，自动同步更新 startTime/endTime
>    - **禁止**直接读取这两个字段（除了同步和数据库查询逻辑）
> 
> 3. **时区处理规范：**
>    - startTime/endTime 存储 **UTC ISO 8601** 字符串（用于跨时区同步）
>    - timeSpec 存储 **用户本地时间 + 时区策略**（用于显示）
>    - 通过 TimeHub 保证两者一致性
> 
> **实施要求：**
> - 修改 Event 接口：`timeSpec?: TimeSpec` → `timeSpec: TimeSpec`（必填）
> - TimeHub.setEventTime() 同时更新 timeSpec 和 startTime/endTime
> - 所有 UI 组件改用 useEventTime() hook（禁止直接读取 startTime）
> - 添加数据验证：确保 timeSpec.resolved.start 与 new Date(startTime) 一致
> 
> **迁移策略：**
> - 对于没有 timeSpec 的旧数据，从 startTime/endTime 重建 timeSpec（kind='fixed'）
> - 添加数据库迁移脚本，确保所有 Event 都有 timeSpec 字段
> 


---

### 冲突 #3: ContextMarker 系统完全缺失

**PRD 要求 (Section 2):**
- 自动检测 5 分钟无活动，插入 `ContextMarkerElement`
- 需要 `DesktopActivityService` 监听桌面应用（使用 `active-win` 库）
- 需要在 Slate 编辑器中渲染时间轴和活动轴

**当前代码检查:**
```bash
$ grep -r "ContextMarker" src/
# 无结果

$ grep -r "ActivityService" src/
# 无结果

$ grep -r "active-win" package.json
# 无结果
```

**PRD 示例代码 (L200-500):**
```typescript
// 需要实现的组件
class DesktopActivityService {
  async getCurrentActivity(): Promise<AppActivity | null> {...}
  async startMonitoring(callback: (activity: AppActivity) => void) {...}
}

type ContextMarkerElement = {
  type: 'context-marker';
  timeSpec: TimeSpec;
  activities: ActivitySpan[];
  children: [{ text: '' }];
}
```

**问题:**
1. **ContextMarker 是否为核心功能？**
   - 如果是：需要在 Phase 1 实现
   - 如果否：可以作为 v2.0 功能

2. **桌面应用监听是否需要用户权限？**
   - macOS 需要辅助功能权限
   - Windows 需要管理员权限吗？
   - 如何处理用户拒绝授权的情况？

3. **隐私问题：活动日志是否需要加密或本地化？**
   - 活动数据是否同步到 Outlook？（PRD 未明确）
   - 是否需要"隐私模式"（不记录特定应用）？

> 👤 **Zoey 回复:**
> 
> 1. 可以作为2.0实现
> 2. Windows应该不用，到时候我们再具体看这部分的方案，有个开源的方案叫shion到时候可以借鉴
> 3. 活动日志不用给Outlook



---

## 🟡 MAJOR 级别冲突（可分期实施）

### 冲突 #4: 版本控制系统缺失

**PRD 要求 (Section 6):**
```typescript
type TimeLogVersion = {
  id: string;
  timestamp: Date;  // ⚠️ 见冲突 #6
  content: Descendant[];
  diff?: Delta;
  triggerType: VersionTriggerType;
  changesSummary: string;
  contentHash: string;
}

class VersionControlService {
  private AUTO_SAVE_INTERVAL = 5 * 60 * 1000; // 5 分钟
  async createVersion(trigger: VersionTriggerType) {...}
  recordOperation(operation: SlateOperation) {...}
}
```

**当前实现:**
- ❌ 无 `VersionControlService` 类
- ❌ 无版本历史 UI
- ❌ 无自动保存机制

**问题:**
1. **版本历史存储位置：**
   - 如果 TimeLog 是独立实体：`versions` 数组在 `timelogs` 表
   - 如果 TimeLog 是 Event 字段：`versions` 数组存在哪？Event 表吗？

2. **版本压缩策略是否过于复杂？**（Section 6.6）
   - PRD 提出：最近 10 个完整快照，11-50 个 diff，50+ 每 10 个保留一个
   - 实际需求是否这么高？是否可以简化为"保留最近 N 个版本"？

3. **diff 算法选择：**
   - PRD 提到 `diff-match-patch` 或 `Myers diff`
   - 对于 Slate JSON，是否需要更智能的树形 diff？

> 👤 **Zoey 回复:**
> 是的，我们的eventservice有CRUD，但是我们应该要构建一个eventhistory的服务

功能	状态	说明
CRUD 操作	✅ 有	EventService 提供完整的增删改查
当前状态存储	✅ 有	localStorage 存储所有事件的当前状态
历史记录	❌ 无	不记录事件的变更历史
变更溯源	❌ 无	无法查询"谁在什么时候改了什么"
时间段查询	❌ 无	无法查询"过去7天创建/修改了哪些事件"
> 


---

### 冲突 #5: 同步引擎设计与现有代码不匹配

**PRD 期望 (Section 3):**
```typescript
class SyncEngine {
  async syncEvent(eventId: string) {
    // 1. 检测冲突
    const conflict = detectConflict(localEvent, remoteEvent);
    
    // 2. 根据冲突类型处理
    switch (conflict) {
      case 'local-changed': await pushToOutlook(localEvent);
      case 'remote-changed': await pullFromOutlook(remoteEvent);
      case 'both-changed': await resolveConflict(localEvent, remoteEvent);
    }
  }
  
  detectConflict(local, remote): ConflictType {
    // 使用 contentHash 比对
    if (local.syncState.hash !== remote.hash) {...}
  }
}
```

**当前实现 (src/services/EventService.ts L268):**
```typescript
// 只是简单的字段复制，无冲突检测
timelog: ((updates as any).timelog || '').substring(0, 50)
```

**问题:**
1. **冲突检测算法：**
   - PRD 使用 `contentHash` 比对，但如何处理 TimeSpec 等复杂对象？
   - 是否需要字段级冲突检测（title 改了，description 没改）？

2. **三方合并 UI：**
   - PRD 未说明冲突解决界面
   - 是弹窗选择？还是像 Git 一样显示 diff？

3. **Outlook API 限制：**
   - Outlook 的 `body.content` 是 HTML，如何存储 Slate JSON 的元数据？
   - 是否需要在 HTML 注释中嵌入 JSON？（见冲突 #7）

> 👤 **Zoey 回复:**
> 1. 是的，字段级别冲突会更好。另外我们timelog自动生成的timestamp显示，不支持用户做修改，它就是固定的UI显示，和用户设定的event起始时间是两个东西
> 2. 像git一样显示diff，并且供用户选择keep/undo
> 3. 好问题，这是需要设计的，从timelog转化到description，需要一次转化，把json转化到html，尽可能保留原有的信息和格式（e.g. 字体颜色、背景色、加粗、斜体、bulletpoint等），针对表格需要转化成类似markdown样式让用户可以多端阅读到信息，图片、附件等需要提示用户，点击link查看图片，这个link跳转到整个timelog的web页面。我这里罗列了大致的方案，具体的设计实现请你为我在PRD中详细设计

> 🤖 **Resolution (Copilot):**
> **Status**: ✅ 已解决  
> **Commit**: 0b5893b  
> **PRD Sections**: 5.2.1 (字段级冲突检测), 5.4 (智能序列化), 5.5 (Git风格Diff UI)
> 
> **实施方案**:
> 1. **字段级冲突检测** (5.2.1, ~500 lines):
>    - 三向合并：local/remote/base (使用EventHistory作为base)
>    - 检测字段：title, tags, timelog.description, timelog.timeSpent, startTime, endTime
>    - 自动解决：单侧修改 → 自动合并；双侧修改 → 手动解决
>    - `FieldLevelConflictResult` 接口定义
> 
> 2. **智能序列化系统** (5.4, ~300 lines):
>    - **格式保留**：颜色/背景色/加粗/斜体/下划线/列表/链接 → 标准HTML
>    - **表格降级**：Slate table → Markdown文本表格 (包装在`<pre>`中)
>    - **媒体降级**：图片/视频/附件 → `📷 [查看图片: filename.png](link)`
>    - **Web Viewer URL**: `https://app.remarkable.com/events/{eventId}/timelog#image-{id}`
>    - 逆向序列化：Outlook HTML → Slate JSON (有损转换)
> 
> 3. **Git风格Diff UI** (5.5, ~500 lines):
>    - **三栏对比**：本地版本/基准版本/远程版本
>    - **操作按钮**：Keep Local / Keep Remote / Merge...
>    - **自动合并展示**：显示已自动解决的字段 + 撤销功能
>    - **手动合并对话框** (针对Description)：
>      - 并排显示本地/远程Slate内容
>      - 提供"插入远程段落"功能
>      - 实时预览合并结果
>    - 组件：`ConflictResolverDialog`, `FieldConflictPanel`, `VersionCard`, `FieldMergeDialog`
> 
> **核心算法示例**:
> ```typescript
> // 字段级冲突检测
> async detectFieldLevelConflicts(local, remote, lastSync) {
>   const fields = ['title', 'tags', 'timelog.description', ...];
>   const conflicts: FieldConflict[] = [];
>   
>   for (const field of fields) {
>     const localValue = get(local, field);
>     const remoteValue = get(remote, field);
>     const baseValue = get(lastSync, field);
>     
>     if (localValue !== baseValue && remoteValue !== baseValue) {
>       // 双侧修改：需要手动解决
>       conflicts.push({ field, resolution: 'manual-required', ... });
>     } else if (localValue !== baseValue) {
>       // 单侧修改（本地）：自动采用本地
>       conflicts.push({ field, resolution: 'auto-local', ... });
>     } else if (remoteValue !== baseValue) {
>       // 单侧修改（远程）：自动采用远程
>       conflicts.push({ field, resolution: 'auto-remote', ... });
>     }
>   }
>   
>   return { hasConflict: conflicts.some(c => c.resolution === 'manual-required'), ... };
> }
> 
> // Markdown表格序列化
> function serializeTable(tableNode) {
>   // 1. 提取表头和数据
>   const headers = tableNode.children[0].children.map(extractCellText);
>   // 2. 计算列宽
>   const columnWidths = calculateColumnWidths(tableNode);
>   // 3. 生成Markdown
>   return `<pre>\n| ${headers.join(' | ')} |\n|${'---'.repeat(n)}|\n...</pre>`;
> }
> 
> // Web Viewer链接生成
> function serializeImage(imageNode, eventId) {
>   const url = `https://app.remarkable.com/events/${eventId}/timelog#image-${imageNode.id}`;
>   return `<p>📷 <a href="${url}">查看图片: ${imageNode.fileName}</a></p>`;
> }
> ```
> 
> **章节更新**:
> - Section 5.2.1: 字段级冲突检测 (新增)
> - Section 5.2.2: 冲突检测流程图 (新增)
> - Section 5.2.3: Slate → HTML 序列化 (更新)
> - Section 5.4: 智能序列化系统 (新增)
> - Section 5.5: Git风格Diff UI (新增)
> - Section 5.6 → 5.7: 增量同步优化 (重编号)
> - Section 6 → 7: EventHistoryService (重编号)
> - Section 7 → 8: VersionControlService (重编号)
> - Section 8 → 9: 实现指南 (重编号)
> - Section 9 → 10: 性能优化 (重编号)


---

## 🟠 MINOR 级别矛盾（PRD 内部不一致）

### 冲突 #6: 版本控制的 timestamp 字段类型矛盾

**PRD Section 6.2 (L1760):**
```typescript
/**
 * 版本快照（每 5 分钟或重要操作时保存）
 * 
 * ⚠️ 注意：timestamp 字段保留为 Date 类型用于内部处理
 * 但在序列化/反序列化时应通过 TimeHub 管理
 */
type TimeLogVersion = {
  timestamp: Date;  // ❌ 使用 Date 类型
  // ...
}
```

**PRD Section 10.1 (L2649) - 核心原则:**
> 🚫 绝对禁止的做法：
> ```typescript
> // ❌ 错误 2: 直接操作 Date 对象
> event.startTime = new Date();
> ```

**矛盾点:**
- PRD 自己在版本控制部分违反了时间架构原则
- 一方面说"禁止 Date 对象"，另一方面又用 `timestamp: Date`

**问题:**
1. **版本快照的时间是否也应该用 TimeSpec？**
   ```typescript
   type TimeLogVersion = {
     timeSpec: TimeSpec;  // 替代 timestamp: Date
     // ...
   }
   ```

2. **如果保留 `timestamp: Date`，注释中的"通过 TimeHub 管理"具体指什么？**

> 👤 **Zoey 回复:**
> ✅ **采用统一 TimeHub 方案** - 扩展 TimeHub 管理所有时间戳
> 
> **决策理由:**
> 1. TimeHub 应该是应用内唯一的"时间真相源"
> 2. TimeLogVersion 的时间戳是"系统自动记录"，与 Event.timeSpec 的"用户设定"本质不同
> 3. 避免到处 `new Date()`，方便未来扩展（NTP 校时、时间旅行调试）
> 
> **实施方案:**
> - **扩展 TimeHub 职责**：从"管理 Event 时间"扩展到"管理所有应用内时间状态"
> - **两类时间管理**：
>   1. **事件时间 (Event Time)**: 用户设定的"事件发生时间"
>      - 使用 TimeSpec 结构
>      - 支持模糊时间、时区策略
>      - 方法: `setEventTime()`, `getEventTime()`
>   2. **系统时间戳 (System Timestamp)**: 自动记录的"操作时间"
>      - 使用 Date 对象（内部）+ UTC 字符串（存储）
>      - 精确到毫秒，UTC 存储
>      - 方法: `recordTimestamp()`, `formatTimestamp()`, `parseTimestamp()`
>      - 用途: 版本历史、事件历史、日志等
> 
> **TimeHub 新增方法:**
> ```typescript
> class TimeHub {
>   // 记录系统时间戳（替代 new Date()）
>   recordTimestamp(): Date
>   
>   // 格式化为 UTC 字符串（存储用）
>   formatTimestamp(date: Date): string
>   
>   // 解析 UTC 字符串（读取用）
>   parseTimestamp(isoString: string): Date
>   
>   // 格式化为相对时间（UI 显示用）
>   formatRelativeTime(date: Date | string): string  // "2分钟前"
> }
> ```
> 
> **使用示例:**
> ```typescript
> // VersionControlService
> const version = {
>   createdAt: TimeHub.recordTimestamp(),  // 替代 new Date()
> };
> await db.save({
>   ...version,
>   createdAt: TimeHub.formatTimestamp(version.createdAt),  // 存储为 UTC
> });
> 
> // EventHistoryService
> const entry = {
>   timestamp: TimeHub.recordTimestamp(),
> };
> 
> // UI 显示
> <span>{TimeHub.formatRelativeTime(version.createdAt)}</span>
> ```
> 
> **需修改 PRD 章节:**
> - Section 7.2: 新增 TimeHub 扩展章节（系统时间戳管理）
> - Section 7.2: TimeLogVersion.timestamp → createdAt（语义更清晰）
> - Section 7.3: VersionControlService 使用 TimeHub.recordTimestamp()
> - Section 6.4: EventHistoryService 使用 TimeHub.recordTimestamp()
> - Section 10.1: 更新时间架构原则（明确两类时间的区别）
> 

> 🤖 **Resolution (Copilot):**
> **Status**: ✅ 已解决  
> **Commit**: [待提交]  
> **PRD Sections**: 7.2.1 (TimeHub 扩展), 7.2.2 (TimeLogVersion 修正), 7.3 (VersionControlService), 6.4 (EventHistoryService)


---

### 冲突 #7: 序列化层的时间处理不一致

**PRD Section 10.4 (L2700) - 同步到 Outlook:**
```typescript
// 序列化 ContextMarker 时使用 ISO 字符串
const serializeContextMarker = (marker: ContextMarkerElement): string => {
  const { timeSpec } = marker;
  const { start } = timeSpec.resolved;
  
  return `
    <div class="context-marker" data-time="${start.toISOString()}">
      ...
    </div>
  `;
};
```

**PRD Section 10.4 (L2720) - 从 Outlook 反序列化:**
```typescript
const deserializeContextMarker = (html: string): ContextMarkerElement | null => {
  const timeAttr = div.getAttribute('data-time');
  const date = new Date(timeAttr);  // ❌ 使用 Date 构造函数
  
  // 然后又重建 TimeSpec
  const timeSpec: TimeSpec = {
    kind: 'fixed',
    source: 'import',
    // ...
    start: date,
    end: date,
  };
};
```

**问题:**
1. **为什么导出时可以用 ISO 字符串，内部不能？**
   - 这导致往返同步时会丢失 TimeSpec 的元数据（`kind`, `rawText`, `policy`）

2. **如何保留 TimeSpec 完整信息？**
   - 建议在 HTML 中嵌入完整 JSON：
     ```html
     <div data-timespec='{"kind":"fuzzy","rawText":"下周"}'>
     ```

3. **Outlook 会过滤自定义 data 属性吗？**
   - 需要实际测试 Outlook 是否保留 `data-*` 属性

> 👤 **Zoey 回复:**
> 
> 


---

### 冲突 #8: 标签语义规则不完整

**PRD Section 4.3 (L900):**
> **规则：**
> - Title 中的标签 → 添加到 `Event.tags` 数组
> - Description 中的标签 → **不添加**到 `Event.tags`，仅作为提及

**示例:**
```
Title: 完成 #项目A 的设计稿
Description: 需要与 #张三 讨论，参考 #项目B 的风格
```
结果：
- `Event.tags = ['项目A']`  （只包含 Title 的标签）

**未明确的场景:**
1. **用户把 Description 中的标签移动到 Title 怎么办？**
   - 是否需要自动检测并更新 `Event.tags`？
   - 还是要求用户手动同步？

2. **删除 Title 中的标签是否自动从 `Event.tags` 移除？**

3. **标签重命名如何处理？**
   - 如果用户重命名 `#项目A` → `#项目Alpha`
   - Description 中所有 `#项目A` 是否自动更新？

4. **同名标签但不同颜色怎么办？**
   - `#工作` 在 Title（红色）和 Description（蓝色）都出现

> 👤 **Zoey 回复:**
> 
> 


---

## 🟢 LOW 级别问题（规格不完整）

### 问题 #9: 数据库迁移方案缺失

**PRD Section 7.2:**
> - 开发阶段：使用 SQLite（简单、文件存储）
> - 生产环境：使用 MongoDB（更好的 JSON 支持）

**当前状态:**
- 当前代码中 `timelog` 是字符串
- 需要迁移到 Slate JSON 格式

**缺失内容:**
1. **迁移脚本示例：**
   ```typescript
   // 如何从 timelog: string 转换为 content: Descendant[]
   async migrateTimelogToSlateJSON(event: Event) {
     const html = event.timelog;
     const slateContent = htmlToSlate(html);
     // ...
   }
   ```

2. **版本兼容性：**
   - 旧版本应用如何读取新格式数据？
   - 是否需要保留 `descriptionHtml` 作为降级方案？

> 👤 **Zoey 回复:**
> 
> 


---

### 问题 #10: 离线队列触发时机不明确

**PRD Section 3.6 (L1700):**
```typescript
class OfflineQueue {
  async enqueue(eventId: string, operation: string) {
    this.queue.push({ eventId, operation, timestamp: Date.now() });
  }
  
  async processQueue() {
    // 处理队列中的操作
  }
}
```

**未明确的问题:**
1. **何时调用 `processQueue()`？**
   - 网络恢复时自动触发？
   - 应用启动时检查？
   - 用户手动点击"同步"按钮？

2. **失败重试策略：**
   - PRD 提到"重试 3 次"，但重试间隔是多少？
   - 是否需要指数退避（exponential backoff）？

3. **队列持久化：**
   - PRD 使用 `localStorage`，但 Electron 应该用文件存储
   - 如何处理应用崩溃时队列丢失？

> 👤 **Zoey 回复:**
> 
> 


---

### 问题 #11: 附件存储路径和大小限制

**PRD Section 1.3:**
```typescript
type Attachment = {
  id: string;
  filename: string;
  size: number;
  mimeType: string;
  url: string;
  uploadedAt: Date;
}
```

**PRD Section 7.2:**
> - 本地缓存：`app.getPath('userData')/attachments/`
> - 云存储：OneDrive（与 Outlook 集成更好）

**未明确的问题:**
1. **附件大小限制：**
   - 单个文件最大多少 MB？
   - 总存储空间限制？

2. **本地缓存清理策略：**
   - 30 天未访问的附件是否删除？
   - 用户是否可以手动管理缓存？

3. **OneDrive 上传失败怎么办？**
   - 是否需要降级到本地存储？
   - 如何通知用户？

> 👤 **Zoey 回复:**
> 
> 


---

## 📋 总结与建议

### 需要立即决策的问题（阻塞开发）

- [ ] **冲突 #1**: TimeLog 是否为独立实体？
- [ ] **冲突 #2**: 是否完全移除 startTime/endTime 字符串？
- [ ] **冲突 #3**: ContextMarker 是 v1.0 核心功能还是 v2.0？

### 需要补充/修正 PRD 的内容

- [ ] **冲突 #6**: 修正 TimeLogVersion.timestamp 的类型定义
- [ ] **冲突 #7**: 明确序列化时如何保留 TimeSpec 完整信息
- [ ] **冲突 #8**: 补充标签语义的边界场景处理规则

### 建议分期实施的功能

- [ ] **冲突 #4**: 版本控制系统 → Phase 3
- [ ] **冲突 #5**: 高级同步功能（冲突检测）→ Phase 2
- [ ] **问题 #10**: 离线队列 → Phase 2

---

## 📝 回复指南

请在每个 `> 👤 Zoey 回复:` 部分添加你的决策，可以使用：

- ✅ 同意 PRD 设计
- ❌ 拒绝，改用 [替代方案]
- 🔄 修改为 [新设计]
- ⏸️ 暂缓，留到 v2.0
- ❓ 需要更多信息

**示例回复格式:**
```markdown
> 👤 **Zoey 回复:**
> ✅ 同意将 TimeLog 作为独立实体
> 
> 决策理由：
> 1. 版本历史数据量大，独立表便于查询优化
> 2. 未来可能支持多用户协作，独立实体更灵活
> 
> 实施要求：
> - 使用 SQLite 的 Foreign Key 关联 Event
> - 添加索引：CREATE INDEX idx_timelog_eventid ON timelogs(eventId)
```

