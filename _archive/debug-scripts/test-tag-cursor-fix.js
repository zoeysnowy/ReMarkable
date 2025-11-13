/**
 * Tag 光标定位测试指南
 * 
 * 修复内容：
 * 1. TagElement DOM 结构修复：children 不再隐藏，放置在 void 元素内部
 * 2. normalizeNode 逻辑优化：正确在 void 元素后插入空格文本节点
 * 
 * 测试步骤：
 */

console.log('%c========================================', 'color: #2196F3; font-weight: bold;');
console.log('%c  Tag 光标定位修复 - 测试指南', 'color: #2196F3; font-weight: bold; font-size: 16px;');
console.log('%c========================================', 'color: #2196F3; font-weight: bold;');
console.log('');

console.log('%c【修复内容】', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('');
console.log('%c1. TagElement DOM 结构修复', 'color: #FF9800; font-weight: bold;');
console.log('   ❌ 修复前: children 被隐藏 (display: none)，导致无法放置光标');
console.log('   ✅ 修复后: children 放置在 span 内部（与 DateMention 一致）');
console.log('   📍 文件: src/components/SlateEditor/elements/TagElement.tsx');
console.log('');

console.log('%c2. normalizeNode 逻辑优化', 'color: #FF9800; font-weight: bold;');
console.log('   ❌ 修复前: 使用 Path.next() 可能定位错误的路径');
console.log('   ✅ 修复后: 正确获取兄弟节点，插入空格文本节点');
console.log('   📍 文件: src/components/UnifiedSlateEditor/UnifiedSlateEditor.tsx L136-234');
console.log('');

console.log('%c【测试步骤】', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('');
console.log('%c测试 1: 插入 Tag 后光标定位', 'color: #2196F3; font-weight: bold;');
console.log('  1. 在 PlanManager 中创建一个新行');
console.log('  2. 双击 Alt 键，按 1 打开 TagPicker');
console.log('  3. 选择一个标签');
console.log('  4. 观察：光标应该出现在 Tag 后面（不是 Tag 内部）');
console.log('  5. 输入文字，确认文字出现在 Tag 后面');
console.log('');

console.log('%c测试 2: 使用方向键导航', 'color: #2196F3; font-weight: bold;');
console.log('  1. 在包含 Tag 的行中，光标在 Tag 前面');
console.log('  2. 按右方向键 →');
console.log('  3. 观察：光标应该跳过 Tag，定位在 Tag 后面');
console.log('  4. 按左方向键 ←');
console.log('  5. 观察：光标应该跳过 Tag，定位在 Tag 前面');
console.log('');

console.log('%c测试 3: 删除 Tag 后的空格', 'color: #2196F3; font-weight: bold;');
console.log('  1. 在包含 Tag 的行中，光标在 Tag 后面');
console.log('  2. 按 Backspace 删除 Tag 后面的空格');
console.log('  3. 观察：normalizeNode 应该自动补充空格');
console.log('  4. 确认光标仍然可以定位在 Tag 后面');
console.log('');

console.log('%c测试 4: Tag 在行尾的情况', 'color: #2196F3; font-weight: bold;');
console.log('  1. 创建一行：输入文字后插入 Tag（Tag 在行尾）');
console.log('  2. 观察：Tag 后面应该有空格（即使是行尾）');
console.log('  3. 按右方向键，光标应该定位在 Tag 后的空格处');
console.log('  4. 继续输入文字，确认可以正常输入');
console.log('');

console.log('%c【诊断工具】', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('');
console.log('运行 diagnose-tag-cursor.js 脚本查看详细诊断：');
console.log('  • window.diagnoseCursorAfterTag()  - 诊断 Tag DOM 结构');
console.log('  • window.testCursorAfterTag()      - 测试光标定位');
console.log('');

console.log('%c【预期结果】', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('');
console.log('✅ Tag 后面总是有空格文本节点（即使删除也会自动补充）');
console.log('✅ 光标可以定位在 Tag 后面（在空格文本节点中）');
console.log('✅ 方向键可以正常跳过 void 元素');
console.log('✅ 在 Tag 后面可以正常输入文字');
console.log('');

console.log('%c【调试日志】', 'color: #4CAF50; font-weight: bold; font-size: 14px;');
console.log('');
console.log('打开 UnifiedSlateEditor 的调试日志（已包含 normalizeNode 日志）：');
console.log('  window.SLATE_DEBUG = true;');
console.log('  localStorage.setItem("SLATE_DEBUG", "true");');
console.log('  location.reload();');
console.log('');

console.log('%c注意事项：', 'color: #FF5722; font-weight: bold;');
console.log('  • normalizeNode 在每次编辑操作后都会运行');
console.log('  • 如果看到重复的 normalizeNode 日志，说明它在自动修复');
console.log('  • 如果修复失败，检查浏览器控制台是否有错误');
console.log('');

console.log('%c========================================', 'color: #2196F3; font-weight: bold;');
console.log('');
