/**
 * 同步队列清理脚本
 * 
 * 功能：
 * 1. 移除指向不存在事件的操作
 * 2. 清理已同步超过7天的操作
 * 3. 可选：清理所有已同步的操作
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 根据提示选择清理策略
 * 
 * 清理策略：
 * - mode: 'invalid' - 仅清理失效操作（推荐）
 * - mode: 'old' - 清理失效操作 + 7天前的已同步操作
 * - mode: 'all-synced' - 清理所有已同步操作（激进）
 */

(function cleanSyncQueue(options = {}) {
  const { 
    mode = 'invalid',  // 'invalid' | 'old' | 'all-synced'
    dryRun = false      // true = 仅预览，不实际删除
  } = options;

  console.log('🧹 同步队列清理工具');
  console.log('='.repeat(80));
  console.log(`模式: ${mode}`);
  console.log(`预览模式: ${dryRun ? '是' : '否'}`);
  console.log('='.repeat(80));

  // 获取同步队列
  const queueKey = 'remarkable-sync-action-queue';
  const queueJson = localStorage.getItem(queueKey);
  
  if (!queueJson) {
    console.log('✅ 同步队列为空，无需清理');
    return { success: true, stats: { removed: 0 } };
  }

  let actionQueue;
  try {
    actionQueue = JSON.parse(queueJson);
  } catch (error) {
    console.error('❌ 解析同步队列失败:', error);
    return { success: false, error: '解析同步队列失败' };
  }

  const originalCount = actionQueue.length;
  console.log(`\n📊 原始队列大小: ${originalCount}`);

  // 获取所有事件
  const eventsKey = 'remarkable-events';
  const eventsJson = localStorage.getItem(eventsKey);
  
  if (!eventsJson) {
    console.error('❌ 未找到事件数据');
    return { success: false, error: '未找到事件数据' };
  }

  let events;
  try {
    events = JSON.parse(eventsJson);
  } catch (error) {
    console.error('❌ 解析事件数据失败:', error);
    return { success: false, error: '解析事件数据失败' };
  }

  // 创建事件ID索引
  const eventIdSet = new Set(events.map(e => e.id));

  // 清理统计
  const stats = {
    originalCount,
    removed: 0,
    kept: 0,
    reasons: {
      invalidEventId: 0,
      oldSynced: 0,
      allSynced: 0
    }
  };

  const now = Date.now();
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const removedActions = [];

  // 过滤队列
  const cleanedQueue = actionQueue.filter((action, index) => {
    let shouldRemove = false;
    let reason = '';

    // 规则1: 移除失效的事件ID
    if (action.entityId && !eventIdSet.has(action.entityId)) {
      shouldRemove = true;
      reason = 'invalidEventId';
      stats.reasons.invalidEventId++;
    }

    // 规则2: 根据模式清理已同步操作
    if (!shouldRemove && action.synchronized) {
      if (mode === 'all-synced') {
        shouldRemove = true;
        reason = 'allSynced';
        stats.reasons.allSynced++;
      } else if (mode === 'old') {
        const actionTime = new Date(action.timestamp).getTime();
        if (actionTime < oneWeekAgo) {
          shouldRemove = true;
          reason = 'oldSynced';
          stats.reasons.oldSynced++;
        }
      }
    }

    if (shouldRemove) {
      stats.removed++;
      removedActions.push({ index, action, reason });
      return false;
    } else {
      stats.kept++;
      return true;
    }
  });

  // 输出清理详情（前10个）
  if (removedActions.length > 0) {
    console.log(`\n🗑️ 将要移除的操作 (前10个):`);
    console.log('='.repeat(80));
    
    removedActions.slice(0, 10).forEach((item, i) => {
      const action = item.action;
      const reasonText = {
        invalidEventId: '失效事件ID',
        oldSynced: '7天前已同步',
        allSynced: '已同步'
      }[item.reason];

      console.log(`\n${i + 1}. [${action.type.toUpperCase()}] ${action.source} - ${reasonText}`);
      console.log(`   操作ID: ${action.id}`);
      console.log(`   事件ID: ${action.entityId}`);
      console.log(`   时间: ${new Date(action.timestamp).toLocaleString('zh-CN')}`);
    });

    if (removedActions.length > 10) {
      console.log(`\n... 还有 ${removedActions.length - 10} 个操作未显示`);
    }
  }

  // 输出清理统计
  console.log(`\n\n📊 清理统计:`);
  console.log('='.repeat(80));
  console.log(`原始操作数:         ${stats.originalCount}`);
  console.log(`将移除:             ${stats.removed}`);
  console.log(`  - 失效事件ID:     ${stats.reasons.invalidEventId}`);
  if (mode === 'old' || mode === 'all-synced') {
    console.log(`  - 7天前已同步:    ${stats.reasons.oldSynced}`);
  }
  if (mode === 'all-synced') {
    console.log(`  - 所有已同步:     ${stats.reasons.allSynced}`);
  }
  console.log(`将保留:             ${stats.kept}`);
  console.log(`清理后队列大小:     ${cleanedQueue.length}`);

  const reductionPercent = ((stats.removed / stats.originalCount) * 100).toFixed(1);
  console.log(`\n📉 队列减小: ${reductionPercent}%`);

  // 保存清理后的队列
  if (!dryRun) {
    if (stats.removed > 0) {
      try {
        localStorage.setItem(queueKey, JSON.stringify(cleanedQueue));
        console.log('\n✅ 清理完成，队列已保存');
        console.log('⚠️ 建议刷新页面以应用更改');
      } catch (error) {
        console.error('❌ 保存队列失败:', error);
        return {
          success: false,
          error: '保存队列失败',
          stats
        };
      }
    } else {
      console.log('\n✅ 无需清理');
    }
  } else {
    console.log('\n👁️ 预览模式：未实际修改队列');
    console.log('💡 要执行清理，请使用: cleanSyncQueue({ mode: "invalid", dryRun: false })');
  }

  console.log('='.repeat(80));

  return {
    success: true,
    stats,
    removedActions: removedActions.slice(0, 20), // 返回前20个被移除的操作
    cleanedQueue: dryRun ? null : cleanedQueue
  };
})();

// 使用示例：
// 
// 1. 预览失效操作（推荐首次运行）
// cleanSyncQueue({ mode: 'invalid', dryRun: true })
//
// 2. 清理失效操作（推荐）
// cleanSyncQueue({ mode: 'invalid', dryRun: false })
//
// 3. 清理失效操作 + 7天前的已同步操作
// cleanSyncQueue({ mode: 'old', dryRun: false })
//
// 4. 清理所有已同步操作（激进，不推荐）
// cleanSyncQueue({ mode: 'all-synced', dryRun: false })
