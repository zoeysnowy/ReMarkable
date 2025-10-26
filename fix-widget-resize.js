/**
 * 恢复 Widget 窗口 Resize 功能的应急脚本
 * 在 Widget 窗口的浏览器控制台运行此脚本
 */

(async function() {
  console.log('🔧 开始恢复 Widget Resize 功能...\n');
  
  try {
    // 调用主进程强制恢复 resizable
    const result = await window.api.invoke('widget-force-resizable');
    
    if (result.success) {
      console.log('✅ 成功恢复 Resize 功能！');
      console.log('   - 之前状态:', result.wasResizable ? '可调整' : '已禁用');
      console.log('   - 当前状态:', result.nowResizable ? '可调整' : '已禁用');
      console.log('\n💡 现在尝试调整窗口大小，应该可以看到调整手型了！');
    } else {
      console.error('❌ 恢复失败:', result.error);
    }
  } catch (error) {
    console.error('❌ 调用失败:', error);
    console.log('\n💡 提示: 确保你在 Widget 窗口中运行此脚本');
  }
})();
