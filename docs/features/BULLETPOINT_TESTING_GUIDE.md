# Bulletpoint 功能测试指南

**测试日期**: 2025-11-30  
**修复版本**: v2.0.1  
**关键修复**: 空格键触发检测时机

---

## 🐛 问题诊断

### 原问题
用户反馈：输入 `* ` 或 `- ` 后没有触发 Bullet 转换

### 根本原因
自动检测逻辑放在 `handleChange` 中，但这个时机太晚：
```typescript
// ❌ 错误实现（原代码）
const handleChange = useCallback((newValue) => {
  const trigger = detectBulletTrigger(editor);
  // ...
}, []);
```

**问题**:
- `handleChange` 在编辑器状态已经更新后才调用
- 可能错过最佳检测时机
- 异步状态更新可能导致检测不准确

### 解决方案
将检测逻辑移到 `handleKeyDown` 中，在空格键按下时触发：

```typescript
// ✅ 正确实现（修复后）
const handleKeyDown = useCallback((event) => {
  if (event.key === ' ') {
    setTimeout(() => {
      const trigger = detectBulletTrigger(editor);
      if (trigger) {
        applyBulletAutoConvert(editor, trigger);
      }
    }, 0);
  }
}, [editor]);
```

**关键点**:
1. **监听空格键**: 直接在 `onKeyDown` 中拦截空格键
2. **延迟执行**: 使用 `setTimeout(0)` 确保空格已插入
3. **立即转换**: 检测到触发字符后立即应用转换

---

## ✅ 测试场景

### 测试 1: 基础触发字符

#### 测试步骤
1. 打开 EventEditModal 或 PlanManager
2. 在编辑器中输入 `*`（星号）
3. **按下空格键**
4. 观察结果

**预期结果**:
- ✅ `*` 和空格被删除
- ✅ 出现 Bullet 符号 `●`
- ✅ 光标位于符号后
- ✅ 控制台输出: `🎯 检测到 Bullet 触发字符: "* "`

#### 其他触发字符
- 输入 `-`（连字符）+ 空格 → `●`
- 输入 `•`（实心圆）+ 空格 → `●`
- 输入 `➢`（箭头）+ 空格 → `●`
- 输入 `·`（中点）+ 空格 → `●`

---

### 测试 2: 层级调整

#### 测试步骤
1. 触发 Bullet（如 `* ` → `●`）
2. 输入一些文字（如 "一级项目"）
3. **按 Tab 键**
4. 观察符号变化

**预期结果**:
- Level 0 (●) → Level 1 (○)
- Level 1 (○) → Level 2 (–)
- Level 2 (–) → Level 3 (□)
- Level 3 (□) → Level 4 (▸)
- Level 4 (▸) → 保持不变（最大层级）

#### Shift+Tab 测试
1. 在 Level 2 (–) 状态
2. **按 Shift+Tab**
3. 预期: Level 2 → Level 1 (○)

---

### 测试 3: Backspace 删除

#### 测试步骤
1. 触发 Bullet（`* ` → `●`）
2. **不输入任何文字**
3. **按 Backspace**
4. 观察结果

**预期结果**:
- ✅ Level 0: Backspace → 取消 Bullet，变为普通段落
- ✅ Level 1+: Backspace → 降低一级（如 Level 2 → Level 1）

---

### 测试 4: Enter 继承层级

#### 测试步骤
1. 触发 Bullet 并输入文字（如 `* 一级项目`）
2. **按 Tab** 升级到 Level 1 (○)
3. **按 Enter** 创建新行
4. 观察新行状态

**预期结果**:
- ✅ 新行自动继承 Level 1，显示 `○`
- ✅ 光标位于新行符号后

#### 空行测试
1. 在 Bullet 行（未输入文字）
2. **按 Enter**
3. 预期: 取消当前行 Bullet，创建普通新行

---

### 测试 5: 复制粘贴格式保留

#### 测试步骤
1. 创建多级 Bullet 列表:
   ```
   ● 一级项目
     ○ 二级项目
       – 三级项目
   ```
2. **全选并复制** (Ctrl+C)
3. 粘贴到其他应用（如 Word、微信）
4. 观察格式

**预期结果（Word）**:
- ✅ 保留层级缩进（margin-left）
- ✅ 符号可能变为 Word 默认符号
- ✅ 文字内容完整

**预期结果（微信）**:
- ✅ 保留层级（每级 2 空格）
- ✅ 符号保留（●○–）
- ✅ 文字内容完整

#### 反向粘贴测试
1. 在 Word 中创建 Bullet 列表
2. 复制并粘贴到 ReMarkable
3. 预期: 解析层级，还原为 Bullet 节点

---

### 测试 6: 边界情况

#### 6.1 中文输入法
1. 切换到中文输入法
2. 输入拼音 `xing` 选择 `*`
3. **按空格**（选择候选词）
4. 预期: **不应触发** Bullet（IME 组字中）

#### 6.2 行首非触发
1. 输入文字（如 "今天*很好"）
2. 光标在 `*` 后，按空格
3. 预期: **不应触发** Bullet（* 不在行首）

#### 6.3 选区非空
1. 选中一段文字
2. 输入 `* `
3. 预期: 替换文字，**不触发** Bullet

---

## 🔍 调试检查清单

### 控制台日志
启动编辑器，打开浏览器控制台（F12），输入 `* ` 后应看到：

```
[ModalSlate] 🎯 检测到 Bullet 触发字符: "* "
[SlateCore.applyBulletAutoConvert] ✅ 触发自动转换: "* "
```

**如果没有日志**:
- ❌ 检查是否在 `handleKeyDown` 中添加了空格键监听
- ❌ 检查 `setTimeout(0)` 是否存在
- ❌ 检查是否导入了 `detectBulletTrigger` 和 `applyBulletAutoConvert`

### 符号显示检查
触发 Bullet 后，检查 DOM 元素：

```html
<!-- 应该看到 -->
<div class="slate-paragraph bullet-paragraph">
  <span class="bullet-symbol" contenteditable="false">●</span>
  <div style="padding-left: 18px;">...</div>
</div>
```

**如果符号不显示**:
- ❌ 检查 CSS 是否加载（`.bullet-symbol` 样式）
- ❌ 检查 `renderElement` 是否使用 `getBulletChar()`
- ❌ 检查节点属性 `bullet: true, bulletLevel: 0`

### 层级调整检查
按 Tab 后，检查节点属性变化：

```javascript
// 在控制台执行
JSON.stringify(editor.children, null, 2)

// 应该看到
{
  "type": "paragraph",
  "bullet": true,
  "bulletLevel": 1,  // ← 应该从 0 变为 1
  "children": [...]
}
```

---

## 📊 测试报告模板

### 环境信息
- **浏览器**: Chrome 120 / Firefox 121 / Safari 17
- **操作系统**: Windows 11 / macOS 14 / iOS 17
- **编辑器**: EventEditModal / PlanManager

### 测试结果

| 测试场景 | 预期 | 实际 | 状态 | 备注 |
|---------|------|------|------|------|
| `* ` 触发 | 转为 ● | ? | ⬜ | |
| `- ` 触发 | 转为 ● | ? | ⬜ | |
| `• ` 触发 | 转为 ● | ? | ⬜ | |
| Tab 升级 | Level 增加 | ? | ⬜ | |
| Shift+Tab 降级 | Level 减少 | ? | ⬜ | |
| Backspace 行首 | 取消 Bullet | ? | ⬜ | |
| Enter 继承 | 新行同级 | ? | ⬜ | |
| 复制到 Word | 保留层级 | ? | ⬜ | |
| 从 Word 粘贴 | 还原层级 | ? | ⬜ | |
| 中文输入法 | 不触发 | ? | ⬜ | |

**状态说明**:
- ✅ 通过
- ❌ 失败
- ⚠️ 部分通过
- ⬜ 未测试

---

## 🚨 常见问题排查

### Q1: 输入 `* ` 后没有反应
**可能原因**:
1. 没有按空格键（只输入 `*` 不触发）
2. IME 输入法组字中（等待候选词确认）
3. 光标不在段落开头（* 后面有其他字符）
4. 编辑器未聚焦

**解决方案**:
- 确保按下空格键
- 关闭输入法或确认候选词后再按空格
- 清空行内容，重新从行首输入
- 点击编辑器确保聚焦

### Q2: 符号显示但无法调整层级
**可能原因**:
1. Tab 键被浏览器默认行为拦截
2. `handleKeyDown` 中没有 Tab 处理逻辑
3. 节点属性 `bullet: true` 未正确设置

**解决方案**:
- 检查 `event.preventDefault()` 是否调用
- 确认 `handleKeyDown` 中有 Tab/Shift+Tab 处理
- 使用浏览器开发工具检查节点属性

### Q3: 复制到 Word 后格式丢失
**可能原因**:
1. 浏览器不支持 `text/html` 格式
2. `handleCopy` 未正确设置剪贴板数据
3. Word 版本过旧，不支持自定义 HTML

**解决方案**:
- 检查控制台是否有 `handleCopy` 日志
- 尝试使用 Chrome 浏览器（兼容性最好）
- 升级到 Word 2016 或更高版本

---

## ✅ 修复验证

修复完成后，请按以下步骤验证：

1. **清除缓存**: Ctrl+Shift+R 强制刷新页面
2. **打开控制台**: F12，切换到 Console 标签
3. **测试基础触发**: 输入 `* ` 并观察日志
4. **测试层级调整**: 按 Tab/Shift+Tab 并检查符号变化
5. **测试复制粘贴**: 复制到 Word/微信并检查格式
6. **测试边界情况**: 中文输入法、非行首触发等

**全部通过后，功能修复成功！** ✅

---

**维护人员**: AI Assistant  
**审核状态**: 待人工验证  
**紧急程度**: 🔴 高（核心功能不可用）
