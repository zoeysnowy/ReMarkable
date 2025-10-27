// 检查月视图事件
console.log('=== 检查月视图事件 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (monthView) {
  // 查找所有事件元素
  const events = monthView.querySelectorAll('.toastui-calendar-weekday-event, .toastui-calendar-event');
  console.log(`找到 ${events.length} 个事件元素`);
  
  if (events.length > 0) {
    console.log('前3个事件:');
    Array.from(events).slice(0, 3).forEach((event, i) => {
      const rect = event.getBoundingClientRect();
      const styles = window.getComputedStyle(event);
      console.log(`${i+1}.`, {
        文本: event.textContent.substring(0, 30),
        高度: rect.height.toFixed(1) + 'px',
        display: styles.display,
        visibility: styles.visibility,
        opacity: styles.opacity
      });
    });
  }
  
  // 检查 "X more" 按钮
  const moreButtons = monthView.querySelectorAll('.toastui-calendar-grid-cell-more-events');
  console.log(`\n找到 ${moreButtons.length} 个 "more" 按钮`);
  
  // 检查一个日期格子的高度
  const cells = monthView.querySelectorAll('.toastui-calendar-daygrid-cell');
  if (cells.length > 0) {
    const cell = cells[0];
    const rect = cell.getBoundingClientRect();
    console.log('\n第一个日期格子:', {
      高度: rect.height.toFixed(1) + 'px',
      宽度: rect.width.toFixed(1) + 'px'
    });
  }
  
  // 检查周行高度
  const weekItems = monthView.querySelectorAll('.toastui-calendar-month-week-item');
  console.log('\n周行高度:');
  weekItems.forEach((item, i) => {
    const rect = item.getBoundingClientRect();
    console.log(`  第 ${i+1} 周: ${rect.height.toFixed(1)}px`);
  });
}
