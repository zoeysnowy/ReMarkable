# 组件开发规范

## Figma 设计转 React 组件开发流程

### 1. 设计分析阶段

#### 1.1 获取设计元数据
```typescript
// 使用 MCP Figma 工具获取设计结构
mcp_figma_get_metadata({
  fileKey: "T0WLjzvZMqEnpX79ILhSNQ",
  nodeId: "82:487", // 从 URL 提取
  clientFrameworks: "react",
  clientLanguages: "typescript,javascript,html,css"
})
```

#### 1.2 获取设计代码
```typescript
// 获取可实现的代码
mcp_figma_get_code({
  fileKey: "T0WLjzvZMqEnpX79ILhSNQ", 
  nodeId: "82:487",
  clientFrameworks: "react",
  clientLanguages: "typescript,javascript,html,css"
})
```

#### 1.3 获取设计截图
```typescript
// 获取视觉参考
mcp_figma_get_screenshot({
  fileKey: "T0WLjzvZMqEnpX79ILhSNQ",
  nodeId: "82:487",
  clientFrameworks: "react", 
  clientLanguages: "typescript,javascript,html,css"
})
```

### 2. 代码转换规范

#### 2.1 Tailwind CSS 转换为项目 CSS

**Tailwind 类名映射表:**

| Tailwind | 项目 CSS | 描述 |
|----------|----------|------|
| `absolute` | `position: absolute` | 绝对定位 |
| `bg-white` | `background-color: white` | 白色背景 |
| `rounded-[20px]` | `border-radius: 20px` | 圆角 |
| `shadow-[5px_5px_10px_0px_rgba(0,0,0,0.05)]` | `box-shadow: 5px 5px 10px rgba(0,0,0,0.05)` | 阴影 |
| `text-[20px]` | `font-size: 20px` | 字体大小 |
| `font-['Istok_Web:Regular']` | `font-family: 'Istok Web', sans-serif; font-weight: 400` | 字体 |
| `leading-[16px]` | `line-height: 16px` | 行高 |
| `text-blue-500` | `color: #3b82f6` | 蓝色文本 |
| `left-[158px]` | `left: 158px` | 左侧定位 |
| `top-[333px]` | `top: 333px` | 顶部定位 |
| `size-[30px]` | `width: 30px; height: 30px` | 尺寸 |
| `inset-[20%_20%_16%_16%]` | `top: 20%; right: 20%; bottom: 16%; left: 16%` | 内边距定位 |

#### 2.2 组件结构转换

**Figma 生成的代码结构:**
```tsx
// Figma 输出 (Tailwind + 绝对定位)
export default function TagSettingCard() {
  return (
    <div className="contents relative size-full">
      <div className="absolute bg-white h-[853px] left-[105px] rounded-[20px]" />
      <p className="absolute font-['Istok_Web:Regular'] text-[20px] left-[571px] top-[328px]">
        Outlook: 工作
      </p>
    </div>
  );
}
```

**转换为项目规范:**
```tsx
// 项目规范 (语义化 + CSS Grid/Flexbox + CSS 变量)
interface TagSettingCardProps {
  tags: HierarchicalTag[];
  onTagSelect: (tag: HierarchicalTag) => void;
  onTagEdit: (tag: HierarchicalTag) => void;
}

const TagSettingCard: React.FC<TagSettingCardProps> = ({ 
  tags, 
  onTagSelect, 
  onTagEdit 
}) => {
  return (
    <div className="tag-setting-card">
      <div className="tag-setting-content">
        <div className="tag-hierarchy-section">
          {tags.map(tag => (
            <TagNode 
              key={tag.id}
              tag={tag}
              onSelect={onTagSelect}
              onEdit={onTagEdit}
            />
          ))}
        </div>
        <div className="calendar-mapping-section">
          {/* 日历映射显示 */}
        </div>
        <div className="statistics-section">
          {/* 统计信息显示 */}
        </div>
      </div>
    </div>
  );
};
```

#### 2.3 CSS 样式转换

**从绝对定位转换为布局:**
```css
/* Figma 输出样式 */
.figma-container {
  position: absolute;
  background: white;
  height: 853px;
  left: 105px;
  border-radius: 20px;
  box-shadow: 5px 5px 10px rgba(0,0,0,0.05);
  top: 122px;
  width: 1041px;
}

/* 转换为项目规范 */
.tag-setting-card {
  background: var(--surface);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-md);
  width: 100%;
  max-width: 1041px;
  min-height: 853px;
  margin: 0 auto;
  display: flex;
  flex-direction: column;
}

.tag-setting-content {
  padding: var(--spacing-xl);
  display: grid;
  grid-template-columns: 1fr 200px 150px;
  gap: var(--spacing-lg);
  align-items: start;
}
```

### 3. 组件开发模板

#### 3.1 基础组件模板
```tsx
import React, { useState, useCallback } from 'react';
import './ComponentName.css';

interface ComponentNameProps {
  // 必需属性
  data: any[];
  onAction: (item: any) => void;
  
  // 可选属性  
  className?: string;
  disabled?: boolean;
  loading?: boolean;
}

const ComponentName: React.FC<ComponentNameProps> = ({
  data,
  onAction,
  className = '',
  disabled = false,
  loading = false
}) => {
  // 状态管理
  const [localState, setLocalState] = useState<any>(null);
  
  // 事件处理
  const handleAction = useCallback((item: any) => {
    if (disabled || loading) return;
    onAction(item);
  }, [onAction, disabled, loading]);
  
  // 渲染
  return (
    <div className={`component-name ${className}`}>
      {loading ? (
        <div className="loading-state">加载中...</div>
      ) : (
        <div className="content">
          {data.map(item => (
            <div 
              key={item.id}
              className="item"
              onClick={() => handleAction(item)}
            >
              {item.name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComponentName;
```

#### 3.2 CSS 样式模板
```css
/* 组件根样式 */
.component-name {
  /* 布局 */
  display: flex;
  flex-direction: column;
  
  /* 尺寸 */
  width: 100%;
  min-height: 200px;
  
  /* 外观 */
  background: var(--surface);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);
  
  /* 间距 */
  padding: var(--spacing-lg);
  gap: var(--spacing-md);
  
  /* 过渡 */
  transition: all 0.2s ease;
}

/* 状态样式 */
.component-name:hover {
  box-shadow: var(--shadow-md);
}

.component-name.disabled {
  opacity: 0.6;
  pointer-events: none;
}

/* 子元素样式 */
.component-name .content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm);
}

.component-name .item {
  padding: var(--spacing-sm);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.component-name .item:hover {
  background-color: var(--background-hover);
}

/* 加载状态 */
.component-name .loading-state {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100px;
  color: var(--text-secondary);
}

/* 响应式设计 */
@media (max-width: 768px) {
  .component-name {
    padding: var(--spacing-md);
  }
}
```

### 4. 开发检查清单

#### 4.1 设计还原检查
- [ ] 布局结构与设计完全一致
- [ ] 颜色使用项目色彩变量
- [ ] 字体大小和行高匹配设计
- [ ] 间距符合设计规范
- [ ] 圆角和阴影效果正确
- [ ] 交互状态完整实现

#### 4.2 代码质量检查
- [ ] TypeScript 类型定义完整
- [ ] 组件接口设计合理
- [ ] 状态管理清晰
- [ ] 事件处理正确
- [ ] 性能优化到位
- [ ] 错误边界处理

#### 4.3 功能测试检查
- [ ] 基本功能正常
- [ ] 边界情况处理
- [ ] 交互反馈正确
- [ ] 加载状态显示
- [ ] 错误状态处理
- [ ] 响应式适配

### 5. 常见问题和解决方案

#### 5.1 绝对定位转换问题
**问题**: Figma 使用绝对定位，不适合响应式布局
**解决**: 转换为 Grid/Flexbox 布局

```css
/* 避免 */
.item {
  position: absolute;
  left: 158px;
  top: 333px;
}

/* 推荐 */
.container {
  display: grid;
  grid-template-columns: 158px 1fr;
  grid-template-rows: 333px 1fr;
}

.item {
  grid-column: 2;
  grid-row: 2;
}
```

#### 5.2 Tailwind 类名转换
**问题**: 大量 Tailwind 类名需要转换
**解决**: 使用 CSS 变量和语义化类名

```css
/* CSS 变量定义 */
:root {
  --text-xl: 20px;
  --color-blue-500: #3b82f6;
  --spacing-lg: 24px;
}

/* 语义化类名 */
.tag-title {
  font-size: var(--text-xl);
  color: var(--color-blue-500);
  margin-bottom: var(--spacing-lg);
}
```

#### 5.3 图标处理
**问题**: Figma 图标转换为 React 组件
**解决**: 创建独立的图标组件

```tsx
// 图标组件封装
interface IconProps {
  className?: string;
  size?: number;
}

const RecycleIcon: React.FC<IconProps> = ({ className, size = 24 }) => (
  <div className={`icon-recycle ${className}`} style={{ width: size, height: size }}>
    <img src="/icons/recycle.svg" alt="回收" />
  </div>
);
```

---

*更新时间: 2025-10-13*