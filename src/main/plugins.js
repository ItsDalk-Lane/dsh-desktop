'use strict';

// 插件中心控制器(主进程侧)。
// 参照 deepseek-harness-studio 的插件中心骨架,按本房子的体量裁剪:
//   - 目录源:npm registry search API,按 dsh-plugin keyword 过滤(生态已核实,2000+ 包)
//   - 安装事务:校验 → 快照 → 停引擎 → dsh plugin(pnpm)装精确版本 → 写入启用清单
//     → 重启引擎 → 失败回滚快照并再次重启。渲染层只提交闭集意图(包名+精确版本),
//     URL/registry/命令行永不来自渲染层。
//   - 状态展示:已安装(profile 依赖)/ 已启用(dsh.profile.bundles)两态从 profile 派生,
//     不建第二份账本;运行态以引擎 Web UI 的插件清单为权威。
// 本模块不依赖 electron,可被普通 node 脚本直接驱动(便于端到端验证)。

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const EventEmitter = require('events');
const { resolveCommand } = require('./engine/proc');

const NPM_SEARCH_URL = 'https://registry.npmjs.org/-/v1/search';
const NPM_REGISTRY_ORIGIN = 'https://registry.npmjs.org';
const FETCH_TIMEOUT_MS = 15000;
const INSTALL_TIMEOUT_MS = 300000; // pnpm 装大插件可能要几分钟
const BACKUP_DIRNAME = '.plugin-backup';

// npm 包名合法形态(scoped 或普通),挡掉路径穿越/怪字符;版本只放行语义化字符
const NAME_RE = /^(@[a-z0-9-~][a-z0-9-._~]*\/)?[a-z0-9-._~]+$/i;
const VERSION_RE = /^[0-9a-z.+-]+$/i;

class PluginCenter extends EventEmitter {
  constructor({ paths, manifest, engineDir, logger, stopEngine, startEngine }) {
    super();
    this.paths = paths;
    this.manifest = manifest;
    this.engineDir = engineDir;
    this.logger = logger;
    this.stopEngine = stopEngine || (async () => {});
    this.startEngine = startEngine || (async () => {});
    this.op = null; // { kind, name, phase } | null,串行锁 + 窗口重连后的状态恢复
  }

  // ---- 能力解析 ------------------------------------------------------------
  // 引擎是否支持插件管理:优先读 engine.json 的 plugins 段(升级契约),
  // 没有则按已知 dsh 布局探测。mock 等其他引擎返回 null,插件中心显示不可用。
  capability() {
    const section = this.manifest && this.manifest.plugins;
    const binPath = section
      ? section.binPath
      : 'node_modules/@deepseek-ai/dsh/lib/bin.js';
    const abs = path.resolve(this.engineDir, binPath);
    if (!fs.existsSync(abs)) return null;
    return {
      engine: this.manifest ? `${this.manifest.name} ${this.manifest.version}` : '',
      profile: (section && section.profile) || 'web',
      homeEnv: (section && section.homeEnv) || (this.manifest && this.manifest.dataDirEnv) || 'DSH_HOME',
      binPath,
    };
  }

  profileDir() {
    return path.join(this.paths.engineDataDir(), 'profiles', this.capability().profile);
  }

  // ---- 目录搜索 ------------------------------------------------------------
  async search(query) {
    const q = String(query || '').trim().slice(0, 120);
    // 搜索词只影响 npm 全文检索,不影响任何本地路径/命令
    const url = `${NPM_SEARCH_URL}?text=${encodeURIComponent(`keywords:dsh-plugin ${q}`.trim())}&size=25`;
    const body = await boundedFetch(url);
    const installed = this.readProfileState();
    const seen = new Set();
    const results = [];
    for (const obj of body.objects || []) {
      const p = obj.package || {};
      if (!p.name || !NAME_RE.test(p.name)) continue;
      if (!(p.keywords || []).includes('dsh-plugin')) continue; // 只认生态命名的包
      if (seen.has(p.name)) continue;
      seen.add(p.name);
      const local = installed.plugins.find((x) => x.name === p.name);
      results.push({
        name: p.name,
        version: p.version,
        description: p.description || '',
        publisher: (p.publisher && p.publisher.username) || '',
        date: p.date || '',
        downloads: (obj.downloads && obj.downloads.monthly) || 0,
        installed: local ? local.state : 'none', // none | installed | enabled
      });
    }
    return { total: body.total || results.length, results };
  }

  // ---- 本地状态(从 profile 派生,不建第二份数据库) ------------------------
  readProfileState() {
    const cap = this.capability();
    const dir = this.profileDir();
    const manifestFile = path.join(dir, 'package.json');
    if (!fs.existsSync(manifestFile)) return { initialized: false, plugins: [] };
    let pkg;
    try {
      pkg = JSON.parse(fs.readFileSync(manifestFile, 'utf8'));
    } catch (e) {
      return { initialized: true, broken: e.message, plugins: [] };
    }
    const deps = pkg.dependencies || {};
    // 基础 bundle(@deepseek-ai/dsh-base 等)从 dsh 安装内解析,不在 profile 依赖里,
    // 这里只列"用户自己装出去的"插件
    const bundles = ((pkg.dsh && pkg.dsh.profile && pkg.dsh.profile.bundles) || []);
    const names = Object.keys(deps)
      .filter((n) => n !== 'dsh-profile-web')
      .filter((n) => !n.startsWith('@deepseek-ai/'));
    return {
      initialized: true,
      plugins: names.map((name) => ({
        name,
        version: String(deps[name]).replace(/^[^0-9]*/, ''), // 去 ^/~ 前缀
        enabled: bundles.includes(name),
        state: bundles.includes(name) ? 'enabled' : 'installed',
      })),
    };
  }

  // ---- 安装/卸载/启停事务 ---------------------------------------------------
  async install({ name, version }) {
    assertPkgId(name, version);
    this.beginOp('install', name);
    try {
      await this.phase('校验插件元数据');
      await verifyRegistryEntry(name, version); // 精确版本存在 + dsh-plugin keyword
      const restore = this.snapshot();
      try {
        await this.withEngineStopped(async () => {
          await this.pnpm(['add', '--save-exact', `${name}@${version}`], '下载并安装');
        });
        // 读回验证:pnpm 成功退出不算数,依赖真的落进 profile 才算
        const after = this.readProfileState();
        if (!after.plugins.some((p) => p.name === name)) {
          throw new Error('pnpm 已退出但依赖未出现在 profile 中');
        }
        await this.phase('写入启用清单');
        this.setBundle(name, true);
        await this.restartEngine('重启引擎以生效');
        restore.drop();
        this.endOp({ ok: true, name, version });
        return { ok: true, name, version };
      } catch (e) {
        await this.rollback(restore, e);
        throw e;
      }
    } catch (e) {
      this.endOp({ ok: false, name, error: e.message });
      throw e;
    }
  }

  async uninstall({ name }) {
    assertPkgId(name, '0.0.0');
    this.beginOp('uninstall', name);
    try {
      const restore = this.snapshot();
      try {
        await this.withEngineStopped(async () => {
          await this.pnpm(['remove', name], '卸载插件');
        });
        this.setBundle(name, false);
        await this.restartEngine('重启引擎以生效');
        restore.drop();
        this.endOp({ ok: true, name });
        return { ok: true, name };
      } catch (e) {
        await this.rollback(restore, e);
        throw e;
      }
    } catch (e) {
      this.endOp({ ok: false, name, error: e.message });
      throw e;
    }
  }

  // 只动启用清单,不碰包;同样走快照+重启,保持同一条事务路径
  async setEnabled({ name, enabled }) {
    assertPkgId(name, '0.0.0');
    this.beginOp(enabled ? 'enable' : 'disable', name);
    try {
      const restore = this.snapshot();
      try {
        this.setBundle(name, !!enabled);
        await this.restartEngine('重启引擎以生效');
        restore.drop();
        this.endOp({ ok: true, name, enabled: !!enabled });
        return { ok: true, name };
      } catch (e) {
        await this.rollback(restore, e);
        throw e;
      }
    } catch (e) {
      this.endOp({ ok: false, name, error: e.message });
      throw e;
    }
  }

  // ---- 事务原语 -------------------------------------------------------------
  beginOp(kind, name) {
    if (this.op) throw new Error(`已有操作进行中(${this.op.kind} ${this.op.name}),请稍候`);
    this.op = { kind, name, phase: '' };
  }

  endOp(result) {
    this.op = null;
    this.emit('event', { type: 'done', ...result });
  }

  async phase(text) {
    if (this.op) this.op.phase = text;
    this.emit('event', { type: 'phase', kind: this.op && this.op.kind, name: this.op && this.op.name, text });
  }

  // 变更前快照 profile 的两份账本;成功提交后 drop,失败回滚
  snapshot() {
    const dir = this.profileDir();
    const backupDir = path.join(dir, BACKUP_DIRNAME);
    fs.mkdirSync(backupDir, { recursive: true });
    const files = ['package.json', 'pnpm-lock.yaml'].filter((f) => fs.existsSync(path.join(dir, f)));
    for (const f of files) {
      fs.copyFileSync(path.join(dir, f), path.join(backupDir, f));
    }
    return {
      drop: () => fs.rmSync(backupDir, { recursive: true, force: true }),
      restore: () => {
        for (const f of files) {
          fs.copyFileSync(path.join(backupDir, f), path.join(dir, f));
        }
      },
    };
  }

  async rollback(restore, cause) {
    this.emit('event', { type: 'phase', text: `操作失败(${cause.message}),正在回滚…` });
    try {
      restore.restore();
    } catch (e) {
      this.logger.error(`plugin rollback failed: ${e.message}`);
    }
    try {
      await this.restartEngine('回滚后重启引擎');
    } catch (e) {
      // 回滚后引擎都起不来:保留快照现场,给出手动恢复路径,绝不静默吞掉
      throw new Error(`回滚完成但引擎重启失败:${e.message}(快照保留在 ${BACKUP_DIRNAME}/,可手动恢复)`);
    }
    restore.drop();
  }

  async withEngineStopped(fn) {
    await this.phase('停止引擎');
    await this.stopEngine();
    try {
      await fn();
    } finally {
      // pnpm 抛错时也先由 rollback 路径恢复;这里不重启,保持单一出口
    }
  }

  async restartEngine(text) {
    await this.phase(text);
    await this.startEngine(); // 抛错即事务失败,交给 rollback
  }

  // 在引擎目录下跑 dsh plugin(pnpm 透传)。命令来自清单+固定模板,
  // 渲染层永远无法注入命令行;node 用 Electron 自身(ELECTRON_RUN_AS_NODE),
  // 与引擎子进程同一条解析路径。
  pnpm(pnpmArgs, phaseText) {
    const cap = this.capability();
    return new Promise((resolve, reject) => {
      (async () => {
        await this.phase(phaseText);
        const cwd = path.resolve(this.engineDir, (this.manifest.launch && this.manifest.launch.cwd) || '.');
        const env = Object.assign({}, process.env, this.manifest.env || {});
        env[cap.homeEnv] = this.paths.engineDataDir();
        const { command, preArgs } = resolveCommand(this.manifest.launch.command, env);
        const child = spawn(
          command,
          [...preArgs, cap.binPath, 'plugin', '--profile', cap.profile, ...pnpmArgs],
          { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] }
        );
        let tail = '';
        const keep = (d) => {
          tail = (`${tail}${d.toString()}`).split('\n').slice(-6).join('\n');
          this.emit('event', { type: 'output', text: d.toString().trimEnd() });
        };
        child.stdout.on('data', keep);
        child.stderr.on('data', keep);
        const timer = setTimeout(() => {
          try { child.kill('SIGKILL'); } catch (_) { /* already gone */ }
          reject(new Error(`安装超时(>${INSTALL_TIMEOUT_MS / 1000}s)`));
        }, INSTALL_TIMEOUT_MS);
        child.on('error', (e) => {
          clearTimeout(timer);
          reject(new Error(`插件命令启动失败(${command}): ${e.message}`));
        });
        child.on('exit', (code) => {
          clearTimeout(timer);
          if (code === 0) return resolve();
          reject(new Error(`pnpm 退出码 ${code}:\n${tail || '(无输出)'}`));
        });
      })().catch(reject);
    });
  }

  // 启用 = 把包名写进 profile package.json 的 dsh.profile.bundles;
  // 启用所需的 patch 由插件包自带,格式变化由包自己吸收
  setBundle(name, enabled) {
    const dir = this.profileDir();
    const file = path.join(dir, 'package.json');
    const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (!pkg.dsh) pkg.dsh = {};
    if (!pkg.dsh.profile) pkg.dsh.profile = {};
    if (!Array.isArray(pkg.dsh.profile.bundles)) pkg.dsh.profile.bundles = [];
    const list = pkg.dsh.profile.bundles;
    const has = list.includes(name);
    if (enabled && !has) list.push(name);
    if (!enabled && has) list.splice(list.indexOf(name), 1);
    fs.writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  }
}

// ---- 工具 -------------------------------------------------------------------
function assertPkgId(name, version) {
  if (!NAME_RE.test(String(name || ''))) throw new Error(`非法包名:${name}`);
  if (!VERSION_RE.test(String(version || ''))) throw new Error(`非法版本号:${version}`);
}

async function boundedFetch(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, redirect: 'error' });
    if (res.status !== 200) throw new Error(`registry HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

// 装前校验:精确版本必须存在于 npm,且带 dsh-plugin keyword。
// 挡住拼写错误的包名和没有生态声明的普通包。
async function verifyRegistryEntry(name, version) {
  const body = await boundedFetch(`${NPM_REGISTRY_ORIGIN}/${encodeURIComponent(name).replace('%40', '@')}/${version}`);
  if (!(body.keywords || []).includes('dsh-plugin')) {
    throw new Error(`${name} 未声明 dsh-plugin keyword,拒绝安装`);
  }
  return body;
}

module.exports = { PluginCenter };
