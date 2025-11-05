/**
 * 测试脚本 3：并发压力测试
 * 
 * 测试流程：
 * 1. 快速连续创建20个事件（无间隔）
 * 2. 验证队列顺序正确
 * 3. 验证所有事件都进入队列
 * 4. 等待同步完成
 * 5. 验证同步结果
 * 
 * ⚠️ 在浏览器控制台运行
 * ⏱️ 预计耗时：约40秒
 */

(async function testConcurrentCreation() {
  console.log('='.repeat(80));
  console.log('🧪 测试 3: 并发压力测试');
  console.log('⏱️ 预计耗时：约40秒');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  const NUM_EVENTS = 20;
  const SYNC_WAIT = 40000; // 等待40秒同步

  // 辅助函数
  const generateId = () => `test-concurrent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  const getQueue = () => {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS);
    return raw ? JSON.parse(raw) : [];
  };

  const getEvents = () => {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return raw ? JSON.parse(raw) : [];
  };

  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const formatTime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    return `${seconds}秒`;
  };

  try {
    const testEventIds = [];
    const creationTimestamps = [];

    // ==================== 步骤 1: 快速创建事件 ====================
    console.log(`📝 步骤 1: 快速连续创建 ${NUM_EVENTS} 个事件（无间隔）...`);
    console.log('');

    // 🔧 获取默认日历ID和标签ID
    const defaultCalendarId = window.syncManager?.microsoftService?.getSelectedCalendarId() || 'default-calendar';
    
    // 获取第一个可用的标签ID
    const availableTags = window.TagService?.getFlatTags() || [];
    const testTagId = availableTags.length > 0 ? availableTags[0].id : 'work';
    
    console.log(`🔧 使用日历ID: ${defaultCalendarId}`);
    console.log(`🔧 使用标签ID: ${testTagId} (${availableTags.find(t => t.id === testTagId)?.name || '未知'})`);
    console.log('');

    const startTime = Date.now();

    // 批量创建事件（模拟并发）
    const events = getEvents();
    const queue = getQueue();

    for (let i = 1; i <= NUM_EVENTS; i++) {
      const eventId = generateId();
      testEventIds.push(eventId);
      
      const timestamp = Date.now();
      creationTimestamps.push(timestamp);

      const now = new Date();
      const endTime = new Date(now.getTime() + 3600000); // 1小时后

      const testEvent = {
        id: eventId,
        title: `🧪 并发测试事件 ${i}/${NUM_EVENTS}`,
        description: `并发测试事件编号 ${i}，创建时间戳 ${timestamp}`,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        isAllDay: false,
        tags: [testTagId], // 🔧 使用真实标签ID数组
        calendarId: defaultCalendarId, // 🔧 添加日历ID
        remarkableSource: true,
        syncStatus: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        // 添加自定义字段用于验证顺序
        _testIndex: i,
        _testTimestamp: timestamp
      };

      events.push(testEvent);

      // 创建同步 action
      const action = {
        id: `action-${timestamp}-${i}`,
        type: 'create',
        entityType: 'event',
        entityId: eventId,
        timestamp: new Date().toISOString(),
        source: 'local',
        data: testEvent,
        synchronized: false,
        retryCount: 0,
        _testIndex: i // 添加测试索引
      };
      queue.push(action);
    }

    // 批量保存
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
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
    }

    const createDuration = Date.now() - startTime;
    
    console.log(`✅ ${NUM_EVENTS} 个事件创建完成`);
    console.log(`   耗时: ${createDuration}ms`);
    console.log(`   平均: ${(createDuration / NUM_EVENTS).toFixed(1)}ms/事件`);
    console.log('');

    // ==================== 步骤 2: 验证队列顺序 ====================
    console.log('🔍 步骤 2: 验证队列顺序...');
    console.log('');

    const currentQueue = getQueue();
    const testActions = currentQueue.filter(a => testEventIds.includes(a.entityId));

    console.log(`📊 队列状态:`);
    console.log(`   队列总长度: ${currentQueue.length}`);
    console.log(`   测试 actions: ${testActions.length}`);
    console.log('');

    // 检查顺序是否正确
    let orderCorrect = true;
    const orderIssues = [];

    for (let i = 0; i < testActions.length - 1; i++) {
      const current = testActions[i];
      const next = testActions[i + 1];
      
      const currentIndex = current._testIndex || current.data?._testIndex;
      const nextIndex = next._testIndex || next.data?._testIndex;
      
      if (currentIndex && nextIndex && currentIndex > nextIndex) {
        orderCorrect = false;
        orderIssues.push({
          position: i,
          currentIndex,
          nextIndex
        });
      }
    }

    if (orderCorrect) {
      console.log('✅ 队列顺序正确（按创建顺序排列）');
    } else {
      console.warn('⚠️ 队列顺序存在问题:');
      orderIssues.forEach(issue => {
        console.warn(`   位置 ${issue.position}: 事件 ${issue.currentIndex} 排在 ${issue.nextIndex} 之前`);
      });
    }
    console.log('');

    // 显示前5个和后5个事件
    console.log('📋 队列预览（前5个）:');
    testActions.slice(0, 5).forEach((action, idx) => {
      const testIndex = action._testIndex || action.data?._testIndex || '?';
      console.log(`   [${idx + 1}] 测试索引: ${testIndex}, EntityId: ${action.entityId.substring(0, 30)}...`);
    });
    
    if (testActions.length > 5) {
      console.log('   ...');
      console.log(`📋 队列预览（后5个）:`);
      testActions.slice(-5).forEach((action, idx) => {
        const testIndex = action._testIndex || action.data?._testIndex || '?';
        const actualIdx = testActions.length - 5 + idx + 1;
        console.log(`   [${actualIdx}] 测试索引: ${testIndex}, EntityId: ${action.entityId.substring(0, 30)}...`);
      });
    }
    console.log('');

    // ==================== 步骤 3: 验证队列完整性 ====================
    console.log('✔️ 步骤 3: 验证队列完整性...');
    console.log('');

    const expectedIds = new Set(testEventIds);
    const actualIds = new Set(testActions.map(a => a.entityId));

    const missingIds = [...expectedIds].filter(id => !actualIds.has(id));
    const extraIds = [...actualIds].filter(id => !expectedIds.has(id));

    if (missingIds.length === 0 && extraIds.length === 0) {
      console.log(`✅ 队列完整性验证通过（${NUM_EVENTS}/${NUM_EVENTS} 事件）`);
    } else {
      console.warn('⚠️ 队列完整性问题:');
      if (missingIds.length > 0) {
        console.warn(`   缺失事件: ${missingIds.length}`);
        missingIds.slice(0, 3).forEach(id => {
          console.warn(`     - ${id}`);
        });
      }
      if (extraIds.length > 0) {
        console.warn(`   额外事件: ${extraIds.length}`);
      }
    }
    console.log('');

    // ==================== 步骤 4: 等待同步 ====================
    console.log(`⏳ 步骤 4: 等待同步完成（${formatTime(SYNC_WAIT)}）...`);
    console.log('');

    // 每5秒检查一次进度
    const checkInterval = 5000;
    const checks = Math.floor(SYNC_WAIT / checkInterval);

    for (let i = 0; i < checks; i++) {
      await wait(checkInterval);
      
      const queue = getQueue();
      const testActions = queue.filter(a => testEventIds.includes(a.entityId));
      const synchronized = testActions.filter(a => a.synchronized).length;
      const pending = NUM_EVENTS - synchronized;
      
      console.log(`   [${formatTime((i + 1) * checkInterval)}] 同步进度: ${synchronized}/${NUM_EVENTS} (待同步: ${pending})`);
      
      // 检查是否有失败的
      const failed = testActions.filter(a => !a.synchronized && (a.retryCount || 0) > 2).length;
      if (failed > 0) {
        console.warn(`   ⚠️ 有 ${failed} 个事件重试次数 > 2`);
      }
      
      if (synchronized === NUM_EVENTS) {
        console.log('✅ 所有事件已同步！');
        break;
      }
    }
    console.log('');

    // ==================== 步骤 5: 验证同步结果 ====================
    console.log('✔️ 步骤 5: 验证同步结果...');
    console.log('');

    const finalQueue = getQueue();
    const finalEvents = getEvents();
    
    const results = testEventIds.map((eventId, index) => {
      const action = finalQueue.find(a => a.entityId === eventId);
      const event = finalEvents.find(e => e.id === eventId);
      
      return {
        index: index + 1,
        eventId,
        actionExists: !!action,
        actionSynchronized: action ? action.synchronized : null,
        retryCount: action ? (action.retryCount || 0) : 0,
        hasExternalId: event ? !!event.externalId : false,
        lastError: action ? action.lastError : null
      };
    });

    // 统计结果
    const syncedCount = results.filter(r => r.hasExternalId).length;
    const pendingCount = results.filter(r => !r.hasExternalId && r.actionExists && !r.actionSynchronized).length;
    const failedCount = results.filter(r => !r.hasExternalId && r.retryCount > 3).length;
    const cleanedCount = results.filter(r => !r.hasExternalId && !r.actionExists).length;

    console.log('📊 同步状态分布:');
    console.log(`   ✅ 已同步（有 externalId）: ${syncedCount}`);
    console.log(`   ⏳ 待同步（在队列中）: ${pendingCount}`);
    console.log(`   ❌ 疑似失败（重试 > 3）: ${failedCount}`);
    console.log(`   🗑️ 已清理（不在队列）: ${cleanedCount}`);
    console.log('');

    // 显示失败的事件
    if (failedCount > 0) {
      console.log('❌ 失败事件详情:');
      results
        .filter(r => !r.hasExternalId && r.retryCount > 3)
        .forEach(result => {
          console.log(`   [${result.index}] Retry: ${result.retryCount}, Error: ${result.lastError || '未知'}`);
        });
      console.log('');
    }

    // ==================== 性能分析 ====================
    console.log('📈 性能分析:');
    console.log(`   创建速度: ${(createDuration / NUM_EVENTS).toFixed(1)}ms/事件`);
    console.log(`   队列顺序: ${orderCorrect ? '正确' : '有问题'}`);
    console.log(`   队列完整性: ${missingIds.length === 0 && extraIds.length === 0 ? '完整' : '有缺失'}`);
    console.log(`   同步成功率: ${((syncedCount / NUM_EVENTS) * 100).toFixed(1)}%`);
    console.log('');

    // ==================== 最终结论 ====================
    console.log('='.repeat(80));
    console.log('📈 测试统计:');
    console.log(`   总事件数: ${NUM_EVENTS}`);
    console.log(`   成功同步: ${syncedCount}`);
    console.log(`   失败/待同步: ${NUM_EVENTS - syncedCount}`);
    console.log(`   成功率: ${((syncedCount / NUM_EVENTS) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));

    const allPassed = syncedCount === NUM_EVENTS && orderCorrect && missingIds.length === 0;
    
    if (allPassed) {
      console.log('🎉🎉🎉 测试完全通过：');
      console.log('   ✅ 所有事件都已成功同步');
      console.log('   ✅ 队列顺序正确');
      console.log('   ✅ 无数据丢失');
    } else {
      console.log('⚠️ 测试部分通过：');
      if (syncedCount < NUM_EVENTS) {
        console.log(`   ⚠️ 有 ${NUM_EVENTS - syncedCount} 个事件未同步`);
      }
      if (!orderCorrect) {
        console.log('   ⚠️ 队列顺序存在问题');
      }
      if (missingIds.length > 0) {
        console.log(`   ⚠️ 有 ${missingIds.length} 个事件丢失`);
      }
      console.log('');
      console.log('   建议：');
      console.log('   1. 增加等待时间（同步间隔20秒）');
      console.log('   2. 检查同步管理器状态');
      console.log('   3. 查看浏览器控制台错误');
    }
    
    console.log('='.repeat(80));
    console.log('🎉 测试 3 完成');
    console.log('='.repeat(80));

    return {
      testEventIds,
      results,
      stats: {
        syncedCount,
        pendingCount,
        failedCount,
        cleanedCount,
        successRate: (syncedCount / NUM_EVENTS) * 100,
        orderCorrect,
        queueComplete: missingIds.length === 0 && extraIds.length === 0
      }
    };

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
  }
})();
