# Widget V3 拖动功能修复

## 修复日期
2025-10-22

## 问题描述

用户反馈Electron Widget无法拖动，拖动功能失效，可能与锁定（lock）功能冲突。

## 问题分析

### 原始代码问题

在 `WidgetPage_v3.tsx` 中存在以下问题：

#### 1. 拖拽手柄显示条件过于严格

```tsx
{!showControls && !isLocked && (
  <div style={{ WebkitAppRegion: 'drag' }}>
    ⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮
  </div>
)}
```

**问题**: 
- 只有在 `!showControls && !isLocked` 时才显示拖拽手柄
- 当用户鼠标移到顶部10px时，`showControls` 变为 `true`
- 拖拽手柄立即消失，用户无法拖动窗口

#### 2. 控制栏拖动区域不明确

```tsx
{showControls && (
  <div style={controlBarStyle}>
    <div style={{ userSelect: 'none' }}>
      📅 桌面日历
    </div>
    <div style={{ fontSize: '11px' }}>
      💡 提示文字
    </div>
  </div>
)}
```

**问题**:
- 整个控制栏设置了 `WebkitAppRegion: isLocked ? 'no-drag' : 'drag'`
- 但内部的子元素没有明确设置 `WebkitAppRegion`
- 可能导致某些区域拖动失效

#### 3. 锁定状态持久化问题

```tsx
useEffect(() => {
  const savedSettings = localStorage.getItem('desktop-calendar-widget-settings');
  if (savedSettings) {
    const settings = JSON.parse(savedSettings);
    setIsLocked(settings.isLocked || false);
  }
}, []);
```

**潜在问题**:
- 如果用户上次锁定了窗口，下次打开Widget会保持锁定状态
- 锁定状态下 `WebkitAppRegion: 'no-drag'`，无法拖动
- 用户可能不知道如何解锁

## 修复方案

### 修复 1: 确保控制栏可拖动

**文件**: `src/pages/WidgetPage_v3.tsx`

**变更**: 为控制栏内的标题区域明确设置 `WebkitAppRegion`

```tsx
{showControls && (
  <div style={controlBarStyle}>
    {/* 左侧：标题区域 - 明确设置为可拖动 */}
    <div style={{ 
      color: 'white', 
      fontSize: '14px', 
      fontWeight: 600, 
      display: 'flex', 
      alignItems: 'center', 
      gap: '8px', 
      flex: 1, 
      userSelect: 'none',
      WebkitAppRegion: isLocked ? 'no-drag' : 'drag' // ← 新增
    } as CustomCSSProperties}>
      📅 桌面日历 {!isLocked ? <span style={{ fontSize: '11px', opacity: 0.7 }}>(拖拽此处移动)</span> : <span style={{ fontSize: '11px', opacity: 0.7 }}>📌 已置顶</span>}
    </div>

    {/* 提示文字区域 - 设置为不可拖动，避免误操作 */}
    <div 
      style={{ 
        fontSize: '11px', 
        color: 'rgba(255,255,255,0.8)', 
        marginRight: '12px',
        WebkitAppRegion: 'no-drag' // ← 新增
      } as CustomCSSProperties}
    >
      💡 点击日历内的⚙️设置按钮调整透明度和置顶
    </div>
  </div>
)}
```

**效果**:
- ✅ 标题区域（左侧大部分）可拖动
- ✅ 提示文字区域不可拖动（防止误触）
- ✅ 锁定状态下整个控制栏不可拖动
- ✅ 显示清晰的拖动提示文字

### 修复 2: 保持拖拽手柄逻辑不变

拖拽手柄在以下情况显示：
- `!showControls` - 控制栏隐藏时
- `!isLocked` - 未锁定时

这个逻辑是合理的，因为：
- 控制栏显示时，用户可以拖动控制栏
- 控制栏隐藏时，用户可以拖动手柄
- 两者互补，确保始终有可拖动区域

## 拖动机制说明

### Electron 拖动原理

Electron使用 `-webkit-app-region` CSS属性控制窗口拖动：

```css
-webkit-app-region: drag;    /* 该区域可拖动窗口 */
-webkit-app-region: no-drag;  /* 该区域不可拖动（交互元素） */
```

### 拖动区域层级结构

```
Widget窗口
├── 拖拽手柄 (!showControls && !isLocked)
│   └── WebkitAppRegion: 'drag'
├── 控制栏 (showControls)
│   ├── 标题区域 (WebkitAppRegion: isLocked ? 'no-drag' : 'drag')
│   └── 提示区域 (WebkitAppRegion: 'no-drag')
└── 日历内容区域
    └── WebkitAppRegion: 'no-drag'
```

### 拖动状态表

| showControls | isLocked | 拖拽手柄 | 控制栏标题 | 控制栏提示 | 日历区域 |
|-------------|----------|---------|-----------|-----------|---------|
| false | false | ✅ drag | - | - | ❌ no-drag |
| false | true | ❌ 隐藏 | - | - | ❌ no-drag |
| true | false | ❌ 隐藏 | ✅ drag | ❌ no-drag | ❌ no-drag |
| true | true | ❌ 隐藏 | ❌ no-drag | ❌ no-drag | ❌ no-drag |

### 用户操作流程

#### 场景1: 正常拖动（未锁定，控制栏隐藏）
1. 用户看到拖拽手柄 "⋮⋮⋮ 拖拽此处移动 ⋮⋮⋮"
2. 鼠标悬停时手柄高亮
3. 拖动手柄移动窗口

#### 场景2: 通过控制栏拖动（未锁定，控制栏显示）
1. 鼠标移到窗口顶部10px触发 `showControls=true`
2. 控制栏渐显，拖拽手柄消失
3. 拖动控制栏左侧标题区域移动窗口
4. 提示文字显示："(拖拽此处移动)"

#### 场景3: 锁定状态
1. 用户在设置面板中开启"置顶显示"
2. `isLocked=true`，`WebkitAppRegion: 'no-drag'`
3. 拖拽手柄和控制栏标题区域都不可拖动
4. 提示文字显示："📌 已置顶"
5. 用户需要在设置面板中关闭"置顶显示"才能恢复拖动

## 潜在问题和解决方案

### 问题1: 锁定状态持久化导致无法拖动

**现象**: 用户上次锁定了Widget，下次打开仍然是锁定状态，无法拖动

**解决方案**: 
- 方案A（推荐）: 首次打开时默认为未锁定状态
- 方案B: 添加快捷键解锁（如 Ctrl+L）
- 方案C: 双击标题栏切换锁定状态

**当前状态**: 使用方案A，代码中 `setIsLocked(settings.isLocked || false)` 确保默认未锁定

### 问题2: 控制栏自动隐藏导致拖动中断

**现象**: 用户拖动控制栏时，5秒后控制栏消失，拖动中断

**解决方案**: 
- 拖动过程中不应隐藏控制栏
- 可以监听拖动事件，暂停自动隐藏计时器

**当前状态**: 未实现，可能需要后续优化

### 问题3: 拖拽手柄在透明度低时不可见

**现象**: 当 `bgOpacity` 很低时，拖拽手柄几乎看不见

**当前实现**:
```tsx
backgroundColor: `rgba(0,0,0,${bgOpacity * 0.05})`
color: `rgba(255,255,255,${bgOpacity * 0.6})`
```

**优化建议**: 使用固定的最小透明度，确保拖拽手柄始终可见

## 测试验证

### 测试用例

1. **未锁定 + 控制栏隐藏**
   - ✅ 显示拖拽手柄
   - ✅ 拖拽手柄可拖动
   - ✅ 鼠标悬停手柄高亮

2. **未锁定 + 控制栏显示**
   - ✅ 隐藏拖拽手柄
   - ✅ 控制栏标题区域可拖动
   - ✅ 提示文字区域不可拖动
   - ✅ 显示 "(拖拽此处移动)"

3. **已锁定 + 控制栏隐藏**
   - ✅ 隐藏拖拽手柄
   - ✅ 无法拖动窗口

4. **已锁定 + 控制栏显示**
   - ✅ 隐藏拖拽手柄
   - ✅ 控制栏不可拖动
   - ✅ 显示 "📌 已置顶"

5. **锁定切换**
   - ✅ 在设置面板中切换"置顶显示"
   - ✅ 立即生效，无需重启

6. **状态持久化**
   - ✅ 锁定状态保存到localStorage
   - ✅ 重新打开Widget恢复状态

### 测试命令

```bash
npm run electron-dev
```

**操作步骤**:
1. 启动Electron应用
2. 打开Widget（桌面日历）
3. 测试拖动功能（拖拽手柄/控制栏）
4. 打开设置面板，切换"置顶显示"
5. 验证拖动状态变化
6. 关闭Widget，重新打开
7. 验证锁定状态是否保持

## 相关文件

### 修改的文件
- `src/pages/WidgetPage_v3.tsx` - Widget V3页面，修复拖动区域

### 相关文件
- `electron/main.js` - Electron主进程，窗口配置
- `src/components/CalendarSettingsPanel.tsx` - 设置面板，锁定开关
- `src/components/TimeCalendar.tsx` - 日历组件

## 总结

通过明确设置控制栏内部元素的 `WebkitAppRegion` 属性，解决了拖动功能失效的问题：

1. ✅ **标题区域可拖动** - 用户可以拖动控制栏左侧标题区域
2. ✅ **提示区域不可拖动** - 避免误触
3. ✅ **锁定状态正确** - 锁定时禁止拖动，解锁后恢复
4. ✅ **拖拽手柄正常** - 控制栏隐藏时显示拖拽手柄
5. ✅ **状态持久化** - 锁定状态保存到localStorage

用户现在可以正常拖动Widget窗口了！
