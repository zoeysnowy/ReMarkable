/**
 * 删除操作完整调用链追踪器
 * 
 * 目标：找出删除事件后 30-60秒 UI 阻塞的根本原因
 * 
 * 使用方法：
 * 1. 打开应用后，在控制台运行此脚本
 * 2. 删除一个事件
 * 3. 尝试打开 EventEditModal 编辑其他事件
 * 4. 查看完整的时间线和性能分析
 */

(function() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 删除操作完整调用链追踪器');
  console.log('='.repeat(80));
  console.log('');
  
  const trace = {
    startTime: Date.now(),
    events: [],
    timings: {},
    longTasks: []
  };
  
  let deleteStartTime = null;
  let isMonitoring = false;

  // 辅助函数：记录事件
  function logEvent(category, action, detail = {}) {
    const now = performance.now();
    const event = {
      timestamp: now,
      elapsed: deleteStartTime ? (now - deleteStartTime).toFixed(2) : '0.00',
      category,
      action,
      detail
    };
    trace.events.push(event);
    
    const emoji = {
      'delete': '🗑️',
      'sync': '🔄',
      'ui': '🖱️',
      'storage': '💾',
      'network': '🌐',
      'render': '🎨',
      'blocking': '⛔'
    }[category] || '📝';
    
    console.log(`${emoji} [${event.elapsed}ms] ${category.toUpperCase()}: ${action}`, detail);
  }

  // 1. Hook EventService.deleteEvent
  if (window.EventService) {
    const originalDelete = window.EventService.deleteEvent.bind(window.EventService);
    window.EventService.deleteEvent = async function(eventId, skipSync) {
      deleteStartTime = performance.now();
      isMonitoring = true;
      
      console.log('\n' + '='.repeat(80));
      console.log('🚨 开始删除事件:', eventId);
      console.log('='.repeat(80));
      
      logEvent('delete', '开始删除', { eventId, skipSync });
      
      const start = performance.now();
      try {
        const result = await originalDelete(eventId, skipSync);
        const duration = performance.now() - start;
        
        logEvent('delete', '删除完成', { 
          duration: `${duration.toFixed(2)}ms`,
          success: result.success 
        });
        
        return result;
      } catch (error) {
        logEvent('delete', '删除失败', { error: error.message });
        throw error;
      }
    };
  }

  // 2. Hook localStorage.setItem (监控存储操作)
  const originalSetItem = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    if (!isMonitoring) return originalSetItem(key, value);
    
    const start = performance.now();
    const result = originalSetItem(key, value);
    const duration = performance.now() - start;
    
    if (duration > 5) {
      logEvent('storage', 'localStorage.setItem', {
        key,
        size: `${(value.length / 1024).toFixed(2)}KB`,
        duration: `${duration.toFixed(2)}ms`
      });
    }
    
    return result;
  };

  // 3. Hook SyncManager.recordLocalAction
  const waitForSyncManager = setInterval(() => {
    if (window.syncManager) {
      clearInterval(waitForSyncManager);
      
      const originalRecordLocalAction = window.syncManager.recordLocalAction.bind(window.syncManager);
      window.syncManager.recordLocalAction = function(type, entityType, entityId, data, oldData) {
        if (!isMonitoring) return originalRecordLocalAction(type, entityType, entityId, data, oldData);
        
        logEvent('sync', 'recordLocalAction 调用', {
          type,
          entityType,
          entityId
        });
        
        const start = performance.now();
        const result = originalRecordLocalAction(type, entityType, entityId, data, oldData);
        const duration = performance.now() - start;
        
        logEvent('sync', 'recordLocalAction 完成', {
          duration: `${duration.toFixed(2)}ms`
        });
        
        return result;
      };

      // Hook syncSingleAction
      const originalSyncSingle = window.syncManager.syncSingleAction?.bind(window.syncManager);
      if (originalSyncSingle) {
        window.syncManager.syncSingleAction = async function(action) {
          if (!isMonitoring) return originalSyncSingle(action);
          
          logEvent('sync', 'syncSingleAction 开始', {
            actionType: action.type,
            entityId: action.entityId
          });
          
          const start = performance.now();
          try {
            const result = await originalSyncSingle(action);
            const duration = performance.now() - start;
            
            logEvent('sync', 'syncSingleAction 完成', {
              duration: `${duration.toFixed(2)}ms`,
              synchronized: action.synchronized
            });
            
            if (duration > 1000) {
              trace.longTasks.push({
                task: 'syncSingleAction',
                duration,
                action: action.type
              });
            }
            
            return result;
          } catch (error) {
            logEvent('sync', 'syncSingleAction 失败', { error: error.message });
            throw error;
          }
        };
      }

      // Hook performSync
      const originalPerformSync = window.syncManager.performSync?.bind(window.syncManager);
      if (originalPerformSync) {
        window.syncManager.performSync = async function(options) {
          if (!isMonitoring) return originalPerformSync(options);
          
          logEvent('sync', 'performSync 触发', options);
          
          const start = performance.now();
          try {
            const result = await originalPerformSync(options);
            const duration = performance.now() - start;
            
            logEvent('sync', 'performSync 完成', {
              duration: `${duration.toFixed(2)}ms`
            });
            
            if (duration > 5000) {
              trace.longTasks.push({
                task: 'performSync',
                duration,
                options
              });
            }
            
            return result;
          } catch (error) {
            logEvent('sync', 'performSync 失败', { error: error.message });
            throw error;
          }
        };
      }
      
      console.log('✅ SyncManager hooks 已安装');
    }
  }, 100);

  // 4. 监控 CustomEvent 分发
  const originalDispatchEvent = window.dispatchEvent.bind(window);
  window.dispatchEvent = function(event) {
    if (!isMonitoring) return originalDispatchEvent(event);
    
    if (event.type === 'eventsUpdated') {
      logEvent('ui', 'eventsUpdated 事件分发', {
        eventId: event.detail?.eventId,
        deleted: event.detail?.deleted
      });
    } else if (event.type === 'sync-status-update') {
      logEvent('sync', 'sync-status-update', event.detail);
    }
    
    return originalDispatchEvent(event);
  };

  // 5. 监控 React 渲染（通过 Performance Observer）
  if (window.PerformanceObserver) {
    const observer = new PerformanceObserver((list) => {
      if (!isMonitoring) return;
      
      for (const entry of list.getEntries()) {
        if (entry.duration > 50) {
          logEvent('render', '长任务检测', {
            name: entry.name,
            duration: `${entry.duration.toFixed(2)}ms`,
            startTime: `${entry.startTime.toFixed(2)}ms`
          });
          
          trace.longTasks.push({
            task: entry.name,
            duration: entry.duration,
            startTime: entry.startTime
          });
        }
      }
    });
    
    try {
      observer.observe({ entryTypes: ['measure', 'longtask'] });
      console.log('✅ Performance Observer 已启动');
    } catch (e) {
      console.log('⚠️ Performance Observer 不支持 longtask');
    }
  }

  // 6. 监控 UI 交互响应
  let lastClickTime = null;
  document.addEventListener('click', (e) => {
    if (!isMonitoring) return;
    
    const target = e.target;
    const targetInfo = target.className || target.tagName;
    
    logEvent('ui', 'click 事件', {
      target: targetInfo,
      timestamp: performance.now()
    });
    
    lastClickTime = performance.now();
  }, true);

  // 7. 监控模态框打开
  const checkModalOpen = setInterval(() => {
    if (!isMonitoring) return;
    
    const modal = document.querySelector('.event-edit-modal');
    if (modal && modal.offsetParent !== null) {
      const openTime = performance.now();
      const elapsed = deleteStartTime ? (openTime - deleteStartTime).toFixed(2) : '0';
      
      logEvent('ui', 'EventEditModal 打开', {
        elapsed: `${elapsed}ms`,
        可交互: '检测中...'
      });
      
      // 测试输入框是否可交互
      const titleInput = modal.querySelector('input[type="text"]');
      if (titleInput) {
        const testStart = performance.now();
        try {
          titleInput.focus();
          const testDuration = performance.now() - testStart;
          
          logEvent('ui', 'Modal 交互测试', {
            focus耗时: `${testDuration.toFixed(2)}ms`,
            可交互: testDuration < 100 ? '✅ 是' : '❌ 否（卡顿）'
          });
        } catch (e) {
          logEvent('ui', 'Modal 交互测试失败', { error: e.message });
        }
      }
    }
  }, 100);

  // 8. 生成报告
  window.generateDeleteReport = function() {
    console.log('\n' + '='.repeat(80));
    console.log('📊 删除操作完整报告');
    console.log('='.repeat(80));
    
    // 时间线
    console.log('\n📅 时间线:');
    trace.events.forEach((event, index) => {
      console.log(`  ${index + 1}. [+${event.elapsed}ms] ${event.category}: ${event.action}`);
    });
    
    // 长任务
    if (trace.longTasks.length > 0) {
      console.log('\n⛔ 长任务 (>50ms):');
      trace.longTasks.forEach((task, index) => {
        console.log(`  ${index + 1}. ${task.task}: ${task.duration.toFixed(2)}ms`);
      });
    }
    
    // 关键指标
    const deleteEvent = trace.events.find(e => e.action === '删除完成');
    const syncComplete = trace.events.find(e => e.action === 'syncSingleAction 完成');
    const modalOpen = trace.events.find(e => e.action === 'EventEditModal 打开');
    
    console.log('\n📈 关键指标:');
    if (deleteEvent) {
      console.log(`  - 删除操作耗时: ${deleteEvent.detail.duration}`);
    }
    if (syncComplete) {
      console.log(`  - 同步操作耗时: ${syncComplete.detail.duration}`);
    }
    if (modalOpen) {
      console.log(`  - Modal 打开延迟: ${modalOpen.elapsed}ms`);
    }
    
    // 导出数据
    console.log('\n💾 完整数据:');
    console.log(trace);
    
    return trace;
  };

  // 停止监控
  window.stopDeleteMonitoring = function() {
    isMonitoring = false;
    console.log('\n⏸️ 监控已停止');
    generateDeleteReport();
  };

  console.log('\n✅ 诊断脚本已就绪！');
  console.log('\n📋 使用说明:');
  console.log('  1. 删除一个事件');
  console.log('  2. 尝试打开/编辑其他事件的 Modal');
  console.log('  3. 运行 window.stopDeleteMonitoring() 查看报告');
  console.log('  4. 或运行 window.generateDeleteReport() 查看实时报告');
  console.log('');
})();
