/**
 * 测试事件去重逻辑
 * 
 * 使用方法：
 * 1. 打开浏览器开发者工具
 * 2. 复制粘贴此脚本到 Console
 * 3. 检查输出，确认重复事件已被正确清理
 */

(function testDeduplication() {
  console.log('🧪 [Test] Starting deduplication test...');
  
  // 1. 获取当前事件
  const savedEvents = localStorage.getItem('remarkable-events');
  if (!savedEvents) {
    console.error('❌ No events found in localStorage');
    return;
  }
  
  const events = JSON.parse(savedEvents);
  console.log(`📊 Total events: ${events.length}`);
  
  // 2. 检测重复
  const externalIdMap = new Map();
  const duplicates = [];
  
  events.forEach(event => {
    if (event.externalId) {
      const existing = externalIdMap.get(event.externalId) || [];
      existing.push(event);
      externalIdMap.set(event.externalId, existing);
    }
  });
  
  externalIdMap.forEach((group, externalId) => {
    if (group.length > 1) {
      duplicates.push({
        externalId,
        count: group.length,
        events: group.map(e => ({
          id: e.id,
          title: e.title,
          lastSyncTime: e.lastSyncTime,
          calendarId: e.calendarId
        }))
      });
    }
  });
  
  if (duplicates.length === 0) {
    console.log('✅ No duplicates found!');
    return;
  }
  
  console.warn(`⚠️ Found ${duplicates.length} duplicate groups:`);
  duplicates.forEach((dup, index) => {
    console.log(`\n📋 Duplicate Group ${index + 1}:`);
    console.log(`   externalId: ${dup.externalId}`);
    console.log(`   count: ${dup.count}`);
    dup.events.forEach((evt, idx) => {
      console.log(`   [${idx + 1}] ${evt.title}`);
      console.log(`       id: ${evt.id}`);
      console.log(`       calendarId: ${evt.calendarId}`);
      console.log(`       lastSyncTime: ${evt.lastSyncTime || 'N/A'}`);
    });
  });
  
  // 3. 模拟去重（不实际保存）
  console.log('\n🔄 Simulating deduplication...');
  
  const uniqueEvents = [];
  const seenExternalIds = new Set();
  
  events.forEach(event => {
    if (!event.externalId) {
      uniqueEvents.push(event);
      return;
    }
    
    if (seenExternalIds.has(event.externalId)) {
      const existingIndex = uniqueEvents.findIndex(e => e.externalId === event.externalId);
      if (existingIndex !== -1) {
        const existing = uniqueEvents[existingIndex];
        const existingTime = existing.lastSyncTime ? new Date(existing.lastSyncTime).getTime() : 0;
        const currentTime = event.lastSyncTime ? new Date(event.lastSyncTime).getTime() : 0;
        
        if (currentTime > existingTime) {
          console.log(`   🔄 Would replace: ${existing.id} → ${event.id}`);
          uniqueEvents[existingIndex] = event;
        } else {
          console.log(`   🗑️ Would remove: ${event.id} (keeping ${existing.id})`);
        }
      }
    } else {
      seenExternalIds.add(event.externalId);
      uniqueEvents.push(event);
    }
  });
  
  console.log(`\n✅ Deduplication result: ${events.length} → ${uniqueEvents.length} events`);
  console.log(`   Removed: ${events.length - uniqueEvents.length} duplicates`);
  
  // 4. 询问是否应用
  console.log('\n❓ To apply deduplication, trigger a sync or wait for next sync cycle.');
  console.log('   The deduplicateEvents() method will run automatically.');
})();
