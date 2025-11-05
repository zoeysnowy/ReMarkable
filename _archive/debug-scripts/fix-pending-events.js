/**
 * 一次性修复脚本：为历史 pending events 添加 remarkableSource 字段
 * 
 * 问题：10月-11月初创建的事件没有 remarkableSource 字段，导致无法同步
 * 解决：批量为这些事件添加 remarkableSource = true
 */

console.log('🔧 开始修复历史 pending events...');
console.log('');

const STORAGE_KEY = 'remarkable-events';
const events = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');

console.log(`📊 总事件数: ${events.length}`);

// 查找需要修复的事件
const needsFix = events.filter(e => 
  e.syncStatus === 'pending' && 
  !e.remarkableSource && 
  !e.externalId &&
  e.id?.startsWith('local-')
);

console.log(`🔍 需要修复的事件: ${needsFix.length}`);
console.log('');

if (needsFix.length === 0) {
  console.log('✅ 没有需要修复的事件');
} else {
  console.log('📋 事件列表:');
  needsFix.forEach((evt, idx) => {
    console.log(`${idx + 1}. ${evt.title}`);
    console.log(`   ID: ${evt.id}`);
    console.log(`   创建时间: ${evt.createdAt}`);
    console.log(`   开始时间: ${evt.startTime}`);
  });
  console.log('');
  
  // 修复
  let fixedCount = 0;
  events.forEach(evt => {
    if (evt.syncStatus === 'pending' && 
        !evt.remarkableSource && 
        !evt.externalId &&
        evt.id?.startsWith('local-')) {
      evt.remarkableSource = true;
      fixedCount++;
    }
  });
  
  // 保存
  localStorage.setItem(STORAGE_KEY, JSON.stringify(events));
  
  console.log(`✅ 已修复 ${fixedCount} 个事件`);
  console.log('');
  console.log('🔄 请刷新页面，让 fixOrphanedPendingEvents() 重新扫描');
}
