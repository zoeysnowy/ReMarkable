# 文本颜色和背景颜色功能

## 功能概述

为 TextFloatingBar（文本浮动工具栏）添加了文本颜色和背景颜色选择器，支持快速为选中文本设置颜色。

## 实现细节

### 新增组件

1. **TextColorPicker** (`src/components/FloatingToolbar/pickers/TextColorPicker.tsx`)
   - 9种预设颜色选项
   - 3列网格布局
   - 键盘导航支持（方向键 + Enter）
   - 数字快捷键 1-9 快速选择

2. **BackgroundColorPicker** (`src/components/FloatingToolbar/pickers/BackgroundColorPicker.tsx`)
   - 8种预设颜色 + 无背景选项
   - 3列网格布局
   - 键盘导航支持（方向键 + Enter）
   - 数字快捷键 1-9 快速选择

### 颜色选项

**文本颜色：**
- #000000 黑色
- #FF0000 红色
- #00FF00 绿色
- #0000FF 蓝色
- #FFA500 橙色
- #800080 紫色
- #FFC0CB 粉色
- #A52A2A 棕色
- #808080 灰色

**背景颜色：**
- #FFFF00 黄色
- #00FFFF 青色
- #FF00FF 品红
- #90EE90 浅绿
- #FFB6C1 浅粉
- #ADD8E6 浅蓝
- #F0E68C 卡其色
- #D3D3D3 浅灰
- 无背景（移除背景色）

### 技术架构

#### 1. 类型定义扩展
- `types.ts`: 添加 `textColor` 和 `bgColor` 到 `ToolbarFeatureType`
- `TextNode`: 新增 `backgroundColor?: string` 字段

#### 2. 工具栏集成
- `HeadlessFloatingToolbar.tsx`:
  - 导入新的颜色选择器组件
  - 添加到 `text_floatingbar` 模式的功能列表
  - 使用 Tippy.js 实现弹出式选择器
  - 支持数字键快捷键激活

#### 3. 格式化命令扩展
- `helpers.ts` / `applyTextFormat`:
  - 添加 `textColor` 命令：应用 `color` mark
  - 添加 `backgroundColor` 命令：应用 `backgroundColor` mark
  - `removeFormat` 命令同时移除颜色标记

#### 4. 渲染逻辑
- `UnifiedSlateEditor.tsx` / `renderLeaf`:
  - 同时渲染 `color` 和 `backgroundColor`
  - 合并到单个 `<span style={...}>` 标签

#### 5. 序列化支持
- **Slate → HTML** (`slateFragmentToHtml`):
  - 提取 `color` 和 `backgroundColor` 属性
  - 输出为 `<span style="color: X; background-color: Y">`
  
- **HTML → Slate** (`htmlToSlateFragment`):
  - 解析 `<span style="...">` 标签
  - 从 `style` 属性提取 `color` 和 `background-color`
  - 支持嵌套格式标记（bold + color 等）

## 使用方法

### 鼠标操作
1. 选中文本后自动弹出 TextFloatingBar
2. 点击 🎨 图标打开文本颜色选择器
3. 点击 🖍 图标打开背景颜色选择器
4. **🆕 实时预览**：鼠标悬停在颜色选项上时，选中的文本会立即预览该颜色效果
5. 点击颜色选项确认应用并关闭选择器
6. 点击 ✕ 或按 Esc 取消并关闭选择器

### 键盘操作
1. 选中文本后弹出工具栏
2. 按数字键激活对应按钮：
   - 工具栏按钮顺序：[Bold, Italic, Underline, StrikeThrough, ClearFormat, TextColor, BgColor, Bullet]
   - 例如：按 `6` 打开文本颜色选择器，按 `7` 打开背景颜色选择器
3. 在选择器中：
   - 方向键导航（键盘导航时也会实时预览颜色效果）
   - Enter 确认选择
   - Esc 取消

### 清除格式
点击 ✕ 按钮可清除所有格式（包括颜色）

## 数据持久化

颜色信息会随事件数据保存：
- 存储格式：HTML string（`<span style="color: ...; background-color: ...">`）
- 完整的序列化/反序列化支持
- 支持复杂嵌套格式（粗体+颜色+背景色等）

## 兼容性

- ✅ 与现有文本格式功能兼容（bold, italic, underline 等）
- ✅ 支持多格式嵌套
- ✅ TimeHub 模式兼容
- ✅ 诊断日志系统兼容

## 测试清单

- [ ] 文本颜色选择器显示正确
- [ ] 背景颜色选择器显示正确
- [ ] 颜色正确应用到选中文本
- [ ] **🆕 实时预览**：鼠标悬停时颜色立即预览
- [ ] **🆕 键盘导航预览**：方向键切换时颜色实时更新
- [ ] 键盘导航正常工作
- [ ] 数字快捷键正常工作
- [ ] 清除格式功能正常
- [ ] 颜色数据正确保存和恢复
- [ ] 与其他格式嵌套正常工作
- [ ] HTML 序列化/反序列化正确

## 未来增强

- [ ] 支持自定义颜色（色盘选择器）
- [ ] 颜色历史记录
- [ ] 主题色快捷选择
- [ ] 透明度调节
- [ ] 颜色预览优化
