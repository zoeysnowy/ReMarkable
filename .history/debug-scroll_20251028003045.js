// 诊断周视图和日视图的滚动问题
console.log('=== 诊断滚动功能 ===');

// 查找周视图或日视图
const weekView = document.querySelector('.toastui-calendar-week-view');
const dayView = document.querySelector('.toastui-calendar-day-view');
const currentView = weekView || dayView;

if (currentView) {
  const viewType = weekView ? '周视图' : '日视图';
  console.log(`\n当前视图: ${viewType}`);
  
  // 1. 检查最外层容器
  const calendarContainer = document.querySelector('.toastui-calendar');
  if (calendarContainer) {
    const containerRect = calendarContainer.getBoundingClientRect();
    const containerStyles = window.getComputedStyle(calendarContainer);
    console.log('\n日历容器 (.toastui-calendar):', {
      高度: containerRect.height.toFixed(1) + 'px',
      overflow: containerStyles.overflow,
      overflowY: containerStyles.overflowY,
      position: containerStyles.position
    });
  }
  
  // 2. 检查 TimeCalendar 的外层 div
  const timeCalendarDiv = calendarContainer?.parentElement;
  if (timeCalendarDiv) {
    const rect = timeCalendarDiv.getBoundingClientRect();
    const styles = window.getComputedStyle(timeCalendarDiv);
    console.log('\nTimeCalendar 外层容器:', {
      高度: rect.height.toFixed(1) + 'px',
      overflow: styles.overflow,
      overflowY: styles.overflowY,
      borderRadius: styles.borderRadius
    });
  }
  
  // 3. 检查 vlayout-area (应该是可滚动区域)
  const vlayoutArea = currentView.querySelector('.toastui-calendar-vlayout-area');
  if (vlayoutArea) {
    const rect = vlayoutArea.getBoundingClientRect();
    const styles = window.getComputedStyle(vlayoutArea);
    console.log('\n可滚动区域 (.toastui-calendar-vlayout-area):', {
      高度: rect.height.toFixed(1) + 'px',
      scrollHeight: vlayoutArea.scrollHeight + 'px',
      可滚动: vlayoutArea.scrollHeight > rect.height,
      overflow: styles.overflow,
      overflowY: styles.overflowY,
      flex: styles.flex,
      minHeight: styles.minHeight
    });
    
    // 测试滚动
    console.log('\n当前滚动位置:', vlayoutArea.scrollTop);
    console.log('可滚动距离:', vlayoutArea.scrollHeight - rect.height);
  } else {
    console.log('❌ 未找到 .toastui-calendar-vlayout-area');
  }
  
  // 4. 检查 panel 容器
  const panel = currentView.querySelector('.toastui-calendar-panel.toastui-calendar-time');
  if (panel) {
    const rect = panel.getBoundingClientRect();
    const styles = window.getComputedStyle(panel);
    console.log('\n面板容器 (.toastui-calendar-panel):', {
      高度: rect.height.toFixed(1) + 'px',
      display: styles.display,
      flexDirection: styles.flexDirection,
      overflow: styles.overflow
    });
  }
  
  // 5. 检查所有具有 overflow 样式的父元素
  console.log('\n=== 所有 overflow 设置 ===');
  let element = vlayoutArea;
  let level = 0;
  while (element && level < 10) {
    const styles = window.getComputedStyle(element);
    if (styles.overflow !== 'visible' || styles.overflowY !== 'visible') {
      console.log(`${level}. ${element.className || element.tagName}:`, {
        overflow: styles.overflow,
        overflowY: styles.overflowY,
        高度: element.getBoundingClientRect().height.toFixed(1) + 'px'
      });
    }
    element = element.parentElement;
    level++;
  }
  
} else {
  console.log('❌ 当前不在周视图或日视图');
  console.log('请切换到周视图或日视图后再运行此诊断');
}

console.log('\n=== 测试建议 ===');
console.log('1. 切换到周视图或日视图');
console.log('2. 尝试用鼠标滚轮滚动');
console.log('3. 检查 vlayoutArea 的 scrollHeight 是否大于其高度');
console.log('4. 如果 overflow-y 不是 auto/scroll，则无法滚动');
