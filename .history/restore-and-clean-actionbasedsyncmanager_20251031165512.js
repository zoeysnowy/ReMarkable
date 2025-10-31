const fs = require('fs');

// 使用history中2025-10-30的干净版本
const sourceFile = '.history/src/services/ActionBasedSyncManager_20251030152141.ts';
const targetFile = 'src/services/ActionBasedSyncManager.ts';

console.log('📥 从干净版本恢复ActionBasedSyncManager...');
console.log(`   源文件: ${sourceFile}`);
console.log(`   目标文件: ${targetFile}\n`);

// 使用UTF-8编码读取文件
let content = fs.readFileSync(sourceFile, 'utf8');

console.log('🧹 开始清理console.log并替换为syncLogger...\n');

// 检查是否已经有syncLogger导入
const hasSyncLogger = content.includes("import { logger } from '../utils/logger';") && 
                      content.includes("const syncLogger = logger.module('Sync');");

if (!hasSyncLogger) {
  // 查找import语句结束的位置
  const lines = content.split('\n');
  let insertIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('import ')) {
      insertIndex = i + 1;
    } else if (insertIndex !== -1 && lines[i].trim() === '') {
      // 找到import语句后的第一个空行
      break;
    }
  }
  
  if (insertIndex !== -1) {
    lines.splice(insertIndex, 0, "import { logger } from '../utils/logger';", '', "const syncLogger = logger.module('Sync');");
    content = lines.join('\n');
    console.log('✅ 添加了syncLogger导入和定义\n');
  }
}

// 统计
let replacedCount = 0;
const lines = content.split('\n');
const processedLines = [];

for (let i = 0; i < lines.length; i++) {
  let line = lines[i];
  const lineNum = i + 1;
  
  // 匹配console.log/warn/error
  const consoleMatch = line.match(/^(\s*)console\.(log|warn|error)\((.*)\);?\s*$/);
  
  if (consoleMatch) {
    const indent = consoleMatch[1];
    const logType = consoleMatch[2];
    const args = consoleMatch[3];
    
    // 替换为syncLogger
    line = `${indent}syncLogger.${logType}(${args});`;
    
    replacedCount++;
    console.log(`🔄 第${lineNum}行: console.${logType} -> syncLogger.${logType}`);
  }
  
  processedLines.push(line);
}

const newContent = processedLines.join('\n');

// 使用UTF-8编码写入文件
fs.writeFileSync(targetFile, newContent, 'utf8');

console.log('\n📊 处理完成:');
console.log(`   ✅ 成功替换了 ${replacedCount} 个console调用`);
console.log(`   📝 文件已保存为UTF-8编码: ${targetFile}`);
console.log('\n✨ 全部完成！ActionBasedSyncManager已恢复并清理完毕！');
