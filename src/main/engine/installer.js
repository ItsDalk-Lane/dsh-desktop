'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { loadEngineManifest } = require('./manifest');

// 把一个引擎目录复制进 userData/engines/ 并设为当前引擎。
// 用于本地导入(脚手架阶段);远程下载是里程碑 2,见 docs/architecture.md。
async function importFromDirectory({ fromDir, enginesRoot, currentEngineFile, setCurrent, force = false }) {
  const manifest = loadEngineManifest(fromDir); // 先校验清单,合法才复制
  const dest = path.join(enginesRoot, manifest.id);
  if (fs.existsSync(dest)) {
    if (!force) {
      throw new Error(`engine "${manifest.id}" already installed at ${dest} (use force to overwrite)`);
    }
    await fsp.rm(dest, { recursive: true, force: true });
  }
  await fsp.cp(fromDir, dest, { recursive: true });
  setCurrent(currentEngineFile, dest, manifest.id);
  return manifest;
}

// 里程碑 2:从发布索引下载引擎。
// 流程:取索引 -> 选引擎+平台包 -> 下载(流式哈希校验)-> 解压到 .staging ->
// 校验 engine.json -> 原子 rename 到 engines/<id>@<version> -> 切 current 指针。
// 任何一步失败都清理现场、不动当前引擎 —— 失败即天然回滚。
const { execFile } = require('child_process');
const { promisify } = require('util');
const { fetchJson, downloadFile } = require('./downloader');
const { tarCommand } = require('./tar');
const execFileP = promisify(execFile);

function platformKey() {
  return `${process.platform}-${process.arch}`;
}

function pickEngineEntry(index, engineId) {
  const entries = (index && index.engines) || [];
  if (!entries.length) throw new Error('release index has no engines');
  if (engineId) {
    const entry = entries.find((e) => e.id === engineId);
    if (!entry) throw new Error(`engine "${engineId}" not found in release index`);
    return entry;
  }
  // 未指定时取索引里版本号最大的(数字感知的字符串比较,脚手架够用)
  return [...entries].sort((a, b) =>
    String(b.version).localeCompare(String(a.version), undefined, { numeric: true })
  )[0];
}

async function installFromRelease({ indexUrl, engineId, enginesRoot, currentEngineFile, setCurrent, logger = console }) {
  const index = await fetchJson(indexUrl);
  const entry = pickEngineEntry(index, engineId);
  const key = platformKey();
  const pkg = entry.packages && entry.packages[key];
  if (!pkg) throw new Error(`engine "${entry.id}" has no package for ${key}`);

  const version = entry.version;
  const destName = `${entry.id}@${version}`;
  const staging = path.join(enginesRoot, '.staging');
  const tgzPath = path.join(staging, `${destName}.tgz`);
  const extractDir = path.join(staging, destName);
  const finalDir = path.join(enginesRoot, destName);
  fs.mkdirSync(staging, { recursive: true });

  const pkgUrl = new URL(pkg.url, indexUrl).href;
  logger.info(`downloading ${pkgUrl} …`);
  try {
    await downloadFile(pkgUrl, tgzPath, { expectedSha256: pkg.sha256, expectedSize: pkg.size });
    logger.info(`download ok (${(pkg.size / 1048576).toFixed(1)} MB), sha256 verified`);

    fs.rmSync(extractDir, { recursive: true, force: true });
    fs.mkdirSync(extractDir, { recursive: true });
    await execFileP(tarCommand(), ['-xzf', tgzPath, '-C', extractDir]);
    const manifest = loadEngineManifest(extractDir); // 解压后先验契约再落地
    if (manifest.version !== version) {
      throw new Error(`manifest version ${manifest.version} != index version ${version}`);
    }

    fs.rmSync(finalDir, { recursive: true, force: true }); // 重装同版本 = 覆盖
    fs.renameSync(extractDir, finalDir);
    setCurrent(currentEngineFile, finalDir, entry.id);
    logger.info(`installed engine ${manifest.name}@${manifest.version} at ${finalDir}`);
    return manifest;
  } finally {
    fs.rmSync(tgzPath, { force: true });
    fs.rmSync(extractDir, { recursive: true, force: true });
  }
}

module.exports = { importFromDirectory, installFromRelease, platformKey, pickEngineEntry };
