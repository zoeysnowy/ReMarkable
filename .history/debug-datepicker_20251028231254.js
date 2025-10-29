// 📅 Ant Design DatePicker 调试工具
// 在浏览器控制台中运行这段代码来分析日历弹窗问题

function debugDatePicker() {
  console.log('🔍 开始分析 DatePicker 组件...');
  console.log('==========================================');
  
  // 1. 检查所有 DatePicker 相关的 DOM 元素
  console.log('📋 1. 查找所有相关的 DOM 元素:');
  
  const rangePickers = document.querySelectorAll('.ant-picker-range');
  console.log(`   找到 ${rangePickers.length} 个 RangePicker:`, rangePickers);
  
  const pickerInputs = document.querySelectorAll('.ant-picker-input input');
  console.log(`   找到 ${pickerInputs.length} 个输入框:`, pickerInputs);
  
  const pickerDropdowns = document.querySelectorAll('.ant-picker-dropdown');
  console.log(`   找到 ${pickerDropdowns.length} 个弹窗:`, pickerDropdowns);
  
  const tippyContent = document.querySelectorAll('.tippy-content');
  console.log(`   找到 ${tippyContent.length} 个 Tippy 容器:`, tippyContent);
  
  const portalContainer = document.getElementById('datetime-picker-portal');
  console.log(`   Portal 容器:`, portalContainer);
  
  console.log('');
  
  // 2. 分析每个弹窗的状态
  console.log('📊 2. 弹窗状态分析:');
  pickerDropdowns.forEach((dropdown, index) => {
    const styles = window.getComputedStyle(dropdown);
    const rect = dropdown.getBoundingClientRect();
    
    console.log(`   弹窗 ${index + 1}:`, {
      element: dropdown,
      classes: dropdown.className,
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      position: styles.position,
      zIndex: styles.zIndex,
      top: styles.top,
      left: styles.left,
      transform: styles.transform,
      pointerEvents: styles.pointerEvents,
      overflow: styles.overflow,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        visible: rect.width > 0 && rect.height > 0
      },
      parent: dropdown.parentElement,
      parentStyles: dropdown.parentElement ? {
        overflow: window.getComputedStyle(dropdown.parentElement).overflow,
        position: window.getComputedStyle(dropdown.parentElement).position,
        zIndex: window.getComputedStyle(dropdown.parentElement).zIndex
      } : null
    });
  });
  
  console.log('');
  
  // 3. 检查容器层级关系
  console.log('🏗️ 3. 容器层级分析:');
  
  function analyzeContainer(element, name, depth = 0) {
    if (!element) return;
    
    const indent = '  '.repeat(depth);
    const styles = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    console.log(`${indent}${name}:`, {
      element,
      id: element.id,
      classes: element.className,
      position: styles.position,
      zIndex: styles.zIndex,
      overflow: styles.overflow,
      display: styles.display,
      visibility: styles.visibility,
      opacity: styles.opacity,
      pointerEvents: styles.pointerEvents,
      rect: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height
      }
    });
    
    if (depth < 3 && element.parentElement) {
      analyzeContainer(element.parentElement, `${name} 的父容器`, depth + 1);
    }
  }
  
  if (rangePickers.length > 0) {
    analyzeContainer(rangePickers[0], 'RangePicker');
  }
  
  if (portalContainer) {
    analyzeContainer(portalContainer, 'Portal 容器');
  }
  
  console.log('');
  
  // 4. 检查事件监听器
  console.log('🎯 4. 事件分析:');
  pickerInputs.forEach((input, index) => {
    console.log(`   输入框 ${index + 1} 事件:`, {
      element: input,
      focused: document.activeElement === input,
      readOnly: input.readOnly,
      disabled: input.disabled,
      tabIndex: input.tabIndex
    });
  });
  
  console.log('');
  
  // 5. 模拟点击测试
  console.log('🖱️ 5. 模拟点击测试:');
  if (pickerInputs.length > 0) {
    const firstInput = pickerInputs[0];
    console.log('   准备模拟点击第一个输入框...');
    
    // 触发各种事件
    ['mousedown', 'mouseup', 'click', 'focus'].forEach(eventType => {
      const event = new Event(eventType, { bubbles: true });
      firstInput.dispatchEvent(event);
      console.log(`   已触发 ${eventType} 事件`);
    });
    
    // 等待一下再检查
    setTimeout(() => {
      const newDropdowns = document.querySelectorAll('.ant-picker-dropdown');
      console.log(`   事件触发后找到 ${newDropdowns.length} 个弹窗`);
      
      newDropdowns.forEach((dropdown, index) => {
        const styles = window.getComputedStyle(dropdown);
        console.log(`   弹窗 ${index + 1} 状态:`, {
          display: styles.display,
          visibility: styles.visibility,
          opacity: styles.opacity,
          classes: dropdown.className
        });
      });
    }, 100);
  }
  
  console.log('');
  
  // 6. CSS 规则分析
  console.log('🎨 6. CSS 规则分析:');
  const stylesheets = Array.from(document.styleSheets);
  const relevantRules = [];
  
  stylesheets.forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach(rule => {
        if (rule.selectorText && (
          rule.selectorText.includes('ant-picker') ||
          rule.selectorText.includes('tippy') ||
          rule.selectorText.includes('datetime-range')
        )) {
          relevantRules.push({
            selector: rule.selectorText,
            style: rule.style.cssText
          });
        }
      });
    } catch (e) {
      // 跨域样式表可能无法访问
    }
  });
  
  console.log(`   找到 ${relevantRules.length} 个相关的 CSS 规则:`, relevantRules);
  
  console.log('');
  console.log('✅ 调试完成！请查看上面的输出来定位问题。');
  console.log('==========================================');
}

// 运行调试
debugDatePicker();

// 同时提供一个手动强制显示的函数
function forceShowDatePicker() {
  console.log('🚀 尝试强制显示所有日历弹窗...');
  
  const dropdowns = document.querySelectorAll('.ant-picker-dropdown');
  dropdowns.forEach((dropdown, index) => {
    console.log(`强制显示弹窗 ${index + 1}...`);
    
    // 移除隐藏类
    dropdown.classList.remove('ant-picker-dropdown-hidden');
    
    // 强制设置样式
    dropdown.style.cssText += `
      display: block !important;
      visibility: visible !important;
      opacity: 1 !important;
      pointer-events: auto !important;
      position: fixed !important;
      top: 200px !important;
      left: 200px !important;
      z-index: 999999 !important;
      background: white !important;
      border: 3px solid red !important;
      box-shadow: 0 4px 20px rgba(0,0,0,0.5) !important;
    `;
    
    console.log(`弹窗 ${index + 1} 已强制显示`);
  });
  
  console.log('✅ 强制显示完成！如果还是看不到，说明弹窗本身没有被创建。');
}

console.log('📚 可用的调试函数:');
console.log('   debugDatePicker() - 全面分析');
console.log('   forceShowDatePicker() - 强制显示弹窗');