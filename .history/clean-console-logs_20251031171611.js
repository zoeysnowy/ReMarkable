const fs = require('fs');
const path = require('path');

// 保留规则：只保留错误处理相关的 console
const KEEP_PATTERNS = [
  /console\.error/,  // 保留所有 error
  /console\.warn.*Failed to/i,  // 保留失败相关的 warn
  /console\.warn.*Invalid/i,  // 保留验证失败的 warn
];

// 需要清理的文件（从分析报告中提取，有调试日志的文件）
const filesToClean = [
  { path: 'src/services/ActionBasedSyncManager.ts', remove: 39 },
  { path: 'src/services/MicrosoftCalendarService.ts', remove: 7 },
  { path: 'src/components/EventEditModal.tsx', remove: 7 },
  { path: 'src/components/FloatingToolbar/HeadlessFloatingToolbar.tsx', remove: 7 },
  { path: 'src/components/FloatingToolbar/pickers/UnifiedDateTimePicker.tsx', remove: 15 },
  { path: 'src/components/PlanManager.tsx', remove: 12 },
  { path: 'src/components/TimerCard.tsx', remove: 1 },
  { path: 'src/components/TimeCalendar.tsx', remove: 120 },
  { path: 'src/components/MultiLineEditor/MultiLineEditor.tsx', remove: 4 },
  { path: 'src/components/MultiLineEditor/hooks/useKeyboardNav.ts', remove: 4 },
  { path: 'src/components/MultiLineEditor/hooks/useIndentManager.ts', remove: 8 },
  { path: 'src/components/MultiLineEditor/hooks/useBatchOperations.ts', remove: 3 },
  { path: 'src/pages/DesktopCalendarWidget.tsx', remove: 6 },
  { path: 'src/utils/timeUtils.ts', remove: 1 },
  { path: 'src/utils/persistentStorage.ts', remove: 1 },
  { path: 'src/services/TagService.ts', remove: 10 },
  { path: 'src/services/snapshotService.ts', remove: 5 },
  { path: 'src/constants/storage.ts', remove: 8 },
];

function shouldKeepLine(line) {
  // 不是 console 调用，保留
  if (!/^\s*console\.(log|warn|error|debug|info)/.test(line)) {
    return true;
  }
  
  // 检查是否匹配保留模式
  return KEEP_PATTERNS.some(pattern => pattern.test(line));
}

function cleanFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️  跳过不存在的文件: ${filePath}`);
    return { removed: 0, kept: 0, error: 'File not found' };
  }
  
  try {
    // 明确使用 UTF-8 编码读取
    const content = fs.readFileSync(fullPath, { encoding: 'utf-8' });
    const lines = content.split('\n');
    const newLines = [];
    let removedCount = 0;
    let keptCount = 0;
    
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      
      // 检测到 console 调用
      if (/^\s*console\.(log|warn|error|debug|info)/.test(line)) {
        if (shouldKeepLine(line)) {
          // 保留这行及其后续的多行参数
          newLines.push(line);
          keptCount++;
          
          // 处理多行 console 调用（以 } 或 ); 结尾才是完整的）
          if (!line.trim().endsWith(');') && !line.trim().endsWith('}')) {
            i++;
            while (i < lines.length) {
              const nextLine = lines[i];
              newLines.push(nextLine);
              
              // 找到结束符号
              if (nextLine.trim().endsWith(');') || nextLine.trim() === '}') {
                break;
              }
              i++;
            }
          }
        } else {
          // 删除这行及其后续的多行参数
          removedCount++;
          
          // 跳过多行 console 调用的所有行
          if (!line.trim().endsWith(');') && !line.trim().endsWith('}')) {
            i++;
            while (i < lines.length) {
              const nextLine = lines[i];
              
              // 找到结束符号后跳出
              if (nextLine.trim().endsWith(');') || nextLine.trim() === '}') {
                break;
              }
              i++;
            }
          }
        }
      } else {
        // 非 console 调用，直接保留
        newLines.push(line);
      }
      
      i++;
    }
    
    // 明确使用 UTF-8 编码写回文件
    fs.writeFileSync(fullPath, newLines.join('\n'), { encoding: 'utf-8' });
    
    return { removed: removedCount, kept: keptCount };
  } catch (error) {
    console.error(`❌ 处理文件失败: ${filePath}`, error.message);
    return { removed: 0, kept: 0, error: error.message };
  }
}

console.log('🧹 开始清理调试日志...\n');
console.log('规则: 保留 console.error 和关键的 console.warn，删除所有 console.log 和非关键 console.warn\n');
console.log('━'.repeat(80));

let totalRemoved = 0;
let totalKept = 0;
let filesProcessed = 0;

filesToClean.forEach(file => {
  console.log(`\n📄 处理: ${file.path}`);
  console.log(`   预计删除: ${file.remove} 条`);
  
  const result = cleanFile(file.path);
  
  if (result.error) {
    console.log(`   ❌ 失败: ${result.error}`);
  } else {
    totalRemoved += result.removed;
    totalKept += result.kept;
    filesProcessed++;
    
    console.log(`   ✅ 完成: 删除 ${result.removed} 条，保留 ${result.kept} 条`);
  }
});

console.log('\n' + '━'.repeat(80));
console.log('\n📊 清理统计:');
console.log(`   处理文件: ${filesProcessed}`);
console.log(`   ✅ 保留 console: ${totalKept} 条`);
console.log(`   🗑️  删除 console: ${totalRemoved} 条`);
console.log('\n✨ 清理完成！代码更干净了。\n');
