#!/usr/bin/env node
'use strict';

// 从发布源安装引擎(与 App 菜单里的"检查并安装更新"同一条代码路径):
//   node scripts/fetch-engine.js <release-index.json 的 URL> [引擎id]
//   DSH_DESKTOP_USERDATA=/自定义路径 node scripts/fetch-engine.js <url> [id]
// 未指定引擎 id 时取索引里版本号最高的。

const fs = require('fs');
const path = require('path');
const { installFromRelease } = require('../src/main/engine/installer');
const registry = require('../src/main/engine/registry');

const url = process.argv[2];
const engineId = process.argv[3];
if (!url) {
  console.error('用法: node scripts/fetch-engine.js <release-index URL> [引擎id]');
  process.exit(1);
}

const home = process.env.HOME || '';
const userData =
  process.env.DSH_DESKTOP_USERDATA ||
  (process.platform === 'darwin'
    ? path.join(home, 'Library', 'Application Support', 'dsh-desktop')
    : path.join(home, '.local', 'share', 'dsh-desktop'));

const enginesRoot = path.join(userData, 'engines');
fs.mkdirSync(enginesRoot, { recursive: true });

installFromRelease({
  indexUrl: url,
  engineId,
  enginesRoot,
  currentEngineFile: path.join(enginesRoot, 'current.json'),
  setCurrent: registry.setCurrent,
  logger: console,
})
  .then((m) => {
    console.log(`已安装并设为当前引擎: ${m.name} @ ${m.version}`);
    console.log('现在运行 npm start 即可启动它。');
  })
  .catch((e) => {
    console.error(`安装失败: ${e.message}`);
    process.exit(1);
  });
