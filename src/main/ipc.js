'use strict';

const { ipcMain, shell, app } = require('electron');

// 兜底页/启动画面的全部动作入口。主窗口(引擎 UI)不经过这里。
// 插件中心通道只接受闭集意图,实际命令行/URL 由主进程的 PluginCenter 决定。
function registerIpc({ getManager, startFlow, importMockEngine, logsDir, getPluginCenter }) {
  ipcMain.handle('app:getStatus', () => Object.assign(getManager().status, { packaged: app.isPackaged }));
  ipcMain.handle('app:retry', () => startFlow());
  ipcMain.handle('app:useMockEngine', () => importMockEngine());
  ipcMain.handle('app:openLogs', () => shell.openPath(logsDir()));
  ipcMain.handle('app:quit', () => app.quit());

  const pc = () => {
    const center = getPluginCenter && getPluginCenter();
    if (!center) throw new Error('插件中心不可用(引擎未启动)');
    return center;
  };
  ipcMain.handle('plugin:capability', () => {
    const center = getPluginCenter && getPluginCenter();
    return center ? center.capability() : null;
  });
  ipcMain.handle('plugin:search', (_e, q) => pc().search(q));
  ipcMain.handle('plugin:listInstalled', () => (getPluginCenter ? getPluginCenter()?.readProfileState() : { initialized: false, plugins: [] }));
  ipcMain.handle('plugin:install', (_e, name, version) => pc().install({ name, version }));
  ipcMain.handle('plugin:uninstall', (_e, name) => pc().uninstall({ name }));
  ipcMain.handle('plugin:setEnabled', (_e, name, enabled) => pc().setEnabled({ name, enabled }));
}

module.exports = { registerIpc };
