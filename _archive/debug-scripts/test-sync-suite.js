/**
 * 测试套件：运行所有同步测试
 * 
 * 包含测试：
 * 1. 断网恢复测试
 * 2. 长时间离线测试
 * 3. 并发压力测试
 * 
 * ⚠️ 在浏览器控制台运行
 * ⏱️ 预计总耗时：约150秒（2.5分钟）
 * 
 * 使用方法：
 * 1. 复制整个脚本到浏览器控制台
 * 2. 回车执行
 * 3. 等待所有测试完成
 * 4. 查看测试报告
 */

(async function runAllTests() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🧪 ReMarkable 同步测试套件');
  console.log('='.repeat(80));
  console.log('');
  console.log('📋 测试计划:');
  console.log('   1. 断网恢复测试 (~15秒)');
  console.log('   2. 长时间离线测试 (~90秒)');
  console.log('   3. 并发压力测试 (~40秒)');
  console.log('');
  console.log('⏱️ 预计总耗时: 约150秒（2.5分钟）');
  console.log('');
  console.log('按任意键继续或等待5秒自动开始...');
  console.log('='.repeat(80));
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 5000));

  const testResults = {
    startTime: Date.now(),
    tests: []
  };

  // ==================== 测试 1：断网恢复 ====================
  try {
    console.log('\n\n');
    console.log('█'.repeat(80));
    console.log('█ 开始测试 1/3：断网恢复测试');
    console.log('█'.repeat(80));
    console.log('\n');

    const result1 = await runTest1();
    testResults.tests.push({
      name: '断网恢复测试',
      status: result1?.success ? 'PASS' : 'FAIL',
      result: result1
    });

  } catch (error) {
    console.error('❌ 测试 1 异常:', error);
    testResults.tests.push({
      name: '断网恢复测试',
      status: 'ERROR',
      error: error.message
    });
  }

  // 间隔10秒
  console.log('\n⏳ 等待10秒后开始下一个测试...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // ==================== 测试 2：长时间离线 ====================
  try {
    console.log('\n\n');
    console.log('█'.repeat(80));
    console.log('█ 开始测试 2/3：长时间离线测试');
    console.log('█'.repeat(80));
    console.log('\n');

    const result2 = await runTest2();
    testResults.tests.push({
      name: '长时间离线测试',
      status: result2?.successRate === 100 ? 'PASS' : 
              result2?.successRate >= 80 ? 'PARTIAL' : 'FAIL',
      result: result2
    });

  } catch (error) {
    console.error('❌ 测试 2 异常:', error);
    testResults.tests.push({
      name: '长时间离线测试',
      status: 'ERROR',
      error: error.message
    });
  }

  // 间隔10秒
  console.log('\n⏳ 等待10秒后开始下一个测试...\n');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // ==================== 测试 3：并发压力 ====================
  try {
    console.log('\n\n');
    console.log('█'.repeat(80));
    console.log('█ 开始测试 3/3：并发压力测试');
    console.log('█'.repeat(80));
    console.log('\n');

    const result3 = await runTest3();
    testResults.tests.push({
      name: '并发压力测试',
      status: result3?.stats?.successRate === 100 && result3?.stats?.orderCorrect ? 'PASS' :
              result3?.stats?.successRate >= 80 ? 'PARTIAL' : 'FAIL',
      result: result3
    });

  } catch (error) {
    console.error('❌ 测试 3 异常:', error);
    testResults.tests.push({
      name: '并发压力测试',
      status: 'ERROR',
      error: error.message
    });
  }

  // ==================== 生成测试报告 ====================
  testResults.endTime = Date.now();
  testResults.duration = testResults.endTime - testResults.startTime;

  console.log('\n\n');
  console.log('='.repeat(80));
  console.log('📊 测试报告');
  console.log('='.repeat(80));
  console.log('');

  console.log(`⏱️ 总耗时: ${(testResults.duration / 1000).toFixed(1)}秒`);
  console.log(`📋 测试数量: ${testResults.tests.length}`);
  console.log('');

  testResults.tests.forEach((test, index) => {
    const statusIcon = test.status === 'PASS' ? '✅' :
                       test.status === 'PARTIAL' ? '⚠️' :
                       test.status === 'FAIL' ? '❌' : '🔥';
    
    console.log(`${statusIcon} 测试 ${index + 1}: ${test.name}`);
    console.log(`   状态: ${test.status}`);
    
    if (test.result) {
      if (test.name === '断网恢复测试') {
        console.log(`   结果: ${test.result.success ? '同步成功' : '同步失败'}`);
      } else if (test.name === '长时间离线测试') {
        console.log(`   同步成功: ${test.result.syncedCount}/10`);
        console.log(`   成功率: ${test.result.successRate?.toFixed(1)}%`);
      } else if (test.name === '并发压力测试') {
        console.log(`   同步成功: ${test.result.stats?.syncedCount}/20`);
        console.log(`   成功率: ${test.result.stats?.successRate?.toFixed(1)}%`);
        console.log(`   队列顺序: ${test.result.stats?.orderCorrect ? '正确' : '错误'}`);
      }
    }
    
    if (test.error) {
      console.log(`   错误: ${test.error}`);
    }
    console.log('');
  });

  const passCount = testResults.tests.filter(t => t.status === 'PASS').length;
  const partialCount = testResults.tests.filter(t => t.status === 'PARTIAL').length;
  const failCount = testResults.tests.filter(t => t.status === 'FAIL' || t.status === 'ERROR').length;

  console.log('='.repeat(80));
  console.log('📈 总结:');
  console.log(`   ✅ 完全通过: ${passCount}`);
  console.log(`   ⚠️ 部分通过: ${partialCount}`);
  console.log(`   ❌ 失败: ${failCount}`);
  console.log('='.repeat(80));

  if (failCount === 0) {
    console.log('🎉🎉🎉 所有测试通过！同步功能运行良好！');
  } else if (passCount + partialCount > 0) {
    console.log('⚠️ 部分测试通过，建议检查失败的测试');
  } else {
    console.log('❌ 所有测试失败，请检查同步配置');
  }

  console.log('='.repeat(80));

  // 保存测试结果
  window.syncTestResults = testResults;
  console.log('');
  console.log('💾 测试结果已保存到: window.syncTestResults');
  console.log('');

  return testResults;
})();

// ==================== 测试函数定义 ====================

async function runTest1() {
  // 断网恢复测试的简化版本
  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  const generateId = () => `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
  
  const testEventId = generateId();
  const now = new Date();
  const endTime = new Date(now.getTime() + 3600000);

  // 🔧 获取默认日历ID和标签ID（确保事件会被同步）
  const availableTags = window.TagService?.getFlatTags() || [];
  const testTagId = availableTags.length > 0 ? availableTags[0].id : 'work';
  const testTag = availableTags.find(t => t.id === testTagId);
  
  // 优先使用标签的日历映射，否则使用默认日历
  const defaultCalendarId = testTag?.calendarMapping?.calendarId || 
                           window.syncManager?.microsoftService?.getSelectedCalendarId() || 
                           null;
  
  console.log(`🔧 使用标签: ${testTagId} (${testTag?.name || '未知'})`);
  console.log(`🔧 使用日历: ${defaultCalendarId || '无（仅依赖标签同步）'}`);
  
  const testEvent = {
    id: testEventId,
    title: '🧪 断网恢复测试',
    startTime: now.toISOString(),
    endTime: endTime.toISOString(),
    remarkableSource: true,
    syncStatus: 'pending',
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    isAllDay: false,
    calendarId: defaultCalendarId, // 可能为 null，但有 tags 仍可同步
    tags: [testTagId] // 🔧 添加标签ID数组
  };

  // 保存事件和action
  const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  events.push(testEvent);
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');
  queue.push({
    id: `action-${Date.now()}`,
    type: 'create',
    entityType: 'event',
    entityId: testEventId,
    timestamp: now.toISOString(),
    source: 'local',
    data: testEvent,
    synchronized: false,
    retryCount: 0
  });
  localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));

  // 🔧 **关键修复**: 触发同步管理器重新加载队列并执行同步
  console.log('🔄 触发同步管理器重新加载队列...');
  if (window.syncManager && typeof window.syncManager.loadActionQueue === 'function') {
    window.syncManager.loadActionQueue();
    console.log('✅ 队列已重新加载');
    
    // 🔧 手动触发同步
    if (typeof window.syncManager.performSync === 'function') {
      window.syncManager.performSync();
      console.log('✅ 已触发同步');
    }
  } else {
    console.warn('⚠️ 无法重新加载队列，同步管理器未找到');
  }

  // 等待同步完成（增加等待时间到20秒）
  console.log('⏳ 等待20秒让同步完成...');
  await wait(20000);

  // 检查结果
  const finalEvents = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const syncedEvent = finalEvents.find(e => e.id === testEventId);

  return {
    testEventId,
    success: !!syncedEvent?.externalId
  };
}

async function runTest2() {
  // 长时间离线测试的简化版本
  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  const generateId = () => `test-long-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 🔧 获取默认日历ID和标签ID
  const availableTags = window.TagService?.getFlatTags() || [];
  const testTagId = availableTags.length > 0 ? availableTags[0].id : 'work';
  const testTag = availableTags.find(t => t.id === testTagId);
  
  // 优先使用标签的日历映射
  const defaultCalendarId = testTag?.calendarMapping?.calendarId || 
                           window.syncManager?.microsoftService?.getSelectedCalendarId() || 
                           null;
  
  console.log(`🔧 使用标签: ${testTagId} (${testTag?.name || '未知'})`);
  console.log(`🔧 使用日历: ${defaultCalendarId || '无（仅依赖标签同步）'}`);

  const testEventIds = [];
  const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');

  // 创建10个事件
  for (let i = 1; i <= 10; i++) {
    const eventId = generateId();
    testEventIds.push(eventId);

    const now = new Date();
    const testEvent = {
      id: eventId,
      title: `🧪 长时间离线测试 ${i}/10`,
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 3600000).toISOString(),
      remarkableSource: true,
      syncStatus: 'pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isAllDay: false,
      calendarId: defaultCalendarId, // 可能为 null
      tags: [testTagId] // 🔧 使用真实标签ID数组
    };

    events.push(testEvent);
    queue.push({
      id: `action-${Date.now()}-${i}`,
      type: 'create',
      entityType: 'event',
      entityId: eventId,
      timestamp: now.toISOString(),
      source: 'local',
      data: testEvent,
      synchronized: false,
      retryCount: 0
    });

    await wait(3000);
  }

  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));

  // 🔧 **关键修复**: 触发同步管理器重新加载队列
  console.log('🔄 触发同步管理器重新加载队列...');
  if (window.syncManager && typeof window.syncManager.loadActionQueue === 'function') {
    window.syncManager.loadActionQueue();
    console.log('✅ 队列已重新加载');
  } else {
    console.warn('⚠️ 无法重新加载队列');
  }

  // 等待同步
  await wait(30000);

  // 检查结果
  const finalEvents = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const syncedCount = testEventIds.filter(id => {
    const event = finalEvents.find(e => e.id === id);
    return event?.externalId;
  }).length;

  return {
    testEventIds,
    syncedCount,
    failedCount: 10 - syncedCount,
    successRate: (syncedCount / 10) * 100
  };
}

async function runTest3() {
  // 并发压力测试的简化版本
  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  const generateId = () => `test-concurrent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  // 🔧 获取默认日历ID和标签ID
  const availableTags = window.TagService?.getFlatTags() || [];
  const testTagId = availableTags.length > 0 ? availableTags[0].id : 'work';
  const testTag = availableTags.find(t => t.id === testTagId);
  
  // 优先使用标签的日历映射
  const defaultCalendarId = testTag?.calendarMapping?.calendarId || 
                           window.syncManager?.microsoftService?.getSelectedCalendarId() || 
                           null;
  
  console.log(`🔧 使用标签: ${testTagId} (${testTag?.name || '未知'})`);
  console.log(`🔧 使用日历: ${defaultCalendarId || '无（仅依赖标签同步）'}`);

  const testEventIds = [];
  const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');

  // 快速创建20个事件
  for (let i = 1; i <= 20; i++) {
    const eventId = generateId();
    testEventIds.push(eventId);

    const now = new Date();
    const testEvent = {
      id: eventId,
      title: `🧪 并发测试 ${i}/20`,
      startTime: now.toISOString(),
      endTime: new Date(now.getTime() + 3600000).toISOString(),
      remarkableSource: true,
      syncStatus: 'pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      isAllDay: false,
      calendarId: defaultCalendarId, // 可能为 null
      tags: [testTagId], // 🔧 使用真实标签ID数组
      _testIndex: i
    };

    events.push(testEvent);
    queue.push({
      id: `action-${Date.now()}-${i}`,
      type: 'create',
      entityType: 'event',
      entityId: eventId,
      timestamp: now.toISOString(),
      source: 'local',
      data: testEvent,
      synchronized: false,
      retryCount: 0,
      _testIndex: i
    });
  }

  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
  localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));

  // 🔧 **关键修复**: 触发同步管理器重新加载队列
  console.log('🔄 触发同步管理器重新加载队列...');
  if (window.syncManager && typeof window.syncManager.loadActionQueue === 'function') {
    window.syncManager.loadActionQueue();
    console.log('✅ 队列已重新加载');
  } else {
    console.warn('⚠️ 无法重新加载队列');
  }

  // 等待同步
  await wait(40000);

  // 检查结果
  const finalEvents = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const finalQueue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');
  
  const syncedCount = testEventIds.filter(id => {
    const event = finalEvents.find(e => e.id === id);
    return event?.externalId;
  }).length;

  const testActions = finalQueue.filter(a => testEventIds.includes(a.entityId));
  const orderCorrect = testActions.every((action, i) => {
    if (i === 0) return true;
    const prevIndex = testActions[i - 1]._testIndex;
    const currIndex = action._testIndex;
    return !prevIndex || !currIndex || prevIndex <= currIndex;
  });

  return {
    testEventIds,
    stats: {
      syncedCount,
      successRate: (syncedCount / 20) * 100,
      orderCorrect
    }
  };
}
