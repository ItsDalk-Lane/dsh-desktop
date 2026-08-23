# 架构:房子与住客

## 模型

```
┌─────────────── DSH Desktop(房子,Electron) ────────────────┐
│  主进程                                                      │
│   ├─ 引擎管理器(状态机) ── spawn ──► 引擎子进程(住客)     │
│   │                                      │ 自带 Web UI      │
│   ├─ 启动画面 / 失败兜底页               │ engine.json 契约 │
│   └─ 主窗口 BrowserWindow ──加载──► http://127.0.0.1:<随机端口>│
└──────────────────────────────────────────────────────────────┘
        userData/engines/<id>/          ← 住客住处(可多版本共存)
        userData/engine-data/           ← 住客的行李(用户数据,换人不丢)
```

关键点:

1. **主窗口加载的是引擎自带的 Web UI**,壳不做任何界面;换引擎后界面自动是新的。
2. **主窗口无 preload、无 Node 权限**,且导航被限制在 127.0.0.1/localhost,外链丢给系统浏览器。
3. **数据与安装分离**:引擎用户数据通过 `dataDirEnv` 注入统一目录,换住客、升级房子都不丢。
4. **端口**:优先让引擎接受随机端口注入(`strategy: env`,防和用户已在跑的 dsh 冲突);引擎只支持固定端口时用 `strategy: fixed`。

## engine.json —— 门(唯一契约)

| 字段 | 必填 | 说明 |
|---|---|---|
| `id` | 建议 | 引擎标识,即 `engines/` 下目录名,缺省取目录名 |
| `name` / `version` | 是 | 展示用 |
| `launch.command` | 是 | 启动命令,在引擎目录下执行 |
| `launch.args` | 否 | 命令参数 |
| `launch.cwd` | 否 | 工作目录,相对引擎目录,缺省 `.` |
| `launch.port.strategy` | 否 | `env`(默认,推荐)或 `fixed` |
| `launch.port.envName` | 否 | env 模式下端口注入的变量名,缺省 `DSH_DESKTOP_PORT` |
| `launch.port.value` | fixed 必填 | 固定端口号 |
| `launch.readyCheck.path` | 否 | 就绪探测路径,缺省 `/` |
| `launch.readyCheck.timeoutMs` | 否 | 就绪超时,缺省 20000 |
| `dataDirEnv` | 否 | 房子把 `userData/engine-data` 注入到该变量 |
| `env` | 否 | 额外环境变量 |

上游 dsh 改了启动方式时,新引擎版本带一份新清单即可,房子的启动逻辑读清单而不写死 —— 大部分上游变化被清单吸收。

## 真实 dsh 引擎(已核实并实测通过)

2026-08-22 对照 `@deepseek-ai/dsh@0.1.1-rc.2` 实测核实的契约:

1. **端口**:`dsh web --port <port>` 支持显式指定(也支持 0 让系统选,但房子需要自己知道端口,所以用房子的随机端口 + `"strategy": "arg"` 的 `${PORT}` 占位符注入)
2. **禁止自动开浏览器**:`--no-open` 必须传,否则 dsh 会和房子窗口抢浏览器
3. **数据目录**:环境变量 `DSH_HOME` 控制 dsh 全部状态(profiles/、storages/、插件),房子通过 `dataDirEnv: "DSH_HOME"` 注入到 `userData/engine-data`
4. **启动入口**:引擎目录内 `node node_modules/@deepseek-ai/dsh/lib/bin.js web ...`
5. **就绪耗时**:全新 DSH_HOME 首次启动约 4~6 秒,`/` 返回 200;清单超时设 120s 留足余量

实测通过的引擎目录(271MB,含 node_modules)组装方式:

```bash
mkdir engines/dsh && cd engines/dsh
npm init -y && npm install @deepseek-ai/dsh
# 写入下面这份 engine.json,然后 node <dsh-desktop>/scripts/import-engine.js engines/dsh
```

```json
{
  "id": "dsh",
  "name": "DeepSeek Harness",
  "version": "0.1.1-rc.2",
  "launch": {
    "command": "node",
    "args": ["node_modules/@deepseek-ai/dsh/lib/bin.js", "web",
             "--host", "127.0.0.1", "--no-open", "--port", "${PORT}"],
    "port": { "strategy": "arg" },
    "readyCheck": { "path": "/", "timeoutMs": 120000, "intervalMs": 500 }
  },
  "dataDirEnv": "DSH_HOME"
}
```

上游发新版时:改 `version`、`npm install @deepseek-ai/dsh@<新版本>`、重新导入 —— 房子零改动。

## 里程碑

- **M1(已完成)** 房子壳:启动画面、引擎状态机、本地导入、失败兜底、mock 引擎端到端验证;**真 dsh 0.1.1-rc.2 引擎已接入并实测通过**(随机端口注入、DSH_HOME 重定向、原版 Web UI 加载)
- **M2(已完成)** 远程下载引擎:`installFromRelease()` 全链路实测通过——取发布索引 → 按 `平台-架构` 选包 → 流式下载(边下边算 sha256、停滞超时保护)→ 解压到 `.staging` → 校验 engine.json → 原子 rename 到 `engines/<id>@<version>` → 切 current 指针。任何一步失败都清理现场、不动当前引擎(坏哈希实测被干净拒绝)。配套:
  - `scripts/pack-engine.js` —— 本地引擎打包成 `<id>-<version>-<平台>.tgz` + 合并 `release-index.json`(sha256/size),产物扔到任意静态托管即成发布源
  - `scripts/fetch-engine.js` —— 命令行安装(与 App 菜单同一条代码路径)
  - 应用菜单「引擎」:检查并安装更新 / 回滚到上一版本(current.json 的 previous 指针,实测来回切换正常)
  - 发布源配置:环境变量 `DSH_DESKTOP_RELEASE_INDEX` 或 `userData/config.json` 的 `releaseIndexUrl`
- **M3(已交付,待推送激活)** CI 预构建:`.github/workflows/build-engines.yml` ——
  - 触发:手动指定版本 + 每日自动检查上游新版本(没变化则跳过,不耗配额)
  - 矩阵:macos-15(darwin-arm64)、macos-15-intel(darwin-x64)、windows-latest(win32-x64);dsh 的原生模块在哪个平台装就只认哪个平台,这正是矩阵构建的意义
  - 产物:每个平台一个 `<id>-<版本>-<平台>.tgz` + 索引分片,publish 作业合并成全局 `release-index.json` 一并挂到 GitHub Release(tag `engines`)
  - 发布源地址即:`https://github.com/<owner>/<repo>/releases/download/engines/release-index.json`(配进房子 `releaseIndexUrl` 即闭环)
  - 配套脚本:`make-dsh-engine.js`(组装指定版本引擎,engine.json 的唯一权威来源)、`merge-release-index.js`(多平台索引合并)
  - 激活方式:把本仓库推到 GitHub 即生效,无需任何 secret(用的是内置 GITHUB_TOKEN)
  - 本地已实测:make → pack 全链路模拟通过(npm install 453 包约数分钟,CI 上建议后续加 npm 缓存提速)
- **M4(已完成)** 房子自身自动更新 + 多引擎切换:
  - 壳更新:`electron-updater` 对接 GitHub Releases(启动后 5 秒 + 每 6 小时检查,自动下载,弹窗重启安装;Windows NSIS 全自动;macOS 未签名包安装步骤会失败,自动降级为打开发布页手动下载——配开发者证书后即为全自动)。菜单「壳 → 检查壳更新」
  - 多引擎切换:菜单「引擎」动态列出已装引擎(radio 单选,当前项打点),点击即切换并重启引擎,数据目录不变、Key/会话无缝延续;安装/切换/回滚后菜单自动重建
  - 发布流程:改 package.json 版本 → 提交 → 打 `app-v<版本>` tag 推送 → CI 构建三平台并自动创建同名 Release(安装包 + latest*.yml 更新元数据 + blockmap 增量文件)
  - **约束**:App 版本 Release 必须比 `engines` Release 发布得晚(electron-updater 取"最新 Release");引擎 CI 是往既有 `engines` Release 覆盖资产、不改变其日期,所以天然满足

- **M5(已完成)** 插件中心:菜单「插件 → 插件中心…」,搜索 npm 生态(`dsh-plugin` keyword,2000+ 包)、一键安装/启停/卸载。核心是主进程 `src/main/plugins.js` 的安装事务:装前校验精确版本 → 快照 profile(package.json + lockfile 到 `.plugin-backup/`)→ 停引擎 → `dsh plugin --profile web add <pkg>@<version> --save-exact`(pnpm 透传,`node` 走 Electron-as-node,与引擎同一解析路径)→ 包名写入 `dsh.profile.bundles` 启用 → 重启引擎 → 失败回滚快照并再次重启。渲染层只提交闭集意图,命令行/URL 全由主进程从 `engine.json` 可选 `plugins` 段构造(`binPath`/`profile`/`homeEnv`,由 make-dsh-engine.js 生成,上游改布局时只改生成器);没有该段的引擎(如 mock)自动隐藏插件能力。已装/已启用状态从 profile 派生不建第二账本,运行态以引擎内「设置 → 插件」为权威。2026-08-23 端到端实测:安装 dsh-cost-meter@1.5.38 → 引擎重启 → Loader 组装(engine.log `[dsh-cost-meter] 已加载`)→ 禁用 → 卸载 → 状态归零;坏版本拒绝、模拟 pnpm 失败回滚均通过。设计参照 deepseek-harness-studio 插件中心(裁剪:不自建 Registry、无故障注入恢复矩阵;保留:三段式事务、闭集意图、Electron 存活期拥有变更)。

## 已知取舍(当前脚手架)

- `before-quit` 里引擎停止是 fire-and-forget(SIGTERM 后 App 即退);极端情况子进程可能存活数秒,需要更强的进程守护时再引入 detached + pid 追踪
- fixed 端口策略下,若端口已被别的进程占用,就绪探测可能"错认"别人的服务;接入真 dsh 前应优先核实 env 端口支持
- 单实例锁已做;多窗口、深色标题栏等桌面细节按需再加
