/**
 * 诊断 Timer 事件被意外同步到 Outlook 的问题
 * 在浏览器控制台运行
 */

console.log('🔍 [Diagnose] 开始诊断 Timer 同步问题...\n');

// 1. 监听所有 recordLocalAction 调用
const originalRecordLocalAction = window.syncManager?.recordLocalAction;
if (originalRecordLocalAction && window.syncManager) {
  window.syncManager.recordLocalAction = async function(...args) {
    const [type, entity, id, data] = args;
    
    // 检查是否是 Timer 事件
    if (id && id.startsWith('timer-')) {
      console.error('❌ [CAUGHT] Timer 事件被添加到同步队列！');
      console.error('   类型:', type);
      console.error('   事件ID:', id);
      console.error('   syncStatus:', data?.syncStatus);
      console.error('   调用栈:', new Error().stack);
    } else {
      console.log('✅ [Sync] recordLocalAction called:', type, entity, id);
    }
    
    return originalRecordLocalAction.apply(this, args);
  };
  console.log('✅ [Diagnose] recordLocalAction 已被监控\n');
} else {
  console.warn('⚠️ [Diagnose] syncManager 未找到，无法监控 recordLocalAction\n');
}

// 2. 监听 syncSingleAction 调用
const originalSyncSingleAction = window.syncManager?.syncSingleAction;
if (originalSyncSingleAction && window.syncManager) {
  window.syncManager.syncSingleAction = async function(action) {
    if (action.entityId && action.entityId.startsWith('timer-')) {
      console.error('❌ [CAUGHT] Timer 事件正在被同步！');
      console.error('   操作:', action);
      console.error('   调用栈:', new Error().stack);
    }
    
    return originalSyncSingleAction.apply(this, [action]);
  };
  console.log('✅ [Diagnose] syncSingleAction 已被监控\n');
}

// 3. 检查当前同步队列中是否有 Timer 事件
if (window.debugSyncManager) {
  const queue = window.debugSyncManager.getActionQueue();
  const timerActions = queue.filter(a => a.entityId && a.entityId.startsWith('timer-'));
  
  if (timerActions.length > 0) {
    console.error('❌ [Current State] 同步队列中发现 Timer 事件！');
    timerActions.forEach(action => {
      console.error('   -', action.type, action.entityId, 'synchronized:', action.synchronized);
    });
  } else {
    console.log('✅ [Current State] 同步队列中没有 Timer 事件\n');
  }
}

// 4. 检查 localStorage 中的 Timer 事件
const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const timerEvents = events.filter(e => e.id && e.id.startsWith('timer-'));

console.log('📊 [Current State] localStorage 中的 Timer 事件:');
if (timerEvents.length === 0) {
  console.log('   无 Timer 事件\n');
} else {
  timerEvents.forEach(event => {
    console.log(`   - ${event.id}`);
    console.log(`     title: ${event.title}`);
    console.log(`     syncStatus: ${event.syncStatus}`);
    console.log(`     externalId: ${event.externalId || '无'}`);
    console.log(`     remarkableSource: ${event.remarkableSource}`);
  });
}

console.log('\n💡 [Next Steps]');
console.log('1. 开启一个 Timer');
console.log('2. 观察控制台输出');
console.log('3. 如果看到 "❌ [CAUGHT] Timer 事件被添加到同步队列"，说明找到了问题来源');
console.log('4. 检查调用栈找出是哪里调用的 recordLocalAction\n');

console.log('✅ [Diagnose] 监控已激活，现在可以开启 Timer 进行测试');
