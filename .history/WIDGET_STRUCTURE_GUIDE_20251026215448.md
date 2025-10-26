# Widget 结构层级说明

## 📐 DOM 结构层级（从外到内）

```
.desktop-calendar-widget (最外层容器)
├── position: relative
├── width: 100vw, height: 100vh
├── backgroundColor: transparent
└── 包含以下子元素：
    
    1. 🎯 Resize handles (absolute 定位)
       ├── .resize-handle-bottom (底部边缘)
       ├── .resize-handle-left (左侧边缘)
       ├── .resize-handle-right (右侧边缘)
       ├── .resize-handle-bottomleft (左下角)
       └── .resize-handle-bottomright (右下角)
       - zIndex: 10001 (最高层)
       - 透明，无背景色
    
    2. 🎮 Controller / Drag-bar (absolute 定位)
       ├── position: absolute
       ├── top: 8px, left: 8px, right: 8px
       ├── height: 10px
       ├── zIndex: 10000
       ├── background: rgba(..., bgOpacity * 0.8) 正常
       │             rgba(..., bgOpacity * 1.2) hover
       ├── backdropFilter: blur(3px) 正常
       │                   blur(8px) hover
       ├── borderRadius: 20px
       └── border: none
    
    3. 📅 Main Content Area (flex 布局)
       ├── flex: 1
       ├── marginTop: 0
       ├── display: flex, flexDirection: column
       ├── background: transparent (无背景)
       ├── border: none
       └── 包含：
           
           a) 🗓️ Calendar (日历主体)
              ├── flex: 1
              ├── overflow: hidden
              ├── background: transparent
              ├── border: none
              └── borderRadius: 0 0 12px 12px
           
           b) 📊 StatusBar (底部状态栏)
              ├── flexShrink: 0
              ├── margin: 0 8px 20px 8px
              ├── background: rgba(..., bgOpacity * 0.8)
              ├── backdropFilter: blur(3px)
              ├── borderRadius: 20px
              ├── border: none
              └── padding: 8px 12px
```

## 🎨 样式一致性规范

### 背景色和透明度
- **Controller (drag-bar)**: `rgba(..., bgOpacity * 0.8)` 正常，hover 时 `bgOpacity * 1.2`
- **StatusBar**: `rgba(..., bgOpacity * 0.8)` ✅
- **Main / Calendar**: `transparent` (完全透明)
- **最外层容器**: `transparent` (完全透明)

### 模糊效果
- **Controller (drag-bar)**: `blur(3px)` 正常，hover 时 `blur(8px)`
- **StatusBar**: `blur(3px)` ✅
- **Main / Calendar**: 无模糊效果

### 边框
- **所有元素**: `border: none` ✅

### 圆角
- **Controller (drag-bar)**: `borderRadius: 20px`
- **StatusBar**: `borderRadius: 20px`
- **Calendar**: `borderRadius: 0 0 12px 12px` (只有底部圆角)

## 🔍 当前问题

### 问题 1: Drag-bar 不透明
**现象**: 用户设置透明度后，drag-bar 仍然是实心的
**原因**: 检查代码发现可能使用了错误的 opacity 计算
**位置**: `src/pages/WidgetPage_v3.tsx` line ~745
**修复**: 确保使用 `bgOpacity * 0.8` 而不是其他值

### 问题 2: Main 有 border
**现象**: Main content area 有边框
**位置**: 需要检查 line ~826
**修复**: 确保 `border: 'none'`

## ✅ 修复检查清单

- [ ] Controller background: `rgba(..., bgOpacity * 0.8)`
- [ ] Controller backdrop-filter: `blur(3px)`
- [ ] StatusBar background: `rgba(..., bgOpacity * 0.8)` ✅
- [ ] StatusBar backdrop-filter: `blur(3px)` ✅
- [ ] Main background: `transparent`
- [ ] Main border: `none`
- [ ] Calendar background: `transparent`
- [ ] Calendar border: `none`
