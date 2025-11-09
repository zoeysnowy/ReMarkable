/**
 * 诊断删除事件的性能问题
 * 
 * 在浏览器控制台运行此脚本：
 * 1. 打开开发者工具
 * 2. 粘贴此脚本并运行
 * 3. 删除一个事件
 * 4. 查看性能报告
 */

(function() {
  console.log('🔧 [Diagnostic] Installing delete performance monitor...');
  
  // 原始的 localStorage.setItem
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalGetItem = localStorage.getItem.bind(localStorage);
  
  // 监控 localStorage 操作
  localStorage.setItem = function(key, value) {
    if (key === 'remarkable-events') {
      const start = performance.now();
      const eventCount = value ? JSON.parse(value).length : 0;
      const sizeKB = (value.length / 1024).toFixed(2);
      
      originalSetItem(key, value);
      
      const duration = performance.now() - start;
      
      console.log(`📊 [localStorage.setItem] ${key}`);
      console.log(`   - 事件数量: ${eventCount}`);
      console.log(`   - 数据大小: ${sizeKB} KB`);
      console.log(`   - 耗时: ${duration.toFixed(2)}ms`);
      
      if (duration > 50) {
        console.warn(`⚠️ localStorage.setItem 耗时过长！${duration.toFixed(2)}ms`);
      }
    } else {
      originalSetItem(key, value);
    }
  };
  
  localStorage.getItem = function(key) {
    if (key === 'remarkable-events') {
      const start = performance.now();
      const value = originalGetItem(key);
      const duration = performance.now() - start;
      
      if (value) {
        const eventCount = JSON.parse(value).length;
        const sizeKB = (value.length / 1024).toFixed(2);
        
        console.log(`📊 [localStorage.getItem] ${key}`);
        console.log(`   - 事件数量: ${eventCount}`);
        console.log(`   - 数据大小: ${sizeKB} KB`);
        console.log(`   - 耗时: ${duration.toFixed(2)}ms`);
        
        if (duration > 20) {
          console.warn(`⚠️ localStorage.getItem 耗时过长！${duration.toFixed(2)}ms`);
        }
      }
      
      return value;
    } else {
      return originalGetItem(key);
    }
  };
  
  console.log('✅ [Diagnostic] Monitor installed. Delete an event to see performance data.');
  console.log('💡 Tip: Look for warnings about slow operations.');
})();
