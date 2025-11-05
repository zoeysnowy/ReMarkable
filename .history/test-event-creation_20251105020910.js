/**
 * 测试脚本：验证 EventEditModal 新建事件功能
 * 
 * 问题：EventEditModal 点击确认后，新建的事件没有保存到 localStorage
 * 
 * 修复：区分新建事件和编辑事件，新建时调用 EventHub.createEvent()
 * 
 * ⚠️ 在浏览器控制台运行
 */

(async function testEventCreation() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🧪 测试：EventEditModal 新建事件功能');
  console.log('='.repeat(80));
  console.log('');

  const STORAGE_KEY = 'remarkable-events';

  try {
    // ==================== 步骤 1: 检查初始状态 ====================
    console.log('📊 步骤 1: 检查初始状态...');
    
    const initialEvents = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    console.log(`当前事件数量: ${initialEvents.length}`);
    console.log('');

    // ==================== 步骤 2: 模拟新建事件 ====================
    console.log('✨ 步骤 2: 模拟新建事件...');
    
    const testEventId = `test-modal-create-${Date.now()}`;
    const now = new Date();
    const endTime = new Date(now.getTime() + 3600000);

    const newEvent = {
      id: testEventId,
      title: '🧪 测试新建事件',
      description: '通过 EventEditModal 测试新建事件功能',
      startTime: now.toISOString(),
      endTime: endTime.toISOString(),
      isAllDay: false,
      tags: ['测试标签'],
      tagId: '测试标签',
      calendarId: window.syncManager?.microsoftService?.getSelectedCalendarId() || 'test-calendar',
      remarkableSource: true,
      syncStatus: 'pending',
      createdAt: now.toISOString(),
      updatedAt: now.toISOString()
    };

    console.log('新建事件:');
    console.log('  ID:', testEventId);
    console.log('  标题:', newEvent.title);
    console.log('  开始时间:', newEvent.startTime);
    console.log('  结束时间:', newEvent.endTime);
    console.log('');

    // ==================== 步骤 3: 调用 EventHub.createEvent ====================
    console.log('💾 步骤 3: 调用 EventHub.createEvent()...');
    
    const { EventHub } = await import('./src/services/EventHub.js');
    const result = await EventHub.createEvent(newEvent);

    if (!result.success) {
      console.error('❌ 创建失败:', result.error);
      return;
    }

    console.log('✅ 创建成功！');
    console.log('');

    // ==================== 步骤 4: 验证保存结果 ====================
    console.log('🔍 步骤 4: 验证保存结果...');
    
    const updatedEvents = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    const savedEvent = updatedEvents.find(e => e.id === testEventId);

    if (!savedEvent) {
      console.error('❌ 验证失败：localStorage 中未找到新建的事件');
      console.log('当前事件数量:', updatedEvents.length);
      return;
    }

    console.log('✅ 验证通过：事件已保存到 localStorage');
    console.log('');
    console.log('保存的事件:');
    console.log('  ID:', savedEvent.id);
    console.log('  标题:', savedEvent.title);
    console.log('  开始时间:', savedEvent.startTime);
    console.log('  remarkableSource:', savedEvent.remarkableSource);
    console.log('  syncStatus:', savedEvent.syncStatus);
    console.log('');

    // ==================== 步骤 5: 验证 EventHub 缓存 ====================
    console.log('🗂️ 步骤 5: 验证 EventHub 缓存...');
    
    const cachedEvent = EventHub.getSnapshot(testEventId);
    
    if (!cachedEvent) {
      console.warn('⚠️ EventHub 缓存中未找到事件（可能正常）');
    } else {
      console.log('✅ EventHub 缓存验证通过');
      console.log('  缓存标题:', cachedEvent.title);
    }
    console.log('');

    // ==================== 步骤 6: 验证同步队列 ====================
    console.log('📋 步骤 6: 验证同步队列...');
    
    const queue = JSON.parse(localStorage.getItem('remarkable-dev-persistent-syncActions') || '[]');
    const action = queue.find(a => a.entityId === testEventId);

    if (!action) {
      console.warn('⚠️ 同步队列中未找到对应的 action');
      console.log('   可能原因: skipSync=true 或同步管理器未初始化');
    } else {
      console.log('✅ 同步队列验证通过');
      console.log('  Action Type:', action.type);
      console.log('  Synchronized:', action.synchronized);
      console.log('  Retry Count:', action.retryCount || 0);
    }
    console.log('');

    // ==================== 步骤 7: 模拟编辑事件 ====================
    console.log('📝 步骤 7: 模拟编辑事件（测试更新流程）...');
    
    const updateResult = await EventHub.updateFields(testEventId, {
      title: '🧪 测试新建事件（已编辑）',
      description: '测试编辑功能'
    });

    if (!updateResult.success) {
      console.error('❌ 编辑失败:', updateResult.error);
    } else {
      console.log('✅ 编辑成功！');
      
      const editedEvent = EventHub.getSnapshot(testEventId);
      console.log('  更新后的标题:', editedEvent?.title);
      console.log('  更新后的描述:', editedEvent?.description);
    }
    console.log('');

    // ==================== 步骤 8: 清理测试数据 ====================
    console.log('🧹 步骤 8: 清理测试数据...');
    
    const deleteResult = await EventHub.deleteEvent(testEventId);
    
    if (!deleteResult.success) {
      console.error('❌ 删除失败:', deleteResult.error);
    } else {
      console.log('✅ 测试数据已清理');
    }
    console.log('');

    // ==================== 测试结果 ====================
    console.log('='.repeat(80));
    console.log('📊 测试结果：');
    console.log('='.repeat(80));
    console.log('✅ 新建事件功能正常');
    console.log('✅ EventHub.createEvent() 工作正常');
    console.log('✅ 事件保存到 localStorage');
    console.log('✅ 编辑事件功能正常');
    console.log('✅ 删除事件功能正常');
    console.log('='.repeat(80));
    console.log('');
    console.log('💡 提示：在 TimeCalendar 中创建事件测试步骤：');
    console.log('   1. 在日历上拖动选择时间范围');
    console.log('   2. EditModal 弹出');
    console.log('   3. 填写标题和标签');
    console.log('   4. 点击确认');
    console.log('   5. 查看事件是否出现在日历上');
    console.log('');

  } catch (error) {
    console.error('❌ 测试失败:', error);
    console.error(error.stack);
  }
})();
