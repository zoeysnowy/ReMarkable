/**
 * 调试时间格式错误
 * 
 * 拦截 console.error 来捕获完整的错误堆栈
 */

(function() {
  console.log('='.repeat(80));
  console.log('🔍 开始监听时间格式错误');
  console.log('='.repeat(80));
  
  const originalError = console.error;
  
  console.error = function(...args) {
    // 检查是否是时间格式错误
    const message = args.join(' ');
    if (message.includes('Invalid time format') || message.includes('YYYY-MM-DD HH:mm:ss')) {
      console.log('\n' + '='.repeat(80));
      console.log('🚨 捕获到时间格式错误！');
      console.log('='.repeat(80));
      console.log('完整消息:', ...args);
      console.log('\n堆栈追踪:');
      console.trace();
      console.log('='.repeat(80) + '\n');
    }
    
    // 调用原始 console.error
    originalError.apply(console, args);
  };
  
  console.log('✅ 监听已启用！现在执行会触发错误的操作（例如保存事件），错误会被捕获并显示完整堆栈。');
  console.log('提示：要停止监听，刷新页面即可。\n');
})();
