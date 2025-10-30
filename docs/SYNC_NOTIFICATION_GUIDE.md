# 同步通知组件集成指南

## 快速开始

### 1. 在 App.tsx 中导入并使用组件

```tsx
import { SyncNotification } from './components/SyncNotification';

function App() {
  // ... 你的现有代码 ...

  return (
    <div className="App">
      {/* 你的现有组件 */}
      
      {/* 🔧 添加同步通知组件 */}
      <SyncNotification />
    </div>
  );
}
```

就这么简单！组件会自动监听同步事件并显示通知。

## 功能说明

### 自动监听的事件

1. **同步失败通知** (`syncFailure`)
   - 事件名称
   - 重试次数
   - 失败原因
   - 自动在10秒后消失

2. **网络状态通知** (`networkStatusChanged`)
   - 网络断开/恢复提示
   - 自动在5秒后消失

### 通知类型

- ✅ **success** (绿色) - 网络恢复等成功状态
- ⚠️ **warning** (黄色) - 同步失败、网络断开等警告
- ❌ **error** (红色) - 严重错误
- ℹ️ **info** (蓝色) - 一般信息

## 自定义样式

如果需要调整样式，修改 `SyncNotification.css`：

```css
/* 修改位置 */
.sync-notifications-container {
  top: 20px;  /* 距离顶部 */
  right: 20px; /* 距离右侧 */
}

/* 修改最大宽度 */
.sync-notification {
  max-width: 400px;
}

/* 修改颜色 */
.sync-notification-warning {
  border-left-color: #your-color;
}
```

## 测试通知

在浏览器控制台中运行以下代码测试通知：

```javascript
// 测试同步失败通知
window.dispatchEvent(new CustomEvent('syncFailure', {
  detail: {
    eventTitle: '测试事件',
    retryCount: 3,
    error: '网络连接失败',
    timestamp: new Date()
  }
}));

// 测试网络状态通知
window.dispatchEvent(new CustomEvent('networkStatusChanged', {
  detail: {
    status: 'offline',
    message: '⚠️ 网络已断开，本地操作将在联网后自动同步'
  }
}));
```

## 高级定制

### 修改自动关闭时间

在 `SyncNotification.tsx` 中找到：

```tsx
// 同步失败通知 - 10秒后关闭
setTimeout(() => {
  setNotifications(prev => prev.filter(n => n.id !== notification.id));
}, 10000); // 改为你想要的时间（毫秒）

// 网络状态通知 - 5秒后关闭
setTimeout(() => {
  setNotifications(prev => prev.filter(n => n.id !== notification.id));
}, 5000); // 改为你想要的时间（毫秒）
```

### 添加声音提示

```tsx
const playNotificationSound = (type: string) => {
  const audio = new Audio('/notification.mp3');
  audio.play().catch(err => console.log('音频播放失败:', err));
};

// 在handleSyncFailure中添加：
playNotificationSound('warning');
```

### 限制最大通知数量

```tsx
setNotifications(prev => {
  const updated = [...prev, notification];
  // 只保留最新的5条通知
  return updated.slice(-5);
});
```

## 与现有通知系统集成

如果你已经有通知系统，可以改为触发你的通知：

```tsx
useEffect(() => {
  const handleSyncFailure = (event: Event) => {
    const { eventTitle, retryCount, error } = (event as CustomEvent).detail;
    
    // 使用你现有的通知系统
    yourNotificationService.show({
      type: 'warning',
      title: '事件同步失败',
      message: `事件"${eventTitle}"同步失败（已重试${retryCount}次）\n原因：${error}`
    });
  };

  window.addEventListener('syncFailure', handleSyncFailure);
  return () => window.removeEventListener('syncFailure', handleSyncFailure);
}, []);
```

## 故障排查

### 通知不显示

1. 检查组件是否已添加到 App.tsx
2. 检查 CSS 文件是否正确导入
3. 在控制台检查是否有错误
4. 使用测试代码验证事件是否正确触发

### z-index 冲突

如果通知被其他元素遮挡，修改 CSS：

```css
.sync-notifications-container {
  z-index: 10000; /* 增加这个值 */
}
```

### 移动端显示问题

通知组件已包含响应式设计，会自动适配移动端。如需进一步调整：

```css
@media (max-width: 768px) {
  .sync-notification {
    font-size: 12px; /* 调整字体大小 */
    padding: 12px; /* 调整内边距 */
  }
}
```

## 完整的事件数据结构

### syncFailure 事件

```typescript
{
  actionId: string;      // Action的唯一ID
  actionType: string;    // 'create' | 'update' | 'delete'
  entityId: string;      // 事件的ID
  eventTitle: string;    // 事件标题
  retryCount: number;    // 重试次数
  error: string;         // 错误信息
  timestamp: Date;       // 发生时间
}
```

### networkStatusChanged 事件

```typescript
{
  status: 'online' | 'offline';  // 网络状态
  message: string;                // 提示消息
}
```

## 总结

这个通知组件：
- ✅ 零配置自动工作
- ✅ 样式美观，支持深色模式
- ✅ 响应式设计，移动端友好
- ✅ 可自定义和扩展
- ✅ 不影响现有功能

只需导入组件即可使用，用户将获得清晰的同步状态反馈！
