const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');
const http = require('http');
const url = require('url');

// 简化环境检测
const isDev = process.env.NODE_ENV === 'development' || process.defaultApp || /[\\/]electron-prebuilt[\\/]/.test(process.execPath) || /[\\/]electron[\\/]/.test(process.execPath);

let mainWindow;

// 创建主窗口
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1000,
    minHeight: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: false, // 临时禁用，用于调试
      allowRunningInsecureContent: false,
      experimentalFeatures: false,
      // 支持Microsoft认证所需的功能
      partition: 'persist:main',
      // 添加调试选项
      devTools: true
    },
    icon: path.join(__dirname, 'assets', 'icon.png'),
    titleBarStyle: 'default',
    show: false, // 先隐藏，加载完成后显示
    autoHideMenuBar: !isDev // 生产环境隐藏菜单栏
  });

  // 加载应用
  const startUrl = isDev 
    ? 'http://localhost:3000' 
    : `file://${path.join(__dirname, '../build/index.html')}`;
  
  console.log('Loading URL:', startUrl);
  mainWindow.loadURL(startUrl);

  // 窗口准备好后显示
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    if (isDev) {
      mainWindow.webContents.openDevTools();
    }
  });

  // 处理窗口关闭
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // 处理外部链接 - 为Microsoft认证优化
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // Microsoft OAuth认证相关链接在应用内打开
    if (url.includes('login.microsoftonline.com') || 
        url.includes('login.live.com') || 
        url.includes('account.live.com') ||
        url.includes('oauth.live.com') ||
        url.includes('graph.microsoft.com')) {
      return { action: 'allow' };
    }
    
    // 其他外部链接用系统浏览器打开
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // 处理导航事件 - 允许Microsoft认证
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);
    
    // 允许localhost和Microsoft认证域名
    if (parsedUrl.hostname === 'localhost' || 
        parsedUrl.hostname.includes('microsoftonline.com') ||
        parsedUrl.hostname.includes('live.com') ||
        parsedUrl.hostname.includes('microsoft.com')) {
      return; // 允许导航
    }
    
    // 阻止其他外部导航
    event.preventDefault();
    shell.openExternal(navigationUrl);
  });

  // 设置菜单
  createMenu();
}

// 创建应用菜单
function createMenu() {
  const template = [
    {
      label: 'ReMarkable',
      submenu: [
        {
          label: '关于 ReMarkable',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: '关于 ReMarkable',
              message: 'ReMarkable Desktop',
              detail: '智能日历和任务管理应用\n版本: 1.0.0'
            });
          }
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { label: '撤销', accelerator: 'CmdOrCtrl+Z', role: 'undo' },
        { label: '重做', accelerator: 'Shift+CmdOrCtrl+Z', role: 'redo' },
        { type: 'separator' },
        { label: '剪切', accelerator: 'CmdOrCtrl+X', role: 'cut' },
        { label: '复制', accelerator: 'CmdOrCtrl+C', role: 'copy' },
        { label: '粘贴', accelerator: 'CmdOrCtrl+V', role: 'paste' }
      ]
    },
    {
      label: '视图',
      submenu: [
        { label: '重新加载', accelerator: 'CmdOrCtrl+R', role: 'reload' },
        { label: '强制重新加载', accelerator: 'CmdOrCtrl+Shift+R', role: 'forceReload' },
        { label: '开发者工具', accelerator: 'F12', role: 'toggleDevTools' },
        { type: 'separator' },
        { label: '实际大小', accelerator: 'CmdOrCtrl+0', role: 'resetZoom' },
        { label: '放大', accelerator: 'CmdOrCtrl+Plus', role: 'zoomIn' },
        { label: '缩小', accelerator: 'CmdOrCtrl+-', role: 'zoomOut' },
        { type: 'separator' },
        { label: '全屏', accelerator: 'F11', role: 'togglefullscreen' }
      ]
    },
    {
      label: '同步',
      submenu: [
        {
          label: '立即同步',
          accelerator: 'CmdOrCtrl+S',
          click: () => {
            mainWindow.webContents.send('trigger-sync');
          }
        },
        {
          label: '同步设置',
          click: () => {
            mainWindow.webContents.send('open-sync-settings');
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// Electron应用事件
app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// IPC事件处理
ipcMain.handle('app-version', () => {
  return app.getVersion();
});

ipcMain.handle('app-platform', () => {
  return {
    platform: process.platform,
    arch: process.arch,
    version: process.versions
  };
});

ipcMain.handle('show-message-box', async (event, options) => {
  const result = await dialog.showMessageBox(mainWindow, options);
  return result;
});

ipcMain.handle('show-notification', (event, title, body, options = {}) => {
  const { Notification } = require('electron');
  const notification = new Notification({
    title,
    body,
    ...options
  });
  notification.show();
  return true;
});

// 文件操作
ipcMain.handle('dialog:openFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    return result.filePaths[0];
  }
  return null;
});

ipcMain.handle('dialog:saveFile', async (event, content, defaultName = 'export.json') => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
    filters: [
      { name: 'JSON Files', extensions: ['json'] },
      { name: 'Text Files', extensions: ['txt'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled) {
    const fs = require('fs').promises;
    try {
      await fs.writeFile(result.filePath, content, 'utf8');
      return { success: true, path: result.filePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
  return { success: false, canceled: true };
});

// 系统监听相关IPC事件
ipcMain.handle('start-system-monitoring', () => {
  console.log('🔍 Starting system monitoring...');
  
  // TODO: 实现Windows程序监听
  // 这里可以集成第三方库如 active-win 来监听活动窗口
  
  return { success: true, message: 'System monitoring started' };
});

ipcMain.handle('get-active-window', async () => {
  try {
    // TODO: 实现获取当前活动窗口
    // 可以使用 active-win 包
    return { 
      title: 'Example Window', 
      process: 'example.exe',
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Failed to get active window:', error);
    return null;
  }
});

// 应用数据存储路径
ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

ipcMain.handle('get-app-info', () => {
  return {
    name: app.getName(),
    version: app.getVersion(),
    userDataPath: app.getPath('userData'),
    appPath: app.getAppPath()
  };
});

// Microsoft认证相关IPC处理器
ipcMain.handle('open-external-auth', async (event, url) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (error) {
    console.error('Failed to open external auth URL:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('handle-auth-callback', async (event, url) => {
  try {
    // 处理认证回调
    console.log('Auth callback received:', url);
    return { success: true, url };
  } catch (error) {
    console.error('Failed to handle auth callback:', error);
    return { success: false, error: error.message };
  }
});

// 启动本地认证服务器
let authServer = null;
// 简单的内存Token存储，用于在多个窗口之间共享认证状态
let authTokens = null; // { accessToken, refreshToken, expiresAt }
ipcMain.handle('start-auth-server', async (event, redirectUri) => {
  return new Promise((resolve, reject) => {
    try {
      const urlObj = new URL(redirectUri);
      const port = urlObj.port || 3000;
      
      // 如果服务器已经在运行，先关闭
      if (authServer) {
        authServer.close();
      }
      
      authServer = http.createServer((req, res) => {
        const reqUrl = url.parse(req.url, true);
        
        if (reqUrl.pathname === '/auth/callback') {
          const authCode = reqUrl.query.code;
          const error = reqUrl.query.error;
          
          // 返回简单的HTML页面
          res.writeHead(200, { 'Content-Type': 'text/html' });
          
          if (authCode) {
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2>✅ 认证成功!</h2>
                  <p>您可以关闭此窗口，返回应用继续使用。</p>
                  <script>
                    setTimeout(() => {
                      window.close();
                    }, 3000);
                  </script>
                </body>
              </html>
            `);
            
            // 关闭服务器
            authServer.close();
            authServer = null;
            
            // 返回授权码
            resolve(authCode);
          } else if (error) {
            res.end(`
              <html>
                <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
                  <h2>❌ 认证失败</h2>
                  <p>错误: ${error}</p>
                  <p>请关闭此窗口并重试。</p>
                </body>
              </html>
            `);
            
            authServer.close();
            authServer = null;
            
            reject(new Error(`认证失败: ${error}`));
          }
        } else {
          res.writeHead(404);
          res.end('Not Found');
        }
      });
      
      authServer.listen(port, 'localhost', () => {
        console.log(`🔐 认证服务器启动在端口 ${port}`);
      });
      
      authServer.on('error', (error) => {
        console.error('认证服务器错误:', error);
        reject(error);
      });
      
      // 超时处理
      setTimeout(() => {
        if (authServer) {
          authServer.close();
          authServer = null;
          reject(new Error('认证超时'));
        }
      }, 5 * 60 * 1000); // 5分钟超时
      
    } catch (error) {
      console.error('启动认证服务器失败:', error);
      reject(error);
    }
  });
});

// 允许渲染进程将认证令牌写入主进程（用于跨窗口共享）
ipcMain.handle('set-auth-tokens', (event, tokens) => {
  try {
    authTokens = tokens || null;
    console.log('🔐 主进程已保存认证令牌');
    return { success: true };
  } catch (error) {
    console.error('Failed to set auth tokens in main process:', error);
    return { success: false, error: error.message };
  }
});

// 渲染进程可读取主进程中保存的令牌
ipcMain.handle('get-auth-tokens', () => {
  return authTokens;
});

// 调试日志处理器
ipcMain.handle('debug-log', (event, message, data) => {
  console.log('🔧 [Renderer Debug]', message, data);
  return true;
});

// 桌面小组件控制处理器
let widgetWindow = null;

ipcMain.handle('toggle-widget', async () => {
  console.log('🪟 Toggle widget requested');
  
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    // 如果窗口存在，关闭它
    widgetWindow.close();
    widgetWindow = null;
    return { action: 'closed' };
  } else {
    // 创建新的小组件窗口
    return createWidgetWindow();
  }
});

ipcMain.handle('create-widget', () => {
  return createWidgetWindow();
});

ipcMain.handle('widget-close', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.close();
    widgetWindow = null;
  }
  return { success: true };
});

// 关闭当前窗口（用于widget内部关闭按钮）
ipcMain.handle('close-window', (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (window && !window.isDestroyed()) {
    window.close();
  }
  return { success: true };
});

ipcMain.handle('widget-minimize', () => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.minimize();
  }
  return { success: true };
});

ipcMain.handle('widget-lock', (event, isLocked) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    // 🔒 "锁定"含义重新定义：
    // - 锁定 = 窗口置顶，始终可见（但其他窗口可以在下方操作）
    // - 解锁 = 窗口不置顶，可以被其他窗口覆盖
    // - 无论锁定与否，窗口始终可以移动和调整大小
    
    widgetWindow.setAlwaysOnTop(isLocked, 'screen-saver');
    
    // 确保窗口始终可以移动（修复之前版本可能设置的限制）
    widgetWindow.setMovable(true);
    
    if (isLocked) {
      console.log('✅ Widget locked: Always on top (screen-saver level), movable and resizable');
    } else {
      console.log('✅ Widget unlocked: Normal window level, movable and resizable');
    }
  }
  return { success: true, locked: isLocked };
});

ipcMain.handle('widget-opacity', (event, opacity) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setOpacity(opacity);
  }
  return { success: true, opacity };
});

// 防抖动：记录目标尺寸
let targetSize = null;

// Resize 状态控制
let isResizing = false;

// 性能追踪
let movePerf = { count: 0, totalTime: 0, maxTime: 0, minTime: Infinity };

ipcMain.handle('widget-move', (event, position) => {
  const startTime = Date.now();
  console.log('📨 [Main] 收到 widget-move IPC:', position);
  
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    try {
      // 获取当前位置和尺寸
      const currentBounds = widgetWindow.getBounds();
      console.log('📍 [Main] 当前位置:', { x: currentBounds.x, y: currentBounds.y, w: currentBounds.width, h: currentBounds.height });
      
      // 🔧 关键修复：拖动时只改变位置，不锁定尺寸
      // 只移动窗口，保持当前尺寸不变
      const newBounds = {
        x: currentBounds.x + position.x,
        y: currentBounds.y + position.y,
        width: currentBounds.width,   // 保持当前宽度
        height: currentBounds.height  // 保持当前高度
      };
      
      console.log('🎯 [Main] 目标位置:', { 
        x: newBounds.x, 
        y: newBounds.y, 
        deltaX: position.x,
        deltaY: position.y
      });
      
      const setBoundsStart = Date.now();
      // 使用 setBounds 一次性设置，禁用动画
      widgetWindow.setBounds(newBounds, false);
      const setBoundsEnd = Date.now();
      
      const resultBounds = widgetWindow.getBounds();
      const actualDelta = {
        x: resultBounds.x - currentBounds.x,
        y: resultBounds.y - currentBounds.y
      };
      
      const endTime = Date.now();
      const totalDuration = endTime - startTime;
      const setBoundsDuration = setBoundsEnd - setBoundsStart;
      
      // 更新性能统计
      movePerf.count++;
      movePerf.totalTime += totalDuration;
      movePerf.maxTime = Math.max(movePerf.maxTime, totalDuration);
      movePerf.minTime = Math.min(movePerf.minTime, totalDuration);
      
      console.log('✅ [Main] 实际移动:', { 
        position: { x: resultBounds.x, y: resultBounds.y },
        size: { w: resultBounds.width, h: resultBounds.height },
        requestedDelta: position,
        actualDelta: actualDelta,
        deltaMatch: actualDelta.x === position.x && actualDelta.y === position.y
      });
      
      console.log('⏱️ [Main] 性能:', {
        total: `${totalDuration}ms`,
        setBounds: `${setBoundsDuration}ms`,
        overhead: `${totalDuration - setBoundsDuration}ms`,
        avg: `${(movePerf.totalTime / movePerf.count).toFixed(2)}ms`,
        min: `${movePerf.minTime}ms`,
        max: `${movePerf.maxTime}ms`,
        count: movePerf.count
      });
      
      // 🔑 关键：返回实际移动距离，让渲染进程调整
      return { 
        success: true, 
        position: { x: resultBounds.x, y: resultBounds.y },
        actualDelta: actualDelta  // 📍 新增：返回实际移动距离
      };
    } catch (error) {
      console.error('❌ [Main] Failed to move widget:', error);
      return { success: false, error: error.message };
    }
  }
  console.error('❌ [Main] Window not available');
  return { success: false, error: 'Window not available' };
});

// 拖动结束时重置目标尺寸
ipcMain.handle('widget-drag-end', () => {
  console.log('🏁 [Main] 拖动结束');
  
  // 打印性能总结
  if (movePerf.count > 0) {
    console.log('📊 [Main] 拖动性能总结:', {
      totalMoves: movePerf.count,
      avgTime: `${(movePerf.totalTime / movePerf.count).toFixed(2)}ms`,
      minTime: `${movePerf.minTime}ms`,
      maxTime: `${movePerf.maxTime}ms`,
      totalTime: `${movePerf.totalTime}ms`
    });
  }
  
  // 重置
  targetSize = null;
  movePerf = { count: 0, totalTime: 0, maxTime: 0, minTime: Infinity };
  
  return { success: true };
});

ipcMain.handle('widget-resize', (event, size) => {
  console.log('🔍 [Main] widget-resize IPC 被调用:', size, new Error().stack);
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    const sizeBefore = widgetWindow.getSize();
    console.log(`📐 [Main] Resize 前: ${sizeBefore[0]}x${sizeBefore[1]}`);
    
    widgetWindow.setSize(size.width, size.height);
    
    const sizeAfter = widgetWindow.getSize();
    console.log(`📐 [Main] Resize 后: ${sizeAfter[0]}x${sizeAfter[1]}`);
  }
  return { success: true, size };
});

ipcMain.handle('widget-fullscreen', (event, isFullscreen) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    if (isFullscreen) {
      widgetWindow.setFullScreen(true);
    } else {
      widgetWindow.setFullScreen(false);
    }
  }
  return { success: true, isFullscreen };
});

// 创建小组件窗口的函数
function createWidgetWindow() {
  try {
    widgetWindow = new BrowserWindow({
      width: 700, // 增加宽度 400 -> 700
      height: 525, // 按比例增加高度 (700/400 * 300 = 525)
      frame: false, // 无边框
      movable: true, // 明确设置为可移动
      alwaysOnTop: false, // 🔧 不置顶，允许其他窗口覆盖
      transparent: true, // 透明背景
      backgroundColor: '#00000000', // 完全透明的背景
      resizable: true,
      hasShadow: false, // 🔧 透明窗口禁用阴影
      skipTaskbar: false, // 在任务栏显示
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js'),
        webSecurity: false,
        partition: 'persist:main' // 使用与主窗口相同的分区以共享存储
      }
    });

    // 加载小组件页面 - 使用 v3 版本（完全复刻测试页）
    const widgetUrl = isDev 
      ? 'http://localhost:3000/#/widget-v3' 
      : `file://${path.join(__dirname, '../build/index.html#/widget-v3')}`;
    
    console.log('Loading widget URL (v3):', widgetUrl);
    widgetWindow.loadURL(widgetUrl);

    // 确保窗口可移动和可调整大小（覆盖任何之前的设置）
    widgetWindow.setMovable(true);
    widgetWindow.setResizable(true);
    console.log('✅ Widget window is movable and resizable');
    
    // 🔍 诊断日志：检查窗口属性
    console.log('📊 [Main] Widget window properties:', {
      isMovable: widgetWindow.isMovable(),
      isResizable: widgetWindow.isResizable(),
      isAlwaysOnTop: widgetWindow.isAlwaysOnTop(),
      hasShadow: widgetWindow.hasShadow(),
      size: widgetWindow.getSize(),
      position: widgetWindow.getPosition()
    });

    // Resize 节流控制
    let resizeTimeout = null;

    // 监听窗口事件（用于调试原生拖动）
    widgetWindow.on('resize', () => {
      const size = widgetWindow.getSize();
      console.log('🔄 [Main] Window resize event:', `${size[0]}x${size[1]}`);
      
      // 标记正在调整大小
      isResizing = true;
      
      // 清除之前的超时
      if (resizeTimeout) clearTimeout(resizeTimeout);
      
      // 100ms 后认为 resize 结束，更新 targetSize
      resizeTimeout = setTimeout(() => {
        isResizing = false;
        const bounds = widgetWindow.getBounds();
        targetSize = { width: bounds.width, height: bounds.height };
        console.log('✅ [Main] Resize 完成，更新 targetSize:', targetSize);
      }, 100);
    });

    widgetWindow.on('move', () => {
      const pos = widgetWindow.getPosition();
      console.log('🚚 [Main] Window move event:', `(${pos[0]}, ${pos[1]})`);
    });

    widgetWindow.on('moved', () => {
      const pos = widgetWindow.getPosition();
      console.log('✅ [Main] Window moved (完成):', `(${pos[0]}, ${pos[1]})`);
    });

    widgetWindow.on('will-move', () => {
      console.log('🏃 [Main] Window will-move (即将移动)');
    });

    // 开发环境下打开开发工具
    if (isDev) {
      widgetWindow.webContents.openDevTools({ mode: 'detach' });
    }

    // 窗口关闭时清理引用
    widgetWindow.on('closed', () => {
      widgetWindow = null;
    });

    console.log('🪟 Widget window created successfully');
    return { action: 'created', success: true };
    
  } catch (error) {
    console.error('Failed to create widget window:', error);
    return { success: false, error: error.message };
  }
}

// 新版小组件API处理器
ipcMain.handle('widget-toggle', async (event, type, enabled) => {
  console.log(`Widget toggle: ${type} -> ${enabled}`);
  // 这里可以根据type创建不同类型的小组件
  if (enabled) {
    return createWidgetWindow();
  } else {
    if (widgetWindow && !widgetWindow.isDestroyed()) {
      widgetWindow.close();
      widgetWindow = null;
    }
    return { success: true, action: 'closed' };
  }
});

ipcMain.handle('widget-update-config', (event, type, config) => {
  console.log(`Widget update config: ${type}`, config);
  return { success: true, type, config };
});

ipcMain.handle('widget-set-opacity', (event, type, opacity) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setOpacity(opacity);
  }
  return { success: true, type, opacity };
});

ipcMain.handle('widget-set-always-on-top', (event, type, alwaysOnTop) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.setAlwaysOnTop(alwaysOnTop);
  }
  return { success: true, type, alwaysOnTop };
});

ipcMain.handle('widget-close-typed', (event, type) => {
  if (widgetWindow && !widgetWindow.isDestroyed()) {
    widgetWindow.close();
    widgetWindow = null;
  }
  return { success: true, type };
});

ipcMain.handle('widget-get-config', async (event, type) => {
  // 返回默认配置或从存储中获取
  return {
    enabled: false,
    opacity: 0.9,
    alwaysOnTop: true,
    position: { x: 100, y: 100 },
    size: { width: 400, height: 300 }
  };
});

ipcMain.handle('widget-save-position', (event, type, x, y) => {
  console.log(`Save position for ${type}: (${x}, ${y})`);
  return { success: true, type, position: { x, y } };
});

ipcMain.handle('widget-save-size', (event, type, width, height) => {
  console.log(`Save size for ${type}: ${width}x${height}`);
  return { success: true, type, size: { width, height } };
});

// 开机自启动设置
ipcMain.handle('set-login-item-settings', async (event, settings) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: settings.openAtLogin,
      path: settings.path || process.execPath
    });
    console.log('Login item settings updated:', settings);
    return { success: true };
  } catch (error) {
    console.error('Failed to set login item settings:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('get-login-item-settings', async () => {
  try {
    const settings = app.getLoginItemSettings();
    console.log('Login item settings:', settings);
    return settings;
  } catch (error) {
    console.error('Failed to get login item settings:', error);
    return {
      openAtLogin: false,
      openAsHidden: false,
      wasOpenedAtLogin: false,
      wasOpenedAsHidden: false,
      restoreState: false
    };
  }
});

console.log('🚀 Electron main process started');