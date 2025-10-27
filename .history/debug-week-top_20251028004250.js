// 检查周视图顶部的灰色区域
console.log('=== 检查周视图顶部区域 ===');

const weekView = document.querySelector('.toastui-calendar-week-view');
if (weekView) {
  console.log('\n所有 panel 元素:');
  const panels = weekView.querySelectorAll('.toastui-calendar-panel');
  
  panels.forEach((panel, i) => {
    const rect = panel.getBoundingClientRect();
    const styles = window.getComputedStyle(panel);
    const classes = panel.className;
    
    console.log(`\nPanel ${i + 1}: ${classes}`);
    console.log({
      高度: rect.height.toFixed(1) + 'px',
      背景色: styles.backgroundColor,
      padding: styles.padding,
      margin: styles.margin,
      border: styles.border,
      位置: `top: ${rect.top.toFixed(1)}px`
    });
    
    // 检查是否是 task 或 allday 面板
    if (classes.includes('task') || classes.includes('allday')) {
      console.log('  📌 这是全天事件区域');
      
      // 查找子元素
      Array.from(panel.children).forEach((child, j) => {
        const childRect = child.getBoundingClientRect();
        const childStyles = window.getComputedStyle(child);
        console.log(`    子元素 ${j + 1}: ${child.className}`);
        console.log({
          高度: childRect.height.toFixed(1) + 'px',
          背景色: childStyles.backgroundColor
        });
      });
    }
  });
  
  // 查找所有背景是灰色的元素
  console.log('\n\n=== 灰色背景元素 ===');
  const allElements = weekView.querySelectorAll('*');
  Array.from(allElements).forEach(el => {
    const styles = window.getComputedStyle(el);
    const bg = styles.backgroundColor;
    
    // 检查是否是灰色系背景
    if (bg.includes('rgb') && !bg.includes('rgba(0, 0, 0, 0)') && !bg.includes('255, 255, 255')) {
      const rect = el.getBoundingClientRect();
      if (rect.height > 10) { // 只显示高度大于10px的
        console.log(el.className || el.tagName, {
          高度: rect.height.toFixed(1) + 'px',
          背景色: bg,
          位置: `top: ${rect.top.toFixed(1)}px`
        });
      }
    }
  });
  
} else {
  console.log('❌ 未找到周视图，请切换到周视图');
}
