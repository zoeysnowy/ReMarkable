# 🔍 启用调试日志

## 快速启用

1. **打开浏览器开发者工具**
   - Windows: `F12` 或 `Ctrl + Shift + I`
   - Mac: `Cmd + Option + I`

2. **切换到 Console 标签**

3. **在控制台输入以下命令并回车**：
   ```javascript
   window.SLATE_DEBUG = true
   ```

4. **刷新页面** (`F5` 或 `Ctrl+R`)

5. **你应该立即看到**：
   ```
   🚀 UnifiedSlateEditor mounted with DEBUG LOGGING ENABLED  (绿色背景)
   📊 Initial items count: X  (蓝色文字)
   🚀 PlanManager mounted with DEBUG LOGGING ENABLED  (橙色背景)
   📊 Initial items count: X  (红色文字)
   ```

## 调试日志说明

现在你可以在编辑器中输入内容，会看到完整的数据流：

### 输入阶段
```
⌨️ KeyDown: "a"  ← 你按下键盘
  - isComposing: false
  - shiftKey: false
  - selection: { anchor: {...}, focus: {...} }
```

### 编辑器变化
```
🔄 handleChange triggered  ← Slate 检测到内容变化
  - nodeCount: 1
  - nodes: [{ lineId: "...", mode: "title", text: "a" }]
```

### 数据传递
```
📤 Calling onChange with planItems  ← 通知外部组件
  - itemCount: 1
  - items: [{ id: "...", title: "a", hasCheckbox: true }]
```

### 防抖处理
```
📥 debouncedOnChange called  ← PlanManager 接收到数据
  - itemCount: 1
  - items: [{ id: "...", title: "a", hasContent: true }]

⏱️ Debounce timer fired  ← 300ms 后触发批处理
```

### 批处理执行
```
⚙️ executeBatchUpdate started  ← 开始批量处理
  - updatedItemsCount: 1
  - currentItemsCount: 0

💾 Item changed, preparing to save  ← 检测到变更
  - itemId: "..."
  - isNew: true
  - title: "a"

💾 Executing batch save  ← 执行保存
  - count: 1
  - items: [{ id: "...", title: "a", isCompleted: false }]
```

### 渲染阶段
```
🎨 renderLinePrefix called  ← 渲染勾选框
  - lineId: "..."
  - baseLineId: "..."
  - foundItem: true
  - mode: "title"

✅ renderLinePrefix result  ← 渲染完成
  - lineId: "..."
  - hasResult: true
  - isCompleted: false
```

### 完成
```
✅ Batch update completed
  - deleted: 0
  - saved: 1
  - synced: 0
```

## 关闭调试

在控制台输入：
```javascript
window.SLATE_DEBUG = false
```

## 常见问题

**Q: 看不到日志？**
A: 
1. 确认已经运行 `window.SLATE_DEBUG = true`
2. 刷新页面
3. 检查浏览器控制台的 Filter 设置（应该是空的或包含 "All"）
4. 确认没有勾选 "Hide network" 等过滤器

**Q: 日志太多了？**
A: 这是正常的，说明调试日志在工作。你可以：
1. 使用浏览器控制台的搜索功能 (`Ctrl+F`) 搜索特定的 emoji（如 `⌨️` 或 `💾`）
2. 只关注带时间戳的日志行
3. 使用 `window.SLATE_DEBUG = false` 关闭

**Q: 我想只看某个阶段的日志？**
A: 在控制台的 Filter 框输入：
- 键盘输入: `⌨️`
- 内容变化: `🔄`
- 数据传递: `📤`
- 防抖: `📥`
- 批处理: `⚙️`
- 保存: `💾`
- 渲染: `🎨`
