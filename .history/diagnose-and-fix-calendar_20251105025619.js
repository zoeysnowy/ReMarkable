/**
 * 诊断并修复日历 ID 问题
 * 
 * 这个脚本会：
 * 1. 检查问题事件的状态
 * 2. 检查标签的日历映射
 * 3. 检查默认日历
 * 4. 提供修复选项
 */

(async function diagnoseAndFixCalendar() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 诊断日历 ID 问题');
  console.log('='.repeat(80));
  console.log('');

  // ==================== 步骤 1: 检查问题事件 ====================
  console.log('📋 步骤 1: 检查问题事件...');
  console.log('');

  const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
  const problemEvent = events.find(e => e.title.includes('ReMarkable开发'));

  if (!problemEvent) {
    console.log('❌ 找不到事件 "🔮ReMarkable开发"');
    return;
  }

  console.log('✓ 找到问题事件:');
  console.table({
    id: problemEvent.id,
    title: problemEvent.title,
    calendarId: problemEvent.calendarId || '❌ NULL',
    tagId: problemEvent.tagId || '无',
    tags: problemEvent.tags?.join(', ') || '无',
    syncStatus: problemEvent.syncStatus,
    externalId: problemEvent.externalId || '无'
  });
  console.log('');

  // ==================== 步骤 2: 检查标签映射 ====================
  console.log('📋 步骤 2: 检查标签的日历映射...');
  console.log('');

  const tags = window.TagService?.getFlatTags() || [];
  console.log(`✓ 总标签数: ${tags.length}`);
  console.log('');

  console.log('所有标签的日历映射状态:');
  tags.forEach(tag => {
    const hasMapping = !!tag.calendarMapping?.calendarId;
    console.log(`  ${hasMapping ? '✓' : '✗'} ${tag.name} (id: ${tag.id})`);
    if (hasMapping) {
      console.log(`    → 日历: ${tag.calendarMapping.calendarName}`);
      console.log(`    → ID: ${tag.calendarMapping.calendarId.substring(0, 40)}...`);
    }
  });
  console.log('');

  // 检查问题事件的标签
  let eventTag = null;
  if (problemEvent.tagId) {
    eventTag = tags.find(t => t.id === problemEvent.tagId);
    console.log(`问题事件的标签: ${eventTag?.name || '未找到'}`);
    if (eventTag && eventTag.calendarMapping?.calendarId) {
      console.log(`  ✓ 标签有日历映射: ${eventTag.calendarMapping.calendarName}`);
    } else {
      console.log(`  ✗ 标签没有日历映射`);
    }
  } else if (problemEvent.tags && problemEvent.tags.length > 0) {
    eventTag = tags.find(t => t.id === problemEvent.tags[0]);
    console.log(`问题事件的标签: ${eventTag?.name || '未找到'}`);
    if (eventTag && eventTag.calendarMapping?.calendarId) {
      console.log(`  ✓ 标签有日历映射: ${eventTag.calendarMapping.calendarName}`);
    } else {
      console.log(`  ✗ 标签没有日历映射`);
    }
  }
  console.log('');

  // ==================== 步骤 3: 检查默认日历 ====================
  console.log('📋 步骤 3: 检查默认日历...');
  console.log('');

  const defaultCalendarId = window.syncManager?.microsoftService?.getSelectedCalendarId() || null;
  if (defaultCalendarId) {
    console.log(`✓ 默认日历 ID: ${defaultCalendarId.substring(0, 40)}...`);
  } else {
    console.log('✗ 没有找到默认日历');
  }
  console.log('');

  // ==================== 步骤 4: 获取可用日历列表 ====================
  console.log('📋 步骤 4: 获取可用日历列表...');
  console.log('');

  let availableCalendars = [];
  try {
    if (window.syncManager?.microsoftService) {
      availableCalendars = await window.syncManager.microsoftService.getCalendars();
      console.log(`✓ 找到 ${availableCalendars.length} 个可用日历:`);
      console.log('');
      availableCalendars.forEach((cal, index) => {
        console.log(`  ${index + 1}. ${cal.name}`);
        console.log(`     ID: ${cal.id.substring(0, 40)}...`);
        console.log(`     主日历: ${cal.isDefaultCalendar ? '是' : '否'}`);
        console.log('');
      });
    }
  } catch (error) {
    console.error('❌ 获取日历列表失败:', error);
  }

  // ==================== 步骤 5: 提供修复方案 ====================
  console.log('='.repeat(80));
  console.log('🔧 修复方案');
  console.log('='.repeat(80));
  console.log('');

  if (availableCalendars.length === 0) {
    console.log('❌ 无法获取日历列表，请确保：');
    console.log('  1. 已登录 Microsoft 账户');
    console.log('  2. 网络连接正常');
    console.log('  3. syncManager 已初始化');
    return;
  }

  // 找到第一个可用的日历（优先主日历）
  const primaryCalendar = availableCalendars.find(c => c.isDefaultCalendar) || availableCalendars[0];
  
  console.log('推荐使用以下日历:');
  console.log(`  📅 ${primaryCalendar.name}`);
  console.log(`  ID: ${primaryCalendar.id}`);
  console.log('');

  console.log('将执行以下操作:');
  console.log(`  1. 设置事件 "${problemEvent.title}" 的 calendarId 为上述日历`);
  console.log('  2. 保存事件到 localStorage');
  console.log('  3. 更新同步队列中的 action');
  console.log('  4. 触发同步');
  console.log('');

  console.log('⏳ 5 秒后自动执行...');
  await new Promise(resolve => setTimeout(resolve, 5000));

  // ==================== 步骤 6: 执行修复 ====================
  console.log('');
  console.log('🔧 执行修复...');
  console.log('');

  // 1. 修复事件
  problemEvent.calendarId = primaryCalendar.id;
  console.log(`✓ 已设置事件 calendarId: ${primaryCalendar.id.substring(0, 40)}...`);

  // 2. 保存事件
  const eventIndex = events.findIndex(e => e.id === problemEvent.id);
  if (eventIndex !== -1) {
    events[eventIndex] = problemEvent;
    localStorage.setItem('remarkable-events', JSON.stringify(events));
    console.log('✓ 已保存事件到 localStorage');
  }

  // 3. 更新同步队列中的 action
  const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
  const actionIndex = queue.findIndex(a => a.entityId === problemEvent.id);
  
  if (actionIndex !== -1) {
    queue[actionIndex].data.calendarId = primaryCalendar.id;
    localStorage.setItem('remarkable-sync-actions', JSON.stringify(queue));
    console.log('✓ 已更新同步队列中的 action');
  } else {
    console.log('⚠️ 队列中找不到该事件的 action');
  }

  // 4. 重新加载队列并触发同步
  console.log('');
  console.log('🔄 触发同步...');
  console.log('');

  if (window.syncManager) {
    window.syncManager.loadActionQueue?.();
    console.log('✓ 已重新加载队列');
    
    window.syncManager.performSync?.();
    console.log('✓ 已触发同步');
  }

  // ==================== 完成 ====================
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ 修复完成');
  console.log('='.repeat(80));
  console.log('');
  console.log('接下来：');
  console.log('  1. 等待 20-30 秒让同步完成');
  console.log('  2. 检查控制台是否还有错误');
  console.log('  3. 运行以下命令验证：');
  console.log('');
  console.log('// 检查事件是否已同步');
  console.log('const evt = JSON.parse(localStorage.getItem("remarkable-events"))');
  console.log('  .find(e => e.title.includes("ReMarkable开发"));');
  console.log('console.table({');
  console.log('  title: evt.title,');
  console.log('  calendarId: evt.calendarId?.substring(0, 40) + "...",');
  console.log('  syncStatus: evt.syncStatus,');
  console.log('  hasExternalId: !!evt.externalId,');
  console.log('  externalId: evt.externalId?.substring(0, 40)');
  console.log('});');
  console.log('');

  return {
    event: problemEvent.title,
    fixedCalendarId: primaryCalendar.id,
    calendarName: primaryCalendar.name
  };
})();
