const fs = require('fs');
const path = require('path');

// 要删除的文件列表
const filesToDelete = [
  // 临时恢复脚本
  'temp_older_version.ts',
  'temp_ms_calendar.ts',
  'temp_clean_version.ts',
  'restore-and-clean-ms-calendar.js',
  'restore-and-clean-actionbasedsyncmanager.js',
  'fix-ms-calendar-strings.js',
  'clean-ms-calendar-with-utf8.js',
  'batch-restore-files.js',
  'analyze-console-logs.js',
  'clean-console-logs.js',
  'console-cleanup-report.json',
  
  // Demo/测试页面
  'src/pages/PlanItemEditorDemo.tsx',
  'src/pages/PlanItemEditorDemo.css',
  'src/pages/FloatingButtonDemo.tsx',
  'src/pages/FloatingButtonDemo.css',
  
  // 未使用的组件
  'src/components/PlanManagerTest.tsx',
  'src/components/Logo.tsx',
  'src/components/FloatingToolbar.tsx',
  'src/components/FloatingToolbar.css',
  'src/components/RangeTimePicker.tsx',
];

function deleteFile(filePath) {
  const fullPath = path.join(__dirname, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return { success: false, reason: 'File not found' };
  }
  
  try {
    const stats = fs.statSync(fullPath);
    const sizeKB = (stats.size / 1024).toFixed(2);
    fs.unlinkSync(fullPath);
    return { success: true, size: parseFloat(sizeKB) };
  } catch (error) {
    return { success: false, reason: error.message };
  }
}

console.log('🗑️  开始清理死代码和临时文件...\n');
console.log('━'.repeat(80));

let deletedCount = 0;
let failedCount = 0;
let totalSize = 0;
let skippedCount = 0;

const categories = {
  '📦 临时脚本': [],
  '🎭 Demo页面': [],
  '🧩 未使用组件': [],
};

filesToDelete.forEach(file => {
  let category = '📦 临时脚本';
  if (file.startsWith('src/pages/')) {
    category = '🎭 Demo页面';
  } else if (file.startsWith('src/components/')) {
    category = '🧩 未使用组件';
  }
  
  const result = deleteFile(file);
  
  if (result.success) {
    deletedCount++;
    totalSize += result.size;
    categories[category].push({ file, size: result.size, status: '✅' });
  } else if (result.reason === 'File not found') {
    skippedCount++;
    categories[category].push({ file, size: 0, status: '⏭️' });
  } else {
    failedCount++;
    categories[category].push({ file, size: 0, status: '❌', error: result.reason });
  }
});

// 输出分类结果
Object.entries(categories).forEach(([categoryName, files]) => {
  if (files.length > 0) {
    console.log(`\n${categoryName}:\n`);
    files.forEach(({ file, size, status, error }) => {
      if (status === '✅') {
        console.log(`   ${status} ${file} (${size} KB)`);
      } else if (status === '⏭️') {
        console.log(`   ${status} ${file} (已不存在)`);
      } else {
        console.log(`   ${status} ${file} - ${error}`);
      }
    });
  }
});

console.log('\n' + '━'.repeat(80));
console.log('\n📊 清理统计:');
console.log(`   ✅ 成功删除: ${deletedCount} 个文件`);
console.log(`   ⏭️  跳过: ${skippedCount} 个文件`);
console.log(`   ❌ 失败: ${failedCount} 个文件`);
console.log(`   💾 释放空间: ${totalSize.toFixed(2)} KB`);
console.log(`\n✨ 清理完成！代码库更干净了。\n`);

if (deletedCount > 0) {
  console.log('💡 提示: 记得提交这些更改到 Git:');
  console.log('   git add -A');
  console.log('   git commit -m "chore: 清理死代码和临时文件"');
  console.log('');
}
