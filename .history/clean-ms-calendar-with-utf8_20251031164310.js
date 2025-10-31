const fs = require('fs');
const path = require('path');

const filePath = 'src/services/MicrosoftCalendarService.ts';

// 从git历史恢复文件
console.log('📥 从git历史恢复文件...');

// 读取临时文件（从git恢复的版本）
const tempFilePath = 'temp_ms_calendar.ts';
let content = fs.readFileSync(tempFilePath, 'utf8');

console.log('🧹 开始清理console.log并添加logger...\n');

// 添加logger导入
if (!content.includes("import { logger } from '../utils/logger';")) {
  content = content.replace(
    "import { STORAGE_KEYS } from '../constants/storage';",
    "import { STORAGE_KEYS } from '../constants/storage';\nimport { logger } from '../utils/logger';\n\nconst MSCalendarLogger = logger.module('MSCalendar');"
  );
  console.log('✅ 添加了logger导入');
}

// 统计处理情况
let replacedCount = 0;
let keptCount = 0;
const lines = content.split('\n');
const processedLines = [];

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const lineNum = i + 1;
  
  // 查找console.log/warn/error
  if (line.includes('console.log(') || line.includes('console.warn(') || line.includes('console.error(')) {
    // 提取缩进
    const indent = line.match(/^(\s*)/)[1];
    
    // 提取console类型和内容
    let logType = 'log';
    if (line.includes('console.warn(')) {
      logType = 'warn';
    } else if (line.includes('console.error(')) {
      logType = 'error';
    }
    
    // 提取括号内的内容
    const match = line.match(/console\.(log|warn|error)\((.*?)\);?\s*$/);
    if (match) {
      const content = match[2].trim();
      
      // 替换为MSCalendarLogger
      const newLine = `${indent}MSCalendarLogger.${logType}(${content});`;
      processedLines.push(newLine);
      
      console.log(`🔄 第${lineNum}行: console.${logType} -> MSCalendarLogger.${logType}`);
      replacedCount++;
    } else {
      // 如果无法解析，保持原样
      processedLines.push(line);
      keptCount++;
      console.log(`⏭️  第${lineNum}行: 保持原样（无法解析）`);
    }
  } else {
    processedLines.push(line);
  }
}

const newContent = processedLines.join('\n');

// 使用UTF-8编码写入文件
fs.writeFileSync(filePath, newContent, 'utf8');

console.log('\n📊 处理完成:');
console.log(`   ✅ 替换了 ${replacedCount} 个console调用`);
console.log(`   ⏭️  保留了 ${keptCount} 个无法处理的行`);
console.log(`   📝 文件已保存为UTF-8编码: ${filePath}`);

// 删除临时文件
fs.unlinkSync(tempFilePath);
console.log(`   🗑️  已删除临时文件: ${tempFilePath}`);

console.log('\n✨ 全部完成！');
