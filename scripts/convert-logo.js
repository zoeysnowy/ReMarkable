/**
 * 将 LOGO.svg 转换为多种尺寸的 PNG 图标
 * 
 * 使用方法：
 * npm install sharp --save-dev
 * node scripts/convert-logo.js
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const svgPath = path.join(__dirname, '..', 'src', 'assets', 'icons', 'LOGO.svg');
const outputDir = path.join(__dirname, '..', 'electron', 'assets');

// 确保输出目录存在
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// 转换为不同尺寸
const sizes = [
  { name: 'icon.png', size: 256 },      // Electron 窗口图标
  { name: 'icon@2x.png', size: 512 },   // Retina 显示
];

async function convertSvgToPng() {
  console.log('🎨 开始转换 LOGO.svg...');
  
  for (const { name, size } of sizes) {
    const outputPath = path.join(outputDir, name);
    
    try {
      await sharp(svgPath)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`✅ 生成: ${name} (${size}x${size})`);
    } catch (error) {
      console.error(`❌ 转换失败 ${name}:`, error.message);
    }
  }
  
  console.log('🎉 转换完成！');
}

convertSvgToPng();
