# DateMention 输入流程修复 (v2.10)

> **修复日期**: 2025-11-17  
> **问题**: @ 提及时用户继续输入的文本丢失  
> **影响组件**: UnifiedSlateEditor, UnifiedDateTimePicker

---

## 问题描述

用户在输入 `@明天下午3点` 时：
1. ✅ 输入 `@明天` → UnifiedDateTimePicker 弹出
2. ❌ 继续输入 `下午3点` → **文本丢失**，只解析了 "明天"
3. ❌ 第二次 Enter → DateMention 没有插入

**根本原因**:
1. UnifiedDateTimePicker 的 `searchInput` 状态与 UnifiedSlateEditor 的 `mentionText` 状态隔离
2. UnifiedSlateEditor 没有传递 `useTimeHub=true`，导致使用了错误的回调（`onSelect` 而非 `onApplied`）
3. 没有 `initialText` prop 传递初始文本
4. 没有 `onSearchChange` 回调实时更新解析结果

---

## 修复方案

### 1. 添加 `initialText` prop

**文件**: `UnifiedDateTimePicker.tsx`

```typescript
interface UnifiedDateTimePickerProps {
  // ... 其他 props
  initialText?: string;     // 🆕 用户在 @ 后输入的初始文本
  onSearchChange?: (text: string, parsed: { start?: Date; end?: Date } | null) => void; // 🆕
}

const UnifiedDateTimePicker: React.FC<UnifiedDateTimePickerProps> = ({
  // ... 其他参数
  initialText = '',
  onSearchChange,
}) => {
  const [searchInput, setSearchInput] = useState(initialText); // 🔧 使用 initialText
  // ...
}
```

### 2. 实时解析并回调

**文件**: `UnifiedDateTimePicker.tsx`

```tsx
<input
  value={searchInput}
  onChange={(e) => {
    const newText = e.target.value;
    setSearchInput(newText);
    
    // 🆕 实时解析并通知父组件
    if (onSearchChange && newText.trim().length > 0) {
      const parsed = parseNaturalLanguage(newText);
      if (parsed && parsed.matched) {
        // 提取开始和结束时间
        let start: Date | undefined;
        let end: Date | undefined;
        // ... 解析逻辑
        onSearchChange(newText, { start, end });
      } else {
        onSearchChange(newText, null);
      }
    }
  }}
/>
```

### 3. 回传完整文本

**文件**: `UnifiedDateTimePicker.tsx`

```typescript
interface UnifiedDateTimePickerProps {
  onApplied?: (startIso: string, endIso?: string, allDay?: boolean, userInputText?: string) => void; // 🆕 第四个参数
}

const handleApply = () => {
  // ...
  onApplied?.(startIso, endIso, allDaySelected, searchInput); // 🔧 传递完整文本
}
```

### 4. UnifiedSlateEditor 集成

**文件**: `UnifiedSlateEditor.tsx`

```tsx
// 🆕 实时更新解析结果
const handleMentionSearchChange = useCallback((text: string, parsed: { start?: Date; end?: Date } | null) => {
  setMentionText(text);
  if (parsed && parsed.start) {
    setMentionInitialStart(parsed.start);
    setMentionInitialEnd(parsed.end);
  }
}, []);

// 🆕 接收完整文本
const handleMentionSelect = useCallback(async (startStr: string, endStr?: string, allDay?: boolean, userInputText?: string) => {
  const finalUserText = userInputText || mentionText || '';
  // ... 使用 finalUserText 作为 displayHint
}, [mentionText]);

// 🔧 使用配置
<UnifiedDateTimePicker
  useTimeHub={true}  // 🔧 必须为 true
  initialText={mentionText}
  initialStart={mentionInitialStart}
  initialEnd={mentionInitialEnd}
  onSearchChange={handleMentionSearchChange}  // 🆕
  onApplied={handleMentionSelect}
  onClose={handleMentionClose}
/>
```

---

## 数据流

```
用户输入 @明天
  ↓
UnifiedSlateEditor 检测 @ → parseNaturalLanguage("明天")
  ↓
弹出 UnifiedDateTimePicker
  - useTimeHub=true ✅
  - initialText="明天" ✅
  - initialStart=Date(明天 00:00)
  - onSearchChange={handleMentionSearchChange} ✅
  ↓
用户继续输入 "下午3点"
  ↓
searchInput = "明天下午3点" ✅
  ↓
onChange → parseNaturalLanguage("明天下午3点")
  ↓
onSearchChange(text, { start: Date(明天 15:00), end: undefined })
  ↓
UnifiedSlateEditor 更新 mentionText 和 mentionInitialStart ✅
  ↓
第一次 Enter → blur → 显示预览
  ↓
第二次 Enter → handleApply
  ↓
onApplied(startIso, endIso, allDay, "明天下午3点") ✅
  ↓
handleMentionSelect 使用 userInputText ✅
  ↓
插入 DateMention(displayHint="明天下午3点") ✅
```

---

## 键盘操作

- **第一次 Enter**: 解析自然语言并显示预览
- **第二次 Enter**: 确认并插入 DateMention 节点
- **ESC**: 取消输入，关闭 Picker ✅

---

## 测试用例

### 测试 1: 累积式输入
1. 输入 `@明天`
2. 继续输入 `下午3点`
3. 第一次 Enter → 预览显示 "明天 15:00"
4. 第二次 Enter → 插入 DateMention，displayHint="明天下午3点" ✅

### 测试 2: ESC 取消
1. 输入 `@明天下午3点`
2. 按 ESC → Picker 关闭，文本不变 ✅

### 测试 3: 修改输入
1. 输入 `@明天`
2. 修改为 `今天下午5点`
3. 第一次 Enter → 预览显示 "今天 17:00"
4. 第二次 Enter → displayHint="今天下午5点" ✅

---

## 相关文档

- [SLATE_EDITOR_PRD.md](../PRD/SLATE_EDITOR_PRD.md) - Slate 编辑器完整文档
- [TIME_PICKER_AND_DISPLAY_PRD.md](../PRD/TIME_PICKER_AND_DISPLAY_PRD.md) - UnifiedDateTimePicker 完整文档
- [DATEMENTION_TIMEPICKER_TIMEDISPLAY_FLOW.md](../architecture/DATEMENTION_TIMEPICKER_TIMEDISPLAY_FLOW.md) - 数据流架构

---

## 修改文件清单

1. ✅ `src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.tsx`
   - 添加 `initialText` prop
   - 添加 `onSearchChange` prop
   - 修改 `onApplied` 签名，添加第四个参数 `userInputText`
   - `searchInput` 初始值使用 `initialText`
   - `onChange` 时实时解析并调用 `onSearchChange`
   - `handleApply` 时传递 `searchInput`

2. ✅ `src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx`
   - 添加 `handleMentionSearchChange` 回调
   - 修改 `handleMentionSelect` 签名，接收第四个参数 `userInputText`
   - 添加 `useTimeHub={true}` 到 UnifiedDateTimePicker
   - 传递 `initialText={mentionText}`
   - 传递 `onSearchChange={handleMentionSearchChange}`
   - 使用 `finalUserText = userInputText || mentionText`

3. ✅ `docs/PRD/SLATE_EDITOR_PRD.md`
   - 更新时间系统集成流程图
   - 添加 UnifiedDateTimePicker 使用说明
   - 修正 @ 提及的数据流

4. ✅ `docs/PRD/TIME_PICKER_AND_DISPLAY_PRD.md`
   - 添加 v2.10 @ 提及模式说明
   - 更新 Props 接口文档
   - 添加键盘操作说明

---

## 版本历史

- **v2.10** (2025-11-17): 修复 @ 提及输入流程，添加 `initialText` 和 `onSearchChange`
- **v2.9**: DateMention 过期检测与悬浮卡片
- **v2.8**: 字段重构，双字段同步
- **v2.2**: TimeHub 集成
