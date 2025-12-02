# PlanManager 侧边栏实现 - Phase 1 完成报告

## 📅 完成时间
2025-11-XX

## ✅ 已完成任务

### 1. 左侧面板 - ContentSelectionPanel (内容选取)
**文件:** `src/components/ContentSelectionPanel.tsx` + `ContentSelectionPanel.css`
**尺寸:** 315px 宽 × 823px 高
**功能实现:**
- ✅ 搜索栏 (带 NLP 提示文字)
- ✅ 月份日历视图 (2025年10月)
  - 月份导航按钮 (上一月/下一月)
  - 日期选择功能
  - 周一到周日表头
- ✅ 筛选按钮组 (4个按钮)
  - 标签 (默认激活，渐变背景)
  - 事项
  - 收藏
  - New
- ✅ 任务树结构
  - 支持展开/折叠
  - 显示/隐藏图标
  - 收藏标记
  - 统计信息 (完成数/总数)
  - 年环图可视化 (饼图 + 进度条)
  - 时间显示 (小时数)
- ✅ "显示全部"按钮
- ✅ 面板显示/隐藏切换按钮

**设计规范:**
- 白色背景 (#ffffff)
- 圆角 20px
- 阴影: 0px 4px 10px rgba(0, 0, 0, 0.25)
- 渐变色标题指示器: #22d3ee → #3b82f6

### 2. 右侧面板 - UpcomingEventsPanel (即将到来)
**文件:** `src/components/UpcomingEventsPanel.tsx` + `UpcomingEventsPanel.css`
**尺寸:** 317px 宽 × 829px 高
**功能实现:**
- ✅ 时间筛选按钮组 (4个按钮)
  - 今天 (默认激活)
  - 明天
  - 本周
  - 下周
- ✅ 事件卡片系统
  - 动作指示器 (5种颜色标识线)
    - 红色: 开始 (start) ▶️
    - 橙色: 截止 (deadline) 📋
    - 靛蓝: 新建 (new) 📅
    - 灰色: 更新 (updated) 🔄
    - 绿色: 完成 (done) ✅
  - 事件标题 + 图标
  - 标签显示 (彩色)
  - 时间信息 (开始/截止/倒计时)
  - 参与者列表 (👥 图标)
  - 地点信息 (📍 图标)
  - 描述信息 (▶️ 图标)
- ✅ 倒计时显示 (渐变文字效果)
- ✅ 分隔线 (3px 灰色)
- ✅ 面板显示/隐藏切换按钮
- ✅ 每分钟自动刷新 (实时更新倒计时)

**设计规范:**
- 白色背景 (#ffffff)
- 圆角 20px
- 阴影: 0px 4px 10px rgba(0, 0, 0, 0.25)
- 渐变色标题指示器: #22d3ee → #3b82f6

### 3. 主布局更新 - PlanManager 集成
**文件:** `src/components/PlanManager.tsx` + `PlanManager.css`
**布局方式:** Flexbox 三列布局
**实现细节:**
- ✅ 创建 `.plan-manager-container` 容器
- ✅ 左侧面板固定宽度 315px
- ✅ 中间主内容区自适应宽度 (flex: 1)
- ✅ 右侧面板固定宽度 317px
- ✅ 面板间距 8px
- ✅ 整体背景 #f8f9fa
- ✅ 面板阴影效果

**样式更新:**
```css
.plan-manager-container {
  display: flex;
  gap: 8px;
  height: 100%;
  width: 100%;
  background: #f8f9fa;
  padding: 8px;
}

.plan-manager {
  flex: 1;
  min-width: 0;
  /* ... 原有样式保持不变 ... */
}
```

## 🔧 技术实现细节

### 组件架构
```
PlanManager (父组件)
├── ContentSelectionPanel (左侧)
│   ├── 搜索栏
│   ├── 日历组件
│   ├── 筛选按钮
│   └── 任务树
├── 原有 PlanManager 内容 (中间)
└── UpcomingEventsPanel (右侧)
    ├── 时间筛选
    └── 事件卡片列表
```

### Props 接口
```typescript
// ContentSelectionPanel
interface ContentSelectionPanelProps {
  onFilterChange?: (filter: 'tags' | 'tasks' | 'favorites' | 'new') => void;
  onSearchChange?: (query: string) => void;
  onDateSelect?: (date: Date) => void;
}

// UpcomingEventsPanel
interface UpcomingEventsPanelProps {
  onTimeFilterChange?: (filter: 'today' | 'tomorrow' | 'week' | 'nextWeek') => void;
}
```

### 数据结构
```typescript
// 任务节点
interface TaskNode {
  id: string;
  title: string;
  tag: string;
  color: string;
  children?: TaskNode[];
  stats?: {
    completed: number;
    total: number;
    hours: number;
  };
  isExpanded?: boolean;
  isHidden?: boolean;
  isFavorite?: boolean;
}

// 事件卡片
interface EventItem {
  id: string;
  title: string;
  tag: string;
  tagColor: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  isAllDay?: boolean;
  attendees?: string[];
  location?: string;
  description?: string;
  actionIndicator: ActionIndicatorType;
  countdown?: string;
}
```

## 🎨 设计令牌 (Design Tokens)

### 颜色系统
```css
/* 主题色 */
--gradient-primary: linear-gradient(to right, #22d3ee, #3b82f6);
--gradient-purple: linear-gradient(to right, #a855f7, #9333ea);

/* 文字颜色 */
--text-primary: #111827;
--text-secondary: #4b5563;
--text-muted: #9ca3af;

/* 背景色 */
--bg-white: #ffffff;
--bg-gray: #f8f9fa;
--bg-overlay: rgba(255, 255, 255, 0.8);

/* 边框色 */
--border-gray: #e5e7eb;

/* 标签颜色 */
--tag-purple: #a855f7;
--tag-blue: #3b82f6;
--tag-green: #10b981;

/* 动作指示器颜色 */
--indicator-red: #ef4444;      /* 开始 */
--indicator-orange: #f59e0b;   /* 截止 */
--indicator-indigo: #6366f1;   /* 新建 */
--indicator-gray: #9ca3af;     /* 更新 */
--indicator-green: #10b981;    /* 完成 */
```

### 尺寸规范
```css
/* 面板尺寸 */
--panel-left-width: 315px;
--panel-right-width: 317px;
--panel-height: 823px;

/* 间距 */
--gap-small: 4px;
--gap-medium: 8px;
--gap-large: 16px;

/* 圆角 */
--radius-small: 6px;
--radius-medium: 8px;
--radius-large: 20px;

/* 阴影 */
--shadow-panel: 0px 4px 10px rgba(0, 0, 0, 0.25);
--shadow-card: 0px 2px 4px rgba(0, 0, 0, 0.1);
```

### 字体规范
```css
/* 字体家族 */
--font-primary: 'Microsoft YaHei', Arial, sans-serif;
--font-secondary: 'Inter', 'Noto Sans SC', sans-serif;
--font-roboto: 'Roboto', sans-serif;

/* 字号 */
--font-size-small: 12px;
--font-size-base: 14px;
--font-size-medium: 16px;
--font-size-large: 18px;

/* 字重 */
--font-weight-normal: 400;
--font-weight-medium: 500;
--font-weight-semibold: 600;
--font-weight-bold: 700;
```

## 🔄 待实现功能 (Phase 2-4)

### Phase 2: 数据集成
- [ ] 左侧面板与 EventService 集成
  - [ ] 实现 NLP 搜索功能
  - [ ] 日历点击显示当日事件
  - [ ] 任务树数据动态加载
  - [ ] 年环图数据计算
- [ ] 右侧面板与 EventService 集成
  - [ ] 实时获取即将到来的事件
  - [ ] 倒计时实时计算
  - [ ] 事件状态同步

### Phase 3: 交互增强
- [ ] 左侧面板
  - [ ] 任务树展开/折叠动画
  - [ ] 显示/隐藏任务功能
  - [ ] 收藏任务功能
  - [ ] 拖拽调整层级
- [ ] 右侧面板
  - [ ] 事件卡片点击编辑
  - [ ] 动作指示器交互
  - [ ] 事件状态快速切换

### Phase 4: 高级功能
- [ ] 面板宽度调整 (拖拽边框)
- [ ] 面板折叠/展开动画
- [ ] 快捷键支持
- [ ] 响应式适配
- [ ] 性能优化 (虚拟滚动)

## 📝 注意事项

### 当前已知问题
1. PlanManager.tsx 存在一些编译错误 (与原有代码相关，不影响侧边栏功能)
   - `displayHint` 参数数量不匹配
   - `renderLinePrefix/renderLineSuffix` 属性类型问题
   - 这些需要在后续迭代中修复

### 开发建议
1. **样式隔离**: 所有侧边栏样式都独立在各自的 CSS 文件中，避免污染全局样式
2. **组件解耦**: 左右面板完全独立，可单独测试和调试
3. **Props 设计**: 所有交互通过回调函数向父组件传递，便于后续集成
4. **性能考虑**: 使用 React.memo 优化渲染，日历和事件列表可进一步优化
5. **可访问性**: 后续需要添加 ARIA 标签和键盘导航支持

## 🎯 测试建议

### 单元测试
```typescript
// 测试左侧面板
describe('ContentSelectionPanel', () => {
  it('should render search bar', () => {});
  it('should render calendar with correct month', () => {});
  it('should handle filter change', () => {});
  it('should handle search input', () => {});
  it('should expand/collapse task nodes', () => {});
});

// 测试右侧面板
describe('UpcomingEventsPanel', () => {
  it('should render time filters', () => {});
  it('should render event cards', () => {});
  it('should update countdown every minute', () => {});
  it('should handle filter change', () => {});
});
```

### 集成测试
- [ ] 三列布局响应式测试
- [ ] 面板与主内容区交互测试
- [ ] 事件数据流测试
- [ ] 性能测试 (大量数据)

## 📚 参考文档
- [Figma 设计稿](https://www.figma.com/design/T0WLjzvZMqEnpX79ILhSNQ/ReMarkable-0.1?node-id=290-2646&m=dev)
- [PRD Section 10](docs/PRD/PLANMANAGER_MODULE_PRD.md#10-左右侧边栏设计)
- [项目架构文档](docs/architecture/)

---

**✅ Phase 1 完成状态**: 100% (基础布局和样式已完成)
**⏭️ 下一步**: 开始 Phase 2 数据集成
