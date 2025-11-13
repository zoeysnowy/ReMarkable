/**
 * 模糊时间显示诊断脚本
 * 
 * 用于验证 v2.7.2 修复：快捷按钮设置 isFuzzyTime 和 fuzzyTimeName
 * 
 * 使用方法：
 * 1. 打开浏览器控制台（F12）
 * 2. 复制粘贴本文件全部内容
 * 3. 按回车执行
 * 4. 点击快捷按钮"下午"
 * 5. 运行: window.diagnoseFuzzyTime()
 */

console.log('%c═══════════════════════════════════════════', 'color: #2196F3; font-weight: bold');
console.log('%c🔍 模糊时间诊断工具已加载', 'color: #2196F3; font-size: 16px; font-weight: bold');
console.log('%c═══════════════════════════════════════════', 'color: #2196F3; font-weight: bold');
console.log('');
console.log('📋 可用命令:');
console.log('  window.diagnoseFuzzyTime()  - 诊断当前选中 Event 的模糊时间状态');
console.log('  window.checkTimeHub()       - 检查 TimeHub 中的 isFuzzyTime 字段');
console.log('');

/**
 * 诊断当前选中 Event 的模糊时间状态
 */
window.diagnoseFuzzyTime = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  console.log('%c📊 模糊时间状态诊断', 'color: #4CAF50; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #4CAF50; font-weight: bold');
  
  // 1. 检查选中的 Event
  const selectedEvents = document.querySelectorAll('.event-item.selected, .plan-item.selected');
  
  if (selectedEvents.length === 0) {
    console.warn('⚠️ 未找到选中的 Event');
    console.log('💡 请在 PlanManager 中点击一个 Event');
    return null;
  }
  
  console.log(`\n✅ 找到 ${selectedEvents.length} 个选中的 Event\n`);
  
  selectedEvents.forEach((eventEl, index) => {
    console.log(`\n${'─'.repeat(50)}`);
    console.log(`📌 Event #${index + 1}`);
    console.log(`${'─'.repeat(50)}\n`);
    
    // 获取 Event ID
    const eventId = eventEl.getAttribute('data-event-id') || 
                    eventEl.getAttribute('data-item-id') ||
                    eventEl.id;
    console.log('Event ID:', eventId || '未知');
    
    // 查找时间显示元素
    const timeDisplay = eventEl.querySelector('[style*="color"]') || 
                       eventEl.querySelector('.time-display');
    
    if (timeDisplay) {
      console.log('\n📅 时间显示:');
      console.log('  文本内容:', timeDisplay.textContent.trim());
      console.log('  HTML:', timeDisplay.outerHTML.substring(0, 200) + '...');
      
      // 检查是否包含时间范围
      const hasTimeRange = /\d{2}:\d{2}/.test(timeDisplay.textContent);
      if (hasTimeRange) {
        console.warn('  ⚠️ 显示了具体时间范围（可能不是模糊时间段）');
      } else {
        console.log('  ✅ 未显示具体时间范围（可能是模糊时间段）');
      }
    } else {
      console.log('\n⚠️ 未找到时间显示元素');
    }
    
    // 从 DOM 中查找可能的时间数据
    console.log('\n🔍 检查 DOM 数据属性:');
    const dataAttrs = Array.from(eventEl.attributes)
      .filter(attr => attr.name.startsWith('data-'))
      .map(attr => `  ${attr.name}: ${attr.value}`);
    
    if (dataAttrs.length > 0) {
      console.log(dataAttrs.join('\n'));
    } else {
      console.log('  (无 data-* 属性)');
    }
  });
  
  console.log(`\n${'═'.repeat(50)}\n`);
  
  // 2. 检查 TimeHub 状态
  console.log('💡 提示: 运行 window.checkTimeHub() 查看 TimeHub 中的完整数据');
  
  return {
    selectedCount: selectedEvents.length
  };
};

/**
 * 检查 TimeHub 中的 isFuzzyTime 字段
 */
window.checkTimeHub = function() {
  console.log('%c═══════════════════════════════════════════', 'color: #9C27B0; font-weight: bold');
  console.log('%c🗄️  TimeHub 数据检查', 'color: #9C27B0; font-size: 16px; font-weight: bold');
  console.log('%c═══════════════════════════════════════════', 'color: #9C27B0; font-weight: bold');
  
  // 尝试从全局变量访问 TimeHub
  // 注意: 这需要在开发环境中暴露 TimeHub 实例
  
  console.log('\n⚠️ TimeHub 是一个服务类，无法从控制台直接访问');
  console.log('\n建议方法:');
  console.log('  1. 在 UnifiedDateTimePicker 的 handleApply 中添加 console.log');
  console.log('  2. 查看写入 TimeHub 的数据');
  console.log('  3. 查找类似这样的日志:');
  console.log('     📝 准备写入 TimeHub {');
  console.log('       isFuzzyTime: true,');
  console.log('       fuzzyTimeName: "下午",');
  console.log('       ...');
  console.log('     }');
  console.log('\n💡 打开控制台，点击快捷按钮"下午"，查找 "📝 准备写入 TimeHub" 日志');
};

// 自动诊断提示
console.log('');
console.log('%c💡 快速开始:', 'color: #4CAF50; font-weight: bold');
console.log('  1. 在 PlanManager 中选择一个 Event（点击它）');
console.log('  2. 运行: window.diagnoseFuzzyTime()');
console.log('  3. 或者点击快捷按钮后查看控制台的 "📝 准备写入 TimeHub" 日志');
console.log('');
console.log('%c🎯 预期结果（v2.7.2 修复后）:', 'color: #FF9800; font-weight: bold');
console.log('  ✅ 点击快捷按钮"下午" → fuzzyTimeName="下午", isFuzzyTime=true');
console.log('  ✅ PlanManager 显示 → "周五下午"（不显示 12:00-18:00）');
console.log('  ✅ 手动调整时间选择器 → fuzzyTimeName=null, isFuzzyTime=false');
console.log('  ✅ PlanManager 显示 → "周五 14:30 --> 16:00"');
console.log('');
