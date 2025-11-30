/**
 * 🚨 localStorage 配额清理脚本
 * 
 * 问题：localStorage 已满，无法保存新数据
 * 
 * 清理策略：
 * 1. 分析 localStorage 占用情况
 * 2. 清理冗余字段（eventlog、长描述等）
 * 3. 移除旧的备份和临时数据
 * 4. 压缩事件数据（移除未使用字段）
 * 5. 可选：导出旧事件到文件
 * 
 * 使用方法：
 * 1. 在浏览器控制台执行本脚本
 * 2. 查看存储分析报告
 * 3. 按提示执行清理操作
 * 
 * @created 2025-12-01
 * @version 1.0.0
 */

(function cleanupStorageQuota() {
  console.log('🧹' + '='.repeat(60));
  console.log('🧹 localStorage 配额清理 - 开始执行');
  console.log('🧹' + '='.repeat(60));

  // ========== 步骤 1: 存储分析 ==========
  console.log('\n📊 步骤 1: 分析 localStorage 占用情况...');
  
  const storageAnalysis = {};
  let totalSize = 0;
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    const value = localStorage.getItem(key);
    const size = new Blob([value]).size;
    
    storageAnalysis[key] = {
      size: size,
      sizeKB: (size / 1024).toFixed(2),
      sizeMB: (size / 1024 / 1024).toFixed(2)
    };
    totalSize += size;
  }
  
  // 按大小排序
  const sortedKeys = Object.keys(storageAnalysis).sort((a, b) => 
    storageAnalysis[b].size - storageAnalysis[a].size
  );
  
  console.log(`📦 localStorage 总占用: ${(totalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📦 浏览器限制约: 5-10 MB`);
  console.log('\n📋 占用排行（前 10）:');
  
  sortedKeys.slice(0, 10).forEach((key, index) => {
    const info = storageAnalysis[key];
    console.log(`${index + 1}. ${key}: ${info.sizeMB} MB (${info.sizeKB} KB)`);
  });

  // ========== 步骤 2: 分析事件数据 ==========
  console.log('\n🔍 步骤 2: 分析事件数据结构...');
  
  const eventsJson = localStorage.getItem('remarkable-events');
  if (!eventsJson) {
    console.error('❌ 未找到事件数据');
    return { success: false, error: '未找到事件数据' };
  }

  let events;
  try {
    events = JSON.parse(eventsJson);
    console.log(`✅ 事件总数: ${events.length}`);
  } catch (error) {
    console.error('❌ 解析事件数据失败:', error);
    return { success: false, error: '解析事件数据失败' };
  }

  // 分析字段占用
  const fieldSizes = {};
  const sampleSize = Math.min(100, events.length);
  
  events.slice(0, sampleSize).forEach(event => {
    Object.keys(event).forEach(key => {
      if (!fieldSizes[key]) {
        fieldSizes[key] = { totalSize: 0, count: 0, avgSize: 0 };
      }
      const fieldValue = JSON.stringify(event[key] || '');
      fieldSizes[key].totalSize += fieldValue.length;
      fieldSizes[key].count++;
    });
  });

  // 计算平均大小并排序
  Object.keys(fieldSizes).forEach(key => {
    fieldSizes[key].avgSize = fieldSizes[key].totalSize / fieldSizes[key].count;
  });

  const sortedFields = Object.keys(fieldSizes).sort((a, b) => 
    fieldSizes[b].avgSize - fieldSizes[a].avgSize
  );

  console.log('\n📊 字段占用排行（前 15，基于样本）:');
  sortedFields.slice(0, 15).forEach((field, index) => {
    const info = fieldSizes[field];
    console.log(`${index + 1}. ${field}: 平均 ${info.avgSize.toFixed(0)} bytes, 出现 ${info.count} 次`);
  });

  // ========== 步骤 3: 清理策略 ==========
  console.log('\n🎯 步骤 3: 执行清理策略...');
  
  const stats = {
    originalSize: new Blob([eventsJson]).size,
    eventsProcessed: 0,
    fieldsRemoved: {
      eventlog: 0,
      longDescription: 0,
      unusedFields: 0
    },
    bytesFreed: 0
  };

  // 策略 1: 清理 eventlog 对象（最大占用源）
  console.log('\n🔧 策略 1: 清理冗余的 eventlog 对象...');
  events.forEach(event => {
    if (event.eventlog && typeof event.eventlog === 'object') {
      // eventlog 对象通常包含大量冗余数据
      // 只保留 description，删除 eventlog 对象
      if (event.description) {
        delete event.eventlog;
        stats.fieldsRemoved.eventlog++;
      }
    }
    stats.eventsProcessed++;
  });
  console.log(`✅ 清理了 ${stats.fieldsRemoved.eventlog} 个 eventlog 对象`);

  // 策略 2: 压缩长描述
  console.log('\n🔧 策略 2: 压缩超长描述...');
  const MAX_DESCRIPTION_LENGTH = 1000;
  events.forEach(event => {
    if (event.description && event.description.length > MAX_DESCRIPTION_LENGTH) {
      event.description = event.description.substring(0, MAX_DESCRIPTION_LENGTH) + '... (已截断)';
      stats.fieldsRemoved.longDescription++;
    }
  });
  console.log(`✅ 压缩了 ${stats.fieldsRemoved.longDescription} 个超长描述`);

  // 策略 3: 移除未使用的字段
  console.log('\n🔧 策略 3: 移除未使用的字段...');
  const unusedFields = [
    '__v',
    '_id',
    'metadata',
    'debug',
    'temp',
    'cache',
    '_source',
    'originalData',
    'rawData'
  ];
  
  events.forEach(event => {
    unusedFields.forEach(field => {
      if (field in event) {
        delete event[field];
        stats.fieldsRemoved.unusedFields++;
      }
    });
  });
  console.log(`✅ 移除了 ${stats.fieldsRemoved.unusedFields} 个未使用字段`);

  // 计算清理后的大小
  const cleanedEventsJson = JSON.stringify(events);
  const cleanedSize = new Blob([cleanedEventsJson]).size;
  stats.bytesFreed = stats.originalSize - cleanedSize;

  console.log('\n📊 清理效果:');
  console.log(`   原始大小: ${(stats.originalSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   清理后: ${(cleanedSize / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   释放空间: ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
  console.log(`   压缩率: ${((stats.bytesFreed / stats.originalSize) * 100).toFixed(1)}%`);

  // ========== 步骤 4: 清理其他 localStorage 项 ==========
  console.log('\n🧹 步骤 4: 清理其他冗余数据...');
  
  const keysToRemove = [];
  
  // 查找备份和临时数据
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (
      key.includes('backup') || 
      key.includes('temp') || 
      key.includes('cache') ||
      key.includes('debug') ||
      key.includes('test') ||
      key.includes('old') ||
      key.includes('legacy')
    ) {
      const size = storageAnalysis[key]?.sizeMB || '?';
      keysToRemove.push({ key, size });
    }
  }

  if (keysToRemove.length > 0) {
    console.log(`✅ 找到 ${keysToRemove.length} 个可清理项:`);
    keysToRemove.forEach(item => {
      console.log(`   - ${item.key} (${item.size} MB)`);
    });
  } else {
    console.log('✅ 没有发现可清理的冗余数据');
  }

  // ========== 步骤 5: 应用清理 ==========
  console.log('\n💾 步骤 5: 准备应用清理...');
  
  console.log('\n⚠️ 清理操作需要手动确认！');
  console.log('\n如果确认执行清理，请按顺序执行以下命令：');
  
  console.log('\n1️⃣ 创建备份到文件（重要！）：');
  console.log('   const backup = localStorage.getItem("remarkable-events");');
  console.log('   const blob = new Blob([backup], { type: "application/json" });');
  console.log('   const url = URL.createObjectURL(blob);');
  console.log('   const a = document.createElement("a");');
  console.log('   a.href = url;');
  console.log('   a.download = "remarkable-events-backup-" + new Date().toISOString() + ".json";');
  console.log('   a.click();');
  
  console.log('\n2️⃣ 应用清理（释放 ' + (stats.bytesFreed / 1024 / 1024).toFixed(2) + ' MB）：');
  console.log('   cleanupResult.applyCleanup()');
  
  console.log('\n3️⃣ 清理冗余项（可选）：');
  console.log('   cleanupResult.removeRedundantKeys()');
  
  console.log('\n4️⃣ 刷新页面：');
  console.log('   location.reload()');

  // ========== 返回结果 ==========
  return {
    success: true,
    stats,
    storageAnalysis,
    keysToRemove,
    events,
    cleanedEventsJson,
    // 提供清理函数
    applyCleanup: function() {
      console.log('🚨 开始应用清理...');
      
      try {
        // 创建 localStorage 备份
        localStorage.setItem('remarkable-events-before-cleanup', localStorage.getItem('remarkable-events'));
        console.log('✅ 已创建备份: remarkable-events-before-cleanup');
        
        // 应用清理
        localStorage.setItem('remarkable-events', cleanedEventsJson);
        console.log(`✅ 已应用清理，释放 ${(stats.bytesFreed / 1024 / 1024).toFixed(2)} MB`);
        
        return true;
      } catch (error) {
        console.error('❌ 应用清理失败:', error);
        return false;
      }
    },
    removeRedundantKeys: function() {
      console.log('🗑️ 开始删除冗余项...');
      
      let removed = 0;
      let freedSize = 0;
      
      keysToRemove.forEach(item => {
        try {
          const size = new Blob([localStorage.getItem(item.key) || '']).size;
          localStorage.removeItem(item.key);
          removed++;
          freedSize += size;
          console.log(`✅ 删除: ${item.key}`);
        } catch (error) {
          console.error(`❌ 删除失败: ${item.key}`, error);
        }
      });
      
      console.log(`✅ 删除了 ${removed} 个项，释放 ${(freedSize / 1024 / 1024).toFixed(2)} MB`);
      return { removed, freedSize };
    }
  };
})();
