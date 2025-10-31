const fs = require('fs');
const path = require('path');

// 分类规则
const KEEP_PATTERNS = [
  /console\.error/,  // 保留所有 error
  /console\.warn.*Failed to/i,  // 保留失败相关的 warn
  /console\.warn.*Invalid/i,  // 保留验证失败的 warn
];

const REMOVE_PATTERNS = [
  /console\.log/,  // 删除所有 log
  /console\.warn(?!.*Failed to)(?!.*Invalid)/,  // 删除非关键的 warn
];

// 需要检查的文件
const filesToAnalyze = [
  'src/services/ActionBasedSyncManager.ts',
  'src/services/MicrosoftCalendarService.ts',
  'src/components/EventEditModal.tsx',
  'src/components/FloatingToolbar/HeadlessFloatingToolbar.tsx',
  'src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.tsx',
  'src/components/FloatingToolbar/pickers/CleanDateTimeRangePicker.tsx',
  'src/components/FloatingToolbar/pickers/SimpleDateTimeRangePicker.tsx',
  'src/components/FloatingToolbar/pickers/UltimateDateTimeRangePicker.tsx',
  'src/components/PlanManager.tsx',
  'src/components/TimerCard.tsx',
  'src/components/TimeCalendar.tsx',
  'src/components/MultiLineEditor/MultiLineEditor.tsx',
  'src/components/MultiLineEditor/hooks/useKeyboardNav.ts',
  'src/components/MultiLineEditor/hooks/useIndentManager.ts',
  'src/components/MultiLineEditor/hooks/useBatchOperations.ts',
  'src/pages/DesktopCalendarWidget.tsx',
  'src/utils/calendarUtils.ts',
  'src/utils/timeUtils.ts',
  'src/utils/persistentStorage.ts',
  'src/services/TagService.ts',
  'src/services/snapshotService.ts',
  'src/constants/storage.ts',
];

function analyzeFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return { keep: 0, remove: 0, total: 0 };
  }

  const content = fs.readFileSync(fullPath, 'utf-8');
  const lines = content.split('\n');
  
  let keepCount = 0;
  let removeCount = 0;
  let totalConsole = 0;
  
  const toKeep = [];
  const toRemove = [];
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // 检测 console 调用
    if (/^\s*console\.(log|warn|error|debug|info)/.test(line)) {
      totalConsole++;
      
      // 判断是否应该保留
      const shouldKeep = KEEP_PATTERNS.some(pattern => pattern.test(line));
      
      if (shouldKeep) {
        keepCount++;
        toKeep.push({ lineNum, content: line.trim() });
      } else {
        removeCount++;
        toRemove.push({ lineNum, content: line.trim() });
      }
    }
  });
  
  return {
    filePath,
    keep: keepCount,
    remove: removeCount,
    total: totalConsole,
    toKeep,
    toRemove
  };
}

console.log('🔍 分析代码中的 console 日志...\n');
console.log('📋 分类规则:');
console.log('  ✅ 保留: console.error 和关键的 console.warn (Failed/Invalid)');
console.log('  ❌ 删除: console.log 和非关键的 console.warn\n');
console.log('━'.repeat(80));

let totalKeep = 0;
let totalRemove = 0;
let totalAll = 0;

const results = [];

filesToAnalyze.forEach(filePath => {
  const result = analyzeFile(filePath);
  if (result.total > 0) {
    results.push(result);
    totalKeep += result.keep;
    totalRemove += result.remove;
    totalAll += result.total;
    
    console.log(`\n📄 ${filePath}`);
    console.log(`   总计: ${result.total} | 保留: ${result.keep} | 删除: ${result.remove}`);
    
    if (result.remove > 0) {
      console.log('   ❌ 将删除的日志:');
      result.toRemove.slice(0, 3).forEach(item => {
        console.log(`      行 ${item.lineNum}: ${item.content.substring(0, 80)}...`);
      });
      if (result.toRemove.length > 3) {
        console.log(`      ... 还有 ${result.toRemove.length - 3} 条`);
      }
    }
  }
});

console.log('\n' + '━'.repeat(80));
console.log('\n📊 统计汇总:');
console.log(`   总计 console 调用: ${totalAll}`);
console.log(`   ✅ 保留 (错误处理): ${totalKeep}`);
console.log(`   ❌ 删除 (调试日志): ${totalRemove}`);
console.log(`   清理比例: ${((totalRemove / totalAll) * 100).toFixed(1)}%\n`);

// 保存分析结果到文件
const reportPath = path.join(__dirname, 'console-cleanup-report.json');
fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
console.log(`📝 详细报告已保存到: console-cleanup-report.json`);
