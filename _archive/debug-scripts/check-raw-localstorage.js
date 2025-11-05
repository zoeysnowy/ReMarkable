/**
 * 直接检查 localStorage 中的原始数据
 */

console.log('='.repeat(80));
console.log('🔍 检查 localStorage 原始数据');
console.log('='.repeat(80));
console.log('');

const STORAGE_KEY = 'remarkable-events';
const rawData = localStorage.getItem(STORAGE_KEY);

if (!rawData) {
  console.error('❌ localStorage 中没有数据');
} else {
  try {
    const events = JSON.parse(rawData);
    
    const targetId = 'local-1761808870380';  // 🔮ReMarkable开发
    const event = events.find(e => e.id === targetId);
    
    if (!event) {
      console.log('❌ 事件不存在');
    } else {
      console.log('📄 Event 完整数据:');
      console.log('');
      console.log(`ID: ${event.id}`);
      console.log(`标题: ${event.title}`);
      console.log(`remarkableSource: ${event.remarkableSource}`);
      console.log(`syncStatus: ${event.syncStatus}`);
      console.log('');
      
      // 检查 description
      if (event.description) {
        console.log('✅ Description 存在:');
        console.log('---');
        console.log(event.description);
        console.log('---');
        console.log(`长度: ${event.description.length} 字符`);
      } else {
        console.log('❌ Description 为空或不存在');
        console.log(`   description 字段值: ${JSON.stringify(event.description)}`);
      }
      
      console.log('');
      console.log('📋 所有字段:');
      Object.keys(event).forEach(key => {
        const value = event[key];
        const valueStr = typeof value === 'string' && value.length > 50 
          ? value.substring(0, 50) + '...'
          : JSON.stringify(value);
        console.log(`   ${key}: ${valueStr}`);
      });
    }
    
  } catch (error) {
    console.error('❌ 解析失败:', error);
  }
}

console.log('');
console.log('='.repeat(80));
console.log('💡 如果 description 确实丢失:');
console.log('='.repeat(80));
console.log('');
console.log('可能的恢复方法:');
console.log('1. 浏览器开发者工具 → Application → Storage → Local Storage');
console.log('   检查是否有旧版本的数据');
console.log('');
console.log('2. 检查浏览器历史记录/缓存恢复工具');
console.log('');
console.log('3. 如果曾同步到 Outlook，可能还在 Outlook 里');
console.log('   - 登录 Outlook Web (outlook.office.com)');
console.log('   - 搜索事件标题');
console.log('   - 检查 description/notes 字段');
