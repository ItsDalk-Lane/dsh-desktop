'use strict';

const { ipcMain, shell, app } = require('electron');

// 兜底页/启动画面的全部动作入口。主窗口(引擎 UI)不经过这里。
function registerIpc({ getManager, startFlow, importMockEngine, logsDir }) {
  ipcMain.handle('app:getStatus', () => Object.assign(getManager().status, { packaged: app.isPackaged }));
  ipcMain.handle('app:retry', () => startFlow());
  ipcMain.handle('app:useMockEngine', () => importMockEngine());
  ipcMain.handle('app:openLogs', () => shell.openPath(logsDir()));
  ipcMain.handle('app:quit', () => app.quit());
}

module.exports = { registerIpc };
