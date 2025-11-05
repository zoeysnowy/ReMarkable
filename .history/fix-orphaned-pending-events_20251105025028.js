/**
 * 修复遗漏的 Pending 事件
 * 
 * 问题：在 EventHub 迁移之前创建的事件，可能状态是 pending 但没有对应的同步 action
 * 解决：扫描所有 pending 事件，为没有 action 的事件创建 action
 * 
 * 使用方法：
 * 1. 打开浏览器控制台
 * 2. 复制整个脚本
 * 3. 粘贴并回车执行
 */

(async function fixOrphanedPendingEvents() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔧 修复遗漏的 Pending 事件');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEYS = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions'
  };

  // ==================== 步骤 1: 加载数据 ====================
  console.log('📋 步骤 1: 加载事件和同步队列...');
  console.log('');

  const events = JSON.parse(localStorage.getItem(STORAGE_KEYS.EVENTS) || '[]');
  const queue = JSON.parse(localStorage.getItem(STORAGE_KEYS.SYNC_ACTIONS) || '[]');

  console.log(`✓ 总事件数: ${events.length}`);
  console.log(`✓ 队列 action 数: ${queue.length}`);
  console.log('');

  // ==================== 步骤 2: 查找 Pending 事件 ====================
  console.log('🔍 步骤 2: 查找 pending 状态的事件...');
  console.log('');

  const pendingEvents = events.filter(event => {
    const needsSync = event.syncStatus === 'pending' && 
                     event.remarkableSource === true &&
                     !event.externalId;
    
    if (!needsSync) return false;
    
    // 检查是否有目标日历或标签
    const hasCalendars = (event.calendarIds && event.calendarIds.length > 0) || event.calendarId;
    const hasTag = event.tagId || (event.tags && event.tags.length > 0);
    
    return hasCalendars || hasTag;
  });

  console.log(`✓ 找到 ${pendingEvents.length} 个 pending 事件（满足同步条件）`);
  console.log('');

  if (pendingEvents.length === 0) {
    console.log('✅ 没有需要修复的事件！');
    console.log('='.repeat(80));
    return;
  }

  // ==================== 步骤 3: 检查哪些缺少 Action ====================
  console.log('🔍 步骤 3: 检查哪些事件缺少同步 action...');
  console.log('');

  const queueEventIds = new Set(queue.map(action => action.entityId));
  const orphanedEvents = pendingEvents.filter(event => !queueEventIds.has(event.id));

  console.log(`✓ 缺少 action 的事件: ${orphanedEvents.length}`);
  console.log('');

  if (orphanedEvents.length === 0) {
    console.log('✅ 所有 pending 事件都已经在队列中！');
    console.log('='.repeat(80));
    return;
  }

  // ==================== 步骤 4: 显示遗漏的事件详情 ====================
  console.log('📝 遗漏的事件列表:');
  console.log('');

  orphanedEvents.forEach((event, index) => {
    console.log(`${index + 1}. [${event.id}] ${event.title}`);
    console.log(`   时间: ${new Date(event.startTime).toLocaleString('zh-CN')}`);
    console.log(`   标签: ${event.tags?.length > 0 ? event.tags.join(', ') : event.tagId || '无'}`);
    console.log(`   日历: ${event.calendarId || '无'}`);
    console.log('');
  });

  // ==================== 步骤 5: 确认修复 ====================
  console.log('='.repeat(80));
  console.log('⚠️ 准备为这些事件创建同步 action');
  console.log('');
  console.log('这将会：');
  console.log('  1. 为每个遗漏的事件创建一个 "create" action');
  console.log('  2. Action 将被添加到同步队列');
  console.log('  3. 下次同步时，这些事件将被同步到 Outlook');
  console.log('');
  console.log('是否继续？自动在 5 秒后继续...');
  console.log('='.repeat(80));
  console.log('');

  await new Promise(resolve => setTimeout(resolve, 5000));

  // ==================== 步骤 6: 修复事件的 calendarId ====================
  console.log('🔧 步骤 6: 修复事件的 calendarId...');
  console.log('');

  // 获取标签和默认日历
  const tags = window.TagService?.getFlatTags() || [];
  const defaultCalendarId = window.syncManager?.microsoftService?.getSelectedCalendarId() || null;
  
  console.log(`✓ 可用标签数: ${tags.length}`);
  console.log(`✓ 默认日历 ID: ${defaultCalendarId ? defaultCalendarId.substring(0, 30) + '...' : '未找到'}`);
  console.log('');

  let fixedCalendarCount = 0;

  for (const orphanedEvent of orphanedEvents) {
    // 🔧 关键：找到原始 events 数组中的事件对象并直接修改
    const originalEvent = events.find(e => e.id === orphanedEvent.id);
    
    if (!originalEvent) {
      console.warn(`  ⚠️ 警告：找不到事件 ${orphanedEvent.id} 在原始数组中`);
      continue;
    }
    
    // 如果事件没有 calendarId，尝试从标签获取
    if (!originalEvent.calendarId) {
      // 尝试从事件的 tags 数组获取
      if (originalEvent.tags && originalEvent.tags.length > 0) {
        const firstTagId = originalEvent.tags[0];
        const tag = tags.find(t => t.id === firstTagId);
        
        if (tag?.calendarMapping?.calendarId) {
          originalEvent.calendarId = tag.calendarMapping.calendarId;
          console.log(`  ✓ [${originalEvent.title}] 从标签 "${tag.name}" 获取日历`);
          fixedCalendarCount++;
        }
      }
      // 尝试从 tagId 获取
      else if (originalEvent.tagId) {
        const tag = tags.find(t => t.id === originalEvent.tagId);
        
        if (tag?.calendarMapping?.calendarId) {
          originalEvent.calendarId = tag.calendarMapping.calendarId;
          console.log(`  ✓ [${originalEvent.title}] 从 tagId "${tag.name}" 获取日历`);
          fixedCalendarCount++;
        }
      }
      
      // 如果还是没有，使用默认日历
      if (!originalEvent.calendarId && defaultCalendarId) {
        originalEvent.calendarId = defaultCalendarId;
        console.log(`  ✓ [${originalEvent.title}] 使用默认日历`);
        fixedCalendarCount++;
      }
    }
  }

  console.log('');
  console.log(`✅ 修复了 ${fixedCalendarCount} 个事件的 calendarId`);
  console.log('');

  // 检查是否还有事件没有 calendarId
  const eventsWithoutCalendar = orphanedEvents.filter(e => !e.calendarId);
  if (eventsWithoutCalendar.length > 0) {
    console.log('⚠️ 以下事件仍然没有 calendarId，可能会同步失败:');
    eventsWithoutCalendar.forEach(e => {
      console.log(`  - ${e.title} (tags: ${e.tags?.join(', ') || e.tagId || '无'})`);
    });
    console.log('');
  }

  // ==================== 步骤 7: 创建 Actions ====================
  console.log('🔧 步骤 7: 创建同步 actions...');
  console.log('');

  let createdCount = 0;
  const newActions = [];

  for (const event of orphanedEvents) {
    const action = {
      id: `fix-orphan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'create',
      entityType: 'event',
      entityId: event.id,
      timestamp: new Date().toISOString(),
      source: 'local',
      data: event,
      synchronized: false,
      retryCount: 0
    };

    newActions.push(action);
    queue.push(action);
    createdCount++;

    console.log(`✓ [${createdCount}/${orphanedEvents.length}] 创建 action: ${event.title}`);
  }

  console.log('');
  console.log(`✅ 成功创建 ${createdCount} 个 actions`);
  console.log('');

  // ==================== 步骤 8: 保存事件和队列 ====================
  console.log('💾 步骤 8: 保存事件和同步队列...');
  console.log('');

  try {
    // 先保存修复后的事件
    localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
    console.log('✅ 事件已保存（包含修复的 calendarId）');
    
    // 再保存队列
    localStorage.setItem(STORAGE_KEYS.SYNC_ACTIONS, JSON.stringify(queue));
    console.log('✅ 同步队列已保存');
    console.log(`   新队列大小: ${queue.length} actions`);
  } catch (error) {
    console.error('❌ 保存失败:', error);
    console.log('');
    console.log('⚠️ 请手动执行以下代码保存：');
    console.log('');
    console.log('localStorage.setItem("remarkable-events", JSON.stringify(' + JSON.stringify(events) + '));');
    console.log('localStorage.setItem("remarkable-sync-actions", JSON.stringify(' + JSON.stringify(queue) + '));');
    return;
  }

  // ==================== 步骤 9: 触发同步 ====================
  console.log('');
  console.log('🔄 步骤 9: 触发同步...');
  console.log('');

  if (window.syncManager) {
    try {
      // 重新加载队列
      window.syncManager.loadActionQueue?.();
      console.log('✓ 同步管理器已重新加载队列');
      
      // 触发同步
      window.syncManager.performSync?.();
      console.log('✓ 已触发同步（请等待 20-30 秒）');
    } catch (error) {
      console.error('⚠️ 触发同步失败:', error);
      console.log('');
      console.log('请手动触发同步：');
      console.log('  方法 1: 刷新页面');
      console.log('  方法 2: 等待自动同步（20-30秒）');
    }
  } else {
    console.log('⚠️ 同步管理器未找到，请刷新页面以触发同步');
  }

  // ==================== 完成报告 ====================
  console.log('');
  console.log('='.repeat(80));
  console.log('📊 修复完成报告');
  console.log('='.repeat(80));
  console.log('');
  console.log(`✅ 修复的事件数: ${createdCount}`);
  console.log(`📋 当前队列大小: ${queue.length}`);
  console.log('');
  console.log('接下来：');
  console.log('  1. 等待 20-30 秒让同步完成');
  console.log('  2. 检查事件是否有 externalId（表示已同步）');
  console.log('  3. 到 Outlook 日历确认事件是否出现');
  console.log('');
  console.log('验证命令：');
  console.log('');
  console.log('// 检查修复的事件是否已同步');
  console.log('const fixedEvents = JSON.parse(localStorage.getItem("remarkable-events"))');
  console.log('  .filter(e => [' + orphanedEvents.map(e => `"${e.id}"`).join(', ') + '].includes(e.id));');
  console.log('console.table(fixedEvents.map(e => ({');
  console.log('  title: e.title,');
  console.log('  synced: !!e.externalId,');
  console.log('  externalId: e.externalId?.substring(0, 20) + "..."');
  console.log('})));');
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ 修复脚本执行完成');
  console.log('='.repeat(80));

  // 保存修复的事件ID列表供验证使用
  window.fixedEventIds = orphanedEvents.map(e => e.id);
  console.log('');
  console.log('💾 修复的事件 ID 已保存到: window.fixedEventIds');
  console.log('');

  return {
    totalPending: pendingEvents.length,
    orphanedCount: orphanedEvents.length,
    fixedCount: createdCount,
    fixedEventIds: window.fixedEventIds
  };
})();
