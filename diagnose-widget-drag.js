/**
 * Widget 拖动问题诊断脚本
 * 在浏览器控制台中运行此脚本
 */

console.log('=== Widget 拖动问题诊断 ===\n');

// 1. 检查 localStorage 中的锁定状态
console.log('1️⃣ 检查 localStorage 设置：');
const settings = localStorage.getItem('desktop-calendar-widget-settings');
if (settings) {
  try {
    const parsed = JSON.parse(settings);
    console.log('   设置内容:', parsed);
    console.log('   isLocked:', parsed.isLocked);
    
    if (parsed.isLocked === true) {
      console.warn('   ⚠️ 警告：Widget 当前处于锁定状态！');
      console.log('   📝 修复方法：运行以下命令解锁');
      console.log('   fixLock()');
    } else {
      console.log('   ✅ Widget 未锁定');
    }
  } catch (e) {
    console.error('   ❌ 解析失败:', e);
  }
} else {
  console.log('   ℹ️ 未找到保存的设置');
}

// 2. 检查拖动条元素
console.log('\n2️⃣ 检查拖动条元素：');
const dragBar = document.querySelector('.drag-bar');
if (dragBar) {
  console.log('   ✅ 找到拖动条元素');
  console.log('   样式:', {
    display: window.getComputedStyle(dragBar).display,
    cursor: window.getComputedStyle(dragBar).cursor,
    pointerEvents: window.getComputedStyle(dragBar).pointerEvents,
    WebkitAppRegion: dragBar.style.WebkitAppRegion || '未设置',
    zIndex: window.getComputedStyle(dragBar).zIndex
  });
  
  // 检查是否有 onMouseDown 事件监听器
  const hasMouseDown = dragBar.onmousedown !== null;
  console.log('   onMouseDown 事件:', hasMouseDown ? '✅ 已绑定' : '❌ 未绑定');
  
} else {
  console.error('   ❌ 未找到拖动条元素！Widget 可能已锁定。');
}

// 3. 检查 Electron API
console.log('\n3️⃣ 检查 Electron API：');
if (window.electronAPI) {
  console.log('   ✅ electronAPI 可用');
  console.log('   widgetMove:', typeof window.electronAPI.widgetMove);
  console.log('   widgetLock:', typeof window.electronAPI.widgetLock);
} else {
  console.error('   ❌ electronAPI 不可用！');
}

// 4. 检查遮罩层
console.log('\n4️⃣ 检查拖动遮罩层：');
const masks = document.querySelectorAll('[style*="position: fixed"]');
console.log('   找到', masks.length, '个 fixed 定位元素');

// 提供修复函数
console.log('\n=== 修复函数 ===');
console.log('可用的修复命令：');
console.log('• fixLock() - 清除锁定状态');
console.log('• testDrag() - 测试拖动功能');
console.log('• clearSettings() - 清除所有设置');

window.fixLock = function() {
  console.log('🔧 正在解除锁定...');
  const settings = localStorage.getItem('desktop-calendar-widget-settings');
  if (settings) {
    try {
      const parsed = JSON.parse(settings);
      parsed.isLocked = false;
      localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify(parsed));
      console.log('✅ 已解除锁定！');
      console.log('📝 请刷新页面（F5）使更改生效');
    } catch (e) {
      console.error('❌ 修复失败:', e);
    }
  } else {
    console.log('ℹ️ 未找到设置，创建新设置...');
    localStorage.setItem('desktop-calendar-widget-settings', JSON.stringify({
      bgOpacity: 0.95,
      bgColor: '#ffffff',
      isLocked: false
    }));
    console.log('✅ 已创建新设置！');
    console.log('📝 请刷新页面（F5）');
  }
};

window.testDrag = function() {
  console.log('🧪 测试拖动功能...');
  const dragBar = document.querySelector('.drag-bar');
  if (!dragBar) {
    console.error('❌ 未找到拖动条！Widget 可能已锁定。');
    console.log('💡 提示：运行 fixLock() 然后刷新页面');
    return;
  }
  
  console.log('✅ 拖动条存在');
  console.log('📝 请尝试拖动窗口顶部的蓝色条');
  
  // 添加临时事件监听器测试
  const testHandler = (e) => {
    console.log('🎯 拖动条被点击！', { x: e.clientX, y: e.clientY });
  };
  dragBar.addEventListener('mousedown', testHandler, { once: true });
  console.log('👆 点击拖动条进行测试...');
};

window.clearSettings = function() {
  if (confirm('确定要清除所有 Widget 设置吗？')) {
    localStorage.removeItem('desktop-calendar-widget-settings');
    console.log('✅ 设置已清除！');
    console.log('📝 请刷新页面（F5）');
  }
};

console.log('\n=== 诊断完成 ===');
console.log('💡 提示：如果拖动条不可见，很可能是 isLocked=true');
console.log('💡 运行 fixLock() 然后刷新页面即可修复');

