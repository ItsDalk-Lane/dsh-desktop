'use strict';

const net = require('net');
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
  });
}

// 从 Finder/DMG 图标启动 App 时,GUI 进程没有 shell 的 PATH,系统里即使装了
// node 也找不到(spawn node ENOENT —— 2026-08-23 实测踩坑)。
// 解法:把清单里的 "node" 替换为 App 自己的 Electron 二进制 + ELECTRON_RUN_AS_NODE=1,
// 它就是一台完整的 Node,零额外体积。
// 同时带上 --expose-internals:dsh 的 Cordis HMR 插件要求此参数才能加载
// (dataelement/dsh-desktop 的同款做法),只授予引擎子进程,不影响 App 自身。
function resolveCommand(command, env) {
  if (command !== 'node') return { command, preArgs: [] };
  env.ELECTRON_RUN_AS_NODE = '1';
  return { command: process.execPath, preArgs: ['--expose-internals'] };
}

function spawnEngine({ manifest, engineDir, port, dataDir, engineLogger }) {
  const cwd = path.resolve(engineDir, manifest.launch.cwd);
  const env = Object.assign({}, process.env, manifest.env);
  let args = manifest.launch.args;
  if (manifest.launch.port.strategy === 'env') {
    env[manifest.launch.port.envName || 'DSH_DESKTOP_PORT'] = String(port);
  }
  if (manifest.launch.port.strategy === 'arg') {
    // "arg" 策略:把 args 里的 ${PORT} 占位符替换为房子选定的端口
    // (用于只认 --port 参数、不认环境变量的引擎,如 dsh web)
    args = args.map((a) => a.replace('${PORT}', String(port)));
  }
  if (manifest.dataDirEnv && dataDir) {
    env[manifest.dataDirEnv] = dataDir;
  }

  const { command, preArgs } = resolveCommand(manifest.launch.command, env);
  const child = spawn(command, [...preArgs, ...args], {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => engineLogger.info('[stdout]', d.toString().trimEnd()));
  child.stderr.on('data', (d) => engineLogger.info('[stderr]', d.toString().trimEnd()));
  // spawn 失败(如 ENOENT)是异步 'error' 事件,不接住会变成主进程未捕获异常弹窗
  const spawnError = new Promise((resolve, reject) => {
    child.once('error', (e) => reject(new Error(`引擎进程启动失败(${command}): ${e.message}`)));
  });
  spawnError.catch(() => {}); // 由调用方通过 race 决定胜负;此处先吞掉防 unhandledRejection
  return { child, spawnError };
}

// 就绪探测:轮询 http://127.0.0.1:<port><path>,2xx/3xx/4xx 都算活着
// (引擎启动早期可能暂时 404,只有连不上或 5xx 才继续等)
function waitForReady(port, readyCheck) {
  const { path: checkPath, timeoutMs, intervalMs } = readyCheck;
  return new Promise((resolve, reject) => {
    const startedAt = Date.now();
    const attempt = () => {
      const req = http.get(
        { host: '127.0.0.1', port, path: checkPath, timeout: 2000 },
        (res) => {
          res.resume();
          if (res.statusCode && res.statusCode < 500) return resolve();
          retry();
        }
      );
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
      req.on('error', retry);
    };
    const retry = () => {
      if (Date.now() - startedAt > timeoutMs) {
        return reject(new Error(`engine not ready within ${timeoutMs}ms on port ${port}`));
      }
      setTimeout(attempt, intervalMs);
    };
    attempt();
  });
}

// 优雅退出:先 SIGTERM,超时后 SIGKILL
function stopEngine(child, timeoutMs = 5000) {
  return new Promise((resolve) => {
    if (!child || child.exitCode !== null) return resolve();
    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
    }, timeoutMs);
    child.on('exit', () => {
      clearTimeout(timer);
      resolve();
    });
    try { child.kill('SIGTERM'); } catch (_) { /* already gone */ }
  });
}

module.exports = { getFreePort, spawnEngine, waitForReady, stopEngine, resolveCommand };