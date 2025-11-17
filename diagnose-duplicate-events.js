/**
 * 诊断重复事件问题
 * 
 * 检查 localStorage 中的事件重复情况
 */

const STORAGE_KEYS = {
  EVENTS: 'remarkable-events'
};

function diagnoseDuplicateEvents() {
  console.log('='.repeat(80));
  console.log('📊 ReMarkable 重复事件诊断');
  console.log('='.repeat(80));
  console.log('');

  // 1. 读取所有事件
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  console.log(`📌 总事件数: ${events.length}`);
  console.log('');

  // 2. 按 externalId 分组检查重复
  const externalIdMap = new Map();
  const noExternalId = [];
  
  events.forEach(event => {
    if (event.externalId) {
      const existing = externalIdMap.get(event.externalId) || [];
      existing.push(event);
      externalIdMap.set(event.externalId, existing);
    } else {
      noExternalId.push(event);
    }
  });

  // 3. 统计重复
  let duplicateGroups = 0;
  let duplicateEventCount = 0;
  const duplicateDetails = [];

  externalIdMap.forEach((group, externalId) => {
    if (group.length > 1) {
      duplicateGroups++;
      duplicateEventCount += group.length - 1;
      
      duplicateDetails.push({
        externalId: externalId.substring(0, 30) + '...',
        count: group.length,
        titles: group.map(e => e.title),
        ids: group.map(e => e.id),
        syncStatus: group.map(e => e.syncStatus),
        hasEventlog: group.map(e => !!e.eventlog),
        hasDescription: group.map(e => !!e.description),
        createdAt: group.map(e => e.createdAt)
      });
    }
  });

  // 4. 按 ID 分组检查（检测 ID 本身的重复）
  const idMap = new Map();
  events.forEach(event => {
    const count = idMap.get(event.id) || 0;
    idMap.set(event.id, count + 1);
  });

  let idDuplicates = 0;
  idMap.forEach((count, id) => {
    if (count > 1) {
      idDuplicates++;
      console.log(`⚠️ ID 重复: ${id} (${count} 次)`);
    }
  });

  // 5. 检查 eventlog vs description 差异
  let onlyEventlog = 0;
  let onlyDescription = 0;
  let both = 0;
  let neither = 0;

  events.forEach(event => {
    const hasEventlog = !!event.eventlog && 
                        typeof event.eventlog === 'string' && 
                        event.eventlog.trim();
    const hasDescription = !!event.description && 
                           typeof event.description === 'string' && 
                           event.description.trim();
    
    if (hasEventlog && hasDescription) both++;
    else if (hasEventlog) onlyEventlog++;
    else if (hasDescription) onlyDescription++;
    else neither++;
  });

  // 6. 输出报告
  console.log('='.repeat(80));
  console.log('📊 统计结果');
  console.log('='.repeat(80));
  console.log('');
  
  console.log(`📌 总事件数: ${events.length}`);
  console.log(`   - 有 externalId: ${events.length - noExternalId.length}`);
  console.log(`   - 无 externalId (本地事件): ${noExternalId.length}`);
  console.log('');

  console.log(`🔍 externalId 重复检查:`);
  console.log(`   - 重复组数: ${duplicateGroups}`);
  console.log(`   - 重复事件数: ${duplicateEventCount}`);
  console.log(`   - 预期删除后事件数: ${events.length - duplicateEventCount}`);
  console.log('');

  console.log(`🔍 ID 重复检查:`);
  console.log(`   - ID 重复数: ${idDuplicates}`);
  console.log('');

  console.log(`🔍 eventlog vs description 字段:`);
  console.log(`   - 两者都有: ${both} (${(both/events.length*100).toFixed(1)}%)`);
  console.log(`   - 只有 eventlog: ${onlyEventlog} (${(onlyEventlog/events.length*100).toFixed(1)}%)`);
  console.log(`   - 只有 description: ${onlyDescription} (${(onlyDescription/events.length*100).toFixed(1)}%)`);
  console.log(`   - 两者都没有: ${neither} (${(neither/events.length*100).toFixed(1)}%)`);
  console.log('');

  // 7. 详细重复列表（只显示前10个）
  if (duplicateDetails.length > 0) {
    console.log('='.repeat(80));
    console.log('🔍 重复事件详情 (前10个)');
    console.log('='.repeat(80));
    console.log('');
    
    duplicateDetails.slice(0, 10).forEach((detail, index) => {
      console.log(`${index + 1}. externalId: ${detail.externalId}`);
      console.log(`   重复次数: ${detail.count}`);
      console.log(`   标题:`, detail.titles);
      console.log(`   ID:`, detail.ids.map(id => id.substring(0, 25) + '...'));
      console.log(`   syncStatus:`, detail.syncStatus);
      console.log(`   有 eventlog:`, detail.hasEventlog);
      console.log(`   有 description:`, detail.hasDescription);
      console.log(`   创建时间:`, detail.createdAt);
      console.log('');
    });

    if (duplicateDetails.length > 10) {
      console.log(`... 还有 ${duplicateDetails.length - 10} 组重复未显示`);
      console.log('');
    }
  }

  // 8. 建议操作
  console.log('='.repeat(80));
  console.log('💡 建议操作');
  console.log('='.repeat(80));
  console.log('');

  if (duplicateEventCount > 0) {
    console.log(`⚠️ 发现 ${duplicateEventCount} 个重复事件`);
    console.log('');
    console.log('🔧 可以执行以下操作清理：');
    console.log('   1. 在 DevTools Console 中运行:');
    console.log('      deduplicateEventsManual()');
    console.log('');
    console.log('   2. 或者重启应用，ActionBasedSyncManager 会自动去重');
    console.log('');
  }

  if (idDuplicates > 0) {
    console.log(`❌ 严重问题：发现 ${idDuplicates} 个 ID 重复！`);
    console.log('   这表示数据结构损坏，需要手动清理');
    console.log('');
  }

  // 返回统计数据供进一步分析
  return {
    total: events.length,
    duplicateGroups,
    duplicateEventCount,
    expectedAfterCleanup: events.length - duplicateEventCount,
    idDuplicates,
    fieldStats: { both, onlyEventlog, onlyDescription, neither },
    duplicateDetails
  };
}

// 提供手动去重函数
function deduplicateEventsManual() {
  console.log('🔧 开始手动去重...');
  
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  const beforeCount = events.length;
  
  // 按 externalId 去重，保留 lastSyncTime 或 updatedAt 最新的
  const externalIdMap = new Map();
  const uniqueEvents = [];
  
  events.forEach(event => {
    if (!event.externalId) {
      // 没有 externalId 的本地事件直接保留
      uniqueEvents.push(event);
      return;
    }
    
    const existing = externalIdMap.get(event.externalId);
    if (!existing) {
      externalIdMap.set(event.externalId, event);
      uniqueEvents.push(event);
    } else {
      // 比较时间戳，保留更新的
      const existingTime = new Date(existing.lastSyncTime || existing.updatedAt || 0).getTime();
      const currentTime = new Date(event.lastSyncTime || event.updatedAt || 0).getTime();
      
      if (currentTime > existingTime) {
        // 替换为更新的事件
        const index = uniqueEvents.findIndex(e => e.id === existing.id);
        if (index !== -1) {
          uniqueEvents[index] = event;
          externalIdMap.set(event.externalId, event);
        }
      }
    }
  });
  
  // 保存清理后的事件
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(uniqueEvents));
  
  const afterCount = uniqueEvents.length;
  const removed = beforeCount - afterCount;
  
  console.log(`✅ 去重完成！`);
  console.log(`   清理前: ${beforeCount} 个事件`);
  console.log(`   清理后: ${afterCount} 个事件`);
  console.log(`   删除了: ${removed} 个重复事件`);
  console.log('');
  console.log('🔄 请刷新页面以重新加载数据');
  
  return { beforeCount, afterCount, removed };
}

// 暴露函数到全局作用域
window.diagnoseDuplicateEvents = diagnoseDuplicateEvents;
window.deduplicateEventsManual = deduplicateEventsManual;

// 自动执行诊断
console.log('');
console.log('🚀 ReMarkable 诊断工具已加载！');
console.log('');
console.log('💡 可用命令:');
console.log('   - diagnoseDuplicateEvents()  // 运行诊断');
console.log('   - deduplicateEventsManual()  // 手动去重');
console.log('');
console.log('⏱️  正在执行诊断...');
console.log('');

const result = diagnoseDuplicateEvents();
