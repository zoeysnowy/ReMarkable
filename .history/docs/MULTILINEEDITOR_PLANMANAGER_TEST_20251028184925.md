# MultiLineEditor 在 PlanManager 中的测试

**测试日期**: 2025-10-28  
**测试组件**: MultiLineEditor  
**测试场景**: PlanManager 集成测试

## 改造内容

### 1. 导入变更
```typescript
// 删除
import { useFloatingToolbar } from '../hooks/useFloatingToolbar';
import { FloatingToolbar } from './FloatingToolbar';

// 新增
import { MultiLineEditor, MultiLineEditorItem } from './MultiLineEditor';
```

### 2. 数据转换
将 `PlanItem[]` 转换为 `MultiLineEditorItem<PlanItem>[]`：
```typescript
const editorItems = useMemo<MultiLineEditorItem<PlanItem>[]>(() => {
  return items.map((item, index) => ({
    id: item.id,
    content: item.title,
    level: 0,
    position: index,
    parentId: undefined,
    data: item,  // 将完整的 PlanItem 存储在 data 中
  }));
}, [items]);
```

### 3. 插槽实现

#### renderItemPrefix（左侧区域）
- ✅ Checkbox（完成状态）
- ✅ 类型图标（📅 Event / 📋 Task / ☐ Todo）
- ✅ Emoji（可选）

#### renderItemSuffix（右侧区域）
- ✅ 标签列表（#tag）
- ✅ 时间显示（⏰ 截止日期/时间段）
- ✅ 优先级指示器（彩色竖条）

#### renderContent（内容区域）
- ✅ contentEditable 可编辑
- ✅ 富文本颜色支持
- ✅ 完成状态样式（删除线、透明度）
- ✅ 点击打开详情面板

### 4. 新功能
- ✅ 键盘导航：↑↓ 移动焦点
- ✅ 快速创建：Enter 创建新任务
- ✅ 层级调整：Tab/Shift+Tab 缩进
- ✅ 批量操作：文本选区多选
- ✅ Gray Text：底部提示区域

### 5. 删除的功能
- ❌ FloatingToolbar（浮动工具栏）
- ❌ 旧的卡片式编辑器

## 测试计划

### Phase 1: 基础功能测试
- [ ] 页面是否正常加载？
- [ ] MultiLineEditor 是否正确渲染？
- [ ] 现有任务是否正常显示？
- [ ] Checkbox、类型图标、Emoji 是否显示？
- [ ] 标签和时间是否显示在右侧？

### Phase 2: 键盘导航测试
- [ ] ↑↓ 键能否正常切换焦点？
- [ ] Enter 键能否创建新任务？
- [ ] Shift+Enter 能否创建子任务？
- [ ] Tab/Shift+Tab 能否调整层级？
- [ ] Shift+Alt+↑↓ 能否移动任务？

### Phase 3: 编辑功能测试
- [ ] 内容编辑是否正常？
- [ ] onBlur 保存是否触发？
- [ ] 富文本颜色是否保留？
- [ ] 完成状态样式是否正确？

### Phase 4: 批量操作测试
- [ ] 文本选区多选是否工作？
- [ ] Delete 键批量删除是否工作？
- [ ] 批量移动是否工作？

### Phase 5: Gray Text 测试
- [ ] Gray Text 是否显示在底部？
- [ ] 点击 Gray Text 能否创建新任务？
- [ ] 提示文本是否正确？

### Phase 6: 集成测试
- [ ] 点击任务能否打开详情面板？
- [ ] 详情面板修改能否同步？
- [ ] Emoji Picker 是否正常工作？
- [ ] 标签选择是否正常工作？
- [ ] 优先级设置是否正常工作？

## 已知问题

### 问题 1: 
**描述**: （待测试后填写）  
**重现步骤**: 
1. 
2. 
3. 

**预期行为**: 

**实际行为**: 

**解决方案**: 

---

## 测试结果

### 测试环境
- 浏览器: Chrome / Edge / Firefox
- 操作系统: Windows
- React 版本: 19.2.0

### 通过的测试
（待填写）

### 失败的测试
（待填写）

### 性能表现
- 初始加载时间: 
- 键盘响应延迟: 
- 滚动流畅度: 

---

## 下一步计划

1. **修复测试中发现的问题**
2. **优化性能**（如有需要）
3. **迁移 TagManager 使用 MultiLineEditor**
4. **实现 / 命令面板**（可选）

---

## 备注

- 保留了右侧详情面板的所有功能
- 保留了 Emoji Picker
- MultiLineEditor 完全替代了旧的卡片式列表
- Gray Text 提示更友好，不遮挡内容
