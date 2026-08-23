'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 渲染进程(失败兜底页)与主进程之间唯一的安全通道。
// 主窗口平时加载引擎 Web UI,不经过这里。
contextBridge.exposeInMainWorld('dshDesktop', {
  onStatus: (cb) => ipcRenderer.on('boot:status', (_e, status) => cb(status)),
  getStatus: () => ipcRenderer.invoke('app:getStatus'),
  retry: () => ipcRenderer.invoke('app:retry'),
  useMockEngine: () => ipcRenderer.invoke('app:useMockEngine'),
  openLogs: () => ipcRenderer.invoke('app:openLogs'),
  quit: () => ipcRenderer.invoke('app:quit'),
});
