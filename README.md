# DSH Desktop

DeepSeek Harness 的桌面发行版:**插件中心、插件发现、视觉增强**一站到位。

DSH Desktop 在源码层面吸收了官方 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
(`dsh-v0.1.1-rc.2`)引擎,并摘入
[deepseek-harness-studio](https://github.com/fufankeji/deepseek-harness-studio)(MIT)的
桌面壳与两大功能域,重新品牌化后随安装包整体分发 —— 引擎不再是外部下载的独立工件。

## 功能

- **插件中心**:侧边栏一级入口。搜索/浏览已发布插件,事务化安装
  (快照 → 停机 → 安装 → 读回验证 → 重启验证),启停/卸载/更新,故障自动回滚,
  卸载默认保留插件数据
- **插件发现**:精选/最近更新/生态热门三分区 + 能力分类,实时读取 npm
  `dsh-plugin` 生态;对话内自然语言"让 Agent 找插件"(内置 find-plugins 技能)
- **视觉增强**:输入框左侧开关,一键切换到支持图片的模型;原生 DeepSeek 视觉路线
  (Files API 引用 + 内联回退)与兼容路线(阿里云百炼 / OpenRouter / Ollama / vLLM /
  SGLang / 自定义 OpenAI-compatible,需真实图片验证后保存)
- 继承自引擎与 studio 的其余能力:Preset 广场、应用中心、内置皮肤、中文权限三档等

## 开发

```bash
corepack pnpm install --frozen-lockfile   # pnpm 11.7.0(packageManager 钉住)
corepack pnpm build                       # 构建 monorepo(引擎 + Web + 桌面壳)
corepack pnpm dev:desktop                 # 开发模式启动桌面应用
corepack pnpm --filter @deepseek-ai/dsh-desktop run dist   # 本地打包(electron-builder)
```

要求 Node `^22.19 || >=24`。

## 架构

```
apps/desktop    Electron 桌面壳(studio 壳,品牌 DSH Desktop):
                dshDesktop 桥接契约、插件中心可信任后端(安装事务/恢复/兼容预检)、
                托盘常驻 Host 生命周期、electron-updater 自动更新
apps/cli        @deepseek-ai/dsh 引擎 CLI(源码吸收,含 find-plugins 技能)
apps/web        Web 前端(dsh-web-frontend + desktop-marker)
packages/       引擎与 UI 包(官方 50 包 + studio 增量:
                ui-plugin-center / ui-desktop-customization / plugin-center 契约 /
                apiproxy 视觉增强 Host 侧 等)
```

- 打包后引擎位于 `resourcesPath/host/node_modules`,插件安装用内置 pnpm
- 用户数据:`~/Library/Application Support/dsh-desktop`(与历代版本同路径);
  引擎数据 `DSH_HOME → userData/engine-data`(settings.yaml / 会话 / 插件 profile)
- 更新通道:GitHub Releases(`ItsDalk-Lane/dsh-desktop`),推 `app-v*` tag 出包

源码基座与升级路径见 [docs/UPSTREAM_BASE.md](docs/UPSTREAM_BASE.md)。

## 许可

MIT。本仓库包含来自 deepseek-ai/deepseek-harness 与 fufankeji/deepseek-harness-studio
的源码,详见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
