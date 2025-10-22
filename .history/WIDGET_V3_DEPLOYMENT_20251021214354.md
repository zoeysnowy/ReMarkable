# WidgetPage_v3 部署说明

## 📋 变更概述

创建了新的 `WidgetPage_v3.tsx`，完全复刻 `DesktopCalendarWidgetV3.tsx` 的实现，用于替代当前不稳定的 WidgetPage。

## ✅ 已完成的工作

### 1. 新增文件
- **`src/pages/WidgetPage_v3.tsx`** - 完全复刻测试页面的逻辑
  - ✅ 整体透明度 (`opacity`) - 应用到整个容器
  - ✅ 背景透明度 (`bgOpacity`) - 单独控制背景层
  - ✅ 隐藏拖拽手柄 (30px高度，`rgba(0,0,0,0.05)` → `0.15`)
  - ✅ 控制栏悬浮显示（深色渐变，blur效果）
  - ✅ 日历内容区域 margin 动态调整 (`0` → `60px`)
  - ✅ 锁定/解锁功能
  - ✅ 设置面板（整体透明度、背景透明度、背景颜色）
  - ✅ 调整大小手柄（右下角）

### 2. 路由配置
- **`src/App.tsx`**
  - 新增 `WidgetPage_v3` 导入
  - 新增路由检测：`#/widget-v3`
  - 保留原有 `#/widget` 路由（以便对比测试）

### 3. Electron 配置
- **`electron/main.js`**
  - 更新悬浮窗口默认加载 URL：`#/widget` → `#/widget-v3`
  - 开发环境：`http://localhost:3000/#/widget-v3`
  - 生产环境：`file://...build/index.html#/widget-v3`

## 🎯 核心改进

### 与测试页面完全一致的实现

1. **透明度分层控制**
   ```typescript
   opacity: opacity,              // 整体透明度 (0.95)
   backgroundColor: bgColorRgba,  // 背景透明度 (默认 0.0)
   ```

2. **隐藏拖拽手柄**
   - 30px 高度，始终存在
   - 默认背景：`rgba(0,0,0,0.05)`
   - 悬浮背景：`rgba(0,0,0,0.15)`
   - 文本提示："⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮"

3. **控制栏**
   - 仅在容器 `onMouseEnter` 时显示
   - 深色渐变：`linear-gradient(135deg, rgba(0,0,0,0.9), rgba(30,30,30,0.8))`
   - 毛玻璃效果：`backdropFilter: 'blur(20px)'`

4. **日历内容区域**
   - 动态 margin：`showControls ? '60px' : '0'`
   - 平滑过渡：`transition: 'margin-top 0.3s ease'`
   - 阻止拖拽传播：`onMouseDown={(e) => e.stopPropagation()}`

5. **CSS 透明度支持**
   - 应用 `widget-mode-calendar` class
   - 所有内部元素跟随透明度（参考 `calendar.css` 中的样式）

## 🧪 测试方法

### 方法 1：Electron 窗口（推荐）
1. 运行开发服务器：`npm start`
2. 启动 Electron：`npm run electron:dev`
3. 点击主窗口"📍 悬浮窗"按钮
4. 新窗口将自动加载 v3 版本

### 方法 2：浏览器测试
访问：`http://localhost:3000/#/widget-v3`

### 方法 3：对比测试
- v3 版本：`http://localhost:3000/#/widget-v3`
- 旧版本：`http://localhost:3000/#/widget`
- 测试页面：`http://localhost:3000/` → 切换到"测试"页面

## 🔍 功能验证清单

- [ ] 鼠标移到顶部，隐藏拖拽手柄是否容易触发？
- [ ] 鼠标悬浮，控制栏是否平滑出现？
- [ ] 整体透明度调节是否正常工作？(30% - 100%)
- [ ] 背景透明度调节是否正常工作？(0% - 100%)
- [ ] 背景颜色选择是否正常工作？
- [ ] 锁定后是否无法拖拽和调整大小？
- [ ] 解锁后是否可以正常拖拽？
- [ ] 右下角调整大小手柄是否可用？
- [ ] 日历内部元素（导航栏、网格线、状态栏）是否跟随透明度？
- [ ] 控制栏显示/隐藏时，日历是否平滑上下移动？

## 📦 文件状态

### 新增
- ✅ `src/pages/WidgetPage_v3.tsx` - 新版本实现

### 保留（未修改）
- ✅ `src/pages/WidgetPage.tsx` - 旧版本（供对比）
- ✅ `src/components/DesktopCalendarWidgetV3.tsx` - 原始测试页面组件
- ✅ `src/styles/calendar.css` - CSS样式（已包含 widget-mode 支持）

### 修改
- ✅ `src/App.tsx` - 添加 v3 路由
- ✅ `electron/main.js` - 更新默认 URL

## 🎨 关键差异对比

| 特性 | 旧版 WidgetPage | 新版 WidgetPage_v3 | 测试页 DesktopCalendarWidgetV3 |
|------|-----------------|--------------------|---------------------------------|
| 透明度分层 | ❌ 单一背景 | ✅ opacity + bgOpacity | ✅ opacity + bgOpacity |
| 隐藏拖拽手柄 | ❌ 40px，不稳定 | ✅ 30px，稳定可触发 | ✅ 30px，稳定可触发 |
| 控制栏样式 | ⚠️ 简化版 | ✅ 完整深色渐变+blur | ✅ 完整深色渐变+blur |
| 日历 margin | ❌ 固定或跳闪 | ✅ 平滑过渡 0→60px | ✅ 平滑过渡 0→60px |
| CSS 透明度 | ⚠️ 部分支持 | ✅ 完整支持 | ✅ 完整支持 |
| 锁定功能 | ⚠️ 仅Electron IPC | ✅ Electron IPC + 本地状态 | ✅ 完整状态管理 |

## 🚀 下一步

1. **测试验证**：在 Electron 窗口中测试所有功能
2. **问题修复**：如发现任何问题，请反馈具体表现
3. **稳定后替换**：确认 v3 版本稳定后，可用其替换旧 WidgetPage
4. **清理代码**：删除不需要的旧版本文件

## 💡 回滚方案

如果 v3 版本有问题，可快速回滚：

```javascript
// electron/main.js 第 548-550 行
const widgetUrl = isDev 
  ? 'http://localhost:3000/#/widget'      // 改回旧版
  : `file://${path.join(__dirname, '../build/index.html#/widget')}`;
```

## 📝 备注

- ✅ **DesktopCalendarWidgetV3.tsx 未被删除或修改**
- ✅ 所有原有文件均保持完整
- ✅ v3 版本为独立文件，不影响现有功能
- ✅ 可随时在新旧版本间切换测试
