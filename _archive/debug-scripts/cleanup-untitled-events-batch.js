/**
 * 批量清理所有 "(无标题)" 的空事件
 * 
 * 使用方法：
 * 1. 在浏览器控制台中运行此脚本
 * 2. 或者将内容复制到浏览器控制台执行
 */

(function cleanupUntitledEvents() {
  console.log('🧹 开始批量清理 "(无标题)" 事件...');
  
  // 读取 localStorage
  const eventsStr = localStorage.getItem('events');
  if (!eventsStr) {
    console.log('❌ 没有找到 events 数据');
    return;
  }
  
  let events = JSON.parse(eventsStr);
  console.log(`📊 当前总事件数: ${events.length}`);
  
  // 统计 "(无标题)" 事件
  const untitledEvents = events.filter(e => {
    const isUntitled = e.title === '(无标题)';
    const isEmpty = !e.description?.trim() && !e.content?.trim() && !e.startTime && !e.endTime && !e.dueDate;
    return isUntitled && isEmpty;
  });
  
  console.log(`🔍 找到 ${untitledEvents.length} 个空白 "(无标题)" 事件:`);
  untitledEvents.forEach(e => {
    console.log(`  - ${e.id} (创建于: ${e.createdAt || '未知'})`);
  });
  
  if (untitledEvents.length === 0) {
    console.log('✅ 没有需要清理的事件');
    return;
  }
  
  // 询问确认
  const confirmed = confirm(`确认删除 ${untitledEvents.length} 个空白 "(无标题)" 事件吗？`);
  
  if (!confirmed) {
    console.log('❌ 取消清理操作');
    return;
  }
  
  // 执行删除
  const untitledIds = new Set(untitledEvents.map(e => e.id));
  const cleanedEvents = events.filter(e => !untitledIds.has(e.id));
  
  // 保存回 localStorage
  localStorage.setItem('events', JSON.stringify(cleanedEvents));
  
  console.log(`✅ 清理完成！`);
  console.log(`   删除数量: ${untitledEvents.length}`);
  console.log(`   剩余数量: ${cleanedEvents.length}`);
  console.log('');
  console.log('🔄 请刷新页面以查看效果');
  
  // 触发 eventsUpdated 事件（如果页面正在监听）
  window.dispatchEvent(new CustomEvent('eventsUpdated', { 
    detail: { action: 'batch-delete', count: untitledEvents.length } 
  }));
  
  return {
    deleted: untitledEvents.length,
    remaining: cleanedEvents.length,
    deletedIds: Array.from(untitledIds)
  };
})();
