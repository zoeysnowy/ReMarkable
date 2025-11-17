/**
 * 参会人功能快速测试指南
 * 
 * 如果鼠标悬浮和点击没有反应，请按以下步骤排查：
 */

## 问题排查清单

### 1. 检查浏览器控制台是否有错误
打开浏览器开发者工具（F12），查看 Console 是否有红色错误信息

常见错误：
- 模块导入失败
- 图标文件找不到
- 类型错误

### 2. 验证组件是否正确渲染

在浏览器中检查 DOM 结构：

**预期结构**：
```html
<div class="attendee-display">
  <img src="..." class="attendee-icon" />
  <div class="attendee-list">
    <span class="attendee-name organizer has-email">Zoey Gong</span>
    <span class="attendee-name has-email">Jenny Wong</span>
    <span class="attendee-name has-email">Cindy Cai</span>
  </div>
</div>
```

### 3. 检查 CSS 是否加载

在开发者工具的 Elements 面板，选中参会人元素，查看 Styles 面板是否有：
- `.attendee-name { cursor: pointer; }`
- `.attendee-name:hover { color: #1890ff; }`

### 4. 测试点击功能

**点击参会人名字**应该：
1. 显示搜索下拉框
2. 输入框自动聚焦
3. 可以输入文字搜索

**如果没有反应**：
- 检查 `onClick` 事件是否被其他元素拦截
- 查看控制台是否有 JavaScript 错误

### 5. 测试悬浮功能

**鼠标悬浮在参会人名字上 1 秒**应该：
1. 显示悬浮卡片
2. 卡片显示联系人详细信息

**如果没有显示**：
- Tippy.js 可能未正确加载
- 检查是否有 CSS z-index 冲突
- 查看控制台是否有错误

### 6. 检查数据是否正确传递

在 EventEditModalV2Demo.tsx 中添加 console.log：

```typescript
<AttendeeDisplay
  event={formData as any}
  currentUserEmail="current.user@company.com"
  onChange={(attendees, organizer) => {
    console.log('[Debug] Attendees changed:', { attendees, organizer });
    setFormData(prev => ({
      ...prev,
      attendees,
      organizer,
    }));
  }}
/>
```

点击参会人后应该看到控制台输出。

## 常见问题修复

### 问题 1: 点击没有反应

**原因**：可能被其他 CSS 覆盖了 pointer-events

**解决**：在 AttendeeDisplay.css 中添加：
```css
.attendee-name {
  pointer-events: auto !important;
}
```

### 问题 2: 悬浮卡片不显示

**原因**：Tippy 容器被其他元素覆盖

**解决**：检查 z-index，确保 Tippy 容器在最上层：
```css
.tippy-box {
  z-index: 9999 !important;
}
```

### 问题 3: 搜索下拉框被遮挡

**原因**：父容器 overflow 设置导致

**解决**：检查 EventEditModalV2Demo.css，确保：
```css
.eventmodal-v2-plan-section {
  overflow: visible; /* 不是 overflow: hidden */
}
```

### 问题 4: 图标不显示

**原因**：SVG 导入路径错误

**解决**：已修复为 `Attendee.svg`（大写）

## 调试模式

在 AttendeeDisplay.tsx 中添加调试输出：

```typescript
const handleOpenSearch = (index: number) => {
  console.log('[AttendeeDisplay] Opening search for index:', index);
  console.log('[AttendeeDisplay] Current participants:', participants);
  setSearchMode(true);
  // ... 其他代码
};
```

## 快速验证步骤

1. **刷新页面**（Ctrl+Shift+R 强制刷新）
2. **打开控制台**（F12）
3. **检查是否有红色错误**
4. **点击任意参会人名字**
5. **检查控制台是否有 "[AttendeeDisplay] Opening search" 输出**
6. **如果有输出但没有 UI 变化，是 CSS 问题**
7. **如果没有输出，是事件绑定问题**

## 最简单的验证方法

在浏览器控制台执行：

```javascript
// 检查组件是否渲染
document.querySelector('.attendee-display')

// 检查参会人元素
document.querySelectorAll('.attendee-name')

// 手动触发点击（测试事件绑定）
document.querySelector('.attendee-name').click()
```

如果返回 `null`，说明组件没有渲染。
如果有元素但点击无效，说明事件处理有问题。
