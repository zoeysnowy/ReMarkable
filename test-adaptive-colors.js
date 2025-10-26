/**
 * 颜色自适应诊断脚本
 * 检查 Widget 中的颜色是否正确自适应
 */

(function() {
  console.log('🎨 开始诊断颜色自适应...\n');

  // 1. 检查背景色
  const container = document.querySelector('.toastui-calendar');
  if (container) {
    const bgColor = window.getComputedStyle(container).backgroundColor;
    console.log('✅ 找到日历容器');
    console.log('   - 背景色:', bgColor);
    
    // 解析 RGB
    const match = bgColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const r = parseInt(match[1]);
      const g = parseInt(match[2]);
      const b = parseInt(match[3]);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
      const isDark = luminance < 128;
      
      console.log(`   - 亮度: ${luminance.toFixed(2)} (${isDark ? '深色' : '浅色'})`);
    }
  } else {
    console.log('❌ 未找到日历容器');
  }

  // 2. 检查网格线颜色
  const dayGrid = document.querySelector('.toastui-calendar-week-view-day-names');
  if (dayGrid) {
    const borderBottom = window.getComputedStyle(dayGrid).borderBottomColor;
    console.log('\n✅ 找到星期导航条');
    console.log('   - 边框颜色:', borderBottom);
    console.log('   - 背景色:', window.getComputedStyle(dayGrid).backgroundColor);
  }

  // 3. 检查时间网格
  const timeGrid = document.querySelectorAll('.toastui-calendar-panel');
  console.log(`\n📦 找到 ${timeGrid.length} 个日历面板`);
  if (timeGrid.length > 0) {
    const panel = timeGrid[0];
    console.log('   - 背景色:', window.getComputedStyle(panel).backgroundColor);
    
    // 检查内部的边框
    const gridLines = panel.querySelectorAll('.toastui-calendar-week-view-day-names');
    if (gridLines.length > 0) {
      console.log('   - 内部网格线颜色:', window.getComputedStyle(gridLines[0]).borderBottomColor);
    }
  }

  // 4. 检查左侧时间栏
  const timeLabels = document.querySelectorAll('.toastui-calendar-timegrid-left');
  console.log(`\n⏰ 找到 ${timeLabels.length} 个时间标签区域`);
  if (timeLabels.length > 0) {
    console.log('   - 背景色:', window.getComputedStyle(timeLabels[0]).backgroundColor);
    console.log('   - 文字颜色:', window.getComputedStyle(timeLabels[0]).color);
  }

  // 5. 检查事件元素
  const events = document.querySelectorAll('.toastui-calendar-event');
  console.log(`\n📅 找到 ${events.length} 个事件元素`);
  if (events.length > 0) {
    const event = events[0];
    console.log('   - 第一个事件背景色:', window.getComputedStyle(event).backgroundColor);
    console.log('   - 第一个事件文字颜色:', window.getComputedStyle(event).color);
  }

  // 6. 建议
  console.log('\n💡 验证清单:');
  console.log('   □ 网格线颜色是否与背景色协调？');
  console.log('   □ 星期导航条背景是否有轻微对比度？');
  console.log('   □ 时间标签区域是否可读？');
  console.log('   □ 事件标签颜色是否与背景匹配？');

  console.log('\n✨ 诊断完成！');
})();
