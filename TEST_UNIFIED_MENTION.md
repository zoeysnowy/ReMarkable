# Unified Mention 测试指南

## ✅ 集成已完成

### 1. App.tsx 初始化 ✅
- 位置：`src/App.tsx` 第 117-129 行
- 功能：应用启动时初始化 UnifiedSearchIndex
- 验证：打开浏览器控制台，查看日志
  ```
  🔍 [App] Initializing Unified Mention search index...
  ✅ [App] Search index initialized
  ```

### 2. PlanSlate 集成 ✅
- 文件：`src/components/PlanSlate/PlanSlate.tsx`
- 新增状态：mentionType, searchQuery, showSearchMenu
- @ 检测优先级：
  1. 尝试时间解析（parseNaturalLanguage）
  2. 时间解析成功 → UnifiedDateTimePicker
  3. 时间解析失败 + 输入 ≥2 字符 → UnifiedMentionMenu

### 3. 组件创建 ✅
- `src/services/search/UnifiedSearchIndex.ts` - 搜索引擎
- `src/components/UnifiedMentionMenu.tsx` - UI 组件
- `src/components/UnifiedMentionMenu.css` - 样式

---

## 🧪 功能测试步骤

### 测试 1: 检查初始化
打开浏览器 DevTools Console：
```javascript
// 检查全局对象是否存在
console.log(window.unifiedSearchIndex);

// 检查索引状态
console.log(window.unifiedSearchIndex.initialized);
```

**预期结果**：
- `window.unifiedSearchIndex` 存在
- `initialized` 为 `true`

---

### 测试 2: 时间提及（回归测试）
在 PlanSlate 编辑器中输入：
```
@明天
@下周二下午3点
@12-25
```

**预期结果**：
- 显示 UnifiedDateTimePicker（蓝色时间选择器）
- 可以选择时间并插入 DateMention 节点

---

### 测试 3: 事件搜索（新功能）
在 PlanSlate 编辑器中输入：
```
@会议
@项目
@测试
```

**预期结果**：
- 显示 UnifiedMentionMenu（白色搜索结果菜单）
- 菜单包含：
  - Top Hit（最佳匹配）
  - Events 列表（标题包含关键词的事件）
  - Tags 列表（标签包含关键词）
  - Time（如果输入可解析为时间）
  - AI（如果输入是问题）

---

### 测试 4: 标签搜索
在 PlanSlate 编辑器中输入：
```
@#工作
@#学习
```

**预期结果**：
- 显示匹配的标签列表
- 可以选择并插入 Tag 节点

---

### 测试 5: 键盘导航
1. 输入 `@会议`
2. 使用 ↓ 键向下导航
3. 使用 ↑ 键向上导航
4. 按 Enter 确认选择
5. 按 Esc 取消

**预期结果**：
- 上下箭头可以切换选中项（蓝色高亮）
- Enter 插入选中项
- Esc 关闭菜单并删除 `@会议` 文本

---

### 测试 6: 鼠标交互
1. 输入 `@项目`
2. 鼠标悬停在结果上
3. 点击某个结果

**预期结果**：
- 悬停时高亮显示
- 点击后插入选中项

---

### 测试 7: 空搜索
输入：
```
@
```
（只输入 @ 符号，不输入任何字符）

**预期结果**：
- 不显示任何菜单（输入 <2 字符）

---

### 测试 8: AI 助手触发
输入：
```
@帮我写一个会议纪要
@如何创建新事件
```

**预期结果**：
- 搜索结果中显示 AI 选项（🤖 图标）
- 点击后触发 AI 助手（当前只打印日志）

---

## 📊 性能测试

在浏览器控制台运行：

```javascript
// 测试 1: EventService 查询速度
console.time('getAllEvents');
const events = await window.EventService.getAllEvents();
console.timeEnd('getAllEvents');
console.log('Event count:', events.length);

// 测试 2: FTS5 全文搜索
console.time('FTS5 search');
const results = await window.storageManager.searchEventLogs('会议');
console.timeEnd('FTS5 search');
console.log('Search results:', results.length);

// 测试 3: Unified Search
console.time('Unified search');
const unified = await window.unifiedSearchIndex.search({ query: '会议', limit: 10 });
console.timeEnd('Unified search');
console.log('Unified results:', unified);

// 测试 4: 检查索引状态
console.log('Index initialized:', window.unifiedSearchIndex.initialized);
console.log('Events indexed:', window.unifiedSearchIndex.eventsIndex?.size());
```

**性能目标**：
- getAllEvents: <50ms (10K events)
- FTS5 search: <20ms (10K events)
- Unified search: <30ms (10K events)

---

## 🐛 故障排查

### 问题 1: window.unifiedSearchIndex 不存在
**原因**：初始化失败
**排查步骤**：
1. 检查控制台是否有错误日志
2. 检查 `src/services/search/UnifiedSearchIndex.ts` 是否有语法错误
3. 重启应用

### 问题 2: 输入 @ 后没有任何反应
**原因**：@ 检测逻辑未生效
**排查步骤**：
1. 打开控制台，查看是否有 `[@ Mention] 检测到@输入:` 日志
2. 检查 PlanSlate 编辑器是否有焦点
3. 确认输入的是英文符号 `@`，不是中文 `＠`

### 问题 3: 搜索结果为空
**原因**：索引未构建或数据库为空
**排查步骤**：
1. 运行 `console.log(window.unifiedSearchIndex.eventsIndex?.size())`
2. 如果返回 0，说明没有事件数据
3. 创建几个测试事件，然后刷新页面

### 问题 4: 时间提及功能失效
**原因**：@ 检测优先级问题
**排查步骤**：
1. 检查控制台是否有 `[@ Mention] 时间解析成功` 日志
2. 如果显示 `时间解析失败`，说明走的是搜索分支
3. 确认输入的时间表达式是否正确（如"明天"、"下周二"）

---

## 📝 已知限制

1. **EventMentionElement 未实现**
   - 当前点击事件结果时，只插入纯文本 `📄 事件标题`
   - TODO: 创建可点击的事件链接组件

2. **AI 助手未集成**
   - 当前只打印日志，不触发实际 AI 调用
   - TODO: 集成 AI SDK

3. **People 搜索未实现**
   - 当前只支持 Events, Tags, Time, AI
   - TODO: 添加联系人数据源

4. **Create New Page 未实现**
   - 当前只显示建议，不创建新事件
   - TODO: 添加快速创建逻辑

---

## 🎯 下一步优化

1. **性能优化**
   - 如果事件数 >10K，考虑分页加载
   - 添加虚拟滚动

2. **UI 改进**
   - 添加结果预览（hover 显示事件详情）
   - 支持快捷键（Cmd+K 全局搜索）

3. **智能排序**
   - 增加访问频率权重
   - 添加收藏/置顶功能

4. **多语言支持**
   - 当前主要针对中文
   - TODO: 添加英文搜索优化

---

## 📚 相关文档

- [完整使用指南](docs/UNIFIED_MENTION_USAGE_GUIDE.md)
- [数据库优化方案](docs/UNIFIED_MENTION_DATABASE_OPTIMIZATION.md)
- [集成检查报告](docs/DATABASE_INTEGRATION_CHECK.md)
- [分步实施指南](docs/UNIFIED_MENTION_INTEGRATION_STEPS.md)
