/**
 * 测试事件颜色显示逻辑
 * 
 * 需求：
 * 1. 有标签的事件 → 显示第一个标签的颜色
 * 2. 无标签的事件 → 显示映射日历的颜色
 * 3. 既无标签也无日历 → 显示默认颜色 (#3788d8)
 * 
 * 修复内容：
 * 1. getEventColor: 添加调试日志，显示颜色来源
 * 2. getTagColor: 添加标签查找日志
 * 3. convertToCalendarEvent: 优先使用 tags[0] 作为 calendarId
 * 
 * 测试步骤：
 * 1. 打开应用并查看日历视图
 * 2. 打开浏览器控制台 (F12)
 * 3. 查找 🎨 [getEventColor] 日志
 * 4. 验证每个事件的颜色来源
 * 
 * 预期日志示例：
 * ```
 * 🎨 [getEventColor] Event "会议" - Using first tag color: { tagId: "tag-123", color: "#ff6b6b" }
 * 🎨 [getTagColor] Found tag: { tagId: "tag-123", tagName: "工作", color: "#ff6b6b" }
 * ```
 */

console.log('🎨 Event Color Test Guide');
console.log('');
console.log('📋 Color Priority:');
console.log('1. First tag color (if tags array exists)');
console.log('2. Single tagId color (backward compatibility)');
console.log('3. Calendar group color (from calendarId)');
console.log('4. Default color (#3788d8)');
console.log('');
console.log('🧪 Test Commands:');
console.log('');
console.log('// Get all events and check their colors');
console.log('const events = JSON.parse(localStorage.getItem("remarkable-events") || "[]");');
console.log('events.forEach(e => {');
console.log('  console.log(`Event: ${e.title}`);');
console.log('  console.log(`  tags: ${JSON.stringify(e.tags)}`);');
console.log('  console.log(`  tagId: ${e.tagId}`);');
console.log('  console.log(`  calendarId: ${e.calendarId}`);');
console.log('});');
console.log('');
console.log('// Get all tags and their colors');
console.log('const tags = JSON.parse(localStorage.getItem("remarkable-tags") || "[]");');
console.log('const flattenTags = (tagList, prefix = "") => {');
console.log('  return tagList.flatMap(tag => {');
console.log('    const current = { id: tag.id, name: prefix + tag.name, color: tag.color };');
console.log('    if (tag.children) {');
console.log('      return [current, ...flattenTags(tag.children, prefix + tag.name + " > ")];');
console.log('    }');
console.log('    return [current];');
console.log('  });');
console.log('};');
console.log('flattenTags(tags).forEach(t => console.log(`${t.name}: ${t.color}`));');
console.log('');
console.log('// Check calendar colors from cache');
console.log('const calendars = JSON.parse(localStorage.getItem("remarkable-calendars-cache") || "[]");');
console.log('calendars.forEach(cal => {');
console.log('  console.log(`${cal.name}: ${cal.color} (${cal.backgroundColor || "N/A"})`);');
console.log('});');
console.log('');
console.log('✅ Expected Results:');
console.log('- Events with tags show tag color');
console.log('- Events without tags show calendar color');
console.log('- Console shows 🎨 logs for each event');
console.log('- Color squares in calendar match tag/calendar colors');
