/**
 * 🔍 同步问题诊断脚本
 * 
 * 使用方法：
 * 1. 打开Electron应用
 * 2. 按F12打开开发者工具
 * 3. 在Console中粘贴并运行这个脚本
 */

(function() {
  console.log('🔍 ========== 同步诊断开始 ==========');
  console.log('');
  
  // ===== 1. 认证状态检查 =====
  console.log('📋 1. 认证状态检查');
  console.log('─'.repeat(50));
  
  const authKey = 'remarkable-outlook-authenticated';
  const authValue = localStorage.getItem(authKey);
  console.log(`   ${authKey}:`, authValue);
  console.log(`   类型:`, typeof authValue);
  console.log(`   === 'true':`, authValue === 'true');
  console.log(`   StatusBar应该显示:`, authValue === 'true' ? '🟢 绿灯' : '🔴 红灯');
  console.log('');
  
  // ===== 2. MicrosoftService检查 =====
  console.log('📋 2. MicrosoftService认证检查');
  console.log('─'.repeat(50));
  
  // 🔧 修复：检查正确的全局变量名
  const msService = window.microsoftService || window.microsoftCalendarService;
  
  if (msService) {
    const isSignedIn = msService.isSignedIn();
    console.log(`   ✅ MicrosoftService 已初始化`);
    console.log(`   全局变量名:`, window.microsoftService ? 'microsoftService' : 'microsoftCalendarService');
    console.log(`   isSignedIn():`, isSignedIn);
    
    // 检查token
    const accessToken = localStorage.getItem('ms-access-token');
    const tokenExpiry = localStorage.getItem('ms-token-expiry');
    console.log(`   Access Token存在:`, !!accessToken);
    console.log(`   Token长度:`, accessToken ? accessToken.length : 0);
    
    if (tokenExpiry) {
      const expiry = new Date(tokenExpiry);
      const now = new Date();
      console.log(`   Token过期时间:`, expiry.toLocaleString());
      console.log(`   当前时间:`, now.toLocaleString());
      console.log(`   Token有效:`, expiry > now);
      console.log(`   剩余时间:`, Math.round((expiry - now) / 1000 / 60), '分钟');
    }
  } else {
    console.log('   ❌ MicrosoftService 未初始化');
    console.log('   检查了以下全局变量:');
    console.log('      - window.microsoftService:', typeof window.microsoftService);
    console.log('      - window.microsoftCalendarService:', typeof window.microsoftCalendarService);
  }
  console.log('');
  
  // ===== 3. SyncManager检查 =====
  console.log('📋 3. SyncManager状态检查');
  console.log('─'.repeat(50));
  
  if (window.debugSyncManager) {
    const isRunning = window.debugSyncManager.isRunning();
    const isSyncInProgress = window.debugSyncManager.isSyncInProgress();
    const lastSyncTime = window.debugSyncManager.getLastSyncTime();
    const actionQueue = window.debugSyncManager.getActionQueue();
    
    console.log(`   SyncManager运行中:`, isRunning);
    console.log(`   正在同步:`, isSyncInProgress);
    console.log(`   最后同步时间:`, lastSyncTime ? lastSyncTime.toLocaleString() : '从未同步');
    console.log(`   Action队列长度:`, actionQueue.length);
    
    if (actionQueue.length > 0) {
      console.log(`   队列中的actions:`);
      
      // 按类型统计
      const stats = actionQueue.reduce((acc, action) => {
        const key = `${action.source}-${action.type}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {});
      
      Object.entries(stats).forEach(([key, count]) => {
        console.log(`      ${key}: ${count}个`);
      });
      
      // 显示最近3个未同步的actions
      const unsynced = actionQueue.filter(a => !a.synchronized).slice(0, 3);
      if (unsynced.length > 0) {
        console.log(`   最近未同步的actions (前3个):`);
        unsynced.forEach((action, i) => {
          const event = action.data;
          console.log(`      [${i+1}] ${action.type} - ${event?.title || action.entityId}`);
          console.log(`          创建时间: ${new Date(action.timestamp).toLocaleString()}`);
          console.log(`          重试次数: ${action.retryCount || 0}`);
          console.log(`          syncStatus: ${event?.syncStatus || 'N/A'}`);
        });
      }
    }
  } else {
    console.log('   ❌ debugSyncManager 未初始化');
  }
  console.log('');
  
  // ===== 4. 本地事件检查 =====
  console.log('📋 4. 本地事件检查（最近3天创建的）');
  console.log('─'.repeat(50));
  
  const eventsStr = localStorage.getItem('remarkable-dev-persistent-events');
  if (eventsStr) {
    const events = JSON.parse(eventsStr);
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    
    const recentEvents = events.filter(e => {
      const createdAt = new Date(e.createdAt || e.updatedAt);
      return createdAt > threeDaysAgo;
    });
    
    console.log(`   总事件数:`, events.length);
    console.log(`   最近3天创建的事件:`, recentEvents.length);
    
    if (recentEvents.length > 0) {
      console.log(`   详细信息（前5个）:`);
      recentEvents.slice(0, 5).forEach((event, i) => {
        console.log(`      [${i+1}] ${event.title}`);
        console.log(`          ID: ${event.id}`);
        console.log(`          externalId: ${event.externalId || '无'}`);
        console.log(`          syncStatus: ${event.syncStatus || '无'}`);
        console.log(`          创建时间: ${new Date(event.createdAt || event.updatedAt).toLocaleString()}`);
        console.log(`          remarkableSource: ${event.remarkableSource}`);
      });
    }
  } else {
    console.log('   ❌ 没有找到本地事件');
  }
  console.log('');
  
  // ===== 5. 网络状态检查 =====
  console.log('📋 5. 网络状态检查');
  console.log('─'.repeat(50));
  console.log(`   navigator.onLine:`, navigator.onLine);
  console.log('');
  
  // ===== 6. 综合诊断 =====
  console.log('📋 6. 综合诊断结果');
  console.log('─'.repeat(50));
  
  const msServiceOK = window.microsoftService?.isSignedIn();
  const authStorageOK = authValue === 'true';
  const syncManagerOK = window.debugSyncManager?.isRunning();
  const networkOK = navigator.onLine;
  
  console.log(`   ✓ MicrosoftService已登录: ${msServiceOK ? '✅' : '❌'}`);
  console.log(`   ✓ localStorage认证标记: ${authStorageOK ? '✅' : '❌'}`);
  console.log(`   ✓ SyncManager运行中: ${syncManagerOK ? '✅' : '❌'}`);
  console.log(`   ✓ 网络连接: ${networkOK ? '✅' : '❌'}`);
  console.log('');
  
  // ===== 诊断结论 =====
  console.log('🎯 诊断结论');
  console.log('─'.repeat(50));
  
  if (!authStorageOK && msServiceOK) {
    console.log('   🔴 问题：StatusBar红灯');
    console.log('   原因：localStorage中的认证标记未正确设置');
    console.log('   解决：运行以下命令修复：');
    console.log('   localStorage.setItem("remarkable-outlook-authenticated", "true");');
    console.log('   window.location.reload();');
  }
  
  if (!syncManagerOK && msServiceOK) {
    console.log('   🔴 问题：SyncManager未运行');
    console.log('   原因：同步管理器没有启动');
    console.log('   解决：检查App.tsx中的syncManager初始化逻辑');
  }
  
  if (syncManagerOK && window.debugSyncManager) {
    const queue = window.debugSyncManager.getActionQueue();
    const unsyncedCount = queue.filter(a => !a.synchronized).length;
    
    if (unsyncedCount > 0) {
      console.log(`   ⚠️  有${unsyncedCount}个未同步的actions在队列中`);
      console.log('   建议：运行以下命令手动触发同步：');
      console.log('   window.debugSyncManager.triggerSync();');
    }
  }
  
  if (msServiceOK && authStorageOK && syncManagerOK && networkOK) {
    console.log('   ✅ 所有状态正常！');
  }
  
  console.log('');
  console.log('🔍 ========== 诊断完成 ==========');
  console.log('');
  console.log('💡 快速修复命令（根据上面的诊断结果选择执行）：');
  console.log('');
  console.log('// 修复StatusBar红灯：');
  console.log('localStorage.setItem("remarkable-outlook-authenticated", "true");');
  console.log('window.location.reload();');
  console.log('');
  console.log('// 手动触发同步：');
  console.log('window.debugSyncManager.triggerSync();');
  console.log('');
  console.log('// 查看同步队列详情：');
  console.log('window.debugSyncManager.getActionQueue();');
  
})();
