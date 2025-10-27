// 打印完整的月视图 HTML 结构
console.log('=== 月视图完整结构 ===');

const monthView = document.querySelector('.toastui-calendar-month');
if (monthView) {
  console.log('月视图 HTML:');
  console.log(monthView.outerHTML);
  
  console.log('\n直接子元素:');
  Array.from(monthView.children).forEach((child, i) => {
    console.log(`${i}. ${child.className}`);
  });
  
  const daygrid = monthView.querySelector('.toastui-calendar-month-daygrid');
  if (daygrid) {
    console.log('\nDaygrid 子元素:');
    Array.from(daygrid.children).forEach((child, i) => {
      console.log(`${i}. ${child.className}`);
    });
    
    const layout = daygrid.querySelector('.toastui-calendar-month-daygrid-layout');
    if (layout) {
      console.log('\nDaygrid Layout 子元素:');
      Array.from(layout.children).forEach((child, i) => {
        const rect = child.getBoundingClientRect();
        console.log(`${i}. ${child.className} - 高度: ${rect.height.toFixed(1)}px`);
      });
    }
  }
}
