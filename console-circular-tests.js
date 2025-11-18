// 🛡️ 循环更新防护 - 浏览器控制台测试脚本
// 
// 使用方法：
// 1. 打开ReMarkable应用并进入Plan页面
// 2. 按F12打开开发者工具
// 3. 在Console中粘贴并运行此脚本

console.log('%c🛡️ 循环更新防护测试开始', 'background: #4CAF50; color: white; padding: 8px; font-size: 16px; border-radius: 4px;');

// 检查环境
function checkEnvironment() {
  const checks = [
    { name: 'EventService', available: typeof window.EventService !== 'undefined' },
    { name: 'React', available: typeof window.React !== 'undefined' || document.querySelector('[data-reactroot]') },
    { name: 'PlanManager页面', available: window.location.pathname.includes('plan') || document.querySelector('.plan-manager') }
  ];
  
  console.group('🔍 环境检查');
  checks.forEach(check => {
    console.log(
      `${check.available ? '✅' : '❌'} ${check.name}: ${check.available ? '可用' : '不可用'}`
    );
  });
  console.groupEnd();
  
  return checks.every(check => check.available);
}

// 基础循环防护测试
async function testCircularProtection() {
  if (!checkEnvironment()) {
    console.error('❌ 环境检查失败，请确保在Plan页面运行此测试');
    return { passed: false, error: '环境检查失败' };
  }
  
  console.group('🧪 基础循环防护测试');
  
  try {
    const testEventId = `console-test-${Date.now()}`;
    let updateCount = 0;
    const maxUpdates = 10;
    
    // 监听更新事件
    const updateListener = (e) => {
      const { eventId, originComponent, isLocalUpdate } = e.detail || {};
      if (eventId === testEventId) {
        updateCount++;
        console.log(`📡 更新 #${updateCount}:`, {
          eventId: eventId.slice(-10),
          originComponent,
          isLocalUpdate,
          timestamp: new Date().toLocaleTimeString()
        });
        
        if (updateCount > maxUpdates) {
          console.error('🚨 检测到可能的循环更新！');
        }
      }
    };
    
    window.addEventListener('eventsUpdated', updateListener);
    
    // 创建测试事件
    console.log('📝 创建测试事件...');
    await EventService.createEvent({
      id: testEventId,
      title: 'Console Test Event',
      description: 'Testing circular update prevention from console',
      isPlan: true,
      isTask: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, false, {
      originComponent: 'ConsoleTest',
      source: 'manual-test'
    });
    
    // 等待更新传播
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // 清理
    window.removeEventListener('eventsUpdated', updateListener);
    try {
      const event = EventService.getEventById(testEventId);
      if (event) {
        await EventService.deleteEvent(testEventId);
      }
    } catch (error) {
      // 静默忽略删除失败
    }
    
    // 结果
    const status = updateCount <= 3 ? '✅ 通过' : '⚠️ 警告';
    const message = updateCount <= 3 
      ? `循环防护正常工作，更新次数: ${updateCount}` 
      : `更新次数较多(${updateCount})，可能存在循环`;
    
    console.log(`${status} ${message}`);
    
    return { passed: updateCount <= 3, updateCount };
    
  } catch (error) {
    console.error('❌ 测试失败:', error);
    return { passed: false, error: error.message };
  } finally {
    console.groupEnd();
  }
}

// 快速性能测试
async function testPerformance() {
  console.group('📊 性能测试 (20个事件)');
  
  try {
    const startTime = performance.now();
    const testEvents = [];
    
    for (let i = 0; i < 20; i++) {
      const eventId = `perf-test-${i}-${Date.now()}`;
      testEvents.push(eventId);
      
      await EventService.createEvent({
        id: eventId,
        title: `Performance Test ${i}`,
        isPlan: true,
        isTask: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, false, {
        originComponent: 'ConsoleTest',
        source: 'performance-test'
      });
    }
    
    const endTime = performance.now();
    const duration = endTime - startTime;
    
    // 🔧 立即验证事件存在性（检测自动删除问题）
    console.log('🔍 验证事件创建结果...');
    const verificationResults = [];
    for (const eventId of testEvents) {
      const event = EventService.getEventById(eventId);
      if (event) {
        verificationResults.push({ id: eventId, exists: true });
      } else {
        verificationResults.push({ id: eventId, exists: false });
        console.error(`❌ 事件 ${eventId} 创建后丢失！`);
      }
    }
    
    const existingCount = verificationResults.filter(r => r.exists).length;
    console.log(`📊 验证结果: ${existingCount}/20 事件存在`);
    
    if (existingCount < 20) {
      console.warn(`⚠️ ${20 - existingCount}个事件被意外删除（可能被PlanManager空白检测清理）`);
    }
    
    // 清理测试事件（安静模式）
    for (const eventId of testEvents) {
      try {
        const event = EventService.getEventById(eventId);
        if (event) {
          await EventService.deleteEvent(eventId);
        }
      } catch (error) {
        // 静默忽略删除失败，避免干扰日志
      }
    }
    
    console.log(`✅ 创建20个事件耗时: ${duration.toFixed(2)}ms`);
    console.log(`📈 平均每个事件: ${(duration / 20).toFixed(2)}ms`);
    
    return { duration, avgPerEvent: duration / 20 };
    
  } catch (error) {
    console.error('❌ 性能测试失败:', error);
    return { error: error.message };
  } finally {
    console.groupEnd();
  }
}

// 监控模式
function startMonitoring(duration = 30000) {
  console.log(`🔍 开始监控eventsUpdated事件 (${duration/1000}秒)...`);
  
  let eventCount = 0;
  const eventStats = new Map();
  
  const monitorListener = (e) => {
    eventCount++;
    const { eventId, originComponent, isLocalUpdate, source } = e.detail || {};
    
    // 统计来源
    const key = `${originComponent}-${isLocalUpdate ? 'local' : 'external'}`;
    eventStats.set(key, (eventStats.get(key) || 0) + 1);
    
    console.log(`📡 #${eventCount} Event: ${eventId?.slice(-8)} | ${originComponent} | ${isLocalUpdate ? 'Local' : 'External'} | ${source}`);
  };
  
  window.addEventListener('eventsUpdated', monitorListener);
  
  setTimeout(() => {
    window.removeEventListener('eventsUpdated', monitorListener);
    
    console.group('📊 监控结果');
    console.log(`总事件数: ${eventCount}`);
    console.log('来源统计:');
    eventStats.forEach((count, source) => {
      console.log(`  ${source}: ${count} 次`);
    });
    console.groupEnd();
    
    console.log('🏁 监控结束');
  }, duration);
  
  return () => {
    window.removeEventListener('eventsUpdated', monitorListener);
    console.log('⏹️ 监控已手动停止');
  };
}

// 主测试入口
async function runAllTests() {
  console.log('%c🚀 开始完整测试套件', 'background: #2196F3; color: white; padding: 8px; font-size: 14px; border-radius: 4px;');
  
  const results = {};
  
  // 基础测试
  results.circular = await testCircularProtection();
  
  // 性能测试
  results.performance = await testPerformance();
  
  // 显示汇总
  console.group('📋 测试结果汇总');
  console.log('循环防护:', results.circular.passed ? '✅ 通过' : '❌ 失败');
  console.log('性能测试:', results.performance.error ? '❌ 失败' : '✅ 通过');
  console.groupEnd();
  
  console.log('%c🎉 测试完成！', 'background: #4CAF50; color: white; padding: 8px; font-size: 14px; border-radius: 4px;');
  
  return results;
}

// 导出到全局，方便调用
window.CircularUpdateTests = {
  checkEnvironment,
  testCircularProtection,
  testPerformance,
  startMonitoring,
  runAllTests
};

console.log(`
%c📖 使用说明：

🚀 快速测试：
runAllTests()

🧪 单项测试：
CircularUpdateTests.testCircularProtection()  // 循环防护测试
CircularUpdateTests.testPerformance()         // 性能测试

🔍 监控模式：
CircularUpdateTests.startMonitoring()         // 30秒监控
CircularUpdateTests.startMonitoring(10000)    // 10秒监控

💡 建议先运行 runAllTests() 进行完整测试
`, 'background: #f0f0f0; color: #333; padding: 12px; border-left: 4px solid #2196F3;');

// 自动检查环境
checkEnvironment();