# EventEditModal v2 Demo 使用指南

## 访问方式

在应用左侧导航栏点击 **"Modal v2"** 即可进入测试页面。

## 页面布局

```
┌─────────────────────────────────────────────────────┐
│  🎨 EventEditModal v2 交互开发                        │
│  [📋 详情视图] [📱 收缩视图]                           │
├─────────────┬───────────────────────────────────────┤
│ 左侧信息面板  │         右侧预览面板                    │
│             │                                       │
│ ✅ 已实现功能 │    [EventEditModal 实时预览]          │
│ 🚧 开发中功能 │                                       │
│ 📚 参考文档   │                                       │
│ 🎯 当前数据   │                                       │
└─────────────┴───────────────────────────────────────┘
```

## 已实现功能

### 1. Emoji 选择器
- **位置**: 左侧事件标识区的大图标
- **功能**: 
  - 点击打开 emoji-mart 选择器
  - 支持分类浏览和搜索
  - 自动提取标题中的 emoji 显示
  - 选择后自动更新标题
- **优先级**: 标题 emoji > 首个标签 emoji > 默认图标

### 2. 标题输入框
- **功能**:
  - 实时输入和更新
  - 动态 placeholder（根据首个标签生成）
  - 自动提取和显示 emoji
  - 支持 Timer 子事件处理（预留接口）

### 3. 标签显示
- **功能**:
  - 层级路径显示（如 "🚀工作/📝文档编辑"）
  - 支持多标签显示（最多显示2个，其余用"等"）
  - 点击打开标签选择器（占位符，待集成 HierarchicalTagPicker）
  - Hover 效果

### 4. 任务勾选框
- **功能**:
  - 圆形勾选框样式
  - 点击切换任务状态
  - 同步到表单数据

### 5. 视图切换
- **功能**:
  - 详情视图（1200×800px）
  - 收缩视图（383×730px）
  - 实时预览切换效果

## 开发中功能

- [ ] HierarchicalTagPicker 集成
- [ ] Timer 计时按钮交互（开始/暂停/停止/取消）
- [ ] UnifiedDateTimePicker 集成
- [ ] 参与者选择器
- [ ] 地点输入
- [ ] Slate 富文本编辑器集成
- [ ] 实际进展时间片段显示

## 技术栈

- **React**: 18+
- **TypeScript**: 4.9+
- **emoji-mart**: 5.6.0（@emoji-mart/react）
- **TagService**: 项目内置标签服务
- **CSS**: 独立样式文件

## 数据结构

```typescript
interface MockEvent {
  id: string;              // 事件ID
  title: string;           // 标题（含 emoji）
  tags: string[];          // 标签ID数组
  isTask: boolean;         // 是否为任务
  isTimer: boolean;        // 是否为计时事件
  parentEventId: string | null;  // 父事件ID
}
```

## 调试技巧

### 1. 查看当前数据
左侧信息面板底部实时显示当前表单数据（JSON格式）

### 2. 测试 Emoji 选择
1. 点击大 emoji 图标
2. 从分类中选择新 emoji
3. 观察标题自动更新

### 3. 测试标签显示
1. 打开 `src/services/TagService.ts`
2. 修改 mockTags 数据
3. 刷新页面查看效果

### 4. 测试视图切换
点击顶部的 **"详情视图"** / **"收缩视图"** 按钮

## 下一步开发

### 优先级 1: HierarchicalTagPicker 集成
```tsx
import { HierarchicalTagPicker } from '../HierarchicalTagPicker';

// 在组件中
{showTagPicker && (
  <HierarchicalTagPicker
    availableTags={TagService.getFlatTags()}
    selectedTagIds={formData.tags}
    onSelectionChange={(tags) => {
      setFormData({ ...formData, tags });
      setShowTagPicker(false);
    }}
    mode="popup"
    multiSelect={true}
  />
)}
```

### 优先级 2: Timer 按钮交互
参考 PRD 中的 Timer 状态机实现

### 优先级 3: Slate 编辑器集成
参考 `src/components/PlanSlate/`

## 参考文件

- **PRD**: `docs/PRD/EVENTEDITMODAL_V2_PRD.md`
- **实现文档**: `docs/EVENTEDITMODAL_V2_IMPLEMENTATION.md`
- **测试页面**: `test-eventeditmodal-v2.html`
- **组件源码**: `src/components/EventEditModalV2Demo.tsx`
- **样式文件**: `src/components/EventEditModalV2Demo.css`

## 已知问题

1. ✅ 标签选择器为占位符，待集成真实组件
2. ✅ Timer 功能仅为静态展示
3. ✅ Event Log 为占位符

## 更新日志

### 2025-11-14
- ✅ 初始版本创建
- ✅ 集成到 App 导航
- ✅ Emoji 选择器（emoji-mart）
- ✅ 标题输入与 emoji 提取
- ✅ 标签显示与层级路径
- ✅ 任务勾选框
- ✅ 双视图切换
