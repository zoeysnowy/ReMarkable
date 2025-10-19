#!/usr/bin/env node

/**
 * UI验证脚本 - 检查界面实现是否符合设计规范
 * 运行方法: node ui-verification.js
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 开始UI界面核查...\n');

// 检查CSS Grid布局配置
function checkGridLayout() {
  console.log('1. 📐 检查Grid布局配置:');
  
  const cssFile = path.join(__dirname, 'src/components/AppLayout.css');
  
  if (!fs.existsSync(cssFile)) {
    console.log('   ❌ AppLayout.css 文件不存在');
    return false;
  }
  
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  
  // 检查Grid配置
  const checks = [
    { pattern: /display:\s*grid/, desc: '使用CSS Grid' },
    { pattern: /grid-template-columns:\s*98px\s+1fr/, desc: 'Sidebar宽度98px' },
    { pattern: /grid-template-areas/, desc: 'Grid区域定义' },
    { pattern: /grid-area:\s*header/, desc: 'Header区域' },
    { pattern: /grid-area:\s*sidebar/, desc: 'Sidebar区域' },
    { pattern: /grid-area:\s*main/, desc: 'Main区域' },
    { pattern: /grid-area:\s*statusbar/, desc: 'StatusBar区域' }
  ];
  
  let passed = 0;
  checks.forEach(check => {
    if (check.pattern.test(cssContent)) {
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  });
  
  console.log(`   📊 Grid布局: ${passed}/${checks.length} 项通过\n`);
  return passed === checks.length;
}

// 检查组件结构
function checkComponentStructure() {
  console.log('2. 🏗️ 检查组件结构:');
  
  const layoutFile = path.join(__dirname, 'src/components/AppLayout.tsx');
  
  if (!fs.existsSync(layoutFile)) {
    console.log('   ❌ AppLayout.tsx 文件不存在');
    return false;
  }
  
  const tsxContent = fs.readFileSync(layoutFile, 'utf8');
  
  const checks = [
    { pattern: /<Header\s*\/>/, desc: 'Header组件' },
    { pattern: /<Sidebar.*\/>/, desc: 'Sidebar组件' },
    { pattern: /<main.*className="app-main"/, desc: 'Main容器' },
    { pattern: /<StatusBar\s*\/>/, desc: 'StatusBar组件' },
    { pattern: /PageType/, desc: 'PageType类型定义' }
  ];
  
  let passed = 0;
  checks.forEach(check => {
    if (check.pattern.test(tsxContent)) {
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  });
  
  console.log(`   📊 组件结构: ${passed}/${checks.length} 项通过\n`);
  return passed === checks.length;
}

// 检查导航样式
function checkNavigationStyles() {
  console.log('3. 🧭 检查导航样式:');
  
  const cssFile = path.join(__dirname, 'src/components/AppLayout.css');
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  
  const checks = [
    { pattern: /\.nav-item\s*{[^}]*background:\s*transparent/, desc: '导航项默认透明背景' },
    { pattern: /\.nav-item:hover\s*{[^}]*background:\s*rgba\(0,\s*0,\s*0,\s*0\.02\)/, desc: '悬停状态样式' },
    { pattern: /\.nav-item\.active\s*{[^}]*background:\s*linear-gradient/, desc: '激活状态渐变背景' },
    { pattern: /width:\s*25px.*height:\s*25px/, desc: '图标尺寸25x25px' },
    { pattern: /font-size:\s*12px/, desc: '导航文字12px' }
  ];
  
  let passed = 0;
  checks.forEach(check => {
    if (check.pattern.test(cssContent)) {
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  });
  
  console.log(`   📊 导航样式: ${passed}/${checks.length} 项通过\n`);
  return passed >= Math.floor(checks.length * 0.8); // 80%通过即可
}

// 检查响应式设计
function checkResponsiveDesign() {
  console.log('4. 📱 检查响应式设计:');
  
  const cssFile = path.join(__dirname, 'src/components/AppLayout.css');
  const cssContent = fs.readFileSync(cssFile, 'utf8');
  
  const checks = [
    { pattern: /@media.*max-width:\s*1024px/, desc: '平板断点' },
    { pattern: /@media.*max-width:\s*768px/, desc: '手机断点' },
    { pattern: /@media.*max-width:\s*480px/, desc: '小屏手机断点' },
    { pattern: /grid-template-columns:\s*64px\s+1fr/, desc: '手机端Sidebar收缩' },
    { pattern: /grid-template-columns:\s*48px\s+1fr/, desc: '小屏Sidebar进一步收缩' }
  ];
  
  let passed = 0;
  checks.forEach(check => {
    if (check.pattern.test(cssContent)) {
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  });
  
  console.log(`   📊 响应式设计: ${passed}/${checks.length} 项通过\n`);
  return passed >= Math.floor(checks.length * 0.8);
}

// 检查页面容器
function checkPageContainer() {
  console.log('5. 📄 检查页面容器:');
  
  const containerFile = path.join(__dirname, 'src/components/PageContainer.tsx');
  const cssFile = path.join(__dirname, 'src/components/PageContainer.css');
  
  const checks = [];
  
  if (fs.existsSync(containerFile)) {
    checks.push({ status: true, desc: 'PageContainer组件存在' });
  } else {
    checks.push({ status: false, desc: 'PageContainer组件存在' });
  }
  
  if (fs.existsSync(cssFile)) {
    checks.push({ status: true, desc: 'PageContainer样式存在' });
    
    const cssContent = fs.readFileSync(cssFile, 'utf8');
    if (/\.page-container/.test(cssContent)) {
      checks.push({ status: true, desc: 'PageContainer样式定义' });
    }
  } else {
    checks.push({ status: false, desc: 'PageContainer样式存在' });
  }
  
  let passed = 0;
  checks.forEach(check => {
    if (check.status) {
      console.log(`   ✅ ${check.desc}`);
      passed++;
    } else {
      console.log(`   ❌ ${check.desc}`);
    }
  });
  
  console.log(`   📊 页面容器: ${passed}/${checks.length} 项通过\n`);
  return passed === checks.length;
}

// 主执行函数
async function runVerification() {
  const results = [
    checkGridLayout(),
    checkComponentStructure(), 
    checkNavigationStyles(),
    checkResponsiveDesign(),
    checkPageContainer()
  ];
  
  const passedChecks = results.filter(r => r).length;
  const totalChecks = results.length;
  
  console.log('📋 核查总结:');
  console.log(`✅ 通过检查: ${passedChecks}/${totalChecks}`);
  
  if (passedChecks === totalChecks) {
    console.log('🎉 UI界面核查完全通过! 达到A级发布标准');
  } else if (passedChecks >= Math.floor(totalChecks * 0.8)) {
    console.log('⚠️ UI界面基本合格，达到B级内测标准，建议进一步优化');
  } else {
    console.log('❌ UI界面需要重大修改，当前为C级开发标准');
  }
  
  console.log('\n💡 建议: 在浏览器中测试 http://localhost:3000 验证视觉效果');
}

// 运行验证
runVerification();