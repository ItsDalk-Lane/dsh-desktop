'use strict';

const EventEmitter = require('events');
const { loadEngineManifest } = require('./manifest');
const { getFreePort, spawnEngine, waitForReady, stopEngine } = require('./proc');

// 引擎状态机:idle -> resolving -> starting -> ready | failed | stopping
// 每次状态变化广播给渲染层(启动画面/失败页据此刷新)
class EngineManager extends EventEmitter {
  constructor({ paths, registry, logger, engineLogger }) {
    super();
    this.paths = paths;
    this.registry = registry;
    this.logger = logger;
    this.engineLogger = engineLogger;
    this.state = 'idle';
    this.manifest = null;
    this.child = null;
    this.error = null;
    this.url = null;
  }

  get status() {
    return {
      state: this.state,
      engine: this.manifest
        ? { id: this.manifest.id, name: this.manifest.name, version: this.manifest.version }
        : null,
      url: this.url,
      error: this.error,
    };
  }

  broadcast() {
    this.emit('status', this.status);
  }

  async start(engineDir) {
    if (this.child) await this.stop();

    this.error = null;
    this.state = 'resolving';
    this.broadcast();
    try {
      const manifest = loadEngineManifest(engineDir);
      this.manifest = manifest;
      this.state = 'starting';
      this.broadcast();
      this.logger.info(`starting engine ${manifest.id}@${manifest.version} from ${engineDir}`);

      const port =
        manifest.launch.port.strategy === 'fixed'
          ? manifest.launch.port.value
          : await getFreePort();

      const { child, spawnError } = spawnEngine({
        manifest,
        engineDir,
        port,
        dataDir: this.paths.engineDataDir(),
        engineLogger: this.engineLogger,
      });
      this.child = child;
      // 运行期意外退出(非主动 stop)时标记失败,让兜底页出现
      child.on('exit', (code) => {
        if (this.state === 'ready' || this.state === 'starting') {
          this.error = `engine exited unexpectedly (code=${code})`;
          this.state = 'failed';
          this.broadcast();
        }
      });

      // 就绪探测 vs spawn 失败,谁先到听谁的;输的一方静默收尾
      const ready = waitForReady(port, manifest.launch.readyCheck);
      ready.catch(() => {});
      await Promise.race([ready, spawnError]);
      this.url = `http://127.0.0.1:${port}`;
      this.state = 'ready';
      this.logger.info(`engine ready at ${this.url}`);
      this.broadcast();
      return this.url;
    } catch (e) {
      this.error = e.message;
      this.state = 'failed';
      this.logger.error(`engine start failed: ${e.message}`);
      if (this.child) await stopEngine(this.child).catch(() => {});
      this.child = null;
      this.broadcast();
      throw e;
    }
  }

  async stop() {
    if (!this.child) return;
    this.state = 'stopping';
    this.broadcast();
    const child = this.child;
    this.child = null;
    await stopEngine(child);
    this.state = 'idle';
    this.broadcast();
  }
}

module.exports = { EngineManager };
