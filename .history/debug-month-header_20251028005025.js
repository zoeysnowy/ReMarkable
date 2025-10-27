// 检查月视图周标题显示问题
console.log('=== 检查月视图周标题 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (monthView) {
  // 查找周标题容器
  const dayNames = monthView.querySelector('.toastui-calendar-day-names');
  if (dayNames) {
    const rect = dayNames.getBoundingClientRect();
    const styles = window.getComputedStyle(dayNames);
    console.log('\n周标题容器 (.toastui-calendar-day-names):', {
      高度: rect.height.toFixed(1) + 'px',
      可见: rect.height > 0,
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      overflow: styles.overflow,
      position: styles.position,
      zIndex: styles.zIndex
    });
    
    // 查找容器
    const container = dayNames.querySelector('.toastui-calendar-day-name-container');
    if (container) {
      const containerRect = container.getBoundingClientRect();
      const containerStyles = window.getComputedStyle(container);
      console.log('\n日期容器 (.toastui-calendar-day-name-container):', {
        高度: containerRect.height.toFixed(1) + 'px',
        display: containerStyles.display,
        position: containerStyles.position
      });
      
      // 查找所有周标题项
      const items = container.querySelectorAll('.toastui-calendar-day-name-item');
      console.log(`\n找到 ${items.length} 个周标题项`);
      
      items.forEach((item, i) => {
        const itemRect = item.getBoundingClientRect();
        const itemStyles = window.getComputedStyle(item);
        console.log(`  ${i + 1}. ${item.textContent}:`, {
          高度: itemRect.height.toFixed(1) + 'px',
          宽度: itemRect.width.toFixed(1) + 'px',
          left: itemStyles.left,
          position: itemStyles.position,
          display: itemStyles.display,
          visibility: itemStyles.visibility
        });
      });
    } else {
      console.log('❌ 未找到 .toastui-calendar-day-name-container');
    }
  } else {
    console.log('❌ 未找到 .toastui-calendar-day-names');
  }
} else {
  console.log('❌ 未找到月视图，请切换到月视图');
}
