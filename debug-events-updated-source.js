/**
 * 调试脚本：跟踪所有 eventsUpdated 事件的触发来源
 * 
 * 使用方法：
 * 1. 在浏览器控制台运行此脚本
 * 2. 等待 20 秒观察日志
 * 3. 查看每个 eventsUpdated 事件的调用栈
 */

(function() {
  console.log('%c🔍 eventsUpdated 源追踪器已启动', 'background: #4CAF50; color: white; font-size: 14px; padding: 4px 8px; border-radius: 3px;');
  
  let eventCount = 0;
  let batchStart = null;
  const stackSamples = [];
  
  // 拦截 window.dispatchEvent
  const originalDispatch = window.dispatchEvent.bind(window);
  window.dispatchEvent = function(event) {
    if (event.type === 'eventsUpdated') {
      eventCount++;
      
      // 标记批次开始
      if (!batchStart) {
        batchStart = Date.now();
        console.log('%c📦 [Batch Start] 第一个 eventsUpdated 事件', 'background: #2196F3; color: white; padding: 2px 8px;');
      }
      
      // 获取调用栈
      const stack = new Error().stack;
      const caller = stack.split('\n')[2]?.trim();
      
      // 采样前 5 个事件的完整调用栈
      if (stackSamples.length < 5) {
        stackSamples.push({
          index: eventCount,
          eventId: event.detail?.eventId?.slice(-12) || 'unknown',
          isUpdate: event.detail?.isUpdate,
          isNewEvent: event.detail?.isNewEvent,
          isDeleted: event.detail?.deleted,
          stack: stack
        });
      }
      
      // 每 100 个事件打印一次进度
      if (eventCount % 100 === 0) {
        console.log(`⏳ [Progress] ${eventCount} events dispatched...`);
      }
    }
    
    return originalDispatch(event);
  };
  
  // 5 秒后打印统计（假设批次在 5 秒内完成）
  setTimeout(() => {
    if (eventCount === 0) {
      console.log('⚠️ 没有检测到 eventsUpdated 事件，可能还没触发同步');
      return;
    }
    
    const duration = Date.now() - batchStart;
    
    console.log('\n%c📊 eventsUpdated 统计报告', 'background: #FF9800; color: white; font-size: 16px; padding: 6px 12px; border-radius: 4px;');
    console.log(`总计: ${eventCount} 个事件`);
    console.log(`耗时: ${duration}ms (${(duration / eventCount).toFixed(2)}ms/event)`);
    console.log(`速率: ${(eventCount / (duration / 1000)).toFixed(1)} events/sec`);
    
    console.log('\n%c🔍 前 5 个事件的详细信息:', 'background: #9C27B0; color: white; padding: 2px 8px;');
    stackSamples.forEach((sample, i) => {
      console.group(`事件 #${sample.index}: ${sample.eventId}`);
      console.log('字段:', {
        isUpdate: sample.isUpdate,
        isNewEvent: sample.isNewEvent,
        isDeleted: sample.isDeleted
      });
      console.log('调用栈:');
      console.log(sample.stack);
      console.groupEnd();
    });
    
    // 分析调用来源
    console.log('\n%c📍 调用来源分析:', 'background: #00BCD4; color: white; padding: 2px 8px;');
    const sources = {};
    stackSamples.forEach(sample => {
      const lines = sample.stack.split('\n');
      const relevantLine = lines.find(line => 
        line.includes('ActionBasedSyncManager') || 
        line.includes('EventService') ||
        line.includes('syncPendingRemoteActions') ||
        line.includes('dispatchEventUpdate')
      );
      
      if (relevantLine) {
        const match = relevantLine.match(/at (\w+\.)*(\w+)/);
        const source = match ? match[0] : 'unknown';
        sources[source] = (sources[source] || 0) + 1;
      }
    });
    
    console.table(sources);
    
  }, 5000);
  
  console.log('✅ 拦截器已设置，等待 eventsUpdated 事件...');
})();
