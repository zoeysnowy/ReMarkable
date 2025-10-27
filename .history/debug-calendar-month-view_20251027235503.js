/**
 * 📊 TimeCalendar 月视图调试脚本
 * 
 * 使用方法：在浏览器控制台粘贴并运行
 */

console.log('🔍 开始诊断 TimeCalendar 月视图问题...\n');

// ==========================================
// 1. 检查当前视图状态
// ==========================================
console.log('📋 1. 检查 localStorage 中的视图设置:');
const calendarSettings = localStorage.getItem('remarkable-calendar-settings');
if (calendarSettings) {
  const settings = JSON.parse(calendarSettings);
  console.log('   视图模式:', settings.view);
  console.log('   完整设置:', settings);
} else {
  console.warn('   ⚠️ 未找到 calendar settings');
}
console.log('');

// ==========================================
// 2. 检查 DOM 结构和样式
// ==========================================
console.log('📋 2. 检查 DOM 元素高度:');

const appLayout = document.querySelector('.app-layout');
const appMain = document.querySelector('.app-main');
const pageContainer = document.querySelector('.page-container.time-calendar');
const pageContent = document.querySelector('.page-container.time-calendar .page-content');
const timeCalendarContainer = document.querySelector('.time-calendar-container');
const tuiCalendar = document.querySelector('.toastui-calendar');

const elements = {
  'app-layout': appLayout,
  'app-main': appMain,
  'page-container': pageContainer,
  'page-content': pageContent,
  'time-calendar-container': timeCalendarContainer,
  'toastui-calendar': tuiCalendar
};

Object.entries(elements).forEach(([name, el]) => {
  if (el) {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    console.log(`   ✓ .${name}:`);
    console.log(`     → 尺寸: ${rect.width.toFixed(0)}px × ${rect.height.toFixed(0)}px`);
    console.log(`     → display: ${styles.display}`);
    console.log(`     → height: ${styles.height}`);
    console.log(`     → flex: ${styles.flex}`);
    if (rect.height < 10) {
      console.error(`     ❌ 高度异常！只有 ${rect.height}px`);
    }
  } else {
    console.error(`   ✗ .${name} 未找到！`);
  }
});
console.log('');

// ==========================================
// 3. 检查 TUI Calendar 实例
// ==========================================
console.log('📋 3. 检查 TUI Calendar 实例:');
const calendarInstance = document.querySelector('.toastui-calendar');
if (calendarInstance && calendarInstance.__tuiCalendar) {
  console.log('   ✓ TUI Calendar 实例存在');
  const instance = calendarInstance.__tuiCalendar;
  try {
    const currentView = instance.getViewName();
    const dateRange = instance.getDateRangeStart();
    console.log('   当前视图:', currentView);
    console.log('   日期范围:', dateRange.toString());
  } catch (e) {
    console.error('   ❌ 无法获取实例信息:', e.message);
  }
} else {
  console.error('   ✗ TUI Calendar 实例未找到');
}
console.log('');

// ==========================================
// 4. 检查月视图特定元素
// ==========================================
console.log('📋 4. 检查月视图 DOM 元素:');
const monthElements = {
  'month容器': document.querySelector('.toastui-calendar-month'),
  'month-daygrid': document.querySelector('.toastui-calendar-month-daygrid'),
  'month-week': document.querySelector('.toastui-calendar-month-week'),
  'month-date': document.querySelector('.toastui-calendar-month-date')
};

Object.entries(monthElements).forEach(([name, el]) => {
  if (el) {
    const rect = el.getBoundingClientRect();
    const styles = window.getComputedStyle(el);
    console.log(`   ✓ ${name}:`);
    console.log(`     → 尺寸: ${rect.width.toFixed(0)}px × ${rect.height.toFixed(0)}px`);
    console.log(`     → display: ${styles.display}, visibility: ${styles.visibility}`);
    if (rect.height === 0) {
      console.error(`     ❌ 高度为 0！`);
    }
  } else {
    console.warn(`   ⚠️ ${name} 未找到 (可能不在月视图)`);
  }
});
console.log('');

// ==========================================
// 5. 检查可能的 CSS 覆盖问题
// ==========================================
console.log('📋 5. 检查关键 CSS 样式:');
if (tuiCalendar) {
  const styles = window.getComputedStyle(tuiCalendar);
  const criticalStyles = {
    'height': styles.height,
    'min-height': styles.minHeight,
    'max-height': styles.maxHeight,
    'overflow': styles.overflow,
    'display': styles.display,
    'flex': styles.flex,
    'position': styles.position
  };
  
  console.log('   .toastui-calendar 关键样式:');
  Object.entries(criticalStyles).forEach(([prop, value]) => {
    console.log(`     ${prop}: ${value}`);
  });
}
console.log('');

// ==========================================
// 6. 生成修复建议
// ==========================================
console.log('💡 诊断结果与建议:');
const issues = [];

if (!pageContainer || pageContainer.getBoundingClientRect().height < 100) {
  issues.push('page-container 高度不足，检查 AppLayout grid 设置');
}

if (!timeCalendarContainer || timeCalendarContainer.getBoundingClientRect().height < 100) {
  issues.push('time-calendar-container 高度不足，检查 flex 布局链');
}

if (!tuiCalendar || tuiCalendar.getBoundingClientRect().height < 100) {
  issues.push('toastui-calendar 高度不足，检查 height="100%" prop');
}

const monthContainer = document.querySelector('.toastui-calendar-month');
if (!monthContainer) {
  issues.push('月视图容器不存在，可能当前不在月视图模式');
} else if (monthContainer.getBoundingClientRect().height === 0) {
  issues.push('月视图容器高度为 0，检查 CSS flex 布局');
}

if (issues.length > 0) {
  issues.forEach((issue, index) => {
    console.error(`   ${index + 1}. ❌ ${issue}`);
  });
} else {
  console.log('   ✅ 未发现明显问题！');
}

console.log('\n🔍 诊断完成！请将以上输出截图发给我。');
