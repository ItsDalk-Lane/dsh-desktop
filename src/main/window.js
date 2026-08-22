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

function createSplashWindow() {
  const win = new BrowserWindow(
    Object.assign(baseOptions(), {
      width: 460,
      height: 340,
      frame: false,
      resizable: false,
      center: true,
      backgroundColor: '#0b0e14',
    })
  );
  win.loadFile(path.join(__dirname, '..', 'renderer', 'splash.html'));
  win.once('ready-to-show', () => win.show());
  return win;
}

function createMainWindow(url) {
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
  win.loadURL(url);
  win.once('ready-to-show', () => win.show());
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

module.exports = { createSplashWindow, createMainWindow, isAllowed };
