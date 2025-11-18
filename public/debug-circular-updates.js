/**
 * 循环更新防护 - 测试和调试工具
 * 使用方法：在浏览器控制台运行 window.testCircularUpdate()
 */

// 🧪 循环检测测试函数
window.testCircularUpdate = () => {
  console.log('🧪 开始循环更新防护测试...');
  
  let updateCount = 0;
  const originalDispatch = EventService.dispatchEventUpdate;
  const testEventId = `test-event-${Date.now()}`;
  
  // 拦截dispatchEventUpdate，统计调用次数
  EventService.dispatchEventUpdate = function(eventId, detail) {
    updateCount++;
    console.log(`📊 更新计数: ${updateCount}`, { 
      eventId: eventId?.slice(-10), 
      detail: {
        updateId: detail.updateId,
        originComponent: detail.originComponent,
        isLocalUpdate: detail.isLocalUpdate
      }
    });
    
    if (updateCount > 10) {
      console.error('🚨 检测到可能的循环更新！超过10次更新');
      EventService.dispatchEventUpdate = originalDispatch;
      return originalDispatch.call(this, eventId, detail);
    }
    
    return originalDispatch.call(this, eventId, detail);
  };
  
  // 创建测试事件
  EventService.createEvent({
    id: testEventId,
    title: 'Test Circular Update Prevention',
    description: 'This is a test event',
    isPlan: true,
    isTask: true,
    startTime: '',
    endTime: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, false, {
    originComponent: 'PlanManager',
    source: 'user-edit'
  }).then(() => {
    // 2秒后恢复原始函数并输出结果
    setTimeout(() => {
      EventService.dispatchEventUpdate = originalDispatch;
      
      if (updateCount <= 3) {
        console.log(`✅ 测试通过！总更新次数: ${updateCount}（正常范围）`);
      } else {
        console.warn(`⚠️ 更新次数较多: ${updateCount}，可能存在问题`);
      }
      
      // 清理测试事件
      EventService.deleteEvent(testEventId);
    }, 2000);
  });
};

// 🔍 实时监控函数
window.monitorUpdates = (duration = 30000) => {
  console.log(`🔍 开始监控更新事件，持续${duration/1000}秒...`);
  
  const updateLog = [];
  const startTime = Date.now();
  
  const monitor = (e) => {
    const { eventId, updateId, originComponent, isLocalUpdate } = e.detail || {};
    const timestamp = Date.now() - startTime;
    
    updateLog.push({
      timestamp: `+${timestamp}ms`,
      eventId: eventId?.slice(-10),
      updateId,
      originComponent,
      isLocalUpdate,
      wasSkipped: false
    });
    
    console.log(`📡 [${timestamp}ms] eventsUpdated:`, {
      eventId: eventId?.slice(-10),
      originComponent,
      isLocalUpdate
    });
  };
  
  window.addEventListener('eventsUpdated', monitor);
  
  setTimeout(() => {
    window.removeEventListener('eventsUpdated', monitor);
    console.log('📊 监控完成，更新统计:');
    console.table(updateLog);
    
    // 分析循环模式
    const groupedByEvent = updateLog.reduce((acc, log) => {
      const key = log.eventId;
      if (!acc[key]) acc[key] = [];
      acc[key].push(log);
      return acc;
    }, {});
    
    Object.entries(groupedByEvent).forEach(([eventId, logs]) => {
      if (logs.length > 3) {
        console.warn(`⚠️ 事件 ${eventId} 更新次数异常: ${logs.length}次`);
      }
    });
  }, duration);
};

// 🛠️ 手动触发防护测试
window.triggerUpdateLoop = () => {
  console.log('🔄 手动触发更新循环测试...');
  
  const testEvent = {
    id: `loop-test-${Date.now()}`,
    title: 'Loop Test Event',
    isPlan: true,
    isTask: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  
  // 连续触发多次更新，测试防护机制
  EventService.createEvent(testEvent, false, {
    originComponent: 'PlanManager',
    source: 'user-edit'
  }).then(() => {
    // 等待100ms后再次更新（模拟快速连续更新）
    setTimeout(() => {
      EventService.updateEvent(testEvent.id, {
        ...testEvent,
        title: 'Updated Loop Test Event',
        updatedAt: new Date().toISOString()
      }, false, {
        originComponent: 'PlanManager', 
        source: 'user-edit'
      });
    }, 100);
    
    setTimeout(() => {
      EventService.updateEvent(testEvent.id, {
        ...testEvent,
        title: 'Updated Again Loop Test Event',
        updatedAt: new Date().toISOString()
      }, false, {
        originComponent: 'PlanManager',
        source: 'user-edit'  
      });
    }, 200);
  });
};

console.log('🛡️ 循环更新防护工具已加载');
console.log('💡 可用命令:');
console.log('  - window.testCircularUpdate()    测试循环防护');
console.log('  - window.monitorUpdates(30000)   监控30秒更新'); 
console.log('  - window.triggerUpdateLoop()     手动触发循环测试');