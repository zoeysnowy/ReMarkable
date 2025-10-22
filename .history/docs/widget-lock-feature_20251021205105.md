# 🔒 桌面日历组件 - 锁定功能说明

## 功能概述

桌面日历组件现在支持"锁定在桌面"功能，锁定后组件将变为透明交互层，鼠标点击会穿透到下方窗口。

---

## 🎯 功能特性

### 1. **锁定在桌面** 🔒
- 锁定后组件固定在桌面上，无法拖动和缩放
- 鼠标点击穿透（click-through），不会遮挡下方窗口的操作
- 仍可通过顶部栏的按钮解锁

### 2. **快速锁定/解锁**
- **方式一**: 点击顶部拖动栏的 🔒/🔓 按钮
- **方式二**: 打开设置面板，勾选"🔒 锁定在桌面"复选框

### 3. **锁定状态指示**
- 标题旁显示 🔒 图标
- 锁定按钮高亮为橙黄色
- 设置面板中复选框显示选中状态

---

## 🖱️ 用户界面

```
┌──────────────────────────────────────┐
│ 📅 日历组件 🔒   🔒 ⚙️  ×          │ ← 拖动栏
│    ↑                ↑                 │
│    已锁定标识      锁定按钮(橙色)      │
│                                       │
│    ┌──────────────────┐               │
│    │  🎨 外观设置      │               │
│    ├──────────────────┤               │
│    │  ... 颜色设置 ... │               │
│    │  ... 透明度 ...   │               │
│    ├──────────────────┤               │
│    │ ☑ 🔒 锁定在桌面  │ ← 锁定选项    │
│    │   锁定后无法拖动和 │               │
│    │   点击，但可通过   │               │
│    │   设置解锁        │               │
│    └──────────────────┘               │
├──────────────────────────────────────┤
│                                       │
│         TimeCalendar 日历             │
│      (无"📍 悬浮窗"按钮)              │
│                                      ⋰│
└──────────────────────────────────────┘
```

---

## 📋 使用方法

### 快速锁定
1. 打开桌面日历组件
2. 点击顶部 **🔓 锁定按钮**
3. 组件立即锁定，标题显示 🔒 图标

### 通过设置面板锁定
1. 点击 **⚙️ 设置按钮**
2. 勾选 **"🔒 锁定在桌面"** 复选框
3. 设置自动保存并应用

### 解锁
- **方式一**: 点击顶部 **🔒 按钮**（变为 🔓）
- **方式二**: 打开设置面板，取消勾选复选框

---

## 🎨 锁定状态效果

### 锁定前 (🔓 Normal Mode)
```
✅ 可拖动窗口
✅ 可缩放窗口
✅ 可点击日历内容
✅ 可与所有按钮交互
```

### 锁定后 (🔒 Locked Mode)
```
❌ 无法拖动窗口
❌ 无法缩放窗口
❌ 鼠标穿透（点击到桌面或下方窗口）
✅ 仍可点击顶部栏按钮（解锁、设置、关闭）
```

---

## 🔧 技术实现

### 前端 (WidgetPage.tsx)

```typescript
const [isLocked, setIsLocked] = useState(false);

const handleLockToggle = async () => {
  const newLockState = !isLocked;
  setIsLocked(newLockState);
  localStorage.setItem('widget-locked', newLockState.toString());
  
  // 调用 Electron API
  if (window.electronAPI?.widgetLock) {
    await window.electronAPI.widgetLock(newLockState);
  }
};
```

### 后端 (electron/main.js)

```javascript
ipcMain.handle('widget-lock', (event, isLocked) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    // 设置鼠标事件穿透
    widgetWindow.setIgnoreMouseEvents(isLocked, { forward: true });
    // 禁用拖动和缩放
    widgetWindow.setMovable(!isLocked);
    widgetWindow.setResizable(!isLocked);
  }
  return { success: true, locked: isLocked };
});
```

### 关键 API
- `setIgnoreMouseEvents(isLocked, { forward: true })` - 鼠标穿透
- `setMovable(!isLocked)` - 禁用/启用拖动
- `setResizable(!isLocked)` - 禁用/启用缩放

---

## 💡 使用场景

### 场景 1: 桌面时钟显示
```
设置: 
  - 颜色: #000000 (黑色)
  - 透明度: 60%
  - 锁定: ✅ 开启
  
效果: 
  半透明黑色日历固定在桌面右上角
  不干扰其他窗口操作
  快速查看日程安排
```

### 场景 2: 全屏工作提醒
```
设置:
  - 颜色: #e8e8ff (浅紫)
  - 透明度: 30%
  - 锁定: ✅ 开启
  
效果:
  全屏显示时日历浮在所有窗口上方
  高透明度不遮挡工作内容
  关键日程一目了然
```

### 场景 3: 临时查看模式
```
设置:
  - 锁定: ❌ 关闭
  
效果:
  可随时拖动调整位置
  可点击交互查看详情
  查看完毕后可重新锁定
```

---

## ⚠️ 重要提示

### 锁定状态下的限制
1. **无法直接点击日历内容**
   - 需要先解锁才能查看事件详情
   - 或通过设置面板解锁

2. **无法拖动和缩放**
   - 确保在锁定前调整好位置和大小
   - 解锁后可重新调整

3. **顶部栏仍可交互**
   - 解锁按钮 (🔒)
   - 设置按钮 (⚙️)
   - 关闭按钮 (×)

### 数据持久化
- 锁定状态自动保存到 `localStorage`
- 下次打开组件会自动恢复锁定状态
- 存储键: `widget-locked`

---

## 🐛 故障排除

### 问题 1: 锁定后无法解锁
**解决方案**:
- 点击顶部 🔒 按钮（仍可点击）
- 或通过 ⚙️ 设置面板解锁

### 问题 2: 锁定状态没有保存
**解决方案**:
- 检查浏览器 localStorage 权限
- 确保 Electron 窗口未以无痕模式运行

### 问题 3: 鼠标穿透不工作
**解决方案**:
- 检查 Electron 版本 ≥ 4.0
- `setIgnoreMouseEvents` API 在旧版本可能不支持

---

## 🆕 移除的功能

### 移除"📍 悬浮窗"按钮
- **原因**: Widget 本身已是悬浮窗，无需再次打开
- **位置**: TimeCalendar 组件顶部工具栏
- **条件**: 当 `isWidgetMode={true}` 时隐藏

**Before**:
```tsx
{window.electronAPI?.isElectron && (
  <button>📍 悬浮窗</button>
)}
```

**After**:
```tsx
{window.electronAPI?.isElectron && !isWidgetMode && (
  <button>📍 悬浮窗</button>
)}
```

---

## ✅ 功能清单

- [x] 锁定/解锁按钮（顶部栏）
- [x] 锁定状态图标显示
- [x] 设置面板中的锁定选项
- [x] 鼠标事件穿透（click-through）
- [x] 禁用拖动和缩放
- [x] localStorage 数据持久化
- [x] 锁定状态自动恢复
- [x] 移除 Widget 模式下的"悬浮窗"按钮
- [x] 视觉提示（橙色高亮）

---

## 🎉 开始使用

现在就打开桌面日历组件，点击 **🔓 按钮**，体验全新的锁定功能吧！

**建议工作流**:
1. 打开组件并调整到合适位置和大小
2. 设置背景颜色和透明度
3. 点击 🔓 按钮锁定
4. 享受不被打扰的桌面日历体验
5. 需要交互时点击 🔒 解锁
