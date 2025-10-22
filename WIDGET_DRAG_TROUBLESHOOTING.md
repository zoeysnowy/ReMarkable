# Widget 拖动故障排除指南

## 🎯 问题：Widget 窗口无法拖动

如果你的 Widget 窗口仍然无法拖动，请按照以下步骤进行排查：

---

## 📋 排查步骤

### 步骤 1：检查锁定状态

这是最常见的问题！Widget 可能之前被锁定了。

#### 方法 A：使用修复工具（推荐）

1. 在 Widget 窗口中打开：`file:///C:/Users/Zoey Gong/Github/ReMarkable/fix-widget-lock.html`
2. 点击"检查状态"按钮
3. 如果显示 `isLocked: true`，点击"解除锁定"
4. 刷新页面

#### 方法 B：手动检查（在浏览器控制台）

```javascript
// 1. 打开开发者工具（F12）
// 2. 在控制台运行：
localStorage.getItem('desktop-calendar-widget-settings')

// 3. 如果显示包含 "isLocked":true，运行：
const settings = JSON.parse(localStorage.getItem('desktop-calendar-widget-settings'));
settings.isLocked = false;
localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
location.reload(); // 刷新页面
```

#### 方法 C：完全清除设置

```javascript
localStorage.removeItem('desktop-calendar-widget-settings');
location.reload();
```

---

### 步骤 2：检查拖动条是否显示

打开控制台（F12），运行：

```javascript
// 检查拖动条元素
document.querySelector('.drag-bar');
// 应该返回一个 HTMLDivElement，如果返回 null，说明拖动条未渲染

// 检查当前 isLocked 状态（通过 React DevTools 或日志）
// 查找控制台中的 "🔒 Widget locked status:" 日志
```

**预期结果：**
- 拖动条应该存在（不为 null）
- 控制台应显示 `🔓 Widget is unlocked` 或 `🔒 Widget locked status: false`

---

### 步骤 3：测试拖动事件

在控制台运行：

```javascript
// 测试拖动条点击事件
const dragBar = document.querySelector('.drag-bar');
if (dragBar) {
  dragBar.addEventListener('mousedown', (e) => {
    console.log('✅ 拖动条点击事件正常！', e);
  }, { once: true });
  console.log('👆 请点击窗口顶部的拖动条...');
} else {
  console.error('❌ 拖动条不存在！Widget 可能已锁定。');
}
```

**预期结果：**
- 点击拖动条后应该看到 `✅ 拖动条点击事件正常！`
- 同时应该看到 `🎯 handleDragStart 被调用:`

---

### 步骤 4：检查 Electron API

在控制台运行：

```javascript
// 检查 widgetMove API
console.log('electronAPI:', window.electronAPI);
console.log('widgetMove:', typeof window.electronAPI?.widgetMove);
console.log('widgetLock:', typeof window.electronAPI?.widgetLock);

// 应该都返回 'function'
```

**预期结果：**
- `window.electronAPI` 应该存在
- `widgetMove` 和 `widgetLock` 都应该是 `function`

---

### 步骤 5：查看控制台日志

拖动窗口时，应该看到以下日志：

```
🖱️ 鼠标进入拖动条
🎯 handleDragStart 被调用: {isLocked: false, screenX: xxx, screenY: xxx}
✅ 拖动开始
🎯 拖动中: {deltaX: xxx, deltaY: xxx, ...}
🎯 拖动结束
🖱️ 鼠标离开拖动条
```

**如果看不到这些日志：**
- 没有 `🖱️ 鼠标进入拖动条` → 拖动条不存在或被遮挡
- 看到 `⚠️ Widget 已锁定，拒绝拖动` → Widget 被锁定了
- 没有 `🎯 handleDragStart 被调用` → 事件未绑定

---

## 🔧 常见问题和解决方案

### 问题 1：拖动条不可见

**症状：** 窗口顶部没有蓝色拖动条

**原因：** `isLocked === true`

**解决：** 
```javascript
// 解除锁定
const settings = JSON.parse(localStorage.getItem('desktop-calendar-widget-settings') || '{}');
settings.isLocked = false;
localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
location.reload();
```

---

### 问题 2：拖动条可见但点击无反应

**症状：** 能看到蓝色拖动条，但点击没有任何反应

**可能原因：**
1. 事件监听器未绑定
2. 有其他元素覆盖在拖动条上方
3. `isLocked` 状态不一致

**解决：**
```javascript
// 检查 z-index
const dragBar = document.querySelector('.drag-bar');
console.log('z-index:', window.getComputedStyle(dragBar).zIndex); // 应该是 10000

// 检查 pointer-events
console.log('pointer-events:', window.getComputedStyle(dragBar).pointerEvents); // 应该是 'auto' 或默认

// 强制测试
dragBar.click(); // 应该触发日志
```

---

### 问题 3：能点击但窗口不移动

**症状：** 看到 `🎯 拖动开始` 日志，但窗口位置不变

**可能原因：**
1. Electron 主进程的 `widgetMove` API 不工作
2. 窗口的 `movable` 属性被设置为 false

**解决：**

检查 Electron 主进程日志（在启动 Electron 的终端中）：
```
🎯 [Main] Moving widget: ...
✅ [Main] Widget moved to: ...
```

如果没有这些日志，说明 IPC 调用失败。

在控制台测试：
```javascript
// 手动测试 widgetMove
window.electronAPI.widgetMove({ x: 10, y: 10 }).then(result => {
  console.log('移动结果:', result);
});
```

---

### 问题 4：拖动时窗口抖动

**症状：** 窗口跟随鼠标移动，但不断抖动

**原因：** 已修复！确保使用了最新代码。

**验证修复：**
1. 检查 `electron/main.js` 第517行使用的是 `setPosition()` 而不是 `setBounds()`
2. 检查拖动时有遮罩层阻止事件穿透

---

## 🐛 调试工具

### 1. 使用诊断脚本

在控制台复制粘贴 `diagnose-widget-drag.js` 的内容，然后运行：

```javascript
// 运行修复函数
fixLock();     // 解除锁定
testDrag();    // 测试拖动
clearSettings(); // 清除所有设置
```

### 2. 使用修复页面

打开 `fix-widget-lock.html` 在浏览器中

### 3. React DevTools

安装 React DevTools，查看 `WidgetPage_v3` 组件的状态：
- `isLocked` 应该是 `false`
- `isDragging` 在拖动时应该变为 `true`

---

## ✅ 成功标志

修复成功后，你应该能够：

1. ✅ 看到窗口顶部有蓝色半透明拖动条（10px 高）
2. ✅ 鼠标悬停时，拖动条变亮
3. ✅ 光标在拖动条上显示为 `grab`（手掌）
4. ✅ 按住鼠标左键时，光标变为 `grabbing`（抓取）
5. ✅ 窗口平滑跟随鼠标移动，无抖动
6. ✅ 窗口大小保持不变
7. ✅ 控制台显示正确的拖动日志

---

## 📞 仍然无法解决？

如果以上步骤都尝试过仍然无法拖动，请提供以下信息：

1. **控制台日志**：完整的控制台输出
2. **localStorage 内容**：
   ```javascript
   localStorage.getItem('desktop-calendar-widget-settings')
   ```
3. **拖动条检查**：
   ```javascript
   document.querySelector('.drag-bar') ? '存在' : '不存在'
   ```
4. **isLocked 状态**：查看控制台中的 `🔒 Widget locked status:` 日志
5. **Electron 版本**：在主窗口运行 `window.electronAPI.getVersion()`

---

## 🎯 快速修复命令（一键式）

直接在控制台运行：

```javascript
// 一键修复脚本
(function() {
  console.log('🔧 开始一键修复...');
  
  // 1. 清除锁定
  const settings = JSON.parse(localStorage.getItem('desktop-calendar-widget-settings') || '{}');
  settings.isLocked = false;
  localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(settings));
  console.log('✅ 已解除锁定');
  
  // 2. 同步到主进程
  if (window.electronAPI?.widgetLock) {
    window.electronAPI.widgetLock(false).then(() => {
      console.log('✅ 主进程已解锁');
    });
  }
  
  // 3. 刷新提示
  console.log('📝 请刷新页面（按 F5）');
  console.log('✨ 修复完成！');
  
  // 可选：自动刷新
  if (confirm('修复完成！是否立即刷新页面？')) {
    location.reload();
  }
})();
```

复制上面的代码，粘贴到控制台，按回车即可！

