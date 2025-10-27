// 更详细的诊断
console.log('=== 详细诊断周标题 ===');

const items = document.querySelectorAll('.toastui-calendar-day-name-item.toastui-calendar-month');
console.log(`找到 ${items.length} 个周标题项\n`);

items.forEach((item, i) => {
  const computed = window.getComputedStyle(item);
  const rect = item.getBoundingClientRect();
  
  console.log(`${i + 1}. ${item.textContent}:`);
  console.log('  内联样式:', item.getAttribute('style'));
  console.log('  计算样式:', {
    display: computed.display,
    position: computed.position,
    width: computed.width,
    left: computed.left,
    flexShrink: computed.flexShrink,
    flexGrow: computed.flexGrow,
    boxSizing: computed.boxSizing
  });
  console.log('  实际位置:', {
    x: rect.x.toFixed(1),
    width: rect.width.toFixed(1)
  });
  console.log('');
});
