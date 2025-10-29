// 🔍 Widget Timer 前缀调试脚本
// 在 Widget 的 Console 中运行这个脚本来诊断 "[专注中]" 前缀问题

console.log('🔍 [DEBUG SCRIPT] Starting Widget Timer Debug...');

// 1. 检查 localStorage 中的 timer 状态
const checkTimerState = () => {
  console.log('\n📊 [1] Timer State Check:');
  try {
    const saved = localStorage.getItem('remarkable-global-timer');
    console.log('   Raw localStorage value:', saved);
    
    if (saved) {
      const timer = JSON.parse(saved);
      console.log('   Parsed timer object:', timer);
      console.log('   Timer is running:', timer?.isRunning);
      console.log('   Timer tagId:', timer?.tagId);
      console.log('   Timer startTime:', timer?.startTime);
      console.log('   Timer originalStartTime:', timer?.originalStartTime);
      
      if (timer && timer.isRunning) {
        const startTime = timer.originalStartTime || timer.startTime;
        const expectedEventId = `timer-${timer.tagId}-${startTime}`;
        console.log('   Expected timer event ID:', expectedEventId);
        return expectedEventId;
      }
    }
  } catch (error) {
    console.error('   Error reading timer state:', error);
  }
  return null;
};

// 2. 检查 events 中的 timer 事件
const checkTimerEvents = () => {
  console.log('\n📋 [2] Timer Events Check:');
  try {
    const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
    const timerEvents = events.filter(e => e.id && e.id.includes('timer-'));
    
    console.log('   Total events:', events.length);
    console.log('   Timer events found:', timerEvents.length);
    
    timerEvents.forEach((event, index) => {
      console.log(`   Timer Event ${index + 1}:`, {
        id: event.id,
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        syncStatus: event.syncStatus
      });
    });
    
    return timerEvents;
  } catch (error) {
    console.error('   Error reading events:', error);
  }
  return [];
};

// 3. 模拟 getRunningTimerEventId 函数
const mockGetRunningTimerEventId = () => {
  console.log('\n🎯 [3] Mock getRunningTimerEventId:');
  
  // 模拟主应用场景（globalTimer prop）
  console.log('   Checking globalTimer prop... (Widget 中应该是 undefined)');
  const globalTimer = window.globalTimer; // Widget 中通常没有这个
  console.log('   globalTimer:', globalTimer);
  
  if (globalTimer && globalTimer.isRunning) {
    const startTime = globalTimer.originalStartTime || globalTimer.startTime;
    const eventId = `timer-${globalTimer.tagId}-${startTime}`;
    console.log('   Using globalTimer prop result:', eventId);
    return eventId;
  }
  
  // 模拟 Widget 场景（localStorage）
  console.log('   Falling back to localStorage...');
  try {
    const saved = localStorage.getItem('remarkable-global-timer');
    if (saved) {
      const timer = JSON.parse(saved);
      if (timer && timer.isRunning) {
        const startTime = timer.originalStartTime || timer.startTime;
        const eventId = `timer-${timer.tagId}-${startTime}`;
        console.log('   Using localStorage result:', eventId);
        return eventId;
      }
    }
  } catch (error) {
    console.error('   Error in localStorage fallback:', error);
  }
  
  console.log('   No running timer found, returning null');
  return null;
};

// 4. 模拟 generateRealtimeTimerEvent 函数
const mockGenerateRealtimeTimerEvent = () => {
  console.log('\n🔄 [4] Mock generateRealtimeTimerEvent:');
  
  let currentTimer = null;
  let timerEventId = null;

  // 检查 globalTimer
  const globalTimer = window.globalTimer;
  if (globalTimer && globalTimer.isRunning) {
    currentTimer = globalTimer;
    const startTime = globalTimer.originalStartTime || globalTimer.startTime;
    timerEventId = `timer-${globalTimer.tagId}-${startTime}`;
    console.log('   Using globalTimer prop for realtime event');
  } else {
    console.log('   No globalTimer prop, checking localStorage...');
    try {
      const saved = localStorage.getItem('remarkable-global-timer');
      if (saved) {
        const timer = JSON.parse(saved);
        if (timer && timer.isRunning) {
          currentTimer = timer;
          const startTime = timer.originalStartTime || timer.startTime;
          timerEventId = `timer-${timer.tagId}-${startTime}`;
          console.log('   Using localStorage timer for realtime event');
        }
      }
    } catch (error) {
      console.error('   Error generating realtime event:', error);
    }
  }

  if (currentTimer && timerEventId) {
    console.log('   Generated realtime timer event ID:', timerEventId);
    console.log('   Current timer details:', {
      tagId: currentTimer.tagId,
      currentTask: currentTimer.currentTask,
      isRunning: currentTimer.isRunning,
      startTime: currentTimer.startTime,
      originalStartTime: currentTimer.originalStartTime
    });
    return { id: timerEventId, timer: currentTimer };
  }
  
  console.log('   No realtime timer event generated');
  return null;
};

// 5. 模拟 convertToCalendarEvent 的前缀逻辑
const mockPrefixLogic = (eventId, runningTimerEventId) => {
  console.log('\n🏷️ [5] Mock "[专注中]" Prefix Logic:');
  console.log('   Event ID:', eventId);
  console.log('   Running Timer Event ID:', runningTimerEventId);
  console.log('   runningTimerEventId is not null:', runningTimerEventId !== null);
  console.log('   Event ID matches running timer:', eventId === runningTimerEventId);
  
  const isTimerRunning = runningTimerEventId !== null && eventId === runningTimerEventId;
  console.log('   Final isTimerRunning result:', isTimerRunning);
  
  const mockTitle = '测试任务';
  const displayTitle = isTimerRunning ? `[专注中] ${mockTitle}` : mockTitle;
  console.log('   Display title would be:', displayTitle);
  
  return { isTimerRunning, displayTitle };
};

// 6. 运行完整诊断
const runFullDiagnosis = () => {
  console.log('\n🔬 [6] Full Diagnosis:');
  
  const expectedEventId = checkTimerState();
  const timerEvents = checkTimerEvents();
  const runningTimerEventId = mockGetRunningTimerEventId();
  const realtimeEvent = mockGenerateRealtimeTimerEvent();
  
  console.log('\n📊 Summary:');
  console.log('   Expected Event ID from timer state:', expectedEventId);
  console.log('   Running Timer Event ID from getRunningTimerEventId:', runningTimerEventId);
  console.log('   Realtime Event ID from generateRealtimeTimerEvent:', realtimeEvent?.id);
  
  // 检查一致性
  console.log('\n🔍 Consistency Check:');
  console.log('   Timer state vs getRunningTimerEventId:', expectedEventId === runningTimerEventId);
  console.log('   getRunningTimerEventId vs generateRealtimeTimerEvent:', runningTimerEventId === realtimeEvent?.id);
  
  // 如果有实时事件，测试前缀逻辑
  if (realtimeEvent) {
    mockPrefixLogic(realtimeEvent.id, runningTimerEventId);
  }
  
  // 检查已保存的timer事件与实时事件的关系
  if (timerEvents.length > 0 && realtimeEvent) {
    console.log('\n🔄 Event Replacement Check:');
    const matchingEvents = timerEvents.filter(e => e.id === realtimeEvent.id);
    console.log('   Saved events with same ID:', matchingEvents.length);
    console.log('   These should be replaced by realtime event');
  }
};

// 执行诊断
runFullDiagnosis();

console.log('\n✅ [DEBUG SCRIPT] Widget Timer Debug Complete!');
console.log('请将上述输出截图或复制给我分析。');