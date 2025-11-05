/**
 * 复制 PDF.js Worker 文件到 public 目录
 * 
 * 在构建前运行此脚本，确保 PDF 解析功能正常工作
 */

const fs = require('fs');
const path = require('path');

const source = path.join(__dirname, 'node_modules', 'pdfjs-dist', 'build', 'pdf.worker.min.mjs');
const dest = path.join(__dirname, 'public', 'pdf.worker.min.mjs');

try {
  if (fs.existsSync(source)) {
    fs.copyFileSync(source, dest);
    console.log('✅ PDF.js worker 文件已复制到 public 目录');
    console.log(`   源文件: ${source}`);
    console.log(`   目标文件: ${dest}`);
  } else {
    console.error('❌ 找不到 PDF.js worker 文件');
    console.error(`   路径: ${source}`);
    console.error('   请先运行: npm install pdfjs-dist');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ 复制失败:', error.message);
  process.exit(1);
}
