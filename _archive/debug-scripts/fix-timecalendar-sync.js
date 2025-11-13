// 🔧 TimeCalendar 同步问题修复脚本
// 在浏览器 Console 中运行

console.log('🔧 === TimeCalendar 同步问题诊断与修复 ===\n');

// ========================================
// 1. 检查当前设置
// ========================================
console.log('📋 [步骤 1/3] 检查当前同步设置...');

const settingsKey = 'remarkable-settings';
const settingsStr = localStorage.getItem(settingsKey);
let settings = settingsStr ? JSON.parse(settingsStr) : {};

console.log('当前设置:', settings);
console.log('  - ongoingDays:', settings.ongoingDays ?? settings.ongoing ?? '(未设置，默认 1)');
console.log('  - selectedCalendarGroups:', settings.selectedCalendarGroups ?? '(未设置，默认全部)');

// ========================================
// 2. 分析问题
// ========================================
console.log('\n🔍 [步骤 2/3] 分析同步范围限制...');

const ongoingDays = settings.ongoingDays ?? settings.ongoing ?? 1;
const now = new Date();
const startDate = new Date(now);
startDate.setDate(now.getDate() - ongoingDays - 1);
startDate.setHours(0, 0, 0, 0);

const endDate = new Date(now);
endDate.setDate(now.getDate() + 2);
endDate.setHours(23, 59, 59, 999);

console.log('📅 当前同步范围:');
console.log(`  - 开始日期: ${startDate.toLocaleDateString()} (往前 ${ongoingDays} 天)`);
console.log(`  - 结束日期: ${endDate.toLocaleDateString()} (往后 2 天)`);
console.log(`  - 总天数: ${Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24))} 天`);

console.log('\n⚠️ 问题分析:');
console.log('  同步服务默认只获取过去 1 天到未来 2 天的事件（共 3 天）');
console.log('  而 TimeCalendar 显示的是 ±3 个月的范围（共 180 天）');
console.log('  这导致大部分事件没有被同步到 localStorage');

// ========================================
// 3. 提供修复方案
// ========================================
console.log('\n🛠️ [步骤 3/3] 修复方案...');

console.log('\n方案 A: 扩大同步范围（推荐）');
console.log('将同步范围从 ±1 天扩大到 ±90 天，匹配 TimeCalendar 的显示范围');
console.log('\n执行以下代码:');

const fixCode = `
// 修改设置：扩大同步范围到 90 天
const settings = localStorage.getItem('remarkable-settings');
const settingsObj = settings ? JSON.parse(settings) : {};
settingsObj.ongoingDays = 90; // 过去 90 天
localStorage.setItem('remarkable-settings', JSON.stringify(settingsObj));

console.log('✅ 设置已更新，同步范围扩大到 90 天');
console.log('🔄 正在触发重新同步...');

// 触发重新同步
window.dispatchEvent(new CustomEvent('force-sync-outlook'));

console.log('✅ 重新同步已触发，请等待 5-10 秒...');
console.log('💡 刷新页面后应该能看到所有事件');
`;

console.log(fixCode);

console.log('\n方案 B: 手动触发当前设置的同步');
console.log('使用当前设置的同步范围重新同步一次');
console.log('\n执行以下代码:');

const reSyncCode = `
// 触发重新同步
window.dispatchEvent(new CustomEvent('force-sync-outlook'));
console.log('✅ 重新同步已触发，请等待 5-10 秒...');
`;

console.log(reSyncCode);

// ========================================
// 自动应用修复？
// ========================================
console.log('\n🤖 [自动修复]');
console.log('是否要立即应用方案 A（扩大同步范围到 90 天）？');
console.log('\n如果确定，运行以下代码:');
console.log('applyFix()');

window.applyFix = function() {
  console.log('🚀 正在应用修复...');
  
  // 1. 更新设置
  const settings = localStorage.getItem('remarkable-settings');
  const settingsObj = settings ? JSON.parse(settings) : {};
  const oldOngoingDays = settingsObj.ongoingDays ?? settingsObj.ongoing ?? 1;
  settingsObj.ongoingDays = 90;
  localStorage.setItem('remarkable-settings', JSON.stringify(settingsObj));
  
  console.log(`✅ 同步范围已从 ${oldOngoingDays} 天扩大到 90 天`);
  
  // 2. 触发重新同步
  console.log('🔄 正在触发重新同步...');
  window.dispatchEvent(new CustomEvent('force-sync-outlook'));
  
  // 3. 提示
  console.log('\n✅ 修复已应用！');
  console.log('💡 请等待 5-10 秒让同步完成');
  console.log('💡 然后刷新页面查看效果');
  
  // 4. 倒计时刷新
  let countdown = 10;
  const countdownInterval = setInterval(() => {
    console.log(`⏱️ 同步进行中... 将在 ${countdown} 秒后自动刷新页面`);
    countdown--;
    
    if (countdown === 0) {
      clearInterval(countdownInterval);
      console.log('🔄 刷新页面...');
      location.reload();
    }
  }, 1000);
  
  console.log('💡 如果想取消自动刷新，关闭此 Console 标签页即可');
};

console.log('\n🔍 === 诊断完成 ===');
