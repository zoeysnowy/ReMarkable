/**
 * 快速修复事件：分配现有标签和日历
 */

(async function quickFixEvent() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔧 快速修复事件');
  console.log('='.repeat(80));
  console.log('');

  // 1. 找到问题事件
  const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
  const problemEvent = events.find(e => e.title.includes('ReMarkable开发'));

  if (!problemEvent) {
    console.log('❌ 找不到事件 "🔮ReMarkable开发"');
    return;
  }

  console.log('✓ 找到问题事件:');
  console.log(`  标题: ${problemEvent.title}`);
  console.log(`  当前 tagId: ${problemEvent.tagId || '无'}`);
  console.log(`  当前 tags: ${problemEvent.tags?.join(', ') || '无'}`);
  console.log(`  当前 calendarId: ${problemEvent.calendarId || '无'}`);
  console.log('');

  // 2. 获取有日历映射的标签
  const tags = window.TagService?.getFlatTags() || [];
  const tagsWithCalendar = tags.filter(t => t.calendarMapping?.calendarId);

  console.log(`✓ 找到 ${tagsWithCalendar.length} 个有日历映射的标签:`);
  tagsWithCalendar.forEach((tag, index) => {
    console.log(`  ${index + 1}. ${tag.name} → ${tag.calendarMapping.calendarName}`);
  });
  console.log('');

  if (tagsWithCalendar.length === 0) {
    console.log('❌ 没有找到任何有日历映射的标签！');
    console.log('请先在应用中为标签配置日历映射。');
    return;
  }

  // 3. 使用第一个有映射的标签（通常是 "工作"）
  const selectedTag = tagsWithCalendar[0];
  const selectedCalendar = selectedTag.calendarMapping;

  console.log('将使用以下标签和日历:');
  console.log(`  📌 标签: ${selectedTag.name} (id: ${selectedTag.id})`);
  console.log(`  📅 日历: ${selectedCalendar.calendarName}`);
  console.log(`  🔑 日历 ID: ${selectedCalendar.calendarId.substring(0, 40)}...`);
  console.log('');

  console.log('⏳ 3 秒后执行修复...');
  await new Promise(resolve => setTimeout(resolve, 3000));

  // 4. 修复事件
  console.log('');
  console.log('🔧 修复事件...');
  
  const eventIndex = events.findIndex(e => e.id === problemEvent.id);
  if (eventIndex === -1) {
    console.log('❌ 找不到事件索引');
    return;
  }

  // 清空旧标签，设置新标签和日历
  events[eventIndex].tagId = selectedTag.id;
  events[eventIndex].tags = [selectedTag.id];
  events[eventIndex].calendarId = selectedCalendar.calendarId;

  console.log(`✓ 已设置 tagId: ${selectedTag.id}`);
  console.log(`✓ 已设置 tags: [${selectedTag.id}]`);
  console.log(`✓ 已设置 calendarId: ${selectedCalendar.calendarId.substring(0, 40)}...`);

  // 5. 保存事件
  localStorage.setItem('remarkable-events', JSON.stringify(events));
  console.log('✓ 已保存到 localStorage');
  console.log('');

  // 6. 更新或创建同步 action
  const queue = JSON.parse(localStorage.getItem('remarkable-sync-actions') || '[]');
  let actionIndex = queue.findIndex(a => a.entityId === problemEvent.id);

  if (actionIndex !== -1) {
    // 更新现有 action
    queue[actionIndex].data = events[eventIndex];
    console.log('✓ 已更新同步队列中的现有 action');
  } else {
    // 创建新 action
    const newAction = {
      id: `quick-fix-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: 'create',
      entityType: 'event',
      entityId: events[eventIndex].id,
      timestamp: new Date().toISOString(),
      source: 'local',
      data: events[eventIndex],
      synchronized: false,
      retryCount: 0
    };
    queue.push(newAction);
    console.log('✓ 已创建新的同步 action');
  }

  localStorage.setItem('remarkable-sync-actions', JSON.stringify(queue));
  console.log('✓ 已保存同步队列');
  console.log('');

  // 7. 触发同步
  console.log('🔄 触发同步...');
  if (window.syncManager) {
    window.syncManager.loadActionQueue?.();
    console.log('✓ 已重新加载队列');
    
    window.syncManager.performSync?.();
    console.log('✓ 已触发同步');
  }

  // 8. 完成
  console.log('');
  console.log('='.repeat(80));
  console.log('✅ 修复完成');
  console.log('='.repeat(80));
  console.log('');
  console.log('修复摘要:');
  console.log(`  事件: ${problemEvent.title}`);
  console.log(`  新标签: ${selectedTag.name}`);
  console.log(`  目标日历: ${selectedCalendar.calendarName}`);
  console.log('');
  console.log('请等待 20-30 秒，然后运行以下命令验证:');
  console.log('');
  console.log('const evt = JSON.parse(localStorage.getItem("remarkable-events"))');
  console.log('  .find(e => e.title.includes("ReMarkable开发"));');
  console.log('console.table({');
  console.log('  title: evt.title,');
  console.log('  tag: evt.tagId,');
  console.log('  hasCalendarId: !!evt.calendarId,');
  console.log('  syncStatus: evt.syncStatus,');
  console.log('  synced: !!evt.externalId');
  console.log('});');
  console.log('');

  return {
    event: problemEvent.title,
    newTag: selectedTag.name,
    targetCalendar: selectedCalendar.calendarName
  };
})();
