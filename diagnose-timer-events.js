/**
 * 诊断Timer事件问题
 * 
 * 分析 6452 个本地事件的创建模式，找出异常
 */

const STORAGE_KEYS = {
  EVENTS: 'remarkable-events'
};

function diagnoseTimerEvents() {
  console.log('='.repeat(80));
  console.log('⏱️ Timer 事件诊断');
  console.log('='.repeat(80));
  console.log('');

  // 1. 读取所有事件
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  const localEvents = events.filter(e => !e.externalId);
  
  console.log(`📌 本地事件数: ${localEvents.length} / ${events.length}`);
  console.log('');

  // 2. 按 ID 模式分组
  const timerPattern = /^timer-/;
  const timerEvents = localEvents.filter(e => timerPattern.test(e.id));
  const otherLocalEvents = localEvents.filter(e => !timerPattern.test(e.id));
  
  console.log(`🔍 ID 模式分析:`);
  console.log(`   - timer-* 事件: ${timerEvents.length}`);
  console.log(`   - 其他本地事件: ${otherLocalEvents.length}`);
  console.log('');

  // 3. 按标题模式分组
  const autoTitlePattern = /^专注计时\d{4}-\d{2}-\d{2}/;
  const autoTitleEvents = localEvents.filter(e => autoTitlePattern.test(e.title));
  
  console.log(`🔍 标题模式分析:`);
  console.log(`   - 自动生成标题 "专注计时YYYY-MM-DD": ${autoTitleEvents.length}`);
  console.log(`   - 用户自定义标题: ${localEvents.length - autoTitleEvents.length}`);
  console.log('');

  // 4. 按时间分布分析（找出大量创建的时间点）
  // ✅ 使用本地时间解析（遵循 Time Architecture）
  const parseLocalTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(/[-\s:]/);
    if (parts.length < 3) return null;
    return new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
      parseInt(parts[3] || 0),
      parseInt(parts[4] || 0),
      parseInt(parts[5] || 0)
    );
  };
  
  const byDate = new Map();
  localEvents.forEach(event => {
    try {
      const dateObj = parseLocalTime(event.createdAt || event.startTime);
      if (!dateObj || isNaN(dateObj.getTime())) return;
      
      // 格式化为 YYYY-MM-DD（本地日期）
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const date = `${year}-${month}-${day}`;
      
      const count = byDate.get(date) || 0;
      byDate.set(date, count + 1);
    } catch (e) {
      // 忽略时间解析错误
    }
  });

  const dateStats = Array.from(byDate.entries())
    .sort((a, b) => b[1] - a[1]) // 按数量降序
    .slice(0, 10);

  console.log(`📅 事件创建日期分布 (Top 10):`);
  dateStats.forEach(([date, count]) => {
    const bar = '█'.repeat(Math.min(50, Math.floor(count / 10)));
    console.log(`   ${date}: ${count.toString().padStart(5)} ${bar}`);
  });
  console.log('');

  // 5. 检查时长分布（找出异常短或异常长的事件）
  const durationStats = {
    'lessThan1Min': 0,
    '1to5Min': 0,
    '5to30Min': 0,
    '30MinTo2Hr': 0,
    '2HrPlus': 0,
    'invalid': 0
  };

  localEvents.forEach(event => {
    try {
      const start = parseLocalTime(event.startTime);
      const end = parseLocalTime(event.endTime);
      if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
        durationStats.invalid++;
        return;
      }
      const durationMs = end.getTime() - start.getTime();
      const durationMin = durationMs / 60000;
      
      if (durationMin < 0 || durationMin > 24 * 60) {
        durationStats.invalid++;
      } else if (durationMin < 1) {
        durationStats.lessThan1Min++;
      } else if (durationMin < 5) {
        durationStats['1to5Min']++;
      } else if (durationMin < 30) {
        durationStats['5to30Min']++;
      } else if (durationMin < 120) {
        durationStats['30MinTo2Hr']++;
      } else {
        durationStats['2HrPlus']++;
      }
    } catch (e) {
      durationStats.invalid++;
    }
  });

  console.log(`⏱️ 事件时长分布:`);
  console.log(`   - < 1分钟 (疑似测试): ${durationStats.lessThan1Min}`);
  console.log(`   - 1-5分钟: ${durationStats['1to5Min']}`);
  console.log(`   - 5-30分钟: ${durationStats['5to30Min']}`);
  console.log(`   - 30分钟-2小时: ${durationStats['30MinTo2Hr']}`);
  console.log(`   - > 2小时: ${durationStats['2HrPlus']}`);
  console.log(`   - 无效时长: ${durationStats.invalid}`);
  console.log('');

  // 6. 检查相同时间范围的重复事件
  const timeRangeMap = new Map();
  localEvents.forEach(event => {
    const key = `${event.startTime}_${event.endTime}`;
    const existing = timeRangeMap.get(key) || [];
    existing.push(event);
    timeRangeMap.set(key, existing);
  });

  const duplicateTimeRanges = Array.from(timeRangeMap.entries())
    .filter(([_, events]) => events.length > 1)
    .sort((a, b) => b[1].length - a[1].length)
    .slice(0, 10);

  if (duplicateTimeRanges.length > 0) {
    console.log(`⚠️ 相同时间范围的重复事件 (Top 10):`);
    duplicateTimeRanges.forEach(([timeRange, events], index) => {
      const [start, end] = timeRange.split('_');
      console.log(`   ${index + 1}. ${start} → ${end}`);
      console.log(`      重复次数: ${events.length}`);
      console.log(`      标题:`, events.map(e => e.title.substring(0, 30)).slice(0, 3));
      console.log(`      ID:`, events.map(e => e.id.substring(0, 25)).slice(0, 3));
      console.log('');
    });
  }

  // 7. 检查标签分布
  const tagStats = new Map();
  localEvents.forEach(event => {
    const tags = event.tags || [];
    const key = tags.length === 0 ? '<无标签>' : tags.join(',');
    const count = tagStats.get(key) || 0;
    tagStats.set(key, count + 1);
  });

  const topTags = Array.from(tagStats.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  console.log(`🏷️ 标签分布 (Top 10):`);
  topTags.forEach(([tag, count]) => {
    const bar = '█'.repeat(Math.min(30, Math.floor(count / 50)));
    console.log(`   ${tag.padEnd(30)}: ${count.toString().padStart(5)} ${bar}`);
  });
  console.log('');

  // 8. 分析 description 内容模式
  const descPatterns = {
    '计时签名': 0, // [⏱️ 计时 X 分钟]
    '计时中的事件': 0,
    '计时事件（已自动保存）': 0,
    '空description': 0,
    '其他内容': 0
  };

  localEvents.forEach(event => {
    const desc = event.description || '';
    if (!desc.trim()) {
      descPatterns['空description']++;
    } else if (desc.includes('[⏱️ 计时')) {
      descPatterns['计时签名']++;
    } else if (desc === '计时中的事件') {
      descPatterns['计时中的事件']++;
    } else if (desc === '计时事件（已自动保存）') {
      descPatterns['计时事件（已自动保存）']++;
    } else {
      descPatterns['其他内容']++;
    }
  });

  console.log(`📝 Description 内容模式:`);
  Object.entries(descPatterns).forEach(([pattern, count]) => {
    console.log(`   ${pattern.padEnd(25)}: ${count}`);
  });
  console.log('');

  // 9. 建议操作
  console.log('='.repeat(80));
  console.log('💡 诊断结论');
  console.log('='.repeat(80));
  console.log('');

  const suspiciousCount = durationStats.lessThan1Min + duplicateTimeRanges.length;
  
  if (suspiciousCount > 100) {
    console.log(`⚠️ 发现 ${suspiciousCount} 个疑似异常事件`);
    console.log('');
    console.log('可能原因:');
    console.log('  1. Timer 测试时创建了大量短时长事件');
    console.log('  2. 相同时间范围的事件被重复创建');
    console.log('  3. App 重启或刷新时 Timer 状态未正确清理');
    console.log('');
  }

  if (autoTitleEvents.length > 1000) {
    console.log(`⚠️ 自动生成标题的事件过多: ${autoTitleEvents.length}`);
    console.log('   这可能是用户频繁启动无标签 Timer 导致的');
    console.log('');
  }

  console.log('🔧 清理建议:');
  console.log('   1. 删除所有 < 1分钟的测试事件');
  console.log('   2. 删除相同时间范围的重复事件（保留最新）');
  console.log('   3. 考虑添加 Timer 事件自动清理功能（如 30 天后删除）');
  console.log('');
  
  console.log('💾 使用以下函数清理:');
  console.log('   cleanupShortTimerEvents()    // 删除 < 1分钟的事件');
  console.log('   cleanupDuplicateTimeRanges() // 删除相同时间范围的重复');
  console.log('');

  return {
    total: events.length,
    localEvents: localEvents.length,
    timerEvents: timerEvents.length,
    autoTitleEvents: autoTitleEvents.length,
    durationStats,
    duplicateTimeRanges: duplicateTimeRanges.length,
    dateStats,
    topTags
  };
}

// 清理短时长事件（< 1分钟，疑似测试）
function cleanupShortTimerEvents() {
  console.log('🔧 开始清理短时长事件...');
  
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  const beforeCount = events.length;
  
  // ✅ 解析本地时间
  const parseLocalTime = (timeStr) => {
    if (!timeStr) return null;
    const parts = timeStr.split(/[-\s:]/);
    if (parts.length < 3) return null;
    return new Date(
      parseInt(parts[0]),
      parseInt(parts[1]) - 1,
      parseInt(parts[2]),
      parseInt(parts[3] || 0),
      parseInt(parts[4] || 0),
      parseInt(parts[5] || 0)
    );
  };
  
  const cleanedEvents = events.filter(event => {
    try {
      const start = parseLocalTime(event.startTime);
      const end = parseLocalTime(event.endTime);
      if (!start || !end) return true; // 保留解析失败的
      const durationMs = end.getTime() - start.getTime();
      const durationMin = durationMs / 60000;
      
      // 保留时长 >= 1分钟的事件
      return durationMin >= 1;
    } catch (e) {
      // 保留时间解析失败的事件（避免误删）
      return true;
    }
  });
  
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(cleanedEvents));
  
  const afterCount = cleanedEvents.length;
  const removed = beforeCount - afterCount;
  
  console.log(`✅ 清理完成！`);
  console.log(`   清理前: ${beforeCount} 个事件`);
  console.log(`   清理后: ${afterCount} 个事件`);
  console.log(`   删除了: ${removed} 个短时长事件`);
  console.log('');
  console.log('🔄 请刷新页面以重新加载数据');
  
  return { beforeCount, afterCount, removed };
}

// 清理相同时间范围的重复事件
function cleanupDuplicateTimeRanges() {
  console.log('🔧 开始清理相同时间范围的重复事件...');
  
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  const beforeCount = events.length;
  
  // 按时间范围分组
  const timeRangeMap = new Map();
  events.forEach(event => {
    const key = `${event.startTime}_${event.endTime}`;
    const existing = timeRangeMap.get(key) || [];
    existing.push(event);
    timeRangeMap.set(key, existing);
  });
  
  // 对每组保留最新的一个（按 updatedAt 或 createdAt）
  const cleanedEvents = [];
  timeRangeMap.forEach((group, timeRange) => {
    if (group.length === 1) {
      cleanedEvents.push(group[0]);
    } else {
      // 保留最新的
      // ✅ 解析本地时间
      const parseLocalTime = (timeStr) => {
        if (!timeStr) return new Date(0);
        const parts = timeStr.split(/[-\s:]/);
        if (parts.length < 3) return new Date(0);
        return new Date(
          parseInt(parts[0]),
          parseInt(parts[1]) - 1,
          parseInt(parts[2]),
          parseInt(parts[3] || 0),
          parseInt(parts[4] || 0),
          parseInt(parts[5] || 0)
        );
      };
      
      const sorted = group.sort((a, b) => {
        const aTime = parseLocalTime(a.updatedAt || a.createdAt).getTime();
        const bTime = parseLocalTime(b.updatedAt || b.createdAt).getTime();
        return bTime - aTime; // 降序
      });
      cleanedEvents.push(sorted[0]); // 保留最新的
    }
  });
  
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(cleanedEvents));
  
  const afterCount = cleanedEvents.length;
  const removed = beforeCount - afterCount;
  
  console.log(`✅ 清理完成！`);
  console.log(`   清理前: ${beforeCount} 个事件`);
  console.log(`   清理后: ${afterCount} 个事件`);
  console.log(`   删除了: ${removed} 个重复时间范围事件`);
  console.log('');
  console.log('🔄 请刷新页面以重新加载数据');
  
  return { beforeCount, afterCount, removed };
}

// 综合清理（推荐）
function cleanupAllTimerIssues() {
  console.log('🚀 开始综合清理...');
  console.log('');
  
  const result1 = cleanupShortTimerEvents();
  console.log('');
  
  const result2 = cleanupDuplicateTimeRanges();
  console.log('');
  
  console.log('='.repeat(80));
  console.log('✅ 全部清理完成！');
  console.log('='.repeat(80));
  console.log(`   初始事件数: ${result1.beforeCount}`);
  console.log(`   清理短时长后: ${result1.afterCount} (删除 ${result1.removed})`);
  console.log(`   清理重复后: ${result2.afterCount} (删除 ${result2.removed})`);
  console.log(`   总删除数: ${result1.removed + result2.removed}`);
  console.log('');
  console.log('🔄 请刷新页面以重新加载数据');
  
  return {
    initial: result1.beforeCount,
    final: result2.afterCount,
    totalRemoved: result1.removed + result2.removed
  };
}

// 清理指定时间段的本地事件（用于清理 Bug 产生的重复事件）
function cleanupEventsByTimeRange(startTimeStr, endTimeStr) {
  console.log('🔧 开始清理指定时间段的本地事件...');
  console.log(`   时间范围: ${startTimeStr} ~ ${endTimeStr}`);
  console.log('');
  
  const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
  if (!savedEvents) {
    console.log('❌ 没有找到事件数据');
    return;
  }

  const events = JSON.parse(savedEvents);
  const beforeCount = events.length;
  
  // ✅ 解析本地时间字符串（遵循 timeUtils.ts 的格式）
  // localStorage 存储格式：YYYY-MM-DD HH:mm:ss（空格分隔，本地时间）
  const parseLocalTime = (timeStr) => {
    const parts = timeStr.split(/[-\s:]/);
    const year = parseInt(parts[0]);
    const month = parseInt(parts[1]) - 1; // 月份从0开始
    const day = parseInt(parts[2]);
    const hour = parseInt(parts[3] || 0);
    const minute = parseInt(parts[4] || 0);
    const second = parseInt(parts[5] || 0);
    
    return new Date(year, month, day, hour, minute, second);
  };
  
  const rangeStart = parseLocalTime(startTimeStr);
  const rangeEnd = parseLocalTime(endTimeStr);
  
  console.log(`   解析后范围: ${rangeStart.toLocaleString('zh-CN')} ~ ${rangeEnd.toLocaleString('zh-CN')}`);
  console.log('');
  
  let removedCount = 0;
  const removedEvents = [];
  
  const cleanedEvents = events.filter(event => {
    // 只处理本地 Timer 事件
    if (event.externalId) return true; // 保留同步事件
    if (!event.id.startsWith('timer-')) return true; // 保留非 Timer 事件
    
    try {
      const eventStartStr = event.startTime || event.createdAt;
      if (!eventStartStr) return true; // 保留没有时间的事件
      
      // ✅ 直接解析（localStorage 格式就是 "YYYY-MM-DD HH:mm:ss"）
      const eventStart = parseLocalTime(eventStartStr);
      if (!eventStart || isNaN(eventStart.getTime())) {
        console.warn('时间解析失败:', event.id, eventStartStr);
        return true; // 保留解析失败的事件
      }
      
      // 检查是否在删除范围内
      const inRange = eventStart >= rangeStart && eventStart <= rangeEnd;
      
      if (inRange) {
        removedCount++;
        removedEvents.push({
          id: event.id.substring(0, 30),
          title: event.title.substring(0, 40),
          startTime: eventStartStr,
          parsed: eventStart.toLocaleString('zh-CN')
        });
        return false; // 删除
      }
      
      return true; // 保留
    } catch (e) {
      console.warn('时间解析失败:', event.id, e.message);
      return true; // 保留解析失败的事件（避免误删）
    }
  });
  
  localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(cleanedEvents));
  
  const afterCount = cleanedEvents.length;
  
  console.log(`✅ 清理完成！`);
  console.log(`   清理前: ${beforeCount} 个事件`);
  console.log(`   清理后: ${afterCount} 个事件`);
  console.log(`   删除了: ${removedCount} 个事件`);
  console.log('');
  
  if (removedEvents.length > 0) {
    console.log(`📋 删除的事件 (前20个):`);
    removedEvents.slice(0, 20).forEach((e, i) => {
      console.log(`   ${i + 1}. ${e.parsed} - ${e.title}`);
    });
    if (removedEvents.length > 20) {
      console.log(`   ... 还有 ${removedEvents.length - 20} 个未显示`);
    }
    console.log('');
  }
  
  console.log('🔄 请刷新页面以重新加载数据');
  
  return { 
    beforeCount, 
    afterCount, 
    removed: removedCount,
    removedEvents 
  };
}

// 快捷清理 2025-11-15 18:00-23:30 的事件
function cleanup20251115Evening() {
  console.log('🎯 清理 2025-11-15 18:00-23:30 的本地 Timer 事件');
  console.log('');
  return cleanupEventsByTimeRange('2025-11-15 18:00', '2025-11-15 23:30');
}

// 暴露函数到全局作用域
window.diagnoseTimerEvents = diagnoseTimerEvents;
window.cleanupShortTimerEvents = cleanupShortTimerEvents;
window.cleanupDuplicateTimeRanges = cleanupDuplicateTimeRanges;
window.cleanupAllTimerIssues = cleanupAllTimerIssues;
window.cleanupEventsByTimeRange = cleanupEventsByTimeRange;
window.cleanup20251115Evening = cleanup20251115Evening;

// 自动执行诊断
console.log('');
console.log('🚀 Timer 事件诊断工具已加载！');
console.log('');
console.log('💡 可用命令:');
console.log('   - diagnoseTimerEvents()                         // 运行诊断');
console.log('   - cleanupShortTimerEvents()                     // 清理 < 1分钟事件');
console.log('   - cleanupDuplicateTimeRanges()                  // 清理重复时间范围');
console.log('   - cleanupAllTimerIssues()                       // 综合清理（推荐）');
console.log('   - cleanup20251115Evening()                      // 清理 11-15 晚上的重复事件');
console.log('   - cleanupEventsByTimeRange(start, end)          // 自定义时间范围清理');
console.log('');
console.log('⏱️  正在执行诊断...');
console.log('');

const result = diagnoseTimerEvents();
