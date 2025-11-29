/**
 * 诊断 localStorage quota 问题
 */

// 1. 检查当前所有 localStorage keys 的大小
console.log('📊 localStorage 使用情况:');
let total = 0;
const sizes = [];

for (let i = 0; i < localStorage.length; i++) {
  const key = localStorage.key(i);
  const value = localStorage.getItem(key);
  const size = value.length;
  total += size;
  sizes.push({ key, size, mb: (size / 1024 / 1024).toFixed(2) });
}

sizes.sort((a, b) => b.size - a.size);

console.log('总计:', (total / 1024 / 1024).toFixed(2), 'MB');
console.log('\n最大的 10 个 keys:');
sizes.slice(0, 10).forEach(s => {
  console.log(`  ${s.key}: ${s.mb} MB`);
});

// 2. 测试写入能力
console.log('\n🧪 测试 localStorage 写入限制:');

// 创建一个测试数据
const testKey = 'remarkable-test-quota';
const testData = 'x'.repeat(1024 * 1024); // 1MB 的数据

try {
  localStorage.setItem(testKey, testData);
  console.log('✅ 可以写入 1MB 数据');
  localStorage.removeItem(testKey);
  
  // 尝试写入更大的数据
  const bigData = 'x'.repeat(1024 * 1024 * 3); // 3MB
  localStorage.setItem(testKey, bigData);
  console.log('✅ 可以写入 3MB 数据');
  localStorage.removeItem(testKey);
  
} catch (error) {
  console.log('❌ 写入测试失败:', error.name, error.message);
  localStorage.removeItem(testKey);
}

// 3. 检查 remarkable-events 的实际可用空间
console.log('\n🔍 remarkable-events 写入测试:');
const events = JSON.parse(localStorage.getItem('remarkable-events'));
const currentSize = JSON.stringify(events).length;
console.log('当前大小:', (currentSize / 1024 / 1024).toFixed(2), 'MB');

// 尝试添加一个大的 event
const testEvent = {
  id: 'test-large-event-' + Date.now(),
  title: { simpleTitle: 'Test Event' },
  description: 'x'.repeat(100000), // 100KB
  eventlog: {
    slateJson: JSON.stringify([{ type: 'paragraph', children: [{ text: 'x'.repeat(100000) }] }]),
    html: '<p>' + 'x'.repeat(100000) + '</p>',
    plainText: 'x'.repeat(100000)
  },
  startTime: new Date().toISOString(),
  endTime: new Date().toISOString(),
  createdAt: new Date().toISOString()
};

try {
  const testEvents = [...events, testEvent];
  const testJson = JSON.stringify(testEvents);
  console.log('测试数据大小:', (testJson.length / 1024 / 1024).toFixed(2), 'MB');
  
  localStorage.setItem('remarkable-events', testJson);
  console.log('✅ 可以写入带有大 eventlog 的事件');
  
  // 恢复原数据
  localStorage.setItem('remarkable-events', JSON.stringify(events));
  
} catch (error) {
  console.log('❌ 写入失败:', error.name, error.message);
  // 恢复原数据
  localStorage.setItem('remarkable-events', JSON.stringify(events));
}

console.log('\n✅ 诊断完成');
