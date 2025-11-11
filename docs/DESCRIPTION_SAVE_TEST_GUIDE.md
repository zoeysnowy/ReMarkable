# Description 保存测试指南

## 测试目标

验证 Description 内容正确保存到 `timelog` (富文本) 和 `description` (纯文本) 字段。

## 测试步骤

### 1. 基础文本保存测试

1. 创建一个新 Event
2. 按 `Shift+Enter` 进入 Description 编辑器
3. 输入文本: `测试描述内容`
4. 等待 2 秒（自动保存）
5. 打开浏览器控制台，运行:
   ```javascript
   const events = JSON.parse(localStorage.getItem('events') || '[]');
   const testEvent = events.find(e => e.title?.includes('测试'));
   console.log('timelog:', testEvent.timelog);
   console.log('description:', testEvent.description);
   ```

**预期结果:**
- `timelog`: `测试描述内容` (纯文本，无标签)
- `description`: `测试描述内容` (纯文本，无标签)

---

### 2. Mention-Only 标签保存测试

1. 在 Description 编辑器中输入: `完成了项目`
2. 按 `#` 打开 Tag Picker
3. 点击一个标签（例如 `工作`）插入
4. 继续输入: `进展顺利`
5. 等待 2 秒（自动保存）
6. 打开浏览器控制台，运行:
   ```javascript
   const events = JSON.parse(localStorage.getItem('events') || '[]');
   const testEvent = events.find(e => e.title?.includes('测试'));
   console.log('timelog:', testEvent.timelog);
   console.log('description:', testEvent.description);
   ```

**预期结果:**
- `timelog`: `完成了项目<span data-type="tag" data-tag-id="..." data-tag-name="工作" data-mention-only="true">💼工作</span>进展顺利`
- `description`: `完成了项目#工作进展顺利`

---

### 3. 页面刷新持久化测试

1. 在 Description 编辑器中输入内容（可包含标签）
2. 等待 2 秒（自动保存）
3. 刷新页面 (`F5` 或 `Ctrl+R`)
4. 找到之前编辑的 Event
5. 验证 Description 内容完整显示

**预期结果:**
- Description 内容完整保留
- 标签正确显示（带 emoji 和颜色）

---

### 4. 正确 Event 保存测试 (修复验证)

**问题背景:** 之前存在 bug，Description 会被保存到错误的 Event

**测试步骤:**
1. 创建 Event A (title: `事件A`)
2. 创建 Event B (title: `事件B`)  
3. 编辑 Event A 的 Description: `这是事件A的描述`
4. 等待 2 秒（自动保存）
5. 刷新页面
6. 检查 Event A 的 Description: 应该显示 `这是事件A的描述`
7. 检查 Event B 的 Description: 应该为空

**预期结果:**
- Event A 的 Description 正确保存
- Event B 的 Description 不受影响

---

### 5. Outlook 同步测试

**注意:** 需要配置 Outlook Calendar 同步

1. 在 Description 编辑器中输入: `测试同步 #工作 #个人`
2. 等待自动保存
3. 等待同步到 Outlook (查看控制台日志)
4. 打开 Outlook Calendar，找到对应 Event
5. 检查 Event 的 Description 字段

**预期结果:**
- Outlook 中显示: `测试同步 #工作 #个人` (纯文本格式)
- 不包含 HTML 标签 (如 `<span>`)

---

## 调试命令

### 查看所有 Events 的 Description 字段

```javascript
const events = JSON.parse(localStorage.getItem('events') || '[]');
console.table(events.map(e => ({
  title: e.title,
  timelog: e.timelog?.substring(0, 50),
  description: e.description?.substring(0, 50)
})));
```

### 查找特定 Event

```javascript
const events = JSON.parse(localStorage.getItem('events') || '[]');
const event = events.find(e => e.id === 'YOUR_EVENT_ID');
console.log('完整 Event 对象:', event);
```

### 检查 Slate 编辑器节点

```javascript
window.slateEditorSnapshot();
```

---

## 常见问题排查

### Q: Description 内容消失了
**A:** 检查浏览器控制台，查看:
1. `[💾] 自动保存触发` 日志
2. `[EventService] 更新成功` 日志
3. 确认更新的 `eventId` 是否正确

### Q: Description 保存到了错误的 Event
**A:** 这个 bug 已修复！检查 `serialization.ts` L196-210，确认使用 `eventId` 而非 `lineId.replace('-desc', '')`

### Q: 标签没有正确显示
**A:** 检查:
1. `timelog` 是否包含 `<span data-type="tag">` 元素
2. `htmlToSlateFragment` 是否正确解析 HTML

### Q: Outlook 同步后显示 HTML 标签
**A:** 检查 `ActionBasedSyncManager.ts` 的 `processEventDescription` 函数，确认调用了 `convertMentionTagsToPlainText`

---

## 数据字段对比

| 字段 | 格式 | 用途 | 同步到 Outlook |
|------|------|------|----------------|
| `timelog` | HTML | ReMarkable 内部富文本展示 | ❌ 否 |
| `description` | 纯文本 | Outlook Calendar 同步 | ✅ 是 |
| `content` | HTML | Event Title 富文本 | ❌ 否 |
| `title` | 纯文本 | Event Title 显示 | ✅ 是 (作为 Event 标题) |

---

## 版本信息

- **实现版本:** v1.8
- **实现日期:** 2025-11-12
- **相关 PR/Issue:** Description 持久化修复 + Timelog 字段引入
