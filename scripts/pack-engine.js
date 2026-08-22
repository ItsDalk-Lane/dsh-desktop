#!/usr/bin/env node
'use strict';

// 把本地引擎目录打包成可发布的产物,并合并进 release-index.json:
//   node scripts/pack-engine.js <引擎目录> --out <输出目录> [--base-url http://…/]
// 产物:<id>-<version>-<platform>-<arch>.tgz + release-index.json(含 sha256/size)
// 把输出目录扔到任意静态托管(GitHub Releases / OSS / 内网文件服务器)即可当发布源。
// M3 的 CI 就是把这一步搬上构建矩阵自动化。

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const { loadEngineManifest } = require('../src/main/engine/manifest');
const { platformKey } = require('../src/main/engine/installer');

const execFileP = promisify(execFile);

const args = process.argv.slice(2);

// 支持 `--flag value` 和 `--flag=value` 两种写法
function argValue(flag) {
  const prefix = `--${flag}=`;
  const inline = args.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const i = args.indexOf(`--${flag}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

const engineDir = args[0];
const outDir = argValue('out');
const baseUrl = argValue('base-url') || '';

if (!engineDir || !outDir || engineDir.startsWith('--')) {
  console.error('用法: node scripts/pack-engine.js <引擎目录> --out <输出目录> [--base-url http://…/]');
  process.exit(1);
}

const outDirResolved = path.resolve(outDir);

async function main() {
  const manifest = loadEngineManifest(engineDir);
  const key = platformKey();
  const fileName = `${manifest.id}-${manifest.version}-${key}.tgz`;
  const tgzPath = path.join(outDirResolved, fileName);
  fs.mkdirSync(outDirResolved, { recursive: true });

  console.log(`打包 ${manifest.id}@${manifest.version} (${key}) …`);
  await execFileP('tar', [
    '--exclude', '.DS_Store',
    '--exclude', '._*',
    '-czf', tgzPath,
    '-C', path.resolve(engineDir), '.',
  ]);

  const buf = await fs.promises.readFile(tgzPath);
  const sha256 = crypto.createHash('sha256').update(buf).digest('hex');
  const size = buf.length;

  const indexPath = path.join(outDirResolved, 'release-index.json');
  let index = { engines: [] };
  try {
    index = JSON.parse(fs.readFileSync(indexPath, 'utf8'));
    index.engines = index.engines || [];
  } catch (_) { /* new index */ }

  const url = baseUrl ? baseUrl.replace(/\/$/, '') + '/' + fileName : fileName;
  let entry = index.engines.find((e) => e.id === manifest.id && e.version === manifest.version);
  if (!entry) {
    entry = { id: manifest.id, name: manifest.name, version: manifest.version, packages: {} };
    index.engines.push(entry);
  }
  entry.packages[key] = { url, sha256, size };
  fs.writeFileSync(indexPath, JSON.stringify(index, null, 2));

  console.log(`产物: ${tgzPath}`);
  console.log(`大小: ${(size / 1048576).toFixed(1)} MB  sha256: ${sha256.slice(0, 16)}…`);
  console.log(`索引: ${indexPath}`);
}

main().catch((e) => {
  console.error(`打包失败: ${e.message}`);
  process.exit(1);
});
