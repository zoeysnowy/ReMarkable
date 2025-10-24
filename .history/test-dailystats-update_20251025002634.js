/**
 * 测试今日统计实时更新
 * 在浏览器控制台运行此脚本
 */

console.log('🧪 [Test] 开始测试今日统计实时更新...\n');

// 1. 获取当前事件
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
console.log('📊 [Test] 当前事件数量:', events.length);

// 2. 找到一个今天的事件
const today = new Date().toDateString();
const todayEvents = events.filter(e => new Date(e.startTime).toDateString() === today);
console.log('📅 [Test] 今日事件数量:', todayEvents.length);

if (todayEvents.length === 0) {
  console.log('⚠️ [Test] 没有今日事件可以测试，请先创建一个今日事件');
  console.log('💡 建议：开启一个 Timer 或在 TimeCalendar 创建一个今日事件');
} else {
  const testEvent = todayEvents[0];
  console.log('🎯 [Test] 选择测试事件:', {
    id: testEvent.id,
    title: testEvent.title,
    tags: testEvent.tags,
    startTime: testEvent.startTime,
    endTime: testEvent.endTime
  });
  
  console.log('\n📝 [Test] 接下来请执行以下操作：');
  console.log('1. 打开 Homepage，观察今日统计的初始值');
  console.log('2. 编辑上面显示的事件，修改其标签');
  console.log('3. 保存修改');
  console.log('4. 观察今日统计是否立即更新（无需刷新页面）');
  console.log('5. 检查控制台日志：');
  console.log('   - 应该看到 "🔔 [TimeCalendar] Dispatching eventsUpdated event"');
  console.log('   - 应该看到 "📊 [DailyStats] eventsUpdated event received, reloading from localStorage"');
  console.log('   - 应该看到 "📊 [DailyStats] Loaded latest events: X"');
  console.log('   - 应该看到 "📊 [DailyStats] useMemo triggered, refreshKey: X"');
  console.log('   - 应该看到 "📊 [DailyStats] Calculating stats for: ..."');
}

console.log('\n🔍 [Test] 监听 eventsUpdated 事件...');
let updateCount = 0;
window.addEventListener('eventsUpdated', (e) => {
  updateCount++;
  console.log(`\n✅ [Test] eventsUpdated 事件触发 #${updateCount}`, e.detail);
  
  // 检查 DailyStatsCard 是否接收到事件
  setTimeout(() => {
    const latestEvents = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
    console.log('📊 [Test] localStorage 中的最新事件数量:', latestEvents.length);
  }, 100);
});

console.log('✅ [Test] 测试环境准备完成！');
console.log('\n💡 提示：');
console.log('- 确保已打开 Homepage 页面');
console.log('- 编辑事件时观察控制台日志');
console.log('- 今日统计应该在保存后立即更新，无需刷新页面');
