/**
 * 测试时间段选择功能
 * 
 * 问题：在日历视图选中空白时间段后，界面卡住，无法取消选中，也没有弹出编辑窗口
 * 
 * 修复：
 * 1. 添加 onSelectDateTime 处理器 - 打开编辑模态框
 * 2. 修改 handleBeforeCreateEvent - 返回 false 阻止默认行为
 * 3. 修复事件名转换 - onSelectDateTime -> selectDateTime (保持驼峰)
 * 
 * 测试步骤：
 * 1. 打开应用，进入日历视图
 * 2. 在空白时间段点击并拖动（选择时间范围）
 * 3. 预期：EventEditModal 弹出，显示选中的时间
 * 4. 填写事件信息并保存
 * 5. 验证：事件成功创建并显示在日历上
 * 
 * 关键代码：
 * - TimeCalendar.tsx: handleSelectDateTime
 * - ToastUIReactCalendar.tsx: bindEventHandlers (驼峰转换)
 */

console.log('📋 Time Selection Test Guide');
console.log('');
console.log('✅ Expected Behavior:');
console.log('1. Click and drag on empty time slot');
console.log('2. EventEditModal opens with pre-filled time');
console.log('3. Fill in event details (title, calendar, tags)');
console.log('4. Save creates new event');
console.log('');
console.log('❌ Bug (before fix):');
console.log('- Time slot stays selected (gray highlight)');
console.log('- No modal appears');
console.log('- Cannot cancel selection');
console.log('- Have to refresh page');
console.log('');
console.log('🔧 Changes Made:');
console.log('- Added handleSelectDateTime in TimeCalendar');
console.log('- Blocked handleBeforeCreateEvent (returns false)');
console.log('- Fixed event name conversion in ToastUIReactCalendar');
console.log('  (onSelectDateTime -> selectDateTime, not selectdatetime)');
console.log('');
console.log('🧪 Debug Commands:');
console.log('');
console.log('// Check if selectDateTime is bound');
console.log('const calendar = document.querySelector(".toastui-calendar");');
console.log('console.log(calendar);');
console.log('');
console.log('// Monitor events');
console.log('window.addEventListener("local-events-changed", (e) => {');
console.log('  console.log("Event changed:", e.detail);');
console.log('});');
