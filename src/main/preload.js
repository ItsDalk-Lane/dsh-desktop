'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 渲染进程(启动画面/失败页)与主进程之间唯一的安全通道。
// 主窗口加载的是引擎 Web UI,不加载 preload,天然无 Node 权限。
contextBridge.exposeInMainWorld('dshDesktop', {
  onStatus: (cb) => ipcRenderer.on('boot:status', (_e, status) => cb(status)),
  getStatus: () => ipcRenderer.invoke('app:getStatus'),
  retry: () => ipcRenderer.invoke('app:retry'),
  useMockEngine: () => ipcRenderer.invoke('app:useMockEngine'),
  openLogs: () => ipcRenderer.invoke('app:openLogs'),
  quit: () => ipcRenderer.invoke('app:quit'),
});
