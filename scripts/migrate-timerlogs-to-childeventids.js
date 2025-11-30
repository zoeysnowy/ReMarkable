/**
 * 数据迁移脚本：timerLogs → childEventIds
 * 将现有数据的 timerLogs 字段迁移到统一的 childEventIds 字段
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 查看迁移结果报告
 */

(function migrateTimerLogsToChildEventIds() {
  console.log('🚀 开始数据迁移：timerLogs → childEventIds');
  console.log('='.repeat(60));

  // 获取所有事件
  const storageKey = 'remarkable-events';
  const eventsJson = localStorage.getItem(storageKey);
  
  if (!eventsJson) {
    console.error('❌ 未找到事件数据');
    return {
      success: false,
      error: '未找到事件数据'
    };
  }

  let events;
  try {
    events = JSON.parse(eventsJson);
  } catch (error) {
    console.error('❌ 解析事件数据失败:', error);
    return {
      success: false,
      error: '解析事件数据失败'
    };
  }

  console.log(`📊 总事件数: ${events.length}`);

  // 统计信息
  const stats = {
    totalEvents: events.length,
    eventsWithTimerLogs: 0,
    timerLogsMigrated: 0,
    eventsWithBothFields: 0,
    merged: 0,
    errors: []
  };

  // 遍历所有事件，迁移 timerLogs 到 childEventIds
  events.forEach((event, index) => {
    try {
      const hasTimerLogs = event.timerLogs && Array.isArray(event.timerLogs) && event.timerLogs.length > 0;
      const hasChildEventIds = event.childEventIds && Array.isArray(event.childEventIds) && event.childEventIds.length > 0;

      if (hasTimerLogs) {
        stats.eventsWithTimerLogs++;

        if (hasChildEventIds) {
          // 情况1: 同时有两个字段 → 合并去重
          stats.eventsWithBothFields++;
          
          const combined = [...new Set([...event.childEventIds, ...event.timerLogs])];
          
          console.log(`🔀 合并事件 ${event.id}:`, {
            childEventIds: event.childEventIds.length,
            timerLogs: event.timerLogs.length,
            combined: combined.length
          });
          
          event.childEventIds = combined;
          stats.merged++;
        } else {
          // 情况2: 只有 timerLogs → 直接迁移
          console.log(`📦 迁移事件 ${event.id}:`, {
            timerLogs: event.timerLogs.length,
            ids: event.timerLogs
          });
          
          event.childEventIds = [...event.timerLogs];
          stats.timerLogsMigrated++;
        }

        // 删除旧字段
        delete event.timerLogs;
      }
    } catch (error) {
      console.error(`❌ 处理事件 ${event.id} 时出错:`, error);
      stats.errors.push({
        eventId: event.id,
        error: error.message
      });
    }
  });

  // 保存更新后的数据
  try {
    localStorage.setItem(storageKey, JSON.stringify(events));
    console.log('✅ 数据已保存到 localStorage');
  } catch (error) {
    console.error('❌ 保存数据失败:', error);
    return {
      success: false,
      error: '保存数据失败',
      stats
    };
  }

  // 验证迁移结果
  console.log('\n' + '='.repeat(60));
  console.log('📋 迁移报告:');
  console.log('='.repeat(60));
  console.log(`总事件数:                ${stats.totalEvents}`);
  console.log(`有 timerLogs 的事件:     ${stats.eventsWithTimerLogs}`);
  console.log(`  - 仅迁移:              ${stats.timerLogsMigrated}`);
  console.log(`  - 合并到 childEventIds: ${stats.merged}`);
  console.log(`同时有两字段的事件:      ${stats.eventsWithBothFields}`);
  console.log(`迁移的子事件总数:        ${stats.timerLogsMigrated + stats.merged}`);
  console.log(`错误数:                  ${stats.errors.length}`);

  if (stats.errors.length > 0) {
    console.log('\n❌ 错误详情:');
    stats.errors.forEach(err => {
      console.log(`  - ${err.eventId}: ${err.error}`);
    });
  }

  // 数据完整性验证
  console.log('\n' + '='.repeat(60));
  console.log('🔍 数据完整性验证:');
  console.log('='.repeat(60));

  const updatedEvents = JSON.parse(localStorage.getItem(storageKey));
  
  // 检查是否还有 timerLogs 字段
  const remainingTimerLogs = updatedEvents.filter(e => e.timerLogs !== undefined);
  if (remainingTimerLogs.length > 0) {
    console.warn(`⚠️ 仍有 ${remainingTimerLogs.length} 个事件包含 timerLogs 字段`);
    remainingTimerLogs.forEach(e => {
      console.log(`  - ${e.id}: ${e.timerLogs}`);
    });
  } else {
    console.log('✅ 所有 timerLogs 字段已清理');
  }

  // 检查 childEventIds 的数据
  const withChildEventIds = updatedEvents.filter(e => e.childEventIds && e.childEventIds.length > 0);
  console.log(`✅ ${withChildEventIds.length} 个事件包含 childEventIds`);

  // 验证父子关联的完整性
  let orphanChildren = 0;
  let invalidChildRefs = 0;

  updatedEvents.forEach(event => {
    // 验证子事件的 parentEventId 是否有效
    if (event.parentEventId) {
      const parent = updatedEvents.find(e => e.id === event.parentEventId);
      if (!parent) {
        orphanChildren++;
        console.warn(`⚠️ 孤立子事件: ${event.id} → 父事件不存在: ${event.parentEventId}`);
      }
    }

    // 验证 childEventIds 指向的事件是否存在
    if (event.childEventIds && event.childEventIds.length > 0) {
      event.childEventIds.forEach(childId => {
        const child = updatedEvents.find(e => e.id === childId);
        if (!child) {
          invalidChildRefs++;
          console.warn(`⚠️ 无效子事件引用: ${event.id} → 子事件不存在: ${childId}`);
        }
      });
    }
  });

  console.log(`\n孤立子事件: ${orphanChildren}`);
  console.log(`无效子事件引用: ${invalidChildRefs}`);

  console.log('\n' + '='.repeat(60));
  console.log('🎉 迁移完成!');
  console.log('='.repeat(60));

  // 刷新页面提示
  if (stats.eventsWithTimerLogs > 0) {
    console.log('\n⚠️ 建议刷新页面以应用更改');
  }

  return {
    success: true,
    stats: {
      ...stats,
      withChildEventIds: withChildEventIds.length,
      orphanChildren,
      invalidChildRefs
    }
  };
})();
