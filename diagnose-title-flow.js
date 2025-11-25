// ========== 完整数据流诊断 ==========
console.log('%c========== STEP 1: LocalStorage 数据检查 ==========', 'color: blue; font-weight: bold');

const rawData = localStorage.getItem('EVENTS');
if (!rawData) {
  console.error(' localStorage 中没有 EVENTS 数据');
} else {
  const events = JSON.parse(rawData);
  console.log(' 总事件数:', events.length);
  
  // 抽样检查前 5 个事件
  const sample = events.slice(0, 5);
  console.log(' 前 5 个事件的 title 结构:');
  sample.forEach((e, i) => {
    console.log([] :, {
      titleType: typeof e.title,
      title: e.title,
      hasSimpleTitle: e.title?.simpleTitle !== undefined,
      hasColorTitle: e.title?.colorTitle !== undefined,
      hasFullTitle: e.title?.fullTitle !== undefined
    });
  });
  
  // 统计 title 类型
  const titleStats = {
    stringType: 0,
    objectType: 0,
    undefined: 0,
    objectWithSimpleTitle: 0,
    objectWithoutSimpleTitle: 0
  };
  
  events.forEach(e => {
    if (e.title === undefined) {
      titleStats.undefined++;
    } else if (typeof e.title === 'string') {
      titleStats.stringType++;
    } else if (typeof e.title === 'object') {
      titleStats.objectType++;
      if (e.title.simpleTitle !== undefined) {
        titleStats.objectWithSimpleTitle++;
      } else {
        titleStats.objectWithoutSimpleTitle++;
      }
    }
  });
  
  console.log(' Title 类型统计:', titleStats);
}

console.log('%c========== STEP 2: EventService 读取检查 ==========', 'color: green; font-weight: bold');

// 模拟 EventService.getAllEvents()
const eventsFromService = JSON.parse(localStorage.getItem('EVENTS') || '[]');
console.log('EventService.getAllEvents() 返回:', eventsFromService.length, '个事件');
console.log('前 3 个事件的 title:', eventsFromService.slice(0, 3).map(e => ({
  id: e.id,
  titleType: typeof e.title,
  simpleTitle: e.title?.simpleTitle,
  title: e.title
})));

console.log('%c========== STEP 3: TimeCalendar 显示检查 ==========', 'color: orange; font-weight: bold');

// 检查 convertToCalendarEvent 的逻辑
console.log('检查 calendarUtils.convertToCalendarEvent 使用的字段:');
const testEvent = eventsFromService[0];
if (testEvent) {
  console.log('测试事件:', {
    id: testEvent.id,
    'title?.simpleTitle': testEvent.title?.simpleTitle,
    'title': testEvent.title
  });
}

console.log('%c========== 建议 ==========', 'color: red; font-weight: bold');
if (titleStats.stringType > 0 || titleStats.objectWithoutSimpleTitle > 0) {
  console.log(' 发现格式错误的数据:');
  console.log('  - String 类型 title:', titleStats.stringType);
  console.log('  - 没有 simpleTitle 的对象:', titleStats.objectWithoutSimpleTitle);
  console.log('');
  console.log(' 建议清空并重新创建数据:');
  console.log('  localStorage.removeItem(\"EVENTS\");');
  console.log('  location.reload();');
}

window.titleFlowDiagnosis = { rawData, events, titleStats, eventsFromService };
console.log(' 诊断结果已保存到 window.titleFlowDiagnosis');
