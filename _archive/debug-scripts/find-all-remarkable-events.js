/**
 * ⚠️ 在浏览器控制台运行
 * 查找所有相关的事件，包括 timer 事件
 */

console.log('='.repeat(80));
console.log('🔍 查找所有 ReMarkable开发 相关事件');
console.log('='.repeat(80));
console.log('');

const rawData = localStorage.getItem('remarkable-events');
if (!rawData) {
  console.error('❌ 没有数据');
} else {
  const events = JSON.parse(rawData);
  
  // 查找所有标题包含 "ReMarkable开发" 的事件
  const relatedEvents = events.filter(e => 
    e.title && e.title.includes('ReMarkable开发')
  );
  
  console.log(`📊 找到 ${relatedEvents.length} 个相关事件：`);
  console.log('');
  
  relatedEvents.forEach((event, index) => {
    console.log(`--- 事件 ${index + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`Title: ${event.title}`);
    console.log(`StartTime: ${event.startTime}`);
    console.log(`remarkableSource: ${event.remarkableSource}`);
    console.log(`syncStatus: ${event.syncStatus}`);
    console.log(`externalId: ${event.externalId || '(无)'}`);
    console.log(`Description 长度: ${event.description ? event.description.length : 0} 字符`);
    
    if (event.description && event.description.length > 0) {
      console.log(`✅ Description 存在！预览:`);
      console.log(event.description.substring(0, 100) + '...');
    } else {
      console.log(`❌ Description: ${JSON.stringify(event.description)}`);
    }
    
    console.log('');
  });
  
  // 特别检查原始事件
  console.log('='.repeat(80));
  console.log('🎯 检查原始事件 local-1761808870380:');
  console.log('='.repeat(80));
  
  const originalEvent = events.find(e => e.id === 'local-1761808870380');
  if (originalEvent) {
    console.log('找到原始事件！');
    console.log('完整对象:');
    console.log(originalEvent);
  } else {
    console.log('❌ 原始事件不存在');
  }
  
  // 检查 timer 事件
  console.log('');
  console.log('='.repeat(80));
  console.log('⏱️ 检查 timer 事件:');
  console.log('='.repeat(80));
  
  const timerEvent = events.find(e => e.id === 'timer-tag-1761311845967-vizj8k-1762152480000');
  if (timerEvent) {
    console.log('找到 timer 事件！');
    console.log('完整对象:');
    console.log(timerEvent);
  } else {
    console.log('❌ Timer 事件不存在');
  }
}
