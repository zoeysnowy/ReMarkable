/**
 * 自动修改 TUI Calendar 源码中的事件高度常量
 * 用途：在 npm install 后自动应用补丁
 * 运行：node scripts/patch-tui-calendar.js
 */

const fs = require('fs');
const path = require('path');

const FILES_TO_PATCH = [
  'node_modules/@toast-ui/calendar/dist/toastui-calendar.js',
  'node_modules/@toast-ui/calendar/dist/toastui-calendar.mjs'
];

const PATCHES = [
  {
    pattern: /const MONTH_EVENT_HEIGHT = 24;/g,
    replacement: 'const MONTH_EVENT_HEIGHT = 17;',
    description: 'MONTH_EVENT_HEIGHT: 24 → 17'
  },
  {
    pattern: /const WEEK_EVENT_HEIGHT = 24;/g,
    replacement: 'const WEEK_EVENT_HEIGHT = 17;',
    description: 'WEEK_EVENT_HEIGHT: 24 → 17'
  },
  {
    pattern: /const EVENT_HEIGHT = 22;/g,
    replacement: 'const EVENT_HEIGHT = 17;',
    description: 'EVENT_HEIGHT: 22 → 17'
  }
];

console.log('🔧 开始修补 TUI Calendar 源码...\n');

let totalPatches = 0;

FILES_TO_PATCH.forEach(relativePath => {
  const filePath = path.join(process.cwd(), relativePath);
  
  if (!fs.existsSync(filePath)) {
    console.log(`⚠️  文件不存在: ${relativePath}`);
    return;
  }

  console.log(`📝 处理文件: ${relativePath}`);
  
  let content = fs.readFileSync(filePath, 'utf8');
  let filePatches = 0;

  PATCHES.forEach(({ pattern, replacement, description }) => {
    const matches = content.match(pattern);
    if (matches) {
      content = content.replace(pattern, replacement);
      filePatches += matches.length;
      console.log(`   ✅ ${description} (${matches.length} 处)`);
    }
  });

  if (filePatches > 0) {
    fs.writeFileSync(filePath, content, 'utf8');
    totalPatches += filePatches;
    console.log(`   💾 已保存 ${filePatches} 处修改\n`);
  } else {
    console.log(`   ℹ️  无需修改（可能已应用补丁）\n`);
  }
});

console.log(`\n🎉 补丁应用完成！共修改了 ${totalPatches} 处代码。\n`);

if (totalPatches > 0) {
  console.log('⚠️  注意：每次运行 npm install 后需要重新执行此脚本。');
  console.log('💡 建议：在 package.json 中添加 "postinstall": "node scripts/patch-tui-calendar.js"');
}
