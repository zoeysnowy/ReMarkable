# 🔍 数据库集成检查报告

## ✅ 当前架构状态

### 1. **Slate 编辑器 @ 功能**（已实现）

**位置**: `src/components/PlanSlate/PlanSlate.tsx`

**当前功能**:
- ✅ 监听 `@` 符号输入（行 1214）
- ✅ 实时解析自然语言时间（使用 `parseNaturalLanguage`）
- ✅ 显示时间预览（`MentionPreview` 组件）
- ✅ 插入 `DateMention` 节点
- ✅ 与 TimeHub 同步时间

**支持的场景**:
```typescript
// ✅ 已支持
@明天              // → DateMention 节点
@下周二下午3点      // → DateMention + TimePeriod
@12-25            // → 数字日期解析（刚添加的功能）

// ❌ 未支持（需要集成 UnifiedSearchIndex）
@会议纪要          // → 搜索事件
@#工作            // → 搜索标签
@@Alice          // → 搜索人员
@AI 帮我...       // → AI 助手
```

---

### 2. **数据库集成评估**

#### ✅ **已完成的基础设施**

1. **SQLite + FTS5 全文搜索**
   - 位置: `src/services/storage/SQLiteService.ts`
   - 方法: `searchEventLogs(query: string)`
   - 状态: ✅ **已实现**，支持中文分词

2. **EventService 异步 API**
   - 位置: `src/services/EventService.ts`
   - 方法: `getAllEvents(): Promise<Event[]>`
   - 状态: ✅ **已实现**

3. **自然语言时间解析**
   - 位置: `src/utils/naturalLanguageTimeDictionary.ts`
   - 功能: 2000+ 行词典，支持中文/英文
   - 状态: ✅ **已实现**，刚添加数字日期解析

#### 🆕 **新增的 Unified Mention 组件**（待集成）

1. **UnifiedSearchIndex**
   - 位置: `src/services/search/UnifiedSearchIndex.ts`
   - 功能: 内存索引 + Fuse.js 模糊搜索
   - 状态: ✅ **已创建**，待初始化

2. **UnifiedMentionMenu**
   - 位置: `src/components/UnifiedMentionMenu.tsx`
   - 功能: 统一提及菜单 UI
   - 状态: ✅ **已创建**，待集成

---

### 3. **集成缺口分析**

#### ❌ **缺失的部分**

1. **UnifiedSearchIndex 未初始化**
   - 问题: `PlanSlate.tsx` 中没有调用 `unifiedSearchIndex.initialize()`
   - 影响: 无法搜索事件/标签
   - 修复: 在 `App.tsx` 或 `PlanSlate.tsx` 中初始化

2. **@ 触发逻辑仅支持时间**
   - 问题: 当前 `@` 只调用 `parseNaturalLanguage`
   - 影响: 无法搜索非时间内容
   - 修复: 区分时间输入 vs 事件/标签搜索

3. **UnifiedMentionMenu 未集成**
   - 问题: `PlanSlate` 中没有渲染 `UnifiedMentionMenu`
   - 影响: 即使搜索成功，也没有 UI 显示结果
   - 修复: 替换/扩展 `MentionPreview` 组件

---

## 🔧 集成方案（3 种策略）

### **方案 A: 渐进式集成（推荐）⭐**

**优点**: 
- 不破坏现有时间提及功能
- 增量添加事件/标签搜索
- 最小风险

**步骤**:

#### Step 1: 在 App.tsx 中初始化索引
```typescript
// src/App.tsx
import { unifiedSearchIndex } from './services/search/UnifiedSearchIndex';

useEffect(() => {
  // 应用启动时初始化搜索索引（异步，不阻塞 UI）
  unifiedSearchIndex.initialize().catch(err => {
    console.error('❌ 搜索索引初始化失败:', err);
  });
}, []);
```

#### Step 2: 扩展 @ 触发逻辑（区分时间 vs 搜索）
```typescript
// src/components/PlanSlate/PlanSlate.tsx

// 检测 @ 后的输入类型
const atMatch = textBeforeCursor.match(/@([^\s]*)$/);
if (atMatch) {
  const text = atMatch[1];
  
  // 策略：优先尝试时间解析，失败则搜索事件/标签
  const timeParsed = parseNaturalLanguage(text);
  
  if (timeParsed && timeParsed.matched) {
    // ✅ 时间解析成功 → 显示 MentionPreview
    setMentionType('time');
    setShowMentionPicker(true);
  } else if (text.length >= 2) {
    // ❌ 时间解析失败 → 搜索事件/标签
    setMentionType('search');
    setSearchQuery(text);
    setShowSearchMenu(true);
  }
}
```

#### Step 3: 添加 UnifiedMentionMenu（与 MentionPreview 并存）
```typescript
// PlanSlate.tsx

{/* 时间提及（原有） */}
{showMentionPicker && mentionType === 'time' && (
  <MentionPreview
    startTime={mentionInitialStart}
    onConfirm={handleMentionConfirm}
  />
)}

{/* 事件/标签搜索（新增） */}
{showSearchMenu && mentionType === 'search' && (
  <UnifiedMentionMenu
    query={searchQuery}
    onSelect={handleSearchSelect}
    onClose={() => setShowSearchMenu(false)}
    context="editor"
  />
)}
```

---

### **方案 B: 完全替换（激进）**

**优点**: 
- 统一 UI，体验一致
- 更符合 Notion/Linear 的设计

**缺点**: 
- 需要重写 @ 触发逻辑
- 风险较高

**实现**: 
- 移除 `MentionPreview`
- 所有 @ 输入都通过 `UnifiedMentionMenu` 处理
- 在菜单中添加"时间"分组

---

### **方案 C: 混合菜单（折中）**

**优点**: 
- 保留时间预览的即时反馈
- 同时提供搜索选项

**实现**:
- 如果时间解析成功，显示 `MentionPreview`
- 在预览下方添加"或搜索事件"按钮
- 点击按钮切换到 `UnifiedMentionMenu`

---

## 🎯 推荐行动计划

### **立即实施**（本周）

1. ✅ **初始化搜索索引**（5 分钟）
   ```typescript
   // src/App.tsx - useEffect 中添加
   unifiedSearchIndex.initialize();
   ```

2. ✅ **扩展 @ 触发逻辑**（30 分钟）
   - 区分时间解析 vs 事件搜索
   - 添加 `mentionType` 状态

3. ✅ **集成 UnifiedMentionMenu**（1 小时）
   - 在 PlanSlate 中添加搜索菜单
   - 处理选中回调

### **短期优化**（本月）

4. 🔧 **完善搜索结果处理**
   - 事件选中 → 插入事件链接
   - 标签选中 → 插入标签节点
   - AI 选中 → 触发 AI 助手

5. 🎨 **优化 UI**
   - 合并两个菜单的样式
   - 添加键盘导航支持

### **中期目标**（下月）

6. 🚀 **性能优化**
   - 添加搜索结果缓存
   - 实现增量索引更新

7. ☁️ **准备上云**
   - 创建 PostgreSQL 适配器
   - 实现混合搜索（本地 + 云端）

---

## 📊 当前数据库性能

### **测试方法**

在浏览器 DevTools Console 中运行：

```javascript
// 1. 测试 EventService 查询速度
console.time('getAllEvents');
await window.EventService.getAllEvents();
console.timeEnd('getAllEvents');

// 2. 测试 FTS5 搜索速度
console.time('searchEventLogs');
await window.storageManager.searchEventLogs('会议');
console.timeEnd('searchEventLogs');

// 3. 测试 UnifiedSearchIndex（初始化后）
console.time('unifiedSearch');
await window.unifiedSearchIndex.search({ query: '会议', limit: 10 });
console.timeEnd('unifiedSearch');
```

### **预期性能**

| 操作 | 数据量 1K | 数据量 10K | 数据量 100K |
|------|----------|-----------|------------|
| getAllEvents | <10ms | <50ms | ~200ms |
| FTS5 搜索 | <5ms | <20ms | <100ms |
| Unified搜索 | <5ms | <30ms | ~150ms |

---

## ✅ 总结

### **数据库集成状态**

- ✅ **SQLite + FTS5**: 已实现，性能优秀
- ✅ **EventService API**: 已实现，接口完善
- ✅ **自然语言解析**: 已实现，支持数字日期
- 🆕 **UnifiedSearchIndex**: 已创建，**待初始化和集成**
- 🆕 **UnifiedMentionMenu**: 已创建，**待集成到 PlanSlate**

### **下一步行动**

1. **立即**: 在 `App.tsx` 初始化 `unifiedSearchIndex`
2. **今天**: 扩展 `PlanSlate` 的 @ 触发逻辑
3. **本周**: 集成 `UnifiedMentionMenu` 组件
4. **本月**: 完善搜索结果处理和 UI

### **风险评估**

- 🟢 **低风险**: 初始化索引（不影响现有功能）
- 🟡 **中风险**: 扩展 @ 触发逻辑（可能影响时间提及）
- 🟢 **低风险**: 添加新菜单（与现有菜单并行）

---

**建议**: 先实施"方案 A: 渐进式集成"，保持现有时间提及功能不变，增量添加事件/标签搜索。
