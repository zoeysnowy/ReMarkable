// 详细检查周视图的 DOM 结构
console.log('=== 详细 DOM 结构检查 ===');

const weekView = document.querySelector('.toastui-calendar-week-view');
const dayView = document.querySelector('.toastui-calendar-day-view');
const currentView = weekView || dayView;

if (currentView) {
  const viewType = weekView ? '周视图' : '日视图';
  console.log(`\n当前视图: ${viewType}`);
  
  // 递归打印 DOM 结构
  function printDOMTree(element, indent = '', maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth || !element) return;
    
    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);
    const className = element.className || element.tagName;
    
    console.log(`${indent}${className}`, {
      高度: rect.height.toFixed(1) + 'px',
      overflow: styles.overflow !== 'visible' ? styles.overflow : undefined,
      overflowY: styles.overflowY !== 'visible' ? styles.overflowY : undefined,
      display: styles.display,
      flex: styles.flex !== '0 1 auto' ? styles.flex : undefined
    });
    
    // 只打印主要子元素
    Array.from(element.children).slice(0, 5).forEach(child => {
      printDOMTree(child, indent + '  ', maxDepth, currentDepth + 1);
    });
    
    if (element.children.length > 5) {
      console.log(`${indent}  ... 还有 ${element.children.length - 5} 个子元素`);
    }
  }
  
  console.log('\n完整 DOM 树:');
  printDOMTree(currentView);
  
  // 查找所有可能的滚动区域
  console.log('\n\n=== 查找所有包含 "layout" 的类名 ===');
  const allElements = currentView.querySelectorAll('*');
  const layoutElements = Array.from(allElements).filter(el => 
    el.className && typeof el.className === 'string' && el.className.includes('layout')
  );
  
  layoutElements.forEach(el => {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    console.log(el.className, {
      高度: rect.height.toFixed(1) + 'px',
      scrollHeight: el.scrollHeight + 'px',
      可滚动: el.scrollHeight > rect.height,
      overflow: styles.overflow,
      overflowY: styles.overflowY
    });
  });
  
  // 查找所有可能滚动的元素（scrollHeight > height）
  console.log('\n\n=== 可能可滚动的元素（scrollHeight > height）===');
  Array.from(allElements).forEach(el => {
    const rect = el.getBoundingClientRect();
    if (el.scrollHeight > rect.height + 1) {
      const styles = window.getComputedStyle(el);
      console.log(el.className || el.tagName, {
        高度: rect.height.toFixed(1) + 'px',
        scrollHeight: el.scrollHeight + 'px',
        差值: (el.scrollHeight - rect.height).toFixed(1) + 'px',
        overflow: styles.overflow,
        overflowY: styles.overflowY,
        当前可以滚动: styles.overflowY === 'auto' || styles.overflowY === 'scroll'
      });
    }
  });
  
} else {
  console.log('❌ 未找到周视图或日视图');
}
