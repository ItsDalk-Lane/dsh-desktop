'use strict';

const { app, dialog, shell } = require('electron');
const { autoUpdater } = require('electron-updater');

const RELEASES_PAGE = 'https://github.com/ItsDalk-Lane/dsh-desktop/releases';

// 壳自身的自动更新(M4)。
// 策略:启动后 5 秒检查一次,之后每 6 小时一次;发现新版本自动下载,
// 下载完弹窗询问"重启安装"。
// 未签名包的平台差异:
//   Windows NSIS:完整自动更新(quitAndInstall / 退出时静默装)
//   macOS 未签名:下载可用,但安装(Squirrel.Mac)要求有效签名,
//     失败时降级为打开发布页让用户手动装(需开发者证书后即可全自动)
// dev 模式(!isPackaged)整体停用,避免噪音。

function initAutoUpdater(logger) {
  if (!app.isPackaged) {
    logger.info('updater: dev 模式,自动更新停用');
    return { checkNow: async () => 'dev' };
  }

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true; // Windows:即使不重启,退出时也装上

  autoUpdater.on('checking-for-update', () => logger.info('updater: 检查更新…'));
  autoUpdater.on('update-available', (info) => logger.info(`updater: 发现新版本 ${info.version}`));
  autoUpdater.on('update-not-available', (info) => logger.info(`updater: 已是最新版本 (${info.version})`));
  autoUpdater.on('download-progress', (p) => {
    logger.info(`updater: 下载中 ${p.percent.toFixed(1)}%`);
  });
  autoUpdater.on('error', (e) => logger.warn(`updater: ${e.message}`));

  autoUpdater.on('update-downloaded', (info) => {
    logger.info(`updater: 新版本 ${info.version} 下载完成`);
    const choice = dialog.showMessageBoxSync({
      type: 'info',
      message: `DSH Desktop ${info.version} 已就绪`,
      detail: '重启后自动完成安装。',
      buttons: ['重启并安装', '稍后'],
      defaultId: 0,
    });
    if (choice === 0) installNow(logger);
  });

  const check = (reason) =>
    autoUpdater.checkForUpdates().catch((e) => logger.warn(`updater: ${reason} 检查失败: ${e.message}`));

  setTimeout(() => check('启动'), 5000);
  setInterval(() => check('定时'), 6 * 60 * 60 * 1000);

  return {
    checkNow: () => check('手动'),
    installNow: () => installNow(logger),
  };
}

function installNow(logger) {
  try {
    autoUpdater.quitAndInstall();
  } catch (e) {
    // macOS 未签名包走到这里的典型情形;降级为引导手动更新
    logger.warn(`updater: 自动安装失败(${e.message}),引导手动更新`);
    dialog.showMessageBoxSync({
      type: 'warning',
      message: '无法自动安装(未签名应用)',
      detail: '即将打开发布页,请下载最新安装包覆盖安装。',
    });
    shell.openExternal(RELEASES_PAGE);
  }
}

module.exports = { initAutoUpdater, RELEASES_PAGE };
