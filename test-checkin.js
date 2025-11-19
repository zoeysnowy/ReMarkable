/**
 * 签到功能测试脚本
 * 在浏览器控制台中运行此脚本来测试签到功能
 */

console.log('🚀 开始测试签到功能...');

// 1. 获取现有事件
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
console.log(`📚 找到 ${events.length} 个现有事件`);

if (events.length === 0) {
  console.log('❌ 没有事件可以测试签到功能');
} else {
  const testEvent = events[0];
  console.log(`🎯 测试事件: "${testEvent.title}" (${testEvent.id})`);

  // 2. 测试签到
  console.log('✅ 测试签到...');
  const checkInResult = EventService.checkIn(testEvent.id);
  console.log('签到结果:', checkInResult);

  // 3. 查看签到状态
  const status1 = EventService.getCheckInStatus(testEvent.id);
  console.log('签到后状态:', status1);

  // 4. 测试取消签到
  setTimeout(() => {
    console.log('❌ 测试取消签到...');
    const uncheckResult = EventService.uncheck(testEvent.id);
    console.log('取消签到结果:', uncheckResult);

    // 5. 再次查看签到状态
    const status2 = EventService.getCheckInStatus(testEvent.id);
    console.log('取消签到后状态:', status2);

    // 6. 再次签到
    setTimeout(() => {
      console.log('✅ 再次签到...');
      const checkInResult2 = EventService.checkIn(testEvent.id);
      console.log('再次签到结果:', checkInResult2);

      const finalStatus = EventService.getCheckInStatus(testEvent.id);
      console.log('最终状态:', finalStatus);

      // 7. 查看更新后的事件数据
      const updatedEvent = EventService.getEventById(testEvent.id);
      console.log('更新后的事件数据:', {
        id: updatedEvent.id,
        title: updatedEvent.title,
        checked: updatedEvent.checked,
        unchecked: updatedEvent.unchecked
      });

      console.log('🎉 签到功能测试完成！请在Plan页面刷新或重新选择日期范围来查看绿色状态线。');
    }, 1000);
  }, 1000);
}

// 8. 显示历史记录
setTimeout(() => {
  console.log('📋 查看历史记录...');
  const history = JSON.parse(localStorage.getItem('remarkable-event-history') || '[]');
  const recentHistory = history.slice(-5); // 最近5条
  console.log('最近的历史记录:', recentHistory);
}, 2500);