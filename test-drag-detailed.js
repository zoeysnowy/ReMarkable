/**
 * 详细的拖动测试脚本
 * 在 Widget 窗口的控制台中运行
 */

console.log('=== 详细拖动测试 ===\n');

// 1. 检查 DOM 结构
console.log('1️⃣ 检查 DOM 结构：');
const widget = document.querySelector('.desktop-calendar-widget');
const dragBar = document.querySelector('.drag-bar');
const masks = document.querySelectorAll('[style*="position: fixed"]');

console.log('  Widget 容器:', widget ? '✅ 存在' : '❌ 不存在');
console.log('  拖动条:', dragBar ? '✅ 存在' : '❌ 不存在');
console.log('  遮罩层数量:', masks.length);

if (dragBar) {
  const dragBarStyles = window.getComputedStyle(dragBar);
  console.log('  拖动条样式:', {
    position: dragBarStyles.position,
    top: dragBarStyles.top,
    left: dragBarStyles.left,
    right: dragBarStyles.right,
    width: dragBarStyles.width,
    height: dragBarStyles.height,
    zIndex: dragBarStyles.zIndex,
    cursor: dragBarStyles.cursor,
    display: dragBarStyles.display,
    pointerEvents: dragBarStyles.pointerEvents,
    WebkitAppRegion: dragBar.style.WebkitAppRegion || dragBarStyles.webkitAppRegion || '(未设置)'
  });
}

if (widget) {
  const widgetStyles = window.getComputedStyle(widget);
  console.log('  Widget 容器样式:', {
    position: widgetStyles.position,
    width: widgetStyles.width,
    height: widgetStyles.height,
    WebkitAppRegion: widget.style.WebkitAppRegion || widgetStyles.webkitAppRegion || '(未设置)'
  });
}

// 2. 检查事件监听器
console.log('\n2️⃣ 检查事件监听器：');
if (dragBar) {
  console.log('  onmousedown:', dragBar.onmousedown !== null ? '✅ 已绑定' : '❌ 未绑定');
  console.log('  onmouseenter:', dragBar.onmouseenter !== null ? '✅ 已绑定' : '❌ 未绑定');
  console.log('  onmouseleave:', dragBar.onmouseleave !== null ? '✅ 已绑定' : '❌ 未绑定');
}

// 3. 检查元素层级
console.log('\n3️⃣ 检查元素层级（从上到下）：');
const elementsAtTop = [];
const rect = dragBar ? dragBar.getBoundingClientRect() : null;
if (rect) {
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  
  console.log('  拖动条中心点:', { x: centerX, y: centerY });
  
  // 检查中心点的元素
  const elementAtPoint = document.elementFromPoint(centerX, centerY);
  console.log('  中心点元素:', elementAtPoint?.className || elementAtPoint?.tagName);
  console.log('  是否是拖动条:', elementAtPoint === dragBar ? '✅ 是' : '❌ 否（被遮挡！）');
  
  if (elementAtPoint !== dragBar) {
    console.warn('  ⚠️ 警告：拖动条被其他元素遮挡！');
    console.log('  遮挡元素:', elementAtPoint);
    
    // 找出所有在拖动条上方的元素
    let currentElement = elementAtPoint;
    let depth = 0;
    while (currentElement && currentElement !== document.body && depth < 10) {
      const styles = window.getComputedStyle(currentElement);
      console.log(`    层级 ${depth}:`, {
        tag: currentElement.tagName,
        class: currentElement.className,
        zIndex: styles.zIndex,
        position: styles.position,
        pointerEvents: styles.pointerEvents
      });
      currentElement = currentElement.parentElement;
      depth++;
    }
  }
}

// 4. 测试点击事件
console.log('\n4️⃣ 测试点击事件：');
let clickCount = 0;
const testClickHandler = (e) => {
  clickCount++;
  console.log(`  ✅ 拖动条点击事件触发 #${clickCount}`, {
    clientX: e.clientX,
    clientY: e.clientY,
    button: e.button
  });
};

if (dragBar) {
  dragBar.addEventListener('mousedown', testClickHandler);
  console.log('  已添加测试监听器');
  console.log('  👆 请点击拖动条进行测试...');
  
  setTimeout(() => {
    dragBar.removeEventListener('mousedown', testClickHandler);
    if (clickCount === 0) {
      console.error('  ❌ 未检测到点击！拖动条可能被遮挡或事件被阻止。');
    } else {
      console.log(`  ✅ 测试完成，共检测到 ${clickCount} 次点击`);
    }
  }, 10000);
} else {
  console.error('  ❌ 拖动条不存在，无法测试');
}

// 5. 检查 localStorage
console.log('\n5️⃣ 检查 localStorage：');
const settings = localStorage.getItem('desktop-calendar-widget-settings');
if (settings) {
  try {
    const parsed = JSON.parse(settings);
    console.log('  设置内容:', parsed);
    console.log('  isLocked:', parsed.isLocked === true ? '🔒 已锁定' : '🔓 未锁定');
  } catch (e) {
    console.error('  ❌ 解析失败:', e);
  }
} else {
  console.log('  ℹ️ 无保存设置');
}

// 6. 检查 Electron API
console.log('\n6️⃣ 检查 Electron API：');
console.log('  electronAPI:', window.electronAPI ? '✅ 可用' : '❌ 不可用');
if (window.electronAPI) {
  console.log('  widgetMove:', typeof window.electronAPI.widgetMove);
  console.log('  widgetLock:', typeof window.electronAPI.widgetLock);
}

// 提供修复函数
console.log('\n=== 可用命令 ===');
console.log('• testManualDrag() - 手动测试拖动');
console.log('• fixZIndex() - 修复层级问题');
console.log('• removeOverlays() - 移除所有遮罩层');

window.testManualDrag = function() {
  console.log('🧪 开始手动拖动测试...');
  
  let startPos = null;
  const handleStart = (e) => {
    startPos = { x: e.screenX, y: e.screenY };
    console.log('🎯 拖动开始:', startPos);
  };
  
  const handleMove = (e) => {
    if (!startPos) return;
    const deltaX = e.screenX - startPos.x;
    const deltaY = e.screenY - startPos.y;
    console.log('🎯 移动:', { deltaX, deltaY });
    
    if (window.electronAPI?.widgetMove) {
      window.electronAPI.widgetMove({ x: deltaX, y: deltaY });
      startPos = { x: e.screenX, y: e.screenY };
    }
  };
  
  const handleEnd = () => {
    console.log('🎯 拖动结束');
    startPos = null;
    document.removeEventListener('mousemove', handleMove);
    document.removeEventListener('mouseup', handleEnd);
  };
  
  if (dragBar) {
    dragBar.addEventListener('mousedown', (e) => {
      handleStart(e);
      document.addEventListener('mousemove', handleMove);
      document.addEventListener('mouseup', handleEnd);
    }, { once: true });
    console.log('✅ 测试监听器已添加，请拖动拖动条...');
  } else {
    console.error('❌ 拖动条不存在');
  }
};

window.fixZIndex = function() {
  console.log('🔧 修复拖动条层级...');
  if (dragBar) {
    dragBar.style.zIndex = '99999';
    dragBar.style.position = 'absolute';
    console.log('✅ 已将拖动条 z-index 设置为 99999');
  }
};

window.removeOverlays = function() {
  console.log('🔧 移除所有遮罩层...');
  const overlays = document.querySelectorAll('[style*="position: fixed"]');
  overlays.forEach((overlay, i) => {
    const styles = window.getComputedStyle(overlay);
    if (styles.pointerEvents === 'all' || styles.pointerEvents === 'auto') {
      console.log(`  移除遮罩层 #${i + 1}`);
      overlay.remove();
    }
  });
  console.log('✅ 完成');
};

console.log('\n=== 诊断完成 ===');
console.log('💡 10秒后将完成点击测试');

