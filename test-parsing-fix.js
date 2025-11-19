// 测试脚本：验证"下周三9点"的解析修复
import { parseNaturalLanguage } from './src/utils/naturalLanguageTimeDictionary.ts';

console.log('🧪 测试"下周三9点"解析修复');
console.log('当前时间:', new Date().toLocaleString('zh-CN'));
console.log('=' * 50);

const testCases = [
  '下周三9点',
  '下周三',
  '下周三下午3点',
  '明天8点',
  '后天10点半',
  '下周五14:30',
  '大后天9点一刻'
];

testCases.forEach((input, index) => {
  console.log(`\n📝 测试 ${index + 1}: "${input}"`);
  
  try {
    const result = parseNaturalLanguage(input);
    
    if (result.matched) {
      console.log('✅ 匹配成功');
      
      if (result.pointInTime) {
        console.log(`📅 日期: ${result.pointInTime.date.format('YYYY-MM-DD dddd')}`);
        console.log(`💬 提示: ${result.pointInTime.displayHint}`);
      }
      
      if (result.timePeriod) {
        console.log(`⏰ 时间: ${result.timePeriod.name}`);
        console.log(`🕘 开始: ${result.timePeriod.startHour}:${result.timePeriod.startMinute.toString().padStart(2,'0')}`);
        console.log(`🕘 结束: ${result.timePeriod.endHour}:${result.timePeriod.endMinute.toString().padStart(2,'0')}`);
        console.log(`🔄 类型: ${result.timePeriod.timeType || 'start'}`);
      }
    } else {
      console.log('❌ 未匹配');
    }
  } catch (error) {
    console.log('💥 错误:', error.message);
  }
});