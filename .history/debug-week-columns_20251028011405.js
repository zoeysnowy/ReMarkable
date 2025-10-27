// 检查周视图日期标题的列数
console.log('=== 检查周视图日期标题 ===');

const weekDayNames = document.querySelector('.toastui-calendar-week-view .toastui-calendar-day-names');
const dayDayNames = document.querySelector('.toastui-calendar-day-view .toastui-calendar-day-names');

const container = weekDayNames || dayDayNames;
if (container) {
  const viewType = weekDayNames ? '周视图' : '日视图';
  console.log(`当前: ${viewType}`);
  
  const items = container.querySelectorAll('.toastui-calendar-day-name-item');
  console.log(`找到 ${items.length} 个日期标题项\n`);
  
  items.forEach((item, i) => {
    const rect = item.getBoundingClientRect();
    const styles = window.getComputedStyle(item);
    console.log(`${i + 1}. ${item.textContent}:`, {
      内联样式: item.getAttribute('style'),
      宽度: rect.width.toFixed(1) + 'px',
      left: rect.left.toFixed(1) + 'px',
      position: styles.position
    });
  });
  
  const containerRect = container.getBoundingClientRect();
  console.log('\n容器总宽度:', containerRect.width.toFixed(1) + 'px');
  console.log('每列应该宽度:', (containerRect.width / items.length).toFixed(1) + 'px');
} else {
  console.log('❌ 未找到周视图或日视图');
}
