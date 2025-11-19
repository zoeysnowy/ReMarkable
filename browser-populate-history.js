// 在浏览器控制台中运行以下代码来为现有事件创建历史记录

// 简化的EventHistoryService
const EventHistoryService = {
  logCreate: (eventId, eventData, customTimestamp) => {
    const historyKey = 'remarkable-event-history';
    const history = JSON.parse(localStorage.getItem(historyKey) || '[]');
    
    const logEntry = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      eventId,
      action: 'create',
      timestamp: customTimestamp || new Date().toISOString(),
      data: eventData,
      metadata: {
        source: 'history-population',
        component: 'browser-console'
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
    
    // 清空现有历史记录（重新开始）
    localStorage.setItem('remarkable-event-history', '[]');
    console.log('🧹 清空现有历史记录');
    
    events.forEach((event, index) => {
      // 为每个事件创建一个创建历史记录
      // 使用事件的 createdAt 时间或模拟过去几天的时间
      let createTime;
      
      if (event.createdAt) {
        createTime = new Date(event.createdAt);
      } else {
        // 模拟在过去几天中创建
        const daysAgo = Math.floor(Math.random() * 7) + 1; // 1-7天前
        createTime = new Date();
        createTime.setDate(createTime.getDate() - daysAgo);
      }
      
      // 为了测试，让一些事件分布在过去5天
      const baseTime = new Date();
      baseTime.setDate(baseTime.getDate() - (index % 5 + 1)); // 分布在过去5天
      
      EventHistoryService.logCreate(event.id, {
        title: event.title,
        startTime: event.startTime,
        endTime: event.endTime,
        isAllDay: event.isAllDay
      }, baseTime.toISOString());
    });
    
    console.log(`🎉 历史记录填充完成！共处理 ${events.length} 个事件`);
    
    // 显示最终的历史记录统计
    const finalHistory = JSON.parse(localStorage.getItem('remarkable-event-history') || '[]');
    console.log(`📊 总历史记录数: ${finalHistory.length}`);
    console.log('📋 历史记录详情:', finalHistory);
    
    // 提示用户刷新页面或重新选择日期范围
    console.log('🔄 请在Plan页面重新选择日期范围来查看状态线！');
    
  } catch (error) {
    console.error('❌ 填充历史记录时出错:', error);
  }
}

// 运行填充脚本
console.log('🚀 开始填充历史记录...');
populateHistoryForExistingEvents();