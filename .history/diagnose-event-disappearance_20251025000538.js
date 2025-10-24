/**
 * 事件消失诊断脚本
 * 在浏览器控制台粘贴并运行此脚本
 */

console.log('🔍 ============ ReMarkable 事件消失诊断 ============\n');

// 1. 检查 localStorage 中的事件
console.log('📊 1. 检查 localStorage 事件数据');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
const eventsStr = localStorage.getItem('remarkable-events');
if (!eventsStr) {
  console.error('❌ localStorage 中没有事件数据！');
} else {
  const events = JSON.parse(eventsStr);
  console.log(`✅ 总事件数: ${events.length}`);
  
  // 分类统计
  const withExternalId = events.filter(e => e.externalId);
  const withoutExternalId = events.filter(e => !e.externalId);
  const localOnly = events.filter(e => e.syncStatus === 'local-only');
  const remarkableSource = events.filter(e => e.remarkableSource);
  const timerEvents = events.filter(e => e.isTimer || e.title?.includes('[专注中]'));
  
  console.log(`   - 有 externalId: ${withExternalId.length}`);
  console.log(`   - 无 externalId: ${withoutExternalId.length}`);
  console.log(`   - syncStatus=local-only: ${localOnly.length}`);
  console.log(`   - remarkableSource=true: ${remarkableSource.length}`);
  console.log(`   - Timer 事件: ${timerEvents.length}`);
  
  console.log('\n📋 前 5 个事件详情:');
  events.slice(0, 5).forEach((e, i) => {
    console.log(`   ${i + 1}. ${e.title}`);
    console.log(`      - ID: ${e.id}`);
    console.log(`      - externalId: ${e.externalId || '无'}`);
    console.log(`      - syncStatus: ${e.syncStatus || '无'}`);
    console.log(`      - remarkableSource: ${e.remarkableSource || false}`);
    console.log(`      - startTime: ${e.startTime}`);
  });
  
  if (timerEvents.length > 0) {
    console.log('\n⏱️ Timer 事件详情:');
    timerEvents.forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.title}`);
      console.log(`      - ID: ${e.id}`);
      console.log(`      - syncStatus: ${e.syncStatus}`);
      console.log(`      - externalId: ${e.externalId || '无'}`);
    });
  }
}

console.log('\n\n🔄 2. 检查同步管理器状态');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (window.debugSyncManager) {
  const actionQueue = window.debugSyncManager.getActionQueue();
  console.log(`✅ 操作队列长度: ${actionQueue.length}`);
  
  // 统计操作类型
  const creates = actionQueue.filter(a => a.type === 'create');
  const updates = actionQueue.filter(a => a.type === 'update');
  const deletes = actionQueue.filter(a => a.type === 'delete');
  
  console.log(`   - create: ${creates.length}`);
  console.log(`   - update: ${updates.length}`);
  console.log(`   - delete: ${deletes.length}`);
  
  if (deletes.length > 0) {
    console.log('\n⚠️ 最近的删除操作:');
    deletes.slice(-10).forEach((action, i) => {
      console.log(`   ${i + 1}. ${action.entityId}`);
      console.log(`      - 时间: ${action.timestamp}`);
      console.log(`      - 来源: ${action.source}`);
      console.log(`      - 已同步: ${action.synchronized}`);
      if (action.oldData) {
        console.log(`      - 事件标题: ${action.oldData.title}`);
      }
    });
  }
  
  console.log(`\n📈 同步管理器信息:`);
  console.log(`   - 是否运行: ${window.debugSyncManager.isRunning()}`);
  console.log(`   - 同步进行中: ${window.debugSyncManager.isSyncInProgress()}`);
  console.log(`   - 上次同步时间: ${window.debugSyncManager.getLastSyncTime()}`);
} else {
  console.error('❌ debugSyncManager 不可用！');
}

console.log('\n\n🎯 3. 检查是否是删除检测误判');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
if (eventsStr && window.debugSyncManager) {
  const events = JSON.parse(eventsStr);
  const recentDeletes = window.debugSyncManager.getActionQueue()
    .filter(a => a.type === 'delete' && a.source === 'remote')
    .slice(-5);
  
  if (recentDeletes.length > 0) {
    console.log('⚠️ 发现远程删除操作（可能是误判）:');
    recentDeletes.forEach((action, i) => {
      const deletedEvent = action.oldData;
      if (deletedEvent) {
        console.log(`\n   ${i + 1}. ${deletedEvent.title}`);
        console.log(`      - 删除时间: ${action.timestamp}`);
        console.log(`      - externalId: ${deletedEvent.externalId}`);
        console.log(`      - remarkableSource: ${deletedEvent.remarkableSource}`);
        console.log(`      - syncStatus: ${deletedEvent.syncStatus}`);
        
        // 判断是否误删
        if (deletedEvent.remarkableSource && !deletedEvent.externalId) {
          console.error('      ❌ 误删！这是纯本地事件，不应该被远程删除检测影响');
        } else if (deletedEvent.syncStatus === 'local-only') {
          console.error('      ❌ 误删！这是 local-only 事件，不应该参与同步');
        } else {
          console.log('      ℹ️ 可能是正常的远程删除');
        }
      }
    });
  } else {
    console.log('✅ 没有发现最近的远程删除操作');
  }
}

console.log('\n\n💡 4. 建议的操作');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('如果发现事件被误删，可以尝试：');
console.log('1. 从备份恢复（如果有）');
console.log('2. 检查 Outlook 日历，看事件是否真的被删除');
console.log('3. 暂时停止同步：window.debugSyncManager?.stop()');
console.log('4. 查看详细的同步日志（在控制台 Network 标签中）');

console.log('\n\n🔍 5. 实时监控（启用调试）');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('运行以下命令启用详细日志：');
console.log('   localStorage.setItem("debug-sync", "true")');
console.log('\n然后刷新页面，等待下次同步，观察控制台输出。');

console.log('\n\n✅ 诊断完成！');
console.log('═════════════════════════════════════════════\n');

// 返回诊断结果对象
const diagnosticResult = {
  eventsCount: eventsStr ? JSON.parse(eventsStr).length : 0,
  hasDebugSyncManager: !!window.debugSyncManager,
  actionQueueLength: window.debugSyncManager ? window.debugSyncManager.getActionQueue().length : 0,
  recentDeletes: window.debugSyncManager 
    ? window.debugSyncManager.getActionQueue().filter(a => a.type === 'delete').slice(-5)
    : []
};

console.log('📦 诊断结果对象（可在控制台查看）:');
console.log(diagnosticResult);

diagnosticResult;
