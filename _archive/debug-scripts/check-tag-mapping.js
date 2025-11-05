/**
 * 检查 pending events 的 tag 是否有日历映射
 */

console.log('='.repeat(80));
console.log('🔍 检查 Tag 日历映射');
console.log('='.repeat(80));
console.log('');

const EventService = window.EventService;
const debugSyncMgr = window.debugSyncManager;

if (!EventService) {
  console.error('❌ EventService 未加载');
} else if (!debugSyncMgr) {
  console.error('❌ debugSyncManager 未初始化');
} else {
  const allEvents = EventService.getAllEvents?.();
  
  const targetIds = [
    'local-1761204179008',  // 房东交流 | 君御豪庭
    'local-1761286443997',  // 🔮ReMarkable开发
    'local-1761808870380'   // 🔮ReMarkable开发
  ];
  
  console.log('📊 检查 3 个 pending events 的 tag 映射:');
  console.log('');
  
  let allHaveMapping = true;
  
  targetIds.forEach((id, idx) => {
    const event = allEvents.find(e => e.id === id);
    
    if (!event) {
      console.log(`${idx + 1}. ID: ${id} - ❌ 事件不存在`);
      allHaveMapping = false;
      return;
    }
    
    console.log(`${idx + 1}. ${event.title}`);
    console.log(`   tagId: ${event.tagId}`);
    
    if (!event.tagId) {
      console.log('   ❌ 没有 tagId');
      allHaveMapping = false;
    } else {
      // 使用 debugSyncManager 检查 tag 映射
      const mappedCalendarId = debugSyncMgr.checkTagMapping?.(event.tagId);
      
      if (mappedCalendarId) {
        console.log(`   ✅ Tag 有映射: ${mappedCalendarId}`);
      } else {
        console.log('   ❌ Tag 没有日历映射');
        allHaveMapping = false;
      }
    }
    console.log('');
  });
  
  console.log('='.repeat(80));
  console.log('📋 结论:');
  console.log('='.repeat(80));
  console.log('');
  
  if (allHaveMapping) {
    console.log('✅ 所有 tag 都有日历映射');
    console.log('');
    console.log('问题可能是:');
    console.log('1. fixOrphanedPendingEvents() 还没执行（需要刷新页面）');
    console.log('2. 同步已执行但失败了（检查控制台错误日志）');
  } else {
    console.log('❌ 部分 tag 没有日历映射');
    console.log('');
    console.log('解决方案:');
    console.log('1. 为这些 tag 分配日历:');
    console.log('   - 打开 TimeCalendar 设置');
    console.log('   - 在标签列表中为相应的 tag 选择目标日历');
    console.log('');
    console.log('2. 或者手动设置 calendarId:');
    console.log('   运行以下代码为事件分配默认日历:');
    console.log('');
    console.log('   ```javascript');
    console.log('   const msService = window.microsoftCalendarService;');
    console.log('   const defaultCalId = msService.getSelectedCalendarId();');
    console.log('   ');
    console.log('   const events = JSON.parse(localStorage.getItem("remarkable-events"));');
    targetIds.forEach(id => {
      console.log(`   const evt_${id.split('-').pop()} = events.find(e => e.id === "${id}");`);
    });
    console.log('   ');
    targetIds.forEach(id => {
      const suffix = id.split('-').pop();
      console.log(`   if (evt_${suffix}) evt_${suffix}.calendarId = defaultCalId;`);
    });
    console.log('   ');
    console.log('   localStorage.setItem("remarkable-events", JSON.stringify(events));');
    console.log('   console.log("✅ 已设置 calendarId，请刷新页面");');
    console.log('   ```');
  }
}
