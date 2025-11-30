/**
 * 从 Outlook 恢复数据脚本
 * 
 * 场景：本地数据丢失，但 Outlook 还有完整数据
 * 
 * 策略：
 * 1. 检查当前本地事件数量
 * 2. 连接到 Microsoft Graph API
 * 3. 拉取所有日历的所有事件
 * 4. 与本地数据合并（保留更新的版本）
 * 5. 显示恢复摘要
 * 
 * 使用方法：
 * 1. 确保已登录 Microsoft 账户
 * 2. 在浏览器控制台执行本脚本
 * 3. 等待拉取完成（可能需要几分钟）
 * 4. 查看恢复报告并确认
 * 
 * @created 2025-12-01
 * @version 1.0.0
 */

(async function recoverFromOutlook() {
  console.log('🌐' + '='.repeat(60));
  console.log('🌐 从 Outlook 恢复数据 - 开始执行');
  console.log('🌐' + '='.repeat(60));

  // ========== 步骤 1: 检查当前状态 ==========
  console.log('\n📊 步骤 1: 检查当前状态...');
  
  const currentEventsJson = localStorage.getItem('remarkable-events');
  let currentEvents = [];
  try {
    currentEvents = currentEventsJson ? JSON.parse(currentEventsJson) : [];
    console.log(`✅ 当前本地事件数: ${currentEvents.length}`);
  } catch (error) {
    console.error('❌ 读取本地数据失败:', error);
    return { success: false, error: '读取本地数据失败' };
  }

  // 检查 MicrosoftService
  if (typeof window.microsoftService === 'undefined') {
    console.error('❌ 未找到 MicrosoftService');
    console.log('💡 提示: 请确保已登录 Microsoft 账户');
    return { success: false, error: '未找到 MicrosoftService' };
  }

  const isSignedIn = window.microsoftService.isSignedIn();
  if (!isSignedIn) {
    console.error('❌ 未登录 Microsoft 账户');
    console.log('💡 提示: 请先登录 Microsoft 账户后再执行此脚本');
    return { success: false, error: '未登录 Microsoft 账户' };
  }

  console.log('✅ Microsoft 账户已登录');

  // ========== 步骤 2: 获取所有日历 ==========
  console.log('\n📅 步骤 2: 获取日历列表...');
  
  let calendars = [];
  try {
    calendars = await window.microsoftService.getCalendars();
    console.log(`✅ 找到 ${calendars.length} 个日历:`);
    calendars.forEach(cal => {
      console.log(`   - ${cal.name} (${cal.id.slice(0, 20)}...)`);
    });
  } catch (error) {
    console.error('❌ 获取日历失败:', error);
    return { success: false, error: '获取日历失败' };
  }

  // ========== 步骤 3: 拉取所有事件 ==========
  console.log('\n📥 步骤 3: 从 Outlook 拉取所有事件...');
  console.log('⏳ 这可能需要几分钟，请耐心等待...');
  
  const outlookEvents = [];
  const errors = [];
  
  // 定义时间范围（过去1年到未来2年）
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - 1);
  const endDate = new Date();
  endDate.setFullYear(endDate.getFullYear() + 2);
  
  console.log(`📅 时间范围: ${startDate.toISOString().split('T')[0]} 到 ${endDate.toISOString().split('T')[0]}`);

  for (let i = 0; i < calendars.length; i++) {
    const calendar = calendars[i];
    console.log(`\n📦 [${i + 1}/${calendars.length}] 拉取日历: ${calendar.name}...`);
    
    try {
      const events = await window.microsoftService.getEvents(
        calendar.id,
        startDate.toISOString(),
        endDate.toISOString()
      );
      
      console.log(`   ✅ 拉取到 ${events.length} 个事件`);
      outlookEvents.push(...events);
    } catch (error) {
      console.error(`   ❌ 拉取失败:`, error.message);
      errors.push({ calendar: calendar.name, error: error.message });
    }
  }

  console.log(`\n✅ Outlook 拉取完成: 共 ${outlookEvents.length} 个事件`);
  if (errors.length > 0) {
    console.warn(`⚠️ ${errors.length} 个日历拉取失败`);
  }

  // ========== 步骤 4: 转换 Outlook 数据格式 ==========
  console.log('\n🔄 步骤 4: 转换数据格式...');
  
  /**
   * 转换时间格式为本地格式（空格分隔）
   */
  function formatTime(dateInput) {
    if (!dateInput) return undefined;
    
    try {
      let dateObj;
      if (typeof dateInput === 'string') {
        dateObj = new Date(dateInput);
      } else if (dateInput.dateTime) {
        dateObj = new Date(dateInput.dateTime);
      } else {
        dateObj = new Date(dateInput);
      }
      
      if (isNaN(dateObj.getTime())) {
        console.warn('⚠️ 无效的时间:', dateInput);
        return undefined;
      }
      
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      const seconds = String(dateObj.getSeconds()).padStart(2, '0');
      
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
    } catch (error) {
      console.error('❌ 时间转换失败:', dateInput, error);
      return undefined;
    }
  }

  const convertedEvents = outlookEvents.map(outlookEvent => {
    // 清理描述（移除 HTML 标签）
    let description = '';
    if (outlookEvent.body?.content) {
      description = outlookEvent.body.content
        .replace(/<[^>]*>/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .trim();
    }

    const title = outlookEvent.subject || '(无标题)';
    
    return {
      id: `outlook-${outlookEvent.id}`,
      externalId: outlookEvent.id,
      source: 'outlook',
      remarkableSource: false,
      title: {
        simpleTitle: title,
        colorTitle: title,
        fullTitle: JSON.stringify([{ type: 'paragraph', children: [{ text: title }] }])
      },
      description: description,
      startTime: formatTime(outlookEvent.start?.dateTime || outlookEvent.start),
      endTime: formatTime(outlookEvent.end?.dateTime || outlookEvent.end),
      location: outlookEvent.location?.displayName || '',
      isAllDay: outlookEvent.isAllDay || false,
      calendarId: outlookEvent.calendarId,
      calendarIds: outlookEvent.calendarId ? [outlookEvent.calendarId] : [],
      syncStatus: 'synced',
      createdAt: formatTime(outlookEvent.createdDateTime || new Date()),
      updatedAt: formatTime(outlookEvent.lastModifiedDateTime || new Date()),
      lastSyncTime: formatTime(new Date()),
      tags: [],
      attendees: outlookEvent.attendees || []
    };
  }).filter(event => {
    // 过滤掉时间转换失败的事件
    if (!event.startTime || !event.endTime) {
      console.warn(`⚠️ 跳过时间无效的事件: ${event.title.simpleTitle}`);
      return false;
    }
    return true;
  });

  console.log(`✅ 转换完成: ${convertedEvents.length} 个有效事件`);

  // ========== 步骤 5: 合并数据 ==========
  console.log('\n🔀 步骤 5: 合并本地和 Outlook 数据...');
  
  const eventMap = new Map();
  
  // 先添加本地数据
  currentEvents.forEach(event => {
    eventMap.set(event.id, {
      ...event,
      _source: 'local'
    });
  });

  // 再添加 Outlook 数据（如果本地没有，或者 Outlook 更新）
  let added = 0;
  let updated = 0;
  let skipped = 0;

  convertedEvents.forEach(outlookEvent => {
    const existing = eventMap.get(outlookEvent.id);
    
    if (!existing) {
      // 本地没有，添加
      eventMap.set(outlookEvent.id, {
        ...outlookEvent,
        _source: 'outlook-new'
      });
      added++;
    } else {
      // 本地有，比较时间戳
      const existingTime = new Date(existing.updatedAt || existing.createdAt || 0);
      const outlookTime = new Date(outlookEvent.updatedAt || outlookEvent.createdAt || 0);
      
      if (outlookTime > existingTime) {
        // Outlook 更新，替换
        eventMap.set(outlookEvent.id, {
          ...outlookEvent,
          _source: 'outlook-updated'
        });
        updated++;
      } else {
        skipped++;
      }
    }
  });

  const mergedEvents = Array.from(eventMap.values());
  
  console.log(`✅ 合并完成:`);
  console.log(`   - 原本地事件: ${currentEvents.length}`);
  console.log(`   - Outlook 事件: ${convertedEvents.length}`);
  console.log(`   - 新增事件: ${added}`);
  console.log(`   - 更新事件: ${updated}`);
  console.log(`   - 跳过事件: ${skipped}`);
  console.log(`   - 合并后总数: ${mergedEvents.length}`);

  // ========== 步骤 6: 数据验证 ==========
  console.log('\n🔍 步骤 6: 验证数据完整性...');
  
  const validation = {
    valid: 0,
    warnings: 0,
    issues: []
  };

  mergedEvents.forEach(event => {
    const issues = [];
    
    if (!event.startTime || !event.endTime) {
      issues.push('缺少时间');
    }
    
    // 检查时间格式
    const validFormat = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
    if (event.startTime && !validFormat.test(event.startTime)) {
      issues.push(`startTime 格式错误: ${event.startTime}`);
    }
    if (event.endTime && !validFormat.test(event.endTime)) {
      issues.push(`endTime 格式错误: ${event.endTime}`);
    }
    
    if (issues.length > 0) {
      validation.warnings++;
      validation.issues.push({
        id: event.id,
        title: event.title?.simpleTitle || 'Unknown',
        issues
      });
    } else {
      validation.valid++;
    }
  });

  console.log(`✅ 验证完成:`);
  console.log(`   - 有效事件: ${validation.valid}`);
  console.log(`   - 警告事件: ${validation.warnings}`);

  if (validation.warnings > 0 && validation.warnings < 10) {
    console.log('\n⚠️ 前 10 个警告:');
    validation.issues.slice(0, 10).forEach(issue => {
      console.log(`   - ${issue.title}: ${issue.issues.join(', ')}`);
    });
  }

  // ========== 最终报告 ==========
  console.log('\n' + '='.repeat(60));
  console.log('📋 恢复摘要:');
  console.log('='.repeat(60));
  console.log(`当前本地事件:   ${currentEvents.length}`);
  console.log(`Outlook 事件:    ${convertedEvents.length}`);
  console.log(`合并后总数:      ${mergedEvents.length}`);
  console.log(`🎉 恢复事件数:   ${added} (新增) + ${updated} (更新) = ${added + updated}`);
  console.log(`有效事件:        ${validation.valid}`);
  console.log(`警告事件:        ${validation.warnings}`);
  console.log('='.repeat(60));

  // ========== 用户确认 ==========
  console.log('\n⚠️ 恢复操作需要手动确认！');
  console.log('\n请检查以下内容：');
  console.log('1. 合并后的事件数是否符合预期？');
  console.log('2. 恢复的事件数是否合理？');
  console.log('3. 警告事件数是否在可接受范围内？');
  
  console.log('\n如果确认无误，请执行以下命令应用恢复：');
  console.log('\n1️⃣ 创建备份（重要！）：');
  console.log('   localStorage.setItem("remarkable-events-before-outlook-recovery", localStorage.getItem("remarkable-events"))');
  
  console.log('\n2️⃣ 应用恢复：');
  console.log('   recoveryResult.applyRecovery()');
  
  console.log('\n3️⃣ 刷新页面：');
  console.log('   location.reload()');

  // 返回结果对象
  return {
    success: true,
    stats: {
      currentCount: currentEvents.length,
      outlookCount: convertedEvents.length,
      mergedCount: mergedEvents.length,
      added,
      updated,
      skipped,
      valid: validation.valid,
      warnings: validation.warnings
    },
    mergedEvents,
    validation,
    errors,
    // 提供快速恢复函数
    applyRecovery: function() {
      console.log('🚨 开始应用 Outlook 恢复...');
      
      // 移除 _source 标记
      const cleanEvents = mergedEvents.map(e => {
        const { _source, ...event } = e;
        return event;
      });
      
      // 创建安全备份
      const currentBackup = localStorage.getItem('remarkable-events');
      if (currentBackup) {
        localStorage.setItem('remarkable-events-before-outlook-recovery', currentBackup);
        console.log('✅ 已创建当前数据备份: remarkable-events-before-outlook-recovery');
      }
      
      // 应用恢复
      localStorage.setItem('remarkable-events', JSON.stringify(cleanEvents));
      console.log(`✅ 已恢复 ${cleanEvents.length} 个事件`);
      console.log(`   - 新增: ${added} 个`);
      console.log(`   - 更新: ${updated} 个`);
      
      // 清空同步队列（避免冲突）
      localStorage.removeItem('sync-action-queue');
      console.log('✅ 已清空同步队列');
      
      console.log('\n⚠️ 请刷新页面以应用更改: location.reload()');
    }
  };
})();
