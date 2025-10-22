# WidgetPage_v3 拖动修复 - 第二轮优化

## 🔧 本轮修复内容

### 发现的新问题

1. **CSS 冲突**：`DesktopCalendarWidget.css` 中的 `.drag-bar` 设置了 `app-region: drag !important`，与自定义拖动逻辑冲突
2. **未使用的代码**：`controlBarStyle` 定义了但从未使用，且包含 `WebkitAppRegion: 'drag'`
3. **遮罩层问题**：拖动遮罩层的 `pointerEvents: 'all'` 可能阻止事件正常传播
4. **拖动条可见性**：拖动条颜色太淡，不够明显

### 修复方案

#### 1. 修复 CSS 冲突

**文件：** `src/components/DesktopCalendarWidget.css`

```css
/* 修改前 */
.drag-bar {
  -webkit-app-region: drag !important;
  app-region: drag !important;
}

/* 修改后 */
.drag-bar {
  /* 不使用原生拖动，使用自定义 JavaScript 拖动逻辑 */
  -webkit-app-region: no-drag !important;
  app-region: no-drag !important;
}
```

#### 2. 删除未使用的代码

**文件：** `src/pages/WidgetPage_v3.tsx`

删除了 `controlBarStyle` 的整个定义（18行代码），它设置了冲突的 `WebkitAppRegion: 'drag'` 但从未被使用。

#### 3. 移除拖动遮罩层

**原因：** window 级别的 `mousemove` 和 `mouseup` 监听器已经足够了，不需要额外的遮罩层。遮罩层反而可能干扰事件传播。

**改动：** 完全移除 `isDragging` 时的遮罩层 div。

#### 4. 增强拖动条可见性和事件处理

**文件：** `src/pages/WidgetPage_v3.tsx`

```tsx
// 加深颜色
backgroundColor: showControls 
  ? 'rgba(100, 150, 255, 0.5)'   // 从 0.3 改为 0.5
  : 'rgba(100, 150, 255, 0.25)', // 从 0.15 改为 0.25

// 确保能接收鼠标事件
pointerEvents: 'auto'

// 添加更详细的日志
onMouseDown={(e) => {
  console.log('🎯 拖动条 onMouseDown 触发');
  handleDragStart(e);
}}
```

---

## 🎯 现在的拖动逻辑

### 完整流程

1. **用户点击拖动条**
   - 触发 `onMouseDown` → `handleDragStart`
   - 记录初始位置（screenX, screenY）
   - 设置 `isDragging = true`

2. **用户移动鼠标**
   - window 级别的 `mousemove` 监听器捕获事件
   - `handleDragMove` 计算偏移量
   - 调用 `electronAPI.widgetMove({ x: deltaX, y: deltaY })`
   - 主进程使用 `setPosition(newX, newY, false)` 移动窗口

3. **用户释放鼠标**
   - window 级别的 `mouseup` 监听器捕获事件
   - `handleDragEnd` 清理状态
   - 设置 `isDragging = false`

### 关键点

- ✅ **无 CSS 冲突**：所有 `app-region` 都设置为 `no-drag`
- ✅ **无事件阻止**：没有遮罩层干扰事件传播
- ✅ **窗口级监听**：在 window 上监听 `mousemove` 和 `mouseup`，确保不会丢失事件
- ✅ **节流优化**：60fps 节流，减少 IPC 调用
- ✅ **事件阻止**：在 `handleDragMove` 中调用 `preventDefault()` 和 `stopPropagation()`

---

## 🧪 测试步骤

### 1. 清除缓存并重启

```bash
# 停止当前运行的服务（Ctrl+C）
# 重新启动
npm start

# 在另一个终端
cd electron
npm run dev
```

### 2. 打开 Widget 并检查

打开开发者工具（F12），查看控制台：

```
🔒 Widget locked status: false  <-- 必须是 false
✅ Lock state synced to main process: false
```

### 3. 视觉检查

- 窗口顶部应该有**明显的蓝色拖动条**（10px 高）
- 鼠标悬停时，拖动条应该变得更亮更明显
- 光标应该变成手掌图标（grab）

### 4. 测试拖动

1. 将鼠标移到拖动条上
2. 应该看到日志：`🖱️ 鼠标进入拖动条`
3. 点击拖动条
4. 应该看到日志：
   ```
   🎯 拖动条 onMouseDown 触发
   🎯 handleDragStart 被调用: {isLocked: false, ...}
   ✅ 拖动开始
   ```
5. 拖动鼠标
6. 窗口应该**平滑跟随鼠标移动**，无抖动
7. 释放鼠标
8. 应该看到日志：`🎯 拖动结束`

### 5. 使用详细诊断脚本

如果仍然无法拖动，在控制台复制粘贴 `test-drag-detailed.js` 的内容并运行。

脚本会：
- ✅ 检查 DOM 结构
- ✅ 检查元素层级（是否被遮挡）
- ✅ 测试点击事件
- ✅ 检查 localStorage 锁定状态
- ✅ 提供手动测试和修复函数

---

## 🐛 如果还是不能拖动

### 诊断步骤

**在控制台运行：**

```javascript
// 1. 检查拖动条是否存在
const dragBar = document.querySelector('.drag-bar');
console.log('拖动条:', dragBar ? '存在' : '不存在');

// 2. 检查拖动条位置
if (dragBar) {
  const rect = dragBar.getBoundingClientRect();
  console.log('拖动条位置:', rect);
  
  // 3. 检查中心点的元素
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const element = document.elementFromPoint(centerX, centerY);
  console.log('中心点元素:', element);
  console.log('是拖动条吗?', element === dragBar);
}

// 4. 检查 WebkitAppRegion
console.log('WebkitAppRegion:', dragBar?.style.WebkitAppRegion);

// 5. 检查 pointerEvents
console.log('pointerEvents:', window.getComputedStyle(dragBar).pointerEvents);
```

### 常见原因

1. **被锁定了**：
   ```javascript
   const s = JSON.parse(localStorage.getItem('desktop-calendar-widget-settings')||'{}');
   s.isLocked = false;
   localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(s));
   location.reload();
   ```

2. **拖动条被遮挡**：
   ```javascript
   // 检查是否被其他元素遮挡
   const dragBar = document.querySelector('.drag-bar');
   const rect = dragBar.getBoundingClientRect();
   const element = document.elementFromPoint(rect.left + 5, rect.top + 5);
   if (element !== dragBar) {
     console.error('拖动条被遮挡！遮挡元素:', element);
   }
   ```

3. **事件未绑定**：
   ```javascript
   const dragBar = document.querySelector('.drag-bar');
   console.log('onmousedown:', dragBar.onmousedown !== null ? '已绑定' : '未绑定');
   ```

---

## 📊 修改文件总结

| 文件 | 修改内容 | 行数 |
|------|---------|------|
| `src/pages/WidgetPage_v3.tsx` | 删除遮罩层、删除 controlBarStyle、增强拖动条 | -25, +15 |
| `src/components/DesktopCalendarWidget.css` | 修复 app-region 冲突 | ~2 |
| `test-drag-detailed.js` | 新增详细诊断脚本 | +200 |

---

## ✨ 预期效果

### 修复前
- ❌ 拖动条太淡，不明显
- ❌ CSS 冲突导致拖动行为不一致
- ❌ 遮罩层可能干扰事件传播
- ❌ 未使用的代码造成混淆

### 修复后
- ✅ 拖动条更明显（加深颜色）
- ✅ 无 CSS 冲突，所有 app-region 统一为 no-drag
- ✅ 无遮罩层干扰，事件流畅传播
- ✅ 代码更清晰，易于维护

---

## 🎓 技术总结

### 为什么移除遮罩层？

遮罩层的目的是防止拖动时鼠标事件触发日历组件，但它带来了几个问题：

1. **事件拦截**：`pointerEvents: 'all'` 会拦截所有事件，包括我们需要的 mousemove
2. **复杂性**：需要在遮罩层上添加事件处理，增加了代码复杂度
3. **不必要**：window 级别的监听器已经足够，它会捕获所有 mousemove 和 mouseup

### 为什么要统一 app-region？

混合使用原生拖动（`app-region: drag`）和自定义拖动会导致：

1. **行为冲突**：系统不知道该用哪种方式处理拖动
2. **平台差异**：不同操作系统对 app-region 的处理可能不同
3. **调试困难**：无法确定是哪个机制在起作用

统一使用 `app-region: no-drag` + 自定义 JavaScript 逻辑，提供了：

1. **完全控制**：精确控制拖动行为
2. **一致性**：所有平台行为一致
3. **可调试**：有日志，容易定位问题

---

## 🚀 下一步

如果这次修复后仍然无法拖动，请：

1. 运行 `test-drag-detailed.js` 诊断脚本
2. 提供完整的控制台输出
3. 截图显示拖动条的外观
4. 告诉我点击拖动条时是否有任何日志输出

我会根据这些信息进一步诊断！

