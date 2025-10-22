# 拖动优化方案

## 当前问题

### 1. 鼠标位置漂移 (Mouse Drift)
**现象**：拖动时鼠标相对窗口位置会缓慢漂移  
**原因**：Electron `setBounds()` 在透明窗口上定位不精确
- 请求移动 `{x: 1, y: 0}` → 实际移动 `{x: 0, y: 0}` (未移动)
- 请求移动 `{x: -1, y: -1}` → 实际移动 `{x: -2, y: -2}` (移过头)
- deltaMatch 成功率: 2/71 = 2.8%

**解决方案**：
- ✅ 已实现：main.js 返回 actualDelta
- ⚠️ 需实现：renderer 使用 actualDelta 调整 dragStartRef

### 2. 窗口大小调整延迟 (Resize Lag)
**现象**：调整窗口大小时有明显延迟  
**原因**：
1. resize 事件监听器会覆盖 targetSize
2. 每次 resize 触发都会重新锁定尺寸
3. 没有节流/防抖机制

**解决方案**：
- 为 resize 事件添加节流 (100ms)
- 改进 targetSize 更新逻辑
- 只在 resize 完成后更新 targetSize

## 优化步骤

### Step 1: 修复鼠标漂移
在 renderer (WidgetPage_v3.tsx) 中使用 actualDelta：

```typescript
window.electronAPI.widgetMove({ x: deltaX, y: deltaY }).then((result) => {
  if (result.actualDelta) {
    // 根据实际移动调整参考点
    dragStartRef.current = {
      x: dragStartRef.current.x + result.actualDelta.x,
      y: dragStartRef.current.y + result.actualDelta.y
    };
  }
});
```

### Step 2: 优化 Resize 性能
在 main.js 中：

```javascript
let resizeTimeout = null;
let isResizing = false;

widgetWindow.on('resize', () => {
  isResizing = true;
  
  // 清除之前的超时
  if (resizeTimeout) clearTimeout(resizeTimeout);
  
  // 100ms 后认为 resize 结束
  resizeTimeout = setTimeout(() => {
    isResizing = false;
    const bounds = widgetWindow.getBounds();
    targetSize = { width: bounds.width, height: bounds.height };
    console.log('✅ [Main] Resize 完成，更新 targetSize:', targetSize);
  }, 100);
});
```

### Step 3: 改进拖动时尺寸锁定
在 widgetMove handler 中：

```javascript
// 只在非 resize 状态下锁定尺寸
if (!isResizing && targetSize) {
  const bounds = widgetWindow.getBounds();
  widgetWindow.setBounds({
    x: newX,
    y: newY,
    width: targetSize.width,  // 锁定
    height: targetSize.height // 锁定
  });
}
```

## 预期效果

### 鼠标漂移修复后：
- ✅ 鼠标始终保持在窗口的固定位置
- ✅ 拖动流畅无跳动
- ✅ deltaMatch 失败时自动补偿

### Resize 优化后：
- ✅ 调整大小响应更快
- ✅ 不会与拖动冲突
- ✅ CPU 占用降低

## 测试计划

1. **拖动测试**：
   - 慢速拖动（验证无漂移）
   - 快速拖动（验证无累积误差）
   - 长距离拖动（验证持续稳定）

2. **Resize 测试**：
   - 拖动边缘调整大小
   - 快速连续调整
   - 边调整边拖动

3. **性能测试**：
   - CPU 使用率
   - 内存占用
   - FPS 稳定性
