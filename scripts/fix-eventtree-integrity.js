/**
 * 数据修复脚本：清理 EventTree 的孤立关联和无效引用
 * 
 * 修复内容：
 * 1. 孤立子事件：清除指向不存在父事件的 parentEventId
 * 2. 无效子事件引用：从 childEventIds 中移除不存在的子事件ID
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 查看修复结果报告
 */

(function fixEventTreeIntegrity() {
  console.log('🔧 开始修复 EventTree 数据完整性');
  console.log('='.repeat(60));

  // 获取所有事件
  const storageKey = 'remarkable-events';
  const eventsJson = localStorage.getItem(storageKey);
  
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

  console.log(`📊 总事件数: ${events.length}`);

  // 创建事件ID索引（快速查找）
  const eventIdSet = new Set(events.map(e => e.id));

  // 统计信息
  const stats = {
    totalEvents: events.length,
    orphanChildrenFixed: 0,
    invalidChildRefsRemoved: 0,
    emptyChildEventIdsRemoved: 0,
    errors: []
  };

  // 修复1: 清理孤立子事件的 parentEventId
  console.log('\n🔍 修复 1: 检查孤立子事件...');
  events.forEach(event => {
    if (event.parentEventId) {
      if (!eventIdSet.has(event.parentEventId)) {
        console.log(`🔧 清理孤立子事件: ${event.id} → 父事件不存在: ${event.parentEventId}`);
        delete event.parentEventId;
        stats.orphanChildrenFixed++;
      }
    }
  });

  // 修复2: 清理无效的子事件引用
  console.log('\n🔍 修复 2: 检查无效子事件引用...');
  events.forEach(event => {
    if (event.childEventIds && event.childEventIds.length > 0) {
      const validChildIds = event.childEventIds.filter(childId => {
        const isValid = eventIdSet.has(childId);
        if (!isValid) {
          console.log(`🔧 移除无效引用: ${event.id} → 子事件不存在: ${childId}`);
          stats.invalidChildRefsRemoved++;
        }
        return isValid;
      });

      if (validChildIds.length === 0) {
        // 如果所有子事件都无效，删除整个字段
        delete event.childEventIds;
        stats.emptyChildEventIdsRemoved++;
        console.log(`🔧 删除空的 childEventIds: ${event.id}`);
      } else if (validChildIds.length !== event.childEventIds.length) {
        // 更新为有效的子事件列表
        event.childEventIds = validChildIds;
      }
    }
  });

  // 修复3: 验证双向关联的一致性
  console.log('\n🔍 修复 3: 验证双向关联...');
  const inconsistencies = [];

  events.forEach(event => {
    if (event.childEventIds && event.childEventIds.length > 0) {
      event.childEventIds.forEach(childId => {
        const child = events.find(e => e.id === childId);
        if (child) {
          // 子事件应该指向当前事件作为父事件
          if (child.parentEventId !== event.id) {
            inconsistencies.push({
              parentId: event.id,
              childId: childId,
              childParentId: child.parentEventId,
              issue: child.parentEventId ? '子事件指向其他父事件' : '子事件缺少 parentEventId'
            });
          }
        }
      });
    }
  });

  if (inconsistencies.length > 0) {
    console.log(`⚠️ 发现 ${inconsistencies.length} 个双向关联不一致:`);
    inconsistencies.forEach(inc => {
      console.log(`  - 父事件 ${inc.parentId} → 子事件 ${inc.childId}`);
      console.log(`    问题: ${inc.issue}`);
      if (inc.childParentId) {
        console.log(`    子事件的 parentEventId: ${inc.childParentId}`);
      }
    });
    console.log('\n💡 建议: 手动检查这些事件，决定是否需要修复双向关联');
  } else {
    console.log('✅ 双向关联一致性验证通过');
  }

  // 保存修复后的数据
  if (stats.orphanChildrenFixed > 0 || stats.invalidChildRefsRemoved > 0 || stats.emptyChildEventIdsRemoved > 0) {
    try {
      localStorage.setItem(storageKey, JSON.stringify(events));
      console.log('\n✅ 修复后的数据已保存到 localStorage');
    } catch (error) {
      console.error('❌ 保存数据失败:', error);
      return {
        success: false,
        error: '保存数据失败',
        stats
      };
    }
  } else {
    console.log('\n✅ 没有发现需要修复的数据');
  }

  // 输出修复报告
  console.log('\n' + '='.repeat(60));
  console.log('📋 修复报告:');
  console.log('='.repeat(60));
  console.log(`总事件数:                   ${stats.totalEvents}`);
  console.log(`修复的孤立子事件:           ${stats.orphanChildrenFixed}`);
  console.log(`移除的无效子事件引用:       ${stats.invalidChildRefsRemoved}`);
  console.log(`删除的空 childEventIds:     ${stats.emptyChildEventIdsRemoved}`);
  console.log(`双向关联不一致:             ${inconsistencies.length}`);

  // 最终验证
  console.log('\n' + '='.repeat(60));
  console.log('🔍 最终验证:');
  console.log('='.repeat(60));

  const finalEvents = JSON.parse(localStorage.getItem(storageKey));
  
  let finalOrphans = 0;
  let finalInvalidRefs = 0;

  finalEvents.forEach(event => {
    // 验证孤立子事件
    if (event.parentEventId) {
      const parent = finalEvents.find(e => e.id === event.parentEventId);
      if (!parent) {
        finalOrphans++;
      }
    }

    // 验证无效引用
    if (event.childEventIds && event.childEventIds.length > 0) {
      event.childEventIds.forEach(childId => {
        const child = finalEvents.find(e => e.id === childId);
        if (!child) {
          finalInvalidRefs++;
        }
      });
    }
  });

  console.log(`剩余孤立子事件:    ${finalOrphans}`);
  console.log(`剩余无效引用:      ${finalInvalidRefs}`);

  if (finalOrphans === 0 && finalInvalidRefs === 0) {
    console.log('✅ 数据完整性验证通过！');
  } else {
    console.warn('⚠️ 仍有数据问题，可能需要进一步检查');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎉 修复完成!');
  console.log('='.repeat(60));

  // 刷新页面提示
  if (stats.orphanChildrenFixed > 0 || stats.invalidChildRefsRemoved > 0) {
    console.log('\n⚠️ 建议刷新页面以应用更改');
  }

  return {
    success: true,
    stats: {
      ...stats,
      inconsistencies: inconsistencies.length,
      finalOrphans,
      finalInvalidRefs
    }
  };
})();
