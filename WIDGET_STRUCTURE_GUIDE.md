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
- **Controller (drag-bar)**: 
  - 正常状态：`rgba(..., bgOpacity * 0.8)` 
  - Hover 状态：`rgba(..., min(bgOpacity * 0.95, 0.95))` ✅ 修复：不再使用 1.2 倍，避免完全不透明
- **StatusBar**: `rgba(..., bgOpacity * 0.8)` ✅
- **Main / Calendar**: `transparent` (完全透明) ✅
- **最外层容器**: `transparent` (完全透明) ✅

### 模糊效果
- **Controller (drag-bar)**: `blur(3px)` 正常，hover 时 `blur(8px)` ✅
- **StatusBar**: `blur(3px)` ✅
- **Main / Calendar**: 无模糊效果

### 边框
- **所有元素**: `border: none` ✅

### 圆角
- **Controller (drag-bar)**: `borderRadius: 20px` ✅
- **StatusBar**: `borderRadius: 20px` ✅
- **Calendar**: `borderRadius: 0 0 12px 12px` (只有底部圆角) ✅

## 🔍 问题诊断与修复

### ✅ 已修复：Drag-bar hover 时变成实心
**问题**: 用户设置透明度后，drag-bar hover 时变成完全不透明（opacity = 1.0）
**原因**: 使用了 `Math.min(bgOpacity * 1.2, 1)`，当 bgOpacity = 0.95 时，计算结果为 1.0
**修复**: 改为 `Math.min(bgOpacity * 0.95, 0.95)`，hover 时最多 95% 不透明
**位置**: `src/pages/WidgetPage_v3.tsx` line 747

### ✅ 已确认：Main 和 Calendar 无 border
**检查**: Main content area 和 Calendar 已经设置 `border: none`
**位置**: `src/pages/WidgetPage_v3.tsx` line 826

## ✅ 修复检查清单

- [x] Controller background 正常: `rgba(..., bgOpacity * 0.8)` ✅
- [x] Controller background hover: `rgba(..., min(bgOpacity * 0.95, 0.95))` ✅ 修复
- [x] Controller backdrop-filter: `blur(3px)` ✅
- [x] StatusBar background: `rgba(..., bgOpacity * 0.8)` ✅
- [x] StatusBar backdrop-filter: `blur(3px)` ✅
- [x] Main background: `transparent` ✅
- [x] Main border: `none` ✅
- [x] Calendar background: `transparent` ✅
- [x] Calendar border: `none` ✅
