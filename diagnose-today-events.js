/**
 * 诊断脚本：检查今天创建的事件为什么不显示在 PlanManager
 * 
 * 在浏览器控制台运行：
 * 1. 打开 ReMarkable 应用
 * 2. 打开开发者工具（F12）
 * 3. 复制整个脚本到控制台
 * 4. 按回车执行
 */

(function() {
  console.log('='.repeat(80));
  console.log('🔍 开始诊断昨天创建的事件');
  console.log('='.repeat(80));
  
  // 1. 读取所有事件（注意：key 是 remarkable-events，不是 remarkable_events）
  const eventsData = localStorage.getItem('remarkable-events');
  if (!eventsData) {
    console.error('❌ 未找到事件数据！localStorage key 应该是 "remarkable-events"');
    console.log('📋 当前 localStorage 中的所有 key:');
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.includes('remarkable')) {
        console.log(`  - ${key}`);
      }
    }
    return;
  }
  
  const allEvents = JSON.parse(eventsData);
  console.log(`📦 总事件数: ${allEvents.length}`);
  
  // 2. 获取昨天的日期范围（因为已经过了零点）
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  
  const yesterdayStart = new Date(yesterday);
  yesterdayStart.setHours(0, 0, 0, 0);
  const yesterdayEnd = new Date(yesterday);
  yesterdayEnd.setHours(23, 59, 59, 999);
  
  // 格式化为本地时间字符串（不用 ISO）
  const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    const second = String(d.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
  };
  
  console.log(`📅 昨天的日期范围: ${formatDate(yesterdayStart)} ~ ${formatDate(yesterdayEnd)}`);
  
  // 3. 筛选昨天创建的事件
  const yesterdayEvents = allEvents.filter(e => {
    if (!e.createdAt) return false;
    // 注意：createdAt 格式是 "YYYY-MM-DD HH:mm:ss"，可以直接用 Date 解析
    const createdAt = new Date(e.createdAt);
    return createdAt >= yesterdayStart && createdAt <= yesterdayEnd;
  });
  
  console.log(`\n🆕 昨天（11月29日）创建的事件数: ${yesterdayEvents.length}`);
  
  if (yesterdayEvents.length === 0) {
    console.warn('⚠️ 没有找到昨天创建的事件！');
    return;
  }
  
  // 4. 分析每个昨天创建的事件
  console.log('\n📋 详细分析：\n');
  
  yesterdayEvents.forEach((event, index) => {
    console.log(`\n--- 事件 #${index + 1} ---`);
    console.log(`ID: ${event.id}`);
    console.log(`标题: ${event.title?.simpleTitle || event.title?.colorTitle || event.title || '(无标题)'}`);
    console.log(`创建时间: ${event.createdAt}`);
    
    // 检查关键字段
    console.log('\n🔑 关键字段检查:');
    console.log(`  isPlan: ${event.isPlan} (${typeof event.isPlan})`);
    console.log(`  checkType: ${event.checkType} (${typeof event.checkType})`);
    console.log(`  isTimeCalendar: ${event.isTimeCalendar} (${typeof event.isTimeCalendar})`);
    console.log(`  isTimer: ${event.isTimer} (${typeof event.isTimer})`);
    console.log(`  isTimeLog: ${event.isTimeLog} (${typeof event.isTimeLog})`);
    console.log(`  isOutsideApp: ${event.isOutsideApp} (${typeof event.isOutsideApp})`);
    
    // 检查时间字段
    console.log('\n⏰ 时间字段:');
    console.log(`  startTime: ${event.startTime || '(空)'}`);
    console.log(`  endTime: ${event.endTime || '(空)'}`);
    console.log(`  isAllDay: ${event.isAllDay}`);
    
    // 检查完成状态
    console.log('\n✅ 完成状态:');
    if (event.checked && event.checked.length > 0) {
      const lastChecked = event.checked[event.checked.length - 1];
      const lastUnchecked = event.unchecked?.[event.unchecked.length - 1];
      const isCompleted = !lastUnchecked || lastChecked > lastUnchecked;
      
      console.log(`  checked: ${event.checked.length} 次`);
      console.log(`  最后勾选: ${new Date(lastChecked).toLocaleString()}`);
      console.log(`  unchecked: ${event.unchecked?.length || 0} 次`);
      if (lastUnchecked) {
        console.log(`  最后取消: ${new Date(lastUnchecked).toLocaleString()}`);
      }
      console.log(`  当前状态: ${isCompleted ? '✅ 已完成' : '⬜ 未完成'}`);
      
      if (isCompleted) {
        const completedTime = new Date(lastChecked);
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);
        const isCompletedToday = completedTime >= todayMidnight;
        console.log(`  完成时间: ${isCompletedToday ? '今天' : '昨天或更早'}`);
      }
    } else {
      console.log('  未勾选');
    }
    
    // 检查内容
    console.log('\n📝 内容检查:');
    const titleObj = event.title;
    const hasTitle = event.content || 
                    (typeof titleObj === 'string' ? titleObj : 
                     (titleObj && (titleObj.simpleTitle || titleObj.fullTitle || titleObj.colorTitle)));
    console.log(`  hasTitle: ${!!hasTitle}`);
    
    const eventlogField = event.eventlog;
    let hasEventlog = false;
    if (eventlogField) {
      if (typeof eventlogField === 'object' && eventlogField !== null) {
        hasEventlog = !!(eventlogField.html || eventlogField.slateJson || eventlogField.plainText);
      } else {
        hasEventlog = !!eventlogField;
      }
    }
    console.log(`  hasEventlog: ${hasEventlog}`);
    console.log(`  hasDescription: ${!!event.description}`);
    
    // 🎯 判断是否会被 PlanManager 过滤
    console.log('\n🎯 PlanManager 过滤判断:');
    
    // 步骤 1: 并集条件
    const matchesInclusionCriteria = 
      event.isPlan === true || 
      (event.checkType && event.checkType !== 'none') ||
      event.isTimeCalendar === true;
    console.log(`  ✓ 并集条件: ${matchesInclusionCriteria ? '通过' : '❌ 未通过'}`);
    
    // 步骤 2: 排除系统事件
    const isSystemEvent = 
      event.isTimer === true || 
      event.isOutsideApp === true || 
      event.isTimeLog === true;
    console.log(`  ✓ 非系统事件: ${!isSystemEvent ? '通过' : '❌ 是系统事件'}`);
    
    // 步骤 2.5: 非空白事件
    const isNotBlank = hasTitle || hasEventlog || !!event.description;
    console.log(`  ✓ 非空白事件: ${isNotBlank ? '通过' : '❌ 空白事件'}`);
    
    // 步骤 3.1: TimeCalendar 过期检查
    let passedExpiredCheck = true;
    if (event.isTimeCalendar === true && event.endTime) {
      const endTime = new Date(event.endTime);
      passedExpiredCheck = endTime > now;
      console.log(`  ✓ 未过期: ${passedExpiredCheck ? '通过' : '❌ 已过期'}`);
    }
    
    // 步骤 3.2: 已完成任务隐藏检查
    let passedCompletedCheck = true;
    if (event.checkType && event.checkType !== 'none') {
      const lastChecked = event.checked?.[event.checked.length - 1];
      const lastUnchecked = event.unchecked?.[event.unchecked.length - 1];
      const isCompleted = lastChecked && (!lastUnchecked || lastChecked > lastUnchecked);
      
      if (isCompleted && lastChecked) {
        const completedTime = new Date(lastChecked);
        const todayMidnight = new Date(now);
        todayMidnight.setHours(0, 0, 0, 0);
        passedCompletedCheck = completedTime >= todayMidnight;
        console.log(`  ✓ 完成时间检查: ${passedCompletedCheck ? '通过（今天完成）' : '❌ 昨天或更早完成'}`);
      }
    }
    
    // 最终判断
    const wouldPass = matchesInclusionCriteria && 
                      !isSystemEvent && 
                      isNotBlank && 
                      passedExpiredCheck && 
                      passedCompletedCheck;
    
    console.log(`\n🏁 最终判断: ${wouldPass ? '✅ 会显示在 PlanManager' : '❌ 会被过滤掉'}`);
    
    if (!wouldPass) {
      console.log('\n❗ 被过滤的原因:');
      if (!matchesInclusionCriteria) {
        console.log('  - 不满足并集条件（isPlan、checkType、isTimeCalendar 都不符合）');
      }
      if (isSystemEvent) {
        console.log('  - 是系统事件（Timer/TimeLog/OutsideApp）');
      }
      if (!isNotBlank) {
        console.log('  - 空白事件（无标题、无 eventlog、无 description）');
      }
      if (!passedExpiredCheck) {
        console.log('  - TimeCalendar 事件已过期');
      }
      if (!passedCompletedCheck) {
        console.log('  - 已完成任务且完成时间在昨天或更早');
      }
    }
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ 诊断完成');
  console.log('='.repeat(80));
})();
