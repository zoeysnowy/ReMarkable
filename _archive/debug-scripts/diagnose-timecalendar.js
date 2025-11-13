// TimeCalendar 诊断脚本
// 在浏览器 Console 中运行此脚本

console.log('🔍 === TimeCalendar 完整诊断开始 ===\n');

// ========================================
// 1. 检查 localStorage 事件数据
// ========================================
console.log('📦 [步骤 1/5] 检查 localStorage 事件数据...');

const eventsData = localStorage.getItem('remarkable-events');
if (!eventsData) {
  console.error('❌ 诊断失败：localStorage 中没有事件数据');
  console.log('💡 可能原因：');
  console.log('   - Outlook 同步失败');
  console.log('   - 同步完成但没有触发保存到 localStorage');
  console.log('   - localStorage 被清空或损坏');
  console.log('\n🛠️ 建议操作：');
  console.log('   1. 检查 Outlook 同步状态');
  console.log('   2. 重新触发同步');
  console.log('   3. 检查 MicrosoftCalendarService 日志');
  console.log('\n🔍 === TimeCalendar 诊断结束 ===');
} else {
  const events = JSON.parse(eventsData);
  console.log(`✅ 找到 ${events.length} 个事件`);
  
  // 检查事件结构
  if (events.length > 0) {
    const sampleEvent = events[0];
    console.log('📋 示例事件结构:', {
      id: sampleEvent.id,
      title: sampleEvent.title,
      startTime: sampleEvent.startTime,
      endTime: sampleEvent.endTime,
      calendarId: sampleEvent.calendarId,
      tagId: sampleEvent.tagId,
      tags: sampleEvent.tags,
      source: sampleEvent.source
    });
  }
  
  // ========================================
  // 2. 检查日期范围过滤
  // ========================================
  console.log('\n📅 [步骤 2/5] 检查日期范围过滤...');
  
  const currentDateStr = localStorage.getItem('remarkable-calendar-current-date');
  const currentDate = currentDateStr ? new Date(currentDateStr) : new Date();
  
  const viewStart = new Date(currentDate);
  viewStart.setMonth(viewStart.getMonth() - 3);
  viewStart.setHours(0, 0, 0, 0);
  
  const viewEnd = new Date(currentDate);
  viewEnd.setMonth(viewEnd.getMonth() + 3);
  viewEnd.setHours(23, 59, 59, 999);
  
  console.log(`📅 当前查看日期: ${currentDate.toLocaleDateString()}`);
  console.log(`📅 视图范围: ${viewStart.toLocaleDateString()} ~ ${viewEnd.toLocaleDateString()}`);
  
  const inRange = events.filter(e => {
    const eventStart = new Date(e.startTime);
    const eventEnd = new Date(e.endTime);
    return eventEnd >= viewStart && eventStart <= viewEnd;
  });
  
  console.log(`✅ 在视图范围内的事件: ${inRange.length}/${events.length}`);
  
  if (inRange.length === 0) {
    console.warn('⚠️ 所有事件都在视图范围外！');
    console.log('💡 显示最早和最晚的3个事件:');
    
    const sorted = [...events].sort((a, b) => 
      new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    
    console.log('   最早的3个事件:');
    sorted.slice(0, 3).forEach((e, i) => {
      console.log(`     ${i + 1}. ${e.title}: ${new Date(e.startTime).toLocaleString()}`);
    });
    
    console.log('   最晚的3个事件:');
    sorted.slice(-3).forEach((e, i) => {
      console.log(`     ${i + 1}. ${e.title}: ${new Date(e.startTime).toLocaleString()}`);
    });
    
    console.log('\n🛠️ 建议操作：');
    console.log('   1. 点击"今天"按钮回到当前日期');
    console.log('   2. 或者切换到正确的日期范围');
    console.log('\n🔍 === TimeCalendar 诊断结束 ===');
  } else {
    // ========================================
    // 3. 检查标签筛选器
    // ========================================
    console.log('\n🏷️ [步骤 3/5] 检查标签筛选器...');
    
    const settingsStr = localStorage.getItem('remarkable-calendar-settings');
    const settings = settingsStr ? JSON.parse(settingsStr) : { visibleTags: [], visibleCalendars: [] };
    
    const visibleTags = settings.visibleTags || [];
    const visibleCalendars = settings.visibleCalendars || [];
    
    const hasTagFilter = visibleTags.length > 0;
    const hasCalendarFilter = visibleCalendars.length > 0;
    
    console.log(`📊 筛选器状态:`);
    console.log(`   - hasTagFilter: ${hasTagFilter}`);
    console.log(`   - visibleTags: ${JSON.stringify(visibleTags)}`);
    console.log(`   - hasCalendarFilter: ${hasCalendarFilter}`);
    console.log(`   - visibleCalendars: ${JSON.stringify(visibleCalendars)}`);
    
    // 标签过滤
    const filteredByTags = inRange.filter(event => {
      if (hasTagFilter) {
        const eventTags = event.tags || (event.tagId ? [event.tagId] : []);
        const hasNoTagOption = visibleTags.includes('no-tag');
        
        if (eventTags.length === 0) {
          return hasNoTagOption;
        }
        
        return eventTags.some(tagId => visibleTags.includes(tagId));
      }
      return true;
    });
    
    console.log(`✅ 标签过滤后: ${filteredByTags.length}/${inRange.length} 事件`);
    
    if (hasTagFilter && filteredByTags.length === 0) {
      console.error('❌ 标签筛选器过滤掉了所有事件！');
      console.log('💡 当前筛选的标签:', visibleTags);
      console.log('💡 前5个事件的标签:');
      inRange.slice(0, 5).forEach(e => {
        const eventTags = e.tags || (e.tagId ? [e.tagId] : []);
        console.log(`   - ${e.title}: ${JSON.stringify(eventTags)}`);
      });
      
      console.log('\n🛠️ 建议操作：');
      console.log('   1. 打开设置面板');
      console.log('   2. 检查标签筛选器，确保选中了正确的标签');
      console.log('   3. 或者运行以下代码临时清空筛选器:');
      console.log('      localStorage.setItem("remarkable-calendar-settings", JSON.stringify({...JSON.parse(localStorage.getItem("remarkable-calendar-settings")), visibleTags: []}))');
      console.log('\n🔍 === TimeCalendar 诊断结束 ===');
    } else {
      // ========================================
      // 4. 检查日历筛选器
      // ========================================
      console.log('\n📆 [步骤 4/5] 检查日历筛选器...');
      
      const filteredByCalendars = filteredByTags.filter(event => {
        if (hasCalendarFilter) {
          const hasLocalCreatedOption = visibleCalendars.includes('local-created');
          const hasNotSyncedOption = visibleCalendars.includes('not-synced');
          
          const isLocalCreated = event.source === 'local' || event.remarkableSource === true;
          const isNotSynced = !event.calendarId || !event.externalId;
          
          if (isLocalCreated && hasLocalCreatedOption) return true;
          if (isNotSynced && hasNotSyncedOption) return true;
          
          if (!event.calendarId) return false;
          
          return visibleCalendars.includes(event.calendarId);
        }
        return true;
      });
      
      console.log(`✅ 日历过滤后: ${filteredByCalendars.length}/${filteredByTags.length} 事件`);
      
      if (hasCalendarFilter && filteredByCalendars.length === 0) {
        console.error('❌ 日历筛选器过滤掉了所有事件！');
        console.log('💡 当前筛选的日历:', visibleCalendars);
        console.log('💡 前5个事件的日历 ID:');
        filteredByTags.slice(0, 5).forEach(e => {
          console.log(`   - ${e.title}: calendarId=${e.calendarId}, source=${e.source}, remarkableSource=${e.remarkableSource}`);
        });
        
        // 统计日历 ID 分布
        const calendarIdCounts = {};
        filteredByTags.forEach(e => {
          const calId = e.calendarId || '(无 calendarId)';
          calendarIdCounts[calId] = (calendarIdCounts[calId] || 0) + 1;
        });
        
        console.log('\n📊 日历 ID 分布:');
        Object.entries(calendarIdCounts).forEach(([calId, count]) => {
          console.log(`   - ${calId}: ${count} 个事件`);
        });
        
        console.log('\n🛠️ 建议操作：');
        console.log('   1. 打开设置面板');
        console.log('   2. 检查日历筛选器，确保选中了正确的日历');
        console.log('   3. 或者运行以下代码临时清空筛选器:');
        console.log('      localStorage.setItem("remarkable-calendar-settings", JSON.stringify({...JSON.parse(localStorage.getItem("remarkable-calendar-settings")), visibleCalendars: []}))');
        console.log('\n🔍 === TimeCalendar 诊断结束 ===');
      } else {
        // ========================================
        // 5. 检查去重逻辑
        // ========================================
        console.log('\n🔄 [步骤 5/5] 检查去重逻辑...');
        
        const uniqueByIdMap = new Map();
        const skipped = [];
        
        filteredByCalendars.forEach(e => {
          if (!e || !e.id) {
            skipped.push(e);
          } else if (!uniqueByIdMap.has(e.id)) {
            uniqueByIdMap.set(e.id, e);
          }
        });
        
        const uniqueFiltered = Array.from(uniqueByIdMap.values());
        
        console.log(`✅ 去重后: ${uniqueFiltered.length}/${filteredByCalendars.length} 事件`);
        
        if (skipped.length > 0) {
          console.warn(`⚠️ 跳过了 ${skipped.length} 个无效事件 (缺少 ID)`);
          console.log('💡 前3个被跳过的事件:', skipped.slice(0, 3));
        }
        
        // ========================================
        // 最终结果
        // ========================================
        console.log('\n🎯 [诊断结果]');
        console.log('========================================');
        console.log(`📊 事件过滤流程:`);
        console.log(`   1. localStorage 中的总事件数: ${events.length}`);
        console.log(`   2. 日期范围过滤后: ${inRange.length}`);
        console.log(`   3. 标签过滤后: ${filteredByTags.length}`);
        console.log(`   4. 日历过滤后: ${filteredByCalendars.length}`);
        console.log(`   5. 去重后: ${uniqueFiltered.length}`);
        console.log('========================================');
        
        if (uniqueFiltered.length === 0) {
          console.error('❌ 最终结果：没有事件显示');
          console.log('💡 可能的原因：');
          if (inRange.length === 0) {
            console.log('   - 所有事件都在视图日期范围外');
          }
          if (hasTagFilter && filteredByTags.length === 0) {
            console.log('   - 标签筛选器过滤了所有事件');
          }
          if (hasCalendarFilter && filteredByCalendars.length === 0) {
            console.log('   - 日历筛选器过滤了所有事件');
          }
        } else {
          console.log(`✅ 最终结果：应该显示 ${uniqueFiltered.length} 个事件`);
          console.log('\n📋 显示前3个事件:');
          uniqueFiltered.slice(0, 3).forEach((e, i) => {
            console.log(`   ${i + 1}. ${e.title}`);
            console.log(`      - 时间: ${new Date(e.startTime).toLocaleString()} ~ ${new Date(e.endTime).toLocaleString()}`);
            console.log(`      - 标签: ${e.tagId || '(无)'}`);
            console.log(`      - 日历: ${e.calendarId || '(无)'}`);
          });
          
          console.log('\n💡 如果日历仍然是空的，可能是渲染层的问题：');
          console.log('   - 检查 TUI Calendar 实例是否正确初始化');
          console.log('   - 检查 calendarEvents 是否正确传递给 ToastUIReactCalendar');
          console.log('   - 检查浏览器 Console 是否有 React 错误');
          console.log('   - 检查 TimeCalendar.tsx L1358-1520 的 useMemo 日志');
        }
        
        console.log('\n🔍 === TimeCalendar 诊断结束 ===');
      }
    }
  }
}
