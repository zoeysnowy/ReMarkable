/**
 * 🔍 Electron多窗口同步问题诊断脚本
 * 
 * 使用方法：
 * 1. 打开Electron **主窗口**（不是Widget）
 * 2. 按F12打开开发者工具
 * 3. 在Console中粘贴并运行这个脚本
 */

(function() {
  console.log('🔍 ========== Electron主窗口同步诊断 ==========');
  console.log('');
  
  // ===== 1. 窗口类型检测 =====
  console.log('📋 1. 窗口类型检测');
  console.log('─'.repeat(50));
  
  const isMainWindow = !!document.querySelector('.app-container, .app-layout');
  const isWidget = !!document.querySelector('.desktop-calendar-widget');
  
  console.log(`   当前窗口类型:`, isMainWindow ? '🏠 主窗口' : isWidget ? '📦 Widget窗口' : '❓ 未知');
  
  if (isWidget) {
    console.log('');
    console.log('   ⚠️  警告：你在Widget窗口中运行了脚本');
    console.log('   请在【主窗口】运行此脚本！');
    console.log('');
    return;
  }
  console.log('');
  
  // ===== 2. 认证状态检查 =====
  console.log('📋 2. 认证状态检查');
  console.log('─'.repeat(50));
  
  const authKey = 'remarkable-outlook-authenticated';
  const authValue = localStorage.getItem(authKey);
  console.log(`   ${authKey}:`, authValue);
  console.log(`   类型:`, typeof authValue);
  console.log(`   === 'true':`, authValue === 'true');
  console.log('');
  
  // ===== 3. MicrosoftService检查 =====
  console.log('📋 3. MicrosoftService认证检查（主窗口）');
  console.log('─'.repeat(50));
  
  if (window.microsoftService) {
    const isSignedIn = window.microsoftService.isSignedIn();
    console.log(`   ✅ microsoftService 已初始化`);
    console.log(`   microsoftService.isSignedIn():`, isSignedIn);
    
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
    console.log('   ❌ microsoftService 未初始化');
    console.log('   这说明App.tsx中的初始化失败了');
  }
  console.log('');
  
  // ===== 4. SyncManager检查 =====
  console.log('📋 4. SyncManager状态检查（主窗口）');
  console.log('─'.repeat(50));
  
  if (window.debugSyncManager) {
    console.log(`   ✅ debugSyncManager 已初始化`);
    
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
      
      // 显示最近5个未同步的actions
      const unsynced = actionQueue.filter(a => !a.synchronized).slice(0, 5);
      if (unsynced.length > 0) {
        console.log(`   最近未同步的actions (前5个):`);
        unsynced.forEach((action, i) => {
          const event = action.data;
          console.log(`      [${i+1}] ${action.type} - ${event?.title || action.entityId}`);
          console.log(`          创建时间: ${new Date(action.timestamp).toLocaleString()}`);
          console.log(`          重试次数: ${action.retryCount || 0}`);
          console.log(`          syncStatus: ${event?.syncStatus || 'N/A'}`);
          console.log(`          lastError: ${action.lastError || 'N/A'}`);
        });
      }
    }
  } else {
    console.log('   ❌ debugSyncManager 未初始化');
    console.log('   这说明SyncManager没有正确创建');
  }
  console.log('');
  
  // ===== 5. 本地事件检查（主窗口localStorage）=====
  console.log('📋 5. 本地事件检查（最近3天创建的）');
  console.log('─'.repeat(50));
  
  const eventsKey = 'remarkable-events';
  const eventsStr = localStorage.getItem(eventsKey);
  
  console.log(`   localStorage key:`, eventsKey);
  console.log(`   数据存在:`, !!eventsStr);
  
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
        console.log(`          externalId: ${event.externalId || '❌ 无（未同步）'}`);
        console.log(`          syncStatus: ${event.syncStatus || '无'}`);
        console.log(`          创建时间: ${new Date(event.createdAt || event.updatedAt).toLocaleString()}`);
        console.log(`          remarkableSource: ${event.remarkableSource}`);
        console.log(`          calendarId: ${event.calendarId || '无'}`);
        console.log(`          tagId: ${event.tagId || '无'}`);
      });
    }
  } else {
    console.log('   ❌ 没有找到本地事件数据');
    console.log('   可能原因：');
    console.log('      1. 从未创建过事件');
    console.log('      2. localStorage被清空了');
    console.log('      3. 使用了错误的storage key');
  }
  console.log('');
  
  // ===== 6. Electron API检查 =====
  console.log('📋 6. Electron API检查');
  console.log('─'.repeat(50));
  
  const hasElectronAPI = typeof window.electronAPI !== 'undefined';
  console.log(`   window.electronAPI 存在:`, hasElectronAPI);
  
  if (hasElectronAPI) {
    console.log(`   可用的Electron APIs:`);
    const apis = Object.keys(window.electronAPI);
    apis.forEach(api => {
      console.log(`      - ${api}`);
    });
    
    // 检查是否有token相关的API
    if (window.electronAPI.getAuthTokens) {
      console.log('');
      console.log('   正在检查Electron主进程中的token...');
      window.electronAPI.getAuthTokens().then(tokens => {
        console.log('   主进程Token状态:', tokens ? '✅ 存在' : '❌ 不存在');
        if (tokens) {
          console.log('   Token详情:', {
            hasAccessToken: !!tokens.accessToken,
            hasRefreshToken: !!tokens.refreshToken,
            expiresAt: tokens.expiresAt ? new Date(tokens.expiresAt).toLocaleString() : '无'
          });
        }
      });
    }
  }
  console.log('');
  
  // ===== 7. 网络状态检查 =====
  console.log('📋 7. 网络状态检查');
  console.log('─'.repeat(50));
  console.log(`   navigator.onLine:`, navigator.onLine);
  console.log('');
  
  // ===== 8. 综合诊断 =====
  console.log('📋 8. 综合诊断结果');
  console.log('─'.repeat(50));
  
  const msServiceOK = window.microsoftService?.isSignedIn();
  const authStorageOK = authValue === 'true';
  const syncManagerOK = window.debugSyncManager?.isRunning();
  const networkOK = navigator.onLine;
  const hasLocalEvents = !!eventsStr;
  
  console.log(`   ✓ MicrosoftService已登录: ${msServiceOK ? '✅' : '❌'}`);
  console.log(`   ✓ localStorage认证标记: ${authStorageOK ? '✅' : '❌'}`);
  console.log(`   ✓ SyncManager运行中: ${syncManagerOK ? '✅' : '❌'}`);
  console.log(`   ✓ 网络连接: ${networkOK ? '✅' : '❌'}`);
  console.log(`   ✓ 有本地事件数据: ${hasLocalEvents ? '✅' : '❌'}`);
  console.log('');
  
  // ===== 9. 诊断结论 =====
  console.log('🎯 诊断结论');
  console.log('─'.repeat(50));
  
  let hasIssues = false;
  
  if (!msServiceOK) {
    hasIssues = true;
    console.log('   🔴 严重问题：MicrosoftService未登录');
    console.log('   原因：App.tsx中的microsoftService初始化失败');
    console.log('   影响：无法同步任何事件到Outlook');
    console.log('   解决：需要重新登录Microsoft账户');
    console.log('   操作：在设置页面点击"连接Outlook"按钮');
  }
  
  if (authStorageOK && !msServiceOK) {
    hasIssues = true;
    console.log('');
    console.log('   ⚠️  状态不一致：localStorage说已登录，但Service未初始化');
    console.log('   原因：可能是应用重启后Service未自动恢复登录状态');
    console.log('   解决：需要修复App.tsx中的认证恢复逻辑');
  }
  
  if (!syncManagerOK && msServiceOK) {
    hasIssues = true;
    console.log('');
    console.log('   🔴 问题：SyncManager未运行');
    console.log('   原因：同步管理器没有启动');
    console.log('   影响：即使登录了也不会同步');
    console.log('   解决：检查App.tsx中的syncManager.start()调用');
  }
  
  if (syncManagerOK && window.debugSyncManager) {
    const queue = window.debugSyncManager.getActionQueue();
    const unsyncedCount = queue.filter(a => !a.synchronized).length;
    
    if (unsyncedCount > 0) {
      hasIssues = true;
      console.log('');
      console.log(`   ⚠️  有${unsyncedCount}个未同步的actions在队列中`);
      console.log('   原因：同步失败或者MicrosoftService未登录');
      console.log('   建议：修复登录问题后，运行以下命令手动触发同步：');
      console.log('   window.debugSyncManager.triggerSync();');
    }
  }
  
  if (!hasLocalEvents && msServiceOK) {
    hasIssues = true;
    console.log('');
    console.log('   ⚠️  没有本地事件数据');
    console.log('   可能原因：');
    console.log('   1. 确实没有创建过事件');
    console.log('   2. 事件存储在其他地方（检查IndexedDB）');
    console.log('   3. localStorage被意外清空');
  }
  
  if (!hasIssues) {
    console.log('   ✅ 所有状态正常！');
    console.log('');
    console.log('   如果还是无法同步，请检查：');
    console.log('   1. Microsoft账户是否有日历权限');
    console.log('   2. 标签是否正确映射到日历');
    console.log('   3. 网络连接是否稳定');
  }
  
  console.log('');
  console.log('🔍 ========== 诊断完成 ==========');
  console.log('');
  console.log('💡 快速修复命令：');
  console.log('');
  
  if (!msServiceOK) {
    console.log('// 1. 【首要任务】重新登录Microsoft账户');
    console.log('//    请到设置页面点击"连接Outlook"按钮');
    console.log('');
  }
  
  console.log('// 2. 手动触发同步（修复登录后执行）：');
  console.log('window.debugSyncManager.triggerSync();');
  console.log('');
  console.log('// 3. 查看同步队列详情：');
  console.log('window.debugSyncManager.getActionQueue();');
  console.log('');
  console.log('// 4. 检查最近3天的本地事件：');
  console.log('JSON.parse(localStorage.getItem("remarkable-dev-persistent-events") || "[]")');
  console.log('  .filter(e => new Date(e.createdAt) > new Date(Date.now() - 3*24*60*60*1000))');
  console.log('  .map(e => ({ title: e.title, externalId: e.externalId, syncStatus: e.syncStatus }))');
  
})();
