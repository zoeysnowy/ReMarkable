# 段落移动功能测试指南

> **版本**: v1.0  
> **创建时间**: 2025-11-28  
> **测试范围**: LightSlateEditor, UnifiedSlateEditor  
> **快捷键**: `Shift+Alt+↑/↓`

---

## 🧪 测试环境准备

### 1. 启动开发服务器

```powershell
cd c:\Users\Zoey\ReMarkable
npm run dev
```

### 2. 打开测试页面

- **LightSlateEditor**: Event Edit Modal → 实际进展区域
- **UnifiedSlateEditor**: Plan Manager → 事件列表

---

## 📝 LightSlateEditor 测试用例

### TC-1: 基础段落上移

**操作步骤**:
1. 打开任意事件的 EditModal
2. 在"实际进展"区域输入 3 行文本：
   ```
   第一行
   第二行
   第三行
   ```
3. 光标定位到"第二行"
4. 按 `Shift+Alt+↑`

**预期结果**:
- "第二行"和"第一行"交换位置
- 光标自动跟随到新位置（第一行）

---

### TC-2: 基础段落下移

**操作步骤**:
1. 光标定位到"第一行"
2. 按 `Shift+Alt+↓`

**预期结果**:
- "第一行"和"第二行"交换位置
- 光标自动跟随到新位置（第二行）

---

### TC-3: Bullet 段落移动

**操作步骤**:
1. 输入 3 个 bullet points：
   ```
   • Bullet A
   • Bullet B
   • Bullet C
   ```
2. 光标定位到"Bullet B"
3. 按 `Shift+Alt+↑`

**预期结果**:
- "Bullet B"和"Bullet A"交换位置
- Bullet 格式保持不变
- 光标跟随到新位置

---

### TC-4: Timestamp 自动跳过

**操作步骤**:
1. 在 Event Log 中记录一次计时（会自动插入 timestamp）
2. 在 timestamp 下方输入两行文本：
   ```
   ──────── 10:30 ────────
   文本A
   文本B
   ```
3. 光标定位到"文本B"
4. 按 `Shift+Alt+↑` 两次

**预期结果**:
- 第一次按：文本B 移动到文本A之上
- 第二次按：自动跳过 timestamp，移动到 timestamp 之上
- Timestamp 行本身不可移动（受保护）

---

### TC-5: 边界检查 - 第一行不能上移

**操作步骤**:
1. 光标定位到第一行
2. 按 `Shift+Alt+↑`

**预期结果**:
- 控制台输出日志："已在第一行，无法上移"
- 内容不变

---

### TC-6: 边界检查 - 最后一行不能下移

**操作步骤**:
1. 光标定位到最后一行
2. 按 `Shift+Alt+↓`

**预期结果**:
- 控制台输出日志："已在最后一行，无法下移"
- 内容不变

---

### TC-7: Bullet 层级保持

**操作步骤**:
1. 创建多层级 bullet：
   ```
   • Level 0
     • Level 1
       • Level 2
   ```
2. 移动"Level 1"到"Level 0"之上

**预期结果**:
- 移动后层级关系保持：
   ```
     • Level 1 (层级保持)
   • Level 0
       • Level 2
   ```

---

## 📚 UnifiedSlateEditor 测试用例

### TC-8: 标题移动（带动 eventlog）

**操作步骤**:
1. 在 Plan Manager 中创建两个事件：
   ```
   事件A (title)
   ├─ A的日志1 (eventlog)
   └─ A的日志2 (eventlog)
   
   事件B (title)
   └─ B的日志 (eventlog)
   ```
2. 光标定位到"事件A"标题行
3. 按 `Shift+Alt+↓`

**预期结果**:
- 整个事件A（3行）移动到事件B之后：
   ```
   事件B (title)
   └─ B的日志 (eventlog)
   
   事件A (title)
   ├─ A的日志1 (eventlog)
   └─ A的日志2 (eventlog)
   ```
- 光标跟随到新位置

---

### TC-9: EventLog 移动（标题不跟随）

**操作步骤**:
1. 使用 TC-8 的初始状态
2. 光标定位到"A的日志2"
3. 按 `Shift+Alt+↑`

**预期结果**:
- 只有"A的日志2"和"A的日志1"交换位置：
   ```
   事件A (title)
   ├─ A的日志2 (eventlog)
   └─ A的日志1 (eventlog)
   ```
- 标题"事件A"保持不动

---

### TC-10: EventLog 不能移动到标题行之前

**操作步骤**:
1. 光标定位到"A的日志1"（标题行的第一个 eventlog）
2. 按 `Shift+Alt+↑`

**预期结果**:
- 控制台输出："无法移动到标题行之前"
- 内容不变

---

### TC-11: EventLog 不能移动到其他事件

**操作步骤**:
1. 光标定位到"A的日志2"（最后一个 eventlog）
2. 按 `Shift+Alt+↓`

**预期结果**:
- 控制台输出："无法移动到其他事件的标题行后"
- 内容不变

---

### TC-12: 标题上移到顶部

**操作步骤**:
1. 使用 TC-8 的结果状态（事件B在上）
2. 光标定位到"事件B"
3. 按 `Shift+Alt+↑`

**预期结果**:
- 控制台输出："已在第一行，无法上移"
- 内容不变

---

### TC-13: Placeholder 边界保护

**操作步骤**:
1. 光标定位到最后一个真实事件
2. 按 `Shift+Alt+↓`

**预期结果**:
- 控制台输出："无法移动到 placeholder 后"
- 内容不变

---

## 🔍 调试技巧

### 打开调试日志

在浏览器控制台运行：

```javascript
// LightSlateEditor 详细日志
localStorage.setItem('SLATE_VERBOSE_LOG', 'true');

// UnifiedSlateEditor 详细日志
window.SLATE_DEBUG = true;

// 刷新页面生效
location.reload();
```

### 查看移动日志

移动操作会输出详细日志：

```
[moveParagraphUp] 移动段落: 2 ↔ 1
  当前段落索引: 2
  目标段落索引: 1
  跳过 timestamp: false
```

### 关闭调试日志

```javascript
localStorage.removeItem('SLATE_VERBOSE_LOG');
delete window.SLATE_DEBUG;
location.reload();
```

---

## ✅ 验收标准

### 功能完整性
- ✅ 所有基础移动功能正常
- ✅ Timestamp 自动跳过
- ✅ Bullet 格式保持
- ✅ 边界保护生效

### UnifiedSlateEditor 特殊功能
- ✅ 标题移动带动 eventlog
- ✅ EventLog 独立移动
- ✅ 事件结构完整性保护

### 用户体验
- ✅ 光标自动跟随
- ✅ 操作可撤销（Ctrl+Z）
- ✅ 控制台日志清晰
- ✅ 无性能卡顿

---

## 🐛 已知问题

### Issue-1: Timestamp 保护逻辑
**状态**: ✅ 已修复  
**描述**: 用户不能删除 timestamp，只能系统自动清理  
**修复**: Backspace/Delete 键检测 timestamp-divider 并阻止

### Issue-2: 空 timestamp 自动清理
**状态**: ✅ 已实现  
**描述**: handleBlur 时检查 timestamp 后是否有内容  
**行为**: 空 bullet 段落不算内容，一起清理

---

## 📊 测试报告模板

```markdown
## 测试报告

**测试人**: [姓名]  
**测试时间**: [日期]  
**测试环境**: [Chrome/Edge/Firefox] [版本号]

### LightSlateEditor
- [ ] TC-1: 基础段落上移
- [ ] TC-2: 基础段落下移
- [ ] TC-3: Bullet 段落移动
- [ ] TC-4: Timestamp 自动跳过
- [ ] TC-5: 边界检查 - 第一行
- [ ] TC-6: 边界检查 - 最后一行
- [ ] TC-7: Bullet 层级保持

### UnifiedSlateEditor
- [ ] TC-8: 标题移动（带动 eventlog）
- [ ] TC-9: EventLog 移动（标题不跟随）
- [ ] TC-10: EventLog 不能移动到标题行之前
- [ ] TC-11: EventLog 不能移动到其他事件
- [ ] TC-12: 标题上移到顶部
- [ ] TC-13: Placeholder 边界保护

### 发现的问题
1. [问题描述]
2. [问题描述]

### 总体评价
[通过/需修复/阻塞发布]
```

---

**测试优先级**: P1 (高优先级)  
**建议测试时间**: 30-60 分钟  
**测试覆盖率目标**: 100% 核心用例
