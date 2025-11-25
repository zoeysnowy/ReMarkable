// 修复 localStorage 中所有 title 字段不完整的事件
// 在浏览器控制台运行此脚本

console.log('🔧 开始修复 localStorage 中的 EventTitle 数据...\n');

const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
let fixedCount = 0;
let alreadyOkCount = 0;

events.forEach(event => {
  if (!event.title) {
    console.warn(`⚠️ 事件 ${event.id} 没有 title 字段，跳过`);
    return;
  }
  
  const { simpleTitle, colorTitle, fullTitle } = event.title;
  
  // 检查是否需要修复
  const needsFix = simpleTitle && (!colorTitle || !fullTitle);
  
  if (needsFix) {
    // 生成缺失的字段
    event.title = {
      simpleTitle: simpleTitle,
      colorTitle: colorTitle || simpleTitle,
      fullTitle: fullTitle || JSON.stringify([
        { type: 'paragraph', children: [{ text: simpleTitle }] }
      ])
    };
    fixedCount++;
    console.log(`✅ 修复事件: ${event.id.substring(0, 20)}... - "${simpleTitle}"`);
  } else if (simpleTitle && colorTitle && fullTitle) {
    alreadyOkCount++;
  } else {
    console.warn(`⚠️ 事件 ${event.id} 的 title 字段全部为空，需要手动检查`);
  }
});

// 保存修复后的数据
localStorage.setItem('remarkable-events', JSON.stringify(events));

console.log(`\n📊 修复统计：`);
console.log(`  - 总事件数: ${events.length}`);
console.log(`  - 已修复: ${fixedCount}`);
console.log(`  - 已正常: ${alreadyOkCount}`);
console.log(`  - 需手动检查: ${events.length - fixedCount - alreadyOkCount}`);
console.log(`\n✅ 数据已保存到 localStorage，请刷新页面查看效果！`);
