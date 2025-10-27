// 检查周标题行高度
console.log('=== 检查月视图周标题 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (monthView) {
  // 查找周标题行（日一二三四五六）
  const dayNames = monthView.querySelector('.toastui-calendar-day-names');
  if (dayNames) {
    const rect = dayNames.getBoundingClientRect();
    const styles = window.getComputedStyle(dayNames);
    console.log('周标题行:', {
      高度: rect.height.toFixed(1) + 'px',
      display: styles.display,
      flexShrink: styles.flexShrink,
      position: styles.position,
      zIndex: styles.zIndex
    });
  } else {
    console.log('❌ 未找到 .toastui-calendar-day-names');
  }
  
  // 查找日期网格
  const daygrid = monthView.querySelector('.toastui-calendar-month-daygrid');
  if (daygrid) {
    const rect = daygrid.getBoundingClientRect();
    const styles = window.getComputedStyle(daygrid);
    console.log('\n日期网格:', {
      高度: rect.height.toFixed(1) + 'px',
      flex: styles.flex,
      display: styles.display,
      marginTop: styles.marginTop
    });
  }
  
  // 查看整体结构
  console.log('\n月视图容器子元素:');
  Array.from(monthView.children).forEach((child, i) => {
    const rect = child.getBoundingClientRect();
    console.log(`  ${i+1}. ${child.className}`, {
      高度: rect.height.toFixed(1) + 'px'
    });
  });
}
