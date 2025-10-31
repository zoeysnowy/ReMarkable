const fs = require('fs');
const path = require('path');

const filesToFix = [
  'src/components/EventEditModal.tsx',
  'src/components/TagManager.tsx',
  'src/components/TimeCalendar.tsx',
  'src/pages/DesktopCalendarWidget.tsx',
  'src/services/EventService.ts',
  'src/components/CalendarSettingsPanel.tsx'
];

console.log('移除UTF-8 BOM标记...\n');

let fixedCount = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  
  if (fs.existsSync(fullPath)) {
    try {
      // 读取文件为buffer
      const buffer = fs.readFileSync(fullPath);
      
      // 检查是否有BOM (EF BB BF)
      if (buffer.length >= 3 && 
          buffer[0] === 0xEF && 
          buffer[1] === 0xBB && 
          buffer[2] === 0xBF) {
        console.log(`❌ 发现BOM: ${file}`);
        
        // 移除BOM，重新写入
        const content = buffer.slice(3);
        fs.writeFileSync(fullPath, content);
        
        console.log(`✅ 已移除BOM: ${file}\n`);
        fixedCount++;
      } else {
        console.log(`✓  无BOM: ${file}`);
      }
    } catch (error) {
      console.error(`❌ 错误处理 ${file}:`, error.message);
    }
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

console.log(`\n完成！修复了 ${fixedCount} 个文件`);
