/**
 * 快速验证脚本 - 确认Storage Key配置正确
 * 
 * 使用方法：
 * 1. 打开浏览器控制台
 * 2. 复制整个脚本
 * 3. 粘贴并回车执行
 */

(function verifyStorageKeys() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 Storage Key 验证工具');
  console.log('='.repeat(80));
  console.log('');

  // 检查所有可能的 localStorage keys
  const allKeys = Object.keys(localStorage);
  
  console.log('📋 检查 localStorage 中的所有键:');
  console.log('');
  
  const relevantKeys = allKeys.filter(key => 
    key.includes('remarkable') || 
    key.includes('sync') || 
    key.includes('action')
  );
  
  if (relevantKeys.length === 0) {
    console.warn('⚠️ 没有找到相关的 localStorage 键');
    return;
  }

  relevantKeys.forEach(key => {
    const value = localStorage.getItem(key);
    let itemCount = 0;
    
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        itemCount = parsed.length;
      }
    } catch (e) {
      // Not JSON or not an array
    }
    
    const isEventsKey = key.includes('event');
    const isSyncKey = key.includes('sync') || key.includes('action');
    
    const icon = isEventsKey ? '📅' : isSyncKey ? '🔄' : '📝';
    
    console.log(`${icon} ${key}`);
    if (itemCount > 0) {
      console.log(`   项目数: ${itemCount}`);
    }
    console.log('');
  });

  // 检查正确的 key 是否存在
  console.log('='.repeat(80));
  console.log('🎯 检查正确的 Storage Keys:');
  console.log('');

  const correctKeys = {
    EVENTS: 'remarkable-events',
    SYNC_ACTIONS: 'remarkable-sync-actions'
  };

  Object.entries(correctKeys).forEach(([name, key]) => {
    const exists = localStorage.getItem(key) !== null;
    const icon = exists ? '✅' : '❌';
    
    console.log(`${icon} ${name}: "${key}"`);
    
    if (exists) {
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(data)) {
          console.log(`   ✓ 找到 ${data.length} 个项目`);
        }
      } catch (e) {
        console.log(`   ⚠️ 无法解析 JSON`);
      }
    } else {
      console.log(`   ✗ 不存在`);
    }
    console.log('');
  });

  // 检查错误的旧 key
  console.log('='.repeat(80));
  console.log('⚠️ 检查可能存在的错误 Keys:');
  console.log('');

  const wrongKeys = [
    'remarkable-dev-persistent-syncActions',
    'remarkable-dev-syncActions',
    'syncActions'
  ];

  let foundWrongKeys = false;
  wrongKeys.forEach(key => {
    const exists = localStorage.getItem(key) !== null;
    if (exists) {
      foundWrongKeys = true;
      console.log(`❌ 发现错误的 key: "${key}"`);
      
      try {
        const data = JSON.parse(localStorage.getItem(key));
        if (Array.isArray(data)) {
          console.log(`   包含 ${data.length} 个项目（应该迁移到正确的 key）`);
        }
      } catch (e) {
        // Ignore
      }
      console.log('');
    }
  });

  if (!foundWrongKeys) {
    console.log('✅ 没有发现错误的 Storage Keys');
    console.log('');
  }

  // 显示测试脚本使用的正确配置
  console.log('='.repeat(80));
  console.log('📝 测试脚本应使用的配置:');
  console.log('');
  console.log('```javascript');
  console.log('const STORAGE_KEYS = {');
  console.log(`  EVENTS: '${correctKeys.EVENTS}',`);
  console.log(`  SYNC_ACTIONS: '${correctKeys.SYNC_ACTIONS}'`);
  console.log('};');
  console.log('```');
  console.log('');

  // 提供清理建议
  if (foundWrongKeys) {
    console.log('='.repeat(80));
    console.log('🧹 清理建议:');
    console.log('');
    console.log('如果你想清理错误的 keys，运行:');
    console.log('');
    wrongKeys.forEach(key => {
      console.log(`localStorage.removeItem('${key}');`);
    });
    console.log('');
  }

  console.log('='.repeat(80));
  console.log('✅ 验证完成');
  console.log('='.repeat(80));
})();
