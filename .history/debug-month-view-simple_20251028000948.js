// 快速诊断月视图问题
console.log('=== 月视图快速诊断 ===');

// 1. 检查视图状态
const settings = JSON.parse(localStorage.getItem('remarkable-calendar-settings') || '{}');
console.log('当前视图:', settings.view);

// 2. 检查 TUI Calendar 实例
const container = document.querySelector('.time-calendar-container');
const tuiCalendar = container?.querySelector('div');
console.log('TUI Calendar 容器:', container);
console.log('TUI Calendar 子元素:', tuiCalendar);

// 3. 查找月视图元素
const monthView = document.querySelector('.toastui-calendar-month');
const weekView = document.querySelector('.toastui-calendar-week-view');
const dayView = document.querySelector('.toastui-calendar-day-view');

console.log('月视图元素:', monthView);
console.log('周视图元素:', weekView);
console.log('日视图元素:', dayView);

// 4. 如果有月视图，检查其高度
if (monthView) {
  const rect = monthView.getBoundingClientRect();
  console.log('月视图尺寸:', rect.width, 'x', rect.height);
  
  const daygrid = monthView.querySelector('.toastui-calendar-month-daygrid');
  if (daygrid) {
    const gridRect = daygrid.getBoundingClientRect();
    console.log('Daygrid 尺寸:', gridRect.width, 'x', gridRect.height);
  }
}

// 5. 检查容器层级高度
const checkHeight = (selector) => {
  const el = document.querySelector(selector);
  if (el) {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    console.log(`${selector}:`, {
      高度: rect.height + 'px',
      CSS高度: styles.height,
      display: styles.display,
      overflow: styles.overflow
    });
  }
};

checkHeight('.app-main');
checkHeight('.page-container.time-calendar');
checkHeight('.page-content');
checkHeight('.time-calendar-container');

console.log('=== 诊断完成 ===');
