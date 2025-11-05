/**
 * 测试脚本 2：长时间离线测试
 * 
 * 测试流程：
 * 1. 模拟断网
 * 2. 创建10个测试事件（每隔3秒创建1个）
 * 3. 保持离线60秒
 * 4. 恢复网络
 * 5. 验证所有事件都成功同步
 * 
 * ⚠️ 在浏览器控制台运行
 * ⏱️ 预计耗时：约90秒
 */

(async function testLongOffline() {
  console.log('='.repeat(80));
  console.log('🧪 测试 2: 长时间离线测试');
  console.log('⏱️ 预计耗时：约90秒');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  const NUM_EVENTS = 10;
  const EVENT_INTERVAL = 3000; // 3秒
  const OFFLINE_DURATION = 60000; // 60秒
  const SYNC_WAIT = 30000; // 等待30秒同步

  // 辅助函数
  const generateId = () => `test-longoffline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
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
    let originalFetch = window.fetch;
    let isOffline = false;

    // ==================== 步骤 1: 模拟断网 ====================
    console.log('📴 步骤 1: 模拟断网...');
    
    isOffline = true;
    window.fetch = function(...args) {
      if (isOffline) {
        console.log('❌ [MOCK] Fetch blocked (offline):', args[0]?.toString()?.substring(0, 50));
        return Promise.reject(new Error('Network request failed (offline)'));
      }
      return originalFetch.apply(this, args);
    };
    
    console.log('✅ 已进入离线模式');
    console.log('');

    // ==================== 步骤 2: 创建10个事件 ====================
    console.log(`📝 步骤 2: 创建 ${NUM_EVENTS} 个测试事件（每隔3秒创建1个）...`);
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

    for (let i = 1; i <= NUM_EVENTS; i++) {
      const eventId = generateId();
      testEventIds.push(eventId);

      const now = new Date();
      const endTime = new Date(now.getTime() + 3600000); // 1小时后

      const testEvent = {
        id: eventId,
        title: `🧪 长时间离线测试事件 ${i}/${NUM_EVENTS}`,
        description: `测试事件编号 ${i}，创建于离线状态`,
        startTime: now.toISOString(),
        endTime: endTime.toISOString(),
        isAllDay: false,
        tags: [testTagId], // 🔧 使用真实标签ID数组
        calendarId: defaultCalendarId, // 🔧 添加日历ID
        remarkableSource: true,
        syncStatus: 'pending',
        createdAt: now.toISOString(),
        updatedAt: now.toISOString()
      };

      // 保存事件
      const events = getEvents();
      events.push(testEvent);
      localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));

      // 创建同步 action
      const queue = getQueue();
      const action = {
        id: `action-${Date.now()}-${i}`,
        type: 'create',
        entityType: 'event',
        entityId: eventId,
        timestamp: new Date().toISOString(),
        source: 'local',
        data: testEvent,
        synchronized: false,
        retryCount: 0
      };
      queue.push(action);
      localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));

      console.log(`✅ [${i}/${NUM_EVENTS}] 事件已创建: ${testEvent.title}`);

      // 等待间隔（最后一个不需要等待）
      if (i < NUM_EVENTS) {
        await wait(EVENT_INTERVAL);
      }
    }

    // 🔧 **关键修复**: 触发同步管理器重新加载队列
    console.log('🔄 触发同步管理器重新加载队列...');
    if (window.syncManager && typeof window.syncManager.loadActionQueue === 'function') {
      window.syncManager.loadActionQueue();
      console.log('✅ 队列已重新加载');
    }

    const createDuration = Date.now() - startTime;
    console.log('');
    console.log(`✅ ${NUM_EVENTS} 个事件创建完成，耗时 ${formatTime(createDuration)}`);
    console.log('');

    // ==================== 步骤 3: 保持离线 ====================
    const remainingOfflineTime = Math.max(0, OFFLINE_DURATION - createDuration);
    
    if (remainingOfflineTime > 0) {
      console.log(`⏳ 步骤 3: 保持离线状态 ${formatTime(remainingOfflineTime)}...`);
      console.log('   （模拟长时间断网场景）');
      
      // 每10秒检查一次队列状态
      const checkInterval = 10000;
      const checks = Math.floor(remainingOfflineTime / checkInterval);
      
      for (let i = 0; i < checks; i++) {
        await wait(checkInterval);
        const queue = getQueue();
        const pendingActions = queue.filter(a => 
          testEventIds.includes(a.entityId) && !a.synchronized
        );
        console.log(`   [${formatTime((i + 1) * checkInterval)}] 队列中待同步: ${pendingActions.length}/${NUM_EVENTS}`);
      }
      
      // 等待剩余时间
      const finalWait = remainingOfflineTime % checkInterval;
      if (finalWait > 0) {
        await wait(finalWait);
      }
      
      console.log('✅ 离线期已结束');
    } else {
      console.log('⚠️ 创建事件已超过60秒，跳过等待');
    }
    console.log('');

    // ==================== 步骤 4: 恢复网络 ====================
    console.log('🌐 步骤 4: 恢复网络...');
    
    isOffline = false;
    window.fetch = originalFetch;
    
    console.log('✅ 网络已恢复');
    console.log('📡 触发 online 事件...');
    
    window.dispatchEvent(new Event('online'));
    
    console.log(`⏳ 等待同步完成（${formatTime(SYNC_WAIT)}）...`);
    console.log('');
    
    // 每5秒检查一次同步进度
    const syncCheckInterval = 5000;
    const syncChecks = Math.floor(SYNC_WAIT / syncCheckInterval);
    
    for (let i = 0; i < syncChecks; i++) {
      await wait(syncCheckInterval);
      
      const queue = getQueue();
      const testActions = queue.filter(a => testEventIds.includes(a.entityId));
      const synchronized = testActions.filter(a => a.synchronized).length;
      const pending = NUM_EVENTS - synchronized;
      
      console.log(`   [${formatTime((i + 1) * syncCheckInterval)}] 同步进度: ${synchronized}/${NUM_EVENTS} (待同步: ${pending})`);
      
      if (synchronized === NUM_EVENTS) {
        console.log('✅ 所有事件已同步！');
        break;
      }
    }
    console.log('');

    // ==================== 步骤 5: 验证结果 ====================
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
        actionSynchronized: action ? action.synchronized : null,
        retryCount: action ? (action.retryCount || 0) : 0,
        hasExternalId: event ? !!event.externalId : false,
        eventTitle: event ? event.title : '未找到'
      };
    });

    // 输出每个事件的状态
    console.log('📊 详细结果:');
    console.log('');
    
    results.forEach(result => {
      const status = result.hasExternalId ? '✅ 已同步' : 
                     result.actionSynchronized ? '⚠️ Action已标记但无externalId' :
                     '❌ 未同步';
      
      console.log(`[${result.index}/${NUM_EVENTS}] ${status}`);
      console.log(`    Event ID: ${result.eventId.substring(0, 40)}...`);
      console.log(`    Title: ${result.eventTitle}`);
      console.log(`    ExternalId: ${result.hasExternalId ? '有' : '无'}`);
      console.log(`    RetryCount: ${result.retryCount}`);
      console.log('');
    });

    // 统计结果
    const syncedCount = results.filter(r => r.hasExternalId).length;
    const failedCount = NUM_EVENTS - syncedCount;
    
    console.log('='.repeat(80));
    console.log('📈 测试统计:');
    console.log(`   总事件数: ${NUM_EVENTS}`);
    console.log(`   成功同步: ${syncedCount}`);
    console.log(`   失败/待同步: ${failedCount}`);
    console.log(`   成功率: ${((syncedCount / NUM_EVENTS) * 100).toFixed(1)}%`);
    console.log('='.repeat(80));
    
    if (syncedCount === NUM_EVENTS) {
      console.log('🎉🎉🎉 测试完全通过：所有事件都已成功同步！');
    } else if (syncedCount > 0) {
      console.log('⚠️ 测试部分通过：部分事件已同步');
      console.log('   建议：');
      console.log('   1. 检查 Microsoft 登录状态');
      console.log('   2. 等待更长时间（同步间隔20秒）');
      console.log('   3. 检查浏览器控制台错误信息');
    } else {
      console.log('❌ 测试失败：没有事件成功同步');
      console.log('   可能原因：');
      console.log('   1. Microsoft 服务未登录');
      console.log('   2. 同步管理器未启动');
      console.log('   3. 实际网络问题');
    }
    
    console.log('='.repeat(80));
    console.log('🎉 测试 2 完成');
    console.log('='.repeat(80));

    return {
      testEventIds,
      results,
      syncedCount,
      failedCount,
      successRate: (syncedCount / NUM_EVENTS) * 100
    };

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
    
    // 确保恢复 fetch
    window.fetch = originalFetch;
  }
})();
