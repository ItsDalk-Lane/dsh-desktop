'use strict';

const fs = require('fs');
const path = require('path');

// engine.json 是"房子与住客之间的门"——唯一的契约。
// 上游 dsh 改了启动方式时,新引擎版本带一份新清单即可,房子不用重写。
//
// schema:
// {
//   "id": "mock-dsh",            // 引擎标识,也是 engines/ 下的目录名
//   "name": "Mock DSH Engine",   // 展示名
//   "version": "0.0.1",
//   "launch": {
//     "command": "node",         // 启动命令(相对引擎目录执行)
//     "args": ["server.cjs"],
//     "cwd": ".",                // 可选,工作目录(相对引擎目录)
//     "port": {                  // 端口策略:
//       "strategy": "env",       //   "env"   —— 房子选随机端口,通过 envName 注入(推荐)
//       "envName": "DSH_DESKTOP_PORT"
//       // "strategy": "arg"   —— args 中写 "${PORT}" 占位符,房子替换为选定端口(dsh web 用这种)
//       // 或 "strategy": "fixed", "value": 3080  —— 引擎只支持固定端口时用
//     },
//     "readyCheck": { "path": "/healthz", "timeoutMs": 15000 }  // 就绪探测
//   },
//   "dataDirEnv": "DSH_DESKTOP_DATA_DIR",  // 可选,房子把持久数据目录注入给引擎
//   "env": {}                    // 可选,额外环境变量
// }

const REQUIRED_FIELDS = ['name', 'version', 'launch'];

function loadEngineManifest(engineDir) {
  const file = path.join(engineDir, 'engine.json');
  if (!fs.existsSync(file)) {
    throw new Error(`engine.json not found in ${engineDir}`);
  }
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`invalid engine.json: ${e.message}`);
  }
  for (const key of REQUIRED_FIELDS) {
    if (!raw[key]) throw new Error(`engine.json missing field: ${key}`);
  }
  const launch = raw.launch;
  if (!launch.command) throw new Error('engine.json missing launch.command');

  const port = launch.port || { strategy: 'env', envName: 'DSH_DESKTOP_PORT' };
  const strategies = ['env', 'arg', 'fixed'];
  if (!strategies.includes(port.strategy)) {
    throw new Error(`launch.port.strategy must be one of: ${strategies.join(', ')}`);
  }
  if (port.strategy === 'arg' && !(launch.args || []).some((a) => a.includes('${PORT}'))) {
    throw new Error('arg port strategy requires a "${PORT}" placeholder in launch.args');
  }
  if (port.strategy === 'fixed' && !port.value) {
    throw new Error('fixed port strategy requires launch.port.value');
  }

  return {
    id: raw.id || path.basename(engineDir),
    name: raw.name,
    version: raw.version,
    launch: {
      command: launch.command,
      args: launch.args || [],
      cwd: launch.cwd || '.',
      port,
      readyCheck: Object.assign(
        { path: '/', timeoutMs: 20000, intervalMs: 300 },
        launch.readyCheck || {}
      ),
    },
    dataDirEnv: raw.dataDirEnv || null,
    env: raw.env || {},
    sourceDir: engineDir,
  };
}

module.exports = { loadEngineManifest };
