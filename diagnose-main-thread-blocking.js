/**
 * 主线程阻塞检测器
 * 
 * 专门检测删除后是否有同步任务阻塞主线程
 */

(function() {
  console.clear();
  console.log('🔍 主线程阻塞检测器');
  console.log('检测策略: 每 16ms 检查一次，如果间隔 >100ms 说明主线程被阻塞');
  console.log('');
  
  let lastCheck = performance.now();
  let blockEvents = [];
  let isMonitoring = false;
  let deleteTriggered = false;

  // 检测主线程阻塞
  setInterval(() => {
    const now = performance.now();
    const gap = now - lastCheck;
    
    if (gap > 100 && isMonitoring) {
      const blockInfo = {
        timestamp: now,
        gap: gap.toFixed(2),
        stack: new Error().stack
      };
      
      blockEvents.push(blockInfo);
      
      console.warn(`⛔ 主线程阻塞 ${gap.toFixed(2)}ms`);
      
      // 尝试捕获调用栈
      if (gap > 1000) {
        console.error(`🚨 严重阻塞 ${(gap/1000).toFixed(2)}秒！`);
        console.log('调用栈:', blockInfo.stack);
      }
    }
    
    lastCheck = now;
  }, 16);

  // Hook 删除操作
  const checkDelete = setInterval(() => {
    if (window.EventService && !deleteTriggered) {
      const original = window.EventService.deleteEvent.bind(window.EventService);
      window.EventService.deleteEvent = async function(...args) {
        console.log('\n🚨 删除事件，开始监控主线程...');
        isMonitoring = true;
        deleteTriggered = true;
        
        const result = await original(...args);
        
        // 继续监控 30 秒
        setTimeout(() => {
          isMonitoring = false;
          console.log('\n📊 监控结束，生成报告:');
          console.log(`  总阻塞次数: ${blockEvents.length}`);
          
          if (blockEvents.length > 0) {
            const totalBlockTime = blockEvents.reduce((sum, e) => sum + parseFloat(e.gap), 0);
            console.log(`  总阻塞时间: ${totalBlockTime.toFixed(2)}ms`);
            console.log(`  最长阻塞: ${Math.max(...blockEvents.map(e => parseFloat(e.gap))).toFixed(2)}ms`);
            console.log('\n详细阻塞事件:');
            blockEvents.forEach((e, i) => {
              console.log(`  ${i+1}. ${e.gap}ms @ ${e.timestamp.toFixed(2)}ms`);
            });
          } else {
            console.log('  ✅ 未检测到明显的主线程阻塞');
          }
          
          window.blockReport = blockEvents;
        }, 30000);
        
        return result;
      };
      
      clearInterval(checkDelete);
      console.log('✅ 删除监控已就绪');
    }
  }, 100);

  // 监控 setTimeout/Promise
  const originalSetTimeout = window.setTimeout;
  let pendingTimeouts = 0;
  
  window.setTimeout = function(fn, delay, ...args) {
    if (isMonitoring) {
      pendingTimeouts++;
      
      const wrapped = function() {
        const start = performance.now();
        try {
          return fn.apply(this, args);
        } finally {
          const duration = performance.now() - start;
          pendingTimeouts--;
          
          if (duration > 100) {
            console.warn(`⚠️ setTimeout 回调耗时 ${duration.toFixed(2)}ms`);
          }
        }
      };
      
      return originalSetTimeout(wrapped, delay);
    }
    
    return originalSetTimeout(fn, delay, ...args);
  };

  console.log('✅ 主线程阻塞检测器已启动');
  console.log('等待删除操作...');
})();
