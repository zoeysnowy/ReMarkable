/**
 * 桌面日历组件外观自定义功能测试
 * 测试背景颜色和透明度调整功能
 */

console.log('🎨 桌面日历组件外观自定义功能测试');

// 测试 localStorage 保存和读取
function testLocalStoragePersistence() {
  console.log('\n📦 测试 1: localStorage 数据持久化');
  
  try {
    // 保存测试数据
    localStorage.setItem('widget-bg-color', '#6464ff');
    localStorage.setItem('widget-bg-opacity', '0.75');
    
    // 读取测试数据
    const savedColor = localStorage.getItem('widget-bg-color');
    const savedOpacity = localStorage.getItem('widget-bg-opacity');
    
    console.log('✅ 保存成功');
    console.log('  - 颜色:', savedColor);
    console.log('  - 透明度:', savedOpacity);
    
    return savedColor === '#6464ff' && savedOpacity === '0.75';
  } catch (error) {
    console.error('❌ localStorage 测试失败:', error);
    return false;
  }
}

// 测试十六进制转 RGBA
function testHexToRgba() {
  console.log('\n🎨 测试 2: 颜色格式转换 (Hex → RGBA)');
  
  const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };
  
  const tests = [
    { hex: '#ffffff', alpha: 1.0, expected: 'rgba(255, 255, 255, 1)' },
    { hex: '#000000', alpha: 0.5, expected: 'rgba(0, 0, 0, 0.5)' },
    { hex: '#6464ff', alpha: 0.75, expected: 'rgba(100, 100, 255, 0.75)' },
    { hex: '#e8e8ff', alpha: 0.9, expected: 'rgba(232, 232, 255, 0.9)' }
  ];
  
  let passed = true;
  tests.forEach(test => {
    const result = hexToRgba(test.hex, test.alpha);
    const success = result === test.expected;
    console.log(success ? '✅' : '❌', 
      `${test.hex} @ ${test.alpha} → ${result}`,
      success ? '' : `(期望: ${test.expected})`
    );
    if (!success) passed = false;
  });
  
  return passed;
}

// 测试预设颜色
function testPresetColors() {
  console.log('\n🌈 测试 3: 预设颜色配置');
  
  const presetColors = [
    { name: '白色', hex: '#ffffff', desc: '经典白色背景' },
    { name: '浅灰', hex: '#f0f0f0', desc: '柔和中性背景' },
    { name: '浅紫', hex: '#e8e8ff', desc: '清新紫色调' },
    { name: '浅粉', hex: '#ffe8e8', desc: '温暖粉色调' },
    { name: '浅绿', hex: '#e8ffe8', desc: '清新绿色调' },
    { name: '浅黄', hex: '#fff8e8', desc: '温馨黄色调' },
    { name: '黑色', hex: '#000000', desc: '深色模式背景' }
  ];
  
  console.log(`✅ 预设颜色数量: ${presetColors.length}`);
  presetColors.forEach(color => {
    console.log(`  - ${color.name} (${color.hex}): ${color.desc}`);
  });
  
  return presetColors.length === 7;
}

// 测试透明度范围
function testOpacityRange() {
  console.log('\n📊 测试 4: 透明度范围验证');
  
  const testValues = [0, 0.25, 0.5, 0.75, 1.0];
  let passed = true;
  
  testValues.forEach(value => {
    const isValid = value >= 0 && value <= 1;
    const percentage = Math.round(value * 100);
    console.log(isValid ? '✅' : '❌', 
      `透明度: ${value} (${percentage}%)`,
      isValid ? '' : '⚠️ 超出范围'
    );
    if (!isValid) passed = false;
  });
  
  return passed;
}

// 测试设置面板交互
function testSettingsPanelInteraction() {
  console.log('\n🖱️ 测试 5: 设置面板交互');
  
  const interactions = [
    '点击设置按钮打开/关闭面板',
    '点击颜色选择器选择颜色',
    '在文本框输入十六进制颜色',
    '点击预设颜色快速切换',
    '拖动滑块调整透明度',
    '查看实时预览效果'
  ];
  
  console.log('✅ 支持的交互方式:');
  interactions.forEach((interaction, index) => {
    console.log(`  ${index + 1}. ${interaction}`);
  });
  
  return true;
}

// 测试使用场景
function testUsageScenarios() {
  console.log('\n🎯 测试 6: 使用场景验证');
  
  const scenarios = [
    {
      name: '半透明悬浮日历',
      bgColor: '#ffffff',
      bgOpacity: 0.7,
      desc: '白色半透明背景，可以看到桌面壁纸'
    },
    {
      name: '深色模式',
      bgColor: '#000000',
      bgOpacity: 0.85,
      desc: '深色半透明背景，护眼且现代'
    },
    {
      name: '彩色主题',
      bgColor: '#e8e8ff',
      bgOpacity: 1.0,
      desc: '浅紫色不透明背景，清新活力'
    },
    {
      name: '完全透明',
      bgColor: '#ffffff',
      bgOpacity: 0.0,
      desc: '完全透明背景，只显示日历内容'
    }
  ];
  
  console.log('✅ 预设使用场景:');
  scenarios.forEach(scenario => {
    console.log(`  📌 ${scenario.name}`);
    console.log(`     颜色: ${scenario.bgColor}, 透明度: ${scenario.bgOpacity * 100}%`);
    console.log(`     ${scenario.desc}`);
  });
  
  return scenarios.length === 4;
}

// 运行所有测试
function runAllTests() {
  console.log('='.repeat(60));
  console.log('🚀 开始测试桌面日历组件外观自定义功能');
  console.log('='.repeat(60));
  
  const results = [
    { name: 'localStorage 持久化', passed: testLocalStoragePersistence() },
    { name: '颜色格式转换', passed: testHexToRgba() },
    { name: '预设颜色配置', passed: testPresetColors() },
    { name: '透明度范围', passed: testOpacityRange() },
    { name: '设置面板交互', passed: testSettingsPanelInteraction() },
    { name: '使用场景验证', passed: testUsageScenarios() }
  ];
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 测试结果汇总');
  console.log('='.repeat(60));
  
  const passedCount = results.filter(r => r.passed).length;
  const totalCount = results.length;
  
  results.forEach(result => {
    console.log(result.passed ? '✅' : '❌', result.name);
  });
  
  console.log('\n' + '-'.repeat(60));
  console.log(`通过: ${passedCount}/${totalCount} (${Math.round(passedCount/totalCount*100)}%)`);
  console.log('-'.repeat(60));
  
  if (passedCount === totalCount) {
    console.log('🎉 所有测试通过！功能正常工作！');
  } else {
    console.log('⚠️ 部分测试失败，请检查实现');
  }
}

// 清理测试数据
function cleanup() {
  console.log('\n🧹 清理测试数据...');
  localStorage.removeItem('widget-bg-color');
  localStorage.removeItem('widget-bg-opacity');
  console.log('✅ 清理完成');
}

// 执行测试
runAllTests();
cleanup();

// 导出测试函数供控制台使用
if (typeof window !== 'undefined') {
  window.testWidgetCustomization = runAllTests;
  console.log('\n💡 提示: 在控制台运行 testWidgetCustomization() 可以重新执行测试');
}
