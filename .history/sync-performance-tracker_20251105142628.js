/**
 * 断网事件同步性能追踪工具
 * 
 * 功能：
 * 1. 监听并记录所有同步相关事件
 * 2. 追踪事件从创建到同步完成的完整时间线
 * 3. 分析每个环节的耗时
 * 4. 输出详细的性能报告
 * 
 * 使用方法：
 * 1. 在断网前运行此脚本
 * 2. 保持浏览器控制台打开
 * 3. 创建测试事件
 * 4. 联网后观察日志
 * 5. 5分钟后运行 window.syncTracker.generateReport() 查看报告
 */

(function initializeSyncPerformanceTracker() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 断网事件同步性能追踪器');
  console.log('='.repeat(80));
  console.log('');
  console.log('📊 开始监听同步事件...');
  console.log('');

  // 性能追踪数据结构
  const tracker = {
    // 事件创建记录
    eventCreations: new Map(), // eventId -> { timestamp, title }
    
    // 同步阶段记录
    syncPhases: [],
    
    // 网络状态变化
    networkChanges: [],
    
    // Action 队列变化
    actionQueueChanges: [],
    
    // 同步周期记录
    syncCycles: [],
    
    // 当前追踪的同步周期
    currentSyncCycle: null,
    
    // 开始时间
    startTime: Date.now()
  };

  // ==================== 1. 监听事件创建 ====================
  const originalDispatchEvent = window.dispatchEvent.bind(window);
  
  window.dispatchEvent = function(event) {
    const result = originalDispatchEvent(event);
    
    // 监听事件创建
    if (event.type === 'eventCreated' && event.detail?.event) {
      const evt = event.detail.event;
      const timestamp = Date.now();
      
      tracker.eventCreations.set(evt.id, {
        eventId: evt.id,
        title: evt.title,
        createdAt: timestamp,
        relativeTime: timestamp - tracker.startTime,
        syncStatus: evt.syncStatus,
        hasCalendarId: !!evt.calendarId,
        hasTags: !!(evt.tags?.length > 0)
      });
      
      console.log('📝 [Tracker] 事件创建:', {
        title: evt.title,
        eventId: evt.id,
        时间: new Date(timestamp).toLocaleTimeString('zh-CN'),
        相对时间: `+${(timestamp - tracker.startTime) / 1000}秒`
      });
    }
    
    return result;
  };

  // ==================== 2. 监听网络状态 ====================
  window.addEventListener('online', () => {
    const timestamp = Date.now();
    tracker.networkChanges.push({
      status: 'online',
      timestamp,
      relativeTime: timestamp - tracker.startTime
    });
    
    console.log('🌐 [Tracker] 网络恢复:', {
      时间: new Date(timestamp).toLocaleTimeString('zh-CN'),
      相对时间: `+${(timestamp - tracker.startTime) / 1000}秒`,
      待同步数量: getPendingActionsCount()
    });
  });
  
  window.addEventListener('offline', () => {
    const timestamp = Date.now();
    tracker.networkChanges.push({
      status: 'offline',
      timestamp,
      relativeTime: timestamp - tracker.startTime
    });
    
    console.log('📴 [Tracker] 网络断开:', {
      时间: new Date(timestamp).toLocaleTimeString('zh-CN'),
      相对时间: `+${(timestamp - tracker.startTime) / 1000}秒`
    });
  });

  // ==================== 3. 监听同步开始 ====================
  window.addEventListener('action-sync-started', (event) => {
    const timestamp = Date.now();
    const detail = event.detail || {};
    
    tracker.currentSyncCycle = {
      startTime: timestamp,
      relativeStart: timestamp - tracker.startTime,
      isFullSync: detail.isFullSync,
      pendingActionsCount: getPendingActionsCount(),
      phases: []
    };
    
    console.log('🔄 [Tracker] 同步周期开始:', {
      时间: new Date(timestamp).toLocaleTimeString('zh-CN'),
      相对时间: `+${(timestamp - tracker.startTime) / 1000}秒`,
      类型: detail.isFullSync ? '完全同步' : '增量同步',
      待处理: tracker.currentSyncCycle.pendingActionsCount + ' 个'
    });
  });

  // ==================== 4. 监听同步完成 ====================
  window.addEventListener('action-sync-completed', (event) => {
    const timestamp = Date.now();
    const detail = event.detail || {};
    
    if (tracker.currentSyncCycle) {
      tracker.currentSyncCycle.endTime = timestamp;
      tracker.currentSyncCycle.duration = timestamp - tracker.currentSyncCycle.startTime;
      tracker.currentSyncCycle.relativeEnd = timestamp - tracker.startTime;
      
      tracker.syncCycles.push(tracker.currentSyncCycle);
      
      console.log('✅ [Tracker] 同步周期完成:', {
        时间: new Date(timestamp).toLocaleTimeString('zh-CN'),
        相对时间: `+${(timestamp - tracker.startTime) / 1000}秒`,
        耗时: `${tracker.currentSyncCycle.duration}ms`,
        剩余待同步: getPendingActionsCount() + ' 个'
      });
      
      tracker.currentSyncCycle = null;
    }
  });

  // ==================== 5. Hook syncManager 方法 ====================
  
  // 等待 syncManager 初始化
  const checkSyncManager = setInterval(() => {
    if (window.syncManager) {
      clearInterval(checkSyncManager);
      console.log('✅ [Tracker] SyncManager 已就绪，开始 Hook 方法');
      
      hookSyncManagerMethods();
    }
  }, 100);

  function hookSyncManagerMethods() {
    const sm = window.syncManager;
    
    // Hook performSync
    if (sm.performSync) {
      const originalPerformSync = sm.performSync.bind(sm);
      sm.performSync = async function(...args) {
        const start = Date.now();
        console.log('🚀 [Tracker] performSync 调用开始');
        
        try {
          const result = await originalPerformSync(...args);
          const duration = Date.now() - start;
          console.log(`✅ [Tracker] performSync 完成，耗时: ${duration}ms`);
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          console.error(`❌ [Tracker] performSync 失败，耗时: ${duration}ms`, error);
          throw error;
        }
      };
    }
    
    // Hook recordLocalAction
    if (sm.recordLocalAction) {
      const originalRecordLocalAction = sm.recordLocalAction.bind(sm);
      sm.recordLocalAction = async function(type, entityType, entityId, data) {
        const start = Date.now();
        const title = data?.title || entityId;
        
        console.log(`📋 [Tracker] recordLocalAction 调用:`, {
          type,
          entityType,
          entityId,
          title,
          时间: new Date(start).toLocaleTimeString('zh-CN')
        });
        
        try {
          const result = await originalRecordLocalAction(type, entityType, entityId, data);
          const duration = Date.now() - start;
          
          console.log(`✅ [Tracker] recordLocalAction 完成，耗时: ${duration}ms`);
          
          // 记录到 action 队列变化
          tracker.actionQueueChanges.push({
            timestamp: start,
            relativeTime: start - tracker.startTime,
            type: 'add',
            actionType: type,
            entityId,
            title,
            duration
          });
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          console.error(`❌ [Tracker] recordLocalAction 失败，耗时: ${duration}ms`, error);
          throw error;
        }
      };
    }
    
    // Hook syncSingleAction
    if (sm.syncSingleAction) {
      const originalSyncSingleAction = sm.syncSingleAction.bind(sm);
      sm.syncSingleAction = async function(action) {
        const start = Date.now();
        const title = action.data?.title || action.entityId;
        
        console.log(`🔄 [Tracker] syncSingleAction 开始:`, {
          actionId: action.id,
          type: action.type,
          entityId: action.entityId,
          title,
          retryCount: action.retryCount || 0
        });
        
        try {
          const result = await originalSyncSingleAction(action);
          const duration = Date.now() - start;
          
          console.log(`✅ [Tracker] syncSingleAction 完成，耗时: ${duration}ms`, {
            title,
            成功: result
          });
          
          if (tracker.currentSyncCycle) {
            tracker.currentSyncCycle.phases.push({
              phase: 'syncSingleAction',
              actionId: action.id,
              title,
              duration,
              success: result
            });
          }
          
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          console.error(`❌ [Tracker] syncSingleAction 失败，耗时: ${duration}ms`, error);
          
          if (tracker.currentSyncCycle) {
            tracker.currentSyncCycle.phases.push({
              phase: 'syncSingleAction',
              actionId: action.id,
              title,
              duration,
              success: false,
              error: String(error)
            });
          }
          
          throw error;
        }
      };
    }
  }

  // ==================== 6. 辅助函数 ====================
  
  function getPendingActionsCount() {
    try {
      const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
      return queue.filter(a => !a.synchronized).length;
    } catch {
      return 0;
    }
  }

  // ==================== 7. 生成性能报告 ====================
  
  tracker.generateReport = function() {
    console.log('');
    console.log('='.repeat(80));
    console.log('📊 断网事件同步性能报告');
    console.log('='.repeat(80));
    console.log('');
    
    // 总时长
    const totalDuration = Date.now() - tracker.startTime;
    console.log(`⏱️ 总追踪时长: ${(totalDuration / 1000).toFixed(1)}秒`);
    console.log('');
    
    // 事件创建
    console.log('📝 事件创建记录:');
    if (tracker.eventCreations.size === 0) {
      console.log('   无事件创建');
    } else {
      tracker.eventCreations.forEach((record, eventId) => {
        console.log(`   - ${record.title}`);
        console.log(`     ID: ${eventId}`);
        console.log(`     创建时间: +${(record.relativeTime / 1000).toFixed(1)}秒`);
        console.log(`     状态: ${record.syncStatus}`);
        console.log(`     calendarId: ${record.hasCalendarId ? '有' : '❌ 无'}`);
        console.log(`     tags: ${record.hasTags ? '有' : '❌ 无'}`);
        
        // 检查事件最终是否同步
        const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
        const finalEvent = events.find(e => e.id === eventId);
        if (finalEvent) {
          const hasSynced = !!finalEvent.externalId;
          console.log(`     最终状态: ${hasSynced ? '✅ 已同步' : '⏳ 未同步'}`);
          if (hasSynced && finalEvent.externalId) {
            console.log(`     Outlook ID: ${finalEvent.externalId.substring(0, 30)}...`);
          }
        }
        console.log('');
      });
    }
    
    // 网络状态变化
    console.log('🌐 网络状态变化:');
    if (tracker.networkChanges.length === 0) {
      console.log('   无网络状态变化');
    } else {
      tracker.networkChanges.forEach((change, index) => {
        const icon = change.status === 'online' ? '✅' : '📴';
        console.log(`   ${index + 1}. ${icon} ${change.status === 'online' ? '网络恢复' : '网络断开'}`);
        console.log(`      时间: +${(change.relativeTime / 1000).toFixed(1)}秒`);
        console.log('');
      });
    }
    
    // Action 队列变化
    console.log('📋 Action 队列变化:');
    if (tracker.actionQueueChanges.length === 0) {
      console.log('   无队列变化');
    } else {
      tracker.actionQueueChanges.forEach((change, index) => {
        console.log(`   ${index + 1}. ${change.title}`);
        console.log(`      操作: ${change.type} (${change.actionType})`);
        console.log(`      时间: +${(change.relativeTime / 1000).toFixed(1)}秒`);
        console.log(`      耗时: ${change.duration}ms`);
        console.log('');
      });
    }
    
    // 同步周期
    console.log('🔄 同步周期记录:');
    if (tracker.syncCycles.length === 0) {
      console.log('   无同步周期');
    } else {
      tracker.syncCycles.forEach((cycle, index) => {
        console.log(`   周期 ${index + 1}:`);
        console.log(`      开始: +${(cycle.relativeStart / 1000).toFixed(1)}秒`);
        console.log(`      结束: +${(cycle.relativeEnd / 1000).toFixed(1)}秒`);
        console.log(`      耗时: ${cycle.duration}ms`);
        console.log(`      类型: ${cycle.isFullSync ? '完全同步' : '增量同步'}`);
        console.log(`      待处理: ${cycle.pendingActionsCount} 个`);
        
        if (cycle.phases.length > 0) {
          console.log(`      操作明细:`);
          cycle.phases.forEach((phase, i) => {
            const status = phase.success ? '✅' : '❌';
            console.log(`         ${i + 1}. ${status} ${phase.title} - ${phase.duration}ms`);
          });
        }
        console.log('');
      });
    }
    
    // 关键时间点分析
    console.log('⏱️ 关键时间点分析:');
    
    const firstEventCreation = Array.from(tracker.eventCreations.values())[0];
    const networkOnline = tracker.networkChanges.find(c => c.status === 'online');
    const firstSyncCycle = tracker.syncCycles[0];
    
    if (firstEventCreation) {
      console.log(`   1️⃣ 第一个事件创建: +${(firstEventCreation.relativeTime / 1000).toFixed(1)}秒`);
    }
    
    if (networkOnline) {
      console.log(`   2️⃣ 网络恢复: +${(networkOnline.relativeTime / 1000).toFixed(1)}秒`);
      
      if (firstEventCreation) {
        const offlineDuration = networkOnline.relativeTime - firstEventCreation.relativeTime;
        console.log(`      📴 离线时长: ${(offlineDuration / 1000).toFixed(1)}秒`);
      }
    }
    
    if (firstSyncCycle) {
      console.log(`   3️⃣ 首次同步开始: +${(firstSyncCycle.relativeStart / 1000).toFixed(1)}秒`);
      
      if (networkOnline) {
        const syncDelay = firstSyncCycle.relativeStart - networkOnline.relativeTime;
        console.log(`      ⏳ 网络恢复后延迟: ${(syncDelay / 1000).toFixed(1)}秒`);
      }
      
      console.log(`   4️⃣ 首次同步完成: +${(firstSyncCycle.relativeEnd / 1000).toFixed(1)}秒`);
      console.log(`      ⏱️ 同步耗时: ${(firstSyncCycle.duration / 1000).toFixed(1)}秒`);
    }
    
    // 计算总耗时
    if (firstEventCreation && firstSyncCycle) {
      const totalTime = firstSyncCycle.relativeEnd - firstEventCreation.relativeTime;
      console.log('');
      console.log(`🎯 从事件创建到同步完成总耗时: ${(totalTime / 1000).toFixed(1)}秒`);
      
      // 分解耗时
      if (networkOnline) {
        const offlineTime = networkOnline.relativeTime - firstEventCreation.relativeTime;
        const onlineWaitTime = firstSyncCycle.relativeStart - networkOnline.relativeTime;
        const syncTime = firstSyncCycle.duration;
        
        console.log('');
        console.log('📊 耗时分解:');
        console.log(`   - 离线等待: ${(offlineTime / 1000).toFixed(1)}秒 (${((offlineTime / totalTime) * 100).toFixed(1)}%)`);
        console.log(`   - 网络恢复后等待: ${(onlineWaitTime / 1000).toFixed(1)}秒 (${((onlineWaitTime / totalTime) * 100).toFixed(1)}%)`);
        console.log(`   - 实际同步: ${(syncTime / 1000).toFixed(1)}秒 (${((syncTime / totalTime) * 100).toFixed(1)}%)`);
      }
    }
    
    console.log('');
    console.log('='.repeat(80));
    console.log('✅ 报告生成完成');
    console.log('='.repeat(80));
    
    return tracker;
  };

  // ==================== 8. 暴露到全局 ====================
  
  window.syncTracker = tracker;
  
  console.log('✅ 性能追踪器已启动');
  console.log('');
  console.log('📝 接下来：');
  console.log('   1. 断网（或不断网，追踪器会记录所有操作）');
  console.log('   2. 创建测试事件');
  console.log('   3. 联网');
  console.log('   4. 等待同步完成');
  console.log('   5. 运行 window.syncTracker.generateReport() 查看详细报告');
  console.log('');
  console.log('💡 提示: 追踪器会自动记录所有操作，无需其他操作');
  console.log('='.repeat(80));
  console.log('');
})();
