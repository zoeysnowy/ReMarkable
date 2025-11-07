/**
 * 清理 localStorage 中所有 title 为 "(无标题)" 的空白事件
 * 
 * 使用方法：
 * 1. 在浏览器打开应用
 * 2. 打开控制台（F12）
 * 3. 复制此脚本内容粘贴到控制台执行
 */

(function cleanupUntitledEvents() {
  console.log('🧹 [清理脚本] 开始清理 "(无标题)" 事件...');
  
  // 读取所有事件
  const eventsJson = localStorage.getItem('events');
  if (!eventsJson) {
    console.log('⚠️ [清理脚本] 未找到 events 数据');
    return;
  }
  
  let events = JSON.parse(eventsJson);
  const totalBefore = events.length;
  console.log(`📊 [清理脚本] 当前事件总数: ${totalBefore}`);
  
  // 统计要删除的事件
  const toDelete = events.filter(e => {
    const isUntitled = e.title === '(无标题)' || e.content === '(无标题)';
    const hasNoDescription = !e.description || e.description.trim() === '';
    const hasNoTime = !e.startTime && !e.endTime && !e.dueDate;
    
    return isUntitled && hasNoDescription && hasNoTime;
  });
  
  console.log(`🔍 [清理脚本] 找到 ${toDelete.length} 个空白 "(无标题)" 事件:`);
  toDelete.forEach(e => {
    console.log(`  - ${e.id}: title="${e.title}", startTime=${e.startTime || 'none'}`);
  });
  
  // 确认删除
  if (toDelete.length === 0) {
    console.log('✅ [清理脚本] 没有需要清理的事件');
    return;
  }
  
  const confirmed = confirm(
    `确认删除 ${toDelete.length} 个空白事件吗？\n\n` +
    `这些事件的标题都是 "(无标题)"，且没有描述和时间。\n\n` +
    `点击 "确定" 继续，"取消" 放弃。`
  );
  
  if (!confirmed) {
    console.log('❌ [清理脚本] 用户取消操作');
    return;
  }
  
  // 执行删除
  const idsToDelete = new Set(toDelete.map(e => e.id));
  events = events.filter(e => !idsToDelete.has(e.id));
  
  // 保存回 localStorage
  localStorage.setItem('events', JSON.stringify(events));
  
  const totalAfter = events.length;
  console.log(`✅ [清理脚本] 删除完成！`);
  console.log(`📊 [清理脚本] 删除前: ${totalBefore} 个事件`);
  console.log(`📊 [清理脚本] 删除后: ${totalAfter} 个事件`);
  console.log(`🗑️ [清理脚本] 共删除: ${totalBefore - totalAfter} 个事件`);
  console.log('');
  console.log('💡 请刷新页面查看效果');
  
  // 触发事件更新（如果应用在监听）
  window.dispatchEvent(new Event('storage'));
  
})();
