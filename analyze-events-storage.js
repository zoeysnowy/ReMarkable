/**
 * 分析 remarkable-events localStorage 存储
 */

const eventsData = localStorage.getItem('remarkable-events');

if (!eventsData) {
  console.log('❌ 没有找到 remarkable-events 数据');
} else {
  const events = JSON.parse(eventsData);
  
  console.log('📊 Events 存储分析:');
  console.log('  - 事件总数:', events.length);
  console.log('  - 数据大小:', (eventsData.length / 1024 / 1024).toFixed(2), 'MB');
  console.log('  - 平均每个事件:', (eventsData.length / events.length / 1024).toFixed(2), 'KB');
  
  // 按来源统计
  const sources = events.reduce((acc, e) => {
    const src = e.source || 'local';
    acc[src] = (acc[src] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 来源分布:');
  Object.entries(sources).forEach(([src, count]) => {
    console.log(`  - ${src}: ${count}`);
  });
  
  // 检查 eventlog 大小
  let totalEventlogSize = 0;
  let emptyEventlogs = 0;
  let largeEventlogs = [];
  
  events.forEach(e => {
    if (!e.eventlog || e.eventlog.slateJson === '[]') {
      emptyEventlogs++;
    } else {
      const size = JSON.stringify(e.eventlog).length;
      totalEventlogSize += size;
      if (size > 10000) { // 超过 10KB
        largeEventlogs.push({
          id: e.id,
          title: e.title?.simpleTitle || e.title,
          size: (size / 1024).toFixed(2) + ' KB'
        });
      }
    }
  });
  
  console.log('\n📝 Eventlog 分析:');
  console.log('  - 空 eventlog 数量:', emptyEventlogs);
  console.log('  - Eventlog 总大小:', (totalEventlogSize / 1024 / 1024).toFixed(2), 'MB');
  console.log('  - 超大 eventlog (>10KB):', largeEventlogs.length, '个');
  
  if (largeEventlogs.length > 0) {
    console.log('\n🔍 最大的 5 个 eventlog:');
    largeEventlogs.sort((a, b) => parseFloat(b.size) - parseFloat(a.size))
      .slice(0, 5)
      .forEach(e => {
        console.log(`  - ${e.title}: ${e.size}`);
        console.log(`    ID: ${e.id.slice(0, 50)}...`);
      });
  }
  
  // 检查已完成/已删除的事件
  const completed = events.filter(e => e.isCompleted || e.status === 'completed').length;
  const deleted = events.filter(e => e.deleted || e.isDeleted).length;
  
  console.log('\n🗂️ 状态分布:');
  console.log('  - 已完成:', completed);
  console.log('  - 已删除:', deleted);
  console.log('  - 活跃:', events.length - completed - deleted);
  
  // 检查是否有重复
  const ids = events.map(e => e.id);
  const uniqueIds = new Set(ids);
  if (ids.length !== uniqueIds.size) {
    console.log('\n⚠️ 发现重复事件:', ids.length - uniqueIds.size, '个');
  }
}
