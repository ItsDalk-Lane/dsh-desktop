#!/usr/bin/env node
'use strict';

// 合并发布索引(以 id+version 为键,平台包并入 packages,同平台覆盖):
//   node scripts/merge-release-index.js -o <输出> [旧索引.json] [分片1.json 分片2.json …]
// CI 的 publish 作业用它把各平台构建产物(fragment-*.json)合进全局 release-index.json。

const fs = require('fs');

const args = process.argv.slice(2);

// 输出文件支持 -o value / --out value / --out=value 三种写法
const outFile = (() => {
  const i = args.indexOf('-o');
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  const j = args.indexOf('--out');
  if (j >= 0 && j + 1 < args.length) return args[j + 1];
  const eq = args.find((a) => a.startsWith('--out='));
  return eq ? eq.slice('--out='.length) : null;
})();

const inputs = args.filter((a) => !a.startsWith('-') && a !== outFile);
if (!outFile || inputs.length === 0) {
  console.error('用法: node scripts/merge-release-index.js -o <输出> [旧索引.json] [分片…]');
  process.exit(1);
}

const readIndex = (f) => {
  try {
    const idx = JSON.parse(fs.readFileSync(f, 'utf8'));
    return idx && Array.isArray(idx.engines) ? idx : { engines: [] };
  } catch (_) {
    return { engines: [] };
  }
};

const merged = { engines: [] };
for (const file of inputs) {
  for (const entry of readIndex(file).engines) {
    let hit = merged.engines.find((e) => e.id === entry.id && e.version === entry.version);
    if (!hit) {
      hit = { id: entry.id, name: entry.name, version: entry.version, packages: {} };
      merged.engines.push(hit);
    }
    Object.assign(hit.packages, entry.packages || {});
  }
}

fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
console.log(`合并完成 -> ${outFile}`);
for (const e of merged.engines) {
  console.log(`  ${e.id}@${e.version}: ${Object.keys(e.packages).join(', ')}`);
}
