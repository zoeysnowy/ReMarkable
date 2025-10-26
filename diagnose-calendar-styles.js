/**
 * 日历样式诊断脚本
 * 在浏览器控制台运行此脚本，检查样式问题
 */

(function() {
  console.log('🔍 开始诊断 Desktop Calendar 样式问题...\n');

  // 1. 检查主容器
  const mainBody = document.querySelector('.desktop-calendar-main-body');
  if (mainBody) {
    console.log('✅ 找到主容器 .desktop-calendar-main-body');
    console.log('   - 计算后的样式:', window.getComputedStyle(mainBody));
    console.log('   - borderRadius:', window.getComputedStyle(mainBody).borderRadius);
    console.log('   - backgroundColor:', window.getComputedStyle(mainBody).backgroundColor);
    console.log('   - border:', window.getComputedStyle(mainBody).border);
  } else {
    console.log('❌ 未找到主容器 .desktop-calendar-main-body');
  }

  // 2. 检查 Toast UI Calendar Layout
  const layouts = document.querySelectorAll('.desktop-calendar-main-body .toastui-calendar-layout');
  console.log(`\n📦 找到 ${layouts.length} 个 .toastui-calendar-layout 容器`);
  layouts.forEach((layout, index) => {
    console.log(`\n   Layout ${index + 1}:`);
    console.log('   - 内联样式:', layout.getAttribute('style'));
    console.log('   - 计算后 backgroundColor:', window.getComputedStyle(layout).backgroundColor);
    console.log('   - 元素:', layout);
  });

  // 3. 检查 CSS 文件是否加载
  const styleSheets = Array.from(document.styleSheets);
  const desktopCalendarCSS = styleSheets.find(sheet => {
    try {
      return sheet.href && sheet.href.includes('DesktopTimeCalendar.css');
    } catch (e) {
      return false;
    }
  });

  if (desktopCalendarCSS) {
    console.log('\n✅ DesktopTimeCalendar.css 已加载');
    try {
      const rules = Array.from(desktopCalendarCSS.cssRules || []);
      console.log(`   - 包含 ${rules.length} 条 CSS 规则`);
      const relevantRules = rules.filter(rule => 
        rule.cssText && rule.cssText.includes('desktop-calendar-main-body')
      );
      console.log(`   - 其中 ${relevantRules.length} 条与 desktop-calendar-main-body 相关`);
      relevantRules.forEach(rule => {
        console.log(`   - ${rule.cssText.substring(0, 100)}...`);
      });
    } catch (e) {
      console.log('   - 无法读取 CSS 规则（可能是跨域问题）');
    }
  } else {
    console.log('\n❌ DesktopTimeCalendar.css 未找到');
    console.log('   已加载的样式表:', styleSheets.map(s => s.href));
  }

  // 4. 检查样式优先级冲突
  if (mainBody) {
    console.log('\n🎨 样式优先级检查:');
    const styles = window.getComputedStyle(mainBody);
    console.log('   - borderRadius 来源:', styles.getPropertyValue('border-radius'));
    console.log('   - backgroundColor 来源:', styles.getPropertyValue('background-color'));
  }

  // 5. 提供修复建议
  console.log('\n💡 修复建议:');
  if (!mainBody) {
    console.log('   1. 确认组件已正确渲染');
    console.log('   2. 检查 className 是否正确设置');
  } else {
    const computedRadius = window.getComputedStyle(mainBody).borderRadius;
    if (computedRadius === '0px' || computedRadius === 'none') {
      console.log('   1. borderRadius 未生效，可能被其他样式覆盖');
      console.log('   2. 尝试在内联样式中添加 !important');
    }
  }

  if (layouts.length === 0) {
    console.log('   3. Toast UI Calendar 尚未渲染，请稍后再试');
  } else {
    layouts.forEach((layout, index) => {
      const bgColor = window.getComputedStyle(layout).backgroundColor;
      if (bgColor !== 'transparent' && bgColor !== 'rgba(0, 0, 0, 0)') {
        console.log(`   4. Layout ${index + 1} 背景色未透明: ${bgColor}`);
        console.log(`      尝试手动设置: layout.style.backgroundColor = 'transparent'`);
      }
    });
  }

  console.log('\n✨ 诊断完成！');
})();
