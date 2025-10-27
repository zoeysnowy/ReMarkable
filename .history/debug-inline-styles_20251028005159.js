// 检查周标题项的内联样式
console.log('=== 检查内联样式 ===');

const items = document.querySelectorAll('.toastui-calendar-day-name-item.toastui-calendar-month');
console.log(`找到 ${items.length} 个周标题项\n`);

items.forEach((item, i) => {
  console.log(`${i + 1}. ${item.textContent}:`);
  console.log('  内联样式:', item.getAttribute('style'));
  
  const computed = window.getComputedStyle(item);
  console.log('  计算样式:', {
    width: computed.width,
    left: computed.left,
    position: computed.position,
    display: computed.display
  });
  console.log('');
});
