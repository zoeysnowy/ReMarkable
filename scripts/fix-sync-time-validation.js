/**
 * 修复同步时间验证问题的脚本
 * 
 * 问题根源：
 * 1. ActionBasedSyncManager 使用了错误的时间格式（ISO 8601 T分隔）
 * 2. EventService 验证器要求空格分隔格式
 * 3. 导致从 Outlook 同步的事件验证失败被删除
 * 
 * 修复方案：
 * 1. 扫描所有事件的时间格式
 * 2. 将 ISO 8601 格式转换为空格分隔格式
 * 3. 修复 syncStatus 状态
 * 4. 清理失败的同步动作队列
 * 
 * 使用方法：
 * 1. 在浏览器控制台打开 ReMarkable 应用
 * 2. 复制本脚本内容到控制台执行
 * 3. 查看修复结果报告
 * 
 * @created 2025-12-01
 * @version 1.0.0
 */

(function fixSyncTimeValidation() {
  console.log('🔧 开始修复同步时间验证问题');
  console.log('='.repeat(60));

  const stats = {
    totalEvents: 0,
    invalidTimeFormats: 0,
    fixedTimeFormats: 0,
    syncStatusFixed: 0,
    actionQueueCleaned: 0
  };

  // ========== 步骤 1: 读取数据 ==========
  console.log('\n📊 步骤 1: 读取事件数据...');
  
  const eventsJson = localStorage.getItem('remarkable-events');
  if (!eventsJson) {
    console.error('❌ 未找到事件数据');
    return { success: false, error: '未找到事件数据' };
  }

  let events;
  try {
    events = JSON.parse(eventsJson);
    stats.totalEvents = events.length;
    console.log(`✅ 读取成功: ${stats.totalEvents} 个事件`);
  } catch (error) {
    console.error('❌ 解析事件数据失败:', error);
    return { success: false, error: '解析事件数据失败' };
  }

  // ========== 步骤 2: 修复时间格式 ==========
  console.log('\n🔧 步骤 2: 修复时间格式（ISO 8601 → YYYY-MM-DD HH:mm:ss）...');
  
  const isoFormat = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/;
  const localFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
  
  /**
   * 转换 ISO 8601 时间为本地格式
   */
  function convertToLocalFormat(timeStr) {
    if (!timeStr) return timeStr;
    
    // 已经是正确格式
    if (localFormat.test(timeStr)) {
      return timeStr;
    }
    
    // 是 ISO 8601 格式，需要转换
    if (isoFormat.test(timeStr) || timeStr.includes('T')) {
      try {
        const date = new Date(timeStr);
        if (isNaN(date.getTime())) {
          console.warn(`⚠️ 无效的时间字符串: ${timeStr}`);
          return timeStr;
        }
        
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        
        return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
      } catch (error) {
        console.error(`❌ 转换失败: ${timeStr}`, error);
        return timeStr;
      }
    }
    
    return timeStr;
  }

  events.forEach(event => {
    let eventFixed = false;
    
    // 修复 startTime
    if (event.startTime && !localFormat.test(event.startTime)) {
      const originalStart = event.startTime;
      event.startTime = convertToLocalFormat(event.startTime);
      if (event.startTime !== originalStart) {
        if (stats.invalidTimeFormats < 5) {
          console.log(`🔧 修复 startTime: ${event.id.slice(-8)}`);
          console.log(`   ${originalStart} → ${event.startTime}`);
        }
        stats.invalidTimeFormats++;
        eventFixed = true;
      }
    }
    
    // 修复 endTime
    if (event.endTime && !localFormat.test(event.endTime)) {
      const originalEnd = event.endTime;
      event.endTime = convertToLocalFormat(event.endTime);
      if (event.endTime !== originalEnd) {
        if (stats.invalidTimeFormats < 5) {
          console.log(`🔧 修复 endTime: ${event.id.slice(-8)}`);
          console.log(`   ${originalEnd} → ${event.endTime}`);
        }
        stats.invalidTimeFormats++;
        eventFixed = true;
      }
    }
    
    // 修复 dueDate
    if (event.dueDate && !localFormat.test(event.dueDate)) {
      const originalDue = event.dueDate;
      event.dueDate = convertToLocalFormat(event.dueDate);
      if (event.dueDate !== originalDue) {
        eventFixed = true;
      }
    }
    
    // 修复 lastSyncTime
    if (event.lastSyncTime && !localFormat.test(event.lastSyncTime)) {
      event.lastSyncTime = convertToLocalFormat(event.lastSyncTime);
      eventFixed = true;
    }
    
    // 修复 updatedAt
    if (event.updatedAt && !localFormat.test(event.updatedAt)) {
      event.updatedAt = convertToLocalFormat(event.updatedAt);
      eventFixed = true;
    }
    
    // 修复 createdAt
    if (event.createdAt && !localFormat.test(event.createdAt)) {
      event.createdAt = convertToLocalFormat(event.createdAt);
      eventFixed = true;
    }
    
    if (eventFixed) {
      stats.fixedTimeFormats++;
    }
    
    // 修复 syncStatus（如果有验证错误，重置为 pending）
    if (event.syncStatus === 'error' || event.syncStatus === 'failed') {
      event.syncStatus = 'pending';
      stats.syncStatusFixed++;
    }
  });

  console.log(`✅ 时间格式修复完成:`);
  console.log(`   - 发现错误格式: ${stats.invalidTimeFormats} 个字段`);
  console.log(`   - 修复事件数: ${stats.fixedTimeFormats} 个事件`);
  console.log(`   - 修复同步状态: ${stats.syncStatusFixed} 个事件`);

  // ========== 步骤 3: 清理同步队列 ==========
  console.log('\n🧹 步骤 3: 清理失败的同步动作队列...');
  
  const actionQueueJson = localStorage.getItem('sync-action-queue');
  if (actionQueueJson) {
    try {
      const actionQueue = JSON.parse(actionQueueJson);
      const originalLength = actionQueue.length;
      
      // 移除验证失败的动作
      const cleanedQueue = actionQueue.filter(action => {
        if (action.lastError && action.lastError.includes('Invalid time format')) {
          stats.actionQueueCleaned++;
          return false;
        }
        return true;
      });
      
      if (cleanedQueue.length < originalLength) {
        localStorage.setItem('sync-action-queue', JSON.stringify(cleanedQueue));
        console.log(`✅ 清理同步队列:`);
        console.log(`   - 原队列长度: ${originalLength}`);
        console.log(`   - 清理后长度: ${cleanedQueue.length}`);
        console.log(`   - 移除失败动作: ${stats.actionQueueCleaned}`);
      } else {
        console.log(`✅ 同步队列干净，无需清理`);
      }
    } catch (error) {
      console.warn('⚠️ 清理同步队列失败:', error);
    }
  } else {
    console.log(`✅ 未找到同步队列`);
  }

  // ========== 步骤 4: 保存修复后的数据 ==========
  if (stats.fixedTimeFormats > 0 || stats.syncStatusFixed > 0) {
    console.log('\n💾 步骤 4: 保存修复后的数据...');
    
    try {
      // 创建备份
      localStorage.setItem('remarkable-events-before-time-fix', eventsJson);
      console.log('✅ 已创建备份: remarkable-events-before-time-fix');
      
      // 保存修复后的数据
      localStorage.setItem('remarkable-events', JSON.stringify(events));
      console.log('✅ 修复后的数据已保存');
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

  // ========== 最终报告 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📋 修复报告:');
  console.log('='.repeat(60));
  console.log(`总事件数:               ${stats.totalEvents}`);
  console.log(`错误时间格式:           ${stats.invalidTimeFormats} 个字段`);
  console.log(`修复的事件:             ${stats.fixedTimeFormats} 个`);
  console.log(`修复的同步状态:         ${stats.syncStatusFixed} 个`);
  console.log(`清理的同步队列动作:     ${stats.actionQueueCleaned} 个`);
  console.log('='.repeat(60));

  if (stats.fixedTimeFormats > 0 || stats.syncStatusFixed > 0 || stats.actionQueueCleaned > 0) {
    console.log('\n⚠️ 建议刷新页面以应用更改: location.reload()');
  }

  return {
    success: true,
    stats
  };
})();
