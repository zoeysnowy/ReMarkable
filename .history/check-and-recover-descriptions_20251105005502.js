/**
 * 检查并尝试恢复 description
 * 1. 检查 localStorage 原始数据
 * 2. 如果描述丢失，尝试从浏览器历史/备份恢复
 */

const STORAGE_KEY = 'remarkable-events';

// 🔍 Step 1: 检查 localStorage 原始数据
console.log('=== 步骤 1: 读取 localStorage 原始数据 ===');
const rawData = localStorage.getItem(STORAGE_KEY);
if (!rawData) {
  console.error('❌ localStorage 中没有 remarkable-events 数据！');
  console.log('提示：数据可能已完全丢失，请检查浏览器历史记录或备份');
} else {
  console.log(`✅ 找到 localStorage 数据，大小: ${(rawData.length / 1024).toFixed(2)} KB`);
  
  const events = JSON.parse(rawData);
  console.log(`📊 总事件数: ${events.length}`);
  
  // 🎯 检查目标事件
  const targetIds = [
    'local-1761204179008',
    'local-1761286443997', 
    'local-1761808870380'
  ];
  
  console.log('\n=== 步骤 2: 检查目标事件的 description ===');
  targetIds.forEach(id => {
    const evt = events.find(e => e.id === id);
    if (!evt) {
      console.log(`\n❌ Event ${id}: 不存在`);
      return;
    }
    
    console.log(`\n📝 Event ${id}:`);
    console.log(`  Title: ${evt.title || '(无标题)'}`);
    console.log(`  Description 存在: ${evt.description ? '✅ 是' : '❌ 否'}`);
    if (evt.description) {
      console.log(`  Description 长度: ${evt.description.length} 字符`);
      console.log(`  Description 预览: ${evt.description.substring(0, 100)}${evt.description.length > 100 ? '...' : ''}`);
    } else {
      console.log(`  ⚠️ Description 字段为: ${JSON.stringify(evt.description)}`);
    }
    console.log(`  Content 存在: ${evt.content ? '✅ 是' : '❌ 否'}`);
    if (evt.content) {
      console.log(`  Content 长度: ${evt.content.length} 字符`);
      console.log(`  Content 预览: ${evt.content.substring(0, 100)}${evt.content.length > 100 ? '...' : ''}`);
    }
    console.log(`  Notes 存在: ${evt.notes ? '✅ 是' : '❌ 否'}`);
    if (evt.notes) {
      console.log(`  Notes 长度: ${evt.notes.length} 字符`);
      console.log(`  Notes 预览: ${evt.notes.substring(0, 100)}${evt.notes.length > 100 ? '...' : ''}`);
    }
  });
  
  // 🔍 Step 3: 检查所有事件的 description 丢失情况
  console.log('\n=== 步骤 3: 统计所有事件 description 状态 ===');
  const stats = {
    total: events.length,
    hasDescription: 0,
    emptyDescription: 0,
    nullDescription: 0,
    undefinedDescription: 0,
    hasContent: 0,
    hasNotes: 0
  };
  
  events.forEach(evt => {
    if (evt.description && evt.description.length > 0) {
      stats.hasDescription++;
    } else if (evt.description === '') {
      stats.emptyDescription++;
    } else if (evt.description === null) {
      stats.nullDescription++;
    } else if (evt.description === undefined) {
      stats.undefinedDescription++;
    }
    
    if (evt.content && evt.content.length > 0) stats.hasContent++;
    if (evt.notes && evt.notes.length > 0) stats.hasNotes++;
  });
  
  console.log(`总事件数: ${stats.total}`);
  console.log(`有 description: ${stats.hasDescription} (${(stats.hasDescription / stats.total * 100).toFixed(1)}%)`);
  console.log(`description 为空字符串: ${stats.emptyDescription}`);
  console.log(`description 为 null: ${stats.nullDescription}`);
  console.log(`description 为 undefined: ${stats.undefinedDescription}`);
  console.log(`有 content: ${stats.hasContent}`);
  console.log(`有 notes: ${stats.hasNotes}`);
}

// 🛠️ Step 4: 恢复建议
console.log('\n=== 步骤 4: 恢复建议 ===');
console.log('如果 description 已从 localStorage 丢失：');
console.log('1. 检查浏览器 Application → Storage → Local Storage → 是否有历史版本');
console.log('2. 打开 Chrome DevTools → Application → IndexedDB → 查找备份');
console.log('3. 检查 Outlook 日历（outlook.office.com）是否有同步记录');
console.log('4. 查看浏览器历史记录中的页面快照');
console.log('\n如果 description 仍在 localStorage：');
console.log('1. 刷新页面重新加载 EventService');
console.log('2. 运行 window.debugEventService.clearCache() 清除缓存');
console.log('3. 在控制台执行: EventService.getAllEvents().find(e => e.id === "local-1761808870380")');
