// 测试日历选择功能的脚本
// 在浏览器控制台中运行

console.log('🧪 Testing Calendar Selection Feature');

// 1. 测试是否能获取到可用的日历
function testCalendarLoading() {
    console.log('1️⃣ Testing Calendar Loading...');
    
    // 检查availableCalendars是否被加载
    const availableCalendars = window.localStorage.getItem('remarkable-available-calendars');
    if (availableCalendars) {
        const calendars = JSON.parse(availableCalendars);
        console.log('✅ Found available calendars:', calendars.length);
        calendars.forEach(cal => {
            console.log(`  📋 ${cal.name} (${cal.id})`);
        });
    } else {
        console.log('❌ No available calendars found in localStorage');
    }
}

// 2. 测试标签到日历的映射
function testTagToCalendarMapping() {
    console.log('2️⃣ Testing Tag to Calendar Mapping...');
    
    const tags = JSON.parse(localStorage.getItem('remarkable-hierarchical-tags') || '[]');
    const calendars = JSON.parse(localStorage.getItem('remarkable-available-calendars') || '[]');
    
    console.log('Available tags:', tags.length);
    console.log('Available calendars:', calendars.length);
    
    // 查找有日历映射的标签
    const mappedTags = tags.filter(tag => tag.calendarId);
    console.log('Tags with calendar mapping:', mappedTags.length);
    
    mappedTags.forEach(tag => {
        const calendar = calendars.find(cal => cal.id === tag.calendarId);
        if (calendar) {
            console.log(`✅ ${tag.name} → ${calendar.name}`);
        } else {
            console.log(`❌ ${tag.name} → Unknown calendar (${tag.calendarId})`);
        }
    });
}

// 3. 测试事件创建
function testEventCreation() {
    console.log('3️⃣ Testing Event Creation...');
    
    // 检查最新创建的事件
    const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
    console.log('Total events:', events.length);
    
    // 按创建时间排序，查看最新的3个事件
    const recentEvents = events
        .sort((a, b) => new Date(b.createdAt || b.start).getTime() - new Date(a.createdAt || a.start).getTime())
        .slice(0, 3);
    
    console.log('Recent events:');
    recentEvents.forEach((event, index) => {
        console.log(`  ${index + 1}. ${event.title}`);
        console.log(`     📋 Calendar: ${event.calendarId || 'Not assigned'}`);
        console.log(`     🏷️ Tags: ${event.tagIds?.join(', ') || 'No tags'}`);
        console.log(`     📅 Date: ${new Date(event.start).toLocaleDateString()}`);
    });
}

// 4. 检查事件编辑弹窗的状态
function checkEventEditModal() {
    console.log('4️⃣ Checking EventEditModal state...');
    
    // 检查是否有React组件可用
    const reactFiberKey = Object.keys(document.querySelector('#root') || {}).find(key => key.startsWith('__reactFiber'));
    if (reactFiberKey) {
        console.log('✅ React app detected');
    } else {
        console.log('❌ React app not found');
    }
    
    // 检查模态框是否存在
    const modal = document.querySelector('[data-testid="event-edit-modal"], .event-edit-modal, [class*="Modal"]');
    if (modal) {
        console.log('✅ Event edit modal found in DOM');
    } else {
        console.log('ℹ️ Event edit modal not currently visible');
    }
}

// 运行所有测试
function runAllTests() {
    console.log('🧪 Starting Calendar Selection Feature Tests');
    console.log('='.repeat(50));
    
    testCalendarLoading();
    console.log('');
    testTagToCalendarMapping();
    console.log('');
    testEventCreation();
    console.log('');
    checkEventEditModal();
    
    console.log('');
    console.log('🏁 Tests completed');
}

// 导出函数供控制台使用
window.testCalendarSelection = {
    runAllTests,
    testCalendarLoading,
    testTagToCalendarMapping,
    testEventCreation,
    checkEventEditModal
};

console.log('📋 Calendar Selection Test Functions loaded');
console.log('💡 Run: testCalendarSelection.runAllTests()');