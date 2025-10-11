const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('path');

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
      preload: path.join(__dirname, 'preload.js')
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

  // 处理外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
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

console.log('🚀 Electron main process started');