/**
 * performSync 调用追踪工具
 * 
 * 功能：追踪所有 performSync() 调用的来源和调用栈
 */

(function tracePerformSyncCalls() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 performSync 调用追踪器');
  console.log('='.repeat(80));
  console.log('');
  
  const callRecords = [];
  let callCounter = 0;
  const startTime = Date.now();
  
  // 等待 syncManager 初始化
  const checkSyncManager = setInterval(() => {
    if (window.syncManager) {
      clearInterval(checkSyncManager);
      console.log('✅ SyncManager 已就绪，开始追踪 performSync 调用\n');
      
      const sm = window.syncManager;
      const originalPerformSync = sm.performSync.bind(sm);
      
      sm.performSync = async function(...args) {
        callCounter++;
        const callId = callCounter;
        const timestamp = Date.now();
        const relativeTime = timestamp - startTime;
        
        // 捕获调用栈
        const stack = new Error().stack;
        const stackLines = stack.split('\n').slice(2, 8); // 去掉 Error 和当前行
        
        const record = {
          callId,
          timestamp,
          relativeTime,
          relativeSeconds: (relativeTime / 1000).toFixed(1),
          stack: stackLines,
          duration: null
        };
        
        callRecords.push(record);
        
        // 打印调用信息
        console.log(`\n${'='.repeat(80)}`);
        console.log(`🔄 performSync 调用 #${callId}`);
        console.log(`⏰ 时间: ${new Date(timestamp).toLocaleTimeString('zh-CN')} (+${record.relativeSeconds}秒)`);
        console.log(`📍 调用栈:`);
        stackLines.forEach((line, i) => {
          console.log(`   ${i + 1}. ${line.trim()}`);
        });
        console.log(`${'='.repeat(80)}\n`);
        
        // 执行原始方法
        const start = Date.now();
        try {
          const result = await originalPerformSync(...args);
          record.duration = Date.now() - start;
          console.log(`✅ performSync #${callId} 完成，耗时: ${record.duration}ms\n`);
          return result;
        } catch (error) {
          record.duration = Date.now() - start;
          record.error = String(error);
          console.error(`❌ performSync #${callId} 失败，耗时: ${record.duration}ms`, error);
          throw error;
        }
      };
      
      // 暴露报告函数
      window.syncCallTracer = {
        getRecords: () => callRecords,
        generateReport: () => {
          console.log('\n' + '='.repeat(80));
          console.log('📊 performSync 调用报告');
          console.log('='.repeat(80));
          console.log(`\n总调用次数: ${callCounter}`);
          console.log(`追踪时长: ${((Date.now() - startTime) / 1000).toFixed(1)}秒\n`);
          
          console.log('详细记录:');
          callRecords.forEach((record, index) => {
            console.log(`\n第 ${record.callId} 次调用:`);
            console.log(`  时间: +${record.relativeSeconds}秒`);
            console.log(`  耗时: ${record.duration}ms`);
            console.log(`  调用来源:`);
            
            // 分析调用来源
            const stackText = record.stack.join(' ');
            let source = '未知';
            
            if (stackText.includes('setTimeout') || stackText.includes('Executing delayed initial sync')) {
              source = '⏰ start() 的 5秒延迟首次同步';
            } else if (stackText.includes('setInterval') || stackText.includes('Skipping scheduled sync')) {
              source = '⏰ 20秒定时器';
            } else if (stackText.includes('triggerSyncAfterOnline') || stackText.includes('online')) {
              source = '🌐 网络恢复触发';
            } else if (stackText.includes('handleConnect') || stackText.includes('CalendarSync')) {
              source = '👆 用户点击连接按钮';
            } else if (stackText.includes('onSettingsChange')) {
              source = '⚙️ 设置变化触发';
            }
            
            console.log(`    → ${source}`);
            console.log(`  调用栈片段:`);
            record.stack.slice(0, 3).forEach(line => {
              console.log(`    ${line.trim()}`);
            });
          });
          
          console.log('\n' + '='.repeat(80));
          console.log('✅ 报告生成完成');
          console.log('='.repeat(80) + '\n');
          
          return callRecords;
        }
      };
      
      console.log('✅ 追踪器已启动');
      console.log('\n💡 使用方法:');
      console.log('   执行测试操作后，运行:');
      console.log('   window.syncCallTracer.generateReport()');
      console.log('\n' + '='.repeat(80) + '\n');
    }
  }, 100);
})();
