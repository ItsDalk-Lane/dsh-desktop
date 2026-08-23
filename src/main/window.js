'use strict';

const path = require('path');
const { BrowserWindow, shell } = require('electron');

function baseOptions() {
  return {
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  };
}

// 无过渡页:窗口创建后保持隐藏(baseOptions 的 show:false),
// 由调用方加载引擎 UI/失败页,页面首次绘制完成(ready-to-show)后才显示
function createMainWindow() {
  const win = new BrowserWindow(
    Object.assign(baseOptions(), {
      width: 1440,
      height: 900,
      minWidth: 980,
      minHeight: 640,
      backgroundColor: '#0b0e14',
      title: 'DSH Desktop',
    })
  );
  // 加固:主窗口只允许访问引擎的回环地址;外部链接一律丢给系统浏览器
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, target) => {
    if (!isAllowed(target)) {
      event.preventDefault();
      shell.openExternal(target);
    }
  });
  return win;
}

function isAllowed(url) {
  try {
    const { hostname } = new URL(url);
    return hostname === '127.0.0.1' || hostname === 'localhost';
  } catch (_) {
    return false;
  }
}

// 插件中心窗口:房子自己的管家 UI(与兜底页同类),不加载引擎页面。
// 同样加固:外部链接丢给系统浏览器,页面本身只是本地静态文件。
function createPluginWindow() {
  const win = new BrowserWindow(
    Object.assign(baseOptions(), {
      width: 940,
      height: 680,
      minWidth: 720,
      minHeight: 480,
      backgroundColor: '#0b0e14',
      title: '插件中心',
    })
  );
  win.setMenuBarVisibility(false);
  win.webContents.setWindowOpenHandler(({ url: target }) => {
    shell.openExternal(target);
    return { action: 'deny' };
  });
  win.loadFile(path.join(__dirname, '..', 'renderer', 'plugins.html'));
  return win;
}

module.exports = { createMainWindow, createPluginWindow, isAllowed };
