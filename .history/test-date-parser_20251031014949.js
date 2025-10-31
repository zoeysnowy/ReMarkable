// 测试日期解析
const { parseNaturalDate, formatDateDisplay } = require('./src/utils/dateParser.ts');

const testCases = [
  '明天',
  '明天上午九点',
  '明天下午3点',
  '后天',
  '下周一',
  '星期五下午2点',
  '今天晚上7点30分',
];

console.log('=== 日期解析测试 ===');
console.log('当前时间:', new Date().toLocaleString('zh-CN'));
console.log('');

testCases.forEach(text => {
  const result = parseNaturalDate(text);
  if (result) {
    const formatted = formatDateDisplay(result.start, true);
    console.log(`输入: "${text}"`);
    console.log(`解析: ${result.start.toLocaleString('zh-CN')}`);
    console.log(`显示: ${formatted}`);
    console.log('---');
  } else {
    console.log(`输入: "${text}" - 解析失败`);
    console.log('---');
  }
});
