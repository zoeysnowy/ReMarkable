/**
 * 控制栏背景色诊断脚本
 * 在浏览器控制台运行此脚本，诊断控制栏背景色问题
 */

(function() {
  console.log('🔍 开始诊断控制栏背景色问题...\n');

  // 1. 查找控制栏元素
  const controller = document.querySelector('.toastui-calendar-controls');
  
  if (!controller) {
    console.log('❌ 未找到 .toastui-calendar-controls 元素');
    return;
  }
  
  console.log('✅ 找到控制栏元素:', controller);
  
  // 2. 检查内联样式
  console.log('\n📋 内联样式属性:');
  console.log('   - style.background:', controller.style.background);
  console.log('   - style.backgroundColor:', controller.style.backgroundColor);
  console.log('   - 完整 style 属性:', controller.getAttribute('style'));
  
  // 3. 检查计算后的样式
  const computed = window.getComputedStyle(controller);
  console.log('\n🎨 计算后的样式:');
  console.log('   - background:', computed.background);
  console.log('   - backgroundColor:', computed.backgroundColor);
  console.log('   - backgroundImage:', computed.backgroundImage);
  console.log('   - backdropFilter:', computed.backdropFilter);
  console.log('   - border:', computed.border);
  
  // 4. 检查是否有 CSS 规则覆盖
  console.log('\n🔧 CSS 规则检查:');
  const styleSheets = Array.from(document.styleSheets);
  let foundRules = [];
  
  styleSheets.forEach(sheet => {
    try {
      const rules = Array.from(sheet.cssRules || []);
      rules.forEach(rule => {
        if (rule.selectorText && rule.selectorText.includes('toastui-calendar-controls')) {
          foundRules.push({
            selector: rule.selectorText,
            cssText: rule.cssText,
            hasImportant: rule.cssText.includes('!important')
          });
        }
      });
    } catch (e) {
      // 跨域 CSS 无法读取
    }
  });
  
  if (foundRules.length > 0) {
    console.log(`   找到 ${foundRules.length} 条相关 CSS 规则:`);
    foundRules.forEach((rule, index) => {
      console.log(`\n   规则 ${index + 1}:`);
      console.log(`   - 选择器: ${rule.selector}`);
      console.log(`   - 是否有 !important: ${rule.hasImportant}`);
      console.log(`   - CSS 内容:\n${rule.cssText}`);
    });
  } else {
    console.log('   ❌ 未找到针对 .toastui-calendar-controls 的 CSS 规则');
  }
  
  // 5. 检查动态注入的样式
  console.log('\n💉 动态注入的样式检查:');
  const dynamicStyle = document.getElementById('timecalendar-adaptive-styles');
  if (dynamicStyle) {
    console.log('   ✅ 找到动态样式元素 #timecalendar-adaptive-styles');
    const content = dynamicStyle.textContent;
    const controlsRules = content.match(/\.toastui-calendar-controls[^}]+}/g);
    if (controlsRules) {
      console.log(`   找到 ${controlsRules.length} 条控制栏规则:`);
      controlsRules.forEach((rule, i) => {
        console.log(`\n   规则 ${i + 1}:\n${rule}`);
      });
    } else {
      console.log('   ⚠️ 动态样式中没有找到 .toastui-calendar-controls 规则');
    }
  } else {
    console.log('   ❌ 未找到动态样式元素');
  }
  
  // 6. 检查特异性冲突
  console.log('\n⚡ CSS 特异性分析:');
  console.log('   内联样式优先级: 1000');
  console.log('   内联样式 + !important: 10000');
  console.log('   .toastui-calendar-controls: 10');
  console.log('   .toastui-calendar-controls[style*="background"]: 20');
  
  // 7. 测试修改背景色
  console.log('\n🧪 测试修改背景色:');
  const originalBg = controller.style.background;
  console.log(`   原始背景: ${originalBg}`);
  
  // 测试1: 直接设置
  controller.style.background = 'rgba(255, 0, 0, 0.5)';
  console.log(`   设置红色后: ${window.getComputedStyle(controller).backgroundColor}`);
  
  // 测试2: 使用 !important (通过 setAttribute)
  controller.setAttribute('style', controller.getAttribute('style') + '; background: rgba(0, 255, 0, 0.5) !important;');
  console.log(`   设置绿色 !important 后: ${window.getComputedStyle(controller).backgroundColor}`);
  
  // 恢复原始样式
  controller.setAttribute('style', controller.getAttribute('style').replace(/background:[^;]+;?/g, '') + `background: ${originalBg};`);
  console.log(`   恢复原始背景: ${window.getComputedStyle(controller).backgroundColor}`);
  
  // 8. 检查父元素影响
  console.log('\n👪 父元素检查:');
  let parent = controller.parentElement;
  let level = 1;
  while (parent && level <= 3) {
    const parentComputed = window.getComputedStyle(parent);
    console.log(`   父元素 ${level}: ${parent.className || parent.tagName}`);
    console.log(`      - backgroundColor: ${parentComputed.backgroundColor}`);
    console.log(`      - opacity: ${parentComputed.opacity}`);
    parent = parent.parentElement;
    level++;
  }
  
  // 9. 诊断结论
  console.log('\n📊 诊断结论:');
  
  const hasInlineStyle = controller.style.background || controller.style.backgroundColor;
  const hasComputedBg = computed.backgroundColor !== 'rgba(0, 0, 0, 0)';
  const hasCSSOverride = foundRules.some(r => r.hasImportant);
  
  if (!hasInlineStyle) {
    console.log('   ⚠️ 问题: 内联样式未设置背景色');
    console.log('   建议: 检查 JSX 中 style={{background: ...}} 是否正确传递');
  }
  
  if (hasCSSOverride) {
    console.log('   ⚠️ 问题: CSS 规则使用了 !important 覆盖内联样式');
    console.log('   建议: 移除 CSS 中的 !important 或在内联样式中也使用 !important');
  }
  
  if (!hasComputedBg) {
    console.log('   ⚠️ 问题: 计算后的背景色为透明');
    console.log('   建议: 检查是否有其他规则强制设置为 transparent');
  }
  
  if (hasInlineStyle && !hasCSSOverride && hasComputedBg) {
    console.log('   ✅ 样式正常，背景色应该可见');
  }
  
  console.log('\n✨ 诊断完成！');
  console.log('💡 提示: 如果问题仍然存在，请将以上输出发送给开发者');
})();
