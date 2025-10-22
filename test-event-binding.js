/**
 * 测试拖动条事件绑定
 * 在控制台复制粘贴并运行
 */

console.log('=== 测试拖动条事件绑定 ===\n');

const dragBar = document.querySelector('.drag-bar');

if (!dragBar) {
  console.error('❌ 拖动条不存在！');
} else {
  console.log('✅ 拖动条存在');
  
  // 1. 检查内联事件处理器
  console.log('\n1️⃣ 检查内联事件处理器：');
  console.log('  onmousedown:', dragBar.onmousedown !== null ? '✅ 已绑定' : '❌ 未绑定');
  console.log('  onmouseenter:', dragBar.onmouseenter !== null ? '✅ 已绑定' : '❌ 未绑定');
  console.log('  onmouseleave:', dragBar.onmouseleave !== null ? '✅ 已绑定' : '❌ 未绑定');
  
  // 2. 添加测试监听器
  console.log('\n2️⃣ 添加测试监听器：');
  let testCount = 0;
  
  const testHandler = (e) => {
    testCount++;
    console.log(`✅ 测试监听器触发 #${testCount}`, {
      type: e.type,
      button: e.button,
      clientX: e.clientX,
      clientY: e.clientY,
      target: e.target.className
    });
  };
  
  dragBar.addEventListener('mousedown', testHandler);
  dragBar.addEventListener('click', (e) => {
    console.log('✅ click 事件触发', { clientX: e.clientX, clientY: e.clientY });
  });
  
  console.log('  测试监听器已添加');
  console.log('  👆 请点击拖动条...');
  
  // 3. 10秒后检查结果
  setTimeout(() => {
    console.log('\n3️⃣ 测试结果：');
    if (testCount === 0) {
      console.error('  ❌ 未检测到任何点击！');
      console.log('  可能的原因：');
      console.log('    1. 拖动条被其他元素遮挡');
      console.log('    2. 事件被其他监听器阻止');
      console.log('    3. CSS pointer-events 设置有问题');
      
      // 检查是否被遮挡
      const rect = dragBar.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const elementAtCenter = document.elementFromPoint(centerX, centerY);
      
      console.log('\n  检查遮挡情况：');
      console.log('    拖动条中心点:', { x: centerX, y: centerY });
      console.log('    中心点元素:', elementAtCenter?.className || elementAtCenter?.tagName);
      console.log('    是拖动条吗?', elementAtCenter === dragBar ? '✅ 是' : '❌ 否（被遮挡！）');
      
      if (elementAtCenter && elementAtCenter !== dragBar) {
        console.log('    遮挡元素详情:', {
          tag: elementAtCenter.tagName,
          class: elementAtCenter.className,
          id: elementAtCenter.id,
          zIndex: window.getComputedStyle(elementAtCenter).zIndex,
          pointerEvents: window.getComputedStyle(elementAtCenter).pointerEvents
        });
      }
    } else {
      console.log(`  ✅ 成功！共检测到 ${testCount} 次点击`);
      console.log('  说明事件绑定正常，但 React 的事件处理器可能有问题');
    }
    
    dragBar.removeEventListener('mousedown', testHandler);
  }, 10000);
  
  console.log('\n💡 提示：测试将在 10 秒后结束');
}

console.log('\n=== 测试脚本已启动 ===');

