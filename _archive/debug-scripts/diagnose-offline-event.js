/**
 * 诊断断网期间创建的事件未同步问题
 * 
 * 检查内容：
 * 1. 事件是否存在
 * 2. 事件是否有 calendarId 和 tags
 * 3. 同步队列中是否有对应的 action
 * 4. action 的状态和重试次数
 * 5. 提供修复方案
 */

(async function diagnoseOfflineEvent() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 诊断断网事件未同步问题');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions'
  };

  // ==================== 步骤 1: 查找最近创建的 pending 事件 ====================
  console.log('📋 步骤 1: 查找最近创建的 pending 事件...');
  console.log('');

  const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  
  // 找到所有 pending 状态的本地事件（remarkableSource = true, 没有 externalId）
  const pendingEvents = events.filter(e => 
    e.syncStatus === 'pending' && 
    e.remarkableSource === true && 
    !e.externalId
  );

  console.log(`✓ 找到 ${pendingEvents.length} 个 pending 事件（未同步到 Outlook）`);
  console.log('');

  if (pendingEvents.length === 0) {
    console.log('✅ 没有待同步的事件！');
    console.log('='.repeat(80));
    return;
  }

  // 按创建时间排序，显示最近的5个
  const recentEvents = pendingEvents
    .sort((a, b) => new Date(b.createdAt || b.startTime) - new Date(a.createdAt || a.startTime))
    .slice(0, 5);

  console.log('📝 最近的待同步事件:');
  console.log('');
  recentEvents.forEach((event, index) => {
    const createTime = new Date(event.createdAt || event.startTime).toLocaleString('zh-CN');
    console.log(`${index + 1}. [${event.id}]`);
    console.log(`   标题: ${event.title}`);
    console.log(`   创建时间: ${createTime}`);
    console.log(`   标签: ${event.tags?.join(', ') || event.tagId || '无'}`);
    console.log(`   日历ID: ${event.calendarId ? event.calendarId.substring(0, 30) + '...' : '❌ 缺失'}`);
    console.log(`   同步状态: ${event.syncStatus}`);
    console.log('');
  });

  // ==================== 步骤 2: 检查同步队列 ====================
  console.log('📋 步骤 2: 检查同步队列状态...');
  console.log('');

  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');
  console.log(`✓ 队列中共有 ${queue.length} 个 action`);
  console.log('');

  // 检查每个事件是否有对应的 action
  const eventAnalysis = [];
  
  for (const event of recentEvents) {
    const action = queue.find(a => a.entityId === event.id);
    
    const analysis = {
      eventId: event.id,
      title: event.title,
      hasCalendarId: !!event.calendarId,
      hasTags: !!(event.tags?.length > 0 || event.tagId),
      hasAction: !!action,
      actionSynchronized: action?.synchronized || false,
      actionRetryCount: action?.retryCount || 0,
      actionLastError: action?.lastError || null,
      meetsyncCondition: !!(event.calendarId || event.tags?.length > 0 || event.tagId)
    };
    
    eventAnalysis.push(analysis);
  }

  console.log('📊 事件同步诊断:');
  console.log('');
  
  eventAnalysis.forEach((analysis, index) => {
    console.log(`${index + 1}. ${analysis.title}`);
    console.log(`   ✓ 有 calendarId: ${analysis.hasCalendarId ? '是' : '❌ 否'}`);
    console.log(`   ✓ 有标签: ${analysis.hasTags ? '是' : '❌ 否'}`);
    console.log(`   ✓ 满足同步条件: ${analysis.meetsyncCondition ? '是' : '❌ 否'}`);
    console.log(`   ✓ 在队列中: ${analysis.hasAction ? '是' : '❌ 否'}`);
    
    if (analysis.hasAction) {
      console.log(`   ✓ 已同步: ${analysis.actionSynchronized ? '是' : '否'}`);
      console.log(`   ✓ 重试次数: ${analysis.actionRetryCount}`);
      if (analysis.actionLastError) {
        console.log(`   ❌ 最后错误: ${analysis.actionLastError.substring(0, 50)}...`);
      }
    }
    console.log('');
  });

  // ==================== 步骤 3: 问题分类和修复方案 ====================
  console.log('='.repeat(80));
  console.log('🔧 问题诊断和修复方案');
  console.log('='.repeat(80));
  console.log('');

  const eventsNeedingFix = eventAnalysis.filter(a => !a.actionSynchronized);
  
  if (eventsNeedingFix.length === 0) {
    console.log('✅ 所有事件都已同步或正在同步中！');
    return;
  }

  console.log(`发现 ${eventsNeedingFix.length} 个需要修复的事件:`);
  console.log('');

  // 分类问题
  const missingCalendar = eventsNeedingFix.filter(a => !a.hasCalendarId && !a.hasTags);
  const missingAction = eventsNeedingFix.filter(a => !a.hasAction);
  const failedAction = eventsNeedingFix.filter(a => a.hasAction && a.actionRetryCount > 0);
  const pendingAction = eventsNeedingFix.filter(a => a.hasAction && !a.actionSynchronized && a.actionRetryCount === 0);

  if (missingCalendar.length > 0) {
    console.log(`❌ 问题 1: ${missingCalendar.length} 个事件缺少 calendarId 和 tags`);
    console.log('   原因: 事件创建时没有指定日历或标签');
    console.log('   影响: 无法判断同步目标，不会进入队列');
    console.log('   修复: 需要为事件添加 calendarId 或 tags');
    console.log('');
  }

  if (missingAction.length > 0) {
    console.log(`❌ 问题 2: ${missingAction.length} 个事件缺少同步 action`);
    console.log('   原因: EventHub 未创建对应的同步 action');
    console.log('   影响: 事件永远不会被同步');
    console.log('   修复: 需要手动创建同步 action');
    console.log('');
  }

  if (failedAction.length > 0) {
    console.log(`❌ 问题 3: ${failedAction.length} 个事件同步失败`);
    console.log('   原因: 同步尝试失败并重试');
    console.log('   影响: 可能是网络问题、权限问题或数据格式问题');
    console.log('   修复: 检查错误信息，可能需要重置 action');
    console.log('');
  }

  if (pendingAction.length > 0) {
    console.log(`⏳ 状态 4: ${pendingAction.length} 个事件等待同步`);
    console.log('   原因: Action 在队列中但尚未处理');
    console.log('   影响: 正常状态，需要等待或手动触发同步');
    console.log('   修复: 手动触发同步即可');
    console.log('');
  }

  // ==================== 步骤 4: 自动修复 ====================
  console.log('='.repeat(80));
  console.log('🔧 自动修复');
  console.log('='.repeat(80));
  console.log('');

  console.log('将执行以下修复操作:');
  console.log('  1. 为缺少 calendarId 的事件分配日历');
  console.log('  2. 为缺少 action 的事件创建 action');
  console.log('  3. 触发同步');
  console.log('');
  console.log('⏳ 3 秒后开始修复...');
  await new Promise(resolve => setTimeout(resolve, 3000));
  console.log('');

  // 获取标签信息
  const tags = window.TagService?.getFlatTags() || [];
  const tagsWithCalendar = tags.filter(t => t.calendarMapping?.calendarId);
  const defaultTag = tagsWithCalendar.length > 0 ? tagsWithCalendar[0] : null;

  let fixedCount = 0;
  let actionCreatedCount = 0;

  // 修复事件
  for (const analysis of eventsNeedingFix) {
    const eventIndex = events.findIndex(e => e.id === analysis.eventId);
    if (eventIndex === -1) continue;

    const event = events[eventIndex];
    let needsUpdate = false;

    // 1. 修复缺少 calendarId 的事件
    if (!event.calendarId && !event.tags?.length && !event.tagId) {
      if (defaultTag) {
        event.tags = [defaultTag.id];
        event.tagId = defaultTag.id;
        event.calendarId = defaultTag.calendarMapping.calendarId;
        console.log(`✓ [${event.title}] 添加标签和日历`);
        needsUpdate = true;
        fixedCount++;
      } else {
        console.warn(`⚠️ [${event.title}] 无法修复：没有可用的标签`);
        continue;
      }
    } else if (!event.calendarId && event.tags?.length > 0) {
      // 有标签但没有 calendarId，从标签获取
      const eventTag = tags.find(t => t.id === event.tags[0]);
      if (eventTag?.calendarMapping?.calendarId) {
        event.calendarId = eventTag.calendarMapping.calendarId;
        console.log(`✓ [${event.title}] 从标签获取日历`);
        needsUpdate = true;
        fixedCount++;
      }
    }

    // 2. 创建缺少的 action
    if (!analysis.hasAction) {
      const newAction = {
        id: `fix-offline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        type: 'create',
        entityType: 'event',
        entityId: event.id,
        timestamp: new Date().toISOString(),
        source: 'local',
        data: event,
        synchronized: false,
        retryCount: 0
      };
      queue.push(newAction);
      console.log(`✓ [${event.title}] 创建同步 action`);
      actionCreatedCount++;
      needsUpdate = true;
    }

    if (needsUpdate) {
      events[eventIndex] = event;
    }
  }

  // 保存修改
  if (fixedCount > 0 || actionCreatedCount > 0) {
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));
    
    console.log('');
    console.log(`✅ 修复了 ${fixedCount} 个事件`);
    console.log(`✅ 创建了 ${actionCreatedCount} 个 action`);
    console.log('✅ 已保存到 localStorage');
  }

  // 触发同步
  console.log('');
  console.log('🔄 触发同步...');
  
  if (window.syncManager) {
    if (typeof window.syncManager.loadActionQueue === 'function') {
      window.syncManager.loadActionQueue();
      console.log('✅ 已重新加载队列');
    }
    
    if (typeof window.syncManager.performSync === 'function') {
      window.syncManager.performSync();
      console.log('✅ 已触发同步');
    }
  } else {
    console.warn('⚠️ syncManager 不可用');
  }

  // 完成
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ 诊断和修复完成');
  console.log('='.repeat(80));
  console.log('');
  console.log('接下来：');
  console.log('  1. 等待 20-30 秒让同步完成');
  console.log('  2. 检查控制台是否有错误信息');
  console.log('  3. 运行以下命令验证：');
  console.log('');
  console.log('// 检查待同步事件状态');
  console.log('const pendingEvents = JSON.parse(localStorage.getItem("remarkable-events"))');
  console.log('  .filter(e => e.syncStatus === "pending" && !e.externalId);');
  console.log('console.log(`待同步事件数: ${pendingEvents.length}`);');
  console.log('console.table(pendingEvents.map(e => ({');
  console.log('  title: e.title,');
  console.log('  hasCalendar: !!e.calendarId,');
  console.log('  hasTags: !!(e.tags?.length),');
  console.log('  synced: !!e.externalId');
  console.log('})));');
  console.log('');

  return {
    totalPending: pendingEvents.length,
    needingFix: eventsNeedingFix.length,
    fixed: fixedCount,
    actionsCreated: actionCreatedCount
  };
})();
