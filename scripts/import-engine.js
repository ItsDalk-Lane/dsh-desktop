#!/usr/bin/env node
'use strict';

// 把一个引擎目录导入房子的引擎仓库(userData/engines/)并设为当前引擎。
// 用法:
//   node scripts/import-engine.js <引擎目录> [--force]
//   DSH_DESKTOP_USERDATA=/自定义路径 node scripts/import-engine.js <引擎目录>
// 不依赖 Electron,直接操作与 App 相同的 userData 目录。

const fs = require('fs');
const path = require('path');
const { importFromDirectory } = require('../src/main/engine/installer');
const registry = require('../src/main/engine/registry');

const args = process.argv.slice(2);
const force = args.includes('--force');
const fromDir = args.find((a) => !a.startsWith('--'));

if (!fromDir) {
  console.error('用法: node scripts/import-engine.js <引擎目录> [--force]');
  console.error('引擎目录必须包含 engine.json,格式见 docs/architecture.md');
  process.exit(1);
}

const home = process.env.HOME || '';
const userData =
  process.env.DSH_DESKTOP_USERDATA ||
  (process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', 'dsh-desktop')
    : path.join(home, '.local', 'share', 'dsh-desktop'));

const enginesRoot = path.join(userData, 'engines');
const currentEngineFile = path.join(enginesRoot, 'current.json');
fs.mkdirSync(enginesRoot, { recursive: true });

importFromDirectory({
  fromDir: path.resolve(fromDir),
  enginesRoot,
  currentEngineFile,
  setCurrent: registry.setCurrent,
  force,
})
  .then((m) => {
    console.log(`已导入并设为当前引擎: ${m.name} @ ${m.version}`);
    console.log(`位置: ${path.join(enginesRoot, m.id)}`);
    console.log('现在运行 npm start 即可启动它。');
  })
  .catch((e) => {
    console.error(`导入失败: ${e.message}`);
    process.exit(1);
  });
