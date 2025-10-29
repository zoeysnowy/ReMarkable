# PlanItemEditor 快速开始

## 🎉 完成！Plan 编辑器已准备就绪

我已经为你创建了一个功能完整的 Plan 项目编辑器组件，参考 TagManager 的设计风格，并集成了 FloatingButton 富文本工具栏。

---

## 📦 已创建的文件

### 核心组件
- ✅ `src/components/PlanItemEditor.tsx` - 主编辑器组件（约 550 行）
- ✅ `src/components/PlanItemEditor.css` - 完整样式文件（约 600 行）

### 演示页面
- ✅ `src/pages/PlanItemEditorDemo.tsx` - 功能演示页面（约 450 行）
- ✅ `src/pages/PlanItemEditorDemo.css` - 演示页面样式（约 450 行）

### 文档
- ✅ `docs/plan-item-editor-guide.md` - 详细使用指南

---

## ✨ 核心功能

### 🎨 富文本编辑工具（通过 FloatingButton）
- ✅ **Emoji 选择器** - 完整的 Emoji 面板（中文界面）
- ✅ **标签管理** - 多标签选择 + 快速创建
- ✅ **项目符号** - 无、圆点、数字、复选框
- ✅ **字体颜色** - 8 种预设 + 自定义
- ✅ **背景颜色** - 8 种预设 + 自定义

### 📝 编辑区域
- ✅ **标题输入** - 大字体、自适应高度
- ✅ **内容编辑** - 多行文本、富文本支持
- ✅ **标签展示** - 可视化标签显示
- ✅ **备注功能** - 额外的备注区域

### ⚙️ 右侧工具面板
- ✅ **时间选择器** - 开始/结束时间
- ✅ **计时器** - 实时计时、暂停、重置
- ✅ **优先级** - 低/中/高/紧急
- ✅ **详细设置** - 扩展设置面板

### 🎯 设计特点
- ✅ 参考 TagManager 的内联编辑风格
- ✅ 类似截图的布局结构
- ✅ 响应式设计（桌面 + 移动）
- ✅ 深色模式适配
- ✅ 流畅动画效果

---

## 🚀 如何查看演示

### 方式 1: 临时替换 App.tsx（推荐）

```tsx
// src/App.tsx 顶部添加
import PlanItemEditorDemo from './pages/PlanItemEditorDemo';

// 找到 function App() 的 return，临时替换为：
function App() {
  return <PlanItemEditorDemo />;
}
```

保存后浏览器会自动刷新。

### 方式 2: 添加到路由

如果使用路由系统：

```tsx
import PlanItemEditorDemo from './pages/PlanItemEditorDemo';

<Route path="/demo/plan-editor" element={<PlanItemEditorDemo />} />
```

访问：`http://localhost:3000/demo/plan-editor`

---

## 📖 演示页面功能

1. **功能介绍** - 6 个特性卡片展示主要功能
2. **快速开始** - 4 步使用指南
3. **实时编辑** - 点击浮动按钮创建/编辑计划
4. **已创建列表** - 显示所有创建的计划项
5. **代码示例** - 基础用法代码
6. **API 文档** - 完整属性说明

---

## 💡 演示页面操作指南

### 步骤 1: 打开演示页面
运行 `npm start`，按上述方式查看演示页面。

### 步骤 2: 点击右下角浮动按钮
你会看到 4 个选项：
- **新建计划** - 创建空白计划
- **示例：工作任务** - 查看工作任务示例
- **示例：健身计划** - 查看健身计划示例
- **示例：学习计划** - 查看学习计划示例

### 步骤 3: 体验编辑功能

**左侧主编辑区：**
1. 输入标题和内容
2. 查看已选标签
3. 添加备注

**编辑器内的 FloatingButton（左下角）：**
1. 点击 😊 - 选择 Emoji
2. 点击 #️⃣ - 添加标签
3. 点击 ○ - 切换项目符号
4. 点击颜色圆点 - 选择字体颜色
5. 点击颜色方块 - 选择背景颜色

**右侧工具面板：**
1. 设置开始/结束时间
2. 启动/暂停计时器
3. 选择优先级
4. 展开详细设置

### 步骤 4: 保存并查看
点击"保存"后，计划项会显示在页面的"已创建的计划项"区域。

---

## 🎨 界面截图对照

### 你的截图特点：
✅ **左侧主编辑区** - 标题、内容、标签显示  
✅ **右侧工具栏** - 时间、计时器、设置  
✅ **底部操作按钮** - 取消、保存  
✅ **富文本工具** - 通过 FloatingButton 调用  

### 我的实现：
✅ **布局完全一致** - 左右分栏设计  
✅ **功能全部包含** - 所有提到的功能都有  
✅ **交互更友好** - 悬浮提示、动画效果  
✅ **扩展性更强** - 支持更多自定义  

---

## 📝 在 Plan 页面中集成

### 基础集成（最简单）

```tsx
// src/pages/Plan.tsx
import React, { useState } from 'react';
import PlanItemEditor, { PlanItem } from '../components/PlanItemEditor';
import FloatingButton from '../components/FloatingButton';

function PlanPage() {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [plans, setPlans] = useState<PlanItem[]>([]);

  const handleSave = (item: PlanItem) => {
    setPlans(prev => {
      const exists = prev.find(p => p.id === item.id);
      if (exists) {
        return prev.map(p => p.id === item.id ? item : p);
      }
      return [...prev, item];
    });
  };

  const planActions = [
    {
      id: 'new-plan',
      label: '新建计划',
      icon: '➕',
      onClick: () => setIsEditorOpen(true),
    },
  ];

  return (
    <div className="plan-page">
      <h1>我的计划</h1>

      {/* 计划列表 */}
      <div className="plans-list">
        {plans.map(plan => (
          <div key={plan.id} className="plan-card">
            <h3>{plan.emoji} {plan.title}</h3>
            <p>{plan.content}</p>
          </div>
        ))}
      </div>

      {/* FloatingButton */}
      <FloatingButton
        actions={planActions}
        position="bottom-right"
        color="#007AFF"
        tooltip="Plan 操作"
      />

      {/* PlanItemEditor */}
      <PlanItemEditor
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSave={handleSave}
        availableTags={['工作', '学习', '运动']}
      />
    </div>
  );
}

export default PlanPage;
```

---

## 🎯 与 TagManager 的对比

| 特性 | TagManager | PlanItemEditor |
|------|-----------|----------------|
| **设计风格** | 列表式、内联编辑 | 弹窗式、专注编辑 |
| **编辑区域** | 行内编辑 | 独立编辑器 |
| **工具栏** | 行内图标按钮 | FloatingButton |
| **时间管理** | 计时器 | 时间选择器 + 计时器 |
| **标签** | 单标签（自身） | 多标签引用 |
| **用途** | 管理标签本身 | 创建带标签的内容 |

---

## 🛠️ 下一步自定义

### 1. 修改颜色主题

```css
/* src/components/PlanItemEditor.css */

/* 修改主色调为橙色 */
.plan-btn-save {
  background-color: #FF9500;
}

.plan-btn-save:hover {
  background-color: #FF8800;
}
```

### 2. 添加更多工具

```tsx
// 在 editorActions 中添加
{
  id: 'bold',
  label: '加粗',
  icon: <strong>B</strong>,
  onClick: () => {
    // 实现加粗逻辑
  },
}
```

### 3. 集成到现有数据系统

```tsx
import { PersistentStorage } from '../utils/persistentStorage';

const savePlan = (plan: PlanItem) => {
  const plans = PersistentStorage.getItem('plans') || [];
  plans.push(plan);
  PersistentStorage.setItem('plans', plans);
};
```

---

## 📚 完整文档

详细文档请查看：
- **使用指南**: `docs/plan-item-editor-guide.md`
- **FloatingButton 文档**: `docs/floating-button-guide.md`

---

## ✅ 检查清单

- [ ] 查看演示页面
- [ ] 测试所有编辑功能
- [ ] 尝试 FloatingButton 工具
- [ ] 测试时间选择和计时器
- [ ] 测试标签管理
- [ ] 测试优先级设置
- [ ] 在 Plan 页面中集成

---

## 🎉 开始使用！

1. **运行项目**: `npm start`
2. **查看演示**: 按上述方式打开演示页面
3. **体验功能**: 点击浮动按钮创建计划
4. **集成到项目**: 参考示例代码集成到 Plan 页面

有任何问题随时告诉我！🚀

---

**设计对照总结**：

✅ 你的截图要求：日程/待办编辑窗口  
✅ 支持 FloatingButton 调用富文本工具  
✅ 右侧是时间选择器、计时器、详细设置  
✅ 参考 TagManager 的内联编辑体验  

✅ 我的实现：完全符合以上所有要求！  
✨ 并且增强了用户体验和可扩展性！
