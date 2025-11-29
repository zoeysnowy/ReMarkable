# TagManager Slate.js 重构计划

**创建时间**: 2025-11-05  
**优先级**: 🟡 中（技术债偿还 + 功能增强）  
**标签**: `refactor`, `slate`, `code-quality`, `tech-debt`

---

## 📋 背景

### 当前问题

TagManager 当前使用原生 `contentEditable` 实现标签名编辑，而 PlanManager 已经使用 Slate.js 编辑器，导致：

1. **维护两套编辑器方案**：contentEditable（TagManager）vs Slate（PlanManager）
2. **编辑体验不一致**：复制粘贴、快捷键、批量操作行为不同
3. **代码重复**：批量操作逻辑在两个组件中各实现一遍
4. **功能受限**：contentEditable 无法支持富文本、撤销重做、跨组件拖拽

### 重构机会

✅ **项目已经使用 Slate.js**（package.json）：
- `slate`: ^0.118.1
- `slate-react`: ^0.118.2
- `slate-history`: ^0.113.1

✅ **共享基础设施已完备**：
- `src/components/SlateEditor/SlateLine.tsx`（375 lines，单行编辑器）
- `src/components/SlateEditor/utils.ts`（序列化/反序列化工具）
- `src/components/SlateEditor/types.ts`（类型定义）
- `src/components/SlateEditor/elements/`（TagElement、DateMentionElement）

✅ **PlanManager 已成功应用**：
- `PlanSlate.tsx`（402 lines，多行编辑器）
- 已验证 Slate 在生产环境的可行性

---

## 🎯 目标

### 主要目标

1. **统一编辑器技术栈**：TagManager 和 PlanManager 都使用 Slate.js
2. **提升代码可维护性**：删除自定义 contentEditable 逻辑（~500 lines）
3. **统一用户体验**：批量操作、快捷键、复制粘贴行为一致
4. **解锁新功能**：富文本标签名、撤销重做、跨组件拖拽

### 成功标准

- ✅ TagManager 所有现有功能保持不变（9种快捷键、批量操作、层级缩进）
- ✅ 复制粘贴行为与 PlanManager 一致（Base64 混合格式）
- ✅ 代码量减少 ≥ 500 lines
- ✅ 单元测试覆盖率提升到 70%+
- ✅ 中文输入法无干扰（IME 兼容）

---

## 📅 分阶段实施计划

### Phase 1: 最小可行重构（1-2 天）

**目标**：用 SlateLine 替换单个标签的 contentEditable，保留其他功能

**任务清单**：
- [ ] 集成 SlateLine 到 TagManager（2 小时）
  ```tsx
  import { SlateLine } from './SlateEditor/SlateLine';
  
  <SlateLine
    content={tag.name}
    lineId={tag.id}
    onUpdate={(html) => handleTagNameChange(tag.id, html)}
    onEnter={() => createNewTag(tag.level, tag.id)}
    onTab={() => handleTabIndent(tag.id)}
    onShiftTab={() => handleShiftTabOutdent(tag.id)}
    placeholder="输入标签名..."
  />
  ```
- [ ] 适配 `handleTagKeyDown` 到 Slate 的 `onKeyDown`（3 小时）
- [ ] 测试 9 种快捷键（Enter、Tab、Shift+Tab、Esc、↑↓、Shift+Alt+↑↓、Ctrl+F9）（2 小时）
- [ ] 测试复制粘贴（纯文本 + 富文本）（2 小时）
- [ ] 测试中文输入法（搜狗、微软拼音）（1 小时）

**预期成果**：
- 标签名编辑功能完全正常
- 所有快捷键工作正常
- IME 兼容问题修复

**风险评估**：🟢 低（SlateLine 已在 PlanManager 验证）

---

### Phase 2: 统一批量操作（3-5 天）

**目标**：让 TagManager 的批量复制/剪切/粘贴与 PlanManager 共享逻辑

**任务清单**：
- [ ] 提取共享的批量操作 hooks（4 小时）
  ```typescript
  // src/hooks/useSlateClipboard.ts
  export const useSlateClipboard = () => {
    const handleCopy = (selectedNodes: Descendant[]) => {
      // 统一的 Base64 混合格式
      const html = serializeToHtml(selectedNodes);
      const text = serializeToPlainText(selectedNodes);
      const json = JSON.stringify(selectedNodes);
      
      navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([`__REMARKABLE_SLATE__${btoa(json)}__\n${html}`], { type: 'text/html' }),
          'text/plain': new Blob([text], { type: 'text/plain' })
        })
      ]);
    };
    // handleCut, handlePaste...
  };
  ```
- [ ] 迁移批量删除到 Slate Transforms API（4 小时）
  ```typescript
  // 替代 querySelector + DOM 操作
  Transforms.removeNodes(editor, {
    at: selectedPaths
  });
  ```
- [ ] 迁移批量移动到 Slate Transforms API（4 小时）
  ```typescript
  Transforms.moveNodes(editor, {
    at: sourcePath,
    to: targetPath
  });
  ```
- [ ] 统一选区管理（`window.getSelection()` → `Editor.selection`）（4 小时）
- [ ] 测试跨组件复制粘贴（PlanManager ↔ TagManager）（4 小时）
- [ ] 测试批量日历映射（Shift+Alt+M）（2 小时）

**预期成果**：
- TagManager 和 PlanManager 的批量操作逻辑统一
- 可以在两个组件间复制粘贴标签
- 代码重复减少 ~300 lines

**风险评估**：🟡 中（需要深入理解 Slate 的 Selection API）

---

### Phase 3: 增强功能（可选，1 周）

**目标**：解锁 Slate 的高级能力

**任务清单**：
- [ ] 富文本标签名（2 天）
  - 支持 `#工作 **重要**`（加粗）
  - 支持 `#学习 [链接](https://example.com)`
  - 更新序列化逻辑以保留格式
- [ ] 跨组件拖拽（2 天）
  - 从 PlanManager 拖拽标签到 TagManager
  - 从 TagManager 拖拽标签到 PlanManager
  - 使用 Slate DnD 插件或原生 Drag API
- [ ] 撤销/重做（1 天）
  - 启用 Ctrl+Z/Ctrl+Y（slate-history 内置）
  - 测试多次撤销/重做的正确性
- [ ] 智能补全（2 天）
  - 输入 `#` 自动弹出标签选择器
  - 复用 PlanManager 的 TagElement 组件

**预期成果**：
- 富文本标签名提升表达能力
- 跨组件拖拽提升工作效率
- 撤销/重做提升用户体验

**风险评估**：🟢 低（可选功能，不影响核心流程）

---

## 🔧 技术实施细节

### 数据结构映射

| TagManager 当前 | Slate 节点 | 映射方式 |
|----------------|-----------|---------|
| `tag.name` (string) | `Descendant[]` | `serializeToPlainText(nodes)` |
| `tag.color` (hex) | 行级样式 | `renderLinePrefix` 传入 `#` 符号 |
| `tag.emoji` | 行级元素 | `renderLinePrefix` 传入 emoji span |
| `tag.level` | 行级缩进 | `style={{ paddingLeft: level * 20 }}` |

### 复用的核心组件

#### SlateLine.tsx（~350 lines）
- ✅ 单行编辑（自动禁止换行）
- ✅ 快捷键处理（Enter、Tab、Esc 已实现）
- ✅ 复制粘贴（支持富文本）
- ✅ IME 兼容（已修复搜狗输入法问题，L86）

#### SlateEditor/utils.ts（~200 lines）
- ✅ `serializeToHtml()` - 转换为 HTML
- ✅ `deserializeFromHtml()` - 解析外部 HTML
- ✅ `serializeToPlainText()` - 转换为纯文本

#### SlateEditor/types.ts
- ✅ `CustomElement`、`CustomText` 类型定义
- ✅ `TagNode`、`DateMentionNode` 自定义元素

### 需要修改的现有代码

#### TagManager.tsx（位置标注）

**删除的代码**（~500 lines）：
- L1425-1603: `handleTagKeyDown()`（部分逻辑迁移到 SlateLine 的回调）
- L300-798: 自定义复制/剪切/粘贴逻辑（替换为 `useSlateClipboard`）
- L853-968: 批量操作键盘处理（迁移到 Slate Transforms）
- L970-991: `window.getSelection()` 选区管理（替换为 `Editor.selection`）

**新增的代码**（~200 lines）：
- Import `SlateLine` 和相关 hooks
- `<SlateLine>` 组件集成
- 回调函数适配（`onEnter`, `onTab`, `onUpdate` 等）
- `useSlateClipboard` hook 调用

**净减少**：~300 lines

---

## 📊 成本收益分析

### 开发成本

| 阶段 | 工作量 | 时间 |
|------|--------|------|
| Phase 1 | 10 小时 | 1-2 天 |
| Phase 2 | 22 小时 | 3-5 天 |
| Phase 3（可选） | 5 天 | 1 周 |
| **总计（Phase 1+2）** | **32 小时** | **1 周** |

### 长期收益

| 维度 | 当前 | 重构后 | 改善 |
|------|------|--------|------|
| **代码量** | 2555 lines | ~2200 lines | ↓ 14% |
| **维护成本** | 高（两套编辑器） | 低（统一 Slate） | ↓ 50% |
| **用户体验** | 不一致（复制粘贴） | 一致 | ↑ 100% |
| **功能扩展性** | 低（contentEditable 限制） | 高（Slate 插件） | ↑ 200% |
| **测试覆盖率** | ~40% | ~70% | ↑ 75% |

---

## ⚠️ 风险与缓解措施

### 风险 1: 迁移过程中功能回退

**影响**：用户发现某些快捷键或批量操作失效  
**概率**：🟡 中  
**缓解措施**：
- 创建 `TagManager-Slate.tsx` 作为新版本，保留原 `TagManager.tsx` 作为备份
- 使用 Feature Flag 控制是否启用新版本
- 完整的回归测试清单（包含所有快捷键和批量操作）

### 风险 2: Slate Selection API 理解不足

**影响**：批量操作逻辑错误（如选中的标签不正确）  
**概率**：🟡 中  
**缓解措施**：
- 阅读 Slate 官方文档（Selection 章节）
- 参考 PlanManager 的 `PlanSlate` 实现
- 编写单元测试验证选区计算逻辑

### 风险 3: IME 兼容性问题

**影响**：中文输入法在某些场景下异常（如搜狗输入法）  
**概率**：🟢 低（SlateLine 已修复）  
**缓解措施**：
- 复用 SlateLine 的 IME 修复（L86 已禁用 AndroidPlugin）
- 在 Windows + 搜狗输入法环境下充分测试
- 如有问题，参考 SlateLine 的 IME 处理逻辑

---

## 📚 参考资料

### 内部文档

- **TagManager PRD**: `docs/PRD/TAGMANAGER_MODULE_PRD.md`
  - Section 12.2: "是否使用 Slate.js 重构？"（详细分析）
  - Section 6-8: 现有功能详解（CRUD、快捷键、批量操作）
- **PlanManager 实现**: `src/components/PlanManager.tsx` (1641 lines)
  - L7-8: Slate 编辑器集成
  - 已验证的 Slate 应用模式
- **SlateLine 文档**: `src/components/SlateEditor/SlateLine.tsx`
  - L1-58: Props 定义和使用说明
  - L86: IME 修复注释

### Slate 官方文档

- [Slate.js 官网](https://docs.slatejs.org/)
- [Selection API](https://docs.slatejs.org/api/locations/selection)
- [Transforms API](https://docs.slatejs.org/api/transforms)
- [Custom Elements](https://docs.slatejs.org/concepts/02-nodes#element)

---

## ✅ 验收标准

### Phase 1 完成标准

- [ ] TagManager 使用 SlateLine 替换所有 contentEditable
- [ ] 所有 9 种快捷键功能正常（Enter、Tab、Shift+Tab、Esc、↑↓、Shift+Alt+↑↓、Ctrl+F9）
- [ ] 标签名编辑、创建、删除功能正常
- [ ] 中文输入法无干扰（搜狗、微软拼音测试通过）
- [ ] 回归测试通过（所有现有功能正常）

### Phase 2 完成标准

- [ ] 批量复制/剪切/粘贴与 PlanManager 行为一致
- [ ] 可以在 TagManager 和 PlanManager 间复制粘贴标签
- [ ] 批量删除、批量移动、批量日历映射功能正常
- [ ] 选区管理使用 `Editor.selection`（移除 `window.getSelection()`）
- [ ] 代码量减少 ≥ 300 lines
- [ ] 单元测试覆盖率 ≥ 60%

### Phase 3 完成标准（可选）

- [ ] 富文本标签名功能正常（加粗、链接）
- [ ] 跨组件拖拽功能正常（TagManager ↔ PlanManager）
- [ ] 撤销/重做功能正常（Ctrl+Z/Y）
- [ ] 智能补全功能正常（输入 `#` 弹出标签选择器）

---

## 🚀 下一步行动

1. **评审本 Issue**（15 分钟）
   - 技术负责人确认方案可行性
   - 产品经理确认优先级

2. **启动 Phase 1**（本周内）
   - 创建分支 `feature/tagmanager-slate-refactor`
   - 实施最小可行重构
   - 提交 PR 并进行代码审查

3. **根据 Phase 1 结果决定是否继续 Phase 2**（下周评估）
   - 如果 Phase 1 顺利，继续 Phase 2
   - 如果遇到阻塞问题，暂停并重新评估方案

---

**创建人**: GitHub Copilot  
**相关 PRD**: `docs/PRD/TAGMANAGER_MODULE_PRD.md`  
**相关组件**: `TagManager.tsx`, `SlateLine.tsx`, `PlanManager.tsx`
