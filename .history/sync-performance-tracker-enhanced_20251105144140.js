/**
 * 断网事件同步性能追踪工具 - 增强版
 * 
 * 新增功能：
 * - 自动保存日志到 localStorage
 * - 提供简单的复制命令
 * - 减少控制台输出，避免复制困难
 */

(function initializeSyncPerformanceTracker() {
  console.clear();
  console.log('================================================================================');
  console.log('🔍 断网事件同步性能追踪器 [增强版]');
  console.log('================================================================================\n');

  const tracker = {
    eventCreations: new Map(),
    networkChanges: [],
    actionQueueChanges: [],
    syncCycles: [],
    currentSyncCycle: null,
    startTime: Date.now(),
    logs: [] // 新增：保存所有日志
  };

  // 日志记录函数
  function log(type, message, data = {}) {
    const timestamp = Date.now();
    const logEntry = {
      type,
      message,
      data,
      timestamp,
      relativeTime: timestamp - tracker.startTime,
      time: new Date(timestamp).toLocaleTimeString('zh-CN')
    };
    
    tracker.logs.push(logEntry);
    
    // 控制台简化输出
    const icon = {
      'event': '📝',
      'network': '🌐',
      'action': '📋',
      'sync-start': '🔄',
      'sync-end': '✅',
      'performSync': '🚀',
      'error': '❌'
    }[type] || '📊';
    
    console.log(`${icon} [${type}] ${message}`, data);
    
    // 自动保存到 localStorage
    saveToStorage();
  }

  function saveToStorage() {
    try {
      const data = {
        eventCreations: Array.from(tracker.eventCreations.entries()),
        networkChanges: tracker.networkChanges,
        actionQueueChanges: tracker.actionQueueChanges,
        syncCycles: tracker.syncCycles,
        logs: tracker.logs,
        startTime: tracker.startTime
      };
      localStorage.setItem('sync-tracker-data', JSON.stringify(data));
    } catch (e) {
      console.error('保存追踪数据失败:', e);
    }
  }

  // ==================== 1. 监听事件创建 ====================
  const originalDispatchEvent = window.dispatchEvent.bind(window);
  
  window.dispatchEvent = function(event) {
    const result = originalDispatchEvent(event);
    
    if (event.type === 'eventCreated' && event.detail?.event) {
      const evt = event.detail.event;
      const timestamp = Date.now();
      
      const record = {
        eventId: evt.id,
        title: evt.title,
        createdAt: timestamp,
        relativeTime: timestamp - tracker.startTime,
        syncStatus: evt.syncStatus,
        hasCalendarId: !!evt.calendarId,
        hasTags: !!(evt.tags?.length > 0)
      };
      
      tracker.eventCreations.set(evt.id, record);
      
      log('event', '事件创建', {
        title: evt.title,
        eventId: evt.id,
        calendarId: evt.calendarId ? '有' : '无',
        tags: evt.tags?.length > 0 ? '有' : '无'
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
    
    log('network', '网络恢复', {
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
    
    log('network', '网络断开', {});
  });

  // ==================== 3. 监听同步周期 ====================
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
    
    log('sync-start', '同步周期开始', {
      类型: detail.isFullSync ? '完全同步' : '增量同步',
      待处理: tracker.currentSyncCycle.pendingActionsCount + ' 个'
    });
  });

  window.addEventListener('action-sync-completed', (event) => {
    const timestamp = Date.now();
    
    if (tracker.currentSyncCycle) {
      tracker.currentSyncCycle.endTime = timestamp;
      tracker.currentSyncCycle.duration = timestamp - tracker.currentSyncCycle.startTime;
      tracker.currentSyncCycle.relativeEnd = timestamp - tracker.startTime;
      
      tracker.syncCycles.push(tracker.currentSyncCycle);
      
      log('sync-end', '同步周期完成', {
        耗时: `${tracker.currentSyncCycle.duration}ms`,
        剩余待同步: getPendingActionsCount() + ' 个'
      });
      
      tracker.currentSyncCycle = null;
    }
  });

  // ==================== 4. Hook syncManager 方法 ====================
  const checkSyncManager = setInterval(() => {
    if (window.syncManager) {
      clearInterval(checkSyncManager);
      console.log('✅ SyncManager 已就绪，开始 Hook 方法');
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
        log('performSync', 'performSync 调用开始', {});
        
        try {
          const result = await originalPerformSync(...args);
          const duration = Date.now() - start;
          log('performSync', 'performSync 完成', { 耗时: `${duration}ms` });
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          log('error', 'performSync 失败', { 耗时: `${duration}ms`, error: String(error) });
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
        
        log('action', 'recordLocalAction 调用', {
          type,
          entityType,
          title
        });
        
        try {
          const result = await originalRecordLocalAction(type, entityType, entityId, data);
          const duration = Date.now() - start;
          
          tracker.actionQueueChanges.push({
            timestamp: start,
            relativeTime: start - tracker.startTime,
            type: 'add',
            actionType: type,
            entityId,
            title,
            duration
          });
          
          saveToStorage();
          return result;
        } catch (error) {
          const duration = Date.now() - start;
          log('error', 'recordLocalAction 失败', { 耗时: `${duration}ms`, error: String(error) });
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
        
        try {
          const result = await originalSyncSingleAction(action);
          const duration = Date.now() - start;
          
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

  function getPendingActionsCount() {
    try {
      const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
      return queue.filter(a => !a.synchronized).length;
    } catch {
      return 0;
    }
  }

  // ==================== 5. 导出功能 ====================
  
  // 生成简化报告
  tracker.generateReport = function() {
    const totalDuration = Date.now() - tracker.startTime;
    
    const report = {
      总追踪时长: `${(totalDuration / 1000).toFixed(1)}秒`,
      事件创建数量: tracker.eventCreations.size,
      网络状态变化: tracker.networkChanges.length,
      同步周期数量: tracker.syncCycles.length,
      详细数据: {
        事件: Array.from(tracker.eventCreations.values()),
        网络变化: tracker.networkChanges,
        队列变化: tracker.actionQueueChanges,
        同步周期: tracker.syncCycles
      }
    };
    
    // 如果有完整流程，生成时间分析
    const firstEvent = Array.from(tracker.eventCreations.values())[0];
    const networkOnline = tracker.networkChanges.find(c => c.status === 'online');
    const firstSync = tracker.syncCycles[0];
    
    if (firstEvent && networkOnline && firstSync) {
      const offlineTime = networkOnline.relativeTime - firstEvent.relativeTime;
      const onlineWaitTime = firstSync.relativeStart - networkOnline.relativeTime;
      const syncTime = firstSync.duration;
      const totalTime = firstSync.relativeEnd - firstEvent.relativeTime;
      
      report.时间分析 = {
        离线等待: `${(offlineTime / 1000).toFixed(1)}秒 (${((offlineTime / totalTime) * 100).toFixed(1)}%)`,
        网络恢复后等待: `${(onlineWaitTime / 1000).toFixed(1)}秒 (${((onlineWaitTime / totalTime) * 100).toFixed(1)}%)`,
        实际同步: `${(syncTime / 1000).toFixed(1)}秒 (${((syncTime / totalTime) * 100).toFixed(1)}%)`,
        总耗时: `${(totalTime / 1000).toFixed(1)}秒`
      };
    }
    
    console.log('\n================================================================================');
    console.log('📊 同步性能报告');
    console.log('================================================================================');
    console.log(JSON.stringify(report, null, 2));
    console.log('================================================================================\n');
    
    return report;
  };
  
  // 复制到剪贴板（如果浏览器支持）
  tracker.copyReport = async function() {
    const report = this.generateReport();
    const text = JSON.stringify(report, null, 2);
    
    try {
      await navigator.clipboard.writeText(text);
      console.log('✅ 报告已复制到剪贴板');
    } catch (e) {
      console.log('❌ 无法自动复制，请手动复制上面的 JSON 内容');
    }
  };
  
  // 获取原始数据
  tracker.getRawData = function() {
    return {
      eventCreations: Array.from(tracker.eventCreations.entries()),
      networkChanges: tracker.networkChanges,
      actionQueueChanges: tracker.actionQueueChanges,
      syncCycles: tracker.syncCycles,
      logs: tracker.logs,
      startTime: tracker.startTime
    };
  };
  
  // 从 localStorage 恢复数据
  tracker.loadFromStorage = function() {
    try {
      const saved = localStorage.getItem('sync-tracker-data');
      if (saved) {
        const data = JSON.parse(saved);
        console.log('✅ 已加载保存的追踪数据');
        return data;
      }
    } catch (e) {
      console.error('加载失败:', e);
    }
    return null;
  };

  window.syncTracker = tracker;
  
  console.log('✅ 性能追踪器已启动（增强版）\n');
  console.log('📝 使用方法：');
  console.log('   1. 断网 → 创建事件 → 联网 → 等待同步');
  console.log('   2. 运行以下命令：');
  console.log('      window.syncTracker.generateReport()  // 查看报告');
  console.log('      window.syncTracker.copyReport()      // 复制报告到剪贴板');
  console.log('      window.syncTracker.loadFromStorage() // 查看保存的数据');
  console.log('\n💡 所有数据自动保存到 localStorage，不用担心丢失\n');
  console.log('================================================================================\n');
})();
