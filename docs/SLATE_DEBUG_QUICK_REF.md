# Slate 调试快速参考

## 🚀 启用调试

```javascript
// 浏览器控制台（F12）运行：
window.SLATE_DEBUG = true
localStorage.setItem('SLATE_DEBUG', 'true')
// 然后刷新页面（F5）
```

## 📊 日志类型

| 图标 | 类型 | 说明 |
|------|------|------|
| ⌨️ | 键盘事件 | 记录每个按键、组合键、光标位置 |
| 📝 | 内容变化 | 记录节点增删、文本修改 |
| ⚡ | 操作日志 | Enter、Tab、Delete 等特殊操作 |
| 🔄 | DOM 变化 | 元素增删、属性修改 |
| 🖱️ | 点击事件 | 鼠标点击、焦点变化 |
| 📸 | 编辑器快照 | 完整状态查看 |
| ❌ | 错误 | 异常信息 |

## 🛠️ 调试命令

```javascript
// 查看完整编辑器状态
window.slateEditorSnapshot()

// 关闭调试
window.SLATE_DEBUG = false
localStorage.removeItem('SLATE_DEBUG')
```

## 📋 典型日志示例

### 键盘事件
```
[⌨️ 12:34:56.789] Enter
  📋 按键信息: { key: "Enter", shiftKey: false, ... }
  📍 光标位置: { 节点路径: [2], Line ID: "abc...", 当前文本: "任务1" }
  🎯 选区详情: { 类型: "光标", Anchor: [2,0,0] offset:3 }
```

### 内容变化
```
[📝 12:34:56.790] 内容变化
  📊 变化统计: { 旧节点数: 3, 新节点数: 4, 变化: +1 }
  📄 新节点列表:
    0. [标题] xyz... "任务1" (L0)
    1. [标题] abc... "任务2" (L0)
```

### 操作日志
```
[⚡ 12:34:56.791] Enter - 创建新行
  📋 操作详情: { currentLine: 2, insertIndex: 3, level: 1 }
```

## 💡 反馈问题时

1. **启用调试** → 2. **重现问题一次** → 3. **复制日志** → 4. **描述步骤** → 5. **发给开发者**

---

**完整文档**: [SLATE_DEBUG_GUIDE.md](./SLATE_DEBUG_GUIDE.md)
