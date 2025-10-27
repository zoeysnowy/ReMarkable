/**
 * StatusBar 高度稳定性测试脚本
 * 在浏览器控制台运行此脚本，监控窗口调整时 StatusBar 的高度变化
 */

(function() {
  console.log('🔍 开始监控 StatusBar 高度稳定性...\n');

  // 1. 查找 StatusBar 元素
  const statusBar = document.querySelector('.app-statusbar');
  
  if (!statusBar) {
    console.error('❌ 未找到 StatusBar 元素');
    return;
  }
  
  console.log('✅ 找到 StatusBar 元素\n');

  // 2. 记录初始状态
  const initialHeight = statusBar.offsetHeight;
  const initialComputed = window.getComputedStyle(statusBar);
  
  console.log('📏 初始状态:');
  console.log(`   - offsetHeight: ${initialHeight}px`);
  console.log(`   - height: ${initialComputed.height}`);
  console.log(`   - min-height: ${initialComputed.minHeight}`);
  console.log(`   - max-height: ${initialComputed.maxHeight}`);
  console.log(`   - box-sizing: ${initialComputed.boxSizing}`);
  console.log(`   - overflow: ${initialComputed.overflow}\n`);

  // 3. 监控高度变化
  let heightHistory = [initialHeight];
  let checkCount = 0;
  const maxChecks = 100; // 监控 10 秒
  
  console.log('🎯 开始监控（10秒）...\n');
  
  const monitorInterval = setInterval(() => {
    checkCount++;
    const currentHeight = statusBar.offsetHeight;
    
    // 记录高度变化
    if (currentHeight !== heightHistory[heightHistory.length - 1]) {
      heightHistory.push(currentHeight);
      const timestamp = new Date().toLocaleTimeString();
      console.warn(`⚠️ [${timestamp}] 高度变化: ${heightHistory[heightHistory.length - 2]}px → ${currentHeight}px`);
      
      // 打印当前样式
      const computed = window.getComputedStyle(statusBar);
      console.log(`   当前样式:`);
      console.log(`   - height: ${computed.height}`);
      console.log(`   - min-height: ${computed.minHeight}`);
      console.log(`   - max-height: ${computed.maxHeight}`);
      console.log(`   - line-height: ${computed.lineHeight}`);
    }
    
    // 停止监控
    if (checkCount >= maxChecks) {
      clearInterval(monitorInterval);
      
      console.log('\n📊 监控完成！\n');
      console.log('统计结果:');
      console.log(`   - 总检查次数: ${checkCount}`);
      console.log(`   - 高度变化次数: ${heightHistory.length - 1}`);
      console.log(`   - 高度历史: ${heightHistory.join('px → ')}px`);
      
      if (heightHistory.length === 1) {
        console.log('\n✅ 太好了！StatusBar 高度完全稳定，没有任何变化！');
      } else {
        console.log('\n⚠️ StatusBar 高度发生了变化，可能需要进一步调查。');
        console.log('💡 请尝试调整窗口大小，观察高度是否变化。');
      }
    }
  }, 100); // 每 100ms 检查一次

  // 4. 窗口调整监听
  let resizeCount = 0;
  const handleResize = () => {
    resizeCount++;
    const currentHeight = statusBar.offsetHeight;
    console.log(`🔄 窗口调整 #${resizeCount}: StatusBar 高度 = ${currentHeight}px`);
  };
  
  window.addEventListener('resize', handleResize);
  
  // 5. 测试建议
  console.log('💡 测试建议:');
  console.log('   1. 缓慢调整窗口大小（水平和垂直）');
  console.log('   2. 快速最大化/还原窗口');
  console.log('   3. 观察控制台是否有高度变化警告');
  console.log('   4. 10秒后查看统计结果\n');
  
  // 6. 清理函数
  setTimeout(() => {
    window.removeEventListener('resize', handleResize);
    console.log('🧹 监控已停止，事件监听器已清理。');
  }, 10000);

  // 7. 检查可能的问题
  console.log('🔍 潜在问题检查:\n');
  
  // 检查内部元素
  const statusContent = statusBar.querySelector('.status-content');
  if (statusContent) {
    const contentComputed = window.getComputedStyle(statusContent);
    console.log('   status-content:');
    console.log(`   - height: ${contentComputed.height}`);
    console.log(`   - min-height: ${contentComputed.minHeight}`);
    console.log(`   - max-height: ${contentComputed.maxHeight}`);
  }
  
  // 检查文本元素
  const statusText = statusBar.querySelector('.status-text');
  if (statusText) {
    const textComputed = window.getComputedStyle(statusText);
    console.log('\n   status-text:');
    console.log(`   - font-size: ${textComputed.fontSize}`);
    console.log(`   - line-height: ${textComputed.lineHeight}`);
    console.log(`   - white-space: ${textComputed.whiteSpace}`);
  }
  
  console.log('\n---\n');

})();
