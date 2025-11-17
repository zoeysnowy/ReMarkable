/**
 * DateMention 实时监控诊断脚本 v2.0
 * 
 * 使用方法：
 * 1. 在浏览器控制台粘贴并执行此脚本
 * 2. 输入 @明天下午2点 等 DateMention
 * 3. 自动显示每个阶段的状态和问题
 * 
 * 特点：
 * - 实时监控整个数据流
 * - 自动检测数据丢失问题
 * - 彩色输出，清晰易读
 * - 自动追踪最近的事件
 */

(function() {
  console.clear();
  console.log(
    '%c🔍 DateMention 实时监控已启动 v2.0',
    'background: linear-gradient(90deg, #667eea 0%, #764ba2 100%); color: white; font-size: 16px; padding: 8px 16px; border-radius: 4px; font-weight: bold;'
  );
  
  let lastEventId = null;
  const eventData = new Map();
  
  // 获取当前追踪的事件数据
  function getEventData(eventId) {
    if (!eventData.has(eventId)) {
      eventData.set(eventId, {
        id: eventId,
        stages: {},
        issues: [],
        startTime: Date.now()
      });
    }
    return eventData.get(eventId);
  }
  
  // 记录阶段数据
  function recordStage(eventId, stage, data) {
    const event = getEventData(eventId);
    event.stages[stage] = {
      timestamp: Date.now(),
      ...data
    };
    lastEventId = eventId;
  }
  
  // 添加问题记录
  function addIssue(eventId, issue) {
    const event = getEventData(eventId);
    event.issues.push({
      timestamp: Date.now(),
      ...issue
    });
  }
  
  // 格式化时间戳
  function formatTime(ms) {
    return new Date(ms).toLocaleTimeString('zh-CN', { 
      hour12: false, 
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  }
  
  // 获取相对时间
  function getRelativeTime(startMs, currentMs) {
    const diff = currentMs - startMs;
    return `+${diff}ms`;
  }
  
  // ========== 拦截 TimeHub ==========
  const setupTimeHubInterceptor = () => {
    const TimeHub = window.TimeHub;
    if (!TimeHub) {
      console.warn('⚠️ TimeHub 未找到，尝试从模块导入...');
      return false;
    }
    
    // 拦截 setEventTime
    const originalSet = TimeHub.setEventTime.bind(TimeHub);
    TimeHub.setEventTime = async function(eventId, input, options) {
      const startMs = Date.now();
      
      console.log(
        '%c1️⃣ TimeHub.setEventTime',
        'background: #4CAF50; color: white; padding: 2px 8px; border-radius: 2px; font-weight: bold;',
        {
          eventId: eventId?.slice(-10),
          start: input.start,
          end: input.end,
          source: input.source
        }
      );
      
      const result = await originalSet(eventId, input, options);
      
      // 验证缓存
      const snapshot = TimeHub.getSnapshot(eventId);
      const cacheOk = snapshot.start === input.start;
      
      recordStage(eventId, 'TimeHub.setEventTime', {
        inputStart: input.start,
        inputEnd: input.end,
        cacheStart: snapshot.start,
        cacheEnd: snapshot.end,
        success: result.success,
        cacheUpdated: cacheOk
      });
      
      console.log(
        cacheOk ? '%c  ✅ 缓存已更新' : '%c  ❌ 缓存更新失败',
        cacheOk ? 'color: #4CAF50; font-weight: bold;' : 'color: #F44336; font-weight: bold;',
        {
          输入: input.start,
          缓存: snapshot.start,
          耗时: `${Date.now() - startMs}ms`
        }
      );
      
      if (!cacheOk) {
        addIssue(eventId, {
          stage: 'TimeHub.setEventTime',
          type: 'cache_mismatch',
          message: '缓存更新失败',
          expected: input.start,
          actual: snapshot.start
        });
      }
      
      return result;
    };
    
    // 拦截 getSnapshot
    const originalGet = TimeHub.getSnapshot.bind(TimeHub);
    TimeHub.getSnapshot = function(eventId) {
      const snapshot = originalGet(eventId);
      const event = getEventData(eventId);
      
      console.log(
        '%c2️⃣ TimeHub.getSnapshot',
        'background: #2196F3; color: white; padding: 2px 8px; border-radius: 2px; font-weight: bold;',
        {
          eventId: eventId?.slice(-10),
          start: snapshot.start,
          end: snapshot.end,
          相对时间: event.startTime ? getRelativeTime(event.startTime, Date.now()) : 'N/A'
        }
      );
      
      recordStage(eventId, 'TimeHub.getSnapshot', {
        start: snapshot.start,
        end: snapshot.end
      });
      
      // 检查是否与 setEventTime 一致
      const setStage = event.stages['TimeHub.setEventTime'];
      if (setStage && setStage.inputStart !== snapshot.start) {
        console.warn(
          '%c  ⚠️ 时间不一致',
          'color: #FF9800; font-weight: bold;',
          {
            'setEventTime 输入': setStage.inputStart,
            'getSnapshot 返回': snapshot.start
          }
        );
        
        addIssue(eventId, {
          stage: 'TimeHub.getSnapshot',
          type: 'data_inconsistency',
          message: 'getSnapshot 返回的数据与 setEventTime 不一致',
          expected: setStage.inputStart,
          actual: snapshot.start
        });
      }
      
      return snapshot;
    };
    
    console.log('✅ TimeHub 拦截器已安装');
    return true;
  };
  
  // ========== 拦截 EventService ==========
  const setupEventServiceInterceptor = () => {
    const EventService = window.EventService;
    if (!EventService) {
      console.warn('⚠️ EventService 未找到');
      return false;
    }
    
    // 拦截 updateEvent
    const originalUpdate = EventService.updateEvent.bind(EventService);
    EventService.updateEvent = async function(eventId, updates, skipSync) {
      const event = getEventData(eventId);
      
      console.log(
        '%c3️⃣ EventService.updateEvent',
        'background: #9C27B0; color: white; padding: 2px 8px; border-radius: 2px; font-weight: bold;',
        {
          eventId: eventId?.slice(-10),
          startTime: updates.startTime,
          endTime: updates.endTime,
          title: updates.title?.substring(0, 20),
          相对时间: event.startTime ? getRelativeTime(event.startTime, Date.now()) : 'N/A'
        }
      );
      
      recordStage(eventId, 'EventService.updateEvent', {
        startTime: updates.startTime,
        endTime: updates.endTime,
        title: updates.title
      });
      
      // 检查是否与 TimeHub 一致
      const getSnapshotStage = event.stages['TimeHub.getSnapshot'];
      if (getSnapshotStage && getSnapshotStage.start !== updates.startTime) {
        console.warn(
          '%c  ⚠️ 时间丢失',
          'color: #F44336; font-weight: bold;',
          {
            'TimeHub 快照': getSnapshotStage.start,
            'EventService 保存': updates.startTime
          }
        );
        
        addIssue(eventId, {
          stage: 'EventService.updateEvent',
          type: 'data_loss',
          message: '保存到 EventService 的时间与 TimeHub 不一致',
          expected: getSnapshotStage.start,
          actual: updates.startTime
        });
      }
      
      const result = await originalUpdate(eventId, updates, skipSync);
      
      console.log(
        result.success ? '%c  ✅ 保存成功' : '%c  ❌ 保存失败',
        result.success ? 'color: #4CAF50; font-weight: bold;' : 'color: #F44336; font-weight: bold;',
        result.error || ''
      );
      
      return result;
    };
    
    // 拦截 getEventById
    const originalGet = EventService.getEventById.bind(EventService);
    EventService.getEventById = function(eventId) {
      const event = originalGet(eventId);
      
      if (event && eventData.has(eventId)) {
        const data = getEventData(eventId);
        
        console.log(
          '%c4️⃣ EventService.getEventById',
          'background: #00BCD4; color: white; padding: 2px 8px; border-radius: 2px; font-weight: bold;',
          {
            eventId: eventId?.slice(-10),
            startTime: event.startTime,
            endTime: event.endTime,
            相对时间: data.startTime ? getRelativeTime(data.startTime, Date.now()) : 'N/A'
          }
        );
        
        recordStage(eventId, 'EventService.getEventById', {
          startTime: event.startTime,
          endTime: event.endTime,
          title: event.title
        });
        
        // 验证持久化
        const updateStage = data.stages['EventService.updateEvent'];
        if (updateStage && updateStage.startTime !== event.startTime) {
          console.error(
            '%c  ❌ 持久化失败',
            'color: #F44336; font-weight: bold;',
            {
              '保存的值': updateStage.startTime,
              '读取的值': event.startTime
            }
          );
          
          addIssue(eventId, {
            stage: 'EventService.getEventById',
            type: 'persistence_failure',
            message: '从 localStorage 读取的数据与保存的不一致',
            expected: updateStage.startTime,
            actual: event.startTime
          });
        } else if (event.startTime) {
          console.log(
            '%c  ✅ 持久化成功',
            'color: #4CAF50; font-weight: bold;'
          );
        }
      }
      
      return event;
    };
    
    console.log('✅ EventService 拦截器已安装');
    return true;
  };
  
  // ========== 监听全局事件 ==========
  window.addEventListener('eventsUpdated', (e) => {
    const detail = e.detail || {};
    if (detail.eventId && eventData.has(detail.eventId)) {
      const event = getEventData(detail.eventId);
      
      console.log(
        '%c5️⃣ eventsUpdated 事件',
        'background: #FF5722; color: white; padding: 2px 8px; border-radius: 2px; font-weight: bold;',
        {
          eventId: detail.eventId?.slice(-10),
          deleted: detail.deleted,
          isNewEvent: detail.isNewEvent,
          相对时间: event.startTime ? getRelativeTime(event.startTime, Date.now()) : 'N/A'
        }
      );
      
      recordStage(detail.eventId, 'eventsUpdated', {
        deleted: detail.deleted,
        isNewEvent: detail.isNewEvent,
        hasEvent: !!detail.event
      });
    }
  });
  
  // ========== 诊断命令 ==========
  window.diagnose = function(eventId) {
    const id = eventId || lastEventId;
    if (!id) {
      console.error('❌ 请提供 eventId 或先插入 DateMention');
      console.log('💡 示例: diagnose("event-xxx")');
      return;
    }
    
    const event = eventData.get(id);
    if (!event) {
      console.error(`❌ 未找到事件 ${id} 的诊断数据`);
      return;
    }
    
    console.clear();
    console.log(
      '%c========== 诊断报告 ==========',
      'background: linear-gradient(90deg, #f093fb 0%, #f5576c 100%); color: white; font-size: 18px; padding: 12px; border-radius: 4px; font-weight: bold;'
    );
    console.log('');
    console.log(`事件ID: ${id}`);
    console.log(`开始时间: ${formatTime(event.startTime)}`);
    console.log(`总耗时: ${Date.now() - event.startTime}ms`);
    console.log('');
    
    // 显示数据流
    console.log('%c数据流追踪:', 'font-size: 14px; font-weight: bold; color: #333;');
    console.log('');
    
    const stages = [
      { key: 'TimeHub.setEventTime', name: '1️⃣ TimeHub 写入', field: 'inputStart' },
      { key: 'TimeHub.getSnapshot', name: '2️⃣ TimeHub 读取', field: 'start' },
      { key: 'EventService.updateEvent', name: '3️⃣ EventService 保存', field: 'startTime' },
      { key: 'EventService.getEventById', name: '4️⃣ EventService 读取', field: 'startTime' },
      { key: 'eventsUpdated', name: '5️⃣ 事件通知', field: null }
    ];
    
    let previousValue = null;
    stages.forEach(({ key, name, field }) => {
      const stage = event.stages[key];
      if (stage) {
        const currentValue = field ? stage[field] : null;
        const match = !previousValue || previousValue === currentValue;
        const icon = match ? '✅' : '❌';
        const color = match ? '#4CAF50' : '#F44336';
        
        console.log(`%c${icon} ${name}`, `color: ${color}; font-weight: bold;`);
        console.log(`   时间: ${formatTime(stage.timestamp)}`);
        if (field) {
          console.log(`   ${field}: ${currentValue || '无'}`);
        }
        if (!match) {
          console.log(`   %c⚠️ 数据变化: ${previousValue} → ${currentValue}`, 'color: #FF9800;');
        }
        console.log('');
        
        if (currentValue) previousValue = currentValue;
      } else {
        console.log(`%c⏭️ ${name}`, 'color: #9E9E9E; font-weight: bold;');
        console.log('   未执行');
        console.log('');
      }
    });
    
    // 显示问题
    if (event.issues.length > 0) {
      console.log('%c========== 发现问题 ==========', 'background: #F44336; color: white; font-size: 14px; padding: 4px;');
      console.log('');
      event.issues.forEach((issue, index) => {
        console.log(`%c${index + 1}. ${issue.message}`, 'color: #F44336; font-weight: bold;');
        console.log(`   阶段: ${issue.stage}`);
        console.log(`   类型: ${issue.type}`);
        if (issue.expected !== undefined) {
          console.log(`   期望值: ${issue.expected}`);
          console.log(`   实际值: ${issue.actual}`);
        }
        console.log('');
      });
    } else {
      console.log('%c✅ 未发现问题，数据流正常', 'color: #4CAF50; font-size: 14px; font-weight: bold;');
      console.log('');
    }
    
    // 最终状态
    console.log('%c========== 最终状态 ==========', 'background: #4CAF50; color: white; font-size: 14px; padding: 4px;');
    console.log('');
    
    if (window.EventService) {
      const finalEvent = window.EventService.getEventById(id);
      if (finalEvent) {
        console.log('📦 localStorage:');
        console.log(`   startTime: ${finalEvent.startTime || '无'}`);
        console.log(`   endTime: ${finalEvent.endTime || '无'}`);
        console.log('');
      }
    }
    
    if (window.TimeHub) {
      const finalSnapshot = window.TimeHub.getSnapshot(id);
      console.log('⚡ TimeHub 缓存:');
      console.log(`   start: ${finalSnapshot.start || '无'}`);
      console.log(`   end: ${finalSnapshot.end || '无'}`);
      console.log('');
    }
  };
  
  window.listEvents = function() {
    console.clear();
    console.log('%c已追踪的事件:', 'font-size: 14px; font-weight: bold;');
    console.log('');
    
    if (eventData.size === 0) {
      console.log('暂无追踪数据，请插入 DateMention');
      return;
    }
    
    eventData.forEach((event, eventId) => {
      const stageCount = Object.keys(event.stages).length;
      const hasIssues = event.issues.length > 0;
      const icon = hasIssues ? '❌' : '✅';
      
      console.log(`${icon} ${eventId}`);
      console.log(`   阶段: ${stageCount}/5`);
      if (hasIssues) {
        console.log(`   %c问题: ${event.issues.length}`, 'color: #F44336;');
      }
      console.log('');
    });
    
    console.log(`运行 diagnose() 查看最近事件的详细报告`);
    console.log(`运行 diagnose("eventId") 查看指定事件`);
  };
  
  // 初始化
  const timeHubOk = setupTimeHubInterceptor();
  const eventServiceOk = setupEventServiceInterceptor();
  
  console.log('');
  console.log('%c========== 使用说明 ==========', 'background: #673AB7; color: white; font-size: 14px; padding: 4px;');
  console.log('');
  console.log('1️⃣ 插入 DateMention（如 @明天下午2点）');
  console.log('2️⃣ 运行 diagnose() 查看诊断报告');
  console.log('3️⃣ 运行 listEvents() 查看所有追踪的事件');
  console.log('');
  console.log('%c所有操作自动记录，实时显示问题 🎯', 'color: #4CAF50; font-weight: bold; font-size: 12px;');
  console.log('');
  
  if (!timeHubOk || !eventServiceOk) {
    console.warn('%c⚠️ 部分模块未找到，请刷新页面后重试', 'color: #FF9800; font-weight: bold;');
  }
  
})();
