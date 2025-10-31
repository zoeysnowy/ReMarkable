const fs = require('fs');
const path = require('path');

// 源文件：从 .history 中找到最近的干净版本
const sourceFile = '.history/src/components/TagManager_20251030131137.tsx';
const targetFile = 'src/components/TagManager.tsx';

console.log('🔄 恢复 TagManager.tsx 从历史版本...\n');

try {
  // 读取历史版本（使用 UTF-8）
  const content = fs.readFileSync(sourceFile, { encoding: 'utf-8' });
  
  // 检查是否有乱码
  const hasGarbledChars = /�/.test(content);
  if (hasGarbledChars) {
    console.log('⚠️  警告：历史版本也包含乱码字符，尝试下一个版本...');
    
    // 尝试更早的版本
    const olderSource = '.history/src/components/TagManager_20251030125900.tsx';
    const olderContent = fs.readFileSync(olderSource, { encoding: 'utf-8' });
    const olderHasGarbled = /�/.test(olderContent);
    
    if (olderHasGarbled) {
      console.error('❌ 所有历史版本都包含乱码！需要从 git 恢复。');
      process.exit(1);
    }
    
    console.log('✅ 找到干净版本：' + olderSource);
    fs.writeFileSync(targetFile, olderContent, { encoding: 'utf-8' });
    console.log('✅ 文件已恢复！');
  } else {
    // 写入目标文件（使用 UTF-8）
    fs.writeFileSync(targetFile, content, { encoding: 'utf-8' });
    
    console.log('✅ 恢复完成！');
    console.log(`   源文件: ${sourceFile}`);
    console.log(`   目标文件: ${targetFile}`);
    console.log(`   文件大小: ${(content.length / 1024).toFixed(2)} KB`);
  }
  
  // 验证恢复后的文件
  const restoredContent = fs.readFileSync(targetFile, { encoding: 'utf-8' });
  const stillHasGarbled = /�/.test(restoredContent);
  
  if (stillHasGarbled) {
    console.error('\n❌ 恢复后仍有乱码！');
  } else {
    console.log('\n✅ 验证通过：文件无乱码');
  }
  
} catch (error) {
  console.error('❌ 恢复失败:', error.message);
  process.exit(1);
}
