const fs = require('fs');
const path = require('path');

// 使用history中2025-10-30的干净版本
const sourceFile = '.history/src/services/MicrosoftCalendarService_20251030152957.ts';
const targetFile = 'src/services/MicrosoftCalendarService.ts';

console.log('📥 从干净版本恢复文件...');
console.log(`   源文件: ${sourceFile}`);
console.log(`   目标文件: ${targetFile}\n`);

// 使用UTF-8编码读取文件
let content = fs.readFileSync(sourceFile, 'utf8');

console.log('🧹 开始清理console.log并替换为logger...\n');

// 添加logger导入（如果还没有）
if (!content.includes("import { logger } from '../utils/logger';")) {
  content = content.replace(
    "import { STORAGE_KEYS } from '../constants/storage';",
    "import { STORAGE_KEYS } from '../constants/storage';\n\nimport { logger } from '../utils/logger';\n\nconst MSCalendarLogger = logger.module('MSCalendar');"
  );
  console.log('✅ 添加了logger导入和MSCalendarLogger定义\n');
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
    
    // 替换为MSCalendarLogger
    line = `${indent}MSCalendarLogger.${logType}(${args});`;
    
    replacedCount++;
    console.log(`🔄 第${lineNum}行: console.${logType} -> MSCalendarLogger.${logType}`);
  }
  
  processedLines.push(line);
}

const newContent = processedLines.join('\n');

// 使用UTF-8编码写入文件
fs.writeFileSync(targetFile, newContent, 'utf8');

console.log('\n📊 处理完成:');
console.log(`   ✅ 成功替换了 ${replacedCount} 个console调用`);
console.log(`   📝 文件已保存为UTF-8编码: ${targetFile}`);
console.log('\n✨ 全部完成！文件已恢复并清理完毕！');
