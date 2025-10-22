# Widget 拖动和UI优化修复

## 修复日期
2025-10-22

## 问题描述

### 1. 拖动功能丢失
桌面Widget无法拖动和调整大小，用户无法移动窗口位置或改变窗口尺寸。

### 2. 设置菜单过宽
设置面板宽度为280px，占用空间过大，需要缩小到约2/3宽度。

### 3. 菜单项间距过大
外观设置、显示设置、预览效果三个区域之间的margin仍然过大，需要完全移除。

## 修复方案

### 1. 恢复拖动和调整大小功能

**问题根源**: 
- 主容器缺少 `onMouseDown={handleDragStart}` 事件处理
- 控制栏的 `onMouseDown={(e) => e.stopPropagation()}` 完全阻止了拖动

**解决方案**:

#### 1.1 添加主容器拖动支持
```typescript
// 行 295: 主容器添加拖动事件
<div
  ref={widgetRef}
  style={{...}}
  onMouseDown={handleDragStart}  // ← 添加此行
  onMouseEnter={() => setShowControls(true)}
  onMouseLeave={() => setShowControls(false)}
>
```

#### 1.2 控制栏支持拖动
```typescript
// 行 318: 控制栏改为支持拖动
<div
  style={{
    ...
    cursor: 'move'  // ← 添加移动光标
  }}
  onMouseDown={handleDragStart}  // ← 从 stopPropagation 改为支持拖动
>
```

#### 1.3 控制栏内按钮阻止拖动
为所有控制栏按钮添加 `onMouseDown={(e) => e.stopPropagation()}`，防止点击按钮时触发拖动：

```typescript
// 视图切换按钮（月/周/日）
<button
  onClick={() => setCurrentView(view)}
  onMouseDown={(e) => e.stopPropagation()}  // ← 添加
  ...
/>

// 快速创建事件按钮
<button
  onClick={...}
  onMouseDown={(e) => e.stopPropagation()}  // ← 添加
  ...
/>

// 锁定切换按钮
<button
  onClick={() => setIsLocked(!isLocked)}
  onMouseDown={(e) => e.stopPropagation()}  // ← 添加
  ...
/>

// 设置按钮
<button
  onMouseDown={(e) => e.stopPropagation()}  // ← 添加
  ...
/>
```

#### 1.4 移除日历区域的干扰
```typescript
// 行 670: 移除阻止控制栏显示的事件
<div
  style={{...}}
  // onMouseEnter={() => setShowControls(false)}  ← 移除此行
>
```

**效果**:
- ✅ 可以通过控制栏拖动窗口
- ✅ 可以通过日历区域拖动窗口
- ✅ 点击控制栏按钮不会触发拖动
- ✅ 设置面板不会触发拖动
- ✅ 调整大小功能正常工作

### 2. 调整设置菜单宽度

**修改文件**: `src/components/DesktopCalendarWidget.tsx`

**变更内容**:
```typescript
// 行 430: 设置面板宽度
width: '190px',  // 从 '280px' 改为 '190px' (约2/3)
```

**效果**:
- 设置面板宽度从 280px 缩减到 190px
- 节省约 32% 的横向空间
- 更加紧凑，不遮挡日历内容

### 3. 移除菜单项间距

**修改文件**: `src/components/DesktopCalendarWidget.tsx`

**变更内容**:
```typescript
// 外观设置区域
<div style={{ marginBottom: '0' }}>  // 从 '12px' 改为 '0'
  <h4 style={{ margin: '0 0 8px 0', ... }}>🎨 外观设置</h4>
  ...
</div>

// 显示设置区域
<div style={{ marginBottom: '0' }}>  // 从 '12px' 改为 '0'
  <h4 style={{ margin: '0 0 8px 0', ... }}>👁️ 显示设置</h4>
  ...
</div>

// 预览效果区域（保持原有间距，与操作按钮分隔）
<div style={{ marginBottom: '12px' }}>
  <h4 style={{ margin: '0 0 8px 0', ... }}>👀 预览效果</h4>
  ...
</div>
```

**效果**:
- 外观设置和显示设置紧密相连
- 显示设置和预览效果紧密相连
- 整体更加紧凑，信息密度更高
- 保持预览效果与操作按钮之间的分隔，维持清晰的层次

## 技术细节

### 拖动机制说明
1. **主容器** (`widgetRef`) 负责捕获所有 `mousedown` 事件
2. **控制栏** 作为拖动手柄，光标显示为 `move`
3. **交互元素** (按钮、输入框) 使用 `stopPropagation()` 阻止拖动
4. **设置面板** 完全阻止事件传播，避免意外拖动

### 事件传播流程
```
用户点击位置
  ↓
[是按钮/输入框?] → Yes → stopPropagation() → 执行对应操作
  ↓ No
[是设置面板?] → Yes → stopPropagation() → 滚动/交互
  ↓ No
传播到主容器 → 触发 handleDragStart → 开始拖动
```

## 影响范围
- 仅影响 `DesktopCalendarWidget.tsx` 组件
- 不影响其他页面或组件
- 向后兼容，不影响现有功能

## 测试建议
1. **拖动测试**
   - ✓ 从控制栏拖动窗口
   - ✓ 从日历空白区域拖动窗口
   - ✓ 点击控制栏按钮不触发拖动
   - ✓ 在设置面板内操作不触发拖动

2. **大小调整测试**
   - ✓ 拖动右下角调整大小手柄
   - ✓ 最小尺寸限制（400x300）
   - ✓ 边界限制（不超出屏幕）

3. **UI测试**
   - ✓ 设置面板宽度合适（190px）
   - ✓ 三个菜单区域紧密相连
   - ✓ 预览效果与操作按钮有适当间距

4. **锁定功能测试**
   - ✓ 锁定后无法拖动
   - ✓ 锁定后无法调整大小
   - ✓ 解锁后功能恢复

## 相关文件
- `src/components/DesktopCalendarWidget.tsx` - 主要修改文件
- `docs/widget-ui-consistency-fix.md` - 之前的UI一致性修复文档
