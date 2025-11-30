/**
 * 同步队列诊断脚本
 * 
 * 功能：
 * 1. 分析同步队列中的操作
 * 2. 识别失效的操作（指向不存在的事件）
 * 3. 提供清理建议
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 查看诊断报告
 */

(function diagnoseSyncQueue() {
  console.log('🔍 开始诊断同步队列');
  console.log('='.repeat(80));

  // 获取同步队列
  const queueKey = 'remarkable-sync-action-queue';
  const queueJson = localStorage.getItem(queueKey);
  
  if (!queueJson) {
    console.log('✅ 同步队列为空');
    return { success: true, stats: { totalActions: 0 } };
  }

  let actionQueue;
  try {
    actionQueue = JSON.parse(queueJson);
  } catch (error) {
    console.error('❌ 解析同步队列失败:', error);
    return { success: false, error: '解析同步队列失败' };
  }

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

  console.log(`\n📊 基本统计:`);
  console.log(`  总事件数: ${events.length}`);
  console.log(`  队列操作数: ${actionQueue.length}`);

  // 分析同步队列
  const stats = {
    totalActions: actionQueue.length,
    byType: { create: 0, update: 0, delete: 0 },
    bySource: { local: 0, outlook: 0 },
    synchronized: 0,
    pending: 0,
    invalidEventIds: 0,
    validEventIds: 0,
    invalidActions: [],
    oldActions: 0,
    recentActions: 0
  };

  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  const oneWeekAgo = now - 7 * 24 * 60 * 60 * 1000;

  actionQueue.forEach((action, index) => {
    // 统计类型
    stats.byType[action.type] = (stats.byType[action.type] || 0) + 1;
    
    // 统计来源
    stats.bySource[action.source] = (stats.bySource[action.source] || 0) + 1;
    
    // 统计同步状态
    if (action.synchronized) {
      stats.synchronized++;
    } else {
      stats.pending++;
    }

    // 检查事件ID有效性
    if (action.entityId) {
      if (eventIdSet.has(action.entityId)) {
        stats.validEventIds++;
      } else {
        stats.invalidEventIds++;
        stats.invalidActions.push({
          index,
          id: action.id,
          type: action.type,
          source: action.source,
          entityId: action.entityId,
          timestamp: action.timestamp,
          synchronized: action.synchronized
        });
      }
    }

    // 统计操作时间
    const actionTime = new Date(action.timestamp).getTime();
    if (actionTime < oneWeekAgo) {
      stats.oldActions++;
    } else if (actionTime > oneDayAgo) {
      stats.recentActions++;
    }
  });

  // 输出详细统计
  console.log(`\n📈 队列分析:`);
  console.log('='.repeat(80));
  
  console.log(`\n操作类型分布:`);
  console.log(`  创建 (create): ${stats.byType.create}`);
  console.log(`  更新 (update): ${stats.byType.update}`);
  console.log(`  删除 (delete): ${stats.byType.delete}`);
  
  console.log(`\n操作来源分布:`);
  console.log(`  本地 (local):  ${stats.bySource.local}`);
  console.log(`  远程 (outlook): ${stats.bySource.outlook}`);
  
  console.log(`\n同步状态:`);
  console.log(`  已同步: ${stats.synchronized}`);
  console.log(`  待同步: ${stats.pending}`);
  
  console.log(`\n事件ID有效性:`);
  console.log(`  有效ID: ${stats.validEventIds} ✅`);
  console.log(`  失效ID: ${stats.invalidEventIds} ❌`);
  
  console.log(`\n操作时间分布:`);
  console.log(`  超过1周前: ${stats.oldActions}`);
  console.log(`  最近24小时: ${stats.recentActions}`);

  // 输出前10个失效操作的详情
  if (stats.invalidActions.length > 0) {
    console.log(`\n❌ 失效操作详情 (前10个):`);
    console.log('='.repeat(80));
    
    stats.invalidActions.slice(0, 10).forEach((action, i) => {
      console.log(`\n${i + 1}. [${action.type.toUpperCase()}] ${action.source}`);
      console.log(`   操作ID: ${action.id}`);
      console.log(`   事件ID: ${action.entityId}`);
      console.log(`   时间: ${new Date(action.timestamp).toLocaleString('zh-CN')}`);
      console.log(`   状态: ${action.synchronized ? '已同步' : '待同步'}`);
    });

    if (stats.invalidActions.length > 10) {
      console.log(`\n... 还有 ${stats.invalidActions.length - 10} 个失效操作未显示`);
    }
  }

  // 诊断建议
  console.log(`\n\n💡 诊断结果:`);
  console.log('='.repeat(80));

  if (stats.invalidEventIds === 0) {
    console.log('✅ 队列状态正常，没有失效操作');
  } else {
    const percentage = ((stats.invalidEventIds / stats.totalActions) * 100).toFixed(1);
    console.log(`⚠️ 发现 ${stats.invalidEventIds} 个失效操作 (${percentage}%)`);
    
    if (stats.invalidEventIds > 50) {
      console.log(`\n🔧 建议：立即清理失效操作`);
      console.log(`   运行清理脚本：clean-sync-queue.js`);
    } else if (stats.invalidEventIds > 10) {
      console.log(`\n🔧 建议：考虑清理失效操作`);
      console.log(`   运行清理脚本：clean-sync-queue.js`);
    }

    if (stats.oldActions > 100) {
      console.log(`\n⏰ 发现 ${stats.oldActions} 个超过1周的旧操作`);
      console.log(`   建议清理已同步的旧操作以减少队列大小`);
    }
  }

  console.log(`\n📊 完整统计信息已保存到返回值`);
  console.log('='.repeat(80));

  return {
    success: true,
    stats,
    invalidActions: stats.invalidActions,
    recommendation: stats.invalidEventIds > 50 ? 'immediate_cleanup' : 
                   stats.invalidEventIds > 10 ? 'cleanup_recommended' : 'healthy'
  };
})();
