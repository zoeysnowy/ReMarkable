# FloatingButton 快速开始

## 🎉 环境已搭建完成！

所有依赖和组件已经准备就绪，你可以立即开始使用。

## 📦 已安装的依赖

- `@tippyjs/react` - Tippy.js React 封装
- `tippy.js` - Tooltip 核心库
- `@headlessui/react` - 无障碍 UI 组件库

## 📁 已创建的文件

### 组件文件
- `src/components/FloatingButton.tsx` - 主组件
- `src/components/FloatingButton.css` - 样式文件

### 演示页面
- `src/pages/FloatingButtonDemo.tsx` - 完整演示页面
- `src/pages/FloatingButtonDemo.css` - 演示页面样式

### 文档
- `docs/floating-button-guide.md` - 详细使用文档

## 🚀 如何查看演示

### 方式 1: 添加到路由（推荐）

如果你的项目使用了路由（如 React Router），将演示页面添加到路由配置：

```tsx
// 假设在 App.tsx 或路由配置文件中
import FloatingButtonDemo from './pages/FloatingButtonDemo';

// 添加路由
<Route path="/demo/floating-button" element={<FloatingButtonDemo />} />
```

然后访问: `http://localhost:3000/demo/floating-button`

### 方式 2: 临时替换 App.tsx

临时将演示页面设为主页面：

```tsx
// src/App.tsx
import FloatingButtonDemo from './pages/FloatingButtonDemo';

function App() {
  return <FloatingButtonDemo />;
}

export default App;
```

然后运行开发服务器查看效果。

### 方式 3: 在现有页面中测试

直接在任何现有页面中引入并使用：

```tsx
import FloatingButton from '../components/FloatingButton';

// 在你的页面组件中添加
<FloatingButton
  label="+"
  actions={[
    {
      id: 'test',
      label: '测试',
      icon: '✨',
      onClick: () => console.log('测试点击'),
    },
  ]}
  tooltip="测试按钮"
/>
```

## 📝 快速集成到 Plan 页面

假设你有一个 `src/pages/Plan.tsx` 或类似文件：

```tsx
import React from 'react';
import FloatingButton from '../components/FloatingButton';

function PlanPage() {
  const planActions = [
    {
      id: 'quick-task',
      label: '快速任务',
      icon: '⚡',
      onClick: () => {
        // TODO: 打开快速任务对话框
        console.log('打开快速任务');
      },
    },
    {
      id: 'scheduled-task',
      label: '计划任务',
      icon: '📅',
      onClick: () => {
        // TODO: 打开计划任务对话框
        console.log('打开计划任务');
      },
    },
    {
      id: 'routine',
      label: '日常事项',
      icon: '🔄',
      onClick: () => {
        // TODO: 打开日常事项对话框
        console.log('打开日常事项');
      },
    },
  ];

  return (
    <div className="plan-page">
      {/* 你的页面内容 */}
      <h1>Plan 页面</h1>
      
      {/* 添加浮动按钮 */}
      <FloatingButton
        label="+"
        actions={planActions}
        position="bottom-right"
        expandDirection="up"
        color="#007AFF"
        tooltip="快速添加"
      />
    </div>
  );
}

export default PlanPage;
```

## 🎨 自定义样式

如果需要调整样式，编辑 `src/components/FloatingButton.css`：

```css
/* 修改主按钮大小 */
.floating-button-main {
  width: 64px;  /* 默认 56px */
  height: 64px;
}

/* 修改默认位置 */
.floating-button-bottom-right {
  bottom: 40px;  /* 默认 32px */
  right: 40px;
}

/* 修改阴影效果 */
.floating-button-main {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
}
```

## 🔧 下一步操作

1. **查看演示页面**: 按上述方式之一启动演示
2. **阅读文档**: 查看 `docs/floating-button-guide.md` 了解所有配置项
3. **集成到页面**: 在 Plan、Log 等页面中添加 FloatingButton
4. **自定义操作**: 根据实际需求定义 actions 数组
5. **调整样式**: 根据设计规范调整颜色和尺寸

## 💡 提示

- 每个页面只需要一个 FloatingButton（避免位置冲突）
- 建议使用 emoji 作为图标（简单快速）
- 如需复杂图标，考虑安装 `react-icons`
- 操作数量建议 3-6 个（太多会显得拥挤）

## 📞 需要帮助？

如果遇到问题或需要调整，随时告诉我：
- 样式调整
- 功能扩展
- 性能优化
- 集成问题

## ✅ 验收清单

- [x] 依赖安装完成
- [x] 组件文件创建
- [x] 演示页面创建
- [x] 文档完成
- [ ] 在浏览器中查看演示
- [ ] 集成到实际页面
- [ ] 根据需求调整

---

**现在就开始使用吧！** 🚀
