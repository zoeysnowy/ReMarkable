# FloatingToolbar textStyle 子菜单数字键修复报告

> **修复版本**: v2.17.0  
> **修复日期**: 2025-11-28  
> **问题类型**: 键盘快捷键范围错误  
> **优先级**: P1 (用户功能受阻)

---

## 📋 问题描述

### 用户报告

用户在 EventEditModal 的 Event Log 编辑区域，选中文本后：
1. 按数字键 `5` 打开 textStyle 子菜单 ✅
2. 在子菜单中按数字键 `5`、`6`、`7` 时出现错误 ❌

**控制台错误**:
```
⚠️ [FloatingToolbar] 菜单索引 5 超出范围 (最大 4)
⚠️ [FloatingToolbar] 菜单索引 6 超出范围 (最大 4)
⚠️ [FloatingToolbar] 菜单索引 7 超出范围 (最大 4)
```

### 预期行为

textStyle 子菜单应支持 7 个选项：
1. 粗体 (bold)
2. 斜体 (italic)
3. 文字颜色 (textColor)
4. 背景颜色 (bgColor)
5. 删除线 (strikethrough) ← 数字键 5 失效
6. 清除格式 (clearFormat) ← 数字键 6 失效
7. 项目符号 (bullet) ← 数字键 7 失效

---

## 🔍 根因分析

### 架构分析

```
EventEditModalV2.tsx
  └─ useFloatingToolbar(menuItemCount: 5) ← 固定值
       └─ 数字键监听 (keydown)
            └─ if (menuIndex < menuItemCount) ← 范围检查
                 └─ onMenuSelect(menuIndex)

HeadlessFloatingToolbar.tsx
  └─ activePicker state (内部状态)
       └─ textStyle 子菜单 (7 个选项)
            ├─ 内部逻辑正确处理 7 个选项 ✅
            └─ 但 menuItemCount 未同步 ❌
```

### 核心问题

1. **静态配置**: `EventEditModalV2.tsx` 硬编码 `menuItemCount: 5`
2. **状态隔离**: `activePicker` 状态存在于 `HeadlessFloatingToolbar` 内部
3. **架构限制**: `useFloatingToolbar` 无法访问 `activePicker` 状态
4. **范围错误**: 当 textStyle 子菜单打开时，仍使用 `menuItemCount: 5` 进行范围检查

**代码位置**:
```typescript
// EventEditModalV2.tsx:538 (修复前)
const floatingToolbar = useFloatingToolbar({
  editorRef: rightPanelRef as RefObject<HTMLElement>,
  enabled: isDetailView,
  menuItemCount: 5, // ❌ 固定值，无法动态调整
  isSubPickerOpen,
  onMenuSelect: (index) => {
    console.log('[EventEditModalV2] Menu selected:', index);
    setActivePickerIndex(index);
  },
});
```

```typescript
// useFloatingToolbar.ts:279 (范围检查)
if (menuIndex < menuItemCount) {
  onMenuSelect(menuIndex);
} else {
  console.warn(`⚠️ [FloatingToolbar] 菜单索引 ${menuIndex + 1} 超出范围 (最大 ${menuItemCount})`);
}
```

---

## 💡 解决方案

### 架构设计

采用 **回调模式** 实现状态同步：

```
HeadlessFloatingToolbar.tsx
  └─ activePicker state 变化
       └─ onSubPickerStateChange(isOpen, activePicker) ← 🆕 传递 activePicker
            └─ EventEditModalV2.tsx
                 └─ setCurrentActivePicker(activePicker) ← 🆕 追踪状态
                      └─ menuItemCount = activePicker === 'textStyle' ? 7 : 5 ← 🆕 动态计算
                           └─ useFloatingToolbar(menuItemCount) ← 🆕 动态更新
```

### 实现步骤

#### Step 1: 修改 `HeadlessFloatingToolbar.tsx`

**传递 `activePicker` 参数**:

```typescript
// Line 220 (修改前)
onSubPickerStateChange?.(isSubPickerOpen);

// Line 220 (修改后)
onSubPickerStateChange?.(isSubPickerOpen, activePicker); // 🆕 传递 activePicker
```

#### Step 2: 修改 `types.ts`

**更新回调签名**:

```typescript
// Line 75 (修改前)
onSubPickerStateChange?: (isOpen: boolean) => void;

// Line 75 (修改后)
onSubPickerStateChange?: (isOpen: boolean, activePicker?: string | null) => void;
```

**添加枚举类型**:

```typescript
// Line 49-50 (新增)
| 'textStyle'     // 🆕 文本样式子菜单
| 'addTask'       // 🆕 添加任务开关
```

#### Step 3: 修改 `EventEditModalV2.tsx`

**添加状态追踪**:

```typescript
// Line 365 (新增)
const [currentActivePicker, setCurrentActivePicker] = useState<string | null>(null);
```

**动态计算 menuItemCount**:

```typescript
// Line 533 (新增)
const menuItemCount = currentActivePicker === 'textStyle' ? 7 : 5;

// Line 536 (修改)
const floatingToolbar = useFloatingToolbar({
  editorRef: rightPanelRef as RefObject<HTMLElement>,
  enabled: isDetailView,
  menuItemCount, // 🆕 动态计算：textStyle 为 7，其他为 5
  isSubPickerOpen,
  onMenuSelect: (index) => {
    console.log('[EventEditModalV2] Menu selected:', index);
    setActivePickerIndex(index);
  },
});
```

**更新回调处理**:

```typescript
// Line 2737 (修改)
onSubPickerStateChange={(isOpen: boolean, activePicker?: string | null) => {
  setIsSubPickerOpen(isOpen);
  setCurrentActivePicker(activePicker || null);
}}
```

---

## ✅ 验证测试

### 测试场景

1. **主菜单数字键** (1-5):
   - ✅ `1`: 打开标签选择器
   - ✅ `2`: 打开 Emoji 选择器
   - ✅ `3`: 打开日期范围选择器
   - ✅ `4`: 切换任务开关
   - ✅ `5`: 打开 textStyle 子菜单

2. **textStyle 子菜单数字键** (1-7):
   - ✅ `1`: 应用粗体
   - ✅ `2`: 应用斜体
   - ✅ `3`: 打开文字颜色选择器
   - ✅ `4`: 打开背景颜色选择器
   - ✅ `5`: 应用删除线 ← **修复前失效**
   - ✅ `6`: 清除格式 ← **修复前失效**
   - ✅ `7`: 切换项目符号 ← **修复前失效**

3. **文本格式模式数字键** (1-7):
   - ✅ 选中文本后直接按 `1-7`，同 textStyle 子菜单

### 测试结果

- ✅ 所有数字键功能正常
- ✅ 不再出现范围错误警告
- ✅ menuItemCount 动态调整正确
- ✅ 状态同步无延迟

---

## 📊 代码变更统计

| 文件 | 变更类型 | 行数 | 说明 |
|------|---------|------|------|
| `HeadlessFloatingToolbar.tsx` | 修改 | 1 | 传递 activePicker 参数 |
| `types.ts` | 修改 | 2 | 更新回调签名 |
| `types.ts` | 新增 | 2 | 添加 textStyle/addTask 枚举 |
| `EventEditModalV2.tsx` | 新增 | 1 | currentActivePicker 状态 |
| `EventEditModalV2.tsx` | 新增 | 1 | 动态 menuItemCount 计算 |
| `EventEditModalV2.tsx` | 修改 | 3 | 回调处理逻辑 |
| **总计** | - | **10** | - |

---

## 📝 文档更新

### CHANGELOG.md

添加 v2.17.0 修复记录：
- 问题描述
- 根因分析
- 解决方案
- 修改文件和行号

### EVENTEDITMODAL_V2_PRD.md

1. **版本更新**: v2.0.4 → v2.0.5
2. **更新时间**: 2025-11-27 → 2025-11-28
3. **新增章节**: FloatingToolbar 键盘快捷键说明
   - 主菜单模式 (1-5)
   - textStyle 子菜单 (1-7)
   - 文本格式模式 (1-7)
4. **架构说明**: 动态 menuItemCount、状态同步、范围检查

---

## 🎓 经验总结

### 架构设计教训

1. **状态隔离问题**: 父子组件状态不同步容易导致配置不一致
2. **静态配置风险**: 硬编码值无法适应动态场景
3. **回调是桥梁**: 通过回调传递状态是解耦组件的有效方案

### 最佳实践

1. **动态计算配置**: 根据运行时状态动态计算配置参数
2. **状态提升**: 将共享状态提升到最近的公共祖先组件
3. **回调传参**: 回调不仅传递事件，也可传递状态信息
4. **类型安全**: 使用 TypeScript 确保回调签名一致

### 类似场景参考

未来遇到类似问题时，可采用相同模式：
- 组件 A 内部状态需要影响组件 B 的配置
- 通过回调传递状态信息
- 组件 B 根据状态动态调整配置

---

## 📌 Git 提交记录

### 代码提交

```
commit 25d7a5d
feat(FloatingToolbar): 修复 textStyle 子菜单数字键范围错误

- 修改 onSubPickerStateChange 回调签名，传递 activePicker 参数
- 添加 currentActivePicker 状态追踪当前菜单状态
- 动态计算 menuItemCount：textStyle 为 7，其他为 5
- 添加 'textStyle' 和 'addTask' 到 ToolbarFeatureType 枚举
- 修复数字键 5-7 在 textStyle 子菜单中失效的问题

Files:
- HeadlessFloatingToolbar.tsx (L220)
- types.ts (L75, L49-50)
- EventEditModalV2.tsx (L365, L533, L2737)
```

### 文档提交

```
commit 5a9029b
docs: 更新 FloatingToolbar textStyle 子菜单修复文档

更新内容：
1. CHANGELOG.md
   - 添加 v2.17.0 修复记录
   - 详细说明根因、架构限制和解决方案
   - 记录修改的文件和行号

2. EVENTEDITMODAL_V2_PRD.md
   - 更新版本号：v2.0.4 → v2.0.5
   - 更新最后更新时间：2025-11-27 → 2025-11-28
   - 添加 v2.0.5 更新说明（FloatingToolbar 修复）
   - 完善 FloatingToolbar 集成代码示例（动态 menuItemCount）
   - 新增键盘快捷键说明章节
   - 添加架构说明

Files:
- CHANGELOG.md
- docs/PRD/EVENTEDITMODAL_V2_PRD.md
```

---

## 🚀 下一步

### 后续优化

1. **自动化测试**: 为 FloatingToolbar 键盘快捷键添加 E2E 测试
2. **性能优化**: 减少状态更新频率，避免不必要的重渲染
3. **错误处理**: 添加 menuItemCount 非法值的边界检查

### 相关功能

- [ ] 支持自定义 textStyle 子菜单选项
- [ ] 添加快捷键配置面板
- [ ] 支持用户自定义数字键映射

---

**修复完成** ✅
