const fs = require('fs');

// 定义需要恢复的文件映射
const filesToRestore = [
  {
    source: '.history/src/pages/DesktopCalendarWidget_20251031140548.tsx',
    target: 'src/pages/DesktopCalendarWidget.tsx',
    loggerName: 'widgetLogger',
    loggerModule: 'Widget'
  },
  {
    source: '.history/src/hooks/useFloatingToolbar_20251030142900.ts',
    target: 'src/hooks/useFloatingToolbar.ts',
    loggerName: 'FloatingToolbarLogger',
    loggerModule: 'FloatingToolbar'
  }
];

console.log('🔧 批量恢复乱码文件并清理console...\n');

let totalReplaced = 0;

filesToRestore.forEach(({ source, target, loggerName, loggerModule }) => {
  console.log(`\n📥 处理文件: ${target}`);
  console.log(`   源文件: ${source}\n`);

  // 使用UTF-8编码读取文件
  let content = fs.readFileSync(source, 'utf8');

  // 检查是否已经有logger导入
  const hasLogger = content.includes(`import { logger } from`) && 
                    content.includes(`const ${loggerName} = logger.module`);

  if (!hasLogger) {
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
      lines.splice(insertIndex, 0, "import { logger } from '../utils/logger';", '', `const ${loggerName} = logger.module('${loggerModule}');`);
      content = lines.join('\n');
      console.log(`✅ 添加了${loggerName}导入和定义\n`);
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
      
      // 替换为对应的logger
      line = `${indent}${loggerName}.${logType}(${args});`;
      
      replacedCount++;
      if (replacedCount <= 10) {  // 只显示前10个
        console.log(`🔄 第${lineNum}行: console.${logType} -> ${loggerName}.${logType}`);
      }
    }
    
    processedLines.push(line);
  }

  const newContent = processedLines.join('\n');

  // 使用UTF-8编码写入文件
  fs.writeFileSync(target, newContent, 'utf8');

  if (replacedCount > 10) {
    console.log(`   ... (省略${replacedCount - 10}个替换)`);
  }
  
  console.log(`\n📊 ${target}:`);
  console.log(`   ✅ 成功替换了 ${replacedCount} 个console调用`);
  
  totalReplaced += replacedCount;
});

console.log('\n' + '='.repeat(60));
console.log('✨ 批量处理完成！');
console.log(`📊 总计替换了 ${totalReplaced} 个console调用`);
console.log('📝 所有文件已保存为UTF-8编码');
console.log('='.repeat(60));
