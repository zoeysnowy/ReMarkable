/**
 * 同步队列诊断脚本
 * 
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制整个脚本并粘贴到控制台
 * 3. 按 Enter 执行
 */

console.log('='.repeat(80));
console.log('📊 ReMarkable 同步队列诊断工具');
console.log('='.repeat(80));
console.log('');

// 1. 检查登录状态
console.log('1️⃣ 检查 Microsoft 登录状态:');
console.log('---');
const msService = window.microsoftCalendarService;
if (msService) {
  const isAuth = msService.isSignedIn?.() || false;
  console.log(`✅ MicrosoftCalendarService 已初始化`);
  console.log(`   登录状态: ${isAuth ? '✅ 已登录' : '❌ 未登录'}`);
  
  if (isAuth) {
    const selectedCalId = msService.getSelectedCalendarId?.();
    if (selectedCalId) {
      console.log(`   已选日历 ID: ${selectedCalId}`);
    }
    const isSimulation = msService.getIsSimulationMode?.();
    console.log(`   模拟模式: ${isSimulation ? '是' : '否'}`);
  }
} else {
  console.log('❌ MicrosoftCalendarService 未初始化');
}
console.log('');

// 2. 检查 SyncManager 状态
console.log('2️⃣ 检查 SyncManager 状态:');
console.log('---');
const syncMgr = window.syncManager;
if (syncMgr) {
  console.log('✅ SyncManager 已初始化');
  console.log(`   类型: ${syncMgr.constructor.name}`);
  
  // 获取队列
  const queue = syncMgr.getActionQueue?.();
  if (queue) {
    console.log(`   队列长度: ${queue.length}`);
    
    // 统计队列状态
    const stats = {
      total: queue.length,
      local: 0,
      remote: 0,
      synchronized: 0,
      pending: 0,
      failed: 0,
      create: 0,
      update: 0,
      delete: 0,
      event: 0,
      tag: 0,
    };
    
    queue.forEach(action => {
      if (action.source === 'local') stats.local++;
      if (action.source === 'remote') stats.remote++;
      if (action.synchronized) stats.synchronized++;
      if (!action.synchronized) stats.pending++;
      if (action.failed) stats.failed++;
      if (action.actionType === 'create') stats.create++;
      if (action.actionType === 'update') stats.update++;
      if (action.actionType === 'delete') stats.delete++;
      if (action.entityType === 'event') stats.event++;
      if (action.entityType === 'tag') stats.tag++;
    });
    
    console.log('');
    console.log('   📈 队列统计:');
    console.log(`      来源: Local=${stats.local}, Remote=${stats.remote}`);
    console.log(`      状态: 已同步=${stats.synchronized}, 待同步=${stats.pending}, 失败=${stats.failed}`);
    console.log(`      操作: Create=${stats.create}, Update=${stats.update}, Delete=${stats.delete}`);
    console.log(`      类型: Event=${stats.event}, Tag=${stats.tag}`);
    
    // 显示待同步的 Event 详情
    const pendingEvents = queue.filter(a => 
      a.entityType === 'event' && 
      !a.synchronized && 
      a.source === 'local'
    );
    
    if (pendingEvents.length > 0) {
      console.log('');
      console.log(`   ⏳ 待同步的 Event (${pendingEvents.length} 个):`);
      pendingEvents.slice(0, 10).forEach((action, idx) => {
        const data = action.data;
        console.log(`      ${idx + 1}. [${action.actionType.toUpperCase()}] ${data?.title || data?.subject || 'Untitled'}`);
        console.log(`         ID: ${action.entityId}`);
        console.log(`         时间: ${data?.startTime ? new Date(data.startTime).toLocaleString('zh-CN') : 'N/A'}`);
        console.log(`         创建时间: ${new Date(action.timestamp).toLocaleString('zh-CN')}`);
        if (action.retryCount) console.log(`         重试次数: ${action.retryCount}`);
        if (action.lastError) console.log(`         最后错误: ${action.lastError}`);
      });
      
      if (pendingEvents.length > 10) {
        console.log(`      ... 还有 ${pendingEvents.length - 10} 个待同步`);
      }
    }
    
    // 显示失败的 Event
    const failedEvents = queue.filter(a => 
      a.entityType === 'event' && 
      a.failed
    );
    
    if (failedEvents.length > 0) {
      console.log('');
      console.log(`   ❌ 同步失败的 Event (${failedEvents.length} 个):`);
      failedEvents.forEach((action, idx) => {
        const data = action.data;
        console.log(`      ${idx + 1}. [${action.actionType.toUpperCase()}] ${data?.title || data?.subject || 'Untitled'}`);
        console.log(`         ID: ${action.entityId}`);
        console.log(`         错误: ${action.lastError || 'Unknown error'}`);
        console.log(`         重试次数: ${action.retryCount || 0}`);
      });
    }
    
  } else {
    console.log('   ⚠️ 无法获取队列信息（getActionQueue 方法不存在）');
  }
  
  // 最后同步时间
  const lastSyncTime = syncMgr.getLastSyncTime?.();
  if (lastSyncTime) {
    console.log('');
    console.log(`   最后同步时间: ${new Date(lastSyncTime).toLocaleString('zh-CN')}`);
  }
  
} else {
  console.log('❌ SyncManager 未初始化');
}
console.log('');

// 3. 检查 EventService 状态
console.log('3️⃣ 检查 EventService 状态:');
console.log('---');
const EventService = window.EventService;
if (EventService) {
  console.log('✅ EventService 已加载');
  const isInit = EventService.isInitialized?.();
  console.log(`   初始化状态: ${isInit ? '✅ 已初始化' : '❌ 未初始化'}`);
  
  const allEvents = EventService.getAllEvents?.();
  if (allEvents) {
    console.log(`   总事件数: ${allEvents.length}`);
    
    // 统计事件状态
    const eventStats = {
      total: allEvents.length,
      synced: 0,
      pending: 0,
      localOnly: 0,
      remarkableSource: 0,
      hasEventId: 0,
    };
    
    allEvents.forEach(event => {
      if (event.syncStatus === 'synced') eventStats.synced++;
      if (event.syncStatus === 'pending') eventStats.pending++;
      if (event.syncStatus === 'local-only') eventStats.localOnly++;
      if (event.remarkableSource) eventStats.remarkableSource++;
      if (event.id && event.id.startsWith('event-')) eventStats.hasEventId++;
    });
    
    console.log(`   同步状态: Synced=${eventStats.synced}, Pending=${eventStats.pending}, Local-only=${eventStats.localOnly}`);
    console.log(`   ReMarkable 创建: ${eventStats.remarkableSource}`);
    
    // 显示最近的 pending events
    const pendingEvts = allEvents.filter(e => e.syncStatus === 'pending');
    if (pendingEvts.length > 0) {
      console.log('');
      console.log(`   ⏳ Pending Events (${pendingEvts.length} 个):`);
      pendingEvts.slice(0, 5).forEach((evt, idx) => {
        console.log(`      ${idx + 1}. ${evt.title}`);
        console.log(`         ID: ${evt.id}`);
        console.log(`         开始: ${new Date(evt.startTime).toLocaleString('zh-CN')}`);
      });
    }
  }
} else {
  console.log('❌ EventService 未加载');
}
console.log('');

// 4. 检查 localStorage 中的同步数据
console.log('4️⃣ 检查 localStorage 同步数据:');
console.log('---');
const syncActions = localStorage.getItem('sync_actions');
if (syncActions) {
  try {
    const actions = JSON.parse(syncActions);
    console.log(`   sync_actions 条目数: ${actions.length}`);
  } catch (e) {
    console.log('   ⚠️ sync_actions 解析失败');
  }
} else {
  console.log('   sync_actions 不存在');
}

const events = localStorage.getItem('unified_timeline_events');
if (events) {
  try {
    const evts = JSON.parse(events);
    console.log(`   unified_timeline_events 条目数: ${evts.length}`);
  } catch (e) {
    console.log('   ⚠️ unified_timeline_events 解析失败');
  }
} else {
  console.log('   unified_timeline_events 不存在');
}
console.log('');

// 5. 建议操作
console.log('5️⃣ 建议操作:');
console.log('---');

if (!msService || !msService.isAuthenticated()) {
  console.log('⚠️ 请先登录 Microsoft 账户');
  console.log('   操作: 点击顶部的 "同步" 按钮，然后登录');
}

if (!syncMgr) {
  console.log('⚠️ SyncManager 未初始化');
  console.log('   操作: 刷新页面重新初始化');
}

if (syncMgr && queue && queue.filter(a => !a.synchronized && a.source === 'local').length > 0) {
  console.log('✅ 有待同步的本地操作');
  console.log('   操作: 手动触发同步:');
  console.log('   ```javascript');
  console.log('   await window.syncManager.performSync()');
  console.log('   ```');
}

console.log('');
console.log('='.repeat(80));
console.log('📊 诊断完成');
console.log('='.repeat(80));

// 返回诊断结果对象
const diagnosticResult = {
  msAuth: msService?.isAuthenticated() || false,
  syncManagerReady: !!syncMgr,
  eventServiceReady: EventService?.isInitialized?.() || false,
  queueLength: queue?.length || 0,
  pendingActions: queue?.filter(a => !a.synchronized && a.source === 'local').length || 0,
};

console.log('');
console.log('诊断结果对象（可用于编程）:', diagnosticResult);
console.log('');

diagnosticResult;
