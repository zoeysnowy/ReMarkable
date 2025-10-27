// 深度检查月视图 DOM 结构
console.log('=== 深度检查月视图结构 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (monthView) {
  console.log('月视图容器:', monthView);
  console.log('月视图 HTML 结构:');
  console.log(monthView.innerHTML.substring(0, 500));
  
  // 检查所有子元素
  console.log('\n子元素列表:');
  Array.from(monthView.children).forEach((child, i) => {
    const rect = child.getBoundingClientRect();
    const styles = window.getComputedStyle(child);
    console.log(`  ${i}. ${child.className}:`, {
      高度: rect.height.toFixed(1) + 'px',
      CSS高度: styles.height,
      display: styles.display,
      flex: styles.flex,
      minHeight: styles.minHeight
    });
  });
  
  // 检查 daygrid
  const daygrid = monthView.querySelector('.toastui-calendar-month-daygrid');
  if (daygrid) {
    console.log('\nDaygrid 详细信息:');
    const rect = daygrid.getBoundingClientRect();
    const styles = window.getComputedStyle(daygrid);
    console.log('  尺寸:', rect.width.toFixed(1), 'x', rect.height.toFixed(1));
    console.log('  CSS:', {
      height: styles.height,
      minHeight: styles.minHeight,
      maxHeight: styles.maxHeight,
      flex: styles.flex,
      display: styles.display,
      flexDirection: styles.flexDirection
    });
    
    // 检查 daygrid 的子元素
    console.log('\nDaygrid 子元素:');
    Array.from(daygrid.children).forEach((child, i) => {
      const childRect = child.getBoundingClientRect();
      const childStyles = window.getComputedStyle(child);
      console.log(`    ${i}. ${child.className}:`, {
        高度: childRect.height.toFixed(1) + 'px',
        CSS高度: childStyles.height,
        flex: childStyles.flex
      });
    });
  }
}

console.log('\n=== 检查完成 ===');
