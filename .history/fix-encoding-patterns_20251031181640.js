const fs = require('fs');
const path = require('path');

// 已知的乱码模式和修复映射
const encodingFixes = [
  // Emoji相关乱码
  { pattern: /�🔍/g, replacement: '🔍' },
  { pattern: /� \[NEW\]/g, replacement: '📝 [NEW]' },
  { pattern: /� 更新失败统计/g, replacement: '📊 更新失败统计' },
  { pattern: /�🔧/g, replacement: '🔧' },
  { pattern: /� \[PRIORITY 3\]/g, replacement: '📝 [PRIORITY 3]' },
  { pattern: /� 文本字段处理/g, replacement: '📝 文本字段处理' },
  { pattern: /� \[SIMPLIFIED\]/g, replacement: '📝 [SIMPLIFIED]' },
  { pattern: /� \[IndexMap/g, replacement: '📝 [IndexMap' },
  { pattern: /�🚀/g, replacement: '🚀' },
  { pattern: /� \[FIX\]/g, replacement: '🔧 [FIX]' },
  { pattern: /� 立即切换到时间页面/g, replacement: '✅ 立即切换到时间页面' },
  { pattern: /�🔄/g, replacement: '🔄' },
  { pattern: /� Widget专用/g, replacement: '🔧 Widget专用' },
  { pattern: /�📋/g, replacement: '📋' },
  { pattern: /� 触发全局事件/g, replacement: '🔔 触发全局事件' },
  { pattern: /� 不等待返回/g, replacement: '⚡ 不等待返回' },
  { pattern: /� 暂时禁用懒加载/g, replacement: '⚠️ 暂时禁用懒加载' },
  { pattern: /� \[Timer/g, replacement: '⏱️ [Timer' },
  { pattern: /� 如果将来需要/g, replacement: '💡 如果将来需要' },
  { pattern: /� 不触发 eventsUpdated/g, replacement: '⚡ 不触发 eventsUpdated' },
  
  // 中文注释乱码
  { pattern: /绗竴娆℃湭鎵惧埌鐨勮疆娆?/g, replacement: '第一次未找到的轮次' },
  { pattern: /绗竴娆℃湭鎵惧埌鐨勬椂闂?/g, replacement: '第一次未找到的时间' },
  { pattern: /鏈€鍚庢鏌ョ殑杞/g, replacement: '最后检查的轮次' },
  { pattern: /鏈€鍚庢鏌ョ殑鏃堕棿/g, replacement: '最后检查的时间' },
  { pattern: /鍚屾杞璁℃暟鍣?/g, replacement: '同步轮次计数器' },
  { pattern: /鍚屾缁熻淇℃伅/g, replacement: '同步统计信息' },
  { pattern: /鍚屾鑷虫棩鍘嗗け璐?/g, replacement: '同步至日历失败' },
  { pattern: /鏂板鏃ュ巻浜嬮」/g, replacement: '新增日历事项' },
  { pattern: /鎴愬姛鍚屾鑷虫棩鍘?/g, replacement: '成功同步至日历' },
  { pattern: /鍔犺浇宸插垹闄や簨浠禝D/g, replacement: '加载已删除事件ID' },
];

function fixEncodingInFile(filePath) {
  try {
    console.log(`\n修复文件: ${filePath}`);
    let content = fs.readFileSync(filePath, 'utf-8');
    let changeCount = 0;
    
    encodingFixes.forEach(fix => {
      const matches = content.match(fix.pattern);
      if (matches) {
        changeCount += matches.length;
        content = content.replace(fix.pattern, fix.replacement);
        console.log(`  替换 "${fix.pattern}" -> "${fix.replacement}": ${matches.length}次`);
      }
    });
    
    if (changeCount > 0) {
      fs.writeFileSync(filePath, content, 'utf-8');
      console.log(`✅ 总计修复 ${changeCount} 处乱码`);
      return changeCount;
    } else {
      console.log('  没有发现需要修复的乱码');
      return 0;
    }
  } catch (error) {
    console.error(`❌ 修复失败: ${error.message}`);
    return 0;
  }
}

// 要修复的文件列表
const filesToFix = [
  'src/services/ActionBasedSyncManager.ts',
];

console.log('开始修复已知编码问题...\n');
let totalFixes = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  if (fs.existsSync(fullPath)) {
    totalFixes += fixEncodingInFile(fullPath);
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

console.log(`\n修复完成！总计修复 ${totalFixes} 处乱码`);
