/**
 * Plan 页面数据处理修复验证脚本
 * 
 * 测试内容：
 * 1. 数据持久化测试
 * 2. UpcomingPanel 性能测试
 */

console.log('%c[测试开始] Plan 页面数据处理修复验证', 'color: #22d3ee; font-weight: bold; font-size: 14px;');

// ===== 测试 1: 数据持久化 =====
console.log('\n%c📋 测试 1: 数据持久化', 'color: #3b82f6; font-weight: bold;');

const testPersistence = () => {
  const testId = `test-persist-${Date.now()}`;
  
  console.log('1️⃣ 创建测试事件...');
  const testEvent = {
    id: testId,
    title: { simpleTitle: '测试持久化事件' },
    isPlan: true,
    isTask: true,
    remarkableSource: true,
    createdAt: new Date().toISOString(),
    source: 'local',
    syncStatus: 'local-only'
  };
  
  // 检查 EventHub 是否可用
  if (typeof EventHub === 'undefined') {
    console.error('❌ EventHub 未定义，请在浏览器控制台中运行此脚本');
    return;
  }
  
  // 创建事件
  EventHub.createEvent(testEvent, { source: 'test' })
    .then(() => {
      console.log('✅ 事件已创建');
      
      // 验证是否保存到 localStorage
      setTimeout(() => {
        const savedEvent = EventService.getEventById(testId);
        if (savedEvent) {
          console.log('✅ 数据已保存到 localStorage:', {
            id: savedEvent.id,
            title: savedEvent.title?.simpleTitle
          });
          
          // 清理测试数据
          EventHub.deleteEvent(testId, { source: 'test' })
            .then(() => {
              console.log('✅ 测试数据已清理');
              console.log('%c[测试 1 通过] 数据持久化正常', 'color: #10b981; font-weight: bold;');
            });
        } else {
          console.error('❌ 数据未保存到 localStorage');
          console.log('%c[测试 1 失败] 数据持久化失败', 'color: #ef4444; font-weight: bold;');
        }
      }, 500);
    })
    .catch(error => {
      console.error('❌ 创建事件失败:', error);
      console.log('%c[测试 1 失败] 创建事件异常', 'color: #ef4444; font-weight: bold;');
    });
};

// ===== 测试 2: UpcomingPanel 性能 =====
console.log('\n%c⚡ 测试 2: UpcomingPanel 性能', 'color: #3b82f6; font-weight: bold;');

const testPerformance = () => {
  console.log('1️⃣ 测试 getAllEvents 调用频率...');
  
  // 监听 getAllEvents 调用
  let callCount = 0;
  const originalGetAllEvents = EventService.getAllEvents;
  
  EventService.getAllEvents = function() {
    callCount++;
    console.log(`📊 getAllEvents 被调用 (第 ${callCount} 次)`);
    return originalGetAllEvents.call(this);
  };
  
  // 模拟 1 分钟后检查
  setTimeout(() => {
    console.log('\n📊 性能统计:');
    console.log(`  - getAllEvents 调用次数: ${callCount}`);
    
    if (callCount <= 2) {
      console.log('%c  ✅ 性能优化成功 (预期: ≤2次)', 'color: #10b981;');
      console.log('%c[测试 2 通过] UpcomingPanel 性能正常', 'color: #10b981; font-weight: bold;');
    } else {
      console.log('%c  ❌ 性能未达标 (预期: ≤2次)', 'color: #ef4444;');
      console.log('%c[测试 2 失败] UpcomingPanel 性能不足', 'color: #ef4444; font-weight: bold;');
    }
    
    // 恢复原始方法
    EventService.getAllEvents = originalGetAllEvents;
  }, 60000);
  
  console.log('⏳ 等待 1 分钟收集性能数据...');
};

// ===== 测试 3: 刷新页面数据保留 =====
console.log('\n%c🔄 测试 3: 刷新页面数据保留', 'color: #3b82f6; font-weight: bold;');

const testRefreshPersistence = () => {
  const testId = `test-refresh-${Date.now()}`;
  
  console.log('1️⃣ 创建测试事件...');
  const testEvent = {
    id: testId,
    title: { simpleTitle: '测试刷新保留' },
    isPlan: true,
    isTask: true,
    remarkableSource: true,
    createdAt: new Date().toISOString(),
    source: 'local',
    syncStatus: 'local-only'
  };
  
  EventHub.createEvent(testEvent, { source: 'test' })
    .then(() => {
      console.log('✅ 事件已创建');
      console.log('%c2️⃣ 请刷新页面，然后在控制台运行:', 'color: #f59e0b; font-weight: bold;');
      console.log(`%cEventService.getEventById('${testId}')`, 'background: #1f2937; color: #22d3ee; padding: 4px 8px; border-radius: 4px;');
      console.log('如果返回事件对象，说明数据保留成功 ✅');
      console.log('如果返回 null，说明数据丢失 ❌');
      
      // 保存测试ID到 localStorage
      localStorage.setItem('__test_refresh_id', testId);
    })
    .catch(error => {
      console.error('❌ 创建事件失败:', error);
    });
};

// ===== 快速测试命令 =====
console.log('\n%c📝 快速测试命令', 'color: #a855f7; font-weight: bold;');
console.log('在浏览器控制台中运行以下命令：');
console.log('');
console.log('%c1. 测试数据持久化:', 'color: #22d3ee;');
console.log('%c   testPersistence()', 'background: #1f2937; color: #22d3ee; padding: 4px 8px; border-radius: 4px;');
console.log('');
console.log('%c2. 测试性能优化:', 'color: #22d3ee;');
console.log('%c   testPerformance()', 'background: #1f2937; color: #22d3ee; padding: 4px 8px; border-radius: 4px;');
console.log('');
console.log('%c3. 测试刷新保留:', 'color: #22d3ee;');
console.log('%c   testRefreshPersistence()', 'background: #1f2937; color: #22d3ee; padding: 4px 8px; border-radius: 4px;');
console.log('');
console.log('%c4. 验证刷新后数据:', 'color: #22d3ee;');
console.log('%c   EventService.getEventById(localStorage.getItem("__test_refresh_id"))', 'background: #1f2937; color: #22d3ee; padding: 4px 8px; border-radius: 4px;');

// 导出测试函数到全局
if (typeof window !== 'undefined') {
  window.testPersistence = testPersistence;
  window.testPerformance = testPerformance;
  window.testRefreshPersistence = testRefreshPersistence;
  
  console.log('\n%c✅ 测试函数已导出到 window 对象', 'color: #10b981; font-weight: bold;');
}
