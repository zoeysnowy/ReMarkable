/**
 * Widget StatusBar 调整大小诊断脚本
 * 在 Widget 窗口的浏览器控制台运行此脚本
 */

(function() {
  console.log('🔍 开始诊断 Widget StatusBar 调整大小问题...\n');

  // 1. 查找 StatusBar 元素
  const statusBar = document.querySelector('div[style*="position: absolute"][style*="bottom:"]');
  
  if (!statusBar) {
    console.log('❌ 未找到 StatusBar 元素');
    console.log('💡 尝试查找所有 absolute 定位的元素...');
    const allAbsolute = document.querySelectorAll('div[style*="position: absolute"]');
    console.log(`   找到 ${allAbsolute.length} 个 absolute 定位元素`);
    allAbsolute.forEach((el, i) => {
      console.log(`   元素 ${i+1}:`, el.style.cssText.substring(0, 100));
    });
    return;
  }
  
  console.log('✅ 找到 StatusBar 元素:', statusBar);
  
  // 2. 检查 StatusBar 的样式
  console.log('\n📋 StatusBar 样式检查:');
  const computed = window.getComputedStyle(statusBar);
  console.log('   - position:', computed.position);
  console.log('   - bottom:', computed.bottom);
  console.log('   - left:', computed.left);
  console.log('   - right:', computed.right);
  console.log('   - zIndex:', computed.zIndex);
  console.log('   - width:', computed.width);
  console.log('   - height:', computed.height);
  console.log('   - pointerEvents:', computed.pointerEvents);
  console.log('   - cursor:', computed.cursor);
  
  // 3. 检查 Electron 特有的属性
  console.log('\n🎨 Electron 属性检查:');
  console.log('   - webkitAppRegion:', computed.webkitAppRegion);
  console.log('   - appRegion:', computed.appRegion);
  console.log('   - 内联 style 中的 WebkitAppRegion:', statusBar.style.WebkitAppRegion);
  console.log('   - 内联 style 中的 appRegion:', statusBar.style.appRegion);
  
  // 4. 检查 StatusBar 的边界框
  const rect = statusBar.getBoundingClientRect();
  console.log('\n📐 StatusBar 边界框:');
  console.log('   - top:', rect.top, 'px');
  console.log('   - bottom:', rect.bottom, 'px');
  console.log('   - left:', rect.left, 'px');
  console.log('   - right:', rect.right, 'px');
  console.log('   - width:', rect.width, 'px');
  console.log('   - height:', rect.height, 'px');
  
  // 5. 检查窗口尺寸
  console.log('\n🖥️ 窗口尺寸:');
  console.log('   - window.innerWidth:', window.innerWidth, 'px');
  console.log('   - window.innerHeight:', window.innerHeight, 'px');
  console.log('   - StatusBar 距离窗口底部:', window.innerHeight - rect.bottom, 'px');
  console.log('   - StatusBar 距离窗口右边:', window.innerWidth - rect.right, 'px');
  
  // 6. 检查是否有元素覆盖在 StatusBar 上方
  console.log('\n🔍 检查覆盖元素:');
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const elementAtCenter = document.elementFromPoint(centerX, centerY);
  console.log('   - StatusBar 中心点的元素:', elementAtCenter);
  console.log('   - 是否是 StatusBar 本身:', elementAtCenter === statusBar);
  
  // 7. 测试底部边缘
  console.log('\n🎯 测试窗口底部边缘:');
  const bottomEdgeY = window.innerHeight - 5; // 底部 5px
  const bottomLeftX = 50;
  const bottomCenterX = window.innerWidth / 2;
  const bottomRightX = window.innerWidth - 50;
  
  const elementAtBottomLeft = document.elementFromPoint(bottomLeftX, bottomEdgeY);
  const elementAtBottomCenter = document.elementFromPoint(bottomCenterX, bottomEdgeY);
  const elementAtBottomRight = document.elementFromPoint(bottomRightX, bottomEdgeY);
  
  console.log('   - 底部左侧元素:', elementAtBottomLeft?.tagName, elementAtBottomLeft === statusBar ? '(StatusBar)' : '');
  console.log('   - 底部中央元素:', elementAtBottomCenter?.tagName, elementAtBottomCenter === statusBar ? '(StatusBar)' : '');
  console.log('   - 底部右侧元素:', elementAtBottomRight?.tagName, elementAtBottomRight === statusBar ? '(StatusBar)' : '');
  
  // 8. 检查是否有父元素影响
  console.log('\n👪 父元素检查:');
  let parent = statusBar.parentElement;
  let level = 1;
  while (parent && level <= 3) {
    const parentComputed = window.getComputedStyle(parent);
    console.log(`   父元素 ${level}: ${parent.className || parent.tagName}`);
    console.log(`      - position: ${parentComputed.position}`);
    console.log(`      - overflow: ${parentComputed.overflow}`);
    console.log(`      - pointerEvents: ${parentComputed.pointerEvents}`);
    console.log(`      - webkitAppRegion: ${parentComputed.webkitAppRegion}`);
    parent = parent.parentElement;
    level++;
  }
  
  // 9. 诊断结论
  console.log('\n📊 诊断结论:');
  
  const bottomGap = window.innerHeight - rect.bottom;
  const hasGap = bottomGap >= 4; // 至少 4px 的间隙才能调整大小
  
  if (!hasGap) {
    console.log('   ❌ 问题: StatusBar 太靠近窗口底部');
    console.log(`      距离底部仅 ${bottomGap.toFixed(1)}px，建议至少 5-10px`);
    console.log('   建议: 增加 bottom 值或减少 StatusBar 高度');
  }
  
  if (computed.pointerEvents === 'none') {
    console.log('   ❌ 问题: StatusBar 的 pointerEvents 为 none');
    console.log('   建议: 设置 pointerEvents: "auto"');
  }
  
  if (computed.webkitAppRegion === 'drag' || computed.appRegion === 'drag') {
    console.log('   ⚠️ 问题: StatusBar 设置了 app-region: drag');
    console.log('   建议: 设置为 "no-drag" 允许窗口调整大小');
  }
  
  if (elementAtBottomCenter === statusBar) {
    console.log('   ⚠️ 问题: StatusBar 覆盖了窗口底部中央');
    console.log('   影响: 阻挡了底部边缘的调整大小热区');
    console.log('   建议: 增加 bottom 值，为热区留出空间');
  }
  
  if (hasGap && computed.pointerEvents !== 'none' && computed.webkitAppRegion !== 'drag') {
    console.log('   ✅ 样式配置正确，应该可以调整窗口大小');
    console.log('   💡 如果仍然无法调整，可能是 Electron 主进程配置问题');
  }
  
  console.log('\n✨ 诊断完成！');
  console.log('💡 提示: 如果问题仍然存在，请将以上输出发送给开发者');
  console.log('\n🔧 快速测试: 尝试在控制台执行以下命令来临时增加底部间距:');
  console.log(`   statusBar.style.bottom = '20px'`);
})();
