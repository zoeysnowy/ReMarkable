/**
 * 联系人调试工具
 * 在浏览器控制台执行这些命令来诊断问题
 */

// === 1. 检查当前联系人库 ===
console.log('='.repeat(60));
console.log('📊 检查联系人库');
console.log('='.repeat(60));

const contacts = JSON.parse(localStorage.getItem('remarkable-contacts') || '[]');
console.log('联系人总数:', contacts.length);
console.table(contacts.map(c => ({
  姓名: c.name,
  邮箱: c.email || '(无)',
  公司: c.organization || '(无)',
  来源: c.isOutlook ? 'Outlook' : c.isGoogle ? 'Google' : c.isiCloud ? 'iCloud' : c.isReMarkable ? 'ReMarkable' : '(未标记)'
})));

// === 2. 检查演示事件的参会人数据 ===
console.log('\n' + '='.repeat(60));
console.log('🔍 检查演示事件数据');
console.log('='.repeat(60));

const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const demoEvent = events.find(e => e.title?.includes('产品') || e.id === 'event-1');

if (demoEvent) {
  console.log('找到演示事件:', demoEvent.title || demoEvent.id);
  console.log('Organizer:', demoEvent.organizer);
  console.log('Attendees:', demoEvent.attendees);
} else {
  console.log('❌ 未找到演示事件');
  console.log('所有事件标题:', events.map(e => e.title || e.id));
}

// === 3. 测试搜索功能 ===
console.log('\n' + '='.repeat(60));
console.log('🔎 测试搜索功能');
console.log('='.repeat(60));

// 搜索 "Zoey"
const searchQuery = 'Zoey';
const searchResults = contacts.filter(c => 
  c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
  c.email?.toLowerCase().includes(searchQuery.toLowerCase())
);

console.log(`搜索 "${searchQuery}" 的结果数:`, searchResults.length);
if (searchResults.length > 0) {
  console.table(searchResults.map(c => ({
    姓名: c.name,
    邮箱: c.email,
    ID: c.id
  })));
} else {
  console.log('❌ 无搜索结果');
}

// === 4. 手动触发提取联系人 ===
console.log('\n' + '='.repeat(60));
console.log('🔧 手动测试联系人提取');
console.log('='.repeat(60));

const testOrganizer = {
  name: 'Zoey Gong',
  email: 'zoey.gong@company.com',
  organization: '产品部',
  position: '产品经理'
};

const testAttendees = [
  {
    name: 'Jenny Wong',
    email: 'jenny.wong@company.com',
    organization: '设计部'
  },
  {
    name: 'Cindy Cai',
    email: 'cindy.cai@company.com',
    organization: '研发部'
  }
];

console.log('准备提取以下联系人:');
console.log('- Organizer:', testOrganizer.name, testOrganizer.email);
console.log('- Attendees:', testAttendees.map(a => `${a.name} (${a.email})`).join(', '));

// 注意：需要先确保 ContactService 已初始化
if (typeof ContactService !== 'undefined') {
  ContactService.extractAndAddFromEvent(testOrganizer, testAttendees);
  console.log('✅ 已手动触发联系人提取');
  
  // 重新检查联系人库
  const updatedContacts = JSON.parse(localStorage.getItem('remarkable-contacts') || '[]');
  console.log('更新后联系人总数:', updatedContacts.length);
} else {
  console.log('❌ ContactService 未定义，需要在实际页面中执行');
}

// === 5. 诊断建议 ===
console.log('\n' + '='.repeat(60));
console.log('💡 诊断建议');
console.log('='.repeat(60));

if (contacts.length === 0) {
  console.log('⚠️ 联系人库为空！可能原因:');
  console.log('  1. 事件从未被保存（只更新了UI状态）');
  console.log('  2. EventService.saveEvent() 未被调用');
  console.log('  3. ContactService.extractAndAddFromEvent() 未被调用');
  console.log('  4. localStorage 被清空');
} else {
  console.log('✅ 联系人库不为空，共', contacts.length, '个联系人');
}

if (!demoEvent || !demoEvent.organizer) {
  console.log('⚠️ 演示事件缺少 organizer 数据！');
  console.log('  - 检查 EventEditModalV2Demo 中的 formData 初始化');
}

if (!demoEvent || !demoEvent.attendees || demoEvent.attendees.length === 0) {
  console.log('⚠️ 演示事件缺少 attendees 数据！');
  console.log('  - 检查 EventEditModalV2Demo 中的 formData 初始化');
}

console.log('\n📋 下一步操作:');
console.log('1. 在 EventEditModalV2Demo 中点击任意参会人');
console.log('2. 添加一个新的参会人（带邮箱）');
console.log('3. 观察控制台是否有 "👥 Auto-extracted contacts" 输出');
console.log('4. 重新运行此脚本检查联系人库是否增加');
