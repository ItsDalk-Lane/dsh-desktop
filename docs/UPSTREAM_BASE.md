# 源码基座记录

本仓库在 2026-08-23 完成架构改造:源码级吸收官方 DeepSeek Harness 引擎,并摘入
[fufankeji/deepseek-harness-studio](https://github.com/fufankeji/deepseek-harness-studio)
的两大功能域(插件中心+插件发现、视觉增强)与桌面壳,重新品牌化为 DSH Desktop。

## 基座版本

| 来源 | 仓库 | ref | 说明 |
|---|---|---|---|
| 引擎基座 | deepseek-ai/deepseek-harness | `dsh-v0.1.1-rc.2`(commit `b150a551b8`) | apps/、packages/、vendor/、native/、python/、patches/、scripts/、docs/ 与根构建配置 |
| 功能增量与桌面壳 | fufankeji/deepseek-harness-studio | `main`(commit `11b6fcf`,浅克隆) | 覆盖叠加于基座之上:apps/desktop、apps/web 增量、packages 全部差异(含 ui-plugin-center、ui-desktop-customization、plugin-center/contracts、apiproxy 视觉增强等) |

叠加时**未带入** studio 的:`.agents/`、`.claude/`、`website/`、`assets/`、品牌文档
(BRAND_GUIDELINES*)、studio 的 README/PLUGIN_CENTER_*/UPSTREAM_* 文档与其 `.github/` CI。
差异台账见 `/tmp/studio-vs-upstream.diff`(临时);升级时重新 diff 两个上游即可重建。

## 许可

引擎与摘入代码均为 MIT(官方 LICENSE 与 THIRD_PARTY_NOTICES.md 已随基座带入)。
studio 侧增量同为 MIT,署名保留于 THIRD_PARTY_NOTICES.md。

## 升级路径

- 官方引擎升级:克隆官方新 tag → 与本仓库 `packages/`、`apps/cli`、`apps/web` diff → 按需合入
- studio 功能升级:克隆 studio 新 commit → 与本仓库 `apps/desktop`、功能相关包 diff → 按需合入
