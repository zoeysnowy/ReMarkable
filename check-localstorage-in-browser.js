/**
 * ⚠️ 在浏览器控制台运行此脚本，不是在 Node.js！
 * 
 * 使用方法：
 * 1. 打开应用页面
 * 2. 按 F12 打开开发者工具
 * 3. 切换到 Console 标签
 * 4. 复制粘贴此脚本并运行
 */

console.log('='.repeat(80));
console.log('🔍 检查浏览器 localStorage 中的事件数据');
console.log('='.repeat(80));
console.log('');

const STORAGE_KEY = 'remarkable-events';
const targetId = 'local-1761808870380';

try {
  const rawData = localStorage.getItem(STORAGE_KEY);
  
  if (!rawData) {
    console.error('❌ localStorage 中没有 remarkable-events 数据');
  } else {
    console.log(`✅ 找到 localStorage 数据，大小: ${(rawData.length / 1024).toFixed(2)} KB`);
    
    const events = JSON.parse(rawData);
    console.log(`📊 总事件数: ${events.length}`);
    console.log('');
    
    const event = events.find(e => e.id === targetId);
    
    if (!event) {
      console.error(`❌ 事件 ${targetId} 不存在`);
    } else {
      console.log(`📝 事件: ${event.title}`);
      console.log(`ID: ${event.id}`);
      console.log(`remarkableSource: ${event.remarkableSource}`);
      console.log(`syncStatus: ${event.syncStatus}`);
      console.log('');
      
      // 检查 description
      console.log('=== Description 字段 ===');
      if (event.description) {
        console.log('✅ Description 存在！');
        console.log(`长度: ${event.description.length} 字符`);
        console.log('内容:');
        console.log('---');
        console.log(event.description);
        console.log('---');
      } else {
        console.error('❌ Description 为空或不存在');
        console.log(`description 字段值: ${JSON.stringify(event.description)}`);
        console.log(`类型: ${typeof event.description}`);
      }
      
      console.log('');
      console.log('=== 完整事件对象 ===');
      console.log(event);
    }
  }
  
  // 同时检查 EventService 的缓存
  console.log('');
  console.log('='.repeat(80));
  console.log('🔍 检查 EventService 缓存');
  console.log('='.repeat(80));
  
  if (window.EventService) {
    const allEvents = window.EventService.getAllEvents();
    const cachedEvent = allEvents.find(e => e.id === targetId);
    
    if (cachedEvent) {
      console.log('📝 EventService 缓存中的事件:');
      console.log(`ID: ${cachedEvent.id}`);
      console.log(`Title: ${cachedEvent.title}`);
      
      if (cachedEvent.description) {
        console.log('✅ Description 存在！');
        console.log(`长度: ${cachedEvent.description.length} 字符`);
      } else {
        console.error('❌ Description 为空或不存在');
        console.log(`description 字段值: ${JSON.stringify(cachedEvent.description)}`);
      }
      
      console.log('');
      console.log('完整对象:');
      console.log(cachedEvent);
    } else {
      console.error('❌ EventService 缓存中找不到该事件');
    }
  } else {
    console.warn('⚠️ window.EventService 不存在');
  }
  
} catch (error) {
  console.error('❌ 错误:', error);
}

console.log('');
console.log('='.repeat(80));
console.log('💡 如果 localStorage 和 EventService 的数据不一致：');
console.log('='.repeat(80));
console.log('说明可能是：');
console.log('1. 页面刷新后 EventService 缓存未正确加载');
console.log('2. 某些操作修改了 localStorage 但未更新缓存');
console.log('3. 或反之：修改了缓存但未写入 localStorage');
console.log('');
console.log('建议执行：');
console.log('location.reload()  // 刷新页面重新加载');
