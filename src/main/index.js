'use strict';

const { app, dialog, Menu, shell } = require('electron');
const path = require('path');
const paths = require('./paths');
const config = require('./config');
const { createLogger } = require('./logger');
const registry = require('./engine/registry');
const installer = require('./engine/installer');
const { EngineManager } = require('./engine/manager');
const { createSplashWindow, createMainWindow } = require('./window');
const { registerIpc } = require('./ipc');
const { initAutoUpdater, RELEASES_PAGE } = require('./updater');

// 锁定 userData 路径,保证 dev / 打包后引擎和数据都落在同一个地方
app.setName('dsh-desktop');

const SMOKE = !!process.env.DSH_DESKTOP_SMOKE;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  boot().catch((e) => {
    console.error('fatal:', e);
    app.exit(1);
  });
}

async function boot() {
  app.on('second-instance', () => {
    // 已有实例在跑:聚焦既有窗口即可
  });

  await app.whenReady();
  paths.init(app.getPath('userData'));
  config.init(app.getPath('userData'));
  const houseLog = createLogger(paths.houseLogFile());
  const engineLog = createLogger(paths.engineLogFile());
  houseLog.info(`house starting — version ${app.getVersion()} smoke=${SMOKE}`);
  const updater = initAutoUpdater(houseLog);

  const manager = new EngineManager({ paths, registry, logger: houseLog, engineLogger: engineLog });
  let splash = null;
  let main = null;

  const sendStatus = () => {
    const s = manager.status;
    for (const w of [splash, main]) {
      if (w && !w.isDestroyed()) w.webContents.send('boot:status', s);
    }
  };
  manager.on('status', sendStatus);

  // 引擎解析优先级:
  // 1. 环境变量 DSH_DESKTOP_ENGINE(开发调试用,指向任意引擎目录)
  // 2. userData/engines/current.json 指向的已安装引擎
  // 3. dev 模式兜底:仓库自带的 mock 引擎(开箱即跑)
  async function resolveEngineDir() {
    if (process.env.DSH_DESKTOP_ENGINE) return process.env.DSH_DESKTOP_ENGINE;
    const current = registry.getCurrent(paths.currentEngineFile(), paths.enginesRoot());
    if (current) return current;
    if (!app.isPackaged) return path.join(paths.devEnginesDir(), 'mock-dsh');
    return null;
  }

  async function importMockEngine() {
    const manifest = await installer.importFromDirectory({
      fromDir: path.join(paths.devEnginesDir(), 'mock-dsh'),
      enginesRoot: paths.enginesRoot(),
      currentEngineFile: paths.currentEngineFile(),
      setCurrent: registry.setCurrent,
      force: true,
    });
    houseLog.info(`imported engine ${manifest.id}@${manifest.version}`);
    buildMenu();
    return manifest;
  }

  // 发布源优先级:环境变量 DSH_DESKTOP_RELEASE_INDEX > userData/config.json 的 releaseIndexUrl
  function releaseIndexUrl() {
    return process.env.DSH_DESKTOP_RELEASE_INDEX || config.get('releaseIndexUrl') || null;
  }

  async function checkEngineUpdate() {
    const indexUrl = releaseIndexUrl();
    if (!indexUrl) {
      dialog.showMessageBoxSync({
        type: 'warning',
        message: '未配置发布源',
        detail: '在 userData/config.json 里设置 releaseIndexUrl,\n或设置环境变量 DSH_DESKTOP_RELEASE_INDEX。',
      });
      return;
    }
    try {
      const m = await installer.installFromRelease({
        indexUrl,
        enginesRoot: paths.enginesRoot(),
        currentEngineFile: paths.currentEngineFile(),
        setCurrent: registry.setCurrent,
        logger: houseLog,
      });
      dialog.showMessageBoxSync({
        type: 'info',
        message: `已安装 ${m.name} @ ${m.version}`,
        detail: '即将重启引擎。',
      });
      buildMenu();
      await startFlow();
      buildMenu();
    } catch (e) {
      houseLog.error(`engine install from release failed: ${e.message}`);
      dialog.showMessageBoxSync({ type: 'error', message: '引擎安装失败', detail: e.message });
    }
  }

  async function rollbackEngine() {
    const prev = registry.getPrevious(paths.currentEngineFile());
    if (!prev) {
      dialog.showMessageBoxSync({ type: 'info', message: '没有可回滚的上一版本' });
      return;
    }
    registry.setCurrent(paths.currentEngineFile(), prev.dir, prev.id);
    houseLog.info(`rolled back to ${prev.id} at ${prev.dir}`);
    buildMenu();
    dialog.showMessageBoxSync({ type: 'info', message: `已回滚到 ${prev.id}`, detail: '即将重启引擎。' });
    await startFlow();
    buildMenu();
  }

  // M4:切换住客 —— 指到哪个引擎并重启;数据目录不变,Key/会话无缝延续
  async function switchEngine(entry) {
    const current = registry.getCurrent(paths.currentEngineFile(), paths.enginesRoot());
    if (current && current === entry.dir) return; // 已在运行,无事可做
    registry.setCurrent(paths.currentEngineFile(), entry.dir, entry.id);
    houseLog.info(`switch engine -> ${entry.id}@${entry.version}`);
    buildMenu();
    await startFlow();
    buildMenu();
  }

  // 菜单随引擎列表动态重建(安装/切换/回滚后都会重新调用)
  function buildMenu() {
    const installed = registry.listInstalled(paths.enginesRoot());
    const currentDir = registry.getCurrent(paths.currentEngineFile(), paths.enginesRoot());
    const engineItems = installed.map((e) => ({
      label: `${e.name}  ${e.version}`,
      type: 'radio',
      checked: e.dir === currentDir,
      click: () => switchEngine(e),
    }));

    const template = [
      ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
      {
        label: '引擎',
        submenu: [
          { label: '检查并安装引擎更新…', click: () => checkEngineUpdate() },
          { label: '回滚到上一版本', click: () => rollbackEngine() },
          { type: 'separator' },
          ...(engineItems.length
            ? engineItems
            : [{ label: '(未安装引擎)', enabled: false }]),
          { type: 'separator' },
          { label: '打开日志目录', click: () => shell.openPath(paths.logsDir()) },
          { label: '打开引擎数据目录', click: () => shell.openPath(paths.engineDataDir()) },
        ],
      },
      {
        label: '壳',
        submenu: [
          { label: `当前版本 ${app.getVersion()}`, enabled: false },
          { label: '检查壳更新…', click: () => updater.checkNow() },
          { label: '手动下载壳更新…', click: () => shell.openExternal(RELEASES_PAGE) },
        ],
      },
      { role: 'editMenu' },
      { role: 'windowMenu' },
    ];
    Menu.setApplicationMenu(Menu.buildFromTemplate(template));
  }

  async function startFlow() {
    if (!splash || splash.isDestroyed()) splash = createSplashWindow();

    const engineDir = await resolveEngineDir();
    if (!engineDir) {
      manager.error = '未找到已安装的引擎。请先导入引擎(参见 README),或在开发模式下使用内置 mock 引擎。';
      manager.state = 'failed';
      sendStatus();
      return;
    }

    try {
      const url = await manager.start(engineDir);
      if (!main || main.isDestroyed()) {
        main = createMainWindow(url);
      } else if (main.webContents.getURL() !== url) {
        // 主窗口当前显示的是失败页,重新加载引擎 UI
        main.loadURL(url);
      }
      if (splash && !splash.isDestroyed()) {
        splash.destroy();
        splash = null;
      }
      if (SMOKE) {
        main.webContents.once('did-finish-load', () => {
          houseLog.info('SMOKE_OK: window loaded engine UI');
          setTimeout(() => app.quit(), 600);
        });
      }
    } catch (_) {
      showFailure();
      if (SMOKE) {
        houseLog.info('SMOKE_FAIL: engine did not start');
        setTimeout(() => app.quit(1), 600);
      }
    }
  }

  function showFailure() {
    const failureUrl = path.join(__dirname, '..', 'renderer', 'failure.html');
    if (splash && !splash.isDestroyed()) {
      splash.loadFile(failureUrl);
      splash.setSize(560, 460);
      splash.setResizable(true);
      return;
    }
    if (!main || main.isDestroyed()) main = createMainWindow('about:blank');
    main.loadFile(failureUrl);
  }

  app.on('before-quit', () => {
    manager.stop().catch(() => {});
  });
  app.on('window-all-closed', () => app.quit());

  registerIpc({
    getManager: () => manager,
    startFlow,
    importMockEngine,
    logsDir: () => paths.logsDir(),
  });

  buildMenu();
  await startFlow();
}
