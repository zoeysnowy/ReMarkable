/**
 * Plan 页面渲染问题诊断脚本
 * 
 * 问题症状：勾选框时有时无，IndexMap 警告
 * 
 * 在浏览器控制台运行此脚本
 */

console.log('🔍 === Plan 页面渲染诊断开始 ===\n');

// ==================== 1. 检查当前状态 ====================
console.log('📊 [步骤 1/5] 检查当前数据状态...');

const eventsData = localStorage.getItem('remarkable-events');
if (!eventsData) {
  console.log('📭 localStorage 中没有事件');
} else {
  const events = JSON.parse(eventsData);
  console.log(`📋 localStorage 中有 ${events.length} 个事件`);
  
  // 显示前 3 个事件
  events.slice(0, 3).forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.title || '(无标题)'}`);
    console.log(`      - ID: ${e.id}`);
    console.log(`      - isCompleted: ${e.isCompleted}`);
    console.log(`      - mode: ${e.mode || '(无)'}`);
    console.log(`      - startTime: ${e.startTime || '(空)'}`);
  });
}

// ==================== 2. 检查 ActionBasedSyncManager 状态 ====================
console.log('\n🔄 [步骤 2/5] 检查 ActionBasedSyncManager 状态...');

// 尝试访问全局的 syncManager 实例（如果有暴露）
if (window.syncManager) {
  console.log('✅ 找到 syncManager 实例');
  
  // 检查 eventIndexMap
  if (window.syncManager.eventIndexMap) {
    console.log(`📊 IndexMap 大小: ${window.syncManager.eventIndexMap.size}`);
    
    const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
    const expected = events.length;
    const actual = window.syncManager.eventIndexMap.size;
    
    if (actual > expected * 2) {
      console.warn(`⚠️ IndexMap 过大！应该 ≈ ${expected}，实际 = ${actual}`);
    } else if (actual === 0 && expected > 0) {
      console.warn(`⚠️ IndexMap 为空，但有 ${expected} 个事件！`);
    } else {
      console.log(`✅ IndexMap 大小正常`);
    }
  }
} else {
  console.log('⚠️ 未找到全局 syncManager 实例');
  console.log('💡 可以在 ActionBasedSyncManager 构造函数中添加: (window as any).syncManager = this');
}

// ==================== 3. 监控渲染次数 ====================
console.log('\n👁️ [步骤 3/5] 设置渲染监控...');

// 记录渲染次数
window._planRenderCount = 0;
window._planRenderTimes = [];

// 劫持 console.log 来监控 [App] 日志
const originalLog = console.log;
console.log = function(...args) {
  const message = args.join(' ');
  
  // 检测 Plan 页面渲染
  if (message.includes('[App] 🎨') && message.includes('page: plan')) {
    window._planRenderCount++;
    window._planRenderTimes.push(Date.now());
    
    // 检查是否短时间内多次渲染
    if (window._planRenderTimes.length >= 2) {
      const lastTwo = window._planRenderTimes.slice(-2);
      const timeDiff = lastTwo[1] - lastTwo[0];
      
      if (timeDiff < 100) {
        console.warn(
          `⚠️ [渲染警告] Plan 页面在 ${timeDiff}ms 内渲染了 2 次！`,
          `(总计 ${window._planRenderCount} 次)`
        );
      }
    }
  }
  
  originalLog.apply(console, args);
};

console.log('✅ 已设置渲染监控');
console.log('💡 现在可以进行操作，监控渲染次数');

// ==================== 4. 监控 EventService 操作 ====================
console.log('\n📝 [步骤 4/5] 设置 EventService 监控...');

window._eventOperations = [];

// 劫持 EventService 日志
const originalWarn = console.warn;
console.warn = function(...args) {
  const message = args.join(' ');
  
  // 记录 EventService 操作
  if (message.includes('[EventService]')) {
    window._eventOperations.push({
      time: Date.now(),
      message: message.substring(0, 100) // 截断长消息
    });
  }
  
  // 检测 IndexMap 警告
  if (message.includes('IndexMap too large')) {
    console.error('🚨 检测到 IndexMap 过大警告！');
    console.error('📊 当前状态:');
    console.error(`   - localStorage 事件数: ${JSON.parse(localStorage.getItem('remarkable-events') || '[]').length}`);
    console.error(`   - IndexMap 大小: ${message.match(/\d+ entries/)?.[0] || '未知'}`);
    console.error('💡 这可能导致勾选框显示异常');
  }
  
  originalWarn.apply(console, args);
};

console.log('✅ 已设置 EventService 监控');

// ==================== 5. 提供诊断命令 ====================
console.log('\n🛠️ [步骤 5/5] 可用的诊断命令:');
console.log('');
console.log('📊 查看渲染统计:');
console.log('   window.getPlanRenderStats()');
console.log('');
console.log('📝 查看 EventService 操作:');
console.log('   window.getEventOperations()');
console.log('');
console.log('🔄 重建 IndexMap (如果 syncManager 可用):');
console.log('   window.rebuildIndexMap()');
console.log('');
console.log('🧹 清理并重置:');
console.log('   window.cleanupAndReset()');
console.log('');

// 定义诊断命令
window.getPlanRenderStats = function() {
  console.log('📊 Plan 页面渲染统计:');
  console.log(`   - 总渲染次数: ${window._planRenderCount}`);
  console.log(`   - 最近 10 次渲染时间:`);
  
  const recentTimes = window._planRenderTimes.slice(-10);
  recentTimes.forEach((time, i) => {
    const date = new Date(time);
    const timeStr = date.toLocaleTimeString() + '.' + date.getMilliseconds();
    console.log(`     ${i + 1}. ${timeStr}`);
  });
  
  // 分析渲染频率
  if (recentTimes.length >= 2) {
    const intervals = [];
    for (let i = 1; i < recentTimes.length; i++) {
      intervals.push(recentTimes[i] - recentTimes[i - 1]);
    }
    
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
    console.log(`   - 平均渲染间隔: ${avgInterval.toFixed(2)}ms`);
    
    const fastRenders = intervals.filter(i => i < 100).length;
    if (fastRenders > 0) {
      console.warn(`   ⚠️ 有 ${fastRenders} 次快速连续渲染 (<100ms)`);
    }
  }
};

window.getEventOperations = function() {
  console.log('📝 EventService 操作记录:');
  console.log(`   - 总操作数: ${window._eventOperations.length}`);
  console.log(`   - 最近 10 次操作:`);
  
  const recentOps = window._eventOperations.slice(-10);
  recentOps.forEach((op, i) => {
    const date = new Date(op.time);
    const timeStr = date.toLocaleTimeString() + '.' + date.getMilliseconds();
    console.log(`     ${i + 1}. [${timeStr}] ${op.message}`);
  });
};

window.rebuildIndexMap = function() {
  if (!window.syncManager) {
    console.error('❌ syncManager 不可用');
    return;
  }
  
  console.log('🔄 重建 IndexMap...');
  const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
  
  if (window.syncManager.rebuildEventIndexMap) {
    window.syncManager.rebuildEventIndexMap(events);
    console.log('✅ IndexMap 已重建');
  } else {
    console.error('❌ rebuildEventIndexMap 方法不可用');
  }
};

window.cleanupAndReset = function() {
  console.log('🧹 清理并重置...');
  
  // 清理监控数据
  window._planRenderCount = 0;
  window._planRenderTimes = [];
  window._eventOperations = [];
  
  // 恢复原始 console 方法
  console.log = originalLog;
  console.warn = originalWarn;
  
  console.log('✅ 已清理监控数据并恢复 console 方法');
  console.log('💡 刷新页面以完全重置');
};

console.log('\n✅ 诊断系统已就绪！');
console.log('💡 进行一些操作（输入文字、勾选、删除），然后运行诊断命令查看结果');
console.log('\n🔍 === Plan 页面渲染诊断设置完成 ===');
