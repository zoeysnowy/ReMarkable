# TimeHoverCard 组件

时间悬浮卡片组件，用于显示事件的完整日期信息、倒计时状态和修改按钮。

## 功能特性

- 📅 显示完整日期（如"2025年11月11日 星期一"）
- ⏱️ 显示倒计时或已过期状态
- ✏️ 提供修改按钮快速编辑
- 🎨 根据状态显示不同颜色（未来事件渐变色，过期事件红色）

## 使用方法

### 基础用法

```tsx
import TimeHoverCard from '../TimeHoverCard/TimeHoverCard';
import { calculateFixedPopupPosition } from '../../utils/popupPositionUtils';

const [showHoverCard, setShowHoverCard] = useState(false);
const [hoverCardPosition, setHoverCardPosition] = useState({ top: 0, left: 0 });

const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  
  // 🔑 使用位置计算工具，确保不超出窗口边界
  const position = calculateFixedPopupPosition(rect, {
    width: 300,  // TimeHoverCard 的宽度
    height: 100  // TimeHoverCard 的估计高度
  });
  
  setHoverCardPosition(position);
  setShowHoverCard(true);
};

const handleMouseLeave = () => {
  setShowHoverCard(false);
};

// 渲染
{showHoverCard && (
  <TimeHoverCard
    startTime={item.startTime}
    endTime={item.endTime}
    dueDate={item.dueDate}
    isAllDay={item.isAllDay}
    onEditClick={handleEdit}
    style={{
      position: 'fixed',
      top: hoverCardPosition.top,
      left: hoverCardPosition.left,
      zIndex: 1000,
    }}
  />
)}
```

### 带延迟显示

```tsx
const hoverTimerRef = useRef<number | null>(null);

const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
  const rect = e.currentTarget.getBoundingClientRect();
  const position = calculateFixedPopupPosition(rect, {
    width: 300,
    height: 100
  });
  setHoverCardPosition(position);
  
  // 延迟 500ms 显示
  hoverTimerRef.current = window.setTimeout(() => {
    setShowHoverCard(true);
  }, 500);
};

const handleMouseLeave = () => {
  if (hoverTimerRef.current !== null) {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }
  // 延迟关闭，给用户时间移动到悬浮卡片
  setTimeout(() => {
    setShowHoverCard(false);
  }, 200);
};

// 悬浮卡片的鼠标事件
const handleCardMouseEnter = () => {
  if (hoverTimerRef.current !== null) {
    window.clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  }
};

const handleCardMouseLeave = () => {
  setShowHoverCard(false);
};
```

## Props

| 属性 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `startTime` | `string \| null` | 否 | 开始时间（ISO 字符串） |
| `endTime` | `string \| null` | 否 | 结束时间（ISO 字符串） |
| `dueDate` | `string \| null` | 否 | 截止日期（ISO 字符串） |
| `isAllDay` | `boolean` | 否 | 是否全天事件 |
| `onEditClick` | `(e?: React.MouseEvent) => void` | 否 | 修改按钮点击回调 |
| `style` | `React.CSSProperties` | 否 | 自定义样式（通常用于定位） |
| `onMouseEnter` | `() => void` | 否 | 鼠标进入回调 |
| `onMouseLeave` | `() => void` | 否 | 鼠标离开回调 |

## 样式定制

TimeHoverCard 使用 CSS 模块样式，可以通过以下 CSS 变量定制：

```css
.time-hover-card {
  /* 卡片基础样式 */
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  padding: 12px 16px;
  min-width: 200px;
}

.time-hover-card__countdown {
  /* 倒计时样式（渐变色） */
  background: linear-gradient(135deg, #22d3ee, #3b82f6);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.time-hover-card__countdown--overdue {
  /* 已过期样式（红色） */
  background: #ef4444;
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
```

## 注意事项

### 位置计算

⚠️ **务必使用 `calculateFixedPopupPosition` 或 `calculatePopupPosition` 来计算位置**

```tsx
// ❌ 错误示例 - 可能超出窗口边界
setHoverCardPosition({
  top: rect.bottom + 8,
  left: rect.left,
});

// ✅ 正确示例 - 自动处理边界
const position = calculateFixedPopupPosition(rect, {
  width: 300,
  height: 100
});
setHoverCardPosition(position);
```

### 尺寸估算

TimeHoverCard 的实际高度取决于内容：
- 仅日期：约 60px
- 日期 + 倒计时：约 90px
- 日期 + 倒计时 + 修改按钮：约 100px

建议传入 `height: 100` 以覆盖最大高度情况。

### 清理定时器

使用延迟显示时，务必在组件卸载时清理定时器：

```tsx
useEffect(() => {
  return () => {
    if (hoverTimerRef.current !== null) {
      window.clearTimeout(hoverTimerRef.current);
    }
  };
}, []);
```

## 参考

- 设计稿：Figma 节点 323-840, 323-951, 323-959
- 相关组件：`DateMentionElement`, `PlanManager`
- 工具函数：`relativeDateFormatter.ts`, `popupPositionUtils.ts`
