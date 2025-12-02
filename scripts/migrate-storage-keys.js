/**
 * ReMarkable → 4DNote 存储键名迁移脚本
 * 
 * 运行环境: 浏览器控制台
 * 运行时机: 应用首次启动 4DNote 版本时自动执行
 * 
 * 功能:
 * 1. 检测旧的 ReMarkable localStorage 键名
 * 2. 复制数据到新的 4DNote 键名
 * 3. 保留旧键名 30 天后自动清理
 * 4. 记录迁移日志
 */

(function migrateStorageKeys() {
  console.log('🔄 [Migration] 开始 ReMarkable → 4DNote 存储迁移...\n');

  // 迁移映射表
  const migrations = [
    { old: 'remarkable-events', new: '4dnote-events', type: 'events' },
    { old: 'remarkable-settings', new: '4dnote-settings', type: 'settings' },
    { old: 'remarkable-global-timer', new: '4dnote-global-timer', type: 'timer' },
    { old: 'remarkable-outlook-authenticated', new: '4dnote-outlook-authenticated', type: 'auth' },
    { old: 'remarkable-storage-version', new: '4dnote-storage-version', type: 'version' },
    { old: 'remarkable-sync-action-queue', new: '4dnote-sync-action-queue', type: 'sync' },
    { old: 'remarkable_event_history', new: '4dnote_event_history', type: 'history' },
    { old: 'remarkable_migration_completed', new: '4dnote_migration_completed', type: 'migration' },
    // Backup keys
    { old: 'remarkable-events_backup', new: '4dnote-events_backup', type: 'backup' },
    { old: 'remarkable-events-backup', new: '4dnote-events-backup', type: 'backup' },
    // Dev persistent keys
    { old: 'remarkable-dev-persistent-remarkable-events', new: '4dnote-dev-persistent-4dnote-events', type: 'dev' },
    { old: 'remarkable-dev-persistent-remarkable-events-backup', new: '4dnote-dev-persistent-4dnote-events-backup', type: 'dev' },
    // Recovery keys
    { old: 'remarkable-events-v2', new: '4dnote-events-v2', type: 'recovery' },
    { old: 'remarkable-events-last-good', new: '4dnote-events-last-good', type: 'recovery' },
  ];

  let migrated = 0;
  let skipped = 0;
  let errors = 0;
  const migratedKeys = [];

  // 执行迁移
  migrations.forEach(({ old, new: newKey, type }) => {
    try {
      const data = localStorage.getItem(old);
      
      if (data) {
        // 检查新键是否已存在
        const existingData = localStorage.getItem(newKey);
        
        if (existingData) {
          console.log(`⏭️  [Migration] 跳过 ${old} (${type}): 新键已存在`);
          skipped++;
        } else {
          // 复制数据
          localStorage.setItem(newKey, data);
          migratedKeys.push({ old, new: newKey, type, size: data.length });
          migrated++;
          console.log(`✅ [Migration] 已迁移: ${old} → ${newKey} (${type}, ${(data.length / 1024).toFixed(2)} KB)`);
        }
      } else {
        console.log(`⏭️  [Migration] 跳过 ${old} (${type}): 旧键不存在`);
        skipped++;
      }
    } catch (error) {
      console.error(`❌ [Migration] 迁移失败: ${old} → ${newKey}`, error);
      errors++;
    }
  });

  // 记录迁移完成标记
  const migrationLog = {
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    migrated,
    skipped,
    errors,
    keys: migratedKeys
  };
  
  localStorage.setItem('4dnote_rebranding_migration', JSON.stringify(migrationLog));

  // 设置旧键清理时间 (30 天后)
  const cleanupDate = new Date();
  cleanupDate.setDate(cleanupDate.getDate() + 30);
  localStorage.setItem('4dnote_old_keys_cleanup_date', cleanupDate.toISOString());

  // 输出统计
  console.log('\n========================================');
  console.log('   迁移完成！🎉');
  console.log('========================================');
  console.log(`✅ 成功迁移: ${migrated} 个键`);
  console.log(`⏭️  跳过: ${skipped} 个键`);
  console.log(`❌ 失败: ${errors} 个键`);
  console.log(`\nℹ️  旧键将在 ${cleanupDate.toLocaleDateString('zh-CN')} 后自动清理`);
  console.log(`📊 迁移日志已保存到: 4dnote_rebranding_migration\n`);

  // 如果有迁移，显示详细信息
  if (migrated > 0) {
    console.log('📋 迁移详情:');
    console.table(migratedKeys);
  }

  return migrationLog;
})();
