/**
 * 清理 TimeCalendar 设置中的重复数据
 * 
 * 问题：visibleTags 和 visibleCalendars 数组有大量重复数据，占用内存
 * 解决：去重并保存
 */

console.log('🧹 开始清理 TimeCalendar 设置...');
console.log('');

const SETTINGS_KEY = 'remarkable-settings';
const settingsStr = localStorage.getItem(SETTINGS_KEY);

if (!settingsStr) {
  console.log('❌ 未找到设置数据');
} else {
  console.log(`📊 原始数据大小: ${(settingsStr.length / 1024).toFixed(2)} KB`);
  
  try {
    const settings = JSON.parse(settingsStr);
    
    console.log('');
    console.log('📋 原始数据统计:');
    console.log(`   visibleTags 长度: ${settings.visibleTags?.length || 0}`);
    console.log(`   visibleCalendars 长度: ${settings.visibleCalendars?.length || 0}`);
    
    // 去重
    let cleaned = false;
    
    if (settings.visibleTags && Array.isArray(settings.visibleTags)) {
      const originalLength = settings.visibleTags.length;
      settings.visibleTags = [...new Set(settings.visibleTags)];
      const newLength = settings.visibleTags.length;
      
      if (originalLength !== newLength) {
        console.log(`   ✅ visibleTags 去重: ${originalLength} → ${newLength} (移除 ${originalLength - newLength} 个重复)`);
        cleaned = true;
      }
    }
    
    if (settings.visibleCalendars && Array.isArray(settings.visibleCalendars)) {
      const originalLength = settings.visibleCalendars.length;
      settings.visibleCalendars = [...new Set(settings.visibleCalendars)];
      const newLength = settings.visibleCalendars.length;
      
      if (originalLength !== newLength) {
        console.log(`   ✅ visibleCalendars 去重: ${originalLength} → ${newLength} (移除 ${originalLength - newLength} 个重复)`);
        cleaned = true;
      }
    }
    
    if (cleaned) {
      // 保存清理后的数据
      const cleanedStr = JSON.stringify(settings);
      localStorage.setItem(SETTINGS_KEY, cleanedStr);
      
      console.log('');
      console.log(`💾 清理后数据大小: ${(cleanedStr.length / 1024).toFixed(2)} KB`);
      console.log(`📉 减少: ${((settingsStr.length - cleanedStr.length) / 1024).toFixed(2)} KB (${(100 * (1 - cleanedStr.length / settingsStr.length)).toFixed(1)}%)`);
      console.log('');
      console.log('✅ 清理完成！');
    } else {
      console.log('');
      console.log('✅ 数据已经是去重状态，无需清理');
    }
    
  } catch (error) {
    console.error('❌ 解析或清理失败:', error);
  }
}
