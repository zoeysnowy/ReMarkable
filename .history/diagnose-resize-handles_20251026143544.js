/**
 * Widget Resize Handles 完整诊断脚本
 * 在 Widget 窗口的浏览器控制台运行此脚本
 */

(function() {
  console.log('🔍 开始诊断 Widget Resize Handles...\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // 1. 查找所有 resize handles
  console.log('📋 第一步：查找所有 Resize Handles');
  console.log('─────────────────────────────────────────────────────────────');
  
  const handles = {
    bottom: document.querySelector('.resize-handle-bottom'),
    left: document.querySelector('.resize-handle-left'),
    right: document.querySelector('.resize-handle-right'),
    topLeft: document.querySelector('.resize-handle-topleft'),
    topRight: document.querySelector('.resize-handle-topright'),
    bottomLeft: document.querySelector('.resize-handle-bottomleft'),
    bottomRight: document.querySelector('.resize-handle-bottomright')
  };
  
  Object.entries(handles).forEach(([name, element]) => {
    if (element) {
      console.log(`✅ 找到 ${name}:`, element.className);
    } else {
      console.log(`❌ 未找到 ${name}`);
    }
  });

  // 2. 检查每个 handle 的样式和位置
  console.log('\n📐 第二步：检查 Resize Handles 的样式和位置');
  console.log('─────────────────────────────────────────────────────────────');
  
  Object.entries(handles).forEach(([name, element]) => {
    if (!element) return;
    
    const computed = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    
    console.log(`\n🎯 ${name.toUpperCase()}:`);
    console.log('   样式:');
    console.log(`      - position: ${computed.position}`);
    console.log(`      - display: ${computed.display}`);
    console.log(`      - zIndex: ${computed.zIndex}`);
    console.log(`      - top: ${computed.top}`);
    console.log(`      - bottom: ${computed.bottom}`);
    console.log(`      - left: ${computed.left}`);
    console.log(`      - right: ${computed.right}`);
    console.log(`      - width: ${computed.width}`);
    console.log(`      - height: ${computed.height}`);
    console.log(`      - cursor: ${computed.cursor}`);
    console.log(`      - pointerEvents: ${computed.pointerEvents}`);
    console.log(`      - webkitAppRegion: ${computed.webkitAppRegion}`);
    console.log('   边界框:');
    console.log(`      - top: ${rect.top.toFixed(2)}px`);
    console.log(`      - left: ${rect.left.toFixed(2)}px`);
    console.log(`      - width: ${rect.width.toFixed(2)}px`);
    console.log(`      - height: ${rect.height.toFixed(2)}px`);
    console.log(`      - 实际占用: ${rect.top.toFixed(2)} ~ ${rect.bottom.toFixed(2)}px (垂直), ${rect.left.toFixed(2)} ~ ${rect.right.toFixed(2)}px (水平)`);
  });

  // 3. 查找 StatusBar
  console.log('\n\n📊 第三步：查找 StatusBar');
  console.log('─────────────────────────────────────────────────────────────');
  
  // StatusBar 现在是正常布局流，不再是 absolute 定位
  const allDivs = Array.from(document.querySelectorAll('div'));
  const statusBar = allDivs.find(div => {
    const style = div.style.cssText;
    return style.includes('flexShrink: 0') && 
           style.includes('margin') && 
           style.includes('borderRadius: 20px');
  });
  
  if (statusBar) {
    console.log('✅ 找到 StatusBar');
    const computed = window.getComputedStyle(statusBar);
    const rect = statusBar.getBoundingClientRect();
    
    console.log('   样式:');
    console.log(`      - position: ${computed.position}`);
    console.log(`      - display: ${computed.display}`);
    console.log(`      - flexShrink: ${computed.flexShrink}`);
    console.log(`      - margin: ${computed.margin}`);
    console.log(`      - zIndex: ${computed.zIndex}`);
    console.log(`      - pointerEvents: ${computed.pointerEvents}`);
    console.log('   边界框:');
    console.log(`      - top: ${rect.top.toFixed(2)}px`);
    console.log(`      - bottom: ${rect.bottom.toFixed(2)}px`);
    console.log(`      - left: ${rect.left.toFixed(2)}px`);
    console.log(`      - right: ${rect.right.toFixed(2)}px`);
    console.log(`      - width: ${rect.width.toFixed(2)}px`);
    console.log(`      - height: ${rect.height.toFixed(2)}px`);
    console.log(`      - 距离窗口底部: ${(window.innerHeight - rect.bottom).toFixed(2)}px`);
  } else {
    console.log('❌ 未找到 StatusBar（查找条件：flexShrink: 0 + margin + borderRadius: 20px）');
  }

  // 4. 测试关键位置的元素
  console.log('\n\n🎯 第四步：测试窗口关键位置的元素');
  console.log('─────────────────────────────────────────────────────────────');
  
  const testPoints = [
    { name: '底部左角 (20, height-5)', x: 20, y: window.innerHeight - 5 },
    { name: '底部左侧 (50, height-5)', x: 50, y: window.innerHeight - 5 },
    { name: '底部中央 (width/2, height-5)', x: window.innerWidth / 2, y: window.innerHeight - 5 },
    { name: '底部右侧 (width-50, height-5)', x: window.innerWidth - 50, y: window.innerHeight - 5 },
    { name: '底部右角 (width-20, height-5)', x: window.innerWidth - 20, y: window.innerHeight - 5 },
    { name: '左侧中央 (5, height/2)', x: 5, y: window.innerHeight / 2 },
    { name: '右侧中央 (width-5, height/2)', x: window.innerWidth - 5, y: window.innerHeight / 2 },
  ];
  
  testPoints.forEach(point => {
    const element = document.elementFromPoint(point.x, point.y);
    const isResizeHandle = element && element.className.includes('resize-handle');
    const isStatusBar = element === statusBar;
    
    console.log(`\n📍 ${point.name} (${point.x.toFixed(0)}, ${point.y.toFixed(0)}):`);
    if (element) {
      console.log(`   元素: ${element.tagName} ${element.className || '(无类名)'}`);
      console.log(`   是 Resize Handle: ${isResizeHandle ? '✅' : '❌'}`);
      console.log(`   是 StatusBar: ${isStatusBar ? '✅' : '❌'}`);
      if (isResizeHandle) {
        const computed = window.getComputedStyle(element);
        console.log(`   cursor: ${computed.cursor}`);
        console.log(`   zIndex: ${computed.zIndex}`);
      }
    } else {
      console.log('   元素: null (窗口外)');
    }
  });

  // 5. 检查 z-index 堆叠顺序
  console.log('\n\n📚 第五步：检查 Z-Index 堆叠顺序');
  console.log('─────────────────────────────────────────────────────────────');
  
  const elementsWithZIndex = [];
  
  // 收集所有有 z-index 的元素
  document.querySelectorAll('*').forEach(el => {
    const computed = window.getComputedStyle(el);
    const zIndex = computed.zIndex;
    if (zIndex !== 'auto') {
      elementsWithZIndex.push({
        element: el,
        zIndex: parseInt(zIndex),
        className: el.className,
        tagName: el.tagName
      });
    }
  });
  
  // 按 z-index 排序
  elementsWithZIndex.sort((a, b) => b.zIndex - a.zIndex);
  
  console.log(`找到 ${elementsWithZIndex.length} 个有 z-index 的元素（按高到低排序）：`);
  elementsWithZIndex.slice(0, 10).forEach((item, index) => {
    console.log(`   ${index + 1}. z-index: ${item.zIndex} | ${item.tagName} ${item.className || '(无类名)'}`);
  });

  // 6. 检查事件监听器
  console.log('\n\n🎧 第六步：检查 Resize Handles 的事件监听器');
  console.log('─────────────────────────────────────────────────────────────');
  
  Object.entries(handles).forEach(([name, element]) => {
    if (!element) return;
    
    console.log(`\n${name.toUpperCase()}:`);
    
    // 检查是否有 onmousedown 属性
    if (element.onmousedown) {
      console.log('   ✅ 有 onmousedown 属性');
    } else {
      console.log('   ❌ 无 onmousedown 属性');
    }
    
    // 检查是否有 React 事件属性
    const reactProps = Object.keys(element).filter(key => key.startsWith('__react'));
    if (reactProps.length > 0) {
      console.log('   ✅ 有 React 事件绑定');
    } else {
      console.log('   ⚠️ 无 React 事件绑定');
    }
  });

  // 7. 诊断结论
  console.log('\n\n📊 诊断结论');
  console.log('═══════════════════════════════════════════════════════════════');
  
  const issues = [];
  
  // 检查是否所有 handle 都存在
  Object.entries(handles).forEach(([name, element]) => {
    if (!element) {
      issues.push(`❌ ${name} handle 不存在`);
    }
  });
  
  // 检查 bottom handle
  if (handles.bottom) {
    const computed = window.getComputedStyle(handles.bottom);
    const rect = handles.bottom.getBoundingClientRect();
    
    if (computed.display === 'none') {
      issues.push('❌ bottom handle 被隐藏 (display: none)');
    }
    
    if (computed.pointerEvents === 'none') {
      issues.push('❌ bottom handle 的 pointerEvents 为 none');
    }
    
    if (parseInt(computed.zIndex) < 1000) {
      issues.push(`⚠️ bottom handle 的 z-index 太低: ${computed.zIndex}`);
    }
    
    if (rect.height < 5) {
      issues.push(`⚠️ bottom handle 太窄: ${rect.height}px`);
    }
  }
  
  // 检查 StatusBar 是否覆盖
  if (statusBar && handles.bottom) {
    const statusBarRect = statusBar.getBoundingClientRect();
    const handleRect = handles.bottom.getBoundingClientRect();
    
    if (statusBarRect.bottom > handleRect.top) {
      const statusBarZ = parseInt(window.getComputedStyle(statusBar).zIndex) || 0;
      const handleZ = parseInt(window.getComputedStyle(handles.bottom).zIndex) || 0;
      
      if (statusBarZ >= handleZ) {
        issues.push(`❌ StatusBar (z-index: ${statusBarZ}) 覆盖了 bottom handle (z-index: ${handleZ})`);
      }
    }
  }
  
  // 输出问题
  if (issues.length > 0) {
    console.log('\n🚨 发现以下问题：');
    issues.forEach(issue => console.log(`   ${issue}`));
  } else {
    console.log('\n✅ 没有发现明显问题！');
    console.log('💡 如果仍然无法调整大小，可能是：');
    console.log('   1. 事件监听器未正确绑定');
    console.log('   2. Electron 主进程配置问题');
    console.log('   3. 窗口被锁定 (isLocked=true)');
  }

  // 8. 快速测试建议
  console.log('\n\n🔧 快速测试建议');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('在控制台执行以下命令进行测试：\n');
  
  if (handles.bottom) {
    console.log('// 1. 高亮 bottom handle（让它变红色，持续 3 秒）');
    console.log('document.querySelector(".resize-handle-bottom").style.backgroundColor = "rgba(255,0,0,0.5)";');
    console.log('setTimeout(() => document.querySelector(".resize-handle-bottom").style.backgroundColor = "", 3000);\n');
    
    console.log('// 2. 测试 bottom handle 的点击事件');
    console.log('document.querySelector(".resize-handle-bottom").addEventListener("mousedown", (e) => console.log("🎯 Bottom handle clicked!", e));\n');
  }
  
  if (statusBar) {
    console.log('// 3. 临时隐藏 StatusBar（测试是否是它阻挡）');
    console.log('const sb = document.querySelector(\'div[style*="flexShrink: 0"][style*="borderRadius: 20px"]\');');
    console.log('sb.style.display = "none";');
    console.log('// 恢复: sb.style.display = "flex";\n');
  }
  
  console.log('\n✨ 诊断完成！');
  console.log('请将以上完整输出发送给开发者。\n');
  console.log('═══════════════════════════════════════════════════════════════');
})();
