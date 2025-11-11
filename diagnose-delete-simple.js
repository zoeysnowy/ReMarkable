/**
 * 简化版删除诊断工具
 * 直接在删除前后打点测量
 */

console.clear();
console.log('🔍 简化版删除诊断 - 启动中...\n');

// 检查依赖
console.log('检查环境:');
console.log('  EventService:', typeof window.EventService);
console.log('  syncManager:', typeof window.syncManager);
console.log('');

if (!window.EventService) {
  console.error('❌ EventService 未找到，请确保应用已完全加载');
} else {
  console.log('✅ EventService 已找到');
  
  // 保存原始方法
  const OriginalEventService = window.EventService;
  const originalDelete = OriginalEventService.deleteEvent;
  
  // 重写删除方法
  OriginalEventService.deleteEvent = async function(eventId, skipSync = false) {
    console.log('\n' + '='.repeat(80));
    console.log('🚨 删除操作开始');
    console.log('='.repeat(80));
    console.log('事件ID:', eventId);
    console.log('跳过同步:', skipSync);
    console.log('开始时间:', new Date().toLocaleTimeString());
    
    const t0 = performance.now();
    
    try {
      // 调用原始方法
      console.log('\n📍 调用 EventService.deleteEvent...');
      const result = await originalDelete.call(OriginalEventService, eventId, skipSync);
      
      const t1 = performance.now();
      console.log(`✅ deleteEvent 完成，耗时: ${(t1 - t0).toFixed(2)}ms`);
      console.log('结果:', result);
      
      // 等待一下，观察后续效果
      console.log('\n⏱️ 观察后续影响（5秒）...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const t2 = performance.now();
      console.log(`\n📊 总耗时: ${(t2 - t0).toFixed(2)}ms`);
      console.log('='.repeat(80));
      
      return result;
    } catch (error) {
      const t1 = performance.now();
      console.error(`❌ 删除失败，耗时: ${(t1 - t0).toFixed(2)}ms`);
      console.error('错误:', error);
      throw error;
    }
  };
  
  console.log('✅ 删除方法已hook，现在可以删除事件了\n');
}

// 监控 localStorage 写入
const originalSetItem = localStorage.setItem;
let writeCount = 0;

localStorage.setItem = function(key, value) {
  const start = performance.now();
  const result = originalSetItem.call(this, key, value);
  const duration = performance.now() - start;
  
  writeCount++;
  
  if (duration > 10 || key.includes('event')) {
    console.log(`💾 localStorage.setItem #${writeCount}:`, {
      key: key.substring(0, 30) + '...',
      size: `${(value.length / 1024).toFixed(2)}KB`,
      耗时: `${duration.toFixed(2)}ms`
    });
  }
  
  return result;
};

// 监控同步管理器
if (window.syncManager) {
  console.log('✅ syncManager 已找到');
  
  if (window.syncManager.recordLocalAction) {
    const originalRecord = window.syncManager.recordLocalAction;
    window.syncManager.recordLocalAction = function(...args) {
      console.log('🔄 syncManager.recordLocalAction 调用:', args[0], args[1], args[2]);
      const start = performance.now();
      const result = originalRecord.apply(this, args);
      const duration = performance.now() - start;
      console.log(`  ⏱️ recordLocalAction 耗时: ${duration.toFixed(2)}ms`);
      return result;
    };
  }
  
  if (window.syncManager.performSync) {
    const originalPerform = window.syncManager.performSync;
    window.syncManager.performSync = async function(...args) {
      console.log('🔄 syncManager.performSync 触发');
      const start = performance.now();
      const result = await originalPerform.apply(this, args);
      const duration = performance.now() - start;
      console.log(`  ⏱️ performSync 耗时: ${duration.toFixed(2)}ms`);
      return result;
    };
  }
} else {
  console.warn('⚠️ syncManager 未找到');
}

console.log('\n📋 准备就绪！请执行以下操作:');
console.log('  1. 删除一个事件');
console.log('  2. 观察控制台输出');
console.log('  3. 尝试打开另一个事件的编辑框');
console.log('');
