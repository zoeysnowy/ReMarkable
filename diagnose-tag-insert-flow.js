/**
 * 诊断 Tag 插入流程中的光标位置变化
 * 
 * 使用方法：
 * 1. 在浏览器控制台粘贴此脚本
 * 2. 脚本会自动 hook insertTag 和 normalizeNode
 * 3. 插入一个 Tag
 * 4. 查看控制台输出，分析光标位置变化
 */

(function() {
  console.log('%c========================================', 'color: #2196F3; font-weight: bold;');
  console.log('%c  Tag 插入流程诊断脚本', 'color: #2196F3; font-weight: bold; font-size: 16px;');
  console.log('%c========================================', 'color: #2196F3; font-weight: bold;');
  console.log('');

  let insertSequence = [];
  let normalizeSequence = [];

  // 监听 insertTag 日志
  const originalLog = console.log;
  console.log = function(...args) {
    const message = args[0];
    
    if (typeof message === 'string') {
      // 捕获 insertTag 日志
      if (message.includes('[insertTag]')) {
        const timestamp = new Date().toLocaleTimeString();
        insertSequence.push({ timestamp, message, args: args.slice(1) });
      }
      
      // 捕获 normalizeNode 日志
      if (message.includes('[normalizeNode]')) {
        const timestamp = new Date().toLocaleTimeString();
        normalizeSequence.push({ timestamp, message, args: args.slice(1) });
      }
    }
    
    originalLog.apply(console, args);
  };

  // 监听 Slate selection 变化
  let selectionHistory = [];
  
  window.trackTagInsert = function() {
    console.group('%c 开始追踪 Tag 插入', 'background: #4CAF50; color: white; padding: 4px 8px; font-weight: bold;');
    
    insertSequence = [];
    normalizeSequence = [];
    selectionHistory = [];
    
    console.log('请插入一个 Tag（双击 Alt → 1 → 选择标签）');
    console.log('插入完成后，运行 window.showTagInsertReport() 查看报告');
    
    console.groupEnd();
  };

  window.showTagInsertReport = function() {
    console.group('%c Tag 插入流程报告', 'background: #2196F3; color: white; padding: 4px 8px; font-weight: bold;');
    
    console.group('%c insertTag 调用序列', 'color: #FF9800; font-weight: bold;');
    if (insertSequence.length === 0) {
      console.log('❌ 未捕获到 insertTag 调用');
    } else {
      insertSequence.forEach((entry, index) => {
        console.log(`${index + 1}. [${entry.timestamp}] ${entry.message}`);
        if (entry.args.length > 0) {
          console.log('   参数:', entry.args);
        }
      });
    }
    console.groupEnd();
    
    console.group('%c normalizeNode 调用序列', 'color: #9C27B0; font-weight: bold;');
    if (normalizeSequence.length === 0) {
      console.log('✅ 未触发 normalizeNode（可能被 withoutNormalizing 阻止）');
    } else {
      normalizeSequence.forEach((entry, index) => {
        console.log(`${index + 1}. [${entry.timestamp}] ${entry.message}`);
        if (entry.args.length > 0) {
          console.log('   参数:', entry.args);
        }
      });
    }
    console.groupEnd();
    
    console.group('%c 光标位置分析', 'color: #F44336; font-weight: bold;');
    
    // 从 insertTag 日志中提取光标位置
    const selectionLogs = insertSequence.filter(e => 
      e.message.includes('selection:') || e.message.includes('selection')
    );
    
    if (selectionLogs.length === 0) {
      console.warn('未找到光标位置日志');
    } else {
      selectionLogs.forEach((entry, index) => {
        console.log(`${index + 1}. ${entry.message}`);
        if (entry.args[0]) {
          try {
            const selection = typeof entry.args[0] === 'string' 
              ? JSON.parse(entry.args[0]) 
              : entry.args[0];
            console.log('   Anchor:', selection?.anchor);
            console.log('   Focus:', selection?.focus);
          } catch (e) {
            console.log('   原始数据:', entry.args[0]);
          }
        }
      });
    }
    
    console.groupEnd();
    
    console.group('%c 问题诊断', 'color: #FF5722; font-weight: bold;');
    
    // 分析是否有光标跳动
    const normalizeMovedCursor = normalizeSequence.some(e => 
      e.message.includes('光标已移动') || e.message.includes('移动光标')
    );
    
    if (normalizeMovedCursor) {
      console.warn('⚠️ normalizeNode 移动了光标位置');
      console.log('可能原因：');
      console.log('  1. insertTag 插入空格后，normalizeNode 又检测到需要插入空格');
      console.log('  2. shouldMoveToSpace 逻辑判断错误');
      console.log('建议：检查 normalizeNode 的 shouldMoveToSpace 条件');
    } else if (normalizeSequence.length > 0) {
      console.log('ℹ️ normalizeNode 运行了，但没有移动光标');
    } else {
      console.log('✅ normalizeNode 未运行（被 withoutNormalizing 阻止）');
    }
    
    console.groupEnd();
    
    console.group('%c 建议', 'color: #4CAF50; font-weight: bold;');
    
    if (normalizeMovedCursor) {
      console.log('1. 检查 insertTag 中的 Editor.withoutNormalizing 是否生效');
      console.log('2. 检查 normalizeNode 的 shouldMoveToSpace 条件是否过于宽松');
      console.log('3. 考虑在 insertTag 完成后禁用一次 normalizeNode');
    } else {
      console.log('✅ 插入流程正常，光标位置应该正确');
    }
    
    console.groupEnd();
    
    console.groupEnd();
  };

  // 自动开始追踪
  window.trackTagInsert();

  console.log('%c可用命令:', 'color: #4CAF50; font-weight: bold;');
  console.log('  window.trackTagInsert()      - 重新开始追踪');
  console.log('  window.showTagInsertReport() - 显示插入流程报告');
  console.log('');
})();
