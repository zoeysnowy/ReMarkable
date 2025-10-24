/**
 * Electron 启动性能测试
 * 假设 React 服务器已经在运行，只测试 Electron 启动速度
 * 
 * 使用方法：
 * 1. 先在一个终端运行: npm start
 * 2. 等待 React 编译完成
 * 3. 在另一个终端运行: node test-electron-startup.js
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const http = require('http');

console.log('\n========================================');
console.log('  Electron 启动性能测试');
console.log('========================================\n');

// 检测 React 服务器是否就绪
async function checkReactServer() {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      resolve(false);
    });
    
    req.setTimeout(1000);
  });
}

async function main() {
  console.log('[前置检查] 检查 React 服务器状态...');
  
  const reactReady = await checkReactServer();
  
  if (!reactReady) {
    console.log('  ❌ React 服务器未运行\n');
    console.log('⚠️  请先启动 React 服务器:');
    console.log('   1. 在另一个终端运行: npm start');
    console.log('   2. 等待 "Compiled successfully!" 出现');
    console.log('   3. 然后重新运行此测试\n');
    process.exit(0);
  }
  
  console.log('  ✅ React 服务器已就绪\n');
  
  // 开始测试
  console.log('[步骤 1/4] 启动 Electron 进程...');
  const startTime = performance.now();
  
  const electronProcess = spawn('npm.cmd', ['run', 'electron'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  let processStartTime = 0;
  let appReadyTime = 0;
  let windowCreatedTime = 0;
  let contentLoadedTime = 0;
  
  let stepMarker = performance.now();
  
  // 监听 Electron 输出
  electronProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // 显示所有输出（调试用）
    if (output.trim()) {
      console.log('  [Electron] ' + output.trim());
    }
    
    // 检测各个阶段
    if (output.includes('Loading URL:')) {
      if (processStartTime === 0) {
        processStartTime = performance.now() - startTime;
        console.log(`\n  ✅ Electron 进程启动 (${processStartTime.toFixed(0)}ms)\n`);
        console.log('[步骤 2/4] 初始化应用...');
        stepMarker = performance.now();
      }
    }
    
    if (output.includes('ready-to-show') || output.includes('Main window created')) {
      if (windowCreatedTime === 0) {
        windowCreatedTime = performance.now() - startTime;
        console.log(`  ✅ 窗口创建完成 (${(performance.now() - stepMarker).toFixed(0)}ms)\n`);
        console.log('[步骤 3/4] 加载内容...');
        stepMarker = performance.now();
      }
    }
    
    if (output.includes('did-finish-load') || output.includes('Preload script loaded')) {
      if (contentLoadedTime === 0) {
        contentLoadedTime = performance.now() - startTime;
        console.log(`  ✅ 内容加载完成 (${(performance.now() - stepMarker).toFixed(0)}ms)\n`);
        console.log('[步骤 4/4] 应用就绪');
        
        setTimeout(() => {
          printResults(startTime);
          console.log('\n⏸️  Electron 仍在运行...');
          console.log('   按 Ctrl+C 关闭测试\n');
        }, 1000);
      }
    }
  });
  
  electronProcess.stderr.on('data', (data) => {
    const output = data.toString();
    // 过滤掉常见的非错误警告
    if (output.includes('error') || output.includes('Error')) {
      if (!output.includes('Electron Security Warning') && 
          !output.includes('DeprecationWarning')) {
        console.error('  ⚠️ ', output.trim());
      }
    }
  });
  
  function printResults(startTime) {
    const totalTime = performance.now() - startTime;
    
    console.log('\n========================================');
    console.log('  Electron 启动性能分析');
    console.log('========================================\n');
    
    console.log('⏱️  时间分解:');
    if (processStartTime > 0) {
      console.log(`  - 进程启动:        ${processStartTime.toFixed(0)}ms`);
    }
    if (windowCreatedTime > 0) {
      console.log(`  - 应用初始化:      ${(windowCreatedTime - processStartTime).toFixed(0)}ms`);
      console.log(`  - 窗口创建:        ${windowCreatedTime.toFixed(0)}ms`);
    }
    if (contentLoadedTime > 0) {
      console.log(`  - 内容加载:        ${(contentLoadedTime - windowCreatedTime).toFixed(0)}ms`);
    }
    console.log(`  ─────────────────────────────────────`);
    console.log(`  总启动时间:        ${(totalTime / 1000).toFixed(1)}s\n`);
    
    // 性能评估
    let rating = '';
    let color = '';
    
    if (totalTime < 2000) {
      rating = '优秀 ⚡';
      color = '✅';
    } else if (totalTime < 5000) {
      rating = '良好 👍';
      color = '✅';
    } else if (totalTime < 10000) {
      rating = '一般 ⚠️';
      color = '⚠️';
    } else {
      rating = '缓慢 🐌';
      color = '🔴';
    }
    
    console.log(`${color} Electron 性能评级: ${rating}`);
    console.log(`   启动时间 ${(totalTime / 1000).toFixed(1)}s`);
    
    // 瓶颈分析
    if (totalTime > 5000) {
      console.log('\n🔍 瓶颈分析:');
      
      const processTime = processStartTime;
      const initTime = windowCreatedTime - processStartTime;
      const loadTime = contentLoadedTime - windowCreatedTime;
      
      const phases = [
        { name: '进程启动', time: processTime },
        { name: '应用初始化', time: initTime },
        { name: '内容加载', time: loadTime }
      ].sort((a, b) => b.time - a.time);
      
      console.log(`  最慢阶段: ${phases[0].name} (${phases[0].time.toFixed(0)}ms)`);
      
      if (phases[0].time > 3000) {
        console.log('\n💡 优化建议:');
        
        if (phases[0].name === '进程启动') {
          console.log('  🔴 Electron 进程启动缓慢');
          console.log('     可能原因: 系统资源不足、杀毒软件拦截');
          console.log('     建议: 关闭不必要的后台程序');
        }
        
        if (phases[0].name === '应用初始化') {
          console.log('  🔴 应用初始化缓慢');
          console.log('     可能原因: main.js 加载模块过多、IPC 初始化慢');
          console.log('     建议: 延迟加载非关键模块');
        }
        
        if (phases[0].name === '内容加载') {
          console.log('  🔴 内容加载缓慢');
          console.log('     可能原因: React 首屏渲染慢、网络请求多');
          console.log('     建议: 优化首屏组件、懒加载非首屏组件');
        }
      }
    }
    
    console.log('\n========================================\n');
  }
  
  // 超时保护
  setTimeout(() => {
    if (contentLoadedTime === 0) {
      console.log('\n⚠️  测试超时（30秒），可能 Electron 启动失败');
      console.log('   查看上方错误信息\n');
      electronProcess.kill();
      process.exit(1);
    }
  }, 30000);
  
  // 清理
  process.on('SIGINT', () => {
    console.log('\n\n🛑 停止 Electron...');
    electronProcess.kill();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('\n❌ 测试失败:', err);
  process.exit(1);
});
