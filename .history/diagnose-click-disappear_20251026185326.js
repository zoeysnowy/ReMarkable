/**
 * 诊断脚本：监控点击时 resize handles 消失的原因
 * 
 * 使用方法：
 * 1. 在 Widget 窗口打开开发者工具 (Ctrl+Shift+I)
 * 2. 复制粘贴这整段代码到 Console
 * 3. 点击红色的 resize handle 区域
 * 4. 查看输出，找出是什么导致 handles 消失
 */

console.log('🔍 开始监控 Resize Handles 消失问题...\n');

// 1. 获取所有 resize handles
const handles = Array.from(document.querySelectorAll('[class*="resize-handle"]'));
console.log(`✅ 找到 ${handles.length} 个 resize handles`);

if (handles.length === 0) {
  console.error('❌ 没有找到任何 resize handles！');
} else {
  handles.forEach(h => {
    console.log(`  - ${h.className}: ${h.style.position || 'default'} positioning`);
  });
}

// 2. 监控 DOM 变化
const observer = new MutationObserver((mutations) => {
  mutations.forEach(mutation => {
    mutation.removedNodes.forEach(node => {
      if (node.className && node.className.includes('resize-handle')) {
        console.error('❌ Resize handle 被移除了!', {
          className: node.className,
          时间: new Date().toLocaleTimeString()
        });
        console.trace('调用栈:');
      }
    });
    
    mutation.addedNodes.forEach(node => {
      if (node.className && node.className.includes('resize-handle')) {
        console.log('✅ Resize handle 被添加了!', {
          className: node.className,
          时间: new Date().toLocaleTimeString()
        });
      }
    });
  });
});

// 监控整个 widget container
const widgetContainer = document.querySelector('.desktop-calendar-widget');
if (widgetContainer) {
  observer.observe(widgetContainer, {
    childList: true,
    subtree: true
  });
  console.log('✅ 已启动 DOM 变化监控\n');
} else {
  console.error('❌ 未找到 .desktop-calendar-widget 容器\n');
}

// 3. 监控点击事件
handles.forEach(handle => {
  // 使用 capture phase，确保能捕获到事件
  handle.addEventListener('mousedown', (e) => {
    console.log('🖱️ [CAPTURE] mousedown 在 handle 上触发!', {
      className: handle.className,
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target.className,
      currentTarget: e.currentTarget.className
    });
  }, true); // capture phase
  
  handle.addEventListener('click', (e) => {
    console.log('🖱️ [CAPTURE] click 在 handle 上触发!', {
      className: handle.className
    });
  }, true);
});

// 4. 每 200ms 检查 handles 数量
let lastCount = handles.length;
const checkInterval = setInterval(() => {
  const currentCount = document.querySelectorAll('[class*="resize-handle"]').length;
  if (currentCount !== lastCount) {
    console.warn(`⚠️ Handles 数量变化: ${lastCount} → ${currentCount}`);
    lastCount = currentCount;
    
    if (currentCount === 0) {
      console.error('❌ 所有 handles 都消失了！');
      // 显示当前 DOM 状态
      console.log('当前 widget 容器内容:', widgetContainer?.innerHTML);
    }
  }
}, 200);

// 5. 测试：高亮 bottom handle 并添加测试点击
const bottomHandle = handles.find(h => h.className.includes('resize-handle-bottom') && !h.className.includes('left') && !h.className.includes('right'));
if (bottomHandle) {
  // 高亮显示
  bottomHandle.style.backgroundColor = 'rgba(255, 0, 0, 0.8)';
  bottomHandle.style.zIndex = '99999';
  
  console.log('✅ Bottom handle 已高亮显示（红色）');
  console.log('底部边缘的样式:', {
    position: bottomHandle.style.position || getComputedStyle(bottomHandle).position,
    bottom: bottomHandle.style.bottom || getComputedStyle(bottomHandle).bottom,
    height: bottomHandle.style.height || getComputedStyle(bottomHandle).height,
    zIndex: bottomHandle.style.zIndex || getComputedStyle(bottomHandle).zIndex,
    pointerEvents: getComputedStyle(bottomHandle).pointerEvents,
    display: getComputedStyle(bottomHandle).display
  });
  
  console.log('\n📍 Bottom handle 位置信息:');
  const rect = bottomHandle.getBoundingClientRect();
  console.log({
    top: rect.top,
    left: rect.left,
    bottom: rect.bottom,
    right: rect.right,
    width: rect.width,
    height: rect.height
  });
} else {
  console.error('❌ 未找到 bottom handle');
}

console.log('\n🎯 现在请点击红色区域，观察输出...\n');

// 清理函数
window.stopMonitoring = () => {
  observer.disconnect();
  clearInterval(checkInterval);
  console.log('✅ 监控已停止');
};

console.log('💡 运行 stopMonitoring() 可以停止监控\n');
