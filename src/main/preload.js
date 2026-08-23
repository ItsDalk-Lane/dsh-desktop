'use strict';

const { contextBridge, ipcRenderer } = require('electron');

// 渲染进程(失败兜底页/插件中心)与主进程之间唯一的安全通道。
// 主窗口平时加载引擎 Web UI,不经过这里。
// 插件中心的通道只接受闭集意图(包名+精确版本/布尔),URL 与命令行一律由主进程决定。
contextBridge.exposeInMainWorld('dshDesktop', {
  onStatus: (cb) => ipcRenderer.on('boot:status', (_e, status) => cb(status)),
  getStatus: () => ipcRenderer.invoke('app:getStatus'),
  retry: () => ipcRenderer.invoke('app:retry'),
  useMockEngine: () => ipcRenderer.invoke('app:useMockEngine'),
  openLogs: () => ipcRenderer.invoke('app:openLogs'),
  quit: () => ipcRenderer.invoke('app:quit'),
  pluginCapability: () => ipcRenderer.invoke('plugin:capability'),
  pluginSearch: (q) => ipcRenderer.invoke('plugin:search', q),
  pluginListInstalled: () => ipcRenderer.invoke('plugin:listInstalled'),
  pluginInstall: (name, version) => ipcRenderer.invoke('plugin:install', name, version),
  pluginUninstall: (name) => ipcRenderer.invoke('plugin:uninstall', name),
  pluginSetEnabled: (name, enabled) => ipcRenderer.invoke('plugin:setEnabled', name, enabled),
  onPluginEvent: (cb) => ipcRenderer.on('plugin:event', (_e, ev) => cb(ev)),
});
