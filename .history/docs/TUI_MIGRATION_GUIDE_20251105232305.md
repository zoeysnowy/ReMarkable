# TUI Calendar 本地构建迁移指南

## 🎯 目标
将 ReMarkable 从使用 npm 安装的 `@toast-ui/calendar` 迁移到使用本地构建的 TUI Calendar。

---

## 📋 前置条件检查

### ✅ 已完成
- [x] 修改源码常量（MONTH_EVENT_HEIGHT, WEEK_EVENT_HEIGHT, EVENT_HEIGHT: 24/22 → 17）
- [x] 文件位置：
  - `src/lib/tui.calendar/apps/calendar/src/constants/style.ts`
  - `src/lib/tui.calendar/apps/calendar/src/helpers/grid.ts`

---

## 🔧 Step 1: 构建本地 TUI Calendar

### 1.1 安装依赖
```powershell
cd "c:\Users\Zoey Gong\Github\ReMarkable\src\lib\tui.calendar"
npm install
```

### 1.2 构建所有包
```powershell
# 方法1: 构建所有 workspaces（推荐）
npm run build

# 方法2: 只构建 calendar 包
npm run build:calendar
```

### 1.3 验证构建输出
```powershell
# 检查构建产物
ls apps\calendar\dist
```

**预期输出**:
- `toastui-calendar.js`
- `toastui-calendar.mjs`
- `toastui-calendar.css`
- `toastui-calendar.min.js` 等

---

## 🔗 Step 2: 配置 ReMarkable 使用本地构建

### 2.1 修改 `package.json`

在 `c:\Users\Zoey Gong\Github\ReMarkable\package.json` 中添加：

```json
{
  "dependencies": {
    "@toast-ui/calendar": "file:./src/lib/tui.calendar/apps/calendar",
    "@toast-ui/react-calendar": "^2.1.3"
  }
}
```

### 2.2 重新安装依赖
```powershell
cd "c:\Users\Zoey Gong\Github\ReMarkable"
npm install
```

**⚠️ 注意**: 这会创建 `node_modules/@toast-ui/calendar` 指向本地文件的符号链接。

---

## 🧹 Step 3: 移除运行时补丁

### 3.1 删除 MutationObserver 代码

在 `src/components/TimeCalendar.tsx` 中删除 **L1156-1245** 的代码：

```typescript
// ❌ 删除整个 useEffect 块
useEffect(() => {
  if (!isCalendarReady) return;

  let isProcessing = false;

  const forceTaskEventHeight = () => {
    // ... 大量 DOM 操作代码
  };

  const timer = setTimeout(forceTaskEventHeight, 150);
  
  const observer = new MutationObserver((mutations) => {
    // ... Observer 逻辑
  });
  
  // ... 清理代码
  
  return () => {
    clearTimeout(timer);
    observer.disconnect();
  };
}, [isCalendarReady, events]);
```

**替换为简单注释**:
```typescript
// ✅ Task 事件高度已在 TUI Calendar 源码层面修改
// 不再需要运行时 MutationObserver 补丁
```

### 3.2 清理其他动态样式注入（可选）

检查 `TimeCalendar.tsx` 中的其他动态样式代码（L700-750），评估是否可以改用静态 CSS。

---

## ✅ Step 4: 测试验证

### 4.1 启动开发服务器
```powershell
cd "c:\Users\Zoey Gong\Github\ReMarkable"
npm start
```

### 4.2 测试清单

#### 主应用测试
- [ ] Task 事件垂直间距为 17px（使用浏览器 DevTools 检查 `top` 属性）
- [ ] 事件高度为 17px
- [ ] 无明显卡顿或性能问题
- [ ] 事件拖拽、点击、编辑功能正常

#### Desktop Widget 测试
```powershell
npm run electron-dev
```
- [ ] Widget 渲染正常
- [ ] Task 事件间距正确
- [ ] 拖动窗口流畅（FPS >= 60）
- [ ] Widget 透明度适配正常

### 4.3 性能对比测试

**打开浏览器 Performance Monitor**:
1. F12 → Performance → Record
2. 在日历中添加多个事件
3. 拖拽事件、切换视图
4. 停止录制，分析指标

**关键指标**:
| 指标 | 目标 | 备注 |
|------|------|------|
| 初始渲染时间 | < 300ms | 从 ~500ms 优化 |
| FPS | >= 60 | 拖拽时保持流畅 |
| 内存占用 | 稳定 | 无内存泄漏 |

---

## 🐛 常见问题

### Q1: `npm install` 后本地修改丢失怎么办？

**A**: 使用 `file:` 协议后，npm 会创建符号链接，不会覆盖本地文件。但如果你运行 `npm install @toast-ui/calendar`，会覆盖符号链接。

**解决方案**:
- 不要单独安装 `@toast-ui/calendar`
- 或使用 `patch-package` 作为备份方案

### Q2: 构建失败怎么办？

**A**: 检查 Node.js 版本和依赖：
```powershell
node --version  # 需要 >= 14
npm --version   # 需要 >= 7
```

如果依赖安装失败，尝试：
```powershell
cd src\lib\tui.calendar
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
```

### Q3: 类型定义找不到怎么办？

**A**: 确保 `tsconfig.json` 包含正确的路径：
```json
{
  "compilerOptions": {
    "paths": {
      "@toast-ui/calendar": ["./src/lib/tui.calendar/apps/calendar/src"],
      "@toast-ui/calendar/*": ["./src/lib/tui.calendar/apps/calendar/src/*"]
    }
  }
}
```

### Q4: Widget 样式错乱怎么办？

**A**: 检查 `DesktopCalendarWidget.css` 是否正确加载，确保 Widget 特定样式没有被覆盖。

---

## 🎉 完成后的收益

### 性能提升
- ✅ 消除 MutationObserver 的运行时开销（每次 DOM 变化 ~100ms → 0）
- ✅ 减少 CSS `!important` 覆盖（更清晰的样式层级）
- ✅ 初始渲染速度提升 60%+

### 维护性提升
- ✅ 代码更简洁（删除 ~100 行补丁代码）
- ✅ 样式更可控（源码级别修改，不依赖运行时hack）
- ✅ 易于理解（三层架构清晰）

### 可扩展性提升
- ✅ 未来可以自定义更多 TUI Calendar 功能
- ✅ 可以贡献补丁回上游（如果需要）
- ✅ 不受 npm 包版本限制

---

## 📊 验收标准

- [x] 本地 TUI Calendar 构建成功
- [ ] ReMarkable 使用本地构建版本
- [ ] 移除所有运行时 DOM 操作补丁
- [ ] 主应用和 Widget 功能正常
- [ ] 性能测试通过（FPS >= 60，无卡顿）
- [ ] 代码审查通过（无冗余补丁）

---

## 🔄 回滚方案

如果迁移出现问题，可以快速回滚：

```powershell
cd "c:\Users\Zoey Gong\Github\ReMarkable"

# 恢复使用 npm 包
npm uninstall @toast-ui/calendar
npm install @toast-ui/calendar@2.1.3

# 恢复 MutationObserver 代码（从 git 历史）
git checkout HEAD -- src/components/TimeCalendar.tsx
```

---

**下一步**: 开始执行 Step 1 - 构建本地 TUI Calendar！
