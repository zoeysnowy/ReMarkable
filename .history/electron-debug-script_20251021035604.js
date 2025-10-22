// Electron 点击事件调试脚本
// 将此脚本内容粘贴到开发者工具的控制台中运行

console.log('🔧 开始Electron点击事件调试...');

// 检查Electron环境
if (window.electronAPI) {
  console.log('✅ Electron API 可用');
  console.log('🔧 Electron版本:', window.electronAPI.isDev);
} else {
  console.log('❌ 未检测到Electron API');
}

// 获取所有导航按钮
const navButtons = document.querySelectorAll('.nav-item');
console.log(`🔧 找到 ${navButtons.length} 个导航按钮`);

// 为每个按钮添加详细的事件监听器
navButtons.forEach((button, index) => {
  const label = button.querySelector('.nav-label')?.textContent || `按钮${index}`;
  
  // 添加多种事件监听器
  ['click', 'mousedown', 'mouseup', 'touchstart', 'touchend'].forEach(eventType => {
    button.addEventListener(eventType, function(e) {
      console.log(`🎯 [${eventType}] ${label} 被触发`, {
        event: e,
        target: e.target,
        currentTarget: e.currentTarget,
        propagation: !e.defaultPrevented,
        timestamp: new Date().toISOString()
      });
      
      if (window.electronAPI?.debugLog) {
        window.electronAPI.debugLog(`Event ${eventType} on ${label}`, {
          eventType,
          label,
          timestamp: new Date().toISOString()
        });
      }
    }, true); // 使用捕获阶段
  });
  
  console.log(`✅ 为"${label}"添加了事件监听器`);
});

// 检查CSS样式是否阻止点击
navButtons.forEach((button, index) => {
  const styles = window.getComputedStyle(button);
  const label = button.querySelector('.nav-label')?.textContent || `按钮${index}`;
  
  console.log(`🎨 "${label}" 样式检查:`, {
    pointerEvents: styles.pointerEvents,
    zIndex: styles.zIndex,
    position: styles.position,
    display: styles.display,
    visibility: styles.visibility,
    opacity: styles.opacity
  });
  
  if (styles.pointerEvents === 'none') {
    console.warn(`⚠️ "${label}" 的 pointer-events 被设置为 none`);
  }
});

// 模拟点击测试
function testClick(buttonIndex = 0) {
  const button = navButtons[buttonIndex];
  if (!button) {
    console.error('按钮不存在');
    return;
  }
  
  const label = button.querySelector('.nav-label')?.textContent || `按钮${buttonIndex}`;
  console.log(`🧪 模拟点击 "${label}"`);
  
  // 创建点击事件
  const clickEvent = new MouseEvent('click', {
    view: window,
    bubbles: true,
    cancelable: true,
    clientX: button.getBoundingClientRect().left + 10,
    clientY: button.getBoundingClientRect().top + 10
  });
  
  button.dispatchEvent(clickEvent);
}

console.log('🔧 调试脚本加载完成！');
console.log('💡 使用 testClick(0) 来模拟点击第一个按钮');
console.log('💡 使用 testClick(1) 来模拟点击第二个按钮，以此类推');

// 暴露测试函数到全局
window.testClick = testClick;