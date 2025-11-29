/**
 * 检查事件历史记录脚本
 * 
 * 验证 EventHistoryService 是否正确记录了事件的创建历史
 */

(function() {
  console.log('='.repeat(80));
  console.log('🔍 检查事件历史记录');
  console.log('='.repeat(80));
  
  // 1. 读取事件数据
  const eventsData = localStorage.getItem('remarkable-events');
  if (!eventsData) {
    console.error('❌ 未找到事件数据！');
    return;
  }
  
  const allEvents = JSON.parse(eventsData);
  console.log(`📦 总事件数: ${allEvents.length}`);
  
  // 2. 读取历史记录
  const historyData = localStorage.getItem('remarkable_event_history');
  if (!historyData) {
    console.error('❌ 未找到历史记录数据！');
    console.log('\n这说明 EventHistoryService 没有记录任何历史！');
    return;
  }
  
  const allHistory = JSON.parse(historyData);
  console.log(`📚 历史记录总数: ${allHistory.length}`);
  
  // 3. 查找昨天创建的事件
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);
  
  const yesterdayEvents = allEvents.filter(e => {
    if (!e.createdAt) return false;
    const createdAt = new Date(e.createdAt);
    return createdAt >= yesterdayStart && createdAt <= yesterdayEnd;
  });
  
  console.log(`\n🆕 昨天创建的事件数: ${yesterdayEvents.length}`);
  
  // 4. 检查每个事件的历史记录
  console.log('\n📋 历史记录检查：\n');
  
  yesterdayEvents.forEach((event, index) => {
    console.log(`\n--- 事件 #${index + 1}: ${event.title?.simpleTitle || event.title?.colorTitle || '(无标题)'} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`创建时间: ${event.createdAt}`);
    console.log(`isPlan: ${event.isPlan}`);
    console.log(`isTimeCalendar: ${event.isTimeCalendar}`);
    
    // 查找该事件的所有历史记录
    const eventHistory = allHistory.filter(h => h.eventId === event.id);
    
    if (eventHistory.length === 0) {
      console.log(`\n❌ 未找到历史记录！`);
      console.log(`   这就是为什么它不显示在 snapshot 模式的原因！`);
    } else {
      console.log(`\n✅ 找到 ${eventHistory.length} 条历史记录:`);
      
      // 按时间排序
      const sorted = eventHistory.sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return timeA - timeB;
      });
      
      sorted.forEach((h, i) => {
        console.log(`  ${i + 1}. ${h.operation} - ${h.timestamp} (source: ${h.source})`);
        if (h.changes) {
          console.log(`     变更字段: ${h.changes.map(c => c.field).join(', ')}`);
        }
      });
      
      // 检查是否有 create 操作
      const hasCreateLog = sorted.some(h => h.operation === 'create');
      if (!hasCreateLog) {
        console.log(`\n⚠️ 警告：没有找到 'create' 操作的历史记录！`);
      }
    }
  });
  
  // 5. 统计历史记录的操作类型
  console.log('\n' + '='.repeat(80));
  console.log('📊 历史记录统计:');
  console.log('='.repeat(80));
  
  const operationCounts = allHistory.reduce((acc, h) => {
    acc[h.operation] = (acc[h.operation] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n操作类型分布:');
  Object.entries(operationCounts).forEach(([op, count]) => {
    console.log(`  ${op}: ${count} 次`);
  });
  
  // 6. 检查最近的历史记录
  const recent = allHistory
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 10);
  
  console.log('\n最近 10 条历史记录:');
  recent.forEach((h, i) => {
    const event = allEvents.find(e => e.id === h.eventId);
    const title = event?.title?.simpleTitle || event?.title?.colorTitle || '(已删除)';
    console.log(`  ${i + 1}. ${h.operation} - ${title} - ${h.timestamp}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 检查完成');
  console.log('='.repeat(80));
})();
