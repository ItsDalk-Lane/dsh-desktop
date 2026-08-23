# @deepseek-ai/dsh-client-ui-brand-official

[English](README.md) | 中文

仅当 `DSH_CLIENT_BUILD_PROFILE` 为 `official` 时，本包才填充 `sidebar.brand.mark`、`sidebar.brand.name` 和 `conversation.hero.brand.mark`。其他构建仍会加载插件，但不注册 occupant，因此显示 shell fallback。

占位者承载 DSH Desktop 品牌：mark 是发行版的应用图标——带节点网络的圆角底板——以内联 data-URL `<img>` 嵌入；name 是 `DSH Desktop` 字标，沿用外壳品牌排版、统一字重。mark 按各宿主请求的方形边长绘制（侧边栏品牌行与收起轨道为 24，会话 hero 为 34），一个组件覆盖全部表面。

三个占位者通过嵌套的 `slots.inject()` 作为一组声明感知注册安装。因此无论该包的条目先于还是后于侧边栏和会话声明方激活，它都能工作；任一声明折叠时会撤回全部占位者，HMR 期间不会留下混合品牌。它不保留运行时状态。node 半边是空的 Loader seat；浏览器标题仍属于本包之外的构建环境事项。

## 模型体验

无，因为本包只贡献浏览器呈现；这里没有任何内容进入模型请求。

#### KV Cache 影响

无；本包既不组装也不发送 provider 请求。

## 已知限制与暂缓事项

- **本包只提供一组 occupant** —— 其他呈现应由占用相同 slot 的另一个 Cordis 包提供。
- **浏览器标题相互独立** —— `DSH_CLIENT_TITLE` 在构建期选择标题文字，而不经过 UI slot；boot 页自绘其字标。
- **mark 是图标位图的内联** —— 应用内 mark 与发行版应用图标逐字节一致；更新图标需重新生成 `dsh-mark-data.ts`，而非编辑 SVG。
