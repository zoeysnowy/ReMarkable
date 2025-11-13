/**
 * 清理脚本：批量删除测试事件
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开你的应用
 * 2. 复制此脚本到控制台运行
 * 3. 或者在 Node.js 环境运行（需要修改 localStorage 访问方式）
 */

(function cleanupTestEvents() {
  console.log('🧹 开始清理测试事件...');
  
  // 读取本地事件
  const eventsStr = localStorage.getItem('remarkable-events');
  if (!eventsStr) {
    console.log('❌ 未找到事件数据');
    return;
  }
  
  const events = JSON.parse(eventsStr);
  console.log(`📊 当前事件总数: ${events.length}`);
  
  // 定义测试事件的识别规则
  const testPatterns = [
    /^🧪/,                           // 以 🧪 开头
    /测试/,                          // 包含"测试"
    /并发测试/,                      // 并发测试
    /^Test/i,                        // 以 Test 开头（不区分大小写）
    /^test-/i,                       // test- 开头
    /^临时/,                         // 以"临时"开头
    /^DEBUG/i,                       // DEBUG 开头
  ];
  
  // 过滤出测试事件
  const testEvents = events.filter(event => {
    const title = event.title || '';
    return testPatterns.some(pattern => pattern.test(title));
  });
  
  console.log(`🎯 找到测试事件: ${testEvents.length} 个`);
  
  if (testEvents.length === 0) {
    console.log('✅ 没有测试事件需要清理');
    return;
  }
  
  // 显示即将删除的事件
  console.log('📋 即将删除的事件:');
  testEvents.forEach((event, index) => {
    console.log(`  ${index + 1}. ${event.title} (ID: ${event.id})`);
  });
  
  // 确认删除
  const confirmed = confirm(
    `发现 ${testEvents.length} 个测试事件，是否删除？\n\n` +
    `前 10 个事件:\n` +
    testEvents.slice(0, 10).map((e, i) => `${i + 1}. ${e.title}`).join('\n')
  );
  
  if (!confirmed) {
    console.log('❌ 用户取消删除');
    return;
  }
  
  // 执行删除
  const testEventIds = new Set(testEvents.map(e => e.id));
  const cleanedEvents = events.filter(e => !testEventIds.has(e.id));
  
  // 保存清理后的事件
  localStorage.setItem('remarkable-events', JSON.stringify(cleanedEvents));
  
  console.log(`✅ 删除完成！`);
  console.log(`📊 删除前: ${events.length} 个事件`);
  console.log(`📊 删除后: ${cleanedEvents.length} 个事件`);
  console.log(`🗑️ 共删除: ${testEvents.length} 个测试事件`);
  
  // 触发 UI 更新
  window.dispatchEvent(new CustomEvent('eventsUpdated'));
  
  // 提示刷新
  if (confirm('清理完成！是否刷新页面以应用更改？')) {
    window.location.reload();
  }
  
  return {
    before: events.length,
    after: cleanedEvents.length,
    deleted: testEvents.length,
    testEvents: testEvents
  };
})();
