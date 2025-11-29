/**
 * 清理 localStorage，释放空间
 */

console.log('🧹 开始清理 localStorage...\n');

// 1. 删除迁移备份（已经不需要了）
const backupKeys = [
  'events_backup_migration',
  'meaningful-events',  // 旧的 key
  'meaningful-settings',
  'meaningful-sync-actions',
  'meaningful-sync-conflicts'
];

let freedSpace = 0;

backupKeys.forEach(key => {
  const data = localStorage.getItem(key);
  if (data) {
    const size = data.length;
    localStorage.removeItem(key);
    freedSpace += size;
    console.log(`✅ 删除 ${key}: ${(size / 1024 / 1024).toFixed(2)} MB`);
  }
});

console.log(`\n💾 释放空间: ${(freedSpace / 1024 / 1024).toFixed(2)} MB`);

// 2. 重新计算总量
let total = 0;
for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  total += value.length;
}

console.log(`📊 剩余使用: ${(total / 1024 / 1024).toFixed(2)} MB / 5.00 MB`);
console.log(`✨ 可用空间: ${((5 - total / 1024 / 1024)).toFixed(2)} MB\n`);

// 3. 测试写入
console.log('🧪 测试写入...');
try {
  const testKey = 'remarkable-test-write';
  localStorage.setItem(testKey, 'x'.repeat(500000)); // 500KB
  localStorage.removeItem(testKey);
  console.log('✅ 写入测试成功！');
} catch (error) {
  console.log('❌ 写入仍然失败:', error.message);
}

console.log('\n✅ 清理完成！刷新页面后应该可以正常工作了。');
