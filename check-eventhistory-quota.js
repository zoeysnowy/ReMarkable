/**
 * 检查 EventHistory localStorage 配额使用情况
 */

// 读取 EventHistory 数据
const historyData = localStorage.getItem('remarkable_event_history');

if (!historyData) {
  console.log('❌ 没有找到 remarkable_event_history 数据');
} else {
  const logs = JSON.parse(historyData);
  
  console.log('📊 EventHistory 统计:');
  console.log('  - 记录总数:', logs.length);
  console.log('  - 数据大小:', (historyData.length / 1024).toFixed(2), 'KB');
  console.log('  - 平均每条:', (historyData.length / logs.length).toFixed(0), 'bytes');
  
  // 分析前 5 条记录
  console.log('\n🔍 前 5 条记录的 eventId:');
  logs.slice(0, 5).forEach((log, i) => {
    console.log(`  ${i + 1}. eventId: "${log.eventId}" (长度: ${log.eventId?.length || 0})`);
    console.log(`     operation: ${log.operation}, timestamp: ${log.timestamp}`);
  });
  
  // 检查 eventId 长度分布
  const idLengths = logs.map(log => log.eventId?.length || 0);
  const minLen = Math.min(...idLengths);
  const maxLen = Math.max(...idLengths);
  const avgLen = (idLengths.reduce((a, b) => a + b, 0) / idLengths.length).toFixed(1);
  
  console.log('\n📏 eventId 长度统计:');
  console.log(`  - 最短: ${minLen}`);
  console.log(`  - 最长: ${maxLen}`);
  console.log(`  - 平均: ${avgLen}`);
  
  // 找出异常短的 eventId
  const shortIds = logs.filter(log => (log.eventId?.length || 0) < 20);
  if (shortIds.length > 0) {
    console.log(`\n⚠️ 发现 ${shortIds.length} 个异常短的 eventId (<20字符):`);
    shortIds.slice(0, 3).forEach(log => {
      console.log(`  - "${log.eventId}" (${log.operation} at ${log.timestamp})`);
    });
  }
  
  // 操作类型统计
  const opCounts = logs.reduce((acc, log) => {
    acc[log.operation] = (acc[log.operation] || 0) + 1;
    return acc;
  }, {});
  
  console.log('\n📈 操作类型分布:');
  Object.entries(opCounts).forEach(([op, count]) => {
    console.log(`  - ${op}: ${count}`);
  });
}
