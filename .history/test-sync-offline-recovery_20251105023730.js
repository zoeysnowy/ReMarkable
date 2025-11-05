/**
 * 测试脚本 1：断网恢复测试
 * 
 * 测试流程：
 * 1. 创建测试事件
 * 2. 模拟断网
 * 3. 检查队列状态
 * 4. 模拟恢复网络
 * 5. 验证同步成功
 * 
 * ⚠️ 在浏览器控制台运行
 */

(async function testOfflineRecovery() {
  console.log('='.repeat(80));
  console.log('🧪 测试 1: 断网恢复测试');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions' // ✅ 修复：使用正确的 key
  };

  // 辅助函数：生成唯一ID
  const generateId = () => `test-offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // 辅助函数：获取队列
  const getQueue = () => {
    const raw = localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS);
    return raw ? JSON.parse(raw) : [];
  };

  // 辅助函数：获取事件列表
  const getEvents = () => {
    const raw = localStorage.getItem(STORAGE_KEYS.EVENTS);
    return raw ? JSON.parse(raw) : [];
  };

  // 辅助函数：等待
  const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    // ==================== 步骤 1: 创建测试事件 ====================
    console.log('📝 步骤 1: 创建测试事件...');
    
    const testEventId = generateId();
    const now = new Date();
    const endTime = new Date(now.getTime() + 3600000); // 1小时后

    // 🔧 获取默认日历ID和标签ID（确保事件会被同步）
    const defaultCalendarId = window.syncManager?.microsoftService?.getSelectedCalendarId() || 'default-calendar';
    
    // 获取第一个可用的标签ID
    const availableTags = window.TagService?.getFlatTags() || [];
    const testTagId = availableTags.length > 0 ? availableTags[0].id : 'work';
    
    console.log(`🔧 使用日历ID: ${defaultCalendarId}`);
    console.log(`🔧 使用标签ID: ${testTagId} (${availableTags.find(t => t.id === testTagId)?.name || '未知'})`);

    const testEvent = {
      id: testEventId,
      title: '🧪 测试事件 - 断网恢复',
      description: '这是一个用于测试断网恢复功能的事件',
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

    // 保存事件到 localStorage
    const events = getEvents();
    events.push(testEvent);
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    
    console.log(`✅ 事件已创建: ${testEvent.title}`);
    console.log(`   ID: ${testEventId}`);
    console.log('');

    // 模拟 EventService 触发同步
    if (window.syncManager) {
      await window.syncManager.recordLocalAction('create', 'event', testEventId, testEvent);
      console.log('✅ 同步 action 已记录');
    } else {
      console.warn('⚠️ syncManager 不可用，手动创建 action');
      
      const queue = getQueue();
      const action = {
        id: `action-${Date.now()}`,
        type: 'create',
        entityType: 'event',
        entityId: testEventId,
        timestamp: new Date().toISOString(),
        source: 'local',
        data: testEvent,
        synchronized: false,
        retryCount: 0
      };
      queue.push(action);
      localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));
      console.log('✅ Action 已手动添加到队列');
      
      // 🔧 **关键修复**: 触发同步管理器重新加载队列
      if (window.syncManager && typeof window.syncManager.loadActionQueue === 'function') {
        window.syncManager.loadActionQueue();
        console.log('✅ 队列已重新加载到同步管理器');
      }
    }
    console.log('');

    // ==================== 步骤 2: 模拟断网 ====================
    console.log('📴 步骤 2: 模拟断网...');
    
    // 保存原始的 fetch
    const originalFetch = window.fetch;
    let isOffline = true;
    
    window.fetch = function(...args) {
      if (isOffline) {
        console.log('❌ [MOCK] Fetch blocked (offline mode):', args[0]);
        return Promise.reject(new Error('Network request failed (offline)'));
      }
      return originalFetch.apply(this, args);
    };
    
    console.log('✅ 已模拟断网状态（fetch 请求将失败）');
    console.log('');

    // ==================== 步骤 3: 检查队列状态 ====================
    console.log('🔍 步骤 3: 检查队列状态...');
    
    await wait(2000); // 等待2秒，让同步循环尝试
    
    const queue = getQueue();
    const testAction = queue.find(a => a.entityId === testEventId);
    
    if (!testAction) {
      console.error('❌ 队列中未找到测试事件的 action');
      return;
    }
    
    console.log('✅ 在队列中找到测试 action:');
    console.log(`   Type: ${testAction.type}`);
    console.log(`   EntityId: ${testAction.entityId}`);
    console.log(`   Synchronized: ${testAction.synchronized}`);
    console.log(`   RetryCount: ${testAction.retryCount || 0}`);
    
    if (testAction.synchronized) {
      console.warn('⚠️ Action 已标记为 synchronized，测试可能不准确');
    } else {
      console.log('✅ Action 状态正确（未同步）');
    }
    console.log('');

    // ==================== 步骤 4: 恢复网络 ====================
    console.log('🌐 步骤 4: 恢复网络...');
    
    isOffline = false;
    window.fetch = originalFetch;
    
    console.log('✅ 已恢复网络连接');
    console.log('🔄 触发同步...');
    
    // 触发 online 事件（模拟网络恢复）
    window.dispatchEvent(new Event('online'));
    
    // 或者手动触发同步
    if (window.syncManager && window.syncManager.performSync) {
      console.log('🔄 手动触发同步...');
      // 注意：performSync 是 private 方法，生产环境需要使用其他方式
      // 这里等待定时同步自动执行
    }
    
    console.log('⏳ 等待同步完成（10秒）...');
    await wait(10000);
    console.log('');

    // ==================== 步骤 5: 验证同步结果 ====================
    console.log('✔️ 步骤 5: 验证同步结果...');
    
    const updatedQueue = getQueue();
    const updatedAction = updatedQueue.find(a => a.entityId === testEventId);
    
    if (!updatedAction) {
      console.log('✅ Action 已从队列中清除（可能已同步）');
    } else {
      console.log(`📊 Action 状态:`);
      console.log(`   Synchronized: ${updatedAction.synchronized}`);
      console.log(`   RetryCount: ${updatedAction.retryCount || 0}`);
      console.log(`   LastError: ${updatedAction.lastError || '无'}`);
      
      if (updatedAction.synchronized) {
        console.log('✅ 测试通过：事件已成功同步');
      } else {
        console.warn('⚠️ 测试未完全通过：事件尚未同步');
        console.log('   可能原因：');
        console.log('   - 同步间隔未到（20秒一次）');
        console.log('   - Microsoft 服务未登录');
        console.log('   - 实际网络问题');
      }
    }
    
    // 检查事件是否有 externalId（同步成功的标志）
    const updatedEvents = getEvents();
    const syncedEvent = updatedEvents.find(e => e.id === testEventId);
    
    if (syncedEvent) {
      console.log('');
      console.log('📋 事件状态:');
      console.log(`   Title: ${syncedEvent.title}`);
      console.log(`   ExternalId: ${syncedEvent.externalId || '无（未同步）'}`);
      console.log(`   SyncStatus: ${syncedEvent.syncStatus || '未设置'}`);
      
      if (syncedEvent.externalId) {
        console.log('✅✅✅ 测试完全通过：事件已同步到 Outlook');
      }
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('🎉 测试 1 完成');
    console.log('='.repeat(80));
    
    // 返回测试结果供后续分析
    return {
      testEventId,
      action: updatedAction,
      event: syncedEvent,
      success: syncedEvent?.externalId ? true : false
    };
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
    
    // 确保恢复 fetch
    window.fetch = originalFetch;
  }
})();
