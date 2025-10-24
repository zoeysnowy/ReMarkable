/**
 * React 开发服务器启动性能测试
 * 测试 npm start (React) 的启动速度
 * 
 * 使用方法：
 * 1. 确保没有其他 npm start 在运行
 * 2. node test-react-startup.js
 */

const { performance } = require('perf_hooks');
const { spawn } = require('child_process');
const http = require('http');

console.log('\n========================================');
console.log('  React Dev Server 启动性能测试');
console.log('========================================\n');

const startTime = performance.now();
let npmProcess = null;

// 检测 React 服务器是否就绪
function checkReactServer(attempt = 1) {
  return new Promise((resolve) => {
    const req = http.get('http://localhost:3000', (res) => {
      resolve(true);
    });
    
    req.on('error', () => {
      if (attempt % 10 === 0) {
        const elapsed = ((performance.now() - startTime) / 1000).toFixed(1);
        process.stdout.write(`  ⏳ 等待中... ${elapsed}s (${attempt} 次尝试)\r`);
      }
      
      setTimeout(() => {
        resolve(checkReactServer(attempt + 1));
      }, 100);
    });
    
    req.setTimeout(100);
  });
}

async function main() {
  console.log('[步骤 1/3] 检查端口 3000...');
  
  // 检查端口是否被占用
  const portCheckStart = performance.now();
  const portAvailable = await new Promise((resolve) => {
    const testReq = http.get('http://localhost:3000', () => {
      resolve(false); // 端口已被占用
    });
    
    testReq.on('error', () => {
      resolve(true); // 端口可用
    });
    
    testReq.setTimeout(1000);
  });
  
  const portCheckTime = performance.now() - portCheckStart;
  
  if (!portAvailable) {
    console.log(`  ✅ React 服务器已在运行 (${portCheckTime.toFixed(0)}ms)`);
    console.log('\n⚠️  请先关闭已有的 React 服务器，然后重新运行测试');
    console.log('   关闭方法: 在运行 npm start 的终端按 Ctrl+C');
    process.exit(0);
  }
  
  console.log(`  ✅ 端口可用 (${portCheckTime.toFixed(0)}ms)\n`);
  
  // 启动 React 开发服务器
  console.log('[步骤 2/3] 启动 React 开发服务器...');
  console.log('  命令: npm start');
  
  const npmStartTime = performance.now();
  
  npmProcess = spawn('npm.cmd', ['start'], {
    cwd: process.cwd().replace('\\electron', ''),
    stdio: ['ignore', 'pipe', 'pipe'],
    shell: true
  });
  
  let compilationStarted = false;
  let compilationTime = 0;
  let compilationStartMark = 0;
  
  // 监听输出
  npmProcess.stdout.on('data', (data) => {
    const output = data.toString();
    
    // 检测编译开始
    if (output.includes('Compiling...') && !compilationStarted) {
      compilationStarted = true;
      compilationStartMark = performance.now();
      console.log('  📦 开始编译...');
    }
    
    // 检测编译完成
    if (output.includes('Compiled successfully!')) {
      compilationTime = performance.now() - compilationStartMark;
      console.log(`  ✅ 编译成功 (${(compilationTime / 1000).toFixed(1)}s)`);
    }
    
    // 检测 webpack 启动
    if (output.includes('webpack compiled')) {
      console.log('  📦 Webpack 编译完成');
    }
  });
  
  npmProcess.stderr.on('data', (data) => {
    const output = data.toString();
    // 只显示重要错误
    if (output.includes('error') || output.includes('Error')) {
      console.error('  ❌ 错误:', output.trim());
    }
  });
  
  // 等待服务器就绪
  console.log('[步骤 3/3] 等待服务器就绪...');
  await checkReactServer();
  
  const totalTime = performance.now() - startTime;
  const serverReadyTime = performance.now() - npmStartTime;
  
  console.log('\n========================================');
  console.log('  性能测试结果');
  console.log('========================================\n');
  
  console.log('⏱️  时间分解:');
  console.log(`  - 端口检查:        ${portCheckTime.toFixed(0)}ms`);
  console.log(`  - npm 进程启动:    ${(serverReadyTime - compilationTime).toFixed(0)}ms`);
  if (compilationTime > 0) {
    console.log(`  - React 编译:      ${(compilationTime / 1000).toFixed(1)}s`);
  }
  console.log(`  - 服务器就绪:      ${(serverReadyTime / 1000).toFixed(1)}s`);
  console.log(`  ─────────────────────────────────────`);
  console.log(`  总启动时间:        ${(totalTime / 1000).toFixed(1)}s\n`);
  
  // 性能评估
  let rating = '';
  let color = '';
  
  if (totalTime < 10000) {
    rating = '优秀 ⚡';
    color = '✅';
  } else if (totalTime < 30000) {
    rating = '良好 👍';
    color = '✅';
  } else if (totalTime < 60000) {
    rating = '一般 ⚠️';
    color = '⚠️';
  } else {
    rating = '缓慢 🐌';
    color = '🔴';
  }
  
  console.log(`${color} 性能评级: ${rating}`);
  console.log(`   总时间 ${(totalTime / 1000).toFixed(1)}s`);
  
  // 优化建议
  if (totalTime > 30000) {
    console.log('\n💡 优化建议:');
    
    if (compilationTime > 20000) {
      console.log('  🔴 React 编译过慢 (> 20s)');
      console.log('     建议 1: 增加 Node.js 内存');
      console.log('            set NODE_OPTIONS=--max-old-space-size=4096');
      console.log('     建议 2: 跳过 TypeScript 类型检查（开发时）');
      console.log('            在 .env 添加: TSC_COMPILE_ON_ERROR=true');
      console.log('     建议 3: 禁用 source maps（开发时）');
      console.log('            在 .env 添加: GENERATE_SOURCEMAP=false');
    }
    
    if (totalTime > 90000) {
      console.log('  🔴 启动时间过长 (> 90s)');
      console.log('     建议: 检查是否 HDD 磁盘，考虑升级到 SSD');
      console.log('     建议: 排除项目文件夹被杀毒软件扫描');
    }
  }
  
  console.log('\n========================================\n');
  
  // 清理
  console.log('⏸️  React 服务器仍在运行...');
  console.log('   按 Ctrl+C 停止测试并关闭服务器\n');
  
  // 保持进程运行
  process.on('SIGINT', () => {
    console.log('\n\n🛑 停止 React 服务器...');
    npmProcess.kill();
    process.exit(0);
  });
}

main().catch(err => {
  console.error('\n❌ 测试失败:', err);
  if (npmProcess) {
    npmProcess.kill();
  }
  process.exit(1);
});
