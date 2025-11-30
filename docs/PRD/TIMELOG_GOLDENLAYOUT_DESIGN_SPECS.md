# TimeLog 页面 GoldenLayout 设计规格书

> **创建时间**: 2025-12-01  
> **Figma 设计稿**: https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=486-2661  
> **关联文档**: 
> - [GOLDENLAYOUT_IMPLEMENTATION_PLAN.md](./GOLDENLAYOUT_IMPLEMENTATION_PLAN.md)
> - [TimeLog_&_Description_PRD.md](./TimeLog_&_Description_PRD.md)

---

## 📐 设计概览

### Figma 原始设计分析

**页面布局（总宽度: 1440px）**

```
┌─────────┬──────────────┬──────────────────────────────────┬────────────┐
│ Left    │ Content      │ Main Timeline                    │ Right FAB  │
│ Sidebar │ Selection    │ 时光日志                          │ (Floating) │
│ 96px    │ 342px        │ 905px                            │ 80px       │
├─────────┼──────────────┼──────────────────────────────────┼────────────┤
│ ┌─────┐ │ 内容选取 👁️  │ 时光日志                          │ ⊕ 记录此刻  │
│ │LOGO │ │              │                                  │           │
│ └─────┘ │ 🔍 输入"去年  │ 2025.10.18（周六）                │ 🎤 语音记录 │
│         │   今天"、    │ ┌─────────────────────────────┐  │           │
│ 首页    │   "上周专注" │ │ 10:00 ━━━━━━━━━ 12:00       │  │ 🖼️ 图片    │
│         │              │ │ 🎙️ 议程讨论                  │  │           │
│ [时光]  │ 📅 2025年10月│ │ #👜工作 #🧐文档编辑          │  │ 🎵 音频    │
│ (active)│ 日 一 二 ... │ │ 👥 Zoey Gong; Jenny Wong...  │  │           │
│         │ 1  2  3  ... │ │ 📍 静安嘉里中心2座F38...      │  │ 🎬 视频    │
│ 日志    │              │ │ ─────────────────────────── │  │           │
│         │ ⚡ 标签/事项/ │ │ 太强了！居然直接成稿了，那现  │  │ 📄 文档    │
│ 标签    │   收藏/New   │ │ 在就只要做些检查了...        │  │           │
│         │              │ │ 2025-10-19 10:21:18         │  │ 📦 项目    │
│ 计划    │ 👁️ #🔮Remark │ └─────────────────────────────┘  │           │
│         │    able开发  │                                  │ 🔖 网页收藏 │
│ 追踪    │    ■■■□ 3/7  │ 10:00 ━━━━━━━━━ 12:00           │           │
│         │    12h       │ 🎓 准备演讲稿                     │ 📤 导出    │
│ 同步    │              │ #👜工作 #🧐文档编辑               │           │
│         │ 👁️ #🔮PRD   │ 📝 创建于12h前，距离ddl还有2h30min│           │
│         │    文档      │ 🔗 上级任务：Project Ace...      │           │
│         │    ■■□□ 3/7  │ ─────────────────────────────── │           │
│         │    6h        │ 处理完了一些出差的logistics...   │           │
│         │              │                                  │           │
│         │ 👁️ #🔮码     │ 📅 2025 年 10 月                 │           │
│         │    代码      │ 日 一 二 三 四 五 六              │           │
│         │    ■□□□ 3/7  │ 19 20 21 22 23 24 25 26         │           │
│         │    3h        │ 27 28 29 30 31  1  2  3 ...     │           │
│         │              │                                  │           │
│         │ 显示全部     │ 📅 2025 年 11 月                 │           │
│         │              │  1  2  3  4  5  6  7  8 ...     │           │
│         │              │                                  │           │
│         │              │ 2025.11.12（周三）               │           │
└─────────┴──────────────┴──────────────────────────────────┴────────────┘
│ 最后同步：2025-10-13 00:28:43  更新事件3个  ☁️iCloud 📧Outlook 📧Google    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## 🎨 设计系统规格

### 1. 颜色系统

```css
/* 主题色 */
--primary-gradient: linear-gradient(to right, #a855f7, #3b82f6);
--primary-purple: #a855f7;
--primary-blue: #3b82f6;

/* 背景色 */
--bg-gray-100: #f3f4f6;
--bg-white: #ffffff;
--bg-white-opacity-80: rgba(255, 255, 255, 0.8);
--bg-white-opacity-30: rgba(255, 255, 255, 0.3);

/* 文字色 */
--text-gray-900: #111827;
--text-gray-800: #1f2937;
--text-gray-700: #374151;
--text-gray-600: #4b5563;
--text-gray-500: #6b7075;
--text-gray-400: #9ca3af;
--text-gray-300: #d1d5db;
--text-gray-200: #e5e7eb;
--text-white: #ffffff;

/* 标签色 */
--tag-work: #a855f7;         /* #👜工作 */
--tag-document: #3b82f6;     /* #🧐文档编辑 */
--tag-client-tencent: #fb923c; /* #🧐腾讯 */
--tag-code: #10b981;         /* #🔮码代码 */
--tag-prd: #3b82f6;          /* #🔮PRD文档 */
--tag-dev: #a855f7;          /* #🔮Remarkable开发 */

/* 状态色 */
--status-success: #10b981;
--status-warning: #f59e0b;
--status-error: #ef4444;
--status-info: #3b82f6;

/* 边框色 */
--border-gray-100: #f3f4f6;
--border-gray-200: #e5e7eb;
--border-gray-200-opacity-50: rgba(229, 231, 235, 0.5);
```

### 2. 字体系统

```css
/* 字体家族 */
--font-sans: 'Inter', 'Microsoft YaHei', 'Noto Sans SC', 'Noto Sans JP', sans-serif;
--font-mono: 'Roboto Mono', 'Consolas', monospace;

/* 字号 */
--text-xs: 10px;    /* 时间标记 */
--text-sm: 12px;    /* 次要文字、标签 */
--text-base: 14px;  /* 正文 */
--text-lg: 16px;    /* 次级标题 */
--text-xl: 18px;    /* 主标题 */
--text-2xl: 30px;   /* Logo */
--text-3xl: 36px;   /* 日期大号 */

/* 字重 */
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;

/* 行高 */
--leading-tight: 1.25;
--leading-normal: 1.5;
--leading-relaxed: 1.75;
```

### 3. 间距系统

```css
/* Spacing Scale (8px 基准) */
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
--space-12: 48px;
--space-16: 64px;
--space-20: 80px;

/* 组件内边距 */
--padding-card: 20px;
--padding-panel: 20px;
--padding-button: 8px 16px;
```

### 4. 圆角系统

```css
--radius-sm: 2px;    /* 标签 */
--radius-md: 5px;    /* 日历日期 */
--radius-lg: 8px;    /* 按钮 */
--radius-xl: 10px;   /* 事件卡片 */
--radius-2xl: 12px;  /* 导航按钮 */
--radius-3xl: 20px;  /* 主面板 */
--radius-full: 9999px; /* 圆形头像、进度条 */
```

### 5. 阴影系统

```css
/* Elevation Shadows */
--shadow-sm: 0px 1px 2px 0px rgba(0, 0, 0, 0.05);
--shadow-md: 0px 4px 6px 0px rgba(0, 0, 0, 0.1), 
             0px 10px 15px 0px rgba(0, 0, 0, 0.1);
--shadow-lg: 0px 10px 10px 32px rgba(0, 0, 0, 0.1);
--shadow-xl: -1px 2px 10px 0px rgba(156, 163, 175, 0.12),
              1px 1px 5px 0px rgba(0, 0, 0, 0.05);

/* Inner Shadow */
--shadow-inset: inset 1px 1px 2px 0px #ffffff;

/* Card Shadow */
--shadow-card: 0px 4px 10px rgba(0, 0, 0, 0.25);
```

---

## 📏 组件规格

### 事件卡片 (Event Card)

**尺寸**:
- 宽度: 100% (容器宽度 - 40px padding)
- 高度: 自适应 (最小 188px)
- 外边距: 12px bottom
- 内边距: 20px
- 边框: 1px solid rgba(229, 231, 235, 0.5)
- 圆角: 10px

**布局结构**:
```tsx
<div className="event-card">
  <div className="event-time-range">
    {/* 10:00 ━━━━━━━━━ 12:00 */}
    <span>10:00</span>
    <div className="time-arrow">━━━━━</div>
    <span>12:00</span>
    <span className="duration-badge">2h30min</span>
  </div>
  
  <div className="event-header">
    <span className="emoji">🎙️</span>
    <h3>议程讨论</h3>
    <span className="sync-indicator">☁️</span>
  </div>
  
  <div className="event-tags">
    <span className="tag work">#👜工作</span>
    <span className="tag doc">#🧐文档编辑</span>
  </div>
  
  <div className="event-meta">
    <div className="attendees">👥 Zoey Gong; Jenny Wong; Cindy Cai</div>
    <div className="location">📍 静安嘉里中心2座F38，RM工作室，5号会议室</div>
  </div>
  
  <div className="event-description">
    太强了！居然直接成稿了，那现在就只要做些检查了...
  </div>
  
  <div className="event-footer">
    <span className="timestamp">2025-10-19 10:21:18</span>
    <div className="actions">
      <button>⭐</button>
      <button>⚙️</button>
      <button>⏱️</button>
      <button>➕</button>
    </div>
  </div>
</div>
```

### 内容选取面板 (Content Selection Panel)

**尺寸**:
- 宽度: 342px
- 高度: 845px
- 背景: white
- 圆角: 20px
- 阴影: 0px 4px 10px rgba(0, 0, 0, 0.25)

**组件结构**:
```tsx
<div className="content-selection-panel">
  <div className="panel-header">
    <h2>内容选取</h2>
    <button className="hide-btn">👁️</button>
  </div>
  
  <div className="search-box">
    <input placeholder="输入"去年今天"、"上周专注"试试" />
  </div>
  
  <div className="calendar-widget">
    {/* 月份日历 */}
  </div>
  
  <div className="filter-tabs">
    <button className="active">标签</button>
    <button>事项</button>
    <button>收藏</button>
    <button>New</button>
  </div>
  
  <div className="tag-list">
    <div className="tag-item">
      <span className="visibility">👁️</span>
      <span className="tag-name">#🔮Remarkable开发</span>
      <div className="progress-bar">
        <div className="filled" style="width: 43%"></div>
      </div>
      <span className="stats">3/7</span>
      <span className="time">12h</span>
      <button className="expand">▼</button>
    </div>
    {/* 子标签（展开时显示） */}
    <div className="tag-children">
      <div className="tag-item sub">
        <span>#🔮PRD文档</span>
        <div className="progress-bar"><div style="width: 30%"></div></div>
        <span>3/7</span>
        <span>6h</span>
      </div>
      <div className="tag-item sub">
        <span>#🔮码代码</span>
        <div className="progress-bar"><div style="width: 15%"></div></div>
        <span>3/7</span>
        <span>3h</span>
      </div>
    </div>
  </div>
  
  <button className="show-all">显示全部</button>
</div>
```

### 右侧浮动按钮 (Floating Action Buttons)

**尺寸**:
- 宽度: 80px (含标签文字)
- 每个按钮: 48x48px
- 间距: 12px vertical
- 圆角: 10px
- 背景: rgba(255, 255, 255, 0.3)
- 玻璃态: blur(15px)

**组件结构**:
```tsx
<div className="right-fab-container">
  <div className="fab-item">
    <button className="fab-button">
      <span className="icon">⊕</span>
    </button>
    <span className="fab-label">记录此刻</span>
  </div>
  
  <div className="fab-item">
    <button className="fab-button">
      <span className="icon">🎤</span>
    </button>
    <span className="fab-label">语音记录</span>
  </div>
  
  {/* ... 其他按钮 */}
</div>
```

---

## 🔄 GoldenLayout 集成方案

### 默认布局配置

```typescript
export const DEFAULT_TIMELOG_LAYOUT: LayoutConfig = {
  settings: {
    showPopoutIcon: true,       // 显示弹出图标
    showMaximiseIcon: true,     // 显示最大化图标
    showCloseIcon: true,        // 显示关闭图标（内容选取面板可关闭）
    constrainDragToContainer: false, // 允许拖拽到外部创建弹窗
  },
  dimensions: {
    borderWidth: 5,
    minItemHeight: 200,
    minItemWidth: 300,
    headerHeight: 32,
    dragProxyWidth: 300,
    dragProxyHeight: 200,
  },
  content: [{
    type: 'row',
    content: [
      // 左侧：内容选取面板（可拖拽、可关闭）
      {
        type: 'component',
        componentName: 'contentSelectionPanel',
        componentState: {
          defaultView: 'tags', // 默认显示标签视图
        },
        title: '内容选取',
        isClosable: true,
        width: 25.45, // 342 / 1344 ≈ 25.45%
      },
      
      // 右侧：时光日志主区域（标签容器）
      {
        type: 'stack',
        isClosable: false,
        activeItemIndex: 0,
        content: [{
          type: 'component',
          componentName: 'timelineView',
          componentState: {
            date: new Date().toISOString().split('T')[0],
            viewMode: 'daily', // daily | weekly | monthly
          },
          title: '时光日志',
          isClosable: false, // 主视图不可关闭
        }],
        width: 67.33, // 905 / 1344 ≈ 67.33%
      }
    ]
  }]
};
```

### 交互行为映射

| 用户操作 | 触发事件 | GoldenLayout 行为 | 视觉反馈 |
|---------|---------|------------------|---------|
| 单击事件卡片 | `openTimeLogTab` | 在主 stack 中打开新标签或激活已有标签 | 标签高亮、内容切换 |
| 双击事件卡片 | `openEventPopup` | 创建独立弹出窗口 | 新窗口动画弹出 |
| 拖拽内容选取面板标题 | GoldenLayout 内置 | 面板变为浮动窗口 | 半透明拖拽预览 |
| 点击"×"关闭内容选取 | GoldenLayout 内置 | 面板关闭，主区域扩展 | 平滑展开动画 |
| 拖拽标签到边缘 | GoldenLayout 内置 | 创建分屏布局 | 蓝色占位区域显示 |
| 拖拽标签到外部 | GoldenLayout 内置 | 创建浏览器新窗口 | 弹窗打开 |
| Ctrl+S | 自定义快捷键 | 保存当前标签内容 | Toast 提示"保存成功" |
| 标签内容变化 | Slate onChange | 标签标题添加"●"标记 | 实时显示未保存状态 |

### 状态管理

```typescript
// src/pages/TimeLog/store/timelogStore.ts
import create from 'zustand';
import { persist } from 'zustand/middleware';

interface TimeLogStore {
  // 布局状态
  layout: LayoutConfig | null;
  setLayout: (layout: LayoutConfig) => void;
  
  // 打开的标签
  openTabs: Array<{
    id: string;
    eventId: string;
    title: string;
    isDirty: boolean;
  }>;
  addTab: (tab: any) => void;
  removeTab: (tabId: string) => void;
  markTabDirty: (tabId: string, isDirty: boolean) => void;
  
  // 视图状态
  isPanelVisible: boolean;
  togglePanel: () => void;
  
  // 过滤器状态
  activeFilter: 'tags' | 'tasks' | 'favorites' | 'new';
  setActiveFilter: (filter: string) => void;
}

export const useTimeLogStore = create<TimeLogStore>()(
  persist(
    (set) => ({
      layout: null,
      setLayout: (layout) => set({ layout }),
      
      openTabs: [],
      addTab: (tab) => set((state) => ({
        openTabs: [...state.openTabs, { ...tab, isDirty: false }]
      })),
      removeTab: (tabId) => set((state) => ({
        openTabs: state.openTabs.filter(t => t.id !== tabId)
      })),
      markTabDirty: (tabId, isDirty) => set((state) => ({
        openTabs: state.openTabs.map(t => 
          t.id === tabId ? { ...t, isDirty } : t
        )
      })),
      
      isPanelVisible: true,
      togglePanel: () => set((state) => ({ isPanelVisible: !state.isPanelVisible })),
      
      activeFilter: 'tags',
      setActiveFilter: (filter) => set({ activeFilter: filter as any }),
    }),
    {
      name: 'timelog-store',
      partialize: (state) => ({
        layout: state.layout,
        isPanelVisible: state.isPanelVisible,
        activeFilter: state.activeFilter,
      }),
    }
  )
);
```

---

## 🚀 实施步骤

### Step 1: 准备 CSS 变量（1 天）

```bash
# 创建设计系统文件
touch src/styles/design-system.css
touch src/pages/TimeLog/TimeLog.css
```

将上述颜色、字体、间距等规格定义为 CSS 变量。

### Step 2: 实现固定布局（2 天）

不使用 GoldenLayout，先实现 Figma 的固定 3 列布局：
- Left Sidebar (96px)
- Content Selection Panel (342px)
- Main Timeline (905px)
- Right FAB (80px, absolute positioned)

### Step 3: GoldenLayout 集成（3 天）

按照 `GOLDENLAYOUT_IMPLEMENTATION_PLAN.md` 的 Phase 1 计划：
1. 安装 golden-layout@2.6.0
2. 创建 GoldenLayoutWrapper
3. 注册 contentSelectionPanel 和 timelineView 组件
4. 配置默认布局

### Step 4: 交互实现（4 天）

1. 事件卡片点击/双击逻辑
2. 标签页打开/切换/关闭
3. 拖拽创建分屏
4. 弹出窗口
5. 布局持久化

### Step 5: 样式调优（2 天）

1. GoldenLayout 主题覆盖（匹配 Figma 设计）
2. 动画和过渡效果
3. 响应式适配

---

## ✅ 验收标准

- [ ] 视觉 100% 还原 Figma 设计（允许 ±2px 误差）
- [ ] 内容选取面板可拖拽成浮动窗口
- [ ] 单击事件卡片打开标签，双击打开弹窗
- [ ] 支持最多 10 个标签同时打开
- [ ] 拖拽标签创建分屏视图
- [ ] 拖拽标签到外部创建独立窗口
- [ ] 标签关闭前提示保存未保存内容
- [ ] 布局配置持久化（刷新后恢复）
- [ ] 60fps 流畅拖拽（Chrome DevTools Performance 验证）
- [ ] 无内存泄漏（10 分钟压测后 Heap Size 增长 <5MB）

---

## 📚 参考资源

- [GoldenLayout v2 文档](https://golden-layout.github.io/golden-layout/)
- [React 18 createRoot API](https://react.dev/reference/react-dom/client/createRoot)
- [Slate.js 编辑器](https://docs.slatejs.org/)
- [Figma 设计规范导出](https://www.figma.com/community/plugin/731176732337510831)
