#!/usr/bin/env node
'use strict';

// 组装一个指定版本的 dsh 引擎目录(CI 与本地通用):
//   node scripts/make-dsh-engine.js <version> --out <dir> [--registry https://…]
// engine.json 由本脚本生成 —— dsh 引擎清单的唯一权威来源,
// 上游改启动方式时只需改这里,CI 产物自动跟着变。

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const args = process.argv.slice(2);
function argValue(flag) {
  const prefix = `--${flag}=`;
  const inline = args.find((a) => a.startsWith(prefix));
  if (inline) return inline.slice(prefix.length);
  const i = args.indexOf(`--${flag}`);
  if (i >= 0 && i + 1 < args.length) return args[i + 1];
  return null;
}

const version = args[0];
const outDir = argValue('out');
const registry = argValue('registry');

if (!version || !outDir || version.startsWith('--')) {
  console.error('用法: node scripts/make-dsh-engine.js <version> --out <dir> [--registry https://…]');
  console.error('例如: node scripts/make-dsh-engine.js 0.1.1-rc.2 --out ./engine');
  process.exit(1);
}

// 与 docs/architecture.md「真实 dsh 引擎」一节保持一致(2026-08-22 实测核实):
// --port ${PORT} 接收房子注入的随机端口;--no-open 防止抢浏览器;DSH_HOME 重定向数据目录
const manifest = {
  id: 'dsh',
  name: 'DeepSeek Harness',
  version,
  launch: {
    command: 'node',
    args: [
      'node_modules/@deepseek-ai/dsh/lib/bin.js',
      'web',
      '--host', '127.0.0.1',
      '--no-open',
      '--port', '${PORT}',
    ],
    cwd: '.',
    port: { strategy: 'arg' },
    readyCheck: { path: '/', timeoutMs: 120000, intervalMs: 500 },
  },
  dataDirEnv: 'DSH_HOME',
  // 插件中心契约:上游 dsh 改 CLI 布局/profile 约定时只改这里,房子零改动
  plugins: {
    binPath: 'node_modules/@deepseek-ai/dsh/lib/bin.js',
    profile: 'web',
    homeEnv: 'DSH_HOME',
  },
};

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(
  path.join(outDir, 'package.json'),
  JSON.stringify({ name: 'dsh-engine', private: true }, null, 2)
);
fs.writeFileSync(path.join(outDir, 'engine.json'), JSON.stringify(manifest, null, 2));

// dsh 依赖树很大(400+ 包),npm 解析时内存消耗可观:
// CI 的 macOS runner 只有 7GB 内存,Node 在这类机器上的默认堆上限约 2GB,会 OOM
// (2026-08-22 首次 CI 实测)。显式放宽到 4GB,并降低并发下载数减少内存峰值。
const npmEnv = Object.assign({}, process.env, {
  NODE_OPTIONS: `${process.env.NODE_OPTIONS || ''} --max-old-space-size=4096`.trim(),
});
const npmArgs = [
  'install', '--no-fund', '--no-audit', '--no-progress', '--maxsockets=5',
  `@deepseek-ai/dsh@${version}`,
];
if (registry) npmArgs.push(`--registry=${registry}`);
console.log(`npm ${npmArgs.join(' ')}(在 ${outDir} 下)`);
execFileSync('npm', npmArgs, {
  cwd: outDir,
  env: npmEnv,
  stdio: 'inherit',
  shell: process.platform === 'win32', // Windows 上 npm 是 npm.cmd
});

console.log(`引擎目录就绪: ${path.resolve(outDir)}(dsh@${version})`);
console.log('下一步: node scripts/pack-engine.js <dir> --out dist/ --base-url <发布地址>');
