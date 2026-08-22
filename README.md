# DSH Desktop

把 [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness) 变成本地桌面客户端的"房子"。

**架构理念:房子一次建好,住客随便更换。**

- 房子(Electron 壳):窗口、启动画面、失败兜底、引擎生命周期管理 —— 建好之后基本不动
- 住客(dsh 引擎):自带 Web UI 的独立进程,通过 `engine.json` 清单与房子对接 —— 上游更新就换一个,房子不用重新发版
- 界面 = 引擎原版 Web UI,本壳不做任何界面设计;升级引擎,界面自动是新的

## 快速开始

```bash
npm install
npm start        # 开发模式:自动使用内置 mock 引擎,开箱即跑
npm run smoke    # 冒烟测试:拉起引擎→加载窗口→自动退出,验证整条链路
```

首次 `npm start` 会看到 mock 引擎页面(它模拟"引擎自带的 Web UI",并显示房子注入的端口和数据目录,证明整条链路在工作)。

## 换住客:两种方式

### 方式一:远程发布源(推荐,M2 已实现)

```bash
# 1. 打包引擎(本地或 CI 上执行,产物扔到任意静态托管)
node scripts/pack-engine.js <引擎目录> --out dist/ --base-url https://你的托管/dist/

# 2. 安装(命令行,或 App 菜单「引擎 → 检查并安装更新…」)
node scripts/fetch-engine.js https://你的托管/dist/release-index.json [引擎id]
```

下载全程流式 sha256 校验、原子安装(先装到 `.staging` 再切换),失败自动清理现场、绝不影响当前引擎;`current.json` 保留上一版本指针,App 菜单「回滚到上一版本」一键切换。发布源地址配在 `userData/config.json` 的 `releaseIndexUrl`(或环境变量 `DSH_DESKTOP_RELEASE_INDEX`)。

### 方式二:本地目录导入

```bash
node scripts/import-engine.js <引擎目录> [--force]
```

调试时也可以不导入,直接用环境变量指向引擎目录:`DSH_DESKTOP_ENGINE=/path/to/some-engine npm start`

引擎优先级:`DSH_DESKTOP_ENGINE` 环境变量 > `userData/engines/current.json` 指针 > (仅开发模式)内置 mock 引擎。上游 dsh 发新版:打包上传 → 菜单一键安装 —— 房子零改动、用户数据不丢。

**接入真 dsh(已实测通过)**:见 `docs/architecture.md`「真实 dsh 引擎」一节。

如何为真实 dsh 编写 `engine.json`(端口策略、启动命令等)见 [docs/architecture.md](docs/architecture.md)。

## 目录结构

```
dsh-desktop/
├── src/main/
│   ├── index.js            # 入口:编排启动流程(启动画面→引擎→主窗口)
│   ├── window.js           # 窗口创建与加固(沙箱、回环导航限制)
│   ├── preload.js          # 兜底页与主进程之间的安全 IPC 通道
│   ├── ipc.js              # 兜底页动作:重试/打开日志/导入 mock/退出
│   ├── paths.js            # userData 布局(engines/ engine-data/ logs/)
│   ├── logger.js           # house.log + engine.log 双日志
│   └── engine/
│       ├── manifest.js     # engine.json 契约:加载与校验(门)
│       ├── manager.js      # 引擎状态机:idle→starting→ready/failed
│       ├── proc.js         # 子进程:随机端口、就绪探测、优雅退出
│       ├── registry.js     # 已装引擎清单 + current.json 指针
│       └── installer.js    # 本地导入(远程下载是里程碑 2)
├── src/renderer/
│   ├── splash.html         # 启动画面(唯一自绘 UI 之一)
│   └── failure.html        # 失败兜底页:重试/看日志/换引擎
├── dev-engines/mock-dsh/   # mock 住客,端到端验证用
└── scripts/import-engine.js
```

用户数据全部在 `~/Library/Application Support/dsh-desktop/`(与安装目录分离,升级房子、换引擎都不丢):

- `engines/` —— 已安装的引擎(可多版本共存)
- `engine-data/` —— 引擎的用户数据(通过 `dataDirEnv` 注入,换住客不丢)
- `logs/house.log`、`logs/engine.log` —— 房子日志 / 引擎 stdout+stderr

## 自动构建引擎包(M3,CI)

`.github/workflows/build-engines.yml` 已就绪:推到 GitHub 后,每天自动检查 `@deepseek-ai/dsh` 新版本,有新版就在 macOS(arm64/x64)+ Windows(x64)矩阵上组装、打包、发布到 GitHub Release(tag `engines`)。发布源地址:

```
https://github.com/<owner>/<repo>/releases/download/engines/release-index.json
```

把它配到 `userData/config.json` 的 `releaseIndexUrl`,即完成"上游发版 → CI 自动打包 → 用户菜单一键更新"的全程无人值守闭环。手动触发:Actions 页面 Run workflow,可指定版本。无需配置任何 secret。

手动组装引擎目录(本地调试用,engine.json 的权威生成器):

```bash
node scripts/make-dsh-engine.js <版本号> --out ./engine
```

## 打包

```bash
npm run dist     # electron-builder → release/(macOS DMG / Windows NSIS)
```

房子本身零原生依赖、零运行时 npm 依赖;真正的原生模块在引擎包里,由引擎侧负责(详见架构文档的里程碑规划)。

## 路线图

见 [docs/architecture.md](docs/architecture.md):M1 壳+引擎契约 ✅ → M2 远程下载/哈希校验/回滚 ✅ → M3 CI 预构建(工作流已交付,推到 GitHub 即激活)→ M4 房子自身自动更新 + 多引擎切换 UI。
