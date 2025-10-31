const fs = require('fs');

const filePath = 'src/services/MicrosoftCalendarService.ts';
const content = fs.readFileSync(filePath, 'utf8');

// 查找所有未终止的字符串（以中文或emoji结尾但没有引号闭合）
const lines = content.split('\n');
let fixedLines = [];
let issuesFound = 0;

lines.forEach((line, index) => {
  const lineNum = index + 1;
  
  // 检查是否有未闭合的字符串（行尾没有引号或分号）
  // 特征：包含中文字符，但字符串没有正确闭合
  if (line.includes('MSCalendarLogger') || line.includes('alert(') || line.includes('confirm(')) {
    // 检查引号是否成对
    const singleQuotes = (line.match(/'/g) || []).length;
    const doubleQuotes = (line.match(/"/g) || []).length;
    const backTicks = (line.match(/`/g) || []).length;
    
    // 如果引号数量是奇数，说明有未闭合的字符串
    if (singleQuotes % 2 !== 0 || doubleQuotes % 2 !== 0 || backTicks % 2 !== 0) {
      console.log(`⚠️  Line ${lineNum}: Unclosed string detected`);
      console.log(`    ${line.trim()}`);
      issuesFound++;
      
      // 尝试自动修复：如果行尾没有引号，添加对应的引号
      let fixed = line;
      if (singleQuotes % 2 !== 0 && !line.trim().endsWith("'") && !line.trim().endsWith("');")) {
        fixed = line.replace(/;?\s*$/, "');");
      } else if (doubleQuotes % 2 !== 0 && !line.trim().endsWith('"') && !line.trim().endsWith('");')) {
        fixed = line.replace(/;?\s*$/, '");');
      } else if (backTicks % 2 !== 0 && !line.trim().endsWith('`') && !line.trim().endsWith('`);')) {
        fixed = line.replace(/;?\s*$/, '`);');
      }
      
      if (fixed !== line) {
        console.log(`    Fixed: ${fixed.trim()}`);
        fixedLines.push(fixed);
      } else {
        fixedLines.push(line);
      }
    } else {
      fixedLines.push(line);
    }
  } else {
    fixedLines.push(line);
  }
});

console.log(`\nTotal issues found: ${issuesFound}`);

if (issuesFound > 0) {
  const fixedContent = fixedLines.join('\n');
  fs.writeFileSync(filePath + '.fixed', fixedContent, 'utf8');
  console.log('\n✅ Fixed file saved to: ' + filePath + '.fixed');
  console.log('Please review the changes before replacing the original file.');
}
