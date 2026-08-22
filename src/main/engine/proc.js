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

  const child = spawn(manifest.launch.command, args, {
    cwd,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  child.stdout.on('data', (d) => engineLogger.info('[stdout]', d.toString().trimEnd()));
  child.stderr.on('data', (d) => engineLogger.info('[stderr]', d.toString().trimEnd()));
  return child;
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

module.exports = { getFreePort, spawnEngine, waitForReady, stopEngine };
