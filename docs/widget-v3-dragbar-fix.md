# WidgetPage_v3 拖动条修复说明

## 问题描述

WidgetPage_v3 组件中的 dragbar（顶部拖动条）存在两个严重问题：

1. **无法拖动**：拖动条不响应鼠标拖动操作
2. **疯狂抖动**：即使能拖动，窗口会疯狂抖动且窗口大小不断变化

## 问题根源

### 问题 1：拖动机制冲突

代码中存在两套拖动机制的冲突：

1. **Electron 原生拖动**：拖动条设置了 `WebkitAppRegion: 'drag'`
2. **自定义拖动逻辑**：实现了完整的拖动处理函数（handleDragStart, handleDragMove, handleDragEnd）

**冲突原因：**
- 拖动条使用了 `WebkitAppRegion: 'drag'`，但**没有绑定 `onMouseDown` 事件**到自定义的 `handleDragStart` 函数
- 这导致：
  - Electron 原生拖动可能在某些情况下不生效
  - 自定义拖动逻辑完全不会被触发（缺少事件绑定）
  - 两套机制互相干扰

### 问题 2：拖动时触发窗口大小变化和组件重渲染

**抖动原因：**
1. 主进程使用 `setBounds()` 同时设置位置和大小，触发了 resize 事件
2. 拖动时鼠标事件穿透到 TimeCalendar 组件，导致疯狂重渲染
3. 组件重渲染可能触发布局变化，进一步导致窗口抖动
4. 没有遮罩层阻止鼠标事件传播

## 修复方案

### 1. 统一使用自定义拖动逻辑

移除 Electron 原生拖动，完全使用自定义 JavaScript 拖动逻辑：

```tsx
// 修改前：
WebkitAppRegion: 'drag', // 使用 Electron 原生拖动！
// 没有 onMouseDown 事件绑定

// 修改后：
WebkitAppRegion: 'no-drag', // 禁用原生拖动，使用自定义逻辑
onMouseDown={handleDragStart} // 绑定拖动开始事件
```

### 2. 添加拖动遮罩层

在拖动时显示全屏遮罩层，防止鼠标事件穿透到下层组件：

```tsx
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

### 3. 优化主进程移动逻辑

使用 `setPosition()` 替代 `setBounds()`，避免触发 resize 事件：

```javascript
// electron/main.js
// 修改前：
widgetWindow.setBounds({
  x: newX,
  y: newY,
  width: bounds.width,
  height: bounds.height
});

// 修改后：
widgetWindow.setPosition(newX, newY, false); // false = 不使用动画
```

### 4. 优化光标样式

根据拖动状态动态改变光标：

```tsx
cursor: isDragging ? 'grabbing' : 'grab'
```

### 5. 添加拖动节流

为提高性能，添加 60fps 节流：

```tsx
// 节流：每 16ms (约60fps) 最多执行一次
const now = Date.now();
if (now - dragThrottleRef.current < 16) return;
dragThrottleRef.current = now;
```

### 6. 添加事件阻止

在拖动移动时阻止默认行为和事件传播：

```tsx
e.preventDefault();
e.stopPropagation();
```

## 修改文件

### `src/pages/WidgetPage_v3.tsx`

1. **第36行**：添加 `dragThrottleRef` 用于节流
2. **第239-265行**：优化 `handleDragMove` 函数：
   - 添加节流逻辑（60fps）
   - 添加 `preventDefault()` 和 `stopPropagation()`
   - 移除冗余的日志输出
3. **第348-361行**：添加拖动遮罩层，防止事件穿透
4. **第373行**：修改光标样式为动态 `isDragging ? 'grabbing' : 'grab'`
5. **第381行**：将 `WebkitAppRegion: 'drag'` 改为 `'no-drag'`
6. **第384行**：添加 `onMouseDown={handleDragStart}` 事件绑定

### `electron/main.js`

1. **第507-527行**：优化 `widget-move` IPC 处理器：
   - 使用 `setPosition(newX, newY, false)` 替代 `setBounds()`
   - 移除冗余的日志和验证逻辑
   - 简化返回值
2. **第559-560行**：在窗口创建时添加配置：
   - `skipTaskbar: false` - 允许在任务栏显示
   - `hasShadow: true` - 添加阴影，便于识别窗口边界

## 工作原理

### 拖动流程

1. **拖动开始（handleDragStart）**
   - 用户在拖动条上按下鼠标
   - 记录初始鼠标位置（screenX, screenY）
   - 设置 `isDragging = true`

2. **拖动中（handleDragMove）**
   - 监听全局 `mousemove` 事件
   - 每 16ms 计算鼠标位移（deltaX, deltaY）
   - 调用 `electronAPI.widgetMove({ x: deltaX, y: deltaY })` 移动窗口
   - 更新起点为当前位置

3. **拖动结束（handleDragEnd）**
   - 监听全局 `mouseup` 事件
   - 清理状态，设置 `isDragging = false`
   - 移除事件监听器

### Electron 主进程处理

在 `electron/main.js` 中，`widget-move` IPC 处理器：

```javascript
ipcMain.handle('widget-move', (event, position) => {
  const bounds = widgetWindow.getBounds();
  const newX = bounds.x + position.x;
  const newY = bounds.y + position.y;
  
  widgetWindow.setBounds({
    x: newX,
    y: newY,
    width: bounds.width,
    height: bounds.height
  });
});
```

## 测试方法

### 启动测试

1. 启动开发服务器：`npm start`
2. 启动 Electron：`cd electron && npm run dev`
3. 点击主窗口中的"开启桌面日历小组件"按钮

### 拖动测试

1. 将鼠标移到 Widget 窗口顶部的蓝色拖动条（高度 10px）
2. 观察拖动条在鼠标悬停时变亮
3. 按住鼠标左键并拖动
4. 预期行为：
   - ✅ 光标应从 `grab`（手掌）变为 `grabbing`（抓取）
   - ✅ 窗口应平滑跟随鼠标移动，**无抖动**
   - ✅ 窗口大小保持不变，**不会变化**
   - ✅ 控制台输出拖动日志：`🎯 拖动开始`, `🎯 拖动结束`
   - ✅ TimeCalendar 组件**不会频繁重渲染**（检查控制台）

### 锁定测试

1. 点击 Widget 右下角的设置按钮
2. 切换"锁定位置"开关
3. 拖动条应消失，窗口无法拖动
4. 再次切换开关，拖动条重新出现，可以拖动

### 边界情况测试

1. **多显示器**：在多显示器环境下拖动窗口到不同屏幕
2. **快速拖动**：快速移动鼠标，窗口应能跟上
3. **边缘拖动**：拖动到屏幕边缘，窗口不应消失或卡住

## 优点

### 自定义拖动 vs 原生拖动

| 特性 | 自定义拖动 | Electron 原生拖动 |
|------|-----------|------------------|
| 跨平台兼容性 | ✅ 优秀 | ⚠️ 依赖系统 |
| 精细控制 | ✅ 完全可控 | ❌ 受限 |
| 调试能力 | ✅ 有日志 | ❌ 黑盒 |
| 节流控制 | ✅ 可自定义 | ❌ 不可控 |
| 性能 | ✅ 60fps 节流 | ✅ 系统优化 |

## 注意事项

1. **锁定状态**：当 `isLocked = true` 时，拖动条不会渲染，窗口完全不可拖动
2. **z-index**：拖动条的 `zIndex: 10000` 确保它在调整大小手柄之上
3. **事件冒泡**：使用 `e.stopPropagation()` 防止拖动事件干扰其他交互
4. **屏幕坐标**：使用 `e.screenX` 和 `e.screenY` 而非 `clientX/clientY`，确保多显示器环境下正常工作

## 相关文件

- `src/pages/WidgetPage_v3.tsx` - Widget 页面主组件
- `electron/main.js` - Electron 主进程，处理 IPC 通信
- `electron/preload.js` - 暴露 electronAPI 给渲染进程
- `src/components/DesktopCalendarWidget.css` - 拖动条样式

## 修复版本

- 修复日期：2025-10-22
- 修复人：AI Assistant
- 相关 Issue：拖动条无法拖动

