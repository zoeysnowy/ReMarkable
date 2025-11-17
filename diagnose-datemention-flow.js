/**
 * DateMention 数据流诊断脚本
 * 
 * 使用方法：
 * 1. 在浏览器控制台粘贴此脚本并执行
 * 2. 输入 @明天下午2点 等 DateMention
 * 3. 查看诊断报告
 * 
 * 作者：GitHub Copilot
 * 日期：2025-11-16
 */

(function() {
  console.log('%c[诊断脚本] DateMention 数据流监控已启动', 'background: #2196F3; color: white; font-size: 14px; padding: 4px 8px;');
  
  // ========== 数据存储 ==========
  const logs = [];
  const snapshots = {};
  
  function addLog(stage, message, data = {}) {
    const timestamp = new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 });
    const entry = { timestamp, stage, message, data };
    logs.push(entry);
    
    console.log(
      `%c[${stage}] ${timestamp}`,
      'background: #4CAF50; color: white; padding: 2px 6px;',
      message,
      data
    );
  }
  
  function saveSnapshot(stage, eventId, data) {
    if (!snapshots[eventId]) {
      snapshots[eventId] = {};
    }
    snapshots[eventId][stage] = {
      timestamp: new Date().toLocaleTimeString('zh-CN', { hour12: false, fractionalSecondDigits: 3 }),
      ...data
    };
  }
  
  // ========== 拦截 TimeHub.setEventTime ==========
  const TimeHub = window.TimeHub || (() => {
    try {
      return require('../services/TimeHub').TimeHub;
    } catch {
      return null;
    }
  })();
  
  if (TimeHub) {
    const originalSetEventTime = TimeHub.setEventTime.bind(TimeHub);
    TimeHub.setEventTime = async function(eventId, input, options) {
      addLog('1️⃣ TimeHub.setEventTime', '开始调用', {
        eventId: eventId?.slice(-10),
        start: input.start,
        end: input.end,
        source: input.source,
        rawText: input.rawText
      });
      
      const result = await originalSetEventTime(eventId, input, options);
      
      // 立即读取缓存验证
      const snapshot = TimeHub.getSnapshot(eventId);
      saveSnapshot('TimeHub.setEventTime', eventId, {
        inputStart: input.start,
        inputEnd: input.end,
        cacheStart: snapshot.start,
        cacheEnd: snapshot.end,
        success: result.success
      });
      
      addLog('1️⃣ TimeHub.setEventTime', '调用完成', {
        eventId: eventId?.slice(-10),
        success: result.success,
        缓存已更新: !!snapshot.start,
        cacheStart: snapshot.start,
        cacheEnd: snapshot.end
      });
      
      return result;
    };
    addLog('✅ 拦截器', 'TimeHub.setEventTime 已拦截');
  } else {
    addLog('❌ 拦截器', 'TimeHub 未找到');
  }
  
  // ========== 拦截 TimeHub.getSnapshot ==========
  if (TimeHub) {
    const originalGetSnapshot = TimeHub.getSnapshot.bind(TimeHub);
    TimeHub.getSnapshot = function(eventId) {
      const snapshot = originalGetSnapshot(eventId);
      
      addLog('2️⃣ TimeHub.getSnapshot', '读取快照', {
        eventId: eventId?.slice(-10),
        start: snapshot.start,
        end: snapshot.end,
        hasData: !!(snapshot.start || snapshot.end)
      });
      
      saveSnapshot('TimeHub.getSnapshot', eventId, {
        start: snapshot.start,
        end: snapshot.end
      });
      
      return snapshot;
    };
    addLog('✅ 拦截器', 'TimeHub.getSnapshot 已拦截');
  }
  
  // ========== 拦截 EventService.updateEvent ==========
  const EventService = window.EventService || (() => {
    try {
      return require('../services/EventService').EventService;
    } catch {
      return null;
    }
  })();
  
  if (EventService) {
    const originalUpdateEvent = EventService.updateEvent.bind(EventService);
    EventService.updateEvent = async function(eventId, updates, skipSync) {
      addLog('3️⃣ EventService.updateEvent', '开始保存', {
        eventId: eventId?.slice(-10),
        startTime: updates.startTime,
        endTime: updates.endTime,
        title: updates.title?.substring(0, 20),
        skipSync
      });
      
      saveSnapshot('EventService.updateEvent', eventId, {
        startTime: updates.startTime,
        endTime: updates.endTime,
        title: updates.title
      });
      
      const result = await originalUpdateEvent(eventId, updates, skipSync);
      
      addLog('3️⃣ EventService.updateEvent', '保存完成', {
        eventId: eventId?.slice(-10),
        success: result.success,
        error: result.error
      });
      
      return result;
    };
    addLog('✅ 拦截器', 'EventService.updateEvent 已拦截');
  } else {
    addLog('❌ 拦截器', 'EventService 未找到');
  }
  
  // ========== 拦截 EventService.getEventById ==========
  if (EventService) {
    const originalGetEventById = EventService.getEventById.bind(EventService);
    EventService.getEventById = function(eventId) {
      const event = originalGetEventById(eventId);
      
      if (event && snapshots[eventId]) {
        addLog('4️⃣ EventService.getEventById', '读取事件', {
          eventId: eventId?.slice(-10),
          startTime: event.startTime,
          endTime: event.endTime,
          title: event.title?.substring(0, 20)
        });
        
        saveSnapshot('EventService.getEventById', eventId, {
          startTime: event.startTime,
          endTime: event.endTime,
          title: event.title
        });
      }
      
      return event;
    };
    addLog('✅ 拦截器', 'EventService.getEventById 已拦截');
  }
  
  // ========== 监听 eventsUpdated 事件 ==========
  window.addEventListener('eventsUpdated', (e) => {
    const detail = e.detail || {};
    addLog('5️⃣ eventsUpdated', '事件触发', {
      eventId: detail.eventId?.slice(-10),
      deleted: detail.deleted,
      isNewEvent: detail.isNewEvent,
      hasEvent: !!detail.event
    });
    
    if (detail.event && detail.eventId) {
      saveSnapshot('eventsUpdated', detail.eventId, {
        startTime: detail.event.startTime,
        endTime: detail.event.endTime,
        title: detail.event.title
      });
    }
  });
  addLog('✅ 监听器', 'eventsUpdated 事件已监听');
  
  // ========== 辅助函数：生成诊断报告 ==========
  window.diagnoseDateMention = function(eventId) {
    console.clear();
    console.log('%c========== DateMention 诊断报告 ==========', 'background: #FF5722; color: white; font-size: 16px; padding: 8px;');
    
    if (!eventId) {
      console.log('%c请提供 eventId 参数', 'color: red; font-size: 14px;');
      console.log('%c示例: diagnoseDateMention("event-xxx")', 'color: gray;');
      return;
    }
    
    const eventSnapshots = snapshots[eventId];
    if (!eventSnapshots) {
      console.log(`%c未找到事件 ${eventId} 的诊断数据`, 'color: red; font-size: 14px;');
      console.log('%c提示: 请先插入 DateMention，然后再运行诊断', 'color: gray;');
      return;
    }
    
    console.log(`%c事件ID: ${eventId}`, 'font-weight: bold; font-size: 14px;');
    console.log('');
    
    // 显示每个阶段的快照
    const stages = [
      { key: 'TimeHub.setEventTime', name: '1️⃣ TimeHub 写入' },
      { key: 'TimeHub.getSnapshot', name: '2️⃣ TimeHub 读取' },
      { key: 'EventService.updateEvent', name: '3️⃣ EventService 保存' },
      { key: 'EventService.getEventById', name: '4️⃣ EventService 读取' },
      { key: 'eventsUpdated', name: '5️⃣ eventsUpdated 事件' }
    ];
    
    stages.forEach(({ key, name }) => {
      const snapshot = eventSnapshots[key];
      if (snapshot) {
        console.log(`%c${name}`, 'background: #2196F3; color: white; padding: 2px 6px;');
        console.log(`  时间: ${snapshot.timestamp}`);
        console.log(`  startTime: ${snapshot.startTime || snapshot.cacheStart || snapshot.inputStart || '无'}`);
        console.log(`  endTime: ${snapshot.endTime || snapshot.cacheEnd || snapshot.inputEnd || '无'}`);
        if (snapshot.title) console.log(`  title: ${snapshot.title}`);
        console.log('');
      } else {
        console.log(`%c${name}`, 'background: #9E9E9E; color: white; padding: 2px 6px;');
        console.log('  未执行');
        console.log('');
      }
    });
    
    // 数据一致性检查
    console.log('%c========== 数据一致性检查 ==========', 'background: #FF9800; color: white; font-size: 14px; padding: 4px;');
    
    const setTime = eventSnapshots['TimeHub.setEventTime'];
    const getSnapshot = eventSnapshots['TimeHub.getSnapshot'];
    const updateEvent = eventSnapshots['EventService.updateEvent'];
    const getEvent = eventSnapshots['EventService.getEventById'];
    
    const checks = [];
    
    // 检查1: TimeHub 缓存是否更新
    if (setTime && getSnapshot) {
      const match = setTime.inputStart === getSnapshot.start;
      checks.push({
        name: '✓ TimeHub 缓存更新',
        pass: match,
        detail: match ? '一致' : `不一致 (输入: ${setTime.inputStart}, 缓存: ${getSnapshot.start})`
      });
    }
    
    // 检查2: serialization 是否读取到正确值
    if (getSnapshot && updateEvent) {
      const match = getSnapshot.start === updateEvent.startTime;
      checks.push({
        name: '✓ serialization → EventService',
        pass: match,
        detail: match ? '一致' : `不一致 (快照: ${getSnapshot.start}, 保存: ${updateEvent.startTime})`
      });
    }
    
    // 检查3: localStorage 是否持久化
    if (updateEvent && getEvent) {
      const match = updateEvent.startTime === getEvent.startTime;
      checks.push({
        name: '✓ EventService 持久化',
        pass: match,
        detail: match ? '一致' : `不一致 (保存: ${updateEvent.startTime}, 读取: ${getEvent.startTime})`
      });
    }
    
    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      const color = check.pass ? 'green' : 'red';
      console.log(`%c${icon} ${check.name}`, `color: ${color}; font-weight: bold;`);
      console.log(`  ${check.detail}`);
    });
    
    console.log('');
    
    // 最终状态
    console.log('%c========== 最终状态 ==========', 'background: #4CAF50; color: white; font-size: 14px; padding: 4px;');
    
    if (EventService) {
      const currentEvent = EventService.getEventById(eventId);
      if (currentEvent) {
        console.log('📦 localStorage 中的数据:');
        console.log(`  startTime: ${currentEvent.startTime || '无'}`);
        console.log(`  endTime: ${currentEvent.endTime || '无'}`);
        console.log(`  title: ${currentEvent.title?.substring(0, 30)}`);
      } else {
        console.log('%c事件不存在于 EventService', 'color: red;');
      }
    }
    
    if (TimeHub) {
      const currentSnapshot = TimeHub.getSnapshot(eventId);
      console.log('');
      console.log('⚡ TimeHub 缓存:');
      console.log(`  start: ${currentSnapshot.start || '无'}`);
      console.log(`  end: ${currentSnapshot.end || '无'}`);
    }
    
    console.log('');
    console.log('%c========== 诊断完成 ==========', 'background: #9C27B0; color: white; font-size: 14px; padding: 4px;');
  };
  
  // ========== 辅助函数：列出所有被追踪的事件 ==========
  window.listTrackedEvents = function() {
    console.log('%c========== 已追踪的事件 ==========', 'background: #00BCD4; color: white; font-size: 14px; padding: 4px;');
    
    const eventIds = Object.keys(snapshots);
    if (eventIds.length === 0) {
      console.log('%c暂无追踪数据', 'color: gray;');
      console.log('%c提示: 插入 DateMention 后会自动追踪', 'color: gray;');
      return;
    }
    
    console.log(`共追踪 ${eventIds.length} 个事件:\n`);
    
    eventIds.forEach((eventId, index) => {
      const stages = Object.keys(snapshots[eventId]).length;
      console.log(`${index + 1}. ${eventId} (${stages} 个阶段)`);
    });
    
    console.log('\n使用 diagnoseDateMention("eventId") 查看详细报告');
  };
  
  // ========== 辅助函数：查看完整日志 ==========
  window.showFullLogs = function() {
    console.log('%c========== 完整日志 ==========', 'background: #673AB7; color: white; font-size: 14px; padding: 4px;');
    console.table(logs);
  };
  
  // ========== 使用说明 ==========
  console.log('');
  console.log('%c========== 使用说明 ==========', 'background: #FF5722; color: white; font-size: 14px; padding: 4px;');
  console.log('');
  console.log('1️⃣ 插入 DateMention（如 @明天下午2点）');
  console.log('2️⃣ 运行 listTrackedEvents() 查看追踪的事件');
  console.log('3️⃣ 运行 diagnoseDateMention("eventId") 查看详细诊断');
  console.log('4️⃣ 运行 showFullLogs() 查看完整日志');
  console.log('');
  console.log('%c提示: 所有操作都会自动记录，无需手动操作', 'color: #4CAF50; font-weight: bold;');
  console.log('');
  
})();
