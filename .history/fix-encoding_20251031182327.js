const fs = require('fs');
const path = require('path');
const iconv = require('iconv-lite');

const filesToFix = [
  'src/components/EventEditModal.tsx',
  'src/components/TagManager.tsx',
  'src/components/TimeCalendar.tsx',
  'src/pages/DesktopCalendarWidget.tsx',
  'src/services/EventService.ts',
  'src/components/CalendarSettingsPanel.tsx'
];

console.log('转换UTF-16到UTF-8(无BOM)...\n');

let fixedCount = 0;

filesToFix.forEach(file => {
  const fullPath = path.join(__dirname, file);
  
  if (fs.existsSync(fullPath)) {
    try {
      // 读取文件为buffer
      const buffer = fs.readFileSync(fullPath);
      
      // 检查是否是UTF-16 LE BOM (FF FE)
      if (buffer.length >= 2 && buffer[0] === 0xFF && buffer[1] === 0xFE) {
        console.log(`❌ 发现UTF-16 LE BOM: ${file}`);
        
        // 解码UTF-16 LE
        const content = iconv.decode(buffer, 'utf16-le');
        
        // 重新编码为UTF-8 (无BOM)
        const utf8Buffer = Buffer.from(content, 'utf8');
        fs.writeFileSync(fullPath, utf8Buffer);
        
        console.log(`✅ 已转换为UTF-8: ${file}\n`);
        fixedCount++;
      } else if (buffer.length >= 3 && buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        console.log(`❌ 发现UTF-8 BOM: ${file}`);
        
        // 移除UTF-8 BOM
        const content = buffer.slice(3);
        fs.writeFileSync(fullPath, content);
        
        console.log(`✅ 已移除UTF-8 BOM: ${file}\n`);
        fixedCount++;
      } else {
        console.log(`✓  已经是UTF-8(无BOM): ${file}`);
      }
    } catch (error) {
      console.error(`❌ 错误处理 ${file}:`, error.message);
    }
  } else {
    console.log(`⚠️  文件不存在: ${file}`);
  }
});

console.log(`\n完成！修复了 ${fixedCount} 个文件`);
