const fs = require('fs');
const path = require('path');

// 明显的临时文件和测试文件
const TEMP_FILES = [
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
];

// 扫描模式：查找可疑的备份文件
const BACKUP_PATTERNS = [
  /_clean\.(css|ts|tsx|js)$/,
  /_backup\.(css|ts|tsx|js)$/,
  /_old\.(css|ts|tsx|js)$/,
  /_tmp\.(css|ts|tsx|js)$/,
  /\.backup\.(css|ts|tsx|js)$/,
  /\.old\.(css|ts|tsx|js)$/,
];

// Demo/测试页面（需要确认是否在使用）
const DEMO_PAGES = [
  'src/pages/PlanItemEditorDemo.tsx',
  'src/pages/FloatingButtonDemo.tsx',
];

// 可能未使用的组件（需要检查引用）
const SUSPICIOUS_COMPONENTS = [
  'src/components/PlanManagerTest.tsx',
  'src/components/Logo.tsx',
  'src/components/FloatingToolbar.tsx', // 可能被 FloatingToolbarV2 替代
  'src/components/RangeTimePicker.tsx',
];

// Electron 性能测试文件
const ELECTRON_TEST_FILES = [
  'electron/test-react-startup.js',
  'electron/test-electron-startup.js',
  'electron/performance-test.js',
];

function checkFileExists(filePath) {
  const fullPath = path.join(__dirname, filePath);
  return fs.existsSync(fullPath);
}

function getFileSize(filePath) {
  const fullPath = path.join(__dirname, filePath);
  try {
    const stats = fs.statSync(fullPath);
    return (stats.size / 1024).toFixed(2); // KB
  } catch {
    return '0';
  }
}

function scanDirectory(dirPath) {
  const fullPath = path.join(__dirname, dirPath);
  if (!fs.existsSync(fullPath)) return [];
  
  const files = [];
  function scan(currentPath) {
    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullEntryPath = path.join(currentPath, entry.name);
      if (entry.isDirectory()) {
        scan(fullEntryPath);
      } else {
        const relativePath = path.relative(__dirname, fullEntryPath);
        files.push(relativePath);
      }
    }
  }
  scan(fullPath);
  return files;
}

function findBackupFiles() {
  const srcFiles = scanDirectory('src');
  const backupFiles = [];
  
  for (const file of srcFiles) {
    // 检查是否匹配备份模式
    if (BACKUP_PATTERNS.some(pattern => pattern.test(file))) {
      // 检查是否被引用
      const baseName = path.basename(file);
      const isUsed = searchForImports(baseName);
      
      if (!isUsed) {
        backupFiles.push({
          path: file,
          size: parseFloat(getFileSize(file))
        });
      }
    }
  }
  
  return backupFiles;
}

function searchForImports(fileName, searchPaths = ['src/**/*.{ts,tsx}']) {
  // 简化版：在主要文件中搜索引用
  const mainFiles = [
    'src/App.tsx',
    'src/index.tsx',
    'src/pages/DesktopCalendarWidget.tsx',
  ];
  
  const baseName = path.basename(fileName, path.extname(fileName));
  let found = false;
  
  for (const file of mainFiles) {
    const fullPath = path.join(__dirname, file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, { encoding: 'utf-8' });
      // 检查是否导入了这个文件
      if (content.includes(`from './${fileName}'`) || 
          content.includes(`from "./${fileName}"`) ||
          content.includes(baseName)) {
        found = true;
        break;
      }
    }
  }
  
  return found;
}

console.log('🔍 分析死代码和临时文件...\n');
console.log('━'.repeat(80));

// 分类统计
let tempFilesCount = 0;
let tempFilesSize = 0;
let demoFilesCount = 0;
let demoFilesSize = 0;
let suspiciousCount = 0;
let suspiciousSize = 0;
let testFilesCount = 0;
let testFilesSize = 0;

console.log('\n📦 临时文件和脚本（建议删除）:\n');
TEMP_FILES.forEach(file => {
  if (checkFileExists(file)) {
    const size = parseFloat(getFileSize(file));
    tempFilesCount++;
    tempFilesSize += size;
    console.log(`   ❌ ${file} (${size} KB)`);
  }
});

console.log('\n🎭 Demo/测试页面:\n');
DEMO_PAGES.forEach(file => {
  if (checkFileExists(file)) {
    const size = parseFloat(getFileSize(file));
    const isUsed = searchForImports(file);
    demoFilesCount++;
    demoFilesSize += size;
    
    if (isUsed) {
      console.log(`   ⚠️  ${file} (${size} KB) - 被引用中，请确认是否需要`);
    } else {
      console.log(`   ❌ ${file} (${size} KB) - 未被引用`);
    }
  }
});

console.log('\n🤔 可疑的未使用组件:\n');
SUSPICIOUS_COMPONENTS.forEach(file => {
  if (checkFileExists(file)) {
    const size = parseFloat(getFileSize(file));
    const isUsed = searchForImports(path.basename(file));
    suspiciousCount++;
    suspiciousSize += size;
    
    if (isUsed) {
      console.log(`   ✅ ${file} (${size} KB) - 正在使用`);
    } else {
      console.log(`   ❌ ${file} (${size} KB) - 可能未使用`);
    }
  }
});

console.log('\n🧪 Electron 测试文件:\n');
ELECTRON_TEST_FILES.forEach(file => {
  if (checkFileExists(file)) {
    const size = parseFloat(getFileSize(file));
    testFilesCount++;
    testFilesSize += size;
    console.log(`   ⚠️  ${file} (${size} KB) - 仅用于开发测试`);
  }
});

// 新增：扫描备份文件
console.log('\n📋 可疑的备份文件:\n');
const backupFiles = findBackupFiles();
let backupFilesSize = 0;
if (backupFiles.length > 0) {
  backupFiles.forEach(({ path: file, size }) => {
    backupFilesSize += size;
    console.log(`   ❌ ${file} (${size} KB) - 未被引用的备份文件`);
  });
} else {
  console.log('   ✅ 未发现备份文件');
}

console.log('\n' + '━'.repeat(80));
console.log('\n📊 统计汇总:');
console.log(`   🗑️  临时文件: ${tempFilesCount} 个，共 ${tempFilesSize.toFixed(2)} KB`);
console.log(`   🎭 Demo页面: ${demoFilesCount} 个，共 ${demoFilesSize.toFixed(2)} KB`);
console.log(`   🤔 可疑组件: ${suspiciousCount} 个，共 ${suspiciousSize.toFixed(2)} KB`);
console.log(`   🧪 测试文件: ${testFilesCount} 个，共 ${testFilesSize.toFixed(2)} KB`);
console.log(`   � 备份文件: ${backupFiles.length} 个，共 ${backupFilesSize.toFixed(2)} KB`);
console.log(`   �📦 总计可清理: ${(tempFilesSize + demoFilesSize + suspiciousSize + backupFilesSize).toFixed(2)} KB\n`);

console.log('💡 建议:');
console.log('   1. 临时文件可以直接删除');
console.log('   2. Demo页面如果不需要可以移到 docs/examples');
console.log('   3. 可疑组件需要进一步确认是否被使用');
console.log('   4. 测试文件可以保留在 electron/ 目录下\n');

// 生成清理命令
console.log('🔧 快速清理命令:');
console.log('\n   # 删除临时文件');
const filesToDelete = TEMP_FILES.filter(f => checkFileExists(f));
if (filesToDelete.length > 0) {
  console.log('   rm ' + filesToDelete.join(' '));
}
