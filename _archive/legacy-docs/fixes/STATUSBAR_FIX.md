# StatusBar 定位修复说明

## 问题描述
StatusBar 在窗口大小变化时可能会看不见或定位不正确。

## 解决方案

### 修改文件：`src/components/AppLayout.css`

#### 1. StatusBar 固定定位
将 StatusBar 从相对定位改为固定定位，确保它始终在视口底部：

```css
.app-statusbar {
  position: fixed; /* 使用 fixed 定位 */
  bottom: 0;       /* 固定在底部 */
  left: 0;         /* 从左边开始 */
  right: 0;        /* 到右边结束 */
  z-index: 1000;   /* 确保在其他元素上方 */
  width: 100%;     /* 占满宽度 */
}
```

#### 2. 主内容区域底部留白
为主内容区域添加底部内边距，为固定的 StatusBar 留出空间：

```css
.app-main {
  padding-bottom: 41px; /* 默认屏幕：与 statusbar 高度一致 */
}

/* 平板和小屏幕 */
@media (max-width: 768px) {
  .app-main {
    padding-bottom: 32px;
  }
}

/* 手机屏幕 */
@media (max-width: 480px) {
  .app-main {
    padding-bottom: 28px;
  }
}
```

#### 3. 布局容器优化
为布局容器添加相对定位和最小高度：

```css
.app-layout {
  position: relative;
  min-height: 100vh;
}
```

## 效果

✅ **StatusBar 始终固定在窗口底部**
✅ **窗口缩放时不会丢失 StatusBar**
✅ **滚动内容时 StatusBar 保持可见**
✅ **响应式设计：适配各种屏幕尺寸**

## 测试建议

1. **窗口缩放测试**：
   - 缩小窗口到最小尺寸
   - 放大窗口到全屏
   - 检查 StatusBar 是否始终可见

2. **内容滚动测试**：
   - 在主内容区域滚动到底部
   - 检查 StatusBar 是否被遮挡

3. **响应式测试**：
   - 测试不同屏幕尺寸（1920px, 768px, 480px）
   - 检查 StatusBar 高度和位置是否正确

## 注意事项

- StatusBar 现在使用 `position: fixed`，不再参与 Grid 布局流
- 主内容区域的 `padding-bottom` 必须与 StatusBar 高度一致
- z-index 设置为 1000，确保在大多数元素上方
