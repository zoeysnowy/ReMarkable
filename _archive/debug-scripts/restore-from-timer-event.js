/**
 * ⚠️ 在浏览器控制台运行
 * 从 timer 事件复制 description 到原始事件
 */

const STORAGE_KEY = 'remarkable-events';
const originalEventId = 'local-1761808870380';
const timerEventId = 'timer-tag-1761311845967-vizj8k-1762152480000';

console.log('='.repeat(80));
console.log('🔧 从 timer 事件恢复 description 到原始事件');
console.log('='.repeat(80));
console.log('');

try {
  const rawData = localStorage.getItem(STORAGE_KEY);
  if (!rawData) {
    console.error('❌ localStorage 中没有数据');
  } else {
    const events = JSON.parse(rawData);
    
    const originalEvent = events.find(e => e.id === originalEventId);
    const timerEvent = events.find(e => e.id === timerEventId);
    
    if (!originalEvent) {
      console.error(`❌ 原始事件 ${originalEventId} 不存在`);
    } else if (!timerEvent) {
      console.error(`❌ Timer 事件 ${timerEventId} 不存在`);
    } else {
      console.log(`✅ 找到原始事件: ${originalEvent.title}`);
      console.log(`   Description: ${originalEvent.description ? `${originalEvent.description.length} 字符` : '(空)'}`);
      console.log('');
      console.log(`✅ 找到 timer 事件: ${timerEvent.title}`);
      console.log(`   Description: ${timerEvent.description ? `${timerEvent.description.length} 字符` : '(空)'}`);
      console.log('');
      
      if (timerEvent.description && timerEvent.description.length > 0) {
        // 备份
        const backup = JSON.stringify(events);
        console.log('💾 已创建备份');
        console.log('');
        
        // 复制 description
        originalEvent.description = timerEvent.description;
        originalEvent.updatedAt = new Date().toISOString();
        
        // 保存
        localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
        
        console.log('✅ 恢复成功！');
        console.log(`已将 timer 事件的 description (${timerEvent.description.length} 字符) 复制到原始事件`);
        console.log('');
        console.log('🔄 请刷新页面查看效果: location.reload()');
      } else {
        console.error('❌ Timer 事件的 description 也是空的，无法恢复');
      }
    }
  }
} catch (error) {
  console.error('❌ 错误:', error);
}
