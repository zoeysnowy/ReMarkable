/**
 * 诊断谁在频繁调用 getAllEvents()
 * 
 * 在浏览器控制台运行此脚本，然后删除一个事件
 */

(function() {
  console.log('🔧 [Diagnostic] Installing getAllEvents() caller tracker...');
  
  // 找到 EventService
  const EventService = window.EventService || 
                       (window.remarkable && window.remarkable.EventService);
  
  if (!EventService) {
    console.error('❌ Cannot find EventService. Try running this after app loads.');
    return;
  }
  
  // 保存原始方法
  const originalGetAllEvents = EventService.getAllEvents;
  
  // 计数器
  let callCount = 0;
  let lastResetTime = Date.now();
  
  // 重置计数器
  function resetCounter() {
    if (callCount > 0) {
      console.log(`📊 [Summary] getAllEvents() 在 ${((Date.now() - lastResetTime) / 1000).toFixed(1)}s 内被调用 ${callCount} 次`);
    }
    callCount = 0;
    lastResetTime = Date.now();
  }
  
  // 每 5 秒重置一次计数器
  setInterval(resetCounter, 5000);
  
  // 替换方法
  EventService.getAllEvents = function(...args) {
    callCount++;
    
    // 获取调用栈
    const stack = new Error().stack;
    const callerLine = stack.split('\n')[2]; // 第3行是调用者
    const callerMatch = callerLine.match(/at\s+(.+?)\s+\(/);
    const caller = callerMatch ? callerMatch[1] : 'unknown';
    
    console.log(`📞 [getAllEvents] Call #${callCount} from: ${caller}`);
    
    return originalGetAllEvents.apply(this, args);
  };
  
  console.log('✅ [Diagnostic] Tracker installed. Delete an event to see who calls getAllEvents().');
  console.log('💡 Tip: Counter resets every 5 seconds.');
})();
