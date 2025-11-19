/**
 * 临时脚本：为现有事件生成历史记录
 * 这将帮助已有事件显示状态线
 */

// 模拟localStorage环境（如果在Node.js中运行）
if (typeof localStorage === 'undefined') {
  const { LocalStorage } = require('node-localstorage');
  global.localStorage = new LocalStorage('./tmp');
}

// 简化的EventHistoryService
const EventHistoryService = {
  logCreate: (eventId, eventData) => {
    const historyKey = 'remarkable-event-history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      action: 'create',
      timestamp: new Date().toISOString(),
      data: eventData,
      metadata: {
        source: 'history-population',
        component: 'populate-script'
      }
    };
    
    history.push(logEntry);
    localStorage.setItem(historyKey, JSON.stringify(history));
    console.log(`✅ 为事件 ${eventId} 创建历史记录: create`);
  }
};

// 获取现有事件并为它们创建历史记录
function populateHistoryForExistingEvents() {
  try {
    const eventsData = localStorage.getItem('remarkable-events');
    if (!eventsData) {
      console.log('❌ 没有找到现有事件数据');
      return;
    }
    
    const events = JSON.parse(eventsData);
    console.log(`📚 找到 ${events.length} 个现有事件`);
    
    events.forEach((event, index) => {
      // 为每个事件创建一个创建历史记录
      // 使用事件的 createdAt 时间或当前时间
      const createTime = event.createdAt || new Date().toISOString();
      
      // 模拟在不同时间点创建的历史
      const baseTime = new Date(createTime);
      const createTimestamp = new Date(baseTime.getTime() - (events.length - index) * 60 * 1000); // 每个事件间隔1分钟
      
      const logEntry = {
        id: `${createTimestamp.getTime()}-${Math.random().toString(36).substr(2, 9)}`,
        eventId: event.id,
        action: 'create',
        timestamp: createTimestamp.toISOString(),
        data: {
          title: event.title,
          startTime: event.startTime,
          endTime: event.endTime,
          isAllDay: event.isAllDay
        },
        metadata: {
          source: 'history-population',
          component: 'populate-script'
        }
      };
      
      // 添加到历史记录
      const historyKey = 'remarkable-event-history';
      const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
      history.push(logEntry);
      localStorage.setItem(historyKey, JSON.stringify(history));
      
      console.log(`✅ 为事件 "${event.title}" (${event.id}) 创建历史记录`);
    });
    
    console.log(`🎉 历史记录填充完成！共处理 ${events.length} 个事件`);
    
    // 显示最终的历史记录统计
    const finalHistory = JSON.parse(localStorage.getItem('remarkable-event-history') || '[]');
    console.log(`📊 总历史记录数: ${finalHistory.length}`);
    
  } catch (error) {
    console.error('❌ 填充历史记录时出错:', error);
  }
}

// 如果在浏览器中运行
if (typeof window !== 'undefined') {
  // 在浏览器控制台中运行
  console.log('🚀 开始填充历史记录...');
  populateHistoryForExistingEvents();
} else {
  // Node.js环境中的处理
  console.log('请在浏览器控制台中运行此脚本');
}