/**
 * EventTitle 三层架构诊断脚本
 * 
 * 目标：检查所有组件是否正确使用 EventTitle 接口
 * 
 * 检查项：
 * 1. ❌ 直接访问 event.title 作为字符串（应该访问 title.simpleTitle/colorTitle/fullTitle）
 * 2. ❌ formData.title 类型为 string（应该为 EventTitle）
 * 3. ❌ title: string 赋值（应该为 title: EventTitle 对象）
 * 4. ✅ 正确使用 event.title?.simpleTitle
 * 5. ✅ 正确使用 event.title?.colorTitle
 * 6. ✅ 正确使用 event.title?.fullTitle
 */

const fs = require('fs');
const path = require('path');

// 需要检查的文件模式
const filesToCheck = [
  'src/components/TimeCalendar.tsx',
  'src/components/EventEditModal/EventEditModalV2.tsx',
  'src/components/PlanManager.tsx',
  'src/components/UpcomingEventsPanel.tsx',
  'src/utils/calendarUtils.ts',
  'src/services/EventService.ts',
  'src/services/EventHub.ts',
];

// 问题模式
const problemPatterns = [
  {
    name: '❌ event.title 作为字符串使用',
    pattern: /event\.title(?!\?\.|\.)[\s]*(?:\.substring|\.trim|\.toLowerCase|\.startsWith|\.includes|\.replace|===|!==|==|!=)/g,
    severity: 'HIGH',
    suggestion: '应该使用 event.title?.simpleTitle'
  },
  {
    name: '❌ formData.title 类型声明为 string',
    pattern: /title:\s*string/g,
    severity: 'HIGH',
    suggestion: '应该改为 title: string (用于 EditModal 的 colorTitle)'
  },
  {
    name: '❌ title: 字符串字面量赋值',
    pattern: /title:\s*['"`][^'"`]*['"`]/g,
    severity: 'MEDIUM',
    suggestion: '应该改为 title: { simpleTitle: "...", colorTitle: undefined, fullTitle: undefined }'
  },
  {
    name: '❌ title: 变量赋值（可能是字符串）',
    pattern: /title:\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*[,}]/g,
    severity: 'LOW',
    suggestion: '检查变量是否为 EventTitle 类型'
  }
];

// 正确模式（用于统计）
const correctPatterns = [
  {
    name: '✅ 正确使用 simpleTitle',
    pattern: /title\?\.simpleTitle/g
  },
  {
    name: '✅ 正确使用 colorTitle',
    pattern: /title\?\.colorTitle/g
  },
  {
    name: '✅ 正确使用 fullTitle',
    pattern: /title\?\.fullTitle/g
  },
  {
    name: '✅ 正确创建 EventTitle 对象',
    pattern: /title:\s*{\s*simpleTitle:/g
  }
];

function checkFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${filePath}`);
    return;
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  
  console.log(`\n${'='.repeat(80)}`);
  console.log(`📄 检查文件: ${filePath}`);
  console.log(`${'='.repeat(80)}`);

  let hasIssues = false;
  const issuesByLine = {};

  // 检查问题模式
  problemPatterns.forEach(({ name, pattern, severity, suggestion }) => {
    let match;
    pattern.lastIndex = 0; // 重置正则
    
    while ((match = pattern.exec(content)) !== null) {
      const lineNumber = content.substring(0, match.index).split('\n').length;
      const lineContent = lines[lineNumber - 1].trim();
      
      // 过滤误报：注释行
      if (lineContent.startsWith('//') || lineContent.startsWith('*')) {
        continue;
      }
      
      hasIssues = true;
      
      if (!issuesByLine[lineNumber]) {
        issuesByLine[lineNumber] = [];
      }
      
      issuesByLine[lineNumber].push({
        name,
        severity,
        suggestion,
        code: lineContent,
        match: match[0]
      });
    }
  });

  // 输出问题
  if (hasIssues) {
    const sortedLines = Object.keys(issuesByLine).sort((a, b) => parseInt(a) - parseInt(b));
    
    sortedLines.forEach(lineNumber => {
      const issues = issuesByLine[lineNumber];
      issues.forEach(({ name, severity, suggestion, code, match }) => {
        console.log(`\n${name}`);
        console.log(`  ⚠️  严重程度: ${severity}`);
        console.log(`  📍 位置: Line ${lineNumber}`);
        console.log(`  🔍 匹配: ${match}`);
        console.log(`  📝 代码: ${code}`);
        console.log(`  💡 建议: ${suggestion}`);
      });
    });
  } else {
    console.log('\n✅ 未发现问题！');
  }

  // 统计正确用法
  console.log('\n📊 正确用法统计:');
  correctPatterns.forEach(({ name, pattern }) => {
    pattern.lastIndex = 0;
    const matches = content.match(pattern) || [];
    console.log(`  ${name}: ${matches.length} 处`);
  });

  return hasIssues;
}

// 主函数
function main() {
  console.log(`
╔══════════════════════════════════════════════════════════════════════════════╗
║                    EventTitle 三层架构诊断工具 v2.14                         ║
║                                                                              ║
║  检查目标：所有组件是否正确使用 EventTitle 接口                             ║
║  检查范围：TimeCalendar, EventEditModal, PlanManager, Utils, Services       ║
╚══════════════════════════════════════════════════════════════════════════════╝
`);

  let totalIssues = 0;
  
  filesToCheck.forEach(file => {
    const hasIssues = checkFile(path.join(__dirname, file));
    if (hasIssues) totalIssues++;
  });

  console.log(`\n${'='.repeat(80)}`);
  console.log(`📊 诊断结果汇总`);
  console.log(`${'='.repeat(80)}`);
  console.log(`检查文件数: ${filesToCheck.length}`);
  console.log(`发现问题的文件数: ${totalIssues}`);
  
  if (totalIssues === 0) {
    console.log(`\n🎉 所有文件都已正确适配 EventTitle 三层架构！`);
  } else {
    console.log(`\n⚠️  需要修复 ${totalIssues} 个文件`);
    console.log(`\n💡 修复指南:`);
    console.log(`  1. EventEditModalV2: formData.title 应该保持 string (存储 colorTitle)`);
    console.log(`  2. TimeCalendar: 显示时使用 event.title?.simpleTitle`);
    console.log(`  3. 保存时: title: { colorTitle: formData.title, simpleTitle: undefined, fullTitle: undefined }`);
    console.log(`  4. EventService.normalizeTitle() 会自动填充缺失的层级`);
  }
}

main();
