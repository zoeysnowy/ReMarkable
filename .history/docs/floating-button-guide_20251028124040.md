# FloatingButton 组件开发指南

## 概述

`FloatingButton` 是一个基于 Tippy.js 和 Headless UI 构建的浮动操作按钮组件，适用于 Plan、Log 等页面的快速操作入口。

## 技术栈

- **Tippy.js (@tippyjs/react)**: 用于实现 Tooltip 提示
- **Headless UI (@headlessui/react)**: 用于实现可访问的下拉菜单逻辑
- **React 19**: 组件框架
- **TypeScript**: 类型安全

## 组件特性

### ✨ 核心功能

- ✅ 可配置的主按钮（图标/文本）
- ✅ 多个子操作按钮
- ✅ 4 个位置选项（四个角落）
- ✅ 4 个展开方向（上/下/左/右）
- ✅ Tooltip 提示支持
- ✅ 自定义颜色
- ✅ 禁用状态
- ✅ 响应式设计
- ✅ 深色模式适配
- ✅ 无障碍访问支持

### 📦 组件 API

```typescript
interface FloatingButtonProps {
  // 主按钮的图标（React 节点）
  icon?: React.ReactNode;
  
  // 主按钮的文本（如果没有图标）
  label?: string;
  
  // 子操作列表
  actions: FloatingButtonAction[];
  
  // 主按钮的位置
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  
  // 主按钮的颜色
  color?: string;
  
  // 是否禁用
  disabled?: boolean;
  
  // 展开方向
  expandDirection?: 'up' | 'down' | 'left' | 'right';
  
  // 自定义 className
  className?: string;
  
  // Tooltip 提示文本
  tooltip?: string;
}

interface FloatingButtonAction {
  // 唯一标识
  id: string;
  
  // 操作名称
  label: string;
  
  // 操作图标
  icon?: React.ReactNode;
  
  // 点击回调
  onClick: () => void;
  
  // 操作按钮颜色（可选，默认继承主按钮颜色）
  color?: string;
  
  // 是否禁用
  disabled?: boolean;
}
```

## 使用示例

### 基础用法

```tsx
import FloatingButton from '../components/FloatingButton';

function MyPage() {
  const actions = [
    {
      id: 'add-task',
      label: '添加任务',
      icon: <TaskIcon />,
      onClick: () => console.log('添加任务'),
    },
    {
      id: 'add-event',
      label: '添加事件',
      icon: <EventIcon />,
      onClick: () => console.log('添加事件'),
    },
    {
      id: 'add-note',
      label: '添加笔记',
      icon: <NoteIcon />,
      onClick: () => console.log('添加笔记'),
    },
  ];

  return (
    <div>
      {/* 页面内容 */}
      <FloatingButton
        icon={<PlusIcon />}
        actions={actions}
        tooltip="快速添加"
      />
    </div>
  );
}
```

### 自定义位置和方向

```tsx
<FloatingButton
  icon={<PlusIcon />}
  actions={actions}
  position="bottom-left"
  expandDirection="up"
  tooltip="操作菜单"
/>
```

### 自定义颜色

```tsx
<FloatingButton
  icon={<PlusIcon />}
  actions={[
    {
      id: 'urgent',
      label: '紧急任务',
      icon: <AlertIcon />,
      onClick: () => {},
      color: '#FF3B30', // 红色
    },
    {
      id: 'normal',
      label: '普通任务',
      icon: <TaskIcon />,
      onClick: () => {},
      color: '#34C759', // 绿色
    },
  ]}
  color="#007AFF" // 主按钮蓝色
/>
```

### Plan 页面示例

```tsx
// src/pages/Plan.tsx
import FloatingButton from '../components/FloatingButton';

function PlanPage() {
  const planActions = [
    {
      id: 'quick-task',
      label: '快速任务',
      icon: '⚡',
      onClick: () => {
        // 打开快速任务对话框
      },
    },
    {
      id: 'scheduled-task',
      label: '计划任务',
      icon: '📅',
      onClick: () => {
        // 打开计划任务对话框
      },
    },
    {
      id: 'routine',
      label: '日常事项',
      icon: '🔄',
      onClick: () => {
        // 打开日常事项对话框
      },
    },
    {
      id: 'goal',
      label: '目标',
      icon: '🎯',
      onClick: () => {
        // 打开目标对话框
      },
    },
  ];

  return (
    <div className="plan-page">
      {/* Plan 页面内容 */}
      
      <FloatingButton
        label="+"
        actions={planActions}
        position="bottom-right"
        expandDirection="up"
        color="#007AFF"
        tooltip="添加计划项"
      />
    </div>
  );
}
```

### Log 页面示例

```tsx
// src/pages/Log.tsx
import FloatingButton from '../components/FloatingButton';

function LogPage() {
  const logActions = [
    {
      id: 'time-entry',
      label: '记录时间',
      icon: '⏱️',
      onClick: () => {
        // 打开时间记录对话框
      },
    },
    {
      id: 'journal',
      label: '日志',
      icon: '📝',
      onClick: () => {
        // 打开日志对话框
      },
    },
    {
      id: 'mood',
      label: '心情',
      icon: '😊',
      onClick: () => {
        // 打开心情记录对话框
      },
    },
    {
      id: 'photo',
      label: '照片',
      icon: '📷',
      onClick: () => {
        // 打开照片上传对话框
      },
    },
  ];

  return (
    <div className="log-page">
      {/* Log 页面内容 */}
      
      <FloatingButton
        label="+"
        actions={logActions}
        position="bottom-right"
        expandDirection="up"
        color="#FF9500"
        tooltip="快速记录"
      />
    </div>
  );
}
```

## 协作开发方案

### 阶段一：环境搭建 ✅

**负责人**: AI Assistant  
**任务**:
- [x] 安装依赖包 (@tippyjs/react, @headlessui/react)
- [x] 创建基础组件结构
- [x] 创建组件样式文件
- [x] 创建开发文档

**输出**:
- `src/components/FloatingButton.tsx`
- `src/components/FloatingButton.css`
- `docs/floating-button-guide.md`

### 阶段二：集成到具体页面 🔄

**负责人**: 开发者（你）  
**任务**:
1. 在需要的页面（如 Plan、Log）中引入 FloatingButton 组件
2. 根据页面需求定义具体的 actions 配置
3. 设计每个 action 对应的图标（可以使用 emoji 或图标库）
4. 实现每个 action 的 onClick 处理逻辑

**建议步骤**:
```bash
# 1. 先在一个页面试用
# 2. 根据实际效果调整参数
# 3. 复制到其他页面并调整
```

### 阶段三：功能迭代 🔄

**协作方式**: 根据实际使用反馈进行优化

**可能的优化方向**:
- 添加动画效果变体
- 支持拖拽定位
- 添加键盘快捷键
- 支持更多展开样式
- 添加数量徽章显示

**反馈流程**:
1. 你在实际页面中使用组件
2. 发现问题或新需求
3. 向我描述具体需求
4. 我进行针对性优化

### 阶段四：样式定制 🎨

**协作方式**: 根据设计规范调整

如果需要调整样式以匹配项目设计：
- 修改 `FloatingButton.css` 中的颜色、尺寸、阴影等
- 或者提供设计稿，我帮你适配

## 图标选择建议

### 方案 1: 使用 Emoji（最简单）

```tsx
icon: '➕'
icon: '📝'
icon: '⏰'
```

### 方案 2: 使用 React Icons

```bash
npm install react-icons --legacy-peer-deps
```

```tsx
import { FiPlus, FiEdit, FiClock } from 'react-icons/fi';

icon: <FiPlus />
```

### 方案 3: 使用 SVG 图标

```tsx
icon: (
  <svg width="24" height="24" viewBox="0 0 24 24">
    <path d="M12 5v14m7-7H5" stroke="currentColor" strokeWidth="2" />
  </svg>
)
```

## 性能优化建议

1. **操作回调使用 useCallback**
```tsx
const handleAddTask = useCallback(() => {
  // 处理逻辑
}, [dependencies]);
```

2. **actions 数组使用 useMemo**
```tsx
const actions = useMemo(() => [
  { id: 'task', label: '任务', onClick: handleAddTask },
  // ...
], [handleAddTask]);
```

3. **大量图标考虑懒加载**

## 可访问性说明

组件已内置无障碍支持：
- ✅ 键盘导航（Tab, Enter, Escape）
- ✅ ARIA 标签
- ✅ 焦点管理
- ✅ 屏幕阅读器友好

## 浏览器兼容性

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

## 故障排除

### 问题 1: 按钮不显示

检查是否正确导入了 CSS 文件：
```tsx
import './FloatingButton.css';
```

### 问题 2: Tooltip 不显示

确保导入了 Tippy.js 样式：
```tsx
import 'tippy.js/dist/tippy.css';
```

### 问题 3: 点击无反应

检查 onClick 回调是否正确绑定：
```tsx
onClick: () => console.log('clicked') // ✅
onClick: console.log('clicked')       // ❌
```

## 下一步行动

1. **立即可做**:
   - 在 Plan 页面添加 FloatingButton
   - 定义 4-6 个常用操作
   - 测试各种位置和方向

2. **后续优化**:
   - 根据用户反馈调整样式
   - 添加更多自定义选项
   - 考虑添加手势支持（移动端）

3. **文档完善**:
   - 截图展示各种配置效果
   - 录制使用演示视频
   - 补充常见问题解答

## 联系方式

如有问题或建议，请随时提出！我会持续优化这个组件。

---

**版本**: v1.0.0  
**最后更新**: 2025-10-28  
**维护者**: Zoey Gong & AI Assistant
