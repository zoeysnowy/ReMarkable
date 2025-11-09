/**
 * 诊断脚本：检查 timer 事件的 tags 字段
 * 在浏览器 Console 中运行
 */

const events = JSON.parse(localStorage.getItem('remarkable-events') || '[]');
const timerEvents = events.filter(e => e.id && e.id.includes('new-1762625081433'));

console.log('🔍 Found timer events:', timerEvents.length);
timerEvents.forEach(event => {
  console.log(`
Event ID: ${event.id}
Title: ${event.title}
Tags: ${JSON.stringify(event.tags)}
Tags type: ${typeof event.tags}
Tags is Array: ${Array.isArray(event.tags)}
Full event:`, event);
});

// 检查所有事件的 tags 字段
const invalidTags = events.filter(e => {
  if (!e.tags) return false;
  if (!Array.isArray(e.tags)) return true;
  return e.tags.some(tagId => {
    // 标签 ID 不应该包含 'new-' 或 'timer-' 前缀
    return typeof tagId === 'string' && (tagId.includes('new-') || tagId.includes('timer-'));
  });
});

console.log('🚨 Events with invalid tags:', invalidTags.length);
if (invalidTags.length > 0) {
  console.log('Invalid events:', invalidTags.map(e => ({
    id: e.id,
    title: e.title,
    tags: e.tags
  })));
}
