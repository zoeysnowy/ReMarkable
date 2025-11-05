/**
 * 诊断 Pending Events 详情
 * 
 * 检查为什么这些事件没有被加入同步队列
 */

console.log('='.repeat(80));
console.log('🔍 Pending Events 详细诊断');
console.log('='.repeat(80));
console.log('');

const EventService = window.EventService;
if (!EventService) {
  console.error('❌ EventService 未加载');
} else {
  const allEvents = EventService.getAllEvents?.();
  const pendingEvents = allEvents.filter(e => e.syncStatus === 'pending');
  
  console.log(`找到 ${pendingEvents.length} 个 Pending Events:`);
  console.log('');
  
  pendingEvents.forEach((event, idx) => {
    console.log(`${idx + 1}. ${event.title}`);
    console.log(`   ID: ${event.id}`);
    console.log(`   remarkableSource: ${event.remarkableSource}`);
    console.log(`   externalId: ${event.externalId || 'null'}`);
    console.log(`   syncStatus: ${event.syncStatus}`);
    console.log(`   calendarId: ${event.calendarId || 'null'}`);
    console.log(`   calendarIds: ${JSON.stringify(event.calendarIds || [])}`);
    console.log(`   tagId: ${event.tagId || 'null'}`);
    console.log(`   tags: ${JSON.stringify(event.tags || [])}`);
    console.log(`   startTime: ${event.startTime}`);
    console.log(`   createdAt: ${event.createdAt}`);
    console.log('');
    
    // 判断是否应该加入队列
    const needsSync = event.syncStatus === 'pending' && 
                     event.remarkableSource === true &&
                     !event.externalId;
    
    const hasCalendars = (event.calendarIds && event.calendarIds.length > 0) || event.calendarId;
    const hasTag = event.tagId || (event.tags && event.tags.length > 0);
    const shouldSync = hasCalendars || hasTag;
    
    console.log(`   ✅ 判断结果:`);
    console.log(`      needsSync (pending + remarkableSource + !externalId): ${needsSync}`);
    console.log(`      hasCalendars: ${hasCalendars}`);
    console.log(`      hasTag: ${hasTag}`);
    console.log(`      shouldSync (hasCalendars || hasTag): ${shouldSync}`);
    console.log(`      🎯 最终: ${needsSync && shouldSync ? '✅ 应该加入队列' : '❌ 不应加入队列'}`);
    console.log('');
  });
}

// 检查同步队列
console.log('='.repeat(80));
console.log('📊 同步队列检查');
console.log('='.repeat(80));
console.log('');

const debugSyncMgr = window.debugSyncManager;
if (!debugSyncMgr) {
  console.error('❌ debugSyncManager 未初始化');
} else {
  const queue = debugSyncMgr.getActionQueue?.();
  console.log(`当前队列长度: ${queue?.length || 0}`);
  
  if (queue && queue.length > 0) {
    console.log('');
    console.log('队列内容:');
    queue.forEach((action, idx) => {
      console.log(`${idx + 1}. [${action.actionType}] ${action.entityType} - ${action.entityId}`);
      console.log(`   synchronized: ${action.synchronized}`);
      console.log(`   source: ${action.source}`);
    });
  }
}

console.log('');
console.log('='.repeat(80));
console.log('💡 建议');
console.log('='.repeat(80));
console.log('');
console.log('如果 pending events 应该加入队列但没有加入，可能原因：');
console.log('1. fixOrphanedPendingEvents() 在构造函数中执行时，events 还没有加载完成');
console.log('2. remarkableSource 字段为 false 或 undefined');
console.log('3. 缺少 calendarIds/calendarId 和 tags/tagId');
console.log('4. 已经有 externalId（已同步过）');
console.log('');
console.log('手动触发修复:');
console.log('1. 刷新页面，让 fixOrphanedPendingEvents() 重新执行');
console.log('2. 或在控制台运行: window.debugSyncManager.triggerSync()');
