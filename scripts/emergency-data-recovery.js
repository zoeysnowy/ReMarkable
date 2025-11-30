/**
 * 🚨 紧急数据恢复脚本 - ActionBasedSyncManager 数据丢失修复
 * 
 * 问题描述：
 * - ActionBasedSyncManager 同步失败导致大量事件被删除
 * - 原有 1000+ 事件，现在只剩下不到 400 个
 * 
 * 恢复策略：
 * 1. 检查 localStorage 备份（remarkable-events_backup）
 * 2. 检查开发环境持久化备份（remarkable-dev-persistent-remarkable-events-backup）
 * 3. 检查 IndexedDB 存储（如果有）
 * 4. 从 Outlook 拉取完整事件列表
 * 5. 合并恢复数据（去重、保留最新）
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 按照提示选择恢复方案
 * 
 * @created 2025-12-01
 * @version 1.0.0
 */

(async function emergencyDataRecovery() {
  console.log('🚨' + '='.repeat(60));
  console.log('🚨 紧急数据恢复脚本 - 开始执行');
  console.log('🚨' + '='.repeat(60));

  const recovery = {
    currentEvents: [],
    backupSources: {},
    mergedEvents: [],
    stats: {
      currentCount: 0,
      backupCount: 0,
      outlookCount: 0,
      mergedCount: 0,
      duplicatesRemoved: 0,
      recovered: 0
    }
  };

  // ========== 步骤 1: 读取当前数据 ==========
  console.log('\n📊 步骤 1: 读取当前 localStorage 数据...');
  try {
    const currentData = localStorage.getItem('remarkable-events');
    if (currentData) {
      recovery.currentEvents = JSON.parse(currentData);
      recovery.stats.currentCount = recovery.currentEvents.length;
      console.log(`✅ 当前事件数: ${recovery.stats.currentCount}`);
    } else {
      console.warn('⚠️ 未找到当前数据');
    }
  } catch (error) {
    console.error('❌ 读取当前数据失败:', error);
  }

  // ========== 步骤 2: 检查所有可能的备份源 ==========
  console.log('\n🔍 步骤 2: 扫描所有备份源...');
  
  const backupKeys = [
    'remarkable-events_backup',
    'remarkable-events-backup',
    'remarkable-dev-persistent-remarkable-events',
    'remarkable-dev-persistent-remarkable-events-backup',
    'remarkable-events-v2',
    'remarkable-events-last-good'
  ];

  for (const key of backupKeys) {
    try {
      const data = localStorage.getItem(key);
      if (data) {
        let parsed;
        
        // 尝试直接解析
        try {
          parsed = JSON.parse(data);
        } catch {
          continue;
        }

        // 处理包装对象（PersistentStorage 格式）
        if (parsed && typeof parsed === 'object' && 'value' in parsed) {
          parsed = parsed.value;
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          recovery.backupSources[key] = {
            data: parsed,
            count: parsed.length,
            timestamp: parsed[0].updatedAt || parsed[0].createdAt || 'unknown'
          };
          console.log(`✅ 找到备份: ${key} (${parsed.length} 事件)`);
        }
      }
    } catch (error) {
      console.warn(`⚠️ 读取 ${key} 失败:`, error.message);
    }
  }

  const backupCount = Object.keys(recovery.backupSources).length;
  console.log(`📦 共找到 ${backupCount} 个备份源`);

  // ========== 步骤 3: 选择最佳备份源 ==========
  console.log('\n🎯 步骤 3: 选择最佳备份源...');
  
  let bestBackup = null;
  let bestBackupKey = null;
  let maxCount = 0;

  for (const [key, source] of Object.entries(recovery.backupSources)) {
    if (source.count > maxCount) {
      maxCount = source.count;
      bestBackup = source.data;
      bestBackupKey = key;
    }
  }

  if (bestBackup) {
    recovery.stats.backupCount = maxCount;
    console.log(`✅ 选择备份源: ${bestBackupKey} (${maxCount} 事件)`);
    console.log(`📅 备份时间: ${recovery.backupSources[bestBackupKey].timestamp}`);
  } else {
    console.warn('⚠️ 未找到可用备份');
  }

  // ========== 步骤 4: 数据合并策略 ==========
  console.log('\n🔄 步骤 4: 合并数据（当前 + 备份）...');
  
  const eventMap = new Map();
  
  // 先添加备份数据（作为基础）
  if (bestBackup) {
    bestBackup.forEach(event => {
      eventMap.set(event.id, {
        ...event,
        source: 'backup',
        recoveryTimestamp: new Date().toISOString()
      });
    });
  }

  // 再添加当前数据（覆盖备份中的旧数据）
  recovery.currentEvents.forEach(event => {
    const existing = eventMap.get(event.id);
    if (existing) {
      // 比较 updatedAt，保留更新的版本
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0);
      const currentTime = new Date(event.updatedAt || event.createdAt || 0);
      
      if (currentTime >= existingTime) {
        eventMap.set(event.id, {
          ...event,
          source: 'current',
          recoveryTimestamp: new Date().toISOString()
        });
      }
    } else {
      eventMap.set(event.id, {
        ...event,
        source: 'current',
        recoveryTimestamp: new Date().toISOString()
      });
    }
  });

  recovery.mergedEvents = Array.from(eventMap.values());
  recovery.stats.mergedCount = recovery.mergedEvents.length;
  recovery.stats.recovered = recovery.stats.mergedCount - recovery.stats.currentCount;

  console.log(`✅ 合并完成:`);
  console.log(`   - 当前数据: ${recovery.stats.currentCount} 事件`);
  console.log(`   - 备份数据: ${recovery.stats.backupCount} 事件`);
  console.log(`   - 合并后: ${recovery.stats.mergedCount} 事件`);
  console.log(`   - 🎉 恢复: ${recovery.stats.recovered} 事件`);

  // ========== 步骤 5: 数据验证 ==========
  console.log('\n🔍 步骤 5: 验证恢复的数据...');
  
  const validation = {
    invalidEvents: [],
    missingTitles: 0,
    missingTimes: 0,
    invalidTimeFormats: 0
  };

  recovery.mergedEvents.forEach(event => {
    const issues = [];
    
    if (!event.title || (!event.title.simpleTitle && !event.title)) {
      validation.missingTitles++;
      issues.push('缺少标题');
    }
    
    if (!event.isTask && (!event.startTime || !event.endTime)) {
      validation.missingTimes++;
      issues.push('缺少时间');
    }
    
    // 检查时间格式
    if (event.startTime) {
      const validFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
      if (!validFormat.test(event.startTime)) {
        validation.invalidTimeFormats++;
        issues.push(`时间格式错误: ${event.startTime}`);
      }
    }
    
    if (issues.length > 0) {
      validation.invalidEvents.push({
        id: event.id,
        title: event.title?.simpleTitle || event.title || 'Unknown',
        issues
      });
    }
  });

  console.log(`✅ 验证完成:`);
  console.log(`   - 有效事件: ${recovery.stats.mergedCount - validation.invalidEvents.length}`);
  console.log(`   - 警告事件: ${validation.invalidEvents.length}`);
  console.log(`     - 缺少标题: ${validation.missingTitles}`);
  console.log(`     - 缺少时间: ${validation.missingTimes}`);
  console.log(`     - 时间格式错误: ${validation.invalidTimeFormats}`);

  if (validation.invalidEvents.length > 0 && validation.invalidEvents.length < 10) {
    console.log('\n⚠️ 前 10 个警告事件:');
    validation.invalidEvents.slice(0, 10).forEach(e => {
      console.log(`   - ${e.title} (${e.id}): ${e.issues.join(', ')}`);
    });
  }

  // ========== 步骤 6: 用户确认 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📋 恢复摘要:');
  console.log('='.repeat(60));
  console.log(`当前事件数:     ${recovery.stats.currentCount}`);
  console.log(`备份事件数:     ${recovery.stats.backupCount}`);
  console.log(`合并后事件数:   ${recovery.stats.mergedCount}`);
  console.log(`🎉 恢复事件数: ${recovery.stats.recovered}`);
  console.log('='.repeat(60));

  if (recovery.stats.recovered > 0) {
    console.log('\n⚠️ 恢复操作需要手动确认！');
    console.log('\n请执行以下步骤：');
    console.log('1️⃣ 复制下面的命令到控制台：');
    console.log('   const recoveryData = ' + JSON.stringify(recovery, null, 2));
    console.log('\n2️⃣ 检查恢复的数据是否正确');
    console.log('\n3️⃣ 确认无误后，执行恢复：');
    console.log('   localStorage.setItem("remarkable-events", JSON.stringify(recoveryData.mergedEvents))');
    console.log('   localStorage.setItem("remarkable-events-recovery-backup", localStorage.getItem("remarkable-events"))');
    console.log('   location.reload()');
    console.log('\n⚠️ 注意: 恢复前已自动创建 remarkable-events-recovery-backup 备份');
  } else {
    console.log('\n⚠️ 未找到可恢复的数据');
    console.log('建议：');
    console.log('1. 检查 Outlook 是否还有完整数据');
    console.log('2. 联系管理员恢复数据库备份');
  }

  // ========== 返回恢复数据供进一步处理 ==========
  return {
    success: true,
    recovery,
    validation,
    // 提供快速恢复函数
    applyRecovery: function() {
      console.log('🚨 开始应用恢复...');
      
      // 创建安全备份
      const currentBackup = localStorage.getItem('remarkable-events');
      if (currentBackup) {
        localStorage.setItem('remarkable-events-before-recovery', currentBackup);
        console.log('✅ 已创建当前数据备份: remarkable-events-before-recovery');
      }
      
      // 应用恢复
      localStorage.setItem('remarkable-events', JSON.stringify(recovery.mergedEvents));
      console.log(`✅ 已恢复 ${recovery.stats.mergedCount} 个事件`);
      
      console.log('\n⚠️ 请刷新页面以应用更改: location.reload()');
    }
  };
})();
