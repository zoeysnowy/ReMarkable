// 🔍 诊断和修复事件重复问题
console.log('=== 🔍 诊断事件重复 ===\n');

// 1. 读取localStorage中的事件
const eventsRaw = localStorage.getItem('remarkable-events');
const events = eventsRaw ? JSON.parse(eventsRaw) : [];
console.log(`📊 localStorage中的事件总数: ${events.length}`);

// 2. 检查重复ID
const idCount = {};
events.forEach(event => {
  idCount[event.id] = (idCount[event.id] || 0) + 1;
});

const duplicates = Object.entries(idCount).filter(([id, count]) => count > 1);
console.log(`\n⚠️ 重复的事件ID (${duplicates.length}个):`);
duplicates.slice(0, 10).forEach(([id, count]) => {
  const event = events.find(e => e.id === id);
  console.log(`- ${id.substring(0, 50)}... (${count}次): ${event?.title}`);
});

if (duplicates.length > 10) {
  console.log(`... 还有 ${duplicates.length - 10} 个重复ID`);
}

// 3. 去重修复
const uniqueEvents = [];
const seenIds = new Set();
events.forEach(event => {
  if (!seenIds.has(event.id)) {
    seenIds.add(event.id);
    uniqueEvents.push(event);
  }
});

console.log(`\n✅ 去重后的事件数: ${uniqueEvents.length}`);
console.log(`❌ 移除的重复事件: ${events.length - uniqueEvents.length}`);

// 4. 保存去重后的数据（可选）
if (duplicates.length > 0) {
  console.log('\n💾 要修复localStorage中的重复数据吗？');
  console.log('运行以下命令修复:');
  console.log(`localStorage.setItem('remarkable-events', JSON.stringify(${JSON.stringify(uniqueEvents).substring(0, 50)}...))`);
  console.log('\n或者直接运行: window.fixDuplicates()');
  
  window.fixDuplicates = () => {
    localStorage.setItem('remarkable-events', JSON.stringify(uniqueEvents));
    console.log(`✅ 已修复！从 ${events.length} 个事件去重到 ${uniqueEvents.length} 个`);
    console.log('请刷新页面查看效果');
  };
}

console.log('\n=== 诊断完成 ===');


