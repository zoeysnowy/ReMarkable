/**
 * 尝试恢复丢失的 description
 */

console.log('='.repeat(80));
console.log('🔍 尝试恢复 description');
console.log('='.repeat(80));
console.log('');

const targetId = 'local-1761808870380';
console.log(`目标事件 ID: ${targetId}`);
console.log(`标题: 🔮ReMarkable开发`);
console.log('');

// 1. 检查当前 localStorage
console.log('1️⃣ 检查当前 localStorage:');
console.log('---');
const eventsStr = localStorage.getItem('remarkable-events');
if (eventsStr) {
  const events = JSON.parse(eventsStr);
  const event = events.find(e => e.id === targetId);
  
  if (event) {
    console.log(`   description: ${event.description || 'null'}`);
    if (event.description) {
      console.log('');
      console.log('   完整内容:');
      console.log('   ' + '-'.repeat(70));
      console.log(event.description);
      console.log('   ' + '-'.repeat(70));
      console.log('');
      console.log('   ✅ Description 还在！');
    } else {
      console.log('   ❌ Description 已丢失');
    }
  } else {
    console.log('   ❌ 事件不存在');
  }
} else {
  console.log('   ❌ localStorage 为空');
}
console.log('');

// 2. 检查浏览器的 IndexedDB（如果有备份）
console.log('2️⃣ 检查浏览器存储:');
console.log('---');
console.log('   提示: 部分浏览器会自动备份 localStorage');
console.log('   - Chrome: 开发者工具 > Application > Storage > IndexedDB');
console.log('   - Firefox: about:debugging > Storage Inspector');
console.log('');

// 3. 检查 Outlook（如果已同步）
console.log('3️⃣ 检查 Outlook:');
console.log('---');
const msService = window.microsoftCalendarService;
if (msService && msService.isSignedIn?.()) {
  console.log('   ✅ 已登录 Microsoft');
  console.log('   ');
  console.log('   请手动搜索事件:');
  console.log('   1. 打开 Outlook 日历');
  console.log('   2. 搜索 "🔮ReMarkable开发"');
  console.log('   3. 日期: 2025-10-30');
  console.log('   4. 如果找到，查看 description/备注字段');
} else {
  console.log('   ❌ 未登录 Microsoft');
}
console.log('');

// 4. 建议
console.log('4️⃣ 恢复建议:');
console.log('---');
console.log('如果 description 真的丢失:');
console.log('');
console.log('方案 A: 检查浏览器历史');
console.log('   - Chrome: chrome://history/');
console.log('   - 找到修改前的页面');
console.log('   - 使用 "缓存查看器" 工具查看历史快照');
console.log('');
console.log('方案 B: 检查系统备份');
console.log('   - Windows: 文件历史记录');
console.log('   - 查找: %LocalAppData%\\Google\\Chrome\\User Data\\Default\\Local Storage');
console.log('');
console.log('方案 C: 如果之前同步过 Outlook');
console.log('   - Outlook 的 description 可能还保留着');
console.log('   - 可以从 Outlook 复制回来');
console.log('');
console.log('方案 D: 防止未来丢失');
console.log('   - 重要内容建议用 Ctrl+C 备份到剪贴板');
console.log('   - 或使用外部笔记工具（Notion/Obsidian）作为主存储');
