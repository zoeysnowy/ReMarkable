/**
 * 诊断那 4 个 pending events 的同步结果
 */

console.log('='.repeat(80));
console.log('🔍 诊断 Pending Events 同步结果');
console.log('='.repeat(80));
console.log('');

const EventService = window.EventService;
const debugSyncMgr = window.debugSyncManager;

if (!EventService) {
  console.error('❌ EventService 未加载');
} else if (!debugSyncMgr) {
  console.error('❌ debugSyncManager 未初始化');
} else {
  const allEvents = EventService.getAllEvents?.();
  
  // 找到之前的 4 个 pending events
  const targetIds = [
    'local-1761204179008',  // 房东交流 | 君御豪庭
    'local-1761286443997',  // 🔮ReMarkable开发
    'local-1761808870380',  // 🔮ReMarkable开发
    'local-1762238839286'   // 林锦应 | 1788 coffeechat
  ];
  
  console.log('📊 检查 4 个历史 pending events:');
  console.log('');
  
  targetIds.forEach((id, idx) => {
    const event = allEvents.find(e => e.id === id);
    
    console.log(`${idx + 1}. ID: ${id}`);
    
    if (!event) {
      console.log('   ❌ 事件不存在（可能已删除）');
    } else {
      console.log(`   标题: ${event.title}`);
      console.log(`   remarkableSource: ${event.remarkableSource}`);
      console.log(`   syncStatus: ${event.syncStatus}`);
      console.log(`   externalId: ${event.externalId || 'null'}`);
      console.log(`   description: ${event.description ? `"${event.description.substring(0, 50)}${event.description.length > 50 ? '...' : ''}"` : 'null'}`);
      console.log(`   tagId: ${event.tagId || 'null'}`);
      console.log(`   calendarId: ${event.calendarId || 'null'}`);
      
      if (event.externalId) {
        console.log('   ✅ 已同步到 Outlook');
      } else if (event.syncStatus === 'synced') {
        console.log('   ⚠️ syncStatus 为 synced 但没有 externalId');
      } else if (event.syncStatus === 'pending') {
        console.log('   ⏳ 仍处于 pending 状态');
      }
    }
    console.log('');
  });
  
  // 检查同步队列
  console.log('='.repeat(80));
  console.log('📋 同步队列状态:');
  console.log('='.repeat(80));
  console.log('');
  
  const queue = debugSyncMgr.getActionQueue?.();
  if (!queue) {
    console.log('❌ 无法获取队列');
  } else {
    console.log(`队列总长度: ${queue.length}`);
    
    // 找到相关的 actions
    const relatedActions = queue.filter(a => targetIds.includes(a.entityId));
    
    if (relatedActions.length === 0) {
      console.log('✅ 队列中没有这 4 个事件的待同步操作');
    } else {
      console.log(`⚠️ 队列中还有 ${relatedActions.length} 个相关操作:`);
      console.log('');
      
      relatedActions.forEach((action, idx) => {
        console.log(`${idx + 1}. ${action.data?.title || 'Untitled'}`);
        console.log(`   entityId: ${action.entityId}`);
        console.log(`   type: ${action.type}`);
        console.log(`   synchronized: ${action.synchronized}`);
        console.log(`   failed: ${action.failed || false}`);
        console.log(`   retryCount: ${action.retryCount || 0}`);
        if (action.lastError) {
          console.log(`   lastError: ${action.lastError}`);
        }
        console.log('');
      });
    }
  }
  
  // 检查 Outlook 端
  console.log('='.repeat(80));
  console.log('📧 建议检查 Outlook:');
  console.log('='.repeat(80));
  console.log('');
  console.log('1. 打开 Outlook 日历');
  console.log('2. 搜索以下事件标题:');
  targetIds.forEach((id, idx) => {
    const event = allEvents.find(e => e.id === id);
    if (event) {
      console.log(`   ${idx + 1}. "${event.title}" (${new Date(event.startTime).toLocaleDateString('zh-CN')})`);
    }
  });
  console.log('');
  console.log('3. 检查 description 字段是否完整');
  console.log('4. 如果事件不存在或 description 被删除，可能是同步逻辑问题');
}
