const { performance } = require('perf_hooks');
const fs = require('fs');
const path = require('path');

// 性能测量点
const perfMarks = {
  start: performance.now(),
  checkPort: 0,
  reactStart: 0,
  reactReady: 0,
  electronStart: 0,
  windowCreated: 0,
  contentLoaded: 0
};

console.log('\n========================================');
console.log('  Electron Startup Performance Test');
console.log('========================================\n');

// 1. 检查端口
console.log('[Step 1/5] Checking port 3000...');
perfMarks.checkPort = performance.now();
const net = require('net');

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once('error', () => resolve(true));
    server.once('listening', () => {
      server.close();
      resolve(false);
    });
    server.listen(port);
  });
}

async function main() {
  const portInUse = await isPortInUse(3000);
  const checkPortTime = performance.now() - perfMarks.checkPort;
  
  if (portInUse) {
    console.log(`  ⚠️  Port 3000 is in use (${checkPortTime.toFixed(0)}ms)`);
    console.log('  💡 Run "npm run electron-dev" in a separate terminal first\n');
    process.exit(1);
  } else {
    console.log(`  ✅ Port available (${checkPortTime.toFixed(0)}ms)\n`);
  }

  // 2. 等待 React 服务器
  console.log('[Step 2/5] Waiting for React dev server...');
  perfMarks.reactReady = performance.now();
  
  const http = require('http');
  let attempts = 0;
  const maxAttempts = 120; // 2分钟超时
  
  const waitForReact = () => {
    return new Promise((resolve, reject) => {
      const checkServer = () => {
        attempts++;
        http.get('http://localhost:3000', (res) => {
          if (res.statusCode === 200) {
            const reactReadyTime = performance.now() - perfMarks.reactReady;
            console.log(`  ✅ React server ready (${(reactReadyTime / 1000).toFixed(1)}s, ${attempts} attempts)\n`);
            resolve();
          } else {
            retryCheck();
          }
        }).on('error', retryCheck);
      };

      const retryCheck = () => {
        if (attempts >= maxAttempts) {
          reject(new Error('Timeout waiting for React server'));
        } else {
          process.stdout.write(`\r  ⏳ Waiting... ${attempts}s`);
          setTimeout(checkServer, 1000);
        }
      };

      checkServer();
    });
  };

  try {
    await waitForReact();
  } catch (error) {
    console.log(`\n  ❌ ${error.message}\n`);
    process.exit(1);
  }

  // 3. 启动 Electron
  console.log('[Step 3/5] Starting Electron...');
  perfMarks.electronStart = performance.now();
  
  const { app, BrowserWindow } = require('electron');

  app.whenReady().then(() => {
    const electronStartTime = performance.now() - perfMarks.electronStart;
    console.log(`  ✅ Electron ready (${electronStartTime.toFixed(0)}ms)\n`);

    console.log('[Step 4/5] Creating window...');
    perfMarks.windowCreated = performance.now();
    
    const mainWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        preload: path.join(__dirname, 'preload.js')
      }
    });

    const windowCreatedTime = performance.now() - perfMarks.windowCreated;
    console.log(`  ✅ Window created (${windowCreatedTime.toFixed(0)}ms)\n`);

    console.log('[Step 5/5] Loading content...');
    perfMarks.contentLoaded = performance.now();
    
    mainWindow.loadURL('http://localhost:3000');

    mainWindow.webContents.on('did-finish-load', () => {
      const contentLoadedTime = performance.now() - perfMarks.contentLoaded;
      console.log(`  ✅ Content loaded (${contentLoadedTime.toFixed(0)}ms)\n`);

      // 总结
      const totalTime = performance.now() - perfMarks.start;
      console.log('\n========================================');
      console.log('  Performance Summary');
      console.log('========================================\n');
      console.log(`  Check Port:       ${checkPortTime.toFixed(0)}ms`);
      console.log(`  Wait for React:   ${((performance.now() - perfMarks.reactReady) / 1000).toFixed(1)}s`);
      console.log(`  Electron Ready:   ${electronStartTime.toFixed(0)}ms`);
      console.log(`  Window Created:   ${windowCreatedTime.toFixed(0)}ms`);
      console.log(`  Content Loaded:   ${contentLoadedTime.toFixed(0)}ms`);
      console.log(`  ─────────────────────────────────────`);
      console.log(`  TOTAL TIME:       ${(totalTime / 1000).toFixed(1)}s\n`);

      // 性能评估
      if (totalTime < 60000) {
        console.log('  ✅ Performance: GOOD\n');
      } else if (totalTime < 90000) {
        console.log('  ⚠️  Performance: SLOW (expected 30-60s)\n');
      } else {
        console.log('  ❌ Performance: VERY SLOW (>90s)\n');
      }

      // 建议
      const reactTime = performance.now() - perfMarks.reactReady;
      if (reactTime > 60000) {
        console.log('  💡 Optimization tips:');
        console.log('     - React compilation is slow (>60s)');
        console.log('     - Try: set NODE_OPTIONS=--max-old-space-size=4096');
        console.log('     - Or add TSC_COMPILE_ON_ERROR=true to .env');
        console.log('     - Consider using SSD storage\n');
      }

      console.log('========================================\n');
    });
  });
}

main().catch(console.error);
