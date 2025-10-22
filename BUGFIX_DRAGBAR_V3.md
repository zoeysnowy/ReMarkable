# WidgetPage_v3 拖动条修复总结

## 🐛 问题

1. **拖动条无法拖动** - 拖动条不响应鼠标操作
2. **窗口疯狂抖动** - 拖动时窗口大小不断变化，组件疯狂重渲染

## ✅ 解决方案

### 修复 1：绑定拖动事件

**问题**：拖动条设置了 `WebkitAppRegion: 'drag'` 但没有绑定 `onMouseDown` 事件

**修复**：
```tsx
// src/pages/WidgetPage_v3.tsx
<div className="drag-bar"
  style={{
    WebkitAppRegion: 'no-drag', // 禁用原生拖动
    cursor: isDragging ? 'grabbing' : 'grab'
  }}
  onMouseDown={handleDragStart} // 绑定自定义拖动
>
```

### 修复 2：添加拖动遮罩层

**问题**：拖动时鼠标事件穿透到 TimeCalendar 组件，触发重渲染

**修复**：
```tsx
{/* 拖动时的全屏遮罩层 - 防止事件穿透 */}
{isDragging && (
  <div style={{
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    zIndex: 9998,
    cursor: 'grabbing',
    pointerEvents: 'all', // 拦截所有鼠标事件
    userSelect: 'none'
  }} />
)}
```

### 修复 3：优化主进程移动逻辑

**问题**：使用 `setBounds()` 同时设置位置和大小，触发 resize 事件

**修复**：
```javascript
// electron/main.js
ipcMain.handle('widget-move', (event, position) => {
  const bounds = widgetWindow.getBounds();
  const newX = bounds.x + position.x;
  const newY = bounds.y + position.y;
  
  // 使用 setPosition 而不是 setBounds，避免触发 resize
  widgetWindow.setPosition(newX, newY, false);
  
  return { success: true };
});
```

### 修复 4：添加事件阻止和节流

**问题**：拖动事件可能触发其他交互，性能未优化

**修复**：
```tsx
const handleDragMove = useCallback((e: MouseEvent) => {
  if (!isDragging || !dragStartRef.current) return;
  
  // 节流：60fps
  const now = Date.now();
  if (now - dragThrottleRef.current < 16) return;
  dragThrottleRef.current = now;
  
  // 阻止默认行为和传播
  e.preventDefault();
  e.stopPropagation();
  
  // ... 移动逻辑
}, [isDragging]);
```

## 📝 修改的文件

1. **src/pages/WidgetPage_v3.tsx**
   - 添加拖动遮罩层（第348-361行）
   - 修改拖动条样式和事件绑定（第373-384行）
   - 优化拖动移动逻辑（第239-265行）
   - 添加 dragThrottleRef（第36行）

2. **electron/main.js**
   - 优化 widget-move IPC 处理器（第507-527行）
   - 添加窗口配置选项（第559-560行）

3. **docs/widget-v3-dragbar-fix.md**
   - 详细的问题分析和修复说明

## 🧪 测试步骤

1. 启动应用：
   ```bash
   npm start
   cd electron && npm run dev
   ```

2. 点击"开启桌面日历小组件"

3. 测试拖动：
   - 鼠标移到顶部蓝色拖动条（10px高）
   - 按住左键拖动
   - 观察：光标变化、窗口平滑移动、无抖动、无大小变化

4. 测试锁定：
   - 点击设置 → 锁定位置
   - 拖动条消失，无法拖动
   - 解锁后恢复正常

## ✨ 效果对比

### 修复前
- ❌ 拖动条无响应
- ❌ 窗口疯狂抖动
- ❌ 窗口大小不断变化
- ❌ TimeCalendar 疯狂重渲染（#11, #12, #13...）
- ❌ 控制台输出大量重渲染日志

### 修复后
- ✅ 拖动条响应灵敏
- ✅ 窗口平滑移动，无抖动
- ✅ 窗口大小保持稳定
- ✅ TimeCalendar 不会重渲染
- ✅ 控制台只输出拖动开始/结束日志

## 🔧 技术要点

1. **自定义拖动 vs Electron 原生拖动**
   - 自定义拖动提供更好的跨平台兼容性
   - 可以精确控制行为和性能
   - 便于调试和日志记录

2. **事件遮罩层的重要性**
   - 防止拖动时触发下层组件的事件
   - 避免组件重渲染导致的性能问题
   - 提供一致的用户体验

3. **setPosition vs setBounds**
   - `setPosition()` 只改变位置，不触发 resize
   - `setBounds()` 会同时设置位置和大小，可能触发多个事件
   - 对于纯移动操作，应使用 `setPosition()`

4. **节流的必要性**
   - 限制 IPC 调用频率（60fps）
   - 减少主进程负载
   - 提高拖动流畅度

## 📅 修复信息

- **修复日期**：2025-10-22
- **影响版本**：WidgetPage_v3
- **相关组件**：DesktopCalendarWidget, TimeCalendar
- **修复类型**：Bug Fix

