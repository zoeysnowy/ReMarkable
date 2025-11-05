/**
 * 标签和日历检查脚本
 * 用于调试同步问题 - 查看可用的标签和日历
 * 
 * 使用方法：
 * 1. 打开浏览器控制台
 * 2. 复制整个脚本
 * 3. 粘贴并回车执行
 */

(function checkTagsAndCalendars() {
  console.clear();
  console.log('='.repeat(80));
  console.log('🔍 标签和日历检查工具');
  console.log('='.repeat(80));
  console.log('');

  // ==================== 检查标签系统 ====================
  console.log('📋 检查标签系统:');
  console.log('');

  if (!window.TagService) {
    console.error('❌ TagService 未找到！');
    console.log('   请确保应用已加载完成');
    return;
  }

  const flatTags = window.TagService.getFlatTags();
  
  if (!flatTags || flatTags.length === 0) {
    console.warn('⚠️ 没有可用的标签！');
    console.log('   请先在标签管理器中创建标签');
  } else {
    console.log(`✅ 找到 ${flatTags.length} 个标签:`);
    console.log('');
    
    flatTags.forEach((tag, index) => {
      const indent = '  '.repeat(tag.level || 0);
      console.log(`${indent}${index + 1}. [${tag.id}] ${tag.emoji || '🏷️'} ${tag.name}`);
      console.log(`${indent}   颜色: ${tag.color}`);
      console.log(`${indent}   层级: ${tag.level || 0}`);
      if (tag.calendarMapping) {
        console.log(`${indent}   日历映射: ${tag.calendarMapping.calendarName} (${tag.calendarMapping.calendarId})`);
      }
      console.log('');
    });
  }

  // ==================== 检查日历系统 ====================
  console.log('='.repeat(80));
  console.log('📅 检查日历系统:');
  console.log('');

  if (!window.syncManager) {
    console.error('❌ syncManager 未找到！');
    console.log('   请确保已登录 Microsoft 账户');
  } else if (!window.syncManager.microsoftService) {
    console.error('❌ microsoftService 未初始化！');
    console.log('   请确保已登录 Microsoft 账户');
  } else {
    const defaultCalendarId = window.syncManager.microsoftService.getSelectedCalendarId();
    
    if (!defaultCalendarId) {
      console.warn('⚠️ 未选择默认日历！');
      console.log('   请在设置中选择默认日历');
    } else {
      console.log(`✅ 默认日历ID: ${defaultCalendarId}`);
    }
    
    console.log('');
    
    // 尝试获取所有日历
    const calendars = window.syncManager.microsoftService.calendars || [];
    if (calendars.length > 0) {
      console.log(`📋 可用日历列表 (${calendars.length} 个):`);
      console.log('');
      calendars.forEach((cal, index) => {
        const isDefault = cal.id === defaultCalendarId;
        console.log(`${index + 1}. ${isDefault ? '⭐' : '  '} ${cal.name || '未命名'}`);
        console.log(`   ID: ${cal.id}`);
        console.log(`   所有者: ${cal.owner?.name || '未知'}`);
        console.log('');
      });
    } else {
      console.log('ℹ️ 日历列表为空（可能正在加载）');
    }
  }

  // ==================== 生成测试用配置 ====================
  console.log('='.repeat(80));
  console.log('🧪 测试脚本配置:');
  console.log('');

  if (flatTags && flatTags.length > 0 && window.syncManager?.microsoftService) {
    const testTagId = flatTags[0].id;
    const testTagName = flatTags[0].name;
    const defaultCalendarId = window.syncManager.microsoftService.getSelectedCalendarId();
    
    console.log('✅ 推荐配置:');
    console.log('');
    console.log('```javascript');
    console.log(`const testTagId = '${testTagId}'; // ${testTagName}`);
    console.log(`const defaultCalendarId = '${defaultCalendarId || 'default-calendar'}';`);
    console.log('');
    console.log('const testEvent = {');
    console.log('  id: "test-" + Date.now(),');
    console.log('  title: "🧪 测试事件",');
    console.log('  startTime: new Date().toISOString(),');
    console.log('  endTime: new Date(Date.now() + 3600000).toISOString(),');
    console.log(`  calendarId: '${defaultCalendarId || 'default-calendar'}',`);
    console.log(`  tags: ['${testTagId}'], // ✅ 使用真实标签ID数组`);
    console.log('  remarkableSource: true,');
    console.log('  syncStatus: "pending",');
    console.log('  createdAt: new Date().toISOString(),');
    console.log('  updatedAt: new Date().toISOString(),');
    console.log('  isAllDay: false');
    console.log('};');
    console.log('```');
    console.log('');
  } else {
    console.error('❌ 无法生成配置：缺少标签或日历数据');
  }

  // ==================== 检查同步条件 ====================
  console.log('='.repeat(80));
  console.log('🔧 同步条件检查:');
  console.log('');

  console.log('事件必须满足以下条件之一才会同步:');
  console.log('  1. 有 calendarId 或 calendarIds (推荐)');
  console.log('  2. 有 tagId 或 tags (标签可能有日历映射)');
  console.log('');
  console.log('检查逻辑:');
  console.log('```javascript');
  console.log('const hasCalendars = event.calendarId || (event.calendarIds?.length > 0);');
  console.log('const hasTag = event.tagId || (event.tags?.length > 0);');
  console.log('const willSync = hasCalendars || hasTag; // 必须为 true');
  console.log('```');
  console.log('');

  // ==================== 测试一个示例事件 ====================
  if (flatTags && flatTags.length > 0) {
    const testTagId = flatTags[0].id;
    const defaultCalendarId = window.syncManager?.microsoftService?.getSelectedCalendarId();
    
    console.log('='.repeat(80));
    console.log('🧪 示例事件验证:');
    console.log('');
    
    const exampleEvent = {
      calendarId: defaultCalendarId,
      tags: [testTagId]
    };
    
    const hasCalendars = exampleEvent.calendarId || (exampleEvent.calendarIds?.length > 0);
    const hasTag = exampleEvent.tagId || (exampleEvent.tags?.length > 0);
    const willSync = hasCalendars || hasTag;
    
    console.log('示例事件:');
    console.log(`  calendarId: "${exampleEvent.calendarId}"`);
    console.log(`  tags: [${exampleEvent.tags.map(id => `"${id}"`).join(', ')}]`);
    console.log('');
    console.log('验证结果:');
    console.log(`  hasCalendars: ${hasCalendars} ${hasCalendars ? '✅' : '❌'}`);
    console.log(`  hasTag: ${hasTag} ${hasTag ? '✅' : '❌'}`);
    console.log(`  willSync: ${willSync} ${willSync ? '✅ 会同步' : '❌ 不会同步'}`);
  }

  console.log('');
  console.log('='.repeat(80));
  console.log('✅ 检查完成');
  console.log('='.repeat(80));
})();
